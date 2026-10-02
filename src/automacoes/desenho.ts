import type { Gatilho, TipoPasso } from './catalogo'

/**
 * O DESENHO de uma automação (SESSAO-27 · D-103) — lógica pura, testada no
 * Vitest. O canvas tem um bloco QUANDO (id `q`) e blocos FAÇA; as ligações
 * formam a sequência a partir do QUANDO (cada bloco tem no máximo uma
 * entrada). O "Se… senão" (D-105, pedido do dono) tem DUAS saídas — Sim e
 * Senão — e cada uma segue com os próprios passos: a sequência vira uma
 * árvore. Bloco fora dela fica "solto" e não roda. O banco recebe só os
 * passos (`passos`, com `entao`/`senao` dentro do "Se… senão"); o desenho
 * (posições, soltos) é guardado à parte, só para a tela.
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

/** As duas saídas do "Se… senão". */
export type Saida = 'sim' | 'nao'

export interface Ligacao {
  de: string
  para: string
  /** só no "Se… senão": por qual das duas saídas a ligação sai */
  saida?: Saida
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
/** O caminho Senão desce uma "linha" abaixo do Sim. */
export const DESVIO_SENAO = ALTURA_BLOCO + 56
const INICIO = { x: 40, y: 80 }

/** O bloco tem as duas saídas (Sim e Senão)? */
export function temDuasSaidas(passo: Passo | undefined): boolean {
  return passo?.tipo === 'se_senao'
}

function mesmaSaida(l: Ligacao, de: string, saida?: Saida): boolean {
  return l.de === de && (l.saida ?? null) === (saida ?? null)
}

function blocoDe(estado: EstadoDesenho, id: string): BlocoFaca | undefined {
  return estado.blocos.find((b) => b.id === id)
}

/** As saídas que valem de um bloco: Sim e Senão no "Se… senão"; a única nos outros. */
function saidasDe(estado: EstadoDesenho, id: string): (Saida | undefined)[] {
  return id !== ID_QUANDO && temDuasSaidas(blocoDe(estado, id)?.passo) ? ['sim', 'nao'] : [undefined]
}

/** Quem vem depois de `de` por aquela saída. */
export function proximoDe(estado: EstadoDesenho, de: string, saida?: Saida): string | undefined {
  return estado.ligacoes.find((l) => mesmaSaida(l, de, saida))?.para
}

/** `id` e tudo o que vem depois dele (por todas as saídas). */
function descendentes(estado: EstadoDesenho, id: string | undefined): Set<string> {
  const vistos = new Set<string>()
  const pilha = id ? [id] : []
  while (pilha.length > 0) {
    const atual = pilha.pop()!
    if (vistos.has(atual)) continue
    vistos.add(atual)
    for (const l of estado.ligacoes) if (l.de === atual) pilha.push(l.para)
  }
  return vistos
}

/**
 * Os blocos que rodam, a partir do QUANDO (ids dos blocos FAÇA), na ordem da
 * leitura: cada caminho inteiro — o Sim antes do Senão.
 */
export function sequencia(estado: EstadoDesenho): string[] {
  const ids = new Set(estado.blocos.map((b) => b.id))
  const ordem: string[] = []
  const andar = (de: string, saida?: Saida) => {
    let atual = proximoDe(estado, de, saida)
    while (atual && ids.has(atual) && !ordem.includes(atual)) {
      ordem.push(atual)
      if (temDuasSaidas(blocoDe(estado, atual)?.passo)) {
        andar(atual, 'sim')
        andar(atual, 'nao')
        return
      }
      atual = proximoDe(estado, atual)
    }
  }
  andar(ID_QUANDO)
  return ordem
}

/** O passo sem os caminhos (o bloco guarda só a configuração dele). */
function semCaminhos(passo: Passo): Passo {
  const resto = { ...passo }
  delete resto.entao
  delete resto.senao
  return resto
}

/**
 * Os passos que o banco recebe — só os que rodam, na ordem; o "Se… senão"
 * leva os dois caminhos dentro (`entao` e `senao`) e é sempre o último da
 * sua sequência (o banco recusa passo depois dele).
 */
export function passosDaSequencia(estado: EstadoDesenho): Passo[] {
  const vistos = new Set<string>()
  const linha = (de: string, saida?: Saida): Passo[] => {
    const passos: Passo[] = []
    let atual = proximoDe(estado, de, saida)
    while (atual && !vistos.has(atual)) {
      const bloco = blocoDe(estado, atual)
      if (!bloco) break
      vistos.add(atual)
      const passo = semCaminhos(bloco.passo)
      if (temDuasSaidas(passo)) {
        passos.push({ ...passo, entao: linha(atual, 'sim'), senao: linha(atual, 'nao') })
        break
      }
      passos.push(passo)
      atual = proximoDe(estado, atual)
    }
    return passos
  }
  return linha(ID_QUANDO)
}

/** Blocos fora da sequência (não rodam — a tela avisa). */
export function soltos(estado: EstadoDesenho): string[] {
  const naSequencia = new Set(sequencia(estado))
  return estado.blocos.map((b) => b.id).filter((id) => !naSequencia.has(id))
}

/**
 * Dá para ligar `de` → `para` (por aquela saída)? Nunca ao QUANDO, nunca a
 * si mesmo, nunca fechando um ciclo; o "Se… senão" liga só pelo Sim ou pelo
 * Senão, e os outros blocos só pela saída única.
 */
export function podeLigar(estado: EstadoDesenho, de: string, para: string, saida?: Saida): boolean {
  if (para === ID_QUANDO || de === para) return false
  if (de !== ID_QUANDO && !blocoDe(estado, de)) return false
  if (!blocoDe(estado, para)) return false
  if (!saidasDe(estado, de).includes(saida)) return false
  // seguindo tudo o que vem depois de `para`, chega-se a `de`? então fecharia um ciclo
  return !descendentes(estado, para).has(de)
}

/** Liga `de` → `para`, trocando a saída antiga de `de` (aquela saída) e a entrada antiga de `para`. */
export function ligar(estado: EstadoDesenho, de: string, para: string, saida?: Saida): EstadoDesenho {
  if (!podeLigar(estado, de, para, saida)) return estado
  const ligacoes = estado.ligacoes.filter((l) => !mesmaSaida(l, de, saida) && l.para !== para)
  return { ...estado, ligacoes: [...ligacoes, saida ? { de, para, saida } : { de, para }] }
}

/** Tira a ligação que sai de `de` (por aquela saída). */
export function desligar(estado: EstadoDesenho, de: string, saida?: Saida): EstadoDesenho {
  return { ...estado, ligacoes: estado.ligacoes.filter((l) => !mesmaSaida(l, de, saida)) }
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
 * Põe um bloco novo logo DEPOIS de `depoisDe` (no QUANDO ou num bloco; no
 * "Se… senão", pela saída escolhida): ele entra na sequência no meio, e quem
 * vinha depois passa a vir depois dele — se o bloco novo é um "Se… senão",
 * quem vinha depois segue pelo Sim. Devolve o estado e o id do bloco novo.
 */
export function inserirDepois(
  estado: EstadoDesenho,
  depoisDe: string,
  passo: Passo,
  saida?: Saida,
): { estado: EstadoDesenho; id: string } {
  const id = novoId(estado)
  const base = posicaoDe(estado, depoisDe)
  const proximo = proximoDe(estado, depoisDe, saida)
  // quem vinha depois (e tudo à frente dele) anda um passo para a direita
  const aFrente = descendentes(estado, proximo)
  const blocos = estado.blocos.map((b) =>
    aFrente.has(b.id) ? { ...b, posicao: { x: b.posicao.x + PASSO_X, y: b.posicao.y } } : b,
  )
  // o bloco novo fica na linha de quem ele empurrou; sem ninguém, o Senão desce
  const y = proximo ? posicaoDe(estado, proximo).y : base.y + (saida === 'nao' ? DESVIO_SENAO : 0)
  blocos.push({ id, passo, posicao: { x: base.x + PASSO_X, y } })
  const ligacoes = estado.ligacoes.filter((l) => !mesmaSaida(l, depoisDe, saida))
  ligacoes.push(saida ? { de: depoisDe, para: id, saida } : { de: depoisDe, para: id })
  if (proximo) ligacoes.push(temDuasSaidas(passo) ? { de: id, para: proximo, saida: 'sim' } : { de: id, para: proximo })
  return { estado: { ...estado, blocos, ligacoes }, id }
}

/**
 * Tira um bloco; se ele estava no meio da sequência, quem vinha antes liga em
 * quem vinha depois (num "Se… senão", o caminho Sim continua; o Senão fica solto).
 */
export function remover(estado: EstadoDesenho, id: string): EstadoDesenho {
  if (id === ID_QUANDO) return estado
  const entrada = estado.ligacoes.find((l) => l.para === id)
  const proximo = estado.ligacoes.find((l) => l.de === id && (l.saida ?? 'sim') === 'sim')?.para
  const ligacoes = estado.ligacoes.filter((l) => l.de !== id && l.para !== id)
  if (entrada && proximo) {
    ligacoes.push(entrada.saida ? { de: entrada.de, para: proximo, saida: entrada.saida } : { de: entrada.de, para: proximo })
  }
  return { ...estado, blocos: estado.blocos.filter((b) => b.id !== id), ligacoes }
}

export function moverBloco(estado: EstadoDesenho, id: string, posicao: Posicao): EstadoDesenho {
  const p = { x: Math.round(posicao.x), y: Math.round(posicao.y) }
  if (id === ID_QUANDO) return { ...estado, posicaoQuando: p }
  return { ...estado, blocos: estado.blocos.map((b) => (b.id === id ? { ...b, posicao: p } : b)) }
}

/** Troca a configuração de um bloco (se ele ganhar ou perder as duas saídas, as ligações acompanham). */
export function trocarPasso(estado: EstadoDesenho, id: string, passo: Passo): EstadoDesenho {
  const antes = blocoDe(estado, id)
  const limpo = semCaminhos(passo)
  const blocos = estado.blocos.map((b) => (b.id === id ? { ...b, passo: limpo } : b))
  if (!antes || temDuasSaidas(antes.passo) === temDuasSaidas(limpo)) return { ...estado, blocos }
  const ligacoes: Ligacao[] = temDuasSaidas(limpo)
    ? estado.ligacoes.map((l) => (l.de === id ? { de: l.de, para: l.para, saida: 'sim' } : l))
    : estado.ligacoes
        .filter((l) => !(l.de === id && l.saida === 'nao'))
        .map((l) => (l.de === id ? { de: l.de, para: l.para } : l))
  return { ...estado, blocos, ligacoes }
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
      ligacoes: guardado.ligacoes
        .filter((l) => l && typeof l.de === 'string' && typeof l.para === 'string')
        .map((l) => (l.saida === 'sim' || l.saida === 'nao' ? { de: l.de, para: l.para, saida: l.saida } : { de: l.de, para: l.para })),
    }
    if (mesmoConteudo(passosDaSequencia(estado), passos)) return estado
  }

  // refeito dos passos (com as posições antigas por id, se houver): cada
  // caminho em linha; o Senão desce abaixo de tudo o que o Sim ocupou
  const antigas = new Map((guardado?.nos ?? []).filter(ehPosicao).map((n) => [n.id, { x: n.x, y: n.y }]))
  const posicaoQuando = antigas.get(ID_QUANDO) ?? INICIO
  const blocos: BlocoFaca[] = []
  const ligacoes: Ligacao[] = []
  // devolve quantas "linhas" a sequência ocupou (para o Senão saber onde descer)
  const dispor = (lista: unknown, de: string, saida: Saida | undefined, x: number, y: number): number => {
    let anterior = de
    let saidaAnterior = saida
    let xi = x
    let linhas = 1
    for (const original of Array.isArray(lista) ? (lista as Passo[]) : []) {
      const id = `p${blocos.length + 1}`
      const passo = semCaminhos(original)
      blocos.push({ id, passo, posicao: antigas.get(id) ?? { x: xi, y } })
      ligacoes.push(saidaAnterior ? { de: anterior, para: id, saida: saidaAnterior } : { de: anterior, para: id })
      if (temDuasSaidas(passo)) {
        const linhasSim = dispor(original.entao, id, 'sim', xi + PASSO_X, y)
        const linhasNao = dispor(original.senao, id, 'nao', xi + PASSO_X, y + linhasSim * DESVIO_SENAO)
        linhas = Math.max(linhas, linhasSim + linhasNao)
        break
      }
      anterior = id
      saidaAnterior = undefined
      xi += PASSO_X
    }
    return linhas
  }
  dispor(passos, ID_QUANDO, undefined, posicaoQuando.x + PASSO_X, posicaoQuando.y)
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
