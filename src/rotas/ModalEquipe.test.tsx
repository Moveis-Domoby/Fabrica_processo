import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ModalEquipe } from './ModaisProgramacao'

/**
 * SESSAO-38 (pedido do dono, imagem 4): a lista de "Quem leva" mostra SÓ quem
 * é entregador. Quem já estava na equipe sem ser entregador aparece só para
 * ser desmarcado.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('./api', async (original) => {
  const real = await original<typeof import('./api')>()
  return {
    ...real,
    listarEntregadores: vi.fn(async () => [
      { id: 'e1', nome: 'Kaio', foto_caminho: null, entregador: true },
      { id: 'e2', nome: 'Guilherme', foto_caminho: null, entregador: true },
    ]),
    rotasDoDia: vi.fn(async () => [
      {
        caminhao_id: 3,
        rota: 1,
        entregas: 2,
        entregues: 0,
        equipe: [
          { id: 'e1', nome: 'Kaio' },
          { id: 'x9', nome: 'Pessoa da Logística' },
        ],
      },
    ]),
  }
})

describe('ModalEquipe — só entregador', () => {
  it('lista os entregadores; quem não é entregador e já estava aparece marcado, para desmarcar', async () => {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ProvedorNotificacao>
          <ModalEquipe
            alvo={{
              dia: '2026-10-21',
              caminhaoId: 3,
              caminhaoNome: 'Hyundai HR',
              rota: 1,
              variasRotas: false,
            }}
            aoFechar={() => {}}
          />
        </ProvedorNotificacao>
      </QueryClientProvider>,
    )
    const deFora = (await screen.findByText('Pessoa da Logística')).closest('label')!
    expect(within(deFora).getByText(/não é entregador/)).toBeInTheDocument()
    expect(within(deFora).getByRole('checkbox')).toBeChecked()
    const kaio = screen.getByText('Kaio').closest('label')!
    expect(within(kaio).getByRole('checkbox')).toBeChecked()
    expect(within(kaio).queryByText(/não é entregador/)).toBeNull()
    const guilherme = screen.getByText('Guilherme').closest('label')!
    expect(within(guilherme).getByRole('checkbox')).not.toBeChecked()
    expect(screen.queryByText('da ROTAS')).toBeNull()
  })
})
