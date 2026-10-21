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
  // ↩️ SESSAO-38 (D-157): "Pedidos em aguardo" virou a Expedição.
  if (codigo === 'aguardo') return '/fabrica/logistica/expedicao'
  return `/fabrica/producao/${codigo}`
}

/** A casa de todo mundo: onde toda entrada desemboca. */
export const ROTA_INICIAL = '/inicio/meu-painel'

/** Siglas da casa que ficam inteiras em maiúsculas no menu. */
const SIGLAS = new Set(['PCP', 'SECC', 'CNC', 'MDF', 'API'])

/**
 * ↩️ Ajuste do dono (14/10 noite — "uns nomes em maiúsculo, outros em
 * minúsculo"): o nome no menu segue um padrão só — a primeira letra
 * maiúscula, o resto minúsculo, as siglas da casa inteiras ("LIMPEZA E
 * EMBALAGEM" → "Limpeza e embalagem", "PCP" → "PCP"). O nome guardado no banco
 * não muda (os quadros continuam com o nome cadastrado).
 */
export function nomeNoMenu(nome: string): string {
  const juntas = nome
    .trim()
    .split(/\s+/)
    .map((p) => {
      const maiuscula = p.toLocaleUpperCase('pt-BR')
      return SIGLAS.has(maiuscula) ? maiuscula : p.toLocaleLowerCase('pt-BR')
    })
    .join(' ')
  return juntas.charAt(0).toLocaleUpperCase('pt-BR') + juntas.slice(1)
}
