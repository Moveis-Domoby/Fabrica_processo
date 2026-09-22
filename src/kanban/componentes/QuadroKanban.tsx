import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { ChevronDown, Inbox, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Botao } from '@/componentes/ui'
import { CartaoUnidade } from './CartaoUnidade'
import type {
  Card,
  Etapa,
  ExecucaoAberta,
  ParecerPendente,
  PedidoResumo,
  Setor,
} from '../tipos'

/** Id de coluna no drag-and-drop para cards ainda sem etapa (PCP/terminais). */
const CHEGADA = 'chegada'

/**
 * Uma coluna paginada do quadro (SESSAO-22): a tela só requisita o que mostra —
 * cada coluna carrega 10 cards por vez e "Ver mais" busca os próximos; o total
 * real vem do servidor junto com a primeira página.
 */
export interface ColunaPaginada {
  cards: Card[]
  total: number
  carregandoMais?: boolean
  aoVerMais?: () => void
}

const COLUNA_VAZIA: ColunaPaginada = { cards: [], total: 0 }

/** O que os cards precisam saber além de si mesmos (SESSAO-05). */
export interface ContextoExecucao {
  /** Execução aberta por card (de plt_vw_execucoes). */
  execucoesPorCard: Map<number, ExecucaoAberta>
  /** id → nome, para dizer QUEM executa. */
  nomesUsuarios: Map<string, string>
  /** Quem está olhando a tela (para "você" e para o Assumir). */
  meuUsuarioId: string
  gestoPendente: boolean
  /** Marcações da SESSAO-06 esperando o parecer do recebedor, por card. */
  pareceresPorCard?: Map<number, ParecerPendente>
  aoIniciar?: (card: Card) => void
  aoFinalizar?: (card: Card) => void
  /** SESSAO-22 (D-48): pausar é gesto de líder/admin; retomar, de quem executa. */
  aoPausar?: (card: Card) => void
  aoRetomar?: (card: Card) => void
  aoLinhaTempo?: (card: Card) => void
}

interface ColunaProps {
  id: string
  titulo: string
  ehFila?: boolean
  ehDanificado?: boolean
  dados: ColunaPaginada
  pedidosPorId: Map<number, PedidoResumo>
  agora: number
  terminal: boolean
  aoMover: (card: Card) => void
  aoConcluir?: (card: Card) => void
  arrastavel: boolean
  execucao: ContextoExecucao
}

function Coluna({
  id,
  titulo,
  ehFila = false,
  ehDanificado = false,
  dados,
  pedidosPorId,
  agora,
  terminal,
  aoMover,
  aoConcluir,
  arrastavel,
  execucao,
}: ColunaProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const { cards, total } = dados
  const restantes = total - cards.length

  // Indicador de espera da demanda: com 2+ cards sem ninguém, o que espera há
  // mais tempo ganha destaque (a ordenação por chegada já o põe no topo).
  const esperando = cards.filter((c) => c.executor_atual_id === null)
  const maisAntigoEsperandoId =
    !terminal && esperando.length >= 2
      ? esperando.reduce((a, b) => ((a.desde ?? '') <= (b.desde ?? '') ? a : b)).id
      : null

  return (
    <section
      ref={setNodeRef}
      aria-label={`Etapa ${titulo} com ${total} card(s)`}
      className={cn(
        'flex w-[85vw] max-w-xs shrink-0 snap-start flex-col rounded-dm-lg border bg-superficie-sutil sm:w-72',
        isOver ? 'border-acao-ativa ring-2 ring-acao' : 'border-borda',
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-borda px-3 py-2.5">
        <h3 className="text-sm font-semibold text-texto">{titulo}</h3>
        <span className="flex items-center gap-2">
          {ehFila && (
            <span className="rounded-full bg-info-fundo px-2 py-0.5 text-xs font-medium text-info-texto">
              fila
            </span>
          )}
          {ehDanificado && (
            <span className="rounded-full bg-danificado-fundo px-2 py-0.5 text-xs font-medium text-danificado-texto">
              🔴 dano
            </span>
          )}
          {/* SESSAO-22: o contador é o TOTAL real do servidor, não só o carregado. */}
          <span className="rounded-full bg-superficie px-2 py-0.5 text-xs font-medium text-texto-suave tabular-nums">
            {total}
          </span>
        </span>
      </header>

      <div className="flex min-h-28 flex-1 flex-col gap-2 p-2">
        {cards.length === 0 && (
          <p className="flex flex-1 items-center justify-center py-6 text-sm text-texto-fraco">
            Vazio
          </p>
        )}
        {cards.map((card) => {
          const execucaoAberta = execucao.execucoesPorCard.get(card.id)
          const comuns = {
            card,
            pedido: pedidosPorId.get(card.pedido_id),
            agora,
            terminal,
            aoMover,
            aoConcluir,
            aoIniciar: execucao.aoIniciar,
            aoFinalizar: execucao.aoFinalizar,
            aoPausar: execucao.aoPausar,
            aoRetomar: execucao.aoRetomar,
            aoLinhaTempo: execucao.aoLinhaTempo,
            execucaoDesde: execucaoAberta?.iniciou_em,
            executorNome: card.executor_atual_id
              ? execucao.nomesUsuarios.get(card.executor_atual_id)
              : undefined,
            souExecutor: card.executor_atual_id === execucao.meuUsuarioId,
            esperandoHaMaisTempo: card.id === maisAntigoEsperandoId,
            gestoPendente: execucao.gestoPendente,
            parecerPendente: execucao.pareceresPorCard?.get(card.id),
          }
          return arrastavel ? (
            <CardArrastavel key={card.id} {...comuns} />
          ) : (
            <CartaoUnidade key={card.id} {...comuns} />
          )
        })}

        {restantes > 0 && dados.aoVerMais && (
          <Botao
            variante="fantasma"
            tamanho="sm"
            icone={<ChevronDown />}
            className="min-h-toque-md"
            carregando={dados.carregandoMais}
            onClick={dados.aoVerMais}
          >
            Ver mais ({restantes})
          </Botao>
        )}
      </div>
    </section>
  )
}

type CardArrastavelProps = Parameters<typeof CartaoUnidade>[0]

function CardArrastavel(props: CardArrastavelProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: props.card.id,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn('touch-manipulation', isDragging && 'z-10 cursor-grabbing')}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
    >
      <CartaoUnidade {...props} arrastando={isDragging} />
    </div>
  )
}

export interface QuadroKanbanProps {
  setor: Setor
  etapas: Etapa[]
  /** Uma coluna paginada por chave: 'chegada' (sem etapa) ou o id da etapa. */
  colunas: Map<string, ColunaPaginada>
  pedidosPorId: Map<number, PedidoResumo>
  agora: number
  /** Drag-and-drop entre etapas do MESMO setor (desktop). */
  aoMoverParaEtapa: (card: Card, etapaId: number | null) => void
  /** Abre o modal "Mover para…" (o gesto do tablet). */
  aoAbrirMover: (card: Card) => void
  /** SESSAO-15: "Concluir" — a peça pronta vai para o fim de linha (ESTOQUE). */
  aoAbrirConcluir?: (card: Card) => void
  /** Os gestos e dados de execução da SESSAO-05. */
  execucao: ContextoExecucao
}

/**
 * O quadro de um setor (RF-01/RF-07): etapas internas como colunas, cada uma
 * paginada no servidor (SESSAO-22 — a tela só requisita o que mostra).
 *
 * A coluna "Chegada" ACABOU nos setores de produção (D-48): card que chega cai
 * direto na etapa fila do setor, resolvida pelo banco. Ela só aparece onde a
 * estrutura não mudou (PCP e terminais), num setor de produção ainda SEM fila
 * cadastrada, ou — transitoriamente — se sobrou card sem etapa (com aviso).
 * Dois gestos de movimentação, como manda a demanda: arrastar (desktop) e o
 * botão "Mover" de cada card (tablet).
 */
export function QuadroKanban({
  setor,
  etapas,
  colunas,
  pedidosPorId,
  agora,
  aoMoverParaEtapa,
  aoAbrirMover,
  aoAbrirConcluir,
  execucao,
}: QuadroKanbanProps) {
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const terminal = setor.papel_no_fluxo === 'terminal'
  const producao = setor.papel_no_fluxo === 'producao'
  const temFila = etapas.some((e) => e.eh_fila)

  const dadosDe = (chave: string) => colunas.get(chave) ?? COLUNA_VAZIA
  const chegada = dadosDe(CHEGADA)
  // Produção com fila não desenha a "Chegada" — a menos que tenha sobrado card
  // sem etapa (situação de exceção, avisada abaixo).
  const mostrarChegada = !producao || !temFila || chegada.total > 0
  const todosOsCards = [
    ...(mostrarChegada ? chegada.cards : []),
    ...etapas.flatMap((e) => dadosDe(String(e.id)).cards),
  ]

  function aoSoltar(evento: DragEndEvent) {
    const card = todosOsCards.find((c) => c.id === evento.active.id)
    if (!card || evento.over === null) return
    const etapaId = evento.over.id === CHEGADA ? null : Number(evento.over.id)
    if (etapaId === card.etapa_atual_id) return
    aoMoverParaEtapa(card, etapaId)
  }

  return (
    <DndContext sensors={sensores} onDragEnd={aoSoltar}>
      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 sm:snap-none"
        aria-label={`Quadro do setor ${setor.nome}`}
      >
        {mostrarChegada && (
          <Coluna
            id={CHEGADA}
            titulo="Chegada"
            dados={chegada}
            pedidosPorId={pedidosPorId}
            agora={agora}
            terminal={terminal}
            aoMover={aoAbrirMover}
            aoConcluir={aoAbrirConcluir}
            arrastavel={etapas.length > 0}
            execucao={execucao}
          />
        )}
        {etapas.map((etapa) => (
          <Coluna
            key={etapa.id}
            id={String(etapa.id)}
            titulo={etapa.nome}
            ehFila={etapa.eh_fila}
            ehDanificado={etapa.eh_danificado}
            dados={dadosDe(String(etapa.id))}
            pedidosPorId={pedidosPorId}
            agora={agora}
            terminal={terminal}
            aoMover={aoAbrirMover}
            aoConcluir={aoAbrirConcluir}
            arrastavel
            execucao={execucao}
          />
        ))}
      </div>

      {producao && !temFila && (
        <p className="flex items-center gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo p-4 text-sm text-atencao-texto">
          <TriangleAlert aria-hidden className="size-5 shrink-0" />
          Este setor ainda não tem uma etapa de fila cadastrada — os cards chegam sem etapa.
          Um líder do setor ou admin cadastra a fila em Setores e etapas; feito isso, todo
          card que chegar cai direto nela.
        </p>
      )}
      {producao && temFila && chegada.total > 0 && (
        <p className="flex items-center gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo p-4 text-sm text-atencao-texto">
          <TriangleAlert aria-hidden className="size-5 shrink-0" />
          {chegada.total} card(s) ainda estão sem etapa — mova cada um para a fila do setor
          (a coluna Chegada some quando esvaziar).
        </p>
      )}
      {etapas.length === 0 && !producao && (
        <p className="flex items-center gap-2 rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          <Inbox aria-hidden className="size-5 shrink-0" />
          Este setor ainda não tem etapas internas cadastradas — os cards ficam na Chegada. Um
          líder do setor ou admin cadastra as etapas em Estrutura (cada etapa nova já nasce
          contando tempo).
        </p>
      )}
    </DndContext>
  )
}
