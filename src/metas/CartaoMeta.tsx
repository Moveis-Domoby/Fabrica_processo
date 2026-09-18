import { CheckCircle2 } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import type { MetaPainel } from '@/metas/api'
import {
  ROTULO_INDICADOR,
  ROTULO_PERIODO,
  formatarValorMeta,
  fracaoDecorrida,
  percentualConcluido,
} from '@/metas/progresso'

/**
 * O cartão do cockpit de metas (SESSAO-14/D-37): barra = feito, traço = onde o
 * período já deveria estar. Nasceu no Meu Painel e a SESSAO-16 o extraiu para
 * cá — a tela Pessoas dos dashboards mostra o MESMO componente (mockup 03).
 */
export function CartaoMeta({
  meta,
  agora,
  podeMexer,
  aoEditar,
  aoEncerrar,
}: {
  meta: MetaPainel
  agora: number
  podeMexer: boolean
  aoEditar: () => void
  aoEncerrar: () => void
}) {
  const percentual = percentualConcluido(meta.progresso, meta.alvo)
  const bateu = percentual >= 100
  const fracaoEsperada = fracaoDecorrida(meta.janela_inicio, meta.janela_fim, new Date(agora))
  const dono = meta.setor_nome ? `Setor ${meta.setor_nome}` : meta.usuario_nome

  return (
    <div className="flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="font-marca text-base font-semibold">
          {meta.titulo || `${dono} · ${ROTULO_INDICADOR[meta.indicador]}`}
        </h3>
        <span className="text-sm text-texto-fraco">{dono}</span>
        <span
          className={cn(
            'ml-auto text-lg font-semibold tabular-nums',
            bateu ? 'text-perfeito-texto' : 'text-texto',
          )}
        >
          {percentual}%
        </span>
      </div>

      <p className="text-sm text-texto-suave">
        {ROTULO_PERIODO[meta.periodo]}: {formatarValorMeta(meta.alvo, meta.indicador)}{' '}
        {ROTULO_INDICADOR[meta.indicador]}
        {meta.etapa_nome ? ` na etapa ${meta.etapa_nome}` : ''} · feito:{' '}
        <span className="font-medium text-texto tabular-nums">
          {formatarValorMeta(meta.progresso, meta.indicador)}
        </span>
        {bateu && (
          <span className="ml-2 inline-flex items-center gap-1 text-perfeito-texto">
            <CheckCircle2 aria-hidden className="size-4" /> meta batida
          </span>
        )}
      </p>

      {/* A barra: andamento real; o traço vertical é o "alvo até agora". */}
      <div
        role="progressbar"
        aria-valuenow={Math.min(percentual, 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Andamento: ${percentual}% da meta`}
        className="relative h-3 overflow-hidden rounded-full bg-superficie-sutil"
      >
        <div
          className={cn('h-full rounded-full', bateu ? 'bg-perfeito-forte' : 'bg-acao')}
          style={{ width: `${Math.min(percentual, 100)}%` }}
        />
        <div
          aria-hidden
          className="absolute top-0 h-full w-0.5 bg-texto-suave"
          style={{ left: `${Math.round(fracaoEsperada * 100)}%` }}
          title="Onde o período já deveria estar"
        />
      </div>

      {podeMexer && (
        <div className="flex gap-2 pt-1">
          <Botao variante="fantasma" tamanho="sm" onClick={aoEditar}>
            Editar
          </Botao>
          <Botao variante="fantasma" tamanho="sm" onClick={aoEncerrar}>
            Encerrar
          </Botao>
        </div>
      )}
    </div>
  )
}
