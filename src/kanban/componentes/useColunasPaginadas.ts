import { useState } from 'react'
import { keepPreviousData, useQueries } from '@tanstack/react-query'
import { buscarCardsDaEtapa } from '../api'
import type { Card, Etapa } from '../tipos'
import type { ColunaPaginada } from './QuadroKanban'

const CHEGADA = 'chegada'

/**
 * As colunas paginadas de um quadro (SESSAO-22): uma consulta POR PÁGINA de
 * cada coluna — a tela só requisita o que mostra. A primeira página de cada
 * etapa já traz o total real (contagem no servidor); "Ver mais" acrescenta a
 * página seguinte daquela coluna, sem recarregar o quadro.
 *
 * A coluna 'chegada' (cards sem etapa) é sempre consultada: nos setores de
 * produção ela só aparece se tiver card (aviso de exceção — D-48).
 */
export function useColunasPaginadas(parametros: {
  setorId: number | undefined
  etapas: Etapa[]
  tipo: 'pedido' | 'unidade'
  atualizaACada?: number
}) {
  const { setorId, etapas, tipo, atualizaACada } = parametros
  const [paginas, setPaginas] = useState<Record<string, number>>({})

  // Trocou de setor → cada coluna volta à primeira página (ajuste durante o
  // render, sem effect — o padrão da casa).
  const [setorAnterior, setSetorAnterior] = useState(setorId)
  if (setorAnterior !== setorId) {
    setSetorAnterior(setorId)
    setPaginas({})
  }

  const chaves = [CHEGADA, ...etapas.map((e) => String(e.id))]
  const consultas = useQueries({
    queries: chaves.flatMap((chave) =>
      Array.from({ length: paginas[chave] ?? 1 }, (_, pagina) => ({
        queryKey: ['cards', 'etapa', setorId, tipo, chave, pagina],
        queryFn: () =>
          buscarCardsDaEtapa({
            setorId: setorId!,
            etapaId: chave === CHEGADA ? null : Number(chave),
            tipo,
            pagina,
          }),
        enabled: setorId !== undefined,
        refetchInterval: atualizaACada,
        // Segura a página anterior enquanto a nova chega — sem piscar o quadro.
        placeholderData: keepPreviousData,
      })),
    ),
  })

  const colunas = new Map<string, ColunaPaginada>()
  const todosOsCards: Card[] = []
  let indice = 0
  let carregando = false
  for (const chave of chaves) {
    const totalPaginas = paginas[chave] ?? 1
    const cards: Card[] = []
    let total = 0
    let carregandoMais = false
    for (let p = 0; p < totalPaginas; p++) {
      const consulta = consultas[indice]
      indice += 1
      if (consulta.isPending) carregando = true
      if (p === totalPaginas - 1 && consulta.isFetching) carregandoMais = true
      const dados = consulta.data
      if (!dados) continue
      cards.push(...dados.cards)
      total = dados.total
    }
    colunas.set(chave, {
      cards,
      total,
      carregandoMais,
      aoVerMais:
        cards.length < total
          ? () => setPaginas((atual) => ({ ...atual, [chave]: (atual[chave] ?? 1) + 1 }))
          : undefined,
    })
    todosOsCards.push(...cards)
  }

  return { colunas, cards: todosOsCards, carregando }
}
