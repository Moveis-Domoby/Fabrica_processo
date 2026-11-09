import { hojeNaFabrica } from '@/dashboards/tempos/formato'

/**
 * O DIA DA ENTREGA (SESSAO-47 — pedido do dono: "marcar como entregue no dia em
 * que foi entregue de fato … deve refletir em toda a plataforma"). As contas de
 * dia da tela, puras e testadas — a mesma régua do banco: o dia é sempre o do
 * fuso da fábrica (America/Fortaleza, UTC−3 fixo, sem horário de verão).
 *
 * Duas datas andam juntas em toda entrega: QUANDO ACONTECEU (o dia real — o que
 * as telas mostram) e QUANDO FOI REGISTRADA (o que decide o "desfazer do dia").
 */
const FUSO_MS = -3 * 3_600_000

/** O dia (AAAA-MM-DD) de um instante, no fuso da fábrica. */
export function diaNaFabrica(instante: string | null | undefined): string | null {
  if (!instante) return null
  const ms = new Date(instante).getTime()
  return Number.isNaN(ms) ? null : new Date(ms + FUSO_MS).toISOString().slice(0, 10)
}

/** "08/11/2026" a partir de AAAA-MM-DD. */
export function diaPorExtenso(dia: string): string {
  const [a, m, d] = dia.split('-')
  return a && m && d ? `${d}/${m}/${a}` : dia
}

/** "08/11" a partir de AAAA-MM-DD — para as notas curtas. */
export function diaCurto(dia: string): string {
  const [, m, d] = dia.split('-')
  return m && d ? `${d}/${m}` : dia
}

/**
 * Por que o dia escolhido não vale (em língua de gente) — ou nulo, se vale. O
 * banco confere de novo: nunca um dia que ainda não chegou, nunca antes de o
 * pedido chegar à plataforma.
 */
export function problemaDoDia(
  dia: string,
  chegouEm: string | null | undefined,
  hoje = hojeNaFabrica(),
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return 'Escolha o dia em que a entrega aconteceu.'
  if (dia > hoje) return 'Esse dia ainda não chegou — a entrega só pode ser marcada até hoje.'
  const chegou = diaNaFabrica(chegouEm)
  if (chegou && dia < chegou)
    return `O pedido chegou à plataforma em ${diaPorExtenso(chegou)} — escolha desse dia em diante.`
  return null
}

/**
 * A entrega foi REGISTRADA hoje (no fuso da fábrica)? É o "do dia" do desfazer:
 * quem marcou hoje "entregue ontem" ainda desfaz hoje. Sem a hora do registro
 * (o banco de antes), vale a da própria entrega.
 */
export function registradaHoje(
  registradaEm: string | null | undefined,
  entregueEm: string | null | undefined,
  agora = Date.now(),
): boolean {
  const dia = diaNaFabrica(registradaEm ?? entregueEm)
  return dia !== null && dia === hojeNaFabrica(agora)
}

/** A entrega aconteceu num dia diferente do dia em que foi registrada? */
export function entregueEmOutroDia(
  entregueEm: string | null | undefined,
  registradaEm: string | null | undefined,
): boolean {
  const real = diaNaFabrica(entregueEm)
  const registro = diaNaFabrica(registradaEm)
  return real !== null && registro !== null && real !== registro
}
