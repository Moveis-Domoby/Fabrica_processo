import { createContext, useContext } from 'react'

export interface EstadoChat {
  /** O canal da pessoa já está ouvindo (ou desistiu de esperar): a lista pode ler. */
  pronto: boolean
  /** Total de não lidas de todas as conversas — o badge do balão. */
  totalNaoLidas: number
  /**
   * A conversa aberta e à vista (a do balão ou a da tela cheia). Mensagem
   * nova nela não vira "não lida" — ela é marcada como lida na hora.
   */
  definirConversaVisivel: (conversaId: number | null) => void
}

export const ContextoChat = createContext<EstadoChat | null>(null)

export function useChat(): EstadoChat {
  const estado = useContext(ContextoChat)
  if (!estado) throw new Error('useChat() precisa estar dentro de <ProvedorChat>.')
  return estado
}
