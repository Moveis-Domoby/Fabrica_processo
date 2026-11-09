import { describe, expect, it } from 'vitest'
import { destinoDoAviso } from '@/notificacoes/api'
import { avisoDaVolta, fraseConfirmarVolta, fraseSaiuDoPcp, produtos } from './voltaPcp'

/**
 * SESSAO-47 (bloco A): as frases do pedido que o Tiny levou adiante com produto
 * por liberar — as mesmas na Expedição, na janela de liberar peça e no PCP.
 */
describe('a língua do pedido adiantado no Tiny', () => {
  it('o aviso diz a situação real e o que falta, com o plural por extenso', () => {
    expect(fraseSaiuDoPcp('Pronto para envio', 2)).toBe(
      'Este pedido está como Pronto para envio no Tiny, por isso saiu do PCP. Ainda falta liberar 2 produtos.',
    )
    expect(fraseSaiuDoPcp('Faturado', 1)).toBe(
      'Este pedido está como Faturado no Tiny, por isso saiu do PCP. Ainda falta liberar 1 produto.',
    )
    expect(produtos(1)).toBe('1 produto')
    expect(produtos(3)).toBe('3 produtos')
  })

  it('a confirmação é uma frase só — e diz quando o pedido volta em stand-by', () => {
    expect(fraseConfirmarVolta({ numero: 13818, faltam: 2, situacao: 'preparando_envio' })).toBe(
      'O pedido 13818 vai voltar ao PCP com 2 produtos para liberar, e no Tiny passa para Preparando envio.',
    )
    expect(
      fraseConfirmarVolta({ numero: 13652, faltam: 1, situacao: 'aberto', standby: true }),
    ).toBe(
      'O pedido 13652 vai voltar ao PCP em stand-by, com 1 produto para liberar, e no Tiny passa para Em aberto.',
    )
  })

  it('o pedido devolvido: enquanto o Tiny não confirma, a tela avisa; aceito ou sem a marca, nada', () => {
    const volta = {
      desde: '2026-11-09T19:00:00Z',
      situacao_pedida: 'preparando_envio' as const,
      situacao_tiny: 'Pronto para envio',
    }
    expect(avisoDaVolta(null)).toBeNull()
    expect(avisoDaVolta({ ...volta, estado: 'aceito' })).toBeNull()
    const esperando = avisoDaVolta({ ...volta, estado: 'esperando' })
    expect(esperando?.texto).toBe('O Tiny ainda não confirmou a mudança')
    expect(esperando?.detalhe).toContain('Preparando envio')
    expect(esperando?.detalhe).toContain('O Tiny ainda mostra Pronto para envio.')
    expect(avisoDaVolta({ ...volta, estado: 'falhando' })?.detalhe).toContain('tentando de novo')
    expect(avisoDaVolta({ ...volta, estado: 'parado' })?.detalhe).toContain(
      'os administradores foram avisados',
    )
  })

  it('o aviso do sino do pedido que ficou na Expedição leva ao filtro deles', () => {
    expect(destinoDoAviso({ tipo: 'pedido_adiantado_tiny', card_id: 31 })).toBe(
      '/fabrica/logistica/expedicao?filtro=saiu_do_pcp',
    )
  })
})
