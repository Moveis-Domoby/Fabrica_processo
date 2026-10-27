-- ============================================================================
-- SESSAO-41 · ajuste do dono (27/10/2026) — D-197 e D-198
--
-- (1) D-197 — "15 minutos sem card não deve contar como tempo de trabalho,
--     tempo de trabalho é apenas tempo de execução de um card, libere apenas 5
--     minutos sem card para contar como trabalho ainda". Na CONTA do tempo, só
--     os 5 primeiros minutos sem card valem como trabalhando; dos 5 em diante,
--     ausente. Na TELA nada muda (resposta do dono: "aparece trabalhando até 15
--     min") — `fn_presenca_estado_efetivo` e o `presenca.ts` do tablet ficam.
--
-- (2) D-198 — o card ESQUECIDO: "se um card de montagem demorar mais de 2 horas
--     para montar (apenas para os que já foram iniciados), deve ser lançada uma
--     notificação para a pessoa e para o admin perguntando se ainda tem alguém
--     nesse card, uma notificação urgente". Respostas do dono: só a MONTAGEM, 2 h
--     rodando SEM PARAR (desde o último iniciar/retomar — pausar zera); "Sim"
--     segue e pergunta de novo em mais 2 h; "Não" pausa o card e o tempo
--     DEPOIS DO AVISO não conta como trabalho (a pausa vale no instante do aviso).
--     Quem responde: quem está no card (no tablet, com o PIN), o líder do setor
--     ou um administrador.
--
--     Sem relógio que acorda para ver se tem trabalho (Lei §4): o despertador é
--     UM agendamento do pg_cron marcado para o MINUTO em que o próximo card
--     completa o prazo, remarcado no fato (iniciar, retomar, pausar, finalizar,
--     mover, responder). Sem card rodando com prazo, ele não existe.
--
-- Aditiva e compatível com o site de antes: colunas novas (nulas), o quadro do
-- setor só GANHA a chave `esquecidos`, a porta nova é nova.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · D-197: as partes do tempo — a carência conta 5 min como trabalhando
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_presenca_partes(
  p_estado text, p_especial boolean, p_carencia boolean, p_inicio timestamptz, p_fim timestamptz
)
returns table (estado text, inicio timestamptz, fim timestamptz)
language sql
immutable
as $$
  select x.estado, x.inicio, x.fim
    from (
      select 'trabalhando'::text, p_inicio, p_fim
       where p_estado = 'trabalhando'
      union all
      -- à deriva: o teto de 12 h por trecho (D-146)
      select 'deriva', p_inicio, least(p_fim, p_inicio + interval '12 hours')
       where p_estado = 'deriva'
      union all
      -- a carência: só os 5 PRIMEIROS minutos sem card contam como trabalhando
      -- (↩️ D-197 — eram 15; na tela, segue "trabalhando" até 15 min)
      select 'trabalhando', p_inicio, least(p_fim, p_inicio + interval '5 minutes')
       where p_estado = 'ausente' and p_carencia
      union all
      -- o ausente (ou o parado por motivo especial — D-165) vai até 1 h
      select case when p_especial then 'especial' else 'ausente' end,
             case when p_carencia then p_inicio + interval '5 minutes' else p_inicio end,
             least(p_fim, p_inicio + interval '60 minutes')
       where p_estado = 'ausente'
    ) as x(estado, inicio, fim)
   where x.fim > x.inicio;
$$;

comment on function plt_privado.fn_presenca_partes(text, boolean, boolean, timestamptz, timestamptz) is
  'SESSAO-41 (D-189 ↩️ D-197): as partes de um trecho de presença como o tempo CONTA — trabalhando inteiro; à deriva até 12 h; o ausente sem card com os 5 primeiros minutos como trabalhando (na tela, 15 — fn_presenca_estado_efetivo); o ausente (e o especial) até 1 h (depois, a pessoa saiu do setor). Usada ao fechar o trecho e no trecho aberto.';

comment on function plt_privado.fn_presenca_estado_efetivo(text, boolean, timestamptz, timestamptz) is
  'SESSAO-41 (D-189): o estado de AGORA de um trecho aberto, como a TELA mostra — o ausente sem card aparece "trabalhando" nos 15 primeiros minutos (na conta do tempo, só 5 valem — D-197, fn_presenca_partes); ausente (qualquer) com 1 h = fora (nulo: saiu do setor sozinho).';

revoke all on function plt_privado.fn_presenca_partes(text, boolean, boolean, timestamptz, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · D-198: o prazo por setor (só a MONTAGEM tem — 2 h)
-- ----------------------------------------------------------------------------
alter table public.plt_setores add column if not exists aviso_esquecido_min integer;
alter table public.plt_setores drop constraint if exists plt_setores_aviso_esquecido_min_check;
alter table public.plt_setores add constraint plt_setores_aviso_esquecido_min_check
  check (aviso_esquecido_min is null or aviso_esquecido_min between 10 and 1440);

comment on column public.plt_setores.aviso_esquecido_min is
  'SESSAO-41 (D-198): minutos de execução SEM PARAR (desde o último iniciar/retomar) até o aviso urgente "ainda tem alguém neste card?" para quem está no card e os administradores. Nulo = o setor não avisa. Nasce 120 só na MONTAGEM (pedido do dono).';

update public.plt_setores set aviso_esquecido_min = 120
 where codigo = 'montagem' and aviso_esquecido_min is null;

-- ----------------------------------------------------------------------------
-- 3 · D-198: o prazo e o aviso na linha do card (projeção — o fato é o evento)
-- ----------------------------------------------------------------------------
alter table public.plt_cards add column if not exists esquecido_vence_em timestamptz;
alter table public.plt_cards add column if not exists esquecido_aviso_em timestamptz;

comment on column public.plt_cards.esquecido_vence_em is
  'SESSAO-41 (D-198): quando o card em execução completa o prazo do setor sem parar (o último iniciar/retomar + plt_setores.aviso_esquecido_min). Nulo = não roda, ou o setor não avisa. Mantida pelo gatilho plt_cards_esquecido; o "Sim" da pergunta empurra mais um prazo.';
comment on column public.plt_cards.esquecido_aviso_em is
  'SESSAO-41 (D-198): a pergunta "ainda tem alguém?" está ABERTA desde aqui (= o instante do prazo). O "Não" pausa o card neste instante. Some quando alguém responde ou o card para de rodar.';

-- o despertador acha o próximo prazo; o quadro acha os esquecidos do setor
create index if not exists plt_cards_esquecido_vence_idx on public.plt_cards (esquecido_vence_em)
  where esquecido_vence_em is not null and esquecido_aviso_em is null;
create index if not exists plt_cards_esquecido_setor_idx on public.plt_cards (setor_atual_id)
  where esquecido_aviso_em is not null;

-- ----------------------------------------------------------------------------
-- 4 · O despertador: UM agendamento, no minuto do próximo prazo
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_card_esquecido_armar()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prox  timestamptz;
  v_alvo  timestamp;
  v_cron  text;
  v_job   bigint;
  v_sched text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;
  -- um de cada vez: dois gestos ao mesmo tempo não deixam o despertador para
  -- depois do card mais antigo (o segundo espera o primeiro e lê o que ele gravou)
  perform pg_advisory_xact_lock(hashtext('plt-card-esquecido'));

  select min(c.esquecido_vence_em) into v_prox
    from public.plt_cards c
   where c.esquecido_vence_em is not null and c.esquecido_aviso_em is null;
  select j.jobid, j.schedule into v_job, v_sched from cron.job j where j.jobname = 'plt-card-esquecido';

  if v_prox is null then
    if v_job is not null then
      perform cron.unschedule(v_job);
    end if;
    return;
  end if;

  -- o minuto (UTC — o relógio do pg_cron) em que o primeiro card completa o
  -- prazo, arredondado para cima; nunca um minuto que já começou
  v_alvo := date_trunc('minute', (greatest(v_prox, now()) at time zone 'UTC') + interval '59.999999 seconds');
  if v_alvo <= (now() at time zone 'UTC') then
    v_alvo := date_trunc('minute', now() at time zone 'UTC') + interval '1 minute';
  end if;
  v_cron := format('%s %s %s %s *', extract(minute from v_alvo)::int, extract(hour from v_alvo)::int,
                   extract(day from v_alvo)::int, extract(month from v_alvo)::int);
  if v_sched is distinct from v_cron then
    perform cron.schedule('plt-card-esquecido', v_cron, 'select plt_privado.fn_card_esquecido_disparar()');
  end if;
end;
$$;

comment on function plt_privado.fn_card_esquecido_armar() is
  'SESSAO-41 (D-198): marca (ou tira) o ÚNICO agendamento plt-card-esquecido no minuto do próximo prazo de card esquecido — sem card com prazo, não existe agendamento (Lei §4: nada de relógio que acorda para ver). Chamado no fato (gatilho do card) e no fim de cada disparo.';

create or replace function plt_privado.fn_card_esquecido_disparar(p_agora timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card   record;
  v_pessoa uuid;
  v_n      integer := 0;
  v_corpo  text;
begin
  perform pg_advisory_xact_lock(hashtext('plt-card-esquecido'));
  -- os avisos deste disparo não remarcam um a um: remarca uma vez, no fim
  perform set_config('plt.esquecido_disparando', 'on', true);

  for v_card in
    select c.id, c.setor_atual_id, c.executor_atual_id, c.esquecido_vence_em,
           s.nome as setor, s.aviso_esquecido_min as minutos,
           coalesce(nullif(btrim(c.titulo), ''), nullif(btrim(c.item_descricao), ''), 'Card ' || c.id) as nome,
           p.numero as pedido, u.nome as executor
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id
      left join public.pedidos p on p.id = c.pedido_id
      left join public.plt_usuarios u on u.id = c.executor_atual_id
     where c.esquecido_vence_em is not null and c.esquecido_aviso_em is null
       and c.esquecido_vence_em <= p_agora
     order by c.esquecido_vence_em, c.id
     for update of c skip locked
  loop
    -- a pergunta abre NO INSTANTE DO PRAZO (não na hora em que o despertador rodou)
    update public.plt_cards set esquecido_aviso_em = v_card.esquecido_vence_em where id = v_card.id;

    v_corpo := v_card.nome || coalesce(' · pedido ' || v_card.pedido, '')
               || ' está rodando há '
               || case when coalesce(v_card.minutos, 120) % 60 = 0
                       then (coalesce(v_card.minutos, 120) / 60)::text || ' h'
                       else coalesce(v_card.minutos, 120)::text || ' min' end
               || ' sem parar na ' || v_card.setor
               || coalesce(', com ' || v_card.executor, '')
               || '. Se ninguém está nele, toque em "Não, pausar o card" — o tempo depois do aviso não conta como trabalho.';

    -- para quem está no card (quem executa e quem auxilia) e os administradores
    for v_pessoa in
      select v_card.executor_atual_id where v_card.executor_atual_id is not null
      union
      select a.usuario_id from public.plt_auxilios a
       where a.card_id = v_card.id and a.encerrado_em is null
      union
      select u.id from public.plt_usuarios u
       where u.papel = 'admin' and u.ativo and u.arquivado_em is null and not u.conta_tablet
    loop
      insert into public.plt_notificacoes (destinatario_id, card_id, tipo, titulo, corpo)
        values (v_pessoa, v_card.id, 'card_esquecido', 'Urgente: ainda tem alguém neste card?', v_corpo);
    end loop;
    v_n := v_n + 1;
  end loop;

  perform set_config('plt.esquecido_disparando', '', true);
  perform plt_privado.fn_card_esquecido_armar();
  return v_n;
end;
$$;

comment on function plt_privado.fn_card_esquecido_disparar(timestamptz) is
  'SESSAO-41 (D-198): o despertador acordou — cada card cujo prazo passou (e ainda roda) abre a pergunta no instante do prazo e avisa, URGENTE, quem está no card e os administradores (plt_notificacoes tipo card_esquecido; o canal da pessoa leva na hora). Depois remarca o próximo. Idempotente: card já avisado não avisa de novo.';

-- ----------------------------------------------------------------------------
-- 5 · O prazo nasce e morre com o card rodando (gatilhos do card)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_card_esquecido_marcar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_min integer;
begin
  -- o gatilho só dispara quando quem executa, a pausa, o setor, o arquivo ou a
  -- conclusão mudaram: rodando agora = começou a rodar agora (iniciar, retomar,
  -- outro executor) → o prazo conta de novo; parado = sem prazo e sem pergunta
  if new.executor_atual_id is not null and new.pausado_em is null
     and new.arquivado_em is null and new.concluido_em is null and new.setor_atual_id is not null then
    select s.aviso_esquecido_min into v_min from public.plt_setores s where s.id = new.setor_atual_id;
  end if;
  if v_min is null then
    new.esquecido_vence_em := null;
    new.esquecido_aviso_em := null;
  else
    new.esquecido_vence_em := now() + make_interval(mins => v_min);
    new.esquecido_aviso_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists plt_cards_esquecido on public.plt_cards;
create trigger plt_cards_esquecido
  before update on public.plt_cards
  for each row
  when (old.executor_atual_id is distinct from new.executor_atual_id
        or old.pausado_em is distinct from new.pausado_em
        or old.arquivado_em is distinct from new.arquivado_em
        or old.concluido_em is distinct from new.concluido_em
        or old.setor_atual_id is distinct from new.setor_atual_id)
  execute function plt_privado.fn_card_esquecido_marcar();

create or replace function plt_privado.fn_card_esquecido_depois()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.esquecido_aviso_em is not null and new.esquecido_aviso_em is null then
    -- a pergunta acabou (respondida, ou o card parou de rodar): o aviso urgente
    -- sai do sino de todos
    update public.plt_notificacoes set lida_em = now()
     where card_id = new.id and tipo = 'card_esquecido' and lida_em is null;
  end if;
  if old.esquecido_aviso_em is distinct from new.esquecido_aviso_em and new.setor_atual_id is not null then
    -- o quadro do setor (o tablet) mostra ou tira a pergunta
    perform plt_privado.fn_avisar('setor_' || new.setor_atual_id);
  end if;
  if coalesce(current_setting('plt.esquecido_disparando', true), '') <> 'on' then
    perform plt_privado.fn_card_esquecido_armar();
  end if;
  return null;
end;
$$;

drop trigger if exists plt_cards_zz_esquecido on public.plt_cards;
create trigger plt_cards_zz_esquecido
  after update on public.plt_cards
  for each row
  when (old.esquecido_vence_em is distinct from new.esquecido_vence_em
        or old.esquecido_aviso_em is distinct from new.esquecido_aviso_em)
  execute function plt_privado.fn_card_esquecido_depois();

revoke all on function plt_privado.fn_card_esquecido_armar() from public, anon, authenticated;
revoke all on function plt_privado.fn_card_esquecido_disparar(timestamptz) from public, anon, authenticated;
revoke all on function plt_privado.fn_card_esquecido_marcar() from public, anon, authenticated;
revoke all on function plt_privado.fn_card_esquecido_depois() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6 · A porta da resposta: "Sim, ainda tem gente" / "Não, pausar o card"
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_card_esquecido_responder(
  p_card_id bigint, p_ainda_tem boolean, p_operador_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_usuario uuid;
  v_papel   text;
  v_lider   boolean;
  v_min     integer;
  v_aviso   timestamptz;
  v_quem    uuid[];
  v_u       uuid;
  v_motivo  text := 'Ninguém no card — aviso de card esquecido';
begin
  if p_ainda_tem is null then
    raise exception 'Diga se ainda tem alguém no card.' using errcode = 'invalid_parameter_value';
  end if;
  if plt_privado.fn_usuario_atual() is null then
    raise exception 'Entre na plataforma para responder.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id for update;
  if not found or v_card.arquivado_em is not null then
    raise exception 'Card % não existe.', p_card_id using errcode = 'no_data_found';
  end if;
  -- no tablet, quem digitou o PIN (e é do setor); no computador, quem está logado
  v_usuario := case when p_operador_id is null then plt_privado.fn_usuario_atual()
                    else plt_privado.fn_autor_do_gesto(v_card.setor_atual_id, p_operador_id) end;

  -- quem responde: quem está no card, o líder do setor ou um administrador
  select u.papel into v_papel from public.plt_usuarios u where u.id = v_usuario and u.ativo;
  select coalesce(bool_or(us.lider_do_setor), false) into v_lider
    from public.plt_usuario_setores us
   where us.usuario_id = v_usuario and us.setor_id = v_card.setor_atual_id;
  if v_papel is distinct from 'admin' and not v_lider
     and v_usuario is distinct from v_card.executor_atual_id
     and not exists (select 1 from public.plt_auxilios a
                      where a.card_id = p_card_id and a.usuario_id = v_usuario and a.encerrado_em is null) then
    raise exception 'Responder é de quem está no card, do líder do setor ou de um administrador.'
      using errcode = 'insufficient_privilege';
  end if;

  -- já respondida (por outra pessoa) ou o card parou de rodar: nada a fazer
  if v_card.esquecido_aviso_em is null then
    return jsonb_build_object('situacao', 'respondido');
  end if;
  v_aviso := v_card.esquecido_aviso_em;

  if p_ainda_tem then
    -- "Sim": segue rodando; se passar mais um prazo sem parar, pergunta de novo
    select s.aviso_esquecido_min into v_min from public.plt_setores s where s.id = v_card.setor_atual_id;
    update public.plt_cards
       set esquecido_aviso_em = null,
           esquecido_vence_em = now() + make_interval(mins => coalesce(v_min, 120))
     where id = p_card_id;
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
      values (v_usuario, 'card_esquecido_sim',
              jsonb_build_object('card_id', p_card_id, 'avisado_em', v_aviso));
    return jsonb_build_object('situacao', 'seguiu',
                              'proximo_aviso', now() + make_interval(mins => coalesce(v_min, 120)));
  end if;

  -- "Não": a pausa vale NO INSTANTE DO AVISO (o fato é gravado agora, com o
  -- instante em que valeu — eventos só se acrescentam). O trecho de quem estava
  -- no card fecha ali (fn_presenca_recalcular lê as duas marcas abaixo).
  select array_agg(distinct q.x) into v_quem
    from (select v_card.executor_atual_id as x
          union all
          select a.usuario_id from public.plt_auxilios a
           where a.card_id = p_card_id and a.encerrado_em is null) q
   where q.x is not null;
  perform set_config('plt.presenca_agora', v_aviso::text, true);
  perform set_config('plt.presenca_quem', array_to_string(coalesce(v_quem, '{}'::uuid[]), ','), true);
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, observacao, dados, ocorrido_em)
    values (p_card_id, 'execucao_pausada', v_usuario, 'interface', v_motivo,
            jsonb_build_object('motivo', v_motivo, 'motivo_id', null, 'card_esquecido', true,
                               'avisado_em', v_aviso, 'respondido_em', now()),
            v_aviso);
  perform set_config('plt.presenca_agora', '', true);
  perform set_config('plt.presenca_quem', '', true);
  -- avisado há mais de 1 h: a saída do setor no instante certo (D-189)
  foreach v_u in array coalesce(v_quem, '{}'::uuid[]) loop
    perform plt_privado.fn_presenca_expirar(v_u, now());
  end loop;
  return jsonb_build_object('situacao', 'pausado', 'pausado_em', v_aviso);
end;
$$;

comment on function public.plt_fn_card_esquecido_responder(bigint, boolean, uuid) is
  'SESSAO-41 (D-198): a resposta à pergunta "ainda tem alguém neste card?". Sim → segue e pergunta de novo em mais um prazo. Não → pausa o card no INSTANTE DO AVISO (o tempo depois não conta; a presença de quem estava no card fecha ali, sem carência). Quem: quem está no card (no tablet, p_operador_id = o PIN), o líder do setor ou admin. Já respondida → {situacao: respondido}.';

revoke all on function public.plt_fn_card_esquecido_responder(bigint, boolean, uuid) from public, anon;
grant execute on function public.plt_fn_card_esquecido_responder(bigint, boolean, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 7 · fn_presenca_recalcular — recriada da versão viva (a da 20261027010000):
--     o "Não" do card esquecido fecha o trecho no instante do aviso
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plt_privado.fn_presenca_recalcular(p_usuario uuid, p_agora timestamp with time zone DEFAULT now())
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_estado   text;
  v_setor    bigint;
  v_especial boolean := false;
  v_carencia boolean := false;
  v_parte    record;
  v_seg      public.plt_presenca_segmentos%rowtype;
  v_atual    public.plt_presenca_atual%rowtype;
  v_ovr      timestamptz;
  v_esquecido boolean := false;
begin
  if p_usuario is null then
    return;
  end if;
  if exists (select 1 from public.plt_usuarios u where u.id = p_usuario and u.conta_tablet) then
    return; -- a conta do aparelho não é uma pessoa
  end if;

  -- SESSAO-41 · ajuste (D-198): o "Não tem ninguém" do card esquecido pausa o
  -- card NO INSTANTE DO AVISO — o trecho de quem estava no card fecha ali (o
  -- tempo depois do aviso não conta como trabalho) e o que vem depois nasce
  -- sem carência. Só para as pessoas do card (a lista vem da porta) e só se o
  -- trecho aberto começou antes do aviso.
  v_ovr := nullif(current_setting('plt.presenca_agora', true), '')::timestamptz;
  if v_ovr is not null and v_ovr < p_agora
     and p_usuario::text = any (string_to_array(coalesce(current_setting('plt.presenca_quem', true), ''), ','))
     and exists (select 1 from public.plt_presenca_segmentos s
                  where s.usuario_id = p_usuario and s.fim is null and s.inicio < v_ovr) then
    p_agora := v_ovr;
    v_esquecido := true;
  end if;

  -- SESSAO-41 (D-189): 1 h ausente = saiu do setor sozinho (materializa no
  -- instante certo, antes de olhar o estado de agora)
  perform plt_privado.fn_presenca_expirar(p_usuario, p_agora);

  select c.setor_atual_id into v_setor
    from public.plt_cards c
   where c.executor_atual_id = p_usuario and c.pausado_em is null
     and c.arquivado_em is null and c.concluido_em is null
   limit 1;
  if v_setor is not null then
    v_estado := 'trabalhando';
  else
    select c.setor_atual_id into v_setor
      from public.plt_auxilios a
      join public.plt_cards c on c.id = a.card_id
     where a.usuario_id = p_usuario and a.encerrado_em is null and a.pausado_em is null
     limit 1;
    if v_setor is not null then
      v_estado := 'trabalhando';
    else
      select * into v_atual from public.plt_presenca_atual where usuario_id = p_usuario;
      if v_atual.usuario_id is not null and v_atual.setor_id is not null then
        v_estado := 'ausente';
        v_setor := v_atual.setor_id;
        -- SESSAO-38 (D-165): parada mais recente por motivo especial → não conta
        v_especial := coalesce((select h.especial from public.plt_pessoa_pausas h
                                 where h.usuario_id = p_usuario and h.fim is null
                                 order by h.inicio desc, h.id desc
                                 limit 1), false);
        -- SESSAO-41 (D-189): sem card nenhum (não é pausa da pessoa) → carência
        v_carencia := not exists (select 1 from public.plt_pessoa_pausas h
                                   where h.usuario_id = p_usuario and h.fim is null);
      elsif v_atual.usuario_id is not null then
        v_estado := 'deriva';
        v_setor := null;
      else
        v_estado := null;
      end if;
    end if;
  end if;

  -- SESSAO-41 · ajuste (D-198): depois do card esquecido, sem carência
  if v_esquecido then
    v_carencia := false;
  end if;

  select * into v_seg from public.plt_presenca_segmentos
   where usuario_id = p_usuario and fim is null
   for update;

  if v_seg.id is not null then
    if v_seg.estado = v_estado and v_seg.setor_id is not distinct from v_setor
       and v_seg.especial = v_especial and v_seg.carencia = v_carencia then
      return; -- nada mudou
    end if;
    if v_seg.inicio >= p_agora then
      -- trocas no mesmo instante (um gesto que mexe em vários cards): o
      -- segmento de duração zero sai em vez de poluir a história
      delete from public.plt_presenca_segmentos where id = v_seg.id;
    else
      update public.plt_presenca_segmentos set fim = p_agora where id = v_seg.id;
      -- SESSAO-41 (D-189): soma pelas partes (carência, teto de 1 h do ausente)
      for v_parte in
        select * from plt_privado.fn_presenca_partes(v_seg.estado, v_seg.especial, v_seg.carencia,
                                                     v_seg.inicio, p_agora)
      loop
        perform plt_privado.fn_tempos_dia_somar(p_usuario, v_parte.estado, v_seg.setor_id,
                                                v_parte.inicio, v_parte.fim);
      end loop;
    end if;
    if v_seg.setor_id is not null then
      perform plt_privado.fn_avisar('setor_' || v_seg.setor_id);
    end if;
  end if;

  if v_estado is not null then
    insert into public.plt_presenca_segmentos (usuario_id, estado, setor_id, inicio, especial, carencia)
      values (p_usuario, v_estado, v_setor, p_agora, v_especial, v_carencia);
    if v_setor is not null then
      perform plt_privado.fn_avisar('setor_' || v_setor);
    end if;
  end if;
  perform plt_privado.fn_avisar('tempos');
end;
$function$;

-- ----------------------------------------------------------------------------
-- 8 · plt_fn_quadro_setor — recriada da versão viva (a da 20261027010000):
--     + `esquecidos` (a pergunta no tablet)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plt_fn_quadro_setor(p_setor_id bigint, p_por_coluna integer DEFAULT 10, p_ordem text DEFAULT NULL::text, p_filtro text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_n       integer := least(greatest(coalesce(p_por_coluna, 10), 1), 50);
  v_ordem   text := plt_privado.fn_ordem_do_quadro(p_ordem);
  v_colunas jsonb := '[]'::jsonb;
  v_ids     bigint[] := '{}';
  v_pagina  bigint[];
  v_total   integer;
  r         record;
  v_so      bigint[];
begin
  if not plt_privado.fn_pode_ver_quadro(p_setor_id) then
    raise exception 'Você não vê o quadro deste setor.' using errcode = 'insufficient_privilege';
  end if;
  -- SESSAO-40 (D-187): os cards do setor que batem com o filtro — UMA vez
  -- (nulo = sem filtro; vazio = nada bate)
  v_so := plt_privado.fn_quadro_filtrados(p_setor_id, p_filtro);

  for r in
    select null::bigint as etapa_id, -1 as ordem, 0::bigint as id
    union all
    select e.id, e.ordem, e.id from public.plt_etapas e where e.setor_id = p_setor_id and e.ativa
    order by 2, 3
  loop
    v_pagina := plt_privado.fn_quadro_pagina(p_setor_id, r.etapa_id, null, null, v_n, v_ordem, v_so);
    v_total := plt_privado.fn_quadro_total(p_setor_id, r.etapa_id, v_so);
    v_colunas := v_colunas || jsonb_build_array(jsonb_build_object(
                   'etapa_id', r.etapa_id, 'total', v_total, 'cards', plt_privado.fn_quadro_cards(v_pagina)));
    v_ids := v_ids || v_pagina;
  end loop;

  return jsonb_build_object(
    'setor_id', p_setor_id,
    'por_coluna', v_n,
    'ordem', v_ordem,
    -- SESSAO-40 (D-187): o filtro que valeu (nulo = o quadro inteiro)
    'filtro', (select case when x.ativo then coalesce(x.numero, x.nome) end
                 from plt_privado.fn_filtro_do_quadro(p_filtro) x),
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'setor_id', e.setor_id, 'nome', e.nome, 'ordem', e.ordem,
                                          'eh_fila', e.eh_fila, 'eh_danificado', e.eh_danificado, 'ativa', e.ativa,
                                          'setor_destino_id', e.setor_destino_id, 'conclui_producao', e.conclui_producao,
                                          'pede_motivo', e.pede_motivo)
                       order by e.ordem, e.id)
        from public.plt_etapas e where e.setor_id = p_setor_id and e.ativa), '[]'::jsonb),
    'colunas', v_colunas,
    'etiquetas', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'cor', t.cor,
                                                               'arquivada_em', t.arquivada_em) order by t.nome)
                             from public.plt_etiquetas t), '[]'::jsonb),
    'campos', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'opcoes', f.opcoes,
                                                            'em_pecas', f.em_pecas, 'em_pedidos', f.em_pedidos,
                                                            'em_avulsos', f.em_avulsos, 'arquivado_em', f.arquivado_em)
                                         order by f.nome)
                          from public.plt_campos f), '[]'::jsonb),
    'presencas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'usuario_id', u.id, 'nome', u.nome, 'foto', u.foto_caminho,
               'estado', ef.estado, 'desde', s.inicio, 'carencia', s.carencia)
             order by u.nome)
        from public.plt_presenca_segmentos s
        join public.plt_usuarios u on u.id = s.usuario_id
        cross join lateral (select plt_privado.fn_presenca_estado_efetivo(s.estado, s.carencia, s.inicio, now()) as estado) ef
       where s.fim is null and s.setor_id = p_setor_id and ef.estado is not null), '[]'::jsonb),
    -- SESSAO-41 · ajuste (D-198): os cards esquecidos do setor (a pergunta
    -- "ainda tem alguém?" no tablet) — pelo índice parcial, mesmo fora da 1ª página
    'esquecidos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'card_id', c.id,
               'nome', coalesce(nullif(btrim(c.titulo), ''), nullif(btrim(c.item_descricao), ''), 'Card ' || c.id),
               'pedido', p.numero, 'aviso_em', c.esquecido_aviso_em,
               'executor_id', c.executor_atual_id, 'executor', u.nome)
             order by c.esquecido_aviso_em, c.id)
        from public.plt_cards c
        left join public.pedidos p on p.id = c.pedido_id
        left join public.plt_usuarios u on u.id = c.executor_atual_id
       where c.setor_atual_id = p_setor_id and c.esquecido_aviso_em is not null), '[]'::jsonb)
  ) || plt_privado.fn_quadro_junto(v_ids);
end;
$function$;

-- ----------------------------------------------------------------------------
-- 9 · Os cards que JÁ rodam na MONTAGEM ganham o prazo pelo último
--     iniciar/retomar (o que já passou de 2 h pergunta no próximo minuto)
-- ----------------------------------------------------------------------------
update public.plt_cards c
   set esquecido_vence_em = (select max(e.ocorrido_em)
                               from public.plt_eventos e
                              where e.card_id = c.id and e.tipo in ('execucao_iniciada', 'execucao_retomada'))
                            + make_interval(mins => s.aviso_esquecido_min)
  from public.plt_setores s
 where s.id = c.setor_atual_id and s.aviso_esquecido_min is not null
   and c.executor_atual_id is not null and c.pausado_em is null
   and c.arquivado_em is null and c.concluido_em is null
   and c.esquecido_vence_em is null
   and exists (select 1 from public.plt_eventos e
                where e.card_id = c.id and e.tipo in ('execucao_iniciada', 'execucao_retomada'));
