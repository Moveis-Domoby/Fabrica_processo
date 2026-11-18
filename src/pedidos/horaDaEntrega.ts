import { diaCurto, diaNaFabrica, diaPorExtenso } from '@/rotas/diaDaEntrega'
import { diaEHora, diaHoraCurto } from './formato'

/**
 * SESSAO-52 — A HORA DA ENTREGA VALE? Toda entrega tem duas datas: QUANDO
 * ACONTECEU (o dia real — a data única, guardada no card do pedido) e QUANDO
 * FOI REGISTRADA. Quando o dia foi escolhido ("Marcar como entregue no dia…")
 * ou corrigido pelo administrador, a hora que o banco guarda é a do fim do
 * expediente daquele dia — não é a hora da entrega, e a tela não a mostra.
 *
 * A hora só vale quando a entrega aconteceu no próprio registro: os dois
 * instantes são o mesmo (até um minuto de folga). Sem a hora do registro (o
 * banco de antes), vale a da própria entrega, como sempre foi. Lógica pura.
 */
const FOLGA_MS = 60_000

export function horaDaEntregaVale(
  entregueEm: string | null | undefined,
  registradaEm: string | null | undefined,
): boolean {
  if (!entregueEm) return false
  if (!registradaEm) return true
  const real = new Date(entregueEm).getTime()
  const registro = new Date(registradaEm).getTime()
  if (Number.isNaN(real) || Number.isNaN(registro)) return true
  return Math.abs(real - registro) <= FOLGA_MS
}

/**
 * Quando foi entregue, para uma linha de lista: "08/11/2026 às 15:32" (a hora
 * vale) ou "no dia 06/11/2026" (o dia foi escolhido ou corrigido).
 */
export function quandoFoiEntregueNaLista(
  entregueEm: string | null | undefined,
  registradaEm: string | null | undefined,
): string {
  if (horaDaEntregaVale(entregueEm, registradaEm)) return diaEHora(entregueEm)
  const dia = diaNaFabrica(entregueEm)
  return dia ? `no dia ${diaPorExtenso(dia)}` : '—'
}

/**
 * "registrado em 09/11 às 10:32" — só quando a hora da entrega não vale (aí a
 * hora real que existe é a do registro). Nulo quando não há o que dizer.
 */
export function registroDaEntregaNaLista(
  entregueEm: string | null | undefined,
  registradaEm: string | null | undefined,
): string | null {
  if (!entregueEm || !registradaEm || horaDaEntregaVale(entregueEm, registradaEm)) return null
  const d = new Date(registradaEm)
  if (Number.isNaN(d.getTime())) return null
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `registrado em ${dia} às ${hora}`
}

/**
 * Para um histórico curto (dd/mm hh:mm): a entrega cujo dia foi escolhido ou
 * corrigido aparece só com o dia ("06/11"); o resto, com o dia e a hora.
 */
export function quandoCurtoDaEntrega(
  entregueEm: string | null | undefined,
  registradaEm: string | null | undefined,
): string {
  if (horaDaEntregaVale(entregueEm, registradaEm)) return diaHoraCurto(entregueEm)
  const dia = diaNaFabrica(entregueEm)
  return dia ? diaCurto(dia) : '—'
}
