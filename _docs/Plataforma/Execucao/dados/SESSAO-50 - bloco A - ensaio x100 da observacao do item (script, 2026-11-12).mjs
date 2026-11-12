// SESSAO-50 · bloco A · ensaio ×100 da observação do item do Tiny (Lei de Desempenho §1/§7.2/§12):
// a frente do card (quadro do setor, "Ver mais", janela do card) ANTES × DEPOIS INTERCALADOS na
// mesma conexão — a versão de antes recriada com outro nome (A-209), medindo também a 6ª chamada;
// o caso que a tela abre (o quadro da MONTAGEM, 10 por coluna — E-246) e o pior caso (TODOS os
// pedidos da MONTAGEM com observação); a gravação do Tiny com o gatilho novo (o gesto); e o
// preenchimento dos antigos (a manutenção) no volume ×100.
// Banco PGlite GRAVADO EM DISCO (pasta NOVA a cada montagem — E-267): os números são o teto.
// Volume (produção de 12/11 × 100): pedidos 5.900 → 590.000 (todos com raw e itens, como a
// gravação do Tiny deixa); peças vivas na MONTAGEM 50 → 5.000, noutros setores 160 → 16.000,
// arquivadas 455 → 45.500; observações em ~5,7% dos pedidos (376 itens em 325 pedidos × 100).
// Uso: node <este arquivo> <raiz da cópia> <pasta NOVA do banco>
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [R, PASTA] = process.argv.slice(2)
const { PGlite } = await import(pathToFileURL(path.join(R, 'node_modules/@electric-sql/pglite/dist/index.js')).href)
const { pg_trgm } = await import(pathToFileURL(path.join(R, 'node_modules/@electric-sql/pglite/dist/contrib/pg_trgm.js')).href)
const X = Number(process.env.ESCALA ?? 100)
const N = {
  pedidos: Math.round(5900 * X),
  vivosMontagem: Math.round(50 * X),
  vivosOutros: Math.round(160 * X),
  arquivados: Math.round(455 * X),
  pcp: Math.round(37 * X),
}
const MINHA = '20261112050000_plt_observacao_do_item.sql'
const bd = new PGlite(PASTA, { extensions: { pg_trgm } })

const med = (v) => { const s = [...v].sort((a, b) => a - b); return [s[Math.floor(s.length / 2)], s[s.length - 1]] }
const linha = (rotulo, v, extra = '') => {
  const [m, x] = med(v)
  console.log(`  ${rotulo.padEnd(78)} mediana ${m.toFixed(1).padStart(7)} ms · máx ${x.toFixed(1).padStart(7)} ms${extra}`)
}
const plano = async (rotulo, sql) => {
  const r = await bd.query(`explain (analyze, buffers, costs off, timing off, summary on) ${sql}`)
  console.log(`  --- plano: ${rotulo}`)
  for (const l of r.rows) console.log(`      ${l['QUERY PLAN']}`)
}
// ANTES × DEPOIS intercalados: 8 rodadas, cada uma chama as duas versões; a 6ª chamada de cada à parte
const comparar = async (rotulo, sqlAntes, sqlDepois, extrair = null) => {
  const a = []
  const d = []
  let ra
  let rd
  for (let i = 0; i < 8; i++) {
    let t = performance.now(); ra = await bd.query(sqlAntes); a.push(performance.now() - t)
    t = performance.now(); rd = await bd.query(sqlDepois); d.push(performance.now() - t)
  }
  linha(`${rotulo} · ANTES`, a, ` · 6ª ${a[5].toFixed(1)} ms${extrair ? ` · ${extrair(ra)}` : ''}`)
  linha(`${rotulo} · DEPOIS`, d, ` · 6ª ${d[5].toFixed(1)} ms${extrair ? ` · ${extrair(rd)}` : ''}`)
}

// a última definição de uma função nas migrations ANTES de `ate` (a vigente para ela)
async function ultima(nome, ate) {
  const arquivos = (await readdir(path.join(R, 'supabase/migrations'))).filter((f) => f.endsWith('.sql') && f < ate).sort()
  const re = new RegExp(String.raw`create\s+(or\s+replace\s+)?function\s+(plt_privado\.|public\.)?` + nome + String.raw`(?=\s*\()`, 'gi')
  let ultimo = null
  for (const arq of arquivos) {
    const texto = (await readFile(path.join(R, 'supabase/migrations', arq), 'utf8')).replace(/\r\n/g, '\n')
    re.lastIndex = 0
    let m
    while ((m = re.exec(texto))) {
      const ini = m.index
      const dl = texto.slice(ini).match(/\bas\s+(\$[A-Za-z_]*\$)/i)
      if (!dl) continue
      const abre = ini + dl.index + dl[0].length
      const fecha = texto.indexOf(dl[1], abre)
      const fim = texto.indexOf(';', fecha + dl[1].length)
      ultimo = texto.slice(ini, fim + 1)
    }
  }
  if (!ultimo) throw new Error(`não achei ${nome}`)
  return ultimo
}
const trocar = (t, de, para, vezes) => {
  const n = t.split(de).length - 1
  if (n !== vezes) throw new Error(`troca "${de}": ${n} vezes (esperado ${vezes})`)
  return t.split(de).join(para)
}

console.log(`== montando o banco em disco (×${X}: pedidos ${N.pedidos.toLocaleString('pt-BR')} · vivos na MONTAGEM ${N.vivosMontagem.toLocaleString('pt-BR')}) ==`)
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
const migs = todas.filter((f) => f <= MINHA)
for (const f of migs) await bd.exec(await readFile(path.join(R, 'supabase/migrations', f), 'utf8'))
console.log(`  ${migs.length} migrations aplicadas (a última: ${migs[migs.length - 1]}) (${passou()})`)

const ADM = '00000000-0000-0000-0000-000000005001'
const setor = async (c) => (await bd.query(`select id::int as id from public.plt_setores where codigo = '${c}'`)).rows[0].id
const [PCP, LIMPEZA, MONTAGEM, FURACAO, ROTAS] = [await setor('pcp'), await setor('limpeza_embalagem'), await setor('montagem'), await setor('furacao'), await setor('rotas')]
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id, modulos) values
    ('Dono 50A', 'dono50a@x.com', '50509000091', 'dono.50a', 'admin', '${ADM}', array['fabrica']);
  insert into public.plt_etapas (setor_id, nome, ordem, eh_fila)
  select s, e.nome, e.ordem, e.ordem = 10
    from unnest(array[${LIMPEZA}, ${MONTAGEM}, ${FURACAO}]) s,
         (values ('A FAZER', 10), ('FAZENDO', 20), ('CONFERIR', 30), ('EMBALANDO', 40), ('PARADO', 50), ('PRONTO', 60), ('EXTRA', 70)) e(nome, ordem);
`)
await bd.exec(`set session_replication_role = replica`) // a semeadura não dispara gatilho
const NOMES = `array['Estante Basic 5 nichos - Branca','Armário Aéreo 3 portas - Branco','Armário multiuso 2 portas com chave','Mesa/escrivaninha Close - 80 x 75 x 45','Sapateira Basic 7 nichos','Cômoda 4 gavetas - Off White','Rack Retrô 1 porta','Aparador Retrô - Freijó','Painel TV 1,80 - Preto','Balcão 3 portas - Branco','Cabideiro Teste','Penteadeira camarim','Nicho decorativo','Guarda-roupa 6 portas','Mesa de cabeceira','Escrivaninha Office','Estante Livreiro 4 prateleiras','Armário Baixo 2 portas','Painel Ripado','Closet modular']`
// as observações reais de 12/11 (a mediana 33, a maior 162)
const OBS = `array['adicionar rodízios ', 'COM RODINHAS', 'FECHADURA NA PRIMEIRA GAVETA',
  'Adicionar uma prateleira removível no vão superior',
  'Sob medida: 1,20 m de largura x 0,45 m de profundidade, cor freijó com branco neve, puxador cava, cliente não quer rodinhas e pediu a prateleira do meio removível']`
await bd.exec(`
  insert into public.produtos (tiny_id, codigo, descricao, classe, situacao, unidade)
  select 7000000 + k, 'PX' || k, (${NOMES})[1 + k % 20], 'F', 'A', 'un' from generate_series(1, 200) k;
  insert into public.clientes (nome, endereco, numero, bairro, cidade, uf, cep)
  select 'Cliente ' || g, 'Rua ' || g, (g % 900)::text, 'Bairro ' || (g % 50), 'Natal', 'RN', '59000-000' from generate_series(1, 5000) g;
`)
// o pedido como o Tiny manda (raw): 1 item (PX k, 3 unidades) e, em 1 de cada 5, um 2º item; ~5,7% com observação
await bd.exec(`
  insert into public.pedidos (numero, situacao, origem, tiny_id, data_prevista, cliente_id, raw)
  select g, 'Preparando envio', 'webhook', 900000000 + g, date '2026-11-01' + (g % 40),
         (select min(id) from public.clientes) + (g % 5000),
         jsonb_build_object('numero', g::text, 'situacao', 'Preparando envio',
           'cliente', jsonb_build_object('nome', 'Cliente ' || (g % 5000)),
           'itens', jsonb_build_array(jsonb_build_object('item', jsonb_build_object(
                      'codigo', 'PX' || (1 + g % 200), 'descricao', (${NOMES})[1 + (1 + g % 200) % 20],
                      'unidade', 'UN', 'quantidade', '3.00', 'valor_unitario', '100.00',
                      'info_adicional', case when g % 1000 < 50 then (${OBS})[1 + g % 5] else '' end)))
             || case when g % 5 = 0 then jsonb_build_array(jsonb_build_object('item', jsonb_build_object(
                      'codigo', 'PX' || (1 + (g + 7) % 200), 'descricao', (${NOMES})[1 + (1 + (g + 7) % 200) % 20],
                      'unidade', 'UN', 'quantidade', '1.00', 'valor_unitario', '50.00',
                      'info_adicional', case when g % 1000 between 50 and 84 then (${OBS})[1 + (g / 5) % 5] else '' end)))
                     else '[]'::jsonb end)
    from generate_series(1, ${N.pedidos}) g;
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, unidade, quantidade, valor_unitario)
  select p.id, x.ordem::int, x.e -> 'item' ->> 'codigo', x.e -> 'item' ->> 'descricao', 'UN',
         (x.e -> 'item' ->> 'quantidade')::numeric, (x.e -> 'item' ->> 'valor_unitario')::numeric
    from public.pedidos p cross join lateral jsonb_array_elements(p.raw -> 'itens') with ordinality x(e, ordem);
`)
console.log(`  pedidos ${N.pedidos.toLocaleString('pt-BR')} com raw e itens (${passou()})`)
// as peças: a k-ésima trinca vai para o pedido 1 + (k·7 mod N); o retrato do item 1 do pedido
const pedidoDe = (expr) => `(1 + ((${expr}) * 7) % ${N.pedidos})`
const vivas = (inicio, n, setorId) => `
  insert into public.plt_cards (tipo, pedido_id, item_seq, indice_unidade, total_unidades, item_codigo, item_descricao,
                                setor_atual_id, etapa_atual_id, desde)
  select 'unidade', p.id, 1, 1 + (g % 3), 3, 'PX' || (1 + p.numero % 200), (${NOMES})[1 + (1 + p.numero % 200) % 20],
         ${setorId}, (select e.id from public.plt_etapas e where e.setor_id = ${setorId} order by e.ordem offset (g % 7) limit 1),
         now() - (g % 500) * interval '1 hour'
    from generate_series(${inicio}, ${inicio + n - 1}) g
    join public.pedidos p on p.numero = ${pedidoDe('g / 3')};`
await bd.exec(vivas(0, N.vivosMontagem, MONTAGEM))
await bd.exec(vivas(N.vivosMontagem + 3, Math.round(N.vivosOutros / 2), LIMPEZA))
await bd.exec(vivas(N.vivosMontagem + 6 + Math.round(N.vivosOutros / 2), Math.round(N.vivosOutros / 2), FURACAO))
const ini = N.vivosMontagem + N.vivosOutros + 12
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, item_seq, indice_unidade, total_unidades, item_codigo, item_descricao,
                                setor_atual_id, desde, arquivado_em)
  select 'unidade', p.id, 1, 1 + (g % 3), 3, 'PX' || (1 + p.numero % 200), (${NOMES})[1 + (1 + p.numero % 200) % 20],
         ${ROTAS}, now() - interval '30 days', now() - (g % 900) * interval '1 hour'
    from generate_series(${ini}, ${ini + N.arquivados - 1}) g
    join public.pedidos p on p.numero = ${pedidoDe('g / 3')};
  insert into public.plt_cards (tipo, pedido_id, setor_atual_id, desde, liberado_completo_em)
  select 'pedido', x.pedido_id, ${PCP}, now() - interval '3 days', now() - interval '2 days'
    from (select distinct pedido_id from public.plt_cards where tipo = 'unidade') x;
  with escolhidos as (
    select p.id from public.pedidos p
     where not exists (select 1 from public.plt_cards c where c.pedido_id = p.id)
     order by p.numero desc limit ${N.pcp})
  insert into public.plt_cards (tipo, pedido_id, setor_atual_id, desde)
  select 'pedido', e.id, ${PCP}, now() - interval '1 day' from escolhidos e;
`)
await bd.exec(`set session_replication_role = origin; analyze;`)
const tam = (await bd.query(`select (select count(*) from public.plt_cards)::int as cards,
  (select count(*) from public.pedido_itens)::int as itens,
  (select count(*) from public.plt_cards where setor_atual_id = ${MONTAGEM} and arquivado_em is null)::int as montagem`)).rows[0]
console.log(`  cards ${tam.cards.toLocaleString('pt-BR')} · itens ${tam.itens.toLocaleString('pt-BR')} · vivos na MONTAGEM ${tam.montagem.toLocaleString('pt-BR')} (${passou()})`)

// ---------------- o preenchimento dos antigos (a manutenção) no volume ×100 ----------------
const PREENCHER = await readFile(path.join(R, 'supabase/manutencao/2026-11-12_observacao_dos_itens.sql'), 'utf8')
console.log('\n== o preenchimento dos antigos (manutenção) ==')
{
  let t = performance.now()
  let msg = ''
  try { await bd.exec(PREENCHER) } catch (e) { msg = e.message }
  linha('ENSAIO (conta, preenche e desfaz — nada gravado)', [performance.now() - t], ` · ${msg.slice(0, 160)}…`)
  await bd.exec(`select set_config('plt.acerto_s50_obs', 'aplicar', false)`)
  t = performance.now()
  await bd.exec(PREENCHER)
  linha('APLICAR (uma transação)', [performance.now() - t])
  t = performance.now()
  await bd.exec(PREENCHER)
  linha('APLICAR de novo (nada a fazer)', [performance.now() - t])
  await bd.exec(`select set_config('plt.acerto_s50_obs', '', false); analyze;`)
  const o = (await bd.query(`select count(*)::int as itens, count(distinct pedido_id)::int as pedidos from public.plt_itens_observacao`)).rows[0]
  console.log(`  guardados: ${o.itens.toLocaleString('pt-BR')} itens em ${o.pedidos.toLocaleString('pt-BR')} pedidos`)
}

// ---------------- as versões de ANTES com outro nome (A-209) ----------------
const ANTES = '20261112050000'
await bd.exec((await ultima('fn_quadro_cards', ANTES)).replace('plt_privado.fn_quadro_cards(p_ids', 'plt_privado.fn_quadro_cards_antes(p_ids'))
for (const nome of ['plt_fn_quadro_setor', 'plt_fn_quadro_coluna', 'plt_fn_card_janela']) {
  let t = await ultima(nome, ANTES)
  t = trocar(t, `public.${nome}(`, `public.${nome}_antes(`, 1)
  t = trocar(t, 'plt_privado.fn_quadro_cards(', 'plt_privado.fn_quadro_cards_antes(', 1)
  await bd.exec(t)
}
const FILA = (await bd.query(`select id::int as id from public.plt_etapas where setor_id = ${MONTAGEM} and eh_fila`)).rows[0].id
await bd.exec(`select set_config('request.jwt.claim.sub', '${ADM}', false)`)
const comChave = (r) => `${r.rows[0].q.colunas.flatMap((c) => c.cards).filter((c) => 'observacao_item' in c).length} de ${r.rows[0].q.colunas.flatMap((c) => c.cards).length} cards com observação`
const comChaveCol = (r) => `${r.rows[0].c.cards.filter((c) => 'observacao_item' in c).length} de ${r.rows[0].c.cards.length} com observação`
const comObs = (await bd.query(`select u.id::int as id from public.plt_cards u join public.plt_itens_observacao o on o.pedido_id = u.pedido_id and o.seq = u.item_seq
                                 where u.setor_atual_id = ${MONTAGEM} and u.arquivado_em is null order by u.id limit 1`)).rows[0].id
const semObs = (await bd.query(`select u.id::int as id from public.plt_cards u where u.setor_atual_id = ${MONTAGEM} and u.arquivado_em is null
                                   and not exists (select 1 from public.plt_itens_observacao o where o.pedido_id = u.pedido_id) order by u.id limit 1`)).rows[0].id

async function medir(fase) {
  console.log(`\n== ${fase} ==`)
  await comparar('quadro da MONTAGEM (10 por coluna) — o que a tela abre',
    `select public.plt_fn_quadro_setor_antes(${MONTAGEM}, 10) as q`, `select public.plt_fn_quadro_setor(${MONTAGEM}, 10) as q`, comChave)
  await comparar('"Ver mais" na fila da MONTAGEM (10)',
    `select public.plt_fn_quadro_coluna_antes(${MONTAGEM}, ${FILA}, null, 0, 10) as c`, `select public.plt_fn_quadro_coluna(${MONTAGEM}, ${FILA}, null, 0, 10) as c`, comChaveCol)
  await comparar('janela do card de uma peça COM observação',
    `select public.plt_fn_card_janela_antes(${comObs}) as j`, `select public.plt_fn_card_janela(${comObs}) as j`,
    (r) => `chave: ${JSON.stringify(r.rows[0].j.card.observacao_item ?? null)}`)
  await comparar('janela do card de uma peça SEM observação',
    `select public.plt_fn_card_janela_antes(${semObs}) as j`, `select public.plt_fn_card_janela(${semObs}) as j`)
}
await medir('DEPOIS do preenchimento — a distribuição de produção (~5,7% dos pedidos com observação)')

// ---------------- o caso típico: 1 em cada 10 cards da 1ª página do quadro com observação ----------------
await bd.exec(`
  insert into public.plt_itens_observacao (pedido_id, seq, texto)
  select distinct c.pedido_id, c.item_seq, 'adicionar rodízios — caso típico do ensaio'
    from (select unnest(plt_privado.fn_quadro_pagina(${MONTAGEM}, e.id, null, null, 10, null, null)) as id
            from public.plt_etapas e where e.setor_id = ${MONTAGEM} and e.ativa) p
    join public.plt_cards c on c.id = p.id
   where c.id % 10 = 0
  on conflict (pedido_id, seq) do nothing;
  analyze public.plt_itens_observacao;`)
await medir('TÍPICO — o pedido de 1 em cada 10 cards da 1ª página com observação (vale para as 3 peças dele)')

// ---------------- o pior caso: TODO pedido com peça viva na MONTAGEM tem observação ----------------
await bd.exec(`
  insert into public.plt_itens_observacao (pedido_id, seq, texto)
  select distinct u.pedido_id, u.item_seq, 'COM RODINHAS — pior caso do ensaio'
    from public.plt_cards u where u.setor_atual_id = ${MONTAGEM} and u.arquivado_em is null and u.tipo = 'unidade'
  on conflict (pedido_id, seq) do nothing;
  analyze public.plt_itens_observacao;`)
await medir('PIOR CASO — todo pedido com peça na MONTAGEM tem observação')

// a regra numa página cheia (o plano da consulta de dentro, com os ids da 1ª página de cada coluna)
const ids = (await bd.query(`select array_agg(x) as ids from (
  select unnest(plt_privado.fn_quadro_pagina(${MONTAGEM}, e.id, null, null, 10, null, null)) as x
    from public.plt_etapas e where e.setor_id = ${MONTAGEM} and e.ativa) y`)).rows[0].ids
console.log(`\n  a 1ª página do quadro: ${ids.length} cards`)
{
  // a consulta de dentro da regra, tirada da própria migration (a que vai para o ar), com a página no lugar de p_ids
  const mig = (await readFile(path.join(R, 'supabase/migrations', MINHA), 'utf8')).replace(/\r\n/g, '\n')
  const ini = mig.indexOf('return query', mig.indexOf('create or replace function plt_privado.fn_observacao_das_unidades'))
  const fim = mig.indexOf('\nexception when others then', ini)
  const consulta = mig.slice(ini + 'return query'.length, fim).trim().replace(/;$/, '')
    .split('p_ids').join(`'{${ids.join(',')}}'::bigint[]`)
  await plano('a regra (fn_observacao_das_unidades) — a consulta de dentro, na página cheia do pior caso', consulta)
}
{
  const v = []
  for (let i = 0; i < 8; i++) {
    const t = performance.now()
    await bd.query(`select count(*) from plt_privado.fn_observacao_das_unidades('{${ids.join(',')}}'::bigint[])`)
    v.push(performance.now() - t)
  }
  linha(`a regra sozinha numa página cheia (${ids.length} cards, todos com observação)`, v, ` · 6ª ${v[5].toFixed(1)} ms`)
}

// ---------------- o gesto: a gravação do Tiny que muda SÓ a observação ----------------
console.log('\n== a gravação do Tiny (fn_upsert_pedido) que muda só a observação de um pedido com peças na MONTAGEM ==')
const alvos = (await bd.query(`select distinct p.numero from public.plt_cards u join public.pedidos p on p.id = u.pedido_id
                                 where u.setor_atual_id = ${MONTAGEM} and u.arquivado_em is null order by p.numero limit 10`)).rows.map((r) => r.numero)
const sem = []
const com = []
let rodada = 0
for (const numero of alvos) {
  for (const ligado of [false, true]) {
    rodada += 1
    const p = (await bd.query(`select raw from public.pedidos where numero = ${numero}`)).rows[0].raw
    p.itens[0].item.info_adicional = `observação nova ${rodada}`
    const j = `'${JSON.stringify(p).replace(/'/g, "''")}'::jsonb`
    await bd.exec(`alter table public.pedidos ${ligado ? 'enable' : 'disable'} trigger plt_pedidos_observacao_itens_upd`)
    const t = performance.now()
    await bd.query(`select public.fn_upsert_pedido(p => ${j}, p_tipo => 'atualizacao_pedido', p_tiny_id => ${900000000 + numero}, p_origem => 'webhook')`)
    ;(ligado ? com : sem).push(performance.now() - t)
  }
}
await bd.exec(`alter table public.pedidos enable trigger plt_pedidos_observacao_itens_upd`)
linha('GESTO: gravar o pedido do Tiny (sem o gatilho novo — a de antes)', sem)
linha('GESTO: gravar o pedido do Tiny (com o gatilho novo: grava a observação e avisa)', com)
const sinais = (await bd.query(`select count(*)::int as n from realtime.messages where event = 'card_mudou'`)).rows[0].n
console.log(`  avisos "card_mudou" enviados: ${sinais}`)

await bd.close()
console.log(`\nfim (${passou()})`)
process.exit(0)
