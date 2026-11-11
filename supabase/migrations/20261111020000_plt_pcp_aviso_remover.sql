-- ============================================================================
-- SESSAO-48 · FRENTE 2 — a vaga do pedido volta ao PCP com aviso, e o PCP decide
-- ============================================================================
-- O que a base (20261111010000) já faz: o aviso no card do PEDIDO (pcp_aviso_em
-- — abre com a peça de pedido vivo cancelada na produção; fecha com
-- pcp_aviso_resolvido, pedido_removido_pcp, a liberação completa ou a peça que
-- volta ao pedido), o selo no quadro do PCP (pedido_resumo.aviso_cancelada), o
-- sino do PCP, a projeção da remoção (removido_pcp_*) e a regra única do PCP
-- (fn_fora_do_pcp) em todas as portas.
--
-- Esta migration dá ao PCP a decisão (resposta 3 do dono, 11/11 01:33 — "um
-- aviso nessa peça/pedido para o PCP ver o que aconteceu e dentro desse aviso
-- ele pode remover de PCP e selecionar se o pedido foi cancelado, se ele quer
-- remover o pedido da linha de produção definindo o que houve com ele ou algum
-- outro motivo"):
--   · a janela "O que aconteceu?" lê numa requisição (plt_fn_pcp_aviso): o
--     pedido, o aviso, as peças canceladas ou não encontradas (de qual coluna,
--     quem e quando — também as que a limpeza já arquivou), o que o pedido ainda
--     tem em produção ou pronto e quantas vagas estão abertas;
--   · "Produzir de novo" (plt_fn_pcp_aviso_resolver) fecha o aviso — o pedido
--     segue no PCP para liberar pela janela "Liberar unidades" de sempre;
--   · "Remover do PCP" (plt_fn_pcp_remover), com o motivo: o pedido foi
--     cancelado · tirar da linha de produção (o que houve — obrigatório) · outro
--     (obrigatório). Não muda o Tiny nem as peças já em produção ou prontas — a
--     resposta diz quantas e onde, para a tela avisar;
--   · "Devolver ao PCP" (plt_fn_pcp_devolver) desfaz a remoção;
--   · a aba "Cancelados e removidos" do PCP (plt_fn_pedidos_cancelados — a porta
--     da antiga aba Cancelados do PCP, agora por cursor): os cancelados no Tiny e
--     os removidos do PCP, cada um com o motivo, quem removeu e quando.
-- Gestos idempotentes (tocar duas vezes = um efeito); a pessoa é conferida por
-- dentro — PCP, logística ou admin: a mesma régua de liberar
-- (fn_pode_ver_expedicao). Os fatos vão pela marca da maquinaria do aviso
-- (plt.pcp_aviso_maquinaria — a validação da base recusa o resto).
-- ============================================================================
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O que o pedido ainda tem (as peças com o pedido, fora do arquivo): onde
--     estão e quantas — a janela mostra, e "Remover do PCP" devolve para a tela
--     avisar (as peças não mudam ao remover)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_pcp_pecas_do_pedido(p_pedido_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with pecas as (
    select s.id as setor_id, s.nome as setor, s.ordem as s_ordem, s.papel_no_fluxo as papel,
           et.id as etapa_id, et.nome as etapa, et.ordem as e_ordem, count(*)::int as n
      from public.plt_cards u
      left join public.plt_setores s on s.id = u.setor_atual_id
      left join public.plt_etapas et on et.id = u.etapa_atual_id
     where u.pedido_id = p_pedido_id and u.tipo = 'unidade' and u.arquivado_em is null
     group by s.id, s.nome, s.ordem, s.papel_no_fluxo, et.id, et.nome, et.ordem
  )
  select jsonb_build_object(
           -- a mesma régua do que conta (fn_estoque_categoria): pronta = num fim de
           -- linha (aguardo; ROTAS até a entrega); o resto ainda está na produção
           'em_producao', coalesce(sum(p.n) filter (where p.papel is distinct from 'terminal'), 0)::int,
           'prontas',     coalesce(sum(p.n) filter (where p.papel = 'terminal'), 0)::int,
           'onde', coalesce(jsonb_agg(jsonb_build_object('setor', p.setor, 'etapa', p.etapa,
                                                          'pronta', p.papel = 'terminal', 'pecas', p.n)
                                      order by p.s_ordem nulls last, p.setor_id, p.e_ordem nulls last, p.etapa_id),
                            '[]'::jsonb))
    from pecas p;
$$;

comment on function plt_privado.fn_pcp_pecas_do_pedido(bigint) is
  'SESSAO-48 (frente 2): as peças que ainda carregam o pedido (fora do arquivo) — quantas em produção, quantas prontas (fim de linha) e onde (setor e etapa). A janela "O que aconteceu?" mostra; "Remover do PCP" devolve (as peças não mudam ao remover).';
revoke all on function plt_privado.fn_pcp_pecas_do_pedido(bigint) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · A janela "O que aconteceu?" — uma requisição ao abrir
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pcp_aviso(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card     public.plt_cards%rowtype;
  v_pedido   public.pedidos%rowtype;
  v_cliente  text;
  v_vagas    integer;
  v_abertas  integer;
  v_lista    jsonb;
  v_total    integer;
  v_por      text;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'O aviso da peça cancelada é do PCP, da logística ou do admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id;
  if v_card.id is null or v_card.tipo <> 'pedido' then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select * into v_pedido from public.pedidos where id = v_card.pedido_id;
  select c.nome into v_cliente from public.clientes c where c.id = v_pedido.cliente_id;

  -- as vagas do pedido (a regra de sempre — fn_vagas_pedido): abertas = sem peça
  select count(*)::int, (count(*) filter (where w.card_id is null))::int
    into v_vagas, v_abertas
    from plt_privado.fn_vagas_pedido(v_card.pedido_id) w;

  -- as peças com a fabricação cancelada que eram deste pedido (também as que a
  -- limpeza dos N dias já arquivou): de qual coluna, quem e quando — pelo último
  -- fato fabricacao_cancelada (a troca CANCELADO ↔ NÃO ENCONTRADO grava outro)
  select count(*)::int into v_total
    from public.plt_cards u
   where u.cancelada_pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.cancelada_em is not null;
  select coalesce(jsonb_agg(x.linha order by x.quando desc, x.id desc), '[]'::jsonb) into v_lista
    from (
      select u.id, coalesce(f.ocorrido_em, u.cancelada_em) as quando,
             jsonb_build_object(
               'card_id',      u.id,
               'descricao',    u.item_descricao,
               'sku',          u.item_codigo,
               'indice',       u.indice_unidade,
               'total',        u.total_unidades,
               'motivo',       u.cancelada_motivo,
               'setor',        coalesce(f.dados ->> 'setor', s.nome),
               'etapa',        coalesce(f.dados ->> 'etapa', et.nome),
               'quem',         uq.nome,
               'quando',       coalesce(f.ocorrido_em, u.cancelada_em),
               'cancelada_em', u.cancelada_em,
               'arquivada',    u.arquivado_em is not null,
               -- a peça é do aviso de agora (cancelada depois que ele abriu)
               'nova',         v_card.pcp_aviso_em is not null and u.cancelada_em >= v_card.pcp_aviso_em) as linha
        from public.plt_cards u
        left join public.plt_setores s on s.id = u.setor_atual_id
        left join public.plt_etapas et on et.id = u.etapa_atual_id
        left join lateral (
          select e.ocorrido_em, e.usuario_id, e.dados
            from public.plt_eventos e
           where e.card_id = u.id and e.tipo = 'fabricacao_cancelada'
           order by e.ocorrido_em desc, e.id desc
           limit 1
        ) f on true
        left join public.plt_usuarios uq on uq.id = f.usuario_id
       where u.cancelada_pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.cancelada_em is not null
       order by u.cancelada_em desc, u.id desc
       limit 100
    ) x;

  if v_card.removido_pcp_evento_id is not null then
    select uu.nome into v_por
      from public.plt_eventos e
      join public.plt_usuarios uu on uu.id = e.usuario_id
     where e.id = v_card.removido_pcp_evento_id;
  end if;

  return jsonb_build_object(
    'card_id',           v_card.id,
    'pedido_id',         v_card.pedido_id,
    'numero',            v_pedido.numero,
    'cliente',           v_cliente,
    'situacao',          v_pedido.situacao,
    'cancelado_no_tiny', plt_privado.fn_situacao_normalizada(v_pedido.situacao) = 'cancelado',
    -- o aviso aberto (desde quando, quantas peças, o motivo) — nulo quando já foi resolvido
    'aviso',             plt_privado.fn_pcp_aviso_resumo(v_card.id),
    'removido',          case when v_card.removido_pcp_em is null then null
                              else jsonb_build_object('em', v_card.removido_pcp_em,
                                                      'motivo', v_card.removido_pcp_motivo,
                                                      'texto', v_card.removido_pcp_texto,
                                                      'por', v_por) end,
    'liberado_completo', v_card.liberado_completo_em is not null,
    'vagas',             v_vagas,
    'vagas_abertas',     v_abertas,
    'canceladas',        v_lista,
    'canceladas_total',  v_total,
    'pecas',             plt_privado.fn_pcp_pecas_do_pedido(v_card.pedido_id));
end;
$$;

comment on function public.plt_fn_pcp_aviso(bigint) is
  'SESSAO-48 (frente 2): a janela "O que aconteceu?" do PCP numa requisição — o pedido (número, cliente, situação no Tiny), o aviso aberto, a remoção do PCP (se houver), as peças canceladas/não encontradas que eram dele (coluna, quem, quando; também as arquivadas — até 100, com o total), o que ele ainda tem em produção ou pronto e as vagas abertas. Só PCP/logística/admin.';
revoke all on function public.plt_fn_pcp_aviso(bigint) from public, anon;
grant execute on function public.plt_fn_pcp_aviso(bigint) to authenticated;

-- ----------------------------------------------------------------------------
-- 3 · "Produzir de novo": o PCP viu o aviso — ele fecha, e o pedido segue no
--     PCP para liberar as vagas que voltaram (a janela de liberar de sempre)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pcp_aviso_resolver(p_card_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_card   public.plt_cards%rowtype;
  v_numero integer;
  v_resumo jsonb;
  v_m      text;
begin
  if v_eu is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Resolver o aviso é gesto do PCP, da logística ou do admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if v_card.id is null or v_card.tipo <> 'pedido' then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;
  -- já resolvido (ou sem aviso): um efeito só
  if v_card.pcp_aviso_em is null then
    return jsonb_build_object('feito', false, 'motivo', 'sem_aviso', 'numero', v_numero);
  end if;
  v_resumo := plt_privado.fn_pcp_aviso_resumo(v_card.id);

  v_m := coalesce(current_setting('plt.pcp_aviso_maquinaria', true), '');
  perform set_config('plt.pcp_aviso_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (v_card.id, 'pcp_aviso_resolvido', v_eu, 'interface', v_card.setor_atual_id,
            'Produzir de novo — o pedido segue no PCP para liberar as vagas que voltaram.',
            jsonb_build_object('numero', v_numero, 'aviso_desde', v_card.pcp_aviso_em,
                               'pecas', v_resumo -> 'pecas', 'motivo', v_resumo ->> 'motivo'));
  perform set_config('plt.pcp_aviso_maquinaria', v_m, true);

  return jsonb_build_object(
    'feito', true, 'numero', v_numero,
    'vagas_abertas', (select count(*)::int from plt_privado.fn_vagas_pedido(v_card.pedido_id) w
                       where w.card_id is null));
end;
$$;

comment on function public.plt_fn_pcp_aviso_resolver(bigint) is
  'SESSAO-48 (frente 2): "Produzir de novo" — o fato pcp_aviso_resolvido fecha o aviso da peça cancelada; o pedido segue no PCP (libera-se pela janela de sempre). Sem aviso = nada (idempotente). Só PCP/logística/admin.';
revoke all on function public.plt_fn_pcp_aviso_resolver(bigint) from public, anon;
grant execute on function public.plt_fn_pcp_aviso_resolver(bigint) to authenticated;

-- ----------------------------------------------------------------------------
-- 4 · "Remover do PCP", com o motivo — só a parte do PCP muda (as vagas
--     pendentes e as liberações futuras); o Tiny e as peças já em produção ou
--     prontas ficam como estão (a resposta diz quantas e onde)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pcp_remover(p_card_id bigint, p_motivo text, p_texto text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_card   public.plt_cards%rowtype;
  v_numero integer;
  v_texto  text := nullif(left(btrim(coalesce(p_texto, '')), 300), '');
  v_pecas  jsonb;
  v_obs    text;
  v_m      text;
begin
  if v_eu is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Remover do PCP é gesto do PCP, da logística ou do admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p_motivo, '') not in ('pedido_cancelado', 'fora_da_linha', 'outro') then
    raise exception 'Escolha por que o pedido sai do PCP.' using errcode = 'check_violation';
  end if;
  if p_motivo = 'fora_da_linha' and coalesce(length(v_texto), 0) < 3 then
    raise exception 'Conte o que houve com o pedido (o campo "O que houve?").' using errcode = 'check_violation';
  end if;
  if p_motivo = 'outro' and coalesce(length(v_texto), 0) < 3 then
    raise exception 'Escreva o motivo.' using errcode = 'check_violation';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if v_card.id is null or v_card.tipo <> 'pedido' then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;
  v_pecas := plt_privado.fn_pcp_pecas_do_pedido(v_card.pedido_id);
  -- já removido: um efeito só (o motivo de antes fica)
  if v_card.removido_pcp_em is not null then
    return jsonb_build_object('feito', false, 'motivo', 'ja_removido', 'numero', v_numero) || v_pecas;
  end if;
  if v_card.arquivado_em is not null then
    raise exception 'Este pedido está arquivado.' using errcode = 'check_violation';
  end if;
  if v_card.entrega_evento_id is not null then
    raise exception 'Este pedido já foi entregue.' using errcode = 'check_violation';
  end if;

  v_obs := case p_motivo
             when 'pedido_cancelado' then 'Removido do PCP — o pedido foi cancelado (o Tiny não muda: cancele também lá).'
                                          || coalesce(' ' || v_texto, '')
             when 'fora_da_linha'    then 'Removido do PCP — tirado da linha de produção: ' || v_texto
             else                         'Removido do PCP — ' || v_texto
           end;

  v_m := coalesce(current_setting('plt.pcp_aviso_maquinaria', true), '');
  perform set_config('plt.pcp_aviso_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (v_card.id, 'pedido_removido_pcp', v_eu, 'interface', v_card.setor_atual_id, v_obs,
            jsonb_build_object('motivo', p_motivo, 'texto', v_texto, 'numero', v_numero,
                               'em_producao', v_pecas -> 'em_producao', 'prontas', v_pecas -> 'prontas',
                               'aviso_desde', v_card.pcp_aviso_em));
  perform set_config('plt.pcp_aviso_maquinaria', v_m, true);

  return jsonb_build_object('feito', true, 'numero', v_numero, 'motivo', p_motivo) || v_pecas;
end;
$$;

comment on function public.plt_fn_pcp_remover(bigint, text, text) is
  'SESSAO-48 (frente 2): "Remover do PCP" — o fato pedido_removido_pcp com o motivo (pedido_cancelado · fora_da_linha · outro; o texto é obrigatório nos dois últimos). O pedido sai de todas as portas do PCP (fn_fora_do_pcp) e o aviso fecha; o Tiny e as peças já em produção ou prontas não mudam — a resposta diz quantas e onde. Já removido = nada. Só PCP/logística/admin.';
revoke all on function public.plt_fn_pcp_remover(bigint, text, text) from public, anon;
grant execute on function public.plt_fn_pcp_remover(bigint, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5 · "Devolver ao PCP" (a aba "Cancelados e removidos"): a remoção se desfaz e
--     o pedido volta a aguardar liberação — se o Tiny deixar (D-132)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pcp_devolver(p_card_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_card   public.plt_cards%rowtype;
  v_pedido public.pedidos%rowtype;
  v_m      text;
begin
  if v_eu is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Devolver ao PCP é gesto do PCP, da logística ou do admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if v_card.id is null or v_card.tipo <> 'pedido' then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  select * into v_pedido from public.pedidos where id = v_card.pedido_id;
  -- não está removido (ou já foi devolvido): um efeito só
  if v_card.removido_pcp_em is null then
    return jsonb_build_object('feito', false, 'motivo', 'nao_removido', 'numero', v_pedido.numero);
  end if;

  v_m := coalesce(current_setting('plt.pcp_aviso_maquinaria', true), '');
  perform set_config('plt.pcp_aviso_maquinaria', 'on', true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (v_card.id, 'pedido_devolvido_pcp', v_eu, 'interface', v_card.setor_atual_id,
            'Devolvido ao PCP — volta a aguardar liberação.',
            jsonb_build_object('numero', v_pedido.numero, 'removido_em', v_card.removido_pcp_em,
                               'motivo_antes', v_card.removido_pcp_motivo, 'texto_antes', v_card.removido_pcp_texto));
  perform set_config('plt.pcp_aviso_maquinaria', v_m, true);

  return jsonb_build_object(
    'feito', true, 'numero', v_pedido.numero,
    -- o Tiny manda (D-132): cancelado, faturado, entregue… o pedido sai da lista
    -- de removidos mas não volta ao quadro — a tela diz isso
    'fora_pelo_tiny', plt_privado.fn_fora_do_pcp(v_pedido.situacao, v_card.volta_pcp_em, null),
    'situacao', v_pedido.situacao,
    'standby', v_card.standby_desde is not null,
    'liberado_completo', v_card.liberado_completo_em is not null);
end;
$$;

comment on function public.plt_fn_pcp_devolver(bigint) is
  'SESSAO-48 (frente 2): "Devolver ao PCP" — o fato pedido_devolvido_pcp desfaz a remoção; o pedido volta às portas do PCP se o Tiny deixar (fora_pelo_tiny diz quando não). Não removido = nada. Só PCP/logística/admin.';
revoke all on function public.plt_fn_pcp_devolver(bigint) from public, anon;
grant execute on function public.plt_fn_pcp_devolver(bigint) to authenticated;

-- ----------------------------------------------------------------------------
-- 6 · A aba "Cancelados e removidos" do PCP — a porta da antiga aba Cancelados
--     (20260928120000), agora com os removidos do PCP e por CURSOR (Lei §6: a
--     lista cresce sem fim). A ordem é "quando saiu do PCP", o mais recente
--     primeiro: o removido pela remoção; o cancelado no Tiny pelo último fato
--     pedido_cancelado. A assinatura muda (o cursor no lugar do deslocamento) e
--     sai o total (Lei §6.4 — contar todos os cancelados custava ~175 ms no
--     ensaio ×100): a de 3 argumentos sai no fim desta seção.
--
--     O caminho (ensaio ×100: o planejador, sozinho, partia de TODOS os pedidos
--     cancelados — 17 mil — e só depois ordenava):
--       1 · cada metade anda pelo seu índice, na ordem, e para quando enche a
--           página — os removidos pela remoção (plt_cards_removido_pcp_idx); os
--           cancelados pelo fato pedido_cancelado (plt_eventos_tipo_idx), cada
--           fato conferido na hora (o card vivo, o pedido ainda cancelado, o
--           último fato do card). Com filtro, cada uma lê no máximo 150 linhas;
--       2 · o nº (sempre) e o nome raro (não encheu a página nessas 150): os
--           candidatos vêm do próprio filtro — o nº pelas faixas do índice do
--           número, como a lista de Pedidos (com 2–3 dígitos, só os cancelados
--           das faixas pelo índice parcial e os removidos); o nome pelos
--           trigramas do nome do cliente (3 letras ou mais) — numa lista, e os
--           cards deles pela chave (= any); só eles são conferidos.
-- ----------------------------------------------------------------------------

-- O filtro dos quadros (D-187) aplicado a um pedido: o nº que começa com o texto,
-- ou o nome do cliente que o contém (sem acento) — conferido linha a linha.
create or replace function plt_privado.fn_pedido_bate_filtro(p_pedido_id bigint, p_numero text, p_nome text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select case when p_numero is not null then p.numero::text like p_numero || '%'
                else plt_privado.fn_nome_comparavel(cl.nome) like '%' || p_nome || '%' end
      from public.pedidos p
      left join public.clientes cl on cl.id = p.cliente_id
     where p.id = p_pedido_id), false);
$$;

comment on function plt_privado.fn_pedido_bate_filtro(bigint, text, text) is
  'SESSAO-48 (frente 2): o filtro dos quadros (fn_filtro_do_quadro) num pedido — o nº que começa com o texto, ou o nome do cliente que o contém (sem acento). A aba "Cancelados e removidos" confere linha a linha.';
revoke all on function plt_privado.fn_pedido_bate_filtro(bigint, text, text) from public, anon, authenticated;

-- derruba antes de recriar: o retorno desta porta pode mudar entre versões
-- (o "cannot change return type" do E-178 — o total saiu nesta frente)
drop function if exists public.plt_fn_pedidos_cancelados(text, integer, timestamptz, bigint);
create or replace function public.plt_fn_pedidos_cancelados(
  p_busca     text        default null,
  p_limite    integer     default 20,
  p_depois_em timestamptz default null,  -- o cursor: "saiu em" da última linha mostrada…
  p_depois_id bigint      default null   -- …e o card dela (o desempate)
)
returns table (
  card_id           bigint,
  pedido_id         bigint,
  numero            integer,
  cliente_nome      text,
  data_pedido       date,
  situacao          text,
  cancelado_no_tiny boolean,
  cancelado_em      timestamptz,
  removido_em       timestamptz,
  removido_motivo   text,
  removido_texto    text,
  removido_por      text,
  saiu_em           timestamptz,
  total_unidades    integer,
  em_producao       integer,
  prontas           integer,
  no_estoque        integer,
  esperando_decisao integer,
  pode_devolver     boolean,
  tem_mais          boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_lim    integer     := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_ate    timestamptz := coalesce(p_depois_em, 'infinity'::timestamptz);
  v_id     bigint      := coalesce(p_depois_id, 9223372036854775807);
  v_teto   constant integer := 150;  -- com filtro: quantas linhas cada metade lê antes do caminho do filtro raro
  v_txt    text        := nullif(btrim(coalesce(p_busca, '')), '');
  v_ativo  boolean;
  v_num    text;
  v_nome   text;
  v_numb   bigint;
  v_cabe   boolean;                  -- o nome com 3 letras ou mais: tem o caminho dos trigramas se for raro
  v_raro   boolean := false;         -- vai pelos candidatos do filtro (o nº sempre; o nome raro)
  v_lidas  integer;
  v_ped    bigint;
  r        record;
  v_r_ids  bigint[] := '{}';
  v_r_ch   timestamptz[] := '{}';
  v_c_ids  bigint[] := '{}';
  v_c_ch   timestamptz[] := '{}';
  v_ids    bigint[] := '{}';
  v_chaves timestamptz[] := '{}';
  v_cand   bigint[] := '{}';
begin
  -- como a de antes: sem acesso, lista vazia (a régua de liberar)
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    return;
  end if;
  -- o mesmo filtro dos quadros (D-187): o nº do pedido que começa com o texto,
  -- ou o nome do cliente que o contém (sem acento)
  select f.ativo, f.numero, f.nome into v_ativo, v_num, v_nome from plt_privado.fn_filtro_do_quadro(p_busca) f;
  v_ativo := coalesce(v_ativo, false);
  v_numb  := case when v_num ~ '^[1-9][0-9]{0,8}$' then v_num::bigint end;
  -- nº com mais de 9 dígitos: nenhum pedido tem
  if v_num is not null and v_numb is null then
    return;
  end if;
  -- o nº vai sempre direto aos candidatos (o índice do número); o nome com 3
  -- letras ou mais tenta antes a lista na ordem (o nome comum enche logo)
  v_raro  := v_numb is not null;
  v_cabe  := v_ativo and v_num is null and length(coalesce(v_txt, '')) >= 3;

  -- 1 · os removidos do PCP, na ordem da remoção, até encher a página
  if not v_raro then
    v_lidas := 0;
    for r in select pc.id, pc.removido_pcp_em as chave, pc.pedido_id as ped
               from public.plt_cards pc
              where pc.removido_pcp_em is not null
                and (pc.removido_pcp_em, pc.id) < (v_ate, v_id)
                and pc.tipo = 'pedido' and pc.arquivado_em is null
              order by pc.removido_pcp_em desc, pc.id desc
    loop
      v_lidas := v_lidas + 1;
      if v_cabe and v_lidas > v_teto then
        v_raro := true;
        exit;
      end if;
      continue when v_ativo and not plt_privado.fn_pedido_bate_filtro(r.ped, v_num, v_nome);
      v_r_ids := v_r_ids || r.id;
      v_r_ch  := v_r_ch || r.chave;
      exit when cardinality(v_r_ids) > v_lim;
    end loop;
  end if;

  -- 1 · os cancelados no Tiny (e não removidos), pelo fato pedido_cancelado, do
  -- mais novo para trás — vale o último fato do card (o pedido pode ter voltado
  -- no Tiny e sido cancelado de novo)
  if not v_raro then
    v_lidas := 0;
    for r in select e.id as ev, e.card_id as id, e.ocorrido_em as chave
               from public.plt_eventos e
              where e.tipo = 'pedido_cancelado'
                and e.ocorrido_em <= v_ate
                and (e.ocorrido_em < v_ate or e.card_id < v_id)
              order by e.ocorrido_em desc, e.card_id desc
    loop
      v_lidas := v_lidas + 1;
      if v_cabe and v_lidas > v_teto then
        v_raro := true;
        exit;
      end if;
      v_ped := null;
      select pc.pedido_id into v_ped
        from public.plt_cards pc
        join public.pedidos p on p.id = pc.pedido_id
       where pc.id = r.id and pc.tipo = 'pedido' and pc.arquivado_em is null and pc.removido_pcp_em is null
         and plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado';
      continue when v_ped is null;
      continue when exists (select 1 from public.plt_eventos e2
                             where e2.card_id = r.id and e2.tipo = 'pedido_cancelado'
                               and (e2.ocorrido_em, e2.id) > (r.chave, r.ev));
      continue when v_ativo and not plt_privado.fn_pedido_bate_filtro(v_ped, v_num, v_nome);
      v_c_ids := v_c_ids || r.id;
      v_c_ch  := v_c_ch || r.chave;
      exit when cardinality(v_c_ids) > v_lim;
    end loop;
  end if;

  if not v_raro then
    select coalesce(array_agg(j.id order by j.chave desc, j.id desc), '{}'),
           coalesce(array_agg(j.chave order by j.chave desc, j.id desc), '{}')
      into v_ids, v_chaves
      from (select u.id, u.chave
              from unnest(v_r_ids || v_c_ids, v_r_ch || v_c_ch) as u(id, chave)
             order by u.chave desc, u.id desc
             limit v_lim + 1) j;
  else
    -- 2 · filtro raro: os candidatos vêm do filtro — o nº pelas faixas do índice
    -- do número [x·10^k, (x+1)·10^k); o nome pelos trigramas do nome do cliente
    -- (conferido também sem acento) — e cada um ganha a sua "saída do PCP".
    -- Primeiro os pedidos candidatos (uma lista), depois os cards deles pela
    -- chave (= any): o planejador não sabe quantos números as faixas trazem e,
    -- numa consulta só, juntava TODOS os cards de pedido (ensaio ×100: 1,1 a 4 s)
    if v_numb is not null and length(v_num) >= 4 then
      -- 4 dígitos ou mais: poucos números começam com ele — todos os das faixas
      select coalesce(array_agg(p1.id), '{}') into v_cand
        from generate_series(0, greatest(0, 10 - length(v_num))) as g(e)
        join public.pedidos p1
          on p1.numero >= v_numb * (10::bigint ^ g.e)::bigint
         and p1.numero <  (v_numb + 1) * (10::bigint ^ g.e)::bigint;
    elsif v_numb is not null then
      -- 2–3 dígitos: muitos números — só os cancelados das faixas (o índice
      -- parcial dos cancelados por número) e os removidos do PCP (poucos)
      select coalesce(array_agg(x.id), '{}') into v_cand
        from (select p1.id
                from generate_series(0, greatest(0, 10 - length(v_num))) as g(e)
                join public.pedidos p1
                  on p1.numero >= v_numb * (10::bigint ^ g.e)::bigint
                 and p1.numero <  (v_numb + 1) * (10::bigint ^ g.e)::bigint
                 and plt_privado.fn_situacao_normalizada(p1.situacao) = 'cancelado'
              union
              select pc.pedido_id
                from public.plt_cards pc
                join public.pedidos p3 on p3.id = pc.pedido_id
               where pc.removido_pcp_em is not null and pc.tipo = 'pedido' and pc.arquivado_em is null
                 and p3.numero::text like v_num || '%') x;
    else
      -- o nome: os trigramas do nome do cliente, conferido também sem acento
      select coalesce(array_agg(p2.id), '{}') into v_cand
        from public.clientes c2
        join public.pedidos p2 on p2.cliente_id = c2.id
       where c2.nome ilike '%' || v_txt || '%'
         and plt_privado.fn_nome_comparavel(c2.nome) like '%' || v_nome || '%';
    end if;
    select coalesce(array_agg(x.id order by x.chave desc, x.id desc), '{}'),
           coalesce(array_agg(x.chave order by x.chave desc, x.id desc), '{}')
      into v_ids, v_chaves
      from (
        select k.id, k.chave
          from (
            select pc.id,
                   case when pc.removido_pcp_em is not null then pc.removido_pcp_em
                        when plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
                          then (select max(e.ocorrido_em) from public.plt_eventos e
                                 where e.card_id = pc.id and e.tipo = 'pedido_cancelado') end as chave
              from public.plt_cards pc
              join public.pedidos p on p.id = pc.pedido_id
             where pc.pedido_id = any (v_cand) and pc.tipo = 'pedido' and pc.arquivado_em is null
          ) k
         where k.chave is not null and (k.chave, k.id) < (v_ate, v_id)
         order by k.chave desc, k.id desc
         limit v_lim + 1) x;
  end if;

  -- 3 · o que cada linha mostra (só as da página)
  return query
  select pc.id                                                          as card_id,
         p.id                                                           as pedido_id,
         p.numero                                                       as numero,
         coalesce(cl.nome, '')                                          as cliente_nome,
         p.data_pedido                                                  as data_pedido,
         p.situacao                                                     as situacao,
         plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'  as cancelado_no_tiny,
         case when plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
              then canc.em end                                          as cancelado_em,
         pc.removido_pcp_em                                             as removido_em,
         pc.removido_pcp_motivo                                         as removido_motivo,
         pc.removido_pcp_texto                                          as removido_texto,
         ur.nome                                                        as removido_por,
         pg.chave                                                       as saiu_em,
         coalesce(i.total, 0)                                           as total_unidades,
         coalesce(u.em_producao, 0)                                     as em_producao,
         coalesce(u.prontas, 0)                                         as prontas,
         coalesce(d.no_estoque, 0)                                      as no_estoque,
         coalesce(u.esperando, 0)                                       as esperando_decisao,
         -- "Devolver ao PCP" só quando ele volta de verdade: removido, e o Tiny
         -- não o mantém fora (cancelado, faturado, entregue… — D-132)
         pc.removido_pcp_em is not null
           and not plt_privado.fn_fora_do_pcp(p.situacao, pc.volta_pcp_em, null) as pode_devolver,
         cardinality(v_ids) > v_lim                                     as tem_mais
    from unnest(v_ids, v_chaves) with ordinality as pg(id, chave, ord)
    join public.plt_cards pc on pc.id = pg.id
    join public.pedidos p on p.id = pc.pedido_id
    left join public.clientes cl on cl.id = p.cliente_id
    left join public.plt_eventos er on er.id = pc.removido_pcp_evento_id
    left join public.plt_usuarios ur on ur.id = er.usuario_id
    left join lateral (
      select max(e.ocorrido_em) as em
        from public.plt_eventos e
       where e.card_id = pc.id and e.tipo = 'pedido_cancelado'
    ) canc on true
    left join lateral (
      -- D-63: frete não conta.
      select coalesce(sum(v.unidades), 0)::int as total
        from plt_privado.vw_itens_producao v where v.pedido_id = p.id
    ) i on true
    left join lateral (
      -- peças que ainda carregam o pedido: na produção ou num fim de linha; e as
      -- que esperam a logística decidir o destino (pedido cancelado no Tiny)
      select count(*) filter (where s.papel_no_fluxo <> 'terminal')::int as em_producao,
             count(*) filter (where s.papel_no_fluxo = 'terminal')::int  as prontas,
             count(*) filter (where cu.destino_pendente_em is not null)::int as esperando
        from public.plt_cards cu
        left join public.plt_setores s on s.id = cu.setor_atual_id
       where cu.pedido_id = p.id and cu.tipo = 'unidade' and cu.arquivado_em is null
    ) u on true
    left join lateral (
      -- peças que perderam o pedido e ficaram sem dono NO ESTOQUE (SESSAO-48: a
      -- peça com a fabricação cancelada perde o pedido e não está no estoque)
      select count(*)::int as no_estoque
        from public.plt_cards cu
        join public.plt_setores se on se.id = cu.setor_atual_id and se.codigo = 'estoque'
       where cu.card_pai_id = pc.id and cu.tipo = 'unidade'
         and cu.pedido_id is null and cu.arquivado_em is null and cu.cancelada_em is null
    ) d on true
   where pg.ord <= v_lim
   order by pg.ord;
end;
$$;

comment on function public.plt_fn_pedidos_cancelados(text, integer, timestamptz, bigint) is
  'SESSAO-48 (frente 2): a aba "Cancelados e removidos" do PCP — os pedidos cancelados no Tiny (com o card vivo) e os removidos do PCP, do que saiu mais recente para trás, por cursor (saiu_em, card_id); cada um com o motivo, quem removeu e quando, as peças em produção/prontas/no estoque/esperando decisão e se pode voltar ao PCP (removido e o Tiny não o mantém fora). Cada metade anda pelo seu índice e para na página; o filtro raro vai pelos candidatos do próprio filtro. Sem total (Lei §6.4). Sem acesso (PCP/logística/admin) = vazia.';
revoke all on function public.plt_fn_pedidos_cancelados(text, integer, timestamptz, bigint) from public, anon;
grant execute on function public.plt_fn_pedidos_cancelados(text, integer, timestamptz, bigint) to authenticated;

-- a de 3 argumentos (o deslocamento) sai — nenhuma tela a chama desde 14/10 (a
-- aba Cancelados foi para a área Pedidos) e a nova é a da aba do PCP
drop function if exists public.plt_fn_pedidos_cancelados(text, integer, integer);

-- fim da frente 2 da SESSAO-48
