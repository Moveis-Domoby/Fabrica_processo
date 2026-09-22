import { describe, expect, it } from 'vitest'
import { temModulo } from './tipos'
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
