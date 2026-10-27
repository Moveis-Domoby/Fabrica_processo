import { supabase } from '@/lib/supabase'

/**
 * SESSAO-41 · ajuste do dono (D-198): o CARD ESQUECIDO — na MONTAGEM, o card
 * que roda 2 h sem parar (desde o último iniciar/retomar) pergunta, URGENTE, a
 * quem está nele e aos administradores: "ainda tem alguém neste card?". O banco
 * abre a pergunta sozinho (um despertador marcado para o minuto do prazo — nada
 * de relógio que acorda para ver) e ela chega pelo canal ao vivo.
 */

/** Um card esquecido do setor, como o quadro do setor manda (`esquecidos`). */
export interface CardEsquecido {
  card_id: number
  nome: string
  pedido: number | null
  /** Desde quando a pergunta está aberta (o instante do prazo). */
  aviso_em: string
  executor_id: string | null
  executor: string | null
}

export type RespostaEsquecido =
  | { situacao: 'seguiu'; proximo_aviso: string }
  | { situacao: 'pausado'; pausado_em: string }
  /** Outra pessoa já respondeu, ou o card parou de rodar. */
  | { situacao: 'respondido' }

/**
 * "Sim, ainda tem gente" (segue; pergunta de novo em mais 2 h) ou "Não, pausar
 * o card" (pausa NO INSTANTE DO AVISO — o tempo depois não conta como
 * trabalho). Quem: quem está no card (no tablet, o PIN), o líder ou o admin —
 * a trava é do banco.
 */
export async function responderCardEsquecido(parametros: {
  cardId: number
  aindaTem: boolean
  /** Tablet compartilhado: quem digitou o PIN. */
  operadorId?: string | null
}): Promise<RespostaEsquecido> {
  const { data, error } = await supabase.rpc('plt_fn_card_esquecido_responder', {
    p_card_id: parametros.cardId,
    p_ainda_tem: parametros.aindaTem,
    p_operador_id: parametros.operadorId ?? null,
  })
  if (error) throw new Error(error.message)
  return data as RespostaEsquecido
}

/** "14:05" — a hora do aviso (ou da próxima pergunta), no relógio do aparelho. */
export const horaDoAviso = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** O nome do card como a pergunta mostra: "Rack Paris · pedido 13660". */
export function nomeDoEsquecido(item: Pick<CardEsquecido, 'nome' | 'pedido'>): string {
  return item.pedido === null ? item.nome : `${item.nome} · pedido ${item.pedido}`
}

/** A mensagem da resposta, para o aviso da tela. */
export function textoDaResposta(resposta: RespostaEsquecido): string {
  if (resposta.situacao === 'seguiu')
    return `Certo — o card segue. Se rodar mais 2 h sem parar, a pergunta volta (às ${horaDoAviso(resposta.proximo_aviso)}).`
  if (resposta.situacao === 'pausado')
    return `Card pausado às ${horaDoAviso(resposta.pausado_em)}, a hora do aviso — o tempo depois disso não conta como trabalho.`
  return 'Alguém já respondeu (ou o card já parou).'
}
