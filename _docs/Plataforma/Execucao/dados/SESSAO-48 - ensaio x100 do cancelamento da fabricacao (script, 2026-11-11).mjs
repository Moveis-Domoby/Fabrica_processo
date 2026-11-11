// SESSAO-48 · ensaio x100: as portas que a base mexe (PCP, quadro da LIMPEZA, busca, lista de pedidos, janela de liberar),
// o acerto das pecas paradas, o gesto e a limpeza da madrugada. Montado a partir do ensaio da SESSAO-47.
// Ensaio ×100 das portas que as migrations da SESSAO-41 mexem (Lei de desempenho
// §1/§7.2): o quadro do setor (a presença pela régua + a data que vale na ordem),
// o PCP, a Programação, "Já programadas", a Expedição, o calendário, a lista de
// Pedidos, as entregas do dia e as paradas. ANTES (migrations até a SESSAO-40) ×
// DEPOIS (as 5 da SESSAO-41) no MESMO banco. Copiado e adaptado do ensaio da 40.
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
const todas = (await readdir(path.join(R, 'supabase/migrations'))).filter((f) => f.endsWith('.sql')).sort()
const migs = todas.filter((f) => f < '20261111000000')
for (const f of migs) await bd.exec(await readFile(path.join(R, 'supabase/migrations', f), 'utf8'))
console.log(`  ${migs.length} migrations aplicadas (a última: ${migs[migs.length - 1]}) (${passou()})`)

const ADM = '00000000-0000-0000-0000-000000004091'
const OP = '00000000-0000-0000-0000-000000004092'
const setor = async (c) => (await bd.query(`select id::int as id from public.plt_setores where codigo = '${c}'`)).rows[0].id
const [PCP, LIMPEZA, MONTAGEM, FURACAO, ROTAS] = [await setor('pcp'), await setor('limpeza_embalagem'), await setor('montagem'), await setor('furacao'), await setor('rotas')]
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id, modulos) values
    ('Dono 41', 'dono41@x.com', '41419000091', 'dono.41x', 'admin', '${ADM}', array['fabrica']),
    ('Operador 41', 'op41@x.com', '41419000092', 'op.41x', 'operador', '${OP}', array['fabrica']);
  insert into public.plt_usuario_setores (usuario_id, setor_id) values
    ((select id from public.plt_usuarios where usuario = 'op.41x'), ${LIMPEZA});
  insert into public.plt_etapas (setor_id, nome, ordem, eh_fila)
  select s, e.nome, e.ordem, e.ordem = 10
    from unnest(array[${LIMPEZA}, ${MONTAGEM}, ${FURACAO}]) s,
         (values ('A FAZER', 10), ('FAZENDO', 20), ('CONFERIR', 30), ('EMBALANDO', 40), ('PARADO', 50), ('PRONTO', 60), ('EXTRA', 70)) e(nome, ordem);
`)
await bd.exec(`set session_replication_role = replica`) // a semeadura não dispara gatilho
const NOMES = `array['Estante Basic 5 nichos - Branca','Armário Aéreo 3 portas - Branco','Armário multiuso 2 portas com chave','Mesa/escrivaninha Close - 80 x 75 x 45','Sapateira Basic 7 nichos','Cômoda 4 gavetas - Off White','Rack Retrô 1 porta','Aparador Retrô - Freijó','Painel TV 1,80 - Preto','Balcão 3 portas - Branco','Cabideiro Teste','Penteadeira camarim','Nicho decorativo','Guarda-roupa 6 portas','Mesa de cabeceira','Escrivaninha Office','Estante Livreiro 4 prateleiras','Armário Baixo 2 portas','Painel Ripado','Closet modular']`
await bd.exec(`
  insert into public.clientes (nome, endereco, numero, bairro, cidade, uf, cep)
  select 'Cliente ' || g, 'Rua ' || g, (g % 900)::text, 'Bairro ' || (g % 50), 'Natal', 'RN', '59000-000' from generate_series(1, 5000) g;
  insert into public.pedidos (numero, situacao, origem, tiny_id, data_prevista, cliente_id, endereco_entrega)
  select g, case when g % 13 = 0 then 'Entregue' when g % 101 = 0 then 'Enviado' when g % 103 = 0 then 'Faturado' else 'Preparando envio' end, 'webhook', 900000000 + g, date '2026-11-01' + (g % 40),
         (select min(id) from public.clientes) + (g % 5000),
         case when g % 33 = 0 then jsonb_build_object('endereco', 'Avenida ' || g, 'numero', '', 'bairro', 'Nova Parnamirim', 'cidade', 'Parnamirim', 'uf', 'RN', 'cep', '59152-330') else '{}'::jsonb end
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
const n = (r) => `${(r.rows[0].q.colunas ?? []).reduce((s, c) => s + c.total, 0)} no quadro`
// a programação de 3 caminhões × 2 rotas por dia, nos próximos 5 dias (60 pedidos por dia — ×100 da rotina)
await bd.exec(`
  insert into public.plt_caminhoes (nome, placa) select 'Baú ' || g, 'TST' || (4100 + g) from generate_series(1, 3) g;
  insert into public.plt_programacoes (card_id, data_entrega, caminhao_id, rota, ordem)
  select c.id, current_date + (r.k % 5)::int, (select min(id) from public.plt_caminhoes) + (r.k % 3), 1 + (r.k % 2)::int, r.k::int
    from (select id, row_number() over (order by id) as k from public.plt_cards where tipo = 'pedido' and liberado_completo_em is not null) r
    join public.plt_cards c on c.id = r.id
   where r.k <= 300;
  analyze;
`)
const DIA = (await bd.query(`select current_date::text as d`)).rows[0].d
const CAM = (await bd.query(`select min(id)::int as id from public.plt_caminhoes`)).rows[0].id

// SESSAO-48 · o que estava parado nas colunas CANCELADO e NÃO ENCONTRADO da LIMPEZA E
// EMBALAGEM em 11/11 (53 peças) × 100 = 5.300: 3.000 de pedidos (o 13622 sozinho tinha 30),
// 1.900 de reposição / sem dono e 400 de pedidos cancelados no Tiny.
await bd.exec(`
  insert into public.plt_etapas (setor_id, nome, ordem, eh_fila) values
    (${LIMPEZA}, 'NÃO ENCONTRADO', 75, false), (${LIMPEZA}, 'CANCELADO', 80, false);
`)
const CANC = (await bd.query(`select id::int as id from public.plt_etapas where setor_id = ${LIMPEZA} and nome = 'CANCELADO'`)).rows[0].id
const NAOE = (await bd.query(`select id::int as id from public.plt_etapas where setor_id = ${LIMPEZA} and nome = 'NÃO ENCONTRADO'`)).rows[0].id
const FILA = (await bd.query(`select id::int as id from public.plt_etapas where setor_id = ${LIMPEZA} and eh_fila`)).rows[0].id
await bd.exec(`set session_replication_role = replica`)
await bd.exec(`
  update public.pedidos set situacao = 'Cancelado'
   where id in (select c.pedido_id from public.plt_cards c where c.tipo = 'pedido' and c.liberado_completo_em is not null
                 order by c.id desc limit ${Math.round(4 * X)});
  insert into public.plt_cards (tipo, pedido_id, card_pai_id, item_seq, indice_unidade, total_unidades, item_codigo, item_descricao,
                                setor_atual_id, etapa_atual_id, desde)
  select 'unidade', pc.pedido_id, pc.id, 1, 1, 1, 'SKU1', 'Estante Basic 7 nichos - Branca', ${LIMPEZA},
         case when g % 12 = 0 then ${NAOE} else ${CANC} end, now() - (g % 700) * interval '1 hour'
    from generate_series(1, ${Math.round(34 * X)}) g
    join (select c.id, c.pedido_id, row_number() over (order by c.id) as k
            from public.plt_cards c where c.tipo = 'pedido' and c.liberado_completo_em is not null) pc
      on pc.k = 1 + (g % ${Math.round(100 * X)});
  insert into public.plt_cards (tipo, produto_tiny_id, item_seq, indice_unidade, total_unidades, item_codigo, item_descricao,
                                setor_atual_id, etapa_atual_id, desde)
  select 'unidade', 7000000 + 1 + g % 200, 1, 1, 1, 'PX' || (1 + g % 200), (${NOMES})[1 + (1 + g % 200) % 20], ${LIMPEZA},
         case when g % 10 = 0 then ${NAOE} else ${CANC} end, now() - (g % 700) * interval '1 hour'
    from generate_series(1, ${Math.round(19 * X)}) g;
  insert into public.plt_eventos (card_id, tipo, origem, setor_destino_id, etapa_destino_id, ocorrido_em)
  select c.id, 'card_criado', 'api', c.setor_atual_id, c.etapa_atual_id, c.desde
    from public.plt_cards c where c.etapa_atual_id in (${CANC}, ${NAOE});
`)
await bd.exec(`set session_replication_role = origin`)
await bd.exec(`select plt_privado.fn_estoque_numeros_recontar(); analyze;`)
const nasColunas = (await bd.query(`select count(*)::int as n from public.plt_cards where etapa_atual_id in (${CANC}, ${NAOE}) and arquivado_em is null`)).rows[0].n
console.log(`  peças paradas nas colunas CANCELADO/NÃO ENCONTRADO: ${nasColunas.toLocaleString('pt-BR')} (${passou()})`)

async function medir(fase) {
  await como(ADM)
  console.log(`\n== ${fase} ==`)
  await t('PCP "aguardando liberação" (10)', `select * from public.plt_fn_pcp_quadro(10, 0, 'pedido', null, null)`, 8, (r) => `${r.rows[0]?.contagem_total ?? 0} no quadro`)
  await t('PCP aba Stand-by (10)', `select * from public.plt_fn_pcp_quadro(10, 0, 'standby', null, null)`, 8, (r) => `${r.rows.length} linhas`)
  await t('PCP porta antiga (10)', `select * from public.plt_fn_cards_pedido_pcp(10, 0)`, 8, (r) => `${r.rows.length} linhas`)
  await t('quadrinho do PCP na Visão do dia', `select * from public.plt_fn_dash_pcp_dia()`, 8, (r) => `${r.rows[0]?.pedidos_a_liberar ?? '—'} a liberar`)
  await t('quadro da LIMPEZA E EMBALAGEM (10 por coluna)', `select public.plt_fn_quadro_setor(${LIMPEZA}, 10) as q`, 8,
    (r) => `${(r.rows[0].q.colunas ?? []).reduce((s, c) => s + c.total, 0)} no quadro · CANCELADO ${r.rows[0].q.colunas.find((c) => c.etapa_id === CANC)?.total} · NÃO ENCONTRADO ${r.rows[0].q.colunas.find((c) => c.etapa_id === NAOE)?.total}`)
  await t('"Ver mais" na coluna CANCELADO (10)', `select public.plt_fn_quadro_coluna(${LIMPEZA}, ${CANC}, null, null, 10) as c`, 8)
  await t('busca geral pelo nome ("Estante Basic 7", 20)', `select public.plt_fn_busca_cards('Estante Basic 7', null, 20) as b`, 8,
    (r) => `${r.rows[0].b.itens.length} itens`)
  await t('lista de Pedidos (20)', `select * from public.plt_fn_pedidos_lista(null, null, 20, false)`, 8, (r) => `${r.rows.length} linhas`)
  await t('a janela de liberar (sugestões de peça em produção)', `select public.plt_fn_pcp_liberacao((select min(id) from public.plt_cards where tipo = 'pedido' and liberado_completo_em is null)) as j`, 8)
}

const NOVAS = ['20261111010000_plt_sessao48_base.sql']
const ACERTO = await readFile(path.join(R, 'supabase/manutencao/2026-11-11_cancelado_vira_gesto.sql'), 'utf8')

await medir('ANTES (até a SESSAO-47)')
for (const f of NOVAS) await bd.exec(await readFile(path.join(R, 'supabase/migrations', f), 'utf8'))
await bd.exec('analyze')
const ligadas = (await bd.query(`select string_agg(nome || ' → ' || cancela_motivo, ', ' order by nome) as s from public.plt_etapas where cancela_fabricacao`)).rows[0].s
console.log(`\n  a base da SESSAO-48 aplicada; o sinal ligou sozinho em: ${ligadas}`)
await medir('DEPOIS (a base), antes do acerto')

{
  const a = performance.now()
  await bd.exec(`select set_config('plt.acerto_s48', 'aplicar', false)`)
  await bd.exec(ACERTO)
  await bd.exec(`select set_config('plt.acerto_s48', '', false)`)
  linha(`ACERTO: as ${nasColunas.toLocaleString('pt-BR')} peças paradas pelo gesto (uma transação)`, [performance.now() - a])
}
await bd.exec('analyze')
await medir('DEPOIS do acerto (todas canceladas hoje — a coluna mostra todas)')

// o gesto, um a um: soltar 5 peças vivas no CANCELADO e trazer de volta
await como(ADM)
{
  const vivas = (await bd.query(`select id::int as id from public.plt_cards where setor_atual_id = ${LIMPEZA} and etapa_atual_id = ${FILA}
                                   and arquivado_em is null and tipo = 'unidade' and pedido_id is not null order by id limit 5`)).rows
  const v = []
  for (const c of vivas) { const a = performance.now(); await bd.query(`select public.plt_fn_soltar_card(${c.id}, ${CANC})`); v.push(performance.now() - a) }
  linha('GESTO: soltar uma peça de pedido no CANCELADO (5 peças)', v)
  const w = []
  for (const c of vivas) { const a = performance.now(); await bd.query(`select public.plt_fn_soltar_card(${c.id}, ${FILA})`); w.push(performance.now() - a) }
  linha('GESTO: arrastar de volta para a fila (5 peças — a vaga ainda aberta)', w)
}

// a limpeza da madrugada: metade passou do prazo
await bd.exec(`update public.plt_cards set cancelada_em = now() - interval '9 days'
                where cancelada_em is not null and arquivado_em is null and id % 2 = 0`)
await bd.exec('analyze')
{
  const a = performance.now()
  const n = (await bd.query(`select plt_privado.fn_cancelados_arquivar() as n`)).rows[0].n
  linha(`LIMPEZA DA MADRUGADA: arquivar as que passaram do prazo (${n.toLocaleString('pt-BR')} peças)`, [performance.now() - a])
  const b = performance.now()
  const m = (await bd.query(`select plt_privado.fn_cancelados_arquivar() as n`)).rows[0].n
  linha(`LIMPEZA DA MADRUGADA rodando de novo (nada a fazer: ${m})`, [performance.now() - b])
}
await bd.exec('analyze')
await medir('DEPOIS da limpeza (metade arquivada)')

await como(ADM)
await plano('a coluna CANCELADO (a página de 10)', `select plt_privado.fn_quadro_pagina(${LIMPEZA}, ${CANC}, null, null, 10, null, null)`)
await plano('o total da coluna CANCELADO', `select plt_privado.fn_quadro_total(${LIMPEZA}, ${CANC}, null)`)
await plano('a limpeza (o que passou do prazo)', `select c.id from public.plt_cards c join public.plt_etapas e on e.id = c.etapa_atual_id and e.cancela_fabricacao
  where c.cancelada_em is not null and c.arquivado_em is null and c.tipo = 'unidade' and c.cancelada_em < now() - make_interval(days => e.cancela_dias::int)`)
await bd.close()
console.log(`\nfim (${passou()})`)
process.exit(0)
