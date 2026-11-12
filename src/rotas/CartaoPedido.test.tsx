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

/**
 * SESSAO-50 (bloco C — pedido do dono): "Editar endereço" ao lado do "Acertar
 * o ponto no mapa", e o selo discreto do endereço alterado na plataforma com o
 * original do Tiny ao lado (ícone + texto).
 */
describe('CartaoPedido — o endereço de entrega editável', () => {
  it('"Editar endereço" mora ao lado do "Acertar o ponto no mapa" e abre a janela (o toque não marca o pedido)', async () => {
    const aoEditar = vi.fn()
    const aoMarcarPedido = vi.fn()
    // (na aba Programar o cartão mora dentro do rótulo da seleção: o toque não pode subir)
    render(
      <div onClick={aoMarcarPedido}>
        <CartaoPedido pedido={pedido} aoMarcarNoMapa={() => {}} aoEditarEndereco={aoEditar} />
      </div>,
    )
    expect(screen.getByRole('button', { name: /acertar o ponto no mapa/i })).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Editar o endereço de entrega do pedido 13798' }),
    )
    expect(aoEditar).toHaveBeenCalledTimes(1)
    expect(aoMarcarPedido).not.toHaveBeenCalled()
  })

  it('sem o gesto (quem não é da logística), sem o botão', () => {
    render(<CartaoPedido pedido={pedido} />)
    expect(screen.queryByRole('button', { name: /editar o endereço/i })).toBeNull()
  })

  it('endereço alterado na plataforma: o selo e o original do Tiny ao lado', () => {
    render(
      <CartaoPedido
        pedido={{
          ...pedido,
          numero_endereco: '280',
          endereco_plataforma: {
            original: {
              endereco: 'Estrada RN 313',
              numero: '28',
              complemento: null,
              bairro: 'Pium',
              cidade: 'Nísia Floresta',
              uf: 'RN',
              cep: null,
              fonte: 'cadastro',
            },
            tiny_confirmado_em: null,
          },
        }}
      />,
    )
    expect(screen.getByText('Endereço alterado na plataforma')).toBeInTheDocument()
    expect(
      screen.getByText('No Tiny: Estrada RN 313, 28 · Pium · Nísia Floresta-RN'),
    ).toBeInTheDocument()
    expect(screen.getByText('Estrada RN 313, 280 · Pium · Nísia Floresta-RN')).toBeInTheDocument()
  })

  it('o Tiny confirmou: o selo diz "salvo também no Tiny" e o de antes vira "Antes:"', () => {
    render(
      <CartaoPedido
        pedido={{
          ...pedido,
          endereco_plataforma: {
            original: {
              endereco: 'Estrada RN 313',
              numero: '28',
              complemento: null,
              bairro: 'Pium',
              cidade: 'Nísia Floresta',
              uf: 'RN',
              cep: null,
            },
            tiny_confirmado_em: '2026-11-12T06:00:00Z',
          },
        }}
      />,
    )
    expect(screen.getByText('Endereço alterado (salvo também no Tiny)')).toBeInTheDocument()
    expect(screen.getByText(/^Antes: Estrada RN 313, 28/)).toBeInTheDocument()
  })

  it('pedido sem endereço alterado: nenhum selo', () => {
    render(<CartaoPedido pedido={pedido} />)
    expect(screen.queryByText(/Endereço alterado/)).toBeNull()
  })
})
