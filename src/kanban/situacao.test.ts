import { describe, expect, it } from 'vitest'
import { pedidoCancelado, situacaoNormalizada } from './situacao'

describe('situação do pedido (descrição do Tiny → chave normalizada)', () => {
  it('normaliza acento, caixa e espaço como o banco', () => {
    expect(situacaoNormalizada('Não entregue')).toBe('nao_entregue')
    expect(situacaoNormalizada('Preparando envio')).toBe('preparando_envio')
    expect(situacaoNormalizada('  Entregue ')).toBe('entregue')
  })

  it('reconhece cancelado nos dois vocabulários', () => {
    expect(pedidoCancelado('Cancelado')).toBe(true)
    expect(pedidoCancelado('cancelado')).toBe(true)
    expect(pedidoCancelado('Em aberto')).toBe(false)
    expect(pedidoCancelado(null)).toBe(false)
  })
})
