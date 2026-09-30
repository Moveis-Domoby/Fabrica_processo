import { describe, expect, it } from 'vitest'
import {
  formatarQuantidade,
  idadeDaLeitura,
  previaMovimento,
  rotuloPosicao,
  sinalDoProduto,
  textoReposicao,
} from './estoque'

describe('sinal do produto no Estoque (ajuste de 28/09 — a contagem da logística)', () => {
  it('com mínimo: sem estoque, faltam N, ou no mínimo', () => {
    expect(sinalDoProduto({ em_estoque: 0, minimo: 2 })).toEqual({ tom: 'sem_estoque', texto: 'Sem estoque' })
    expect(sinalDoProduto({ em_estoque: 1, minimo: 4 })).toEqual({
      tom: 'abaixo',
      texto: 'Faltam 3 para o mínimo',
    })
    expect(sinalDoProduto({ em_estoque: 4, minimo: 4 })?.tom).toBe('ok')
    expect(sinalDoProduto({ em_estoque: 9, minimo: 4 })?.tom).toBe('ok')
  })

  it('sem mínimo: só avisa quando não tem nada (neutro); com estoque, nenhum sinal', () => {
    expect(sinalDoProduto({ em_estoque: 0, minimo: null })).toEqual({ tom: 'neutro', texto: 'Sem estoque' })
    expect(sinalDoProduto({ em_estoque: null, minimo: 0 })?.tom).toBe('neutro')
    expect(sinalDoProduto({ em_estoque: 3, minimo: null })).toBeNull()
  })

  it('a reposição só aparece enquanto está andando', () => {
    expect(textoReposicao('no_pcp')).toBe('reposição pedida ao PCP')
    expect(textoReposicao('em_producao')).toBe('reposição em produção')
    expect(textoReposicao('concluida')).toBeUndefined()
    expect(textoReposicao('arquivada')).toBeUndefined()
    expect(textoReposicao(null)).toBeUndefined()
  })

  it('posição nas vendas vira "1º", e nada quando não vendeu', () => {
    expect(rotuloPosicao(1)).toBe('1º')
    expect(rotuloPosicao(20)).toBe('20º')
    expect(rotuloPosicao(null)).toBeNull()
  })
})

describe('prévia da movimentação (antes de confirmar)', () => {
  it('entrada soma; baixa tira e não passa do que há', () => {
    expect(previaMovimento('entrada', 3, 2)).toMatchObject({ depois: 5, valida: true, texto: 'Ficam 5 no estoque.' })
    expect(previaMovimento('baixa', 1, 2)).toMatchObject({ depois: 1, valida: true, texto: 'Fica 1 no estoque.' })
    expect(previaMovimento('baixa', 3, 2)).toMatchObject({
      valida: false,
      texto: 'Só há 2 no estoque — não dá para dar baixa em 3.',
    })
  })

  it('contagem acerta a diferença para cima ou para baixo, e registra quando bate', () => {
    expect(previaMovimento('contagem', 5, 2).texto).toBe('Entram 3 peças (de 2 para 5).')
    expect(previaMovimento('contagem', 3, 2).texto).toBe('Entra 1 peça (de 2 para 3).')
    expect(previaMovimento('contagem', 1, 2).texto).toBe('Sai 1 peça (de 2 para 1).')
    expect(previaMovimento('contagem', 0, 3).texto).toBe('Saem 3 peças (de 3 para 0).')
    expect(previaMovimento('contagem', 2, 2)).toMatchObject({ depois: 2, valida: true })
    expect(previaMovimento('contagem', 0, 4)).toMatchObject({ depois: 0, valida: true })
  })

  it('contagem física: as reservadas por venda que estão no galpão entram na conta (D-78)', () => {
    // 2 livres + 1 reservada = 3 no galpão; contou 3 → nada muda, ficam 2 livres
    expect(previaMovimento('contagem', 3, 2, 1)).toMatchObject({
      depois: 2,
      valida: true,
      texto: 'Bate com o que já está aqui — fica registrado que foi conferido.',
    })
    expect(previaMovimento('contagem', 5, 2, 1)).toMatchObject({ depois: 4, texto: 'Entram 2 peças (de 3 para 5).' })
    expect(previaMovimento('contagem', 1, 2, 1)).toMatchObject({ depois: 0, texto: 'Saem 2 peças (de 3 para 1).' })
    expect(previaMovimento('contagem', 0, 2, 1)).toMatchObject({
      valida: false,
      texto: 'Há 1 peça reservada para um pedido no galpão — a contagem não pode ser menor.',
    })
  })

  it('quantidade fora da faixa não passa', () => {
    expect(previaMovimento('entrada', 0, 0).valida).toBe(false)
    expect(previaMovimento('entrada', 501, 0).valida).toBe(false)
    expect(previaMovimento('contagem', -1, 0).valida).toBe(false)
    expect(previaMovimento('entrada', Number.NaN, 0).valida).toBe(false)
  })
})

describe('idade da leitura e quantidade', () => {
  const agora = new Date('2026-09-26T12:00:00Z').getTime()

  it('idade da leitura em minutos, horas ou dias', () => {
    expect(idadeDaLeitura(null, agora)).toBeNull()
    expect(idadeDaLeitura('2026-09-26T11:59:40Z', agora)).toBe('agora')
    expect(idadeDaLeitura('2026-09-26T11:15:00Z', agora)).toBe('há 45 min')
    expect(idadeDaLeitura('2026-09-26T09:00:00Z', agora)).toBe('há 3 h')
    expect(idadeDaLeitura('2026-09-22T12:00:00Z', agora)).toBe('há 4 dias')
  })

  it('quantidade inteira sem casas; fracionada com vírgula; vazio vira travessão', () => {
    expect(formatarQuantidade(4)).toBe('4')
    expect(formatarQuantidade(3.97)).toBe('3,97')
    expect(formatarQuantidade(null)).toBe('—')
  })
})
