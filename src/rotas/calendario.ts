/**
 * O CALENDÁRIO DA PROGRAMAÇÃO (SESSAO-39 · D-175) — as contas de data, puras
 * e testadas. O formato é o do calendário da lista ROTAS do ClickUp que o dono
 * mostrou: a semana começa no DOMINGO; o título diz o intervalo ("18 a 24 de
 * outubro de 2026"); o mês é uma grade de 6 semanas.
 *
 * Datas como texto ISO (aaaa-mm-dd), contadas em UTC — o dia é o do
 * calendário, sem fuso no meio (nada de "o dia 21 virou 20 às 21h").
 */

export type ModoCalendario = 'semana' | 'mes'

export type SituacaoCalendario = 'sem_rota' | 'na_rota' | 'entregue' | 'nao_entregue' | 'standby'

/** A ordem e o nome de gente de cada situação (a legenda do calendário). */
export const SITUACOES: { valor: SituacaoCalendario; rotulo: string }[] = [
  { valor: 'sem_rota', rotulo: 'Sem rota' },
  { valor: 'na_rota', rotulo: 'Na rota' },
  { valor: 'entregue', rotulo: 'Entregue' },
  { valor: 'nao_entregue', rotulo: 'Não entregue' },
  { valor: 'standby', rotulo: 'Stand-by' },
]

const MESES = [
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
const MESES_CURTOS = MESES.map((m) => m.slice(0, 3))
export const DIAS_DA_SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
]

function partes(iso: string): [number, number, number] {
  const [a, m, d] = iso.split('-').map(Number)
  return [a, m, d]
}
function paraIso(data: Date): string {
  return data.toISOString().slice(0, 10)
}
function emUtc(iso: string): Date {
  const [a, m, d] = partes(iso)
  return new Date(Date.UTC(a, m - 1, d))
}

/** Soma dias a uma data ISO. */
export function somarDias(iso: string, dias: number): string {
  const d = emUtc(iso)
  d.setUTCDate(d.getUTCDate() + dias)
  return paraIso(d)
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(iso: string): number {
  return emUtc(iso).getUTCDay()
}

/** O domingo da semana da data. */
export function inicioDaSemana(iso: string): string {
  return somarDias(iso, -diaDaSemana(iso))
}

/** Os 7 dias da semana da data, de domingo a sábado. */
export function diasDaSemana(iso: string): string[] {
  const inicio = inicioDaSemana(iso)
  return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i))
}

/** A grade do mês: 6 semanas (42 dias) a partir do domingo da semana do dia 1. */
export function gradeDoMes(iso: string): string[] {
  const [a, m] = partes(iso)
  const primeiro = `${a}-${String(m).padStart(2, '0')}-01`
  const inicio = inicioDaSemana(primeiro)
  return Array.from({ length: 42 }, (_, i) => somarDias(inicio, i))
}

/** O mesmo dia no mês anterior/seguinte (o 31 cai no último dia do mês). */
export function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = partes(iso)
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1))
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  alvo.setUTCDate(Math.min(d, ultimo))
  return paraIso(alvo)
}

/** O período que a tela pede ao banco (de, até) para o modo. */
export function periodoDoModo(modo: ModoCalendario, iso: string): { de: string; ate: string } {
  const dias = modo === 'semana' ? diasDaSemana(iso) : gradeDoMes(iso)
  return { de: dias[0], ate: dias[dias.length - 1] }
}

/** "18 a 24 de outubro de 2026" · "27 de setembro a 3 de outubro de 2026" · "outubro de 2026". */
export function tituloDoPeriodo(modo: ModoCalendario, iso: string): string {
  if (modo === 'mes') {
    const [a, m] = partes(iso)
    return `${MESES[m - 1]} de ${a}`
  }
  const dias = diasDaSemana(iso)
  const [a1, m1, d1] = partes(dias[0])
  const [a2, m2, d2] = partes(dias[6])
  if (a1 !== a2) return `${d1} de ${MESES[m1 - 1]} de ${a1} a ${d2} de ${MESES[m2 - 1]} de ${a2}`
  if (m1 !== m2) return `${d1} de ${MESES[m1 - 1]} a ${d2} de ${MESES[m2 - 1]} de ${a2}`
  return `${d1} a ${d2} de ${MESES[m1 - 1]} de ${a1}`
}

/** "18 out" — o dia no cabeçalho da coluna. */
export function diaCurto(iso: string): string {
  const [, m, d] = partes(iso)
  return `${d} ${MESES_CURTOS[m - 1]}`
}

/** "21/10" — a previsão na barra. */
export function diaMes(iso: string | null): string {
  if (!iso) return ''
  const [, m, d] = partes(iso)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

/** O dia está no mês mostrado? (na grade do mês, os de fora ficam apagados) */
export function mesmoMes(iso: string, referencia: string): boolean {
  return iso.slice(0, 7) === referencia.slice(0, 7)
}
