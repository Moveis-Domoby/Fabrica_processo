import type { Card, MotivoCancelamento } from './tipos'

/**
 * SESSAO-48 (frente 1): a peça com a fabricação cancelada — ela chegou numa
 * coluna que cancela (o CANCELADO ou o NÃO ENCONTRADO da LIMPEZA E EMBALAGEM),
 * saiu da produção e fica à vista na coluna por alguns dias (padrão 7). O card
 * mostra quando saiu e em quantos dias some, no lugar do tempo de fila.
 */

const DIA_MS = 24 * 60 * 60 * 1000

/** O padrão de dias quando a coluna não diz (a configuração da etapa). */
export const DIAS_NA_COLUNA_PADRAO = 7

export function pecaCancelada(card: Pick<Card, 'tipo' | 'cancelada_em'>): boolean {
  return card.tipo === 'unidade' && Boolean(card.cancelada_em)
}

function inicioDoDia(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * Dias de calendário que faltam para a peça sumir da coluna (0 = some hoje): a
 * coluna deixa de mostrar a peça N dias depois do cancelamento, na mesma hora.
 */
export function diasParaSumir(canceladaEm: string, dias: number, agora: number): number {
  const fim = new Date(canceladaEm).getTime() + dias * DIA_MS
  return Math.max(0, Math.round((inicioDoDia(fim) - inicioDoDia(agora)) / DIA_MS))
}

function diaMes(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** "Cancelada em 11/11" / "Não encontrada em 11/11". */
export function textoCancelada(motivo: MotivoCancelamento | null | undefined, canceladaEm: string): string {
  return `${motivo === 'nao_encontrada' ? 'Não encontrada' : 'Cancelada'} em ${diaMes(canceladaEm)}`
}

/** "some em 7 dias" · "some amanhã" · "some hoje". */
export function textoSome(canceladaEm: string, dias: number, agora: number): string {
  const faltam = diasParaSumir(canceladaEm, dias, agora)
  if (faltam <= 0) return 'some hoje'
  if (faltam === 1) return 'some amanhã'
  return `some em ${faltam} dias`
}
