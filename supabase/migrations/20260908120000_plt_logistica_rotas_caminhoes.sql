-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 25 — LOGÍSTICA, ROTAS E CAMINHÕES
-- Sessão: SESSAO-15 · Data: 2026-09-08 (Bloco 3 — a reforma, D-35)
--
-- O fim de linha vira módulo de verdade (D-38/D-39/D-45):
--
--   1. ESTOQUE consultável: unidade parada ganha ID DE PRODUÇÃO digitável
--      (formato livre — Q-63 segue aberta), editado pela logística/admin.
--   2. PEDIDOS EM AGUARDO: unidades que chegaram em terminal esperam o pedido
--      ficar completo; completo → LANÇAR PARA ROTAS (evento
--      `pedido_lancado_rotas` no card de pedido + movimentação real das
--      unidades do ESTOQUE para o setor ROTAS). Só o lançado aparece nas ROTAS.
--   3. DANIFICADOS: tudo em etapa DANIFICADO, com o relato da marcação (D-09);
--      resolver = marcar o estado + mover (qualquer destino); arquivar =
--      exclusão lógica (logística e admin).
--   4. ROTAS com PROGRAMAÇÃO: pedido lançado ganha data + caminhão
--      (reprogramável até ser entregue); cache de geocodificação para o mapa.
--   5. CAMINHÕES: cadastro do admin; em uso não se exclui — arquiva.
--   6. Metas (pendência da S14, D-45): edição/encerramento só de quem criou e
--      etapa opcional na meta de unidades ("concluir X cards na etapa Y").
--
-- Mais duas correções de espelho/produção descobertas em 08/09:
--   · `pedidos.situacao` guarda a DESCRIÇÃO ("Cancelado", "Entregue"…), não o
--     código v2 — a detecção de cancelamento da S09 comparava com 'cancelado'
--     e nunca disparava. Aqui a comparação passa a ser NORMALIZADA.
--   · a guarda do gatilho de inserção foi corrigida em produção com
--     translate(...) (nota do backfill) e o repositório não a espelhava.
--
-- Nada aqui altera as tabelas da integração (clientes, pedidos, pedido_itens,
-- eventos, gp_pcp_processados) — só o gatilho da plataforma sobre `pedidos`,
-- que já existia, é recriado.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0 · Situação normalizada: "Não entregue" → nao_entregue (vale para os dois
--     vocabulários — descrição e código v2)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_situacao_normalizada(p_situacao text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select translate(lower(coalesce(p_situacao, '')),
                   'áàâãéêíìóôõúùüç ', 'aaaaeeiiooouuuc_');
$$;

comment on function plt_privado.fn_situacao_normalizada(text) is
  'SESSAO-15: pedidos.situacao guarda a DESCRIÇÃO do Tiny ("Cancelado", "Não entregue"). Todo filtro por situação passa por aqui.';

revoke all on function plt_privado.fn_situacao_normalizada(text) from public, anon, authenticated;

-- Quem é "logística" (D-22/D-25): admin, gente da entrada (o PCP É a
-- logística) e dos terminais — por pessoa, para valer dentro de trigger.
create or replace function plt_privado.fn_eh_logistica(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.plt_usuarios u
                  where u.id = p_usuario and u.ativo and u.papel = 'admin')
      or exists (select 1
                   from public.plt_usuario_setores us
                   join public.plt_usuarios u on u.id = us.usuario_id and u.ativo
                   join public.plt_setores  s on s.id = us.setor_id
                  where us.usuario_id = p_usuario
                    and s.papel_no_fluxo in ('entrada', 'terminal'));
$$;

revoke all on function plt_privado.fn_eh_logistica(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1 · Vocabulário: o lançamento para ROTAS é evento (append-only como sempre)
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
      'card_criado',
      'movimentacao_setor',
      'movimentacao_etapa',
      'execucao_iniciada',
      'execucao_finalizada',
      'qualidade_marcada',
      'qualidade_parecer',
      'divergencia_registrada',
      'notificacao_enviada',
      'delegacao',
      'estorno',
      'pedido_atualizado',
      'pedido_cancelado',
      'card_arquivado',
      'pedido_entregue',
      'pedido_lancado_rotas'  -- SESSAO-15: o pedido completo foi lançado para as ROTAS
    )) not valid;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2 · Reação ao pedido (S09) com a situação NORMALIZADA — corpo idêntico ao da
--     migration 17 fora a detecção de cancelamento
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
  'SESSAO-09/D-31: pedido novo em `pedidos` vira card no PCP; atualização com produção vira evento; cancelamento avisa admins. SESSAO-15: situação comparada NORMALIZADA (o Tiny grava a descrição). À prova de falha: erro aqui NUNCA propaga para fn_upsert_pedido.';

-- ----------------------------------------------------------------------------
-- 3 · Os dois gatilhos blindados sobre `pedidos`, com a guarda que produção
--     já tem (translate — nota do backfill, lição 3). Espelho fiel.
-- ----------------------------------------------------------------------------
drop trigger if exists plt_pedidos_reagir on public.pedidos;
drop trigger if exists plt_pedidos_reagir_insercao on public.pedidos;
drop trigger if exists plt_pedidos_reagir_atualizacao on public.pedidos;

create trigger plt_pedidos_reagir_insercao
  after insert on public.pedidos
  for each row
  when (
    new.origem is not distinct from 'webhook'
    and translate(lower(coalesce(new.situacao, '')),
                  'áàâãéêíìóôõúùüç ', 'aaaaeeiiooouuuc_')
        not in ('entregue', 'nao_entregue', 'cancelado')
  )
  execute function plt_privado.fn_reagir_pedido();

create trigger plt_pedidos_reagir_atualizacao
  after update on public.pedidos
  for each row
  execute function plt_privado.fn_reagir_pedido();

comment on trigger plt_pedidos_reagir_insercao on public.pedidos is
  'Entrada automática (D-31) com a blindagem do backfill: só venda ao vivo (webhook, não encerrada) vira card no PCP. Guarda normalizada (descrição OU código) — espelho de produção (SESSAO-15).';
comment on trigger plt_pedidos_reagir_atualizacao on public.pedidos is
  'Atualização de pedido reage sem guarda — UPDATE nunca cria card.';

-- ----------------------------------------------------------------------------
-- 4 · plt_cards: o ID de produção do Estoque e a projeção do lançamento
-- ----------------------------------------------------------------------------
alter table public.plt_cards
  add column if not exists id_producao text,
  add column if not exists lancado_rotas_em timestamptz;

comment on column public.plt_cards.id_producao is
  'SESSAO-15 (D-38): ID de produção digitável da unidade parada no ESTOQUE — formato livre (Q-63 aberta). Editado pela logística/admin via plt_fn_definir_id_producao; não é projeção de evento.';
comment on column public.plt_cards.lancado_rotas_em is
  'SESSAO-15 (D-45): projeção do evento pedido_lancado_rotas no card de PEDIDO. Só o lançado aparece nas ROTAS.';

create index if not exists plt_cards_id_producao_idx
  on public.plt_cards (lower(id_producao)) where id_producao is not null;
create index if not exists plt_cards_lancado_idx
  on public.plt_cards (lancado_rotas_em) where tipo = 'pedido' and lancado_rotas_em is not null;

-- A projeção ganha o lançamento — e concluido_em passa a ser VERDADE atual:
-- unidade que volta de terminal para produção deixa de estar "concluída".
create or replace function plt_privado.fn_projetar_posicao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terminal boolean;
begin
  if new.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa') then
    select s.papel_no_fluxo = 'terminal'
      into v_terminal
      from public.plt_setores s
     where s.id = coalesce(new.setor_destino_id,
                           (select c.setor_atual_id from public.plt_cards c where c.id = new.card_id));

    update public.plt_cards
       set setor_atual_id = coalesce(new.setor_destino_id, setor_atual_id),
           etapa_atual_id = new.etapa_destino_id,
           desde          = new.ocorrido_em,
           executor_atual_id = null,
           responsavel_id = case when new.tipo = 'movimentacao_setor'
                                 then null else responsavel_id end,
           -- SESSAO-15: concluído = está num terminal AGORA (D-13); saiu de
           -- lá (danificado resolvido, ajuste manual), volta a "em produção".
           concluido_em   = case when coalesce(v_terminal, false)
                                 then coalesce(concluido_em, new.ocorrido_em)
                                 else null end
     where id = new.card_id;

  elsif new.tipo = 'execucao_iniciada' then
    update public.plt_cards
       set executor_atual_id = new.usuario_id
     where id = new.card_id;

  elsif new.tipo = 'execucao_finalizada' then
    update public.plt_cards
       set executor_atual_id = null
     where id = new.card_id;

  elsif new.tipo = 'estorno' then
    update public.plt_cards
       set executor_atual_id = plt_privado.fn_executor_pelo_log(new.card_id)
     where id = new.card_id;

  elsif new.tipo in ('qualidade_marcada', 'qualidade_parecer') then
    update public.plt_cards
       set qualidade_atual = new.estado_qualidade
     where id = new.card_id;

  elsif new.tipo = 'card_arquivado' then
    update public.plt_cards
       set arquivado_em = new.ocorrido_em,
           executor_atual_id = null
     where id = new.card_id;

  elsif new.tipo = 'delegacao' then
    update public.plt_cards
       set responsavel_id = nullif(new.dados ->> 'responsavel_id', '')::uuid
     where id = new.card_id;

  elsif new.tipo = 'pedido_lancado_rotas' then
    -- SESSAO-15 (D-45): o card de pedido passa a existir para as ROTAS.
    update public.plt_cards
       set lancado_rotas_em = new.ocorrido_em
     where id = new.card_id;
  end if;

  return null;
end;
$$;

comment on function plt_privado.fn_projetar_posicao() is
  'Único lugar que escreve a posição do card. Reage a evento inserido; nunca o contrário. Projeta arquivamento (S11), responsável (S12) e lançamento para ROTAS (S15); concluido_em reflete SÓ o terminal atual.';

-- ----------------------------------------------------------------------------
-- 5 · Quem pode arquivar/entregar/lançar (BEFORE — vale para todo escritor)
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
begin
  if new.tipo = 'card_arquivado' then
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
        if not (coalesce(v_danificado, false) and plt_privado.fn_eh_logistica(new.usuario_id)) then
          raise exception 'Arquivar card é gesto de admin ou da integração — a logística arquiva só peças em DANIFICADO.'
            using errcode = 'insufficient_privilege';
        end if;
      end if;
    end if;

  elsif new.tipo = 'pedido_entregue' then
    if new.usuario_id is null then
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
-- 6 · Caminhões (D-39): cadastro do admin; em uso não se exclui — arquiva
-- ----------------------------------------------------------------------------
create table if not exists public.plt_caminhoes (
  id             bigint generated always as identity primary key,
  nome           text not null,
  placa          text,
  capacidade     text,
  foto_caminho   text,
  arquivado_em   timestamptz,
  criado_por_id  uuid references public.plt_usuarios(id),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

comment on table public.plt_caminhoes is
  'Caminhões da logística (SESSAO-15/D-39): nome/apelido, placa, capacidade em texto livre e foto no bucket plt-imagens (caminhoes/{id}/…). Em uso não se exclui — arquiva.';

create unique index if not exists plt_caminhoes_placa_uq
  on public.plt_caminhoes (upper(placa)) where placa is not null and btrim(placa) <> '';

drop trigger if exists plt_caminhoes_atualizacao on public.plt_caminhoes;
create trigger plt_caminhoes_atualizacao
  before update on public.plt_caminhoes
  for each row execute function plt_privado.fn_marcar_atualizacao();

-- Excluir só o que nunca foi usado (D-39) — a tela oferece arquivar.
create or replace function plt_privado.fn_bloquear_exclusao_caminhao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.plt_programacoes pr where pr.caminhao_id = old.id) then
    raise exception 'Este caminhão já tem entregas programadas — arquive em vez de excluir.'
      using errcode = 'foreign_key_violation';
  end if;
  return old;
end;
$$;

revoke all on function plt_privado.fn_bloquear_exclusao_caminhao() from public, anon, authenticated;

-- Todo gesto no cadastro vira trilha (D-40).
create or replace function plt_privado.fn_logar_caminhao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_acao text;
  v_id   bigint;
begin
  if tg_op = 'INSERT' then
    v_acao := 'caminhao_criado';
    v_id := new.id;
  elsif tg_op = 'DELETE' then
    v_acao := 'caminhao_excluido';
    v_id := old.id;
  elsif new.arquivado_em is not null and old.arquivado_em is null then
    v_acao := 'caminhao_arquivado';
    v_id := new.id;
  elsif new.arquivado_em is null and old.arquivado_em is not null then
    v_acao := 'caminhao_reativado';
    v_id := new.id;
  else
    v_acao := 'caminhao_alterado';
    v_id := new.id;
  end if;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (plt_privado.fn_usuario_atual(), v_acao,
          jsonb_build_object('caminhao_id', v_id,
                             'nome', coalesce(new.nome, old.nome)));
  return null;
end;
$$;

revoke all on function plt_privado.fn_logar_caminhao() from public, anon, authenticated;

alter table public.plt_caminhoes enable row level security;

drop policy if exists plt_caminhoes_leitura on public.plt_caminhoes;
create policy plt_caminhoes_leitura on public.plt_caminhoes
  for select to authenticated
  using (plt_privado.fn_usuario_atual() is not null);

drop policy if exists plt_caminhoes_admin_insere on public.plt_caminhoes;
create policy plt_caminhoes_admin_insere on public.plt_caminhoes
  for insert to authenticated
  with check (plt_privado.fn_eh_admin());

drop policy if exists plt_caminhoes_admin_edita on public.plt_caminhoes;
create policy plt_caminhoes_admin_edita on public.plt_caminhoes
  for update to authenticated
  using (plt_privado.fn_eh_admin())
  with check (plt_privado.fn_eh_admin());

drop policy if exists plt_caminhoes_admin_exclui on public.plt_caminhoes;
create policy plt_caminhoes_admin_exclui on public.plt_caminhoes
  for delete to authenticated
  using (plt_privado.fn_eh_admin());

-- ----------------------------------------------------------------------------
-- 7 · Programação de entrega (D-39): pedido lançado × dia × caminhão.
--     Planejamento é EDITÁVEL por natureza (reprogramar a qualquer instante —
--     D-45); a história de cada mudança vai para a trilha de atividade (D-40).
--     Escrita SÓ pelas RPCs (security definer) — nenhuma policy de escrita.
-- ----------------------------------------------------------------------------
create table if not exists public.plt_programacoes (
  id                 bigint generated always as identity primary key,
  card_id            bigint not null unique references public.plt_cards(id),
  data_entrega       date not null,
  caminhao_id        bigint not null references public.plt_caminhoes(id),
  criado_por_id      uuid references public.plt_usuarios(id),
  atualizado_por_id  uuid references public.plt_usuarios(id),
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

comment on table public.plt_programacoes is
  'Programação de caminhão (SESSAO-15/D-39): um pedido lançado, um dia, um caminhão. Reprogramável até a entrega (D-45); cada mudança vai para plt_logs_atividade.';

create index if not exists plt_programacoes_data_idx
  on public.plt_programacoes (data_entrega, caminhao_id);

drop trigger if exists plt_programacoes_atualizacao on public.plt_programacoes;
create trigger plt_programacoes_atualizacao
  before update on public.plt_programacoes
  for each row execute function plt_privado.fn_marcar_atualizacao();

create or replace function plt_privado.fn_logar_programacao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_acao text;
  v_ctx  jsonb;
begin
  if tg_op = 'INSERT' then
    v_acao := 'entrega_programada';
    v_ctx := jsonb_build_object('card_id', new.card_id, 'data', new.data_entrega,
                                'caminhao_id', new.caminhao_id);
  elsif tg_op = 'DELETE' then
    v_acao := 'programacao_removida';
    v_ctx := jsonb_build_object('card_id', old.card_id, 'data', old.data_entrega,
                                'caminhao_id', old.caminhao_id);
  else
    v_acao := 'entrega_reprogramada';
    v_ctx := jsonb_strip_nulls(jsonb_build_object(
      'card_id', new.card_id,
      'data_antes',     case when new.data_entrega is distinct from old.data_entrega then old.data_entrega end,
      'data_depois',    case when new.data_entrega is distinct from old.data_entrega then new.data_entrega end,
      'caminhao_antes', case when new.caminhao_id  is distinct from old.caminhao_id  then old.caminhao_id  end,
      'caminhao_depois',case when new.caminhao_id  is distinct from old.caminhao_id  then new.caminhao_id  end));
  end if;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (plt_privado.fn_usuario_atual(), v_acao, v_ctx);
  return null;
end;
$$;

revoke all on function plt_privado.fn_logar_programacao() from public, anon, authenticated;

drop trigger if exists plt_programacoes_logar on public.plt_programacoes;
create trigger plt_programacoes_logar
  after insert or update or delete on public.plt_programacoes
  for each row execute function plt_privado.fn_logar_programacao();

alter table public.plt_programacoes enable row level security;

drop policy if exists plt_programacoes_leitura on public.plt_programacoes;
create policy plt_programacoes_leitura on public.plt_programacoes
  for select to authenticated
  using (plt_privado.fn_pode_ver_expedicao());

-- Os gatilhos de caminhão dependem de plt_programacoes existir: ligados aqui.
drop trigger if exists plt_caminhoes_bloquear_exclusao on public.plt_caminhoes;
create trigger plt_caminhoes_bloquear_exclusao
  before delete on public.plt_caminhoes
  for each row execute function plt_privado.fn_bloquear_exclusao_caminhao();

drop trigger if exists plt_caminhoes_logar on public.plt_caminhoes;
create trigger plt_caminhoes_logar
  after insert or update or delete on public.plt_caminhoes
  for each row execute function plt_privado.fn_logar_caminhao();

-- ----------------------------------------------------------------------------
-- 8 · Cache de geocodificação (D-39/Q-65): endereço → ponto, gravado UMA vez.
--     Quem escreve é a Edge Function `geocodificar` (chave de serviço), que
--     respeita o Nominatim (1 req/s, User-Agent identificado). O navegador
--     só lê.
-- ----------------------------------------------------------------------------
create table if not exists public.plt_geocache (
  chave          text primary key,
  endereco       text not null,
  latitude       double precision,
  longitude      double precision,
  resolvido      boolean not null default false,
  fonte          text not null default 'nominatim',
  consultado_em  timestamptz not null default now()
);

comment on table public.plt_geocache is
  'Cache de geocodificação aberta (SESSAO-15/Q-65). chave = md5 do endereço normalizado (calculada no banco — plt_fn_programacao). resolvido=false com consultado_em recente = "sem ponto" (não insistir).';

alter table public.plt_geocache enable row level security;

drop policy if exists plt_geocache_leitura on public.plt_geocache;
create policy plt_geocache_leitura on public.plt_geocache
  for select to authenticated
  using (plt_privado.fn_usuario_atual() is not null);

-- O endereço no formato que se manda ao geocodificador — UM lugar só.
create or replace function plt_privado.fn_endereco_geocodificavel(
  p_endereco text, p_numero text, p_bairro text, p_cidade text, p_uf text, p_cep text
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(
           regexp_replace(
             concat_ws(', ',
               nullif(btrim(concat_ws(' ', nullif(btrim(p_endereco), ''), nullif(btrim(p_numero), ''))), ''),
               nullif(btrim(p_bairro), ''),
               nullif(btrim(p_cidade), ''),
               nullif(btrim(p_uf), ''),
               nullif(btrim(p_cep), ''),
               'Brasil'),
             '\s+', ' ', 'g'),
           'Brasil');
$$;

revoke all on function plt_privado.fn_endereco_geocodificavel(text, text, text, text, text, text)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9 · ESTOQUE consultável (D-38) — porta de leitura + o gesto do ID
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_estoque(
  p_busca        text    default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  card_id         bigint,
  id_producao     text,
  item_codigo     text,
  item_descricao  text,
  indice_unidade  integer,
  total_unidades  integer,
  pedido_id       bigint,
  numero          integer,
  origem          text,
  qualidade_atual text,
  desde           timestamptz,
  contagem_total  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with estoque as (
    select s.id from public.plt_setores s where s.codigo = 'estoque'
  )
  select c.id              as card_id,
         c.id_producao,
         c.item_codigo,
         c.item_descricao,
         c.indice_unidade,
         c.total_unidades,
         c.pedido_id,
         p.numero,
         -- Q-23 (produção para estoque) segue aberta: hoje toda unidade nasce de pedido.
         'pedido'::text    as origem,
         c.qualidade_atual,
         c.desde,
         count(*) over ()  as contagem_total
    from public.plt_cards c
    join public.pedidos p on p.id = c.pedido_id
   where plt_privado.fn_pode_ver_expedicao()
     and c.tipo = 'unidade'
     and c.arquivado_em is null
     and c.setor_atual_id in (select id from estoque)
     and (p_busca is null or btrim(p_busca) = ''
          or c.id_producao ilike '%' || btrim(p_busca) || '%'
          or c.item_descricao ilike '%' || btrim(p_busca) || '%'
          or c.item_codigo ilike btrim(p_busca) || '%'
          or p.numero::text like btrim(p_busca) || '%')
   order by c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_estoque(text, integer, integer) is
  'Estoque consultável (SESSAO-15/D-38): unidades paradas no ESTOQUE com ID de produção, produto e desde quando. Gate da logística. Endpoint de propósito.';

create or replace function public.plt_fn_definir_id_producao(
  p_card_id     bigint,
  p_id_producao text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_card    public.plt_cards%rowtype;
  v_novo    text;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma define o ID de produção.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Definir o ID de produção é gesto da logística (PCP/terminais) ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'unidade';
  if not found then
    raise exception 'Unidade % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if v_card.arquivado_em is not null then
    raise exception 'Esta unidade está arquivada — o ID não muda mais.' using errcode = 'check_violation';
  end if;

  v_novo := nullif(btrim(p_id_producao), '');
  if v_novo is not distinct from v_card.id_producao then
    return;
  end if;
  if v_novo is not null and exists (
       select 1 from public.plt_cards c
        where lower(c.id_producao) = lower(v_novo)
          and c.id <> p_card_id and c.arquivado_em is null) then
    raise exception 'Já existe outra unidade com o ID de produção "%". Escolha outro.', v_novo
      using errcode = 'unique_violation';
  end if;

  update public.plt_cards set id_producao = v_novo where id = p_card_id;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_usuario, 'id_producao_definido',
          jsonb_strip_nulls(jsonb_build_object('card_id', p_card_id,
                                               'antes', v_card.id_producao,
                                               'depois', v_novo)));
end;
$$;

comment on function public.plt_fn_definir_id_producao(bigint, text) is
  'O gesto do ID de produção (SESSAO-15/D-38): logística/admin, formato livre, único entre unidades vivas; cada mudança vai para a trilha (D-40).';

-- ----------------------------------------------------------------------------
-- 10 · PEDIDOS EM AGUARDO (D-38/D-45): unidades prontas esperando o pedido
--      completar; completo → lançar para ROTAS
-- ----------------------------------------------------------------------------
-- E-17 aplicado por antecipação: a migration 29 (SESSAO-22) muda a FORMA do
-- retorno — sem este drop, a segunda rodada quebraria em "cannot change return type".
drop function if exists public.plt_fn_pedidos_aguardo(text, integer, integer);

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
  contagem_total          bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pc.id                          as card_id,
         p.id                           as pedido_id,
         p.numero,
         coalesce(c.nome, '')           as cliente_nome,
         p.data_prevista,
         p.situacao,
         coalesce(i.total_unidades, 0)  as total_unidades,
         coalesce(u.liberadas, 0)       as unidades_liberadas,
         coalesce(u.prontas, 0)         as unidades_prontas,
         (coalesce(i.total_unidades, 0) > 0
          and coalesce(u.prontas, 0) >= coalesce(i.total_unidades, 0)) as completo,
         exists (select 1 from public.plt_eventos e
                  where e.card_id = pc.id and e.tipo = 'pedido_atualizado')
                                        as alterado_apos_liberacao,
         count(*) over ()               as contagem_total
    from public.plt_cards pc
    join public.pedidos p on p.id = pc.pedido_id
    left join public.clientes c on c.id = p.cliente_id
    left join lateral (
      select coalesce(sum(case when round(pi.quantidade) >= 1
                               then round(pi.quantidade)::int else 0 end), 0)::int
               as total_unidades
        from public.pedido_itens pi
       where pi.pedido_id = p.id
    ) i on true
    left join lateral (
      -- "pronta" = está num setor TERMINAL agora (D-45)
      select count(*)::int as liberadas,
             count(*) filter (where s.papel_no_fluxo = 'terminal')::int as prontas
        from public.plt_cards cu
        left join public.plt_setores s on s.id = cu.setor_atual_id
       where cu.pedido_id = p.id and cu.tipo = 'unidade'
         and cu.arquivado_em is null
    ) u on true
   where plt_privado.fn_pode_ver_expedicao()
     and pc.tipo = 'pedido'
     and pc.arquivado_em is null
     and pc.lancado_rotas_em is null
     and coalesce(u.prontas, 0) > 0
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.nome ilike '%' || btrim(p_busca) || '%')
   order by (coalesce(i.total_unidades, 0) > 0
             and coalesce(u.prontas, 0) >= coalesce(i.total_unidades, 0)) desc,
            p.data_prevista asc nulls last, p.numero
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_pedidos_aguardo(text, integer, integer) is
  'Pedidos em aguardo (SESSAO-15/D-38): pedidos com unidade pronta (em terminal) ainda não lançados para ROTAS, com (k/n) e a marca de completo. Gate da logística. Endpoint de propósito.';

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
  if exists (select 1 from public.plt_eventos e
              where e.card_id = p_card_id and e.tipo = 'pedido_entregue') then
    raise exception 'Este pedido já foi registrado como entregue.' using errcode = 'check_violation';
  end if;

  select coalesce(sum(case when round(pi.quantidade) >= 1
                           then round(pi.quantidade)::int else 0 end), 0)::int
    into v_total
    from public.pedido_itens pi where pi.pedido_id = v_card.pedido_id;
  select count(*)::int into v_prontas
    from public.plt_cards cu
    join public.plt_setores s on s.id = cu.setor_atual_id
   where cu.pedido_id = v_card.pedido_id and cu.tipo = 'unidade'
     and cu.arquivado_em is null and s.papel_no_fluxo = 'terminal';

  -- D-33/D-45: só pedido COMPLETO vai para as ROTAS.
  if v_total = 0 or v_prontas < v_total then
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

comment on function public.plt_fn_lancar_rotas(bigint) is
  'Lançar para ROTAS (SESSAO-15/D-45): pedido completo ganha o evento pedido_lancado_rotas e as unidades saem do ESTOQUE para o setor ROTAS numa transação. Gate da logística.';

-- ----------------------------------------------------------------------------
-- 11 · DANIFICADOS (D-38/D-45): a lista, resolver e arquivar
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_danificados(
  p_arquivados   boolean default false,
  p_busca        text    default null,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  card_id           bigint,
  pedido_id         bigint,
  numero            integer,
  item_codigo       text,
  item_descricao    text,
  indice_unidade    integer,
  total_unidades    integer,
  setor_id          bigint,
  setor_nome        text,
  etapa_nome        text,
  qualidade_atual   text,
  desde             timestamptz,
  arquivado_em      timestamptz,
  origem_setor_nome text,
  marcacao_estado   text,
  marcacao_por      text,
  marcacao_obs      text,
  marcado_em        timestamptz,
  parecer_estado    text,
  parecer_por       text,
  parecer_obs       text,
  contagem_total    bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id                 as card_id,
         c.pedido_id,
         p.numero,
         c.item_codigo,
         c.item_descricao,
         c.indice_unidade,
         c.total_unidades,
         s.id                 as setor_id,
         s.nome               as setor_nome,
         e.nome               as etapa_nome,
         c.qualidade_atual,
         c.desde,
         c.arquivado_em,
         so.nome              as origem_setor_nome,
         m.estado_qualidade   as marcacao_estado,
         um.nome              as marcacao_por,
         m.observacao         as marcacao_obs,
         m.ocorrido_em        as marcado_em,
         pr.estado_qualidade  as parecer_estado,
         up.nome              as parecer_por,
         pr.observacao        as parecer_obs,
         count(*) over ()     as contagem_total
    from public.plt_cards c
    join public.plt_etapas  e on e.id = c.etapa_atual_id and e.eh_danificado
    join public.plt_setores s on s.id = c.setor_atual_id
    join public.pedidos     p on p.id = c.pedido_id
    -- o relato da D-09: a última marcação de quem entregou…
    left join lateral (
      select ev.* from public.plt_eventos ev
       where ev.card_id = c.id and ev.tipo = 'qualidade_marcada'
       order by ev.ocorrido_em desc, ev.id desc limit 1
    ) m on true
    left join public.plt_setores  so on so.id = m.setor_origem_id
    left join public.plt_usuarios um on um.id = m.usuario_id
    -- …e o parecer de quem recebeu, quando houve
    left join lateral (
      select ev.* from public.plt_eventos ev
       where ev.tipo = 'qualidade_parecer' and ev.evento_referencia_id = m.id
       order by ev.id desc limit 1
    ) pr on true
    left join public.plt_usuarios up on up.id = pr.usuario_id
   where plt_privado.fn_pode_ver_expedicao()
     and c.tipo = 'unidade'
     and ((coalesce(p_arquivados, false) and c.arquivado_em is not null)
          or (not coalesce(p_arquivados, false) and c.arquivado_em is null))
     and (p_busca is null or btrim(p_busca) = ''
          or p.numero::text like btrim(p_busca) || '%'
          or c.item_descricao ilike '%' || btrim(p_busca) || '%'
          or s.nome ilike '%' || btrim(p_busca) || '%')
   order by case when coalesce(p_arquivados, false) then c.arquivado_em end desc nulls last,
            c.desde asc nulls last, c.id
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_danificados(boolean, text, integer, integer) is
  'Danificados (SESSAO-15/D-38): unidades em etapa DANIFICADO com origem, relato da marcação/parecer (D-09) e tempo parado; p_arquivados=true lista os arquivados (carregado só ao clicar — D-45). Gate da logística.';

create or replace function public.plt_fn_resolver_danificado(
  p_card_id          bigint,
  p_setor_destino_id bigint,
  p_etapa_destino_id bigint default null,
  p_estado_qualidade text   default null,
  p_observacao       text   default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario     uuid;
  v_card        public.plt_cards%rowtype;
  v_danificado  boolean;
  v_marcacao_id bigint;
  v_evento_id   bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma resolve danificados.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Resolver danificado é gesto da logística (PCP/terminais) ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards
   where id = p_card_id and tipo = 'unidade' and arquivado_em is null;
  if not found then
    raise exception 'Unidade % não existe ou já foi arquivada.', p_card_id using errcode = 'no_data_found';
  end if;
  select e.eh_danificado into v_danificado from public.plt_etapas e where e.id = v_card.etapa_atual_id;
  if not coalesce(v_danificado, false) then
    raise exception 'Esta peça não está em DANIFICADO.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.plt_setores s where s.id = p_setor_destino_id and s.ativo) then
    raise exception 'Setor de destino não existe ou está inativo.' using errcode = 'no_data_found';
  end if;
  if p_etapa_destino_id is not null and not exists (
       select 1 from public.plt_etapas e
        where e.id = p_etapa_destino_id and e.setor_id = p_setor_destino_id and e.ativa) then
    raise exception 'A etapa escolhida não pertence ao setor de destino.' using errcode = 'check_violation';
  end if;

  if v_card.setor_atual_id = p_setor_destino_id then
    -- Mesmo setor: volta para uma etapa dele, sem qualidade (D-25).
    if v_card.etapa_atual_id is not distinct from p_etapa_destino_id then
      raise exception 'A peça já está aí — escolha outro destino.' using errcode = 'check_violation';
    end if;
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem,
         setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id, observacao)
      values
        (p_card_id, 'movimentacao_etapa', v_usuario, 'interface',
         v_card.setor_atual_id, v_card.etapa_atual_id, p_setor_destino_id, p_etapa_destino_id,
         coalesce(nullif(btrim(p_observacao), ''), 'Resolvido em DANIFICADO.'))
      returning id into v_evento_id;
    return v_evento_id;
  end if;

  -- Outro setor: a marcação do estado é obrigatória (D-45 — pode sair 🟡/🔴).
  if p_estado_qualidade is null then
    raise exception 'Resolver exige marcar o estado da peça: 🟢 perfeito estado · 🟡 estado de atenção · 🔴 danificado.'
      using errcode = 'check_violation';
  end if;
  insert into public.plt_eventos
      (card_id, tipo, usuario_id, origem,
       setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id,
       estado_qualidade, observacao)
    values
      (p_card_id, 'qualidade_marcada', v_usuario, 'interface',
       v_card.setor_atual_id, v_card.etapa_atual_id, p_setor_destino_id, p_etapa_destino_id,
       p_estado_qualidade, coalesce(nullif(btrim(p_observacao), ''), 'Resolvido em DANIFICADO.'))
    returning id into v_marcacao_id;

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

comment on function public.plt_fn_resolver_danificado(bigint, bigint, bigint, text, text) is
  'Resolvido → destino (SESSAO-15/D-38/D-45): Estoque, ROTAS ou qualquer setor; para outro setor a marcação do estado é obrigatória (D-09). Gate da logística.';

create or replace function public.plt_fn_arquivar_card(
  p_card_id    bigint,
  p_observacao text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario   uuid;
  v_card      public.plt_cards%rowtype;
  v_evento_id bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma arquiva cards.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if v_card.arquivado_em is not null then
    raise exception 'Este card já está arquivado.' using errcode = 'check_violation';
  end if;

  -- Quem pode é regra do trigger (fn_validar_api): admin, ou logística em DANIFICADO.
  insert into public.plt_eventos
      (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao)
    values
      (p_card_id, 'card_arquivado', v_usuario, 'interface',
       v_card.setor_atual_id, v_card.etapa_atual_id, nullif(btrim(p_observacao), ''))
    returning id into v_evento_id;
  return v_evento_id;
end;
$$;

comment on function public.plt_fn_arquivar_card(bigint, text) is
  'Arquivar pela interface (SESSAO-15): exclusão lógica por evento — sai da lista, fica na história. Gate no trigger: admin, ou logística em peça DANIFICADA (D-45).';

-- ----------------------------------------------------------------------------
-- 12 · ROTAS (D-33/D-45): só o LANÇADO aparece; a entrega exige lançamento;
--      o card mostra dia e caminhão programados
-- ----------------------------------------------------------------------------
drop function if exists public.plt_fn_rotas(text, text, integer, integer);

create or replace function public.plt_fn_rotas(
  p_situacao      text default null, -- 'pronta' | 'entregue'
  p_busca         text default null,
  p_limite        integer default 20,
  p_deslocamento  integer default 0
)
returns table (
  card_id           bigint,
  pedido_id         bigint,
  numero            integer,
  cliente_nome      text,
  telefone          text,
  endereco          text,
  numero_endereco   text,
  complemento       text,
  bairro            text,
  cidade            text,
  uf                text,
  obs               text,
  data_prevista     date,
  total_unidades    integer,
  unidades_em_rotas integer,
  situacao_entrega  text,
  entregue_em       timestamptz,
  entregue_por      text,
  lancado_em        timestamptz,
  programacao_data  date,
  caminhao_id       bigint,
  caminhao_nome     text,
  caminhao_placa    text,
  caminhao_foto     text,
  contagem_total    bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with rotas as (
    select s.id from public.plt_setores s where s.codigo = 'rotas'
  ),
  base as (
    select pc.id                        as card_id,
           p.id                         as pedido_id,
           p.numero,
           coalesce(c.nome, '')         as cliente_nome,
           c.fone                       as telefone,
           c.endereco,
           c.numero                     as numero_endereco,
           c.complemento,
           c.bairro,
           c.cidade,
           c.uf,
           p.obs,
           p.data_prevista,
           coalesce(i.total_unidades, 0) as total_unidades,
           coalesce(u.em_rotas, 0)       as unidades_em_rotas,
           ent.ocorrido_em               as entregue_em,
           ent_nome.nome                 as entregue_por,
           pc.lancado_rotas_em           as lancado_em,
           pr.data_entrega               as programacao_data,
           cam.id                        as caminhao_id,
           cam.nome                      as caminhao_nome,
           cam.placa                     as caminhao_placa,
           cam.foto_caminho              as caminhao_foto
      from public.plt_cards pc
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join lateral (
        select coalesce(sum(case when round(pi.quantidade) >= 1
                                 then round(pi.quantidade)::int else 0 end), 0)::int
                 as total_unidades
          from public.pedido_itens pi
         where pi.pedido_id = p.id
      ) i on true
      left join lateral (
        select count(*)::int as em_rotas
          from public.plt_cards cu
         where cu.pedido_id = p.id and cu.tipo = 'unidade'
           and cu.arquivado_em is null
           and cu.setor_atual_id in (select id from rotas)
      ) u on true
      left join lateral (
        select e.ocorrido_em, e.usuario_id
          from public.plt_eventos e
         where e.card_id = pc.id and e.tipo = 'pedido_entregue'
         order by e.ocorrido_em desc limit 1
      ) ent on true
      left join public.plt_usuarios ent_nome on ent_nome.id = ent.usuario_id
      left join public.plt_programacoes pr on pr.card_id = pc.id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
     where pc.tipo = 'pedido' and pc.arquivado_em is null
       and pc.lancado_rotas_em is not null   -- D-45: só o lançado
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome, b.telefone,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         b.obs, b.data_prevista, b.total_unidades, b.unidades_em_rotas,
         case when b.entregue_em is not null then 'entregue' else 'pronta' end as situacao_entrega,
         b.entregue_em, b.entregue_por, b.lancado_em,
         b.programacao_data, b.caminhao_id, b.caminhao_nome, b.caminhao_placa, b.caminhao_foto,
         count(*) over () as contagem_total
    from base b
   where plt_privado.fn_pode_ver_expedicao()
     and (p_situacao is null
          or (case when b.entregue_em is not null then 'entregue' else 'pronta' end) = p_situacao)
     and (p_busca is null or btrim(p_busca) = ''
          or b.numero::text like btrim(p_busca) || '%'
          or b.cliente_nome ilike '%' || btrim(p_busca) || '%')
   order by (b.entregue_em is not null),
            coalesce(b.programacao_data, b.data_prevista) asc nulls last,
            b.numero
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_rotas(text, text, integer, integer) is
  'ROTAS (SESSAO-11/D-33, revista na SESSAO-15/D-45): SÓ os pedidos lançados pelos Pedidos em aguardo, com endereço/contato (exceção deliberada — gate da logística) e a programação (dia + caminhão). Endpoint de propósito.';

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
  v_usuario uuid;
  v_card    public.plt_cards%rowtype;
  v_total   integer;
  v_em_rotas integer;
  v_evento_id bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma registra entrega.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Registrar entrega é gesto da logística (PCP/terminais) ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards where id = p_card_id and tipo = 'pedido';
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  -- SESSAO-15 (D-45): entrega só do que foi lançado pelos Pedidos em aguardo.
  if v_card.lancado_rotas_em is null then
    raise exception 'Este pedido ainda não foi lançado para ROTAS — lance pelos Pedidos em aguardo.'
      using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.plt_eventos e
              where e.card_id = p_card_id and e.tipo = 'pedido_entregue') then
    raise exception 'Este pedido já foi registrado como entregue.' using errcode = 'check_violation';
  end if;

  select coalesce(sum(case when round(pi.quantidade) >= 1
                           then round(pi.quantidade)::int else 0 end), 0)::int
    into v_total
    from public.pedido_itens pi where pi.pedido_id = v_card.pedido_id;
  select count(*)::int into v_em_rotas
    from public.plt_cards cu
    join public.plt_setores s on s.id = cu.setor_atual_id
   where cu.pedido_id = v_card.pedido_id and cu.tipo = 'unidade'
     and cu.arquivado_em is null and s.codigo = 'rotas';

  if v_total = 0 or v_em_rotas < v_total then
    raise exception 'A entrega sai por pedido completo: % de % unidade(s) na ROTAS.', v_em_rotas, v_total
      using errcode = 'check_violation';
  end if;

  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados)
       values (p_card_id, 'pedido_entregue', v_usuario, 'interface',
               nullif(btrim(p_observacao), ''),
               jsonb_build_object('unidades', v_em_rotas))
    returning id into v_evento_id;

  return v_evento_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 13 · PROGRAMAÇÃO (D-39): a porta do mapa e os gestos de programar
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_programacao(
  p_data         date    default null,
  p_limite       integer default 100,
  p_deslocamento integer default 0
)
returns table (
  card_id                 bigint,
  pedido_id               bigint,
  numero                  integer,
  cliente_nome            text,
  endereco                text,
  numero_endereco         text,
  complemento             text,
  bairro                  text,
  cidade                  text,
  uf                      text,
  endereco_geocodificavel text,
  geo_chave               text,
  latitude                double precision,
  longitude               double precision,
  geo_resolvido           boolean,
  geo_consultado_em       timestamptz,
  total_unidades          integer,
  data_prevista           date,
  lancado_em              timestamptz,
  programacao_data        date,
  caminhao_id             bigint,
  caminhao_nome           text,
  contagem_total          bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select pc.id                        as card_id,
           p.id                         as pedido_id,
           p.numero,
           coalesce(c.nome, '')         as cliente_nome,
           c.endereco,
           c.numero                     as numero_endereco,
           c.complemento,
           c.bairro,
           c.cidade,
           c.uf,
           plt_privado.fn_endereco_geocodificavel(
             c.endereco, c.numero, c.bairro, c.cidade, c.uf, c.cep) as endereco_geocodificavel,
           coalesce(i.total_unidades, 0) as total_unidades,
           p.data_prevista,
           pc.lancado_rotas_em           as lancado_em,
           pr.data_entrega               as programacao_data,
           cam.id                        as caminhao_id,
           cam.nome                      as caminhao_nome
      from public.plt_cards pc
      join public.pedidos p on p.id = pc.pedido_id
      left join public.clientes c on c.id = p.cliente_id
      left join lateral (
        select coalesce(sum(case when round(pi.quantidade) >= 1
                                 then round(pi.quantidade)::int else 0 end), 0)::int
                 as total_unidades
          from public.pedido_itens pi
         where pi.pedido_id = p.id
      ) i on true
      left join public.plt_programacoes pr on pr.card_id = pc.id
      left join public.plt_caminhoes cam on cam.id = pr.caminhao_id
     where pc.tipo = 'pedido' and pc.arquivado_em is null
       and pc.lancado_rotas_em is not null
       and not exists (select 1 from public.plt_eventos e
                        where e.card_id = pc.id and e.tipo = 'pedido_entregue')
  )
  select b.card_id, b.pedido_id, b.numero, b.cliente_nome,
         b.endereco, b.numero_endereco, b.complemento, b.bairro, b.cidade, b.uf,
         b.endereco_geocodificavel,
         case when b.endereco_geocodificavel is null then null
              else md5(lower(b.endereco_geocodificavel)) end as geo_chave,
         g.latitude, g.longitude,
         g.resolvido       as geo_resolvido,
         g.consultado_em   as geo_consultado_em,
         b.total_unidades, b.data_prevista, b.lancado_em,
         b.programacao_data, b.caminhao_id, b.caminhao_nome,
         count(*) over () as contagem_total
    from base b
    left join public.plt_geocache g
           on b.endereco_geocodificavel is not null
          and g.chave = md5(lower(b.endereco_geocodificavel))
   where plt_privado.fn_pode_ver_expedicao()
     and (b.programacao_data is null or p_data is null or b.programacao_data = p_data)
   order by (b.programacao_data is not null), b.data_prevista asc nulls last, b.numero
   limit least(greatest(coalesce(p_limite, 100), 1), 200)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_programacao(date, integer, integer) is
  'Programação de caminhão (SESSAO-15/D-39): pedidos lançados e não entregues — os SEM programação e os programados no dia pedido — com endereço, chave e ponto do cache de geocodificação. Gate da logística. Endpoint de propósito.';

create or replace function public.plt_fn_programar_entrega(
  p_card_id     bigint,
  p_data        date,
  p_caminhao_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
  v_card    public.plt_cards%rowtype;
  v_id      bigint;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma programa entregas.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Programar entrega é gesto da logística (PCP/terminais) ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_data is null then
    raise exception 'Escolha o dia da entrega.' using errcode = 'check_violation';
  end if;

  select * into v_card from public.plt_cards
   where id = p_card_id and tipo = 'pedido' and arquivado_em is null;
  if not found then
    raise exception 'Card de pedido % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  if v_card.lancado_rotas_em is null then
    raise exception 'Este pedido ainda não foi lançado para ROTAS.' using errcode = 'check_violation';
  end if;
  -- D-45: reprograma a qualquer instante, nunca depois de entregue.
  if exists (select 1 from public.plt_eventos e
              where e.card_id = p_card_id and e.tipo = 'pedido_entregue') then
    raise exception 'Este pedido já foi entregue — a programação não muda mais.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.plt_caminhoes cm
                  where cm.id = p_caminhao_id and cm.arquivado_em is null) then
    raise exception 'Caminhão não encontrado ou arquivado — escolha outro.' using errcode = 'no_data_found';
  end if;

  insert into public.plt_programacoes (card_id, data_entrega, caminhao_id, criado_por_id, atualizado_por_id)
       values (p_card_id, p_data, p_caminhao_id, v_usuario, v_usuario)
  on conflict (card_id) do update
     set data_entrega = excluded.data_entrega,
         caminhao_id  = excluded.caminhao_id,
         atualizado_por_id = excluded.atualizado_por_id
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.plt_fn_programar_entrega(bigint, date, bigint) is
  'Programar/reprogramar (SESSAO-15/D-39/D-45): data + caminhão para um pedido lançado e não entregue. Gate da logística; cada mudança vai para a trilha.';

create or replace function public.plt_fn_desprogramar_entrega(p_card_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
begin
  v_usuario := plt_privado.fn_usuario_atual();
  if v_usuario is null then
    raise exception 'Só usuário ativo da plataforma mexe na programação.' using errcode = 'insufficient_privilege';
  end if;
  if not plt_privado.fn_pode_ver_expedicao() then
    raise exception 'Mexer na programação é gesto da logística (PCP/terminais) ou de admin.'
      using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.plt_eventos e
              where e.card_id = p_card_id and e.tipo = 'pedido_entregue') then
    raise exception 'Este pedido já foi entregue — a programação não muda mais.' using errcode = 'check_violation';
  end if;
  delete from public.plt_programacoes where card_id = p_card_id;
end;
$$;

comment on function public.plt_fn_desprogramar_entrega(bigint) is
  'Tira o pedido da programação (SESSAO-15/D-45): volta para "sem programação"; nunca depois de entregue. Fica na trilha.';

-- ----------------------------------------------------------------------------
-- 14 · Metas (pendência da S14 → D-45): etapa opcional + trava de quem criou
-- ----------------------------------------------------------------------------
alter table public.plt_metas
  add column if not exists etapa_id bigint references public.plt_etapas(id);

comment on column public.plt_metas.etapa_id is
  'D-45: meta de UNIDADES pode mirar uma etapa ("concluir X cards na etapa Y"). NULL = qualquer etapa.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plt_metas_etapa_ck') then
    alter table public.plt_metas add constraint plt_metas_etapa_ck
      check (etapa_id is null or indicador = 'unidades');
  end if;
end;
$$;

create or replace function plt_privado.fn_preparar_meta()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- D-45: a etapa mirada tem que ser do setor da meta (meta pessoal: qualquer).
  if new.etapa_id is not null and new.setor_id is not null and not exists (
       select 1 from public.plt_etapas e where e.id = new.etapa_id and e.setor_id = new.setor_id) then
    raise exception 'A etapa escolhida não pertence ao setor desta meta.';
  end if;

  if tg_op = 'INSERT' then
    new.criada_por_id := coalesce(plt_privado.fn_usuario_atual(), new.criada_por_id);
    new.encerrada_em := null;
    new.encerrada_por_id := null;
    return new;
  end if;

  if old.encerrada_em is not null then
    raise exception 'Esta meta já foi encerrada — para continuar medindo, crie uma meta nova.';
  end if;
  if new.encerrada_em is not null then
    new.encerrada_por_id := coalesce(plt_privado.fn_usuario_atual(), new.encerrada_por_id);
  end if;
  if new.usuario_id is distinct from old.usuario_id or new.setor_id is distinct from old.setor_id then
    raise exception 'O dono da meta não muda — encerre esta e crie uma nova para outra pessoa ou setor.';
  end if;
  return new;
end;
$$;

create or replace function plt_privado.fn_registrar_meta_evento()
returns trigger
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_tipo  text;
  v_autor uuid;
  v_dados jsonb;
begin
  if tg_op = 'INSERT' then
    v_tipo  := 'meta_criada';
    v_autor := coalesce(plt_privado.fn_usuario_atual(), new.criada_por_id);
    v_dados := jsonb_strip_nulls(jsonb_build_object(
      'titulo',     new.titulo,
      'indicador',  new.indicador,
      'periodo',    new.periodo,
      'alvo',       new.alvo,
      'usuario_id', new.usuario_id,
      'setor_id',   new.setor_id,
      'etapa_id',   new.etapa_id
    ));
  elsif new.encerrada_em is not null and old.encerrada_em is null then
    v_tipo  := 'meta_encerrada';
    v_autor := coalesce(plt_privado.fn_usuario_atual(), new.encerrada_por_id);
    v_dados := jsonb_strip_nulls(jsonb_build_object(
      'indicador', new.indicador,
      'periodo',   new.periodo,
      'alvo',      new.alvo
    ));
  else
    v_tipo  := 'meta_alterada';
    v_autor := plt_privado.fn_usuario_atual();
    v_dados := jsonb_strip_nulls(jsonb_build_object(
      'alvo_antes',       case when new.alvo      is distinct from old.alvo      then old.alvo      end,
      'alvo_depois',      case when new.alvo      is distinct from old.alvo      then new.alvo      end,
      'indicador_antes',  case when new.indicador is distinct from old.indicador then old.indicador end,
      'indicador_depois', case when new.indicador is distinct from old.indicador then new.indicador end,
      'periodo_antes',    case when new.periodo   is distinct from old.periodo   then old.periodo   end,
      'periodo_depois',   case when new.periodo   is distinct from old.periodo   then new.periodo   end,
      'etapa_antes',      case when new.etapa_id  is distinct from old.etapa_id  then old.etapa_id  end,
      'etapa_depois',     case when new.etapa_id  is distinct from old.etapa_id  then new.etapa_id  end,
      'etapa_alterada',   case when new.etapa_id  is distinct from old.etapa_id  then true          end,
      'titulo_alterado',  case when new.titulo    is distinct from old.titulo    then true          end
    ));
    if v_dados = '{}'::jsonb then
      return null;
    end if;
  end if;

  insert into public.plt_metas_eventos (meta_id, tipo, usuario_id, dados)
  values (new.id, v_tipo, v_autor, coalesce(v_dados, '{}'::jsonb));

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_autor, v_tipo, jsonb_strip_nulls(jsonb_build_object(
    'meta_id',    new.id,
    'indicador',  new.indicador,
    'periodo',    new.periodo,
    'usuario_id', new.usuario_id,
    'setor_id',   new.setor_id,
    'etapa_id',   new.etapa_id
  )));
  return null;
end;
$$;

-- EDIÇÃO/ENCERRAMENTO (D-45): só quem criou — ou admin. O liderado que
-- recebeu a meta do líder só a executa.
drop policy if exists plt_metas_edicao on public.plt_metas;
create policy plt_metas_edicao on public.plt_metas
  for update to authenticated
  using (plt_privado.fn_eh_admin() or criada_por_id = plt_privado.fn_usuario_atual())
  with check (plt_privado.fn_eh_admin() or criada_por_id = plt_privado.fn_usuario_atual());

drop function if exists public.plt_fn_metas_painel(boolean, integer, integer);

create or replace function public.plt_fn_metas_painel(
  p_incluir_encerradas boolean default false,
  p_limite             integer default 20,
  p_deslocamento       integer default 0
)
returns table (
  meta_id         bigint,
  titulo          text,
  indicador       text,
  periodo         text,
  alvo            numeric,
  usuario_id      uuid,
  usuario_nome    text,
  setor_id        bigint,
  setor_nome      text,
  etapa_id        bigint,
  etapa_nome      text,
  criada_por_id   uuid,
  criada_por_nome text,
  encerrada_em    timestamptz,
  janela_inicio   timestamptz,
  janela_fim      timestamptz,
  progresso       numeric,
  contagem_total  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with eu as (
    select plt_privado.fn_usuario_atual() as id
  ),
  visiveis as (
    select m.*
      from public.plt_metas m
     where plt_privado.fn_eh_admin()
        or m.usuario_id = (select id from eu)
        or m.setor_id in (select plt_privado.fn_setores_do_usuario())
        or m.criada_por_id = (select id from eu)
        or (m.usuario_id is not null and exists (
              select 1 from public.plt_usuario_setores us
               where us.usuario_id = m.usuario_id
                 and plt_privado.fn_eh_lider_de(us.setor_id)))
  )
  select m.id                                   as meta_id,
         m.titulo,
         m.indicador,
         m.periodo,
         m.alvo,
         m.usuario_id,
         du.nome                                as usuario_nome,
         m.setor_id,
         ds.nome                                as setor_nome,
         m.etapa_id,
         de.nome                                as etapa_nome,
         m.criada_por_id,
         cr.nome                                as criada_por_nome,
         m.encerrada_em,
         j.inicio                               as janela_inicio,
         j.fim                                  as janela_fim,
         pr.progresso,
         count(*) over ()                       as contagem_total
    from visiveis m
    left join public.plt_usuarios du on du.id = m.usuario_id
    left join public.plt_setores  ds on ds.id = m.setor_id
    left join public.plt_etapas   de on de.id = m.etapa_id
    left join public.plt_usuarios cr on cr.id = m.criada_por_id
    cross join lateral (
      select case m.periodo
               when 'diaria'  then date_trunc('day',   now() at time zone 'America/Fortaleza')
               when 'semanal' then date_trunc('week',  now() at time zone 'America/Fortaleza')
               else                date_trunc('month', now() at time zone 'America/Fortaleza')
             end as ini_local
    ) jl
    cross join lateral (
      select jl.ini_local at time zone 'America/Fortaleza' as inicio,
             (jl.ini_local + case m.periodo
                               when 'diaria'  then interval '1 day'
                               when 'semanal' then interval '7 days'
                               else                interval '1 month'
                             end) at time zone 'America/Fortaleza' as fim
    ) j
    cross join lateral (
      select case m.indicador
        -- unidades = execuções ENCERRADAS na janela; com etapa mirada (D-45),
        -- só as daquela etapa
        when 'unidades' then coalesce((
          select count(*)::numeric
            from public.plt_vw_execucoes v
           where v.finalizou_em >= j.inicio and v.finalizou_em < j.fim
             and (m.etapa_id is null or v.etapa_id = m.etapa_id)
             and ((m.usuario_id is not null and v.usuario_inicio_id = m.usuario_id)
               or (m.setor_id   is not null and v.setor_id = m.setor_id))), 0)
        when 'tarefas' then coalesce((
          select count(*)::numeric
            from public.plt_tarefas t
           where t.situacao = 'concluida'
             and t.concluida_em >= j.inicio and t.concluida_em < j.fim
             and ((m.usuario_id is not null and t.responsavel_id = m.usuario_id)
               or (m.setor_id   is not null and t.setor_id = m.setor_id))), 0)
        else coalesce((
          select round((extract(epoch from sum(
                   plt_privado.fn_tempo_util(
                     greatest(v.iniciou_em, j.inicio),
                     least(coalesce(v.finalizou_em, now()), j.fim),
                     v.setor_id, v.usuario_inicio_id))) / 3600)::numeric, 2)
            from public.plt_vw_execucoes v
           where coalesce(v.finalizou_em, now()) > j.inicio
             and v.iniciou_em < j.fim
             and ((m.usuario_id is not null and v.usuario_inicio_id = m.usuario_id)
               or (m.setor_id   is not null and v.setor_id = m.setor_id))), 0)
      end as progresso
    ) pr
   where (p_incluir_encerradas or m.encerrada_em is null)
   order by (m.encerrada_em is not null),
            case m.periodo when 'diaria' then 1 when 'semanal' then 2 else 3 end,
            m.criada_em desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_metas_painel(boolean, integer, integer) is
  'Cockpit do Meu Painel (SESSAO-14/D-37; SESSAO-15/D-45 soma etapa e quem criou): metas visíveis ao usuário com janela corrente (America/Fortaleza) e progresso calculado dos eventos. Endpoint de propósito — gate interno.';

-- ----------------------------------------------------------------------------
-- 15 · Quem executa o quê (E-11) — +10 endpoints de propósito (total 28 WARN
--      esperados nos advisors)
-- ----------------------------------------------------------------------------
revoke all on function public.plt_fn_estoque(text, integer, integer)                        from public, anon;
revoke all on function public.plt_fn_definir_id_producao(bigint, text)                      from public, anon;
revoke all on function public.plt_fn_pedidos_aguardo(text, integer, integer)                from public, anon;
revoke all on function public.plt_fn_lancar_rotas(bigint)                                   from public, anon;
revoke all on function public.plt_fn_danificados(boolean, text, integer, integer)           from public, anon;
revoke all on function public.plt_fn_resolver_danificado(bigint, bigint, bigint, text, text) from public, anon;
revoke all on function public.plt_fn_arquivar_card(bigint, text)                            from public, anon;
revoke all on function public.plt_fn_rotas(text, text, integer, integer)                    from public, anon;
revoke all on function public.plt_fn_registrar_entrega(bigint, text)                        from public, anon;
revoke all on function public.plt_fn_programacao(date, integer, integer)                    from public, anon;
revoke all on function public.plt_fn_programar_entrega(bigint, date, bigint)                from public, anon;
revoke all on function public.plt_fn_desprogramar_entrega(bigint)                           from public, anon;
revoke all on function public.plt_fn_metas_painel(boolean, integer, integer)                from public, anon;

grant execute on function public.plt_fn_estoque(text, integer, integer)                        to authenticated;
grant execute on function public.plt_fn_definir_id_producao(bigint, text)                      to authenticated;
grant execute on function public.plt_fn_pedidos_aguardo(text, integer, integer)                to authenticated;
grant execute on function public.plt_fn_lancar_rotas(bigint)                                   to authenticated;
grant execute on function public.plt_fn_danificados(boolean, text, integer, integer)           to authenticated;
grant execute on function public.plt_fn_resolver_danificado(bigint, bigint, bigint, text, text) to authenticated;
grant execute on function public.plt_fn_arquivar_card(bigint, text)                            to authenticated;
grant execute on function public.plt_fn_rotas(text, text, integer, integer)                    to authenticated;
grant execute on function public.plt_fn_registrar_entrega(bigint, text)                        to authenticated;
grant execute on function public.plt_fn_programacao(date, integer, integer)                    to authenticated;
grant execute on function public.plt_fn_programar_entrega(bigint, date, bigint)                to authenticated;
grant execute on function public.plt_fn_desprogramar_entrega(bigint)                           to authenticated;
grant execute on function public.plt_fn_metas_painel(boolean, integer, integer)                to authenticated;

-- E-19: o `validate` que vivia aqui MUDOU DE CASA — o banco real já viveu a
-- migration 29 (tipos de pausa da SESSAO-22), e validar a lista desta época
-- quebraria a reaplicação. Quem valida a tabela inteira é sempre a migration
-- mais nova do check (hoje: a 29).
