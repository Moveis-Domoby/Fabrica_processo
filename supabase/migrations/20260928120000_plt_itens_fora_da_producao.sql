-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 39 — FRETE FORA DA PRODUÇÃO
-- Ajuste (achado da SESSAO-24: um card "Frete" (1/1) do 13215 na LIMPEZA E
-- EMBALAGEM) · Data: 2026-09-28 · Decisão: D-63 (respostas do dono em 28/09)
--
--   1. "Quais itens NÃO devem virar card de produção?" → "Frete / entrega".
--      A regra mora num lugar só: a VIEW plt_privado.vw_itens_producao — o
--      item é frete pela 1ª palavra da descrição (calibrada nas grafias reais:
--      "Frete", "Frete cliente", "Entrega") e diz quantas unidades de produção
--      ele vira. Toda porta que contava `round(quantidade) >= 1` soma da view.
--      Por que VIEW e não função (E-65): função com `set search_path` (regra
--      da casa) nunca é embutida pelo planner — chamada item a item, deixou a
--      aba do aguardo 45× mais lenta no ensaio no banco real. A view é
--      embutida na consulta: custo de expressão, não de chamada.
--   2. Todo o resto — cadeira, lâmpada, acessório — "sempre nasce no PCP do
--      jeito que está e o PCP define o local correto": nada muda (o PCP já
--      manda a unidade direto para Pedidos em aguardo na liberação).
--   3. Pedido sem NADA a produzir (só frete — 0 em 5.410 pedidos até 28/09):
--      "direto p/ Pedidos em aguardo" — sai do quadro do PCP e aparece no
--      aguardo já completo, para a logística lançar para ROTAS. Decidido NA
--      LEITURA (fn_pedidos_sem_producao), sem nada gravado: se o Tiny
--      acrescentar um móvel, o pedido volta sozinho ao quadro do PCP.
--   4. Trava para todo escritor (M-14): gatilho recusa card de unidade de
--      frete (tela, API ou script). Card antigo não é tocado — o do 13215 sai
--      por manutenção (supabase/manutencao/2026-09-28_arquivar_cards_de_frete.sql).
--
-- Recriadas a partir da versão mais nova de cada uma (E-24), trocando SÓ a
-- contagem (e, onde dito, o pedido sem nada a produzir):
--   13 plt_fn_pedido_itens_kanban · 19 plt_fn_expedicao_kanban ·
--   25 plt_fn_lancar_rotas, plt_fn_registrar_entrega, plt_fn_rotas,
--      plt_fn_programacao · 28 plt_fn_dash_pcp_dia ·
--   29 fn_recalcular_liberacao, plt_fn_pedidos_kanban ·
--   37 plt_fn_sugestoes_alocacao, plt_fn_alocar_peca, plt_fn_pedidos_aguardo,
--      plt_fn_produtos_reservados, plt_fn_aguardo_contagens,
--      plt_fn_cards_pedido_pcp, plt_fn_pedidos_cancelados, plt_fn_dash_dia.
-- A forma de retorno de todas continua a mesma (create or replace basta — o
-- E-17 não se aplica). Nenhuma porta nova em `public` (advisors sem WARN novo).
--
-- Nada aqui altera as tabelas da integração (clientes, pedidos, pedido_itens,
-- eventos, gp_pcp_processados, produtos).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · A regra única: o item do pedido é frete? Quantas unidades ele vira?
-- ----------------------------------------------------------------------------

-- Frete/entrega pela PRIMEIRA palavra da descrição, em minúsculas: o que vem
-- antes dela (espaço, pontuação) não conta, e a palavra tem que terminar ali
-- ("Entregador" não é "Entrega"). Letra acentuada conta como letra, sem
-- depender do idioma do servidor. Palavra solta no meio do texto NÃO conta:
-- "Painel … (LED e instalação não inclusos)" e "Penteadeira … sem a parte de
-- instalação das lâmpadas" são móveis — o levantamento de 28/09 (A-31).
-- Uma regex ANCORADA no começo: desiste no 1º caractere quase sempre (E-65).
-- Unidades (D-01 + D-63): frete, nenhuma; o resto, a regra real do n8n —
-- quantidade arredondada, abaixo de 1 não vira card.
-- security_invoker: quem lê é quem chama (as portas, donas do dado).
create or replace view plt_privado.vw_itens_producao
with (security_invoker = on) as
  select pi.pedido_id,
         pi.seq,
         pi.codigo,
         pi.descricao,
         pi.quantidade,
         f.eh_frete,
         case when f.eh_frete then 0
              when round(coalesce(pi.quantidade, 0)) >= 1 then round(pi.quantidade)::int
              else 0
         end as unidades
    from public.pedido_itens pi
    cross join lateral (
      select lower(coalesce(pi.descricao, ''))
               ~ '^[^a-z0-9áàâãäéèêëíìîïóòôõöúùûüç]*(frete|entrega)([^a-z0-9áàâãäéèêëíìîïóòôõöúùûüç]|$)'
               as eh_frete
    ) f;

comment on view plt_privado.vw_itens_producao is
  'D-63: a regra ÚNICA de unidade de produção por item do pedido — eh_frete (1ª palavra da descrição: frete/entrega) e unidades (frete = 0; o resto = quantidade arredondada, < 1 = 0). Toda porta que conta unidades soma daqui.';

-- O total de unidades de produção do pedido, para quem precisa de UM número
-- num gesto (lançar, entregar, recalcular a liberação). Porta que varre muitos
-- pedidos soma direto da view (embutida) — nunca chama isto por linha (E-65).
create or replace function plt_privado.fn_unidades_do_pedido(p_pedido_id bigint)
returns integer
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(sum(v.unidades), 0)::int
    from plt_privado.vw_itens_producao v
   where v.pedido_id = p_pedido_id;
$$;

comment on function plt_privado.fn_unidades_do_pedido(bigint) is
  'D-63: total de unidades de produção de UM pedido (soma de vw_itens_producao) — para gestos (lançar, entregar, recalcular). Porta que varre muitos pedidos soma da view.';

-- ----------------------------------------------------------------------------
-- 2 · Pedido sem nada a produzir (só frete) — a base do "direto para Pedidos
--     em aguardo" (resposta 4 do dono). Decidido NA LEITURA: nada é gravado
--     (M-13); se o Tiny acrescentar um móvel, a view passa a ter unidade e o
--     pedido volta sozinho ao quadro do PCP (plt_fn_cards_pedido_pcp).
--     Pedido sem unidade nunca fica "liberado por completo" (a regra de
--     fn_recalcular_liberacao exige total > 0) — daí o filtro pelo índice
--     parcial plt_cards_pcp_abertos_idx. O barato vai primeiro (E-65): só os
--     sem unidade (quase nunca há) chegam à situação do Tiny.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_pedidos_sem_producao()
returns table (
  card_pedido_id bigint,
  pedido_id      bigint,
  desde          timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with sem_unidade as materialized (
    select pc.id, pc.pedido_id, pc.criado_em
      from public.plt_cards pc
     where pc.tipo = 'pedido'
       and pc.arquivado_em is null
       and pc.liberado_completo_em is null
       and pc.lancado_rotas_em is null
       and not exists (select 1 from plt_privado.vw_itens_producao v
                        where v.pedido_id = pc.pedido_id and v.unidades > 0)
  )
  select s.id, s.pedido_id, s.criado_em
    from sem_unidade s
    join public.pedidos p on p.id = s.pedido_id
   where plt_privado.fn_situacao_normalizada(p.situacao) not in ('entregue', 'nao_entregue', 'cancelado')
     and not exists (select 1 from public.plt_cards u
                      where u.pedido_id = s.pedido_id and u.tipo = 'unidade'
                        and u.arquivado_em is null);
$$;

comment on function plt_privado.fn_pedidos_sem_producao() is
  'D-63: pedidos vivos, não lançados e não encerrados no Tiny que não têm NADA a produzir (só frete) — completos desde que nasceram; o aguardo os mostra e o quadro do PCP não.';

-- ----------------------------------------------------------------------------
-- 3 · Frete não vira card — para todo escritor (M-14). A liberação do PCP já
--     não oferece o item; a trava pega API, script e o que vier — pelo ITEM do
--     pedido (a fonte da verdade), não pela descrição que o card traz. Só no
--     INSERT: card antigo não é tocado (o do 13215 sai por manutenção).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_unidade_de_producao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo <> 'unidade' or new.pedido_id is null or new.item_seq is null then
    return new;
  end if;
  if exists (select 1 from plt_privado.vw_itens_producao v
              where v.pedido_id = new.pedido_id and v.seq = new.item_seq and v.eh_frete) then
    raise exception 'Frete não vira card de produção — o pedido fica completo sem ele.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function plt_privado.fn_validar_unidade_de_producao() is
  'D-63: recusa card de UNIDADE cujo item do pedido é frete/entrega (vw_itens_producao) — vale para tela, API e script (M-14).';

drop trigger if exists plt_cards_validar_unidade_de_producao on public.plt_cards;
create trigger plt_cards_validar_unidade_de_producao
  before insert on public.plt_cards
  for each row execute function plt_privado.fn_validar_unidade_de_producao();

-- ----------------------------------------------------------------------------
-- 4 · PCP: os itens a liberar e o resumo dos pedidos (13 e 29)
-- ----------------------------------------------------------------------------

-- Itens de um pedido, já em unidades (k/n): o frete não aparece para liberar.
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
  select v.seq,
         v.codigo,
         v.descricao,
         v.unidades
    from plt_privado.vw_itens_producao v
   where plt_privado.fn_usuario_atual() is not null
     and v.pedido_id = p_pedido_id
     and v.unidades >= 1
   order by v.seq;
$$;

comment on function public.plt_fn_pedido_itens_kanban(bigint) is
  'Itens de um pedido em unidades (k/n) para a liberação no PCP (D-01). Quantidade arredondada, < 1 não vira card; frete/entrega não vira card (D-63 — vw_itens_producao).';

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
  alterado_apos_liberacao boolean,
  entrou_pcp_em   timestamptz,
  liberado_completo_em timestamptz,
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
         -- SESSAO-09: o Tiny mudou o pedido DEPOIS de unidades irem à produção.
         exists (select 1 from public.plt_eventos e
                  where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                             as alterado_apos_liberacao,
         -- SESSAO-22 (D-48): o tempo em PCP é do pedido — entrada → liberação completa.
         ev.entrou_pcp_em,
         pc.liberado_completo_em,
         count(*) over ()                    as contagem_total
    from public.pedidos p
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      -- D-63: o frete não conta como unidade (vw_itens_producao).
      select count(*)::int as total_itens,
             coalesce(sum(v.unidades), 0)::int as total_unidades
        from plt_privado.vw_itens_producao v
       where v.pedido_id = p.id
    ) i on true
    left join lateral (
      -- D-63: card de frete nascido antes da regra não conta como liberado.
      select count(*)::int as liberadas
        from public.plt_cards cu
       where cu.pedido_id = p.id and cu.tipo = 'unidade'
         and not exists (select 1 from plt_privado.vw_itens_producao v
                          where v.pedido_id = cu.pedido_id and v.seq = cu.item_seq and v.eh_frete)
    ) u on true
    left join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
    left join lateral (
      select min(e.ocorrido_em) as entrou_pcp_em
        from public.plt_eventos e
       where e.card_id = pc.id and e.tipo = 'card_criado'
    ) ev on true
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

-- ----------------------------------------------------------------------------
-- 5 · Liberação completa (29): o fim do tempo em PCP conta só unidade de
--     produção. Pedido sem nada a produzir continua sem data aqui — quem o
--     tira do quadro do PCP é a leitura (seção 2), que se desfaz sozinha se o
--     Tiny acrescentar um móvel.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_recalcular_liberacao(p_pedido_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total     integer;
  v_liberadas integer;
  v_quando    timestamptz;
begin
  -- Total de unidades de produção (D-63): a mesma regra de
  -- plt_fn_pedido_itens_kanban — frete não conta.
  v_total := plt_privado.fn_unidades_do_pedido(p_pedido_id);

  -- D-63: card de frete nascido antes da regra não conta como liberado —
  -- senão ele "completaria" o pedido com um móvel ainda no PCP.
  select count(*)::int into v_liberadas
    from public.plt_cards cu
   where cu.pedido_id = p_pedido_id and cu.tipo = 'unidade'
     and not exists (select 1 from plt_privado.vw_itens_producao v
                      where v.pedido_id = cu.pedido_id and v.seq = cu.item_seq and v.eh_frete);

  if v_total > 0 and v_liberadas >= v_total then
    -- O instante da liberação da ÚLTIMA unidade (D-48: fim do tempo em PCP).
    select max(e.ocorrido_em) into v_quando
      from public.plt_eventos e
      join public.plt_cards cu
        on cu.id = e.card_id and cu.tipo = 'unidade' and cu.pedido_id = p_pedido_id
     where e.tipo = 'card_criado';
  else
    v_quando := null;
  end if;

  update public.plt_cards
     set liberado_completo_em = v_quando
   where pedido_id = p_pedido_id and tipo = 'pedido'
     and liberado_completo_em is distinct from v_quando;
end;
$$;

comment on function plt_privado.fn_recalcular_liberacao(bigint) is
  'SESSAO-22 (D-48): recalcula liberado_completo_em do card de pedido — derivado dos eventos e dos itens (regra k/n; frete não conta — D-63). Chamada pela projeção; nunca por mão humana.';

-- ----------------------------------------------------------------------------
-- 6 · O quadro do PCP (37): pedido sem nada a produzir não espera liberação
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_cards_pedido_pcp(
  p_limite       integer default 10,
  p_deslocamento integer default 0
)
returns table (
  id bigint,
  tipo text,
  pedido_id bigint,
  card_pai_id bigint,
  item_seq integer,
  item_codigo text,
  item_descricao text,
  indice_unidade integer,
  total_unidades integer,
  setor_atual_id bigint,
  etapa_atual_id bigint,
  desde timestamptz,
  executor_atual_id uuid,
  responsavel_id uuid,
  delegado_em timestamptz,
  qualidade_atual text,
  concluido_em timestamptz,
  pausado_em timestamptz,
  liberado_completo_em timestamptz,
  contagem_total bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.tipo, c.pedido_id, c.card_pai_id, c.item_seq, c.item_codigo,
         c.item_descricao, c.indice_unidade, c.total_unidades, c.setor_atual_id,
         c.etapa_atual_id, c.desde, c.executor_atual_id, c.responsavel_id,
         c.delegado_em, c.qualidade_atual, c.concluido_em, c.pausado_em,
         c.liberado_completo_em,
         count(*) over ()::bigint as contagem_total
    from public.plt_cards c
    join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'entrada'
    left join public.pedidos p on p.id = c.pedido_id
   where plt_privado.fn_usuario_atual() is not null
     and (
       plt_privado.fn_eh_admin()
       or c.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
     )
     and c.tipo in ('pedido', 'reposicao')
     and c.arquivado_em is null
     and c.liberado_completo_em is null
     -- Pedido encerrado no Tiny sai do quadro (S23); CANCELADO vai para a aba
     -- Cancelados (S24). A reposição não tem pedido: fica até ser liberada
     -- por inteiro ou arquivada.
     and (c.tipo = 'reposicao'
          or (p.id is not null
              and plt_privado.fn_situacao_normalizada(p.situacao)
                  not in ('entregue', 'nao_entregue', 'cancelado')
              -- D-63: sem nada a produzir (só frete), o pedido não espera
              -- liberação — vai direto para Pedidos em aguardo.
              and exists (select 1 from plt_privado.vw_itens_producao v
                           where v.pedido_id = p.id and v.unidades > 0)))
   order by c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 10), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_cards_pedido_pcp(integer, integer) is
  'O quadro do PCP (S23, S25; S24: sem os cancelados, que têm aba própria; D-63: sem o pedido que não tem nada a produzir): pedidos abertos e não encerrados no Tiny e os cards de REPOSIÇÃO ainda não liberados por inteiro, paginados com o total na mesma consulta (regra 17). Gate: admin ou gente do setor de entrada.';

-- ----------------------------------------------------------------------------
-- 7 · Sugestão do estoque e alocação (37): a vaga é unidade de produção
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_sugestoes_alocacao(p_card_id bigint)
returns table (
  item_seq           integer,
  indice_unidade     integer,
  total_unidades     integer,
  peca_card_id       bigint,
  peca_origem        text,
  peca_origem_numero integer,
  pecas_iguais       integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with alvo as (
    select pc.id, pc.pedido_id
      from public.plt_cards pc
     where pc.id = p_card_id
       and pc.tipo = 'pedido'
       and pc.arquivado_em is null
       and pc.lancado_rotas_em is null
       and plt_privado.fn_pode_ver_expedicao()
       and not plt_privado.fn_pedido_cancelado(pc.pedido_id)
  ),
  itens as (
    -- D-63: frete não é vaga (vw_itens_producao: unidades = 0).
    select v.seq, v.unidades as n,
           plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(v.codigo, v.descricao),
                                     v.codigo, v.descricao) as chave
      from plt_privado.vw_itens_producao v
      join alvo a on a.pedido_id = v.pedido_id
     where v.unidades >= 1
  ),
  vagas as (
    select i.seq, k.k, i.n, i.chave,
           row_number() over (partition by i.chave order by i.seq, k.k) as ordem
      from itens i
      cross join lateral generate_series(1, i.n) as k(k)
     where not exists (
       select 1 from public.plt_cards u, alvo a
        where u.pedido_id = a.pedido_id and u.tipo = 'unidade'
          and u.item_seq = i.seq and u.indice_unidade = k.k)
  ),
  livres as (
    select c.id, c.desde, c.card_pai_id,
           plt_privado.fn_chave_peca(c.produto_tiny_id, c.item_codigo, c.item_descricao) as chave
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
     where exists (select 1 from alvo)
       and c.tipo = 'unidade'
       and c.pedido_id is null
       and c.arquivado_em is null
       and coalesce(c.qualidade_atual, 'perfeito') = 'perfeito'
  ),
  pecas as (
    select l.*,
           row_number() over (partition by l.chave order by l.desde, l.id) as ordem,
           count(*) over (partition by l.chave)                             as iguais
      from livres l
  )
  select v.seq,
         v.k,
         v.n,
         p.id,
         case when pai.tipo = 'reposicao' then 'reposicao' else 'cancelamento' end,
         case when pai.tipo = 'pedido' then ped.numero end,
         p.iguais::int
    from vagas v
    join pecas p on p.chave = v.chave and p.ordem = v.ordem
    left join public.plt_cards pai on pai.id = p.card_pai_id
    left join public.pedidos ped on ped.id = pai.pedido_id
   order by v.seq, v.k;
$$;

create or replace function public.plt_fn_alocar_peca(
  p_card_pedido_id bigint,
  p_item_seq       integer,
  p_indice_unidade integer,
  p_peca_card_id   bigint
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_pc       public.plt_cards%rowtype;
  v_peca     public.plt_cards%rowtype;
  v_codigo   text;
  v_descricao text;
  v_n        integer;
  v_estoque  bigint;
  v_aguardo  bigint;
  v_numero   integer;
  v_origem   text;
  v_novo     bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma usa peça do estoque.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Usar peça do estoque num pedido é gesto do PCP/logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_pc from public.plt_cards
   where id = p_card_pedido_id and tipo = 'pedido' and arquivado_em is null
   for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_pedido_id using errcode = 'no_data_found';
  end if;
  if v_pc.lancado_rotas_em is not null then
    raise exception 'Este pedido já foi lançado para ROTAS.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_pedido_cancelado(v_pc.pedido_id) then
    raise exception 'O pedido foi cancelado no Tiny — não recebe peça do estoque.' using errcode = 'check_violation';
  end if;

  -- D-63: item de frete não tem unidade (vw_itens_producao: unidades = 0).
  select v.codigo, v.descricao, v.unidades
    into v_codigo, v_descricao, v_n
    from plt_privado.vw_itens_producao v
   where v.pedido_id = v_pc.pedido_id and v.seq = p_item_seq
     and v.unidades >= 1;
  if v_n is null or p_indice_unidade is null or p_indice_unidade < 1 or p_indice_unidade > v_n then
    raise exception 'Esta unidade não existe no pedido.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.plt_cards u
              where u.pedido_id = v_pc.pedido_id and u.tipo = 'unidade'
                and u.item_seq = p_item_seq and u.indice_unidade = p_indice_unidade) then
    raise exception 'Esta unidade do pedido já foi liberada.' using errcode = 'check_violation';
  end if;

  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';
  select s.id into v_aguardo from public.plt_setores s where s.codigo = 'aguardo' and s.ativo;
  if v_aguardo is null then
    raise exception 'Pedidos em aguardo não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  select * into v_peca from public.plt_cards where id = p_peca_card_id for update;
  if not found or v_peca.tipo <> 'unidade' or v_peca.pedido_id is not null
     or v_peca.arquivado_em is not null or v_peca.setor_atual_id is distinct from v_estoque then
    raise exception 'Esta peça não está livre no ESTOQUE (alguém pode ter usado antes).'
      using errcode = 'check_violation';
  end if;
  if coalesce(v_peca.qualidade_atual, 'perfeito') <> 'perfeito' then
    raise exception 'Só peça em perfeito estado vai para um pedido.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_chave_peca(v_peca.produto_tiny_id, v_peca.item_codigo, v_peca.item_descricao)
     <> plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(v_codigo, v_descricao), v_codigo, v_descricao) then
    raise exception 'A peça do estoque não é igual ao item do pedido (produto, cor e medidas).'
      using errcode = 'check_violation';
  end if;

  select p.numero into v_numero from public.pedidos p where p.id = v_pc.pedido_id;
  select case when pai.tipo = 'reposicao' then 'reposicao' else 'cancelamento' end
    into v_origem
    from public.plt_cards pai where pai.id = v_peca.card_pai_id;

  -- A unidade do pedido nasce PRONTA, direto no aguardo (não volta à produção).
  insert into public.plt_cards
      (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao,
       indice_unidade, total_unidades, produto_tiny_id, setor_atual_id)
    values
      ('unidade', v_pc.pedido_id, v_pc.id, p_item_seq, v_codigo, v_descricao,
       p_indice_unidade, v_n, v_peca.produto_tiny_id, v_aguardo)
    returning id into v_novo;

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id, observacao, dados)
    values (v_novo, 'card_criado', v_usuario, 'interface', v_aguardo,
            'Veio do estoque: peça pronta sem dono usada pelo pedido.',
            jsonb_build_object('alocada_de', v_peca.id,
                               'origem_peca', coalesce(v_origem, 'reposicao'),
                               'pedido_id', v_pc.pedido_id,
                               'numero', v_numero));

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (v_peca.id, 'peca_alocada', v_usuario, 'interface', v_peca.setor_atual_id,
            'Usada pelo pedido ' || coalesce(v_numero::text, '')
              || format(' (%s/%s)', p_indice_unidade, v_n) || '.',
            jsonb_build_object('pedido_id', v_pc.pedido_id,
                               'numero', v_numero,
                               'card_pedido_id', v_pc.id,
                               'unidade_card_id', v_novo,
                               'item_seq', p_item_seq,
                               'indice_unidade', p_indice_unidade));
  return v_novo;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8 · Pedidos em aguardo (37): o total sem frete + o pedido sem nada a
--     produzir, completo desde que nasceu (resposta 4 do dono). As três
--     portas continuam batendo por construção (Σ prontas = produtos).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pedidos_aguardo(
  p_busca        text    default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  card_id                 bigint,
  pedido_id               bigint,
  numero                  integer,
  cliente_nome            text,
  data_prevista           date,
  situacao                text,
  total_unidades          integer,
  unidades_liberadas      integer,
  unidades_prontas        integer,
  completo                boolean,
  alterado_apos_liberacao boolean,
  primeira_pronta_em      timestamptz,
  completo_em             timestamptz,
  contagem_total          bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with prontas as materialized (
    select a.card_pedido_id,
           count(*)::int       as prontas,
           min(u.concluido_em) as primeira,
           max(u.concluido_em) as ultima,
           false               as sem_producao
      from plt_privado.fn_unidades_em_aguardo() a
      join public.plt_cards u on u.id = a.unidade_id
     group by a.card_pedido_id
    union all
    -- D-63: pedido sem nada a produzir (só frete) — completo desde que nasceu.
    select s.card_pedido_id, 0, null::timestamptz, s.desde, true
      from plt_privado.fn_pedidos_sem_producao() s
  ),
  linhas as (
    select pc.id                          as card_id,
           p.id                           as pedido_id,
           p.numero,
           coalesce(c.nome, '')           as cliente_nome,
           p.data_prevista,
           p.situacao,
           coalesce(i.total_unidades, 0)  as total_unidades,
           coalesce(l.liberadas, 0)       as unidades_liberadas,
           pr.prontas                     as unidades_prontas,
           ((coalesce(i.total_unidades, 0) > 0 or pr.sem_producao)
            and pr.prontas >= coalesce(i.total_unidades, 0)) as completo,
           exists (select 1 from public.plt_eventos e
                    where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                          as alterado_apos_liberacao,
           pr.primeira                    as primeira_pronta_em,
           pr.ultima                      as ultima_pronta
      from prontas pr
      join public.plt_cards pc on pc.id = pr.card_pedido_id
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join lateral (
        select coalesce(sum(v.unidades), 0)::int as total_unidades
          from plt_privado.vw_itens_producao v where v.pedido_id = p.id
      ) i on true
      left join lateral (
        select count(*)::int as liberadas
          from public.plt_cards cu
         where cu.pedido_id = p.id and cu.tipo = 'unidade' and cu.arquivado_em is null
      ) l on true
     where plt_privado.fn_pode_ver_expedicao()
       and (p_busca is null or btrim(p_busca) = ''
            or p.numero::text like btrim(p_busca) || '%'
            or c.nome ilike '%' || btrim(p_busca) || '%')
  )
  select l.card_id, l.pedido_id, l.numero, l.cliente_nome, l.data_prevista, l.situacao,
         l.total_unidades, l.unidades_liberadas, l.unidades_prontas, l.completo,
         l.alterado_apos_liberacao, l.primeira_pronta_em,
         case when l.completo then l.ultima_pronta end as completo_em,
         count(*) over ()                              as contagem_total
    from linhas l
   order by l.completo desc, l.data_prevista asc nulls last, l.numero
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_pedidos_aguardo(text, integer, integer) is
  'Aba "Pedidos" de Pedidos em aguardo (S15/S22/S24): pedidos com peça pronta num fim de linha, não lançados — prontas × total de unidades de produção (frete não conta — D-63) — e o pedido sem nada a produzir, completo desde que nasceu (D-63). Gate da logística.';

create or replace function public.plt_fn_produtos_reservados(
  p_busca        text    default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  card_id         bigint,
  card_pedido_id  bigint,
  pedido_id       bigint,
  numero          integer,
  cliente_nome    text,
  situacao        text,
  item_codigo     text,
  item_descricao  text,
  indice_unidade  integer,
  total_unidades  integer,
  local           text,
  qualidade_atual text,
  pronta_em       timestamptz,
  veio_do_estoque boolean,
  pedido_completo boolean,
  contagem_total  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as materialized (
    select a.unidade_id, a.card_pedido_id, a.pedido_id
      from plt_privado.fn_unidades_em_aguardo() a
  ),
  por_pedido as (
    select b.card_pedido_id, b.pedido_id, count(*)::int as prontas,
           (select coalesce(sum(v.unidades), 0)::int
              from plt_privado.vw_itens_producao v where v.pedido_id = b.pedido_id) as total
      from base b
     group by b.card_pedido_id, b.pedido_id
  )
  select u.id,
         b.card_pedido_id,
         p.id,
         p.numero,
         coalesce(c.nome, ''),
         p.situacao,
         u.item_codigo,
         u.item_descricao,
         u.indice_unidade,
         u.total_unidades,
         s.codigo,
         u.qualidade_atual,
         u.concluido_em,
         exists (select 1 from public.plt_eventos e
                  where e.card_id = u.id and e.tipo = 'card_criado' and e.dados ? 'alocada_de'),
         (pp.total > 0 and pp.prontas >= pp.total),
         count(*) over ()
    from base b
    join public.plt_cards u on u.id = b.unidade_id
    join public.pedidos p on p.id = b.pedido_id
    join por_pedido pp on pp.card_pedido_id = b.card_pedido_id
    left join public.clientes c on c.id = p.cliente_id
    left join public.plt_setores s on s.id = u.setor_atual_id
   where plt_privado.fn_pode_ver_expedicao()
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%'
          or u.item_descricao ilike '%' || btrim(p_busca) || '%'
          or u.item_codigo ilike btrim(p_busca) || '%')
   order by u.concluido_em asc nulls last, u.id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

create or replace function public.plt_fn_aguardo_contagens()
returns table (
  pedidos           integer,
  pedidos_completos integer,
  produtos          integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as materialized (
    select a.card_pedido_id, a.pedido_id from plt_privado.fn_unidades_em_aguardo() a
  ),
  por_pedido as (
    select b.card_pedido_id, count(*)::int as prontas,
           (select coalesce(sum(v.unidades), 0)::int
              from plt_privado.vw_itens_producao v where v.pedido_id = b.pedido_id) as total,
           false as sem_producao
      from base b
     group by b.card_pedido_id, b.pedido_id
    union all
    -- D-63: o pedido sem nada a produzir entra na aba já completo.
    select s.card_pedido_id, 0, 0, true
      from plt_privado.fn_pedidos_sem_producao() s
  )
  select count(*)::int,
         (count(*) filter (where (pp.total > 0 or pp.sem_producao)
                             and pp.prontas >= pp.total))::int,
         coalesce(sum(pp.prontas), 0)::int
    from por_pedido pp
   where plt_privado.fn_pode_ver_expedicao();
$$;

-- ----------------------------------------------------------------------------
-- 9 · ROTAS (25): lançar, entregar, a lista e o mapa contam sem frete. O
--     pedido sem nada a produzir está completo desde que nasceu (D-63) — e o
--     pedido cancelado no Tiny não vai para as ROTAS (sem nada a produzir, a
--     trava de "completo" sozinha não o barraria).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_lancar_rotas(p_card_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario   uuid;
  v_card      public.plt_cards%rowtype;
  v_total     integer;
  v_prontas   integer;
  v_rotas     bigint;
  v_evento_id bigint;
  r           record;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma lança pedidos para ROTAS.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Lançar para ROTAS é gesto da logística (PCP/terminais) ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards
   where id = p_card_id and tipo = 'pedido' and arquivado_em is null;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if v_card.lancado_rotas_em is not null then
    raise exception 'Este pedido já foi lançado para ROTAS.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.plt_eventos e
              where e.card_id = p_card_id and e.tipo = 'pedido_entregue') then
    raise exception 'Este pedido já foi registrado como entregue.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    raise exception 'Este pedido foi cancelado no Tiny — não vai para ROTAS.' using errcode = 'check_violation';
  end if;

  -- D-63: frete não conta (fn_unidades_do_pedido).
  v_total := plt_privado.fn_unidades_do_pedido(v_card.pedido_id);
  select count(*)::int into v_prontas
    from public.plt_cards cu
    join public.plt_setores s on s.id = cu.setor_atual_id
   where cu.pedido_id = v_card.pedido_id and cu.tipo = 'unidade'
     and cu.arquivado_em is null and s.papel_no_fluxo = 'terminal';

  -- D-33/D-45: só pedido COMPLETO vai para as ROTAS. D-63: sem nada a
  -- produzir (só frete), o pedido está completo desde que nasceu.
  if v_prontas < v_total then
    raise exception 'Só pedido completo vai para ROTAS: % de % unidade(s) prontas.', v_prontas, v_total
      using errcode = 'check_violation';
  end if;

  select s.id into v_rotas from public.plt_setores s where s.codigo = 'rotas' and s.ativo;
  if v_rotas is null then
    raise exception 'O setor ROTAS não está cadastrado — cadastre-o antes de lançar.' using errcode = 'no_data_found';
  end if;

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id, dados)
       values (p_card_id, 'pedido_lancado_rotas', v_usuario, 'interface', v_rotas,
               jsonb_build_object('unidades', v_total))
    returning id into v_evento_id;

  -- As unidades que estão no ESTOQUE (ou noutro terminal) vão de verdade para
  -- a ROTAS — evento normal de movimentação (D-45); saída de terminal não
  -- exige marcação de qualidade (D-25).
  for r in
    select cu.id, cu.setor_atual_id, cu.etapa_atual_id
      from public.plt_cards cu
     where cu.pedido_id = v_card.pedido_id and cu.tipo = 'unidade'
       and cu.arquivado_em is null and cu.setor_atual_id is distinct from v_rotas
  loop
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem,
         setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
         observacao, dados)
      values
        (r.id, 'movimentacao_setor', v_usuario, 'interface',
         r.setor_atual_id, r.etapa_atual_id, v_rotas, null,
         'Lançado para ROTAS com o pedido completo.',
         jsonb_build_object('lancamento_evento_id', v_evento_id));
  end loop;

  return v_evento_id;
end;
$$;

comment on function public.plt_fn_lancar_rotas(bigint) is
  'Lançar para ROTAS (D-45): só pedido completo (frete não conta; sem nada a produzir = completo — D-63) e não cancelado no Tiny; evento pedido_lancado_rotas + as unidades vão para a ROTAS. Gesto da logística/admin.';

create or replace function public.plt_fn_registrar_entrega(
  p_card_id    bigint,
  p_observacao text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_card    public.plt_cards%rowtype;
  v_total   integer;
  v_em_rotas integer;
  v_evento_id bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma registra entrega.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Registrar entrega é gesto da logística (PCP/terminais) ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido';
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  -- SESSAO-15 (D-45): entrega só do que foi lançado pelos Pedidos em aguardo.
  if v_card.lancado_rotas_em is null then
    raise exception 'Este pedido ainda não foi lançado para ROTAS — lance pelos Pedidos em aguardo.'
      using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.plt_eventos e
              where e.card_id = p_card_id and e.tipo = 'pedido_entregue') then
    raise exception 'Este pedido já foi registrado como entregue.' using errcode = 'check_violation';
  end if;

  -- D-63: frete não conta (fn_unidades_do_pedido).
  v_total := plt_privado.fn_unidades_do_pedido(v_card.pedido_id);
  select count(*)::int into v_em_rotas
    from public.plt_cards cu
    join public.plt_setores s on s.id = cu.setor_atual_id
   where cu.pedido_id = v_card.pedido_id and cu.tipo = 'unidade'
     and cu.arquivado_em is null and s.codigo = 'rotas';

  -- D-33: entrega por pedido completo. D-63: sem nada a produzir (só frete),
  -- o lançado já está completo.
  if v_em_rotas < v_total then
    raise exception 'A entrega sai por pedido completo: % de % unidade(s) na ROTAS.', v_em_rotas, v_total
      using errcode = 'check_violation';
  end if;

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
       values (p_card_id, 'pedido_entregue', v_usuario, 'interface',
               nullif(btrim(p_observacao), ''),
               jsonb_build_object('unidades', v_em_rotas))
    returning id into v_evento_id;

  return v_evento_id;
end;
$$;

create or replace function public.plt_fn_rotas(
  p_situacao      text default null, -- 'pronta' | 'entregue'
  p_busca         text default null,
  p_limite        integer default 20,
  p_deslocamento  integer default 0
)
returns table (
  card_id           bigint,
  pedido_id         bigint,
  numero            integer,
  cliente_nome      text,
  telefone          text,
  endereco          text,
  numero_endereco   text,
  complemento       text,
  bairro            text,
  cidade            text,
  uf                text,
  obs               text,
  data_prevista     date,
  total_unidades    integer,
  unidades_em_rotas integer,
  situacao_entrega  text,
  entregue_em       timestamptz,
  entregue_por      text,
  lancado_em        timestamptz,
  programacao_data  date,
  caminhao_id       bigint,
  caminhao_nome     text,
  caminhao_placa    text,
  caminhao_foto     text,
  contagem_total    bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with rotas as (
    select s.id from public.plt_setores s where s.codigo = 'rotas'
  ),
  base as (
    select pc.id                        as card_id,
           p.id                         as pedido_id,
           p.numero,
           coalesce(c.nome, '')         as cliente_nome,
           c.fone                       as telefone,
           c.endereco,
           c.numero                     as numero_endereco,
           c.complemento,
           c.bairro,
           c.cidade,
           c.uf,
           p.obs,
           p.data_prevista,
           coalesce(i.total_unidades, 0) as total_unidades,
           coalesce(u.em_rotas, 0)       as unidades_em_rotas,
           ent.ocorrido_em               as entregue_em,
           ent_nome.nome                 as entregue_por,
           pc.lancado_rotas_em           as lancado_em,
           pr.data_entrega               as programacao_data,
           cam.id                        as caminhao_id,
           cam.nome                      as caminhao_nome,
           cam.placa                     as caminhao_placa,
           cam.foto_caminho              as caminhao_foto
      from public.plt_cards pc
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join lateral (
        -- D-63: frete não conta.
        select coalesce(sum(v.unidades), 0)::int as total_unidades
          from plt_privado.vw_itens_producao v where v.pedido_id = p.id
      ) i on true
      left join lateral (
        select count(*)::int as em_rotas
          from public.plt_cards cu
         where cu.pedido_id = p.id and cu.tipo = 'unidade'
           and cu.arquivado_em is null
           and cu.setor_atual_id in (select id from rotas)
      ) u on true
      left join lateral (
        select e.ocorrido_em, e.usuario_id
          from public.plt_eventos e
         where e.card_id = pc.id and e.tipo = 'pedido_entregue'
         order by e.ocorrido_em desc limit 1
      ) ent on true
      left join public.plt_usuarios ent_nome on ent_nome.id = ent.usuario_id
      left join public.plt_programacoes pr on pr.card_id = pc.id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
     where pc.tipo = 'pedido' and pc.arquivado_em is null
       and pc.lancado_rotas_em is not null   -- D-45: só o lançado
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome, b.telefone,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         b.obs, b.data_prevista, b.total_unidades, b.unidades_em_rotas,
         case when b.entregue_em is not null then 'entregue' else 'pronta' end as situacao_entrega,
         b.entregue_em, b.entregue_por, b.lancado_em,
         b.programacao_data, b.caminhao_id, b.caminhao_nome, b.caminhao_placa, b.caminhao_foto,
         count(*) over () as contagem_total
    from base b
   where plt_privado.fn_pode_ver_expedicao()
     and (p_situacao is null
          or (case when b.entregue_em is not null then 'entregue' else 'pronta' end) = p_situacao)
     and (p_busca is null or btrim(p_busca) = ''
          or b.numero::text like btrim(p_busca) || '%'
          or b.cliente_nome ilike '%' || btrim(p_busca) || '%')
   order by (b.entregue_em is not null),
            coalesce(b.programacao_data, b.data_prevista) asc nulls last,
            b.numero
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

create or replace function public.plt_fn_programacao(
  p_data         date    default null,
  p_limite       integer default 100,
  p_deslocamento integer default 0
)
returns table (
  card_id                 bigint,
  pedido_id               bigint,
  numero                  integer,
  cliente_nome            text,
  endereco                text,
  numero_endereco         text,
  complemento             text,
  bairro                  text,
  cidade                  text,
  uf                      text,
  endereco_geocodificavel text,
  geo_chave               text,
  latitude                double precision,
  longitude               double precision,
  geo_resolvido           boolean,
  geo_consultado_em       timestamptz,
  total_unidades          integer,
  data_prevista           date,
  lancado_em              timestamptz,
  programacao_data        date,
  caminhao_id             bigint,
  caminhao_nome           text,
  contagem_total          bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select pc.id                        as card_id,
           p.id                         as pedido_id,
           p.numero,
           coalesce(c.nome, '')         as cliente_nome,
           c.endereco,
           c.numero                     as numero_endereco,
           c.complemento,
           c.bairro,
           c.cidade,
           c.uf,
           plt_privado.fn_endereco_geocodificavel(
             c.endereco, c.numero, c.bairro, c.cidade, c.uf, c.cep) as endereco_geocodificavel,
           coalesce(i.total_unidades, 0) as total_unidades,
           p.data_prevista,
           pc.lancado_rotas_em           as lancado_em,
           pr.data_entrega               as programacao_data,
           cam.id                        as caminhao_id,
           cam.nome                      as caminhao_nome
      from public.plt_cards pc
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join lateral (
        -- D-63: frete não conta.
        select coalesce(sum(v.unidades), 0)::int as total_unidades
          from plt_privado.vw_itens_producao v where v.pedido_id = p.id
      ) i on true
      left join public.plt_programacoes pr on pr.card_id = pc.id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
     where pc.tipo = 'pedido' and pc.arquivado_em is null
       and pc.lancado_rotas_em is not null
       and not exists (select 1 from public.plt_eventos e
                        where e.card_id = pc.id and e.tipo = 'pedido_entregue')
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         b.endereco_geocodificavel,
         case when b.endereco_geocodificavel is null then null
              else md5(lower(b.endereco_geocodificavel)) end as geo_chave,
         g.latitude, g.longitude,
         g.resolvido       as geo_resolvido,
         g.consultado_em   as geo_consultado_em,
         b.total_unidades, b.data_prevista, b.lancado_em,
         b.programacao_data, b.caminhao_id, b.caminhao_nome,
         count(*) over () as contagem_total
    from base b
    left join public.plt_geocache g
           on b.endereco_geocodificavel is not null
          and g.chave = md5(lower(b.endereco_geocodificavel))
   where plt_privado.fn_pode_ver_expedicao()
     and (b.programacao_data is null or p_data is null or b.programacao_data = p_data)
   order by (b.programacao_data is not null), b.data_prevista asc nulls last, b.numero
   limit least(greatest(coalesce(p_limite, 100), 1), 200)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

-- ----------------------------------------------------------------------------
-- 10 · Expedição (19) e aba Cancelados (37): o total sem frete
-- ----------------------------------------------------------------------------
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
  situacao             text,
  total_unidades       integer,
  unidades_liberadas   integer,
  unidades_no_terminal integer,
  alterado_apos_liberacao boolean,
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
         p.situacao,
         coalesce(i.total_unidades, 0) as total_unidades,
         coalesce(u.liberadas, 0)      as unidades_liberadas,
         coalesce(u.no_terminal, 0)    as unidades_no_terminal,
         exists (select 1 from public.plt_eventos e
                  where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                       as alterado_apos_liberacao,
         count(*) over ()              as contagem_total
    from public.pedidos p
    join public.plt_cards pc
      on pc.pedido_id = p.id and pc.tipo = 'pedido' and pc.arquivado_em is null
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      -- D-63: frete não conta.
      select coalesce(sum(v.unidades), 0)::int as total_unidades
          from plt_privado.vw_itens_producao v where v.pedido_id = p.id
    ) i on true
    left join lateral (
      select count(*)::int as liberadas,
             count(*) filter (where cu.concluido_em is not null)::int as no_terminal
        from public.plt_cards cu
       where cu.pedido_id = p.id and cu.tipo = 'unidade'
         and cu.arquivado_em is null
    ) u on true
   where plt_privado.fn_pode_ver_expedicao()
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%')
   order by p.data_prevista asc nulls last, p.numero desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

create or replace function public.plt_fn_pedidos_cancelados(
  p_busca        text    default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  card_id        bigint,
  pedido_id      bigint,
  numero         integer,
  cliente_nome   text,
  data_pedido    date,
  cancelado_em   timestamptz,
  total_unidades integer,
  em_producao    integer,
  prontas        integer,
  no_estoque     integer,
  contagem_total bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pc.id,
         p.id,
         p.numero,
         coalesce(c.nome, ''),
         p.data_pedido,
         ev.cancelado_em,
         coalesce(i.total, 0),
         coalesce(u.em_producao, 0),
         coalesce(u.prontas, 0),
         coalesce(d.no_estoque, 0),
         count(*) over ()
    from public.plt_cards pc
    join public.pedidos p on p.id = pc.pedido_id
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      select min(e.ocorrido_em) as cancelado_em
        from public.plt_eventos e
       where e.card_id = pc.id and e.tipo = 'pedido_cancelado'
    ) ev on true
    left join lateral (
      -- D-63: frete não conta.
      select coalesce(sum(v.unidades), 0)::int as total
           from plt_privado.vw_itens_producao v where v.pedido_id = p.id
    ) i on true
    left join lateral (
      -- peças que ainda carregam o pedido: na produção (com a etiqueta) ou num fim de linha
      select count(*) filter (where s.papel_no_fluxo <> 'terminal')::int as em_producao,
             count(*) filter (where s.papel_no_fluxo = 'terminal')::int  as prontas
        from public.plt_cards cu
        left join public.plt_setores s on s.id = cu.setor_atual_id
       where cu.pedido_id = p.id and cu.tipo = 'unidade' and cu.arquivado_em is null
    ) u on true
    left join lateral (
      -- peças que perderam o pedido e ficaram sem dono no estoque
      select count(*)::int as no_estoque
        from public.plt_cards cu
       where cu.card_pai_id = pc.id and cu.tipo = 'unidade'
         and cu.pedido_id is null and cu.arquivado_em is null
    ) d on true
   where plt_privado.fn_usuario_atual() is not null
     and (plt_privado.fn_eh_admin()
          or pc.setor_atual_id in (select plt_privado.fn_setores_do_usuario()))
     and pc.tipo = 'pedido'
     and pc.arquivado_em is null
     and plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%')
   order by ev.cancelado_em desc nulls last, p.numero desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

-- ----------------------------------------------------------------------------
-- 11 · Painéis (28 e 37): "pedidos a liberar" e "aguardando lançamento"
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_dash_pcp_dia(
  p_dia date default null
)
returns table (
  pedidos_a_liberar       integer,
  unidades_liberadas_dia  integer,
  espera_mais_antiga      interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with dia as (
    select (coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date)::timestamp
            at time zone 'America/Fortaleza') as ini
  ),
  pcp as (
    select s.id from public.plt_setores s where s.codigo = 'pcp'
  )
  select
    -- pedido ainda com unidade por liberar (cancelado não conta como trabalho;
    -- D-63: frete não é unidade a liberar)
    (select count(*)::int
       from public.plt_cards pc
       join public.pedidos p on p.id = pc.pedido_id
       left join lateral (
         select coalesce(sum(v.unidades), 0)::int as total
           from plt_privado.vw_itens_producao v where v.pedido_id = p.id
       ) i on true
       left join lateral (
         select count(*)::int as liberadas
           from public.plt_cards cu
          where cu.pedido_id = p.id and cu.tipo = 'unidade'
            and cu.arquivado_em is null
       ) u on true
      where pc.tipo = 'pedido'
        and pc.arquivado_em is null
        and plt_privado.fn_situacao_normalizada(p.situacao) is distinct from 'cancelado'
        and coalesce(u.liberadas, 0) < coalesce(i.total, 0)) as pedidos_a_liberar,
    (select count(*)::int
       from public.plt_eventos e
       join public.plt_cards c on c.id = e.card_id
      where e.tipo = 'card_criado'
        and c.tipo = 'unidade'
        and e.ocorrido_em >= (select ini from dia)
        and e.ocorrido_em <  (select ini from dia) + interval '1 day')
                                                    as unidades_liberadas_dia,
    (select max(now() - pc.desde)
       from public.plt_cards pc
      where pc.tipo = 'pedido'
        and pc.arquivado_em is null
        and pc.setor_atual_id in (select id from pcp)) as espera_mais_antiga
   where (select id from pcp) in (select plt_privado.fn_setores_dashboard());
$$;

create or replace function public.plt_fn_dash_dia(
  p_dia date default null
)
returns table (
  concluidas_dia          integer,
  media_concluidas_4sem   numeric,
  danificados_dia         integer,
  aguardando_lancamento   integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with setores_ok as (
    select sd as id from plt_privado.fn_setores_dashboard() sd
  ),
  terminais_ok as (
    select s.id from public.plt_setores s
     where s.papel_no_fluxo = 'terminal'
       and s.id in (select id from setores_ok)
  ),
  dia as (
    select (coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date)::timestamp
            at time zone 'America/Fortaleza') as ini
  ),
  chegadas as (
    -- chegada de unidade a um terminal que este usuário mede, vinda de FORA
    -- dos terminais (S24: terminal → terminal é lançar ou devolver, não produzir)
    select distinct on (e.card_id, ((e.ocorrido_em at time zone 'America/Fortaleza')::date))
           e.card_id,
           (e.ocorrido_em at time zone 'America/Fortaleza')::date as dia_local
      from public.plt_eventos e
      join public.plt_cards c on c.id = e.card_id and c.tipo = 'unidade'
      left join public.plt_setores so on so.id = e.setor_origem_id
     where e.tipo = 'movimentacao_setor'
       and e.setor_destino_id in (select id from terminais_ok)
       and coalesce(so.papel_no_fluxo, '') <> 'terminal'
  )
  select
    (select count(*)::int from chegadas ch
      where ch.dia_local = (coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date)))
                                                   as concluidas_dia,
    (select round(count(*)::numeric / 4, 1) from chegadas ch
      where ch.dia_local in (
        coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) - 7,
        coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) - 14,
        coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) - 21,
        coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date) - 28))
                                                   as media_concluidas_4sem,
    (select count(distinct e.card_id)::int
       from public.plt_eventos e
       join public.plt_etapas et on et.id = e.etapa_destino_id and et.eh_danificado
      where e.tipo in ('movimentacao_etapa', 'movimentacao_setor')
        and e.setor_destino_id in (select id from setores_ok)
        and e.ocorrido_em >= (select ini from dia)
        and e.ocorrido_em <  (select ini from dia) + interval '1 day')
                                                   as danificados_dia,
    (select count(*)::int
       from public.plt_cards pc
       join public.pedidos p on p.id = pc.pedido_id
       left join lateral (
         -- D-63: frete não conta.
         select coalesce(sum(v.unidades), 0)::int as total
           from plt_privado.vw_itens_producao v where v.pedido_id = p.id
       ) i on true
       left join lateral (
         select count(*) filter (where s.papel_no_fluxo = 'terminal')::int as prontas
           from public.plt_cards cu
           left join public.plt_setores s on s.id = cu.setor_atual_id
          where cu.pedido_id = p.id and cu.tipo = 'unidade' and cu.arquivado_em is null
       ) u on true
      where pc.tipo = 'pedido'
        and pc.arquivado_em is null
        and pc.lancado_rotas_em is null
        and coalesce(i.total, 0) > 0
        and coalesce(u.prontas, 0) >= coalesce(i.total, 0))
    -- D-63: o pedido sem nada a produzir também espera o lançamento.
    + (select count(*)::int from plt_privado.fn_pedidos_sem_producao())
                                                   as aguardando_lancamento
   where exists (select 1 from terminais_ok);
$$;

-- ----------------------------------------------------------------------------
-- 12 · Permissões (E-11): o que é maquinaria fica fora da API; as portas
--     recriadas mantêm o acesso de sempre (reafirmado aqui).
-- ----------------------------------------------------------------------------
revoke all on plt_privado.vw_itens_producao                                 from public, anon, authenticated;
revoke all on function plt_privado.fn_unidades_do_pedido(bigint)            from public, anon, authenticated;
revoke all on function plt_privado.fn_pedidos_sem_producao()                from public, anon, authenticated;
revoke all on function plt_privado.fn_validar_unidade_de_producao()         from public, anon, authenticated;
revoke all on function plt_privado.fn_recalcular_liberacao(bigint)          from public, anon, authenticated;

revoke all on function public.plt_fn_pedido_itens_kanban(bigint)                                from public, anon;
revoke all on function public.plt_fn_pedidos_kanban(text, boolean, bigint[], integer, integer)   from public, anon;
revoke all on function public.plt_fn_cards_pedido_pcp(integer, integer)                         from public, anon;
revoke all on function public.plt_fn_sugestoes_alocacao(bigint)                                 from public, anon;
revoke all on function public.plt_fn_alocar_peca(bigint, integer, integer, bigint)              from public, anon;
revoke all on function public.plt_fn_pedidos_aguardo(text, integer, integer)                    from public, anon;
revoke all on function public.plt_fn_produtos_reservados(text, integer, integer)                from public, anon;
revoke all on function public.plt_fn_aguardo_contagens()                                        from public, anon;
revoke all on function public.plt_fn_lancar_rotas(bigint)                                       from public, anon;
revoke all on function public.plt_fn_registrar_entrega(bigint, text)                            from public, anon;
revoke all on function public.plt_fn_rotas(text, text, integer, integer)                        from public, anon;
revoke all on function public.plt_fn_programacao(date, integer, integer)                        from public, anon;
revoke all on function public.plt_fn_expedicao_kanban(text, integer, integer)                   from public, anon;
revoke all on function public.plt_fn_pedidos_cancelados(text, integer, integer)                 from public, anon;
revoke all on function public.plt_fn_dash_pcp_dia(date)                                         from public, anon;
revoke all on function public.plt_fn_dash_dia(date)                                             from public, anon;

grant execute on function public.plt_fn_pedido_itens_kanban(bigint)                              to authenticated;
grant execute on function public.plt_fn_pedidos_kanban(text, boolean, bigint[], integer, integer) to authenticated;
grant execute on function public.plt_fn_cards_pedido_pcp(integer, integer)                       to authenticated;
grant execute on function public.plt_fn_sugestoes_alocacao(bigint)                               to authenticated;
grant execute on function public.plt_fn_alocar_peca(bigint, integer, integer, bigint)            to authenticated;
grant execute on function public.plt_fn_pedidos_aguardo(text, integer, integer)                  to authenticated;
grant execute on function public.plt_fn_produtos_reservados(text, integer, integer)              to authenticated;
grant execute on function public.plt_fn_aguardo_contagens()                                      to authenticated;
grant execute on function public.plt_fn_lancar_rotas(bigint)                                     to authenticated;
grant execute on function public.plt_fn_registrar_entrega(bigint, text)                          to authenticated;
grant execute on function public.plt_fn_rotas(text, text, integer, integer)                      to authenticated;
grant execute on function public.plt_fn_programacao(date, integer, integer)                      to authenticated;
grant execute on function public.plt_fn_expedicao_kanban(text, integer, integer)                 to authenticated;
grant execute on function public.plt_fn_pedidos_cancelados(text, integer, integer)               to authenticated;
grant execute on function public.plt_fn_dash_pcp_dia(date)                                       to authenticated;
grant execute on function public.plt_fn_dash_dia(date)                                           to authenticated;
