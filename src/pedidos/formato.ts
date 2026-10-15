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

/** Palavras que o Tiny manda sem acento — a tela mostra com. */
const COM_ACENTO: Record<string, string> = {
  descricao: 'descrição',
  condicao: 'condição',
  situacao: 'situação',
  endereco: 'endereço',
  codigo: 'código',
  numero: 'número',
  preco: 'preço',
  deposito: 'depósito',
  unitario: 'unitário',
  operacao: 'operação',
  emissao: 'emissão',
  liquidacao: 'liquidação',
  historico: 'histórico',
  saida: 'saída',
  inscricao: 'inscrição',
  serie: 'série',
  observacoes: 'observações',
  integracao: 'integração',
  ecommerce: 'e-commerce',
  periodo: 'período',
  orcamento: 'orçamento',
  credito: 'crédito',
  debito: 'débito',
  cartao: 'cartão',
  servico: 'serviço',
  servicos: 'serviços',
  razao: 'razão',
  logradouro: 'logradouro',
  municipio: 'município',
  pais: 'país',
  telefone: 'telefone',
  celular: 'celular',
  intermediador: 'intermediador',
  percentual: 'percentual',
  comissao: 'comissão',
  multiplas: 'múltiplas',
}

/** Siglas e nomes inteiros que se escrevem de outro jeito. */
const CAMPO_INTEIRO: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  cpf_cnpj: 'CPF/CNPJ',
  cep: 'CEP',
  uf: 'UF',
  ie: 'Inscrição estadual',
  rg: 'RG',
  id: 'Código no Tiny',
  url: 'Link',
  obs: 'Observações',
  obs_interna: 'Observações internas',
  frete_por_conta: 'Frete por conta de',
  nome_fantasia: 'Nome fantasia',
  tipo_pessoa: 'Tipo de pessoa',
}

const SIGLAS = new Set(['cpf', 'cnpj', 'cep', 'uf', 'rg', 'nf', 'nfe', 'sku', 'url', 'id'])

/**
 * O nome de um campo do Tiny em língua de gente: "nome_vendedor" → "Nome
 * vendedor", "descricao_lista_preco" → "Descrição lista preço", "cpf_cnpj" →
 * "CPF/CNPJ", "id_nota_fiscal" → "Código de nota fiscal". Sem tradução
 * inventada: só arruma a escrita (acento, sigla, espaço).
 */
export function rotuloDoCampo(chave: string): string {
  const k = chave.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
  if (CAMPO_INTEIRO[k]) return CAMPO_INTEIRO[k]
  const partes = k.split(/[_\s]+/).filter(Boolean)
  const comoCodigo = partes[0] === 'id' && partes.length > 1
  const palavras = (comoCodigo ? partes.slice(1) : partes).map((p) =>
    SIGLAS.has(p) ? p.toUpperCase() : (COM_ACENTO[p] ?? p),
  )
  const frase = (comoCodigo ? ['código', 'de', ...palavras] : palavras).join(' ')
  return frase.charAt(0).toLocaleUpperCase('pt-BR') + frase.slice(1)
}

/**
 * Um valor que o Tiny manda em código ("credito", "multiplas") em língua de
 * gente ("Crédito", "Múltiplas"); o que já vem escrito à mão ("Pix -
 * terceiros", "CARTÃO - JAMAD - 10X") fica como está.
 */
export function valorDoTiny(v: string | null | undefined): string | null {
  if (!v) return null
  return /^[a-z_]+$/.test(v) ? rotuloDoCampo(v) : v
}
