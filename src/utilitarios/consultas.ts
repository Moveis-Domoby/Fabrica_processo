import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { buscarCampos, buscarEtiquetas, buscarEtiquetasDosCards, buscarValoresCampos } from './api'
import { textoDoValorCampo } from './tipos'
import type { CampoCustomizado, ValorDeCampo } from './tipos'

// vazios ESTÁVEIS (um array novo a cada desenho refaria os useMemo à toa)
const NENHUM_CAMPO: CampoCustomizado[] = []
const NENHUM_VALOR: ValorDeCampo[] = []

/** Um campo preenchido, pronto para a tela. */
export interface CampoMostrado {
  campoId: number
  nome: string
  texto: string
}

/** O catálogo de etiquetas, em cache (uma chave só — E-22). */
export function useEtiquetas() {
  return useQuery({ queryKey: ['etiquetas'], queryFn: buscarEtiquetas, staleTime: 5 * 60_000 })
}

/** O catálogo de campos customizados, em cache (uma chave só — E-22). */
export function useCampos() {
  return useQuery({ queryKey: ['campos'], queryFn: buscarCampos, staleTime: 5 * 60_000 })
}

/** Os valores dos campos SÓ dos cards/pedidos mostrados (regra 17). */
export function useValoresCampos(cardIds: number[], pedidoIds: number[] = [], habilitado = true) {
  const chaveCards = [...cardIds].sort((a, b) => a - b)
  const chavePedidos = [...pedidoIds].sort((a, b) => a - b)
  return useQuery({
    queryKey: ['campos-valores', chaveCards, chavePedidos],
    queryFn: () => buscarValoresCampos({ cardIds: chaveCards, pedidoIds: chavePedidos }),
    enabled: habilitado && (chaveCards.length > 0 || chavePedidos.length > 0),
    staleTime: 30_000,
  })
}

/**
 * Os campos preenchidos de cada PEÇA mostrada (card id → campos), na ordem do
 * catálogo. Só pergunta ao banco se existe algum campo que vale nas peças.
 */
export function useCamposDasPecas(cardIds: number[]): Map<number, CampoMostrado[]> {
  const campos = useCampos().data ?? NENHUM_CAMPO
  const haCampoDePeca = campos.some((c) => c.em_pecas)
  const valores = useValoresCampos(cardIds, [], haCampoDePeca).data ?? NENHUM_VALOR
  return useMemo(() => {
    const porCampo = new Map(campos.map((c) => [c.id, c]))
    const mapa = new Map<number, CampoMostrado[]>()
    for (const v of valores) {
      const campo = porCampo.get(v.campo_id)
      if (v.card_id === null || !campo) continue
      const lista = mapa.get(v.card_id) ?? []
      lista.push({ campoId: campo.id, nome: campo.nome, texto: textoDoValorCampo(campo, v.valor) })
      mapa.set(v.card_id, lista)
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    return mapa
  }, [campos, valores])
}

/**
 * As etiquetas dos cards mostrados quando a porta da tela não traz a coluna
 * (o quadro do PCP): só pergunta se existe alguma etiqueta cadastrada.
 */
export function useEtiquetasDosCards(cardIds: number[]): Map<number, number[]> {
  const haEtiqueta = (useEtiquetas().data ?? []).length > 0
  const chave = [...cardIds].sort((a, b) => a - b)
  const { data } = useQuery({
    queryKey: ['cards', 'etiquetas', chave],
    queryFn: () => buscarEtiquetasDosCards(chave),
    enabled: haEtiqueta && chave.length > 0,
    staleTime: 30_000,
  })
  return useMemo(() => new Map((data ?? []).map((l) => [l.id, l.etiquetas])), [data])
}

/** Os campos preenchidos de cada PEDIDO mostrado (pedido id → campos). */
export function useCamposDosPedidos(pedidoIds: number[]): Map<number, CampoMostrado[]> {
  const campos = useCampos().data ?? NENHUM_CAMPO
  const haCampoDePedido = campos.some((c) => c.em_pedidos)
  const valores = useValoresCampos([], pedidoIds, haCampoDePedido).data ?? NENHUM_VALOR
  return useMemo(() => {
    const porCampo = new Map(campos.map((c) => [c.id, c]))
    const mapa = new Map<number, CampoMostrado[]>()
    for (const v of valores) {
      const campo = porCampo.get(v.campo_id)
      if (v.pedido_id === null || !campo) continue
      const lista = mapa.get(v.pedido_id) ?? []
      lista.push({ campoId: campo.id, nome: campo.nome, texto: textoDoValorCampo(campo, v.valor) })
      mapa.set(v.pedido_id, lista)
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    return mapa
  }, [campos, valores])
}
