import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, Maximize, Radio, Trophy, WifiOff } from 'lucide-react'
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
import { useSessao } from '@/autenticacao/sessao-contexto'
import { ehSoTv } from '@/autenticacao/tipos'
import { ouvirCanal } from '@/chat/canais'
import { aplicarTema } from '@/perfil/tema'
import { TooltipGrafico } from '@/dashboards/componentes/TooltipGrafico'
import { buscarModoTv, type RespostaTv } from '@/dashboards/tempos/api'
import {
  decimal,
  diaCurto,
  diaPorExtenso,
  duracao,
  hojeNaFabrica,
  horaNaFabrica,
  msAteMeiaNoite,
} from '@/dashboards/tempos/formato'

const CORES = [
  'var(--dm-serie-1)',
  'var(--dm-serie-2)',
  'var(--dm-serie-3)',
  'var(--dm-serie-4)',
  'var(--dm-serie-5)',
  'var(--dm-serie-6)',
]
/** A cor de cada letra é a mesma na coluna e no gráfico; dupla, outros e sem montador em cinza. */
const corDa = (serie: string, letras: string[]) =>
  serie === 'Outros' || serie === 'Sem montador' || serie.includes(' + ')
    ? 'var(--dm-borda-forte)'
    : CORES[Math.max(letras.indexOf(serie), 0) % CORES.length]
const nomeDa = (serie: string) =>
  serie === 'Outros' || serie === 'Sem montador'
    ? serie
    : serie.includes(' + ')
      ? `Montadores ${serie}`
      : `Montador ${serie}`

/**
 * SESSAO-43 (F3) — O MODO TV: o painel da TV do galpão que o dono já tinha
 * validado (cabeçalho com data e relógio, os 4 números grandes, a coluna dos
 * montadores, os 14 dias e o rodapé), agora com os números certos da 42, o
 * tema da plataforma e SEM NOMES — a porta da TV só devolve LETRAS.
 *
 * Tela cheia, sem menu (exceção à lei de layout, como o tablet). Ao vivo pelo
 * canal do setor; na virada do dia, UMA leitura (o único relógio que busca
 * dado — exceção registrada na Lei, com o porquê); o relógio da tela só
 * redesenha a hora. Nunca sai sozinha (como o tablet — D-189); várias TVs em
 * paralelo, cada aparelho com a sua sessão.
 */
export function ModoTv() {
  const { perfil, sair } = useSessao()
  const navigate = useNavigate()
  const cliente = useQueryClient()
  const [parametros, setParametros] = useSearchParams()
  const setorPedido = Number(parametros.get('setor')) || null
  const [agora, setAgora] = useState(() => Date.now())
  const [aoVivo, setAoVivo] = useState(true)
  const [hoje, setHoje] = useState(hojeNaFabrica())
  const soTv = ehSoTv(perfil)

  const consulta = useQuery({
    queryKey: ['modo-tv', setorPedido, hoje],
    queryFn: () => buscarModoTv(setorPedido),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  const r = consulta.data
  const setorId = r?.setor.id ?? null

  // a conta da TV abre no tema escuro (melhor de longe), se ninguém escolheu outro
  useEffect(() => {
    if (soTv && (!perfil?.tema || perfil.tema === 'claro')) aplicarTema('escuro')
  }, [soTv, perfil?.tema])

  // o relógio da tela: só redesenha a hora (não busca nada)
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // a virada do dia: UMA leitura nova (exceção da Lei §4, registrada)
  useEffect(() => {
    const t = setTimeout(() => setHoje(hojeNaFabrica()), msAteMeiaNoite() + 5_000)
    return () => clearTimeout(t)
  }, [hoje])

  // ao vivo: o banco avisa "mudou" no canal do setor; a TV relê a porta dela
  useEffect(() => {
    if (setorId === null) return
    let espera: ReturnType<typeof setTimeout> | null = null
    let jaConectou = false
    let caiu = false
    const reler = () => {
      if (espera) clearTimeout(espera)
      espera = setTimeout(
        () => void cliente.invalidateQueries({ queryKey: ['modo-tv'] }),
        1_500 + Math.random() * 2_000,
      )
    }
    const parar = ouvirCanal(
      `plt-aviso:setor_${setorId}`,
      (evento) => evento === 'mudou' && reler(),
      (status) => {
        if (status === 'SUBSCRIBED') {
          if (jaConectou && caiu) reler()
          jaConectou = true
          caiu = false
          setAoVivo(true)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          caiu = true
          setAoVivo(false)
        }
      },
    )
    return () => {
      if (espera) clearTimeout(espera)
      parar()
    }
  }, [setorId, cliente])

  // a tela da TV não apaga sozinha (quando o navegador deixa)
  useEffect(() => {
    let trava: { release: () => Promise<void> } | null = null
    const pedir = async () => {
      try {
        const wl = (
          navigator as Navigator & {
            wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> }
          }
        ).wakeLock
        if (wl && document.visibilityState === 'visible') trava = await wl.request('screen')
      } catch {
        // sem permissão: a TV segue, só pode apagar pela configuração do aparelho
      }
    }
    void pedir()
    document.addEventListener('visibilitychange', pedir)
    return () => {
      document.removeEventListener('visibilitychange', pedir)
      void trava?.release()
    }
  }, [])

  const hora = horaNaFabrica(new Date(agora).toISOString())

  return (
    <div className="flex min-h-dvh flex-col gap-[clamp(0.75rem,1.6vw,1.75rem)] bg-fundo p-[clamp(0.75rem,2vw,2.5rem)] text-[clamp(14px,1.2vw,22px)] text-texto">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.8em] font-semibold tracking-wide text-texto-suave uppercase">
            {r ? `${tituloSetor(r.setor.nome)} · Fábrica Domoby` : 'Fábrica Domoby'}
          </p>
          <h1 className="font-marca text-[2em] leading-tight">{diaPorExtenso(hoje)}</h1>
        </div>
        <div className="flex items-center gap-3">
          <ControlesDiscretos
            r={r ?? null}
            soTv={soTv}
            aoSetor={(id) => setParametros({ setor: String(id) }, { replace: true })}
            aoSair={() => {
              if (soTv) void sair()
              else if (window.opener) window.close()
              else navigate('/dashboards/tempos-de-producao')
            }}
          />
          <span className="font-marca text-[3em] leading-none font-semibold tabular-nums">
            {hora}
          </span>
        </div>
      </header>

      {consulta.error ? (
        <p
          role="alert"
          className="rounded-dm-lg border border-borda bg-superficie p-4 text-danificado-forte"
        >
          {consulta.error.message}
        </p>
      ) : !r ? (
        <p role="status" className="text-texto-suave">
          Carregando…
        </p>
      ) : (
        <Painel r={r} />
      )}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-borda pt-3 text-[0.9em] text-texto-suave">
        <span className="flex items-center gap-2">
          <Trophy aria-hidden className="size-[1.1em] shrink-0" />
          {r?.melhor_semana ? (
            <span>
              Melhor da semana:{' '}
              <strong className="text-texto">{nomeDa(r.melhor_semana.letras)}</strong> montou{' '}
              <em className="text-texto not-italic">{r.melhor_semana.modelo}</em> em{' '}
              <strong className="text-texto tabular-nums">
                {duracao(r.melhor_semana.tempo_s)}
              </strong>{' '}
              (padrão {duracao(r.melhor_semana.padrao_s)})
            </span>
          ) : (
            <span>Melhor da semana: ainda sem móvel com padrão (3 montagens ou mais).</span>
          )}
        </span>
        <span className="flex items-center gap-4">
          {r?.dados_ate && (
            <span>
              Dados até <strong className="text-texto">{diaCurto(r.dados_ate)}</strong>
            </span>
          )}
          <span className="flex items-center gap-1.5" role="status">
            {aoVivo ? (
              <Radio aria-hidden className="size-[1em]" />
            ) : (
              <WifiOff aria-hidden className="size-[1em]" />
            )}
            {aoVivo ? 'ao vivo' : 'ao vivo pausado'}
          </span>
        </span>
      </footer>
    </div>
  )
}

function tituloSetor(nome: string) {
  return nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase()
}

/** Os botões da TV ficam apagados (quem olha de longe não precisa deles). */
function ControlesDiscretos({
  r,
  soTv,
  aoSetor,
  aoSair,
}: {
  r: RespostaTv | null
  soTv: boolean
  aoSetor: (id: number) => void
  aoSair: () => void
}) {
  return (
    <div className="flex items-center gap-1 opacity-40 transition-opacity focus-within:opacity-100 hover:opacity-100">
      {r && r.setores.length > 1 && (
        <label className="flex items-center gap-1 text-[0.7em]">
          <span className="sr-only">Setor da TV</span>
          <select
            value={r.setor.id}
            onChange={(e) => aoSetor(Number(e.target.value))}
            className="min-h-toque-md rounded-dm border border-borda-forte bg-superficie px-2 text-texto"
          >
            {r.setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        aria-label="Tela cheia"
        title="Tela cheia"
        onClick={() => {
          if (document.fullscreenElement) void document.exitFullscreen()
          else void document.documentElement.requestFullscreen?.()
        }}
        className="toque-seguro rounded-dm p-2 hover:bg-superficie-sutil"
      >
        <Maximize aria-hidden className="size-5" />
      </button>
      <button
        type="button"
        aria-label={soTv ? 'Sair da conta da TV' : 'Sair do Modo TV'}
        title={soTv ? 'Sair da conta da TV' : 'Sair do Modo TV'}
        onClick={aoSair}
        className="toque-seguro rounded-dm p-2 hover:bg-superficie-sutil"
      >
        <LogOut aria-hidden className="size-5" />
      </button>
    </div>
  )
}

function Painel({ r }: { r: RespostaTv }) {
  const media = r.media_30
  const naMeta = media !== null && r.montados_hoje >= media
  const faltam = media !== null ? Math.max(Math.ceil(media - r.montados_hoje), 0) : null
  const series = r.grafico.series
  const letras = useMemo(
    () =>
      [
        ...new Set([
          ...r.montadores.map((m) => m.letra),
          ...series.filter((s) => !s.includes(' + ') && s !== 'Outros' && s !== 'Sem montador'),
        ]),
      ].sort(),
    [r.montadores, series],
  )
  const dados = useMemo(
    () =>
      r.grafico.dias.map((d) => ({
        rotulo: diaCurto(d.dia),
        dia: d.dia,
        total: d.total,
        topo: 1e-6,
        ...Object.fromEntries(series.map((s) => [s, d.partes[s] ?? 0])),
      })),
    [r.grafico.dias, series],
  )

  return (
    <>
      {r.montados_hoje === 0 && (
        <p className="rounded-dm-lg bg-acao px-4 py-2 font-medium text-acao-texto">
          Sem registros de hoje ainda.
          {r.dados_ate ? ` Último dia com dados: ${diaCurto(r.dados_ate)}.` : ''}
        </p>
      )}

      <section className="grid grid-cols-2 gap-[clamp(0.5rem,1.2vw,1.25rem)] xl:grid-cols-4">
        <Numero
          valor={r.montados_hoje}
          rotulo="montados hoje"
          detalhe={
            media === null
              ? 'sem base de comparação'
              : naMeta
                ? `na meta: a média é ${decimal(media)} por dia`
                : `faltam ${faltam} para a média diária`
          }
        />
        <Numero
          valor={decimal(r.media_30)}
          rotulo="média por dia útil"
          detalhe={`${r.n30} móveis em ${r.dias_uteis_30} dias úteis (30 dias)`}
        />
        <Numero
          valor={r.montados_mes}
          rotulo="montados no mês"
          detalhe={`${decimal(r.media_mes)} por dia útil até hoje`}
        />
        <Numero
          valor={duracao(r.tempo_medio_hoje_s)}
          rotulo="tempo médio hoje"
          detalhe={`mediana dos 30 dias: ${duracao(r.mediana_30_s)}`}
        />
      </section>

      <section className="grid flex-1 gap-[clamp(0.5rem,1.2vw,1.25rem)] lg:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-[clamp(0.4rem,0.8vw,0.9rem)]">
          {r.montadores.length === 0 ? (
            <p className="rounded-dm-lg border border-borda bg-superficie p-4 text-texto-suave">
              Ninguém da equipe do painel montou nos últimos 30 dias.
            </p>
          ) : (
            r.montadores.map((m) => (
              <div
                key={m.letra}
                className="flex items-center gap-4 rounded-dm-lg border border-borda bg-superficie p-[clamp(0.6rem,1vw,1.1rem)]"
                style={{ borderLeft: `10px solid ${corDa(m.letra, letras)}` }}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[1.1em] font-semibold">Montador {m.letra}</span>
                  <span className="text-[0.85em] text-texto-suave">
                    {m.hoje > 0 && m.mediana_hoje_s !== null
                      ? `mediana hoje ${duracao(m.mediana_hoje_s)} · `
                      : ''}
                    ritmo {decimal(m.ritmo)}/dia
                  </span>
                </div>
                <span className="font-marca text-[2.6em] leading-none font-semibold tabular-nums">
                  {m.hoje}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="flex min-h-[18rem] flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-[clamp(0.6rem,1vw,1.1rem)]">
          <h2 className="text-[1em] font-semibold">Móveis montados nos últimos 14 dias</h2>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados} margin={{ top: 28, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="var(--dm-borda)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="rotulo"
                  tick={{ fontSize: 16, fill: 'var(--dm-texto-suave)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 14, fill: 'var(--dm-texto-suave)' }}
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
                        titulo={diaPorExtenso(p.dia)}
                        linhas={[
                          { rotulo: p.total === 1 ? '1 móvel' : `${p.total} móveis`, valor: '' },
                          ...series
                            .map((s) => ({ s, n: Number((p as Record<string, unknown>)[s] ?? 0) }))
                            .filter((x) => x.n > 0)
                            .map((x) => ({
                              cor: corDa(x.s, letras),
                              rotulo: nomeDa(x.s),
                              valor: x.n,
                            })),
                        ]}
                      />
                    )
                  }}
                />
                {/* sem animação: a TV relê a cada móvel que sai — barra crescendo toda vez distrai de longe */}
                {series.map((s) => (
                  <Bar
                    key={s}
                    dataKey={s}
                    stackId="tv"
                    isAnimationActive={false}
                    fill={corDa(s, letras)}
                    stroke="var(--dm-superficie)"
                    strokeWidth={1}
                  />
                ))}
                {/* o total em cima de TODA barra: uma barra invisível de altura ínfima no topo da pilha (a de altura zero não ganha rótulo) */}
                <Bar
                  dataKey="topo"
                  stackId="tv"
                  fill="transparent"
                  legendType="none"
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="total"
                    position="top"
                    formatter={(v) => (Number(v) > 0 ? String(v) : '')}
                    style={{ fill: 'var(--dm-texto)', fontSize: 18, fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {series.length > 0 && (
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8em] text-texto-suave">
              {series.map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-3 rounded-sm"
                    style={{ background: corDa(s, letras) }}
                  />
                  {nomeDa(s)}
                </span>
              ))}
            </p>
          )}
        </div>
      </section>
    </>
  )
}

function Numero({
  valor,
  rotulo,
  detalhe,
}: {
  valor: string | number
  rotulo: string
  detalhe: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-dm-lg border border-borda bg-superficie p-[clamp(0.6rem,1.2vw,1.4rem)]">
      <span className="font-marca text-[3.2em] leading-none font-semibold tabular-nums">
        {valor}
      </span>
      <span className="text-[1em] font-semibold">{rotulo}</span>
      <span className="text-[0.85em] text-texto-suave">{detalhe}</span>
    </div>
  )
}
