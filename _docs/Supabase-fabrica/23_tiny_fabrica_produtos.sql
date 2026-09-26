-- =============================================================================
-- DOMOBY · Tiny da FÁBRICA → catálogo de produtos  (migration 23)
-- Data: 21/09/2026 · Autor: Cowork · revisada no mesmo dia (enxuta, regra do dono:
-- antes de criar tabela, ver se uma existente pode ser remodelada)
--
-- Inventário conferido ao vivo em 21/09 (36 tabelas em public):
--   • NÃO existe catálogo de produtos. `pedido_itens` é linha de pedido (o que
--     foi vendido), não cadastro — misturar os dois quebraria o fn_upsert_pedido,
--     que apaga e regrava itens. → 1 tabela nova é inevitável: `produtos`.
--   • JÁ existe o log permanente do que chega do Tiny: `eventos`. O webhook de
--     "lançamentos de estoque" cabe nele → REMODELADA com 1 coluna (`payload`),
--     em vez de criar tabela de captura. Nenhuma função/view depende das colunas
--     atuais além do fn_upsert_pedido, que não é tocado (coluna nova é nullable).
--
-- Resultado: 1 tabela nova · 1 coluna nova · 1 função nova.
-- Conta: FábricaDomoby · CNPJ 27.556.613/0001-66. Chave = id interno do Tiny;
-- SKU pode faltar ou repetir (a loja reusa SKU em personalizado).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1 · PRODUTOS — o catálogo (fonte: Tiny da fábrica; "o estoque é um só")
-- Só as colunas que alguém vai filtrar/mostrar. O resto do cadastro fica em `raw`.
-- -----------------------------------------------------------------------------
create table if not exists public.produtos (
  tiny_id         bigint primary key,            -- id interno no Tiny da fábrica
  codigo          text,                           -- SKU (nulo/repetido permitido)
  descricao       text not null default '',
  classe          text,                           -- F fabricado · M matéria-prima · S simples · K kit · V com variação
  tipo_variacao   text,                           -- N normal · P pai · V filho
  id_produto_pai  bigint,                         -- quando tipo_variacao = 'V'
  unidade         text,                           -- JÁ normalizada: un, pc, m, m2, cx, kg, l, par, rolo, chapa, min
  estoque_minimo  numeric(14,4),
  estoque_maximo  numeric(14,4),
  situacao        text,                           -- A ativo · I inativo
  raw             jsonb,                          -- retorno.produto inteiro (preço, NCM, GTIN, variações, kit…)
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create index if not exists produtos_codigo_idx on public.produtos (codigo);

comment on table public.produtos is
  'Catálogo de produtos da Domoby, espelho do Tiny da FÁBRICA (todas as classes). Escrito só pelo n8n via fn_upsert_produto.';


-- -----------------------------------------------------------------------------
-- 2 · EVENTOS — remodelada: passa a guardar o corpo cru quando for útil
-- tipos novos: 'produto_fabrica' (cada upsert de produto) ·
--              'estoque_fabrica' (webhook de lançamento de estoque, payload cru)
-- -----------------------------------------------------------------------------
alter table public.eventos add column if not exists payload jsonb;

comment on column public.eventos.payload is
  'Corpo cru recebido, quando o formato não é documentado (ex.: webhook de estoque do Tiny da fábrica). Nulo nos eventos de pedido.';


-- -----------------------------------------------------------------------------
-- 3 · A PORTA DO n8n
-- POST {URL}/rest/v1/rpc/fn_upsert_produto   body {"p": <retorno.produto>}
-- Idempotente. Registra 1 linha em `eventos` (tipo 'produto_fabrica').
-- -----------------------------------------------------------------------------
create or replace function public.fn_upsert_produto(p jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  bigint := nullif(trim(coalesce(p->>'id','')), '')::bigint;
  v_un  text   := lower(trim(coalesce(p->>'unidade','')));
  v_num text;
begin
  if v_id is null then
    raise exception 'payload de produto sem id';
  end if;

  -- unidade: o cadastro real tem Und/Unidad/un, Pç/pç, M²/M2, Caixa/"Caixa "…
  v_un := case
    when v_un = ''                                               then null
    when v_un in ('un','und','unid','unidad','unidade','uni')    then 'un'
    when v_un in ('pç','pc','pç.','pc.','peca','peça','pcs')     then 'pc'
    when v_un in ('m²','m2','mt2')                               then 'm2'
    when v_un in ('m','mt','metro','metros','mts')               then 'm'
    when v_un in ('cx','caixa','caixas')                         then 'cx'
    when v_un in ('kg','quilog','quilo','quilograma')            then 'kg'
    when v_un in ('l','lt','litro','litros')                     then 'l'
    when v_un in ('par','pares','pr')                            then 'par'
    when v_un in ('rolo','rl')                                   then 'rolo'
    when v_un in ('chapa','ch')                                  then 'chapa'
    when v_un in ('min','minuto','minutos')                      then 'min'
    else v_un
  end;

  insert into produtos as t (
    tiny_id, codigo, descricao, classe, tipo_variacao, id_produto_pai,
    unidade, estoque_minimo, estoque_maximo, situacao, raw
  ) values (
    v_id,
    nullif(trim(coalesce(p->>'codigo','')), ''),
    trim(coalesce(p->>'nome','')),
    nullif(upper(trim(coalesce(p->>'classe_produto',''))), ''),
    nullif(upper(trim(coalesce(p->>'tipoVariacao',''))), ''),
    nullif(nullif(trim(coalesce(p->>'idProdutoPai','')), ''), '0')::bigint,
    v_un,
    nullif(replace(trim(coalesce(p->>'estoque_minimo','')), ',', '.'), '')::numeric,
    nullif(replace(trim(coalesce(p->>'estoque_maximo','')), ',', '.'), '')::numeric,
    nullif(upper(trim(coalesce(p->>'situacao',''))), ''),
    p
  )
  on conflict (tiny_id) do update set
    codigo         = excluded.codigo,
    descricao      = excluded.descricao,
    classe         = excluded.classe,
    tipo_variacao  = excluded.tipo_variacao,
    id_produto_pai = excluded.id_produto_pai,
    unidade        = excluded.unidade,
    estoque_minimo = excluded.estoque_minimo,
    estoque_maximo = excluded.estoque_maximo,
    situacao       = excluded.situacao,
    raw            = excluded.raw,
    atualizado_em  = now()
  where t.raw is distinct from excluded.raw;   -- varredura diária não "mexe" no que não mudou

  if found then
    insert into eventos (tipo, tiny_id, situacao) values ('produto_fabrica', v_id, nullif(upper(trim(coalesce(p->>'situacao',''))), ''));
  end if;

  return v_id;
end;
$$;


-- -----------------------------------------------------------------------------
-- 4 · RLS — travado como as demais tabelas da integração (só service_role)
-- -----------------------------------------------------------------------------
alter table public.produtos enable row level security;
revoke all on public.produtos from anon, authenticated;
revoke execute on function public.fn_upsert_produto(jsonb) from public, anon, authenticated;
grant  execute on function public.fn_upsert_produto(jsonb) to service_role;
