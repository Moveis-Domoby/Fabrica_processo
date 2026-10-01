-- ============================================================================
-- DOMOBY FÁBRICA · Supabase — esquema inicial (P15)
-- Projeto: NOVO, dedicado à fábrica (separado do painel de recompra da loja)
-- Rodar inteiro no SQL Editor do Supabase. Idempotente (create if not exists).
-- Data: 2026-08-17
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · CLIENTES
-- Identidade: cpf_cnpj quando existe; fallback nome+fone (resolvido na função).
-- ----------------------------------------------------------------------------
create table if not exists public.clientes (
  id             bigint generated always as identity primary key,
  cpf_cnpj       text,
  nome           text not null default '',
  fone           text,
  email          text,
  endereco       text,
  numero         text,          -- texto: preserva "1397", "S/N"
  complemento    text,
  bairro         text,
  cidade         text,
  uf             text,
  cep            text,          -- texto: o Tiny manda com e sem máscara
  rg             text,
  tiny_id_contato bigint,       -- dados.idContato do webhook (quando capturado)
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create unique index if not exists clientes_cpf_cnpj_uq
  on public.clientes (cpf_cnpj) where cpf_cnpj is not null and cpf_cnpj <> '';
create index if not exists clientes_fone_idx on public.clientes (fone);
create index if not exists clientes_nome_idx on public.clientes (nome);

-- ↪ Backfill histórico do Tiny (28/08/2026 — DDL completo em 22_backfill_tiny.sql,
--   nesta pasta): clientes ganhou o retorno.contato inteiro em `raw` (o celular
--   vive lá dentro — a view vendas_marketing do módulo Comercial depende dele).
--   Espelhado aqui em 15/09/2026 (SESSAO-19) porque este arquivo é o retrato da
--   integração que o harness de testes carrega.
alter table public.clientes add column if not exists raw jsonb;
alter table public.clientes add column if not exists tipo_pessoa text;
alter table public.clientes add column if not exists inscricao_estadual text;
alter table public.clientes add column if not exists fantasia text;

-- ----------------------------------------------------------------------------
-- 2 · PEDIDOS
-- Chave natural: numero (único por conta no Tiny). tiny_id fica NULL no
-- histórico do backfill (a planilha nunca guardou o id interno).
-- A coluna raw guarda o retorno.pedido INTEIRO da API — nada se perde.
-- ----------------------------------------------------------------------------
create table if not exists public.pedidos (
  id                 bigint generated always as identity primary key,
  tiny_id            bigint,
  numero             integer not null unique,
  cliente_id         bigint references public.clientes(id),
  situacao           text,               -- código v2: aberto, aprovado, ..., entregue
  data_pedido        date,
  data_prevista      date,
  total_produtos     numeric(12,2),      -- "VALOR TOTAL" da planilha (bruto)
  total_pedido       numeric(12,2),      -- "TOTAL"/"TOTAL 2" (líquido)
  valor_frete        numeric(12,2),
  forma_pagamento    text,
  meio_pagamento     text,
  forma_envio        text,
  qtd_parcelas       integer,
  parcelas           jsonb,
  marcadores         text[],
  obs                text,
  obs_interna        text,
  endereco_entrega   jsonb,              -- quase sempre vazio; jsonb evita 10 colunas mortas
  codigo_rastreamento text,
  url_rastreamento   text,
  vendedor           text,
  ecommerce          text,
  raw                jsonb,              -- retorno.pedido completo (fonte da verdade)
  origem             text not null default 'webhook',  -- webhook | backfill
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

create unique index if not exists pedidos_tiny_id_uq
  on public.pedidos (tiny_id) where tiny_id is not null;
create index if not exists pedidos_situacao_idx    on public.pedidos (situacao);
create index if not exists pedidos_data_idx        on public.pedidos (data_pedido);
create index if not exists pedidos_cliente_idx     on public.pedidos (cliente_id);

-- ----------------------------------------------------------------------------
-- 3 · ITENS DO PEDIDO
-- Substitui as colunas concatenadas SKU / LISTA DE ITENS / QUANT. PRODUTOS /
-- RESUMO DOS ITENS / VALOR P/PRODUTO — sem corrupção de data, sem zero perdido.
-- ----------------------------------------------------------------------------
create table if not exists public.pedido_itens (
  pedido_id      bigint not null references public.pedidos(id) on delete cascade,
  seq            integer not null,
  id_produto     bigint,
  codigo         text,               -- SKU em texto: "061" continua "061"
  descricao      text,
  unidade        text,
  quantidade     numeric(10,2),
  valor_unitario numeric(12,2),
  primary key (pedido_id, seq)
);

create index if not exists pedido_itens_codigo_idx on public.pedido_itens (codigo);

-- ----------------------------------------------------------------------------
-- 4 · LOG DE EVENTOS
-- O histórico de execuções do n8n é podado em 7 dias; este log é permanente.
-- Barato, e já salvou o dia uma vez (incidente de 11/08: os pedidos perdidos
-- só existiam dentro das execuções com erro).
-- ----------------------------------------------------------------------------
create table if not exists public.eventos (
  id          bigint generated always as identity primary key,
  tipo        text,                  -- inclusao_pedido | atualizacao_pedido | backfill
  tiny_id     bigint,
  numero      integer,
  situacao    text,
  recebido_em timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5 · RLS — tudo travado. Sem policy nenhuma: só a service_role (que ignora
-- RLS) acessa. A anon key não enxerga NADA. Se um dia existir um painel,
-- criam-se policies de leitura específicas.
-- ----------------------------------------------------------------------------
alter table public.clientes     enable row level security;
alter table public.pedidos      enable row level security;
alter table public.pedido_itens enable row level security;
alter table public.eventos      enable row level security;

-- ----------------------------------------------------------------------------
-- 6 · A FUNÇÃO DE UPSERT — o coração da integração
-- Uma chamada RPC = transação atômica: cliente + pedido + itens + log.
-- O n8n chama POST /rest/v1/rpc/fn_upsert_pedido com o retorno.pedido cru.
-- Idempotente: chamar duas vezes com o mesmo payload dá o mesmo resultado.
-- ----------------------------------------------------------------------------
create or replace function public.fn_upsert_pedido(
  p         jsonb,                 -- retorno.pedido da API v2, sem mexer
  p_tipo    text  default 'webhook',
  p_tiny_id bigint default null,   -- dados.id do webhook (id interno)
  p_origem  text  default 'webhook'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cli        jsonb  := coalesce(p->'cliente', '{}'::jsonb);
  v_cpf        text   := nullif(trim(coalesce(v_cli->>'cpf_cnpj','')), '');
  v_nome       text   := trim(coalesce(v_cli->>'nome',''));
  v_fone       text   := nullif(trim(coalesce(v_cli->>'fone','')), '');
  v_numero     integer := nullif(trim(coalesce(p->>'numero','')), '')::integer;
  v_tiny_id    bigint := coalesce(p_tiny_id, nullif(trim(coalesce(p->>'id','')), '')::bigint);
  v_cliente_id bigint;
  v_pedido_id  bigint;
  v_item       jsonb;
  v_seq        integer := 0;

  -- helpers inline: número BR/US -> numeric; data dd/mm/yyyy -> date
  -- (o Tiny v2 manda decimais com ponto; o replace cobre vírgula por segurança)
begin
  if v_numero is null then
    raise exception 'payload sem numero de pedido';
  end if;

  -- ---------- CLIENTE: achar por cpf_cnpj, senão por nome+fone, senão criar --
  if v_cpf is not null then
    select id into v_cliente_id from clientes where cpf_cnpj = v_cpf;
  end if;
  if v_cliente_id is null and v_nome <> '' then
    select id into v_cliente_id from clientes
     where coalesce(cpf_cnpj,'') = '' and nome = v_nome
       and coalesce(fone,'') = coalesce(v_fone,'')
     limit 1;
  end if;

  if v_cliente_id is null then
    insert into clientes (cpf_cnpj, nome, fone, email, endereco, numero,
                          complemento, bairro, cidade, uf, cep, rg)
    values (v_cpf, v_nome, v_fone,
            nullif(trim(coalesce(v_cli->>'email','')),''),
            nullif(trim(coalesce(v_cli->>'endereco','')),''),
            nullif(trim(coalesce(v_cli->>'numero','')),''),
            nullif(trim(coalesce(v_cli->>'complemento','')),''),
            nullif(trim(coalesce(v_cli->>'bairro','')),''),
            nullif(trim(coalesce(v_cli->>'cidade','')),''),
            nullif(trim(coalesce(v_cli->>'uf','')),''),
            nullif(trim(coalesce(v_cli->>'cep','')),''),
            nullif(trim(coalesce(v_cli->>'rg','')),''))
    returning id into v_cliente_id;
  else
    update clientes set
      cpf_cnpj      = coalesce(v_cpf, cpf_cnpj),
      nome          = case when v_nome <> '' then v_nome else nome end,
      fone          = coalesce(v_fone, fone),
      email         = coalesce(nullif(trim(coalesce(v_cli->>'email','')),''), email),
      endereco      = coalesce(nullif(trim(coalesce(v_cli->>'endereco','')),''), endereco),
      numero        = coalesce(nullif(trim(coalesce(v_cli->>'numero','')),''), numero),
      complemento   = coalesce(nullif(trim(coalesce(v_cli->>'complemento','')),''), complemento),
      bairro        = coalesce(nullif(trim(coalesce(v_cli->>'bairro','')),''), bairro),
      cidade        = coalesce(nullif(trim(coalesce(v_cli->>'cidade','')),''), cidade),
      uf            = coalesce(nullif(trim(coalesce(v_cli->>'uf','')),''), uf),
      cep           = coalesce(nullif(trim(coalesce(v_cli->>'cep','')),''), cep),
      atualizado_em = now()
    where id = v_cliente_id;
  end if;

  -- ---------- PEDIDO: upsert por numero --------------------------------------
  insert into pedidos as pd (
    tiny_id, numero, cliente_id, situacao, data_pedido, data_prevista,
    total_produtos, total_pedido, valor_frete,
    forma_pagamento, meio_pagamento, forma_envio,
    qtd_parcelas, parcelas, marcadores, obs, obs_interna,
    endereco_entrega, codigo_rastreamento, url_rastreamento,
    vendedor, ecommerce, raw, origem)
  values (
    v_tiny_id, v_numero, v_cliente_id,
    nullif(trim(coalesce(p->>'situacao','')),''),
    to_date(nullif(trim(coalesce(p->>'data_pedido','')),''), 'DD/MM/YYYY'),
    to_date(nullif(trim(coalesce(p->>'data_prevista','')),''), 'DD/MM/YYYY'),
    nullif(replace(trim(coalesce(p->>'total_produtos','')), ',', '.'), '')::numeric,
    nullif(replace(trim(coalesce(p->>'total_pedido','')),   ',', '.'), '')::numeric,
    nullif(replace(trim(coalesce(p->>'valor_frete','')),    ',', '.'), '')::numeric,
    nullif(trim(coalesce(p->>'forma_pagamento','')),''),
    nullif(trim(coalesce(p->>'meio_pagamento','')),''),
    nullif(trim(coalesce(p->>'forma_envio','')),''),
    coalesce(jsonb_array_length(coalesce(p->'parcelas','[]'::jsonb)), 0),
    p->'parcelas',
    (select coalesce(array_agg(coalesce(m->'marcador'->>'descricao', m->>'descricao')), '{}')
       from jsonb_array_elements(coalesce(p->'marcadores','[]'::jsonb)) m),
    nullif(trim(coalesce(p->>'obs','')),''),
    nullif(trim(coalesce(p->>'obs_interna','')),''),
    p->'endereco_entrega',
    nullif(trim(coalesce(p->>'codigo_rastreamento','')),''),
    nullif(trim(coalesce(p->>'url_rastreamento','')),''),
    nullif(trim(coalesce(p->>'nome_vendedor','')),''),
    nullif(trim(coalesce(p->>'nome_ecommerce','')),''),
    p, p_origem)
  on conflict (numero) do update set
    tiny_id            = coalesce(excluded.tiny_id, pd.tiny_id),
    cliente_id         = coalesce(excluded.cliente_id, pd.cliente_id),
    situacao           = coalesce(excluded.situacao, pd.situacao),
    data_pedido        = coalesce(excluded.data_pedido, pd.data_pedido),
    data_prevista      = coalesce(excluded.data_prevista, pd.data_prevista),
    total_produtos     = coalesce(excluded.total_produtos, pd.total_produtos),
    total_pedido       = coalesce(excluded.total_pedido, pd.total_pedido),
    valor_frete        = coalesce(excluded.valor_frete, pd.valor_frete),
    forma_pagamento    = coalesce(excluded.forma_pagamento, pd.forma_pagamento),
    meio_pagamento     = coalesce(excluded.meio_pagamento, pd.meio_pagamento),
    forma_envio        = coalesce(excluded.forma_envio, pd.forma_envio),
    qtd_parcelas       = excluded.qtd_parcelas,
    parcelas           = coalesce(excluded.parcelas, pd.parcelas),
    marcadores         = excluded.marcadores,
    obs                = coalesce(excluded.obs, pd.obs),
    obs_interna        = coalesce(excluded.obs_interna, pd.obs_interna),
    endereco_entrega   = coalesce(excluded.endereco_entrega, pd.endereco_entrega),
    codigo_rastreamento = coalesce(excluded.codigo_rastreamento, pd.codigo_rastreamento),
    url_rastreamento   = coalesce(excluded.url_rastreamento, pd.url_rastreamento),
    vendedor           = coalesce(excluded.vendedor, pd.vendedor),
    ecommerce          = coalesce(excluded.ecommerce, pd.ecommerce),
    raw                = coalesce(excluded.raw, pd.raw),
    atualizado_em      = now()
  returning pd.id into v_pedido_id;

  -- ---------- ITENS: substituição total (o payload sempre traz todos) --------
  delete from pedido_itens where pedido_id = v_pedido_id;
  for v_item in
    select coalesce(x->'item', x) from jsonb_array_elements(
      case jsonb_typeof(coalesce(p->'itens','[]'::jsonb))
        when 'array' then coalesce(p->'itens','[]'::jsonb)
        else jsonb_build_array(p->'itens')     -- o Tiny devolve objeto quando é 1 só
      end) x
  loop
    v_seq := v_seq + 1;
    insert into pedido_itens (pedido_id, seq, id_produto, codigo, descricao,
                              unidade, quantidade, valor_unitario)
    values (
      v_pedido_id, v_seq,
      nullif(trim(coalesce(v_item->>'id_produto','')),'')::bigint,
      nullif(trim(coalesce(v_item->>'codigo','')),''),
      nullif(trim(coalesce(v_item->>'descricao','')),''),
      nullif(trim(coalesce(v_item->>'unidade','')),''),
      nullif(replace(trim(coalesce(v_item->>'quantidade','')),     ',', '.'), '')::numeric,
      nullif(replace(trim(coalesce(v_item->>'valor_unitario','')), ',', '.'), '')::numeric);
  end loop;

  -- ---------- LOG -------------------------------------------------------------
  insert into eventos (tipo, tiny_id, numero, situacao)
  values (p_tipo, v_tiny_id, v_numero, nullif(trim(coalesce(p->>'situacao','')),''));

  return v_pedido_id;
end;
$$;

-- Só a service_role pode chamar a função (o n8n usa a service key)
revoke execute on function public.fn_upsert_pedido(jsonb, text, bigint, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7 · GREENPALLETS — controle do polling (adicionado em 17/08/2026)
-- A conta Tiny da GreenPallets (parceira, plano Crescer) não tem webhook;
-- um workflow agendado do n8n consulta os pedidos dela de hora em hora e usa
-- esta tabela para nunca criar card duplicado na PCP.
-- Padrão "claim-first": a linha é inserida ANTES de criar os cards (insert com
-- ignore-duplicates funciona como trava). Para reprocessar um pedido de
-- propósito: apagar a linha dele aqui e esperar o próximo ciclo.
-- ----------------------------------------------------------------------------
create table if not exists public.gp_pcp_processados (
  tiny_id       bigint primary key,   -- id interno do pedido na conta GreenPallets
  numero        integer not null,
  processado_em timestamptz not null default now()
);
alter table public.gp_pcp_processados enable row level security;

-- ============================================================================
-- CONFERÊNCIAS ÚTEIS (rodar quando quiser)
-- ============================================================================
-- Total de pedidos e clientes:
--   select (select count(*) from pedidos) pedidos, (select count(*) from clientes) clientes;
-- Últimos eventos:
--   select * from eventos order by id desc limit 20;
-- Pedido completo com itens:
--   select p.numero, p.situacao, c.nome, i.codigo, i.descricao, i.quantidade
--     from pedidos p left join clientes c on c.id = p.cliente_id
--     left join pedido_itens i on i.pedido_id = p.id
--    where p.numero = 13093 order by i.seq;


-- ============================================================================
-- 8 · PLATAFORMA DE PRODUÇÃO (prefixo plt_) — aplicada em 2026-08-26
-- ============================================================================
--
-- O DDL executável da plataforma NÃO é duplicado aqui. Ele vive, versionado e
-- testado, no repositório:
--
--     supabase/migrations/*.sql        (10 migrations, ordem alfabética)
--     supabase/testes/testar-migrations.mjs   (npm run test:banco)
--     docs/modelo-de-dados.md          (o modelo explicado em português)
--
-- Duplicar o mesmo SQL em dois lugares cria uma segunda fonte de verdade que
-- envelhece sozinha — é exatamente o M-04 ("um dono por dado") da memória de
-- aprendizado. Este bloco existe para o INVENTÁRIO: quem lê este arquivo
-- precisa saber o que mais existe no banco e onde achar a definição.
--
-- Aplicado no projeto axnzldwgwsmepukdiljx (org Tech) em 2026-08-26, com as
-- tabelas da integração conferidas antes e depois: impressão digital de
-- estrutura idêntica (9a61b60d8f5b306ea40acc1704234ea0) e contagens intactas
-- (clientes 119 · pedidos 118 · pedido_itens 191 · eventos 448 · gp 1).
--
-- TABELAS (9)
--   plt_usuarios            pessoas; auth_user_id opcional (operador de tablet
--                           pode não ter login) · pin_hash guarda HASH
--   plt_usuario_setores     vínculo pessoa ↔ setor, com lider_do_setor
--   plt_setores             setores; papel_no_fluxo = entrada|producao|terminal
--                           (índice único garante UMA entrada — D-13)
--   plt_etapas              etapas internas de cada setor; SEM SEED (D-14)
--                           eh_fila marca onde o card espera sem dono
--   plt_cards               cards pedido/unidade (D-01). FK para pedidos(id).
--                           ⚠️ SEM FK para pedido_itens — ver aviso abaixo
--   plt_eventos             APPEND-ONLY (RNF-05). Tabela-mãe do tempo
--   plt_notificacoes        avisos a líder/admin (D-09 / Q-18)
--   plt_tarefas             afazeres e delegação (RF-40 a RF-43)
--   plt_visualizacoes       painéis salvos (RF-33)
--
-- VISÕES (3) — tudo derivado de evento, nada guardado
--   plt_vw_permanencias         tempo por etapa; eh_fila separa o que é do SETOR
--   plt_vw_execucoes            do iniciar ao finalizar; o tempo que tem dono
--   plt_vw_qualidade_transicoes dupla atestação da D-09, divergência calculada
--   (as três com security_invoker = on, para respeitarem o RLS de quem lê)
--
-- SCHEMA plt_privado — 7 funções, FORA da API REST de propósito
--   fn_marcar_atualizacao · fn_evento_imutavel · fn_projetar_posicao
--   fn_usuario_atual · fn_eh_admin · fn_setores_do_usuario · fn_eh_lider_de
--   Motivo: o Supabase publica o schema public inteiro como API; função criada
--   lá vira endpoint /rest/v1/rpc sem ninguém pedir (apontado pelos advisors).
--
-- 21 POLÍTICAS DE RLS — operador vê os setores dele, líder vê o setor completo,
-- admin vê tudo. plt_eventos NÃO tem política de UPDATE nem de DELETE.
--
-- ⚠️⚠️ AVISO QUE VALE OURO ⚠️⚠️
-- plt_cards NÃO tem foreign key para pedido_itens, e isso é decisão, não
-- esquecimento: fn_upsert_pedido faz "delete from pedido_itens where
-- pedido_id = ..." e regrava tudo a CADA atualização de pedido vinda do Tiny.
-- Uma FK apontando para lá faria toda atualização de pedido FALHAR em
-- produção. O item é guardado como snapshot (item_seq, item_codigo,
-- item_descricao). NÃO "conserte" isso.
--
-- ⚠️ O append-only de plt_eventos é garantido por TRIGGER, não por RLS —
-- porque a service_role (a chave que o n8n usa) ignora RLS.
--
-- ---------------------------------------------------------------------------
-- ↪️ SESSAO-03 (aplicada em 2026-08-26) — IDENTIDADE E ACESSO (D-21)
--
-- Migration 11: supabase/migrations/20260826140000_plt_identidade.sql
-- Integração conferida antes e depois: impressão digital idêntica
-- (49028cbaab8330fe2d0678d97fe19599) e contagens intactas
-- (clientes 133 · pedidos 133 · pedido_itens 218 · eventos 535 · gp 1).
--
-- plt_usuarios GANHOU (tudo na mesma tabela, pedido do dono):
--   cpf              obrigatório, só dígitos; SELECT REVOGADO da API (dado pessoal)
--   usuario          nome de usuário de login (entra com ele OU com o e-mail)
--   matricula        MDM-XXX-NNN, gerada por trigger (fn_gerar_matricula +
--                    sequence plt_privado.matricula_seq) — nunca digitada
--   senha_padrao     true até a pessoa trocar a senha de criação (troca
--                    obrigatória no 1º login)
--   convite_token    token do link de convite (WhatsApp); SELECT REVOGADO
--   convite_usado_em quando o 1º acesso se completou
--
-- Escrita de plt_usuarios pelo navegador: SÓ update(nome, telefone).
-- Criar/excluir usuário, papel, PIN, senha → Edge Function `autenticacao`
-- (service_role), a única porta do servidor para identidade.
--
-- EDGE FUNCTION `autenticacao` (a 1ª do projeto): entrar · criar-usuario ·
-- convite-info · trocar-senha · pin-definir · pin-verificar. Código em
-- supabase/functions/autenticacao/index.ts. Segredo PLT_SENHA_PADRAO
-- obrigatório (Edge Functions → Secrets). PIN: PBKDF2-SHA256 em pin_hash.
--
-- ---------------------------------------------------------------------------
-- ↪️ SESSAO-04 (aplicada em 2026-08-27) — LEITURA DE PEDIDOS PARA O KANBAN
--
-- Migration 13: supabase/migrations/20260827120000_plt_leitura_pedidos_kanban.sql
-- Integração conferida antes e depois: impressão digital idêntica
-- (9a61b60d8f5b306ea40acc1704234ea0) e contagens intactas
-- (clientes 133 · pedidos 133 · pedido_itens 218 · eventos 535 · gp 1).
--
-- FUNÇÕES em public — endpoints /rest/v1/rpc DE PROPÓSITO (a porta de leitura
-- do kanban; os advisors emitem WARN de "security definer executável por
-- authenticated" para as quatro, e isso é o desenho intencional):
--   plt_fn_pedidos_kanban        resumo de pedidos (número, cliente_nome, datas,
--                                situação, itens/unidades, tem_card,
--                                unidades_liberadas) — paginado, máx. 100
--   plt_fn_pedido_itens_kanban   itens de UM pedido em unidades (k/n POR ITEM,
--                                como o n8n: quantidade arredondada, <1 não vira card)
--   plt_fn_expedicao_kanban      reagrupamento por pedido (D-01/D-13)
--   plt_fn_pedido_unidades       onde está cada unidade de um pedido
--
-- Salvaguardas (lição E-11): security definer + set search_path fixo · execute
-- REVOGADO de public/anon, grant só authenticated · gate DENTRO da função
-- (fn_usuario_atual() para as duas primeiras; fn_pode_ver_expedicao() — admin,
-- entrada ou terminal — para as duas últimas) · NENHUM dado pessoal/financeiro
-- do cliente sai por elas (sem endereço, CPF/CNPJ, fone, e-mail, valores, raw).
--
-- SCHEMA plt_privado ganhou: fn_pode_ver_expedicao() (maquinaria, fora da API).
-- As tabelas da integração continuam SEM policy — o navegador não as lê direto.


-- ============================================================================
-- 9 · PRODUTOS DO TINY DA FÁBRICA (migration 23) — APLICADA em 2026-09-21
-- ============================================================================
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


-- ============================================================================
-- 10 · CARGA HISTÓRICA DO TINY (migration 22 do Cowork, 28/08/2026) — ESPELHO
--      DO BANCO VIVO, conferido em 01/10/2026 (SESSAO-29) com pg_get_functiondef
-- ============================================================================
-- A fila (`tiny_fila`), as notas e as contas a receber nasceram direto no banco
-- (arquivo `22_backfill_tiny.sql`, nesta pasta) e as funções seguiram mudando
-- lá — a `fn_backfill_falha` ganhou `p_terminal`, a nota fiscal passou a casar
-- pelo `id_venda` e a conta a receber pela `fn_backfill_conta_mapear`. Nada
-- disso estava neste retrato (pendência do E-27). Abaixo, o que está VIVO em
-- produção ANTES da migration da SESSAO-29 — a migration 49 da plataforma
-- (`20261001120000_plt_tiny_pente_fino.sql`) recria `fn_upsert_pedido` e
-- `fn_backfill_aplicar` por cima disto (o pente-fino diário).
-- ----------------------------------------------------------------------------
create table if not exists public.tiny_fila (
  id            bigint generated always as identity primary key,
  recurso       text     not null,
  chave         text     not null,
  referencia    text,
  params        jsonb    not null default '{}',
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
create index if not exists tiny_fila_trabalho_idx
  on public.tiny_fila (prioridade, id) where status = 'pendente';
create index if not exists tiny_fila_status_idx on public.tiny_fila (status);
alter table public.tiny_fila enable row level security;

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
create index if not exists contas_receber_pedido_idx   on public.contas_receber (numero_pedido);
create index if not exists contas_receber_venc_idx     on public.contas_receber (data_vencimento);
create index if not exists contas_receber_situacao_idx on public.contas_receber (situacao);
alter table public.contas_receber enable row level security;

-- O número do pedido e da NF dentro do histórico da conta (vivo; execute público
-- como em produção — função pura, sem acesso a dado).
create or replace function public.fn_backfill_conta_mapear(p_payload jsonb)
 returns jsonb
 language sql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'numero_pedido', nullif(substring(coalesce(p_payload->>'historico','')
                      from 'pedido de venda n[^0-9]*([0-9]+)'), ''),
    'numero_nf',     nullif(substring(coalesce(p_payload->>'historico','')
                      from '[Nn][Ff] n[^0-9]*([0-9]+)'), '')
  );
$function$;

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

drop function if exists public.fn_backfill_falha(bigint, text);
create or replace function public.fn_backfill_falha(p_fila_id bigint, p_erro text, p_terminal boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_tentativas smallint;
begin
  update public.tiny_fila
     set tentativas = tentativas + 1,
         erro = left(coalesce(p_erro, 'erro sem descricao'), 500),
         status = case when p_terminal then 'vazio'
                       when tentativas + 1 >= 4 then 'erro'
                       else 'pendente' end,
         reservado_em = null,
         processado_em = now()
   where id = p_fila_id
  returning tentativas into v_tentativas;
  return jsonb_build_object('tentativas', v_tentativas);
end;
$function$;

-- A versão VIVA até a SESSAO-29 (a migration 49 a recria com o pente-fino).
create or replace function public.fn_backfill_aplicar(p_fila_id bigint, p_recurso text, p_payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
begin
  if p_recurso like '%\_pesquisa' then
    insert into public.tiny_fila (recurso, chave, referencia, prioridade, params)
    select x->>'recurso', x->>'chave', nullif(x->>'referencia',''),
           coalesce((x->>'prioridade')::smallint, 5),
           coalesce(x->'params', '{}'::jsonb)
      from jsonb_array_elements(coalesce(p_payload, '[]'::jsonb)) x
     where nullif(x->>'chave','') is not null
    on conflict (recurso, chave) do nothing;
    get diagnostics v_n = row_count;
    update public.tiny_fila set status='ok', processado_em=now(), erro=null where id=p_fila_id;
    return jsonb_build_object('enfileirados', v_n);
  end if;

  if p_recurso = 'pedido' then
    v_pedido_id := public.fn_upsert_pedido(
      p_payload, 'backfill',
      nullif(trim(coalesce(p_payload->>'id','')),'')::bigint, 'backfill');

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

  update public.tiny_fila set status='ok', processado_em=now(), erro=null where id=p_fila_id;
  return jsonb_build_object('ok', true, 'pedido_id', v_pedido_id, 'cliente_id', v_cliente_id);
end;
$function$;

-- Padrão da casa (como em produção): RLS ligado sem policy; as portas só para a
-- service_role (o n8n).
revoke execute on function public.fn_fila_proximos(integer)                from public, anon, authenticated;
revoke execute on function public.fn_backfill_aplicar(bigint, text, jsonb)  from public, anon, authenticated;
revoke execute on function public.fn_backfill_falha(bigint, text, boolean) from public, anon, authenticated;
grant  execute on function public.fn_fila_proximos(integer)                to service_role;
grant  execute on function public.fn_backfill_aplicar(bigint, text, jsonb)  to service_role;
grant  execute on function public.fn_backfill_falha(bigint, text, boolean) to service_role;
