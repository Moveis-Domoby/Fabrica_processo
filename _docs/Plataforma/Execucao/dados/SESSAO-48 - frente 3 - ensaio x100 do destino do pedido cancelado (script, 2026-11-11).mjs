// Ensaio ×100 da SESSAO-48 · frente 3 (Lei de desempenho §1/§7.2): a janela "Para
// onde vai este móvel?" (plt_fn_destino_pendentes — UMA leitura ao abrir), a decisão
// (plt_fn_destino_decidir — o gesto) e o cancelamento do Tiny com peças em produção (a
// reação que marca as peças e manda o aviso). Volume ×100 do retrato da fábrica (5.627
// pedidos, ~37 no PCP) e o pior caso que se espera: o pedido cancelado com 30 peças de
// 10 móveis (o 13622 tinha 31), um móvel MUITO vendido (em 1 de cada 7 pedidos) e metade
// dos pedidos da fila do PCP com a vaga dele já coberta (a procura precisa pular).
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
  liberados: Math.round(400 * X),
  eventos: Math.round(1400 * X),
}
await rm(PASTA, { recursive: true, force: true })
const bd = new PGlite(PASTA, { extensions: { pg_trgm } })

const med = (v) => { const s = [...v].sort((a, b) => a - b); return [s[Math.floor(s.length / 2)], s[s.length - 1]] }
const linha = (rotulo, v, extra = '') => {
  const [m, x] = med(v)
  console.log(`  ${rotulo.padEnd(78)} mediana ${m.toFixed(1).padStart(7)} ms · máx ${x.toFixed(1).padStart(7)} ms · 6ª ${v[v.length - 1].toFixed(1).padStart(7)} ms${extra}`)
}
const t = async (rotulo, sql, vezes = 6, extrair = null) => {
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

const a0 = performance.now()
const passou = () => `${((performance.now() - a0) / 1000).toFixed(0)} s`
console.log(`== montando o banco em disco (×${X}: pedidos ${N.pedidos.toLocaleString('pt-BR')}) ==`)
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

const ADM = '00000000-0000-0000-0000-000000004831'
const setor = async (c) => (await bd.query(`select id::int as id from public.plt_setores where codigo = '${c}'`)).rows[0].id
const [PCP, LIMPEZA, MONTAGEM, FURACAO] = [await setor('pcp'), await setor('limpeza_embalagem'), await setor('montagem'), await setor('furacao')]
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id, modulos) values
    ('Dono 483', 'dono483@x.com', '48319000091', 'dono.483x', 'admin', '${ADM}', array['fabrica']);
  insert into public.plt_etapas (setor_id, nome, ordem, eh_fila)
  select s, e.nome, e.ordem, e.ordem = 10
    from unnest(array[${LIMPEZA}, ${MONTAGEM}, ${FURACAO}]) s,
         (values ('A FAZER', 10), ('FAZENDO', 20), ('CONFERIR', 30), ('PRONTO', 60)) e(nome, ordem);
  insert into public.plt_etapas (setor_id, nome, ordem, eh_fila, cancela_fabricacao, cancela_motivo)
    values (${LIMPEZA}, 'CANCELADO', 90, false, true, 'cancelada');
`)
await bd.exec(`set session_replication_role = replica`) // a semeadura não dispara gatilho
await bd.exec(`
  insert into public.clientes (nome, endereco, numero, bairro, cidade, uf, cep)
  select 'Cliente ' || g, 'Rua ' || g, (g % 900)::text, 'Bairro ' || (g % 50), 'Natal', 'RN', '59000-000' from generate_series(1, 5000) g;
  insert into public.pedidos (numero, situacao, origem, tiny_id, data_pedido, data_prevista, cliente_id)
  select g, case when g % 50 = 3 then 'Cancelado' when g % 13 = 0 then 'Entregue' else 'Preparando envio' end,
         'webhook', 900000000 + g, date '2025-01-01' + (g % 600), date '2026-11-20' + (g % 40),
         (select min(id) from public.clientes) + (g % 5000)
    from generate_series(1, ${N.pedidos}) g;
  -- os produtos (SKU0…SKU299) e 2 itens por pedido; o SKU1 é o móvel muito vendido (1 em cada 7 pedidos)
  insert into public.produtos (tiny_id, codigo, descricao, classe, situacao, unidade)
  select 7000000 + k, 'SKU' || k, 'Móvel ' || k, 'F', 'A', 'un' from generate_series(0, 299) k;
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
  select p.id, 1, case when p.numero % 7 = 0 then 'SKU1' else 'SKU' || (2 + p.numero % 298) end,
         case when p.numero % 7 = 0 then 'Móvel 1' else 'Móvel ' || (2 + p.numero % 298) end, 2
    from public.pedidos p;
  insert into public.pedido_itens (pedido_id, seq, codigo, descricao, quantidade)
  select p.id, 2, 'SKU' || ((p.numero * 7) % 300), 'Móvel ' || ((p.numero * 7) % 300), 1
    from public.pedidos p;
`)
console.log(`  pedidos e itens (${passou()})`)
// os cards dos pedidos: a fila do PCP (1 em cada 150 pedidos ≈ 3.750, aguardando liberação) e os liberados
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, setor_atual_id, desde)
  select 'pedido', p.id, ${PCP}, now() - (p.numero % 300) * interval '1 hour'
    from public.pedidos p where p.numero % 150 = 1;
  insert into public.plt_cards (tipo, pedido_id, setor_atual_id, desde, liberado_completo_em, arquivado_em)
  select 'pedido', p.id, ${PCP}, now() - interval '20 days', now() - interval '19 days',
         case when p.numero % 3 = 0 then now() - interval '5 days' end
    from public.pedidos p where p.numero % 150 between 2 and 2 + ${Math.max(1, Math.round(N.liberados / (N.pedidos / 150)))} - 1;
  -- metade dos pedidos da fila com o SKU1 já tem a vaga do SKU1 coberta (as 2 peças em produção)
  insert into public.plt_cards (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao, indice_unidade,
                                total_unidades, setor_atual_id, desde)
  select 'unidade', pc.pedido_id, pc.id, 1, 'SKU1', 'Móvel 1', k, 2, ${MONTAGEM}, now() - interval '3 hours'
    from public.plt_cards pc join public.pedidos p on p.id = pc.pedido_id, generate_series(1, 2) k
   where pc.tipo = 'pedido' and pc.liberado_completo_em is null and p.numero % 7 = 0 and p.numero % 2 = 0;
`)
// o pedido cancelado do ensaio: 30 peças em produção de 10 móveis (o SKU1 + 9 outros), esperando decisão
const CANC = (await bd.query(`select min(numero)::int as n from public.pedidos where situacao = 'Cancelado' and numero > 100000`)).rows[0].n
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, setor_atual_id, desde)
  select 'pedido', p.id, ${PCP}, now() - interval '9 days' from public.pedidos p where p.numero = ${CANC};
  insert into public.plt_cards (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao, indice_unidade,
                                total_unidades, setor_atual_id, etapa_atual_id, desde, destino_pendente_em)
  select 'unidade', p.id, pc.id, 1 + (k - 1) / 3, 'SKU' || (1 + (k - 1) / 3), 'Móvel ' || (1 + (k - 1) / 3),
         1 + (k - 1) % 3, 3,
         case k % 3 when 0 then ${MONTAGEM} when 1 then ${FURACAO} else ${LIMPEZA} end,
         (select e.id from public.plt_etapas e where e.setor_id = case k % 3 when 0 then ${MONTAGEM} when 1 then ${FURACAO} else ${LIMPEZA} end
           order by e.ordem limit 1),
         now() - interval '2 hours', now() - interval '1 hour'
    from public.pedidos p join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido', generate_series(1, 30) k
   where p.numero = ${CANC};
  insert into public.plt_eventos (card_id, tipo, origem, observacao)
  select pc.id, 'pedido_cancelado', 'automacao', 'Pedido cancelado no Tiny.'
    from public.plt_cards pc join public.pedidos p on p.id = pc.pedido_id where pc.tipo = 'pedido' and p.numero = ${CANC};
  insert into public.plt_eventos (card_id, tipo, origem, evento_referencia_id, dados)
  select u.id, 'destino_pendente', 'automacao',
         (select max(e.id) from public.plt_eventos e where e.tipo = 'pedido_cancelado'),
         jsonb_build_object('pedido_id', u.pedido_id)
    from public.plt_cards u join public.pedidos p on p.id = u.pedido_id where u.tipo = 'unidade' and p.numero = ${CANC};
  -- fatos soltos (a tabela de fatos no tamanho ×100)
  insert into public.plt_eventos (card_id, tipo, origem, observacao)
  select (select min(id) from public.plt_cards) + (g % 1000), 'comentario_adicionado', 'api', 'fato ' || g
    from generate_series(1, ${N.eventos}) g;
`)
await bd.exec(`set session_replication_role = origin; analyze;`)
const tam = (await bd.query(`
  select (select count(*) from public.pedidos)::int as pedidos, (select count(*) from public.pedido_itens)::int as itens,
         (select count(*) from public.plt_cards)::int as cards, (select count(*) from public.plt_eventos)::int as eventos,
         (select count(*) from public.plt_cards where tipo = 'pedido' and liberado_completo_em is null and arquivado_em is null)::int as fila,
         (select count(*) from public.plt_cards pc join public.pedidos p on p.id = pc.pedido_id
           where pc.tipo = 'pedido' and pc.liberado_completo_em is null and p.numero % 7 = 0)::int as fila_sku1,
         (select id from public.plt_cards pc where pc.tipo = 'pedido' and pc.pedido_id = (select id from public.pedidos where numero = ${CANC}))::int as card_canc`)).rows[0]
console.log(`  pedidos ${tam.pedidos.toLocaleString('pt-BR')} · itens ${tam.itens.toLocaleString('pt-BR')} · cards ${tam.cards.toLocaleString('pt-BR')} · fatos ${tam.eventos.toLocaleString('pt-BR')} · fila do PCP ${tam.fila.toLocaleString('pt-BR')} (com o móvel muito vendido: ${tam.fila_sku1}) · pedido cancelado ${CANC} com 30 peças esperando (${passou()})`)

const CARD = tam.card_canc
await bd.exec(`select set_config('request.jwt.claim.sub', '${ADM}', false)`)
console.log('\n== a janela (UMA leitura ao abrir) ==')
await t('plt_fn_destino_pendentes — 30 peças, 10 móveis (o muito vendido entre eles)',
  `select public.plt_fn_destino_pendentes(${CARD}) as d`, 6,
  (r) => { const d = r.rows[0].d; return `${d.pecas.length} peças · ${Object.keys(d.candidatos).length} móveis com candidato · ${Object.values(d.candidatos).reduce((s, l) => s + l.length, 0)} candidatos · ${JSON.stringify(d).length.toLocaleString('pt-BR')} bytes` })
// o caso típico: um cancelado com 3 peças do móvel muito vendido
const CANC2 = (await bd.query(`select min(p.numero)::int as n from public.pedidos p
                                where p.situacao = 'Cancelado' and p.numero > 300000
                                  and not exists (select 1 from public.plt_cards c where c.pedido_id = p.id)`)).rows[0].n
await bd.exec(`
  set session_replication_role = replica;
  insert into public.plt_cards (tipo, pedido_id, setor_atual_id, desde)
  select 'pedido', p.id, ${PCP}, now() - interval '3 days' from public.pedidos p where p.numero = ${CANC2};
  insert into public.plt_cards (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao, indice_unidade,
                                total_unidades, setor_atual_id, desde, destino_pendente_em)
  select 'unidade', p.id, pc.id, 1, 'SKU1', 'Móvel 1', k, 3, ${MONTAGEM}, now() - interval '2 hours', now() - interval '1 hour'
    from public.pedidos p join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido', generate_series(1, 3) k
   where p.numero = ${CANC2};
  set session_replication_role = origin;
  analyze public.plt_cards;`)
const CARD2 = (await bd.query(`select pc.id::int as id from public.plt_cards pc join public.pedidos p on p.id = pc.pedido_id
                                 where pc.tipo = 'pedido' and p.numero = ${CANC2}`)).rows[0].id
await t('plt_fn_destino_pendentes — 3 peças do móvel muito vendido (o caso típico)',
  `select public.plt_fn_destino_pendentes(${CARD2}) as d`, 6,
  (r) => { const d = r.rows[0].d; return `${d.pecas.length} peças · ${Object.values(d.candidatos).reduce((s, l) => s + l.length, 0)} candidatos` })
// as partes: a fila do PCP com os móveis (o miolo da procura — uma passada só)
await plano('a fila do PCP × os itens com algum dos 10 móveis', `
  select pc.id, pi.codigo
    from public.plt_cards pc
    join public.pedido_itens pi on pi.pedido_id = pc.pedido_id
   where pc.tipo = 'pedido' and pc.liberado_completo_em is null and pc.arquivado_em is null
     and pc.setor_atual_id in (select s.id from public.plt_setores s where s.papel_no_fluxo = 'entrada')
     and pc.entrega_evento_id is null
     and pi.codigo in (select 'SKU' || k from generate_series(1, 10) k)`)
await t('as partes: a fila × os itens dos 10 móveis, sozinha', `
  select count(*) from public.plt_cards pc
    join public.pedido_itens pi on pi.pedido_id = pc.pedido_id
   where pc.tipo = 'pedido' and pc.liberado_completo_em is null and pc.arquivado_em is null
     and pc.setor_atual_id in (select s.id from public.plt_setores s where s.papel_no_fluxo = 'entrada')
     and pc.entrega_evento_id is null
     and pi.codigo in (select 'SKU' || k from generate_series(1, 10) k)`, 6)
const umaFila = (await bd.query(`select pc.pedido_id::int as p from public.plt_cards pc
                                  where pc.tipo = 'pedido' and pc.liberado_completo_em is null order by pc.id limit 1`)).rows[0].p
await t('as partes: fn_vagas_pedido de UM pedido da fila (o custo de cada candidato)',
  `select count(*) from plt_privado.fn_vagas_pedido(${umaFila})`, 6)

console.log('\n== a decisão (o gesto; cada uma desfeita depois) ==')
const pecas = (await bd.query(`select id::int as id, item_codigo from public.plt_cards where card_pai_id = ${CARD} and tipo = 'unidade' order by id`)).rows
const alvo = (await bd.query(`select public.plt_fn_destino_pendentes(${CARD}) -> 'candidatos' -> 'p:7000001' -> 0 ->> 'pedido_id' as p`)).rows[0].p
const gesto = async (rotulo, decisoes) => {
  const v = []
  for (let i = 0; i < 6; i++) {
    await bd.exec('begin')
    const a = performance.now()
    await bd.query(`select public.plt_fn_destino_decidir(${CARD}, '${JSON.stringify(decisoes)}'::jsonb)`)
    v.push(performance.now() - a)
    await bd.exec('rollback')
  }
  linha(rotulo, v)
}
await gesto('seguir para o estoque — 1 peça', [{ peca_id: pecas[3].id, destino: 'estoque' }])
await gesto('passar para outro pedido — 1 peça do móvel muito vendido', [{ peca_id: pecas[0].id, destino: 'outro_pedido', pedido_id: Number(alvo) }])
await gesto('cancelar a fabricação — 1 peça (vai para o CANCELADO da LIMPEZA)', [{ peca_id: pecas[4].id, destino: 'cancelar' }])
await gesto('todas de uma vez — as 30 peças seguem para o estoque', pecas.map((p) => ({ peca_id: p.id, destino: 'estoque' })))

console.log('\n== o cancelamento do Tiny (a reação que marca e avisa) ==')
// um pedido vivo com 10 peças em produção: o Tiny cancela (desfeito depois)
const VIVO = (await bd.query(`select min(numero)::int as n from public.pedidos where situacao = 'Preparando envio' and numero > 200000 and numero % 150 = 1`)).rows[0].n
await bd.exec(`
  insert into public.plt_cards (tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao, indice_unidade, total_unidades, setor_atual_id, desde)
  select 'unidade', p.id, pc.id, 1, 'SKU5', 'Móvel 5', k, 10, ${MONTAGEM}, now()
    from public.pedidos p join public.plt_cards pc on pc.pedido_id = p.id and pc.tipo = 'pedido', generate_series(1, 10) k
   where p.numero = ${VIVO};`)
const v = []
for (let i = 0; i < 6; i++) {
  await bd.exec('begin')
  const a = performance.now()
  await bd.exec(`update public.pedidos set situacao = 'Cancelado' where numero = ${VIVO}`)
  v.push(performance.now() - a)
  if (i === 0) {
    const n = (await bd.query(`select count(*)::int as n from public.plt_cards u join public.pedidos p on p.id = u.pedido_id
                                where p.numero = ${VIVO} and u.destino_pendente_em is not null`)).rows[0].n
    console.log(`  (conferência: ${n} peças esperando decisão)`)
  }
  await bd.exec('rollback')
}
linha('o Tiny cancela um pedido com 10 peças em produção (a gravação inteira)', v)
await bd.close()
console.log(`\nfim (${passou()})`)
process.exit(0)
