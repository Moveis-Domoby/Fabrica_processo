-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 15 — QUALIDADE NAS TRANSIÇÕES
-- Sessão: SESSAO-06 · Data: 2026-08-27
--
-- A dupla atestação da D-09 (revisada: sem foto, sem disputa/pausa) vira REGRA
-- de banco. O vocabulário já existia desde a SESSAO-02 (qualidade_marcada,
-- qualidade_parecer, plt_vw_qualidade_transicoes, plt_notificacoes) — o que
-- entra aqui é o que FAZ o fluxo acontecer:
--
--   1. etapa DANIFICADO garantida por setor (D-25: criada pelo sistema,
--      preguiçosamente — exceção de infraestrutura à D-14, não chute de etapa)
--   2. validações por trigger (M-14 — valem até para a service_role):
--      · mover ENTRE setores saindo de setor de produção, pela interface,
--        exige marcação 🟢🟡🔴 vinculada (D-09); saída do PCP não (D-25);
--        API passa livre (RF-86 — só chega em PCP/ROTAS, D-25)
--      · iniciar exige o parecer do recebedor quando a chegada teve marcação
--      · parecer responde à CHEGADA ATUAL, uma vez só, com autor humano
--   3. reações automáticas (M-01 — automatizar consequências):
--      · parecer 🔴 → card vai para a etapa DANIFICADO do setor
--      · marcação 🟡/🔴 e parecer divergente → notificação aos líderes dos
--        DOIS setores + admins, com o relato exato (Q-18/D-25)
--      · chegada em ESTOQUE → notificação aos admins (a logística ainda não
--        existe como entidade — D-25: fica no planejamento)
--      · cada lote de avisos vira evento notificacao_enviada (append-only)
--   4. RPC plt_fn_mover_card: marcação + movimentação numa transação só
--      (padrão E-11 — endpoint de propósito, gate interno)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · Etapa DANIFICADO por setor (D-25, letra a)
--
-- O flag em vez de nome mágico: o dono pode renomear a etapa sem quebrar o
-- fluxo. Criação preguiçosa: setor que nunca viu dano nunca ganha a coluna.
-- ----------------------------------------------------------------------------
alter table public.plt_etapas
  add column if not exists eh_danificado boolean not null default false;

comment on column public.plt_etapas.eh_danificado is
  'D-09/D-25: etapa especial para onde vai o card com 🔴 confirmado pelo recebedor. O sistema garante uma por setor quando precisa.';

-- Uma etapa DANIFICADO por setor, no máximo — como a de fila.
create unique index if not exists plt_etapas_danificado_unica_por_setor
  on public.plt_etapas (setor_id) where eh_danificado and ativa;

create or replace function plt_privado.fn_garantir_etapa_danificado(p_setor_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  select e.id into v_id
    from public.plt_etapas e
   where e.setor_id = p_setor_id and e.eh_danificado and e.ativa
   limit 1;
  if v_id is not null then
    return v_id;
  end if;

  -- Ordem alta para a coluna ficar no fim do quadro. Se o dono já cadastrou
  -- uma etapa chamada DANIFICADO à mão, ela é promovida em vez de duplicar.
  insert into public.plt_etapas (setor_id, nome, ordem, eh_fila, eh_danificado, ativa)
       values (p_setor_id, 'DANIFICADO', 9999, false, true, true)
  on conflict (setor_id, nome)
    do update set eh_danificado = true, ativa = true
  returning id into v_id;

  return v_id;
end;
$$;

comment on function plt_privado.fn_garantir_etapa_danificado(bigint) is
  'Garante a etapa DANIFICADO do setor (cria na primeira necessidade — D-25). Chamada pela reação ao parecer 🔴.';

-- ----------------------------------------------------------------------------
-- 2 · Rótulo humano do estado — para mensagens de erro e notificação
-- (M-12: estado nunca se comunica só por cor — emoji + texto sempre juntos.)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_rotulo_estado(p_estado text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_estado
    when 'perfeito'   then '🟢 perfeito estado'
    when 'atencao'    then '🟡 estado de atenção'
    when 'danificado' then '🔴 danificado'
    else coalesce(p_estado, 'sem estado')
  end;
$$;

-- ----------------------------------------------------------------------------
-- 3 · Validação dos eventos de qualidade (BEFORE INSERT)
--
-- As regras da D-09/D-25, valendo para TODO escritor:
--   · qualidade é gesto de PESSOA (Q-19): marcação e parecer exigem usuario_id;
--   · mover entre setores via interface, saindo de setor de PRODUÇÃO, exige
--     marcação vinculada — do mesmo card, da mesma transição, do mesmo autor,
--     nunca reaproveitada. Saída de entrada (PCP) e de terminal não exige
--     (D-25); origem api/automacao não exige (RF-86);
--   · parecer: responde à marcação da CHEGADA ATUAL do card, uma vez só;
--   · iniciar: se a chegada teve marcação, o parecer vem ANTES (D-09 item 2).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_qualidade()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card     public.plt_cards%rowtype;
  v_marc     public.plt_eventos%rowtype;
  v_chegada  public.plt_eventos%rowtype;
  v_papel_origem text;
  v_setor_nome   text;
begin
  if new.tipo not in
     ('movimentacao_setor', 'qualidade_marcada', 'qualidade_parecer', 'execucao_iniciada') then
    return new;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;

  -- ---------- Marcação de quem entrega ----------
  if new.tipo = 'qualidade_marcada' then
    if new.usuario_id is null then
      raise exception 'A atestação de qualidade é gesto de pessoa (D-09/Q-19) — usuario_id é obrigatório.'
        using errcode = 'check_violation';
    end if;
    if new.setor_origem_id is null or new.setor_destino_id is null then
      raise exception 'A marcação de qualidade pertence a uma transição: setor de origem e de destino são obrigatórios.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- ---------- Mover entre setores: a marcação é obrigatória (D-09) ----------
  if new.tipo = 'movimentacao_setor' then
    -- API/automação movem sem estado (RF-86/D-25); gesto sem pessoa idem.
    if new.origem <> 'interface' or new.usuario_id is null then
      return new;
    end if;

    select s.papel_no_fluxo into v_papel_origem
      from public.plt_setores s where s.id = new.setor_origem_id;

    -- Só a saída de setor de PRODUÇÃO exige marcação: no PCP a peça ainda nem
    -- foi produzida (D-25) e no terminal ela já foi entregue ao fim de linha.
    if coalesce(v_papel_origem, '') <> 'producao' then
      return new;
    end if;

    if new.evento_referencia_id is null then
      raise exception 'Mover para outro setor exige marcar o estado da peça (D-09): 🟢 perfeito estado · 🟡 estado de atenção · 🔴 danificado.'
        using errcode = 'check_violation';
    end if;

    select * into v_marc from public.plt_eventos where id = new.evento_referencia_id;
    if not found or v_marc.tipo <> 'qualidade_marcada' or v_marc.card_id <> new.card_id then
      raise exception 'A movimentação precisa apontar uma marcação de qualidade deste mesmo card (D-09).'
        using errcode = 'check_violation';
    end if;
    if v_marc.setor_origem_id is distinct from new.setor_origem_id
       or v_marc.setor_destino_id is distinct from new.setor_destino_id then
      raise exception 'A marcação de qualidade é desta transição: origem e destino precisam bater com a movimentação.'
        using errcode = 'check_violation';
    end if;
    if v_marc.usuario_id is distinct from new.usuario_id then
      raise exception 'Quem entrega marca (D-09): a marcação precisa ser de quem está movendo o card.'
        using errcode = 'check_violation';
    end if;
    if exists (
      select 1 from public.plt_eventos m
       where m.tipo = 'movimentacao_setor' and m.evento_referencia_id = v_marc.id
    ) then
      raise exception 'Esta marcação de qualidade já foi usada em outra movimentação — marque de novo.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- ---------- Parecer de quem recebe ----------
  if new.tipo = 'qualidade_parecer' then
    if new.usuario_id is null then
      raise exception 'O parecer de recebimento é gesto de pessoa (D-09/Q-19) — usuario_id é obrigatório.'
        using errcode = 'check_violation';
    end if;
    if new.evento_referencia_id is null then
      raise exception 'O parecer precisa apontar a marcação de quem entregou (evento_referencia_id).'
        using errcode = 'check_violation';
    end if;

    select * into v_marc from public.plt_eventos where id = new.evento_referencia_id;
    if not found or v_marc.tipo <> 'qualidade_marcada' or v_marc.card_id <> new.card_id then
      raise exception 'O parecer precisa responder a uma marcação de qualidade deste mesmo card.'
        using errcode = 'check_violation';
    end if;
    if exists (
      select 1 from public.plt_eventos p
       where p.tipo = 'qualidade_parecer' and p.evento_referencia_id = v_marc.id
    ) then
      raise exception 'Esta chegada já teve o recebimento confirmado — o parecer se registra uma vez só.'
        using errcode = 'check_violation';
    end if;

    -- O parecer responde à CHEGADA ATUAL: se o card já se moveu de novo, a
    -- marcação antiga fica como registro unilateral (não trava nada — D-09).
    select * into v_chegada
      from public.plt_eventos e
     where e.card_id = new.card_id and e.tipo = 'movimentacao_setor'
     order by e.ocorrido_em desc, e.id desc
     limit 1;
    if not found or v_chegada.evento_referencia_id is distinct from v_marc.id then
      raise exception 'Este card já seguiu adiante — o parecer responde só à chegada atual.'
        using errcode = 'check_violation';
    end if;

    -- O trigger preenche a transição a partir da marcação (a view calcula a
    -- divergência por este vínculo; nada de confiar no que o cliente mandou).
    new.setor_origem_id := v_marc.setor_origem_id;
    new.setor_destino_id := v_marc.setor_destino_id;
    return new;
  end if;

  -- ---------- Iniciar: o recebimento vem antes (D-09 item 2) ----------
  if new.tipo = 'execucao_iniciada' then
    select * into v_chegada
      from public.plt_eventos e
     where e.card_id = new.card_id and e.tipo = 'movimentacao_setor'
     order by e.ocorrido_em desc, e.id desc
     limit 1;

    if found and v_chegada.evento_referencia_id is not null
       and not exists (
         select 1 from public.plt_eventos p
          where p.tipo = 'qualidade_parecer'
            and p.evento_referencia_id = v_chegada.evento_referencia_id
       ) then
      select v.nome, v.estado into v_setor_nome, v_papel_origem
        from (
          select s.nome, m.estado_qualidade as estado
            from public.plt_eventos m
            left join public.plt_setores s on s.id = m.setor_origem_id
           where m.id = v_chegada.evento_referencia_id
        ) v;
      raise exception 'Antes de iniciar, confirme o recebimento (D-09): o setor % marcou a peça como % — registre seu parecer.',
        coalesce(v_setor_nome, 'anterior'), plt_privado.fn_rotulo_estado(v_papel_origem)
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  return new;
end;
$$;

comment on function plt_privado.fn_validar_qualidade() is
  'Regras da D-09/D-25 valendo para todo escritor (M-14): marcação obrigatória ao sair de produção pela interface, parecer da chegada atual uma vez só, iniciar só depois do parecer.';

drop trigger if exists plt_eventos_validar_qualidade on public.plt_eventos;
create trigger plt_eventos_validar_qualidade
  before insert on public.plt_eventos
  for each row execute function plt_privado.fn_validar_qualidade();

-- ----------------------------------------------------------------------------
-- 4 · Reações (AFTER INSERT): DANIFICADO + notificações automáticas
--
-- M-01: o humano decide (marca, dá o parecer); o sistema executa as
-- consequências. Roda DEPOIS de plt_eventos_projetar (ordem alfabética dos
-- triggers), então a projeção do card já aconteceu.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_reagir_qualidade()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card        public.plt_cards%rowtype;
  v_marc        public.plt_eventos%rowtype;
  v_setor_origem  text;
  v_setor_destino text;
  v_autor         text;
  v_autor_marc    text;
  v_pedido_numero integer;
  v_peca          text;
  v_etapa_danificado bigint;
  v_tipo_aviso    text;
  v_titulo        text;
  v_corpo         text;
  v_destinatarios uuid[];
  v_destinatario  uuid;
  v_divergente    boolean;
begin
  if new.tipo not in ('qualidade_marcada', 'qualidade_parecer', 'movimentacao_setor') then
    return null;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  select p.numero into v_pedido_numero from public.pedidos p where p.id = v_card.pedido_id;
  v_peca := coalesce(v_card.item_descricao, 'Peça')
            || case when v_card.indice_unidade is not null
                    then format(' (%s/%s)', v_card.indice_unidade, v_card.total_unidades)
                    else '' end
            || coalesce(' · Pedido ' || v_pedido_numero, '');

  select s.nome into v_setor_origem  from public.plt_setores s where s.id = new.setor_origem_id;
  select s.nome into v_setor_destino from public.plt_setores s where s.id = new.setor_destino_id;
  select u.nome into v_autor from public.plt_usuarios u where u.id = new.usuario_id;

  -- ---------- Chegada em ESTOQUE avisa os admins (D-25) ----------
  -- Lá não existe "iniciar", então ninguém confirmaria o recebimento: o aviso
  -- substitui a segunda atestação. A logística entra quando existir como
  -- entidade na plataforma (por ora é o PCP — D-22; fica no planejamento).
  if new.tipo = 'movimentacao_setor' then
    if exists (select 1 from public.plt_setores s
                where s.id = new.setor_destino_id and s.codigo = 'estoque') then
      v_tipo_aviso := 'chegada_estoque';
      v_titulo := 'Peça chegou ao ESTOQUE';
      v_corpo  := v_peca || ' chegou ao ESTOQUE'
                  || coalesce(' vinda de ' || v_setor_origem, '')
                  || coalesce(' por ' || v_autor, '')
                  || case when v_card.qualidade_atual is not null
                          then ', marcada como ' || plt_privado.fn_rotulo_estado(v_card.qualidade_atual)
                          else '' end
                  || '.';
      select coalesce(array_agg(distinct u.id), '{}') into v_destinatarios
        from public.plt_usuarios u
       where u.ativo and u.papel = 'admin'
         and u.id is distinct from new.usuario_id;
    else
      return null;
    end if;

  -- ---------- Marcação 🟡/🔴 de quem entrega (Q-18) ----------
  elsif new.tipo = 'qualidade_marcada' then
    if new.estado_qualidade not in ('atencao', 'danificado') then
      return null;
    end if;
    v_tipo_aviso := 'qualidade_' || new.estado_qualidade;
    v_titulo := 'Peça marcada como ' || plt_privado.fn_rotulo_estado(new.estado_qualidade);
    v_corpo  := coalesce(v_autor, 'Alguém') || coalesce(' (' || v_setor_origem || ')', '')
                || ' marcou a peça como ' || plt_privado.fn_rotulo_estado(new.estado_qualidade)
                || coalesce(' ao mover para ' || v_setor_destino, '')
                || '. ' || v_peca || '.';

  -- ---------- Parecer: divergência ou 🔴 confirmado (Q-18 / RF-83) ----------
  else
    select * into v_marc from public.plt_eventos where id = new.evento_referencia_id;
    v_divergente := v_marc.estado_qualidade is distinct from new.estado_qualidade;

    -- 🔴 registrado pelo recebedor (confirmado OU divergente para 🔴):
    -- o card vai para a etapa DANIFICADO do setor onde está (D-09 item 4).
    if new.estado_qualidade = 'danificado' and v_card.setor_atual_id is not null then
      v_etapa_danificado := plt_privado.fn_garantir_etapa_danificado(v_card.setor_atual_id);
      if v_card.etapa_atual_id is distinct from v_etapa_danificado then
        insert into public.plt_eventos
            (card_id, tipo, usuario_id, origem,
             setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
             observacao)
          values
            (new.card_id, 'movimentacao_etapa', new.usuario_id, 'automacao',
             v_card.setor_atual_id, v_card.etapa_atual_id,
             v_card.setor_atual_id, v_etapa_danificado,
             'Consequência automática do parecer 🔴 danificado (D-09).');
      end if;
    end if;

    if not v_divergente and new.estado_qualidade <> 'danificado' then
      -- Concordância em 🟢/🟡 não gera aviso novo: o 🟡 já avisou na marcação.
      return null;
    end if;

    select u.nome into v_autor_marc from public.plt_usuarios u where u.id = v_marc.usuario_id;
    if v_divergente then
      v_tipo_aviso := 'qualidade_divergencia';
      v_titulo := 'Divergência de qualidade entre ' || coalesce(v_setor_origem, 'setores')
                  || ' e ' || coalesce(v_setor_destino, '');
      v_corpo  := coalesce(v_autor_marc, 'Quem entregou') || coalesce(' (' || v_setor_origem || ')', '')
                  || ' marcou ' || plt_privado.fn_rotulo_estado(v_marc.estado_qualidade)
                  || '; ' || coalesce(v_autor, 'quem recebeu') || coalesce(' (' || v_setor_destino || ')', '')
                  || ' registrou ' || plt_privado.fn_rotulo_estado(new.estado_qualidade)
                  || '. ' || v_peca || '.'
                  || case when new.estado_qualidade = 'danificado'
                          then ' O card foi para a etapa DANIFICADO.' else '' end;
    else
      v_tipo_aviso := 'qualidade_danificado';
      v_titulo := 'Dano confirmado no recebimento';
      v_corpo  := coalesce(v_autor, 'Quem recebeu') || coalesce(' (' || v_setor_destino || ')', '')
                  || ' confirmou ' || plt_privado.fn_rotulo_estado('danificado')
                  || coalesce(' na entrega de ' || v_setor_origem, '')
                  || '. ' || v_peca || '. O card foi para a etapa DANIFICADO.';
    end if;
  end if;

  -- ---------- Destinatários: líderes dos DOIS setores + admins (D-25) ----------
  if v_destinatarios is null then
    select coalesce(array_agg(distinct pessoa), '{}') into v_destinatarios
      from (
        select u.id as pessoa
          from public.plt_usuarios u
         where u.ativo and u.papel = 'admin'
        union
        select us.usuario_id
          from public.plt_usuario_setores us
          join public.plt_usuarios u on u.id = us.usuario_id and u.ativo
         where us.lider_do_setor
           and us.setor_id in (new.setor_origem_id, new.setor_destino_id)
      ) todos
     where pessoa is distinct from new.usuario_id;
  end if;

  if array_length(v_destinatarios, 1) is null then
    return null;
  end if;

  foreach v_destinatario in array v_destinatarios loop
    insert into public.plt_notificacoes
        (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
      values
        (v_destinatario, new.id, new.card_id, v_tipo_aviso, v_titulo, v_corpo);
  end loop;

  -- O FATO de o aviso ter saído também é história do card (demanda item 8).
  insert into public.plt_eventos
      (card_id, tipo, origem, evento_referencia_id,
       setor_origem_id, setor_destino_id, observacao, dados)
    values
      (new.card_id, 'notificacao_enviada', 'automacao', new.id,
       new.setor_origem_id, new.setor_destino_id, v_titulo,
       jsonb_build_object('tipo', v_tipo_aviso, 'destinatarios', to_jsonb(v_destinatarios)));

  return null;
end;
$$;

comment on function plt_privado.fn_reagir_qualidade() is
  'Consequências automáticas da qualidade (M-01/D-25): parecer 🔴 leva o card à etapa DANIFICADO; 🟡/🔴/divergência notificam líderes dos dois setores + admins; chegada em ESTOQUE avisa os admins.';

drop trigger if exists plt_eventos_reagir_qualidade on public.plt_eventos;
create trigger plt_eventos_reagir_qualidade
  after insert on public.plt_eventos
  for each row execute function plt_privado.fn_reagir_qualidade();

-- ----------------------------------------------------------------------------
-- 5 · Mover com marcação, numa transação só (endpoint de propósito — E-11)
--
-- Dois INSERTs soltos pelo navegador deixariam uma marcação órfã se o segundo
-- falhasse. A RPC faz o par completo — ou tudo, ou nada. O gate espelha o RLS
-- de escrita de eventos (admin, ou gente do setor de origem/destino); as
-- regras de verdade continuam nos triggers, valendo para qualquer caminho.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_mover_card(
  p_card_id           bigint,
  p_setor_destino_id  bigint,
  p_etapa_destino_id  bigint default null,
  p_estado_qualidade  text default null,
  p_observacao        text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_card     public.plt_cards%rowtype;
  v_papel_origem text;
  v_marcacao_id  bigint;
  v_evento_id    bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma move cards.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards where id = p_card_id;
  if not found then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;

  if not (
    plt_privado.fn_eh_admin()
    or v_card.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
    or p_setor_destino_id in (select plt_privado.fn_setores_do_usuario())
  ) then
    raise exception 'Você não trabalha nem no setor de origem nem no de destino deste card.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_card.setor_atual_id = p_setor_destino_id then
    -- Mesmo setor: mudança de etapa, sem qualidade (D-25).
    if v_card.etapa_atual_id is not distinct from p_etapa_destino_id then
      raise exception 'O card já está aí — escolha outro destino.' using errcode = 'check_violation';
    end if;
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem,
         setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id)
      values
        (p_card_id, 'movimentacao_etapa', v_usuario, 'interface',
         v_card.setor_atual_id, v_card.etapa_atual_id, p_setor_destino_id, p_etapa_destino_id)
      returning id into v_evento_id;
    return v_evento_id;
  end if;

  -- Entre setores: saindo de PRODUÇÃO, a marcação é obrigatória (D-09/D-25).
  select s.papel_no_fluxo into v_papel_origem
    from public.plt_setores s where s.id = v_card.setor_atual_id;

  if v_papel_origem = 'producao' then
    if p_estado_qualidade is null then
      raise exception 'Mover para outro setor exige marcar o estado da peça (D-09): 🟢 perfeito estado · 🟡 estado de atenção · 🔴 danificado.'
        using errcode = 'check_violation';
    end if;
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem,
         setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
         estado_qualidade, observacao)
      values
        (p_card_id, 'qualidade_marcada', v_usuario, 'interface',
         v_card.setor_atual_id, v_card.etapa_atual_id, p_setor_destino_id, p_etapa_destino_id,
         p_estado_qualidade, nullif(btrim(p_observacao), ''))
      returning id into v_marcacao_id;
  end if;

  insert into public.plt_eventos
      (card_id, tipo, usuario_id, origem,
       setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
       evento_referencia_id)
    values
      (p_card_id, 'movimentacao_setor', v_usuario, 'interface',
       v_card.setor_atual_id, v_card.etapa_atual_id, p_setor_destino_id, p_etapa_destino_id,
       v_marcacao_id)
    returning id into v_evento_id;

  return v_evento_id;
end;
$$;

comment on function public.plt_fn_mover_card(bigint, bigint, bigint, text, text) is
  'Move um card pela interface (SESSAO-06): marcação de qualidade + movimentação numa transação só. Endpoint REST de propósito — gate interno; as regras de verdade vivem nos triggers.';

-- ----------------------------------------------------------------------------
-- 6 · Parecer do recebedor, também atômico e com gate (E-11)
--
-- O INSERT direto funcionaria via RLS, mas a RPC dá o mesmo desenho do mover:
-- valida quem pode (gente do setor que recebe, ou admin) e devolve o id.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_registrar_parecer(
  p_marcacao_id      bigint,
  p_estado_qualidade text,
  p_observacao       text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_marc    public.plt_eventos%rowtype;
  v_evento_id bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma registra parecer.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_marc from public.plt_eventos where id = p_marcacao_id;
  if not found or v_marc.tipo <> 'qualidade_marcada' then
    raise exception 'Marcação de qualidade % não existe.', p_marcacao_id using errcode = 'no_data_found';
  end if;

  if not (
    plt_privado.fn_eh_admin()
    or v_marc.setor_destino_id in (select plt_privado.fn_setores_do_usuario())
  ) then
    raise exception 'O parecer é do setor que recebe a peça (D-09) — você não trabalha nele.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.plt_eventos
      (card_id, tipo, usuario_id, origem, evento_referencia_id,
       estado_qualidade, observacao)
    values
      (v_marc.card_id, 'qualidade_parecer', v_usuario, 'interface', p_marcacao_id,
       p_estado_qualidade, nullif(btrim(p_observacao), ''))
    returning id into v_evento_id;

  return v_evento_id;
end;
$$;

comment on function public.plt_fn_registrar_parecer(bigint, text, text) is
  'Registra o parecer de recebimento (SESSAO-06/D-09). Endpoint REST de propósito — gate: gente do setor recebedor ou admin; validações de verdade no trigger.';

-- ----------------------------------------------------------------------------
-- 7 · Quem executa o quê (E-11: nada exposto além do combinado)
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_garantir_etapa_danificado(bigint) from public, anon, authenticated;
revoke all on function plt_privado.fn_rotulo_estado(text)               from public, anon, authenticated;
revoke all on function plt_privado.fn_validar_qualidade()               from public, anon, authenticated;
revoke all on function plt_privado.fn_reagir_qualidade()                from public, anon, authenticated;
revoke all on function public.plt_fn_mover_card(bigint, bigint, bigint, text, text) from public, anon;
revoke all on function public.plt_fn_registrar_parecer(bigint, text, text)          from public, anon;

grant execute on function public.plt_fn_mover_card(bigint, bigint, bigint, text, text) to authenticated;
grant execute on function public.plt_fn_registrar_parecer(bigint, text, text)          to authenticated;
