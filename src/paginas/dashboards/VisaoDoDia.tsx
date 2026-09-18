import { useEffect, useMemo } from 'react'
import { Navigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowDown, ArrowUp, Clock, Hourglass, Play } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/cn'
import { supabase } from '@/lib/supabase'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { formatarDuracaoMs } from '@/kanban/tempo'
import {
  dashAgora,
  dashDanificadosDia,
  dashDia,
  dashEstoque,
  dashFimDeLinha,
  dashPcpDia,
  dashProducaoHora,
} from '@/dashboards/api'
import { msDeIntervalo } from '@/dashboards/intervalo'
import { usePainelDash } from '@/dashboards/painel'
import { Heroi } from '@/dashboards/componentes/Heroi'
import { TooltipGrafico } from '@/dashboards/componentes/TooltipGrafico'
import { Visualizacoes } from '@/dashboards/componentes/Visualizacoes'

/** A cada quanto tempo o andon se atualiza sozinho (rede de segurança do realtime). */
const ATUALIZA_A_CADA = 60_000

const ROTULO_DESTINO: Record<string, string> = {
  rotas: 'Expedição / ROTAS',
  estoque: 'Estoque',
  danificado: 'Danificado',
}

function esperaLegivel(intervalo: string | null): string {
  const ms = msDeIntervalo(intervalo)
  return ms > 0 ? formatarDuracaoMs(ms) : '—'
}

/**
 * Visão do dia (SESSAO-16/D-42, mockup 01): a tela de andon — números-herói
 * gigantes, tiles por setor com o gargalo gritando, produção por hora e o fim
 * de linha. Candidata a TV do galpão: fonte grande (container query), alto
 * contraste e atualização sozinha (Realtime + polling de 60s).
 *
 * "Concluída" = a unidade CHEGOU ao terminal final (ESTOQUE/ROTAS) — resposta
 * do dono em 17/09. O gate D-32 vive no banco: líder vê só o que mede, e os
 * números de fim de linha só aparecem para quem mede os terminais.
 */
export function VisaoDoDia() {
  const { perfil, ehLider, carregando } = useSessao()
  const clienteQuery = useQueryClient()
  const { config, visualizacoes, selecionada, aplicarVisualizacao } = usePainelDash('visao-do-dia')

  const souAdmin = perfil?.papel === 'admin'

  const { data: agora = [], dataUpdatedAt } = useQuery({
    queryKey: ['dash', 'agora'],
    queryFn: dashAgora,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: pcp } = useQuery({
    queryKey: ['dash', 'pcp-dia'],
    queryFn: dashPcpDia,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: dia } = useQuery({
    queryKey: ['dash', 'dia'],
    queryFn: dashDia,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: porHora = [] } = useQuery({
    queryKey: ['dash', 'producao-hora'],
    queryFn: dashProducaoHora,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: fimDeLinha = [] } = useQuery({
    queryKey: ['dash', 'fim-de-linha'],
    queryFn: dashFimDeLinha,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: danificadosDia = [] } = useQuery({
    queryKey: ['dash', 'danificados-dia'],
    queryFn: dashDanificadosDia,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: estoque } = useQuery({
    queryKey: ['dash', 'estoque'],
    queryFn: dashEstoque,
    refetchInterval: ATUALIZA_A_CADA,
  })

  // Tempo real: qualquer mudança nos cards invalida o retrato (o polling acima
  // continua como rede de segurança — mesmo padrão do tablet/Meu Painel).
  useEffect(() => {
    const canal = supabase
      .channel('dash-visao-do-dia')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plt_cards' }, () => {
        void clienteQuery.invalidateQueries({ queryKey: ['dash'] })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [clienteQuery])

  const total = agora.find((s) => s.setor_id === null)
  const setores = useMemo(() => agora.filter((s) => s.setor_id !== null), [agora])

  // O gargalo grita (mockup 01): o setor com a espera mais antiga, quando ela
  // destoa da mediana dos demais — o rótulo diz o quanto ("N× a mediana").
  const gargalo = useMemo(() => {
    const comEspera = setores
      .map((s) => ({ ...s, esperaMs: msDeIntervalo(s.espera_mais_antiga) }))
      .filter((s) => s.esperaMs > 0)
    if (comEspera.length < 2) return null
    const ordenadas = [...comEspera].sort((a, b) => a.esperaMs - b.esperaMs)
    const pior = ordenadas[ordenadas.length - 1]
    const demais = ordenadas.slice(0, -1)
    const mediana = demais[Math.floor(demais.length / 2)].esperaMs
    if (mediana <= 0 || pior.esperaMs < mediana * 2) return null
    return { setorId: pior.setor_id, vezes: pior.esperaMs / mediana }
  }, [setores])

  const setorMaiorEspera = useMemo(() => {
    let pior: (typeof setores)[number] | null = null
    for (const s of setores) {
      if (msDeIntervalo(s.espera_mais_antiga) > msDeIntervalo(pior?.espera_mais_antiga ?? null))
        pior = s
    }
    return pior
  }, [setores])

  const setoresExecutando = setores.filter((s) => s.em_execucao > 0).length
  const deltaConcluidas =
    dia && dia.media_concluidas_4sem !== null
      ? Math.round((dia.concluidas_dia - dia.media_concluidas_4sem) * 10) / 10
      : null
  const diaDaSemana = new Date().toLocaleDateString('pt-BR', { weekday: 'long' })

  // O gráfico corta as madrugadas vazias: da primeira à última hora com dado
  // (hoje OU na média), com 1h de folga de cada lado.
  const horas = useMemo(() => {
    const comDado = porHora.filter((h) => h.concluidas > 0 || h.media_4sem > 0)
    if (comDado.length === 0) return []
    const primeira = Math.max(0, comDado[0].hora - 1)
    const ultima = Math.min(23, comDado[comDado.length - 1].hora + 1)
    return porHora
      .filter((h) => h.hora >= primeira && h.hora <= ultima)
      .map((h) => ({ ...h, rotulo: `${String(h.hora).padStart(2, '0')}h` }))
  }, [porHora])

  const maiorDestino = Math.max(1, ...fimDeLinha.map((d) => d.quantidade))
  const agoraTexto =
    dataUpdatedAt > 0
      ? new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '—'

  if (carregando) return null
  if (!perfil) return null
  if (!souAdmin && !ehLider) return <Navigate to="/" replace />

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl sm:text-3xl">Visão do dia</h1>
        <p className="text-sm text-texto-suave">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
          {' · '}atualizado às {agoraTexto}
        </p>
      </div>

      <Visualizacoes
        usuarioId={perfil.id}
        config={config}
        visualizacoes={visualizacoes}
        selecionadaId={selecionada ? String(selecionada.id) : ''}
        aoAplicar={aplicarVisualizacao}
      />

      {/* ---------- Os 4 números-herói (regra 1 do LEIA-ME) ---------- */}
      <section
        aria-label="Números do dia"
        className="grid gap-3 sm:gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(14rem, 100%), 1fr))' }}
      >
        {dia && (
          <Heroi
            rotulo="Unidades concluídas hoje"
            valor={dia.concluidas_dia}
            detalhe={
              deltaConcluidas !== null ? (
                <span className="inline-flex items-center gap-1">
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold',
                      deltaConcluidas >= 0
                        ? 'bg-perfeito-fundo text-perfeito-texto'
                        : 'bg-atencao-fundo text-atencao-texto',
                    )}
                  >
                    {deltaConcluidas >= 0 ? (
                      <ArrowUp aria-hidden className="size-3" />
                    ) : (
                      <ArrowDown aria-hidden className="size-3" />
                    )}
                    {deltaConcluidas >= 0 ? '+' : ''}
                    {deltaConcluidas}
                  </span>{' '}
                  vs média das últimas 4 {diaDaSemana}s
                </span>
              ) : (
                'chegaram ao fim de linha (Estoque ou ROTAS)'
              )
            }
          />
        )}
        {total && (
          <Heroi
            rotulo="Em execução agora"
            icone={<Play aria-hidden className="size-3.5" />}
            valor={total.em_execucao}
            detalhe={`em ${total.pessoas_executando} pessoa${total.pessoas_executando === 1 ? '' : 's'} · ${setoresExecutando} setor${setoresExecutando === 1 ? '' : 'es'}`}
          />
        )}
        {total && (
          <Heroi
            rotulo="Na fila agora"
            icone={<Clock aria-hidden className="size-3.5" />}
            valor={total.na_fila}
            detalhe={
              setorMaiorEspera && msDeIntervalo(setorMaiorEspera.espera_mais_antiga) > 0 ? (
                <span className="inline-flex flex-wrap items-center gap-1">
                  <Hourglass aria-hidden className="size-3.5 text-atencao-texto" />
                  <span className="font-semibold text-atencao-texto">
                    {esperaLegivel(setorMaiorEspera.espera_mais_antiga)}
                  </span>
                  a espera mais antiga ({setorMaiorEspera.setor_nome})
                </span>
              ) : (
                'nenhuma peça esperando'
              )
            }
          />
        )}
        {dia && (
          <Heroi
            rotulo="Danificados hoje"
            tom={dia.danificados_dia > 0 ? 'danificado' : 'padrao'}
            valor={dia.danificados_dia}
            detalhe={
              danificadosDia.length > 0
                ? danificadosDia
                    .map((d) => `${d.quantidade} ${d.setor_origem_nome} → ${d.setor_destino_nome}`)
                    .join(' · ')
                : 'nenhuma peça danificada hoje'
            }
          />
        )}
      </section>

      {/* ---------- Tiles por setor, com o gargalo gritando ---------- */}
      <section
        aria-label="Setores agora"
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(11rem, 100%), 1fr))' }}
      >
        {pcp && (
          <div className="num-bloco flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-4">
            <p className="text-sm font-bold">PCP</p>
            <dl className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2 border-b border-borda pb-1.5">
                <dt className="text-sm text-texto-suave">a liberar</dt>
                <dd className="num-tile font-semibold tabular-nums">{pcp.pedidos_a_liberar}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-sm text-texto-suave">liberadas hoje</dt>
                <dd className="num-tile font-semibold tabular-nums">{pcp.unidades_liberadas_dia}</dd>
              </div>
            </dl>
            <p className="mt-auto pt-1 text-xs text-texto-fraco">
              mais antiga: {esperaLegivel(pcp.espera_mais_antiga)}
            </p>
          </div>
        )}
        {setores.map((s) => {
          const ehGargalo = gargalo?.setorId === s.setor_id
          return (
            <div
              key={s.setor_id}
              className={cn(
                'num-bloco relative flex flex-col gap-2 rounded-dm-lg border bg-superficie p-4',
                ehGargalo ? 'border-2 border-atencao-forte' : 'border-borda',
              )}
            >
              {ehGargalo && (
                <span className="absolute -top-3 right-3 inline-flex items-center gap-1 rounded-full bg-atencao-forte px-2 py-0.5 text-xs font-bold text-white">
                  <AlertTriangle aria-hidden className="size-3" /> gargalo
                </span>
              )}
              <p className="text-sm font-bold">{s.setor_nome}</p>
              <dl className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2 border-b border-borda pb-1.5">
                  <dt className="text-sm text-texto-suave">na fila</dt>
                  <dd className="num-tile font-semibold tabular-nums">{s.na_fila}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-sm text-texto-suave">em execução</dt>
                  <dd className="num-tile font-semibold tabular-nums">{s.em_execucao}</dd>
                </div>
              </dl>
              <p
                className={cn(
                  'mt-auto flex items-center gap-1 pt-1 text-xs',
                  ehGargalo ? 'font-semibold text-atencao-texto' : 'text-texto-fraco',
                )}
              >
                {ehGargalo && <Hourglass aria-hidden className="size-3.5" />}
                mais antiga: {esperaLegivel(s.espera_mais_antiga)}
                {ehGargalo && gargalo && ` — ${gargalo.vezes.toFixed(0)}× a mediana`}
              </p>
            </div>
          )
        })}
        {setores.length === 0 && !pcp && (
          <p className="rounded-dm-lg border border-borda bg-superficie p-5 text-sm text-texto-suave">
            Você não mede nenhum setor de produção — os tiles do andon aparecem para líderes
            (do próprio setor) e admins.
          </p>
        )}
      </section>

      {/* ---------- Produção por hora + fim de linha ---------- */}
      {dia && (
        <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-1 rounded-dm-lg border border-borda bg-superficie p-4 sm:p-5">
            <h2 className="text-lg">Unidades concluídas por hora — hoje</h2>
            <p className="text-xs text-texto-fraco">
              barras = hoje · linha tracejada = média das últimas 4 {diaDaSemana}s
            </p>
            <div className="mt-2 h-[clamp(13rem,32vh,20rem)]">
              {horas.length === 0 ? (
                <p className="pt-8 text-center text-sm text-texto-suave">
                  Nenhuma unidade concluída hoje ainda.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={horas} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--dm-borda)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="rotulo"
                      tick={{ fontSize: 12, fill: 'var(--dm-texto-suave)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      width={32}
                      tick={{ fontSize: 12, fill: 'var(--dm-texto-suave)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--dm-superficie-sutil)' }}
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <TooltipGrafico
                            titulo={String(label)}
                            linhas={[
                              {
                                cor: 'var(--dm-serie-execucao)',
                                rotulo: 'hoje',
                                valor: payload.find((p) => p.dataKey === 'concluidas')?.value ?? 0,
                              },
                              {
                                cor: 'var(--dm-texto-fraco)',
                                rotulo: 'média',
                                valor: Number(
                                  payload.find((p) => p.dataKey === 'media_4sem')?.value ?? 0,
                                ).toLocaleString('pt-BR'),
                              },
                            ]}
                          />
                        ) : null
                      }
                    />
                    <Bar
                      dataKey="concluidas"
                      fill="var(--dm-serie-execucao)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                    <Line
                      dataKey="media_4sem"
                      stroke="var(--dm-texto-fraco)"
                      strokeDasharray="6 4"
                      strokeWidth={2}
                      dot={false}
                      activeDot={false}
                      type="monotone"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4 sm:p-5">
            <div>
              <h2 className="text-lg">Fim de linha — hoje</h2>
              <p className="text-xs text-texto-fraco">destino das unidades concluídas</p>
            </div>
            {(['rotas', 'estoque', 'danificado'] as const).map((chave) => {
              const linha = fimDeLinha.find((d) => d.destino === chave)
              const qtd = linha?.quantidade ?? 0
              if (chave === 'danificado' && qtd === 0) return null
              const cor =
                chave === 'rotas'
                  ? 'var(--dm-serie-execucao)'
                  : chave === 'estoque'
                    ? 'var(--dm-serie-fila)'
                    : 'var(--dm-danificado-forte)'
              return (
                <div key={chave} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        chave === 'danificado' && 'text-danificado-texto',
                      )}
                    >
                      → {ROTULO_DESTINO[chave]}
                    </span>
                    <span
                      className={cn(
                        'text-lg font-bold tabular-nums',
                        chave === 'danificado' && 'text-danificado-forte',
                      )}
                    >
                      {qtd}
                    </span>
                  </div>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-superficie-sutil"
                    title={`${ROTULO_DESTINO[chave]}: ${qtd}`}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(qtd / maiorDestino) * 100}%`, background: cor }}
                    />
                  </div>
                </div>
              )
            })}
            <p className="text-sm text-texto-suave">
              Pedidos completos aguardando lançamento para ROTAS:{' '}
              <span className="font-semibold text-texto tabular-nums">
                {dia.aguardando_lancamento}
              </span>
            </p>
            {estoque && (
              <p className="mt-auto border-t border-borda pt-3 text-sm text-texto-suave">
                Paradas no estoque agora:{' '}
                <span className="font-semibold text-texto tabular-nums">
                  {estoque.cards_parados}
                </span>
                {estoque.tempo_medio &&
                  ` · tempo médio ${formatarDuracaoMs(msDeIntervalo(estoque.tempo_medio))}`}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
