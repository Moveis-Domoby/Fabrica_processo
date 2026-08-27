import { useState } from 'react'
import { Navigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Eye, Search } from 'lucide-react'
import { BadgeEstado, Botao, Campo, Modal, Paginacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarSetores, expedicaoResumo, unidadesDoPedido } from '@/kanban/api'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import type { ExpedicaoLinha } from '@/kanban/tipos'

const POR_PAGINA = 20
const ATUALIZA_A_CADA = 30_000

function formatarData(iso: string | null): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '—'
}

/**
 * Expedição/reagrupamento (D-01/D-13): as unidades se "juntam" de novo no fim
 * de linha — pedido completo = todas as unidades em ESTOQUE ou ROTAS. Quem vê:
 * admin, gente do PCP (que também é a logística — D-22) e dos terminais.
 */
export function Expedicao() {
  const { perfil, vinculos, carregando } = useSessao()
  const agora = useAgora()

  const souAdmin = perfil?.papel === 'admin'
  const { data: setores = [], isPending: carregandoSetores } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
  })
  const setoresComAcesso = new Set(
    setores.filter((s) => s.papel_no_fluxo !== 'producao').map((s) => s.id),
  )
  const tenhoAcesso = souAdmin || vinculos.some((v) => setoresComAcesso.has(v.setor_id))

  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [pedidoAberto, setPedidoAberto] = useState<ExpedicaoLinha | null>(null)

  const { data: linhas = [], isPending } = useQuery({
    queryKey: ['expedicao', busca, pagina],
    queryFn: () =>
      expedicaoResumo({
        busca: busca || undefined,
        limite: POR_PAGINA,
        deslocamento: (pagina - 1) * POR_PAGINA,
      }),
    enabled: tenhoAcesso,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const totalItens = Number(linhas[0]?.contagem_total ?? 0)

  const { data: unidades = [], isPending: carregandoUnidades } = useQuery({
    queryKey: ['pedido-unidades', pedidoAberto?.pedido_id ?? 0],
    queryFn: () => unidadesDoPedido(pedidoAberto!.pedido_id),
    enabled: pedidoAberto !== null,
  })

  if (!carregando && !carregandoSetores && setores.length > 0 && !tenhoAcesso)
    return <Navigate to="/" replace />
  if (!perfil) return null

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Expedição</h1>
        <p className="mt-1 max-w-2xl text-texto-suave">
          O reagrupamento do pedido: completo quando todas as unidades chegam ao fim de linha
          (ESTOQUE ou ROTAS).
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
          Nenhum pedido no kanban{busca ? ' para esta busca' : ' ainda'}.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {linhas.map((linha) => {
          const completo =
            linha.total_unidades > 0 && linha.unidades_no_terminal >= linha.total_unidades
          const progresso =
            linha.total_unidades > 0
              ? Math.round((linha.unidades_no_terminal / linha.total_unidades) * 100)
              : 0
          return (
            <li
              key={linha.pedido_id}
              className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-texto tabular-nums">
                    Pedido {linha.numero}
                  </span>
                  {completo ? (
                    <BadgeEstado estado="perfeito" rotulo="Pedido completo" tamanho="sm" />
                  ) : (
                    <span className="rounded-full bg-superficie-sutil px-2.5 py-0.5 text-sm font-medium text-texto-suave tabular-nums">
                      {linha.unidades_no_terminal} de {linha.total_unidades} no fim de linha
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
                  aria-valuenow={linha.unidades_no_terminal}
                  aria-valuemin={0}
                  aria-valuemax={linha.total_unidades}
                  aria-label={`${linha.unidades_no_terminal} de ${linha.total_unidades} unidades no fim de linha`}
                >
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      completo ? 'bg-perfeito-forte' : 'bg-acao',
                    )}
                    style={{ width: `${progresso}%` }}
                  />
                </div>
              </div>

              <Botao
                variante="secundaria"
                icone={<Eye />}
                onClick={() => setPedidoAberto(linha)}
                className="shrink-0"
              >
                Ver unidades
              </Botao>
            </li>
          )
        })}
      </ul>

      {totalItens > POR_PAGINA && (
        <Paginacao
          paginaAtual={pagina}
          totalPaginas={Math.ceil(totalItens / POR_PAGINA)}
          totalItens={totalItens}
          porPagina={POR_PAGINA}
          aoMudarPagina={setPagina}
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
        {!carregandoUnidades && unidades.length === 0 && (
          <p className="text-sm text-texto-suave">
            Nenhuma unidade liberada ainda — o pedido está inteiro no PCP.
          </p>
        )}
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
              {u.concluido_em ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-perfeito-forte">
                  <CheckCircle2 aria-hidden className="size-4" />
                  no fim de linha
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
