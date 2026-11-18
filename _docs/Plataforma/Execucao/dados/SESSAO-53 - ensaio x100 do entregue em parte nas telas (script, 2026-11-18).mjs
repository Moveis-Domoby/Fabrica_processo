// SESSAO-53 · ensaio ×100 (Lei de desempenho §1/§7.2/§12): "Entregue em parte" nas portas da
// Programação (Programar e Já programadas), da Expedição e das Entregas do dia. As 4 portas de
// ANTES são copiadas para o esquema `antes53` (o texto que o banco guarda, com outro nome) antes
// de a migration entrar, e cada uma é medida ANTES × DEPOIS, ALTERNADAS na mesma conexão (A-209):
// a 6ª chamada e a mediana da 2ª em diante (8 de cada), no caso que a tela ABRE (E-246).
// A semeadura é a do ensaio da SESSAO-50 · bloco C (produção de 23/10 × 100 — pedidos 562.700;
// cards ~95 mil; ~23 mil pedidos sem programação; 15 mil entregues com rota), + 600 pedidos
// entregues em parte com "deixar em produção" (×100 de 6 em aberto ao mesmo tempo — hoje há 1):
// metade nas rotas dos próximos dias, metade sem programação.
// Banco PGlite GRAVADO EM DISCO (pasta nova a cada montagem — E-267) — o teto, não a média.
// Uso: node <este arquivo> <raiz do repositório> <pasta NOVA do banco>   (ESCALA=1 primeiro — E-273)
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
  enderecos: Math.round(50 * X),
  paradas: Math.round(6 * X),
}
await rm(PASTA, { recursive: true, force: true })
const bd = new PGlite(PASTA, { extensions: { pg_trgm } })
await bd.exec(`set timezone = 'America/Fortaleza'`)

const med = (v) => { const s = [...v].sort((a, b) => a - b); return [s[Math.floor(s.length / 2)], s[s.length - 1]] }
const lista = (v) => v.map((x) => x.toFixed(0)).join(' · ')
const linha = (rotulo, v, extra = '') => {
  const [m, x] = med(v)
  console.log(`  ${rotulo.padEnd(84)} mediana ${m.toFixed(1).padStart(8)} ms · máx ${x.toFixed(1).padStart(8)} ms${extra}`)
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
const NOVA = '20261118110000_plt_entregue_em_parte_nas_telas.sql'
const migs = todas.filter((f) => f < NOVA)
for (const f of migs) await bd.exec(await readFile(path.join(R, 'supabase/migrations', f), 'utf8'))
console.log(`  ${migs.length} migrations aplicadas (a última: ${migs[migs.length - 1]}) (${passou()})`)

const ADM = '00000000-0000-0000-0000-000000004091'
const setor = async (c) => (await bd.query(`select id::int as id from public.plt_setores where codigo = '${c}'`)).rows[0].id
const [PCP, LIMPEZA, MONTAGEM, FURACAO, ROTAS] = [await setor('pcp'), await setor('limpeza_embalagem'), await setor('montagem'), await setor('furacao'), await setor('rotas')]
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id, modulos) values
    ('Dono 50', 'dono50@x.com', '50509000091', 'dono.50x', 'admin', '${ADM}', array['fabrica']);
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
// a programação de 3 caminhões × 2 rotas por dia, nos próximos 5 dias (60 pedidos por dia — ×100 da rotina)
await bd.exec(`
  insert into public.plt_caminhoes (nome, placa) select 'Baú ' || g, 'TST' || (5000 + g) from generate_series(1, 3) g;
  insert into public.plt_programacoes (card_id, data_entrega, caminhao_id, rota, ordem)
  select c.id, current_date + (r.k % 5)::int, (select min(id) from public.plt_caminhoes) + (r.k % 3), 1 + (r.k % 2)::int, r.k::int
    from (select id, row_number() over (order by id) as k from public.plt_cards where tipo = 'pedido' and liberado_completo_em is not null) r
    join public.plt_cards c on c.id = r.id
   where r.k <= 300;
`)
// os pedidos ENTREGUES com a rota em que saíram (o molde da 47): 15 mil — o "Entregues" e o calendário
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
  select e.card_id, 'pedido_entregue', 'interface', (select id from public.plt_usuarios where usuario = 'dono.50x'),
         e.em, e.em, '{}'::jsonb
    from ent e;
  update public.plt_cards pc
     set entrega_evento_id = ev.id, entrega_em = ev.ocorrido_em, lancado_rotas_em = ev.ocorrido_em - interval '1 day'
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
// as paradas avulsas: 600 nas rotas dos próximos 5 dias (6 por dia × 100) — 2 na rota de hoje que a tela abre
await bd.exec(`
  insert into public.plt_paradas_avulsas (data_entrega, caminhao_id, rota, ordem, titulo, endereco, latitude, longitude,
                                          observacao, situacao, criada_por)
  select current_date + (g % 5), (select min(id) from public.plt_caminhoes) + (g % 3), 1 + (g % 2), 2000 + g,
         'Buscar material ' || g, 'Av. Prudente de Morais, ' || g || ', Natal', -5.8 - (g % 50) / 1000.0, -35.2 - (g % 50) / 1000.0,
         case when g % 3 = 0 then 'falar com o balcão' end, case when g % 7 = 0 then 'feita' else 'pendente' end,
         (select id from public.plt_usuarios where usuario = 'dono.50x')
    from generate_series(1, ${N.paradas}) g;
`)
await bd.exec(`set session_replication_role = origin; analyze;`)
const tam = (await bd.query(`
  select (select count(*) from public.plt_cards)::int as cards, (select count(*) from public.plt_eventos)::int as eventos,
         (select count(*) from public.plt_programacoes)::int as programacoes,
         (select count(*) from public.plt_paradas_avulsas)::int as paradas,
         current_date::text as hoje`)).rows[0]
console.log(`  cards ${tam.cards.toLocaleString('pt-BR')} · eventos ${tam.eventos.toLocaleString('pt-BR')} · programações ${tam.programacoes.toLocaleString('pt-BR')} · paradas avulsas ${tam.paradas} · hoje ${tam.hoje} (${passou()})`)
const HOJE = tam.hoje
const CAM = (await bd.query(`select min(id)::int as id from public.plt_caminhoes`)).rows[0].id

// ---------------------------------------------------------------- as portas de ANTES (A-209)
const LEITURA = ['plt_fn_programacao_candidatos', 'plt_fn_programadas', 'plt_fn_expedicao', 'plt_fn_entregas_do_dia']
await bd.exec(`create schema if not exists antes53`)
for (const nome of LEITURA) {
  const defs = (await bd.query(`select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                 where n.nspname = 'public' and p.proname = '${nome}'`)).rows
  if (defs.length !== 1) throw new Error(`esperava uma ${nome}, achei ${defs.length}`)
  const copia = defs[0].def.replace(`FUNCTION public.${nome}(`, `FUNCTION antes53.${nome}(`)
  if (copia === defs[0].def) throw new Error(`não renomeei ${nome}`)
  await bd.exec(copia)
}
console.log(`  as ${LEITURA.length} portas de ANTES copiadas para antes53 (${passou()})`)

// ---------------------------------------------------------------- a migration da 53
{
  const a = performance.now()
  await bd.exec(await readFile(path.join(R, 'supabase/migrations', NOVA), 'utf8'))
  const ms = performance.now() - a
  const b = performance.now()
  await bd.exec(await readFile(path.join(R, 'supabase/migrations', NOVA), 'utf8'))
  console.log(`\n  a migration da 53 aplicada em ${(ms / 1000).toFixed(2)} s; de novo (reaplicável) em ${((performance.now() - b) / 1000).toFixed(2)} s`)
}
// os pedidos entregues em parte com "deixar em produção": metade nos programados por entregar
// (as rotas dos próximos dias — Já programadas, as entregas do dia), metade nos sem programação
// (a aba Programar e a Expedição). A projeção direto (a regra da entrega parcial é da SESSAO-51).
const PARCIAIS = Math.round(6 * X)
await bd.exec(`set session_replication_role = replica`)
await bd.exec(`
  create temp table s53 as
  select x.card_id, x.k
    from (
      select pc.id as card_id, row_number() over (order by (pr.card_id is null), pc.id) as k
        from public.plt_cards pc
        left join public.plt_programacoes pr on pr.card_id = pc.id and pr.data_entrega >= current_date
       where pc.tipo = 'pedido' and pc.entrega_evento_id is null and pc.arquivado_em is null
    ) x
   where x.k <= ${Math.round(PARCIAIS / 2)} or (x.k % 7 = 0 and x.k <= ${PARCIAIS * 40})
   limit ${PARCIAIS};
  insert into public.plt_eventos (card_id, tipo, origem, usuario_id, ocorrido_em, registrado_em, dados)
  select s.card_id, 'pedido_entregue', 'interface', (select id from public.plt_usuarios where usuario = 'dono.50x'),
         now() - interval '1 day', now() - interval '1 day',
         jsonb_build_object('parcial', true, 'fabrica', 'manter', 'total_pedido', 3, 'ensaio', 's53')
    from s53 s;
  update public.plt_cards pc
     set parcial_evento_id = ev.id, parcial_em = ev.ocorrido_em, parcial_entregues = 1, parcial_total = 3,
         parcial_decisao = 'manter', parcial_decisao_em = ev.ocorrido_em, parcial_decisao_evento_id = ev.id
    from public.plt_eventos ev
   where ev.card_id = pc.id and ev.tipo = 'pedido_entregue' and ev.dados ->> 'ensaio' = 's53';
`)
await bd.exec(`set session_replication_role = origin; analyze;`)
const nPar = (await bd.query(`
  select count(*)::int as n,
         count(*) filter (where exists (select 1 from public.plt_programacoes pr where pr.card_id = pc.id))::int as prog
    from public.plt_cards pc where pc.parcial_evento_id is not null`)).rows[0]
console.log(`  pedidos entregues em parte: ${nPar.n} (${nPar.prog} com rota, ${nPar.n - nPar.prog} sem programação) (${passou()})`)

// ---------------------------------------------------------------- ANTES × DEPOIS alternados
const como = (auth) => bd.exec(`select set_config('request.jwt.claim.sub', '${auth}', false)`)
await como(ADM)
const ab = async (rotulo, sql, vezes = 8, extrair = null) => {
  const antigo = sql.replace(/public\.(plt_fn_[a-z_]+)\(/, 'antes53.$1(')
  if (antigo === sql) throw new Error('a porta não é das copiadas: ' + sql)
  const a = []
  const n = []
  let rn
  for (let i = 0; i < vezes; i++) {
    let t = performance.now(); await bd.query(antigo); a.push(performance.now() - t)
    t = performance.now(); rn = await bd.query(sql); n.push(performance.now() - t)
  }
  const ma = med(a.slice(1))[0]
  const mn = med(n.slice(1))[0]
  const dif = (mn / ma) * 100 - 100
  console.log(`  ${rotulo.padEnd(56)} 6ª: antes ${a[5].toFixed(1).padStart(8)} · depois ${n[5].toFixed(1).padStart(8)} ms | mediana 2ª+: antes ${ma.toFixed(1).padStart(8)} · depois ${mn.toFixed(1).padStart(8)} ms · ${(dif >= 0 ? '+' : '') + dif.toFixed(0)}%${extrair ? ' · ' + extrair(rn) : ''}`)
  console.log(`      antes  (ms): ${lista(a)}`)
  console.log(`      depois (ms): ${lista(n)}`)
}
const comSeloJson = (itens) => `${itens.length} itens · ${itens.filter((i) => i.entregue_em_parte).length} com o selo · ${itens.filter((i) => i.entregue_em_parte?.ainda_producao > 0).length} com "ainda em produção"`
const comSeloLinhas = (r) => `${r.rows.length} linhas · ${r.rows.filter((l) => l.entregue_em_parte).length} com o selo`

console.log(`\n== ANTES × DEPOIS, alternados na mesma conexão (8 de cada; a 6ª e a mediana da 2ª em diante) ==`)
await ab('Programar — sem filtro (200, o que a aba abre)', `select public.plt_fn_programacao_candidatos(null, null, null, null, null, null, 200) as c`, 8, (r) => comSeloJson(r.rows[0].c.itens))
await ab('Já programadas — por entregar (50, a 1ª página)', `select * from public.plt_fn_programadas(false, null, null, 50, 0, null)`, 8, comSeloLinhas)
await ab('Já programadas — o dia e o caminhão (200, o mapa)', `select * from public.plt_fn_programadas(false, '${HOJE}', ${CAM}, 200, 0, null)`, 8, comSeloLinhas)
await ab('Já programadas — entregues (50)', `select * from public.plt_fn_programadas(true, null, null, 50, 0, null)`, 8, comSeloLinhas)
await ab('Expedição — todos (20, o que a tela abre)', `select public.plt_fn_expedicao('todos', null, 20, 0) as c`, 8, (r) => comSeloJson(r.rows[0].c.itens))
await ab('Expedição — com rota programada (20)', `select public.plt_fn_expedicao('com_rota', null, 20, 0) as c`, 8, (r) => comSeloJson(r.rows[0].c.itens))
await ab('Entregas do dia — HOJE (caminhão 1, rota 1)', `select public.plt_fn_entregas_do_dia('${HOJE}', ${CAM}, 1) as c`, 8, (r) => comSeloJson(r.rows[0].c.entregas))

// ---------------------------------------------------------------- a regra do selo, sozinha
console.log(`\n== a regra do selo (só o pedido entregue em parte paga) ==`)
const UM = (await bd.query(`select min(id)::int as id from public.plt_cards where parcial_evento_id is not null`)).rows[0].id
{
  const v = []
  for (let i = 0; i < 8; i++) { const t = performance.now(); await bd.query(`select selo from plt_privado.vw_entregue_em_parte where card_id = ${UM}`); v.push(performance.now() - t) }
  console.log(`  a regra para 1 pedido                                    6ª ${v[5].toFixed(2)} ms · mediana 2ª+ ${med(v.slice(1))[0].toFixed(2)} ms · cada: ${v.map((x) => x.toFixed(1)).join(' · ')}`)
  const t = performance.now()
  const r = await bd.query(`select count(selo)::int as n from plt_privado.vw_entregue_em_parte`)
  console.log(`  a regra para os ${r.rows[0].n} entregues em parte de uma vez       ${(performance.now() - t).toFixed(1)} ms no total`)
}
await plano('a regra do selo para 1 pedido (a visão, pela chave)', `select selo from plt_privado.vw_entregue_em_parte where card_id = ${UM}`)
await plano('Já programadas — por entregar (50) — DEPOIS', `select * from public.plt_fn_programadas(false, null, null, 50, 0, null)`)
await plano('Já programadas — por entregar (50) — ANTES', `select * from antes53.plt_fn_programadas(false, null, null, 50, 0, null)`)
await bd.close()
console.log(`\nfim (${passou()})`)
