import { describe, expect, it } from 'vitest'
import { VERSAO_BUSCA, VERSAO_DEGRAUS, precisaGeocodificar } from './api'

/**
 * SESSAO-45 · ajuste do dono (05/11 — "não pode acontecer o caso de endereço
 * não encontrado"): quem a tela manda procurar de novo na busca de endereço.
 */
describe('precisaGeocodificar — quem a tela manda à busca de endereço', () => {
  const base = { geo_chave: 'abc', endereco_geocodificavel: 'Rua X 1, Centro, Natal, RN, Brasil' }
  const em = (ms: number) => new Date(ms).toISOString()
  const DIA = 24 * 60 * 60 * 1000
  const agora = VERSAO_DEGRAUS + 2 * DIA

  it('o "não achei" gravado antes dos degraus é procurado de novo (uma vez)', () => {
    expect(precisaGeocodificar({ ...base, geo_resolvido: false, geo_consultado_em: em(VERSAO_DEGRAUS - 60_000) }, agora)).toBe(true)
    expect(precisaGeocodificar({ ...base, geo_resolvido: false, geo_consultado_em: em(VERSAO_DEGRAUS + 60_000) }, agora)).toBe(false)
  })

  it('o ponto de rua achado pela busca nova não volta; o aproximado volta depois de 7 dias', () => {
    const recente = em(VERSAO_DEGRAUS + 60_000)
    expect(precisaGeocodificar({ ...base, geo_resolvido: true, geo_consultado_em: recente }, agora)).toBe(false)
    expect(precisaGeocodificar({ ...base, geo_resolvido: true, geo_aproximado: 'bairro', geo_consultado_em: recente }, agora)).toBe(false)
    expect(
      precisaGeocodificar({ ...base, geo_resolvido: true, geo_aproximado: 'bairro', geo_consultado_em: recente }, agora + 8 * DIA),
    ).toBe(true)
  })

  it('o que a busca antiga gravou é refeito; sem endereço não vai', () => {
    expect(precisaGeocodificar({ ...base, geo_resolvido: true, geo_consultado_em: em(VERSAO_BUSCA - 60_000) }, agora)).toBe(true)
    expect(precisaGeocodificar({ ...base, endereco_geocodificavel: null, geo_resolvido: null }, agora)).toBe(false)
  })
})
