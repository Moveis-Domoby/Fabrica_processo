import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Paginacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { formatarDuracaoMs } from '@/kanban/tempo'
import { meuDesempenho, meuTempoDias, meuTempoTarefas } from '@/dashboards/api'
import type { PeriodoDash } from '@/dashboards/api'
import { duracaoLegivel, msDeIntervalo } from '@/dashboards/intervalo'
import { Heroi } from '@/dashboards/componentes/Heroi'
import { TooltipGrafico } from '@/dashboards/componentes/TooltipGrafico'
import { FiltroPill } from '@/dashboards/componentes/Filtros'
import { OPCOES_PERIODO } from '@/dashboards/opcoes'

const TAREFAS_POR_PAGINA = 10

/**
 * Meu desempenho (SESSAO-23) — o painel PRIVADO de cada um: o tempo em
 * afazeres (por dia e por tarefa) e os KPIs pessoais, para a própria pessoa
 * entender onde melhorar. O banco só devolve o dado de quem chama — nem
 * líder, nem admin leem o tempo de afazeres pessoais de ninguém (resposta do
 * dono na demanda). Cores: tokens de série da casa; o âmbar da qualidade
 * jamais vira série (A-08).
 */
export function MeuDesempenho() {
  const { perfil, carregando } = useSessao()
  const [dias, setDias] = useState(7)
  const [paginaTarefas, setPaginaTarefas] = useState(1)

  const periodo: PeriodoDash = useMemo(() => {
    const ate = new Date()
    const de = new Date(ate.getTime() - dias * 86_400_000)
    return { de: de.toISOString(), ate: ate.toISOString() }
  }, [dias])

  const { data: kpis = null } = useQuery({
    queryKey: ['meu-desempenho', 'kpis', perfil?.id, periodo],
    queryFn: () => meuDesempenho(periodo),
    enabled: perfil !== null,
  })
  const { data: porDia = [] } = useQuery({
    queryKey: ['meu-desempenho', 'dias', perfil?.id, periodo],
    queryFn: () => meuTempoDias(periodo),
    enabled: perfil !== null,
  })
  const { data: porTarefa = [] } = useQuery({
    queryKey: ['meu-desempenho', 'tarefas', perfil?.id, periodo, paginaTarefas],
    queryFn: () =>
      meuTempoTarefas({
        periodo,
        limite: TAREFAS_POR_PAGINA,
        deslocamento: (paginaTarefas - 1) * TAREFAS_POR_PAGINA,
      }),
    enabled: perfil !== null,
  })
  const totalTarefas = porTarefa[0]?.contagem_total ?? 0

  const barras = useMemo(
    () =>
      porDia.map((d) => ({
        dia: new Date(`${d.dia}T12:00:00`).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        }),
        pessoal: msDeIntervalo(d.tempo_pessoal),
        delegado: msDeIntervalo(d.tempo_delegado),
        tarefas: d.tarefas,
      })),
    [porDia],
  )

  if (carregando || !perfil) return null

  const rotuloPeriodo =
    OPCOES_PERIODO.find((o) => o.valor === String(dias))?.rotulo ?? `${dias} dias`

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Meu desempenho</h1>
        <p className="mt-1 flex max-w-3xl items-center gap-1.5 text-texto-suave">
          <Lock aria-hidden className="size-4 shrink-0" />
          Só você vê esta página: os números são seus, e o tempo dos seus afazeres pessoais não
          aparece para mais ninguém — nem para a liderança.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <FiltroPill
          rotulo="Período"
          opcoes={OPCOES_PERIODO}
          valor={String(dias) as (typeof OPCOES_PERIODO)[number]['valor']}
          aoMudar={(v) => {
            setDias(Number(v))
            setPaginaTarefas(1)
          }}
        />
      </div>

      {/* ---------- KPIs pessoais ---------- */}
      <section
        aria-label="Meus números"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Heroi
          rotulo="Execuções na produção"
          valor={kpis?.execucoes ?? 0}
          detalhe={`${kpis?.execucoes_finalizadas ?? 0} finalizadas por você · ${kpis?.cards_distintos ?? 0} peça${(kpis?.cards_distintos ?? 0) === 1 ? '' : 's'} diferentes`}
        />
        <Heroi
          rotulo="Tempo executando"
          valor={duracaoLegivel(kpis?.tempo_execucao)}
          detalhe={
            kpis?.media_execucao
              ? `média de ${duracaoLegivel(kpis.media_execucao)} por execução (pausas descontadas)`
              : 'pausas descontadas'
          }
        />
        <Heroi
          rotulo="Tarefas concluídas"
          valor={kpis?.tarefas_concluidas ?? 0}
          detalhe={`e ${duracaoLegivel(kpis?.tempo_afazeres)} de tempo em afazeres com o timer ligado`}
        />
        <Heroi
          rotulo="Pareceres de recebimento"
          valor={kpis?.pareceres_dados ?? 0}
          detalhe="chegadas que você confirmou no período"
        />
      </section>

      {/* ---------- tempo em afazeres por dia ---------- */}
      <section className="flex flex-col gap-1 rounded-dm-lg border border-borda bg-superficie p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">Meu tempo em afazeres — por dia</h2>
          <span className="flex items-center gap-3 text-xs text-texto-suave">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: 'var(--dm-serie-1)' }} />
              meus afazeres
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: 'var(--dm-serie-2)' }} />
              delegados a mim
            </span>
          </span>
        </div>
        <p className="text-xs text-texto-fraco">
          {rotuloPeriodo.toLowerCase()} · só as tarefas em que você ligou o timer, contadas no dia
          em que começaram
        </p>
        <div className="mt-2 h-64">
          {barras.length === 0 ? (
            <p className="pt-10 text-center text-sm text-texto-suave">
              Nenhum tempo de afazer registrado neste período — o timer da tarefa é opcional.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barras} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid stroke="var(--dm-borda)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 12, fill: 'var(--dm-texto-suave)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={64}
                  tickFormatter={(v: number) => formatarDuracaoMs(v)}
                  tick={{ fontSize: 11, fill: 'var(--dm-texto-suave)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--dm-superficie-sutil)' }}
                  content={({ active, payload, label }) => {
                    const ponto = payload?.[0]?.payload as (typeof barras)[number] | undefined
                    return active && ponto ? (
                      <TooltipGrafico
                        titulo={String(label)}
                        linhas={[
                          { cor: 'var(--dm-serie-1)', rotulo: 'meus afazeres', valor: formatarDuracaoMs(ponto.pessoal) },
                          { cor: 'var(--dm-serie-2)', rotulo: 'delegados a mim', valor: formatarDuracaoMs(ponto.delegado) },
                          { rotulo: 'tarefas com timer', valor: ponto.tarefas },
                        ]}
                      />
                    ) : null
                  }}
                />
                <Bar dataKey="pessoal" stackId="tempo" fill="var(--dm-serie-1)" stroke="var(--dm-superficie)" strokeWidth={1} />
                <Bar dataKey="delegado" stackId="tempo" fill="var(--dm-serie-2)" stroke="var(--dm-superficie)" strokeWidth={1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ---------- quebra por tarefa (resposta 4 do dono) ---------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Meu tempo — por tarefa</h2>
        {porTarefa.length === 0 ? (
          <p className="rounded-dm-lg border border-borda bg-superficie p-4 text-sm text-texto-suave">
            Nenhuma tarefa com timer neste período.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie">
              {porTarefa.map((t) => (
                <li
                  key={t.tarefa_id}
                  className="flex min-h-toque-md items-center gap-3 border-b border-borda px-4 py-2 last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-texto">{t.titulo}</span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                      t.pessoal
                        ? 'bg-superficie-sutil text-texto-suave'
                        : 'bg-acao text-acao-texto',
                    )}
                  >
                    {t.pessoal ? 'meu' : 'delegado'}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-texto tabular-nums">
                    {duracaoLegivel(t.duracao)}
                    {t.concluida_em === null && (
                      <span className="ml-1 font-normal text-texto-fraco">(contando)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {totalTarefas > TAREFAS_POR_PAGINA && (
              <Paginacao
                paginaAtual={paginaTarefas}
                totalPaginas={Math.ceil(totalTarefas / TAREFAS_POR_PAGINA)}
                totalItens={totalTarefas}
                porPagina={TAREFAS_POR_PAGINA}
                aoMudarPagina={setPaginaTarefas}
                className="rounded-dm-lg border border-borda bg-superficie"
              />
            )}
          </div>
        )}
      </section>
    </div>
  )
}
