import { describe, expect, it } from 'vitest'
import { ehSoEntregador, temModulo } from './tipos'
import type { Perfil } from './tipos'

function perfilDeTeste(sobrescrever: Partial<Perfil>): Perfil {
  return {
    id: 'p1',
    nome: 'Pessoa de Teste',
    usuario: 'pessoa.teste',
    email: 'pessoa@teste.com',
    telefone: null,
    matricula: 'MDM-000-001',
    papel: 'operador',
    senha_padrao: false,
    ativo: true,
    arquivado_em: null,
    tema: 'claro',
    foto_caminho: null,
    modulos: [],
    ...sobrescrever,
  }
}

// O gate de módulo do front (SESSAO-20/D-46) — espelho do fn_tem_modulo do
// banco: admin sempre passa; os demais dependem da lista.
describe('temModulo (D-46)', () => {
  it('admin vê tudo, mesmo com a lista vazia', () => {
    const admin = perfilDeTeste({ papel: 'admin', modulos: [] })
    expect(temModulo(admin, 'fabrica')).toBe(true)
    expect(temModulo(admin, 'comercial')).toBe(true)
  })

  it('operador só vê o módulo que tem na lista', () => {
    const operador = perfilDeTeste({ modulos: ['fabrica'] })
    expect(temModulo(operador, 'fabrica')).toBe(true)
    expect(temModulo(operador, 'comercial')).toBe(false)
  })

  it('sem perfil, nenhum módulo', () => {
    expect(temModulo(null, 'fabrica')).toBe(false)
    expect(temModulo(null, 'comercial')).toBe(false)
  })
})

// SESSAO-30 (D-115): o entregador = módulo "entregas" sem o da fábrica.
describe('ehSoEntregador (D-115)', () => {
  it('só entregas = entregador (vê só as entregas do dia)', () => {
    expect(ehSoEntregador(perfilDeTeste({ modulos: ['entregas'] }))).toBe(true)
  })
  it('com a fábrica junto, não é "só" entregador', () => {
    expect(ehSoEntregador(perfilDeTeste({ modulos: ['fabrica', 'entregas'] }))).toBe(false)
  })
  it('admin nunca é "só" entregador; sem perfil também não', () => {
    expect(ehSoEntregador(perfilDeTeste({ papel: 'admin', modulos: ['entregas'] }))).toBe(false)
    expect(ehSoEntregador(null)).toBe(false)
  })
})

// SESSAO-43 (F3): a permissão Modo TV é EXPLÍCITA (nem o admin a tem sozinho)
// e a conta SÓ da TV é a que tem "tv" e mais nada.
describe('Modo TV (SESSAO-43)', () => {
  it('o botão só aparece com a permissão ligada — inclusive para o admin', async () => {
    const { temModoTv } = await import('./tipos')
    expect(temModoTv(perfilDeTeste({ papel: 'admin', modulos: ['fabrica'] }))).toBe(false)
    expect(temModoTv(perfilDeTeste({ papel: 'admin', modulos: ['fabrica', 'tv'] }))).toBe(true)
    expect(temModoTv(perfilDeTeste({ modulos: ['fabrica', 'tv'] }))).toBe(true)
    expect(temModoTv(null)).toBe(false)
  })

  it('conta só da TV: "tv" sem fábrica, comercial nem entregas, e nunca admin', async () => {
    const { ehSoTv } = await import('./tipos')
    expect(ehSoTv(perfilDeTeste({ modulos: ['tv'] }))).toBe(true)
    expect(ehSoTv(perfilDeTeste({ modulos: ['fabrica', 'tv'] }))).toBe(false)
    expect(ehSoTv(perfilDeTeste({ modulos: ['entregas', 'tv'] }))).toBe(false)
    expect(ehSoTv(perfilDeTeste({ papel: 'admin', modulos: ['tv'] }))).toBe(false)
  })
})
