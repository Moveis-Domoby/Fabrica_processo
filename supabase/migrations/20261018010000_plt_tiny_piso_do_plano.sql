-- ============================================================================
-- SESSAO-33 · migration 93 — O PISO DO PLANO DO TINY E AS RESPOSTAS FINAIS
-- (A-78 — o que a 1ª contagem do Tiny completo achou, 18/10/2026 ~01:50 UTC)
--
-- Nada quebrou, mas 5 perguntas da LOJA tentaram 4 vezes e avisaram no sino:
--   1. O plano do Tiny da LOJA só aceita filtro de data dos últimos 2 anos —
--      código 31: "A data informada no filtro (01/01/2015) está fora do período
--      permitido pelo plano (a partir de 18/10/2024)". Pediam desde 2015 as
--      janelas "antes de 2025" (pedidos, notas e contas a receber) e a busca
--      única das contas a pagar. A FÁBRICA aceitou 2015.
--   2. O aplicativo da API nova da LOJA (o do Comercial) não tem o módulo
--      "Ordem de Compra" — 403. Dar a permissão exigiria reautorizar o
--      aplicativo (mexe no Comercial).
--   A carga começada às 01:57 UTC também pede à loja desde 2015 (a janela
--   "antes" das notas e a das contas a pagar) e o pedido de compra pela API nova.
--
-- A correção:
--   1. O PISO DO PLANO de cada conta (`plt_privado.fn_tiny_piso`): a loja = hoje
--      em Fortaleza − 2 anos + 1 dia de folga (o que o Tiny respondeu às 22h50
--      de 17/10 em Fortaleza: "a partir de 18/10/2024"); a fábrica = 2015 — ela
--      aceitou, e o pedido do dono é TODOS os dados (D-142); se o plano dela
--      mudar, o item 2 encerra a linha sem barulho. As janelas da contagem e da
--      carga começam no piso (a que fica inteira antes dele nem entra), e a
--      linha que esperou na fila de um dia para o outro pede a partir do piso de
--      HOJE: a meia-noite move o piso da loja um dia — `fn_tiny_fila_lote` acerta
--      a data na hora de reservar, e o que se pediu fica gravado na linha (a
--      página seguinte e o "quantos aqui" leem a mesma janela).
--   2. RESPOSTA FINAL, sem nova tentativa nem aviso no sino: o código 31 da v2
--      ("fora do período do plano") e o 403 da API nova ("sem permissão no
--      aplicativo"). A linha encerra (`vazio`, como o "não existe") com o motivo
--      em língua de gente. No painel da carga, a janela que o Tiny não conta sai
--      do "bateu com o Tiny?" (nem zero, nem "contando…" para sempre) e o motivo
--      aparece em "Os últimos erros".
--   3. O pedido de compra pela API nova só na FÁBRICA (contar e carregar).
--   4. O que já está na fila (`plt_privado.fn_tiny_fila_limites_acertar`, roda
--      uma vez aqui; rodar de novo não muda nada): a carga que esbarrou no piso
--      volta para a fila já no piso; as perguntas que desistiram pelo plano ou
--      pela permissão encerram com o motivo; o pedido de compra da loja que
--      ainda esperava a vez sai da fila com o motivo.
--
-- Recriadas a partir do que está no banco (E-24 — o texto de cada uma conferido
-- igual ao do banco em 18/10, antes de mudar), com as MESMAS assinaturas:
-- `fn_tiny_fila_lote`, `fn_tiny_fila_resposta`, `plt_fn_tiny_carga`,
-- `plt_fn_tiny_carga_painel` e `plt_privado.fn_tiny_enfileirar_janelas`
-- (`fn_tiny_janelas` fica igual: não sabe a conta — quem enfileira põe o piso).
-- Nenhuma tabela nem coluna muda; as portas do site publicado devolvem as
-- mesmas chaves (E-73: o banco pode subir antes ou depois do site).
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O piso do plano de cada conta
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_piso(p_conta text)
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  -- a loja: o plano só deixa filtrar data dos últimos 2 anos (código 31); hoje
  -- em Fortaleza − 2 anos + 1 dia (17/10/2026 → 18/10/2024, o que o Tiny disse).
  -- A fábrica aceitou 2015 (o começo da história nas duas contas).
  select case when p_conta = 'loja'
              then ((now() at time zone 'America/Fortaleza')::date - interval '2 years')::date + 1
              else date '2015-01-01' end
$$;

comment on function plt_privado.fn_tiny_piso(text) is
  'SESSAO-33 (migration 93, A-78): a data mais antiga que o plano do Tiny da conta aceita num filtro — loja: hoje em Fortaleza − 2 anos + 1 dia (código 31 "fora do período permitido pelo plano"); fábrica: 01/01/2015 (aceitou). As janelas da contagem e da carga começam aqui.';

-- os filtros de data de uma linha no piso da conta: o início sobe até o piso; a
-- janela que ficou INTEIRA antes do piso fica como está (o Tiny responde 31 e a
-- linha encerra como "fora do período do plano"); data que não é data, idem
create or replace function plt_privado.fn_tiny_params_no_piso(p_conta text, p_params jsonb)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_piso date := plt_privado.fn_tiny_piso(p_conta);
  v      jsonb := coalesce(p_params, '{}'::jsonb);
  c      record;
  v_ini  date;
  v_fim  date;
begin
  for c in select * from (values ('dataInicial', 'dataFinal'),
                                 ('data_ini_emissao', 'data_fim_emissao')) as x(ini, fim) loop
    continue when coalesce(v->>c.ini, '') !~ '^\d{2}/\d{2}/\d{4}$';
    begin
      v_ini := to_date(v->>c.ini, 'DD/MM/YYYY');
      v_fim := case when coalesce(v->>c.fim, '') ~ '^\d{2}/\d{2}/\d{4}$'
                    then to_date(v->>c.fim, 'DD/MM/YYYY') end;
    exception when others then
      continue;
    end;
    if v_ini < v_piso and (v_fim is null or v_fim >= v_piso) then
      v := v || jsonb_build_object(c.ini, to_char(v_piso, 'DD/MM/YYYY'));
    end if;
  end loop;
  return v;
end;
$$;

comment on function plt_privado.fn_tiny_params_no_piso(text, jsonb) is
  'SESSAO-33 (migration 93): os filtros de data da linha (dataInicial · data_ini_emissao) no piso do plano da conta — o início sobe até o piso; a janela inteira antes dele fica como está (o Tiny responde 31 e a linha encerra). Usada na reserva do lote (a meia-noite move o piso da loja) e no acerto da fila.';

-- o motivo da resposta final, em língua de gente (vai para a linha e para o
-- painel — sem código do Tiny no texto: a regra da casa é a tela falar português)
create or replace function plt_privado.fn_tiny_motivo_final(p_caso text, p_conta text, p_recurso text, p_erro text)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select case p_caso
    when 'plano' then
      'fora do período do plano: o Tiny ' || case p_conta when 'fabrica' then 'da fábrica' else 'da loja' end
      || coalesce(' só deixa pedir a partir de ' || substring(coalesce(p_erro, '') from 'a partir de (\d{2}/\d{2}/\d{4})'),
                  ' recusou a data pedida')
    when 'permissao' then
      'sem permissão no aplicativo: o aplicativo da API nova ' || case p_conta when 'fabrica' then 'da fábrica' else 'da loja' end
      || ' não tem acesso a '
      || coalesce((select x.rotulo from plt_privado.fn_tiny_recursos() x where x.recurso = p_recurso), p_recurso)
  end
$$;

comment on function plt_privado.fn_tiny_motivo_final(text, text, text, text) is
  'SESSAO-33 (migration 93): o motivo da resposta final do Tiny em língua de gente — plano ("fora do período do plano: o Tiny da loja só deixa pedir a partir de DD/MM/AAAA", a data tirada da mensagem do Tiny) ou permissao ("sem permissão no aplicativo: o aplicativo da API nova da loja não tem acesso a pedidos de compra").';

-- ----------------------------------------------------------------------------
-- 2 · As janelas no piso da conta (recriada — base: a do banco = migration 90)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_enfileirar_janelas(
  p_conta text, p_recurso text, p_desde date, p_ini text, p_fim text,
  p_marca text, p_rodada text, p_extra jsonb, p_reabrir boolean)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  j      record;
  v_n    integer := 0;
  v_piso date := plt_privado.fn_tiny_piso(p_conta);
begin
  -- migration 93: cada janela começa no piso do plano da conta; a que fica
  -- inteira antes dele não entra (o Tiny da loja recusaria — código 31)
  for j in select x.rotulo, greatest(x.ini, v_piso) as ini, x.fim
             from plt_privado.fn_tiny_janelas(p_desde) x
            where x.fim >= v_piso loop
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

-- ----------------------------------------------------------------------------
-- 3 · O lote: a linha que esperou de um dia para o outro pede a partir do piso
--     de HOJE (recriada — base: a do banco = migration 89)
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
  v_ids     bigint[];
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
  select coalesce(array_agg(rv.id), '{}'::bigint[]) into v_ids from reservados rv;

  -- migration 93: o piso do plano na hora da chamada — a meia-noite move o piso
  -- da loja um dia, e a linha enfileirada ontem pediria um dia antes do que o
  -- Tiny aceita (código 31). A data acertada fica GRAVADA na linha: a página
  -- seguinte e o "quantos aqui" da contagem leem a mesma janela que se pediu.
  update public.tiny_fila t
     set params = plt_privado.fn_tiny_params_no_piso(t.conta, t.params)
   where t.id = any (v_ids)
     and (t.params ? 'dataInicial' or t.params ? 'data_ini_emissao')
     and t.params is distinct from plt_privado.fn_tiny_params_no_piso(t.conta, t.params);

  select coalesce(jsonb_agg(plt_privado.fn_tiny_requisicao(t) order by t.prioridade, t.id), '[]'::jsonb)
    into v_lote
    from public.tiny_fila t
   where t.id = any (v_ids);
  return v_lote;
end;
$$;

comment on function public.fn_tiny_fila_lote(integer) is
  'SESSAO-33: o lote do fluxo novo do n8n — reserva até p_limite linhas prontas (pendentes, sem espera, a fábrica fora das varreduras da madrugada dela) e devolve cada uma com a chamada montada: conta, api (v2 | v3), url ou caminho e os campos. O n8n junta o token da conta (v2) ou chama a ponte (v3) e devolve a resposta crua em fn_tiny_fila_resposta. Migration 93: na reserva, a data de início sobe até o piso do plano da conta (fn_tiny_params_no_piso) e fica gravada na linha.';

-- ----------------------------------------------------------------------------
-- 4 · A resposta: "fora do período do plano" (31) e "sem permissão no
--     aplicativo" (403) são respostas finais (recriada — base: a do banco =
--     migration 89)
-- ----------------------------------------------------------------------------
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
    elsif v_status = 403 then
      -- o aplicativo da conta não tem o módulo (a loja não tem "Ordem de
      -- Compra"): repetir não muda nada — resposta final, sem aviso no sino
      return plt_privado.fn_tiny_fila_falhou(f.id,
        plt_privado.fn_tiny_motivo_final('permissao', f.conta, f.recurso, null), true);
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
      elsif v_cod = '31' then
        -- fora do período do plano (a loja só filtra os últimos 2 anos): repetir
        -- não muda nada — resposta final, sem aviso no sino (migration 93)
        v_erro := plt_privado.fn_tiny_motivo_final('plano', f.conta, f.recurso, v_erro);
        if v_legado then
          return public.fn_backfill_falha(f.id, v_erro, true);
        end if;
        return plt_privado.fn_tiny_fila_falhou(f.id, v_erro, true);
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
  'SESSAO-33: a resposta do Tiny (crua, do n8n) entendida no banco — erro (vazio = não é erro; não existe = encerra; limite = espera sem gastar tentativa; o resto = nova tentativa com espera crescente, e na 4ª o alerta), busca (detalhe de cada registro + próxima página), lista (guarda cada registro), contagem (só a 1ª e a última página) e detalhe (loja: pedidos/clientes/notas/contas a receber pelas rotinas de sempre; fábrica: produtos pelo fn_upsert_produto e a estrutura; o resto em plt_tiny_registros). A conferência das 3h passa pelas mesmas rotinas do fluxo antigo. Migration 93: "fora do período do plano" (código 31 da v2) e "sem permissão no aplicativo" (403 da API nova) encerram a linha com o motivo, sem nova tentativa nem aviso no sino.';

-- ----------------------------------------------------------------------------
-- 5 · A contagem e a carga: as datas no piso de cada conta; o pedido de compra
--     pela API nova só na fábrica (recriada — base: a do banco = migration 90)
-- ----------------------------------------------------------------------------
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
    -- o resto, uma busca só de cada (do piso do plano da conta até hoje — a loja
    -- só deixa pedir os últimos 2 anos; a fábrica, desde 2015)
    foreach c in array array['loja', 'fabrica'] loop
      v_n := v_n + plt_privado.fn_tiny_enfileirar(c, 'cp_pesquisa', 'censo:cp_pesquisa:tudo', 'tudo', 9,
               jsonb_build_object('data_ini_emissao', to_char(plt_privado.fn_tiny_piso(c), 'DD/MM/YYYY'), 'data_fim_emissao', to_char(v_hoje, 'DD/MM/YYYY'),
                                  'pagina', 1, 'janela', 'censo:cp_pesquisa:tudo', 'origem', 'censo', 'censo', v_rodada), true);
      foreach v_rec in array array['contatos_pesquisa', 'produtos_pesquisa', 'vendedores_pesquisa'] loop
        v_n := v_n + plt_privado.fn_tiny_enfileirar(c, v_rec, 'censo:' || v_rec || ':tudo', 'tudo', 9,
                 v_simples || jsonb_build_object('pagina', 1, 'janela', 'censo:' || v_rec || ':tudo',
                                                'origem', 'censo', 'censo', v_rodada), true);
      end loop;
      -- o pedido de compra pela API nova só na fábrica: o aplicativo da loja (o
      -- do Comercial) não tem o módulo — dar a permissão exigiria reautorizá-lo
      if c = 'fabrica' and plt_privado.fn_tiny_api_nova_ligada(c) then
        v_n := v_n + plt_privado.fn_tiny_enfileirar(c, 'v3_ordens_compra', 'censo:v3_ordens_compra:tudo', 'tudo', 9,
                 jsonb_build_object('limit', 1, 'offset', 0, 'janela', 'censo:v3_ordens_compra:tudo',
                                    'origem', 'censo', 'censo', v_rodada), true);
      end if;
    end loop;
    foreach v_rec in array array['pedidos_pesquisa', 'nf_pesquisa'] loop
      v_n := v_n + plt_privado.fn_tiny_enfileirar('fabrica', v_rec, 'censo:' || v_rec || ':tudo', 'tudo', 9,
               jsonb_build_object('dataInicial', to_char(plt_privado.fn_tiny_piso('fabrica'), 'DD/MM/YYYY'), 'dataFinal', to_char(v_hoje, 'DD/MM/YYYY'),
                                  'pagina', 1, 'janela', 'censo:' || v_rec || ':tudo', 'origem', 'censo', 'censo', v_rodada), true);
    end loop;
    v_n := v_n + plt_privado.fn_tiny_enfileirar('fabrica', 'cr_pesquisa', 'censo:cr_pesquisa:tudo', 'tudo', 9,
             jsonb_build_object('data_ini_emissao', to_char(plt_privado.fn_tiny_piso('fabrica'), 'DD/MM/YYYY'), 'data_fim_emissao', to_char(v_hoje, 'DD/MM/YYYY'),
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
               jsonb_build_object('dataInicial', to_char(plt_privado.fn_tiny_piso('fabrica'), 'DD/MM/YYYY'), 'dataFinal', to_char(v_hoje, 'DD/MM/YYYY'), 'pagina', 1,
                                  'janela', 'carga:' || v_rec || ':tudo', 'origem', 'carga', 'carga', v_rodada), true);
    end loop;
    v_n := v_n + plt_privado.fn_tiny_enfileirar('fabrica', 'cr_pesquisa', 'carga:cr_pesquisa:tudo', 'tudo', 9,
             jsonb_build_object('data_ini_emissao', to_char(plt_privado.fn_tiny_piso('fabrica'), 'DD/MM/YYYY'), 'data_fim_emissao', to_char(v_hoje, 'DD/MM/YYYY'), 'pagina', 1,
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
      -- formas de pagamento, marcas e — só na fábrica — pedidos de compra (o
      -- aplicativo da loja não tem o módulo)
      if plt_privado.fn_tiny_api_nova_ligada(c) then
        foreach v_rec in array array['v3_depositos', 'v3_categorias_financeiras', 'v3_formas_pagamento', 'v3_marcas']
                               || case when c = 'fabrica' then array['v3_ordens_compra'] else array[]::text[] end loop
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
  'SESSAO-33 (D-142/D-143): o gesto do dono na Auditoria → Carga do Tiny. contar = pergunta ao Tiny quantos há (1ª e última página de cada busca; a loja mês a mês desde 2025 nos pedidos, notas e contas a receber); carregar = traz tudo o que falta, com a prioridade mais baixa da fila (a venda, a cascata e a conferência passam na frente) — loja: clientes alterados desde 08/09 + os sem cadastro, notas desde 09/2026 + as que algum pedido aponta, catálogo; fábrica: pedidos, notas, contas a receber, contatos, a estrutura de cada fabricado e o estoque de cada produto; as duas: contas a pagar mês a mês desde 2025 + antes, vendedores, formas, listas de preço, categorias, dados da empresa e, com a API nova, depósitos, categorias financeiras, formas de pagamento e marcas (os pedidos de compra só na fábrica) — as listas grandes numa instrução só; pausar/retomar = o interruptor (a fila deixa de pegar a prioridade 9, sem mexer nas linhas — Lei §7). Migration 93: toda data começa no piso do plano da conta (fn_tiny_piso — a loja, os últimos 2 anos). Só o super admin.';

-- ----------------------------------------------------------------------------
-- 6 · O painel: a janela que o Tiny não conta sai do "bateu com o Tiny?" e o
--     motivo aparece nos últimos erros (recriada — base: a do banco = migration 90)
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
  -- (migration 93: a janela que o Tiny não conta — encerrada por "fora do
  -- período do plano" ou "sem permissão no aplicativo" — não entra: nem zero,
  -- nem "contando…" para sempre; o motivo vai para os últimos erros)
  with janelas as (
    select f.conta, f.recurso, f.params->>'janela' as janela, f.referencia as rotulo, f.status, f.params
      from public.tiny_fila f
     where f.params ? 'censo' and f.params->>'censo' = v_ctl.ultima_contagem
       and not coalesce((f.params->>'ultima')::boolean, false)
       and f.status <> 'vazio'
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

  -- os 10 últimos erros — e, junto, o que a contagem mais recente não conseguiu
  -- contar (migration 93: o motivo em língua de gente; cada parte pelo índice
  -- dela — o dos erros e o da contagem)
  select coalesce(jsonb_agg(jsonb_build_object(
           'conta', e.conta, 'recurso', e.recurso,
           'rotulo', (select x.rotulo from plt_privado.fn_tiny_recursos() x where x.recurso = e.recurso),
           'referencia', coalesce(e.referencia, e.chave), 'erro', e.erro, 'quando', e.processado_em)
         order by e.processado_em desc nulls last), '[]'::jsonb)
    into v_erros
    from (select u.*
            from ((select f.conta, f.recurso, f.referencia, f.chave, f.erro, f.processado_em
                     from public.tiny_fila f where f.status = 'erro'
                    order by f.processado_em desc nulls last limit 10)
                  union all
                  (select f.conta, f.recurso, f.referencia, f.chave, f.erro, f.processado_em
                     from public.tiny_fila f
                    where f.params ? 'censo' and f.params->>'censo' = v_ctl.ultima_contagem
                      and f.status = 'vazio'
                    order by f.processado_em desc nulls last limit 10)) u
           order by u.processado_em desc nulls last limit 10) e;

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
  'SESSAO-33: a aba Carga do Tiny da Auditoria numa requisição — a contagem mais recente (quantos no Tiny × quantos aqui, por conta, tipo e janela; a loja mês a mês), o andamento da carga mais recente por tipo, as somas das contas a pagar (Tiny × aqui, mês a mês), a fila agora, os 10 últimos erros, a consulta de hora em hora (ligada? última) e a API nova de cada conta (ligada? renovada quando — nunca o token). Migration 93: a janela que o Tiny não conta (fora do período do plano, sem permissão no aplicativo) sai da comparação e o motivo aparece nos últimos erros. Só o super admin.';

-- ----------------------------------------------------------------------------
-- 7 · O que já está na fila (roda uma vez aqui; rodar de novo não muda nada)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_fila_limites_acertar()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_carga     integer := 0;
  v_plano     integer := 0;
  v_permissao integer := 0;
  v_compras   integer := 0;
begin
  -- (a) a CARGA que esbarrou no piso do plano (desistiu ou espera a nova
  -- tentativa) volta para a fila já no piso — a janela inteira antes dele, não
  -- (os índices: o dos erros e o das que esperam a nova tentativa)
  with alvo as (
    select f.id from public.tiny_fila f
     where f.status = 'erro' and f.params ? 'carga' and f.erro like 'codigo 31:%'
    union
    select f.id from public.tiny_fila f
     where f.status = 'pendente' and f.nao_antes is not null and f.params ? 'carga' and f.erro like 'codigo 31:%'
  )
  update public.tiny_fila f
     set params        = plt_privado.fn_tiny_params_no_piso(f.conta, f.params),
         status        = 'pendente',
         tentativas    = 0,
         erro          = null,
         reservado_em  = null,
         processado_em = null,
         nao_antes     = null
    from alvo a
   where f.id = a.id
     and f.params is distinct from plt_privado.fn_tiny_params_no_piso(f.conta, f.params);
  get diagnostics v_carga = row_count;

  -- (b) o resto que desistiu (ou ainda insiste) pelo plano: resposta final
  with alvo as (
    select f.id from public.tiny_fila f
     where f.status = 'erro' and f.erro like 'codigo 31:%'
    union
    select f.id from public.tiny_fila f
     where f.status = 'pendente' and f.nao_antes is not null and f.erro like 'codigo 31:%'
  )
  update public.tiny_fila f
     set status = 'vazio', nao_antes = null, reservado_em = null,
         processado_em = coalesce(f.processado_em, now()),
         erro = plt_privado.fn_tiny_motivo_final('plano', f.conta, f.recurso, f.erro)
    from alvo a
   where f.id = a.id;
  get diagnostics v_plano = row_count;

  -- (c) o que desistiu (ou ainda insiste) pela permissão do aplicativo (403)
  with alvo as (
    select f.id from public.tiny_fila f
     where f.status = 'erro' and f.erro like 'a API nova respondeu 403%'
    union
    select f.id from public.tiny_fila f
     where f.status = 'pendente' and f.nao_antes is not null and f.erro like 'a API nova respondeu 403%'
  )
  update public.tiny_fila f
     set status = 'vazio', nao_antes = null, reservado_em = null,
         processado_em = coalesce(f.processado_em, now()),
         erro = plt_privado.fn_tiny_motivo_final('permissao', f.conta, f.recurso, f.erro)
    from alvo a
   where f.id = a.id;
  get diagnostics v_permissao = row_count;

  -- (d) o pedido de compra da LOJA que ainda esperava a vez (o aplicativo dela
  -- não tem o módulo — a resposta já se sabe: 403)
  update public.tiny_fila f
     set status = 'vazio', nao_antes = null, reservado_em = null, processado_em = now(),
         erro = plt_privado.fn_tiny_motivo_final('permissao', f.conta, f.recurso, null)
   where f.conta = 'loja' and f.recurso in ('v3_ordens_compra', 'v3_ordem_compra')
     and f.status = 'pendente';
  get diagnostics v_compras = row_count;

  return jsonb_build_object('carga_no_piso', v_carga, 'fora_do_plano', v_plano,
                            'sem_permissao', v_permissao, 'compras_da_loja', v_compras);
end;
$$;

comment on function plt_privado.fn_tiny_fila_limites_acertar() is
  'SESSAO-33 (migration 93): acerta o que já estava na fila antes do piso do plano — a carga que esbarrou no código 31 volta já no piso; o resto que desistiu pelo plano (31) ou pela permissão do aplicativo (403) encerra (vazio) com o motivo em língua de gente; o pedido de compra da loja que esperava a vez sai com o motivo. Rodar de novo não muda nada.';

select plt_privado.fn_tiny_fila_limites_acertar();

-- ----------------------------------------------------------------------------
-- 8 · Permissões (as recriadas mantêm as delas; as novas nascem fechadas)
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_tiny_piso(text) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_params_no_piso(text, jsonb) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_motivo_final(text, text, text, text) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_fila_limites_acertar() from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_enfileirar_janelas(text, text, date, text, text, text, text, jsonb, boolean) from public, anon, authenticated;

revoke all on function public.fn_tiny_fila_lote(integer) from public, anon, authenticated;
revoke all on function public.fn_tiny_fila_resposta(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.plt_fn_tiny_carga(text) from public, anon;
revoke all on function public.plt_fn_tiny_carga_painel() from public, anon;
grant execute on function public.plt_fn_tiny_carga(text) to authenticated;
grant execute on function public.plt_fn_tiny_carga_painel() to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fn_tiny_fila_lote(integer) to service_role;
    grant execute on function public.fn_tiny_fila_resposta(bigint, jsonb) to service_role;
  end if;
end $$;
