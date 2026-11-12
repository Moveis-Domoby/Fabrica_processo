import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ModalParadaAvulsa } from './ModalParadaAvulsa'
import type { DadosParadaAvulsa } from './api'

/**
 * SESSAO-50 (bloco C — pedido do dono: "editar o local de uma parada avulsa …
 * ao invés de excluir e criar outra"): a MESMA janela de pôr a parada abre
 * preenchida para editar — título, endereço, o pino já no mapa (arrastável) e
 * a observação. "Salvar as mudanças" só liga quando algo mudou.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('./MapaPinoParada', () => ({
  default: ({
    latitude,
    longitude,
    aoMover,
  }: {
    latitude: number
    longitude: number
    aoMover: (lat: number, lon: number) => void
  }) => (
    <div>
      <p>
        pino em {latitude}, {longitude}
      </p>
      <button type="button" onClick={() => aoMover(-5.85, -35.22)}>
        mover o pino
      </button>
    </div>
  ),
}))

const PARADA: DadosParadaAvulsa = {
  titulo: 'Buscar ferragem',
  endereco: 'Av. Prudente de Morais, 1000, Natal',
  latitude: -5.8,
  longitude: -35.2,
  observacao: 'pegar 2 caixas',
}

function desenhar(inicial: DadosParadaAvulsa | null) {
  const aoSalvar = vi.fn()
  const aoFechar = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ModalParadaAvulsa aberto inicial={inicial} aoFechar={aoFechar} aoSalvar={aoSalvar} />
    </QueryClientProvider>,
  )
  return { aoSalvar, aoFechar }
}

describe('ModalParadaAvulsa — editar a parada (a mesma janela, preenchida)', () => {
  it('abre preenchida, com o pino da parada já no mapa; sem mudar nada, não salva', async () => {
    desenhar(PARADA)
    expect(screen.getByRole('dialog', { name: 'Editar parada avulsa' })).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('Buscar ferragem')
    expect(screen.getByLabelText('Endereço')).toHaveValue('Av. Prudente de Morais, 1000, Natal')
    expect(screen.getByLabelText('Observação (opcional)')).toHaveValue('pegar 2 caixas')
    expect(await screen.findByText('pino em -5.8, -35.2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar as mudanças' })).toBeDisabled()
  })

  it('arrastar o pino e mudar o endereço: salva tudo (título, endereço, ponto novo e observação)', async () => {
    const { aoSalvar } = desenhar(PARADA)
    const campo = screen.getByLabelText('Endereço')
    await userEvent.clear(campo)
    await userEvent.type(campo, 'Av. Prudente de Morais, 1200, Natal')
    // o endereço mudou depois do pino: a tela avisa
    expect(screen.getByText(/Você mudou o endereço depois de marcar o pino/)).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'mover o pino' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar as mudanças' }))
    expect(aoSalvar).toHaveBeenCalledWith({
      titulo: 'Buscar ferragem',
      endereco: 'Av. Prudente de Morais, 1200, Natal',
      latitude: -5.85,
      longitude: -35.22,
      observacao: 'pegar 2 caixas',
    })
  })

  it('tirar o pino também é uma mudança (a parada fica só com o endereço escrito)', async () => {
    const { aoSalvar } = desenhar(PARADA)
    await userEvent.click(await screen.findByRole('button', { name: 'Tirar o pino' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar as mudanças' }))
    expect(aoSalvar).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: null, longitude: null }),
    )
  })

  it('parada sem pino: o mapa já abre (com o pino na fábrica) para marcar', async () => {
    desenhar({ ...PARADA, latitude: null, longitude: null })
    expect(await screen.findByText(/O pino está na fábrica/)).toBeInTheDocument()
  })

  it('criar continua como era: título "Adicionar parada avulsa", "Salvar a parada", sem mapa até achar', () => {
    desenhar(null)
    expect(screen.getByRole('dialog', { name: 'Adicionar parada avulsa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar a parada' })).toBeDisabled()
    expect(screen.queryByText(/pino em/)).not.toBeInTheDocument()
  })
})
