-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 76 — A FILA DO ESTOQUE COM O TINY
-- NÃO GIRA MAIS SEM FIM (SESSAO-32 — achado do retrato de partida, 15–16/10/2026)
--
-- O que estava acontecendo (provado no banco real em 15/10, só leitura):
--   · Dois INSUMOS cadastrados no Tiny como "simples" (classe S) têm saldo
--     enorme lá — fita de borda 22.878,58 m; suporte 3.660 un. A leitura
--     (D-76: "Tiny acima → a plataforma sobe até ele") tentava criar UMA PEÇA
--     POR UNIDADE — 22.878 cards + eventos + registros numa transação só —,
--     estourava o tempo limite (8 s) e era desfeita.
--   · A reserva da fila (plt_fn_tiny_estoque_proximos) não contava tentativa:
--     o item voltava a cada 10 minutos, sem fim. Resultado: ~14,5 milhões de
--     linhas gravadas e desfeitas em cards, eventos e registros desde o fim de
--     setembro — as estatísticas erradas do planejador (lei §14 #9), o diário
--     de mudanças (WAL) inchado e o processador do banco gasto à toa.
--   · Os dois foram PARADOS à mão em 16/10 (manutenção
--     2026-10-16_parar_fila_tiny_saldos_gigantes.sql) — esta migration impede
--     que volte.
--
-- O que muda (para todo produto normal, o resultado é o de sempre):
--   1. TETO: uma leitura nunca cria — nem o ponto de partida copia — mais de 500
--      peças de uma vez (o mesmo teto da entrada manual da logística). Acima
--      disso o produto fica PARADO na fila, com o motivo em língua de gente, e
--      aparece em Configurações → Tiny; a leitura do Tiny fica registrada (o
--      número de insumo continua vindo dela).
--   2. TENTATIVA CONTADA: a reserva que vence (10 min) sem resposta do fluxo
--      conta como falha ("o fluxo do n8n não respondeu a tempo"); 5 seguidas =
--      PARADO, como qualquer outra falha.
-- Nada nas tabelas da integração; nada no fluxo do n8n.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O teto e o "parar já"
-- ----------------------------------------------------------------------------

-- O teto de peças por gesto automático: o mesmo da entrada manual (1–500).
create or replace function plt_privado.fn_estoque_teto_pecas()
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select 500;
$$;

comment on function plt_privado.fn_estoque_teto_pecas() is
  'SESSAO-32: quantas peças um gesto automático (a leitura do Tiny, o ponto de partida) cria de uma vez, no máximo — o mesmo teto da entrada manual. Acima disso o produto para na fila com o motivo.';

-- O motivo, em língua de gente, com o número no jeito brasileiro (22.878,58 m).
create or replace function plt_privado.fn_tiny_estoque_msg_teto(p_saldo numeric, p_unidade text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select format('Saldo no Tiny alto demais para virar peças (%s %s): parece insumo — conferir o cadastro no Tiny.',
                translate(rtrim(to_char(p_saldo, 'FM999,999,999,990.99'), '.'), ',.', '.,'),
                lower(coalesce(nullif(btrim(p_unidade), ''), 'un')));
$$;

-- Para a fila de UM produto na hora, com o motivo — o mesmo estado que 5 falhas
-- seguidas deixam (aparece em Configurações → Tiny; uma linha na trilha).
create or replace function plt_privado.fn_tiny_estoque_parar(p_produto_tiny_id bigint, p_erro text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.plt_tiny_estoque_fila
     set tentativas   = greatest(tentativas, 5),
         ultimo_erro  = left(coalesce(p_erro, 'parado sem descrição'), 500),
         reservado_em = null,
         parado_em    = now()
   where produto_tiny_id = p_produto_tiny_id;
  if found then
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
      values (null, 'estoque_tiny_falha',
              jsonb_build_object('produto_tiny_id', p_produto_tiny_id,
                                 'sku', (select codigo from public.produtos where tiny_id = p_produto_tiny_id),
                                 'erro', left(coalesce(p_erro, ''), 500)));
  end if;
end;
$$;

comment on function plt_privado.fn_tiny_estoque_parar(bigint, text) is
  'SESSAO-32: para a fila de um produto na hora (tentativas = 5, parado_em, o motivo) — o mesmo estado de 5 falhas seguidas.';

-- ----------------------------------------------------------------------------
-- 2 · A leitura do Tiny — recriada POR INTEIRO a partir da versão da
--     migration 57 (20261008130000), com o teto nos dois lugares que criam peça
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tiny_estoque_leitura(
  p_produto_tiny_id bigint,
  p_versao          integer,
  p_resposta        jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fila       public.plt_tiny_estoque_fila%rowtype;
  v_ret        jsonb;
  v_prod       jsonb;
  v_saldo      numeric;
  v_tiny       integer;
  v_livres     integer;
  v_reservadas integer;
  v_alvo       integer;
  v_dep        jsonb;
  v_dep_saldo  numeric;
  v_conta      text;
  v_deposito   text;
  v_id         bigint;
  v_qtd        numeric;
  v_tipo       text;
  v_sku        text;
  v_n          integer;
  v_evento_leitura bigint;
begin
  select * into v_fila from public.plt_tiny_estoque_fila
   where produto_tiny_id = p_produto_tiny_id for update;
  if not found then
    return jsonb_build_object('acao', 'nada', 'motivo', 'fora_da_fila');
  end if;

  v_ret := coalesce(p_resposta -> 'retorno', p_resposta);
  if coalesce(v_ret ->> 'status', '') <> 'OK' or v_ret -> 'produto' is null then
    perform plt_privado.fn_tiny_estoque_falhou(p_produto_tiny_id,
      'Leitura do Tiny: ' || left(coalesce((v_ret -> 'erros')::text, v_ret::text, 'sem resposta'), 400));
    return jsonb_build_object('acao', 'nada', 'motivo', 'erro_na_leitura');
  end if;

  v_prod  := v_ret -> 'produto';
  v_saldo := plt_privado.fn_tiny_numero(v_prod ->> 'saldo');
  if v_saldo is null then
    perform plt_privado.fn_tiny_estoque_falhou(p_produto_tiny_id, 'Leitura do Tiny sem saldo.');
    return jsonb_build_object('acao', 'nada', 'motivo', 'erro_na_leitura');
  end if;
  select pr.codigo into v_sku from public.produtos pr where pr.tiny_id = p_produto_tiny_id;

  -- A leitura fica guardada no mesmo formato da carga (o detalhe do produto
  -- mostra "o que o Tiny diz" a partir dela).
  insert into public.eventos (tipo, tiny_id, payload)
    values ('estoque_fabrica', p_produto_tiny_id,
            jsonb_build_object(
              'cnpj', '27556613000166', 'tipo', 'estoque', 'origem', 'leitura',
              'motivo', v_fila.motivo,
              'dados', jsonb_build_object(
                'idProduto', p_produto_tiny_id, 'sku', coalesce(v_prod ->> 'codigo', v_sku),
                'nome', v_prod ->> 'nome', 'saldo', v_saldo,
                'saldoReservado', plt_privado.fn_tiny_numero(v_prod ->> 'saldoReservado'),
                'depositos', coalesce(v_prod -> 'depositos', '[]'::jsonb))))
    returning id into v_evento_leitura;
  -- SESSAO-30: a leitura entra na linha do produto no mesmo gesto (projeção).
  perform plt_privado.fn_estoque_numeros_leitura(v_evento_leitura);

  perform pg_advisory_xact_lock(hashtextextended('plt_estoque_produto:' || p_produto_tiny_id, 0));
  select x.livres, x.reservadas into v_livres, v_reservadas
    from plt_privado.fn_estoque_pecas(p_produto_tiny_id) x;
  v_tiny := greatest(floor(v_saldo), 0)::int;   -- negativo no Tiny = nada no galpão (D-53)

  -- (1) PONTO DE PARTIDA: as livres ficam com o saldo do Tiny (menos as
  --     reservadas, que também estão no galpão).
  if v_fila.copiar then
    v_alvo := greatest(v_tiny - v_reservadas, 0);
    -- SESSAO-32: o teto — saldo que viraria mais peças do que cabe num gesto
    -- é insumo cadastrado como "simples" no Tiny: para com o motivo (a leitura
    -- acima já ficou registrada).
    if v_alvo - v_livres > plt_privado.fn_estoque_teto_pecas() then
      perform plt_privado.fn_tiny_estoque_parar(p_produto_tiny_id,
        plt_privado.fn_tiny_estoque_msg_teto(v_saldo, coalesce(v_prod ->> 'unidade', (select pr.unidade from public.produtos pr where pr.tiny_id = p_produto_tiny_id))));
      return jsonb_build_object('acao', 'nada', 'motivo', 'saldo_grande_demais', 'tiny', v_saldo, 'pecas', v_alvo - v_livres);
    end if;
    if v_alvo > v_livres then
      perform plt_privado.fn_estoque_criar_pecas(p_produto_tiny_id, v_alvo - v_livres, null, 'api',
        'Ponto de partida: o saldo do Tiny.',
        jsonb_build_object('motivo', 'tiny_copia', 'produto_tiny_id', p_produto_tiny_id, 'sku', v_sku,
                           'saldo_tiny', v_saldo, 'antes', v_livres, 'depois', v_alvo));
    elsif v_alvo < v_livres then
      perform plt_privado.fn_estoque_baixar_pecas(p_produto_tiny_id, v_livres - v_alvo, null, 'api',
        'Ponto de partida: o saldo do Tiny.',
        jsonb_build_object('motivo', 'tiny_copia', 'produto_tiny_id', p_produto_tiny_id, 'sku', v_sku,
                           'saldo_tiny', v_saldo, 'antes', v_livres, 'depois', v_alvo));
    end if;
    perform plt_privado.fn_tiny_estoque_concluir(p_produto_tiny_id, p_versao, true);
    return jsonb_build_object('acao', 'nada', 'motivo', 'copiado', 'livres', v_alvo, 'tiny', v_saldo);
  end if;

  -- (2) A PLATAFORMA MANDA: o Tiny fica com as livres (o número da tela).
  if v_fila.enviar then
    if v_saldo = v_livres then
      perform plt_privado.fn_tiny_estoque_concluir(p_produto_tiny_id, p_versao);
      return jsonb_build_object('acao', 'nada', 'motivo', 'ja_igual', 'livres', v_livres);
    end if;
    -- O depósito "Fábrica" da empresa da loja é onde as peças prontas estão e
    -- onde a venda baixa; sem ele (ou sem o id do produto na loja), o Geral
    -- da fábrica. A SOMA das duas empresas fica igual às livres.
    select d -> 'deposito' into v_dep
      from jsonb_array_elements(coalesce(v_prod -> 'depositos', '[]'::jsonb)) d
     where d -> 'deposito' ->> 'empresa' = 'lojadomoby' and d -> 'deposito' ->> 'nome' = 'Fábrica'
     limit 1;
    v_id := case when v_dep is not null then plt_privado.fn_tiny_id_loja(v_sku) end;
    if v_dep is not null and v_id is not null then
      v_conta := 'loja';
      v_deposito := 'Fábrica';
    else
      select d -> 'deposito' into v_dep
        from jsonb_array_elements(coalesce(v_prod -> 'depositos', '[]'::jsonb)) d
       where d -> 'deposito' ->> 'nome' = 'Geral'
         and coalesce(d -> 'deposito' ->> 'empresa', '') <> 'lojadomoby'
       limit 1;
      v_conta := 'fabrica';
      v_deposito := 'Geral';
      v_id := p_produto_tiny_id;
    end if;
    v_dep_saldo := coalesce(plt_privado.fn_tiny_numero(v_dep ->> 'saldo'), 0);
    v_qtd := v_dep_saldo + (v_livres - v_saldo);
    if v_qtd >= 0 then
      v_tipo := 'B';                        -- balanço: o depósito passa a ter v_qtd
    else
      v_tipo := 'S';                        -- balanço negativo não é aceito: saída da diferença
      v_qtd := v_saldo - v_livres;
    end if;
    return jsonb_build_object(
      'acao', 'ajustar', 'conta', v_conta, 'id_produto', v_id, 'deposito', v_deposito,
      'tipo', v_tipo, 'quantidade', v_qtd, 'sku', v_sku,
      'tiny_antes', v_saldo, 'tiny_depois', v_livres,
      'estoque', jsonb_build_object('estoque', jsonb_build_object(
         'idProduto', v_id, 'tipo', v_tipo, 'quantidade', v_qtd, 'deposito', v_deposito,
         'observacoes', left(format('Plataforma Domoby: estoque = %s', v_livres), 100))));
  end if;

  -- (3) LER: Tiny acima do que está no galpão pela plataforma → sobe (D-76).
  if v_tiny > v_livres + v_reservadas then
    v_n := v_tiny - v_livres - v_reservadas;
    -- SESSAO-32: o teto (ver o ponto de partida acima).
    if v_n > plt_privado.fn_estoque_teto_pecas() then
      perform plt_privado.fn_tiny_estoque_parar(p_produto_tiny_id,
        plt_privado.fn_tiny_estoque_msg_teto(v_saldo, coalesce(v_prod ->> 'unidade', (select pr.unidade from public.produtos pr where pr.tiny_id = p_produto_tiny_id))));
      return jsonb_build_object('acao', 'nada', 'motivo', 'saldo_grande_demais', 'tiny', v_saldo, 'pecas', v_n);
    end if;
    perform plt_privado.fn_estoque_criar_pecas(p_produto_tiny_id, v_n, null, 'api',
      'Entrou pelo Tiny.',
      jsonb_build_object('motivo', 'tiny', 'produto_tiny_id', p_produto_tiny_id, 'sku', v_sku,
                         'saldo_tiny', v_saldo, 'antes', v_livres, 'depois', v_livres + v_n,
                         'quantidade', v_n));
    perform plt_privado.fn_estoque_reposicao_coberta(p_produto_tiny_id);
  end if;
  perform plt_privado.fn_tiny_estoque_concluir(p_produto_tiny_id, p_versao);
  return jsonb_build_object('acao', 'nada', 'motivo', case when v_n > 0 then 'subiu' else 'sem_mudanca' end,
                            'entraram', coalesce(v_n, 0), 'tiny', v_saldo);
end;
$$;

comment on function public.plt_fn_tiny_estoque_leitura(bigint, integer, jsonb) is
  'D-76/D-77: o n8n devolve a leitura do Tiny (saldo somado das duas empresas). SESSAO-32: nunca cria (nem copia) mais de fn_estoque_teto_pecas() peças de uma vez — acima disso o produto para na fila com o motivo (insumo cadastrado como "simples" no Tiny), e a leitura fica registrada.';

-- ----------------------------------------------------------------------------
-- 3 · A reserva da fila — a que vence sem resposta conta como falha
--     (recriada a partir da migration 42 — 20260930120000; mesma forma)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tiny_estoque_proximos(p_limite integer default 20)
returns table (produto_tiny_id bigint, versao integer, sku text, enviar boolean, copiar boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  if plt_privado.fn_tiny_estoque_desde() is null then
    return;
  end if;
  -- SESSAO-32: a reserva que venceu (10 min) sem resposta do fluxo é uma FALHA
  -- (a leitura passou do tempo limite, o fluxo caiu) — antes o item voltava sem
  -- contar e girava sem fim; 5 seguidas = parado, como qualquer falha.
  for r in
    update public.plt_tiny_estoque_fila f
       set tentativas   = f.tentativas + 1,
           ultimo_erro  = 'O fluxo do n8n não respondeu a tempo (a leitura passou do tempo limite ou o fluxo caiu).',
           reservado_em = null,
           parado_em    = case when f.tentativas + 1 >= 5 then now() end
     where f.parado_em is null
       and f.reservado_em is not null
       and f.reservado_em < now() - interval '10 minutes'
    returning f.produto_tiny_id as id, f.parado_em as parou, f.ultimo_erro as erro
  loop
    if r.parou is not null then
      insert into public.plt_logs_atividade (usuario_id, acao, contexto)
        values (null, 'estoque_tiny_falha',
                jsonb_build_object('produto_tiny_id', r.id,
                                   'sku', (select pr.codigo from public.produtos pr where pr.tiny_id = r.id),
                                   'erro', r.erro));
    end if;
  end loop;

  return query
    with alvo as (
      select f.produto_tiny_id
        from public.plt_tiny_estoque_fila f
       where f.parado_em is null
         and (f.reservado_em is null or f.reservado_em < now() - interval '10 minutes')
       order by f.copiar desc, f.enviar desc, f.pedido_em
       limit least(greatest(coalesce(p_limite, 20), 1), 50)
         for update skip locked
    )
    update public.plt_tiny_estoque_fila f
       set reservado_em = now()
      from alvo
     where f.produto_tiny_id = alvo.produto_tiny_id
    returning f.produto_tiny_id, f.versao,
              (select pr.codigo from public.produtos pr where pr.tiny_id = f.produto_tiny_id),
              f.enviar, f.copiar;
end;
$$;

comment on function public.plt_fn_tiny_estoque_proximos(integer) is
  'D-76/D-77: o n8n pega o lote da fila (até 50). SESSAO-32: a reserva que venceu sem resposta conta como falha (5 seguidas = parado).';

-- ----------------------------------------------------------------------------
-- 4 · Quem chama o quê (a maquinaria fora da API — E-11; as portas do n8n só
--     com a chave de serviço, como na migration 42)
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_estoque_teto_pecas()                    from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_estoque_msg_teto(numeric, text)    from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_estoque_parar(bigint, text)        from public, anon, authenticated;
revoke all on function public.plt_fn_tiny_estoque_proximos(integer)           from public, anon, authenticated;
revoke all on function public.plt_fn_tiny_estoque_leitura(bigint, integer, jsonb) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.plt_fn_tiny_estoque_proximos(integer)           to service_role;
    grant execute on function public.plt_fn_tiny_estoque_leitura(bigint, integer, jsonb) to service_role;
  end if;
end;
$$;
