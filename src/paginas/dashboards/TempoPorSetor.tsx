import { useMemo } from 'react'
import { Navigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Tabela } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarSetores } from '@/kanban/api'
import { formatarDuracaoMs } from '@/kanban/tempo'
import { dashTemposItem, dashTemposSetor, dashTendenciaSemanas } from '@/dashboards/api'
import { duracaoLegivel, msDeIntervalo } from '@/dashboards/intervalo'
import { usePainelDash } from '@/dashboards/painel'
import { Heroi } from '@/dashboards/componentes/Heroi'
import { TooltipGrafico } from '@/dashboards/componentes/TooltipGrafico'
import { Visualizacoes } from '@/dashboards/componentes/Visualizacoes'
import { FiltroPill, FiltroSetor } from '@/dashboards/componentes/Filtros'
import { OPCOES_PERIODO, OPCOES_TEMPO } from '@/dashboards/opcoes'

/**
 * Tempo por setor (SESSAO-16/D-42, mockup 02) — o TEMPO em 1º lugar (D-32):
 * quanto do tempo é espera (fila do setor) e quanto é trabalho (execução da
 * pessoa) — D-02 — somados no período, ordenado do pior para o melhor.
 * Fila = azul, execução = âmbar: os tokens fixos --dm-serie-fila/execucao
 * (LEIA-ME), que não mudam com o tema.
 */
export function TempoPorSetor() {
  const { perfil, ehLider, carregando } = useSessao()
  const { config, periodo, visualizacoes, selecionada, mudar, aplicarVisualizacao } =
    usePainelDash('tempo-por-setor')

  const souAdmin = perfil?.papel === 'admin'
  const util = config.tempo === 'util'

  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })
  const { data: temposSetor = [] } = useQuery({
    queryKey: ['dash', 'setor', periodo],
    queryFn: () => dashTemposSetor(periodo),
  })
  const { data: itens = [] } = useQuery({
    queryKey: ['dash', 'itens', periodo],
    queryFn: () => dashTemposItem(periodo),
  })
  // A tendência cruza a jornada inteira das unidades — o banco só responde a
  // quem mede a fábrica toda (na prática, admin); vazio = seção some.
  const { data: tendencia = [] } = useQuery({
    queryKey: ['dash', 'tendencia'],
    queryFn: () => dashTendenciaSemanas(6),
  })

  const linhas = useMemo(() => {
    const filtradas =
      config.setorId === null
        ? temposSetor
        : temposSetor.filter((t) => t.setor_id === config.setorId)
    return filtradas
      .map((t) => {
        const fila = msDeIntervalo(util ? t.fila_util : t.fila_bruta)
        const execucao = msDeIntervalo(util ? t.execucao_util : t.execucao_bruta)
        return { ...t, fila, execucao, total: fila + execucao }
      })
      .filter((t) => t.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [temposSetor, config.setorId, util])

  const filaTotal = linhas.reduce((s, l) => s + l.fila, 0)
  const somaTotal = linhas.reduce((s, l) => s + l.total, 0)
  const percentualFila = somaTotal > 0 ? Math.round((filaTotal / somaTotal) * 100) : null

  // O gargalo da semana (mockup 02): a maior fila MÉDIA por unidade finalizada,
  // quando destoa da mediana dos setores que finalizaram algo.
  const gargalo = useMemo(() => {
    const medias = linhas
      .filter((l) => l.finalizadas > 0)
      .map((l) => ({ nome: l.setor_nome, media: l.fila / l.finalizadas }))
      .sort((a, b) => a.media - b.media)
    if (medias.length < 2) return null
    const pior = medias[medias.length - 1]
    const mediana = medias[Math.floor((medias.length - 1) / 2)].media
    if (mediana <= 0 || pior.media < mediana * 1.5) return null
    return { nome: pior.nome, media: pior.media, vezes: pior.media / mediana }
  }, [linhas])

  const semanas = useMemo(
    () =>
      tendencia.map((s, i) => ({
        rotulo: i === tendencia.length - 1 ? 'esta' : `s-${tendencia.length - 1 - i}`,
        horas: msDeIntervalo(s.media_total) / 3_600_000,
        unidades: s.unidades,
      })),
    [tendencia],
  )

  if (carregando) return null
  if (!perfil) return null
  if (!souAdmin && !ehLider) return <Navigate to="/" replace />

  const rotuloPeriodo =
    OPCOES_PERIODO.find((o) => o.valor === String(config.periodoDias))?.rotulo ??
    `${config.periodoDias} dias`

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Tempo por setor</h1>
        <p className="mt-1 max-w-3xl text-texto-suave">
          Fila é do setor, execução é da pessoa (e a soma dos dois é o tempo de produção).
          Duração útil desconta o horário de funcionamento e as pausas do admin.
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

      {/* filtros pill numa linha acima (regra 6 do LEIA-ME) */}
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
        <FiltroPill
          rotulo="Tempo"
          opcoes={OPCOES_TEMPO}
          valor={config.tempo}
          aoMudar={(v) => mudar({ tempo: v })}
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        {/* ---------- fila × execução empilhadas, pior primeiro ---------- */}
        <div className="flex flex-col gap-1 rounded-dm-lg border border-borda bg-superficie p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg">Onde o tempo foi — fila vs execução</h2>
            <span className="flex items-center gap-3 text-xs text-texto-suave">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: 'var(--dm-serie-fila)' }} />
                fila
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: 'var(--dm-serie-execucao)' }} />
                execução
              </span>
            </span>
          </div>
          <p className="text-xs text-texto-fraco">
            soma de {rotuloPeriodo.toLowerCase()}, tempo {util ? 'útil' : 'bruto'} — quanto foi
            espera (fila do setor) e quanto foi trabalho (execução da pessoa)
          </p>
          <div className="mt-2" style={{ height: `${Math.max(linhas.length, 2) * 4 + 3}rem` }}>
            {linhas.length === 0 ? (
              <p className="pt-8 text-center text-sm text-texto-suave">
                Nenhum tempo registrado neste período.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={linhas}
                  layout="vertical"
                  margin={{ top: 4, right: 64, left: 8, bottom: 0 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid stroke="var(--dm-borda)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => formatarDuracaoMs(v)}
                    tick={{ fontSize: 12, fill: 'var(--dm-texto-suave)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="setor_nome"
                    width={130}
                    tick={{ fontSize: 13, fill: 'var(--dm-texto)', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--dm-superficie-sutil)' }}
                    content={({ active, payload, label }) => {
                      const linha = payload?.[0]?.payload as (typeof linhas)[number] | undefined
                      return active && linha ? (
                        <TooltipGrafico
                          titulo={String(label)}
                          linhas={[
                            { cor: 'var(--dm-serie-fila)', rotulo: 'fila (do setor)', valor: formatarDuracaoMs(linha.fila) },
                            { cor: 'var(--dm-serie-execucao)', rotulo: 'execução (das pessoas)', valor: formatarDuracaoMs(linha.execucao) },
                            { rotulo: 'soma', valor: formatarDuracaoMs(linha.total) },
                            { rotulo: 'finalizadas', valor: linha.finalizadas },
                          ]}
                        />
                      ) : null
                    }}
                  />
                  {/* vão de 2px entre segmentos: o contorno na cor da superfície */}
                  <Bar
                    dataKey="fila"
                    stackId="tempo"
                    fill="var(--dm-serie-fila)"
                    stroke="var(--dm-superficie)"
                    strokeWidth={1}
                  />
                  <Bar
                    dataKey="execucao"
                    stackId="tempo"
                    fill="var(--dm-serie-execucao)"
                    stroke="var(--dm-superficie)"
                    strokeWidth={1}
                    radius={[0, 4, 4, 0]}
                  >
                    {/* rótulo direto e seletivo: o total na ponta da barra */}
                    <LabelList
                      dataKey="total"
                      position="right"
                      formatter={(valor) => formatarDuracaoMs(Number(valor))}
                      style={{ fill: 'var(--dm-texto)', fontSize: 13, fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {linhas.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5 text-xs text-texto-fraco">
              {linhas.map((l) => (
                <li key={l.setor_id} className="tabular-nums">
                  <span className="font-medium text-texto-suave">{l.setor_nome}:</span>{' '}
                  {formatarDuracaoMs(l.fila)} fila · {formatarDuracaoMs(l.execucao)} execução ·{' '}
                  {l.finalizadas} finalizada{l.finalizadas === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---------- herói + gargalo + tendência ---------- */}
        <div className="flex flex-col gap-4">
          <Heroi
            rotulo="A fila é"
            valor={percentualFila !== null ? `${percentualFila}%` : '—'}
            detalhe={
              percentualFila !== null
                ? `do tempo ${util ? 'útil' : 'bruto'} de produção em ${rotuloPeriodo.toLowerCase()} — o móvel espera ${percentualFila >= 50 ? 'mais do que é trabalhado' : 'menos do que é trabalhado'}`
                : 'sem tempo registrado no período'
            }
          />
          {gargalo && (
            <div className="rounded-dm-lg border border-atencao-borda bg-atencao-fundo p-4 text-sm text-atencao-texto">
              <p className="flex items-start gap-2">
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong>Gargalo do período: {gargalo.nome}</strong> —{' '}
                  {formatarDuracaoMs(gargalo.media)} de fila média por unidade finalizada,{' '}
                  {gargalo.vezes.toFixed(1).replace('.', ',')}× a mediana dos setores.
                </span>
              </p>
            </div>
          )}
          {semanas.length > 0 && (
            <div className="flex flex-col gap-1 rounded-dm-lg border border-borda bg-superficie p-4">
              <h2 className="text-base font-semibold">Tempo total por unidade — 6 semanas</h2>
              <p className="text-xs text-texto-fraco">
                fila + execução (útil) da jornada inteira, média por unidade concluída na semana
              </p>
              <div className="mt-2 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={semanas} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--dm-borda)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="rotulo"
                      tick={{ fontSize: 11, fill: 'var(--dm-texto-suave)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      width={56}
                      tickFormatter={(v: number) => (v >= 10 ? `${Math.round(v)}h` : `${v.toFixed(1)}h`)}
                      tick={{ fontSize: 11, fill: 'var(--dm-texto-suave)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        const ponto = payload?.[0]?.payload as (typeof semanas)[number] | undefined
                        return active && ponto ? (
                          <TooltipGrafico
                            titulo={`semana ${String(label)}`}
                            linhas={[
                              { cor: 'var(--dm-serie-execucao)', rotulo: 'média por unidade', valor: formatarDuracaoMs(ponto.horas * 3_600_000) },
                              { rotulo: 'unidades concluídas', valor: ponto.unidades },
                            ]}
                          />
                        ) : null
                      }}
                    />
                    <Line
                      dataKey="horas"
                      type="monotone"
                      stroke="var(--dm-serie-execucao)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--dm-serie-execucao)', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------- tempo por item (decisão do dono, 17/09: mora aqui) ---------- */}
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
    </div>
  )
}
