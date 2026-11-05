-- ============================================================================
-- SESSAO-43 · F1/F2/F3 (05/11/2026) — A TELA TEMPOS DE PRODUÇÃO, A CONFERÊNCIA
-- E O MODO TV.
--
-- Só LÊ o cálculo único da SESSAO-42 (passagens, trechos, tempo padrão, resumos)
-- e o histórico do Trello (migration anterior) — não recalcula tempo em lugar
-- nenhum. Uma porta por aba, pedida só no clique (Lei §3); listas por cursor
-- (Lei §6); ao vivo pelo canal do setor que já existe (Lei §4).
--
--   · plt_tempo_montagens + plt_tempo_montagem_pessoas — a PROJEÇÃO de leitura
--     (Lei §7.1): um móvel por linha (as passagens que SAÍRAM do setor, sem as
--     de teste, + o histórico do Trello, num formato só — a origem diz de onde
--     veio) e uma linha por pessoa de cada móvel; mantida pelos gatilhos de
--     comando das passagens, da equipe e do Trello. vw_tempo_montagens é a
--     leitura dela com os nomes das portas. (A 1ª versão lia a união das
--     origens a cada abertura e passava de 300 ms no ensaio ×100 — E-192.)
--   · Quem vê: admin e líder do setor veem tudo; o funcionário da fábrica vê só
--     o que ELE montou (a regra de hoje); a conta só do Modo TV não abre nada
--     daqui (recusa no banco, além da guarda da tela).
--   · Conferir: a decisão manual da 42 (plt_fn_tempo_decidir) para a plataforma
--     e uma porta própria para o histórico do Trello (o rastro na trilha).
--   · Modo TV: a permissão "tv" mora em plt_usuarios.modulos (onde moram
--     fábrica, comercial e entregas — o gancho do token segue pendente); a
--     porta da TV devolve só LETRAS (a Equipe no painel), nunca nome, foto ou
--     etiqueta — nem para o admin; o canal do setor fica aberto para a TV.
--   · Motivos de conferência: a lista nova em Utilitários.
-- Nada aqui altera tabela da integração.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · MOTIVOS DE CONFERÊNCIA (lista em Utilitários) — o check recriado com o
--     tipo novo e VALIDADO aqui (E-19/E-144: o validate saiu da 20261027040000)
-- ----------------------------------------------------------------------------
alter table public.plt_motivos drop constraint if exists plt_motivos_tipo_ck;
alter table public.plt_motivos add constraint plt_motivos_tipo_ck
  check (tipo in ('nao_entregue', 'desfazer_entrega', 'devolucao', 'pausa', 'saida', 'standby', 'mover',
                  'entrega_parcial', 'conferencia')) not valid;
alter table public.plt_motivos validate constraint plt_motivos_tipo_ck;

insert into public.plt_motivos (tipo, texto, ordem) values
  ('conferencia', 'Conferido com quem montou', 10),
  ('conferencia', 'Card esquecido aberto', 20),
  ('conferencia', 'Esqueceu de iniciar ou de soltar o card', 30),
  ('conferencia', 'Montagem em lote', 40),
  ('conferencia', 'Teste ou treino', 50)
on conflict (tipo, lower(btrim(texto))) do nothing;

-- recriada da versão viva (migration 20261027040000) — só o tipo novo na lista
CREATE OR REPLACE FUNCTION public.plt_fn_motivo_salvar(p_id bigint, p_tipo text, p_texto text, p_ordem integer DEFAULT NULL::integer, p_ativo boolean DEFAULT true, p_especial boolean DEFAULT NULL::boolean)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id       bigint;
  v_especial boolean;
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'Cadastrar motivo é gesto de admin.' using errcode = 'insufficient_privilege';
  end if;
  -- SESSAO-38 (D-169): + os motivos de stand-by; SESSAO-39 (D-173): + os do Mover
  -- SESSAO-43: + os motivos de conferência (Considerar / Descartar um tempo)
  if p_tipo not in ('nao_entregue', 'desfazer_entrega', 'devolucao', 'pausa', 'saida', 'standby', 'mover', 'entrega_parcial', 'conferencia') then
    raise exception 'Tipo de motivo desconhecido.' using errcode = 'check_violation';
  end if;
  if char_length(btrim(coalesce(p_texto, ''))) not between 2 and 80 then
    raise exception 'O motivo precisa ter de 2 a 80 letras — uma frase curta.' using errcode = 'check_violation';
  end if;
  if coalesce(p_especial, false) and p_tipo <> 'pausa' then
    raise exception 'Só motivo de pausa pode ser especial.' using errcode = 'check_violation';
  end if;
  if p_id is null then
    insert into public.plt_motivos (tipo, texto, ordem, ativo, especial)
      values (p_tipo, btrim(p_texto), coalesce(p_ordem, 100), coalesce(p_ativo, true), coalesce(p_especial, false))
      returning id, especial into v_id, v_especial;
  else
    update public.plt_motivos
       set texto = btrim(p_texto), ordem = coalesce(p_ordem, ordem), ativo = coalesce(p_ativo, ativo),
           especial = coalesce(p_especial, especial),
           atualizado_em = now()
     where id = p_id and tipo = p_tipo
     returning id, especial into v_id, v_especial;
    if v_id is null then
      raise exception 'Motivo não encontrado.' using errcode = 'no_data_found';
    end if;
  end if;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), 'motivo_salvo',
            jsonb_build_object('motivo_id', v_id, 'tipo', p_tipo, 'texto', btrim(p_texto),
                               'ativo', coalesce(p_ativo, true), 'especial', v_especial));
  return v_id;
exception when unique_violation then
  raise exception 'Já existe esse motivo.' using errcode = 'unique_violation';
end;
$function$;
revoke all on function public.plt_fn_motivo_salvar(bigint, text, text, integer, boolean, boolean) from public, anon;
grant execute on function public.plt_fn_motivo_salvar(bigint, text, text, integer, boolean, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 2 · A PERMISSÃO MODO TV — "tv" em plt_usuarios.modulos (D-91: onde moram
--     fábrica, comercial e entregas). É EXPLÍCITA: o admin também precisa dela
--     ligada para ter o botão (a porta da TV aceita o admin mesmo assim).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tem_modo_tv(p_usuario uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select 'tv' = any (u.modulos) from public.plt_usuarios u
                    where u.id = coalesce(p_usuario, plt_privado.fn_usuario_atual()) and u.ativo), false);
$$;
revoke all on function plt_privado.fn_tem_modo_tv(uuid) from public, anon, authenticated;

-- a conta SÓ do Modo TV: tem "tv" e nenhum outro módulo, e não é admin
create or replace function plt_privado.fn_eh_so_tv(p_usuario uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select 'tv' = any (u.modulos) and u.papel <> 'admin'
                          and not (u.modulos && array['fabrica', 'comercial', 'entregas']::text[])
                     from public.plt_usuarios u
                    where u.id = coalesce(p_usuario, plt_privado.fn_usuario_atual())), false);
$$;
revoke all on function plt_privado.fn_eh_so_tv(uuid) from public, anon, authenticated;

create or replace function public.plt_fn_usuario_modo_tv(p_usuario_id uuid, p_ligado boolean, p_so_tv boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_u    public.plt_usuarios%rowtype;
  v_mods text[];
begin
  if not plt_privado.fn_eh_admin() then
    raise exception 'Ligar o Modo TV é gesto de administrador.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_u from public.plt_usuarios u where u.id = p_usuario_id for update;
  if v_u.id is null then
    raise exception 'Pessoa não encontrada.' using errcode = 'no_data_found';
  end if;
  if v_u.conta_tablet then
    raise exception 'A conta do tablet não abre o Modo TV.' using errcode = 'check_violation';
  end if;
  v_mods := array_remove(coalesce(v_u.modulos, '{}'), 'tv');
  if coalesce(p_ligado, false) and coalesce(p_so_tv, false) then
    if v_u.papel = 'admin' then
      raise exception 'Um administrador não pode ser conta só da TV.' using errcode = 'check_violation';
    end if;
    v_mods := array['tv'];
  elsif coalesce(p_ligado, false) then
    if not (v_mods && array['fabrica', 'comercial', 'entregas']::text[]) then
      v_mods := array['fabrica'] || v_mods;
    end if;
    v_mods := v_mods || 'tv'::text;
  elsif not (v_mods && array['fabrica', 'comercial', 'entregas']::text[]) then
    v_mods := array['fabrica'] || v_mods;   -- desligou a conta só da TV: volta a ser da fábrica
  end if;
  update public.plt_usuarios set modulos = v_mods where id = v_u.id;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (plt_privado.fn_usuario_atual(), 'usuario_modo_tv',
            jsonb_build_object('usuario_id', v_u.id, 'nome', v_u.nome, 'ligado', coalesce(p_ligado, false),
                               'so_tv', coalesce(p_ligado, false) and coalesce(p_so_tv, false),
                               'antes', to_jsonb(v_u.modulos), 'modulos', to_jsonb(v_mods)));
  return jsonb_build_object('modulos', to_jsonb(v_mods));
end;
$$;
comment on function public.plt_fn_usuario_modo_tv(uuid, boolean, boolean) is
  'SESSAO-43 (F3): liga/desliga a permissão Modo TV de uma pessoa (o módulo "tv"); p_so_tv = a conta SÓ da TV (módulos = {tv} — entra direto na TV e não abre outra tela). Só admin; trilha usuario_modo_tv.';
revoke all on function public.plt_fn_usuario_modo_tv(uuid, boolean, boolean) from public, anon;
grant execute on function public.plt_fn_usuario_modo_tv(uuid, boolean, boolean) to authenticated;

-- o canal do setor também para a TV (a TV ouve "mudou" e relê a porta dela —
-- o aviso não leva dado). Recriada POR INTEIRO da versão viva (20261018210000).
create or replace function plt_privado.fn_aviso_pode_ouvir(p_topico text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
           when p_topico in ('plt-aviso:estoque', 'plt-aviso:aguardo', 'plt-aviso:pcp')
             then plt_privado.fn_pode_ver_expedicao()
           when p_topico = 'plt-aviso:rotas'
             then plt_privado.fn_pode_ver_expedicao()
               or plt_privado.fn_eh_entregador(plt_privado.fn_usuario_atual())
           -- SESSAO-31 (Lei §4): o quadro de um setor — quem vê aquele quadro.
           -- SESSAO-43: + quem tem o Modo TV, nos setores de produção.
           when p_topico ~ '^plt-aviso:setor_[0-9]{1,18}$'
             then plt_privado.fn_pode_ver_quadro(substring(p_topico from '^plt-aviso:setor_([0-9]+)$')::bigint)
               or (plt_privado.fn_tem_modo_tv()
                   and exists (select 1 from public.plt_setores s
                                where s.id = substring(p_topico from '^plt-aviso:setor_([0-9]+)$')::bigint
                                  and s.papel_no_fluxo = 'producao'))
           -- SESSAO-32: o "mudou" dos painéis não leva dado — quem está logado ouve.
           when p_topico = 'plt-aviso:painel'
             then plt_privado.fn_usuario_atual() is not null
           when p_topico = 'plt-aviso:danificados'
             then plt_privado.fn_pode_ver_expedicao()
           -- SESSAO-36: a dashboard de tempos por pessoa — o aviso não leva
           -- dado (a porta gateia o que cada um vê).
           when p_topico = 'plt-aviso:tempos'
             then plt_privado.fn_usuario_atual() is not null
           when p_topico ~ '^plt-aviso:lista_[0-9a-f]{32}$'
             then plt_privado.fn_tem_modulo('comercial')
           else false
         end;
$$;

-- ----------------------------------------------------------------------------
-- 3 · O QUE A TELA LÊ: uma PROJEÇÃO pronta (Lei §7.1) — uma linha por móvel
--     que saiu do setor (plataforma, sem as de teste) ou veio do histórico do
--     Trello, num formato só, com a chave da equipe já montada; e uma linha
--     por pessoa de cada móvel (montador ou ajudante, com o esforço dela).
--     Mantida no MESMO gesto que mede (gatilhos de comando sobre as passagens,
--     a equipe e o Trello). O ensaio ×100 provou: a leitura pela união das
--     tabelas de origem, com a equipe juntada e a chave montada linha a linha,
--     passava de 300 ms nas abas de período.
-- ----------------------------------------------------------------------------
create table if not exists public.plt_tempo_montagens (
  origem        text not null check (origem in ('plataforma', 'trello')),
  ref_id        bigint not null,                  -- a passagem (plataforma) ou a linha do Trello
  card_id       bigint,
  setor_id      bigint not null,
  dia           date not null,
  inicio        timestamptz,
  fim           timestamptz,
  modelo_id     bigint,
  execucao_s    numeric not null default 0,
  fila_s        numeric not null default 0,
  parado_s      numeric not null default 0,
  situacao      text not null,
  motivo        text,
  lote          boolean not null default false,
  retrabalho    boolean not null default false,
  desfecho      text,
  montado       boolean not null default false,  -- concluída e não descartada (conta como móvel montado)
  montadores    uuid[] not null default '{}',
  ajudantes     uuid[] not null default '{}',
  esforco       jsonb not null default '{}'::jsonb,
  chave         text not null default '',         -- os montadores em ordem, separados por vírgula (a série do gráfico)
  cortado       boolean not null default false,
  clique_errado boolean not null default false,
  decidida      boolean not null default false,
  primary key (origem, ref_id)
);
create index if not exists plt_tempo_montagens_setor_dia_idx on public.plt_tempo_montagens (setor_id, dia, fim);
create index if not exists plt_tempo_montagens_modelo_idx on public.plt_tempo_montagens (setor_id, modelo_id, fim);
create index if not exists plt_tempo_montagens_conferir_idx on public.plt_tempo_montagens (setor_id, dia) where situacao = 'conferir';
create index if not exists plt_tempo_montagens_card_idx on public.plt_tempo_montagens (card_id) where card_id is not null;
comment on table public.plt_tempo_montagens is
  'SESSAO-43: PROJEÇÃO de leitura — um móvel por linha (as passagens que saíram do setor, sem as de teste, e o histórico do Trello), com a equipe e a chave dos montadores prontas. Escrita SÓ pelos gatilhos de comando das passagens, da equipe e do Trello (fn_tempo_montagens_refazer). Dado derivado: sem chave estrangeira (a integridade vem da origem). Cresce com as passagens: 1 linha por móvel que sai de um setor.';
alter table public.plt_tempo_montagens enable row level security;
revoke all on public.plt_tempo_montagens from anon, authenticated;

create table if not exists public.plt_tempo_montagem_pessoas (
  origem      text not null,
  ref_id      bigint not null,
  papel       text not null check (papel in ('montador', 'ajudante')),
  usuario_id  uuid not null,
  setor_id    bigint not null,
  dia         date not null,
  modelo_id   bigint,
  execucao_s  numeric not null default 0,
  esforco_s   numeric not null default 0,       -- o esforço DELA nesse móvel (já dividido)
  situacao    text not null,
  montado     boolean not null default false,
  primary key (origem, ref_id, papel, usuario_id),
  foreign key (origem, ref_id) references public.plt_tempo_montagens (origem, ref_id) on delete cascade
);
create index if not exists plt_tempo_montagem_pessoas_setor_dia_idx on public.plt_tempo_montagem_pessoas (setor_id, dia);
create index if not exists plt_tempo_montagem_pessoas_pessoa_idx on public.plt_tempo_montagem_pessoas (usuario_id, dia);
comment on table public.plt_tempo_montagem_pessoas is
  'SESSAO-43: PROJEÇÃO de leitura — uma linha por pessoa de cada móvel de plt_tempo_montagens (montador ou ajudante), com o esforço dela. As abas Móveis e Montadores agrupam por pessoa daqui, sem desmontar listas linha a linha. Escrita SÓ por fn_tempo_montagens_refazer.';
alter table public.plt_tempo_montagem_pessoas enable row level security;
revoke all on public.plt_tempo_montagem_pessoas from anon, authenticated;

-- refaz as linhas de um punhado de móveis de UMA origem, a partir da origem
-- (o que deixou de valer sai; o que não mudou não é reescrito)
create or replace function plt_privado.fn_tempo_montagens_refazer(p_origem text, p_ids bigint[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return;
  end if;

  with novo as (
    select 'plataforma'::text as origem, ps.id as ref_id, ps.card_id, ps.setor_id, ps.dia,
           ps.primeiro_inicio as inicio, ps.saida_em as fim, ps.modelo_id,
           coalesce(ps.execucao_s, 0) as execucao_s, coalesce(ps.fila_s, 0) as fila_s, coalesce(ps.parado_s, 0) as parado_s,
           ps.situacao, ps.motivo, coalesce(ps.lote, false) as lote,
           (coalesce(ps.retrabalho_entrada, false) or ps.desfecho = 'retrabalho') as retrabalho,
           ps.desfecho,
           coalesce(eq.montadores, '{}'::uuid[]) as montadores,
           coalesce(eq.ajudantes, '{}'::uuid[]) as ajudantes,
           coalesce(eq.esforco, '{}'::jsonb) as esforco,
           coalesce(eq.cortado, false) as cortado,
           coalesce(eq.clique_errado, false) as clique_errado,
           ps.decisao_evento_id is not null as decidida
      from public.plt_tempo_passagens ps
      left join public.plt_tempo_passagem_equipe eq on eq.passagem_id = ps.id
     where p_origem = 'plataforma' and ps.id = any (p_ids)
       and ps.saida_em is not null and ps.dia is not null and ps.situacao <> 'teste'
    union all
    select 'trello', t.id, null::bigint, t.setor_id, t.dia, t.inicio, t.fim, t.modelo_id,
           coalesce(t.execucao_s, 0), 0::numeric, 0::numeric, t.situacao, t.motivo, coalesce(t.lote_n, 1) > 1, false,
           'concluida'::text, coalesce(t.pessoas, '{}'::uuid[]), '{}'::uuid[], coalesce(t.esforco, '{}'::jsonb),
           coalesce(t.cortado, false), false, t.decisao is not null
      from public.plt_tempo_trello t
     where p_origem = 'trello' and t.id = any (p_ids) and t.dia is not null
  ),
  pronto as (
    select n.*,
           (n.desfecho = 'concluida' and n.situacao <> 'descartada') as montado,
           (select coalesce(string_agg(x::text, ',' order by x::text), '') from unnest(n.montadores) x) as chave
      from novo n
  ),
  sai as (
    delete from public.plt_tempo_montagens m
     where m.origem = p_origem and m.ref_id = any (p_ids)
       and not exists (select 1 from pronto p where p.ref_id = m.ref_id)
  )
  insert into public.plt_tempo_montagens as m
    (origem, ref_id, card_id, setor_id, dia, inicio, fim, modelo_id, execucao_s, fila_s, parado_s, situacao, motivo,
     lote, retrabalho, desfecho, montado, montadores, ajudantes, esforco, chave, cortado, clique_errado, decidida)
  select p.origem, p.ref_id, p.card_id, p.setor_id, p.dia, p.inicio, p.fim, p.modelo_id, p.execucao_s, p.fila_s, p.parado_s,
         p.situacao, p.motivo, p.lote, p.retrabalho, p.desfecho, p.montado, p.montadores, p.ajudantes, p.esforco, p.chave,
         p.cortado, p.clique_errado, p.decidida
    from pronto p
  on conflict (origem, ref_id) do update
    set card_id = excluded.card_id, setor_id = excluded.setor_id, dia = excluded.dia, inicio = excluded.inicio,
        fim = excluded.fim, modelo_id = excluded.modelo_id, execucao_s = excluded.execucao_s, fila_s = excluded.fila_s,
        parado_s = excluded.parado_s, situacao = excluded.situacao, motivo = excluded.motivo, lote = excluded.lote,
        retrabalho = excluded.retrabalho, desfecho = excluded.desfecho, montado = excluded.montado,
        montadores = excluded.montadores, ajudantes = excluded.ajudantes, esforco = excluded.esforco,
        chave = excluded.chave, cortado = excluded.cortado, clique_errado = excluded.clique_errado,
        decidida = excluded.decidida
  where (m.card_id, m.setor_id, m.dia, m.inicio, m.fim, m.modelo_id, m.execucao_s, m.fila_s, m.parado_s, m.situacao,
         m.motivo, m.lote, m.retrabalho, m.desfecho, m.montado, m.montadores, m.ajudantes, m.esforco, m.chave,
         m.cortado, m.clique_errado, m.decidida)
        is distinct from
        (excluded.card_id, excluded.setor_id, excluded.dia, excluded.inicio, excluded.fim, excluded.modelo_id,
         excluded.execucao_s, excluded.fila_s, excluded.parado_s, excluded.situacao, excluded.motivo, excluded.lote,
         excluded.retrabalho, excluded.desfecho, excluded.montado, excluded.montadores, excluded.ajudantes,
         excluded.esforco, excluded.chave, excluded.cortado, excluded.clique_errado, excluded.decidida);

  -- as pessoas de cada móvel (lidas da linha que acabou de ser gravada)
  with alvo as (
    select distinct on (x.papel, x.usuario_id, m.ref_id)
           m.origem, m.ref_id, x.papel, x.usuario_id, m.setor_id, m.dia, m.modelo_id, m.execucao_s,
           coalesce((m.esforco ->> x.usuario_id::text)::numeric, 0) as esforco_s, m.situacao, m.montado
      from public.plt_tempo_montagens m
      cross join lateral (
        select u as usuario_id, 'montador'::text as papel from unnest(m.montadores) u
        union all
        select u, 'ajudante' from unnest(m.ajudantes) u
      ) x
     where m.origem = p_origem and m.ref_id = any (p_ids)
  ),
  sai as (
    delete from public.plt_tempo_montagem_pessoas q
     where q.origem = p_origem and q.ref_id = any (p_ids)
       and not exists (select 1 from alvo a
                        where a.ref_id = q.ref_id and a.papel = q.papel and a.usuario_id = q.usuario_id)
  )
  insert into public.plt_tempo_montagem_pessoas as q
    (origem, ref_id, papel, usuario_id, setor_id, dia, modelo_id, execucao_s, esforco_s, situacao, montado)
  select a.origem, a.ref_id, a.papel, a.usuario_id, a.setor_id, a.dia, a.modelo_id, a.execucao_s, a.esforco_s,
         a.situacao, a.montado
    from alvo a
  on conflict (origem, ref_id, papel, usuario_id) do update
    set setor_id = excluded.setor_id, dia = excluded.dia, modelo_id = excluded.modelo_id,
        execucao_s = excluded.execucao_s, esforco_s = excluded.esforco_s, situacao = excluded.situacao,
        montado = excluded.montado
  where (q.setor_id, q.dia, q.modelo_id, q.execucao_s, q.esforco_s, q.situacao, q.montado)
        is distinct from
        (excluded.setor_id, excluded.dia, excluded.modelo_id, excluded.execucao_s, excluded.esforco_s,
         excluded.situacao, excluded.montado);
end;
$$;
comment on function plt_privado.fn_tempo_montagens_refazer(text, bigint[]) is
  'SESSAO-43: refaz a projeção de leitura (plt_tempo_montagens + plt_tempo_montagem_pessoas) de um punhado de móveis de UMA origem (plataforma = passagens; trello = histórico) a partir da origem. O que deixou de valer sai; o que não mudou não é reescrito. Chamada pelos gatilhos de comando.';
revoke all on function plt_privado.fn_tempo_montagens_refazer(text, bigint[]) from public, anon, authenticated;

-- os gatilhos: de COMANDO (uma chamada por comando, com as linhas tocadas —
-- o recálculo de um card toca várias passagens de uma vez)
create or replace function plt_privado.fn_tempo_montagens_fato()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids bigint[];
begin
  if tg_table_name = 'plt_tempo_passagem_equipe' then
    select array_agg(distinct n.passagem_id) into v_ids from novas n;
    perform plt_privado.fn_tempo_montagens_refazer('plataforma', v_ids);
  elsif tg_op = 'DELETE' then
    select array_agg(distinct v.id) into v_ids from velhas v;
    perform plt_privado.fn_tempo_montagens_refazer(
      case when tg_table_name = 'plt_tempo_trello' then 'trello' else 'plataforma' end, v_ids);
  else
    select array_agg(distinct n.id) into v_ids from novas n;
    perform plt_privado.fn_tempo_montagens_refazer(
      case when tg_table_name = 'plt_tempo_trello' then 'trello' else 'plataforma' end, v_ids);
  end if;
  return null;
end;
$$;
revoke all on function plt_privado.fn_tempo_montagens_fato() from public, anon, authenticated;

drop trigger if exists plt_tempo_passagens_zz_montagens_ins on public.plt_tempo_passagens;
create trigger plt_tempo_passagens_zz_montagens_ins
  after insert on public.plt_tempo_passagens referencing new table as novas
  for each statement execute function plt_privado.fn_tempo_montagens_fato();
drop trigger if exists plt_tempo_passagens_zz_montagens_upd on public.plt_tempo_passagens;
create trigger plt_tempo_passagens_zz_montagens_upd
  after update on public.plt_tempo_passagens referencing new table as novas
  for each statement execute function plt_privado.fn_tempo_montagens_fato();
drop trigger if exists plt_tempo_passagens_zz_montagens_del on public.plt_tempo_passagens;
create trigger plt_tempo_passagens_zz_montagens_del
  after delete on public.plt_tempo_passagens referencing old table as velhas
  for each statement execute function plt_privado.fn_tempo_montagens_fato();
drop trigger if exists plt_tempo_passagem_equipe_zz_montagens_ins on public.plt_tempo_passagem_equipe;
create trigger plt_tempo_passagem_equipe_zz_montagens_ins
  after insert on public.plt_tempo_passagem_equipe referencing new table as novas
  for each statement execute function plt_privado.fn_tempo_montagens_fato();
drop trigger if exists plt_tempo_passagem_equipe_zz_montagens_upd on public.plt_tempo_passagem_equipe;
create trigger plt_tempo_passagem_equipe_zz_montagens_upd
  after update on public.plt_tempo_passagem_equipe referencing new table as novas
  for each statement execute function plt_privado.fn_tempo_montagens_fato();
drop trigger if exists plt_tempo_trello_zz_montagens_ins on public.plt_tempo_trello;
create trigger plt_tempo_trello_zz_montagens_ins
  after insert on public.plt_tempo_trello referencing new table as novas
  for each statement execute function plt_privado.fn_tempo_montagens_fato();
drop trigger if exists plt_tempo_trello_zz_montagens_upd on public.plt_tempo_trello;
create trigger plt_tempo_trello_zz_montagens_upd
  after update on public.plt_tempo_trello referencing new table as novas
  for each statement execute function plt_privado.fn_tempo_montagens_fato();
drop trigger if exists plt_tempo_trello_zz_montagens_del on public.plt_tempo_trello;
create trigger plt_tempo_trello_zz_montagens_del
  after delete on public.plt_tempo_trello referencing old table as velhas
  for each statement execute function plt_privado.fn_tempo_montagens_fato();

-- o que já existe entra na projeção (idempotente: o que não mudou não é reescrito)
select plt_privado.fn_tempo_montagens_refazer('plataforma',
         (select array_agg(ps.id) from public.plt_tempo_passagens ps where ps.saida_em is not null));
select plt_privado.fn_tempo_montagens_refazer('trello', (select array_agg(t.id) from public.plt_tempo_trello t));

-- a leitura das portas: a projeção com os nomes de sempre
create or replace view plt_privado.vw_tempo_montagens as
  select m.origem, m.ref_id as id, m.card_id, m.setor_id, m.dia, m.inicio, m.fim, m.modelo_id,
         m.execucao_s, m.fila_s, m.parado_s, m.situacao, m.motivo, m.lote, m.retrabalho, m.desfecho,
         m.montadores, m.ajudantes, m.esforco, m.cortado, m.clique_errado, m.decidida, m.chave, m.montado
    from public.plt_tempo_montagens m;
comment on view plt_privado.vw_tempo_montagens is
  'SESSAO-43: a projeção plt_tempo_montagens com os nomes que as portas da tela de tempos e do Modo TV usam (id = a passagem ou a linha do Trello). Lida só por elas.';
revoke all on plt_privado.vw_tempo_montagens from public, anon, authenticated;

-- quem vê o quê (e com qual filtro de pessoa)
create or replace function plt_privado.fn_tempos_acesso(
  p_setor_id bigint, p_usuario_id uuid,
  out o_pessoa uuid, out o_lider boolean, out o_setor_nome text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para ver os tempos.' using errcode = 'insufficient_privilege';
  end if;
  if plt_privado.fn_eh_so_tv(v_eu) then
    raise exception 'Esta conta abre só o Modo TV.' using errcode = 'insufficient_privilege';
  end if;
  select s.nome into o_setor_nome
    from public.plt_setores s where s.id = p_setor_id and s.papel_no_fluxo = 'producao';
  if o_setor_nome is null then
    raise exception 'Escolha um setor de produção.' using errcode = 'invalid_parameter_value';
  end if;
  o_lider := plt_privado.fn_eh_admin()
             or exists (select 1 from plt_privado.fn_setores_dashboard() d where d = p_setor_id);
  if o_lider then
    o_pessoa := p_usuario_id;
  else
    if not plt_privado.fn_tem_modulo('fabrica') then
      raise exception 'Os tempos de produção são da fábrica.' using errcode = 'insufficient_privilege';
    end if;
    o_pessoa := v_eu;   -- o funcionário vê só o que ele montou
  end if;
end;
$$;
revoke all on function plt_privado.fn_tempos_acesso(bigint, uuid) from public, anon, authenticated;

-- os dias úteis do período que TÊM registro: os dias de expediente do
-- calendário (feriado e dia parado fora; dia trabalhado e sábado liberado
-- dentro) desde a data oficial — e, com o histórico, os do período do Trello.
-- O buraco entre o fim do Trello e a data oficial não conta (não há registro).
create or replace function plt_privado.fn_tempos_dias_uteis(p_setor_id bigint, p_de date, p_ate date, p_trello boolean)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cob as (
    select greatest(p_de, coalesce((select c.data_oficial from public.plt_tempo_config c where c.id = 1), date '2026-10-26')) as de,
           p_ate as ate
    union all
    select greatest(p_de, min(t.dia)), least(p_ate, max(t.dia))
      from public.plt_tempo_trello t
     where coalesce(p_trello, true) and t.setor_id = p_setor_id
  )
  select count(distinct (lower(j) at time zone 'America/Fortaleza')::date)::int
    from cob
    cross join lateral unnest(plt_privado.fn_tempo_janelas(
      p_setor_id, cob.de::timestamp at time zone 'America/Fortaleza',
      (cob.ate + 1)::timestamp at time zone 'America/Fortaleza', null)) as j
   where cob.de is not null and cob.ate is not null and cob.de <= cob.ate;
$$;
revoke all on function plt_privado.fn_tempos_dias_uteis(bigint, date, date, boolean) from public, anon, authenticated;

-- o padrão que a tela usa: o oficial (sem o histórico) ou o com histórico
create or replace function plt_privado.fn_tempos_padroes(p_setor_id bigint, p_trello boolean)
returns table (modelo_id bigint, mediana_s numeric, n integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select d.modelo_id, d.mediana_s, d.n from public.plt_tempo_padrao d
   where d.setor_id = p_setor_id and not coalesce(p_trello, true)
  union all
  select h.modelo_id, h.mediana_s, h.n from public.plt_tempo_padrao_historico h
   where h.setor_id = p_setor_id and coalesce(p_trello, true);
$$;
revoke all on function plt_privado.fn_tempos_padroes(bigint, boolean) from public, anon, authenticated;

-- nome e foto de um punhado de pessoas (a tela junta as fotos pelo id)
create or replace function plt_privado.fn_tempos_pessoas(p_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_object_agg(u.id::text, jsonb_build_object('nome', u.nome, 'foto', u.foto_caminho)), '{}'::jsonb)
    from public.plt_usuarios u
   where u.id = any (coalesce(p_ids, '{}'));
$$;
revoke all on function plt_privado.fn_tempos_pessoas(uuid[]) from public, anon, authenticated;

-- quantos casos esperam a conferência no período (o contador da aba)
create or replace function plt_privado.fn_tempos_conferir_n(
  p_setor_id bigint, p_de date, p_ate date, p_pessoa uuid, p_trello boolean
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
    from plt_privado.vw_tempo_montagens m
   where m.setor_id = p_setor_id and m.situacao = 'conferir'
     and m.dia between p_de and p_ate
     and (m.origem = 'plataforma' or coalesce(p_trello, true))
     and (p_pessoa is null or p_pessoa = any (m.montadores));
$$;
revoke all on function plt_privado.fn_tempos_conferir_n(bigint, date, date, uuid, boolean) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4 · ABA DIA — números do dia, a linha do dia por pessoa e a tabela (cursor)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempos_dia(
  p_setor_id bigint, p_dia date, p_de date, p_ate date,
  p_usuario_id uuid default null, p_modelo_id bigint default null, p_trello boolean default true,
  p_depois_fim timestamptz default null, p_depois_origem text default null, p_depois_id bigint default null,
  p_limite integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ac     record;
  v_tr     boolean := coalesce(p_trello, true);
  v_dia    date := coalesce(p_dia, (now() at time zone 'America/Fortaleza')::date);
  v_lim    integer := least(greatest(coalesce(p_limite, 50), 1), 100);
  v_faixa  numeric := (plt_privado.fn_tempo_regra(p_setor_id)).faixa_media_pct / 100.0;
  v_mais   boolean := p_depois_fim is not null;
  v_num    jsonb;
  v_tab    jsonb;
  v_n      integer;
  v_linha  jsonb;
  v_ids    uuid[];
begin
  select * into v_ac from plt_privado.fn_tempos_acesso(p_setor_id, p_usuario_id);

  -- a tabela do dia (por cursor — fim, origem, id)
  with b as (
    select m.* from plt_privado.vw_tempo_montagens m
     where m.setor_id = p_setor_id and m.dia = v_dia
       and (m.origem = 'plataforma' or v_tr)
       and (v_ac.o_pessoa is null or v_ac.o_pessoa = any (m.montadores))
       and (p_modelo_id is null or m.modelo_id = p_modelo_id)
       and (not v_mais or (m.fim, m.origem, m.id) > (p_depois_fim, coalesce(p_depois_origem, ''), coalesce(p_depois_id, 0)))
     order by m.fim, m.origem, m.id
     limit v_lim + 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'origem', b.origem, 'id', b.id, 'card_id', b.card_id, 'inicio', b.inicio, 'fim', b.fim,
           'movel', coalesce(nullif(btrim(c.titulo), ''), nullif(btrim(c.item_descricao), ''), t.cartao_nome),
           'pedido', coalesce(pd.numero, t.pedido_numero), 'modelo_id', b.modelo_id, 'modelo', mo.nome,
           'montadores', to_jsonb(b.montadores), 'ajudantes', to_jsonb(b.ajudantes),
           'execucao_s', round(b.execucao_s), 'padrao_s', round(pa.mediana_s),
           'situacao', b.situacao, 'motivo', b.motivo, 'lote', b.lote, 'retrabalho', b.retrabalho,
           'cortado', b.cortado, 'decidida', b.decidida, 'desfecho', b.desfecho)
           order by b.fim, b.origem, b.id), '[]'::jsonb),
         count(*)
    into v_tab, v_n
    from b
    left join public.plt_cards c on b.origem = 'plataforma' and c.id = b.card_id
    left join public.pedidos pd on pd.id = c.pedido_id
    left join public.plt_tempo_trello t on b.origem = 'trello' and t.id = b.id
    left join public.plt_tempo_modelos mo on mo.id = b.modelo_id
    left join plt_privado.fn_tempos_padroes(p_setor_id, v_tr) pa on pa.modelo_id = b.modelo_id;
  if v_n > v_lim then
    v_tab := v_tab - v_lim;
  end if;
  if v_mais then
    select array_agg(distinct x::uuid) into v_ids
      from jsonb_array_elements(v_tab) r,
           lateral jsonb_array_elements_text((r -> 'montadores') || (r -> 'ajudantes')) x;
    return jsonb_build_object('tabela', jsonb_build_object('itens', v_tab, 'tem_mais', v_n > v_lim),
                              'pessoas', plt_privado.fn_tempos_pessoas(v_ids));
  end if;

  -- os números do dia (todas as linhas do dia, não só a página)
  with b as (
    select m.*, pa.mediana_s as padrao_s
      from plt_privado.vw_tempo_montagens m
      left join plt_privado.fn_tempos_padroes(p_setor_id, v_tr) pa on pa.modelo_id = m.modelo_id
     where m.setor_id = p_setor_id and m.dia = v_dia
       and (m.origem = 'plataforma' or v_tr)
       and (v_ac.o_pessoa is null or v_ac.o_pessoa = any (m.montadores))
       and (p_modelo_id is null or m.modelo_id = p_modelo_id)
  )
  select jsonb_build_object(
           'montados', count(*) filter (where b.desfecho = 'concluida' and b.situacao <> 'descartada'),
           'validas', count(*) filter (where b.situacao = 'valida'),
           'conferir', count(*) filter (where b.situacao = 'conferir'),
           'sem_registro', count(*) filter (where b.situacao = 'sem_registro' and b.desfecho = 'concluida'),
           'montadores', (select count(distinct p) from b b2 cross join lateral unnest(b2.montadores) p
                           where b2.desfecho = 'concluida' and b2.situacao <> 'descartada'),
           'tempo_total_s', round(coalesce(sum(b.execucao_s) filter (where b.situacao = 'valida'), 0)),
           'mediana_s', round((percentile_cont(0.5) within group (order by b.execucao_s) filter (where b.situacao = 'valida'))::numeric),
           'media_s', round(avg(b.execucao_s) filter (where b.situacao = 'valida')),
           'com_padrao', count(*) filter (where b.situacao = 'valida' and b.padrao_s is not null),
           'abaixo', count(*) filter (where b.situacao = 'valida' and b.padrao_s is not null
                                        and b.execucao_s < b.padrao_s * (1 - v_faixa)),
           'cobertura_total', count(*) filter (where b.desfecho = 'concluida' and b.situacao <> 'descartada'),
           'cobertura_com_tempo', count(*) filter (where b.desfecho = 'concluida' and b.situacao not in ('descartada', 'sem_registro')))
    into v_num
    from b;

  -- a linha do dia por pessoa: os trechos do dia (plataforma) e as montagens
  -- do histórico que começaram no dia; o expediente do dia para sombrear
  with tr as (
    select t.usuario_id, t.inicio, t.fim_conta as fim, t.card_id, t.papel, t.descartado,
           (t.fim is not null and (t.fim_tipo in ('fim_expediente', 'sem_resposta', 'esquecido')
                                   or (t.corte is not null and t.fim > t.corte))) as cortado,
           coalesce(nullif(btrim(c.titulo), ''), nullif(btrim(c.item_descricao), '')) as movel,
           'plataforma'::text as origem
      from public.plt_tempo_trechos t
      left join public.plt_cards c on c.id = t.card_id
     where t.setor_id = p_setor_id and t.dia = v_dia
       and (v_ac.o_pessoa is null or t.usuario_id = v_ac.o_pessoa)
    union all
    select p, t.inicio, least(t.fim, coalesce(plt_privado.fn_tempo_corte(t.setor_id, t.inicio, null), t.fim)),
           null, 'execucao', false, t.cortado, t.cartao_nome, 'trello'
      from public.plt_tempo_trello t
      cross join lateral unnest(t.pessoas) p
     where v_tr and t.setor_id = p_setor_id
       and t.inicio >= v_dia::timestamp at time zone 'America/Fortaleza'
       and t.inicio < (v_dia + 1)::timestamp at time zone 'America/Fortaleza'
       and (v_ac.o_pessoa is null or p = v_ac.o_pessoa)
    order by 2
    limit 2000
  )
  select jsonb_build_object(
           'janelas', coalesce((select jsonb_agg(jsonb_build_array(lower(j), upper(j)) order by lower(j))
                                  from unnest(plt_privado.fn_tempo_janelas(p_setor_id,
                                         v_dia::timestamp at time zone 'America/Fortaleza',
                                         (v_dia + 1)::timestamp at time zone 'America/Fortaleza', null)) j), '[]'::jsonb),
           'trechos', coalesce(jsonb_agg(jsonb_build_object(
                         'pessoa', tr.usuario_id, 'inicio', tr.inicio, 'fim', tr.fim, 'card_id', tr.card_id,
                         'movel', tr.movel, 'papel', tr.papel, 'descartado', tr.descartado, 'cortado', tr.cortado,
                         'origem', tr.origem) order by tr.usuario_id, tr.inicio), '[]'::jsonb))
    into v_linha
    from tr;

  select array_agg(distinct x::uuid) into v_ids
    from (select jsonb_array_elements_text((r -> 'montadores') || (r -> 'ajudantes')) as x
            from jsonb_array_elements(v_tab) r
          union all
          select tt ->> 'pessoa' from jsonb_array_elements(v_linha -> 'trechos') tt) q
   where x is not null;

  return jsonb_build_object(
    'setor', jsonb_build_object('id', p_setor_id, 'nome', v_ac.o_setor_nome),
    'dia', v_dia, 'pode_decidir', v_ac.o_lider, 'pessoa_travada', not v_ac.o_lider,
    'faixa_pct', round(v_faixa * 100),
    'numeros', v_num,
    'linha', v_linha,
    'tabela', jsonb_build_object('itens', v_tab, 'tem_mais', v_n > v_lim),
    'pessoas', plt_privado.fn_tempos_pessoas(v_ids),
    'conferir_n', case when v_ac.o_lider and p_de is not null and p_ate is not null
                       then plt_privado.fn_tempos_conferir_n(p_setor_id, p_de, p_ate, v_ac.o_pessoa, v_tr) end);
end;
$$;
comment on function public.plt_fn_tempos_dia(bigint, date, date, date, uuid, bigint, boolean, timestamptz, text, bigint, integer) is
  'SESSAO-43 (F1 · aba Dia): os números do dia (montados, para conferir, montadores, tempo total, mediana/média, abaixo do padrão, cobertura), a linha do dia por pessoa (trechos + o expediente) e a tabela por cursor (fim, origem, id; teto 100). Com o cursor devolve só a próxima página da tabela. Admin/líder do setor tudo; o funcionário só o dele.';

-- ----------------------------------------------------------------------------
-- 5 · ABA PERÍODO
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempos_periodo(
  p_setor_id bigint, p_de date, p_ate date,
  p_usuario_id uuid default null, p_modelo_id bigint default null, p_trello boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ac      record;
  v_tr      boolean := coalesce(p_trello, true);
  v_de      date := coalesce(p_de, (now() at time zone 'America/Fortaleza')::date - 29);
  v_ate     date := coalesce(p_ate, (now() at time zone 'America/Fortaleza')::date);
  v_semana  boolean;
  v_uteis   integer;
  v_ret     jsonb;
  v_ids     uuid[];
begin
  select * into v_ac from plt_privado.fn_tempos_acesso(p_setor_id, p_usuario_id);
  if v_ate < v_de or v_ate - v_de > 400 then
    raise exception 'O período vai até 12 meses.' using errcode = 'invalid_parameter_value';
  end if;
  v_semana := v_ate - v_de + 1 > 70;
  v_uteis := plt_privado.fn_tempos_dias_uteis(p_setor_id, v_de, v_ate, v_tr);

  with b as (
    select m.origem, m.dia, m.modelo_id, m.execucao_s, m.fila_s, m.parado_s, m.situacao, m.desfecho,
           m.retrabalho, m.montado, m.chave as k
      from plt_privado.vw_tempo_montagens m
     where m.setor_id = p_setor_id and m.dia between v_de and v_ate
       and (m.origem = 'plataforma' or v_tr)
       and (v_ac.o_pessoa is null or v_ac.o_pessoa = any (m.montadores))
       and (p_modelo_id is null or m.modelo_id = p_modelo_id)
  ),
  mont as (select * from b where b.montado),
  num as (
    select count(*) filter (where b.montado) as montados,
           count(*) filter (where b.situacao = 'valida') as validas,
           count(*) filter (where b.situacao = 'conferir') as conferir,
           count(*) filter (where b.desfecho = 'concluida' and b.situacao not in ('descartada', 'sem_registro')) as com_tempo,
           count(distinct b.dia) filter (where b.montado) as dias_com,
           coalesce(sum(b.execucao_s) filter (where b.situacao = 'valida'), 0) as total_s,
           percentile_cont(0.5) within group (order by b.execucao_s) filter (where b.situacao = 'valida') as mediana_s,
           avg(b.execucao_s) filter (where b.situacao = 'valida') as media_s,
           -- onde vai o tempo do setor (só a plataforma tem fila)
           coalesce(sum(b.fila_s) filter (where b.origem = 'plataforma' and b.situacao <> 'descartada'), 0) as fila_s,
           coalesce(sum(b.execucao_s) filter (where b.origem = 'plataforma' and b.situacao <> 'descartada'), 0) as exec_s,
           coalesce(sum(b.parado_s) filter (where b.origem = 'plataforma' and b.situacao <> 'descartada'), 0) as parado_s,
           count(*) filter (where b.retrabalho) as retrab_n,
           coalesce(sum(b.execucao_s) filter (where b.retrabalho), 0) as retrab_s,
           count(*) filter (where b.origem = 'plataforma') as n_plataforma,
           count(*) filter (where b.origem = 'trello') as n_trello
      from b
  ),
  barras as (
    select case when v_semana then date_trunc('week', mont.dia)::date else mont.dia end as balde, mont.k, count(*) as n
      from mont group by 1, 2
  ),
  series as (
    select k, sum(n) as n, row_number() over (order by sum(n) desc, k) as ordem from barras group by k
  ),
  porm as (
    select mont.k,
           count(*) as moveis,
           count(distinct mont.dia) as dias,
           percentile_cont(0.5) within group (order by mont.execucao_s) filter (where mont.situacao = 'valida') as mediana_s,
           coalesce(sum(mont.execucao_s) filter (where mont.situacao = 'valida'), 0) as total_s
      from mont group by mont.k
  ),
  top as (
    select mont.modelo_id, count(*) as n from mont group by mont.modelo_id
  )
  select jsonb_build_object(
    'numeros', (select jsonb_build_object(
                  'montados', num.montados, 'validas', num.validas, 'conferir', num.conferir,
                  'dias_uteis', v_uteis,
                  'media_dia_util', case when v_uteis > 0 then round(num.montados::numeric / v_uteis, 1) end,
                  'dias_com_montagem', num.dias_com,
                  'media_dia_montagem', case when num.dias_com > 0 then round(num.montados::numeric / num.dias_com, 1) end,
                  'tempo_total_s', round(num.total_s), 'mediana_s', round(num.mediana_s::numeric), 'media_s', round(num.media_s),
                  'cobertura_total', num.montados, 'cobertura_com_tempo', num.com_tempo,
                  'n_plataforma', num.n_plataforma, 'n_trello', num.n_trello) from num),
    'tempo_setor', (select jsonb_build_object('fila_s', round(num.fila_s), 'execucao_s', round(num.exec_s),
                                              'parado_s', round(num.parado_s), 'retrabalho_n', num.retrab_n,
                                              'retrabalho_s', round(num.retrab_s)) from num),
    'grafico', jsonb_build_object(
       'agrupado', case when v_semana then 'semana' else 'dia' end,
       -- as 7 chaves que mais montaram e "+" (o resto junto)
       'series', coalesce((select jsonb_agg(jsonb_build_object('chave', x.chave, 'n', x.n) order by x.o)
                             from (select case when s.ordem <= 7 then s.k else '+' end as chave, sum(s.n) as n, min(s.ordem) as o
                                     from series s group by 1) x), '[]'::jsonb),
       'barras', coalesce((select jsonb_agg(jsonb_build_object('balde', x.balde, 'total', x.total, 'partes', x.partes) order by x.balde)
                             from (select br.balde, sum(br.n) as total,
                                          jsonb_object_agg(br.chave, br.n) as partes
                                     from (select ba.balde, case when s.ordem <= 7 then ba.k else '+' end as chave, sum(ba.n) as n
                                             from barras ba join series s on s.k = ba.k group by 1, 2) br
                                    group by br.balde) x), '[]'::jsonb)),
    'por_montador', coalesce((select jsonb_agg(jsonb_build_object(
                                 'chave', p.k, 'moveis', p.moveis, 'dias', p.dias,
                                 'por_dia', round(p.moveis::numeric / greatest(p.dias, 1), 1),
                                 'mediana_s', round(p.mediana_s::numeric), 'tempo_total_s', round(p.total_s))
                               order by p.moveis desc, p.k) from porm p), '[]'::jsonb),
    'moveis_top', jsonb_build_object(
       'itens', coalesce((select jsonb_agg(jsonb_build_object('modelo_id', t.modelo_id, 'nome', coalesce(mo.nome, 'Sem modelo'),
                                                               'n', t.n, 'pct', round(100.0 * t.n / greatest((select montados from num), 1), 1))
                                           order by t.n desc, mo.nome)
                            from (select * from top order by n desc, modelo_id limit 12) t
                            left join public.plt_tempo_modelos mo on mo.id = t.modelo_id), '[]'::jsonb),
       'mais_n', greatest((select count(*) from top) - 12, 0)),
    'chaves', coalesce((select jsonb_agg(distinct k) from (select k from series union select k from porm) q where k <> ''), '[]'::jsonb))
    into v_ret;

  select array_agg(distinct x::uuid) into v_ids
    from jsonb_array_elements_text(v_ret -> 'chaves') c,
         lateral unnest(string_to_array(c, ',')) x;

  return v_ret - 'chaves' || jsonb_build_object(
    'setor', jsonb_build_object('id', p_setor_id, 'nome', v_ac.o_setor_nome),
    'de', v_de, 'ate', v_ate, 'pode_decidir', v_ac.o_lider, 'pessoa_travada', not v_ac.o_lider,
    'pessoas', plt_privado.fn_tempos_pessoas(v_ids),
    'conferir_n', case when v_ac.o_lider then plt_privado.fn_tempos_conferir_n(p_setor_id, v_de, v_ate, v_ac.o_pessoa, v_tr) end);
end;
$$;
comment on function public.plt_fn_tempos_periodo(bigint, date, date, uuid, bigint, boolean) is
  'SESSAO-43 (F1 · aba Período): montados, média por dia útil (os dias de expediente do calendário que têm registro), média por dia com montagem, tempo total e mediana (válidas); móveis por dia (ou semana > 70 dias) empilhados por montador (a chave = os montadores da passagem — dupla é uma série); fila × execução × parado e o retrabalho; por montador; os 12 móveis mais montados. Até 12 meses.';

-- ----------------------------------------------------------------------------
-- 6 · ABA MÓVEIS — a tabela por modelo (ordenável no servidor; a lista é o
--     catálogo de modelos do período — deslocamento justificado, teto 100) e
--     as passagens de um modelo (por cursor)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempos_moveis(
  p_setor_id bigint, p_de date, p_ate date,
  p_usuario_id uuid default null, p_trello boolean default true,
  p_ordem text default 'qtd', p_desc boolean default true,
  p_deslocamento integer default 0, p_limite integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ac    record;
  v_tr    boolean := coalesce(p_trello, true);
  v_de    date := coalesce(p_de, (now() at time zone 'America/Fortaleza')::date - 29);
  v_ate   date := coalesce(p_ate, (now() at time zone 'America/Fortaleza')::date);
  v_lim   integer := least(greatest(coalesce(p_limite, 50), 1), 100);
  v_desl  integer := greatest(coalesce(p_deslocamento, 0), 0);
  v_ord   text := case when p_ordem in ('qtd', 'melhor', 'mediana', 'faixa', 'nome') then p_ordem else 'qtd' end;
  v_desc  boolean := coalesce(p_desc, true);
  v_faixa numeric := (plt_privado.fn_tempo_regra(p_setor_id)).faixa_media_pct / 100.0;
  v_ret   jsonb;
  v_ids   uuid[];
begin
  select * into v_ac from plt_privado.fn_tempos_acesso(p_setor_id, p_usuario_id);
  if v_ate < v_de or v_ate - v_de > 400 then
    raise exception 'O período vai até 12 meses.' using errcode = 'invalid_parameter_value';
  end if;

  with b as (
    select m.origem, m.id, m.modelo_id, m.execucao_s, m.situacao, m.montado
      from plt_privado.vw_tempo_montagens m
     where m.setor_id = p_setor_id and m.dia between v_de and v_ate
       and (m.origem = 'plataforma' or v_tr)
       and (v_ac.o_pessoa is null or v_ac.o_pessoa = any (m.montadores))
  ),
  g as (
    select b.modelo_id,
           count(*) filter (where b.montado) as qtd,
           count(*) filter (where b.situacao = 'conferir') as conferir,
           count(*) filter (where b.situacao = 'valida') as validas,
           min(b.execucao_s) filter (where b.situacao = 'valida') as melhor,
           -- os três percentis numa ordenação só
           percentile_cont(array[0.25, 0.5, 0.75]) within group (order by b.execucao_s)
             filter (where b.situacao = 'valida') as pc,
           count(*) filter (where b.origem = 'trello') as n_trello
      from b group by b.modelo_id
  ),
  -- as pessoas dos móveis do período (da projeção por pessoa — sem desmontar
  -- a lista de montadores linha a linha)
  bp as (
    select q.usuario_id, q.modelo_id, q.execucao_s, q.situacao, q.montado
      from public.plt_tempo_montagem_pessoas q
     where q.setor_id = p_setor_id and q.dia between v_de and v_ate and q.papel = 'montador'
       and (q.origem = 'plataforma' or v_tr)
       and (v_ac.o_pessoa is null
            or exists (select 1 from public.plt_tempo_montagem_pessoas e
                        where e.origem = q.origem and e.ref_id = q.ref_id and e.papel = 'montador'
                          and e.usuario_id = v_ac.o_pessoa))
  ),
  gn as (
    select g.modelo_id, g.qtd, g.conferir, g.validas, g.melhor, g.n_trello,
           g.pc[2] as mediana, g.pc[1] as p25, g.pc[3] as p75,
           coalesce(mo.nome, 'Sem modelo') as nome, pa.mediana_s as padrao
      from g
      left join public.plt_tempo_modelos mo on mo.id = g.modelo_id
      left join plt_privado.fn_tempos_padroes(p_setor_id, v_tr) pa on pa.modelo_id = g.modelo_id
  ),
  pagina as (
    select gn.*, row_number() over (order by
             case when v_ord = 'qtd' and v_desc then gn.qtd end desc nulls last,
             case when v_ord = 'qtd' and not v_desc then gn.qtd end asc nulls last,
             case when v_ord = 'melhor' and v_desc then gn.melhor end desc nulls last,
             case when v_ord = 'melhor' and not v_desc then gn.melhor end asc nulls last,
             case when v_ord = 'mediana' and v_desc then gn.mediana end desc nulls last,
             case when v_ord = 'mediana' and not v_desc then gn.mediana end asc nulls last,
             case when v_ord = 'faixa' and v_desc then gn.p75 - gn.p25 end desc nulls last,
             case when v_ord = 'faixa' and not v_desc then gn.p75 - gn.p25 end asc nulls last,
             case when v_ord = 'nome' and v_desc then gn.nome end desc,
             case when v_ord = 'nome' and not v_desc then gn.nome end asc,
             gn.nome, gn.modelo_id) as pos
      from gn
  ),
  -- as colunas por montador: as 6 pessoas que mais montaram no período
  col as (
    select bp.usuario_id, count(*) as n
      from bp
     where bp.montado
     group by bp.usuario_id order by count(*) desc, bp.usuario_id limit 6
  ),
  pg as (select coalesce(pagina.modelo_id, 0) as mk from pagina where pagina.pos > v_desl and pagina.pos <= v_desl + v_lim),
  pp as (   -- "sem modelo" entra como 0 (igualdade simples: junção por hash)
    select coalesce(bp.modelo_id, 0) as mk, bp.usuario_id, count(*) as n,
           percentile_cont(0.5) within group (order by bp.execucao_s) as mediana
      from bp
      join pg on pg.mk = coalesce(bp.modelo_id, 0)
      join col on col.usuario_id = bp.usuario_id
     where bp.situacao = 'valida'
     group by 1, bp.usuario_id
  ),
  ppj as (  -- uma vez por modelo da página (nunca uma releitura por linha)
    select pp.mk, jsonb_object_agg(pp.usuario_id::text, jsonb_build_object('n', pp.n, 'mediana_s', round(pp.mediana::numeric))) as j
      from pp group by pp.mk
  )
  select jsonb_build_object(
    'colunas', coalesce((select jsonb_agg(to_jsonb(col.usuario_id) order by col.n desc, col.usuario_id) from col), '[]'::jsonb),
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
               'modelo_id', p.modelo_id, 'nome', p.nome, 'qtd', p.qtd, 'conferir', p.conferir, 'validas', p.validas,
               'melhor_s', round(p.melhor), 'mediana_s', round(p.mediana::numeric), 'p25_s', round(p.p25::numeric),
               'p75_s', round(p.p75::numeric), 'padrao_s', round(p.padrao), 'n_trello', p.n_trello,
               'por_pessoa', coalesce(j.j, '{}'::jsonb))
             order by p.pos)
             from pagina p
             left join ppj j on j.mk = coalesce(p.modelo_id, 0)
            where p.pos > v_desl and p.pos <= v_desl + v_lim), '[]'::jsonb),
    'total', (select count(*) from gn),
    'tem_mais', (select count(*) from gn) > v_desl + v_lim)
    into v_ret;

  select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(v_ret -> 'colunas') x;
  return v_ret || jsonb_build_object(
    'setor', jsonb_build_object('id', p_setor_id, 'nome', v_ac.o_setor_nome),
    'de', v_de, 'ate', v_ate, 'faixa_pct', round(v_faixa * 100),
    'pode_decidir', v_ac.o_lider, 'pessoa_travada', not v_ac.o_lider,
    'pessoas', plt_privado.fn_tempos_pessoas(v_ids),
    'conferir_n', case when v_ac.o_lider then plt_privado.fn_tempos_conferir_n(p_setor_id, v_de, v_ate, v_ac.o_pessoa, v_tr) end);
end;
$$;
comment on function public.plt_fn_tempos_moveis(bigint, date, date, uuid, boolean, text, boolean, integer, integer) is
  'SESSAO-43 (F1 · aba Móveis): por modelo — quantidade, para conferir, melhor, mediana, faixa (P25–P75), o padrão e uma coluna por montador (as 6 pessoas que mais montaram: mediana × n). Ordenável no servidor (qtd/melhor/mediana/faixa/nome), página de até 100 (a lista é a dos modelos do período — deslocamento justificado).';

create or replace function public.plt_fn_tempos_modelo_passagens(
  p_setor_id bigint, p_modelo_id bigint, p_de date, p_ate date,
  p_usuario_id uuid default null, p_trello boolean default true, p_sem_modelo boolean default false,
  p_depois_fim timestamptz default null, p_depois_origem text default null, p_depois_id bigint default null,
  p_limite integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ac   record;
  v_tr   boolean := coalesce(p_trello, true);
  v_lim  integer := least(greatest(coalesce(p_limite, 30), 1), 100);
  v_itens jsonb;
  v_n    integer;
  v_ids  uuid[];
begin
  select * into v_ac from plt_privado.fn_tempos_acesso(p_setor_id, p_usuario_id);
  with b as (
    select m.* from plt_privado.vw_tempo_montagens m
     where m.setor_id = p_setor_id and m.dia between p_de and p_ate
       and (m.origem = 'plataforma' or v_tr)
       and (case when coalesce(p_sem_modelo, false) then m.modelo_id is null else m.modelo_id = p_modelo_id end)
       and (v_ac.o_pessoa is null or v_ac.o_pessoa = any (m.montadores))
       and (p_depois_fim is null or (m.fim, m.origem, m.id) < (p_depois_fim, coalesce(p_depois_origem, ''), coalesce(p_depois_id, 0)))
     order by m.fim desc, m.origem desc, m.id desc
     limit v_lim + 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'origem', b.origem, 'id', b.id, 'card_id', b.card_id, 'dia', b.dia, 'fim', b.fim,
           'movel', coalesce(nullif(btrim(c.titulo), ''), nullif(btrim(c.item_descricao), ''), t.cartao_nome),
           'pedido', coalesce(pd.numero, t.pedido_numero),
           'montadores', to_jsonb(b.montadores), 'execucao_s', round(b.execucao_s), 'padrao_s', round(pa.mediana_s),
           'situacao', b.situacao, 'motivo', b.motivo, 'lote', b.lote, 'cortado', b.cortado, 'decidida', b.decidida)
           order by b.fim desc, b.origem desc, b.id desc), '[]'::jsonb), count(*)
    into v_itens, v_n
    from b
    left join public.plt_cards c on b.origem = 'plataforma' and c.id = b.card_id
    left join public.pedidos pd on pd.id = c.pedido_id
    left join public.plt_tempo_trello t on b.origem = 'trello' and t.id = b.id
    left join plt_privado.fn_tempos_padroes(p_setor_id, v_tr) pa on pa.modelo_id = b.modelo_id;
  if v_n > v_lim then
    v_itens := v_itens - v_lim;
  end if;
  select array_agg(distinct x::uuid) into v_ids
    from jsonb_array_elements(v_itens) r, lateral jsonb_array_elements_text(r -> 'montadores') x;
  return jsonb_build_object('itens', v_itens, 'tem_mais', v_n > v_lim, 'pode_decidir', v_ac.o_lider,
                            'pessoas', plt_privado.fn_tempos_pessoas(v_ids));
end;
$$;
comment on function public.plt_fn_tempos_modelo_passagens(bigint, bigint, date, date, uuid, boolean, boolean, timestamptz, text, bigint, integer) is
  'SESSAO-43 (F1 · Móveis, o clique na linha): as passagens de um modelo no período (ou as sem modelo), da mais recente para a mais antiga, por cursor (fim, origem, id; teto 100) — data, quem, tempo, padrão, situação, se é do Trello.';

-- ----------------------------------------------------------------------------
-- 7 · ABA MONTADORES (Pessoas nos outros setores) — um cartão por pessoa e os
--     melhores tempos (sem ranking: cada um contra o padrão do modelo)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempos_montadores(
  p_setor_id bigint, p_de date, p_ate date,
  p_usuario_id uuid default null, p_modelo_id bigint default null, p_trello boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ac    record;
  v_tr    boolean := coalesce(p_trello, true);
  v_de    date := coalesce(p_de, (now() at time zone 'America/Fortaleza')::date - 29);
  v_ate   date := coalesce(p_ate, (now() at time zone 'America/Fortaleza')::date);
  v_faixa numeric := (plt_privado.fn_tempo_regra(p_setor_id)).faixa_media_pct / 100.0;
  v_ret   jsonb;
  v_ids   uuid[];
begin
  select * into v_ac from plt_privado.fn_tempos_acesso(p_setor_id, p_usuario_id);
  if v_ate < v_de or v_ate - v_de > 400 then
    raise exception 'O período vai até 12 meses.' using errcode = 'invalid_parameter_value';
  end if;

  with pa as materialized (
    select x.modelo_id, x.mediana_s from plt_privado.fn_tempos_padroes(p_setor_id, v_tr) x
  ),
  b as (    -- os móveis (para "os 8 melhores")
    select m.origem, m.dia, m.modelo_id, m.execucao_s, m.montadores, pa.mediana_s as padrao_s
      from plt_privado.vw_tempo_montagens m
      left join pa on pa.modelo_id = m.modelo_id
     where m.setor_id = p_setor_id and m.dia between v_de and v_ate
       and m.situacao = 'valida' and m.modelo_id is not null
       and (m.origem = 'plataforma' or v_tr)
       and (p_modelo_id is null or m.modelo_id = p_modelo_id)
       and (v_ac.o_pessoa is null or v_ac.o_pessoa = any (m.montadores))
  ),
  q as (    -- pessoa × móvel (da projeção por pessoa — montadores e ajudantes)
    select q.papel, q.usuario_id, q.dia, q.modelo_id, q.execucao_s, q.esforco_s, q.situacao, q.montado
      from public.plt_tempo_montagem_pessoas q
     where q.setor_id = p_setor_id and q.dia between v_de and v_ate
       and (q.origem = 'plataforma' or v_tr)
       and (p_modelo_id is null or q.modelo_id = p_modelo_id)
       and (v_ac.o_pessoa is null or q.usuario_id = v_ac.o_pessoa)
  ),
  pp as (   -- só o que a pessoa MONTOU, com o padrão do modelo
    select q.usuario_id, q.dia, q.modelo_id, q.execucao_s, q.esforco_s, q.situacao, q.montado, pa.mediana_s as padrao_s
      from q left join pa on pa.modelo_id = q.modelo_id
     where q.papel = 'montador'
  ),
  pes as (
    select pp.usuario_id,
           count(*) filter (where pp.montado) as moveis,
           count(distinct pp.dia) filter (where pp.montado) as dias,
           percentile_cont(0.5) within group (order by pp.execucao_s) filter (where pp.situacao = 'valida') as mediana,
           coalesce(sum(pp.esforco_s) filter (where pp.situacao = 'valida'), 0) as esforco
      from pp group by pp.usuario_id
  ),
  pm as materialized (   -- pessoa × modelo (válidas): a mediana e o menor tempo, numa ordenação só
    select pp.usuario_id, pp.modelo_id, max(pp.padrao_s) as padrao, min(pp.execucao_s) as menor,
           percentile_cont(0.5) within group (order by pp.execucao_s) as med
      from pp where pp.situacao = 'valida'
     group by pp.usuario_id, pp.modelo_id
  ),
  cmp as (   -- a mediana dela em cada modelo, contra o padrão
    select pm.usuario_id,
           count(*) filter (where pm.padrao is not null and pm.med < pm.padrao * (1 - v_faixa)) as abaixo,
           count(*) filter (where pm.padrao is not null and pm.med > pm.padrao * (1 + v_faixa)) as acima,
           count(*) filter (where pm.padrao is not null and pm.med between pm.padrao * (1 - v_faixa) and pm.padrao * (1 + v_faixa)) as na_media
      from pm where pm.modelo_id is not null group by pm.usuario_id
  ),
  melhor0 as (   -- o modelo em que ela mais ganhou do padrão (sem padrão: o mais rápido) — o padrão é
                 -- um só por modelo, então o melhor do modelo é o menor tempo dele
    select distinct on (pm.usuario_id) pm.usuario_id, pm.modelo_id, pm.menor, pm.padrao
      from pm
     order by pm.usuario_id, (pm.menor / nullif(pm.padrao, 0)) asc nulls last, pm.menor asc, pm.modelo_id
  ),
  melhor as (    -- e o dia dessa montagem
    select m0.usuario_id, m0.modelo_id, m0.menor as execucao_s, m0.padrao as padrao_s, min(pp.dia) as dia
      from melhor0 m0
      join pp on pp.usuario_id = m0.usuario_id and coalesce(pp.modelo_id, 0) = coalesce(m0.modelo_id, 0)
             and pp.execucao_s = m0.menor and pp.situacao = 'valida'
     group by m0.usuario_id, m0.modelo_id, m0.menor, m0.padrao
  ),
  aj as (
    select q.usuario_id, count(*) as n from q where q.papel = 'ajudante' group by q.usuario_id
  ),
  ocup as (   -- tempo com card ÷ tempo no setor dentro do expediente (só a plataforma registra presença)
    select r.usuario_id, sum(r.esforco_s) as com_card, sum(r.trabalhando_s + r.ausente_s + r.especial_s) as no_setor
      from public.plt_tempo_resumo_pessoa_dia r
     where r.setor_id = p_setor_id and r.dia between v_de and v_ate
       and (v_ac.o_pessoa is null or r.usuario_id = v_ac.o_pessoa)
     group by r.usuario_id
  ),
  mg as (   -- por modelo: quantas válidas e o menor tempo (agrupar, sem ordenar tudo)
    select b.modelo_id, count(*) as n, min(b.execucao_s) as menor, max(b.padrao_s) as padrao_s
      from b group by b.modelo_id
  ),
  m8 as (
    select mg.* from mg where mg.n >= 2
     order by (mg.menor / nullif(mg.padrao_s, 0)) asc nulls last, mg.menor asc, mg.modelo_id
     limit 8
  ),
  melhores as (   -- os 8 móveis com o melhor tempo contra o padrão (modelos com 2+ válidas)
    select distinct on (m8.modelo_id) m8.modelo_id, b.execucao_s, b.padrao_s, b.montadores, b.dia, b.origem
      from m8 join b on b.modelo_id = m8.modelo_id and b.execucao_s = m8.menor
     order by m8.modelo_id, b.dia, b.origem
  )
  select jsonb_build_object(
    'pessoas_cartoes', coalesce((select jsonb_agg(jsonb_build_object(
        'usuario_id', pe.usuario_id, 'moveis', pe.moveis, 'dias', pe.dias,
        'por_dia', round(pe.moveis::numeric / greatest(pe.dias, 1), 1),
        'mediana_s', round(pe.mediana::numeric), 'tempo_total_s', round(pe.esforco),
        'abaixo', coalesce(c.abaixo, 0), 'acima', coalesce(c.acima, 0), 'na_media', coalesce(c.na_media, 0),
        'melhor', case when me.usuario_id is null then null else jsonb_build_object(
                    'modelo', mo.nome, 'execucao_s', round(me.execucao_s), 'padrao_s', round(me.padrao_s), 'dia', me.dia) end,
        'ajudas', coalesce(a.n, 0),
        'ocupacao_pct', case when o.no_setor > 0 then round(100 * o.com_card / o.no_setor) end)
      order by pe.moveis desc, pe.usuario_id)
      from pes pe
      left join cmp c on c.usuario_id = pe.usuario_id
      left join melhor me on me.usuario_id = pe.usuario_id
      left join public.plt_tempo_modelos mo on mo.id = me.modelo_id
      left join aj a on a.usuario_id = pe.usuario_id
      left join ocup o on o.usuario_id = pe.usuario_id), '[]'::jsonb),
    'melhores', coalesce((select jsonb_agg(jsonb_build_object(
        'modelo', mo.nome, 'execucao_s', round(x.execucao_s), 'padrao_s', round(x.padrao_s),
        'montadores', to_jsonb(x.montadores), 'dia', x.dia, 'origem', x.origem)
      order by (x.execucao_s / nullif(x.padrao_s, 0)) asc nulls last, x.execucao_s asc)
      from melhores x left join public.plt_tempo_modelos mo on mo.id = x.modelo_id), '[]'::jsonb),
    'ajudantes_so', coalesce((select jsonb_agg(jsonb_build_object('usuario_id', a.usuario_id, 'ajudas', a.n))
                                from aj a where not exists (select 1 from pes where pes.usuario_id = a.usuario_id)), '[]'::jsonb))
    into v_ret;

  select array_agg(distinct x::uuid) into v_ids
    from (select r ->> 'usuario_id' as x from jsonb_array_elements(v_ret -> 'pessoas_cartoes') r
          union all select r ->> 'usuario_id' from jsonb_array_elements(v_ret -> 'ajudantes_so') r
          union all select jsonb_array_elements_text(r -> 'montadores') from jsonb_array_elements(v_ret -> 'melhores') r) q;
  return v_ret || jsonb_build_object(
    'setor', jsonb_build_object('id', p_setor_id, 'nome', v_ac.o_setor_nome),
    'de', v_de, 'ate', v_ate, 'faixa_pct', round(v_faixa * 100),
    'pode_decidir', v_ac.o_lider, 'pessoa_travada', not v_ac.o_lider,
    'pessoas', plt_privado.fn_tempos_pessoas(v_ids),
    'conferir_n', case when v_ac.o_lider then plt_privado.fn_tempos_conferir_n(p_setor_id, v_de, v_ate, v_ac.o_pessoa, v_tr) end);
end;
$$;
comment on function public.plt_fn_tempos_montadores(bigint, date, date, uuid, bigint, boolean) is
  'SESSAO-43 (F1 · aba Montadores/Pessoas): um cartão por pessoa — móveis montados, por dia trabalhado, mediana, tempo total (o esforço dela), modelos abaixo/na média/acima do padrão, o melhor, ajudas dadas e a ocupação (tempo com card ÷ tempo no setor, do resumo por dia) — e os 8 melhores tempos contra o padrão. O funcionário vê só o dele.';

-- ----------------------------------------------------------------------------
-- 8 · ABA CONFERIR (F2) — os grupos com o contador, os casos de um grupo por
--     cursor, a decisão do histórico do Trello e o Procurar
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_tempos_conferir(
  p_setor_id bigint, p_de date, p_ate date,
  p_usuario_id uuid default null, p_trello boolean default true, p_grupo text default null,
  p_depois_fim timestamptz default null, p_depois_origem text default null, p_depois_id bigint default null,
  p_limite integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ac     record;
  v_tr     boolean := coalesce(p_trello, true);
  v_lim    integer := least(greatest(coalesce(p_limite, 30), 1), 100);
  v_grupos jsonb;
  v_grupo  text := p_grupo;
  v_itens  jsonb;
  v_n      integer;
  v_ids    uuid[];
  v_ordem  constant text[] := array['rapida', 'longa', 'cortado', 'clique_errado', 'retrabalho', 'sem_registro',
                                    'admin', 'lote', 'decididas'];
begin
  select * into v_ac from plt_privado.fn_tempos_acesso(p_setor_id, p_usuario_id);
  if not v_ac.o_lider then
    raise exception 'A conferência dos tempos é do líder do setor ou de um administrador.' using errcode = 'insufficient_privilege';
  end if;
  if v_grupo is not null and not (v_grupo = any (v_ordem)) then
    raise exception 'Grupo de conferência desconhecido.' using errcode = 'invalid_parameter_value';
  end if;

  with b as (
    select m.* from plt_privado.vw_tempo_montagens m
     where m.setor_id = p_setor_id and m.dia between p_de and p_ate
       and (m.origem = 'plataforma' or v_tr)
       and (v_ac.o_pessoa is null or v_ac.o_pessoa = any (m.montadores))
  )
  select jsonb_build_object(
           'rapida', count(*) filter (where b.situacao = 'conferir' and b.motivo = 'Rápida demais'),
           'longa', count(*) filter (where b.situacao = 'conferir' and b.motivo in ('Longa para o modelo', 'Acima do teto do setor')),
           'cortado', count(*) filter (where b.cortado),
           'clique_errado', count(*) filter (where b.clique_errado),
           'retrabalho', count(*) filter (where b.situacao = 'retrabalho'),
           'sem_registro', count(*) filter (where b.situacao = 'sem_registro'),
           'admin', count(*) filter (where b.situacao = 'admin'),
           'lote', count(*) filter (where b.lote),
           'decididas', count(*) filter (where b.decidida),
           'a_conferir', count(*) filter (where b.situacao = 'conferir'))
    into v_grupos
    from b;
  if v_grupo is null then
    select g into v_grupo from unnest(v_ordem) with ordinality as o(g, i)
     where (v_grupos ->> g)::int > 0 order by i limit 1;
    v_grupo := coalesce(v_grupo, 'rapida');
  end if;

  with b as (
    select m.* from plt_privado.vw_tempo_montagens m
     where m.setor_id = p_setor_id and m.dia between p_de and p_ate
       and (m.origem = 'plataforma' or v_tr)
       and (v_ac.o_pessoa is null or v_ac.o_pessoa = any (m.montadores))
       and case v_grupo
             when 'rapida' then m.situacao = 'conferir' and m.motivo = 'Rápida demais'
             when 'longa' then m.situacao = 'conferir' and m.motivo in ('Longa para o modelo', 'Acima do teto do setor')
             when 'cortado' then m.cortado
             when 'clique_errado' then m.clique_errado
             when 'retrabalho' then m.situacao = 'retrabalho'
             when 'sem_registro' then m.situacao = 'sem_registro'
             when 'admin' then m.situacao = 'admin'
             when 'lote' then m.lote
             else m.decidida
           end
       and (p_depois_fim is null or (m.fim, m.origem, m.id) < (p_depois_fim, coalesce(p_depois_origem, ''), coalesce(p_depois_id, 0)))
     order by m.fim desc, m.origem desc, m.id desc
     limit v_lim + 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'origem', b.origem, 'id', b.id, 'card_id', b.card_id, 'dia', b.dia, 'inicio', b.inicio, 'fim', b.fim,
           'movel', coalesce(nullif(btrim(c.titulo), ''), nullif(btrim(c.item_descricao), ''), t.cartao_nome),
           'pedido', coalesce(pd.numero, t.pedido_numero), 'modelo', mo.nome,
           'montadores', to_jsonb(b.montadores), 'ajudantes', to_jsonb(b.ajudantes),
           'execucao_s', round(b.execucao_s), 'padrao_s', round(pa.mediana_s),
           'situacao', b.situacao, 'motivo', b.motivo, 'lote', b.lote, 'cortado', b.cortado,
           'clique_errado', b.clique_errado, 'retrabalho', b.retrabalho, 'decidida', b.decidida,
           'decisao', case
             when b.origem = 'trello' and t.decisao is not null then jsonb_build_object(
               'decisao', t.decisao, 'motivo', t.decisao_motivo, 'quem', t.decidido_por, 'em', t.decidido_em)
             when b.origem = 'plataforma' and ev.id is not null then jsonb_build_object(
               'decisao', ev.dados ->> 'decisao', 'motivo', ev.dados ->> 'motivo', 'quem', ev.usuario_id, 'em', ev.ocorrido_em)
           end)
           order by b.fim desc, b.origem desc, b.id desc), '[]'::jsonb), count(*)
    into v_itens, v_n
    from b
    left join public.plt_cards c on b.origem = 'plataforma' and c.id = b.card_id
    left join public.pedidos pd on pd.id = c.pedido_id
    left join public.plt_tempo_trello t on b.origem = 'trello' and t.id = b.id
    left join public.plt_tempo_passagens ps on b.origem = 'plataforma' and ps.id = b.id
    left join public.plt_eventos ev on ev.id = ps.decisao_evento_id
    left join public.plt_tempo_modelos mo on mo.id = b.modelo_id
    left join plt_privado.fn_tempos_padroes(p_setor_id, v_tr) pa on pa.modelo_id = b.modelo_id;
  if v_n > v_lim then
    v_itens := v_itens - v_lim;
  end if;
  select array_agg(distinct x::uuid) into v_ids
    from (select jsonb_array_elements_text((r -> 'montadores') || (r -> 'ajudantes')) as x from jsonb_array_elements(v_itens) r
          union all select r -> 'decisao' ->> 'quem' from jsonb_array_elements(v_itens) r) q
   where x is not null;
  return jsonb_build_object(
    'setor', jsonb_build_object('id', p_setor_id, 'nome', v_ac.o_setor_nome),
    'grupos', v_grupos, 'grupo', v_grupo,
    'faixa_pct', (plt_privado.fn_tempo_regra(p_setor_id)).faixa_media_pct,
    'itens', v_itens, 'tem_mais', v_n > v_lim,
    'pode_decidir', true,
    'pessoas', plt_privado.fn_tempos_pessoas(v_ids),
    'conferir_n', (v_grupos ->> 'a_conferir')::int);
end;
$$;
comment on function public.plt_fn_tempos_conferir(bigint, date, date, uuid, boolean, text, timestamptz, text, bigint, integer) is
  'SESSAO-43 (F2 · aba Conferir): os grupos (rápida demais, longa/acima do teto, cortado no fim do expediente, clique errado, retrabalho, sem registro, gesto de admin, lote, decididas) com o contador e os casos de UM grupo por cursor (fim, origem, id; teto 100), com a decisão manual já tomada. Só líder do setor ou admin.';

-- a decisão manual sobre uma linha do HISTÓRICO DO TRELLO (a da plataforma é
-- plt_fn_tempo_decidir, da 42): considerar / descartar / desfazer, com motivo,
-- por líder do setor ou admin — a linha guarda a decisão vigente e a trilha o
-- rastro (o histórico não é fato da plataforma)
create or replace function public.plt_fn_tempo_trello_decidir(p_id bigint, p_decisao text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t        public.plt_tempo_trello%rowtype;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if p_decisao is null or p_decisao not in ('considerar', 'descartar', 'desfazer') then
    raise exception 'A decisão é considerar, descartar ou desfazer.' using errcode = 'invalid_parameter_value';
  end if;
  if length(v_motivo) < 3 then
    raise exception 'Escreva o motivo da decisão.' using errcode = 'invalid_parameter_value';
  end if;
  select * into t from public.plt_tempo_trello where id = p_id for update;
  if t.id is null then
    raise exception 'Esta montagem do histórico não existe.' using errcode = 'no_data_found';
  end if;
  if not (plt_privado.fn_eh_admin() or plt_privado.fn_eh_lider_de(t.setor_id)) then
    raise exception 'Decidir o tempo é do líder do setor ou de um administrador.' using errcode = 'insufficient_privilege';
  end if;
  update public.plt_tempo_trello
     set decisao = case when p_decisao = 'desfazer' then null else p_decisao end,
         decisao_motivo = case when p_decisao = 'desfazer' then null else left(v_motivo, 300) end,
         decidido_por = case when p_decisao = 'desfazer' then null else plt_privado.fn_usuario_atual() end,
         decidido_em = case when p_decisao = 'desfazer' then null else now() end
   where id = t.id;
  perform plt_privado.fn_tempo_trello_classificar(t.setor_id);
  perform plt_privado.fn_tempo_trilha('tempo_trello_decisao',
    jsonb_build_object('trello_id', t.id, 'cartao', t.cartao_nome, 'setor_id', t.setor_id, 'decisao', p_decisao,
                       'motivo', left(v_motivo, 300), 'situacao_antes', t.situacao));
  perform plt_privado.fn_avisar('setor_' || t.setor_id);
  select * into t from public.plt_tempo_trello where id = p_id;
  return jsonb_build_object('situacao', t.situacao, 'motivo', t.motivo);
end;
$$;
comment on function public.plt_fn_tempo_trello_decidir(bigint, text, text) is
  'SESSAO-43 (F2): a decisão manual sobre uma montagem do histórico do Trello — considerar (entra na média), descartar (fora), desfazer (volta à regra) — com motivo, por líder do setor ou admin. A linha guarda a decisão vigente; o rastro vai para a trilha (tempo_trello_decisao — Auditoria).';

-- o PROCURAR: pelo número do pedido ou pelo nome do móvel, em qualquer
-- período — a passagem como foi registrada (com os trechos), até 30
create or replace function public.plt_fn_tempos_procurar(p_setor_id bigint, p_texto text, p_trello boolean default true)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ac    record;
  v_txt   text := btrim(coalesce(p_texto, ''));
  v_num   integer := case when btrim(coalesce(p_texto, '')) ~ '^[0-9]{1,9}$' then btrim(p_texto)::integer end;
  v_nome  text;
  v_itens jsonb;
  v_ids   uuid[];
begin
  select * into v_ac from plt_privado.fn_tempos_acesso(p_setor_id, null);
  if not v_ac.o_lider then
    raise exception 'A conferência dos tempos é do líder do setor ou de um administrador.' using errcode = 'insufficient_privilege';
  end if;
  if v_num is null and length(v_txt) < 3 then
    raise exception 'Digite o número do pedido ou 3 letras do nome do móvel.' using errcode = 'invalid_parameter_value';
  end if;
  v_nome := case when v_num is null then plt_privado.fn_nome_comparavel(v_txt) end;

  with cards as (
    select c.id from public.plt_cards c
      join public.pedidos pd on pd.id = c.pedido_id
     where v_num is not null and pd.numero = v_num
    union
    select c.id from public.plt_cards c
     where v_nome is not null and c.nome_busca like '%' || v_nome || '%'
     limit 200
  ),
  achados as (
    select 'plataforma'::text as origem, ps.id, ps.card_id, ps.entrada_em as inicio, ps.saida_em as fim
      from public.plt_tempo_passagens ps
     where ps.card_id = any (array(select id from cards)) and ps.setor_id = p_setor_id   -- pelo índice do card
    union all
    -- o Trello em dois caminhos (cada um pelo índice dele: o número ou os trigramas do nome)
    select 'trello', t.id, null, t.inicio, t.fim
      from public.plt_tempo_trello t
     where coalesce(p_trello, true) and v_num is not null and t.pedido_numero = v_num and t.setor_id = p_setor_id
    union all
    select 'trello', t.id, null, t.inicio, t.fim
      from public.plt_tempo_trello t
     where coalesce(p_trello, true) and v_nome is not null and t.setor_id = p_setor_id
       and t.nome_busca like '%' || v_nome || '%'
    order by 4 desc
    limit 30
  )
  select coalesce(jsonb_agg(case when a.origem = 'plataforma' then jsonb_build_object(
             'origem', a.origem, 'id', ps.id, 'card_id', ps.card_id,
             'movel', coalesce(nullif(btrim(c.titulo), ''), nullif(btrim(c.item_descricao), '')),
             'pedido', pd.numero, 'modelo', mo.nome,
             'entrada_em', ps.entrada_em, 'saida_em', ps.saida_em, 'dia', ps.dia,
             'fila_s', round(ps.fila_s), 'execucao_s', round(ps.execucao_s), 'parado_s', round(ps.parado_s),
             'situacao', ps.situacao, 'motivo', ps.motivo, 'desfecho', ps.desfecho, 'lote', ps.lote,
             'montadores', to_jsonb(coalesce(eq.montadores, '{}')), 'ajudantes', to_jsonb(coalesce(eq.ajudantes, '{}')),
             'trechos', coalesce((select jsonb_agg(jsonb_build_object(
                            'pessoa', tt.usuario_id, 'papel', tt.papel, 'inicio', tt.inicio, 'fim', tt.fim,
                            'fim_tipo', tt.fim_tipo, 'corte', tt.corte, 'descartado', tt.descartado,
                            'segundos', round(tt.segundos)) order by tt.inicio)
                                   from public.plt_tempo_trechos tt where tt.passagem_id = ps.id), '[]'::jsonb))
           else jsonb_build_object(
             'origem', a.origem, 'id', t.id, 'movel', t.cartao_nome, 'pedido', t.pedido_numero, 'modelo', mo.nome,
             'entrada_em', t.inicio, 'saida_em', t.fim, 'dia', t.dia, 'execucao_s', round(t.execucao_s),
             'bruto_s', round(t.bruto_s), 'situacao', t.situacao, 'motivo', t.motivo, 'lote', t.lote_n > 1,
             'cortado', t.cortado, 'etiquetas', to_jsonb(t.etiquetas), 'montadores', to_jsonb(t.pessoas),
             'url', t.cartao_url) end
           order by a.inicio desc), '[]'::jsonb)
    into v_itens
    from achados a
    left join public.plt_tempo_passagens ps on a.origem = 'plataforma' and ps.id = a.id
    left join public.plt_tempo_passagem_equipe eq on eq.passagem_id = ps.id
    left join public.plt_cards c on c.id = ps.card_id
    left join public.pedidos pd on pd.id = c.pedido_id
    left join public.plt_tempo_trello t on a.origem = 'trello' and t.id = a.id
    left join public.plt_tempo_modelos mo on mo.id = coalesce(ps.modelo_id, t.modelo_id);

  select array_agg(distinct x::uuid) into v_ids
    from (select jsonb_array_elements_text((r -> 'montadores') || coalesce(r -> 'ajudantes', '[]'::jsonb)) as x
            from jsonb_array_elements(v_itens) r
          union all
          select tt ->> 'pessoa' from jsonb_array_elements(v_itens) r, jsonb_array_elements(coalesce(r -> 'trechos', '[]'::jsonb)) tt) q
   where x is not null;
  return jsonb_build_object('itens', v_itens, 'pessoas', plt_privado.fn_tempos_pessoas(v_ids));
end;
$$;
comment on function public.plt_fn_tempos_procurar(bigint, text, boolean) is
  'SESSAO-43 (F2 · Procurar): pelo número do pedido ou por 3+ letras do nome do móvel, em qualquer período — as passagens do setor como foram registradas (com os trechos) e as do histórico do Trello (com as etiquetas como vieram), até 30, da mais recente. Só líder do setor ou admin.';

-- as opções dos filtros (no clique do filtro): as pessoas do setor e os modelos
create or replace function public.plt_fn_tempos_opcoes(p_setor_id bigint, p_busca text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ac    record;
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
begin
  select * into v_ac from plt_privado.fn_tempos_acesso(p_setor_id, null);
  return jsonb_build_object(
    'pessoas', case when not v_ac.o_lider then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome, 'foto', u.foto_caminho) order by u.nome)
        from public.plt_usuarios u
       where u.ativo and u.arquivado_em is null and not u.conta_tablet
         and (exists (select 1 from public.plt_tempo_equipe e where e.setor_id = p_setor_id and e.usuario_id = u.id)
              or exists (select 1 from public.plt_usuario_setores us where us.setor_id = p_setor_id and us.usuario_id = u.id))), '[]'::jsonb) end,
    'modelos', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome) order by x.nome)
        from (select m.id, m.nome from public.plt_tempo_modelos m
               where m.arquivado_em is null
                 and (v_busca is null or m.nome ilike '%' || v_busca || '%')
                 and (exists (select 1 from public.plt_tempo_padrao_historico h where h.setor_id = p_setor_id and h.modelo_id = m.id)
                      or exists (select 1 from public.plt_tempo_padrao d where d.setor_id = p_setor_id and d.modelo_id = m.id)
                      or v_busca is not null)
               order by m.nome limit 30) x), '[]'::jsonb));
end;
$$;
comment on function public.plt_fn_tempos_opcoes(bigint, text) is
  'SESSAO-43 (F1): as opções dos filtros, pedidas no clique — as pessoas do setor (equipe no painel ou vínculo; só para quem vê todos) e até 30 modelos (os que têm padrão no setor, ou pela busca).';

-- ----------------------------------------------------------------------------
-- 9 · O MODO TV (F3) — o painel inteiro numa porta, só LETRAS (a Equipe no
--     painel): nunca nome, foto, etiqueta ou dado bruto, nem para o admin
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_modo_tv(p_setor_id bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_hoje  date := (now() at time zone 'America/Fortaleza')::date;
  v_seg   date := date_trunc('week', (now() at time zone 'America/Fortaleza'))::date;
  v_mes   date := date_trunc('month', (now() at time zone 'America/Fortaleza'))::date;
  v_de    date;
  v_setor bigint;
  v_nome  text;
  v_u30   integer;
  v_umes  integer;
  v_ret   jsonb;
begin
  if v_eu is null then
    raise exception 'Entre na plataforma para abrir o Modo TV.' using errcode = 'insufficient_privilege';
  end if;
  if not (plt_privado.fn_tem_modo_tv(v_eu) or plt_privado.fn_eh_admin()) then
    raise exception 'O Modo TV é liberado por um administrador na Gestão da equipe.' using errcode = 'insufficient_privilege';
  end if;
  select s.id, s.nome into v_setor, v_nome
    from public.plt_setores s
   where s.papel_no_fluxo = 'producao' and s.ativo
   order by (s.id = p_setor_id) desc, ('montagem' = any (plt_privado.fn_tempo_palavras(s.nome))) desc, s.ordem, s.id
   limit 1;
  if v_setor is null then
    raise exception 'Não há setor de produção para a TV.' using errcode = 'no_data_found';
  end if;
  v_de := least(v_hoje - 29, v_mes, v_seg);
  v_u30 := plt_privado.fn_tempos_dias_uteis(v_setor, v_hoje - 29, v_hoje, true);
  v_umes := plt_privado.fn_tempos_dias_uteis(v_setor, v_mes, v_hoje, true);

  with le as (
    select e.usuario_id, e.letra from public.plt_tempo_equipe e where e.setor_id = v_setor
  ),
  b0 as (
    select m.dia, m.modelo_id, m.execucao_s, m.situacao, m.montado, m.montadores, m.chave
      from plt_privado.vw_tempo_montagens m
     where m.setor_id = v_setor and m.dia between v_de and v_hoje
  ),
  -- as letras de cada equipe calculadas UMA vez por chave (não por móvel)
  k as (
    select x.chave,
           case when cardinality(x.montadores) = 0 then 'Sem montador'
                when exists (select 1 from unnest(x.montadores) p where p not in (select usuario_id from le)) then 'Outros'
                else (select string_agg(le.letra, ' + ' order by le.letra) from unnest(x.montadores) p join le on le.usuario_id = p)
           end as letras,
           case when cardinality(x.montadores) = 1 then x.montadores[1] end as sozinho
      from (select distinct on (b0.chave) b0.chave, b0.montadores from b0) x
  ),
  b as (
    select b0.dia, b0.modelo_id, b0.execucao_s, b0.situacao, b0.montado, k.letras, k.sozinho
      from b0 join k on k.chave = b0.chave
  ),
  num as (
    select count(*) filter (where b.montado and b.dia = v_hoje) as hoje,
           count(*) filter (where b.montado and b.dia >= v_hoje - 29) as n30,
           count(*) filter (where b.montado and b.dia >= v_mes) as mes,
           percentile_cont(0.5) within group (order by b.execucao_s) filter (where b.situacao = 'valida' and b.dia = v_hoje) as med_hoje,
           percentile_cont(0.5) within group (order by b.execucao_s) filter (where b.situacao = 'valida' and b.dia >= v_hoje - 29) as med_30
      from b
  ),
  ind as (   -- a coluna dos montadores: quem montou SOZINHO, pela letra
    select le.letra,
           count(*) filter (where b.montado and b.dia = v_hoje) as hoje,
           percentile_cont(0.5) within group (order by b.execucao_s) filter (where b.situacao = 'valida' and b.dia = v_hoje) as med_hoje,
           count(*) filter (where b.montado and b.dia >= v_hoje - 29) as n30,
           count(distinct b.dia) filter (where b.montado and b.dia >= v_hoje - 29) as dias30
      from b join le on le.usuario_id = b.sozinho
     where b.dia >= v_hoje - 29
     group by le.letra
  ),
  graf as (
    select b.dia, b.letras, count(*) as n from b
     where b.montado and b.dia >= v_hoje - 13 group by b.dia, b.letras
  ),
  melhor as (
    select b.letras, mo.nome as modelo, b.execucao_s, h.mediana_s
      from b
      join public.plt_tempo_padrao_historico h on h.setor_id = v_setor and h.modelo_id = b.modelo_id and h.n >= 3
      join public.plt_tempo_modelos mo on mo.id = b.modelo_id
     where b.situacao = 'valida' and b.dia >= v_seg and b.letras not in ('Sem montador', 'Outros')
     order by b.execucao_s / nullif(h.mediana_s, 0) asc nulls last, b.execucao_s asc
     limit 1
  )
  select jsonb_build_object(
    'setor', jsonb_build_object('id', v_setor, 'nome', v_nome),
    'setores', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) order by s.ordem, s.id)
                           from public.plt_setores s where s.papel_no_fluxo = 'producao' and s.ativo), '[]'::jsonb),
    'hoje', v_hoje,
    'montados_hoje', num.hoje,
    'n30', num.n30, 'dias_uteis_30', v_u30,
    'media_30', case when v_u30 > 0 then round(num.n30::numeric / v_u30, 1) end,
    'montados_mes', num.mes, 'dias_uteis_mes', v_umes,
    'media_mes', case when v_umes > 0 then round(num.mes::numeric / v_umes, 1) end,
    'tempo_medio_hoje_s', round(num.med_hoje::numeric),
    'mediana_30_s', round(num.med_30::numeric),
    'dados_ate', (select max(m.dia) from plt_privado.vw_tempo_montagens m
                   where m.setor_id = v_setor and m.montado
                     and m.dia <= v_hoje and m.dia >= v_hoje - 400),
    'montadores', coalesce((select jsonb_agg(jsonb_build_object(
                     'letra', i.letra, 'hoje', i.hoje, 'mediana_hoje_s', round(i.med_hoje::numeric),
                     'ritmo', case when i.dias30 > 0 then round(i.n30::numeric / i.dias30, 1) end)
                   order by i.letra) from ind i where i.n30 > 0 or i.hoje > 0), '[]'::jsonb),
    'grafico', jsonb_build_object(
       'dias', (select jsonb_agg(jsonb_build_object(
                  'dia', d::date,
                  'total', coalesce((select sum(g.n) from graf g where g.dia = d::date), 0),
                  'partes', coalesce((select jsonb_object_agg(g.letras, g.n) from graf g where g.dia = d::date), '{}'::jsonb))
                  order by d)
                  from generate_series(v_hoje - 13, v_hoje, interval '1 day') d),
       'series', coalesce((select jsonb_agg(x.letras order by x.ordem, x.letras)
                             from (select g.letras, case when g.letras = 'Outros' then 2 when g.letras = 'Sem montador' then 3
                                                         when g.letras like '% + %' then 1 else 0 end as ordem
                                     from graf g group by g.letras) x), '[]'::jsonb)),
    'melhor_semana', (select jsonb_build_object('letras', m.letras, 'modelo', m.modelo,
                                                'tempo_s', round(m.execucao_s), 'padrao_s', round(m.mediana_s)) from melhor m))
    into v_ret
    from num;
  return v_ret;
end;
$$;
comment on function public.plt_fn_modo_tv(bigint) is
  'SESSAO-43 (F3): o Modo TV de um setor (sem setor: a Montagem) — montados hoje, média por dia útil em 30 dias (os dias de expediente que têm registro), montados no mês e por dia útil, tempo médio hoje (mediana) e dos 30 dias, a coluna dos montadores que montaram SOZINHOS (letra, hoje, mediana hoje, ritmo por dia com montagem), os 14 dias empilhados por letras (dupla = "A + B"; quem não tem letra = "Outros"), o melhor da semana contra o padrão (modelos com 3+ válidas) e até quando há dado. SÓ LETRAS — nunca nome, foto, etiqueta. Quem tem o Modo TV ou admin.';

do $$
declare
  f text;
begin
  foreach f in array array[
    'plt_fn_tempos_dia(bigint, date, date, date, uuid, bigint, boolean, timestamptz, text, bigint, integer)',
    'plt_fn_tempos_periodo(bigint, date, date, uuid, bigint, boolean)',
    'plt_fn_tempos_moveis(bigint, date, date, uuid, boolean, text, boolean, integer, integer)',
    'plt_fn_tempos_modelo_passagens(bigint, bigint, date, date, uuid, boolean, boolean, timestamptz, text, bigint, integer)',
    'plt_fn_tempos_montadores(bigint, date, date, uuid, bigint, boolean)',
    'plt_fn_tempos_conferir(bigint, date, date, uuid, boolean, text, timestamptz, text, bigint, integer)',
    'plt_fn_tempo_trello_decidir(bigint, text, text)',
    'plt_fn_tempos_procurar(bigint, text, boolean)',
    'plt_fn_tempos_opcoes(bigint, text)',
    'plt_fn_modo_tv(bigint)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
