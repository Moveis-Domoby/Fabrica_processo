/**
 * SESSAO-41 (D-196): a PARADA AVULSA misturada aos pedidos da rota — lógica
 * pura, sem rede, testada no Vitest. A parada não é pedido: divide a ORDEM com
 * eles (a mesma sequência no banco) e, na tela, entra na MESMA lista — com o
 * `card_id` NEGATIVO (−id da parada; na aba Programar, um número de rascunho),
 * o que deixa a ordem salva, a sugestão do mais perto, o arrasto e o mapa
 * funcionarem sem saber que ela existe.
 *
 * - A parada já marcada (Feita / Não feita) segue na ordem (o banco a conta),
 *   mas sai do caminho: do mapa, da conta da rota e do Google Maps.
 * - No celular (Entregas do dia), só a parada que a pessoa pôs e que ainda está
 *   pendente muda de lugar — a ordem dos pedidos é da logística.
 */
import type {
  DadosParadaAvulsa,
  EntregaDoDia,
  ItemDaMontagem,
  ItemDaOrdem,
  ParadaAvulsa,
} from './api'
import type { ParadaMinima, ParadaNoMapa } from './MapaProgramacao'
import { temPonto } from './proximidade'
import type { ComPonto } from './proximidade'
import { ordemDaRota } from './rotaRuas'

/** Depois de qualquer gesto da parada, o que as telas relêem. */
export const CHAVES_PARADA_AVULSA = [
  ['entregas-do-dia'],
  ['programadas'],
  ['programacao'],
  ['rotas'],
  ['paradas-avulsas'],
]

/** A parada que a aba Programar monta antes de programar (ainda não está no banco). */
export interface RascunhoParada extends DadosParadaAvulsa {
  /** A chave da tela — vai ao banco como "k" e volta com o id da parada. */
  chave: string
}

/** A parada como ITEM da lista da rota, junto com os pedidos. */
export interface ItemAvulsa extends ComPonto {
  /** NEGATIVO: nunca colide com o card de um pedido. */
  card_id: number
  ordem: number | null
  /** A parada não leva peça — as somas de peças da rota não mudam. */
  total_unidades: 0
  avulsa: ParadaAvulsa | RascunhoParada
}

export function itemDaParada(p: ParadaAvulsa): ItemAvulsa {
  return {
    card_id: -p.id,
    ordem: p.ordem,
    latitude: p.latitude,
    longitude: p.longitude,
    total_unidades: 0,
    avulsa: p,
  }
}

/** O rascunho da aba Programar como item (`idTela` negativo, dado pela tela). */
export function itemDoRascunho(r: RascunhoParada, idTela: number): ItemAvulsa {
  return {
    card_id: idTela,
    ordem: null,
    latitude: r.latitude,
    longitude: r.longitude,
    total_unidades: 0,
    avulsa: r,
  }
}

export function ehAvulsa<T extends object>(item: T | ItemAvulsa): item is ItemAvulsa {
  return 'avulsa' in item
}

/** A parada já está no banco (tem id) — o rascunho da aba Programar ainda não. */
export function paradaSalva(a: ParadaAvulsa | RascunhoParada): a is ParadaAvulsa {
  return 'id' in a
}

/** Feita ou Não feita: segue na ordem, mas sai do caminho (mapa, conta da rota, Google Maps). */
export function paradaConcluida(item: object): boolean {
  return ehAvulsa(item) && paradaSalva(item.avulsa) && item.avulsa.situacao !== 'pendente'
}

/** O item ainda conta no caminho do caminhão (o pedido sempre; a parada, só pendente). */
export function ativaNaRota(item: object): boolean {
  return !paradaConcluida(item)
}

/** O item como vai ao banco na ordem da rota. */
export function refDoItem(item: { card_id: number } | ItemAvulsa): ItemDaOrdem {
  if (ehAvulsa(item) && paradaSalva(item.avulsa)) return { t: 'a', id: item.avulsa.id }
  return { t: 'p', id: item.card_id }
}

/** Na aba Programar: o pedido pelo card, a parada nova pela chave da tela. */
export function refDaMontagem(item: { card_id: number } | ItemAvulsa): ItemDaMontagem {
  if (!ehAvulsa(item)) return { t: 'p', id: item.card_id }
  if (paradaSalva(item.avulsa)) throw new Error('A parada já salva não entra na montagem.')
  return { t: 'n', k: item.avulsa.chave }
}

/**
 * Pedidos e paradas numa lista só, na ORDEM da rota: o rascunho (arrastou e
 * não salvou), a ordem salva (a mesma sequência para os dois) ou, sem ela, a
 * sugestão do mais perto — a mesma regra de `ordemDaRota`.
 */
export function misturarNaOrdem<P extends ComPonto & { ordem?: number | null }>(
  pedidos: P[],
  paradas: ParadaAvulsa[],
  opcoes: { rascunho?: number[] | null } = {},
): (P | ItemAvulsa)[] {
  return ordemDaRota<P | ItemAvulsa>([...pedidos, ...paradas.map(itemDaParada)], opcoes)
}

/**
 * A ordem para o banco quando a rota JÁ tem itens (aba Programar): o que a
 * rota já tinha, na ordem dela, e o que se programou agora no FIM, na ordem da
 * tela — as paradas novas trocadas pelo id que o banco deu.
 */
export function ordemComONovoNoFim(
  jaNaRota: ItemDaOrdem[],
  tela: ItemDaMontagem[],
  idsDasNovas: Record<string, number>,
): ItemDaOrdem[] {
  const novos = tela.flatMap((r): ItemDaOrdem[] => {
    if (r.t === 'p') return [r]
    const id = idsDasNovas[r.k]
    return id ? [{ t: 'a', id }] : []
  })
  return [...jaNaRota, ...novos]
}

const chaveDaRef = (r: ItemDaOrdem) => `${r.t}${r.id}`

/**
 * A ordem da tela completada com o que o banco tem e a tela não mostra (o
 * resto da rota que está na página que ainda não veio) — no fim, na ordem do
 * banco. Nula quando a tela mostra o que a rota não tem mais (mudou noutra
 * tela): aí a pessoa recarrega antes de salvar.
 */
export function completarOrdem(tela: ItemDaOrdem[], banco: ItemDaOrdem[]): ItemDaOrdem[] | null {
  const noBanco = new Set(banco.map(chaveDaRef))
  if (tela.some((r) => !noBanco.has(chaveDaRef(r)))) return null
  const naTela = new Set(tela.map(chaveDaRef))
  return [...tela, ...banco.filter((r) => !naTela.has(chaveDaRef(r)))]
}

/**
 * Encaixa os itens MÓVEIS (a parada que o entregador pôs) onde a pessoa os
 * deixou na lista visível, sem mexer na ordem relativa de nenhum outro — nem
 * dos escondidos (a parada já feita, que não aparece na lista): cada móvel
 * entra logo ANTES do item fixo que vem depois dele na ordem nova (no fim, se
 * nenhum vem). É o que o banco confere no entregador: a ordem do que não é
 * parada dele fica como estava.
 */
export function encaixarMoveis<T>(
  completa: T[],
  visiveisNaNovaOrdem: T[],
  movel: (x: T) => boolean,
): T[] {
  const antesDe = new Map<T, T[]>()
  let soltos: T[] = []
  for (const x of visiveisNaNovaOrdem) {
    if (movel(x)) soltos.push(x)
    else if (soltos.length > 0) {
      antesDe.set(x, soltos)
      soltos = []
    }
  }
  const resultado: T[] = []
  for (const x of completa) {
    if (movel(x)) continue
    resultado.push(...(antesDe.get(x) ?? []), x)
  }
  resultado.push(...soltos)
  // o móvel que a lista nova não trouxe (a rota mudou) fica no fim
  const postos = new Set(resultado)
  return [...resultado, ...completa.filter((x) => movel(x) && !postos.has(x))]
}

// ---------------------------------------------------------------------------
// O mapa e a navegação
// ---------------------------------------------------------------------------

/**
 * Os marcadores da rota no mapa da programação, numerados pela posição na
 * LISTA (a parada sem ponto conta no número). A parada concluída fica de fora;
 * a avulsa vai com o marcador próprio.
 */
export function marcadoresDaRota(
  lista: ((ParadaMinima & ComPonto) | ItemAvulsa)[],
): ParadaNoMapa[] {
  return lista.flatMap((p, i): ParadaNoMapa[] => {
    if (!temPonto(p) || !ativaNaRota(p)) return []
    if (ehAvulsa(p)) {
      return [
        {
          parada: {
            card_id: p.card_id,
            numero: 0,
            cliente_nome: p.avulsa.titulo,
            total_unidades: 0,
            latitude: p.latitude,
            longitude: p.longitude,
          },
          numero: i + 1,
          avulsa: { titulo: p.avulsa.titulo, endereco: p.avulsa.endereco },
        },
      ]
    }
    return [{ parada: p, numero: i + 1 }]
  })
}

/** Os números da lista que aparecem no mapa (para o resumo da ida e da volta). */
export function numerosNoMapaDaLista(lista: object[]): number[] {
  return lista.flatMap((p, i) => (temPonto(p as ComPonto) && ativaNaRota(p) ? [i + 1] : []))
}

type ComEndereco = {
  latitude: number | null
  longitude: number | null
  endereco: string | null
  numero_endereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
}

/** A parada avulsa no formato que o Google Maps e o Waze recebem (o pino, ou o endereço escrito). */
export function lugarDaAvulsa(a: {
  latitude: number | null
  longitude: number | null
  endereco: string
}): ComEndereco {
  return {
    latitude: a.latitude,
    longitude: a.longitude,
    endereco: a.endereco,
    numero_endereco: null,
    bairro: null,
    cidade: null,
    uf: null,
  }
}

/** O item (pedido ou parada) para os botões de navegação. */
export function paraNavegar<P extends ComEndereco>(item: P | ItemAvulsa): ComEndereco {
  return ehAvulsa(item) ? lugarDaAvulsa(item.avulsa) : item
}

// ---------------------------------------------------------------------------
// Entregas do dia (o entregador)
// ---------------------------------------------------------------------------

export type ItemDoDia =
  | { tipo: 'pedido'; posicao: number; entrega: EntregaDoDia }
  | { tipo: 'avulsa'; posicao: number; parada: ParadaAvulsa }

/** O id do item na lista mista (o card do pedido; −id da parada). */
export const idDoItemDoDia = (i: ItemDoDia) =>
  i.tipo === 'pedido' ? i.entrega.card_id : -i.parada.id

/**
 * A rota do dia com as entregas e as paradas MISTURADAS pela ordem da rota
 * (a mesma de "Já programadas"), numeradas de novo na tela. Sem a ordem no
 * dado (o banco de antes) e sem parada, fica a numeração que veio.
 */
export function rotaDoDia(entregas: EntregaDoDia[], paradas: ParadaAvulsa[]): ItemDoDia[] {
  if (
    paradas.length === 0 &&
    (entregas.length === 0 || entregas.some((e) => e.ordem === undefined))
  )
    return entregas.map((e) => ({ tipo: 'pedido', posicao: e.posicao, entrega: e }))
  return misturarNaOrdem(entregas, paradas).map((x, i): ItemDoDia => {
    if (ehAvulsa(x)) return { tipo: 'avulsa', posicao: i + 1, parada: x.avulsa as ParadaAvulsa }
    return { tipo: 'pedido', posicao: i + 1, entrega: { ...x, posicao: i + 1 } }
  })
}

/** O que ainda está para fazer na rota: o pedido não entregue e a parada pendente. */
export function pendenteNoDia(i: ItemDoDia): boolean {
  return i.tipo === 'pedido' ? !i.entrega.entregue_em : i.parada.situacao === 'pendente'
}

/** No celular, só a parada que a pessoa pôs e que ainda não fez muda de lugar. */
export function arrastavelNoCelular(i: ItemDoDia): boolean {
  return i.tipo === 'avulsa' && i.parada.sou_autor && i.parada.situacao === 'pendente'
}

/**
 * A ordem inteira da rota do dia para o banco: os pedidos ainda não entregues
 * e TODAS as paradas (as feitas também). O pedido entregue não entra — o
 * banco já não o conta. Com `visiveisNaNovaOrdem` (a lista do "momento da
 * parada"), só a parada que a pessoa pode arrastar muda de lugar.
 */
export function ordemDoDiaParaOBanco(
  itens: ItemDoDia[],
  visiveisNaNovaOrdem?: ItemDoDia[],
): ItemDaOrdem[] {
  const naOrdem = itens.filter((i) => i.tipo === 'avulsa' || !i.entrega.entregue_em)
  const completa = visiveisNaNovaOrdem
    ? encaixarMoveis(naOrdem, visiveisNaNovaOrdem, arrastavelNoCelular)
    : naOrdem
  return completa.map((i): ItemDaOrdem =>
    i.tipo === 'pedido' ? { t: 'p', id: i.entrega.card_id } : { t: 'a', id: i.parada.id },
  )
}

// ---------------------------------------------------------------------------
// "Já programadas": a janela de dias das paradas
// ---------------------------------------------------------------------------

/** O banco devolve as paradas de até 62 dias por vez. */
export const JANELA_PARADAS_DIAS = 62

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000)
}

/**
 * Os dias das paradas que a aba "Já programadas" pede: do primeiro ao último
 * dia das rotas carregadas. Passou de 62 dias (algo programado muito longe),
 * a janela fica em volta da rota em foco (`ancora`) — a de fora do alcance
 * não mostra a parada (dívida anotada na tela).
 */
export function janelaDasParadas(
  dias: string[],
  ancora: string | null,
): { de: string; ate: string } | null {
  if (dias.length === 0) return null
  const ordenados = [...dias].sort()
  const primeiro = ordenados[0]
  const ultimo = ordenados[ordenados.length - 1]
  if (diasEntre(primeiro, ultimo) <= JANELA_PARADAS_DIAS) return { de: primeiro, ate: ultimo }
  const centro = ancora && ancora >= primeiro && ancora <= ultimo ? ancora : primeiro
  const metade = Math.floor(JANELA_PARADAS_DIAS / 2)
  let de = somarDias(centro, -metade)
  if (de < primeiro) de = primeiro
  let ate = somarDias(de, JANELA_PARADAS_DIAS)
  if (ate > ultimo) {
    ate = ultimo
    const recuado = somarDias(ultimo, -JANELA_PARADAS_DIAS)
    de = recuado > primeiro ? recuado : primeiro
  }
  return { de, ate }
}
