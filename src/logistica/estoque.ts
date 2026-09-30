import type { EstadoReposicao, OperacaoEstoque } from './api'

/**
 * Lógica pura da tela de Estoque, sem React, testada no Vitest.
 *
 * ↪️ 30/09 (Ajuste Estoque 2 — D-83/D-86): os selos "Sem estoque"/"Faltam N"
 * saíram do cartão; agora ele mostra os NÚMEROS (em estoque em destaque,
 * reservados para produção e reservados em venda) e o aviso do corte.
 */

/** O aviso discreto do corte: pedidos fora do comum que saíram da conta (D-84). */
export function textoCorte(cortes: number): string | null {
  if (!Number.isFinite(cortes) || cortes < 1) return null
  return cortes === 1 ? '1 pedido grande fora da conta' : `${cortes} pedidos grandes fora da conta`
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
  /**
   * D-78: peças reservadas por uma venda que ainda estão no galpão. A contagem
   * é FÍSICA — quem conta vê essas também; o número livre é o que sobra.
   */
  reservadas = 0,
): { depois: number; texto: string; valida: boolean } {
  const q = Number.isFinite(quantidade) ? Math.trunc(quantidade) : NaN
  if (operacao === 'contagem') {
    if (!(q >= 0 && q <= 500)) return { depois: atual, texto: 'Informe de 0 a 500.', valida: false }
    if (q < reservadas) {
      return {
        depois: atual,
        texto:
          reservadas === 1
            ? 'Há 1 peça reservada para um pedido no galpão — a contagem não pode ser menor.'
            : `Há ${reservadas} peças reservadas para pedidos no galpão — a contagem não pode ser menor.`,
        valida: false,
      }
    }
    const noGalpao = atual + reservadas
    const diferenca = q - noGalpao
    const livresDepois = q - reservadas
    if (diferenca === 0) {
      return {
        depois: livresDepois,
        texto: 'Bate com o que já está aqui — fica registrado que foi conferido.',
        valida: true,
      }
    }
    // Plural por extenso nas duas formas (E-52).
    const n = Math.abs(diferenca)
    const verbo =
      diferenca > 0 ? (n === 1 ? 'Entra 1 peça' : `Entram ${n} peças`) : n === 1 ? 'Sai 1 peça' : `Saem ${n} peças`
    return { depois: livresDepois, texto: `${verbo} (de ${noGalpao} para ${q}).`, valida: true }
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
