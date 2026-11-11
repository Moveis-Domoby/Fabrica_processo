import { describe, expect, it } from 'vitest'
import {
  MOTIVOS_REMOCAO,
  erroDoTextoRemocao,
  frasesPecasQueSeguem,
  nomeDoLugar,
  textoDoSelo,
} from './avisoPcp'

/**
 * SESSAO-48 (frente 2): os textos do aviso da peça cancelada no PCP — o selo,
 * os motivos de "Remover do PCP" e o aviso das peças que seguem como estão.
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
})

describe('os motivos de "Remover do PCP"', () => {
  it('são os três do dono, e só os dois últimos pedem o texto', () => {
    expect(MOTIVOS_REMOCAO.map((m) => m.rotulo)).toEqual([
      'O pedido foi cancelado',
      'Tirar o pedido da linha de produção',
      'Outro motivo',
    ])
    expect(MOTIVOS_REMOCAO.map((m) => m.textoObrigatorio)).toEqual([false, true, true])
    expect(MOTIVOS_REMOCAO[1].rotuloTexto).toBe('O que houve?')
  })

  it('o texto obrigatório precisa de 3 letras (como o banco)', () => {
    expect(erroDoTextoRemocao('pedido_cancelado', '')).toBeNull()
    expect(erroDoTextoRemocao('fora_da_linha', '  ab ')).toBe('Conte o que houve com o pedido.')
    expect(erroDoTextoRemocao('fora_da_linha', 'o cliente vai buscar')).toBeNull()
    expect(erroDoTextoRemocao('outro', '')).toBe('Escreva o motivo.')
    expect(erroDoTextoRemocao('outro', ' abc ')).toBeNull()
  })
})

describe('o aviso das peças que seguem ao remover', () => {
  it('uma peça num lugar: a frase da demanda', () => {
    expect(
      frasesPecasQueSeguem({
        em_producao: 1,
        prontas: 0,
        onde: [{ setor: 'LIMPEZA E EMBALAGEM', etapa: 'A LIMPAR', pronta: false, pecas: 1 }],
      }),
    ).toEqual([
      'Este pedido ainda tem 1 peça em A LIMPAR. Para cancelar a fabricação dela, mova para CANCELADO.',
    ])
  })

  it('várias peças em lugares diferentes, e as prontas à parte', () => {
    expect(
      frasesPecasQueSeguem({
        em_producao: 3,
        prontas: 2,
        onde: [
          { setor: 'FITAMENTO', etapa: 'A FITAR', pronta: false, pecas: 2 },
          { setor: 'LIMPEZA E EMBALAGEM', etapa: 'A LIMPAR', pronta: false, pecas: 1 },
          { setor: 'PEDIDOS EM AGUARDO', etapa: null, pronta: true, pecas: 2 },
        ],
      }),
    ).toEqual([
      'Este pedido ainda tem 3 peças em produção: 2 em A FITAR e 1 em A LIMPAR. Para cancelar a fabricação delas, mova para CANCELADO.',
      'Ele também tem 2 peças prontas em PEDIDOS EM AGUARDO — remover do PCP não mexe nelas.',
    ])
  })

  it('só prontas, ou nada', () => {
    expect(
      frasesPecasQueSeguem({
        em_producao: 0,
        prontas: 1,
        onde: [{ setor: 'ROTAS', etapa: null, pronta: true, pecas: 1 }],
      }),
    ).toEqual(['Este pedido tem 1 peça pronta em ROTAS — remover do PCP não mexe nela.'])
    expect(frasesPecasQueSeguem({ em_producao: 0, prontas: 0, onde: [] })).toEqual([])
  })

  it('o lugar é a coluna; sem coluna, o setor', () => {
    expect(nomeDoLugar({ setor: 'MONTAGEM', etapa: 'MONTANDO' })).toBe('MONTANDO')
    expect(nomeDoLugar({ setor: 'PEDIDOS EM AGUARDO', etapa: null })).toBe('PEDIDOS EM AGUARDO')
  })
})
