import { useMemo, useState } from 'react'
import { Navigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookmarkPlus, RefreshCw, Trash2 } from 'lucide-react'
import { Botao, Campo, Selecao, Tabela, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarSetores } from '@/kanban/api'
import {
  PAINEL_PADRAO,
  WIDGETS_DISPONIVEIS,
  atualizarVisualizacao,
  dashEstoque,
  dashExecucoes,
  dashQualidade,
  dashTemposItem,
  dashTemposPessoa,
  dashTemposSetor,
  excluirVisualizacao,
  listarVisualizacoes,
  salvarVisualizacao,
} from '@/dashboards/api'
import type { ChaveWidget, ConfiguracaoPainel, PeriodoDash } from '@/dashboards/api'
import { duracaoLegivel, msDeIntervalo } from '@/dashboards/intervalo'

const PERIODOS = [
  { valor: '1', rotulo: 'Hoje (24h)' },
  { valor: '7', rotulo: 'Últimos 7 dias' },
  { valor: '30', rotulo: 'Últimos 30 dias' },
  { valor: '90', rotulo: 'Últimos 90 dias' },
]

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
 * Dashboards (SESSAO-10 / D-32): a colheita do que as sessões 05–07 plantaram,
 * com o TEMPO em primeiro lugar — a lista detalhada de execuções, fila vs
 * execução por setor (D-02), por pessoa e por item; qualidade por setor
 * (RF-85) e tempo parado no estoque (RF-14). Durações "úteis" descontam
 * horário de funcionamento e pausas (D-29).
 *
 * Quem vê: líder (só o próprio setor — o gate vive nas funções do banco) e
 * admin (tudo). Visualizações personalizadas são salvas por usuário (RF-32/33).
 */
export function Dashboards() {
  const { perfil, ehLider, carregando } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const souAdmin = perfil?.papel === 'admin'

  const [config, setConfig] = useState<ConfiguracaoPainel>(PAINEL_PADRAO)
  const [visualizacaoId, setVisualizacaoId] = useState<string>('')
  const [nomeNova, setNomeNova] = useState('')

  // O relógio do painel: recalculado quando o período muda (e no refetch).
  const periodo: PeriodoDash = useMemo(() => {
    const ate = new Date()
    const de = new Date(ate.getTime() - config.periodoDias * 86_400_000)
    return { de: de.toISOString(), ate: ate.toISOString() }
  }, [config.periodoDias])

  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })

  const ativo = (w: ChaveWidget) => config.widgets.includes(w)

  const { data: temposSetor = [] } = useQuery({
    queryKey: ['dash', 'setor', periodo],
    queryFn: () => dashTemposSetor(periodo),
    enabled: ativo('tempos_setor'),
  })
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
    enabled: ativo('execucoes'),
  })
  const { data: pessoas = [] } = useQuery({
    queryKey: ['dash', 'pessoas', periodo, config.setorId],
    queryFn: () => dashTemposPessoa(periodo, config.setorId),
    enabled: ativo('pessoas'),
  })
  const { data: itens = [] } = useQuery({
    queryKey: ['dash', 'itens', periodo],
    queryFn: () => dashTemposItem(periodo),
    enabled: ativo('itens'),
  })
  const { data: qualidade = [] } = useQuery({
    queryKey: ['dash', 'qualidade', periodo],
    queryFn: () => dashQualidade(periodo),
    enabled: ativo('qualidade'),
  })
  const { data: estoque } = useQuery({
    queryKey: ['dash', 'estoque'],
    queryFn: dashEstoque,
    enabled: ativo('estoque'),
  })

  // ----- Visualizações salvas (RF-32/33) -----
  const { data: visualizacoes = [] } = useQuery({
    queryKey: ['visualizacoes', perfil?.id],
    queryFn: () => listarVisualizacoes(perfil!.id),
    enabled: perfil !== null,
  })
  const invalidarVisualizacoes = () =>
    clienteQuery.invalidateQueries({ queryKey: ['visualizacoes'] })

  function aoErro(titulo: string) {
    return (excecao: unknown) =>
      notificar({
        titulo,
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
  }

  const salvarMutacao = useMutation({
    mutationFn: () =>
      salvarVisualizacao({ usuarioId: perfil!.id, nome: nomeNova, configuracao: config }),
    onSuccess: async () => {
      notificar({ titulo: `Visualização "${nomeNova.trim()}" salva`, tom: 'perfeito' })
      setNomeNova('')
      await invalidarVisualizacoes()
    },
    onError: aoErro('Não deu para salvar'),
  })
  const atualizarMutacao = useMutation({
    mutationFn: () => atualizarVisualizacao(Number(visualizacaoId), config),
    onSuccess: async () => {
      notificar({ titulo: 'Visualização atualizada', tom: 'perfeito' })
      await invalidarVisualizacoes()
    },
    onError: aoErro('Não deu para atualizar'),
  })
  const excluirMutacao = useMutation({
    mutationFn: () => excluirVisualizacao(Number(visualizacaoId)),
    onSuccess: async () => {
      notificar({ titulo: 'Visualização excluída', tom: 'perfeito' })
      setVisualizacaoId('')
      await invalidarVisualizacoes()
    },
    onError: aoErro('Não deu para excluir'),
  })

  function aplicarVisualizacao(id: string) {
    setVisualizacaoId(id)
    const escolhida = visualizacoes.find((v) => String(v.id) === id)
    if (escolhida) {
      setConfig({ ...PAINEL_PADRAO, ...escolhida.configuracao })
      setPaginaExecucoes(0)
    }
  }

  if (carregando) return null
  if (!perfil) return null
  // D-32: operador não vê dashboards (a rota já barra; isto acalma URL direta).
  if (!souAdmin && !ehLider) return <Navigate to="/" replace />

  const maiorTotal = Math.max(1, ...temposSetor.map((t) => msDeIntervalo(t.total_util)))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl">Dashboards</h1>
        <p className="mt-1 max-w-3xl text-texto-suave">
          Tempo medido de verdade: fila é do setor, execução é da pessoa. Durações "úteis"
          descontam o horário de funcionamento e as pausas configuradas pelo admin.
          {!souAdmin && ' Você vê os setores em que é líder.'}
        </p>
      </div>

      {/* ---------- Barra do painel: visualizações, período, setor, widgets ---------- */}
      <section className="flex flex-col gap-4 rounded-dm-lg border border-borda bg-superficie p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Selecao
            rotulo="Visualização"
            opcoes={[
              { valor: 'atual', rotulo: 'Painel padrão de fábrica' },
              ...visualizacoes.map((v) => ({ valor: String(v.id), rotulo: v.nome })),
            ]}
            valor={visualizacaoId || 'atual'}
            aoMudar={(v) => {
              if (v === 'atual') {
                setVisualizacaoId('')
                setConfig(PAINEL_PADRAO)
              } else {
                aplicarVisualizacao(v)
              }
            }}
          />
          <Selecao
            rotulo="Período"
            opcoes={PERIODOS}
            valor={String(config.periodoDias)}
            aoMudar={(v) => {
              setConfig((c) => ({ ...c, periodoDias: Number(v) }))
              setPaginaExecucoes(0)
            }}
          />
          <Selecao
            rotulo="Setor (execuções e pessoas)"
            opcoes={[
              { valor: 'todos', rotulo: 'Todos os meus setores' },
              ...setores.map((s) => ({ valor: String(s.id), rotulo: s.nome })),
            ]}
            valor={config.setorId === null ? 'todos' : String(config.setorId)}
            aoMudar={(v) => {
              setConfig((c) => ({ ...c, setorId: v === 'todos' ? null : Number(v) }))
              setPaginaExecucoes(0)
            }}
          />
        </div>

        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="mb-1 w-full text-sm font-medium text-texto">
            O que este painel mostra
          </legend>
          {WIDGETS_DISPONIVEIS.map((w) => (
            <button
              key={w.chave}
              type="button"
              role="checkbox"
              aria-checked={ativo(w.chave)}
              onClick={() =>
                setConfig((c) => ({
                  ...c,
                  widgets: ativo(w.chave)
                    ? c.widgets.filter((x) => x !== w.chave)
                    : [...c.widgets, w.chave],
                }))
              }
              className={cn(
                'min-h-toque-md rounded-dm border px-3 text-sm font-medium transition-colors',
                ativo(w.chave)
                  ? 'border-acao-ativa bg-acao text-acao-texto'
                  : 'border-borda-forte bg-superficie text-texto-suave',
              )}
            >
              {w.rotulo}
            </button>
          ))}
        </fieldset>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="max-w-xs flex-1">
            <Campo
              rotulo="Salvar este painel como…"
              placeholder="ex.: Meu dia a dia"
              value={nomeNova}
              onChange={(e) => setNomeNova(e.target.value)}
            />
          </div>
          <Botao
            variante="secundaria"
            icone={<BookmarkPlus />}
            disabled={!nomeNova.trim()}
            carregando={salvarMutacao.isPending}
            onClick={() => salvarMutacao.mutate()}
          >
            Salvar
          </Botao>
          {visualizacaoId && (
            <>
              <Botao
                variante="secundaria"
                icone={<RefreshCw />}
                carregando={atualizarMutacao.isPending}
                onClick={() => atualizarMutacao.mutate()}
              >
                Atualizar a selecionada
              </Botao>
              <Botao
                variante="fantasma"
                icone={<Trash2 />}
                carregando={excluirMutacao.isPending}
                onClick={() => excluirMutacao.mutate()}
              >
                Excluir
              </Botao>
            </>
          )}
        </div>
      </section>

      {/* ---------- Fila vs execução por setor (D-02) ---------- */}
      {ativo('tempos_setor') && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg">Fila vs execução por setor</h2>
          <Tabela
            legenda="Tempos por setor no período: fila, execução e soma"
            colunas={[
              { chave: 'setor', cabecalho: 'Setor', celula: (t) => t.setor_nome },
              {
                chave: 'fila',
                cabecalho: 'Fila (do setor)',
                alinhamento: 'direita',
                celula: (t) => (
                  <span className="tabular-nums" title={`bruto: ${duracaoLegivel(t.fila_bruta)}`}>
                    {duracaoLegivel(t.fila_util)}
                  </span>
                ),
              },
              {
                chave: 'execucao',
                cabecalho: 'Execução (das pessoas)',
                alinhamento: 'direita',
                celula: (t) => (
                  <span
                    className="tabular-nums"
                    title={`bruto: ${duracaoLegivel(t.execucao_bruta)}`}
                  >
                    {duracaoLegivel(t.execucao_util)}
                  </span>
                ),
              },
              {
                chave: 'total',
                cabecalho: 'Soma',
                alinhamento: 'direita',
                celula: (t) => (
                  <span className="font-semibold tabular-nums">{duracaoLegivel(t.total_util)}</span>
                ),
              },
              {
                chave: 'execucoes',
                cabecalho: 'Execuções',
                alinhamento: 'direita',
                celula: (t) => <span className="tabular-nums">{t.execucoes}</span>,
                ocultarNoCelular: true,
              },
              {
                chave: 'proporcao',
                cabecalho: 'Onde o tempo está',
                larguraClasse: 'w-48',
                celula: (t) => {
                  const fila = msDeIntervalo(t.fila_util)
                  const exec = msDeIntervalo(t.execucao_util)
                  const total = fila + exec
                  return (
                    <div
                      className="flex h-3 w-full overflow-hidden rounded-full bg-superficie-sutil"
                      title={`fila ${duracaoLegivel(t.fila_util)} · execução ${duracaoLegivel(t.execucao_util)}`}
                      style={{ maxWidth: `${Math.max(12, (total / maiorTotal) * 100)}%` }}
                    >
                      {total > 0 && (
                        <>
                          <div
                            className="h-full bg-atencao-forte"
                            style={{ width: `${(fila / total) * 100}%` }}
                          />
                          <div
                            className="h-full bg-perfeito-forte"
                            style={{ width: `${(exec / total) * 100}%` }}
                          />
                        </>
                      )}
                    </div>
                  )
                },
              },
            ]}
            dados={temposSetor}
            chaveDe={(t) => t.setor_id}
            tituloCelular={(t) => t.setor_nome}
            vazio="Nenhum tempo registrado neste período."
          />
          <p className="text-xs text-texto-fraco">
            Barra: <span className="font-medium text-atencao-texto">fila (gargalo do setor)</span> ·{' '}
            <span className="font-medium text-perfeito-texto">execução (trabalho de gente)</span>.
            Passe o mouse para ver o tempo bruto, sem os descontos de horário.
          </p>
        </section>
      )}

      {/* ---------- Execuções detalhadas (o pedido nº 1 do dono) ---------- */}
      {ativo('execucoes') && (
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
      )}

      {/* ---------- Tempo por pessoa ---------- */}
      {ativo('pessoas') && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg">Tempo por pessoa</h2>
          <Tabela
            legenda="Tempo de execução por pessoa no período"
            colunas={[
              {
                chave: 'pessoa',
                cabecalho: 'Pessoa',
                celula: (p) => (
                  <span className="flex flex-col">
                    {p.usuario_nome}
                    <span className="text-xs text-texto-fraco tabular-nums">{p.matricula}</span>
                  </span>
                ),
              },
              {
                chave: 'execucoes',
                cabecalho: 'Execuções',
                alinhamento: 'direita',
                celula: (p) => <span className="tabular-nums">{p.execucoes}</span>,
              },
              {
                chave: 'cards',
                cabecalho: 'Peças',
                alinhamento: 'direita',
                celula: (p) => <span className="tabular-nums">{p.cards_atendidos}</span>,
                ocultarNoCelular: true,
              },
              {
                chave: 'util',
                cabecalho: 'Tempo útil',
                alinhamento: 'direita',
                celula: (p) => (
                  <span
                    className="font-semibold tabular-nums"
                    title={`bruto: ${duracaoLegivel(p.tempo_bruto)}`}
                  >
                    {duracaoLegivel(p.tempo_util)}
                  </span>
                ),
              },
            ]}
            dados={pessoas}
            chaveDe={(p) => p.usuario_id}
            tituloCelular={(p) => p.usuario_nome}
            vazio="Ninguém executou neste período."
          />
        </section>
      )}

      {/* ---------- Tempo por item ---------- */}
      {ativo('itens') && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg">Tempo por item produzido</h2>
          <Tabela
            legenda="Tempo de execução por item no período"
            colunas={[
              {
                chave: 'item',
                cabecalho: 'Item',
                celula: (i) => (
                  <span className="flex flex-col">
                    <span className="line-clamp-1">{i.item_descricao ?? '—'}</span>
                    <span className="text-xs text-texto-fraco tabular-nums">
                      {i.item_codigo ? `Código ${i.item_codigo}` : 'Sem código'}
                    </span>
                  </span>
                ),
              },
              {
                chave: 'unidades',
                cabecalho: 'Unidades',
                alinhamento: 'direita',
                celula: (i) => <span className="tabular-nums">{i.unidades}</span>,
              },
              {
                chave: 'util',
                cabecalho: 'Tempo útil',
                alinhamento: 'direita',
                celula: (i) => <span className="tabular-nums">{duracaoLegivel(i.tempo_util)}</span>,
              },
              {
                chave: 'media',
                cabecalho: 'Média por unidade',
                alinhamento: 'direita',
                celula: (i) => (
                  <span className="font-semibold tabular-nums">
                    {duracaoLegivel(i.media_por_unidade)}
                  </span>
                ),
              },
            ]}
            dados={itens}
            chaveDe={(i) => i.item_codigo ?? 'sem-codigo'}
            tituloCelular={(i) => i.item_descricao ?? 'Item'}
            vazio="Nenhum item executado neste período."
          />
        </section>
      )}

      {/* ---------- Qualidade por setor (RF-85) ---------- */}
      {ativo('qualidade') && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg">Qualidade por setor</h2>
          <Tabela
            legenda="Qualidade nas transições por setor no período"
            colunas={[
              { chave: 'setor', cabecalho: 'Setor', celula: (q) => q.setor_nome },
              {
                chave: 'p',
                cabecalho: '🟢 entregues',
                alinhamento: 'direita',
                celula: (q) => <span className="tabular-nums">{q.entregues_perfeito}</span>,
              },
              {
                chave: 'a',
                cabecalho: '🟡 entregues',
                alinhamento: 'direita',
                celula: (q) => <span className="tabular-nums">{q.entregues_atencao}</span>,
              },
              {
                chave: 'd',
                cabecalho: '🔴 entregues',
                alinhamento: 'direita',
                celula: (q) => <span className="tabular-nums">{q.entregues_danificado}</span>,
              },
              {
                chave: 'contra',
                cabecalho: 'Divergências contra',
                alinhamento: 'direita',
                celula: (q) => (
                  <span
                    className={cn(
                      'tabular-nums',
                      q.divergencias_contra > 0 && 'font-semibold text-atencao-texto',
                    )}
                  >
                    {q.divergencias_contra}
                  </span>
                ),
              },
              {
                chave: 'apontadas',
                cabecalho: 'Divergências apontadas',
                alinhamento: 'direita',
                celula: (q) => <span className="tabular-nums">{q.divergencias_apontadas}</span>,
                ocultarNoCelular: true,
              },
            ]}
            dados={qualidade}
            chaveDe={(q) => q.setor_id}
            tituloCelular={(q) => q.setor_nome}
            vazio="Nenhuma marcação de qualidade neste período."
          />
          <p className="text-xs text-texto-fraco">
            "Divergências contra" = o que este setor entregou e o recebedor enxergou diferente —
            a visão de quem entrega dano que motivou o pedido da equipe.
          </p>
        </section>
      )}

      {/* ---------- Estoque (RF-14) ---------- */}
      {ativo('estoque') && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg">Tempo parado no estoque</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-dm-lg border border-borda bg-superficie p-4">
              <p className="text-sm text-texto-suave">Peças paradas agora</p>
              <p className="text-3xl font-semibold text-texto tabular-nums">
                {estoque?.cards_parados ?? 0}
              </p>
            </div>
            <div className="rounded-dm-lg border border-borda bg-superficie p-4">
              <p className="text-sm text-texto-suave">Tempo médio parado</p>
              <p className="text-3xl font-semibold text-texto tabular-nums">
                {duracaoLegivel(estoque?.tempo_medio)}
              </p>
            </div>
            <div className="rounded-dm-lg border border-borda bg-superficie p-4">
              <p className="text-sm text-texto-suave">Há mais tempo parado</p>
              <p className="text-3xl font-semibold text-texto tabular-nums">
                {duracaoLegivel(estoque?.tempo_maximo)}
              </p>
              {estoque?.mais_antigo_pedido && (
                <p className="text-xs text-texto-fraco tabular-nums">
                  Pedido {estoque.mais_antigo_pedido}
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
