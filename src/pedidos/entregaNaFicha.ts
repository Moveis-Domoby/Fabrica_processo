import type { DetalhePedido } from '@/kanban/api'
import { diaNaFabrica, diaPorExtenso, entregueEmOutroDia } from '@/rotas/diaDaEntrega'
import { data, diaEHora } from './formato'

/**
 * SESSAO-47 (o dia real da entrega): o que a ficha do pedido ganhou do banco —
 * chaves novas da mesma resposta (ausentes enquanto o banco é o de antes; a
 * tela trata as duas formas). Os tipos moram aqui, junto de quem os lê.
 */
export interface CorrecaoDoDia {
  /** Quando o administrador corrigiu. */
  em: string
  por: string | null
  /** O dia de antes e o dia novo (AAAA-MM-DD). */
  antes: string | null
  depois: string | null
  motivo: string | null
}

export type EntregaDaFicha = NonNullable<DetalhePedido['entrega']> & {
  /** Quando a entrega foi REGISTRADA (`em` é o dia em que ela aconteceu de fato). */
  registrada_em?: string | null
  /** A última correção do dia, se houve. */
  correcao?: CorrecaoDoDia | null
}

export type FatoDaFicha = DetalhePedido['historico'][number] & {
  /** Quando o fato foi gravado (difere do `em` na entrega marcada num dia passado). */
  registrado_em?: string | null
}

export type FichaComDiaReal = Omit<DetalhePedido, 'entrega' | 'plataforma' | 'historico'> & {
  entrega: EntregaDaFicha | null
  plataforma: DetalhePedido['plataforma'] & {
    /** Quando o pedido chegou à plataforma — o limite de baixo do dia da entrega. */
    chegou_em?: string | null
  }
  historico: FatoDaFicha[]
}

/**
 * "08/11/2026 às 15:32" quando a entrega foi registrada no próprio dia;
 * "no dia 08/11/2026" quando o dia foi escolhido (ou corrigido) — a hora que o
 * banco guarda nesse caso é a do fim do expediente, não a da entrega.
 */
export function quandoFoiEntregue(e: Pick<EntregaDaFicha, 'em' | 'registrada_em'>): string {
  if (!entregueEmOutroDia(e.em, e.registrada_em)) return diaEHora(e.em)
  const dia = diaNaFabrica(e.em)
  return dia ? `no dia ${diaPorExtenso(dia)}` : data(e.em)
}

/** "registrado em 09/11/2026 às 10:32" — só quando o dia real difere do dia do registro. */
export function quandoFoiRegistrada(
  e: Pick<EntregaDaFicha, 'em' | 'registrada_em'>,
): string | null {
  return entregueEmOutroDia(e.em, e.registrada_em)
    ? `registrado em ${diaEHora(e.registrada_em)}`
    : null
}

/** "Dia corrigido por Fulano em 09/11/2026 às 15:02 (era 09/11/2026) — motivo". */
export function fraseDaCorrecao(c: CorrecaoDoDia | null | undefined): string | null {
  if (!c) return null
  return [
    `Dia corrigido${c.por ? ` por ${c.por}` : ''} em ${diaEHora(c.em)}`,
    c.antes ? ` (era ${diaPorExtenso(c.antes)})` : '',
    c.motivo ? ` — ${c.motivo}` : '',
  ].join('')
}
