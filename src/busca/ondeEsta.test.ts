import { describe, expect, it } from 'vitest'
import type { ItemDaBusca } from './api'
import { nomeDoItem, ondeEsta, origemDoItem, rotaDoQuadroFiltrado } from './ondeEsta'

const base: ItemDaBusca = {
  id: 1,
  tipo: 'unidade',
  pedido_id: 10,
  pedido_numero: 13721,
  pedido_situacao: 'Preparando envio',
  titulo: 'Estante Basic 5 nichos',
  sku: 'S1',
  indice: 1,
  total: 2,
  setor_id: 7,
  setor_nome: 'LIMPEZA E EMBALAGEM',
  setor_codigo: 'limpeza_embalagem',
  setor_papel: 'producao',
  etapa_nome: 'A LIMPAR',
  desde: '2026-10-22T12:00:00Z',
  arquivado_em: null,
  arquivado_motivo: null,
  liberado_completo_em: null,
  standby: false,
  executor: null,
  rota_dia: null,
  rota_caminhao: null,
  rota_numero: null,
}

describe('onde o card está (busca geral — SESSAO-40)', () => {
  it('peça num setor de produção: o setor e a etapa (e quem faz)', () => {
    expect(ondeEsta(base).texto).toBe('LIMPEZA E EMBALAGEM · A LIMPAR')
    expect(ondeEsta({ ...base, executor: 'Ana' }).texto).toBe(
      'LIMPEZA E EMBALAGEM · A LIMPAR · com Ana',
    )
  })

  it('fins de linha falam a língua das telas', () => {
    expect(ondeEsta({ ...base, setor_codigo: 'estoque', setor_papel: 'terminal' }).texto).toBe(
      'No ESTOQUE',
    )
    expect(
      ondeEsta({
        ...base,
        setor_codigo: 'aguardo',
        setor_papel: 'terminal',
        rota_dia: '2026-10-24',
        rota_caminhao: 'Baú 1',
        rota_numero: 2,
      }).texto,
    ).toBe('Pronta, na Expedição · na rota de 24/10 — Baú 1 (rota 2)')
    expect(ondeEsta({ ...base, setor_codigo: 'rotas', setor_papel: 'terminal' }).texto).toBe(
      'Nas ROTAS',
    )
  })

  it('arquivado diz o porquê: entregue, concluído, saiu do estoque', () => {
    const quando = '2026-10-17T15:00:00Z'
    expect(ondeEsta({ ...base, arquivado_em: quando, arquivado_motivo: 'entregue' })).toEqual({
      texto: 'Entregue em 17/10',
      tom: 'perfeito',
    })
    expect(
      ondeEsta({ ...base, tipo: 'avulso', arquivado_em: quando, arquivado_motivo: 'concluido' })
        .texto,
    ).toBe('Concluído em 17/10')
    expect(ondeEsta({ ...base, arquivado_em: quando, arquivado_motivo: 'contagem' }).texto).toBe(
      'Saiu do ESTOQUE em 17/10',
    )
  })

  it('o card do pedido mora no PCP: aguardando, tudo liberado, stand-by', () => {
    const pedido = {
      ...base,
      tipo: 'pedido' as const,
      setor_codigo: 'pcp',
      setor_papel: 'entrada' as const,
    }
    expect(ondeEsta(pedido).texto).toBe('PCP · aguardando liberação')
    expect(ondeEsta({ ...pedido, liberado_completo_em: '2026-10-20T10:00:00Z' }).texto).toBe(
      'PCP · tudo liberado',
    )
    expect(ondeEsta({ ...pedido, standby: true }).texto).toBe('PCP · em stand-by')
    expect(origemDoItem(pedido)).toBe('Pedido 13721 — o pedido')
  })

  it('o nome tem o (k/n) da peça; o avulso e a reposição dizem o que são', () => {
    expect(nomeDoItem(base)).toBe('Estante Basic 5 nichos (1/2)')
    expect(origemDoItem({ ...base, tipo: 'avulso', pedido_numero: null })).toBe('Card avulso')
    expect(nomeDoItem({ ...base, tipo: 'reposicao', total: 3, indice: null })).toBe(
      'Estante Basic 5 nichos — repor 3',
    )
  })

  it('o quadro já filtrado só para setor de produção e PCP vivos', () => {
    expect(rotaDoQuadroFiltrado(base)).toBe('/fabrica/producao/limpeza_embalagem?filtro=13721')
    expect(
      rotaDoQuadroFiltrado({ ...base, setor_codigo: 'estoque', setor_papel: 'terminal' }),
    ).toBeNull()
    expect(rotaDoQuadroFiltrado({ ...base, arquivado_em: '2026-10-17T15:00:00Z' })).toBeNull()
    expect(
      rotaDoQuadroFiltrado({
        ...base,
        tipo: 'reposicao',
        pedido_numero: null,
        setor_codigo: 'pcp',
        setor_papel: 'entrada',
      }),
    ).toBe('/fabrica/producao/pcp?aba=solicitacoes&filtro=Estante%20Basic%205%20nichos')
  })
})

describe('o texto que vale a busca (a régua do banco)', () => {
  it('número com 2 dígitos ou mais; nome com 3 letras ou mais', async () => {
    const { termoDaBusca } = await import('./api')
    expect(termoDaBusca('13721')).toBe('13721')
    expect(termoDaBusca(' Pedido 13721 ')).toBe('Pedido 13721')
    expect(termoDaBusca('#12')).toBe('#12')
    expect(termoDaBusca('9')).toBeNull()
    expect(termoDaBusca('ar')).toBeNull()
    expect(termoDaBusca('est')).toBe('est')
  })
})
