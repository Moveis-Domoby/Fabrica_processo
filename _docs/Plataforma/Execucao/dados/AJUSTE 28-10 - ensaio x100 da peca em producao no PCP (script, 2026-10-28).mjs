// Ensaio ×100 do AJUSTE de 28/10 (D-201 — Lei de desempenho §1/§7.2): a janela de
// liberação do PCP (plt_fn_pcp_liberacao) ganhou `em_producao` — a peça igual SEM
// DONO que ainda está em produção (reposição de estoque, ou pedido cancelado que
// segue em produção) — e a liberação ganhou a ligação (plt_fn_pcp_liberar com
// peca_producao_id). ANTES (até os filtros da Programação) × DEPOIS (as duas de
// 28/10) no MESMO banco. Semeadura copiada do ensaio dos filtros da 41 + as peças
// sem dono em produção e os pedidos cancelados com peça em produção.
// Banco PGlite GRAVADO EM DISCO — os números são o teto, não a média de produção.
// Uso: node <este arquivo> <raiz do repositório> <pasta do banco>
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
const migs = todas.filter((f) => f <= '20261027999999')
const novas = todas.filter((f) => f > '20261027999999')
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
await bd.exec(`
  -- 2% dos pedidos cancelados no Tiny: as peças deles em produção seguem lá (D-61)
  update public.pedidos set situacao = 'Cancelado' where numero % 50 = 3;
  -- o móvel dos pedidos aguardando no PCP no catálogo (o SKU1)
  insert into public.produtos (tiny_id, codigo, descricao, classe, situacao, unidade)
    values (7100001, 'SKU1', 'Estante Basic 5 nichos - Branca', 'F', 'A', 'un');
  -- as reposições já liberadas, com as 3 peças em produção, sem dono: 10 do SKU1 e 5 de cada PX
  insert into public.plt_cards (tipo, produto_tiny_id, item_codigo, item_descricao, total_unidades, setor_atual_id, desde, liberado_completo_em, chave_criacao)
  select 'reposicao', p.tiny_id, p.codigo, p.descricao, 3, ${PCP}, now() - interval '3 days', now() - interval '2 days', gen_random_uuid()
    from public.produtos p, generate_series(1, case when p.tiny_id = 7100001 then 10 else 5 end) g
   where p.tiny_id = 7100001 or p.tiny_id between 7000001 and 7000200;
  insert into public.plt_cards (tipo, produto_tiny_id, card_pai_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades,
                                setor_atual_id, etapa_atual_id, desde)
  select 'unidade', rc.produto_tiny_id, rc.id, 1, rc.item_codigo, rc.item_descricao, k, 3,
         case when k = 1 then ${MONTAGEM} else ${FURACAO} end,
         (select e.id from public.plt_etapas e where e.setor_id = case when k = 1 then ${MONTAGEM} else ${FURACAO} end order by e.ordem offset (rc.id % 4) limit 1),
         now() - (rc.id % 200) * interval '1 hour'
    from public.plt_cards rc, generate_series(1, 3) k
   where rc.tipo = 'reposicao' and rc.liberado_completo_em is not null;
`)
await bd.exec(`set session_replication_role = origin; analyze;`)
const tam = (await bd.query(`select (select count(*) from public.plt_cards)::int as cards, (select count(*) from public.plt_eventos)::int as eventos,
  (select count(*) from public.plt_cards where setor_atual_id = ${LIMPEZA} and arquivado_em is null)::int as limpeza,
  (select count(*) from public.plt_cards where setor_atual_id = ${PCP} and tipo = 'pedido' and liberado_completo_em is null)::int as pcp,
  (select count(*) from public.plt_cards where tipo = 'unidade' and pedido_id is null and arquivado_em is null)::int as sem_dono,
  (select count(*) from public.plt_cards c join public.pedidos p on p.id = c.pedido_id where c.tipo = 'unidade' and c.arquivado_em is null and p.situacao = 'Cancelado' and c.item_codigo = 'SKU1')::int as canc_sku1`)).rows[0]
console.log(`  cards ${tam.cards.toLocaleString('pt-BR')} · eventos ${tam.eventos.toLocaleString('pt-BR')} · vivos na LIMPEZA ${tam.limpeza.toLocaleString('pt-BR')} · pedidos aguardando no PCP ${tam.pcp.toLocaleString('pt-BR')} · peças sem dono ${tam.sem_dono.toLocaleString('pt-BR')} · do SKU1 em pedido cancelado ${tam.canc_sku1} (${passou()})`)

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
// 1% dos pedidos com a data mudada na plataforma e 2 paradas por rota (como no ensaio da 41)
await bd.exec(`
  insert into public.plt_pedido_datas (pedido_id, data, tiny_data)
  select p.id, p.data_prevista + 3, p.data_prevista from public.pedidos p where p.numero % 100 = 7;
  insert into public.plt_paradas_avulsas (data_entrega, caminhao_id, rota, ordem, titulo, endereco, criada_por)
  select current_date + (g % 5), (select min(id) from public.plt_caminhoes) + (g % 3), 1 + (g % 2), 1000 + g, 'Parada ' || g, 'Rua ' || g,
         (select id from public.plt_usuarios where usuario = 'dono.41x')
    from generate_series(1, 60) g;
  analyze;
`)


const LOG = '00000000-0000-0000-0000-000000004093'
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id, modulos)
    values ('PCP 28', 'pcp28@x.com', '42819000093', 'pcp.28x', 'logistica', '${LOG}', array['fabrica']);
  insert into public.plt_usuario_setores (usuario_id, setor_id)
    values ((select id from public.plt_usuarios where usuario = 'pcp.28x'), ${PCP});
`)
// o pedido aguardando no PCP (2 estantes SKU1): o mais antigo e um do meio
const cards = (await bd.query(`select id::int as id from public.plt_cards where tipo = 'pedido' and liberado_completo_em is null order by id`)).rows
const PC = cards[0].id
const PC2 = cards[Math.floor(cards.length / 2)].id
const resumo = (r) => {
  const j = r.rows[0].j
  return `${j.itens.length} itens · ${j.sugestoes.length} do estoque · ${(j.em_producao ?? []).length} em produção`
}
async function medir(fase) {
  await como(ADM)
  console.log(`\n== ${fase} ==`)
  await t('Janela de liberação do pedido (o mais antigo)', `select public.plt_fn_pcp_liberacao(${PC}) as j`, 7, resumo)
  await t('Janela de liberação do pedido (um do meio)', `select public.plt_fn_pcp_liberacao(${PC2}) as j`, 7, resumo)
  const rep = (await bd.query(`select id::int as id from public.plt_cards where tipo = 'reposicao' and produto_tiny_id = 7100001 order by id limit 1`)).rows[0].id
  await t('Janela de liberação da reposição', `select public.plt_fn_pcp_liberacao(${rep}) as j`, 7, (r) => `${r.rows[0].j.ja_liberadas.length} já liberadas`)
  if (!fase.startsWith('DEPOIS')) return
  await como(LOG)
  const j = (await bd.query(`select public.plt_fn_pcp_liberacao(${PC}) as j`)).rows[0].j
  const s = j.em_producao[0]
  const v = []
  for (let i = 0; i < 5; i++) {
    await bd.exec('begin')
    const a = performance.now()
    const r = await bd.query(`select public.plt_fn_pcp_liberar(${PC}, '${JSON.stringify([{ item_seq: s.item_seq, indice_unidade: s.indice_unidade, peca_producao_id: s.peca_card_id }])}'::jsonb) as r`)
    v.push(performance.now() - a)
    if (i === 0) console.log(`  (ligação: ${JSON.stringify(r.rows[0].r)} · a peça estava em ${s.setor_nome} · ${s.peca_origem})`)
    await bd.exec('rollback')
  }
  linha('Liberar ligando 1 peça em produção (o gesto inteiro, numa transação)', v)
  await como(ADM)
  await plano('A conta das peças em produção, sozinha', `select * from plt_privado.fn_sugestoes_em_producao(${PC}, '[]'::jsonb)`)
}

await medir('ANTES (até os filtros da Programação)')
for (const f of novas) await bd.exec(await readFile(path.join(R, 'supabase/migrations', f), 'utf8'))
console.log(`\n  ${novas.length} migration(s) do ajuste aplicada(s): ${novas.join(', ')}`)
await bd.exec('analyze')
await medir('DEPOIS (o ajuste de 28/10)')
await bd.close()
console.log(`\nfim (${passou()})`)
