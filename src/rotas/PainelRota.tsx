import { memo, type ReactNode } from 'react'
import { Info, MapPinOff, RotateCcw, Save, TriangleAlert } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import type { PedidoProgramacao, PedidoProgramado } from './api'
import { formatarDistancia, temPonto } from './proximidade'
import { FABRICA, formatarDuracao, somarPecas } from './rotaRuas'
import { textoTrecho } from './trechos'
import type { Trecho } from './trechos'
import type { EstadoRota } from './useRotaPelasRuas'

type Parada = PedidoProgramacao | PedidoProgramado

/**
 * As paradas da rota com o trecho de cada uma e os totais (D-108), e o trecho
 * aceso (ajustes de 03/10 — D-111): tocar numa linha acende no mapa o trecho
 * que CHEGA àquela parada (a volta à fábrica é o último); tocar de novo volta à
 * rota inteira. A ordem não se muda aqui — arrasta-se na lista (D-111 ↩️ os
 * botões de subir/descer). "Salvar ordem" só na rota de um caminhão.
 */
export const PainelRota = memo(function PainelRota({
  titulo,
  cor,
  paradas,
  estado,
  trechos,
  trechoSelecionado,
  aoSelecionarTrecho,
  ajustada,
  aoVoltarSugestao,
  salvar,
}: {
  titulo: string
  cor: string
  /** Na ordem da rota (as sem ponto no mapa também — ficam fora da conta). */
  paradas: Parada[]
  estado: EstadoRota
  trechos: Trecho[]
  trechoSelecionado: number | null
  aoSelecionarTrecho: (indice: number | null) => void
  /** A ordem na tela é diferente da sugestão do mais perto. */
  ajustada: boolean
  aoVoltarSugestao?: () => void
  salvar?: { pendente: boolean; carregando: boolean; aoSalvar: () => void }
}) {
  const pelasRuas = estado.estado === 'pronta'
  const totalKm = trechos.reduce((soma, t) => soma + t.km, 0)
  const pecas = somarPecas(paradas)

  // O trecho que CHEGA a cada parada com ponto (o 1º sai da fábrica); a volta é o último.
  let indicePlotada = 0
  const trechoDe = new Map<number, number>()
  for (const p of paradas) {
    if (temPonto(p)) trechoDe.set(p.card_id, indicePlotada++)
  }
  const indiceVolta = indicePlotada > 0 ? indicePlotada : null
  const primeiraNoMapa = paradas.find((p) => temPonto(p))?.card_id

  const linhaDeTrecho = (indice: number | undefined, conteudo: ReactNode, chave: string | number) => {
    const ativo = indice !== undefined && trechoSelecionado === indice
    return indice === undefined ? (
      <div key={chave} className="flex items-center gap-3 rounded-dm border border-borda bg-superficie p-2 sm:p-3">
        {conteudo}
      </div>
    ) : (
      <button
        key={chave}
        type="button"
        onClick={() => aoSelecionarTrecho(ativo ? null : indice)}
        aria-pressed={ativo}
        className={cn(
          'flex min-h-toque-md w-full items-center gap-3 rounded-dm border bg-superficie p-2 text-left transition-colors hover:bg-superficie-sutil sm:p-3',
          ativo ? 'border-acao-ativa ring-1 ring-acao-ativa' : 'border-borda',
        )}
      >
        {conteudo}
      </button>
    )
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-3 sm:p-4"
      style={{ borderLeft: `6px solid ${cor}` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-texto">{titulo}</h3>
        <span className="text-sm text-texto tabular-nums">
          {paradas.length} {paradas.length === 1 ? 'parada' : 'paradas'} · <strong>{pecas}</strong>{' '}
          {pecas === 1 ? 'peça' : 'peças'}
          {indicePlotada > 0 && (
            <>
              {' '}
              · <strong>{formatarDistancia(totalKm)}</strong>
              {pelasRuas ? ` · ${formatarDuracao(estado.rota.duracao_s)} dirigindo` : ' em linha reta'}
            </>
          )}
        </span>
      </div>

      {/* Honestidade da sugestão (D-108): curta, sempre à vista. */}
      <p className="flex items-start gap-2 rounded-dm bg-superficie-sutil px-3 py-2 text-xs text-texto-suave">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Sugestão inicial: sem trânsito ao vivo nem interdições do dia. O tempo é só dirigindo, sem as paradas
          das entregas. Toque num trecho para vê-lo sozinho no mapa.
        </span>
      </p>
      {estado.estado === 'calculando' && (
        <p className="text-xs text-texto-fraco" role="status">
          Calculando a rota pelas ruas…
        </p>
      )}
      {estado.estado === 'fora_do_ar' && (
        <p className="flex items-start gap-2 rounded-dm bg-atencao-fundo px-3 py-2 text-xs text-atencao-texto" role="status">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          O serviço de rotas não respondeu agora — o mapa mostra a linha reta (tracejada) e as distâncias em linha
          reta. Tente de novo mais tarde.
        </p>
      )}
      {estado.estado === 'sem_caminho' && (
        <p className="flex items-start gap-2 rounded-dm bg-atencao-fundo px-3 py-2 text-xs text-atencao-texto" role="status">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          Não deu para traçar pelas ruas (algum ponto ficou fora de rua no mapa) — mostrando em linha reta.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 text-sm text-texto-suave">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-grafite-900 text-xs font-bold text-white">
            F
          </span>
          Saída da {FABRICA.nome} · {FABRICA.endereco}
        </div>
        {paradas.map((p, i) => {
          const indice = trechoDe.get(p.card_id)
          const comPonto = indice !== undefined
          return linhaDeTrecho(
            indice,
            <>
              <span
                className={cn(
                  'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                  comPonto ? 'bg-acao text-acao-texto' : 'bg-superficie-sutil text-texto-suave',
                )}
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-texto tabular-nums">
                  {i + 1}ª parada · Pedido {p.numero} · {p.total_unidades} {p.total_unidades === 1 ? 'peça' : 'peças'}
                </span>
                {comPonto ? (
                  <span className="text-xs text-texto-suave tabular-nums">
                    {p.card_id === primeiraNoMapa ? 'da fábrica' : 'da parada anterior'}:{' '}
                    {textoTrecho(trechos[indice]) ?? '—'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-atencao-texto">
                    <MapPinOff aria-hidden className="size-3.5" />
                    sem ponto no mapa — fora da conta da rota
                  </span>
                )}
              </span>
            </>,
            p.card_id,
          )
        })}
        {indiceVolta !== null &&
          linhaDeTrecho(
            indiceVolta,
            <>
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-grafite-900 text-xs font-bold text-white">
                F
              </span>
              <span className="text-sm text-texto-suave tabular-nums">
                Volta à fábrica: {textoTrecho(trechos[indiceVolta]) ?? '—'}
              </span>
            </>,
            'volta',
          )}
      </div>

      {(trechoSelecionado !== null || ajustada || salvar?.pendente) && (
        <div className="flex flex-wrap justify-end gap-2">
          {trechoSelecionado !== null && (
            <Botao variante="fantasma" onClick={() => aoSelecionarTrecho(null)}>
              Ver a rota inteira
            </Botao>
          )}
          {ajustada && aoVoltarSugestao && (
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
})
