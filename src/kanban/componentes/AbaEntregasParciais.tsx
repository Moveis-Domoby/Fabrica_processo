import { useMemo, useState } from 'react'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { Inbox, PackageCheck, PanelRightOpen, RotateCcw } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { MaisAoRolar } from '@/componentes/MaisAoRolar'
import { diaEHoraCurto } from '../avisoPcp'
import { useFiltroDoQuadro } from '../filtroQuadro'
import { useAbrirCard } from '../janela/abrirCard'
import {
  listarEntregasParciais,
  textoBotaoRevogar,
  textoDecisao,
  textoEntregueEmParte,
} from '../entregaParcial'
import type { EstadoParcial } from '../entregaParcial'
import { FiltroDoQuadro, NadaBateComOFiltro } from './FiltroDoQuadro'
import { ModalRevogarParcial } from './ModalRevogarParcial'

/**
 * SESSAO-51 (bloco A · frente 3): a aba "Entregas parciais" do PCP — os
 * pedidos entregues em parte que tiveram a decisão sobre a fábrica e ainda
 * podem ser revogados. Cada linha mostra a decisão que vale e UM botão, o
 * contrário dela. Paginada no servidor por cursor (do mais recente para trás),
 * lida só com a aba aberta; a busca é pelo número ou pelo cliente.
 */
export function AbaEntregasParciais() {
  const abrirCard = useAbrirCard()
  const filtro = useFiltroDoQuadro()
  const [revogando, setRevogando] = useState<number | null>(null)

  const consulta = useInfiniteQuery({
    queryKey: ['entregas-parciais', filtro.aplicado ?? ''],
    queryFn: ({ pageParam }) => listarEntregasParciais({ busca: filtro.aplicado, depois: pageParam }),
    initialPageParam: null as { em: string; id: number } | null,
    getNextPageParam: (ultima) => ultima.proxima ?? undefined,
    placeholderData: keepPreviousData,
  })
  const linhas = useMemo(() => consulta.data?.pages.flatMap((p) => p.itens) ?? [], [consulta.data])

  return (
    <section aria-label="Entregas parciais" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-base">Entregas parciais</h2>
          <span className="text-xs text-texto-suave">
            O que ficou na fábrica numa entrega parcial — dá para trocar a decisão quantas vezes for preciso.
          </span>
        </div>
        <span className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <FiltroDoQuadro texto={filtro.texto} aoMudar={filtro.mudar} />
        </span>
      </div>

      {consulta.isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {consulta.isError && (
        <p
          className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto"
          role="alert"
        >
          {consulta.error instanceof Error ? consulta.error.message : 'Não deu para carregar.'}
        </p>
      )}
      {!consulta.isPending && !consulta.isError && linhas.length === 0 && filtro.aplicado && (
        <NadaBateComOFiltro filtro={filtro.aplicado} />
      )}
      {!consulta.isPending && !consulta.isError && linhas.length === 0 && !filtro.aplicado && (
        <p className="flex items-center gap-2 rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          <Inbox aria-hidden className="size-5 shrink-0" />
          Nenhuma entrega parcial com algo na fábrica para decidir.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {linhas.map((l) => (
          <LinhaParcial
            key={l.card_id}
            linha={l}
            aoAbrir={() => abrirCard(l.card_id)}
            aoRevogar={() => setRevogando(l.card_id)}
          />
        ))}
      </ul>

      <MaisAoRolar
        temMais={consulta.hasNextPage}
        carregando={consulta.isFetchingNextPage}
        aoChegar={() => {
          if (!consulta.isFetchingNextPage) void consulta.fetchNextPage()
        }}
      />

      <ModalRevogarParcial cardId={revogando} aoFechar={() => setRevogando(null)} />
    </section>
  )
}

function LinhaParcial({
  linha: l,
  aoAbrir,
  aoRevogar,
}: {
  linha: EstadoParcial
  aoAbrir: () => void
  aoRevogar: () => void
}) {
  return (
    <li className="flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-texto tabular-nums">Pedido {l.numero}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-atencao-fundo px-2 py-0.5 text-xs font-medium text-atencao-texto">
            <PackageCheck aria-hidden className="size-3.5" />
            {textoEntregueEmParte(l.entregues, l.total)}
          </span>
        </span>
        <span className="truncate text-sm text-texto-suave">{l.cliente || 'Sem cliente'}</span>
        <span className="text-xs text-texto-suave tabular-nums">
          Entrega parcial em {diaEHoraCurto(l.parcial_em)}
          {l.decisao_em ? ` · decidido${l.decisao_por ? ` por ${l.decisao_por}` : ''} em ${diaEHoraCurto(l.decisao_em)}` : ''}
        </span>
        <span className="text-sm font-medium text-texto">{textoDecisao(l)}</span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1 sm:justify-end">
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<PanelRightOpen />}
          className="min-h-toque-md px-2 text-texto-suave"
          aria-label={`Abrir o card do pedido ${l.numero}`}
          onClick={aoAbrir}
        >
          Abrir o card
        </Botao>
        <Botao variante="secundaria" icone={<RotateCcw />} className="whitespace-normal text-left" onClick={aoRevogar}>
          {textoBotaoRevogar(l.acao)}
        </Botao>
      </div>
    </li>
  )
}
