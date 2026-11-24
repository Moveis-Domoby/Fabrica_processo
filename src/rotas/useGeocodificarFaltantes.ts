import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { GEOCODIFICAR_POR_CHAMADA, geocodificar, precisaGeocodificar } from './api'
import type { PontoAproximado } from './api'
import {
  chavesSemResposta,
  registrarFalhaDaChamada,
  registrarResposta,
  religarBusca,
  useEstadoDaBusca,
} from './estadoDaBusca'

interface ComEndereco {
  geo_chave: string | null
  geo_resolvido: boolean | null
  endereco_geocodificavel?: string | null
  geo_consultado_em?: string | null
  /** SESSAO-45 · ajuste: o ponto aproximado é procurado de novo depois de 7 dias. */
  geo_aproximado?: PontoAproximado | null
}

/**
 * Geocodificação preguiçosa (SESSAO-15/D-112): quem ainda não tem ponto vai à
 * Edge Function, alguns por vez, uma vez só por chave nesta visita. SESSAO-41
 * (D-193): o mesmo também em "Já programadas" — o pedido já programado que
 * passou a usar o endereço de entrega do Tiny ganha o ponto novo ali mesmo.
 *
 * ↪️ SESSAO-56 (frente 2): a busca que NÃO responde deixou de ser silenciosa.
 * A resposta com "tentar depois" (ou a chamada inteira que falha) liga o aviso
 * dos cartões e DESLIGA os pedidos seguintes (disjuntor: nada de insistir em
 * serviço fora, nada de relógio). Tenta de novo ao reabrir a aba e no botão
 * "Tentar de novo" do cartão — quando ele dá certo, a lista relê e os outros
 * endereços voltam a ser procurados sozinhos.
 */
export function useGeocodificarFaltantes(itens: ComEndereco[], reler: QueryKey, ativa = true) {
  const clienteQuery = useQueryClient()
  const busca = useEstadoDaBusca()
  const pedidas = useRef<Set<string>>(new Set())
  const mutacao = useMutation({
    mutationFn: geocodificar,
    onSuccess: async (resposta) => {
      // o que não teve resposta pode ser pedido de novo quando a busca voltar
      for (const chave of chavesSemResposta(resposta)) pedidas.current.delete(chave)
      registrarResposta(resposta)
      await clienteQuery.invalidateQueries({ queryKey: reler })
    },
    onError: (_erro, lote) => {
      for (const item of lote) pedidas.current.delete(item.chave)
      registrarFalhaDaChamada()
    },
  })
  // a aba foi (re)aberta: uma tentativa nova (sem relógio — só neste gesto)
  useEffect(() => {
    if (ativa) religarBusca()
  }, [ativa])
  // um "Tentar de novo" deu certo: a lista relê (o ponto aparece sem recarregar a página)
  const voltou = useRef(busca.voltou)
  useEffect(() => {
    if (voltou.current === busca.voltou) return
    voltou.current = busca.voltou
    if (ativa) void clienteQuery.invalidateQueries({ queryKey: reler })
  }, [busca.voltou, ativa, clienteQuery, reler])
  useEffect(() => {
    if (!ativa || mutacao.isPending || busca.semResposta) return
    const pendentes = itens
      .filter((p) => precisaGeocodificar(p) && !pedidas.current.has(p.geo_chave!))
      .slice(0, GEOCODIFICAR_POR_CHAMADA)
    if (pendentes.length === 0) return
    for (const p of pendentes) pedidas.current.add(p.geo_chave!)
    mutacao.mutate(
      pendentes.map((p) => ({ chave: p.geo_chave!, endereco: p.endereco_geocodificavel! })),
    )
  }, [itens, mutacao, ativa, busca.semResposta])
}
