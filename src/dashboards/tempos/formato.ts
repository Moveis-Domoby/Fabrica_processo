import type { MapaPessoas } from './api'

/**
 * SESSAO-43 — as contas de APRESENTAÇÃO da tela Tempos de produção e da TV
 * (nenhuma conta de tempo: os segundos já vêm prontos do cálculo da 42).
 */

/** Segundos → "45 min", "1h 05min", "30 s". */
export function duracao(segundos: number | null | undefined): string {
  if (segundos === null || segundos === undefined || !Number.isFinite(segundos)) return '—'
  if (segundos < 60) return `${Math.round(segundos)} s`
  const minutos = Math.round(segundos / 60)
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${m} min`
}

/** Segundos → "12h 30" (o tempo total, como no painel antigo). */
export function horas(segundos: number | null | undefined): string {
  if (!segundos) return '0h'
  const minutos = Math.round(segundos / 60)
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}` : `${m} min`
}

/** Número com vírgula, como se escreve no Brasil ("4,3"). */
export function decimal(valor: number | null | undefined, casas = 1): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—'
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

export type Comparacao = { texto: string; tipo: 'rapido' | 'media' | 'lento' } | null

/**
 * O tempo contra o padrão do modelo (a mediana): dentro de ±faixa = "na média";
 * abaixo = "N% mais rápido"; acima = "N% mais lento". Sem padrão = nada.
 */
export function contraPadrao(
  segundos: number | null,
  padrao: number | null,
  faixaPct: number,
): Comparacao {
  if (segundos === null || padrao === null || padrao <= 0) return null
  const diferenca = (segundos - padrao) / padrao
  if (Math.abs(diferenca) <= faixaPct / 100) return { texto: 'na média', tipo: 'media' }
  const pct = Math.round(Math.abs(diferenca) * 100)
  return diferenca < 0
    ? { texto: `${pct}% mais rápido`, tipo: 'rapido' }
    : { texto: `${pct}% mais lento`, tipo: 'lento' }
}

/** A chave de montadores (ids separados por vírgula) → "Franklin + Franklinildo"; vazia = sem montador. */
export function nomeDaChave(chave: string, pessoas: MapaPessoas): string {
  if (chave === '') return 'Sem montador'
  if (chave === '+') return 'Outros'
  return chave
    .split(',')
    .map((id) => primeiroNome(pessoas[id]?.nome ?? 'Alguém'))
    .join(' + ')
}

/** "Franklin da Silva" → "Franklin" (o nome curto das legendas e dos chips). */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome
}

// ---------------------------------------------------------------------------
// Datas (o banco conta os dias no fuso da fábrica, America/Fortaleza, UTC−3 fixo)
// ---------------------------------------------------------------------------
const FUSO_MS = -3 * 3_600_000

/** O dia de hoje na fábrica, "AAAA-MM-DD". */
export function hojeNaFabrica(agora = Date.now()): string {
  return new Date(agora + FUSO_MS).toISOString().slice(0, 10)
}

export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000)
}

export const PERIODOS = [
  { valor: '7', rotulo: '7 dias' },
  { valor: '30', rotulo: '30 dias' },
  { valor: '90', rotulo: '90 dias' },
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'mes-passado', rotulo: 'Mês passado' },
  { valor: 'pers', rotulo: 'Personalizado' },
] as const
export type ChavePeriodo = (typeof PERIODOS)[number]['valor']

export function ehChavePeriodo(v: string | null): v is ChavePeriodo {
  return PERIODOS.some((p) => p.valor === v)
}

/** O intervalo de um período (inclusive nas duas pontas), contado a partir de hoje. */
export function intervaloDoPeriodo(
  chave: ChavePeriodo,
  hoje: string,
  personalizado?: { de: string | null; ate: string | null },
): { de: string; ate: string } {
  if (chave === '7' || chave === '30' || chave === '90')
    return { de: somarDias(hoje, -(Number(chave) - 1)), ate: hoje }
  const inicioMes = `${hoje.slice(0, 7)}-01`
  if (chave === 'mes') return { de: inicioMes, ate: hoje }
  if (chave === 'mes-passado')
    return { de: `${somarDias(inicioMes, -1).slice(0, 7)}-01`, ate: somarDias(inicioMes, -1) }
  // personalizado: até 12 meses, nunca invertido
  let de = personalizado?.de || somarDias(hoje, -29)
  let ate = personalizado?.ate || hoje
  if (de > ate) [de, ate] = [ate, de]
  if (diasEntre(de, ate) > 366) de = somarDias(ate, -366)
  return { de, ate }
}

const SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
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

/** "2026-11-05" → "Quinta-feira, 5 de novembro". */
export function diaPorExtenso(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`)
  const texto = `${SEMANA[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** "2026-11-05" → "05/11". */
export function diaCurto(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
}

/** Hora "HH:MM" no fuso da fábrica, de um instante ISO. */
export function horaNaFabrica(instante: string | null): string {
  if (!instante) return '—'
  return new Date(Date.parse(instante) + FUSO_MS).toISOString().slice(11, 16)
}

/** Milissegundos até a próxima meia-noite da fábrica (a TV relê uma vez na virada do dia). */
export function msAteMeiaNoite(agora = Date.now()): number {
  const amanha = somarDias(hojeNaFabrica(agora), 1)
  return Date.parse(`${amanha}T03:00:00Z`) - agora
}
