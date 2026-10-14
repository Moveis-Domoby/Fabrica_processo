import type { JanelaDoCard } from './api'

/**
 * A coluna da direita da janela do card: a conversa do card e os fatos dele
 * (SESSAO-31 · §3). A conversa nasce na etapa seguinte — por ora, o lugar.
 */
export function ConversaDoCard({ janela }: { janela: JanelaDoCard; modo?: 'padrao' | 'tablet' }) {
  return (
    <div className="flex flex-1 flex-col gap-2 p-5">
      <h3 className="text-sm font-semibold text-texto">Atividade</h3>
      <p className="text-sm text-texto-suave">
        {janela.card.mensagens_qtd
          ? `${janela.card.mensagens_qtd} mensagem(ns) neste card.`
          : 'Nenhuma mensagem neste card ainda.'}
      </p>
    </div>
  )
}
