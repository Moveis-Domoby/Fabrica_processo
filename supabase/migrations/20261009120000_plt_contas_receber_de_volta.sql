-- ============================================================================
-- SESSAO-30 · ajuste do dono (09/10): "traga de volta as contas a receber do
-- Tiny" (D-122).
--
-- As contas a receber (o "pago / em aberto" de cada parcela) vieram UMA vez,
-- na carga do histórico, que terminou em 09/09/2026; a conferência diária com o
-- Tiny (migration 49) relê só os pedidos. Daqui em diante a MESMA conferência
-- (03:00, pelo mesmo fluxo do n8n — que não muda: ele faz a busca com os
-- filtros que a fila manda) traz também as contas:
--
--   1. `fn_tiny_pente_fino_iniciar`: enfileira a busca das contas EMITIDAS nos
--      últimos 60 dias (acha as novas) e a releitura das contas que ainda não
--      fecharam (nem pagas nem canceladas), de qualquer idade (pega o pago).
--   2. `fn_backfill_aplicar`: na conferência, a busca NÃO reabre a conta que já
--      fechou no Tiny (paga/cancelada) — a releitura diária fica com as novas e
--      as abertas (dezenas por dia, não centenas: Lei de Desempenho §6/§7); a
--      releitura de cada conta guarda o antes e o depois na linha da fila.
--      ⚠️ Limite conhecido: conta paga que o Tiny ESTORNA depois não é relida
--      sozinha — se acontecer, reabrir a linha da fila e acordar a fila.
--   3. `fn_tiny_pente_fino_resumir`: o resumo da rodada ganha o bloco "contas"
--      (relidas, novas, pagas, abertas, não encontradas).
--   4. `plt_fn_pcp_pedido_detalhe` (a janela do pedido no PCP): "conferidas em"
--      passa a ser a última busca das contas no Tiny (pelo índice da fila — a
--      versão da 63 varria a tabela de contas inteira a cada clique).
--
-- Funções recriadas a partir das versões VIVAS de 09/10 (pg_get_functiondef),
-- só com as trocas acima. Estrutura das tabelas da integração: INTACTA (nenhuma
-- coluna); nenhuma linha nasce ou some na aplicação. Grants: os mesmos (o
-- create or replace os mantém).
-- ============================================================================

set local lock_timeout = '5s';

-- 1 · a conferência diária enfileira também as contas a receber
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
  on conflict (recurso, chave) do update
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
  on conflict (recurso, chave) do update
     set status = 'pendente', tentativas = 0, erro = null, reservado_em = null,
         referencia = excluded.referencia, params = excluded.params
   where f.status <> 'processando';
  get diagnostics v_contas = row_count;

  return jsonb_build_object('rodada', v_rodada, 'hora_local', v_local, 'nao_terminados', v_abertos,
                            'contas_abertas', v_contas)
         || plt_privado.fn_tiny_fila_acordar();
end;
$function$;

-- 2 · a porta do fluxo de carga: a conta fechada não é relida; antes/depois na linha
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
         -- ↪️ D-122: a conta a receber que já FECHOU no Tiny (paga ou cancelada)
         -- não é relida — a releitura diária fica com as novas e as abertas
         and not (case when x->>'recurso' = 'conta_receber' and x->>'chave' ~ '^[0-9]{1,18}$'
                       then exists (select 1 from public.contas_receber cr
                                     where cr.tiny_id = (x->>'chave')::bigint
                                       and cr.situacao in ('pago', 'cancelada'))
                       else false end)
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

-- 3 · o resumo da rodada com as contas
CREATE OR REPLACE FUNCTION plt_privado.fn_tiny_pente_fino_resumir(p_rodada text, p_estado text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  ),
  contas_rodada as (                  -- ↪️ D-122
    select l.* from linhas l where l.recurso = 'conta_receber'
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
           'contas',          jsonb_build_object(
              'paginas_busca',   (select count(*) from linhas where recurso = 'cr_pesquisa'),
              'relidas',         (select count(*) from contas_rodada where status = 'ok'),
              'novas',           (select count(*) from contas_rodada where status = 'ok'
                                     and coalesce((params->>'nova')::boolean, false)),
              'pagas',           (select count(*) from contas_rodada where status = 'ok'
                                     and params->>'situacao' = 'pago'
                                     and coalesce(params->>'situacao_antes', '') <> 'pago'),
              'abertas',         (select count(*) from contas_rodada where status = 'ok'
                                     and coalesce(params->>'situacao', '') not in ('pago', 'cancelada')),
              'nao_encontradas', (select count(*) from contas_rodada where status = 'vazio')),
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
$function$;

-- 4 · a janela do pedido no PCP: "conferidas em" = a última busca das contas
CREATE OR REPLACE FUNCTION public.plt_fn_pcp_pedido_detalhe(p_pedido_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_p    public.pedidos%rowtype;
  v_c    public.clientes%rowtype;
  v_card public.plt_cards%rowtype;
  v_ent  public.plt_eventos%rowtype;
  v_prog public.plt_programacoes%rowtype;
  v_sit  text;
  v_tot  integer;
  v_lib  integer;
  v_pro  integer;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'O detalhe do pedido é da logística (PCP/terminais) ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_p from public.pedidos where id = p_pedido_id;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select * into v_c from public.clientes where id = v_p.cliente_id;
  select * into v_card from public.plt_cards where pedido_id = v_p.id and tipo = 'pedido';
  if v_card.entrega_evento_id is not null then
    select * into v_ent from public.plt_eventos where id = v_card.entrega_evento_id;
  end if;
  if v_card.id is not null then
    select * into v_prog from public.plt_programacoes where card_id = v_card.id;
  end if;

  -- A situação na plataforma — a mesma regra de "Todos os pedidos".
  select coalesce(sum(v.unidades), 0)::int into v_tot
    from plt_privado.vw_itens_producao v where v.pedido_id = v_p.id;
  select count(*)::int, count(*) filter (where s.papel_no_fluxo = 'terminal' or u.concluido_em is not null)::int
    into v_lib, v_pro
    from public.plt_cards u
    left join public.plt_setores s on s.id = u.setor_atual_id
   where u.pedido_id = v_p.id and u.tipo = 'unidade' and u.arquivado_em is null;
  v_sit := case
             when v_card.id is null then 'sem_card'
             when v_card.entrega_evento_id is not null then 'entregue'
             when v_card.arquivado_em is not null then 'arquivado'
             when v_card.lancado_rotas_em is not null then 'em_rota'
             when v_tot > 0 and v_pro >= v_tot then 'aguardo'
             when v_lib > 0 then 'producao'
             else 'pcp'
           end;

  return jsonb_build_object(
    'pedido', jsonb_build_object(
      'id', v_p.id, 'numero', v_p.numero, 'situacao', v_p.situacao, 'origem', v_p.origem,
      'data_pedido', v_p.data_pedido, 'data_prevista', v_p.data_prevista,
      'data_faturamento', nullif(v_p.raw ->> 'data_faturamento', ''),
      'data_envio', nullif(v_p.raw ->> 'data_envio', ''),
      'data_entrega_tiny', nullif(v_p.raw ->> 'data_entrega', ''),
      'total_produtos', v_p.total_produtos, 'valor_frete', v_p.valor_frete,
      'valor_desconto', nullif(v_p.raw ->> 'valor_desconto', ''),
      'outras_despesas', nullif(v_p.raw ->> 'outras_despesas', ''),
      'total_pedido', v_p.total_pedido,
      'forma_pagamento', v_p.forma_pagamento, 'meio_pagamento', v_p.meio_pagamento,
      'condicao_pagamento', nullif(v_p.raw ->> 'condicao_pagamento', ''),
      'qtd_parcelas', v_p.qtd_parcelas,
      'parcelas', coalesce((select jsonb_agg(jsonb_build_object(
                     'data', nullif(x -> 'parcela' ->> 'data', ''), 'dias', nullif(x -> 'parcela' ->> 'dias', ''),
                     'valor', nullif(x -> 'parcela' ->> 'valor', ''),
                     'forma', nullif(x -> 'parcela' ->> 'forma_pagamento', ''),
                     'meio', nullif(x -> 'parcela' ->> 'meio_pagamento', ''),
                     'obs', nullif(x -> 'parcela' ->> 'obs', '')) order by o)
                   from jsonb_array_elements(case when jsonb_typeof(v_p.parcelas) = 'array' then v_p.parcelas else '[]'::jsonb end)
                        with ordinality as t(x, o)), '[]'::jsonb),
      'obs', v_p.obs, 'obs_interna', v_p.obs_interna, 'marcadores', to_jsonb(coalesce(v_p.marcadores, '{}'::text[])),
      'vendedor', v_p.vendedor, 'ecommerce', v_p.ecommerce, 'numero_ecommerce', nullif(v_p.raw ->> 'numero_ecommerce', ''),
      'forma_envio', v_p.forma_envio, 'forma_frete', nullif(v_p.raw ->> 'forma_frete', ''),
      'transportador', nullif(v_p.raw ->> 'nome_transportador', ''),
      'codigo_rastreamento', v_p.codigo_rastreamento, 'url_rastreamento', v_p.url_rastreamento,
      'atualizado_em', v_p.atualizado_em),
    'cliente', jsonb_build_object(
      'nome', v_c.nome, 'fone', v_c.fone, 'email', v_c.email, 'documento', v_c.cpf_cnpj,
      'endereco', v_c.endereco, 'numero', v_c.numero, 'complemento', v_c.complemento,
      'bairro', v_c.bairro, 'cidade', v_c.cidade, 'uf', v_c.uf, 'cep', v_c.cep),
    'plataforma', jsonb_build_object(
      'card_id', v_card.id, 'situacao', v_sit, 'total_unidades', v_tot,
      'lancado_rotas_em', v_card.lancado_rotas_em, 'arquivado_em', v_card.arquivado_em,
      'liberado_completo_em', v_card.liberado_completo_em),
    'programacao', case when v_prog.id is null then null else jsonb_build_object(
      'data', v_prog.data_entrega, 'ordem', v_prog.ordem, 'detalhe', v_prog.detalhe,
      'caminhao', (select cam.nome || coalesce(' · ' || cam.placa, '') from public.plt_caminhoes cam where cam.id = v_prog.caminhao_id),
      'equipe', coalesce((select jsonb_agg(u.nome order by u.nome)
                            from public.plt_programacao_equipes eq join public.plt_usuarios u on u.id = eq.usuario_id
                           where eq.data_entrega = v_prog.data_entrega and eq.caminhao_id = v_prog.caminhao_id), '[]'::jsonb)) end,
    'entrega', case when v_ent.id is null then null else jsonb_build_object(
      'em', v_ent.ocorrido_em, 'por', (select u.nome from public.plt_usuarios u where u.id = v_ent.usuario_id),
      'por_gente', v_ent.usuario_id is not null, 'observacao', v_ent.observacao,
      'fonte', coalesce(v_ent.dados ->> 'fonte', case when v_ent.usuario_id is null then 'tiny' else 'plataforma' end)) end,
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
                'seq', i.seq, 'codigo', i.codigo, 'descricao', i.descricao, 'unidade', i.unidade,
                'quantidade', i.quantidade, 'valor_unitario', i.valor_unitario,
                'valor_total', round(coalesce(i.quantidade, 0) * coalesce(i.valor_unitario, 0), 2),
                'unidades_producao', coalesce(v.unidades, 0), 'eh_frete', coalesce(v.eh_frete, false)) order by i.seq)
              from public.pedido_itens i
              left join plt_privado.vw_itens_producao v on v.pedido_id = i.pedido_id and v.seq = i.seq
             where i.pedido_id = v_p.id), '[]'::jsonb),
    'unidades', coalesce((select jsonb_agg(jsonb_build_object(
                'card_id', u.id, 'descricao', u.item_descricao, 'indice', u.indice_unidade, 'total', u.total_unidades,
                'setor', s.nome, 'etapa', e.nome, 'desde', u.desde, 'concluido_em', u.concluido_em,
                'qualidade', u.qualidade_atual, 'arquivado_em', u.arquivado_em,
                'motivo_saida', (select a.dados ->> 'motivo' from public.plt_eventos a
                                  where a.card_id = u.id and a.tipo = 'card_arquivado' order by a.id desc limit 1))
                order by u.item_seq, u.indice_unidade)
              from public.plt_cards u
              left join public.plt_setores s on s.id = u.setor_atual_id
              left join public.plt_etapas e on e.id = u.etapa_atual_id
             where u.tipo = 'unidade' and u.pedido_id = v_p.id), '[]'::jsonb),
    'contas_receber', coalesce((select jsonb_agg(jsonb_build_object(
                'vencimento', cr.data_vencimento, 'valor', cr.valor, 'saldo', cr.saldo, 'situacao', cr.situacao,
                'liquidacao', cr.data_liquidacao, 'forma', cr.forma_recebimento, 'meio', cr.meio_recebimento,
                'historico', cr.historico) order by cr.data_vencimento)
              from public.contas_receber cr where cr.pedido_id = v_p.id), '[]'::jsonb),
    -- ↪️ D-122: "conferidas em" = a última busca das contas no Tiny (a conferência
    -- diária; antes dela, a carga do histórico) — pelo índice da fila (recurso,
    -- chave): a 1ª página da busca, uma linha; só sem ela (antes da 1ª rodada ou
    -- no meio de uma) as poucas linhas da busca — nunca a tabela de contas (Lei §6)
    'contas_receber_ate', coalesce(
       (select f.processado_em from public.tiny_fila f
         where f.recurso = 'cr_pesquisa' and f.chave = 'pente-fino-cr:p1' and f.status = 'ok'),
       (select max(f.processado_em) from public.tiny_fila f
         where f.recurso = 'cr_pesquisa' and f.status = 'ok')),
    'notas_fiscais', coalesce((select jsonb_agg(jsonb_build_object(
                'numero', nf.numero, 'serie', nf.serie, 'emissao', nf.data_emissao,
                'situacao', coalesce(nf.descricao_situacao, nf.situacao), 'valor', nf.valor_nota) order by nf.data_emissao)
              from public.notas_fiscais nf where nf.pedido_id = v_p.id), '[]'::jsonb),
    'anexos', case when v_card.id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object(
                'id', a.id, 'tipo', a.tipo, 'nome', a.nome_arquivo, 'mime', a.mime, 'tamanho', a.tamanho,
                'caminho', a.caminho, 'por', u.nome, 'em', a.enviado_em) order by a.enviado_em desc)
              from public.plt_anexos a left join public.plt_usuarios u on u.id = a.enviado_por
             where a.card_id = v_card.id and a.removido_em is null), '[]'::jsonb) end,
    'historico', case when v_card.id is null then '[]'::jsonb else coalesce((select jsonb_agg(h order by (h ->> 'id')::bigint desc) from (
                select jsonb_build_object(
                  'id', ev.id, 'tipo', ev.tipo, 'em', ev.ocorrido_em, 'por', u.nome, 'origem', ev.origem,
                  'observacao', ev.observacao, 'motivo', ev.dados ->> 'motivo',
                  'setor', (select s.nome from public.plt_setores s where s.id = ev.setor_destino_id)) as h
                  from public.plt_eventos ev
                  left join public.plt_usuarios u on u.id = ev.usuario_id
                 where ev.card_id = v_card.id
                 order by ev.id desc
                 limit 80) z), '[]'::jsonb) end
  );
end;
$function$;
