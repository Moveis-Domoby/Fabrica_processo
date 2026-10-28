import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ContextoSessao } from '@/autenticacao/sessao-contexto'
import type { EstadoSessao } from '@/autenticacao/sessao-contexto'
import type { Perfil } from '@/autenticacao/tipos'
import { ConfigAvisos } from './ConfigAvisos'
import { buscarTelaAvisos, definirAviso } from '@/notificacoes/preferencias'

/**
 * Configurações → Avisos (D-202, 28/10): cada um liga/desliga os avisos que
 * recebe; o urgente aparece travado; o administrador escolhe de quem.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/notificacoes/preferencias', () => ({
  buscarTelaAvisos: vi.fn(async () => ({
    pessoa: { id: 'eu', nome: 'Dono', papel: 'admin', super_admin: true },
    avisos: [
      {
        tipo: 'chegada_aguardo',
        grupo: 'expedicao',
        grupo_nome: 'Expedição e estoque',
        nome: 'Peça pronta na Expedição',
        descricao: 'Cada peça de pedido que fica pronta.',
        obrigatorio: false,
        erro: false,
        padrao: true,
        ligado: true,
        recebidos_30d: 263,
      },
      {
        tipo: 'senha_pedido',
        grupo: 'acesso',
        grupo_nome: 'Acesso',
        nome: 'Pedido de troca de senha',
        descricao: null,
        obrigatorio: true,
        erro: false,
        padrao: true,
        ligado: true,
        recebidos_30d: 0,
      },
      {
        tipo: 'automacao_falhou',
        grupo: 'erros',
        grupo_nome: 'Erros de automação e integrações',
        nome: 'Uma automação da plataforma falhou',
        descricao: null,
        obrigatorio: false,
        erro: true,
        padrao: true,
        ligado: false,
        recebidos_30d: 0,
      },
    ],
    pessoas: [
      { id: 'eu', nome: 'Dono', papel: 'admin' },
      { id: 'p2', nome: 'Guilherme', papel: 'admin' },
    ],
  })),
  definirAviso: vi.fn(async () => undefined),
}))

const sessao = {
  carregando: false,
  sessao: null,
  perfil: { id: 'eu', nome: 'Dono', papel: 'admin' } as unknown as Perfil,
  vinculos: [],
  ehLider: true,
  recarregarPerfil: async () => {},
  sair: async () => {},
} satisfies EstadoSessao

function renderizar() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={['/configuracoes/avisos']}>
        <ContextoSessao.Provider value={sessao}>
          <ProvedorNotificacao>
            <ConfigAvisos />
          </ProvedorNotificacao>
        </ContextoSessao.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Configurações → Avisos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mostra os avisos por assunto, com o que está ligado e quantos chegaram', async () => {
    renderizar()
    expect(await screen.findByRole('region', { name: 'Expedição e estoque' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Peça pronta na Expedição' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByText('263 nos últimos 30 dias')).toBeInTheDocument()
    expect(
      screen.getByRole('switch', { name: 'Uma automação da plataforma falhou' }),
    ).toHaveAttribute('aria-checked', 'false')
    expect(buscarTelaAvisos).toHaveBeenCalledWith(null)
  })

  it('o urgente aparece travado — sem botão de desligar', async () => {
    renderizar()
    expect(await screen.findByText('Pedido de troca de senha')).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Pedido de troca de senha' })).toBeNull()
    expect(screen.getByText('Sempre ligado')).toBeInTheDocument()
  })

  it('o toque desliga na hora e grava', async () => {
    renderizar()
    const botao = await screen.findByRole('switch', { name: 'Peça pronta na Expedição' })
    fireEvent.click(botao)
    await waitFor(() => expect(botao).toHaveAttribute('aria-checked', 'false'))
    await waitFor(() => expect(definirAviso).toHaveBeenCalledWith('chegada_aguardo', false, null))
  })

  it('o administrador escolhe de quem (a própria pessoa primeiro)', async () => {
    renderizar()
    expect(await screen.findByText('De quem')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveTextContent('Eu — Dono')
  })
})
