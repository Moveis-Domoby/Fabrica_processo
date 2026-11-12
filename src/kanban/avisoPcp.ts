import type { LugarDasPecas } from './api'
import type { AvisoCancelada } from './tipos'

/**
 * SESSAO-48 (frente 2): os textos do aviso da peça cancelada no PCP — o selo do
 * pedido e os pedaços de frase das janelas. Lógica pura (testada no Vitest); a
 * tela só desenha.
 *
 * ↩️ SESSAO-50 (bloco B): os três motivos do "Remover do PCP" saíram junto com
 * ele (viraram "Cancelar pedido" e "Ocultar do PCP" — os textos deles moram em
 * `pcpSaida.ts`); o selo ganhou o laço (3 ou mais peças canceladas em 24 h).
 */

/** O selo do pedido no quadro do PCP: "Peça cancelada na produção" / "Peça não encontrada" (com o número quando mais de uma). */
export function textoDoSelo(aviso: Pick<AvisoCancelada, 'pecas' | 'motivo' | 'laco'>): string {
  const n = aviso.pecas
  // SESSAO-50 (frente 5): o laço liberar → cancelar (3 ou mais em 24 h)
  if (aviso.laco) return 'Peças canceladas várias vezes'
  if (aviso.motivo === 'nao_encontrada')
    return n > 1 ? `${n} peças não encontradas` : 'Peça não encontrada'
  return n > 1 ? `${n} peças canceladas na produção` : 'Peça cancelada na produção'
}

/** "1 peça" / "3 peças". */
export function pecasPorExtenso(n: number): string {
  return n === 1 ? '1 peça' : `${n} peças`
}

/** Onde a peça está, em língua de galpão: a coluna (etapa) ou, sem ela, o setor. */
export function nomeDoLugar(l: Pick<LugarDasPecas, 'etapa' | 'setor'>): string {
  return l.etapa ?? l.setor ?? 'outro lugar'
}

/** "19/10 22:24" — o dia e a hora, no fuso do aparelho. */
export function diaEHoraCurto(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
