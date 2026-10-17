import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { AdminApi } from './AdminApi'
import { iniciarApiNovaFabrica } from '@/admin/api'

/**
 * Configurações → API e integrações (SESSAO-11; SESSAO-33 · D-142): o botão
 * "Ligar a API nova da fábrica" é só do dono, e a volta do Tiny vira um aviso
 * em língua de gente.
 */
const sessao = vi.hoisted(() => ({
  perfil: { id: 'u1', papel: 'admin', super_admin: true } as Record<string, unknown>,
}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/autenticacao/sessao-contexto', () => ({ useSessao: () => ({ perfil: sessao.perfil }) }))
vi.mock('@/admin/api', async (original) => {
  const real = await original<typeof import('@/admin/api')>()
  return {
    ...real,
    listarChavesApi: vi.fn(async () => []),
    listarWebhooks: vi.fn(async () => []),
    entregasRecentes: vi.fn(async () => []),
    iniciarApiNovaFabrica: vi.fn(async () => {
      throw new Error('Faltam os segredos do aplicativo do Tiny da fábrica no painel da Supabase.')
    }),
  }
})

function renderizar(endereco = '/configuracoes/api') {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[endereco]}>
        <ProvedorNotificacao>
          <AdminApi />
        </ProvedorNotificacao>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Configurações → API e integrações · a API nova do Tiny da fábrica', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessao.perfil = { id: 'u1', papel: 'admin', super_admin: true }
  })

  it('o admin que não é o dono não vê o botão', () => {
    sessao.perfil = { id: 'u2', papel: 'admin', super_admin: false }
    renderizar()
    expect(screen.queryByRole('button', { name: 'Ligar a API nova da fábrica' })).toBeNull()
  })

  it('o dono toca no botão: o site pede o endereço de autorização (e mostra o porquê se não der)', async () => {
    renderizar()
    fireEvent.click(screen.getByRole('button', { name: 'Ligar a API nova da fábrica' }))
    await waitFor(() => expect(iniciarApiNovaFabrica).toHaveBeenCalledTimes(1))
    // a volta é esta mesma tela
    expect(vi.mocked(iniciarApiNovaFabrica).mock.calls[0][0]).toBe(
      `${window.location.origin}${window.location.pathname}`,
    )
    expect(await screen.findByText('Não deu para ligar a API nova da fábrica')).toBeInTheDocument()
    expect(screen.getByText(/Faltam os segredos do aplicativo/)).toBeInTheDocument()
  })

  it('a volta do Tiny: ligada vira aviso de sucesso', async () => {
    renderizar('/configuracoes/api?tiny_fabrica=ligada')
    expect(await screen.findByText('API nova da fábrica ligada')).toBeInTheDocument()
  })

  it('a volta do Tiny com erro: o motivo em língua de gente, sem o código', async () => {
    renderizar('/configuracoes/api?tiny_fabrica=erro&motivo=tiny_recusou')
    expect(await screen.findByText('A API nova da fábrica não foi ligada')).toBeInTheDocument()
    expect(screen.getByText(/O Tiny não aceitou a autorização/)).toBeInTheDocument()
    expect(screen.queryByText(/tiny_recusou/)).toBeNull()
  })
})
