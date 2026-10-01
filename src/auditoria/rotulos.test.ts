import { describe, expect, it } from 'vitest'
import {
  GRUPOS_ACAO,
  ROTULO_ACAO,
  detalhesDoContexto,
  grupoDaAcao,
  humanizar,
  nomeDaTela,
  ondeAconteceu,
  rotuloDaAcao,
  rotuloDoMotivo,
  rotuloDosCampos,
} from './rotulos'

/**
 * A língua da auditoria (SESSAO-29 · D-95): código de ação e id nunca chegam
 * à tela (D-27) — viram frase de gente.
 */
describe('auditoria — rótulos', () => {
  it('toda ação conhecida tem frase e cai em UM tipo do filtro (nada fica sem como filtrar)', () => {
    for (const acao of Object.keys(ROTULO_ACAO)) {
      const grupos = GRUPOS_ACAO.filter((g) => g.acoes.includes(acao))
      expect(grupos.map((g) => g.valor), acao).toHaveLength(1)
    }
    expect(rotuloDaAcao('movimentacao_setor')).toBe('Moveu o card de setor')
    expect(grupoDaAcao('entrou')).toBe('entradas')
    expect(grupoDaAcao('acao_que_ainda_nao_existe')).toBeNull()
  })

  it('ação desconhecida vira frase, nunca o código cru', () => {
    expect(rotuloDaAcao('algo_novo_do_futuro')).toBe('Algo novo do futuro')
    expect(humanizar('')).toBe('Atividade')
  })

  it('o endereço vira o nome da tela; o quadro do setor usa o nome do setor', () => {
    const setores = [{ codigo: 'secc', nome: 'SECC' }, { codigo: 'pcp', nome: 'PCP' }]
    expect(nomeDaTela('/inicio/meu-painel')).toBe('Meu painel')
    expect(nomeDaTela('/fabrica/producao/secc', setores)).toBe('Produção · SECC')
    expect(nomeDaTela('/fabrica/producao/furacao')).toBe('Produção · FURACAO')
    expect(nomeDaTela('/admin/auditoria')).toBe('Painel admin · Auditoria')
    expect(nomeDaTela('/comercial/listas/abc-123')).toBe('Comercial · Uma lista de disparo')
    expect(nomeDaTela('/uma/tela/nova')).toBe('/uma/tela/nova')
  })

  it('onde: a tela da navegação, ou os setores e etapas do card (origem → destino)', () => {
    const base = { acao: 'movimentacao_setor', rota: null, etapa_origem: null, etapa_destino: null }
    expect(ondeAconteceu({ ...base, setor_origem: 'SECC', setor_destino: 'FURAÇÃO' })).toBe('SECC → FURAÇÃO')
    expect(
      ondeAconteceu({
        ...base,
        acao: 'movimentacao_etapa',
        setor_origem: 'MONTAGEM',
        setor_destino: 'MONTAGEM',
        etapa_origem: 'A MONTAR',
        etapa_destino: 'MONTANDO',
      }),
    ).toBe('MONTAGEM · A MONTAR → MONTAGEM · MONTANDO')
    expect(ondeAconteceu({ ...base, setor_origem: null, setor_destino: null })).toBeNull()
    expect(
      ondeAconteceu({ ...base, acao: 'navegacao', rota: '/fabrica/logistica/estoque', setor_origem: null, setor_destino: null }),
    ).toBe('Logística · Estoque')
  })

  it('detalhes sem ids e com os valores traduzidos', () => {
    const detalhes = detalhesDoContexto({
      card_id: 10,
      evento_id: 22,
      setor_origem_id: 3,
      estado_qualidade: 'atencao',
      origem: 'interface',
      sku: '061',
      motivo: 'vai no "Por quê"',
      campos: ['nome', 'tema'],
    })
    expect(detalhes).toEqual([
      { rotulo: 'Estado', valor: 'Estado de atenção' },
      { rotulo: 'Como', valor: 'Pela tela' },
      { rotulo: 'SKU', valor: '061' },
      { rotulo: 'Campos alterados', valor: 'nome, tema' },
    ])
    expect(detalhesDoContexto(null)).toEqual([])
  })

  it('o que mudou na conferência e de onde veio a rodada', () => {
    expect(rotuloDosCampos(['obs', 'obs_interna', 'novo'])).toBe(
      'observação, observação interna, pedido que não tinha chegado aqui',
    )
    expect(rotuloDoMotivo('madrugada')).toBe('Da madrugada (3h)')
    expect(rotuloDoMotivo('manual')).toBe('Rodada pedida à mão')
  })
})
