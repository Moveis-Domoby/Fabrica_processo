import type { EstadoReposicao, LinhaEstoqueProduto } from './api'

/**
 * O "sinal" de cada produto na tela de Estoque (SESSAO-25) — lógica pura, sem
 * React, testada no Vitest. Estado nunca só por cor (M-12): cada tom tem ícone
 * e texto na tela; aqui mora só a regra de QUAL sinal vale.
 *
 * Ordem de prioridade (a mesma da ordenação do servidor):
 *   1. sem leitura do Tiny   — não dá para decidir nada;
 *   2. necessidade extrema   — vendido sem estoque (o disponível passou do zero);
 *   3. abaixo do mínimo      — repor até o mínimo (o estoque gera o card no PCP);
 *   4. sem mínimo no Tiny    — nada a sinalizar;
 *   5. no mínimo ou acima.
 */
export type TomSinal = 'sem_leitura' | 'extrema' | 'abaixo' | 'sem_minimo' | 'ok'

export interface SinalProduto {
  tom: TomSinal
  texto: string
  /** Complemento: a reposição, quando há. */
  detalhe?: string
}

const plural = (n: number, singular: string, pluralTexto: string) =>
  `${n} ${n === 1 ? singular : pluralTexto}`

/** Em língua do galpão: onde está a reposição mais recente do produto. */
export function textoReposicao(estado: EstadoReposicao | null | undefined): string | undefined {
  switch (estado) {
    case 'no_pcp':
      return 'reposição aguardando o PCP'
    case 'em_producao':
      return 'reposição em produção'
    case 'concluida':
      return 'reposição pronta — falta entrar no Tiny'
    case 'arquivada':
      return 'o PCP decidiu não produzir'
    default:
      return undefined
  }
}

export function sinalDoProduto(
  linha: Pick<
    LinhaEstoqueProduto,
    'saldo_tiny' | 'necessidade_extrema' | 'abaixo_minimo' | 'minimo' | 'repor' | 'reposicao_estado'
  >,
): SinalProduto {
  if (linha.saldo_tiny === null) {
    return { tom: 'sem_leitura', texto: 'Sem leitura do Tiny ainda' }
  }
  const reposicao = textoReposicao(linha.reposicao_estado)
  if (linha.necessidade_extrema > 0) {
    return {
      tom: 'extrema',
      texto: `Necessidade extrema — ${plural(linha.necessidade_extrema, 'vendido', 'vendidos')} sem estoque`,
      detalhe: reposicao,
    }
  }
  if (linha.abaixo_minimo) {
    return {
      tom: 'abaixo',
      texto: `Abaixo do mínimo — repor ${linha.repor}`,
      detalhe: reposicao,
    }
  }
  if (linha.minimo === null || linha.minimo <= 0) {
    return { tom: 'sem_minimo', texto: 'Sem mínimo no Tiny' }
  }
  return { tom: 'ok', texto: 'No mínimo ou acima' }
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
