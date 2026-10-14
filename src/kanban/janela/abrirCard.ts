import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

/**
 * SESSAO-31 (§3): a janela do card vive no ENDEREÇO (`?card=<id>`) — dá para
 * mandar o link a alguém, o Voltar fecha, e qualquer tela abre do mesmo jeito
 * (quadro, PCP, tablet, sino). Quem abre só põe o parâmetro; quem desenha a
 * janela é <JanelaDoCardNaUrl>, montado uma vez na casca (e no tablet).
 */
export const PARAMETRO_CARD = 'card'

export function useAbrirCard() {
  const [, setParametros] = useSearchParams()
  return useCallback(
    (cardId: number) =>
      setParametros((atual) => {
        const novos = new URLSearchParams(atual)
        novos.set(PARAMETRO_CARD, String(cardId))
        return novos
      }),
    [setParametros],
  )
}

/** O card aberto (do endereço) e o fechar — fechar tira o parâmetro sem empilhar. */
export function useCardAberto(): { cardId: number | null; fechar: () => void } {
  const [parametros, setParametros] = useSearchParams()
  const cardId = Number(parametros.get(PARAMETRO_CARD)) || null
  const fechar = useCallback(
    () =>
      setParametros(
        (atual) => {
          const novos = new URLSearchParams(atual)
          novos.delete(PARAMETRO_CARD)
          return novos
        },
        { replace: true },
      ),
    [setParametros],
  )
  return { cardId, fechar }
}
