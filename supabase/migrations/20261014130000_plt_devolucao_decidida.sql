-- ============================================================================
-- Migration 67 · SESSAO-31 (etapa B) — a DEVOLUÇÃO decidida pela logística,
-- o AJUSTE de peça com destino final e o fim do marcador "Devolvido"
--
-- Pedidos do dono (13–14/10/2026):
--   D-124 — o marcador "Devolvido" do Tiny NÃO é cancelamento ("o devolvido a
--           fábrica ainda tenta recuperar a venda").
--   D-129 — "remova o botão pedido devolvido … o entregador não pode ter esse
--           controle nas mãos"; "no estoque apareça mais uma linha caso o
--           produto seja devolvido e esse produto fica aguardando decisão da
--           logística"; "siga essa do botão para a logística, a própria recebe
--           uma notificação e aparece uma telinha de 'Decidir situação' …
--           devolver ao estoque, reenviar produto, realocar peça para outro
--           pedido"; "se chegou danificada, vai para danificados, devolução de
--           peça já entregue pode ocorrer também".
--   D-130 — o ajuste de peça: "a peça tenha ido mal acabada para o cliente e o
--           cliente devolva para a fábrica ajustar ela … o PCP pode definir (vai
--           para o estoque, vai para rotas, terceirizado, entre outros)".
--
-- Como fica:
--   · nasce o fim de linha interno "EM DECISÃO PÓS DEVOLUÇÃO" (código
--     'devolucao' — como o 'aguardo' da S24: não aparece no menu);
--   · "Pedido devolvido" (plt_fn_pedido_devolver) é gesto da LOGÍSTICA/admin —
--     nunca do entregador —, com motivo; vale para o pedido na ROTAS e para o
--     JÁ ENTREGUE (as peças voltam). As peças continuam do pedido, saem da ROTAS
--     e da programação e esperam a decisão; a logística recebe o aviso;
--   · a decisão (plt_fn_devolucao_decidir), peça por peça ou todas: reenviar ·
--     estoque · realocar para outro pedido · danificados · loja · ajuste;
--   · o ajuste (plt_fn_ajuste_abrir) leva a MESMA peça de volta à produção com
--     o destino final; ao concluir (a EXPEDIÇÃO — D-127) ela vai para ele;
--   · a reentrega ao cliente (pedido já entregue) reabre a entrega SÓ na
--     plataforma (o Tiny não muda) e leva só o que voltou
--     (fn_unidades_a_entregar);
--   · a linha "em decisão pós devolução" nos números do estoque (projeção) e a
--     situação "devolvido" no PCP.
--
-- E-24: as funções recriadas partem da versão viva mais nova de cada uma
-- (59, 60, 37, 39, 57, 64 e 66 — o gerador as copia e confere cada troca).
-- E-19: o check de tipos de evento das migrations 51, 59 e 60 deixou de
-- validar — quem valida é esta (a mais nova).
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · O lugar da peça devolvida (D-129) — fim de linha interno
-- ----------------------------------------------------------------------------
insert into public.plt_setores (codigo, nome, papel_no_fluxo, ordem)
values ('devolucao', 'EM DECISÃO PÓS DEVOLUÇÃO', 'terminal', 86)
on conflict (codigo) do nothing;

-- ----------------------------------------------------------------------------
-- 2 · Os fatos novos (lista inteira — a da migration 60 + os da SESSAO-31)
-- ----------------------------------------------------------------------------
do $$
declare
  v_nome text;
begin
  select conname into v_nome
    from pg_constraint
   where conrelid = 'public.plt_eventos'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%card_criado%';
  if v_nome is not null then
    execute format('alter table public.plt_eventos drop constraint %I', v_nome);
  end if;
  alter table public.plt_eventos add constraint plt_eventos_tipo_check
    check (tipo in (
      'card_criado', 'movimentacao_setor', 'movimentacao_etapa',
      'execucao_iniciada', 'execucao_finalizada', 'execucao_pausada', 'execucao_retomada',
      'qualidade_marcada', 'qualidade_parecer', 'divergencia_registrada', 'notificacao_enviada',
      'delegacao', 'estorno', 'pedido_atualizado', 'pedido_cancelado', 'card_arquivado',
      'pedido_entregue', 'pedido_lancado_rotas', 'unidade_desvinculada', 'peca_alocada',
      'peca_reservada', 'peca_reserva_desfeita', 'estoque_reserva_avaliada',
      'etiqueta_adicionada', 'etiqueta_removida', 'card_desarquivado',
      'entrega_desfeita', 'entrega_nao_realizada',
      'pedido_devolvido',          -- ↩️ SESSAO-31 (D-129): a LOGÍSTICA marcou a devolução (não é cancelamento)
      'comentario_adicionado', 'anexo_adicionado',
      'devolucao_decidida',        -- SESSAO-31 (D-129): a decisão da logística sobre a peça devolvida
      'ajuste_aberto',             -- SESSAO-31 (D-130): a peça voltou à produção para ajuste, com destino final
      'ajuste_concluido',          -- SESSAO-31 (D-130): o ajuste terminou no destino final
      'avulso_concluido',          -- SESSAO-31 (D-125): o card avulso foi concluído
      'card_editado',              -- SESSAO-31 (D-125): título, descrição, datas, vínculo, campos — antes → depois
      'responsavel_adicionado',    -- SESSAO-31 (D-125): responsável do card
      'responsavel_removido',
      'anexo_removido',            -- SESSAO-31 (D-125): o anexo sai da tela; o arquivo fica guardado
      'comentario_editado',        -- SESSAO-31 (D-131): a mensagem do card editada (a versão anterior fica)
      'comentario_apagado'         -- SESSAO-31 (D-131): a mensagem do card apagada (o admin ainda vê)
    )) not valid;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3 · Os motivos ganham "devolução" e "pausa" (D-129/D-125 — Utilitários)
-- ----------------------------------------------------------------------------
alter table public.plt_motivos drop constraint if exists plt_motivos_tipo_ck;
alter table public.plt_motivos add constraint plt_motivos_tipo_ck
  check (tipo in ('nao_entregue', 'desfazer_entrega', 'devolucao', 'pausa'));

insert into public.plt_motivos (tipo, texto, ordem)
select x.tipo, x.texto, x.ordem
  from (values
    ('devolucao', 'Cliente desistiu da compra', 10),
    ('devolucao', 'Produto com defeito', 20),
    ('devolucao', 'Produto mal acabado', 30),
    ('devolucao', 'Produto diferente do pedido', 40),
    ('devolucao', 'Não coube no espaço', 50),
    ('devolucao', 'Avaria no transporte', 60),
    ('devolucao', 'Cliente recusou na entrega', 70),
    ('pausa', 'Falta de material', 10),
    ('pausa', 'Máquina parada', 20),
    ('pausa', 'Esperando peça de outro setor', 30),
    ('pausa', 'Urgência de outro pedido', 40),
    ('pausa', 'Fim do expediente', 50),
    ('pausa', 'Conferir com o líder', 60)
  ) as x(tipo, texto, ordem)
 where not exists (select 1 from public.plt_motivos m
                    where m.tipo = x.tipo and lower(btrim(m.texto)) = lower(btrim(x.texto)));

create or replace function public.plt_fn_motivo_salvar(
  p_id    bigint,
  p_tipo  text,
  p_texto text,
  p_ordem integer default null,
  p_ativo boolean default true
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'Cadastrar motivo é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;
  -- SESSAO-31: + devolução (D-129) e pausa (D-125).
  if p_tipo not in ('nao_entregue', 'desfazer_entrega', 'devolucao', 'pausa') then
    raise exception 'Tipo de motivo desconhecido.' using errcode = 'check_violation';
  end if;
  if char_length(btrim(coalesce(p_texto, ''))) not between 2 and 80 then
    raise exception 'O motivo precisa ter de 2 a 80 letras — uma frase curta.' using errcode = 'check_violation';
  end if;
  if p_id is null then
    insert into public.plt_motivos (tipo, texto, ordem, ativo)
      values (p_tipo, btrim(p_texto), coalesce(p_ordem, 100), coalesce(p_ativo, true))
      returning id into v_id;
  else
    update public.plt_motivos
       set texto = btrim(p_texto), ordem = coalesce(p_ordem, ordem), ativo = coalesce(p_ativo, ativo),
           atualizado_em = now()
     where id = p_id and tipo = p_tipo
     returning id into v_id;
    if v_id is null then
      raise exception 'Motivo não encontrado.' using errcode = 'no_data_found';
    end if;
  end if;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), 'motivo_salvo',
            jsonb_build_object('motivo_id', v_id, 'tipo', p_tipo, 'texto', btrim(p_texto), 'ativo', coalesce(p_ativo, true)));
  return v_id;
exception when unique_violation then
  raise exception 'Já existe esse motivo.' using errcode = 'unique_violation';
end;
$$;

-- ----------------------------------------------------------------------------
-- 4 · As projeções no card (M-13 — escritas só pelo gatilho do item 5)
-- ----------------------------------------------------------------------------
alter table public.plt_cards add column if not exists devolucao_evento_id bigint;
alter table public.plt_cards add column if not exists ajuste_evento_id bigint;
alter table public.plt_cards add column if not exists ajuste_destino text;

alter table public.plt_cards drop constraint if exists plt_cards_ajuste_destino_ck;
alter table public.plt_cards add constraint plt_cards_ajuste_destino_ck check (
  ajuste_destino is null or ajuste_destino in ('estoque', 'pedido', 'terceirizado', 'loja', 'danificados')
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plt_cards_devolucao_evento_fk') then
    alter table public.plt_cards add constraint plt_cards_devolucao_evento_fk
      foreign key (devolucao_evento_id) references public.plt_eventos (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plt_cards_ajuste_evento_fk') then
    alter table public.plt_cards add constraint plt_cards_ajuste_evento_fk
      foreign key (ajuste_evento_id) references public.plt_eventos (id);
  end if;
end;
$$;

-- Lei 7.1/7.2: chave estrangeira com índice — parciais (quase sempre nulas).
create index if not exists plt_cards_devolucao_evento_idx
  on public.plt_cards (devolucao_evento_id) where devolucao_evento_id is not null;
create index if not exists plt_cards_ajuste_evento_idx
  on public.plt_cards (ajuste_evento_id) where ajuste_evento_id is not null;

comment on column public.plt_cards.devolucao_evento_id is
  'SESSAO-31 (D-129): no card do PEDIDO, a devolução em decisão (o pedido_devolvido que vale). Liga no "Pedido devolvido" da logística; desliga quando a última peça sai de "Em decisão pós devolução". Projeção — não escreva à mão.';
comment on column public.plt_cards.ajuste_destino is
  'SESSAO-31 (D-130): na PEÇA em ajuste, para onde ela vai ao concluir — estoque · pedido (volta ao pedido / reentrega) · terceirizado · loja · danificados. Projeção do ajuste_aberto.';

-- ----------------------------------------------------------------------------
-- 5 · A projeção e as travas (a peça entra e sai do lugar só pelos gestos)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_projetar_devolucao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card_pedido bigint;
begin
  if new.tipo = 'pedido_devolvido' then
    -- O pedido sai da ROTAS (as peças voltaram) e fica em decisão.
    update public.plt_cards
       set devolucao_evento_id = new.id, lancado_rotas_em = null
     where id = new.card_id and tipo = 'pedido';
  elsif new.tipo = 'devolucao_decidida' then
    -- A última peça decidida encerra a devolução do pedido (a que foi para os
    -- Danificados já saiu da decisão — segue por lá).
    v_card_pedido := nullif(new.dados ->> 'card_pedido_id', '')::bigint;
    if v_card_pedido is not null and not exists (
      select 1
        from public.plt_cards u
        join public.plt_cards pc on pc.id = v_card_pedido
        join public.plt_setores s on s.id = u.setor_atual_id and s.codigo = 'devolucao'
        left join public.plt_etapas e on e.id = u.etapa_atual_id
       where u.pedido_id = pc.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null
         and not coalesce(e.eh_danificado, false)
    ) then
      update public.plt_cards
         set devolucao_evento_id = null
       where id = v_card_pedido and devolucao_evento_id is not null;
    end if;
  elsif new.tipo = 'ajuste_aberto' then
    update public.plt_cards
       set ajuste_evento_id = new.id, ajuste_destino = new.dados ->> 'destino_final'
     where id = new.card_id;
  elsif new.tipo in ('ajuste_concluido', 'card_arquivado') then
    update public.plt_cards
       set ajuste_evento_id = null, ajuste_destino = null
     where id = new.card_id and ajuste_evento_id is not null;
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_projetar_devolucao on public.plt_eventos;
create trigger plt_eventos_projetar_devolucao
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('pedido_devolvido', 'devolucao_decidida', 'ajuste_aberto', 'ajuste_concluido', 'card_arquivado'))
  execute function plt_privado.fn_projetar_devolucao();

-- As travas (BEFORE — valem para todo escritor, M-14): a peça entra e sai de
-- "Em decisão pós devolução" só pelos gestos da logística (a marca
-- plt.devolucao_maquinaria); da etapa DANIFICADO de lá ela segue pelos
-- Danificados, como qualquer peça danificada.
create or replace function plt_privado.fn_validar_devolucao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_maquinaria boolean := coalesce(current_setting('plt.devolucao_maquinaria', true), '') = 'on';
begin
  if v_maquinaria then
    return new;
  end if;
  if new.tipo in ('pedido_devolvido', 'devolucao_decidida', 'ajuste_aberto', 'ajuste_concluido') then
    raise exception 'Este registro nasce só pelos gestos da devolução e do ajuste (logística/PCP).'
      using errcode = 'insufficient_privilege';
  end if;
  if new.tipo = 'movimentacao_setor' then
    if exists (select 1 from public.plt_setores s where s.id = new.setor_destino_id and s.codigo = 'devolucao') then
      raise exception 'A peça entra em "Em decisão pós devolução" só pelo "Pedido devolvido" da logística.'
        using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.plt_setores s where s.id = new.setor_origem_id and s.codigo = 'devolucao')
       and not exists (select 1 from public.plt_etapas e where e.id = new.etapa_origem_id and e.eh_danificado) then
      raise exception 'A peça devolvida sai pela decisão da logística (Estoque → Em decisão pós devolução → Decidir situação).'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists plt_eventos_validar_devolucao on public.plt_eventos;
create trigger plt_eventos_validar_devolucao
  before insert on public.plt_eventos
  for each row
  when (new.tipo in ('pedido_devolvido', 'devolucao_decidida', 'ajuste_aberto', 'ajuste_concluido', 'movimentacao_setor'))
  execute function plt_privado.fn_validar_devolucao();

-- O pedido devolvido não é cancelado (D-124/D-129): só a situação do Tiny.
create or replace function plt_privado.fn_pedido_cancelado(p_pedido_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select plt_privado.fn_situacao_normalizada(p.situacao) = 'cancelado'
       from public.pedidos p where p.id = p_pedido_id),
    false);
$$;

comment on function plt_privado.fn_pedido_cancelado(bigint) is
  'O pedido não quer mais a peça: cancelado no Tiny. ↩️ SESSAO-31 (D-124/D-129): o marcador "Devolvido" do Tiny e o "Pedido devolvido" da plataforma NÃO são cancelamento — o devolvido espera a decisão da logística.';

-- ----------------------------------------------------------------------------
-- 6 · O cancelamento tira a peça do pedido (recriada da 59): o devolvido NÃO (D-129)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_desvincular_por_cancelamento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido_id bigint;
  v_numero    integer;
  v_aguardo   bigint;
  v_estoque   bigint;
  v_rotas     bigint;
  v_devolvido boolean;
  v_frase     text;
  v_codigo    text;
  v_descricao text;
  r           record;
begin
  -- SESSAO-31 (D-124/D-129): só o cancelamento no Tiny tira a peça do pedido —
  -- o devolvido espera a decisão da logística (Em decisão pós devolução).
  if new.tipo = 'pedido_cancelado' then
    v_devolvido := false;
    select c.pedido_id into v_pedido_id
      from public.plt_cards c where c.id = new.card_id and c.tipo = 'pedido';
    if v_pedido_id is null then
      return null;
    end if;
    select p.numero into v_numero from public.pedidos p where p.id = v_pedido_id;
    select s.id into v_aguardo from public.plt_setores s where s.codigo = 'aguardo';
    select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';
    -- SESSAO-30 (D-114): a peça na ROTAS (programada ou no caminhão) também volta.
    select s.id into v_rotas from public.plt_setores s where s.codigo = 'rotas';
    v_frase := case when v_devolvido then 'devolvido' else 'cancelado no Tiny' end;

    for r in
      select u.id, u.setor_atual_id, u.etapa_atual_id, u.item_codigo, u.item_descricao
        from public.plt_cards u
       where u.pedido_id = v_pedido_id
         and u.tipo = 'unidade'
         and u.arquivado_em is null
         and u.setor_atual_id in (v_aguardo, v_estoque, v_rotas)
       order by u.id
    loop
      insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, observacao, dados)
        values (r.id, 'unidade_desvinculada', 'automacao', new.id,
                'Pedido ' || coalesce(v_numero::text, '') || ' ' || v_frase || ' — a peça ficou sem dono.',
                jsonb_build_object(
                  'motivo',          case when v_devolvido then 'pedido_devolvido' else 'pedido_cancelado' end,
                  'pedido_id',       v_pedido_id,
                  'numero',          v_numero,
                  'card_pedido_id',  new.card_id,
                  'produto_tiny_id', plt_privado.fn_produto_do_item(r.item_codigo, r.item_descricao)));
      if r.setor_atual_id in (v_aguardo, v_rotas) and v_estoque is not null then
        -- Sem evento_referencia_id de propósito: nas movimentações ele é a
        -- marcação de qualidade da transição (D-09) — aqui não há marcação.
        insert into public.plt_eventos
            (card_id, tipo, origem, setor_origem_id, etapa_origem_id, setor_destino_id,
             observacao, dados)
          values
            (r.id, 'movimentacao_setor', 'automacao', r.setor_atual_id, r.etapa_atual_id, v_estoque,
             'Pedido ' || v_frase || ' — a peça pronta voltou ao ESTOQUE, sem dono.',
             jsonb_build_object('motivo', case when v_devolvido then 'pedido_devolvido' else 'pedido_cancelado' end,
                                'numero', v_numero,
                                'cancelamento_evento_id', new.id));
      end if;
    end loop;
    -- Sai da programação do caminhão (a remoção vai à trilha pelo gatilho dela).
    delete from public.plt_programacoes where card_id = new.card_id;
    return null;
  end if;

  if new.tipo = 'movimentacao_setor' then
    if not exists (select 1 from public.plt_setores s
                    where s.id = new.setor_destino_id and s.codigo = 'estoque') then
      return null;
    end if;
    select c.pedido_id, c.item_codigo, c.item_descricao
      into v_pedido_id, v_codigo, v_descricao
      from public.plt_cards c where c.id = new.card_id and c.tipo = 'unidade';
    if v_pedido_id is null or not plt_privado.fn_pedido_cancelado(v_pedido_id) then
      return null;
    end if;
    select p.numero into v_numero from public.pedidos p where p.id = v_pedido_id;
    insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, observacao, dados)
      values (new.card_id, 'unidade_desvinculada', 'automacao', new.id,
              'Pedido ' || coalesce(v_numero::text, '') || ' cancelado no Tiny — a peça ficou pronta e entrou no ESTOQUE sem dono.',
              jsonb_build_object(
                'motivo',          'pedido_cancelado',
                'pedido_id',       v_pedido_id,
                'numero',          v_numero,
                'card_pedido_id',  (select pc.id from public.plt_cards pc
                                     where pc.pedido_id = v_pedido_id and pc.tipo = 'pedido'),
                'produto_tiny_id', plt_privado.fn_produto_do_item(v_codigo, v_descricao)));
  end if;
  return null;
end;
$$;
drop trigger if exists plt_eventos_zz_desvincular_cancelados on public.plt_eventos;
create trigger plt_eventos_zz_desvincular_cancelados
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('pedido_cancelado', 'movimentacao_setor'))
  execute function plt_privado.fn_desvincular_por_cancelamento();


-- ----------------------------------------------------------------------------
-- 7 · A reação ao pedido do Tiny (recriada da 59) sem o marcador "Devolvido" (D-124)
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
$$;

-- ----------------------------------------------------------------------------
-- 8 · A base de Pedidos em aguardo (recriada da 37): a peça em decisão pós devolução fica de fora
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_unidades_em_aguardo()
returns table (
  unidade_id     bigint,
  card_pedido_id bigint,
  pedido_id      bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, pc.id, u.pedido_id
    from public.plt_cards u
    join public.plt_setores s on s.id = u.setor_atual_id and s.papel_no_fluxo = 'terminal'
                               and s.codigo <> 'devolucao'  -- SESSAO-31 (D-129): em decisão não é aguardo
    join public.plt_cards pc on pc.pedido_id = u.pedido_id and pc.tipo = 'pedido'
   where u.tipo = 'unidade'
     and u.pedido_id is not null
     and u.arquivado_em is null
     and pc.arquivado_em is null
     and pc.lancado_rotas_em is null;
$$;

-- ----------------------------------------------------------------------------
-- 8b · O que falta entregar (D-130): na reentrega depois da devolução/ajuste,
--      as peças que FICARAM com o cliente (arquivadas pela entrega, sem voltar)
--      não faltam — o pedido completo é o que voltou.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_unidades_ja_entregues(p_pedido_id bigint)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
    from public.plt_cards u
   where u.pedido_id = p_pedido_id
     and u.tipo = 'unidade'
     and u.arquivado_em is not null
     and (select a.dados ->> 'motivo'
            from public.plt_eventos a
           where a.card_id = u.id and a.tipo = 'card_arquivado'
           order by a.id desc limit 1) = 'entregue';
$$;

create or replace function plt_privado.fn_unidades_a_entregar(p_pedido_id bigint)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select greatest(plt_privado.fn_unidades_do_pedido(p_pedido_id)
                  - plt_privado.fn_unidades_ja_entregues(p_pedido_id), 0);
$$;

comment on function plt_privado.fn_unidades_a_entregar(bigint) is
  'SESSAO-31 (D-130): as unidades de produção do pedido (frete fora — D-63) menos as que já foram entregues e ficaram com o cliente. Num pedido normal é o total; na reentrega, só o que voltou.';

-- ----------------------------------------------------------------------------
-- 9 · Lançar para ROTAS (recriada da 59): a reentrega leva só o que falta entregar
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_lancar_rotas(p_card_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario   uuid;
  v_card      public.plt_cards%rowtype;
  v_total     integer;
  v_prontas   integer;
  v_rotas     bigint;
  v_evento_id bigint;
  r           record;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma lança pedidos para ROTAS.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Lançar para ROTAS é gesto da logística (PCP/terminais) ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards
   where id = p_card_id and tipo = 'pedido' and arquivado_em is null;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if v_card.lancado_rotas_em is not null then
    raise exception 'Este pedido já foi lançado para ROTAS.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_entregue(p_card_id) then
    raise exception 'Este pedido já foi registrado como entregue.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    raise exception 'Este pedido foi cancelado no Tiny — não vai para ROTAS.' using errcode = 'check_violation';
  end if;

  -- D-63: frete não conta. SESSAO-31 (D-130): o que já foi entregue também não
  -- (a reentrega leva só o que voltou — fn_unidades_a_entregar).
  v_total := plt_privado.fn_unidades_a_entregar(v_card.pedido_id);
  select count(*)::int into v_prontas
    from public.plt_cards cu
    join public.plt_setores s on s.id = cu.setor_atual_id
   where cu.pedido_id = v_card.pedido_id and cu.tipo = 'unidade'
     and cu.arquivado_em is null and s.papel_no_fluxo = 'terminal'
     and s.codigo <> 'devolucao';  -- SESSAO-31 (D-129): em decisão não está pronta

  -- D-33/D-45: só pedido COMPLETO vai para as ROTAS. D-63: sem nada a
  -- produzir (só frete), o pedido está completo desde que nasceu.
  if v_prontas < v_total then
    raise exception 'Só pedido completo vai para ROTAS: % de % unidade(s) prontas.', v_prontas, v_total
      using errcode = 'check_violation';
  end if;

  select s.id into v_rotas from public.plt_setores s where s.codigo = 'rotas' and s.ativo;
  if v_rotas is null then
    raise exception 'O setor ROTAS não está cadastrado — cadastre-o antes de lançar.' using errcode = 'no_data_found';
  end if;

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_destino_id, dados)
       values (p_card_id, 'pedido_lancado_rotas', v_usuario, 'interface', v_rotas,
               jsonb_build_object('unidades', v_total))
    returning id into v_evento_id;

  -- As unidades que estão no ESTOQUE (ou noutro terminal) vão de verdade para
  -- a ROTAS — evento normal de movimentação (D-45); saída de terminal não
  -- exige marcação de qualidade (D-25).
  for r in
    select cu.id, cu.setor_atual_id, cu.etapa_atual_id
      from public.plt_cards cu
     where cu.pedido_id = v_card.pedido_id and cu.tipo = 'unidade'
       and cu.arquivado_em is null and cu.setor_atual_id is distinct from v_rotas
       and cu.setor_atual_id is distinct from (select s.id from public.plt_setores s where s.codigo = 'devolucao')
  loop
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem,
         setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
         observacao, dados)
      values
        (r.id, 'movimentacao_setor', v_usuario, 'interface',
         r.setor_atual_id, r.etapa_atual_id, v_rotas, null,
         'Lançado para ROTAS com o pedido completo.',
         jsonb_build_object('lancamento_evento_id', v_evento_id));
  end loop;

  return v_evento_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 10 · Registrar a entrega (recriada da 60): o que falta entregar sai junto
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_registrar_entrega(
  p_card_id    bigint,
  p_observacao text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_card     public.plt_cards%rowtype;
  v_total    integer;
  v_em_rotas integer;
  v_ret      jsonb;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma registra entrega.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_mexer_entrega(p_card_id) then
    raise exception 'Registrar entrega é gesto da logística (PCP/terminais), do entregador do caminhão ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if v_card.lancado_rotas_em is null then
    raise exception 'Este pedido ainda não foi lançado para ROTAS — lance pelos Pedidos em aguardo.'
      using errcode = 'check_violation';
  end if;
  if v_card.entrega_evento_id is not null then
    -- SESSAO-30 (Lei §10): o mesmo toque repetido (a rede que volta, o dedo
    -- que toca duas vezes) = uma entrega só — devolve a que já existe.
    if exists (select 1 from public.plt_eventos e
                where e.id = v_card.entrega_evento_id and e.usuario_id = v_usuario
                  and e.ocorrido_em > now() - interval '10 minutes') then
      return v_card.entrega_evento_id;
    end if;
    raise exception 'Este pedido já foi registrado como entregue.' using errcode = 'check_violation';
  end if;
  if plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    raise exception 'Este pedido foi cancelado no Tiny — não se entrega.' using errcode = 'check_violation';
  end if;

  -- D-63: frete não conta. D-33: entrega por pedido completo — do que falta
  -- entregar (SESSAO-31, D-130: a reentrega depois do ajuste leva só o que voltou).
  v_total := plt_privado.fn_unidades_a_entregar(v_card.pedido_id);
  select count(*)::int into v_em_rotas
    from public.plt_cards cu
    join public.plt_setores s on s.id = cu.setor_atual_id
   where cu.pedido_id = v_card.pedido_id and cu.tipo = 'unidade'
     and cu.arquivado_em is null and s.codigo = 'rotas';
  if v_em_rotas < v_total then
    raise exception 'A entrega sai por pedido completo: % de % unidade(s) na ROTAS.', v_em_rotas, v_total
      using errcode = 'check_violation';
  end if;

  v_ret := plt_privado.fn_fechar_pedido(p_card_id, v_usuario, 'interface', p_observacao, 'plataforma');
  perform plt_privado.fn_tiny_pedido_enfileirar(v_card.pedido_id, 'entregue', 'entregue');
  return (v_ret ->> 'entrega_evento_id')::bigint;
end;
$$;

-- ----------------------------------------------------------------------------
-- 11 · Pedidos em aguardo (recriada da 39): na reentrega, completo = o que voltou está pronto
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_pedidos_aguardo(
  p_busca        text    default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  card_id                 bigint,
  pedido_id               bigint,
  numero                  integer,
  cliente_nome            text,
  data_prevista           date,
  situacao                text,
  total_unidades          integer,
  unidades_liberadas      integer,
  unidades_prontas        integer,
  completo                boolean,
  alterado_apos_liberacao boolean,
  primeira_pronta_em      timestamptz,
  completo_em             timestamptz,
  contagem_total          bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with prontas as materialized (
    select a.card_pedido_id,
           count(*)::int       as prontas,
           min(u.concluido_em) as primeira,
           max(u.concluido_em) as ultima,
           false               as sem_producao
      from plt_privado.fn_unidades_em_aguardo() a
      join public.plt_cards u on u.id = a.unidade_id
     group by a.card_pedido_id
    union all
    -- D-63: pedido sem nada a produzir (só frete) — completo desde que nasceu.
    select s.card_pedido_id, 0, null::timestamptz, s.desde, true
      from plt_privado.fn_pedidos_sem_producao() s
  ),
  linhas as (
    select pc.id                          as card_id,
           p.id                           as pedido_id,
           p.numero,
           coalesce(c.nome, '')           as cliente_nome,
           p.data_prevista,
           p.situacao,
           coalesce(i.total_unidades, 0)  as total_unidades,
           coalesce(l.liberadas, 0)       as unidades_liberadas,
           pr.prontas                     as unidades_prontas,
           ((coalesce(i.total_unidades, 0) > 0 or pr.sem_producao)
            and pr.prontas >= coalesce(i.total_unidades, 0) - coalesce(ja.entregues, 0)) as completo,
           exists (select 1 from public.plt_eventos e
                    where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                          as alterado_apos_liberacao,
           pr.primeira                    as primeira_pronta_em,
           pr.ultima                      as ultima_pronta
      from prontas pr
      join public.plt_cards pc on pc.id = pr.card_pedido_id
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join lateral (
        select coalesce(sum(v.unidades), 0)::int as total_unidades
          from plt_privado.vw_itens_producao v where v.pedido_id = p.id
      ) i on true
      left join lateral (
        select count(*)::int as liberadas
          from public.plt_cards cu
         where cu.pedido_id = p.id and cu.tipo = 'unidade' and cu.arquivado_em is null
      ) l on true
      -- SESSAO-31 (D-130): na reentrega, o que já foi entregue não falta.
      left join lateral (
        select plt_privado.fn_unidades_ja_entregues(p.id) as entregues
      ) ja on true
     where plt_privado.fn_pode_ver_expedicao()
       and (p_busca is null or btrim(p_busca) = ''
            or p.numero::text like btrim(p_busca) || '%'
            or c.nome ilike '%' || btrim(p_busca) || '%')
  )
  select l.card_id, l.pedido_id, l.numero, l.cliente_nome, l.data_prevista, l.situacao,
         l.total_unidades, l.unidades_liberadas, l.unidades_prontas, l.completo,
         l.alterado_apos_liberacao, l.primeira_pronta_em,
         case when l.completo then l.ultima_pronta end as completo_em,
         count(*) over ()                              as contagem_total
    from linhas l
   order by l.completo desc, l.data_prevista asc nulls last, l.numero
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

-- ----------------------------------------------------------------------------
-- 12 · Os números do estoque ganham a linha "em decisão pós devolução" (D-129)
--      — a MESMA regra única da peça (fn_estoque_categoria, recriada da 57) e
--      o gatilho/recontagem com a coluna nova (recriados da 57).
-- ----------------------------------------------------------------------------
alter table public.plt_estoque_numeros add column if not exists em_devolucao integer not null default 0;
comment on column public.plt_estoque_numeros.em_devolucao is
  'SESSAO-31 (D-129): peças do produto em "Em decisão pós devolução" — esperando a logística decidir (reenviar, estoque, realocar, danificados, loja, ajuste). Não somam no estoque nem nos reservados.';

-- Em que número a peça entra (nulo = em nenhum). + 'devolucao' (D-129).
create or replace function plt_privado.fn_estoque_categoria(
  p_pedido_id bigint, p_reservada_pedido_id bigint, p_concluido_em timestamptz,
  p_arquivado_em timestamptz, p_setor_codigo text, p_setor_papel text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
           when p_arquivado_em is not null then null
           -- SESSAO-31 (D-129): a peça devolvida espera a decisão da logística.
           when p_setor_codigo = 'devolucao' then 'devolucao'
           when p_pedido_id is null and p_setor_codigo = 'estoque'
             then case when p_reservada_pedido_id is null then 'livre' else 'reservada_estoque' end
           -- pronta de pedido = num fim de linha (aguardo; ROTAS até a entrega — D-118;
           -- o ESTOQUE só tem peça de pedido no legado de antes da D-58)
           when p_pedido_id is not null and p_setor_papel = 'terminal' then 'pronta_pedido'
           when p_concluido_em is null and p_setor_papel is distinct from 'terminal'
             then case when p_pedido_id is null then 'producao_sem_dono' else 'producao_de_pedido' end
         end;
$$;

-- A contagem AO VIVO de um produto pelas mesmas regras (forma nova: + em_devolucao).
drop function if exists plt_privado.fn_estoque_contar(bigint);
create function plt_privado.fn_estoque_contar(p_produto bigint)
returns table (livres integer, reservadas_estoque integer, prontas_pedido integer,
               producao_sem_dono integer, producao_de_pedido integer, em_devolucao integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with dono as (
    select pr.codigo
      from public.produtos pr
     where pr.tiny_id = p_produto
       and pr.codigo is not null
       and pr.tiny_id = (select min(p2.tiny_id) from public.produtos p2
                          where p2.codigo = pr.codigo and p2.situacao = 'A')
  ),
  pecas as (
    select c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em, c.setor_atual_id
      from public.plt_cards c
     where c.tipo = 'unidade' and c.arquivado_em is null and c.pedido_id is null
       and c.produto_tiny_id = p_produto
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
    union all
    select c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em, c.setor_atual_id
      from public.plt_cards c, dono d
     where c.tipo = 'unidade' and c.arquivado_em is null and c.pedido_id is not null
       and c.item_codigo = d.codigo
       and not plt_privado.fn_eh_personalizado(c.item_descricao)
  ),
  cat as (
    select plt_privado.fn_estoque_categoria(p.pedido_id, p.reservada_pedido_id, p.concluido_em,
                                            p.arquivado_em, s.codigo, s.papel_no_fluxo) as categoria
      from pecas p left join public.plt_setores s on s.id = p.setor_atual_id
  )
  select count(*) filter (where categoria = 'livre')::int,
         count(*) filter (where categoria = 'reservada_estoque')::int,
         count(*) filter (where categoria = 'pronta_pedido')::int,
         count(*) filter (where categoria = 'producao_sem_dono')::int,
         count(*) filter (where categoria = 'producao_de_pedido')::int,
         count(*) filter (where categoria = 'devolucao')::int
    from cat;
$$;

create or replace function plt_privado.fn_estoque_pecas(p_produto_tiny_id bigint)
returns table (livres integer, reservadas integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select x.livres, x.reservadas_estoque from plt_privado.fn_estoque_contar(p_produto_tiny_id) x;
$$;

-- O gatilho (recriado da 57): cada mudança de peça soma/subtrai no número do
-- produto, no MESMO gesto — agora com a coluna em_devolucao.
create or replace function plt_privado.fn_estoque_numeros_cards()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.plt_estoque_numeros as n
      (produto_tiny_id, livres, reservadas_estoque, prontas_pedido, producao_sem_dono,
       producao_de_pedido, em_devolucao, atualizado_em)
  select x.produto,
         coalesce(sum(x.d) filter (where x.categoria = 'livre'), 0),
         coalesce(sum(x.d) filter (where x.categoria = 'reservada_estoque'), 0),
         coalesce(sum(x.d) filter (where x.categoria = 'pronta_pedido'), 0),
         coalesce(sum(x.d) filter (where x.categoria = 'producao_sem_dono'), 0),
         coalesce(sum(x.d) filter (where x.categoria = 'producao_de_pedido'), 0),
         coalesce(sum(x.d) filter (where x.categoria = 'devolucao'), 0),
         now()
    from (
      -- INSERT e UPDATE: as linhas novas entram (+1)
      select plt_privado.fn_estoque_produto_da_peca(c.pedido_id, c.produto_tiny_id, c.item_codigo, c.item_descricao) as produto,
             plt_privado.fn_estoque_categoria(c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em,
                                              s.codigo, s.papel_no_fluxo) as categoria,
             1 as d
        from novos c left join public.plt_setores s on s.id = c.setor_atual_id
       where tg_op in ('INSERT', 'UPDATE') and c.tipo = 'unidade'
      union all
      -- UPDATE e DELETE: as linhas velhas saem (-1)
      select plt_privado.fn_estoque_produto_da_peca(c.pedido_id, c.produto_tiny_id, c.item_codigo, c.item_descricao),
             plt_privado.fn_estoque_categoria(c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em,
                                              s.codigo, s.papel_no_fluxo),
             -1
        from velhos c left join public.plt_setores s on s.id = c.setor_atual_id
       where tg_op in ('UPDATE', 'DELETE') and c.tipo = 'unidade'
    ) x
   where x.produto is not null and x.categoria is not null
   group by x.produto
  having coalesce(sum(x.d) filter (where x.categoria = 'livre'), 0) <> 0
      or coalesce(sum(x.d) filter (where x.categoria = 'reservada_estoque'), 0) <> 0
      or coalesce(sum(x.d) filter (where x.categoria = 'pronta_pedido'), 0) <> 0
      or coalesce(sum(x.d) filter (where x.categoria = 'producao_sem_dono'), 0) <> 0
      or coalesce(sum(x.d) filter (where x.categoria = 'producao_de_pedido'), 0) <> 0
      or coalesce(sum(x.d) filter (where x.categoria = 'devolucao'), 0) <> 0
   order by x.produto
  on conflict (produto_tiny_id) do update
     set livres             = n.livres             + excluded.livres,
         reservadas_estoque = n.reservadas_estoque + excluded.reservadas_estoque,
         prontas_pedido     = n.prontas_pedido     + excluded.prontas_pedido,
         producao_sem_dono  = n.producao_sem_dono  + excluded.producao_sem_dono,
         producao_de_pedido = n.producao_de_pedido + excluded.producao_de_pedido,
         em_devolucao       = n.em_devolucao       + excluded.em_devolucao,
         atualizado_em      = now();
  return null;
end;
$$;

-- As tabelas de transição são as mesmas (o gatilho de INSERT não tem "velhos"
-- e o de DELETE não tem "novos"): três funções-casca chamam a regra acima.
create or replace function plt_privado.fn_estoque_numeros_cards_ins()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.plt_estoque_numeros as n
      (produto_tiny_id, livres, reservadas_estoque, prontas_pedido, producao_sem_dono,
       producao_de_pedido, em_devolucao, atualizado_em)
  select x.produto,
         count(*) filter (where x.categoria = 'livre'),
         count(*) filter (where x.categoria = 'reservada_estoque'),
         count(*) filter (where x.categoria = 'pronta_pedido'),
         count(*) filter (where x.categoria = 'producao_sem_dono'),
         count(*) filter (where x.categoria = 'producao_de_pedido'),
         count(*) filter (where x.categoria = 'devolucao'),
         now()
    from (select plt_privado.fn_estoque_produto_da_peca(c.pedido_id, c.produto_tiny_id, c.item_codigo, c.item_descricao) as produto,
                 plt_privado.fn_estoque_categoria(c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em,
                                                  s.codigo, s.papel_no_fluxo) as categoria
            from novos c left join public.plt_setores s on s.id = c.setor_atual_id
           where c.tipo = 'unidade') x
   where x.produto is not null and x.categoria is not null
   group by x.produto
   order by x.produto
  on conflict (produto_tiny_id) do update
     set livres             = n.livres             + excluded.livres,
         reservadas_estoque = n.reservadas_estoque + excluded.reservadas_estoque,
         prontas_pedido     = n.prontas_pedido     + excluded.prontas_pedido,
         producao_sem_dono  = n.producao_sem_dono  + excluded.producao_sem_dono,
         producao_de_pedido = n.producao_de_pedido + excluded.producao_de_pedido,
         em_devolucao       = n.em_devolucao       + excluded.em_devolucao,
         atualizado_em      = now();
  return null;
end;
$$;

create or replace function plt_privado.fn_estoque_numeros_cards_del()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.plt_estoque_numeros as n
      (produto_tiny_id, livres, reservadas_estoque, prontas_pedido, producao_sem_dono,
       producao_de_pedido, em_devolucao, atualizado_em)
  select x.produto,
         -count(*) filter (where x.categoria = 'livre'),
         -count(*) filter (where x.categoria = 'reservada_estoque'),
         -count(*) filter (where x.categoria = 'pronta_pedido'),
         -count(*) filter (where x.categoria = 'producao_sem_dono'),
         -count(*) filter (where x.categoria = 'producao_de_pedido'),
         -count(*) filter (where x.categoria = 'devolucao'),
         now()
    from (select plt_privado.fn_estoque_produto_da_peca(c.pedido_id, c.produto_tiny_id, c.item_codigo, c.item_descricao) as produto,
                 plt_privado.fn_estoque_categoria(c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em,
                                                  s.codigo, s.papel_no_fluxo) as categoria
            from velhos c left join public.plt_setores s on s.id = c.setor_atual_id
           where c.tipo = 'unidade') x
   where x.produto is not null and x.categoria is not null
   group by x.produto
   order by x.produto
  on conflict (produto_tiny_id) do update
     set livres             = n.livres             + excluded.livres,
         reservadas_estoque = n.reservadas_estoque + excluded.reservadas_estoque,
         prontas_pedido     = n.prontas_pedido     + excluded.prontas_pedido,
         producao_sem_dono  = n.producao_sem_dono  + excluded.producao_sem_dono,
         producao_de_pedido = n.producao_de_pedido + excluded.producao_de_pedido,
         em_devolucao       = n.em_devolucao       + excluded.em_devolucao,
         atualizado_em      = now();
  return null;
end;
$$;

drop trigger if exists plt_cards_estoque_numeros_ins on public.plt_cards;
create trigger plt_cards_estoque_numeros_ins
  after insert on public.plt_cards
  referencing new table as novos
  for each statement execute function plt_privado.fn_estoque_numeros_cards_ins();
drop trigger if exists plt_cards_estoque_numeros_upd on public.plt_cards;
create trigger plt_cards_estoque_numeros_upd
  after update on public.plt_cards
  referencing old table as velhos new table as novos
  for each statement execute function plt_privado.fn_estoque_numeros_cards();
drop trigger if exists plt_cards_estoque_numeros_del on public.plt_cards;
create trigger plt_cards_estoque_numeros_del
  after delete on public.plt_cards
  referencing old table as velhos
  for each statement execute function plt_privado.fn_estoque_numeros_cards_del();

-- A recontagem completa (recriada da 57) — as mesmas regras, + em_devolucao.
create or replace function plt_privado.fn_estoque_numeros_recontar()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  lock table public.plt_estoque_numeros in exclusive mode;
  insert into public.plt_estoque_numeros (produto_tiny_id)
  select pr.tiny_id from public.produtos pr
  on conflict (produto_tiny_id) do nothing;

  with contagem as (
    select x.produto,
           count(*) filter (where x.categoria = 'livre')::int              as livres,
           count(*) filter (where x.categoria = 'reservada_estoque')::int  as reservadas_estoque,
           count(*) filter (where x.categoria = 'pronta_pedido')::int      as prontas_pedido,
           count(*) filter (where x.categoria = 'producao_sem_dono')::int  as producao_sem_dono,
           count(*) filter (where x.categoria = 'producao_de_pedido')::int as producao_de_pedido,
           count(*) filter (where x.categoria = 'devolucao')::int          as em_devolucao
      from (select plt_privado.fn_estoque_produto_da_peca(c.pedido_id, c.produto_tiny_id, c.item_codigo, c.item_descricao) as produto,
                   plt_privado.fn_estoque_categoria(c.pedido_id, c.reservada_pedido_id, c.concluido_em, c.arquivado_em,
                                                    s.codigo, s.papel_no_fluxo) as categoria
              from public.plt_cards c
              left join public.plt_setores s on s.id = c.setor_atual_id
             where c.tipo = 'unidade' and c.arquivado_em is null) x
     where x.produto is not null and x.categoria is not null
     group by x.produto
  ),
  alvo as (
    select n.produto_tiny_id,
           coalesce(c.livres, 0) as livres, coalesce(c.reservadas_estoque, 0) as reservadas_estoque,
           coalesce(c.prontas_pedido, 0) as prontas_pedido, coalesce(c.producao_sem_dono, 0) as producao_sem_dono,
           coalesce(c.producao_de_pedido, 0) as producao_de_pedido, coalesce(c.em_devolucao, 0) as em_devolucao
      from public.plt_estoque_numeros n
      left join contagem c on c.produto = n.produto_tiny_id
  )
  update public.plt_estoque_numeros n
     set livres = a.livres, reservadas_estoque = a.reservadas_estoque, prontas_pedido = a.prontas_pedido,
         producao_sem_dono = a.producao_sem_dono, producao_de_pedido = a.producao_de_pedido,
         em_devolucao = a.em_devolucao, atualizado_em = now()
    from alvo a
   where n.produto_tiny_id = a.produto_tiny_id
     and (n.livres, n.reservadas_estoque, n.prontas_pedido, n.producao_sem_dono, n.producao_de_pedido, n.em_devolucao)
         is distinct from (a.livres, a.reservadas_estoque, a.prontas_pedido, a.producao_sem_dono, a.producao_de_pedido, a.em_devolucao);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

comment on function plt_privado.fn_estoque_numeros_recontar() is
  'SESSAO-30/31: recontagem completa dos números das peças pelas MESMAS regras do gatilho (fn_estoque_produto_da_peca + fn_estoque_categoria), + em_devolucao (D-129). Devolve quantos produtos estavam diferentes. Roda de madrugada (fn_recalcular_minimos) e na aplicação.';

-- ----------------------------------------------------------------------------
-- 13 · A lista do estoque (recriada da 57, forma nova): + "em decisão pós devolução" e o filtro
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_estoque_produtos(text, text, text, integer, integer);
create function public.plt_fn_estoque_produtos(
  p_grupo        text    default 'acabados',
  p_busca        text    default null,
  p_filtro       text    default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  tiny_id                 bigint,
  codigo                  text,
  descricao               text,
  classe                  text,
  unidade                 text,
  imagem_caminho          text,
  posicao                 integer,
  vendidos_90d            numeric,
  cortes                  integer,
  no_top                  boolean,
  minimo                  numeric,
  minimo_tiny             numeric,
  minimo_travado          boolean,
  sugestao                integer,
  em_estoque              numeric,
  reservados_venda        integer,
  reservadas_estoque      integer,
  reservados_producao     integer,
  em_necessidade          boolean,
  repor_sugerido          integer,
  pendente_card_id        bigint,
  pendente_pedido_numero  integer,
  saldo_tiny              numeric,
  lido_em                 timestamptz,
  origem_leitura          text,
  reposicao_estado        text,
  em_devolucao            integer,
  contagem_total          bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cfg as (
    select plt_privado.fn_estoque_top_x() as top_x
  ),
  -- A bolinha vermelha (D-86): a reserva mais antiga cujo pedido ainda espera
  -- a decisão do PCP (card do pedido vivo e não liberado por inteiro).
  pendentes as (
    select distinct on (c.produto_tiny_id)
           c.produto_tiny_id as tiny_id,
           cp.id             as card_id,
           p.numero          as pedido_numero
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id and s.codigo = 'estoque'
      join public.plt_cards cp on cp.pedido_id = c.reservada_pedido_id
                              and cp.tipo = 'pedido' and cp.arquivado_em is null
                              and cp.liberado_completo_em is null
      join public.pedidos p on p.id = c.reservada_pedido_id
     where c.tipo = 'unidade' and c.pedido_id is null and c.arquivado_em is null
       and c.reservada_pedido_id is not null and c.produto_tiny_id is not null
     order by c.produto_tiny_id, c.reservada_em
  ),
  base as (
    select b.tiny_id, b.codigo, b.descricao, b.classe, b.unidade, b.minimo, b.disponivel,
           b.saldo_tiny, b.lido_em, b.origem_leitura, b.prontos_reservados, b.reposicao_estado,
           pr.imagem_caminho, pr.estoque_minimo as minimo_tiny, pr.minimo_travado,
           n.posicao, n.vendidos_90d as vendidos,
           coalesce(n.cortes_90d, 0)                                                    as cortes_,
           sg.sugestao                                                                  as sugestao_,
           (n.posicao is not null and n.posicao <= cfg.top_x)                           as no_top_,
           coalesce(n.reservadas_estoque, 0)                                            as reservadas_estoque_,
           coalesce(n.em_devolucao, 0)                                                  as em_devolucao_,
           coalesce(rp.exibicao, 0)                                                     as reservados_producao_,
           coalesce(rp.para_estoque, 0)                                                 as para_estoque_,
           (coalesce(b.minimo, 0) > 0
              and coalesce(b.disponivel, 0) + coalesce(rp.para_estoque, 0) < b.minimo)  as em_necessidade_,
           case when coalesce(b.minimo, 0) > 0
                then greatest(ceil(b.minimo - greatest(coalesce(b.disponivel, 0), 0)
                                   - coalesce(rp.para_estoque, 0))::int, 0)
                else 0 end                                                              as repor_sugerido_,
           pd.card_id                                                                   as pendente_card_,
           pd.pedido_numero                                                             as pendente_numero_,
           case when b.disponivel is not null then greatest(b.disponivel, 0) end        as em_estoque_
      from plt_privado.fn_estoque_por_produto() b
      join public.produtos pr on pr.tiny_id = b.tiny_id
      cross join cfg
      left join public.plt_estoque_numeros n          on n.produto_tiny_id = b.tiny_id
      left join plt_privado.fn_sugestoes_minimo(null) sg on sg.tiny_id = b.tiny_id
      left join plt_privado.fn_reservados_producao() rp on rp.tiny_id = b.tiny_id
      left join pendentes   pd on pd.tiny_id = b.tiny_id
     where b.situacao = 'A'
       and case when coalesce(p_grupo, 'acabados') = 'insumos'
                then b.classe in ('M', 'K')
                else coalesce(b.classe, '') in ('F', 'S', 'V')
           end
  ),
  visivel as (
    select b.*
      from base b
     where plt_privado.fn_pode_ver_expedicao()
       and (p_busca is null or btrim(p_busca) = ''
            or b.descricao ilike '%' || btrim(p_busca) || '%'
            or b.codigo ilike btrim(p_busca) || '%')
  )
  select f.tiny_id,
         f.codigo,
         f.descricao,
         f.classe,
         f.unidade,
         f.imagem_caminho,
         f.posicao,
         coalesce(f.vendidos, 0),
         f.cortes_,
         coalesce(f.no_top_, false),
         f.minimo,
         f.minimo_tiny,
         f.minimo_travado,
         f.sugestao_,
         f.em_estoque_,
         f.prontos_reservados,
         f.reservadas_estoque_,
         f.reservados_producao_,
         f.em_necessidade_,
         f.repor_sugerido_,
         f.pendente_card_,
         f.pendente_numero_,
         f.saldo_tiny,
         f.lido_em,
         f.origem_leitura,
         f.reposicao_estado,
         f.em_devolucao_,
         count(*) over ()
    from visivel f
   where case
           when coalesce(p_grupo, 'acabados') = 'insumos'
             then coalesce(p_filtro, '') <> 'sem_leitura' or f.saldo_tiny is null
           when p_busca is not null and btrim(p_busca) <> '' then true
           when p_filtro = 'necessidade'         then f.em_necessidade_
           when p_filtro = 'reservados_producao' then f.reservados_producao_ > 0
           when p_filtro = 'com_estoque'         then coalesce(f.em_estoque_, 0) > 0
           when p_filtro = 'em_devolucao'        then f.em_devolucao_ > 0
           else true
         end
   order by (coalesce(p_grupo, 'acabados') = 'insumos' and coalesce(f.em_estoque_, 0) > 0) desc,
            f.posicao nulls last,
            f.descricao,
            f.tiny_id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;
comment on function public.plt_fn_estoque_produtos(text, text, text, integer, integer) is
  'Estoque por produto (D-83/D-86). SESSAO-30: lê a projeção plt_estoque_numeros (os números prontos — regra 18); reservados em venda vão até a entrega (D-118). SESSAO-31 (D-129): + em_devolucao (peças em decisão pós devolução) e o filtro ''em_devolucao''. Gate da logística.';
revoke all on function public.plt_fn_estoque_produtos(text, text, text, integer, integer) from public, anon;
grant execute on function public.plt_fn_estoque_produtos(text, text, text, integer, integer) to authenticated;


-- ----------------------------------------------------------------------------
-- 14 · O resumo do galpão (recriada da 57, forma nova): + móveis em decisão pós devolução
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_estoque_resumo();
create function public.plt_fn_estoque_resumo()
returns table (
  moveis_estoque    integer,
  pecas_unidades    numeric,
  pecas_m2          numeric,
  moveis_reservados integer,
  pecas_producao    integer,
  moveis_producao   integer,
  soma_minimos      numeric,
  produtos_abaixo   integer,
  moveis_em_devolucao integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select b.tiny_id, b.classe, b.unidade, b.minimo, b.disponivel, b.prontos_reservados
      from plt_privado.fn_estoque_por_produto() b
     where b.situacao = 'A'
  ),
  acabados as (
    select b.*, coalesce(n.producao_sem_dono, 0) as producao_sem_dono,
           coalesce(n.em_devolucao, 0) as em_devolucao,
           coalesce(n.producao_de_pedido, 0) as producao_de_pedido,
           coalesce(rp.para_estoque, 0) as para_estoque
      from base b
      left join public.plt_estoque_numeros n on n.produto_tiny_id = b.tiny_id
      left join plt_privado.fn_reservados_producao() rp on rp.tiny_id = b.tiny_id
     where coalesce(b.classe, '') in ('F', 'S', 'V')
  ),
  insumos as (
    select b.unidade, greatest(coalesce(b.disponivel, 0), 0) as quantidade
      from base b where b.classe in ('M', 'K')
  )
  select (select coalesce(sum(a.disponivel), 0)::int from acabados a),
         (select coalesce(sum(i.quantidade), 0) from insumos i
           where lower(coalesce(i.unidade, '')) not in ('m2', 'm²', 'm^2')),
         (select coalesce(sum(i.quantidade), 0) from insumos i
           where lower(coalesce(i.unidade, '')) in ('m2', 'm²', 'm^2')),
         (select coalesce(sum(a.prontos_reservados), 0)::int from acabados a),
         (select coalesce(sum(a.producao_sem_dono), 0)::int from acabados a),
         (select coalesce(sum(a.producao_de_pedido), 0)::int from acabados a),
         (select coalesce(sum(a.minimo), 0) from acabados a),
         (select count(*)::int from acabados a
           where coalesce(a.minimo, 0) > 0 and a.disponivel + a.para_estoque < a.minimo),
         (select coalesce(sum(a.em_devolucao), 0)::int from acabados a)
   where plt_privado.fn_pode_ver_expedicao();
$$;
revoke all on function public.plt_fn_estoque_resumo() from public, anon;
grant execute on function public.plt_fn_estoque_resumo() to authenticated;


-- ----------------------------------------------------------------------------
-- 15 · "Todos os pedidos" (recriada da 59): + a situação "devolvido" (em decisão)
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

-- ----------------------------------------------------------------------------
-- 16 · A janela completa do pedido (recriada da 64): + a devolução em decisão
-- ----------------------------------------------------------------------------
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
             when v_card.devolucao_evento_id is not null then 'devolvido'  -- SESSAO-31 (D-129)
             when v_card.entrega_evento_id is not null then 'entregue'
             when v_card.arquivado_em is not null then 'arquivado'
             when v_card.lancado_rotas_em is not null then 'em_rota'
             when v_tot > 0 and v_pro >= v_tot then 'aguardo'
             when v_lib > 0 then 'producao'
             else 'pcp'
           end;

  return jsonb_build_object(
    -- SESSAO-31 (D-129): a devolução em decisão (o resto vem da porta da decisão).
    'devolucao', case when v_card.devolucao_evento_id is not null then (
      select jsonb_build_object('evento_id', d.id, 'quando', d.ocorrido_em,
               'quem', (select u.nome from public.plt_usuarios u where u.id = d.usuario_id),
               'motivo', d.dados ->> 'motivo', 'observacao', d.dados ->> 'observacao',
               'entregue', coalesce((d.dados ->> 'entregue')::boolean, false))
        from public.plt_eventos d where d.id = v_card.devolucao_evento_id) end,
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

-- ----------------------------------------------------------------------------
-- 17 · A maquinaria da devolução e do ajuste (plt_privado — fora da API)
-- ----------------------------------------------------------------------------

-- Avisa a logística (e os admins), menos quem fez: o sino abre a decisão.
create or replace function plt_privado.fn_avisar_logistica(
  p_evento_id bigint, p_card_id bigint, p_tipo text, p_titulo text, p_corpo text, p_autor uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  insert into public.plt_notificacoes (destinatario_id, evento_id, card_id, tipo, titulo, corpo)
  select u.id, p_evento_id, p_card_id, p_tipo, p_titulo, p_corpo
    from public.plt_usuarios u
   where u.ativo
     and u.id is distinct from p_autor
     and (u.papel = 'admin' or plt_privado.fn_eh_logistica(u.id));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Reentrega (D-130): o pedido já entregue volta a ter o que entregar — a
-- entrega é desfeita SÓ na plataforma (o Tiny segue "Entregue": não há fila),
-- e a programação antiga sai (fica copiada no fato, para a história).
create or replace function plt_privado.fn_reabrir_para_reentrega(
  p_card_pedido_id bigint, p_usuario uuid, p_motivo text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.plt_cards%rowtype;
  v_prog public.plt_programacoes%rowtype;
begin
  select * into v_card from public.plt_cards where id = p_card_pedido_id and tipo = 'pedido' for update;
  if not found or v_card.entrega_evento_id is null then
    return false;
  end if;
  select * into v_prog from public.plt_programacoes where card_id = v_card.id;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_card.id, 'entrega_desfeita', p_usuario, 'interface',
            'Reentrega: ' || p_motivo || ' — a entrega foi reaberta só na plataforma (o Tiny segue "Entregue").',
            jsonb_build_object('entrega_evento_id', v_card.entrega_evento_id, 'motivo', 'reentrega',
                               'fonte', 'plataforma', 'tiny', 'nao_muda',
                               'programacao_anterior', case when v_prog.card_id is null then null
                                 else jsonb_build_object('data_entrega', v_prog.data_entrega,
                                                         'caminhao_id', v_prog.caminhao_id) end));
  delete from public.plt_programacoes where card_id = v_card.id;
  -- O card do pedido que tinha saído do PCP (nunca foi às ROTAS) volta a existir.
  if v_card.arquivado_em is not null then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card.id, 'card_desarquivado', p_usuario, 'interface',
              'Reentrega: o pedido volta para a logística.', jsonb_build_object('motivo', 'reentrega'));
  end if;
  return true;
end;
$$;

-- Depois de a peça voltar ao aguardo: se o que falta entregar está todo pronto,
-- o pedido volta sozinho para as ROTAS → Programar (melhor esforço — se a
-- regra do lançamento recusar, ele espera em Pedidos em aguardo).
create or replace function plt_privado.fn_relancar_se_completo(p_card_pedido_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.plt_cards%rowtype;
  v_prontas integer;
begin
  select * into v_card from public.plt_cards where id = p_card_pedido_id and tipo = 'pedido';
  if not found or v_card.lancado_rotas_em is not null or v_card.entrega_evento_id is not null
     or v_card.devolucao_evento_id is not null or plt_privado.fn_pedido_cancelado(v_card.pedido_id) then
    return false;
  end if;
  select count(*)::int into v_prontas
    from public.plt_cards u
    join public.plt_setores s on s.id = u.setor_atual_id and s.codigo = 'aguardo'
   where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null;
  if v_prontas = 0 or v_prontas < plt_privado.fn_unidades_a_entregar(v_card.pedido_id) then
    return false;
  end if;
  begin
    perform public.plt_fn_lancar_rotas(v_card.id);
    return true;
  exception when others then
    return false;
  end;
end;
$$;

-- O fim do ajuste (D-130): a peça vai para o destino final que o PCP escolheu.
-- Chamado pelo concluir (a EXPEDIÇÃO — D-127), já com o gate dele.
create or replace function plt_privado.fn_ajuste_concluir(
  p_card_id bigint, p_estado text, p_observacao text, p_operador_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card     public.plt_cards%rowtype;
  v_usuario  uuid;
  v_destino  text;
  v_pc       bigint;
  v_numero   integer;
  v_estoque  bigint;
  v_aguardo  bigint;
  v_etapa    bigint;
  v_marca_d  text;
  v_marca_e  text;
  v_final    text;
begin
  select * into v_card from public.plt_cards where id = p_card_id for update;
  v_usuario := plt_privado.fn_autor_do_gesto(v_card.setor_atual_id, p_operador_id);
  v_destino := v_card.ajuste_destino;
  select pc.id into v_pc from public.plt_cards pc where pc.pedido_id = v_card.pedido_id and pc.tipo = 'pedido';
  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;
  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';
  select s.id into v_aguardo from public.plt_setores s where s.codigo = 'aguardo';
  v_marca_d := current_setting('plt.devolucao_maquinaria', true);
  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  perform set_config('plt.devolucao_maquinaria', 'on', true);

  -- Voltar ao pedido que foi cancelado no Tiny não existe: vira estoque.
  if v_destino = 'pedido' and (v_card.pedido_id is null or plt_privado.fn_pedido_cancelado(v_card.pedido_id)) then
    v_destino := 'estoque';
  end if;

  if v_destino = 'estoque' then
    if v_card.pedido_id is not null then
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
        values (v_card.id, 'unidade_desvinculada', v_usuario, 'interface',
                'Ajuste concluído: a peça vai para o ESTOQUE, sem dono.',
                jsonb_build_object('motivo', 'ajuste', 'pedido_id', v_card.pedido_id, 'numero', v_numero,
                                   'card_pedido_id', v_pc,
                                   'produto_tiny_id', plt_privado.fn_produto_do_item(v_card.item_codigo, v_card.item_descricao)));
    end if;
    perform public.plt_fn_mover_card(v_card.id, v_estoque, null, p_estado, p_observacao, p_operador_id);
    v_final := 'estoque';
  elsif v_destino = 'pedido' then
    -- Pedido já entregue: é a REENTREGA ao cliente (D-130).
    perform plt_privado.fn_reabrir_para_reentrega(v_pc, v_usuario, 'peça ajustada volta ao cliente');
    perform public.plt_fn_mover_card(v_card.id, v_aguardo, null, p_estado, p_observacao, p_operador_id);
    v_final := 'aguardo';
  elsif v_destino in ('terceirizado', 'loja') then
    perform plt_privado.fn_fechar_tempo_aberto(v_card.id, 'Ajuste concluído: o tempo aberto fecha antes de a peça sair.');
    perform set_config('plt.entrega_maquinaria', 'on', true);
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_card.id, 'card_arquivado', v_usuario, 'interface',
              case when v_destino = 'loja' then 'Ajuste concluído: a peça foi para o estoque da loja — saiu das contas da fábrica.'
                   else 'Ajuste concluído: a peça foi para o terceirizado — saiu das contas da fábrica.' end,
              jsonb_build_object('motivo', v_destino, 'ajuste_evento_id', v_card.ajuste_evento_id, 'numero', v_numero));
    v_final := v_destino;
  else
    -- danificados: a etapa DANIFICADO do setor onde ela está.
    v_etapa := plt_privado.fn_garantir_etapa_danificado(v_card.setor_atual_id);
    perform public.plt_fn_mover_card(v_card.id, v_card.setor_atual_id, v_etapa, null, p_observacao, p_operador_id);
    v_final := 'danificados';
  end if;

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_card.id, 'ajuste_concluido', v_usuario, 'interface',
            'Ajuste concluído — destino: ' || v_final || '.',
            jsonb_build_object('destino', v_final, 'ajuste_evento_id', v_card.ajuste_evento_id, 'numero', v_numero));
  if v_final = 'aguardo' then
    perform plt_privado.fn_relancar_se_completo(v_pc);
  end if;

  perform set_config('plt.devolucao_maquinaria', coalesce(v_marca_d, ''), true);
  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);
  return v_final;
end;
$$;

-- ----------------------------------------------------------------------------
-- 18 · As portas (public — gate dentro; endpoints de propósito, E-11)
-- ----------------------------------------------------------------------------

-- O "Pedido devolvido" da LOGÍSTICA (D-129) — nunca do entregador. Pedido na
-- ROTAS: as peças que estão lá voltam; pedido já ENTREGUE: as peças que
-- saíram com a entrega voltam (todas, ou as escolhidas em p_pecas).
create or replace function public.plt_fn_pedido_devolver(
  p_card_id    bigint,
  p_motivo_id  bigint,
  p_observacao text default null,
  p_pecas      bigint[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario  uuid;
  v_card     public.plt_cards%rowtype;
  v_motivo   text;
  v_numero   integer;
  v_dev      bigint;
  v_evento   bigint;
  v_entregue boolean;
  v_pecas    bigint[];
  v_marca_d  text;
  v_marca_e  text;
  v_avisados integer;
  r          record;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Marcar "pedido devolvido" é gesto da logística ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido' for update;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  select p.numero into v_numero from public.pedidos p where p.id = v_card.pedido_id;

  -- Lei §10: o mesmo toque repetido = um efeito só.
  if v_card.devolucao_evento_id is not null then
    if exists (select 1 from public.plt_eventos e
                where e.id = v_card.devolucao_evento_id and e.usuario_id = v_usuario
                  and e.ocorrido_em > now() - interval '10 minutes') then
      return jsonb_build_object('evento_id', v_card.devolucao_evento_id, 'repetido', true);
    end if;
    raise exception 'O pedido % já está em decisão pós devolução.', v_numero using errcode = 'check_violation';
  end if;

  select m.texto into v_motivo from public.plt_motivos m
   where m.id = p_motivo_id and m.tipo = 'devolucao' and m.ativo;
  if v_motivo is null then
    raise exception 'Escolha o motivo da devolução.' using errcode = 'check_violation';
  end if;

  v_entregue := v_card.entrega_evento_id is not null;
  select s.id into v_dev from public.plt_setores s where s.codigo = 'devolucao';
  if v_dev is null then
    raise exception 'O lugar "Em decisão pós devolução" não está cadastrado — fale com o admin.' using errcode = 'no_data_found';
  end if;

  if v_entregue then
    -- As peças que saíram com a entrega vigente (e ainda não voltaram).
    select array_agg(u.id order by u.id) into v_pecas
      from public.plt_cards u
     where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is not null
       and (p_pecas is null or u.id = any (p_pecas))
       and exists (select 1 from public.plt_eventos a
                    where a.card_id = u.id and a.tipo = 'card_arquivado'
                      and (a.dados ->> 'entrega_evento_id')::bigint = v_card.entrega_evento_id
                      and a.id = (select max(a2.id) from public.plt_eventos a2
                                   where a2.card_id = u.id and a2.tipo = 'card_arquivado'));
  else
    if v_card.lancado_rotas_em is null then
      raise exception 'O pedido % não está na ROTAS nem entregue — não há o que devolver.', v_numero
        using errcode = 'check_violation';
    end if;
    select array_agg(u.id order by u.id) into v_pecas
      from public.plt_cards u
      join public.plt_setores s on s.id = u.setor_atual_id and s.codigo = 'rotas'
     where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null
       and (p_pecas is null or u.id = any (p_pecas));
  end if;
  if v_pecas is null or array_length(v_pecas, 1) is null then
    raise exception 'Nenhuma peça do pedido % para devolver.', v_numero using errcode = 'check_violation';
  end if;

  v_marca_d := current_setting('plt.devolucao_maquinaria', true);
  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  perform set_config('plt.devolucao_maquinaria', 'on', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_card.id, 'pedido_devolvido', v_usuario, 'interface',
            v_motivo || coalesce(' — ' || nullif(btrim(p_observacao), ''), ''),
            jsonb_build_object('fonte', 'plataforma', 'numero', v_numero, 'motivo_id', p_motivo_id,
                               'motivo', v_motivo, 'observacao', nullif(btrim(p_observacao), ''),
                               'entregue', v_entregue, 'entrega_evento_id', v_card.entrega_evento_id,
                               'pecas', to_jsonb(v_pecas)))
    returning id into v_evento;
  -- Pedido ainda na ROTAS: sai da programação (o caminhão não o leva mais).
  if not v_entregue then
    delete from public.plt_programacoes where card_id = v_card.id;
  end if;

  for r in
    select c.id, c.setor_atual_id, c.etapa_atual_id, c.arquivado_em
      from public.plt_cards c where c.id = any (v_pecas) order by c.id for update
  loop
    if r.arquivado_em is not null then
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao, dados)
        values (r.id, 'card_desarquivado', v_usuario, 'interface', r.setor_atual_id, r.etapa_atual_id,
                'Pedido devolvido — a peça voltou do cliente.',
                jsonb_build_object('motivo', 'devolucao', 'devolucao_evento_id', v_evento));
    end if;
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, setor_destino_id,
         observacao, dados)
      values (r.id, 'movimentacao_setor', v_usuario, 'interface',
              (select c.setor_atual_id from public.plt_cards c where c.id = r.id),
              (select c.etapa_atual_id from public.plt_cards c where c.id = r.id),
              v_dev, 'Pedido devolvido — a peça espera a decisão da logística.',
              jsonb_build_object('motivo', 'devolucao', 'devolucao_evento_id', v_evento));
  end loop;

  perform set_config('plt.devolucao_maquinaria', coalesce(v_marca_d, ''), true);
  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);

  v_avisados := plt_privado.fn_avisar_logistica(
    v_evento, v_card.id, 'devolucao_decidir',
    'Pedido ' || coalesce(v_numero::text, '') || ' devolvido — decidir a situação',
    (select u.nome from public.plt_usuarios u where u.id = v_usuario) || ' marcou o pedido '
      || coalesce(v_numero::text, '') || ' como devolvido (' || v_motivo || '). '
      || array_length(v_pecas, 1) || ' peça(s) esperam a decisão em Estoque → Em decisão pós devolução.',
    v_usuario);

  return jsonb_build_object('evento_id', v_evento, 'pecas', array_length(v_pecas, 1),
                            'entregue', v_entregue, 'avisados', v_avisados);
end;
$$;

comment on function public.plt_fn_pedido_devolver(bigint, bigint, text, bigint[]) is
  'SESSAO-31 (D-129): "Pedido devolvido" — gesto da LOGÍSTICA/admin (nunca do entregador), com motivo. Pedido na ROTAS: as peças de lá voltam; já entregue: as que saíram com a entrega (todas ou p_pecas). As peças continuam do pedido, ficam em "Em decisão pós devolução" e a logística é avisada. O Tiny não muda. Repetir o toque em 10 min devolve o mesmo.';

-- As devoluções em decisão (lista por cursor — Lei §6): opcionalmente só as
-- que têm peça de um produto (o cartão do Estoque).
create or replace function public.plt_fn_devolucoes(
  p_produto_tiny_id bigint  default null,
  p_antes_id        bigint  default null,
  p_limite          integer default 20
)
returns table (
  card_id        bigint,
  pedido_id      bigint,
  numero         integer,
  cliente_nome   text,
  evento_id      bigint,
  quando         timestamptz,
  quem           text,
  motivo         text,
  entregue       boolean,
  pecas          integer,
  tem_mais       boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with lim as (select least(greatest(coalesce(p_limite, 20), 1), 100) as n),
  abertas as (
    select pc.id as card_id, pc.pedido_id, d.id as evento_id, d.ocorrido_em, d.usuario_id, d.dados
      from public.plt_cards pc
      join public.plt_eventos d on d.id = pc.devolucao_evento_id
     where plt_privado.fn_pode_ver_expedicao()
       and pc.devolucao_evento_id is not null
       and (p_antes_id is null or pc.devolucao_evento_id < p_antes_id)
       and (p_produto_tiny_id is null or exists (
             select 1 from public.plt_cards u
               join public.plt_setores s on s.id = u.setor_atual_id and s.codigo = 'devolucao'
              where u.pedido_id = pc.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null
                and plt_privado.fn_estoque_produto_da_peca(u.pedido_id, u.produto_tiny_id, u.item_codigo, u.item_descricao)
                    = p_produto_tiny_id))
     order by pc.devolucao_evento_id desc
     limit (select n + 1 from lim)
  )
  select a.card_id, a.pedido_id, p.numero, coalesce(c.nome, ''), a.evento_id, a.ocorrido_em,
         (select u.nome from public.plt_usuarios u where u.id = a.usuario_id),
         a.dados ->> 'motivo', coalesce((a.dados ->> 'entregue')::boolean, false),
         (select count(*)::int from public.plt_cards u
            join public.plt_setores s on s.id = u.setor_atual_id and s.codigo = 'devolucao'
           where u.pedido_id = a.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null),
         (select count(*) from abertas) > (select n from lim)
    from abertas a
    join public.pedidos p on p.id = a.pedido_id
    left join public.clientes c on c.id = p.cliente_id
   order by a.evento_id desc
   limit (select n from lim);
$$;

-- A telinha "Decidir situação" numa requisição (Lei §3: só no clique): o mini
-- relatório (quem, quando, motivo, o histórico da entrega) e as peças.
create or replace function public.plt_fn_devolucao_detalhe(p_card_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.plt_cards%rowtype;
  v_p    public.pedidos%rowtype;
  v_d    public.plt_eventos%rowtype;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'A decisão da devolução é da logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido';
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  select * into v_p from public.pedidos where id = v_card.pedido_id;
  if v_card.devolucao_evento_id is not null then
    select * into v_d from public.plt_eventos where id = v_card.devolucao_evento_id;
  else
    -- A última devolução (já decidida) — a tela diz que não há o que decidir.
    select * into v_d from public.plt_eventos
     where card_id = v_card.id and tipo = 'pedido_devolvido' order by id desc limit 1;
  end if;

  return jsonb_build_object(
    'card_id', v_card.id,
    'pedido_id', v_p.id,
    'numero', v_p.numero,
    'situacao_tiny', v_p.situacao,
    'cancelado', plt_privado.fn_pedido_cancelado(v_p.id),
    'cliente', (select jsonb_build_object('nome', c.nome, 'telefone', c.fone, 'cidade', c.cidade, 'bairro', c.bairro)
                  from public.clientes c where c.id = v_p.cliente_id),
    'em_decisao', v_card.devolucao_evento_id is not null,
    'devolucao', case when v_d.id is null then null else jsonb_build_object(
        'evento_id', v_d.id, 'quando', v_d.ocorrido_em,
        'quem', (select u.nome from public.plt_usuarios u where u.id = v_d.usuario_id),
        'motivo', v_d.dados ->> 'motivo', 'observacao', v_d.dados ->> 'observacao',
        'entregue', coalesce((v_d.dados ->> 'entregue')::boolean, false)) end,
    -- O histórico da entrega: não entregue (com motivo), entregas e desfeitas,
    -- comentários do entregador e os comprovantes.
    'historico', coalesce((
        select jsonb_agg(h order by h->>'quando' desc)
          from (select jsonb_build_object('tipo', e.tipo, 'quando', e.ocorrido_em,
                         'quem', (select u.nome from public.plt_usuarios u where u.id = e.usuario_id),
                         'texto', coalesce(e.dados ->> 'motivo', e.observacao)) as h
                  from public.plt_eventos e
                 where e.card_id = v_card.id
                   and e.tipo in ('entrega_nao_realizada', 'pedido_entregue', 'entrega_desfeita',
                                  'comentario_adicionado', 'pedido_devolvido', 'pedido_lancado_rotas')
                 order by e.id desc limit 20) x), '[]'::jsonb),
    'comprovantes', (select count(*)::int from public.plt_anexos a
                      where a.card_id = v_card.id and a.removido_em is null),
    'pecas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', u.id, 'descricao', u.item_descricao, 'sku', u.item_codigo,
                 'indice', u.indice_unidade, 'total', u.total_unidades,
                 'qualidade', u.qualidade_atual,
                 'danificada', coalesce(e.eh_danificado, false),
                 'em_decisao', s.codigo = 'devolucao' and not coalesce(e.eh_danificado, false),
                 'onde', s.nome,
                 'produto_tiny_id', plt_privado.fn_estoque_produto_da_peca(u.pedido_id, u.produto_tiny_id, u.item_codigo, u.item_descricao))
               order by u.item_seq, u.indice_unidade)
          from public.plt_cards u
          join public.plt_setores s on s.id = u.setor_atual_id
          left join public.plt_etapas e on e.id = u.etapa_atual_id
         where u.pedido_id = v_card.pedido_id and u.tipo = 'unidade' and u.arquivado_em is null
           and s.codigo = 'devolucao'), '[]'::jsonb),
    'decididas', coalesce((
        select jsonb_agg(jsonb_build_object('peca_id', e.card_id, 'decisao', e.dados ->> 'decisao',
                 'quando', e.ocorrido_em, 'quem', (select u.nome from public.plt_usuarios u where u.id = e.usuario_id))
               order by e.id)
          from public.plt_eventos e
         where e.tipo = 'devolucao_decidida' and (e.dados ->> 'devolucao_evento_id')::bigint = v_d.id), '[]'::jsonb)
  );
end;
$$;

-- Para onde a peça pode ser REALOCADA (só no clique "Realocar"): pedidos vivos
-- no PCP com uma vaga ainda não liberada da MESMA peça (a régua da D-62).
create or replace function public.plt_fn_devolucao_realocar_opcoes(p_peca_id bigint)
returns table (
  card_pedido_id bigint,
  numero         integer,
  cliente_nome   text,
  data_prevista  date,
  item_seq       integer,
  indice_unidade integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with peca as (
    select plt_privado.fn_chave_peca(
             plt_privado.fn_estoque_produto_da_peca(u.pedido_id, u.produto_tiny_id, u.item_codigo, u.item_descricao),
             u.item_codigo, u.item_descricao) as chave,
           u.pedido_id
      from public.plt_cards u
     where u.id = p_peca_id and u.tipo = 'unidade'
  ),
  vagas as (
    select pc.id as card_pedido_id, p.numero, coalesce(c.nome, '') as cliente_nome, p.data_prevista,
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
       and not exists (select 1 from public.plt_cards u2
                        where u2.pedido_id = pc.pedido_id and u2.tipo = 'unidade'
                          and u2.item_seq = v.seq and u2.indice_unidade = k.k)
  )
  select distinct on (vg.card_pedido_id) vg.card_pedido_id, vg.numero, vg.cliente_nome, vg.data_prevista,
         vg.item_seq, vg.indice_unidade
    from vagas vg
   order by vg.card_pedido_id, vg.item_seq, vg.indice_unidade
   limit 20;
$$;

-- Abrir o AJUSTE (D-130): a MESMA peça volta a um setor de produção com o
-- destino final escolhido pelo PCP. De onde: em decisão pós devolução, no
-- ESTOQUE (livre), em Pedidos em aguardo, ou já entregue (ela volta).
create or replace function public.plt_fn_ajuste_abrir(
  p_peca_id       bigint,
  p_setor_id      bigint,
  p_destino_final text,
  p_descricao     text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_peca    public.plt_cards%rowtype;
  v_onde    text;
  v_setor   public.plt_setores%rowtype;
  v_evento  bigint;
  v_numero  integer;
  v_marca_d text;
  v_marca_e text;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Abrir ajuste de peça é gesto do PCP/logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  if p_destino_final not in ('estoque', 'pedido', 'terceirizado', 'loja', 'danificados') then
    raise exception 'Escolha o destino final do ajuste.' using errcode = 'check_violation';
  end if;
  select * into v_setor from public.plt_setores where id = p_setor_id and ativo;
  if not found or v_setor.papel_no_fluxo <> 'producao' then
    raise exception 'O ajuste vai para um setor de produção.' using errcode = 'check_violation';
  end if;
  select * into v_peca from public.plt_cards where id = p_peca_id and tipo = 'unidade' for update;
  if not found then
    raise exception 'Peça % não existe.', p_peca_id using errcode = 'no_data_found';
  end if;
  if v_peca.ajuste_evento_id is not null then
    raise exception 'Esta peça já está em ajuste.' using errcode = 'check_violation';
  end if;
  if p_destino_final = 'pedido' and (v_peca.pedido_id is null or plt_privado.fn_pedido_cancelado(v_peca.pedido_id)) then
    raise exception 'Voltar ao pedido só vale para peça de pedido vivo.' using errcode = 'check_violation';
  end if;
  select s.codigo into v_onde from public.plt_setores s where s.id = v_peca.setor_atual_id;
  if v_peca.arquivado_em is not null then
    -- Já entregue: a peça volta (só a que saiu com uma entrega).
    if (select a.dados ->> 'motivo' from public.plt_eventos a
         where a.card_id = v_peca.id and a.tipo = 'card_arquivado' order by a.id desc limit 1) is distinct from 'entregue' then
      raise exception 'Só peça já entregue, em decisão pós devolução, no ESTOQUE ou em Pedidos em aguardo vai para ajuste.'
        using errcode = 'check_violation';
    end if;
  elsif coalesce(v_onde, '') not in ('devolucao', 'estoque', 'aguardo') then
    raise exception 'Só peça já entregue, em decisão pós devolução, no ESTOQUE ou em Pedidos em aguardo vai para ajuste.'
      using errcode = 'check_violation';
  end if;
  if v_onde = 'estoque' and v_peca.arquivado_em is null and v_peca.reservada_pedido_id is not null then
    raise exception 'Esta peça do estoque está reservada para um pedido.' using errcode = 'check_violation';
  end if;
  select p.numero into v_numero from public.pedidos p where p.id = v_peca.pedido_id;

  v_marca_d := current_setting('plt.devolucao_maquinaria', true);
  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  perform set_config('plt.devolucao_maquinaria', 'on', true);
  perform set_config('plt.entrega_maquinaria', 'on', true);

  if v_peca.arquivado_em is not null then
    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao, dados)
      values (v_peca.id, 'card_desarquivado', v_usuario, 'interface', v_peca.setor_atual_id, v_peca.etapa_atual_id,
              'A peça entregue voltou para ajuste.', jsonb_build_object('motivo', 'ajuste'));
  end if;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
    values (v_peca.id, 'ajuste_aberto', v_usuario, 'interface',
            coalesce(nullif(btrim(p_descricao), ''), 'Ajuste de peça.'),
            jsonb_build_object('destino_final', p_destino_final, 'setor_id', p_setor_id, 'setor', v_setor.nome,
                               'descricao', nullif(btrim(p_descricao), ''), 'de', coalesce(v_onde, 'entregue'),
                               'numero', v_numero))
    returning id into v_evento;
  insert into public.plt_eventos
      (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, setor_destino_id, observacao, dados)
    values (v_peca.id, 'movimentacao_setor', v_usuario, 'interface',
            (select c.setor_atual_id from public.plt_cards c where c.id = v_peca.id),
            (select c.etapa_atual_id from public.plt_cards c where c.id = v_peca.id),
            p_setor_id, 'Ajuste de peça: voltou para ' || v_setor.nome || '.',
            jsonb_build_object('ajuste_evento_id', v_evento));

  perform set_config('plt.devolucao_maquinaria', coalesce(v_marca_d, ''), true);
  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);
  return v_evento;
end;
$$;

comment on function public.plt_fn_ajuste_abrir(bigint, bigint, text, text) is
  'SESSAO-31 (D-130): abre o ajuste de uma peça — a MESMA peça volta a um setor de produção com o destino final (estoque · pedido [volta ao pedido / reentrega] · terceirizado · loja · danificados), aplicado ao concluir (a EXPEDIÇÃO — D-127). De onde: em decisão pós devolução, ESTOQUE (livre), Pedidos em aguardo ou já entregue. Gate do PCP/logística.';

-- A decisão da logística (D-129), para uma ou várias peças da devolução.
create or replace function public.plt_fn_devolucao_decidir(
  p_pecas      bigint[],
  p_decisao    text,
  p_destino    jsonb default '{}'::jsonb,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario   uuid;
  v_dev       bigint;
  v_estoque   bigint;
  v_aguardo   bigint;
  v_peca      public.plt_cards%rowtype;
  v_pc        public.plt_cards%rowtype;
  v_numero    integer;
  v_feitas    integer := 0;
  v_repetidas integer := 0;
  v_relancados bigint[] := '{}';
  v_reabertos bigint[] := '{}';
  v_pedidos   bigint[] := '{}';
  v_marca_d   text;
  v_marca_e   text;
  v_extra     jsonb;
  v_etapa     bigint;
  v_id        bigint;
  v_pid       bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null or not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Decidir a devolução é gesto da logística ou de admin.' using errcode = 'insufficient_privilege';
  end if;
  if p_decisao not in ('reenviar', 'estoque', 'realocar', 'danificados', 'loja', 'ajuste') then
    raise exception 'Decisão desconhecida.' using errcode = 'check_violation';
  end if;
  if p_pecas is null or array_length(p_pecas, 1) is null or array_length(p_pecas, 1) > 50 then
    raise exception 'Escolha de 1 a 50 peças.' using errcode = 'check_violation';
  end if;
  if p_decisao = 'realocar' and array_length(p_pecas, 1) <> 1 then
    raise exception 'Realocar é uma peça por vez (cada uma vai para uma vaga).' using errcode = 'check_violation';
  end if;
  select s.id into v_dev from public.plt_setores s where s.codigo = 'devolucao';
  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';
  select s.id into v_aguardo from public.plt_setores s where s.codigo = 'aguardo';

  v_marca_d := current_setting('plt.devolucao_maquinaria', true);
  v_marca_e := current_setting('plt.entrega_maquinaria', true);
  perform set_config('plt.devolucao_maquinaria', 'on', true);

  foreach v_id in array p_pecas loop
    select * into v_peca from public.plt_cards where id = v_id and tipo = 'unidade' for update;
    if not found then
      raise exception 'Peça % não existe.', v_id using errcode = 'no_data_found';
    end if;
    if v_peca.arquivado_em is not null or v_peca.setor_atual_id is distinct from v_dev
       or exists (select 1 from public.plt_etapas e where e.id = v_peca.etapa_atual_id and e.eh_danificado) then
      -- Lei §10: o mesmo toque repetido (a mesma decisão, da mesma pessoa, há pouco) = um efeito só.
      if exists (select 1 from public.plt_eventos d
                  where d.card_id = v_id and d.tipo = 'devolucao_decidida' and d.usuario_id = v_usuario
                    and d.dados ->> 'decisao' = p_decisao and d.ocorrido_em > now() - interval '10 minutes') then
        v_repetidas := v_repetidas + 1;
        continue;
      end if;
      raise exception 'A peça % não está mais em decisão pós devolução (alguém pode ter decidido antes).', v_id
        using errcode = 'check_violation';
    end if;
    select * into v_pc from public.plt_cards where pedido_id = v_peca.pedido_id and tipo = 'pedido';
    select p.numero into v_numero from public.pedidos p where p.id = v_peca.pedido_id;
    v_extra := '{}'::jsonb;

    if p_decisao = 'reenviar' then
      if plt_privado.fn_pedido_cancelado(v_peca.pedido_id) then
        raise exception 'O pedido % foi cancelado no Tiny — escolha outro destino para a peça.', v_numero
          using errcode = 'check_violation';
      end if;
      if coalesce(v_peca.qualidade_atual, 'perfeito') <> 'perfeito' then
        raise exception 'Peça marcada com defeito não volta para o cliente — escolha Danificados ou Ajuste.'
          using errcode = 'check_violation';
      end if;
      if v_pc.entrega_evento_id is not null and not (v_pc.id = any (v_reabertos)) then
        perform set_config('plt.entrega_maquinaria', 'on', true);
        perform plt_privado.fn_reabrir_para_reentrega(v_pc.id, v_usuario, 'peça devolvida reenviada ao cliente');
        v_reabertos := array_append(v_reabertos, v_pc.id);
      end if;
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, setor_destino_id, observacao, dados)
        values (v_id, 'movimentacao_setor', v_usuario, 'interface', v_dev, v_peca.etapa_atual_id, v_aguardo,
                'Reenviar ao cliente: a peça voltou para Pedidos em aguardo.', jsonb_build_object('motivo', 'reenvio'));

    elsif p_decisao in ('estoque', 'realocar') then
      if coalesce(v_peca.qualidade_atual, 'perfeito') <> 'perfeito' then
        raise exception 'Peça marcada com defeito não entra no ESTOQUE — escolha Danificados ou Ajuste.'
          using errcode = 'check_violation';
      end if;
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
        values (v_id, 'unidade_desvinculada', v_usuario, 'interface',
                'Devolvida: a peça ficou sem dono — vai para o ESTOQUE.',
                jsonb_build_object('motivo', 'devolucao', 'pedido_id', v_peca.pedido_id, 'numero', v_numero,
                                   'card_pedido_id', v_pc.id,
                                   'produto_tiny_id', plt_privado.fn_produto_do_item(v_peca.item_codigo, v_peca.item_descricao)));
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, setor_destino_id, observacao, dados)
        values (v_id, 'movimentacao_setor', v_usuario, 'interface', v_dev, v_peca.etapa_atual_id, v_estoque,
                'Devolvida: a peça foi para o ESTOQUE, livre.', jsonb_build_object('motivo', 'devolucao'));
      if p_decisao = 'realocar' then
        v_pid := public.plt_fn_alocar_peca((p_destino ->> 'card_pedido_id')::bigint,
                                           (p_destino ->> 'item_seq')::int,
                                           (p_destino ->> 'indice_unidade')::int, v_id);
        v_extra := jsonb_build_object('card_pedido_destino_id', (p_destino ->> 'card_pedido_id')::bigint,
                                      'nova_unidade_id', v_pid,
                                      'numero_destino', (select p.numero from public.plt_cards pc2 join public.pedidos p on p.id = pc2.pedido_id
                                                          where pc2.id = (p_destino ->> 'card_pedido_id')::bigint));
      end if;

    elsif p_decisao = 'danificados' then
      v_etapa := plt_privado.fn_garantir_etapa_danificado(v_dev);
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id, observacao, dados)
        values (v_id, 'movimentacao_etapa', v_usuario, 'interface', v_dev, v_peca.etapa_atual_id, v_dev, v_etapa,
                'Devolvida danificada — segue pelos Danificados.', jsonb_build_object('motivo', 'devolucao'));

    elsif p_decisao = 'loja' then
      perform set_config('plt.entrega_maquinaria', 'on', true);
      insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
        values (v_id, 'card_arquivado', v_usuario, 'interface',
                'Liberada para o estoque da loja — saiu das contas da fábrica.',
                jsonb_build_object('motivo', 'loja', 'devolucao_evento_id', v_pc.devolucao_evento_id, 'numero', v_numero));

    else -- ajuste
      perform public.plt_fn_ajuste_abrir(v_id, (p_destino ->> 'setor_id')::bigint,
                                         p_destino ->> 'destino_final', p_destino ->> 'descricao');
      v_extra := jsonb_build_object('setor_id', (p_destino ->> 'setor_id')::bigint,
                                    'destino_final', p_destino ->> 'destino_final');
    end if;

    insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
      values (v_id, 'devolucao_decidida', v_usuario, 'interface',
              coalesce(nullif(btrim(p_observacao), ''), null),
              jsonb_build_object('decisao', p_decisao, 'devolucao_evento_id', v_pc.devolucao_evento_id,
                                 'card_pedido_id', v_pc.id, 'numero', v_numero) || v_extra);
    v_feitas := v_feitas + 1;
    if not (v_pc.id = any (v_pedidos)) then
      v_pedidos := array_append(v_pedidos, v_pc.id);
    end if;
  end loop;

  perform set_config('plt.devolucao_maquinaria', coalesce(v_marca_d, ''), true);
  perform set_config('plt.entrega_maquinaria', coalesce(v_marca_e, ''), true);

  -- Reenviar: o que falta entregar todo pronto → o pedido volta à ROTAS → Programar.
  if p_decisao = 'reenviar' then
    foreach v_id in array v_pedidos loop
      if plt_privado.fn_relancar_se_completo(v_id) then
        v_relancados := array_append(v_relancados, v_id);
      end if;
    end loop;
  end if;

  return jsonb_build_object('decididas', v_feitas, 'repetidas', v_repetidas,
                            'relancados', to_jsonb(v_relancados), 'reabertos', to_jsonb(v_reabertos));
end;
$$;

comment on function public.plt_fn_devolucao_decidir(bigint[], text, jsonb, text) is
  'SESSAO-31 (D-129): a decisão da logística sobre as peças em decisão pós devolução — reenviar (volta ao aguardo; pedido entregue: reentrega, só na plataforma; completo → ROTAS sozinho) · estoque (livre) · realocar (p_destino {card_pedido_id, item_seq, indice_unidade} — vira a unidade de outro pedido, pronta) · danificados · loja (sai das contas) · ajuste (p_destino {setor_id, destino_final, descricao} — D-130). Repetir a mesma decisão em 10 min = um efeito só.';

-- O botão antigo do entregador sai (D-129) — a porta dele também.
drop function if exists public.plt_fn_entrega_devolvida(bigint, text);

-- ----------------------------------------------------------------------------
-- 19 · Concluir produção (recriada da 66): a peça em ajuste vai para o destino final (D-130)
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

  -- SESSAO-31 (D-130): a peça em AJUSTE vai para o destino final que o PCP
  -- escolheu ao abrir o ajuste (estoque, volta ao pedido, terceirizado, loja,
  -- danificados) — o resto do concluir é o de sempre.
  if v_card.ajuste_destino is not null then
    return plt_privado.fn_ajuste_concluir(p_card_id, p_estado_qualidade, p_observacao, p_operador_id);
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
  'SESSAO-24/31: conclui a peça — pedido vivo vai para Pedidos em aguardo; peça sem pedido ou de pedido cancelado vai para o ESTOQUE, sem dono; peça em AJUSTE vai para o destino final do ajuste (D-130). O estado vai quando vem (D-126). Devolve o destino (aguardo | estoque | terceirizado | loja | danificados).';


-- ----------------------------------------------------------------------------
-- 20 · Permissões: maquinaria fora da API (E-11); portas para authenticated
-- ----------------------------------------------------------------------------
revoke all on function plt_privado.fn_projetar_devolucao()                                   from public, anon, authenticated;
revoke all on function plt_privado.fn_validar_devolucao()                                    from public, anon, authenticated;
revoke all on function plt_privado.fn_unidades_ja_entregues(bigint)                          from public, anon, authenticated;
revoke all on function plt_privado.fn_unidades_a_entregar(bigint)                            from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_contar(bigint)                                 from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_numeros_cards_ins()                            from public, anon, authenticated;
revoke all on function plt_privado.fn_estoque_numeros_cards_del()                            from public, anon, authenticated;
revoke all on function plt_privado.fn_avisar_logistica(bigint, bigint, text, text, text, uuid) from public, anon, authenticated;
revoke all on function plt_privado.fn_reabrir_para_reentrega(bigint, uuid, text)             from public, anon, authenticated;
revoke all on function plt_privado.fn_relancar_se_completo(bigint)                           from public, anon, authenticated;
revoke all on function plt_privado.fn_ajuste_concluir(bigint, text, text, uuid)              from public, anon, authenticated;

revoke all on function public.plt_fn_pedido_devolver(bigint, bigint, text, bigint[])         from public, anon;
grant execute on function public.plt_fn_pedido_devolver(bigint, bigint, text, bigint[])      to authenticated;
revoke all on function public.plt_fn_devolucoes(bigint, bigint, integer)                     from public, anon;
grant execute on function public.plt_fn_devolucoes(bigint, bigint, integer)                  to authenticated;
revoke all on function public.plt_fn_devolucao_detalhe(bigint)                               from public, anon;
grant execute on function public.plt_fn_devolucao_detalhe(bigint)                            to authenticated;
revoke all on function public.plt_fn_devolucao_realocar_opcoes(bigint)                       from public, anon;
grant execute on function public.plt_fn_devolucao_realocar_opcoes(bigint)                    to authenticated;
revoke all on function public.plt_fn_ajuste_abrir(bigint, bigint, text, text)               from public, anon;
grant execute on function public.plt_fn_ajuste_abrir(bigint, bigint, text, text)            to authenticated;
revoke all on function public.plt_fn_devolucao_decidir(bigint[], text, jsonb, text)          from public, anon;
grant execute on function public.plt_fn_devolucao_decidir(bigint[], text, jsonb, text)       to authenticated;
revoke all on function public.plt_fn_motivo_salvar(bigint, text, text, integer, boolean)     from public, anon;
grant execute on function public.plt_fn_motivo_salvar(bigint, text, text, integer, boolean)  to authenticated;
revoke all on function public.plt_fn_concluir_producao(bigint, text, text, uuid)             from public, anon;
grant execute on function public.plt_fn_concluir_producao(bigint, text, text, uuid)          to authenticated;

-- ----------------------------------------------------------------------------
-- 21 · Os números do estoque recontados pela regra nova (em_devolucao) e o
--      check de tipos validado aqui (E-19: o mais novo valida)
-- ----------------------------------------------------------------------------
select plt_privado.fn_estoque_numeros_recontar();
alter table public.plt_eventos validate constraint plt_eventos_tipo_check;
