-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 49 — O BANCO NUNCA MAIS DIVERGE DO
-- TINY EM SILÊNCIO: a conferência diária (pente-fino), a regra das observações
-- e o cliente que não duplica quando o contato é renomeado
-- SESSAO-29 (01/10/2026) · D-50 · D-95…D-97 · P17
--
-- A fábrica dependia 100% do aviso de venda do Tiny, que não avisa marcador
-- mudado sozinho, contato renomeado nem campo apagado (conferência de 22/09:
-- 15 pedidos + 2 cadastros divergentes). Esta migration:
--
--   1. `fn_upsert_pedido` (a ÚNICA porta de escrita dos pedidos) ganha:
--      · as OBSERVAÇÕES acompanham o Tiny também quando apagadas (D-50) — o
--        resto continua "edição edita, apagar não apaga" (o coalesce de sempre;
--        campo vazio pode vir até como chave AUSENTE — nesse caso nada muda);
--      · o CLIENTE por: 1) o cadastro do Tiny (id do contato — só o aviso de
--        venda traz; parâmetro novo, opcional), 2) o CPF/CNPJ, 3) o cliente que
--        o pedido JÁ tem quando nada prova que é outra pessoa (sem CPF dos dois
--        lados e sem id que contradiga) — contato renomeado não cria cliente
--        novo —, 4) nome + telefone, 5) cria. O id do contato preenche o
--        cadastro que ainda não o tem; o CPF nunca colide com outro cliente;
--      · o nome do cliente gravado SEM entidade HTML ("D&#39;Elia" → "D'Elia");
--        o `raw` continua exatamente como o Tiny mandou (D-97);
--      · grava SÓ O QUE MUDOU (como o `fn_upsert_produto`): pedido igual ao Tiny
--        não é regravado, os itens só são regravados quando os itens mudaram —
--        e a lista do que mudou fica na transação para quem chamou ler.
--      ⚠️ assinatura nova (5º parâmetro com default) = DROP + CREATE (A-12): as
--      duas convivendo confundiriam o PostgREST. O n8n chama por nome com 4 —
--      cai na nova pelo default.
--   2. `fn_backfill_aplicar` (a porta do fluxo de carga do n8n) entende a linha
--      da CONFERÊNCIA: a busca reabre na fila os pedidos achados (sem duplicar —
--      a fila é única por recurso+chave) e a releitura grava como "pente_fino",
--      guardando na própria linha da fila o que mudou. A carga antiga segue igual.
--   3. A conferência: às 3h (Natal/São Paulo = 06:00 UTC) o banco enfileira a
--      busca do Tiny pelos últimos 60 dias (pega até pedido que nunca chegou
--      aqui) + os não terminados de qualquer idade (D-50) e ACORDA o relógio da
--      fila — que existe só enquanto há trabalho: chama o n8n (um lote por vez,
--      nunca dois), e com a fila vazia fecha a rodada (UMA linha no log
--      `eventos`, tipo `pente_fino`) e se desagenda. Nenhum relógio no n8n, nenhum
--      relógio rodando à toa (a lição da migration 43).
--   4. O pedido vivo que o aviso nunca trouxe e a conferência achou entra no PCP
--      como se tivesse chegado pelo aviso (D-96): a guarda do gatilho de inserção
--      passa a aceitar a origem `pente_fino` (pedido encerrado continua de fora).
--   5. O endereço do fluxo no n8n mora em `plt_webhooks` (D-47), marcado
--      `tiny_fila` (nenhum tipo de evento usa esse nome).
--   6. Correção única: nome de cliente gravado com entidade HTML (1 em 01/10).
--
-- Estrutura das tabelas da integração: INTACTA (nenhuma coluna). Linhas: só o
-- nome do item 6 muda; nenhuma linha nasce ou some na aplicação.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 0 · Pré-requisitos (a fila da carga histórica e a regra de situação)
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.tiny_fila') is null then
    raise exception 'A migration 49 precisa da fila da carga do Tiny (tiny_fila).';
  end if;
  if to_regprocedure('plt_privado.fn_situacao_normalizada(text)') is null then
    raise exception 'A migration 49 precisa de plt_privado.fn_situacao_normalizada (migration 25).';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1 · Texto sem entidade HTML (D-97). O Tiny guarda alguns nomes com a
--     entidade ("D&#39;Elia") e só a tela dele decodifica. Uma camada só:
--     o "&amp;" sai por último ("&amp;#39;" vira "&#39;", não "'").
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_texto_sem_entidades(p_texto text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_texto  text := p_texto;
  v_achado text[];
  v_codigo integer;
begin
  if v_texto is null or position('&' in v_texto) = 0 then
    return v_texto;
  end if;
  for v_achado in select regexp_matches(v_texto, '&#([0-9]{1,7});', 'g') loop
    v_codigo := v_achado[1]::integer;
    if v_codigo between 32 and 1114111 and v_codigo not between 55296 and 57343 then
      v_texto := replace(v_texto, '&#' || v_achado[1] || ';', chr(v_codigo));
    end if;
  end loop;
  for v_achado in select regexp_matches(v_texto, '&#([xX])([0-9a-fA-F]{1,6});', 'g') loop
    v_codigo := ('x' || lpad(v_achado[2], 8, '0'))::bit(32)::integer;
    if v_codigo between 32 and 1114111 and v_codigo not between 55296 and 57343 then
      v_texto := replace(v_texto, '&#' || v_achado[1] || v_achado[2] || ';', chr(v_codigo));
    end if;
  end loop;
  v_texto := replace(v_texto, '&quot;', '"');
  v_texto := replace(v_texto, '&apos;', '''');
  v_texto := replace(v_texto, '&lt;', '<');
  v_texto := replace(v_texto, '&gt;', '>');
  v_texto := replace(v_texto, '&nbsp;', ' ');
  v_texto := replace(v_texto, '&amp;', '&');
  return v_texto;
end;
$$;

comment on function plt_privado.fn_texto_sem_entidades(text) is
  'SESSAO-29 (D-97): tira a entidade HTML que o Tiny guarda em alguns nomes (&#39;, &amp;, &quot;…) — uma camada só. Usada no nome do cliente; o raw fica como o Tiny mandou.';

-- ----------------------------------------------------------------------------
-- 2 · A porta de escrita dos pedidos (a única) — recriada a partir da versão
--     VIVA de 01/10 (pg_get_functiondef; igual ao retrato do cofre).
-- ----------------------------------------------------------------------------
drop function if exists public.fn_upsert_pedido(jsonb, text, bigint, text);

create or replace function public.fn_upsert_pedido(
  p                 jsonb,                    -- retorno.pedido da API v2, sem mexer
  p_tipo            text   default 'webhook', -- inclusao_pedido · atualizacao_pedido · backfill · pente_fino
  p_tiny_id         bigint default null,      -- dados.id do aviso (id interno)
  p_origem          text   default 'webhook', -- webhook · backfill · pente_fino
  p_tiny_id_contato bigint default null       -- dados.idContato do aviso (o cadastro do cliente no Tiny)
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cli          jsonb   := coalesce(p->'cliente', '{}'::jsonb);
  v_cpf          text    := nullif(trim(coalesce(v_cli->>'cpf_cnpj','')), '');
  v_nome         text    := plt_privado.fn_texto_sem_entidades(trim(coalesce(v_cli->>'nome','')));
  v_fone         text    := nullif(trim(coalesce(v_cli->>'fone','')), '');
  v_email        text    := nullif(trim(coalesce(v_cli->>'email','')), '');
  v_endereco     text    := nullif(trim(coalesce(v_cli->>'endereco','')), '');
  v_end_numero   text    := nullif(trim(coalesce(v_cli->>'numero','')), '');
  v_complemento  text    := nullif(trim(coalesce(v_cli->>'complemento','')), '');
  v_bairro       text    := nullif(trim(coalesce(v_cli->>'bairro','')), '');
  v_cidade       text    := nullif(trim(coalesce(v_cli->>'cidade','')), '');
  v_uf           text    := nullif(trim(coalesce(v_cli->>'uf','')), '');
  v_cep          text    := nullif(trim(coalesce(v_cli->>'cep','')), '');
  v_rg           text    := nullif(trim(coalesce(v_cli->>'rg','')), '');
  v_numero       integer := nullif(trim(coalesce(p->>'numero','')), '')::integer;
  v_tiny_id      bigint  := coalesce(p_tiny_id, nullif(trim(coalesce(p->>'id','')), '')::bigint);
  v_contato      bigint  := nullif(p_tiny_id_contato, 0);
  v_atual        public.pedidos%rowtype;
  v_cliente      public.clientes%rowtype;
  v_cliente_id   bigint;
  v_cpf_final    text;
  v_pedido_id    bigint;
  v_item         jsonb;
  v_seq          integer := 0;
  v_mudancas     text[]  := '{}';     -- o que mudou (o relatório da conferência)
  v_cliente_mudou boolean := false;   -- o cadastro do cliente mudou (nome novo no Tiny…)
  v_gravar       boolean := false;    -- o pedido precisa ser regravado
  -- o pedido como o Tiny mandou agora (tipos das colunas: comparar sem arredondar diferente)
  n_situacao            text;
  n_data_pedido         date;
  n_data_prevista       date;
  n_total_produtos      numeric(12,2);
  n_total_pedido        numeric(12,2);
  n_valor_frete         numeric(12,2);
  n_forma_pagamento     text;
  n_meio_pagamento      text;
  n_forma_envio         text;
  n_qtd_parcelas        integer;
  n_marcadores          text[];
  n_obs                 text;
  n_obs_interna         text;
  n_codigo_rastreamento text;
  n_url_rastreamento    text;
  n_vendedor            text;
  n_ecommerce           text;
  v_tem_obs             boolean := p ? 'obs';
  v_tem_obs_interna     boolean := p ? 'obs_interna';
  -- o que vai ficar gravado (regra de gravação da D-50)
  f_tiny_id             bigint;
  f_situacao            text;
  f_data_pedido         date;
  f_data_prevista       date;
  f_total_produtos      numeric(12,2);
  f_total_pedido        numeric(12,2);
  f_valor_frete         numeric(12,2);
  f_forma_pagamento     text;
  f_meio_pagamento      text;
  f_forma_envio         text;
  f_parcelas            jsonb;
  f_obs                 text;
  f_obs_interna         text;
  f_endereco_entrega    jsonb;
  f_codigo_rastreamento text;
  f_url_rastreamento    text;
  f_vendedor            text;
  f_ecommerce           text;
begin
  if v_numero is null then
    raise exception 'payload sem numero de pedido';
  end if;

  -- O pedido que já existe (travado: aviso e conferência no mesmo pedido não se atropelam).
  select * into v_atual from pedidos where numero = v_numero for update;

  -- ---------- CLIENTE (SESSAO-29, item C) ------------------------------------
  -- 1) o cadastro do Tiny (o id do contato — o aviso de venda traz)
  if v_contato is not null then
    select c.id into v_cliente_id from clientes c
     where c.tiny_id_contato = v_contato order by c.id limit 1;
  end if;
  -- 2) o CPF/CNPJ
  if v_cliente_id is null and v_cpf is not null then
    select c.id into v_cliente_id from clientes c where c.cpf_cnpj = v_cpf;
  end if;
  -- 3) o cliente que o pedido JÁ tem, quando nada prova que é outra pessoa:
  --    sem CPF dos dois lados e sem id de contato que contradiga. É o contato
  --    renomeado no Tiny (o nome antigo com "/ bairro / origem") que, antes,
  --    virava cliente novo ao reprocessar o pedido.
  if v_cliente_id is null and v_cpf is null and v_atual.cliente_id is not null then
    select c.id into v_cliente_id from clientes c
     where c.id = v_atual.cliente_id
       and coalesce(c.cpf_cnpj, '') = ''
       and (v_contato is null or c.tiny_id_contato is null or c.tiny_id_contato = v_contato);
  end if;
  -- 4) nome + telefone (o caminho antigo)
  if v_cliente_id is null and v_nome <> '' then
    select c.id into v_cliente_id from clientes c
     where coalesce(c.cpf_cnpj,'') = '' and c.nome = v_nome
       and coalesce(c.fone,'') = coalesce(v_fone,'')
     order by c.id
     limit 1;
  end if;

  if v_cliente_id is null then
    -- 5) cria
    insert into clientes (cpf_cnpj, nome, fone, email, endereco, numero,
                          complemento, bairro, cidade, uf, cep, rg, tiny_id_contato)
    values (v_cpf, v_nome, v_fone, v_email, v_endereco, v_end_numero,
            v_complemento, v_bairro, v_cidade, v_uf, v_cep, v_rg, v_contato)
    returning id into v_cliente_id;
    v_cliente_mudou := v_atual.id is not null;
  else
    select * into v_cliente from clientes where id = v_cliente_id for update;
    -- o CPF nunca colide com o de OUTRO cliente (índice único): na dúvida, fica o que está
    v_cpf_final := case
                     when v_cpf is null then v_cliente.cpf_cnpj
                     when exists (select 1 from clientes x
                                   where x.cpf_cnpj = v_cpf and x.id <> v_cliente_id) then v_cliente.cpf_cnpj
                     else v_cpf
                   end;
    if (v_cliente.cpf_cnpj, v_cliente.nome, v_cliente.fone, v_cliente.email, v_cliente.endereco,
        v_cliente.numero, v_cliente.complemento, v_cliente.bairro, v_cliente.cidade, v_cliente.uf,
        v_cliente.cep, v_cliente.tiny_id_contato)
       is distinct from
       (v_cpf_final,
        case when v_nome <> '' then v_nome else v_cliente.nome end,
        coalesce(v_fone, v_cliente.fone),
        coalesce(v_email, v_cliente.email),
        coalesce(v_endereco, v_cliente.endereco),
        coalesce(v_end_numero, v_cliente.numero),
        coalesce(v_complemento, v_cliente.complemento),
        coalesce(v_bairro, v_cliente.bairro),
        coalesce(v_cidade, v_cliente.cidade),
        coalesce(v_uf, v_cliente.uf),
        coalesce(v_cep, v_cliente.cep),
        coalesce(v_cliente.tiny_id_contato, v_contato)) then
      update clientes set
        cpf_cnpj        = v_cpf_final,
        nome            = case when v_nome <> '' then v_nome else nome end,
        fone            = coalesce(v_fone, fone),
        email           = coalesce(v_email, email),
        endereco        = coalesce(v_endereco, endereco),
        numero          = coalesce(v_end_numero, numero),
        complemento     = coalesce(v_complemento, complemento),
        bairro          = coalesce(v_bairro, bairro),
        cidade          = coalesce(v_cidade, cidade),
        uf              = coalesce(v_uf, uf),
        cep             = coalesce(v_cep, cep),
        tiny_id_contato = coalesce(tiny_id_contato, v_contato),
        atualizado_em   = now()
      where id = v_cliente_id;
      v_cliente_mudou := v_atual.id is not null;
    end if;
  end if;

  -- ---------- O PEDIDO COMO O TINY MANDOU ------------------------------------
  n_situacao            := nullif(trim(coalesce(p->>'situacao','')),'');
  n_data_pedido         := to_date(nullif(trim(coalesce(p->>'data_pedido','')),''), 'DD/MM/YYYY');
  n_data_prevista       := to_date(nullif(trim(coalesce(p->>'data_prevista','')),''), 'DD/MM/YYYY');
  n_total_produtos      := nullif(replace(trim(coalesce(p->>'total_produtos','')), ',', '.'), '')::numeric(12,2);
  n_total_pedido        := nullif(replace(trim(coalesce(p->>'total_pedido','')),   ',', '.'), '')::numeric(12,2);
  n_valor_frete         := nullif(replace(trim(coalesce(p->>'valor_frete','')),    ',', '.'), '')::numeric(12,2);
  n_forma_pagamento     := nullif(trim(coalesce(p->>'forma_pagamento','')),'');
  n_meio_pagamento      := nullif(trim(coalesce(p->>'meio_pagamento','')),'');
  n_forma_envio         := nullif(trim(coalesce(p->>'forma_envio','')),'');
  n_qtd_parcelas        := coalesce(jsonb_array_length(coalesce(p->'parcelas','[]'::jsonb)), 0);
  n_marcadores          := (select coalesce(array_agg(coalesce(m->'marcador'->>'descricao', m->>'descricao')), '{}')
                              from jsonb_array_elements(coalesce(p->'marcadores','[]'::jsonb)) m);
  n_obs                 := nullif(trim(coalesce(p->>'obs','')),'');
  n_obs_interna         := nullif(trim(coalesce(p->>'obs_interna','')),'');
  n_codigo_rastreamento := nullif(trim(coalesce(p->>'codigo_rastreamento','')),'');
  n_url_rastreamento    := nullif(trim(coalesce(p->>'url_rastreamento','')),'');
  n_vendedor            := nullif(trim(coalesce(p->>'nome_vendedor','')),'');
  n_ecommerce           := nullif(trim(coalesce(p->>'nome_ecommerce','')),'');

  if v_atual.id is null then
    -- ---------- PEDIDO NOVO --------------------------------------------------
    insert into pedidos as pd (
      tiny_id, numero, cliente_id, situacao, data_pedido, data_prevista,
      total_produtos, total_pedido, valor_frete,
      forma_pagamento, meio_pagamento, forma_envio,
      qtd_parcelas, parcelas, marcadores, obs, obs_interna,
      endereco_entrega, codigo_rastreamento, url_rastreamento,
      vendedor, ecommerce, raw, origem)
    values (
      v_tiny_id, v_numero, v_cliente_id, n_situacao, n_data_pedido, n_data_prevista,
      n_total_produtos, n_total_pedido, n_valor_frete,
      n_forma_pagamento, n_meio_pagamento, n_forma_envio,
      n_qtd_parcelas, p->'parcelas', n_marcadores, n_obs, n_obs_interna,
      p->'endereco_entrega', n_codigo_rastreamento, n_url_rastreamento,
      n_vendedor, n_ecommerce, p, p_origem)
    on conflict (numero) do update set           -- corrida rara: outro escritor inseriu no meio
      tiny_id             = coalesce(excluded.tiny_id, pd.tiny_id),
      cliente_id          = coalesce(excluded.cliente_id, pd.cliente_id),
      situacao            = coalesce(excluded.situacao, pd.situacao),
      data_pedido         = coalesce(excluded.data_pedido, pd.data_pedido),
      data_prevista       = coalesce(excluded.data_prevista, pd.data_prevista),
      total_produtos      = coalesce(excluded.total_produtos, pd.total_produtos),
      total_pedido        = coalesce(excluded.total_pedido, pd.total_pedido),
      valor_frete         = coalesce(excluded.valor_frete, pd.valor_frete),
      forma_pagamento     = coalesce(excluded.forma_pagamento, pd.forma_pagamento),
      meio_pagamento      = coalesce(excluded.meio_pagamento, pd.meio_pagamento),
      forma_envio         = coalesce(excluded.forma_envio, pd.forma_envio),
      qtd_parcelas        = excluded.qtd_parcelas,
      parcelas            = coalesce(excluded.parcelas, pd.parcelas),
      marcadores          = excluded.marcadores,
      obs                 = case when v_tem_obs then excluded.obs else pd.obs end,
      obs_interna         = case when v_tem_obs_interna then excluded.obs_interna else pd.obs_interna end,
      endereco_entrega    = coalesce(excluded.endereco_entrega, pd.endereco_entrega),
      codigo_rastreamento = coalesce(excluded.codigo_rastreamento, pd.codigo_rastreamento),
      url_rastreamento    = coalesce(excluded.url_rastreamento, pd.url_rastreamento),
      vendedor            = coalesce(excluded.vendedor, pd.vendedor),
      ecommerce           = coalesce(excluded.ecommerce, pd.ecommerce),
      raw                 = coalesce(excluded.raw, pd.raw),
      atualizado_em       = now()
    returning pd.id into v_pedido_id;
    v_mudancas := array['novo'];
  else
    -- ---------- PEDIDO QUE JÁ EXISTE: edição edita, apagar não apaga (D-50) ---
    --            exceto as duas observações, que acompanham o Tiny quando vêm
    v_pedido_id           := v_atual.id;
    f_tiny_id             := coalesce(v_tiny_id, v_atual.tiny_id);
    f_situacao            := coalesce(n_situacao, v_atual.situacao);
    f_data_pedido         := coalesce(n_data_pedido, v_atual.data_pedido);
    f_data_prevista       := coalesce(n_data_prevista, v_atual.data_prevista);
    f_total_produtos      := coalesce(n_total_produtos, v_atual.total_produtos);
    f_total_pedido        := coalesce(n_total_pedido, v_atual.total_pedido);
    f_valor_frete         := coalesce(n_valor_frete, v_atual.valor_frete);
    f_forma_pagamento     := coalesce(n_forma_pagamento, v_atual.forma_pagamento);
    f_meio_pagamento      := coalesce(n_meio_pagamento, v_atual.meio_pagamento);
    f_forma_envio         := coalesce(n_forma_envio, v_atual.forma_envio);
    f_parcelas            := coalesce(p->'parcelas', v_atual.parcelas);
    f_obs                 := case when v_tem_obs then n_obs else v_atual.obs end;
    f_obs_interna         := case when v_tem_obs_interna then n_obs_interna else v_atual.obs_interna end;
    f_endereco_entrega    := coalesce(p->'endereco_entrega', v_atual.endereco_entrega);
    f_codigo_rastreamento := coalesce(n_codigo_rastreamento, v_atual.codigo_rastreamento);
    f_url_rastreamento    := coalesce(n_url_rastreamento, v_atual.url_rastreamento);
    f_vendedor            := coalesce(n_vendedor, v_atual.vendedor);
    f_ecommerce           := coalesce(n_ecommerce, v_atual.ecommerce);

    if f_situacao is distinct from v_atual.situacao then
      v_mudancas := array_append(v_mudancas, 'situacao');
    end if;
    if f_data_prevista is distinct from v_atual.data_prevista then
      v_mudancas := array_append(v_mudancas, 'previsao');
    end if;
    if f_obs is distinct from v_atual.obs then
      v_mudancas := array_append(v_mudancas, 'obs');
    end if;
    if f_obs_interna is distinct from v_atual.obs_interna then
      v_mudancas := array_append(v_mudancas, 'obs_interna');
    end if;
    if n_marcadores is distinct from v_atual.marcadores then
      v_mudancas := array_append(v_mudancas, 'marcadores');
    end if;
    if (f_total_produtos, f_total_pedido, f_valor_frete)
       is distinct from (v_atual.total_produtos, v_atual.total_pedido, v_atual.valor_frete) then
      v_mudancas := array_append(v_mudancas, 'valores');
    end if;
    if (p->'itens') is distinct from (v_atual.raw->'itens') then
      v_mudancas := array_append(v_mudancas, 'itens');
    end if;
    if f_vendedor is distinct from v_atual.vendedor then
      v_mudancas := array_append(v_mudancas, 'vendedor');
    end if;
    if f_forma_envio is distinct from v_atual.forma_envio then
      v_mudancas := array_append(v_mudancas, 'forma_envio');
    end if;
    if (f_codigo_rastreamento, f_url_rastreamento)
       is distinct from (v_atual.codigo_rastreamento, v_atual.url_rastreamento) then
      v_mudancas := array_append(v_mudancas, 'rastreio');
    end if;
    if (f_forma_pagamento, f_meio_pagamento, n_qtd_parcelas, f_parcelas)
       is distinct from (v_atual.forma_pagamento, v_atual.meio_pagamento, v_atual.qtd_parcelas, v_atual.parcelas) then
      v_mudancas := array_append(v_mudancas, 'pagamento');
    end if;
    if f_data_pedido is distinct from v_atual.data_pedido then
      v_mudancas := array_append(v_mudancas, 'data');
    end if;
    if f_endereco_entrega is distinct from v_atual.endereco_entrega then
      v_mudancas := array_append(v_mudancas, 'endereco_entrega');
    end if;
    if (f_tiny_id, f_ecommerce) is distinct from (v_atual.tiny_id, v_atual.ecommerce) then
      v_mudancas := array_append(v_mudancas, 'cadastro');
    end if;
    -- Regrava o pedido quando uma coluna muda, quando o cliente do pedido muda ou
    -- quando a cópia crua muda (o nome novo do contato mora nela — sem regravar,
    -- a próxima rodada acharia a mesma diferença de novo).
    v_gravar := cardinality(v_mudancas) > 0
                or v_cliente_id is distinct from v_atual.cliente_id
                or p is distinct from v_atual.raw;
    if v_cliente_id is distinct from v_atual.cliente_id or v_cliente_mudou then
      v_mudancas := array_append(v_mudancas, 'cliente');
    end if;
    -- O Tiny mudou algo que não vira coluna (datas de envio, depósito…).
    if cardinality(v_mudancas) = 0 and p is distinct from v_atual.raw then
      v_mudancas := array_append(v_mudancas, 'outros');
    end if;

    if v_gravar then
      update pedidos set
        tiny_id             = f_tiny_id,
        cliente_id          = v_cliente_id,
        situacao            = f_situacao,
        data_pedido         = f_data_pedido,
        data_prevista       = f_data_prevista,
        total_produtos      = f_total_produtos,
        total_pedido        = f_total_pedido,
        valor_frete         = f_valor_frete,
        forma_pagamento     = f_forma_pagamento,
        meio_pagamento      = f_meio_pagamento,
        forma_envio         = f_forma_envio,
        qtd_parcelas        = n_qtd_parcelas,
        parcelas            = f_parcelas,
        marcadores          = n_marcadores,
        obs                 = f_obs,
        obs_interna         = f_obs_interna,
        endereco_entrega    = f_endereco_entrega,
        codigo_rastreamento = f_codigo_rastreamento,
        url_rastreamento    = f_url_rastreamento,
        vendedor            = f_vendedor,
        ecommerce           = f_ecommerce,
        raw                 = p,
        atualizado_em       = now()
      where id = v_pedido_id;
    end if;
  end if;

  -- ---------- ITENS: substituição total, só quando é pedido novo ou os itens mudaram
  if 'novo' = any (v_mudancas) or 'itens' = any (v_mudancas) then
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
  end if;

  -- ---------- LOG -------------------------------------------------------------
  -- Cada aviso do Tiny segue registrado (o n8n poda as execuções em 7 dias).
  -- A conferência diária NÃO: ela deixa uma linha só por rodada (o resumo).
  if p_tipo is distinct from 'pente_fino' then
    insert into eventos (tipo, tiny_id, numero, situacao)
    values (p_tipo, v_tiny_id, v_numero, n_situacao);
  end if;

  -- O que mudou fica na transação para quem chamou (a conferência) ler.
  perform set_config('domoby.pedido_mudancas', to_jsonb(v_mudancas)::text, true);

  return v_pedido_id;
end;
$$;

comment on function public.fn_upsert_pedido(jsonb, text, bigint, text, bigint) is
  'A única porta de escrita dos pedidos do Tiny (n8n). SESSAO-29: cliente por id do contato → CPF → o cliente que o pedido já tem (sem CPF) → nome+fone; observações acompanham o Tiny também quando apagadas (D-50); grava só o que mudou e deixa a lista em domoby.pedido_mudancas.';

revoke execute on function public.fn_upsert_pedido(jsonb, text, bigint, text, bigint) from public, anon, authenticated;
grant  execute on function public.fn_upsert_pedido(jsonb, text, bigint, text, bigint) to service_role;

-- ----------------------------------------------------------------------------
-- 3 · A porta do fluxo de carga do n8n — recriada a partir da versão VIVA de
--     01/10. Muda só o que a linha da CONFERÊNCIA (params.rodada) pede.
-- ----------------------------------------------------------------------------
create or replace function public.fn_backfill_aplicar(
  p_fila_id  bigint,
  p_recurso  text,
  p_payload  jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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
      on conflict (recurso, chave) do nothing;
    else
      -- conferência: o pedido achado volta para a fila (uma vez por rodada; o
      -- que está sendo lido agora não se mexe) — a fila é única por recurso+chave
      insert into public.tiny_fila as f (recurso, chave, referencia, prioridade, params)
      select x->>'recurso', x->>'chave', nullif(x->>'referencia',''),
             coalesce((x->>'prioridade')::smallint, 5),
             coalesce(x->'params', '{}'::jsonb) || jsonb_build_object('rodada', v_rodada)
        from jsonb_array_elements(coalesce(p_payload, '[]'::jsonb)) x
       where nullif(x->>'chave','') is not null
      on conflict (recurso, chave) do update
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
$$;

revoke execute on function public.fn_backfill_aplicar(bigint, text, jsonb) from public, anon, authenticated;
grant  execute on function public.fn_backfill_aplicar(bigint, text, jsonb) to service_role;

-- ----------------------------------------------------------------------------
-- 4 · O pedido vivo que só a conferência achou entra no PCP (D-96) — a guarda
--     do gatilho de inserção aceita a origem `pente_fino`. Pedido encerrado
--     (entregue, não entregue, cancelado) continua de fora; histórico (`backfill`)
--     também. Recria o espelho das migrations 24/25 com a guarda nova.
-- ----------------------------------------------------------------------------
drop trigger if exists plt_pedidos_reagir_insercao on public.pedidos;
create trigger plt_pedidos_reagir_insercao
  after insert on public.pedidos
  for each row
  when (
    coalesce(new.origem, '') in ('webhook', 'pente_fino')
    and translate(lower(coalesce(new.situacao, '')),
                  'áàâãéêíìóôõúùüç ', 'aaaaeeiiooouuuc_')
        not in ('entregue', 'nao_entregue', 'cancelado')
  )
  execute function plt_privado.fn_reagir_pedido();

-- ----------------------------------------------------------------------------
-- 5 · O endereço do fluxo de carga no n8n (webhook de produção, caminho com
--     UUID = segredo). Só nasce se não existir — trocar a URL ou desligar
--     (`ativo`) não é desfeito pela reaplicação.
-- ----------------------------------------------------------------------------
insert into public.plt_webhooks (nome, url, eventos, ativo)
select 'n8n · fila de leitura do Tiny (pedidos)',
       'https://n8n.srv1877515.hstgr.cloud/webhook/a9564e90-bdf4-4e46-b425-ea668cb7a22e',
       array['tiny_fila'],
       true
 where not exists (select 1 from public.plt_webhooks w where 'tiny_fila' = any (w.eventos));

-- ----------------------------------------------------------------------------
-- 6 · A fila precisa do n8n agora? Linha esperando e nenhum lote em andamento
--     (nada pego há menos de 15 min — o mesmo prazo em que o fn_fila_proximos
--     devolve lote travado). Nunca dois lotes ao mesmo tempo (limite do Tiny).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_fila_precisa_chamar()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.tiny_fila f where f.status = 'pendente' and f.tentativas < 4)
     and not exists (select 1 from public.tiny_fila f
                      where f.status = 'processando'
                        and f.reservado_em >= now() - interval '15 minutes');
$$;

create or replace function plt_privado.fn_tiny_fila_chamar_n8n()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url       text;
  v_pendentes integer;
begin
  if not plt_privado.fn_tiny_fila_precisa_chamar() then
    return 'nada_a_fazer';
  end if;
  select w.url into v_url from public.plt_webhooks w
   where w.ativo and 'tiny_fila' = any (w.eventos)
   order by w.id limit 1;
  if v_url is null then
    return 'sem_endereco';
  end if;
  if to_regproc('net.http_post') is null then
    return 'sem_pg_net';   -- ambiente de teste
  end if;
  select count(*) into v_pendentes from public.tiny_fila f where f.status = 'pendente';
  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('motivo', 'fila_do_tiny', 'pendentes', v_pendentes, 'em', now()),
    headers := jsonb_build_object('Content-Type', 'application/json'));
  return 'chamado';
end;
$$;

-- ----------------------------------------------------------------------------
-- 7 · O resumo da rodada: UMA linha no log da integração (`eventos`, tipo
--     `pente_fino`) — quantos relidos, quantos estavam diferentes e quais.
--     A rodada corrente mora na linha da busca (`pente-fino:p1`).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_pente_fino_resumir(p_rodada text, p_estado text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_busca  jsonb;
  v_resumo jsonb;
begin
  select f.params into v_busca from public.tiny_fila f
   where f.recurso = 'pedidos_pesquisa' and f.chave = 'pente-fino:p1';

  with linhas as (
    select f.recurso, f.status, f.referencia, f.params
      from public.tiny_fila f
     where f.params->>'rodada' = p_rodada
  ),
  pedidos_rodada as (
    select l.*, coalesce(l.params->'mudou', '[]'::jsonb) as mudou
      from linhas l where l.recurso = 'pedido'
  )
  select jsonb_build_object(
           'rodada',          p_rodada,
           'estado',          p_estado,
           'motivo',          coalesce(v_busca->>'motivo', 'madrugada'),
           'inicio',          v_busca->>'inicio',
           'fim',             now(),
           'janela_dias',     60,
           'paginas_busca',   (select count(*) from linhas where recurso = 'pedidos_pesquisa'),
           'relidos',         (select count(*) from pedidos_rodada where status = 'ok'),
           'mudaram',         (select count(*) from pedidos_rodada where status = 'ok' and jsonb_array_length(mudou) > 0),
           'novos',           (select count(*) from pedidos_rodada where mudou ? 'novo'),
           'nao_encontrados', (select count(*) from pedidos_rodada where status = 'vazio'),
           'falhas',          (select count(*) from linhas where status = 'erro'),
           'pendentes',       (select count(*) from linhas where status in ('pendente', 'processando')),
           'pedidos',         coalesce((
              select jsonb_agg(jsonb_build_object('numero', x.numero, 'campos', x.mudou) order by x.numero desc)
                from (select coalesce(pr.params->>'numero', pr.referencia) as numero, pr.mudou
                        from pedidos_rodada pr
                       where pr.status = 'ok' and jsonb_array_length(pr.mudou) > 0
                       order by 1 desc
                       limit 300) x), '[]'::jsonb))
    into v_resumo;

  insert into public.eventos (tipo, payload) values ('pente_fino', v_resumo);

  update public.tiny_fila f
     set params = f.params || jsonb_build_object('resumo_em', now())
   where f.recurso = 'pedidos_pesquisa' and f.chave = 'pente-fino:p1'
     and f.params->>'rodada' = p_rodada;
  return v_resumo;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8 · O relógio da fila — existe SÓ enquanto há trabalho: a conferência o
--     agenda (1/min); com linha esperando e nenhum lote em andamento, chama o
--     n8n; com a fila vazia, fecha a rodada e se desagenda. Fila vazia = nada
--     roda, nada é consultado, nenhuma execução no n8n.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_fila_relogio()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chamada text;
  v_busca   jsonb;
  v_resumo  jsonb;
  v_job     bigint;
begin
  -- lote que travou (pego há mais de 15 min) volta para a fila
  update public.tiny_fila f
     set status = 'pendente', reservado_em = null
   where f.status = 'processando'
     and f.reservado_em < now() - interval '15 minutes';

  if exists (select 1 from public.tiny_fila f where f.status = 'pendente' and f.tentativas < 4)
     or exists (select 1 from public.tiny_fila f where f.status = 'processando') then
    begin
      v_chamada := plt_privado.fn_tiny_fila_chamar_n8n();
    exception when others then
      v_chamada := 'erro: ' || left(sqlerrm, 200);
    end;
    return jsonb_build_object('n8n', v_chamada, 'fila', 'com_trabalho');
  end if;

  -- nada na fila: a rodada aberta ganha o resumo, e o relógio se desliga
  select f.params into v_busca from public.tiny_fila f
   where f.recurso = 'pedidos_pesquisa' and f.chave = 'pente-fino:p1';
  if v_busca->>'rodada' is not null and v_busca->>'resumo_em' is null then
    v_resumo := plt_privado.fn_tiny_pente_fino_resumir(v_busca->>'rodada', 'concluida');
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_job from cron.job where jobname = 'plt-tiny-fila';
    if v_job is not null then
      perform cron.unschedule(v_job);
    end if;
  end if;
  return jsonb_build_object('n8n', 'nada_a_fazer', 'fila', 'vazia',
                            'resumo', v_resumo is not null, 'relogio', 'desligado');
end;
$$;

-- Acorda a fila: agenda o relógio (se ainda não estiver) e já chama o 1º lote.
-- Depois de reabrir linhas à mão ("Reprocessar de propósito"), chamar isto.
create or replace function plt_privado.fn_tiny_fila_acordar()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_relogio text := 'sem_pg_cron';
  v_chamada text;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'plt-tiny-fila') then
      v_relogio := 'ja_estava';
    else
      perform cron.schedule('plt-tiny-fila', '* * * * *', 'select plt_privado.fn_tiny_fila_relogio()');
      v_relogio := 'agendado';
    end if;
  end if;
  begin
    v_chamada := plt_privado.fn_tiny_fila_chamar_n8n();
  exception when others then
    v_chamada := 'erro: ' || left(sqlerrm, 200);
  end;
  return jsonb_build_object('relogio', v_relogio, 'n8n', v_chamada);
end;
$$;

-- ----------------------------------------------------------------------------
-- 9 · A conferência diária (D-50: 60 dias, 3h). Enfileira a busca do Tiny pelos
--     últimos 60 dias (página 1; o n8n planta as seguintes) e os pedidos não
--     terminados de QUALQUER idade, e acorda a fila. Rodada que não terminou até
--     a próxima fica registrada como interrompida.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_pente_fino_iniciar(p_motivo text default 'madrugada')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_local   timestamp := now() at time zone 'America/Fortaleza';
  v_hoje    date      := (now() at time zone 'America/Fortaleza')::date;
  v_rodada  text      := to_char(now() at time zone 'America/Fortaleza', 'YYYY-MM-DD"T"HH24:MI:SS.US');
  v_busca   jsonb;
  v_abertos integer;
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
  on conflict (recurso, chave) do update
     set status = 'pendente', tentativas = 0, erro = null, reservado_em = null,
         processado_em = null, referencia = excluded.referencia,
         prioridade = excluded.prioridade, params = excluded.params;

  insert into public.tiny_fila as f (recurso, chave, referencia, prioridade, params)
  select 'pedido', p.tiny_id::text, p.numero::text, 2, jsonb_build_object('rodada', v_rodada)
    from public.pedidos p
   where p.tiny_id is not null
     and plt_privado.fn_situacao_normalizada(p.situacao) not in ('entregue', 'nao_entregue', 'cancelado')
  on conflict (recurso, chave) do update
     set status = 'pendente', tentativas = 0, erro = null, reservado_em = null,
         referencia = excluded.referencia, params = excluded.params
   where f.status <> 'processando';
  get diagnostics v_abertos = row_count;

  return jsonb_build_object('rodada', v_rodada, 'hora_local', v_local, 'nao_terminados', v_abertos)
         || plt_privado.fn_tiny_fila_acordar();
end;
$$;

comment on function plt_privado.fn_tiny_pente_fino_iniciar(text) is
  'SESSAO-29 (D-50): a conferência diária com o Tiny — busca dos últimos 60 dias + não terminados, pelo fluxo de carga do n8n (API v2, sem token novo). Agendada às 03:00 (plt-tiny-pente-fino); manual: select plt_privado.fn_tiny_pente_fino_iniciar(''manual'').';

-- ----------------------------------------------------------------------------
-- 10 · Agendamento da conferência: 03:00 de Natal/São Paulo = 06:00 UTC (só
--      onde existe pg_cron — produção). O relógio da fila NÃO nasce aqui: a
--      própria conferência o agenda e ele se desagenda quando a fila esvazia.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'plt-tiny-pente-fino') then
      perform cron.schedule('plt-tiny-pente-fino', '0 6 * * *',
        'select plt_privado.fn_tiny_pente_fino_iniciar(''madrugada'')');
    end if;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 11 · Correção única (D-97): nome de cliente gravado com entidade HTML.
-- ----------------------------------------------------------------------------
update public.clientes c
   set nome = plt_privado.fn_texto_sem_entidades(c.nome),
       atualizado_em = now()
 where c.nome like '%&%;%'
   and plt_privado.fn_texto_sem_entidades(c.nome) <> c.nome;

-- ----------------------------------------------------------------------------
-- 12 · Permissões: maquinaria fora da API (E-11)
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_texto_sem_entidades(text)              from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_fila_precisa_chamar()             from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_fila_chamar_n8n()                 from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_pente_fino_resumir(text, text)    from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_fila_relogio()                    from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_fila_acordar()                    from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_pente_fino_iniciar(text)          from public, anon, authenticated;
