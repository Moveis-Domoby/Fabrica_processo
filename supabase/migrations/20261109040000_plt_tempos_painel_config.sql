-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · SESSAO-47 · BLOCO C (frente 7 — 09/11/2026)
-- A CONFIGURAÇÃO DO PAINEL DE TEMPOS DE PRODUÇÃO — uma só, do administrador,
-- que vale para a tela (Dashboards → Tempos de produção) e para a TV.
--
-- Onde mora (banco enxuto — nada de tabela nova):
--   · plt_tempo_config.painel   UMA linha: só o que difere do padrão é gravado; a
--                               leitura devolve sempre o EFETIVO (padrão + gravado).
--   · plt_tempo_equipe.no_painel  o liga/desliga de cada pessoa da equipe do painel.
--
-- O que a configuração tem (chaves em português, validadas uma a uma no salvar):
--   grafico_periodo · grafico_tv   'empilhadas' (o desenho de hoje) | 'barras' | 'linhas'
--   linha_padrao                   a marca do tempo padrão na linha do dia (aba Dia)
--   abrir_setor_id · abrir_periodo o setor e o período com que a tela abre ('hoje' | '7' | '30')
--   medida                         'mediana' (a regra de hoje) | 'media'
--   tv_numeros · tv_montadores · tv_grafico · tv_melhor_semana · tv_relogio ·
--   tv_dados_ate · tv_ao_vivo      os blocos que a TV mostra
--
-- Montador desligado: sai da coluna dele na tela e na TV e aparece como "Outros"
-- — a regra é por PESSOA, resolvida aqui no banco, igual em todas as portas. Os
-- totais, as médias e o "Melhor da semana" do setor NÃO mudam (os números dele
-- continuam contando). Não vale na Conferir, no Procurar nem nas opções do
-- filtro de pessoa (ferramentas de conferência: precisam dizer quem montou).
--
-- A configuração vem JUNTO de cada porta (cada aba continua em 1 requisição): as
-- portas das abas e a da TV ganham a chave 'painel'; a média vem ao lado da
-- mediana onde só havia a mediana. Nenhuma assinatura muda e nenhuma chave some
-- — o site publicado segue funcionando com o banco novo.
--
-- Portas novas: plt_fn_tempos_abertura (a tela abre em 1 requisição, já no setor e
-- no período configurados), plt_fn_tempos_painel (a janela, só admin, no clique)
-- e plt_fn_tempos_painel_salvar (só admin; trilha com antes/depois; avisa os
-- setores de produção pelo canal que a tela e a TV já ouvem — sem canal novo).
--
-- As portas que já existiam foram recriadas da versão VIGENTE por extração
-- (20261105040000 e, a da TV, 20261106020000), com trocas exatas. Nada aqui
-- altera tabela da integração. Sem relógio novo.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Onde mora: UMA linha (a configuração) e UMA coluna (o liga/desliga)
-- ----------------------------------------------------------------------------
alter table public.plt_tempo_config add column if not exists painel jsonb not null default '{}'::jsonb;
alter table public.plt_tempo_config drop constraint if exists plt_tempo_config_painel_ck;
alter table public.plt_tempo_config add constraint plt_tempo_config_painel_ck
  check (jsonb_typeof(painel) = 'object') not valid;
alter table public.plt_tempo_config validate constraint plt_tempo_config_painel_ck;
comment on column public.plt_tempo_config.painel is
  'SESSAO-47 (Bloco C): a configuração do painel de Tempos de produção (a tela e a TV) — só as chaves que diferem do padrão (plt_privado.fn_tempos_painel_padrao). A leitura é sempre pelo efetivo (plt_privado.fn_tempos_painel). Gravada só por plt_fn_tempos_painel_salvar.';

alter table public.plt_tempo_equipe add column if not exists no_painel boolean not null default true;
comment on column public.plt_tempo_equipe.no_painel is
  'SESSAO-47 (Bloco C): a pessoa aparece com a letra/o nome dela no painel de tempos e na TV (verdadeiro) ou entra em "Outros" (falso). Os tempos dela contam do mesmo jeito — só o nome some. Gravada só por plt_fn_tempos_painel_salvar.';

-- ----------------------------------------------------------------------------
-- 2 · Os ajudantes (fora da API)
-- ----------------------------------------------------------------------------
-- o padrão: o painel como sempre foi (enquanto ninguém mexer, nada muda)
create or replace function plt_privado.fn_tempos_painel_padrao()
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'grafico_periodo', 'empilhadas', 'grafico_tv', 'empilhadas',
    'linha_padrao', false,
    'abrir_setor_id', null, 'abrir_periodo', 'hoje',
    'medida', 'mediana',
    'tv_numeros', true, 'tv_montadores', true, 'tv_grafico', true, 'tv_melhor_semana', true,
    'tv_relogio', true, 'tv_dados_ate', true, 'tv_ao_vivo', true);
$$;
comment on function plt_privado.fn_tempos_painel_padrao() is
  'SESSAO-47 (Bloco C): a configuração PADRÃO do painel de tempos — o desenho de antes da configuração existir (barras empilhadas por montador, mediana, abre na aba Dia, a TV com todos os blocos).';

-- o EFETIVO: o padrão + o que foi gravado (um dono só — todas as portas leem daqui)
create or replace function plt_privado.fn_tempos_painel()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select x.p
         -- o setor de abertura que deixou de ser um setor de produção ativo volta a "o que o aparelho lembra"
         || case when (x.p ->> 'abrir_setor_id') is not null
                      and not exists (select 1 from public.plt_setores s
                                       where s.id = (x.p ->> 'abrir_setor_id')::bigint
                                         and s.ativo and s.papel_no_fluxo = 'producao')
                 then jsonb_build_object('abrir_setor_id', null)
                 else '{}'::jsonb end
    from (select plt_privado.fn_tempos_painel_padrao()
                 || coalesce((select c.painel from public.plt_tempo_config c where c.id = 1), '{}'::jsonb) as p) x;
$$;
comment on function plt_privado.fn_tempos_painel() is
  'SESSAO-47 (Bloco C): a configuração EFETIVA do painel de tempos (o padrão + o que o administrador gravou). É o que as portas das abas, a da TV, a abertura e a janela devolvem na chave "painel".';

-- quem está desligado do painel num setor (p_menos = a própria pessoa, quando ela só vê os tempos dela)
create or replace function plt_privado.fn_tempos_desligados(p_setor_id bigint, p_menos uuid default null)
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(e.usuario_id), '{}'::uuid[])
    from public.plt_tempo_equipe e
   where e.setor_id = p_setor_id and not e.no_painel
     and (p_menos is null or e.usuario_id <> p_menos);
$$;
comment on function plt_privado.fn_tempos_desligados(bigint, uuid) is
  'SESSAO-47 (Bloco C): as pessoas da equipe do painel do setor que estão DESLIGADAS (aparecem como "Outros"). p_menos tira a própria pessoa da lista — o funcionário, que só vê o que ele montou, continua com o próprio nome.';

-- a lista de quem montou como APARECE: cada desligado vira "Outros" (a chave zerada), uma vez só, no fim
create or replace function plt_privado.fn_tempos_visiveis(p_ids uuid[], p_desl uuid[])
returns uuid[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_ids is null then '{}'::uuid[]
    when p_desl is null or cardinality(p_desl) = 0 or not (p_ids && p_desl) then p_ids
    else (select coalesce(array_agg(y.id order by y.fora, y.pos), '{}'::uuid[])
            from (select case when x.id = any (p_desl) then '00000000-0000-0000-0000-000000000000'::uuid else x.id end as id,
                         (x.id = any (p_desl)) as fora, min(x.pos) as pos
                    from unnest(p_ids) with ordinality as x(id, pos)
                   group by 1, 2) y)
  end;
$$;
comment on function plt_privado.fn_tempos_visiveis(uuid[], uuid[]) is
  'SESSAO-47 (Bloco C): a lista de pessoas de um móvel como aparece no painel — quem está em p_desl vira a chave zerada ("Outros"), uma vez só e por último. Chamada só sobre páginas pequenas (a regra por equipe do período mora em fn_tempos_chave_visivel).';

-- o mesmo para a CHAVE da equipe (os ids em ordem, separados por vírgula) — uma conta por equipe
create or replace function plt_privado.fn_tempos_chave_visivel(p_chave text, p_desl uuid[])
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when coalesce(p_chave, '') = '' or p_desl is null or cardinality(p_desl) = 0 then coalesce(p_chave, '')
    else (select coalesce(string_agg(y.id, ',' order by y.fora, y.id), '')
            from (select distinct
                         case when x::uuid = any (p_desl) then '00000000-0000-0000-0000-000000000000' else x end as id,
                         (x::uuid = any (p_desl)) as fora
                    from unnest(string_to_array(p_chave, ',')) x) y)
  end;
$$;
comment on function plt_privado.fn_tempos_chave_visivel(text, uuid[]) is
  'SESSAO-47 (Bloco C): a chave da equipe de um móvel como aparece no painel — quem está em p_desl vira a chave zerada ("Outros"), uma vez só e por último; todos desligados = só a chave zerada.';

-- a configuração em língua de gente (a trilha que a Auditoria mostra)
create or replace function plt_privado.fn_tempos_painel_rotulo(p_chave text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_chave
    when 'grafico_periodo' then 'Gráfico da aba Período'
    when 'grafico_tv' then 'Gráfico da TV'
    when 'linha_padrao' then 'Marca do tempo padrão na linha do dia'
    when 'abrir_setor_id' then 'Setor em que a tela abre'
    when 'abrir_periodo' then 'Período em que a tela abre'
    when 'medida' then 'Número do tempo médio'
    when 'tv_numeros' then 'TV · os quatro números'
    when 'tv_montadores' then 'TV · a coluna dos montadores'
    when 'tv_grafico' then 'TV · o gráfico dos 14 dias'
    when 'tv_melhor_semana' then 'TV · o melhor da semana'
    when 'tv_relogio' then 'TV · o relógio'
    when 'tv_dados_ate' then 'TV · até quando há dados'
    when 'tv_ao_vivo' then 'TV · o selo "ao vivo"'
    else p_chave
  end;
$$;

create or replace function plt_privado.fn_tempos_painel_texto(p_chave text, p_valor jsonb)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_valor is null or jsonb_typeof(p_valor) = 'null' then
      case when p_chave = 'abrir_setor_id' then 'o que o aparelho lembra' else '—' end
    when jsonb_typeof(p_valor) = 'boolean' then case when p_valor = 'true'::jsonb then 'ligado' else 'desligado' end
    when p_chave in ('grafico_periodo', 'grafico_tv') then
      case p_valor #>> '{}' when 'empilhadas' then 'barras empilhadas por montador'
                            when 'barras' then 'barras com o total'
                            when 'linhas' then 'linhas por montador' else p_valor #>> '{}' end
    when p_chave = 'medida' then case p_valor #>> '{}' when 'media' then 'média' else 'mediana' end
    when p_chave = 'abrir_periodo' then
      case p_valor #>> '{}' when 'hoje' then 'hoje (aba Dia)' when '7' then '7 dias (aba Período)'
                            when '30' then '30 dias (aba Período)' else p_valor #>> '{}' end
    when p_chave = 'abrir_setor_id' then
      coalesce((select s.nome from public.plt_setores s where s.id::text = (p_valor #>> '{}')), p_valor #>> '{}')
    else p_valor #>> '{}'
  end;
$$;

revoke all on function plt_privado.fn_tempos_painel_padrao() from public, anon, authenticated;
revoke all on function plt_privado.fn_tempos_painel() from public, anon, authenticated;
revoke all on function plt_privado.fn_tempos_desligados(bigint, uuid) from public, anon, authenticated;
revoke all on function plt_privado.fn_tempos_visiveis(uuid[], uuid[]) from public, anon, authenticated;
revoke all on function plt_privado.fn_tempos_chave_visivel(text, uuid[]) from public, anon, authenticated;
revoke all on function plt_privado.fn_tempos_painel_rotulo(text) from public, anon, authenticated;
revoke all on function plt_privado.fn_tempos_painel_texto(text, jsonb) from public, anon, authenticated;

-- o nome e a foto de um punhado de pessoas — agora com o "Outros"
-- (recriada da versão vigente — 20261105040000_plt_tempos_producao_modo_tv.sql:558-568)
create or replace function plt_privado.fn_tempos_pessoas(p_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_object_agg(u.id::text, jsonb_build_object('nome', u.nome, 'foto', u.foto_caminho)), '{}'::jsonb)
         -- SESSAO-47 (Bloco C): a chave zerada nunca é de uma pessoa — é o "Outros" (quem está desligado do painel)
         || case when '00000000-0000-0000-0000-000000000000'::uuid = any (coalesce(p_ids, '{}'))
                 then jsonb_build_object('00000000-0000-0000-0000-000000000000',
                                         jsonb_build_object('nome', 'Outros', 'foto', null))
                 else '{}'::jsonb end
    from public.plt_usuarios u
   where u.id = any (coalesce(p_ids, '{}'));
$$;
revoke all on function plt_privado.fn_tempos_pessoas(uuid[]) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3 · As portas das abas (as mesmas assinaturas; a resposta só GANHA chaves)
-- ----------------------------------------------------------------------------
-- ABA DIA
-- (recriada da versão vigente — 20261105040000_plt_tempos_producao_modo_tv.sql:593-741)
create or replace function public.plt_fn_tempos_dia(
  p_setor_id bigint, p_dia date, p_de date, p_ate date,
  p_usuario_id uuid default null, p_modelo_id bigint default null, p_trello boolean default true,
  p_depois_fim timestamptz default null, p_depois_origem text default null, p_depois_id bigint default null,
  p_limite integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
-- SESSAO-47 (ensaio ×100): o plano é feito sob medida em TODA chamada — o plano genérico que o
-- banco passa a usar depois de 5 chamadas na mesma conexão não conhece o período nem os filtros
set plan_cache_mode = force_custom_plan
as $$
declare
  v_ac     record;
  v_tr     boolean := coalesce(p_trello, true);
  v_dia    date := coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date);
  v_lim    integer := least(greatest(coalesce(p_limite, 50), 1), 100);
  v_faixa  numeric := (plt_privado.fn_tempo_regra(p_setor_id)).faixa_media_pct / 100.0;
  v_mais   boolean := p_depois_fim is not null;
  v_num    jsonb;
  v_tab    jsonb;
  v_n      integer;
  v_linha  jsonb;
  v_ids    uuid[];
  -- SESSAO-47 (Bloco C): a configuração do painel e quem está desligado dele
  v_painel jsonb := plt_privado.fn_tempos_painel();
  v_marca  boolean := coalesce((v_painel ->> 'linha_padrao')::boolean, false);   -- a marca do padrão na linha do dia
  v_outros constant uuid := '00000000-0000-0000-0000-000000000000';
  v_fora   uuid[];      -- quem está desligado do painel neste setor
  v_tem_fora boolean;   -- há alguém desligado?
begin
  select * into v_ac from plt_privado.fn_tempos_acesso(p_setor_id, p_usuario_id);
  -- SESSAO-47 (Bloco C): quem está desligado do painel aparece como "Outros"; o funcionário,
  -- olhando os tempos dele (é só o que ele vê), continua com o próprio nome. Com ninguém
  -- desligado (v_tem_fora falso), o plano sob medida tira essas contas da consulta: custo zero.
  v_fora := plt_privado.fn_tempos_desligados(p_setor_id, case when v_ac.o_lider then null else v_ac.o_pessoa end);
  v_tem_fora := cardinality(v_fora) > 0;

  -- a tabela do dia (por cursor — fim, origem, id)
  with b as (
    select m.* from plt_privado.vw_tempo_montagens m
     where m.setor_id = p_setor_id and m.dia = v_dia
       and (m.origem = 'plataforma' or v_tr)
       and (v_ac.o_pessoa is null or v_ac.o_pessoa = any (m.montadores))
       and (p_modelo_id is null or m.modelo_id = p_modelo_id)
       and (not v_mais or (m.fim, m.origem, m.id) > (p_depois_fim, coalesce(p_depois_origem, ''), coalesce(p_depois_id, 0)))
     order by m.fim, m.origem, m.id
     limit v_lim + 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'origem', b.origem, 'id', b.id, 'card_id', b.card_id, 'inicio', b.inicio, 'fim', b.fim,
           'movel', coalesce(nullif(btrim(c.titulo), ''), nullif(btrim(c.item_descricao), ''), t.cartao_nome),
           'pedido', coalesce(pd.numero, t.pedido_numero), 'modelo_id', b.modelo_id, 'modelo', mo.nome,
           'montadores', to_jsonb(case when v_tem_fora and b.montadores && v_fora
                                       then plt_privado.fn_tempos_visiveis(b.montadores, v_fora) else b.montadores end),
           'ajudantes', to_jsonb(case when v_tem_fora and b.ajudantes && v_fora
                                      then plt_privado.fn_tempos_visiveis(b.ajudantes, v_fora) else b.ajudantes end),
           'execucao_s', round(b.execucao_s), 'padrao_s', round(pa.mediana_s),
           'situacao', b.situacao, 'motivo', b.motivo, 'lote', b.lote, 'retrabalho', b.retrabalho,
           'cortado', b.cortado, 'decidida', b.decidida, 'desfecho', b.desfecho)
           order by b.fim, b.origem, b.id), '[]'::jsonb),
         count(*)
    into v_tab, v_n
    from b
    left join public.plt_cards c on b.origem = 'plataforma' and c.id = b.card_id
    left join public.pedidos pd on pd.id = c.pedido_id
    left join public.plt_tempo_trello t on b.origem = 'trello' and t.id = b.id
    left join public.plt_tempo_modelos mo on mo.id = b.modelo_id
    left join plt_privado.fn_tempos_padroes(p_setor_id, v_tr) pa on pa.modelo_id = b.modelo_id;
  if v_n > v_lim then
    v_tab := v_tab - v_lim;
  end if;
  if v_mais then
    select array_agg(distinct x::uuid) into v_ids
      from jsonb_array_elements(v_tab) r,
           lateral jsonb_array_elements_text((r -> 'montadores') || (r -> 'ajudantes')) x;
    return jsonb_build_object('tabela', jsonb_build_object('itens', v_tab, 'tem_mais', v_n > v_lim),
                              'pessoas', plt_privado.fn_tempos_pessoas(v_ids));
  end if;

  -- os números do dia (todas as linhas do dia, não só a página)
  with b as (
    select m.*, pa.mediana_s as padrao_s
      from plt_privado.vw_tempo_montagens m
      left join plt_privado.fn_tempos_padroes(p_setor_id, v_tr) pa on pa.modelo_id = m.modelo_id
     where m.setor_id = p_setor_id and m.dia = v_dia
       and (m.origem = 'plataforma' or v_tr)
       and (v_ac.o_pessoa is null or v_ac.o_pessoa = any (m.montadores))
       and (p_modelo_id is null or m.modelo_id = p_modelo_id)
  )
  select jsonb_build_object(
           'montados', count(*) filter (where b.desfecho = 'concluida' and b.situacao <> 'descartada'),
           'validas', count(*) filter (where b.situacao = 'valida'),
           'conferir', count(*) filter (where b.situacao = 'conferir'),
           'sem_registro', count(*) filter (where b.situacao = 'sem_registro' and b.desfecho = 'concluida'),
           'montadores', (select count(distinct p) from b b2 cross join lateral unnest(b2.montadores) p
                           where b2.desfecho = 'concluida' and b2.situacao <> 'descartada'),
           'tempo_total_s', round(coalesce(sum(b.execucao_s) filter (where b.situacao = 'valida'), 0)),
           'mediana_s', round((percentile_cont(0.5) within group (order by b.execucao_s) filter (where b.situacao = 'valida'))::numeric),
           'media_s', round(avg(b.execucao_s) filter (where b.situacao = 'valida')),
           'com_padrao', count(*) filter (where b.situacao = 'valida' and b.padrao_s is not null),
           'abaixo', count(*) filter (where b.situacao = 'valida' and b.padrao_s is not null
                                        and b.execucao_s < b.padrao_s * (1 - v_faixa)),
           'cobertura_total', count(*) filter (where b.desfecho = 'concluida' and b.situacao <> 'descartada'),
           'cobertura_com_tempo', count(*) filter (where b.desfecho = 'concluida' and b.situacao not in ('descartada', 'sem_registro')))
    into v_num
    from b;

  -- a linha do dia por pessoa: os trechos do dia (plataforma) e as montagens
  -- do histórico que começaram no dia; o expediente do dia para sombrear
  with tr as (
    select case when v_tem_fora and t.usuario_id = any (v_fora) then v_outros else t.usuario_id end as usuario_id,
           t.inicio, t.fim_conta as fim, t.card_id, t.papel, t.descartado,
           (t.fim is not null and (t.fim_tipo in ('fim_expediente', 'sem_resposta', 'esquecido')
                                   or (t.corte is not null and t.fim > t.corte))) as cortado,
           coalesce(nullif(btrim(c.titulo), ''), nullif(btrim(c.item_descricao), '')) as movel,
           'plataforma'::text as origem,
           -- SESSAO-47 (Bloco C): de qual móvel é o trecho (a passagem) e, só com a marca do padrão
           -- ligada, o tempo padrão do modelo e o tempo do móvel — a tela desenha onde ele terminaria
           t.passagem_id as ref, pa.mediana_s as padrao_s, ps.execucao_s as movel_s
      from public.plt_tempo_trechos t
      -- SESSAO-47 (ensaio ×100): o card e a passagem de cada trecho vêm por BUSCA NA CHAVE, um
      -- trecho de cada vez (o "offset 0" impede o banco de trocar a busca por uma junção que lê
      -- a tabela inteira dos cards — num dia cheio, era o que mais pesava: 47 → 17 ms). A
      -- resposta é a mesma; com a marca desligada, a busca da passagem nem acontece.
      left join lateral (select c.titulo, c.item_descricao from public.plt_cards c
                          where c.id = t.card_id offset 0) c on true
      left join lateral (select ps.modelo_id, ps.execucao_s from public.plt_tempo_passagens ps
                          where v_marca and ps.id = t.passagem_id offset 0) ps on true
      left join plt_privado.fn_tempos_padroes(p_setor_id, v_tr) pa on v_marca and pa.modelo_id = ps.modelo_id
     where t.setor_id = p_setor_id and t.dia = v_dia
       and (v_ac.o_pessoa is null or t.usuario_id = v_ac.o_pessoa)
    union all
    select case when v_tem_fora and p = any (v_fora) then v_outros else p end,
           t.inicio, least(t.fim, coalesce(plt_privado.fn_tempo_corte(t.setor_id, t.inicio, null), t.fim)),
           null, 'execucao', false, t.cortado, t.cartao_nome, 'trello',
           t.id, pa.mediana_s, case when v_marca then t.execucao_s end
      from public.plt_tempo_trello t
      cross join lateral unnest(t.pessoas) p
      left join plt_privado.fn_tempos_padroes(p_setor_id, v_tr) pa on v_marca and pa.modelo_id = t.modelo_id
     where v_tr and t.setor_id = p_setor_id
       and t.inicio >= v_dia::timestamp at time zone 'America/Fortaleza'
       and t.inicio < (v_dia + 1)::timestamp at time zone 'America/Fortaleza'
       and (v_ac.o_pessoa is null or p = v_ac.o_pessoa)
    order by 2
    limit 2000
  )
  select jsonb_build_object(
           'janelas', coalesce((select jsonb_agg(jsonb_build_array(lower(j), upper(j)) order by lower(j))
                                  from unnest(plt_privado.fn_tempo_janelas(p_setor_id,
                                         v_dia::timestamp at time zone 'America/Fortaleza',
                                         (v_dia + 1)::timestamp at time zone 'America/Fortaleza', null)) j), '[]'::jsonb),
           'trechos', coalesce(jsonb_agg(jsonb_build_object(
                         'pessoa', tr.usuario_id, 'inicio', tr.inicio, 'fim', tr.fim, 'card_id', tr.card_id,
                         'movel', tr.movel, 'papel', tr.papel, 'descartado', tr.descartado, 'cortado', tr.cortado,
                         'origem', tr.origem, 'ref', tr.ref, 'padrao_s', round(tr.padrao_s),
                         'movel_s', round(tr.movel_s))
                         order by (tr.usuario_id = v_outros), tr.usuario_id, tr.inicio), '[]'::jsonb))
    into v_linha
    from tr;

  select array_agg(distinct x::uuid) into v_ids
    from (select jsonb_array_elements_text((r -> 'montadores') || (r -> 'ajudantes')) as x
            from jsonb_array_elements(v_tab) r
          union all
          select tt ->> 'pessoa' from jsonb_array_elements(v_linha -> 'trechos') tt) q
   where x is not null;

  return jsonb_build_object(
    'setor', jsonb_build_object('id', p_setor_id, 'nome', v_ac.o_setor_nome),
    'painel', v_painel,
    'dia', v_dia, 'pode_decidir', v_ac.o_lider, 'pessoa_travada', not v_ac.o_lider,
    'faixa_pct', round(v_faixa * 100),
    'numeros', v_num,
    'linha', v_linha,
    'tabela', jsonb_build_object('itens', v_tab, 'tem_mais', v_n > v_lim),
    'pessoas', plt_privado.fn_tempos_pessoas(v_ids),
    'conferir_n', case when v_ac.o_lider and p_de is not null and p_ate is not null
                       then plt_privado.fn_tempos_conferir_n(p_setor_id, p_de, p_ate, v_ac.o_pessoa, v_tr) end);
end;
$$;

-- ABA PERÍODO
-- (recriada da versão vigente — 20261105040000_plt_tempos_producao_modo_tv.sql:748-872)
create or replace function public.plt_fn_tempos_periodo(
  p_setor_id bigint, p_de date, p_ate date,
  p_usuario_id uuid default null, p_modelo_id bigint default null, p_trello boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
-- SESSAO-47 (ensaio ×100): o plano é feito sob medida em TODA chamada — o plano genérico que o
-- banco passa a usar depois de 5 chamadas na mesma conexão não conhece o período nem os filtros
set plan_cache_mode = force_custom_plan
as $$
declare
  v_ac      record;
  v_tr      boolean := coalesce(p_trello, true);
  v_de      date := coalesce(p_de, (now() at time zone 'America/Fortaleza')::date - 29);
  v_ate     date := coalesce(p_ate, (now() at time zone 'America/Fortaleza')::date);
  v_semana  boolean;
  v_uteis   integer;
  v_ret     jsonb;
  v_ids     uuid[];
  -- SESSAO-47 (Bloco C): a configuração do painel e quem está desligado dele
  v_painel  jsonb := plt_privado.fn_tempos_painel();
  v_outros  constant text := '00000000-0000-0000-0000-000000000000';
  v_fora   uuid[];      -- quem está desligado do painel neste setor
  v_tem_fora boolean;   -- há alguém desligado?
begin
  select * into v_ac from plt_privado.fn_tempos_acesso(p_setor_id, p_usuario_id);
  -- SESSAO-47 (Bloco C): quem está desligado do painel aparece como "Outros"; o funcionário,
  -- olhando os tempos dele (é só o que ele vê), continua com o próprio nome. Com ninguém
  -- desligado (v_tem_fora falso), o plano sob medida tira essas contas da consulta: custo zero.
  v_fora := plt_privado.fn_tempos_desligados(p_setor_id, case when v_ac.o_lider then null else v_ac.o_pessoa end);
  v_tem_fora := cardinality(v_fora) > 0;
  if v_ate < v_de or v_ate - v_de > 400 then
    raise exception 'O período vai até 12 meses.' using errcode = 'invalid_parameter_value';
  end if;
  v_semana := v_ate - v_de + 1 > 70;
  v_uteis := plt_privado.fn_tempos_dias_uteis(p_setor_id, v_de, v_ate, v_tr);

  with b as (
    select m.origem, m.dia, m.modelo_id, m.execucao_s, m.fila_s, m.parado_s, m.situacao, m.desfecho,
           m.retrabalho, m.montado, m.chave as k
      from plt_privado.vw_tempo_montagens m
     where m.setor_id = p_setor_id and m.dia between v_de and v_ate
       and (m.origem = 'plataforma' or v_tr)
       and (v_ac.o_pessoa is null or v_ac.o_pessoa = any (m.montadores))
       and (p_modelo_id is null or m.modelo_id = p_modelo_id)
  ),
  mont as (select * from b where b.montado),
  num as (
    select count(*) filter (where b.montado) as montados,
           count(*) filter (where b.situacao = 'valida') as validas,
           count(*) filter (where b.situacao = 'conferir') as conferir,
           count(*) filter (where b.desfecho = 'concluida' and b.situacao not in ('descartada', 'sem_registro')) as com_tempo,
           count(distinct b.dia) filter (where b.montado) as dias_com,
           coalesce(sum(b.execucao_s) filter (where b.situacao = 'valida'), 0) as total_s,
           percentile_cont(0.5) within group (order by b.execucao_s) filter (where b.situacao = 'valida') as mediana_s,
           avg(b.execucao_s) filter (where b.situacao = 'valida') as media_s,
           -- onde vai o tempo do setor (só a plataforma tem fila)
           coalesce(sum(b.fila_s) filter (where b.origem = 'plataforma' and b.situacao <> 'descartada'), 0) as fila_s,
           coalesce(sum(b.execucao_s) filter (where b.origem = 'plataforma' and b.situacao <> 'descartada'), 0) as exec_s,
           coalesce(sum(b.parado_s) filter (where b.origem = 'plataforma' and b.situacao <> 'descartada'), 0) as parado_s,
           count(*) filter (where b.retrabalho) as retrab_n,
           coalesce(sum(b.execucao_s) filter (where b.retrabalho), 0) as retrab_s,
           count(*) filter (where b.origem = 'plataforma') as n_plataforma,
           count(*) filter (where b.origem = 'trello') as n_trello
      from b
  ),
  barras0 as (   -- por dia (ou semana) e pela equipe de verdade — a conta de sempre
    select case when v_semana then date_trunc('week', mont.dia)::date else mont.dia end as balde, mont.k, count(*) as n
      from mont group by 1, 2
  ),
  -- SESSAO-47 (Bloco C): a equipe como APARECE — quem está desligado do painel vira "Outros".
  -- Uma conta por EQUIPE do período (nunca por móvel); com ninguém desligado, nada disto roda.
  kv as (
    select x.k as k0, plt_privado.fn_tempos_chave_visivel(x.k, v_fora) as visivel
      from (select distinct mont.k from mont where v_tem_fora and mont.k <> '') x
  ),
  barras as (    -- as barras pela equipe como aparece (poucas linhas: dias × equipes)
    select b0.balde, coalesce(kv.visivel, b0.k) as k, sum(b0.n)::bigint as n
      from barras0 b0 left join kv on kv.k0 = b0.k
     group by 1, 2
  ),
  series as (
    -- o "Outros" (só gente desligada) nunca disputa uma das 7 séries: vai junto com o resto
    select k, sum(n) as n, row_number() over (order by (k = v_outros), sum(n) desc, k) as ordem from barras group by k
  ),
  -- os móveis com a equipe como aparece: com ninguém desligado é a própria lista (sem junção);
  -- o plano sob medida deixa só um dos dois ramos
  montk as (
    select mont.dia, mont.execucao_s, mont.situacao, mont.k from mont where not v_tem_fora
    union all
    select mont.dia, mont.execucao_s, mont.situacao, coalesce(kv.visivel, mont.k)
      from mont left join kv on kv.k0 = mont.k
     where v_tem_fora
  ),
  porm as (
    select mont.k,
           count(*) as moveis,
           count(distinct mont.dia) as dias,
           percentile_cont(0.5) within group (order by mont.execucao_s) filter (where mont.situacao = 'valida') as mediana_s,
           coalesce(sum(mont.execucao_s) filter (where mont.situacao = 'valida'), 0) as total_s,
           count(*) filter (where mont.situacao = 'valida') as validas   -- SESSAO-47: a média = total ÷ válidas
      from montk mont group by mont.k
  ),
  top as (
    select mont.modelo_id, count(*) as n from mont group by mont.modelo_id
  )
  select jsonb_build_object(
    'numeros', (select jsonb_build_object(
                  'montados', num.montados, 'validas', num.validas, 'conferir', num.conferir,
                  'dias_uteis', v_uteis,
                  'media_dia_util', case when v_uteis > 0 then round(num.montados::numeric / v_uteis, 1) end,
                  'dias_com_montagem', num.dias_com,
                  'media_dia_montagem', case when num.dias_com > 0 then round(num.montados::numeric / num.dias_com, 1) end,
                  'tempo_total_s', round(num.total_s), 'mediana_s', round(num.mediana_s::numeric), 'media_s', round(num.media_s),
                  'cobertura_total', num.montados, 'cobertura_com_tempo', num.com_tempo,
                  'n_plataforma', num.n_plataforma, 'n_trello', num.n_trello) from num),
    'tempo_setor', (select jsonb_build_object('fila_s', round(num.fila_s), 'execucao_s', round(num.exec_s),
                                              'parado_s', round(num.parado_s), 'retrabalho_n', num.retrab_n,
                                              'retrabalho_s', round(num.retrab_s)) from num),
    'grafico', jsonb_build_object(
       'agrupado', case when v_semana then 'semana' else 'dia' end,
       -- as 7 chaves que mais montaram e "+" (o resto junto)
       'series', coalesce((select jsonb_agg(jsonb_build_object('chave', x.chave, 'n', x.n) order by x.o)
                             from (select case when s.ordem <= 7 and s.k <> v_outros then s.k else '+' end as chave, sum(s.n) as n, min(s.ordem) as o
                                     from series s group by 1) x), '[]'::jsonb),
       'barras', coalesce((select jsonb_agg(jsonb_build_object('balde', x.balde, 'total', x.total, 'partes', x.partes) order by x.balde)
                             from (select br.balde, sum(br.n) as total,
                                          jsonb_object_agg(br.chave, br.n) as partes
                                     from (select ba.balde, case when s.ordem <= 7 and ba.k <> v_outros then ba.k else '+' end as chave, sum(ba.n) as n
                                             from barras ba join series s on s.k = ba.k group by 1, 2) br
                                    group by br.balde) x), '[]'::jsonb)),
    'por_montador', coalesce((select jsonb_agg(jsonb_build_object(
                                 'chave', p.k, 'moveis', p.moveis, 'dias', p.dias,
                                 'por_dia', round(p.moveis::numeric / greatest(p.dias, 1), 1),
                                 'mediana_s', round(p.mediana_s::numeric),
                                 'media_s', round(p.total_s / nullif(p.validas, 0)),
                                 'tempo_total_s', round(p.total_s))
                               order by (p.k = v_outros), p.moveis desc, p.k) from porm p), '[]'::jsonb),
    'moveis_top', jsonb_build_object(
       'itens', coalesce((select jsonb_agg(jsonb_build_object('modelo_id', t.modelo_id, 'nome', coalesce(mo.nome, 'Sem modelo'),
                                                               'n', t.n, 'pct', round(100.0 * t.n / greatest((select montados from num), 1), 1))
                                           order by t.n desc, mo.nome)
                            from (select * from top order by n desc, modelo_id limit 12) t
                            left join public.plt_tempo_modelos mo on mo.id = t.modelo_id), '[]'::jsonb),
       'mais_n', greatest((select count(*) from top) - 12, 0)),
    'chaves', coalesce((select jsonb_agg(distinct k) from (select k from series union select k from porm) q where k <> ''), '[]'::jsonb))
    into v_ret;

  select array_agg(distinct x::uuid) into v_ids
    from jsonb_array_elements_text(v_ret -> 'chaves') c,
         lateral unnest(string_to_array(c, ',')) x;

  return v_ret - 'chaves' || jsonb_build_object(
    'setor', jsonb_build_object('id', p_setor_id, 'nome', v_ac.o_setor_nome),
    'painel', v_painel,
    'de', v_de, 'ate', v_ate, 'pode_decidir', v_ac.o_lider, 'pessoa_travada', not v_ac.o_lider,
    'pessoas', plt_privado.fn_tempos_pessoas(v_ids),
    'conferir_n', case when v_ac.o_lider then plt_privado.fn_tempos_conferir_n(p_setor_id, v_de, v_ate, v_ac.o_pessoa, v_tr) end);
end;
$$;

-- ABA MÓVEIS
-- (recriada da versão vigente — 20261105040000_plt_tempos_producao_modo_tv.sql:881-1009)
create or replace function public.plt_fn_tempos_moveis(
  p_setor_id bigint, p_de date, p_ate date,
  p_usuario_id uuid default null, p_trello boolean default true,
  p_ordem text default 'qtd', p_desc boolean default true,
  p_deslocamento integer default 0, p_limite integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
-- SESSAO-47 (ensaio ×100): o plano é feito sob medida em TODA chamada — o plano genérico que o
-- banco passa a usar depois de 5 chamadas na mesma conexão não conhece o período nem os filtros
set plan_cache_mode = force_custom_plan
as $$
declare
  v_ac    record;
  v_tr    boolean := coalesce(p_trello, true);
  v_de    date := coalesce(p_de, (now() at time zone 'America/Fortaleza')::date - 29);
  v_ate   date := coalesce(p_ate, (now() at time zone 'America/Fortaleza')::date);
  v_lim   integer := least(greatest(coalesce(p_limite, 50), 1), 100);
  v_desl  integer := greatest(coalesce(p_deslocamento, 0), 0);
  v_ord   text := case when p_ordem in ('qtd', 'melhor', 'mediana', 'media', 'faixa', 'nome') then p_ordem else 'qtd' end;
  v_desc  boolean := coalesce(p_desc, true);
  v_faixa numeric := (plt_privado.fn_tempo_regra(p_setor_id)).faixa_media_pct / 100.0;
  v_ret   jsonb;
  v_ids   uuid[];
  -- SESSAO-47 (Bloco C): a configuração do painel e quem está desligado dele
  v_painel jsonb := plt_privado.fn_tempos_painel();
  v_outros constant uuid := '00000000-0000-0000-0000-000000000000';
  v_fora   uuid[];      -- quem está desligado do painel neste setor
  v_tem_fora boolean;   -- há alguém desligado?
begin
  select * into v_ac from plt_privado.fn_tempos_acesso(p_setor_id, p_usuario_id);
  -- SESSAO-47 (Bloco C): quem está desligado do painel aparece como "Outros"; o funcionário,
  -- olhando os tempos dele (é só o que ele vê), continua com o próprio nome. Com ninguém
  -- desligado (v_tem_fora falso), o plano sob medida tira essas contas da consulta: custo zero.
  v_fora := plt_privado.fn_tempos_desligados(p_setor_id, case when v_ac.o_lider then null else v_ac.o_pessoa end);
  v_tem_fora := cardinality(v_fora) > 0;
  if v_ate < v_de or v_ate - v_de > 400 then
    raise exception 'O período vai até 12 meses.' using errcode = 'invalid_parameter_value';
  end if;

  with b as (
    select m.origem, m.id, m.modelo_id, m.execucao_s, m.situacao, m.montado
      from plt_privado.vw_tempo_montagens m
     where m.setor_id = p_setor_id and m.dia between v_de and v_ate
       and (m.origem = 'plataforma' or v_tr)
       and (v_ac.o_pessoa is null or v_ac.o_pessoa = any (m.montadores))
  ),
  g as (
    select b.modelo_id,
           count(*) filter (where b.montado) as qtd,
           count(*) filter (where b.situacao = 'conferir') as conferir,
           count(*) filter (where b.situacao = 'valida') as validas,
           min(b.execucao_s) filter (where b.situacao = 'valida') as melhor,
           avg(b.execucao_s) filter (where b.situacao = 'valida') as media,   -- SESSAO-47: a média na mesma passada
           -- os três percentis numa ordenação só
           percentile_cont(array[0.25, 0.5, 0.75]) within group (order by b.execucao_s)
             filter (where b.situacao = 'valida') as pc,
           count(*) filter (where b.origem = 'trello') as n_trello
      from b group by b.modelo_id
  ),
  -- as pessoas dos móveis do período (da projeção por pessoa — sem desmontar
  -- a lista de montadores linha a linha)
  bp as (
    select case when v_tem_fora and q.usuario_id = any (v_fora) then v_outros else q.usuario_id end as usuario_id,
           q.modelo_id, q.execucao_s, q.situacao, q.montado
      from public.plt_tempo_montagem_pessoas q
     where q.setor_id = p_setor_id and q.dia between v_de and v_ate and q.papel = 'montador'
       and (q.origem = 'plataforma' or v_tr)
       and (v_ac.o_pessoa is null
            or exists (select 1 from public.plt_tempo_montagem_pessoas e
                        where e.origem = q.origem and e.ref_id = q.ref_id and e.papel = 'montador'
                          and e.usuario_id = v_ac.o_pessoa))
  ),
  gn as (
    select g.modelo_id, g.qtd, g.conferir, g.validas, g.melhor, g.media, g.n_trello,
           g.pc[2] as mediana, g.pc[1] as p25, g.pc[3] as p75,
           coalesce(mo.nome, 'Sem modelo') as nome, pa.mediana_s as padrao
      from g
      left join public.plt_tempo_modelos mo on mo.id = g.modelo_id
      left join plt_privado.fn_tempos_padroes(p_setor_id, v_tr) pa on pa.modelo_id = g.modelo_id
  ),
  pagina as (
    select gn.*, row_number() over (order by
             case when v_ord = 'qtd' and v_desc then gn.qtd end desc nulls last,
             case when v_ord = 'qtd' and not v_desc then gn.qtd end asc nulls last,
             case when v_ord = 'melhor' and v_desc then gn.melhor end desc nulls last,
             case when v_ord = 'melhor' and not v_desc then gn.melhor end asc nulls last,
             case when v_ord = 'mediana' and v_desc then gn.mediana end desc nulls last,
             case when v_ord = 'mediana' and not v_desc then gn.mediana end asc nulls last,
             case when v_ord = 'media' and v_desc then gn.media end desc nulls last,
             case when v_ord = 'media' and not v_desc then gn.media end asc nulls last,
             case when v_ord = 'faixa' and v_desc then gn.p75 - gn.p25 end desc nulls last,
             case when v_ord = 'faixa' and not v_desc then gn.p75 - gn.p25 end asc nulls last,
             case when v_ord = 'nome' and v_desc then gn.nome end desc,
             case when v_ord = 'nome' and not v_desc then gn.nome end asc,
             gn.nome, gn.modelo_id) as pos
      from gn
  ),
  -- as colunas por montador: as 6 pessoas que mais montaram no período
  -- SESSAO-47 (Bloco C): as 6 pessoas que mais montaram e, por último, "Outros" (quem está desligado
  -- do painel) — o 2º ramo só roda quando há alguém desligado
  col as (
    (select bp.usuario_id, count(*) as n
       from bp
      where bp.montado and (not v_tem_fora or bp.usuario_id <> v_outros)
      group by bp.usuario_id order by count(*) desc, bp.usuario_id limit 6)
    union all
    (select v_outros, count(*) from bp where v_tem_fora and bp.montado and bp.usuario_id = v_outros having count(*) > 0)
  ),
  pg as (select coalesce(pagina.modelo_id, 0) as mk from pagina where pagina.pos > v_desl and pagina.pos <= v_desl + v_lim),
  pp as (   -- "sem modelo" entra como 0 (igualdade simples: junção por hash)
    select coalesce(bp.modelo_id, 0) as mk, bp.usuario_id, count(*) as n,
           percentile_cont(0.5) within group (order by bp.execucao_s) as mediana,
           avg(bp.execucao_s) as media
      from bp
      join pg on pg.mk = coalesce(bp.modelo_id, 0)
      join col on col.usuario_id = bp.usuario_id
     where bp.situacao = 'valida'
     group by 1, bp.usuario_id
  ),
  ppj as (  -- uma vez por modelo da página (nunca uma releitura por linha)
    select pp.mk, jsonb_object_agg(pp.usuario_id::text, jsonb_build_object('n', pp.n, 'mediana_s', round(pp.mediana::numeric), 'media_s', round(pp.media))) as j
      from pp group by pp.mk
  )
  select jsonb_build_object(
    'colunas', coalesce((select jsonb_agg(to_jsonb(col.usuario_id) order by (col.usuario_id = v_outros), col.n desc, col.usuario_id) from col), '[]'::jsonb),
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
               'modelo_id', p.modelo_id, 'nome', p.nome, 'qtd', p.qtd, 'conferir', p.conferir, 'validas', p.validas,
               'melhor_s', round(p.melhor), 'mediana_s', round(p.mediana::numeric), 'media_s', round(p.media),
               'p25_s', round(p.p25::numeric),
               'p75_s', round(p.p75::numeric), 'padrao_s', round(p.padrao), 'n_trello', p.n_trello,
               'por_pessoa', coalesce(j.j, '{}'::jsonb))
             order by p.pos)
             from pagina p
             left join ppj j on j.mk = coalesce(p.modelo_id, 0)
            where p.pos > v_desl and p.pos <= v_desl + v_lim), '[]'::jsonb),
    'total', (select count(*) from gn),
    'tem_mais', (select count(*) from gn) > v_desl + v_lim)
    into v_ret;

  select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(v_ret -> 'colunas') x;
  return v_ret || jsonb_build_object(
    'setor', jsonb_build_object('id', p_setor_id, 'nome', v_ac.o_setor_nome),
    'painel', v_painel,
    'de', v_de, 'ate', v_ate, 'faixa_pct', round(v_faixa * 100),
    'pode_decidir', v_ac.o_lider, 'pessoa_travada', not v_ac.o_lider,
    'pessoas', plt_privado.fn_tempos_pessoas(v_ids),
    'conferir_n', case when v_ac.o_lider then plt_privado.fn_tempos_conferir_n(p_setor_id, v_de, v_ate, v_ac.o_pessoa, v_tr) end);
end;
$$;

-- MÓVEIS · as passagens de um modelo
-- (recriada da versão vigente — 20261105040000_plt_tempos_producao_modo_tv.sql:1013-1065)
create or replace function public.plt_fn_tempos_modelo_passagens(
  p_setor_id bigint, p_modelo_id bigint, p_de date, p_ate date,
  p_usuario_id uuid default null, p_trello boolean default true, p_sem_modelo boolean default false,
  p_depois_fim timestamptz default null, p_depois_origem text default null, p_depois_id bigint default null,
  p_limite integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
-- SESSAO-47 (ensaio ×100): o plano é feito sob medida em TODA chamada — o plano genérico que o
-- banco passa a usar depois de 5 chamadas na mesma conexão não conhece o período nem os filtros
set plan_cache_mode = force_custom_plan
as $$
declare
  v_ac   record;
  v_tr   boolean := coalesce(p_trello, true);
  v_lim  integer := least(greatest(coalesce(p_limite, 30), 1), 100);
  v_itens jsonb;
  v_n    integer;
  v_ids  uuid[];
  v_fora   uuid[];      -- quem está desligado do painel neste setor
  v_tem_fora boolean;   -- há alguém desligado?
begin
  select * into v_ac from plt_privado.fn_tempos_acesso(p_setor_id, p_usuario_id);
  -- SESSAO-47 (Bloco C): quem está desligado do painel aparece como "Outros"; o funcionário,
  -- olhando os tempos dele (é só o que ele vê), continua com o próprio nome. Com ninguém
  -- desligado (v_tem_fora falso), o plano sob medida tira essas contas da consulta: custo zero.
  v_fora := plt_privado.fn_tempos_desligados(p_setor_id, case when v_ac.o_lider then null else v_ac.o_pessoa end);
  v_tem_fora := cardinality(v_fora) > 0;
  with b as (
    select m.* from plt_privado.vw_tempo_montagens m
     where m.setor_id = p_setor_id and m.dia between p_de and p_ate
       and (m.origem = 'plataforma' or v_tr)
       and (case when coalesce(p_sem_modelo, false) then m.modelo_id is null else m.modelo_id = p_modelo_id end)
       and (v_ac.o_pessoa is null or v_ac.o_pessoa = any (m.montadores))
       and (p_depois_fim is null or (m.fim, m.origem, m.id) < (p_depois_fim, coalesce(p_depois_origem, ''), coalesce(p_depois_id, 0)))
     order by m.fim desc, m.origem desc, m.id desc
     limit v_lim + 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'origem', b.origem, 'id', b.id, 'card_id', b.card_id, 'dia', b.dia, 'fim', b.fim,
           'movel', coalesce(nullif(btrim(c.titulo), ''), nullif(btrim(c.item_descricao), ''), t.cartao_nome),
           'pedido', coalesce(pd.numero, t.pedido_numero),
           'montadores', to_jsonb(case when v_tem_fora and b.montadores && v_fora
                                       then plt_privado.fn_tempos_visiveis(b.montadores, v_fora) else b.montadores end),
           'execucao_s', round(b.execucao_s), 'padrao_s', round(pa.mediana_s),
           'situacao', b.situacao, 'motivo', b.motivo, 'lote', b.lote, 'cortado', b.cortado, 'decidida', b.decidida)
           order by b.fim desc, b.origem desc, b.id desc), '[]'::jsonb), count(*)
    into v_itens, v_n
    from b
    left join public.plt_cards c on b.origem = 'plataforma' and c.id = b.card_id
    left join public.pedidos pd on pd.id = c.pedido_id
    left join public.plt_tempo_trello t on b.origem = 'trello' and t.id = b.id
    left join plt_privado.fn_tempos_padroes(p_setor_id, v_tr) pa on pa.modelo_id = b.modelo_id;
  if v_n > v_lim then
    v_itens := v_itens - v_lim;
  end if;
  select array_agg(distinct x::uuid) into v_ids
    from jsonb_array_elements(v_itens) r, lateral jsonb_array_elements_text(r -> 'montadores') x;
  return jsonb_build_object('itens', v_itens, 'tem_mais', v_n > v_lim, 'pode_decidir', v_ac.o_lider,
                            'pessoas', plt_privado.fn_tempos_pessoas(v_ids));
end;
$$;

-- ABA MONTADORES
-- (recriada da versão vigente — 20261105040000_plt_tempos_producao_modo_tv.sql:1073-1218)
create or replace function public.plt_fn_tempos_montadores(
  p_setor_id bigint, p_de date, p_ate date,
  p_usuario_id uuid default null, p_modelo_id bigint default null, p_trello boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
-- SESSAO-47 (ensaio ×100): o plano é feito sob medida em TODA chamada — o plano genérico que o
-- banco passa a usar depois de 5 chamadas na mesma conexão não conhece o período nem os filtros
set plan_cache_mode = force_custom_plan
as $$
declare
  v_ac    record;
  v_tr    boolean := coalesce(p_trello, true);
  v_de    date := coalesce(p_de, (now() at time zone 'America/Fortaleza')::date - 29);
  v_ate   date := coalesce(p_ate, (now() at time zone 'America/Fortaleza')::date);
  v_faixa numeric := (plt_privado.fn_tempo_regra(p_setor_id)).faixa_media_pct / 100.0;
  v_ret   jsonb;
  v_ids   uuid[];
  -- SESSAO-47 (Bloco C): a configuração do painel e quem está desligado dele
  v_painel jsonb := plt_privado.fn_tempos_painel();
  v_outros constant uuid := '00000000-0000-0000-0000-000000000000';
  v_fora   uuid[];      -- quem está desligado do painel neste setor
  v_tem_fora boolean;   -- há alguém desligado?
begin
  select * into v_ac from plt_privado.fn_tempos_acesso(p_setor_id, p_usuario_id);
  -- SESSAO-47 (Bloco C): quem está desligado do painel aparece como "Outros"; o funcionário,
  -- olhando os tempos dele (é só o que ele vê), continua com o próprio nome. Com ninguém
  -- desligado (v_tem_fora falso), o plano sob medida tira essas contas da consulta: custo zero.
  v_fora := plt_privado.fn_tempos_desligados(p_setor_id, case when v_ac.o_lider then null else v_ac.o_pessoa end);
  v_tem_fora := cardinality(v_fora) > 0;
  if v_ate < v_de or v_ate - v_de > 400 then
    raise exception 'O período vai até 12 meses.' using errcode = 'invalid_parameter_value';
  end if;

  with pa as materialized (
    select x.modelo_id, x.mediana_s from plt_privado.fn_tempos_padroes(p_setor_id, v_tr) x
  ),
  b as (    -- os móveis (para "os 8 melhores")
    select m.origem, m.dia, m.modelo_id, m.execucao_s, m.montadores, pa.mediana_s as padrao_s
      from plt_privado.vw_tempo_montagens m
      left join pa on pa.modelo_id = m.modelo_id
     where m.setor_id = p_setor_id and m.dia between v_de and v_ate
       and m.situacao = 'valida' and m.modelo_id is not null
       and (m.origem = 'plataforma' or v_tr)
       and (p_modelo_id is null or m.modelo_id = p_modelo_id)
       and (v_ac.o_pessoa is null or v_ac.o_pessoa = any (m.montadores))
  ),
  q as (    -- pessoa × móvel (da projeção por pessoa — montadores e ajudantes)
    select q.papel,
           case when v_tem_fora and q.usuario_id = any (v_fora) then v_outros else q.usuario_id end as usuario_id,
           q.dia, q.modelo_id, q.execucao_s, q.esforco_s, q.situacao, q.montado
      from public.plt_tempo_montagem_pessoas q
     where q.setor_id = p_setor_id and q.dia between v_de and v_ate
       and (q.origem = 'plataforma' or v_tr)
       and (p_modelo_id is null or q.modelo_id = p_modelo_id)
       and (v_ac.o_pessoa is null or q.usuario_id = v_ac.o_pessoa)
  ),
  pp as (   -- só o que a pessoa MONTOU, com o padrão do modelo
    select q.usuario_id, q.dia, q.modelo_id, q.execucao_s, q.esforco_s, q.situacao, q.montado, pa.mediana_s as padrao_s
      from q left join pa on pa.modelo_id = q.modelo_id
     where q.papel = 'montador'
  ),
  pes as (
    select pp.usuario_id,
           count(*) filter (where pp.montado) as moveis,
           count(distinct pp.dia) filter (where pp.montado) as dias,
           percentile_cont(0.5) within group (order by pp.execucao_s) filter (where pp.situacao = 'valida') as mediana,
           avg(pp.execucao_s) filter (where pp.situacao = 'valida') as media,   -- SESSAO-47: a média na mesma passada
           coalesce(sum(pp.esforco_s) filter (where pp.situacao = 'valida'), 0) as esforco
      from pp group by pp.usuario_id
  ),
  pm as materialized (   -- pessoa × modelo (válidas): a mediana e o menor tempo, numa ordenação só
    select pp.usuario_id, pp.modelo_id, max(pp.padrao_s) as padrao, min(pp.execucao_s) as menor,
           percentile_cont(0.5) within group (order by pp.execucao_s) as med
      from pp where pp.situacao = 'valida'
     group by pp.usuario_id, pp.modelo_id
  ),
  cmp as (   -- a mediana dela em cada modelo, contra o padrão
    select pm.usuario_id,
           count(*) filter (where pm.padrao is not null and pm.med < pm.padrao * (1 - v_faixa)) as abaixo,
           count(*) filter (where pm.padrao is not null and pm.med > pm.padrao * (1 + v_faixa)) as acima,
           count(*) filter (where pm.padrao is not null and pm.med between pm.padrao * (1 - v_faixa) and pm.padrao * (1 + v_faixa)) as na_media
      from pm where pm.modelo_id is not null group by pm.usuario_id
  ),
  melhor0 as (   -- o modelo em que ela mais ganhou do padrão (sem padrão: o mais rápido) — o padrão é
                 -- um só por modelo, então o melhor do modelo é o menor tempo dele
    select distinct on (pm.usuario_id) pm.usuario_id, pm.modelo_id, pm.menor, pm.padrao
      from pm
     order by pm.usuario_id, (pm.menor / nullif(pm.padrao, 0)) asc nulls last, pm.menor asc, pm.modelo_id
  ),
  melhor as (    -- e o dia dessa montagem
    select m0.usuario_id, m0.modelo_id, m0.menor as execucao_s, m0.padrao as padrao_s, min(pp.dia) as dia
      from melhor0 m0
      join pp on pp.usuario_id = m0.usuario_id and coalesce(pp.modelo_id, 0) = coalesce(m0.modelo_id, 0)
             and pp.execucao_s = m0.menor and pp.situacao = 'valida'
     group by m0.usuario_id, m0.modelo_id, m0.menor, m0.padrao
  ),
  aj as (
    select q.usuario_id, count(*) as n from q where q.papel = 'ajudante' group by q.usuario_id
  ),
  ocup as (   -- tempo com card ÷ tempo no setor dentro do expediente (só a plataforma registra presença)
    select case when v_tem_fora and r.usuario_id = any (v_fora) then v_outros else r.usuario_id end as usuario_id,
           sum(r.esforco_s) as com_card, sum(r.trabalhando_s + r.ausente_s + r.especial_s) as no_setor
      from public.plt_tempo_resumo_pessoa_dia r
     where r.setor_id = p_setor_id and r.dia between v_de and v_ate
       and (v_ac.o_pessoa is null or r.usuario_id = v_ac.o_pessoa)
     group by 1
  ),
  mg as (   -- por modelo: quantas válidas e o menor tempo (agrupar, sem ordenar tudo)
    select b.modelo_id, count(*) as n, min(b.execucao_s) as menor, max(b.padrao_s) as padrao_s
      from b group by b.modelo_id
  ),
  m8 as (
    select mg.* from mg where mg.n >= 2
     order by (mg.menor / nullif(mg.padrao_s, 0)) asc nulls last, mg.menor asc, mg.modelo_id
     limit 8
  ),
  melhores as (   -- os 8 móveis com o melhor tempo contra o padrão (modelos com 2+ válidas)
    select distinct on (m8.modelo_id) m8.modelo_id, b.execucao_s, b.padrao_s, b.montadores, b.dia, b.origem
      from m8 join b on b.modelo_id = m8.modelo_id and b.execucao_s = m8.menor
     order by m8.modelo_id, b.dia, b.origem
  )
  select jsonb_build_object(
    'pessoas_cartoes', coalesce((select jsonb_agg(jsonb_build_object(
        'usuario_id', pe.usuario_id, 'moveis', pe.moveis, 'dias', pe.dias,
        'por_dia', round(pe.moveis::numeric / greatest(pe.dias, 1), 1),
        'mediana_s', round(pe.mediana::numeric), 'media_s', round(pe.media), 'tempo_total_s', round(pe.esforco),
        'abaixo', coalesce(c.abaixo, 0), 'acima', coalesce(c.acima, 0), 'na_media', coalesce(c.na_media, 0),
        'melhor', case when me.usuario_id is null then null else jsonb_build_object(
                    'modelo', mo.nome, 'execucao_s', round(me.execucao_s), 'padrao_s', round(me.padrao_s), 'dia', me.dia) end,
        'ajudas', coalesce(a.n, 0),
        'ocupacao_pct', case when o.no_setor > 0 then round(100 * o.com_card / o.no_setor) end)
      order by (pe.usuario_id = v_outros), pe.moveis desc, pe.usuario_id)
      from pes pe
      left join cmp c on c.usuario_id = pe.usuario_id
      left join melhor me on me.usuario_id = pe.usuario_id
      left join public.plt_tempo_modelos mo on mo.id = me.modelo_id
      left join aj a on a.usuario_id = pe.usuario_id
      left join ocup o on o.usuario_id = pe.usuario_id), '[]'::jsonb),
    'melhores', coalesce((select jsonb_agg(jsonb_build_object(
        'modelo', mo.nome, 'execucao_s', round(x.execucao_s), 'padrao_s', round(x.padrao_s),
        'montadores', to_jsonb(case when v_tem_fora and x.montadores && v_fora
                                    then plt_privado.fn_tempos_visiveis(x.montadores, v_fora) else x.montadores end),
        'dia', x.dia, 'origem', x.origem)
      order by (x.execucao_s / nullif(x.padrao_s, 0)) asc nulls last, x.execucao_s asc)
      from melhores x left join public.plt_tempo_modelos mo on mo.id = x.modelo_id), '[]'::jsonb),
    'ajudantes_so', coalesce((select jsonb_agg(jsonb_build_object('usuario_id', a.usuario_id, 'ajudas', a.n))
                                from aj a where not exists (select 1 from pes where pes.usuario_id = a.usuario_id)), '[]'::jsonb))
    into v_ret;

  select array_agg(distinct x::uuid) into v_ids
    from (select r ->> 'usuario_id' as x from jsonb_array_elements(v_ret -> 'pessoas_cartoes') r
          union all select r ->> 'usuario_id' from jsonb_array_elements(v_ret -> 'ajudantes_so') r
          union all select jsonb_array_elements_text(r -> 'montadores') from jsonb_array_elements(v_ret -> 'melhores') r) q;
  return v_ret || jsonb_build_object(
    'setor', jsonb_build_object('id', p_setor_id, 'nome', v_ac.o_setor_nome),
    'painel', v_painel,
    'de', v_de, 'ate', v_ate, 'faixa_pct', round(v_faixa * 100),
    'pode_decidir', v_ac.o_lider, 'pessoa_travada', not v_ac.o_lider,
    'pessoas', plt_privado.fn_tempos_pessoas(v_ids),
    'conferir_n', case when v_ac.o_lider then plt_privado.fn_tempos_conferir_n(p_setor_id, v_de, v_ate, v_ac.o_pessoa, v_tr) end);
end;
$$;

-- ABA CONFERIR
-- (recriada da versão vigente — 20261105040000_plt_tempos_producao_modo_tv.sql:1226-1343)
create or replace function public.plt_fn_tempos_conferir(
  p_setor_id bigint, p_de date, p_ate date,
  p_usuario_id uuid default null, p_trello boolean default true, p_grupo text default null,
  p_depois_fim timestamptz default null, p_depois_origem text default null, p_depois_id bigint default null,
  p_limite integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
-- SESSAO-47 (ensaio ×100): o plano é feito sob medida em TODA chamada — o plano genérico que o
-- banco passa a usar depois de 5 chamadas na mesma conexão não conhece o período nem os filtros
set plan_cache_mode = force_custom_plan
as $$
declare
  v_ac     record;
  v_tr     boolean := coalesce(p_trello, true);
  v_lim    integer := least(greatest(coalesce(p_limite, 30), 1), 100);
  v_grupos jsonb;
  v_grupo  text := p_grupo;
  v_itens  jsonb;
  v_n      integer;
  v_ids    uuid[];
  v_ordem  constant text[] := array['rapida', 'longa', 'cortado', 'clique_errado', 'retrabalho', 'sem_registro',
                                    'admin', 'lote', 'decididas'];
  v_painel jsonb := plt_privado.fn_tempos_painel();   -- SESSAO-47 (Bloco C): a configuração do painel
begin
  select * into v_ac from plt_privado.fn_tempos_acesso(p_setor_id, p_usuario_id);
  if not v_ac.o_lider then
    raise exception 'A conferência dos tempos é do líder do setor ou de um administrador.' using errcode = 'insufficient_privilege';
  end if;
  if v_grupo is not null and not (v_grupo = any (v_ordem)) then
    raise exception 'Grupo de conferência desconhecido.' using errcode = 'invalid_parameter_value';
  end if;

  with b as (
    select m.* from plt_privado.vw_tempo_montagens m
     where m.setor_id = p_setor_id and m.dia between p_de and p_ate
       and (m.origem = 'plataforma' or v_tr)
       and (v_ac.o_pessoa is null or v_ac.o_pessoa = any (m.montadores))
  )
  select jsonb_build_object(
           'rapida', count(*) filter (where b.situacao = 'conferir' and b.motivo = 'Rápida demais'),
           'longa', count(*) filter (where b.situacao = 'conferir' and b.motivo in ('Longa para o modelo', 'Acima do teto do setor')),
           'cortado', count(*) filter (where b.cortado),
           'clique_errado', count(*) filter (where b.clique_errado),
           'retrabalho', count(*) filter (where b.situacao = 'retrabalho'),
           'sem_registro', count(*) filter (where b.situacao = 'sem_registro'),
           'admin', count(*) filter (where b.situacao = 'admin'),
           'lote', count(*) filter (where b.lote),
           'decididas', count(*) filter (where b.decidida),
           'a_conferir', count(*) filter (where b.situacao = 'conferir'))
    into v_grupos
    from b;
  if v_grupo is null then
    select g into v_grupo from unnest(v_ordem) with ordinality as o(g, i)
     where (v_grupos ->> g)::int > 0 order by i limit 1;
    v_grupo := coalesce(v_grupo, 'rapida');
  end if;

  with b as (
    select m.* from plt_privado.vw_tempo_montagens m
     where m.setor_id = p_setor_id and m.dia between p_de and p_ate
       and (m.origem = 'plataforma' or v_tr)
       and (v_ac.o_pessoa is null or v_ac.o_pessoa = any (m.montadores))
       and case v_grupo
             when 'rapida' then m.situacao = 'conferir' and m.motivo = 'Rápida demais'
             when 'longa' then m.situacao = 'conferir' and m.motivo in ('Longa para o modelo', 'Acima do teto do setor')
             when 'cortado' then m.cortado
             when 'clique_errado' then m.clique_errado
             when 'retrabalho' then m.situacao = 'retrabalho'
             when 'sem_registro' then m.situacao = 'sem_registro'
             when 'admin' then m.situacao = 'admin'
             when 'lote' then m.lote
             else m.decidida
           end
       and (p_depois_fim is null or (m.fim, m.origem, m.id) < (p_depois_fim, coalesce(p_depois_origem, ''), coalesce(p_depois_id, 0)))
     order by m.fim desc, m.origem desc, m.id desc
     limit v_lim + 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'origem', b.origem, 'id', b.id, 'card_id', b.card_id, 'dia', b.dia, 'inicio', b.inicio, 'fim', b.fim,
           'movel', coalesce(nullif(btrim(c.titulo), ''), nullif(btrim(c.item_descricao), ''), t.cartao_nome),
           'pedido', coalesce(pd.numero, t.pedido_numero), 'modelo', mo.nome,
           'montadores', to_jsonb(b.montadores), 'ajudantes', to_jsonb(b.ajudantes),
           'execucao_s', round(b.execucao_s), 'padrao_s', round(pa.mediana_s),
           'situacao', b.situacao, 'motivo', b.motivo, 'lote', b.lote, 'cortado', b.cortado,
           'clique_errado', b.clique_errado, 'retrabalho', b.retrabalho, 'decidida', b.decidida,
           'decisao', case
             when b.origem = 'trello' and t.decisao is not null then jsonb_build_object(
               'decisao', t.decisao, 'motivo', t.decisao_motivo, 'quem', t.decidido_por, 'em', t.decidido_em)
             when b.origem = 'plataforma' and ev.id is not null then jsonb_build_object(
               'decisao', ev.dados ->> 'decisao', 'motivo', ev.dados ->> 'motivo', 'quem', ev.usuario_id, 'em', ev.ocorrido_em)
           end)
           order by b.fim desc, b.origem desc, b.id desc), '[]'::jsonb), count(*)
    into v_itens, v_n
    from b
    left join public.plt_cards c on b.origem = 'plataforma' and c.id = b.card_id
    left join public.pedidos pd on pd.id = c.pedido_id
    left join public.plt_tempo_trello t on b.origem = 'trello' and t.id = b.id
    left join public.plt_tempo_passagens ps on b.origem = 'plataforma' and ps.id = b.id
    left join public.plt_eventos ev on ev.id = ps.decisao_evento_id
    left join public.plt_tempo_modelos mo on mo.id = b.modelo_id
    left join plt_privado.fn_tempos_padroes(p_setor_id, v_tr) pa on pa.modelo_id = b.modelo_id;
  if v_n > v_lim then
    v_itens := v_itens - v_lim;
  end if;
  select array_agg(distinct x::uuid) into v_ids
    from (select jsonb_array_elements_text((r -> 'montadores') || (r -> 'ajudantes')) as x from jsonb_array_elements(v_itens) r
          union all select r -> 'decisao' ->> 'quem' from jsonb_array_elements(v_itens) r) q
   where x is not null;
  return jsonb_build_object(
    'setor', jsonb_build_object('id', p_setor_id, 'nome', v_ac.o_setor_nome),
    'painel', v_painel,
    'grupos', v_grupos, 'grupo', v_grupo,
    'faixa_pct', (plt_privado.fn_tempo_regra(p_setor_id)).faixa_media_pct,
    'itens', v_itens, 'tem_mais', v_n > v_lim,
    'pode_decidir', true,
    'pessoas', plt_privado.fn_tempos_pessoas(v_ids),
    'conferir_n', (v_grupos ->> 'a_conferir')::int);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4 · O MODO TV (a mesma assinatura; só LETRAS — nunca nome nem foto)
-- ----------------------------------------------------------------------------
-- MODO TV
-- (recriada da versão vigente — 20261106020000_plt_modo_tv_ao_vivo_e_dia.sql:79-216)
create or replace function public.plt_fn_modo_tv(p_setor_id bigint default null, p_dia date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
-- SESSAO-47 (ensaio ×100): o plano é feito sob medida em TODA chamada — o plano genérico que o
-- banco passa a usar depois de 5 chamadas na mesma conexão não conhece o período nem os filtros
set plan_cache_mode = force_custom_plan
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_hoje_real date := (now() at time zone 'America/Fortaleza')::date;
  -- 06/11: o dia que a TV mostra (sem p_dia, hoje — o de sempre)
  v_hoje  date := coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date);
  v_seg   date := date_trunc('week', coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date))::date;
  v_mes   date := date_trunc('month', coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date))::date;
  v_de    date;
  v_setor bigint;
  v_nome  text;
  v_u30   integer;
  v_umes  integer;
  v_ret   jsonb;
  v_painel jsonb := plt_privado.fn_tempos_painel();   -- SESSAO-47 (Bloco C): a configuração do painel (vale para a tela e para a TV)
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para abrir o Modo TV.' using errcode = 'insufficient_privilege';
  end if;
  if not (plt_privado.fn_tem_modo_tv(v_eu) or plt_privado.fn_eh_admin()) then
    raise exception 'O Modo TV é liberado por um administrador na Gestão da equipe.' using errcode = 'insufficient_privilege';
  end if;
  if v_hoje > v_hoje_real then
    raise exception 'A TV não mostra dias que ainda não chegaram.' using errcode = 'invalid_parameter_value';
  end if;
  if v_hoje < v_hoje_real - 400 then
    raise exception 'A TV volta no máximo 400 dias.' using errcode = 'invalid_parameter_value';
  end if;
  select s.id, s.nome into v_setor, v_nome
    from public.plt_setores s
   where s.papel_no_fluxo = 'producao' and s.ativo
   order by (s.id = p_setor_id) desc, ('montagem' = any (plt_privado.fn_tempo_palavras(s.nome))) desc, s.ordem, s.id
   limit 1;
  if v_setor is null then
    raise exception 'Não há setor de produção para a TV.' using errcode = 'no_data_found';
  end if;
  v_de := least(v_hoje - 29, v_mes, v_seg);
  v_u30 := plt_privado.fn_tempos_dias_uteis(v_setor, v_hoje - 29, v_hoje, true);
  v_umes := plt_privado.fn_tempos_dias_uteis(v_setor, v_mes, v_hoje, true);

  with le as (
    select e.usuario_id, e.letra, e.no_painel from public.plt_tempo_equipe e where e.setor_id = v_setor
  ),
  b0 as (
    select m.dia, m.modelo_id, m.execucao_s, m.situacao, m.montado, m.chave
      from plt_privado.vw_tempo_montagens m
     where m.setor_id = v_setor and m.dia between v_de and v_hoje
  ),
  -- as letras de cada equipe calculadas UMA vez por chave (não por móvel)
  -- SESSAO-47 (ensaio ×100): "materialized" — sem ele o banco colava esta conta dentro da junção
  -- e refazia as letras a cada móvel (a TV com a equipe do painel completa passava do teto)
  k as materialized (
    select x.chave,
           case when cardinality(x.montadores) = 0 then 'Sem montador'
                -- SESSAO-47 (Bloco C): a regra é por PESSOA — cada uma vira a letra dela ou "Outros" (quem não
                -- tem letra no setor ou está desligada do painel); a dupla com um "Outros" aparece "A + Outros"
                else (select coalesce(string_agg(y.rot, ' + ' order by (y.rot = 'Outros'), y.rot), 'Outros')
                        from (select distinct coalesce(l.letra, 'Outros') as rot
                                from unnest(x.montadores) p
                                left join le l on l.usuario_id = p and l.no_painel) y)
           end as letras,
           -- quem concorre ao "Melhor da semana" NÃO muda com o liga/desliga: a equipe inteira com letra no setor
           (cardinality(x.montadores) > 0
            and not exists (select 1 from unnest(x.montadores) p where p not in (select usuario_id from le))) as elegivel,
           case when cardinality(x.montadores) = 1 then x.montadores[1] end as sozinho
      -- SESSAO-47 (ensaio ×100): uma linha por equipe SEM ordenar todos os móveis — a lista de quem
      -- montou sai da própria chave (os ids em ordem, separados por vírgula)
      from (select b0.chave, string_to_array(b0.chave, ',')::uuid[] as montadores from b0 group by b0.chave) x
  ),
  b as (
    select b0.dia, b0.modelo_id, b0.execucao_s, b0.situacao, b0.montado, k.letras, k.sozinho, k.elegivel
      from b0 join k on k.chave = b0.chave
  ),
  num as (
    select count(*) filter (where b.montado and b.dia = v_hoje) as hoje,
           count(*) filter (where b.montado and b.dia >= v_hoje - 29) as n30,
           count(*) filter (where b.montado and b.dia >= v_mes) as mes,
           percentile_cont(0.5) within group (order by b.execucao_s) filter (where b.situacao = 'valida' and b.dia = v_hoje) as med_hoje,
           percentile_cont(0.5) within group (order by b.execucao_s) filter (where b.situacao = 'valida' and b.dia >= v_hoje - 29) as med_30,
           -- SESSAO-47: a média na mesma passada (a tela escolhe qual mostrar)
           avg(b.execucao_s) filter (where b.situacao = 'valida' and b.dia = v_hoje) as media_hoje,
           avg(b.execucao_s) filter (where b.situacao = 'valida' and b.dia >= v_hoje - 29) as media_30
      from b
  ),
  ind as (   -- a coluna dos montadores: quem montou SOZINHO, pela letra
    select le.letra,
           count(*) filter (where b.montado and b.dia = v_hoje) as hoje,
           percentile_cont(0.5) within group (order by b.execucao_s) filter (where b.situacao = 'valida' and b.dia = v_hoje) as med_hoje,
           avg(b.execucao_s) filter (where b.situacao = 'valida' and b.dia = v_hoje) as media_hoje,
           count(*) filter (where b.montado and b.dia >= v_hoje - 29) as n30,
           count(distinct b.dia) filter (where b.montado and b.dia >= v_hoje - 29) as dias30
      from b join le on le.usuario_id = b.sozinho and le.no_painel   -- SESSAO-47: o desligado sai da coluna
     where b.dia >= v_hoje - 29
     group by le.letra
  ),
  graf as (
    select b.dia, b.letras, count(*) as n from b
     where b.montado and b.dia >= v_hoje - 13 group by b.dia, b.letras
  ),
  melhor as (
    select b.letras, mo.nome as modelo, b.execucao_s, h.mediana_s
      from b
      join public.plt_tempo_padrao_historico h on h.setor_id = v_setor and h.modelo_id = b.modelo_id and h.n >= 3
      join public.plt_tempo_modelos mo on mo.id = b.modelo_id
     where b.situacao = 'valida' and b.dia >= v_seg and b.elegivel
     order by b.execucao_s / nullif(h.mediana_s, 0) asc nulls last, b.execucao_s asc
     limit 1
  )
  select jsonb_build_object(
    'setor', jsonb_build_object('id', v_setor, 'nome', v_nome),
    'setores', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) order by s.ordem, s.id)
                           from public.plt_setores s where s.papel_no_fluxo = 'producao' and s.ativo), '[]'::jsonb),
    'hoje', v_hoje,
    -- 06/11: a tela só mostra as setas de trocar o dia quando a porta sabe (esta versão)
    'pode_trocar_dia', true,
    'e_hoje', v_hoje = v_hoje_real,
    'montados_hoje', num.hoje,
    'n30', num.n30, 'dias_uteis_30', v_u30,
    'media_30', case when v_u30 > 0 then round(num.n30::numeric / v_u30, 1) end,
    'montados_mes', num.mes, 'dias_uteis_mes', v_umes,
    'media_mes', case when v_umes > 0 then round(num.mes::numeric / v_umes, 1) end,
    'tempo_medio_hoje_s', round(num.med_hoje::numeric),
    'mediana_30_s', round(num.med_30::numeric),
    'tempo_media_hoje_s', round(num.media_hoje),
    'tempo_media_30_s', round(num.media_30),
    'painel', v_painel,
    'dados_ate', (select max(m.dia) from plt_privado.vw_tempo_montagens m
                   where m.setor_id = v_setor and m.montado
                     and m.dia <= v_hoje and m.dia >= v_hoje - 400),
    'montadores', coalesce((select jsonb_agg(jsonb_build_object(
                     'letra', i.letra, 'hoje', i.hoje, 'mediana_hoje_s', round(i.med_hoje::numeric),
                     'media_hoje_s', round(i.media_hoje),
                     'ritmo', case when i.dias30 > 0 then round(i.n30::numeric / i.dias30, 1) end)
                   order by i.letra) from ind i where i.n30 > 0 or i.hoje > 0), '[]'::jsonb),
    'grafico', jsonb_build_object(
       'dias', (select jsonb_agg(jsonb_build_object(
                  'dia', d::date,
                  'total', coalesce((select sum(g.n) from graf g where g.dia = d::date), 0),
                  'partes', coalesce((select jsonb_object_agg(g.letras, g.n) from graf g where g.dia = d::date), '{}'::jsonb))
                  order by d)
                  from generate_series(v_hoje - 13, v_hoje, interval '1 day') d),
       'series', coalesce((select jsonb_agg(x.letras order by x.ordem, x.letras)
                             from (select g.letras, case when g.letras = 'Outros' then 2 when g.letras = 'Sem montador' then 3
                                                         when g.letras like '% + %' then 1 else 0 end as ordem
                                     from graf g group by g.letras) x), '[]'::jsonb)),
    'melhor_semana', (select jsonb_build_object('letras', m.letras, 'modelo', m.modelo,
                                                'tempo_s', round(m.execucao_s), 'padrao_s', round(m.mediana_s)) from melhor m))
    into v_ret
    from num;
  return v_ret;
end;
$$;

comment on function public.plt_fn_tempos_dia(bigint, date, date, date, uuid, bigint, boolean, timestamptz, text, bigint, integer) is
  'SESSAO-43 (F1 · aba Dia): os números do dia (montados, para conferir, montadores, tempo total, mediana/média, abaixo do padrão, cobertura), a linha do dia por pessoa (trechos + o expediente) e a tabela por cursor (fim, origem, id; teto 100). Com o cursor devolve só a próxima página da tabela. Admin/líder do setor tudo; o funcionário só o dele. SESSAO-47: + a chave painel (a configuração efetiva), quem está desligado do painel como "Outros" e, com a marca do padrão ligada, o padrão e o tempo do móvel em cada trecho.';
comment on function public.plt_fn_tempos_periodo(bigint, date, date, uuid, bigint, boolean) is
  'SESSAO-43 (F1 · aba Período): montados, média por dia útil (os dias de expediente do calendário que têm registro), média por dia com montagem, tempo total e mediana (válidas); móveis por dia (ou semana > 70 dias) empilhados por montador (a chave = os montadores da passagem — dupla é uma série); fila × execução × parado e o retrabalho; por montador; os 12 móveis mais montados. Até 12 meses. SESSAO-47: + a chave painel, a média por montador ao lado da mediana e quem está desligado do painel como "Outros" (as contas do setor não mudam).';
comment on function public.plt_fn_tempos_moveis(bigint, date, date, uuid, boolean, text, boolean, integer, integer) is
  'SESSAO-43 (F1 · aba Móveis): por modelo — quantidade, para conferir, melhor, mediana, faixa (P25–P75), o padrão e uma coluna por montador (as 6 pessoas que mais montaram: mediana × n). Ordenável no servidor (qtd/melhor/mediana/faixa/nome), página de até 100 (a lista é a dos modelos do período — deslocamento justificado). SESSAO-47: + a chave painel, a média ao lado da mediana (e a ordem por média) e a coluna "Outros" de quem está desligado do painel.';
comment on function public.plt_fn_tempos_modelo_passagens(bigint, bigint, date, date, uuid, boolean, boolean, timestamptz, text, bigint, integer) is
  'SESSAO-43 (F1 · Móveis, o clique na linha): as passagens de um modelo no período (ou as sem modelo), da mais recente para a mais antiga, por cursor (fim, origem, id; teto 100) — data, quem, tempo, padrão, situação, se é do Trello. SESSAO-47: quem está desligado do painel aparece como "Outros".';
comment on function public.plt_fn_tempos_montadores(bigint, date, date, uuid, bigint, boolean) is
  'SESSAO-43 (F1 · aba Montadores/Pessoas): um cartão por pessoa — móveis montados, por dia trabalhado, mediana, tempo total (o esforço dela), modelos abaixo/na média/acima do padrão, o melhor, ajudas dadas e a ocupação (tempo com card ÷ tempo no setor, do resumo por dia) — e os 8 melhores tempos contra o padrão. O funcionário vê só o dele. SESSAO-47: + a chave painel, a média ao lado da mediana e um cartão "Outros" com quem está desligado do painel.';
comment on function public.plt_fn_tempos_conferir(bigint, date, date, uuid, boolean, text, timestamptz, text, bigint, integer) is
  'SESSAO-43 (F2 · aba Conferir): os grupos (rápida demais, longa/acima do teto, cortado no fim do expediente, clique errado, retrabalho, sem registro, gesto de admin, lote, decididas) com o contador e os casos de UM grupo por cursor (fim, origem, id; teto 100), com a decisão manual já tomada. Só líder do setor ou admin. SESSAO-47: + a chave painel (a conferência segue dizendo quem montou, mesmo desligado do painel).';
comment on function public.plt_fn_modo_tv(bigint, date) is
  'SESSAO-43 (F3): o Modo TV de um setor (sem setor: a Montagem) — montados no dia, média por dia útil em 30 dias, montados no mês e por dia útil, tempo médio do dia (mediana) e dos 30 dias, a coluna dos montadores que montaram SOZINHOS (letra, no dia, mediana, ritmo), os 14 dias empilhados por letras, o melhor da semana contra o padrão e até quando há dado. SÓ LETRAS — nunca nome, foto, etiqueta. Quem tem o Modo TV ou admin. 06/11: p_dia escolhe o dia (sem ele, hoje; nada no futuro; até 400 dias atrás). SESSAO-47: + a chave painel, as médias ao lado das medianas e a regra por pessoa (a letra dela ou "Outros" — sem letra no setor ou desligada do painel).';

-- ----------------------------------------------------------------------------
-- 5 · As portas novas
-- ----------------------------------------------------------------------------
-- A ABERTURA da tela em UMA requisição (Lei §2): resolve o setor (o configurado → o
-- que o aparelho lembra → a Montagem → o primeiro), a aba e o período pela
-- configuração, e devolve na mesma resposta exatamente o que a porta daquela aba
-- devolveria (chama a própria porta por dentro — as mesmas recusas). A tela só
-- chama esta porta quando o endereço não diz aba, setor nem período.
create or replace function public.plt_fn_tempos_abertura(p_setor_lembrado bigint default null, p_hoje date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_painel jsonb := plt_privado.fn_tempos_painel();
  v_real   date := (now() at time zone 'America/Fortaleza')::date;
  -- o "hoje" do aparelho (o mesmo dia que a aba pediria); relógio muito fora = o do banco
  v_hoje   date := case when p_hoje is not null and abs(p_hoje - (now() at time zone 'America/Fortaleza')::date) <= 1
                        then p_hoje else (now() at time zone 'America/Fortaleza')::date end;
  v_abrir  text := v_painel ->> 'abrir_periodo';
  v_aba    text;
  v_per    text;
  v_de     date;
  v_setor  bigint;
  v_resp   jsonb;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para ver os tempos.' using errcode = 'insufficient_privilege';
  end if;
  if plt_privado.fn_eh_so_tv(v_eu) then
    raise exception 'Esta conta abre só o Modo TV.' using errcode = 'insufficient_privilege';
  end if;
  select s.id into v_setor
    from public.plt_setores s
   where s.papel_no_fluxo = 'producao' and s.ativo
   order by coalesce(s.id = (v_painel ->> 'abrir_setor_id')::bigint, false) desc,
            coalesce(s.id = p_setor_lembrado, false) desc,
            ('montagem' = any (plt_privado.fn_tempo_palavras(s.nome))) desc, s.ordem, s.id
   limit 1;
  v_aba := case when v_abrir in ('7', '30') then 'periodo' else 'dia' end;
  v_per := case when v_abrir in ('7', '30') then v_abrir else '30' end;
  v_de := v_hoje - (v_per::integer - 1);
  if v_setor is not null then
    if v_aba = 'periodo' then
      v_resp := public.plt_fn_tempos_periodo(v_setor, v_de, v_hoje, null, null, true);
    else
      v_resp := public.plt_fn_tempos_dia(v_setor, v_hoje, v_de, v_hoje, null, null, true, null, null, null, 50);
    end if;
  end if;
  return jsonb_build_object(
    'aba', v_aba, 'setor_id', v_setor, 'periodo', v_per,
    'dia', v_hoje, 'de', v_de, 'ate', v_hoje, 'hoje_banco', v_real,
    'painel', v_painel, 'resposta', v_resp);
end;
$$;
comment on function public.plt_fn_tempos_abertura(bigint, date) is
  'SESSAO-47 (Bloco C): a ABERTURA da tela Tempos de produção em uma requisição — o setor (configurado → o que o aparelho lembra → a Montagem → o primeiro), a aba e o período pela configuração do painel, e a resposta da porta daquela aba (a mesma, chamada por dentro — as mesmas recusas). p_hoje = o dia do aparelho (o que a aba pediria). A tela só chama quando o endereço não diz aba, setor nem período.';

-- A JANELA "Configurar painel" (só admin), lida no clique, numa requisição: a
-- configuração efetiva, o padrão, a equipe do painel de cada setor de produção
-- (letra, nome e foto — só aqui, para o admin saber quem é quem) e os blocos da TV.
create or replace function public.plt_fn_tempos_painel()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform plt_privado.fn_tempo_so_admin();
  return jsonb_build_object(
    'painel', plt_privado.fn_tempos_painel(),
    'padrao', plt_privado.fn_tempos_painel_padrao(),
    'blocos_tv', to_jsonb(array['tv_numeros', 'tv_montadores', 'tv_grafico', 'tv_melhor_semana',
                                'tv_relogio', 'tv_dados_ate', 'tv_ao_vivo']),
    'setores', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'nome', s.nome,
               'equipe', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'usuario_id', u.id, 'nome', u.nome, 'foto', u.foto_caminho,
                          'letra', e.letra, 'papel', e.papel, 'no_painel', e.no_painel)
                        order by length(e.letra), e.letra)
                   from public.plt_tempo_equipe e
                   join public.plt_usuarios u on u.id = e.usuario_id
                  where e.setor_id = s.id), '[]'::jsonb))
             order by s.ordem, s.id)
        from public.plt_setores s
       where s.ativo and s.papel_no_fluxo = 'producao'), '[]'::jsonb));
end;
$$;
comment on function public.plt_fn_tempos_painel() is
  'SESSAO-47 (Bloco C · a janela "Configurar painel"): a configuração efetiva do painel de tempos, o padrão, os blocos da TV e a equipe do painel de cada setor de produção com letra, nome, foto e o liga/desliga. Só admin. Uma requisição, no clique.';

-- O SALVAR (só admin): valida chave a chave, grava só o que mudou, numa transação;
-- p_montadores = [{setor_id, usuario_id, ligado}]. Trilha com antes/depois (ação
-- tempo_painel_alterado — Auditoria); igual ao que já está = nada gravado, nada na
-- trilha. No fim avisa os setores de produção (o canal que a tela e a TV já ouvem).
create or replace function public.plt_fn_tempos_painel_salvar(p_painel jsonb, p_montadores jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_padrao  constant jsonb := plt_privado.fn_tempos_painel_padrao();
  v_antes   jsonb;
  v_depois  jsonb;
  v_novo    jsonb;
  v_chave   text;
  v_valor   jsonb;
  v_mud_a   jsonb := '{}'::jsonb;   -- só as chaves que mudaram: como estavam
  v_mud_d   jsonb := '{}'::jsonb;   -- e como ficaram
  v_frases  text[] := '{}';         -- a mudança em língua de gente (a Auditoria mostra)
  v_mont    jsonb := '[]'::jsonb;   -- os montadores que mudaram
  v_item    jsonb;
  v_setor   bigint;
  v_pessoa  uuid;
  v_ligado  boolean;
  v_eq      record;
  v_ctx     jsonb;
begin
  perform plt_privado.fn_tempo_so_admin();
  if p_painel is not null and jsonb_typeof(p_painel) <> 'object' then
    raise exception 'Mande a configuração do painel a mudar.' using errcode = 'invalid_parameter_value';
  end if;
  if p_montadores is not null and jsonb_typeof(p_montadores) <> 'array' then
    raise exception 'Mande a lista de montadores a ligar ou desligar.' using errcode = 'invalid_parameter_value';
  end if;

  -- uma gravação por vez: a linha única da configuração é a trava
  perform 1 from public.plt_tempo_config c where c.id = 1 for update;
  v_antes := plt_privado.fn_tempos_painel();
  v_depois := v_antes;

  for v_chave, v_valor in select e.key, e.value from jsonb_each(coalesce(p_painel, '{}'::jsonb)) e loop
    if v_chave in ('grafico_periodo', 'grafico_tv') then
      if jsonb_typeof(v_valor) <> 'string' or (v_valor #>> '{}') not in ('empilhadas', 'barras', 'linhas') then
        raise exception 'O tipo de gráfico é barras empilhadas por montador, barras com o total ou linhas.'
          using errcode = 'invalid_parameter_value';
      end if;
    elsif v_chave = 'medida' then
      if jsonb_typeof(v_valor) <> 'string' or (v_valor #>> '{}') not in ('mediana', 'media') then
        raise exception 'O número do tempo médio é a mediana ou a média.' using errcode = 'invalid_parameter_value';
      end if;
    elsif v_chave = 'abrir_periodo' then
      if jsonb_typeof(v_valor) <> 'string' or (v_valor #>> '{}') not in ('hoje', '7', '30') then
        raise exception 'A tela abre em hoje, 7 dias ou 30 dias.' using errcode = 'invalid_parameter_value';
      end if;
    elsif v_chave = 'abrir_setor_id' then
      if jsonb_typeof(v_valor) <> 'null' then
        if jsonb_typeof(v_valor) <> 'number' or (v_valor #>> '{}') !~ '^[0-9]{1,18}$' then
          raise exception 'Escolha um setor de produção para a tela abrir.' using errcode = 'invalid_parameter_value';
        end if;
        if not exists (select 1 from public.plt_setores s
                        where s.id = (v_valor #>> '{}')::bigint and s.ativo and s.papel_no_fluxo = 'producao') then
          raise exception 'Escolha um setor de produção para a tela abrir.' using errcode = 'invalid_parameter_value';
        end if;
      end if;
    elsif v_chave in ('linha_padrao', 'tv_numeros', 'tv_montadores', 'tv_grafico', 'tv_melhor_semana',
                      'tv_relogio', 'tv_dados_ate', 'tv_ao_vivo') then
      if jsonb_typeof(v_valor) <> 'boolean' then
        raise exception 'Esse item da configuração só liga ou desliga.' using errcode = 'invalid_parameter_value';
      end if;
    else
      raise exception 'Esse item não existe na configuração do painel: %.', v_chave
        using errcode = 'invalid_parameter_value';
    end if;
    if (v_antes -> v_chave) is distinct from v_valor then
      v_depois := v_depois || jsonb_build_object(v_chave, v_valor);
      v_mud_a := v_mud_a || jsonb_build_object(v_chave, v_antes -> v_chave);
      v_mud_d := v_mud_d || jsonb_build_object(v_chave, v_valor);
      v_frases := array_append(v_frases, format('%s: %s → %s', plt_privado.fn_tempos_painel_rotulo(v_chave),
                    plt_privado.fn_tempos_painel_texto(v_chave, v_antes -> v_chave),
                    plt_privado.fn_tempos_painel_texto(v_chave, v_valor)));
    end if;
  end loop;

  for v_item in select m.value from jsonb_array_elements(coalesce(p_montadores, '[]'::jsonb)) m loop
    begin
      v_setor := (v_item ->> 'setor_id')::bigint;
      v_pessoa := (v_item ->> 'usuario_id')::uuid;
      v_ligado := (v_item ->> 'ligado')::boolean;
    exception when data_exception then
      raise exception 'A lista de montadores veio com um item que não vale.' using errcode = 'invalid_parameter_value';
    end;
    if v_setor is null or v_pessoa is null or v_ligado is null then
      raise exception 'A lista de montadores veio com um item incompleto.' using errcode = 'invalid_parameter_value';
    end if;
    select e.no_painel, e.letra, u.nome, s.nome as setor into v_eq
      from public.plt_tempo_equipe e
      join public.plt_usuarios u on u.id = e.usuario_id
      join public.plt_setores s on s.id = e.setor_id
     where e.setor_id = v_setor and e.usuario_id = v_pessoa
       for update of e;
    if not found then
      raise exception 'Essa pessoa não está na equipe do painel desse setor.' using errcode = 'no_data_found';
    end if;
    if v_eq.no_painel is distinct from v_ligado then
      update public.plt_tempo_equipe set no_painel = v_ligado, atualizado_em = now()
       where setor_id = v_setor and usuario_id = v_pessoa;
      v_mont := v_mont || jsonb_build_array(jsonb_build_object(
                  'setor_id', v_setor, 'usuario_id', v_pessoa, 'antes', v_eq.no_painel, 'depois', v_ligado));
      v_frases := array_append(v_frases, format('Montador %s (%s) · %s: %s → %s', v_eq.letra, v_eq.nome, v_eq.setor,
                    case when v_eq.no_painel then 'ligado' else 'desligado' end,
                    case when v_ligado then 'ligado' else 'desligado' end));
    end if;
  end loop;

  -- igual ao que já está: nada gravado, nada na trilha, nenhum aviso
  if v_mud_d = '{}'::jsonb and jsonb_array_length(v_mont) = 0 then
    return jsonb_build_object('painel', v_antes, 'mudou', false);
  end if;

  v_ctx := jsonb_build_object('o_que_mudou', to_jsonb(v_frases));
  if v_mud_d <> '{}'::jsonb then
    -- na coluna, só o que difere do padrão
    select coalesce(jsonb_object_agg(d.key, d.value), '{}'::jsonb) into v_novo
      from jsonb_each(v_depois) d
     where d.value is distinct from (v_padrao -> d.key);
    update public.plt_tempo_config
       set painel = v_novo, atualizado_em = now(), atualizado_por = plt_privado.fn_usuario_atual()
     where id = 1;
    v_ctx := v_ctx || jsonb_build_object('antes', v_mud_a, 'depois', v_mud_d);
  end if;
  if jsonb_array_length(v_mont) > 0 then
    v_ctx := v_ctx || jsonb_build_object('montadores_ids', v_mont);
  end if;
  perform plt_privado.fn_tempo_trilha('tempo_painel_alterado', v_ctx);

  -- ao vivo, sem canal novo: a tela de tempos e a TV de cada setor de produção já
  -- ouvem "mudou" no canal do setor e releem a própria porta (que traz o painel novo)
  perform plt_privado.fn_avisar('setor_' || s.id)
     from public.plt_setores s
    where s.ativo and s.papel_no_fluxo = 'producao';

  return jsonb_build_object('painel', plt_privado.fn_tempos_painel(), 'mudou', true);
end;
$$;
comment on function public.plt_fn_tempos_painel_salvar(jsonb, jsonb) is
  'SESSAO-47 (Bloco C): grava a configuração do painel de tempos (só as chaves mandadas, validadas uma a uma; na coluna fica só o que difere do padrão) e o liga/desliga dos montadores (p_montadores = [{setor_id, usuario_id, ligado}]). Só admin. Trilha tempo_painel_alterado com antes/depois; sem mudança = nada gravado. Avisa os setores de produção ao vivo.';

-- ----------------------------------------------------------------------------
-- 6 · Permissões (as portas recriadas mantêm as de antes — a assinatura não mudou)
-- ----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'plt_fn_tempos_abertura(bigint, date)',
    'plt_fn_tempos_painel()',
    'plt_fn_tempos_painel_salvar(jsonb, jsonb)',
    'plt_fn_tempos_dia(bigint, date, date, date, uuid, bigint, boolean, timestamptz, text, bigint, integer)',
    'plt_fn_tempos_periodo(bigint, date, date, uuid, bigint, boolean)',
    'plt_fn_tempos_moveis(bigint, date, date, uuid, boolean, text, boolean, integer, integer)',
    'plt_fn_tempos_modelo_passagens(bigint, bigint, date, date, uuid, boolean, boolean, timestamptz, text, bigint, integer)',
    'plt_fn_tempos_montadores(bigint, date, date, uuid, bigint, boolean)',
    'plt_fn_tempos_conferir(bigint, date, date, uuid, boolean, text, timestamptz, text, bigint, integer)',
    'plt_fn_modo_tv(bigint, date)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
