// Ensaio ×100 das portas que a migration da SESSAO-40 cria ou mexe (Lei de
// desempenho §1/§7.2): o quadro do setor e o "Ver mais" com o filtro, o quadro
// do PCP com o filtro, a busca geral (número e nome, 1ª página e cursor, como
// admin e como operador) e o lançamento da reposição. Antes × depois no MESMO
// banco quando há "antes" (o quadro sem filtro = a porta de antes).
// Banco PGlite GRAVADO EM DISCO — os números são o teto, não a média de produção.
// Volume: produção de 23/10 × 100 — pedidos 5.627 → 562.700; cards 777 → 77.700
// (vivos na LIMPEZA E EMBALAGEM 63 → 6.300; arquivados 455 → 45.500); eventos 1.862 → 186.200.
// Uso: node ensaio40.mjs <raiz do repositório> <pasta do banco>
import { readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [R, PASTA] = process.argv.slice(2)
const { PGlite } = await import(pathToFileURL(path.join(R, 'node_modules/@electric-sql/pglite/dist/index.js')).href)
const { pg_trgm } = await import(pathToFileURL(path.join(R, 'node_modules/@electric-sql/pglite/dist/contrib/pg_trgm.js')).href)
const X = Number(process.env.ESCALA ?? 100)
const N = {
  pedidos: Math.round(5627 * X),
  vivosLimpeza: Math.round(63 * X),
  vivosMontagem: Math.round(41 * X),
  vivosOutros: Math.round(100 * X),
  arquivados: Math.round(455 * X),
  pcp: Math.round(37 * X),
  reposicoes: Math.round(22 * X),
  avulsos: Math.round(14 * X),
  eventosExtra: Math.round(1400 * X),
}
await rm(PASTA, { recursive: true, force: true })
const bd = new PGlite(PASTA, { extensions: { pg_trgm } })

const med = (v) => { const s = [...v].sort((a, b) => a - b); return [s[Math.floor(s.length / 2)], s[s.length - 1]] }
const linha = (rotulo, v, extra = '') => {
  const [m, x] = med(v)
  console.log(`  ${rotulo.padEnd(84)} mediana ${m.toFixed(1).padStart(8)} ms · máx ${x.toFixed(1).padStart(8)} ms${extra}`)
}
const t = async (rotulo, sql, vezes = 5, extrair = null) => {
  const v = []
  let r
  for (let i = 0; i < vezes; i++) { const a = performance.now(); r = await bd.query(sql); v.push(performance.now() - a) }
  linha(rotulo, v, extrair ? ` · ${extrair(r)}` : '')
  return r
}
const plano = async (rotulo, sql) => {
  const r = await bd.query(`explain (analyze, buffers, costs off, timing off, summary on) ${sql}`)
  console.log(`  --- plano: ${rotulo}`)
  for (const l of r.rows) console.log(`      ${l['QUERY PLAN']}`)
}

console.log(`== montando o banco em disco (×${X}: pedidos ${N.pedidos.toLocaleString('pt-BR')} · vivos na LIMPEZA ${N.vivosLimpeza.toLocaleString('pt-BR')} · arquivados ${N.arquivados.toLocaleString('pt-BR')}) ==`)
const a0 = performance.now()
const passou = () => `${((performance.now() - a0) / 1000).toFixed(0)} s`
await bd.exec(`
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;
  create schema if not exists auth;
  create schema if not exists extensions;
  create or replace function auth.uid() returns uuid
    language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema if not exists realtime;
  create table if not exists realtime.messages (id uuid primary key default gen_random_uuid(), topic text not null,
    extension text not null default 'broadcast', payload jsonb, event text, private boolean default true,
    inserted_at timestamp not null default now());
  create or replace function realtime.topic() returns text language sql stable as $$ select nullif(current_setting('realtime.topic', true), '')::text $$;
  create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
    returns void language plpgsql as $$ begin insert into realtime.messages (payload, event, topic, private) values (payload, event, topic, private); end $$;
`)
await bd.exec(await readFile(path.join(R, '_docs/Supabase-fabrica/supabase-fabrica-schema.sql'), 'utf8'))
const migs = (await readdir(path.join(R, 'supabase/migrations'))).filter((f) => f.endsWith('.sql')).sort()
for (const f of migs) await bd.exec(await readFile(path.join(R, 'supabase/migrations', f), 'utf8'))
console.log(`  ${migs.length} migrations aplicadas (a última: ${migs[migs.length - 1]}) (${passou()})`)

const ADM = '00000000-0000-0000-0000-000000004091'
const OP = '00000000-0000-0000-0000-000000004092'
const setor = async (c) => (await bd.query(`select id::int as id from public.plt_setores where codigo = '${c}'`)).rows[0].id
const [PCP, LIMPEZA, MONTAGEM, FURACAO, ROTAS] = [await setor('pcp'), await setor('limpeza_embalagem'), await setor('montagem'), await setor('furacao'), await setor('rotas')]
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id, modulos) values
    ('Dono 40', 'dono40@x.com', '40409000091', 'dono.40x', 'admin', '${ADM}', array['fabrica']),
    ('Operador 40', 'op40@x.com', '40409000092', 'op.40x', 'operador', '${OP}', array['fabrica']);
  insert into public.plt_usuario_setores (usuario_id, setor_id) values
    ((select id from public.plt_usuarios where usuario = 'op.40x'), ${LIMPEZA});
  insert into public.plt_etapas (setor_id, nome, ordem, eh_fila)
  select s, e.nome, e.ordem, e.ordem = 10
    from unnest(array[${LIMPEZA}, ${MONTAGEM}, ${FURACAO}]) s,
         (values ('A FAZER', 10), ('FAZENDO', 20), ('CONFERIR', 30), ('EMBALANDO', 40), ('PARADO', 50), ('PRONTO', 60), ('EXTRA', 70)) e(nome, ordem);
`)
await bd.exec(`set session_replication_role = replica`) // a semeadura não dispara gatilho
const NOMES = `array['Estante Basic 5 nichos - Branca','Armário Aéreo 3 portas - Branco','Armário multiuso 2 portas com chave','Mesa/escrivaninha Close - 80 x 75 x 45','Sapateira Basic 7 nichos','Cômoda 4 gavetas - Off White','Rack Retrô 1 porta','Aparador Retrô - Freijó','Painel TV 1,80 - Preto','Balcão 3 portas - Branco','Cabideiro Teste','Penteadeira camarim','Nicho decorativo','Guarda-roupa 6 portas','Mesa de cabeceira','Escrivaninha Office','Estante Livreiro 4 prateleiras','Armário Baixo 2 portas','Painel Ripado','Closet modular']`
await bd.exec(`
  insert into public.pedidos (numero, situacao, origem, tiny_id, data_prevista)
  select g, case when g % 13 = 0 then 'Entregue' else 'Preparando envio' end, 'webhook', 900000000 + g, date '2026-11-01' + (g % 40)
    from generate_series(1, ${N.pedidos}) g;
`)
console.log(`  pedidos ${N.pedidos.toLocaleString('pt-BR')} (${passou()})`)
// os pedidos com cards: a k-ésima trinca de peças vai para o pedido 1 + (k·7 mod N) — distintos
const pedidoDe = (expr) => `(1 + ((${expr}) * 7) % ${N.pedidos})`
const vivas = (inicio, n, setorId) => `
  insert into public.plt_cards (tipo, pedido_id, item_seq, indice_unidade, total_unidades, item_codigo, item_descricao,
                                setor_atual_id, etapa_atual_id, desde)
  select 'unidade', p.id, 1, 1 + (g % 3), 3, 'SKU' || (g % 20), (${NOMES})[1 + (g / 3) % 20],
         ${setorId}, (select e.id from public.plt_etapas e where e.setor_id = ${setorId} order by e.ordem offset (g % 7) limit 1),
         now() - (g % 500) * interval '1 hour'
    from generate_series(${inicio}, ${inicio + n - 1}) g
    join public.pedidos p on p.numero = ${pedidoDe('g / 3')};`
await bd.exec(vivas(0, N.vivosLimpeza, LIMPEZA))
await bd.exec(vivas(N.vivosLimpeza + 2, N.vivosMontagem, MONTAGEM))
await bd.exec(vivas(N.vivosLimpeza + N.vivosMontagem + 4, N.vivosOutros, FURACAO))
const ini = N.vivosLimpeza + N.vivosMontagem + N.vivosOutros + 6
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, indice_unidade, total_unidades, item_codigo, item_descricao,
                                setor_atual_id, desde, arquivado_em)
  select 'unidade', p.id, 1, 1 + (g % 3), 3, 'SKU' || (g % 20), (${NOMES})[1 + (g / 3) % 20],
         ${ROTAS}, now() - interval '30 days', now() - (g % 900) * interval '1 hour'
    from generate_series(${ini}, ${ini + N.arquivados - 1}) g
    join public.pedidos p on p.numero = ${pedidoDe('g / 3')};
  insert into public.plt_eventos (card_id, tipo, origem, dados)
  select c.id, 'card_arquivado', 'api', jsonb_build_object('motivo', 'entregue')
    from public.plt_cards c where c.arquivado_em is not null;
`)
console.log(`  peças vivas ${(N.vivosLimpeza + N.vivosMontagem + N.vivosOutros).toLocaleString('pt-BR')} e arquivadas ${N.arquivados.toLocaleString('pt-BR')} (${passou()})`)
// o card de cada pedido com peça (o pedido no PCP); os primeiros N.pcp ainda aguardando liberação
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, setor_atual_id, desde, liberado_completo_em)
  select 'pedido', x.pedido_id, ${PCP}, now() - interval '3 days', now() - interval '2 days'
    from (select distinct pedido_id from public.plt_cards where tipo = 'unidade') x;
  with escolhidos as (
    select p.id from public.pedidos p
     where not exists (select 1 from public.plt_cards c where c.pedido_id = p.id)
     order by p.numero desc limit ${N.pcp})
  insert into public.plt_cards (tipo, pedido_id, setor_atual_id, desde)
  select 'pedido', e.id, ${PCP}, now() - interval '1 day' from escolhidos e;
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
  select c.pedido_id, 1, 'SKU1', 'Estante Basic 5 nichos - Branca', 2
    from public.plt_cards c where c.tipo = 'pedido' and c.liberado_completo_em is null;
  insert into public.produtos (tiny_id, codigo, descricao, classe, situacao, unidade)
  select 7000000 + g, 'PX' || g, (${NOMES})[1 + g % 20], 'F', 'A', 'un' from generate_series(1, 200) g;
  insert into public.plt_cards (tipo, produto_tiny_id, item_codigo, item_descricao, total_unidades, setor_atual_id, desde, chave_criacao)
  select 'reposicao', 7000000 + 1 + g % 200, 'PX' || (1 + g % 200), (${NOMES})[1 + (1 + g % 200) % 20], 3, ${PCP}, now() - interval '5 hours', gen_random_uuid()
    from generate_series(1, ${N.reposicoes}) g;
  insert into public.plt_cards (tipo, titulo, setor_atual_id, desde)
  select 'avulso', 'Gabarito ' || (${NOMES})[1 + g % 20], ${LIMPEZA}, now() - interval '2 hours' from generate_series(1, ${N.avulsos}) g;
`)
await bd.exec(`set session_replication_role = origin; analyze;`)
const tam = (await bd.query(`select (select count(*) from public.plt_cards)::int as cards, (select count(*) from public.plt_eventos)::int as eventos,
  (select count(*) from public.plt_cards where setor_atual_id = ${LIMPEZA} and arquivado_em is null)::int as limpeza,
  (select count(*) from public.plt_cards where setor_atual_id = ${PCP} and tipo = 'pedido' and liberado_completo_em is null)::int as pcp`)).rows[0]
console.log(`  cards ${tam.cards.toLocaleString('pt-BR')} · eventos ${tam.eventos.toLocaleString('pt-BR')} · vivos na LIMPEZA ${tam.limpeza.toLocaleString('pt-BR')} · pedidos aguardando no PCP ${tam.pcp.toLocaleString('pt-BR')} (${passou()})`)

const como = (auth) => bd.exec(`select set_config('request.jwt.claim.sub', '${auth}', false)`)
const num = (await bd.query(`select p.numero from public.plt_cards c join public.pedidos p on p.id = c.pedido_id
                               where c.setor_atual_id = ${LIMPEZA} and c.arquivado_em is null order by p.numero desc limit 1`)).rows[0].numero
const prefixo = String(num).slice(0, 3)
const filaLimpeza = (await bd.query(`select id::int as id from public.plt_etapas where setor_id = ${LIMPEZA} and eh_fila`)).rows[0].id

console.log(`\n== o quadro do setor (LIMPEZA E EMBALAGEM, ${tam.limpeza.toLocaleString('pt-BR')} vivos) — sem filtro = a porta de antes ==`)
await como(ADM)
const n = (r) => `${(r.rows[0].q.colunas ?? []).reduce((s, c) => s + c.total, 0)} no quadro`
await t('quadro sem filtro (a porta de antes, 10 por coluna)', `select public.plt_fn_quadro_setor(${LIMPEZA}, 10, null, null) as q`, 5, n)
await t(`quadro filtrado pelo nº "${num}"`, `select public.plt_fn_quadro_setor(${LIMPEZA}, 10, null, '${num}') as q`, 5, n)
await t(`quadro filtrado pelo prefixo "${prefixo}"`, `select public.plt_fn_quadro_setor(${LIMPEZA}, 10, null, '${prefixo}') as q`, 5, n)
await t('quadro filtrado pelo nome "estante"', `select public.plt_fn_quadro_setor(${LIMPEZA}, 10, null, 'estante') as q`, 5, n)
await t('quadro filtrado pelo nome "armario aereo" (sem acento)', `select public.plt_fn_quadro_setor(${LIMPEZA}, 10, 'entrega', 'armario aereo') as q`, 5, n)
await t('quadro filtrado por "zz" (nada bate)', `select public.plt_fn_quadro_setor(${LIMPEZA}, 10, null, 'zz') as q`, 5, n)
const pag = (await bd.query(`select public.plt_fn_quadro_setor(${LIMPEZA}, 10, null, 'estante') as q`)).rows[0].q
const ultimo = pag.colunas.find((c) => c.etapa_id === filaLimpeza)?.cards.at(-1)?.id ?? 0
await t('"Ver mais" da fila sem filtro', `select public.plt_fn_quadro_coluna(${LIMPEZA}, ${filaLimpeza}, null, ${ultimo}, 10, null, null) as c`)
await t('"Ver mais" da fila com o filtro "estante"', `select public.plt_fn_quadro_coluna(${LIMPEZA}, ${filaLimpeza}, null, ${ultimo}, 10, null, 'estante') as c`)

console.log(`\n== o quadro do PCP (${tam.pcp.toLocaleString('pt-BR')} pedidos aguardando + ${N.reposicoes.toLocaleString('pt-BR')} reposições) ==`)
const nPcp = (r) => `${r.rows[0]?.contagem_total ?? 0} batem`
const pcpNum = (await bd.query(`select p.numero from public.plt_cards c join public.pedidos p on p.id = c.pedido_id
                                  where c.tipo = 'pedido' and c.liberado_completo_em is null order by p.numero limit 1`)).rows[0].numero
await t('PCP "aguardando liberação" sem filtro (a porta de antes)', `select * from public.plt_fn_pcp_quadro(10, 0, 'pedido', null, null)`, 5, nPcp)
await t(`PCP com o nº "${pcpNum}"`, `select * from public.plt_fn_pcp_quadro(10, 0, 'pedido', null, '${pcpNum}')`, 5, nPcp)
await t(`PCP com o prefixo "${String(pcpNum).slice(0, 3)}"`, `select * from public.plt_fn_pcp_quadro(10, 0, 'pedido', null, '${String(pcpNum).slice(0, 3)}')`, 5, nPcp)
await t('PCP reabastecimento com o nome "estante"', `select * from public.plt_fn_pcp_quadro(10, 0, 'reposicao', null, 'estante')`, 5, nPcp)

console.log('\n== a busca geral (todos os setores, vivos e arquivados) ==')
const nB = (r) => `${r.rows[0].b.itens.length} itens${r.rows[0].b.tem_mais ? ' + mais' : ''}`
await t(`busca o nº "${num}" (admin)`, `select public.plt_fn_busca_cards('${num}') as b`, 5, nB)
await t(`busca o prefixo "${prefixo}" (admin)`, `select public.plt_fn_busca_cards('${prefixo}') as b`, 5, nB)
await t('busca o prefixo "12" (admin — o pior número: 11 mil pedidos começam com 12)', `select public.plt_fn_busca_cards('12') as b`, 5, nB)
const pgN = (await bd.query(`select public.plt_fn_busca_cards('12') as b`)).rows[0].b
await t('busca "12" — a 2ª página (cursor)', `select public.plt_fn_busca_cards('12', ${pgN.itens.at(-1).id}) as b`, 5, nB)
await t('busca o nome "estante" (admin)', `select public.plt_fn_busca_cards('estante') as b`, 5, nB)
await t('busca o nome "armário aéreo" (admin)', `select public.plt_fn_busca_cards('armário aéreo') as b`, 5, nB)
await t('busca o nome "ar" (2 letras — recusado: o nome pede 3)', `select public.plt_fn_busca_cards('ar') as b`, 5, nB)
await t('busca o nome "arm" (3 letras — o mais largo)', `select public.plt_fn_busca_cards('arm') as b`, 5, nB)
await t('busca "zzz" (nada)', `select public.plt_fn_busca_cards('zzz') as b`, 5, nB)
const pg1 = (await bd.query(`select public.plt_fn_busca_cards('estante') as b`)).rows[0].b
await t('busca "estante" — a 2ª página (cursor)', `select public.plt_fn_busca_cards('estante', ${pg1.itens.at(-1).id}) as b`, 5, nB)
await como(OP)
await t('busca o nome "estante" (operador da LIMPEZA — só o setor dele)', `select public.plt_fn_busca_cards('estante') as b`, 5, nB)
await t(`busca o prefixo "${prefixo}" (operador)`, `select public.plt_fn_busca_cards('${prefixo}') as b`, 5, nB)

console.log('\n== o lançamento da reposição (gesto) ==')
await como(ADM)
const v = []
for (let i = 0; i < 5; i++) {
  await bd.exec('begin')
  const a = performance.now()
  await bd.query(`select public.plt_fn_estoque_lancar_reposicao(7000001, 2, gen_random_uuid())`)
  v.push(performance.now() - a)
  await bd.exec('rollback')
}
linha('lançar a reposição de um móvel que já tem outra aberta (com a chave)', v)

console.log('\n== os planos ==')
await como(ADM)
await plano(`a página filtrada pelo prefixo "${prefixo}"`, `select plt_privado.fn_quadro_pagina(${LIMPEZA}, ${filaLimpeza}, null, null, 10, null, plt_privado.fn_quadro_filtrados(${LIMPEZA}, '${prefixo}'))`)
await plano('o total filtrado pelo nome "estante"', `select plt_privado.fn_quadro_total(${LIMPEZA}, ${filaLimpeza}, plt_privado.fn_quadro_filtrados(${LIMPEZA}, 'estante'))`)
// o corpo da busca é plpgsql: o plano das duas leituras pesadas, como SQL puro
await plano(`os candidatos pelo número "${prefixo}" (faixas do índice do número)`, `
  select c.id from public.plt_cards c
   where c.pedido_id in (select p1.id from generate_series(0, 7) as k(e)
                          join public.pedidos p1 on p1.numero >= ${prefixo} * (10::bigint ^ k.e)::bigint
                                                and p1.numero < (${prefixo} + 1) * (10::bigint ^ k.e)::bigint)`)
await plano('os candidatos pelo nome "estante" (trigramas)', `
  select c.id from public.plt_cards c
   where c.nome_busca like '%estante%' order by c.arquivado_em is not null, c.id desc limit 21`)
await bd.close()
console.log(`\nfim (${passou()})`)
