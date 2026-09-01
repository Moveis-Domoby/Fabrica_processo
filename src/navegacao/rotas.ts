/**
 * Lei de navegação (SESSAO-13): helpers de endereço. A rota de um setor sai
 * SEMPRE daqui — os terminais moram na Logística e nas entregas, os demais em
 * Controle de Produção.
 */
export function rotaDoSetor(codigo: string): string {
  if (codigo === 'estoque') return '/logistica/estoque'
  if (codigo === 'rotas') return '/rotas/entregas'
  return `/producao/${codigo}`
}

/** A casa de todo mundo: onde toda entrada desemboca. */
export const ROTA_INICIAL = '/inicio/meu-painel'
