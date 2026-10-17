-- ============================================================================
-- SESSAO-33 · migration 89 — A FILA DO TINY PARA AS DUAS CONTAS E PARA A API
-- NOVA (D-142, D-143 — pedido do dono de 16/10: "puxar de uma vez TODOS os
-- dados do Tiny, sem exceção (...) e deixar o Tiny atualizando sempre que algo
-- for atualizado lá — sem ficar procurando de 1 em 1 minuto")
--
-- A automação que já existe ("subir banco de dados — tiny → supabase", a fila
-- genérica que o banco acorda) vira o trabalhador de TUDO, sem fluxo paralelo:
--
--   1. `tiny_fila` ganha a CONTA (loja | fábrica — cada uma com o seu token) e
--      a ESPERA (`nao_antes`: nova tentativa com espera crescente; o "limite do
--      Tiny" espera sem gastar tentativa). O único passa a ser (conta, recurso,
--      chave); os tipos de dado novos entram na lista.
--   2. O BANCO diz o que pedir: `plt_privado.fn_tiny_recursos()` (o catálogo —
--      API, endereço, se é busca, lista ou detalhe) e `fn_tiny_fila_lote` (o
--      lote já com a chamada montada). O n8n só pede e devolve a resposta crua.
--   3. O BANCO entende a resposta: `fn_tiny_fila_resposta` — erro, página
--      vazia, "não existe", limite, próxima página, detalhe de cada registro,
--      gravação. A conferência das 3h segue pelas MESMAS rotinas de sempre
--      (`fn_backfill_aplicar`), com a mesma resposta de antes.
--   4. Onde mora cada dado (banco enxuto — D-47): o que já tem casa fica nela
--      (pedidos, clientes, notas e contas a receber da LOJA; produtos da
--      FÁBRICA). O resto — contas a pagar, o que é da fábrica, cadastros
--      pequenos, estoque por depósito, compras — numa tabela só,
--      `plt_tiny_registros`, guardado como o Tiny mandou (grava só se mudou).
--      A estrutura dos móveis em `plt_produto_componentes` (a plataforma mostra
--      e, na próxima sessão, usa na baixa por setor — D-142/D-143).
--   5. Alerta de erro (pendência P1): item da fila que desiste e erro de
--      qualquer automação do n8n (`plt_fn_automacao_erro`) → aviso no sino do
--      dono + linha na Auditoria, sem repetir o mesmo aviso em seguida.
--
-- COMPATÍVEL com o fluxo de hoje (o banco pode subir antes do n8n): a porta
-- antiga do lote (`fn_fila_proximos`) só entrega o que o fluxo antigo sabe
-- fazer (conta da loja, os 8 tipos de sempre); `fn_backfill_aplicar` e
-- `fn_backfill_falha` mantêm a forma. O fluxo novo usa `fn_tiny_fila_lote` +
-- `fn_tiny_fila_resposta`.
--
-- Tabela da INTEGRAÇÃO (`tiny_fila`) — com o OK do dono (D-143, plano
-- aprovado inteiro). Na aplicação: criar ANTES, fora de transação,
--   create unique index concurrently if not exists tiny_fila_conta_chave_uq
--     on public.tiny_fila (conta, recurso, chave);
-- (a coluna `conta` precisa existir — rodar antes só o `alter table … add
-- column` do item 1, que é instantâneo) e então aplicar este arquivo.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 0 · a assinatura antiga da Auditoria (a 88 foi aplicada pelo conector, que
--     não roda DROP — E-108 — e a deixou fora da API, no esquema privado)
-- ----------------------------------------------------------------------------
drop function if exists plt_privado.plt_fn_auditoria_conferencias_antiga(integer, integer);

-- ----------------------------------------------------------------------------
-- 1 · tiny_fila: a conta, a espera e os tipos novos
-- ----------------------------------------------------------------------------
alter table public.tiny_fila add column if not exists conta text not null default 'loja';
alter table public.tiny_fila add column if not exists nao_antes timestamptz;

comment on column public.tiny_fila.conta is
  'SESSAO-33 (D-142): de qual conta do Tiny é a linha — loja (TINY_TOKEN no n8n) ou fabrica (TINY_FABRICA_TOKEN). O fluxo escolhe o token por aqui.';
comment on column public.tiny_fila.nao_antes is
  'SESSAO-33: a linha só volta a ser pega depois deste horário — nova tentativa com espera crescente (2, 4, 8 min) e espera do limite do Tiny (1 → 30 min, sem gastar tentativa). Nulo = já pode.';

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.tiny_fila'::regclass and conname = 'tiny_fila_conta_ck') then
    alter table public.tiny_fila add constraint tiny_fila_conta_ck check (conta in ('loja', 'fabrica'));
  end if;
end $$;

alter table public.tiny_fila drop constraint if exists tiny_fila_recurso_ck;
alter table public.tiny_fila add constraint tiny_fila_recurso_ck check (recurso = any (array[
  -- os 8 de sempre (carga histórica e conferência das 3h)
  'pedidos_pesquisa', 'pedido', 'contatos_pesquisa', 'contato',
  'nf_pesquisa', 'nota_fiscal', 'cr_pesquisa', 'conta_receber',
  -- SESSAO-33: o resto da API v2
  'cp_pesquisa', 'conta_pagar', 'produtos_pesquisa', 'produto', 'estrutura', 'estoque',
  'vendedores_pesquisa', 'formas_recebimento', 'formas_envio',
  'listas_precos', 'lista_preco_excecoes', 'categorias_produto', 'info',
  -- SESSAO-33: a API nova (v3), pela ponte segura
  'v3_produtos_alterados', 'v3_depositos', 'v3_ordens_compra', 'v3_ordem_compra',
  'v3_categorias_financeiras', 'v3_formas_pagamento', 'v3_marcas', 'v3_producao'
]::text[]));

create unique index if not exists tiny_fila_conta_chave_uq
  on public.tiny_fila (conta, recurso, chave);
alter table public.tiny_fila drop constraint if exists tiny_fila_chave_uq;

-- o trabalho conta a conta, na ordem da vez: o lote e o "tem trabalho?" andam
-- no índice — a fábrica fica de fora inteira na madrugada dela e a carga
-- pausada (a prioridade 9) fica fora pelo teto, sem varrer o que espera (Lei
-- §7.2; ensaio ×100 com 3 milhões de linhas da carga na fila)
create index if not exists tiny_fila_trabalho_conta_idx
  on public.tiny_fila (conta, prioridade, id) where status = 'pendente';
drop index if exists public.tiny_fila_trabalho_idx;  -- o de antes, sem a conta
-- os últimos erros e as páginas das contas a pagar da carga (as somas mês a
-- mês) sem varrer a fila; a contagem lê as suas linhas pelo próprio índice
create index if not exists tiny_fila_erro_idx
  on public.tiny_fila (processado_em desc nulls last) where status = 'erro';
-- as que esperam a nova tentativa (poucas): o relógio sabe se ainda há o que
-- esperar sem varrer a fila
create index if not exists tiny_fila_espera_idx
  on public.tiny_fila (nao_antes) where status = 'pendente' and nao_antes is not null;
create index if not exists tiny_fila_cp_carga_idx
  on public.tiny_fila ((params->>'carga')) where recurso = 'cp_pesquisa' and params ? 'carga';
create index if not exists tiny_fila_censo_idx
  on public.tiny_fila ((params->>'censo')) where params ? 'censo';

-- ----------------------------------------------------------------------------
-- 2 · Onde mora o que não tem casa: plt_tiny_registros (uma tabela só — D-47)
-- ----------------------------------------------------------------------------
create table if not exists public.plt_tiny_registros (
  conta      text not null check (conta in ('loja', 'fabrica')),
  tipo       text not null,
  chave      text not null,
  raw        jsonb not null,
  hash       text not null,
  gravado_em timestamptz not null default now(),
  primary key (conta, tipo, chave)
);

comment on table public.plt_tiny_registros is
  'SESSAO-33 (D-142/D-143): tudo o que vem do Tiny e ainda não tem tabela própria — contas a pagar, o que é da conta da fábrica (contatos, pedidos, notas, contas a receber), cadastros pequenos (vendedores, formas, listas de preço, categorias, depósitos, marcas), estoque por depósito, pedidos de compra, etapas de produção. Guardado como o Tiny mandou (raw); grava só quando o conteúdo muda (hash — D-50). Quando uma tela precisar de um desses dados, ganha porta própria (ou tabela própria, se for filtrar muito).';
comment on column public.plt_tiny_registros.tipo is
  'O tipo de dado (conta_pagar, contato, pedido, nota_fiscal, conta_receber, produto, estoque, estrutura, vendedor, forma_recebimento, forma_envio, lista_preco, lista_preco_excecao, categorias_produto, empresa, deposito, categoria_financeira, forma_pagamento, marca, ordem_compra, producao).';
comment on column public.plt_tiny_registros.gravado_em is
  'Quando o conteúdo foi gravado pela última vez (só muda quando o Tiny mandou algo diferente).';

alter table public.plt_tiny_registros enable row level security;
revoke all on public.plt_tiny_registros from public, anon, authenticated;

-- o resumo do mês do que tem data e valor (as contas a pagar), mantido no mesmo
-- gesto que grava o registro (fn_tiny_registrar): o painel da carga confere as
-- somas mês a mês sem varrer os registros (Lei §6 — projeção para leitura)
create table if not exists public.plt_tiny_registros_mes (
  conta text    not null,
  tipo  text    not null,
  mes   date    not null,
  n     bigint  not null default 0,
  soma  numeric not null default 0,
  primary key (conta, tipo, mes)
);

comment on table public.plt_tiny_registros_mes is
  'SESSAO-33 (Lei de desempenho §6): quantos registros e quanto somam, por conta, tipo e mês (pela data do registro) — hoje só as contas a pagar. Mantido por fn_tiny_registrar no mesmo gesto (entra o novo, sai o antigo quando o Tiny mudou o registro). Lido pelo painel da carga ("bateu com o Tiny?").';

alter table public.plt_tiny_registros_mes enable row level security;
revoke all on public.plt_tiny_registros_mes from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2b · A carga do dono: o interruptor e as contas prontas (Lei §6/§7 — ensaio
--      ×100: pausar 3 milhões de linhas uma a uma estourava o tempo da
--      requisição; contar o andamento a cada abertura do painel também)
-- ----------------------------------------------------------------------------
create table if not exists public.plt_tiny_controle (
  id              smallint primary key default 1 check (id = 1),
  carga_pausada   boolean not null default false,
  ultima_contagem text,
  ultima_carga    text,
  atualizado_em   timestamptz not null default now()
);
insert into public.plt_tiny_controle (id) values (1) on conflict (id) do nothing;

comment on table public.plt_tiny_controle is
  'SESSAO-33: uma linha só. carga_pausada = o gesto "Pausar" do dono — a fila deixa de pegar a prioridade 9 (a contagem e a carga; o que a venda e a conferência pedem sempre passa), sem mexer em linha nenhuma da fila. ultima_contagem/ultima_carga = a rodada mais recente de cada gesto (o painel lê por aqui).';

alter table public.plt_tiny_controle enable row level security;
revoke all on public.plt_tiny_controle from public, anon, authenticated;

create table if not exists public.plt_tiny_carga_contagem (
  rodada  text   not null,
  conta   text   not null,
  recurso text   not null,
  status  text   not null,
  n       bigint not null default 0,
  primary key (rodada, conta, recurso, status)
);

comment on table public.plt_tiny_carga_contagem is
  'SESSAO-33 (Lei de desempenho §6): quantas linhas de cada rodada da carga estão em cada situação, por conta e tipo de dado — mantido pelos gatilhos da tiny_fila no mesmo gesto (entra, muda de situação, sai). O painel da carga lê daqui em vez de contar a fila.';

alter table public.plt_tiny_carga_contagem enable row level security;
revoke all on public.plt_tiny_carga_contagem from public, anon, authenticated;

-- a prioridade mais alta que a fila pega agora: 9 (tudo) ou 8 (carga pausada)
create or replace function plt_privado.fn_tiny_fila_teto()
returns smallint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when coalesce((select c.carga_pausada from public.plt_tiny_controle c where c.id = 1), false)
              then 8 else 9 end::smallint
$$;

-- as contas da carga, no mesmo gesto que mexe na fila
create or replace function plt_privado.fn_tiny_carga_contar_novos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.plt_tiny_carga_contagem as c (rodada, conta, recurso, status, n)
  select x.params->>'carga', x.conta, x.recurso, x.status, count(*)
    from novos x
   where x.params ? 'carga'
   group by 1, 2, 3, 4
  on conflict (rodada, conta, recurso, status) do update set n = c.n + excluded.n;
  return null;
end;
$$;

create or replace function plt_privado.fn_tiny_carga_contar_mudanca()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.params ? 'carga' then
    update public.plt_tiny_carga_contagem c
       set n = c.n - 1
     where c.rodada = old.params->>'carga' and c.conta = old.conta
       and c.recurso = old.recurso and c.status = old.status;
  end if;
  if new.params ? 'carga' then
    insert into public.plt_tiny_carga_contagem as c (rodada, conta, recurso, status, n)
    values (new.params->>'carga', new.conta, new.recurso, new.status, 1)
    on conflict (rodada, conta, recurso, status) do update set n = c.n + 1;
  end if;
  return null;
end;
$$;

create or replace function plt_privado.fn_tiny_carga_contar_apagados()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.plt_tiny_carga_contagem c
     set n = c.n - x.k
    from (select v.params->>'carga' as rodada, v.conta, v.recurso, v.status, count(*) as k
            from velhos v
           where v.params ? 'carga'
           group by 1, 2, 3, 4) x
   where c.rodada = x.rodada and c.conta = x.conta and c.recurso = x.recurso and c.status = x.status;
  return null;
end;
$$;

drop trigger if exists plt_tiny_fila_carga_novos on public.tiny_fila;
create trigger plt_tiny_fila_carga_novos
  after insert on public.tiny_fila
  referencing new table as novos
  for each statement execute function plt_privado.fn_tiny_carga_contar_novos();

drop trigger if exists plt_tiny_fila_carga_mudanca on public.tiny_fila;
create trigger plt_tiny_fila_carga_mudanca
  after update on public.tiny_fila
  for each row
  when ((old.params ? 'carga' or new.params ? 'carga')
        and (old.status is distinct from new.status
             or (old.params->>'carga') is distinct from (new.params->>'carga')
             or old.conta is distinct from new.conta
             or old.recurso is distinct from new.recurso))
  execute function plt_privado.fn_tiny_carga_contar_mudanca();

drop trigger if exists plt_tiny_fila_carga_apagados on public.tiny_fila;
create trigger plt_tiny_fila_carga_apagados
  after delete on public.tiny_fila
  referencing old table as velhos
  for each statement execute function plt_privado.fn_tiny_carga_contar_apagados();

-- ----------------------------------------------------------------------------
-- 3 · A estrutura dos móveis: plt_produto_componentes (móvel → peças → insumos)
-- ----------------------------------------------------------------------------
create table if not exists public.plt_produto_componentes (
  produto_tiny_id    bigint not null references public.produtos(tiny_id) on delete cascade,
  componente_tiny_id bigint not null,
  quantidade         numeric(14,4) not null,
  codigo             text,
  nome               text,
  lido_em            timestamptz not null default now(),
  primary key (produto_tiny_id, componente_tiny_id)
);

comment on table public.plt_produto_componentes is
  'SESSAO-33 (D-142, resposta 3: "as estruturas que já existem no Tiny ficam ligadas na plataforma — móvel → peças → insumos"): os componentes de cada produto da FÁBRICA com a quantidade, lidos de produto.obter.estrutura (API v2). O componente pode não estar no catálogo espelhado — por isso o SKU e o nome que o Tiny mandou ficam junto. Relida inteira a cada leitura (o que saiu da estrutura no Tiny sai daqui).';

create index if not exists plt_produto_componentes_componente_idx
  on public.plt_produto_componentes (componente_tiny_id);

alter table public.plt_produto_componentes enable row level security;
revoke all on public.plt_produto_componentes from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4 · O catálogo: o que pedir para cada tipo de linha
-- ----------------------------------------------------------------------------
-- tipo: 'pesquisa' (a lista traz só o resumo — cada registro vira uma linha de
-- detalhe), 'lista' (a lista já traz o registro inteiro — guarda direto) e
-- 'detalhe' (um registro pelo id = a chave da linha). Fontes de cada endereço:
-- [[N8N - Tiny - Mapa Completo da API e dos Dados]] (§4).
create or replace function plt_privado.fn_tiny_recursos()
returns table (recurso text, api text, endpoint text, tipo text, detalhe text,
               prioridade smallint, registro text, campo_id text, rotulo text)
language sql
immutable
set search_path = public, pg_temp
as $$
  select r.recurso, r.api, r.endpoint, r.tipo, r.detalhe, r.prioridade::smallint,
         r.registro, r.campo_id, r.rotulo
    from (values
      ('pedidos_pesquisa',          'v2', 'pedidos.pesquisa.php',            'pesquisa', 'pedido',               1, null,                   null, 'pedidos de venda'),
      ('pedido',                    'v2', 'pedido.obter.php',                'detalhe',  null,                   2, 'pedido',               'id', 'pedido de venda'),
      ('contatos_pesquisa',         'v2', 'contatos.pesquisa.php',           'pesquisa', 'contato',              3, null,                   null, 'clientes e fornecedores'),
      ('contato',                   'v2', 'contato.obter.php',               'detalhe',  null,                   4, 'contato',              'id', 'cliente ou fornecedor'),
      ('nf_pesquisa',               'v2', 'notas.fiscais.pesquisa.php',      'pesquisa', 'nota_fiscal',          5, null,                   null, 'notas fiscais'),
      ('nota_fiscal',               'v2', 'nota.fiscal.obter.php',           'detalhe',  null,                   6, 'nota_fiscal',          'id', 'nota fiscal'),
      ('cr_pesquisa',               'v2', 'contas.receber.pesquisa.php',     'pesquisa', 'conta_receber',        7, null,                   null, 'contas a receber'),
      ('conta_receber',             'v2', 'conta.receber.obter.php',         'detalhe',  null,                   8, 'conta_receber',        'id', 'conta a receber'),
      ('cp_pesquisa',               'v2', 'contas.pagar.pesquisa.php',       'pesquisa', 'conta_pagar',          7, null,                   null, 'contas a pagar'),
      ('conta_pagar',               'v2', 'conta.pagar.obter.php',           'detalhe',  null,                   8, 'conta_pagar',          'id', 'conta a pagar'),
      ('produtos_pesquisa',         'v2', 'produtos.pesquisa.php',           'pesquisa', 'produto',              5, null,                   null, 'produtos'),
      ('produto',                   'v2', 'produto.obter.php',               'detalhe',  null,                   6, 'produto',              'id', 'produto'),
      ('estrutura',                 'v2', 'produto.obter.estrutura.php',     'detalhe',  null,                   6, 'estrutura',            'id', 'estrutura do móvel'),
      ('estoque',                   'v2', 'produto.obter.estoque.php',       'detalhe',  null,                   6, 'estoque',              'id', 'estoque por depósito'),
      ('vendedores_pesquisa',       'v2', 'vendedores.pesquisa.php',         'lista',    null,                   5, 'vendedor',             null, 'vendedores'),
      ('formas_recebimento',        'v2', 'formas.recebimento.pesquisa.php', 'lista',    null,                   5, 'forma_recebimento',    null, 'formas de recebimento'),
      ('formas_envio',              'v2', 'formas.envio.pesquisa.php',       'lista',    null,                   5, 'forma_envio',          null, 'formas de envio'),
      ('listas_precos',             'v2', 'listas.precos.pesquisa.php',      'lista',    'lista_preco_excecoes', 5, 'lista_preco',          null, 'listas de preço'),
      ('lista_preco_excecoes',      'v2', 'listas.precos.excecoes.php',      'lista',    null,                   6, 'lista_preco_excecao',  null, 'exceções das listas de preço'),
      ('categorias_produto',        'v2', 'produtos.categorias.arvore.php',  'detalhe',  null,                   5, 'categorias_produto',   null, 'categorias de produto'),
      ('info',                      'v2', 'info.php',                        'detalhe',  null,                   5, 'empresa',              null, 'dados da empresa'),
      ('v3_produtos_alterados',     'v3', '/produtos',                       'pesquisa', 'produto',              3, null,                   null, 'produtos alterados'),
      ('v3_depositos',              'v3', '/depositos',                      'lista',    null,                   5, 'deposito',             null, 'depósitos'),
      ('v3_ordens_compra',          'v3', '/ordem-compra',                   'pesquisa', 'v3_ordem_compra',      5, null,                   null, 'pedidos de compra'),
      ('v3_ordem_compra',           'v3', '/ordem-compra/{id}',              'detalhe',  null,                   6, 'ordem_compra',         null, 'pedido de compra'),
      ('v3_categorias_financeiras', 'v3', '/categorias-receita-despesa',     'lista',    null,                   5, 'categoria_financeira', null, 'categorias financeiras'),
      ('v3_formas_pagamento',       'v3', '/formas-pagamento',               'lista',    null,                   5, 'forma_pagamento',      null, 'formas de pagamento'),
      ('v3_marcas',                 'v3', '/marcas',                         'lista',    null,                   5, 'marca',                null, 'marcas'),
      ('v3_producao',               'v3', '/produtos/{id}/fabricado',        'detalhe',  null,                   6, 'producao',             null, 'etapas de produção')
    ) as r(recurso, api, endpoint, tipo, detalhe, prioridade, registro, campo_id, rotulo)
$$;

comment on function plt_privado.fn_tiny_recursos() is
  'SESSAO-33: o catálogo da fila do Tiny — para cada tipo de linha, a API (v2 | v3), o endereço, se é busca/lista/detalhe, o tipo do detalhe de cada registro, a prioridade, onde guarda (registro) e o rótulo em português. Fontes: N8N - Tiny - Mapa Completo da API e dos Dados.';

-- (o número do Tiny vira numeric pela plt_privado.fn_tiny_numero de sempre — migration 42)


-- os filtros que vão ao Tiny: os parâmetros da linha menos as marcas internas
create or replace function plt_privado.fn_tiny_campos(p_params jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(p_params, '{}'::jsonb)
         - array['janela', 'rodada', 'motivo', 'inicio', 'censo', 'carga', 'reabrir',
                 'origem', 'registros', 'soma', 'resumo_em', 'numero_paginas', 'ultima',
                 'mudanca', 'desde', 'limite_n', 'total', 'pedido', 'mudou', 'nova',
                 'situacao_antes', 'aqui', 'aqui_em']::text[]
$$;

-- a chamada pronta de uma linha (o n8n só junta o token da conta e manda)
create or replace function plt_privado.fn_tiny_requisicao(p_fila public.tiny_fila)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  r        record;
  v_campos jsonb;
begin
  select * into r from plt_privado.fn_tiny_recursos() x where x.recurso = p_fila.recurso;
  if r.recurso is null then
    return jsonb_build_object('id', p_fila.id, 'conta', p_fila.conta, 'recurso', p_fila.recurso,
                              'chave', p_fila.chave, 'api', null);
  end if;

  if r.tipo = 'detalhe' then
    v_campos := case when r.campo_id is not null
                     then jsonb_build_object(r.campo_id, p_fila.chave)
                     else '{}'::jsonb end;
  else
    v_campos := plt_privado.fn_tiny_campos(p_fila.params);
    if r.api = 'v2' and not (v_campos ? 'pagina') then
      v_campos := v_campos || jsonb_build_object('pagina', 1);
    end if;
    if r.api = 'v3' then
      v_campos := jsonb_build_object('limit', 100, 'offset', 0) || v_campos;
    end if;
  end if;

  if r.api = 'v2' then
    v_campos := jsonb_build_object('formato', 'JSON') || v_campos;
  end if;

  return jsonb_build_object(
    'id',      p_fila.id,
    'conta',   p_fila.conta,
    'recurso', p_fila.recurso,
    'chave',   p_fila.chave,
    'api',     r.api,
    'url',     case when r.api = 'v2' then 'https://api.tiny.com.br/api2/' || r.endpoint end,
    'caminho', case when r.api = 'v3' then replace(r.endpoint, '{id}', p_fila.chave) end,
    'campos',  v_campos);
end;
$$;

-- a conta da fábrica não disputa a cota com as varreduras da madrugada dela
-- (catálogo às 03:15, estoque às 04:00 — horário da fábrica)
create or replace function plt_privado.fn_tiny_fabrica_em_varredura()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select (now() at time zone 'America/Fortaleza')::time between time '03:10' and time '04:40'
$$;

-- ----------------------------------------------------------------------------
-- 5 · Enfileirar, guardar e alertar (as peças que tudo o resto usa)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_enfileirar(
  p_conta text, p_recurso text, p_chave text, p_referencia text,
  p_prioridade integer, p_params jsonb, p_reabrir boolean default true)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v integer;
begin
  if nullif(trim(coalesce(p_chave, '')), '') is null then
    return 0;
  end if;
  insert into public.tiny_fila as f (conta, recurso, chave, referencia, prioridade, params)
  values (p_conta, p_recurso, trim(p_chave), nullif(trim(coalesce(p_referencia, '')), ''),
          coalesce(p_prioridade, 5)::smallint, coalesce(p_params, '{}'::jsonb))
  on conflict (conta, recurso, chave) do update
     set status        = 'pendente',
         tentativas    = 0,
         erro          = null,
         reservado_em  = null,
         processado_em = null,
         nao_antes     = null,
         referencia    = coalesce(excluded.referencia, f.referencia),
         prioridade    = least(f.prioridade, excluded.prioridade),
         params        = excluded.params
   where p_reabrir and f.status <> 'processando';
  get diagnostics v = row_count;
  return v;
end;
$$;

-- o mesmo, para muitas linhas numa instrução só (a carga — Lei §7: uma linha
-- por vez, à mão, estoura o tempo da requisição com o catálogo ×100).
-- p_linhas: [{conta, recurso, chave, referencia, prioridade, params}, …]
create or replace function plt_privado.fn_tiny_enfileirar_varios(
  p_linhas jsonb, p_reabrir boolean default true)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v integer;
begin
  insert into public.tiny_fila as f (conta, recurso, chave, referencia, prioridade, params)
  select distinct on (x.conta, x.recurso, trim(x.chave))
         x.conta, x.recurso, trim(x.chave), nullif(trim(coalesce(x.referencia, '')), ''),
         coalesce(x.prioridade, 5)::smallint, coalesce(x.params, '{}'::jsonb)
    from jsonb_to_recordset(coalesce(p_linhas, '[]'::jsonb))
           as x(conta text, recurso text, chave text, referencia text, prioridade integer, params jsonb)
   where nullif(trim(coalesce(x.chave, '')), '') is not null
   order by x.conta, x.recurso, trim(x.chave)
  on conflict (conta, recurso, chave) do update
     set status        = 'pendente',
         tentativas    = 0,
         erro          = null,
         reservado_em  = null,
         processado_em = null,
         nao_antes     = null,
         referencia    = coalesce(excluded.referencia, f.referencia),
         prioridade    = least(f.prioridade, excluded.prioridade),
         params        = excluded.params
   where p_reabrir and f.status <> 'processando';
  get diagnostics v = row_count;
  return v;
end;
$$;

-- o resumo do mês (plt_tiny_registros_mes): soma (p_sinal = 1) ou tira (-1) um
-- registro do mês da data dele; data que não é data não entra (nunca derruba a
-- gravação do registro)
create or replace function plt_privado.fn_tiny_registros_mes_somar(
  p_conta text, p_tipo text, p_raw jsonb, p_sinal integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mes date;
begin
  if coalesce(p_raw->>'data', '') !~ '^\d{2}/\d{2}/\d{4}$' then
    return;
  end if;
  begin
    v_mes := date_trunc('month', to_date(p_raw->>'data', 'DD/MM/YYYY'))::date;
  exception when others then
    return;
  end;
  insert into public.plt_tiny_registros_mes as m (conta, tipo, mes, n, soma)
  values (p_conta, p_tipo, v_mes, p_sinal,
          p_sinal * coalesce(plt_privado.fn_tiny_numero(p_raw->>'valor'), 0))
  on conflict (conta, tipo, mes) do update
     set n = m.n + excluded.n, soma = m.soma + excluded.soma;
end;
$$;

create or replace function plt_privado.fn_tiny_registrar(
  p_conta text, p_tipo text, p_chave text, p_raw jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash  text := md5(p_raw::text);
  v_velho public.plt_tiny_registros;
begin
  if p_tipo <> 'conta_pagar' then
    insert into public.plt_tiny_registros as t (conta, tipo, chave, raw, hash)
    values (p_conta, p_tipo, p_chave, p_raw, v_hash)
    on conflict (conta, tipo, chave) do update
       set raw = excluded.raw, hash = excluded.hash, gravado_em = now()
     where t.hash is distinct from excluded.hash;
    return;
  end if;
  -- as contas a pagar levam o resumo do mês junto (sai o antigo, entra o novo)
  select * into v_velho from public.plt_tiny_registros t
   where t.conta = p_conta and t.tipo = p_tipo and t.chave = p_chave
     for update;
  if found and v_velho.hash = v_hash then
    return;
  end if;
  insert into public.plt_tiny_registros as t (conta, tipo, chave, raw, hash)
  values (p_conta, p_tipo, p_chave, p_raw, v_hash)
  on conflict (conta, tipo, chave) do update
     set raw = excluded.raw, hash = excluded.hash, gravado_em = now();
  if v_velho.chave is not null then
    perform plt_privado.fn_tiny_registros_mes_somar(p_conta, p_tipo, v_velho.raw, -1);
  end if;
  perform plt_privado.fn_tiny_registros_mes_somar(p_conta, p_tipo, p_raw, 1);
end;
$$;

-- o alerta (P1): uma linha na Auditoria SEMPRE; o aviso no sino do dono só se
-- não houve o mesmo aviso (a mesma chave, guardada como aviso_id — a tela da
-- Auditoria não mostra o que termina em _id) dentro do intervalo
create or replace function plt_privado.fn_tiny_alertar(
  p_chave text, p_titulo text, p_corpo text, p_contexto jsonb,
  p_intervalo interval default interval '1 hour')
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ja boolean;
begin
  select exists (select 1 from public.plt_logs_atividade l
                  where l.acao = 'automacao_erro'
                    and l.criado_em > now() - p_intervalo
                    and l.contexto->>'aviso_id' = p_chave)
    into v_ja;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (null, 'automacao_erro',
          coalesce(p_contexto, '{}'::jsonb)
          || jsonb_build_object('aviso_id', p_chave, 'titulo', p_titulo, 'corpo', left(p_corpo, 600)));

  if not v_ja then
    insert into public.plt_notificacoes (destinatario_id, tipo, titulo, corpo)
    select u.id, 'automacao_erro', p_titulo, left(p_corpo, 600)
      from public.plt_usuarios u
     where u.ativo and u.super_admin;
  end if;
  return not v_ja;
end;
$$;

-- a linha que desistiu (4 tentativas) avisa — uma vez por hora por tipo de dado
create or replace function plt_privado.fn_tiny_alertar_fila(p_fila public.tiny_fila)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  select plt_privado.fn_tiny_alertar(
    'fila:' || p_fila.conta || ':' || p_fila.recurso,
    'A integração com o Tiny desistiu de um item',
    'Depois de 4 tentativas, não deu para ler ' ||
      coalesce((select x.rotulo from plt_privado.fn_tiny_recursos() x where x.recurso = p_fila.recurso), p_fila.recurso) ||
      ' (conta ' || case p_fila.conta when 'fabrica' then 'da fábrica' else 'da loja' end || ', ' ||
      coalesce(p_fila.referencia, p_fila.chave) || '): ' || coalesce(p_fila.erro, 'sem descrição') ||
      '. Os outros itens seguem; este fica na Auditoria → Carga do Tiny.',
    jsonb_build_object('origem', 'fila_tiny', 'conta', p_fila.conta,
                       'tipo_de_dado', coalesce((select x.rotulo from plt_privado.fn_tiny_recursos() x where x.recurso = p_fila.recurso), p_fila.recurso),
                       'item', coalesce(p_fila.referencia, p_fila.chave), 'erro', p_fila.erro, 'fila_id', p_fila.id),
    interval '1 hour');
$$;

-- falhou: tentativa + 1 e espera crescente (2, 4, 8 min); na 4ª desiste e avisa
create or replace function plt_privado.fn_tiny_fila_falhou(
  p_fila_id bigint, p_erro text, p_terminal boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  f public.tiny_fila;
begin
  update public.tiny_fila
     set tentativas    = tentativas + 1,
         erro          = left(coalesce(p_erro, 'erro sem descrição'), 500),
         status        = case when p_terminal then 'vazio'
                              when tentativas + 1 >= 4 then 'erro'
                              else 'pendente' end,
         reservado_em  = null,
         processado_em = now(),
         nao_antes     = case when p_terminal or tentativas + 1 >= 4 then null
                              else now() + make_interval(mins => power(2, tentativas + 1)::integer) end
   where id = p_fila_id
  returning * into f;
  if f.status = 'erro' then
    perform plt_privado.fn_tiny_alertar_fila(f);
  end if;
  return jsonb_build_object('tentativas', f.tentativas, 'status', f.status);
end;
$$;

-- o "limite do Tiny" (v2: erro 6/11; v3: 429/503): espera 1, 2, 4… até 30 min,
-- sem gastar tentativa — não é falha do item
create or replace function plt_privado.fn_tiny_fila_esperar(p_fila_id bigint, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vezes integer;
begin
  update public.tiny_fila
     set status       = 'pendente',
         reservado_em = null,
         erro         = left(coalesce(p_motivo, 'limite do Tiny'), 500),
         nao_antes    = now() + make_interval(mins => least(power(2, coalesce((params->>'limite_n')::integer, 0))::integer, 30)),
         params       = params || jsonb_build_object('limite_n', coalesce((params->>'limite_n')::integer, 0) + 1)
   where id = p_fila_id
  returning (params->>'limite_n')::integer into v_vezes;
  return jsonb_build_object('esperar', true, 'vezes', v_vezes);
end;
$$;

-- ----------------------------------------------------------------------------
-- 6 · A resposta do Tiny: v2 (envelope "retorno") e v2 em lista
-- ----------------------------------------------------------------------------
-- a lista de uma busca da v2: o 1º valor que é lista, cada registro
-- desembrulhado ([{pedido:{...}}] → {...}) — a mesma regra do fluxo de antes
create or replace function plt_privado.fn_tiny_v2_lista(p_retorno jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  with chave as (
    select k.key, k.value
      from jsonb_each(case when jsonb_typeof(p_retorno) = 'object' then p_retorno else '{}'::jsonb end) k
     where jsonb_typeof(k.value) = 'array'
     limit 1
  )
  select coalesce(jsonb_agg(
           case when jsonb_typeof(x.e) = 'object'
                 and (select count(*) from jsonb_object_keys(x.e)) = 1
                 and jsonb_typeof(x.e -> (select k2 from jsonb_object_keys(x.e) k2 limit 1)) = 'object'
                then x.e -> (select k2 from jsonb_object_keys(x.e) k2 limit 1)
                else x.e end
           order by x.ordem), '[]'::jsonb)
    from chave c, jsonb_array_elements(c.value) with ordinality as x(e, ordem)
$$;

-- o registro de um detalhe da v2: o 1º valor-objeto que não é "envelope"
create or replace function plt_privado.fn_tiny_v2_detalhe(p_retorno jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select k.value
    from jsonb_each(case when jsonb_typeof(p_retorno) = 'object' then p_retorno else '{}'::jsonb end) k
   where k.key <> all (array['status', 'status_processamento', 'codigo_erro', 'erros',
                             'pagina', 'numero_paginas', 'registros']::text[])
     and jsonb_typeof(k.value) = 'object'
   limit 1
$$;

-- a estrutura de um produto da fábrica, relida inteira: o que saiu no Tiny sai daqui
create or replace function plt_privado.fn_tiny_estrutura_gravar(p_conta text, p_produto bigint, p_reg jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer := 0;
begin
  if p_conta <> 'fabrica' or p_produto is null
     or not exists (select 1 from public.produtos p where p.tiny_id = p_produto) then
    return 0;
  end if;

  -- um componente que aparece em duas linhas da estrutura soma as quantidades
  with itens as (
    select coalesce(x->'item', x->'componente', x) as i
      from jsonb_array_elements(case when jsonb_typeof(p_reg->'estrutura') = 'array'
                                     then p_reg->'estrutura' else '[]'::jsonb end) x
  ), novos as (
    select c.componente, sum(coalesce(c.quantidade, 0)) as quantidade, max(c.codigo) as codigo, max(c.nome) as nome
      from (select nullif(regexp_replace(coalesce(i->>'id_componente', i->>'idComponente', i->>'id', ''), '\D', '', 'g'), '')::bigint as componente,
                   plt_privado.fn_tiny_numero(i->>'quantidade') as quantidade,
                   nullif(trim(coalesce(i->>'codigo', '')), '') as codigo,
                   nullif(trim(coalesce(i->>'nome', i->>'descricao', '')), '') as nome
              from itens) c
     where c.componente is not null
     group by c.componente
  ), sairam as (
    delete from public.plt_produto_componentes pc
     where pc.produto_tiny_id = p_produto
       and not exists (select 1 from novos n where n.componente = pc.componente_tiny_id)
    returning 1
  )
  insert into public.plt_produto_componentes as pc
         (produto_tiny_id, componente_tiny_id, quantidade, codigo, nome, lido_em)
  select p_produto, n.componente, n.quantidade, n.codigo, n.nome, now()
    from novos n
  on conflict (produto_tiny_id, componente_tiny_id) do update
     set quantidade = excluded.quantidade, codigo = excluded.codigo,
         nome = excluded.nome, lido_em = now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7 · O lote do fluxo NOVO: já com a chamada montada
-- ----------------------------------------------------------------------------
create or replace function public.fn_tiny_fila_lote(p_limite integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lote    jsonb;
  v_lim     integer;
  v_teto    smallint;
  v_fabrica boolean;
begin
  -- o lote que travou (pego há mais de 15 min) volta para a fila
  update public.tiny_fila f
     set status = 'pendente', reservado_em = null
   where f.status = 'processando'
     and f.reservado_em < now() - interval '15 minutes';

  v_lim := least(greatest(coalesce(p_limite, 30), 0), 100);
  v_teto := plt_privado.fn_tiny_fila_teto();
  v_fabrica := not plt_privado.fn_tiny_fabrica_em_varredura();

  -- os candidatos de cada conta saem do índice na ordem da vez (a fábrica fica
  -- de fora inteira na madrugada dela; a carga pausada, pelo teto); depois,
  -- só os que ninguém pegou no meio do caminho
  with candidatos as (
    (select f.id, f.prioridade from public.tiny_fila f
      where f.conta = 'loja' and f.status = 'pendente' and f.prioridade <= v_teto
        and f.tentativas < 4 and (f.nao_antes is null or f.nao_antes <= now())
      order by f.prioridade, f.id
      limit v_lim)
    union all
    (select f.id, f.prioridade from public.tiny_fila f
      where v_fabrica and f.conta = 'fabrica' and f.status = 'pendente' and f.prioridade <= v_teto
        and f.tentativas < 4 and (f.nao_antes is null or f.nao_antes <= now())
      order by f.prioridade, f.id
      limit v_lim)
  ), escolhidos as (
    select c.id from candidatos c order by c.prioridade, c.id limit v_lim
  ), proximos as (
    select f.id
      from public.tiny_fila f
     where f.id in (select e.id from escolhidos e)
       and f.status = 'pendente'
       for update skip locked
  ), reservados as (
    update public.tiny_fila f
       set status = 'processando', reservado_em = now()
      from proximos x
     where f.id = x.id
    returning f.id
  )
  -- (a leitura de fora vê a linha de antes da reserva — só o status muda, e a
  -- chamada não depende dele)
  select coalesce(jsonb_agg(plt_privado.fn_tiny_requisicao(t) order by t.prioridade, t.id), '[]'::jsonb)
    into v_lote
    from public.tiny_fila t
   where t.id in (select rv.id from reservados rv);
  return v_lote;
end;
$$;

comment on function public.fn_tiny_fila_lote(integer) is
  'SESSAO-33: o lote do fluxo novo do n8n — reserva até p_limite linhas prontas (pendentes, sem espera, a fábrica fora das varreduras da madrugada dela) e devolve cada uma com a chamada montada: conta, api (v2 | v3), url ou caminho e os campos. O n8n junta o token da conta (v2) ou chama a ponte (v3) e devolve a resposta crua em fn_tiny_fila_resposta.';

-- ----------------------------------------------------------------------------
-- 7b · "Quantos aqui?" — calculado UMA vez, quando a contagem do Tiny chega
--      (o painel só lê; Lei §6). Os que vão mês a mês (pedidos, notas e contas
--      a receber da loja) contam o mês; o resto conta o que já está guardado.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_aqui(p_conta text, p_recurso text, p_ini date, p_fim date)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo text;
begin
  if p_conta = 'loja' and p_recurso = 'pedidos_pesquisa' and p_ini is not null then
    return (select count(*) from public.pedidos p
             where p.data_pedido between p_ini and p_fim
               and not exists (select 1 from public.plt_pedidos_excluidos_tiny x where x.pedido_id = p.id));
  elsif p_conta = 'loja' and p_recurso = 'nf_pesquisa' and p_ini is not null then
    return (select count(*) from public.notas_fiscais n where n.data_emissao between p_ini and p_fim);
  elsif p_conta = 'loja' and p_recurso = 'cr_pesquisa' and p_ini is not null then
    return (select count(*) from public.contas_receber cr where cr.data_emissao between p_ini and p_fim);
  elsif p_conta = 'loja' and p_recurso = 'contatos_pesquisa' then
    return (select count(*) from public.clientes cl where cl.tiny_id_contato is not null);
  elsif p_conta = 'fabrica' and p_recurso = 'produtos_pesquisa' then
    return (select count(*) from public.produtos);
  end if;
  select coalesce(d.registro, x.registro) into v_tipo
    from plt_privado.fn_tiny_recursos() x
    left join plt_privado.fn_tiny_recursos() d on d.recurso = x.detalhe
   where x.recurso = p_recurso;
  if v_tipo is null then
    return null;
  end if;
  return (select count(*) from public.plt_tiny_registros t where t.conta = p_conta and t.tipo = v_tipo);
end;
$$;

-- ----------------------------------------------------------------------------
-- 8 · A resposta: o banco entende o que o Tiny devolveu
-- ----------------------------------------------------------------------------
-- p_resposta (do n8n):
--   v2 → {"api": "v2", "corpo": <o JSON que o Tiny devolveu>}
--   v3 → {"api": "v3", "status": <HTTP>, "corpo": <JSON>}  (ou {"erro": "sem_token"})
create or replace function public.fn_tiny_fila_resposta(p_fila_id bigint, p_resposta jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  f          public.tiny_fila;
  r          record;
  v_api      text;
  v_status   integer;
  v_corpo    jsonb := p_resposta->'corpo';
  v_ret      jsonb;
  v_cod      text;
  v_erro     text;
  v_lista    jsonb;
  v_reg      jsonb;
  v_pag      integer;
  v_total    integer;
  v_offset   integer;
  v_limit    integer;
  v_tot      integer;
  v_n        integer := 0;
  v_soma     numeric := 0;
  v_reabrir  boolean;
  v_legado   boolean;
  v_origem   text;
  v_prio_det integer;
  v_novos    jsonb;
  v_janela   text;
  v_feito    jsonb;
begin
  select * into f from public.tiny_fila where id = p_fila_id for update;
  if not found then
    return jsonb_build_object('ignorado', 'a linha não existe');
  end if;
  if f.status <> 'processando' then
    return jsonb_build_object('ignorado', 'a linha não estava em andamento', 'status', f.status);
  end if;

  select * into r from plt_privado.fn_tiny_recursos() x where x.recurso = f.recurso;
  v_api     := coalesce(nullif(p_resposta->>'api', ''), r.api, 'v2');
  v_reabrir := coalesce((f.params->>'reabrir')::boolean, false);
  v_origem  := nullif(f.params->>'origem', '');
  -- as linhas de sempre (conferência das 3h e as reabertas à mão) seguem pelas
  -- MESMAS rotinas do fluxo antigo, com a mesma resposta
  v_legado  := f.conta = 'loja' and v_origem is null
               and f.recurso = any (array['pedidos_pesquisa', 'pedido', 'contatos_pesquisa', 'contato',
                                          'nf_pesquisa', 'nota_fiscal', 'cr_pesquisa', 'conta_receber']);

  -- ---------- erros ----------
  if v_api = 'v3' then
    v_status := coalesce(nullif(p_resposta->>'status', '')::integer, 0);
    if v_status = 0 and p_resposta->>'erro' = 'sem_token' then
      return plt_privado.fn_tiny_fila_falhou(f.id, 'A API nova desta conta ainda não foi ligada', true);
    elsif v_status in (429, 503) then
      return plt_privado.fn_tiny_fila_esperar(f.id, 'limite da API nova (' || v_status || ')');
    elsif v_status = 404 then
      return plt_privado.fn_tiny_fila_falhou(f.id, 'não existe no Tiny (404)', true);
    elsif v_status <> 200 then
      return plt_privado.fn_tiny_fila_falhou(f.id,
        'a API nova respondeu ' || v_status || ': ' || left(coalesce(v_corpo::text, p_resposta->>'erro', ''), 300), false);
    end if;
  else
    -- a árvore de categorias da v2 pode vir como lista solta
    if jsonb_typeof(v_corpo) = 'array' then
      v_ret := jsonb_build_object('status', 'OK', 'lista', v_corpo);
    else
      v_ret := coalesce(v_corpo->'retorno', v_corpo);
    end if;
    if v_ret is null or jsonb_typeof(v_ret) <> 'object' or not (v_ret ? 'status') then
      v_erro := 'sem envelope retorno: ' || left(coalesce(v_corpo::text, ''), 300);
      if v_legado then
        return public.fn_backfill_falha(f.id, v_erro, false);
      end if;
      return plt_privado.fn_tiny_fila_falhou(f.id, v_erro, false);
    end if;
    v_cod := coalesce(v_ret->>'codigo_erro', '');
    if upper(coalesce(v_ret->>'status', '')) <> 'OK' then
      v_erro := 'codigo ' || v_cod || ': ' || coalesce(
        (select string_agg(coalesce(e->>'erro', e#>>'{}'), ' | ')
           from jsonb_array_elements(case when jsonb_typeof(v_ret->'erros') = 'array'
                                          then v_ret->'erros' else '[]'::jsonb end) e),
        v_ret->>'status');
      if v_cod = '20' and r.tipo in ('pesquisa', 'lista') then
        v_lista := '[]'::jsonb;                                    -- janela vazia: não é erro
      elsif v_cod in ('6', '11') then
        return plt_privado.fn_tiny_fila_esperar(f.id, v_erro);     -- limite do minuto / concorrência
      elsif v_legado then
        return public.fn_backfill_falha(f.id, v_erro, v_cod = '32');
      elsif v_cod = '32' or (v_cod = '20' and r.tipo = 'detalhe') then
        return plt_privado.fn_tiny_fila_falhou(f.id, v_erro, true); -- não existe: não adianta repetir
      else
        return plt_privado.fn_tiny_fila_falhou(f.id, v_erro, false);
      end if;
    end if;
  end if;

  -- ---------- buscas e listas ----------
  if r.tipo in ('pesquisa', 'lista') then
    if v_api = 'v3' then
      v_lista  := case when jsonb_typeof(v_corpo->'itens') = 'array' then v_corpo->'itens' else '[]'::jsonb end;
      v_offset := coalesce(nullif(v_corpo->'paginacao'->>'offset', '')::integer, nullif(f.params->>'offset', '')::integer, 0);
      v_limit  := coalesce(nullif(v_corpo->'paginacao'->>'limit', '')::integer, nullif(f.params->>'limit', '')::integer, 100);
      v_tot    := nullif(v_corpo->'paginacao'->>'total', '')::integer;
    else
      if v_lista is null then
        v_lista := plt_privado.fn_tiny_v2_lista(v_ret);
      end if;
      v_pag   := coalesce(nullif(v_ret->>'pagina', '')::integer, nullif(f.params->>'pagina', '')::integer, 1);
      v_total := coalesce(nullif(v_ret->>'numero_paginas', '')::integer, v_pag);
    end if;
    v_n    := jsonb_array_length(v_lista);
    v_soma := coalesce((select sum(plt_privado.fn_tiny_numero(coalesce(x->>'valor', x->>'valor_nota', x->>'total_pedido', x->>'valorTotal')))
                          from jsonb_array_elements(v_lista) x), 0);

    -- a busca de sempre: a mesma entrada que o fluxo antigo montava
    if v_legado then
      select coalesce(jsonb_agg(jsonb_build_object(
               'recurso', r.detalhe,
               'chave', x->>'id',
               'referencia', coalesce(x->>'numero', x->>'numero_documento', x->>'nome', ''),
               'prioridade', (select d.prioridade from plt_privado.fn_tiny_recursos() d where d.recurso = r.detalhe))),
             '[]'::jsonb)
        into v_novos
        from jsonb_array_elements(v_lista) x
       where nullif(x->>'id', '') is not null;
      if v_pag < v_total then
        v_novos := v_novos || jsonb_build_array(jsonb_build_object(
          'recurso', f.recurso,
          'chave', case when f.params ? 'janela' then f.params->>'janela' || ':p' || (v_pag + 1) else 'p' || (v_pag + 1) end,
          'prioridade', f.prioridade,
          'params', f.params || jsonb_build_object('pagina', v_pag + 1)));
      end if;
      return public.fn_backfill_aplicar(f.id, f.recurso, v_novos);
    end if;

    -- a contagem ("censo"): a 1ª página diz quantas páginas há; lê só a última
    if f.params ? 'censo' then
      if v_api = 'v2' and not coalesce((f.params->>'ultima')::boolean, false) and v_total > 1 then
        perform plt_privado.fn_tiny_enfileirar(f.conta, f.recurso, f.chave || ':ultima', f.referencia, f.prioridade,
                                               f.params || jsonb_build_object('pagina', v_total, 'ultima', true), true);
      end if;
      update public.tiny_fila
         set status = 'ok', processado_em = now(), erro = null, nao_antes = null,
             params = params || jsonb_build_object('registros', v_n, 'numero_paginas', v_total, 'total', v_tot)
                      -- o "quantos aqui" do mesmo instante (a 1ª página; a última só completa o total)
                      || case when coalesce((f.params->>'ultima')::boolean, false) then '{}'::jsonb
                              else jsonb_build_object('aqui', plt_privado.fn_tiny_aqui(
                                     f.conta, f.recurso,
                                     to_date(coalesce(f.params->>'dataInicial', f.params->>'data_ini_emissao'), 'DD/MM/YYYY'),
                                     to_date(coalesce(f.params->>'dataFinal', f.params->>'data_fim_emissao'), 'DD/MM/YYYY')),
                                   'aqui_em', now()) end
       where id = f.id;
      return jsonb_build_object('ok', true, 'censo', true, 'registros', v_n, 'paginas', v_total, 'total', v_tot);
    end if;

    -- a lista já traz o registro inteiro: guarda cada um
    if r.tipo = 'lista' and r.registro is not null then
      perform plt_privado.fn_tiny_registrar(f.conta, r.registro,
                coalesce(nullif(x->>'id', ''), md5(x::text)), x)
         from jsonb_array_elements(v_lista) x;
    end if;

    -- o detalhe de cada registro (a carga vai devagar, atrás de todo o resto)
    if r.detalhe is not null then
      v_prio_det := case when v_origem = 'carga' then 9
                         else (select d.prioridade from plt_privado.fn_tiny_recursos() d where d.recurso = r.detalhe) end;
      perform plt_privado.fn_tiny_enfileirar(
                f.conta, r.detalhe, x->>'id',
                coalesce(x->>'numero', x->>'numero_documento', x->>'codigo', x->>'nome', x->>'descricao', ''),
                v_prio_det,
                jsonb_build_object('origem', coalesce(v_origem, 'busca'))
                  || case when f.params ? 'carga' then jsonb_build_object('carga', f.params->>'carga') else '{}'::jsonb end
                  || case when r.detalhe = 'lista_preco_excecoes'
                          then jsonb_build_object('idListaPreco', x->>'id', 'pagina', 1,
                                                  'janela', 'excecoes:' || (x->>'id'))
                          else '{}'::jsonb end,
                v_reabrir)
         from jsonb_array_elements(v_lista) x
        where nullif(x->>'id', '') is not null;
    end if;

    -- a próxima página
    v_janela := coalesce(f.params->>'janela', f.chave);
    if v_api = 'v2' and v_pag < v_total then
      perform plt_privado.fn_tiny_enfileirar(f.conta, f.recurso, v_janela || ':p' || (v_pag + 1), f.referencia,
                                             f.prioridade, f.params || jsonb_build_object('pagina', v_pag + 1), true);
    elsif v_api = 'v3' and v_tot is not null and v_offset + v_limit < v_tot then
      perform plt_privado.fn_tiny_enfileirar(f.conta, f.recurso, v_janela || ':o' || (v_offset + v_limit), f.referencia,
                                             f.prioridade, f.params || jsonb_build_object('offset', v_offset + v_limit, 'limit', v_limit), true);
    end if;

    update public.tiny_fila
       set status = 'ok', processado_em = now(), erro = null, nao_antes = null,
           params = params || jsonb_build_object('registros', v_n, 'soma', v_soma)
                            || case when v_api = 'v2' then jsonb_build_object('numero_paginas', v_total)
                                    else jsonb_build_object('total', v_tot) end
     where id = f.id;
    return jsonb_build_object('ok', true, 'registros', v_n);
  end if;

  -- ---------- detalhe ----------
  v_reg := case when v_api = 'v3' then v_corpo else plt_privado.fn_tiny_v2_detalhe(v_ret) end;
  if v_reg is null and v_api = 'v2' then
    -- a árvore de categorias vem como lista, não como objeto
    select jsonb_build_object('lista', k.value) into v_reg
      from jsonb_each(v_ret) k
     where jsonb_typeof(k.value) = 'array' and k.key <> 'erros'
     limit 1;
  end if;
  if v_reg is null then
    if v_legado then
      return public.fn_backfill_falha(f.id, 'retorno OK sem objeto de detalhe', false);
    end if;
    return plt_privado.fn_tiny_fila_falhou(f.id, 'retorno OK sem objeto de detalhe', false);
  end if;

  if f.conta = 'loja' and f.recurso in ('pedido', 'contato', 'nota_fiscal', 'conta_receber') then
    -- as tabelas da loja: pelas mesmas rotinas de sempre (que fecham a linha)
    return public.fn_backfill_aplicar(f.id, f.recurso, v_reg);
  elsif f.conta = 'fabrica' and f.recurso = 'produto' then
    perform public.fn_upsert_produto(v_reg);
  elsif f.recurso = 'estrutura' then
    perform plt_privado.fn_tiny_estrutura_gravar(f.conta, nullif(regexp_replace(f.chave, '\D', '', 'g'), '')::bigint, v_reg);
    perform plt_privado.fn_tiny_registrar(f.conta, 'estrutura', f.chave, v_reg);
  else
    perform plt_privado.fn_tiny_registrar(f.conta, coalesce(r.registro, f.recurso), f.chave, v_reg);
  end if;

  update public.tiny_fila
     set status = 'ok', processado_em = now(), erro = null, nao_antes = null
   where id = f.id;
  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.fn_tiny_fila_resposta(bigint, jsonb) is
  'SESSAO-33: a resposta do Tiny (crua, do n8n) entendida no banco — erro (vazio = não é erro; não existe = encerra; limite = espera sem gastar tentativa; o resto = nova tentativa com espera crescente, e na 4ª o alerta), busca (detalhe de cada registro + próxima página), lista (guarda cada registro), contagem (só a 1ª e a última página) e detalhe (loja: pedidos/clientes/notas/contas a receber pelas rotinas de sempre; fábrica: produtos pelo fn_upsert_produto e a estrutura; o resto em plt_tiny_registros). A conferência das 3h passa pelas mesmas rotinas do fluxo antigo.';

-- ----------------------------------------------------------------------------
-- 9 · O fluxo ANTIGO continua funcionando (até o novo ser importado em casa)
-- ----------------------------------------------------------------------------
-- só entrega o que ele sabe fazer: a conta da loja e os 8 tipos de sempre — e
-- respeita a espera
create or replace function public.fn_fila_proximos(p_limite integer default 30)
returns table(id bigint, recurso text, chave text, referencia text, params jsonb)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.tiny_fila f
     set status = 'pendente', reservado_em = null
   where f.status = 'processando'
     and f.reservado_em < now() - interval '15 minutes';

  return query
  with proximos as (
    select f.id
      from public.tiny_fila f
     where f.status = 'pendente' and f.tentativas < 4
       and f.conta = 'loja'
       and f.prioridade <= plt_privado.fn_tiny_fila_teto()
       and f.recurso = any (array['pedidos_pesquisa', 'pedido', 'contatos_pesquisa', 'contato',
                                  'nf_pesquisa', 'nota_fiscal', 'cr_pesquisa', 'conta_receber'])
       and (f.nao_antes is null or f.nao_antes <= now())
     order by f.prioridade, f.id
     limit greatest(coalesce(p_limite, 30), 0)
       for update skip locked
  )
  update public.tiny_fila f
     set status = 'processando', reservado_em = now()
    from proximos x
   where f.id = x.id
  returning f.id, f.recurso, f.chave, f.referencia, f.params;
end;
$function$;

-- a falha do fluxo antigo ganha a espera crescente e o alerta (mesma forma)
create or replace function public.fn_backfill_falha(p_fila_id bigint, p_erro text, p_terminal boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  f public.tiny_fila;
begin
  update public.tiny_fila
     set tentativas    = tentativas + 1,
         erro          = left(coalesce(p_erro, 'erro sem descricao'), 500),
         status        = case when p_terminal then 'vazio'
                              when tentativas + 1 >= 4 then 'erro'
                              else 'pendente' end,
         reservado_em  = null,
         processado_em = now(),
         nao_antes     = case when p_terminal or tentativas + 1 >= 4 then null
                              else now() + make_interval(mins => power(2, tentativas + 1)::integer) end
   where id = p_fila_id
  returning * into f;
  if f.status = 'erro' then
    perform plt_privado.fn_tiny_alertar_fila(f);
  end if;
  return jsonb_build_object('tentativas', f.tentativas);
end;
$function$;

-- chamar o n8n só quando há linha que ele PODE pegar agora (a que espera não conta)
create or replace function plt_privado.fn_tiny_fila_precisa_chamar()
returns boolean
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
-- conta a conta, na ordem do índice (o teto e a madrugada da fábrica resolvidos
-- uma vez): com a carga pausada, a busca para no fim da prioridade 8 em vez de
-- varrer as linhas da carga (ensaio ×100)
declare
  v_teto    smallint := plt_privado.fn_tiny_fila_teto();
  v_fabrica boolean  := not plt_privado.fn_tiny_fabrica_em_varredura();
begin
  if exists (select 1 from public.tiny_fila f
              where f.status = 'processando'
                and f.reservado_em >= now() - interval '15 minutes') then
    return false;
  end if;
  return exists (select 1 from (select f.id from public.tiny_fila f
                                 where f.conta = 'loja' and f.status = 'pendente' and f.prioridade <= v_teto
                                   and f.tentativas < 4 and (f.nao_antes is null or f.nao_antes <= now())
                                 order by f.prioridade, f.id
                                 limit 1) x)
      or (v_fabrica
          and exists (select 1 from (select f.id from public.tiny_fila f
                                      where f.conta = 'fabrica' and f.status = 'pendente' and f.prioridade <= v_teto
                                        and f.tentativas < 4 and (f.nao_antes is null or f.nao_antes <= now())
                                      order by f.prioridade, f.id
                                      limit 1) x));
end;
$function$;

-- as funções de sempre, recriadas a partir das versões vivas (migration 64)
-- só com o único novo: on conflict (conta, recurso, chave)
CREATE OR REPLACE FUNCTION plt_privado.fn_tiny_pente_fino_iniciar(p_motivo text DEFAULT 'madrugada'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_local   timestamp := now() at time zone 'America/Fortaleza';
  v_hoje    date      := (now() at time zone 'America/Fortaleza')::date;
  v_rodada  text      := to_char(now() at time zone 'America/Fortaleza', 'YYYY-MM-DD"T"HH24:MI:SS.US');
  v_busca   jsonb;
  v_abertos integer;
  v_contas  integer;                  -- ↪️ D-122: contas a receber ainda abertas
begin
  select f.params into v_busca from public.tiny_fila f
   where f.recurso = 'pedidos_pesquisa' and f.chave = 'pente-fino:p1';
  if v_busca->>'rodada' is not null and v_busca->>'resumo_em' is null then
    perform plt_privado.fn_tiny_pente_fino_resumir(v_busca->>'rodada', 'interrompida');
  end if;

  insert into public.tiny_fila as f (recurso, chave, referencia, prioridade, params)
  values ('pedidos_pesquisa', 'pente-fino:p1', 'conferência diária', 1,
          jsonb_build_object(
            'dataInicial', to_char(v_hoje - 60, 'DD/MM/YYYY'),
            'dataFinal',   to_char(v_hoje, 'DD/MM/YYYY'),
            'pagina',      1,
            'janela',      'pente-fino',
            'rodada',      v_rodada,
            'motivo',      coalesce(nullif(trim(p_motivo), ''), 'madrugada'),
            'inicio',      now()))
  on conflict (conta, recurso, chave) do update
     set status = 'pendente', tentativas = 0, erro = null, reservado_em = null,
         processado_em = null, referencia = excluded.referencia,
         prioridade = excluded.prioridade, params = excluded.params;

  insert into public.tiny_fila as f (recurso, chave, referencia, prioridade, params)
  select 'pedido', p.tiny_id::text, p.numero::text, 2, jsonb_build_object('rodada', v_rodada)
    from public.pedidos p
   where p.tiny_id is not null
     and plt_privado.fn_situacao_normalizada(p.situacao) not in ('entregue', 'nao_entregue', 'cancelado')
  on conflict (conta, recurso, chave) do update
     set status = 'pendente', tentativas = 0, erro = null, reservado_em = null,
         referencia = excluded.referencia, params = excluded.params
   where f.status <> 'processando';
  get diagnostics v_abertos = row_count;

  -- ↪️ SESSAO-30 (D-122): as CONTAS A RECEBER voltam a vir do Tiny, na mesma
  -- rodada: a busca pelas contas EMITIDAS nos últimos 60 dias (acha as novas —
  -- a releitura pula as que já fecharam, ver fn_backfill_aplicar) + a releitura
  -- das que ainda NÃO fecharam, de qualquer idade (pega o "pago" do dia).
  -- O fluxo do n8n não muda: a busca vai com os filtros daqui, palavra por palavra.
  insert into public.tiny_fila as f (recurso, chave, referencia, prioridade, params)
  values ('cr_pesquisa', 'pente-fino-cr:p1', 'conferência diária · contas a receber', 7,
          jsonb_build_object(
            'data_ini_emissao', to_char(v_hoje - 60, 'DD/MM/YYYY'),
            'data_fim_emissao', to_char(v_hoje, 'DD/MM/YYYY'),
            'pagina',           1,
            'janela',           'pente-fino-cr',
            'rodada',           v_rodada))
  on conflict (conta, recurso, chave) do update
     set status = 'pendente', tentativas = 0, erro = null, reservado_em = null,
         processado_em = null, referencia = excluded.referencia,
         prioridade = excluded.prioridade, params = excluded.params;

  insert into public.tiny_fila as f (recurso, chave, referencia, prioridade, params)
  select 'conta_receber', cr.tiny_id::text,
         coalesce(cr.numero_documento, cr.numero_pedido::text), 8,
         jsonb_build_object('rodada', v_rodada)
    from public.contas_receber cr
   where cr.tiny_id is not null
     and coalesce(cr.situacao, '') not in ('pago', 'cancelada')
  on conflict (conta, recurso, chave) do update
     set status = 'pendente', tentativas = 0, erro = null, reservado_em = null,
         referencia = excluded.referencia, params = excluded.params
   where f.status <> 'processando';
  get diagnostics v_contas = row_count;

  return jsonb_build_object('rodada', v_rodada, 'hora_local', v_local, 'nao_terminados', v_abertos,
                            'contas_abertas', v_contas)
         || plt_privado.fn_tiny_fila_acordar();
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_backfill_aplicar(p_fila_id bigint, p_recurso text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_n          integer := 0;
  v_cliente_id bigint;
  v_pedido_id  bigint;
  v_num_pedido integer;
  v_cpf        text;
  v_tiny_id    bigint;
  v_venda      bigint;
  v_cli        jsonb;
  v_nome       text;
  v_fone       text;
  v_rodada     text;                  -- SESSAO-29: a linha é da conferência diária?
  v_resultado  jsonb := '{}'::jsonb;
  v_sit_antes  text;                  -- ↪️ D-122: a situação da conta antes da releitura
  v_conta_nova boolean;
begin
  select nullif(f.params->>'rodada', '') into v_rodada
    from public.tiny_fila f where f.id = p_fila_id;

  if p_recurso like '%\_pesquisa' then
    if v_rodada is null then
      -- carga antiga: o que já está na fila não se mexe
      insert into public.tiny_fila (recurso, chave, referencia, prioridade, params)
      select x->>'recurso', x->>'chave', nullif(x->>'referencia',''),
             coalesce((x->>'prioridade')::smallint, 5),
             coalesce(x->'params', '{}'::jsonb)
        from jsonb_array_elements(coalesce(p_payload, '[]'::jsonb)) x
       where nullif(x->>'chave','') is not null
      on conflict (conta, recurso, chave) do nothing;
    else
      -- conferência: o pedido achado volta para a fila (uma vez por rodada; o
      -- que está sendo lido agora não se mexe) — a fila é única por recurso+chave
      insert into public.tiny_fila as f (recurso, chave, referencia, prioridade, params)
      select x->>'recurso', x->>'chave', nullif(x->>'referencia',''),
             coalesce((x->>'prioridade')::smallint, 5),
             coalesce(x->'params', '{}'::jsonb) || jsonb_build_object('rodada', v_rodada)
        from jsonb_array_elements(coalesce(p_payload, '[]'::jsonb)) x
       where nullif(x->>'chave','') is not null
         -- ↪️ D-122: a conta a receber que já FECHOU no Tiny (paga ou cancelada)
         -- não é relida — a releitura diária fica com as novas e as abertas
         and not (case when x->>'recurso' = 'conta_receber' and x->>'chave' ~ '^[0-9]{1,18}$'
                       then exists (select 1 from public.contas_receber cr
                                     where cr.tiny_id = (x->>'chave')::bigint
                                       and cr.situacao in ('pago', 'cancelada'))
                       else false end)
      on conflict (conta, recurso, chave) do update
         set status       = 'pendente',
             tentativas   = 0,
             erro         = null,
             reservado_em = null,
             referencia   = coalesce(excluded.referencia, f.referencia),
             params       = excluded.params
       where f.status <> 'processando'
         and coalesce(f.params->>'rodada', '') <> v_rodada;
    end if;
    get diagnostics v_n = row_count;
    update public.tiny_fila set status='ok', processado_em=now(), erro=null where id=p_fila_id;
    return jsonb_build_object('enfileirados', v_n);
  end if;

  if p_recurso = 'pedido' then
    if v_rodada is null then
      v_pedido_id := public.fn_upsert_pedido(
        p_payload, 'backfill',
        nullif(trim(coalesce(p_payload->>'id','')),'')::bigint, 'backfill');
    else
      perform set_config('domoby.pedido_mudancas', '[]', true);
      v_pedido_id := public.fn_upsert_pedido(
        p_payload, 'pente_fino',
        nullif(trim(coalesce(p_payload->>'id','')),'')::bigint, 'pente_fino');
      v_resultado := jsonb_build_object(
        'numero', p_payload->>'numero',
        'mudou',  coalesce(nullif(current_setting('domoby.pedido_mudancas', true), '')::jsonb, '[]'::jsonb));
    end if;

  elsif p_recurso = 'contato' then
    v_cpf     := nullif(trim(coalesce(p_payload->>'cpf_cnpj','')), '');
    v_tiny_id := nullif(trim(coalesce(p_payload->>'id','')), '')::bigint;
    if v_cpf is not null then
      select c.id into v_cliente_id from public.clientes c where c.cpf_cnpj = v_cpf;
    end if;
    if v_cliente_id is null and v_tiny_id is not null then
      select c.id into v_cliente_id from public.clientes c where c.tiny_id_contato = v_tiny_id limit 1;
    end if;
    if v_cliente_id is null then
      select c.id into v_cliente_id from public.clientes c
       where coalesce(c.cpf_cnpj,'')='' and c.nome = trim(coalesce(p_payload->>'nome',''))
         and coalesce(c.fone,'') = coalesce(nullif(trim(coalesce(p_payload->>'fone','')),''),'') limit 1;
    end if;
    if v_cliente_id is null then
      insert into public.clientes
        (cpf_cnpj, nome, fone, email, endereco, numero, complemento, bairro, cidade, uf,
         cep, rg, tiny_id_contato, tipo_pessoa, inscricao_estadual, fantasia, raw)
      values (v_cpf, trim(coalesce(p_payload->>'nome','')),
         nullif(trim(coalesce(p_payload->>'fone','')),''),
         nullif(trim(coalesce(p_payload->>'email','')),''),
         nullif(trim(coalesce(p_payload->>'endereco','')),''),
         nullif(trim(coalesce(p_payload->>'numero','')),''),
         nullif(trim(coalesce(p_payload->>'complemento','')),''),
         nullif(trim(coalesce(p_payload->>'bairro','')),''),
         nullif(trim(coalesce(p_payload->>'cidade','')),''),
         nullif(trim(coalesce(p_payload->>'uf','')),''),
         nullif(trim(coalesce(p_payload->>'cep','')),''),
         nullif(trim(coalesce(p_payload->>'rg','')),''),
         v_tiny_id,
         nullif(trim(coalesce(p_payload->>'tipo_pessoa','')),''),
         nullif(trim(coalesce(p_payload->>'ie','')),''),
         nullif(trim(coalesce(p_payload->>'fantasia','')),''),
         p_payload)
      returning id into v_cliente_id;
    else
      update public.clientes c set
        cpf_cnpj = coalesce(v_cpf, c.cpf_cnpj),
        nome = case when trim(coalesce(p_payload->>'nome',''))<>'' then trim(p_payload->>'nome') else c.nome end,
        fone = coalesce(nullif(trim(coalesce(p_payload->>'fone','')),''), c.fone),
        email = coalesce(nullif(trim(coalesce(p_payload->>'email','')),''), c.email),
        endereco = coalesce(nullif(trim(coalesce(p_payload->>'endereco','')),''), c.endereco),
        numero = coalesce(nullif(trim(coalesce(p_payload->>'numero','')),''), c.numero),
        complemento = coalesce(nullif(trim(coalesce(p_payload->>'complemento','')),''), c.complemento),
        bairro = coalesce(nullif(trim(coalesce(p_payload->>'bairro','')),''), c.bairro),
        cidade = coalesce(nullif(trim(coalesce(p_payload->>'cidade','')),''), c.cidade),
        uf = coalesce(nullif(trim(coalesce(p_payload->>'uf','')),''), c.uf),
        cep = coalesce(nullif(trim(coalesce(p_payload->>'cep','')),''), c.cep),
        rg = coalesce(nullif(trim(coalesce(p_payload->>'rg','')),''), c.rg),
        tiny_id_contato = coalesce(v_tiny_id, c.tiny_id_contato),
        tipo_pessoa = coalesce(nullif(trim(coalesce(p_payload->>'tipo_pessoa','')),''), c.tipo_pessoa),
        inscricao_estadual = coalesce(nullif(trim(coalesce(p_payload->>'ie','')),''), c.inscricao_estadual),
        fantasia = coalesce(nullif(trim(coalesce(p_payload->>'fantasia','')),''), c.fantasia),
        raw = p_payload, atualizado_em = now()
      where c.id = v_cliente_id;
    end if;

  elsif p_recurso = 'nota_fiscal' then
    v_venda := nullif(trim(coalesce(p_payload->>'id_venda','')),'')::bigint;
    if v_venda is not null then
      select p.id, p.numero into v_pedido_id, v_num_pedido from public.pedidos p where p.tiny_id = v_venda;
    end if;
    if v_pedido_id is null then
      v_num_pedido := nullif(regexp_replace(
        coalesce(p_payload->>'numero_pedido', p_payload->>'numero_ordem_compra',''), '\D','','g'),'')::integer;
      select p.id into v_pedido_id from public.pedidos p where p.numero = v_num_pedido;
    end if;
    v_cli := coalesce(p_payload->'cliente','{}'::jsonb);
    v_cpf := nullif(trim(coalesce(v_cli->>'cpf_cnpj','')),'');
    if v_cpf is not null then
      select c.id into v_cliente_id from public.clientes c where c.cpf_cnpj = v_cpf;
    end if;

    insert into public.notas_fiscais as nf
      (tiny_id, tipo_nota, serie, numero, chave_acesso, data_emissao, data_saida,
       situacao, descricao_situacao, valor_nota, valor_frete, valor_desconto,
       numero_pedido, pedido_id, cliente_id, raw)
    values
      (nullif(trim(coalesce(p_payload->>'id','')),'')::bigint,
       nullif(trim(coalesce(p_payload->>'tipo_nota','')),''),
       nullif(trim(coalesce(p_payload->>'serie','')),''),
       nullif(trim(coalesce(p_payload->>'numero','')),''),
       nullif(trim(coalesce(p_payload->>'chave_acesso','')),''),
       to_date(nullif(trim(coalesce(p_payload->>'data_emissao','')),''),'DD/MM/YYYY'),
       to_date(nullif(trim(coalesce(p_payload->>'data_saida','')),''),'DD/MM/YYYY'),
       nullif(trim(coalesce(p_payload->>'situacao','')),''),
       nullif(trim(coalesce(p_payload->>'descricao_situacao','')),''),
       nullif(replace(trim(coalesce(p_payload->>'valor_nota','')),',','.'),'')::numeric,
       nullif(replace(trim(coalesce(p_payload->>'valor_frete','')),',','.'),'')::numeric,
       nullif(replace(trim(coalesce(p_payload->>'valor_desconto','')),',','.'),'')::numeric,
       v_num_pedido, v_pedido_id, v_cliente_id, p_payload)
    on conflict (tiny_id) do update set
      tipo_nota=coalesce(excluded.tipo_nota,nf.tipo_nota), serie=coalesce(excluded.serie,nf.serie),
      numero=coalesce(excluded.numero,nf.numero), chave_acesso=coalesce(excluded.chave_acesso,nf.chave_acesso),
      data_emissao=coalesce(excluded.data_emissao,nf.data_emissao),
      data_saida=coalesce(excluded.data_saida,nf.data_saida),
      situacao=coalesce(excluded.situacao,nf.situacao),
      descricao_situacao=coalesce(excluded.descricao_situacao,nf.descricao_situacao),
      valor_nota=coalesce(excluded.valor_nota,nf.valor_nota),
      valor_frete=coalesce(excluded.valor_frete,nf.valor_frete),
      valor_desconto=coalesce(excluded.valor_desconto,nf.valor_desconto),
      numero_pedido=excluded.numero_pedido, pedido_id=coalesce(excluded.pedido_id,nf.pedido_id),
      cliente_id=coalesce(excluded.cliente_id,nf.cliente_id),
      raw=excluded.raw, atualizado_em=now();

  elsif p_recurso = 'conta_receber' then
    -- ↪️ D-122: na conferência, guarda na linha da fila o antes e o depois
    -- (o resumo da rodada conta as novas e as que foram pagas)
    if v_rodada is not null then
      select cr.situacao into v_sit_antes from public.contas_receber cr
       where cr.tiny_id = nullif(trim(coalesce(p_payload->>'id','')),'')::bigint;
      v_conta_nova := not found;
      v_resultado := jsonb_build_object(
        'nova',           v_conta_nova,
        'situacao_antes', v_sit_antes,
        'situacao',       nullif(trim(coalesce(p_payload->>'situacao','')),''));
    end if;
    -- nomes REAIS do payload (ver comentário no topo)
    v_num_pedido := nullif(public.fn_backfill_conta_mapear(p_payload)->>'numero_pedido','')::integer;
    if v_num_pedido is not null then
      select p.id into v_pedido_id from public.pedidos p where p.numero = v_num_pedido;
    end if;

    v_cli  := coalesce(p_payload->'cliente','{}'::jsonb);
    v_cpf  := nullif(trim(coalesce(v_cli->>'cpf_cnpj','')),'');
    v_nome := trim(coalesce(v_cli->>'nome',''));
    v_fone := nullif(trim(coalesce(v_cli->>'fone','')),'');
    if v_cpf is not null then
      select c.id into v_cliente_id from public.clientes c where c.cpf_cnpj = v_cpf;
    end if;
    if v_cliente_id is null and v_nome <> '' then
      select c.id into v_cliente_id from public.clientes c
       where coalesce(c.cpf_cnpj,'')='' and c.nome = v_nome
         and coalesce(c.fone,'') = coalesce(v_fone,'') limit 1;
    end if;
    if v_cliente_id is null and v_pedido_id is not null then
      select p.cliente_id into v_cliente_id from public.pedidos p where p.id = v_pedido_id;
    end if;

    insert into public.contas_receber as cr
      (tiny_id, numero_documento, numero_pedido, pedido_id, cliente_id, historico,
       categoria, data_emissao, data_vencimento, data_liquidacao, valor, saldo,
       situacao, forma_recebimento, meio_recebimento, raw)
    values
      (nullif(trim(coalesce(p_payload->>'id','')),'')::bigint,
       nullif(trim(coalesce(p_payload->>'nro_documento','')),''),
       v_num_pedido, v_pedido_id, v_cliente_id,
       nullif(trim(coalesce(p_payload->>'historico','')),''),
       nullif(trim(coalesce(p_payload->>'categoria','')),''),
       to_date(nullif(trim(coalesce(p_payload->>'data','')),''),'DD/MM/YYYY'),
       to_date(nullif(trim(coalesce(p_payload->>'vencimento','')),''),'DD/MM/YYYY'),
       to_date(nullif(trim(coalesce(p_payload->>'liquidacao','')),''),'DD/MM/YYYY'),
       nullif(replace(trim(coalesce(p_payload->>'valor','')),',','.'),'')::numeric,
       nullif(replace(trim(coalesce(p_payload->>'saldo','')),',','.'),'')::numeric,
       nullif(trim(coalesce(p_payload->>'situacao','')),''),
       nullif(trim(coalesce(p_payload->>'forma_pagamento','')),''),
       nullif(trim(coalesce(p_payload->>'portador','')),''),
       p_payload)
    on conflict (tiny_id) do update set
      numero_documento=coalesce(excluded.numero_documento,cr.numero_documento),
      numero_pedido=excluded.numero_pedido, pedido_id=coalesce(excluded.pedido_id,cr.pedido_id),
      cliente_id=coalesce(excluded.cliente_id,cr.cliente_id),
      historico=coalesce(excluded.historico,cr.historico),
      categoria=coalesce(excluded.categoria,cr.categoria),
      data_emissao=coalesce(excluded.data_emissao,cr.data_emissao),
      data_vencimento=coalesce(excluded.data_vencimento,cr.data_vencimento),
      data_liquidacao=coalesce(excluded.data_liquidacao,cr.data_liquidacao),
      valor=coalesce(excluded.valor,cr.valor), saldo=coalesce(excluded.saldo,cr.saldo),
      situacao=coalesce(excluded.situacao,cr.situacao),
      forma_recebimento=coalesce(excluded.forma_recebimento,cr.forma_recebimento),
      meio_recebimento=coalesce(excluded.meio_recebimento,cr.meio_recebimento),
      raw=excluded.raw, atualizado_em=now();

  else
    raise exception 'recurso desconhecido: %', p_recurso;
  end if;

  update public.tiny_fila
     set status = 'ok', processado_em = now(), erro = null,
         params = case when v_rodada is null then params else params || v_resultado end
   where id = p_fila_id;
  return jsonb_build_object('ok', true, 'pedido_id', v_pedido_id, 'cliente_id', v_cliente_id) || v_resultado;
end;
$function$;

-- ----------------------------------------------------------------------------
-- 10 · O alerta de erro das automações do n8n (pendência P1)
-- ----------------------------------------------------------------------------
-- o fluxo "Domoby · alerta de erro das automações" (gatilho de erro do n8n)
-- chama esta porta com {fluxo, no, mensagem, execucao}
create or replace function public.plt_fn_automacao_erro(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fluxo text := left(coalesce(nullif(trim(p->>'fluxo'), ''), 'automação sem nome'), 120);
  v_no    text := left(nullif(trim(coalesce(p->>'no', '')), ''), 120);
  v_msg   text := left(coalesce(nullif(trim(p->>'mensagem'), ''), 'erro sem descrição'), 400);
begin
  return jsonb_build_object('avisado', plt_privado.fn_tiny_alertar(
    'n8n:' || md5(v_fluxo),
    'Erro numa automação',
    'A automação "' || v_fluxo || '" parou' || coalesce(' no passo "' || v_no || '"', '') || ': ' || v_msg,
    jsonb_build_object('origem', 'n8n', 'fluxo', v_fluxo, 'no', v_no, 'mensagem', v_msg,
                       'execucao', left(coalesce(p->>'execucao', ''), 60)),
    interval '30 minutes'));
end;
$$;

comment on function public.plt_fn_automacao_erro(jsonb) is
  'SESSAO-33 (pendência P1): o fluxo de erro do n8n avisa aqui — linha na Auditoria (trilha, ação automacao_erro) sempre; aviso no sino do dono (super admin) uma vez a cada 30 min por automação. Só a chave de serviço chama.';

-- ----------------------------------------------------------------------------
-- 11 · Permissões: nada disto é porta do navegador
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_tiny_recursos() from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_campos(jsonb) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_requisicao(public.tiny_fila) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_fabrica_em_varredura() from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_enfileirar(text, text, text, text, integer, jsonb, boolean) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_registrar(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_alertar(text, text, text, jsonb, interval) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_alertar_fila(public.tiny_fila) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_fila_falhou(bigint, text, boolean) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_fila_esperar(bigint, text) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_v2_lista(jsonb) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_v2_detalhe(jsonb) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_estrutura_gravar(text, bigint, jsonb) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_fila_precisa_chamar() from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_fila_teto() from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_carga_contar_novos() from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_carga_contar_mudanca() from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_carga_contar_apagados() from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_registros_mes_somar(text, text, jsonb, integer) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_enfileirar_varios(jsonb, boolean) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_aqui(text, text, date, date) from public, anon, authenticated;

revoke all on function public.fn_tiny_fila_lote(integer) from public, anon, authenticated;
revoke all on function public.fn_tiny_fila_resposta(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.fn_fila_proximos(integer) from public, anon, authenticated;
revoke all on function public.fn_backfill_falha(bigint, text, boolean) from public, anon, authenticated;
revoke all on function public.fn_backfill_aplicar(bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.plt_fn_automacao_erro(jsonb) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fn_tiny_fila_lote(integer) to service_role;
    grant execute on function public.fn_tiny_fila_resposta(bigint, jsonb) to service_role;
    grant execute on function public.fn_fila_proximos(integer) to service_role;
    grant execute on function public.fn_backfill_falha(bigint, text, boolean) to service_role;
    grant execute on function public.fn_backfill_aplicar(bigint, text, jsonb) to service_role;
    grant execute on function public.plt_fn_automacao_erro(jsonb) to service_role;
  end if;
end $$;
