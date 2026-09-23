-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 33 — MEU PAINEL 2.0
-- Sessão: SESSAO-23 · Data: 2026-09-24
--
-- Respostas do dono (23/09, registradas em Execucao/SESSAO-23.md):
--   · Subtarefas na MESMA tabela (autorreferência), até DOIS níveis abaixo da
--     tarefa-raiz (tarefa → subtarefa → sub-subtarefa).
--   · Tarefa pessoal (criada por mim, para mim) nasce PRIVADA — nem líder, nem
--     admin — a menos que o dono dela a torne pública (na criação ou edição).
--     Pública, ela vira tarefa comum (visibilidade e tempo para a gestão).
--   · Pendência de parecer de qualidade vira tarefa do "Sistema" no setor
--     recebedor; dar o parecer conclui a tarefa sozinho. Fora da fila de
--     prioridade; a chegada gera notificação no sino aos membros do setor.
--   · Fila de prioridade é preferência de EXIBIÇÃO do usuário (um dono por
--     dado — a ordem vive no cadastro dele, nunca na tarefa).
--   · Cards de produção delegados entram na fila → o card ganha a projeção
--     delegado_em (ordem de cadastro da fila).
--   · Tempo: portas de leitura gateadas ao PRÓPRIO (dia/semana, por tarefa e
--     KPIs pessoais) — a separação é garantida aqui, não na UI.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · plt_tarefas: subtarefa, origem (pessoa/sistema), privacidade
--     (E-20: default e check reaplicados explicitamente após o if not exists)
-- ----------------------------------------------------------------------------
alter table public.plt_tarefas
  add column if not exists tarefa_mae_id bigint references public.plt_tarefas(id) on delete cascade;

comment on column public.plt_tarefas.tarefa_mae_id is
  'SESSAO-23: subtarefa = tarefa com mãe, na MESMA tabela. Até dois níveis abaixo da raiz; a mãe não muda depois de criada.';

create index if not exists plt_tarefas_mae_idx
  on public.plt_tarefas (tarefa_mae_id) where tarefa_mae_id is not null;

alter table public.plt_tarefas add column if not exists origem text;
alter table public.plt_tarefas alter column origem set default 'pessoa';
update public.plt_tarefas set origem = 'pessoa' where origem is null;
alter table public.plt_tarefas alter column origem set not null;
alter table public.plt_tarefas drop constraint if exists plt_tarefas_origem_ck;
alter table public.plt_tarefas add constraint plt_tarefas_origem_ck
  check (origem in ('pessoa', 'sistema'));

comment on column public.plt_tarefas.origem is
  'SESSAO-23: pessoa = gesto humano; sistema = criada automaticamente (pendência de parecer de qualidade). Na UI o delegante aparece como "Sistema" — sem usuário fantasma.';

alter table public.plt_tarefas
  add column if not exists evento_referencia_id bigint references public.plt_eventos(id);

comment on column public.plt_tarefas.evento_referencia_id is
  'SESSAO-23: na tarefa do sistema, a MARCAÇÃO de qualidade (qualidade_marcada) que abriu a pendência. O parecer que a responde conclui a tarefa sozinho.';

-- Uma tarefa do sistema por marcação — reprocessar nunca duplica.
create unique index if not exists plt_tarefas_sistema_ref_uq
  on public.plt_tarefas (evento_referencia_id) where origem = 'sistema';

alter table public.plt_tarefas add column if not exists privada boolean;
alter table public.plt_tarefas alter column privada set default false;
update public.plt_tarefas set privada = false where privada is null;
alter table public.plt_tarefas alter column privada set not null;

comment on column public.plt_tarefas.privada is
  'SESSAO-23 (resposta do dono): tarefa pessoal privada — só o dono enxerga, nem líder nem admin. Só existe quando criador = responsável; tornar pública é gesto do dono (criação ou edição). Subtarefa acompanha a raiz.';

create index if not exists plt_tarefas_sistema_setor_idx
  on public.plt_tarefas (setor_id, situacao) where origem = 'sistema' and situacao <> 'concluida';

-- ----------------------------------------------------------------------------
-- 2 · plt_usuarios.fila_prioridade — a ordem da fila é preferência do usuário
--     (M-04: um dono por dado — a posição vive no cadastro DELE, não na tarefa)
-- ----------------------------------------------------------------------------
alter table public.plt_usuarios add column if not exists fila_prioridade jsonb;
alter table public.plt_usuarios alter column fila_prioridade set default '[]'::jsonb;
update public.plt_usuarios set fila_prioridade = '[]'::jsonb where fila_prioridade is null;
alter table public.plt_usuarios alter column fila_prioridade set not null;

comment on column public.plt_usuarios.fila_prioridade is
  'SESSAO-23: ordem da Fila de prioridade do Meu Painel — array de chaves ("t:123" tarefa, "c:456" card). Só exibição: reordenar não muda prazo, dono nem dado de tarefa.';

-- A pessoa edita a própria linha (policy edita_a_si); a coluna entra no rol.
grant update (fila_prioridade) on public.plt_usuarios to authenticated;

-- ----------------------------------------------------------------------------
-- 3 · plt_cards.delegado_em — projeção do instante da delegação (M-13)
--     É a "ordem de cadastro" do card dentro da fila de prioridade.
-- ----------------------------------------------------------------------------
alter table public.plt_cards add column if not exists delegado_em timestamptz;

comment on column public.plt_cards.delegado_em is
  'SESSAO-23: projeção do último evento de delegação com responsável (M-13). Ordena o card na Fila de prioridade do delegado. Zera junto com responsavel_id.';

-- Retroativo: cards já delegados ganham o instante do último evento de delegação.
update public.plt_cards c
   set delegado_em = ult.ocorrido_em
  from (
    select distinct on (e.card_id) e.card_id, e.ocorrido_em
      from public.plt_eventos e
     where e.tipo = 'delegacao'
     order by e.card_id, e.ocorrido_em desc, e.id desc
  ) ult
 where ult.card_id = c.id
   and c.responsavel_id is not null
   and c.delegado_em is null;

-- ----------------------------------------------------------------------------
-- 4 · Regras da tarefa (BEFORE — valem para todo escritor, M-14)
--
-- · subtarefa: mãe imutável, sem auto-referência, até 2 níveis abaixo da raiz,
--   nunca sob tarefa do sistema; herda setor, privacidade e (se vazio) o
--   responsável da mãe; quem anexa precisa ENXERGAR a raiz.
-- · privada: só quando criador = responsável e origem pessoa; reatribuir uma
--   tarefa privada a torna pública sozinha (a pendência passa a ser de outro).
-- · tarefa do sistema: nasce e se conclui só pela maquinaria (flag de sessão
--   plt.tarefa_sistema) — gente resolve dando o PARECER, não fechando a tarefa.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_tarefa()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sistema_ok boolean := current_setting('plt.tarefa_sistema', true) = '1';
  v_mae   public.plt_tarefas%rowtype;
  v_raiz  public.plt_tarefas%rowtype;
  v_eu    uuid := plt_privado.fn_usuario_atual();
begin
  -- A maquinaria do sistema passa reto (ela mesma mantém a coerência).
  if v_sistema_ok then
    return new;
  end if;

  if new.origem = 'sistema' then
    if tg_op = 'INSERT' then
      raise exception 'Tarefa do Sistema nasce sozinha, da pendência de qualidade — ninguém a cria à mão.'
        using errcode = 'check_violation';
    end if;
    raise exception 'Tarefa do Sistema se resolve registrando o parecer de recebimento na fila do setor — ela conclui sozinha.'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' then
    if new.tarefa_mae_id is distinct from old.tarefa_mae_id then
      raise exception 'Subtarefa não muda de tarefa — crie outra no lugar certo.'
        using errcode = 'check_violation';
    end if;
    if new.origem is distinct from old.origem
       or new.evento_referencia_id is distinct from old.evento_referencia_id then
      raise exception 'A origem da tarefa não se altera depois de criada.'
        using errcode = 'check_violation';
    end if;
    -- Reatribuída, a tarefa deixa de ser pessoal → vira pública sozinha.
    if new.responsavel_id is distinct from old.responsavel_id then
      new.privada := false;
    end if;
  end if;

  -- ---------- Subtarefa (só na criação — a mãe é imutável acima) ----------
  if tg_op = 'INSERT' and new.tarefa_mae_id is not null then
    select * into v_mae from public.plt_tarefas where id = new.tarefa_mae_id;
    if not found then
      raise exception 'A tarefa indicada como mãe não existe.' using errcode = 'foreign_key_violation';
    end if;

    -- Raiz e profundidade: raiz → subtarefa → sub-subtarefa, e para por aí.
    if v_mae.tarefa_mae_id is null then
      v_raiz := v_mae;
    else
      select * into v_raiz from public.plt_tarefas where id = v_mae.tarefa_mae_id;
      if v_raiz.tarefa_mae_id is not null then
        raise exception 'Subtarefa vai até dois níveis (tarefa → subtarefa → subtarefa da subtarefa).'
          using errcode = 'check_violation';
      end if;
    end if;

    if v_raiz.origem = 'sistema' then
      raise exception 'Tarefa do Sistema não recebe subtarefas — ela se resolve com o parecer.'
        using errcode = 'check_violation';
    end if;

    -- Quem anexa precisa enxergar a raiz (a mesma régua da leitura).
    if v_eu is not null and not (
      v_raiz.responsavel_id is not distinct from v_eu
      or v_raiz.criada_por_id is not distinct from v_eu
      or (not v_raiz.privada and (
            plt_privado.fn_eh_admin()
            or v_raiz.setor_id in (select plt_privado.fn_setores_do_usuario())
          ))
    ) then
      raise exception 'Você não enxerga esta tarefa — não dá para criar subtarefa nela.'
        using errcode = 'insufficient_privilege';
    end if;

    -- Herança: a subtarefa acompanha a mãe (setor, privacidade, responsável).
    new.setor_id := v_mae.setor_id;
    new.privada  := v_raiz.privada;
    if new.responsavel_id is null then
      new.responsavel_id := v_mae.responsavel_id;
    end if;
  end if;

  -- ---------- Privada só quando é DE FATO pessoal ----------
  if new.privada and new.tarefa_mae_id is null then
    if new.criada_por_id is distinct from new.responsavel_id or new.responsavel_id is null then
      raise exception 'Tarefa privada é a que você cria para você mesmo — delegada a alguém, ela é visível à liderança.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function plt_privado.fn_validar_tarefa() from public, anon, authenticated;

drop trigger if exists plt_tarefas_validar on public.plt_tarefas;
create trigger plt_tarefas_validar
  before insert or update on public.plt_tarefas
  for each row execute function plt_privado.fn_validar_tarefa();

-- Privacidade acompanha a raiz: mudou na raiz, filhas e netas mudam juntas.
create or replace function plt_privado.fn_propagar_privacidade_tarefa()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.privada is distinct from old.privada and new.tarefa_mae_id is null then
    perform set_config('plt.tarefa_sistema', '1', true);
    update public.plt_tarefas
       set privada = new.privada
     where privada is distinct from new.privada
       and (tarefa_mae_id = new.id
            or tarefa_mae_id in (select t.id from public.plt_tarefas t where t.tarefa_mae_id = new.id));
    perform set_config('plt.tarefa_sistema', '', true);
  end if;
  return null;
end;
$$;

revoke all on function plt_privado.fn_propagar_privacidade_tarefa() from public, anon, authenticated;

drop trigger if exists plt_tarefas_propagar_privacidade on public.plt_tarefas;
create trigger plt_tarefas_propagar_privacidade
  after update on public.plt_tarefas
  for each row execute function plt_privado.fn_propagar_privacidade_tarefa();

-- ----------------------------------------------------------------------------
-- 5 · RLS de plt_tarefas — a privacidade garantida no BANCO, não na UI
--
-- Leitura: o dono e o criador sempre; os demais (admin, gente do setor) só o
-- que NÃO é privado. Tarefa do sistema é do setor recebedor (nunca privada).
-- Atualização: o responsável; líder do setor/admin só no que não é privado.
-- Criação: como antes, e só origem 'pessoa' (a do sistema nasce da maquinaria).
-- ----------------------------------------------------------------------------
drop policy if exists plt_tarefas_leitura on public.plt_tarefas;
create policy plt_tarefas_leitura on public.plt_tarefas
  for select to authenticated
  using (
    responsavel_id = plt_privado.fn_usuario_atual()
    or criada_por_id = plt_privado.fn_usuario_atual()
    or (
      not privada
      and (
        plt_privado.fn_eh_admin()
        or setor_id in (select plt_privado.fn_setores_do_usuario())
      )
    )
  );

drop policy if exists plt_tarefas_criacao on public.plt_tarefas;
create policy plt_tarefas_criacao on public.plt_tarefas
  for insert to authenticated
  with check (
    origem = 'pessoa'
    and (
      plt_privado.fn_eh_admin()
      or plt_privado.fn_eh_lider_de(setor_id)
      or criada_por_id = plt_privado.fn_usuario_atual()
    )
  );

drop policy if exists plt_tarefas_atualizacao on public.plt_tarefas;
create policy plt_tarefas_atualizacao on public.plt_tarefas
  for update to authenticated
  using (
    responsavel_id = plt_privado.fn_usuario_atual()
    or (
      not privada
      and (plt_privado.fn_eh_admin() or plt_privado.fn_eh_lider_de(setor_id))
    )
  )
  with check (
    responsavel_id = plt_privado.fn_usuario_atual()
    or (
      not privada
      and (plt_privado.fn_eh_admin() or plt_privado.fn_eh_lider_de(setor_id))
    )
  );

-- ----------------------------------------------------------------------------
-- 6 · Qualidade a atestar vira tarefa do Sistema (AFTER em plt_eventos)
--
-- Chegada com marcação → tarefa no setor recebedor + aviso no sino dos membros
-- (resposta 3 do dono). Parecer dado → tarefa conclui sozinha. Card que segue
-- adiante sem parecer, ou arquivado → a pendência morreu, a tarefa fecha.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tarefa_sistema_qualidade()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_marc    public.plt_eventos%rowtype;
  v_card    public.plt_cards%rowtype;
  v_pedido  integer;
  v_peca    text;
  v_setor_origem text;
  v_titulo  text;
  v_membro  uuid;
begin
  if new.tipo = 'qualidade_parecer' then
    -- O parecer responde a marcação → a tarefa do sistema dela conclui sozinha.
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

  -- Card seguiu adiante: parecer de chegada antiga ficou impossível (o banco o
  -- recusaria) — a tarefa daquela pendência fecha.
  perform set_config('plt.tarefa_sistema', '1', true);
  update public.plt_tarefas
     set situacao = 'concluida', concluida_em = new.ocorrido_em
   where origem = 'sistema'
     and card_id = new.card_id
     and situacao <> 'concluida'
     and evento_referencia_id is distinct from new.evento_referencia_id;
  perform set_config('plt.tarefa_sistema', '', true);

  if new.evento_referencia_id is null then
    return null;
  end if;

  select * into v_marc from public.plt_eventos where id = new.evento_referencia_id;
  if not found or v_marc.tipo <> 'qualidade_marcada' then
    return null;
  end if;

  -- Chegada em terminal não tem "iniciar" nem parecer (D-25): a marcação fica
  -- como registro unilateral — pendência (e tarefa) só em setor de produção.
  if not exists (
    select 1 from public.plt_setores s
     where s.id = new.setor_destino_id and s.papel_no_fluxo = 'producao'
  ) then
    return null;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  select p.numero into v_pedido from public.pedidos p where p.id = v_card.pedido_id;
  v_peca := coalesce(v_card.item_descricao, 'Peça')
            || case when v_card.indice_unidade is not null
                    then format(' (%s/%s)', v_card.indice_unidade, v_card.total_unidades)
                    else '' end
            || coalesce(' · Pedido ' || v_pedido, '');
  select s.nome into v_setor_origem from public.plt_setores s where s.id = new.setor_origem_id;

  v_titulo := 'Confirmar recebimento: ' || v_peca;

  perform set_config('plt.tarefa_sistema', '1', true);
  insert into public.plt_tarefas
      (titulo, descricao, card_id, setor_id, responsavel_id, criada_por_id,
       delegacao, situacao, origem, evento_referencia_id, privada)
    values
      (v_titulo,
       coalesce(v_setor_origem, 'O setor anterior') || ' entregou como '
         || plt_privado.fn_rotulo_estado(v_marc.estado_qualidade)
         || '. Registre o parecer do recebimento na fila do setor.',
       new.card_id, new.setor_destino_id, null, null,
       'direta', 'aberta', 'sistema', v_marc.id, false)
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
                 'Recebimento para confirmar',
                 v_peca || ' chegou marcada como '
                   || plt_privado.fn_rotulo_estado(v_marc.estado_qualidade)
                   || coalesce(' por ' || v_setor_origem, '')
                   || '. A tarefa está nos seus Delegados a mim.');
  end loop;

  return null;
end;
$$;

revoke all on function plt_privado.fn_tarefa_sistema_qualidade() from public, anon, authenticated;

drop trigger if exists plt_eventos_tarefa_sistema on public.plt_eventos;
create trigger plt_eventos_tarefa_sistema
  after insert on public.plt_eventos
  for each row execute function plt_privado.fn_tarefa_sistema_qualidade();

-- Retroativo: as pendências de parecer JÁ abertas ganham a tarefa do sistema
-- (sem notificação — aviso retroativo seria ruído). Idempotente pelo índice.
do $$
begin
  perform set_config('plt.tarefa_sistema', '1', true);
  insert into public.plt_tarefas
      (titulo, descricao, card_id, setor_id, responsavel_id, criada_por_id,
       delegacao, situacao, origem, evento_referencia_id, privada)
  select 'Confirmar recebimento: '
           || coalesce(c.item_descricao, 'Peça')
           || case when c.indice_unidade is not null
                   then format(' (%s/%s)', c.indice_unidade, c.total_unidades)
                   else '' end
           || coalesce(' · Pedido ' || p.numero, ''),
         coalesce(so.nome, 'O setor anterior') || ' entregou como '
           || plt_privado.fn_rotulo_estado(m.estado_qualidade)
           || '. Registre o parecer do recebimento na fila do setor.',
         c.id, cheg.setor_destino_id, null, null,
         'direta', 'aberta', 'sistema', m.id, false
    from public.plt_cards c
    join lateral (
      select e.evento_referencia_id, e.setor_destino_id
        from public.plt_eventos e
       where e.card_id = c.id and e.tipo = 'movimentacao_setor'
       order by e.ocorrido_em desc, e.id desc
       limit 1
    ) cheg on cheg.evento_referencia_id is not null
    join public.plt_setores sd
      on sd.id = cheg.setor_destino_id and sd.papel_no_fluxo = 'producao'
    join public.plt_eventos m
      on m.id = cheg.evento_referencia_id and m.tipo = 'qualidade_marcada'
    left join public.plt_setores so on so.id = m.setor_origem_id
    left join public.pedidos p on p.id = c.pedido_id
   where c.arquivado_em is null
     and c.concluido_em is null
     and not exists (
       select 1 from public.plt_eventos pa
        where pa.tipo = 'qualidade_parecer' and pa.evento_referencia_id = m.id
     )
  on conflict (evento_referencia_id) where origem = 'sistema' do nothing;
  perform set_config('plt.tarefa_sistema', '', true);
end;
$$;

-- ----------------------------------------------------------------------------
-- 7 · Projeção do card: delegado_em entra (função recriada POR INTEIRO — a
--     versão da migration 29, acrescida só do relógio da delegação)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_projetar_posicao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terminal boolean;
  v_tipo_card text;
  v_pedido_id bigint;
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
           -- SESSAO-22: mover encerra a execução — e a pausa junto com ela.
           pausado_em     = null,
           responsavel_id = case when new.tipo = 'movimentacao_setor'
                                 then null else responsavel_id end,
           -- SESSAO-23: o afazer era daquele time — o relógio da delegação zera junto.
           delegado_em    = case when new.tipo = 'movimentacao_setor'
                                 then null else delegado_em end,
           -- SESSAO-15: concluído = está num terminal AGORA (D-13); saiu de
           -- lá (danificado resolvido, ajuste manual), volta a "em produção".
           concluido_em   = case when coalesce(v_terminal, false)
                                 then coalesce(concluido_em, new.ocorrido_em)
                                 else null end
     where id = new.card_id;

    -- SESSAO-22 (D-48): unidade nova liberada → o card de pedido pode ter
    -- acabado de completar a liberação.
    if new.tipo = 'card_criado' then
      select c.tipo, c.pedido_id into v_tipo_card, v_pedido_id
        from public.plt_cards c where c.id = new.card_id;
      if v_tipo_card = 'unidade' and v_pedido_id is not null then
        perform plt_privado.fn_recalcular_liberacao(v_pedido_id);
      end if;
    end if;

  elsif new.tipo = 'execucao_iniciada' then
    -- Iniciar num card já em execução por OUTRA pessoa = transferência (D-24):
    -- fecha para um, abre para o outro — e encerra pausa que houver.
    update public.plt_cards
       set executor_atual_id = new.usuario_id,
           pausado_em = null
     where id = new.card_id;

  elsif new.tipo = 'execucao_finalizada' then
    update public.plt_cards
       set executor_atual_id = null,
           pausado_em = null
     where id = new.card_id;

  elsif new.tipo = 'execucao_pausada' then
    -- SESSAO-22 (D-48): a urgência entra porque o pausado sai do limite.
    update public.plt_cards
       set pausado_em = new.ocorrido_em
     where id = new.card_id;

  elsif new.tipo = 'execucao_retomada' then
    update public.plt_cards
       set pausado_em = null
     where id = new.card_id;

  elsif new.tipo = 'estorno' then
    -- O estado guardado é projeção; o evento é a verdade (M-13). A pausa
    -- pertencia à execução desfeita — zera junto.
    update public.plt_cards
       set executor_atual_id = plt_privado.fn_executor_pelo_log(new.card_id),
           pausado_em = null
     where id = new.card_id;

  elsif new.tipo in ('qualidade_marcada', 'qualidade_parecer') then
    update public.plt_cards
       set qualidade_atual = new.estado_qualidade
     where id = new.card_id;

  elsif new.tipo = 'card_arquivado' then
    update public.plt_cards
       set arquivado_em = new.ocorrido_em,
           executor_atual_id = null,
           pausado_em = null
     where id = new.card_id;

  elsif new.tipo = 'delegacao' then
    -- SESSAO-23: o relógio da fila de prioridade nasce (ou zera) aqui.
    update public.plt_cards
       set responsavel_id = nullif(new.dados ->> 'responsavel_id', '')::uuid,
           delegado_em = case when nullif(new.dados ->> 'responsavel_id', '') is null
                              then null else new.ocorrido_em end
     where id = new.card_id;

  elsif new.tipo = 'pedido_lancado_rotas' then
    -- SESSAO-15 (D-45): o card de pedido passa a existir para as ROTAS.
    update public.plt_cards
       set lancado_rotas_em = new.ocorrido_em
     where id = new.card_id;

  elsif new.tipo = 'pedido_atualizado' then
    -- SESSAO-22 (D-48): o Tiny pode ter mudado os itens — o "completo" muda junto.
    select c.pedido_id into v_pedido_id
      from public.plt_cards c where c.id = new.card_id;
    if v_pedido_id is not null then
      perform plt_privado.fn_recalcular_liberacao(v_pedido_id);
    end if;
  end if;

  return null;
end;
$$;

comment on function plt_privado.fn_projetar_posicao() is
  'Único lugar que escreve a posição do card. Reage a evento inserido; nunca o contrário. Projeta pausa/retomada e liberação completa (S22), arquivamento (S11), responsável + delegado_em (S12/S23), lançamento para ROTAS (S15).';

-- ----------------------------------------------------------------------------
-- 8 · Trilha: reordenar a fila também é atividade (D-40) — função recriada
--     por inteiro (a da migration 22 + o campo novo)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_logar_usuario()
returns trigger
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_campos text[] := '{}';
begin
  if new.nome         is distinct from old.nome         then v_campos := array_append(v_campos, 'nome'); end if;
  if new.usuario      is distinct from old.usuario      then v_campos := array_append(v_campos, 'usuario'); end if;
  if new.email        is distinct from old.email        then v_campos := array_append(v_campos, 'email'); end if;
  if new.telefone     is distinct from old.telefone     then v_campos := array_append(v_campos, 'telefone'); end if;
  if new.tema         is distinct from old.tema         then v_campos := array_append(v_campos, 'tema'); end if;
  if new.foto_caminho is distinct from old.foto_caminho then v_campos := array_append(v_campos, 'foto'); end if;
  if new.papel        is distinct from old.papel        then v_campos := array_append(v_campos, 'papel'); end if;
  if new.ativo        is distinct from old.ativo        then v_campos := array_append(v_campos, 'ativo'); end if;
  if new.pin_hash     is distinct from old.pin_hash     then v_campos := array_append(v_campos, 'pin'); end if;
  if new.fila_prioridade is distinct from old.fila_prioridade then v_campos := array_append(v_campos, 'fila_prioridade'); end if;

  -- Nada relevante mudou (ex.: senha_padrao/convite no fluxo do 1º login).
  if array_length(v_campos, 1) is null then
    return null;
  end if;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (
    coalesce(plt_privado.fn_usuario_atual(), new.id),
    case
      when array['tema'] = v_campos then 'tema_alterado'
      when array['fila_prioridade'] = v_campos then 'fila_prioridade_reordenada'
      else 'perfil_atualizado'
    end,
    jsonb_build_object('alvo_id', new.id, 'campos', to_jsonb(v_campos))
  );
  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9 · Portas do tempo pessoal — gateadas ao PRÓPRIO no banco (nem pela API a
--     gestão lê o tempo de afazeres alheios; endpoints de propósito — E-11)
-- ----------------------------------------------------------------------------

-- 9a · Meu tempo em afazeres, por dia (pessoal × delegado). O tempo é do timer
--      opcional da tarefa (iniciada_em → concluida_em; aberta conta até agora),
--      atribuído ao dia do início, em America/Fortaleza.
create or replace function public.plt_fn_meu_tempo_dias(
  p_de  timestamptz,
  p_ate timestamptz
)
returns table (
  dia            date,
  tarefas        integer,
  tempo_pessoal  interval,
  tempo_delegado interval
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (t.iniciada_em at time zone 'America/Fortaleza')::date as dia,
         count(*)::int as tarefas,
         coalesce(sum(coalesce(t.concluida_em, now()) - t.iniciada_em)
           filter (where t.criada_por_id is not distinct from t.responsavel_id
                     and t.origem = 'pessoa'), interval '0') as tempo_pessoal,
         coalesce(sum(coalesce(t.concluida_em, now()) - t.iniciada_em)
           filter (where t.criada_por_id is distinct from t.responsavel_id
                      or t.origem <> 'pessoa'), interval '0') as tempo_delegado
    from public.plt_tarefas t
   where t.responsavel_id is not null
     and t.responsavel_id = plt_privado.fn_usuario_atual()
     and t.iniciada_em >= p_de
     and t.iniciada_em <  p_ate
   group by 1
   order by 1;
$$;

comment on function public.plt_fn_meu_tempo_dias(timestamptz, timestamptz) is
  'SESSAO-23: o tempo do PRÓPRIO usuário em afazeres, por dia. Gate absoluto: só devolve o de quem chama — o tempo de afazeres pessoais não é visível a mais ninguém, nem a admin.';

-- 9b · Meu tempo por tarefa (paginado — a tela não pede mais do que mostra).
create or replace function public.plt_fn_meu_tempo_tarefas(
  p_de           timestamptz,
  p_ate          timestamptz,
  p_limite       integer default 20,
  p_deslocamento integer default 0
)
returns table (
  tarefa_id      bigint,
  titulo         text,
  pessoal        boolean,
  situacao       text,
  iniciada_em    timestamptz,
  concluida_em   timestamptz,
  duracao        interval,
  contagem_total bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.id,
         t.titulo,
         (t.criada_por_id is not distinct from t.responsavel_id and t.origem = 'pessoa') as pessoal,
         t.situacao,
         t.iniciada_em,
         t.concluida_em,
         coalesce(t.concluida_em, now()) - t.iniciada_em as duracao,
         count(*) over ()::bigint as contagem_total
    from public.plt_tarefas t
   where t.responsavel_id is not null
     and t.responsavel_id = plt_privado.fn_usuario_atual()
     and t.iniciada_em >= p_de
     and t.iniciada_em <  p_ate
   order by (coalesce(t.concluida_em, now()) - t.iniciada_em) desc, t.id
   limit greatest(coalesce(p_limite, 20), 1)
  offset greatest(coalesce(p_deslocamento, 0), 0);
$$;

comment on function public.plt_fn_meu_tempo_tarefas(timestamptz, timestamptz, integer, integer) is
  'SESSAO-23: a quebra por tarefa do tempo do PRÓPRIO usuário (resposta 4 do dono), paginada. Mesmo gate absoluto do plt_fn_meu_tempo_dias.';

-- 9c · Meu desempenho — KPIs só do próprio ("para ele entender onde melhorar").
create or replace function public.plt_fn_meu_desempenho(
  p_de  timestamptz,
  p_ate timestamptz
)
returns table (
  execucoes            integer,
  execucoes_finalizadas integer,
  tempo_execucao       interval,
  media_execucao       interval,
  cards_distintos      integer,
  tarefas_concluidas   integer,
  tempo_afazeres       interval,
  pareceres_dados      integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with eu as (
    select plt_privado.fn_usuario_atual() as id
  ),
  exec as (
    select count(*)::int as execucoes,
           count(*) filter (where v.encerramento = 'finalizada')::int as finalizadas,
           coalesce(sum(v.duracao), interval '0') as tempo,
           count(distinct v.card_id)::int as cards
      from public.plt_vw_execucoes v, eu
     where eu.id is not null
       and v.usuario_inicio_id = eu.id
       and v.iniciou_em >= p_de
       and v.iniciou_em <  p_ate
  ),
  tar as (
    select count(*) filter (where t.concluida_em >= p_de and t.concluida_em < p_ate)::int as concluidas,
           coalesce(sum(coalesce(t.concluida_em, now()) - t.iniciada_em)
             filter (where t.iniciada_em >= p_de and t.iniciada_em < p_ate), interval '0') as tempo
      from public.plt_tarefas t, eu
     where eu.id is not null
       and t.responsavel_id = eu.id
  ),
  par as (
    select count(*)::int as dados
      from public.plt_eventos e, eu
     where eu.id is not null
       and e.tipo = 'qualidade_parecer'
       and e.usuario_id = eu.id
       and e.ocorrido_em >= p_de
       and e.ocorrido_em <  p_ate
  )
  select exec.execucoes,
         exec.finalizadas,
         exec.tempo,
         case when exec.execucoes > 0 then exec.tempo / exec.execucoes end as media_execucao,
         exec.cards,
         tar.concluidas,
         tar.tempo,
         par.dados
    from exec, tar, par
   where (select id from eu) is not null;
$$;

comment on function public.plt_fn_meu_desempenho(timestamptz, timestamptz) is
  'SESSAO-23: KPIs pessoais do painel privado de Dashboards — execuções, tempos (pausas já descontadas pela view), tarefas e pareceres SÓ de quem chama.';

-- Quem executa o quê (E-11: nada exposto além do combinado).
revoke all on function public.plt_fn_meu_tempo_dias(timestamptz, timestamptz) from public, anon;
revoke all on function public.plt_fn_meu_tempo_tarefas(timestamptz, timestamptz, integer, integer) from public, anon;
revoke all on function public.plt_fn_meu_desempenho(timestamptz, timestamptz) from public, anon;

grant execute on function public.plt_fn_meu_tempo_dias(timestamptz, timestamptz) to authenticated;
grant execute on function public.plt_fn_meu_tempo_tarefas(timestamptz, timestamptz, integer, integer) to authenticated;
grant execute on function public.plt_fn_meu_desempenho(timestamptz, timestamptz) to authenticated;
