import { Suspense, lazy } from 'react'
import { useCardAberto } from './abrirCard'

// A janela é pedaço próprio (Lei §9): carrega no primeiro clique num card.
const JanelaDoCard = lazy(() => import('./JanelaDoCard').then((m) => ({ default: m.JanelaDoCard })))
const ConversaDoCard = lazy(() =>
  import('./ConversaDoCard').then((m) => ({ default: m.ConversaDoCard })),
)

/**
 * Desenha a janela do card quando o endereço tem `?card=` (SESSAO-31 · §3).
 * Montado uma vez na casca e uma vez no tablet — qualquer tela abre um card
 * só pondo o parâmetro (useAbrirCard).
 */
export function JanelaDoCardNaUrl({ modo = 'padrao' }: { modo?: 'padrao' | 'tablet' }) {
  const { cardId, fechar } = useCardAberto()
  if (cardId === null) return null
  return (
    <Suspense fallback={null}>
      <JanelaDoCard
        key={cardId}
        cardId={cardId}
        modo={modo}
        aoFechar={fechar}
        colunaDireita={(dados) => (
          <Suspense
            fallback={<p className="p-5 text-sm text-texto-fraco">Carregando a conversa…</p>}
          >
            <ConversaDoCard janela={dados} modo={modo} />
          </Suspense>
        )}
      />
    </Suspense>
  )
}
