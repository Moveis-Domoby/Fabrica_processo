import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

/**
 * SESSAO-46: a ficha da sugestão vive no ENDEREÇO (`?sugestao=<id>`), como a
 * janela do card — o aviso do sino, a pendência do Meu painel, a bolinha e o
 * quadro abrem do mesmo jeito; o Voltar fecha; dá para mandar o link.
 */
export const PARAMETRO_SUGESTAO = 'sugestao'

export function useAbrirSugestao() {
  const [, setParametros] = useSearchParams()
  return useCallback(
    (id: number) =>
      setParametros((atual) => {
        const novos = new URLSearchParams(atual)
        novos.set(PARAMETRO_SUGESTAO, String(id))
        return novos
      }),
    [setParametros],
  )
}

export function useSugestaoAberta(): { sugestaoId: number | null; fechar: () => void } {
  const [parametros, setParametros] = useSearchParams()
  const sugestaoId = Number(parametros.get(PARAMETRO_SUGESTAO)) || null
  const fechar = useCallback(
    () =>
      setParametros(
        (atual) => {
          const novos = new URLSearchParams(atual)
          novos.delete(PARAMETRO_SUGESTAO)
          return novos
        },
        { replace: true },
      ),
    [setParametros],
  )
  return { sugestaoId, fechar }
}
