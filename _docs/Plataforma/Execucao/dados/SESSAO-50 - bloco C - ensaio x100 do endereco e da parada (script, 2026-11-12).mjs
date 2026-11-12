// SESSAO-50 · bloco C · ensaio ×100 (Lei de desempenho §1/§7.2/§12): a regra de "onde
// entregar" (plt_privado.vw_endereco_entrega) passou a preferir o endereço mudado na
// plataforma (uma junção pela chave com plt_pedido_enderecos) — TODA porta que a lê é
// medida ANTES × DEPOIS, ALTERNADAS na mesma conexão (A-209): as portas de ANTES, a
// visão de ANTES e a fn_parada_json de ANTES são copiadas para o esquema `antes50c`
// (o texto que o banco guarda, com outro nome) antes de a migration do bloco entrar.
// Mede-se a 6ª chamada e a mediana da 2ª em diante (8 chamadas de cada, intercaladas),
// o caso que a tela ABRE (E-246). Depois, a porta nova da janela e os gestos.
// Copiado e adaptado do ensaio da SESSAO-47 (o dia real da entrega).
// Banco PGlite GRAVADO EM DISCO (pasta nova a cada montagem — E-267) — o teto, não a média.
// Volume: produção de 23/10 × 100 — pedidos 562.700; cards ~95 mil; ~23 mil pedidos sem
// programação; 15 mil entregues com rota; + até 5.000 endereços mudados na plataforma (o
// volume de um mês inteiro de correções × 100) e 600 paradas avulsas.
// Uso: node <este arquivo> <raiz do repositório> <pasta NOVA do banco>
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
const NOVA = '20261112060000_plt_editar_endereco.sql'
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
const LEITURA = ['plt_fn_programacao_candidatos', 'plt_fn_programadas', 'plt_fn_entregas_do_dia', 'plt_fn_rotas',
                 'plt_fn_rotas_calendario', 'plt_fn_pcp_pedido_detalhe', 'plt_fn_devolucao_detalhe', 'plt_fn_paradas_avulsas']
await bd.exec(`create schema if not exists antes50c`)
const visao = (await bd.query(`select pg_get_viewdef('plt_privado.vw_endereco_entrega'::regclass) as d`)).rows[0].d
await bd.exec(`create view antes50c.vw_endereco_entrega as ${visao}`)
{
  const d = (await bd.query(`select pg_get_functiondef('plt_privado.fn_parada_json(public.plt_paradas_avulsas)'::regprocedure) as d`)).rows[0].d
  const copia = d.replace('FUNCTION plt_privado.fn_parada_json(', 'FUNCTION antes50c.fn_parada_json(')
  if (copia === d) throw new Error('não renomeei fn_parada_json')
  await bd.exec(copia)
}
for (const nome of LEITURA) {
  const defs = (await bd.query(`select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                 where n.nspname = 'public' and p.proname = '${nome}'`)).rows
  if (defs.length !== 1) throw new Error(`esperava uma ${nome}, achei ${defs.length}`)
  let copia = defs[0].def.replace(`FUNCTION public.${nome}(`, `FUNCTION antes50c.${nome}(`)
  if (copia === defs[0].def) throw new Error(`não renomeei ${nome}`)
  copia = copia.split('plt_privado.vw_endereco_entrega').join('antes50c.vw_endereco_entrega')
  copia = copia.split('plt_privado.fn_parada_json(').join('antes50c.fn_parada_json(')
  await bd.exec(copia)
}
console.log(`  a visão de onde entregar, a fn_parada_json e as ${LEITURA.length} portas que as leem, de ANTES, copiadas para antes50c (${passou()})`)

// ---------------------------------------------------------------- a migration do bloco C
{
  const a = performance.now()
  await bd.exec(await readFile(path.join(R, 'supabase/migrations', NOVA), 'utf8'))
  const ms = performance.now() - a
  const b = performance.now()
  await bd.exec(await readFile(path.join(R, 'supabase/migrations', NOVA), 'utf8'))
  console.log(`\n  a migration do bloco C aplicada em ${(ms / 1000).toFixed(1)} s; de novo (reaplicável) em ${((performance.now() - b) / 1000).toFixed(1)} s`)
}
// até 5.000 endereços mudados na plataforma (3.643 na montagem de 12/11 — a projeção direto; o gatilho é medido nos gestos):
// metade nos pedidos programados (a rota de hoje, Já programadas, as entregas do dia), metade
// nos sem programação (a aba Programar)
await bd.exec(`
  insert into public.plt_pedido_enderecos (pedido_id, endereco, numero, complemento, bairro, cidade, uf, cep,
                                           tiny_assinatura, tiny_original, escolha, evento_id, definido_por, definido_em)
  select x.pedido_id, 'Rua Mudada ' || x.k, (x.k % 900)::text, null, 'Bairro Novo', 'Natal', 'RN', '59000-001',
         md5(x.k::text), jsonb_build_object('endereco', 'Rua ' || x.k, 'fonte', 'cadastro'), 'plataforma', 1,
         (select id from public.plt_usuarios where usuario = 'dono.50x'), now()
    from (
      select pc.pedido_id, row_number() over (order by (pr.card_id is null), pc.id) as k
        from public.plt_cards pc
        left join public.plt_programacoes pr on pr.card_id = pc.id and pr.data_entrega >= current_date
       where pc.tipo = 'pedido' and pc.entrega_evento_id is null
    ) x
   where x.k <= ${Math.round(N.enderecos / 2)} or (x.k % 7 = 0 and x.k <= ${N.enderecos * 4})
   limit ${N.enderecos};
  analyze;
`)
const nEnd = (await bd.query(`select count(*)::int as n from public.plt_pedido_enderecos`)).rows[0].n
console.log(`  endereços mudados na plataforma: ${nEnd.toLocaleString('pt-BR')} (${passou()})`)

// ---------------------------------------------------------------- ANTES × DEPOIS alternados
const como = (auth) => bd.exec(`select set_config('request.jwt.claim.sub', '${auth}', false)`)
await como(ADM)
const tabela = []
const ab = async (rotulo, sql, vezes = 8, extrair = null) => {
  const antigo = sql.replace(/public\.(plt_fn_[a-z_]+)\(/, 'antes50c.$1(')
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
  tabela.push([rotulo, a[5], n[5], ma, mn, dif])
  console.log(`  ${rotulo.padEnd(56)} 6ª: antes ${a[5].toFixed(1).padStart(8)} · depois ${n[5].toFixed(1).padStart(8)} ms | mediana 2ª+: antes ${ma.toFixed(1).padStart(8)} · depois ${mn.toFixed(1).padStart(8)} ms · ${(dif >= 0 ? '+' : '') + dif.toFixed(0)}%${extrair ? ' · ' + extrair(rn) : ''}`)
  console.log(`      antes  (ms): ${lista(a)}`)
  console.log(`      depois (ms): ${lista(n)}`)
}
const PED_COM = (await bd.query(`select pe.pedido_id::int as p, pc.id::int as c from public.plt_pedido_enderecos pe
                                   join public.plt_cards pc on pc.pedido_id = pe.pedido_id and pc.tipo = 'pedido'
                                  order by pe.pedido_id limit 1`)).rows[0]
const PED_SEM = (await bd.query(`select pc.pedido_id::int as p from public.plt_cards pc where pc.tipo = 'pedido'
                                    and not exists (select 1 from public.plt_pedido_enderecos pe where pe.pedido_id = pc.pedido_id)
                                  order by pc.id limit 1`)).rows[0].p
const comSelo = (r) => {
  const itens = r.rows[0].c.itens
  return `${itens.length} itens · ${itens.filter((i) => i.endereco_plataforma).length} com o selo · total ${r.rows[0].c.total}`
}

console.log(`\n== ANTES × DEPOIS, alternados na mesma conexão (8 de cada; a 6ª e a mediana da 2ª em diante) ==`)
await ab('Programar — sem filtro (200, o que a aba abre)', `select public.plt_fn_programacao_candidatos(null, null, null, null, null, null, 200) as c`, 8, comSelo)
await ab('Programar — cidade "Natal" (200)', `select public.plt_fn_programacao_candidatos(null, null, 'Natal', null, null, null, 200) as c`, 6, comSelo)
await ab('Já programadas — por entregar (50, a 1ª página)', `select * from public.plt_fn_programadas(false, null, null, 50, 0, null)`, 8, (r) => `${r.rows.length} linhas · total ${r.rows[0]?.contagem_total ?? 0}`)
await ab('Já programadas — a busca "Mudada" (50)', `select * from public.plt_fn_programadas(false, null, null, 50, 0, 'Mudada')`, 8, (r) => `${r.rows.length} linhas`)
await ab('Entregas do dia — HOJE (caminhão 1, rota 1)', `select public.plt_fn_entregas_do_dia('${HOJE}', ${CAM}, 1) as e`, 8, (r) => `${r.rows[0].e.entregas.length} paradas · ${(r.rows[0].e.paradas_avulsas ?? []).length} avulsas`)
await ab('ROTAS → Entregas, a entregar (20)', `select * from public.plt_fn_rotas('pronta', null, 20, 0)`, 8, (r) => `${r.rows.length} linhas`)
await ab('ROTAS → Entregues (20)', `select * from public.plt_fn_rotas('entregue', null, 20, 0)`, 8, (r) => `${r.rows.length} linhas`)
await ab('Calendário — a semana que abre', `select public.plt_fn_rotas_calendario(date '${HOJE}' - 3, date '${HOJE}' + 3, 30, 0) as c`, 8, (r) => `${r.rows[0].c.dias.length} dias`)
await ab('Ficha do pedido — com endereço mudado', `select public.plt_fn_pcp_pedido_detalhe(${PED_COM.p}) as f`, 8, (r) => (r.rows[0].f.endereco_plataforma ? 'com o selo' : 'sem o selo'))
await ab('Ficha do pedido — sem endereço mudado', `select public.plt_fn_pcp_pedido_detalhe(${PED_SEM}) as f`, 8, (r) => (r.rows[0].f.endereco_plataforma ? 'com o selo' : 'sem o selo'))
await ab('Decisão da devolução (o detalhe)', `select public.plt_fn_devolucao_detalhe(${PED_COM.c}) as d`, 8)
await ab('Paradas avulsas do período (5 dias — Já programadas)', `select public.plt_fn_paradas_avulsas('${HOJE}', date '${HOJE}' + 4) as l`, 8, (r) => `${r.rows[0].l.length} paradas`)

// ---------------------------------------------------------------- a porta nova e os gestos (só DEPOIS)
console.log(`\n== a porta nova da janela e os gestos (só depois) ==`)
{
  const v = []
  for (let i = 0; i < 8; i++) { const t = performance.now(); await bd.query(`select public.plt_fn_pedido_endereco(${PED_COM.p}) as j`); v.push(performance.now() - t) }
  console.log(`  ${'Janela "Editar endereço" — a leitura ao abrir'.padEnd(56)} 6ª ${v[5].toFixed(1)} ms · mediana 2ª+ ${med(v.slice(1))[0].toFixed(1)} ms · cada: ${lista(v)}`)
}
const gesto = async (rotulo, sqls) => {
  const v = []
  for (const s of sqls) { const t = performance.now(); await bd.query(s); v.push(performance.now() - t) }
  linha(rotulo, v, ` · cada: ${lista(v)}`)
}
const semEndereco = (await bd.query(`select pc.pedido_id::int as p from public.plt_cards pc
                                       where pc.tipo = 'pedido' and pc.entrega_evento_id is null
                                         and not exists (select 1 from public.plt_pedido_enderecos pe where pe.pedido_id = pc.pedido_id)
                                       order by pc.id desc limit 5`)).rows.map((r) => r.p)
const novo = (k) => `'{"endereco":"Rua do Ensaio ${k}","numero":"${k}","bairro":"Centro","cidade":"Natal","uf":"RN","cep":"59000-${String(k).padStart(3, '0')}"}'::jsonb`
await gesto('GESTO: salvar o endereço novo só na plataforma (5 pedidos)', semEndereco.map((p, i) => `select public.plt_fn_pedido_endereco_salvar(${p}, ${novo(i + 1)}) as r`))
await gesto('GESTO: o mesmo endereço de novo — nada muda (5 pedidos)', semEndereco.map((p, i) => `select public.plt_fn_pedido_endereco_salvar(${p}, ${novo(i + 1)}) as r`))
await gesto('GESTO: salvar com o pino (o ponto manual da chave nova) (5 pedidos)', semEndereco.map((p, i) => `select public.plt_fn_pedido_endereco_salvar(${p}, ${novo(i + 11)}, -5.8, -35.2) as r`))
await gesto('GESTO: voltar ao endereço original (5 pedidos)', semEndereco.map((p) => `select public.plt_fn_pedido_endereco_restaurar(${p}) as r`))
const paradasHoje = (await bd.query(`select id::int as id from public.plt_paradas_avulsas where situacao = 'pendente' and removida_em is null order by id limit 5`)).rows.map((r) => r.id)
await gesto('GESTO: editar a parada avulsa (endereço e pino) (5 paradas)', paradasHoje.map((id) =>
  `select public.plt_fn_parada_avulsa_salvar(${id}, '${HOJE}', ${CAM}, 1, 'Buscar material editado', 'Av. Senador Salgado Filho, ${id}, Natal', -5.81, -35.21, null) as r`))
// o Tiny gravando o pedido: sem mudar o endereço (o gatilho nem acorda) × mudando o endereço de entrega
// de um pedido com endereço da plataforma (a conferência roda e o sino avisa)
await como('')
const doTiny = (await bd.query(`select p.id::int as id, p.numero, p.tiny_id::text as tiny from public.pedidos p
                                  join public.plt_pedido_enderecos pe on pe.pedido_id = p.id order by p.id limit 5`)).rows
await gesto('TINY: o pedido regravado sem mudar o endereço (o gatilho não acorda) (5)', doTiny.map((p) =>
  `update public.pedidos set obs = coalesce(obs, '') || '.' where id = ${p.id}`))
await gesto('TINY: o endereço de entrega mudou no Tiny (vale o do Tiny + aviso) (5)', doTiny.map((p, i) =>
  `update public.pedidos set endereco_entrega = jsonb_build_object('endereco', 'Avenida do Tiny ${i}', 'numero', '1', 'bairro', 'Tirol', 'cidade', 'Natal', 'uf', 'RN') where id = ${p.id}`))
await como(ADM)

// ---------------------------------------------------------------- o plano da junção nova
await plano('a regra de onde entregar para os ~23 mil sem programação (ANTES)',
  `select count(ee.endereco) from plt_privado.vw_pedidos_para_rota v left join antes50c.vw_endereco_entrega ee on ee.pedido_id = v.pedido_id where v.programacao_data is null`)
await plano('a regra de onde entregar para os ~23 mil sem programação (DEPOIS — com a junção pela chave)',
  `select count(ee.endereco) from plt_privado.vw_pedidos_para_rota v left join plt_privado.vw_endereco_entrega ee on ee.pedido_id = v.pedido_id where v.programacao_data is null`)
await plano('um pedido (a ficha, a janela) — DEPOIS', `select * from plt_privado.vw_endereco_entrega where pedido_id = ${PED_COM.p}`)

console.log(`\n== resumo (ms) ==`)
for (const [r, a6, n6, ma, mn, d] of tabela)
  console.log(`  ${r.padEnd(56)} 6ª ${a6.toFixed(0).padStart(6)} → ${n6.toFixed(0).padStart(6)} · mediana ${ma.toFixed(0).padStart(6)} → ${mn.toFixed(0).padStart(6)} (${(d >= 0 ? '+' : '') + d.toFixed(0)}%)`)
await bd.close()
console.log(`\nfim (${passou()})`)
process.exit(0)
