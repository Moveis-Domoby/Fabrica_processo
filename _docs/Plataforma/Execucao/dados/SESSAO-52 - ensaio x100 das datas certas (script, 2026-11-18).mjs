// SESSAO-52 · ensaio ×100 (Lei de desempenho §1/§7.2/§12): as portas que a migration 20261118100000 toca
// — a busca geral, o detalhe da devolução — ANTES × DEPOIS no MESMO banco, alternados na mesma conexão
// (A-209/A-229), e a porta nova da lista de Pedidos (plt_fn_pedidos_pagina) contra a lista de sempre
// (plt_fn_pedidos_lista, que ela chama). Montado a partir do ensaio da 51.
// Banco PGlite GRAVADO EM DISCO — os números são o teto, não a média de produção.
// Uso: node <este arquivo> <raiz do repositório> <pasta NOVA do banco (E-267)>  (ESCALA=1 primeiro — E-273)
import { readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [R, PASTA] = process.argv.slice(2)
const { PGlite } = await import(pathToFileURL(path.join(R, 'node_modules/@electric-sql/pglite/dist/index.js')).href)
const { pg_trgm } = await import(pathToFileURL(path.join(R, 'node_modules/@electric-sql/pglite/dist/contrib/pg_trgm.js')).href)
const X = Number(process.env.ESCALA ?? 100)
const NOVA = '20261118100000_plt_datas_e_textos_certos.sql'
const N = {
  pedidos: Math.round(5627 * X),
  vivosLimpeza: Math.round(63 * X),
  vivosMontagem: Math.round(41 * X),
  vivosOutros: Math.round(100 * X),
  arquivados: Math.round(455 * X),
  pcp: Math.round(37 * X),
}
await rm(PASTA, { recursive: true, force: true })
const bd = new PGlite(PASTA, { extensions: { pg_trgm } })

const med = (v) => { const s = [...v].sort((a, b) => a - b); return [s[Math.floor(s.length / 2)], s[s.length - 1]] }
const lista = (v) => v.map((x) => x.toFixed(0)).join(' · ')
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
const migs = todas.filter((f) => f < NOVA)
for (const f of migs) await bd.exec(await readFile(path.join(R, 'supabase/migrations', f), 'utf8'))
console.log(`  ${migs.length} migrations aplicadas (a última: ${migs[migs.length - 1]}) (${passou()})`)

const ADM = '00000000-0000-0000-0000-000000005291'
const setor = async (c) => (await bd.query(`select id::int as id from public.plt_setores where codigo = '${c}'`)).rows[0].id
const [PCP, LIMPEZA, MONTAGEM, FURACAO, ROTAS] = [await setor('pcp'), await setor('limpeza_embalagem'), await setor('montagem'), await setor('furacao'), await setor('rotas')]
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id, modulos) values
    ('Dono 52', 'dono52@x.com', '52529000091', 'dono.52x', 'admin', '${ADM}', array['fabrica']);
  insert into public.plt_etapas (setor_id, nome, ordem, eh_fila)
  select s, e.nome, e.ordem, e.ordem = 10
    from unnest(array[${LIMPEZA}, ${MONTAGEM}, ${FURACAO}]) s,
         (values ('A FAZER', 10), ('FAZENDO', 20), ('CONFERIR', 30), ('EMBALANDO', 40), ('PARADO', 50), ('PRONTO', 60), ('EXTRA', 70)) e(nome, ordem);
`)
await bd.exec(`set session_replication_role = replica`) // a semeadura não dispara gatilho
const NOMES = `array['Estante Basic 5 nichos - Branca','Armário Aéreo 3 portas - Branco','Armário multiuso 2 portas com chave','Mesa/escrivaninha Close - 80 x 75 x 45','Sapateira Basic 7 nichos','Cômoda 4 gavetas - Off White','Rack Slim 180 - Freijó','Painel Ripado 120 - Preto','Aparador Industrial - Carvalho','Mesa de cabeceira Dupla','Guarda-roupa 6 portas - Branco','Balcão de pia 120','Nicho Cubo 30','Escrivaninha Office 120','Estante Industrial 5 prateleiras','Bancada Gamer 140','Cabeceira Casal Estofada','Penteadeira Camarim','Sapateira Slim 3 portas','Torre Quente - Branca']`
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
`)
// ============================================================================
// SESSAO-52 — o que as portas tocadas leem: os pedidos ENTREGUES (todas as peças arquivadas) ganham o
// fato da entrega no card do pedido e a data única (plt_cards.entrega_em). 1 em 5 com o DIA ESCOLHIDO
// (a entrega aconteceu 2 dias antes do registro); 1 em 20 com o dia CORRIGIDO pelo administrador (o
// fato entrega_dia_corrigido). Cada peça arquivada leva, no fato do arquivamento, a entrega com que
// saiu (dados.entrega_evento_id) — como o fechar do pedido grava desde sempre. Semeado por junção.
// ============================================================================
await bd.exec(`
  with ent as (
    select pc.id as card_id, max(u.arquivado_em) as em
      from public.plt_cards pc
      join public.plt_cards u on u.pedido_id = pc.pedido_id and u.tipo = 'unidade'
     where pc.tipo = 'pedido' and pc.liberado_completo_em is not null
     group by pc.id
    having bool_and(u.arquivado_em is not null)
  )
  insert into public.plt_eventos (card_id, tipo, origem, usuario_id, ocorrido_em, registrado_em, dados)
  select e.card_id, 'pedido_entregue', 'interface', (select id from public.plt_usuarios where usuario = 'dono.52x'),
         case when e.card_id % 5 = 0 then e.em - interval '2 days' else e.em end, e.em, '{}'::jsonb
    from ent e;
  update public.plt_cards pc
     set entrega_evento_id = ev.id, entrega_em = ev.ocorrido_em, lancado_rotas_em = ev.registrado_em - interval '1 day'
    from public.plt_eventos ev
   where ev.tipo = 'pedido_entregue' and ev.card_id = pc.id;
  insert into public.plt_eventos (card_id, tipo, origem, usuario_id, evento_referencia_id, ocorrido_em, registrado_em, dados)
  select pc.id, 'entrega_dia_corrigido', 'interface', (select id from public.plt_usuarios where usuario = 'dono.52x'),
         pc.entrega_evento_id, pc.entrega_em + interval '3 days', pc.entrega_em + interval '3 days',
         jsonb_build_object('entregue_em', pc.entrega_em - interval '1 day')
    from public.plt_cards pc
   where pc.entrega_evento_id is not null and pc.id % 20 = 0;
  update public.plt_cards pc
     set entrega_em = pc.entrega_em - interval '1 day'
   where pc.entrega_evento_id is not null and pc.id % 20 = 0;
  insert into public.plt_eventos (card_id, tipo, origem, dados, ocorrido_em, registrado_em)
  select u.id, 'card_arquivado', 'api',
         jsonb_build_object('motivo', 'entregue') ||
           case when pc.entrega_evento_id is null then '{}'::jsonb else jsonb_build_object('entrega_evento_id', pc.entrega_evento_id) end,
         u.arquivado_em, u.arquivado_em
    from public.plt_cards u
    left join public.plt_cards pc on pc.pedido_id = u.pedido_id and pc.tipo = 'pedido'
   where u.tipo = 'unidade' and u.arquivado_em is not null;
`)
await bd.exec(`set session_replication_role = origin; analyze;`)
const tam = (await bd.query(`
  select (select count(*) from public.plt_cards)::int as cards, (select count(*) from public.plt_eventos)::int as eventos,
         (select count(*) from public.plt_cards where entrega_evento_id is not null)::int as entregues,
         (select count(*) from public.plt_eventos where tipo = 'entrega_dia_corrigido')::int as corrigidas,
         (select count(*) from public.plt_cards c join public.plt_eventos e on e.id = c.entrega_evento_id
           where c.entrega_em <> e.registrado_em)::int as dia_escolhido,
         (select count(*) from public.plt_eventos where tipo = 'card_arquivado' and dados ? 'entrega_evento_id')::int as pecas_entregues`)).rows[0]
console.log(`  cards ${tam.cards.toLocaleString('pt-BR')} · eventos ${tam.eventos.toLocaleString('pt-BR')} · pedidos entregues ${tam.entregues.toLocaleString('pt-BR')} (dia escolhido ou corrigido: ${tam.dia_escolhido.toLocaleString('pt-BR')}; corrigidos: ${tam.corrigidas.toLocaleString('pt-BR')}) · peças que saíram com entrega ${tam.pecas_entregues.toLocaleString('pt-BR')} (${passou()})`)

const como = (auth) => bd.exec(`select set_config('request.jwt.claim.sub', '${auth}', false)`)
await como(ADM)

// os casos medidos
const ENT = (await bd.query(`
  select pc.id::int as card, p.numero::int as numero
    from public.plt_cards pc join public.pedidos p on p.id = pc.pedido_id
   where pc.entrega_evento_id is not null and pc.id % 20 = 0
   order by pc.id desc limit 1`)).rows[0]
console.log(`  o pedido entregue (e corrigido) medido: ${ENT.numero} (card ${ENT.card})`)

// as portas de ANTES, guardadas com outro nome para a medida alternada
const LEITURA = ['plt_fn_busca_cards', 'plt_fn_devolucao_detalhe']
await bd.exec(`create schema if not exists antes52`)
for (const nome of LEITURA) {
  const defs = (await bd.query(`select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                 where n.nspname = 'public' and p.proname = '${nome}'`)).rows
  if (defs.length !== 1) throw new Error(`esperava uma ${nome}, achei ${defs.length}`)
  const copia = defs[0].def.replace(`FUNCTION public.${nome}(`, `FUNCTION antes52.${nome}(`)
  if (copia === defs[0].def) throw new Error(`não consegui renomear a cópia de ${nome}`)
  await bd.exec(copia)
}
await bd.exec(await readFile(path.join(R, 'supabase/migrations', NOVA), 'utf8'))
console.log(`  as ${LEITURA.length} portas de ANTES copiadas para o esquema antes52; a migration ${NOVA} aplicada (${passou()})`)

// ANTES × DEPOIS alternados: uma chamada da porta antiga, uma da nova, N vezes (a 1ª é fria: fica de fora;
// 9 chamadas — a 6ª em diante mostra o degrau do plano genérico, se houver — A-209)
const tabela = []
const ab = async (rotulo, sqlAntes, sqlDepois, extrair = null, vezes = 9) => {
  const a = []
  const n = []
  let rn
  for (let i = 0; i < vezes; i++) {
    let t = performance.now(); await bd.query(sqlAntes); a.push(performance.now() - t)
    t = performance.now(); rn = await bd.query(sqlDepois); n.push(performance.now() - t)
  }
  const ma = med(a.slice(1))[0]
  const mn = med(n.slice(1))[0]
  const dif = (mn / ma) * 100 - 100
  tabela.push([rotulo, ma, mn, dif])
  console.log(`  ${rotulo.padEnd(58)} antes ${ma.toFixed(1).padStart(8)} ms · depois ${mn.toFixed(1).padStart(8)} ms · ${(dif >= 0 ? '+' : '') + dif.toFixed(0)}%${extrair ? ' · ' + extrair(rn) : ''}`)
  console.log(`      antes  (ms): ${lista(a)}`)
  console.log(`      depois (ms): ${lista(n)}`)
}
const troca = (sql, nome) => sql.replace(`public.${nome}(`, `antes52.${nome}(`)
const itens = (r) => {
  const b = r.rows[0].b
  return `${b.itens.length} itens · com o dia real ${b.itens.filter((i) => i.entregue_em).length}`
}

console.log(`\n== a busca geral (plt_fn_busca_cards) ==`)
const buscas = [
  ['busca · o número inteiro de um pedido entregue', `select public.plt_fn_busca_cards('${ENT.numero}', null, 20) as b`],
  ['busca · número que começa com "12" (20)', `select public.plt_fn_busca_cards('12', null, 20) as b`],
  ['busca · número que começa com "12" (50 — o teto)', `select public.plt_fn_busca_cards('12', null, 50) as b`],
  ['busca · pelo nome "Estante Basic" (20)', `select public.plt_fn_busca_cards('Estante Basic', null, 20) as b`],
  ['busca · pelo nome "Torre Quente" (50)', `select public.plt_fn_busca_cards('Torre Quente', null, 50) as b`],
]
for (const [rotulo, sql] of buscas) await ab(rotulo, troca(sql, 'plt_fn_busca_cards'), sql, itens)
// a página mais cara possível: 50 itens, todos entregues
const PREFIXO = String(ENT.numero).slice(0, 3)
await ab(`busca · número que começa com "${PREFIXO}" (50)`, troca(`select public.plt_fn_busca_cards('${PREFIXO}', null, 50) as b`, 'plt_fn_busca_cards'),
  `select public.plt_fn_busca_cards('${PREFIXO}', null, 50) as b`, itens)

console.log(`\n== o detalhe da devolução (plt_fn_devolucao_detalhe) ==`)
const dev = `select public.plt_fn_devolucao_detalhe(${ENT.card}) as d`
await ab('devolução · o detalhe de um pedido entregue e corrigido', troca(dev, 'plt_fn_devolucao_detalhe'), dev,
  (r) => `${r.rows[0].d.historico.length} fatos no histórico`)

console.log(`\n== a lista de Pedidos: a de sempre (plt_fn_pedidos_lista) × a página nova (plt_fn_pedidos_pagina) ==`)
const paginas = [
  ['Pedidos · a abertura (20)', `null, null, 20, false`],
  ['Pedidos · "Ver mais" (20, depois do meio)', `null, ${Math.round(N.pedidos / 2)}, 20, false`],
  ['Pedidos · o teto (100)', `null, null, 100, false`],
  ['Pedidos · busca "12"', `'12', null, 20, false`],
  ['Pedidos · busca "Cliente 77"', `'Cliente 77', null, 20, false`],
  ['Pedidos · cancelados (20)', `null, null, 20, true`],
]
for (const [rotulo, args] of paginas) {
  await ab(rotulo, `select count(*) from public.plt_fn_pedidos_lista(${args})`, `select public.plt_fn_pedidos_pagina(${args}) as p`,
    (r) => `${r.rows[0].p.length} linhas · com a hora do registro ${r.rows[0].p.filter((l) => l.entrega_registrada_em).length}`)
}

console.log(`\n== os planos (o que a migration acrescenta, fora da função — A-147) ==`)
await plano('a junção nova da busca: o dia real de 50 peças entregues', `
  select c.id, d.em
    from (select u.id, u.pedido_id from public.plt_cards u
           where u.tipo = 'unidade' and u.arquivado_em is not null order by u.id desc limit 50) c
    left join lateral (
      select ev.dados ->> 'motivo' as motivo,
             case when (ev.dados ->> 'entrega_evento_id') ~ '^[0-9]{1,18}$' then (ev.dados ->> 'entrega_evento_id')::bigint end as entrega_evento_id
        from public.plt_eventos ev
       where ev.card_id = c.id and ev.tipo = 'card_arquivado'
       order by ev.id desc limit 1) a on true
    left join lateral (
      select coalesce(
               (select pc.entrega_em from public.plt_cards pc
                 where pc.pedido_id = c.pedido_id and pc.tipo = 'pedido' and pc.entrega_evento_id = a.entrega_evento_id limit 1),
               (select coalesce((select (k.dados ->> 'entregue_em')::timestamptz from public.plt_eventos k
                                  where k.evento_referencia_id = en.id and k.tipo = 'entrega_dia_corrigido' order by k.id desc limit 1),
                                en.ocorrido_em)
                  from public.plt_eventos en where en.id = a.entrega_evento_id and en.tipo = 'pedido_entregue')) as em
       where a.motivo = 'entregue' and a.entrega_evento_id is not null) d on true`)
await plano('a página nova da lista: a hora do registro de 100 linhas', `
  select l.numero,
         (select ev.registrado_em
            from public.plt_cards pc
            join public.plt_eventos ev on ev.id = coalesce(pc.entrega_evento_id, pc.parcial_evento_id)
           where pc.id = l.card_id) as entrega_registrada_em
    from public.plt_fn_pedidos_lista(null, null, 100, false) l`)
await plano('o detalhe da devolução: a última correção de uma entrega', `
  select (k.dados ->> 'entregue_em')::timestamptz
    from public.plt_eventos k
   where k.evento_referencia_id = (select entrega_evento_id from public.plt_cards where id = ${ENT.card})
     and k.tipo = 'entrega_dia_corrigido'
   order by k.id desc limit 1`)

console.log(`\n== resumo (mediana da 2ª chamada em diante) ==`)
for (const [rotulo, ma, mn, dif] of tabela) {
  console.log(`  ${rotulo.padEnd(58)} ${ma.toFixed(1).padStart(8)} → ${mn.toFixed(1).padStart(8)} ms (${(dif >= 0 ? '+' : '') + dif.toFixed(0)}%)`)
}
console.log(`\n  fim (${passou()})`)
await bd.close()
process.exit(0)
