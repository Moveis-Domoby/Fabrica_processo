-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 78 — ABRIR NUMA CHAMADA E O RESTO
-- AO VIVO (SESSAO-32 · §1.1 e §1.3 · Lei de Desempenho §2, §4 e §5)
--
-- O teste de carga de 15/10 (40 pessoas) afogou o banco no regime: a cada card
-- que mudava, todo Meu Painel aberto relia 5 consultas e toda Visão do dia 7
-- (a escuta da tabela de cards INTEIRA), e a bolinha relia a cada 30 s uma
-- visão que recalcula o histórico inteiro de eventos (até 1,9 s por chamada).
--
--   1. plt_fn_minhas_execucoes()  — a bolinha pela posição projetada no card (o
--      MESMO conjunto de plt_vw_execucoes em_andamento da pessoa — prova no
--      harness e no banco real), em milissegundos.
--   2. plt_fn_dash_visao_do_dia() — a Visão do dia numa chamada (as 7 portas de
--      sempre, juntas; cada parte que a pessoa não pode ver volta vazia, como
--      antes) + o instante da leitura (a tela conta a espera sem reler).
--   3. plt_fn_abertura(rota, meu_painel) — a primeira abertura do app numa
--      chamada: perfil, vínculos, setores (menu), avisos do sino, 1ª página do
--      chat, a bolinha e — quando a 1ª tela é o Meu Painel — os dados dele; o
--      registro da navegação e a presença saem no mesmo gesto. Roda como quem
--      chama (security invoker): vê exatamente o que as consultas de antes viam.
--   4. Avisos ao vivo no lugar dos relógios:
--      · 'plt-aviso:painel'      — qualquer fato de card (Visão do dia, metas);
--      · 'plt-aviso:danificados' — a peça foi para / saiu de DANIFICADO;
--      · 'plt-chat-u:{pessoa}' evento 'meu_trabalho' — o card/execução/tarefa
--        DA PESSOA mudou (bolinha, Meu Painel, Meus afazeres);
--      · 'plt-aviso:setor_{id}' evento 'tarefas' — as tarefas do setor (Afazeres
--        do time; o quadro só ouve 'mudou' e não relê por causa disto);
--      · 'plt-aviso:estoque' evento 'tiny' — a fila do Tiny (Configurações);
--      · 'plt-aviso:lista_{id}' — o andamento de uma lista do Comercial.
--   5. Presença pelo gesto (Lei §4): cada fato com autor e cada navegação
--      carimbam "visto agora" — fim da gravação de 5 em 5 minutos por aba.
--   6. plt_cards sai da publicação do Realtime: ninguém mais escuta a tabela
--      inteira (a consulta que mais consumia o banco — 262 mil leituras).
-- Nada nas tabelas da integração.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A bolinha: as execuções abertas da pessoa, pela posição do card
-- ----------------------------------------------------------------------------
-- O último "marco" de cada card (o mesmo critério de plt_vw_execucoes: início e
-- fim de execução não estornados, criação e movimentações) — se ele é um início
-- da própria pessoa, a execução dela está aberta. Os candidatos são só os cards
-- em que ela é a executora projetada (índice plt_cards_executor_idx).
create or replace function public.plt_fn_minhas_execucoes()
returns table (evento_inicio_id bigint, card_id bigint, usuario_inicio_id uuid, iniciou_em timestamptz)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select m.id, c.id, m.usuario_id, m.ocorrido_em
    from public.plt_cards c
    cross join lateral (
      select e.id, e.tipo, e.usuario_id, e.ocorrido_em
        from public.plt_eventos e
       where e.card_id = c.id
         and (e.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa')
              or (e.tipo in ('execucao_iniciada', 'execucao_finalizada')
                  and not exists (select 1 from public.plt_eventos x
                                   where x.tipo = 'estorno' and x.evento_referencia_id = e.id)))
       order by e.ocorrido_em desc, e.id desc
       limit 1
    ) m
   where c.executor_atual_id = (select plt_privado.fn_usuario_atual())
     and c.concluido_em is null
     and m.tipo = 'execucao_iniciada'
     and m.usuario_id = c.executor_atual_id
   order by m.ocorrido_em, m.id;
$$;

comment on function public.plt_fn_minhas_execucoes() is
  'SESSAO-32 (Lei §7.1): as execuções abertas de quem chama — o mesmo conjunto de plt_vw_execucoes (em_andamento, usuario_inicio_id = eu), lido pela posição projetada no card em vez de recalcular o histórico inteiro. A bolinha e a abertura usam.';

-- ----------------------------------------------------------------------------
-- 2 · A Visão do dia numa chamada (as 7 portas de sempre)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_visao_do_dia()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v jsonb := jsonb_build_object('lido_em', now());
begin
  -- Cada parte como a tela lia antes, uma porta por vez: a que recusar (gate)
  -- volta vazia e não derruba as outras — o mesmo efeito das 7 chamadas soltas.
  begin
    v := v || jsonb_build_object('agora', coalesce((select jsonb_agg(to_jsonb(x)) from public.plt_fn_dash_agora() x), '[]'::jsonb));
  exception when others then v := v || jsonb_build_object('agora', '[]'::jsonb); end;
  begin
    v := v || jsonb_build_object('pcp_dia', (select to_jsonb(x) from public.plt_fn_dash_pcp_dia() x limit 1));
  exception when others then v := v || jsonb_build_object('pcp_dia', null); end;
  begin
    v := v || jsonb_build_object('dia', (select to_jsonb(x) from public.plt_fn_dash_dia() x limit 1));
  exception when others then v := v || jsonb_build_object('dia', null); end;
  begin
    v := v || jsonb_build_object('producao_hora', coalesce((select jsonb_agg(to_jsonb(x)) from public.plt_fn_dash_producao_hora() x), '[]'::jsonb));
  exception when others then v := v || jsonb_build_object('producao_hora', '[]'::jsonb); end;
  begin
    v := v || jsonb_build_object('fim_de_linha', coalesce((select jsonb_agg(to_jsonb(x)) from public.plt_fn_dash_fim_de_linha() x), '[]'::jsonb));
  exception when others then v := v || jsonb_build_object('fim_de_linha', '[]'::jsonb); end;
  begin
    v := v || jsonb_build_object('danificados_dia', coalesce((select jsonb_agg(to_jsonb(x)) from public.plt_fn_dash_danificados_dia() x), '[]'::jsonb));
  exception when others then v := v || jsonb_build_object('danificados_dia', '[]'::jsonb); end;
  begin
    v := v || jsonb_build_object('estoque', (select to_jsonb(x) from public.plt_fn_dash_estoque() x limit 1));
  exception when others then v := v || jsonb_build_object('estoque', null); end;
  return v;
end;
$$;

comment on function public.plt_fn_dash_visao_do_dia() is
  'SESSAO-32 (Lei §2): a Visão do dia numa requisição — as 7 portas plt_fn_dash_* juntas (gate de cada uma intacto) + lido_em (a tela soma o tempo passado à espera, sem reler). Ao vivo pelo aviso plt-aviso:painel.';

-- ----------------------------------------------------------------------------
-- 3 · A porta de abertura
-- ----------------------------------------------------------------------------
-- "Visto agora" (a presença — D-34): carimbo no gesto, nunca relógio.
create or replace function plt_privado.fn_carimbar_presenca(p_usuario uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.plt_presencas (usuario_id, visto_em)
    select p_usuario, now() where p_usuario is not null
  on conflict (usuario_id) do update set visto_em = excluded.visto_em;
$$;

create or replace function public.plt_fn_abertura(p_rota text default null, p_meu_painel boolean default false)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id      uuid;
  v_perfil  jsonb;
  v_setores bigint[];
  v_ret     jsonb;
begin
  select u.id,
         jsonb_build_object(
           'id', u.id, 'nome', u.nome, 'usuario', u.usuario, 'email', u.email, 'telefone', u.telefone,
           'matricula', u.matricula, 'papel', u.papel, 'senha_padrao', u.senha_padrao, 'ativo', u.ativo,
           'arquivado_em', u.arquivado_em, 'tema', u.tema, 'foto_caminho', u.foto_caminho,
           'modulos', u.modulos, 'super_admin', u.super_admin)
    into v_id, v_perfil
    from public.plt_usuarios u
   where u.auth_user_id = auth.uid() and u.ativo
   limit 1;

  -- O instante da leitura: o canal pessoal entra pedindo a reprise desde aqui
  -- (nada que saia entre ler e ouvir se perde).
  v_ret := jsonb_build_object('agora_ms', floor(extract(epoch from clock_timestamp()) * 1000)::bigint);
  if v_id is null then
    return v_ret || jsonb_build_object('perfil', null, 'vinculos', '[]'::jsonb);
  end if;

  if p_rota is not null and length(p_rota) > 300 then
    p_rota := left(p_rota, 300);
  end if;

  select coalesce(array_agg(us.setor_id order by us.setor_id), '{}') into v_setores
    from public.plt_usuario_setores us where us.usuario_id = v_id;

  v_ret := v_ret || jsonb_build_object(
    'perfil', v_perfil,
    'vinculos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'setor_id', us.setor_id, 'lider_do_setor', us.lider_do_setor,
               'setor', case when s.id is null then null
                             else jsonb_build_object('id', s.id, 'nome', s.nome, 'codigo', s.codigo) end)
             order by us.setor_id)
        from public.plt_usuario_setores us
        left join public.plt_setores s on s.id = us.setor_id
       where us.usuario_id = v_id), '[]'::jsonb),
    'setores', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'codigo', s.codigo, 'nome', s.nome, 'papel_no_fluxo', s.papel_no_fluxo,
               'ordem', s.ordem, 'ativo', s.ativo, 'limite_execucoes_por_pessoa', s.limite_execucoes_por_pessoa,
               'modo_delegacao', s.modo_delegacao, 'qualidade_envio_tipos', s.qualidade_envio_tipos,
               'qualidade_recebimento_tipos', s.qualidade_recebimento_tipos)
             order by s.ordem, s.id)
        from public.plt_setores s where s.ativo), '[]'::jsonb),
    'avisos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'tipo', a.tipo, 'titulo', a.titulo, 'corpo', a.corpo, 'card_id', a.card_id,
               'lida_em', a.lida_em, 'criada_em', a.criada_em)
             order by a.criada_em desc, a.id desc)
        from (select n.id, n.tipo, n.titulo, n.corpo, n.card_id, n.lida_em, n.criada_em
                from public.plt_notificacoes n
               where n.destinatario_id = v_id
               order by n.criada_em desc, n.id desc limit 20) a), '[]'::jsonb),
    'conversas', coalesce((
      select jsonb_agg(to_jsonb(c) - 'ordinality' order by c.ordinality)
        from public.plt_fn_chat_conversas(null::timestamptz, null::bigint, 5, null::bigint) with ordinality as c), '[]'::jsonb),
    'tarefas', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.criada_em, t.id)
        from (select tt.id, tt.titulo, tt.descricao, tt.card_id, tt.setor_id, tt.responsavel_id, tt.criada_por_id,
                     tt.delegacao, tt.situacao, tt.prazo, tt.iniciada_em, tt.concluida_em, tt.criada_em,
                     tt.tarefa_mae_id, tt.origem, tt.evento_referencia_id, tt.privada, tt.tempo_acumulado
                from public.plt_tarefas tt
               where tt.responsavel_id = v_id and tt.situacao <> 'concluida' and tt.tarefa_mae_id is null) t), '[]'::jsonb),
    'execucoes', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.iniciou_em, x.evento_inicio_id)
        from public.plt_fn_minhas_execucoes() x), '[]'::jsonb));

  if p_meu_painel then
    v_ret := v_ret || jsonb_build_object('meu_painel', jsonb_build_object(
      'cards', coalesce((
        select jsonb_agg(to_jsonb(c) order by c.desde nulls last, c.id)
          from (select cc.id, cc.tipo, cc.pedido_id, cc.card_pai_id, cc.item_seq, cc.item_codigo, cc.item_descricao,
                       cc.indice_unidade, cc.total_unidades, cc.setor_atual_id, cc.etapa_atual_id, cc.desde,
                       cc.executor_atual_id, cc.responsavel_id, cc.delegado_em, cc.qualidade_atual, cc.concluido_em,
                       cc.pausado_em, cc.liberado_completo_em, cc.produto_tiny_id, cc.etiquetas, cc.parecer_pendente_id
                  from public.plt_cards cc
                 where cc.responsavel_id = v_id and cc.concluido_em is null and cc.arquivado_em is null) c), '[]'::jsonb),
      'setores_chave', array_to_string(v_setores, ','),
      'tarefas_sistema', case when cardinality(v_setores) = 0 then '[]'::jsonb else coalesce((
        select jsonb_agg(to_jsonb(t) order by t.criada_em, t.id)
          from (select tt.id, tt.titulo, tt.descricao, tt.card_id, tt.setor_id, tt.responsavel_id, tt.criada_por_id,
                       tt.delegacao, tt.situacao, tt.prazo, tt.iniciada_em, tt.concluida_em, tt.criada_em,
                       tt.tarefa_mae_id, tt.origem, tt.evento_referencia_id, tt.privada, tt.tempo_acumulado
                  from public.plt_tarefas tt
                 where tt.origem = 'sistema' and tt.setor_id = any (v_setores) and tt.situacao <> 'concluida') t), '[]'::jsonb) end,
      'fila_prioridade', coalesce((select u.fila_prioridade from public.plt_usuarios u where u.id = v_id), '[]'::jsonb),
      'metas', coalesce((
        select jsonb_agg(to_jsonb(m) - 'ordinality' order by m.ordinality)
          from public.plt_fn_metas_painel(false, 20, 0) with ordinality as m), '[]'::jsonb)));
  end if;

  -- O gesto de abrir: o registro da navegação da 1ª rota (que já carimba a
  -- presença) — o que a casca gravava em duas requisições a mais.
  if p_rota is not null and length(btrim(p_rota)) > 0 then
    perform public.plt_fn_registrar_log('navegacao', p_rota, '{}'::jsonb);
  else
    perform plt_privado.fn_carimbar_presenca(v_id);
  end if;

  return v_ret;
end;
$$;

comment on function public.plt_fn_abertura(text, boolean) is
  'SESSAO-32 (Lei §2): a primeira abertura do app numa requisição — perfil, vínculos, setores, os 20 avisos do sino, a 1ª página do chat, a bolinha e (p_meu_painel) os dados do Meu Painel; carimba a presença e registra a navegação da 1ª rota. Security invoker: vê o que as consultas soltas de antes viam (RLS). agora_ms = de quando pedir a reprise do canal pessoal.';

-- ----------------------------------------------------------------------------
-- 4 · Avisos ao vivo
-- ----------------------------------------------------------------------------
-- Quem ouve (recriada POR INTEIRO a partir da migration 70): + painel,
-- danificados e as listas do Comercial.
create or replace function plt_privado.fn_aviso_pode_ouvir(p_topico text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
           when p_topico in ('plt-aviso:estoque', 'plt-aviso:aguardo', 'plt-aviso:pcp')
             then plt_privado.fn_pode_ver_expedicao()
           when p_topico = 'plt-aviso:rotas'
             then plt_privado.fn_pode_ver_expedicao()
               or plt_privado.fn_eh_entregador(plt_privado.fn_usuario_atual())
           -- SESSAO-31 (Lei §4): o quadro de um setor — quem vê aquele quadro.
           when p_topico ~ '^plt-aviso:setor_[0-9]{1,18}$'
             then plt_privado.fn_pode_ver_quadro(substring(p_topico from '^plt-aviso:setor_([0-9]+)$')::bigint)
           -- SESSAO-32: o "mudou" dos painéis não leva dado — quem está logado ouve.
           when p_topico = 'plt-aviso:painel'
             then plt_privado.fn_usuario_atual() is not null
           when p_topico = 'plt-aviso:danificados'
             then plt_privado.fn_pode_ver_expedicao()
           when p_topico ~ '^plt-aviso:lista_[0-9a-f]{32}$'
             then plt_privado.fn_tem_modulo('comercial')
           else false
         end;
$$;

-- O sinal da PESSOA (no canal dela — o mesmo do chat e do sino): uma vez por
-- transação por pessoa; sem dado (a tela relê só o que é dela).
create or replace function plt_privado.fn_avisar_pessoa(p_usuario uuid, p_evento text default 'meu_trabalho')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_marca text;
begin
  if p_usuario is null then
    return;
  end if;
  v_marca := 'plt.avisado_p_' || replace(p_usuario::text, '-', '') || '_' || p_evento;
  if coalesce(current_setting(v_marca, true), '') = 'on' then
    return;
  end if;
  perform set_config(v_marca, 'on', true);
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    perform realtime.send('{}'::jsonb, p_evento, 'plt-chat-u:' || p_usuario::text, true);
  end if;
end;
$$;

-- Um evento com nome próprio num tópico de área (uma vez por transação).
create or replace function plt_privado.fn_avisar_evento(p_area text, p_evento text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_marca text := 'plt.avisado_' || p_area || '_' || p_evento;
begin
  if coalesce(current_setting(v_marca, true), '') = 'on' then
    return;
  end if;
  perform set_config(v_marca, 'on', true);
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    perform realtime.send(jsonb_build_object('area', p_area), p_evento, 'plt-aviso:' || p_area, true);
  end if;
end;
$$;

-- Os fatos dizem o que mudou (recriada POR INTEIRO a partir da migration 70):
-- + o painel (todo fato), os danificados, e a presença de quem fez.
create or replace function plt_privado.fn_avisar_eventos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_areas   text[];
  v_area    text;
  v_setores bigint[];
  v_setor   bigint;
begin
  select array_agg(distinct a) into v_areas
    from (
      select case s.codigo
               when 'aguardo' then 'aguardo'
               when 'rotas'   then 'rotas'
               when 'pcp'     then 'pcp'
             end as a
        from novos n
        left join public.plt_cards c on c.id = n.card_id
        join public.plt_setores s on s.id in (n.setor_origem_id, n.setor_destino_id, c.setor_atual_id)
      union all
      select 'pcp' from novos n join public.plt_cards c on c.id = n.card_id where c.tipo in ('pedido', 'reposicao')
      union all
      select 'aguardo' from novos n where n.tipo in ('pedido_lancado_rotas', 'peca_alocada', 'unidade_desvinculada')
      union all
      select 'rotas' from novos n
       where n.tipo in ('pedido_lancado_rotas', 'pedido_entregue', 'entrega_desfeita', 'entrega_nao_realizada',
                        'pedido_devolvido', 'comentario_adicionado', 'anexo_adicionado', 'pedido_cancelado')
      -- SESSAO-31: o avulso mexe no PCP (a aba Lançamento manual).
      union all
      select 'pcp' from novos n join public.plt_cards c on c.id = n.card_id where c.tipo = 'avulso'
      -- SESSAO-32: a peça foi para / saiu de DANIFICADO (ou mexeram nela lá).
      union all
      select 'danificados' from novos n
        left join public.plt_cards c on c.id = n.card_id
        join public.plt_etapas et on et.id in (n.etapa_origem_id, n.etapa_destino_id, c.etapa_atual_id)
       where et.eh_danificado
      -- SESSAO-32: todo fato de card mexe nos painéis (Visão do dia, metas).
      union all
      select 'painel' from novos n where n.card_id is not null
    ) x
   where a is not null;
  if v_areas is not null then
    foreach v_area in array v_areas loop
      perform plt_privado.fn_avisar(v_area);
    end loop;
  end if;

  -- SESSAO-31 (Lei §4): o quadro de cada setor de produção tocado.
  select array_agg(distinct s.id) into v_setores
    from novos n
    left join public.plt_cards c on c.id = n.card_id
    join public.plt_setores s on s.id in (n.setor_origem_id, n.setor_destino_id, c.setor_atual_id)
                              and s.papel_no_fluxo = 'producao';
  if v_setores is not null then
    foreach v_setor in array v_setores loop
      perform plt_privado.fn_avisar('setor_' || v_setor);
    end loop;
  end if;

  -- SESSAO-32 (Lei §4): a presença pelo gesto — quem fez o fato foi visto agora.
  insert into public.plt_presencas (usuario_id, visto_em)
    select distinct n.usuario_id, now() from novos n
     where n.usuario_id is not null
       and exists (select 1 from public.plt_usuarios u where u.id = n.usuario_id)
  on conflict (usuario_id) do update set visto_em = excluded.visto_em;
  return null;
end;
$$;

-- O card de uma pessoa mudou (é a responsável ou a executora — antes ou
-- depois): o sinal dela. Só quando muda o que as telas dela mostram.
create or replace function plt_privado.fn_avisar_cards_pessoas()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform plt_privado.fn_avisar_pessoa(new.responsavel_id);
    perform plt_privado.fn_avisar_pessoa(new.executor_atual_id);
  else
    perform plt_privado.fn_avisar_pessoa(new.responsavel_id);
    perform plt_privado.fn_avisar_pessoa(new.executor_atual_id);
    if old.responsavel_id is distinct from new.responsavel_id then
      perform plt_privado.fn_avisar_pessoa(old.responsavel_id);
    end if;
    if old.executor_atual_id is distinct from new.executor_atual_id then
      perform plt_privado.fn_avisar_pessoa(old.executor_atual_id);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists plt_cards_avisar_pessoas_ins on public.plt_cards;
create trigger plt_cards_avisar_pessoas_ins
  after insert on public.plt_cards
  for each row
  when (new.responsavel_id is not null or new.executor_atual_id is not null)
  execute function plt_privado.fn_avisar_cards_pessoas();

drop trigger if exists plt_cards_avisar_pessoas_upd on public.plt_cards;
create trigger plt_cards_avisar_pessoas_upd
  after update on public.plt_cards
  for each row
  when (old.responsavel_id is distinct from new.responsavel_id
        or old.executor_atual_id is distinct from new.executor_atual_id
        or ((new.responsavel_id is not null or new.executor_atual_id is not null)
            and (old.pausado_em is distinct from new.pausado_em
                 or old.setor_atual_id is distinct from new.setor_atual_id
                 or old.etapa_atual_id is distinct from new.etapa_atual_id
                 or old.concluido_em is distinct from new.concluido_em
                 or old.arquivado_em is distinct from new.arquivado_em
                 or old.desde is distinct from new.desde)))
  execute function plt_privado.fn_avisar_cards_pessoas();

-- As tarefas: o sinal da responsável (antes e depois) e o das tarefas do setor.
create or replace function plt_privado.fn_avisar_tarefas()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform plt_privado.fn_avisar_pessoa(old.responsavel_id);
    if old.setor_id is not null then
      perform plt_privado.fn_avisar_evento('setor_' || old.setor_id, 'tarefas');
    end if;
    return null;
  end if;
  perform plt_privado.fn_avisar_pessoa(new.responsavel_id);
  if new.setor_id is not null then
    perform plt_privado.fn_avisar_evento('setor_' || new.setor_id, 'tarefas');
  end if;
  if tg_op = 'UPDATE' then
    if old.responsavel_id is distinct from new.responsavel_id then
      perform plt_privado.fn_avisar_pessoa(old.responsavel_id);
    end if;
    if old.setor_id is not null and old.setor_id is distinct from new.setor_id then
      perform plt_privado.fn_avisar_evento('setor_' || old.setor_id, 'tarefas');
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists plt_tarefas_avisar on public.plt_tarefas;
create trigger plt_tarefas_avisar
  after insert or update or delete on public.plt_tarefas
  for each row execute function plt_privado.fn_avisar_tarefas();

-- A fila do Tiny (Configurações → Estoque): evento próprio no tópico do
-- estoque — as telas do estoque só ouvem 'mudou' e não releem por causa disto.
create or replace function plt_privado.fn_avisar_fila_tiny()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform plt_privado.fn_avisar_evento('estoque', 'tiny');
  return null;
end;
$$;

drop trigger if exists plt_tiny_estoque_fila_avisar on public.plt_tiny_estoque_fila;
create trigger plt_tiny_estoque_fila_avisar
  after insert or update or delete on public.plt_tiny_estoque_fila
  for each statement execute function plt_privado.fn_avisar_fila_tiny();

-- O andamento de uma lista do Comercial (o disparo atualiza os membros).
create or replace function plt_privado.fn_avisar_lista_disparo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lista text;
begin
  if tg_table_name = 'listas_disparo' then
    v_lista := new.id::text;                 -- o gatilho da lista é só de UPDATE
  elsif tg_op = 'DELETE' then
    v_lista := old.lista_id::text;
  else
    v_lista := new.lista_id::text;
  end if;
  if v_lista is not null then
    perform plt_privado.fn_avisar('lista_' || replace(v_lista, '-', ''));
  end if;
  return null;
end;
$$;

drop trigger if exists listas_disparo_membros_avisar on public.listas_disparo_membros;
create trigger listas_disparo_membros_avisar
  after insert or update or delete on public.listas_disparo_membros
  for each row execute function plt_privado.fn_avisar_lista_disparo();

drop trigger if exists listas_disparo_avisar on public.listas_disparo;
create trigger listas_disparo_avisar
  after update on public.listas_disparo
  for each row execute function plt_privado.fn_avisar_lista_disparo();

-- ----------------------------------------------------------------------------
-- 5 · Presença pela navegação (recriada POR INTEIRO a partir da migration 22)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_registrar_log(p_acao text, p_rota text default null, p_contexto jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := plt_privado.fn_usuario_atual();
begin
  if v_usuario is null then
    raise exception 'Sessão sem cadastro ativo na plataforma — nada foi registrado.';
  end if;
  if p_acao is null or length(trim(p_acao)) = 0 or length(p_acao) > 80 then
    raise exception 'Informe a ação do registro (até 80 caracteres).';
  end if;
  if p_rota is not null and length(p_rota) > 300 then
    raise exception 'Rota longa demais para o registro.';
  end if;
  if pg_column_size(coalesce(p_contexto, '{}'::jsonb)) > 8192 then
    raise exception 'Contexto grande demais para o registro.';
  end if;

  insert into public.plt_logs_atividade (usuario_id, acao, rota, contexto)
  values (v_usuario, trim(p_acao), p_rota, coalesce(p_contexto, '{}'::jsonb));

  -- SESSAO-32 (Lei §4): a navegação é um gesto — "visto agora" sem relógio.
  insert into public.plt_presencas (usuario_id, visto_em) values (v_usuario, now())
    on conflict (usuario_id) do update set visto_em = excluded.visto_em;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6 · Ninguém mais escuta a tabela de cards inteira
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plt_cards') then
    alter publication supabase_realtime drop table public.plt_cards;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7 · Quem chama o quê
-- ----------------------------------------------------------------------------
revoke all on function public.plt_fn_minhas_execucoes()             from public, anon;
revoke all on function public.plt_fn_dash_visao_do_dia()            from public, anon;
revoke all on function public.plt_fn_abertura(text, boolean)        from public, anon;
grant execute on function public.plt_fn_minhas_execucoes()          to authenticated;
grant execute on function public.plt_fn_dash_visao_do_dia()         to authenticated;
grant execute on function public.plt_fn_abertura(text, boolean)     to authenticated;

revoke all on function plt_privado.fn_carimbar_presenca(uuid)       from public, anon, authenticated;
revoke all on function plt_privado.fn_avisar_pessoa(uuid, text)     from public, anon, authenticated;
revoke all on function plt_privado.fn_avisar_evento(text, text)     from public, anon, authenticated;
revoke all on function plt_privado.fn_avisar_cards_pessoas()        from public, anon, authenticated;
revoke all on function plt_privado.fn_avisar_tarefas()              from public, anon, authenticated;
revoke all on function plt_privado.fn_avisar_fila_tiny()            from public, anon, authenticated;
revoke all on function plt_privado.fn_avisar_lista_disparo()        from public, anon, authenticated;
