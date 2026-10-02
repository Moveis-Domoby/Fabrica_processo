import type { Gatilho, TipoPasso } from './catalogo'

/**
 * O DESENHO de uma automação (SESSAO-27 · D-103) — lógica pura, testada no
 * Vitest. O canvas tem um bloco QUANDO (id `q`) e blocos FAÇA; as ligações
 * formam UMA sequência a partir do QUANDO (cada bloco tem no máximo uma
 * entrada e uma saída). Bloco fora da sequência fica "solto" e não roda.
 * O banco recebe só a sequência (`passos`); o desenho (posições, soltos) é
 * guardado à parte, só para a tela.
 */

export type Passo = { tipo: TipoPasso } & Record<string, unknown>

export interface Posicao {
  x: number
  y: number
}

export interface BlocoFaca {
  id: string
  passo: Passo
  posicao: Posicao
}

export interface Ligacao {
  de: string
  para: string
}

export interface EstadoDesenho {
  gatilho: Gatilho
  gatilhoConfig: Record<string, unknown>
  posicaoQuando: Posicao
  blocos: BlocoFaca[]
  ligacoes: Ligacao[]
}

export const ID_QUANDO = 'q'
export const LARGURA_BLOCO = 240
export const ALTURA_BLOCO = 104
const PASSO_X = 300
const INICIO = { x: 40, y: 80 }

/** A sequência, em ordem, a partir do QUANDO (ids dos blocos FAÇA). */
export function sequencia(estado: EstadoDesenho): string[] {
  const saida = new Map(estado.ligacoes.map((l) => [l.de, l.para]))
  const ids = new Set(estado.blocos.map((b) => b.id))
  const ordem: string[] = []
  let atual = saida.get(ID_QUANDO)
  while (atual && ids.has(atual) && !ordem.includes(atual)) {
    ordem.push(atual)
    atual = saida.get(atual)
  }
  return ordem
}

/** Os passos que o banco recebe — só os da sequência, na ordem. */
export function passosDaSequencia(estado: EstadoDesenho): Passo[] {
  const porId = new Map(estado.blocos.map((b) => [b.id, b]))
  return sequencia(estado).map((id) => porId.get(id)!.passo)
}

/** Blocos fora da sequência (não rodam — a tela avisa). */
export function soltos(estado: EstadoDesenho): string[] {
  const naSequencia = new Set(sequencia(estado))
  return estado.blocos.map((b) => b.id).filter((id) => !naSequencia.has(id))
}

/** Dá para ligar `de` → `para`? Nunca ao QUANDO, nunca a si mesmo, nunca fechando um ciclo. */
export function podeLigar(estado: EstadoDesenho, de: string, para: string): boolean {
  if (para === ID_QUANDO || de === para) return false
  if (de !== ID_QUANDO && !estado.blocos.some((b) => b.id === de)) return false
  if (!estado.blocos.some((b) => b.id === para)) return false
  // seguindo a saída a partir de `para`, chega-se a `de`? então fecharia um ciclo
  const saida = new Map(estado.ligacoes.map((l) => [l.de, l.para]))
  let atual: string | undefined = para
  const vistos = new Set<string>()
  while (atual && !vistos.has(atual)) {
    if (atual === de) return false
    vistos.add(atual)
    atual = saida.get(atual)
  }
  return true
}

/** Liga `de` → `para`, trocando a saída antiga de `de` e a entrada antiga de `para`. */
export function ligar(estado: EstadoDesenho, de: string, para: string): EstadoDesenho {
  if (!podeLigar(estado, de, para)) return estado
  const ligacoes = estado.ligacoes.filter((l) => l.de !== de && l.para !== para)
  return { ...estado, ligacoes: [...ligacoes, { de, para }] }
}

/** Tira a ligação que sai de `de`. */
export function desligar(estado: EstadoDesenho, de: string): EstadoDesenho {
  return { ...estado, ligacoes: estado.ligacoes.filter((l) => l.de !== de) }
}

function novoId(estado: EstadoDesenho): string {
  let n = estado.blocos.length + 1
  const usados = new Set(estado.blocos.map((b) => b.id))
  while (usados.has(`p${n}`)) n += 1
  return `p${n}`
}

function posicaoDe(estado: EstadoDesenho, id: string): Posicao {
  if (id === ID_QUANDO) return estado.posicaoQuando
  return estado.blocos.find((b) => b.id === id)?.posicao ?? INICIO
}

/**
 * Põe um bloco novo logo DEPOIS de `depoisDe` (no QUANDO ou num bloco): ele
 * entra na sequência no meio, e quem vinha depois passa a vir depois dele.
 * Devolve o estado e o id do bloco novo.
 */
export function inserirDepois(
  estado: EstadoDesenho,
  depoisDe: string,
  passo: Passo,
): { estado: EstadoDesenho; id: string } {
  const id = novoId(estado)
  const base = posicaoDe(estado, depoisDe)
  const proximo = estado.ligacoes.find((l) => l.de === depoisDe)?.para
  // quem vinha depois (e a fila inteira à frente) anda um passo para a direita
  const aFrente = new Set<string>()
  if (proximo) {
    const saida = new Map(estado.ligacoes.map((l) => [l.de, l.para]))
    let atual: string | undefined = proximo
    while (atual && !aFrente.has(atual)) {
      aFrente.add(atual)
      atual = saida.get(atual)
    }
  }
  const blocos = estado.blocos.map((b) =>
    aFrente.has(b.id) ? { ...b, posicao: { x: b.posicao.x + PASSO_X, y: b.posicao.y } } : b,
  )
  blocos.push({ id, passo, posicao: { x: base.x + PASSO_X, y: base.y } })
  const ligacoes = estado.ligacoes.filter((l) => l.de !== depoisDe)
  ligacoes.push({ de: depoisDe, para: id })
  if (proximo) ligacoes.push({ de: id, para: proximo })
  return { estado: { ...estado, blocos, ligacoes }, id }
}

/** Tira um bloco; se ele estava no meio da sequência, quem vinha antes liga em quem vinha depois. */
export function remover(estado: EstadoDesenho, id: string): EstadoDesenho {
  if (id === ID_QUANDO) return estado
  const anterior = estado.ligacoes.find((l) => l.para === id)?.de
  const proximo = estado.ligacoes.find((l) => l.de === id)?.para
  const ligacoes = estado.ligacoes.filter((l) => l.de !== id && l.para !== id)
  if (anterior && proximo) ligacoes.push({ de: anterior, para: proximo })
  return { ...estado, blocos: estado.blocos.filter((b) => b.id !== id), ligacoes }
}

export function moverBloco(estado: EstadoDesenho, id: string, posicao: Posicao): EstadoDesenho {
  const p = { x: Math.round(posicao.x), y: Math.round(posicao.y) }
  if (id === ID_QUANDO) return { ...estado, posicaoQuando: p }
  return { ...estado, blocos: estado.blocos.map((b) => (b.id === id ? { ...b, posicao: p } : b)) }
}

export function trocarPasso(estado: EstadoDesenho, id: string, passo: Passo): EstadoDesenho {
  return { ...estado, blocos: estado.blocos.map((b) => (b.id === id ? { ...b, passo } : b)) }
}

/** O desenho como o banco guarda (só para a tela): posições, blocos e ligações. */
export interface DesenhoGuardado {
  versao: 1
  quando: Posicao
  blocos: BlocoFaca[]
  ligacoes: Ligacao[]
}

export function paraGuardar(estado: EstadoDesenho): { passos: Passo[]; desenho: DesenhoGuardado } {
  return {
    passos: passosDaSequencia(estado),
    desenho: { versao: 1, quando: estado.posicaoQuando, blocos: estado.blocos, ligacoes: estado.ligacoes },
  }
}

/** Igualdade por conteúdo, sem ligar para a ordem das chaves (o jsonb do banco reordena). */
export function mesmoConteudo(a: unknown, b: unknown): boolean {
  const ordenar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(ordenar)
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, ordenar((v as Record<string, unknown>)[k])]),
      )
    }
    return v
  }
  return JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b))
}

function ehPosicao(valor: unknown): valor is Posicao {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    Number.isFinite((valor as Posicao).x) &&
    Number.isFinite((valor as Posicao).y)
  )
}

/**
 * Remonta o desenho a partir do que o banco devolve. Os PASSOS são a verdade:
 * se o desenho guardado bate com eles, valem as posições e os blocos soltos;
 * senão (ex.: os exemplos de fábrica, criados sem desenho completo), a
 * sequência é refeita dos passos, em linha.
 */
export function montarDesenho(automacao: {
  gatilho: Gatilho
  gatilho_config: Record<string, unknown> | null
  passos: Passo[] | null
  desenho: unknown
}): EstadoDesenho {
  const passos = automacao.passos ?? []
  const guardado = automacao.desenho as Partial<DesenhoGuardado> & { nos?: { id: string; x: number; y: number }[] }
  const base = {
    gatilho: automacao.gatilho,
    gatilhoConfig: automacao.gatilho_config ?? {},
  }

  if (guardado && guardado.versao === 1 && Array.isArray(guardado.blocos) && Array.isArray(guardado.ligacoes)) {
    const estado: EstadoDesenho = {
      ...base,
      posicaoQuando: ehPosicao(guardado.quando) ? guardado.quando : INICIO,
      blocos: guardado.blocos.filter((b) => b && typeof b.id === 'string' && b.passo && ehPosicao(b.posicao)),
      ligacoes: guardado.ligacoes.filter((l) => l && typeof l.de === 'string' && typeof l.para === 'string'),
    }
    if (mesmoConteudo(passosDaSequencia(estado), passos)) return estado
  }

  // em linha, a partir dos passos (com as posições antigas por id, se houver)
  const antigas = new Map((guardado?.nos ?? []).filter(ehPosicao).map((n) => [n.id, { x: n.x, y: n.y }]))
  const posicaoQuando = antigas.get(ID_QUANDO) ?? INICIO
  const blocos: BlocoFaca[] = passos.map((passo, i) => {
    const id = `p${i + 1}`
    return { id, passo, posicao: antigas.get(id) ?? { x: posicaoQuando.x + PASSO_X * (i + 1), y: posicaoQuando.y } }
  })
  const ligacoes: Ligacao[] = blocos.map((b, i) => ({ de: i === 0 ? ID_QUANDO : blocos[i - 1].id, para: b.id }))
  return { ...base, posicaoQuando, blocos, ligacoes }
}

/** Uma automação nova: só o QUANDO, no canto. */
export function desenhoNovo(gatilho: Gatilho = 'card_entrou'): EstadoDesenho {
  return { gatilho, gatilhoConfig: {}, posicaoQuando: INICIO, blocos: [], ligacoes: [] }
}

/** O retângulo que cabe todos os blocos (para "caber na tela"). */
export function limites(estado: EstadoDesenho): { x: number; y: number; largura: number; altura: number } {
  const pontos = [estado.posicaoQuando, ...estado.blocos.map((b) => b.posicao)]
  const xs = pontos.map((p) => p.x)
  const ys = pontos.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    x,
    y,
    largura: Math.max(...xs) + LARGURA_BLOCO - x,
    altura: Math.max(...ys) + ALTURA_BLOCO - y,
  }
}
