import type { TempoVivo } from './tempoUtil'
import type { AcaoAoSoltar } from './arrasto'

/**
 * SESSAO-42 (F1 · "Montar juntos" / "Concluir o lote"): os cards montados
 * juntos rodam com o MESMO lote (`tempos[card].lote`, vindo do banco). Ao
 * soltar um deles numa etapa que encaminha ou conclui, a tela pergunta se leva
 * o lote inteiro.
 */

/** Os outros cards rodando no setor com o mesmo lote deste (só os que o quadro carregou). */
export function outrosDoLote(cardId: number, tempos: Map<number, TempoVivo> | undefined): number[] {
  const lote = tempos?.get(cardId)?.lote
  if (!lote || !tempos) return []
  return [...tempos.entries()]
    .filter(([id, t]) => id !== cardId && t.lote === lote && t.desde !== null)
    .map(([id]) => id)
}

/** Soltar aqui leva o card adiante (encaminha a outro setor ou conclui) — onde o lote todo pode ir junto. */
export function acaoLevaOLote(acao: AcaoAoSoltar): boolean {
  return acao.tipo === 'encaminhar' || acao.tipo === 'concluir'
}
