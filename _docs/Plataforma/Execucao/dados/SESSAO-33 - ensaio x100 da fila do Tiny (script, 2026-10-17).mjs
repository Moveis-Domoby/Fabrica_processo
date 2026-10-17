// Ensaio de volume ×100 das portas novas da SESSAO-33 (Lei de desempenho §1/§6).
// Banco local (PGlite, Postgres 17 em WebAssembly — mais lento que o servidor
// de verdade: os números aqui são o TETO, não a média de produção).
// Rodar da raiz do repositório:  node "_docs/Plataforma/Execucao/dados/SESSAO-33 - ensaio x100 da fila do Tiny (script, 2026-10-17).mjs"
// (ESCALA=1 CARGA=30000 = o volume de hoje; o padrão é ×100 com 3 milhões de linhas da carga — ~10 GB de memória, ~10 min)
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const { PGlite } = await import(pathToFileURL(path.join(R, 'node_modules/@electric-sql/pglite/dist/index.js')).href)
const { pg_trgm } = await import(pathToFileURL(path.join(R, 'node_modules/@electric-sql/pglite/dist/contrib/pg_trgm.js')).href)
const X = Number(process.env.ESCALA ?? 100) // ×100 do volume de produção (17/10/2026)
const CARGA = Number(process.env.CARGA ?? 3000000) // linhas da carga na fila (≈30 mil × 100)
const SO = (process.env.SO ?? '').split(',').filter(Boolean)

const PROD = { clientes: 10809, pedidos: 5578, notas: 2913, receber: 6433, produtos: 553, fila: 26731, logs: 11231 }
const n = (k) => Math.round(PROD[k] * X / 100) * 100 / 100 * 1 // inteiro
const N = Object.fromEntries(Object.entries(PROD).map(([k, v]) => [k, Math.round(v * X)]))

const bd = new PGlite({ extensions: { pg_trgm } })
const t = async (rotulo, sql, vezes = 1) => {
  const tempos = []
  let r
  for (let i = 0; i < vezes; i++) {
    const a = performance.now()
    r = await bd.query(sql)
    tempos.push(performance.now() - a)
  }
  tempos.sort((p, q) => p - q)
  const med = tempos[Math.floor(tempos.length / 2)]
  const max = tempos[tempos.length - 1]
  console.log(`  ${rotulo.padEnd(64)} mediana ${med.toFixed(1).padStart(8)} ms · máx ${max.toFixed(1).padStart(8)} ms`)
  return r
}
const ensaio = async (rotulo, sql, vezes = 5, preparo = null) => {
  // escrita: dentro de uma transação desfeita, para o estado não mudar entre as voltas
  const tempos = []
  let r
  for (let i = 0; i < vezes; i++) {
    await bd.exec('begin')
    if (preparo) await bd.exec(preparo)
    const a = performance.now()
    try {
      r = await bd.query(sql)
    } finally {
      tempos.push(performance.now() - a)
      await bd.exec('rollback')
    }
  }
  tempos.sort((p, q) => p - q)
  console.log(`  ${rotulo.padEnd(64)} mediana ${tempos[Math.floor(tempos.length / 2)].toFixed(1).padStart(8)} ms · máx ${tempos[tempos.length - 1].toFixed(1).padStart(8)} ms`)
  return r
}
const plano = async (rotulo, sql) => {
  const r = await bd.query(`explain (analyze, buffers, costs off, timing off, summary on) ${sql}`)
  console.log(`  --- plano: ${rotulo}`)
  for (const l of r.rows) console.log(`      ${l['QUERY PLAN']}`)
}

console.log(`== montando o banco (×${X}; carga na fila: ${CARGA.toLocaleString('pt-BR')} linhas) ==`)
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
console.log(`  ${migs.length} migrations aplicadas`)

const SUPER = '00000000-0000-0000-0000-000000000990'
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id)
  values ('Dono', 'dono@x.com', '99900000990', 'dono.x', 'admin', '${SUPER}');
  update public.plt_usuarios set super_admin = true where usuario = 'dono.x';
`)

const a0 = performance.now()
await bd.exec(`set session_replication_role = replica`) // a semeadura não dispara gatilho
await bd.exec(`
  insert into public.clientes (cpf_cnpj, nome, tiny_id_contato)
  select lpad(g::text, 11, '0'), 'Cliente ' || g, case when g % 100 = 0 then null else 900000000 + g end
    from generate_series(1, ${N.clientes}) g;
  update public.clientes set raw = jsonb_build_object('id', tiny_id_contato) where tiny_id_contato is not null;
`)
console.log(`  clientes ${N.clientes.toLocaleString('pt-BR')} (${((performance.now() - a0) / 1000).toFixed(0)} s)`)
await bd.exec(`
  insert into public.pedidos (tiny_id, numero, cliente_id, situacao, data_pedido, raw, origem)
  select 800000000 + g, g, (g % ${N.clientes}) + 1,
         (array['aberto','aprovado','preparando_envio','faturado','enviado','entregue','cancelado'])[1 + (g % 7)],
         date '2019-01-01' + (g % 2850),
         jsonb_build_object('id', 800000000 + g,
                            'id_nota_fiscal', case when g % 2 = 0 then (500000000 + g)::text else '0' end,
                            'cliente', jsonb_build_object('cpf_cnpj', lpad(((g % ${N.clientes}) + 1)::text, 11, '0'))),
         'backfill'
    from generate_series(1, ${N.pedidos}) g;
  insert into public.notas_fiscais (tiny_id, numero, data_emissao, valor_nota, numero_pedido)
  select 500000000 + 2 * g, g::text, date '2019-01-01' + ((2 * g) % 2850), 100 + (g % 900), 2 * g
    from generate_series(1, ${N.notas}) g;
  insert into public.contas_receber (tiny_id, numero_documento, data_emissao, data_vencimento, valor, situacao, numero_pedido)
  select 600000000 + g, g::text, date '2019-01-01' + (g % 2850), date '2019-02-01' + (g % 2850), 50 + (g % 500), 'aberto', g % ${N.pedidos}
    from generate_series(1, ${N.receber}) g;
`)
console.log(`  pedidos ${N.pedidos.toLocaleString('pt-BR')} · notas ${N.notas.toLocaleString('pt-BR')} · contas a receber ${N.receber.toLocaleString('pt-BR')} (${((performance.now() - a0) / 1000).toFixed(0)} s)`)
await bd.exec(`
  insert into public.produtos (tiny_id, codigo, descricao, classe, unidade, situacao, raw)
  select 100000 + g, 'SKU' || g, 'Produto ' || g,
         case when g % 3 = 0 then 'F' when g % 3 = 1 then 'M' else 'S' end,
         (array['un','pc','m2','m','cx','kg'])[1 + (g % 6)],
         case when g % 20 = 0 then 'I' else 'A' end,
         jsonb_build_object('unidade', (array['UN','Und','un','PC','Pç','M2','M','CX','KG',''])[1 + (g % 10)])
    from generate_series(1, ${N.produtos}) g;
  insert into public.plt_produto_componentes (produto_tiny_id, componente_tiny_id, quantidade, codigo, nome)
  select 100000 + 3 * p, 100000 + 1 + ((p * 7 + c * 13) % (${N.produtos} - 1)), 1 + c, 'C' || c, 'Componente ' || c
    from generate_series(1, ${Math.floor(N.produtos / 3)}) p, generate_series(1, 10) c
  on conflict do nothing;
`)
console.log(`  produtos ${N.produtos.toLocaleString('pt-BR')} + estrutura (${((performance.now() - a0) / 1000).toFixed(0)} s)`)
await bd.exec(`
  insert into public.tiny_fila (conta, recurso, chave, prioridade, params, status, criado_em, processado_em)
  select 'loja', (array['pedido','contato','nota_fiscal','conta_receber'])[1 + (g % 4)], 'h' || g, 2,
         case when g % 50 = 0 then jsonb_build_object('rodada', 'R' || (g % 400)) else '{}'::jsonb end,
         'ok', now() - interval '30 days', now() - interval '30 days'
    from generate_series(1, ${N.fila}) g;
  insert into public.plt_logs_atividade (usuario_id, acao, contexto, criado_em)
  select null, (array['navegacao','entrou','movimentacao_setor','automacao_erro'])[1 + (g % 4)],
         jsonb_build_object('aviso_id', 'n8n:' || (g % 50)), now() - (g % 1000) * interval '1 hour'
    from generate_series(1, ${N.logs}) g;
  insert into public.plt_tiny_registros (conta, tipo, chave, raw, hash)
  select case when g % 2 = 0 then 'loja' else 'fabrica' end, 'conta_pagar', g::text,
         jsonb_build_object('valor', (10 + g % 990)::text || ',50', 'data', to_char(date '2019-01-01' + (g % 2850), 'DD/MM/YYYY')),
         md5(g::text)
    from generate_series(1, ${Math.round(10000 * X)}) g;
  insert into public.plt_tiny_registros (conta, tipo, chave, raw, hash)
  select 'fabrica', (array['pedido','nota_fiscal','contato','estoque'])[1 + (g % 4)], g::text, jsonb_build_object('id', g), md5(g::text)
    from generate_series(1, ${Math.round(5000 * X)}) g;
`)
console.log(`  fila ${N.fila.toLocaleString('pt-BR')} · trilha ${N.logs.toLocaleString('pt-BR')} · registros ${(15000 * X).toLocaleString('pt-BR')} (${((performance.now() - a0) / 1000).toFixed(0)} s)`)

// a carga em andamento: CARGA linhas pendentes, prioridade 9, das duas contas
await bd.exec(`
  insert into public.tiny_fila (conta, recurso, chave, referencia, prioridade, params, status)
  select case when g % 4 = 0 then 'loja' else 'fabrica' end,
         (array['conta_pagar','pedido','nota_fiscal','contato','estoque','estrutura'])[1 + (g % 6)],
         'c' || g, 'item ' || g, 9,
         jsonb_build_object('origem', 'carga', 'carga', '2026-10-17T02:00:00'),
         'pendente'
    from generate_series(1, ${CARGA}) g;
  -- e o que a carga já leu: as páginas das contas a pagar, mês a mês (para as somas)
  insert into public.tiny_fila (conta, recurso, chave, referencia, prioridade, params, status, processado_em)
  select c, 'cp_pesquisa', 'carga:cp_pesquisa:' || j.rotulo || ':p' || p, j.rotulo, 9,
         jsonb_build_object('origem', 'carga', 'carga', '2026-10-17T02:00:00', 'janela', 'carga:cp_pesquisa:' || j.rotulo || case when p > 1 then ':p' || p else '' end,
                            'data_ini_emissao', to_char(j.ini, 'DD/MM/YYYY'), 'data_fim_emissao', to_char(j.fim, 'DD/MM/YYYY'),
                            'soma', 1000 * p, 'registros', 100, 'pagina', p),
         'ok', now()
    from unnest(array['loja','fabrica']) c, plt_privado.fn_tiny_janelas(date '2025-01-01') j, generate_series(1, ${Math.max(1, Math.round(X / 2))}) p
  on conflict do nothing;
`)
await bd.exec(`set session_replication_role = origin`)
await bd.exec(`analyze`)
console.log(`  carga ${CARGA.toLocaleString('pt-BR')} pendentes (${((performance.now() - a0) / 1000).toFixed(0)} s) · analyze feito`)
const tam = await bd.query(`select pg_size_pretty(pg_database_size(current_database())) as t,
                                   (select count(*) from public.tiny_fila) as fila,
                                   (select count(*) from public.tiny_fila where status = 'pendente') as pendentes`)
console.log(`  banco ${tam.rows[0].t} · fila ${Number(tam.rows[0].fila).toLocaleString('pt-BR')} (${Number(tam.rows[0].pendentes).toLocaleString('pt-BR')} pendentes)`)

const como = (sub) => bd.exec(`select set_config('request.jwt.claim.sub', '${sub}', false)`)
const quer = (k) => SO.length === 0 || SO.includes(k)

// algumas linhas da venda (prioridade 2–4), prontas para pegar
await bd.exec(`
  insert into public.tiny_fila (conta, recurso, chave, prioridade, status)
  select 'loja', 'pedido', 'venda' || g, 2, 'pendente' from generate_series(1, 30) g;
`)

if (quer('fila')) {
  console.log('\n== a fila (o caminho quente: a cada lote do n8n e a cada minuto do relógio) ==')
  await ensaio('lote de 25 (fn_tiny_fila_lote) — venda na frente da carga', `select public.fn_tiny_fila_lote(25)`)
  await t('tem trabalho agora? (fn_tiny_fila_precisa_chamar)', `select plt_privado.fn_tiny_fila_precisa_chamar()`, 5)
  await ensaio('fila antiga (fn_fila_proximos 30)', `select * from public.fn_fila_proximos(30)`)
  await ensaio('relógio do minuto (fn_tiny_fila_relogio)', `select plt_privado.fn_tiny_fila_relogio()`)
  // sem venda pendente: só a carga
  await bd.exec(`update public.tiny_fila set status = 'ok' where chave like 'venda%'`)
  await ensaio('lote de 25 — só a carga', `select public.fn_tiny_fila_lote(25)`)
  // a carga pausada (o gesto do dono)
  await como(SUPER)
  await ensaio('PAUSAR a carga (gesto do dono)', `select public.plt_fn_tiny_carga('pausar')`, 1)
  await bd.exec(`select public.plt_fn_tiny_carga('pausar')`)
  await ensaio('lote de 25 — carga pausada (nada a pegar)', `select public.fn_tiny_fila_lote(25)`)
  await t('tem trabalho agora? — carga pausada', `select plt_privado.fn_tiny_fila_precisa_chamar()`, 5)
  await ensaio('relógio do minuto — carga pausada', `select plt_privado.fn_tiny_fila_relogio()`)
  await ensaio('uma venda gravada com a carga pausada (gatilho da cascata)', `update public.pedidos set situacao = 'enviado' where numero = 1000`)
  await ensaio('RETOMAR a carga (gesto do dono)', `select public.plt_fn_tiny_carga('retomar')`, 1)
  await bd.exec(`select public.plt_fn_tiny_carga('retomar')`)
  // a madrugada da fábrica (o Tiny dela ocupado pelo fluxo da fábrica): só loja
  await bd.exec(`create or replace function plt_privado.fn_tiny_fabrica_em_varredura() returns boolean language sql stable as $$ select true $$`)
  await ensaio('lote de 25 — madrugada da fábrica (fábrica de fora)', `select public.fn_tiny_fila_lote(25)`)
  await t('tem trabalho agora? — madrugada da fábrica', `select plt_privado.fn_tiny_fila_precisa_chamar()`, 5)
  await bd.exec(`create or replace function plt_privado.fn_tiny_fabrica_em_varredura() returns boolean language sql stable as $$ select false $$`)
  await como('')
}

if (quer('resposta')) {
  console.log('\n== a resposta do Tiny (uma por item) ==')
  const id1 = (await bd.query(`select id from public.tiny_fila where status = 'pendente' and recurso = 'conta_pagar' limit 1`)).rows[0].id
  await ensaio('detalhe v2 guardado (conta a pagar)',
    `select public.fn_tiny_fila_resposta(${id1}, '{"api":"v2","corpo":{"retorno":{"status":"OK","conta":{"id":"1","valor":"10,00","data":"01/10/2026"}}}}'::jsonb)`,
    5, `update public.tiny_fila set status = 'processando', reservado_em = now() where id = ${id1}`)
  const pag = { api: 'v2', corpo: { retorno: { status: 'OK', pagina: 1, numero_paginas: 3,
    contas: Array.from({ length: 100 }, (_, i) => ({ conta: { id: String(77000000 + i), valor: '10,00', numero_documento: 'D' + i } })) } } }
  const id2 = (await bd.query(`insert into public.tiny_fila (conta, recurso, chave, prioridade, params) values ('fabrica', 'cp_pesquisa', 'medir:p1', 9,
    '{"origem":"carga","carga":"2026-10-17T02:00:00","pagina":1,"janela":"medir","data_ini_emissao":"01/09/2026","data_fim_emissao":"30/09/2026"}') returning id`)).rows[0].id
  await ensaio('página v2 de 100 (enfileira 100 detalhes + a próxima)',
    `select public.fn_tiny_fila_resposta(${id2}, '${JSON.stringify(pag)}'::jsonb)`,
    5, `update public.tiny_fila set status = 'processando', reservado_em = now() where id = ${id2}`)
}

if (quer('painel')) {
  console.log('\n== o painel da carga (aba da Auditoria — 1 requisição) ==')
  await como(SUPER)
  await ensaio('CONTAR no Tiny (gesto do dono)', `select public.plt_fn_tiny_carga('contar')`, 1)
  await bd.exec(`select public.plt_fn_tiny_carga('contar')`)
  await bd.exec(`update public.tiny_fila set status = 'ok', params = params || '{"registros": 100, "numero_paginas": 30}'::jsonb where params ? 'censo'`)
  await t('painel da carga (plt_fn_tiny_carga_painel)', `select public.plt_fn_tiny_carga_painel()`, 5)
  await ensaio('COMEÇAR a carga (gesto do dono)', `select public.plt_fn_tiny_carga('carregar')`, 1)
  await como('')
}

if (quer('aqui')) {
  console.log('\n== "quantos aqui" (calculado uma vez, quando a contagem do Tiny chega — fila, não tela) ==')
  await t('pedidos da loja, o mês mais cheio', `select plt_privado.fn_tiny_aqui('loja', 'pedidos_pesquisa', date '2026-09-01', date '2026-09-30')`, 3)
  await t('pedidos da loja, "antes de 2025" (a janela grande)', `select plt_privado.fn_tiny_aqui('loja', 'pedidos_pesquisa', date '2015-01-01', date '2024-12-31')`, 3)
  await t('notas da loja, um mês', `select plt_privado.fn_tiny_aqui('loja', 'nf_pesquisa', date '2026-09-01', date '2026-09-30')`, 3)
  await t('contas a receber da loja, um mês', `select plt_privado.fn_tiny_aqui('loja', 'cr_pesquisa', date '2026-09-01', date '2026-09-30')`, 3)
  await t('clientes com cadastro do Tiny', `select plt_privado.fn_tiny_aqui('loja', 'contatos_pesquisa', null, null)`, 3)
  await t('contas a pagar guardadas (uma conta)', `select plt_privado.fn_tiny_aqui('fabrica', 'cp_pesquisa', null, null)`, 3)
}

if (quer('produtos')) {
  console.log('\n== Configurações → produtos (no clique) ==')
  await como(SUPER)
  await t('do que é feito / onde é usado (plt_fn_produto_estrutura)', `select public.plt_fn_produto_estrutura(100003)`, 5)
  await t('onde é usado — um insumo muito usado', `select public.plt_fn_produto_estrutura(100001)`, 5)
  await t('unidades fora do padrão, 1ª página (plt_fn_produtos_unidades)', `select * from public.plt_fn_produtos_unidades(20, 0)`, 5)
  await t('unidades fora do padrão, página do meio', `select * from public.plt_fn_produtos_unidades(20, 10000)`, 5)
  await como('')
}

if (quer('planos')) {
  console.log('\n== planos (o miolo das portas quentes) ==')
  await como(SUPER)
  await bd.exec(`select public.plt_fn_tiny_carga('pausar')`)
  await como('')
  await plano('"tem trabalho?" da loja com a carga pausada (o miolo, teto 8)', `
    select f.id from public.tiny_fila f
     where f.conta = 'loja' and f.status = 'pendente' and f.prioridade <= 8
       and f.tentativas < 4 and (f.nao_antes is null or f.nao_antes <= now())
     order by f.prioridade, f.id limit 1`)
  await como(SUPER)
  await bd.exec(`select public.plt_fn_tiny_carga('retomar')`)
  await como('')
  await plano('o lote da fábrica (o miolo, teto 9)', `
    select f.id, f.prioridade from public.tiny_fila f
     where f.conta = 'fabrica' and f.status = 'pendente' and f.prioridade <= 9
       and f.tentativas < 4 and (f.nao_antes is null or f.nao_antes <= now())
     order by f.prioridade, f.id limit 25`)
  await plano('as que esperam a nova tentativa (o relógio)', `
    select 1 from public.tiny_fila f
     where f.status = 'pendente' and f.nao_antes is not null and f.nao_antes > now() and f.tentativas < 4 and f.prioridade <= 9 limit 1`)
  await plano('os 10 últimos erros (o painel)', `
    select * from public.tiny_fila f where f.status = 'erro' order by f.processado_em desc nulls last limit 10`)
  await plano('as páginas das contas a pagar da carga (as somas do painel)', `
    select count(*) from public.tiny_fila f where f.recurso = 'cp_pesquisa' and f.params ? 'carga' and f.params->>'carga' = '2026-10-17T02:00:00'`)
}
console.log('\nfim')
