import { Suspense, lazy } from 'react'
import { useSugestaoAberta } from './abrirSugestao'

// A ficha é pedaço próprio (Lei §9): só baixa quando alguém abre uma sugestão.
const JanelaSugestao = lazy(() => import('./JanelaSugestao').then((m) => ({ default: m.JanelaSugestao })))

/** Desenha a ficha quando o endereço tem `?sugestao=` — montado uma vez na casca. */
export function JanelaSugestaoNaUrl() {
  const { sugestaoId, fechar } = useSugestaoAberta()
  if (sugestaoId === null) return null
  return (
    <Suspense fallback={null}>
      <JanelaSugestao key={sugestaoId} sugestaoId={sugestaoId} aoFechar={fechar} />
    </Suspense>
  )
}
