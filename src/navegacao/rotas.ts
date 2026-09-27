/**
 * Lei de navegação (SESSAO-13): helpers de endereço. A rota de um setor sai
 * SEMPRE daqui — os terminais moram na Logística e nas entregas, os demais em
 * Controle de Produção.
 * ↪️ SESSAO-20 (D-46): tudo isso agora vive sob o pai "Fábrica" — as rotas
 * antigas (/producao, /logistica, /rotas) redirecionam no App.
 */
export function rotaDoSetor(codigo: string): string {
  if (codigo === 'estoque') return '/fabrica/logistica/estoque'
  if (codigo === 'rotas') return '/fabrica/rotas/entregas'
  // SESSAO-24: o lugar da peça pronta de pedido é a tela que já existia.
  if (codigo === 'aguardo') return '/fabrica/logistica/pedidos-em-aguardo'
  return `/fabrica/producao/${codigo}`
}

/** A casa de todo mundo: onde toda entrada desemboca. */
export const ROTA_INICIAL = '/inicio/meu-painel'
