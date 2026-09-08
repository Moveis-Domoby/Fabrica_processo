import { useState } from 'react'
import { Navigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Ban, CheckCircle2, Eye, Hourglass, Search, Send } from 'lucide-react'
import { BadgeEstado, Botao, Campo, Modal, Paginacao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { unidadesDoPedido } from '@/kanban/api'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { pedidoCancelado } from '@/kanban/situacao'
import { useAcessoLogistica } from '@/logistica/acesso'
import { lancarParaRotas, listarPedidosAguardo } from '@/logistica/api'
import type { PedidoAguardo } from '@/logistica/api'

const POR_PAGINA = 20
const ATUALIZA_A_CADA = 30_000

function formatarData(iso: string | null): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '—'
}

/**
 * Logística → Pedidos em aguardo (SESSAO-15 / D-38 / D-45): a sala de espera.
 * Unidade "pronta" = chegou em ESTOQUE ou ROTAS. Quando TODAS as unidades do
 * pedido estão prontas, o pedido fica em destaque e pode ser LANÇADO para as
 * ROTAS — só o lançado aparece lá. Lançar move as unidades do ESTOQUE para o
 * setor ROTAS de verdade (evento normal de movimentação).
 */
export function PedidosAguardo() {
  const { perfil, semAcesso, tenhoAcesso } = useAcessoLogistica()
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
    enabled: tenhoAcesso,
    refetchInterval: ATUALIZA_A_CADA,
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
          Unidades prontas esperando o pedido ficar completo. Pedido completo ganha destaque e o
          botão de lançar para as ROTAS — só o que for lançado aparece lá.
        </p>
      </div>

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
          primeira unidade dele chega no fim de linha.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {linhas.map((linha) => {
          const progresso =
            linha.total_unidades > 0
              ? Math.round((linha.unidades_prontas / linha.total_unidades) * 100)
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
                  {linha.cliente_nome || 'Sem cliente'} · previsão {formatarData(linha.data_prevista)}
                  {linha.unidades_liberadas < linha.total_unidades && (
                    <> · {linha.total_unidades - linha.unidades_liberadas} ainda no PCP</>
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
                <Botao variante="secundaria" icone={<Eye />} onClick={() => setPedidoAberto(linha)}>
                  Ver unidades
                </Botao>
                <span className="ml-auto">
                  {linha.completo &&
                    (confirmando ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-texto-suave">
                          Lançar o pedido inteiro para as ROTAS?
                        </span>
                        <Botao
                          tamanho="sm"
                          carregando={lancarMutacao.isPending}
                          onClick={() => lancarMutacao.mutate(linha)}
                        >
                          Sim, lançar
                        </Botao>
                        <Botao variante="fantasma" tamanho="sm" onClick={() => setLancando(null)}>
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
