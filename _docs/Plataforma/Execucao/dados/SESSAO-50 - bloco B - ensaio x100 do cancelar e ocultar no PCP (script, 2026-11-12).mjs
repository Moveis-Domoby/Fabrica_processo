// SESSAO-50 · bloco B · ensaio ×100 (Lei de desempenho §1/§7.2/§12): as portas que o bloco B
// recria (a regra única do PCP com 5 argumentos e os 12 leitores, a lista de Pedidos, a janela de
// liberar) e as novas (as abas "Cancelados" e "Pedidos ocultos", o "Incluir pedido no PCP", a prévia
// dos modais, a janela "O que aconteceu?"), e os gestos (cancelar, ocultar com as peças, recuperar,
// a conferência que marca o excluído no Tiny). ANTES (todas as migrations até a SESSAO-48) ×
// DEPOIS (a base e o bloco B da 50) no MESMO banco. Montado a partir do ensaio da SESSAO-48.
// Banco PGlite GRAVADO EM DISCO — os números são o teto, não a média de produção.
// Volume: produção de 23/10 × 100 — pedidos 5.627 → 562.700; cards ~77.700; e o que a 50 cria:
// 100 excluídos no Tiny, 300 cancelados pela plataforma, 500 ocultos (metade fora dos 30 dias).
// Uso: node <este arquivo> <raiz do repositório> <pasta NOVA do banco (E-267)>
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
  excluidos: Math.round(1 * X),
  canceladosPlataforma: Math.round(3 * X),
  ocultos: Math.round(5 * X),
}
await rm(PASTA, { recursive: true, force: true })
const bd = new PGlite(PASTA, { extensions: { pg_trgm } })

const med = (v) => { const s = [...v].sort((a, b) => a - b); return [s[Math.floor(s.length / 2)], s[s.length - 1]] }
const linha = (rotulo, v, extra = '') => {
  const [m, x] = med(v)
  console.log(`  ${rotulo.padEnd(84)} mediana ${m.toFixed(1).padStart(8)} ms · máx ${x.toFixed(1).padStart(8)} ms${extra}`)
}
// A-209: a 6ª chamada conta (o plano genérico da função plpgsql) — 8 chamadas seguidas
const t = async (rotulo, sql, vezes = 8, extrair = null) => {
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

console.log(`== montando o banco em disco (×${X}: pedidos ${N.pedidos.toLocaleString('pt-BR')}) ==`)
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
const migs = todas.filter((f) => f < '20261112000000')
for (const f of migs) await bd.exec(await readFile(path.join(R, 'supabase/migrations', f), 'utf8'))
console.log(`  ${migs.length} migrations aplicadas (a última: ${migs[migs.length - 1]}) (${passou()})`)

const ADM = '00000000-0000-0000-0000-000000005091'
const setor = async (c) => (await bd.query(`select id::int as id from public.plt_setores where codigo = '${c}'`)).rows[0].id
const [PCP, LIMPEZA, MONTAGEM, FURACAO, ROTAS, AGUARDO] = [await setor('pcp'), await setor('limpeza_embalagem'), await setor('montagem'), await setor('furacao'), await setor('rotas'), await setor('aguardo')]
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id, modulos) values
    ('Dono 50', 'dono50@x.com', '50509000091', 'dono.50x', 'admin', '${ADM}', array['fabrica']);
  insert into public.plt_etapas (setor_id, nome, ordem, eh_fila)
  select s, e.nome, e.ordem, e.ordem = 10
    from unnest(array[${LIMPEZA}, ${MONTAGEM}, ${FURACAO}]) s,
         (values ('A FAZER', 10), ('FAZENDO', 20), ('CONFERIR', 30), ('EMBALANDO', 40), ('PARADO', 50), ('PRONTO', 60), ('EXTRA', 70)) e(nome, ordem);
  insert into public.plt_etapas (setor_id, nome, ordem, eh_fila, cancela_fabricacao, cancela_motivo) values
    (${LIMPEZA}, 'CANCELADO', 80, false, true, 'cancelada');
  update public.plt_setores set tiny_entrega_desde = now() where codigo = 'rotas';
`)
const CANC = (await bd.query(`select id::int as id from public.plt_etapas where setor_id = ${LIMPEZA} and nome = 'CANCELADO'`)).rows[0].id
const FILA = (await bd.query(`select id::int as id from public.plt_etapas where setor_id = ${LIMPEZA} and eh_fila order by ordem limit 1`)).rows[0].id
await bd.exec(`set session_replication_role = replica`) // a semeadura não dispara gatilho
const NOMES = `array['Estante Basic 5 nichos - Branca','Armário Aéreo 3 portas - Branco','Armário multiuso 2 portas com chave','Mesa/escrivaninha Close - 80 x 75 x 45','Sapateira Basic 7 nichos','Cômoda 4 gavetas - Off White','Rack Retrô 1 porta','Aparador Retrô - Freijó','Painel TV 1,80 - Preto','Balcão 3 portas - Branco','Cabideiro Teste','Penteadeira camarim','Nicho decorativo','Guarda-roupa 6 portas','Mesa de cabeceira','Escrivaninha Office','Estante Livreiro 4 prateleiras','Armário Baixo 2 portas','Painel Ripado','Closet modular']`
await bd.exec(`
  insert into public.clientes (nome, endereco, numero, bairro, cidade, uf, cep)
  select 'Cliente ' || g, 'Rua ' || g, (g % 900)::text, 'Bairro ' || (g % 50), 'Natal', 'RN', '59000-000' from generate_series(1, 5000) g;
  insert into public.pedidos (numero, situacao, origem, tiny_id, data_prevista, cliente_id, data_pedido)
  select g, case when g % 13 = 0 then 'Entregue' when g % 101 = 0 then 'Enviado' when g % 97 = 0 then 'Cancelado' else 'Preparando envio' end,
         'webhook', 900000000 + g, date '2026-11-01' + (g % 40), (select min(id) from public.clientes) + (g % 5000), date '2026-01-01' + (g % 300)
    from generate_series(1, ${N.pedidos}) g;
`)
console.log(`  pedidos ${N.pedidos.toLocaleString('pt-BR')} (${passou()})`)
const pedidoDe = (expr) => `(1 + ((${expr}) * 7) % ${N.pedidos})`
const vivas = (inicio, n, setorId) => `
  insert into public.plt_cards (tipo, pedido_id, item_seq, indice_unidade, total_unidades, item_codigo, item_descricao,
                                setor_atual_id, etapa_atual_id, desde)
  select 'unidade', p.id, 1, 1 + (g % 3), 3, 'SKU' || (g % 20), (${NOMES})[1 + (g / 3) % 20],
         ${setorId}, (select e.id from public.plt_etapas e where e.setor_id = ${setorId} and not e.cancela_fabricacao order by e.ordem offset (g % 7) limit 1),
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
  insert into public.plt_cards (tipo, pedido_id, setor_atual_id, desde, liberado_completo_em)
  select 'pedido', x.pedido_id, ${PCP}, now() - interval '3 days', now() - interval '2 days'
    from (select distinct pedido_id from public.plt_cards where tipo = 'unidade') x;
  with escolhidos as (
    select p.id from public.pedidos p
     where not exists (select 1 from public.plt_cards c where c.pedido_id = p.id)
       and p.situacao = 'Preparando envio'
     order by p.numero desc limit ${N.pcp})
  insert into public.plt_cards (tipo, pedido_id, setor_atual_id, desde)
  select 'pedido', e.id, ${PCP}, now() - interval '1 day' from escolhidos e;
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
  select c.pedido_id, 1, 'SKU1', 'Estante Basic 5 nichos - Branca', 3
    from public.plt_cards c where c.tipo = 'pedido' and c.liberado_completo_em is null;
  -- o cancelado no Tiny que passou pelo PCP: o fato do cancelamento no card do pedido
  insert into public.plt_eventos (card_id, tipo, origem, ocorrido_em)
  select c.id, 'pedido_cancelado', 'api', now() - (c.id % 700) * interval '1 hour'
    from public.plt_cards c join public.pedidos p on p.id = c.pedido_id
   where c.tipo = 'pedido' and p.situacao = 'Cancelado';
`)
await bd.exec(`set session_replication_role = origin; analyze;`)
const tam = (await bd.query(`select (select count(*) from public.plt_cards)::int as cards, (select count(*) from public.plt_eventos)::int as eventos,
  (select count(*) from public.plt_cards where setor_atual_id = ${PCP} and tipo = 'pedido' and liberado_completo_em is null)::int as pcp`)).rows[0]
console.log(`  cards ${tam.cards.toLocaleString('pt-BR')} · eventos ${tam.eventos.toLocaleString('pt-BR')} · aguardando no PCP ${tam.pcp.toLocaleString('pt-BR')} (${passou()})`)

const como = (auth) => bd.exec(`select set_config('request.jwt.claim.sub', '${auth}', false)`)
const UM_PEDIDO = `(select min(id) from public.plt_cards where tipo = 'pedido' and liberado_completo_em is null)`

async function medirComuns(fase) {
  await como(ADM)
  console.log(`\n== ${fase} ==`)
  await t('PCP "aguardando liberação" (10)', `select * from public.plt_fn_pcp_quadro(10, 0, 'pedido', null, null)`, 8, (r) => `${r.rows[0]?.contagem_total ?? 0} no quadro`)
  await t('PCP filtrado pelo número ("12", 10)', `select * from public.plt_fn_pcp_quadro(10, 0, 'pedido', null, '12')`, 8, (r) => `${r.rows[0]?.contagem_total ?? 0} batem`)
  await t('PCP aba Stand-by (10)', `select * from public.plt_fn_pcp_quadro(10, 0, 'standby', null, null)`, 8, (r) => `${r.rows.length} linhas`)
  await t('PCP porta antiga (10)', `select * from public.plt_fn_cards_pedido_pcp(10, 0)`, 8, (r) => `${r.rows.length} linhas`)
  await t('quadrinho do PCP na Visão do dia', `select * from public.plt_fn_dash_pcp_dia()`, 8, (r) => `${r.rows[0]?.pedidos_a_liberar ?? '—'} a liberar`)
  await t('lista de Pedidos (20)', `select * from public.plt_fn_pedidos_lista(null, null, 20, false)`, 8, (r) => `${r.rows.length} linhas`)
  await t('a janela "Liberar unidades"', `select public.plt_fn_pcp_liberacao(${UM_PEDIDO}) as j`, 8)
  await t('a janela "O que aconteceu?"', `select public.plt_fn_pcp_aviso(${UM_PEDIDO}) as a`, 8)
}

await medirComuns('ANTES (até a SESSAO-48)')
// a porta que o "Novo pedido" usava (a lista inteira contada e calculada antes do corte): 1 chamada só
await t('a lista do "Novo pedido" de antes (pedidos sem card, 8 — a porta antiga)', `select count(*) from public.plt_fn_pedidos_kanban(null, true, null, 8, 0)`, 1)
for (const f of todas.filter((f) => f >= '20261112000000' && f < '20261112030000'))
  await bd.exec(await readFile(path.join(R, 'supabase/migrations', f), 'utf8'))
console.log(`\n  a base e o bloco B da SESSAO-50 aplicados (${passou()})`)

// o que a 50 cria: excluídos no Tiny (com o card vivo), cancelados pela plataforma e ocultos
await bd.exec(`set session_replication_role = replica`)
await bd.exec(`
  insert into public.plt_pedidos_excluidos_tiny (pedido_id, tiny_id, numero, erro, detectado_em)
  select c.pedido_id, p.tiny_id, p.numero, 'codigo 32: Pedido não localizado', now() - (c.id % 30) * interval '1 day'
    from public.plt_cards c join public.pedidos p on p.id = c.pedido_id
   where c.tipo = 'pedido' and c.liberado_completo_em is null order by c.id limit ${N.excluidos};
  with alvo as (select c.id from public.plt_cards c where c.tipo = 'pedido' and c.liberado_completo_em is null
                   and not exists (select 1 from public.plt_pedidos_excluidos_tiny x where x.pedido_id = c.pedido_id)
                 order by c.id desc limit ${N.canceladosPlataforma})
  update public.plt_cards c set cancelado_plataforma_em = now() - (c.id % 20) * interval '1 day', cancelado_plataforma_evento_id = 1
    from alvo where alvo.id = c.id;
  with alvo as (select c.id from public.plt_cards c where c.tipo = 'pedido' and c.liberado_completo_em is null
                   and c.cancelado_plataforma_em is null
                   and not exists (select 1 from public.plt_pedidos_excluidos_tiny x where x.pedido_id = c.pedido_id)
                 order by c.id offset ${N.excluidos} limit ${N.ocultos})
  update public.plt_cards c set removido_pcp_em = now() - (c.id % 60) * interval '1 day', removido_pcp_motivo = 'oculto',
                                removido_pcp_evento_id = 1
    from alvo where alvo.id = c.id;
  -- a observação do item (a tabela nasce na base da 50; o bloco A a mostra) em 1 de cada 15 pedidos aguardando no PCP
  insert into public.plt_itens_observacao (pedido_id, seq, texto)
  select c.pedido_id, 1, 'adicionar rodízios' from public.plt_cards c
   where c.tipo = 'pedido' and c.liberado_completo_em is null and c.id % 15 = 0;
`)
await bd.exec(`set session_replication_role = origin; analyze;`)
const marcas = (await bd.query(`select (select count(*) from public.plt_pedidos_excluidos_tiny)::int as excl,
  (select count(*) from public.plt_cards where cancelado_plataforma_em is not null)::int as canc,
  (select count(*) from public.plt_cards where removido_pcp_em is not null)::int as ocult`)).rows[0]
console.log(`  excluídos ${marcas.excl} · cancelados pela plataforma ${marcas.canc} · ocultos ${marcas.ocult} (${passou()})`)

await medirComuns('DEPOIS (a base e o bloco B da SESSAO-50)')
await como(ADM)
console.log('\n== as portas novas ==')
await t('aba "Cancelados" (1ª página, 20)', `select * from public.plt_fn_pcp_cancelados(null, 20, null, null)`, 8, (r) => `${r.rows.length} linhas`)
{
  const p1 = (await bd.query(`select saiu_em, card_id from public.plt_fn_pcp_cancelados(null, 20, null, null) order by saiu_em, card_id limit 1`)).rows[0]
  if (p1) await t('aba "Cancelados" (2ª página pelo cursor)', `select * from public.plt_fn_pcp_cancelados(null, 20, '${p1.saiu_em.toISOString()}', ${p1.card_id})`, 8, (r) => `${r.rows.length} linhas`)
}
await t('aba "Cancelados" filtrada pelo número ("97", 20)', `select * from public.plt_fn_pcp_cancelados('97', 20, null, null)`, 8, (r) => `${r.rows.length} linhas`)
await t('aba "Cancelados" filtrada pelo nome ("Cliente 12", 20)', `select * from public.plt_fn_pcp_cancelados('Cliente 12', 20, null, null)`, 8, (r) => `${r.rows.length} linhas`)
await t('aba "Pedidos ocultos" (20, os 30 dias)', `select public.plt_fn_pcp_ocultos(null, 20, null, null) as r`, 8, (r) => `${r.rows[0].r.linhas.length} linhas`)
await t('aba "Pedidos ocultos" filtrada ("5", 20)', `select public.plt_fn_pcp_ocultos('5', 20, null, null) as r`, 8, (r) => `${r.rows[0].r.linhas.length} linhas`)
{
  const r1 = await t('"Incluir pedido no PCP" (1ª página)', `select public.plt_fn_pcp_incluir_lista(null, 8, null) as r`, 8,
    (r) => `${r.rows[0].r.ocultos.length} ocultos · ${r.rows[0].r.sem_card.length} sem card · próximo ${r.rows[0].r.proximo}`)
  const prox = r1.rows[0].r.proximo
  if (prox) await t('"Incluir pedido no PCP" (2ª página pelo cursor)', `select public.plt_fn_pcp_incluir_lista(null, 8, ${prox}) as r`, 8,
    (r) => `${r.rows[0].r.sem_card.length} sem card`)
  // o pior caso de produção: os pedidos mais novos TODOS com card (a varredura pula todos eles)
  const meio = (await bd.query(`select (max(numero) - (max(numero) - min(numero)) / 3)::int as m from public.pedidos`)).rows[0].m
  await t('"Incluir pedido no PCP" (o cursor no meio da história)', `select public.plt_fn_pcp_incluir_lista(null, 8, ${meio}) as r`, 8,
    (r) => `${r.rows[0].r.sem_card.length} sem card`)
}
await t('"Incluir pedido no PCP" buscando ("Cliente 3")', `select public.plt_fn_pcp_incluir_lista('Cliente 3', 8, null) as r`, 8,
  (r) => `${r.rows[0].r.sem_card.length} sem card`)
await t('"Incluir pedido no PCP" buscando o número ("5612", raro)', `select public.plt_fn_pcp_incluir_lista('5612', 8, null) as r`, 8,
  (r) => `${r.rows[0].r.sem_card.length} sem card`)
await t('  · a parte de cima: os ocultos de qualquer idade (5)', `select count(*) from plt_privado.fn_pcp_ocultos_linhas(null, 5, null, null, true)`, 8)
await t('a prévia dos modais Cancelar/Ocultar', `select public.plt_fn_pcp_saida_previa(${UM_PEDIDO}) as p`, 8)
await t('"Para onde vai este móvel?" de um cancelado pela plataforma',
  `select public.plt_fn_destino_pendentes((select min(id) from public.plt_cards where cancelado_plataforma_em is not null)) as d`, 8)

console.log('\n== os gestos ==')
{
  // cancelar 5 pedidos, um a um
  const alvos = (await bd.query(`select c.id::int as id from public.plt_cards c where c.tipo = 'pedido' and c.liberado_completo_em is null
    and c.cancelado_plataforma_em is null and c.removido_pcp_em is null
    and not exists (select 1 from public.plt_pedidos_excluidos_tiny x where x.pedido_id = c.pedido_id) order by c.id limit 10`)).rows
  const v = []
  for (const c of alvos.slice(0, 5)) { const a = performance.now(); await bd.query(`select public.plt_fn_pcp_cancelar(${c.id}, 'k${c.id}')`); v.push(performance.now() - a) }
  linha('GESTO: "Cancelar pedido" (5 pedidos)', v)
  // ocultar com as peças: dá 3 peças na LIMPEZA a cada um, depois oculta
  const w = []
  for (const c of alvos.slice(5, 10)) {
    await bd.exec(`
      insert into public.plt_cards (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades)
      select 'unidade', pc.pedido_id, pc.id, 1, 'SKU1', 'Estante Basic 5 nichos - Branca', k, 3
        from public.plt_cards pc cross join generate_series(1, 3) k where pc.id = ${c.id};
      insert into public.plt_eventos (card_id, tipo, setor_destino_id, etapa_destino_id, origem)
      select u.id, 'card_criado', ${LIMPEZA}, ${FILA}, 'api' from public.plt_cards u
       where u.card_pai_id = ${c.id} and u.tipo = 'unidade';`)
    const a = performance.now()
    await bd.query(`select public.plt_fn_pcp_ocultar(${c.id}, true, 'o${c.id}')`)
    w.push(performance.now() - a)
  }
  linha('GESTO: "Ocultar o pedido e as peças" (5 pedidos × 3 peças)', w)
  const z = []
  for (const c of alvos.slice(5, 10)) { const a = performance.now(); await bd.query(`select public.plt_fn_pcp_devolver(${c.id})`); z.push(performance.now() - a) }
  linha('GESTO: "Recuperar" (5 pedidos — as vagas voltam abertas)', z)
}
{
  // a conferência da madrugada marcando 5 excluídos novos (com card vivo)
  await bd.exec(`
    insert into public.tiny_fila (recurso, chave, referencia, status, erro, tentativas, params, conta)
    select 'pedido', p.tiny_id::text, p.numero::text, 'vazio', 'codigo 32: Pedido não localizado', 1, '{}'::jsonb, 'loja'
      from public.plt_cards c join public.pedidos p on p.id = c.pedido_id
     where c.tipo = 'pedido' and c.liberado_completo_em is null and c.cancelado_plataforma_em is null and c.removido_pcp_em is null
       and not exists (select 1 from public.plt_pedidos_excluidos_tiny x where x.pedido_id = c.pedido_id)
     order by c.id desc limit 5;`)
  const a = performance.now()
  const r = (await bd.query(`select plt_privado.fn_pedidos_excluidos_aplicar() as r`)).rows[0].r
  linha(`CONFERÊNCIA: o veredito dos excluídos (${r.novos} novos — o fato, as peças, o sino)`, [performance.now() - a])
}
await bd.exec('analyze')
await como(ADM)
await plano('o quadro do PCP (a regra única com o conjunto dos excluídos)', `select * from public.plt_fn_pcp_quadro(10, 0, 'pedido', null, null)`)
await plano('a aba "Cancelados" (1ª página)', `select * from public.plt_fn_pcp_cancelados(null, 20, null, null)`)
await bd.close()
console.log(`\nfim (${passou()})`)
process.exit(0)
