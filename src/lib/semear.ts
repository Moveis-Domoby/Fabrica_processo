import type { QueryClient, QueryKey } from '@tanstack/react-query'

/**
 * A PORTA DE ABERTURA QUE SEMEIA (SESSAO-55 · Lei §2 — uma requisição por tela).
 *
 * Uma tela que mostra pedaços que também têm vida própria no cache (as metas,
 * as visualizações salvas, as etapas, as pessoas…) pede tudo na porta de
 * abertura dela e põe cada pedaço no cache com a MESMA chave e o MESMO formato
 * de sempre (E-22). A consulta de cada pedaço fica desligada até a porta
 * responder (`enabled`) — quando liga, acha o dado guardado e não pede de novo;
 * dali em diante ela relê sozinha só no gesto que a invalida.
 *
 * `faltaNoCache` diz se a porta precisa trazer o pedaço: não há dado, ele foi
 * invalidado, ou é mais velho que a validade da consulta dele.
 */
export function faltaNoCache(
  clienteQuery: QueryClient,
  chave: QueryKey,
  validadeMs = 30_000,
): boolean {
  const estado = clienteQuery.getQueryState(chave)
  if (!estado || estado.data === undefined || estado.isInvalidated) return true
  return Date.now() - estado.dataUpdatedAt > validadeMs
}
