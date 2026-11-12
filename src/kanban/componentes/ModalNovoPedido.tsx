import { useMemo, useState } from 'react'
import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { EyeOff, Search } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { MaisAoRolar } from '@/componentes/MaisAoRolar'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { criarCardPedido } from '../api'
import { listarParaIncluir, produtosPorExtenso, recuperarPedido } from '../pcpSaida'
import type { ListaIncluir, PedidoSemCard } from '../pcpSaida'
import type { Setor } from '../tipos'

const POR_PAGINA = 8

type PedidoOcultoIncluir = ListaIncluir['ocultos'][number]

/** O que foi escolhido: um pedido oculto (volta ao PCP) ou um pedido sem card (o card nasce). */
type Escolha =
  | { tipo: 'oculto'; linha: PedidoOcultoIncluir }
  | { tipo: 'sem_card'; linha: PedidoSemCard }

export interface ModalNovoPedidoProps {
  aberto: boolean
  setorPcp: Setor
  aoFechar: () => void
}

function formatarData(iso: string | null): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '—'
}

function diaCurto(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/**
 * "Incluir pedido no PCP" — o botão que já existia para trazer pedido ANTIGO
 * que ficou de fora do kanban (D-22: card só nasce de pedido real do Tiny; o
 * novo entra sozinho pelo banco).
 *
 * ↪️ SESSAO-50 (bloco B — resposta do dono de 12/11): também traz de volta o
 * pedido OCULTO do PCP, de qualquer idade (depois dos dias da aba "Pedidos
 * ocultos", este é o único caminho): a lista mostra "Oculto em dd/mm" e incluir
 * faz a mesma recuperação da aba — o pedido volta com todas as vagas abertas
 * para liberar. O excluído no Tiny fica de fora (não existe mais). Uma
 * requisição por busca/página (os ocultos e os sem card juntos), paginada no
 * servidor pelo número e pedida ao rolar (Lei §6 — a lista antiga contava e
 * calculava todos os pedidos antes de mostrar 8). Só aparece o pedido que o PCP
 * mostraria: o card de um pedido já faturado, enviado ou entregue nasceria fora
 * do quadro.
 */
export function ModalNovoPedido({ aberto, setorPcp, aoFechar }: ModalNovoPedidoProps) {
  const { perfil } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const [busca, setBusca] = useState('')
  const [escolhido, setEscolhido] = useState<Escolha | null>(null)
  const [erro, setErro] = useState('')

  const consulta = useInfiniteQuery({
    queryKey: ['pcp-incluir', busca],
    queryFn: ({ pageParam }) =>
      listarParaIncluir({ busca: busca || null, limite: POR_PAGINA, antesNumero: pageParam }),
    initialPageParam: null as number | null,
    getNextPageParam: (ultima) => ultima.proximo ?? undefined,
    enabled: aberto,
    placeholderData: keepPreviousData,
  })
  const { data, isPending } = consulta
  const ocultos = data?.pages[0]?.ocultos ?? []
  const semCard = useMemo(() => data?.pages.flatMap((p) => p.sem_card) ?? [], [data])

  async function releer() {
    await Promise.all(
      [['cards'], ['pcp-incluir'], ['pedidos-resumo'], ['pedidos-lista'], ['pedido-ficha']].map(
        (queryKey) => clienteQuery.invalidateQueries({ queryKey }),
      ),
    )
  }

  const mutacao = useMutation({
    mutationFn: async (escolha: Escolha) => {
      if (escolha.tipo === 'oculto') return { escolha, recuperado: await recuperarPedido(escolha.linha.card_id) }
      if (!perfil) throw new Error('Entre de novo para incluir o pedido.')
      await criarCardPedido({
        pedidoId: escolha.linha.pedido_id,
        setorPcpId: setorPcp.id,
        usuarioId: perfil.id,
      })
      return { escolha, recuperado: null }
    },
    onSuccess: async ({ escolha, recuperado }) => {
      if (escolha.tipo === 'oculto') {
        const r = recuperado!
        notificar(
          r.fora_pelo_tiny
            ? {
                titulo: `Pedido ${escolha.linha.numero} saiu dos ocultos`,
                descricao: `Ele não volta ao quadro: no Tiny está como "${r.situacao ?? '—'}".`,
                tom: 'atencao',
              }
            : {
                titulo: `Pedido ${escolha.linha.numero} voltou ao PCP`,
                descricao:
                  (r.a_liberar ?? 0) > 0
                    ? `${produtosPorExtenso(r.a_liberar ?? 0)} para liberar.`
                    : undefined,
                tom: 'perfeito',
              },
        )
      } else {
        notificar({ titulo: `Card do pedido ${escolha.linha.numero} criado no PCP`, tom: 'perfeito' })
      }
      setEscolhido(null)
      aoFechar()
      await releer()
    },
    onError: (excecao) =>
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.'),
  })

  function aoIncluir() {
    if (!escolhido) {
      setErro('Escolha um pedido da lista.')
      return
    }
    setErro('')
    mutacao.mutate(escolhido)
  }

  const nada = !isPending && ocultos.length === 0 && semCard.length === 0

  return (
    <Modal
      aberto={aberto}
      aoFechar={(estaAberto) => {
        if (!estaAberto) aoFechar()
      }}
      titulo="Incluir pedido no PCP"
      // D-22/D-31: card só nasce de pedido real; o novo entra sozinho pelo banco.
      descricao="Pedido novo do Tiny entra sozinho. Aqui você traz de volta um pedido oculto do PCP, ou um pedido antigo que ficou de fora."
      tamanho="galpao"
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao carregando={mutacao.isPending} onClick={aoIncluir} disabled={!escolhido}>
            {escolhido?.tipo === 'oculto' ? 'Trazer de volta ao PCP' : 'Criar card no PCP'}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo
          rotulo="Buscar pedido"
          prefixo={<Search />}
          placeholder="Número do pedido ou nome do cliente"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
            setEscolhido(null)
          }}
        />

        {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
        {nada && (
          <p className="rounded-dm border border-borda px-3 py-4 text-sm text-texto-fraco">
            Nenhum pedido para incluir {busca ? 'nesta busca' : ''} — tudo que chegou do Tiny já
            está no kanban.
          </p>
        )}

        {ocultos.length > 0 && (
          <section aria-labelledby="incluir-ocultos" className="flex flex-col gap-1.5">
            <h3 id="incluir-ocultos" className="text-sm font-medium text-texto">
              Ocultos do PCP
            </h3>
            <ul
              className="flex flex-col divide-y divide-borda rounded-dm border border-borda"
              role="listbox"
              aria-labelledby="incluir-ocultos"
            >
              {ocultos.map((p) => {
                const selecionado = escolhido?.tipo === 'oculto' && escolhido.linha.card_id === p.card_id
                return (
                  <li key={p.card_id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selecionado}
                      onClick={() => setEscolhido(selecionado ? null : { tipo: 'oculto', linha: p })}
                      className={cn(
                        'flex min-h-toque-lg w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-left transition-colors',
                        selecionado ? 'bg-acao/15' : 'hover:bg-superficie-sutil',
                      )}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="flex flex-wrap items-center gap-x-2 font-semibold text-texto tabular-nums">
                          Pedido {p.numero}
                          <span className="inline-flex items-center gap-1 rounded-full bg-superficie-sutil px-2 py-0.5 text-xs font-medium text-texto-suave">
                            <EyeOff aria-hidden className="size-3" />
                            Oculto em {diaCurto(p.oculto_em)}
                          </span>
                          {selecionado && (
                            <span className="text-sm font-medium text-acao-ativa">✓ escolhido</span>
                          )}
                        </span>
                        <span className="line-clamp-1 text-sm text-texto-suave">
                          {p.cliente_nome || 'Sem cliente'}
                        </span>
                      </span>
                      <span className="text-right text-sm text-texto-suave tabular-nums">
                        {p.a_liberar > 0 ? `${produtosPorExtenso(p.a_liberar)} para liberar` : 'Nada a liberar'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {semCard.length > 0 && (
          <section aria-labelledby="incluir-sem-card" className="flex flex-col gap-1.5">
            <h3 id="incluir-sem-card" className="text-sm font-medium text-texto">
              Sem card no kanban
            </h3>
            <ul
              className="flex flex-col divide-y divide-borda rounded-dm border border-borda"
              role="listbox"
              aria-labelledby="incluir-sem-card"
            >
              {semCard.map((p) => {
                const selecionado =
                  escolhido?.tipo === 'sem_card' && escolhido.linha.pedido_id === p.pedido_id
                return (
                  <li key={p.pedido_id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selecionado}
                      onClick={() => setEscolhido(selecionado ? null : { tipo: 'sem_card', linha: p })}
                      className={cn(
                        'flex min-h-toque-lg w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-left transition-colors',
                        selecionado ? 'bg-acao/15' : 'hover:bg-superficie-sutil',
                      )}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="font-semibold text-texto tabular-nums">
                          Pedido {p.numero}
                          {selecionado && (
                            <span className="ml-2 text-sm font-medium text-acao-ativa">✓ escolhido</span>
                          )}
                        </span>
                        <span className="line-clamp-1 text-sm text-texto-suave">
                          {p.cliente_nome || 'Sem cliente'}
                        </span>
                      </span>
                      <span className="flex flex-col text-right text-sm text-texto-suave tabular-nums">
                        <span>{formatarData(p.data_pedido)}</span>
                        <span>
                          {p.total_unidades} unidade{p.total_unidades === 1 ? '' : 's'}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <MaisAoRolar
          temMais={consulta.hasNextPage}
          carregando={consulta.isFetchingNextPage}
          aoChegar={() => {
            if (!consulta.isFetchingNextPage) void consulta.fetchNextPage()
          }}
        />

        {erro && (
          <p className="text-sm text-danificado-forte" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
