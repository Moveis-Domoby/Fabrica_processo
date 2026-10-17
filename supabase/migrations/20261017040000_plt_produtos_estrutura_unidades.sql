-- ============================================================================
-- SESSAO-33 · migration 92 — CONFIGURAÇÕES → MÓVEIS, INSUMOS E PEÇAS: A
-- ESTRUTURA DE CADA PRODUTO E AS UNIDADES FORA DO PADRÃO (D-142, respostas 3 e 6)
--
--   · `plt_fn_produto_estrutura(tiny_id)` — no clique (Lei §3): do que o
--     produto é feito (os componentes da estrutura do Tiny, com a quantidade) e
--     onde ele é usado (os produtos que o têm na estrutura). A estrutura chega
--     pela carga do Tiny (migration 89/90: `plt_produto_componentes`).
--   · `plt_fn_produtos_unidades(limite, deslocamento)` — os insumos e as peças
--     ATIVOS com a unidade fora do padrão ou sem unidade, para a equipe
--     padronizar no Tiny. "Padrão" = a grafia mais usada de cada unidade no
--     catálogo (a mesma família que o cadastro já reconhece: un, pç, m, m², cx,
--     kg, l, par, rolo, chapa, min). A plataforma NÃO converte nada (resposta 6).
--
-- Só leitura; só o admin (o mesmo da tela). Catálogo limitado (≈550) —
-- deslocamento justificado, teto 100.
-- ============================================================================

create or replace function public.plt_fn_produto_estrutura(p_tiny_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_produto jsonb;
  v_comp    jsonb;
  v_usado   jsonb;
  v_total   integer;
  v_lido    timestamptz;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_eh_admin() then
    raise exception 'Só o admin vê a estrutura dos produtos.' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object('tiny_id', p.tiny_id, 'codigo', p.codigo, 'descricao', p.descricao,
                            'tipo', p.tipo_estoque_efetivo, 'classe', p.classe)
    into v_produto
    from public.produtos p where p.tiny_id = p_tiny_id;
  if v_produto is null then
    raise exception 'Produto não encontrado.' using errcode = 'no_data_found';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'tiny_id',     c.componente_tiny_id,
           'codigo',      coalesce(p.codigo, c.codigo),
           'descricao',   coalesce(p.descricao, c.nome, 'Produto fora do catálogo'),
           'tipo',        p.tipo_estoque_efetivo,
           'unidade',     coalesce(nullif(btrim(coalesce(p.raw->>'unidade', '')), ''), p.unidade),
           'quantidade',  c.quantidade,
           'no_catalogo', p.tiny_id is not null)
         order by coalesce(p.descricao, c.nome)), '[]'::jsonb),
         max(c.lido_em)
    into v_comp, v_lido
    from public.plt_produto_componentes c
    left join public.produtos p on p.tiny_id = c.componente_tiny_id
   where c.produto_tiny_id = p_tiny_id;

  select count(*) into v_total
    from public.plt_produto_componentes c where c.componente_tiny_id = p_tiny_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'tiny_id', x.tiny_id, 'codigo', x.codigo, 'descricao', x.descricao,
           'tipo', x.tipo, 'quantidade', x.quantidade)
         order by x.descricao), '[]'::jsonb)
    into v_usado
    from (select p.tiny_id, p.codigo, p.descricao, p.tipo_estoque_efetivo as tipo, c.quantidade
            from public.plt_produto_componentes c
            join public.produtos p on p.tiny_id = c.produto_tiny_id
           where c.componente_tiny_id = p_tiny_id
           order by p.descricao
           limit 50) x;

  return jsonb_build_object('produto', v_produto, 'componentes', v_comp,
                            'usado_em', v_usado, 'usado_em_total', v_total, 'lido_em', v_lido);
end;
$$;

comment on function public.plt_fn_produto_estrutura(bigint) is
  'SESSAO-33 (D-142, resposta 3): no clique da tela Móveis, insumos e peças — do que o produto é feito (os componentes da estrutura do Tiny com a quantidade; o que não está no catálogo vem com o SKU e o nome que o Tiny mandou) e onde é usado (até 50 produtos, com o total). Só o admin.';

create or replace function public.plt_fn_produtos_unidades(
  p_limite       integer default 30,
  p_deslocamento integer default 0
)
returns table (
  tiny_id        bigint,
  codigo         text,
  descricao      text,
  tipo           text,
  unidade_tiny   text,
  unidade_padrao text,
  motivo         text,
  contagem_total bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_eh_admin() then
    raise exception 'Só o admin vê a lista das unidades.' using errcode = 'insufficient_privilege';
  end if;

  return query
  with grafias as (
    -- quantas vezes cada grafia aparece, por unidade (todo o catálogo ativo)
    select p.unidade as familia, coalesce(p.raw->>'unidade', '') as grafia, count(*) as n
      from public.produtos p
     where p.situacao = 'A' and p.unidade is not null and btrim(coalesce(p.raw->>'unidade', '')) <> ''
     group by 1, 2
  ), padroes as (
    select distinct on (g.familia) g.familia, g.grafia as padrao
      from grafias g
     order by g.familia, g.n desc, g.grafia
  ), lista as (
    select p.tiny_id, p.codigo, p.descricao, p.tipo_estoque_efetivo as tipo,
           coalesce(p.raw->>'unidade', '') as unidade_tiny,
           pd.padrao as unidade_padrao,
           case
             when btrim(coalesce(p.raw->>'unidade', '')) = '' then 'sem_unidade'
             when p.unidade <> all (array['un', 'pc', 'm2', 'm', 'cx', 'kg', 'l', 'par', 'rolo', 'chapa', 'min']) then 'desconhecida'
             when coalesce(p.raw->>'unidade', '') <> pd.padrao then 'grafia'
           end as motivo
      from public.produtos p
      left join padroes pd on pd.familia = p.unidade
     where p.situacao = 'A'
       and coalesce(p.tipo_estoque_efetivo, '') <> 'movel'
  )
  select l.tiny_id, l.codigo, l.descricao, l.tipo, l.unidade_tiny,
         case when l.motivo = 'grafia' then l.unidade_padrao end,
         l.motivo, count(*) over ()
    from lista l
   where l.motivo is not null
   order by case l.motivo when 'sem_unidade' then 1 when 'desconhecida' then 2 else 3 end, l.descricao
   limit least(greatest(coalesce(p_limite, 30), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
end;
$$;

comment on function public.plt_fn_produtos_unidades(integer, integer) is
  'SESSAO-33 (D-142, resposta 6): os insumos e as peças ativos com a unidade fora do padrão — sem unidade; unidade que o cadastro não reconhece; ou grafia diferente da mais usada daquela unidade (ex.: "Und" quando o padrão é "UN") — para a equipe padronizar no Tiny. A plataforma não converte nada. 1–100 por página com o total (catálogo limitado). Só o admin.';

revoke all on function public.plt_fn_produto_estrutura(bigint) from public, anon;
revoke all on function public.plt_fn_produtos_unidades(integer, integer) from public, anon;
grant execute on function public.plt_fn_produto_estrutura(bigint) to authenticated;
grant execute on function public.plt_fn_produtos_unidades(integer, integer) to authenticated;
