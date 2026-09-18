/** Opções dos filtros pill das telas de dashboard (SESSAO-16). */

export const OPCOES_PERIODO = [
  { valor: '1', rotulo: 'Hoje' },
  { valor: '7', rotulo: '7 dias' },
  { valor: '30', rotulo: '30 dias' },
  { valor: '90', rotulo: '90 dias' },
] as const

export const OPCOES_TEMPO = [
  { valor: 'util', rotulo: 'útil (desconta pausas)' },
  { valor: 'bruto', rotulo: 'bruto' },
] as const
