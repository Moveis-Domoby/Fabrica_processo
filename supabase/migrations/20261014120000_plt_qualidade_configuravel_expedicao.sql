-- ============================================================================
-- Migration 66 · SESSAO-31 (etapa A) — a marcação do estado da peça vira
-- CONFIGURAÇÃO e a LIMPEZA E EMBALAGEM conclui pela etapa EXPEDIÇÃO
--
-- Pedidos do dono (13–14/10/2026):
--   D-126 — "remova essa marcação, deixe como uma opção de ligar e desligar e
--           para quais tipos de card … para qual setor também"; "deve ter a
--           opção de confirmar situação no envio e no recebimento … bem
--           personalizado". Cada setor tem DUAS chaves, cada uma com os tipos
--           de card em que vale: "pedir o estado ao ENVIAR" (quem tira a peça
--           do setor marca) e "pedir o estado ao RECEBER" (o setor confirma o
--           estado na chegada, antes de começar). TUDO NASCE DESLIGADO.
--           ↩️ revisa a D-09 (lei — "obrigatório em TODA transição").
--   D-127 — "o concluir card do setor de limpeza e embalagem deve ser a
--           movimentação para a etapa expedição": a etapa ganha a rota
--           "conclui a produção" (dado do dono, editável — D-60); soltar nela
--           faz o que o botão fazia (pedido vivo → Pedidos em aguardo; sem
--           pedido/cancelado → ESTOQUE sem dono). ↩️ revisa a D-59.
--
-- Como fica (cada regra com UM dono — M-04):
--   · plt_setores.qualidade_envio_tipos / qualidade_recebimento_tipos (text[],
--     vazio = desligado) — os tipos: peca_pedido · peca_estoque · avulso
--     (fn_tipo_qualidade);
--   · a confirmação pendente vira PROJEÇÃO no card (plt_cards.parecer_pendente_id
--     — a marcação de quem entregou, ou a própria chegada quando ninguém
--     marcou), escrita por gatilho a partir do evento (M-13). O iniciar, o
--     parecer e a tarefa do Sistema leem dela — a tela também (sem as duas
--     consultas a mais por quadro);
--   · marcação 🔴 sem confirmação na chegada → a peça vai sozinha para o
--     DANIFICADO do setor que recebe (D-09 item 4, agora sem esperar parecer);
--   · os fins de linha seguem recusando 🟡/🔴; peça sem marcação entra normal
--     (fn_validar_chegada_estoque já tratava "sem estado" como bom).
--
-- E-24: as funções recriadas partem da versão MAIS NOVA de cada uma:
--   fn_validar_qualidade (migration 16) · plt_fn_mover_card (16) ·
--   plt_fn_registrar_parecer (16) · fn_reagir_qualidade (37) ·
--   fn_tarefa_sistema_qualidade (33) · fn_etapa_inicio (37) ·
--   plt_fn_soltar_card (37) · plt_fn_concluir_producao (37).
-- E-66: lock_timeout curto — a aplicação desiste inteira em vez de enfileirar
-- as telas atrás da trava.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · As chaves de cada setor (D-126)
-- ----------------------------------------------------------------------------
alter table public.plt_setores
  add column if not exists qualidade_envio_tipos text[] not null default '{}';
alter table public.plt_setores
  add column if not exists qualidade_recebimento_tipos text[] not null default '{}';

alter table public.plt_setores drop constraint if exists plt_setores_qualidade_tipos_ck;
alter table public.plt_setores add constraint plt_setores_qualidade_tipos_ck check (
  qualidade_envio_tipos <@ array['peca_pedido', 'peca_estoque', 'avulso']::text[]
  and qualidade_recebimento_tipos <@ array['peca_pedido', 'peca_estoque', 'avulso']::text[]
);

comment on column public.plt_setores.qualidade_envio_tipos is
  'SESSAO-31 (D-126): em que tipos de card quem TIRA a peça deste setor (de produção) marca o estado — perfeito/atenção/danificado. Vazio = não pede. Tipos: peca_pedido, peca_estoque, avulso.';
comment on column public.plt_setores.qualidade_recebimento_tipos is
  'SESSAO-31 (D-126): em que tipos de card este setor (de produção) CONFIRMA o estado da peça na chegada (vinda de outro setor de produção, por gente), antes de começar. Vazio = não pede.';

-- ----------------------------------------------------------------------------
-- 2 · A etapa que CONCLUI a produção (D-127)
-- ----------------------------------------------------------------------------
alter table public.plt_etapas
  add column if not exists conclui_producao boolean not null default false;

alter table public.plt_etapas drop constraint if exists plt_etapas_conclui_ck;
alter table public.plt_etapas add constraint plt_etapas_conclui_ck check (
  not conclui_producao
  or (not eh_fila and not eh_danificado and setor_destino_id is null)
);

comment on column public.plt_etapas.conclui_producao is
  'SESSAO-31 (D-127): soltar a peça aqui CONCLUI a produção — peça de pedido vivo vai para Pedidos em aguardo; sem pedido ou de pedido cancelado, para o ESTOQUE sem dono. Só em setor de produção; nunca na fila, no DANIFICADO nem numa etapa que encaminha.';

-- Só setor de PRODUÇÃO conclui (regra que o check não alcança — outra tabela).
create or replace function plt_privado.fn_validar_etapa_conclui()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.conclui_producao and not exists (
    select 1 from public.plt_setores s
     where s.id = new.setor_id and s.papel_no_fluxo = 'producao'
  ) then
    raise exception 'Só etapa de setor de produção conclui a produção.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists plt_etapas_validar_conclui on public.plt_etapas;
create trigger plt_etapas_validar_conclui
  before insert or update of conclui_producao, setor_id on public.plt_etapas
  for each row execute function plt_privado.fn_validar_etapa_conclui();

-- ----------------------------------------------------------------------------
-- 3 · A confirmação pendente é projeção no card (M-13)
-- ----------------------------------------------------------------------------
alter table public.plt_cards
  add column if not exists parecer_pendente_id bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plt_cards_parecer_pendente_fk') then
    alter table public.plt_cards
      add constraint plt_cards_parecer_pendente_fk
      foreign key (parecer_pendente_id) references public.plt_eventos (id);
  end if;
end;
$$;

-- Lei 7.1: chave estrangeira sempre com índice (parcial — quase sempre nula).
create index if not exists plt_cards_parecer_pendente_idx
  on public.plt_cards (parecer_pendente_id) where parecer_pendente_id is not null;

comment on column public.plt_cards.parecer_pendente_id is
  'SESSAO-31 (D-126): a chegada que este setor ainda precisa confirmar — a marcação de quem entregou ou, sem marcação, o próprio evento da chegada. Projeção escrita só por gatilho (fn_projetar_parecer). Nula = nada a confirmar.';

-- ----------------------------------------------------------------------------
-- 4 · As regras, cada uma com um dono
-- ----------------------------------------------------------------------------

-- O "tipo de card" das chaves (D-126): peça de pedido, peça de estoque
-- (reposição ou sem dono) e avulso (SESSAO-31, etapa D). Card do pedido e de
-- reposição não andam pela produção — não entram.
create or replace function plt_privado.fn_tipo_qualidade(p_tipo text, p_pedido_id bigint)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
           when p_tipo = 'unidade' and p_pedido_id is not null then 'peca_pedido'
           when p_tipo = 'unidade' then 'peca_estoque'
           when p_tipo = 'avulso' then 'avulso'
         end;
$$;

-- O setor pede o estado neste momento ('envio' | 'recebimento') para este card?
create or replace function plt_privado.fn_pede_estado(
  p_setor_id  bigint,
  p_momento   text,
  p_tipo      text,
  p_pedido_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select plt_privado.fn_tipo_qualidade(p_tipo, p_pedido_id)
              = any(case when p_momento = 'envio' then s.qualidade_envio_tipos
                         else s.qualidade_recebimento_tipos end)
       from public.plt_setores s
      where s.id = p_setor_id),
    false);
$$;

comment on function plt_privado.fn_pede_estado(bigint, text, text, bigint) is
  'SESSAO-31 (D-126): a regra única das chaves de qualidade — o setor pede o estado da peça ao enviar/receber este tipo de card?';

-- A etapa de INÍCIO (recriada da 37): a que conclui também não é início.
create or replace function plt_privado.fn_etapa_inicio(p_setor_id bigint)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e2.id
    from public.plt_etapas fila
    join public.plt_etapas e2 on e2.setor_id = fila.setor_id
   where fila.setor_id = p_setor_id
     and fila.eh_fila and fila.ativa
     and e2.ativa and not e2.eh_danificado and not e2.eh_fila
     and e2.setor_destino_id is null
     and not e2.conclui_producao
     and (e2.ordem, e2.id) > (fila.ordem, fila.id)
   order by e2.ordem, e2.id
   limit 1;
$$;

comment on function plt_privado.fn_etapa_inicio(bigint) is
  'SESSAO-24/31: a etapa de início do setor — a próxima depois da fila (ordem seguinte, ativa, não-DANIFICADO, que não encaminha nem conclui). Dono único da regra: o iniciar na fila (migration 30) e o arrasto usam esta.';

-- ----------------------------------------------------------------------------
-- 5 · Mover pela interface (recriada da 16): a marcação só quando o setor pede
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_mover_card(
  p_card_id           bigint,
  p_setor_destino_id  bigint,
  p_etapa_destino_id  bigint default null,
  p_estado_qualidade  text default null,
  p_observacao        text default null,
  p_operador_id       uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao   uuid;
  v_usuario  uuid;
  v_card     public.plt_cards%rowtype;
  v_papel_origem text;
  v_marcacao_id  bigint;
  v_evento_id    bigint;
begin
  v_sessao := plt_privado.fn_usuario_atual();
  if v_sessao is null then
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

  -- Gesto por PIN: o autor passa a ser o operador identificado — desde que
  -- seja gente ativa e trabalhe no setor envolvido (ou seja admin).
  if p_operador_id is not null and p_operador_id <> v_sessao then
    if not exists (select 1 from public.plt_usuarios u where u.id = p_operador_id and u.ativo) then
      raise exception 'Operador não encontrado ou inativo — confira a identificação.'
        using errcode = 'check_violation';
    end if;
    if not (
      exists (select 1 from public.plt_usuarios u
               where u.id = p_operador_id and u.papel = 'admin')
      or exists (select 1 from public.plt_usuario_setores us
                  where us.usuario_id = p_operador_id
                    and us.setor_id in (v_card.setor_atual_id, p_setor_destino_id))
    ) then
      raise exception 'O operador identificado não trabalha nem no setor de origem nem no de destino.'
        using errcode = 'insufficient_privilege';
    end if;
    v_usuario := p_operador_id;
  else
    v_usuario := v_sessao;
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

  -- Entre setores, saindo de PRODUÇÃO: a marcação vale quando vem; e é
  -- obrigatória só quando o setor pede o estado ao enviar este tipo (D-126).
  select s.papel_no_fluxo into v_papel_origem
    from public.plt_setores s where s.id = v_card.setor_atual_id;

  if v_papel_origem = 'producao' then
    if p_estado_qualidade is null
       and plt_privado.fn_pede_estado(v_card.setor_atual_id, 'envio', v_card.tipo, v_card.pedido_id) then
      raise exception 'Este setor pede para marcar o estado da peça ao mandar adiante: 🟢 perfeito estado · 🟡 estado de atenção · 🔴 danificado.'
        using errcode = 'check_violation';
    end if;
    if p_estado_qualidade is not null then
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

comment on function public.plt_fn_mover_card(bigint, bigint, bigint, text, text, uuid) is
  'Move um card pela interface: marcação de qualidade (quando vem, ou quando o setor pede ao enviar — D-126) + movimentação numa transação só. p_operador_id = autor identificado por PIN no tablet (SESSAO-07). Endpoint REST de propósito — gate interno; as regras de verdade vivem nos triggers.';

-- ----------------------------------------------------------------------------
-- 6 · As regras da qualidade para todo escritor (recriada da 16 — M-14)
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
  v_ref      public.plt_eventos%rowtype;
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
      -- D-09/Q-19: atestação é gesto exclusivamente humano.
      raise exception 'A atestação de qualidade é gesto de pessoa — é preciso dizer quem marcou.'
        using errcode = 'check_violation';
    end if;
    if new.setor_origem_id is null or new.setor_destino_id is null then
      raise exception 'A marcação de qualidade pertence a uma transição: setor de origem e de destino são obrigatórios.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- ---------- Mover entre setores: a marcação quando o setor pede (D-126) ----------
  if new.tipo = 'movimentacao_setor' then
    -- API/automação movem sem estado (RF-86/D-25); gesto sem pessoa idem.
    if new.origem <> 'interface' or new.usuario_id is null then
      return new;
    end if;

    select s.papel_no_fluxo into v_papel_origem
      from public.plt_setores s where s.id = new.setor_origem_id;

    -- Só a saída de setor de PRODUÇÃO tem marcação: no PCP a peça ainda nem
    -- foi produzida (D-25) e no terminal ela já foi entregue ao fim de linha.
    if coalesce(v_papel_origem, '') <> 'producao' then
      return new;
    end if;

    if new.evento_referencia_id is null then
      if plt_privado.fn_pede_estado(new.setor_origem_id, 'envio', v_card.tipo, v_card.pedido_id) then
        raise exception 'Este setor pede para marcar o estado da peça ao mandar adiante: 🟢 perfeito estado · 🟡 estado de atenção · 🔴 danificado.'
          using errcode = 'check_violation';
      end if;
      return new;
    end if;

    select * into v_marc from public.plt_eventos where id = new.evento_referencia_id;
    if not found or v_marc.tipo <> 'qualidade_marcada' or v_marc.card_id <> new.card_id then
      raise exception 'A movimentação precisa apontar uma marcação de qualidade deste mesmo card.'
        using errcode = 'check_violation';
    end if;
    if v_marc.setor_origem_id is distinct from new.setor_origem_id
       or v_marc.setor_destino_id is distinct from new.setor_destino_id then
      raise exception 'A marcação de qualidade é desta transição: origem e destino precisam bater com a movimentação.'
        using errcode = 'check_violation';
    end if;
    if v_marc.usuario_id is distinct from new.usuario_id then
      -- D-09: quem entrega marca.
      raise exception 'Quem entrega marca: a marcação precisa ser de quem está movendo o card.'
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

  -- ---------- Confirmação de quem recebe ----------
  if new.tipo = 'qualidade_parecer' then
    if new.usuario_id is null then
      -- D-09/Q-19: parecer é gesto humano.
      raise exception 'O parecer de recebimento é gesto de pessoa — é preciso dizer quem confirmou.'
        using errcode = 'check_violation';
    end if;
    if new.evento_referencia_id is null then
      raise exception 'O parecer precisa apontar a chegada que ele confirma (evento_referencia_id).'
        using errcode = 'check_violation';
    end if;

    select * into v_ref from public.plt_eventos where id = new.evento_referencia_id;
    if not found or v_ref.card_id <> new.card_id
       or v_ref.tipo not in ('qualidade_marcada', 'movimentacao_setor') then
      raise exception 'O parecer precisa responder à chegada deste mesmo card.'
        using errcode = 'check_violation';
    end if;
    if exists (
      select 1 from public.plt_eventos p
       where p.tipo = 'qualidade_parecer' and p.evento_referencia_id = v_ref.id
    ) then
      raise exception 'Esta chegada já teve o recebimento confirmado — o parecer se registra uma vez só.'
        using errcode = 'check_violation';
    end if;
    -- O parecer responde à CHEGADA ATUAL que o setor ainda deve confirmar
    -- (a projeção da D-126); chegada antiga fica como registro unilateral.
    if v_card.parecer_pendente_id is distinct from v_ref.id then
      raise exception 'Este card já seguiu adiante — o parecer responde só à chegada atual.'
        using errcode = 'check_violation';
    end if;

    -- A transição vem da chegada (a view calcula a divergência por este
    -- vínculo; nada de confiar no que o cliente mandou).
    new.setor_origem_id := v_ref.setor_origem_id;
    new.setor_destino_id := v_ref.setor_destino_id;
    return new;
  end if;

  -- ---------- Iniciar: a confirmação vem antes (D-09 item 2) ----------
  if new.tipo = 'execucao_iniciada' then
    if v_card.parecer_pendente_id is not null then
      select * into v_ref from public.plt_eventos where id = v_card.parecer_pendente_id;
      select s.nome into v_setor_nome from public.plt_setores s where s.id = v_ref.setor_origem_id;
      if v_ref.tipo = 'qualidade_marcada' then
        raise exception 'Antes de iniciar, confirme o recebimento: o setor % marcou a peça como % — registre seu parecer.',
          coalesce(v_setor_nome, 'anterior'), plt_privado.fn_rotulo_estado(v_ref.estado_qualidade)
          using errcode = 'check_violation';
      end if;
      raise exception 'Antes de iniciar, confirme o recebimento: diga em que estado a peça chegou do setor %.',
        coalesce(v_setor_nome, 'anterior')
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  return new;
end;
$$;

comment on function plt_privado.fn_validar_qualidade() is
  'Regras da qualidade valendo para todo escritor (M-14): a marcação ao sair de produção pela interface quando o setor pede (D-126); o parecer responde à chegada que o card ainda deve confirmar, uma vez só; iniciar só depois da confirmação pendente.';

-- ----------------------------------------------------------------------------
-- 7 · A projeção da confirmação pendente (AFTER — roda depois da posição:
--     "projetar_p…" vem depois de "projetar" na ordem alfabética dos gatilhos)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_projetar_parecer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_pend    bigint;
  v_marcado boolean;
begin
  if new.tipo = 'movimentacao_setor' then
    select * into v_card from public.plt_cards where id = new.card_id;
    v_pend := null;
    -- Só a chegada de GENTE, vinda de outro setor de PRODUÇÃO, a um setor de
    -- produção que pede o estado ao receber este tipo de card (D-126). API e
    -- automação não participam da qualidade (D-25); a saída do PCP não é
    -- transição de qualidade.
    if new.origem = 'interface' and new.usuario_id is not null
       and exists (select 1 from public.plt_setores so
                    where so.id = new.setor_origem_id and so.papel_no_fluxo = 'producao')
       and exists (select 1 from public.plt_setores sd
                    where sd.id = new.setor_destino_id and sd.papel_no_fluxo = 'producao')
       and plt_privado.fn_pede_estado(new.setor_destino_id, 'recebimento', v_card.tipo, v_card.pedido_id) then
      v_marcado := new.evento_referencia_id is not null and exists (
        select 1 from public.plt_eventos m
         where m.id = new.evento_referencia_id and m.tipo = 'qualidade_marcada');
      v_pend := case when v_marcado then new.evento_referencia_id else new.id end;
    end if;
    update public.plt_cards
       set parecer_pendente_id = v_pend
     where id = new.card_id
       and parecer_pendente_id is distinct from v_pend;
    return null;
  end if;

  if new.tipo = 'qualidade_parecer' then
    update public.plt_cards
       set parecer_pendente_id = null
     where id = new.card_id
       and parecer_pendente_id = new.evento_referencia_id;
    return null;
  end if;

  if new.tipo = 'card_arquivado' then
    update public.plt_cards
       set parecer_pendente_id = null
     where id = new.card_id
       and parecer_pendente_id is not null;
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_projetar_parecer on public.plt_eventos;
create trigger plt_eventos_projetar_parecer
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('movimentacao_setor', 'qualidade_parecer', 'card_arquivado'))
  execute function plt_privado.fn_projetar_parecer();

-- Mudou a chave "ao receber" de um setor: a confirmação que deixou de ser
-- pedida some dos cards que estão nele agora (e a tarefa do Sistema dela fecha).
-- Ligar a chave não cria pendência para quem já chegou.
create or replace function plt_privado.fn_setor_qualidade_mudou()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.qualidade_recebimento_tipos is not distinct from old.qualidade_recebimento_tipos then
    return null;
  end if;
  perform set_config('plt.tarefa_sistema', '1', true);
  update public.plt_tarefas t
     set situacao = 'concluida', concluida_em = now()
    from public.plt_cards c
   where t.origem = 'sistema'
     and t.situacao <> 'concluida'
     and t.card_id = c.id
     and t.evento_referencia_id = c.parecer_pendente_id
     and c.setor_atual_id = new.id
     and not (coalesce(plt_privado.fn_tipo_qualidade(c.tipo, c.pedido_id), '') = any(new.qualidade_recebimento_tipos));
  perform set_config('plt.tarefa_sistema', '', true);
  update public.plt_cards c
     set parecer_pendente_id = null
   where c.setor_atual_id = new.id
     and c.parecer_pendente_id is not null
     and not (coalesce(plt_privado.fn_tipo_qualidade(c.tipo, c.pedido_id), '') = any(new.qualidade_recebimento_tipos));
  return null;
end;
$$;

drop trigger if exists plt_setores_qualidade_mudou on public.plt_setores;
create trigger plt_setores_qualidade_mudou
  after update of qualidade_recebimento_tipos on public.plt_setores
  for each row execute function plt_privado.fn_setor_qualidade_mudou();

-- ----------------------------------------------------------------------------
-- 8 · As consequências da qualidade (recriada POR INTEIRO a partir da 37)
--     Novo: a confirmação sem marcação (a peça chegou sem ninguém marcar) e a
--     marcação 🔴 que ninguém vai confirmar → DANIFICADO na chegada.
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
  v_destino_codigo text;
  v_destino_papel  text;
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
  select s.nome, s.codigo, s.papel_no_fluxo into v_setor_destino, v_destino_codigo, v_destino_papel
    from public.plt_setores s where s.id = new.setor_destino_id;
  select u.nome into v_autor from public.plt_usuarios u where u.id = new.usuario_id;

  -- ---------- Chegada ----------
  if new.tipo = 'movimentacao_setor' then
    -- SESSAO-31 (D-126): marcada 🔴 por quem entregou e sem confirmação na
    -- chegada (o setor não pede) — a peça vai direto para o DANIFICADO do
    -- setor que recebe (D-09 item 4). O aviso já saiu na marcação.
    if new.evento_referencia_id is not null
       and v_destino_papel = 'producao'
       and v_card.parecer_pendente_id is null
       and v_card.setor_atual_id = new.setor_destino_id then
      select * into v_marc from public.plt_eventos where id = new.evento_referencia_id;
      if v_marc.tipo = 'qualidade_marcada' and v_marc.estado_qualidade = 'danificado' then
        v_etapa_danificado := plt_privado.fn_garantir_etapa_danificado(new.setor_destino_id);
        if v_card.etapa_atual_id is distinct from v_etapa_danificado then
          insert into public.plt_eventos
              (card_id, tipo, usuario_id, origem,
               setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
               observacao)
            values
              (new.card_id, 'movimentacao_etapa', new.usuario_id, 'automacao',
               v_card.setor_atual_id, v_card.etapa_atual_id,
               v_card.setor_atual_id, v_etapa_danificado,
               'Consequência automática: a peça foi entregue danificada.');
        end if;
      end if;
      return null;
    end if;

    -- Chegada ao fim de linha avisa os admins (D-25; S24)
    if v_destino_codigo = 'estoque' then
      v_tipo_aviso := 'chegada_estoque';
      if new.dados ->> 'motivo' = 'pedido_cancelado' then
        -- SESSAO-24: a peça pronta do pedido cancelado voltou ao ESTOQUE.
        v_titulo := 'Pedido ' || coalesce(new.dados ->> 'numero', '') || ' cancelado: peça voltou ao ESTOQUE';
        v_corpo  := v_peca || ' estava pronta em Pedidos em aguardo e voltou ao ESTOQUE, sem dono — o pedido '
                    || coalesce(new.dados ->> 'numero', '') || ' foi cancelado no Tiny.';
      else
        v_titulo := 'Peça chegou ao ESTOQUE';
        v_corpo  := v_peca || ' chegou ao ESTOQUE'
                    || coalesce(' vinda de ' || v_setor_origem, '')
                    || coalesce(' por ' || v_autor, '')
                    || case when v_card.qualidade_atual is not null
                            then ', marcada como ' || plt_privado.fn_rotulo_estado(v_card.qualidade_atual)
                            else '' end
                    || '.'
                    || case when v_card.pedido_id is not null
                                 and plt_privado.fn_pedido_cancelado(v_card.pedido_id)
                            then ' O pedido foi cancelado no Tiny: a peça fica no estoque, sem dono.'
                            else '' end;
      end if;
    elsif v_destino_codigo = 'aguardo' then
      -- SESSAO-24: a peça pronta de pedido mora em Pedidos em aguardo. Só a
      -- peça que ACABOU de ficar pronta avisa — chegar de outro fim de linha
      -- (manutenção, ajuste) não é produção nova.
      if exists (select 1 from public.plt_setores so
                  where so.id = new.setor_origem_id and so.papel_no_fluxo = 'terminal') then
        return null;
      end if;
      v_tipo_aviso := 'chegada_aguardo';
      v_titulo := 'Peça pronta em Pedidos em aguardo';
      v_corpo  := v_peca || ' ficou pronta e entrou em Pedidos em aguardo'
                  || coalesce(' vinda de ' || v_setor_origem, '')
                  || coalesce(' por ' || v_autor, '')
                  || '.';
    else
      return null;
    end if;
    select coalesce(array_agg(distinct u.id), '{}') into v_destinatarios
      from public.plt_usuarios u
     where u.ativo and u.papel = 'admin'
       and u.id is distinct from new.usuario_id;

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

  -- ---------- Confirmação: divergência ou 🔴 (Q-18 / RF-83) ----------
  else
    select * into v_marc from public.plt_eventos where id = new.evento_referencia_id;

    -- 🔴 registrado pelo recebedor (confirmado, divergente ou sem marcação):
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
             'Consequência automática do parecer 🔴 danificado.');
      end if;
    end if;

    if v_marc.tipo is distinct from 'qualidade_marcada' then
      -- SESSAO-31 (D-126): ninguém marcou na saída — o estado é o de quem
      -- recebeu. 🟡/🔴 avisam como uma marcação avisaria.
      if new.estado_qualidade not in ('atencao', 'danificado') then
        return null;
      end if;
      v_tipo_aviso := 'qualidade_' || new.estado_qualidade;
      v_titulo := 'Peça recebida como ' || plt_privado.fn_rotulo_estado(new.estado_qualidade);
      v_corpo  := coalesce(v_autor, 'Quem recebeu') || coalesce(' (' || v_setor_destino || ')', '')
                  || ' registrou ' || plt_privado.fn_rotulo_estado(new.estado_qualidade)
                  || ' ao receber a peça' || coalesce(' vinda de ' || v_setor_origem, '')
                  || '. ' || v_peca || '.'
                  || case when new.estado_qualidade = 'danificado'
                          then ' O card foi para a etapa DANIFICADO.' else '' end;
    else
      v_divergente := v_marc.estado_qualidade is distinct from new.estado_qualidade;
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

  -- O FATO de o aviso ter saído também é história do card.
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
  'Consequências automáticas da qualidade (M-01/D-25/D-126): 🔴 (confirmado, ou marcado sem confirmação na chegada) leva o card à etapa DANIFICADO; 🟡/🔴/divergência notificam líderes dos dois setores + admins; chegada ao ESTOQUE e a Pedidos em aguardo avisa os admins.';

-- ----------------------------------------------------------------------------
-- 9 · A confirmação pendente vira tarefa do Sistema (recriada da 33) — agora
--     a partir da projeção: só quando o setor pede o estado ao receber.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tarefa_sistema_qualidade()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ref     public.plt_eventos%rowtype;
  v_card    public.plt_cards%rowtype;
  v_pedido  integer;
  v_peca    text;
  v_setor_origem text;
  v_titulo  text;
  v_descricao text;
  v_aviso   text;
  v_membro  uuid;
begin
  if new.tipo = 'qualidade_parecer' then
    -- A confirmação responde a chegada → a tarefa do sistema dela conclui sozinha.
    perform set_config('plt.tarefa_sistema', '1', true);
    update public.plt_tarefas
       set situacao = 'concluida', concluida_em = new.ocorrido_em
     where origem = 'sistema'
       and evento_referencia_id = new.evento_referencia_id
       and situacao <> 'concluida';
    perform set_config('plt.tarefa_sistema', '', true);
    return null;
  end if;

  if new.tipo = 'card_arquivado' then
    -- Card arquivado: a pendência de parecer dele deixou de existir.
    perform set_config('plt.tarefa_sistema', '1', true);
    update public.plt_tarefas
       set situacao = 'concluida', concluida_em = new.ocorrido_em
     where origem = 'sistema'
       and card_id = new.card_id
       and situacao <> 'concluida';
    perform set_config('plt.tarefa_sistema', '', true);
    return null;
  end if;

  if new.tipo <> 'movimentacao_setor' then
    return null;
  end if;

  -- A projeção já rodou ("projetar_parecer" vem antes de "tarefa_sistema").
  select * into v_card from public.plt_cards where id = new.card_id;

  -- Card seguiu adiante: confirmação de chegada antiga ficou impossível (o
  -- banco a recusaria) — a tarefa daquela pendência fecha.
  perform set_config('plt.tarefa_sistema', '1', true);
  update public.plt_tarefas
     set situacao = 'concluida', concluida_em = new.ocorrido_em
   where origem = 'sistema'
     and card_id = new.card_id
     and situacao <> 'concluida'
     and evento_referencia_id is distinct from v_card.parecer_pendente_id;
  perform set_config('plt.tarefa_sistema', '', true);

  if v_card.parecer_pendente_id is null then
    return null;
  end if;

  select * into v_ref from public.plt_eventos where id = v_card.parecer_pendente_id;
  select p.numero into v_pedido from public.pedidos p where p.id = v_card.pedido_id;
  v_peca := coalesce(v_card.item_descricao, 'Peça')
            || case when v_card.indice_unidade is not null
                    then format(' (%s/%s)', v_card.indice_unidade, v_card.total_unidades)
                    else '' end
            || coalesce(' · Pedido ' || v_pedido, '');
  select s.nome into v_setor_origem from public.plt_setores s where s.id = new.setor_origem_id;

  v_titulo := 'Confirmar recebimento: ' || v_peca;
  if v_ref.tipo = 'qualidade_marcada' then
    v_descricao := coalesce(v_setor_origem, 'O setor anterior') || ' entregou como '
                   || plt_privado.fn_rotulo_estado(v_ref.estado_qualidade)
                   || '. Registre o parecer do recebimento na fila do setor.';
    v_aviso := v_peca || ' chegou marcada como '
               || plt_privado.fn_rotulo_estado(v_ref.estado_qualidade)
               || coalesce(' por ' || v_setor_origem, '')
               || '. A tarefa está nos seus Delegados a mim.';
  else
    v_descricao := 'Chegou de ' || coalesce(v_setor_origem, 'outro setor')
                   || '. Diga em que estado a peça chegou, na fila do setor.';
    v_aviso := v_peca || ' chegou' || coalesce(' de ' || v_setor_origem, '')
               || ' — confirme o estado em que ela chegou. A tarefa está nos seus Delegados a mim.';
  end if;

  perform set_config('plt.tarefa_sistema', '1', true);
  insert into public.plt_tarefas
      (titulo, descricao, card_id, setor_id, responsavel_id, criada_por_id,
       delegacao, situacao, origem, evento_referencia_id, privada)
    values
      (v_titulo, v_descricao, new.card_id, new.setor_destino_id, null, null,
       'direta', 'aberta', 'sistema', v_ref.id, false)
  on conflict (evento_referencia_id) where origem = 'sistema' do nothing;
  perform set_config('plt.tarefa_sistema', '', true);

  -- O sino avisa quem vai confirmar: os membros ativos do setor recebedor
  -- (fora quem moveu — esse já sabe).
  for v_membro in
    select us.usuario_id
      from public.plt_usuario_setores us
      join public.plt_usuarios u on u.id = us.usuario_id and u.ativo
     where us.setor_id = new.setor_destino_id
       and us.usuario_id is distinct from new.usuario_id
  loop
    insert into public.plt_notificacoes (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
         values (v_membro, new.id, new.card_id, 'tarefa_sistema',
                 'Recebimento para confirmar', v_aviso);
  end loop;

  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 10 · Registrar a confirmação (recriada da 16): responde à chegada pendente
--      do card — a marcação de quem entregou ou a própria chegada.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_registrar_parecer(
  p_marcacao_id      bigint,
  p_estado_qualidade text,
  p_observacao       text default null,
  p_operador_id      uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao  uuid;
  v_usuario uuid;
  v_ref     public.plt_eventos%rowtype;
  v_card    public.plt_cards%rowtype;
  v_evento_id bigint;
begin
  v_sessao := plt_privado.fn_usuario_atual();
  if v_sessao is null then
    raise exception 'Só usuário ativo da plataforma registra parecer.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_ref from public.plt_eventos where id = p_marcacao_id;
  if not found or v_ref.tipo not in ('qualidade_marcada', 'movimentacao_setor') then
    raise exception 'A chegada % não existe.', p_marcacao_id using errcode = 'no_data_found';
  end if;
  select * into v_card from public.plt_cards where id = v_ref.card_id;

  if not (
    plt_privado.fn_eh_admin()
    or v_card.setor_atual_id in (select plt_privado.fn_setores_do_usuario())
  ) then
    -- D-09: o parecer é do setor recebedor.
    raise exception 'O parecer é do setor que recebe a peça — você não trabalha nele.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Gesto por PIN (SESSAO-07): autor = operador identificado, do setor recebedor.
  if p_operador_id is not null and p_operador_id <> v_sessao then
    if not exists (select 1 from public.plt_usuarios u where u.id = p_operador_id and u.ativo) then
      raise exception 'Operador não encontrado ou inativo — confira a identificação.'
        using errcode = 'check_violation';
    end if;
    if not (
      exists (select 1 from public.plt_usuarios u
               where u.id = p_operador_id and u.papel = 'admin')
      or exists (select 1 from public.plt_usuario_setores us
                  where us.usuario_id = p_operador_id
                    and us.setor_id = v_card.setor_atual_id)
    ) then
      raise exception 'O operador identificado não trabalha no setor que recebe a peça.'
        using errcode = 'insufficient_privilege';
    end if;
    v_usuario := p_operador_id;
  else
    v_usuario := v_sessao;
  end if;

  insert into public.plt_eventos
      (card_id, tipo, usuario_id, origem, evento_referencia_id,
       estado_qualidade, observacao)
    values
      (v_ref.card_id, 'qualidade_parecer', v_usuario, 'interface', p_marcacao_id,
       p_estado_qualidade, nullif(btrim(p_observacao), ''))
    returning id into v_evento_id;

  return v_evento_id;
end;
$$;

comment on function public.plt_fn_registrar_parecer(bigint, text, text, uuid) is
  'Registra a confirmação de recebimento (D-09/D-126): responde à chegada pendente do card (a marcação de quem entregou, ou a própria chegada quando ninguém marcou). p_operador_id = autor por PIN no tablet. Gate: gente do setor onde o card está ou admin; validações de verdade no trigger.';

-- ----------------------------------------------------------------------------
-- 11 · Soltar o card (recriada da 37): a etapa que CONCLUI (D-127)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_soltar_card(
  p_card_id          bigint,
  p_etapa_destino_id bigint default null,
  p_estado_qualidade text   default null,
  p_observacao       text   default null,
  p_operador_id      uuid   default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card     public.plt_cards%rowtype;
  v_etapa    public.plt_etapas%rowtype;
  v_producao boolean;
  v_eh_fila  boolean;
  v_usuario  uuid;
  v_evento   bigint;
  v_destino  text;
begin
  if plt_privado.fn_usuario_atual() is null then
    raise exception 'Só usuário ativo da plataforma move cards.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards where id = p_card_id;
  if not found or v_card.arquivado_em is not null then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;

  -- "Sem etapa" (a coluna Chegada do PCP e dos terminais): só mover.
  if p_etapa_destino_id is null then
    v_evento := public.plt_fn_mover_card(p_card_id, v_card.setor_atual_id, null,
                                         null, p_observacao, p_operador_id);
    return jsonb_build_object('acao', 'movido', 'evento_id', v_evento);
  end if;

  select * into v_etapa from public.plt_etapas where id = p_etapa_destino_id and ativa;
  if not found or v_etapa.setor_id is distinct from v_card.setor_atual_id then
    raise exception 'Solte o card numa etapa do próprio quadro.' using errcode = 'check_violation';
  end if;
  if v_etapa.id is not distinct from v_card.etapa_atual_id then
    raise exception 'O card já está aí.' using errcode = 'check_violation';
  end if;

  -- 1) Etapa que encaminha: o card vai para o setor dela.
  if v_etapa.setor_destino_id is not null then
    v_evento := public.plt_fn_mover_card(p_card_id, v_etapa.setor_destino_id, null,
                                         p_estado_qualidade, p_observacao, p_operador_id);
    return jsonb_build_object('acao', 'encaminhado',
                              'setor_destino_id', v_etapa.setor_destino_id,
                              'evento_id', v_evento);
  end if;

  -- 1b) Etapa que CONCLUI a produção (D-127 — a EXPEDIÇÃO da LIMPEZA E
  --     EMBALAGEM): a peça vai para Pedidos em aguardo ou para o ESTOQUE.
  --     Card que não é peça (o avulso) só se move — ele termina pelo Concluir.
  if v_etapa.conclui_producao and v_card.tipo = 'unidade' then
    v_destino := public.plt_fn_concluir_producao(p_card_id, p_estado_qualidade,
                                                 p_observacao, p_operador_id);
    return jsonb_build_object('acao', 'concluido', 'destino', v_destino);
  end if;

  -- 2) Etapa de início de setor de produção: soltar aqui inicia o tempo.
  select s.papel_no_fluxo = 'producao' into v_producao
    from public.plt_setores s where s.id = v_card.setor_atual_id;
  if coalesce(v_producao, false) and v_card.tipo = 'unidade'
     and v_etapa.id = plt_privado.fn_etapa_inicio(v_card.setor_atual_id) then
    v_usuario := plt_privado.fn_autor_do_gesto(v_card.setor_atual_id, p_operador_id);

    select e.eh_fila into v_eh_fila from public.plt_etapas e where e.id = v_card.etapa_atual_id;
    if not coalesce(v_eh_fila, false) then
      -- Vindo de outra etapa (PARADO, CONCLUÍDO…): move antes, inicia depois —
      -- mesma transação, mesmo instante; a ordem de leitura é o id.
      insert into public.plt_eventos
          (card_id, tipo, usuario_id, origem,
           setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id)
        values
          (p_card_id, 'movimentacao_etapa', v_usuario, 'interface',
           v_card.setor_atual_id, v_card.etapa_atual_id, v_card.setor_atual_id, v_etapa.id);
    end if;
    -- Na fila, o iniciar leva sozinho à etapa de início (migration 30).
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem)
      values (p_card_id, 'execucao_iniciada', v_usuario, 'interface')
      returning id into v_evento;
    return jsonb_build_object('acao', 'iniciado', 'evento_id', v_evento);
  end if;

  -- 3) Qualquer outra etapa: só mover.
  v_evento := public.plt_fn_mover_card(p_card_id, v_card.setor_atual_id, v_etapa.id,
                                       null, p_observacao, p_operador_id);
  return jsonb_build_object('acao', 'movido', 'evento_id', v_evento);
end;
$$;

comment on function public.plt_fn_soltar_card(bigint, bigint, text, text, uuid) is
  'SESSAO-24/31 — o quadro por arrasto: soltar na etapa que encaminha leva o card ao setor dela (com a marcação quando o setor pede — D-126); soltar na etapa que conclui (D-127) conclui a produção da peça; soltar na etapa de início inicia o tempo de quem arrastou (mover + iniciar numa transação); o resto é mover. p_operador_id = operador do PIN no tablet. Endpoint de propósito — gate interno.';

-- ----------------------------------------------------------------------------
-- 12 · Concluir produção (recriada da 37): o estado só vai quando vem — a
--      chave do setor decide se é obrigatório (D-126). O padrão 'perfeito'
--      fica para quem chamava sem dizer (API, ensaios) — nada muda para eles.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_concluir_producao(
  p_card_id          bigint,
  p_estado_qualidade text default 'perfeito',
  p_observacao       text default null,
  p_operador_id      uuid default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card       public.plt_cards%rowtype;
  v_papel      text;
  v_destino    text;
  v_destino_id bigint;
begin
  if plt_privado.fn_usuario_atual() is null then
    raise exception 'Só usuário ativo da plataforma conclui peças.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards
   where id = p_card_id and tipo = 'unidade' and arquivado_em is null;
  if not found then
    raise exception 'Unidade % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  select s.papel_no_fluxo into v_papel from public.plt_setores s where s.id = v_card.setor_atual_id;
  if coalesce(v_papel, '') <> 'producao' then
    raise exception 'Só peça em produção se conclui — esta já não está num setor de produção.'
      using errcode = 'check_violation';
  end if;

  -- Pedido vivo → Pedidos em aguardo; sem pedido (reposição) ou pedido
  -- cancelado → ESTOQUE, sem dono (a desvinculação acontece na chegada).
  v_destino := case
                 when v_card.pedido_id is null
                      or plt_privado.fn_pedido_cancelado(v_card.pedido_id) then 'estoque'
                 else 'aguardo'
               end;
  select s.id into v_destino_id from public.plt_setores s where s.codigo = v_destino and s.ativo;
  if v_destino_id is null then
    raise exception 'O fim de linha "%" não está cadastrado — fale com o admin.', v_destino
      using errcode = 'no_data_found';
  end if;

  perform public.plt_fn_mover_card(p_card_id, v_destino_id, null,
                                   p_estado_qualidade, p_observacao, p_operador_id);
  return v_destino;
end;
$$;

comment on function public.plt_fn_concluir_producao(bigint, text, text, uuid) is
  'SESSAO-24/31: conclui a peça — pedido vivo vai para Pedidos em aguardo; peça sem pedido ou de pedido cancelado vai para o ESTOQUE, sem dono. O estado vai quando vem (o setor pode exigir — D-126). Reaproveita plt_fn_mover_card. Devolve o destino (aguardo | estoque). O arrasto chega aqui pela etapa que conclui (D-127).';

-- ----------------------------------------------------------------------------
-- 13 · A porta das chaves (admin — D-126): valida, grava e deixa rastro
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_setor_qualidade_definir(
  p_setor_id    bigint,
  p_envio       text[],
  p_recebimento text[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_setor   public.plt_setores%rowtype;
  v_envio   text[];
  v_receb   text[];
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_eh_admin() then
    raise exception 'Ligar e desligar o estado da peça é gesto de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_setor from public.plt_setores where id = p_setor_id;
  if not found then
    raise exception 'Setor % não existe.', p_setor_id using errcode = 'no_data_found';
  end if;
  if v_setor.papel_no_fluxo <> 'producao' then
    raise exception 'O estado da peça só se pede nos setores de produção.'
      using errcode = 'check_violation';
  end if;

  -- Sem repetidos, em ordem fixa (o check recusa tipo desconhecido).
  select coalesce(array_agg(t order by t), '{}') into v_envio
    from (select distinct unnest(coalesce(p_envio, '{}'::text[])) as t) x;
  select coalesce(array_agg(t order by t), '{}') into v_receb
    from (select distinct unnest(coalesce(p_recebimento, '{}'::text[])) as t) x;
  if not (v_envio <@ array['peca_pedido', 'peca_estoque', 'avulso']::text[]
          and v_receb <@ array['peca_pedido', 'peca_estoque', 'avulso']::text[]) then
    raise exception 'Tipo de card desconhecido — use peça de pedido, peça de estoque ou avulso.'
      using errcode = 'check_violation';
  end if;

  update public.plt_setores
     set qualidade_envio_tipos = v_envio,
         qualidade_recebimento_tipos = v_receb
   where id = p_setor_id;

  -- D-40: toda atividade gera log.
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_usuario, 'qualidade_setor_alterada',
            jsonb_build_object('setor_id', p_setor_id, 'setor', v_setor.nome,
                               'envio_antes', v_setor.qualidade_envio_tipos, 'envio', v_envio,
                               'recebimento_antes', v_setor.qualidade_recebimento_tipos,
                               'recebimento', v_receb));
end;
$$;

comment on function public.plt_fn_setor_qualidade_definir(bigint, text[], text[]) is
  'SESSAO-31 (D-126): as duas chaves do estado da peça de um setor de produção — ao enviar e ao receber, cada uma com os tipos de card (peca_pedido, peca_estoque, avulso; vazio = desligado). Só admin. Deixa a linha qualidade_setor_alterada na trilha (antes → depois).';

-- ----------------------------------------------------------------------------
-- 14 · Permissões: maquinaria fora da API (E-11); a porta para authenticated
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_tipo_qualidade(text, bigint)              from public, anon, authenticated;
revoke all on function plt_privado.fn_pede_estado(bigint, text, text, bigint)   from public, anon, authenticated;
revoke all on function plt_privado.fn_validar_etapa_conclui()                   from public, anon, authenticated;
revoke all on function plt_privado.fn_projetar_parecer()                        from public, anon, authenticated;
revoke all on function plt_privado.fn_setor_qualidade_mudou()                   from public, anon, authenticated;
revoke all on function plt_privado.fn_tarefa_sistema_qualidade()                from public, anon, authenticated;

revoke all on function public.plt_fn_setor_qualidade_definir(bigint, text[], text[]) from public, anon;
grant execute on function public.plt_fn_setor_qualidade_definir(bigint, text[], text[]) to authenticated;
revoke all on function public.plt_fn_mover_card(bigint, bigint, bigint, text, text, uuid) from public, anon;
grant execute on function public.plt_fn_mover_card(bigint, bigint, bigint, text, text, uuid) to authenticated;
revoke all on function public.plt_fn_registrar_parecer(bigint, text, text, uuid) from public, anon;
grant execute on function public.plt_fn_registrar_parecer(bigint, text, text, uuid) to authenticated;
revoke all on function public.plt_fn_soltar_card(bigint, bigint, text, text, uuid) from public, anon;
grant execute on function public.plt_fn_soltar_card(bigint, bigint, text, text, uuid) to authenticated;
revoke all on function public.plt_fn_concluir_producao(bigint, text, text, uuid) from public, anon;
grant execute on function public.plt_fn_concluir_producao(bigint, text, text, uuid) to authenticated;
