// ENSAIO ×100 da SESSAO-55 (Lei §1/§7.2/§12) — as 9 portas de abertura novas.
//
// O que mede: para cada tela, ANTES (as leituras que a tela fazia, uma a uma — a soma)
// × DEPOIS (a porta nova, uma chamada), como o navegador chama (papel authenticated,
// com a pessoa no token). 8 chamadas seguidas de cada (A-205: o plano genérico da 6ª
// em diante aparece); a 1ª é fria e fica de fora da mediana (A-37). PGlite em memória:
// os números são TETO, não média (o banco real é mais rápido).
//
// O volume: o do ensaio da SESSAO-47 (o molde da casa, para os números conversarem com
// os da lei) — 300 pessoas, 300 mil cards, 300 mil passagens em 90 dias, 88,5 mil linhas
// do Trello — MAIS o que estas telas leem, ×100 do tamanho de hoje:
//   30 mil tarefas abertas (100 por pessoa) + 27 mil concluídas (90 dias) + 30 mil subtarefas; 30 mil cards delegados (100 por
//   pessoa); 300 execuções abertas; 3 mil visualizações salvas; 300 metas; 300 chaves de
//   API; 100 webhooks e 100 mil entregas; 300 caminhões; 4,2 mil horários; 5 mil pausas;
//   300 automações; 600 etapas.
//
// Uso (nenhum `cd`; só leitura do repositório; nada sai da máquina):
//   node "<este arquivo>" "<raiz do repositório>" > resultado.txt
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { readFile, readdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const RAIZ = process.argv[2]
if (!RAIZ) throw new Error('Diga a raiz do repositório.')
const MIGRATIONS = path.join(RAIZ, 'supabase/migrations')
const DADOS = path.join(RAIZ, '_docs/Plataforma/Execucao/dados')
const T = (ms) => `${ms.toFixed(1)} ms`
const t0 = Date.now()

const bd = new PGlite({ extensions: { pg_trgm } })
// o mesmo ambiente da bateria (papéis, auth.uid, realtime)
await bd.exec(`
  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end;
  $$;
  create schema if not exists auth;
  create schema if not exists extensions;
  create or replace function auth.uid() returns uuid
    language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema if not exists realtime;
  create table if not exists realtime.messages (
    id uuid primary key default gen_random_uuid(), topic text not null, extension text not null default 'broadcast',
    payload jsonb, event text, private boolean default true, inserted_at timestamp not null default now());
  alter table realtime.messages enable row level security;
  create or replace function realtime.topic() returns text
    language sql stable as $$ select nullif(current_setting('realtime.topic', true), '')::text $$;
  create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
    returns void language plpgsql as $$
  begin
    insert into realtime.messages (payload, event, topic, private) values (payload, event, topic, private);
  end $$;
  grant usage on schema realtime to authenticated;
  grant select on realtime.messages to authenticated;
`)
await bd.exec(await readFile(path.join(RAIZ, '_docs/Supabase-fabrica/supabase-fabrica-schema.sql'), 'utf8'))
for (const arquivo of (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort()) {
  await bd.exec(await readFile(path.join(MIGRATIONS, arquivo), 'utf8'))
}
// O que o Supabase dá ao papel authenticated por padrão e o PGlite não dá (o mesmo
// do bloco 78 da bateria): o esquema auth e a leitura das tabelas e visões de public —
// MENOS plt_usuarios, lida por coluna (E-50/D-68: valem os grants das migrations).
await bd.exec(`
  grant usage on schema public to authenticated;
  grant usage on schema auth to authenticated;
  grant execute on all functions in schema auth to authenticated;
  do $g$ declare t text; begin
    for t in select table_name from information_schema.tables
              where table_schema = 'public' and table_name <> 'plt_usuarios' loop
      execute format('grant select on public.%I to authenticated', t);
    end loop;
  end $g$;
`)
console.log('banco montado (todas as migrations) em', Date.now() - t0, 'ms')

// ---- o volume da casa (SESSAO-47) ----
const { semear } = await import(
  pathToFileURL(path.join(DADOS, 'SESSAO-47 - ensaio x100 da configuracao do painel de tempos (script, 2026-11-09).mjs')).href
)
const S = await semear(bd)

// ---- o que as telas da SESSAO-55 leem, ×100 ----
const um = async (sql) => (await bd.query(sql)).rows[0]
const t1 = Date.now()
await bd.exec(`
  set session_replication_role = replica;
  update public.plt_usuarios set super_admin = true where usuario = 'p.1';
  create temporary table gente as select id, auth_user_id, row_number() over (order by usuario) as n from public.plt_usuarios where usuario like 'p.%';
  -- cada pessoa em 2 setores
  insert into public.plt_usuario_setores (usuario_id, setor_id, lider_do_setor)
    select g.id, s.id, g.n % 30 = 0 from gente g
      join lateral (select id from public.plt_setores where papel_no_fluxo = 'producao' order by id offset (g.n % 5) limit 2) s on true
    on conflict do nothing;
  -- 100 tarefas abertas por pessoa (metade pessoal, metade delegada), 10% com o tempo contando; 1 concluída por dia
  insert into public.plt_tarefas (titulo, responsavel_id, criada_por_id, setor_id, privada, situacao, iniciada_em, criada_em)
    select 'Tarefa ' || g.n || '-' || k, g.id, case when k % 2 = 0 then g.id else (select id from gente where n = 1) end,
           case when k % 2 = 0 then null else ${S} end, k % 2 = 0,
           case when k % 10 = 0 then 'em_andamento' else 'aberta' end,
           case when k % 10 = 0 then now() - interval '20 minutes' end, now() - (k || ' hours')::interval
      from gente g, generate_series(1, 100) k;
  insert into public.plt_tarefas (titulo, responsavel_id, criada_por_id, situacao, iniciada_em, concluida_em, criada_em)
    select 'Feita ' || g.n || '-' || d, g.id, g.id, 'concluida', now() - (d || ' days')::interval - interval '1 hour',
           now() - (d || ' days')::interval, now() - (d || ' days')::interval - interval '2 hours'
      from gente g, generate_series(0, 89) d;
  -- 2 subtarefas em metade das tarefas abertas (30 mil), metade feita
  insert into public.plt_tarefas (titulo, criada_por_id, responsavel_id, tarefa_mae_id, situacao)
    select 'Sub ' || t.id || '-' || k, t.criada_por_id, t.responsavel_id, t.id, case when k = 1 then 'concluida' else 'aberta' end
      from public.plt_tarefas t, generate_series(1, 2) k
     where t.titulo like 'Tarefa %' and t.id % 10 < 5;
  -- as tarefas do Sistema (pendência de parecer) dos setores: 50 por setor
  insert into public.plt_tarefas (titulo, origem, setor_id)
    select 'Parecer ' || s.id || '-' || k, 'sistema', s.id from public.plt_setores s, generate_series(1, 50) k where s.papel_no_fluxo = 'producao';
  -- 100 cards delegados por pessoa (peças de pedido), 1 em execução por pessoa
  update public.plt_cards c set responsavel_id = g.id, delegado_em = now(), desde = now() - interval '2 hours'
    from (select id, row_number() over (order by id) as n from public.plt_cards where tipo = 'unidade' limit 30000) x
    join gente g on g.n = 1 + (x.n % 300)
   where c.id = x.id;
  update public.plt_cards c set executor_atual_id = c.responsavel_id
   where c.id in (select min(id) from public.plt_cards where responsavel_id is not null group by responsavel_id);
  insert into public.plt_eventos (card_id, tipo, origem, usuario_id, ocorrido_em)
    select c.id, 'execucao_iniciada', 'interface', c.executor_atual_id, now() - interval '40 minutes'
      from public.plt_cards c where c.executor_atual_id is not null;
  -- 10 visualizações por pessoa; 300 metas (1 por pessoa)
  insert into public.plt_visualizacoes (usuario_id, nome, configuracao)
    select g.id, 'Visão ' || k, jsonb_build_object('tela', 'pessoas', 'periodoDias', 30, 'setorId', ${S}, 'tempo', 'util') from gente g, generate_series(1, 10) k;
  insert into public.plt_metas (titulo, indicador, periodo, alvo, usuario_id, criada_por_id)
    select 'Meta ' || g.n, 'tarefas', 'semanal', 20, g.id, (select id from gente where n = 1) from gente g;
  -- API: 300 chaves, 100 webhooks, 100 mil entregas
  insert into public.plt_chaves_api (nome, hash, prefixo, escopo)
    select 'Chave ' || k, md5('h' || k), 'pltk_' || lpad(k::text, 4, '0'), 'leitura' from generate_series(1, 300) k;
  insert into public.plt_webhooks (nome, url, eventos) select 'Webhook X ' || k, 'https://exemplo.invalid/' || k, '{card_criado}' from generate_series(1, 100) k;
  insert into public.plt_webhook_entregas (webhook_id, evento_id, payload, tentativas, criada_em)
    select w.id, (select min(id) from public.plt_eventos), '{}'::jsonb, 1, now() - (k || ' minutes')::interval
      from (select id from public.plt_webhooks where nome like 'Webhook X %') w, generate_series(1, 1000) k;
  insert into public.plt_caminhoes (nome, placa, arquivado_em)
    select 'Caminhão ' || k, 'X' || lpad(k::text, 6, '0'), case when k % 3 = 0 then now() end from generate_series(1, 300) k;
  -- horários por pessoa (2 faixas × 7 dias × 300) e 5 mil pausas
  insert into public.plt_horarios_funcionamento (escopo, usuario_id, dia_semana, hora_inicio, hora_fim)
    select 'usuario', g.id, d, x.ini, x.fim from gente g, generate_series(0, 6) d,
           (values (time '07:30', time '12:00'), (time '13:00', time '18:00')) as x(ini, fim);
  insert into public.plt_pausas_tempo (escopo, setor_id, inicio, fim, retroativa, motivo, criado_por)
    select 'setor', ${S}, now() - (k || ' hours')::interval, now() - (k || ' hours')::interval + interval '30 minutes', true, 'pausa ' || k,
           (select id from gente where n = 1) from generate_series(1, 5000) k;
  -- 300 automações e 100 etapas a mais por setor
  insert into public.plt_automacoes (nome, gatilho) select 'Automação X ' || k, 'pedido_novo' from generate_series(1, 300) k;
  insert into public.plt_etapas (setor_id, nome, ordem, eh_fila)
    select s.id, 'Etapa X ' || k, 100 + k, false from public.plt_setores s, generate_series(1, 100) k where s.codigo like 'x%' or s.codigo = 'mx';
  set session_replication_role = origin;
  analyze;
`)
const vol = await um(`select (select count(*) from public.plt_usuarios)::int as pessoas, (select count(*) from public.plt_cards)::int as cards,
  (select count(*) from public.plt_cards where responsavel_id is not null)::int as delegados, (select count(*) from public.plt_tarefas)::int as tarefas,
  (select count(*) from public.plt_tarefas where tarefa_mae_id is not null)::int as subtarefas, (select count(*) from public.plt_eventos)::int as eventos,
  (select count(*) from public.plt_visualizacoes)::int as visualizacoes, (select count(*) from public.plt_metas)::int as metas,
  (select count(*) from public.plt_webhook_entregas)::int as entregas, (select count(*) from public.plt_caminhoes)::int as caminhoes,
  (select count(*) from public.plt_horarios_funcionamento)::int as horarios, (select count(*) from public.plt_pausas_tempo)::int as pausas,
  (select count(*) from public.plt_automacoes)::int as automacoes, (select count(*) from public.plt_etapas)::int as etapas`)
console.log('volume da SESSAO-55', JSON.stringify(vol), 'semeado em', Date.now() - t1, 'ms')

// ---- quem chama ----
const dono = (await um(`select auth_user_id from public.plt_usuarios where usuario = 'p.1'`)).auth_user_id
// o operador: quem tem cards delegados, tarefas e setores (uma pessoa comum)
const ope = await um(`select g.auth_user_id, g.id from gente g where g.n = 42`)
const lider = (await um(`select g.auth_user_id from gente g join public.plt_usuario_setores us on us.usuario_id = g.id where us.lider_do_setor order by g.n limit 1`)).auth_user_id

const mediana = (xs) => {
  const o = [...xs].sort((a, b) => a - b)
  return o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2
}
/** 8 chamadas seguidas como a pessoa (papel authenticated); devolve {fria, mediana, max} sem a 1ª. */
async function medir(auth, sqls) {
  const lista = Array.isArray(sqls) ? sqls : [sqls]
  await bd.exec(`select set_config('request.jwt.claim.sub', '${auth}', false)`)
  await bd.exec('set role authenticated')
  const tempos = []
  try {
    for (let i = 0; i < 8; i += 1) {
      const a = performance.now()
      for (const sql of lista) await bd.query(sql)
      tempos.push(performance.now() - a)
    }
  } finally {
    await bd.exec('reset role')
    await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
  }
  const quentes = tempos.slice(1)
  return { fria: tempos[0], mediana: mediana(quentes), max: Math.max(...quentes) }
}
async function plano(auth, rotulo, sql) {
  await bd.exec(`select set_config('request.jwt.claim.sub', '${auth}', false)`)
  await bd.exec('set role authenticated')
  try {
    const linhas = (await bd.query(`explain (analyze, buffers, costs off, timing off) ${sql}`)).rows.map((r) => r['QUERY PLAN'])
    console.log(`\n--- plano · ${rotulo} ---`)
    for (const l of linhas) console.log('  ' + l)
    const varreduras = linhas.filter((l) => /Seq Scan on (plt_cards|plt_eventos|plt_tarefas|plt_webhook_entregas|plt_tempo_\w+|plt_logs_atividade)\b/.test(l))
    console.log(varreduras.length ? `  !! varredura sequencial em tabela que cresce: ${varreduras.map((v) => v.trim()).join(' | ')}` : '  sem varredura sequencial em tabela que cresce')
  } finally {
    await bd.exec('reset role')
    await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}

const COLS_TAREFA = `tt.id, tt.titulo, tt.descricao, tt.card_id, tt.setor_id, tt.responsavel_id, tt.criada_por_id, tt.delegacao,
  tt.situacao, tt.prazo, tt.iniciada_em, tt.concluida_em, tt.criada_em, tt.tarefa_mae_id, tt.origem, tt.evento_referencia_id, tt.privada, tt.tempo_acumulado`
const COLS_CARD = `cc.id, cc.tipo, cc.pedido_id, cc.card_pai_id, cc.item_seq, cc.item_codigo, cc.item_descricao, cc.indice_unidade,
  cc.total_unidades, cc.setor_atual_id, cc.etapa_atual_id, cc.desde, cc.executor_atual_id, cc.responsavel_id, cc.delegado_em,
  cc.qualidade_atual, cc.concluido_em, cc.pausado_em, cc.liberado_completo_em, cc.produto_tiny_id, cc.etiquetas, cc.parecer_pendente_id`
const eu = `(select u.id from public.plt_usuarios u where u.auth_user_id = (select auth.uid()))`
// as leituras de ANTES (o que o navegador pedia, uma requisição cada)
const antes = {
  tarefas: `select ${COLS_TAREFA} from public.plt_tarefas tt where tt.responsavel_id = ${eu} and tt.situacao <> 'concluida' and tt.tarefa_mae_id is null order by tt.criada_em`,
  execucoes: `select * from public.plt_fn_minhas_execucoes()`,
  cards: `select ${COLS_CARD} from public.plt_cards cc where cc.responsavel_id = ${eu} and cc.concluido_em is null and cc.arquivado_em is null order by cc.desde`,
  sistema: `select ${COLS_TAREFA} from public.plt_tarefas tt where tt.origem = 'sistema' and tt.situacao <> 'concluida'
              and tt.setor_id in (select us.setor_id from public.plt_usuario_setores us where us.usuario_id = ${eu}) order by tt.criada_em`,
  fila: `select u.fila_prioridade from public.plt_usuarios u where u.id = ${eu}`,
  metas: (n) => `select * from public.plt_fn_metas_painel(false, ${n}, 0)`,
  subtarefas: `select ${COLS_TAREFA} from public.plt_tarefas tt where tt.tarefa_mae_id in
                 (select t.id from public.plt_tarefas t where t.responsavel_id = ${eu} and t.situacao <> 'concluida' and t.tarefa_mae_id is null) order by tt.criada_em`,
  pedidos: `select * from public.plt_fn_pedidos_kanban(null, false,
              (select array_agg(distinct c.pedido_id) from public.plt_cards c where c.responsavel_id = ${eu} and c.concluido_em is null and c.arquivado_em is null and c.pedido_id is not null), 100, 0)`,
  visualizacoes: `select id, nome, configuracao, padrao from public.plt_visualizacoes where usuario_id = ${eu} order by nome`,
}
const de = (dias) => `now() - interval '${dias} days'`

const telas = [
  ['Aviso do trabalho · fora das telas pessoais (a bolinha)', ope.auth_user_id, 50,
    [antes.tarefas, antes.execucoes], `select public.plt_fn_meu_trabalho('bolha')`],
  ['Aviso do trabalho · no Meu Painel', ope.auth_user_id, 50,
    [antes.tarefas, antes.execucoes, antes.cards, antes.sistema], `select public.plt_fn_meu_trabalho('painel', false)`],
  ['Meu Painel abrindo (com a fila e as metas)', ope.auth_user_id, 150,
    [antes.tarefas, antes.execucoes, antes.cards, antes.sistema, antes.fila, antes.metas(20)], `select public.plt_fn_meu_trabalho('painel', true)`],
  ['Meus afazeres', ope.auth_user_id, 50,
    [antes.tarefas, antes.execucoes, antes.cards, antes.subtarefas, antes.pedidos], `select public.plt_fn_meu_trabalho('afazeres')`],
  ['Dashboards → Pessoas (7 dias, o dono, com metas e visualizações)', dono, 150,
    [antes.visualizacoes, `select * from public.plt_fn_dash_tempos_pessoa(${de(7)}, now(), null)`, antes.metas(10),
     `select * from public.plt_fn_dash_execucoes(${de(7)}, now(), null, null, 20, 0)`],
    `select public.plt_fn_dash_pessoas_abertura(p_visualizacoes => true, p_metas => true)`],
  ['Dashboards → Pessoas (30 dias, o dono, só a tela)', dono, 150,
    [`select * from public.plt_fn_dash_tempos_pessoa(${de(30)}, now(), null)`, `select * from public.plt_fn_dash_execucoes(${de(30)}, now(), null, null, 20, 0)`],
    `select public.plt_fn_dash_pessoas_abertura(p_dias => 30)`],
  ['Dashboards → Pessoas (7 dias, o líder)', lider, 150,
    [`select * from public.plt_fn_dash_tempos_pessoa(${de(7)}, now(), null)`, `select * from public.plt_fn_dash_execucoes(${de(7)}, now(), null, null, 20, 0)`],
    `select public.plt_fn_dash_pessoas_abertura()`],
  ['Dashboards → Qualidade (7 dias, o dono)', dono, 150,
    [antes.visualizacoes, `select * from public.plt_fn_dash_qualidade(${de(7)}, now())`, `select * from public.plt_fn_dash_qualidade(${de(14)}, ${de(7)})`,
     `select * from public.plt_fn_dash_danificados_abertos()`],
    `select public.plt_fn_dash_qualidade_abertura(p_visualizacoes => true)`],
  ['Dashboards → Qualidade (30 dias, o dono)', dono, 150,
    [`select * from public.plt_fn_dash_qualidade(${de(30)}, now())`, `select * from public.plt_fn_dash_qualidade(${de(60)}, ${de(30)})`,
     `select * from public.plt_fn_dash_danificados_abertos()`],
    `select public.plt_fn_dash_qualidade_abertura(p_dias => 30)`],
  ['Dashboards → Meu desempenho (7 dias, o operador)', ope.auth_user_id, 150,
    [`select * from public.plt_fn_meu_desempenho(${de(7)}, now())`, `select * from public.plt_fn_meu_tempo_dias(${de(7)}, now())`,
     `select * from public.plt_fn_meu_tempo_tarefas(${de(7)}, now(), 10, 0)`],
    `select public.plt_fn_meu_desempenho_abertura(7, 10)`],
  ['Dashboards → Meu desempenho (90 dias, o operador)', ope.auth_user_id, 150,
    [`select * from public.plt_fn_meu_desempenho(${de(90)}, now())`, `select * from public.plt_fn_meu_tempo_dias(${de(90)}, now())`,
     `select * from public.plt_fn_meu_tempo_tarefas(${de(90)}, now(), 10, 0)`],
    `select public.plt_fn_meu_desempenho_abertura(90, 10)`],
  ['Configurações → Equipe (o dono)', dono, 50,
    [`select id, nome, usuario, email, telefone, matricula, papel, senha_padrao, ativo, arquivado_em, tema, foto_caminho, modulos, super_admin, conta_tablet, pode_auxiliar
        from public.plt_usuarios where conta_tablet = false order by nome`,
     `select us.usuario_id, us.setor_id, us.lider_do_setor, s.nome from public.plt_usuario_setores us left join public.plt_setores s on s.id = us.setor_id`],
    `select public.plt_fn_equipe_abertura()`],
  ['Configurações → API e integrações (o dono)', dono, 50,
    [`select id, nome, prefixo, escopo, criada_em, revogada_em, ultimo_uso_em from public.plt_chaves_api order by criada_em desc`,
     `select id, nome, url, eventos, ativo, criado_em from public.plt_webhooks order by criado_em desc`,
     `select id, webhook_id, situacao, tentativas, ultimo_erro, criada_em from public.plt_webhook_entregas order by criada_em desc limit 20`],
    `select public.plt_fn_api_abertura()`],
  ['Configurações → Caminhões (o dono)', dono, 50,
    [`select id, nome, placa, capacidade, foto_caminho, arquivado_em, criado_em from public.plt_caminhoes where arquivado_em is null order by nome`,
     `select public.plt_fn_tiny_entrega_situacao()`],
    `select public.plt_fn_caminhoes_abertura(false, true)`],
  ['Automações · a lista (o dono)', dono, 50,
    [`select * from public.plt_fn_automacoes(30, 0, false)`,
     `select id, setor_id, nome, ordem, eh_fila, eh_danificado, ativa, setor_destino_id, conclui_producao, pede_motivo, cancela_fabricacao, cancela_motivo, cancela_dias
        from public.plt_etapas where ativa order by setor_id, ordem`,
     `select id, nome from public.plt_usuarios where ativo and conta_tablet = false order by nome`],
    `select public.plt_fn_automacoes_abertura()`],
  ['Controle de tempo · Desligar o tempo (o dono)', dono, 50,
    [`select id, nome from public.plt_usuarios where conta_tablet = false`,
     `select id, escopo, setor_id, usuario_id, dia_semana, hora_inicio, hora_fim from public.plt_horarios_funcionamento order by escopo, dia_semana, hora_inicio`,
     `select id, escopo, setor_id, usuario_id, inicio, fim, retroativa, motivo, criado_por, criado_em from public.plt_pausas_tempo order by inicio desc limit 50`],
    `select public.plt_fn_tempo_desligar_abertura()`],
]

console.log('\n=== ANTES (a soma das leituras da tela) × DEPOIS (a porta nova) — 8 chamadas, sem a 1ª ===')
console.log('tela | leituras antes | antes: mediana (máx.) | depois: mediana (máx.) [1ª fria] | teto | dentro?')
const fora = []
const pesadas = []
for (const [nome, auth, teto, leituras, porta] of telas) {
  const a = await medir(auth, leituras)
  const d = await medir(auth, porta)
  const dentro = d.max <= teto
  if (!dentro) fora.push(`${nome}: máx. ${T(d.max)} (teto ${teto} ms)`)
  console.log(`${nome} | ${leituras.length} | ${T(a.mediana)} (${T(a.max)}) | ${T(d.mediana)} (${T(d.max)}) [${T(d.fria)}] | ${teto} ms | ${dentro ? 'sim' : 'NÃO'}`)
  // fora do teto: qual das leituras de sempre pesa (a porta só as junta — o caminho da dívida)
  if (!dentro) pesadas.push([nome, auth, leituras])
}
console.log(fora.length ? `\nFORA DO TETO:\n  ${fora.join('\n  ')}` : '\nTodas dentro do teto.')
console.log('\n=== as telas fora do teto, leitura por leitura (a mediana de cada leitura de antes) ===')
for (const [nome, auth, leituras] of pesadas) {
  console.log(nome)
  for (const sql of leituras) {
    const m = await medir(auth, sql)
    console.log(`  ${T(m.mediana).padStart(10)} (máx. ${T(m.max)}) · ${sql.replace(/\s+/g, ' ').slice(0, 150)}`)
  }
}

// o tamanho da resposta (Lei §1: ≤ 100 KB)
console.log('\n=== o tamanho de cada resposta ===')
for (const [nome, auth, , , porta] of telas) {
  await bd.exec(`select set_config('request.jwt.claim.sub', '${auth}', false)`)
  await bd.exec('set role authenticated')
  const r = await um(`select octet_length((${porta.replace(/^select /, '')})::text) as b`)
  await bd.exec('reset role')
  console.log(`${nome}: ${(r.b / 1024).toFixed(1)} KB`)
}
await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)

// ---- os planos das leituras que as portas novas fazem direto ----
await plano(ope.auth_user_id, 'a porta do trabalho, inteira (Meu Painel abrindo)', `select public.plt_fn_meu_trabalho('painel', true)`)
await plano(ope.auth_user_id, 'as tarefas abertas da pessoa', antes.tarefas)
await plano(ope.auth_user_id, 'os cards delegados à pessoa', antes.cards)
await plano(ope.auth_user_id, 'as tarefas do Sistema dos setores da pessoa', antes.sistema)
await plano(ope.auth_user_id, 'o contador de subtarefas (o "2/5")',
  `select st.tarefa_mae_id, count(*), count(*) filter (where st.situacao = 'concluida') from public.plt_tarefas st
    where st.tarefa_mae_id = any (array(select t.id from public.plt_tarefas t where t.responsavel_id = ${eu} and t.situacao <> 'concluida' and t.tarefa_mae_id is null))
    group by st.tarefa_mae_id`)
await plano(dono, 'as visualizações salvas de quem chama', antes.visualizacoes)
await plano(dono, 'Equipe · as pessoas', `select u.id, u.nome, u.papel from public.plt_usuarios u where u.conta_tablet = false`)
await plano(dono, 'Equipe · os vínculos', `select us.usuario_id, us.setor_id, us.lider_do_setor, s.nome from public.plt_usuario_setores us left join public.plt_setores s on s.id = us.setor_id`)
await plano(dono, 'API · as 20 últimas entregas',
  `select we.id, we.webhook_id, we.situacao, we.tentativas, we.ultimo_erro, we.criada_em from public.plt_webhook_entregas we order by we.criada_em desc, we.id desc limit 20`)
await plano(dono, 'Caminhões · a lista', `select c.id, c.nome from public.plt_caminhoes c where c.arquivado_em is null`)
await plano(dono, 'Automações · as etapas ativas', `select e.id, e.nome from public.plt_etapas e where e.ativa`)
await plano(dono, 'Desligar o tempo · as 50 últimas pausas',
  `select pt.id, pt.inicio from public.plt_pausas_tempo pt order by pt.inicio desc, pt.id desc limit 50`)
await plano(dono, 'Desligar o tempo · os horários', `select h.id from public.plt_horarios_funcionamento h`)

console.log('\nensaio inteiro em', Date.now() - t0, 'ms')
await bd.close()
