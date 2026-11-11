import { useMemo } from 'react'
import { Link } from 'react-router'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { Ban, Inbox, PackageX, PanelRightOpen, Undo2 } from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import { MaisAoRolar } from '@/componentes/MaisAoRolar'
import { devolverAoPcp, listarCanceladosRemovidos } from '../api'
import type { CursorCancelados, PedidoCanceladoOuRemovido } from '../api'
import { ROTULO_MOTIVO_REMOCAO, diaEHoraCurto, pecasPorExtenso } from '../avisoPcp'
import { useFiltroDoQuadro } from '../filtroQuadro'
import { useAbrirCard } from '../janela/abrirCard'
import { FiltroDoQuadro, NadaBateComOFiltro } from './FiltroDoQuadro'

/**
 * A aba "Cancelados e removidos" do PCP (SESSAO-48 · frente 2): os pedidos que
 * saíram do PCP sem ser produzidos — cancelados no Tiny e removidos pelo PCP
 * ("Remover do PCP" na janela do aviso) —, do que saiu mais recente para trás.
 * Cada linha diz o motivo, quem removeu e quando, e as peças que seguem; o
 * removido ganha "Devolver ao PCP" (quando o Tiny deixa). Paginada no servidor
 * por cursor (Lei §6), lida só com a aba aberta (Lei §3), ao vivo pelo aviso do
 * PCP (as chaves moram debaixo de ['cards']). O filtro é o dos outros quadros
 * do PCP (o mesmo `?filtro=`).
 */
export function AbaCanceladosRemovidos() {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const abrirCard = useAbrirCard()
  const filtro = useFiltroDoQuadro()

  const consulta = useInfiniteQuery({
    queryKey: ['cards', 'pcp-cancelados', filtro.aplicado ?? ''],
    queryFn: ({ pageParam }) =>
      listarCanceladosRemovidos({ busca: filtro.aplicado, depois: pageParam }),
    initialPageParam: null as CursorCancelados | null,
    getNextPageParam: (ultima) => ultima.proxima ?? undefined,
    placeholderData: keepPreviousData,
  })
  const linhas = useMemo(() => consulta.data?.pages.flatMap((p) => p.linhas) ?? [], [consulta.data])

  const devolver = useMutation({
    mutationFn: (cardId: number) => devolverAoPcp(cardId),
    onSuccess: async (r) => {
      if (!r.feito) {
        notificar({ titulo: 'Este pedido já tinha voltado ao PCP', tom: 'perfeito' })
      } else if (r.fora_pelo_tiny) {
        notificar({
          titulo: `Pedido ${r.numero} saiu dos removidos`,
          descricao: `Ele não volta ao quadro: no Tiny está como "${r.situacao ?? '—'}".`,
          tom: 'atencao',
        })
      } else {
        notificar({
          titulo: `Pedido ${r.numero} devolvido ao PCP`,
          descricao: r.standby
            ? 'Ele está na aba Stand-by do PCP.'
            : 'Ele está em "Pedidos aguardando liberação".',
          tom: 'perfeito',
        })
      }
      await Promise.all(
        [['cards'], ['pedidos-lista'], ['pedido-ficha']].map((queryKey) =>
          clienteQuery.invalidateQueries({ queryKey }),
        ),
      )
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para devolver ao PCP',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <section aria-label="Cancelados e removidos" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Sem o total: contar a história inteira custa e a tela não precisa (Lei §6.4) —
            a lista anda ao rolar. */}
        <h2 className="text-base">Cancelados e removidos</h2>
        <span className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <FiltroDoQuadro texto={filtro.texto} aoMudar={filtro.mudar} />
        </span>
      </div>

      {consulta.isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {consulta.isError && (
        <p
          className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto"
          role="alert"
        >
          {consulta.error instanceof Error ? consulta.error.message : 'Não deu para carregar.'}
        </p>
      )}
      {!consulta.isPending && !consulta.isError && linhas.length === 0 && filtro.aplicado && (
        <NadaBateComOFiltro filtro={filtro.aplicado} />
      )}
      {!consulta.isPending && !consulta.isError && linhas.length === 0 && !filtro.aplicado && (
        <p className="flex items-center gap-2 rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          <Inbox aria-hidden className="size-5 shrink-0" />
          Nenhum pedido cancelado ou removido do PCP.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {linhas.map((l) => (
          <LinhaCanceladoOuRemovido
            key={l.card_id}
            linha={l}
            devolvendo={devolver.isPending && devolver.variables === l.card_id}
            aoAbrir={() => abrirCard(l.card_id)}
            aoDevolver={() => devolver.mutate(l.card_id)}
          />
        ))}
      </ul>

      <MaisAoRolar
        temMais={consulta.hasNextPage}
        carregando={consulta.isFetchingNextPage}
        aoChegar={() => {
          if (!consulta.isFetchingNextPage) void consulta.fetchNextPage()
        }}
      />

      <p className="text-xs text-texto-suave">
        A história inteira dos pedidos cancelados no Tiny fica em{' '}
        <Link
          to="/fabrica/pedidos/cancelados"
          className="font-medium text-texto underline underline-offset-2"
        >
          Pedidos → Cancelados
        </Link>
        .
      </p>
    </section>
  )
}

/** As peças que seguem com o pedido, em uma linha ("1 em produção · 2 prontas…"). */
function textoDasPecas(l: PedidoCanceladoOuRemovido): string {
  const partes = [
    l.em_producao > 0 ? `${pecasPorExtenso(l.em_producao)} em produção` : null,
    l.prontas > 0 ? `${pecasPorExtenso(l.prontas)} pronta${l.prontas === 1 ? '' : 's'}` : null,
    l.no_estoque > 0 ? `${l.no_estoque} no estoque, sem dono` : null,
    l.esperando_decisao > 0 ? `${l.esperando_decisao} esperando a decisão da logística` : null,
  ].filter(Boolean)
  return partes.length > 0 ? partes.join(' · ') : 'Nenhuma peça em produção ou pronta'
}

function LinhaCanceladoOuRemovido({
  linha: l,
  devolvendo,
  aoAbrir,
  aoDevolver,
}: {
  linha: PedidoCanceladoOuRemovido
  devolvendo: boolean
  aoAbrir: () => void
  aoDevolver: () => void
}) {
  const removido = l.removido_em !== null
  return (
    <li className="flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-texto tabular-nums">Pedido {l.numero}</span>
          {removido && (
            <span className="inline-flex items-center gap-1 rounded-full bg-atencao-fundo px-2 py-0.5 text-xs font-medium text-atencao-texto">
              <PackageX aria-hidden className="size-3.5" />
              Removido do PCP
            </span>
          )}
          {l.cancelado_no_tiny && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danificado-fundo px-2 py-0.5 text-xs font-medium text-danificado-texto">
              <Ban aria-hidden className="size-3.5" />
              Cancelado no Tiny
            </span>
          )}
        </span>
        <span className="truncate text-sm text-texto-suave">{l.cliente_nome || 'Sem cliente'}</span>
        {removido && l.removido_motivo && (
          <span className="text-sm break-words text-texto">
            {ROTULO_MOTIVO_REMOCAO[l.removido_motivo]}
            {l.removido_texto ? `: ${l.removido_texto}` : ''}
          </span>
        )}
        <span className="text-xs text-texto-suave tabular-nums">
          {removido
            ? `Removido${l.removido_por ? ` por ${l.removido_por}` : ''} em ${diaEHoraCurto(l.removido_em)}`
            : `Cancelado no Tiny em ${diaEHoraCurto(l.cancelado_em ?? l.saiu_em)}`}
          {removido && l.cancelado_no_tiny && l.cancelado_em
            ? ` · cancelado no Tiny em ${diaEHoraCurto(l.cancelado_em)}`
            : ''}
        </span>
        <span className="text-xs text-texto-suave tabular-nums">{textoDasPecas(l)}</span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1 sm:justify-end">
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<PanelRightOpen />}
          className="min-h-toque-md min-w-toque-md px-2"
          aria-label={`Abrir o card do pedido ${l.numero}`}
          title="Abrir o card"
          onClick={aoAbrir}
        />
        {l.pode_devolver && (
          <Botao
            variante="secundaria"
            icone={<Undo2 />}
            carregando={devolvendo}
            onClick={aoDevolver}
          >
            Devolver ao PCP
          </Botao>
        )}
      </div>
    </li>
  )
}
