/**
 * SESSAO-43 · F4 — A CARGA ÚNICA DO HISTÓRICO DO TRELLO (montagens de 13/07 a 13/10/2026)
 *
 * Lê `supabase/manutencao/dados/2026-11-05_historico_trello_montagem.csv` (o
 * `historico.csv` do painel antigo de tempos de montagem — 891 linhas, 885
 * cartões) e chama `plt_privado.fn_tempo_trello_carregar` (migration
 * 20261105030000) NUMA transação, no setor de produção chamado MONTAGEM:
 *   · uma linha por cartão (os repetidos do arquivo entram uma vez);
 *   · idempotente: rodar de novo refaz as contas das MESMAS linhas (nunca duplica,
 *     a decisão manual que já existir fica);
 *   · os sábados com montagem entram como dia trabalhado da Montagem (só eles);
 *   · a mesma conta da SESSAO-42 (janelas até o corte do dia, lote dividido,
 *     mínimo, teto, longo para o modelo) e o relatório no fim.
 * NÃO são fatos da plataforma: nada vai para plt_eventos.
 *
 * Uso (pedir o OK do dono antes — regra 2):
 *   node supabase/manutencao/2026-11-05_historico_trello.mjs              (ENSAIO: roda e desfaz)
 *   node supabase/manutencao/2026-11-05_historico_trello.mjs --confirmar  (grava)
 * Nunca imprime credencial nenhuma (E-12).
 */
import { readFileSync, existsSync } from 'node:fs'
import { lookup } from 'node:dns/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const ARQUIVO_HISTORICO = path.join(RAIZ, 'supabase/manutencao/dados/2026-11-05_historico_trello_montagem.csv')

/** CSV com aspas, vírgula e quebra de linha dentro do campo (o nome de alguns cartões tem). */
export function lerCsv(texto) {
  const linhas = []
  let campo = ''
  let linha = []
  let aspas = false
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (aspas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++ } else aspas = false
      } else campo += ch
    } else if (ch === '"') aspas = true
    else if (ch === ',') { linha.push(campo); campo = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      if (linha.length > 1 || linha[0] !== '') linhas.push(linha)
      linha = []
    } else campo += ch
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas
}

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** As linhas do histórico no formato da carga: {cartao_id, nome, url, etiquetas[], inicio, fim}. */
export function linhasDoHistorico(texto) {
  const [cabecalho, ...resto] = lerCsv(texto.replace(/^﻿/, ''))
  const coluna = (...nomes) => cabecalho.findIndex((c) => nomes.map(semAcento).includes(semAcento(c)))
  const iId = coluna('Card ID')
  const iNome = coluna('Card Name', 'Movel')
  const iUrl = coluna('Card URL')
  const iEtq = coluna('Labels', 'Etiquetas')
  const iIni = coluna('Inicio montagem', 'Inicio')
  const iFim = coluna('Fim montagem', 'Fim')
  if ([iId, iNome, iEtq, iIni, iFim].some((i) => i < 0)) {
    throw new Error('O arquivo não tem as colunas do histórico (Card ID, Card Name, Labels, Início e Fim montagem).')
  }
  return resto
    .filter((r) => r.length >= cabecalho.length)
    .map((r) => ({
      cartao_id: r[iId].trim(),
      nome: r[iNome],
      url: iUrl >= 0 ? r[iUrl] : null,
      etiquetas: r[iEtq].split(',').map((s) => s.trim()).filter(Boolean),
      inicio: r[iIni].trim(),
      fim: r[iFim].trim(),
    }))
}

// ---------------------------------------------------------------------------
// Rodando como programa (não como módulo da bateria)
// ---------------------------------------------------------------------------
const ehPrograma = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (ehPrograma) {
  const { default: pg } = await import('pg')
  const verde = (t) => `\x1b[32m${t}\x1b[0m`
  const vermelho = (t) => `\x1b[31m${t}\x1b[0m`
  const amarelo = (t) => `\x1b[33m${t}\x1b[0m`
  const confirmar = process.argv.includes('--confirmar')

  const arquivoEnv = path.join(RAIZ, '.env.local')
  if (!existsSync(arquivoEnv)) {
    console.error(vermelho('Falta o .env.local (o mesmo do aplicador de migrations).'))
    process.exit(1)
  }
  const ambiente = {}
  for (const linha of readFileSync(arquivoEnv, 'utf8').split(/\r?\n/)) {
    const achado = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (achado) ambiente[achado[1]] = achado[2].trim().replace(/^["']|["']$/g, '')
  }
  // E-12: a senha vai crua ao driver — corte na ÚLTIMA arroba, nunca parser de URL.
  const url = ambiente.SUPABASE_DB_URL
  const semEsquema = url.slice(url.indexOf('://') + 3)
  const corte = semEsquema.lastIndexOf('@')
  const cred = semEsquema.slice(0, corte)
  const destino = semEsquema.slice(corte + 1)
  const divisor = cred.indexOf(':')
  const [hostPorta, banco = 'postgres'] = destino.split('/')
  const [host, porta = '5432'] = hostPorta.split(':')
  const cfg = { user: decodeURIComponent(cred.slice(0, divisor)), password: cred.slice(divisor + 1), host, port: Number(porta), database: banco.split('?')[0] }
  // A-15: sem rota IPv6, o session pooler da região (o que conhece o projeto)
  const candidatos = []
  try { await lookup(cfg.host); candidatos.push(cfg) } catch { /* sem rota */ }
  const ref = (cfg.host.match(/^db\.([a-z]+)\.supabase\.co$/) || [])[1] || (cfg.user.match(/^postgres\.([a-z]+)$/) || [])[1]
  if (ref === 'axnzldwgwsmepukdiljx') {
    for (const n of [0, 1]) candidatos.push({ ...cfg, host: `aws-${n}-ca-central-1.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` })
  }
  let cliente
  for (const c of candidatos) {
    const tentativa = new pg.Client({ ...c, ssl: { rejectUnauthorized: false } })
    try { await tentativa.connect(); cliente = tentativa; break } catch { try { await tentativa.end() } catch { /* */ } }
  }
  if (!cliente) {
    console.error(vermelho('Nenhum caminho até o banco funcionou.'))
    process.exit(1)
  }

  const linhas = linhasDoHistorico(readFileSync(ARQUIVO_HISTORICO, 'utf8'))
  console.log(`Arquivo: ${linhas.length} linhas`)
  try {
    const { rows: setores } = await cliente.query(`
      select s.id, s.nome from public.plt_setores s
       where s.papel_no_fluxo = 'producao' and s.ativo and upper(s.nome) like '%MONTAGEM%' order by s.ordem`)
    if (setores.length !== 1) {
      console.error(vermelho(`Esperava um setor MONTAGEM de produção; achei ${setores.length}.`))
      process.exit(1)
    }
    await cliente.query('begin')
    await cliente.query("set local lock_timeout = '5s'")
    const { rows } = await cliente.query('select plt_privado.fn_tempo_trello_carregar($1, $2::jsonb) as r',
      [setores[0].id, JSON.stringify(linhas)])
    const r = rows[0].r
    console.log(`\nSetor: ${setores[0].nome}\n`)
    console.log(JSON.stringify(r, null, 2))
    const perto = (v, alvo, folga) => Math.abs(Number(v) - alvo) <= folga
    console.log(`\nEsperado pela demanda (cálculo do Cowork): ~813 válidas, mediana ~44 min, média ~54 min.`)
    console.log(`${perto(r.validas, 813, 25) ? verde('✔') : amarelo('!')} válidas ${r.validas} · mediana ${r.mediana_min} min · média ${r.media_min} min (a conta crua: ${r.crua_media_min} min)`)
    if (confirmar) {
      await cliente.query('commit')
      console.log(verde('\nGRAVADO.'))
    } else {
      await cliente.query('rollback')
      console.log(amarelo('\nENSAIO — nada foi gravado (rode com --confirmar, depois do OK do dono).'))
    }
  } catch (erro) {
    try { await cliente.query('rollback') } catch { /* */ }
    console.error(vermelho(`Erro: ${erro.message}`))
    process.exitCode = 1
  } finally {
    await cliente.end()
  }
}
