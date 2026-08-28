-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 13 — LEITURA DE PEDIDOS PARA O KANBAN
-- Sessão: SESSAO-04 · Data: 2026-08-27
--
-- As tabelas da integração (`pedidos`, `pedido_itens`, `clientes`) têm RLS
-- ligado e ZERO policies — o navegador não lê NADA delas, de propósito.
-- O kanban precisa de um pedaço pequeno dessa informação: número do pedido,
-- nome do cliente, itens (para a liberação em unidades) e o reagrupamento.
--
-- A escolha aqui é NÃO criar policy nas tabelas da integração (não mexemos
-- nelas nem no acesso direto a elas) e sim expor FUNÇÕES enxutas:
--
--   · plt_fn_pedidos_kanban        → lista/busca pedidos (resumo, paginado)
--   · plt_fn_pedido_itens_kanban   → itens de UM pedido, já em unidades (k/n)
--   · plt_fn_expedicao_kanban      → reagrupamento por pedido (D-01/D-13)
--   · plt_fn_pedido_unidades       → onde está cada unidade de UM pedido
--
-- ⚠️ E-11 (memória de aprendizado): função em `public` VIRA endpoint REST.
-- Aqui isso é INTENCIONAL — estas quatro são a porta de leitura do kanban.
-- Por isso: security definer com `search_path` fixo, execute revogado de
-- public/anon, grant só para authenticated, e TODA função confere se quem
-- chama é usuário ATIVO da plataforma (gate dentro da própria função).
--
-- O que NUNCA sai por aqui: endereço, CPF/CNPJ, telefone, e-mail, valores e
-- raw do pedido — nada disso é assunto do kanban.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · Resumo de pedidos — a lista do PCP ("criar card" e cabeçalho dos cards)
--
-- `p_ids` serve para as telas resolverem número/cliente dos cards já criados;
-- `p_somente_sem_card` serve para o modal "Novo card" listar só o que ainda
-- não entrou no kanban. Paginação obrigatória (RNF-02): limite máximo 100.
--
-- A conta de unidades replica o comportamento REAL da automação do PCP no n8n
-- (A-01 / F-05): quantidade arredondada; item com quantidade < 1 não vira card.
-- ----------------------------------------------------------------------------
-- E-17 aplicado a função: a migration 17 muda a FORMA do retorno — sem o drop,
-- a segunda rodada quebraria em "cannot change return type".
drop function if exists public.plt_fn_pedidos_kanban(text, boolean, bigint[], integer, integer);

create or replace function public.plt_fn_pedidos_kanban(
  p_busca            text     default null,
  p_somente_sem_card boolean  default false,
  p_ids              bigint[] default null,
  p_limite           integer  default 20,
  p_deslocamento     integer  default 0
)
returns table (
  pedido_id       bigint,
  numero          integer,
  cliente_nome    text,
  data_pedido     date,
  data_prevista   date,
  situacao        text,
  total_itens     integer,
  total_unidades  integer,
  tem_card        boolean,
  unidades_liberadas integer,
  contagem_total  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id                                as pedido_id,
         p.numero,
         coalesce(c.nome, '')                as cliente_nome,
         p.data_pedido,
         p.data_prevista,
         p.situacao,
         coalesce(i.total_itens, 0)          as total_itens,
         coalesce(i.total_unidades, 0)       as total_unidades,
         (pc.id is not null)                 as tem_card,
         coalesce(u.liberadas, 0)            as unidades_liberadas,
         count(*) over ()                    as contagem_total
    from public.pedidos p
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      select count(*)::int as total_itens,
             coalesce(sum(case when round(pi.quantidade) >= 1
                               then round(pi.quantidade)::int else 0 end), 0)::int
               as total_unidades
        from public.pedido_itens pi
       where pi.pedido_id = p.id
    ) i on true
    left join lateral (
      -- O RLS esconde do PCP as unidades que já viajaram para outros setores;
      -- a contagem sai daqui para o quadro saber o que ainda falta liberar.
      select count(*)::int as liberadas
        from public.plt_cards cu
       where cu.pedido_id = p.id and cu.tipo = 'unidade'
    ) u on true
    left join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
   where plt_privado.fn_usuario_atual() is not null
     and (p_ids is null or p.id = any (p_ids))
     and (not coalesce(p_somente_sem_card, false) or pc.id is null)
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%')
   order by p.data_pedido desc nulls last, p.numero desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_pedidos_kanban(text, boolean, bigint[], integer, integer) is
  'Porta de leitura do kanban (SESSAO-04): resumo de pedidos sem dado pessoal do cliente. Endpoint REST de propósito — gate por usuário ativo da plataforma.';

-- ----------------------------------------------------------------------------
-- 2 · Itens de um pedido, já traduzidos em unidades
--
-- É daqui que o modal de liberação monta os cards (k/n): n = unidades daquele
-- item (quantidade arredondada), k = 1..n — exatamente como o n8n faz hoje no
-- ClickUp. Item com quantidade < 1 não aparece (não vira card).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pedido_itens_kanban(p_pedido_id bigint)
returns table (
  seq        integer,
  codigo     text,
  descricao  text,
  unidades   integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pi.seq,
         pi.codigo,
         pi.descricao,
         round(pi.quantidade)::int as unidades
    from public.pedido_itens pi
   where plt_privado.fn_usuario_atual() is not null
     and pi.pedido_id = p_pedido_id
     and round(pi.quantidade) >= 1
   order by pi.seq;
$$;

comment on function public.plt_fn_pedido_itens_kanban(bigint) is
  'Itens de um pedido em unidades (k/n) para a liberação no PCP (D-01). Replica a regra real do n8n: quantidade arredondada, < 1 não vira card.';

-- ----------------------------------------------------------------------------
-- 3 · Quem pode ver o reagrupamento (expedição)
--
-- O RLS de plt_cards mostra a cada um só os setores dele — certo para os
-- quadros, mas a visão de expedição precisa enxergar o pedido INTEIRO.
-- Quem tem esse direito: admin, e quem trabalha na entrada (PCP — que é
-- também a logística, D-22) ou num terminal (ESTOQUE/ROTAS, D-13).
-- Helper no schema privado: maquinaria, não endpoint (E-11).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_pode_ver_expedicao()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select plt_privado.fn_eh_admin()
      or exists (
           select 1
             from public.plt_usuario_setores us
             join public.plt_usuarios u on u.id = us.usuario_id
             join public.plt_setores s on s.id = us.setor_id
            where u.auth_user_id = auth.uid()
              and u.ativo
              and s.papel_no_fluxo in ('entrada', 'terminal')
         );
$$;

comment on function plt_privado.fn_pode_ver_expedicao() is
  'Expedição/reagrupamento (D-01): admin, gente da entrada (PCP = logística, D-22) e dos terminais.';

-- ----------------------------------------------------------------------------
-- 4 · Reagrupamento por pedido (D-01 / D-13)
--
-- "Pedido completo = todas as unidades prontas": compara as unidades do pedido
-- (dos itens) com o que já chegou aos setores terminais.
-- ----------------------------------------------------------------------------
-- E-17 aplicado a função (ver acima): a migration 17 muda a forma do retorno.
drop function if exists public.plt_fn_expedicao_kanban(text, integer, integer);

create or replace function public.plt_fn_expedicao_kanban(
  p_busca         text    default null,
  p_limite        integer default 20,
  p_deslocamento  integer default 0
)
returns table (
  pedido_id            bigint,
  numero               integer,
  cliente_nome         text,
  data_prevista        date,
  total_unidades       integer,
  unidades_liberadas   integer,
  unidades_no_terminal integer,
  contagem_total       bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id                          as pedido_id,
         p.numero,
         coalesce(c.nome, '')          as cliente_nome,
         p.data_prevista,
         coalesce(i.total_unidades, 0) as total_unidades,
         coalesce(u.liberadas, 0)      as unidades_liberadas,
         coalesce(u.no_terminal, 0)    as unidades_no_terminal,
         count(*) over ()              as contagem_total
    from public.pedidos p
    join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      select coalesce(sum(case when round(pi.quantidade) >= 1
                               then round(pi.quantidade)::int else 0 end), 0)::int
               as total_unidades
        from public.pedido_itens pi
       where pi.pedido_id = p.id
    ) i on true
    left join lateral (
      select count(*)::int as liberadas,
             count(*) filter (where cu.concluido_em is not null)::int as no_terminal
        from public.plt_cards cu
       where cu.pedido_id = p.id and cu.tipo = 'unidade'
    ) u on true
   where plt_privado.fn_pode_ver_expedicao()
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%')
   order by p.data_prevista asc nulls last, p.numero desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_expedicao_kanban(text, integer, integer) is
  'Reagrupamento do pedido (D-01/D-13): unidades liberadas e chegadas ao fim de linha, por pedido. Acesso: admin, entrada (PCP) e terminais.';

-- ----------------------------------------------------------------------------
-- 5 · Onde está cada unidade de um pedido (o detalhe da expedição)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pedido_unidades(p_pedido_id bigint)
returns table (
  card_id         bigint,
  item_seq        integer,
  item_codigo     text,
  item_descricao  text,
  indice_unidade  integer,
  total_unidades  integer,
  setor_id        bigint,
  setor_nome      text,
  setor_terminal  boolean,
  etapa_nome      text,
  desde           timestamptz,
  concluido_em    timestamptz,
  qualidade_atual text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cu.id            as card_id,
         cu.item_seq,
         cu.item_codigo,
         cu.item_descricao,
         cu.indice_unidade,
         cu.total_unidades,
         s.id             as setor_id,
         s.nome           as setor_nome,
         (s.papel_no_fluxo = 'terminal') as setor_terminal,
         e.nome           as etapa_nome,
         cu.desde,
         cu.concluido_em,
         cu.qualidade_atual
    from public.plt_cards cu
    left join public.plt_setores s on s.id = cu.setor_atual_id
    left join public.plt_etapas  e on e.id = cu.etapa_atual_id
   where plt_privado.fn_pode_ver_expedicao()
     and cu.pedido_id = p_pedido_id
     and cu.tipo = 'unidade'
   order by cu.item_seq, cu.indice_unidade;
$$;

comment on function public.plt_fn_pedido_unidades(bigint) is
  'Detalhe do reagrupamento: em que setor/etapa está cada unidade do pedido. Acesso: admin, entrada (PCP) e terminais.';

-- ----------------------------------------------------------------------------
-- 6 · Quem pode executar o quê (E-11: nada exposto além do combinado)
-- ----------------------------------------------------------------------------
revoke all on function public.plt_fn_pedidos_kanban(text, boolean, bigint[], integer, integer) from public, anon;
revoke all on function public.plt_fn_pedido_itens_kanban(bigint)                               from public, anon;
revoke all on function public.plt_fn_expedicao_kanban(text, integer, integer)                  from public, anon;
revoke all on function public.plt_fn_pedido_unidades(bigint)                                   from public, anon;
revoke all on function plt_privado.fn_pode_ver_expedicao()                                     from public, anon;

grant execute on function public.plt_fn_pedidos_kanban(text, boolean, bigint[], integer, integer) to authenticated;
grant execute on function public.plt_fn_pedido_itens_kanban(bigint)                               to authenticated;
grant execute on function public.plt_fn_expedicao_kanban(text, integer, integer)                  to authenticated;
grant execute on function public.plt_fn_pedido_unidades(bigint)                                   to authenticated;
grant execute on function plt_privado.fn_pode_ver_expedicao()                                     to authenticated;
