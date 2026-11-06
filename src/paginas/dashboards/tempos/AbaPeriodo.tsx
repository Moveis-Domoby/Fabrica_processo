import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Tabela } from '@/componentes/ui'
import { Heroi } from '@/dashboards/componentes/Heroi'
import { TooltipGrafico } from '@/dashboards/componentes/TooltipGrafico'
import { buscarPeriodo, type RespostaPeriodo } from '@/dashboards/tempos/api'
import {
  decimal,
  diaCurto,
  diaPorExtenso,
  duracao,
  horas,
  nomeDaChave,
} from '@/dashboards/tempos/formato'
import type { PropsAba } from '../TemposProducao'
import { Carregando, Cobertura, ErroLeitura, Painel, Vazio } from './comum'

// as séries categóricas da casa (nunca verde/laranja/vermelho — são da qualidade)
const CORES = [
  'var(--dm-serie-1)',
  'var(--dm-serie-2)',
  'var(--dm-serie-3)',
  'var(--dm-serie-4)',
  'var(--dm-serie-5)',
  'var(--dm-serie-6)',
  'var(--dm-serie-fila)',
]
const COR_RESTO = 'var(--dm-borda-forte)'

/**
 * Aba PERÍODO (SESSAO-43 · F1 — absorveu "Tempo por setor"): os números do
 * período, os móveis por dia (por semana acima de 70 dias) empilhados por quem
 * montou, onde vai o tempo do setor (fila × trabalho × parado, e o retrabalho),
 * a tabela por montador e os móveis mais montados.
 */
export function AbaPeriodo({ filtros, aoContador }: PropsAba) {
  const consulta = useQuery({
    queryKey: ['tempos-producao', 'periodo', filtros],
    queryFn: () => buscarPeriodo(filtros),
    staleTime: Infinity,
  })
  const r = consulta.data
  useEffect(() => {
    if (r) aoContador(r.conferir_n)
  }, [r, aoContador])

  if (consulta.isPending) return <Carregando />
  if (consulta.error) return <ErroLeitura erro={consulta.error} />
  if (!r) return null
  return <Conteudo r={r} />
}

function Conteudo({ r }: { r: RespostaPeriodo }) {
  const ehMontagem = /montagem/i.test(r.setor.nome)
  const verbo = ehMontagem ? 'montados' : 'feitos'
  const cor = (chave: string, i: number) =>
    chave === '+' || chave === '' ? COR_RESTO : CORES[i % CORES.length]
  const series = r.grafico.series
  const dados = useMemo(
    () =>
      r.grafico.barras.map((b) => ({
        rotulo: diaCurto(b.balde),
        balde: b.balde,
        total: b.total,
        topo: 1e-6,
        ...Object.fromEntries(series.map((s) => [s.chave || 'sem', b.partes[s.chave] ?? 0])),
      })),
    [r.grafico.barras, series],
  )
  const tempoTotal = r.tempo_setor.fila_s + r.tempo_setor.execucao_s + r.tempo_setor.parado_s

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base">
        De {diaCurto(r.de)} a {diaCurto(r.ate)}
        {r.numeros.n_trello > 0 && (
          <span className="ml-2 text-sm font-normal text-texto-suave">
            · {r.numeros.n_trello} do histórico do Trello
          </span>
        )}
      </h2>
      <section className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
        <Heroi
          rotulo={`Móveis ${verbo}`}
          valor={r.numeros.montados}
          detalhe={r.numeros.conferir > 0 ? `${r.numeros.conferir} para conferir` : undefined}
        />
        <Heroi
          rotulo="Por dia útil"
          valor={decimal(r.numeros.media_dia_util)}
          detalhe={`${r.numeros.dias_uteis} dias úteis com registro (o calendário da fábrica)`}
        />
        <Heroi
          rotulo="Por dia com montagem"
          valor={decimal(r.numeros.media_dia_montagem)}
          detalhe={`${r.numeros.dias_com_montagem} dias com móvel ${verbo.slice(0, -1)}`}
        />
        <Heroi
          rotulo="Tempo total"
          valor={horas(r.numeros.tempo_total_s)}
          detalhe="soma dos tempos válidos"
        />
        <Heroi
          rotulo="Tempo médio por móvel"
          valor={duracao(r.numeros.mediana_s)}
          detalhe={
            r.numeros.media_s !== null
              ? `mediana · a média é ${duracao(r.numeros.media_s)}`
              : 'mediana'
          }
        />
      </section>
      <Cobertura total={r.numeros.cobertura_total} comTempo={r.numeros.cobertura_com_tempo} />

      <Painel
        titulo={`Móveis ${verbo} por ${r.grafico.agrupado === 'semana' ? 'semana' : 'dia'}`}
        dica={
          r.grafico.agrupado === 'semana'
            ? 'Agrupado por semana (a partir da segunda-feira) — o período passa de 70 dias.'
            : 'Um dia por barra; passe o mouse para ver quem montou.'
        }
      >
        {dados.length === 0 ? (
          <Vazio>Nenhum móvel saiu do setor no período.</Vazio>
        ) : (
          <>
            <div className="h-[clamp(14rem,40vh,22rem)]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados} margin={{ top: 18, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="var(--dm-borda)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="rotulo"
                    tick={{ fontSize: 11, fill: 'var(--dm-texto-suave)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: 'var(--dm-texto-suave)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--dm-superficie-sutil)' }}
                    content={({ active, payload }) => {
                      const p = payload?.[0]?.payload as (typeof dados)[number] | undefined
                      if (!active || !p) return null
                      return (
                        <TooltipGrafico
                          titulo={
                            r.grafico.agrupado === 'semana'
                              ? `Semana de ${diaCurto(p.balde)}`
                              : diaPorExtenso(p.balde)
                          }
                          linhas={[
                            { rotulo: p.total === 1 ? '1 móvel' : `${p.total} móveis`, valor: '' },
                            ...series
                              .map((s, i) => ({
                                s,
                                i,
                                n: Number((p as Record<string, unknown>)[s.chave || 'sem'] ?? 0),
                              }))
                              .filter((x) => x.n > 0)
                              .map((x) => ({
                                cor: cor(x.s.chave, x.i),
                                rotulo: nomeDaChave(x.s.chave, r.pessoas),
                                valor: x.n,
                              })),
                          ]}
                        />
                      )
                    }}
                  />
                  {series.map((s, i) => (
                    <Bar
                      key={s.chave || 'sem'}
                      dataKey={s.chave || 'sem'}
                      stackId="m"
                      isAnimationActive={false}
                      fill={cor(s.chave, i)}
                      stroke="var(--dm-superficie)"
                      strokeWidth={1}
                      radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
                    />
                  ))}
                  {/* o total em cima de TODA barra: uma barra invisível de altura ínfima no topo da pilha (a de altura zero não ganha rótulo) */}
                  <Bar
                    dataKey="topo"
                    stackId="m"
                    fill="transparent"
                    legendType="none"
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="total"
                      position="top"
                      formatter={(v) => (Number(v) > 0 ? String(v) : '')}
                      style={{ fill: 'var(--dm-texto)', fontSize: 11, fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-suave">
              {series.map((s, i) => (
                <span key={s.chave || 'sem'} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-sm"
                    style={{ background: cor(s.chave, i) }}
                  />
                  {nomeDaChave(s.chave, r.pessoas)} ({s.n})
                </span>
              ))}
            </p>
          </>
        )}
      </Painel>

      <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <Painel
          titulo="Onde vai o tempo do setor"
          dica="Só os móveis da plataforma (o histórico do Trello não tem a fila)."
        >
          {tempoTotal === 0 ? (
            <Vazio>Sem tempo registrado na plataforma neste período.</Vazio>
          ) : (
            <div className="flex flex-col gap-2">
              <div
                className="flex h-8 overflow-hidden rounded-dm"
                role="img"
                aria-label="Fila, trabalho e parado no setor"
              >
                {[
                  { cor: 'var(--dm-serie-fila)', s: r.tempo_setor.fila_s },
                  { cor: 'var(--dm-serie-execucao)', s: r.tempo_setor.execucao_s },
                  { cor: 'var(--dm-borda-forte)', s: r.tempo_setor.parado_s },
                ].map((p, i) => (
                  <span
                    key={i}
                    style={{ width: `${(100 * p.s) / tempoTotal}%`, background: p.cor }}
                    className="border-r-2 border-superficie last:border-r-0"
                  />
                ))}
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                <li className="flex flex-wrap items-center gap-x-2">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-sm"
                    style={{ background: 'var(--dm-serie-fila)' }}
                  />
                  Fila (esperando alguém pegar):{' '}
                  <strong className="tabular-nums">{horas(r.tempo_setor.fila_s)}</strong>
                  <span className="text-texto-fraco">
                    ({Math.round((100 * r.tempo_setor.fila_s) / tempoTotal)}%)
                  </span>
                </li>
                <li className="flex flex-wrap items-center gap-x-2">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-sm"
                    style={{ background: 'var(--dm-serie-execucao)' }}
                  />
                  Trabalho no móvel:{' '}
                  <strong className="tabular-nums">{horas(r.tempo_setor.execucao_s)}</strong>
                  <span className="text-texto-fraco">
                    ({Math.round((100 * r.tempo_setor.execucao_s) / tempoTotal)}%)
                  </span>
                </li>
                <li className="flex flex-wrap items-center gap-x-2">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-sm"
                    style={{ background: 'var(--dm-borda-forte)' }}
                  />
                  Parado depois de começar:{' '}
                  <strong className="tabular-nums">{horas(r.tempo_setor.parado_s)}</strong>
                </li>
                <li className="text-texto-suave">
                  Retrabalho:{' '}
                  <strong className="text-texto tabular-nums">{r.tempo_setor.retrabalho_n}</strong>{' '}
                  {r.tempo_setor.retrabalho_n === 1 ? 'passagem' : 'passagens'} (
                  {horas(r.tempo_setor.retrabalho_s)}) — fora da média.
                </li>
              </ul>
            </div>
          )}
        </Painel>

        <Painel titulo={`Os móveis mais ${verbo}`}>
          <Tabela
            legenda="Os móveis mais feitos no período"
            porPagina={12}
            dados={r.moveis_top.itens}
            chaveDe={(m) => m.modelo_id ?? 'sem'}
            vazio="Nenhum móvel no período."
            colunas={[
              { chave: 'nome', cabecalho: 'Móvel', celula: (m) => m.nome },
              {
                chave: 'n',
                cabecalho: 'Qtd',
                alinhamento: 'direita',
                celula: (m) => <span className="tabular-nums">{m.n}</span>,
              },
              {
                chave: 'pct',
                cabecalho: '% do total',
                alinhamento: 'direita',
                celula: (m) => <span className="tabular-nums">{decimal(m.pct)}%</span>,
              },
            ]}
          />
          {r.moveis_top.mais_n > 0 && (
            <p className="text-sm text-texto-suave">
              Mais {r.moveis_top.mais_n} modelos na aba Móveis.
            </p>
          )}
        </Painel>
      </div>

      <Painel
        titulo={`Por ${ehMontagem ? 'montador' : 'pessoa'} no período`}
        dica="A dupla aparece como uma linha própria (o tempo do móvel é o da dupla)."
      >
        <Tabela
          legenda="Os números de cada pessoa no período"
          porPagina={20}
          dados={r.por_montador}
          chaveDe={(p) => p.chave || 'sem'}
          tituloCelular={(p) => nomeDaChave(p.chave, r.pessoas)}
          vazio="Ninguém registrado no período."
          colunas={[
            {
              chave: 'quem',
              cabecalho: ehMontagem ? 'Montador' : 'Pessoa',
              ocultarNoCelular: true,
              celula: (p) => nomeDaChave(p.chave, r.pessoas),
            },
            {
              chave: 'moveis',
              cabecalho: 'Móveis',
              alinhamento: 'direita',
              celula: (p) => <span className="tabular-nums">{p.moveis}</span>,
            },
            {
              chave: 'dias',
              cabecalho: 'Dias',
              alinhamento: 'direita',
              celula: (p) => <span className="tabular-nums">{p.dias}</span>,
            },
            {
              chave: 'pordia',
              cabecalho: 'Por dia',
              alinhamento: 'direita',
              celula: (p) => <span className="tabular-nums">{decimal(p.por_dia)}</span>,
            },
            {
              chave: 'mediana',
              cabecalho: 'Mediana',
              alinhamento: 'direita',
              celula: (p) => <span className="tabular-nums">{duracao(p.mediana_s)}</span>,
            },
            {
              chave: 'total',
              cabecalho: 'Tempo total',
              alinhamento: 'direita',
              celula: (p) => <span className="tabular-nums">{horas(p.tempo_total_s)}</span>,
            },
          ]}
        />
      </Painel>
    </div>
  )
}
