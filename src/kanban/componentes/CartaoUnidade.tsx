import {
  AlignLeft,
  Ban,
  CircleCheckBig,
  Clock,
  ClipboardCheck,
  Flag,
  GripVertical,
  Handshake,
  History,
  Hourglass,
  Images,
  Link2,
  MessageSquare,
  Moon,
  Paperclip,
  Pause,
  Play,
  Wrench,
} from 'lucide-react'
import { BadgeEstado, Botao, Dica } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { AvatarPessoa } from '@/componentes/ui'
import { urlDaFoto } from '@/perfil/api'
import { iniciais } from '@/chat/formato'
import { ROTULO_DESTINO_FINAL } from '@/logistica/devolucao'
import { formatarDuracao, formatarDuracaoMs } from '../tempo'
import { duracaoUtilDesde, noExpediente } from '../tempoUtil'
import { useReguaTempo } from '../useReguaTempo'
import { pedidoCancelado } from '../situacao'
import type { Card, PedidoDoCard } from '../tipos'
import { nomeDoCard, rotuloOrigemCard } from '../rotulos'
import { EtiquetasDoCard } from '@/utilitarios/PilulaEtiqueta'
import type { CampoMostrado } from '@/utilitarios/consultas'
import { prioridadeDe } from '../prioridade'
import { ChipPrazo, PontoPrioridade } from './MarcasDoCard'

/** Os rostos dos responsáveis (até 3 + "+N") — o nome vai no texto acessível. */
function Responsaveis({
  ids,
  pessoas,
}: {
  ids: string[]
  pessoas?: Map<string, { nome: string; foto: string | null }>
}) {
  const nomes = ids.map((id) => pessoas?.get(id)?.nome ?? 'alguém')
  return (
    <span className="flex items-center" aria-label={`Responsáveis: ${nomes.join(', ')}`} role="img">
      {ids.slice(0, 3).map((id, i) => {
        const p = pessoas?.get(id)
        const url = urlDaFoto(p?.foto ?? null)
        return url ? (
          <img
            key={id}
            src={url}
            alt=""
            title={p?.nome}
            className={cn(
              'size-6 rounded-full border-2 border-superficie object-cover',
              i > 0 && '-ml-1.5',
            )}
          />
        ) : (
          <span
            key={id}
            title={p?.nome}
            className={cn(
              'inline-flex size-6 items-center justify-center rounded-full border-2 border-superficie bg-superficie-sutil text-[10px] font-semibold text-texto-suave',
              i > 0 && '-ml-1.5',
            )}
          >
            {iniciais(p?.nome ?? null) || '?'}
          </span>
        )
      })}
      {ids.length > 3 && (
        <span className="-ml-1.5 inline-flex size-6 items-center justify-center rounded-full border-2 border-superficie bg-superficie-sutil text-[10px] font-semibold text-texto-suave">
          +{ids.length - 3}
        </span>
      )}
    </span>
  )
}

export interface CartaoUnidadeProps {
  card: Card
  pedido?: PedidoDoCard
  agora: number
  /**
   * O único botão de gesto do card. ↩️ SESSAO-31 (D-127): a peça não tem mais
   * "Concluir produção" — a LIMPEZA E EMBALAGEM conclui soltando na EXPEDIÇÃO;
   * o "Concluir" fica para o card avulso (D-125), em qualquer setor.
   */
  aoConcluir?: (card: Card) => void
  /** Abre a linha do tempo do card (SESSAO-05). */
  aoLinhaTempo?: (card: Card) => void
  /** Tablet (D-28): o espaço de imagens da peça. */
  aoFotos?: (card: Card) => void
  /** SESSAO-36 (D-146): entrar no card em execução como AUXILIAR, com tempo próprio. */
  aoAuxiliar?: (card: Card) => void
  /** Desde quando a execução aberta corre (vem de plt_vw_execucoes). */
  execucaoDesde?: string
  /** Nome de quem está executando agora. */
  executorNome?: string
  /** true quando quem olha a tela é o executor atual. */
  souExecutor?: boolean
  /** true no card há mais tempo esperando sem ninguém na etapa (indicador da demanda). */
  esperandoHaMaisTempo?: boolean
  /** Desabilita o botão enquanto um gesto roda. */
  gestoPendente?: boolean
  /** true quando o card está num setor terminal (D-13): mostra a chegada. */
  terminal?: boolean
  arrastando?: boolean
  /** 'galpao' = a tela do setor no tablet: letra maior, sem dado de cliente (D-28). */
  tamanho?: 'padrao' | 'galpao'
  /** SESSAO-27 (D-101): os campos customizados preenchidos desta peça. */
  campos?: CampoMostrado[]
  /** SESSAO-31: nome e foto de quem aparece no card (responsáveis). */
  pessoas?: Map<string, { nome: string; foto: string | null }>
  /** SESSAO-31 (§3): clicar no card abre a janela dele. */
  aoAbrir?: (card: Card) => void
  /** SESSAO-37 (D-147): tem ajuda ATIVA agora — com o dono pausado, o card segue rodando. */
  ajudaAtiva?: boolean
}

/**
 * O card de UNIDADE (D-01): o (k/n) que percorre os setores.
 * O tempo mora nele desde a SESSAO-05 (D-02/D-24): na fila, o tempo do SETOR
 * (sem dono); em execução, QUEM executa e há quanto tempo.
 *
 * SESSAO-24 (dono, 27/09): os botões de gesto saíram — o card se ARRASTA.
 * Soltar na etapa de trabalho inicia o tempo; soltar numa etapa com nome de
 * setor (ou no CONCLUÍDO) leva o card adiante; na EXPEDIÇÃO da LIMPEZA E
 * EMBALAGEM, conclui (SESSAO-31 — D-127). Ficam só os ícones de ver
 * (histórico, fotos).
 */
export function CartaoUnidade({
  card,
  pedido,
  agora,
  aoConcluir,
  aoLinhaTempo,
  aoFotos,
  aoAuxiliar,
  execucaoDesde,
  executorNome,
  souExecutor = false,
  esperandoHaMaisTempo = false,
  gestoPendente = false,
  terminal = false,
  arrastando = false,
  tamanho = 'padrao',
  campos,
  pessoas,
  aoAbrir,
  ajudaAtiva = false,
}: CartaoUnidadeProps) {
  const galpao = tamanho === 'galpao'
  const kn =
    card.indice_unidade !== null && card.total_unidades !== null
      ? `(${card.indice_unidade}/${card.total_unidades})`
      : ''
  const emExecucao = card.executor_atual_id !== null
  // SESSAO-22 (D-48): pausado não conta tempo nem ocupa o limite.
  // SESSAO-37 (D-147): a pausa é da pessoa — com ajuda ATIVA, o card não cai
  // para Pausado: segue em execução com quem ficou.
  const pausado = emExecucao && card.pausado_em !== null && !ajudaAtiva
  // SESSAO-31 (§4): o motivo da pausa — ou da parada (solto no PARADO, sem execução).
  const motivo = card.pausa_motivo ?? null
  const parado = !emExecucao && motivo !== null
  // SESSAO-24: a peça segue na produção com o pedido cancelado — ao concluir,
  // ela vai para o estoque sem dono. Lido da situação do pedido (a mesma fonte
  // do evento de cancelamento — nada guardado para dessincronizar).
  const cancelado = card.pedido_id !== null && pedidoCancelado(pedido?.situacao)
  // SESSAO-38 (F5 · D-167 ⏳): todo relógio do card conta só o expediente do
  // setor (sem a régua — banco antigo — o relógio corrido de sempre). A execução
  // segue corrida: quem trabalha fora do horário está em hora extra — conta.
  const regua = useReguaTempo()
  const setorDoCard = card.setor_atual_id
  const desdeUtil = (iso: string | null | undefined) =>
    regua ? duracaoUtilDesde(iso, agora, setorDoCard, regua) : formatarDuracao(iso, agora)
  const foraDoExpediente = regua !== null && !noExpediente(agora, setorDoCard, regua)
  // SESSAO-36 (D-146): o Auxiliar só existe no card EM EXECUÇÃO (não pausado).
  const podeAuxiliar = Boolean(aoAuxiliar) && emExecucao && !pausado && !terminal
  const auxiliares = card.auxiliares ?? []
  const temRodape = aoLinhaTempo || aoFotos || (!terminal && aoConcluir) || podeAuxiliar
  // SESSAO-31 (D-125 / §2): a frente enxuta — só o que o card tem.
  const avulso = card.tipo === 'avulso'
  const responsaveis = card.responsaveis ?? []
  // SESSAO-38 (item 1 do dono — D-150): o prazo é a data de entrega do pedido
  // no Tiny (lida ao vivo pelo servidor); no avulso, o vencimento digitado.
  const entrega = terminal
    ? null
    : (card.data_entrega ?? pedido?.data_prevista ?? (avulso ? card.vence_em : null) ?? null)
  // SESSAO-38 (D-150): a prioridade (a peça mostra a do pedido).
  const prioridade = prioridadeDe(card.prioridade)
  const urgente = prioridade === 'urgente'
  const anexos = card.anexos_qtd ?? 0
  const mensagens = card.mensagens_qtd ?? 0
  const temIndicadores =
    Boolean(card.descricao) || anexos > 0 || mensagens > 0 || responsaveis.length > 0

  return (
    <article
      className={cn(
        'relative flex flex-col gap-2 overflow-hidden rounded-dm border bg-superficie',
        galpao ? 'p-4' : 'p-3',
        // urgência tem de ser urgente (pedido do dono): a borda grossa vermelha
        urgente
          ? 'border-2 border-danificado-forte'
          : emExecucao
            ? 'border-acao-ativa'
            : 'border-borda',
        arrastando && 'opacity-60 shadow-lg',
        aoAbrir && 'cursor-pointer hover:border-borda-forte',
      )}
      onClick={aoAbrir ? () => aoAbrir(card) : undefined}
      aria-label={
        avulso
          ? `Card avulso — ${nomeDoCard(card)}`
          : `Unidade ${kn} — ${rotuloOrigemCard(card, pedido)}`
      }
    >
      {urgente && (
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-danificado-forte" />
      )}
      <header className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <PontoPrioridade prioridade={prioridade} tamanho={tamanho} comTexto />
          <span
            className={cn(
              'font-semibold text-texto tabular-nums',
              galpao ? 'text-base' : 'text-sm',
            )}
          >
            {rotuloOrigemCard(card, pedido)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <ChipPrazo data={entrega} agora={agora} tamanho={tamanho} />
          {kn && (
            <span
              className={cn(
                'font-medium text-texto-suave tabular-nums',
                galpao ? 'text-base' : 'text-sm',
              )}
            >
              {kn}
            </span>
          )}
          {/* O card se arrasta (SESSAO-24) — a pega diz isso sem texto. */}
          <GripVertical aria-hidden className="size-4 shrink-0 text-texto-fraco" />
        </span>
      </header>

      <p className={cn('line-clamp-2 text-texto', galpao ? 'text-lg font-medium' : 'text-sm')}>
        {nomeDoCard(card)}
      </p>
      {/* SESSAO-31 (D-125): o vínculo do avulso é só referência — linha pequena. */}
      {avulso && card.vinculo_rotulo && (
        <p className="inline-flex min-w-0 items-center gap-1 text-xs text-texto-suave">
          <Link2 aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{card.vinculo_rotulo}</span>
        </p>
      )}
      {/* D-130: a peça em ajuste e para onde ela vai ao terminar. */}
      {card.ajuste_destino && (
        <p>
          <span className="inline-flex items-center gap-1 rounded-full bg-info-fundo px-2.5 py-0.5 text-xs font-medium text-info-texto">
            <Wrench aria-hidden className="size-3.5" />
            Ajuste · vai para {ROTULO_DESTINO_FINAL[card.ajuste_destino].toLowerCase()}
          </span>
        </p>
      )}
      {/* ↩️ SESSAO-38 (item 3 do dono): o card do setor não mostra o nome do
          cliente — nem no computador (D-28 já valia no tablet). Quem precisa vê
          na janela do card e no PCP. */}
      {cancelado && (
        // M-12: estado com ícone + texto, nunca só cor.
        <p>
          <span className="inline-flex items-center gap-1 rounded-full bg-danificado-fundo px-2.5 py-0.5 text-xs font-medium text-danificado-texto">
            <Ban aria-hidden className="size-3.5" />
            Pedido cancelado — pronta, vai para o estoque
          </span>
        </p>
      )}
      {/* SESSAO-27 (D-101): etiquetas e campos customizados — também no tablet. */}
      <EtiquetasDoCard ids={card.etiquetas} tamanho={galpao ? 'galpao' : 'sm'} />
      {/* ↩️ SESSAO-38: o vencimento virou o chip do prazo, no topo do card. */}
      {temIndicadores && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {responsaveis.length > 0 && <Responsaveis ids={responsaveis} pessoas={pessoas} />}
          {card.descricao && (
            // O botãozinho da descrição: passar o mouse (ou tocar) mostra o texto.
            // Enter/Espaço nele é dele — não vira arrasto de teclado.
            <span
              className="-my-2"
              onKeyDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <Dica
                rotulo="Ver a descrição do card"
                icone={<AlignLeft aria-hidden className="size-4" />}
              >
                <span className="whitespace-pre-wrap">{card.descricao}</span>
              </Dica>
            </span>
          )}
          {anexos > 0 && (
            <span
              className="inline-flex items-center gap-1 text-xs text-texto-suave tabular-nums"
              aria-label={anexos === 1 ? '1 anexo' : `${anexos} anexos`}
            >
              <Paperclip aria-hidden className="size-3.5" />
              {anexos}
            </span>
          )}
          {mensagens > 0 && (
            <span
              className="inline-flex items-center gap-1 text-xs text-texto-suave tabular-nums"
              aria-label={mensagens === 1 ? '1 mensagem' : `${mensagens} mensagens`}
            >
              <MessageSquare aria-hidden className="size-3.5" />
              {mensagens}
            </span>
          )}
        </div>
      )}
      {campos && campos.length > 0 && (
        <dl className={cn('flex flex-col gap-0.5', galpao ? 'text-sm' : 'text-xs')}>
          {campos.slice(0, 3).map((c) => (
            <div key={c.campoId} className="flex min-w-0 gap-1">
              <dt className="shrink-0 text-texto-suave">{c.nome}:</dt>
              <dd className="truncate font-medium text-texto" title={c.texto}>
                {c.texto}
              </dd>
            </div>
          ))}
          {campos.length > 3 && (
            <div className="text-texto-fraco">+{campos.length - 3} no histórico</div>
          )}
        </dl>
      )}
      {/* ↩️ 21/10 (pedido do dono): o "Pedido ficou X em PCP" saiu do card do
          setor — para a produção trabalhar isso não importa. O tempo em PCP
          segue na janela do card (Tempo e histórico) e no próprio PCP. */}

      {/* O tempo, como a D-02 manda: fila é do setor, execução é da pessoa. */}
      {terminal ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-texto-suave tabular-nums">
          <Flag aria-hidden className="size-4 text-perfeito-forte" />
          {desdeUtil(card.desde)}
          <span className="sr-only">desde a chegada ao fim de linha</span>
        </p>
      ) : pausado ? (
        // SESSAO-22 (D-48): pausado é estado com ícone + texto, nunca só cor (M-12).
        <p
          className="inline-flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-medium text-atencao-texto tabular-nums"
          title={
            card.pausado_em
              ? `Pausado em ${new Date(card.pausado_em).toLocaleString('pt-BR')} — o tempo não conta enquanto pausado.`
              : undefined
          }
        >
          <Pause aria-hidden className="size-4" />
          {/* SESSAO-31 (§4): "Pausado · Falta de material · há 2 h". */}
          <span className="min-w-0 break-words">
            Pausado{motivo ? ` · ${motivo} ·` : ''} há{' '}
            {regua
              ? desdeUtil(card.pausado_em)
              : formatarDuracaoMs(agora - new Date(card.pausado_em ?? 0).getTime())}
          </span>
          <span className="inline-flex items-center gap-1 font-normal text-texto-suave">
            {/* SESSAO-36 (D-146): a foto do cadastro em todo ícone de pessoa. */}
            <AvatarPessoa
              nome={executorNome ?? null}
              foto={card.executor_atual_id ? pessoas?.get(card.executor_atual_id)?.foto : null}
              tamanho="xs"
            />
            {souExecutor ? 'você' : (executorNome ?? '…')}
          </span>
        </p>
      ) : emExecucao ? (
        <p
          className={cn(
            'inline-flex flex-wrap items-center gap-1.5 text-texto tabular-nums',
            galpao ? 'text-base' : 'text-sm',
          )}
          title={
            execucaoDesde
              ? `Em execução desde ${new Date(execucaoDesde).toLocaleString('pt-BR')}`
              : undefined
          }
        >
          <Play aria-hidden className="size-4 text-perfeito-forte" />
          <span className="font-medium">{formatarDuracao(execucaoDesde ?? card.desde, agora)}</span>
          <span className="inline-flex items-center gap-1 text-texto-suave">
            <AvatarPessoa
              nome={executorNome ?? null}
              foto={card.executor_atual_id ? pessoas?.get(card.executor_atual_id)?.foto : null}
              tamanho="xs"
            />
            {souExecutor ? 'você' : (executorNome ?? '…')}
          </span>
        </p>
      ) : parado ? (
        // SESSAO-31 (§4): solto no PARADO com o motivo — o tempo de execução fechou.
        <p
          className={cn(
            'inline-flex min-w-0 items-center gap-1.5 font-medium text-atencao-texto tabular-nums',
            galpao ? 'text-base' : 'text-sm',
          )}
          title={
            card.desde ? `Parado desde ${new Date(card.desde).toLocaleString('pt-BR')}` : undefined
          }
        >
          <Pause aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0 break-words">
            Parado · {motivo} · há{' '}
            {regua
              ? desdeUtil(card.desde)
              : formatarDuracaoMs(agora - new Date(card.desde ?? agora).getTime())}
          </span>
        </p>
      ) : (
        <p
          className={cn(
            'inline-flex items-center gap-1.5 tabular-nums',
            galpao ? 'text-base' : 'text-sm',
            esperandoHaMaisTempo ? 'font-medium text-atencao-texto' : 'text-texto-suave',
          )}
          title={
            card.desde
              ? `Esperando alguém pegar desde ${new Date(card.desde).toLocaleString('pt-BR')}${regua ? ' — conta só o horário de expediente do setor' : ''}`
              : undefined
          }
        >
          {esperandoHaMaisTempo ? (
            <Hourglass aria-hidden className="size-4" />
          ) : foraDoExpediente ? (
            <Moon aria-hidden className="size-4" />
          ) : (
            <Clock aria-hidden className="size-4" />
          )}
          {desdeUtil(card.desde)} na fila
          {esperandoHaMaisTempo && <span> · há mais tempo esperando</span>}
          {foraDoExpediente && !esperandoHaMaisTempo && (
            <span className="text-xs"> · fora do expediente</span>
          )}
        </p>
      )}

      {/* SESSAO-36 (D-146): quem está no card como AUXILIAR, com tempo próprio. */}
      {auxiliares.length > 0 && (
        <p className="inline-flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-texto-suave">
          <Handshake aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0 break-words">
            Com ajuda de {auxiliares.map((id) => pessoas?.get(id)?.nome ?? '…').join(', ')}
            {card.pausado_em !== null && ajudaAtiva ? ' — quem iniciou está pausado' : ''}
          </span>
        </p>
      )}

      {/* SESSAO-31 (D-126): o setor pede o estado na chegada — a confirmação
          vem antes do trabalho (o card já traz a pendência, projetada no banco). */}
      {!terminal && card.parecer_pendente_id != null && (
        <p className="flex flex-wrap items-center gap-1.5 rounded-dm bg-superficie-sutil px-2 py-1.5 text-xs text-texto">
          <ClipboardCheck aria-hidden className="size-4 shrink-0 text-texto-suave" />
          Recebimento a confirmar
          <span className="text-texto-suave">— você confirma ao pegar para trabalhar.</span>
        </p>
      )}

      {card.qualidade_atual && (
        <div>
          <BadgeEstado estado={card.qualidade_atual} tamanho="sm" />
        </div>
      )}

      {temRodape && (
        <footer className="mt-1 flex items-center gap-2">
          {aoLinhaTempo && (
            <Botao
              variante="fantasma"
              tamanho="sm"
              icone={<History />}
              className="min-h-toque-md shrink-0 px-2"
              aria-label="Linha do tempo do card"
              // Enter/Espaço no botão é do botão — não pode virar arrasto de teclado.
              onKeyDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                aoLinhaTempo(card)
              }}
            />
          )}
          {aoFotos && (
            <Botao
              variante="fantasma"
              tamanho="sm"
              icone={<Images />}
              className="min-h-toque-md shrink-0 px-2"
              aria-label="Fotos da peça"
              onKeyDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                aoFotos(card)
              }}
            />
          )}
          {podeAuxiliar && aoAuxiliar && (
            <Botao
              variante="secundaria"
              tamanho={galpao ? 'lg' : 'sm'}
              icone={<Handshake />}
              className="min-h-toque-md min-w-0 flex-1 px-2"
              disabled={gestoPendente}
              onKeyDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                aoAuxiliar(card)
              }}
            >
              Auxiliar
            </Botao>
          )}
          {!terminal && aoConcluir && (
            <Botao
              variante="secundaria"
              tamanho={galpao ? 'lg' : 'sm'}
              icone={<CircleCheckBig />}
              className="min-h-toque-md min-w-0 flex-1 px-2"
              disabled={gestoPendente}
              onKeyDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                aoConcluir(card)
              }}
            >
              Concluir
            </Botao>
          )}
        </footer>
      )}
    </article>
  )
}
