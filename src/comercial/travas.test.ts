import { describe, expect, it } from 'vitest'
import { DISPARO_LIBERADO, MOTIVO_DISPARO_TRAVADO } from './travas'
import { iniciarFila } from './lib/disparo/api'

// A trava da união (D-46, risco 3): enquanto o cutover não acontece, NENHUM
// caminho do módulo pode disparar WhatsApp. Estes testes quebram se alguém
// virar a chave sem ser a SESSAO-21 — ao virar de propósito no cutover,
// o primeiro teste é atualizado junto (é a única linha).
describe('trava de disparo da união (SESSAO-20/D-46)', () => {
  it('a chave está FECHADA até o cutover (SESSAO-21)', () => {
    expect(DISPARO_LIBERADO).toBe(false)
  })

  it('iniciarFila recusa com a explicação antes de tocar a rede', async () => {
    await expect(iniciarFila('lista-qualquer', 60)).rejects.toThrow(MOTIVO_DISPARO_TRAVADO)
  })
})
