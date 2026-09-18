import { useMemo, useState } from 'react'
import { Navigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Target } from 'lucide-react'
import { Botao, Paginacao, Tabela, useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarSetores } from '@/kanban/api'
import { formatarDuracaoMs, useAgora } from '@/kanban/tempo'
import { buscarMetasPainel, encerrarMeta } from '@/metas/api'
import type { MetaPainel } from '@/metas/api'
import { CartaoMeta } from '@/metas/CartaoMeta'
import { ModalMeta } from '@/metas/ModalMeta'
import { dashExecucoes, dashTemposPessoa } from '@/dashboards/api'
import { duracaoLegivel, msDeIntervalo } from '@/dashboards/intervalo'
import { usePainelDash } from '@/dashboards/painel'
import { Visualizacoes } from '@/dashboards/componentes/Visualizacoes'
import { FiltroPill, FiltroSetor } from '@/dashboards/componentes/Filtros'
import { OPCOES_PERIODO } from '@/dashboards/opcoes'

const METAS_POR_PAGINA = 10

function quando(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'
}

/**
 * Pessoas (SESSAO-16/D-42, mockup 03): ranking de peças atendidas com o tempo
 * médio por unidade ao lado, o cockpit de metas (o MESMO componente do Meu
 * Painel — D-37) e, no fim, a lista detalhada de execuções — o pedido nº 1 do
 * dono na D-32, que o dono mandou morar aqui (17/09). Alavancagem operacional,
 * sem ranking de bonificação (D-04).
 */
export function Pessoas() {
  const { perfil, ehLider, carregando } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora()
  const { config, periodo, visualizacoes, selecionada, mudar, aplicarVisualizacao } =
    usePainelDash('pessoas')

  const souAdmin = perfil?.papel === 'admin'

  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })
  const { data: pessoas = [] } = useQuery({
    queryKey: ['dash', 'pessoas', periodo, config.setorId],
    queryFn: () => dashTemposPessoa(periodo, config.setorId),
  })

  const ranking = useMemo(
    () =>
      pessoas
        .map((p) => {
          const tempoMs = msDeIntervalo(config.tempo === 'bruto' ? p.tempo_bruto : p.tempo_util)
          return {
            ...p,
            tempoMs,
            mediaMs: p.cards_atendidos > 0 ? tempoMs / p.cards_atendidos : 0,
          }
        })
        .sort((a, b) => b.cards_atendidos - a.cards_atendidos),
    [pessoas, config.tempo],
  )
  const maiorContagem = Math.max(1, ...ranking.map((p) => p.cards_atendidos))

  // ----- cockpit de metas (reusa a S14) -----
  const [paginaMetas, setPaginaMetas] = useState(1)
  const { data: metas = [] } = useQuery({
    queryKey: ['metas', 'painel', paginaMetas],
    queryFn: () =>
      buscarMetasPainel({
        limite: METAS_POR_PAGINA,
        deslocamento: (paginaMetas - 1) * METAS_POR_PAGINA,
      }),
  })
  const totalMetas = metas[0]?.contagem_total ?? 0
  const [modalAberta, setModalAberta] = useState(false)
  const [metaEmEdicao, setMetaEmEdicao] = useState<MetaPainel | null>(null)
  const encerrarMutacao = useMutation({
    mutationFn: (id: number) => encerrarMeta(id),
    onSuccess: async () => {
      notificar({ titulo: 'Meta encerrada', tom: 'perfeito' })
      await clienteQuery.invalidateQueries({ queryKey: ['metas'] })
    },
    onError: (excecao: unknown) =>
      notificar({
        titulo: 'Não deu para encerrar a meta',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  // ----- a lista detalhada (D-32) -----
  const [paginaExecucoes, setPaginaExecucoes] = useState(0)
  const { data: execucoes = [] } = useQuery({
    queryKey: ['dash', 'execucoes', periodo, config.setorId, paginaExecucoes],
    queryFn: () =>
      dashExecucoes({
        periodo,
        setorId: config.setorId,
        limite: 20,
        deslocamento: paginaExecucoes * 20,
      }),
  })

  if (carregando) return null
  if (!perfil) return null
  if (!souAdmin && !ehLider) return <Navigate to="/" replace />

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Pessoas</h1>
        <p className="mt-1 max-w-3xl text-texto-suave">
          Execução é o tempo que tem dono. Aqui é alavancagem operacional — melhorar cada setor
          com a contribuição de cada um.{!souAdmin && ' Você vê os setores em que é líder.'}
        </p>
      </div>

      <Visualizacoes
        usuarioId={perfil.id}
        config={config}
        visualizacoes={visualizacoes}
        selecionadaId={selecionada ? String(selecionada.id) : ''}
        aoAplicar={aplicarVisualizacao}
      />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <FiltroPill
          rotulo="Período"
          opcoes={OPCOES_PERIODO}
          valor={String(config.periodoDias) as (typeof OPCOES_PERIODO)[number]['valor']}
          aoMudar={(v) => mudar({ periodoDias: Number(v) })}
        />
        <FiltroSetor
          opcoes={setores.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
          valor={config.setorId === null ? 'todos' : String(config.setorId)}
          aoMudar={(v) => mudar({ setorId: v === 'todos' ? null : Number(v) })}
        />
      </div>

      <section className="grid items-start gap-4 xl:grid-cols-[3fr_2fr]">
        {/* ---------- ranking com rótulo direto (regra 4 do LEIA-ME) ---------- */}
        <div className="flex flex-col gap-1 rounded-dm-lg border border-borda bg-superficie p-4 sm:p-5">
          <h2 className="text-lg">Peças atendidas por pessoa</h2>
          <p className="text-xs text-texto-fraco">
            execuções no período · à direita, o tempo{' '}
            {config.tempo === 'bruto' ? 'bruto' : 'útil'} médio por peça
          </p>
          {ranking.length === 0 ? (
            <p className="py-6 text-center text-sm text-texto-suave">
              Ninguém executou neste período.
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-3">
              {ranking.map((p) => (
                <li
                  key={p.usuario_id}
                  className="grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-x-3 gap-y-0.5"
                  title={`${p.usuario_nome}: ${p.cards_atendidos} peças em ${p.execucoes} execuções · tempo total ${formatarDuracaoMs(p.tempoMs)}`}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">{p.usuario_nome}</span>
                    <span className="truncate text-xs text-texto-fraco">{p.matricula}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-4 rounded-r-[4px]"
                      style={{
                        width: `${Math.max(2, (p.cards_atendidos / maiorContagem) * 100)}%`,
                        background: 'var(--dm-serie-execucao)',
                      }}
                    />
                    <span className="text-sm font-bold tabular-nums">{p.cards_atendidos}</span>
                  </span>
                  <span className="text-sm text-texto-suave tabular-nums">
                    {p.mediaMs > 0 ? `${formatarDuracaoMs(p.mediaMs)}/un` : '—'}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* ---------- cockpit de metas (mesmo componente do Meu Painel) ---------- */}
        <div className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Target aria-hidden className="size-5 text-texto-suave" />
            <h2 className="text-lg">Metas — cockpit</h2>
            <Botao
              variante="secundaria"
              tamanho="sm"
              icone={<Plus />}
              className="ml-auto"
              onClick={() => {
                setMetaEmEdicao(null)
                setModalAberta(true)
              }}
            >
              Nova meta
            </Botao>
          </div>
          <p className="text-xs text-texto-fraco">barra = feito · traço = alvo até agora</p>
          {metas.length === 0 ? (
            <p className="text-sm text-texto-suave">
              Nenhuma meta ainda. O andamento conta sozinho, do trabalho já registrado.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {metas.map((m) => (
                <CartaoMeta
                  key={m.meta_id}
                  meta={m}
                  agora={agora}
                  podeMexer={souAdmin || m.criada_por_id === perfil.id}
                  aoEditar={() => {
                    setMetaEmEdicao(m)
                    setModalAberta(true)
                  }}
                  aoEncerrar={() => encerrarMutacao.mutate(m.meta_id)}
                />
              ))}
              {totalMetas > METAS_POR_PAGINA && (
                <Paginacao
                  paginaAtual={paginaMetas}
                  totalPaginas={Math.ceil(totalMetas / METAS_POR_PAGINA)}
                  totalItens={totalMetas}
                  porPagina={METAS_POR_PAGINA}
                  aoMudarPagina={setPaginaMetas}
                  className="rounded-dm-lg border border-borda bg-superficie"
                />
              )}
            </div>
          )}
          <p className="text-xs text-texto-fraco">
            No Meu Painel cada pessoa vê as próprias metas, com o índice do dia em tempo real.
          </p>
        </div>
      </section>

      {/* ---------- a lista detalhada de execuções (D-32) ---------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Execuções detalhadas</h2>
        <Tabela
          legenda="Cada execução do período, com quem, onde e por quanto tempo"
          porPagina={20}
          colunas={[
            {
              chave: 'peca',
              cabecalho: 'Peça',
              celula: (e) => (
                <span className="flex flex-col">
                  <span className="line-clamp-1">{e.item_descricao ?? '—'}</span>
                  <span className="text-xs text-texto-fraco tabular-nums">
                    Pedido {e.pedido_numero ?? '—'}
                    {e.indice_unidade !== null && ` · ${e.indice_unidade}/${e.total_unidades}`}
                  </span>
                </span>
              ),
            },
            { chave: 'setor', cabecalho: 'Setor', celula: (e) => e.setor_nome ?? '—' },
            { chave: 'quem', cabecalho: 'Quem', celula: (e) => e.executor_nome ?? '—' },
            {
              chave: 'inicio',
              cabecalho: 'Início',
              celula: (e) => <span className="tabular-nums">{quando(e.iniciou_em)}</span>,
              ocultarNoCelular: true,
            },
            {
              chave: 'fim',
              cabecalho: 'Fim',
              celula: (e) =>
                e.em_andamento ? (
                  <span className="font-medium text-perfeito-texto">em andamento</span>
                ) : (
                  <span className="tabular-nums">{quando(e.finalizou_em)}</span>
                ),
              ocultarNoCelular: true,
            },
            {
              chave: 'util',
              cabecalho: 'Tempo útil',
              alinhamento: 'direita',
              celula: (e) => (
                <span
                  className="font-semibold tabular-nums"
                  title={`bruto: ${duracaoLegivel(e.duracao_bruta)}`}
                >
                  {duracaoLegivel(e.duracao_util)}
                </span>
              ),
            },
          ]}
          dados={execucoes}
          chaveDe={(e) => e.evento_inicio_id}
          tituloCelular={(e) => `${e.item_descricao ?? 'Peça'} · ${e.executor_nome ?? ''}`}
          vazio="Nenhuma execução neste período."
        />
        {/* Paginação do SERVIDOR (a função pagina em 20). */}
        <div className="flex items-center justify-end gap-2">
          <Botao
            variante="secundaria"
            tamanho="sm"
            disabled={paginaExecucoes === 0}
            onClick={() => setPaginaExecucoes((p) => Math.max(0, p - 1))}
          >
            Mais recentes
          </Botao>
          <span className="text-sm text-texto-suave tabular-nums">
            {paginaExecucoes * 20 + 1}–{paginaExecucoes * 20 + execucoes.length}
            {execucoes[0] ? ` de ${execucoes[0].contagem_total}` : ''}
          </span>
          <Botao
            variante="secundaria"
            tamanho="sm"
            disabled={
              execucoes.length < 20 ||
              (execucoes[0] !== undefined &&
                (paginaExecucoes + 1) * 20 >= Number(execucoes[0].contagem_total))
            }
            onClick={() => setPaginaExecucoes((p) => p + 1)}
          >
            Mais antigas
          </Botao>
        </div>
      </section>

      {modalAberta && (
        <ModalMeta
          key={metaEmEdicao?.meta_id ?? 'nova'}
          aberta={modalAberta}
          aoFechar={() => setModalAberta(false)}
          meta={metaEmEdicao}
        />
      )}
    </div>
  )
}
