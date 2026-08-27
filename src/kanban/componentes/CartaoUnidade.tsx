import { Clock, Flag, MoveRight } from 'lucide-react'
import { BadgeEstado, Botao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { formatarDuracao } from '../tempo'
import type { Card, PedidoResumo } from '../tipos'

export interface CartaoUnidadeProps {
  card: Card
  pedido?: PedidoResumo
  agora: number
  /** Abre o modal "Mover para…" — o gesto de tablet (D-06). */
  aoMover?: (card: Card) => void
  /** true quando o card está num setor terminal (D-13): mostra a chegada. */
  terminal?: boolean
  arrastando?: boolean
}

/**
 * O card de UNIDADE (D-01): o (k/n) que percorre os setores.
 * Mostra pedido de origem, produto, (k/n), tempo na etapa (contador simples —
 * o modelo fila/execução é a SESSAO-05) e o botão de mover (tablet não arrasta
 * bem; drag-and-drop é o gesto de desktop, o botão é o de dedo).
 */
export function CartaoUnidade({
  card,
  pedido,
  agora,
  aoMover,
  terminal = false,
  arrastando = false,
}: CartaoUnidadeProps) {
  const kn =
    card.indice_unidade !== null && card.total_unidades !== null
      ? `(${card.indice_unidade}/${card.total_unidades})`
      : ''

  return (
    <article
      className={cn(
        'flex flex-col gap-2 rounded-dm border border-borda bg-superficie p-3',
        arrastando && 'opacity-60 shadow-lg',
      )}
      aria-label={`Unidade ${kn} do pedido ${pedido?.numero ?? card.pedido_id}`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-texto tabular-nums">
          Pedido {pedido?.numero ?? '…'}
        </span>
        {kn && <span className="text-sm font-medium text-texto-suave tabular-nums">{kn}</span>}
      </header>

      <p className="line-clamp-2 text-sm text-texto">{card.item_descricao ?? 'Sem descrição'}</p>
      {pedido?.cliente_nome && (
        <p className="line-clamp-1 text-xs text-texto-fraco">{pedido.cliente_nome}</p>
      )}

      <footer className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 text-sm text-texto-suave tabular-nums"
          title={card.desde ? `Nesta etapa desde ${new Date(card.desde).toLocaleString('pt-BR')}` : undefined}
        >
          {terminal ? (
            <Flag aria-hidden className="size-4 text-perfeito-forte" />
          ) : (
            <Clock aria-hidden className="size-4" />
          )}
          {formatarDuracao(card.desde, agora)}
          <span className="sr-only">nesta etapa</span>
        </span>

        <span className="flex items-center gap-2">
          {card.qualidade_atual && <BadgeEstado estado={card.qualidade_atual} tamanho="sm" />}
          {aoMover && (
            <Botao
              variante="secundaria"
              tamanho="sm"
              icone={<MoveRight />}
              className="min-h-toque-md"
              onClick={() => aoMover(card)}
            >
              Mover
            </Botao>
          )}
        </span>
      </footer>
    </article>
  )
}
