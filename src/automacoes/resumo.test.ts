import { describe, expect, it } from 'vitest'
import { horasEmTexto, resumoGatilho, resumoPasso } from './resumo'
import type { NomesAutomacao } from './resumo'

const nomes: NomesAutomacao = {
  setores: new Map([
    [6, 'MONTAGEM'],
    [9, 'ESTOQUE'],
  ]),
  etapas: new Map([
    [61, { nome: 'A MONTAR', setor_id: 6 }],
    [62, { nome: 'MONTANDO', setor_id: 6 }],
  ]),
  etiquetas: new Map([
    [1, 'Urgente'],
    [2, 'Revisar'],
  ]),
  campos: new Map([
    [10, { id: 10, nome: 'Cor do MDF', tipo: 'lista', opcoes: ['Branco', 'Preto'], em_pecas: true, em_pedidos: false, arquivado_em: null }],
    [11, { id: 11, nome: 'Montado em', tipo: 'data', opcoes: [], em_pecas: true, em_pedidos: true, arquivado_em: null }],
  ]),
  pessoas: new Map([['u1', 'Guilherme']]),
}

/** As frases dos blocos (SESSAO-27): língua de gente, nunca código (D-27). */
describe('resumo dos blocos', () => {
  it('o QUANDO em português, com os nomes reais', () => {
    expect(resumoGatilho('card_entrou', { setor_id: 6, etapa_id: 61 }, nomes)).toBe('O card entrou em MONTAGEM · A MONTAR')
    expect(resumoGatilho('card_entrou', { setor_id: 6 }, nomes)).toBe('O card entrou em MONTAGEM (qualquer etapa)')
    expect(resumoGatilho('card_parado', { horas: 72 }, nomes)).toBe('O card ficou parado 3 dias em qualquer setor de produção')
    expect(resumoGatilho('qualidade_marcada', { estados: ['atencao', 'danificado'] }, nomes)).toBe(
      'A peça foi marcada como estado de atenção ou danificado',
    )
    expect(resumoGatilho('pedido_situacao', { de: null, para: 'entregue' }, nomes)).toBe(
      'O pedido mudou de qualquer para Entregue',
    )
    expect(resumoGatilho('etiqueta_posta', { etiqueta_id: 2 }, nomes)).toBe('O card ganhou "Revisar"')
  })

  it('os FAÇA em português', () => {
    expect(resumoPasso({ tipo: 'mover', setor_id: 6, etapa_id: 62 }, nomes)).toBe('Mover para MONTAGEM · MONTANDO')
    expect(resumoPasso({ tipo: 'mover', setor_id: 9 }, nomes)).toBe('Mover para ESTOQUE (a fila)')
    expect(resumoPasso({ tipo: 'etiqueta_por', etiquetas: [1, 2] }, nomes)).toBe('Pôr: Urgente, Revisar')
    expect(resumoPasso({ tipo: 'etiqueta_tirar', todas: true }, nomes)).toBe('Tirar todas as etiquetas')
    expect(resumoPasso({ tipo: 'campo', campo_id: 10, valor: 'Preto' }, nomes)).toBe('"Cor do MDF" = Preto')
    expect(resumoPasso({ tipo: 'campo', campo_id: 11, valor: '2026-10-02' }, nomes)).toBe('"Montado em" = 02/10/2026')
    expect(resumoPasso({ tipo: 'avisar', destino: 'pessoa', usuario_id: 'u1' }, nomes)).toBe('Avisar Guilherme')
    expect(resumoPasso({ tipo: 'avisar', destino: 'lideres' }, nomes)).toBe('Avisar os líderes do setor')
    expect(resumoPasso({ tipo: 'chamar', url: 'https://n8n.exemplo.com/webhook/abc' }, nomes)).toBe('Chamar n8n.exemplo.com')
    expect(resumoPasso({ tipo: 'esperar', quantidade: 1, unidade: 'dias' }, nomes)).toBe('Esperar 1 dia')
    expect(resumoPasso({ tipo: 'se', condicao: 'tem_etiqueta', etiqueta_id: 1 }, nomes)).toBe('Só se o card tem a etiqueta "Urgente"')
    expect(resumoPasso({ tipo: 'se', condicao: 'situacao_pedido', valores: ['entregue', 'cancelado'] }, nomes)).toBe(
      'Só se o pedido estiver Entregue ou Cancelado',
    )
  })

  it('bloco ainda sem configuração pede o que falta (nunca mostra código)', () => {
    expect(resumoPasso({ tipo: 'mover' }, nomes)).toBe('Mover — escolha o destino')
    expect(resumoPasso({ tipo: 'campo' }, nomes)).toBe('Preencher — escolha o campo')
    expect(resumoPasso({ tipo: 'se' }, nomes)).toBe('Só se… — escolha a condição')
    expect(resumoPasso({ tipo: 'se_senao' }, nomes)).toBe('Se… senão — escolha a condição')
    expect(resumoPasso({ tipo: 'se_senao', condicao: 'tem_etiqueta', etiqueta_id: 1 }, nomes)).toBe('Se o card tem a etiqueta "Urgente"')
  })

  it('horas viram dias quando fecham o dia', () => {
    expect(horasEmTexto(48)).toBe('2 dias')
    expect(horasEmTexto(1)).toBe('1 hora')
    expect(horasEmTexto(30)).toBe('30 horas')
  })
})
