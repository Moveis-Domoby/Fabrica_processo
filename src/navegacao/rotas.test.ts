import { describe, expect, it } from 'vitest'
import { nomeNoMenu, rotaDoSetor } from './rotas'

// SESSAO-20 (D-46): tudo da produção passou a viver sob o pai Fábrica.
// O helper é a fonte única de endereço de setor — se ele estiver certo,
// sidebar, quadros e redirects apontam para o mesmo lugar.
describe('rotaDoSetor sob o pai Fábrica (D-46/D-36)', () => {
  it('setor de produção mora em /fabrica/producao/{codigo}', () => {
    expect(rotaDoSetor('secc')).toBe('/fabrica/producao/secc')
    expect(rotaDoSetor('pcp')).toBe('/fabrica/producao/pcp')
  })

  it('os terminais têm casa própria dentro da Fábrica', () => {
    expect(rotaDoSetor('estoque')).toBe('/fabrica/logistica/estoque')
    expect(rotaDoSetor('rotas')).toBe('/fabrica/rotas/entregas')
    expect(rotaDoSetor('aguardo')).toBe('/fabrica/logistica/expedicao')
  })
})

describe('o nome no menu (ajuste do dono, 14/10)', () => {
  it('um padrão só: primeira letra maiúscula, o resto minúsculo, siglas inteiras', () => {
    expect(nomeNoMenu('LIMPEZA E EMBALAGEM')).toBe('Limpeza e embalagem')
    expect(nomeNoMenu('FURAÇÃO')).toBe('Furação')
    expect(nomeNoMenu('PCP')).toBe('PCP')
    expect(nomeNoMenu('SECC')).toBe('SECC')
    expect(nomeNoMenu('cnc')).toBe('CNC')
    expect(nomeNoMenu('  MONTAGEM ')).toBe('Montagem')
  })
})
