import { MapPinOff } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { ondeOPinoEsta } from './conferirPino'
import type { PerguntaDoPino, PontoSuspeito } from './conferirPino'

/** A pergunta no rodapé da janela (no lugar dos botões): o aviso, "Voltar" e "Salvar assim mesmo". */
export function PerguntaNoRodape({
  pergunta,
  carregando = false,
  aoConfirmar,
  aoVoltar,
}: {
  pergunta: PerguntaDoPino
  carregando?: boolean
  aoConfirmar: () => void
  aoVoltar: () => void
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      <p
        role="alert"
        className="flex items-start gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm font-medium text-atencao-texto"
      >
        <MapPinOff aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{pergunta.texto}</span>
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Botao tamanho="lg" variante="secundaria" onClick={aoVoltar} disabled={carregando}>
          Voltar
        </Botao>
        <Botao tamanho="lg" onClick={aoConfirmar} carregando={carregando}>
          Salvar assim mesmo
        </Botao>
      </div>
    </div>
  )
}

/**
 * Frente 1: "Achar no mapa" não achou a rua — o pino está no bairro ou no
 * centro da cidade. O aviso em âmbar e o "Salvar assim mesmo" (que libera o
 * Salvar sem arrastar).
 */
export function AvisoRuaNaoAchada({
  lugar,
  liberado,
  aoLiberar,
}: {
  lugar: Pick<PontoSuspeito, 'nivel' | 'nome'>
  liberado: boolean
  aoLiberar: () => void
}) {
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-start gap-2 font-medium">
        <MapPinOff aria-hidden className="mt-0.5 size-4 shrink-0" />
        Não achei a rua no mapa — o pino está {ondeOPinoEsta(lugar)}. Arraste até a casa antes de
        salvar.
      </span>
      {liberado ? (
        <span className="text-xs">Liberado para salvar com o pino aí.</span>
      ) : (
        <Botao
          type="button"
          variante="secundaria"
          tamanho="sm"
          className="shrink-0 self-start sm:self-auto"
          onClick={aoLiberar}
        >
          Salvar assim mesmo
        </Botao>
      )}
    </div>
  )
}
