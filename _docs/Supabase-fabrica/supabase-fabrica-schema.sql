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
