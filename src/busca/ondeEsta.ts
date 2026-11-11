import { pedidoCancelado } from '@/kanban/situacao'
import type { ItemDaBusca } from './api'

/**
 * SESSAO-40 (D-188): onde o card está, em língua de galpão — como a pesquisa
 * do Trello diz "9 - LOGISTICA: ENTREGUE". Lógica pura (Vitest).
 */
export type TomDoLugar = 'perfeito' | 'info' | 'atencao' | 'danificado' | 'neutro'

export interface LugarDoCard {
  texto: string
  tom: TomDoLugar
}

const dia = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Fortaleza',
  })

function rota(item: ItemDaBusca): string {
  if (!item.rota_dia) return ''
  const [a, m, d] = item.rota_dia.split('-')
  const quando = a && m && d ? `${d}/${m}` : item.rota_dia
  const rotaN = item.rota_numero && item.rota_numero > 1 ? ` (rota ${item.rota_numero})` : ''
  return ` · na rota de ${quando}${item.rota_caminhao ? ` — ${item.rota_caminhao}` : ''}${rotaN}`
}

export function ondeEsta(item: ItemDaBusca): LugarDoCard {
  // SESSAO-48: a peça com a fabricação cancelada — na coluna (por alguns dias) ou
  // já tirada dela pela limpeza (o admin recupera pela janela do card).
  if (item.cancelada_em) {
    const motivo = item.cancelada_motivo === 'nao_encontrada' ? 'Não encontrada' : 'Fabricação cancelada'
    if (item.arquivado_em) {
      return { texto: `${motivo} — saiu da coluna em ${dia(item.arquivado_em)}`, tom: 'neutro' }
    }
    const partes = [item.setor_nome ?? 'Setor', item.etapa_nome].filter(Boolean).join(' · ')
    return { texto: `${partes} — ${motivo.toLowerCase()} em ${dia(item.cancelada_em)}`, tom: 'danificado' }
  }
  if (item.arquivado_em) {
    const quando = dia(item.arquivado_em)
    switch (item.arquivado_motivo) {
      case 'entregue':
        return { texto: `Entregue em ${quando}`, tom: 'perfeito' }
      case 'concluido':
        return { texto: `Concluído em ${quando}`, tom: 'perfeito' }
      case 'contagem':
      case 'venda':
      case 'baixa_manual':
        return { texto: `Saiu do ESTOQUE em ${quando}`, tom: 'neutro' }
      case 'reposicao_vencida':
        return { texto: `Saiu do PCP em ${quando} (venceu o prazo)`, tom: 'neutro' }
      default:
        return { texto: `Arquivado em ${quando}`, tom: 'neutro' }
    }
  }
  if (item.tipo === 'pedido') {
    // SESSAO-48 (frente 2): o PCP tirou o pedido da linha — mora em "Cancelados e removidos"
    if (item.removido_pcp_em) return { texto: `Removido do PCP em ${dia(item.removido_pcp_em)}`, tom: 'neutro' }
    if (item.standby) return { texto: 'PCP · em stand-by', tom: 'atencao' }
    if (item.liberado_completo_em) return { texto: `PCP · tudo liberado${rota(item)}`, tom: 'info' }
    return { texto: `PCP · aguardando liberação${rota(item)}`, tom: 'atencao' }
  }
  if (item.tipo === 'reposicao') return { texto: 'PCP · reabastecimento', tom: 'atencao' }
  switch (item.setor_codigo) {
    case 'estoque':
      return { texto: 'No ESTOQUE', tom: 'perfeito' }
    case 'aguardo':
      return { texto: `Pronta, na Expedição${rota(item)}`, tom: 'perfeito' }
    case 'rotas':
      return { texto: `Nas ROTAS${rota(item)}`, tom: 'info' }
    case 'devolucao':
      return { texto: 'Em decisão pós devolução', tom: 'atencao' }
  }
  const partes = [item.setor_nome ?? 'Setor', item.etapa_nome].filter(Boolean).join(' · ')
  const quem = item.executor ? ` · com ${item.executor}` : ''
  return { texto: `${partes}${quem}`, tom: 'info' }
}

/** A linha de cima do resultado: de onde o card vem. */
export function origemDoItem(item: ItemDaBusca): string {
  if (item.tipo === 'avulso') return 'Card avulso'
  if (item.tipo === 'reposicao') return 'Reposição de estoque (no PCP)'
  // SESSAO-48: a peça cancelada perdeu o pedido — diz de qual era
  if (item.pedido_numero === null && item.cancelada_pedido_numero != null)
    return `Era do pedido ${item.cancelada_pedido_numero}`
  if (item.pedido_numero === null) return 'Reposição de estoque'
  return item.tipo === 'pedido'
    ? `Pedido ${item.pedido_numero} — o pedido`
    : `Pedido ${item.pedido_numero}`
}

/** O nome do card, com o (k/n) da peça. */
export function nomeDoItem(item: ItemDaBusca): string {
  if (item.tipo === 'pedido') return 'O card do pedido (o PCP libera as peças dele)'
  const nome = item.titulo?.trim() || 'Sem nome'
  if (item.tipo === 'reposicao') return `${nome} — repor ${item.total ?? 0}`
  return item.indice && item.total ? `${nome} (${item.indice}/${item.total})` : nome
}

/** O pedido foi cancelado no Tiny (o card ainda pode estar vivo — vai para o estoque). */
export function itemDePedidoCancelado(item: ItemDaBusca): boolean {
  return item.pedido_situacao !== null && pedidoCancelado(item.pedido_situacao)
}

/**
 * O quadro onde o card está, já filtrado pelo pedido (D-187) — só setor de
 * produção e o PCP (os fins de linha são listas, não quadros).
 */
export function rotaDoQuadroFiltrado(item: ItemDaBusca): string | null {
  if (item.arquivado_em || !item.setor_codigo) return null
  if (item.setor_papel !== 'producao' && item.setor_codigo !== 'pcp') return null
  // o pedido todo liberado já saiu do quadro do PCP (as peças estão nos setores)
  if (item.tipo === 'pedido' && item.liberado_completo_em && !item.standby) return null
  const filtro = item.pedido_numero !== null ? String(item.pedido_numero) : (item.titulo ?? '')
  const base = `/fabrica/producao/${item.setor_codigo}`
  const aba = item.setor_codigo === 'pcp' && item.tipo === 'reposicao' ? 'aba=solicitacoes&' : ''
  // SESSAO-48 (frente 2): o pedido removido do PCP mora na aba "Cancelados e removidos"
  const removido = item.setor_codigo === 'pcp' && item.tipo === 'pedido' && !!item.removido_pcp_em
  const abaStandby = item.setor_codigo === 'pcp' && item.standby && !removido ? 'aba=standby&' : ''
  const abaRemovido = removido ? 'aba=cancelados&' : ''
  return filtro.trim().length >= 2
    ? `${base}?${aba}${abaStandby}${abaRemovido}filtro=${encodeURIComponent(filtro.trim())}`
    : base
}
