import { describe, expect, it, vi } from 'vitest'
import { nomeDoLugar, pecasPorExtenso, textoDoSelo } from './avisoPcp'
import {
  frasePecasLiberadas,
  fraseQueFicam,
  produtosPorExtenso,
  textoEstadoTiny,
} from './pcpSaida'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

/**
 * SESSAO-48 (frente 2) ↪️ SESSAO-50 (bloco B): os textos do aviso da peça
 * cancelada no PCP (o selo, com o laço) e os do "Ocultar do PCP" / "Cancelar
 * pedido" — quantas peças saem e onde, quantas ficam, e o que o Tiny respondeu.
 */
describe('o selo do pedido no PCP', () => {
  it('diz o que houve e o número quando é mais de uma peça', () => {
    expect(textoDoSelo({ pecas: 1, motivo: 'cancelada' })).toBe('Peça cancelada na produção')
    expect(textoDoSelo({ pecas: 3, motivo: 'cancelada' })).toBe('3 peças canceladas na produção')
    expect(textoDoSelo({ pecas: 1, motivo: 'nao_encontrada' })).toBe('Peça não encontrada')
    expect(textoDoSelo({ pecas: 2, motivo: 'nao_encontrada' })).toBe('2 peças não encontradas')
    // o aviso aberto sem peça contada (a peça voltou) ainda fala no singular
    expect(textoDoSelo({ pecas: 0, motivo: 'cancelada' })).toBe('Peça cancelada na produção')
  })

  it('o laço (3 ou mais canceladas em 24 h) muda o selo', () => {
    expect(textoDoSelo({ pecas: 31, motivo: 'cancelada', laco: true })).toBe(
      'Peças canceladas várias vezes',
    )
    expect(textoDoSelo({ pecas: 2, motivo: 'cancelada', laco: false })).toBe(
      '2 peças canceladas na produção',
    )
  })
})

describe('as palavras de sempre', () => {
  it('peças, produtos e o lugar (a coluna; sem coluna, o setor)', () => {
    expect(pecasPorExtenso(1)).toBe('1 peça')
    expect(pecasPorExtenso(4)).toBe('4 peças')
    expect(produtosPorExtenso(1)).toBe('1 produto')
    expect(produtosPorExtenso(7)).toBe('7 produtos')
    expect(nomeDoLugar({ setor: 'MONTAGEM', etapa: 'MONTANDO' })).toBe('MONTANDO')
    expect(nomeDoLugar({ setor: 'MONTAGEM', etapa: null })).toBe('MONTAGEM')
    expect(nomeDoLugar({ setor: null, etapa: null })).toBe('outro lugar')
  })
})

describe('"Ocultar do PCP": a pergunta das peças já liberadas', () => {
  it('a frase da demanda: quantas e onde', () => {
    expect(
      frasePecasLiberadas({
        ocultaveis: 2,
        ficam: 0,
        programado: false,
        onde: [
          { setor: 'LIMPEZA E EMBALAGEM', etapa: 'A LIMPAR', pronta: false, fica: false, pecas: 1 },
          { setor: 'PEDIDOS EM AGUARDO', etapa: null, pronta: true, fica: false, pecas: 1 },
        ],
      }),
    ).toBe(
      'Este pedido tem 2 peças já liberadas (1 em A LIMPAR, 1 em PEDIDOS EM AGUARDO). Ocultar também essas peças?',
    )
  })

  it('uma peça só, no singular; sem peça, não pergunta', () => {
    expect(
      frasePecasLiberadas({
        ocultaveis: 1,
        ficam: 0,
        programado: false,
        onde: [{ setor: 'MONTAGEM', etapa: 'MONTANDO', pronta: false, fica: false, pecas: 1 }],
      }),
    ).toBe('Este pedido tem 1 peça já liberada (1 em MONTANDO). Ocultar também essa peça?')
    expect(frasePecasLiberadas({ ocultaveis: 0, ficam: 0, programado: false, onde: [] })).toBeNull()
  })

  it('as que ficam de qualquer jeito (na rota ou entregues) aparecem à parte', () => {
    expect(
      fraseQueFicam({
        ocultaveis: 1,
        ficam: 1,
        programado: false,
        onde: [
          { setor: 'MONTAGEM', etapa: 'MONTANDO', pronta: false, fica: false, pecas: 1 },
          { setor: 'ROTAS', etapa: null, pronta: true, fica: true, pecas: 1 },
        ],
      }),
    ).toBe('1 peça fica com o pedido de qualquer jeito (1 em ROTAS) — já saiu para a rota ou foi entregue.')
    expect(fraseQueFicam({ ocultaveis: 2, ficam: 0, programado: false, onde: [] })).toBeNull()
  })
})

describe('"Cancelar pedido": o que o Tiny respondeu', () => {
  it('cada estado da fila de saída tem a sua frase; o confirmado não precisa de aviso', () => {
    expect(textoEstadoTiny('esperando')).toMatch(/O Tiny ainda não confirmou o cancelamento/)
    expect(textoEstadoTiny('falhando')).toMatch(/está tentando de novo/)
    expect(textoEstadoTiny('parado')).toMatch(/parou de tentar/)
    expect(textoEstadoTiny('aceito')).toMatch(/O Tiny aceitou/)
    expect(textoEstadoTiny('confirmado')).toBeNull()
    expect(textoEstadoTiny(null)).toBeNull()
  })
})
