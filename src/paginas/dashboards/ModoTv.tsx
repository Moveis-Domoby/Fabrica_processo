import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Maximize,
  Radio,
  Trophy,
  WifiOff,
} from 'lucide-react'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { ehSoTv } from '@/autenticacao/tipos'
import { ouvirCanal } from '@/chat/canais'
import { aplicarTema } from '@/perfil/tema'
import { Selecao } from '@/componentes/ui'
import { AvisoVersaoNova } from '@/componentes/AvisoVersaoNova'
import { conferirVersao, useRecargaSegura } from '@/lib/versaoNova'
import { TooltipGrafico } from '@/dashboards/componentes/TooltipGrafico'
import { buscarModoTv, type RespostaTv } from '@/dashboards/tempos/api'
import {
  decimal,
  diaCurto,
  diaPorExtenso,
  duracao,
  hojeNaFabrica,
  msAteMeiaNoite,
  somarDias,
} from '@/dashboards/tempos/formato'
import { GraficoMoveis } from '@/dashboards/tempos/GraficoMoveis'
import {
  nomeDaMedida,
  painelDe,
  tempoDaMedida,
  type PainelTempos,
} from '@/dashboards/tempos/painel'

/** O relógio da TV com os segundos (06/11), no fuso da fábrica. */
const FORMATO_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Fortaleza',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/**
 * ↩️ Ajuste do dono (06/11 — "a hora coloque os segundos contando também em
 * tempo real"): o relógio é um pedaço à parte, que redesenha só a si mesmo a
 * cada segundo (o painel e o gráfico não se redesenham junto). Não busca nada.
 */
function RelogioTv() {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    // acerta no começo de cada segundo, para os segundos virarem juntos com o relógio do aparelho
    let t: ReturnType<typeof setTimeout>
    const tic = () => {
      setAgora(Date.now())
      t = setTimeout(tic, 1000 - (Date.now() % 1000))
    }
    t = setTimeout(tic, 1000 - (Date.now() % 1000))
    return () => clearTimeout(t)
  }, [])
  return (
    <span className="font-marca text-[3em] leading-none font-semibold tabular-nums">
      {FORMATO_HORA.format(agora)}
    </span>
  )
}

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
/**
 * "Montador A", "Montadores A + B" — e, SESSAO-47, "Montador A + Outros": a
 * dupla com alguém que não aparece pela letra (sem letra no setor ou desligado
 * na configuração do painel).
 */
const nomeDa = (serie: string) => {
  if (serie === 'Outros' || serie === 'Sem montador') return serie
  const letras = serie.split(' + ').filter((parte) => parte !== 'Outros')
  const comOutros = serie.split(' + ').includes('Outros') ? ' + Outros' : ''
  return `${letras.length > 1 ? 'Montadores' : 'Montador'} ${letras.join(' + ')}${comOutros}`
}

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
 *
 * SESSAO-47 (Bloco C): a TV obedece à configuração do painel, que vem na mesma
 * resposta da porta (`r.painel`) — o tipo do gráfico, o número do tempo médio
 * (mediana ou média), quais blocos aparecem e quem aparece pela letra (isso o
 * banco já resolve: a TV continua sem nome nenhum). Quando o administrador
 * salva, o banco avisa no canal do setor; a TV relê e muda na hora, sem recarregar.
 */
export function ModoTv() {
  const { perfil, sair } = useSessao()
  const navigate = useNavigate()
  const cliente = useQueryClient()
  const [parametros, setParametros] = useSearchParams()
  const setorPedido = Number(parametros.get('setor')) || null
  const [aoVivo, setAoVivo] = useState(true)
  const [hoje, setHoje] = useState(hojeNaFabrica())
  // ↩️ 06/11 ("um botão de alternar entre os dias"): o dia que a TV mostra —
  // null = hoje (fica só na memória: recarregar a TV volta para hoje).
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null)
  const diaVisto = diaEscolhido ?? hoje
  const soTv = ehSoTv(perfil)
  // SESSAO-48 (frente 5): a TV fica dias ligada e ninguém troca de tela nela —
  // a versão nova é conferida quando um fato chega (o aviso do canal, a virada
  // do dia; no máximo a cada 2 min) e a TV se atualiza no momento seguro (sem
  // janela aberta e 1 minuto sem toque); até lá, o aviso discreto.
  const versaoNova = useRecargaSegura()

  const consulta = useQuery({
    queryKey: ['modo-tv', setorPedido, hoje, diaEscolhido],
    queryFn: () => buscarModoTv(setorPedido, diaEscolhido),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    // trocar de dia mantém o painel anterior até o novo chegar (sem piscar)
    placeholderData: (anterior) => anterior,
  })
  const r = consulta.data
  // a configuração do painel (o banco de antes não manda: vale o desenho de sempre)
  const painel = painelDe(r)
  const setorId = r?.setor.id ?? null
  const podeTrocarDia = r?.pode_trocar_dia === true
  const irParaDia = (dia: string) => setDiaEscolhido(dia >= hoje ? null : dia)

  // a conta da TV abre no tema escuro (melhor de longe), se ninguém escolheu outro
  useEffect(() => {
    if (soTv && (!perfil?.tema || perfil.tema === 'claro')) aplicarTema('escuro')
  }, [soTv, perfil?.tema])

  // a virada do dia: UMA leitura nova (exceção da Lei §4, registrada)
  useEffect(() => {
    const t = setTimeout(() => {
      setHoje(hojeNaFabrica())
      conferirVersao()
    }, msAteMeiaNoite() + 5_000)
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
      // SESSAO-48 (frente 5): o fato que chegou também confere a versão (≤ 1 a cada 2 min)
      conferirVersao()
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

  return (
    <div className="flex min-h-dvh flex-col gap-[clamp(0.75rem,1.6vw,1.75rem)] bg-fundo p-[clamp(0.75rem,2vw,2.5rem)] text-[clamp(14px,1.2vw,22px)] text-texto">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.8em] font-semibold tracking-wide text-texto-suave uppercase">
            {r ? `${tituloSetor(r.setor.nome)} · Fábrica Domoby` : 'Fábrica Domoby'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-marca text-[2em] leading-tight">{diaPorExtenso(diaVisto)}</h1>
            {podeTrocarDia && (
              <TrocarDia
                dia={diaVisto}
                eHoje={diaEscolhido === null}
                aoIr={irParaDia}
                aoHoje={() => setDiaEscolhido(null)}
              />
            )}
          </div>
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
          {painel.tv_relogio && <RelogioTv />}
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
        <Painel r={r} eHoje={diaEscolhido === null} painel={painel} />
      )}

      {/* SESSAO-47: cada pedaço do rodapé liga e desliga; sem nenhum, o rodapé some.
          O "ao vivo pausado" é aviso — aparece sempre, mesmo com o selo desligado. */}
      {(painel.tv_melhor_semana || painel.tv_dados_ate || painel.tv_ao_vivo || !aoVivo) && (
        <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-borda pt-3 text-[0.9em] text-texto-suave">
          {painel.tv_melhor_semana && (
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
          )}
          <span className="ml-auto flex items-center gap-4">
            {painel.tv_dados_ate && r?.dados_ate && (
              <span>
                Dados até <strong className="text-texto">{diaCurto(r.dados_ate)}</strong>
              </span>
            )}
            {(painel.tv_ao_vivo || !aoVivo) && (
              <span className="flex items-center gap-1.5" role="status">
                {aoVivo ? (
                  <Radio aria-hidden className="size-[1em]" />
                ) : (
                  <WifiOff aria-hidden className="size-[1em]" />
                )}
                {aoVivo ? 'ao vivo' : 'ao vivo pausado'}
              </span>
            )}
          </span>
        </footer>
      )}
      <AvisoVersaoNova nova={versaoNova} sozinha />
    </div>
  )
}

function tituloSetor(nome: string) {
  return nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase()
}

/**
 * ↩️ 06/11: trocar o dia da TV — anterior · próximo (até hoje) · "Hoje". Discreto
 * como os outros controles (quem olha de longe não precisa deles); fora de hoje,
 * o "Hoje" fica aceso para ninguém esquecer a TV num dia velho.
 */
function TrocarDia({
  dia,
  eHoje,
  aoIr,
  aoHoje,
}: {
  dia: string
  eHoje: boolean
  aoIr: (dia: string) => void
  aoHoje: () => void
}) {
  return (
    <div className="flex items-center gap-1 text-[0.7em]">
      <span className="flex items-center gap-1 opacity-40 transition-opacity focus-within:opacity-100 hover:opacity-100">
        <button
          type="button"
          onClick={() => aoIr(somarDias(dia, -1))}
          aria-label="Dia anterior"
          title="Dia anterior"
          className="toque-seguro inline-flex size-10 items-center justify-center rounded-dm border border-borda bg-superficie hover:bg-superficie-sutil"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => aoIr(somarDias(dia, 1))}
          disabled={eHoje}
          aria-label="Próximo dia"
          title="Próximo dia"
          className="toque-seguro inline-flex size-10 items-center justify-center rounded-dm border border-borda bg-superficie hover:bg-superficie-sutil disabled:opacity-40"
        >
          <ChevronRight aria-hidden className="size-5" />
        </button>
      </span>
      {!eHoje && (
        <button
          type="button"
          onClick={aoHoje}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-dm bg-acao px-3 font-semibold text-acao-texto"
        >
          <CalendarDays aria-hidden className="size-5" />
          Voltar para hoje
        </button>
      )}
    </div>
  )
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
      {/* ↩️ 06/11 ("remova esse modal do navegador, use o nosso padrão"): a
          seleção da casa no lugar da lista nativa do navegador. */}
      {r && r.setores.length > 1 && (
        <div className="w-56 text-[0.7em]">
          <Selecao
            rotulo="Setor da TV"
            classeRotulo="sr-only"
            opcoes={r.setores.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
            valor={String(r.setor.id)}
            aoMudar={(v) => aoSetor(Number(v))}
          />
        </div>
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

function Painel({ r, eHoje, painel }: { r: RespostaTv; eHoje: boolean; painel: PainelTempos }) {
  // ↩️ 06/11: fora de hoje, os textos dizem "no dia" (a TV pode mostrar outro dia)
  const doDia = eHoje ? 'hoje' : 'no dia'
  // SESSAO-47: o número do tempo médio (mediana ou média) e os blocos vêm da configuração do painel
  const medida = painel.medida
  const tempoHoje = tempoDaMedida(medida, {
    mediana_s: r.tempo_medio_hoje_s,
    media_s: r.tempo_media_hoje_s,
  })
  const tempo30 = tempoDaMedida(medida, { mediana_s: r.mediana_30_s, media_s: r.tempo_media_30_s })
  const mostraColuna = painel.tv_montadores
  const mostraGrafico = painel.tv_grafico
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
          {eHoje ? 'Sem registros de hoje ainda.' : 'Sem registros neste dia.'}
          {r.dados_ate ? ` Último dia com dados: ${diaCurto(r.dados_ate)}.` : ''}
        </p>
      )}

      {painel.tv_numeros && (
        <section
          data-bloco="numeros"
          className="grid grid-cols-2 gap-[clamp(0.5rem,1.2vw,1.25rem)] xl:grid-cols-4"
        >
          <Numero
            valor={r.montados_hoje}
            rotulo={`montados ${doDia}`}
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
            detalhe={`${decimal(r.media_mes)} por dia útil até ${eHoje ? 'hoje' : 'o dia'}`}
          />
          <Numero
            valor={duracao(tempoHoje)}
            rotulo={`tempo médio ${doDia}`}
            detalhe={`${nomeDaMedida(medida)} dos 30 dias: ${duracao(tempo30)}`}
          />
        </section>
      )}

      {/* a coluna e o gráfico: com um só ligado, ele ocupa a largura toda (sem buraco) */}
      {(mostraColuna || mostraGrafico) && (
        <section
          className={
            mostraColuna && mostraGrafico
              ? 'grid flex-1 gap-[clamp(0.5rem,1.2vw,1.25rem)] lg:grid-cols-[1fr_2fr]'
              : 'grid flex-1 gap-[clamp(0.5rem,1.2vw,1.25rem)]'
          }
        >
          {mostraColuna && (
            <div
              data-bloco="montadores"
              className={
                mostraGrafico
                  ? 'flex flex-col gap-[clamp(0.4rem,0.8vw,0.9rem)]'
                  : 'grid content-start gap-[clamp(0.4rem,0.8vw,0.9rem)] sm:grid-cols-2 xl:grid-cols-3'
              }
            >
              {r.montadores.length === 0 ? (
                <p className="rounded-dm-lg border border-borda bg-superficie p-4 text-texto-suave">
                  Ninguém da equipe do painel montou nos últimos 30 dias.
                </p>
              ) : (
                r.montadores.map((m) => {
                  const tempoDele = tempoDaMedida(medida, {
                    mediana_s: m.mediana_hoje_s,
                    media_s: m.media_hoje_s,
                  })
                  return (
                    <div
                      key={m.letra}
                      className="flex items-center gap-4 rounded-dm-lg border border-borda bg-superficie p-[clamp(0.6rem,1vw,1.1rem)]"
                      style={{ borderLeft: `10px solid ${corDa(m.letra, letras)}` }}
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[1.1em] font-semibold">Montador {m.letra}</span>
                        <span className="text-[0.85em] text-texto-suave">
                          {m.hoje > 0 && tempoDele !== null
                            ? `${nomeDaMedida(medida)} ${doDia} ${duracao(tempoDele)} · `
                            : ''}
                          ritmo {decimal(m.ritmo)}/dia
                        </span>
                      </div>
                      <span className="font-marca text-[2.6em] leading-none font-semibold tabular-nums">
                        {m.hoje}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {mostraGrafico && (
            <div
              data-bloco="grafico"
              data-grafico={painel.grafico_tv}
              className="flex min-h-[18rem] flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-[clamp(0.6rem,1vw,1.1rem)]"
            >
              <h2 className="text-[1em] font-semibold">Móveis montados nos últimos 14 dias</h2>
              <div className="min-h-0 flex-1">
                {/* sem animação: a TV relê a cada móvel que sai — barra crescendo toda vez distrai de longe */}
                <GraficoMoveis
                  tipo={painel.grafico_tv}
                  deLonge
                  dados={dados}
                  series={series.map((s) => ({ chave: s, cor: corDa(s, letras) }))}
                  dica={(p) => (
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
                  )}
                />
              </div>
              {/* nas barras só com o total não há cor por letra: a legenda sai */}
              {series.length > 0 && painel.grafico_tv !== 'barras' && (
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
          )}
        </section>
      )}

      {!painel.tv_numeros && !mostraColuna && !mostraGrafico && (
        <p role="status" className="text-texto-suave">
          Os números, a coluna dos montadores e o gráfico estão desligados na configuração do
          painel.
        </p>
      )}
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
