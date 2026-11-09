import type { QueryClient } from '@tanstack/react-query'
import type { AberturaTempos, FiltrosTempos, RespostaDia, RespostaPeriodo } from './api'

/**
 * SESSAO-47 (Bloco C) — as chaves das consultas das abas, num lugar só: a aba
 * que lê e a abertura que semeia têm de falar da MESMA chave (E-22: um dado, uma
 * chave). Tudo mora sob `['tempos-producao']` — é o que o aviso do setor relê.
 */
export const chaveDoDia = (filtros: FiltrosTempos, dia: string) =>
  ['tempos-producao', 'dia', filtros, dia] as const

export const chaveDoPeriodo = (filtros: FiltrosTempos) =>
  ['tempos-producao', 'periodo', filtros] as const

/**
 * A abertura NÃO mora sob `['tempos-producao']`: o aviso do setor relê as abas,
 * não a abertura (ela só serve para a tela nascer no setor e período certos).
 */
export const CHAVE_DA_ABERTURA = ['tempos-abertura'] as const

/** Os filtros com que a aba vai ler depois da abertura (os mesmos que a porta usou). */
export function filtrosDaAbertura(abertura: AberturaTempos): FiltrosTempos | null {
  if (abertura.setor_id === null) return null
  return {
    setorId: abertura.setor_id,
    de: abertura.de,
    ate: abertura.ate,
    pessoaId: null,
    modeloId: null,
    trello: true,
  }
}

/**
 * Põe a resposta que veio na abertura no lugar onde a aba vai procurar — a aba
 * abre sem pedir de novo (a tela nasce com UMA requisição).
 */
export function semearAbertura(cliente: QueryClient, abertura: AberturaTempos): void {
  const filtros = filtrosDaAbertura(abertura)
  if (!filtros || !abertura.resposta) return
  if (abertura.aba === 'periodo') {
    cliente.setQueryData(chaveDoPeriodo(filtros), abertura.resposta as RespostaPeriodo)
  } else {
    // a aba Dia anda por cursor: a 1ª página é a resposta da abertura
    cliente.setQueryData(chaveDoDia(filtros, abertura.dia), {
      pages: [abertura.resposta as RespostaDia],
      pageParams: [null],
    })
  }
}
