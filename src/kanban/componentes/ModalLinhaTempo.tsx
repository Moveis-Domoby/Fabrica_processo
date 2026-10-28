import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  CirclePause,
  ClipboardCheck,
  Clock,
  Hourglass,
  Play,
  RotateCcw,
  Undo2,
} from 'lucide-react'
import { BadgeEstado, Botao, Campo, Dica, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { estornarEvento, linhaTempoCard } from '../api'
import { eventoEstornavel, montarSegmentos } from '../linha-tempo'
import { formatarDuracaoMs, useAgora } from '../tempo'
import { formatarTempoUtil } from '../tempoUtil'
import type { TempoDoPedidoNoPcp } from '../tempoUtil'
import { useReguaTempo } from '../useReguaTempo'
import type { Card, EventoLinhaTempo, PedidoDoCard } from '../tipos'
import { rotuloOrigemCard } from '../rotulos'
import { ORIGEM } from '@/auditoria/rotulos'
import { CamposDoCard } from '@/utilitarios/CamposDoCard'
import { nomeDoLugar } from '@/logistica/lugar'

export interface ModalLinhaTempoProps {
  card: Card | null
  pedido?: PedidoDoCard
  aoFechar: () => void
}

const ROTULO_TIPO: Partial<Record<EventoLinhaTempo['tipo'], string>> = {
  card_criado: 'Card criado',
  movimentacao_setor: 'Movido de setor',
  movimentacao_etapa: 'Movido de etapa',
  execucao_iniciada: 'Execução iniciada',
  execucao_finalizada: 'Execução finalizada',
  // SESSAO-22 (D-48): a pausa do líder e a retomada também são história.
  execucao_pausada: 'Execução pausada',
  execucao_retomada: 'Execução retomada',
  qualidade_marcada: 'Qualidade marcada',
  qualidade_parecer: 'Parecer de qualidade',
  divergencia_registrada: 'Divergência registrada',
  notificacao_enviada: 'Liderança avisada',
  estorno: 'Estorno',
  // SESSAO-09 (D-31): o que o Tiny fez com o pedido também é história do card.
  pedido_atualizado: 'Pedido alterado no Tiny',
  pedido_cancelado: 'Pedido cancelado no Tiny',
  card_arquivado: 'Card arquivado',
  pedido_entregue: 'Pedido entregue',
  pedido_lancado_rotas: 'Lançado para ROTAS',
  delegacao: 'Delegado',
  // SESSAO-24: a peça que perdeu o pedido e a peça do estoque usada por um pedido.
  unidade_desvinculada: 'Ficou sem dono (pedido cancelado)',
  peca_alocada: 'Usada por um pedido',
  // D-201: a peça sem dono em produção passou a ser de um pedido (pelo PCP).
  peca_vinculada: 'Passou a ser de um pedido',
  // SESSAO-27: etiquetas (as automações põem e tiram) e o "trazer de volta".
  etiqueta_adicionada: 'Etiqueta posta',
  etiqueta_removida: 'Etiqueta tirada',
  card_desarquivado: 'Trazido de volta',
  // SESSAO-30/31: entrega, devolução, ajuste e as propriedades do card.
  entrega_desfeita: 'Entrega desfeita',
  entrega_nao_realizada: 'Não entregue',
  pedido_devolvido: 'Pedido devolvido',
  devolucao_decidida: 'Devolução decidida',
  ajuste_aberto: 'Mandada para ajuste',
  ajuste_concluido: 'Ajuste concluído',
  avulso_concluido: 'Card concluído',
  card_editado: 'Card editado',
  responsavel_adicionado: 'Responsável posto',
  responsavel_removido: 'Responsável tirado',
  anexo_adicionado: 'Anexo posto',
  anexo_removido: 'Anexo tirado',
  // SESSAO-38 (D-150/D-152): a prioridade e o responsável de um setor.
  prioridade_definida: 'Prioridade mudada',
  responsavel_setor_definido: 'Responsável do setor definido',
  // SESSAO-38 (D-169): o stand-by do pedido no PCP.
  pedido_standby_entrou: 'Pedido em stand-by',
  pedido_standby_saiu: 'Pedido saiu do stand-by',
  // SESSAO-36 (D-146): o auxílio.
  auxilio_iniciado: 'Ajuda iniciada',
  auxilio_pausado: 'Ajuda pausada',
  auxilio_retomado: 'Ajuda retomada',
  auxilio_encerrado: 'Ajuda encerrada',
}

function hora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * A linha do tempo do card como janela própria (o histórico de sempre). ↪️
 * SESSAO-31: o conteúdo é o <HistoricoDoCard>, que também mora dentro da
 * janela do card.
 */
export function ModalLinhaTempo({ card, pedido, aoFechar }: ModalLinhaTempoProps) {
  const kn =
    card && card.indice_unidade !== null ? ` (${card.indice_unidade}/${card.total_unidades})` : ''
  return (
    <Modal
      aberto={card !== null}
      aoFechar={(aberto) => {
        if (!aberto) aoFechar()
      }}
      titulo="Linha do tempo"
      descricao={
        card
          ? `${card.tipo === 'avulso' ? (card.titulo ?? 'Card avulso') : (card.item_descricao ?? 'Card')}${kn} · ${rotuloOrigemCard(card, pedido)}`
          : undefined
      }
      rodape={
        <Botao variante="secundaria" tamanho="lg" onClick={aoFechar}>
          Fechar
        </Botao>
      }
    >
      <HistoricoDoCard card={card} pedido={pedido} />
    </Modal>
  )
}

/**
 * A linha do tempo do card (SESSAO-05): cada etapa com fila, execução, total e
 * autores (D-02) — e a história crua embaixo, evento a evento, com estornados
 * riscados (histórico nunca some — RNF-05). O estorno é o gesto do líder do
 * setor ou do admin (D-24), sempre do último gesto para trás. Busca só quando
 * aparece (na janela do card, no clique — Lei §3).
 */
export function HistoricoDoCard({
  card,
  pedido,
  comCampos = true,
  alturaLimitada = true,
}: {
  card: Card | null
  /** O pedido do card — basta o que o relógio do PCP precisa (SESSAO-38 · F5). */
  pedido?: (Partial<PedidoDoCard> & TempoDoPedidoNoPcp) | null
  /** Os campos customizados no topo (a janela do card mostra os dela). */
  comCampos?: boolean
  alturaLimitada?: boolean
}) {
  const { perfil, vinculos } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora(30_000)
  const regua = useReguaTempo()
  // SESSAO-38 (F5): com a régua, o tempo útil em horas; sem ela, o de sempre.
  const ver = (ms: number) => (regua ? formatarTempoUtil(ms) : formatarDuracaoMs(ms))

  const [mostrarEventos, setMostrarEventos] = useState(false)
  const [estornando, setEstornando] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')

  // Reinicia o estado a cada card novo (ajuste durante o render, sem effect).
  const [cardAnterior, setCardAnterior] = useState<number | null>(null)
  if ((card?.id ?? null) !== cardAnterior) {
    setCardAnterior(card?.id ?? null)
    setMostrarEventos(false)
    setEstornando(false)
    setObservacao('')
    setErro('')
  }

  const { data: eventos = [], isPending } = useQuery({
    queryKey: ['linha-tempo', card?.id ?? 0],
    queryFn: () => linhaTempoCard(card!.id),
    enabled: card !== null,
  })

  const segmentos = montarSegmentos(eventos, agora, { regua, pedido: pedido ?? null })
  const estornavel = eventoEstornavel(eventos)
  const podeEstornar =
    perfil?.papel === 'admin' ||
    vinculos.some((v) => v.lider_do_setor && v.setor_id === card?.setor_atual_id)

  const estornoMutacao = useMutation({
    mutationFn: estornarEvento,
    onSuccess: async () => {
      notificar({
        titulo: 'Gesto estornado',
        // RNF-05 (append-only) — código fora da tela (D-27).
        descricao: 'O evento original continua na história, riscado — nada se apaga.',
        tom: 'perfeito',
      })
      setEstornando(false)
      setObservacao('')
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['linha-tempo'] }),
        clienteQuery.invalidateQueries({ queryKey: ['cards'] }),
        clienteQuery.invalidateQueries({ queryKey: ['quadro'] }),
        clienteQuery.invalidateQueries({ queryKey: ['execucoes'] }),
      ])
    },
    onError: (excecao) =>
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.'),
  })

  return (
    <div
      className={cn('flex flex-col gap-4', alturaLimitada && 'max-h-[60vh] overflow-y-auto pr-1')}
    >
      {isPending && <p className="text-sm text-texto-fraco">Carregando a história do card…</p>}

      {/* D-48 (SESSAO-22): o tempo em PCP é do PEDIDO — e, desde a SESSAO-38
          (F5), aparece no próprio bloco do PCP como "Tempo útil em PCP" (o
          PCP não tem fila). O balão explica a régua do tempo útil. */}
      {regua && segmentos.length > 0 && (
        <p className="relative flex items-center gap-1 text-xs text-texto-suave">
          Tempos úteis: só o horário de expediente de cada setor
          <Dica rotulo="Como o tempo é contado">
            <span className="flex flex-col gap-2">
              <span>
                Fora do horário de expediente do setor o tempo não anda — nem na fila. Quem trabalha
                fora do horário (hora extra) conta.
              </span>
              <span>O tempo em stand-by não conta.</span>
            </span>
          </Dica>
        </p>
      )}

      {/* SESSAO-27 (D-101): os campos customizados — o admin preenche aqui. */}
      {card && comCampos && <CamposDoCard card={card} podeEditar={perfil?.papel === 'admin'} />}

      {!isPending && segmentos.length === 0 && (
        <p className="text-sm text-texto-suave">Este card ainda não tem movimentação.</p>
      )}

      {/* ------- O resumo que a demanda pede: etapa a etapa ------- */}
      <ol className="flex flex-col gap-3">
        {segmentos.map((s) => (
          <li
            key={s.eventoEntradaId}
            className="rounded-dm border border-borda bg-superficie-sutil p-3"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-texto">
                {s.setorNome}
                {s.etapaNome && <span className="text-texto-suave"> · {s.etapaNome}</span>}
                {s.ehFila && (
                  <span className="ml-2 rounded-full bg-info-fundo px-2 py-0.5 text-xs font-medium text-info-texto">
                    fila
                  </span>
                )}
              </span>
              <span className="text-xs text-texto-fraco tabular-nums">
                {hora(new Date(s.entrouEm).toISOString())}
                {s.saiuEm === null ? ' → agora' : ` → ${hora(new Date(s.saiuEm).toISOString())}`}
              </span>
            </header>

            {/* SESSAO-06 (D-09): a dupla atestação desta chegada. */}
            {s.qualidade && (
              <div className="mt-2 flex flex-col gap-1 rounded-dm bg-superficie px-2 py-1.5 text-xs">
                <span className="flex flex-wrap items-center gap-1.5 text-texto">
                  <ClipboardCheck aria-hidden className="size-4 shrink-0 text-texto-suave" />
                  Entrega de {s.qualidade.setorRemetenteNome ?? 'setor anterior'}
                  {s.qualidade.remetenteNome ? ` (${s.qualidade.remetenteNome})` : ''}:
                  <BadgeEstado estado={s.qualidade.estadoRemetente} tamanho="sm" />
                </span>
                {s.qualidade.estadoRecebedor ? (
                  <span className="flex flex-wrap items-center gap-1.5 text-texto">
                    <span className="w-4 shrink-0" aria-hidden />
                    Recebimento
                    {s.qualidade.recebedorNome ? ` de ${s.qualidade.recebedorNome}` : ''}:
                    <BadgeEstado estado={s.qualidade.estadoRecebedor} tamanho="sm" />
                    {s.qualidade.divergente && (
                      <span className="rounded-full bg-atencao-fundo px-2 py-0.5 font-medium text-atencao-texto">
                        divergência — liderança avisada
                      </span>
                    )}
                    {s.qualidade.observacaoRecebedor && (
                      <span className="italic text-texto-suave">
                        “{s.qualidade.observacaoRecebedor}”
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="pl-5 text-texto-fraco">
                    Recebimento ainda sem parecer — exigido antes do primeiro Iniciar.
                  </span>
                )}
              </div>
            )}

            {s.papel === 'entrada' || s.papel === 'terminal' ? (
              // SESSAO-38 (F5 · pedido do dono): o PCP — e os fins de linha — não
              // têm fila: ninguém "inicia" ali. Só o tempo útil.
              <dl className="mt-2 flex flex-col gap-1 text-sm tabular-nums">
                <div className="flex flex-wrap items-center gap-2">
                  <Clock aria-hidden className="size-4 shrink-0 text-texto-suave" />
                  <dt className="text-texto-suave">Tempo útil em {s.setorNome}:</dt>
                  <dd className="font-semibold text-texto">
                    {ver(s.papel === 'entrada' ? (s.pcpUtilMs ?? s.totalUtilMs) : s.totalUtilMs)}
                  </dd>
                </div>
                {s.papel === 'entrada' && s.pcpUtilMs !== null && pedido?.entrou_pcp_em && (
                  <p className="text-xs text-texto-fraco">
                    {pedido.liberado_completo_em
                      ? 'Do pedido: da entrada no PCP à liberação da última unidade.'
                      : 'Do pedido: ainda contando — há unidade por liberar.'}
                  </p>
                )}
                {(s.standbyMs > 0 || (s.papel === 'entrada' && pedido?.standby_desde)) && (
                  <p className="inline-flex items-center gap-1 text-xs text-atencao-texto">
                    <CirclePause aria-hidden className="size-3.5 shrink-0" />
                    {pedido?.standby_desde
                      ? 'Em stand-by agora — o tempo está parado.'
                      : `${ver(s.standbyMs)} em stand-by, fora da conta.`}
                  </p>
                )}
              </dl>
            ) : (
              <dl className="mt-2 flex flex-col gap-1 text-sm tabular-nums">
                <div className="flex items-center gap-2">
                  <Hourglass aria-hidden className="size-4 shrink-0 text-texto-suave" />
                  <dt className="text-texto-suave">Fila (do setor):</dt>
                  <dd className="font-medium text-texto">{ver(s.filaUtilMs)}</dd>
                </div>

                {s.execucoes.map((e) => (
                  <div key={e.inicioEventoId} className="flex flex-wrap items-center gap-2">
                    <Play aria-hidden className="size-4 shrink-0 text-perfeito-forte" />
                    <dt className="text-texto-suave">Execução de {e.autorInicio}:</dt>
                    <dd className="font-medium text-texto">{ver(e.duracaoMs)}</dd>
                    <dd className="text-xs text-texto-fraco">
                      {e.encerramento === null && !e.pausada && '· em andamento'}
                      {/* D-48: pausado não conta — o desconto já está na duração. */}
                      {e.pausada && '· pausada agora (o tempo não conta)'}
                      {e.encerramento === 'finalizada' &&
                        (e.autorFim && e.autorFim !== e.autorInicio
                          ? `· finalizada por ${e.autorFim}`
                          : '· finalizada')}
                      {e.encerramento === 'transferencia' &&
                        '· transferida (assumida por outra pessoa)'}
                      {e.encerramento === 'movimentacao' && '· encerrada ao mover o card'}
                      {e.pausaMs > 0 && ` · ${ver(e.pausaMs)} de pausa descontados`}
                    </dd>
                  </div>
                ))}
                {s.execucoes.length === 0 && (
                  <p className="text-xs text-texto-fraco">
                    Ninguém iniciou aqui — o tempo foi todo de fila.
                  </p>
                )}

                <div className="mt-1 flex items-center gap-2 border-t border-borda pt-1">
                  <dt className="text-texto-suave">Total na etapa:</dt>
                  <dd className="font-semibold text-texto">{ver(s.totalUtilMs)}</dd>
                </div>
              </dl>
            )}
          </li>
        ))}
      </ol>

      {/* ------- Estorno (líder do setor / admin — D-24) ------- */}
      {podeEstornar && estornavel && (
        <div className="rounded-dm border border-borda bg-superficie p-3">
          {!estornando ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-texto-suave">
                Gesto errado? O estorno anula{' '}
                <strong className="text-texto">
                  {ROTULO_TIPO[estornavel.tipo]?.toLowerCase()} de {estornavel.usuario_nome ?? '—'}{' '}
                  ({hora(estornavel.ocorrido_em)})
                </strong>{' '}
                com um evento novo — nada se apaga.
              </p>
              <Botao
                variante="secundaria"
                tamanho="sm"
                icone={<Undo2 />}
                className="min-h-toque-md"
                onClick={() => {
                  setEstornando(true)
                  setErro('')
                }}
              >
                Estornar
              </Botao>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Campo
                rotulo={`Estornar: ${ROTULO_TIPO[estornavel.tipo]} de ${estornavel.usuario_nome ?? '—'}`}
                ajuda="Opcional: por que está estornando (fica na história do card)."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                erro={erro || undefined}
              />
              <div className="flex justify-end gap-2">
                <Botao variante="secundaria" tamanho="sm" onClick={() => setEstornando(false)}>
                  Cancelar
                </Botao>
                <Botao
                  tamanho="sm"
                  icone={<Undo2 />}
                  carregando={estornoMutacao.isPending}
                  onClick={() =>
                    estornoMutacao.mutate({ eventoId: estornavel.evento_id, observacao })
                  }
                >
                  Confirmar estorno
                </Botao>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------- A história crua, evento a evento ------- */}
      {eventos.length > 0 && (
        <div>
          <Botao
            variante="fantasma"
            tamanho="sm"
            icone={<RotateCcw />}
            onClick={() => setMostrarEventos(!mostrarEventos)}
          >
            {mostrarEventos ? 'Esconder eventos' : `Todos os eventos (${eventos.length})`}
          </Botao>
          {mostrarEventos && (
            <ol className="mt-2 flex flex-col gap-1">
              {eventos.map((e) => (
                <li
                  key={e.evento_id}
                  className={cn(
                    'flex flex-wrap items-center gap-x-2 rounded-dm px-2 py-1 text-xs',
                    e.estornado ? 'text-texto-fraco line-through' : 'text-texto-suave',
                    e.tipo === 'estorno' && 'bg-atencao-fundo text-atencao-texto',
                  )}
                >
                  <span className="tabular-nums">{hora(e.ocorrido_em)}</span>
                  <span className="font-medium">{ROTULO_TIPO[e.tipo] ?? e.tipo}</span>
                  {e.usuario_nome && <span>· {e.usuario_nome}</span>}
                  {e.estado_qualidade && <BadgeEstado estado={e.estado_qualidade} tamanho="sm" />}
                  {e.tipo.startsWith('movimentacao') && (
                    <span className="inline-flex items-center gap-1">
                      {nomeDoLugar(e.setor_origem_nome)}
                      <ArrowRight aria-hidden className="size-3" />
                      {nomeDoLugar(e.setor_destino_nome)}
                      {e.etapa_destino_nome && ` (${e.etapa_destino_nome})`}
                    </span>
                  )}
                  {(e.tipo === 'etiqueta_adicionada' || e.tipo === 'etiqueta_removida') &&
                    typeof e.dados?.etiqueta === 'string' && <span>“{e.dados.etiqueta}”</span>}
                  {e.observacao && <span className="italic">“{e.observacao}”</span>}
                  {/* SESSAO-27: a origem em língua de gente ("Automático", "Pela integração"). */}
                  {e.origem !== 'interface' && <span>· {ORIGEM[e.origem] ?? e.origem}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
