// Ensaio ×100 das partes que a migration 107 mexe (Lei de desempenho §1/§7.2):
// a resposta de uma página da conferência (só relê o que mudou), o fechar de uma
// janela (o mês das contas a pagar; o catálogo inteiro), o começar, o painel da
// carga e as telas dos produtos (com os apagados fora) — antes × depois no MESMO
// banco (as portas de antes com o sufixo _antes, do texto vivo de 21/10).
// Banco PGlite GRAVADO EM DISCO — os números são o teto, não a média de produção.
// Uso: node ensaio101.mjs <raiz do repositório> <pasta do banco> <pasta das vivas>
import { readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [R, PASTA, VIVAS] = process.argv.slice(2)
const { PGlite } = await import(pathToFileURL(path.join(R, 'node_modules/@electric-sql/pglite/dist/index.js')).href)
const { pg_trgm } = await import(pathToFileURL(path.join(R, 'node_modules/@electric-sql/pglite/dist/contrib/pg_trgm.js')).href)
const X = Number(process.env.ESCALA ?? 100)
const N = {
  fila: Math.round(43335 * X),        // a fila de 21/10 × 100
  produtos: Math.round(561 * X),
  cpFab: Math.round(3828 * X), cpLoja: Math.round(563 * X), contatos: Math.round(8742 * X),
  nf: Math.round(589 * X), cr: Math.round(287 * X), ped: Math.round(135 * X), oc: Math.round(151 * X),
  comp: Math.round(1134 * X),
}
await rm(PASTA, { recursive: true, force: true })
const bd = new PGlite(PASTA, { extensions: { pg_trgm } })

const med = (v) => { const s = [...v].sort((a, b) => a - b); return [s[Math.floor(s.length / 2)], s[s.length - 1]] }
const linha = (rotulo, v) => {
  const [m, x] = med(v)
  console.log(`  ${rotulo.padEnd(78)} mediana ${m.toFixed(1).padStart(8)} ms · máx ${x.toFixed(1).padStart(8)} ms`)
}
const t = async (rotulo, sql, vezes = 5) => {
  const v = []
  for (let i = 0; i < vezes; i++) { const a = performance.now(); await bd.query(sql); v.push(performance.now() - a) }
  linha(rotulo, v)
}
const ensaio = async (rotulo, sql, vezes = 5, preparo = null) => {
  const v = []
  let r
  for (let i = 0; i < vezes; i++) {
    await bd.exec('begin')
    if (preparo) await bd.exec(preparo)
    const a = performance.now()
    try { r = await bd.query(sql) } finally { v.push(performance.now() - a); await bd.exec('rollback') }
  }
  linha(rotulo, v)
  return r
}
const plano = async (rotulo, sql) => {
  const r = await bd.query(`explain (analyze, buffers, costs off, timing off, summary on) ${sql}`)
  console.log(`  --- plano: ${rotulo}`)
  for (const l of r.rows) console.log(`      ${l['QUERY PLAN']}`)
}

console.log(`== montando o banco em disco (×${X}: fila ${N.fila.toLocaleString('pt-BR')} · produtos ${N.produtos.toLocaleString('pt-BR')} · contas a pagar da fábrica ${N.cpFab.toLocaleString('pt-BR')}) ==`)
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

// as portas de ANTES: o texto vivo de 21/10 (pg_get_functiondef) com o sufixo _antes
const ANTES = ['public.fn_tiny_fila_resposta', 'public.plt_fn_tiny_carga_painel', 'public.plt_fn_produtos_classificacao',
  'public.plt_fn_estoque_configuracoes', 'public.plt_fn_produtos_unidades', 'public.plt_fn_produto_estrutura',
  'public.plt_fn_vinculo_buscar', 'public.plt_fn_fotos_tiny_pendentes', 'plt_privado.fn_estoque_por_produto',
  'public.plt_fn_estoque_resumo', 'public.plt_fn_estoque_produtos']
for (const nome of ANTES) {
  let txt = await readFile(path.join(VIVAS, `${nome}.sql`), 'utf8')
  txt = txt.replace(`FUNCTION ${nome}(`, `FUNCTION ${nome}_antes(`)
  if (nome === 'public.plt_fn_estoque_resumo' || nome === 'public.plt_fn_estoque_produtos')
    txt = txt.replaceAll('plt_privado.fn_estoque_por_produto()', 'plt_privado.fn_estoque_por_produto_antes()')
  await bd.exec(txt)
}
console.log(`  ${ANTES.length} portas de antes criadas (${passou()})`)

const SUPER = '00000000-0000-0000-0000-000000001019'
await bd.exec(`
  insert into public.plt_usuarios (nome, email, cpf, usuario, papel, auth_user_id)
  values ('Dono', 'dono@x.com', '10100001019', 'dono.x', 'admin', '${SUPER}');
  update public.plt_usuarios set super_admin = true where usuario = 'dono.x';
  insert into public.tiny_auth (id, access_token, refresh_token, updated_at)
  values (1, 'a', 'b', now()), (2, 'c', 'd', now()) on conflict (id) do nothing;
`)
await bd.exec(`set session_replication_role = replica`) // a semeadura não dispara gatilho
// o catálogo ×100: 1 em 5 apagado no Tiny (o de hoje: 108 de 561 ≈ 1 em 5)
await bd.exec(`
  insert into public.produtos (tiny_id, codigo, descricao, classe, unidade, situacao, raw)
  select 5000000 + g, 'SKU' || g, 'Produto ensaio ' || g, (array['F','M','M','S','K'])[1 + g % 5],
         case when g % 7 = 0 then null else 'un' end, case when g % 12 = 0 then 'I' else 'A' end,
         jsonb_build_object('unidade', case when g % 9 = 0 then 'Unidad' when g % 7 = 0 then '' else 'UN' end, 'ncm', '9403',
                            'anexos', case when g % 3 = 0 then jsonb_build_array(jsonb_build_object('anexo', 'https://s3.amazonaws.com/tiny-anexos-1/x/' || g || '.jpg')) else '[]'::jsonb end)
    from generate_series(1, ${N.produtos}) g;
  insert into public.plt_produtos_excluidos_tiny (tiny_id, codigo, descricao, erro)
  select tiny_id, codigo, descricao, 'codigo 32: Produto não localizado' from public.produtos where tiny_id % 5 = 1;
  insert into public.plt_produto_componentes (produto_tiny_id, componente_tiny_id, quantidade)
  select 5000000 + 5 * (1 + g % (${N.produtos} / 5 - 1)), 5000000 + 1 + (g * 7) % ${N.produtos}, 1 + g % 4
    from generate_series(1, ${N.comp}) g
  on conflict do nothing;
`)
console.log(`  catálogo ${N.produtos.toLocaleString('pt-BR')} (apagados 1 em 5) e estruturas (${passou()})`)
// os registros ×100 — o resumo da lista guardado (como depois da 1ª conferência)
const resumo = (pref, extra) => `jsonb_build_object('id', '${pref}' || g, 'valor', (g % 900)::text, 'situacao', case when g % 3 = 0 then 'pago' else 'aberto' end${extra})`
await bd.exec(`
  insert into public.plt_tiny_registros (conta, tipo, chave, raw, hash, data, resumo_hash)
  select 'fabrica', 'conta_pagar', 'cpf' || g,
         ${resumo('cpf', `, 'data', to_char(date '2024-08-01' + (g % 800), 'DD/MM/YYYY')`)}, md5(g::text),
         date '2024-08-01' + (g % 800), md5(${resumo('cpf', '')}::text)
    from generate_series(1, ${N.cpFab}) g;
  insert into public.plt_tiny_registros (conta, tipo, chave, raw, hash, data, resumo_hash)
  select 'loja', 'conta_pagar', 'cpl' || g, ${resumo('cpl', `, 'data', to_char(date '2025-03-01' + (g % 590), 'DD/MM/YYYY')`)},
         md5(g::text), date '2025-03-01' + (g % 590), md5(${resumo('cpl', '')}::text)
    from generate_series(1, ${N.cpLoja}) g;
  insert into public.plt_tiny_registros (conta, tipo, chave, raw, hash)
  select 'fabrica', 'contato', 'ct' || g, jsonb_build_object('id', 'ct' || g, 'nome', 'Contato ' || g), md5(g::text)
    from generate_series(1, ${N.contatos}) g;
  insert into public.plt_tiny_registros (conta, tipo, chave, raw, hash, data, resumo_hash)
  select 'fabrica', t.tipo, t.tipo || g, jsonb_build_object('id', t.tipo || g), md5(g::text),
         case when t.tipo <> 'ordem_compra' then date '2025-03-01' + (g % 590) end, md5((t.tipo || g)::text)
    from (values ('nota_fiscal', ${N.nf}), ('conta_receber', ${N.cr}), ('pedido', ${N.ped}), ('ordem_compra', ${N.oc})) t(tipo, n),
         generate_series(1, t.n) g;
  insert into public.plt_tiny_registros_mes (conta, tipo, mes, n, soma)
  select conta, tipo, date_trunc('month', data)::date, count(*), sum((raw->>'valor')::numeric)
    from public.plt_tiny_registros where tipo = 'conta_pagar' group by 1, 2, 3;
`)
console.log(`  registros ${(N.cpFab + N.cpLoja + N.contatos + N.nf + N.cr + N.ped + N.oc).toLocaleString('pt-BR')} (${passou()})`)
// a fila ×100 (lida) e uma rodada inteira da conferência já lida: as páginas de
// cada mês das contas a pagar (ids + soma) e as do catálogo
await bd.exec(`
  insert into public.tiny_fila (conta, recurso, chave, prioridade, params, status, criado_em, processado_em)
  select case when g % 3 = 0 then 'fabrica' else 'loja' end,
         (array['pedido','contato','nota_fiscal','conta_receber','conta_pagar','produto'])[1 + (g % 6)], 'h' || g, 8,
         case when g % 50 = 0 then jsonb_build_object('rodada', 'R' || (g % 400)) else '{}'::jsonb end,
         'ok', now() - interval '30 days', now() - interval '30 days'
    from generate_series(1, ${N.fila}) g;
  -- as páginas da conferência RX: contas a pagar da fábrica, por mês, 100 ids cada
  insert into public.tiny_fila (conta, recurso, chave, referencia, prioridade, params, status, processado_em)
  select 'fabrica', 'cp_pesquisa', 'conferencia:cp_pesquisa:' || m.rot || case when p.pag > 1 then ':p' || p.pag else '' end,
         m.rot, 8,
         jsonb_build_object('origem', 'conferencia', 'conferencia', 'RX', 'janela', 'conferencia:cp_pesquisa:' || m.rot,
                            'data_ini_emissao', to_char(m.ini, 'DD/MM/YYYY'), 'data_fim_emissao', to_char(m.fim, 'DD/MM/YYYY'),
                            'pagina', p.pag, 'soma', p.soma, 'registros', p.n, 'ids', p.ids),
         'ok', now()
    from (select to_char(date_trunc('month', data), 'YYYY-MM') as rot, date_trunc('month', data)::date as ini,
                 (date_trunc('month', data) + interval '1 month - 1 day')::date as fim
            from public.plt_tiny_registros where conta = 'fabrica' and tipo = 'conta_pagar' group by 1, 2, 3) m
    cross join lateral (
      select (rn - 1) / 100 + 1 as pag, jsonb_agg(chave) as ids, count(*) as n, sum((raw->>'valor')::numeric) as soma
        from (select chave, raw, row_number() over (order by chave) as rn
                from public.plt_tiny_registros t
               where t.conta = 'fabrica' and t.tipo = 'conta_pagar' and t.data between m.ini and m.fim) z
       group by 1) p;
  insert into public.tiny_fila (conta, recurso, chave, referencia, prioridade, params, status, processado_em)
  select 'fabrica', 'produtos_pesquisa', 'conferencia:produtos_pesquisa:tudo' || case when p.pag > 1 then ':p' || p.pag else '' end,
         'conferência da madrugada', 8,
         jsonb_build_object('origem', 'conferencia', 'conferencia', 'RX', 'janela', 'conferencia:produtos_pesquisa:tudo',
                            'pesquisa', '', 'pagina', p.pag, 'ids', p.ids),
         'ok', now()
    from (select (rn - 1) / 100 + 1 as pag, jsonb_agg(tiny_id::text) as ids
            from (select tiny_id, row_number() over (order by tiny_id) as rn from public.produtos
                   where tiny_id % 5 <> 1) z group by 1) p;
  update public.plt_tiny_controle set ultima_conferencia = 'RX', ultima_carga = 'K', ultima_contagem = 'C' where id = 1;
`)
await bd.exec(`set session_replication_role = origin`)
await bd.exec(`analyze`)
const tam = await bd.query(`select pg_size_pretty(pg_database_size(current_database())) as t,
  (select count(*) from public.tiny_fila) as fila, (select count(*) from public.plt_tiny_registros) as reg,
  (select count(*) from public.tiny_fila where params ? 'conferencia') as conf`)
console.log(`  banco ${tam.rows[0].t} · fila ${Number(tam.rows[0].fila).toLocaleString('pt-BR')} (rodada RX: ${Number(tam.rows[0].conf).toLocaleString('pt-BR')} páginas) · registros ${Number(tam.rows[0].reg).toLocaleString('pt-BR')} (${passou()}) · analyze feito`)

const como = (sub) => bd.exec(`select set_config('request.jwt.claim.sub', '${sub}', false)`)
// a página 50 do mês 2026-03 em andamento (para responder) e a última dele
const mar = (await bd.query(`select max((params->>'pagina')::int) as ult from public.tiny_fila
                              where params ? 'conferencia' and params->>'conferencia' = 'RX' and params->>'janela' = 'conferencia:cp_pesquisa:2026-03'`)).rows[0].ult
console.log(`  o mês 2026-03 da fábrica tem ${mar} páginas`)
const pagina = (pag, mudados) => `
  select jsonb_build_object('api', 'v2', 'corpo', jsonb_build_object('retorno', jsonb_build_object(
           'status', 'OK', 'pagina', ${pag}, 'numero_paginas', ${mar},
           'contas', (select jsonb_agg(jsonb_build_object('conta',
                        case when rn <= ${mudados} then jsonb_build_object('id', chave, 'valor', '1', 'situacao', 'pago')
                             else jsonb_build_object('id', chave, 'valor', raw->>'valor', 'situacao', raw->>'situacao') end))
                        from (select chave, raw, row_number() over (order by chave) as rn
                                from public.plt_tiny_registros
                               where conta = 'fabrica' and tipo = 'conta_pagar' and data between date '2026-03-01' and date '2026-03-31'
                               order by chave offset ${(pag - 1) * 100} limit 100) z))))`
const preparo = (pag) => `update public.tiny_fila set status = 'processando', reservado_em = now()
                            where chave = 'conferencia:cp_pesquisa:2026-03${pag > 1 ? ':p' + pag : ''}' and conta = 'fabrica' and recurso = 'cp_pesquisa'`
const idDe = async (pag) => (await bd.query(`select id from public.tiny_fila where conta = 'fabrica' and recurso = 'cp_pesquisa'
                                               and chave = 'conferencia:cp_pesquisa:2026-03${pag > 1 ? ':p' + pag : ''}'`)).rows[0].id
const resp50 = (await bd.query(pagina(50, 5))).rows[0].jsonb_build_object
const respUlt = (await bd.query(pagina(mar, 2))).rows[0].jsonb_build_object
const id50 = await idDe(50)
const idUlt = await idDe(mar)
const j = (o) => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`

console.log('\n== a resposta de uma página da conferência (o n8n, 1 a cada 2 s) — antes × depois ==')
await ensaio('ANTES  página de 100 contas a pagar (pedia o detalhe de TODAS)', `select public.fn_tiny_fila_resposta_antes(${id50}, ${j(resp50)})`, 5, preparo(50))
await ensaio('DEPOIS página de 100 (5 mudaram: só esses 5 voltam a ser lidos)', `select public.fn_tiny_fila_resposta(${id50}, ${j(resp50)})`, 5, preparo(50))
console.log('\n== a última página de um mês (fecha a janela: guardados × vistos) ==')
const fech = await ensaio(`DEPOIS última página do mês 2026-03 (${mar} páginas, fecha a janela)`, `select public.fn_tiny_fila_resposta(${idUlt}, ${j(respUlt)}) as r`, 5, preparo(mar))
console.log(`      → ${JSON.stringify(fech.rows[0].r.conferencia)}`)
const idProdUlt = (await bd.query(`select id from public.tiny_fila where chave = (select max(chave) from public.tiny_fila
                    where conta = 'fabrica' and recurso = 'produtos_pesquisa' and params->>'conferencia' = 'RX')`)).rows[0].id
const fechP = await ensaio('DEPOIS fechar o catálogo inteiro (56 mil produtos × os vistos)', `select plt_privado.fn_tiny_conferencia_fechar(${idProdUlt}) as r`, 3)
console.log(`      → ${JSON.stringify(fechP.rows[0].r)}`)
console.log('\n== começar (uma vez por madrugada) ==')
await ensaio('fn_tiny_conferencia_iniciar (as janelas das duas contas)', `select plt_privado.fn_tiny_conferencia_iniciar('ensaio')`, 3)

console.log('\n== a aba Carga do Tiny (1 requisição) — antes × depois ==')
await como(SUPER)
await t('ANTES  painel da carga (somas da carga)', `select public.plt_fn_tiny_carga_painel_antes()`)
await t('DEPOIS painel da carga (somas da conferência RX, mais nova)', `select public.plt_fn_tiny_carga_painel()`)

console.log('\n== as telas dos produtos (1 requisição cada) — antes × depois ==')
await t('ANTES  Configurações → móveis, insumos e peças (1ª página)', `select * from public.plt_fn_produtos_classificacao_antes(null, null, null, null, 'A', 30, 0)`)
await t('DEPOIS Configurações → móveis, insumos e peças (1ª página)', `select * from public.plt_fn_produtos_classificacao(null, null, null, null, 'A', 30, 0)`)
await t('ANTES  … com busca', `select * from public.plt_fn_produtos_classificacao_antes('ensaio 12', null, null, null, 'A', 30, 0)`)
await t('DEPOIS … com busca', `select * from public.plt_fn_produtos_classificacao('ensaio 12', null, null, null, 'A', 30, 0)`)
await t('ANTES  unidades fora do padrão (dívida 13 — o catálogo ×100)', `select * from public.plt_fn_produtos_unidades_antes(30, 0)`)
await t('DEPOIS unidades fora do padrão', `select * from public.plt_fn_produtos_unidades(30, 0)`)
await t('ANTES  estrutura de um móvel', `select public.plt_fn_produto_estrutura_antes(5000005)`)
await t('DEPOIS estrutura de um móvel', `select public.plt_fn_produto_estrutura(5000005)`)
await t('ANTES  busca de vínculo (produto)', `select * from public.plt_fn_vinculo_buscar_antes('produto', 'ensaio 12', false, 10)`)
await t('DEPOIS busca de vínculo (produto)', `select * from public.plt_fn_vinculo_buscar('produto', 'ensaio 12', false, 10)`)
await t('ANTES  configurações do estoque (1ª página)', `select * from public.plt_fn_estoque_configuracoes_antes(null, 20, 0)`)
await t('DEPOIS configurações do estoque (1ª página)', `select * from public.plt_fn_estoque_configuracoes(null, 20, 0)`)
await t('ANTES  estoque — resumo (o catálogo inteiro)', `select * from public.plt_fn_estoque_resumo_antes()`)
await t('DEPOIS estoque — resumo', `select * from public.plt_fn_estoque_resumo()`)
await t('ANTES  estoque — insumos (1ª página)', `select * from public.plt_fn_estoque_produtos_antes('insumos', null, null, 20, 0)`)
await t('DEPOIS estoque — insumos (1ª página)', `select * from public.plt_fn_estoque_produtos('insumos', null, null, 20, 0)`)
await como('')
await t('ANTES  fotos do Tiny a copiar (o relógio de 5 min)', `select * from public.plt_fn_fotos_tiny_pendentes_antes(3)`)
await t('DEPOIS fotos do Tiny a copiar', `select * from public.plt_fn_fotos_tiny_pendentes(3)`)
await t('"quantos aqui" — contas a pagar da fábrica (na contagem, 1 vez por janela)', `select plt_privado.fn_tiny_aqui('fabrica', 'cp_pesquisa', null, null)`, 3)
await t('"quantos aqui" — o catálogo da fábrica', `select plt_privado.fn_tiny_aqui('fabrica', 'produtos_pesquisa', null, null)`, 3)

console.log('\n== planos (as partes novas) ==')
await plano('fechar: o que temos no mês (o índice da data, sem os sumidos)', `
  select t.chave from public.plt_tiny_registros t
   where t.conta = 'fabrica' and t.tipo = 'conta_pagar' and t.sumiu_em is null
     and t.data >= date '2026-03-01' and t.data <= date '2026-03-31'`)
await plano('fechar: o que a lista trouxe na janela (o índice da rodada)', `
  select distinct i.id from public.tiny_fila p
   cross join lateral jsonb_array_elements_text(coalesce(p.params->'ids', '[]'::jsonb)) as i(id)
   where p.params ? 'conferencia' and p.params->>'conferencia' = 'RX'
     and p.conta = 'fabrica' and p.recurso = 'cp_pesquisa' and p.params->>'janela' = 'conferencia:cp_pesquisa:2026-03' and p.status = 'ok'`)
await plano('a página: o item da lista × o guardado (100 pela chave)', `
  select x->>'id' from jsonb_array_elements(${j(resp50.corpo.retorno.contas.map((c) => c.conta))}) x
    left join public.plt_tiny_registros t on t.conta = 'fabrica' and t.tipo = 'conta_pagar' and t.chave = x->>'id'
   where t.chave is null or t.resumo_hash is distinct from md5(x::text) or t.sumiu_em is not null`)
await plano('o painel: as páginas da conferência das contas a pagar', `
  select f.conta, regexp_replace(f.params->>'janela', ':p[0-9]+$', '') as janela, sum((f.params->>'soma')::numeric)
    from public.tiny_fila f
   where f.params ? 'conferencia' and f.params->>'conferencia' = 'RX' and f.recurso = 'cp_pesquisa' group by 1, 2`)
await plano('Configurações: a 1ª página sem os apagados', `
  select pr.tiny_id from public.produtos pr
   where not exists (select 1 from public.plt_produtos_excluidos_tiny xp where xp.tiny_id = pr.tiny_id) and pr.situacao = 'A'
   order by pr.descricao, pr.tiny_id limit 30`)
await bd.close()
await rm(PASTA, { recursive: true, force: true })
console.log('\nfim')
