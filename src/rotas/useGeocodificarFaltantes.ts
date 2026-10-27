import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { GEOCODIFICAR_POR_CHAMADA, geocodificar, precisaGeocodificar } from './api'

interface ComEndereco {
  geo_chave: string | null
  geo_resolvido: boolean | null
  endereco_geocodificavel?: string | null
  geo_consultado_em?: string | null
}

/**
 * Geocodificação preguiçosa (SESSAO-15/D-112): quem ainda não tem ponto vai à
 * Edge Function, alguns por vez, uma vez só por chave nesta visita. SESSAO-41
 * (D-193): o mesmo também em "Já programadas" — o pedido já programado que
 * passou a usar o endereço de entrega do Tiny ganha o ponto novo ali mesmo.
 */
export function useGeocodificarFaltantes(itens: ComEndereco[], reler: QueryKey, ativa = true) {
  const clienteQuery = useQueryClient()
  const pedidas = useRef<Set<string>>(new Set())
  const mutacao = useMutation({
    mutationFn: geocodificar,
    onSuccess: async () => {
      await clienteQuery.invalidateQueries({ queryKey: reler })
    },
  })
  useEffect(() => {
    if (!ativa || mutacao.isPending) return
    const pendentes = itens
      .filter((p) => precisaGeocodificar(p) && !pedidas.current.has(p.geo_chave!))
      .slice(0, GEOCODIFICAR_POR_CHAMADA)
    if (pendentes.length === 0) return
    for (const p of pendentes) pedidas.current.add(p.geo_chave!)
    mutacao.mutate(
      pendentes.map((p) => ({ chave: p.geo_chave!, endereco: p.endereco_geocodificavel! })),
    )
  }, [itens, mutacao, ativa])
}
