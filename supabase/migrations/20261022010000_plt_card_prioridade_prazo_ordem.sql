-- ============================================================================
-- SESSAO-38 · frente dos cards (D-150…D-155) — o card de produção ganha
-- PRAZO, PRIORIDADE, RESPONSÁVEIS POR SETOR e a ORDEM DA FILA no servidor.
--
-- Pedido do dono (21/10/2026), traduzido:
--   1. Todo card de pedido mostra a data de entrega que o vendedor pôs no
--      Tiny (pedidos.data_prevista), LIDA AO VIVO — nada copiado para o card.
--   2. A janela do card: Início = a data do pedido no Tiny (data_pedido);
--      Vencimento = a data de entrega; a PRIORIDADE deixa de ser etiqueta e
--      vira propriedade própria (urgente · atenção · comum); os RESPONSÁVEIS
--      saem da história (quem pegou o card em cada setor — o evento é a
--      tabela-mãe, M-02) e o líder/admin define o responsável dos PRÓXIMOS
--      setores (o que já foi executado é só leitura).
--   4. A ordem da fila (entrega · prioridade · alfabética) em TODOS os quadros
--      e no PCP, no SERVIDOR (as colunas paginam lá — regra 17/18); o urgente
--      vem sempre primeiro.
--
-- O que nasce aqui:
--   · plt_cards.prioridade ('urgente' | 'atencao' | nulo = comum) — projeção
--     do fato novo `prioridade_definida` (só o gatilho escreve — M-13). A
--     prioridade do PEDIDO mora no card do pedido e vale para todas as peças
--     dele, em todos os setores, inclusive as liberadas depois (lida ao vivo
--     pela visão de ordem); a reposição e o avulso têm a própria (D-150).
--   · plt_cards.responsaveis_setor (jsonb {setor_id: [pessoa…]}) — projeção do
--     fato novo `responsavel_setor_definido` (D-152).
--   · plt_privado.vw_card_ordem — as chaves de ordem de cada card (prioridade
--     efetiva, data de entrega, nome normalizado), embutida pelo planejador
--     (E-65: regra por linha mora em visão, não em função com SET).
--   · Portas: plt_fn_card_prioridade, plt_fn_card_responsavel_setor; com
--     p_ordem: plt_fn_quadro_setor, plt_fn_quadro_coluna, plt_fn_pcp_quadro;
--     com p_prioridade: plt_fn_avulso_criar; a janela (plt_fn_card_janela)
--     traz prazo, prioridade e responsáveis por setor.
--   · O quadro do setor deixa de mandar o NOME DO CLIENTE (o card do setor não
--     mostra mais — item 3 do dono; D-28) — a janela e o PCP seguem com ele.
--   · Etiquetas que faziam o papel de prioridade ("PRIORIDADE", "Urgente"…):
--     o card vivo que tinha uma ganha a prioridade nova e a etiqueta é
--     ARQUIVADA (nada se apaga — D-153).
--
-- Compatível com o site publicado: todas as portas antigas continuam
-- respondendo com os mesmos nomes de parâmetro (os novos têm padrão) e as
-- mesmas chaves (só chaves novas). Assinatura nova = drop + create (A-12).
-- Só esta migration valida o check dos tipos de evento (E-19).
-- Nada aqui altera tabela da integração.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · As colunas novas do card (projeções)
-- ----------------------------------------------------------------------------
alter table public.plt_cards add column if not exists prioridade text;
alter table public.plt_cards add column if not exists responsaveis_setor jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plt_cards_prioridade_ck') then
    alter table public.plt_cards add constraint plt_cards_prioridade_ck
      check (prioridade is null or prioridade in ('urgente', 'atencao')) not valid;
  end if;
end;
$$;
alter table public.plt_cards validate constraint plt_cards_prioridade_ck;

comment on column public.plt_cards.prioridade is
  'SESSAO-38 (D-150): a prioridade do card — urgente | atencao | nulo (comum). Projeção do fato prioridade_definida. No card de PEDIDO vale para todas as peças do pedido (lida ao vivo pela visão de ordem); a peça nunca guarda a própria.';
comment on column public.plt_cards.responsaveis_setor is
  'SESSAO-38 (D-152): o responsável definido para cada setor ainda não executado — {"<setor_id>": ["<pessoa>", …]}. Projeção do fato responsavel_setor_definido. Quem pegou o card em cada setor não mora aqui: sai dos fatos de execução e auxílio.';

-- ----------------------------------------------------------------------------
-- 2 · Os tipos de evento (+ prioridade_definida, responsavel_setor_definido)
--     — recriado POR INTEIRO a partir da versão viva (migration da presença e
--     dos auxiliares). E-19: só ESTA valida (o validate saiu daquela).
-- ----------------------------------------------------------------------------
do $$
declare
  v_nome text;
begin
  select conname into v_nome
    from pg_constraint
   where conrelid = 'public.plt_eventos'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%card_criado%';
  if v_nome is not null then
    execute format('alter table public.plt_eventos drop constraint %I', v_nome);
  end if;
  alter table public.plt_eventos add constraint plt_eventos_tipo_check
    check (tipo in (
      'card_criado', 'movimentacao_setor', 'movimentacao_etapa',
      'execucao_iniciada', 'execucao_finalizada', 'execucao_pausada', 'execucao_retomada',
      'qualidade_marcada', 'qualidade_parecer', 'divergencia_registrada', 'notificacao_enviada',
      'delegacao', 'estorno', 'pedido_atualizado', 'pedido_cancelado', 'card_arquivado',
      'pedido_entregue', 'pedido_lancado_rotas', 'unidade_desvinculada', 'peca_alocada',
      'peca_reservada', 'peca_reserva_desfeita', 'estoque_reserva_avaliada',
      'etiqueta_adicionada', 'etiqueta_removida', 'card_desarquivado',
      'entrega_desfeita', 'entrega_nao_realizada',
      'pedido_devolvido',
      'comentario_adicionado', 'anexo_adicionado',
      'devolucao_decidida', 'ajuste_aberto', 'ajuste_concluido',
      'avulso_concluido', 'card_editado',
      'responsavel_adicionado', 'responsavel_removido',
      'anexo_removido', 'comentario_editado', 'comentario_apagado',
      'auxilio_iniciado', 'auxilio_pausado', 'auxilio_retomado', 'auxilio_encerrado',
      -- SESSAO-38 (D-150/D-152): a prioridade do card e o responsável de um setor
      'prioridade_definida', 'responsavel_setor_definido'
    )) not valid;
end;
$$;
-- ↩️ SESSAO-38 (F5, E-19): o validate mudou para a migration do stand-by
-- (20261022050010 — a mais nova do check).

-- ----------------------------------------------------------------------------
-- 3 · As chaves de ordem de cada card (visão — embutida pelo planejador)
-- ----------------------------------------------------------------------------
-- A peça herda a prioridade do PEDIDO (o card do pedido — índice único por
-- pedido) ou, sem pedido, da REPOSIÇÃO que a gerou; o avulso, o pedido e a
-- reposição usam a própria. A data de entrega: a do pedido no Tiny (lida ao
-- vivo); no avulso, o vencimento digitado. O nome: o do produto (peça), o do
-- avulso, sem maiúsculas nem acentos — a classe põe letras, depois números,
-- depois o resto (símbolos, emoji, vazio).
create or replace view plt_privado.vw_card_ordem as
select c.id,
       c.tipo,
       c.setor_atual_id,
       c.etapa_atual_id,
       c.arquivado_em,
       c.desde,
       x.prioridade,
       x.prioridade_herdada,
       x.data_entrega,
       p.numero as pedido_numero,
       case x.prioridade when 'urgente' then 0 when 'atencao' then 1 else 2 end as rank_prioridade,
       case when x.prioridade = 'urgente' then 0 else 1 end as rank_urgente,
       to_char(coalesce(x.data_entrega, date '9999-12-31'), 'YYYYMMDD') as chave_entrega,
       (case when n.nome ~ '^[a-z]' then '0' when n.nome ~ '^[0-9]' then '1' else '2' end) || n.nome as chave_nome
  from public.plt_cards c
  left join public.pedidos p on p.id = c.pedido_id
  left join public.plt_cards pc on c.tipo = 'unidade' and pc.pedido_id = c.pedido_id and pc.tipo = 'pedido'
  left join public.plt_cards rp on c.tipo = 'unidade' and c.pedido_id is null
                               and rp.id = c.card_pai_id and rp.tipo = 'reposicao'
  cross join lateral (
    select case when c.tipo = 'unidade' then coalesce(pc.prioridade, rp.prioridade) else c.prioridade end as prioridade,
           (c.tipo = 'unidade') as prioridade_herdada,
           case when c.tipo = 'avulso' then c.vence_em else p.data_prevista end as data_entrega
  ) x
  cross join lateral (
    select lower(translate(btrim(coalesce(case when c.tipo = 'avulso' then c.titulo else c.item_descricao end, '')),
                           'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
                           'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')) as nome
  ) n;

comment on view plt_privado.vw_card_ordem is
  'SESSAO-38 (D-150/D-151): as chaves de ordem de cada card — prioridade efetiva (a peça herda a do pedido / da reposição), data de entrega (a do pedido no Tiny, ao vivo; no avulso o vencimento), número do pedido e o nome normalizado (letras, depois números, depois o resto). Lida só pelas portas do quadro.';

revoke all on plt_privado.vw_card_ordem from public, anon, authenticated;

-- O modo de ordem que vale (o que não se reconhece vira o padrão: prioridade).
create or replace function plt_privado.fn_ordem_do_quadro(p_ordem text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case when p_ordem in ('entrega', 'alfabetica') then p_ordem else 'prioridade' end;
$$;

-- ----------------------------------------------------------------------------
-- 4 · A prioridade: a guarda, a projeção e o aviso ao vivo
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_card_planejamento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo  text;
  v_papel text;
begin
  if new.tipo not in ('prioridade_definida', 'responsavel_setor_definido') then
    return new;
  end if;
  -- Só pelas portas (quem pode) ou pelas automações.
  if coalesce(current_setting('plt.card_maquinaria', true), '') <> 'on'
     and not plt_privado.fn_evento_do_motor(new.origem, new.dados) then
    raise exception 'Mudar a prioridade e os responsáveis é pela janela do card (quem pode editar).'
      using errcode = 'insufficient_privilege';
  end if;
  select c.tipo into v_tipo from public.plt_cards c where c.id = new.card_id;
  if new.tipo = 'prioridade_definida' then
    if coalesce(new.dados ->> 'depois', '') not in ('urgente', 'atencao', 'comum') then
      raise exception 'A prioridade é urgente, atenção ou comum.' using errcode = 'check_violation';
    end if;
    -- A peça herda do pedido (ou da reposição): a prioridade mora no card de cima.
    if v_tipo not in ('pedido', 'reposicao', 'avulso') then
      raise exception 'A prioridade da peça é a do pedido — mude no pedido.' using errcode = 'check_violation';
    end if;
  else
    if nullif(new.dados ->> 'setor_id', '') is null or nullif(new.dados ->> 'responsavel_id', '') is null then
      raise exception 'Diga o setor e a pessoa.' using errcode = 'check_violation';
    end if;
    select s.papel_no_fluxo into v_papel from public.plt_setores s where s.id = (new.dados ->> 'setor_id')::bigint;
    if coalesce(v_papel, '') <> 'producao' then
      raise exception 'O responsável por setor vale só nos setores de produção.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists plt_eventos_validar_card_planejamento on public.plt_eventos;
create trigger plt_eventos_validar_card_planejamento
  before insert on public.plt_eventos
  for each row
  when (new.tipo in ('prioridade_definida', 'responsavel_setor_definido'))
  execute function plt_privado.fn_validar_card_planejamento();

-- Quem o card mostra (recriada POR INTEIRO a partir da migration do card
-- avulso): + quem foi definido responsável de algum setor também vê o card.
create or replace function plt_privado.fn_participantes_do_card(p_card_id bigint)
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(distinct p) filter (where p is not null), '{}')
    from (
      select c.criado_por_id as p from public.plt_cards c where c.id = p_card_id
      union all
      select unnest(c.responsaveis) from public.plt_cards c where c.id = p_card_id
      union all
      select nullif(m.v, '')::uuid
        from public.plt_eventos e
        cross join lateral jsonb_array_elements_text(coalesce(e.dados -> 'mencoes', '[]'::jsonb)) as m(v)
       where e.card_id = p_card_id and e.tipo = 'comentario_adicionado'
      -- SESSAO-38 (D-152): o responsável definido para um setor
      union all
      select nullif(r.v, '')::uuid
        from public.plt_cards c
        cross join lateral jsonb_each(coalesce(c.responsaveis_setor, '{}'::jsonb)) as s(setor, lista)
        cross join lateral jsonb_array_elements_text(s.lista) as r(v)
       where c.id = p_card_id
    ) x;
$$;

create or replace function plt_privado.fn_projetar_planejamento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card   public.plt_cards%rowtype;
  v_setor  text;
  v_uid    text;
  v_lista  jsonb;
  v_s      bigint;
begin
  select * into v_card from public.plt_cards where id = new.card_id;

  if new.tipo = 'prioridade_definida' then
    update public.plt_cards
       set prioridade = nullif(new.dados ->> 'depois', 'comum')
     where id = new.card_id;
    -- As peças do pedido (ou da reposição) estão espalhadas pelos setores: o
    -- quadro de cada um fica sabendo (um aviso por setor por transação).
    for v_s in
      select distinct u.setor_atual_id
        from public.plt_cards u
       where u.tipo = 'unidade' and u.arquivado_em is null and u.setor_atual_id is not null
         and ((v_card.tipo = 'pedido' and u.pedido_id = v_card.pedido_id)
              or (v_card.tipo = 'reposicao' and u.card_pai_id = v_card.id and u.pedido_id is null))
    loop
      perform plt_privado.fn_avisar_setor(v_s);
    end loop;

  elsif new.tipo = 'responsavel_setor_definido' then
    v_setor := new.dados ->> 'setor_id';
    v_uid := new.dados ->> 'responsavel_id';
    v_lista := coalesce(v_card.responsaveis_setor -> v_setor, '[]'::jsonb);
    if coalesce((new.dados ->> 'por')::boolean, true) then
      if not v_lista ? v_uid then
        v_lista := v_lista || to_jsonb(v_uid);
      end if;
    else
      v_lista := coalesce((select jsonb_agg(e) from jsonb_array_elements(v_lista) e where e #>> '{}' <> v_uid), '[]'::jsonb);
    end if;
    update public.plt_cards
       set responsaveis_setor = case when jsonb_array_length(v_lista) = 0 then responsaveis_setor - v_setor
                                     else jsonb_set(responsaveis_setor, array[v_setor], v_lista, true) end
     where id = new.card_id;
    update public.plt_cards set participantes = plt_privado.fn_participantes_do_card(new.card_id)
     where id = new.card_id;
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_projetar_planejamento on public.plt_eventos;
create trigger plt_eventos_projetar_planejamento
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('prioridade_definida', 'responsavel_setor_definido'))
  execute function plt_privado.fn_projetar_planejamento();

-- O Tiny mudou o pedido (a data de entrega, por exemplo): o card do pedido
-- recebe o fato e as peças dele, nos setores, mostram a data nova — o quadro
-- de cada setor fica sabendo na hora (a data é lida ao vivo; ninguém copia).
create or replace function plt_privado.fn_avisar_pecas_do_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s bigint;
begin
  for v_s in
    select distinct u.setor_atual_id
      from public.plt_cards c
      join public.plt_cards u on u.pedido_id = c.pedido_id and u.tipo = 'unidade'
     where c.id = new.card_id and c.tipo = 'pedido'
       and u.arquivado_em is null and u.setor_atual_id is not null
  loop
    perform plt_privado.fn_avisar_setor(v_s);
  end loop;
  return null;
exception when others then
  -- o aviso nunca derruba a gravação do Tiny (D-43)
  return null;
end;
$$;

drop trigger if exists plt_eventos_avisar_pecas_do_pedido on public.plt_eventos;
create trigger plt_eventos_avisar_pecas_do_pedido
  after insert on public.plt_eventos
  for each row
  when (new.tipo = 'pedido_atualizado')
  execute function plt_privado.fn_avisar_pecas_do_pedido();

-- ----------------------------------------------------------------------------
-- 5 · As portas da prioridade e do responsável por setor
-- ----------------------------------------------------------------------------
-- Quem muda a prioridade (D-151): o PCP/logística, o líder (do setor onde o
-- card está), o admin — e, no avulso, quem pode editá-lo.
create or replace function plt_privado.fn_pode_priorizar(p_card_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select plt_privado.fn_usuario_atual() is not null
     and (plt_privado.fn_eh_admin()
          or plt_privado.fn_pode_ver_expedicao()
          or plt_privado.fn_pode_editar_card(p_card_id));
$$;

create or replace function public.plt_fn_card_prioridade(p_card_id bigint, p_prioridade text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_card  public.plt_cards%rowtype;
  v_alvo  public.plt_cards%rowtype;
  v_nova  text := lower(btrim(coalesce(p_prioridade, 'comum')));
  v_antes text;
  v_marca text;
begin
  if v_nova = 'normal' then v_nova := 'comum'; end if;
  if v_nova not in ('urgente', 'atencao', 'comum') then
    raise exception 'A prioridade é urgente, atenção ou comum.' using errcode = 'check_violation';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found or v_card.arquivado_em is not null then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if not plt_privado.fn_pode_priorizar(p_card_id) then
    raise exception 'Mudar a prioridade é do PCP, da liderança e do admin.' using errcode = 'insufficient_privilege';
  end if;
  -- A peça não guarda prioridade: ela é do pedido (ou da reposição que a gerou).
  if v_card.tipo = 'unidade' then
    if v_card.pedido_id is not null then
      select * into v_alvo from public.plt_cards where pedido_id = v_card.pedido_id and tipo = 'pedido';
    else
      select * into v_alvo from public.plt_cards where id = v_card.card_pai_id and tipo = 'reposicao';
    end if;
    if v_alvo.id is null then
      raise exception 'Esta peça não tem um pedido nem uma reposição para dar a prioridade.' using errcode = 'check_violation';
    end if;
  else
    v_alvo := v_card;
  end if;
  v_antes := coalesce(v_alvo.prioridade, 'comum');
  -- O mesmo toque duas vezes = um efeito só (Lei §10).
  if v_antes = v_nova then
    return jsonb_build_object('card_id', v_alvo.id, 'prioridade', v_nova, 'mudou', false,
                              'do_pedido', v_alvo.tipo = 'pedido' and v_card.tipo = 'unidade');
  end if;
  v_marca := current_setting('plt.card_maquinaria', true);
  perform set_config('plt.card_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, dados)
    values (v_alvo.id, 'prioridade_definida', v_eu, 'interface', v_alvo.setor_atual_id,
            jsonb_build_object('antes', v_antes, 'depois', v_nova,
                               'pelo_card', case when v_alvo.id <> v_card.id then v_card.id end));
  perform set_config('plt.card_maquinaria', coalesce(v_marca, ''), true);
  return jsonb_build_object('card_id', v_alvo.id, 'prioridade', v_nova, 'mudou', true,
                            'do_pedido', v_alvo.tipo = 'pedido' and v_card.tipo = 'unidade');
end;
$$;

comment on function public.plt_fn_card_prioridade(bigint, text) is
  'SESSAO-38 (D-150/D-151): urgente | atencao | comum. Na peça, muda a do PEDIDO (vale para todas as peças dele) — ou a da reposição que a gerou. Quem: PCP/logística, líder do setor do card, admin (e quem edita o avulso). O mesmo toque = nenhum fato novo.';

-- Os setores em que o card JÁ foi executado (início ou auxílio não estornado):
-- o passado é só leitura (D-152).
create or replace function plt_privado.fn_setores_executados(p_card_id bigint)
returns bigint[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(distinct coalesce(e.setor_origem_id, e.setor_destino_id)), '{}')
    from public.plt_eventos e
   where e.card_id = p_card_id
     and e.tipo in ('execucao_iniciada', 'auxilio_iniciado')
     and coalesce(e.setor_origem_id, e.setor_destino_id) is not null
     and not exists (select 1 from public.plt_eventos x where x.tipo = 'estorno' and x.evento_referencia_id = e.id);
$$;

create or replace function public.plt_fn_card_responsavel_setor(
  p_card_id bigint, p_setor_id bigint, p_usuario_id uuid, p_por boolean default true)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_card   public.plt_cards%rowtype;
  v_pessoa public.plt_usuarios%rowtype;
  v_setor  public.plt_setores%rowtype;
  v_ja     boolean;
  v_marca  text;
  v_ev     bigint;
  v_nome   text;
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found or v_card.arquivado_em is not null then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if v_card.tipo not in ('unidade', 'avulso') then
    raise exception 'O responsável por setor se define na peça (ou no card avulso), que é quem anda pelos setores.'
      using errcode = 'check_violation';
  end if;
  select * into v_setor from public.plt_setores where id = p_setor_id and ativo and papel_no_fluxo = 'producao';
  if v_setor.id is null then
    raise exception 'Escolha um setor de produção.' using errcode = 'check_violation';
  end if;
  -- Quem define (D-152): admin, PCP/logística, o líder do setor onde o card
  -- está ou o líder do setor escolhido.
  if not (v_eu is not null
          and (plt_privado.fn_eh_admin()
               or plt_privado.fn_pode_ver_expedicao()
               or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))
               or plt_privado.fn_eh_lider_de(p_setor_id))) then
    raise exception 'Definir o responsável de um setor é da liderança, do PCP e do admin.'
      using errcode = 'insufficient_privilege';
  end if;
  -- O que já foi executado ninguém muda.
  if p_setor_id = any (plt_privado.fn_setores_executados(p_card_id)) then
    raise exception 'O card já foi trabalhado em % — quem pegou fica registrado e não se muda.', v_setor.nome
      using errcode = 'check_violation';
  end if;
  select * into v_pessoa from public.plt_usuarios where id = p_usuario_id and ativo;
  if v_pessoa.id is null or v_pessoa.conta_tablet then
    raise exception 'Esta pessoa não está ativa na plataforma.' using errcode = 'check_violation';
  end if;
  if coalesce(p_por, true) and v_pessoa.papel = 'logistica' then
    raise exception 'A logística acompanha a produção só olhando — escolha alguém da produção.'
      using errcode = 'check_violation';
  end if;
  if coalesce(p_por, true) and v_pessoa.papel <> 'admin' and not coalesce(v_pessoa.pode_auxiliar, false)
     and not exists (select 1 from public.plt_usuario_setores us where us.usuario_id = p_usuario_id and us.setor_id = p_setor_id) then
    raise exception '% não trabalha em % e o cadastro não permite ajudar em outros setores.', v_pessoa.nome, v_setor.nome
      using errcode = 'check_violation';
  end if;
  v_ja := coalesce(v_card.responsaveis_setor -> p_setor_id::text, '[]'::jsonb) ? p_usuario_id::text;
  if coalesce(p_por, true) = v_ja then
    return 'ja_estava';
  end if;
  if coalesce(p_por, true) and jsonb_array_length(coalesce(v_card.responsaveis_setor -> p_setor_id::text, '[]'::jsonb)) >= 5 then
    raise exception 'No máximo 5 responsáveis por setor.' using errcode = 'check_violation';
  end if;
  v_marca := current_setting('plt.card_maquinaria', true);
  perform set_config('plt.card_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, dados)
    values (p_card_id, 'responsavel_setor_definido', v_eu, 'interface', v_card.setor_atual_id,
            jsonb_build_object('setor_id', p_setor_id, 'responsavel_id', p_usuario_id, 'por', coalesce(p_por, true)))
    returning id into v_ev;
  perform set_config('plt.card_maquinaria', coalesce(v_marca, ''), true);
  if coalesce(p_por, true) and p_usuario_id <> v_eu then
    select u.nome into v_nome from public.plt_usuarios u where u.id = v_eu;
    insert into public.plt_notificacoes (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
      values (p_usuario_id, v_ev, p_card_id, 'card_responsavel',
              'Você é o responsável pelo card "' || left(plt_privado.fn_card_rotulo(p_card_id), 70) || '" em ' || v_setor.nome,
              coalesce(v_nome, 'Alguém') || ' pôs você como responsável quando o card chegar a ' || v_setor.nome || '.');
  end if;
  return case when coalesce(p_por, true) then 'posto' else 'tirado' end;
end;
$$;

comment on function public.plt_fn_card_responsavel_setor(bigint, bigint, uuid, boolean) is
  'SESSAO-38 (D-152): define (ou tira) o responsável da peça/avulso num setor de produção AINDA NÃO executado — quem pegou o card em cada setor sai da história e não se muda. Quem: admin, PCP/logística, líder do setor do card ou do setor escolhido. Avisa a pessoa no sino.';

-- ----------------------------------------------------------------------------
-- 6 · O quadro do setor: a página por ordem e o card com prazo e prioridade
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_quadro_cards(p_ids bigint[])
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'tipo', c.tipo, 'pedido_id', c.pedido_id, 'card_pai_id', c.card_pai_id,
           'item_seq', c.item_seq, 'item_codigo', c.item_codigo, 'item_descricao', c.item_descricao,
           'indice_unidade', c.indice_unidade, 'total_unidades', c.total_unidades,
           'setor_atual_id', c.setor_atual_id, 'etapa_atual_id', c.etapa_atual_id, 'desde', c.desde,
           'executor_atual_id', c.executor_atual_id, 'responsavel_id', c.responsavel_id,
           'delegado_em', c.delegado_em, 'qualidade_atual', c.qualidade_atual, 'concluido_em', c.concluido_em,
           'pausado_em', c.pausado_em, 'liberado_completo_em', c.liberado_completo_em,
           'produto_tiny_id', c.produto_tiny_id, 'etiquetas', c.etiquetas,
           'parecer_pendente_id', c.parecer_pendente_id,
           -- SESSAO-31: a frente do card (D-125 / §2)
           'titulo', c.titulo, 'descricao', left(c.descricao, 600),
           'inicio_em', c.inicio_em, 'vence_em', c.vence_em, 'responsaveis', to_jsonb(c.responsaveis),
           'anexos_qtd', c.anexos_qtd, 'mensagens_qtd', c.mensagens_qtd,
           'vinculo_tipo', c.vinculo_tipo, 'vinculo_id', c.vinculo_id,
           'vinculo_rotulo', case when c.vinculo_tipo is null then null
                                  else plt_privado.fn_vinculo_rotulo(c.vinculo_tipo, c.vinculo_id) end,
           'ajuste_destino', c.ajuste_destino, 'criado_por_id', c.criado_por_id,
           'pausa_motivo', c.pausa_motivo,
           'auxiliares', to_jsonb(c.auxiliares),
           -- SESSAO-38 (D-150): a prioridade efetiva (a peça herda a do pedido)
           -- e a data de entrega (a do pedido no Tiny, ao vivo; no avulso, o vencimento)
           'prioridade', v.prioridade,
           'prioridade_herdada', v.prioridade_herdada,
           'data_entrega', v.data_entrega
         ) order by o.ord), '[]'::jsonb)
    from unnest(p_ids) with ordinality as o(id, ord)
    join public.plt_cards c on c.id = o.id
    join plt_privado.vw_card_ordem v on v.id = c.id;
$$;

-- O que vem junto (recriada POR INTEIRO a partir da versão viva — migration da
-- presença e dos auxiliares): o pedido do card do setor NÃO traz mais o nome do
-- cliente (o card do setor não mostra — item 3 do dono, D-28; a janela e o PCP
-- seguem com ele) e traz a data do pedido.
create or replace function plt_privado.fn_quadro_junto(p_ids bigint[])
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'execucoes', coalesce((
      select jsonb_agg(jsonb_build_object('evento_inicio_id', v.evento_inicio_id, 'card_id', v.card_id,
                                          'usuario_inicio_id', v.usuario_inicio_id, 'iniciou_em', v.iniciou_em))
        from public.plt_vw_execucoes v
       where v.card_id = any (p_ids) and v.em_andamento), '[]'::jsonb),
    'auxilios', coalesce((
      select jsonb_agg(jsonb_build_object('card_id', a.card_id, 'usuario_id', a.usuario_id,
                                          'iniciado_em', a.iniciado_em, 'pausado_em', a.pausado_em,
                                          'pausa_motivo', a.pausa_motivo, 'segundos', a.segundos,
                                          'ultimo_inicio', a.ultimo_inicio))
        from public.plt_auxilios a
       where a.card_id = any (p_ids) and a.encerrado_em is null), '[]'::jsonb),
    'pessoas', coalesce((
      select jsonb_object_agg(u.id, jsonb_build_object('nome', u.nome, 'foto', u.foto_caminho))
        from public.plt_usuarios u
       where u.id in (select c.executor_atual_id from public.plt_cards c where c.id = any (p_ids)
                      union select unnest(c.responsaveis) from public.plt_cards c where c.id = any (p_ids)
                      union select unnest(c.auxiliares) from public.plt_cards c where c.id = any (p_ids)
                      union select e.usuario_id from public.plt_cards c join public.plt_eventos e on e.id = c.parecer_pendente_id
                             where c.id = any (p_ids))), '{}'::jsonb),
    'pedidos', coalesce((
      select jsonb_object_agg(p.id, jsonb_build_object(
               'pedido_id', p.id, 'numero', p.numero,
               'situacao', p.situacao, 'data_prevista', p.data_prevista, 'data_pedido', p.data_pedido,
               'entrou_pcp_em', (select min(e.ocorrido_em) from public.plt_eventos e where e.card_id = pc.id and e.tipo = 'card_criado'),
               'liberado_completo_em', pc.liberado_completo_em))
        from public.pedidos p
        left join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
       where p.id in (select c.pedido_id from public.plt_cards c where c.id = any (p_ids) and c.pedido_id is not null)), '{}'::jsonb),
    'valores', coalesce((
      select jsonb_agg(jsonb_build_object('campo_id', v.campo_id, 'card_id', v.card_id, 'valor', v.valor))
        from public.plt_campos_valores v
       where v.card_id = any (p_ids)), '[]'::jsonb)
  );
$$;

-- A página de uma coluna, NA ORDEM PEDIDA, por cursor (o último card mostrado:
-- as chaves dele saem do próprio card). O urgente vem primeiro em todo modo.
--   prioridade: urgente → atenção → comum; depois o mais antigo na etapa
--   entrega:    urgente; depois a data de entrega (sem data no fim), o número
--               do pedido, o mais antigo na etapa
--   alfabetica: urgente; depois letras → números → o resto; o mais antigo
drop function if exists plt_privado.fn_quadro_pagina(bigint, bigint, timestamptz, bigint, integer);
create or replace function plt_privado.fn_quadro_pagina(
  p_setor_id bigint, p_etapa_id bigint, p_corte_desde timestamptz, p_corte_id bigint, p_n integer,
  p_ordem text default null)
returns bigint[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with m as (select plt_privado.fn_ordem_do_quadro(p_ordem) as modo),
  col as (
    select v.id,
           case (select modo from m) when 'prioridade' then v.rank_prioridade else v.rank_urgente end as k1,
           (case (select modo from m) when 'entrega' then v.chave_entrega
                                      when 'alfabetica' then v.chave_nome else '' end) collate "C" as k2,
           case (select modo from m) when 'entrega' then coalesce(v.pedido_numero, 2147483647) else 0 end as k3,
           coalesce(v.desde, 'infinity'::timestamptz) as k4
      from plt_privado.vw_card_ordem v
     where v.setor_atual_id = p_setor_id
       and (case when p_etapa_id is null then v.etapa_atual_id is null else v.etapa_atual_id = p_etapa_id end)
       and v.arquivado_em is null and v.tipo in ('unidade', 'avulso')
  ),
  corte as (
    select case (select modo from m) when 'prioridade' then v.rank_prioridade else v.rank_urgente end as k1,
           (case (select modo from m) when 'entrega' then v.chave_entrega
                                      when 'alfabetica' then v.chave_nome else '' end) collate "C" as k2,
           case (select modo from m) when 'entrega' then coalesce(v.pedido_numero, 2147483647) else 0 end as k3,
           coalesce(v.desde, 'infinity'::timestamptz) as k4,
           v.id
      from plt_privado.vw_card_ordem v
     where coalesce(p_corte_id, 0) > 0 and v.id = p_corte_id
  )
  select coalesce(array_agg(x.id order by x.k1, x.k2, x.k3, x.k4, x.id), '{}')
    from (select c.*
            from col c
           where not exists (select 1 from corte)
              or (c.k1, c.k2, c.k3, c.k4, c.id) > (select k.k1, k.k2, k.k3, k.k4, k.id from corte k)
           order by c.k1, c.k2, c.k3, c.k4, c.id
           limit greatest(coalesce(p_n, 10), 1)) x;
$$;

comment on function plt_privado.fn_quadro_pagina(bigint, bigint, timestamptz, bigint, integer, text) is
  'SESSAO-38 (D-154): uma página de uma coluna na ordem pedida (prioridade · entrega · alfabetica — o urgente sempre primeiro), por cursor: depois do card p_corte_id (as chaves saem dele). p_corte_desde fica por compatibilidade.';

-- A porta do quadro (recriada POR INTEIRO a partir da versão viva — migration
-- da presença e dos auxiliares): + a ordem da fila.
drop function if exists public.plt_fn_quadro_setor(bigint, integer);
create or replace function public.plt_fn_quadro_setor(
  p_setor_id bigint, p_por_coluna integer default 10, p_ordem text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_n       integer := least(greatest(coalesce(p_por_coluna, 10), 1), 50);
  v_ordem   text := plt_privado.fn_ordem_do_quadro(p_ordem);
  v_colunas jsonb := '[]'::jsonb;
  v_ids     bigint[] := '{}';
  v_pagina  bigint[];
  v_total   integer;
  r         record;
begin
  if not plt_privado.fn_pode_ver_quadro(p_setor_id) then
    raise exception 'Você não vê o quadro deste setor.' using errcode = 'insufficient_privilege';
  end if;

  for r in
    select null::bigint as etapa_id, -1 as ordem, 0::bigint as id
    union all
    select e.id, e.ordem, e.id from public.plt_etapas e where e.setor_id = p_setor_id and e.ativa
    order by 2, 3
  loop
    v_pagina := plt_privado.fn_quadro_pagina(p_setor_id, r.etapa_id, null, null, v_n, v_ordem);
    v_total := plt_privado.fn_quadro_total(p_setor_id, r.etapa_id);
    v_colunas := v_colunas || jsonb_build_array(jsonb_build_object(
                   'etapa_id', r.etapa_id, 'total', v_total, 'cards', plt_privado.fn_quadro_cards(v_pagina)));
    v_ids := v_ids || v_pagina;
  end loop;

  return jsonb_build_object(
    'setor_id', p_setor_id,
    'por_coluna', v_n,
    'ordem', v_ordem,
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'setor_id', e.setor_id, 'nome', e.nome, 'ordem', e.ordem,
                                          'eh_fila', e.eh_fila, 'eh_danificado', e.eh_danificado, 'ativa', e.ativa,
                                          'setor_destino_id', e.setor_destino_id, 'conclui_producao', e.conclui_producao,
                                          'pede_motivo', e.pede_motivo)
                       order by e.ordem, e.id)
        from public.plt_etapas e where e.setor_id = p_setor_id and e.ativa), '[]'::jsonb),
    'colunas', v_colunas,
    'etiquetas', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'cor', t.cor,
                                                               'arquivada_em', t.arquivada_em) order by t.nome)
                             from public.plt_etiquetas t), '[]'::jsonb),
    'campos', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'opcoes', f.opcoes,
                                                            'em_pecas', f.em_pecas, 'em_pedidos', f.em_pedidos,
                                                            'em_avulsos', f.em_avulsos, 'arquivado_em', f.arquivado_em)
                                         order by f.nome)
                          from public.plt_campos f), '[]'::jsonb),
    'presencas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'usuario_id', u.id, 'nome', u.nome, 'foto', u.foto_caminho,
               'estado', s.estado, 'desde', s.inicio)
             order by u.nome)
        from public.plt_presenca_segmentos s
        join public.plt_usuarios u on u.id = s.usuario_id
       where s.fim is null and s.setor_id = p_setor_id), '[]'::jsonb)
  ) || plt_privado.fn_quadro_junto(v_ids);
end;
$$;

comment on function public.plt_fn_quadro_setor(bigint, integer, text) is
  'SESSAO-31 (Lei §2/§6) · SESSAO-38 (D-154): o quadro do setor numa requisição, cada coluna na ordem pedida (prioridade · entrega · alfabetica — o urgente sempre primeiro). "Ver mais" = plt_fn_quadro_coluna com a mesma ordem.';

drop function if exists public.plt_fn_quadro_coluna(bigint, bigint, timestamptz, bigint, integer);
create or replace function public.plt_fn_quadro_coluna(
  p_setor_id     bigint,
  p_etapa_id     bigint,
  p_depois_desde timestamptz,
  p_depois_id    bigint,
  p_limite       integer default 10,
  p_ordem        text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_n      integer := least(greatest(coalesce(p_limite, 10), 1), 50);
  v_pagina bigint[];
begin
  if not plt_privado.fn_pode_ver_quadro(p_setor_id) then
    raise exception 'Você não vê o quadro deste setor.' using errcode = 'insufficient_privilege';
  end if;
  v_pagina := plt_privado.fn_quadro_pagina(p_setor_id, p_etapa_id, p_depois_desde, p_depois_id, v_n, p_ordem);
  return jsonb_build_object('etapa_id', p_etapa_id, 'cards', plt_privado.fn_quadro_cards(v_pagina))
         || plt_privado.fn_quadro_junto(v_pagina);
end;
$$;

comment on function public.plt_fn_quadro_coluna(bigint, bigint, timestamptz, bigint, integer, text) is
  'SESSAO-31 (Lei §6) · SESSAO-38 (D-154): o "Ver mais" de uma coluna, por cursor (depois do card p_depois_id), na mesma ordem do quadro.';

-- ----------------------------------------------------------------------------
-- 7 · O quadro do PCP na ordem pedida (o MESMO conjunto de
--     plt_fn_cards_pedido_pcp — a Visão do dia segue lendo aquela; a bateria
--     confere os dois conjuntos) + a prioridade do card
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_pcp_quadro(integer, integer, text);
create or replace function public.plt_fn_pcp_quadro(
  p_limite       integer default 10,
  p_deslocamento integer default 0,
  p_grupo        text    default null,   -- null = tudo | 'pedido' | 'reposicao'
  p_ordem        text    default null    -- prioridade (padrão) | entrega | alfabetica
)
returns table (
  id                   bigint,
  tipo                 text,
  pedido_id            bigint,
  card_pai_id          bigint,
  item_seq             integer,
  item_codigo          text,
  item_descricao       text,
  indice_unidade       integer,
  total_unidades       integer,
  setor_atual_id       bigint,
  etapa_atual_id       bigint,
  desde                timestamptz,
  executor_atual_id    uuid,
  responsavel_id       uuid,
  delegado_em          timestamptz,
  qualidade_atual      text,
  concluido_em         timestamptz,
  pausado_em           timestamptz,
  liberado_completo_em timestamptz,
  pecas_estoque        integer,
  contagem_total       bigint,
  etiquetas            bigint[],
  pedido_resumo        jsonb,
  prioridade           text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with m as (select plt_privado.fn_ordem_do_quadro(p_ordem) as modo),
  base as (
    select c.id, c.desde, c.prioridade, p.numero, p.data_prevista,
           lower(translate(btrim(coalesce(case when c.tipo = 'pedido' then cl.nome else c.item_descricao end, '')),
                           'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
                           'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')) as nome
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
      left join public.pedidos p on p.id = c.pedido_id
      left join public.clientes cl on cl.id = p.cliente_id
     -- o MESMO filtro de plt_fn_cards_pedido_pcp (D-75: painel = quadro)
     where (select plt_privado.fn_usuario_atual()) is not null
       and ((select plt_privado.fn_eh_admin())
            or c.setor_atual_id in (select plt_privado.fn_setores_do_usuario()))
       and c.tipo in ('pedido', 'reposicao')
       and (p_grupo is null or c.tipo = p_grupo)
       and c.arquivado_em is null
       and c.liberado_completo_em is null
       and (c.tipo = 'reposicao'
            or (p.id is not null
                and not plt_privado.fn_tiny_tirou_do_pcp(p.situacao)
                and exists (select 1 from plt_privado.vw_itens_producao v
                             where v.pedido_id = p.id and v.unidades > 0)))
  ),
  chaves as (
    select b.id,
           case (select modo from m)
             when 'prioridade' then case b.prioridade when 'urgente' then 0 when 'atencao' then 1 else 2 end
             else case when b.prioridade = 'urgente' then 0 else 1 end
           end as k1,
           (case (select modo from m)
              when 'entrega' then to_char(coalesce(b.data_prevista, date '9999-12-31'), 'YYYYMMDD')
              when 'alfabetica' then (case when b.nome ~ '^[a-z]' then '0' when b.nome ~ '^[0-9]' then '1' else '2' end) || b.nome
              else '' end) collate "C" as k2,
           case (select modo from m) when 'entrega' then coalesce(b.numero, 2147483647) else 0 end as k3,
           coalesce(b.desde, 'infinity'::timestamptz) as k4,
           count(*) over () as total
      from base b
  ),
  pagina as (
    select k.id, k.total, row_number() over (order by k.k1, k.k2, k.k3, k.k4, k.id) as ord
      from chaves k
     order by k.k1, k.k2, k.k3, k.k4, k.id
     limit least(greatest(coalesce(p_limite, 10), 1), 100)
    offset greatest(coalesce(p_deslocamento, 0), 0)
  ),
  resumos as (
    select r.pedido_id, to_jsonb(r) - 'contagem_total' as resumo
      from public.plt_fn_pedidos_kanban(
             null, false,
             coalesce((select array_agg(distinct c.pedido_id)
                         from pagina pg join public.plt_cards c on c.id = pg.id
                        where c.pedido_id is not null), '{}'),
             100, 0) r
  )
  select c.id, c.tipo, c.pedido_id, c.card_pai_id, c.item_seq, c.item_codigo,
         c.item_descricao, c.indice_unidade, c.total_unidades, c.setor_atual_id,
         c.etapa_atual_id, c.desde, c.executor_atual_id, c.responsavel_id,
         c.delegado_em, c.qualidade_atual, c.concluido_em, c.pausado_em,
         c.liberado_completo_em,
         pe.n as pecas_estoque,
         pg.total as contagem_total,
         coalesce(c.etiquetas, '{}'),
         r.resumo,
         c.prioridade
    from pagina pg
    join public.plt_cards c on c.id = pg.id
    left join resumos r on r.pedido_id = c.pedido_id
    -- as peças do galpão que atendem o pedido (a mesma conta de
    -- plt_fn_cards_pedido_pcp), só para os cards da página
    cross join lateral (
      select case when c.tipo <> 'pedido' then 0 else (
        select count(*)::int
          from public.plt_cards u
          join public.plt_setores se on se.id = u.setor_atual_id and se.codigo = 'estoque'
         where u.tipo = 'unidade' and u.pedido_id is null and u.arquivado_em is null
           and (u.reservada_pedido_id = c.pedido_id
                or (u.reservada_pedido_id is null
                    and u.item_codigo is not null
                    and not plt_privado.fn_eh_personalizado(u.item_descricao)
                    and exists (select 1 from public.pedido_itens pi
                                 where pi.pedido_id = c.pedido_id
                                   and pi.codigo = u.item_codigo
                                   and not plt_privado.fn_eh_personalizado(pi.descricao))))
      ) end as n
    ) pe
   order by pg.ord;
$$;

comment on function public.plt_fn_pcp_quadro(integer, integer, text, text) is
  'SESSAO-32 (Lei §3) · SESSAO-38 (D-154): o quadro do PCP numa leitura, na ordem pedida (prioridade · entrega · alfabetica pelo nome do cliente — o urgente sempre primeiro) — o MESMO conjunto de plt_fn_cards_pedido_pcp; + etiquetas, resumo do pedido e a prioridade do card. Gate: PCP/admin.';

-- ----------------------------------------------------------------------------
-- 8 · Criar o card avulso já com a prioridade (recriada POR INTEIRO a partir
--     da migration do card avulso; assinatura nova = drop + create — A-12)
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_avulso_criar(text, text, date, date, uuid[], bigint[], text, bigint, bigint, uuid);
create or replace function public.plt_fn_avulso_criar(
  p_titulo        text,
  p_descricao     text    default null,
  p_inicio        date    default null,
  p_vence         date    default null,
  p_responsaveis  uuid[]  default null,
  p_etiquetas     bigint[] default null,
  p_vinculo_tipo  text    default null,
  p_vinculo_id    bigint  default null,
  p_setor_id      bigint  default null,
  p_chave         uuid    default null,
  p_prioridade    text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu      uuid := plt_privado.fn_usuario_atual();
  v_pcp     bigint;
  v_card    bigint;
  v_marca   text;
  v_nome    text;
  v_r       uuid;
  v_e       bigint;
  v_titulo  text := btrim(coalesce(p_titulo, ''));
  v_prio    text := lower(btrim(coalesce(p_prioridade, 'comum')));
begin
  if not plt_privado.fn_pode_criar_avulso() then
    raise exception 'Card avulso é criado pelo PCP/logística, pelos líderes e pelo admin.' using errcode = 'insufficient_privilege';
  end if;
  if p_chave is not null then
    select c.id into v_card from public.plt_cards c where c.chave_criacao = p_chave;
    if v_card is not null then
      return jsonb_build_object('card_id', v_card, 'repetido', true);
    end if;
  end if;
  if char_length(v_titulo) = 0 then
    raise exception 'Dê um nome ao card.' using errcode = 'check_violation';
  end if;
  if char_length(v_titulo) > 200 then
    raise exception 'O nome do card tem no máximo 200 letras.' using errcode = 'check_violation';
  end if;
  if char_length(coalesce(p_descricao, '')) > 5000 then
    raise exception 'A descrição tem no máximo 5.000 letras.' using errcode = 'check_violation';
  end if;
  if p_inicio is not null and p_vence is not null and p_inicio > p_vence then
    raise exception 'O início vem antes do vencimento.' using errcode = 'check_violation';
  end if;
  if v_prio = 'normal' then v_prio := 'comum'; end if;
  if v_prio not in ('urgente', 'atencao', 'comum') then
    raise exception 'A prioridade é urgente, atenção ou comum.' using errcode = 'check_violation';
  end if;
  if (p_vinculo_tipo is null) <> (p_vinculo_id is null) or not plt_privado.fn_vinculo_valido(p_vinculo_tipo, p_vinculo_id) then
    raise exception 'O vínculo escolhido não existe — escolha de novo (ou deixe sem vínculo).' using errcode = 'check_violation';
  end if;
  if coalesce(array_length(p_responsaveis, 1), 0) > 10 then
    raise exception 'No máximo 10 responsáveis por card.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from unnest(coalesce(p_responsaveis, '{}'::uuid[])) x
              where not exists (select 1 from public.plt_usuarios u where u.id = x and u.ativo)) then
    raise exception 'Algum responsável escolhido não está ativo na plataforma.' using errcode = 'check_violation';
  end if;
  select s.id into v_pcp from public.plt_setores s where s.papel_no_fluxo = 'entrada' and s.ativo order by s.ordem, s.id limit 1;
  if v_pcp is null then
    raise exception 'O PCP não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  insert into public.plt_cards (tipo, titulo, descricao, inicio_em, vence_em, vinculo_tipo, vinculo_id, chave_criacao)
    values ('avulso', v_titulo, nullif(btrim(coalesce(p_descricao, '')), ''), p_inicio, p_vence,
            p_vinculo_tipo, p_vinculo_id, p_chave)
    returning id into v_card;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id, observacao, dados)
    values (v_card, 'card_criado', v_eu, 'interface', v_pcp, 'Card avulso criado no Lançamento manual.',
            jsonb_build_object('avulso', true, 'titulo', v_titulo,
                               'vinculo', case when p_vinculo_tipo is null then null
                                               else jsonb_build_object('tipo', p_vinculo_tipo, 'id', p_vinculo_id) end));

  v_marca := current_setting('plt.card_maquinaria', true);
  perform set_config('plt.card_maquinaria', 'on', true);
  select u.nome into v_nome from public.plt_usuarios u where u.id = v_eu;
  foreach v_r in array coalesce((select array_agg(distinct x) from unnest(coalesce(p_responsaveis, '{}'::uuid[])) x), '{}'::uuid[]) loop
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, dados)
      values (v_card, 'responsavel_adicionado', v_eu, 'interface', v_pcp, jsonb_build_object('responsavel_id', v_r));
    if v_r <> v_eu then
      insert into public.plt_notificacoes (destinatario_id, card_id, tipo, titulo, corpo)
        values (v_r, v_card, 'card_responsavel', 'Você é responsável pelo card "' || left(v_titulo, 80) || '"',
                coalesce(v_nome, 'Alguém') || ' pôs você como responsável por este card.');
    end if;
  end loop;
  foreach v_e in array coalesce((select array_agg(distinct x) from unnest(coalesce(p_etiquetas, '{}'::bigint[])) x), '{}'::bigint[]) loop
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, dados)
      values (v_card, 'etiqueta_adicionada', v_eu, 'interface', v_pcp, jsonb_build_object('etiqueta_id', v_e));
  end loop;
  -- SESSAO-38 (D-150): a prioridade já na criação
  if v_prio <> 'comum' then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, dados)
      values (v_card, 'prioridade_definida', v_eu, 'interface', v_pcp,
              jsonb_build_object('antes', 'comum', 'depois', v_prio));
  end if;
  perform set_config('plt.card_maquinaria', coalesce(v_marca, ''), true);

  if p_setor_id is not null then
    perform plt_privado.fn_avulso_lancar(v_card, p_setor_id, v_eu);
  end if;
  return jsonb_build_object('card_id', v_card, 'repetido', false);
end;
$$;

comment on function public.plt_fn_avulso_criar(text, text, date, date, uuid[], bigint[], text, bigint, bigint, uuid, text) is
  'SESSAO-31 (D-125) · SESSAO-38 (D-150): cria o card avulso no PCP — só o nome é obrigatório; responsáveis, datas, etiquetas, vínculo, prioridade (urgente | atencao | comum) e, com p_setor_id, já lança. p_chave = o mesmo toque devolve o mesmo card.';

-- ----------------------------------------------------------------------------
-- 9 · A janela do card (recriada POR INTEIRO a partir da versão viva —
--     migration da presença e dos auxiliares): + prazo (do pedido no Tiny ou
--     do card), prioridade e os responsáveis por setor (D-150/D-152).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_card_janela(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card     public.plt_cards%rowtype;
  v_editar   boolean;
  v_pessoas  uuid[];
  v_eu       uuid := plt_privado.fn_usuario_atual();
  v_admin    boolean := plt_privado.fn_eh_admin();
  v_pcp      boolean := plt_privado.fn_pode_ver_expedicao();
  v_ids      bigint[];
  v_feitos   bigint[];
  v_planeja  boolean;
  v_setores  jsonb;
  v_pedido   public.pedidos%rowtype;
  v_prio     record;
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if not plt_privado.fn_pode_anexar(p_card_id) then
    raise exception 'Você não vê este card.' using errcode = 'insufficient_privilege';
  end if;
  v_editar := plt_privado.fn_pode_editar_card(p_card_id);
  select * into v_pedido from public.pedidos where id = v_card.pedido_id;
  select v.prioridade, v.prioridade_herdada into v_prio from plt_privado.vw_card_ordem v where v.id = p_card_id;

  -- Os cards cuja história conta: o próprio; no card do pedido, as peças dele;
  -- na reposição, as peças que ela gerou.
  v_ids := case v_card.tipo
             when 'pedido' then coalesce((select array_agg(u.id) from public.plt_cards u
                                           where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade'), '{}')
             when 'reposicao' then coalesce((select array_agg(u.id) from public.plt_cards u
                                              where u.card_pai_id = v_card.id and u.tipo = 'unidade'), '{}')
             else array[v_card.id]
           end;
  v_feitos := case when v_card.tipo in ('unidade', 'avulso') then plt_privado.fn_setores_executados(p_card_id) else '{}' end;
  -- Definir o responsável dos próximos setores (D-152): admin, PCP/logística,
  -- o líder do setor do card (o líder do setor escolhido também — linha a linha).
  v_planeja := v_card.tipo in ('unidade', 'avulso') and v_card.arquivado_em is null and v_eu is not null;

  with fatos as (
    select coalesce(e.setor_origem_id, e.setor_destino_id) as setor_id, e.tipo, e.usuario_id, min(e.ocorrido_em) as primeiro
      from public.plt_eventos e
     where e.card_id = any (v_ids)
       and e.tipo in ('execucao_iniciada', 'auxilio_iniciado')
       and e.usuario_id is not null
       and not exists (select 1 from public.plt_eventos x where x.tipo = 'estorno' and x.evento_referencia_id = e.id)
     group by 1, 2, 3
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'setor_id', s.id, 'setor_nome', s.nome, 'ordem', s.ordem,
           'executaram', coalesce((select jsonb_agg(f.usuario_id order by f.primeiro)
                                     from fatos f where f.setor_id = s.id and f.tipo = 'execucao_iniciada'), '[]'::jsonb),
           'auxiliaram', coalesce((select jsonb_agg(f.usuario_id order by f.primeiro)
                                     from fatos f where f.setor_id = s.id and f.tipo = 'auxilio_iniciado'
                                      and not exists (select 1 from fatos g where g.setor_id = s.id and g.tipo = 'execucao_iniciada'
                                                       and g.usuario_id = f.usuario_id)), '[]'::jsonb),
           'planejados', coalesce(v_card.responsaveis_setor -> s.id::text, '[]'::jsonb),
           'executado', exists (select 1 from fatos f where f.setor_id = s.id),
           'atual', s.id = v_card.setor_atual_id,
           'pode_planejar', v_planeja and not (s.id = any (v_feitos))
                            and (v_admin or v_pcp
                                 or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))
                                 or plt_privado.fn_eh_lider_de(s.id))
         ) order by s.ordem, s.id), '[]'::jsonb)
    into v_setores
    from public.plt_setores s
   where s.ativo and s.papel_no_fluxo = 'producao';

  v_pessoas := array_remove(v_card.responsaveis || v_card.criado_por_id || v_card.executor_atual_id, null)
               || v_card.auxiliares
               || coalesce((select array_agg(distinct x::uuid)
                              from jsonb_array_elements(v_setores) s
                              cross join lateral jsonb_array_elements_text((s -> 'executaram') || (s -> 'auxiliaram') || (s -> 'planejados')) as t(x)),
                           '{}');

  return jsonb_build_object(
    'card', plt_privado.fn_quadro_cards(array[p_card_id]) -> 0,
    'arquivado_em', v_card.arquivado_em,
    'criado_em', v_card.criado_em,
    'setor', (select jsonb_build_object('id', s.id, 'nome', s.nome, 'codigo', s.codigo, 'papel_no_fluxo', s.papel_no_fluxo)
                from public.plt_setores s where s.id = v_card.setor_atual_id),
    'etapa', (select jsonb_build_object('id', e.id, 'nome', e.nome, 'eh_fila', e.eh_fila)
                from public.plt_etapas e where e.id = v_card.etapa_atual_id),
    'execucao', (select jsonb_build_object('usuario_id', v.usuario_inicio_id, 'iniciou_em', v.iniciou_em)
                   from public.plt_vw_execucoes v where v.card_id = p_card_id and v.em_andamento
                  order by v.iniciou_em desc limit 1),
    'auxilios', coalesce((
      select jsonb_agg(jsonb_build_object('usuario_id', a.usuario_id, 'iniciado_em', a.iniciado_em,
                                          'pausado_em', a.pausado_em, 'pausa_motivo', a.pausa_motivo,
                                          'segundos', a.segundos, 'ultimo_inicio', a.ultimo_inicio)
             order by a.iniciado_em)
        from public.plt_auxilios a
       where a.card_id = p_card_id and a.encerrado_em is null), '[]'::jsonb),
    'pessoas', coalesce((select jsonb_object_agg(u.id, jsonb_build_object('nome', u.nome, 'foto', u.foto_caminho))
                           from public.plt_usuarios u where u.id = any (v_pessoas)), '{}'::jsonb),
    'pedido', case when v_pedido.id is null then null else
                jsonb_build_object('pedido_id', v_pedido.id, 'numero', v_pedido.numero,
                                   'cliente_nome', coalesce((select cl.nome from public.clientes cl where cl.id = v_pedido.cliente_id), ''),
                                   'situacao', v_pedido.situacao, 'data_prevista', v_pedido.data_prevista,
                                   'data_pedido', v_pedido.data_pedido) end,
    -- SESSAO-38 (D-150): o prazo — do pedido no Tiny (início = a data do
    -- pedido, vencimento = a data de entrega do vendedor) ou, sem pedido, o
    -- digitado no card.
    'prazo', case when v_pedido.id is not null
                  then jsonb_build_object('inicio', v_pedido.data_pedido, 'vencimento', v_pedido.data_prevista, 'do_pedido', true)
                  else jsonb_build_object('inicio', v_card.inicio_em, 'vencimento', v_card.vence_em, 'do_pedido', false) end,
    'prioridade', jsonb_build_object('valor', coalesce(v_prio.prioridade, 'comum'),
                                     'do_pedido', coalesce(v_prio.prioridade_herdada, false) and v_card.pedido_id is not null,
                                     'da_reposicao', coalesce(v_prio.prioridade_herdada, false) and v_card.pedido_id is null),
    'responsaveis_por_setor', v_setores,
    'campos', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'opcoes', f.opcoes,
                                          'em_pecas', f.em_pecas, 'em_pedidos', f.em_pedidos, 'em_avulsos', f.em_avulsos,
                                          'arquivado_em', f.arquivado_em,
                                          'valor', (select vv.valor from public.plt_campos_valores vv
                                                     where vv.campo_id = f.id
                                                       and ((v_card.tipo = 'pedido' and vv.pedido_id = v_card.pedido_id)
                                                            or (v_card.tipo <> 'pedido' and vv.card_id = v_card.id))))
                       order by f.nome)
        from public.plt_campos f
       where f.arquivado_em is null
         and case v_card.tipo when 'avulso' then f.em_avulsos
                              when 'pedido' then f.em_pedidos
                              else f.em_pecas end), '[]'::jsonb),
    'etiquetas', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'cor', t.cor,
                                                               'arquivada_em', t.arquivada_em) order by t.nome)
                             from public.plt_etiquetas t), '[]'::jsonb),
    'permissoes', jsonb_build_object(
      'editar', v_editar and v_card.arquivado_em is null,
      'editar_nome', v_editar and v_card.tipo = 'avulso' and v_card.arquivado_em is null,
      'concluir', v_card.tipo = 'avulso' and v_card.arquivado_em is null
                  and (v_editar or v_card.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
                       or v_admin),
      'anexar', v_card.arquivado_em is null,
      'ver_removidos', v_admin,
      'pausar', v_card.executor_atual_id is not null and v_card.pausado_em is null and v_card.arquivado_em is null
                and (v_card.executor_atual_id = v_eu or v_admin
                     or v_eu = any (v_card.auxiliares)
                     or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))),
      'retomar', v_card.pausado_em is not null and v_card.arquivado_em is null
                 and (v_card.executor_atual_id = v_eu or v_admin
                      or (v_card.setor_atual_id is not null and plt_privado.fn_eh_lider_de(v_card.setor_atual_id))),
      'auxiliar', v_card.executor_atual_id is not null and v_card.arquivado_em is null
                  and v_card.concluido_em is null,
      'sair_auxilio', v_eu = any (v_card.auxiliares),
      -- SESSAO-38 (D-151): mudar a prioridade (na peça, muda a do pedido)
      'priorizar', v_card.arquivado_em is null and plt_privado.fn_pode_priorizar(p_card_id)
                   and (v_card.tipo <> 'unidade' or v_card.pedido_id is not null or v_card.card_pai_id is not null),
      -- as datas do card de pedido vêm do Tiny: não se editam aqui
      'editar_datas', v_editar and v_card.arquivado_em is null and v_pedido.id is null)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 10 · As etiquetas que faziam o papel de prioridade (D-153): o card vivo que
--      tinha uma ganha a prioridade nova (no card de cima, se for peça) e a
--      etiqueta é ARQUIVADA — nada se apaga; o histórico fica.
-- ----------------------------------------------------------------------------
do $$
declare
  r       record;
  v_marca text;
begin
  v_marca := current_setting('plt.card_maquinaria', true);
  perform set_config('plt.card_maquinaria', 'on', true);
  for r in
    select distinct on (alvo.id) alvo.id as card_id, alvo.setor_atual_id,
           case when plt_privado.fn_nome_comparavel(t.nome) like '%aten%' then 'atencao' else 'urgente' end as nova,
           t.nome as etiqueta
      from public.plt_etiquetas t
      join public.plt_cards c on t.id = any (c.etiquetas) and c.arquivado_em is null
      join public.plt_cards alvo
        on alvo.id = case when c.tipo <> 'unidade' then c.id
                          when c.pedido_id is not null then (select pc.id from public.plt_cards pc
                                                              where pc.pedido_id = c.pedido_id and pc.tipo = 'pedido')
                          else (select rp.id from public.plt_cards rp where rp.id = c.card_pai_id and rp.tipo = 'reposicao') end
     where t.arquivada_em is null
       and plt_privado.fn_nome_comparavel(t.nome) ~ '^(prioridade|prioritario|urgente|urgencia|atencao)'
       and alvo.prioridade is null
     order by alvo.id, case when plt_privado.fn_nome_comparavel(t.nome) like '%aten%' then 1 else 0 end
  loop
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, dados)
      values (r.card_id, 'prioridade_definida', null, 'api', r.setor_atual_id,
              jsonb_build_object('antes', 'comum', 'depois', r.nova,
                                 'motivo', 'A etiqueta "' || r.etiqueta || '" virou a prioridade do card.'));
  end loop;
  perform set_config('plt.card_maquinaria', coalesce(v_marca, ''), true);

  update public.plt_etiquetas t
     set arquivada_em = now(), atualizada_em = now()
   where t.arquivada_em is null
     and plt_privado.fn_nome_comparavel(t.nome) ~ '^(prioridade|prioritario|urgente|urgencia|atencao)';
end;
$$;

-- ----------------------------------------------------------------------------
-- 11 · Permissões (E-11: plt_privado fora da API)
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_ordem_do_quadro(text)                 from public, anon, authenticated;
revoke all on function plt_privado.fn_validar_card_planejamento()           from public, anon, authenticated;
revoke all on function plt_privado.fn_participantes_do_card(bigint)         from public, anon, authenticated;
revoke all on function plt_privado.fn_projetar_planejamento()               from public, anon, authenticated;
revoke all on function plt_privado.fn_avisar_pecas_do_pedido()              from public, anon, authenticated;
revoke all on function plt_privado.fn_pode_priorizar(bigint)                from public, anon, authenticated;
revoke all on function plt_privado.fn_setores_executados(bigint)            from public, anon, authenticated;
revoke all on function plt_privado.fn_quadro_cards(bigint[])                from public, anon, authenticated;
revoke all on function plt_privado.fn_quadro_junto(bigint[])                from public, anon, authenticated;
revoke all on function plt_privado.fn_quadro_pagina(bigint, bigint, timestamptz, bigint, integer, text) from public, anon, authenticated;

revoke all on function public.plt_fn_card_prioridade(bigint, text)                         from public, anon;
revoke all on function public.plt_fn_card_responsavel_setor(bigint, bigint, uuid, boolean) from public, anon;
revoke all on function public.plt_fn_quadro_setor(bigint, integer, text)                   from public, anon;
revoke all on function public.plt_fn_quadro_coluna(bigint, bigint, timestamptz, bigint, integer, text) from public, anon;
revoke all on function public.plt_fn_pcp_quadro(integer, integer, text, text)              from public, anon;
revoke all on function public.plt_fn_avulso_criar(text, text, date, date, uuid[], bigint[], text, bigint, bigint, uuid, text) from public, anon;
revoke all on function public.plt_fn_card_janela(bigint)                                   from public, anon;

grant execute on function public.plt_fn_card_prioridade(bigint, text)                         to authenticated;
grant execute on function public.plt_fn_card_responsavel_setor(bigint, bigint, uuid, boolean) to authenticated;
grant execute on function public.plt_fn_quadro_setor(bigint, integer, text)                   to authenticated;
grant execute on function public.plt_fn_quadro_coluna(bigint, bigint, timestamptz, bigint, integer, text) to authenticated;
grant execute on function public.plt_fn_pcp_quadro(integer, integer, text, text)              to authenticated;
grant execute on function public.plt_fn_avulso_criar(text, text, date, date, uuid[], bigint[], text, bigint, bigint, uuid, text) to authenticated;
grant execute on function public.plt_fn_card_janela(bigint)                                   to authenticated;
