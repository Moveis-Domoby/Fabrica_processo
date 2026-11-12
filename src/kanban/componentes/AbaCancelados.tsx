import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { AlertTriangle, Ban, CircleCheck, FileX, Inbox, PanelRightOpen, RotateCw } from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import { MaisAoRolar } from '@/componentes/MaisAoRolar'
import { diaEHoraCurto, pecasPorExtenso } from '../avisoPcp'
import { useFiltroDoQuadro } from '../filtroQuadro'
import { useAbrirCard } from '../janela/abrirCard'
import { cancelarPedido, listarCancelados, novaChave, textoEstadoTiny } from '../pcpSaida'
import type { CursorSaida, PedidoCancelado } from '../pcpSaida'
import { FiltroDoQuadro, NadaBateComOFiltro } from './FiltroDoQuadro'

/**
 * A aba "Cancelados" do PCP (SESSAO-50 · bloco B — no lugar da "Cancelados e
 * removidos" da 48): os pedidos que saíram do PCP porque não vão ser
 * produzidos — cancelados no Tiny, cancelados pela plataforma ("Cancelar
 * pedido") e excluídos no Tiny —, cada um com o seu rótulo, do que saiu mais
 * recente para trás. O cancelado pela plataforma mostra se o Tiny já confirmou;
 * com o Tiny parado ou recusando, "Tentar de novo". Paginada no servidor por
 * cursor (Lei §6), lida só com a aba aberta (Lei §3), ao vivo pelo aviso do PCP
 * (as chaves moram debaixo de ['cards']). O filtro é o dos quadros do PCP.
 */
export function AbaCancelados() {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const abrirCard = useAbrirCard()
  const filtro = useFiltroDoQuadro()
  const [chave] = useState(() => novaChave('tentar'))

  const consulta = useInfiniteQuery({
    queryKey: ['cards', 'pcp-cancelados', filtro.aplicado ?? ''],
    queryFn: ({ pageParam }) => listarCancelados({ busca: filtro.aplicado, depois: pageParam }),
    initialPageParam: null as CursorSaida | null,
    getNextPageParam: (ultima) => ultima.proxima ?? undefined,
    placeholderData: keepPreviousData,
  })
  const linhas = useMemo(() => consulta.data?.pages.flatMap((p) => p.linhas) ?? [], [consulta.data])

  const tentar = useMutation({
    mutationFn: (cardId: number) => cancelarPedido(cardId, `${chave}:${cardId}:${Date.now()}`),
    onSuccess: async (r) => {
      notificar(
        r.feito
          ? {
              titulo: `Pedido ${r.numero}: o cancelamento foi pedido de novo ao Tiny`,
              tom: 'perfeito',
            }
          : { titulo: 'O Tiny já está cuidando deste pedido', tom: 'perfeito' },
      )
      await clienteQuery.invalidateQueries({ queryKey: ['cards'] })
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para pedir de novo ao Tiny',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <section aria-label="Cancelados" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Sem o total: contar a história inteira custa e a tela não precisa (Lei §6.4). */}
        <h2 className="text-base">Cancelados</h2>
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
          Nenhum pedido cancelado que tenha passado pelo PCP.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {linhas.map((l) => (
          <LinhaCancelado
            key={l.card_id}
            linha={l}
            tentando={tentar.isPending && tentar.variables === l.card_id}
            aoAbrir={() => abrirCard(l.card_id)}
            aoTentar={() => tentar.mutate(l.card_id)}
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

/** As peças que ainda carregam o pedido, em uma linha. */
function textoDasPecas(l: PedidoCancelado): string {
  const partes = [
    l.em_producao > 0 ? `${pecasPorExtenso(l.em_producao)} em produção` : null,
    l.prontas > 0 ? `${pecasPorExtenso(l.prontas)} pronta${l.prontas === 1 ? '' : 's'}` : null,
    l.no_estoque > 0 ? `${l.no_estoque} no estoque, sem dono` : null,
    l.esperando_decisao > 0 ? `${l.esperando_decisao} esperando a decisão da logística` : null,
  ].filter(Boolean)
  return partes.length > 0 ? partes.join(' · ') : 'Nenhuma peça em produção ou pronta'
}

const ROTULO: Record<PedidoCancelado['motivo'], { texto: string; icone: typeof Ban }> = {
  tiny: { texto: 'Cancelado no Tiny', icone: Ban },
  plataforma: { texto: 'Cancelado pela plataforma', icone: Ban },
  excluido: { texto: 'Excluído no Tiny', icone: FileX },
}

function LinhaCancelado({
  linha: l,
  tentando,
  aoAbrir,
  aoTentar,
}: {
  linha: PedidoCancelado
  tentando: boolean
  aoAbrir: () => void
  aoTentar: () => void
}) {
  const rotulo = ROTULO[l.motivo]
  const Icone = rotulo.icone
  const avisoTiny = l.motivo === 'plataforma' ? textoEstadoTiny(l.tiny_estado) : null
  const podeTentar = l.motivo === 'plataforma' && (l.tiny_estado === 'parado' || l.tiny_estado === 'falhando')
  const quando =
    l.motivo === 'plataforma'
      ? `Cancelado${l.cancelado_por ? ` por ${l.cancelado_por}` : ''} em ${diaEHoraCurto(l.saiu_em)}`
      : l.motivo === 'excluido'
        ? `Não existe mais no Tiny desde ${diaEHoraCurto(l.saiu_em)}`
        : `Cancelado no Tiny em ${diaEHoraCurto(l.saiu_em)}`
  return (
    <li className="flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-texto tabular-nums">Pedido {l.numero}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-danificado-fundo px-2 py-0.5 text-xs font-medium text-danificado-texto">
            <Icone aria-hidden className="size-3.5" />
            {rotulo.texto}
          </span>
          {l.motivo === 'plataforma' && l.tiny_estado === 'confirmado' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-perfeito-fundo px-2 py-0.5 text-xs font-medium text-perfeito-texto">
              <CircleCheck aria-hidden className="size-3.5" />
              Confirmado no Tiny
            </span>
          )}
        </span>
        <span className="truncate text-sm text-texto-suave">{l.cliente_nome || 'Sem cliente'}</span>
        <span className="text-xs text-texto-suave tabular-nums">{quando}</span>
        <span className="text-xs text-texto-suave tabular-nums">{textoDasPecas(l)}</span>
        {avisoTiny && (
          <span
            className="mt-1 flex items-start gap-1.5 rounded-dm bg-atencao-fundo px-2 py-1 text-xs text-atencao-texto"
            title={l.tiny_erro ?? undefined}
          >
            <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
            <span className="break-words">{avisoTiny}</span>
          </span>
        )}
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
        {podeTentar && (
          <Botao variante="secundaria" icone={<RotateCw />} carregando={tentando} onClick={aoTentar}>
            Tentar de novo
          </Botao>
        )}
      </div>
    </li>
  )
}
