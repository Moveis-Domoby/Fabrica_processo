/**
 * O TEMPO ÚTIL do card (SESSAO-38 · F5 — pedido do dono, 21/10/2026):
 * todo tempo que o card mostra respeita o horário do SETOR — fora do
 * expediente, sem ninguém em hora extra, o relógio para (até na fila). Quem
 * está trabalhando no card fora do horário (execução aberta) conta.
 *
 * A régua (o horário de cada setor e as pausas de setor) vem pronta do banco
 * na abertura do app (plt_fn_abertura → `regua_tempo`; releitura:
 * plt_fn_regua_tempo) — nenhuma requisição a mais por tela. A conta é a mesma
 * da `fn_tempo_util` das dashboards (D-29): sem horário cadastrado, o setor
 * funciona o tempo todo; a pausa do setor desconta. ↪️ D-167/D-172 (⏳).
 */

/** [início, fim] em milissegundos. */
export type Intervalo = [number, number]

export interface ReguaTempo {
  /** O fuso da fábrica em minutos (America/Fortaleza = −180, sem horário de verão). */
  fuso_min: number
  /** O setor do PCP (o relógio do pedido). */
  pcp_setor_id: number | null
  /** O papel de cada setor no fluxo: entrada (PCP), produção ou fim de linha. */
  papeis: Record<string, 'entrada' | 'producao' | 'terminal'>
  /** [setor, dia da semana (0 = domingo), "HH:MM:SS" início, "HH:MM:SS" fim] */
  janelas: [number, number, string, string][]
  /** [setor, início ISO, fim ISO ou nulo (aberta)] */
  pausas: [number, string, string | null][]
}

const DIA = 86_400_000
const TETO_DIAS = 4_000

function segundosDoDia(hhmmss: string): number {
  const [h = '0', m = '0', s = '0'] = hhmmss.split(':')
  return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000
}

/** Junta intervalos que se tocam ou se cruzam (ordenados, sem sobreposição). */
export function unir(lista: Intervalo[]): Intervalo[] {
  const ordenados = lista
    .filter(([a, b]) => b > a)
    .map(([a, b]) => [a, b] as Intervalo)
    .sort((x, y) => x[0] - y[0])
  const saida: Intervalo[] = []
  for (const [a, b] of ordenados) {
    const ultimo = saida[saida.length - 1]
    if (ultimo && a <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], b)
    else saida.push([a, b])
  }
  return saida
}

/** O que está nas duas listas. */
export function intersecao(a: Intervalo[], b: Intervalo[]): Intervalo[] {
  const x = unir(a)
  const y = unir(b)
  const saida: Intervalo[] = []
  let i = 0
  let j = 0
  while (i < x.length && j < y.length) {
    const ini = Math.max(x[i][0], y[j][0])
    const fim = Math.min(x[i][1], y[j][1])
    if (fim > ini) saida.push([ini, fim])
    if (x[i][1] < y[j][1]) i++
    else j++
  }
  return saida
}

/** O que está em `a` e não está em `b`. */
export function subtrair(a: Intervalo[], b: Intervalo[]): Intervalo[] {
  const tirar = unir(b)
  let saida = unir(a)
  for (const [ti, tf] of tirar) {
    const proxima: Intervalo[] = []
    for (const [ai, af] of saida) {
      if (tf <= ai || ti >= af) {
        proxima.push([ai, af])
        continue
      }
      if (ti > ai) proxima.push([ai, ti])
      if (tf < af) proxima.push([tf, af])
    }
    saida = proxima
  }
  return saida
}

export function somar(lista: Intervalo[]): number {
  return unir(lista).reduce((total, [a, b]) => total + (b - a), 0)
}

/** As janelas de expediente do setor dentro de [ini, fim]; `null` = o setor não tem horário (conta tudo). */
export function janelasDoSetor(
  regua: ReguaTempo,
  setorId: number,
  ini: number,
  fim: number,
): Intervalo[] | null {
  const doSetor = regua.janelas.filter((j) => Number(j[0]) === setorId)
  if (doSetor.length === 0) return null
  const desvio = regua.fuso_min * 60_000
  const saida: Intervalo[] = []
  // o relógio da parede da fábrica, como se fosse UTC
  let dia = Math.floor((ini + desvio) / DIA) * DIA
  const ultimoDia = Math.floor((fim + desvio) / DIA) * DIA
  for (let n = 0; dia <= ultimoDia && n < TETO_DIAS; n++, dia += DIA) {
    const semana = new Date(dia).getUTCDay()
    for (const [, d, hi, hf] of doSetor) {
      if (Number(d) !== semana) continue
      saida.push([dia + segundosDoDia(hi) - desvio, dia + segundosDoDia(hf) - desvio])
    }
  }
  return intersecao(saida, [[ini, fim]])
}

/** As pausas do setor (abertas vão até o fim do trecho pedido). */
function pausasDoSetor(regua: ReguaTempo, setorId: number, fim: number): Intervalo[] {
  return regua.pausas
    .filter((p) => Number(p[0]) === setorId)
    .map(([, i, f]) => [Date.parse(i), f ? Date.parse(f) : fim] as Intervalo)
}

/** Os trechos de [ini, fim] que caem no expediente do setor (menos as pausas do setor). */
export function intervalosUteis(
  ini: number,
  fim: number,
  setorId: number | null | undefined,
  regua: ReguaTempo | null | undefined,
): Intervalo[] {
  if (!(fim > ini)) return []
  const base: Intervalo[] = [[ini, fim]]
  if (!regua || setorId === null || setorId === undefined) return base
  const janelas = janelasDoSetor(regua, setorId, ini, fim)
  const permitido = janelas === null ? base : janelas
  return subtrair(permitido, pausasDoSetor(regua, setorId, fim))
}

/**
 * O tempo que CONTA em [ini, fim] no setor: o expediente (menos as pausas do
 * setor e o que `excluir` disser — o stand-by) somado ao `trabalho` (quem
 * trabalhou fora do horário está em hora extra — conta). Sem régua, conta o
 * relógio corrido (menos o `excluir`).
 */
export function tempoUtilMs(
  ini: number,
  fim: number,
  setorId: number | null | undefined,
  regua: ReguaTempo | null | undefined,
  opcoes: { trabalho?: Intervalo[]; excluir?: Intervalo[] } = {},
): number {
  if (!(fim > ini)) return 0
  const excluir = opcoes.excluir ?? []
  const util = subtrair(intervalosUteis(ini, fim, setorId, regua), excluir)
  const trabalho = subtrair(intersecao(opcoes.trabalho ?? [], [[ini, fim]]), excluir)
  return somar([...util, ...trabalho])
}

/** Agora é expediente no setor? (sem régua, ou setor sem horário: sim) */
export function noExpediente(
  instante: number,
  setorId: number | null | undefined,
  regua: ReguaTempo | null | undefined,
): boolean {
  return intervalosUteis(instante, instante + 1, setorId, regua).length > 0
}

/** O que o relógio do PCP do pedido precisa (D-48 + stand-by — D-169). */
export interface TempoDoPedidoNoPcp {
  entrou_pcp_em?: string | null
  liberado_completo_em?: string | null
  standby_desde?: string | null
  standby_periodos?: { ini: string; fim: string }[] | null
}

/** Os períodos de stand-by do pedido (os fechados e o aberto, até o infinito). */
export function periodosStandby(p: TempoDoPedidoNoPcp | null | undefined): Intervalo[] {
  if (!p) return []
  const fechados = (p.standby_periodos ?? []).map(
    (x) => [Date.parse(x.ini), Date.parse(x.fim)] as Intervalo,
  )
  return p.standby_desde ? [...fechados, [Date.parse(p.standby_desde), Infinity]] : fechados
}

/**
 * O tempo útil do PEDIDO no PCP (D-48): da entrada até a liberação da última
 * unidade (ou agora), só no expediente do PCP e sem o stand-by. `null` sem a
 * entrada no PCP.
 */
export function tempoPcpMs(
  pedido: TempoDoPedidoNoPcp | null | undefined,
  regua: ReguaTempo | null | undefined,
  agora: number,
): number | null {
  if (!pedido?.entrou_pcp_em) return null
  const ini = Date.parse(pedido.entrou_pcp_em)
  const fim = pedido.liberado_completo_em ? Date.parse(pedido.liberado_completo_em) : agora
  return tempoUtilMs(ini, fim, regua?.pcp_setor_id ?? null, regua, {
    excluir: periodosStandby(pedido),
  })
}

/**
 * Duração do tempo útil, em horas e minutos (sem "dias": um dia de 24 h
 * úteis seriam mais de dois dias de galpão — enganaria). "45s", "12min",
 * "3h 05min", "29h 10min".
 */
export function formatarTempoUtil(ms: number): string {
  if (ms < 0) ms = 0
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  const minutos = Math.floor(ms / 60_000)
  if (minutos < 60) return `${minutos}min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas}h` : `${horas}h ${String(resto).padStart(2, '0')}min`
}

/** O contador do card: "agora" no 1º minuto; depois o tempo útil desde `desde` no setor. */
export function duracaoUtilDesde(
  desdeIso: string | null | undefined,
  agora: number,
  setorId: number | null | undefined,
  regua: ReguaTempo,
): string {
  if (!desdeIso) return '—'
  const ini = Date.parse(desdeIso)
  if (agora - ini < 60_000) return 'agora'
  const ms = tempoUtilMs(ini, agora, setorId, regua)
  return ms < 60_000 ? '0min' : formatarTempoUtil(ms)
}
