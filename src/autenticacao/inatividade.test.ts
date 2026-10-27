import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LIMITE_ESCRITORIO_MS,
  esquecerAtividade,
  marcarAtividade,
  passouDoTempo,
} from './inatividade'

/** Tempo parado (D-137): 8 h no escritório — sem relógio. ↩️ SESSAO-41: o tablet nunca sai por tempo. */
const H = 3_600_000
// O Node novo põe um localStorage próprio (vazio, sem arquivo) por cima do
// jsdom — aqui, um armazenamento de mentira em memória.
const memoria = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (chave: string) => memoria.get(chave) ?? null,
  setItem: (chave: string, valor: string) => void memoria.set(chave, valor),
  removeItem: (chave: string) => void memoria.delete(chave),
})
const T0 = Date.UTC(2026, 9, 16, 8, 0, 0)

beforeEach(() => esquecerAtividade())

describe('tempo parado — quem passa do tempo entra de novo', () => {
  it('aparelho sem registro (1ª vez, armazenamento vazio): não derruba ninguém', () => {
    expect(passouDoTempo(T0).passou).toBe(false)
  })
  it('escritório: 8 h parado ainda vale; passou de 8 h, entra de novo', () => {
    marcarAtividade(false, T0)
    expect(passouDoTempo(T0 + LIMITE_ESCRITORIO_MS)).toEqual({ passou: false, limiteH: 8 })
    expect(passouDoTempo(T0 + LIMITE_ESCRITORIO_MS + 1)).toEqual({ passou: true, limiteH: 8 })
  })
  it('modo tablet: nunca sai por tempo parado (SESSAO-41 — quem sai são as pessoas do setor)', () => {
    marcarAtividade(true, T0)
    expect(passouDoTempo(T0 + 11 * H).passou).toBe(false)
    expect(passouDoTempo(T0 + 72 * H).passou).toBe(false)
  })
  it('o gesto renova a conta (no máximo uma gravação por minuto)', () => {
    marcarAtividade(false, T0)
    marcarAtividade(false, T0 + 30_000) // dentro do minuto: não grava
    expect(passouDoTempo(T0 + LIMITE_ESCRITORIO_MS + 1).passou).toBe(true)
    marcarAtividade(false, T0 + 7 * H) // gesto 7 h depois
    expect(passouDoTempo(T0 + 14 * H).passou).toBe(false)
  })
  it('trocar para o modo tablet grava na hora (e o tablet não sai por tempo)', () => {
    marcarAtividade(false, T0)
    marcarAtividade(true, T0 + 10_000)
    expect(passouDoTempo(T0 + 10 * H).passou).toBe(false)
  })
  it('saiu: a próxima entrada começa do zero', () => {
    marcarAtividade(false, T0)
    esquecerAtividade()
    expect(passouDoTempo(T0 + 100 * H).passou).toBe(false)
  })
})
