-- ============================================================================
-- SESSAO-31 · etapa D (Lei de Desempenho §2/§4/§6 — regra 18): o QUADRO DO
-- SETOR e o TABLET abrem com UMA requisição e ficam AO VIVO por websocket.
--
-- Antes: uma consulta por coluna (mais a "Chegada"), cada uma relida a cada
-- 20 s, mais as execuções (20 s), os pedidos dos cards, a tabela de pessoas
-- inteira e os valores dos campos; o tablet ainda escutava a tabela de cards
-- INTEIRA por postgres_changes (a consulta que mais pesa no banco).
--
-- Agora:
--  1. plt_fn_quadro_setor(setor, por_coluna): numa porta só — as etapas, a
--     primeira página de TODAS as colunas (peças e cards avulsos, o mais
--     antigo primeiro) com o total de cada uma, as execuções abertas, as
--     pessoas que aparecem (executor, responsáveis, quem mandou o recebimento
--     a confirmar), o resumo dos pedidos dos cards, os valores dos campos e os
--     catálogos de etiquetas e campos (dado de referência — a tela guarda).
--  2. plt_fn_quadro_coluna(setor, etapa, cursor): o "Ver mais" de UMA coluna,
--     por cursor (desde, id) — 1 requisição, só a página seguinte.
--  3. O aviso ao vivo do setor: tópico privado plt-aviso:setor_{id}, um aviso
--     por setor por transação ("mudou"), só para quem pode ver aquele quadro;
--     nasce dos fatos (o card que chegou, saiu, iniciou, pausou, ganhou
--     etiqueta…), dos campos e das etapas do setor. Nada de relógio.
--  4. Índice da coluna: (setor, etapa, desde, id) só dos cards vivos que andam
--     pelos quadros.
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O índice da coluna (a ordem do quadro: o mais antigo na etapa primeiro)
-- ----------------------------------------------------------------------------
create index if not exists plt_cards_quadro_idx
  on public.plt_cards (setor_atual_id, etapa_atual_id, (coalesce(desde, 'infinity'::timestamptz)), id)
  where arquivado_em is null and tipo in ('unidade', 'avulso');

-- ----------------------------------------------------------------------------
-- 2 · Quem vê o quadro de um setor (a mesma regra da leitura dos cards: o
--     setor, o admin, a logística)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_pode_ver_quadro(p_setor_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select plt_privado.fn_usuario_atual() is not null
     and (plt_privado.fn_eh_admin()
          or p_setor_id in (select plt_privado.fn_setores_do_usuario())
          or plt_privado.fn_pode_ver_expedicao());
$$;

-- ----------------------------------------------------------------------------
-- 3 · A página de cards (o card como o quadro mostra) e o que vem junto
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
           'ajuste_destino', c.ajuste_destino, 'criado_por_id', c.criado_por_id
         ) order by o.ord), '[]'::jsonb)
    from unnest(p_ids) with ordinality as o(id, ord)
    join public.plt_cards c on c.id = o.id;
$$;

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
    'pessoas', coalesce((
      select jsonb_object_agg(u.id, jsonb_build_object('nome', u.nome, 'foto', u.foto_caminho))
        from public.plt_usuarios u
       where u.id in (select c.executor_atual_id from public.plt_cards c where c.id = any (p_ids)
                      union select unnest(c.responsaveis) from public.plt_cards c where c.id = any (p_ids)
                      union select e.usuario_id from public.plt_cards c join public.plt_eventos e on e.id = c.parecer_pendente_id
                             where c.id = any (p_ids))), '{}'::jsonb),
    'pedidos', coalesce((
      select jsonb_object_agg(p.id, jsonb_build_object(
               'pedido_id', p.id, 'numero', p.numero, 'cliente_nome', coalesce(cl.nome, ''),
               'situacao', p.situacao, 'data_prevista', p.data_prevista,
               'entrou_pcp_em', (select min(e.ocorrido_em) from public.plt_eventos e where e.card_id = pc.id and e.tipo = 'card_criado'),
               'liberado_completo_em', pc.liberado_completo_em))
        from public.pedidos p
        left join public.clientes cl on cl.id = p.cliente_id
        left join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
       where p.id in (select c.pedido_id from public.plt_cards c where c.id = any (p_ids) and c.pedido_id is not null)), '{}'::jsonb),
    'valores', coalesce((
      select jsonb_agg(jsonb_build_object('campo_id', v.campo_id, 'card_id', v.card_id, 'valor', v.valor))
        from public.plt_campos_valores v
       where v.card_id = any (p_ids)), '[]'::jsonb)
  );
$$;

-- Uma página de uma coluna (por cursor) e o total dela — pelo índice da coluna
-- (a "Chegada" é a etapa nula: consulta própria, para o índice valer).
create or replace function plt_privado.fn_quadro_pagina(
  p_setor_id bigint, p_etapa_id bigint, p_corte_desde timestamptz, p_corte_id bigint, p_n integer)
returns bigint[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids   bigint[];
  v_corte timestamptz := coalesce(p_corte_desde, '-infinity'::timestamptz);
  v_id    bigint := coalesce(p_corte_id, 0);
begin
  if p_etapa_id is null then
    select coalesce(array_agg(x.id order by x.o, x.id), '{}') into v_ids
      from (select c.id, coalesce(c.desde, 'infinity'::timestamptz) as o
              from public.plt_cards c
             where c.setor_atual_id = p_setor_id and c.etapa_atual_id is null
               and c.arquivado_em is null and c.tipo in ('unidade', 'avulso')
               and (coalesce(c.desde, 'infinity'::timestamptz), c.id) > (v_corte, v_id)
             order by coalesce(c.desde, 'infinity'::timestamptz), c.id
             limit p_n) x;
  else
    select coalesce(array_agg(x.id order by x.o, x.id), '{}') into v_ids
      from (select c.id, coalesce(c.desde, 'infinity'::timestamptz) as o
              from public.plt_cards c
             where c.setor_atual_id = p_setor_id and c.etapa_atual_id = p_etapa_id
               and c.arquivado_em is null and c.tipo in ('unidade', 'avulso')
               and (coalesce(c.desde, 'infinity'::timestamptz), c.id) > (v_corte, v_id)
             order by coalesce(c.desde, 'infinity'::timestamptz), c.id
             limit p_n) x;
  end if;
  return v_ids;
end;
$$;

create or replace function plt_privado.fn_quadro_total(p_setor_id bigint, p_etapa_id bigint)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  if p_etapa_id is null then
    select count(*)::int into v_n from public.plt_cards c
     where c.setor_atual_id = p_setor_id and c.etapa_atual_id is null
       and c.arquivado_em is null and c.tipo in ('unidade', 'avulso');
  else
    select count(*)::int into v_n from public.plt_cards c
     where c.setor_atual_id = p_setor_id and c.etapa_atual_id = p_etapa_id
       and c.arquivado_em is null and c.tipo in ('unidade', 'avulso');
  end if;
  return v_n;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4 · A porta do quadro (1 requisição) e o "Ver mais" de uma coluna
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_quadro_setor(p_setor_id bigint, p_por_coluna integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_n       integer := least(greatest(coalesce(p_por_coluna, 10), 1), 50);
  v_colunas jsonb := '[]'::jsonb;
  v_ids     bigint[] := '{}';
  v_pagina  bigint[];
  v_total   integer;
  r         record;
begin
  if not plt_privado.fn_pode_ver_quadro(p_setor_id) then
    raise exception 'Você não vê o quadro deste setor.' using errcode = 'insufficient_privilege';
  end if;

  -- A coluna "Chegada" (sem etapa) e cada etapa ativa, na ordem do setor.
  for r in
    select null::bigint as etapa_id, -1 as ordem, 0::bigint as id
    union all
    select e.id, e.ordem, e.id from public.plt_etapas e where e.setor_id = p_setor_id and e.ativa
    order by 2, 3
  loop
    v_pagina := plt_privado.fn_quadro_pagina(p_setor_id, r.etapa_id, null, null, v_n);
    v_total := plt_privado.fn_quadro_total(p_setor_id, r.etapa_id);
    v_colunas := v_colunas || jsonb_build_array(jsonb_build_object(
                   'etapa_id', r.etapa_id, 'total', v_total, 'cards', plt_privado.fn_quadro_cards(v_pagina)));
    v_ids := v_ids || v_pagina;
  end loop;

  return jsonb_build_object(
    'setor_id', p_setor_id,
    'por_coluna', v_n,
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'setor_id', e.setor_id, 'nome', e.nome, 'ordem', e.ordem,
                                          'eh_fila', e.eh_fila, 'eh_danificado', e.eh_danificado, 'ativa', e.ativa,
                                          'setor_destino_id', e.setor_destino_id, 'conclui_producao', e.conclui_producao)
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
                          from public.plt_campos f), '[]'::jsonb)
  ) || plt_privado.fn_quadro_junto(v_ids);
end;
$$;

comment on function public.plt_fn_quadro_setor(bigint, integer) is
  'SESSAO-31 (Lei §2/§6): o quadro do setor (e o tablet) numa requisição — etapas, a 1ª página de cada coluna (peças e avulsos, o mais antigo primeiro) com o total, execuções abertas, pessoas, pedidos, valores dos campos e os catálogos de etiquetas e campos. "Ver mais" = plt_fn_quadro_coluna.';

create or replace function public.plt_fn_quadro_coluna(
  p_setor_id     bigint,
  p_etapa_id     bigint,
  p_depois_desde timestamptz,
  p_depois_id    bigint,
  p_limite       integer default 10
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
  -- desde nulo (card sem posição) vai no fim da coluna — o cursor também.
  v_corte  timestamptz := coalesce(p_depois_desde, 'infinity'::timestamptz);
begin
  if not plt_privado.fn_pode_ver_quadro(p_setor_id) then
    raise exception 'Você não vê o quadro deste setor.' using errcode = 'insufficient_privilege';
  end if;
  v_pagina := plt_privado.fn_quadro_pagina(p_setor_id, p_etapa_id, v_corte, p_depois_id, v_n);
  return jsonb_build_object('etapa_id', p_etapa_id, 'cards', plt_privado.fn_quadro_cards(v_pagina))
         || plt_privado.fn_quadro_junto(v_pagina);
end;
$$;

comment on function public.plt_fn_quadro_coluna(bigint, bigint, timestamptz, bigint, integer) is
  'SESSAO-31 (Lei §6): o "Ver mais" de uma coluna do quadro, por cursor (desde, id) — só a página seguinte, com as pessoas, pedidos, execuções e valores dela.';

-- ----------------------------------------------------------------------------
-- 5 · O aviso ao vivo do setor
-- ----------------------------------------------------------------------------
-- Quem ouve (recriada POR INTEIRO a partir da migration 61): + o quadro de cada setor.
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
           else false
         end;
$$;

-- Os fatos dizem o que mudou (recriada POR INTEIRO a partir da migration 61):
-- + o setor de cada card tocado (de onde saiu, para onde foi, onde está).
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
  return null;
end;
$$;

-- As etapas do setor mudaram (o admin em Setores e etapas) → o quadro relê.
create or replace function plt_privado.fn_avisar_etapas()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform plt_privado.fn_avisar_setor(coalesce(new.setor_id, old.setor_id));
  if tg_op = 'UPDATE' and new.setor_id is distinct from old.setor_id then
    perform plt_privado.fn_avisar_setor(old.setor_id);
  end if;
  return null;
end;
$$;

drop trigger if exists plt_etapas_avisar on public.plt_etapas;
create trigger plt_etapas_avisar
  after insert or update or delete on public.plt_etapas
  for each row execute function plt_privado.fn_avisar_etapas();

-- ----------------------------------------------------------------------------
-- 6 · Quem chama o quê
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_pode_ver_quadro(bigint)  from public, anon;
-- a regra do Realtime chama como quem está logado (como fn_aviso_pode_ouvir)
grant execute on function plt_privado.fn_pode_ver_quadro(bigint) to authenticated;
revoke all on function plt_privado.fn_quadro_cards(bigint[])   from public, anon, authenticated;
revoke all on function plt_privado.fn_quadro_pagina(bigint, bigint, timestamptz, bigint, integer) from public, anon, authenticated;
revoke all on function plt_privado.fn_quadro_total(bigint, bigint) from public, anon, authenticated;
revoke all on function plt_privado.fn_quadro_junto(bigint[])   from public, anon, authenticated;
revoke all on function plt_privado.fn_avisar_etapas()          from public, anon, authenticated;
revoke all on function public.plt_fn_quadro_setor(bigint, integer)                              from public, anon;
revoke all on function public.plt_fn_quadro_coluna(bigint, bigint, timestamptz, bigint, integer) from public, anon;
grant execute on function public.plt_fn_quadro_setor(bigint, integer)                              to authenticated;
grant execute on function public.plt_fn_quadro_coluna(bigint, bigint, timestamptz, bigint, integer) to authenticated;
