import { describe, expect, it, vi } from 'vitest'
import {
  enderecoEmLinha,
  limparCampos,
  mesmoEndereco,
  problemasDoEndereco,
  rotuloDaFonte,
  textoParaBusca,
} from './enderecoDoPedido'
import type { CamposEndereco } from './enderecoDoPedido'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

/**
 * SESSAO-50 (bloco C): a lógica pura da janela "Editar endereço" — a mesma
 * régua do banco (limpar o que se digitou; comparar sem acento, caixa ou
 * espaço; o CEP só com os números).
 */
const base: CamposEndereco = {
  endereco: 'Rua das Acácias',
  numero: '10',
  complemento: null,
  bairro: 'Tirol',
  cidade: 'Natal',
  uf: 'RN',
  cep: '59020-100',
}

describe('limparCampos — o que a pessoa escreveu, limpo como o banco limpa', () => {
  it('tira os espaços sobrando, põe a UF em maiúsculas e o CEP no formato 00000-000', () => {
    expect(
      limparCampos({
        endereco: '  Rua   das  Acácias ',
        numero: ' 10 ',
        complemento: '',
        bairro: 'Tirol',
        cidade: 'Natal ',
        uf: ' rn',
        cep: '59020100',
      }),
    ).toEqual(base)
  })

  it('vazio vira nulo; CEP com outro tamanho fica como veio (só os números) — o banco recusa', () => {
    expect(limparCampos({ endereco: ' ', cep: '5902' })).toEqual({
      endereco: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      uf: null,
      cep: '5902',
    })
  })
})

describe('mesmoEndereco — a régua do banco', () => {
  it('sem acento, sem caixa, sem espaço; o CEP só com os números', () => {
    expect(
      mesmoEndereco(base, {
        ...base,
        endereco: 'RUA DAS ACACIAS',
        bairro: 'tirol',
        cidade: 'NATAL',
        cep: '59020100',
      }),
    ).toBe(true)
  })

  it('o número, o complemento ou o bairro diferentes = outro endereço', () => {
    expect(mesmoEndereco(base, { ...base, numero: '100' })).toBe(false)
    expect(mesmoEndereco(base, { ...base, complemento: 'casa B' })).toBe(false)
    expect(mesmoEndereco(base, { ...base, bairro: 'Petrópolis' })).toBe(false)
    expect(mesmoEndereco(base, { ...base, cep: null })).toBe(false)
  })
})

describe('problemasDoEndereco — o que falta para salvar, em língua de gente', () => {
  it('endereço completo: nada falta', () => {
    expect(problemasDoEndereco(base)).toEqual([])
    expect(problemasDoEndereco({ ...base, cep: null, numero: null, bairro: null })).toEqual([])
  })

  it('rua, cidade, UF e CEP errados: diz cada um', () => {
    expect(
      problemasDoEndereco({ ...base, endereco: 'Ru', cidade: '', uf: 'R', cep: '5902' }),
    ).toEqual([
      'a rua (ou avenida, travessa…)',
      'a cidade',
      'a UF com 2 letras (ex.: RN)',
      'o CEP com 8 números (ou em branco)',
    ])
  })
})

describe('o endereço na tela e na busca do mapa', () => {
  it('numa linha, como os cartões das rotas', () => {
    expect(enderecoEmLinha(base)).toBe('Rua das Acácias, 10 · Tirol · Natal-RN')
    expect(enderecoEmLinha({ ...base, numero: null, bairro: null })).toBe(
      'Rua das Acácias · Natal-RN',
    )
    expect(enderecoEmLinha(null)).toBe('Sem endereço')
  })

  it('o texto da busca leva rua, número, bairro, cidade, UF e CEP', () => {
    expect(textoParaBusca(base)).toBe('Rua das Acácias 10, Tirol, Natal, RN, 59020-100')
  })

  it('de onde vem o endereço, sem código nenhum', () => {
    expect(rotuloDaFonte('plataforma')).toBe('alterado na plataforma')
    expect(rotuloDaFonte('entrega')).toBe('endereço de entrega do Tiny')
    expect(rotuloDaFonte('cadastro')).toBe('cadastro do cliente no Tiny')
  })
})
