import { formatarDuracaoMs } from '@/kanban/tempo'

/** Dinheiro em reais — vazio vira "—". */
export function moeda(v: number | string | null | undefined): string {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v
  return n === null || n === undefined || Number.isNaN(n)
    ? '—'
    : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Data (aceita a do Tiny em dd/mm/aaaa, a ISO do banco e o dia aaaa-mm-dd). */
export function data(v: string | null | undefined): string {
  if (!v) return '—'
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v
  const d = new Date(v.length === 10 ? `${v}T12:00:00` : v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('pt-BR')
}

/** "14/10/2026 às 15:32" — o dia e a hora em que algo aconteceu. */
export function diaEHora(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

/** "14/10 15:32" — curto, para listas. */
export function diaHoraCurto(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Tempo de trabalho em segundos → "3h 05min", "12min", "45s"; zero vira "—". */
export function tempoDeTrabalho(segundos: number | null | undefined): string {
  if (!segundos || segundos <= 0) return '—'
  return formatarDuracaoMs(segundos * 1000)
}

/**
 * O nome de um campo do Tiny em língua de gente: "nome_vendedor" → "Nome
 * vendedor", "cpf_cnpj" → "CPF/CNPJ". Sem tradução inventada: só arruma.
 */
const SIGLAS_CAMPO: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  cpf_cnpj: 'CPF/CNPJ',
  cep: 'CEP',
  uf: 'UF',
  ie: 'Inscrição estadual',
  rg: 'RG',
  id: 'Código no Tiny',
  url: 'Link',
  nf: 'Nota fiscal',
  obs: 'Observações',
}
export function rotuloDoCampo(chave: string): string {
  if (SIGLAS_CAMPO[chave]) return SIGLAS_CAMPO[chave]
  const palavras = chave
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((p) => {
      const m = p.toLowerCase()
      if (SIGLAS_CAMPO[m] && m !== 'id' && m !== 'obs') return SIGLAS_CAMPO[m]
      if (m === 'id') return 'código'
      if (m === 'obs') return 'observações'
      return m
    })
  const frase = palavras.join(' ')
  return frase.charAt(0).toLocaleUpperCase('pt-BR') + frase.slice(1)
}
