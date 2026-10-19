import {
  DndContext,
  KeyboardSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { useRef } from 'react'
import {
  ArrowRight,
  ChevronDown,
  CircleCheckBig,
  Hand,
  Handshake,
  Inbox,
  Pause,
  Play,
  TriangleAlert,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Botao } from '@/componentes/ui'
import { CartaoUnidade } from './CartaoUnidade'
import { useCamposDasPecas } from '@/utilitarios/consultas'
import type { CampoMostrado } from '@/utilitarios/consultas'
import { etapaDeInicio } from '../arrasto'
import { SensorDoMouse, useArrastarParaOLado } from './arrastarQuadro'
import type { Card, Etapa, ExecucaoAberta, PedidoDoCard, Setor } from '../tipos'

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
  /** Quem está olhando a tela (para o "você"). */
  meuUsuarioId: string
  gestoPendente: boolean
  aoLinhaTempo?: (card: Card) => void
  /** Tablet (D-28): o espaço de imagens da peça. */
  aoFotos?: (card: Card) => void
  /** SESSAO-31: nome e foto de quem aparece nos cards (responsáveis) — vem com o quadro. */
  pessoas?: Map<string, { nome: string; foto: string | null }>
  /** SESSAO-31 (§3): clicar no card (sem arrastar) abre a janela dele. */
  aoAbrirCard?: (card: Card) => void
  /** SESSAO-36 (D-146): entrar no card em execução como AUXILIAR (tempo próprio). */
  aoAuxiliar?: (card: Card) => void
  /** SESSAO-37 (D-147): cards com ajuda ATIVA agora (o dono pausado não derruba o card). */
  cardsComAjudaAtiva?: Set<number>
  /** SESSAO-37 (D-147): o topo da coluna em execução — ajudar em TODOS os cards de uma vez. */
  aoAuxiliarTodos?: () => void
  /** SESSAO-37 (D-147): o pausar geral — a PESSOA se pausa em todos os cards (o card segue com quem ficou). */
  aoPausarGeral?: () => void
}

interface ColunaProps {
  id: string
  titulo: string
  ehFila?: boolean
  ehDanificado?: boolean
  /** SESSAO-24: soltar aqui inicia o tempo de quem arrastou. */
  ehInicio?: boolean
  /** SESSAO-24: soltar aqui leva o card para este setor (nome já resolvido). */
  levaPara?: string
  /** SESSAO-31 (D-127): soltar a peça aqui conclui a produção (a EXPEDIÇÃO). */
  conclui?: boolean
  dados: ColunaPaginada
  pedidosPorId: Map<number, PedidoDoCard>
  agora: number
  terminal: boolean
  aoConcluir?: (card: Card) => void
  arrastavel: boolean
  execucao: ContextoExecucao
  tamanho: 'padrao' | 'galpao'
  /** SESSAO-27 (D-101): os campos customizados preenchidos de cada peça mostrada. */
  camposPorCard: Map<number, CampoMostrado[]>
  /** true logo depois de um arrasto — o clique que vem junto não abre a janela. */
  acabouDeArrastar: () => boolean
}

function Coluna({
  id,
  titulo,
  ehFila = false,
  ehDanificado = false,
  ehInicio = false,
  levaPara,
  conclui = false,
  dados,
  pedidosPorId,
  agora,
  terminal,
  aoConcluir,
  arrastavel,
  execucao,
  tamanho,
  camposPorCard,
  acabouDeArrastar,
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
    // ↩️ Ajuste do dono (14/10 noite): a coluna inteira (de cima a baixo) recebe
    // o card, mas o painel só cresce com os cards — vazia, é só o cabeçalho. Entre
    // as colunas, uma linha fina e clara marca a área (a borda à esquerda).
    <section
      ref={setNodeRef}
      aria-label={
        levaPara
          ? `Etapa ${titulo}: solte aqui para mandar o card para ${levaPara}`
          : conclui
            ? `Etapa ${titulo}: solte aqui a peça pronta para concluir a produção`
            : `Etapa ${titulo} com ${total} card(s)`
      }
      className={cn(
        'flex shrink-0 snap-start flex-col self-stretch px-1.5',
        tamanho === 'galpao' ? 'w-[85vw] max-w-sm sm:w-80' : 'w-[85vw] max-w-xs sm:w-72',
      )}
    >
      <div
        className={cn(
          'flex flex-col rounded-dm-lg border bg-superficie-sutil/40 transition-colors',
          isOver ? 'border-acao-ativa bg-acao/5 ring-2 ring-acao' : 'border-borda/40',
          (levaPara || conclui) && !isOver && 'border-dashed',
        )}
      >
        <header
          className={cn(
            'flex flex-col gap-1 px-3 py-2.5',
            (cards.length > 0 || restantes > 0) && 'border-b border-borda/40',
          )}
        >
          <div className="flex items-center justify-between gap-2">
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
              {!levaPara && (!conclui || total > 0) && (
                <span className="rounded-full bg-superficie px-2 py-0.5 text-xs font-medium text-texto-suave tabular-nums">
                  {total}
                </span>
              )}
            </span>
          </div>
          {/* SESSAO-24: o que soltar aqui faz — ícone + texto (M-12). */}
          {ehInicio && (
            <span className="inline-flex items-center gap-1 text-xs text-texto-suave">
              <Play aria-hidden className="size-3.5 text-perfeito-forte" />
              soltar aqui começa o tempo
            </span>
          )}
          {levaPara && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-texto">
              <ArrowRight aria-hidden className="size-3.5" />
              leva para {levaPara}
            </span>
          )}
          {conclui && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-texto">
              <CircleCheckBig aria-hidden className="size-3.5 text-perfeito-forte" />
              conclui a produção
            </span>
          )}
          {/* SESSAO-37 (D-147): a coluna com card em execução ganha o AJUDAR EM
              TUDO (entra como auxiliar em todos de uma vez) e o PAUSAR GERAL
              (a pessoa se pausa em tudo — o card segue com quem ficou). */}
          {cards.some((c) => c.executor_atual_id !== null) &&
            (execucao.aoAuxiliarTodos || execucao.aoPausarGeral) && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {execucao.aoAuxiliarTodos && (
                  <Botao
                    tamanho="sm"
                    variante="secundaria"
                    icone={<Handshake />}
                    disabled={execucao.gestoPendente}
                    onClick={execucao.aoAuxiliarTodos}
                  >
                    Ajudar em tudo
                  </Botao>
                )}
                {execucao.aoPausarGeral && (
                  <Botao
                    tamanho="sm"
                    variante="fantasma"
                    icone={<Pause />}
                    disabled={execucao.gestoPendente}
                    onClick={execucao.aoPausarGeral}
                  >
                    Pausar geral
                  </Botao>
                )}
              </div>
            )}
        </header>

        {(cards.length > 0 || restantes > 0) && (
          <div className="flex flex-col gap-2 p-2">
            {cards.map((card) => {
              const execucaoAberta = execucao.execucoesPorCard.get(card.id)
              const comuns = {
                card,
                pedido: card.pedido_id === null ? undefined : pedidosPorId.get(card.pedido_id),
                agora,
                terminal,
                // ↩️ Ajuste do dono (14/10 noite): o "Concluir" é SÓ do card avulso
                // (D-125) — a peça conclui na etapa que conclui (D-127).
                aoConcluir: card.tipo === 'avulso' ? aoConcluir : undefined,
                aoLinhaTempo: execucao.aoLinhaTempo,
                aoFotos: execucao.aoFotos,
                aoAuxiliar: execucao.aoAuxiliar,
                execucaoDesde: execucaoAberta?.iniciou_em,
                executorNome: card.executor_atual_id
                  ? execucao.nomesUsuarios.get(card.executor_atual_id)
                  : undefined,
                souExecutor: card.executor_atual_id === execucao.meuUsuarioId,
                esperandoHaMaisTempo: card.id === maisAntigoEsperandoId,
                gestoPendente: execucao.gestoPendente,
                tamanho,
                campos: camposPorCard.get(card.id),
                pessoas: execucao.pessoas,
                // SESSAO-37 (D-147): com ajuda ativa, o dono pausado não derruba o card.
                ajudaAtiva: execucao.cardsComAjudaAtiva?.has(card.id) ?? false,
                aoAbrir: execucao.aoAbrirCard
                  ? (c: Card) => {
                      if (!acabouDeArrastar()) execucao.aoAbrirCard?.(c)
                    }
                  : undefined,
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
        )}
      </div>
    </section>
  )
}

/** O quadro ainda abrindo: o desenho das colunas, sem aviso nenhum (nada pisca). */
function EsqueletoDoQuadro({ tamanho }: { tamanho: 'padrao' | 'galpao' }) {
  return (
    <div
      className="flex divide-x divide-borda/40 overflow-hidden pb-3"
      aria-busy="true"
      aria-label="Abrindo o quadro"
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            'flex shrink-0 flex-col gap-2 px-1.5',
            tamanho === 'galpao' ? 'w-[85vw] max-w-sm sm:w-80' : 'w-[85vw] max-w-xs sm:w-72',
          )}
        >
          <div className="h-11 animate-pulse rounded-dm-lg bg-superficie-sutil/60" />
          {i === 0 && <div className="h-28 animate-pulse rounded-dm-lg bg-superficie-sutil/40" />}
        </div>
      ))}
    </div>
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
      // SESSAO-31: Enter abre a janela do card; Espaço segue pegando para arrastar.
      onKeyDown={(e) => {
        if (e.key === 'Enter' && props.aoAbrir) {
          e.preventDefault()
          props.aoAbrir(props.card)
          return
        }
        listeners?.onKeyDown?.(e)
      }}
      aria-roledescription="card arrastável"
      aria-description={props.aoAbrir ? 'Enter abre o card; Espaço pega para arrastar.' : undefined}
      className={cn(
        'touch-manipulation rounded-dm',
        isDragging ? 'z-10 cursor-grabbing' : 'cursor-grab',
      )}
      style={
        transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
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
  pedidosPorId: Map<number, PedidoDoCard>
  agora: number
  /**
   * SESSAO-24: o GESTO do quadro — o card foi solto numa coluna (nula =
   * Chegada). Quem chama decide o que perguntar antes (estado da peça,
   * parecer, PIN) e manda ao banco, que resolve o resto.
   */
  aoSoltarNaEtapa: (card: Card, etapaId: number | null) => void
  /** SESSAO-31 (D-125): o "Concluir" do card avulso (a peça conclui na EXPEDIÇÃO). */
  aoAbrirConcluir?: (card: Card) => void
  /** Para as colunas que encaminham dizerem PARA ONDE (id → setor). */
  setores?: Setor[]
  /** Os dados de execução da SESSAO-05. */
  execucao: ContextoExecucao
  /** 'galpao' = a tela do setor no tablet (colunas e letra maiores — D-06). */
  tamanho?: 'padrao' | 'galpao'
  /**
   * SESSAO-31 (Lei §2): os campos de cada card já vieram com o quadro (uma
   * requisição) — sem isto, o quadro pergunta à parte (o jeito antigo).
   */
  camposPorCard?: Map<number, CampoMostrado[]>
  /**
   * ↩️ Ajuste do dono (14/10 noite): o quadro ainda não chegou — mostra o
   * esqueleto das colunas e NENHUM aviso (o "setor sem fila" piscava ao trocar
   * de setor, porque as etapas ainda estavam vazias).
   */
  carregando?: boolean
}

/**
 * O quadro de um setor (RF-01/RF-07): etapas internas como colunas, cada uma
 * paginada no servidor (SESSAO-22 — a tela só requisita o que mostra).
 *
 * A coluna "Chegada" ACABOU nos setores de produção (D-48): card que chega cai
 * direto na etapa fila do setor, resolvida pelo banco. Ela só aparece onde a
 * estrutura não mudou (PCP e terminais), num setor de produção ainda SEM fila
 * cadastrada, ou — transitoriamente — se sobrou card sem etapa (com aviso).
 *
 * SESSAO-24 (dono, 27/09): o quadro é só ARRASTO — o botão "Mover" saiu.
 * Mouse arrasta depois de 8px; no toque, segurar ~0,2s pega o card (um
 * deslize rápido continua rolando a tela); pelo teclado, Espaço pega e as
 * setas levam. A coluna de início diz "começa o tempo"; a que encaminha diz
 * "leva para X" (e fica sempre vazia: o card segue para o outro setor).
 */
export function QuadroKanban({
  setor,
  etapas,
  colunas,
  pedidosPorId,
  agora,
  aoSoltarNaEtapa,
  aoAbrirConcluir,
  setores = [],
  execucao,
  tamanho = 'padrao',
  camposPorCard: camposVindos,
  carregando = false,
}: QuadroKanbanProps) {
  const sensores = useSensors(
    // Só o botão esquerdo pega o card — o do meio é da mãozinha (arrastarQuadro).
    useSensor(SensorDoMouse, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    // SESSAO-31: só o Espaço pega o card (o Enter abre a janela).
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  )
  // O clique que o navegador dispara no fim de um arrasto não abre a janela.
  const arrastouEm = useRef(0)
  const acabouDeArrastar = () => Date.now() - arrastouEm.current < 300
  const terminal = setor.papel_no_fluxo === 'terminal'
  const producao = setor.papel_no_fluxo === 'producao'
  const temFila = etapas.some((e) => e.eh_fila)
  const inicioId = producao ? etapaDeInicio(etapas)?.id : undefined
  const nomeDoSetor = new Map(setores.map((s) => [s.id, s.nome]))

  const dadosDe = (chave: string) => colunas.get(chave) ?? COLUNA_VAZIA
  const chegada = dadosDe(CHEGADA)
  // Produção com fila não desenha a "Chegada" — a menos que tenha sobrado card
  // sem etapa (situação de exceção, avisada abaixo).
  const mostrarChegada = !producao || !temFila || chegada.total > 0
  const todosOsCards = [
    ...(mostrarChegada ? chegada.cards : []),
    ...etapas.flatMap((e) => dadosDe(String(e.id)).cards),
  ]
  const camposPerguntados = useCamposDasPecas(camposVindos ? [] : todosOsCards.map((c) => c.id))
  const camposPorCard = camposVindos ?? camposPerguntados
  // Pedido do dono (15/10): a "mãozinha" — o quadro corre para o lado com o
  // botão do meio do mouse, ou com o esquerdo no fundo vazio.
  const { arrastando: correndoQuadro, propsDoQuadro } = useArrastarParaOLado()

  function aoSoltar(evento: DragEndEvent) {
    arrastouEm.current = Date.now()
    const card = todosOsCards.find((c) => c.id === evento.active.id)
    if (!card || evento.over === null) return
    const etapaId = evento.over.id === CHEGADA ? null : Number(evento.over.id)
    if (etapaId === card.etapa_atual_id) return
    aoSoltarNaEtapa(card, etapaId)
  }

  if (carregando && etapas.length === 0) return <EsqueletoDoQuadro tamanho={tamanho} />

  return (
    <DndContext
      sensors={sensores}
      onDragStart={() => (arrastouEm.current = Date.now())}
      onDragCancel={() => (arrastouEm.current = Date.now())}
      onDragEnd={aoSoltar}
    >
      <div
        {...propsDoQuadro}
        className={cn(
          'flex snap-x snap-mandatory divide-x divide-borda/40 overflow-x-auto pb-3 sm:snap-none',
          correndoQuadro ? 'cursor-grabbing select-none' : 'cursor-grab',
        )}
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
            aoConcluir={aoAbrirConcluir}
            arrastavel={etapas.length > 0}
            execucao={execucao}
            camposPorCard={camposPorCard}
            acabouDeArrastar={acabouDeArrastar}
            tamanho={tamanho}
          />
        )}
        {etapas.map((etapa) => (
          <Coluna
            key={etapa.id}
            id={String(etapa.id)}
            titulo={etapa.nome}
            ehFila={etapa.eh_fila}
            ehDanificado={etapa.eh_danificado}
            ehInicio={etapa.id === inicioId}
            levaPara={
              etapa.setor_destino_id !== null
                ? (nomeDoSetor.get(etapa.setor_destino_id) ?? 'outro setor')
                : undefined
            }
            conclui={etapa.conclui_producao}
            dados={dadosDe(String(etapa.id))}
            pedidosPorId={pedidosPorId}
            agora={agora}
            terminal={terminal}
            aoConcluir={aoAbrirConcluir}
            arrastavel
            execucao={execucao}
            camposPorCard={camposPorCard}
            acabouDeArrastar={acabouDeArrastar}
            tamanho={tamanho}
          />
        ))}
      </div>
      {/* Só no mouse: como correr o quadro para o lado. */}
      <p className="hidden items-center gap-1.5 text-xs text-texto-fraco [@media(pointer:fine)]:flex">
        <Hand aria-hidden className="size-3.5" />
        Para ver as outras colunas: segure o fundo do quadro (ou o botão do meio do mouse) e arraste
        para o lado.
      </p>

      {producao && !temFila && (
        <p className="flex items-center gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo p-4 text-sm text-atencao-texto">
          <TriangleAlert aria-hidden className="size-5 shrink-0" />
          Este setor ainda não tem uma etapa de fila cadastrada — os cards chegam sem etapa. Um
          líder do setor ou admin cadastra a fila em Setores e etapas; feito isso, todo card que
          chegar cai direto nela.
        </p>
      )}
      {producao && temFila && chegada.total > 0 && (
        <p className="flex items-center gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo p-4 text-sm text-atencao-texto">
          <TriangleAlert aria-hidden className="size-5 shrink-0" />
          {chegada.total} card(s) ainda estão sem etapa — arraste cada um para a fila do setor (a
          coluna Chegada some quando esvaziar).
        </p>
      )}
      {etapas.length === 0 && !producao && (
        <p className="flex items-center gap-2 rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          <Inbox aria-hidden className="size-5 shrink-0" />
          Este setor ainda não tem etapas internas cadastradas — os cards ficam na Chegada. Um líder
          do setor ou admin cadastra as etapas em Estrutura (cada etapa nova já nasce contando
          tempo).
        </p>
      )}
    </DndContext>
  )
}
