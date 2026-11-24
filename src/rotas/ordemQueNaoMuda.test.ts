import { describe, expect, it, vi } from 'vitest'
import type { ParadaAvulsa } from './api'
import { itemDaParada, ordemQueFica } from './paradasAvulsas'
import type { ComPonto } from './proximidade'
import { inserirNaRota, ordemDaRota, ordemSugerida } from './rotaRuas'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

/**
 * SESSAO-56 · bloco B (pedido do dono, 23/11): "a rota não deve renovar a
 * ordem dos pinos, apenas manter a que já foi definida, tirando apenas o pino
 * removido". A sugestão do mais perto só PROPÕE; a ordem que apareceu na tela
 * é a que vale. Aqui a lógica pura dos três lugares: a montagem (a lista
 * guardada da aba Programar), a inclusão e a ordem que vai ao banco no "tirar".
 */
type Parada = ComPonto & { ordem?: number | null }

// Natal-RN, a partir da fábrica (Planalto) — os mesmos pontos de rotaRuas.test.ts
const parnamirim: Parada = { card_id: 4, latitude: -5.915, longitude: -35.263 }
const centro: Parada = { card_id: 1, latitude: -5.795, longitude: -35.209 }
const zonaNorte: Parada = { card_id: 6, latitude: -5.75, longitude: -35.25 }
const pontaNegra: Parada = { card_id: 3, latitude: -5.88, longitude: -35.17 }
const candelaria: Parada = { card_id: 7, latitude: -5.842, longitude: -35.214 }
const semPonto: Parada = { card_id: 5, latitude: null, longitude: null }

const ids = (lista: { card_id: number }[]) => lista.map((p) => p.card_id)

/** A montagem como a aba Programar a guarda: a lista de ids e os gestos. */
function montagem() {
  let itens: Parada[] = []
  let rascunho: number[] = []
  const naTela = () => ordemDaRota(itens, { rascunho })
  return {
    incluir(p: Parada) {
      const ordem = naTela()
      itens = [...itens, p]
      rascunho = ids(inserirNaRota(ordem, p))
    },
    tirar(id: number) {
      rascunho = ids(naTela()).filter((x) => x !== id)
      itens = itens.filter((p) => p.card_id !== id)
    },
    arrastar(novos: number[]) {
      rascunho = novos
    },
    voltarSugestao() {
      rascunho = ids(ordemSugerida(itens))
    },
    /** O ponto do endereço chegou (a busca achou) — o dado muda, o gesto não existe. */
    chegouPonto(id: number, latitude: number, longitude: number) {
      itens = itens.map((p) => (p.card_id === id ? { ...p, latitude, longitude } : p))
    },
    ordem: () => ids(naTela()),
  }
}

describe('a montagem: tirar um pedido só o tira', () => {
  it('5 pedidos sem arrastar: tirar o 3º deixa os outros na MESMA sequência (antes: 1, 2, 4, 5)', () => {
    const m = montagem()
    for (const p of [centro, zonaNorte, pontaNegra, parnamirim, candelaria]) m.incluir(p)
    const antes = m.ordem()
    expect(antes).toHaveLength(5)
    const terceiro = antes[2]
    m.tirar(terceiro)
    expect(m.ordem()).toEqual(antes.filter((id) => id !== terceiro))
  })

  it('o defeito de antes, provado: a sugestão recalculada do que sobra trocava os números', () => {
    // fábrica → Parnamirim → Ponta Negra → Centro → Zona Norte; sem Parnamirim a
    // sugestão recomeça pelo Centro (o mais perto da fábrica) — a ordem virava outra
    const todos = [centro, zonaNorte, pontaNegra, parnamirim]
    const sugestao = ids(ordemSugerida(todos))
    expect(sugestao).toEqual([4, 3, 1, 6])
    const semO1 = ids(ordemSugerida(todos.filter((p) => p.card_id !== 4)))
    expect(semO1).not.toEqual(sugestao.filter((id) => id !== 4))
  })

  it('depois de arrastar o mais longe para 1º: ele continua 1º quando outro sai', () => {
    const m = montagem()
    for (const p of [centro, pontaNegra, parnamirim, zonaNorte]) m.incluir(p)
    const semALonge = m.ordem().filter((id) => id !== zonaNorte.card_id)
    m.arrastar([zonaNorte.card_id, ...semALonge])
    m.tirar(semALonge[1])
    expect(m.ordem()).toEqual([zonaNorte.card_id, semALonge[0], semALonge[2]])
  })
})

describe('a montagem: incluir não muda a ordem relativa dos que já estavam', () => {
  it('o novo entra onde o caminho aumenta menos — os outros seguem na mesma sequência', () => {
    const m = montagem()
    for (const p of [parnamirim, zonaNorte, centro]) m.incluir(p)
    const antes = m.ordem()
    m.incluir(candelaria)
    expect(m.ordem().filter((id) => id !== candelaria.card_id)).toEqual(antes)
    m.incluir(pontaNegra)
    expect(m.ordem().filter((id) => id !== candelaria.card_id && id !== pontaNegra.card_id)).toEqual(antes)
  })

  it('o lugar é o mais barato: entre o Centro e a Zona Norte cabe quem fica no meio do caminho', () => {
    const noMeio: Parada = { card_id: 9, latitude: -5.772, longitude: -35.23 }
    expect(ids(inserirNaRota([parnamirim, centro, zonaNorte], noMeio))).toEqual([4, 1, 9, 6])
  })

  it('com uma parada só (antes ou depois dá a mesma volta): o mais perto da fábrica primeiro', () => {
    expect(ids(inserirNaRota([zonaNorte], candelaria))).toEqual([7, 6])
    expect(ids(inserirNaRota([candelaria], zonaNorte))).toEqual([7, 6])
  })

  it('a ordem ajustada à mão (o longe primeiro) é respeitada: o novo não a desfaz', () => {
    const naMao = [zonaNorte, parnamirim, centro]
    const depois = ids(inserirNaRota(naMao, candelaria))
    expect(depois.filter((id) => id !== 7)).toEqual([6, 4, 1])
  })

  it('pedido sem ponto entra no FIM — e quando o ponto chega, NÃO muda de lugar sozinho', () => {
    const m = montagem()
    for (const p of [parnamirim, semPonto, centro]) m.incluir(p)
    expect(m.ordem().at(-1)).toBe(semPonto.card_id)
    const antes = m.ordem()
    // o ponto dele chega (pertinho da fábrica — pela sugestão viraria o 1º)
    m.chegouPonto(semPonto.card_id, -5.85, -35.25)
    expect(m.ordem()).toEqual(antes)
  })

  it('quem tem ponto entra ANTES dos sem ponto (eles seguem no fim)', () => {
    expect(ids(inserirNaRota([semPonto], centro))).toEqual([1, 5])
  })

  it('"Voltar à sugestão" recalcula o mais perto primeiro — e o que fica guardado é a sugestão daquele momento', () => {
    const m = montagem()
    for (const p of [zonaNorte, centro, parnamirim, pontaNegra]) m.incluir(p)
    m.arrastar([6, 1, 4, 3])
    m.voltarSugestao()
    expect(m.ordem()).toEqual([4, 3, 1, 6])
    m.tirar(4)
    expect(m.ordem()).toEqual([3, 1, 6])
  })
})

describe('"Já programadas" e o entregador: a ordem que FICA vai junto no gesto de tirar', () => {
  const parada = (id: number, ordem: number | null, latitude = -5.83, longitude = -35.2): ParadaAvulsa =>
    ({ id, data: '2026-11-24', caminhao_id: 1, rota: 1, ordem, titulo: `Parada ${id}`, endereco: 'Rua de Teste, 1', latitude, longitude, observacao: null, situacao: 'pendente', criada_por: null, sou_autor: false, concluida_em: null, nao_feita_motivo: null }) as ParadaAvulsa

  it('rota SEM ordem salva (as de antes): vai a sugestão que a tela mostrava, menos o que saiu', () => {
    const rota = [centro, zonaNorte, pontaNegra, parnamirim].map((p) => ({ ...p, ordem: null }))
    // a tela mostrava 4, 3, 1, 6 — tirar o 4 manda 3, 1, 6 (e NÃO a sugestão nova do que sobrou)
    expect(ordemQueFica(rota, [], 4)).toEqual([
      { t: 'p', id: 3 },
      { t: 'p', id: 1 },
      { t: 'p', id: 6 },
    ])
  })

  it('rota COM ordem salva: os outros na ordem salva (o banco pode guardar com buraco; a tela numera 1, 2, 3)', () => {
    const rota: Parada[] = [
      { ...zonaNorte, ordem: 1 },
      { ...centro, ordem: 2 },
      { ...parnamirim, ordem: 3 },
      { ...pontaNegra, ordem: 4 },
    ]
    expect(ordemQueFica(rota, [], 1).map((r) => r.id)).toEqual([6, 4, 3])
    // e a tela, com o buraco no banco (1, 3, 4), numera na sequência
    const comBuraco = rota.filter((p) => p.card_id !== 1)
    expect(ids(ordemDaRota(comBuraco))).toEqual([6, 4, 3])
  })

  it('com parada avulsa no meio: a parada e os pedidos ficam onde estavam; tirar a parada tira só ela', () => {
    const rota: Parada[] = [
      { ...zonaNorte, ordem: 1 },
      { ...centro, ordem: 3 },
    ]
    const avulsas = [itemDaParada(parada(50, 2))]
    expect(ordemQueFica(rota, avulsas, 6)).toEqual([
      { t: 'a', id: 50 },
      { t: 'p', id: 1 },
    ])
    expect(ordemQueFica(rota, avulsas, -50)).toEqual([
      { t: 'p', id: 6 },
      { t: 'p', id: 1 },
    ])
  })

  it('o último item da rota sai: a lista que fica é vazia', () => {
    expect(ordemQueFica([{ ...centro, ordem: null }], [], 1)).toEqual([])
  })
})
