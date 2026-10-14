import { describe, expect, it } from 'vitest'
import { acaoAoSoltar, etapaDeInicio, pedeEstadoAoEnviar, tipoQualidade } from './arrasto'
import type { Etapa } from './tipos'

function etapa(parcial: Partial<Etapa> & Pick<Etapa, 'id' | 'nome' | 'ordem'>): Etapa {
  return {
    setor_id: 6,
    eh_fila: false,
    eh_danificado: false,
    ativa: true,
    setor_destino_id: null,
    conclui_producao: false,
    ...parcial,
  }
}

// As etapas da MONTAGEM como o dono cadastrou (herança do ClickUp).
const MONTAGEM: Etapa[] = [
  etapa({ id: 29, nome: 'A MONTAR', ordem: 10, eh_fila: true }),
  etapa({ id: 28, nome: 'MONTANDO', ordem: 20 }),
  etapa({ id: 27, nome: 'PARADO', ordem: 30 }),
  etapa({ id: 26, nome: 'LIMPEZA E EMBALAGEM', ordem: 40, setor_destino_id: 7 }),
  etapa({ id: 25, nome: 'CONCLUÍDO', ordem: 50, setor_destino_id: 7 }),
  etapa({ id: 47, nome: 'DANIFICADO', ordem: 9999, eh_danificado: true }),
]
// SESSAO-31 (D-127): a LIMPEZA E EMBALAGEM conclui na EXPEDIÇÃO.
const LIMPEZA: Etapa[] = [
  etapa({ id: 61, nome: 'A LIMPAR', ordem: 10, eh_fila: true, setor_id: 7 }),
  etapa({ id: 62, nome: 'EXPEDIÇÃO', ordem: 15, conclui_producao: true, setor_id: 7 }),
  etapa({ id: 63, nome: 'LIMPANDO E EMBALANDO', ordem: 20, setor_id: 7 }),
]
const PRODUCAO = { papel_no_fluxo: 'producao' as const }
const UNIDADE = { tipo: 'unidade' as const }

describe('etapaDeInicio', () => {
  it('é a próxima depois da fila (A MONTAR → MONTANDO)', () => {
    expect(etapaDeInicio(MONTAGEM)?.nome).toBe('MONTANDO')
  })

  it('pula etapa que encaminha, DANIFICADO e inativa', () => {
    const etapas = [
      etapa({ id: 1, nome: 'A CORTAR', ordem: 1, eh_fila: true }),
      etapa({ id: 2, nome: 'FITAMENTO', ordem: 2, setor_destino_id: 4 }),
      etapa({ id: 3, nome: 'VELHA', ordem: 3, ativa: false }),
      etapa({ id: 4, nome: 'CORTANDO', ordem: 4 }),
    ]
    expect(etapaDeInicio(etapas)?.nome).toBe('CORTANDO')
  })

  it('a etapa que conclui também não é início (D-127)', () => {
    expect(etapaDeInicio(LIMPEZA)?.nome).toBe('LIMPANDO E EMBALANDO')
  })

  it('sem fila cadastrada não existe início (nada se inventa — D-14)', () => {
    expect(etapaDeInicio([etapa({ id: 1, nome: 'MONTANDO', ordem: 1 })])).toBeUndefined()
  })
})

describe('acaoAoSoltar', () => {
  const soltar = (etapaDestinoId: number | null) =>
    acaoAoSoltar({ setor: PRODUCAO, etapas: MONTAGEM, card: UNIDADE, etapaDestinoId })

  it('soltar em MONTANDO inicia o tempo', () => {
    expect(soltar(28)).toEqual({ tipo: 'iniciar' })
  })

  it('soltar em etapa com nome de setor ou em CONCLUÍDO encaminha', () => {
    expect(soltar(26)).toMatchObject({ tipo: 'encaminhar', setorDestinoId: 7 })
    expect(soltar(25)).toMatchObject({ tipo: 'encaminhar', setorDestinoId: 7 })
  })

  it('PARADO, a fila e a Chegada são só mover', () => {
    expect(soltar(27)).toEqual({ tipo: 'mover' })
    expect(soltar(29)).toEqual({ tipo: 'mover' })
    expect(soltar(null)).toEqual({ tipo: 'mover' })
  })

  it('soltar a peça na EXPEDIÇÃO conclui; o card que não é peça só se move (D-127)', () => {
    const naLimpeza = (card: { tipo: 'unidade' | 'pedido' }) =>
      acaoAoSoltar({ setor: PRODUCAO, etapas: LIMPEZA, card, etapaDestinoId: 62 })
    expect(naLimpeza(UNIDADE)).toMatchObject({ tipo: 'concluir' })
    expect(naLimpeza({ tipo: 'pedido' })).toEqual({ tipo: 'mover' })
  })

  it('no PCP (entrada) soltar na etapa seguinte à fila NÃO inicia tempo', () => {
    expect(
      acaoAoSoltar({
        setor: { papel_no_fluxo: 'entrada' },
        etapas: MONTAGEM,
        card: UNIDADE,
        etapaDestinoId: 28,
      }),
    ).toEqual({ tipo: 'mover' })
  })
})

describe('as chaves do estado da peça (D-126)', () => {
  it('o tipo do card: peça de pedido, peça de estoque; o card do pedido não entra', () => {
    expect(tipoQualidade({ tipo: 'unidade', pedido_id: 9 })).toBe('peca_pedido')
    expect(tipoQualidade({ tipo: 'unidade', pedido_id: null })).toBe('peca_estoque')
    expect(tipoQualidade({ tipo: 'pedido', pedido_id: 9 })).toBeNull()
  })

  it('tudo desligado: nunca pergunta o estado', () => {
    expect(
      pedeEstadoAoEnviar(
        { papel_no_fluxo: 'producao', qualidade_envio_tipos: [] },
        { tipo: 'unidade', pedido_id: 9 },
      ),
    ).toBe(false)
  })

  it('ligado só para a peça de pedido: pergunta nela, não na de estoque', () => {
    const setor = { papel_no_fluxo: 'producao' as const, qualidade_envio_tipos: ['peca_pedido' as const] }
    expect(pedeEstadoAoEnviar(setor, { tipo: 'unidade', pedido_id: 9 })).toBe(true)
    expect(pedeEstadoAoEnviar(setor, { tipo: 'unidade', pedido_id: null })).toBe(false)
  })

  it('fora da produção (PCP, fins de linha) não há estado a marcar', () => {
    expect(
      pedeEstadoAoEnviar(
        { papel_no_fluxo: 'entrada', qualidade_envio_tipos: ['peca_pedido'] },
        { tipo: 'unidade', pedido_id: 9 },
      ),
    ).toBe(false)
  })
})
