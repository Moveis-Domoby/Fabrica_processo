import { describe, expect, it } from 'vitest'
import type { EntregaDoDia, ParadaAvulsa } from './api'
import {
  arrastavelNoCelular,
  ativaNaRota,
  completarOrdem,
  ehAvulsa,
  encaixarMoveis,
  itemDaParada,
  itemDoRascunho,
  janelaDasParadas,
  marcadoresDaRota,
  misturarNaOrdem,
  numerosNoMapaDaLista,
  ordemComONovoNoFim,
  ordemDoDiaParaOBanco,
  paraNavegar,
  pendenteNoDia,
  refDaMontagem,
  refDoItem,
  rotaDoDia,
} from './paradasAvulsas'
import type { ItemDoDia } from './paradasAvulsas'

const parada = (id: number, extras: Partial<ParadaAvulsa> = {}): ParadaAvulsa => ({
  id,
  data: '2026-10-27',
  caminhao_id: 1,
  rota: 1,
  ordem: null,
  titulo: `Parada ${id}`,
  endereco: `Rua ${id}, Natal`,
  latitude: null,
  longitude: null,
  observacao: null,
  situacao: 'pendente',
  criada_por: 'Fulano',
  sou_autor: false,
  concluida_em: null,
  nao_feita_motivo: null,
  ...extras,
})

const pedido = (card_id: number, extras: Record<string, unknown> = {}) => ({
  card_id,
  numero: 1000 + card_id,
  cliente_nome: `Cliente ${card_id}`,
  total_unidades: 2,
  latitude: null as number | null,
  longitude: null as number | null,
  ordem: null as number | null,
  endereco: `Av. ${card_id}`,
  numero_endereco: '10',
  bairro: 'Centro',
  cidade: 'Natal',
  uf: 'RN',
  ...extras,
})

const entrega = (card_id: number, extras: Partial<EntregaDoDia> = {}): EntregaDoDia =>
  ({
    posicao: 0,
    entregue_em: null,
    ...pedido(card_id),
    ...extras,
  }) as EntregaDoDia

const ids = (lista: { card_id: number }[]) => lista.map((x) => x.card_id)

describe('misturarNaOrdem — pedidos e paradas avulsas numa lista só (SESSAO-41)', () => {
  it('a ordem salva é a MESMA sequência para os dois: a parada cai entre os pedidos', () => {
    const r = misturarNaOrdem(
      [pedido(10, { ordem: 1 }), pedido(11, { ordem: 3 })],
      [parada(7, { ordem: 2 })],
    )
    expect(ids(r)).toEqual([10, -7, 11])
    expect(ehAvulsa(r[1])).toBe(true)
  })

  it('sem ordem salva, a parada com ponto entra na sugestão do mais perto; a sem ponto vai para o fim', () => {
    const r = misturarNaOrdem(
      [
        pedido(1, { latitude: -5.84, longitude: -35.25 }),
        pedido(2, { latitude: -5.7, longitude: -35.2 }),
      ],
      [parada(5, { latitude: -5.8, longitude: -35.24 }), parada(6)],
    )
    expect(ids(r)).toEqual([1, -5, 2, -6])
  })

  it('o rascunho (arrastou e não salvou) manda; quem não está nele vai para o fim', () => {
    const r = misturarNaOrdem([pedido(1), pedido(2)], [parada(3, { ordem: 1 })], {
      rascunho: [2, -3],
    })
    expect(ids(r)).toEqual([2, -3, 1])
  })
})

describe('refDoItem / refDaMontagem — o que vai ao banco na ordem', () => {
  it('o pedido pelo card, a parada salva pelo id dela (nunca o número negativo)', () => {
    expect(refDoItem(pedido(9))).toEqual({ t: 'p', id: 9 })
    expect(refDoItem(itemDaParada(parada(4)))).toEqual({ t: 'a', id: 4 })
  })

  it('na aba Programar, a parada nova vai pela chave da tela', () => {
    const rascunho = itemDoRascunho(
      {
        chave: 'k-1',
        titulo: 'Buscar',
        endereco: 'Rua A',
        latitude: null,
        longitude: null,
        observacao: null,
      },
      -1,
    )
    expect(rascunho.card_id).toBe(-1)
    expect(refDaMontagem(rascunho)).toEqual({ t: 'n', k: 'k-1' })
    expect(refDaMontagem(pedido(3))).toEqual({ t: 'p', id: 3 })
  })

  it('o que a rota já tinha vem primeiro e o novo no FIM, com o id que o banco deu', () => {
    expect(
      ordemComONovoNoFim(
        [
          { t: 'p', id: 1 },
          { t: 'a', id: 8 },
        ],
        [
          { t: 'n', k: 'x' },
          { t: 'p', id: 5 },
        ],
        { x: 20 },
      ),
    ).toEqual([
      { t: 'p', id: 1 },
      { t: 'a', id: 8 },
      { t: 'a', id: 20 },
      { t: 'p', id: 5 },
    ])
  })
})

describe('completarOrdem — a ordem da tela com o resto da rota (a página que não veio)', () => {
  it('o que o banco tem e a tela não mostra vai no fim, na ordem do banco', () => {
    expect(
      completarOrdem(
        [
          { t: 'a', id: 2 },
          { t: 'p', id: 1 },
        ],
        [
          { t: 'p', id: 1 },
          { t: 'p', id: 9 },
          { t: 'a', id: 2 },
        ],
      ),
    ).toEqual([
      { t: 'a', id: 2 },
      { t: 'p', id: 1 },
      { t: 'p', id: 9 },
    ])
  })

  it('a tela mostra o que a rota não tem mais: nula (recarrega antes de salvar)', () => {
    expect(completarOrdem([{ t: 'p', id: 1 }], [{ t: 'p', id: 2 }])).toBeNull()
  })
})

describe('a parada já marcada sai do caminho, mas segue na ordem', () => {
  const feita = itemDaParada(parada(1, { situacao: 'feita', latitude: -5.8, longitude: -35.2 }))
  const pendente = itemDaParada(parada(2, { latitude: -5.81, longitude: -35.21 }))
  const comPonto = pedido(3, { latitude: -5.82, longitude: -35.22 })
  const semPonto = pedido(4)

  it('ativaNaRota: o pedido sempre; a parada só pendente', () => {
    expect(ativaNaRota(comPonto)).toBe(true)
    expect(ativaNaRota(pendente)).toBe(true)
    expect(ativaNaRota(feita)).toBe(false)
  })

  it('o mapa numera pela LISTA: a feita e a sem ponto não aparecem, mas contam no número', () => {
    const lista = [feita, semPonto, pendente, comPonto]
    const marcadores = marcadoresDaRota(lista)
    expect(marcadores.map((m) => m.numero)).toEqual([3, 4])
    expect(marcadores[0].avulsa).toEqual({ titulo: 'Parada 2', endereco: 'Rua 2, Natal' })
    expect(marcadores[1].avulsa).toBeUndefined()
    expect(numerosNoMapaDaLista(lista)).toEqual([3, 4])
  })

  it('para navegar, a parada vai pelo pino ou pelo endereço escrito', () => {
    expect(paraNavegar(itemDaParada(parada(5)))).toMatchObject({
      latitude: null,
      endereco: 'Rua 5, Natal',
      bairro: null,
    })
  })
})

describe('rotaDoDia — as entregas e as paradas do entregador, numeradas de novo', () => {
  it('mistura pela ordem e numera 1, 2, 3 (a entregue também conta)', () => {
    const r = rotaDoDia(
      [entrega(1, { ordem: 1, entregue_em: '2026-10-27T13:00:00Z' }), entrega(2, { ordem: 3 })],
      [parada(9, { ordem: 2 })],
    )
    expect(r.map((i) => [i.tipo, i.posicao])).toEqual([
      ['pedido', 1],
      ['avulsa', 2],
      ['pedido', 3],
    ])
    const ultimo = r[2]
    expect(ultimo.tipo === 'pedido' && ultimo.entrega.posicao).toBe(3)
  })

  it('o banco de antes (sem a ordem) e sem parada: fica a numeração que veio', () => {
    const veio = [{ ...entrega(1), posicao: 4, ordem: undefined }] as EntregaDoDia[]
    expect(rotaDoDia(veio, [])[0].posicao).toBe(4)
  })
})

describe('o entregador só muda o lugar da parada dele (no celular)', () => {
  const itens: ItemDoDia[] = rotaDoDia(
    [
      entrega(1, { ordem: 1, entregue_em: '2026-10-27T12:00:00Z' }),
      entrega(2, { ordem: 2 }),
      entrega(3, { ordem: 4 }),
    ],
    [
      parada(7, { ordem: 3, situacao: 'feita' }),
      parada(8, { ordem: 5, sou_autor: true }),
      parada(9, { ordem: 6, sou_autor: false }),
    ],
  )

  it('arrastável: só a parada que eu pus e ainda está pendente', () => {
    const porId = (id: number) => itens.find((i) => i.tipo === 'avulsa' && i.parada.id === id)!
    expect(arrastavelNoCelular(porId(8))).toBe(true)
    expect(arrastavelNoCelular(porId(9))).toBe(false)
    expect(arrastavelNoCelular(porId(7))).toBe(false)
    expect(itens.filter((i) => i.tipo === 'pedido').some(arrastavelNoCelular)).toBe(false)
  })

  it('a ordem para o banco: sem o pedido entregue, com TODAS as paradas (a feita também)', () => {
    expect(ordemDoDiaParaOBanco(itens)).toEqual([
      { t: 'p', id: 2 },
      { t: 'a', id: 7 },
      { t: 'p', id: 3 },
      { t: 'a', id: 8 },
      { t: 'a', id: 9 },
    ])
  })

  // o que o banco confere no entregador: a ordem do que NÃO é parada dele fica igual
  const semAsMinhas = (ordem: { t: string; id: number }[]) =>
    ordem.filter((r) => !(r.t === 'a' && r.id === 8))

  it('mover a minha parada para o começo: a feita (escondida) e os outros não trocam de ordem', () => {
    const visiveis = itens.filter(pendenteNoDia) // 2, 3, 8, 9
    const [p2, p3, a8, a9] = visiveis
    const nova = ordemDoDiaParaOBanco(itens, [a8, p2, p3, a9])
    expect(nova).toEqual([
      { t: 'a', id: 8 },
      { t: 'p', id: 2 },
      { t: 'a', id: 7 },
      { t: 'p', id: 3 },
      { t: 'a', id: 9 },
    ])
    expect(semAsMinhas(nova)).toEqual(semAsMinhas(ordemDoDiaParaOBanco(itens)))
  })

  it('mover a minha parada para o meio: entra logo antes do pedido que vem depois dela', () => {
    const [p2, p3, a8, a9] = itens.filter(pendenteNoDia)
    const nova = ordemDoDiaParaOBanco(itens, [p2, a8, p3, a9])
    expect(nova).toEqual([
      { t: 'p', id: 2 },
      { t: 'a', id: 7 },
      { t: 'a', id: 8 },
      { t: 'p', id: 3 },
      { t: 'a', id: 9 },
    ])
    expect(semAsMinhas(nova)).toEqual(semAsMinhas(ordemDoDiaParaOBanco(itens)))
  })

  it('encaixarMoveis: só o móvel muda; no fim da lista, ele vai para o fim', () => {
    const movel = (x: string) => x.startsWith('m')
    expect(encaixarMoveis(['a', 'h', 'b', 'm1', 'c'], ['m1', 'a', 'b', 'c'], movel)).toEqual([
      'm1',
      'a',
      'h',
      'b',
      'c',
    ])
    expect(encaixarMoveis(['m1', 'a', 'h', 'b'], ['a', 'b', 'm1'], movel)).toEqual([
      'a',
      'h',
      'b',
      'm1',
    ])
    // a lista nova não trouxe o móvel: ele não some
    expect(encaixarMoveis(['a', 'm1', 'b'], ['a', 'b'], movel)).toEqual(['a', 'b', 'm1'])
  })
})

describe('janelaDasParadas — os dias que "Já programadas" pede (até 62 por vez)', () => {
  it('sem dia, nada a pedir', () => {
    expect(janelaDasParadas([], null)).toBeNull()
  })

  it('do primeiro ao último dia mostrado', () => {
    expect(janelaDasParadas(['2026-10-30', '2026-10-27', '2026-11-05'], null)).toEqual({
      de: '2026-10-27',
      ate: '2026-11-05',
    })
  })

  it('passou de 62 dias: a janela fica em volta da rota em foco, dentro do que está mostrado', () => {
    const janela = janelaDasParadas(['2026-01-10', '2026-10-27', '2026-12-31'], '2026-10-27')!
    expect(janela.de <= '2026-10-27' && janela.ate >= '2026-10-27').toBe(true)
    const dias = (Date.parse(janela.ate) - Date.parse(janela.de)) / 86_400_000
    expect(dias).toBeLessThanOrEqual(62)
  })

  it('a âncora no fim da faixa: a janela recua e termina no último dia', () => {
    expect(janelaDasParadas(['2026-01-01', '2026-12-31'], '2026-12-31')).toEqual({
      de: '2026-10-30',
      ate: '2026-12-31',
    })
  })
})
