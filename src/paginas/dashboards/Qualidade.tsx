import { useMemo } from 'react'
import { Navigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, CircleX } from 'lucide-react'
import { Tabela } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarSetores } from '@/kanban/api'
import { formatarDuracaoMs } from '@/kanban/tempo'
import { dashDanificadosAbertos, dashQualidade } from '@/dashboards/api'
import type { PeriodoDash } from '@/dashboards/api'
import { msDeIntervalo } from '@/dashboards/intervalo'
import { usePainelDash } from '@/dashboards/painel'
import { Heroi } from '@/dashboards/componentes/Heroi'
import { Visualizacoes } from '@/dashboards/componentes/Visualizacoes'
import { FiltroPill, FiltroSetor } from '@/dashboards/componentes/Filtros'
import { OPCOES_PERIODO } from '@/dashboards/opcoes'

const pct = (parte: number, todo: number) =>
  todo > 0 ? `${((parte / todo) * 100).toFixed(1).replace('.', ',')}%` : '—'

/**
 * Qualidade (SESSAO-16/D-42, mockup 04): como as peças saem de cada setor —
 * barras 100% com os 3 estados da D-09 (verde/laranja/vermelho são EXCLUSIVOS
 * da qualidade), o herói "% saíram perfeitas" e os danificados em aberto.
 * Estado nunca só por cor (M-12): ícone + rótulo sempre juntos.
 */
export function Qualidade() {
  const { perfil, ehLider, carregando } = useSessao()
  const { config, periodo, visualizacoes, selecionada, mudar, aplicarVisualizacao } =
    usePainelDash('qualidade')

  const souAdmin = perfil?.papel === 'admin'

  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })
  const { data: qualidade = [] } = useQuery({
    queryKey: ['dash', 'qualidade', periodo],
    queryFn: () => dashQualidade(periodo),
  })
  // O período imediatamente anterior, do mesmo tamanho — para o "vs" do herói.
  const periodoAnterior: PeriodoDash = useMemo(() => {
    const ate = new Date(periodo.de)
    const de = new Date(ate.getTime() - config.periodoDias * 86_400_000)
    return { de: de.toISOString(), ate: ate.toISOString() }
  }, [periodo, config.periodoDias])
  const { data: qualidadeAnterior = [] } = useQuery({
    queryKey: ['dash', 'qualidade', periodoAnterior],
    queryFn: () => dashQualidade(periodoAnterior),
  })
  const { data: danificadosAbertos = [] } = useQuery({
    queryKey: ['dash', 'danificados-abertos'],
    queryFn: dashDanificadosAbertos,
  })

  const linhas = useMemo(() => {
    const filtradas =
      config.setorId === null ? qualidade : qualidade.filter((q) => q.setor_id === config.setorId)
    return filtradas
      .map((q) => {
        const total = q.entregues_perfeito + q.entregues_atencao + q.entregues_danificado
        return { ...q, total, fracaoPerfeito: total > 0 ? q.entregues_perfeito / total : 0 }
      })
      .filter((q) => q.total > 0)
      .sort((a, b) => b.fracaoPerfeito - a.fracaoPerfeito)
  }, [qualidade, config.setorId])

  const totais = useMemo(() => {
    const somar = (lista: typeof qualidade) =>
      lista.reduce(
        (acc, q) => ({
          perfeito: acc.perfeito + q.entregues_perfeito,
          todos: acc.todos + q.entregues_perfeito + q.entregues_atencao + q.entregues_danificado,
        }),
        { perfeito: 0, todos: 0 },
      )
    const atual = somar(
      config.setorId === null ? qualidade : qualidade.filter((q) => q.setor_id === config.setorId),
    )
    const anterior = somar(
      config.setorId === null
        ? qualidadeAnterior
        : qualidadeAnterior.filter((q) => q.setor_id === config.setorId),
    )
    const pctAtual = atual.todos > 0 ? (atual.perfeito / atual.todos) * 100 : null
    const pctAnterior = anterior.todos > 0 ? (anterior.perfeito / anterior.todos) * 100 : null
    return {
      ...atual,
      pctAtual,
      deltaPp:
        pctAtual !== null && pctAnterior !== null
          ? Math.round((pctAtual - pctAnterior) * 10) / 10
          : null,
    }
  }, [qualidade, qualidadeAnterior, config.setorId])

  if (carregando) return null
  if (!perfil) return null
  if (!souAdmin && !ehLider) return <Navigate to="/" replace />

  const rotuloPeriodo =
    OPCOES_PERIODO.find((o) => o.valor === String(config.periodoDias))?.rotulo ??
    `${config.periodoDias} dias`

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Qualidade nas transições</h1>
        <p className="mt-1 max-w-3xl text-texto-suave">
          A marcação de saída da dupla atestação: quem entrega marca, quem recebe confirma.
          {!souAdmin && ' Você vê os setores em que é líder.'}
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

      <section className="grid items-start gap-4 xl:grid-cols-[2fr_1fr]">
        {/* ---------- como as peças saem de cada setor (100% empilhado) ---------- */}
        <div className="flex flex-col gap-1 rounded-dm-lg border border-borda bg-superficie p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg">Como as peças saem de cada setor</h2>
            <span className="flex flex-wrap items-center gap-3 text-xs text-texto-suave">
              <span className="flex items-center gap-1">
                <CircleCheck aria-hidden className="size-3.5 text-perfeito-forte" /> perfeito
              </span>
              <span className="flex items-center gap-1">
                <CircleAlert aria-hidden className="size-3.5 text-atencao-forte" /> atenção
              </span>
              <span className="flex items-center gap-1">
                <CircleX aria-hidden className="size-3.5 text-danificado-forte" /> danificado
              </span>
            </span>
          </div>
          <p className="text-xs text-texto-fraco">
            marcação de saída · 100% = unidades que saíram do setor em{' '}
            {rotuloPeriodo.toLowerCase()}
          </p>
          {linhas.length === 0 ? (
            <p className="py-6 text-center text-sm text-texto-suave">
              Nenhuma marcação de qualidade neste período.
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-4">
              {linhas.map((q) => (
                <li key={q.setor_id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">{q.setor_nome}</span>
                    <span className="text-sm font-bold text-perfeito-texto tabular-nums">
                      {pct(q.entregues_perfeito, q.total)}
                    </span>
                  </div>
                  <div
                    className="flex h-5 w-full gap-0.5 overflow-hidden rounded-[4px]"
                    title={`${q.setor_nome}: ${q.entregues_perfeito} perfeito · ${q.entregues_atencao} atenção · ${q.entregues_danificado} danificado (${q.total} saídas)`}
                  >
                    {q.entregues_perfeito > 0 && (
                      <div
                        className="h-full bg-perfeito-forte"
                        style={{ width: `${(q.entregues_perfeito / q.total) * 100}%` }}
                      />
                    )}
                    {q.entregues_atencao > 0 && (
                      <div
                        className="h-full bg-atencao-forte"
                        style={{ width: `${(q.entregues_atencao / q.total) * 100}%` }}
                      />
                    )}
                    {q.entregues_danificado > 0 && (
                      <div
                        className="h-full bg-danificado-forte"
                        style={{ width: `${(q.entregues_danificado / q.total) * 100}%` }}
                      />
                    )}
                  </div>
                  {(q.entregues_atencao > 0 || q.entregues_danificado > 0) && (
                    <p className="self-end text-xs text-texto-suave tabular-nums">
                      <CircleAlert aria-hidden className="inline size-3 text-atencao-forte" />{' '}
                      {pct(q.entregues_atencao, q.total)} ·{' '}
                      <CircleX aria-hidden className="inline size-3 text-danificado-forte" />{' '}
                      {pct(q.entregues_danificado, q.total)}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* ---------- herói ---------- */}
          <Heroi
            rotulo="Saíram perfeitas"
            icone={<CircleCheck aria-hidden className="size-3.5 text-perfeito-forte" />}
            valor={
              totais.pctAtual !== null ? `${totais.pctAtual.toFixed(1).replace('.', ',')}%` : '—'
            }
            detalhe={
              totais.todos > 0 ? (
                <span className="inline-flex flex-wrap items-center gap-1">
                  das {totais.todos.toLocaleString('pt-BR')} saídas em{' '}
                  {rotuloPeriodo.toLowerCase()}
                  {totais.deltaPp !== null && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5 font-semibold',
                        totais.deltaPp >= 0 ? 'text-perfeito-texto' : 'text-danificado-texto',
                      )}
                    >
                      {totais.deltaPp >= 0 ? (
                        <ArrowUp aria-hidden className="size-3.5" />
                      ) : (
                        <ArrowDown aria-hidden className="size-3.5" />
                      )}
                      {String(Math.abs(totais.deltaPp)).replace('.', ',')} p.p. vs período anterior
                    </span>
                  )}
                </span>
              ) : (
                'nenhuma marcação no período'
              )
            }
          />

          {/* ---------- danificados em aberto ---------- */}
          <div className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4">
            <div>
              <h2 className="flex items-center gap-1.5 text-base font-semibold">
                <CircleX aria-hidden className="size-4 text-danificado-forte" />
                Danificados em aberto
              </h2>
              <p className="text-xs text-texto-fraco">na etapa DANIFICADO agora, por setor</p>
            </div>
            {danificadosAbertos.length === 0 ? (
              <p className="text-sm text-texto-suave">Nenhuma peça danificada em aberto.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {danificadosAbertos.map((d) => (
                  <li
                    key={`${d.setor_id}-${d.item_descricao}`}
                    className="flex items-baseline justify-between gap-3 rounded-dm border-l-4 border-danificado-forte bg-superficie-sutil px-3 py-2"
                    title={
                      d.mais_antigo
                        ? `há mais tempo: ${formatarDuracaoMs(msDeIntervalo(d.mais_antigo))}`
                        : undefined
                    }
                  >
                    <span className="min-w-0 truncate text-sm">
                      <span className="font-semibold">{d.setor_nome}</span> · {d.item_descricao}
                    </span>
                    <span className="text-base font-bold text-danificado-forte tabular-nums">
                      {d.quantidade}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-texto-fraco">
              Resolver ou arquivar vive em Fábrica → Logística → Danificados — aqui é só o
              retrato.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- divergências (RF-85 — quem entrega dano) ---------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Divergências da dupla atestação</h2>
        <Tabela
          legenda="Divergências de parecer por setor no período"
          colunas={[
            { chave: 'setor', cabecalho: 'Setor', celula: (q) => q.setor_nome },
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
              chave: 'pareceres',
              cabecalho: 'Pareceres dados',
              alinhamento: 'direita',
              celula: (q) => <span className="tabular-nums">{q.pareceres_dados}</span>,
              ocultarNoCelular: true,
            },
            {
              chave: 'apontadas',
              cabecalho: 'Divergências apontadas',
              alinhamento: 'direita',
              celula: (q) => <span className="tabular-nums">{q.divergencias_apontadas}</span>,
              ocultarNoCelular: true,
            },
          ]}
          dados={
            config.setorId === null
              ? qualidade
              : qualidade.filter((q) => q.setor_id === config.setorId)
          }
          chaveDe={(q) => q.setor_id}
          tituloCelular={(q) => q.setor_nome}
          vazio="Nenhuma marcação de qualidade neste período."
        />
        <p className="text-xs text-texto-fraco">
          "Divergências contra" = o que este setor entregou e o recebedor enxergou diferente — a
          visão de quem entrega dano que motivou o pedido da equipe.
        </p>
      </section>
    </div>
  )
}
