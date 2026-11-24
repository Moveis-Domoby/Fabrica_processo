/**
 * SESSAO-56 (frentes 2 e 3 — "o mapa não está marcando os endereços"): o que
 * a tela sabe sobre a BUSCA DE ENDEREÇO nesta visita. Antes, quando os
 * buscadores recusavam, o cartão ficava em "procurando no mapa…" para sempre
 * e ninguém soube por 4 dias. Agora:
 *
 * - `semResposta`: a última consulta voltou sem resposta de nenhum buscador
 *   (ou a chamada inteira falhou) — os cartões sem ponto trocam o
 *   "procurando…" pelo aviso com "Marcar no mapa" e "Tentar de novo", e a tela
 *   PARA de pedir (disjuntor — Lei de desempenho, sem relógio): só tenta de
 *   novo ao reabrir a aba ou no botão;
 * - `foraDesde`: desde quando o servidor diz que a busca está fora (a faixa
 *   do topo de Rotas). Vem na própria resposta da busca — nenhuma leitura a
 *   mais ao abrir a tela;
 * - `voltou`: sobe quando um "Tentar de novo" dá certo — as listas relêem e
 *   os outros endereços voltam a ser procurados sozinhos.
 *
 * Um estado só para a tela inteira (as duas abas, os cartões e a faixa),
 * fora do React Query de propósito: não é dado do servidor para guardar, é o
 * resultado da última tentativa.
 */
import { useSyncExternalStore } from 'react'
import { geocodificar } from './api'
import type { RespostaGeocodificacao } from './api'

export interface EstadoDaBusca {
  semResposta: boolean
  /** ISO de quando a busca caiu, dito pelo servidor; null = respondendo (ou ainda não se sabe). */
  foraDesde: string | null
  /** As chaves com um "Tentar de novo" em andamento. */
  tentando: ReadonlySet<string>
  /** Conta as vezes em que a busca VOLTOU pelo botão (as listas relêem). */
  voltou: number
}

const INICIAL: EstadoDaBusca = { semResposta: false, foraDesde: null, tentando: new Set(), voltou: 0 }

let estado: EstadoDaBusca = INICIAL
const ouvintes = new Set<() => void>()

function mudar(parcial: Partial<EstadoDaBusca>) {
  estado = { ...estado, ...parcial }
  for (const avisar of ouvintes) avisar()
}

const assinar = (avisar: () => void) => {
  ouvintes.add(avisar)
  return () => {
    ouvintes.delete(avisar)
  }
}
const ler = () => estado

export function useEstadoDaBusca(): EstadoDaBusca {
  return useSyncExternalStore(assinar, ler, ler)
}

/** As chaves que voltaram "tentar depois" nesta resposta. */
export function chavesSemResposta(resposta: RespostaGeocodificacao): string[] {
  return resposta.resultados.filter((r) => r.tentar_depois).map((r) => r.chave)
}

/** O que uma resposta da busca ensina: está respondendo ou não, e desde quando está fora. */
export function registrarResposta(resposta: RespostaGeocodificacao): void {
  const falhou = chavesSemResposta(resposta).length > 0
  mudar({
    semResposta: falhou,
    // o servidor de antes desta sessão não manda o estado: fica o que se sabia
    foraDesde: resposta.foraDesde === undefined ? (falhou ? estado.foraDesde : null) : resposta.foraDesde,
  })
}

/** A chamada inteira falhou (rede, sessão, servidor): o mesmo aviso nos cartões. */
export function registrarFalhaDaChamada(): void {
  mudar({ semResposta: true })
}

/** A aba foi (re)aberta: a tela tenta de novo uma vez. */
export function religarBusca(): void {
  if (estado.semResposta) mudar({ semResposta: false })
}

/**
 * "Tentar de novo" de UM cartão: pede só aquela chave. Voltou a responder →
 * o aviso some de todos e as listas relêem (`voltou`); continua fora → fica
 * como está. Devolve se a busca respondeu.
 */
export async function tentarDeNovo(item: { chave: string; endereco: string }): Promise<boolean> {
  if (estado.tentando.has(item.chave)) return false
  mudar({ tentando: new Set([...estado.tentando, item.chave]) })
  let respondeu = false
  try {
    const resposta = await geocodificar([item])
    respondeu = chavesSemResposta(resposta).length === 0
    registrarResposta(resposta)
  } catch {
    registrarFalhaDaChamada()
  } finally {
    const tentando = new Set(estado.tentando)
    tentando.delete(item.chave)
    mudar({ tentando, voltou: respondeu ? estado.voltou + 1 : estado.voltou })
  }
  return respondeu
}

/** Só para os testes: volta ao começo. */
export function zerarEstadoDaBusca(): void {
  estado = INICIAL
  for (const avisar of ouvintes) avisar()
}

/** O aviso do cartão e das janelas de busca (texto da demanda). */
export const AVISO_BUSCA_SEM_RESPOSTA =
  'A busca de endereço não respondeu. Marque o ponto no mapa ou tente de novo.'

/** "19/11 às 13:56" — o instante da queda, na hora de quem olha a tela. */
export function quandoCaiu(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${dia} às ${hora}`
}
