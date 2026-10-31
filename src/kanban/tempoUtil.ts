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
 *
 * ↪️ SESSAO-42 (o tempo certo): a régua é ESPELHO de
 * `plt_privado.fn_tempo_janelas` / `fn_tempo_corte` — o mesmo cálculo do
 * banco. Conta o expediente do setor em faixas (o almoço é o buraco entre
 * elas), com as exceções do calendário (feriado e dia parado não contam; o
 * dia trabalhado conta só as faixas dele; a do setor vence a da fábrica) e a
 * hora extra AUTORIZADA (do setor inteiro ou da pessoa). A regra antiga "quem
 * trabalha fora do horário conta" acabou: só a hora extra autorizada conta.
 * O trecho de execução vale até o fim do expediente do dia em que começou (o
 * corte — "Fim do expediente"). O que já fechou vem pronto do banco; o
 * aparelho soma só o pedaço que está rodando (`tempoDoMovelMs`).
 */

/** [início, fim] em milissegundos. */
export type Intervalo = [number, number]

/** SESSAO-42: o tipo do dia diferente no calendário. */
export type TipoExcecao = 'feriado' | 'trabalhado' | 'parado'

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
  /**
   * SESSAO-42: [setor (nulo = a fábrica), "AAAA-MM-DD", tipo, faixas
   * [["HH:MM","HH:MM"], …] (só no dia trabalhado)]. Ausente na régua velha.
   */
  excecoes?: [number | null, string, TipoExcecao, [string, string][] | null][]
  /** SESSAO-42: a hora extra autorizada — [setor, pessoa (nula = o setor inteiro), início ISO, fim ISO]. */
  extras?: [number, string | null, string, string][]
  /** SESSAO-42: o setor pausa sozinho no fim do expediente? (id do setor → sim/não) */
  cortes?: Record<string, boolean>
  /** SESSAO-42: o setor monta em lote ("Montar juntos")? (id do setor → sim/não) */
  lotes?: Record<string, boolean>
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

/** "AAAA-MM-DD" do dia da parede (o dia já deslocado para o fuso, em ms "como UTC"). */
const dataDoDia = (dia: number) => new Date(dia).toISOString().slice(0, 10)

/**
 * As janelas em que o tempo CONTA no setor dentro de [ini, fim] — espelho de
 * `plt_privado.fn_tempo_janelas` (SESSAO-42): no dia sem exceção, as faixas da
 * semana (setor sem horário nenhum: o dia inteiro — D-29); no dia com exceção
 * (a do setor vence a da fábrica), feriado/parado = nada, trabalhado = as
 * faixas dele; + a hora extra autorizada do setor (e a da pessoa, com
 * `usuarioId`). As pausas de setor NÃO saem aqui (`intervalosUteis` tira).
 */
export function janelasDoSetor(
  regua: ReguaTempo,
  setorId: number,
  ini: number,
  fim: number,
  usuarioId?: string | null,
): Intervalo[] {
  if (!(fim > ini)) return []
  const doSetor = regua.janelas.filter((j) => Number(j[0]) === setorId)
  const temHorario = doSetor.length > 0
  // a exceção de cada dia: a do setor vence a da fábrica
  const excecoes = new Map<string, { tipo: TipoExcecao; faixas: [string, string][] }>()
  for (const [setor, dia, tipo, faixas] of regua.excecoes ?? []) {
    const doSetorMesmo = setor !== null && Number(setor) === setorId
    if (setor !== null && !doSetorMesmo) continue
    if (!doSetorMesmo && excecoes.has(dia)) continue // a da fábrica não passa por cima da do setor
    excecoes.set(dia, { tipo, faixas: faixas ?? [] })
  }
  const desvio = regua.fuso_min * 60_000
  const saida: Intervalo[] = []
  // o relógio da parede da fábrica, como se fosse UTC
  let dia = Math.floor((ini + desvio) / DIA) * DIA
  const ultimoDia = Math.floor((fim + desvio) / DIA) * DIA
  for (let n = 0; dia <= ultimoDia && n < TETO_DIAS; n++, dia += DIA) {
    const excecao = excecoes.get(dataDoDia(dia))
    if (excecao) {
      // feriado e dia parado: nada conta; dia trabalhado: só as faixas dele
      if (excecao.tipo !== 'trabalhado') continue
      for (const [hi, hf] of excecao.faixas) {
        const a = segundosDoDia(hi)
        const b = segundosDoDia(hf)
        if (b > a) saida.push([dia + a - desvio, dia + b - desvio])
      }
      continue
    }
    if (!temHorario) {
      saida.push([dia - desvio, dia + DIA - desvio])
      continue
    }
    const semana = new Date(dia).getUTCDay()
    for (const [, d, hi, hf] of doSetor) {
      if (Number(d) !== semana) continue
      saida.push([dia + segundosDoDia(hi) - desvio, dia + segundosDoDia(hf) - desvio])
    }
  }
  // a hora extra autorizada: do setor inteiro, ou só da pessoa
  for (const [setor, pessoa, i, f] of regua.extras ?? []) {
    if (Number(setor) !== setorId) continue
    if (pessoa !== null && pessoa !== (usuarioId ?? null)) continue
    saida.push([Date.parse(i), Date.parse(f)])
  }
  return intersecao(saida, [[ini, fim]])
}

/** As pausas do setor (abertas vão até o fim do trecho pedido). */
function pausasDoSetor(regua: ReguaTempo, setorId: number, fim: number): Intervalo[] {
  return regua.pausas
    .filter((p) => Number(p[0]) === setorId)
    .map(([, i, f]) => [Date.parse(i), f ? Date.parse(f) : fim] as Intervalo)
}

/**
 * Os trechos de [ini, fim] que CONTAM no setor (as janelas da régua menos as
 * pausas do setor). `usuarioId`: a hora extra autorizada só daquela pessoa
 * também conta.
 */
export function intervalosUteis(
  ini: number,
  fim: number,
  setorId: number | null | undefined,
  regua: ReguaTempo | null | undefined,
  usuarioId?: string | null,
): Intervalo[] {
  if (!(fim > ini)) return []
  const base: Intervalo[] = [[ini, fim]]
  if (!regua || setorId === null || setorId === undefined) return base
  const janelas = janelasDoSetor(regua, setorId, ini, fim, usuarioId)
  return subtrair(janelas, pausasDoSetor(regua, setorId, fim))
}

/**
 * O tempo que CONTA em [ini, fim] no setor: as janelas da régua (menos as
 * pausas do setor e o que `excluir` disser — o stand-by). `usuarioId`: soma a
 * hora extra autorizada da pessoa. `trabalho` (legado — a linha do tempo do
 * banco velho): trechos que contam mesmo fora do horário. Sem régua, conta o
 * relógio corrido (menos o `excluir`).
 */
export function tempoUtilMs(
  ini: number,
  fim: number,
  setorId: number | null | undefined,
  regua: ReguaTempo | null | undefined,
  opcoes: { trabalho?: Intervalo[]; excluir?: Intervalo[]; usuarioId?: string | null } = {},
): number {
  if (!(fim > ini)) return 0
  const excluir = opcoes.excluir ?? []
  const util = subtrair(intervalosUteis(ini, fim, setorId, regua, opcoes.usuarioId), excluir)
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

/**
 * O CORTE do fim do expediente (SESSAO-42 · regra 2) — espelho de
 * `plt_privado.fn_tempo_corte`: até quando um trecho que começou em `inicioMs`
 * pode contar. É o fim da última janela do DIA (no fuso da fábrica) em que
 * começou — a hora extra entra junto; o almoço não corta. Começou depois do
 * expediente do dia → o começo da próxima janela (não conta nada). `null` =
 * o setor não pausa sozinho (ou não tem janela nos próximos 10 dias).
 */
export function corteMs(
  setorId: number | null | undefined,
  inicioMs: number,
  regua: ReguaTempo | null | undefined,
  usuarioId?: string | null,
): number | null {
  if (!regua || setorId === null || setorId === undefined || !Number.isFinite(inicioMs)) return null
  if (!regua.cortes?.[String(setorId)]) return null
  const desvio = regua.fuso_min * 60_000
  const diaLocal = (t: number) => Math.floor((t + desvio) / DIA)
  const dia = diaLocal(inicioMs)
  let corte: number | null = null
  for (const [a, b] of intervalosUteis(inicioMs, inicioMs + 10 * DIA, setorId, regua, usuarioId)) {
    if (diaLocal(a) <= dia)
      corte = b // ainda o mesmo dia: o fim vai para depois
    else return corte ?? a // nada mais conta no dia: corta já no começo da próxima
  }
  return corte
}

/**
 * SESSAO-42 (F4): o tempo do móvel no setor como o banco manda para o card
 * (`plt_fn_quadro_setor.tempos[card]` e `plt_fn_card_janela.tempo` —
 * `fn_tempo_card_vivo`): o que já fechou vem pronto; do trecho de execução
 * aberto, de quando começou, o corte e por quanto ele se divide (o lote).
 */
export interface TempoVivo {
  setor_id: number
  /** os trechos que já fecharam, com a divisão — em segundos */
  fechado_s: number
  /** a fila útil da passagem (da entrada ao 1º trecho) — em segundos */
  fila_s: number
  /** quando o trecho de execução aberto começou; nulo = ninguém rodando agora */
  desde: string | null
  /** o fim do expediente do dia em que o trecho começou; nulo = o setor não corta */
  corte: string | null
  /** por quanto o vivo se divide (os trechos abertos da pessoa — o lote) */
  dividir: number
  usuario_id: string | null
  /** o mesmo valor nos cards montados juntos; nulo = fora de lote */
  lote: string | null
}

/**
 * O TEMPO DO MÓVEL no setor agora (SESSAO-42): o fechado + o vivo — o útil
 * do começo do trecho até agora (ou até o corte do fim do expediente), pela
 * MESMA régua do banco, dividido pelos trechos abertos da pessoa.
 */
export function tempoDoMovelMs(
  vivo: TempoVivo,
  regua: ReguaTempo | null | undefined,
  agora: number,
): number {
  const fechado = Math.max(0, Number(vivo.fechado_s) || 0) * 1000
  if (!vivo.desde) return fechado
  const ini = Date.parse(vivo.desde)
  const corte = vivo.corte
    ? Date.parse(vivo.corte)
    : (corteMs(vivo.setor_id, ini, regua, vivo.usuario_id) ?? Infinity)
  const fim = Math.max(ini, Math.min(agora, corte))
  const util = tempoUtilMs(ini, fim, vivo.setor_id, regua, { usuarioId: vivo.usuario_id })
  return fechado + util / Math.max(1, Number(vivo.dividir) || 1)
}

/** O mostrador do tempo do móvel no card: "agora" no 1º minuto de um trecho novo. */
export function textoTempoDoMovel(
  vivo: TempoVivo,
  regua: ReguaTempo | null | undefined,
  agora: number,
): string {
  const ms = tempoDoMovelMs(vivo, regua, agora)
  if (ms < 60_000) {
    const recente = vivo.desde !== null && agora - Date.parse(vivo.desde) < 60_000
    return recente && vivo.fechado_s < 60 ? 'agora' : '0min'
  }
  return formatarTempoUtil(ms)
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
