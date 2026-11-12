import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Boxes, CircleCheck, Replace, Undo2, UserRound } from 'lucide-react'
import { BadgeEstado, Botao, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import {
  decidirDestino,
  detalheDestino,
  distribuirOutroPedido,
  EXPLICA_DESTINO,
  nomeDaPeca,
  ROTULO_DESTINO,
  textoDaDecisao,
  vagasQueSobram,
} from '../destino'
import type { DestinoMovel, PecaEsperandoDestino, PedidoCandidato } from '../destino'

const OPCOES: DestinoMovel[] = ['estoque', 'outro_pedido', 'cancelar']

const ICONE: Record<DestinoMovel, React.ReactNode> = {
  estoque: <Boxes aria-hidden className="size-5 shrink-0" />,
  outro_pedido: <Replace aria-hidden className="size-5 shrink-0" />,
  cancelar: <Ban aria-hidden className="size-5 shrink-0" />,
}

interface Escolha {
  destino: DestinoMovel
  pedidoId?: number
}

/** As telas que mostram o que a decisão muda (relidas depois de aplicar). */
const RELER: string[][] = [
  ['destino'],
  ['estoque'],
  ['cards'],
  ['quadro'],
  ['pcp'],
  ['liberacao'],
  ['pedidos-lista'],
  ['pedido-ficha'],
]

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function dia(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** Por que "Passar para outro pedido" não serve para esta peça (nulo = serve). */
function porQueNaoOutroPedido(peca: PecaEsperandoDestino, candidatos: PedidoCandidato[]): string | null {
  if (peca.danificada) return 'Peça danificada não vai para outro pedido.'
  if (candidatos.length === 0) return 'Nenhum pedido no PCP precisa deste móvel agora.'
  return null
}

/**
 * A janela "Para onde vai este móvel?" (SESSAO-48, frente 3 — pedido do dono:
 * "Quando for um PEDIDO, pergunta para onde vai mover aquele móvel que seria do
 * pedido que foi cancelado"). O molde é a "Decidir situação" da devolução
 * (D-129): abre pelo sino (no Estoque, `?destino=<card do pedido>`), lê tudo numa
 * requisição só ao abrir e esquece ao fechar (D-89); decide peça por peça ou
 * todas de uma vez. A regra é do banco (idempotente) — a tela só não deixa
 * escolher o que o banco recusaria.
 */
export function ModalDestinoPedidoCancelado({
  cardId,
  aoFechar,
}: {
  /** O card do PEDIDO cancelado (ou de uma peça dele); nulo = fechada. */
  cardId: number | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [escolhas, setEscolhas] = useState<Record<number, Escolha>>({})

  const { data, isPending, error } = useQuery({
    queryKey: ['destino', cardId],
    queryFn: () => detalheDestino(cardId!),
    enabled: cardId !== null,
    // D-89: busca ao abrir e esquece ao fechar.
    gcTime: 0,
    staleTime: 0,
  })
  const pecas = data?.pecas ?? []
  const candidatos = data?.candidatos ?? {}
  const listaDe = (p: PecaEsperandoDestino) => candidatos[p.chave] ?? []
  const decisoes = pecas
    .filter((p) => escolhas[p.id] !== undefined)
    .map((p) => ({ pecaId: p.id, ...escolhas[p.id] }))
  const incompleta = decisoes.some((d) => d.destino === 'outro_pedido' && d.pedidoId === undefined)
  const distribuicao = distribuirOutroPedido(pecas, candidatos)

  const aplicar = useMutation({
    mutationFn: () => decidirDestino(data!.card_id, decisoes),
    onSuccess: async (resultado) => {
      const nomes = new Map(pecas.map((p) => [p.id, nomeDaPeca(p)]))
      const frases = resultado.feitas.map((f) => {
        const nome = nomes.get(f.peca_id) ?? 'Móvel'
        if (f.destino === 'outro_pedido') return `${nome} passou para o pedido ${f.numero_destino}`
        if (f.destino === 'cancelar') return `${nome} foi para a coluna ${f.coluna ?? 'CANCELADO'}`
        return `${nome} segue para o estoque`
      })
      if (resultado.puladas.length > 0) {
        frases.push(
          resultado.puladas.length === 1
            ? '1 móvel já tinha destino — nada mudou nele'
            : `${resultado.puladas.length} móveis já tinham destino — nada mudou neles`,
        )
      }
      notificar({
        titulo:
          resultado.decididas === 0
            ? 'Nada mudou'
            : resultado.decididas === 1
              ? 'Destino decidido: 1 móvel'
              : `Destino decidido: ${resultado.decididas} móveis`,
        descricao: frases.length > 0 ? `${frases.join('; ')}.` : undefined,
        tom: resultado.decididas > 0 ? 'perfeito' : 'atencao',
      })
      setEscolhas({})
      await Promise.all(RELER.map((queryKey) => clienteQuery.invalidateQueries({ queryKey })))
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para aplicar a decisão',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })

  function escolher(pecaId: number, escolha: Escolha | undefined) {
    setEscolhas((antes) => {
      const novas = { ...antes }
      if (escolha === undefined) delete novas[pecaId]
      else novas[pecaId] = escolha
      return novas
    })
  }

  /** "Todas de uma vez": a mesma decisão em todas as peças (o pedido sai da distribuição). */
  function paraTodas(destino: DestinoMovel) {
    const novas: Record<number, Escolha> = {}
    for (const p of pecas) {
      novas[p.id] =
        destino === 'outro_pedido' ? { destino, pedidoId: distribuicao?.[p.id] } : { destino }
    }
    setEscolhas(novas)
  }

  const todasCom = (destino: DestinoMovel) =>
    pecas.length > 0 && pecas.every((p) => escolhas[p.id]?.destino === destino)

  const pronto = decisoes.length > 0 && !incompleta

  return (
    <Modal
      aberto={cardId !== null}
      aoFechar={(v) => !v && aoFechar()}
      tamanho="galpao"
      titulo="Para onde vai este móvel?"
      descricao={
        data
          ? `Pedido ${data.numero}${data.cliente_nome ? ` · ${data.cliente_nome}` : ''}`
          : undefined
      }
      rodape={
        <>
          <Botao variante="secundaria" icone={<Undo2 />} onClick={aoFechar}>
            Fechar
          </Botao>
          {pecas.length > 0 && (
            <Botao
              disabled={!pronto}
              carregando={aplicar.isPending}
              onClick={() => aplicar.mutate()}
            >
              Aplicar a decisão
            </Botao>
          )}
        </>
      }
    >
      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {error && (
        <p className="text-sm text-danificado-forte" role="alert">
          {error instanceof Error ? error.message : 'Não deu para abrir a decisão do pedido.'}
        </p>
      )}
      {data && (
        <div className="flex flex-col gap-4">
          {/* O resumo: o que aconteceu com o pedido. */}
          <section className="flex flex-col gap-2 rounded-dm border border-borda bg-superficie-sutil p-3 text-sm">
            <p className="text-texto">
              O pedido <strong>{data.numero}</strong>{' '}
              {data.cancelado
                ? data.motivo_cancelamento === 'plataforma'
                  ? 'foi cancelado pela plataforma'
                  : data.motivo_cancelamento === 'excluido'
                    ? 'foi excluído no Tiny'
                    : 'foi cancelado no Tiny'
                : 'tinha sido cancelado no Tiny'}
              {data.cancelado_em ? ` em ${quando(data.cancelado_em)}` : ''}.{' '}
              {pecas.length === 0
                ? ''
                : pecas.length === 1
                  ? '1 móvel dele estava em produção — decida para onde vai.'
                  : `${pecas.length} móveis dele estavam em produção — decida para onde vão.`}
            </p>
            <p>
              {data.cancelado ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-danificado-fundo px-2 py-0.5 text-xs font-medium text-danificado-texto">
                  <Ban aria-hidden className="size-3.5" />
                  {data.motivo_cancelamento === 'plataforma'
                    ? 'Cancelado pela plataforma'
                    : data.motivo_cancelamento === 'excluido'
                      ? 'Excluído no Tiny'
                      : 'Cancelado no Tiny'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-info-fundo px-2 py-0.5 text-xs font-medium text-info-texto">
                  <CircleCheck aria-hidden className="size-3.5" />
                  Voltou a valer no Tiny{data.situacao_tiny ? ` (${data.situacao_tiny})` : ''}
                </span>
              )}
            </p>
          </section>

          {pecas.length === 0 ? (
            <p className="rounded-dm border border-perfeito-borda bg-perfeito-fundo p-3 text-sm text-perfeito-texto">
              Nada esperando decisão neste pedido.
            </p>
          ) : (
            <>
              {pecas.length > 1 && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium text-texto">Todas de uma vez</legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {OPCOES.map((d) => {
                      const desligada = d === 'outro_pedido' && distribuicao === null
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={todasCom(d)}
                          disabled={desligada}
                          onClick={() => paraTodas(d)}
                          className={cn(
                            'toque-seguro flex min-h-toque-md items-center gap-2 rounded-dm border-2 px-3 py-2 text-left text-sm transition-colors',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                            todasCom(d)
                              ? 'border-acao-ativa bg-superficie-sutil font-medium text-texto'
                              : 'border-borda bg-superficie text-texto hover:border-borda-forte',
                          )}
                        >
                          {ICONE[d]}
                          <span className="min-w-0">{ROTULO_DESTINO[d]}</span>
                        </button>
                      )
                    })}
                  </div>
                  {distribuicao === null && (
                    <p className="text-xs text-texto-suave">
                      Nem todos os móveis têm um pedido que precise deles — passe para outro pedido
                      peça por peça.
                    </p>
                  )}
                </fieldset>
              )}

              <ul className="flex flex-col gap-3" aria-label="Móveis esperando decisão">
                {pecas.map((p) => (
                  <PecaDestino
                    key={p.id}
                    peca={p}
                    candidatos={listaDe(p)}
                    escolha={escolhas[p.id]}
                    vagasDe={(c) => vagasQueSobram(c, p.chave, p.id, escolhas, pecas)}
                    aoEscolher={(e) => escolher(p.id, e)}
                  />
                ))}
              </ul>

              <p className="text-sm text-texto-suave" aria-live="polite">
                {decisoes.length === 0
                  ? 'Escolha o destino de pelo menos um móvel.'
                  : incompleta
                    ? 'Escolha para qual pedido vai cada móvel marcado em "Passar para outro pedido".'
                    : `${decisoes.length} de ${pecas.length} ${pecas.length === 1 ? 'móvel' : 'móveis'} com destino escolhido.`}
              </p>
            </>
          )}

          {data.decididas.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-texto">Já decidido</h3>
              <ul className="flex flex-col gap-0.5 text-xs text-texto-suave">
                {data.decididas.map((d, i) => (
                  <li key={`${d.peca_id}-${i}`}>
                    <span className="tabular-nums">{quando(d.quando)}</span> ·{' '}
                    {d.descricao?.trim() || 'Móvel'} — {textoDaDecisao(d)}
                    {d.quem ? ` · ${d.quem}` : ''}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}

/** Um móvel: onde está, as três opções e — em "outro pedido" — para qual pedido. */
function PecaDestino({
  peca,
  candidatos,
  escolha,
  vagasDe,
  aoEscolher,
}: {
  peca: PecaEsperandoDestino
  candidatos: PedidoCandidato[]
  escolha: Escolha | undefined
  vagasDe: (c: PedidoCandidato) => number
  aoEscolher: (e: Escolha | undefined) => void
}) {
  const nome = nomeDaPeca(peca)
  const naoServe = porQueNaoOutroPedido(peca, candidatos)
  const onde = [peca.setor, peca.etapa].filter(Boolean).join(' · ')

  return (
    <li className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-3">
      <div className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium break-words text-texto">
          <span className="min-w-0">{nome}</span>
          {peca.danificada && <BadgeEstado estado="danificado" tamanho="sm" />}
        </p>
        <p className="text-xs text-texto-suave">
          {peca.sku ? `SKU ${peca.sku} · ` : ''}
          {onde ? `Em ${onde}` : 'Em produção'} · esperando desde{' '}
          <span className="tabular-nums">{quando(peca.desde)}</span>
        </p>
        {peca.executor && (
          <p className="inline-flex items-center gap-1 text-xs text-atencao-texto">
            <UserRound aria-hidden className="size-3.5 shrink-0" />
            {peca.executor} está trabalhando nele agora.
          </p>
        )}
      </div>

      <div role="radiogroup" aria-label={`Destino de ${nome}`} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {OPCOES.map((d) => {
          const marcada = escolha?.destino === d
          const desligada = d === 'outro_pedido' && naoServe !== null
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={marcada}
              disabled={desligada}
              onClick={() => aoEscolher(marcada ? undefined : { destino: d })}
              className={cn(
                'toque-seguro flex min-h-toque-lg items-center gap-2 rounded-dm border-2 px-3 py-2 text-left text-sm transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                marcada
                  ? 'border-acao-ativa bg-superficie-sutil font-medium text-texto'
                  : 'border-borda bg-superficie text-texto hover:border-borda-forte',
              )}
            >
              {ICONE[d]}
              <span className="min-w-0 flex-1">{ROTULO_DESTINO[d]}</span>
              {marcada && <CircleCheck aria-hidden className="size-4 shrink-0 text-acao-ativa" />}
            </button>
          )
        })}
      </div>
      {naoServe && <p className="text-xs text-texto-suave">{naoServe}</p>}

      {escolha?.destino === 'outro_pedido' && (
        <div role="radiogroup" aria-label={`Para qual pedido vai ${nome}`} className="flex flex-col gap-2">
          <p className="text-sm font-medium text-texto">Para qual pedido</p>
          {candidatos.map((c) => {
            const marcado = escolha.pedidoId === c.pedido_id
            const sobram = vagasDe(c)
            const semVaga = sobram === 0 && !marcado
            return (
              <button
                key={c.pedido_id}
                type="button"
                role="radio"
                aria-checked={marcado}
                disabled={semVaga}
                onClick={() => aoEscolher({ destino: 'outro_pedido', pedidoId: c.pedido_id })}
                className={cn(
                  'toque-seguro flex min-h-toque-md flex-col items-start rounded-dm border-2 px-3 py-2 text-left text-sm transition-colors',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  marcado
                    ? 'border-acao-ativa bg-superficie-sutil font-medium text-texto'
                    : 'border-borda bg-superficie text-texto hover:border-borda-forte',
                )}
              >
                <span className="flex w-full items-center gap-2">
                  <span className="min-w-0 flex-1 break-words">
                    Pedido {c.numero}
                    {c.cliente_nome ? ` · ${c.cliente_nome}` : ''}
                  </span>
                  {marcado && <CircleCheck aria-hidden className="size-4 shrink-0 text-acao-ativa" />}
                </span>
                <span className="text-xs font-normal text-texto-suave">
                  {[
                    c.data_prevista ? `previsto ${dia(c.data_prevista)}` : null,
                    semVaga
                      ? 'a vaga já foi escolhida para outro móvel'
                      : sobram === 1
                        ? '1 vaga deste móvel'
                        : `${sobram} vagas deste móvel`,
                    c.standby ? 'em stand-by' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {escolha && <p className="text-xs text-texto-suave">{EXPLICA_DESTINO[escolha.destino]}</p>}
    </li>
  )
}
