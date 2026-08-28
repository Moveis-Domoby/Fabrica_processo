import { useEffect, useState } from 'react'

/**
 * Duração legível em milissegundos: "45s", "12min", "3h 05min", "2d 4h".
 * É o mostrador da linha do tempo (SESSAO-05): fila e execução curtas
 * merecem precisão de segundos — "agora" esconderia o que se quer medir.
 */
export function formatarDuracaoMs(ms: number): string {
  if (ms < 0) ms = 0
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  const minutos = Math.floor(ms / 60_000)
  if (minutos < 60) return `${minutos}min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) {
    const resto = minutos % 60
    return resto === 0 ? `${horas}h` : `${horas}h ${String(resto).padStart(2, '0')}min`
  }
  const dias = Math.floor(horas / 24)
  const restoHoras = horas % 24
  return restoHoras === 0 ? `${dias}d` : `${dias}d ${restoHoras}h`
}

/**
 * Duração legível desde um instante: "agora", "12min", "3h 05min", "2d 4h".
 * O contador dos cards — abaixo de 1 minuto diz "agora" (no quadro, precisão
 * de segundos vira ruído; na linha do tempo usa-se formatarDuracaoMs).
 */
export function formatarDuracao(desdeIso: string | null | undefined, agora = Date.now()): string {
  if (!desdeIso) return '—'
  const ms = agora - new Date(desdeIso).getTime()
  if (ms < 60_000) return 'agora'
  return formatarDuracaoMs(ms)
}

/** Relógio compartilhado da tela: re-renderiza a cada minuto para os contadores andarem. */
export function useAgora(intervaloMs = 60_000): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), intervaloMs)
    return () => clearInterval(timer)
  }, [intervaloMs])
  return agora
}
