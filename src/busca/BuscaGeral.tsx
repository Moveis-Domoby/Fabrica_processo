import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import {
  Ban,
  ChevronDown,
  ClipboardList,
  LayoutGrid,
  MapPin,
  Package,
  PackagePlus,
  Search,
  SquarePen,
  X,
} from 'lucide-react'
import { Botao, Campo, Modal } from '@/componentes/ui'
import { useDebouncedValue } from '@/comercial/hooks/useDebouncedValue'
import { useAbrirCard } from '@/kanban/janela/abrirCard'
import { cn } from '@/lib/cn'
import { buscarCards, termoDaBusca } from './api'
import type { ItemDaBusca } from './api'
import {
  itemDePedidoCancelado,
  nomeDoItem,
  ondeEsta,
  origemDoItem,
  rotaDoQuadroFiltrado,
} from './ondeEsta'
import type { TomDoLugar } from './ondeEsta'

const CLASSE_TOM: Record<TomDoLugar, string> = {
  perfeito: 'border-perfeito-borda bg-perfeito-fundo text-perfeito-texto',
  info: 'border-info-borda bg-info-fundo text-info-texto',
  atencao: 'border-atencao-borda bg-atencao-fundo text-atencao-texto',
  danificado: 'border-danificado-borda bg-danificado-fundo text-danificado-texto',
  neutro: 'border-borda bg-superficie-sutil text-texto-suave',
}

const ICONE_TIPO = {
  pedido: ClipboardList,
  unidade: Package,
  reposicao: PackagePlus,
  avulso: SquarePen,
} as const

/**
 * SESSAO-40 (D-188 — "a rastreabilidade dos cards", pedido do dono com o
 * vídeo da pesquisa do Trello): a busca geral. Digita o número do pedido (ou o
 * nome do móvel) e vê TODOS os cards dele, em qualquer setor, com onde cada um
 * está. Tocar abre a janela do card; "Abrir o quadro" leva ao quadro do setor
 * já filtrado. Lei §3: espera 300 ms parado, mínimo 2 caracteres, uma
 * requisição por busca e "Ver mais" por cursor; o resultado é esquecido ao
 * fechar (pedaço próprio — só baixa ao abrir a busca a primeira vez).
 */
export default function BuscaGeral({
  aberto,
  aoFechar,
}: {
  aberto: boolean
  aoFechar: () => void
}) {
  const [texto, setTexto] = useState('')
  const termo = termoDaBusca(useDebouncedValue(texto, 300))
  const abrirCard = useAbrirCard()

  const consulta = useInfiniteQuery({
    queryKey: ['busca-cards', termo],
    queryFn: ({ pageParam }) => buscarCards(termo!, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (ultima) => (ultima.tem_mais ? (ultima.itens.at(-1)?.id ?? null) : null),
    enabled: aberto && termo !== null,
    staleTime: 15_000,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
  const itens = consulta.data?.pages.flatMap((p) => p.itens) ?? []
  const esperando =
    termoDaBusca(texto) !== null && (termo !== termoDaBusca(texto) || consulta.isPending)

  function fechar() {
    setTexto('')
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={(v) => !v && fechar()}
      titulo="Buscar card"
      descricao="Pelo número do pedido ou pelo nome do móvel — em todos os setores, com onde cada card está."
      tamanho="galpao"
    >
      <div className="flex min-h-0 flex-col gap-3">
        {/* o campo fica preso no topo enquanto a lista rola */}
        <div className="sticky top-0 z-10 bg-superficie pb-1">
          <Campo
            rotulo="Buscar card"
            rotuloOculto
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            prefixo={<Search />}
            placeholder="Ex.: 13721 ou estante"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="pr-11 [&::-webkit-search-cancel-button]:hidden"
          />
          {texto !== '' && (
            <button
              type="button"
              onClick={() => setTexto('')}
              aria-label="Limpar a busca"
              className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center rounded-dm text-texto-suave hover:text-texto"
            >
              <X aria-hidden className="size-5" />
            </button>
          )}
        </div>

        <div aria-live="polite" className="sr-only">
          {termo && !consulta.isPending
            ? itens.length === 0
              ? 'Nenhum card encontrado'
              : `${itens.length} ${itens.length === 1 ? 'card encontrado' : 'cards encontrados'}`
            : ''}
        </div>

        {termoDaBusca(texto) === null && (
          <p className="text-sm text-texto-suave">
            Digite o número do pedido (2 números ou mais — acha os pedidos que começam com eles) ou
            o nome do móvel ou do card avulso (3 letras ou mais).
          </p>
        )}
        {esperando && <p className="text-sm text-texto-fraco">Buscando…</p>}
        {consulta.isError && (
          <p className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
            {consulta.error instanceof Error ? consulta.error.message : 'Não deu para buscar.'}
          </p>
        )}
        {termo && !esperando && !consulta.isError && itens.length === 0 && (
          <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
            Nenhum card com "{termo}" que você possa ver.
          </p>
        )}

        {itens.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="Cards encontrados">
            {itens.map((item) => (
              <ItemDaLista
                key={item.id}
                item={item}
                aoAbrir={() => {
                  fechar()
                  abrirCard(item.id)
                }}
                aoIrAoQuadro={fechar}
              />
            ))}
          </ul>
        )}

        {consulta.hasNextPage && (
          <Botao
            variante="fantasma"
            icone={<ChevronDown />}
            carregando={consulta.isFetchingNextPage}
            onClick={() => void consulta.fetchNextPage()}
            className="self-center"
          >
            Ver mais
          </Botao>
        )}
      </div>
    </Modal>
  )
}

function ItemDaLista({
  item,
  aoAbrir,
  aoIrAoQuadro,
}: {
  item: ItemDaBusca
  aoAbrir: () => void
  aoIrAoQuadro: () => void
}) {
  const lugar = ondeEsta(item)
  const Icone = ICONE_TIPO[item.tipo] ?? Package
  const quadro = rotaDoQuadroFiltrado(item)
  const cancelado = itemDePedidoCancelado(item)
  return (
    <li className="flex items-stretch gap-1 rounded-dm-lg border border-borda bg-superficie transition-colors hover:border-borda-forte">
      <button
        type="button"
        onClick={aoAbrir}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-dm-lg p-3 text-left"
        aria-label={`${origemDoItem(item)} · ${nomeDoItem(item)} — ${lugar.texto}. Abrir o card`}
      >
        <Icone aria-hidden className="mt-0.5 size-5 shrink-0 text-texto-suave" />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-texto-suave tabular-nums">{origemDoItem(item)}</span>
          <span className="line-clamp-2 text-sm font-medium text-texto">{nomeDoItem(item)}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                CLASSE_TOM[lugar.tom],
              )}
            >
              <MapPin aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{lugar.texto}</span>
            </span>
            {cancelado && !item.arquivado_em && (
              <span className="inline-flex items-center gap-1 rounded-full border border-danificado-borda bg-danificado-fundo px-2 py-0.5 text-xs font-medium text-danificado-texto">
                <Ban aria-hidden className="size-3.5" />
                Pedido cancelado
              </span>
            )}
          </span>
        </span>
      </button>
      {quadro && (
        <Link
          to={quadro}
          onClick={aoIrAoQuadro}
          className="flex w-12 shrink-0 items-center justify-center rounded-r-dm-lg border-l border-borda text-texto-suave transition-colors hover:bg-superficie-sutil hover:text-texto"
          aria-label={`Abrir o quadro de ${item.setor_nome ?? 'setor'} filtrado`}
          title="Abrir o quadro do setor, já filtrado"
        >
          <LayoutGrid aria-hidden className="size-5" />
        </Link>
      )}
    </li>
  )
}
