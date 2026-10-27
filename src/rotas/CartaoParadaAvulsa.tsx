import { memo } from 'react'
import { CircleCheck, CircleX, MapPinOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { SituacaoParadaAvulsa } from './api'

/** O que o cartão mostra (serve à parada salva e ao rascunho da aba Programar). */
export interface DadosCartaoParadaAvulsa {
  titulo: string
  endereco: string
  observacao: string | null
  latitude: number | null
  longitude: number | null
  situacao?: SituacaoParadaAvulsa
  criada_por?: string | null
  nao_feita_motivo?: string | null
}

/**
 * SESSAO-41 (D-196): o número da parada avulsa — QUADRADO (o pedido é
 * redondo), como o marcador dela no mapa.
 */
export function NumeroParadaAvulsa({
  numero,
  cor,
  apagado = false,
  grande = false,
}: {
  numero: number
  /** O contorno da cor da rota (o caminhão), quando há. */
  cor?: string
  apagado?: boolean
  grande?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-dm font-bold tabular-nums',
        grande ? 'size-9 text-base' : 'size-7 text-xs',
        cor && 'border-2',
        apagado ? 'bg-superficie-sutil text-texto-suave' : 'bg-acao text-acao-texto',
      )}
      style={cor ? { borderColor: cor } : undefined}
      aria-label={`${numero}ª parada (parada avulsa)`}
    >
      {numero}
    </span>
  )
}

/** O selo da situação: Feita / Não feita (pendente não tem selo). */
export function SeloSituacaoParada({ situacao }: { situacao?: SituacaoParadaAvulsa }) {
  if (!situacao || situacao === 'pendente') return null
  return situacao === 'feita' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-perfeito-fundo px-2 py-0.5 text-xs font-medium text-perfeito-texto">
      <CircleCheck aria-hidden className="size-3.5" />
      Feita
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-atencao-fundo px-2 py-0.5 text-xs font-medium text-atencao-texto">
      <CircleX aria-hidden className="size-3.5" />
      Não feita
    </span>
  )
}

/**
 * SESSAO-41 (D-196): a PARADA AVULSA na lista da rota ("Rota programada" e
 * "Já programadas"): o título, o endereço, a observação, quem pôs e a
 * situação. Não é pedido — não tem peça nem cliente.
 */
export const CartaoParadaAvulsa = memo(function CartaoParadaAvulsa({
  parada,
}: {
  parada: DadosCartaoParadaAvulsa
}) {
  const semPonto = parada.latitude === null || parada.longitude === null
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="rounded-full bg-superficie-sutil px-2 py-0.5 text-xs font-semibold text-texto ring-1 ring-borda">
          Parada avulsa
        </span>
        <span className="font-semibold text-texto">{parada.titulo}</span>
        <SeloSituacaoParada situacao={parada.situacao} />
      </span>
      <span className="text-sm text-texto-suave">{parada.endereco}</span>
      {parada.observacao && <span className="text-sm text-texto">OBS: {parada.observacao}</span>}
      {parada.situacao === 'nao_feita' && parada.nao_feita_motivo && (
        <span className="text-sm text-atencao-texto">Motivo: {parada.nao_feita_motivo}</span>
      )}
      {parada.criada_por && (
        <span className="text-xs text-texto-fraco">Posta por {parada.criada_por}</span>
      )}
      {semPonto && (
        <span className="inline-flex items-center gap-1 text-xs text-atencao-texto">
          <MapPinOff aria-hidden className="size-3.5" />
          Sem ponto no mapa — a navegação vai pelo endereço escrito
        </span>
      )}
    </span>
  )
})
