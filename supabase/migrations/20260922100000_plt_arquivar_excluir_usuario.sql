-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 31 — ARQUIVAR E EXCLUIR USUÁRIO
-- Sessão: SESSAO-22 (pedido do dono na revisão) · Data: 2026-09-22 · D-49
--
-- Dois destinos para uma pessoa que sai (palavras do dono):
--
--   ARQUIVAR — "tudo ainda fica no nome dele, porém as pendências dele são
--   transferidas ao líder direto dele, para que o líder possa realocar."
--   → ativo=false + arquivado_em; execução aberta é ENCERRADA (o tempo até ali
--     fica no nome dele — evento, nunca edição), cards delegados e tarefas
--     abertas passam ao líder do setor de cada pendência (sem líder, ou se o
--     arquivado É o líder → vão para o admin que arquivou). Reversível
--     (desarquivar); as pendências não voltam — já foram realocadas.
--
--   EXCLUIR — "tudo o que estava no nome dele é de fato excluído."
--   → a linha, os vínculos, notificações, visualizações, presenças, horários,
--     tarefas dele, a foto e a CONTA DE LOGIN somem de verdade. Só é possível
--     para usuário SEM HISTÓRIA (nunca gerou evento/log/meta): eventos e
--     trilha são append-only (regra crítica 5 / D-40) e o próprio banco recusa
--     apagar quem eles apontam — para esses, o caminho é arquivar, e a recusa
--     diz exatamente isso (padrão do caminhão em uso: o "não" vem com a saída).
--
-- Quem pode: SÓ ADMIN (gestão de pessoas — D-21). Ninguém arquiva/exclui a si
-- mesmo, e o último admin ativo não se arquiva (a plataforma não pode ficar
-- sem dono). Toda ação vira log (D-40).
-- ============================================================================

alter table public.plt_usuarios
  add column if not exists arquivado_em timestamptz;

comment on column public.plt_usuarios.arquivado_em is
  'SESSAO-22 (D-49): quando o usuário foi arquivado (ativo=false junto). Tudo fica no nome dele; as pendências foram realocadas ao líder no ato. NULL = nunca arquivado (ou reativado).';

-- ----------------------------------------------------------------------------
-- 1 · O líder direto de um setor (maquinaria — E-11)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_lider_do_setor(p_setor_id bigint, p_exceto uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select us.usuario_id
    from public.plt_usuario_setores us
    join public.plt_usuarios u on u.id = us.usuario_id and u.ativo
   where us.setor_id = p_setor_id
     and us.lider_do_setor
     and us.usuario_id is distinct from p_exceto
   order by us.usuario_id
   limit 1;
$$;

comment on function plt_privado.fn_lider_do_setor(bigint, uuid) is
  'SESSAO-22 (D-49): o líder ativo do setor, exceto a própria pessoa. NULL quando não há — quem chama decide o fallback (o admin do gesto).';

revoke all on function plt_privado.fn_lider_do_setor(bigint, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · Arquivar: tudo fica no nome dele; as pendências vão ao líder (D-49)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_arquivar_usuario(p_usuario_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_autor       uuid;
  v_alvo        public.plt_usuarios%rowtype;
  v_card        record;
  v_tarefa      record;
  v_destino     uuid;
  v_fallback    uuid;
  v_execucoes   integer := 0;
  v_delegados   integer := 0;
  v_tarefas     integer := 0;
begin
  v_autor := plt_privado.fn_usuario_atual();
  if v_autor is null or not plt_privado.fn_eh_admin() then
    raise exception 'Arquivar usuário é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_alvo from public.plt_usuarios where id = p_usuario_id;
  if not found then
    raise exception 'Usuário não encontrado.' using errcode = 'no_data_found';
  end if;
  if v_alvo.id = v_autor then
    raise exception 'Você não pode arquivar a si mesmo — peça a outro admin.'
      using errcode = 'check_violation';
  end if;
  if v_alvo.arquivado_em is not null then
    raise exception 'Este usuário já está arquivado.' using errcode = 'check_violation';
  end if;
  if v_alvo.papel = 'admin' and not exists (
       select 1 from public.plt_usuarios u
        where u.papel = 'admin' and u.ativo and u.id <> v_alvo.id
     ) then
    raise exception 'Este é o último admin ativo — a plataforma não pode ficar sem admin.'
      using errcode = 'check_violation';
  end if;

  -- Fallback das pendências sem líder possível: o admin que arquivou.
  v_fallback := v_autor;

  -- 2a · Execução aberta é ENCERRADA no ato (evento, nunca edição — RNF-05):
  -- o tempo até aqui fica no nome do arquivado; o card volta a ficar livre.
  for v_card in
    select c.id, c.setor_atual_id, c.etapa_atual_id
      from public.plt_cards c
     where c.executor_atual_id = v_alvo.id
       and c.arquivado_em is null
  loop
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao)
      values
        (v_card.id, 'execucao_finalizada', v_autor, 'automacao',
         v_card.setor_atual_id, v_card.etapa_atual_id,
         'Encerrada ao arquivar ' || v_alvo.nome || ' — o tempo até aqui fica no nome de quem executou.');
    v_execucoes := v_execucoes + 1;
  end loop;

  -- 2b · Cards delegados a ele → o líder do setor do card realoca.
  for v_card in
    select c.id, c.setor_atual_id
      from public.plt_cards c
     where c.responsavel_id = v_alvo.id
       and c.arquivado_em is null
  loop
    v_destino := coalesce(
      plt_privado.fn_lider_do_setor(v_card.setor_atual_id, v_alvo.id), v_fallback);
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem, setor_origem_id, dados, observacao)
      values
        (v_card.id, 'delegacao', v_autor, 'automacao', v_card.setor_atual_id,
         jsonb_build_object('responsavel_id', v_destino, 'modo', 'direta'),
         'Realocado ao arquivar ' || v_alvo.nome || '.');
    v_delegados := v_delegados + 1;
  end loop;

  -- 2c · Tarefas abertas dele → o líder do setor da tarefa (sem setor: o líder
  -- de um setor do arquivado; sem líder nenhum: o admin do gesto).
  for v_tarefa in
    select t.id, t.setor_id
      from public.plt_tarefas t
     where t.responsavel_id = v_alvo.id
       and t.situacao <> 'concluida'
  loop
    v_destino := null;
    if v_tarefa.setor_id is not null then
      v_destino := plt_privado.fn_lider_do_setor(v_tarefa.setor_id, v_alvo.id);
    end if;
    if v_destino is null then
      select plt_privado.fn_lider_do_setor(us.setor_id, v_alvo.id) into v_destino
        from public.plt_usuario_setores us
       where us.usuario_id = v_alvo.id
         and plt_privado.fn_lider_do_setor(us.setor_id, v_alvo.id) is not null
       limit 1;
    end if;
    update public.plt_tarefas
       set responsavel_id = coalesce(v_destino, v_fallback)
     where id = v_tarefa.id;
    v_tarefas := v_tarefas + 1;
  end loop;

  update public.plt_usuarios
     set ativo = false,
         arquivado_em = now()
   where id = v_alvo.id;

  -- D-40: toda ação vira log.
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_autor, 'usuario_arquivado', jsonb_build_object(
      'usuario_id', v_alvo.id,
      'matricula', v_alvo.matricula,
      'execucoes_encerradas', v_execucoes,
      'cards_realocados', v_delegados,
      'tarefas_realocadas', v_tarefas));

  return jsonb_build_object(
    'execucoes_encerradas', v_execucoes,
    'cards_realocados', v_delegados,
    'tarefas_realocadas', v_tarefas);
end;
$$;

comment on function public.plt_fn_arquivar_usuario(uuid) is
  'SESSAO-22 (D-49): arquiva o usuário — tudo fica no nome dele; execução aberta encerra, cards delegados e tarefas abertas passam ao líder direto (fallback: o admin do gesto). Só admin. Endpoint de propósito.';

-- ----------------------------------------------------------------------------
-- 3 · Desarquivar: a pessoa volta; as pendências não (já foram realocadas)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_desarquivar_usuario(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_autor uuid;
  v_alvo  public.plt_usuarios%rowtype;
begin
  v_autor := plt_privado.fn_usuario_atual();
  if v_autor is null or not plt_privado.fn_eh_admin() then
    raise exception 'Reativar usuário é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_alvo from public.plt_usuarios where id = p_usuario_id;
  if not found then
    raise exception 'Usuário não encontrado.' using errcode = 'no_data_found';
  end if;
  if v_alvo.arquivado_em is null then
    raise exception 'Este usuário não está arquivado.' using errcode = 'check_violation';
  end if;

  update public.plt_usuarios
     set ativo = true,
         arquivado_em = null
   where id = v_alvo.id;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_autor, 'usuario_reativado', jsonb_build_object(
      'usuario_id', v_alvo.id, 'matricula', v_alvo.matricula));
end;
$$;

comment on function public.plt_fn_desarquivar_usuario(uuid) is
  'SESSAO-22 (D-49): reativa um usuário arquivado. As pendências realocadas no arquivamento não voltam. Só admin. Endpoint de propósito.';

-- ----------------------------------------------------------------------------
-- 4 · Excluir de fato — só para quem NÃO tem história (a história não se apaga)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_excluir_usuario(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_autor    uuid;
  v_alvo     public.plt_usuarios%rowtype;
  v_auth     uuid;
  v_card     record;
begin
  v_autor := plt_privado.fn_usuario_atual();
  if v_autor is null or not plt_privado.fn_eh_admin() then
    raise exception 'Excluir usuário é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_alvo from public.plt_usuarios where id = p_usuario_id;
  if not found then
    raise exception 'Usuário não encontrado.' using errcode = 'no_data_found';
  end if;
  if v_alvo.id = v_autor then
    raise exception 'Você não pode excluir a si mesmo — peça a outro admin.'
      using errcode = 'check_violation';
  end if;

  -- Regra crítica 5 / D-40: eventos, trilha e metas são história imutável. Quem
  -- já aparece neles não pode sumir — o caminho é ARQUIVAR.
  if exists (select 1 from public.plt_eventos e where e.usuario_id = v_alvo.id)
     or exists (select 1 from public.plt_logs_atividade l where l.usuario_id = v_alvo.id)
     or exists (select 1 from public.plt_metas m
                 where v_alvo.id in (m.usuario_id, m.criada_por_id, m.encerrada_por_id))
     or exists (select 1 from public.plt_metas_eventos me where me.usuario_id = v_alvo.id) then
    raise exception 'Este usuário já tem história na plataforma — e a história não se apaga. Arquive: tudo fica registrado no nome dele e as pendências passam ao líder.'
      using errcode = 'check_violation';
  end if;

  -- Card delegado a ele (por outra pessoa) volta a ficar sem dono — por evento.
  for v_card in
    select c.id, c.setor_atual_id
      from public.plt_cards c
     where c.responsavel_id = v_alvo.id
  loop
    insert into public.plt_eventos
        (card_id, tipo, usuario_id, origem, setor_origem_id, dados, observacao)
      values
        (v_card.id, 'delegacao', v_autor, 'automacao', v_card.setor_atual_id,
         jsonb_build_object('responsavel_id', null, 'modo', 'direta'),
         'Delegação desfeita ao excluir o cadastro.');
  end loop;

  -- O que era DELE some de verdade (o resto cai pelas regras da própria tabela:
  -- notificações/presenças/vínculos/visualizações em cascata; tarefas criadas
  -- por ele para outros ficam, sem o nome do criador).
  delete from public.plt_tarefas t where t.responsavel_id = v_alvo.id;
  delete from public.plt_horarios_funcionamento h where h.usuario_id = v_alvo.id;
  delete from public.plt_pausas_tempo p where p.usuario_id = v_alvo.id;

  -- A foto de perfil NÃO se apaga por SQL: o Supabase bloqueia DELETE direto
  -- em storage.objects ("Use the Storage API instead" — descoberto no teste ao
  -- vivo). Quem apaga é o front, pelo Storage API, antes de chamar esta RPC.

  v_auth := v_alvo.auth_user_id;

  begin
    delete from public.plt_usuarios where id = v_alvo.id;
  exception when foreign_key_violation then
    -- Alguma referência que não previmos: a resposta certa é a mesma.
    raise exception 'Este usuário já tem história na plataforma — e a história não se apaga. Arquive: tudo fica registrado no nome dele e as pendências passam ao líder.'
      using errcode = 'check_violation';
  end;

  -- A conta de login some junto (quando o ambiente tem o auth completo).
  if v_auth is not null and to_regclass('auth.users') is not null then
    execute format('delete from auth.users where id = %L', v_auth);
  end if;

  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_autor, 'usuario_excluido', jsonb_build_object(
      'matricula', v_alvo.matricula, 'nome', v_alvo.nome));
end;
$$;

comment on function public.plt_fn_excluir_usuario(uuid) is
  'SESSAO-22 (D-49): exclui DE FATO um usuário sem história (linha, vínculos, tarefas dele, foto e conta de login). Com história, recusa e aponta o arquivar. Só admin. Endpoint de propósito.';

-- ----------------------------------------------------------------------------
-- 5 · Quem executa o quê (E-11) — +3 endpoints de propósito
-- ----------------------------------------------------------------------------
revoke all on function public.plt_fn_arquivar_usuario(uuid)     from public, anon;
revoke all on function public.plt_fn_desarquivar_usuario(uuid)  from public, anon;
revoke all on function public.plt_fn_excluir_usuario(uuid)      from public, anon;

grant execute on function public.plt_fn_arquivar_usuario(uuid)    to authenticated;
grant execute on function public.plt_fn_desarquivar_usuario(uuid) to authenticated;
grant execute on function public.plt_fn_excluir_usuario(uuid)     to authenticated;
