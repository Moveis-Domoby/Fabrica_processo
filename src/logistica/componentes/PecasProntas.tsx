import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Ban, Hourglass, PackageCheck, Search } from 'lucide-react'
import { BadgeEstado, Campo, Paginacao } from '@/componentes/ui'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { pedidoCancelado } from '@/kanban/situacao'
import { listarProdutosReservados } from '@/logistica/api'
import type { ProdutoReservado } from '@/logistica/api'

const POR_PAGINA = 20

/**
 * "Peça por peça" — a antiga aba "Produtos reservados" de Pedidos em aguardo
 * (SESSAO-24, a2 do dono), que veio para a Expedição na SESSAO-38 (D-157): cada
 * peça pronta de pedido esperando a entrega, com o pedido, o SKU e há quanto
 * tempo está pronta. Paginada no servidor; só carrega com a visão aberta.
 */
export function PecasProntas({ ativo }: { ativo: boolean }) {
  const agora = useAgora()
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)

  const { data: linhas = [], isPending } = useQuery({
    queryKey: ['produtos-reservados', busca, pagina],
    queryFn: () =>
      listarProdutosReservados({
        busca,
        limite: POR_PAGINA,
        deslocamento: (pagina - 1) * POR_PAGINA,
      }),
    enabled: ativo,
    placeholderData: keepPreviousData,
  })
  const total = Number(linhas[0]?.contagem_total ?? 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="max-w-md">
        <Campo
          rotulo="Buscar peça pronta"
          prefixo={<Search />}
          placeholder="Produto, SKU, número do pedido ou cliente"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
            setPagina(1)
          }}
        />
      </div>

      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {!isPending && linhas.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nenhuma peça pronta esperando entrega{busca ? ' para esta busca' : ''} — a peça de um
          pedido aparece aqui quando a LIMPEZA E EMBALAGEM conclui a produção.
        </p>
      )}

      <ul className="flex flex-col divide-y divide-borda rounded-dm-lg border border-borda bg-superficie">
        {linhas.map((linha) => (
          <LinhaPeca key={linha.card_id} linha={linha} agora={agora} />
        ))}
      </ul>

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
  )
}

function LinhaPeca({ linha, agora }: { linha: ProdutoReservado; agora: number }) {
  return (
    <li className="flex flex-col gap-1.5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm text-texto">
          <span className="font-medium">{linha.item_descricao ?? 'Sem descrição'}</span>
          {linha.indice_unidade !== null && (
            <span className="tabular-nums">
              {' '}
              ({linha.indice_unidade}/{linha.total_unidades})
            </span>
          )}
        </span>
        {/* As duas etiquetas da peça reservada (D-56): SKU + nº do pedido. */}
        <span className="text-xs text-texto-suave tabular-nums">
          {linha.item_codigo ? `SKU ${linha.item_codigo}` : 'sem SKU'} · Pedido {linha.numero}
          {linha.cliente_nome && ` · ${linha.cliente_nome}`}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {linha.pedido_completo && (
            <BadgeEstado estado="perfeito" rotulo="Pedido completo" tamanho="sm" />
          )}
          {linha.veio_do_estoque && (
            <span className="inline-flex items-center gap-1 rounded-full bg-superficie-sutil px-2.5 py-0.5 text-xs font-medium text-texto-suave">
              <PackageCheck aria-hidden className="size-3.5" />
              Veio do estoque
            </span>
          )}
          {pedidoCancelado(linha.situacao) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danificado-fundo px-2.5 py-0.5 text-xs font-medium text-danificado-texto">
              <Ban aria-hidden className="size-3.5" />
              Cancelado no Tiny
            </span>
          )}
          {linha.qualidade_atual && linha.qualidade_atual !== 'perfeito' && (
            <BadgeEstado estado={linha.qualidade_atual} tamanho="sm" />
          )}
        </span>
      </div>
      <span
        className="inline-flex shrink-0 items-center gap-1.5 text-sm text-texto-suave tabular-nums"
        title={
          linha.pronta_em
            ? `Pronta desde ${new Date(linha.pronta_em).toLocaleString('pt-BR')}`
            : undefined
        }
      >
        <Hourglass aria-hidden className="size-4" />
        {linha.pronta_em ? `pronta há ${formatarDuracao(linha.pronta_em, agora)}` : '—'}
      </span>
    </li>
  )
}
