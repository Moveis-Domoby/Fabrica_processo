import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CartaoPedido } from './CartaoPedido'
import type { DadosCartaoPedido } from './CartaoPedido'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

/**
 * SESSAO-45 · correção do dono (05/11 — "não tem essa de bairro e centro da
 * cidade, NO MÁXIMO a rua é aceitável, mas deve ter um aviso na tela"): o
 * pedido cuja rua o mapa não acha fica com o ponto da cidade e o cartão AVISA,
 * com o botão para ajustar o pino.
 */
const pedido: DadosCartaoPedido = {
  numero: 13798,
  cliente_nome: 'Cliente Teste',
  endereco: 'Estrada RN 313',
  numero_endereco: '28',
  bairro: 'Pium',
  cidade: 'Nísia Floresta',
  uf: 'RN',
  total_unidades: 1,
  itens: [{ descricao: 'Mesa Teste', quantidade: 1 }],
  data_prevista: '2026-11-10',
  geo_chave: 'abc',
  geo_resolvido: true,
}

describe('CartaoPedido — o ponto do mapa', () => {
  it('ponto da cidade: o aviso pedido pelo dono e o botão "Ajustar o pino"', async () => {
    const aoMarcar = vi.fn()
    render(<CartaoPedido pedido={{ ...pedido, geo_aproximado: 'cidade' }} aoMarcarNoMapa={aoMarcar} />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Endereço aproximado para a cidade da entrega, ajustar o pino do mapa',
    )
    await userEvent.click(screen.getByRole('button', { name: /ajustar o pino/i }))
    expect(aoMarcar).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/não encontrado/i)).toBeNull()
  })

  it('ponto de rua: sem aviso, só "Acertar o ponto no mapa"', () => {
    render(<CartaoPedido pedido={pedido} aoMarcarNoMapa={() => {}} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button', { name: /acertar o ponto no mapa/i })).toBeInTheDocument()
  })

  it('ponto marcado à mão manda sobre o aviso (alguém já ajustou o pino)', () => {
    render(<CartaoPedido pedido={{ ...pedido, geo_aproximado: 'cidade', geo_manual: true }} aoMarcarNoMapa={() => {}} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button', { name: /ponto marcado à mão/i })).toBeInTheDocument()
  })

  it('quem não é da logística vê o aviso, sem o botão', () => {
    render(<CartaoPedido pedido={{ ...pedido, geo_aproximado: 'cidade' }} />)
    expect(screen.getByRole('status')).toHaveTextContent('ajustar o pino do mapa')
    expect(screen.queryByRole('button')).toBeNull()
  })
})
