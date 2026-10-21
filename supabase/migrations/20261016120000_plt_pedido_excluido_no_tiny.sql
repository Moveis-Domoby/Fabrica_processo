-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 87 — PEDIDO EXCLUÍDO NO TINY SAI
-- DAS CONTAS DO COMERCIAL (SESSAO-32 · D-140, pedido do dono em 16/10/2026)
--
-- "Os valores de outubro no tiny e na plataforma estão diferentes, investigue
-- o motivo e resolva". Outubro: plataforma 128 pedidos / R$ 149.047,80; Tiny
-- 127 / R$ 134.995,90 — a diferença é EXATAMENTE o pedido 13622 (Loja Domoby,
-- 29 itens, R$ 14.051,90, "Em aberto", de 08/10), EXCLUÍDO no Tiny entre 08/10
-- 18:08 e 09/10 03:39 UTC. A conferência da madrugada relê os não terminados e
-- ouve do Tiny, toda noite desde 09/10, "codigo 32: Pedido não localizado"
-- (status 'vazio' na fila) — mas só contava "não encontrados": o pedido seguia
-- vivo aqui (no Comercial, na lista de Pedidos e com 32 cartões no PCP). O Tiny
-- não avisa exclusão.
--
-- Agora:
--   · plt_pedidos_excluidos_tiny — o pedido que o Tiny diz que não existe mais.
--     Marcado pela conferência; a marcação sai sozinha se uma conferência
--     seguinte o achar. Nada se apaga dos pedidos (a integração fica intacta).
--   · A conferência, ao fechar a rodada, aplica o veredito (o FATO — sem
--     relógio novo) e o resumo da rodada ganha a lista dos excluídos.
--   · E o pedido some de TODOS os módulos (D-140 — "fábrica e comercial devem
--     reagir às mesmas tabelas, aos mesmos dados (…) se o pedido não existe mais,
--     ele não deve aparecer em nenhum módulo"): os cartões dele saem dos quadros
--     (arquivados por evento, com o tempo aberto fechado e as peças reservadas
--     liberadas; admins avisados), as 8 portas que listam ou contam pedidos sem
--     passar pelos cartões não o enxergam mais (Pedidos, "Todos os pedidos" do
--     PCP, reserva do estoque pelo vendido, ranking e cortes das vendas, detalhe
--     do pedido, busca de vínculo, reservas presas do Tiny) e a tela pronta do
--     Comercial (migration 86) não o conta.
-- Nada nas colunas das tabelas da integração.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · A marcação
-- ----------------------------------------------------------------------------
create table if not exists public.plt_pedidos_excluidos_tiny (
  pedido_id     bigint primary key references public.pedidos(id) on delete cascade,
  tiny_id       bigint,
  numero        integer,
  erro          text,                                  -- o que o Tiny respondeu
  detectado_em  timestamptz not null default now(),    -- a 1ª conferência que não achou
  conferido_em  timestamptz not null default now()     -- a última que confirmou
);

comment on table public.plt_pedidos_excluidos_tiny is
  'SESSAO-32 (migration 87, D-140): pedido que o Tiny diz que não existe mais ("codigo 32: Pedido não localizado" na releitura da conferência). Sai das contas do Comercial; a marcação some se uma conferência seguinte achar o pedido. Nada se apaga de pedidos.';

alter table public.plt_pedidos_excluidos_tiny enable row level security;
revoke all on public.plt_pedidos_excluidos_tiny from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · O veredito da conferência: marca quem o Tiny não acha, desmarca quem
--     voltou a ser achado, e a tela pronta do Comercial acompanha
-- ----------------------------------------------------------------------------
-- Os cartões do pedido excluído saem de todos os quadros — o mesmo caminho do
-- "arquivar pedido" da plataforma (fn_arquivar_pedido), feito pelo sistema:
-- evento card_arquivado com origem 'api' — é a integração com o Tiny que diz que o
-- pedido não existe, como no "Entregue no Tiny" (fn_validar_api) —, tempo aberto fechado, peças do estoque
-- reservadas para ele liberadas, fora da programação do caminhão; admins avisados.
create or replace function plt_privado.fn_arquivar_pedido_excluido(p_pedido_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_numero    integer;
  v_card      bigint;
  v_evento    bigint;
  v_unidades  integer := 0;
  v_reservas  integer := 0;
  v_obs       text;
  v_dest      uuid[];
  v_d         uuid;
  r           record;
begin
  select p.numero into v_numero from public.pedidos p where p.id = p_pedido_id;
  v_obs := 'Pedido ' || coalesce(v_numero::text, '') || ' excluído no Tiny (a conferência não o achou) — sai de todos os quadros.';
  perform set_config('plt.estoque_maquinaria', 'on', true);

  for r in
    select c.id from public.plt_cards c
     where c.pedido_id = p_pedido_id and c.tipo <> 'pedido' and c.arquivado_em is null
     order by c.id
       for update
  loop
    perform plt_privado.fn_fechar_tempo_aberto(r.id, 'Pedido excluído no Tiny: o tempo aberto fecha antes.');
    insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
      values (r.id, 'card_arquivado', 'api', v_obs,
              jsonb_build_object('motivo', 'pedido_excluido_no_tiny', 'numero', v_numero));
    v_unidades := v_unidades + 1;
  end loop;

  for r in
    select c.id, c.setor_atual_id, c.reservada_item_seq, c.reservada_indice, c.produto_tiny_id
      from public.plt_cards c
     where c.reservada_pedido_id = p_pedido_id and c.arquivado_em is null
     order by c.id
       for update
  loop
    insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
      values (r.id, 'peca_reserva_desfeita', 'automacao', r.setor_atual_id,
              format('O pedido %s foi excluído no Tiny — a peça volta a ficar livre.', v_numero),
              jsonb_build_object('motivo', 'pedido_excluido_no_tiny', 'pedido_id', p_pedido_id,
                                 'numero', v_numero, 'item_seq', r.reservada_item_seq,
                                 'indice_unidade', r.reservada_indice, 'produto_tiny_id', r.produto_tiny_id));
    v_reservas := v_reservas + 1;
  end loop;

  select c.id into v_card from public.plt_cards c
   where c.pedido_id = p_pedido_id and c.tipo = 'pedido' and c.arquivado_em is null
   for update;
  if v_card is not null then
    -- fora da programação do caminhão (a remoção vai à trilha pelo gatilho dela)
    delete from public.plt_programacoes where card_id = v_card;
    insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
      values (v_card, 'card_arquivado', 'api', v_obs,
              jsonb_build_object('motivo', 'pedido_excluido_no_tiny', 'numero', v_numero,
                                 'unidades', v_unidades, 'reservas_desfeitas', v_reservas))
      returning id into v_evento;
    select coalesce(array_agg(u.id), '{}') into v_dest
      from public.plt_usuarios u where u.ativo and u.papel = 'admin';
    foreach v_d in array v_dest loop
      insert into public.plt_notificacoes (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
        values (v_d, v_evento, v_card, 'pedido_excluido_no_tiny',
                'Pedido ' || v_numero || ' excluído no Tiny',
                'O pedido ' || v_numero || ' não existe mais no Tiny e saiu de todos os quadros'
                || case when v_unidades > 0 then ' (com ' || v_unidades || ' unidade(s) que estavam na produção)' else '' end
                || '. Se alguma peça já existe de verdade, dê entrada dela no estoque.');
    end loop;
  end if;

  return jsonb_build_object('numero', v_numero, 'unidades', v_unidades,
                            'reservas_desfeitas', v_reservas, 'cartao_do_pedido', v_card is not null);
end;
$$;

revoke all on function plt_privado.fn_arquivar_pedido_excluido(bigint) from public, anon, authenticated;

create or replace function plt_privado.fn_pedidos_excluidos_aplicar()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_novos     bigint[];
  v_voltaram  bigint[];
  v_id        bigint;
begin
  -- o Tiny respondeu que o pedido não existe (erro terminal da releitura)
  with achados as (
    select p.id as pedido_id, p.tiny_id, p.numero, f.erro
      from public.tiny_fila f
      join public.pedidos p on p.tiny_id::text = f.chave
     where f.recurso = 'pedido' and f.status = 'vazio'
       and (f.erro ilike '%não localizad%' or f.erro ilike '%nao localizad%' or f.erro like 'codigo 32:%')
  ),
  gravados as (
    insert into public.plt_pedidos_excluidos_tiny as x (pedido_id, tiny_id, numero, erro)
    select a.pedido_id, a.tiny_id, a.numero, a.erro from achados a
    on conflict (pedido_id) do update set conferido_em = now(), erro = excluded.erro
    returning x.pedido_id, (x.xmax = 0) as novo
  )
  select coalesce(array_agg(g.pedido_id) filter (where g.novo), '{}') into v_novos from gravados g;

  -- achado de novo numa conferência seguinte: a marcação sai
  with voltaram as (
    delete from public.plt_pedidos_excluidos_tiny x
     using public.pedidos p, public.tiny_fila f
     where p.id = x.pedido_id
       and f.recurso = 'pedido' and f.chave = p.tiny_id::text and f.status = 'ok'
    returning x.pedido_id
  )
  select coalesce(array_agg(v.pedido_id), '{}') into v_voltaram from voltaram v;

  -- a fábrica: os cartões de quem acabou de ser marcado saem de todos os quadros
  -- (cada pedido no seu bloco — um problema num não segura os outros)
  foreach v_id in array v_novos loop
    begin
      perform plt_privado.fn_arquivar_pedido_excluido(v_id);
    exception when others then
      raise warning 'Pedido excluído no Tiny (%): cartões não arquivados agora: %', v_id, sqlerrm;
    end;
  end loop;

  -- a tela pronta do Comercial acompanha (o pedido sai / volta)
  foreach v_id in array (v_novos || v_voltaram) loop
    perform plt_privado.fn_comercial_refazer_pedido(v_id);
  end loop;

  -- a trilha (o sistema): quem saiu e quem voltou
  if cardinality(v_novos) > 0 then
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    select null, 'pedido_excluido_no_tiny',
           jsonb_build_object('pedidos', jsonb_agg(p.numero order by p.numero), 'motivo', 'a conferência com o Tiny não achou o pedido')
      from public.pedidos p where p.id = any(v_novos);
  end if;
  if cardinality(v_voltaram) > 0 then
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    select null, 'pedido_voltou_no_tiny',
           jsonb_build_object('pedidos', jsonb_agg(p.numero order by p.numero), 'motivo', 'a conferência com o Tiny achou o pedido de novo')
      from public.pedidos p where p.id = any(v_voltaram);
  end if;

  return jsonb_build_object(
    'pedidos', coalesce((select jsonb_agg(x.numero order by x.numero desc) from public.plt_pedidos_excluidos_tiny x), '[]'::jsonb),
    'novos', cardinality(v_novos),
    'voltaram', cardinality(v_voltaram));
end;
$$;

comment on function plt_privado.fn_pedidos_excluidos_aplicar() is
  'D-140: aplica o veredito da conferência com o Tiny — pedido "não localizado" vira excluído no Tiny (sai do Comercial); achado de novo, volta. Chamada ao fechar a rodada (fn_tiny_pente_fino_resumir) e na aplicação da migration 87.';

revoke all on function plt_privado.fn_pedidos_excluidos_aplicar() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3 · O fechamento da rodada da conferência — recriado POR INTEIRO a partir da
--     versão viva (a da migration 65, conferida igual no banco em 16/10 — E-24)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plt_privado.fn_tiny_pente_fino_resumir(p_rodada text, p_estado text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_busca  jsonb;
  v_resumo jsonb;
  v_excl   jsonb;
begin
  -- ↪️ migration 87 (D-140): o pedido que o Tiny diz que não existe mais sai das
  -- contas (e volta se uma conferência seguinte o achar). Num bloco próprio: um
  -- erro aqui nunca impede o fechamento da rodada.
  begin
    v_excl := plt_privado.fn_pedidos_excluidos_aplicar();
  exception when others then
    v_excl := jsonb_build_object('erro', left(sqlerrm, 300));
  end;

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
           -- ↪️ migration 87: quem o Tiny diz que não existe mais (fora das contas)
           'excluidos_no_tiny', coalesce(v_excl, '{}'::jsonb),
           'falhas',          (select count(*) from linhas where status = 'erro'),
           'pendentes',       (select count(*) from linhas where status in ('pendente', 'processando')),
           'contas',          jsonb_build_object(
              'paginas_busca',   (select count(*) from linhas where recurso = 'cr_pesquisa'),
              'relidas',         (select count(*) from contas_rodada where status = 'ok'),
              'novas',           (select count(*) from contas_rodada where status = 'ok'
                                     and coalesce((params->>'nova')::boolean, false)),
              -- ↪️ migration 65: só a conta que JÁ estava aqui e virou paga (a nova que
              -- chega paga não "foi paga" desde a última conferência). Nome novo de
              -- propósito: o resumo de 09/10 00:39 (com o "pagas" antigo) fica como está.
              'viraram_pagas',   (select count(*) from contas_rodada where status = 'ok'
                                     and not coalesce((params->>'nova')::boolean, false)
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

-- ----------------------------------------------------------------------------
-- 4 · A linha da venda do Comercial (migration 86) sem o pedido excluído no Tiny
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_comercial_vendas_de(p_ids bigint[])
returns table (
  pedido_id bigint, id uuid, numero_pedido varchar, nome_cliente varchar, telefone_cliente varchar,
  cid text, telefone_digitos text, telefone_normalizado text, data_compra timestamptz, mes text,
  valor_pedido numeric(10,2), numero_itens integer, itens_comprados jsonb, item_nomes text[], created_at timestamptz
)
language sql
stable
set search_path = public, pg_temp
as $$
  select b.pedido_id, b.id, b.numero_pedido, b.nome_cliente, b.telefone_cliente,
         coalesce(nullif(trim(b.telefone_cliente), ''), b.nome_cliente::text),
         regexp_replace(b.telefone_cliente, '\D', '', 'g'),
         case
           when length(regexp_replace(coalesce(b.telefone_cliente, ''), '\D', '', 'g')) > 11
                and regexp_replace(coalesce(b.telefone_cliente, ''), '\D', '', 'g') like '55%'
             then substring(regexp_replace(coalesce(b.telefone_cliente, ''), '\D', '', 'g') from 3)
           else regexp_replace(coalesce(b.telefone_cliente, ''), '\D', '', 'g')
         end,
         b.data_compra,
         to_char(b.data_compra at time zone 'America/Sao_Paulo', 'YYYY-MM'),
         b.valor_pedido, b.numero_itens, b.itens_comprados,
         plt_privado.fn_comercial_itens_nomes(b.itens_comprados),
         b.created_at
    from (
      select p.id                                                           as pedido_id,
             md5('vendas_marketing:' || p.numero)::uuid                     as id,
             p.numero::varchar                                              as numero_pedido,
             (p.raw->'cliente'->>'nome')::varchar                           as nome_cliente,
             coalesce(nullif(trim(c.fone), ''),
                      nullif(trim(c.raw->>'celular'), ''))::varchar         as telefone_cliente,
             (p.data_pedido::timestamp) at time zone 'America/Sao_Paulo'    as data_compra,
             p.total_pedido::numeric(10,2)                                  as valor_pedido,
             coalesce(jsonb_array_length(p.raw->'itens'), 0)::integer       as numero_itens,
             coalesce(
               (select jsonb_agg(jsonb_build_object(
                         'produto',       jsonb_build_object('descricao', e->'item'->>'descricao'),
                         'quantidade',    (e->'item'->>'quantidade')::numeric,
                         'valorUnitario', (e->'item'->>'valor_unitario')::numeric))
                  from jsonb_array_elements(p.raw->'itens') e),
               '[]'::jsonb)                                                 as itens_comprados,
             p.criado_em                                                    as created_at
        from public.pedidos p
        left join public.clientes c on c.id = p.cliente_id
       where (p_ids is null or p.id = any(p_ids))
         -- ↪️ migration 87 (D-140): pedido excluído no Tiny não é venda
         and not exists (select 1 from public.plt_pedidos_excluidos_tiny x where x.pedido_id = p.id)
    ) b;
$$;

revoke all on function plt_privado.fn_comercial_vendas_de(bigint[]) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4b · As portas que listam ou contam pedidos sem passar pelos cartões: só o
--      pedido que existe no Tiny (os cartões do excluído já saíram dos quadros)
-- ----------------------------------------------------------------------------
-- public.plt_fn_pedidos_lista — recriada POR INTEIRO a partir da versão viva de 16/10 (E-24); 15 leitura(s) de pedidos
-- passam a ver só o pedido que existe no Tiny
-- SESSAO-38 (E-17): a 20261022020100 muda a forma da lista (colunas da programação) — drop antes.
drop function if exists public.plt_fn_pedidos_lista(text, integer, integer, boolean);
CREATE OR REPLACE FUNCTION public.plt_fn_pedidos_lista(p_busca text DEFAULT NULL::text, p_antes_numero integer DEFAULT NULL::integer, p_limite integer DEFAULT 20, p_cancelados boolean DEFAULT false)
 RETURNS TABLE(pedido_id bigint, numero integer, cliente_nome text, data_pedido date, data_prevista date, situacao text, total_pedido numeric, vendedor text, marcadores text[], total_unidades integer, unidades_liberadas integer, unidades_prontas integer, card_id bigint, situacao_plataforma text, entregue_em timestamp with time zone, entregue_por text, entregue_fonte text, entregue_tiny text, cancelado_em timestamp with time zone, tem_mais boolean, contagem_total integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare
  v_lim   integer := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_busca text    := nullif(btrim(coalesce(p_busca, '')), '');
  v_canc  boolean := coalesce(p_cancelados, false);
  -- só dígitos, sem zero na frente: o "número que começa com" vira faixas
  v_num   bigint  := case when nullif(btrim(coalesce(p_busca, '')), '') ~ '^[1-9][0-9]{0,8}$'
                          then btrim(p_busca)::bigint end;
  v_ids   bigint[];
  v_total integer;
  v_teto  bigint;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    return;  -- como antes: sem acesso, lista vazia
  end if;

  -- 1 · a página (limite + 1, para saber se tem mais), por um caminho por caso
  if v_busca is null and not v_canc then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
       where (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  elsif v_busca is null then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
       where plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
         and (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  else
    -- 1ª tentativa: só os 5.000 números mais recentes, do jeito de sempre (o
    -- filtro com OU, parando na página cheia) — termo COMUM acha a página aí e
    -- para cedo. Achou a página inteira (limite + 1) → é exatamente a de antes:
    -- qualquer outro pedido que case tem número menor que todos da janela.
    v_teto := coalesce(p_antes_numero, (select max(pm.numero) from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) pm) + 1);
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero
        from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
        left join public.clientes c on c.id = p.cliente_id
       where p.numero >= v_teto - 5000
         and p.numero < v_teto
         and (p.numero::text like v_busca || '%'
              or c.nome ilike '%' || v_busca || '%'
              or p.vendedor ilike '%' || v_busca || '%')
         and (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
       order by p.numero desc limit v_lim + 1) x;
  end if;
  -- termo RARO (a janela não encheu a página): os caminhos que os índices usam
  if v_busca is not null and cardinality(v_ids) <= v_lim then
    select coalesce(array_agg(x.id order by x.numero desc), '{}') into v_ids from (
      select p.id, p.numero
        from (-- o número que começa com o texto: só dígitos (sem zero na frente) viram
              -- faixas [x·10^k, (x+1)·10^k) — o índice do número anda em cada uma
              select p1.id
                from generate_series(0, greatest(0, 10 - length(v_busca))) as k(e)
                join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p1
                  on p1.numero >= v_num * (10::bigint ^ k.e)::bigint
                 and p1.numero <  (v_num + 1) * (10::bigint ^ k.e)::bigint
               where v_num is not null
              union
              select p2.id from public.clientes c2 join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p2 on p2.cliente_id = c2.id
               where c2.nome ilike '%' || v_busca || '%'
              union
              select p3.id from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p3 where p3.vendedor ilike '%' || v_busca || '%') alvo
        join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p on p.id = alvo.id
       where (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
         and (p_antes_numero is null or p.numero < p_antes_numero)
       order by p.numero desc limit v_lim + 1) x;
  end if;

  -- 2 · o total, só na 1ª página (até 10.001), pelo mesmo caminho
  if p_antes_numero is null then
    if v_busca is null and not v_canc then
      select count(*)::int into v_total from (select 1 from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p limit 10001) x;
    elsif v_busca is null then
      select count(*)::int into v_total from (
        select 1 from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
         where plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado' limit 10001) x;
    else
      select count(*)::int into v_total from (
        select 1
          from (select p1.id
                  from generate_series(0, greatest(0, 10 - length(v_busca))) as k(e)
                  join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p1
                    on p1.numero >= v_num * (10::bigint ^ k.e)::bigint
                   and p1.numero <  (v_num + 1) * (10::bigint ^ k.e)::bigint
                 where v_num is not null
                union
                select p2.id from public.clientes c2 join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p2 on p2.cliente_id = c2.id
                 where c2.nome ilike '%' || v_busca || '%'
                union
                select p3.id from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p3 where p3.vendedor ilike '%' || v_busca || '%') alvo
          join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p on p.id = alvo.id
         where (not v_canc or plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado')
         limit 10001) x;
    end if;
  end if;

  -- 3 · o que cada linha mostra — a projeção de sempre, sobre a página achada
  return query
  with pagina as (
    select p.id, p.numero, p.cliente_id, p.data_pedido, p.data_prevista, p.situacao,
           p.total_pedido, p.vendedor, p.marcadores, nullif(p.raw ->> 'data_entrega', '') as entregue_tiny,
           c.nome as cliente_nome
      from unnest(v_ids) with ordinality as u(id, ord)
      join (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p on p.id = u.id
      left join public.clientes c on c.id = p.cliente_id
     order by u.ord
  ),
  numerada as (
    select pg.*, row_number() over (order by pg.numero desc) as n from pagina pg
  )
  select nu.id                                   as pedido_id,
         nu.numero,
         coalesce(nu.cliente_nome, '')           as cliente_nome,
         nu.data_pedido,
         nu.data_prevista,
         nu.situacao,
         nu.total_pedido,
         nullif(btrim(coalesce(nu.vendedor, '')), '') as vendedor,
         coalesce(nu.marcadores, '{}')           as marcadores,
         coalesce(i.total_unidades, 0)           as total_unidades,
         coalesce(u.liberadas, 0)                as unidades_liberadas,
         coalesce(u.prontas, 0)                  as unidades_prontas,
         pc.id                                   as card_id,
         case
           when plt_privado.fn_situacao_normalizada(nu.situacao) = 'cancelado' then 'cancelado'
           when pc.id is null then 'sem_card'
           when pc.devolucao_evento_id is not null then 'devolvido'
           when pc.entrega_evento_id is not null then 'entregue'
           when pc.arquivado_em is not null then 'arquivado'
           when pc.lancado_rotas_em is not null then 'em_rota'
           when coalesce(i.total_unidades, 0) > 0 and coalesce(u.prontas, 0) >= i.total_unidades then 'aguardo'
           when coalesce(u.liberadas, 0) > 0 then 'producao'
           -- D-132: o Tiny já levou adiante e nada foi liberado — segue o Tiny.
           when plt_privado.fn_tiny_tirou_do_pcp(nu.situacao) then 'tiny'
           else 'pcp'
         end                                     as situacao_plataforma,
         ent.ocorrido_em                         as entregue_em,
         ue.nome                                 as entregue_por,
         case when ent.id is null then null
              else coalesce(ent.dados ->> 'fonte', case when ent.usuario_id is null then 'tiny' else 'plataforma' end)
         end                                     as entregue_fonte,
         nu.entregue_tiny,
         canc.ocorrido_em                        as cancelado_em,
         (select count(*) from pagina) > v_lim       as tem_mais,
         v_total                                 as contagem_total
    from numerada nu
    left join public.plt_cards pc on pc.pedido_id = nu.id and pc.tipo = 'pedido'
    left join public.plt_eventos ent on ent.id = pc.entrega_evento_id
    left join public.plt_usuarios ue on ue.id = ent.usuario_id
    left join lateral (
      select min(e.ocorrido_em) as ocorrido_em
        from public.plt_eventos e
       where pc.id is not null and e.card_id = pc.id and e.tipo = 'pedido_cancelado'
    ) canc on true
    left join lateral (
      -- D-63: o frete não conta como unidade.
      select coalesce(sum(v.unidades), 0)::int as total_unidades
        from plt_privado.vw_itens_producao v
       where v.pedido_id = nu.id
    ) i on true
    left join lateral (
      select count(*)::int as liberadas,
             count(*) filter (where cu.concluido_em is not null)::int as prontas
        from public.plt_cards cu
       where cu.tipo = 'unidade'
         and (cu.pedido_id = nu.id or (pc.id is not null and cu.card_pai_id = pc.id))
    ) u on true
   where nu.n <= v_lim
   order by nu.numero desc;
end;
$function$;

-- public.plt_fn_pcp_todos_pedidos — recriada POR INTEIRO a partir da versão viva de 16/10 (E-24); 2 leitura(s) de pedidos
-- passam a ver só o pedido que existe no Tiny
CREATE OR REPLACE FUNCTION public.plt_fn_pcp_todos_pedidos(p_busca text DEFAULT NULL::text, p_antes_numero integer DEFAULT NULL::integer, p_limite integer DEFAULT 20)
 RETURNS TABLE(pedido_id bigint, numero integer, cliente_nome text, data_pedido date, data_prevista date, situacao text, total_unidades integer, unidades_liberadas integer, alterado_apos_liberacao boolean, card_id bigint, situacao_plataforma text, tem_mais boolean, contagem_total integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with cfg as (
    select least(greatest(coalesce(p_limite, 20), 1), 100) as limite,
           nullif(btrim(coalesce(p_busca, '')), '')       as busca
  ),
  pagina as (
    select p.id, p.numero, p.cliente_id, p.data_pedido, p.data_prevista, p.situacao,
           c.nome as cliente_nome
      from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
      left join public.clientes c on c.id = p.cliente_id
      cross join cfg
     where plt_privado.fn_pode_ver_expedicao()
       and (p_antes_numero is null or p.numero < p_antes_numero)
       and (cfg.busca is null
            or p.numero::text like cfg.busca || '%'
            or c.nome ilike '%' || cfg.busca || '%')
     order by p.numero desc
     limit (select limite + 1 from cfg)
  ),
  numerada as (
    select pg.*, row_number() over (order by pg.numero desc) as n from pagina pg
  )
  select nu.id                                   as pedido_id,
         nu.numero,
         coalesce(nu.cliente_nome, '')           as cliente_nome,
         nu.data_pedido,
         nu.data_prevista,
         nu.situacao,
         coalesce(i.total_unidades, 0)           as total_unidades,
         coalesce(u.liberadas, 0)                as unidades_liberadas,
         exists (select 1 from public.plt_eventos e
                  where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                                 as alterado_apos_liberacao,
         pc.id                                   as card_id,
         case
           when pc.id is null then 'sem_card'
           when pc.devolucao_evento_id is not null then 'devolvido'  -- SESSAO-31 (D-129)
           when pc.entrega_evento_id is not null then 'entregue'
           when pc.arquivado_em is not null then 'arquivado'
           when pc.lancado_rotas_em is not null then 'em_rota'
           when coalesce(i.total_unidades, 0) > 0 and coalesce(u.prontas, 0) >= i.total_unidades then 'aguardo'
           when coalesce(u.liberadas, 0) > 0 then 'producao'
           else 'pcp'
         end                                     as situacao_plataforma,
         (select count(*) from pagina) > (select limite from cfg) as tem_mais,
         case when p_antes_numero is null then (
           select count(*)::int from (
             select 1
               from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p2
               left join public.clientes c2 on c2.id = p2.cliente_id
               cross join cfg
              where cfg.busca is null
                 or p2.numero::text like cfg.busca || '%'
                 or c2.nome ilike '%' || cfg.busca || '%'
              limit 10001) x
         ) end                                   as contagem_total
    from numerada nu
    left join public.plt_cards pc on pc.pedido_id = nu.id and pc.tipo = 'pedido'
    left join lateral (
      -- D-63: o frete não conta como unidade (vw_itens_producao).
      select coalesce(sum(v.unidades), 0)::int as total_unidades
        from plt_privado.vw_itens_producao v
       where v.pedido_id = nu.id
    ) i on true
    left join lateral (
      select count(*) filter (where not exists (select 1 from plt_privado.vw_itens_producao v
                                                 where v.pedido_id = cu.pedido_id and v.seq = cu.item_seq and v.eh_frete))::int
               as liberadas,
             count(*) filter (where cu.arquivado_em is null and s.papel_no_fluxo = 'terminal')::int
               as prontas
        from public.plt_cards cu
        left join public.plt_setores s on s.id = cu.setor_atual_id
       where cu.pedido_id = nu.id and cu.tipo = 'unidade'
    ) u on true
   where nu.n <= (select limite from cfg)
   order by nu.numero desc;
$function$;

-- plt_privado.fn_estoque_reservas_loja — recriada POR INTEIRO a partir da versão viva de 16/10 (E-24); 1 leitura(s) de pedidos
-- passam a ver só o pedido que existe no Tiny
CREATE OR REPLACE FUNCTION plt_privado.fn_estoque_reservas_loja()
 RETURNS TABLE(tiny_id bigint, quantidade numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select plt_privado.fn_produto_do_item(pi.codigo, pi.descricao), sum(pi.quantidade)
    from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
    join public.pedido_itens pi on pi.pedido_id = p.id
   where p.situacao in ('Em aberto', 'Aberto', 'Aprovado', 'Preparando envio',
                        'em_aberto', 'aberto', 'aprovado', 'preparando_envio')
     and plt_privado.fn_situacao_reserva_estoque(p.situacao)
     and not plt_privado.fn_eh_personalizado(pi.descricao)
   group by 1;
$function$;

-- plt_privado.fn_vendas_90d — recriada POR INTEIRO a partir da versão viva de 16/10 (E-24); 1 leitura(s) de pedidos
-- passam a ver só o pedido que existe no Tiny
CREATE OR REPLACE FUNCTION plt_privado.fn_vendas_90d()
 RETURNS TABLE(tiny_id bigint, codigo text, vendidos numeric, posicao integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with corte as (
    select plt_privado.fn_estoque_corte() as maximo
  ),
  por_sku as (
    select distinct on (pr.codigo) pr.codigo, pr.tiny_id
      from public.produtos pr
     where pr.codigo is not null and pr.situacao = 'A'
       and pr.tipo_estoque_efetivo = 'movel'
     order by pr.codigo, pr.tiny_id
  ),
  vendas as (
    select ps.tiny_id, ps.codigo, sum(pi.quantidade) as vendidos
      from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
      join public.pedido_itens pi on pi.pedido_id = p.id
      join por_sku ps on ps.codigo = pi.codigo
      cross join corte
     where p.data_pedido >= (now() at time zone 'America/Fortaleza')::date - 90
       and plt_privado.fn_situacao_normalizada(p.situacao) <> 'cancelado'
       and not plt_privado.fn_eh_personalizado(pi.descricao)
       and pi.quantidade <= corte.maximo
     group by ps.tiny_id, ps.codigo
  )
  select v.tiny_id, v.codigo, v.vendidos,
         row_number() over (order by v.vendidos desc, v.codigo, v.tiny_id)::int as posicao
    from vendas v
   where v.vendidos > 0;
$function$;

-- plt_privado.fn_estoque_cortes_90d — recriada POR INTEIRO a partir da versão viva de 16/10 (E-24); 1 leitura(s) de pedidos
-- passam a ver só o pedido que existe no Tiny
CREATE OR REPLACE FUNCTION plt_privado.fn_estoque_cortes_90d()
 RETURNS TABLE(tiny_id bigint, cortes integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with corte as (
    select plt_privado.fn_estoque_corte() as maximo
  ),
  por_sku as (
    select distinct on (pr.codigo) pr.codigo, pr.tiny_id
      from public.produtos pr
     where pr.codigo is not null and pr.situacao = 'A'
       and pr.tipo_estoque_efetivo = 'movel'
     order by pr.codigo, pr.tiny_id
  )
  select ps.tiny_id, count(*)::int as cortes
    from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
    join public.pedido_itens pi on pi.pedido_id = p.id
    join por_sku ps on ps.codigo = pi.codigo
    cross join corte
   where p.data_pedido >= (now() at time zone 'America/Fortaleza')::date - 90
     and plt_privado.fn_situacao_normalizada(p.situacao) <> 'cancelado'
     and not plt_privado.fn_eh_personalizado(pi.descricao)
     and pi.quantidade > corte.maximo
   group by ps.tiny_id;
$function$;

-- public.plt_fn_pedido_tiny — recriada POR INTEIRO a partir da versão viva de 16/10 (E-24); 1 leitura(s) de pedidos
-- passam a ver só o pedido que existe no Tiny
CREATE OR REPLACE FUNCTION public.plt_fn_pedido_tiny(p_pedido_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_resultado jsonb;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Os dados do Tiny do pedido são da logística (PCP, fins de linha) e do admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select jsonb_build_object(
           'pedido', p.raw,
           'atualizado_em', p.atualizado_em,
           'cliente', c.raw,
           'notas_fiscais', coalesce((select jsonb_agg(nf.raw order by nf.data_emissao, nf.id)
                                        from public.notas_fiscais nf where nf.pedido_id = p.id), '[]'::jsonb),
           'contas_receber', coalesce((select jsonb_agg(cr.raw order by cr.data_vencimento, cr.id)
                                         from public.contas_receber cr where cr.pedido_id = p.id), '[]'::jsonb))
    into v_resultado
    from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
    left join public.clientes c on c.id = p.cliente_id
   where p.id = p_pedido_id;
  if v_resultado is null then
    raise exception 'Pedido % não existe.', p_pedido_id using errcode = 'no_data_found';
  end if;
  return v_resultado;
end;
$function$;

-- public.plt_fn_vinculo_buscar — recriada POR INTEIRO a partir da versão viva de 16/10 (E-24); 2 leitura(s) de pedidos
-- passam a ver só o pedido que existe no Tiny
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

-- public.plt_fn_tiny_reservas_presas — recriada POR INTEIRO a partir da versão viva de 16/10 (E-24); 1 leitura(s) de pedidos
-- passam a ver só o pedido que existe no Tiny
CREATE OR REPLACE FUNCTION public.plt_fn_tiny_reservas_presas(p_limite integer DEFAULT 10, p_deslocamento integer DEFAULT 0)
 RETURNS TABLE(tiny_id bigint, codigo text, descricao text, saldo_tiny numeric, reservado_tiny numeric, pedidos_abertos numeric, presas numeric, lido_em timestamp with time zone, contagem_total bigint, total_presas numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with leituras as (
    -- a leitura mais nova que traz o reservado (leitura da fila ou carga)
    select distinct on (x.tiny_id) x.*
      from (
        select (e.payload -> 'dados' ->> 'idProduto')::bigint                         as tiny_id,
               plt_privado.fn_tiny_numero(e.payload -> 'dados' ->> 'saldo')           as saldo,
               plt_privado.fn_tiny_numero(e.payload -> 'dados' ->> 'saldoReservado')  as reservado,
               e.recebido_em,
               e.id
          from public.eventos e
         where e.tipo = 'estoque_fabrica'
           and e.payload ->> 'cnpj' = '27556613000166'
           and e.payload ->> 'origem' in ('leitura', 'carga_inicial')
           and (e.payload -> 'dados' ->> 'idProduto') ~ '^[0-9]+$'
      ) x
     where x.reservado is not null
     order by x.tiny_id, x.id desc
  ),
  abertos as (
    -- unidades de pedidos da loja que ainda não saíram (o que o Tiny DEVIA reservar)
    select pi.codigo, sum(pi.quantidade) as quantidade
      from (select * from public.pedidos where not exists (select 1 from public.plt_pedidos_excluidos_tiny xx where xx.pedido_id = pedidos.id)) p
      join public.pedido_itens pi on pi.pedido_id = p.id
     where plt_privado.fn_situacao_normalizada(p.situacao) not in ('entregue', 'nao_entregue', 'cancelado')
       and not plt_privado.fn_eh_personalizado(pi.descricao)
       and pi.codigo is not null
     group by pi.codigo
  ),
  presas as (
    select pr.tiny_id, pr.codigo, pr.descricao, l.saldo, l.reservado,
           coalesce(a.quantidade, 0)               as abertos,
           l.reservado - coalesce(a.quantidade, 0) as presas,
           l.recebido_em
      from leituras l
      join public.produtos pr on pr.tiny_id = l.tiny_id
      left join abertos a on a.codigo = pr.codigo
     where pr.situacao = 'A'
       and pr.tipo_estoque_efetivo = 'movel'
       and not plt_privado.fn_eh_personalizado(pr.descricao)
       -- serviço do Tiny (Corte, Furo, Fitamento…) não é móvel: a reserva
       -- dele não mexe no disponível que a equipe olha (achado na 1ª leitura
       -- real: 8 serviços com 22 mil "reservas")
       and coalesce(pr.raw ->> 'tipo', 'P') <> 'S'
       -- sem SKU não dá para comparar com os pedidos (o pedido chega por SKU)
       and pr.codigo is not null
       and l.reservado > coalesce(a.quantidade, 0)
  )
  select p.tiny_id, p.codigo, p.descricao, p.saldo, p.reservado, p.abertos, p.presas, p.recebido_em,
         count(*) over (), sum(p.presas) over ()
    from presas p
   where plt_privado.fn_pode_ver_expedicao()
   order by p.presas desc, p.codigo nulls last, p.tiny_id
   limit least(greatest(coalesce(p_limite, 10), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$function$;

-- ----------------------------------------------------------------------------
-- 5 · Agora: o veredito das conferências que já rodaram (o 13622 sai de tudo)
-- ----------------------------------------------------------------------------
do $$
begin
  perform plt_privado.fn_pedidos_excluidos_aplicar();
end;
$$;
