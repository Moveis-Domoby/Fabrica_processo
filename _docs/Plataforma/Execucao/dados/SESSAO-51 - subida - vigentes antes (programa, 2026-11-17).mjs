// Para cada função/visão que as migrations da SESSAO-51 recriam, grava a versão VIGENTE
// ANTES delas (a última definição nas migrations anteriores ao CORTE (20261116000000)) numa pasta —
// é o que o banco vivo tem de ter antes de aplicar (o conferir-vivas compara o md5 do corpo).
// Uso: node vigentes-antes.mjs <repo> <pasta de saída> <migration da sessão>...
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const [RAIZ, SAIDA, ...SESSAO] = process.argv.slice(2)
const PASTA = path.join(RAIZ, 'supabase/migrations')
const CORTE = process.env.CORTE ?? '20261116000000'
const todas = readdirSync(PASTA).filter((f) => f.endsWith('.sql')).sort()
const ler = (f) => readFileSync(path.join(PASTA, f), 'utf8').replace(/\r\n/g, '\n')
const re = /create\s+(?:or\s+replace\s+)?(function|view)\s+(plt_privado|public)\.([a-z_0-9]+)/gi

function definicoes(texto) {
  const lista = []
  re.lastIndex = 0
  let m
  while ((m = re.exec(texto))) {
    const ini = m.index
    let fim
    if (/view/i.test(m[1])) fim = texto.indexOf(';\n', ini) + 1
    else {
      const d = texto.slice(ini).match(/\bas\s+(\$[A-Za-z_]*\$)/i)
      if (!d) continue
      const abre = ini + d.index + d[0].length
      const fecha = texto.indexOf(d[1], abre)
      fim = texto.indexOf(';', fecha + d[1].length) + 1
    }
    lista.push({ tipo: m[1].toLowerCase(), nome: `${m[2]}.${m[3]}`.toLowerCase(), texto: texto.slice(ini, fim) })
  }
  return lista
}

const recriadas = new Set()
for (const f of SESSAO) for (const d of definicoes(ler(f))) recriadas.add(d.nome)

const vigente = new Map()
for (const f of todas.filter((x) => x < CORTE)) {
  for (const d of definicoes(ler(f))) if (recriadas.has(d.nome)) vigente.set(d.nome, { ...d, arq: f })
}

rmSync(SAIDA, { recursive: true, force: true })
mkdirSync(SAIDA, { recursive: true })
const novas = []
for (const nome of [...recriadas].sort()) {
  const v = vigente.get(nome)
  if (!v) { novas.push(nome); continue }
  writeFileSync(path.join(SAIDA, `${nome}.sql`), `-- vigente em ${v.arq}\n${v.texto}\n`)
}
console.log(`recriadas pelas migrations da sessão: ${recriadas.size} · com versão anterior: ${vigente.size} · novas: ${novas.length}`)
console.log(`novas (não podem existir no banco vivo antes): ${novas.join(', ')}`)
process.exit(0)
