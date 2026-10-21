import { useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * SESSAO-38 (pedido do dono, item 2.3 e 4 — D-150, D-151, D-154): a
 * PRIORIDADE do card deixou de ser etiqueta. Três níveis: URGENTE (sempre o
 * primeiro da fila, em qualquer ordem — bolinha vermelha), ATENÇÃO (bolinha
 * amarela) e COMUM (bolinha verde). A do pedido vale para todas as peças dele;
 * quem decide é o banco (a peça manda para o pedido).
 */
export type Prioridade = 'urgente' | 'atencao' | 'comum'

export const PRIORIDADES: Prioridade[] = ['urgente', 'atencao', 'comum']

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = {
  urgente: 'Urgente',
  atencao: 'Atenção',
  comum: 'Comum',
}

/** O que vem do banco ('urgente' | 'atencao' | nulo) em língua da tela. */
export function prioridadeDe(valor: string | null | undefined): Prioridade {
  return valor === 'urgente' || valor === 'atencao' ? valor : 'comum'
}

export async function definirPrioridade(
  cardId: number,
  prioridade: Prioridade,
): Promise<{ card_id: number; prioridade: Prioridade; mudou: boolean; do_pedido: boolean }> {
  const { data, error } = await supabase.rpc('plt_fn_card_prioridade', {
    p_card_id: cardId,
    p_prioridade: prioridade,
  })
  if (error) throw new Error(error.message)
  return data as { card_id: number; prioridade: Prioridade; mudou: boolean; do_pedido: boolean }
}

// ---------------------------------------------------------------------------
// A ordem da fila (D-154): o servidor ordena; a tela só diz qual.
// ---------------------------------------------------------------------------
export type OrdemDaFila = 'prioridade' | 'entrega' | 'alfabetica'

export const ORDENS: OrdemDaFila[] = ['prioridade', 'entrega', 'alfabetica']

/** O que o botão diz a quem não vê o ícone (o botão não tem texto — pedido do dono). */
export const ROTULO_ORDEM: Record<OrdemDaFila, string> = {
  prioridade: 'Fila por prioridade (urgente, atenção, comum)',
  entrega: 'Fila pela data de entrega mais próxima',
  alfabetica: 'Fila em ordem alfabética',
}

export function proximaOrdem(atual: OrdemDaFila): OrdemDaFila {
  return ORDENS[(ORDENS.indexOf(atual) + 1) % ORDENS.length]
}

export function ehOrdem(valor: unknown): valor is OrdemDaFila {
  return typeof valor === 'string' && (ORDENS as string[]).includes(valor)
}

function lerOrdem(chave: string): OrdemDaFila {
  try {
    const salvo = localStorage.getItem(chave)
    return ehOrdem(salvo) ? salvo : 'prioridade'
  } catch {
    return 'prioridade'
  }
}

/**
 * A ordem escolhida por quem olha, lembrada no aparelho (uma conveniência de
 * quem vê — localStorage; sem ele, só não fica lembrada).
 */
export function useOrdemDaFila(onde: 'quadro' | 'pcp'): [OrdemDaFila, (o: OrdemDaFila) => void] {
  const chave = `plt-ordem-fila-${onde}`
  const [ordem, setOrdem] = useState<OrdemDaFila>(() => lerOrdem(chave))
  function mudar(o: OrdemDaFila) {
    setOrdem(o)
    try {
      localStorage.setItem(chave, o)
    } catch {
      // sem armazenamento: vale só até fechar a tela
    }
  }
  return [ordem, mudar]
}
