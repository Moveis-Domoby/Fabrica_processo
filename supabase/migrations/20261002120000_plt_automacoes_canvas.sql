-- ============================================================================
-- PLATAFORMA DE PRODUÇÃO DOMOBY · migration 51 — AUTOMAÇÕES EM CANVAS,
-- SUPER ADMIN, ETIQUETAS E CAMPOS CUSTOMIZADOS
-- SESSAO-27 (01–02/10/2026) · D-99…D-104 · ↩️ D-03 (mover card automaticamente
-- passa a existir) · ↪️ D-92 (só o super admin cria) · ↪️ D-95 (a Auditoria
-- passa ao super admin)
--
-- O dono: "a automação em canvas deve ser para tudo, comercial, api, pedidos —
-- e só eu vou construir essas coisas, então eu vou saber quando ligar"; "esse
-- canvas será para apenas super admin … a partir de hoje é criado um painel de
-- super admin que só o meu usuário tem permissão de acessar, por enquanto,
-- dentro dele deve ficar a auditoria e o canvas"; etiquetas "quantas eu quiser
-- colocar, para tirar deve ter o nó de remover"; "a automação deve ter um nó de
-- trazer de volta também"; campos customizados "nas peças, no card do pedido e
-- nos pedidos", preenchidos "pela automação e pelo admin".
--
-- O que nasce aqui:
--   1. SUPER ADMIN — `plt_usuarios.super_admin` (só o dono, por enquanto) e o
--      gate `fn_eh_super_admin`; a Auditoria (migration 50) e a trilha passam
--      a ser dele.
--   2. ETIQUETAS — `plt_etiquetas` (nome + cor de token) e o vínculo com o card
--      por EVENTO com projeção (M-13): `etiqueta_adicionada`/`etiqueta_removida`
--      → `plt_cards.etiquetas` (várias por card).
--   3. TRAZER DE VOLTA — `card_desarquivado` (o arquivar deixa de ser só ida).
--   4. CAMPOS CUSTOMIZADOS — `plt_campos` (texto, número, data, lista, sim/não;
--      vale em peças e/ou pedidos) e `plt_campos_valores` (o valor de hoje; a
--      história na trilha). "No card do pedido" e "no pedido" são o MESMO valor
--      (um pedido tem um card só no PCP) — guardado pelo pedido, que alcança
--      até pedido antigo sem card.
--   5. AUTOMAÇÕES — `plt_automacoes` (nasce DESLIGADA, garantido por gatilho)
--      e `plt_automacao_execucoes` (cada disparo: o que gatilhou, a condição,
--      cada passo e o resultado; também guarda quem está ESPERANDO).
--   6. O MOTOR — roda NO BANCO e NA HORA: um gatilho ADIADO sobre `plt_eventos`
--      (dispara no fechamento do gesto, depois de tudo o que o gesto gravou),
--      outro sobre a situação do pedido; um relógio que SÓ EXISTE enquanto há
--      "parado há N" ligado ou execução esperando. Erro numa automação NUNCA
--      desfaz o gesto de quem a disparou (cada passo num bloco protegido) e
--      NUNCA propaga para a integração do Tiny. Cadeia limitada a 5.
--
-- Integração do Tiny: nenhuma coluna tocada. Ganha UM gatilho adiado em
-- `pedidos` (situação mudou → automações), à prova de falha.
-- ============================================================================

set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1 · SUPER ADMIN
-- ----------------------------------------------------------------------------
alter table public.plt_usuarios add column if not exists super_admin boolean not null default false;

comment on column public.plt_usuarios.super_admin is
  'SESSAO-27 (D-100): quem abre o Painel super admin (Automações e Auditoria). Só o dono, por enquanto. Muda só por SQL/migration — o navegador lê, nunca escreve.';

-- E-50/D-68: coluna nova em plt_usuarios só é legível com grant por coluna.
grant select (super_admin) on public.plt_usuarios to authenticated;

-- O dono (D-21: o admin principal). Conferido no banco real em 01/10: admin ativo.
update public.plt_usuarios
   set super_admin = true
 where lower(email) = 'wallacecauan03@gmail.com' and papel = 'admin' and not super_admin;

create or replace function plt_privado.fn_eh_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.papel = 'admin' and u.super_admin from public.plt_usuarios u
      where u.auth_user_id = auth.uid() and u.ativo limit 1),
    false
  );
$$;

comment on function plt_privado.fn_eh_super_admin() is
  'SESSAO-27 (D-100): a pessoa logada é admin ativo E super admin.';

revoke all on function plt_privado.fn_eh_super_admin() from public, anon;
grant execute on function plt_privado.fn_eh_super_admin() to authenticated;

-- A trilha inteira passa a ser do super admin (o resto lê só a própria).
drop policy if exists plt_logs_atividade_leitura on public.plt_logs_atividade;
create policy plt_logs_atividade_leitura on public.plt_logs_atividade
  for select to authenticated
  using (plt_privado.fn_eh_super_admin() or usuario_id = plt_privado.fn_usuario_atual());

-- ----------------------------------------------------------------------------
-- 2 · A AUDITORIA passa ao super admin (corpo da migration 50, só o gate e a
--     frase trocados — extraídos por script, E-24)
-- ----------------------------------------------------------------------------
create or replace function public.plt_fn_auditoria(
  p_limite       integer     default 30,
  p_deslocamento integer     default 0,
  p_usuario      uuid        default null,   -- uma pessoa
  p_acoes        text[]      default null,   -- um tipo (a tela manda a lista de ações do grupo)
  p_desde        timestamptz default null,
  p_ate          timestamptz default null,
  p_busca        text        default null,   -- texto livre; só dígitos = nº do pedido também
  p_sistema      boolean     default null    -- true = só o Sistema · false = só pessoas · nulo = tudo
)
returns table (
  id             bigint,
  criado_em      timestamptz,
  usuario_id     uuid,
  usuario_nome   text,
  acao           text,
  rota           text,
  contexto       jsonb,
  pedido_numero  integer,
  card_tipo      text,
  setor_origem   text,
  setor_destino  text,
  etapa_origem   text,
  etapa_destino  text,
  motivo         text,
  contagem_total bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_eu     uuid    := plt_privado.fn_usuario_atual();
  v_busca  text    := nullif(btrim(coalesce(p_busca, '')), '');
  v_cards  bigint[];
begin
  if v_eu is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'A auditoria é só do super admin.' using errcode = 'insufficient_privilege';
  end if;
  if v_busca is not null and length(v_busca) > 120 then
    raise exception 'Busca longa demais (até 120 caracteres).';
  end if;
  -- só dígitos: pode ser o nº de um pedido — os cards dele entram na busca
  if v_busca ~ '^[0-9]{3,9}$' then
    select coalesce(array_agg(c.id), '{}') into v_cards
      from public.plt_cards c join public.pedidos p on p.id = c.pedido_id
     where p.numero = v_busca::integer;
  end if;

  return query
  with filtrados as (
    select l.id, l.criado_em, l.usuario_id, l.acao, l.rota, l.contexto
      from public.plt_logs_atividade l
     where (p_usuario is null or l.usuario_id = p_usuario)
       and (p_acoes is null or cardinality(p_acoes) = 0 or l.acao = any (p_acoes))
       and (p_desde is null or l.criado_em >= p_desde)
       and (p_ate is null or l.criado_em < p_ate)
       and (p_sistema is null
            or (p_sistema and l.usuario_id is null)
            or (not p_sistema and l.usuario_id is not null))
       and (v_busca is null
            or l.acao ilike '%' || v_busca || '%'
            or l.rota ilike '%' || v_busca || '%'
            or l.contexto::text ilike '%' || v_busca || '%'
            or (cardinality(v_cards) > 0
                and (case when l.contexto->>'card_id' ~ '^[0-9]+$'
                          then (l.contexto->>'card_id')::bigint end) = any (v_cards)))
       -- D-51: tarefa pessoal PRIVADA não aparece nem para o admin (só para quem a criou)
       and not (l.acao like 'tarefa\_%'
                and exists (select 1 from public.plt_tarefas t
                             where t.id = case when l.contexto->>'tarefa_id' ~ '^[0-9]+$'
                                               then (l.contexto->>'tarefa_id')::bigint end
                               and t.privada
                               and t.criada_por_id is distinct from v_eu))
  ),
  pagina as (
    select f.id, f.criado_em, f.usuario_id, f.acao, f.rota, f.contexto,
           count(*) over () as total
      from filtrados f
     order by f.criado_em desc, f.id desc
     limit least(greatest(coalesce(p_limite, 30), 1), 100)
    offset greatest(coalesce(p_deslocamento, 0), 0)
  )
  select pg.id, pg.criado_em, pg.usuario_id, u.nome, pg.acao, pg.rota, pg.contexto,
         pe.numero, cd.tipo, so.nome, sd.nome, eo.nome, ed.nome,
         coalesce(nullif(btrim(ev.observacao), ''),
                  nullif(btrim(pg.contexto->>'motivo'), ''),
                  nullif(btrim(ev.dados->>'motivo'), '')),
         pg.total
    from pagina pg
    left join public.plt_usuarios u on u.id = pg.usuario_id
    left join public.plt_eventos ev
           on ev.id = case when pg.contexto->>'evento_id' ~ '^[0-9]+$' then (pg.contexto->>'evento_id')::bigint end
    left join public.plt_cards cd
           on cd.id = case when pg.contexto->>'card_id' ~ '^[0-9]+$' then (pg.contexto->>'card_id')::bigint end
    left join public.pedidos pe on pe.id = cd.pedido_id
    left join public.plt_setores so
           on so.id = case when pg.contexto->>'setor_origem_id' ~ '^[0-9]+$' then (pg.contexto->>'setor_origem_id')::bigint end
    left join public.plt_setores sd
           on sd.id = case when pg.contexto->>'setor_destino_id' ~ '^[0-9]+$' then (pg.contexto->>'setor_destino_id')::bigint end
    left join public.plt_etapas eo
           on eo.id = case when pg.contexto->>'etapa_origem_id' ~ '^[0-9]+$' then (pg.contexto->>'etapa_origem_id')::bigint end
    left join public.plt_etapas ed
           on ed.id = case when pg.contexto->>'etapa_destino_id' ~ '^[0-9]+$' then (pg.contexto->>'etapa_destino_id')::bigint end
   order by pg.criado_em desc, pg.id desc;
end;
$$;

create or replace function public.plt_fn_auditoria_conferencias(
  p_limite       integer default 10,
  p_deslocamento integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_busca    jsonb;
  v_rodada   text;
  v_agora    jsonb;
  v_agendada boolean := null;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'A auditoria é só do super admin.' using errcode = 'insufficient_privilege';
  end if;

  select f.params into v_busca from public.tiny_fila f
   where f.recurso = 'pedidos_pesquisa' and f.chave = 'pente-fino:p1';
  v_rodada := v_busca->>'rodada';
  if v_rodada is not null and v_busca->>'resumo_em' is null then
    select jsonb_build_object(
             'rodada',  v_rodada,
             'inicio',  v_busca->>'inicio',
             'motivo',  coalesce(v_busca->>'motivo', 'madrugada'),
             'na_fila', count(*) filter (where x.recurso = 'pedido'),
             'lidos',   count(*) filter (where x.recurso = 'pedido' and x.status in ('ok', 'vazio', 'erro')),
             'mudaram', count(*) filter (where x.recurso = 'pedido' and x.status = 'ok'
                                           and jsonb_array_length(coalesce(x.params->'mudou', '[]'::jsonb)) > 0))
      into v_agora
      from public.tiny_fila x
     where x.params->>'rodada' = v_rodada;
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    v_agendada := exists (select 1 from cron.job where jobname = 'plt-tiny-pente-fino');
  end if;

  return jsonb_build_object(
    'em_andamento', v_agora,
    'agendada',     v_agendada,
    'total',        (select count(*) from public.eventos e where e.tipo = 'pente_fino'),
    'rodadas',      coalesce((
       select jsonb_agg(x.payload || jsonb_build_object('id', x.id, 'registrado_em', x.recebido_em)
                        order by x.id desc)
         from (select e.id, e.recebido_em, e.payload
                 from public.eventos e
                where e.tipo = 'pente_fino'
                order by e.id desc
                limit least(greatest(coalesce(p_limite, 10), 1), 50)
               offset greatest(coalesce(p_deslocamento, 0), 0)) x), '[]'::jsonb));
end;
$$;

-- ----------------------------------------------------------------------------
-- 3 · Tipos novos de evento (E-19: esta é a migration mais nova do check —
--     ela valida no fim; a 42 deixou de validar)
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
      'execucao_pausada',
      'execucao_retomada',
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
      'pedido_lancado_rotas',
      'unidade_desvinculada',
      'peca_alocada',
      'peca_reservada',
      'peca_reserva_desfeita',
      'estoque_reserva_avaliada',
      'etiqueta_adicionada',       -- SESSAO-27 (D-101): a etiqueta entrou no card
      'etiqueta_removida',         -- SESSAO-27 (D-101): a etiqueta saiu do card
      'card_desarquivado'          -- SESSAO-27 (D-102): o card arquivado voltou
    )) not valid;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4 · ETIQUETAS
-- ----------------------------------------------------------------------------
create table if not exists public.plt_etiquetas (
  id            bigint generated always as identity primary key,
  nome          text not null,
  cor           text not null,
  arquivada_em  timestamptz,
  criada_por    uuid references public.plt_usuarios(id),
  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  constraint plt_etiquetas_nome_ck check (char_length(btrim(nome)) between 1 and 40),
  -- Cor de TOKEN (nada de hex solto): a paleta das etiquetas no Modelo de
  -- Sistema. Sem verde/âmbar/vermelho (qualidade — A-08) e sem amarelo (ação).
  constraint plt_etiquetas_cor_ck check (cor in ('azul', 'violeta', 'ciano', 'rosa', 'marrom', 'cinza'))
);

comment on table public.plt_etiquetas is
  'SESSAO-27 (D-101): etiquetas que as automações põem e tiram dos cards (várias por card). Cadastro em Configurações → Utilitários (admin).';

create unique index if not exists plt_etiquetas_nome_uq
  on public.plt_etiquetas (lower(btrim(nome))) where arquivada_em is null;

alter table public.plt_etiquetas enable row level security;
drop policy if exists plt_etiquetas_leitura on public.plt_etiquetas;
create policy plt_etiquetas_leitura on public.plt_etiquetas
  for select to authenticated using (true);
revoke insert, update, delete, truncate on public.plt_etiquetas from anon, authenticated;
grant select on public.plt_etiquetas to authenticated;

-- A projeção: as etiquetas do card (escrita SÓ pelo gatilho do evento — M-13).
alter table public.plt_cards add column if not exists etiquetas bigint[] not null default '{}';

comment on column public.plt_cards.etiquetas is
  'SESSAO-27 (D-101): projeção dos eventos etiqueta_adicionada/etiqueta_removida — escrita só pelo gatilho plt_eventos_projetar_marcas.';

-- ----------------------------------------------------------------------------
-- 5 · CAMPOS CUSTOMIZADOS
-- ----------------------------------------------------------------------------
create table if not exists public.plt_campos (
  id           bigint generated always as identity primary key,
  nome         text not null,
  tipo         text not null,
  opcoes       text[] not null default '{}',
  em_pecas     boolean not null default true,
  em_pedidos   boolean not null default false,
  arquivado_em timestamptz,
  criado_por   uuid references public.plt_usuarios(id),
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint plt_campos_nome_ck check (char_length(btrim(nome)) between 1 and 40),
  constraint plt_campos_tipo_ck check (tipo in ('texto', 'numero', 'data', 'lista', 'sim_nao')),
  constraint plt_campos_onde_ck check (em_pecas or em_pedidos),
  constraint plt_campos_opcoes_ck check (
    (tipo = 'lista' and cardinality(opcoes) between 1 and 30)
    or (tipo <> 'lista' and cardinality(opcoes) = 0)
  )
);

comment on table public.plt_campos is
  'SESSAO-27 (D-101): campos customizados. em_pecas = nos cards que andam pelos setores; em_pedidos = no pedido (e no card dele no PCP — o mesmo valor). Cadastro em Configurações → Utilitários (admin).';

create unique index if not exists plt_campos_nome_uq
  on public.plt_campos (lower(btrim(nome))) where arquivado_em is null;

create table if not exists public.plt_campos_valores (
  id             bigint generated always as identity primary key,
  campo_id       bigint not null references public.plt_campos(id),
  card_id        bigint references public.plt_cards(id),
  -- Sem FK de propósito: `pedidos` é tabela da integração (D-19) — nada aqui
  -- pode travar uma escrita do Tiny.
  pedido_id      bigint,
  valor          jsonb not null,
  origem         text not null default 'interface',
  atualizado_por uuid references public.plt_usuarios(id),
  atualizado_em  timestamptz not null default now(),
  constraint plt_campos_valores_alvo_ck check (num_nonnulls(card_id, pedido_id) = 1),
  constraint plt_campos_valores_origem_ck check (origem in ('interface', 'automacao', 'api'))
);

comment on table public.plt_campos_valores is
  'SESSAO-27 (D-101): o valor ATUAL de cada campo customizado, por peça (card_id) ou por pedido (pedido_id). A história mora na trilha (plt_logs_atividade, campo_preenchido/campo_limpo). Escrita só pelas portas.';

create unique index if not exists plt_campos_valores_card_uq
  on public.plt_campos_valores (campo_id, card_id) where card_id is not null;
create unique index if not exists plt_campos_valores_pedido_uq
  on public.plt_campos_valores (campo_id, pedido_id) where pedido_id is not null;
create index if not exists plt_campos_valores_card_idx
  on public.plt_campos_valores (card_id) where card_id is not null;
create index if not exists plt_campos_valores_pedido_idx
  on public.plt_campos_valores (pedido_id) where pedido_id is not null;

alter table public.plt_campos enable row level security;
alter table public.plt_campos_valores enable row level security;
drop policy if exists plt_campos_leitura on public.plt_campos;
create policy plt_campos_leitura on public.plt_campos for select to authenticated using (true);
drop policy if exists plt_campos_valores_leitura on public.plt_campos_valores;
create policy plt_campos_valores_leitura on public.plt_campos_valores for select to authenticated using (true);
revoke insert, update, delete, truncate on public.plt_campos, public.plt_campos_valores from anon, authenticated;
grant select on public.plt_campos, public.plt_campos_valores to authenticated;

-- A história do valor vai para a trilha (quem, quando, antes → depois).
create or replace function plt_privado.fn_logar_campo_valor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_linha public.plt_campos_valores%rowtype;
  v_nome  text;
begin
  v_linha := case when tg_op = 'DELETE' then old else new end;
  select c.nome into v_nome from public.plt_campos c where c.id = v_linha.campo_id;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (
    case when tg_op = 'DELETE' then null else new.atualizado_por end,
    case when tg_op = 'DELETE' then 'campo_limpo' else 'campo_preenchido' end,
    jsonb_strip_nulls(jsonb_build_object(
      'campo_id', v_linha.campo_id,
      'campo', v_nome,
      'card_id', v_linha.card_id,
      'pedido_id', v_linha.pedido_id,
      'antes', case when tg_op = 'INSERT' then null else old.valor end,
      'depois', case when tg_op = 'DELETE' then null else new.valor end,
      'origem', v_linha.origem,
      'motivo', nullif(current_setting('plt.automacao_motivo', true), '')
    ))
  );
  return null;
end;
$$;

drop trigger if exists plt_campos_valores_logar on public.plt_campos_valores;
create trigger plt_campos_valores_logar
  after insert or update or delete on public.plt_campos_valores
  for each row execute function plt_privado.fn_logar_campo_valor();

-- O valor certo para o tipo do campo (devolve normalizado ou recusa em português).
create or replace function plt_privado.fn_campo_valor_normalizado(p_campo public.plt_campos, p_valor jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_texto text;
begin
  if p_valor is null or p_valor = 'null'::jsonb then
    raise exception 'O campo "%" ficou sem valor.', p_campo.nome using errcode = 'check_violation';
  end if;
  if p_campo.tipo = 'texto' then
    v_texto := btrim(p_valor #>> '{}');
    if v_texto = '' or char_length(v_texto) > 500 then
      raise exception 'O campo "%" aceita um texto de 1 a 500 caracteres.', p_campo.nome using errcode = 'check_violation';
    end if;
    return to_jsonb(v_texto);
  elsif p_campo.tipo = 'numero' then
    begin
      return to_jsonb((p_valor #>> '{}')::numeric);
    exception when others then
      raise exception 'O campo "%" aceita só número.', p_campo.nome using errcode = 'check_violation';
    end;
  elsif p_campo.tipo = 'data' then
    begin
      return to_jsonb(((p_valor #>> '{}')::date)::text);
    exception when others then
      raise exception 'O campo "%" aceita só data.', p_campo.nome using errcode = 'check_violation';
    end;
  elsif p_campo.tipo = 'sim_nao' then
    if jsonb_typeof(p_valor) = 'boolean' then
      return p_valor;
    end if;
    if lower(p_valor #>> '{}') in ('true', 'sim') then return 'true'::jsonb; end if;
    if lower(p_valor #>> '{}') in ('false', 'nao', 'não') then return 'false'::jsonb; end if;
    raise exception 'O campo "%" aceita só sim ou não.', p_campo.nome using errcode = 'check_violation';
  else -- lista
    v_texto := p_valor #>> '{}';
    if not (v_texto = any (p_campo.opcoes)) then
      raise exception 'O campo "%" aceita só uma das opções cadastradas.', p_campo.nome using errcode = 'check_violation';
    end if;
    return to_jsonb(v_texto);
  end if;
end;
$$;

revoke all on function plt_privado.fn_campo_valor_normalizado(public.plt_campos, jsonb) from public, anon, authenticated;

-- Grava (ou limpa) o valor de um campo num card OU num pedido. O card do pedido
-- (PCP) grava NO PEDIDO (o mesmo valor). Usada pela porta do admin e pelo motor.
create or replace function plt_privado.fn_campo_gravar(
  p_campo_id  bigint,
  p_card_id   bigint,
  p_pedido_id bigint,
  p_valor     jsonb,     -- null = limpar
  p_origem    text,
  p_usuario   uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campo  public.plt_campos%rowtype;
  v_card   public.plt_cards%rowtype;
  v_pedido bigint := p_pedido_id;
  v_alvo_card bigint;
  v_valor  jsonb;
  v_atual  jsonb;
begin
  select * into v_campo from public.plt_campos where id = p_campo_id;
  if not found then
    raise exception 'Campo customizado não encontrado.' using errcode = 'no_data_found';
  end if;
  if v_campo.arquivado_em is not null and p_valor is not null then
    raise exception 'O campo "%" está arquivado.', v_campo.nome using errcode = 'check_violation';
  end if;

  if p_card_id is not null then
    select * into v_card from public.plt_cards where id = p_card_id;
    if not found then
      raise exception 'Card não encontrado.' using errcode = 'no_data_found';
    end if;
    if v_card.tipo = 'pedido' then
      v_pedido := v_card.pedido_id;          -- card do pedido = o pedido
    else
      v_alvo_card := v_card.id;              -- peça (ou reposição)
    end if;
  end if;

  if v_alvo_card is not null and not v_campo.em_pecas then
    raise exception 'O campo "%" não vale nas peças — só nos pedidos.', v_campo.nome using errcode = 'check_violation';
  end if;
  if v_alvo_card is null and v_pedido is null then
    raise exception 'Diga em que card ou pedido gravar o campo.' using errcode = 'check_violation';
  end if;
  if v_alvo_card is null and not v_campo.em_pedidos then
    raise exception 'O campo "%" não vale nos pedidos — só nas peças.', v_campo.nome using errcode = 'check_violation';
  end if;

  if v_alvo_card is not null then
    select valor into v_atual from public.plt_campos_valores where campo_id = p_campo_id and card_id = v_alvo_card;
  else
    select valor into v_atual from public.plt_campos_valores where campo_id = p_campo_id and pedido_id = v_pedido;
  end if;

  if p_valor is null then
    if v_atual is null then
      return 'ja_estava';
    end if;
    if v_alvo_card is not null then
      delete from public.plt_campos_valores where campo_id = p_campo_id and card_id = v_alvo_card;
    else
      delete from public.plt_campos_valores where campo_id = p_campo_id and pedido_id = v_pedido;
    end if;
    return 'limpo';
  end if;

  v_valor := plt_privado.fn_campo_valor_normalizado(v_campo, p_valor);
  if v_atual is not distinct from v_valor then
    return 'ja_estava';
  end if;
  if v_atual is null then
    insert into public.plt_campos_valores (campo_id, card_id, pedido_id, valor, origem, atualizado_por)
    values (p_campo_id, v_alvo_card, case when v_alvo_card is null then v_pedido end, v_valor, p_origem, p_usuario);
  elsif v_alvo_card is not null then
    update public.plt_campos_valores
       set valor = v_valor, origem = p_origem, atualizado_por = p_usuario, atualizado_em = now()
     where campo_id = p_campo_id and card_id = v_alvo_card;
  else
    update public.plt_campos_valores
       set valor = v_valor, origem = p_origem, atualizado_por = p_usuario, atualizado_em = now()
     where campo_id = p_campo_id and pedido_id = v_pedido;
  end if;
  return 'gravado';
end;
$$;

revoke all on function plt_privado.fn_campo_gravar(bigint, bigint, bigint, jsonb, text, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6 · Projeção e validação dos eventos novos
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_projetar_marcas()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_etiqueta bigint := nullif(new.dados ->> 'etiqueta_id', '')::bigint;
begin
  if new.tipo = 'etiqueta_adicionada' then
    update public.plt_cards
       set etiquetas = (select coalesce(array_agg(distinct x order by x), '{}')
                          from unnest(array_append(etiquetas, v_etiqueta)) x)
     where id = new.card_id;
  elsif new.tipo = 'etiqueta_removida' then
    update public.plt_cards
       set etiquetas = array_remove(etiquetas, v_etiqueta)
     where id = new.card_id;
  elsif new.tipo = 'card_desarquivado' then
    update public.plt_cards set arquivado_em = null where id = new.card_id;
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_projetar_marcas on public.plt_eventos;
create trigger plt_eventos_projetar_marcas
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('etiqueta_adicionada', 'etiqueta_removida', 'card_desarquivado'))
  execute function plt_privado.fn_projetar_marcas();

-- Quem pode: o MOTOR das automações (origem automacao, com a marca do motor
-- ligada na transação e o id da automação no evento) ou um admin.
create or replace function plt_privado.fn_evento_do_motor(p_origem text, p_dados jsonb)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select p_origem = 'automacao'
     and coalesce(p_dados, '{}'::jsonb) ? 'automacao_id'
     and coalesce(current_setting('plt.automacao_canvas', true), '') = 'on';
$$;

revoke all on function plt_privado.fn_evento_do_motor(text, jsonb) from public, anon, authenticated;

create or replace function plt_privado.fn_validar_marcas()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin    boolean;
  v_etiqueta public.plt_etiquetas%rowtype;
  v_card     public.plt_cards%rowtype;
begin
  if new.tipo not in ('etiqueta_adicionada', 'etiqueta_removida', 'card_desarquivado') then
    return new;
  end if;
  select exists (select 1 from public.plt_usuarios u
                  where u.id = new.usuario_id and u.ativo and u.papel = 'admin') into v_admin;
  if not plt_privado.fn_evento_do_motor(new.origem, new.dados) and not v_admin then
    if new.tipo = 'card_desarquivado' then
      raise exception 'Trazer de volta um card arquivado é gesto do admin ou das automações.'
        using errcode = 'insufficient_privilege';
    end if;
    raise exception 'Etiqueta no card é coisa das automações (ou do admin).'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;
  if new.tipo = 'card_desarquivado' then
    if v_card.arquivado_em is null then
      raise exception 'Este card não está arquivado.' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  select * into v_etiqueta from public.plt_etiquetas where id = nullif(new.dados ->> 'etiqueta_id', '')::bigint;
  if not found then
    raise exception 'Etiqueta não encontrada.' using errcode = 'no_data_found';
  end if;
  if new.tipo = 'etiqueta_adicionada' then
    if v_etiqueta.arquivada_em is not null then
      raise exception 'A etiqueta "%" está arquivada.', v_etiqueta.nome using errcode = 'check_violation';
    end if;
    if v_etiqueta.id = any (v_card.etiquetas) then
      raise exception 'O card já tem a etiqueta "%".', v_etiqueta.nome using errcode = 'check_violation';
    end if;
  elsif not (v_etiqueta.id = any (v_card.etiquetas)) then
    raise exception 'O card não tem a etiqueta "%".', v_etiqueta.nome using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists plt_eventos_validar_marcas on public.plt_eventos;
create trigger plt_eventos_validar_marcas
  before insert on public.plt_eventos
  for each row
  when (new.tipo in ('etiqueta_adicionada', 'etiqueta_removida', 'card_desarquivado'))
  execute function plt_privado.fn_validar_marcas();

-- ----------------------------------------------------------------------------
-- 7 · Quem pode arquivar (recriada POR INTEIRO a partir da migration 40):
--     + o motor das automações (D-99 — "para tudo").
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
-- 8 · Chegada aos fins de linha (recriada POR INTEIRO a partir da migration 37):
--     a automação obedece às MESMAS regras de uma pessoa (D-103) — só peça 🟢,
--     ESTOQUE só sem dono, Pedidos em aguardo só pedido vivo. As consequências
--     do próprio sistema (origem automacao SEM a marca do motor — ex.: o
--     cancelamento que leva a peça ao estoque) seguem livres, como antes.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_validar_chegada_estoque()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_destino   text;
  v_estado    text;
  v_card      public.plt_cards%rowtype;
  v_cancelado boolean;
begin
  if new.tipo <> 'movimentacao_setor'
     or not (new.origem = 'interface' or plt_privado.fn_evento_do_motor(new.origem, new.dados)) then
    return new;
  end if;
  select s.codigo into v_destino from public.plt_setores s where s.id = new.setor_destino_id;
  if v_destino is null or v_destino not in ('estoque', 'aguardo') then
    return new;
  end if;

  select * into v_card from public.plt_cards where id = new.card_id;

  -- A marcação da própria transição manda; sem ela (saída de PCP/terminal),
  -- vale o último estado conhecido da peça.
  if new.evento_referencia_id is not null then
    select e.estado_qualidade into v_estado
      from public.plt_eventos e
     where e.id = new.evento_referencia_id and e.tipo = 'qualidade_marcada';
  end if;
  if v_estado is null then
    v_estado := v_card.qualidade_atual;
  end if;
  if v_estado in ('atencao', 'danificado') then
    if v_destino = 'estoque' then
      raise exception 'O ESTOQUE só recebe peça em perfeito estado. Peça em atenção ou danificada vai para o DANIFICADO do setor.'
        using errcode = 'check_violation';
    end if;
    raise exception 'Pedidos em aguardo só recebe peça em perfeito estado. Peça em atenção ou danificada vai para o DANIFICADO do setor.'
      using errcode = 'check_violation';
  end if;

  -- SESSAO-24 (b4 do dono): "estoque só fica como local final de peça sem dono".
  v_cancelado := v_card.pedido_id is not null and plt_privado.fn_pedido_cancelado(v_card.pedido_id);
  if v_destino = 'aguardo' then
    if v_card.pedido_id is null then
      raise exception 'Pedidos em aguardo recebe só peça de pedido — peça sem dono vai para o ESTOQUE.'
        using errcode = 'check_violation';
    end if;
    if v_cancelado then
      raise exception 'O pedido desta peça foi cancelado no Tiny — ela vai para o ESTOQUE, sem dono.'
        using errcode = 'check_violation';
    end if;
  elsif v_card.pedido_id is not null and not v_cancelado then
    raise exception 'Peça de pedido vai para Pedidos em aguardo — o ESTOQUE recebe só peça sem dono.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function plt_privado.fn_validar_chegada_estoque() is
  'SESSAO-25 + SESSAO-24 (+ SESSAO-27): chegada HUMANA — e das automações do canvas — aos fins de linha: só peça 🟢; ESTOQUE só com peça sem dono (ou de pedido cancelado, que perde o pedido na chegada); Pedidos em aguardo só com peça de pedido vivo.';

-- ----------------------------------------------------------------------------
-- 9 · O Tiny acompanha o "trazer de volta" (recriada POR INTEIRO a partir da
--     migration 42): a peça livre que volta ao ESTOQUE volta a contar (D-77).
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_tiny_estoque_marcar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card    public.plt_cards%rowtype;
  v_estoque bigint;
  v_produto bigint;
  v_motivo  text;
  v_manda   boolean := false;
begin
  if plt_privado.fn_tiny_estoque_desde() is null then
    return null;
  end if;
  select * into v_card from public.plt_cards where id = new.card_id;
  if v_card.tipo is distinct from 'unidade' then
    return null;
  end if;
  select s.id into v_estoque from public.plt_setores s where s.codigo = 'estoque';
  v_motivo := coalesce(new.dados ->> 'motivo', '');

  if new.tipo = 'card_criado' then
    v_manda := new.setor_destino_id = v_estoque and v_card.pedido_id is null
               and v_motivo not in ('tiny', 'tiny_copia');
  elsif new.tipo = 'card_arquivado' then
    v_manda := v_card.setor_atual_id = v_estoque and v_card.pedido_id is null
               and v_motivo not in ('tiny', 'tiny_copia', 'venda');
  elsif new.tipo = 'card_desarquivado' then
    -- SESSAO-27: a peça livre que voltou ao ESTOQUE volta a contar.
    v_manda := v_card.setor_atual_id = v_estoque and v_card.pedido_id is null;
  elsif new.tipo = 'movimentacao_setor' then
    v_manda := (new.setor_destino_id = v_estoque or new.setor_origem_id = v_estoque)
               and new.setor_destino_id is distinct from new.setor_origem_id;
  elsif new.tipo = 'peca_reserva_desfeita' then
    v_manda := v_motivo = 'pcp_produzir';
  elsif new.tipo = 'peca_alocada' then
    v_manda := coalesce((new.dados ->> 'reservada')::boolean, false) = false;
  end if;

  if v_manda then
    v_produto := coalesce(v_card.produto_tiny_id,
                          plt_privado.fn_produto_do_item(v_card.item_codigo, v_card.item_descricao));
    perform plt_privado.fn_tiny_estoque_enfileirar(
      v_produto, true,
      case new.tipo
        when 'card_criado'           then coalesce(nullif(v_motivo, ''), 'entrada')
        when 'card_arquivado'        then coalesce(nullif(v_motivo, ''), 'baixa')
        when 'card_desarquivado'     then 'trazida_de_volta'
        when 'movimentacao_setor'    then 'chegada_ou_saida'
        when 'peca_reserva_desfeita' then 'pcp_produzir'
        else 'peca_usada_no_pedido'
      end);
  end if;
  return null;
end;
$$;

drop trigger if exists plt_eventos_zzz_tiny_estoque on public.plt_eventos;
create trigger plt_eventos_zzz_tiny_estoque
  after insert on public.plt_eventos
  for each row
  when (new.tipo in ('card_criado', 'card_arquivado', 'card_desarquivado', 'movimentacao_setor',
                     'peca_reserva_desfeita', 'peca_alocada'))
  execute function plt_privado.fn_tiny_estoque_marcar();

-- ----------------------------------------------------------------------------
-- 10 · AUTOMAÇÕES e EXECUÇÕES
-- ----------------------------------------------------------------------------
create table if not exists public.plt_automacoes (
  id             bigint generated always as identity primary key,
  nome           text not null,
  ligada         boolean not null default false,
  gatilho        text not null,
  gatilho_config jsonb not null default '{}'::jsonb,
  passos         jsonb not null default '[]'::jsonb,
  desenho        jsonb not null default '{}'::jsonb,
  segredo        text not null default replace(gen_random_uuid()::text, '-', ''),
  ligada_em      timestamptz,
  arquivada_em   timestamptz,
  criada_por     uuid references public.plt_usuarios(id),
  criada_em      timestamptz not null default now(),
  atualizada_em  timestamptz not null default now(),
  constraint plt_automacoes_nome_ck check (char_length(btrim(nome)) between 1 and 80),
  constraint plt_automacoes_gatilho_ck check (gatilho in (
    'card_entrou', 'card_iniciado', 'qualidade_marcada', 'card_parado', 'card_arquivado',
    'etiqueta_posta', 'etiqueta_tirada', 'pedido_novo', 'pedido_situacao', 'chamada_externa')),
  constraint plt_automacoes_passos_ck check (jsonb_typeof(passos) = 'array'),
  constraint plt_automacoes_desenho_ck check (pg_column_size(desenho) < 200000)
);

comment on table public.plt_automacoes is
  'SESSAO-27 (D-99/D-103): as automações do canvas — um QUANDO (gatilho + filtros) e uma sequência de FAÇA (passos, na ordem do desenho). Só o super admin lê e escreve (pelas portas). Nasce DESLIGADA (gatilho plt_automacoes_nasce_desligada).';
comment on column public.plt_automacoes.desenho is
  'O desenho do canvas (posição dos blocos e ligações) — só para a tela; o motor lê `passos`.';
comment on column public.plt_automacoes.segredo is
  'Assina o "chamar endereço de fora" (cabeçalho X-Assinatura, HMAC-SHA256 do corpo) — o n8n confere.';

create unique index if not exists plt_automacoes_nome_uq
  on public.plt_automacoes (lower(btrim(nome))) where arquivada_em is null;
create index if not exists plt_automacoes_ligadas_idx
  on public.plt_automacoes (gatilho) where ligada and arquivada_em is null;

-- Nasce desligada — vale para todo escritor (M-14).
create or replace function plt_privado.fn_automacao_nasce_desligada()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.ligada := false;
  new.ligada_em := null;
  return new;
end;
$$;

drop trigger if exists plt_automacoes_nasce_desligada on public.plt_automacoes;
create trigger plt_automacoes_nasce_desligada
  before insert on public.plt_automacoes
  for each row execute function plt_privado.fn_automacao_nasce_desligada();

create table if not exists public.plt_automacao_execucoes (
  id              bigint generated always as identity primary key,
  automacao_id    bigint not null references public.plt_automacoes(id),
  automacao_nome  text not null,
  gatilho         text not null,
  card_id         bigint,
  pedido_id       bigint,
  evento_id       bigint,
  profundidade    integer not null default 0,
  chave           text,
  situacao        text not null default 'rodando',
  avaliacao       text,
  passos_previstos jsonb not null default '[]'::jsonb,
  resultado       jsonb not null default '[]'::jsonb,
  proximo_passo   integer,
  executar_em     timestamptz,
  contexto        jsonb not null default '{}'::jsonb,
  criada_em       timestamptz not null default now(),
  atualizada_em   timestamptz not null default now(),
  constraint plt_automacao_execucoes_situacao_ck check (situacao in (
    'rodando', 'esperando', 'concluida', 'parou', 'falhou', 'ignorada', 'barrada'))
);

comment on table public.plt_automacao_execucoes is
  'SESSAO-27 (D-103): cada disparo de automação — o que gatilhou (card/pedido/evento), a condição avaliada (avaliacao), o resultado de cada passo e a situação. Guarda também quem está ESPERANDO (proximo_passo/executar_em). passos_previstos = os passos da época do disparo (editar a automação não muda quem já está esperando).';

create unique index if not exists plt_automacao_execucoes_chave_uq
  on public.plt_automacao_execucoes (automacao_id, chave) where chave is not null;
create index if not exists plt_automacao_execucoes_lista_idx
  on public.plt_automacao_execucoes (automacao_id, id desc);
create index if not exists plt_automacao_execucoes_espera_idx
  on public.plt_automacao_execucoes (executar_em) where situacao = 'esperando';
create index if not exists plt_automacao_execucoes_card_idx
  on public.plt_automacao_execucoes (card_id) where card_id is not null;

-- Só pelas portas (security definer + gate do super admin).
alter table public.plt_automacoes enable row level security;
alter table public.plt_automacao_execucoes enable row level security;
revoke all on public.plt_automacoes, public.plt_automacao_execucoes from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11 · Validação do que o canvas manda salvar (frases para gente)
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_automacao_validar(p_gatilho text, p_config jsonb, p_passos jsonb)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_passo  jsonb;
  v_tipo   text;
  v_n      integer := 0;
  v_setor  public.plt_setores%rowtype;
  v_etapa  public.plt_etapas%rowtype;
  v_id     bigint;
  v_total  integer;
  v_campo  public.plt_campos%rowtype;
begin
  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'O bloco QUANDO está incompleto.' using errcode = 'check_violation';
  end if;

  -- filtros de setor/etapa do QUANDO
  if p_gatilho in ('card_entrou', 'card_iniciado', 'card_parado', 'card_arquivado', 'qualidade_marcada') then
    if nullif(p_config ->> 'setor_id', '') is not null then
      select * into v_setor from public.plt_setores where id = (p_config ->> 'setor_id')::bigint;
      if not found then
        raise exception 'O setor escolhido no QUANDO não existe mais.' using errcode = 'check_violation';
      end if;
    end if;
    if nullif(p_config ->> 'etapa_id', '') is not null then
      select * into v_etapa from public.plt_etapas where id = (p_config ->> 'etapa_id')::bigint;
      if not found or v_etapa.setor_id is distinct from v_setor.id then
        raise exception 'A etapa escolhida no QUANDO não é do setor escolhido.' using errcode = 'check_violation';
      end if;
    end if;
  end if;
  if p_gatilho = 'card_parado' then
    if coalesce((p_config ->> 'horas')::numeric, 0) < 1 or (p_config ->> 'horas')::numeric > 2160 then
      raise exception 'No "parado há", escolha de 1 hora a 90 dias.' using errcode = 'check_violation';
    end if;
  end if;
  if p_gatilho = 'qualidade_marcada' then
    if jsonb_typeof(p_config -> 'estados') is distinct from 'array' or jsonb_array_length(p_config -> 'estados') = 0
       or exists (select 1 from jsonb_array_elements_text(p_config -> 'estados') e
                   where e not in ('perfeito', 'atencao', 'danificado')) then
      raise exception 'Escolha pelo menos um estado da peça no QUANDO.' using errcode = 'check_violation';
    end if;
  end if;
  if p_gatilho in ('etiqueta_posta', 'etiqueta_tirada') and nullif(p_config ->> 'etiqueta_id', '') is not null then
    if not exists (select 1 from public.plt_etiquetas where id = (p_config ->> 'etiqueta_id')::bigint) then
      raise exception 'A etiqueta escolhida no QUANDO não existe mais.' using errcode = 'check_violation';
    end if;
  end if;

  if p_passos is null or jsonb_typeof(p_passos) <> 'array' then
    raise exception 'A sequência de passos está quebrada.' using errcode = 'check_violation';
  end if;
  v_total := jsonb_array_length(p_passos);
  if v_total > 20 then
    raise exception 'Uma automação tem no máximo 20 passos.' using errcode = 'check_violation';
  end if;

  for v_passo in select value from jsonb_array_elements(p_passos) loop
    v_n := v_n + 1;
    v_tipo := v_passo ->> 'tipo';
    if v_tipo = 'mover' then
      select * into v_setor from public.plt_setores where id = nullif(v_passo ->> 'setor_id', '')::bigint and ativo;
      if not found then
        raise exception 'Passo %: escolha para onde mover (setor ativo).', v_n using errcode = 'check_violation';
      end if;
      if v_setor.codigo = 'rotas' then
        raise exception 'Passo %: para as ROTAS só pelo "Lançar para ROTAS" — escolha outro destino.', v_n using errcode = 'check_violation';
      end if;
      if nullif(v_passo ->> 'etapa_id', '') is not null then
        select * into v_etapa from public.plt_etapas where id = (v_passo ->> 'etapa_id')::bigint and ativa;
        if not found or v_etapa.setor_id <> v_setor.id then
          raise exception 'Passo %: a etapa não é do setor escolhido.', v_n using errcode = 'check_violation';
        end if;
      end if;
    elsif v_tipo in ('arquivar', 'desarquivar') then
      null;
    elsif v_tipo = 'etiqueta_por' then
      if jsonb_typeof(v_passo -> 'etiquetas') is distinct from 'array' or jsonb_array_length(v_passo -> 'etiquetas') = 0 then
        raise exception 'Passo %: escolha a(s) etiqueta(s) para pôr.', v_n using errcode = 'check_violation';
      end if;
      for v_id in select value::bigint from jsonb_array_elements_text(v_passo -> 'etiquetas') loop
        if not exists (select 1 from public.plt_etiquetas where id = v_id and arquivada_em is null) then
          raise exception 'Passo %: uma das etiquetas não existe mais (ou foi arquivada).', v_n using errcode = 'check_violation';
        end if;
      end loop;
    elsif v_tipo = 'etiqueta_tirar' then
      if not coalesce((v_passo ->> 'todas')::boolean, false)
         and (jsonb_typeof(v_passo -> 'etiquetas') is distinct from 'array' or jsonb_array_length(v_passo -> 'etiquetas') = 0) then
        raise exception 'Passo %: escolha a(s) etiqueta(s) para tirar, ou "todas".', v_n using errcode = 'check_violation';
      end if;
    elsif v_tipo = 'campo' then
      select * into v_campo from public.plt_campos where id = nullif(v_passo ->> 'campo_id', '')::bigint and arquivado_em is null;
      if not found then
        raise exception 'Passo %: escolha o campo a preencher.', v_n using errcode = 'check_violation';
      end if;
      if not coalesce((v_passo ->> 'limpar')::boolean, false) then
        perform plt_privado.fn_campo_valor_normalizado(v_campo, v_passo -> 'valor');
      end if;
    elsif v_tipo = 'avisar' then
      if coalesce(v_passo ->> 'destino', '') not in ('pessoa', 'lideres', 'setor', 'admins') then
        raise exception 'Passo %: escolha quem recebe o aviso.', v_n using errcode = 'check_violation';
      end if;
      if v_passo ->> 'destino' = 'pessoa' and not exists (
        select 1 from public.plt_usuarios where id = nullif(v_passo ->> 'usuario_id', '')::uuid and ativo) then
        raise exception 'Passo %: escolha a pessoa que recebe o aviso.', v_n using errcode = 'check_violation';
      end if;
      if char_length(btrim(coalesce(v_passo ->> 'mensagem', ''))) not between 1 and 500
         or char_length(coalesce(v_passo ->> 'titulo', '')) > 120 then
        raise exception 'Passo %: o aviso precisa de uma mensagem (até 500 letras) e título de até 120.', v_n using errcode = 'check_violation';
      end if;
    elsif v_tipo = 'chamar' then
      if coalesce(v_passo ->> 'url', '') !~ '^https?://[^\s]+$' or char_length(v_passo ->> 'url') > 500 then
        raise exception 'Passo %: o endereço precisa começar com http:// ou https://.', v_n using errcode = 'check_violation';
      end if;
    elsif v_tipo = 'esperar' then
      if coalesce(v_passo ->> 'unidade', '') not in ('minutos', 'horas', 'dias')
         or coalesce((v_passo ->> 'quantidade')::numeric, 0) < 1
         or (v_passo ->> 'quantidade')::numeric
            * (case v_passo ->> 'unidade' when 'minutos' then 1 when 'horas' then 60 else 1440 end) > 43200 then
        raise exception 'Passo %: espere de 1 minuto a 30 dias.', v_n using errcode = 'check_violation';
      end if;
    elsif v_tipo = 'se' then
      if coalesce(v_passo ->> 'condicao', '') not in ('tem_etiqueta', 'nao_tem_etiqueta', 'campo_igual', 'campo_vazio',
                                                     'campo_preenchido', 'no_setor', 'situacao_pedido', 'tipo_card') then
        raise exception 'Passo %: escolha a condição do "só se".', v_n using errcode = 'check_violation';
      end if;
      if v_passo ->> 'condicao' in ('tem_etiqueta', 'nao_tem_etiqueta')
         and not exists (select 1 from public.plt_etiquetas where id = nullif(v_passo ->> 'etiqueta_id', '')::bigint) then
        raise exception 'Passo %: escolha a etiqueta do "só se".', v_n using errcode = 'check_violation';
      end if;
      if v_passo ->> 'condicao' in ('campo_igual', 'campo_vazio', 'campo_preenchido') then
        select * into v_campo from public.plt_campos where id = nullif(v_passo ->> 'campo_id', '')::bigint;
        if not found then
          raise exception 'Passo %: escolha o campo do "só se".', v_n using errcode = 'check_violation';
        end if;
        if v_passo ->> 'condicao' = 'campo_igual' then
          perform plt_privado.fn_campo_valor_normalizado(v_campo, v_passo -> 'valor');
        end if;
      end if;
      if v_passo ->> 'condicao' = 'no_setor'
         and not exists (select 1 from public.plt_setores where id = nullif(v_passo ->> 'setor_id', '')::bigint) then
        raise exception 'Passo %: escolha o setor do "só se".', v_n using errcode = 'check_violation';
      end if;
      if v_passo ->> 'condicao' in ('situacao_pedido', 'tipo_card')
         and (jsonb_typeof(v_passo -> 'valores') is distinct from 'array' or jsonb_array_length(v_passo -> 'valores') = 0) then
        raise exception 'Passo %: escolha pelo menos uma opção do "só se".', v_n using errcode = 'check_violation';
      end if;
    else
      raise exception 'Passo %: bloco desconhecido.', v_n using errcode = 'check_violation';
    end if;
  end loop;
end;
$$;

revoke all on function plt_privado.fn_automacao_validar(text, jsonb, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 12 · O RELÓGIO — só existe enquanto há "parado há N" ligado ou alguém
--      esperando (a lição da migration 43: nada rodando à toa). Padrão E-72:
--      cron.job só aparece DENTRO do ramo que tem pg_cron.
-- ----------------------------------------------------------------------------
create or replace function plt_privado.fn_automacoes_relogio_ajustar()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_precisa boolean;
  v_job     bigint;
begin
  v_precisa := exists (select 1 from public.plt_automacoes
                        where ligada and arquivada_em is null and gatilho = 'card_parado')
            or exists (select 1 from public.plt_automacao_execucoes where situacao = 'esperando');
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_job from cron.job where jobname = 'plt-automacoes-relogio';
    if v_precisa and v_job is null then
      perform cron.schedule('plt-automacoes-relogio', '* * * * *', 'select plt_privado.fn_automacoes_relogio()');
      return 'agendado';
    elsif not v_precisa and v_job is not null then
      perform cron.unschedule(v_job);
      return 'desligado';
    end if;
    return case when v_precisa then 'ja_estava' else 'nada_a_fazer' end;
  end if;
  return 'sem_pg_cron';
end;
$$;

revoke all on function plt_privado.fn_automacoes_relogio_ajustar() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 13 · O MOTOR
-- ----------------------------------------------------------------------------

-- O QUANDO casa com o que aconteceu? (filtros do gatilho)
create or replace function plt_privado.fn_automacao_casa(p_gatilho text, p_config jsonb, p_ctx jsonb)
returns boolean
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_setor bigint := nullif(p_config ->> 'setor_id', '')::bigint;
  v_etapa bigint := nullif(p_config ->> 'etapa_id', '')::bigint;
begin
  if p_gatilho in ('card_entrou', 'card_iniciado', 'card_arquivado', 'qualidade_marcada') then
    if v_setor is not null and v_setor is distinct from nullif(p_ctx ->> 'setor_id', '')::bigint then
      return false;
    end if;
    if v_etapa is not null and v_etapa is distinct from nullif(p_ctx ->> 'etapa_id', '')::bigint then
      return false;
    end if;
    if p_gatilho = 'qualidade_marcada'
       and not (p_config -> 'estados') ? coalesce(p_ctx ->> 'estado', '') then
      return false;
    end if;
    return true;
  elsif p_gatilho in ('etiqueta_posta', 'etiqueta_tirada') then
    return nullif(p_config ->> 'etiqueta_id', '') is null
        or p_config ->> 'etiqueta_id' = p_ctx ->> 'etiqueta_id';
  elsif p_gatilho = 'pedido_situacao' then
    return (nullif(p_config ->> 'de', '') is null or p_config ->> 'de' = p_ctx ->> 'de')
       and (nullif(p_config ->> 'para', '') is null or p_config ->> 'para' = p_ctx ->> 'para');
  end if;
  return true;  -- pedido_novo, chamada_externa (e card_parado, filtrado pelo relógio)
end;
$$;

revoke all on function plt_privado.fn_automacao_casa(text, jsonb, jsonb) from public, anon, authenticated;

-- Monta o texto do aviso: {pedido} {produto} {setor} {etapa} {automacao} {situacao}
create or replace function plt_privado.fn_automacao_texto(p_modelo text, p_exec public.plt_automacao_execucoes)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card     public.plt_cards%rowtype;
  v_pedido   bigint := p_exec.pedido_id;
  v_numero   text := '';
  v_situacao text := '';
  v_produto  text := '';
  v_setor    text := '';
  v_etapa    text := '';
begin
  if p_exec.card_id is not null then
    select * into v_card from public.plt_cards where id = p_exec.card_id;
    v_pedido := coalesce(v_pedido, v_card.pedido_id);
    v_produto := coalesce(v_card.item_descricao, '');
    select coalesce(s.nome, '') into v_setor from public.plt_setores s where s.id = v_card.setor_atual_id;
    select coalesce(e.nome, '') into v_etapa from public.plt_etapas e where e.id = v_card.etapa_atual_id;
  end if;
  if v_pedido is not null then
    select coalesce(p.numero::text, ''), coalesce(p.situacao, '') into v_numero, v_situacao
      from public.pedidos p where p.id = v_pedido;
  end if;
  if v_produto = '' and v_numero <> '' then
    v_produto := 'Pedido ' || v_numero;
  end if;
  return replace(replace(replace(replace(replace(replace(coalesce(p_modelo, ''),
           '{pedido}', coalesce(v_numero, '')),
           '{produto}', coalesce(v_produto, '')),
           '{setor}', coalesce(v_setor, '')),
           '{etapa}', coalesce(v_etapa, '')),
           '{automacao}', coalesce(p_exec.automacao_nome, '')),
           '{situacao}', coalesce(v_situacao, ''));
end;
$$;

revoke all on function plt_privado.fn_automacao_texto(text, public.plt_automacao_execucoes) from public, anon, authenticated;

-- O "só se…": devolve a frase do que foi avaliado e se bateu.
create or replace function plt_privado.fn_automacao_condicao(p_passo jsonb, p_exec public.plt_automacao_execucoes)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_card   public.plt_cards%rowtype;
  v_cond   text := p_passo ->> 'condicao';
  v_ok     boolean := false;
  v_nome   text;
  v_valor  jsonb;
  v_campo  public.plt_campos%rowtype;
  v_pedido bigint := p_exec.pedido_id;
  v_sit    text;
begin
  if p_exec.card_id is not null then
    select * into v_card from public.plt_cards where id = p_exec.card_id;
    v_pedido := coalesce(v_pedido, v_card.pedido_id);
  end if;

  if v_cond in ('tem_etiqueta', 'nao_tem_etiqueta') then
    select nome into v_nome from public.plt_etiquetas where id = (p_passo ->> 'etiqueta_id')::bigint;
    v_ok := coalesce((p_passo ->> 'etiqueta_id')::bigint = any (v_card.etiquetas), false);
    if v_cond = 'nao_tem_etiqueta' then v_ok := not v_ok; end if;
    return jsonb_build_object('ok', v_ok, 'frase',
      case when v_cond = 'tem_etiqueta' then 'tem a etiqueta "' else 'não tem a etiqueta "' end || coalesce(v_nome, '?') || '"');
  elsif v_cond in ('campo_igual', 'campo_vazio', 'campo_preenchido') then
    select * into v_campo from public.plt_campos where id = (p_passo ->> 'campo_id')::bigint;
    if v_card.id is not null and v_card.tipo <> 'pedido' then
      select valor into v_valor from public.plt_campos_valores where campo_id = v_campo.id and card_id = v_card.id;
    elsif v_pedido is not null then
      select valor into v_valor from public.plt_campos_valores where campo_id = v_campo.id and pedido_id = v_pedido;
    end if;
    if v_cond = 'campo_vazio' then
      v_ok := v_valor is null;
      return jsonb_build_object('ok', v_ok, 'frase', '"' || v_campo.nome || '" está vazio');
    elsif v_cond = 'campo_preenchido' then
      v_ok := v_valor is not null;
      return jsonb_build_object('ok', v_ok, 'frase', '"' || v_campo.nome || '" está preenchido');
    end if;
    v_ok := v_valor is not null and v_valor = plt_privado.fn_campo_valor_normalizado(v_campo, p_passo -> 'valor');
    return jsonb_build_object('ok', v_ok, 'frase', '"' || v_campo.nome || '" = ' || (p_passo -> 'valor')::text);
  elsif v_cond = 'no_setor' then
    select nome into v_nome from public.plt_setores where id = (p_passo ->> 'setor_id')::bigint;
    v_ok := v_card.id is not null and v_card.setor_atual_id = (p_passo ->> 'setor_id')::bigint
            and (nullif(p_passo ->> 'etapa_id', '') is null or v_card.etapa_atual_id = (p_passo ->> 'etapa_id')::bigint);
    return jsonb_build_object('ok', v_ok, 'frase', 'está em ' || coalesce(v_nome, '?'));
  elsif v_cond = 'situacao_pedido' then
    if v_pedido is not null then
      select plt_privado.fn_situacao_normalizada(p.situacao) into v_sit from public.pedidos p where p.id = v_pedido;
    end if;
    v_ok := v_sit is not null and (p_passo -> 'valores') ? v_sit;
    return jsonb_build_object('ok', v_ok, 'frase', 'situação do pedido é ' || coalesce(v_sit, '(sem pedido)'));
  elsif v_cond = 'tipo_card' then
    v_ok := v_card.id is not null and (p_passo -> 'valores') ? v_card.tipo;
    return jsonb_build_object('ok', v_ok, 'frase', 'o card é ' || coalesce(v_card.tipo, '(nenhum)'));
  end if;
  return jsonb_build_object('ok', false, 'frase', 'condição desconhecida');
end;
$$;

revoke all on function plt_privado.fn_automacao_condicao(jsonb, public.plt_automacao_execucoes) from public, anon, authenticated;

-- Um passo de AÇÃO. Devolve {resultado: 'feito'|'pulou', frase}; recusa (raise)
-- quando a regra do sistema não deixa — o executor registra como falha.
create or replace function plt_privado.fn_automacao_acao(p_passo jsonb, p_exec public.plt_automacao_execucoes)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo    text := p_passo ->> 'tipo';
  v_card    public.plt_cards%rowtype;
  v_setor   public.plt_setores%rowtype;
  v_etapa   public.plt_etapas%rowtype;
  v_dest_setor bigint;
  v_dest_etapa bigint;
  v_motivo  text := 'Automação "' || p_exec.automacao_nome || '"';
  v_dados   jsonb := jsonb_build_object('motivo', 'Automação "' || p_exec.automacao_nome || '"',
                                        'automacao_id', p_exec.automacao_id,
                                        'execucao_id', p_exec.id,
                                        'automacao_profundidade', p_exec.profundidade + 1);
  v_id      bigint;
  v_feitos  integer := 0;
  v_nomes   text[] := '{}';
  v_nome    text;
  v_res     text;
  v_pedido  bigint := p_exec.pedido_id;
  v_dest    uuid[];
  v_titulo  text;
  v_corpo   text;
  v_corpo_json jsonb;
  v_headers jsonb;
  v_segredo text;
begin
  if p_exec.card_id is not null then
    select * into v_card from public.plt_cards where id = p_exec.card_id;
    v_pedido := coalesce(v_pedido, v_card.pedido_id);
  end if;

  if v_tipo in ('mover', 'arquivar', 'desarquivar', 'etiqueta_por', 'etiqueta_tirar') and v_card.id is null then
    return jsonb_build_object('resultado', 'pulou', 'frase', 'não há card para isso (o pedido não tem card na plataforma)');
  end if;

  if v_tipo = 'mover' then
    if v_card.arquivado_em is not null then
      return jsonb_build_object('resultado', 'pulou', 'frase', 'o card está arquivado');
    end if;
    select * into v_setor from public.plt_setores where id = (p_passo ->> 'setor_id')::bigint;
    v_dest_setor := v_setor.id;
    v_dest_etapa := nullif(p_passo ->> 'etapa_id', '')::bigint;
    if v_dest_etapa is not null then
      select * into v_etapa from public.plt_etapas where id = v_dest_etapa;
      -- a rota da etapa (D-60) vale aqui como no arrasto: etapa que "manda para"
      -- leva o card à fila do setor dela.
      if v_etapa.setor_destino_id is not null then
        v_dest_setor := v_etapa.setor_destino_id;
        v_dest_etapa := null;
        select * into v_setor from public.plt_setores where id = v_dest_setor;
      end if;
    end if;
    if v_setor.codigo = 'rotas' then
      raise exception 'Para as ROTAS só pelo "Lançar para ROTAS".' using errcode = 'check_violation';
    end if;
    if v_card.tipo in ('pedido', 'reposicao') and v_dest_setor <> v_card.setor_atual_id then
      raise exception 'O card do pedido não sai do PCP — ele vira peças pela liberação.' using errcode = 'check_violation';
    end if;
    if v_dest_setor = v_card.setor_atual_id
       and (v_dest_etapa is null or v_dest_etapa is not distinct from v_card.etapa_atual_id) then
      return jsonb_build_object('resultado', 'pulou', 'frase', 'o card já estava em ' || v_setor.nome);
    end if;
    insert into public.plt_eventos
        (card_id, tipo, origem, setor_origem_id, etapa_origem_id, setor_destino_id, etapa_destino_id, observacao, dados)
    values
        (v_card.id,
         case when v_dest_setor = v_card.setor_atual_id then 'movimentacao_etapa' else 'movimentacao_setor' end,
         'automacao', v_card.setor_atual_id, v_card.etapa_atual_id, v_dest_setor, v_dest_etapa, v_motivo, v_dados);
    select coalesce(e.nome, '') into v_nome from public.plt_cards c
      left join public.plt_etapas e on e.id = c.etapa_atual_id where c.id = v_card.id;
    return jsonb_build_object('resultado', 'feito',
      'frase', 'moveu para ' || v_setor.nome || case when coalesce(v_nome, '') <> '' then ' · ' || v_nome else '' end);

  elsif v_tipo = 'arquivar' then
    if v_card.arquivado_em is not null then
      return jsonb_build_object('resultado', 'pulou', 'frase', 'o card já estava arquivado');
    end if;
    insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, etapa_origem_id, observacao, dados)
    values (v_card.id, 'card_arquivado', 'automacao', v_card.setor_atual_id, v_card.etapa_atual_id, v_motivo, v_dados);
    return jsonb_build_object('resultado', 'feito', 'frase', 'arquivou o card', 'arquivou', true);

  elsif v_tipo = 'desarquivar' then
    if v_card.arquivado_em is null then
      return jsonb_build_object('resultado', 'pulou', 'frase', 'o card não estava arquivado');
    end if;
    insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, etapa_origem_id, observacao, dados)
    values (v_card.id, 'card_desarquivado', 'automacao', v_card.setor_atual_id, v_card.etapa_atual_id, v_motivo, v_dados);
    return jsonb_build_object('resultado', 'feito', 'frase', 'trouxe o card de volta');

  elsif v_tipo = 'etiqueta_por' then
    for v_id in select value::bigint from jsonb_array_elements_text(p_passo -> 'etiquetas') loop
      select nome into v_nome from public.plt_etiquetas where id = v_id;
      if not (v_id = any (v_card.etiquetas)) then
        insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, etapa_origem_id, observacao, dados)
        values (v_card.id, 'etiqueta_adicionada', 'automacao', v_card.setor_atual_id, v_card.etapa_atual_id, v_motivo,
                v_dados || jsonb_build_object('etiqueta_id', v_id, 'etiqueta', v_nome));
        v_card.etiquetas := array_append(v_card.etiquetas, v_id);
        v_nomes := array_append(v_nomes, v_nome);
        v_feitos := v_feitos + 1;
      end if;
    end loop;
    if v_feitos = 0 then
      return jsonb_build_object('resultado', 'pulou', 'frase', 'o card já tinha a(s) etiqueta(s)');
    end if;
    return jsonb_build_object('resultado', 'feito', 'frase', 'pôs ' || array_to_string(v_nomes, ', '));

  elsif v_tipo = 'etiqueta_tirar' then
    for v_id in
      select x from unnest(v_card.etiquetas) x
       where coalesce((p_passo ->> 'todas')::boolean, false)
          or x in (select value::bigint from jsonb_array_elements_text(coalesce(p_passo -> 'etiquetas', '[]'::jsonb)))
    loop
      select nome into v_nome from public.plt_etiquetas where id = v_id;
      insert into public.plt_eventos (card_id, tipo, origem, setor_origem_id, etapa_origem_id, observacao, dados)
      values (v_card.id, 'etiqueta_removida', 'automacao', v_card.setor_atual_id, v_card.etapa_atual_id, v_motivo,
              v_dados || jsonb_build_object('etiqueta_id', v_id, 'etiqueta', v_nome));
      v_nomes := array_append(v_nomes, v_nome);
      v_feitos := v_feitos + 1;
    end loop;
    if v_feitos = 0 then
      return jsonb_build_object('resultado', 'pulou', 'frase', 'o card não tinha a(s) etiqueta(s)');
    end if;
    return jsonb_build_object('resultado', 'feito', 'frase', 'tirou ' || array_to_string(v_nomes, ', '));

  elsif v_tipo = 'campo' then
    select nome into v_nome from public.plt_campos where id = (p_passo ->> 'campo_id')::bigint;
    perform set_config('plt.automacao_motivo', v_motivo, true);
    v_res := plt_privado.fn_campo_gravar(
      (p_passo ->> 'campo_id')::bigint,
      v_card.id,
      case when v_card.id is null then v_pedido end,
      case when coalesce((p_passo ->> 'limpar')::boolean, false) then null else p_passo -> 'valor' end,
      'automacao', null);
    perform set_config('plt.automacao_motivo', '', true);
    if v_res = 'ja_estava' then
      return jsonb_build_object('resultado', 'pulou', 'frase', '"' || v_nome || '" já estava assim');
    end if;
    return jsonb_build_object('resultado', 'feito',
      'frase', case when v_res = 'limpo' then 'limpou "' || v_nome || '"'
                    else 'preencheu "' || v_nome || '" = ' || (p_passo -> 'valor')::text end);

  elsif v_tipo = 'avisar' then
    v_titulo := plt_privado.fn_automacao_texto(coalesce(nullif(p_passo ->> 'titulo', ''), p_exec.automacao_nome), p_exec);
    v_corpo := plt_privado.fn_automacao_texto(p_passo ->> 'mensagem', p_exec);
    if p_passo ->> 'destino' = 'pessoa' then
      select coalesce(array_agg(u.id), '{}') into v_dest from public.plt_usuarios u
       where u.id = (p_passo ->> 'usuario_id')::uuid and u.ativo;
    elsif p_passo ->> 'destino' = 'admins' then
      select coalesce(array_agg(u.id), '{}') into v_dest from public.plt_usuarios u
       where u.ativo and u.papel = 'admin';
    else
      -- líderes (ou todos) do setor escolhido no bloco; sem setor, o do card.
      select coalesce(array_agg(distinct u.id), '{}') into v_dest
        from public.plt_usuario_setores us
        join public.plt_usuarios u on u.id = us.usuario_id and u.ativo
       where us.setor_id = coalesce(nullif(p_passo ->> 'setor_id', '')::bigint, v_card.setor_atual_id)
         and (p_passo ->> 'destino' = 'setor' or us.lider_do_setor);
    end if;
    if coalesce(array_length(v_dest, 1), 0) = 0 then
      return jsonb_build_object('resultado', 'pulou', 'frase', 'ninguém para avisar');
    end if;
    insert into public.plt_notificacoes (destinatario_id, card_id, tipo, titulo, corpo)
    select d, v_card.id, 'automacao', left(v_titulo, 120), left(v_corpo, 1000) from unnest(v_dest) d;
    return jsonb_build_object('resultado', 'feito',
      'frase', 'avisou ' || array_length(v_dest, 1) || case when array_length(v_dest, 1) = 1 then ' pessoa' else ' pessoas' end);

  elsif v_tipo = 'chamar' then
    if to_regproc('net.http_post') is null then
      return jsonb_build_object('resultado', 'pulou', 'frase', 'sem como chamar endereço de fora neste banco');
    end if;
    select a.segredo into v_segredo from public.plt_automacoes a where a.id = p_exec.automacao_id;
    v_corpo_json := jsonb_strip_nulls(jsonb_build_object(
      'automacao', jsonb_build_object('id', p_exec.automacao_id, 'nome', p_exec.automacao_nome),
      'execucao_id', p_exec.id,
      'gatilho', p_exec.gatilho,
      'contexto', p_exec.contexto,
      'card', case when v_card.id is not null then jsonb_build_object(
                'id', v_card.id, 'tipo', v_card.tipo, 'produto', v_card.item_descricao, 'sku', v_card.item_codigo,
                'unidade', v_card.indice_unidade, 'total_unidades', v_card.total_unidades,
                'setor', (select s.nome from public.plt_setores s where s.id = v_card.setor_atual_id),
                'etapa', (select e.nome from public.plt_etapas e where e.id = v_card.etapa_atual_id),
                'etiquetas', (select coalesce(jsonb_agg(t.nome order by t.nome), '[]'::jsonb)
                                from public.plt_etiquetas t where t.id = any (v_card.etiquetas))) end,
      'pedido', (select jsonb_build_object('numero', p.numero, 'situacao', p.situacao)
                   from public.pedidos p where p.id = v_pedido),
      'enviado_em', now()));
    v_headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Domoby-Automacao', p_exec.automacao_id::text,
      'X-Assinatura', encode(extensions.hmac(v_corpo_json::text::bytea, v_segredo::bytea, 'sha256'), 'hex'));
    v_id := net.http_post(url := p_passo ->> 'url', body := v_corpo_json, headers := v_headers);
    return jsonb_build_object('resultado', 'feito', 'frase', 'chamou ' || split_part(split_part(p_passo ->> 'url', '://', 2), '/', 1),
                              'pedido_http', v_id);
  end if;

  raise exception 'Bloco desconhecido: %', v_tipo using errcode = 'check_violation';
end;
$$;

revoke all on function plt_privado.fn_automacao_acao(jsonb, public.plt_automacao_execucoes) from public, anon, authenticated;

-- O EXECUTOR: anda pelos passos a partir de onde parou. Cada ação num bloco
-- protegido: a falha vira registro e PARA a sequência, sem desfazer nada de
-- quem disparou. "Esperar" agenda o resto e liga o relógio.
create or replace function plt_privado.fn_automacao_continuar(p_exec_id bigint)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_exec   public.plt_automacao_execucoes%rowtype;
  v_auto   public.plt_automacoes%rowtype;
  v_passos jsonb;
  v_total  integer;
  v_i      integer;
  v_passo  jsonb;
  v_ret    jsonb;
  v_res    jsonb;
  v_min    numeric;
begin
  select * into v_exec from public.plt_automacao_execucoes where id = p_exec_id for update;
  if not found or v_exec.situacao not in ('rodando', 'esperando') then
    return coalesce(v_exec.situacao, 'sumiu');
  end if;
  select * into v_auto from public.plt_automacoes where id = v_exec.automacao_id;
  v_res := v_exec.resultado;

  if v_exec.situacao = 'esperando' and not (v_auto.ligada and v_auto.arquivada_em is null) then
    update public.plt_automacao_execucoes
       set situacao = 'parou', proximo_passo = null, executar_em = null, atualizada_em = now(),
           avaliacao = coalesce(avaliacao || ' · ', '') || 'a automação foi desligada durante a espera'
     where id = v_exec.id;
    v_exec.situacao := 'parou';
  else
    v_passos := v_exec.passos_previstos;
    v_total := jsonb_array_length(v_passos);
    v_i := coalesce(v_exec.proximo_passo, 0);
    v_exec.situacao := 'concluida';

    while v_i < v_total loop
      v_passo := v_passos -> v_i;

      if v_passo ->> 'tipo' = 'esperar' then
        v_min := (v_passo ->> 'quantidade')::numeric
                 * case v_passo ->> 'unidade' when 'minutos' then 1 when 'horas' then 60 else 1440 end;
        v_res := v_res || jsonb_build_array(jsonb_build_object(
                   'n', v_i + 1, 'tipo', 'esperar', 'resultado', 'esperando',
                   'frase', 'esperando ' || (v_passo ->> 'quantidade') || ' ' || (v_passo ->> 'unidade'),
                   'em', now()));
        update public.plt_automacao_execucoes
           set situacao = 'esperando', proximo_passo = v_i + 1,
               executar_em = now() + make_interval(mins => v_min::integer),
               resultado = v_res, atualizada_em = now()
         where id = v_exec.id;
        perform plt_privado.fn_automacoes_relogio_ajustar();
        return 'esperando';
      end if;

      begin
        if v_passo ->> 'tipo' = 'se' then
          v_ret := plt_privado.fn_automacao_condicao(v_passo, v_exec);
          v_res := v_res || jsonb_build_array(jsonb_build_object(
                     'n', v_i + 1, 'tipo', 'se',
                     'resultado', case when (v_ret ->> 'ok')::boolean then 'bateu' else 'nao_bateu' end,
                     'frase', 'só se ' || (v_ret ->> 'frase'), 'em', now()));
          if not (v_ret ->> 'ok')::boolean then
            v_exec.situacao := 'parou';
          end if;
        else
          perform set_config('plt.automacao_canvas', 'on', true);
          v_ret := plt_privado.fn_automacao_acao(v_passo, v_exec);
          perform set_config('plt.automacao_canvas', 'off', true);
          v_res := v_res || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
                     'n', v_i + 1, 'tipo', v_passo ->> 'tipo', 'resultado', v_ret ->> 'resultado',
                     'frase', v_ret ->> 'frase', 'em', now(),
                     'arquivou', (v_ret ->> 'arquivou')::boolean)));
        end if;
      exception when others then
        -- O bloco desfaz só o que ESTE passo gravou; a marca do motor volta sozinha.
        v_res := v_res || jsonb_build_array(jsonb_build_object(
                   'n', v_i + 1, 'tipo', v_passo ->> 'tipo', 'resultado', 'falhou',
                   'frase', sqlerrm, 'em', now()));
        v_exec.situacao := 'falhou';
      end;
      exit when v_exec.situacao in ('parou', 'falhou');
      v_i := v_i + 1;
    end loop;

    update public.plt_automacao_execucoes
       set situacao = v_exec.situacao, resultado = v_res, proximo_passo = null, executar_em = null,
           atualizada_em = now()
     where id = v_exec.id;
  end if;

  -- Um registro na trilha por execução encerrada (a Auditoria mostra).
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (null, 'automacao_executada', jsonb_strip_nulls(jsonb_build_object(
    'automacao_id', v_exec.automacao_id,
    'automacao', v_exec.automacao_nome,
    'execucao_id', v_exec.id,
    'gatilho', v_exec.gatilho,
    'card_id', v_exec.card_id,
    'pedido_id', v_exec.pedido_id,
    'situacao', v_exec.situacao,
    'motivo', 'Automação "' || v_exec.automacao_nome || '"')));

  return v_exec.situacao;
end;
$$;

revoke all on function plt_privado.fn_automacao_continuar(bigint) from public, anon, authenticated;

-- O DISPARO: acha as automações ligadas daquele QUANDO que casam e roda cada
-- uma. Profundidade ≥ 5 → registra "barrada" e não roda (o ciclo para).
create or replace function plt_privado.fn_automacoes_disparar(
  p_gatilho      text,
  p_card_id      bigint,
  p_pedido_id    bigint,
  p_evento_id    bigint,
  p_ctx          jsonb,
  p_profundidade integer,
  p_so_automacao bigint default null,
  p_chave        text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auto   public.plt_automacoes%rowtype;
  v_card   public.plt_cards%rowtype;
  v_exec   bigint;
  v_aval   text;
  v_sit    text;
  v_total  integer := 0;
  v_no_gesto integer;
begin
  for v_auto in
    select * from public.plt_automacoes a
     where a.ligada and a.arquivada_em is null and a.gatilho = p_gatilho
       and (p_so_automacao is null or a.id = p_so_automacao)
     order by a.id
  loop
    if not plt_privado.fn_automacao_casa(p_gatilho, v_auto.gatilho_config, p_ctx) then
      continue;
    end if;

    v_sit := 'rodando';
    v_aval := null;
    -- Disjuntor do gesto: no máximo 50 execuções na mesma transação (pega até
    -- ciclo que passe por uma reação do próprio sistema, que não carrega a
    -- profundidade no evento).
    v_no_gesto := coalesce(nullif(current_setting('plt.automacao_execucoes_gesto', true), '')::integer, 0) + 1;
    perform set_config('plt.automacao_execucoes_gesto', v_no_gesto::text, true);
    if p_profundidade >= 5 then
      v_sit := 'barrada';
      v_aval := 'parou: limite de 5 automações em cadeia';
    elsif v_no_gesto > 50 then
      v_sit := 'barrada';
      v_aval := 'parou: limite de 50 execuções de automação no mesmo gesto';
    elsif p_gatilho = 'card_entrou' and p_card_id is not null then
      -- No fechamento do gesto, o card ainda está onde entrou?
      select * into v_card from public.plt_cards where id = p_card_id;
      if v_card.arquivado_em is not null
         or v_card.setor_atual_id is distinct from nullif(p_ctx ->> 'setor_id', '')::bigint
         or v_card.etapa_atual_id is distinct from nullif(p_ctx ->> 'etapa_id', '')::bigint then
        v_sit := 'ignorada';
        v_aval := 'o card já tinha saído da etapa quando o gesto terminou';
      else
        v_aval := 'o card entrou e continua na etapa';
      end if;
    end if;

    begin
      insert into public.plt_automacao_execucoes
          (automacao_id, automacao_nome, gatilho, card_id, pedido_id, evento_id, profundidade, chave,
           situacao, avaliacao, passos_previstos, contexto)
      values
          (v_auto.id, v_auto.nome, p_gatilho, p_card_id, p_pedido_id, p_evento_id, p_profundidade, p_chave,
           v_sit, v_aval, v_auto.passos, coalesce(p_ctx, '{}'::jsonb))
      returning id into v_exec;
    exception when unique_violation then
      continue;  -- a mesma chave já disparou (ex.: o mesmo "parado" do mesmo card)
    end;

    v_total := v_total + 1;
    if v_sit = 'rodando' then
      begin
        perform plt_privado.fn_automacao_continuar(v_exec);
      exception when others then
        -- uma automação com defeito não leva as outras junto
        update public.plt_automacao_execucoes
           set situacao = 'falhou', atualizada_em = now(),
               avaliacao = coalesce(avaliacao || ' · ', '') || 'erro: ' || sqlerrm
         where id = v_exec;
      end;
    else
      insert into public.plt_logs_atividade (usuario_id, acao, contexto)
      values (null, 'automacao_executada', jsonb_strip_nulls(jsonb_build_object(
        'automacao_id', v_auto.id, 'automacao', v_auto.nome, 'execucao_id', v_exec,
        'gatilho', p_gatilho, 'card_id', p_card_id, 'pedido_id', p_pedido_id,
        'situacao', v_sit, 'motivo', v_aval)));
    end if;
  end loop;
  return v_total;
end;
$$;

revoke all on function plt_privado.fn_automacoes_disparar(text, bigint, bigint, bigint, jsonb, integer, bigint, text) from public, anon, authenticated;

-- O GATILHO ADIADO sobre os eventos: roda no FECHAMENTO do gesto, depois de
-- tudo o que o gesto gravou (o ensaio em PGlite provou cascata e corte de
-- ciclo). À prova de falha: nada aqui desfaz o gesto nem a integração.
create or replace function plt_privado.fn_automacoes_evento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prof integer;
  v_card public.plt_cards%rowtype;
begin
  begin
    if not exists (select 1 from public.plt_automacoes where ligada and arquivada_em is null) then
      return null;
    end if;
    v_prof := coalesce(nullif(new.dados ->> 'automacao_profundidade', '')::integer, 0);
    select * into v_card from public.plt_cards where id = new.card_id;

    if new.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa') then
      if new.tipo = 'card_criado' and v_card.tipo = 'pedido' then
        perform plt_privado.fn_automacoes_disparar('pedido_novo', new.card_id, v_card.pedido_id, new.id,
          jsonb_build_object('numero', new.dados ->> 'numero'), v_prof);
      end if;
      if new.setor_destino_id is not null then
        perform plt_privado.fn_automacoes_disparar('card_entrou', new.card_id, v_card.pedido_id, new.id,
          jsonb_build_object('setor_id', new.setor_destino_id, 'etapa_id', new.etapa_destino_id), v_prof);
      end if;
    elsif new.tipo = 'execucao_iniciada' then
      perform plt_privado.fn_automacoes_disparar('card_iniciado', new.card_id, v_card.pedido_id, new.id,
        jsonb_build_object('setor_id', coalesce(new.setor_origem_id, v_card.setor_atual_id),
                           'etapa_id', coalesce(new.etapa_origem_id, v_card.etapa_atual_id)), v_prof);
    elsif new.tipo in ('qualidade_marcada', 'qualidade_parecer') then
      perform plt_privado.fn_automacoes_disparar('qualidade_marcada', new.card_id, v_card.pedido_id, new.id,
        jsonb_build_object('estado', new.estado_qualidade,
                           'momento', case when new.tipo = 'qualidade_marcada' then 'entrega' else 'recebimento' end,
                           'setor_id', case when new.tipo = 'qualidade_marcada'
                                            then coalesce(new.setor_origem_id, v_card.setor_atual_id)
                                            else v_card.setor_atual_id end), v_prof);
    elsif new.tipo = 'card_arquivado' then
      perform plt_privado.fn_automacoes_disparar('card_arquivado', new.card_id, v_card.pedido_id, new.id,
        jsonb_build_object('setor_id', v_card.setor_atual_id, 'etapa_id', v_card.etapa_atual_id), v_prof);
    elsif new.tipo in ('etiqueta_adicionada', 'etiqueta_removida') then
      perform plt_privado.fn_automacoes_disparar(
        case when new.tipo = 'etiqueta_adicionada' then 'etiqueta_posta' else 'etiqueta_tirada' end,
        new.card_id, v_card.pedido_id, new.id,
        jsonb_build_object('etiqueta_id', new.dados ->> 'etiqueta_id'), v_prof);
    end if;
  exception when others then
    raise warning 'plt_automacoes: % — o gesto segue intacto', sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function plt_privado.fn_automacoes_evento() from public, anon, authenticated;

-- O nome com "zzzz" é de propósito: se alguém forçar o modo imediato
-- (set constraints all immediate), ele ainda roda DEPOIS da projeção e dos
-- outros gatilhos (a ordem do mesmo momento é alfabética). Achado no ensaio
-- no banco real (02/10).
drop trigger if exists plt_eventos_automacoes on public.plt_eventos;
drop trigger if exists plt_eventos_zzzz_automacoes on public.plt_eventos;
create constraint trigger plt_eventos_zzzz_automacoes
  after insert on public.plt_eventos
  deferrable initially deferred
  for each row
  when (new.tipo in ('card_criado', 'movimentacao_setor', 'movimentacao_etapa', 'execucao_iniciada',
                     'qualidade_marcada', 'qualidade_parecer', 'card_arquivado',
                     'etiqueta_adicionada', 'etiqueta_removida'))
  execute function plt_privado.fn_automacoes_evento();

-- A situação do pedido mudou no Tiny → automações "pedido mudou de situação".
-- Adiado (roda depois do que o próprio Tiny gravou e dos gatilhos da casa) e
-- à prova de falha: nada aqui pode derrubar uma gravação do Tiny.
create or replace function plt_privado.fn_automacoes_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_de   text;
  v_para text;
  v_card bigint;
begin
  begin
    if not exists (select 1 from public.plt_automacoes
                    where ligada and arquivada_em is null and gatilho = 'pedido_situacao') then
      return null;
    end if;
    v_de := plt_privado.fn_situacao_normalizada(old.situacao);
    v_para := plt_privado.fn_situacao_normalizada(new.situacao);
    if v_de is not distinct from v_para then
      return null;
    end if;
    select c.id into v_card from public.plt_cards c where c.pedido_id = new.id and c.tipo = 'pedido';
    perform plt_privado.fn_automacoes_disparar('pedido_situacao', v_card, new.id, null,
      jsonb_build_object('de', v_de, 'para', v_para, 'numero', new.numero), 0);
  exception when others then
    raise warning 'plt_automacoes (pedido): % — a integração segue intacta', sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function plt_privado.fn_automacoes_pedido() from public, anon, authenticated;

drop trigger if exists plt_pedidos_automacoes on public.pedidos;
drop trigger if exists plt_pedidos_zz_automacoes on public.pedidos;
create constraint trigger plt_pedidos_zz_automacoes
  after update of situacao on public.pedidos
  deferrable initially deferred
  for each row
  when (old.situacao is distinct from new.situacao)
  execute function plt_privado.fn_automacoes_pedido();

comment on trigger plt_pedidos_zz_automacoes on public.pedidos is
  'SESSAO-27 (D-103): situação do pedido mudou → automações "pedido mudou de situação" (adiado, à prova de falha — nunca derruba a gravação do Tiny). O segundo objeto da plataforma numa tabela da integração (o primeiro é plt_pedidos_reagir_*).';

-- O TIQUE DO RELÓGIO: quem terminou de esperar segue; "parado há N" dispara
-- uma vez por permanência (o tempo conta desde a chegada ou desde que a
-- automação foi ligada — o que for MAIS NOVO: ligar não dispara em massa).
create or replace function plt_privado.fn_automacoes_relogio()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_exec   bigint;
  v_auto   public.plt_automacoes%rowtype;
  v_card   record;
  v_esperas integer := 0;
  v_parados integer := 0;
  v_horas  numeric;
  v_setor  bigint;
  v_etapa  bigint;
begin
  for v_exec in
    select id from public.plt_automacao_execucoes
     where situacao = 'esperando' and executar_em <= now()
     order by executar_em limit 100
  loop
    begin
      perform plt_privado.fn_automacao_continuar(v_exec);
      v_esperas := v_esperas + 1;
    exception when others then
      raise warning 'plt_automacoes (relógio): execução % — %', v_exec, sqlerrm;
    end;
  end loop;

  for v_auto in
    select * from public.plt_automacoes
     where ligada and arquivada_em is null and gatilho = 'card_parado'
  loop
    v_horas := (v_auto.gatilho_config ->> 'horas')::numeric;
    v_setor := nullif(v_auto.gatilho_config ->> 'setor_id', '')::bigint;
    v_etapa := nullif(v_auto.gatilho_config ->> 'etapa_id', '')::bigint;
    for v_card in
      select c.id, c.pedido_id, c.setor_atual_id, c.etapa_atual_id, c.desde
        from public.plt_cards c
        join public.plt_setores s on s.id = c.setor_atual_id
       where c.arquivado_em is null
         and c.desde is not null
         and ((v_setor is null and s.papel_no_fluxo = 'producao') or c.setor_atual_id = v_setor)
         and (v_etapa is null or c.etapa_atual_id = v_etapa)
         and greatest(c.desde, coalesce(v_auto.ligada_em, c.desde)) <= now() - make_interval(mins => (v_horas * 60)::integer)
         and not exists (select 1 from public.plt_automacao_execucoes x
                          where x.automacao_id = v_auto.id
                            and x.chave = 'parado:' || c.id || ':' || floor(extract(epoch from c.desde))::bigint)
       order by c.desde
       limit 200
    loop
      begin
        v_parados := v_parados + plt_privado.fn_automacoes_disparar('card_parado', v_card.id, v_card.pedido_id, null,
          jsonb_build_object('setor_id', v_card.setor_atual_id, 'etapa_id', v_card.etapa_atual_id,
                             'desde', v_card.desde, 'horas', v_horas),
          0, v_auto.id, 'parado:' || v_card.id || ':' || floor(extract(epoch from v_card.desde))::bigint);
      exception when others then
        raise warning 'plt_automacoes (parado): card % — %', v_card.id, sqlerrm;
      end;
    end loop;
  end loop;

  return jsonb_build_object('esperas', v_esperas, 'parados', v_parados,
                            'relogio', plt_privado.fn_automacoes_relogio_ajustar());
end;
$$;

revoke all on function plt_privado.fn_automacoes_relogio() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 14 · PORTAS (public) — todas com gate dentro (E-11: endpoint de propósito)
-- ----------------------------------------------------------------------------

-- 14.1 · Etiquetas (admin)
create or replace function public.plt_fn_etiqueta_salvar(p_id bigint, p_nome text, p_cor text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
  v_id bigint;
begin
  if v_eu is null or not plt_privado.fn_eh_admin() then
    raise exception 'Etiquetas são cadastradas pelo admin.' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.plt_etiquetas
              where lower(btrim(nome)) = lower(btrim(p_nome)) and arquivada_em is null
                and id is distinct from p_id) then
    raise exception 'Já existe uma etiqueta "%".', btrim(p_nome) using errcode = 'unique_violation';
  end if;
  if p_id is null then
    insert into public.plt_etiquetas (nome, cor, criada_por) values (btrim(p_nome), p_cor, v_eu)
    returning id into v_id;
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, 'etiqueta_criada', jsonb_build_object('etiqueta_id', v_id, 'etiqueta', btrim(p_nome), 'cor', p_cor));
  else
    update public.plt_etiquetas set nome = btrim(p_nome), cor = p_cor, atualizada_em = now()
     where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Etiqueta não encontrada.' using errcode = 'no_data_found';
    end if;
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, 'etiqueta_editada', jsonb_build_object('etiqueta_id', v_id, 'etiqueta', btrim(p_nome), 'cor', p_cor));
  end if;
  return v_id;
end;
$$;

create or replace function public.plt_fn_etiqueta_arquivar(p_id bigint, p_arquivar boolean default true)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
  v_nome text;
begin
  if v_eu is null or not plt_privado.fn_eh_admin() then
    raise exception 'Etiquetas são cadastradas pelo admin.' using errcode = 'insufficient_privilege';
  end if;
  select nome into v_nome from public.plt_etiquetas where id = p_id;
  if v_nome is null then
    raise exception 'Etiqueta não encontrada.' using errcode = 'no_data_found';
  end if;
  if not p_arquivar and exists (select 1 from public.plt_etiquetas
                                 where lower(btrim(nome)) = lower(btrim(v_nome)) and arquivada_em is null and id <> p_id) then
    raise exception 'Já existe outra etiqueta "%" ativa.', v_nome using errcode = 'unique_violation';
  end if;
  update public.plt_etiquetas
     set arquivada_em = case when p_arquivar then coalesce(arquivada_em, now()) end, atualizada_em = now()
   where id = p_id;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_eu, case when p_arquivar then 'etiqueta_arquivada' else 'etiqueta_reativada' end,
          jsonb_build_object('etiqueta_id', p_id, 'etiqueta', v_nome));
end;
$$;

-- Excluir de fato só etiqueta que nunca foi usada (nem por card, nem por automação).
create or replace function public.plt_fn_etiqueta_excluir(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
  v_nome text;
begin
  if v_eu is null or not plt_privado.fn_eh_admin() then
    raise exception 'Etiquetas são cadastradas pelo admin.' using errcode = 'insufficient_privilege';
  end if;
  select nome into v_nome from public.plt_etiquetas where id = p_id;
  if v_nome is null then
    raise exception 'Etiqueta não encontrada.' using errcode = 'no_data_found';
  end if;
  if exists (select 1 from public.plt_eventos
              where tipo in ('etiqueta_adicionada', 'etiqueta_removida') and dados ->> 'etiqueta_id' = p_id::text)
     or exists (select 1 from public.plt_automacoes a
                 where a.gatilho_config ->> 'etiqueta_id' = p_id::text
                    or exists (select 1 from jsonb_array_elements(a.passos) s
                                where s ->> 'etiqueta_id' = p_id::text
                                   or exists (select 1 from jsonb_array_elements_text(coalesce(s -> 'etiquetas', '[]'::jsonb)) t
                                               where t = p_id::text))) then
    raise exception 'A etiqueta "%" já foi usada — arquive em vez de excluir (a história fica).', v_nome
      using errcode = 'foreign_key_violation';
  end if;
  delete from public.plt_etiquetas where id = p_id;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_eu, 'etiqueta_excluida', jsonb_build_object('etiqueta_id', p_id, 'etiqueta', v_nome));
end;
$$;

-- 14.2 · Campos customizados (admin)
create or replace function public.plt_fn_campo_salvar(
  p_id bigint, p_nome text, p_tipo text, p_opcoes text[], p_em_pecas boolean, p_em_pedidos boolean)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu    uuid := plt_privado.fn_usuario_atual();
  v_id    bigint;
  v_campo public.plt_campos%rowtype;
  v_opcoes text[];
begin
  if v_eu is null or not plt_privado.fn_eh_admin() then
    raise exception 'Campos customizados são cadastrados pelo admin.' using errcode = 'insufficient_privilege';
  end if;
  -- sem repetidas e sem vazias, na ORDEM em que o admin escreveu
  select coalesce(array_agg(s.o order by s.primeira), '{}') into v_opcoes
    from (select btrim(t.o) as o, min(t.ord) as primeira
            from unnest(coalesce(p_opcoes, '{}')) with ordinality t(o, ord)
           where btrim(t.o) <> ''
           group by btrim(t.o)) s;
  if p_tipo <> 'lista' then
    v_opcoes := '{}';
  end if;
  if exists (select 1 from public.plt_campos
              where lower(btrim(nome)) = lower(btrim(p_nome)) and arquivado_em is null and id is distinct from p_id) then
    raise exception 'Já existe um campo "%".', btrim(p_nome) using errcode = 'unique_violation';
  end if;
  if p_id is null then
    insert into public.plt_campos (nome, tipo, opcoes, em_pecas, em_pedidos, criado_por)
    values (btrim(p_nome), p_tipo, v_opcoes, coalesce(p_em_pecas, false), coalesce(p_em_pedidos, false), v_eu)
    returning id into v_id;
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, 'campo_criado', jsonb_build_object('campo_id', v_id, 'campo', btrim(p_nome), 'tipo', p_tipo));
    return v_id;
  end if;

  select * into v_campo from public.plt_campos where id = p_id;
  if not found then
    raise exception 'Campo não encontrado.' using errcode = 'no_data_found';
  end if;
  if v_campo.tipo <> p_tipo and exists (select 1 from public.plt_campos_valores where campo_id = p_id) then
    raise exception 'O campo "%" já tem valores — o tipo não muda mais (crie outro campo).', v_campo.nome
      using errcode = 'check_violation';
  end if;
  if v_campo.tipo = 'lista' and p_tipo = 'lista' and exists (
       select 1 from public.plt_campos_valores
        where campo_id = p_id and not ((valor #>> '{}') = any (v_opcoes))) then
    raise exception 'Há cards/pedidos com uma opção que você tirou — mantenha a opção ou limpe esses valores antes.'
      using errcode = 'check_violation';
  end if;
  if not coalesce(p_em_pecas, false) and exists (select 1 from public.plt_campos_valores where campo_id = p_id and card_id is not null) then
    raise exception 'O campo "%" já tem valor em peças — não dá para tirar das peças.', v_campo.nome using errcode = 'check_violation';
  end if;
  if not coalesce(p_em_pedidos, false) and exists (select 1 from public.plt_campos_valores where campo_id = p_id and pedido_id is not null) then
    raise exception 'O campo "%" já tem valor em pedidos — não dá para tirar dos pedidos.', v_campo.nome using errcode = 'check_violation';
  end if;
  update public.plt_campos
     set nome = btrim(p_nome), tipo = p_tipo, opcoes = v_opcoes,
         em_pecas = coalesce(p_em_pecas, false), em_pedidos = coalesce(p_em_pedidos, false), atualizado_em = now()
   where id = p_id;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_eu, 'campo_editado', jsonb_build_object('campo_id', p_id, 'campo', btrim(p_nome), 'tipo', p_tipo));
  return p_id;
end;
$$;

create or replace function public.plt_fn_campo_arquivar(p_id bigint, p_arquivar boolean default true)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
  v_nome text;
begin
  if v_eu is null or not plt_privado.fn_eh_admin() then
    raise exception 'Campos customizados são cadastrados pelo admin.' using errcode = 'insufficient_privilege';
  end if;
  select nome into v_nome from public.plt_campos where id = p_id;
  if v_nome is null then
    raise exception 'Campo não encontrado.' using errcode = 'no_data_found';
  end if;
  if not p_arquivar and exists (select 1 from public.plt_campos
                                 where lower(btrim(nome)) = lower(btrim(v_nome)) and arquivado_em is null and id <> p_id) then
    raise exception 'Já existe outro campo "%" ativo.', v_nome using errcode = 'unique_violation';
  end if;
  update public.plt_campos
     set arquivado_em = case when p_arquivar then coalesce(arquivado_em, now()) end, atualizado_em = now()
   where id = p_id;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_eu, case when p_arquivar then 'campo_arquivado' else 'campo_reativado' end,
          jsonb_build_object('campo_id', p_id, 'campo', v_nome));
end;
$$;

-- Excluir de fato só campo que nunca teve valor (nem ninguém o usa numa automação).
create or replace function public.plt_fn_campo_excluir(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
  v_nome text;
begin
  if v_eu is null or not plt_privado.fn_eh_admin() then
    raise exception 'Campos customizados são cadastrados pelo admin.' using errcode = 'insufficient_privilege';
  end if;
  select nome into v_nome from public.plt_campos where id = p_id;
  if v_nome is null then
    raise exception 'Campo não encontrado.' using errcode = 'no_data_found';
  end if;
  if exists (select 1 from public.plt_campos_valores where campo_id = p_id)
     or exists (select 1 from public.plt_logs_atividade
                 where acao in ('campo_preenchido', 'campo_limpo') and contexto ->> 'campo_id' = p_id::text)
     or exists (select 1 from public.plt_automacoes a, jsonb_array_elements(a.passos) s
                 where s ->> 'campo_id' = p_id::text) then
    raise exception 'O campo "%" já foi usado — arquive em vez de excluir (a história fica).', v_nome
      using errcode = 'foreign_key_violation';
  end if;
  delete from public.plt_campos where id = p_id;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_eu, 'campo_excluido', jsonb_build_object('campo_id', p_id, 'campo', v_nome));
end;
$$;

-- O admin preenche (ou limpa) à mão, no card ou no pedido.
create or replace function public.plt_fn_campo_definir(
  p_campo_id bigint, p_card_id bigint default null, p_pedido_id bigint default null, p_valor jsonb default null)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
begin
  if v_eu is null or not plt_privado.fn_eh_admin() then
    raise exception 'Só o admin preenche campo customizado à mão.' using errcode = 'insufficient_privilege';
  end if;
  return plt_privado.fn_campo_gravar(p_campo_id, p_card_id, p_pedido_id, p_valor, 'interface', v_eu);
end;
$$;

-- 14.3 · Trazer de volta à mão (admin)
create or replace function public.plt_fn_desarquivar_card(p_card_id bigint, p_observacao text default null)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu   uuid := plt_privado.fn_usuario_atual();
  v_card public.plt_cards%rowtype;
  v_id   bigint;
begin
  if v_eu is null or not plt_privado.fn_eh_admin() then
    raise exception 'Trazer de volta um card arquivado é gesto do admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_card from public.plt_cards where id = p_card_id;
  if not found then
    raise exception 'Card não encontrado.' using errcode = 'no_data_found';
  end if;
  insert into public.plt_eventos (card_id, tipo, usuario_id, origem, setor_origem_id, etapa_origem_id, observacao)
  values (v_card.id, 'card_desarquivado', v_eu, 'interface', v_card.setor_atual_id, v_card.etapa_atual_id,
          nullif(btrim(coalesce(p_observacao, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- 14.4 · Automações (super admin)
create or replace function public.plt_fn_automacoes(p_limite integer default 30, p_deslocamento integer default 0,
                                                    p_arquivadas boolean default false)
returns table (
  id bigint, nome text, ligada boolean, gatilho text, gatilho_config jsonb, passos_total integer,
  ligada_em timestamptz, atualizada_em timestamptz, arquivada_em timestamptz,
  ultima_execucao_em timestamptz, ultima_situacao text, execucoes_24h integer, contagem_total bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'As automações são só do super admin.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select a.id, a.nome, a.ligada, a.gatilho, a.gatilho_config, jsonb_array_length(a.passos),
         a.ligada_em, a.atualizada_em, a.arquivada_em,
         u.criada_em, u.situacao,
         (select count(*)::int from public.plt_automacao_execucoes x
           where x.automacao_id = a.id and x.criada_em > now() - interval '24 hours'),
         count(*) over ()
    from public.plt_automacoes a
    left join lateral (select x.criada_em, x.situacao from public.plt_automacao_execucoes x
                        where x.automacao_id = a.id order by x.id desc limit 1) u on true
   where (a.arquivada_em is not null) = coalesce(p_arquivadas, false)
   order by a.ligada desc, a.nome
   limit least(greatest(coalesce(p_limite, 30), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
end;
$$;

create or replace function public.plt_fn_automacao(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb;
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'As automações são só do super admin.' using errcode = 'insufficient_privilege';
  end if;
  select jsonb_build_object('id', a.id, 'nome', a.nome, 'ligada', a.ligada, 'gatilho', a.gatilho,
                            'gatilho_config', a.gatilho_config, 'passos', a.passos, 'desenho', a.desenho,
                            'segredo', a.segredo, 'ligada_em', a.ligada_em, 'arquivada_em', a.arquivada_em,
                            'criada_em', a.criada_em, 'atualizada_em', a.atualizada_em)
    into v from public.plt_automacoes a where a.id = p_id;
  if v is null then
    raise exception 'Automação não encontrada.' using errcode = 'no_data_found';
  end if;
  return v;
end;
$$;

create or replace function public.plt_fn_automacao_salvar(
  p_id bigint, p_nome text, p_gatilho text, p_gatilho_config jsonb, p_passos jsonb, p_desenho jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
  v_id bigint;
  v_auto public.plt_automacoes%rowtype;
begin
  if v_eu is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'As automações são só do super admin.' using errcode = 'insufficient_privilege';
  end if;
  if char_length(btrim(coalesce(p_nome, ''))) not between 1 and 80 then
    raise exception 'Dê um nome à automação (até 80 letras).' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.plt_automacoes
              where lower(btrim(nome)) = lower(btrim(p_nome)) and arquivada_em is null and id is distinct from p_id) then
    raise exception 'Já existe uma automação "%".', btrim(p_nome) using errcode = 'unique_violation';
  end if;
  perform plt_privado.fn_automacao_validar(p_gatilho, coalesce(p_gatilho_config, '{}'::jsonb), coalesce(p_passos, '[]'::jsonb));

  if p_id is null then
    insert into public.plt_automacoes (nome, gatilho, gatilho_config, passos, desenho, criada_por)
    values (btrim(p_nome), p_gatilho, coalesce(p_gatilho_config, '{}'::jsonb), coalesce(p_passos, '[]'::jsonb),
            coalesce(p_desenho, '{}'::jsonb), v_eu)
    returning id into v_id;
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, 'automacao_criada', jsonb_build_object('automacao_id', v_id, 'automacao', btrim(p_nome), 'gatilho', p_gatilho));
  else
    select * into v_auto from public.plt_automacoes where id = p_id for update;
    if not found then
      raise exception 'Automação não encontrada.' using errcode = 'no_data_found';
    end if;
    if v_auto.ligada and jsonb_array_length(coalesce(p_passos, '[]'::jsonb)) = 0 then
      raise exception 'Automação ligada precisa de pelo menos um passo — desligue antes de esvaziar.' using errcode = 'check_violation';
    end if;
    update public.plt_automacoes
       set nome = btrim(p_nome), gatilho = p_gatilho, gatilho_config = coalesce(p_gatilho_config, '{}'::jsonb),
           passos = coalesce(p_passos, '[]'::jsonb), desenho = coalesce(p_desenho, '{}'::jsonb), atualizada_em = now()
     where id = p_id
     returning id into v_id;
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, 'automacao_editada', jsonb_build_object('automacao_id', v_id, 'automacao', btrim(p_nome), 'gatilho', p_gatilho,
                                                         'ligada', v_auto.ligada));
  end if;
  perform plt_privado.fn_automacoes_relogio_ajustar();
  return v_id;
end;
$$;

create or replace function public.plt_fn_automacao_ligar(p_id bigint, p_ligar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
  v_auto public.plt_automacoes%rowtype;
begin
  if v_eu is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'As automações são só do super admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_auto from public.plt_automacoes where id = p_id for update;
  if not found then
    raise exception 'Automação não encontrada.' using errcode = 'no_data_found';
  end if;
  if p_ligar then
    if v_auto.arquivada_em is not null then
      raise exception 'A automação está arquivada — reative antes de ligar.' using errcode = 'check_violation';
    end if;
    if jsonb_array_length(v_auto.passos) = 0 then
      raise exception 'A automação ainda não tem nenhum passo — monte pelo menos um FAÇA antes de ligar.' using errcode = 'check_violation';
    end if;
    perform plt_privado.fn_automacao_validar(v_auto.gatilho, v_auto.gatilho_config, v_auto.passos);
  end if;
  if v_auto.ligada is distinct from p_ligar then
    update public.plt_automacoes
       set ligada = p_ligar, ligada_em = case when p_ligar then now() end, atualizada_em = now()
     where id = p_id;
    insert into public.plt_logs_atividade (usuario_id, acao, contexto)
    values (v_eu, case when p_ligar then 'automacao_ligada' else 'automacao_desligada' end,
            jsonb_build_object('automacao_id', p_id, 'automacao', v_auto.nome));
  end if;
  return jsonb_build_object('ligada', p_ligar, 'relogio', plt_privado.fn_automacoes_relogio_ajustar());
end;
$$;

create or replace function public.plt_fn_automacao_arquivar(p_id bigint, p_arquivar boolean default true)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu uuid := plt_privado.fn_usuario_atual();
  v_auto public.plt_automacoes%rowtype;
begin
  if v_eu is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'As automações são só do super admin.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_auto from public.plt_automacoes where id = p_id for update;
  if not found then
    raise exception 'Automação não encontrada.' using errcode = 'no_data_found';
  end if;
  if not p_arquivar and exists (select 1 from public.plt_automacoes
                                 where lower(btrim(nome)) = lower(btrim(v_auto.nome)) and arquivada_em is null and id <> p_id) then
    raise exception 'Já existe outra automação "%" ativa.', v_auto.nome using errcode = 'unique_violation';
  end if;
  update public.plt_automacoes
     set arquivada_em = case when p_arquivar then coalesce(arquivada_em, now()) end,
         ligada = case when p_arquivar then false else ligada end,
         ligada_em = case when p_arquivar then null else ligada_em end,
         atualizada_em = now()
   where id = p_id;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto)
  values (v_eu, case when p_arquivar then 'automacao_arquivada' else 'automacao_reativada' end,
          jsonb_build_object('automacao_id', p_id, 'automacao', v_auto.nome));
  perform plt_privado.fn_automacoes_relogio_ajustar();
end;
$$;

create or replace function public.plt_fn_automacao_execucoes(
  p_automacao_id bigint, p_limite integer default 20, p_deslocamento integer default 0)
returns table (
  id bigint, gatilho text, situacao text, avaliacao text, resultado jsonb, profundidade integer,
  card_id bigint, card_tipo text, card_arquivado boolean, produto text, unidade text,
  pedido_numero bigint, setor text, etapa text, contexto jsonb, executar_em timestamptz,
  criada_em timestamptz, atualizada_em timestamptz, contagem_total bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if plt_privado.fn_usuario_atual() is null or not plt_privado.fn_eh_super_admin() then
    raise exception 'As automações são só do super admin.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select x.id, x.gatilho, x.situacao, x.avaliacao, x.resultado, x.profundidade,
         x.card_id, c.tipo, c.arquivado_em is not null, c.item_descricao,
         case when c.tipo = 'unidade' then c.indice_unidade || '/' || c.total_unidades end,
         p.numero::bigint, s.nome, e.nome, x.contexto, x.executar_em,
         x.criada_em, x.atualizada_em, count(*) over ()
    from public.plt_automacao_execucoes x
    left join public.plt_cards c on c.id = x.card_id
    left join public.pedidos p on p.id = coalesce(x.pedido_id, c.pedido_id)
    left join public.plt_setores s on s.id = c.setor_atual_id
    left join public.plt_etapas e on e.id = c.etapa_atual_id
   where x.automacao_id = p_automacao_id
   order by x.id desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_deslocamento, 0), 0);
end;
$$;

-- 14.5 · A CHAMADA DE FORA (n8n/API): só a Edge Function `api` (chave de
--       escrita conferida lá) chama, com a chave de serviço.
create or replace function public.plt_fn_automacao_chamada(
  p_automacao_id bigint, p_card_id bigint default null, p_pedido_numero bigint default null,
  p_dados jsonb default '{}'::jsonb, p_quem text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auto   public.plt_automacoes%rowtype;
  v_card   bigint := p_card_id;
  v_pedido bigint;
  v_n      integer;
  v_exec   public.plt_automacao_execucoes%rowtype;
begin
  select * into v_auto from public.plt_automacoes where id = p_automacao_id;
  if not found or v_auto.gatilho <> 'chamada_externa' then
    raise exception 'Automação de chamada de fora não encontrada.' using errcode = 'no_data_found';
  end if;
  if not (v_auto.ligada and v_auto.arquivada_em is null) then
    raise exception 'A automação "%" está desligada.', v_auto.nome using errcode = 'check_violation';
  end if;
  if p_pedido_numero is not null then
    select p.id into v_pedido from public.pedidos p where p.numero = p_pedido_numero order by p.id desc limit 1;
    if v_pedido is null then
      raise exception 'Pedido % não encontrado.', p_pedido_numero using errcode = 'no_data_found';
    end if;
    if v_card is null then
      select c.id into v_card from public.plt_cards c where c.pedido_id = v_pedido and c.tipo = 'pedido';
    end if;
  end if;
  if v_card is not null and not exists (select 1 from public.plt_cards where id = v_card) then
    raise exception 'Card % não encontrado.', v_card using errcode = 'no_data_found';
  end if;
  if v_card is not null and v_pedido is null then
    select c.pedido_id into v_pedido from public.plt_cards c where c.id = v_card;
  end if;
  v_n := plt_privado.fn_automacoes_disparar('chamada_externa', v_card, v_pedido, null,
           coalesce(p_dados, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('quem', p_quem)), 0, p_automacao_id);
  select * into v_exec from public.plt_automacao_execucoes
   where automacao_id = p_automacao_id order by id desc limit 1;
  return jsonb_build_object('execucao_id', v_exec.id, 'situacao', v_exec.situacao, 'resultado', v_exec.resultado);
end;
$$;

revoke all on function public.plt_fn_automacao_chamada(bigint, bigint, bigint, jsonb, text) from public, anon, authenticated;
grant execute on function public.plt_fn_automacao_chamada(bigint, bigint, bigint, jsonb, text) to service_role;

-- Grants das portas (logado entra; o gate decide por dentro)
revoke all on function public.plt_fn_etiqueta_salvar(bigint, text, text)                 from public, anon;
revoke all on function public.plt_fn_etiqueta_arquivar(bigint, boolean)                  from public, anon;
revoke all on function public.plt_fn_etiqueta_excluir(bigint)                            from public, anon;
revoke all on function public.plt_fn_campo_salvar(bigint, text, text, text[], boolean, boolean) from public, anon;
revoke all on function public.plt_fn_campo_arquivar(bigint, boolean)                     from public, anon;
revoke all on function public.plt_fn_campo_excluir(bigint)                               from public, anon;
revoke all on function public.plt_fn_campo_definir(bigint, bigint, bigint, jsonb)        from public, anon;
revoke all on function public.plt_fn_desarquivar_card(bigint, text)                      from public, anon;
revoke all on function public.plt_fn_automacoes(integer, integer, boolean)               from public, anon;
revoke all on function public.plt_fn_automacao(bigint)                                   from public, anon;
revoke all on function public.plt_fn_automacao_salvar(bigint, text, text, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.plt_fn_automacao_ligar(bigint, boolean)                    from public, anon;
revoke all on function public.plt_fn_automacao_arquivar(bigint, boolean)                 from public, anon;
revoke all on function public.plt_fn_automacao_execucoes(bigint, integer, integer)       from public, anon;
grant execute on function public.plt_fn_etiqueta_salvar(bigint, text, text)                 to authenticated;
grant execute on function public.plt_fn_etiqueta_arquivar(bigint, boolean)                  to authenticated;
grant execute on function public.plt_fn_etiqueta_excluir(bigint)                            to authenticated;
grant execute on function public.plt_fn_campo_salvar(bigint, text, text, text[], boolean, boolean) to authenticated;
grant execute on function public.plt_fn_campo_arquivar(bigint, boolean)                     to authenticated;
grant execute on function public.plt_fn_campo_excluir(bigint)                               to authenticated;
grant execute on function public.plt_fn_campo_definir(bigint, bigint, bigint, jsonb)        to authenticated;
grant execute on function public.plt_fn_desarquivar_card(bigint, text)                      to authenticated;
grant execute on function public.plt_fn_automacoes(integer, integer, boolean)               to authenticated;
grant execute on function public.plt_fn_automacao(bigint)                                   to authenticated;
grant execute on function public.plt_fn_automacao_salvar(bigint, text, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.plt_fn_automacao_ligar(bigint, boolean)                    to authenticated;
grant execute on function public.plt_fn_automacao_arquivar(bigint, boolean)                 to authenticated;
grant execute on function public.plt_fn_automacao_execucoes(bigint, integer, integer)       to authenticated;

-- ----------------------------------------------------------------------------
-- 15 · Exemplos de fábrica, DESLIGADOS (os da antiga SESSAO-17 que cabem)
-- ----------------------------------------------------------------------------
insert into public.plt_automacoes (nome, gatilho, gatilho_config, passos, desenho)
select 'Exemplo · parado há 3 dias avisa o líder', 'card_parado',
       jsonb_build_object('horas', 72),
       jsonb_build_array(jsonb_build_object(
         'tipo', 'avisar', 'destino', 'lideres',
         'titulo', 'Card parado há 3 dias',
         'mensagem', '{produto} ({pedido}) está parado em {setor} · {etapa} há mais de 3 dias.')),
       jsonb_build_object('nos', jsonb_build_array(
         jsonb_build_object('id', 'q', 'x', 80, 'y', 120),
         jsonb_build_object('id', 'p1', 'x', 400, 'y', 120)))
where not exists (select 1 from public.plt_automacoes where nome = 'Exemplo · parado há 3 dias avisa o líder');

insert into public.plt_automacoes (nome, gatilho, gatilho_config, passos, desenho)
select 'Exemplo · peça danificada avisa os admins', 'qualidade_marcada',
       jsonb_build_object('estados', jsonb_build_array('danificado')),
       jsonb_build_array(jsonb_build_object(
         'tipo', 'avisar', 'destino', 'admins',
         'titulo', 'Peça danificada',
         'mensagem', '{produto} ({pedido}) foi marcada como danificada em {setor}.')),
       jsonb_build_object('nos', jsonb_build_array(
         jsonb_build_object('id', 'q', 'x', 80, 'y', 120),
         jsonb_build_object('id', 'p1', 'x', 400, 'y', 120)))
where not exists (select 1 from public.plt_automacoes where nome = 'Exemplo · peça danificada avisa os admins');

-- ----------------------------------------------------------------------------
-- 16 · E-19: a migration mais nova do check valida TUDO
-- ----------------------------------------------------------------------------
alter table public.plt_eventos validate constraint plt_eventos_tipo_check;
