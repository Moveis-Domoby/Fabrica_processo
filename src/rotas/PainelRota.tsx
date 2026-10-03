import { ArrowDown, ArrowUp, Info, MapPinOff, RotateCcw, Save, TriangleAlert } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import type { PedidoProgramacao } from './api'
import { formatarDistancia, temPonto } from './proximidade'
import { FABRICA, formatarDuracao } from './rotaRuas'
import type { EstadoRota } from './useRotaPelasRuas'

/** Um trecho para mostrar: distância sempre; tempo só quando a rota é pelas ruas. */
interface Trecho {
  km: number
  segundos: number | null
}

function textoTrecho(t: Trecho | undefined): string | null {
  if (!t) return null
  return t.segundos === null
    ? `${formatarDistancia(t.km)} em linha reta`
    : `${formatarDistancia(t.km)} · ${formatarDuracao(t.segundos)}`
}

/**
 * As paradas da rota com o trecho de cada uma e os totais (D-108), e a ordem
 * à mão (D-109): subir/descer redesenha a rota na hora; "Salvar ordem" grava
 * para todo mundo (só na rota de um caminhão — na montagem, a ordem vai junto
 * com o Programar). Botões de 44px: funciona igual no celular e no tablet.
 */
export function PainelRota({
  titulo,
  paradas,
  estado,
  trechosEmLinhaReta,
  aoMover,
  ajustada,
  aoVoltarSugestao,
  salvar,
}: {
  titulo: string
  /** Na ordem da rota (as sem ponto no mapa também — ficam fora da conta). */
  paradas: PedidoProgramacao[]
  estado: EstadoRota
  /** km de cada trecho em linha reta (fábrica → … → fábrica): o plano B. */
  trechosEmLinhaReta: number[]
  aoMover: (cardId: number, delta: -1 | 1) => void
  /** A ordem na tela é diferente da sugestão do mais perto. */
  ajustada: boolean
  aoVoltarSugestao: () => void
  salvar?: { pendente: boolean; carregando: boolean; aoSalvar: () => void }
}) {
  const pelasRuas = estado.estado === 'pronta'
  const trechos: Trecho[] = pelasRuas
    ? estado.rota.trechos.map((t) => ({ km: t.distancia_m / 1000, segundos: t.duracao_s }))
    : trechosEmLinhaReta.map((km) => ({ km, segundos: null }))
  const totalKm = trechos.reduce((soma, t) => soma + t.km, 0)

  // O trecho que CHEGA a cada parada com ponto (o 1º sai da fábrica); a volta é o último.
  let indicePlotada = 0
  const trechoDe = new Map<number, Trecho | undefined>()
  for (const p of paradas) {
    if (temPonto(p)) trechoDe.set(p.card_id, trechos[indicePlotada++])
  }
  const volta = indicePlotada > 0 ? trechos[indicePlotada] : undefined
  const primeiraNoMapa = paradas.find((p) => temPonto(p))?.card_id

  return (
    <section className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-texto">{titulo}</h3>
        {indicePlotada > 0 && (
          <span className="text-sm text-texto tabular-nums">
            {pelasRuas ? (
              <>
                <strong>{formatarDistancia(totalKm)}</strong> · {formatarDuracao(estado.rota.duracao_s)} dirigindo · ida e
                volta da fábrica
              </>
            ) : (
              <>
                <strong>{formatarDistancia(totalKm)}</strong> em linha reta · ida e volta da fábrica
              </>
            )}
          </span>
        )}
      </div>

      {/* Honestidade da sugestão (D-108): curta, sempre à vista. */}
      <p className="flex items-start gap-2 rounded-dm bg-superficie-sutil px-3 py-2 text-xs text-texto-suave">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Sugestão inicial: sem trânsito ao vivo nem interdições do dia. O tempo é só dirigindo, sem as paradas
          das entregas.
        </span>
      </p>
      {estado.estado === 'calculando' && (
        <p className="text-xs text-texto-fraco" role="status">
          Calculando a rota pelas ruas…
        </p>
      )}
      {estado.estado === 'fora_do_ar' && (
        <p
          className="flex items-start gap-2 rounded-dm bg-atencao-fundo px-3 py-2 text-xs text-atencao-texto"
          role="status"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          O serviço de rotas não respondeu agora — o mapa mostra a linha reta (tracejada) e as distâncias em
          linha reta. Tente de novo mais tarde.
        </p>
      )}
      {estado.estado === 'sem_caminho' && (
        <p
          className="flex items-start gap-2 rounded-dm bg-atencao-fundo px-3 py-2 text-xs text-atencao-texto"
          role="status"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          Não deu para traçar pelas ruas (algum ponto ficou fora de rua no mapa) — mostrando em linha reta.
        </p>
      )}

      <ol className="flex flex-col gap-2">
        <li className="flex items-center gap-3 text-sm text-texto-suave">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-grafite-900 text-xs font-bold text-white">
            F
          </span>
          Saída da {FABRICA.nome} · {FABRICA.endereco}
        </li>
        {paradas.map((p, i) => {
          const comPonto = temPonto(p)
          const trecho = textoTrecho(trechoDe.get(p.card_id))
          return (
            <li
              key={p.card_id}
              className="flex items-center gap-3 rounded-dm border border-borda bg-superficie p-2 sm:p-3"
            >
              <span
                className={cn(
                  'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                  comPonto ? 'bg-acao text-acao-texto' : 'bg-superficie-sutil text-texto-suave',
                )}
                aria-label={`${i + 1}ª parada`}
              >
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-texto tabular-nums">
                  Pedido {p.numero} · {p.cliente_nome || 'Sem cliente'}
                </span>
                {comPonto ? (
                  trecho && (
                    <span className="text-xs text-texto-suave tabular-nums">
                      {p.card_id === primeiraNoMapa ? 'da fábrica' : 'da parada anterior'}: {trecho}
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-atencao-texto">
                    <MapPinOff aria-hidden className="size-3.5" />
                    sem ponto no mapa — fora da conta da rota
                  </span>
                )}
              </span>
              <span className="flex shrink-0 gap-1">
                <Botao
                  variante="secundaria"
                  icone={<ArrowUp />}
                  aria-label={`Subir o pedido ${p.numero}`}
                  disabled={i === 0}
                  onClick={() => aoMover(p.card_id, -1)}
                />
                <Botao
                  variante="secundaria"
                  icone={<ArrowDown />}
                  aria-label={`Descer o pedido ${p.numero}`}
                  disabled={i === paradas.length - 1}
                  onClick={() => aoMover(p.card_id, 1)}
                />
              </span>
            </li>
          )
        })}
        {volta && (
          <li className="flex items-center gap-3 text-sm text-texto-suave">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-grafite-900 text-xs font-bold text-white">
              F
            </span>
            <span className="tabular-nums">Volta à fábrica: {textoTrecho(volta)}</span>
          </li>
        )}
      </ol>

      {(ajustada || salvar?.pendente) && (
        <div className="flex flex-wrap justify-end gap-2">
          {ajustada && (
            <Botao variante="fantasma" icone={<RotateCcw />} onClick={aoVoltarSugestao}>
              Voltar à sugestão
            </Botao>
          )}
          {salvar?.pendente && (
            <Botao icone={<Save />} carregando={salvar.carregando} onClick={salvar.aoSalvar}>
              Salvar ordem
            </Botao>
          )}
        </div>
      )}
    </section>
  )
}
