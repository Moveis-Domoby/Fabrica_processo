import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ClipboardCheck, Hourglass, Play, RotateCcw, Undo2 } from 'lucide-react'
import { BadgeEstado, Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { estornarEvento, linhaTempoCard } from '../api'
import { eventoEstornavel, montarSegmentos } from '../linha-tempo'
import { formatarDuracaoMs, useAgora } from '../tempo'
import type { Card, EventoLinhaTempo, PedidoResumo } from '../tipos'

export interface ModalLinhaTempoProps {
  card: Card | null
  pedido?: PedidoResumo
  aoFechar: () => void
}

const ROTULO_TIPO: Partial<Record<EventoLinhaTempo['tipo'], string>> = {
  card_criado: 'Card criado',
  movimentacao_setor: 'Movido de setor',
  movimentacao_etapa: 'Movido de etapa',
  execucao_iniciada: 'Execução iniciada',
  execucao_finalizada: 'Execução finalizada',
  qualidade_marcada: 'Qualidade marcada',
  qualidade_parecer: 'Parecer de qualidade',
  divergencia_registrada: 'Divergência registrada',
  notificacao_enviada: 'Liderança avisada',
  estorno: 'Estorno',
  // SESSAO-09 (D-31): o que o Tiny fez com o pedido também é história do card.
  pedido_atualizado: 'Pedido alterado no Tiny',
  pedido_cancelado: 'Pedido cancelado no Tiny',
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
 * A linha do tempo do card (SESSAO-05): cada etapa com fila, execução, total e
 * autores (D-02) — e a história crua embaixo, evento a evento, com estornados
 * riscados (histórico nunca some — RNF-05). O estorno é o gesto do líder do
 * setor ou do admin (D-24), sempre do último gesto para trás.
 */
export function ModalLinhaTempo({ card, pedido, aoFechar }: ModalLinhaTempoProps) {
  const { perfil, vinculos } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora(30_000)

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

  const segmentos = montarSegmentos(eventos, agora)
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
        clienteQuery.invalidateQueries({ queryKey: ['execucoes'] }),
      ])
    },
    onError: (excecao) =>
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.'),
  })

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
          ? `${card.item_descricao ?? 'Card'}${kn} · Pedido ${pedido?.numero ?? card.pedido_id}`
          : undefined
      }
      rodape={
        <Botao variante="secundaria" tamanho="lg" onClick={aoFechar}>
          Fechar
        </Botao>
      }
    >
      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
        {isPending && <p className="text-sm text-texto-fraco">Carregando a história do card…</p>}

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
                  {s.etapaNome && (
                    <span className="text-texto-suave"> · {s.etapaNome}</span>
                  )}
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
                      Recebimento{s.qualidade.recebedorNome ? ` de ${s.qualidade.recebedorNome}` : ''}:
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

              <dl className="mt-2 flex flex-col gap-1 text-sm tabular-nums">
                <div className="flex items-center gap-2">
                  <Hourglass aria-hidden className="size-4 shrink-0 text-texto-suave" />
                  <dt className="text-texto-suave">Fila (do setor):</dt>
                  <dd className="font-medium text-texto">{formatarDuracaoMs(s.filaMs)}</dd>
                </div>

                {s.execucoes.map((e) => (
                  <div key={e.inicioEventoId} className="flex flex-wrap items-center gap-2">
                    <Play aria-hidden className="size-4 shrink-0 text-perfeito-forte" />
                    <dt className="text-texto-suave">Execução de {e.autorInicio}:</dt>
                    <dd className="font-medium text-texto">{formatarDuracaoMs(e.duracaoMs)}</dd>
                    <dd className="text-xs text-texto-fraco">
                      {e.encerramento === null && '· em andamento'}
                      {e.encerramento === 'finalizada' &&
                        (e.autorFim && e.autorFim !== e.autorInicio
                          ? `· finalizada por ${e.autorFim}`
                          : '· finalizada')}
                      {e.encerramento === 'transferencia' && '· transferida (assumida por outra pessoa)'}
                      {e.encerramento === 'movimentacao' && '· encerrada ao mover o card'}
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
                  <dd className="font-semibold text-texto">{formatarDuracaoMs(s.totalMs)}</dd>
                </div>
              </dl>
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
                    {ROTULO_TIPO[estornavel.tipo]?.toLowerCase()} de{' '}
                    {estornavel.usuario_nome ?? '—'} ({hora(estornavel.ocorrido_em)})
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
                        {e.setor_origem_nome}
                        <ArrowRight aria-hidden className="size-3" />
                        {e.setor_destino_nome}
                        {e.etapa_destino_nome && ` (${e.etapa_destino_nome})`}
                      </span>
                    )}
                    {e.observacao && <span className="italic">“{e.observacao}”</span>}
                    {e.origem !== 'interface' && <span>[{e.origem}]</span>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
