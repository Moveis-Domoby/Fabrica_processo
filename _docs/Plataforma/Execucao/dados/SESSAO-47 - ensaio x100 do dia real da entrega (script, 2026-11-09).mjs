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
await bd.exec(`set timezone = 'America/Fortaleza'`)

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
const migs = todas.filter((f) => f < '20261109030000')
const novas = ['20261109030000_plt_entrega_dia_real.sql']
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
  select g, case when g % 13 = 0 then 'Entregue' else 'Preparando envio' end, 'webhook', 900000000 + g, date '2026-11-01' + (g % 40),
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

// ============================================================================
// SESSAO-47 · bloco B — o que o bloco lê: os pedidos ENTREGUES. No banco da SESSAO-41
// as peças arquivadas (45.500 = ×100) pertencem a ~15 mil pedidos; cada um deles ganha
// aqui o fato da entrega no card do pedido (na hora em que a última peça saiu — espalhado
// por 900 horas, ~400 entregas por dia = ×100 da rotina) e a rota em que saiu: 9 em 10
// programados para o próprio dia da entrega, 1 em 10 programado para o dia SEGUINTE
// (o "entregue fora do dia programado"). Semeado por junção, sem disparar gatilho.
//
// COMO SE MEDE (3ª rodada): a máquina estava ocupada por outro programa pesado, então o
// ANTES e o DEPOIS de cada porta de leitura são medidos ALTERNADOS, uma chamada de cada
// vez, no MESMO banco: as funções de ANTES são copiadas para o esquema `antes47` (o texto
// que o banco guarda, só com outro nome) antes de a migration do bloco B entrar. O que
// pesar na máquina pesa igual nas duas.
// ============================================================================
await bd.exec(`set session_replication_role = replica`)
await bd.exec(`
  with ent as (
    select pc.id as card_id, max(u.arquivado_em) as em
      from public.plt_cards pc
      join public.plt_cards u on u.pedido_id = pc.pedido_id and u.tipo = 'unidade'
     where pc.tipo = 'pedido' and pc.liberado_completo_em is not null
       and not exists (select 1 from public.plt_programacoes pr where pr.card_id = pc.id)
     group by pc.id
    having bool_and(u.arquivado_em is not null)
  )
  insert into public.plt_eventos (card_id, tipo, origem, usuario_id, ocorrido_em, registrado_em, dados)
  select e.card_id, 'pedido_entregue', 'interface', (select id from public.plt_usuarios where usuario = 'dono.41x'),
         e.em, e.em, '{}'::jsonb
    from ent e;
  update public.plt_cards pc
     set entrega_evento_id = ev.id, lancado_rotas_em = ev.ocorrido_em - interval '1 day'
    from public.plt_eventos ev
   where ev.tipo = 'pedido_entregue' and ev.card_id = pc.id;
  insert into public.plt_programacoes (card_id, data_entrega, caminhao_id, rota, ordem)
  select pc.id,
         (ev.ocorrido_em at time zone 'America/Fortaleza')::date + (case when pc.id % 10 = 0 then 1 else 0 end),
         (select min(id) from public.plt_caminhoes) + (pc.id % 3), 1 + (pc.id % 2)::int,
         1000 + (row_number() over (order by pc.id))::int
    from public.plt_cards pc
    join public.plt_eventos ev on ev.id = pc.entrega_evento_id;
`)
await bd.exec(`set session_replication_role = origin; analyze;`)
const semeado = (await bd.query(`
  select (select count(*) from public.plt_cards where entrega_evento_id is not null)::int as entregues,
         (select count(*) from public.plt_programacoes)::int as programacoes,
         (select count(*) from public.plt_eventos)::int as eventos,
         (select count(*) from public.plt_cards c join public.plt_eventos e on e.id = c.entrega_evento_id
           where e.ocorrido_em >= current_date - 1 and e.ocorrido_em < current_date)::int as ontem,
         current_date::text as hoje, (current_date - 1)::text as ontem_dia, (current_date - 2)::text as anteontem_dia`)).rows[0]
console.log(`  bloco B: pedidos entregues ${semeado.entregues.toLocaleString('pt-BR')} (ontem: ${semeado.ontem}) · programações ${semeado.programacoes.toLocaleString('pt-BR')} · eventos ${semeado.eventos.toLocaleString('pt-BR')} · hoje na fábrica ${semeado.hoje} (${passou()})`)
const HOJE = semeado.hoje
const ONTEM = semeado.ontem_dia
const ANTEONTEM = semeado.anteontem_dia
const PED_ENT = (await bd.query(`select pedido_id::int as p from public.plt_cards where entrega_evento_id is not null order by id limit 1`)).rows[0].p
const AGUARDO = await setor('aguardo')
// a rota mais cheia de ONTEM (a semeadura não enche todas as combinações de caminhão × rota)
const ROTA_ONTEM = (await bd.query(`select caminhao_id::int as cam, rota::int as rota, count(*)::int as n from public.plt_programacoes
                                     where data_entrega = date '${ONTEM}' group by 1, 2 order by 3 desc, 1, 2 limit 1`)).rows[0]
console.log(`  a rota de ONTEM medida: caminhão ${ROTA_ONTEM.cam}, rota ${ROTA_ONTEM.rota} (${ROTA_ONTEM.n} paradas programadas)`)

// as portas de leitura de ANTES, guardadas com outro nome para a medida alternada
const LEITURA = ['plt_fn_rotas', 'plt_fn_programadas', 'plt_fn_entregas_do_dia', 'plt_fn_rotas_calendario',
                 'plt_fn_pedidos_lista', 'plt_fn_pcp_pedido_detalhe', 'plt_fn_dash_motivos']
await bd.exec(`create schema if not exists antes47`)
for (const nome of LEITURA) {
  const defs = (await bd.query(`select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                 where n.nspname = 'public' and p.proname = '${nome}'`)).rows
  if (defs.length !== 1) throw new Error(`esperava uma ${nome}, achei ${defs.length}`)
  const copia = defs[0].def.replace(`FUNCTION public.${nome}(`, `FUNCTION antes47.${nome}(`)
  if (copia === defs[0].def) throw new Error(`não consegui renomear a cópia de ${nome}`)
  await bd.exec(copia)
}
console.log(`  as ${LEITURA.length} portas de leitura de ANTES copiadas para o esquema antes47 (${passou()})`)

const lista = (v) => v.map((x) => x.toFixed(0)).join(' · ')
// N chamadas seguidas NA MESMA conexão; a 1ª à parte, da 2ª em diante é o que conta
const m = async (rotulo, sql, vezes = 8, extrair = null) => {
  const v = []
  let r
  for (let i = 0; i < vezes; i++) { const a = performance.now(); r = await bd.query(sql); v.push(performance.now() - a) }
  const [med2, max2] = med(v.slice(1))
  console.log(`  ${rotulo.padEnd(62)} 1ª ${v[0].toFixed(1).padStart(8)} ms · da 2ª em diante: mediana ${med2.toFixed(1).padStart(8)} ms · máx ${max2.toFixed(1).padStart(8)} ms${extrair ? ' · ' + extrair(r) : ''}`)
  console.log(`      cada chamada (ms): ${lista(v)}`)
  return r
}
// ANTES × DEPOIS alternados: uma chamada da porta antiga, uma da nova, N vezes
const tabela = []
const ab = async (rotulo, sql, vezes = 7, extrair = null) => {
  const antigo = sql.replace(/public\.(plt_fn_[a-z_]+)\(/, 'antes47.$1(')
  if (antigo === sql) throw new Error('a porta não é das copiadas: ' + sql)
  const a = []
  const n = []
  let ra
  let rn
  for (let i = 0; i < vezes; i++) {
    let t = performance.now(); ra = await bd.query(antigo); a.push(performance.now() - t)
    t = performance.now(); rn = await bd.query(sql); n.push(performance.now() - t)
  }
  const ma = med(a.slice(1))[0]
  const mn = med(n.slice(1))[0]
  const dif = (mn / ma) * 100 - 100
  const igual = JSON.stringify(ra.rows) === JSON.stringify(rn.rows)
  tabela.push([rotulo, ma, mn, dif, igual])
  console.log(`  ${rotulo.padEnd(50)} antes ${ma.toFixed(1).padStart(8)} ms · depois ${mn.toFixed(1).padStart(8)} ms · ${(dif >= 0 ? '+' : '') + dif.toFixed(0)}% · resposta ${igual ? 'igual' : 'diferente'}${extrair ? ' · ' + extrair(rn) : ''}`)
  console.log(`      antes  (ms): ${lista(a)}`)
  console.log(`      depois (ms): ${lista(n)}`)
}
const entreguesNoCalendario = (r) => {
  const c = r.rows[0].c
  const soma = (k) => c.dias.reduce((s, d) => s + (d.contagem[k] ?? 0), 0)
  return `${c.dias.length} dias · entregue ${soma('entregue')} · na rota ${soma('na_rota')} · sem rota ${soma('sem_rota')}`
}
const SEMANA = `select public.plt_fn_rotas_calendario(date '${HOJE}' - 3, date '${HOJE}' + 3, 30, 0) as c`

// os pedidos dos GESTOS: nascem pelos gatilhos de verdade (card do pedido, peça pronta na
// Expedição), chegaram à plataforma há 6 dias e estão na rota de hoje
const gesto = async (rotulo, sqls) => {
  const v = []
  for (const s of sqls) { const a = performance.now(); await bd.query(s); v.push(performance.now() - a) }
  linha(rotulo, v, ` · cada: ${lista(v)}`)
}
async function pedidosDoGesto(numeros) {
  await bd.exec(`select set_config('request.jwt.claim.sub', '', false)`)
  await bd.exec(`insert into public.produtos (tiny_id, codigo, descricao, classe, situacao, unidade)
                   values (1947299, 'SX47B', 'Aparador Ensaio 47B', 'F', 'A', 'un') on conflict (tiny_id) do nothing`)
  const cards = []
  for (const numero of numeros) {
    await bd.exec(`
      insert into public.pedidos (numero, cliente_id, situacao, origem, tiny_id, data_prevista) values
        (${numero}, (select min(id) from public.clientes), 'Preparando envio', 'webhook', ${990000000 + numero}, date '${HOJE}');
      insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade) values
        ((select id from public.pedidos where numero = ${numero}), 1, 'SX47B', 'Aparador Ensaio 47B', 1);`)
    const r = (await bd.query(`select c.id::int as card, p.id::int as pedido from public.plt_cards c join public.pedidos p on p.id = c.pedido_id
                                where c.tipo = 'pedido' and p.numero = ${numero}`)).rows[0]
    await bd.exec(`
      update public.plt_cards set criado_em = now() - interval '6 days' where id = ${r.card};
      insert into public.plt_cards (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
        values ('unidade', ${r.pedido}, ${r.card}, 1, 'SX47B', 'Aparador Ensaio 47B', 1, 1);
      insert into public.plt_eventos (card_id, tipo, setor_destino_id, etapa_destino_id, origem)
        values ((select max(id) from public.plt_cards), 'card_criado', ${AGUARDO}, null, 'api');`)
    cards.push(r.card)
  }
  await como(ADM)
  await bd.query(`select public.plt_fn_programar_rota('${HOJE}', ${CAM}, array[${cards.join(', ')}]::bigint[], null, 1)`)
  return cards
}

// ---------------------------------------------------------------- ANTES: os gestos
await como(ADM)
console.log(`\n== ANTES (até a base da SESSAO-47) — os gestos ==`)
try {
  const antes = await pedidosDoGesto([900001, 900002, 900003, 900004, 900005])
  await gesto('GESTO (antes): registrar a entrega de hoje (5 pedidos)', antes.map((c) => `select public.plt_fn_registrar_entrega(${c}, null, false)`))
} catch (erro) {
  console.log(`  !! os gestos de ANTES não rodaram: ${erro.message}`)
}

// ---------------------------------------------------------------- a migration do bloco B
{
  const a = performance.now()
  for (const f of novas) await bd.exec(await readFile(path.join(R, 'supabase/migrations', f), 'utf8'))
  const ms = performance.now() - a
  const conf = (await bd.query(`select (select count(*) from public.plt_cards where entrega_evento_id is not null)::int as entregues,
                                       (select count(*) from public.plt_cards where entrega_em is not null)::int as com_dia,
                                       (select count(*) from public.plt_cards where entrega_evento_id is not null and entrega_em is null)::int as sem_dia`)).rows[0]
  console.log(`\n  a migration do bloco B (${novas.join(', ')}) aplicada em ${(ms / 1000).toFixed(1)} s — entregas vigentes ${conf.entregues.toLocaleString('pt-BR')}, com o dia projetado ${conf.com_dia.toLocaleString('pt-BR')}, sem o dia ${conf.sem_dia}`)
  const b = performance.now()
  for (const f of novas) await bd.exec(await readFile(path.join(R, 'supabase/migrations', f), 'utf8'))
  console.log(`  a mesma migration de novo (reaplicável): ${((performance.now() - b) / 1000).toFixed(1)} s`)
  await bd.exec('analyze')
}

// ---------------------------------------------------------------- ANTES × DEPOIS alternados
await como(ADM)
console.log(`\n== ANTES × DEPOIS, alternados na mesma conexão (mediana da 2ª chamada em diante) ==`)
await ab('ROTAS → Entregues (20)', `select * from public.plt_fn_rotas('entregue', null, 20, 0)`, 7, (r) => `${r.rows.length} linhas · total ${r.rows[0]?.contagem_total ?? 0}`)
await ab('ROTAS → A entregar (20)', `select * from public.plt_fn_rotas('pronta', null, 20, 0)`, 4, (r) => `${r.rows.length} linhas · total ${r.rows[0]?.contagem_total ?? 0}`)
await ab('Já programadas — entregues (50)', `select * from public.plt_fn_programadas(true, null, null, 50, 0)`, 5, (r) => `${r.rows.length} linhas · total ${r.rows[0]?.contagem_total ?? 0}`)
await ab('Já programadas — entregues de ONTEM (50)', `select * from public.plt_fn_programadas(true, '${ONTEM}', null, 50, 0)`, 7, (r) => `${r.rows.length} linhas · total ${r.rows[0]?.contagem_total ?? 0}`)
await ab('Já programadas — por entregar (50)', `select * from public.plt_fn_programadas(false, null, null, 50, 0)`, 5, (r) => `${r.rows.length} linhas · total ${r.rows[0]?.contagem_total ?? 0}`)
await ab('entregas do dia — HOJE (caminhão 1, rota 1)', `select public.plt_fn_entregas_do_dia('${HOJE}', ${CAM}, 1) as e`, 7, (r) => `${r.rows[0].e.entregas.length} paradas · de outro dia ${(r.rows[0].e.entregues_de_outro_dia ?? []).length}`)
await ab('entregas do dia — ONTEM (a rota mais cheia)', `select public.plt_fn_entregas_do_dia('${ONTEM}', ${ROTA_ONTEM.cam}, ${ROTA_ONTEM.rota}) as e`, 7, (r) => `${r.rows[0].e.entregas.length} paradas · de outro dia ${(r.rows[0].e.entregues_de_outro_dia ?? []).length}`)
// o calendário com o plano sob medida ligado NA CONEXÃO: compara só o que a consulta custa
// (a função de DEPOIS já carrega a configuração; a de ANTES, não — a queda dela está na 1ª rodada)
await bd.exec(`set plan_cache_mode = force_custom_plan`)
await ab('calendário da semana (plano sob medida nas duas)', SEMANA, 7, entreguesNoCalendario)
await bd.exec(`reset plan_cache_mode`)
await ab('Pedidos — a lista (20)', `select * from public.plt_fn_pedidos_lista(null, null, 20, false)`, 7, (r) => `${r.rows.length} linhas`)
await ab('Pedidos — a busca pelo número (20)', `select * from public.plt_fn_pedidos_lista('5627', null, 20, false)`, 7, (r) => `${r.rows.length} linhas`)
await ab('ficha de um pedido entregue', `select public.plt_fn_pcp_pedido_detalhe(${PED_ENT}) as f`, 7, (r) => `entrega em ${r.rows[0].f.entrega?.em ?? '—'}`)
await ab('painel de motivos (30 dias)', `select public.plt_fn_dash_motivos(date '${HOJE}' - 29, date '${HOJE}' + 1, null) as p`, 7, (r) => `entregas no período ${r.rows[0].p.rotas?.entregues ?? '—'}`)

// ---------------------------------------------------------------- DEPOIS: o calendário
console.log(`\n== DEPOIS — o calendário das rotas ==`)
await m('a semana, 8 seguidas (a função com o plano sob medida)', SEMANA, 8, entreguesNoCalendario)
await m('3 semanas (o modo mês)', `select public.plt_fn_rotas_calendario(date '${HOJE}' - 13, date '${HOJE}' + 7, 30, 0) as c`, 3, entreguesNoCalendario)
await m('6 semanas (o mês inteiro da tela)', `select public.plt_fn_rotas_calendario(date '${HOJE}' - 27, date '${HOJE}' + 14, 30, 0) as c`, 3, entreguesNoCalendario)
// e SEM a guarda (só neste banco de ensaio): o plano genérico da 6ª chamada ainda derruba a porta?
await bd.exec(`alter function public.plt_fn_rotas_calendario(date, date, integer, integer) reset plan_cache_mode`)
{
  // até 10 seguidas; se alguma passar de 15 s (o plano genérico ruim), para ali
  const v = []
  for (let i = 0; i < 10; i++) {
    const a = performance.now()
    await bd.query(SEMANA)
    v.push(performance.now() - a)
    if (v[v.length - 1] > 15000) break
  }
  const caiu = v[v.length - 1] > 15000
  console.log(`  a semana SEM a guarda (plano genérico liberado), ${v.length} seguidas: ${lista(v)} ms — ${caiu ? 'AINDA CAI no plano genérico' : 'não cai mais'}`)
  if (!caiu) {
    const w = []
    for (let i = 0; i < 3; i++) {
      const a = performance.now()
      await bd.query(`select public.plt_fn_rotas_calendario(date '${HOJE}' - 27, date '${HOJE}' + 14, 30, 0) as c`)
      w.push(performance.now() - a)
      if (w[w.length - 1] > 30000) break
    }
    console.log(`  6 semanas SEM a guarda, depois das 10 da semana: ${lista(w)} ms`)
  }
}
await bd.exec(`alter function public.plt_fn_rotas_calendario(date, date, integer, integer) set plan_cache_mode = force_custom_plan`)

// ---------------------------------------------------------------- DEPOIS: os gestos
console.log(`\n== DEPOIS — os gestos ==`)
try {
  const depois = await pedidosDoGesto([900011, 900012, 900013, 900014, 900015, 900016, 900017, 900018, 900019, 900020])
  const motivo = (await bd.query(`select id::int as id from public.plt_motivos where tipo = 'desfazer_entrega' and ativo order by id limit 1`)).rows[0]?.id ?? null
  await gesto('GESTO: registrar a entrega de hoje, como o site publicado (5 pedidos)', depois.slice(0, 5).map((c) => `select public.plt_fn_registrar_entrega(${c}, null, false)`))
  await gesto('GESTO: marcar como entregue ONTEM (5 pedidos)', depois.slice(5).map((c) => `select public.plt_fn_registrar_entrega(${c}, null, false, date '${ONTEM}')`))
  await gesto('GESTO: o administrador corrige o dia da entrega (5 pedidos)', depois.slice(5).map((c) => `select public.plt_fn_entrega_corrigir_dia(${c}, date '${ANTEONTEM}', 'ensaio')`))
  if (motivo === null) console.log('  !! sem motivo de desfazer cadastrado — o desfazer não foi medido')
  else await gesto('GESTO: desfazer a entrega registrada hoje (5 pedidos)', depois.slice(0, 5).map((c) => `select public.plt_fn_entrega_desfazer(${c}, ${motivo}, 'ensaio')`))
  const fim = (await bd.query(`select (select count(*) from public.plt_eventos where tipo = 'entrega_dia_corrigido')::int as correcoes,
                                      (select count(*) from public.plt_cards where entrega_evento_id is not null and entrega_em is null)::int as sem_dia`)).rows[0]
  console.log(`  depois dos gestos: ${fim.correcoes} correções de dia registradas · entregas vigentes sem o dia projetado: ${fim.sem_dia}`)
} catch (erro) {
  console.log(`  !! os gestos de DEPOIS pararam: ${erro.message}`)
}

// ---------------------------------------------------------------- a tabela e os planos
console.log(`\n== a tabela (ms, mediana da 2ª chamada em diante, alternadas) ==`)
for (const [rotulo, ma, mn, dif, igual] of tabela)
  console.log(`  | ${rotulo.padEnd(50)} | ${ma.toFixed(0).padStart(6)} | ${mn.toFixed(0).padStart(6)} | ${((dif >= 0 ? '+' : '') + dif.toFixed(0) + '%').padStart(6)} | ${igual ? 'igual' : 'muda '} |`)

await como(ADM)
await plano('o calendário — os entregues da semana pelo dia REAL (o índice do dia da entrega)', `
  select count(*) from public.plt_cards pc join public.plt_programacoes pr on pr.card_id = pc.id
   where pc.tipo = 'pedido'
     and pc.entrega_em >= (date '${HOJE}' - 3)::timestamp at time zone 'America/Fortaleza'
     and pc.entrega_em <  (date '${HOJE}' + 4)::timestamp at time zone 'America/Fortaleza'`)
await plano('as entregas do dia — o que foi entregue ONTEM e estava programado para outro dia', `
  select pc.id from public.plt_cards pc join public.plt_programacoes pr on pr.card_id = pc.id
   where pc.tipo = 'pedido'
     and pc.entrega_em >= (date '${ONTEM}')::timestamp at time zone 'America/Fortaleza'
     and pc.entrega_em <  (date '${HOJE}')::timestamp at time zone 'America/Fortaleza'
     and pr.data_entrega <> date '${ONTEM}'
   order by pc.entrega_em limit 100`)
await plano('o painel de motivos — as entregas do período (30 dias)', `
  select count(*) from public.plt_cards pc
   where pc.entrega_em >= (date '${HOJE}' - 29)::timestamp at time zone 'America/Fortaleza'
     and pc.entrega_em <  (date '${HOJE}' + 1)::timestamp at time zone 'America/Fortaleza'`)
await bd.close()
console.log(`\nfim (${passou()})`)
process.exit(0)
