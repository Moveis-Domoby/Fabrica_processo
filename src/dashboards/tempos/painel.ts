/**
 * SESSAO-47 (Bloco C) — a CONFIGURAÇÃO do painel de Tempos de produção: uma só,
 * do administrador, que vale para a tela e para a TV. Ela vem JUNTO da resposta
 * de cada aba e da TV (a chave `painel`) — nenhuma leitura a mais. O banco de
 * antes não manda a chave: vale o padrão (o desenho de sempre).
 */

export type TipoGrafico = 'empilhadas' | 'barras' | 'linhas'
export type Medida = 'mediana' | 'media'
export type AbrirPeriodo = 'hoje' | '7' | '30'

/** Os blocos da TV que ligam e desligam (os controles discretos nunca se desligam). */
export const BLOCOS_TV = [
  'tv_numeros',
  'tv_montadores',
  'tv_grafico',
  'tv_melhor_semana',
  'tv_relogio',
  'tv_dados_ate',
  'tv_ao_vivo',
] as const
export type BlocoTv = (typeof BLOCOS_TV)[number]

export interface PainelTempos extends Record<BlocoTv, boolean> {
  /** O gráfico da aba Período. */
  grafico_periodo: TipoGrafico
  /** O gráfico dos 14 dias da TV. */
  grafico_tv: TipoGrafico
  /** A marca de onde o móvel terminaria no tempo padrão, na linha do dia. */
  linha_padrao: boolean
  /** O setor com que a tela abre (nulo = o que o aparelho lembra). */
  abrir_setor_id: number | null
  /** O período com que a tela abre: hoje (aba Dia) ou 7/30 dias (aba Período). */
  abrir_periodo: AbrirPeriodo
  /** O número mostrado como "tempo médio". */
  medida: Medida
}

/** O painel como sempre foi — vale enquanto ninguém mexer e quando o banco não manda a chave. */
export const PAINEL_PADRAO: PainelTempos = {
  grafico_periodo: 'empilhadas',
  grafico_tv: 'empilhadas',
  linha_padrao: false,
  abrir_setor_id: null,
  abrir_periodo: 'hoje',
  medida: 'mediana',
  tv_numeros: true,
  tv_montadores: true,
  tv_grafico: true,
  tv_melhor_semana: true,
  tv_relogio: true,
  tv_dados_ate: true,
  tv_ao_vivo: true,
}

export const TIPOS_GRAFICO: readonly { valor: TipoGrafico; rotulo: string }[] = [
  { valor: 'empilhadas', rotulo: 'Empilhadas por montador' },
  { valor: 'barras', rotulo: 'Barras' },
  { valor: 'linhas', rotulo: 'Linhas' },
]
export const MEDIDAS: readonly { valor: Medida; rotulo: string }[] = [
  { valor: 'mediana', rotulo: 'Mediana' },
  { valor: 'media', rotulo: 'Média' },
]
export const PERIODOS_DE_ABERTURA: readonly { valor: AbrirPeriodo; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7', rotulo: '7 dias' },
  { valor: '30', rotulo: '30 dias' },
]
export const ROTULO_BLOCO_TV: Record<BlocoTv, string> = {
  tv_numeros: 'Os quatro números do topo',
  tv_montadores: 'A coluna dos montadores',
  tv_grafico: 'O gráfico dos 14 dias',
  tv_melhor_semana: 'O melhor da semana',
  tv_relogio: 'O relógio',
  tv_dados_ate: 'Até quando há dados',
  tv_ao_vivo: 'O selo "ao vivo"',
}

const umDe = <T extends string>(valor: unknown, lista: readonly { valor: T }[], padrao: T): T =>
  lista.some((o) => o.valor === valor) ? (valor as T) : padrao

/**
 * A configuração efetiva de uma resposta. Chave ausente (o banco de antes) ou
 * valor que a tela não conhece = o padrão — a tela nunca quebra por causa dela.
 */
export function painelDe(
  resposta: { painel?: Partial<Record<keyof PainelTempos, unknown>> | null } | null | undefined,
): PainelTempos {
  const p = resposta?.painel
  if (!p || typeof p !== 'object') return PAINEL_PADRAO
  const liga = (chave: BlocoTv | 'linha_padrao') =>
    typeof p[chave] === 'boolean' ? (p[chave] as boolean) : PAINEL_PADRAO[chave]
  return {
    grafico_periodo: umDe(p.grafico_periodo, TIPOS_GRAFICO, PAINEL_PADRAO.grafico_periodo),
    grafico_tv: umDe(p.grafico_tv, TIPOS_GRAFICO, PAINEL_PADRAO.grafico_tv),
    linha_padrao: liga('linha_padrao'),
    abrir_setor_id: typeof p.abrir_setor_id === 'number' ? p.abrir_setor_id : null,
    abrir_periodo: umDe(p.abrir_periodo, PERIODOS_DE_ABERTURA, PAINEL_PADRAO.abrir_periodo),
    medida: umDe(p.medida, MEDIDAS, PAINEL_PADRAO.medida),
    tv_numeros: liga('tv_numeros'),
    tv_montadores: liga('tv_montadores'),
    tv_grafico: liga('tv_grafico'),
    tv_melhor_semana: liga('tv_melhor_semana'),
    tv_relogio: liga('tv_relogio'),
    tv_dados_ate: liga('tv_dados_ate'),
    tv_ao_vivo: liga('tv_ao_vivo'),
  }
}

/** "mediana" ou "média" — o rótulo sempre diz qual número está valendo. */
export function nomeDaMedida(medida: Medida): string {
  return medida === 'media' ? 'média' : 'mediana'
}
export function nomeDaMedidaCapital(medida: Medida): string {
  return medida === 'media' ? 'Média' : 'Mediana'
}

interface DuasMedidas {
  mediana_s: number | null
  media_s?: number | null
}

/** O número da medida escolhida (o banco de antes só manda a mediana em alguns lugares). */
export function tempoDaMedida(medida: Medida, numeros: DuasMedidas): number | null {
  return medida === 'media' ? (numeros.media_s ?? null) : numeros.mediana_s
}
/** O OUTRO número (vai de subtítulo: "mediana · a média é 41 min"). */
export function tempoDaOutraMedida(medida: Medida, numeros: DuasMedidas): number | null {
  return medida === 'media' ? numeros.mediana_s : (numeros.media_s ?? null)
}

/**
 * O subtítulo do número grande: diz qual medida está valendo e, quando há, o
 * outro número — "mediana · a média é 41 min" ou "média · a mediana é 38 min".
 */
export function legendaDaMedida(
  medida: Medida,
  numeros: DuasMedidas,
  formatar: (segundos: number) => string,
): string {
  const outro = tempoDaOutraMedida(medida, numeros)
  if (outro === null) return nomeDaMedida(medida)
  const nomeDoOutro = nomeDaMedida(medida === 'media' ? 'mediana' : 'media')
  return `${nomeDaMedida(medida)} · a ${nomeDoOutro} é ${formatar(outro)}`
}

/**
 * Quem está desligado do painel chega do banco com esta chave no lugar do id —
 * nunca é uma pessoa. O banco manda também o nome "Outros" no mapa de pessoas.
 */
export const ID_OUTROS = '00000000-0000-0000-0000-000000000000'
