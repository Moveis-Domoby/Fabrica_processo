-- ============================================================================
-- SESSAO-33 (frente de 21/10) · migration 107 — O QUE O TINY NÃO AVISA FICA EM
-- DIA PELA CONFERÊNCIA DA MADRUGADA; O QUE FOI APAGADO NO TINY É MARCADO; O
-- PRODUTO APAGADO SOME DE TODAS AS TELAS (D-148 — dono, 21/10/2026: "Pode
-- seguir com o plano. Os produtos apagados no Tiny somem de todas as telas,
-- como o pedido apagado.")
--
-- A recontagem de 21/10 mostrou que ficam no retrato da carga os dados que o
-- Tiny não avisa nem entram na consulta de hora em hora — os registros próprios
-- da FÁBRICA (pedidos, notas, contas a receber, pedidos de compra) e as contas a
-- pagar das DUAS contas — e que o que foi apagado no Tiny segue aqui (108
-- produtos e 89 contas a pagar da fábrica). O Tiny só diz "o que mudou desde"
-- em pedidos, contatos e produtos (API nova); o resto só relendo a lista.
--
--   1. SEM RELÓGIO NOVO (Lei §4): a conferência da madrugada que já existe (a
--      das 3h, `fn_tiny_pente_fino_iniciar`) chama `fn_tiny_conferencia_iniciar`
--      — a lista COMPLETA de cada tipo, do piso do plano da conta até hoje
--      (fábrica: pedidos, notas, contas a receber, pedidos de compra, o
--      catálogo; as duas contas: as contas a pagar, mês a mês — as somas do
--      painel conferem por mês). Prioridade 8: atrás de tudo o que funciona,
--      fora do interruptor da carga.
--   2. SÓ RELÊ O QUE MUDOU: cada item da lista tem o hash comparado ao guardado
--      (`plt_tiny_registros.resumo_hash`); novo, diferente ou sumido → detalhe;
--      igual → nada. A primeira rodada relê todos (o resumo ainda não existe).
--   3. O QUE SUMIU: a última página de uma janela (a cadeia de páginas é
--      sequencial — chegar nela = todas as anteriores lidas) fecha a janela em
--      `fn_tiny_conferencia_fechar`: o que temos (não sumido, com a data dentro
--      da janela) e a lista não trouxe → um detalhe de confirmação cada. "Não
--      localizado" (v2 32) ou 404 (API nova) → o registro fica "sumido: apagado"
--      (`sumiu_em`/`sumiu_motivo` — nada se apaga); o Tiny tem mas a lista não
--      mostra → "sumido: fora da lista". Visto de novo na lista → volta
--      sozinho. TRAVA: lista com menos da metade do guardado (com 20 ou mais)
--      não marca nada e avisa o dono no sino.
--   4. O PRODUTO APAGADO NO TINY (`plt_produtos_excluidos_tiny` — a marcação é
--      uma só, como a do pedido, D-140/A-71): sai do Estoque, das Configurações
--      (móveis, insumos e peças; unidades fora do padrão; estrutura), da busca
--      de vínculo, das fotos do Tiny e do estoque com o Tiny (a fila dele sai e
--      ele não entra mais nela). Fica guardado; volta se reaparecer no Tiny.
--      Com cartão vivo, os admins são avisados (as peças podem existir).
--   5. O "quantos aqui" e o resumo do mês contam só o que não sumiu; o painel
--      confere as somas das contas a pagar com a leitura MAIS RECENTE (a
--      conferência, quando é mais nova que a carga) — as mesmas chaves (E-73).
--   6. A RENOVAÇÃO do acesso da API nova da fábrica: a vez mínima cai de 2 h
--      para 30 min — com o relógio de 3 em 3 h o acesso não passa de 3h30 de
--      idade (vale 4 h) depois de uma autorização (E-116).
--
-- Na aplicação, `fn_tiny_conferencia_acertar` (de novo = zeros): a data de cada
-- registro e os produtos que o Tiny já disse que não existem (a leitura do
-- estoque da carga de 18/10 — os 108).
--
-- Funções recriadas a partir do banco (pg_get_functiondef, md5 do corpo
-- conferido — E-24/A-79), cada uma só com a troca marcada "migration 107".
-- Tabelas da INTEGRAÇÃO: nenhuma coluna muda (só o índice novo da `tiny_fila`,
-- com o OK do plano — D-148).
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Onde mora o que sumiu e o resumo da lista
-- ----------------------------------------------------------------------------
alter table public.plt_tiny_registros add column if not exists resumo_hash  text;
alter table public.plt_tiny_registros add column if not exists data         date;
alter table public.plt_tiny_registros add column if not exists sumiu_em     timestamptz;
alter table public.plt_tiny_registros add column if not exists sumiu_motivo text;

comment on column public.plt_tiny_registros.resumo_hash is
  'Migration 107 (D-148): o md5 do item como a LISTA do Tiny o mostrou na última conferência da madrugada — amanhã o detalhe só é relido se o item da lista mudar.';
comment on column public.plt_tiny_registros.data is
  'Migration 107 (D-148): a data do registro (emissão das contas e notas; data do pedido) — as janelas da conferência acham o que sumiu pela data. Nula nos tipos sem data.';
comment on column public.plt_tiny_registros.sumiu_em is
  'Migration 107 (D-148): quando o registro saiu da lista do Tiny (nada se apaga). Nulo = está no Tiny. Visto de novo na lista → volta a nulo sozinho. Os sumidos não contam no "quantos aqui" nem no resumo do mês.';
comment on column public.plt_tiny_registros.sumiu_motivo is
  'Migration 107 (D-148): apagado (o Tiny respondeu "não localizado"/404) · fora_da_lista (o Tiny tem, mas a lista dele não mostra — cancelado, por exemplo).';

create index if not exists plt_tiny_registros_data_idx
  on public.plt_tiny_registros (conta, tipo, data) where sumiu_em is null;

alter table public.plt_tiny_controle add column if not exists ultima_conferencia text;
comment on column public.plt_tiny_controle.ultima_conferencia is
  'Migration 107 (D-148): a rodada mais recente da conferência dos registros (a da madrugada) — o painel confere as somas das contas a pagar com ela quando é mais nova que a carga.';

-- as linhas de uma rodada da conferência (fechar a janela, o painel)
create index if not exists tiny_fila_conferencia_idx
  on public.tiny_fila ((params->>'conferencia')) where params ? 'conferencia';

create table if not exists public.plt_produtos_excluidos_tiny (
  tiny_id      bigint primary key references public.produtos(tiny_id) on delete cascade,
  codigo       text,
  descricao    text,
  erro         text,
  detectado_em timestamptz not null default now(),
  conferido_em timestamptz not null default now()
);

comment on table public.plt_produtos_excluidos_tiny is
  'Migration 107 (D-148 — "os produtos apagados no Tiny somem de todas as telas, como o pedido apagado"): o produto da FÁBRICA que o Tiny diz que não existe mais (produto.obter/estoque "não localizado"). A marcação é uma só (A-71): as telas e o estoque com o Tiny leem daqui; o produto fica guardado em produtos. Visto de novo na lista do Tiny → sai daqui sozinho.';

alter table public.plt_produtos_excluidos_tiny enable row level security;
revoke all on public.plt_produtos_excluidos_tiny from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · As peças pequenas: a data, o sumir, o produto apagado e o que voltou
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_registro_data(p_tipo text, p_raw jsonb)
returns date
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v text := case p_tipo
              when 'conta_pagar'   then p_raw->>'data'
              when 'conta_receber' then p_raw->>'data'
              when 'nota_fiscal'   then p_raw->>'data_emissao'
              when 'pedido'        then p_raw->>'data_pedido'
            end;
begin
  if coalesce(v, '') !~ '^\d{2}/\d{2}/\d{4}$' then
    return null;
  end if;
  begin
    return to_date(v, 'DD/MM/YYYY');
  exception when others then
    return null;                                  -- data que não é data (31/02) não entra
  end;
end;
$$;

comment on function plt_privado.fn_tiny_registro_data(text, jsonb) is
  'Migration 107 (D-148): a data de um registro do Tiny pelo tipo — contas a pagar e a receber: data (emissão); nota fiscal: data_emissao; pedido: data_pedido. Nula nos outros tipos e na data que não é data.';

-- o registro saiu da lista do Tiny: marca (nunca apaga) e tira do resumo do mês
create or replace function plt_privado.fn_tiny_registro_sumir(
  p_conta text, p_tipo text, p_chave text, p_motivo text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_velho public.plt_tiny_registros;
begin
  select * into v_velho from public.plt_tiny_registros t
   where t.conta = p_conta and t.tipo = p_tipo and t.chave = p_chave
     for update;
  if not found or (v_velho.sumiu_em is not null and v_velho.sumiu_motivo is not distinct from p_motivo) then
    return false;
  end if;
  update public.plt_tiny_registros t
     set sumiu_em = coalesce(t.sumiu_em, now()), sumiu_motivo = p_motivo
   where t.conta = p_conta and t.tipo = p_tipo and t.chave = p_chave;
  -- a conta a pagar sai do resumo do mês (o Tiny não a conta mais)
  if v_velho.sumiu_em is null and p_tipo = 'conta_pagar' then
    perform plt_privado.fn_tiny_registros_mes_somar(p_conta, p_tipo, v_velho.raw, -1);
  end if;
  return v_velho.sumiu_em is null;
end;
$$;

comment on function plt_privado.fn_tiny_registro_sumir(text, text, text, text) is
  'Migration 107 (D-148): marca o registro como sumido do Tiny (apagado | fora_da_lista) — nada se apaga; a conta a pagar sai do resumo do mês. Devolve true só quando acabou de sumir. Volta pelo fn_tiny_registrar (o Tiny mandou de novo).';

-- o produto da fábrica que o Tiny diz que não existe mais (D-148)
create or replace function plt_privado.fn_tiny_produto_excluir(p_tiny_id bigint, p_erro text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nome  text;
  v_cards integer;
begin
  if p_tiny_id is null or not exists (select 1 from public.produtos p where p.tiny_id = p_tiny_id) then
    return false;
  end if;
  if exists (select 1 from public.plt_produtos_excluidos_tiny x where x.tiny_id = p_tiny_id) then
    update public.plt_produtos_excluidos_tiny set conferido_em = now() where tiny_id = p_tiny_id;
    return false;
  end if;

  insert into public.plt_produtos_excluidos_tiny (tiny_id, codigo, descricao, erro)
  select p.tiny_id, p.codigo, p.descricao, left(coalesce(p_erro, ''), 300)
    from public.produtos p where p.tiny_id = p_tiny_id;
  select coalesce(nullif(btrim(p.codigo), '') || ' · ', '') || coalesce(nullif(btrim(p.descricao), ''), 'sem nome')
    into v_nome from public.produtos p where p.tiny_id = p_tiny_id;

  -- a plataforma para de perguntar ao Tiny por ele (o estoque com o Tiny)
  delete from public.plt_tiny_estoque_fila q where q.produto_tiny_id = p_tiny_id;

  -- com cartão vivo, os admins ficam sabendo (as peças podem existir de verdade)
  select count(*) into v_cards from public.plt_cards c
   where c.produto_tiny_id = p_tiny_id and c.arquivado_em is null;
  if v_cards > 0 then
    insert into public.plt_notificacoes (destinatario_id, tipo, titulo, corpo)
    select u.id, 'produto_excluido_no_tiny', 'Produto apagado no Tiny',
           'O produto ' || v_nome || ' não existe mais no Tiny da fábrica e saiu das telas, mas ainda tem '
           || v_cards || case when v_cards = 1 then ' cartão' else ' cartões' end
           || ' no quadro. Confira se as peças existem de verdade.'
      from public.plt_usuarios u
     where u.ativo and u.papel = 'admin';
  end if;
  return true;
end;
$$;

comment on function plt_privado.fn_tiny_produto_excluir(bigint, text) is
  'Migration 107 (D-148): o produto da fábrica que o Tiny diz que não existe mais entra em plt_produtos_excluidos_tiny (some das telas), sai da fila do estoque com o Tiny e, com cartão vivo, os admins são avisados. Devolve true só quando acabou de entrar.';

-- o produto que voltou a aparecer na lista do Tiny volta às telas
create or replace function plt_privado.fn_tiny_produtos_voltaram(p_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  delete from public.plt_produtos_excluidos_tiny x where x.tiny_id = any (coalesce(p_ids, '{}'::bigint[]));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- o Tiny disse "não existe" (v2 32 / API nova 404): o que é dele fica marcado
create or replace function plt_privado.fn_tiny_marcar_inexistente(p_fila public.tiny_fila, p_erro text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo text;
begin
  if p_fila.conta = 'fabrica' and p_fila.recurso = 'produto' then
    return case when plt_privado.fn_tiny_produto_excluir(
                       nullif(regexp_replace(coalesce(p_fila.chave, ''), '\D', '', 'g'), '')::bigint, p_erro)
                then 'produto' end;
  end if;
  select x.registro into v_tipo from plt_privado.fn_tiny_recursos() x where x.recurso = p_fila.recurso;
  -- só o que mora nos registros à parte; as tabelas da loja têm a regra delas
  -- (o pedido excluído — D-140 — pela conferência das 3h)
  if v_tipo is null or v_tipo <> all (array['conta_pagar', 'conta_receber', 'nota_fiscal', 'pedido', 'ordem_compra'])
     or (p_fila.conta = 'loja' and v_tipo <> 'conta_pagar') then
    return null;
  end if;
  return case when plt_privado.fn_tiny_registro_sumir(p_fila.conta, v_tipo, p_fila.chave, 'apagado') then 'registro' end;
end;
$$;

comment on function plt_privado.fn_tiny_marcar_inexistente(public.tiny_fila, text) is
  'Migration 107 (D-148): a resposta "não existe" de um detalhe — o produto da fábrica vai para plt_produtos_excluidos_tiny; o registro guardado à parte (contas a pagar das duas contas; pedidos, notas, contas a receber e pedidos de compra da fábrica) fica sumido: apagado. As tabelas da loja seguem a regra delas.';

-- ----------------------------------------------------------------------------
-- 3 · Recriadas: os filtros que não vão ao Tiny, o registrar (o que sumiu volta)
--     e o "quantos aqui" (sem o que sumiu)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plt_privado.fn_tiny_campos(p_params jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(p_params, '{}'::jsonb)
         - array['janela', 'rodada', 'motivo', 'inicio', 'censo', 'carga', 'reabrir',
                 'origem', 'registros', 'soma', 'resumo_em', 'numero_paginas', 'ultima',
                 'mudanca', 'desde', 'limite_n', 'total', 'pedido', 'mudou', 'nova',
                 'situacao_antes', 'aqui', 'aqui_em',
                 -- migration 107 (D-148): as marcas da conferência dos registros
                 'conferencia', 'ids', 'resumo_hash', 'confirmar', 'vistos', 'guardados',
                 'candidatos', 'trava']::text[]
$function$;

CREATE OR REPLACE FUNCTION plt_privado.fn_tiny_registrar(p_conta text, p_tipo text, p_chave text, p_raw jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_hash  text := md5(p_raw::text);
  v_velho public.plt_tiny_registros;
  v_data  date := plt_privado.fn_tiny_registro_data(p_tipo, p_raw);
begin
  -- migration 107 (D-148): a data do registro vai junto (as janelas da
  -- conferência) e o que tinha sumido do Tiny e voltou deixa de estar sumido
  if p_tipo <> 'conta_pagar' then
    insert into public.plt_tiny_registros as t (conta, tipo, chave, raw, hash, data)
    values (p_conta, p_tipo, p_chave, p_raw, v_hash, v_data)
    on conflict (conta, tipo, chave) do update
       set raw = excluded.raw, hash = excluded.hash, data = excluded.data,
           gravado_em = case when t.hash is distinct from excluded.hash then now() else t.gravado_em end,
           sumiu_em = null, sumiu_motivo = null
     where t.hash is distinct from excluded.hash or t.sumiu_em is not null;
    return;
  end if;
  -- as contas a pagar levam o resumo do mês junto (sai o antigo, entra o novo;
  -- a que tinha sumido já tinha saído do resumo — só entra)
  select * into v_velho from public.plt_tiny_registros t
   where t.conta = p_conta and t.tipo = p_tipo and t.chave = p_chave
     for update;
  if found and v_velho.hash = v_hash and v_velho.sumiu_em is null then
    return;
  end if;
  insert into public.plt_tiny_registros as t (conta, tipo, chave, raw, hash, data)
  values (p_conta, p_tipo, p_chave, p_raw, v_hash, v_data)
  on conflict (conta, tipo, chave) do update
     set raw = excluded.raw, hash = excluded.hash, data = excluded.data,
         gravado_em = case when t.hash is distinct from excluded.hash then now() else t.gravado_em end,
         sumiu_em = null, sumiu_motivo = null;
  if v_velho.chave is not null and v_velho.sumiu_em is null then
    perform plt_privado.fn_tiny_registros_mes_somar(p_conta, p_tipo, v_velho.raw, -1);
  end if;
  perform plt_privado.fn_tiny_registros_mes_somar(p_conta, p_tipo, p_raw, 1);
end;
$function$;

CREATE OR REPLACE FUNCTION plt_privado.fn_tiny_aqui(p_conta text, p_recurso text, p_ini date, p_fim date)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    -- migration 107 (D-148): o produto apagado no Tiny não conta
    return (select count(*) from public.produtos p where not exists (select 1 from public.plt_produtos_excluidos_tiny xp where xp.tiny_id = p.tiny_id));
  end if;
  select coalesce(d.registro, x.registro) into v_tipo
    from plt_privado.fn_tiny_recursos() x
    left join plt_privado.fn_tiny_recursos() d on d.recurso = x.detalhe
   where x.recurso = p_recurso;
  if v_tipo is null then
    return null;
  end if;
  -- migration 107 (D-148): o que sumiu do Tiny não conta
  return (select count(*) from public.plt_tiny_registros t
           where t.conta = p_conta and t.tipo = v_tipo and t.sumiu_em is null);
end;
$function$;

-- ----------------------------------------------------------------------------
-- 4 · A conferência dos registros: começar (na madrugada) e fechar cada janela
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_conferencia_iniciar(p_motivo text default 'madrugada')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rodada text := to_char(now() at time zone 'America/Fortaleza', 'YYYY-MM-DD"T"HH24:MI:SS');
  v_hoje   text := to_char((now() at time zone 'America/Fortaleza')::date, 'DD/MM/YYYY');
  v_marca  jsonb;
  v_n      integer := 0;
  v_piso   date;
  c        text;
  j        record;
  x        record;
begin
  v_marca := jsonb_build_object('origem', 'conferencia', 'conferencia', v_rodada,
                                'motivo', coalesce(nullif(trim(p_motivo), ''), 'madrugada'));

  -- FÁBRICA — pedidos de venda, notas e contas a receber: uma janela do piso até hoje
  v_piso := plt_privado.fn_tiny_piso('fabrica');
  for x in select * from (values ('pedidos_pesquisa', 'dataInicial', 'dataFinal'),
                                 ('nf_pesquisa', 'dataInicial', 'dataFinal'),
                                 ('cr_pesquisa', 'data_ini_emissao', 'data_fim_emissao')) as v(recurso, ini, fim) loop
    v_n := v_n + plt_privado.fn_tiny_enfileirar('fabrica', x.recurso, 'conferencia:' || x.recurso || ':tudo',
             'conferência da madrugada', 8,
             v_marca || jsonb_build_object(x.ini, to_char(v_piso, 'DD/MM/YYYY'), x.fim, v_hoje, 'pagina', 1,
                                           'janela', 'conferencia:' || x.recurso || ':tudo'), true);
  end loop;
  -- os pedidos de compra (só a API nova sabe) e o catálogo (só para achar o que sumiu)
  if plt_privado.fn_tiny_api_nova_ligada('fabrica') then
    v_n := v_n + plt_privado.fn_tiny_enfileirar('fabrica', 'v3_ordens_compra', 'conferencia:v3_ordens_compra:tudo',
             'conferência da madrugada', 8,
             v_marca || jsonb_build_object('janela', 'conferencia:v3_ordens_compra:tudo'), true);
  end if;
  v_n := v_n + plt_privado.fn_tiny_enfileirar('fabrica', 'produtos_pesquisa', 'conferencia:produtos_pesquisa:tudo',
           'conferência da madrugada', 8,
           v_marca || jsonb_build_object('pesquisa', '', 'pagina', 1, 'janela', 'conferencia:produtos_pesquisa:tudo'), true);

  -- AS DUAS CONTAS — as contas a pagar, mês a mês (as somas do painel conferem
  -- por mês), do piso do plano de cada conta
  foreach c in array array['loja', 'fabrica'] loop
    v_piso := plt_privado.fn_tiny_piso(c);
    for j in select w.rotulo, greatest(w.ini, v_piso) as ini, w.fim
               from plt_privado.fn_tiny_janelas(date '2025-01-01') w
              where w.fim >= v_piso loop
      v_n := v_n + plt_privado.fn_tiny_enfileirar(c, 'cp_pesquisa', 'conferencia:cp_pesquisa:' || j.rotulo, j.rotulo, 8,
               v_marca || jsonb_build_object('data_ini_emissao', to_char(j.ini, 'DD/MM/YYYY'),
                                             'data_fim_emissao', to_char(j.fim, 'DD/MM/YYYY'), 'pagina', 1,
                                             'janela', 'conferencia:cp_pesquisa:' || j.rotulo), true);
    end loop;
  end loop;

  update public.plt_tiny_controle set ultima_conferencia = v_rodada, atualizado_em = now() where id = 1;
  if v_n > 0 then
    perform plt_privado.fn_tiny_fila_acordar();
  end if;
  return jsonb_build_object('rodada', v_rodada, 'linhas', v_n);
end;
$$;

comment on function plt_privado.fn_tiny_conferencia_iniciar(text) is
  'Migration 107 (D-148): a conferência dos registros que o Tiny não avisa — chamada pela conferência da madrugada (fn_tiny_pente_fino_iniciar; nenhum relógio novo). Põe na fila a lista completa (prioridade 8): da fábrica, pedidos, notas e contas a receber (do piso até hoje), pedidos de compra (API nova) e o catálogo; das duas contas, as contas a pagar mês a mês do piso do plano. Cada página relê só o que mudou; a última fecha a janela (fn_tiny_conferencia_fechar).';

create or replace function plt_privado.fn_tiny_conferencia_fechar(p_fila_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  f           public.tiny_fila;
  v_rodada    text;
  v_janela    text;
  v_detalhe   text;
  v_tipo      text;
  v_rotulo    text;
  v_ini       date;
  v_fim       date;
  v_vistos    integer;
  v_guardados integer;
  v_cand      text[];
  v_n         integer := 0;
begin
  select * into f from public.tiny_fila where id = p_fila_id;
  if not found or not (f.params ? 'conferencia') then
    return null;
  end if;
  v_rodada := f.params->>'conferencia';
  v_janela := f.params->>'janela';
  select x.detalhe, d.registro, x.rotulo into v_detalhe, v_tipo, v_rotulo
    from plt_privado.fn_tiny_recursos() x
    left join plt_privado.fn_tiny_recursos() d on d.recurso = x.detalhe
   where x.recurso = f.recurso;
  if v_detalhe is null then
    return null;
  end if;
  begin
    v_ini := to_date(coalesce(f.params->>'dataInicial', f.params->>'data_ini_emissao'), 'DD/MM/YYYY');
    v_fim := to_date(coalesce(f.params->>'dataFinal', f.params->>'data_fim_emissao'), 'DD/MM/YYYY');
  exception when others then
    return jsonb_build_object('erro', 'janela sem data válida');
  end;

  -- o que a lista do Tiny trouxe nesta janela (todas as páginas desta rodada —
  -- pelo índice da rodada) × o que temos guardado e não sumiu
  if f.conta = 'fabrica' and f.recurso = 'produtos_pesquisa' then
    with vistos as (
      select distinct i.id
        from public.tiny_fila p
        cross join lateral jsonb_array_elements_text(coalesce(p.params->'ids', '[]'::jsonb)) as i(id)
       where p.params ? 'conferencia' and p.params->>'conferencia' = v_rodada
         and p.conta = f.conta and p.recurso = f.recurso and p.params->>'janela' = v_janela and p.status = 'ok'
    ), guardados as (
      select p.tiny_id::text as chave
        from public.produtos p
       where not exists (select 1 from public.plt_produtos_excluidos_tiny x where x.tiny_id = p.tiny_id)
    )
    select (select count(*) from vistos)::integer, count(*)::integer,
           array_agg(g.chave order by g.chave) filter (where v.id is null)
      into v_vistos, v_guardados, v_cand
      from guardados g left join vistos v on v.id = g.chave;
  elsif v_ini is null and v_fim is null then
    -- a lista sem data (os pedidos de compra da API nova): tudo o que temos do tipo
    with vistos as (
      select distinct i.id
        from public.tiny_fila p
        cross join lateral jsonb_array_elements_text(coalesce(p.params->'ids', '[]'::jsonb)) as i(id)
       where p.params ? 'conferencia' and p.params->>'conferencia' = v_rodada
         and p.conta = f.conta and p.recurso = f.recurso and p.params->>'janela' = v_janela and p.status = 'ok'
    ), guardados as (
      select t.chave from public.plt_tiny_registros t
       where t.conta = f.conta and t.tipo = v_tipo and t.sumiu_em is null
    )
    select (select count(*) from vistos)::integer, count(*)::integer,
           array_agg(g.chave order by g.chave) filter (where v.id is null)
      into v_vistos, v_guardados, v_cand
      from guardados g left join vistos v on v.id = g.chave;
  else
    -- a janela por data (do piso até hoje, ou o mês das contas a pagar): o que
    -- temos com a data dentro dela (pelo índice da data)
    with vistos as (
      select distinct i.id
        from public.tiny_fila p
        cross join lateral jsonb_array_elements_text(coalesce(p.params->'ids', '[]'::jsonb)) as i(id)
       where p.params ? 'conferencia' and p.params->>'conferencia' = v_rodada
         and p.conta = f.conta and p.recurso = f.recurso and p.params->>'janela' = v_janela and p.status = 'ok'
    ), guardados as (
      select t.chave from public.plt_tiny_registros t
       where t.conta = f.conta and t.tipo = v_tipo and t.sumiu_em is null
         and t.data >= coalesce(v_ini, date '-infinity') and t.data <= coalesce(v_fim, date 'infinity')
    )
    select (select count(*) from vistos)::integer, count(*)::integer,
           array_agg(g.chave order by g.chave) filter (where v.id is null)
      into v_vistos, v_guardados, v_cand
      from guardados g left join vistos v on v.id = g.chave;
  end if;
  v_cand := coalesce(v_cand, '{}'::text[]);

  -- a trava: lista com menos da metade do que temos não marca nada (o Tiny
  -- pode ter respondido errado) — e o dono fica sabendo
  if v_guardados >= 20 and v_vistos * 2 < v_guardados then
    perform plt_privado.fn_tiny_alertar(
      'conferencia:' || f.conta || ':' || f.recurso,
      'A lista do Tiny veio incompleta',
      'Na conferência da madrugada, o Tiny ' || case f.conta when 'fabrica' then 'da fábrica' else 'da loja' end
        || ' listou ' || v_vistos || ' de ' || v_guardados || ' ' || coalesce(v_rotulo, f.recurso)
        || ' que temos guardados. Nada foi marcado como apagado; a próxima conferência confere de novo.',
      jsonb_build_object('origem', 'conferencia_tiny', 'conta', f.conta,
                         'tipo_de_dado', coalesce(v_rotulo, f.recurso), 'janela', f.referencia,
                         'vistos', v_vistos, 'guardados', v_guardados, 'fila_id', f.id),
      interval '1 day');
    update public.tiny_fila
       set params = params || jsonb_build_object('vistos', v_vistos, 'guardados', v_guardados, 'trava', true)
     where id = f.id;
    return jsonb_build_object('vistos', v_vistos, 'guardados', v_guardados, 'trava', true);
  end if;

  -- o que a lista não trouxe: um detalhe de confirmação cada (só "não existe"
  -- marca como apagado — fn_tiny_fila_resposta)
  if cardinality(v_cand) > 0 then
    v_n := plt_privado.fn_tiny_enfileirar_varios((
      select jsonb_agg(jsonb_build_object(
               'conta', f.conta, 'recurso', v_detalhe, 'chave', c, 'prioridade', 8,
               'params', jsonb_build_object('origem', 'conferencia', 'conferencia', v_rodada, 'confirmar', true)))
        from unnest(v_cand) as c), true);
  end if;
  update public.tiny_fila
     set params = params || jsonb_build_object('vistos', v_vistos, 'guardados', v_guardados,
                                               'candidatos', cardinality(v_cand))
   where id = f.id;
  if v_n > 0 then
    perform plt_privado.fn_tiny_fila_acordar();
  end if;
  return jsonb_build_object('vistos', v_vistos, 'guardados', v_guardados,
                            'candidatos', cardinality(v_cand), 'enfileirados', v_n);
end;
$$;

comment on function plt_privado.fn_tiny_conferencia_fechar(bigint) is
  'Migration 107 (D-148): fecha uma janela da conferência dos registros, chamada na última página dela — o que temos (não sumido, com a data na janela; no catálogo, os produtos não excluídos) e a lista do Tiny não trouxe vira um detalhe de confirmação (prioridade 8, confirmar). Trava: com 20 ou mais guardados e a lista trazendo menos da metade, nada é conferido e o dono é avisado (uma vez por dia por conta e tipo).';

-- ----------------------------------------------------------------------------
-- 5 · Recriada: a resposta do Tiny — a conferência relê só o que mudou, guarda o
--     que a lista trouxe, fecha a janela na última página; "não existe" marca
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_tiny_fila_resposta(p_fila_id bigint, p_resposta jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_conf_tipo text;   -- migration 107: o tipo guardado do detalhe da conferência
  v_ids      jsonb;   -- migration 107: os ids que a página da conferência trouxe
  v_fechou   jsonb;   -- migration 107: a janela da conferência fechada
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
      -- migration 107 (D-148): o que o Tiny diz que não existe fica marcado
      if r.tipo = 'detalhe' then
        perform plt_privado.fn_tiny_marcar_inexistente(f, 'não existe no Tiny (404)');
      end if;
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
    -- a árvore de categorias da v2 pode vir como lista solta — e vem, de
    -- verdade (18/10, as duas contas), como lista DENTRO do retorno:
    -- {"retorno": [...]} (migration 93; antes caía em "sem envelope retorno")
    if jsonb_typeof(v_corpo) = 'array' then
      v_ret := jsonb_build_object('status', 'OK', 'lista', v_corpo);
    elsif jsonb_typeof(v_corpo->'retorno') = 'array' then
      v_ret := jsonb_build_object('status', 'OK', 'lista', v_corpo->'retorno');
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
        -- migration 107 (D-148): "não localizado" marca o registro (ou o produto
        -- da fábrica) como apagado no Tiny — nada se apaga; visto de novo, volta
        if v_cod = '32' and r.tipo = 'detalhe' then
          perform plt_privado.fn_tiny_marcar_inexistente(f, v_erro);
        end if;
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

    -- migration 107 (D-148): a conferência da madrugada só relê o que é novo,
    -- mudou (o item da lista × o resumo guardado) ou tinha sumido — e guarda os
    -- ids que a página trouxe (na última, o que temos e não veio é conferido)
    if v_origem = 'conferencia' then
      select coalesce(jsonb_agg(distinct x->>'id'), '[]'::jsonb) into v_ids
        from jsonb_array_elements(v_lista) x
       where nullif(x->>'id', '') is not null;
      if f.conta = 'fabrica' and f.recurso = 'produtos_pesquisa' then
        -- o catálogo serve só para achar o que sumiu (o produto mudado chega pela
        -- consulta de hora em hora); o que voltou a aparecer volta às telas
        perform plt_privado.fn_tiny_produtos_voltaram(array(
                  select nullif(regexp_replace(i, '\D', '', 'g'), '')::bigint
                    from jsonb_array_elements_text(v_ids) i));
      elsif r.detalhe is not null then
        select d.registro into v_conf_tipo from plt_privado.fn_tiny_recursos() d where d.recurso = r.detalhe;
        perform plt_privado.fn_tiny_enfileirar(
                  f.conta, r.detalhe, x->>'id',
                  coalesce(x->>'numero', x->>'numero_documento', x->>'codigo', x->>'nome', x->>'descricao', ''),
                  8,
                  jsonb_build_object('origem', 'conferencia', 'conferencia', f.params->>'conferencia',
                                     'resumo_hash', md5(x::text)),
                  true)
           from jsonb_array_elements(v_lista) x
           left join public.plt_tiny_registros t
             on t.conta = f.conta and t.tipo = v_conf_tipo and t.chave = x->>'id'
          where nullif(x->>'id', '') is not null
            and (t.chave is null or t.resumo_hash is distinct from md5(x::text) or t.sumiu_em is not null);
      end if;
    -- o detalhe de cada registro (a carga vai devagar, atrás de todo o resto)
    elsif r.detalhe is not null then
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
                                             f.prioridade, (f.params - array['ids', 'vistos', 'guardados', 'candidatos', 'trava']::text[])
                                               || jsonb_build_object('pagina', v_pag + 1), true);
    elsif v_api = 'v3' and v_tot is not null and v_offset + v_limit < v_tot then
      perform plt_privado.fn_tiny_enfileirar(f.conta, f.recurso, v_janela || ':o' || (v_offset + v_limit), f.referencia,
                                             f.prioridade, (f.params - array['ids', 'vistos', 'guardados', 'candidatos', 'trava']::text[])
                                               || jsonb_build_object('offset', v_offset + v_limit, 'limit', v_limit), true);
    end if;

    update public.tiny_fila
       set status = 'ok', processado_em = now(), erro = null, nao_antes = null,
           params = params || jsonb_build_object('registros', v_n, 'soma', v_soma)
                            || case when v_api = 'v2' then jsonb_build_object('numero_paginas', v_total)
                                    else jsonb_build_object('total', v_tot) end
                            || case when v_origem = 'conferencia' then jsonb_build_object('ids', v_ids)
                                    else '{}'::jsonb end
     where id = f.id;
    -- migration 107 (D-148): a última página da conferência fecha a janela (as
    -- páginas vêm em cadeia: chegar aqui = todas as anteriores lidas)
    if v_origem = 'conferencia'
       and ((v_api = 'v2' and v_pag >= v_total)
            or (v_api = 'v3' and (v_tot is null or v_offset + v_limit >= v_tot))) then
      v_fechou := plt_privado.fn_tiny_conferencia_fechar(f.id);
    end if;
    return jsonb_build_object('ok', true, 'registros', v_n)
           || case when v_fechou is not null then jsonb_build_object('conferencia', v_fechou) else '{}'::jsonb end;
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
    -- migration 107 (D-148): o produto que o Tiny achou não está apagado
    perform plt_privado.fn_tiny_produtos_voltaram(array[nullif(regexp_replace(f.chave, '\D', '', 'g'), '')::bigint]);
  elsif f.recurso = 'estrutura' then
    perform plt_privado.fn_tiny_estrutura_gravar(f.conta, nullif(regexp_replace(f.chave, '\D', '', 'g'), '')::bigint, v_reg);
    perform plt_privado.fn_tiny_registrar(f.conta, 'estrutura', f.chave, v_reg);
  else
    perform plt_privado.fn_tiny_registrar(f.conta, coalesce(r.registro, f.recurso), f.chave, v_reg);
    -- migration 107 (D-148): a conferência guarda o resumo da lista (amanhã só
    -- relê se o item mudar); o que a lista não trouxe mas o Tiny tem (cancelado,
    -- por exemplo) fica "fora da lista" — não conta no "quantos aqui"
    if v_origem = 'conferencia' then
      if f.params ? 'resumo_hash' then
        update public.plt_tiny_registros t
           set resumo_hash = f.params->>'resumo_hash'
         where t.conta = f.conta and t.tipo = coalesce(r.registro, f.recurso) and t.chave = f.chave
           and t.resumo_hash is distinct from f.params->>'resumo_hash';
      end if;
      if coalesce((f.params->>'confirmar')::boolean, false) then
        perform plt_privado.fn_tiny_registro_sumir(f.conta, coalesce(r.registro, f.recurso), f.chave, 'fora_da_lista');
      end if;
    end if;
  end if;

  update public.tiny_fila
     set status = 'ok', processado_em = now(), erro = null, nao_antes = null
   where id = f.id;
  return jsonb_build_object('ok', true);
end;
$function$;

-- ----------------------------------------------------------------------------
-- 6 · Recriada: a conferência da madrugada começa também a dos registros
-- ----------------------------------------------------------------------------
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
  v_conf    jsonb;                    -- ↪️ D-148 (migration 107): a conferência dos registros
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

  -- ↪️ D-148 (migration 107): a mesma madrugada confere o que o Tiny não avisa
  -- (os registros da fábrica, as contas a pagar das duas contas, o catálogo da
  -- fábrica) — blindado: um erro ali não derruba a conferência de sempre
  begin
    v_conf := plt_privado.fn_tiny_conferencia_iniciar(p_motivo);
  exception when others then
    v_conf := jsonb_build_object('erro', left(sqlerrm, 200));
    raise warning 'Tiny (conferência dos registros): %', sqlerrm;
  end;

  return jsonb_build_object('rodada', v_rodada, 'hora_local', v_local, 'nao_terminados', v_abertos,
                            'contas_abertas', v_contas, 'conferencia', v_conf)
         || plt_privado.fn_tiny_fila_acordar();
end;
$function$;

-- ----------------------------------------------------------------------------
-- 7 · Recriada: a vez da renovação da API nova da fábrica (2 h → 30 min — E-116)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plt_fn_tiny_fabrica_renovacao_reservar()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  update public.tiny_auth a
     set updated_at = now()
   where a.id = 2
     and a.refresh_token is not null
     and a.updated_at < now() - interval '30 minutes'   -- migration 107 (E-116): era 2 h
  returning a.refresh_token
$function$;

comment on function public.plt_fn_tiny_fabrica_renovacao_reservar() is
  'SESSAO-33: o renovador da fábrica pega a vez (marca a hora agora) e recebe o refresh token — só se a última renovação tem mais de 30 min (migration 107 — era 2 h: com o relógio de 3 em 3 h, a 1ª renovação depois de uma autorização podia cair depois do vencimento de 4 h; agora o acesso não passa de 3h30 — E-116). Duas chamadas juntas: só uma recebe. Só a chave de serviço.';

-- ----------------------------------------------------------------------------
-- 8 · Recriadas: o produto apagado no Tiny some de todas as telas (D-148) e o
--     estoque com o Tiny para de perguntar por ele
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plt_privado.fn_estoque_por_produto()
 RETURNS TABLE(tiny_id bigint, codigo text, descricao text, classe text, unidade text, situacao text, minimo numeric, saldo_tiny numeric, reservado_tiny numeric, lido_em timestamp with time zone, origem_leitura text, evento_leitura_id bigint, reservas_loja numeric, disponivel numeric, prontos_reservados integer, prontos_livres integer, reposicao_card_id bigint, reposicao_estado text, reposicao_quantidade integer, reposicao_liberadas integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with cfg as (
    select plt_privado.fn_estoque_top_x() as top_x
  ),
  reservas as (
    select r.tiny_id, r.quantidade from plt_privado.fn_estoque_reservas_loja() r where r.tiny_id is not null
  ),
  reposicao as (
    select distinct on (rc.produto_tiny_id)
           rc.produto_tiny_id as tiny_id,
           rc.id              as card_id,
           rc.total_unidades  as quantidade,
           u.liberadas,
           case
             when u.em_producao > 0                then 'em_producao'
             when rc.arquivado_em is not null      then 'arquivada'
             when rc.liberado_completo_em is null  then 'no_pcp'
             else 'concluida'
           end                as estado
      from public.plt_cards rc
      left join lateral (
        select count(*)::int as liberadas,
               count(*) filter (where cu.arquivado_em is null and cu.concluido_em is null)::int as em_producao
          from public.plt_cards cu
         where cu.card_pai_id = rc.id and cu.tipo = 'unidade'
      ) u on true
     where rc.tipo = 'reposicao'
     order by rc.produto_tiny_id, rc.id desc
  )
  select pr.tiny_id,
         pr.codigo,
         pr.descricao,
         pr.classe,
         pr.unidade,
         pr.situacao,
         -- D-83: móvel = mínimo da plataforma, só no Top X; insumo/peça = plataforma, senão o do Tiny (D-138: o tipo é o de plt — móvel, insumo ou peça).
         case when pr.tipo_estoque_efetivo = 'movel'
              then case when n.posicao is not null and n.posicao <= cfg.top_x then pr.minimo_plataforma end
              else coalesce(pr.minimo_plataforma, pr.estoque_minimo) end      as minimo,
         n.saldo_tiny,
         n.reservado_tiny,
         n.lido_em,
         n.origem_leitura,
         n.evento_leitura_id,
         coalesce(r.quantidade, 0)                                           as reservas_loja,
         case when pr.tipo_estoque_efetivo = 'movel'
              then coalesce(n.livres, 0)::numeric
              when n.saldo_tiny is not null
              then n.saldo_tiny - coalesce(r.quantidade, 0) end               as disponivel,
         -- D-118: reservados em venda = prontas de pedido (aguardo + ROTAS até a
         -- entrega) + as peças do estoque reservadas pela venda.
         coalesce(n.prontas_pedido, 0) + coalesce(n.reservadas_estoque, 0)   as prontos_reservados,
         coalesce(n.livres, 0)                                               as prontos_livres,
         rp.card_id,
         rp.estado,
         rp.quantidade,
         rp.liberadas
    from public.produtos pr
    cross join cfg
    left join public.plt_estoque_numeros n on n.produto_tiny_id = pr.tiny_id
    left join reservas  r  on r.tiny_id  = pr.tiny_id
    left join reposicao rp on rp.tiny_id = pr.tiny_id
   -- migration 107 (D-148): o produto apagado no Tiny não está no estoque
   where not exists (select 1 from public.plt_produtos_excluidos_tiny xp where xp.tiny_id = pr.tiny_id);
$function$;

CREATE OR REPLACE FUNCTION plt_privado.fn_eh_acabado_contado(p_produto_tiny_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.produtos pr
     where pr.tiny_id = p_produto_tiny_id
       and pr.situacao = 'A'
       and pr.tipo_estoque_efetivo = 'movel'
       and not plt_privado.fn_eh_personalizado(pr.descricao)
       -- migration 107 (D-148): o apagado no Tiny não se conta nem se pergunta ao Tiny
       and not exists (select 1 from public.plt_produtos_excluidos_tiny xp where xp.tiny_id = pr.tiny_id));
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_estoque_configuracoes(p_busca text DEFAULT NULL::text, p_limite integer DEFAULT 20, p_deslocamento integer DEFAULT 0)
 RETURNS TABLE(tiny_id bigint, codigo text, descricao text, imagem_caminho text, posicao integer, vendidos_90d numeric, cortes integer, no_top boolean, media_semana numeric, minimo numeric, minimo_tiny numeric, minimo_travado boolean, sugestao integer, em_estoque integer, contagem_total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with cfg as (
    select plt_privado.fn_estoque_top_x() as top_x
  )
  select pr.tiny_id,
         pr.codigo,
         pr.descricao,
         pr.imagem_caminho,
         n.posicao,
         coalesce(n.vendidos_90d, 0),
         coalesce(n.cortes_90d, 0),
         (n.posicao is not null and n.posicao <= cfg.top_x),
         s.media_semana,
         case when n.posicao is not null and n.posicao <= cfg.top_x
              then pr.minimo_plataforma end,
         pr.estoque_minimo,
         pr.minimo_travado,
         s.sugestao,
         coalesce(n.livres, 0),
         count(*) over ()
    from public.produtos pr
    cross join cfg
    left join public.plt_estoque_numeros n          on n.produto_tiny_id = pr.tiny_id
    left join plt_privado.fn_sugestoes_minimo(null) s on s.tiny_id = pr.tiny_id
   where plt_privado.fn_pode_ver_expedicao()
     and pr.situacao = 'A'
     and not exists (select 1 from public.plt_produtos_excluidos_tiny xp where xp.tiny_id = pr.tiny_id)  -- migration 107 (D-148)
     and pr.tipo_estoque_efetivo = 'movel'
     and (p_busca is null or btrim(p_busca) = ''
          or pr.descricao ilike '%' || btrim(p_busca) || '%'
          or pr.codigo ilike btrim(p_busca) || '%')
   order by n.posicao nulls last, pr.descricao, pr.tiny_id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_produtos_classificacao(p_busca text DEFAULT NULL::text, p_tipo text DEFAULT NULL::text, p_classe text DEFAULT NULL::text, p_origem text DEFAULT NULL::text, p_situacao text DEFAULT 'A'::text, p_limite integer DEFAULT 30, p_deslocamento integer DEFAULT 0)
 RETURNS TABLE(tiny_id bigint, codigo text, descricao text, classe text, unidade text, ncm text, situacao text, tipo text, tipo_automatico text, definido_a_mao boolean, imagem_caminho text, contagem_total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select pr.tiny_id,
         pr.codigo,
         pr.descricao,
         pr.classe,
         pr.unidade,
         nullif(btrim(coalesce(pr.raw ->> 'ncm', '')), '')                       as ncm,
         pr.situacao,
         pr.tipo_estoque_efetivo                                                  as tipo,
         plt_privado.fn_tipo_estoque_automatico(pr.classe, pr.unidade, pr.raw)    as tipo_automatico,
         pr.tipo_estoque is not null                                              as definido_a_mao,
         pr.imagem_caminho,
         count(*) over ()                                                         as contagem_total
    from public.produtos pr
   where plt_privado.fn_eh_admin()
     and not exists (select 1 from public.plt_produtos_excluidos_tiny xp where xp.tiny_id = pr.tiny_id)  -- migration 107 (D-148): o apagado no Tiny some
     and (p_busca is null or btrim(p_busca) = ''
          or pr.descricao ilike '%' || btrim(p_busca) || '%'
          or pr.codigo ilike btrim(p_busca) || '%')
     and (p_tipo is null or pr.tipo_estoque_efetivo = p_tipo)
     and (p_classe is null or pr.classe = p_classe)
     and (p_origem is null
          or (p_origem = 'manual' and pr.tipo_estoque is not null)
          or (p_origem = 'automatico' and pr.tipo_estoque is null))
     and (p_situacao is null or pr.situacao = p_situacao)
   order by pr.descricao, pr.tiny_id
   limit least(greatest(coalesce(p_limite, 30), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_produtos_unidades(p_limite integer DEFAULT 30, p_deslocamento integer DEFAULT 0)
 RETURNS TABLE(tiny_id bigint, codigo text, descricao text, tipo text, unidade_tiny text, unidade_padrao text, motivo text, contagem_total bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_eh_admin() then
    raise exception 'Só o admin vê a lista das unidades.' using errcode = 'insufficient_privilege';
  end if;

  return query
  with grafias as (
    -- quantas vezes cada grafia aparece, por unidade (todo o catálogo ativo)
    select p.unidade as familia, coalesce(p.raw->>'unidade', '') as grafia, count(*) as n
      from public.produtos p
     where p.situacao = 'A' and p.unidade is not null and btrim(coalesce(p.raw->>'unidade', '')) <> ''
       and not exists (select 1 from public.plt_produtos_excluidos_tiny xp where xp.tiny_id = p.tiny_id)  -- migration 107 (D-148)
     group by 1, 2
  ), padroes as (
    select distinct on (g.familia) g.familia, g.grafia as padrao
      from grafias g
     order by g.familia, g.n desc, g.grafia
  ), lista as (
    select p.tiny_id, p.codigo, p.descricao, p.tipo_estoque_efetivo as tipo,
           coalesce(p.raw->>'unidade', '') as unidade_tiny,
           pd.padrao as unidade_padrao,
           case
             when btrim(coalesce(p.raw->>'unidade', '')) = '' then 'sem_unidade'
             when p.unidade <> all (array['un', 'pc', 'm2', 'm', 'cx', 'kg', 'l', 'par', 'rolo', 'chapa', 'min']) then 'desconhecida'
             when coalesce(p.raw->>'unidade', '') <> pd.padrao then 'grafia'
           end as motivo
      from public.produtos p
      left join padroes pd on pd.familia = p.unidade
     where p.situacao = 'A'
       and not exists (select 1 from public.plt_produtos_excluidos_tiny xp where xp.tiny_id = p.tiny_id)  -- migration 107 (D-148): o apagado no Tiny some
       and coalesce(p.tipo_estoque_efetivo, '') <> 'movel'
  )
  select l.tiny_id, l.codigo, l.descricao, l.tipo, l.unidade_tiny,
         case when l.motivo = 'grafia' then l.unidade_padrao end,
         l.motivo, count(*) over ()
    from lista l
   where l.motivo is not null
   order by case l.motivo when 'sem_unidade' then 1 when 'desconhecida' then 2 else 3 end, l.descricao
   limit least(greatest(coalesce(p_limite, 30), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
end;
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_produto_estrutura(p_tiny_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_produto jsonb;
  v_comp    jsonb;
  v_usado   jsonb;
  v_total   integer;
  v_lido    timestamptz;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_eh_admin() then
    raise exception 'Só o admin vê a estrutura dos produtos.' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object('tiny_id', p.tiny_id, 'codigo', p.codigo, 'descricao', p.descricao,
                            'tipo', p.tipo_estoque_efetivo, 'classe', p.classe)
    into v_produto
    from public.produtos p where p.tiny_id = p_tiny_id
     and not exists (select 1 from public.plt_produtos_excluidos_tiny xp where xp.tiny_id = p.tiny_id);  -- migration 107 (D-148)
  if v_produto is null then
    raise exception 'Produto não encontrado.' using errcode = 'no_data_found';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'tiny_id',     c.componente_tiny_id,
           'codigo',      coalesce(p.codigo, c.codigo),
           'descricao',   coalesce(p.descricao, c.nome, 'Produto fora do catálogo'),
           'tipo',        p.tipo_estoque_efetivo,
           'unidade',     coalesce(nullif(btrim(coalesce(p.raw->>'unidade', '')), ''), p.unidade),
           'quantidade',  c.quantidade,
           'no_catalogo', p.tiny_id is not null)
         order by coalesce(p.descricao, c.nome)), '[]'::jsonb),
         max(c.lido_em)
    into v_comp, v_lido
    from public.plt_produto_componentes c
    left join public.produtos p on p.tiny_id = c.componente_tiny_id
   where c.produto_tiny_id = p_tiny_id
     and not exists (select 1 from public.plt_produtos_excluidos_tiny xp where xp.tiny_id = c.componente_tiny_id);  -- migration 107 (D-148)

  select count(*) into v_total
    from public.plt_produto_componentes c where c.componente_tiny_id = p_tiny_id
     and not exists (select 1 from public.plt_produtos_excluidos_tiny xp where xp.tiny_id = c.produto_tiny_id);  -- migration 107 (D-148)

  select coalesce(jsonb_agg(jsonb_build_object(
           'tiny_id', x.tiny_id, 'codigo', x.codigo, 'descricao', x.descricao,
           'tipo', x.tipo, 'quantidade', x.quantidade)
         order by x.descricao), '[]'::jsonb)
    into v_usado
    from (select p.tiny_id, p.codigo, p.descricao, p.tipo_estoque_efetivo as tipo, c.quantidade
            from public.plt_produto_componentes c
            join public.produtos p on p.tiny_id = c.produto_tiny_id
           where c.componente_tiny_id = p_tiny_id
             and not exists (select 1 from public.plt_produtos_excluidos_tiny xp where xp.tiny_id = p.tiny_id)  -- migration 107 (D-148)
           order by p.descricao
           limit 50) x;

  return jsonb_build_object('produto', v_produto, 'componentes', v_comp,
                            'usado_em', v_usado, 'usado_em_total', v_total, 'lido_em', v_lido);
end;
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_vinculo_buscar(p_tipo text, p_busca text, p_para_ajuste boolean DEFAULT false, p_limite integer DEFAULT 10)
 RETURNS TABLE(id bigint, rotulo text, detalhe text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with b as (select btrim(coalesce(p_busca, '')) as t, least(greatest(coalesce(p_limite, 10), 1), 20) as n),
  ok as (select plt_privado.fn_pode_criar_avulso() and char_length((select t from b)) >= 2 as v)
  select x.id, x.rotulo, x.detalhe from (
    select p.id, 'Pedido ' || p.numero as rotulo, coalesce(cl.nome, '') as detalhe, p.numero::bigint as ordem
      from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p left join public.clientes cl on cl.id = p.cliente_id
     where p_tipo = 'pedido' and (select v from ok)
       and (p.numero::text like (select t from b) || '%' or cl.nome ilike '%' || (select t from b) || '%')
     order by p.numero desc
     limit (select n from b)
  ) x where p_tipo = 'pedido'
  union all
  select y.id, y.rotulo, y.detalhe from (
    select pr.tiny_id as id, coalesce('SKU ' || nullif(btrim(pr.codigo), '') || ' · ', '') || coalesce(pr.descricao, 'Produto') as rotulo,
           coalesce(pr.unidade, '') as detalhe
      from public.produtos pr
     where p_tipo = 'produto' and (select v from ok) and pr.situacao = 'A'
       and not exists (select 1 from public.plt_produtos_excluidos_tiny xp where xp.tiny_id = pr.tiny_id)  -- migration 107 (D-148)
       and (pr.codigo ilike (select t from b) || '%' or pr.descricao ilike '%' || (select t from b) || '%')
     order by pr.descricao
     limit (select n from b)
  ) y where p_tipo = 'produto'
  union all
  select z.id, z.rotulo, z.detalhe from (
    select c.id, plt_privado.fn_vinculo_rotulo('peca', c.id) as rotulo,
           case when c.arquivado_em is not null then 'Já entregue' else coalesce(s.nome, '') end as detalhe
      from public.plt_cards c
      left join public.plt_setores s on s.id = c.setor_atual_id
      left join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p on p.id = c.pedido_id
     where p_tipo = 'peca' and (select v from ok) and c.tipo = 'unidade'
       and (p.numero::text like (select t from b) || '%' or c.item_codigo ilike (select t from b) || '%'
            or c.item_descricao ilike '%' || (select t from b) || '%')
       and case when coalesce(p_para_ajuste, false) then
                  c.ajuste_destino is null
                  and ((c.arquivado_em is null and s.codigo in ('devolucao', 'estoque', 'aguardo')
                        and c.reservada_pedido_id is null)
                       or (c.arquivado_em is not null
                           and (select a.dados ->> 'motivo' from public.plt_eventos a
                                 where a.card_id = c.id and a.tipo = 'card_arquivado' order by a.id desc limit 1) = 'entregue'))
                else c.arquivado_em is null end
     order by c.id desc
     limit (select n from b)
  ) z where p_tipo = 'peca';
$function$;

CREATE OR REPLACE FUNCTION public.plt_fn_fotos_tiny_pendentes(p_limite integer DEFAULT 3)
 RETURNS TABLE(produto_tiny_id bigint, pasta text, url_tiny text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select p.tiny_id, plt_privado.fn_pasta_produto(p.codigo, p.tiny_id), u.url
    from public.produtos p
    cross join lateral (select plt_privado.fn_foto_tiny_url(p.raw) as url) u
   where u.url is not null
     and not exists (select 1 from public.plt_produtos_excluidos_tiny xp where xp.tiny_id = p.tiny_id)  -- migration 107 (D-148): não copia foto do que o Tiny apagou
     and (p.imagem_caminho is null
          or (p.imagem_tiny is not null and p.imagem_tiny <> u.url))
     and not exists (select 1 from public.plt_logs_atividade l
                      where l.acao = 'estoque_foto_tiny_falhou'
                        and l.criado_em > now() - interval '1 day'
                        and l.contexto ->> 'produto_tiny_id' = p.tiny_id::text
                        and l.contexto ->> 'url' = u.url)
   order by (p.classe = 'F') desc, (p.situacao = 'A') desc, p.tiny_id
   limit greatest(1, least(coalesce(p_limite, 3), 20));
$function$;

-- ----------------------------------------------------------------------------
-- 9 · Recriada: o painel confere as somas das contas a pagar com a leitura mais
--     recente (as mesmas chaves — E-73)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plt_fn_tiny_carga_painel()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_conf   boolean;  -- migration 107 (D-148): as somas vêm da conferência (mais nova que a carga)
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

  -- as somas das contas a pagar, mês a mês: no Tiny (as páginas da leitura
  -- mais recente — migration 107: a conferência da madrugada, quando é mais nova
  -- que a carga; senão, a carga) × aqui (o resumo do mês dos registros guardados)
  v_conf := v_ctl.ultima_conferencia is not null
            and v_ctl.ultima_conferencia > coalesce(v_ctl.ultima_carga, '');
  if v_conf then
  with paginas as (
    select f.conta, regexp_replace(f.params->>'janela', ':p[0-9]+$', '') as janela,
           max(f.referencia) as rotulo,
           to_date(max(f.params->>'data_ini_emissao'), 'DD/MM/YYYY') as ini,
           to_date(max(f.params->>'data_fim_emissao'), 'DD/MM/YYYY') as fim,
           sum((f.params->>'soma')::numeric) as tiny,
           bool_and(f.status = 'ok') as lido
      from public.tiny_fila f
     where f.params ? 'conferencia' and f.params->>'conferencia' = v_ctl.ultima_conferencia
       and f.recurso = 'cp_pesquisa'
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
  else
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
  end if;

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
    'carga',    jsonb_build_object('rodada', v_ctl.ultima_carga, 'por_recurso', v_carga_resumo, 'somas', v_somas,
                                   'somas_de', case when v_conf then 'conferencia' else 'carga' end),
    'conferencia', jsonb_build_object('rodada', v_ctl.ultima_conferencia),
    'pausada',  coalesce(v_ctl.carga_pausada, false),
    'fila',     v_fila,
    'erros',    v_erros,
    'mudancas', v_mud,
    'api_nova', v_api);
end;
$function$;

-- ----------------------------------------------------------------------------
-- 10 · O acerto da aplicação (de novo = zeros)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_conferencia_acertar()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_datas    integer;
  v_produtos integer := 0;
  r          record;
begin
  -- (a) a data de cada registro que tem data (as janelas da conferência)
  update public.plt_tiny_registros t
     set data = plt_privado.fn_tiny_registro_data(t.tipo, t.raw)
   where t.tipo in ('conta_pagar', 'conta_receber', 'nota_fiscal', 'pedido')
     and t.data is distinct from plt_privado.fn_tiny_registro_data(t.tipo, t.raw);
  get diagnostics v_datas = row_count;

  -- (b) os produtos que o Tiny da fábrica já disse que não existem (a leitura do
  --     estoque da carga de 18/10: "Produto não localizado")
  for r in
    select distinct on (p.tiny_id) p.tiny_id, f.erro
      from public.tiny_fila f
      join public.produtos p on p.tiny_id = nullif(regexp_replace(f.chave, '\D', '', 'g'), '')::bigint
     where f.conta = 'fabrica' and f.recurso in ('estoque', 'produto') and f.status = 'vazio'
       and (f.erro ~* 'n[ãa]o localizado' or f.erro ~ 'codigo 32')
       and not exists (select 1 from public.plt_produtos_excluidos_tiny x where x.tiny_id = p.tiny_id)
     order by p.tiny_id, f.processado_em desc nulls last
  loop
    if plt_privado.fn_tiny_produto_excluir(r.tiny_id, r.erro) then
      v_produtos := v_produtos + 1;
    end if;
  end loop;

  return jsonb_build_object('datas', v_datas, 'produtos_excluidos', v_produtos);
end;
$$;

comment on function plt_privado.fn_tiny_conferencia_acertar() is
  'Migration 107 (D-148): roda na aplicação (de novo = zeros) — a data de cada registro com data e os produtos da fábrica que o Tiny já disse que não existem (a leitura do estoque da carga: "Produto não localizado") entram em plt_produtos_excluidos_tiny.';

select plt_privado.fn_tiny_conferencia_acertar();

-- ----------------------------------------------------------------------------
-- 11 · Permissões: as peças novas fora da API; as recriadas com as de sempre
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_tiny_registro_data(text, jsonb) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_registro_sumir(text, text, text, text) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_produto_excluir(bigint, text) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_produtos_voltaram(bigint[]) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_marcar_inexistente(public.tiny_fila, text) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_conferencia_iniciar(text) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_conferencia_fechar(bigint) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_conferencia_acertar() from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_campos(jsonb) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_registrar(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_aqui(text, text, date, date) from public, anon, authenticated;
revoke all on function plt_privado.fn_tiny_pente_fino_iniciar(text) from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_por_produto() from public, anon, authenticated;
revoke all on function plt_privado.fn_eh_acabado_contado(bigint) from public, anon, authenticated;
revoke all on function public.fn_tiny_fila_resposta(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.plt_fn_tiny_fabrica_renovacao_reservar() from public, anon, authenticated;
