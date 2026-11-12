import { useMemo, useState } from 'react'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { Check, EyeOff, Inbox, PanelRightOpen, Pencil, RotateCcw, Undo2, X } from 'lucide-react'
import { Botao, Modal, useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { MaisAoRolar } from '@/componentes/MaisAoRolar'
import { diaEHoraCurto, pecasPorExtenso } from '../avisoPcp'
import { useFiltroDoQuadro } from '../filtroQuadro'
import { useAbrirCard } from '../janela/abrirCard'
import {
  diasParaSair,
  listarOcultos,
  mudarDiasOcultos,
  produtosPorExtenso,
  recuperarPedido,
} from '../pcpSaida'
import type { CursorSaida, PedidoOculto } from '../pcpSaida'
import { FiltroDoQuadro, NadaBateComOFiltro } from './FiltroDoQuadro'

/**
 * A aba "Pedidos ocultos" do PCP (SESSAO-50 · bloco B — resposta do dono de
 * 12/11, 01:25 e 01:30): os pedidos que o PCP ocultou nos últimos N dias (a
 * configuração, padrão 30 — o admin muda aqui mesmo). "Recuperar" devolve o
 * pedido ao PCP com TODAS as vagas abertas para liberar — as peças ocultadas
 * junto não voltam para a coluna onde estavam. Depois dos N dias o pedido só
 * some da lista (nada é apagado) e volta por "Incluir pedido no PCP".
 * Paginada no servidor por cursor, lida só com a aba aberta, ao vivo pelo aviso
 * do PCP.
 */
export function AbaPedidosOcultos() {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const abrirCard = useAbrirCard()
  const filtro = useFiltroDoQuadro()
  const { perfil } = useSessao()
  const souAdmin = perfil?.papel === 'admin'
  const [recuperando, setRecuperando] = useState<PedidoOculto | null>(null)

  const consulta = useInfiniteQuery({
    queryKey: ['cards', 'pcp-ocultos', filtro.aplicado ?? ''],
    queryFn: ({ pageParam }) => listarOcultos({ busca: filtro.aplicado, depois: pageParam }),
    initialPageParam: null as CursorSaida | null,
    getNextPageParam: (ultima) => ultima.proxima ?? undefined,
    placeholderData: keepPreviousData,
  })
  const linhas = useMemo(() => consulta.data?.pages.flatMap((p) => p.linhas) ?? [], [consulta.data])
  const dias = consulta.data?.pages[0]?.dias ?? null

  const recuperar = useMutation({
    mutationFn: (cardId: number) => recuperarPedido(cardId),
    onSuccess: async (r) => {
      if (!r.feito) {
        notificar({ titulo: 'Este pedido já tinha voltado ao PCP', tom: 'perfeito' })
      } else if (r.fora_pelo_tiny) {
        notificar({
          titulo: `Pedido ${r.numero} saiu dos ocultos`,
          descricao: `Ele não volta ao quadro: no Tiny está como "${r.situacao ?? '—'}".`,
          tom: 'atencao',
        })
      } else {
        notificar({
          titulo: `Pedido ${r.numero} voltou ao PCP`,
          descricao:
            (r.standby
              ? 'Ele está na aba Stand-by do PCP.'
              : 'Ele está em "Pedidos aguardando liberação".') +
            ((r.a_liberar ?? 0) > 0 ? ` ${produtosPorExtenso(r.a_liberar ?? 0)} para liberar.` : ''),
          tom: 'perfeito',
        })
      }
      setRecuperando(null)
      await Promise.all(
        [['cards'], ['pedidos-lista'], ['pedido-ficha']].map((queryKey) =>
          clienteQuery.invalidateQueries({ queryKey }),
        ),
      )
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para recuperar o pedido',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <section aria-label="Pedidos ocultos" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-base">Pedidos ocultos</h2>
          <DiasNaLista dias={dias} souAdmin={souAdmin} />
        </div>
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
          Nenhum pedido oculto. Para tirar um pedido do PCP sem cancelar no Tiny, use "Ocultar do
          PCP" no card dele.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {linhas.map((l) => (
          <LinhaOculto
            key={l.card_id}
            linha={l}
            aoAbrir={() => abrirCard(l.card_id)}
            aoRecuperar={() => setRecuperando(l)}
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
        Depois desse prazo o pedido sai desta lista (nada é apagado) e volta ao PCP só por "Incluir
        pedido no PCP", no alto da tela.
      </p>

      <ModalRecuperar
        pedido={recuperando}
        carregando={recuperar.isPending}
        aoFechar={() => !recuperar.isPending && setRecuperando(null)}
        aoConfirmar={() => recuperando && recuperar.mutate(recuperando.card_id)}
      />
    </section>
  )
}

function LinhaOculto({
  linha: l,
  aoAbrir,
  aoRecuperar,
}: {
  linha: PedidoOculto
  aoAbrir: () => void
  aoRecuperar: () => void
}) {
  const faltam = diasParaSair(l.oculto_em, l.dias)
  return (
    <li className="flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-texto tabular-nums">Pedido {l.numero}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-superficie-sutil px-2 py-0.5 text-xs font-medium text-texto-suave">
            <EyeOff aria-hidden className="size-3.5" />
            Oculto do PCP
          </span>
        </span>
        <span className="truncate text-sm text-texto-suave">{l.cliente_nome || 'Sem cliente'}</span>
        <span className="text-xs text-texto-suave tabular-nums">
          Ocultado{l.oculto_por ? ` por ${l.oculto_por}` : ''} em {diaEHoraCurto(l.oculto_em)}
          {' · '}
          {faltam === 0 ? 'sai da lista hoje' : faltam === 1 ? 'sai da lista amanhã' : `sai da lista em ${faltam} dias`}
        </span>
        <span className="text-xs text-texto-suave tabular-nums">
          {l.pecas_ocultadas > 0
            ? `${pecasPorExtenso(l.pecas_ocultadas)} ${l.pecas_ocultadas === 1 ? 'saiu' : 'saíram'} junto do quadro`
            : 'Só o pedido foi ocultado'}
          {l.a_liberar > 0 ? ` · ${produtosPorExtenso(l.a_liberar)} para liberar ao recuperar` : ''}
        </span>
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
        <Botao variante="secundaria" icone={<RotateCcw />} onClick={aoRecuperar}>
          Recuperar
        </Botao>
      </div>
    </li>
  )
}

/** "Recuperar": a janela diz com quantos produtos ele volta (as vagas abertas). */
function ModalRecuperar({
  pedido,
  carregando,
  aoFechar,
  aoConfirmar,
}: {
  pedido: PedidoOculto | null
  carregando: boolean
  aoFechar: () => void
  aoConfirmar: () => void
}) {
  return (
    <Modal
      aberto={pedido !== null}
      aoFechar={(v) => !v && aoFechar()}
      tamanho="md"
      titulo={`Recuperar o pedido ${pedido?.numero ?? ''}?`}
      descricao={pedido?.cliente_nome || undefined}
    >
      {pedido && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-texto">
            {pedido.a_liberar > 0
              ? `O pedido ${pedido.numero} volta ao PCP com ${produtosPorExtenso(pedido.a_liberar)} para liberar.`
              : `O pedido ${pedido.numero} volta ao PCP.`}
          </p>
          {pedido.pecas_ocultadas > 0 && (
            <p className="text-sm text-texto-suave">
              {pedido.pecas_ocultadas === 1
                ? 'A peça ocultada junto não volta para a coluna onde estava: a vaga dela fica aberta no PCP, e a liberação é a de sempre.'
                : `As ${pedido.pecas_ocultadas} peças ocultadas junto não voltam para a coluna onde estavam: as vagas delas ficam abertas no PCP, e a liberação é a de sempre.`}
            </p>
          )}
          {pedido.fora_pelo_tiny && (
            <p className="rounded-dm border border-atencao-borda bg-atencao-fundo p-3 text-sm text-atencao-texto">
              No Tiny ele está como "{pedido.situacao ?? '—'}" — ele sai dos ocultos, mas o PCP só o
              mostra quando o Tiny voltar a situação.
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Botao variante="secundaria" icone={<Undo2 />} disabled={carregando} onClick={aoFechar}>
              Voltar
            </Botao>
            <Botao icone={<RotateCcw />} carregando={carregando} onClick={aoConfirmar}>
              Recuperar
            </Botao>
          </div>
        </div>
      )}
    </Modal>
  )
}

/** "Ficam aqui por 30 dias" — o admin muda (1 a 365) ali mesmo. */
function DiasNaLista({ dias, souAdmin }: { dias: number | null; souAdmin: boolean }) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState('')
  const salvar = useMutation({
    mutationFn: (n: number) => mudarDiasOcultos(n),
    onSuccess: async (n) => {
      notificar({ titulo: `Pedidos ocultos ficam ${n} dias na lista`, tom: 'perfeito' })
      setEditando(false)
      await clienteQuery.invalidateQueries({ queryKey: ['cards', 'pcp-ocultos'] })
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'Não deu para salvar.'),
  })
  if (dias === null && !souAdmin) return null
  if (!editando) {
    return (
      <span className="flex flex-wrap items-center gap-1 text-xs text-texto-suave">
        {dias !== null ? `Ficam aqui por ${dias} dias.` : 'Ficam aqui por alguns dias.'}
        {souAdmin && (
          <button
            type="button"
            className="toque-seguro inline-flex items-center gap-1 rounded px-1 font-medium text-texto underline-offset-2 hover:underline"
            onClick={() => {
              setValor(String(dias ?? 30))
              setErro('')
              setEditando(true)
            }}
          >
            <Pencil aria-hidden className="size-3" />
            Mudar
          </button>
        )}
      </span>
    )
  }
  return (
    <form
      // a conferência é nossa (a mensagem em português) — sem o balão do navegador
      noValidate
      className="flex flex-wrap items-center gap-2 text-xs text-texto-suave"
      onSubmit={(e) => {
        e.preventDefault()
        const n = Number(valor)
        if (!Number.isInteger(n) || n < 1 || n > 365) {
          setErro('Escolha de 1 a 365 dias.')
          return
        }
        salvar.mutate(n)
      }}
    >
      <label htmlFor="pcp-ocultos-dias">Ficam aqui por</label>
      <input
        id="pcp-ocultos-dias"
        type="number"
        inputMode="numeric"
        min={1}
        max={365}
        value={valor}
        onChange={(e) => {
          setValor(e.target.value)
          setErro('')
        }}
        className="min-h-toque-md w-20 rounded-dm border border-borda-forte bg-superficie px-2 text-base text-texto tabular-nums"
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? 'pcp-ocultos-dias-erro' : undefined}
      />
      <span>dias</span>
      <Botao type="submit" tamanho="sm" icone={<Check />} carregando={salvar.isPending}>
        Salvar
      </Botao>
      <Botao
        type="button"
        variante="fantasma"
        tamanho="sm"
        icone={<X />}
        disabled={salvar.isPending}
        onClick={() => setEditando(false)}
      >
        Cancelar
      </Botao>
      {erro && (
        <span id="pcp-ocultos-dias-erro" role="alert" className="basis-full text-danificado-forte">
          {erro}
        </span>
      )}
    </form>
  )
}
