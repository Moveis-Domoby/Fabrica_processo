import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import * as api from './api'
import type { ParadaAvulsa } from './api'
import { CartaoParadaDoDia } from './ParadaAvulsaDoDia'

/**
 * SESSAO-50 (bloco C — pedido do dono): "Editar" na parada avulsa das Entregas
 * do dia — para quem o banco deixa (a logística, ou quem pôs; só a pendente).
 * Salva pela porta de sempre, com o id da parada.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('./MapaPinoParada', () => ({ default: () => <p>mapa</p> }))
vi.mock('./api', async (original) => {
  const real = await original<typeof import('./api')>()
  return {
    ...real,
    salvarParadaAvulsa: vi.fn(async () => ({ id: 41, repetido: false })),
  }
})

const parada = (extra: Partial<ParadaAvulsa> = {}): ParadaAvulsa => ({
  id: 41,
  data: '2026-11-12',
  caminhao_id: 3,
  rota: 2,
  ordem: 2,
  titulo: 'Levar peça',
  endereco: 'Rua Y, 20, Parnamirim',
  latitude: -5.9,
  longitude: -35.2,
  observacao: null,
  situacao: 'pendente',
  criada_por: 'Entregador C',
  sou_autor: true,
  concluida_em: null,
  nao_feita_motivo: null,
  pode_editar: true,
  ...extra,
})

function desenhar(p: ParadaAvulsa, souLogistica = false) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProvedorNotificacao>
        <ul>
          <CartaoParadaDoDia
            parada={p}
            posicao={2}
            souLogistica={souLogistica}
            aoMudarMomento={() => {}}
          />
        </ul>
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
}

describe('CartaoParadaDoDia — editar a parada avulsa', () => {
  it('quem pode editar vê "Editar": abre a janela preenchida e salva pela porta de sempre (com o id)', async () => {
    desenhar(parada())
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const janela = screen.getByRole('dialog', { name: 'Editar parada avulsa' })
    const titulo = within(janela).getByLabelText('Título')
    expect(titulo).toHaveValue('Levar peça')
    await userEvent.clear(titulo)
    await userEvent.type(titulo, 'Levar peça ao terceiro')
    await userEvent.click(within(janela).getByRole('button', { name: 'Salvar as mudanças' }))
    expect(api.salvarParadaAvulsa).toHaveBeenCalledWith({
      titulo: 'Levar peça ao terceiro',
      endereco: 'Rua Y, 20, Parnamirim',
      latitude: -5.9,
      longitude: -35.2,
      observacao: null,
      id: 41,
      data: '2026-11-12',
      caminhaoId: 3,
      rota: 2,
    })
  })

  it('o banco diz que não pode (a parada de outra pessoa): sem "Editar"', () => {
    desenhar(parada({ sou_autor: false, pode_editar: false }))
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })

  it('a parada já feita não se edita (o "Desfazer" fica)', () => {
    desenhar(
      parada({ situacao: 'feita', pode_editar: false, concluida_em: '2026-11-12T13:00:00Z' }),
      true,
    )
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeInTheDocument()
  })
})
