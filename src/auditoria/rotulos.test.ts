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
    // SESSAO-27 (D-100): a auditoria foi para o Super admin; o endereço antigo
    // (que está na trilha de antes) ganha o nome de hoje.
    expect(nomeDaTela('/super-admin/auditoria')).toBe('Super admin · Auditoria')
    expect(nomeDaTela('/admin/auditoria')).toBe('Super admin · Auditoria')
    expect(nomeDaTela('/configuracoes/utilitarios')).toBe('Configurações · Utilitários')
    expect(nomeDaTela('/admin/estoque')).toBe('Configurações · Estoque')
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

  // SESSAO-52: o antes e o depois da configuração do painel de tempos em português —
  // nenhum nome interno de opção na tela (vale para os registros antigos também)
  it('a configuração do painel de tempos: antes e depois sem nomes internos', () => {
    const detalhes = detalhesDoContexto({
      o_que_mudou: [
        'Gráfico da TV: barras empilhadas por montador → barras com o total',
        'Número do tempo médio: mediana → média',
        'TV · o relógio: ligado → desligado',
        'Setor em que a tela abre: o que o aparelho lembra → MONTAGEM',
        'Período em que a tela abre: hoje (aba Dia) → 7 dias (aba Período)',
        'Montador B (Bia) · MONTAGEM: ligado → desligado',
      ],
      antes: {
        grafico_tv: 'empilhadas',
        medida: 'mediana',
        tv_relogio: true,
        abrir_setor_id: null,
        abrir_periodo: 'hoje',
      },
      depois: {
        grafico_tv: 'barras',
        medida: 'media',
        tv_relogio: false,
        abrir_setor_id: 12,
        abrir_periodo: '7',
      },
      montadores_ids: [{ setor_id: 12, usuario_id: 'u-1', antes: true, depois: false }],
    })
    expect(detalhes).toEqual([
      {
        rotulo: 'O que mudou',
        valor:
          'Gráfico da TV: barras empilhadas por montador → barras com o total; Número do tempo médio: mediana → média; TV · o relógio: ligado → desligado; Setor em que a tela abre: o que o aparelho lembra → MONTAGEM; Período em que a tela abre: hoje (aba Dia) → 7 dias (aba Período); Montador B (Bia) · MONTAGEM: ligado → desligado',
      },
      {
        rotulo: 'Antes',
        valor:
          'Gráfico da TV: barras empilhadas por montador; Número do tempo médio: mediana; TV · o relógio: ligado; Setor em que a tela abre: o que o aparelho lembra; Período em que a tela abre: hoje (aba Dia)',
      },
      {
        rotulo: 'Depois',
        valor:
          'Gráfico da TV: barras com o total; Número do tempo médio: média; TV · o relógio: desligado; Setor em que a tela abre: MONTAGEM; Período em que a tela abre: 7 dias (aba Período)',
      },
    ])
    // nenhum nome interno (com sublinhado, chave de JSON, o código da opção ou o número do setor) chega à tela
    const tudo = detalhes.map((d) => `${d.rotulo} ${d.valor}`).join(' ')
    expect(tudo).not.toMatch(/[a-z]_[a-z]|[{}"]|empilhadas\b(?! por)|\bmedia\b|\b12\b/)
  })

  it('a configuração do painel: só montadores (sem antes/depois) e as 13 opções com nome de gente', () => {
    expect(
      detalhesDoContexto({
        o_que_mudou: ['Montador A (Ana) · MONTAGEM: desligado → ligado'],
        montadores_ids: [{ setor_id: 1, usuario_id: 'u', antes: false, depois: true }],
      }),
    ).toEqual([{ rotulo: 'O que mudou', valor: 'Montador A (Ana) · MONTAGEM: desligado → ligado' }])
    const todas = {
      grafico_periodo: 'linhas',
      grafico_tv: 'empilhadas',
      linha_padrao: true,
      abrir_setor_id: 3,
      abrir_periodo: '30',
      medida: 'mediana',
      tv_numeros: false,
      tv_montadores: false,
      tv_grafico: false,
      tv_melhor_semana: false,
      tv_relogio: false,
      tv_dados_ate: false,
      tv_ao_vivo: false,
    }
    const depois = detalhesDoContexto({
      o_que_mudou: ['Voltou ao padrão'],
      antes: {},
      depois: todas,
    }).find((d) => d.rotulo === 'Depois')
    expect(depois?.valor.split('; ')).toHaveLength(13)
    expect(depois?.valor).toContain('Gráfico da aba Período: linhas por montador')
    expect(depois?.valor).toContain('Setor em que a tela abre: um setor escolhido')
    expect(depois?.valor).toContain('Período em que a tela abre: 30 dias (aba Período)')
    expect(depois?.valor).not.toMatch(/[a-z]_[a-z]|[{}]/)
  })

  it('outro registro com "antes" e "depois" não é confundido com o do painel', () => {
    expect(detalhesDoContexto({ sku: '061', antes: 3, depois: 5 })).toEqual([
      { rotulo: 'SKU', valor: '061' },
      { rotulo: 'Antes', valor: '3' },
      { rotulo: 'Depois', valor: '5' },
    ])
  })

  // SESSAO-48 (frente 5 — "a plataforma recarrega sozinha"): a 1ª abertura de
  // cada página grava por que ela abriu; a Auditoria diz em português.
  it('a abertura da página diz por que abriu — a plataforma primeiro, depois a aba descartada, depois o navegador', () => {
    expect(rotuloDaAcao('navegacao', { abertura: true, carga: 'reload' })).toBe('Abriu a plataforma — atualizou a página')
    expect(rotuloDaAcao('navegacao', { abertura: true, carga: 'navigate' })).toBe(
      'Abriu a plataforma — abriu pelo endereço ou por um atalho',
    )
    expect(rotuloDaAcao('navegacao', { abertura: true, carga: 'back_forward' })).toBe(
      'Abriu a plataforma — voltou pelo botão de voltar do navegador',
    )
    expect(rotuloDaAcao('navegacao', { abertura: true, carga: 'reload', descartada: true })).toBe(
      'Abriu a plataforma — a aba tinha sido descartada pelo navegador',
    )
    expect(rotuloDaAcao('navegacao', { abertura: true, carga: 'reload', recarga: 'troca_setor' })).toBe(
      'Abriu a plataforma — troca de setor no tablet',
    )
    expect(rotuloDaAcao('navegacao', { abertura: true, carga: 'reload', recarga: 'versao_nova' })).toBe(
      'Abriu a plataforma — versão nova (atualizou sozinha)',
    )
    expect(rotuloDaAcao('navegacao', { abertura: true, recarga: 'versao_nova_botao' })).toBe(
      'Abriu a plataforma — versão nova (tocou em Atualizar)',
    )
    expect(rotuloDaAcao('navegacao', { abertura: true, recarga: 'pedaco_sumido' })).toBe(
      'Abriu a plataforma — versão nova (faltava uma parte da versão anterior)',
    )
    // sem nada que se saiba (ou valor desconhecido): só "Abriu a plataforma"
    expect(rotuloDaAcao('navegacao', { abertura: true })).toBe('Abriu a plataforma')
    expect(rotuloDaAcao('navegacao', { abertura: true, carga: 'teletransporte' })).toBe('Abriu a plataforma')
    // a troca de tela de sempre (e a trilha de antes) segue "Abriu a tela"
    expect(rotuloDaAcao('navegacao', {})).toBe('Abriu a tela')
    expect(rotuloDaAcao('navegacao')).toBe('Abriu a tela')
    expect(rotuloDaAcao('saiu', { abertura: true })).toBe('Saiu da plataforma')
  })

  it('os detalhes da abertura em português, sem a versão (é da máquina)', () => {
    expect(
      detalhesDoContexto({ abertura: true, carga: 'reload', descartada: true, recarga: 'versao_nova', versao: '28ea753f9cca' }),
    ).toEqual([
      { rotulo: 'O navegador', valor: 'atualizou a página' },
      { rotulo: 'Aba descartada', valor: 'sim — o navegador tinha tirado a aba da memória' },
      { rotulo: 'Recarregada pela plataforma', valor: 'versão nova (atualizou sozinha)' },
    ])
    expect(detalhesDoContexto({ abertura: true, versao: '28ea753f9cca' })).toEqual([])
  })

  it('o que mudou na conferência e de onde veio a rodada', () => {
    expect(rotuloDosCampos(['obs', 'obs_interna', 'novo'])).toBe(
      'observação, observação interna, pedido que não tinha chegado aqui',
    )
    expect(rotuloDoMotivo('madrugada')).toBe('Da madrugada (3h)')
    expect(rotuloDoMotivo('manual')).toBe('Rodada pedida à mão')
  })
})
