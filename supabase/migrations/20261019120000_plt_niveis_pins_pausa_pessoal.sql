-- ============================================================================
-- SESSAO-37 · Níveis novos, pausa da pessoa e o ajudar geral (D-147)
--
-- O pedido do dono (19/10, na conversa — plataforma entra em produção hoje):
--   1. Dois níveis novos de cadastro:
--      · 'producao'  — a pessoa da LINHA DE PRODUÇÃO: navega só nos setores de
--        produção (os dela livres; outro setor pede o PIN daquele setor), no
--        chat e nos afazeres dela. O resto da plataforma não existe para ela.
--      · 'logistica' — acompanha a produção SÓ OLHANDO (nenhum gesto de card),
--        e recebe o módulo de logística (expedição, estoque, aguardo, rotas,
--        pedidos) e o painel pessoal completo.
--   2. A pausa pela PESSOA (botão geral e painel de pessoas) não derruba o
--      card: quem sai é só a pessoa — o card segue com quem ficou e só vai a
--      Pausado quando o último ativo se pausa. A pausa DO CARD (gesto no card)
--      continua pausando o card e as ajudas juntas.
--   3. Porta nova "ajudar em tudo": um gesto entra como auxiliar em TODOS os
--      cards em execução do setor de uma vez.
-- (Os PINs encurtados — setor 2 dígitos, pessoa 2 a 4 — vivem na função de
--  autenticação, que valida o formato; o banco guarda só hash e busca.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · Os níveis novos no cadastro
-- ----------------------------------------------------------------------------
alter table public.plt_usuarios drop constraint if exists plt_usuarios_papel_check;
alter table public.plt_usuarios add constraint plt_usuarios_papel_check
  check (papel in ('operador', 'lider', 'admin', 'producao', 'logistica')) not valid;

comment on column public.plt_usuarios.papel is
  'Nível de acesso: operador, lider, admin e (SESSAO-37/D-147) producao (linha de produção — só os setores de produção, chat e afazeres) e logistica (produção só de olhar + módulo de logística + painel pessoal). O entregador continua sendo o módulo "entregas" sem o da fábrica.';

-- ----------------------------------------------------------------------------
-- 2 · Quem é logística — recriada POR INTEIRO a partir da versão viva
--     (migration do entregador): + o nível 'logistica'.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_eh_logistica(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.plt_usuarios u
                  where u.id = p_usuario and u.ativo
                    -- SESSAO-37 (D-147): o nível logistica É logística, sem depender de setor
                    and u.papel in ('admin', 'logistica'))
      or exists (select 1
                   from public.plt_usuario_setores us
                   join public.plt_usuarios u on u.id = us.usuario_id and u.ativo
                   join public.plt_setores  s on s.id = us.setor_id
                  where us.usuario_id = p_usuario
                    -- SESSAO-30: o entregador (módulo entregas sem o da fábrica) não é logística
                    and not ('entregas' = any (u.modulos) and not 'fabrica' = any (u.modulos))
                    and s.papel_no_fluxo in ('entrada', 'terminal'));
$$;

-- Recriada POR INTEIRO a partir da mesma migration: + o nível 'logistica'.
create or replace function plt_privado.fn_pode_ver_expedicao()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select plt_privado.fn_eh_admin()
      -- SESSAO-37 (D-147): o nível logistica vê a expedição por definição
      or exists (
           select 1 from public.plt_usuarios u
            where u.auth_user_id = auth.uid() and u.ativo and u.papel = 'logistica'
         )
      or exists (
           select 1
             from public.plt_usuario_setores us
             join public.plt_usuarios u on u.id = us.usuario_id
             join public.plt_setores s on s.id = us.setor_id
            where u.auth_user_id = auth.uid()
              and u.ativo
              -- SESSAO-30: o entregador (módulo "entregas" sem o da fábrica) não é logística
              and not ('entregas' = any (u.modulos) and not 'fabrica' = any (u.modulos))
              and s.papel_no_fluxo in ('entrada', 'terminal')
         );
$$;

comment on function plt_privado.fn_pode_ver_expedicao() is
  'Expedição/logística (D-01/D-22): admin, o nível logistica (D-147), e gente da entrada (PCP) e dos terminais COM o módulo da fábrica. O entregador (módulo "entregas" sem a fábrica) fica de fora.';

-- ----------------------------------------------------------------------------
-- 3 · fn_autor_do_gesto — recriada POR INTEIRO a partir da versão viva
--     (migration da presença/auxiliares): o nível logistica não move card —
--     ele acompanha a produção só olhando (D-147).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_autor_do_gesto(p_setor_id bigint, p_operador_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao uuid;
begin
  v_sessao := plt_privado.fn_usuario_atual();
  if v_sessao is null then
    raise exception 'Só usuário ativo da plataforma move cards.' using errcode = 'insufficient_privilege';
  end if;
  -- SESSAO-37 (D-147): a logística acompanha a produção só olhando.
  if p_operador_id is null and exists (
       select 1 from public.plt_usuarios u where u.id = v_sessao and u.papel = 'logistica'
     ) then
    raise exception 'A logística acompanha a produção só olhando — mover e executar é gesto do pessoal da produção.'
      using errcode = 'insufficient_privilege';
  end if;
  if not (plt_privado.fn_eh_admin()
          or p_setor_id in (select plt_privado.fn_setores_do_usuario())) then
    raise exception 'Você não trabalha no setor deste card.' using errcode = 'insufficient_privilege';
  end if;
  if p_operador_id is null or p_operador_id = v_sessao then
    return v_sessao;
  end if;
  if not exists (select 1 from public.plt_usuarios u where u.id = p_operador_id and u.ativo) then
    raise exception 'Operador não encontrado ou inativo — confira a identificação.'
      using errcode = 'check_violation';
  end if;
  -- SESSAO-37 (D-147): identificado pelo PIN, o nível logistica também não executa.
  if exists (select 1 from public.plt_usuarios u where u.id = p_operador_id and u.papel = 'logistica') then
    raise exception 'A logística acompanha a produção só olhando — mover e executar é gesto do pessoal da produção.'
      using errcode = 'insufficient_privilege';
  end if;
  if not (
    exists (select 1 from public.plt_usuarios u where u.id = p_operador_id and u.papel = 'admin')
    or exists (select 1 from public.plt_usuario_setores us
                where us.usuario_id = p_operador_id and us.setor_id = p_setor_id)
    -- SESSAO-36 (D-146): setores sem fronteira — quem pode auxiliar age em
    -- qualquer setor de produção, identificado pelo PIN.
    or exists (select 1 from public.plt_usuarios u
                where u.id = p_operador_id and u.pode_auxiliar)
  ) then
    raise exception 'O operador identificado não trabalha neste setor e o cadastro dele não permite auxiliar em outros setores.'
      using errcode = 'insufficient_privilege';
  end if;
  return p_operador_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4 · A pausa é da PESSOA (D-147): quando a pausa veio de um gesto pessoal
--     (pausa geral ou saída do setor), as ajudas NÃO pausam junto — o card
--     segue com quem ficou. A pausa DO CARD (gesto no card, sem o marcador)
--     continua pausando as ajudas juntas, como antes.
--     fn_auxilios_acompanhar recriada POR INTEIRO a partir da migration da
--     presença/auxiliares.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_auxilios_acompanhar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_aux  record;
  v_como text;
begin
  if new.tipo in ('movimentacao_setor', 'movimentacao_etapa') then
    v_como := 'movimentacao';
  elsif new.tipo = 'execucao_finalizada' or new.tipo = 'avulso_concluido' then
    v_como := 'conclusao';
  elsif new.tipo = 'card_arquivado' then
    v_como := 'arquivado';
  end if;

  if v_como is not null then
    for v_aux in
      select a.usuario_id from public.plt_auxilios a
       where a.card_id = new.card_id and a.encerrado_em is null
    loop
      insert into public.plt_eventos (card_id, tipo, origem, usuario_id, ocorrido_em, evento_referencia_id, dados)
        values (new.card_id, 'auxilio_encerrado', 'automacao', v_aux.usuario_id, new.ocorrido_em,
                null, jsonb_build_object('como', v_como));
    end loop;

  elsif new.tipo = 'execucao_pausada' then
    -- SESSAO-37 (D-147): pausa de gesto PESSOAL não derruba as ajudas.
    if coalesce(new.dados ->> 'pausa_geral', 'false') <> 'true'
       and coalesce(new.dados ->> 'saida', 'false') <> 'true' then
      for v_aux in
        select a.usuario_id from public.plt_auxilios a
         where a.card_id = new.card_id and a.encerrado_em is null and a.pausado_em is null
      loop
        insert into public.plt_eventos (card_id, tipo, origem, usuario_id, ocorrido_em, dados)
          values (new.card_id, 'auxilio_pausado', 'automacao', v_aux.usuario_id, new.ocorrido_em,
                  jsonb_build_object('motivo', coalesce(new.dados ->> 'motivo', 'Card pausado'), 'junto_com_o_card', true));
      end loop;
    end if;

  elsif new.tipo = 'execucao_retomada' then
    for v_aux in
      select a.usuario_id from public.plt_auxilios a
       where a.card_id = new.card_id and a.encerrado_em is null and a.pausado_em is not null
         and coalesce((select e.dados ->> 'junto_com_o_card'
                         from public.plt_eventos e
                        where e.id = (select max(e2.id) from public.plt_eventos e2
                                       where e2.card_id = new.card_id and e2.tipo = 'auxilio_pausado'
                                         and e2.usuario_id = a.usuario_id)), 'false') = 'true'
    loop
      insert into public.plt_eventos (card_id, tipo, origem, usuario_id, ocorrido_em)
        values (new.card_id, 'auxilio_retomado', 'automacao', v_aux.usuario_id, new.ocorrido_em);
    end loop;
  end if;

  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5 · AJUDAR EM TUDO (D-147): um gesto entra como auxiliar em todos os cards
--     em execução do setor. Card a card, a guarda do auxílio decide (limite,
--     setor, pode_auxiliar…) — o que ela recusar é pulado, e a porta devolve
--     em quantos entrou.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_setor_auxiliar_todos(
  p_setor_id    bigint,
  p_operador_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pessoa     uuid := plt_privado.fn_pessoa_do_gesto(p_operador_id);
  v_card       record;
  v_candidatos integer := 0;
  v_n          integer := 0;
begin
  for v_card in
    select c.id from public.plt_cards c
     where c.setor_atual_id = p_setor_id
       and c.executor_atual_id is not null
       and c.executor_atual_id <> v_pessoa
       and c.arquivado_em is null and c.concluido_em is null
       and not exists (select 1 from public.plt_auxilios a
                        where a.card_id = c.id and a.usuario_id = v_pessoa
                          and a.encerrado_em is null)
       -- card totalmente parado (pausado e sem ajuda ativa) fica de fora
       and (c.pausado_em is null
            or exists (select 1 from public.plt_auxilios a2
                        where a2.card_id = c.id and a2.encerrado_em is null
                          and a2.pausado_em is null))
     order by c.id
  loop
    v_candidatos := v_candidatos + 1;
    begin
      insert into public.plt_eventos (card_id, tipo, origem, usuario_id)
        values (v_card.id, 'auxilio_iniciado', 'interface', v_pessoa);
      v_n := v_n + 1;
    exception when others then
      null; -- a guarda recusou este card (limite, setor…) — segue para o próximo
    end;
  end loop;

  if v_candidatos = 0 then
    raise exception 'Nenhum card em execução para ajudar neste setor agora.'
      using errcode = 'check_violation';
  end if;
  if v_n = 0 then
    raise exception 'Nenhum card aceitou a ajuda — confira se a pessoa pode auxiliar neste setor.'
      using errcode = 'check_violation';
  end if;
  return v_n;
end;
$$;

comment on function public.plt_fn_setor_auxiliar_todos(bigint, uuid) is
  'SESSAO-37 (D-147): o botão "ajudar em tudo" do topo da coluna em execução — entra como auxiliar em todos os cards em execução do setor de uma vez (tempo próprio por card). No tablet, a pessoa é a do PIN; no computador, a da sessão.';

revoke all on function public.plt_fn_setor_auxiliar_todos(bigint, uuid) from public, anon;
grant execute on function public.plt_fn_setor_auxiliar_todos(bigint, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 6 · Valida o que este arquivo recriou (E-19: valida sempre a mais nova)
-- ----------------------------------------------------------------------------
alter table public.plt_usuarios validate constraint plt_usuarios_papel_check;

-- ----------------------------------------------------------------------------
-- 7 · O AJUDAR EM TUDO exige que o auxílio não esbarre no limite do setor:
--     o limite por pessoa (D-48) volta a valer SÓ para iniciar execução —
--     ajudar nunca é barrado por ele (D-147, decisão provisória: quem ajuda
--     em vários cards continua barrado de INICIAR um card próprio enquanto
--     as ajudas estiverem abertas). fn_validar_auxilio recriada POR INTEIRO
--     a partir da migration da presença, sem o bloco do limite.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_auxilio()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_aux     public.plt_auxilios%rowtype;
  v_pessoa  public.plt_usuarios%rowtype;
begin
  if new.tipo not in ('auxilio_iniciado', 'auxilio_pausado', 'auxilio_retomado', 'auxilio_encerrado') then
    return new;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  if not found then
    raise exception 'Card % não existe.', new.card_id using errcode = 'foreign_key_violation';
  end if;
  if new.usuario_id is null then
    raise exception 'Auxiliar é gesto de pessoa: é preciso dizer quem.' using errcode = 'check_violation';
  end if;

  new.setor_origem_id := coalesce(new.setor_origem_id, v_card.setor_atual_id);
  new.etapa_origem_id := coalesce(new.etapa_origem_id, v_card.etapa_atual_id);

  if new.tipo = 'auxilio_iniciado' then
    select * into v_pessoa from public.plt_usuarios u where u.id = new.usuario_id and u.ativo;
    if v_pessoa.id is null then
      raise exception 'Auxiliar exige um usuário ativo da plataforma.' using errcode = 'check_violation';
    end if;
    if v_pessoa.conta_tablet then
      raise exception 'A conta do tablet não trabalha em card — identifique a pessoa pelo PIN.' using errcode = 'check_violation';
    end if;
    -- SESSAO-37 (D-147): o nível logística acompanha só olhando.
    if v_pessoa.papel = 'logistica' then
      raise exception 'A logística acompanha a produção só olhando — mover e executar é gesto do pessoal da produção.'
        using errcode = 'insufficient_privilege';
    end if;
    if v_card.arquivado_em is not null or v_card.concluido_em is not null then
      raise exception 'Este card já saiu da produção — não há o que auxiliar.' using errcode = 'check_violation';
    end if;
    if v_card.executor_atual_id is null then
      -- D-146: o botão Auxiliar existe no card EM EXECUÇÃO.
      raise exception 'Este card não está em execução — inicie-o em vez de auxiliar.' using errcode = 'check_violation';
    end if;
    if v_card.executor_atual_id = new.usuario_id then
      raise exception 'Esta pessoa já executa este card.' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.plt_auxilios a
                where a.card_id = new.card_id and a.usuario_id = new.usuario_id and a.encerrado_em is null) then
      raise exception 'Esta pessoa já está auxiliando este card.' using errcode = 'check_violation';
    end if;
    -- Setores sem fronteira (D-146): gente do setor, quem pode auxiliar, ou admin.
    if v_pessoa.papel <> 'admin'
       and not coalesce(v_pessoa.pode_auxiliar, false)
       and not exists (select 1 from public.plt_usuario_setores us
                        where us.usuario_id = new.usuario_id and us.setor_id = v_card.setor_atual_id) then
      raise exception 'Esta pessoa não trabalha neste setor e o cadastro dela não permite auxiliar em outros setores.'
        using errcode = 'insufficient_privilege';
    end if;
    -- D-147: o limite do setor NÃO barra o auxílio (o "ajudar em tudo" entra
    -- em todos os cards de uma vez); ele segue contando as ajudas ao INICIAR.

  else
    -- pausar / retomar / encerrar apontam o auxílio aberto da pessoa no card
    select a.* into v_aux from public.plt_auxilios a
     where a.card_id = new.card_id and a.usuario_id = new.usuario_id and a.encerrado_em is null;
    if v_aux.id is null then
      raise exception 'Esta pessoa não está auxiliando este card.' using errcode = 'check_violation';
    end if;
    if new.evento_referencia_id is null then
      new.evento_referencia_id := v_aux.evento_inicio_id;
    end if;
    if new.tipo = 'auxilio_pausado' then
      if v_aux.pausado_em is not null then
        raise exception 'Este auxílio já está pausado.' using errcode = 'check_violation';
      end if;
      if nullif(btrim(coalesce(new.dados ->> 'motivo', '')), '') is null then
        raise exception 'Diga o motivo da pausa.' using errcode = 'check_violation';
      end if;
    elsif new.tipo = 'auxilio_retomado' then
      if v_aux.pausado_em is null then
        raise exception 'Este auxílio não está pausado — não há o que retomar.' using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8 · A dashboard de tempos DETALHADA (pedido do dono, 19/10): o card de cada
--     pessoa abre os números POR SETOR — produção × ausente — e a PRODUÇÃO por
--     móvel (tempo, tempo parado e os motivos), tudo na MESMA requisição
--     (Lei §2 — a tela não volta ao banco para desenhar o card).
--     A forma das portas não muda (o detalhe vive dentro do jsonb por_setor):
--     create or replace, sem drop — o site no ar não quebra.
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempos_pessoas(
  p_de           date default null,   -- dia inicial (Fortaleza); nulo = hoje − 6
  p_ate          date default null,   -- dia final; nulo = hoje
  p_limite       integer default 50,
  p_deslocamento integer default 0
)
returns table (
  usuario_id    uuid,
  nome          text,
  foto_caminho  text,
  papel         text,
  estado        text,         -- trabalhando · ausente · deriva · nulo (fora)
  estado_desde  timestamptz,
  estado_setor_id bigint,
  producao_s    bigint,
  ausente_s     bigint,
  deriva_s      bigint,
  por_setor     jsonb,        -- [{setor_id, nome, producao_s, ausente_s, cards: [...]}]
  contagem_total integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu       uuid := plt_privado.fn_usuario_atual();
  v_todos    boolean;
  v_de       date;
  v_ate      date;
  v_de_ts    timestamptz;
  v_ate_ts   timestamptz;
  v_limite   integer := least(greatest(coalesce(p_limite, 50), 1), 100);
  v_desloc   integer := greatest(coalesce(p_deslocamento, 0), 0);
begin
  if v_eu is null then
    raise exception 'Entre na plataforma primeiro.' using errcode = 'insufficient_privilege';
  end if;
  v_todos := plt_privado.fn_tempos_ve_todos();
  v_ate := coalesce(p_ate, (now() at time zone 'America/Fortaleza')::date);
  v_de  := coalesce(p_de, v_ate - 6);
  if v_de > v_ate then
    raise exception 'O começo do período vem antes do fim.' using errcode = 'check_violation';
  end if;
  if v_ate - v_de > 92 then
    raise exception 'O período da dashboard vai até 3 meses por vez.' using errcode = 'check_violation';
  end if;
  v_de_ts  := (v_de::timestamp at time zone 'America/Fortaleza');
  v_ate_ts := ((v_ate + 1)::timestamp at time zone 'America/Fortaleza');

  return query
  with pessoas as (
    select u.id, u.nome, u.foto_caminho, u.papel,
           count(*) over ()::integer as total
      from public.plt_usuarios u
     where u.ativo and not u.conta_tablet
       and (v_todos or u.id = v_eu)
     order by u.nome, u.id
     limit v_limite offset v_desloc
  ),
  fechado as (
    select t.usuario_id, t.estado, t.setor_id, sum(t.segundos)::bigint as segundos
      from public.plt_tempos_pessoa_dia t
      join pessoas p on p.id = t.usuario_id
     where t.dia between v_de and v_ate
     group by 1, 2, 3
  ),
  aberto as (
    select p.id as usuario_id, a.estado, a.setor_id, a.segundos
      from pessoas p
      cross join lateral plt_privado.fn_tempos_aberto(p.id, v_de_ts, v_ate_ts) a
     where a.segundos > 0
  ),
  tudo as (
    select * from fechado
    union all
    select * from aberto
  ),
  somas as (
    select t.usuario_id,
           coalesce(sum(t.segundos) filter (where t.estado = 'trabalhando'), 0)::bigint as producao_s,
           coalesce(sum(t.segundos) filter (where t.estado = 'ausente'), 0)::bigint as ausente_s,
           coalesce(sum(t.segundos) filter (where t.estado = 'deriva'), 0)::bigint as deriva_s
      from tudo t
     group by 1
  ),
  -- a produção por MÓVEL (execuções e auxílios da pessoa no período, com o
  -- tempo parado e os motivos) — tudo clipado ao período
  cards_exec as (
    select v.usuario_inicio_id as usuario_id, v.setor_id, v.card_id,
           floor(extract(epoch from v.duracao))::bigint as segundos,
           floor(extract(epoch from coalesce(v.pausa_total, interval '0')))::bigint as pausado_s,
           v.em_andamento, false as auxiliar,
           (select coalesce(jsonb_agg(distinct e.dados ->> 'motivo')
                     filter (where nullif(e.dados ->> 'motivo', '') is not null), '[]'::jsonb)
              from public.plt_eventos e
             where e.card_id = v.card_id and e.tipo = 'execucao_pausada'
               and e.ocorrido_em >= v.iniciou_em
               and e.ocorrido_em <= coalesce(v.finalizou_em, now())) as motivos
      from public.plt_vw_execucoes v
      join pessoas p on p.id = v.usuario_inicio_id
     where v.iniciou_em < v_ate_ts
       and coalesce(v.finalizou_em, now()) >= v_de_ts
  ),
  cards_aux as (
    select a.usuario_id, a.setor_id, a.card_id,
           (a.segundos + case when a.ultimo_inicio is null then 0
             else greatest(0, floor(extract(epoch from now() - a.ultimo_inicio)))::bigint end) as segundos,
           0::bigint as pausado_s,
           (a.encerrado_em is null) as em_andamento, true as auxiliar,
           case when nullif(a.pausa_motivo, '') is null then '[]'::jsonb
                else jsonb_build_array(a.pausa_motivo) end as motivos
      from public.plt_auxilios a
      join pessoas p on p.id = a.usuario_id
     where a.iniciado_em < v_ate_ts
       and coalesce(a.encerrado_em, now()) >= v_de_ts
  ),
  cards_tudo as (
    select * from cards_exec
    union all
    select * from cards_aux
  ),
  cards_por_setor as (
    select c.usuario_id, c.setor_id,
           jsonb_agg(jsonb_build_object(
             'card_id', c.card_id,
             'rotulo', plt_privado.fn_card_rotulo(c.card_id),
             'segundos', c.segundos, 'pausado_s', c.pausado_s,
             'em_andamento', c.em_andamento, 'auxiliar', c.auxiliar,
             'motivos', c.motivos)
           order by c.segundos desc) as cards
      from (select ct.*, row_number() over (partition by ct.usuario_id order by ct.segundos desc) as n
              from cards_tudo ct) c
     where c.n <= 30  -- teto do card da pessoa; o resto vive no detalhe
     group by 1, 2
  ),
  setores as (
    select t.usuario_id,
           jsonb_agg(jsonb_build_object(
             'setor_id', t.setor_id, 'nome', s.nome,
             'producao_s', t.producao_s, 'ausente_s', t.ausente_s,
             'cards', coalesce(cs.cards, '[]'::jsonb))
           order by t.producao_s desc, t.ausente_s desc) as por_setor
      from (select t2.usuario_id, t2.setor_id,
                   coalesce(sum(t2.segundos) filter (where t2.estado = 'trabalhando'), 0)::bigint as producao_s,
                   coalesce(sum(t2.segundos) filter (where t2.estado = 'ausente'), 0)::bigint as ausente_s
              from tudo t2
             where t2.setor_id is not null
             group by 1, 2) t
      join public.plt_setores s on s.id = t.setor_id
      left join cards_por_setor cs on cs.usuario_id = t.usuario_id and cs.setor_id = t.setor_id
     group by 1
  )
  select p.id, p.nome, p.foto_caminho, p.papel,
         seg.estado, seg.inicio, seg.setor_id,
         coalesce(so.producao_s, 0), coalesce(so.ausente_s, 0), coalesce(so.deriva_s, 0),
         coalesce(st.por_setor, '[]'::jsonb),
         p.total
    from pessoas p
    left join public.plt_presenca_segmentos seg
           on seg.usuario_id = p.id and seg.fim is null
    left join somas so on so.usuario_id = p.id
    left join setores st on st.usuario_id = p.id
   order by p.nome, p.id;
end;
$$;

comment on function public.plt_fn_tempos_pessoas(date, date, integer, integer) is
  'SESSAO-36/37: o scorecard de tempos por pessoa — estado de agora + produção/ausente/à deriva, e (pedido do dono, 19/10) o detalhe POR SETOR no próprio card: produção × ausente e a produção por móvel com tempo parado e motivos (teto de 30 cards; o resto no detalhe). Tudo numa requisição. Líder/admin veem todos; o funcionário só o próprio.';

-- O detalhe da pessoa (segunda visualização): por_setor ganha ausente_s e os
-- cards com pausa/motivos; execuções e auxílios ganham o tempo parado.
create or replace function public.plt_fn_tempos_pessoa_detalhe(
  p_usuario uuid,
  p_de      date default null,
  p_ate     date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     uuid := plt_privado.fn_usuario_atual();
  v_de     date;
  v_ate    date;
  v_de_ts  timestamptz;
  v_ate_ts timestamptz;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma primeiro.' using errcode = 'insufficient_privilege';
  end if;
  if p_usuario is distinct from v_eu and not plt_privado.fn_tempos_ve_todos() then
    raise exception 'Cada um vê o próprio tempo; o de todos é visão da liderança.' using errcode = 'insufficient_privilege';
  end if;
  v_ate := coalesce(p_ate, (now() at time zone 'America/Fortaleza')::date);
  v_de  := coalesce(p_de, v_ate - 6);
  if v_de > v_ate or v_ate - v_de > 92 then
    raise exception 'Período inválido (até 3 meses por vez).' using errcode = 'check_violation';
  end if;
  v_de_ts  := (v_de::timestamp at time zone 'America/Fortaleza');
  v_ate_ts := ((v_ate + 1)::timestamp at time zone 'America/Fortaleza');

  return jsonb_build_object(
    'usuario', (select jsonb_build_object('id', u.id, 'nome', u.nome, 'foto_caminho', u.foto_caminho, 'papel', u.papel)
                  from public.plt_usuarios u where u.id = p_usuario),
    'estado', (select jsonb_build_object('estado', s.estado, 'desde', s.inicio, 'setor_id', s.setor_id)
                 from public.plt_presenca_segmentos s
                where s.usuario_id = p_usuario and s.fim is null),
    'dias', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia,
               'producao_s', d.producao_s, 'ausente_s', d.ausente_s, 'deriva_s', d.deriva_s)
             order by d.dia)
        from (select t.dia,
                     coalesce(sum(t.segundos) filter (where t.estado = 'trabalhando'), 0)::bigint as producao_s,
                     coalesce(sum(t.segundos) filter (where t.estado = 'ausente'), 0)::bigint as ausente_s,
                     coalesce(sum(t.segundos) filter (where t.estado = 'deriva'), 0)::bigint as deriva_s
                from public.plt_tempos_pessoa_dia t
               where t.usuario_id = p_usuario and t.dia between v_de and v_ate
               group by t.dia) d), '[]'::jsonb),
    'aberto', coalesce((
      select jsonb_agg(jsonb_build_object('estado', a.estado, 'setor_id', a.setor_id, 'segundos', a.segundos))
        from plt_privado.fn_tempos_aberto(p_usuario, v_de_ts, v_ate_ts) a
       where a.segundos > 0), '[]'::jsonb),
    -- por setor: produção × ausente (agregado + trecho aberto)
    'por_setor', coalesce((
      select jsonb_agg(jsonb_build_object('setor_id', x.setor_id, 'nome', s.nome,
               'producao_s', x.producao_s, 'ausente_s', x.ausente_s)
             order by x.producao_s desc, x.ausente_s desc)
        from (select t.setor_id,
                     coalesce(sum(t.segundos) filter (where t.estado = 'trabalhando'), 0)::bigint as producao_s,
                     coalesce(sum(t.segundos) filter (where t.estado = 'ausente'), 0)::bigint as ausente_s
                from (select d.estado, d.setor_id, d.segundos
                        from public.plt_tempos_pessoa_dia d
                       where d.usuario_id = p_usuario and d.dia between v_de and v_ate
                      union all
                      select a.estado, a.setor_id, a.segundos
                        from plt_privado.fn_tempos_aberto(p_usuario, v_de_ts, v_ate_ts) a
                       where a.segundos > 0) t
               where t.setor_id is not null
               group by t.setor_id) x
        join public.plt_setores s on s.id = x.setor_id), '[]'::jsonb),
    -- os cards do período: execuções com o tempo parado e os motivos
    'execucoes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'card_id', v.card_id, 'setor_id', v.setor_id, 'etapa_id', v.etapa_id,
               'setor', (select s.nome from public.plt_setores s where s.id = v.setor_id),
               'iniciou_em', v.iniciou_em, 'finalizou_em', v.finalizou_em,
               'em_andamento', v.em_andamento,
               'segundos', floor(extract(epoch from v.duracao))::bigint,
               'pausado_s', floor(extract(epoch from coalesce(v.pausa_total, interval '0')))::bigint,
               'motivos', (select coalesce(jsonb_agg(distinct e.dados ->> 'motivo')
                             filter (where nullif(e.dados ->> 'motivo', '') is not null), '[]'::jsonb)
                             from public.plt_eventos e
                            where e.card_id = v.card_id and e.tipo = 'execucao_pausada'
                              and e.ocorrido_em >= v.iniciou_em
                              and e.ocorrido_em <= coalesce(v.finalizou_em, now())),
               'rotulo', plt_privado.fn_card_rotulo(v.card_id))
             order by v.iniciou_em desc)
        from (select * from public.plt_vw_execucoes vv
               where vv.usuario_inicio_id = p_usuario
                 and vv.iniciou_em < v_ate_ts
                 and coalesce(vv.finalizou_em, now()) >= v_de_ts
               order by vv.iniciou_em desc limit 100) v), '[]'::jsonb),
    'auxilios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'card_id', a.card_id, 'setor_id', a.setor_id,
               'setor', (select s.nome from public.plt_setores s where s.id = a.setor_id),
               'iniciado_em', a.iniciado_em, 'encerrado_em', a.encerrado_em,
               'segundos', a.segundos + case when a.ultimo_inicio is null then 0
                 else greatest(0, floor(extract(epoch from now() - a.ultimo_inicio)))::bigint end,
               'motivo', a.pausa_motivo,
               'rotulo', plt_privado.fn_card_rotulo(a.card_id))
             order by a.iniciado_em desc)
        from (select * from public.plt_auxilios aa
               where aa.usuario_id = p_usuario
                 and aa.iniciado_em < v_ate_ts
                 and coalesce(aa.encerrado_em, now()) >= v_de_ts
               order by aa.iniciado_em desc limit 100) a), '[]'::jsonb)
  );
end;
$$;

comment on function public.plt_fn_tempos_pessoa_detalhe(uuid, date, date) is
  'SESSAO-36/37: o detalhe da pessoa na dashboard de tempos — dia a dia, por setor (produção × ausente) e os cards com tempo parado e motivos. O próprio, ou líder/admin.';
