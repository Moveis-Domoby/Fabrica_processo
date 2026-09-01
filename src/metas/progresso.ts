import type { IndicadorMeta, PeriodoMeta } from './api'

/**
 * Lógica pura do cockpit de metas (SESSAO-14 / D-37) — testada no Vitest.
 * A janela vem PRONTA do banco (fuso America/Fortaleza); aqui só se calcula
 * o que é de apresentação: percentual e o marco "alvo até agora".
 */

export const ROTULO_INDICADOR: Record<IndicadorMeta, string> = {
  unidades: 'unidades concluídas',
  tarefas: 'tarefas concluídas',
  tempo_util: 'horas úteis trabalhadas',
}

export const ROTULO_PERIODO: Record<PeriodoMeta, string> = {
  diaria: 'meta diária',
  semanal: 'meta semanal',
  mensal: 'meta mensal',
}

/** Percentual concluído, inteiro (pode passar de 100 — meta batida e superada). */
export function percentualConcluido(progresso: number, alvo: number): number {
  if (!(alvo > 0)) return 0
  return Math.round((progresso / alvo) * 100)
}

/**
 * Fração do período já decorrida (0…1) — é onde fica o traço do "alvo até
 * agora" (referência do mockup): andamento esperado se o ritmo fosse linear.
 */
export function fracaoDecorrida(janelaInicio: string, janelaFim: string, agora: Date): number {
  const inicio = new Date(janelaInicio).getTime()
  const fim = new Date(janelaFim).getTime()
  if (!(fim > inicio)) return 0
  const fracao = (agora.getTime() - inicio) / (fim - inicio)
  return Math.min(1, Math.max(0, fracao))
}

/** Números do indicador: contagens inteiras; horas com 1 casa quando precisa. */
export function formatarValorMeta(valor: number, indicador: IndicadorMeta): string {
  if (indicador === 'tempo_util') {
    const arredondado = Math.round(valor * 10) / 10
    return `${arredondado.toLocaleString('pt-BR')}h`
  }
  return Math.round(valor).toLocaleString('pt-BR')
}
