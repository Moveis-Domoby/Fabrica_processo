import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Boxes, PackageCheck, Replace, Store, Truck, Undo2, Wrench } from 'lucide-react'
import { BadgeEstado, Botao, Campo, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { buscarSetores } from '@/kanban/api'
import {
  decidirDevolucao,
  detalheDevolucao,
  opcoesRealocar,
  ROTULO_DECISAO,
  ROTULO_DESTINO_FINAL,
} from '../devolucao'
import type { DecisaoDevolucao, DestinoFinalAjuste } from '../devolucao'

const ICONE_DECISAO: Record<DecisaoDevolucao, React.ReactNode> = {
  reenviar: <Truck aria-hidden className="size-5" />,
  estoque: <Boxes aria-hidden className="size-5" />,
  realocar: <Replace aria-hidden className="size-5" />,
  danificados: <Ban aria-hidden className="size-5" />,
  loja: <Store aria-hidden className="size-5" />,
  ajuste: <Wrench aria-hidden className="size-5" />,
}

const EXPLICA_DECISAO: Record<DecisaoDevolucao, string> = {
  reenviar:
    'A peça volta para Pedidos em aguardo. Com o pedido todo pronto, ele volta sozinho para as ROTAS → Programar. Pedido já entregue: a entrega reabre só aqui (o Tiny não muda).',
  estoque:
    'A peça fica livre no ESTOQUE da fábrica, sem dono. O pedido passa a precisar dela de novo.',
  realocar:
    'A peça vira a unidade de outro pedido vivo do mesmo produto, pronta em Pedidos em aguardo.',
  danificados: 'A peça vai para os Danificados — de lá a logística resolve ou arquiva.',
  loja: 'A peça sai das contas da fábrica e fica registrado que foi para a loja.',
  ajuste:
    'A peça volta para um setor de produção para ajustar. Ao terminar (soltar na EXPEDIÇÃO), ela vai para o destino final escolhido.',
}

const ROTULO_HISTORICO: Record<string, string> = {
  pedido_lancado_rotas: 'Lançado para ROTAS',
  entrega_nao_realizada: 'Não entregue',
  pedido_entregue: 'Entregue',
  entrega_desfeita: 'Entrega desfeita',
  comentario_adicionado: 'Comentário',
  pedido_devolvido: 'Devolvido',
}

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * A telinha "Decidir situação" (SESSAO-31 — D-129, pedido do dono): "a
 * logística apenas receba o mini relatório com o motivo … e decida o que
 * fazer". Abre por cima (do sino, do Estoque ou do PCP), lê tudo numa
 * requisição só ao abrir e esquece ao fechar (D-89). Decide peça por peça ou
 * várias juntas; a regra é do banco (idempotente).
 */
export function ModalDecidirDevolucao({
  cardId,
  aoFechar,
}: {
  /** O card do PEDIDO devolvido; nulo = fechado. */
  cardId: number | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [escolhidas, setEscolhidas] = useState<number[] | null>(null)
  const [decisao, setDecisao] = useState<DecisaoDevolucao | null>(null)
  const [observacao, setObservacao] = useState('')
  const [setorAjuste, setSetorAjuste] = useState('')
  const [destinoFinal, setDestinoFinal] = useState<DestinoFinalAjuste | ''>('')
  const [descricaoAjuste, setDescricaoAjuste] = useState('')
  const [vaga, setVaga] = useState<string>('')

  const { data, isPending, error } = useQuery({
    queryKey: ['devolucao', cardId],
    queryFn: () => detalheDevolucao(cardId!),
    enabled: cardId !== null,
    // D-89: busca ao abrir e esquece ao fechar.
    gcTime: 0,
    staleTime: 0,
  })
  const pecas = (data?.pecas ?? []).filter((p) => p.em_decisao)
  const marcadas = escolhidas ?? pecas.map((p) => p.id)

  const { data: setores = [] } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
    enabled: cardId !== null && decisao === 'ajuste',
    staleTime: 10 * 60_000,
  })
  const setoresProducao = setores.filter((s) => s.papel_no_fluxo === 'producao')

  const pecaRealocar = decisao === 'realocar' && marcadas.length === 1 ? marcadas[0] : null
  const { data: opcoes = [], isFetching: buscandoOpcoes } = useQuery({
    queryKey: ['devolucao', 'realocar', pecaRealocar],
    queryFn: () => opcoesRealocar(pecaRealocar!),
    enabled: pecaRealocar !== null,
    gcTime: 0,
  })

  const aplicar = useMutation({
    mutationFn: () => {
      const escolhaVaga = opcoes.find(
        (o) => `${o.card_pedido_id}:${o.item_seq}:${o.indice_unidade}` === vaga,
      )
      return decidirDevolucao({
        pecas: marcadas,
        decisao: decisao!,
        observacao,
        destino:
          decisao === 'realocar' && escolhaVaga
            ? {
                card_pedido_id: escolhaVaga.card_pedido_id,
                item_seq: escolhaVaga.item_seq,
                indice_unidade: escolhaVaga.indice_unidade,
              }
            : decisao === 'ajuste'
              ? {
                  setor_id: Number(setorAjuste),
                  destino_final: destinoFinal,
                  descricao: descricaoAjuste,
                }
              : {},
      })
    },
    onSuccess: async (resultado) => {
      notificar({
        titulo: `${ROTULO_DECISAO[decisao!]}: ${resultado.decididas + resultado.repetidas} peça(s)`,
        descricao:
          resultado.relancados.length > 0
            ? 'O pedido voltou para as ROTAS → Programar.'
            : resultado.reabertos.length > 0
              ? 'A entrega foi reaberta só na plataforma — o Tiny não muda.'
              : undefined,
        tom: 'perfeito',
      })
      setEscolhidas(null)
      setDecisao(null)
      setObservacao('')
      setVaga('')
      await Promise.all(
        [
          ['devolucao'],
          ['devolucoes'],
          ['estoque'],
          ['pedidos-lista'],
          ['pedido-ficha'],
          ['rotas'],
          ['programacao'],
          ['pedidos-aguardo'],
          ['aguardo-contagens'],
          ['danificados'],
          ['cards'],
        ].map((queryKey) => clienteQuery.invalidateQueries({ queryKey })),
      )
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para aplicar a decisão',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })

  const pronto =
    decisao !== null &&
    marcadas.length > 0 &&
    (decisao !== 'realocar' || (marcadas.length === 1 && vaga !== '')) &&
    (decisao !== 'ajuste' || (setorAjuste !== '' && destinoFinal !== ''))

  function alternar(id: number) {
    const base = marcadas
    setEscolhidas(base.includes(id) ? base.filter((x) => x !== id) : [...base, id])
  }

  return (
    <Modal
      aberto={cardId !== null}
      aoFechar={(v) => !v && aoFechar()}
      tamanho="galpao"
      titulo={data ? `Decidir situação — pedido ${data.numero}` : 'Decidir situação'}
      descricao={data?.cliente?.nome ?? undefined}
    >
      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {error && (
        <p className="text-sm text-danificado-forte" role="alert">
          {error instanceof Error ? error.message : 'Não deu para abrir a devolução.'}
        </p>
      )}
      {data && (
        <div className="flex flex-col gap-4">
          {/* O mini relatório (D-129): quem, quando, por quê e o histórico da entrega. */}
          <section className="flex flex-col gap-2 rounded-dm border border-borda bg-superficie-sutil p-3 text-sm">
            {data.devolucao ? (
              <p className="text-texto">
                <strong>{data.devolucao.quem ?? 'Alguém'}</strong> marcou devolvido em{' '}
                {quando(data.devolucao.quando)} —{' '}
                <strong>{data.devolucao.motivo ?? 'sem motivo'}</strong>
                {data.devolucao.observacao ? `: ${data.devolucao.observacao}` : ''}.
              </p>
            ) : (
              <p className="text-texto-suave">Este pedido não tem devolução.</p>
            )}
            <p className="flex flex-wrap gap-2">
              {data.devolucao?.entregue && (
                <span className="inline-flex items-center gap-1 rounded-full bg-info-fundo px-2 py-0.5 text-xs font-medium text-info-texto">
                  <PackageCheck aria-hidden className="size-3.5" />
                  Já tinha sido entregue
                </span>
              )}
              {data.cancelado && (
                <span className="inline-flex items-center gap-1 rounded-full bg-danificado-fundo px-2 py-0.5 text-xs font-medium text-danificado-texto">
                  <Ban aria-hidden className="size-3.5" />
                  Cancelado no Tiny
                </span>
              )}
              {data.comprovantes > 0 && (
                <span className="rounded-full bg-superficie px-2 py-0.5 text-xs text-texto-suave">
                  {data.comprovantes} {data.comprovantes === 1 ? 'comprovante' : 'comprovantes'}
                </span>
              )}
            </p>
            {data.historico.length > 0 && (
              <ul className="flex flex-col gap-0.5 text-xs text-texto-suave">
                {data.historico.slice(0, 6).map((h, i) => (
                  <li key={`${h.tipo}-${i}`}>
                    <span className="tabular-nums">{quando(h.quando)}</span> ·{' '}
                    {ROTULO_HISTORICO[h.tipo] ?? 'Registro'}
                    {h.quem ? ` · ${h.quem}` : ''}
                    {h.texto ? ` — ${h.texto}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!data.em_decisao || pecas.length === 0 ? (
            <p className="rounded-dm border border-perfeito-borda bg-perfeito-fundo p-3 text-sm text-perfeito-texto">
              Nada esperando decisão neste pedido.
            </p>
          ) : (
            <>
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 text-sm font-medium text-texto">
                  Peças em decisão ({marcadas.length} de {pecas.length} marcadas)
                </legend>
                {pecas.map((p) => (
                  <label
                    key={p.id}
                    className="flex min-h-toque-md cursor-pointer flex-wrap items-center gap-2 rounded-dm px-1 text-sm text-texto hover:bg-superficie-sutil"
                  >
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--dm-acao)]"
                      checked={marcadas.includes(p.id)}
                      onChange={() => alternar(p.id)}
                    />
                    <span className="min-w-0 flex-1">
                      {p.descricao ?? 'Peça'}
                      {p.indice !== null ? ` (${p.indice}/${p.total})` : ''}
                      {p.sku ? <span className="text-texto-suave"> · SKU {p.sku}</span> : null}
                    </span>
                    {p.qualidade && p.qualidade !== 'perfeito' && (
                      <BadgeEstado estado={p.qualidade} tamanho="sm" />
                    )}
                  </label>
                ))}
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-texto">O que fazer</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(Object.keys(ROTULO_DECISAO) as DecisaoDevolucao[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={decisao === d}
                      onClick={() => setDecisao(d)}
                      className={cn(
                        'toque-seguro flex min-h-toque-lg items-center gap-2 rounded-dm border-2 px-3 py-2 text-left text-sm transition-colors',
                        decisao === d
                          ? 'border-acao-ativa bg-superficie-sutil font-medium text-texto'
                          : 'border-borda bg-superficie text-texto hover:border-borda-forte',
                      )}
                    >
                      {ICONE_DECISAO[d]}
                      {ROTULO_DECISAO[d]}
                    </button>
                  ))}
                </div>
                {decisao && <p className="text-xs text-texto-suave">{EXPLICA_DECISAO[decisao]}</p>}
              </fieldset>

              {decisao === 'realocar' && (
                <div className="flex flex-col gap-2">
                  {marcadas.length !== 1 ? (
                    <p className="text-sm text-atencao-texto">
                      Marque uma peça só — cada uma vai para uma vaga.
                    </p>
                  ) : buscandoOpcoes ? (
                    <p className="text-sm text-texto-fraco">Buscando pedidos com vaga…</p>
                  ) : opcoes.length === 0 ? (
                    <p className="text-sm text-texto-suave">
                      Nenhum pedido no PCP precisando desta peça agora.
                    </p>
                  ) : (
                    <Selecao
                      rotulo="Para qual pedido"
                      opcoes={opcoes.map((o) => ({
                        valor: `${o.card_pedido_id}:${o.item_seq}:${o.indice_unidade}`,
                        rotulo: `Pedido ${o.numero} · ${o.cliente_nome || 'sem cliente'}${o.data_prevista ? ` · previsto ${new Date(`${o.data_prevista}T12:00:00`).toLocaleDateString('pt-BR')}` : ''}`,
                      }))}
                      valor={vaga}
                      aoMudar={setVaga}
                    />
                  )}
                </div>
              )}

              {decisao === 'ajuste' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Selecao
                    rotulo="Vai para o setor"
                    opcoes={setoresProducao.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
                    valor={setorAjuste}
                    aoMudar={setSetorAjuste}
                  />
                  <Selecao
                    rotulo="Destino final (ao terminar)"
                    opcoes={(Object.keys(ROTULO_DESTINO_FINAL) as DestinoFinalAjuste[]).map(
                      (d) => ({
                        valor: d,
                        rotulo: ROTULO_DESTINO_FINAL[d],
                      }),
                    )}
                    valor={destinoFinal}
                    aoMudar={(v) => setDestinoFinal(v as DestinoFinalAjuste)}
                  />
                  <div className="sm:col-span-2">
                    <Campo
                      rotulo="O que ajustar (opcional)"
                      placeholder="Ex.: lixar e pintar a porta"
                      value={descricaoAjuste}
                      onChange={(e) => setDescricaoAjuste(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {decisao && (
                <Campo
                  rotulo="Observação (opcional)"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Botao variante="secundaria" icone={<Undo2 />} onClick={aoFechar}>
                  Fechar
                </Botao>
                <Botao
                  disabled={!pronto}
                  carregando={aplicar.isPending}
                  onClick={() => aplicar.mutate()}
                >
                  Aplicar a decisão
                </Botao>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
