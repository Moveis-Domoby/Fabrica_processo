-- ============================================================================
-- SESSAO-44 · Entrega que volta do Tiny e itens novos no PCP (04/11/2026)
--
-- Frente 3 · a peça ligada ao PRODUTO certo: `fn_vagas_pedido` casa cada vaga
--   (item × unidade) com a peça do mesmo produto — a posição só desempata —, e
--   as portas que perguntavam "tem peça nesta posição?" passam a perguntar a ela
--   (janela, liberar, alocar, sugestões, conta da liberação, concluir pelo super
--   admin, realocar devolução, reservas do estoque). O frete das contagens passa
--   a ser o do próprio card. O índice único por posição vira índice comum (o
--   item inserido no meio da lista ocupa uma posição que já tem peça de outro
--   produto); quem cria peça confere a vaga com o card do pedido travado.
-- Frente 2 · itens novos no Tiny: gatilho ADIADO em `pedidos` (A-47 — dispara no
--   COMMIT, depois de `fn_upsert_pedido` regravar os itens) compara os itens de
--   antes (o `raw` antigo) com os de agora, grava o fato `pedido_itens_alterados`,
--   refaz a conta da liberação e avisa (PCP; logística quando está em rota). Já
--   entregue: reabre só na plataforma (reentrega) e o PCP vê só os itens novos.
--   Nunca arquiva peça; a reserva do estoque reavalia o pedido.
-- Frente 4 · `fn_reabrir_entrega` (o caminho único: desfazer do dia, reabrir do
--   admin e a volta do Tiny), com a peça do estoque voltando RESERVADA ao mesmo
--   pedido; `plt_fn_entrega_desfazer` deixa o admin reabrir qualquer dia e a
--   entrega do Tiny, e só devolve a situação ao Tiny se ele ainda estiver
--   "Entregue".
-- Frente 5 · o Tiny saiu de "Entregue": a entrega do Sistema reabre sozinha; a de
--   pessoa não reabre e a logística é avisada. Erro vira alerta (fn_alertar_erro).
--
-- Funções recriadas da versão VIVA do banco (pg_get_functiondef, 04/11), nunca
-- de migration antiga (E-24/A-97). Nenhuma coluna em tabela da integração.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · O fato novo
-- ----------------------------------------------------------------------------
alter table public.plt_eventos drop constraint if exists plt_eventos_tipo_check;
alter table public.plt_eventos add constraint plt_eventos_tipo_check check (tipo = any (array[
  'card_criado', 'movimentacao_setor', 'movimentacao_etapa', 'execucao_iniciada', 'execucao_finalizada',
  'execucao_pausada', 'execucao_retomada', 'qualidade_marcada', 'qualidade_parecer', 'divergencia_registrada',
  'notificacao_enviada', 'delegacao', 'estorno', 'pedido_atualizado', 'pedido_cancelado', 'card_arquivado',
  'pedido_entregue', 'pedido_lancado_rotas', 'unidade_desvinculada', 'peca_alocada', 'peca_reservada',
  'peca_reserva_desfeita', 'estoque_reserva_avaliada', 'etiqueta_adicionada', 'etiqueta_removida',
  'card_desarquivado', 'entrega_desfeita', 'entrega_nao_realizada', 'pedido_devolvido', 'comentario_adicionado',
  'anexo_adicionado', 'devolucao_decidida', 'ajuste_aberto', 'ajuste_concluido', 'avulso_concluido',
  'card_editado', 'responsavel_adicionado', 'responsavel_removido', 'anexo_removido', 'comentario_editado',
  'comentario_apagado', 'auxilio_iniciado', 'auxilio_pausado', 'auxilio_retomado', 'auxilio_encerrado',
  'prioridade_definida', 'responsavel_setor_definido', 'pedido_standby_entrou', 'pedido_standby_saiu',
  'data_entrega_alterada', 'peca_vinculada', 'tempo_decisao',
  'pedido_itens_alterados'  -- SESSAO-44: o Tiny mudou os itens (o que entrou e o que saiu)
]::text[])) not valid;
alter table public.plt_eventos validate constraint plt_eventos_tipo_check;

-- ----------------------------------------------------------------------------
-- 2 · O frete numa regra só (a view passa a usá-la; o card também)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_eh_frete(p_descricao text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select lower(coalesce(p_descricao, ''))
         ~ '^[^a-z0-9áàâãäéèêëíìîïóòôõöúùûüç]*(frete|entrega)([^a-z0-9áàâãäéèêëíìîïóòôõöúùûüç]|$)';
$$;
comment on function plt_privado.fn_eh_frete(text) is
  'D-63: a 1ª palavra da descrição é frete/entrega. Dona única da regra — a view de itens e o frete do próprio card (SESSAO-44) leem daqui.';
revoke all on function plt_privado.fn_eh_frete(text) from public, anon, authenticated;

create or replace view plt_privado.vw_itens_producao
with (security_invoker = on) as
  select pi.pedido_id,
         pi.seq,
         pi.codigo,
         pi.descricao,
         pi.quantidade,
         f.eh_frete,
         case when f.eh_frete then 0
              when round(coalesce(pi.quantidade, 0)) >= 1 then round(pi.quantidade)::int
              else 0
         end as unidades
    from public.pedido_itens pi
    cross join lateral (select plt_privado.fn_eh_frete(pi.descricao) as eh_frete) f;

-- ----------------------------------------------------------------------------
-- 3 · Frente 3 — as vagas do pedido casadas pelo produto
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_vagas_pedido(p_pedido_id bigint)
returns table (seq integer, indice integer, total integer, codigo text, descricao text,
               chave text, card_id bigint, reserva_card_id bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  -- plpgsql: o plano fica guardado na sessão (a função SQL replanejaria a cada chamada)
  return query
  with vagas as (
    select v.seq, k.k as indice, v.unidades as total, v.codigo, v.descricao,
           plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(v.codigo, v.descricao),
                                     v.codigo, v.descricao) as chave
      from plt_privado.vw_itens_producao v
      cross join lateral generate_series(1, v.unidades) as k(k)
     where v.pedido_id = p_pedido_id and v.unidades >= 1
  ),
  -- a peça carrega o produto dela (o retrato do item quando nasceu)
  pecas as (
    select u.id, u.item_seq, u.indice_unidade,
           plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(u.item_codigo, u.item_descricao),
                                     u.item_codigo, u.item_descricao) as chave
      from public.plt_cards u
     where u.pedido_id = p_pedido_id and u.tipo = 'unidade'
  ),
  -- 1º o mesmo produto na mesma posição; 2º o mesmo produto na ordem das posições
  exatas as (
    select distinct on (va.seq, va.indice) va.seq, va.indice, p.id
      from vagas va
      join pecas p on p.chave = va.chave and p.item_seq = va.seq and p.indice_unidade = va.indice
     order by va.seq, va.indice, p.id
  ),
  resto_v as (
    select va.seq, va.indice, va.chave,
           row_number() over (partition by va.chave order by va.seq, va.indice) as n
      from vagas va
     where not exists (select 1 from exatas e where e.seq = va.seq and e.indice = va.indice)
  ),
  resto_p as (
    select p.id, p.chave,
           row_number() over (partition by p.chave order by p.item_seq, p.indice_unidade, p.id) as n
      from pecas p
     where not exists (select 1 from exatas e where e.id = p.id)
  ),
  com_peca as (
    select e.seq, e.indice, e.id from exatas e
    union all
    select rv.seq, rv.indice, rp.id
      from resto_v rv join resto_p rp on rp.chave = rv.chave and rp.n = rv.n
  ),
  -- a peça do ESTOQUE que a venda reservou cobre a vaga ainda sem peça
  sem_peca as (
    select va.seq, va.indice, va.chave
      from vagas va
     where not exists (select 1 from com_peca c where c.seq = va.seq and c.indice = va.indice)
  ),
  reservas as (
    select c.id, c.reservada_item_seq as seq, c.reservada_indice as indice,
           'p:' || c.produto_tiny_id as chave
      from public.plt_cards c
     where c.reservada_pedido_id = p_pedido_id and c.arquivado_em is null
  ),
  res_exatas as (
    select distinct on (s.seq, s.indice) s.seq, s.indice, r.id
      from sem_peca s
      join reservas r on r.chave = s.chave and r.seq = s.seq and r.indice = s.indice
     order by s.seq, s.indice, r.id
  ),
  res_v as (
    select s.seq, s.indice, s.chave,
           row_number() over (partition by s.chave order by s.seq, s.indice) as n
      from sem_peca s
     where not exists (select 1 from res_exatas e where e.seq = s.seq and e.indice = s.indice)
  ),
  res_p as (
    select r.id, r.chave,
           row_number() over (partition by r.chave order by r.seq, r.indice, r.id) as n
      from reservas r
     where not exists (select 1 from res_exatas e where e.id = r.id)
  ),
  com_reserva as (
    select e.seq, e.indice, e.id from res_exatas e
    union all
    select v.seq, v.indice, p.id
      from res_v v join res_p p on p.chave = v.chave and p.n = v.n
  )
  select va.seq, va.indice, va.total, va.codigo, va.descricao, va.chave, cp.id, cr.id
    from vagas va
    left join com_peca cp on cp.seq = va.seq and cp.indice = va.indice
    left join com_reserva cr on cr.seq = va.seq and cr.indice = va.indice
   order by va.seq, va.indice;
end;
$$;
comment on function plt_privado.fn_vagas_pedido(bigint) is
  'SESSAO-44 (frente 3): cada vaga do pedido (item de produção × unidade) e a peça que a cobre — a do MESMO produto (fn_chave_peca do retrato do item na peça), a posição só desempata — e, sem peça, a peça do estoque reservada para ela. Peça de item que saiu do pedido não cobre nada (sobra). Dona única do "esta vaga já tem peça?".';
revoke all on function plt_privado.fn_vagas_pedido(bigint) from public, anon, authenticated;

create or replace function plt_privado.fn_vaga_coberta(p_pedido_id bigint, p_seq integer, p_indice integer)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from plt_privado.fn_vagas_pedido(p_pedido_id) w
                  where w.seq = p_seq and w.indice = p_indice and w.card_id is not null);
$$;
comment on function plt_privado.fn_vaga_coberta(bigint, integer, integer) is
  'SESSAO-44 (frente 3): a vaga (posição de hoje × unidade) já tem a peça do mesmo produto.';
revoke all on function plt_privado.fn_vaga_coberta(bigint, integer, integer) from public, anon, authenticated;

-- O índice único por POSIÇÃO vira único por posição E PRODUTO: o item inserido
-- no meio da lista ocupa uma posição em que já existe peça de OUTRO produto (e
-- precisa nascer); a mesma peça do mesmo produto na mesma vaga segue barrada.
-- Quem cria peça trava o card do pedido e confere a vaga pela fn_vagas_pedido.
create unique index if not exists plt_cards_unidade_vaga_uq
  on public.plt_cards (pedido_id, item_seq, indice_unidade,
                       coalesce(item_codigo, ''), coalesce(item_descricao, ''))
  where tipo = 'unidade';
drop index if exists public.plt_cards_unidade_uq;

-- A conta da liberação (recriada da viva — 20261028020000): vagas cobertas.
create or replace function plt_privado.fn_recalcular_liberacao(p_pedido_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total     integer;
  v_liberadas integer;
  v_quando    timestamptz;
begin
  -- SESSAO-44 (frente 3): a vaga coberta é a que tem a peça do mesmo produto —
  -- frete não é vaga (D-63) e peça de item que saiu não cobre nada.
  select count(*)::int, count(w.card_id)::int into v_total, v_liberadas
    from plt_privado.fn_vagas_pedido(p_pedido_id) w;

  if v_total > 0 and v_liberadas >= v_total then
    -- O instante da liberação da ÚLTIMA unidade (D-48: fim do tempo em PCP).
    -- D-201: a peça que veio da produção sem dono conta de quando passou a ser
    -- deste pedido.
    select max(e.ocorrido_em) into v_quando
      from plt_privado.fn_vagas_pedido(p_pedido_id) w
      join public.plt_eventos e on e.card_id = w.card_id
     where e.tipo = 'card_criado'
        or (e.tipo = 'peca_vinculada' and e.dados ->> 'pedido_id' = p_pedido_id::text);
  else
    v_quando := null;
  end if;

  update public.plt_cards
     set liberado_completo_em = v_quando
   where pedido_id = p_pedido_id and tipo = 'pedido'
     and liberado_completo_em is distinct from v_quando;
end;
$$;
comment on function plt_privado.fn_recalcular_liberacao(bigint) is
  'SESSAO-22 (D-48): recalcula liberado_completo_em do card de pedido — derivado dos eventos e dos itens. ↪️ D-201: a peça ligada da produção conta de quando passou a ser do pedido. ↪️ SESSAO-44: conta as vagas cobertas pela peça do mesmo produto (fn_vagas_pedido); chamada também quando o Tiny muda os itens.';
revoke all on function plt_privado.fn_recalcular_liberacao(bigint) from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 5 · A reserva do estoque (recriada da viva — pg_get_functiondef de 04/11): reavalia o pedido
--     que ganhou itens e casa a reserva pelo produto
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_estoque_reservas_rodar()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_desde       timestamptz;
  v_estoque     bigint;
  v_avaliados   integer := 0;
  v_reservadas  integer := 0;
  v_desfeitas   integer := 0;
  v_consumidas  integer := 0;
  v_itens       jsonb;
  v_peca        bigint;
  v_situacao    text;
  v_motivo      text;
  r_pc          record;
  r_pr          record;
  r_va          record;
  r             record;
begin
  v_desde := plt_privado.fn_tiny_estoque_desde();
  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';
  perform set_config('plt.estoque_maquinaria', 'on', true);

  -- (a) vendas novas — só com o sincronismo ligado (desligado, nenhuma venda
  --     nova reserva; as reservas que já existem seguem acompanhando o pedido).
  --     SESSAO-44 (frente 2): o pedido que ganhou itens no Tiny depois da
  --     última avaliação é avaliado de novo (só as vagas ainda sem peça e sem
  --     reserva).
  for r_pc in
    select pc.id as card_id, pc.pedido_id, p.numero
      from public.plt_cards pc
      join public.pedidos p on p.id = pc.pedido_id
     where v_desde is not null
       and pc.tipo = 'pedido'
       and pc.arquivado_em is null
       and pc.criado_em >= v_desde
       and plt_privado.fn_situacao_reserva_estoque(p.situacao)
       and not exists (select 1 from public.plt_eventos e
                        where e.card_id = pc.id and e.tipo = 'estoque_reserva_avaliada'
                          and e.id > coalesce((select max(i.id) from public.plt_eventos i
                                                where i.card_id = pc.id
                                                  and i.tipo = 'pedido_itens_alterados'), 0))
     order by pc.id
     limit 200
  loop
    v_itens := '[]'::jsonb;
    for r_pr in
      select distinct x.produto
        from plt_privado.fn_vagas_pedido(r_pc.pedido_id) w
        cross join lateral (select plt_privado.fn_produto_do_item(w.codigo, w.descricao) as produto) x
       where x.produto is not null and plt_privado.fn_eh_acabado_contado(x.produto)
       order by x.produto
    loop
      perform pg_advisory_xact_lock(hashtextextended('plt_estoque_produto:' || r_pr.produto, 0));
      -- a vaga ainda sem peça (do mesmo produto) e sem reserva
      for r_va in
        select w.seq, w.indice, w.total
          from plt_privado.fn_vagas_pedido(r_pc.pedido_id) w
         where w.card_id is null and w.reserva_card_id is null
           and plt_privado.fn_produto_do_item(w.codigo, w.descricao) = r_pr.produto
         order by w.seq, w.indice
      loop
        v_peca := null;
        select c.id into v_peca
          from public.plt_cards c
         where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
           and c.reservada_pedido_id is null
           and c.produto_tiny_id = r_pr.produto and c.setor_atual_id = v_estoque
           and coalesce(c.qualidade_atual, 'perfeito') = 'perfeito'
           and not plt_privado.fn_eh_personalizado(c.item_descricao)
         order by c.desde asc nulls first, c.id
         limit 1
           for update skip locked;
        exit when v_peca is null;
        insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
          values (v_peca, 'peca_reservada', 'automacao', v_estoque,
                  format('Reservada para o pedido %s (%s/%s).', r_pc.numero, r_va.indice, r_va.total),
                  jsonb_build_object('pedido_id', r_pc.pedido_id, 'numero', r_pc.numero,
                                     'card_pedido_id', r_pc.card_id, 'item_seq', r_va.seq,
                                     'indice_unidade', r_va.indice, 'total_unidades', r_va.total,
                                     'produto_tiny_id', r_pr.produto));
        v_itens := v_itens || jsonb_build_array(jsonb_build_object(
                     'item_seq', r_va.seq, 'indice_unidade', r_va.indice, 'peca_card_id', v_peca));
        v_reservadas := v_reservadas + 1;
      end loop;
      -- Lê o Tiny depois da venda (só leitura): confirma como o Tiny baixa a
      -- venda e pega o que tiver mudado lá.
      perform plt_privado.fn_tiny_estoque_enfileirar(r_pr.produto, false, 'venda');
    end loop;
    insert into public.plt_eventos (card_id, tipo, origem, dados)
      values (r_pc.card_id, 'estoque_reserva_avaliada', 'automacao',
              jsonb_build_object('reservadas', v_itens));
    v_avaliados := v_avaliados + 1;
  end loop;

  -- (b) as reservas vivas acompanham o pedido
  -- SESSAO-44: as vagas de cada pedido com reserva, calculadas uma vez por pedido
  for r in
    with pedidos_r as (
      select distinct c.reservada_pedido_id as pid
        from public.plt_cards c
       where c.reservada_pedido_id is not null and c.arquivado_em is null
    ),
    vagas_r as (
      select pr.pid, w.chave, w.reserva_card_id
        from pedidos_r pr cross join lateral plt_privado.fn_vagas_pedido(pr.pid) w
    )
    select c.id, c.setor_atual_id, c.produto_tiny_id,
           c.reservada_pedido_id as pedido_id, c.reservada_item_seq as seq,
           c.reservada_indice as k, p.numero, p.situacao,
           exists (select 1 from vagas_r v where v.pid = c.reservada_pedido_id and v.reserva_card_id = c.id) as casada,
           exists (select 1 from vagas_r v where v.pid = c.reservada_pedido_id
                                             and v.chave = 'p:' || c.produto_tiny_id) as produto_no_pedido
      from public.plt_cards c
      join public.pedidos p on p.id = c.reservada_pedido_id
     where c.reservada_pedido_id is not null and c.arquivado_em is null
     order by c.id
  loop
    v_situacao := plt_privado.fn_situacao_normalizada(r.situacao);
    v_motivo := null;
    if v_situacao = 'cancelado' then
      v_motivo := 'pedido_cancelado';
    -- SESSAO-44 (frente 3): a reserva segue enquanto cobre uma vaga do MESMO
    -- produto (a posição pode ter mudado no Tiny). Sem vaga: o PCP mandou
    -- produzir (o produto segue no pedido) ou o pedido mudou.
    elsif not r.casada then
      v_motivo := case when r.produto_no_pedido then 'pcp_produzir' else 'pedido_alterado' end;
    end if;

    if v_motivo is not null then
      insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
        values (r.id, 'peca_reserva_desfeita', 'automacao', r.setor_atual_id,
                case v_motivo
                  when 'pedido_cancelado' then format('O pedido %s foi cancelado — a peça volta a ficar livre.', r.numero)
                  when 'pcp_produzir'     then format('O PCP mandou produzir o pedido %s — a peça volta a ficar livre.', r.numero)
                  else format('O pedido %s mudou no Tiny — a peça volta a ficar livre.', r.numero)
                end,
                jsonb_build_object('motivo', v_motivo, 'pedido_id', r.pedido_id, 'numero', r.numero,
                                   'item_seq', r.seq, 'indice_unidade', r.k,
                                   'produto_tiny_id', r.produto_tiny_id));
      v_desfeitas := v_desfeitas + 1;
    elsif not plt_privado.fn_situacao_reserva_estoque(r.situacao) then
      -- faturado / pronto para envio / enviado / entregue / não entregue: saiu
      -- com o pedido. Arquivar sem pessoa é o caminho da integração (E-26).
      insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
        values (r.id, 'card_arquivado', 'api', r.setor_atual_id,
                format('Saiu com o pedido %s (%s no Tiny).', r.numero, r.situacao),
                jsonb_build_object('motivo', 'venda', 'pedido_id', r.pedido_id, 'numero', r.numero,
                                   'item_seq', r.seq, 'indice_unidade', r.k,
                                   'produto_tiny_id', r.produto_tiny_id));
      v_consumidas := v_consumidas + 1;
    end if;
  end loop;

  return jsonb_build_object('ligado', v_desde is not null, 'pedidos_avaliados', v_avaliados,
                            'reservadas', v_reservadas, 'desfeitas', v_desfeitas,
                            'consumidas', v_consumidas);
end;
$$;

-- ----------------------------------------------------------------------------
-- 6 · Os avisos novos (catálogo recriado da viva + o público "PCP")
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_aviso_publico_de(p_publico text, p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case p_publico
           when 'todos' then true
           when 'admin' then u.papel = 'admin'
           when 'lideranca' then u.papel in ('admin', 'lider')
                                  or exists (select 1 from public.plt_usuario_setores us
                                              where us.usuario_id = u.id and us.lider_do_setor)
           when 'logistica' then u.papel in ('admin', 'logistica') or plt_privado.fn_eh_logistica(u.id)
           -- SESSAO-44: quem cuida do PCP (o setor de entrada) e os administradores
           when 'pcp' then u.papel = 'admin'
                           or exists (select 1 from public.plt_usuario_setores us
                                        join public.plt_setores s on s.id = us.setor_id
                                       where us.usuario_id = u.id and s.papel_no_fluxo = 'entrada')
           else false
         end
    from public.plt_usuarios u
   where u.id = p_usuario;
$$;

-- Avisa quem é do público (o filtro de cada pessoa vale na gravação) e deixa o
-- fato do aviso no card. Devolve quantos avisos nasceram.
create or replace function plt_privado.fn_avisar_publico(
  p_tipo text, p_publico text, p_evento_id bigint, p_card_id bigint, p_titulo text, p_corpo text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[];
begin
  with novos as (
    insert into public.plt_notificacoes (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
    select u.id, p_evento_id, p_card_id, p_tipo, left(p_titulo, 120), left(p_corpo, 600)
      from public.plt_usuarios u
     where u.ativo and u.arquivado_em is null and not u.conta_tablet
       and plt_privado.fn_aviso_publico_de(p_publico, u.id)
    returning destinatario_id
  )
  select coalesce(array_agg(destinatario_id), '{}') into v_ids from novos;
  if cardinality(v_ids) > 0 and p_card_id is not null then
    insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, observacao, dados)
      values (p_card_id, 'notificacao_enviada', 'automacao', p_evento_id, left(p_titulo, 120),
              jsonb_build_object('tipo', p_tipo, 'destinatarios', to_jsonb(v_ids)));
  end if;
  return cardinality(v_ids);
end;
$$;
comment on function plt_privado.fn_avisar_publico(text, text, bigint, bigint, text, text) is
  'SESSAO-44: aviso no sino para um público do catálogo (pcp, logistica, admin…) — o filtro de cada pessoa vale na gravação (plt_notificacoes_filtrar) — e o fato notificacao_enviada no card.';
revoke all on function plt_privado.fn_avisar_publico(text, text, bigint, bigint, text, text) from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 7 · Frente 4 — reabrir a entrega: um caminho só
-- ----------------------------------------------------------------------------
-- Reabre a entrega VIGENTE por evento: o fato `entrega_desfeita` (a projeção tira
-- a marca do card) e as peças que saíram com ELA voltam. A peça do ESTOQUE que
-- saiu com a venda volta RESERVADA ao mesmo pedido e à mesma vaga (o arquivar
-- zerou a reserva; antes ela voltava solta). Não fala com o Tiny — quem chama
-- decide. `p_voltar_estoque = false`: as peças do estoque ficam baixadas.
create or replace function plt_privado.fn_reabrir_entrega(
  p_card_id bigint, p_usuario uuid, p_origem text, p_observacao text, p_dados jsonb,
  p_voltar_estoque boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card       public.plt_cards%rowtype;
  v_entrega    public.plt_eventos%rowtype;
  v_desfeita   bigint;
  v_marca_e    text;
  v_marca_m    text;
  v_voltaram   integer := 0;
  v_reservadas integer := 0;
  v_ficaram    integer := 0;
  r            record;
begin
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found or v_card.entrega_evento_id is null then
    return jsonb_build_object('reabriu', false, 'motivo', 'nao_entregue');
  end if;
  select * into v_entrega from public.plt_eventos where id = v_card.entrega_evento_id;

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_card.id, 'entrega_desfeita', p_usuario, p_origem, nullif(btrim(p_observacao), ''),
            coalesce(p_dados, '{}'::jsonb) || jsonb_build_object('entrega_evento_id', v_entrega.id))
    returning id into v_desfeita;

  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  v_marca_m := current_setting('plt.estoque_maquinaria', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);
  perform set_config('plt.estoque_maquinaria', 'on', true);

  -- As peças que saíram com ESTA entrega (o arquivar nasce na mesma transação
  -- da entrega: o índice por tipo e hora acha só elas).
  for r in
    select distinct on (c.id) c.id, c.setor_atual_id, c.etapa_atual_id, c.pedido_id as dono, a.dados as arq
      from public.plt_eventos a
      join public.plt_cards c on c.id = a.card_id
     where a.tipo = 'card_arquivado'
       and a.ocorrido_em between v_entrega.ocorrido_em - interval '1 minute'
                             and v_entrega.ocorrido_em + interval '10 minutes'
       and (a.dados ->> 'entrega_evento_id')::bigint = v_entrega.id
       and c.arquivado_em is not null
     order by c.id, a.id desc
  loop
    if r.dono is null and r.arq ->> 'motivo' = 'venda' and not p_voltar_estoque then
      v_ficaram := v_ficaram + 1;
      continue;
    end if;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao, dados)
      values (r.id, 'card_desarquivado', p_usuario, p_origem, r.setor_atual_id, r.etapa_atual_id,
              'A entrega foi reaberta — a peça voltou.',
              jsonb_build_object('motivo', 'entrega_desfeita', 'entrega_evento_id', v_entrega.id));
    v_voltaram := v_voltaram + 1;

    -- A peça do estoque volta reservada ao mesmo pedido e à mesma vaga.
    if r.dono is null and r.arq ->> 'motivo' = 'venda'
       and nullif(r.arq ->> 'pedido_id', '') is not null
       and exists (select 1 from public.plt_cards c
                     join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
                    where c.id = r.id and c.reservada_pedido_id is null) then
      insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
        values (r.id, 'peca_reservada', 'automacao', r.setor_atual_id,
                format('A entrega do pedido %s foi reaberta — a peça volta reservada para ele.',
                       r.arq ->> 'numero'),
                jsonb_build_object('pedido_id', (r.arq ->> 'pedido_id')::bigint,
                                   'numero', (r.arq ->> 'numero')::int,
                                   'card_pedido_id', v_card.id,
                                   'item_seq', (r.arq ->> 'item_seq')::int,
                                   'indice_unidade', (r.arq ->> 'indice_unidade')::int,
                                   'produto_tiny_id', (r.arq ->> 'produto_tiny_id')::bigint,
                                   'reaberta', true));
      v_reservadas := v_reservadas + 1;
    end if;
  end loop;

  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);
  perform set_config('plt.estoque_maquinaria', coalesce(v_marca_m, ''), true);
  return jsonb_build_object('reabriu', true, 'evento_id', v_desfeita, 'entrega_evento_id', v_entrega.id,
                            'pecas_voltaram', v_voltaram, 'pecas_reservadas', v_reservadas,
                            'pecas_do_estoque_ficaram', v_ficaram);
end;
$$;
comment on function plt_privado.fn_reabrir_entrega(bigint, uuid, text, text, jsonb, boolean) is
  'SESSAO-44 (frente 4): reabre a entrega vigente por evento (entrega_desfeita + card_desarquivado das peças que saíram com ela); a peça do estoque volta RESERVADA ao mesmo pedido e vaga (ou fica baixada com p_voltar_estoque = false). Não fala com o Tiny. Caminho único do desfazer do dia, do reabrir do admin e da volta do Tiny.';
revoke all on function plt_privado.fn_reabrir_entrega(bigint, uuid, text, text, jsonb, boolean) from public, anon, authenticated;

-- A porta da tela (recriada da viva — mesma assinatura): o desfazer do dia
-- (entregador, logística) e o reabrir do admin (qualquer dia, inclusive a
-- entrega do Tiny). A parcial segue recusada.
create or replace function public.plt_fn_entrega_desfazer(p_card_id bigint, p_motivo_id bigint, p_observacao text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_admin    boolean;
  v_card     public.plt_cards%rowtype;
  v_entrega  public.plt_eventos%rowtype;
  v_motivo   text;
  v_numero   integer;
  v_situacao text;
  v_anterior text;
  v_antes    text;
  v_enviar   boolean;
  v_reabriu  jsonb;
  v_tiny     text := 'nao_enviado';
begin
  v_usuario := plt_privado.fn_usuario_atual();
  v_admin := plt_privado.fn_eh_admin();
  if v_usuario is null or not (v_admin or plt_privado.fn_pode_mexer_entrega(p_card_id)) then
    raise exception 'Desfazer a entrega é gesto do entregador do caminhão, da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select m.texto into v_motivo from public.plt_motivos m
   where m.id = p_motivo_id and m.tipo = 'desfazer_entrega' and m.ativo;
  if v_motivo is null then
    raise exception 'Escolha o motivo de desfazer a entrega.' using errcode = 'check_violation';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found or v_card.entrega_evento_id is null then
    raise exception 'Este pedido não está entregue.' using errcode = 'check_violation';
  end if;
  select * into v_entrega from public.plt_eventos where id = v_card.entrega_evento_id;
  -- SESSAO-41 (D-195): a parcial já mandou as peças que voltaram para a logística
  if coalesce((v_entrega.dados ->> 'parcial')::boolean, false) then
    raise exception 'A entrega parcial não se desfaz por aqui — as peças que voltaram já estão com a logística (Decidir situação).'
      using errcode = 'check_violation';
  end if;
  -- E-89: o desfazer do dia é da entrega feita por gente aqui, no mesmo dia.
  -- SESSAO-44 (frente 4): o administrador reabre qualquer dia e a do Tiny.
  if not v_admin then
    if v_entrega.usuario_id is null then
      raise exception 'Esta entrega veio do Tiny — só um administrador pode reabrir.' using errcode = 'check_violation';
    end if;
    if (v_entrega.ocorrido_em at time zone 'America/Fortaleza')::date
       <> (now() at time zone 'America/Fortaleza')::date then
      raise exception 'Só dá para desfazer a entrega no mesmo dia — depois disso, só um administrador pode reabrir.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- A situação para devolver ao Tiny: a de antes da entrega. A entrega do Tiny
  -- guardou o próprio "Entregue" — a de antes sai do registro dos avisos dele.
  select p.numero, p.situacao into v_numero, v_situacao from public.pedidos p where p.id = v_card.pedido_id;
  if v_entrega.usuario_id is null then
    select e.situacao into v_anterior
      from public.eventos e
     where e.numero = v_numero and e.recebido_em <= v_entrega.ocorrido_em
       and plt_privado.fn_situacao_normalizada(e.situacao) not in ('entregue', 'cancelado')
     order by e.recebido_em desc, e.id desc
     limit 1;
  else
    v_anterior := v_entrega.dados ->> 'situacao_tiny';
  end if;
  v_antes := plt_privado.fn_tiny_situacao_api(coalesce(v_anterior, 'entregue'));
  -- SESSAO-44: o Tiny só recebe a volta se ainda estiver "Entregue". A entrega
  -- feita aqui mandou o "Entregue" pela fila e o aviso de volta do Tiny pode
  -- não ter chegado: a situação de antes da entrega (ou a fila ainda por
  -- enviar) também conta como "ainda Entregue". Se o Tiny foi para outra
  -- situação, nada vai.
  v_enviar := plt_privado.fn_situacao_normalizada(v_situacao) = 'entregue'
              or (v_entrega.usuario_id is not null
                  and plt_privado.fn_situacao_normalizada(v_situacao)
                      is not distinct from plt_privado.fn_situacao_normalizada(v_entrega.dados ->> 'situacao_tiny'))
              or exists (select 1 from public.plt_tiny_pedido_fila f
                          where f.pedido_id = v_card.pedido_id
                            and f.atualizado_em > coalesce(f.enviado_em, '-infinity'::timestamptz)
                            and f.parado_em is null);

  v_reabriu := plt_privado.fn_reabrir_entrega(
    v_card.id, v_usuario, 'interface',
    v_motivo || coalesce(' — ' || nullif(btrim(p_observacao), ''), ''),
    jsonb_build_object('motivo_id', p_motivo_id, 'motivo', v_motivo,
                       'situacao_tiny_volta', case when v_enviar then v_antes end,
                       'reabertura', case when v_entrega.usuario_id is null
                                            or (v_entrega.ocorrido_em at time zone 'America/Fortaleza')::date
                                               <> (now() at time zone 'America/Fortaleza')::date
                                          then 'admin' end),
    true);

  if v_enviar then
    v_tiny := plt_privado.fn_tiny_pedido_enfileirar(v_card.pedido_id, v_antes, 'desfeita');
  end if;
  return jsonb_build_object('desfeita', true, 'pecas_voltaram', v_reabriu -> 'pecas_voltaram',
                            'pecas_reservadas', v_reabriu -> 'pecas_reservadas',
                            'tiny', v_tiny, 'situacao_tiny', case when v_enviar then v_antes end);
end;
$$;
revoke all on function public.plt_fn_entrega_desfazer(bigint, bigint, text) from public, anon;
grant execute on function public.plt_fn_entrega_desfazer(bigint, bigint, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 8 · Frente 5 — o Tiny saiu de "Entregue"
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_saiu_de_entregue(p_card_id bigint, p_numero integer, p_situacao text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_entrega public.plt_eventos%rowtype;
  v_res     jsonb;
  v_evento  bigint;
  v_nome    text;
  v_parcial boolean;
begin
  begin
    select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
    -- Sem entrega vigente: nada (o vaivém repetido cai aqui — idempotente).
    if not found or v_card.entrega_evento_id is null then
      return;
    end if;
    select * into v_entrega from public.plt_eventos where id = v_card.entrega_evento_id;
    v_parcial := coalesce((v_entrega.dados ->> 'parcial')::boolean, false);

    if v_entrega.usuario_id is null and not v_parcial then
      -- A entrega veio do Tiny: reabre pelo mesmo caminho do desfazer. Nada vai
      -- ao Tiny (ele mesmo saiu de "Entregue" — sem eco).
      v_res := plt_privado.fn_reabrir_entrega(
        v_card.id, null, 'api',
        format('O Tiny saiu de "Entregue" (agora "%s") — a entrega que veio do Tiny foi reaberta.', p_situacao),
        jsonb_build_object('motivo', 'tiny_saiu_de_entregue', 'fonte', 'tiny', 'situacao_tiny', p_situacao,
                           'tiny', 'nao_muda'),
        true);
      perform plt_privado.fn_avisar_publico(
        'tiny_saiu_de_entregue', 'logistica', (v_res ->> 'evento_id')::bigint, v_card.id,
        format('Pedido %s voltou atrás no Tiny', p_numero),
        format('O pedido %s saiu de "Entregue" no Tiny (agora "%s"). A entrega que tinha vindo do Tiny foi reaberta na plataforma e as peças voltaram.',
               p_numero, p_situacao));
    else
      -- Entrega registrada por gente aqui (ou parcial): não reabre — avisa.
      select u.nome into v_nome from public.plt_usuarios u where u.id = v_entrega.usuario_id;
      insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
        values (v_card.id, 'pedido_atualizado', 'automacao',
                format('O Tiny saiu de "Entregue" (agora "%s"), mas a entrega foi registrada na plataforma — nada foi reaberto.', p_situacao),
                jsonb_build_object('fonte', 'tiny', 'numero', p_numero, 'tiny_saiu_de_entregue', true,
                                   'situacao_depois', p_situacao, 'entrega_evento_id', v_entrega.id,
                                   'reabriu', false, 'parcial', v_parcial))
        returning id into v_evento;
      perform plt_privado.fn_avisar_publico(
        'tiny_saiu_de_entregue', 'logistica', v_evento, v_card.id,
        format('Pedido %s voltou atrás no Tiny', p_numero),
        format('O pedido %s saiu de "Entregue" no Tiny (agora "%s"), mas a entrega%s foi registrada na plataforma%s. Nada foi reaberto: confira o que aconteceu.',
               p_numero, p_situacao, case when v_parcial then ' parcial' else '' end,
               coalesce(' por ' || v_nome, '')));
    end if;
  exception when others then
    -- A reação à situação protege a gravação do pedido: o erro vira alerta.
    perform plt_privado.fn_alertar_erro(
      'automacao_erro', 'tiny_saiu_de_entregue:' || p_card_id,
      format('Não deu para reabrir o pedido %s que voltou atrás no Tiny', p_numero),
      format('O pedido %s saiu de "Entregue" no Tiny (agora "%s"), mas a plataforma não conseguiu reagir: %s',
             p_numero, p_situacao, sqlerrm),
      jsonb_build_object('pedido', p_numero, 'card_id', p_card_id, 'erro', sqlerrm),
      interval '1 hour', p_card_id);
  end;
end;
$$;
comment on function plt_privado.fn_tiny_saiu_de_entregue(bigint, integer, text) is
  'SESSAO-44 (frente 5): o Tiny saiu de "Entregue" (não para cancelado). Entrega vigente do Sistema → reabre (fn_reabrir_entrega, sem falar com o Tiny) + aviso à logística; de pessoa ou parcial → não reabre, fato na trilha + aviso; sem entrega vigente → nada. Erro vira alerta (fn_alertar_erro) sem derrubar a gravação do pedido.';
revoke all on function plt_privado.fn_tiny_saiu_de_entregue(bigint, integer, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9 · Frente 2 — os itens que o Tiny mudou
-- ----------------------------------------------------------------------------
-- Os itens de produção (frete fora, quantidade arredondada) de uma lista do Tiny,
-- somados por produto: {chave: {codigo, descricao, unidades}}. As mesmas regras
-- de fn_upsert_pedido (o item embrulhado em "item"; objeto quando é um só) e da
-- view de itens.
create or replace function plt_privado.fn_itens_resumo(p_itens jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with lista as (
    select nullif(trim(coalesce(i ->> 'codigo', '')), '') as codigo,
           nullif(trim(coalesce(i ->> 'descricao', '')), '') as descricao,
           nullif(replace(trim(coalesce(i ->> 'quantidade', '')), ',', '.'), '')::numeric as qtd
      from jsonb_array_elements(
             case jsonb_typeof(coalesce(p_itens, '[]'::jsonb))
               when 'array' then coalesce(p_itens, '[]'::jsonb)
               else jsonb_build_array(p_itens)
             end) x
      cross join lateral (select coalesce(x -> 'item', x) as i) y
  ),
  prod as (
    select l.codigo, l.descricao,
           case when plt_privado.fn_eh_frete(l.descricao) then 0
                when round(coalesce(l.qtd, 0)) >= 1 then round(l.qtd)::int
                else 0 end as unidades,
           plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(l.codigo, l.descricao),
                                     l.codigo, l.descricao) as chave
      from lista l
  )
  select coalesce(jsonb_object_agg(g.chave, jsonb_build_object(
           'codigo', g.codigo, 'descricao', g.descricao, 'unidades', g.unidades)), '{}'::jsonb)
    from (select p.chave, min(p.codigo) as codigo, min(p.descricao) as descricao,
                 sum(p.unidades)::int as unidades
            from prod p
           where p.unidades > 0
           group by p.chave) g;
$$;
revoke all on function plt_privado.fn_itens_resumo(jsonb) from public, anon, authenticated;

-- O gatilho ADIADO (A-47): roda no COMMIT, quando `fn_upsert_pedido` já regravou
-- os itens. Compara a lista de antes (o raw antigo) com a de agora.
create or replace function plt_privado.fn_reagir_itens_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes    jsonb;
  v_depois   jsonb;
  v_entrou   jsonb := '[]'::jsonb;
  v_saiu     jsonb := '[]'::jsonb;
  v_card     public.plt_cards%rowtype;
  v_entrega  public.plt_eventos%rowtype;
  v_fluxo    text;
  v_evento   bigint;
  v_sobram   jsonb;
  v_lista_e  text;
  v_lista_s  text;
  v_em_rota  boolean;
  v_marca    text;
  k          text;
  n_a        integer;
  n_d        integer;
begin
  begin
    v_antes  := plt_privado.fn_itens_resumo(old.raw -> 'itens');
    v_depois := plt_privado.fn_itens_resumo(new.raw -> 'itens');
    for k in select jsonb_object_keys(v_antes || v_depois) loop
      n_a := coalesce((v_antes -> k ->> 'unidades')::int, 0);
      n_d := coalesce((v_depois -> k ->> 'unidades')::int, 0);
      if n_d > n_a then
        v_entrou := v_entrou || jsonb_build_array((v_depois -> k) || jsonb_build_object('unidades', n_d - n_a));
      elsif n_a > n_d then
        v_saiu := v_saiu || jsonb_build_array((v_antes -> k) || jsonb_build_object('unidades', n_a - n_d));
      end if;
    end loop;
    -- Só preço, observação, ordem ou frete: nada muda na produção.
    if jsonb_array_length(v_entrou) = 0 and jsonb_array_length(v_saiu) = 0 then
      return null;
    end if;

    select * into v_card from public.plt_cards c
     where c.pedido_id = new.id and c.tipo = 'pedido'
       for update;
    if not found or plt_privado.fn_situacao_normalizada(new.situacao) = 'cancelado' then
      return null;
    end if;

    select string_agg(x ->> 'unidades' || '× ' || coalesce(x ->> 'descricao', x ->> 'codigo', 'item'), '; ')
      into v_lista_e from jsonb_array_elements(v_entrou) x;
    select string_agg(x ->> 'unidades' || '× ' || coalesce(x ->> 'descricao', x ->> 'codigo', 'item'), '; ')
      into v_lista_s from jsonb_array_elements(v_saiu) x;

    if v_card.entrega_evento_id is not null then
      select * into v_entrega from public.plt_eventos where id = v_card.entrega_evento_id;
      v_fluxo := case when coalesce((v_entrega.dados ->> 'parcial')::boolean, false) then 'entregue_parcial'
                      when exists (select 1 from public.plt_eventos d
                                    where d.card_id = v_card.id and d.tipo = 'pedido_devolvido'
                                      and d.id > v_entrega.id) then 'devolvido'
                      else 'entregue' end;
    elsif v_card.arquivado_em is not null then
      -- card que saiu dos quadros sem entrega (limpeza, arquivado à mão): fica
      -- como está — o Tiny reler os itens de um pedido antigo não o ressuscita
      return null;
    else
      v_em_rota := v_card.lancado_rotas_em is not null
                   or exists (select 1 from public.plt_programacoes pr where pr.card_id = v_card.id);
      v_fluxo := case when v_em_rota then 'em_rota' else 'producao' end;
    end if;

    insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
      values (v_card.id, 'pedido_itens_alterados', 'automacao',
              concat_ws(' ', case when v_lista_e is not null then 'Entrou no Tiny: ' || v_lista_e || '.' end,
                             case when v_lista_s is not null then 'Saiu no Tiny: ' || v_lista_s || '.' end),
              jsonb_build_object('fonte', 'tiny', 'numero', new.numero, 'entrou', v_entrou, 'saiu', v_saiu,
                                 'fluxo', v_fluxo))
      returning id into v_evento;

    -- Já entregue (inteira): os itens novos viram uma pendência — a entrega
    -- reabre SÓ na plataforma (o Tiny não muda) e o que ficou com o cliente
    -- segue entregue (a conta do que falta entregar já desconta).
    if v_fluxo = 'entregue' and jsonb_array_length(v_entrou) > 0 then
      insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
        values (v_card.id, 'entrega_desfeita', 'automacao',
                'Itens novos no Tiny depois da entrega — a entrega foi reaberta só na plataforma, para os itens novos (o Tiny segue como está).',
                jsonb_build_object('entrega_evento_id', v_entrega.id, 'motivo', 'itens_novos',
                                   'fonte', 'tiny', 'tiny', 'nao_muda', 'itens_alterados_evento_id', v_evento));
      delete from public.plt_programacoes where card_id = v_card.id;
      if v_card.arquivado_em is not null then
        v_marca := current_setting('plt.entrega_maquinaria', true);
        perform set_config('plt.entrega_maquinaria', 'on', true);
        insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
          values (v_card.id, 'card_desarquivado', 'automacao',
                  'Itens novos no Tiny: o pedido volta com uma pendência só dos itens novos.',
                  jsonb_build_object('motivo', 'itens_novos', 'itens_alterados_evento_id', v_evento));
        perform set_config('plt.entrega_maquinaria', coalesce(v_marca, ''), true);
      end if;
      v_fluxo := 'entregue_reaberto';
    end if;

    -- A conta da liberação: com vaga nova sem peça, o pedido volta ao quadro
    -- do PCP (o que já está em andamento não muda).
    perform plt_privado.fn_recalcular_liberacao(new.id);

    if jsonb_array_length(v_entrou) > 0 then
      perform plt_privado.fn_avisar_publico(
        'pedido_itens_novos', 'pcp', v_evento, v_card.id,
        format('Pedido %s ganhou itens no Tiny', new.numero),
        format('Entrou no pedido %s: %s. %s', new.numero, v_lista_e,
               case v_fluxo
                 when 'entregue_reaberto' then 'O pedido já tinha sido entregue: ficou uma pendência só com os itens novos.'
                 when 'entregue_parcial' then 'A entrega foi parcial: nada foi reaberto sozinho — veja com a logística.'
                 when 'devolvido' then 'O pedido foi devolvido: nada foi reaberto sozinho — veja com a logística.'
                 else 'O pedido voltou ao PCP só com o que falta liberar.'
               end));
      if v_fluxo = 'em_rota' then
        perform plt_privado.fn_avisar_publico(
          'pedido_itens_rota', 'logistica', v_evento, v_card.id,
          format('Segure a entrega do pedido %s', new.numero),
          format('O pedido %s está na rota e ganhou itens no Tiny: %s. Ele voltou ao PCP com os itens novos — segure a entrega até eles ficarem prontos.',
                 new.numero, v_lista_e));
      elsif v_fluxo in ('entregue_parcial', 'devolvido') then
        perform plt_privado.fn_avisar_publico(
          'pedido_itens_rota', 'logistica', v_evento, v_card.id,
          format('Pedido %s ganhou itens depois da entrega', new.numero),
          format('O pedido %s ganhou itens no Tiny (%s) depois da entrega %s. Nada foi reaberto sozinho: decida com o PCP.',
                 new.numero, v_lista_e, case v_fluxo when 'devolvido' then 'devolvida' else 'parcial' end));
      end if;
    end if;

    -- Item que saiu (ou diminuiu) e já tem peça: nunca arquiva sozinho — avisa.
    select jsonb_agg(jsonb_build_object('card_id', u.id, 'codigo', u.item_codigo, 'descricao', u.item_descricao))
      into v_sobram
      from public.plt_cards u
     where u.pedido_id = new.id and u.tipo = 'unidade' and u.arquivado_em is null
       and not plt_privado.fn_eh_frete(u.item_descricao)
       and not exists (select 1 from plt_privado.fn_vagas_pedido(new.id) w where w.card_id = u.id);
    if v_sobram is not null then
      perform plt_privado.fn_avisar_publico(
        'pedido_itens_sairam', 'pcp', v_evento, v_card.id,
        format('Pedido %s: item saiu com peça feita', new.numero),
        format('Saiu (ou diminuiu) no Tiny do pedido %s: %s. Já existe peça para isso (%s) — nada foi arquivado: decida o que fazer com ela.',
               new.numero, coalesce(v_lista_s, 'um item'),
               (select string_agg(coalesce(x ->> 'descricao', x ->> 'codigo'), '; ') from jsonb_array_elements(v_sobram) x)));
    end if;
  exception when others then
    -- Protege a gravação do pedido: o erro vira alerta para os administradores.
    begin
      perform plt_privado.fn_alertar_erro(
        'automacao_erro', 'itens_tiny:' || new.id,
        format('Não deu para reagir aos itens novos do pedido %s', new.numero),
        format('O Tiny mudou os itens do pedido %s, mas a plataforma não conseguiu reagir: %s', new.numero, sqlerrm),
        jsonb_build_object('pedido', new.numero, 'pedido_id', new.id, 'erro', sqlerrm),
        interval '1 hour', null);
    exception when others then
      raise warning 'plt_reagir_itens_pedido: % — a integração segue intacta', sqlerrm;
    end;
  end;
  return null;
end;
$$;
comment on function plt_privado.fn_reagir_itens_pedido() is
  'SESSAO-44 (frente 2): no COMMIT da gravação do Tiny, compara os itens de produção de antes e de agora por produto; mudou → fato pedido_itens_alterados (entrou/saiu/fluxo), entrega inteira reaberta só na plataforma para os itens novos, conta da liberação refeita (o pedido volta ao PCP só com o que falta), avisos (PCP; logística em rota, parcial ou devolvido) e o aviso da peça que sobrou (nunca arquiva). Erro vira alerta.';
revoke all on function plt_privado.fn_reagir_itens_pedido() from public, anon, authenticated;

drop trigger if exists plt_pedidos_zz_itens on public.pedidos;
create constraint trigger plt_pedidos_zz_itens
  after update of raw on public.pedidos
  deferrable initially deferred
  for each row
  when ((old.raw -> 'itens') is distinct from (new.raw -> 'itens'))
  execute function plt_privado.fn_reagir_itens_pedido();


-- ----------------------------------------------------------------------------
-- 10 · As portas recriadas da versão VIVA (extração + trocas conferidas por
--      contagem — A-97): a vaga coberta pelo produto, o frete do card, o
--      pedido em rota que ganhou itens libera só o que falta, os avisos novos
--      no catálogo e a volta do Tiny na reação ao pedido.
-- ----------------------------------------------------------------------------
-- public.plt_fn_pcp_liberacao — recriada da versão VIVA (pg_get_functiondef) com as trocas da SESSAO-44
CREATE OR REPLACE FUNCTION public.plt_fn_pcp_liberacao(p_card_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_card public.plt_cards%rowtype;
  v_itens jsonb;
  v_ja    jsonb;
  v_sug   jsonb := '[]'::jsonb;
  v_prod  jsonb := '[]'::jsonb;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Liberar é gesto do PCP/logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards c
   where c.id = p_card_id and c.tipo in ('pedido', 'reposicao');
  if not found then
    raise exception 'Este card não existe.' using errcode = 'no_data_found';
  end if;

  if v_card.tipo = 'reposicao' then
    v_itens := jsonb_build_array(jsonb_build_object(
      'seq', 1, 'codigo', v_card.item_codigo, 'descricao', v_card.item_descricao,
      'unidades', coalesce(v_card.total_unidades, 0)));
    -- D-201: a peça desta reposição que passou a ser de um pedido segue
    -- ocupando a vaga dela (a reposição só perde a peça).
    select coalesce(jsonb_agg(jsonb_build_object('item_seq', 1, 'indice_unidade', x.k) order by x.k), '[]'::jsonb)
      into v_ja
      from (
        select u.indice_unidade as k
          from public.plt_cards u
         where u.card_pai_id = v_card.id and u.tipo = 'unidade' and u.pedido_id is null
        union
        select (e.dados ->> 'vaga_reposicao')::int
          from public.plt_cards u
          join public.plt_eventos e on e.card_id = u.id and e.tipo = 'peca_vinculada'
         where u.card_pai_id = v_card.id and u.tipo = 'unidade' and u.pedido_id is not null
           and e.dados ->> 'reposicao_card_id' = v_card.id::text
      ) x
     where x.k is not null;
  else
    -- D-63: frete não vira unidade (vw_itens_producao).
    select coalesce(jsonb_agg(jsonb_build_object('seq', v.seq, 'codigo', v.codigo,
                                                 'descricao', v.descricao, 'unidades', v.unidades)
                              order by v.seq), '[]'::jsonb)
      into v_itens
      from plt_privado.vw_itens_producao v
     where v.pedido_id = v_card.pedido_id and v.unidades >= 1;
    -- SESSAO-44 (frente 3): a vaga é coberta pela peça do MESMO produto (a
    -- posição só desempata) — item inserido no meio da lista não troca nada.
    select coalesce(jsonb_agg(jsonb_build_object('item_seq', w.seq, 'indice_unidade', w.indice)
                              order by w.seq, w.indice), '[]'::jsonb)
      into v_ja
      from plt_privado.fn_vagas_pedido(v_card.pedido_id) w
     where w.card_id is not null;
    select coalesce(jsonb_agg(to_jsonb(s) order by s.item_seq, s.indice_unidade), '[]'::jsonb)
      into v_sug
      from public.plt_fn_sugestoes_alocacao(v_card.id) s;
    -- D-201: a peça igual sem dono que ainda está em produção, para o que o estoque não cobre.
    select coalesce(jsonb_agg(to_jsonb(s) order by s.item_seq, s.indice_unidade), '[]'::jsonb)
      into v_prod
      from plt_privado.fn_sugestoes_em_producao(v_card.id, v_sug) s;
  end if;

  return jsonb_build_object('itens', v_itens, 'ja_liberadas', v_ja, 'sugestoes', v_sug, 'em_producao', v_prod);
end;
$function$
;

-- public.plt_fn_pcp_liberar — recriada da versão VIVA (pg_get_functiondef) com as trocas da SESSAO-44
CREATE OR REPLACE FUNCTION public.plt_fn_pcp_liberar(p_card_id bigint, p_unidades jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_usuario   uuid;
  v_card      public.plt_cards%rowtype;
  v_pcp       bigint;
  v_u         jsonb;
  v_seq       integer;
  v_k         integer;
  v_peca      bigint;
  v_setor     bigint;
  v_etapa     bigint;
  v_codigo    text;
  v_desc      text;
  v_n         integer;
  v_novo      bigint;
  v_alocadas  integer := 0;
  v_liberadas integer := 0;
  v_vinculadas integer := 0;
  v_puladas   integer := 0;
  v_cards     bigint[] := '{}';
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Liberar é gesto do PCP/logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_unidades) is distinct from 'array' or jsonb_array_length(p_unidades) = 0 then
    raise exception 'Selecione pelo menos uma unidade para liberar.' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_unidades) > 500 then
    raise exception 'No máximo 500 unidades por vez.' using errcode = 'check_violation';
  end if;

  -- A trava do card do pedido/reposição: duas pessoas liberando o mesmo
  -- pedido ao mesmo tempo esperam uma pela outra (a segunda pula o que a
  -- primeira já liberou).
  select * into v_card from public.plt_cards c
   where c.id = p_card_id and c.tipo in ('pedido', 'reposicao') and c.arquivado_em is null
   for update;
  if not found then
    raise exception 'Este card não está mais no PCP (pode ter sido arquivado).' using errcode = 'no_data_found';
  end if;
  -- SESSAO-44 (frente 2): o pedido em rota que ganhou itens novos no Tiny
  -- volta ao PCP só com o que falta — e só isso se libera.
  if v_card.tipo = 'pedido' and v_card.lancado_rotas_em is not null
     and v_card.liberado_completo_em is not null then
    raise exception 'Este pedido já foi lançado para ROTAS.' using errcode = 'check_violation';
  end if;
  select s.id into v_pcp from public.plt_setores s where s.codigo = 'pcp';

  -- 1º as peças do estoque (a sugestão aceita): a unidade nasce pronta no aguardo.
  for v_u in select x from jsonb_array_elements(p_unidades) x where x ? 'peca_card_id' loop
    v_seq  := (v_u ->> 'item_seq')::int;
    v_k    := (v_u ->> 'indice_unidade')::int;
    v_peca := (v_u ->> 'peca_card_id')::bigint;
    if v_card.tipo <> 'pedido' then
      raise exception 'A reposição não usa peça do estoque.' using errcode = 'check_violation';
    end if;
    if plt_privado.fn_vaga_coberta(v_card.pedido_id, v_seq, v_k) then
      v_puladas := v_puladas + 1;
      continue;
    end if;
    v_novo := public.plt_fn_alocar_peca(v_card.id, v_seq, v_k, v_peca);
    v_cards := v_cards || v_novo;
    v_alocadas := v_alocadas + 1;
  end loop;

  -- D-201: 2º as peças SEM DONO que ainda estão em produção — passam a ser
  -- deste pedido onde estão (setor, etapa, quem trabalha e o tempo seguem).
  for v_u in select x from jsonb_array_elements(p_unidades) x where x ? 'peca_producao_id' loop
    v_seq  := (v_u ->> 'item_seq')::int;
    v_k    := (v_u ->> 'indice_unidade')::int;
    v_peca := (v_u ->> 'peca_producao_id')::bigint;
    if v_card.tipo <> 'pedido' then
      raise exception 'A reposição não usa peça que já está em produção.' using errcode = 'check_violation';
    end if;
    if plt_privado.fn_vaga_coberta(v_card.pedido_id, v_seq, v_k) then
      v_puladas := v_puladas + 1;
      continue;
    end if;
    perform plt_privado.fn_vincular_peca_producao(v_card, v_seq, v_k, v_peca, v_usuario);
    v_cards := v_cards || v_peca;
    v_vinculadas := v_vinculadas + 1;
  end loop;

  -- 3º as que vão para a produção (raio-x 3: só setor de produção).
  for v_u in select x from jsonb_array_elements(p_unidades) x
              where not (x ? 'peca_card_id') and not (x ? 'peca_producao_id') loop
    v_seq   := (v_u ->> 'item_seq')::int;
    v_k     := (v_u ->> 'indice_unidade')::int;
    v_setor := nullif(v_u ->> 'setor_id', '')::bigint;
    v_etapa := nullif(nullif(v_u ->> 'etapa_id', ''), '0')::bigint;
    if v_setor is null
       or not exists (select 1 from public.plt_setores s
                       where s.id = v_setor and s.ativo and s.papel_no_fluxo = 'producao') then
      raise exception 'O PCP libera a peça para um setor de produção. Peça pronta do estoque vai pela sugestão "usar?" — ela nasce pronta em Pedidos em aguardo.'
        using errcode = 'check_violation';
    end if;
    if v_etapa is not null
       and not exists (select 1 from public.plt_etapas e where e.id = v_etapa and e.setor_id = v_setor and e.ativa) then
      raise exception 'A etapa escolhida não é deste setor (ou foi desativada).' using errcode = 'check_violation';
    end if;

    if v_card.tipo = 'reposicao' then
      v_codigo := v_card.item_codigo;
      v_desc   := v_card.item_descricao;
      v_n      := v_card.total_unidades;
      if v_seq is distinct from 1 or v_k is null or v_k < 1 or v_k > coalesce(v_n, 0) then
        raise exception 'Esta unidade não existe na reposição.' using errcode = 'check_violation';
      end if;
      -- D-201: a vaga da peça que foi para um pedido continua ocupada.
      if exists (select 1 from public.plt_cards u
                  where u.card_pai_id = v_card.id and u.tipo = 'unidade'
                    and u.pedido_id is null and u.indice_unidade = v_k)
         or exists (select 1 from public.plt_cards u
                      join public.plt_eventos e on e.card_id = u.id and e.tipo = 'peca_vinculada'
                     where u.card_pai_id = v_card.id and u.tipo = 'unidade' and u.pedido_id is not null
                       and e.dados ->> 'reposicao_card_id' = v_card.id::text
                       and (e.dados ->> 'vaga_reposicao')::int = v_k) then
        v_puladas := v_puladas + 1;
        continue;
      end if;
    else
      v_n := null;
      select v.codigo, v.descricao, v.unidades into v_codigo, v_desc, v_n
        from plt_privado.vw_itens_producao v
       where v.pedido_id = v_card.pedido_id and v.seq = v_seq and v.unidades >= 1;
      if v_n is null or v_k is null or v_k < 1 or v_k > v_n then
        raise exception 'Esta unidade não existe no pedido.' using errcode = 'check_violation';
      end if;
      if plt_privado.fn_vaga_coberta(v_card.pedido_id, v_seq, v_k) then
        v_puladas := v_puladas + 1;
        continue;
      end if;
    end if;

    insert into public.plt_cards
        (tipo, pedido_id, produto_tiny_id, card_pai_id, item_seq, item_codigo, item_descricao,
         indice_unidade, total_unidades, setor_atual_id)
      values
        ('unidade', case when v_card.tipo = 'pedido' then v_card.pedido_id end,
         case when v_card.tipo = 'reposicao' then v_card.produto_tiny_id end,
         v_card.id, v_seq, v_codigo, v_desc, v_k, v_n, v_pcp)
      returning id into v_novo;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id)
      values (v_novo, 'card_criado', v_usuario, 'interface', v_pcp);
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, setor_destino_id, etapa_destino_id)
      values (v_novo, 'movimentacao_setor', v_usuario, 'interface', v_pcp, v_setor, v_etapa);
    v_cards := v_cards || v_novo;
    v_liberadas := v_liberadas + 1;
  end loop;

  -- D-201: a peça ligada não passa pelo PCP — o quadro do PCP fica sabendo pelo pedido.
  if v_vinculadas > 0 then
    perform plt_privado.fn_avisar('pcp');
  end if;

  return jsonb_build_object('alocadas', v_alocadas, 'liberadas', v_liberadas, 'vinculadas', v_vinculadas,
                            'ja_liberadas', v_puladas, 'cards', to_jsonb(v_cards));
end;
$function$
;

-- public.plt_fn_alocar_peca — recriada da versão VIVA (pg_get_functiondef) com as trocas da SESSAO-44
CREATE OR REPLACE FUNCTION public.plt_fn_alocar_peca(p_card_pedido_id bigint, p_item_seq integer, p_indice_unidade integer, p_peca_card_id bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_usuario  uuid;
  v_pc       public.plt_cards%rowtype;
  v_peca     public.plt_cards%rowtype;
  v_codigo   text;
  v_descricao text;
  v_n        integer;
  v_estoque  bigint;
  v_aguardo  bigint;
  v_numero   integer;
  v_origem   text;
  v_novo     bigint;
  v_reservada boolean;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma usa peça do estoque.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Usar peça do estoque num pedido é gesto do PCP/logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_pc from public.plt_cards
   where id = p_card_pedido_id and tipo = 'pedido' and arquivado_em is null
   for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_pedido_id using errcode = 'no_data_found';
  end if;
  if v_pc.lancado_rotas_em is not null then
    raise exception 'Este pedido já foi lançado para ROTAS.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_pedido_cancelado(v_pc.pedido_id) then
    raise exception 'O pedido foi cancelado no Tiny — não recebe peça do estoque.' using errcode = 'check_violation';
  end if;

  -- D-63: item de frete não tem unidade (vw_itens_producao: unidades = 0).
  select v.codigo, v.descricao, v.unidades
    into v_codigo, v_descricao, v_n
    from plt_privado.vw_itens_producao v
   where v.pedido_id = v_pc.pedido_id and v.seq = p_item_seq
     and v.unidades >= 1;
  if v_n is null or p_indice_unidade is null or p_indice_unidade < 1 or p_indice_unidade > v_n then
    raise exception 'Esta unidade não existe no pedido.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_vaga_coberta(v_pc.pedido_id, p_item_seq, p_indice_unidade) then
    raise exception 'Esta unidade do pedido já foi liberada.' using errcode = 'check_violation';
  end if;

  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';
  select s.id into v_aguardo from public.plt_setores s where s.codigo = 'aguardo' and s.ativo;
  if v_aguardo is null then
    raise exception 'Pedidos em aguardo não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  select * into v_peca from public.plt_cards where id = p_peca_card_id for update;
  if not found or v_peca.tipo <> 'unidade' or v_peca.pedido_id is not null
     or v_peca.arquivado_em is not null or v_peca.setor_atual_id is distinct from v_estoque then
    raise exception 'Esta peça não está livre no ESTOQUE (alguém pode ter usado antes).'
      using errcode = 'check_violation';
  end if;
  -- D-78: a peça reservada para OUTRO pedido não serve; a deste, sim.
  if v_peca.reservada_pedido_id is not null and v_peca.reservada_pedido_id <> v_pc.pedido_id then
    raise exception 'Esta peça está reservada para outro pedido.' using errcode = 'check_violation';
  end if;
  v_reservada := v_peca.reservada_pedido_id is not null;
  if coalesce(v_peca.qualidade_atual, 'perfeito') <> 'perfeito' then
    raise exception 'Só peça em perfeito estado vai para um pedido.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_chave_peca(v_peca.produto_tiny_id, v_peca.item_codigo, v_peca.item_descricao)
     <> plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(v_codigo, v_descricao), v_codigo, v_descricao) then
    raise exception 'A peça do estoque não é igual ao item do pedido (produto, cor e medidas).'
      using errcode = 'check_violation';
  end if;

  select p.numero into v_numero from public.pedidos p where p.id = v_pc.pedido_id;
  select case when pai.tipo = 'reposicao' then 'reposicao' else 'cancelamento' end
    into v_origem
    from public.plt_cards pai where pai.id = v_peca.card_pai_id;

  -- A unidade do pedido nasce PRONTA, direto no aguardo (não volta à produção).
  insert into public.plt_cards
      (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao,
       indice_unidade, total_unidades, produto_tiny_id, setor_atual_id)
    values
      ('unidade', v_pc.pedido_id, v_pc.id, p_item_seq, v_codigo, v_descricao,
       p_indice_unidade, v_n, v_peca.produto_tiny_id, v_aguardo)
    returning id into v_novo;

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id, observacao, dados)
    values (v_novo, 'card_criado', v_usuario, 'interface', v_aguardo,
            'Veio do estoque: peça pronta sem dono usada pelo pedido.',
            jsonb_build_object('alocada_de', v_peca.id,
                               'origem_peca', coalesce(v_origem, 'manual'),
                               'pedido_id', v_pc.pedido_id,
                               'numero', v_numero,
                               'reservada', v_reservada));

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
    values (v_peca.id, 'peca_alocada', v_usuario, 'interface', v_peca.setor_atual_id,
            'Usada pelo pedido ' || coalesce(v_numero::text, '')
              || format(' (%s/%s)', p_indice_unidade, v_n) || '.',
            jsonb_build_object('pedido_id', v_pc.pedido_id,
                               'numero', v_numero,
                               'card_pedido_id', v_pc.id,
                               'unidade_card_id', v_novo,
                               'item_seq', p_item_seq,
                               'indice_unidade', p_indice_unidade,
                               'reservada', v_reservada));
  return v_novo;
end;
$function$
;

-- public.plt_fn_sugestoes_alocacao — recriada da versão VIVA (pg_get_functiondef) com as trocas da SESSAO-44
CREATE OR REPLACE FUNCTION public.plt_fn_sugestoes_alocacao(p_card_id bigint)
 RETURNS TABLE(item_seq integer, indice_unidade integer, total_unidades integer, peca_card_id bigint, peca_origem text, peca_origem_numero integer, pecas_iguais integer, reservada boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with alvo as (
    select pc.id, pc.pedido_id
      from public.plt_cards pc
     where pc.id = p_card_id
       and pc.tipo = 'pedido'
       and pc.arquivado_em is null
       and (pc.lancado_rotas_em is null or pc.liberado_completo_em is null)
       and plt_privado.fn_pode_ver_expedicao()
       and not plt_privado.fn_pedido_cancelado(pc.pedido_id)
  ),
  itens as (
    -- D-63: frete não é vaga (vw_itens_producao: unidades = 0).
    select v.seq, v.unidades as n,
           plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(v.codigo, v.descricao),
                                     v.codigo, v.descricao) as chave
      from plt_privado.vw_itens_producao v
      join alvo a on a.pedido_id = v.pedido_id
     where v.unidades >= 1
  ),
  -- SESSAO-44 (frente 3): cobertura e reserva pelo produto (a posição desempata).
  casadas as materialized (
    select w.seq, w.indice, w.card_id, w.reserva_card_id
      from alvo a cross join lateral plt_privado.fn_vagas_pedido(a.pedido_id) w
  ),
  vagas as (
    select i.seq, k.k, i.n, i.chave
      from itens i
      cross join lateral generate_series(1, i.n) as k(k)
     where not exists (
       select 1 from casadas cs
        where cs.seq = i.seq and cs.indice = k.k and cs.card_id is not null)
  ),
  -- D-78: a peça que a venda reservou para ESTA vaga.
  reservas as (
    select c.id, c.card_pai_id, cs.seq, cs.indice as k
      from casadas cs
      join public.plt_cards c on c.id = cs.reserva_card_id
     where cs.card_id is null
       and c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
  ),
  vagas_livres as (
    select v.*, row_number() over (partition by v.chave order by v.seq, v.k) as ordem
      from vagas v
     where not exists (select 1 from reservas r where r.seq = v.seq and r.k = v.k)
  ),
  -- SESSAO-30: só as peças CANDIDATAS — do produto dos itens (índice das
  -- livres por produto) e as sem produto do catálogo (índice delas; a chave
  -- delas é SKU + descrição). A chave e a contagem por chave não mudam.
  produtos_itens as (
    select distinct plt_privado.fn_produto_do_item(v.codigo, v.descricao) as produto
      from plt_privado.vw_itens_producao v
      join alvo a on a.pedido_id = v.pedido_id
     where v.unidades >= 1
  ),
  candidatas as (
    select c.* from public.plt_cards c
     where c.tipo = 'unidade' and c.arquivado_em is null and c.pedido_id is null
       and c.produto_tiny_id in (select pi.produto from produtos_itens pi where pi.produto is not null)
    union all
    select c.* from public.plt_cards c
     where c.tipo = 'unidade' and c.arquivado_em is null and c.pedido_id is null
       and c.produto_tiny_id is null
  ),
  livres as (
    select c.id, c.desde, c.card_pai_id,
           plt_privado.fn_chave_peca(c.produto_tiny_id, c.item_codigo, c.item_descricao) as chave
      from candidatas c
      join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
     where exists (select 1 from alvo)
       and c.reservada_pedido_id is null
       and coalesce(c.qualidade_atual, 'perfeito') = 'perfeito'
  ),
  pecas as (
    select l.*,
           row_number() over (partition by l.chave order by l.desde, l.id) as ordem,
           count(*) over (partition by l.chave)                             as iguais
      from livres l
  ),
  escolhas as (
    select v.seq, v.k, v.n, r.id as peca, r.card_pai_id,
           (select count(*) from reservas) + coalesce((select max(p.iguais) from pecas p where p.chave = v.chave), 0) as iguais,
           true as reservada
      from vagas v
      join reservas r on r.seq = v.seq and r.k = v.k
    union all
    select v.seq, v.k, v.n, p.id, p.card_pai_id, p.iguais, false
      from vagas_livres v
      join pecas p on p.chave = v.chave and p.ordem = v.ordem
  )
  select e.seq,
         e.k,
         e.n,
         e.peca,
         case when pai.tipo = 'reposicao' then 'reposicao'
              when pai.tipo = 'pedido'    then 'cancelamento'
              else 'manual' end,
         case when pai.tipo = 'pedido' then ped.numero end,
         e.iguais::int,
         e.reservada
    from escolhas e
    left join public.plt_cards pai on pai.id = e.card_pai_id
    left join public.pedidos ped on ped.id = pai.pedido_id
   order by e.seq, e.k;
$function$
;

-- plt_privado.fn_sugestoes_em_producao — recriada da versão VIVA (pg_get_functiondef) com as trocas da SESSAO-44
CREATE OR REPLACE FUNCTION plt_privado.fn_sugestoes_em_producao(p_card_id bigint, p_cobertas jsonb)
 RETURNS TABLE(item_seq integer, indice_unidade integer, total_unidades integer, peca_card_id bigint, setor_nome text, etapa_nome text, peca_origem text, peca_origem_numero integer, pecas_iguais integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with alvo as (
    select pc.id, pc.pedido_id
      from public.plt_cards pc
     where pc.id = p_card_id
       and pc.tipo = 'pedido'
       and pc.arquivado_em is null
       and (pc.lancado_rotas_em is null or pc.liberado_completo_em is null)
       and not plt_privado.fn_pedido_cancelado(pc.pedido_id)
  ),
  itens as (
    -- D-63: frete não é vaga (vw_itens_producao: unidades = 0).
    select v.seq, v.unidades as n, v.codigo, x.produto,
           plt_privado.fn_chave_peca(x.produto, v.codigo, v.descricao) as chave
      from plt_privado.vw_itens_producao v
      join alvo a on a.pedido_id = v.pedido_id
     cross join lateral (select plt_privado.fn_produto_do_item(v.codigo, v.descricao) as produto) x
     where v.unidades >= 1
  ),
  -- SESSAO-44 (frente 3): as vagas cobertas pela peça do mesmo produto — uma vez só
  cobertas as materialized (
    select w.seq, w.indice
      from alvo a cross join lateral plt_privado.fn_vagas_pedido(a.pedido_id) w
     where w.card_id is not null
  ),
  -- as vagas ainda sem unidade e que o estoque não cobre (a sugestão do estoque vem antes)
  vagas as (
    select i.seq, k.k, i.n, i.chave,
           row_number() over (partition by i.chave order by i.seq, k.k) as ordem
      from itens i
      cross join lateral generate_series(1, i.n) as k(k)
     where not exists (
             select 1 from cobertas cb where cb.seq = i.seq and cb.indice = k.k)
       and not exists (
             select 1 from jsonb_array_elements(coalesce(p_cobertas, '[]'::jsonb)) c
              where (c ->> 'item_seq')::int = i.seq and (c ->> 'indice_unidade')::int = k.k)
  ),
  candidatas as (
    -- da REPOSIÇÃO: sem dono, pelo produto (o índice das peças sem dono por produto)
    select c.id, c.setor_atual_id, c.etapa_atual_id, c.desde, c.concluido_em, c.qualidade_atual,
           'reposicao'::text as origem, null::integer as origem_numero,
           plt_privado.fn_chave_peca(c.produto_tiny_id, c.item_codigo, c.item_descricao) as chave
      from public.plt_cards c
      join public.plt_cards rp on rp.id = c.card_pai_id and rp.tipo = 'reposicao'
     where c.tipo = 'unidade' and c.arquivado_em is null and c.pedido_id is null
       and c.produto_tiny_id in (select i.produto from itens i where i.produto is not null)
    union all
    -- de pedido CANCELADO que segue em produção: pelo SKU (o índice das peças de pedido por SKU)
    select c.id, c.setor_atual_id, c.etapa_atual_id, c.desde, c.concluido_em, c.qualidade_atual,
           'cancelamento', x.numero,
           plt_privado.fn_chave_peca(coalesce(c.produto_tiny_id,
                                              plt_privado.fn_produto_do_item(c.item_codigo, c.item_descricao)),
                                     c.item_codigo, c.item_descricao)
      from public.plt_cards c
      -- o pedido de CADA peça do mesmo SKU (o caminho é o índice do SKU; nunca o de
      -- todos os cancelados — no ensaio ×100 o planejador ia pelos 11 mil cancelados);
      -- a régua do cancelado é a de sempre (fn_pedido_cancelado), com a comparação
      -- barata antes (chamar a função peça a peça custava ~20 ms no ×100)
      cross join lateral (
        select p.numero from public.pedidos p
         where p.id = c.pedido_id
           and lower(p.situacao) like 'cancel%'
           and plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
        offset 0) x
     where c.tipo = 'unidade' and c.arquivado_em is null and c.pedido_id is not null
       and c.item_codigo in (select i.codigo from itens i where i.codigo is not null)
       and c.pedido_id <> (select a.pedido_id from alvo a)
  ),
  em_producao as (
    select c.id, c.chave, c.origem, c.origem_numero, s.nome as setor_nome, et.nome as etapa_nome,
           -- a mais adiantada primeiro: setor mais à frente, etapa mais à frente, há mais tempo ali
           row_number() over (partition by c.chave
                              order by s.ordem desc, et.ordem desc nulls last, c.desde nulls last, c.id) as ordem,
           count(*) over (partition by c.chave) as iguais
      from candidatas c
      join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'producao'
      left join public.plt_etapas et on et.id = c.etapa_atual_id
     where c.concluido_em is null
       and coalesce(c.qualidade_atual, 'perfeito') <> 'danificado'
       and not coalesce(et.eh_danificado, false)
       and c.chave in (select v.chave from vagas v)
  )
  select v.seq, v.k, v.n, e.id, e.setor_nome, e.etapa_nome, e.origem, e.origem_numero, e.iguais::int
    from vagas v
    join em_producao e on e.chave = v.chave and e.ordem = v.ordem
   order by v.seq, v.k;
$function$
;

-- public.plt_fn_devolucao_realocar_opcoes — recriada da versão VIVA (pg_get_functiondef) com as trocas da SESSAO-44
CREATE OR REPLACE FUNCTION public.plt_fn_devolucao_realocar_opcoes(p_peca_id bigint)
 RETURNS TABLE(card_pedido_id bigint, numero integer, cliente_nome text, data_prevista date, item_seq integer, indice_unidade integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with peca as (
    select plt_privado.fn_chave_peca(
             plt_privado.fn_estoque_produto_da_peca(u.pedido_id, u.produto_tiny_id, u.item_codigo, u.item_descricao),
             u.item_codigo, u.item_descricao) as chave,
           u.pedido_id
      from public.plt_cards u
     where u.id = p_peca_id and u.tipo = 'unidade'
  ),
  vagas as (
    select pc.id as card_pedido_id, p.numero, coalesce(c.nome, '') as cliente_nome, plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
           v.seq as item_seq, k.k as indice_unidade
      from public.plt_cards pc
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      join plt_privado.vw_itens_producao v on v.pedido_id = pc.pedido_id and v.unidades >= 1
      cross join lateral generate_series(1, v.unidades::int) as k(k)
      cross join peca pe
     where plt_privado.fn_pode_ver_expedicao()
       and pc.tipo = 'pedido' and pc.arquivado_em is null
       and pc.lancado_rotas_em is null and pc.entrega_evento_id is null
       and pc.liberado_completo_em is null
       and pc.pedido_id is distinct from pe.pedido_id
       and not plt_privado.fn_pedido_cancelado(pc.pedido_id)
       and plt_privado.fn_chave_peca(plt_privado.fn_produto_do_item(v.codigo, v.descricao), v.codigo, v.descricao) = pe.chave
       and not plt_privado.fn_vaga_coberta(pc.pedido_id, v.seq, k.k)  -- SESSAO-44 (frente 3)
  )
  select distinct on (vg.card_pedido_id) vg.card_pedido_id, vg.numero, vg.cliente_nome, vg.data_prevista,
         vg.item_seq, vg.indice_unidade
    from vagas vg
   order by vg.card_pedido_id, vg.item_seq, vg.indice_unidade
   limit 20;
$function$
;

-- plt_privado.fn_concluir_pedido — recriada da versão VIVA (pg_get_functiondef) com as trocas da SESSAO-44
CREATE OR REPLACE FUNCTION plt_privado.fn_concluir_pedido(p_card_pedido_id bigint, p_usuario uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_card    public.plt_cards%rowtype;
  v_numero  integer;
  v_aguardo bigint;
  v_total   integer;
  v_u       public.plt_cards%rowtype;
  v_peca    public.plt_cards%rowtype;
  v_novo    bigint;
  v_produto bigint;
  v_ja      integer := 0;
  v_movidas integer := 0;
  v_criadas integer := 0;
  v_usadas  integer := 0;
  v_pulados integer := 0;
  v_marca_m text;
  v_marca_a text;
  it        record;
  k         integer;
begin
  select * into v_card from public.plt_cards
   where id = p_card_pedido_id and tipo = 'pedido'
   for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_pedido_id using errcode = 'no_data_found';
  end if;
  if v_card.arquivado_em is not null then
    raise exception 'Este pedido está arquivado.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_entregue(v_card.id) then
    raise exception 'Este pedido já foi entregue.' using errcode = 'check_violation';
  end if;
  if v_card.lancado_rotas_em is not null then
    return jsonb_build_object('concluido', false, 'motivo', 'ja_em_rota');
  end if;
  if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    raise exception 'Este pedido foi cancelado no Tiny — não dá para concluir.' using errcode = 'check_violation';
  end if;

  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;
  select s.id into v_aguardo from public.plt_setores s where s.codigo = 'aguardo' and s.ativo;
  if v_aguardo is null then
    raise exception 'O lugar da Expedição (a peça pronta de pedido) não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  v_total := plt_privado.fn_unidades_do_pedido(v_card.pedido_id);
  if v_total = 0 then
    return jsonb_build_object('concluido', true, 'motivo', 'sem_producao');
  end if;

  v_marca_m := current_setting('plt.estoque_maquinaria', true);
  v_marca_a := current_setting('plt.ajuste_super_admin', true);
  perform set_config('plt.estoque_maquinaria', 'on', true);
  -- SESSAO-30 (raio-x 1): o ajuste do super admin (D-117) passa pela regra
  -- dos fins de linha — ele decide que a peça está pronta.
  perform set_config('plt.ajuste_super_admin', 'on', true);

  for it in
    select v.seq, v.codigo, v.descricao, v.unidades
      from plt_privado.vw_itens_producao v
     where v.pedido_id = v_card.pedido_id and v.unidades >= 1
     order by v.seq
  loop
    for k in 1 .. it.unidades loop
      -- SESSAO-44 (frente 3): a peça que cobre a vaga é a do mesmo produto.
      select * into v_u from public.plt_cards u
       where u.id = (select w.card_id from plt_privado.fn_vagas_pedido(v_card.pedido_id) w
                      where w.seq = it.seq and w.indice = k)
       for update;
      if found then
        if v_u.arquivado_em is not null then
          v_pulados := v_pulados + 1;
          continue;
        end if;
        if v_u.setor_atual_id = v_aguardo then
          v_ja := v_ja + 1;
          continue;
        end if;
        perform plt_privado.fn_fechar_tempo_aberto(v_u.id, 'Concluído pelo super admin: o tempo aberto fecha antes.');
        select * into v_u from public.plt_cards where id = v_u.id;
        insert into public.plt_eventos
            (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id,
             setor_destino_id, etapa_destino_id, observacao, dados)
          values
            (v_u.id, 'movimentacao_setor', p_usuario, 'api', v_u.setor_atual_id, v_u.etapa_atual_id,
             v_aguardo, null, 'Concluído pelo super admin (ajuste da plataforma).',
             jsonb_build_object('ajuste_super_admin', true, 'numero', v_numero));
        v_movidas := v_movidas + 1;
      else
        -- A peça do estoque reservada pela venda para ESTA unidade: usa ela.
        select * into v_peca from public.plt_cards c
         where c.id = (select w.reserva_card_id from plt_privado.fn_vagas_pedido(v_card.pedido_id) w
                        where w.seq = it.seq and w.indice = k)
           and c.arquivado_em is null
         limit 1
           for update;
        v_produto := case when found then v_peca.produto_tiny_id
                          else plt_privado.fn_produto_do_item(it.codigo, it.descricao) end;

        insert into public.plt_cards
            (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao,
             indice_unidade, total_unidades, produto_tiny_id, setor_atual_id)
          values
            ('unidade', v_card.pedido_id, v_card.id, it.seq, it.codigo, it.descricao,
             k, it.unidades, v_produto, v_aguardo)
          returning id into v_novo;

        insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id, observacao, dados)
          values (v_novo, 'card_criado', p_usuario, 'api', v_aguardo,
                  case when v_peca.id is not null
                       then 'Concluído pelo super admin — usou a peça do estoque reservada para o pedido.'
                       else 'Concluído pelo super admin — a peça nasce pronta (ajuste da plataforma).' end,
                  jsonb_build_object('ajuste_super_admin', true, 'numero', v_numero)
                  || case when v_peca.id is not null
                          then jsonb_build_object('alocada_de', v_peca.id, 'reservada', true)
                          else '{}'::jsonb end);

        if v_peca.id is not null then
          insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, observacao, dados)
            values (v_peca.id, 'peca_alocada', p_usuario, 'api', v_peca.setor_atual_id,
                    'Usada pelo pedido ' || coalesce(v_numero::text, '')
                      || format(' (%s/%s) — concluído pelo super admin.', k, it.unidades),
                    jsonb_build_object('pedido_id', v_card.pedido_id, 'numero', v_numero,
                                       'card_pedido_id', v_card.id, 'unidade_card_id', v_novo,
                                       'item_seq', it.seq, 'indice_unidade', k, 'reservada', true));
          v_usadas := v_usadas + 1;
        else
          v_criadas := v_criadas + 1;
        end if;
      end if;
    end loop;
  end loop;

  perform plt_privado.fn_recalcular_liberacao(v_card.pedido_id);
  perform set_config('plt.estoque_maquinaria', coalesce(v_marca_m, ''), true);
  perform set_config('plt.ajuste_super_admin', coalesce(v_marca_a, ''), true);

  return jsonb_build_object('concluido', true, 'numero', v_numero, 'ja_prontas', v_ja,
                            'movidas', v_movidas, 'criadas', v_criadas,
                            'pecas_do_estoque', v_usadas, 'arquivadas_puladas', v_pulados);
end;
$function$
;

-- public.plt_fn_pcp_todos_pedidos — recriada da versão VIVA (pg_get_functiondef) com as trocas da SESSAO-44
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
    select p.id, p.numero, p.cliente_id, p.data_pedido, plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista, p.situacao,
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
      select count(*) filter (where not plt_privado.fn_eh_frete(cu.item_descricao))::int
               as liberadas,
             count(*) filter (where cu.arquivado_em is null and s.papel_no_fluxo = 'terminal')::int
               as prontas
        from public.plt_cards cu
        left join public.plt_setores s on s.id = cu.setor_atual_id
       where cu.pedido_id = nu.id and cu.tipo = 'unidade'
    ) u on true
   where nu.n <= (select limite from cfg)
   order by nu.numero desc;
$function$
;

-- public.plt_fn_pedidos_kanban — recriada da versão VIVA (pg_get_functiondef) com as trocas da SESSAO-44
CREATE OR REPLACE FUNCTION public.plt_fn_pedidos_kanban(p_busca text DEFAULT NULL::text, p_somente_sem_card boolean DEFAULT false, p_ids bigint[] DEFAULT NULL::bigint[], p_limite integer DEFAULT 20, p_deslocamento integer DEFAULT 0)
 RETURNS TABLE(pedido_id bigint, numero integer, cliente_nome text, data_pedido date, data_prevista date, situacao text, total_itens integer, total_unidades integer, tem_card boolean, unidades_liberadas integer, alterado_apos_liberacao boolean, entrou_pcp_em timestamp with time zone, liberado_completo_em timestamp with time zone, contagem_total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select p.id                                as pedido_id,
         p.numero,
         coalesce(c.nome, '')                as cliente_nome,
         p.data_pedido,
         plt_privado.fn_data_entrega(p.id, p.data_prevista) as data_prevista,
         p.situacao,
         coalesce(i.total_itens, 0)          as total_itens,
         coalesce(i.total_unidades, 0)       as total_unidades,
         (pc.id is not null)                 as tem_card,
         coalesce(u.liberadas, 0)            as unidades_liberadas,
         -- SESSAO-09: o Tiny mudou o pedido DEPOIS de unidades irem à produção.
         exists (select 1 from public.plt_eventos e
                  where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                             as alterado_apos_liberacao,
         -- SESSAO-22 (D-48): o tempo em PCP é do pedido — entrada → liberação completa.
         ev.entrou_pcp_em,
         pc.liberado_completo_em,
         count(*) over ()                    as contagem_total
    from public.pedidos p
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      -- D-63: o frete não conta como unidade (vw_itens_producao).
      select count(*)::int as total_itens,
             coalesce(sum(v.unidades), 0)::int as total_unidades
        from plt_privado.vw_itens_producao v
       where v.pedido_id = p.id
    ) i on true
    left join lateral (
      -- D-63: card de frete nascido antes da regra não conta como liberado.
      select count(*)::int as liberadas
        from public.plt_cards cu
       where cu.pedido_id = p.id and cu.tipo = 'unidade'
         and not plt_privado.fn_eh_frete(cu.item_descricao)  -- SESSAO-44: o frete é do próprio card
    ) u on true
    left join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido'
    left join lateral (
      select min(e.ocorrido_em) as entrou_pcp_em
        from public.plt_eventos e
       where e.card_id = pc.id and e.tipo = 'card_criado'
    ) ev on true
   where plt_privado.fn_usuario_atual() is not null
     and (p_ids is null or p.id = any (p_ids))
     and (not coalesce(p_somente_sem_card, false) or pc.id is null)
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%')
   order by p.data_pedido desc nulls last, p.numero desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$function$
;

-- plt_privado.fn_avisos_catalogo — recriada da versão VIVA (pg_get_functiondef) com as trocas da SESSAO-44
CREATE OR REPLACE FUNCTION plt_privado.fn_avisos_catalogo()
 RETURNS TABLE(tipo text, grupo text, grupo_nome text, ordem integer, nome text, descricao text, publico text, obrigatorio boolean, erro boolean)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select * from (values
    ('qualidade_atencao',        'producao',  'Produção e qualidade',             10, 'Peça em atenção',                         'Alguém marcou uma peça com algo a conferir.',                                   'lideranca', false, false),
    ('qualidade_danificado',     'producao',  'Produção e qualidade',             11, 'Peça danificada',                         'Alguém marcou uma peça como danificada.',                                       'lideranca', false, false),
    ('qualidade_divergencia',    'producao',  'Produção e qualidade',             12, 'Estado da peça diferente',                'Quem entregou e quem recebeu marcaram estados diferentes.',                     'lideranca', false, false),
    ('tarefa_sistema',           'producao',  'Produção e qualidade',             13, 'Recebimento para confirmar',              'Uma peça chegou ao setor e espera a confirmação do estado.',                    'todos',     false, false),
    ('card_esquecido',           'producao',  'Produção e qualidade',             14, 'Ainda tem alguém neste card?',            'Card da montagem rodando há 2 horas sem parar.',                                'todos',     true,  false),
    ('execucao_pulada',          'producao',  'Produção e qualidade',             15, 'Móvel pulou a montagem',                  'Um móvel saiu da Montagem (ou de outro setor com o aviso ligado) sem ninguém iniciar.', 'admin',     false, false),
    ('chegada_aguardo',          'expedicao', 'Expedição e estoque',              20, 'Peça pronta na Expedição',                'Cada peça de pedido que fica pronta.',                                          'admin',     false, false),
    ('chegada_estoque',          'expedicao', 'Expedição e estoque',              21, 'Peça entrou no estoque',                  'Cada peça sem dono que entra no estoque.',                                      'admin',     false, false),
    ('devolucao_decidir',        'expedicao', 'Expedição e estoque',              22, 'Pedido devolvido ou entregue em parte',   'Peças esperando a decisão da logística.',                                       'logistica', false, false),
    ('pedido_cancelado',         'pedidos',   'Pedidos e Tiny',                   30, 'Pedido cancelado com produção',           'Cancelado no Tiny com peças já liberadas.',                                     'admin',     false, false),
    ('pedido_excluido_no_tiny',  'pedidos',   'Pedidos e Tiny',                   31, 'Pedido excluído no Tiny',                 'O pedido não existe mais no Tiny e saiu dos quadros.',                          'admin',     false, false),
    ('produto_excluido_no_tiny', 'pedidos',   'Pedidos e Tiny',                   32, 'Produto apagado no Tiny',                 'Apagado no Tiny, mas ainda com peças no quadro.',                               'admin',     false, false),
    ('pedido_itens_novos',      'pedidos',   'Pedidos e Tiny',                   33, 'Itens novos num pedido já liberado', 'O vendedor acrescentou itens no Tiny e o pedido voltou ao PCP só com o que falta.', 'pcp',       false, false),
    ('pedido_itens_sairam',     'pedidos',   'Pedidos e Tiny',                   34, 'Item saiu de um pedido com peça feita', 'O Tiny tirou ou diminuiu um item que já tem peça — nada foi arquivado.',        'pcp',       false, false),
    ('pedido_itens_rota',       'pedidos',   'Pedidos e Tiny',                   35, 'Pedido na rota ganhou itens',       'Segure a entrega: o pedido voltou ao PCP com os itens novos.',                  'logistica', false, false),
    ('tiny_saiu_de_entregue',   'pedidos',   'Pedidos e Tiny',                   36, 'Pedido voltou atrás no Tiny',       'Saiu de "Entregue" no Tiny: a entrega que veio do Tiny reabre; a feita aqui só avisa.', 'logistica', false, false),
    ('delegacao',                'cards',     'Cards e afazeres',                 40, 'Um afazer chegou para você',              'Um card foi colocado sob sua responsabilidade.',                                'todos',     false, false),
    ('card_responsavel',         'cards',     'Cards e afazeres',                 41, 'Você virou responsável por um card',      null,                                                                            'todos',     false, false),
    ('card_mencao',              'cards',     'Cards e afazeres',                 42, 'Mencionaram você',                        'Alguém escreveu o seu nome na conversa de um card.',                            'todos',     false, false),
    ('automacao',                'cards',     'Cards e afazeres',                 43, 'Aviso de uma automação',                  'As automações da plataforma que mandam aviso.',                                 'todos',     false, false),
    ('senha_pedido',             'acesso',    'Acesso',                           50, 'Pedido de troca de senha',                'Alguém pediu para trocar a senha.',                                             'admin',     true,  false),
    ('senha_sem_cadastro',       'acesso',    'Acesso',                           51, 'Troca de senha para e-mail sem cadastro', 'Pode ser alguém da equipe que digitou o e-mail errado.',                        'admin',     false, false),
    ('automacao_erro',           'erros',     'Erros de automação e integrações', 60, 'Integração com o Tiny ou o n8n parou',    'O Tiny desistiu de um item, uma automação do n8n deu erro, a conexão com o Tiny da fábrica caiu ou a lista do Tiny veio incompleta.', 'admin', false, true),
    ('tiny_pedido_parado',       'erros',     'Erros de automação e integrações', 61, 'O Tiny não aceitou a situação de um pedido', 'Depois de 8 tentativas, a situação do pedido não mudou lá.',                 'admin',     false, true),
    ('automacao_falhou',         'erros',     'Erros de automação e integrações', 62, 'Uma automação da plataforma falhou',      'Uma automação montada no Super admin parou com erro.',                          'admin',     false, true),
    ('estoque_tiny_parado',      'erros',     'Erros de automação e integrações', 63, 'O estoque parou de ir para o Tiny',       'Depois de 5 tentativas, o saldo de um móvel não foi atualizado no Tiny.',       'admin',     false, true),
    ('webhook_falhou',           'erros',     'Erros de automação e integrações', 64, 'Aviso para uma integração não entregue',  'A plataforma não conseguiu avisar uma integração depois de 5 tentativas.',     'admin',     false, true)
  ) as c(tipo, grupo, grupo_nome, ordem, nome, descricao, publico, obrigatorio, erro);
$function$
;

-- plt_privado.fn_reagir_pedido — recriada da versão VIVA (pg_get_functiondef) com as trocas da SESSAO-44
CREATE OR REPLACE FUNCTION plt_privado.fn_reagir_pedido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_card_id       bigint;
  v_setor_pcp     bigint;
  v_liberadas     integer;
  v_cancelou      boolean;
  v_mudou         boolean;
  v_evento_id     bigint;
  v_destinatarios uuid[];
  v_destinatario  uuid;
  v_titulo        text;
  v_corpo         text;
begin
  begin
    if tg_op = 'INSERT' then
      select s.id into v_setor_pcp
        from public.plt_setores s
       where s.papel_no_fluxo = 'entrada' and s.ativo
       order by s.id limit 1;
      if v_setor_pcp is null then
        return null;
      end if;

      insert into public.plt_cards (tipo, pedido_id, setor_atual_id)
           values ('pedido', new.id, v_setor_pcp)
      on conflict do nothing
      returning id into v_card_id;
      if v_card_id is null then
        return null;
      end if;

      insert into public.plt_eventos (card_id, tipo, origem, setor_destino_id, dados)
           values (v_card_id, 'card_criado', 'automacao', v_setor_pcp,
                   jsonb_build_object('fonte', 'tiny', 'numero', new.numero));
      return null;
    end if;

    select c.id into v_card_id
      from public.plt_cards c
     where c.pedido_id = new.id and c.tipo = 'pedido';
    if v_card_id is null then
      return null;
    end if;

    -- SESSAO-30 (D-113): o Tiny ficou "Entregue" — para estar entregue lá, a
    -- peça não existe mais no galpão: nada do pedido fica aberto aqui.
    if plt_privado.fn_situacao_normalizada(new.situacao) = 'entregue'
       and plt_privado.fn_situacao_normalizada(old.situacao) is distinct from 'entregue' then
      perform plt_privado.fn_fechar_pedido(v_card_id, null, 'api', 'Entregue no Tiny.', 'tiny');
      return null;
    end if;

    -- SESSAO-44 (frente 5): o Tiny saiu de "Entregue" para outra situação que
    -- não encerra o pedido — a entrega do Sistema reabre; a de pessoa só avisa
    -- (o resto da reação segue: pedido atualizado).
    if plt_privado.fn_situacao_normalizada(old.situacao) = 'entregue'
       and plt_privado.fn_situacao_normalizada(new.situacao) is distinct from 'entregue'
       and plt_privado.fn_situacao_normalizada(new.situacao) is distinct from 'cancelado' then
      perform plt_privado.fn_tiny_saiu_de_entregue(v_card_id, new.numero, new.situacao);
    end if;

    -- ↩️ SESSAO-31 (D-124): o marcador "Devolvido" do Tiny NÃO faz nada aqui —
    -- a fábrica ainda tenta recuperar a venda; quem marca a devolução é a
    -- logística, na plataforma (D-129).

    -- SESSAO-15: "Cancelado" (descrição) e 'cancelado' (código) valem igual.
    v_cancelou := plt_privado.fn_situacao_normalizada(new.situacao) = 'cancelado'
              and plt_privado.fn_situacao_normalizada(old.situacao) <> 'cancelado';
    v_mudou := (old.situacao       is distinct from new.situacao)
            or (old.data_prevista  is distinct from new.data_prevista)
            or (old.total_produtos is distinct from new.total_produtos)
            or (old.total_pedido   is distinct from new.total_pedido)
            or (old.obs            is distinct from new.obs)
            or (old.obs_interna    is distinct from new.obs_interna)
            or (old.forma_envio    is distinct from new.forma_envio);
    if not v_mudou then
      return null;
    end if;

    select count(*)::int into v_liberadas
      from public.plt_cards c
     where c.pedido_id = new.id and c.tipo = 'unidade';

    if v_cancelou then
      insert into public.plt_eventos (card_id, tipo, origem, observacao, dados)
           values (v_card_id, 'pedido_cancelado', 'automacao',
                   'Pedido cancelado no Tiny.',
                   jsonb_build_object('fonte', 'tiny', 'numero', new.numero,
                                      'unidades_liberadas', v_liberadas))
        returning id into v_evento_id;

      if v_liberadas > 0 then
        select coalesce(array_agg(u.id), '{}') into v_destinatarios
          from public.plt_usuarios u
         where u.ativo and u.papel = 'admin';
        v_titulo := 'Pedido ' || new.numero || ' cancelado com produção em andamento';
        v_corpo  := 'O pedido ' || new.numero || ' foi cancelado no Tiny com '
                    || v_liberadas || ' unidade(s) já liberada(s) para produção. '
                    || 'Decida o que fazer com as peças.';
        if array_length(v_destinatarios, 1) is not null then
          foreach v_destinatario in array v_destinatarios loop
            insert into public.plt_notificacoes
                (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
              values
                (v_destinatario, v_evento_id, v_card_id, 'pedido_cancelado', v_titulo, v_corpo);
          end loop;
          insert into public.plt_eventos
              (card_id, tipo, origem, evento_referencia_id, observacao, dados)
            values
              (v_card_id, 'notificacao_enviada', 'automacao', v_evento_id, v_titulo,
               jsonb_build_object('tipo', 'pedido_cancelado',
                                  'destinatarios', to_jsonb(v_destinatarios)));
        end if;
      end if;
      return null;
    end if;

    if v_liberadas > 0 then
      insert into public.plt_eventos (card_id, tipo, origem, dados)
           values (v_card_id, 'pedido_atualizado', 'automacao',
                   jsonb_build_object(
                     'fonte', 'tiny', 'numero', new.numero,
                     'unidades_liberadas', v_liberadas,
                     'situacao_antes',  old.situacao,      'situacao_depois',  new.situacao,
                     'previsao_antes',  old.data_prevista, 'previsao_depois',  new.data_prevista));
    end if;
    return null;

  exception when others then
    raise warning 'plt_reagir_pedido: % — a integração segue intacta', sqlerrm;
    return null;
  end;
end;
$function$
;

