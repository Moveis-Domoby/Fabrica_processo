-- ============================================================================
-- Migration 56 · "Entregue" no Tiny fecha TUDO do pedido aqui + o PCP do super
-- admin (seletor de situação e arquivar em massa) + "Todos os pedidos" rápida
-- (SESSAO-30, etapa 1 — D-113, D-117)
-- ============================================================================
-- Respostas do dono (08/10):
--   · "Se está entregue no Tiny, aqui deve estar como entregue também; para ser
--     entregue no Tiny é porque a peça do pedido não existe mais no galpão e não
--     deve mais estar nada referente a ele em aberto aqui." (D-113)
--   · "No PCP, um botão simples de selecionar status do pedido — entregue, em
--     rota, concluído — só para super admin; e seleção em massa para arquivar
--     … eu preciso dela zerada." O seletor NÃO mexe no Tiny. (D-117)
--
-- O que nasce:
--   1. fn_validar_api (recriada por inteiro a partir da 51): a entrega pode ser
--      do "Sistema" quando é a maquinaria quem registra (flag de sessão
--      plt.entrega_maquinaria — vale até para a chave de serviço, M-14).
--   2. plt_privado.fn_fechar_tempo_aberto — fecha o tempo de quem trabalhava
--      na peça (movimentação para a fila do setor — a regra de sempre).
--   3. plt_privado.fn_fechar_pedido — A regra de "entregue" num lugar só
--      (M-04): registra a entrega (se ainda não há), tira cada peça viva do
--      pedido de toda conta (evento `card_arquivado` motivo "entregue" — o
--      filtro universal de "não arquivado" faz o resto), a peça do ESTOQUE
--      reservada pela venda sai com ele (motivo "venda", como a D-78) e o card
--      do pedido que nunca foi às ROTAS sai do PCP. Tudo por evento.
--   4. fn_reagir_pedido (recriada por inteiro a partir da migration 25 — E-24):
--      o Tiny virou "Entregue" → fn_fechar_pedido, assinado "Sistema".
--   5. Super admin: fn_concluir_pedido, fn_arquivar_pedido e a porta
--      plt_fn_pcp_ajustar_pedidos (concluído · em rota · entregue · arquivar),
--      um resultado por pedido, nada vai ao Tiny.
--   6. plt_fn_pcp_todos_pedidos — a aba "Todos os pedidos" por CURSOR (número
--      do pedido), só a página pedida calcula unidades e a situação na
--      plataforma, total contado com teto (a porta antiga levava 3,2 s na 1ª
--      página porque calculava tudo dos 5.400 pedidos antes de cortar).
--
-- Não toca em tabela nenhuma (nem da integração, nem da plataforma). Reaplicável.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · Validação dos gestos (recriada POR INTEIRO a partir da migration 51):
--     a entrega sem pessoa só passa pela maquinaria (o Tiny ficou "Entregue").
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_api()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_papel text;
  v_logistica boolean;
  v_danificado boolean;
  v_reposicao boolean;
  v_livre_no_estoque boolean;
begin
  if new.tipo = 'card_arquivado' then
    -- SESSAO-27 (D-99): o motor das automações arquiva (o super admin montou e ligou).
    if plt_privado.fn_evento_do_motor(new.origem, new.dados) then
      return new;
    end if;
    if new.origem <> 'api' then
      select u.papel into v_papel from public.plt_usuarios u
       where u.id = new.usuario_id and u.ativo;
      if coalesce(v_papel, '') <> 'admin' then
        -- SESSAO-15 (D-45): a logística arquiva peça que está em DANIFICADO.
        select exists (
          select 1 from public.plt_cards c
            join public.plt_etapas e on e.id = c.etapa_atual_id
           where c.id = new.card_id and e.eh_danificado
        ) into v_danificado;
        -- SESSAO-25: e o card de REPOSIÇÃO (o PCP decide não produzir).
        select exists (
          select 1 from public.plt_cards c
           where c.id = new.card_id and c.tipo = 'reposicao'
        ) into v_reposicao;
        -- D-70 (28/09): e dá BAIXA em peça livre do ESTOQUE (a contagem é dela).
        select exists (
          select 1 from public.plt_cards c
            join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
           where c.id = new.card_id and c.tipo = 'unidade' and c.pedido_id is null
        ) into v_livre_no_estoque;
        if not ((coalesce(v_danificado, false) or coalesce(v_reposicao, false)
                 or coalesce(v_livre_no_estoque, false))
                and plt_privado.fn_eh_logistica(new.usuario_id)) then
          raise exception 'Arquivar card é gesto de admin ou da integração — a logística arquiva só peças em DANIFICADO, cards de reposição e dá baixa em peça livre do ESTOQUE.'
            using errcode = 'insufficient_privilege';
        end if;
      end if;
    end if;

  elsif new.tipo = 'pedido_entregue' then
    if new.usuario_id is null then
      -- SESSAO-30 (D-113): o Tiny ficou "Entregue" — quem registra é o Sistema,
      -- pela maquinaria (fn_fechar_pedido). Fora dela, entrega é gesto de pessoa.
      if coalesce(current_setting('plt.entrega_maquinaria', true), '') = 'on' then
        return new;
      end if;
      raise exception 'Registrar entrega é gesto de pessoa — é preciso dizer quem entregou.'
        using errcode = 'check_violation';
    end if;
    select u.papel into v_papel from public.plt_usuarios u
     where u.id = new.usuario_id and u.ativo;
    select exists (
      select 1 from public.plt_usuario_setores us
        join public.plt_setores s on s.id = us.setor_id
       where us.usuario_id = new.usuario_id
         and s.papel_no_fluxo in ('entrada', 'terminal')
    ) into v_logistica;
    if coalesce(v_papel, '') <> 'admin' and not v_logistica then
      raise exception 'Registrar entrega é gesto da logística (PCP/terminais) ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;

  elsif new.tipo = 'pedido_lancado_rotas' then
    -- SESSAO-15 (D-45): lançar é gesto HUMANO da logística, no card de PEDIDO.
    if new.usuario_id is null then
      raise exception 'Lançar para ROTAS é gesto de pessoa — é preciso dizer quem lançou.'
        using errcode = 'check_violation';
    end if;
    if not plt_privado.fn_eh_logistica(new.usuario_id) then
      raise exception 'Lançar para ROTAS é gesto da logística (PCP/terminais) ou de admin.'
        using errcode = 'insufficient_privilege';
    end if;
    if not exists (select 1 from public.plt_cards c where c.id = new.card_id and c.tipo = 'pedido') then
      raise exception 'Só o card de pedido pode ser lançado para ROTAS.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2 · Fechar o tempo aberto de uma peça antes de ela sair (a regra de sempre:
--     a execução fecha na movimentação — mesma receita da manutenção de 27/09).
--     Devolve se havia tempo aberto e ele foi fechado.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_fechar_tempo_aberto(p_card_id bigint, p_observacao text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.plt_cards%rowtype;
  v_fila bigint;
begin
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found or v_card.executor_atual_id is null then
    return false;
  end if;
  select e.id into v_fila
    from public.plt_etapas e
   where e.setor_id = v_card.setor_atual_id and e.eh_fila and e.ativa
   order by e.ordem, e.id
   limit 1;
  if v_fila is null or v_fila = v_card.etapa_atual_id then
    return false;
  end if;
  insert into public.plt_eventos
      (card_id, tipo, origem, setor_origem_id, etapa_origem_id,
       setor_destino_id, etapa_destino_id, observacao, dados)
    values
      (p_card_id, 'movimentacao_etapa', 'api', v_card.setor_atual_id, v_card.etapa_atual_id,
       v_card.setor_atual_id, v_fila, p_observacao, jsonb_build_object('fechar_tempo', true));
  return true;
end;
$$;

comment on function plt_privado.fn_fechar_tempo_aberto(bigint, text) is
  'SESSAO-30: fecha o tempo de quem trabalhava na peça (movimentação para a fila do setor, origem da integração) antes de ela sair de toda conta. Sem fila no setor, não mexe.';

-- ----------------------------------------------------------------------------
-- 3 · A regra de "entregue" num lugar só (D-113, M-04). Quem chama:
--       · o Tiny ficou "Entregue" (fn_reagir_pedido) → p_usuario nulo ("Sistema"),
--         p_origem 'api', p_fonte 'tiny';
--       · o seletor do super admin (D-117) → p_usuario = ele, 'interface',
--         p_fonte 'super_admin' (o Tiny não muda);
--       · a manutenção de 08/10 → como o Tiny.
--     Idempotente: a entrega existe uma vez só; peça já fora de conta não é
--     tocada de novo; card arquivado sem nada vivo não ganha entrega.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_fechar_pedido(
  p_card_pedido_id bigint,
  p_usuario        uuid,
  p_origem         text,
  p_observacao     text,
  p_fonte          text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card      public.plt_cards%rowtype;
  v_numero    integer;
  v_situacao  text;
  v_entrega   bigint;
  v_nova      boolean := false;
  v_vivas     integer;
  v_unidades  integer := 0;
  v_tempos    integer := 0;
  v_reservas  integer := 0;
  v_card_saiu boolean := false;
  r           record;
begin
  select * into v_card from public.plt_cards
   where id = p_card_pedido_id and tipo = 'pedido'
   for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_pedido_id using errcode = 'no_data_found';
  end if;
  select p.numero, p.situacao into v_numero, v_situacao
    from public.pedidos p where p.id = v_card.pedido_id;

  select count(*)::int into v_vivas
    from public.plt_cards u
   where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null;

  -- Card já arquivado e nada vivo: história antiga — nada a fechar.
  if v_card.arquivado_em is not null and v_vivas = 0
     and not exists (select 1 from public.plt_cards s
                      where s.reservada_pedido_id = v_card.pedido_id and s.arquivado_em is null) then
    return jsonb_build_object('fechou', false, 'motivo', 'arquivado', 'numero', v_numero);
  end if;

  perform set_config('plt.entrega_maquinaria', 'on', true);

  select e.id into v_entrega
    from public.plt_eventos e
   where e.card_id = v_card.id and e.tipo = 'pedido_entregue'
   order by e.id desc
   limit 1;
  if v_entrega is null then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card.id, 'pedido_entregue', p_usuario, p_origem,
              nullif(btrim(p_observacao), ''),
              jsonb_build_object('fonte', p_fonte, 'numero', v_numero,
                                 'situacao_tiny', v_situacao, 'unidades', v_vivas,
                                 'lancado_rotas', v_card.lancado_rotas_em is not null))
      returning id into v_entrega;
    v_nova := true;
  end if;

  -- Cada peça viva do pedido sai de toda conta (estoque, reservas, ROTAS ativa,
  -- Visão do dia) e fica no histórico — o tempo aberto fecha antes.
  for r in
    select c.id from public.plt_cards c
     where c.pedido_id = v_card.pedido_id and c.tipo = 'unidade' and c.arquivado_em is null
     order by c.id
       for update
  loop
    if plt_privado.fn_fechar_tempo_aberto(r.id, 'O pedido foi entregue: o tempo aberto fecha antes de a peça sair.') then
      v_tempos := v_tempos + 1;
    end if;
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (r.id, 'card_arquivado', p_usuario, p_origem,
              'Pedido ' || coalesce(v_numero::text, '') || ' entregue — a peça saiu com ele.',
              jsonb_build_object('motivo', 'entregue', 'entrega_evento_id', v_entrega,
                                 'fonte', p_fonte, 'numero', v_numero));
    v_unidades := v_unidades + 1;
  end loop;

  -- A peça do ESTOQUE reservada pela venda sai com o pedido (motivo "venda" —
  -- a mesma baixa da D-78; não volta ao Tiny, que já baixou na venda).
  for r in
    select c.id, c.setor_atual_id, c.reservada_item_seq, c.reservada_indice, c.produto_tiny_id
      from public.plt_cards c
     where c.reservada_pedido_id = v_card.pedido_id and c.arquivado_em is null
     order by c.id
       for update
  loop
    insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
      values (r.id, 'card_arquivado', 'api', r.setor_atual_id,
              format('Saiu com o pedido %s (entregue).', v_numero),
              jsonb_build_object('motivo', 'venda', 'pedido_id', v_card.pedido_id, 'numero', v_numero,
                                 'item_seq', r.reservada_item_seq, 'indice_unidade', r.reservada_indice,
                                 'produto_tiny_id', r.produto_tiny_id, 'entrega_evento_id', v_entrega));
    v_reservas := v_reservas + 1;
  end loop;

  -- O card do pedido que nunca foi às ROTAS sai do PCP (o lançado fica: é o
  -- registro da entrega em ROTAS → Entregas e em "Já programadas").
  if v_card.lancado_rotas_em is null and v_card.arquivado_em is null then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card.id, 'card_arquivado', p_usuario, p_origem,
              'Pedido entregue — sai do PCP.',
              jsonb_build_object('motivo', 'entregue', 'entrega_evento_id', v_entrega,
                                 'fonte', p_fonte, 'numero', v_numero));
    v_card_saiu := true;
  end if;

  return jsonb_build_object('fechou', true, 'numero', v_numero, 'entrega_evento_id', v_entrega,
                            'entrega_nova', v_nova, 'unidades', v_unidades,
                            'tempos_fechados', v_tempos, 'reservas', v_reservas,
                            'card_saiu_do_pcp', v_card_saiu);
end;
$$;

comment on function plt_privado.fn_fechar_pedido(bigint, uuid, text, text, text) is
  'D-113 (SESSAO-30): a regra de "entregue" num lugar só — registra a entrega uma vez, tira cada peça viva do pedido de toda conta (card_arquivado motivo entregue, tempo fechado antes), a peça do estoque reservada pela venda sai com ele (motivo venda) e o card do pedido que nunca foi às ROTAS sai do PCP. Quem chama: o Tiny entregue, o super admin e a manutenção.';

-- ----------------------------------------------------------------------------
-- 4 · A reação aos pedidos (recriada POR INTEIRO a partir da migration 25 —
--     E-24/E-25): o Tiny ficou "Entregue" → a plataforma fecha tudo, assinado
--     "Sistema" (D-113). O resto é igual: pedido novo vira card; cancelamento
--     avisa; atualização com produção vira evento. À prova de falha.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_reagir_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
$$;

comment on function plt_privado.fn_reagir_pedido() is
  'SESSAO-09/D-31: pedido novo em `pedidos` vira card no PCP; atualização com produção vira evento; cancelamento avisa admins. SESSAO-15: situação comparada NORMALIZADA (o Tiny grava a descrição). SESSAO-30 (D-113): virou "Entregue" no Tiny → fecha tudo do pedido aqui (fn_fechar_pedido, "Sistema"). À prova de falha: erro aqui NUNCA propaga para fn_upsert_pedido.';

-- ----------------------------------------------------------------------------
-- 5 · O PCP do super admin (D-117) — "concluído", "arquivar" e a porta.
-- ----------------------------------------------------------------------------

-- "Concluído": toda unidade de produção do pedido fica pronta em Pedidos em
-- aguardo — a viva em produção vai até lá (tempo fechado antes), a que ainda
-- não foi liberada nasce pronta lá (usando a peça do estoque reservada para
-- ela pela venda, quando há — não mexe no Tiny). Unidade arquivada fica como
-- está (contada à parte).
create or replace function plt_privado.fn_concluir_pedido(p_card_pedido_id bigint, p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
  if exists (select 1 from public.plt_eventos e where e.card_id = v_card.id and e.tipo = 'pedido_entregue') then
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
    raise exception 'Pedidos em aguardo não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  v_total := plt_privado.fn_unidades_do_pedido(v_card.pedido_id);
  if v_total = 0 then
    return jsonb_build_object('concluido', true, 'motivo', 'sem_producao');
  end if;

  perform set_config('plt.estoque_maquinaria', 'on', true);

  for it in
    select v.seq, v.codigo, v.descricao, v.unidades
      from plt_privado.vw_itens_producao v
     where v.pedido_id = v_card.pedido_id and v.unidades >= 1
     order by v.seq
  loop
    for k in 1 .. it.unidades loop
      select * into v_u from public.plt_cards u
       where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade'
         and u.item_seq = it.seq and u.indice_unidade = k
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
         where c.reservada_pedido_id = v_card.pedido_id and c.reservada_item_seq = it.seq
           and c.reservada_indice = k and c.arquivado_em is null
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

  return jsonb_build_object('concluido', true, 'numero', v_numero, 'ja_prontas', v_ja,
                            'movidas', v_movidas, 'criadas', v_criadas,
                            'pecas_do_estoque', v_usadas, 'arquivadas_puladas', v_pulados);
end;
$$;

comment on function plt_privado.fn_concluir_pedido(bigint, uuid) is
  'D-117: "Concluído" do super admin — toda unidade de produção do pedido fica pronta em Pedidos em aguardo (a viva vai até lá com o tempo fechado; a que faltava nasce pronta, usando a peça reservada pela venda quando há). Não mexe no Tiny.';

-- "Arquivar": o pedido e tudo o que está vivo dele saem das telas (a história
-- fica; "trazer de volta" desfaz — D-102). A peça do estoque reservada pela
-- venda volta a ficar livre (não vai ao Tiny).
create or replace function plt_privado.fn_arquivar_pedido(p_card_pedido_id bigint, p_usuario uuid, p_observacao text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card     public.plt_cards%rowtype;
  v_numero   integer;
  v_unidades integer := 0;
  v_reservas integer := 0;
  v_obs      text;
  r          record;
begin
  select * into v_card from public.plt_cards
   where id = p_card_pedido_id and tipo = 'pedido'
   for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_pedido_id using errcode = 'no_data_found';
  end if;
  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;
  v_obs := coalesce(nullif(btrim(p_observacao), ''), 'Arquivado pelo super admin (ajuste da plataforma).');

  perform set_config('plt.estoque_maquinaria', 'on', true);

  for r in
    select c.id from public.plt_cards c
     where c.pedido_id = v_card.pedido_id and c.tipo = 'unidade' and c.arquivado_em is null
     order by c.id
       for update
  loop
    perform plt_privado.fn_fechar_tempo_aberto(r.id, 'Pedido arquivado pelo super admin: o tempo aberto fecha antes.');
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (r.id, 'card_arquivado', p_usuario, 'interface', v_obs,
              jsonb_build_object('motivo', 'pedido_arquivado', 'numero', v_numero));
    v_unidades := v_unidades + 1;
  end loop;

  for r in
    select c.id, c.setor_atual_id, c.reservada_item_seq, c.reservada_indice, c.produto_tiny_id
      from public.plt_cards c
     where c.reservada_pedido_id = v_card.pedido_id and c.arquivado_em is null
     order by c.id
       for update
  loop
    insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, observacao, dados)
      values (r.id, 'peca_reserva_desfeita', 'automacao', r.setor_atual_id,
              format('O pedido %s foi arquivado — a peça volta a ficar livre.', v_numero),
              jsonb_build_object('motivo', 'pedido_arquivado', 'pedido_id', v_card.pedido_id,
                                 'numero', v_numero, 'item_seq', r.reservada_item_seq,
                                 'indice_unidade', r.reservada_indice,
                                 'produto_tiny_id', r.produto_tiny_id));
    v_reservas := v_reservas + 1;
  end loop;

  if v_card.arquivado_em is null then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card.id, 'card_arquivado', p_usuario, 'interface', v_obs,
              jsonb_build_object('motivo', 'pedido_arquivado', 'numero', v_numero));
  elsif v_unidades = 0 and v_reservas = 0 then
    return jsonb_build_object('arquivado', false, 'motivo', 'ja_arquivado', 'numero', v_numero);
  end if;

  return jsonb_build_object('arquivado', true, 'numero', v_numero,
                            'unidades', v_unidades, 'reservas_desfeitas', v_reservas);
end;
$$;

comment on function plt_privado.fn_arquivar_pedido(bigint, uuid, text) is
  'D-117: "Arquivar" do super admin — o card do pedido e cada peça viva dele saem das telas (tempo fechado antes), a peça do estoque reservada pela venda volta a ficar livre. Tudo por evento; "trazer de volta" desfaz. Não mexe no Tiny.';

revoke all on function plt_privado.fn_fechar_tempo_aberto(bigint, text) from public, anon, authenticated;
revoke all on function plt_privado.fn_fechar_pedido(bigint, uuid, text, text, text) from public, anon, authenticated;
revoke all on function plt_privado.fn_concluir_pedido(bigint, uuid) from public, anon, authenticated;
revoke all on function plt_privado.fn_arquivar_pedido(bigint, uuid, text) from public, anon, authenticated;

-- A porta do super admin: uma ação para vários pedidos, UM resultado por
-- pedido (o que não deu fica explicado e não segura os outros). Concluído ·
-- Em rota (concluir + lançar para ROTAS) · Entregue (fecha tudo — D-113) ·
-- Arquivar. Nada vai ao Tiny (resposta do dono, 08/10).
create or replace function public.plt_fn_pcp_ajustar_pedidos(
  p_pedido_ids bigint[],
  p_acao       text,
  p_observacao text default null
)
returns table (
  pedido_id bigint,
  numero    integer,
  feito     boolean,
  resultado text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_ids     bigint[];
  v_id      bigint;
  v_card    public.plt_cards%rowtype;
  v_res     jsonb;
  v_feitos  integer := 0;
  v_falhas  integer := 0;
  v_obs     text;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'Mudar a situação e arquivar pedidos em massa é só do super admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_acao is null or p_acao not in ('concluido', 'em_rota', 'entregue', 'arquivar') then
    raise exception 'Ação desconhecida — use concluído, em rota, entregue ou arquivar.' using errcode = 'check_violation';
  end if;
  select coalesce(array_agg(distinct x order by x), '{}') into v_ids
    from unnest(coalesce(p_pedido_ids, '{}'::bigint[])) x where x is not null;
  if cardinality(v_ids) = 0 then
    raise exception 'Escolha ao menos um pedido.' using errcode = 'check_violation';
  end if;
  if cardinality(v_ids) > 300 then
    raise exception 'No máximo 300 pedidos por vez.' using errcode = 'check_violation';
  end if;
  v_obs := nullif(btrim(p_observacao), '');

  foreach v_id in array v_ids loop
    pedido_id := v_id;
    select p.numero into numero from public.pedidos p where p.id = v_id;
    begin
      select * into v_card from public.plt_cards c
       where c.pedido_id = v_id and c.tipo = 'pedido';
      if not found then
        feito := false;
        resultado := 'Este pedido não tem card na plataforma.';
      elsif p_acao = 'arquivar' then
        v_res := plt_privado.fn_arquivar_pedido(v_card.id, v_usuario, v_obs);
        feito := coalesce((v_res ->> 'arquivado')::boolean, false);
        resultado := case when feito
                          then format('Arquivado (%s peça(s) junto).', v_res ->> 'unidades')
                          else 'Já estava arquivado.' end;
      elsif p_acao = 'entregue' then
        if v_card.arquivado_em is not null then
          raise exception 'Este pedido está arquivado — traga de volta antes.' using errcode = 'check_violation';
        end if;
        v_res := plt_privado.fn_fechar_pedido(v_card.id, v_usuario, 'interface',
                   coalesce(v_obs, 'Marcado como entregue pelo super admin (ajuste da plataforma).'),
                   'super_admin');
        feito := true;
        resultado := case when (v_res ->> 'entrega_nova')::boolean
                          then format('Entregue (%s peça(s) saíram das contas).', v_res ->> 'unidades')
                          else format('Já estava entregue (%s peça(s) fechadas agora).', v_res ->> 'unidades') end;
      else
        if v_card.arquivado_em is not null then
          raise exception 'Este pedido está arquivado — traga de volta antes.' using errcode = 'check_violation';
        end if;
        v_res := plt_privado.fn_concluir_pedido(v_card.id, v_usuario);
        if p_acao = 'concluido' then
          feito := coalesce((v_res ->> 'concluido')::boolean, false);
          resultado := case
            when v_res ->> 'motivo' = 'ja_em_rota'   then 'Já está em rota.'
            when v_res ->> 'motivo' = 'sem_producao' then 'Sem nada a produzir — já está completo.'
            else format('Concluído: %s peça(s) foram para o aguardo, %s nasceram prontas.',
                        coalesce((v_res ->> 'movidas')::int, 0),
                        coalesce((v_res ->> 'criadas')::int, 0) + coalesce((v_res ->> 'pecas_do_estoque')::int, 0))
          end;
        else
          select * into v_card from public.plt_cards where id = v_card.id;
          if v_card.lancado_rotas_em is not null then
            feito := false;
            resultado := 'Já está em rota.';
          else
            perform public.plt_fn_lancar_rotas(v_card.id);
            feito := true;
            resultado := 'Em rota: lançado para ROTAS (aparece em Programação).';
          end if;
        end if;
      end if;
    exception when others then
      feito := false;
      resultado := sqlerrm;
    end;
    if feito then v_feitos := v_feitos + 1; else v_falhas := v_falhas + 1; end if;
    return next;
  end loop;

  -- D-40: o gesto inteiro numa linha da trilha (cada evento já grava a sua) —
  -- em língua de gente (os números dos pedidos; os ids ficam só para a máquina).
  insert into public.plt_logs_atividade (usuario_id, acao, rota, contexto)
    values (v_usuario, 'pcp_pedidos_ajustados', '/fabrica/producao/pcp',
            jsonb_build_object(
              'ajuste', case p_acao when 'concluido' then 'Concluído'
                                    when 'em_rota'   then 'Em rota'
                                    when 'entregue'  then 'Entregue'
                                    else 'Arquivar' end,
              'pedidos', (select coalesce(jsonb_agg(p.numero order by p.numero), '[]'::jsonb)
                            from public.pedidos p where p.id = any (v_ids)),
              'pedido_ids', to_jsonb(v_ids),
              'feitos', v_feitos, 'nao_feitos', v_falhas,
              'observacao', v_obs));
end;
$$;

comment on function public.plt_fn_pcp_ajustar_pedidos(bigint[], text, text) is
  'D-117 (SESSAO-30): o PCP do super admin — concluído · em rota · entregue · arquivar, para até 300 pedidos, um resultado por pedido. Nada vai ao Tiny.';

revoke all on function public.plt_fn_pcp_ajustar_pedidos(bigint[], text, text) from public, anon;
grant execute on function public.plt_fn_pcp_ajustar_pedidos(bigint[], text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 6 · "Todos os pedidos" do PCP por CURSOR (regra 18 — a tela foi tocada): a
--     página é cortada ANTES de contar unidades (a porta antiga contava as dos
--     5.400 pedidos e só depois cortava — 3,2 s); a situação na plataforma
--     vem pronta; o total é contado com teto (10.000) e só na 1ª página.
--     Cursor = o número do pedido (único e crescente no tempo).
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pcp_todos_pedidos(
  p_busca        text    default null,
  p_antes_numero integer default null,
  p_limite       integer default 20
)
returns table (
  pedido_id               bigint,
  numero                  integer,
  cliente_nome            text,
  data_pedido             date,
  data_prevista           date,
  situacao                text,
  total_unidades          integer,
  unidades_liberadas      integer,
  alterado_apos_liberacao boolean,
  card_id                 bigint,
  situacao_plataforma     text,
  tem_mais                boolean,
  contagem_total          integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cfg as (
    select least(greatest(coalesce(p_limite, 20), 1), 100) as limite,
           nullif(btrim(coalesce(p_busca, '')), '')       as busca
  ),
  pagina as (
    select p.id, p.numero, p.cliente_id, p.data_pedido, p.data_prevista, p.situacao,
           c.nome as cliente_nome
      from public.pedidos p
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
           when exists (select 1 from public.plt_eventos e
                         where e.card_id = pc.id and e.tipo = 'pedido_entregue') then 'entregue'
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
               from public.pedidos p2
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
$$;

comment on function public.plt_fn_pcp_todos_pedidos(text, integer, integer) is
  'Aba "Todos os pedidos" do PCP (SESSAO-30 — regra 18): página por cursor (número do pedido, decrescente), unidades e situação na plataforma (sem_card · pcp · producao · aguardo · em_rota · entregue · arquivado) só da página, total com teto de 10.000 só na 1ª. Gate da logística.';

revoke all on function public.plt_fn_pcp_todos_pedidos(text, integer, integer) from public, anon;
grant execute on function public.plt_fn_pcp_todos_pedidos(text, integer, integer) to authenticated;
