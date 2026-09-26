import { describe, expect, it } from 'vitest'
import { formatarQuantidade, idadeDaLeitura, sinalDoProduto, textoReposicao } from './estoque'

const base = {
  saldo_tiny: 5,
  necessidade_extrema: 0,
  abaixo_minimo: false,
  minimo: 4,
  repor: 0,
  reposicao_estado: null,
} as const

describe('sinal do produto no Estoque (SESSAO-25)', () => {
  it('sem leitura do Tiny vem antes de tudo — não dá para decidir nada', () => {
    const sinal = sinalDoProduto({ ...base, saldo_tiny: null, abaixo_minimo: true, repor: 4 })
    expect(sinal.tom).toBe('sem_leitura')
  })

  it('vendido sem estoque é necessidade extrema, no plural certo', () => {
    expect(sinalDoProduto({ ...base, necessidade_extrema: 1, abaixo_minimo: true }).texto).toBe(
      'Necessidade extrema — 1 vendido sem estoque',
    )
    const sinal = sinalDoProduto({
      ...base,
      necessidade_extrema: 3,
      abaixo_minimo: true,
      reposicao_estado: 'no_pcp',
    })
    expect(sinal.tom).toBe('extrema')
    expect(sinal.texto).toBe('Necessidade extrema — 3 vendidos sem estoque')
    expect(sinal.detalhe).toBe('reposição aguardando o PCP')
  })

  it('abaixo do mínimo diz quanto repor e onde está a reposição', () => {
    const sinal = sinalDoProduto({
      ...base,
      abaixo_minimo: true,
      repor: 3,
      reposicao_estado: 'em_producao',
    })
    expect(sinal).toEqual({
      tom: 'abaixo',
      texto: 'Abaixo do mínimo — repor 3',
      detalhe: 'reposição em produção',
    })
  })

  it('sem mínimo no Tiny não sinaliza; com mínimo e acima, está ok', () => {
    expect(sinalDoProduto({ ...base, minimo: null }).tom).toBe('sem_minimo')
    expect(sinalDoProduto({ ...base, minimo: 0 }).tom).toBe('sem_minimo')
    expect(sinalDoProduto(base).tom).toBe('ok')
  })

  it('texto da reposição para cada estado (e nada quando não há)', () => {
    expect(textoReposicao('concluida')).toBe('reposição pronta — falta entrar no Tiny')
    expect(textoReposicao('arquivada')).toBe('o PCP decidiu não produzir')
    expect(textoReposicao(null)).toBeUndefined()
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
