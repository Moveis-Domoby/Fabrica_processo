/**
 * MANUTENÇÃO DA SESSAO-22 — aplicador dos dois lotes aprovados (D-48)
 *
 * 1. Limite padrão 1 nos setores existentes (resposta 4 do dono).
 * 2. Cards vivos da "Chegada" migrados para a etapa fila, por EVENTO em lote
 *    (origem api — nunca UPDATE de posição).
 *
 * Roda DEPOIS de `npm run banco:aplicar -- --confirmar` (a migration 29 cria o
 * vocabulário e as projeções que este lote usa). Imprime as contagens
 * antes/depois — e nunca imprime credencial nenhuma (E-12: a string de conexão
 * é fatiada à mão, na última arroba).
 *
 * Uso:  node supabase/manutencao/2026-09-21_aplicar_manutencao_s22.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { lookup } from 'node:dns/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const verde = (t) => `\x1b[32m${t}\x1b[0m`
const vermelho = (t) => `\x1b[31m${t}\x1b[0m`
const titulo = (t) => console.log(`\n\x1b[1m== ${t} ==\x1b[0m`)

function carregarAmbiente() {
  const arquivo = path.join(RAIZ, '.env.local')
  if (!existsSync(arquivo)) {
    console.error(vermelho('Falta o .env.local (o mesmo do aplicador de migrations).'))
    process.exit(1)
  }
  const ambiente = {}
  for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const achado = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (achado) ambiente[achado[1]] = achado[2].trim().replace(/^["']|["']$/g, '')
  }
  if (!ambiente.SUPABASE_DB_URL) {
    console.error(vermelho('SUPABASE_DB_URL está vazia no .env.local.'))
    process.exit(1)
  }
  return ambiente
}

// E-12: a senha vai crua ao driver — corte na ÚLTIMA arroba, nunca parser de URL.
function partirConexao(url) {
  const semEsquema = url.slice(url.indexOf('://') + 3)
  const corte = semEsquema.lastIndexOf('@')
  const credenciais = semEsquema.slice(0, corte)
  const destino = semEsquema.slice(corte + 1)
  const divisor = credenciais.indexOf(':')
  const user = decodeURIComponent(credenciais.slice(0, divisor))
  const password = credenciais.slice(divisor + 1)
  const [hostPorta, database = 'postgres'] = destino.split('/')
  const [host, porta = '5432'] = hostPorta.split(':')
  return { user, password, host, port: Number(porta), database: database.split('?')[0] }
}

// A-15: sem rota IPv6 o host direto não resolve — o pooler certo é o que
// CONHECE o tenant, então testa-se conectando (mesmo remédio do aplicador).
const REGIOES = { axnzldwgwsmepukdiljx: 'ca-central-1' }
async function conectarComFallback(cfg) {
  const candidatos = []
  try {
    await lookup(cfg.host)
    candidatos.push(cfg)
  } catch { /* host direto sem rota */ }
  const ref = (cfg.host.match(/^db\.([a-z]+)\.supabase\.co$/) || [])[1]
    || (cfg.user.match(/^postgres\.([a-z]+)$/) || [])[1]
  const regiao = REGIOES[ref]
  if (regiao) {
    for (const n of [0, 1]) {
      candidatos.push({
        ...cfg,
        host: `aws-${n}-${regiao}.pooler.supabase.com`,
        port: 5432,
        user: `postgres.${ref}`,
      })
    }
  }
  let ultimoErro
  for (const candidato of candidatos) {
    const tentativa = new pg.Client({ ...candidato, ssl: { rejectUnauthorized: false } })
    try {
      await tentativa.connect()
      if (candidato.host !== cfg.host)
        console.log(`  · sem rota até ${cfg.host} — usando o session pooler ${candidato.host}`)
      return tentativa
    } catch (erro) {
      ultimoErro = erro
      try { await tentativa.end() } catch { /* já caiu */ }
    }
  }
  console.error(vermelho(`Nenhum caminho até o banco funcionou: ${ultimoErro?.message}`))
  process.exit(1)
}

const cliente = await conectarComFallback(partirConexao(carregarAmbiente().SUPABASE_DB_URL))

try {
  // A migration 29 precisa estar aplicada (o lote usa o vocabulário dela).
  const { rows: pronto } = await cliente.query(`
    select exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'plt_cards'
                      and column_name = 'liberado_completo_em') as ok`)
  if (!pronto[0].ok) {
    console.error(vermelho('A migration 29 ainda não foi aplicada — rode antes: npm run banco:aplicar -- --confirmar'))
    process.exit(1)
  }

  titulo('1 · Limite padrão 1 nos setores (D-48)')
  const { rows: setoresAntes } = await cliente.query(`
    select nome, limite_execucoes_por_pessoa as limite
      from public.plt_setores order by ordem, id`)
  for (const s of setoresAntes)
    console.log(`  ${s.nome.padEnd(22)} limite ${s.limite ?? 'sem limite'}`)
  const { rowCount: setoresMudados } = await cliente.query(`
    update public.plt_setores
       set limite_execucoes_por_pessoa = 1
     where limite_execucoes_por_pessoa is null`)
  console.log(verde(`  ✔ ${setoresMudados} setor(es) passaram de "sem limite" para 1`))

  titulo('2 · Cards vivos da "Chegada" → etapa fila (evento em lote, origem api)')
  const SQL_RETRATO = `
    select s.nome as setor, count(*)::int as cards
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id
     where c.etapa_atual_id is null
       and c.arquivado_em is null
       and s.papel_no_fluxo = 'producao'
       and exists (select 1 from public.plt_etapas e
                    where e.setor_id = s.id and e.eh_fila and e.ativa)
     group by s.nome order by s.nome`
  const { rows: antes } = await cliente.query(SQL_RETRATO)
  if (antes.length === 0) console.log('  nenhum card na "Chegada" de setor com fila')
  for (const l of antes) console.log(`  ${l.setor.padEnd(22)} ${l.cards} card(s) na Chegada`)

  const { rowCount: migrados } = await cliente.query(`
    insert into public.plt_eventos
        (card_id, tipo, origem, setor_origem_id, setor_destino_id, etapa_destino_id, observacao)
    select c.id, 'movimentacao_etapa', 'api', c.setor_atual_id, c.setor_atual_id, f.id,
           'Migração da coluna Chegada para a etapa fila do setor (fim da Chegada nos setores de produção — SESSAO-22).'
      from public.plt_cards c
      join public.plt_setores s on s.id = c.setor_atual_id
      cross join lateral (
        select e.id from public.plt_etapas e
         where e.setor_id = s.id and e.eh_fila and e.ativa
         order by e.ordem, e.id limit 1
      ) f
     where c.etapa_atual_id is null
       and c.arquivado_em is null
       and s.papel_no_fluxo = 'producao'`)
  console.log(verde(`  ✔ ${migrados} card(s) migrados por evento`))

  const { rows: depois } = await cliente.query(SQL_RETRATO)
  if (depois.length === 0) {
    console.log(verde('  ✔ conferência: ZERO cards restantes na "Chegada" de setores com fila'))
  } else {
    console.log(vermelho('  ✘ ainda restam cards na Chegada — investigar:'))
    for (const l of depois) console.log(`    ${l.setor}: ${l.cards}`)
    process.exit(1)
  }

  console.log(verde('\nManutenção da SESSAO-22 aplicada.'))
} finally {
  await cliente.end()
}
