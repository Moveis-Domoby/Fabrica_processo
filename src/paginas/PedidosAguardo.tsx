import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ClipboardList,
  Eye,
  Hourglass,
  PackageCheck,
  Search,
  Send,
} from 'lucide-react'
import { Abas, BadgeEstado, Botao, Campo, Modal, Paginacao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { unidadesDoPedido } from '@/kanban/api'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { pedidoCancelado } from '@/kanban/situacao'
import { useAcessoLogistica } from '@/logistica/acesso'
import {
  contagensAguardo,
  lancarParaRotas,
  listarPedidosAguardo,
  listarProdutosReservados,
} from '@/logistica/api'
import type { PedidoAguardo, ProdutoReservado } from '@/logistica/api'
import { useAoVivo } from '@/lib/aoVivo'

const POR_PAGINA = 20

type AbaAguardo = 'pedidos' | 'produtos'

function formatarData(iso: string | null): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '—'
}

/**
 * Logística → Pedidos em aguardo (SESSAO-15 / D-38 / D-45): a sala de espera.
 *
 * SESSAO-24 (dono, 27/09): é o LUGAR da peça pronta de pedido — "os locais
 * finais não são mais estoque e muito menos rota; estoque só fica como local
 * final de peça sem dono". Duas abas sobre a MESMA base no banco (os números
 * batem): "Pedidos" — as peças agrupadas por pedido, com (k/n) e o Lançar para
 * ROTAS do pedido completo; e "Produtos reservados" — peça por peça, com o
 * pedido a que pertence e o tempo em aguardo.
 */
export function PedidosAguardo() {
  const { perfil, semAcesso, tenhoAcesso } = useAcessoLogistica()
  const [parametros, setParametros] = useSearchParams()
  const aba: AbaAguardo = parametros.get('aba') === 'produtos' ? 'produtos' : 'pedidos'

  // Os números das abas: agregado barato do banco (regra 17), da mesma base das listas.
  const { data: contagens } = useQuery({
    queryKey: ['aguardo-contagens'],
    queryFn: contagensAguardo,
    enabled: tenhoAcesso,
  })
  // SESSAO-30 (Lei §4): chegou/saiu peça do aguardo → AO VIVO, sem relógio.
  useAoVivo(
    'aguardo',
    [['aguardo-contagens'], ['pedidos-aguardo'], ['produtos-reservados']],
    tenhoAcesso,
  )

  if (semAcesso) return <Navigate to="/" replace />
  if (!perfil) return null

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-3 text-2xl sm:text-3xl">
          <Hourglass aria-hidden className="size-7 text-texto-suave" />
          Pedidos em aguardo
        </h1>
        <p className="mt-1 max-w-2xl text-texto-suave">
          Aqui fica a peça pronta de pedido, esperando o pedido ficar completo. Pedido completo
          ganha destaque e o botão de lançar para as ROTAS — só o que for lançado aparece lá.
        </p>
      </div>

      <Abas
        rotulo="Visões de Pedidos em aguardo"
        idBase="aguardo"
        abas={[
          {
            valor: 'pedidos',
            rotulo: contagens ? `Pedidos (${contagens.pedidos})` : 'Pedidos',
            icone: <ClipboardList aria-hidden />,
          },
          {
            valor: 'produtos',
            rotulo: contagens
              ? `Produtos reservados (${contagens.produtos})`
              : 'Produtos reservados',
            icone: <PackageCheck aria-hidden />,
          },
        ]}
        valor={aba}
        aoMudar={(valor) => {
          const novos = new URLSearchParams(parametros)
          if (valor === 'pedidos') novos.delete('aba')
          else novos.set('aba', valor)
          setParametros(novos, { replace: true })
        }}
      />

      <div role="tabpanel" id="aguardo-painel" aria-labelledby={`aguardo-aba-${aba}`}>
        {aba === 'produtos' ? (
          <PainelProdutos ativo={tenhoAcesso} />
        ) : (
          <PainelPedidos ativo={tenhoAcesso} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aba "Pedidos" — as peças prontas agrupadas por pedido (a visão da S15)
// ---------------------------------------------------------------------------

function PainelPedidos({ ativo }: { ativo: boolean }) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora()

  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [pedidoAberto, setPedidoAberto] = useState<PedidoAguardo | null>(null)
  const [lancando, setLancando] = useState<PedidoAguardo | null>(null)

  const { data: linhas = [], isPending } = useQuery({
    queryKey: ['pedidos-aguardo', busca, pagina],
    queryFn: () =>
      listarPedidosAguardo({ busca, limite: POR_PAGINA, deslocamento: (pagina - 1) * POR_PAGINA }),
    enabled: ativo,
    placeholderData: keepPreviousData,
  })
  const total = Number(linhas[0]?.contagem_total ?? 0)

  const { data: unidades = [], isPending: carregandoUnidades } = useQuery({
    queryKey: ['pedido-unidades', pedidoAberto?.pedido_id ?? 0],
    queryFn: () => unidadesDoPedido(pedidoAberto!.pedido_id),
    enabled: pedidoAberto !== null,
  })

  const lancarMutacao = useMutation({
    mutationFn: (pedido: PedidoAguardo) => lancarParaRotas(pedido.card_id),
    onSuccess: async (_dados, pedido) => {
      notificar({ titulo: `Pedido ${pedido.numero} lançado para ROTAS`, tom: 'perfeito' })
      setLancando(null)
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['pedidos-aguardo'] }),
        clienteQuery.invalidateQueries({ queryKey: ['produtos-reservados'] }),
        clienteQuery.invalidateQueries({ queryKey: ['aguardo-contagens'] }),
        clienteQuery.invalidateQueries({ queryKey: ['rotas'] }),
        clienteQuery.invalidateQueries({ queryKey: ['estoque'] }),
        clienteQuery.invalidateQueries({ queryKey: ['programacao'] }),
      ])
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para lançar',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="max-w-md">
        <Campo
          rotulo="Buscar pedido"
          prefixo={<Search />}
          placeholder="Número do pedido ou nome do cliente"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
            setPagina(1)
          }}
        />
      </div>

      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {!isPending && linhas.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nenhum pedido esperando{busca ? ' para esta busca' : ''} — um pedido aparece aqui quando a
          primeira peça dele fica pronta.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {linhas.map((linha) => {
          // D-63: pedido sem nada a produzir (só frete) chega aqui já completo.
          const nadaAProduzir = linha.total_unidades === 0
          const progresso =
            linha.total_unidades > 0
              ? Math.round((linha.unidades_prontas / linha.total_unidades) * 100)
              : linha.completo
                ? 100
                : 0
          const confirmando = lancando?.card_id === linha.card_id
          return (
            <li
              key={linha.card_id}
              className={cn(
                'flex flex-col gap-3 rounded-dm-lg border bg-superficie p-4',
                linha.completo ? 'border-acao-ativa' : 'border-borda',
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-texto tabular-nums">
                    Pedido {linha.numero}
                  </span>
                  {linha.completo ? (
                    <BadgeEstado estado="perfeito" rotulo="Pedido completo" tamanho="sm" />
                  ) : (
                    <span className="rounded-full bg-superficie-sutil px-2.5 py-0.5 text-sm font-medium text-texto-suave tabular-nums">
                      {linha.unidades_prontas} de {linha.total_unidades} prontas
                    </span>
                  )}
                  {nadaAProduzir && (
                    <span className="rounded-full bg-superficie-sutil px-2.5 py-0.5 text-sm font-medium text-texto-suave">
                      Nada a produzir
                    </span>
                  )}
                  {pedidoCancelado(linha.situacao) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-danificado-fundo px-2.5 py-0.5 text-xs font-medium text-danificado-texto">
                      <Ban aria-hidden className="size-3.5" />
                      Cancelado no Tiny
                    </span>
                  )}
                  {linha.alterado_apos_liberacao && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-atencao-fundo px-2.5 py-0.5 text-xs font-medium text-atencao-texto">
                      <AlertTriangle aria-hidden className="size-3.5" />
                      Alterado no Tiny após a liberação
                    </span>
                  )}
                </div>
                <p className="line-clamp-1 text-sm text-texto-suave">
                  {linha.cliente_nome || 'Sem cliente'} · previsão{' '}
                  {formatarData(linha.data_prevista)}
                  {linha.unidades_liberadas < linha.total_unidades && (
                    <> · {linha.total_unidades - linha.unidades_liberadas} ainda no PCP</>
                  )}
                </p>
                {/* D-48: o relógio do aguardo — completo conta para o futuro
                    cálculo de tempo de entrega. */}
                <p className="inline-flex items-center gap-1.5 text-sm text-texto-suave tabular-nums">
                  <Hourglass aria-hidden className="size-4" />
                  {linha.completo && linha.completo_em ? (
                    <>
                      Completo há{' '}
                      <strong className="text-texto">
                        {formatarDuracao(linha.completo_em, agora)}
                      </strong>{' '}
                      aguardando o lançamento
                    </>
                  ) : linha.primeira_pronta_em ? (
                    <>1ª peça pronta há {formatarDuracao(linha.primeira_pronta_em, agora)}</>
                  ) : (
                    <>aguardando a primeira peça pronta</>
                  )}
                </p>
                <div
                  className="mt-1 h-2 w-full overflow-hidden rounded-full bg-superficie-sutil"
                  role="progressbar"
                  aria-valuenow={linha.unidades_prontas}
                  aria-valuemin={0}
                  aria-valuemax={linha.total_unidades}
                  aria-label={`${linha.unidades_prontas} de ${linha.total_unidades} unidades prontas`}
                >
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      linha.completo ? 'bg-perfeito-forte' : 'bg-acao',
                    )}
                    style={{ width: `${progresso}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!nadaAProduzir && (
                  <Botao
                    variante="secundaria"
                    icone={<Eye />}
                    onClick={() => setPedidoAberto(linha)}
                  >
                    Ver unidades
                  </Botao>
                )}
                <span className="ml-auto">
                  {linha.completo &&
                    (confirmando ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-texto-suave">
                          Lançar o pedido inteiro para as ROTAS?
                        </span>
                        <Botao
                          carregando={lancarMutacao.isPending}
                          onClick={() => lancarMutacao.mutate(linha)}
                        >
                          Sim, lançar
                        </Botao>
                        <Botao variante="fantasma" onClick={() => setLancando(null)}>
                          Ainda não
                        </Botao>
                      </span>
                    ) : (
                      <Botao icone={<Send />} onClick={() => setLancando(linha)}>
                        Lançar para ROTAS
                      </Botao>
                    ))}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      {total > POR_PAGINA && (
        <Paginacao
          paginaAtual={pagina}
          totalPaginas={Math.ceil(total / POR_PAGINA)}
          totalItens={total}
          porPagina={POR_PAGINA}
          aoMudarPagina={setPagina}
          className="rounded-dm-lg border border-borda bg-superficie"
        />
      )}

      <Modal
        aberto={pedidoAberto !== null}
        aoFechar={(aberto) => {
          if (!aberto) setPedidoAberto(null)
        }}
        titulo={pedidoAberto ? `Pedido ${pedidoAberto.numero} — unidades` : 'Unidades'}
        descricao={pedidoAberto?.cliente_nome || undefined}
        tamanho="galpao"
        rodape={
          <Botao variante="secundaria" onClick={() => setPedidoAberto(null)}>
            Fechar
          </Botao>
        }
      >
        {carregandoUnidades && <p className="text-sm text-texto-fraco">Carregando…</p>}
        <ul className="flex flex-col divide-y divide-borda rounded-dm border border-borda">
          {unidades.map((u) => (
            <li
              key={u.card_id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5"
            >
              <span className="flex min-w-0 flex-col">
                <span className="line-clamp-1 text-sm text-texto">
                  {u.item_descricao ?? 'Sem descrição'}{' '}
                  <span className="font-medium tabular-nums">
                    ({u.indice_unidade}/{u.total_unidades})
                  </span>
                </span>
                <span className="text-xs text-texto-fraco tabular-nums">
                  {u.setor_nome ?? '—'}
                  {u.etapa_nome ? ` · ${u.etapa_nome}` : ''} · há {formatarDuracao(u.desde, agora)}
                </span>
              </span>
              {u.setor_terminal ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-perfeito-forte">
                  <CheckCircle2 aria-hidden className="size-4" />
                  pronta
                </span>
              ) : (
                <span className="shrink-0 text-sm text-texto-suave">em produção</span>
              )}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aba "Produtos reservados" — peça por peça (a visão plana, a2 do dono)
// ---------------------------------------------------------------------------

function PainelProdutos({ ativo }: { ativo: boolean }) {
  const agora = useAgora()
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)

  const { data: linhas = [], isPending } = useQuery({
    queryKey: ['produtos-reservados', busca, pagina],
    queryFn: () =>
      listarProdutosReservados({
        busca,
        limite: POR_PAGINA,
        deslocamento: (pagina - 1) * POR_PAGINA,
      }),
    enabled: ativo,
    placeholderData: keepPreviousData,
  })
  const total = Number(linhas[0]?.contagem_total ?? 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="max-w-md">
        <Campo
          rotulo="Buscar produto reservado"
          prefixo={<Search />}
          placeholder="Produto, SKU, número do pedido ou cliente"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
            setPagina(1)
          }}
        />
      </div>

      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {!isPending && linhas.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nenhum produto reservado{busca ? ' para esta busca' : ''} — a peça pronta de um pedido
          aparece aqui quando a LIMPEZA E EMBALAGEM conclui a produção.
        </p>
      )}

      <ul className="flex flex-col divide-y divide-borda rounded-dm-lg border border-borda bg-superficie">
        {linhas.map((linha) => (
          <LinhaProduto key={linha.card_id} linha={linha} agora={agora} />
        ))}
      </ul>

      {total > POR_PAGINA && (
        <Paginacao
          paginaAtual={pagina}
          totalPaginas={Math.ceil(total / POR_PAGINA)}
          totalItens={total}
          porPagina={POR_PAGINA}
          aoMudarPagina={setPagina}
          className="rounded-dm-lg border border-borda bg-superficie"
        />
      )}
    </div>
  )
}

function LinhaProduto({ linha, agora }: { linha: ProdutoReservado; agora: number }) {
  return (
    <li className="flex flex-col gap-1.5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm text-texto">
          <span className="font-medium">{linha.item_descricao ?? 'Sem descrição'}</span>
          {linha.indice_unidade !== null && (
            <span className="tabular-nums">
              {' '}
              ({linha.indice_unidade}/{linha.total_unidades})
            </span>
          )}
        </span>
        {/* As duas etiquetas da peça reservada (D-56): SKU + nº do pedido. */}
        <span className="text-xs text-texto-suave tabular-nums">
          {linha.item_codigo ? `SKU ${linha.item_codigo}` : 'sem SKU'} · Pedido {linha.numero}
          {linha.cliente_nome && ` · ${linha.cliente_nome}`}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {linha.pedido_completo && (
            <BadgeEstado estado="perfeito" rotulo="Pedido completo" tamanho="sm" />
          )}
          {linha.veio_do_estoque && (
            <span className="inline-flex items-center gap-1 rounded-full bg-superficie-sutil px-2.5 py-0.5 text-xs font-medium text-texto-suave">
              <PackageCheck aria-hidden className="size-3.5" />
              Veio do estoque
            </span>
          )}
          {pedidoCancelado(linha.situacao) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danificado-fundo px-2.5 py-0.5 text-xs font-medium text-danificado-texto">
              <Ban aria-hidden className="size-3.5" />
              Cancelado no Tiny
            </span>
          )}
          {linha.qualidade_atual && linha.qualidade_atual !== 'perfeito' && (
            <BadgeEstado estado={linha.qualidade_atual} tamanho="sm" />
          )}
        </span>
      </div>
      <span
        className="inline-flex shrink-0 items-center gap-1.5 text-sm text-texto-suave tabular-nums"
        title={
          linha.pronta_em
            ? `Pronta desde ${new Date(linha.pronta_em).toLocaleString('pt-BR')}`
            : undefined
        }
      >
        <Hourglass aria-hidden className="size-4" />
        {linha.pronta_em ? `em aguardo há ${formatarDuracao(linha.pronta_em, agora)}` : '—'}
      </span>
    </li>
  )
}
