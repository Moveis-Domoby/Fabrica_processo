import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { useDebouncedValue } from '@/comercial/hooks/useDebouncedValue'

/**
 * SESSAO-40 (D-187 — o filtro do Trello do vídeo do dono): o filtro dos quadros
 * mora no endereço (`?filtro=13722`) — o Voltar e o link funcionam, e a busca
 * geral abre o quadro já filtrado. Quem decide o que bate é o SERVIDOR (nº do
 * pedido que começa com o texto; senão o nome que contém, sem acento) — a tela
 * só manda o texto depois de 300 ms parado, com 2 caracteres ou mais (Lei §3).
 */
export const PARAMETRO_FILTRO = 'filtro'

export function filtroAplicavel(texto: string): string | null {
  const t = texto.trim()
  return t.length >= 2 ? t : null
}

export function useFiltroDoQuadro() {
  const [parametros, setParametros] = useSearchParams()
  const texto = parametros.get(PARAMETRO_FILTRO) ?? ''
  const mudar = useCallback(
    (novo: string) =>
      setParametros(
        (atual) => {
          const proximos = new URLSearchParams(atual)
          if (novo === '') proximos.delete(PARAMETRO_FILTRO)
          else proximos.set(PARAMETRO_FILTRO, novo)
          return proximos
        },
        { replace: true },
      ),
    [setParametros],
  )
  const aplicado = filtroAplicavel(useDebouncedValue(texto, 300))
  return { texto, mudar, aplicado }
}
