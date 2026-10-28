import { describe, expect, it } from 'vitest'
import { sugerirEmail } from './sugestaoEmail'

describe('sugerirEmail (D-200 — o caso do "@gmai.com")', () => {
  it('sugere o domínio certo para os erros comuns de digitação', () => {
    expect(sugerirEmail('anderson.dct25@gmai.com')).toBe('anderson.dct25@gmail.com')
    expect(sugerirEmail('fulano@gamil.com')).toBe('fulano@gmail.com')
    expect(sugerirEmail('fulano@gmail.con')).toBe('fulano@gmail.com')
    expect(sugerirEmail('fulano@gmail.co')).toBe('fulano@gmail.com')
    expect(sugerirEmail('fulano@hotmal.com')).toBe('fulano@hotmail.com')
    expect(sugerirEmail('fulano@hotmial.com')).toBe('fulano@hotmail.com')
    expect(sugerirEmail('fulano@outlok.com')).toBe('fulano@outlook.com')
    expect(sugerirEmail('fulano@hotmail.com.b')).toBe('fulano@hotmail.com.br')
  })

  it('não sugere nada para o e-mail certo nem para domínio de empresa', () => {
    expect(sugerirEmail('anderson.dct25@gmail.com')).toBeNull()
    expect(sugerirEmail('  Fulano@Hotmail.com ')).toBeNull()
    expect(sugerirEmail('contato@domoby.com.br')).toBeNull()
    expect(sugerirEmail('fulano@ig.com.br')).toBeNull()
  })

  it('não inventa nada com o e-mail incompleto', () => {
    expect(sugerirEmail('')).toBeNull()
    expect(sugerirEmail('fulano')).toBeNull()
    expect(sugerirEmail('fulano@')).toBeNull()
    expect(sugerirEmail('@gmai.com')).toBeNull()
  })

  it('devolve em minúsculas, sem espaços', () => {
    expect(sugerirEmail(' Fulano@GMAI.com ')).toBe('fulano@gmail.com')
  })
})
