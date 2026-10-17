-- ============================================================================
-- SESSAO-33 · migration 90 — O TINY "NA HORA" E A CARGA COMPLETA (D-142, D-143)
--
-- Em cima da fila das duas contas (migration 89):
--
--   1. NA HORA, a partir da venda (o que o Tiny avisa — gatilho blindado em
--      `pedidos`, D-43): pedido gravado → a nota dele, o cliente pelo cadastro
--      (pela busca do CPF/CNPJ — o pedido da v2 não traz o id do contato,
--      A-43/D-98) e as contas a receber (pela nota e pelo pedido) entram na
--      fila e o banco acorda o n8n. Nunca derruba a gravação do pedido.
--   2. Os avisos de NOTA AUTORIZADA e PEDIDO ENVIADO (`plt_fn_tiny_aviso`): o
--      aviso é campainha, não carteiro — grava cru em `eventos` (como o aviso de
--      estoque) e, se trouxer o id de uma nota, a nota entra na fila. O formato
--      real se confere no 1º aviso (F-05). O pedido enviado já chega pelo aviso
--      de venda (o pedido muda de situação) — este só fica registrado.
--   3. O QUE O TINY NÃO AVISA (produtos e clientes alterados) — D-143: uma
--      consulta "o que mudou desde a última vez" por hora, SÓ das 8h às 20h
--      (exceção registrada na Lei de Desempenho §13). Nasce DESLIGADA: liga na
--      Auditoria → Carga do Tiny, depois do fluxo novo importado no n8n.
--   4. A CONTAGEM e a CARGA (`plt_fn_tiny_carga`, gesto do dono na Auditoria):
--      "contar" pergunta ao Tiny quantos há de cada coisa (a 1ª e a última
--      página de cada busca); "carregar" traz tudo, devagar (prioridade mais
--      baixa — a venda, a cascata e a conferência passam na frente) e sem
--      repetir o que já temos e está em dia; "pausar"/"retomar".
--   5. A CONFERÊNCIA "bateu com o Tiny" (`plt_fn_tiny_carga_painel`): quantos
--      no Tiny × quantos aqui, por conta e por tipo (os pedidos, as notas e as
--      contas a receber da loja mês a mês), as somas do que a carga leu, o
--      andamento da fila e os erros.
--
--   6. A conferência da madrugada fecha quando as linhas DELA acabam (a fila
--      agora é dividida com a carga e a cascata).
--
-- Nada muda nas colunas das tabelas da integração; o gatilho novo em `pedidos`
-- entra com o OK do dono (D-143, plano aprovado inteiro).
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Na hora, a partir da venda: a nota, o cliente e as contas do pedido
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_cascata_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nf        text;
  v_nf_antes  text;
  v_cpf       text;
  v_cpf_antes text;
  v_mudou     boolean;
  v_n         integer := 0;
begin
  begin
    -- manutenção que regrava pedidos em massa desliga a cascata na própria sessão
    if coalesce(current_setting('domoby.sem_cascata', true), '') = 'on' then
      return null;
    end if;

    v_nf  := nullif(nullif(regexp_replace(coalesce(new.raw->>'id_nota_fiscal', ''), '\D', '', 'g'), ''), '0');
    v_cpf := nullif(regexp_replace(coalesce(new.raw->'cliente'->>'cpf_cnpj', ''), '\D', '', 'g'), '');
    if tg_op = 'UPDATE' then
      v_nf_antes  := nullif(nullif(regexp_replace(coalesce(old.raw->>'id_nota_fiscal', ''), '\D', '', 'g'), ''), '0');
      v_cpf_antes := nullif(regexp_replace(coalesce(old.raw->'cliente'->>'cpf_cnpj', ''), '\D', '', 'g'), '');
      v_mudou     := new.situacao is distinct from old.situacao;
    else
      v_mudou := true;
    end if;

    -- a nota: nova, trocada, que ainda não temos, ou o pedido mudou de situação
    if v_nf is not null
       and (v_nf is distinct from v_nf_antes or v_mudou
            or not exists (select 1 from public.notas_fiscais n where n.tiny_id = v_nf::bigint)) then
      v_n := v_n + plt_privado.fn_tiny_enfileirar('loja', 'nota_fiscal', v_nf, new.numero::text, 3,
               jsonb_build_object('origem', 'cascata', 'pedido', new.numero), true);
    end if;

    -- as contas a receber: as que a nota gerou e as que o pedido gerou
    if v_nf is not null and (v_nf is distinct from v_nf_antes or v_mudou) then
      v_n := v_n + plt_privado.fn_tiny_enfileirar('loja', 'cr_pesquisa', 'cascata-nf:' || v_nf, new.numero::text, 4,
               jsonb_build_object('id_origem', v_nf, 'pagina', 1, 'janela', 'cascata-nf:' || v_nf,
                                  'origem', 'cascata', 'reabrir', true, 'pedido', new.numero), true);
    end if;
    if new.tiny_id is not null and v_mudou and tg_op = 'UPDATE' then
      v_n := v_n + plt_privado.fn_tiny_enfileirar('loja', 'cr_pesquisa', 'cascata-pedido:' || new.tiny_id, new.numero::text, 4,
               jsonb_build_object('id_origem', new.tiny_id::text, 'pagina', 1, 'janela', 'cascata-pedido:' || new.tiny_id,
                                  'origem', 'cascata', 'reabrir', true, 'pedido', new.numero), true);
    end if;

    -- o cliente pelo cadastro do Tiny (D-98): pedido novo ou o CPF/CNPJ trocou
    if v_cpf is not null and (tg_op = 'INSERT' or v_cpf is distinct from v_cpf_antes) then
      v_n := v_n + plt_privado.fn_tiny_enfileirar('loja', 'contatos_pesquisa', 'cascata-cpf:' || v_cpf, new.numero::text, 4,
               jsonb_build_object('pesquisa', '', 'cpf_cnpj', new.raw->'cliente'->>'cpf_cnpj', 'pagina', 1,
                                  'janela', 'cascata-cpf:' || v_cpf, 'origem', 'cascata', 'reabrir', true,
                                  'pedido', new.numero), true);
    end if;

    if v_n > 0 then
      perform plt_privado.fn_tiny_fila_acordar();
    end if;
  exception when others then
    raise warning 'Tiny (cascata do pedido %): %', new.numero, sqlerrm;
  end;
  return null;
end;
$$;

comment on function plt_privado.fn_tiny_cascata_pedido() is
  'SESSAO-33 (D-142/D-143): o pedido gravado (aviso de venda ou conferência) põe na fila, na hora, a nota dele (nova, trocada, que ainda não temos ou com o pedido mudando de situação), as contas a receber (busca pela origem: a nota e o próprio pedido) e o cliente pelo cadastro (busca pelo CPF/CNPJ — pedido novo ou CPF trocado). Blindado (D-43): erro aqui vira aviso no log, nunca derruba a gravação do pedido. Manutenção em massa desliga com set domoby.sem_cascata = on.';

drop trigger if exists plt_pedidos_tiny_cascata on public.pedidos;
create trigger plt_pedidos_tiny_cascata
  after insert or update of raw, situacao on public.pedidos
  for each row execute function plt_privado.fn_tiny_cascata_pedido();

-- ----------------------------------------------------------------------------
-- 2 · Os avisos de nota autorizada e de pedido enviado (endereço novo no n8n)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tiny_aviso(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cnpj   text := regexp_replace(coalesce(p->>'cnpj', ''), '\D', '', 'g');
  v_conta  text;
  v_tipo   text := lower(coalesce(nullif(trim(p->>'tipo'), ''), ''));
  v_dados  jsonb := case when jsonb_typeof(p->'dados') = 'object' then p->'dados' else '{}'::jsonb end;
  v_nf     text;
  v_evento bigint;
  v_n      integer := 0;
begin
  -- a raiz do CNPJ é a mesma; a matriz (…0001-66) é a fábrica, a filial (…0002-47) é a loja
  v_conta := case v_cnpj when '27556613000166' then 'fabrica'
                         when '27556613000247' then 'loja' end;

  insert into public.eventos (tipo, tiny_id, situacao, payload)
  values ('aviso_tiny',
          nullif(regexp_replace(coalesce(v_dados->>'id', ''), '\D', '', 'g'), '')::bigint,
          nullif(v_tipo, ''),
          p)
  returning id into v_evento;

  -- a nota autorizada: a nota inteira vem pela API (campainha, não carteiro)
  v_nf := coalesce(nullif(v_dados->>'idNotaFiscal', ''), nullif(v_dados->>'id_nota_fiscal', ''),
                   nullif(v_dados->>'idNota', ''), nullif(v_dados->>'id_nota', ''),
                   case when v_tipo ~ '(nota|fiscal|nfe|nf_)' then nullif(v_dados->>'id', '') end);
  v_nf := nullif(nullif(regexp_replace(coalesce(v_nf, ''), '\D', '', 'g'), ''), '0');
  if v_nf is not null and v_conta is not null then
    v_n := plt_privado.fn_tiny_enfileirar(v_conta, 'nota_fiscal', v_nf, coalesce(v_dados->>'numero', v_nf), 3,
             jsonb_build_object('origem', 'aviso', 'evento', v_evento), true);
    if v_n > 0 then
      perform plt_privado.fn_tiny_fila_acordar();
    end if;
  end if;

  return jsonb_build_object('ok', true, 'evento', v_evento, 'conta', v_conta, 'enfileirados', v_n);
end;
$$;

comment on function public.plt_fn_tiny_aviso(jsonb) is
  'SESSAO-33: o endereço dos avisos de NOTA AUTORIZADA e PEDIDO ENVIADO do Tiny (fluxo da fila no n8n). Grava o aviso cru em eventos (tipo aviso_tiny — o formato real se confere no 1º, F-05) e, se ele trouxer o id de uma nota, a nota entra na fila (conta pelo CNPJ: …0001-66 fábrica, …0002-47 loja). O pedido enviado já vem pelo aviso de venda; aqui só fica registrado. Só a chave de serviço chama.';

-- ----------------------------------------------------------------------------
-- 3 · O que o Tiny não avisa: "o que mudou", de hora em hora, das 8h às 20h
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_mudanca_enfileirar(
  p_conta text, p_recurso text, p_campo text, p_formato text, p_extra jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  f       public.tiny_fila;
  v_chave text := 'mudancas:' || p_recurso;
  v_desde timestamptz;
begin
  select * into f from public.tiny_fila t
   where t.conta = p_conta and t.recurso = p_recurso and t.chave = v_chave;
  -- a anterior ainda não terminou: não empilha
  if found and f.status in ('pendente', 'processando') then
    return 0;
  end if;
  -- desde quando: a última que deu certo (com 10 min de folga); se a última
  -- falhou, repete a mesma janela; a primeira olha a última hora
  v_desde := case
    when not found then now() - interval '1 hour'
    when f.status = 'ok' then coalesce((f.params->>'inicio')::timestamptz, now() - interval '1 hour') - interval '10 minutes'
    else coalesce((f.params->>'desde')::timestamptz, now() - interval '1 hour')
  end;
  return plt_privado.fn_tiny_enfileirar(
    p_conta, p_recurso, v_chave, 'o que mudou no Tiny', 3,
    coalesce(p_extra, '{}'::jsonb)
      || jsonb_build_object(p_campo, to_char(v_desde at time zone 'America/Fortaleza', p_formato),
                            'janela', v_chave, 'origem', 'mudancas', 'reabrir', true,
                            'desde', v_desde, 'inicio', now()),
    true);
end;
$$;

create or replace function plt_privado.fn_tiny_mudancas()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hora time := (now() at time zone 'America/Fortaleza')::time;
  v_n    integer := 0;
  c      text;
begin
  -- D-143: só das 8h às 20h (o relógio já é esse; isto protege contra relógio mal posto)
  if v_hora < time '07:55' or v_hora > time '20:30' then
    return jsonb_build_object('fora_do_horario', true);
  end if;
  foreach c in array array['loja', 'fabrica'] loop
    -- clientes (loja) e fornecedores (fábrica) alterados — API v2
    v_n := v_n + plt_privado.fn_tiny_mudanca_enfileirar(c, 'contatos_pesquisa', 'dataMinimaAtualizacao',
                   'DD/MM/YYYY HH24:MI:SS', jsonb_build_object('pesquisa', '', 'pagina', 1));
    -- produtos alterados — só a API nova sabe; só com ela ligada nesta conta
    if plt_privado.fn_tiny_api_nova_ligada(c) then
      v_n := v_n + plt_privado.fn_tiny_mudanca_enfileirar(c, 'v3_produtos_alterados', 'dataAlteracao',
                     'YYYY-MM-DD HH24:MI:SS', '{}'::jsonb);
    end if;
  end loop;
  if v_n > 0 then
    perform plt_privado.fn_tiny_fila_acordar();
  end if;
  return jsonb_build_object('enfileirados', v_n);
end;
$$;

comment on function plt_privado.fn_tiny_mudancas() is
  'SESSAO-33 (D-143 — exceção registrada à Lei §13): de hora em hora, só das 8h às 20h, pergunta ao Tiny o que mudou desde a última vez — contatos (as duas contas, API v2) e produtos (API nova, onde estiver ligada). Uma chamada por tipo quando nada mudou. Relógio plt-tiny-mudancas (17 11-23 * * * UTC = 8:17…20:17 na fábrica), ligado pelo dono na Auditoria.';

create or replace function public.plt_fn_tiny_mudancas_ligar(p_ligar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job   bigint;
  v_feito text := 'sem_pg_cron';
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'Ligar a consulta de hora em hora é gesto do dono.' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_job from cron.job where jobname = 'plt-tiny-mudancas';
    if p_ligar and v_job is null then
      perform cron.schedule('plt-tiny-mudancas', '17 11-23 * * *', 'select plt_privado.fn_tiny_mudancas()');
      v_feito := 'ligada';
    elsif p_ligar then
      v_feito := 'ja_estava';
    elsif v_job is not null then
      perform cron.unschedule(v_job);
      v_feito := 'desligada';
    else
      v_feito := 'ja_estava_desligada';
    end if;
  end if;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (plt_privado.fn_usuario_atual(),
          case when p_ligar then 'tiny_mudancas_ligada' else 'tiny_mudancas_desligada' end,
          jsonb_build_object('resultado', v_feito));
  return jsonb_build_object('resultado', v_feito, 'ligada', p_ligar);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4 · A contagem e a carga (gesto do dono na Auditoria → Carga do Tiny)
-- ----------------------------------------------------------------------------
-- as janelas: tudo antes de p_desde numa só e depois mês a mês até hoje
create or replace function plt_privado.fn_tiny_janelas(p_desde date)
returns table (rotulo text, ini date, fim date)
language sql
stable
set search_path = public, pg_temp
as $$
  select 'antes', date '2015-01-01', p_desde - 1
  union all
  select to_char(m, 'YYYY-MM'), m::date,
         least((m + interval '1 month' - interval '1 day')::date, (now() at time zone 'America/Fortaleza')::date)
    from generate_series(date_trunc('month', p_desde::timestamp),
                         date_trunc('month', now() at time zone 'America/Fortaleza'),
                         interval '1 month') m
$$;

create or replace function plt_privado.fn_tiny_enfileirar_janelas(
  p_conta text, p_recurso text, p_desde date, p_ini text, p_fim text,
  p_marca text, p_rodada text, p_extra jsonb, p_reabrir boolean)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  j   record;
  v_n integer := 0;
begin
  for j in select * from plt_privado.fn_tiny_janelas(p_desde) loop
    v_n := v_n + plt_privado.fn_tiny_enfileirar(
      p_conta, p_recurso, p_marca || ':' || p_recurso || ':' || j.rotulo, j.rotulo, 9,
      coalesce(p_extra, '{}'::jsonb)
        || jsonb_build_object(p_ini, to_char(j.ini, 'DD/MM/YYYY'), p_fim, to_char(j.fim, 'DD/MM/YYYY'),
                              'pagina', 1, 'janela', p_marca || ':' || p_recurso || ':' || j.rotulo,
                              'origem', p_marca, p_marca, p_rodada, 'reabrir', p_reabrir),
      true);
  end loop;
  return v_n;
end;
$$;

create or replace function plt_privado.fn_tiny_api_nova_ligada(p_conta text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.tiny_auth a
                  where a.id = case p_conta when 'fabrica' then 2 else 1 end
                    and a.access_token is not null)
$$;

create or replace function public.plt_fn_tiny_carga(p_acao text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quem   uuid := plt_privado.fn_usuario_atual();
  v_rodada text := to_char(now() at time zone 'America/Fortaleza', 'YYYY-MM-DD"T"HH24:MI:SS');
  v_hoje   date := (now() at time zone 'America/Fortaleza')::date;
  v_n      integer := 0;
  c        text;
  v_rec    text;
  v_simples jsonb := jsonb_build_object('pesquisa', '');
  v_marca  jsonb := jsonb_build_object('origem', 'carga', 'carga', v_rodada);
  v_api_fabrica boolean;
begin
  if v_quem is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'A carga do Tiny é gesto do dono.' using errcode = 'insufficient_privilege';
  end if;

  if p_acao = 'contar' then
    -- a loja, mês a mês (pedidos, notas e contas a receber — o que se compara por mês)
    v_n := v_n + plt_privado.fn_tiny_enfileirar_janelas('loja', 'pedidos_pesquisa', date '2025-01-01', 'dataInicial', 'dataFinal', 'censo', v_rodada, null, true);
    v_n := v_n + plt_privado.fn_tiny_enfileirar_janelas('loja', 'nf_pesquisa', date '2025-01-01', 'dataInicial', 'dataFinal', 'censo', v_rodada, null, true);
    v_n := v_n + plt_privado.fn_tiny_enfileirar_janelas('loja', 'cr_pesquisa', date '2025-01-01', 'data_ini_emissao', 'data_fim_emissao', 'censo', v_rodada, null, true);
    -- o resto, uma busca só de cada (2015 até hoje)
    foreach c in array array['loja', 'fabrica'] loop
      v_n := v_n + plt_privado.fn_tiny_enfileirar(c, 'cp_pesquisa', 'censo:cp_pesquisa:tudo', 'tudo', 9,
               jsonb_build_object('data_ini_emissao', '01/01/2015', 'data_fim_emissao', to_char(v_hoje, 'DD/MM/YYYY'),
                                  'pagina', 1, 'janela', 'censo:cp_pesquisa:tudo', 'origem', 'censo', 'censo', v_rodada), true);
      foreach v_rec in array array['contatos_pesquisa', 'produtos_pesquisa', 'vendedores_pesquisa'] loop
        v_n := v_n + plt_privado.fn_tiny_enfileirar(c, v_rec, 'censo:' || v_rec || ':tudo', 'tudo', 9,
                 v_simples || jsonb_build_object('pagina', 1, 'janela', 'censo:' || v_rec || ':tudo',
                                                'origem', 'censo', 'censo', v_rodada), true);
      end loop;
      if plt_privado.fn_tiny_api_nova_ligada(c) then
        v_n := v_n + plt_privado.fn_tiny_enfileirar(c, 'v3_ordens_compra', 'censo:v3_ordens_compra:tudo', 'tudo', 9,
                 jsonb_build_object('limit', 1, 'offset', 0, 'janela', 'censo:v3_ordens_compra:tudo',
                                    'origem', 'censo', 'censo', v_rodada), true);
      end if;
    end loop;
    foreach v_rec in array array['pedidos_pesquisa', 'nf_pesquisa'] loop
      v_n := v_n + plt_privado.fn_tiny_enfileirar('fabrica', v_rec, 'censo:' || v_rec || ':tudo', 'tudo', 9,
               jsonb_build_object('dataInicial', '01/01/2015', 'dataFinal', to_char(v_hoje, 'DD/MM/YYYY'),
                                  'pagina', 1, 'janela', 'censo:' || v_rec || ':tudo', 'origem', 'censo', 'censo', v_rodada), true);
    end loop;
    v_n := v_n + plt_privado.fn_tiny_enfileirar('fabrica', 'cr_pesquisa', 'censo:cr_pesquisa:tudo', 'tudo', 9,
             jsonb_build_object('data_ini_emissao', '01/01/2015', 'data_fim_emissao', to_char(v_hoje, 'DD/MM/YYYY'),
                                'pagina', 1, 'janela', 'censo:cr_pesquisa:tudo', 'origem', 'censo', 'censo', v_rodada), true);
    -- a rodada nova é a que o painel mostra; contar de novo destrava a pausa
    update public.plt_tiny_controle
       set ultima_contagem = v_rodada, carga_pausada = false, atualizado_em = now()
     where id = 1;

  elsif p_acao = 'carregar' then
    -- (as listas grandes vão numa instrução só — fn_tiny_enfileirar_varios — para
    -- o gesto caber no tempo da requisição com o volume ×100; Lei §7)
    -- LOJA — o que falta (os pedidos e as contas a receber estão completos e
    -- conferidos toda noite; o resto chega agora)
    -- clientes alterados desde a carga do histórico (08/09) — relê os que mudaram
    v_n := v_n + plt_privado.fn_tiny_enfileirar('loja', 'contatos_pesquisa', 'carga:contatos:alterados', 'alterados desde 08/09', 9,
             jsonb_build_object('pesquisa', '', 'dataMinimaAtualizacao', '08/09/2026 00:00:00', 'pagina', 1,
                                'janela', 'carga:contatos:alterados', 'origem', 'carga', 'carga', v_rodada, 'reabrir', true), true);
    -- clientes que nasceram só do pedido (sem o cadastro do Tiny): pelo id do
    -- contato quando há; senão, a busca pelo CPF/CNPJ
    v_n := v_n + plt_privado.fn_tiny_enfileirar_varios((
      select jsonb_agg(jsonb_build_object('conta', 'loja', 'recurso', 'contato',
                                          'chave', c.tiny_id_contato::text, 'prioridade', 9, 'params', v_marca))
        from public.clientes c
       where c.raw is null and c.tiny_id_contato is not null));
    v_n := v_n + plt_privado.fn_tiny_enfileirar_varios((
      select jsonb_agg(jsonb_build_object('conta', 'loja', 'recurso', 'contatos_pesquisa',
                                          'chave', 'carga-cpf:' || d.cpf, 'prioridade', 9,
                                          'params', v_marca || jsonb_build_object(
                                            'pesquisa', '', 'cpf_cnpj', d.cpf_cnpj, 'pagina', 1,
                                            'janela', 'carga-cpf:' || d.cpf, 'reabrir', true)))
        from (select distinct on (regexp_replace(c.cpf_cnpj, '\D', '', 'g'))
                     regexp_replace(c.cpf_cnpj, '\D', '', 'g') as cpf, c.cpf_cnpj
                from public.clientes c
               where c.raw is null and c.tiny_id_contato is null
                 and nullif(regexp_replace(coalesce(c.cpf_cnpj, ''), '\D', '', 'g'), '') is not null) d));
    -- as notas que pararam em 08/09: as de setembro em diante e as que algum pedido aponta
    v_n := v_n + plt_privado.fn_tiny_enfileirar_janelas('loja', 'nf_pesquisa', date '2026-09-01', 'dataInicial', 'dataFinal', 'carga', v_rodada, null, false);
    v_n := v_n + plt_privado.fn_tiny_enfileirar_varios((
      select jsonb_agg(jsonb_build_object('conta', 'loja', 'recurso', 'nota_fiscal',
                                          'chave', x.nf::text, 'prioridade', 9, 'params', v_marca))
        from (select distinct nullif(regexp_replace(coalesce(p.raw->>'id_nota_fiscal', ''), '\D', '', 'g'), '')::bigint as nf
                from public.pedidos p
               where nullif(nullif(regexp_replace(coalesce(p.raw->>'id_nota_fiscal', ''), '\D', '', 'g'), ''), '0') is not null) x
       where not exists (select 1 from public.notas_fiscais n where n.tiny_id = x.nf)));
    -- o catálogo da loja (os móveis vendidos, pelo SKU — a ponte entre as contas, A-22)
    v_n := v_n + plt_privado.fn_tiny_enfileirar('loja', 'produtos_pesquisa', 'carga:produtos:tudo', 'tudo', 9,
             v_simples || jsonb_build_object('pagina', 1, 'janela', 'carga:produtos:tudo', 'origem', 'carga', 'carga', v_rodada), true);

    -- FÁBRICA — tudo o que não temos
    foreach v_rec in array array['pedidos_pesquisa', 'nf_pesquisa'] loop
      v_n := v_n + plt_privado.fn_tiny_enfileirar('fabrica', v_rec, 'carga:' || v_rec || ':tudo', 'tudo', 9,
               jsonb_build_object('dataInicial', '01/01/2015', 'dataFinal', to_char(v_hoje, 'DD/MM/YYYY'), 'pagina', 1,
                                  'janela', 'carga:' || v_rec || ':tudo', 'origem', 'carga', 'carga', v_rodada), true);
    end loop;
    v_n := v_n + plt_privado.fn_tiny_enfileirar('fabrica', 'cr_pesquisa', 'carga:cr_pesquisa:tudo', 'tudo', 9,
             jsonb_build_object('data_ini_emissao', '01/01/2015', 'data_fim_emissao', to_char(v_hoje, 'DD/MM/YYYY'), 'pagina', 1,
                                'janela', 'carga:cr_pesquisa:tudo', 'origem', 'carga', 'carga', v_rodada), true);
    v_n := v_n + plt_privado.fn_tiny_enfileirar('fabrica', 'contatos_pesquisa', 'carga:contatos:tudo', 'tudo', 9,
             v_simples || jsonb_build_object('pagina', 1, 'janela', 'carga:contatos:tudo', 'origem', 'carga', 'carga', v_rodada), true);
    -- a estrutura de cada fabricado (e as etapas, com a API nova) e o estoque
    -- de cada produto, por depósito
    v_api_fabrica := plt_privado.fn_tiny_api_nova_ligada('fabrica');
    v_n := v_n + plt_privado.fn_tiny_enfileirar_varios((
      select jsonb_agg(jsonb_build_object('conta', 'fabrica', 'recurso', r.recurso, 'chave', p.tiny_id::text,
                                          'referencia', p.codigo, 'prioridade', 9, 'params', v_marca))
        from public.produtos p
        cross join lateral (values ('estrutura'), ('v3_producao'), ('estoque')) r(recurso)
       where (r.recurso = 'estoque')
          or (p.classe = 'F' and r.recurso = 'estrutura')
          or (p.classe = 'F' and r.recurso = 'v3_producao' and v_api_fabrica)));

    -- AS DUAS CONTAS — contas a pagar (mês a mês: as somas se conferem por mês)
    -- e os cadastros pequenos
    foreach c in array array['loja', 'fabrica'] loop
      v_n := v_n + plt_privado.fn_tiny_enfileirar_janelas(c, 'cp_pesquisa', date '2025-01-01', 'data_ini_emissao', 'data_fim_emissao', 'carga', v_rodada, null, false);
      v_n := v_n + plt_privado.fn_tiny_enfileirar(c, 'vendedores_pesquisa', 'carga:vendedores', 'tudo', 9,
               v_simples || jsonb_build_object('pagina', 1, 'janela', 'carga:vendedores', 'origem', 'carga', 'carga', v_rodada), true);
      foreach v_rec in array array['formas_recebimento', 'formas_envio', 'listas_precos'] loop
        v_n := v_n + plt_privado.fn_tiny_enfileirar(c, v_rec, 'carga:' || v_rec, 'tudo', 9,
                 jsonb_build_object('pagina', 1, 'janela', 'carga:' || v_rec, 'origem', 'carga', 'carga', v_rodada,
                                    'reabrir', true), true);
      end loop;
      v_n := v_n + plt_privado.fn_tiny_enfileirar(c, 'categorias_produto', 'arvore', 'categorias', 9,
               jsonb_build_object('origem', 'carga', 'carga', v_rodada), true);
      v_n := v_n + plt_privado.fn_tiny_enfileirar(c, 'info', 'empresa', 'dados da empresa', 9,
               jsonb_build_object('origem', 'carga', 'carga', v_rodada), true);
      -- a API nova (onde estiver ligada): depósitos, categorias financeiras,
      -- formas de pagamento, marcas e pedidos de compra
      if plt_privado.fn_tiny_api_nova_ligada(c) then
        foreach v_rec in array array['v3_depositos', 'v3_categorias_financeiras', 'v3_formas_pagamento', 'v3_marcas', 'v3_ordens_compra'] loop
          v_n := v_n + plt_privado.fn_tiny_enfileirar(c, v_rec, 'carga:' || v_rec, 'tudo', 9,
                   jsonb_build_object('janela', 'carga:' || v_rec, 'origem', 'carga', 'carga', v_rodada), true);
        end loop;
      end if;
    end loop;

    update public.plt_tiny_controle
       set ultima_carga = v_rodada, carga_pausada = false, atualizado_em = now()
     where id = 1;

  elsif p_acao in ('pausar', 'retomar') then
    -- o interruptor (Lei §7 — sem mexer em linha nenhuma da fila): pausada, a
    -- fila não pega a prioridade 9 (a contagem e a carga); o que a venda, a
    -- cascata e a conferência da madrugada pedem continua passando
    update public.plt_tiny_controle
       set carga_pausada = (p_acao = 'pausar'), atualizado_em = now()
     where id = 1 and carga_pausada is distinct from (p_acao = 'pausar');
    get diagnostics v_n = row_count;
  else
    raise exception 'Ação desconhecida: %', p_acao using errcode = 'invalid_parameter_value';
  end if;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_quem, 'tiny_carga', jsonb_build_object('acao', p_acao, 'rodada', v_rodada, 'linhas', v_n));

  if p_acao in ('contar', 'carregar', 'retomar') and v_n > 0 then
    perform plt_privado.fn_tiny_fila_acordar();
  end if;
  return jsonb_build_object('acao', p_acao, 'rodada', v_rodada, 'linhas', v_n,
                            'pausada', (select c.carga_pausada from public.plt_tiny_controle c where c.id = 1));
end;
$$;

comment on function public.plt_fn_tiny_carga(text) is
  'SESSAO-33 (D-142/D-143): o gesto do dono na Auditoria → Carga do Tiny. contar = pergunta ao Tiny quantos há (1ª e última página de cada busca; a loja mês a mês desde 2025 nos pedidos, notas e contas a receber); carregar = traz tudo o que falta, com a prioridade mais baixa da fila (a venda, a cascata e a conferência passam na frente) — loja: clientes alterados desde 08/09 + os sem cadastro, notas desde 09/2026 + as que algum pedido aponta, catálogo; fábrica: pedidos, notas, contas a receber, contatos, a estrutura de cada fabricado e o estoque de cada produto; as duas: contas a pagar mês a mês desde 2025 + antes, vendedores, formas, listas de preço, categorias, dados da empresa e, com a API nova, depósitos, categorias financeiras, formas de pagamento, marcas e pedidos de compra — as listas grandes numa instrução só; pausar/retomar = o interruptor (a fila deixa de pegar a prioridade 9, sem mexer nas linhas — Lei §7). Só o super admin.';

-- ----------------------------------------------------------------------------
-- 5 · A conferência: bateu com o Tiny? (uma requisição — a aba da Auditoria)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tiny_carga_painel()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
-- Lei §6 (ensaio ×100): o painel só LÊ o que já está pronto — a contagem traz o
-- "quantos aqui" de quando chegou; o andamento da carga vem das contas mantidas
-- pelos gatilhos da fila; as somas das contas a pagar, do resumo do mês; os
-- números da fila agora param em 10 mil (a tela mostra "mais de 10 mil").
declare
  v_ctl    public.plt_tiny_controle;
  v_teto   smallint := plt_privado.fn_tiny_fila_teto();
  v_linhas jsonb;
  v_carga_resumo jsonb;
  v_somas  jsonb;
  v_fila   jsonb;
  v_erros  jsonb;
  v_mud    jsonb;
  v_api    jsonb;
  v_ligada boolean;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'A carga do Tiny é do super admin.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_ctl from public.plt_tiny_controle c where c.id = 1;

  -- quantos no Tiny × quantos aqui, por janela da contagem mais recente
  with janelas as (
    select f.conta, f.recurso, f.params->>'janela' as janela, f.referencia as rotulo, f.status, f.params
      from public.tiny_fila f
     where f.params ? 'censo' and f.params->>'censo' = v_ctl.ultima_contagem
       and not coalesce((f.params->>'ultima')::boolean, false)
  ), ultimas as (
    select f.conta, f.recurso, f.params->>'janela' as janela, f.status, (f.params->>'registros')::integer as registros
      from public.tiny_fila f
     where f.params ? 'censo' and f.params->>'censo' = v_ctl.ultima_contagem
       and coalesce((f.params->>'ultima')::boolean, false)
  ), contas as (
    select j.*,
           case
             when j.status <> 'ok' then null
             when j.params ? 'total' and j.params->>'total' is not null then (j.params->>'total')::integer
             when coalesce((j.params->>'numero_paginas')::integer, 1) <= 1 then (j.params->>'registros')::integer
             when u.status = 'ok' then ((j.params->>'numero_paginas')::integer - 1) * 100 + u.registros
           end as tiny,
           coalesce(to_date(coalesce(j.params->>'dataInicial', j.params->>'data_ini_emissao'), 'DD/MM/YYYY'), date '2015-01-01') as ini
      from janelas j
      left join ultimas u on u.conta = j.conta and u.recurso = j.recurso and u.janela = j.janela
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'conta', c.conta, 'recurso', c.recurso,
           'rotulo', (select x.rotulo from plt_privado.fn_tiny_recursos() x where x.recurso = c.recurso),
           'janela', c.rotulo, 'tiny', c.tiny,
           'aqui', (c.params->>'aqui')::bigint,
           'lido', c.status = 'ok')
         order by c.conta, c.recurso, c.ini), '[]'::jsonb)
    into v_linhas
    from contas c;

  -- o andamento da carga mais recente, por tipo de dado (as contas prontas)
  select coalesce(jsonb_agg(jsonb_build_object(
           'conta', g.conta, 'recurso', g.recurso,
           'rotulo', (select x.rotulo from plt_privado.fn_tiny_recursos() x where x.recurso = g.recurso),
           'pendentes', g.pendentes, 'em_andamento', g.em_andamento, 'lidos', g.lidos,
           'nao_existem', g.vazios, 'erros', g.erros)
         order by g.conta, g.recurso), '[]'::jsonb)
    into v_carga_resumo
    from (select c.conta, c.recurso,
                 coalesce(sum(c.n) filter (where c.status = 'pendente'), 0) as pendentes,
                 coalesce(sum(c.n) filter (where c.status = 'processando'), 0) as em_andamento,
                 coalesce(sum(c.n) filter (where c.status = 'ok'), 0) as lidos,
                 coalesce(sum(c.n) filter (where c.status = 'vazio'), 0) as vazios,
                 coalesce(sum(c.n) filter (where c.status = 'erro'), 0) as erros
            from public.plt_tiny_carga_contagem c
           where c.rodada = v_ctl.ultima_carga
           group by c.conta, c.recurso) g;

  -- as somas das contas a pagar, mês a mês: no Tiny (as páginas que a carga
  -- leu) × aqui (o resumo do mês dos registros guardados)
  with paginas as (
    select f.conta, regexp_replace(f.params->>'janela', ':p[0-9]+$', '') as janela,
           max(f.referencia) as rotulo,
           to_date(max(f.params->>'data_ini_emissao'), 'DD/MM/YYYY') as ini,
           to_date(max(f.params->>'data_fim_emissao'), 'DD/MM/YYYY') as fim,
           sum((f.params->>'soma')::numeric) as tiny,
           bool_and(f.status = 'ok') as lido
      from public.tiny_fila f
     where f.recurso = 'cp_pesquisa' and f.params ? 'carga' and f.params->>'carga' = v_ctl.ultima_carga
     group by 1, 2
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'conta', p.conta, 'recurso', 'cp_pesquisa', 'janela', p.rotulo, 'tiny', p.tiny, 'lido', p.lido,
           'aqui', (select coalesce(sum(m.soma), 0) from public.plt_tiny_registros_mes m
                     where m.conta = p.conta and m.tipo = 'conta_pagar'
                       and m.mes between date_trunc('month', p.ini)::date and p.fim))
         order by p.conta, p.ini nulls first), '[]'::jsonb)
    into v_somas
    from paginas p;

  -- a fila agora (cada número para em 10 mil — o índice não varre o resto)
  -- (conta a conta, na ordem do índice: com a carga pausada, a contagem do que
  -- passa para no fim da prioridade 8)
  v_fila := jsonb_build_object(
    'pendentes', least(10000,
                   (select count(*) from (select 1 from public.tiny_fila f
                      where f.conta = 'loja' and f.status = 'pendente' and f.prioridade <= v_teto
                        and (f.nao_antes is null or f.nao_antes <= now())
                      order by f.prioridade, f.id limit 10000) x)
                 + (select count(*) from (select 1 from public.tiny_fila f
                      where f.conta = 'fabrica' and f.status = 'pendente' and f.prioridade <= v_teto
                        and (f.nao_antes is null or f.nao_antes <= now())
                      order by f.prioridade, f.id limit 10000) x)),
    'esperando', (select count(*) from (select 1 from public.tiny_fila f
                    where f.status = 'pendente' and f.nao_antes is not null and f.nao_antes > now()
                      and f.prioridade <= v_teto limit 10000) x),
    'pausados', case when v_ctl.carga_pausada
                     then least(10000,
                            (select count(*) from (select 1 from public.tiny_fila f
                               where f.conta = 'loja' and f.status = 'pendente' and f.prioridade = 9
                               order by f.prioridade, f.id limit 10000) x)
                          + (select count(*) from (select 1 from public.tiny_fila f
                               where f.conta = 'fabrica' and f.status = 'pendente' and f.prioridade = 9
                               order by f.prioridade, f.id limit 10000) x))
                     else 0 end,
    'em_andamento', (select count(*) from public.tiny_fila f where f.status = 'processando'),
    'erros', (select count(*) from (select 1 from public.tiny_fila f where f.status = 'erro' limit 10000) x),
    'teto', 10000);

  select coalesce(jsonb_agg(jsonb_build_object(
           'conta', e.conta, 'recurso', e.recurso,
           'rotulo', (select x.rotulo from plt_privado.fn_tiny_recursos() x where x.recurso = e.recurso),
           'referencia', coalesce(e.referencia, e.chave), 'erro', e.erro, 'quando', e.processado_em)
         order by e.processado_em desc nulls last), '[]'::jsonb)
    into v_erros
    from (select * from public.tiny_fila f where f.status = 'erro'
           order by f.processado_em desc nulls last limit 10) e;

  -- (o relógio só é lido se o agendador existe — sem ele, a consulta nem compila)
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select exists (select 1 from cron.job where jobname = 'plt-tiny-mudancas') into v_ligada;
  end if;
  v_mud := jsonb_build_object(
    'ligada', v_ligada,
    'ultima', (select max(f.processado_em) from public.tiny_fila f
                where f.status = 'ok'
                  and (f.conta, f.recurso, f.chave) in (
                        ('loja', 'contatos_pesquisa', 'mudancas:contatos_pesquisa'),
                        ('fabrica', 'contatos_pesquisa', 'mudancas:contatos_pesquisa'),
                        ('loja', 'v3_produtos_alterados', 'mudancas:v3_produtos_alterados'),
                        ('fabrica', 'v3_produtos_alterados', 'mudancas:v3_produtos_alterados'))));

  v_api := jsonb_build_object(
    'loja',    jsonb_build_object('ligada', plt_privado.fn_tiny_api_nova_ligada('loja'),
                                  'renovada_em', (select a.updated_at from public.tiny_auth a where a.id = 1)),
    'fabrica', jsonb_build_object('ligada', plt_privado.fn_tiny_api_nova_ligada('fabrica'),
                                  'renovada_em', (select a.updated_at from public.tiny_auth a where a.id = 2)));

  return jsonb_build_object(
    'censo',    jsonb_build_object('rodada', v_ctl.ultima_contagem, 'linhas', v_linhas),
    'carga',    jsonb_build_object('rodada', v_ctl.ultima_carga, 'por_recurso', v_carga_resumo, 'somas', v_somas),
    'pausada',  coalesce(v_ctl.carga_pausada, false),
    'fila',     v_fila,
    'erros',    v_erros,
    'mudancas', v_mud,
    'api_nova', v_api);
end;
$$;

comment on function public.plt_fn_tiny_carga_painel() is
  'SESSAO-33: a aba Carga do Tiny da Auditoria numa requisição — a contagem mais recente (quantos no Tiny × quantos aqui, por conta, tipo e janela; a loja mês a mês), o andamento da carga mais recente por tipo, as somas das contas a pagar (Tiny × aqui, mês a mês), a fila agora, os 10 últimos erros, a consulta de hora em hora (ligada? última) e a API nova de cada conta (ligada? renovada quando — nunca o token). Só o super admin.';

-- ----------------------------------------------------------------------------
-- 6 · A conferência da madrugada fecha quando as linhas DELA acabam
-- ----------------------------------------------------------------------------
-- A fila agora é dividida (a carga, a cascata, a consulta de hora em hora). O
-- resumo da rodada (e o veredito dos pedidos excluídos — D-140) não espera a
-- fila inteira esvaziar: fecha quando não sobra linha DA RODADA por ler. O
-- relógio da fila segue o mesmo: chama o n8n enquanto há trabalho e se
-- desagenda com a fila vazia.
create index if not exists tiny_fila_rodada_idx on public.tiny_fila ((params->>'rodada')) where params ? 'rodada';

create or replace function plt_privado.fn_tiny_fila_relogio()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

  -- a rodada aberta ganha o resumo quando as linhas dela acabaram
  select f.params into v_busca from public.tiny_fila f
   where f.conta = 'loja' and f.recurso = 'pedidos_pesquisa' and f.chave = 'pente-fino:p1';
  if v_busca->>'rodada' is not null and v_busca->>'resumo_em' is null
     and not exists (select 1 from public.tiny_fila x
                      where x.params->>'rodada' = v_busca->>'rodada'
                        and (x.status = 'processando' or (x.status = 'pendente' and x.tentativas < 4))) then
    v_resumo := plt_privado.fn_tiny_pente_fino_resumir(v_busca->>'rodada', 'concluida');
  end if;

  -- há o que pegar agora: chama o n8n
  if plt_privado.fn_tiny_fila_precisa_chamar() then
    begin
      v_chamada := plt_privado.fn_tiny_fila_chamar_n8n();
    exception when others then
      v_chamada := 'erro: ' || left(sqlerrm, 200);
    end;
    return jsonb_build_object('n8n', v_chamada, 'fila', 'com_trabalho', 'resumo', v_resumo is not null);
  end if;
  -- nada para pegar agora, mas ainda há o que esperar (uma nova tentativa
  -- marcada, o lote em andamento, a fábrica na madrugada dela): o relógio fica,
  -- sem chamar ninguém. A carga pausada NÃO segura o relógio — "Retomar" acorda.
  -- (tudo pelos índices: as que esperam são poucas — Lei §7.2)
  if exists (select 1 from public.tiny_fila f
              where f.status = 'pendente' and f.nao_antes is not null and f.nao_antes > now()
                and f.tentativas < 4 and f.prioridade <= plt_privado.fn_tiny_fila_teto())
     or exists (select 1 from public.tiny_fila f where f.status = 'processando')
     or (plt_privado.fn_tiny_fabrica_em_varredura()
         and exists (select 1 from (select f.id from public.tiny_fila f
                                     where f.conta = 'fabrica' and f.status = 'pendente'
                                       and f.prioridade <= plt_privado.fn_tiny_fila_teto() and f.tentativas < 4
                                     order by f.prioridade, f.id
                                     limit 1) x)) then
    return jsonb_build_object('n8n', 'nada_a_fazer', 'fila', 'com_trabalho', 'resumo', v_resumo is not null);
  end if;

  -- nada na fila: o relógio se desliga
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_job from cron.job where jobname = 'plt-tiny-fila';
    if v_job is not null then
      perform cron.unschedule(v_job);
    end if;
  end if;
  return jsonb_build_object('n8n', 'nada_a_fazer', 'fila', 'vazia',
                            'resumo', v_resumo is not null, 'relogio', 'desligado');
end;
$function$;

-- a chamada ao n8n (migration 49), com o número de pendentes que vai junto
-- parando em mil — antes contava a fila inteira a cada chamada (Lei §7.2)
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
  select count(*) into v_pendentes
    from (select 1 from public.tiny_fila f where f.status = 'pendente' limit 1000) x;
  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('motivo', 'fila_do_tiny', 'pendentes', v_pendentes, 'em', now()),
    headers := jsonb_build_object('Content-Type', 'application/json'));
  return 'chamado';
end;
$$;

-- ----------------------------------------------------------------------------
-- 7 · Permissões
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_tiny_cascata_pedido() from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_mudanca_enfileirar(text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_mudancas() from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_janelas(date) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_enfileirar_janelas(text, text, date, text, text, text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_api_nova_ligada(text) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_fila_relogio() from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_fila_chamar_n8n() from public, anon, authenticated;

revoke all on function public.plt_fn_tiny_aviso(jsonb) from public, anon, authenticated;
revoke all on function public.plt_fn_tiny_mudancas_ligar(boolean) from public, anon;
revoke all on function public.plt_fn_tiny_carga(text) from public, anon;
revoke all on function public.plt_fn_tiny_carga_painel() from public, anon;
grant execute on function public.plt_fn_tiny_mudancas_ligar(boolean) to authenticated;
grant execute on function public.plt_fn_tiny_carga(text) to authenticated;
grant execute on function public.plt_fn_tiny_carga_painel() to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.plt_fn_tiny_aviso(jsonb) to service_role;
  end if;
end $$;
