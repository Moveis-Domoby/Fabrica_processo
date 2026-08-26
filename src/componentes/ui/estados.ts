/**
 * Estados de qualidade da D-09 + dois estados neutros de sistema.
 *
 * `atencao` é o 🟡 do cofre — renderizado em âmbar-laranja para não colidir
 * com o amarelo da MARCA, que na interface significa "ação".
 */
export type Estado = 'perfeito' | 'atencao' | 'danificado' | 'informativo' | 'neutro'

/** Estados que o operador marca ao mover um card entre setores (D-09). */
export const ESTADOS_QUALIDADE = ['perfeito', 'atencao', 'danificado'] as const

export const ROTULO_ESTADO: Record<Estado, string> = {
  perfeito: 'Perfeito estado',
  atencao: 'Estado de atenção',
  danificado: 'Danificado',
  informativo: 'Informação',
  neutro: 'Sem estado',
}

/**
 * Texto que aparece na interface de marcação.
 * O do `atencao` são as palavras do dono (D-09, Q-16 ✅) — não reescrever.
 */
export const DESCRICAO_ESTADO: Record<Estado, string> = {
  perfeito: 'Peça em perfeito estado, segue o fluxo normal.',
  atencao: 'Levemente danificado, porém ainda dá pra seguir e tentar consertar.',
  danificado: 'Danificado — a peça vai para DANIFICADO e a liderança é avisada.',
  informativo: 'Informação do sistema.',
  neutro: 'Sem estado registrado.',
}
