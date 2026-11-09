import { describe, expect, it } from 'vitest'
import {
  legendaDaMedida,
  nomeDaMedida,
  nomeDaMedidaCapital,
  PAINEL_PADRAO,
  painelDe,
  tempoDaMedida,
  tempoDaOutraMedida,
} from './painel'

/**
 * SESSAO-47 (Bloco C) — a configuração do painel chega junto de cada resposta.
 * O banco de antes não manda a chave: a tela tem de abrir com o desenho de sempre.
 */
describe('a configuração do painel de tempos', () => {
  it('sem a chave na resposta (o banco de antes), vale o padrão', () => {
    expect(painelDe(null)).toEqual(PAINEL_PADRAO)
    expect(painelDe(undefined)).toEqual(PAINEL_PADRAO)
    expect(painelDe({})).toEqual(PAINEL_PADRAO)
    expect(painelDe({ painel: null })).toEqual(PAINEL_PADRAO)
    expect(PAINEL_PADRAO).toMatchObject({
      grafico_periodo: 'empilhadas',
      grafico_tv: 'empilhadas',
      medida: 'mediana',
      linha_padrao: false,
      abrir_setor_id: null,
      abrir_periodo: 'hoje',
      tv_relogio: true,
    })
  })

  it('lê o que veio e completa o que faltou com o padrão', () => {
    const p = painelDe({
      painel: { grafico_periodo: 'linhas', medida: 'media', tv_relogio: false, abrir_setor_id: 6 },
    })
    expect(p.grafico_periodo).toBe('linhas')
    expect(p.medida).toBe('media')
    expect(p.tv_relogio).toBe(false)
    expect(p.abrir_setor_id).toBe(6)
    // o que não veio
    expect(p.grafico_tv).toBe('empilhadas')
    expect(p.tv_numeros).toBe(true)
    expect(p.abrir_periodo).toBe('hoje')
  })

  it('valor que a tela não conhece não quebra nada: vale o padrão daquele item', () => {
    const p = painelDe({
      painel: {
        grafico_tv: 'pizza',
        medida: 'moda',
        abrir_periodo: '90',
        linha_padrao: 'sim',
        tv_grafico: 1,
        abrir_setor_id: 'montagem',
      },
    })
    expect(p).toEqual(PAINEL_PADRAO)
  })

  it('o rótulo diz qual número está valendo — e o outro vai de subtítulo', () => {
    const numeros = { mediana_s: 2700, media_s: 2500 }
    const minutos = (s: number) => `${Math.round(s / 60)} min`
    expect(nomeDaMedida('mediana')).toBe('mediana')
    expect(nomeDaMedida('media')).toBe('média')
    expect(nomeDaMedidaCapital('media')).toBe('Média')
    expect(tempoDaMedida('mediana', numeros)).toBe(2700)
    expect(tempoDaMedida('media', numeros)).toBe(2500)
    expect(tempoDaOutraMedida('mediana', numeros)).toBe(2500)
    expect(legendaDaMedida('mediana', numeros, minutos)).toBe('mediana · a média é 42 min')
    expect(legendaDaMedida('media', numeros, minutos)).toBe('média · a mediana é 45 min')
  })

  it('onde o banco de antes só manda a mediana, a tela não inventa a média', () => {
    const soMediana = { mediana_s: 1800 }
    expect(tempoDaMedida('mediana', soMediana)).toBe(1800)
    expect(tempoDaMedida('media', soMediana)).toBeNull()
    expect(legendaDaMedida('mediana', soMediana, String)).toBe('mediana')
  })
})
