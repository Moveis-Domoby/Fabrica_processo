// Ensaio ×100 das partes que a migration 93 mexe (Lei de desempenho §1/§7.2):
// o lote (com o acerto da data na reserva), o painel da carga (a janela que o
// Tiny não conta fora da comparação + os motivos nos últimos erros), o acerto
// da fila e o "contar". Banco PGlite GRAVADO EM DISCO (a máquina tem pouca
// memória livre) — os números são o teto, não a média de produção.
// Uso: node ensaio93.mjs <raiz do repositório> <pasta do banco>
import { readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [R, PASTA] = process.argv.slice(2)
const { PGlite } = await import(pathToFileURL(path.join(R, 'node_modules/@electric-sql/pglite/dist/index.js')).href)
const { pg_trgm } = await import(pathToFileURL(path.join(R, 'node_modules/@electric-sql/pglite/dist/contrib/pg_trgm.js')).href)
const X = Number(process.env.ESCALA ?? 100)
const FILA = Math.round(26731 * X) // a fila de 17/10 × 100
const CARGA = Number(process.env.CARGA ?? 3000000)
const ERROS = Math.round(10 * X) // 1.000 linhas em erro
await rm(PASTA, { recursive: true, force: true })
const bd = new PGlite(PASTA, { extensions: { pg_trgm } })

const med = (v) => {
  const s = [...v].sort((a, b) => a - b)
  return [s[Math.floor(s.length / 2)], s[s.length - 1]]
}
const linha = (rotulo, v) => {
  const [m, x] = med(v)
  console.log(`  ${rotulo.padEnd(70)} mediana ${m.toFixed(1).padStart(8)} ms · máx ${x.toFixed(1).padStart(8)} ms`)
}
const t = async (rotulo, sql, vezes = 5) => {
  const v = []
  for (let i = 0; i < vezes; i++) {
    const a = performance.now()
    await bd.query(sql)
    v.push(performance.now() - a)
  }
  linha(rotulo, v)
}
const ensaio = async (rotulo, sql, vezes = 5, preparo = null) => {
  const v = []
  let r
  for (let i = 0; i < vezes; i++) {
    await bd.exec('begin')
    if (preparo) await bd.exec(preparo)
    const a = performance.now()
    try {
      r = await bd.query(sql)
    } finally {
      v.push(performance.now() - a)
      await bd.exec('rollback')
    }
  }
  linha(rotulo, v)
  return r
}
const plano = async (rotulo, sql) => {
  const r = await bd.query(`explain (analyze, buffers, costs off, timing off, summary on) ${sql}`)
  console.log(`  --- plano: ${rotulo}`)
  for (const l of r.rows) console.log(`      ${l['QUERY PLAN']}`)
}

console.log(`== montando o banco em disco (fila ×${X}: ${FILA.toLocaleString('pt-BR')} lidas + ${CARGA.toLocaleString('pt-BR')} da carga) ==`)
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
const migs = (await readdir(path.join(R, 'supabase/migrations'))).filter((f) => f.endsWith('.sql')).sort()
for (const f of migs) await bd.exec(await readFile(path.join(R, 'supabase/migrations', f), 'utf8'))
console.log(`  ${migs.length} migrations aplicadas (a última: ${migs[migs.length - 1]}) (${passou()})`)
// as versões de ANTES (o texto do banco = 89/90), com outro nome, para comparar no mesmo banco (A-70)
const antes = async (arq, nome) => {
  const txt = await readFile(path.join(R, 'supabase/migrations', arq), 'utf8')
  const ini = txt.indexOf(`create or replace function ${nome}(`)
  const fim = txt.indexOf('\n$$;', txt.indexOf('\nas $$', ini) + 6)
  await bd.exec(txt.slice(ini, fim + 4).replace(`function ${nome}(`, `function ${nome}_antes(`))
}
await antes('20261017010000_plt_tiny_fila_duas_contas.sql', 'public.fn_tiny_fila_lote')
await antes('20261017020000_plt_tiny_cascata_avisos_carga.sql', 'public.plt_fn_tiny_carga_painel')
console.log('  as portas de antes criadas com o sufixo _antes')

const SUPER = '00000000-0000-0000-0000-000000000993'
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id)
  values ('Dono', 'dono@x.com', '99900000993', 'dono.x', 'admin', '${SUPER}');
  update public.plt_usuarios set super_admin = true where usuario = 'dono.x';
  insert into public.tiny_auth (id, access_token, refresh_token, updated_at)
  values (1, 'a', 'b', now()), (2, 'c', 'd', now()) on conflict (id) do nothing;
`)
await bd.exec(`set session_replication_role = replica`) // a semeadura não dispara gatilho
await bd.exec(`
  insert into public.tiny_fila (conta, recurso, chave, prioridade, params, status, criado_em, processado_em)
  select case when g % 3 = 0 then 'fabrica' else 'loja' end,
         (array['pedido','contato','nota_fiscal','conta_receber'])[1 + (g % 4)], 'h' || g, 2,
         case when g % 50 = 0 then jsonb_build_object('rodada', 'R' || (g % 400)) else '{}'::jsonb end,
         'ok', now() - interval '30 days', now() - interval '30 days'
    from generate_series(1, ${FILA}) g;
`)
console.log(`  fila lida ${FILA.toLocaleString('pt-BR')} (${passou()})`)
await bd.exec(`
  insert into public.tiny_fila (conta, recurso, chave, referencia, prioridade, params, status)
  select case when g % 4 = 0 then 'loja' else 'fabrica' end,
         (array['conta_pagar','pedido','nota_fiscal','contato','estoque','estrutura'])[1 + (g % 6)],
         'c' || g, 'item ' || g, 9, jsonb_build_object('origem', 'carga', 'carga', 'K'), 'pendente'
    from generate_series(1, ${CARGA}) g;
`)
console.log(`  carga ${CARGA.toLocaleString('pt-BR')} pendentes (${passou()})`)
// os erros de sempre (×100 = 1.000), uns pelo plano e pela permissão; uma contagem
// (rodada C) com 150 janelas; e 25 linhas da carga da loja um dia antes do piso
await bd.exec(`
  insert into public.tiny_fila (conta, recurso, chave, prioridade, params, status, tentativas, erro, processado_em)
  select case when g % 2 = 0 then 'loja' else 'fabrica' end, 'conta_pagar', 'e' || g, 9,
         jsonb_build_object('origem', 'carga', 'carga', 'K'), 'erro', 4,
         case when g % 10 = 0 then 'codigo 31: A data informada no filtro (01/01/2015) está fora do período permitido pelo plano (a partir de 18/10/2024).'
              when g % 10 = 1 then 'a API nova respondeu 403: null'
              else 'codigo 99: falha ' || g end,
         now() - (g % 500) * interval '1 minute'
    from generate_series(1, ${ERROS}) g;
  insert into public.tiny_fila (conta, recurso, chave, referencia, prioridade, params, status, processado_em, erro)
  select case when g % 2 = 0 then 'loja' else 'fabrica' end,
         (array['pedidos_pesquisa','nf_pesquisa','cr_pesquisa','cp_pesquisa','contatos_pesquisa'])[1 + (g % 5)],
         'censo:x:' || g, 'j' || g, 9,
         jsonb_build_object('origem', 'censo', 'censo', 'C', 'registros', 100, 'numero_paginas', 1, 'aqui', 100,
                            'dataInicial', '01/01/2025', 'dataFinal', '31/01/2025'),
         case when g % 15 = 0 then 'vazio' when g % 37 = 0 then 'erro' else 'ok' end, now(),
         case when g % 15 = 0 then 'fora do período do plano: o Tiny da loja só deixa pedir a partir de 18/10/2024' end
    from generate_series(1, 150) g;
  insert into public.tiny_fila (conta, recurso, chave, prioridade, params, status)
  select 'loja', 'cp_pesquisa', 'carga:cp_pesquisa:ontem' || g, 8,
         jsonb_build_object('origem', 'carga', 'carga', 'K', 'pagina', 1,
                            'data_ini_emissao', to_char(plt_privado.fn_tiny_piso('loja') - 1, 'DD/MM/YYYY'),
                            'data_fim_emissao', to_char(plt_privado.fn_tiny_piso('loja') + 60, 'DD/MM/YYYY')),
         'pendente'
    from generate_series(1, 25) g;
  update public.plt_tiny_controle set ultima_contagem = 'C', ultima_carga = 'K' where id = 1;
`)
await bd.exec(`set session_replication_role = origin`)
await bd.exec(`analyze`)
const tam = await bd.query(`select pg_size_pretty(pg_database_size(current_database())) as t, (select count(*) from public.tiny_fila) as fila`)
console.log(`  banco ${tam.rows[0].t} · fila ${Number(tam.rows[0].fila).toLocaleString('pt-BR')} (${passou()}) · analyze feito`)

const como = (sub) => bd.exec(`select set_config('request.jwt.claim.sub', '${sub}', false)`)

console.log('\n== o lote do n8n (a cada 2 s, enquanto há trabalho) — antes × depois, no mesmo banco ==')
await ensaio('ANTES  lote de 25 — a carga da loja com data (não acertava)', `select public.fn_tiny_fila_lote_antes(25)`)
await ensaio('DEPOIS lote de 25 — a carga da loja um dia antes do piso (acerta as 25)', `select public.fn_tiny_fila_lote(25)`)
await bd.exec(`update public.tiny_fila set status = 'ok' where chave like 'carga:cp_pesquisa:ontem%'`)
await ensaio('ANTES  lote de 25 — a carga sem data', `select public.fn_tiny_fila_lote_antes(25)`)
await ensaio('DEPOIS lote de 25 — a carga sem data (nada a acertar)', `select public.fn_tiny_fila_lote(25)`)

console.log('\n== a aba Carga do Tiny (1 requisição) — antes × depois ==')
await como(SUPER)
await t('ANTES  painel da carga', `select public.plt_fn_tiny_carga_painel_antes()`)
await t('DEPOIS painel da carga (sem as janelas que o Tiny não conta + os motivos)', `select public.plt_fn_tiny_carga_painel()`)
await ensaio('CONTAR no Tiny (gesto do dono)', `select public.plt_fn_tiny_carga('contar')`, 3)
await como('')

console.log('\n== o acerto do que já estava na fila (uma vez, na aplicação) ==')
await ensaio('fn_tiny_fila_limites_acertar (1.000 erros, 200 pelo plano ou permissão)', `select plt_privado.fn_tiny_fila_limites_acertar()`, 3)

console.log('\n== planos (as partes novas) ==')
await plano('os últimos erros + o que a contagem não contou (o painel)', `
  select u.* from ((select f.conta, f.recurso, f.referencia, f.chave, f.erro, f.processado_em
                      from public.tiny_fila f where f.status = 'erro' order by f.processado_em desc nulls last limit 10)
                   union all
                   (select f.conta, f.recurso, f.referencia, f.chave, f.erro, f.processado_em
                      from public.tiny_fila f where f.params ? 'censo' and f.params->>'censo' = 'C' and f.status = 'vazio'
                     order by f.processado_em desc nulls last limit 10)) u
   order by u.processado_em desc nulls last limit 10`)
await plano('as janelas da contagem sem as que o Tiny não conta (o painel)', `
  select count(*) from public.tiny_fila f
   where f.params ? 'censo' and f.params->>'censo' = 'C'
     and not coalesce((f.params->>'ultima')::boolean, false) and f.status <> 'vazio'`)
await plano('o acerto da data na reserva (o lote — 25 pelo id)', `
  select t.id from public.tiny_fila t
   where t.id = any (array(select f.id from public.tiny_fila f where f.conta = 'loja' and f.status = 'pendente' and f.prioridade <= 9
                            order by f.prioridade, f.id limit 25))
     and (t.params ? 'dataInicial' or t.params ? 'data_ini_emissao')`)
await plano('o acerto da fila: a carga pelo plano (erros + as que esperam)', `
  select f.id from public.tiny_fila f where f.status = 'erro' and f.params ? 'carga' and f.erro like 'codigo 31:%'
  union
  select f.id from public.tiny_fila f where f.status = 'pendente' and f.nao_antes is not null and f.params ? 'carga' and f.erro like 'codigo 31:%'`)
await plano('o acerto da fila: o pedido de compra da loja que espera', `
  select f.id from public.tiny_fila f where f.conta = 'loja' and f.recurso in ('v3_ordens_compra', 'v3_ordem_compra') and f.status = 'pendente'`)
await bd.close()
await rm(PASTA, { recursive: true, force: true })
console.log('\nfim')
