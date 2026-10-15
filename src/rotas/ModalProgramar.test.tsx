import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ModalProgramar } from './ModalProgramar'

/**
 * "Me foi informado que ainda não é possível cadastrar duas rotas no mesmo
 * dia" (dono, 14/10 noite). O banco aceita (provado na bateria); aqui, a
 * janela de programar: com a Rota 1 do caminhão já feita no dia, o padrão do
 * "Programar" é a rota NOVA — e o "Confirmar" manda a rota 2.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('./api', async (original) => {
  const real = await original<typeof import('./api')>()
  return {
    ...real,
    rotasDoDia: vi.fn(async () => [
      { caminhao_id: 3, rota: 1, entregas: 3, entregues: 3, equipe: [{ id: 'e1', nome: 'Kaio' }] },
    ]),
  }
})

function abrir(aoConfirmar: (data: string, caminhao: number, rota: number) => void) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ModalProgramar
        titulo="Programar 1 pedido(s)"
        diaInicial="2026-10-14"
        caminhaoInicial="3"
        opcoesCaminhao={[{ valor: '3', rotulo: 'Caminhão 3' }]}
        padraoRota="nova"
        carregando={false}
        aoFechar={() => {}}
        aoConfirmar={aoConfirmar}
      />
    </QueryClientProvider>,
  )
}

describe('ModalProgramar — duas rotas no mesmo dia', () => {
  it('o caminhão já fez a Rota 1 no dia: oferece a Rota 1 e a "Nova rota (Rota 2)", com a nova marcada', async () => {
    const aoConfirmar = vi.fn()
    abrir(aoConfirmar)
    await waitFor(() => expect(screen.getByText(/Nova rota \(Rota 2\)/)).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(aoConfirmar).toHaveBeenCalledWith('2026-10-14', 3, 2)
  })
})
