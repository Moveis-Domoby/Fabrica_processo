import type { EstadoReposicao, LinhaEstoqueProduto, OperacaoEstoque } from './api'

/**
 * O "sinal" de cada produto na tela de Estoque — lógica pura, sem React,
 * testada no Vitest. Estado nunca só por cor (M-12): cada tom tem ícone e texto
 * na tela; aqui mora só a regra de QUAL sinal vale.
 *
 * Ajuste de 28/09 (D-70): o número dos acabados é a contagem da logística
 * (nunca negativa) — acabou a "necessidade extrema", que era o negativo do
 * Tiny. Com mínimo: sem estoque · faltam N · no mínimo. Sem mínimo, só se
 * avisa o "sem estoque" (neutro); com estoque, nada a sinalizar (tela enxuta).
 */
export type TomSinal = 'sem_estoque' | 'abaixo' | 'ok' | 'neutro'

export interface SinalProduto {
  tom: TomSinal
  texto: string
}

export function sinalDoProduto(
  linha: Pick<LinhaEstoqueProduto, 'em_estoque' | 'minimo'>,
): SinalProduto | null {
  const estoque = Math.max(linha.em_estoque ?? 0, 0)
  const minimo = linha.minimo ?? 0
  if (minimo > 0) {
    if (estoque === 0) return { tom: 'sem_estoque', texto: 'Sem estoque' }
    if (estoque < minimo) {
      const faltam = Math.ceil(minimo - estoque)
      return { tom: 'abaixo', texto: `Faltam ${faltam} para o mínimo` }
    }
    return { tom: 'ok', texto: 'No mínimo' }
  }
  if (estoque === 0) return { tom: 'neutro', texto: 'Sem estoque' }
  return null
}

/** Em língua do galpão: a reposição que ainda está andando (as outras não se mostram). */
export function textoReposicao(estado: EstadoReposicao | null | undefined): string | undefined {
  switch (estado) {
    case 'no_pcp':
      return 'reposição pedida ao PCP'
    case 'em_producao':
      return 'reposição em produção'
    default:
      return undefined
  }
}

/** "1º", "2º"… — a posição do produto nas vendas dos 90 dias. */
export function rotuloPosicao(posicao: number | null): string | null {
  return posicao === null ? null : `${posicao}º`
}

/**
 * O que a movimentação vai fazer, em português, antes de confirmar. Na
 * contagem, a diferença decide se entra ou sai.
 */
export function previaMovimento(
  operacao: OperacaoEstoque,
  quantidade: number,
  atual: number,
): { depois: number; texto: string; valida: boolean } {
  const q = Number.isFinite(quantidade) ? Math.trunc(quantidade) : NaN
  if (operacao === 'contagem') {
    if (!(q >= 0 && q <= 500)) return { depois: atual, texto: 'Informe de 0 a 500.', valida: false }
    const diferenca = q - atual
    if (diferenca === 0) {
      return {
        depois: q,
        texto: 'Bate com o que já está aqui — fica registrado que foi conferido.',
        valida: true,
      }
    }
    // Plural por extenso nas duas formas (E-52).
    const n = Math.abs(diferenca)
    const verbo =
      diferenca > 0 ? (n === 1 ? 'Entra 1 peça' : `Entram ${n} peças`) : n === 1 ? 'Sai 1 peça' : `Saem ${n} peças`
    return { depois: q, texto: `${verbo} (de ${atual} para ${q}).`, valida: true }
  }
  if (!(q >= 1 && q <= 500)) return { depois: atual, texto: 'Informe de 1 a 500.', valida: false }
  if (operacao === 'baixa') {
    if (q > atual) {
      return {
        depois: atual,
        texto: `Só há ${atual} no estoque — não dá para dar baixa em ${q}.`,
        valida: false,
      }
    }
    return { depois: atual - q, texto: `Fica${atual - q === 1 ? '' : 'm'} ${atual - q} no estoque.`, valida: true }
  }
  return { depois: atual + q, texto: `Fica${atual + q === 1 ? '' : 'm'} ${atual + q} no estoque.`, valida: true }
}

/** "há 2 h", "há 3 dias" — a idade da leitura do Tiny, para a equipe confiar no número. */
export function idadeDaLeitura(lidoEm: string | null, agora: number): string | null {
  if (!lidoEm) return null
  const minutos = Math.max(0, Math.round((agora - new Date(lidoEm).getTime()) / 60_000))
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 48) return `há ${horas} h`
  return `há ${Math.round(horas / 24)} dias`
}

/** O número de estoque/quantidade como a equipe lê: inteiro quando é inteiro. */
export function formatarQuantidade(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—'
  return Number.isInteger(valor)
    ? String(valor)
    : valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}
