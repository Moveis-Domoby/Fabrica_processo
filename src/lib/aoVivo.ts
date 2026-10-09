import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { ouvirCanal } from '@/chat/canais'

/** As áreas que o banco avisa (SESSAO-30 — migration 61). */
export type AreaAoVivo = 'estoque' | 'aguardo' | 'pcp' | 'rotas'

const ESPERA_MS = 400

/**
 * Tela AO VIVO por websocket (Lei §4 — no lugar dos relógios de 20–30 s): o
 * banco empurra "mudou" no canal privado da área (só quem pode ver ouve) e a
 * tela relê só as consultas dela — as que estão na tela; as escondidas ficam
 * marcadas para quando aparecerem. Vários avisos seguidos viram uma releitura
 * só; ao voltar a conexão (rede caiu, aba dormiu), uma releitura de
 * recuperação.
 */
export function useAoVivo(areas: AreaAoVivo | AreaAoVivo[], chaves: QueryKey[], ligado = true) {
  const clienteQuery = useQueryClient()
  const chavesRef = useRef(chaves)
  useEffect(() => {
    chavesRef.current = chaves
  })
  const lista = (Array.isArray(areas) ? areas : [areas]).join(',')

  useEffect(() => {
    if (!ligado) return
    let espera: ReturnType<typeof setTimeout> | null = null
    let jaConectou = false
    let caiu = false
    const reler = () => {
      if (espera) clearTimeout(espera)
      espera = setTimeout(() => {
        espera = null
        for (const queryKey of chavesRef.current) void clienteQuery.invalidateQueries({ queryKey })
      }, ESPERA_MS)
    }
    const aoStatus = (status: string) => {
      if (status === 'SUBSCRIBED') {
        if (jaConectou && caiu) reler() // recuperação: o que mudou enquanto estava fora
        jaConectou = true
        caiu = false
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        caiu = true
      }
    }
    const paradas = lista
      .split(',')
      .map((area) =>
        ouvirCanal(`plt-aviso:${area}`, (evento) => evento === 'mudou' && reler(), aoStatus),
      )
    return () => {
      if (espera) clearTimeout(espera)
      for (const parar of paradas) parar()
    }
  }, [lista, ligado, clienteQuery])
}
