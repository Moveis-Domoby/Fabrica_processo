import { createContext, useContext } from 'react'
import type { Estado } from './estados'

export interface Notificacao {
  id: number
  titulo: string
  descricao?: string
  /** Reaproveita a paleta de estados: uma linguagem visual só na plataforma. */
  tom?: Extract<Estado, 'perfeito' | 'atencao' | 'danificado' | 'informativo'>
  duracaoMs?: number
}

export type EntradaNotificacao = Omit<Notificacao, 'id'>

export const ContextoNotificacao = createContext<((n: EntradaNotificacao) => void) | null>(null)

/**
 * Dispara uma notificação de canto (toast). Precisa do `<ProvedorNotificacao>` acima.
 *
 * Nome em inglês de propósito: `use*` é convenção do React, não vocabulário de
 * domínio. Domínio e interface falam português; o framework fala o dele.
 */
export function useNotificacao() {
  const notificar = useContext(ContextoNotificacao)
  if (!notificar) {
    throw new Error('useNotificacao() precisa estar dentro de <ProvedorNotificacao>.')
  }
  return notificar
}
