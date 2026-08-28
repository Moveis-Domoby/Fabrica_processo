import { Camera, ClipboardCheck, Clock, Flag, History, Hourglass, MoveRight, Play, Square, UserRound } from 'lucide-react'
import { BadgeEstado, Botao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { formatarDuracao } from '@/kanban/tempo'
import type { Card, Etapa, ParecerPendente, PedidoResumo } from '@/kanban/tipos'

export interface CartaoTabletProps {
  card: Card
  pedido?: PedidoResumo
  etapa?: Etapa
  agora: number
  /** true no card há mais tempo esperando do setor — o destaque da demanda. */
  esperandoHaMaisTempo?: boolean
  execucaoDesde?: string
  executorNome?: string
  /** D-34: a quem o afazer foi delegado (organiza, não trava). */
  responsavelNome?: string
  parecerPendente?: ParecerPendente
  gestoPendente?: boolean
  terminal?: boolean
  aoReceber: (card: Card) => void
  aoIniciar: (card: Card) => void
  aoFinalizar: (card: Card) => void
  aoMover: (card: Card) => void
  aoFotos: (card: Card) => void
  aoHistorico: (card: Card) => void
}

/**
 * O card da TELA DO SETOR (SESSAO-07): a versão de dedo-de-galpão do card de
 * unidade — dados do produto (nunca do cliente — D-28), tempo grande, e os
 * gestos do operador em botões de 64px. Toda ação pede o PIN de quem age.
 */
export function CartaoTablet({
  card,
  pedido,
  etapa,
  agora,
  esperandoHaMaisTempo = false,
  execucaoDesde,
  executorNome,
  responsavelNome,
  parecerPendente,
  gestoPendente = false,
  terminal = false,
  aoReceber,
  aoIniciar,
  aoFinalizar,
  aoMover,
  aoFotos,
  aoHistorico,
}: CartaoTabletProps) {
  const kn =
    card.indice_unidade !== null && card.total_unidades !== null
      ? `${card.indice_unidade}/${card.total_unidades}`
      : null
  const emExecucao = card.executor_atual_id !== null

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-dm-lg border-2 bg-superficie p-4',
        emExecucao
          ? 'border-acao-ativa'
          : esperandoHaMaisTempo
            ? 'border-atencao-forte'
            : 'border-borda',
      )}
      aria-label={`${card.item_descricao ?? 'Peça'} — pedido ${pedido?.numero ?? card.pedido_id}`}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-lg font-semibold text-texto tabular-nums">
          Pedido {pedido?.numero ?? '…'}
        </span>
        {kn && (
          <span className="rounded-full bg-superficie-sutil px-2.5 py-0.5 text-sm font-medium text-texto-suave tabular-nums">
            unidade {kn}
          </span>
        )}
        {etapa && (
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-sm font-medium',
              etapa.eh_danificado
                ? 'bg-danificado-fundo text-danificado-texto'
                : 'bg-superficie-sutil text-texto-suave',
            )}
          >
            {etapa.nome}
          </span>
        )}
        {card.qualidade_atual && (
          <span className="ml-auto">
            <BadgeEstado estado={card.qualidade_atual} tamanho="sm" />
          </span>
        )}
      </header>

      {/* Dados do PRODUTO — nada de cliente nesta tela (D-28). */}
      <div className="flex flex-col gap-0.5">
        <p className="text-xl font-medium text-texto">{card.item_descricao ?? 'Sem descrição'}</p>
        <p className="text-sm text-texto-fraco tabular-nums">
          {card.item_codigo ? `Código ${card.item_codigo}` : 'Sem código'}
          {pedido?.data_prevista &&
            ` · previsão ${new Date(`${pedido.data_prevista}T12:00:00`).toLocaleDateString('pt-BR')}`}
        </p>
      </div>

      {/* O tempo: fila é do setor, execução é da pessoa. */}
      {terminal ? (
        <p className="inline-flex items-center gap-2 text-base text-texto-suave tabular-nums">
          <Flag aria-hidden className="size-5 text-perfeito-forte" />
          {formatarDuracao(card.desde, agora)} desde a chegada
        </p>
      ) : emExecucao ? (
        <p className="inline-flex flex-wrap items-center gap-2 text-base text-texto tabular-nums">
          <Play aria-hidden className="size-5 text-perfeito-forte" />
          <span className="font-semibold">{formatarDuracao(execucaoDesde ?? card.desde, agora)}</span>
          <span className="inline-flex items-center gap-1.5 text-texto-suave">
            <UserRound aria-hidden className="size-5" />
            {executorNome ?? '…'}
          </span>
        </p>
      ) : (
        <p
          className={cn(
            'inline-flex items-center gap-2 text-base tabular-nums',
            esperandoHaMaisTempo ? 'font-semibold text-atencao-texto' : 'text-texto-suave',
          )}
        >
          {esperandoHaMaisTempo ? (
            <Hourglass aria-hidden className="size-5" />
          ) : (
            <Clock aria-hidden className="size-5" />
          )}
          {formatarDuracao(card.desde, agora)} esperando
          {esperandoHaMaisTempo && <span>· há mais tempo</span>}
        </p>
      )}

      {responsavelNome && !emExecucao && (
        <p className="inline-flex items-center gap-1.5 text-sm text-texto-suave">
          <UserRound aria-hidden className="size-4" />
          para {responsavelNome}
        </p>
      )}

      {parecerPendente && (
        <p className="flex flex-wrap items-center gap-2 rounded-dm bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
          <ClipboardCheck aria-hidden className="size-5 shrink-0" />
          {parecerPendente.setorOrigemNome} entregou como
          <BadgeEstado estado={parecerPendente.estado} tamanho="sm" />
          — confirme o recebimento.
        </p>
      )}

      <footer className="mt-auto flex flex-col gap-2">
        {!terminal &&
          (parecerPendente ? (
            <Botao
              tamanho="galpao"
              larguraTotal
              icone={<ClipboardCheck />}
              disabled={gestoPendente}
              onClick={() => aoReceber(card)}
            >
              Receber
            </Botao>
          ) : emExecucao ? (
            <div className="flex gap-2">
              <Botao
                tamanho="galpao"
                icone={<Square />}
                className="flex-1"
                disabled={gestoPendente}
                onClick={() => aoFinalizar(card)}
              >
                Finalizar
              </Botao>
              <Botao
                variante="secundaria"
                tamanho="galpao"
                icone={<Play />}
                disabled={gestoPendente}
                onClick={() => aoIniciar(card)}
              >
                Assumir
              </Botao>
            </div>
          ) : (
            <Botao
              tamanho="galpao"
              larguraTotal
              icone={<Play />}
              disabled={gestoPendente}
              onClick={() => aoIniciar(card)}
            >
              Iniciar
            </Botao>
          ))}

        <div className="flex gap-2">
          <Botao
            variante="secundaria"
            tamanho="lg"
            icone={<MoveRight />}
            className="flex-1"
            disabled={gestoPendente}
            onClick={() => aoMover(card)}
          >
            Mover
          </Botao>
          {card.item_codigo && (
            <Botao
              variante="secundaria"
              tamanho="lg"
              icone={<Camera />}
              aria-label="Fotos da peça"
              onClick={() => aoFotos(card)}
            />
          )}
          <Botao
            variante="fantasma"
            tamanho="lg"
            icone={<History />}
            aria-label="Linha do tempo do card"
            onClick={() => aoHistorico(card)}
          />
        </div>
      </footer>
    </article>
  )
}
