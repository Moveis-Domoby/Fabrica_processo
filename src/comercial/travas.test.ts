import { describe, expect, it } from 'vitest'
import { DISPARO_LIBERADO, MOTIVO_DISPARO_TRAVADO } from './travas'

// A trava da união (D-46, risco 3) nasceu fechada na SESSAO-20 e foi ABERTA
// no fim do cutover da SESSAO-21 (23/09/2026), a pedido do dono, com o disparo
// rodando só na fábrica. O teste "iniciarFila recusa antes de tocar a rede"
// saiu junto: ele provava o estado fechado. Se a chave voltar a `false` numa
// emergência, este teste quebra de propósito — atualize-o junto.
describe('trava de disparo da união (SESSAO-20 → SESSAO-21)', () => {
  it('a chave está ABERTA desde o cutover (SESSAO-21)', () => {
    expect(DISPARO_LIBERADO).toBe(true)
  })

  it('a explicação da trava continua disponível para um fechamento de emergência', () => {
    expect(MOTIVO_DISPARO_TRAVADO.length).toBeGreaterThan(0)
  })
})
