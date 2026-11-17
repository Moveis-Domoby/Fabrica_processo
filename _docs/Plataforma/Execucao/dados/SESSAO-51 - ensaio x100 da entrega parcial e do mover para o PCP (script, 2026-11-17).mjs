// SESSAO-51 · ensaio ×100 (Lei de desempenho §1/§7.2/§12): as portas que a 51 toca (o quadro do PCP, a
// lista de Pedidos, os ocultos, a janela de liberar, a ficha) ANTES × DEPOIS no MESMO banco, e as novas
// (Entregas parciais, as prévias, a janela da entrega parcial, os gestos). Montado a partir do ensaio da 50.
// Uso: node <este arquivo> <raiz do repositório> <pasta NOVA do banco (E-267)>  (ESCALA=1 primeiro — E-273)
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
const migs = todas.filter((f) => f < '20261116000000')
for (const f of migs) await bd.exec(await readFile(path.join(R, 'supabase/migrations', f), 'utf8'))
console.log(`  ${migs.length} migrations aplicadas (a última: ${migs[migs.length - 1]}) (${passou()})`)

const ADM = '00000000-0000-0000-0000-000000005191'
const setor = async (c) => (await bd.query(`select id::int as id from public.plt_setores where codigo = '${c}'`)).rows[0].id
const [PCP, LIMPEZA, MONTAGEM, FURACAO, ROTAS, AGUARDO] = [await setor('pcp'), await setor('limpeza_embalagem'), await setor('montagem'), await setor('furacao'), await setor('rotas'), await setor('aguardo')]
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id, modulos) values
    ('Dono 51', 'dono51@x.com', '51519000091', 'dono.51x', 'admin', '${ADM}', array['fabrica']);
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

// ============================================================================
// SESSAO-51 · as medidas: ANTES (até a 50) × DEPOIS (a base e os blocos A e B da 51)
// ============================================================================
const UM_PEDIDO = `(select min(id) from public.plt_cards where tipo = 'pedido' and liberado_completo_em is null)`
const PEDIDO_DO = `(select pedido_id from public.plt_cards where id = ${UM_PEDIDO})`
const UMA_PECA = `(select min(c.id) from public.plt_cards c join public.plt_setores s on s.id = c.setor_atual_id
                    where c.tipo = 'unidade' and c.arquivado_em is null and s.papel_no_fluxo = 'producao' and c.pedido_id is not null)`
await como(ADM)
async function medirComuns(fase) {
  console.log(`\n== ${fase} ==`)
  await t(`${fase} · PCP — quadro, 1ª página (10)`, `select count(*) from public.plt_fn_pcp_quadro(10, 0, 'pedido', null, null)`)
  await t(`${fase} · Pedidos — 1ª página (20)`, `select count(*) from public.plt_fn_pedidos_lista(null, null, 20, false)`)
  await t(`${fase} · Pedidos — busca "12"`, `select count(*) from public.plt_fn_pedidos_lista('12', null, 20, false)`)
  await t(`${fase} · Pedidos ocultos (aba)`, `select count(*) from plt_privado.fn_pcp_ocultos_linhas(null, 20, null, null, false)`)
  await t(`${fase} · Incluir pedido no PCP (os ocultos de qualquer idade)`, `select count(*) from plt_privado.fn_pcp_ocultos_linhas(null, 5, null, null, true)`)
  await t(`${fase} · Liberar unidades (a janela)`, `select public.plt_fn_pcp_liberacao(${UM_PEDIDO})`)
  await t(`${fase} · Ficha do pedido`, `select public.plt_fn_pcp_pedido_detalhe(${PEDIDO_DO})`)
}
await medirComuns('ANTES')

console.log(`\n== aplicando as migrations da 51 (${passou()}) ==`)
for (const f of todas.filter((f) => f >= '20261116000000')) {
  const a = performance.now()
  await bd.exec(await readFile(path.join(R, 'supabase/migrations', f), 'utf8'))
  console.log(`  ${f} (${(performance.now() - a).toFixed(0)} ms)`)
}

// o que a 51 cria, no volume ×100: entregas parciais com decisão (metade "deixar",
// metade "limpar" com peças retiradas) e peças devolvidas ao PCP
const NP = Math.round(3 * X)
const NV = Math.round(2 * X)
await bd.exec(`set session_replication_role = replica`)
await bd.exec(`
  with alvo as (
    select c.id, c.pedido_id, row_number() over (order by c.id) as n
      from public.plt_cards c where c.tipo = 'pedido' and c.liberado_completo_em is not null
     order by c.id limit ${NP}
  ),
  ev as (
    insert into public.plt_eventos (card_id, tipo, origem, dados)
    select a.id, 'pedido_entregue', 'api',
           jsonb_build_object('parcial', true, 'fabrica', case when a.n % 2 = 0 then 'manter' else 'limpar' end,
                              'entregues', '[]'::jsonb, 'total_pedido', 3)
      from alvo a
    returning id, card_id
  )
  update public.plt_cards c
     set parcial_evento_id = ev.id, parcial_em = now() - (c.id % 300) * interval '1 hour',
         parcial_entregues = 1, parcial_total = 3,
         parcial_decisao = case when a.n % 2 = 0 then 'manter' else 'limpar' end,
         parcial_decisao_em = now() - (c.id % 300) * interval '1 hour', parcial_decisao_evento_id = ev.id,
         entrega_evento_id = case when a.n % 2 = 0 then null else ev.id end,
         removido_pcp_em = case when a.n % 2 = 0 then null else now() end,
         removido_pcp_motivo = case when a.n % 2 = 0 then null else 'entrega_parcial' end,
         removido_pcp_evento_id = case when a.n % 2 = 0 then null else ev.id end
    from alvo a join ev on ev.card_id = a.id
   where c.id = a.id;
  -- uma peça retirada por pedido "limpar" (com o fato que guarda o setor e a etapa)
  with alvo as (
    select u.id, u.setor_atual_id, u.etapa_atual_id
      from public.plt_cards u join public.plt_cards pc on pc.pedido_id = u.pedido_id and pc.tipo = 'pedido'
     where u.tipo = 'unidade' and u.arquivado_em is null and pc.parcial_decisao = 'limpar'
  ),
  ev as (
    insert into public.plt_eventos (card_id, tipo, origem, dados)
    select a.id, 'peca_retirada_entrega_parcial', 'api',
           jsonb_build_object('setor_id', a.setor_atual_id, 'etapa_id', a.etapa_atual_id, 'setor', 'MONTAGEM', 'etapa', 'FAZENDO')
      from alvo a
    returning id, card_id
  )
  update public.plt_cards c set retirada_parcial_em = now(), retirada_parcial_evento_id = ev.id, arquivado_em = now()
    from ev where c.id = ev.card_id;
  -- peças devolvidas ao PCP (a vaga reabriu): arquivadas, sem pedido, com a marca
  with alvo as (
    select u.id, u.pedido_id, row_number() over (order by u.id) as n
      from public.plt_cards u where u.tipo = 'unidade' and u.arquivado_em is null and u.pedido_id is not null
     order by u.id desc limit ${NV}
  ),
  ev as (
    insert into public.plt_eventos (card_id, tipo, origem, dados)
    select a.id, 'card_voltou_pcp', 'api',
           jsonb_build_object('escolha', 'voltar', 'motivo', 'Prioridade mudou', 'pedido_id', a.pedido_id, 'setor', 'MONTAGEM', 'etapa', 'FAZENDO')
      from alvo a
    returning id, card_id
  )
  update public.plt_cards c
     set voltou_pcp_em = now(), voltou_pcp_evento_id = ev.id, voltou_pcp_pedido_id = c.pedido_id,
         -- a coerência da peça (E-254): sem pedido e sem produto, guarda o card do pedido como pai
         card_pai_id = coalesce(c.card_pai_id, (select pc.id from public.plt_cards pc
                                                 where pc.pedido_id = c.pedido_id and pc.tipo = 'pedido')),
         pedido_id = null, arquivado_em = now()
    from ev where c.id = ev.card_id;
`)
await bd.exec(`set session_replication_role = origin; analyze;`)
const t51 = (await bd.query(`select (select count(*) from public.plt_cards where parcial_decisao is not null)::int as parciais,
  (select count(*) from public.plt_cards where voltou_pcp_em is not null)::int as voltaram,
  (select count(*) from public.plt_cards where retirada_parcial_em is not null)::int as retiradas`)).rows[0]
console.log(`  entregas parciais com decisão ${t51.parciais} · peças devolvidas ao PCP ${t51.voltaram} · peças retiradas ${t51.retiradas} (${passou()})`)

await medirComuns('DEPOIS')
const PARCIAL = `(select min(id) from public.plt_cards where parcial_decisao = 'manter')`
await t('DEPOIS · Entregas parciais — 1ª página (20)', `select public.plt_fn_entregas_parciais(null, 20, null, null)`, 8,
        (r) => `${r.rows[0].plt_fn_entregas_parciais.itens.length} itens`)
await t('DEPOIS · Entregas parciais — busca "12"', `select public.plt_fn_entregas_parciais('12', 20, null, null)`)
await t('DEPOIS · janela do revogar (prévia)', `select public.plt_fn_entrega_parcial_previa(${PARCIAL})`)
await t('DEPOIS · janela da entrega parcial (abrir)', `select public.plt_fn_entrega_parcial_abrir(${UM_PEDIDO})`)
await t('DEPOIS · janela "Mover para o PCP" (prévia)', `select public.plt_fn_card_voltar_pcp_previa(${UMA_PECA})`)
await t('DEPOIS · Ficha do pedido entregue em parte', `select public.plt_fn_pcp_pedido_detalhe((select pedido_id from public.plt_cards where id = ${PARCIAL}))`)
await t('DEPOIS · Reabastecimento (quadro das reposições)', `select count(*) from public.plt_fn_pcp_quadro(10, 0, 'reposicao', null, null)`)

// os gestos (cada um numa transação desfeita)
const gesto = async (rotulo, sql) => {
  const v = []
  for (let i = 0; i < 5; i++) {
    await bd.exec('begin')
    const a = performance.now()
    try {
      await bd.query(sql)
      v.push(performance.now() - a)
    } catch (e) {
      console.log(`  ${rotulo}: ${e.message}`)
      await bd.exec('rollback')
      return
    }
    await bd.exec('rollback')
  }
  linha(rotulo, v)
}
await gesto('DEPOIS · gesto: revogar (remover da produção)', `select public.plt_fn_entrega_parcial_revogar(${PARCIAL}, 'k' || random())`)
await gesto('DEPOIS · gesto: Mover para o PCP (voltar)', `select public.plt_fn_card_voltar_pcp(${UMA_PECA}, 'voltar', null, 'teste', 'k' || random())`)
await plano('Entregas parciais — 1ª página', `select public.plt_fn_entregas_parciais(null, 20, null, null)`)
await plano('PCP — quadro, 1ª página', `select count(*) from public.plt_fn_pcp_quadro(10, 0, 'pedido', null, null)`)
console.log(`\nfim (${passou()})`)
process.exit(0)
