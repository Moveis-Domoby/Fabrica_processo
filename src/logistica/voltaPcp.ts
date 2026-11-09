import type { VoltaPcp } from '@/kanban/tipos'
import type { SituacaoDaVolta } from './api'

/**
 * SESSAO-47 — a língua do "pedido adiantado no Tiny que ainda falta produzir".
 * O Tiny levou o pedido adiante (Faturado, Pronto para envio, Enviado) e por
 * isso ele saiu do PCP; a Expedição avisa e devolve ao PCP mudando a situação
 * lá. As frases moram aqui para a Expedição, a janela de liberar peça e o PCP
 * dizerem a mesma coisa.
 */

/** O nome de gente da situação pedida ao Tiny. */
export const NOME_DA_SITUACAO: Record<SituacaoDaVolta, string> = {
  aberto: 'Em aberto',
  preparando_envio: 'Preparando envio',
}

/** Os dois botões (textos fechados com o dono em 09/11). */
export const ROTULO_VOLTAR: Record<SituacaoDaVolta, string> = {
  aberto: 'Voltar para Em aberto (Tiny)',
  preparando_envio: 'Voltar para Preparando envio (Tiny)',
}

export const SITUACOES_DA_VOLTA: SituacaoDaVolta[] = ['aberto', 'preparando_envio']

/** Com a ida ao Tiny desligada, os botões ficam apagados — e a tela diz por quê. */
export const EXPLICACAO_TINY_DESLIGADO =
  'A plataforma está sem a ida ao Tiny ligada, então por aqui não dá para mudar a situação do pedido lá. Mude no Tiny, ou peça a um administrador para ligar "Entregue vai ao Tiny" nas Rotas.'

/** "2 produtos" / "1 produto" (plural por extenso). */
export function produtos(quantos: number): string {
  return quantos === 1 ? '1 produto' : `${quantos} produtos`
}

/** O aviso do card: a situação real e o que falta liberar. */
export function fraseSaiuDoPcp(situacao: string | null | undefined, faltam: number): string {
  return `Este pedido está como ${situacao || 'adiantado'} no Tiny, por isso saiu do PCP. Ainda falta liberar ${produtos(faltam)}.`
}

/** A confirmação de uma frase, antes do gesto. */
export function fraseConfirmarVolta(parametros: {
  numero: number
  faltam: number
  situacao: SituacaoDaVolta
  standby?: boolean
}): string {
  const { numero, faltam, situacao, standby } = parametros
  return `O pedido ${numero} vai voltar ao PCP${standby ? ' em stand-by,' : ''} com ${produtos(faltam)} para liberar, e no Tiny passa para ${NOME_DA_SITUACAO[situacao]}.`
}

/**
 * O que dizer do pedido que JÁ voltou ao PCP enquanto o Tiny não mostra a
 * situação nova. Nulo = nada a dizer (sem a marca, ou o Tiny já aceitou e a
 * situação chega em instantes).
 */
export function avisoDaVolta(
  volta: VoltaPcp | null | undefined,
): { texto: string; detalhe: string } | null {
  if (!volta || volta.estado === 'aceito') return null
  const pedida = NOME_DA_SITUACAO[volta.situacao_pedida] ?? volta.situacao_pedida
  const agora = volta.situacao_tiny ? ` O Tiny ainda mostra ${volta.situacao_tiny}.` : ''
  const base = `A logística devolveu este pedido ao PCP e pediu ao Tiny a situação ${pedida}.${agora}`
  return {
    texto: 'O Tiny ainda não confirmou a mudança',
    detalhe:
      volta.estado === 'parado'
        ? `${base} Depois de várias tentativas o Tiny não aceitou — os administradores foram avisados. O pedido segue no PCP; confira a situação dele no Tiny.`
        : volta.estado === 'falhando'
          ? `${base} A plataforma está tentando de novo. O pedido segue no PCP.`
          : `${base} O pedido segue no PCP.`,
  }
}
