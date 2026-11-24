import { MapPinOff } from 'lucide-react'
import { quandoCaiu, useEstadoDaBusca } from './estadoDaBusca'

/**
 * SESSAO-56 (frente 3 — "ninguém fica 4 dias sem saber"): a faixa discreta no
 * topo de Rotas quando o servidor diz que a busca de endereço está FORA (a
 * última consulta não teve resposta de buscador nenhum). O "desde quando" vem
 * na própria resposta da busca — a tela não faz leitura nenhuma a mais para
 * isto — e a faixa some sozinha quando a busca volta a responder.
 */
export function FaixaBuscaFora() {
  const { foraDesde } = useEstadoDaBusca()
  if (!foraDesde) return null
  const quando = quandoCaiu(foraDesde)
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto"
    >
      <MapPinOff aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        A busca de endereço está fora{quando ? ` desde ${quando}` : ''}. Os pontos novos precisam
        ser marcados à mão.
      </span>
    </p>
  )
}
