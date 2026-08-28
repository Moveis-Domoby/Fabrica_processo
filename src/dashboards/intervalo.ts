import { formatarDuracaoMs } from '@/kanban/tempo'

/**
 * O Postgres devolve `interval` como texto ("02:03:04", "1 day 02:03:04",
 * "2 days", com fração de segundo e sinal). Este parser vira a ponte entre a
 * resposta das funções de dashboard e o mostrador humano — testado no Vitest,
 * porque número de tempo errado é exatamente o que esta plataforma não pode ter.
 */
export function msDeIntervalo(valor: string | null | undefined): number {
  if (!valor) return 0
  let total = 0
  // meses aparecem só em agregações exóticas; 30 dias é a convenção do Postgres
  const meses = /(-?\d+)\s+mons?/.exec(valor)
  if (meses) total += Number(meses[1]) * 30 * 86_400_000
  const dias = /(-?\d+)\s+days?/.exec(valor)
  if (dias) total += Number(dias[1]) * 86_400_000
  const hms = /(-?)(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(valor)
  if (hms) {
    const sinal = hms[1] === '-' ? -1 : 1
    total +=
      sinal * (Number(hms[2]) * 3_600_000 + Number(hms[3]) * 60_000 + parseFloat(hms[4]) * 1000)
  }
  return Math.round(total)
}

/** Interval do banco → "3h 05min" (mesmo mostrador da linha do tempo). */
export function duracaoLegivel(valor: string | null | undefined): string {
  return formatarDuracaoMs(msDeIntervalo(valor))
}
