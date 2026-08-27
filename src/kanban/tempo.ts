import { useEffect, useState } from 'react'

/**
 * Duração legível desde um instante: "agora", "12min", "3h 05min", "2d 4h".
 * É o contador simples da SESSAO-04 — o modelo fila/execução completo (D-02)
 * chega na SESSAO-05, derivado de eventos, não deste mostrador.
 */
export function formatarDuracao(desdeIso: string | null | undefined, agora = Date.now()): string {
  if (!desdeIso) return '—'
  const ms = agora - new Date(desdeIso).getTime()
  if (ms < 60_000) return 'agora'
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

/** Relógio compartilhado da tela: re-renderiza a cada minuto para os contadores andarem. */
export function useAgora(intervaloMs = 60_000): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), intervaloMs)
    return () => clearInterval(timer)
  }, [intervaloMs])
  return agora
}
