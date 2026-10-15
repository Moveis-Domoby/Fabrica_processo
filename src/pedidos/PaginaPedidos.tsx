import { useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { Ban, CheckSquare, ChevronDown, Inbox, ListChecks, Search } from 'lucide-react'
import { Botao, Campo, Dica } from '@/componentes/ui'
import { MaisAoRolar } from '@/componentes/MaisAoRolar'
import { cn } from '@/lib/cn'
import { useAoVivo } from '@/lib/aoVivo'
import { ehSuperAdmin } from '@/autenticacao/tipos'
import { useDebouncedValue } from '@/comercial/hooks/useDebouncedValue'
import { useAcessoLogistica } from '@/logistica/acesso'
import { corDaSituacao } from '@/kanban/situacao'
import { ROTULO_SITUACAO_PLATAFORMA, textoDoTotal } from '@/kanban/situacaoPlataforma'
import { BarraAjustePedidos, CaixaSelecao } from './AjustePedidos'
import { FichaDoPedido } from './FichaDoPedido'
import { PEDIDOS_POR_PAGINA, listarPedidos } from './api'
import type { PedidoDaLista } from './api'
import { data, diaEHora, moeda } from './formato'

export function TodosOsPedidos() {
  return <PaginaPedidos modo="todos" />
}

export function PedidosCancelados() {
  return <PaginaPedidos modo="cancelados" />
}

/**
 * A ÁREA PEDIDOS (ajustes do dono, 14/10 noite — D-134): "Todos os pedidos"
 * (saiu do PCP) e "Cancelados" (a da Logística veio para cá, com a história
 * inteira da empresa). A lista é leve — o que se lê de relance — e anda por
 * CURSOR, 20 por vez, ao rolar; a busca espera parar de digitar (2 letras).
 * Tocar no pedido abre a ficha ali mesmo (1 requisição) e o resto se revela
 * por botões. Ao vivo pelos avisos do PCP, do aguardo e da ROTAS.
 * `?pedido=13623` abre direto aquele pedido.
 */
function PaginaPedidos({ modo }: { modo: 'todos' | 'cancelados' }) {
  const { perfil, semAcesso } = useAcessoLogistica()
  const cancelados = modo === 'cancelados'
  const [parametros] = useSearchParams()
  const pedidoDoLink = (() => {
    const n = Number(parametros.get('pedido') ?? '')
    return Number.isInteger(n) && n > 0 ? n : null
  })()
  const [busca, setBusca] = useState(pedidoDoLink ? String(pedidoDoLink) : '')
  const buscaAdiada = useDebouncedValue(busca.trim(), 300)
  // Lei de desempenho (§3): busca só com 2 letras ou mais — 1 letra lista tudo.
  const buscaValida = buscaAdiada.length >= 2 ? buscaAdiada : ''
  const [abertos, setAbertos] = useState<Set<number>>(() =>
    pedidoDoLink ? new Set([pedidoDoLink]) : new Set(),
  )

  // SESSAO-30 (D-117): o super admin marca pedidos e ajusta a situação na plataforma.
  const souSuperAdmin = ehSuperAdmin(perfil)
  const [selecionando, setSelecionando] = useState(false)
  const [selecionados, setSelecionados] = useState<Map<number, number>>(() => new Map())

  const consulta = useInfiniteQuery({
    queryKey: ['pedidos-lista', modo, buscaValida],
    queryFn: ({ pageParam }) =>
      listarPedidos({
        busca: buscaValida || undefined,
        antesNumero: pageParam,
        limite: PEDIDOS_POR_PAGINA,
        cancelados,
      }),
    initialPageParam: null as number | null,
    getNextPageParam: (ultima) =>
      ultima.length > 0 && ultima[0].tem_mais ? ultima[ultima.length - 1].numero : undefined,
    placeholderData: keepPreviousData,
    enabled: !semAcesso,
  })
  useAoVivo(['pcp', 'aguardo', 'rotas'], [['pedidos-lista']], !semAcesso)
  const linhas = useMemo(() => consulta.data?.pages.flat() ?? [], [consulta.data])
  const total = consulta.data?.pages[0]?.[0]?.contagem_total ?? null

  if (semAcesso) return <Navigate to="/" replace />
  if (!perfil) return null

  function alternarAberto(numero: number) {
    setAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(numero)) novo.delete(numero)
      else novo.add(numero)
      return novo
    })
  }
  function alternarSelecao(pedidoId: number, numero: number) {
    setSelecionados((atual) => {
      const novo = new Map(atual)
      if (novo.has(pedidoId)) novo.delete(pedidoId)
      else novo.set(pedidoId, numero)
      return novo
    })
  }
  const selecionaveis = linhas.filter((p) => p.card_id !== null)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {/* relative: o balão do "i" ancora nesta linha (ver Dica). */}
        <div className="relative flex items-center gap-1">
          <h1 className="flex items-center gap-2 text-2xl sm:text-3xl">
            {cancelados ? (
              <Ban aria-hidden className="size-7 shrink-0 text-texto-suave" />
            ) : (
              <Inbox aria-hidden className="size-7 shrink-0 text-texto-suave" />
            )}
            {cancelados ? 'Cancelados' : 'Todos os pedidos'}
            {total !== null && (
              <span className="text-lg font-normal text-texto-suave tabular-nums">
                ({textoDoTotal(total)})
              </span>
            )}
          </h1>
          <Dica rotulo={cancelados ? 'Sobre os cancelados' : 'Sobre a lista de pedidos'}>
            <span className="flex flex-col gap-2">
              {cancelados ? (
                <>
                  <span>Todo pedido cancelado no Tiny, da história inteira da empresa.</span>
                  <span>
                    Peça que já estava pronta voltou para o estoque, sem dono; peça que estava na
                    produção segue com a etiqueta &quot;Pedido cancelado&quot; e, concluída, vai
                    para o estoque.
                  </span>
                </>
              ) : (
                <>
                  <span>Todo pedido do Tiny, do mais novo ao mais antigo.</span>
                  <span>
                    Toque no pedido para ver o resumo; os botões revelam itens e pagamento, a
                    produção de cada peça, a entrega com o comprovante e tudo o que o Tiny mandou.
                  </span>
                </>
              )}
            </span>
          </Dica>
        </div>
        {souSuperAdmin && !cancelados && (
          <Botao
            variante={selecionando ? 'primaria' : 'secundaria'}
            icone={<ListChecks />}
            aria-pressed={selecionando}
            onClick={() => {
              setSelecionando((s) => !s)
              setSelecionados(new Map())
            }}
          >
            {selecionando ? 'Sair da seleção' : 'Selecionar pedidos'}
          </Botao>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-md">
          <Campo
            rotulo={cancelados ? 'Buscar cancelado' : 'Buscar pedido'}
            prefixo={<Search />}
            placeholder="Número, cliente ou vendedor"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {selecionando && selecionaveis.length > 0 && (
          <Botao
            variante="fantasma"
            tamanho="sm"
            icone={<CheckSquare />}
            onClick={() =>
              setSelecionados((atual) => {
                const novo = new Map(atual)
                for (const p of selecionaveis) novo.set(p.pedido_id, p.numero)
                return novo
              })
            }
          >
            Marcar os {selecionaveis.length} da tela
          </Botao>
        )}
      </div>

      {consulta.isPending && (
        <ul className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando os pedidos">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="h-[4.5rem] animate-pulse rounded-dm-lg bg-superficie-sutil/60" />
          ))}
        </ul>
      )}
      {consulta.isError && (
        <p className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
          {consulta.error instanceof Error ? consulta.error.message : 'Não deu para carregar.'}
        </p>
      )}
      {!consulta.isPending && !consulta.isError && linhas.length === 0 && (
        <p className="flex items-center gap-2 rounded-dm-lg border border-borda bg-superficie p-4 text-sm text-texto-suave">
          <Inbox aria-hidden className="size-5 shrink-0" />
          {cancelados ? 'Nenhum pedido cancelado' : 'Nenhum pedido'}
          {buscaValida ? ' para esta busca' : ''}.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {linhas.map((p) => (
          <LinhaDoPedido
            key={p.pedido_id}
            pedido={p}
            aberto={abertos.has(p.numero)}
            aoAlternar={() => alternarAberto(p.numero)}
            selecao={
              selecionando && p.card_id !== null
                ? {
                    marcado: selecionados.has(p.pedido_id),
                    aoAlternar: () => alternarSelecao(p.pedido_id, p.numero),
                  }
                : undefined
            }
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

      {souSuperAdmin && selecionando && (
        <BarraAjustePedidos
          selecionados={selecionados}
          aoLimpar={() => setSelecionados(new Map())}
          aoTerminar={() => setSelecionados(new Map())}
        />
      )}
    </div>
  )
}

/** A bolinha de cor da situação do Tiny + o texto (nunca cor sozinha — M-12). */
function SituacaoTiny({ situacao }: { situacao: string | null }) {
  if (!situacao) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-texto-suave">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${corDaSituacao(situacao)}`} />
      <span className="sr-only">No Tiny: </span>
      {situacao}
    </span>
  )
}

/** O que a linha diz do andamento: entregue (dia e hora), cancelado ou as peças prontas. */
function Andamento({ p }: { p: PedidoDaLista }) {
  if (p.entregue_em) {
    return (
      <span className="text-xs text-perfeito-texto">
        Entregue {diaEHora(p.entregue_em)}
        {p.entregue_por ? ` por ${p.entregue_por}` : p.entregue_fonte === 'tiny' ? ' (Tiny)' : ''}
      </span>
    )
  }
  if (p.situacao_plataforma === 'cancelado') {
    return (
      <span className="text-xs text-danificado-texto">
        Cancelado{p.cancelado_em ? ` em ${data(p.cancelado_em)}` : ''}
      </span>
    )
  }
  if (p.entregue_tiny) {
    return <span className="text-xs text-perfeito-texto">Entregue em {p.entregue_tiny} (Tiny)</span>
  }
  if (p.total_unidades > 0) {
    return (
      <span className="text-xs text-texto-suave tabular-nums">
        {p.unidades_prontas}/{p.total_unidades}{' '}
        {p.total_unidades === 1 ? 'peça pronta' : 'peças prontas'}
      </span>
    )
  }
  return <span className="text-xs text-texto-suave">Sem produção</span>
}

function LinhaDoPedido({
  pedido: p,
  aberto,
  aoAlternar,
  selecao,
}: {
  pedido: PedidoDaLista
  aberto: boolean
  aoAlternar: () => void
  selecao?: { marcado: boolean; aoAlternar: () => void }
}) {
  return (
    <li
      className={cn(
        'rounded-dm-lg border bg-superficie transition-[border-color,box-shadow] duration-200',
        aberto ? 'border-borda-forte shadow-sm' : 'border-borda',
        selecao?.marcado && 'bg-superficie-sutil',
      )}
    >
      <div className="flex items-start gap-1 pr-1 pl-2 sm:pl-3">
        {selecao && (
          <div className="pt-2.5">
            <CaixaSelecao
              marcado={selecao.marcado}
              rotulo={`Selecionar o pedido ${p.numero}`}
              aoAlternar={selecao.aoAlternar}
            />
          </div>
        )}
        <button
          type="button"
          onClick={aoAlternar}
          aria-expanded={aberto}
          className="flex min-h-toque-md min-w-0 flex-1 flex-col gap-1 rounded-dm py-3 pr-1 pl-1 text-left sm:flex-row sm:items-center sm:gap-4"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-texto tabular-nums">Pedido {p.numero}</span>
              <span className="text-xs text-texto-fraco tabular-nums">{data(p.data_pedido)}</span>
              <SituacaoTiny situacao={p.situacao} />
              <span className="rounded-full border border-borda/80 px-2 py-0.5 text-xs text-texto">
                <span className="sr-only">Na plataforma: </span>
                {ROTULO_SITUACAO_PLATAFORMA[p.situacao_plataforma] ?? p.situacao_plataforma}
              </span>
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-texto-suave">
              <span className="min-w-0 truncate">{p.cliente_nome || 'Sem cliente'}</span>
              {p.vendedor && <span className="text-xs">Vendido por {p.vendedor}</span>}
              {p.marcadores.slice(0, 3).map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-superficie-sutil px-2 py-0.5 text-[0.6875rem] text-texto-suave"
                >
                  {m}
                </span>
              ))}
            </span>
          </span>
          <span className="flex shrink-0 flex-row items-baseline gap-3 sm:flex-col sm:items-end sm:gap-0.5">
            <span className="font-semibold text-texto tabular-nums">{moeda(p.total_pedido)}</span>
            <Andamento p={p} />
          </span>
        </button>
        <button
          type="button"
          onClick={aoAlternar}
          aria-label={aberto ? `Fechar o pedido ${p.numero}` : `Abrir o pedido ${p.numero}`}
          aria-expanded={aberto}
          className="mt-1.5 flex size-11 shrink-0 items-center justify-center rounded-dm text-texto-suave transition-colors hover:bg-superficie-sutil hover:text-texto"
        >
          <ChevronDown
            aria-hidden
            className={cn('size-5 transition-transform duration-200', aberto && 'rotate-180')}
          />
        </button>
      </div>
      {aberto && (
        <div className="border-t border-borda/70 px-3 py-4 transition-[opacity,transform] duration-200 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none sm:px-4">
          <FichaDoPedido pedidoId={p.pedido_id} />
        </div>
      )}
    </li>
  )
}
