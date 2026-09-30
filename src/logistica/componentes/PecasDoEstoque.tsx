import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Boxes, ChevronDown, Clock } from 'lucide-react'
import { BadgeEstado, Botao, Paginacao } from '@/componentes/ui'
import { formatarDuracao } from '@/kanban/tempo'
import { listarPecasEstoque } from '@/logistica/api'
import type { PecaEstoque } from '@/logistica/api'

const PECAS_POR_VEZ = 10
const POR_PAGINA = 20

/** De onde veio a peça livre, em língua do galpão. */
function origemDaPeca(peca: PecaEstoque): string {
  if (peca.origem === 'cancelamento') {
    return `Livre · veio do pedido ${peca.origem_numero ?? '…'}, que foi cancelado`
  }
  if (peca.origem === 'manual') return 'Livre · entrada da logística'
  return 'Livre · veio da reposição'
}

export function LinhaPeca({ peca, agora }: { peca: PecaEstoque; agora: number }) {
  const reservada = peca.dono === 'pedido'
  return (
    <li className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm text-texto">
          {reservada ? (
            <>
              <span className="font-medium">Reservada · Pedido {peca.numero ?? '…'}</span>
              {peca.indice_unidade !== null && (
                <span className="tabular-nums">
                  {' '}
                  ({peca.indice_unidade}/{peca.total_unidades})
                </span>
              )}
              {/* SESSAO-24: a peça pronta de pedido mora em Pedidos em aguardo. */}
              {peca.local === 'aguardo' && (
                <span className="text-texto-suave"> · em Pedidos em aguardo</span>
              )}
            </>
          ) : peca.reservada_numero !== null ? (
            // D-78: a venda reservou esta peça; ela segue no estoque até o PCP decidir ou o pedido sair.
            <>
              <span className="font-medium">Reservada para o pedido {peca.reservada_numero}</span>
              <span className="text-texto-suave"> · ainda no estoque</span>
            </>
          ) : (
            <span className="font-medium">{origemDaPeca(peca)}</span>
          )}
        </span>
        <span className="text-xs text-texto-suave tabular-nums">
          {peca.item_codigo ? `SKU ${peca.item_codigo}` : 'sem SKU'}
          {peca.item_descricao && ` · ${peca.item_descricao}`}
        </span>
      </div>
      <span className="flex shrink-0 items-center gap-2 text-xs text-texto-suave tabular-nums">
        {peca.qualidade_atual && <BadgeEstado estado={peca.qualidade_atual} tamanho="sm" />}
        <Clock aria-hidden className="size-3.5" />
        {formatarDuracao(peca.desde, agora)}
      </span>
    </li>
  )
}

/** As peças de UM produto (livres no ESTOQUE + reservadas no aguardo) — só ao abrir o detalhe. */
export function PecasDoProduto({ produtoTinyId, agora }: { produtoTinyId: number; agora: number }) {
  const [quantas, setQuantas] = useState(PECAS_POR_VEZ)
  const { data: pecas = [], isPending, isFetching } = useQuery({
    queryKey: ['estoque', 'pecas', produtoTinyId, quantas],
    queryFn: () => listarPecasEstoque({ produtoTinyId, limite: quantas }),
    placeholderData: keepPreviousData,
  })
  const total = pecas[0]?.contagem_total ?? 0
  if (isPending) return <p className="text-sm text-texto-fraco">Carregando as peças…</p>
  if (pecas.length === 0) {
    return <p className="text-sm text-texto-suave">Nenhuma peça deste produto no estoque agora.</p>
  }
  return (
    <div className="rounded-dm border border-borda px-3">
      <ul className="divide-y divide-borda">
        {pecas.map((peca) => (
          <LinhaPeca key={peca.card_id} peca={peca} agora={agora} />
        ))}
      </ul>
      {pecas.length < total && (
        <Botao
          variante="fantasma"
          className="my-2"
          icone={<ChevronDown />}
          carregando={isFetching}
          onClick={() => setQuantas((q) => q + PECAS_POR_VEZ)}
        >
          Ver mais ({total - pecas.length})
        </Botao>
      )}
    </div>
  )
}

/**
 * Tudo o que está no ESTOQUE — só peça SEM DONO desde a SESSAO-24, inclusive
 * o que não é do catálogo (a personalizada de pedido cancelado). Só carrega
 * ao abrir (regra 17).
 */
export function TodasAsPecas({ ativo, agora }: { ativo: boolean; agora: number }) {
  const [aberto, setAberto] = useState(false)
  const [pagina, setPagina] = useState(1)
  const { data: pecas = [], isPending } = useQuery({
    queryKey: ['estoque', 'todas-pecas', pagina],
    queryFn: () =>
      listarPecasEstoque({
        dono: 'livre',
        limite: POR_PAGINA,
        deslocamento: (pagina - 1) * POR_PAGINA,
      }),
    enabled: ativo && aberto,
    placeholderData: keepPreviousData,
  })
  const total = pecas[0]?.contagem_total ?? 0
  return (
    <section aria-label="Todas as peças no ESTOQUE" className="flex flex-col gap-2">
      <Botao
        variante="fantasma"
        className="self-start"
        icone={<Boxes />}
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        {aberto ? 'Esconder as peças do estoque' : 'Ver peça por peça'}
      </Botao>
      {aberto && (
        <div className="flex flex-col gap-2">
          {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
          {!isPending && pecas.length === 0 && (
            <p className="text-sm text-texto-suave">Nenhuma peça parada no ESTOQUE agora.</p>
          )}
          {pecas.length > 0 && (
            <div className="rounded-dm-lg border border-borda bg-superficie px-4">
              <ul className="divide-y divide-borda">
                {pecas.map((peca) => (
                  <LinhaPeca key={peca.card_id} peca={peca} agora={agora} />
                ))}
              </ul>
            </div>
          )}
          {total > POR_PAGINA && (
            <Paginacao
              paginaAtual={pagina}
              totalPaginas={Math.ceil(total / POR_PAGINA)}
              totalItens={total}
              porPagina={POR_PAGINA}
              aoMudarPagina={setPagina}
              className="rounded-dm-lg border border-borda bg-superficie"
            />
          )}
        </div>
      )}
    </section>
  )
}
