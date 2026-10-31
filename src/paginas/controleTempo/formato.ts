import { formatarTempoUtil } from '@/kanban/tempoUtil'
import type { FaixaSemana } from './api'

export const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
export const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** Segundos → "2h 10min" (o tempo útil não vira "dias"). */
export function formatarSegundos(segundos: number | null | undefined): string {
  if (segundos === null || segundos === undefined || Number.isNaN(segundos)) return '—'
  return formatarTempoUtil(segundos * 1000)
}

/** Minutos entre dois "HH:MM". */
export function minutosEntre(inicio: string, fim: string): number {
  const [hi, mi] = inicio.split(':').map(Number)
  const [hf, mf] = fim.split(':').map(Number)
  return hf * 60 + mf - (hi * 60 + mi)
}

/** "AAAA-MM-DD" → data local (sem pular de dia pelo fuso). */
export function diaLocal(dia: string): Date {
  const [a, m, d] = dia.slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** Data local → "AAAA-MM-DD". */
export function diaIso(data: Date): string {
  const a = data.getFullYear()
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${a}-${m}-${d}`
}

/** Instante → valor de `<input type="datetime-local">` (hora local). */
export function paraCampoDataHora(data: Date): string {
  const h = String(data.getHours()).padStart(2, '0')
  const mi = String(data.getMinutes()).padStart(2, '0')
  return `${diaIso(data)}T${h}:${mi}`
}

export function dataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function soHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** As faixas de cada dia da semana, em ordem: índice 0 = domingo. */
export function faixasPorDia(faixas: FaixaSemana[]): [string, string][][] {
  const dias: [string, string][][] = [[], [], [], [], [], [], []]
  for (const [dia, ini, fim] of faixas) if (dias[dia]) dias[dia].push([ini, fim])
  for (const d of dias) d.sort((a, b) => a[0].localeCompare(b[0]))
  return dias
}

/**
 * O resumo da semana em uma linha: os dias com o mesmo horário juntos —
 * "seg a sex: 07:30–12:00 e 13:00–18:00 · sáb: 07:30–11:00".
 */
export function resumoSemana(faixas: FaixaSemana[]): string {
  const dias = faixasPorDia(faixas)
  // segunda primeiro, domingo no fim (a semana do galpão)
  const ordem = [1, 2, 3, 4, 5, 6, 0]
  const grupos: { dias: number[]; texto: string }[] = []
  for (const d of ordem) {
    if (dias[d].length === 0) continue
    const texto = dias[d].map(([i, f]) => `${i}–${f}`).join(' e ')
    const ultimo = grupos[grupos.length - 1]
    const anterior = ultimo?.dias[ultimo.dias.length - 1]
    const seguido = anterior !== undefined && ordem.indexOf(anterior) === ordem.indexOf(d) - 1
    if (ultimo && ultimo.texto === texto && seguido) ultimo.dias.push(d)
    else grupos.push({ dias: [d], texto })
  }
  if (grupos.length === 0) return 'Sem horário — o tempo conta o dia inteiro'
  return grupos
    .map((g) => {
      const nome =
        g.dias.length === 1
          ? DIAS_CURTOS[g.dias[0]]
          : g.dias.length === 2
            ? `${DIAS_CURTOS[g.dias[0]]} e ${DIAS_CURTOS[g.dias[1]]}`
            : `${DIAS_CURTOS[g.dias[0]]} a ${DIAS_CURTOS[g.dias[g.dias.length - 1]]}`
      return `${nome}: ${g.texto}`
    })
    .join(' · ')
}

/** O que está errado nas faixas de um dia (ou null). */
export function problemaNasFaixas(faixas: [string, string][]): string | null {
  for (const [ini, fim] of faixas) {
    if (!ini || !fim) return 'Preencha o começo e o fim de cada faixa.'
    if (minutosEntre(ini, fim) <= 0) return 'Cada faixa termina depois de começar.'
  }
  const ordenadas = [...faixas].sort((a, b) => a[0].localeCompare(b[0]))
  for (let i = 1; i < ordenadas.length; i++) {
    if (ordenadas[i][0] < ordenadas[i - 1][1])
      return 'Duas faixas se sobrepõem — o intervalo é o espaço entre elas.'
  }
  return null
}
