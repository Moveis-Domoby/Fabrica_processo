import { describe, expect, it } from 'vitest'
import type { PresencaDoSetor } from '@/kanban/quadro'
import { presencaDeAgora } from './presenca'

/** SESSAO-41 (D-189): a régua das pessoas no setor, a mesma do banco. */
const T0 = Date.UTC(2026, 9, 27, 13, 0, 0)
const MIN = 60_000
const pessoa = (estado: PresencaDoSetor['estado'], carencia: boolean): PresencaDoSetor => ({
  usuario_id: 'u1',
  nome: 'Fulano',
  foto: null,
  estado,
  desde: new Date(T0).toISOString(),
  carencia,
})

describe('a pessoa no setor, com o tempo', () => {
  it('sem card: 15 min de carência (trabalhando), depois ausente, com 1 h sai do setor', () => {
    const p = pessoa('trabalhando', true)
    expect(presencaDeAgora(p, T0 + 10 * MIN)?.estado).toBe('trabalhando')
    expect(presencaDeAgora(p, T0 + 20 * MIN)?.estado).toBe('ausente')
    expect(presencaDeAgora(p, T0 + 60 * MIN)).toBeNull()
  })
  it('a pausa da pessoa: ausente na hora, e sai com 1 h', () => {
    const p = pessoa('ausente', false)
    expect(presencaDeAgora(p, T0 + MIN)?.estado).toBe('ausente')
    expect(presencaDeAgora(p, T0 + 61 * MIN)).toBeNull()
  })
  it('quem está trabalhando num card continua trabalhando, o tempo que for', () => {
    const p = pessoa('trabalhando', false)
    expect(presencaDeAgora(p, T0 + 600 * MIN)).toBe(p)
  })
})
