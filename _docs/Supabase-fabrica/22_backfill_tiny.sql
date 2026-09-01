-- =============================================================================
-- DOMOBY · Backfill histórico do Tiny  (migration 22)
-- Data: 28/08/2026 · Autor: Cowork
--
-- O que este arquivo faz, em quatro blocos:
--   1) BLINDAGEM  — pedido histórico ou já encerrado NÃO vira card no PCP
--   2) FILA       — tiny_fila: uma linha por chamada a fazer na API do Tiny
--   3) DESTINOS   — notas_fiscais, contas_receber, clientes.raw
--   4) PORTAS     — as 3 funções que o n8n chama (claim, aplicar, falhar)
--
-- Regra de ouro do banco: nada aqui inventa tabela ou coluna existente.
-- Fonte da verdade conferida ao vivo em 28/08/2026 antes de escrever.
-- =============================================================================


-- =============================================================================
-- 1) BLINDAGEM DO TRIGGER  (D-43)
-- =============================================================================
-- O trigger plt_pedidos_reagir cria um card no PCP a cada INSERT em pedidos.
-- Sem esta guarda, a carga de ~5.100 pedidos históricos criaria ~5.100 cards
-- no kanban da Plataforma.
--
-- Duas condições barram a entrada no quadro:
--   a) origem <> 'webhook'  → é histórico, não é venda acontecendo agora
--   b) situação encerrada   → entregue / não entregue / cancelado já morreu
--
-- O pedido continua entrando em `pedidos` normalmente — ele só não vira
-- trabalho de produção. O destino dele é o cofre Logística → Pedidos entregues.
--
-- COMO: o corpo de fn_reagir_pedido() NÃO é tocado (ele é do repo, migration
-- 18/21 — reescrever aqui criaria divergência entre o banco e o código). A
-- guarda entra na definição do gatilho, via cláusula WHEN, que o Postgres
-- avalia ANTES de chamar a função. Um gatilho para INSERT (com a guarda) e
-- outro para UPDATE (sem, porque UPDATE nunca cria card).

drop trigger if exists plt_pedidos_reagir on public.pedidos;

create trigger plt_pedidos_reagir_insercao
  after insert on public.pedidos
  for each row
  when (
    new.origem is not distinct from 'webhook'
    and lower(coalesce(new.situacao, '')) not in ('entregue', 'nao_entregue', 'cancelado')
  )
  execute function plt_privado.fn_reagir_pedido();

create trigger plt_pedidos_reagir_atualizacao
  after update on public.pedidos
  for each row
  execute function plt_privado.fn_reagir_pedido();


-- =============================================================================
-- 2) A FILA
-- =============================================================================
-- Uma linha = uma chamada a fazer na API do Tiny. A fila se auto-expande:
-- um item de *_pesquisa gera os itens de detalhe e a próxima página.
--
-- recurso:
--   pedidos_pesquisa   → pedidos.pesquisa.php        (paginado por mês)
--   pedido             → pedido.obter.php
--   contatos_pesquisa  → contatos.pesquisa.php       (paginado, sem data)
--   contato            → contato.obter.php
--   nf_pesquisa        → notas.fiscais.pesquisa.php  (paginado por mês)
--   nota_fiscal        → nota.fiscal.obter.php
--   cr_pesquisa        → contas.receber.pesquisa.php (paginado por mês)
--   conta_receber      → conta.receber.obter.php

create table if not exists public.tiny_fila (
  id            bigint generated always as identity primary key,
  recurso       text     not null,
  chave         text     not null,              -- id interno do Tiny, ou a janela da busca
  referencia    text,                           -- nº do pedido/NF — leitura humana
  params        jsonb    not null default '{}', -- dataInicial, dataFinal, pagina…
  prioridade    smallint not null default 5,
  status        text     not null default 'pendente',
  tentativas    smallint not null default 0,
  erro          text,
  criado_em     timestamptz not null default now(),
  reservado_em  timestamptz,
  processado_em timestamptz,
  constraint tiny_fila_recurso_ck check (recurso in (
    'pedidos_pesquisa','pedido','contatos_pesquisa','contato',
    'nf_pesquisa','nota_fiscal','cr_pesquisa','conta_receber')),
  constraint tiny_fila_status_ck check (status in
    ('pendente','processando','ok','erro','vazio')),
  constraint tiny_fila_chave_uq unique (recurso, chave)
);

comment on table public.tiny_fila is
  'Fila do backfill histórico do Tiny (D-43). Auto-expansível: um item *_pesquisa '
  'enfileira os detalhes e a página seguinte. Reprocessar de propósito: '
  'update tiny_fila set status=''pendente'', tentativas=0 where ...';

create index if not exists tiny_fila_trabalho_idx
  on public.tiny_fila (prioridade, id) where status = 'pendente';
create index if not exists tiny_fila_status_idx on public.tiny_fila (status);

alter table public.tiny_fila enable row level security;


-- =============================================================================
-- 3) OS DESTINOS
-- =============================================================================

-- 3.1 clientes ganha o payload cru do contato.obter (nada se perde)
alter table public.clientes add column if not exists raw jsonb;
alter table public.clientes add column if not exists tipo_pessoa text;
alter table public.clientes add column if not exists inscricao_estadual text;
alter table public.clientes add column if not exists fantasia text;

-- 3.2 notas fiscais
create table if not exists public.notas_fiscais (
  id             bigint generated always as identity primary key,
  tiny_id        bigint unique,
  tipo_nota      text,
  serie          text,
  numero         text,
  chave_acesso   text,
  data_emissao   date,
  data_saida     date,
  situacao       text,
  descricao_situacao text,
  valor_nota     numeric(14,2),
  valor_frete    numeric(14,2),
  valor_desconto numeric(14,2),
  numero_pedido  integer,
  pedido_id      bigint references public.pedidos(id)  on delete set null,
  cliente_id     bigint references public.clientes(id) on delete set null,
  raw            jsonb,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists notas_fiscais_pedido_idx  on public.notas_fiscais (numero_pedido);
create index if not exists notas_fiscais_data_idx    on public.notas_fiscais (data_emissao);
create index if not exists notas_fiscais_chave_idx   on public.notas_fiscais (chave_acesso);
alter table public.notas_fiscais enable row level security;

-- 3.3 contas a receber
create table if not exists public.contas_receber (
  id                bigint generated always as identity primary key,
  tiny_id           bigint unique,
  numero_documento  text,
  numero_pedido     integer,
  pedido_id         bigint references public.pedidos(id)  on delete set null,
  cliente_id        bigint references public.clientes(id) on delete set null,
  historico         text,
  categoria         text,
  data_emissao      date,
  data_vencimento   date,
  data_liquidacao   date,
  valor             numeric(14,2),
  saldo             numeric(14,2),
  situacao          text,
  forma_recebimento text,
  meio_recebimento  text,
  raw               jsonb,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index if not exists contas_receber_pedido_idx on public.contas_receber (numero_pedido);
create index if not exists contas_receber_venc_idx   on public.contas_receber (data_vencimento);
create index if not exists contas_receber_situacao_idx on public.contas_receber (situacao);
alter table public.contas_receber enable row level security;


-- =============================================================================
-- 4) AS PORTAS QUE O n8n CHAMA  (só três)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 4.1 fn_fila_proximos — reserva o próximo lote (claim-first, à prova de morte)
-- ---------------------------------------------------------------------------
create or replace function public.fn_fila_proximos(p_limite integer default 30)
returns table (id bigint, recurso text, chave text, referencia text, params jsonb)
language plpgsql security definer set search_path to 'public'
as $$
begin
  -- Execução que morreu no meio devolve o lote sozinha depois de 15 min.
  update public.tiny_fila f
     set status = 'pendente', reservado_em = null
   where f.status = 'processando'
     and f.reservado_em < now() - interval '15 minutes';

  return query
  with proximos as (
    select f.id
      from public.tiny_fila f
     where f.status = 'pendente' and f.tentativas < 4
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
$$;

-- ---------------------------------------------------------------------------
-- 4.2 fn_backfill_aplicar — grava o que o Tiny devolveu e fecha a linha da fila
--     p_payload:
--       *_pesquisa → array de itens novos para enfileirar
--       detalhe    → o objeto cru do retorno (retorno.pedido, retorno.contato…)
-- ---------------------------------------------------------------------------
create or replace function public.fn_backfill_aplicar(
  p_fila_id  bigint,
  p_recurso  text,
  p_payload  jsonb
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_n           integer := 0;
  v_cliente_id  bigint;
  v_pedido_id   bigint;
  v_num_pedido  integer;
  v_cpf         text;
  v_tiny_id     bigint;
  v_cli         jsonb;
begin
  -- ----- ramo A: resultado de busca → só enfileira ---------------------------
  if p_recurso like '%_pesquisa' then
    insert into public.tiny_fila (recurso, chave, referencia, prioridade, params)
    select x->>'recurso',
           x->>'chave',
           nullif(x->>'referencia', ''),
           coalesce((x->>'prioridade')::smallint, 5),
           coalesce(x->'params', '{}'::jsonb)
      from jsonb_array_elements(coalesce(p_payload, '[]'::jsonb)) x
     where nullif(x->>'chave', '') is not null
    on conflict (recurso, chave) do nothing;
    get diagnostics v_n = row_count;

    update public.tiny_fila
       set status = case when v_n = 0 then 'vazio' else 'ok' end,
           processado_em = now(), erro = null
     where id = p_fila_id;
    return jsonb_build_object('enfileirados', v_n);
  end if;

  -- ----- ramo B: PEDIDO ------------------------------------------------------
  if p_recurso = 'pedido' then
    v_pedido_id := public.fn_upsert_pedido(
      p_payload, 'backfill',
      nullif(trim(coalesce(p_payload->>'id','')),'')::bigint, 'backfill');

  -- ----- ramo C: CONTATO -----------------------------------------------------
  elsif p_recurso = 'contato' then
    v_cpf     := nullif(trim(coalesce(p_payload->>'cpf_cnpj','')), '');
    v_tiny_id := nullif(trim(coalesce(p_payload->>'id','')), '')::bigint;

    if v_cpf is not null then
      select c.id into v_cliente_id from public.clientes c where c.cpf_cnpj = v_cpf;
    end if;
    if v_cliente_id is null and v_tiny_id is not null then
      select c.id into v_cliente_id from public.clientes c
       where c.tiny_id_contato = v_tiny_id limit 1;
    end if;
    if v_cliente_id is null then
      select c.id into v_cliente_id from public.clientes c
       where coalesce(c.cpf_cnpj,'') = ''
         and c.nome = trim(coalesce(p_payload->>'nome',''))
         and coalesce(c.fone,'') = coalesce(nullif(trim(coalesce(p_payload->>'fone','')),''),'')
       limit 1;
    end if;

    if v_cliente_id is null then
      insert into public.clientes
        (cpf_cnpj, nome, fone, email, endereco, numero, complemento, bairro,
         cidade, uf, cep, rg, tiny_id_contato, tipo_pessoa, inscricao_estadual,
         fantasia, raw)
      values
        (v_cpf,
         trim(coalesce(p_payload->>'nome','')),
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
      -- coalesce: dado novo vazio NUNCA apaga dado existente
      update public.clientes c set
        cpf_cnpj           = coalesce(v_cpf, c.cpf_cnpj),
        nome               = case when trim(coalesce(p_payload->>'nome','')) <> ''
                                  then trim(p_payload->>'nome') else c.nome end,
        fone               = coalesce(nullif(trim(coalesce(p_payload->>'fone','')),''), c.fone),
        email              = coalesce(nullif(trim(coalesce(p_payload->>'email','')),''), c.email),
        endereco           = coalesce(nullif(trim(coalesce(p_payload->>'endereco','')),''), c.endereco),
        numero             = coalesce(nullif(trim(coalesce(p_payload->>'numero','')),''), c.numero),
        complemento        = coalesce(nullif(trim(coalesce(p_payload->>'complemento','')),''), c.complemento),
        bairro             = coalesce(nullif(trim(coalesce(p_payload->>'bairro','')),''), c.bairro),
        cidade             = coalesce(nullif(trim(coalesce(p_payload->>'cidade','')),''), c.cidade),
        uf                 = coalesce(nullif(trim(coalesce(p_payload->>'uf','')),''), c.uf),
        cep                = coalesce(nullif(trim(coalesce(p_payload->>'cep','')),''), c.cep),
        rg                 = coalesce(nullif(trim(coalesce(p_payload->>'rg','')),''), c.rg),
        tiny_id_contato    = coalesce(v_tiny_id, c.tiny_id_contato),
        tipo_pessoa        = coalesce(nullif(trim(coalesce(p_payload->>'tipo_pessoa','')),''), c.tipo_pessoa),
        inscricao_estadual = coalesce(nullif(trim(coalesce(p_payload->>'ie','')),''), c.inscricao_estadual),
        fantasia           = coalesce(nullif(trim(coalesce(p_payload->>'fantasia','')),''), c.fantasia),
        raw                = p_payload,
        atualizado_em      = now()
      where c.id = v_cliente_id;
    end if;

  -- ----- ramo D: NOTA FISCAL -------------------------------------------------
  elsif p_recurso = 'nota_fiscal' then
    v_num_pedido := nullif(regexp_replace(
      coalesce(p_payload->>'numero_pedido', p_payload->>'numero_ordem_compra',
               p_payload->>'id_venda', ''), '\D', '', 'g'), '')::integer;
    select p.id into v_pedido_id from public.pedidos p where p.numero = v_num_pedido;

    v_cli := coalesce(p_payload->'cliente', '{}'::jsonb);
    v_cpf := nullif(trim(coalesce(v_cli->>'cpf_cnpj','')), '');
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
       to_date(nullif(trim(coalesce(p_payload->>'data_emissao','')),''), 'DD/MM/YYYY'),
       to_date(nullif(trim(coalesce(p_payload->>'data_saida','')),''),   'DD/MM/YYYY'),
       nullif(trim(coalesce(p_payload->>'situacao','')),''),
       nullif(trim(coalesce(p_payload->>'descricao_situacao','')),''),
       nullif(replace(trim(coalesce(p_payload->>'valor_nota','')),     ',', '.'),'')::numeric,
       nullif(replace(trim(coalesce(p_payload->>'valor_frete','')),    ',', '.'),'')::numeric,
       nullif(replace(trim(coalesce(p_payload->>'valor_desconto','')), ',', '.'),'')::numeric,
       v_num_pedido, v_pedido_id, v_cliente_id, p_payload)
    on conflict (tiny_id) do update set
      tipo_nota = coalesce(excluded.tipo_nota, nf.tipo_nota),
      serie = coalesce(excluded.serie, nf.serie),
      numero = coalesce(excluded.numero, nf.numero),
      chave_acesso = coalesce(excluded.chave_acesso, nf.chave_acesso),
      data_emissao = coalesce(excluded.data_emissao, nf.data_emissao),
      data_saida = coalesce(excluded.data_saida, nf.data_saida),
      situacao = coalesce(excluded.situacao, nf.situacao),
      descricao_situacao = coalesce(excluded.descricao_situacao, nf.descricao_situacao),
      valor_nota = coalesce(excluded.valor_nota, nf.valor_nota),
      valor_frete = coalesce(excluded.valor_frete, nf.valor_frete),
      valor_desconto = coalesce(excluded.valor_desconto, nf.valor_desconto),
      numero_pedido = coalesce(excluded.numero_pedido, nf.numero_pedido),
      pedido_id = coalesce(excluded.pedido_id, nf.pedido_id),
      cliente_id = coalesce(excluded.cliente_id, nf.cliente_id),
      raw = excluded.raw,
      atualizado_em = now();

  -- ----- ramo E: CONTA A RECEBER --------------------------------------------
  elsif p_recurso = 'conta_receber' then
    v_num_pedido := nullif(regexp_replace(
      coalesce(p_payload->>'numero_pedido', p_payload->>'id_venda',
               p_payload->>'numero_documento', ''), '\D', '', 'g'), '')::integer;
    select p.id into v_pedido_id from public.pedidos p where p.numero = v_num_pedido;

    v_cli := coalesce(p_payload->'cliente', '{}'::jsonb);
    v_cpf := nullif(trim(coalesce(v_cli->>'cpf_cnpj', p_payload->>'cpf_cnpj', '')), '');
    if v_cpf is not null then
      select c.id into v_cliente_id from public.clientes c where c.cpf_cnpj = v_cpf;
    end if;

    insert into public.contas_receber as cr
      (tiny_id, numero_documento, numero_pedido, pedido_id, cliente_id, historico,
       categoria, data_emissao, data_vencimento, data_liquidacao, valor, saldo,
       situacao, forma_recebimento, meio_recebimento, raw)
    values
      (nullif(trim(coalesce(p_payload->>'id','')),'')::bigint,
       nullif(trim(coalesce(p_payload->>'numero_documento','')),''),
       v_num_pedido, v_pedido_id, v_cliente_id,
       nullif(trim(coalesce(p_payload->>'historico','')),''),
       nullif(trim(coalesce(p_payload->>'categoria','')),''),
       to_date(nullif(trim(coalesce(p_payload->>'data_emissao','')),''),    'DD/MM/YYYY'),
       to_date(nullif(trim(coalesce(p_payload->>'data_vencimento','')),''), 'DD/MM/YYYY'),
       to_date(nullif(trim(coalesce(p_payload->>'data_liquidacao','')),''), 'DD/MM/YYYY'),
       nullif(replace(trim(coalesce(p_payload->>'valor','')), ',', '.'),'')::numeric,
       nullif(replace(trim(coalesce(p_payload->>'saldo','')), ',', '.'),'')::numeric,
       nullif(trim(coalesce(p_payload->>'situacao','')),''),
       nullif(trim(coalesce(p_payload->>'forma_recebimento','')),''),
       nullif(trim(coalesce(p_payload->>'meio_recebimento','')),''),
       p_payload)
    on conflict (tiny_id) do update set
      numero_documento = coalesce(excluded.numero_documento, cr.numero_documento),
      numero_pedido = coalesce(excluded.numero_pedido, cr.numero_pedido),
      pedido_id = coalesce(excluded.pedido_id, cr.pedido_id),
      cliente_id = coalesce(excluded.cliente_id, cr.cliente_id),
      historico = coalesce(excluded.historico, cr.historico),
      categoria = coalesce(excluded.categoria, cr.categoria),
      data_emissao = coalesce(excluded.data_emissao, cr.data_emissao),
      data_vencimento = coalesce(excluded.data_vencimento, cr.data_vencimento),
      data_liquidacao = coalesce(excluded.data_liquidacao, cr.data_liquidacao),
      valor = coalesce(excluded.valor, cr.valor),
      saldo = coalesce(excluded.saldo, cr.saldo),
      situacao = coalesce(excluded.situacao, cr.situacao),
      forma_recebimento = coalesce(excluded.forma_recebimento, cr.forma_recebimento),
      meio_recebimento = coalesce(excluded.meio_recebimento, cr.meio_recebimento),
      raw = excluded.raw,
      atualizado_em = now();

  else
    raise exception 'recurso desconhecido: %', p_recurso;
  end if;

  update public.tiny_fila
     set status = 'ok', processado_em = now(), erro = null
   where id = p_fila_id;

  return jsonb_build_object('ok', true, 'pedido_id', v_pedido_id,
                            'cliente_id', v_cliente_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4.3 fn_backfill_falha — devolve para a fila (até 4 tentativas) ou marca erro
-- ---------------------------------------------------------------------------
create or replace function public.fn_backfill_falha(p_fila_id bigint, p_erro text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_tentativas smallint;
begin
  update public.tiny_fila
     set tentativas = tentativas + 1,
         erro = left(coalesce(p_erro, 'erro sem descrição'), 500),
         status = case when tentativas + 1 >= 4 then 'erro' else 'pendente' end,
         reservado_em = null,
         processado_em = now()
   where id = p_fila_id
  returning tentativas into v_tentativas;
  return jsonb_build_object('tentativas', v_tentativas);
end;
$$;

-- Padrão da casa: RLS ligado sem policy, e execute só para service_role.
revoke execute on function public.fn_fila_proximos(integer)              from public, anon, authenticated;
revoke execute on function public.fn_backfill_aplicar(bigint, text, jsonb) from public, anon, authenticated;
revoke execute on function public.fn_backfill_falha(bigint, text)        from public, anon, authenticated;
grant  execute on function public.fn_fila_proximos(integer)              to service_role;
grant  execute on function public.fn_backfill_aplicar(bigint, text, jsonb) to service_role;
grant  execute on function public.fn_backfill_falha(bigint, text)        to service_role;
