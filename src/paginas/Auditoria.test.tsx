import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { Auditoria } from './Auditoria'
import { buscarAuditoria, buscarConferencias } from '@/auditoria/api'

/**
 * Painel admin → Auditoria (SESSAO-29 · D-95): a trilha de tudo em língua de
 * gente (quem, quando, onde, o quê, porquê), uma página por vez pedida ao
 * servidor; a aba das conferências com o Tiny só carrega quando é aberta.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/kanban/api', () => ({
  buscarNomesUsuarios: vi.fn(async () => new Map([['u1', 'Wallace'], ['u2', 'Guilherme']])),
  buscarSetores: vi.fn(async () => [
    { id: 1, codigo: 'secc', nome: 'SECC' },
    { id: 2, codigo: 'furacao', nome: 'FURAÇÃO' },
  ]),
}))
vi.mock('@/auditoria/api', () => ({
  buscarAuditoria: vi.fn(async () => ({
    total: 2,
    linhas: [
      {
        id: 2,
        criado_em: '2026-10-01T05:00:00Z',
        usuario_id: 'u2',
        usuario_nome: 'Guilherme',
        acao: 'movimentacao_setor',
        rota: null,
        contexto: { card_id: 9, evento_id: 7, origem: 'interface' },
        pedido_numero: 13429,
        card_tipo: 'unidade',
        setor_origem: 'SECC',
        setor_destino: 'FURAÇÃO',
        etapa_origem: null,
        etapa_destino: null,
        motivo: 'peça pronta para furar',
        contagem_total: 2,
      },
      {
        id: 1,
        criado_em: '2026-10-01T04:59:00Z',
        usuario_id: null,
        usuario_nome: null,
        acao: 'pedido_cancelado',
        rota: null,
        contexto: { card_id: 3, evento_id: 4, origem: 'automacao' },
        pedido_numero: 13500,
        card_tipo: 'pedido',
        setor_origem: null,
        setor_destino: null,
        etapa_origem: null,
        etapa_destino: null,
        motivo: 'Pedido cancelado no Tiny.',
        contagem_total: 2,
      },
    ],
  })),
  buscarConferencias: vi.fn(async () => ({
    em_andamento: null,
    agendada: true,
    total: 1,
    rodadas: [
      {
        id: 50,
        registrado_em: '2026-10-01T06:21:00Z',
        rodada: '2026-10-01T03:00:00.000000',
        estado: 'concluida',
        motivo: 'madrugada',
        inicio: '2026-10-01T06:00:00Z',
        fim: '2026-10-01T06:21:00Z',
        janela_dias: 60,
        paginas_busca: 7,
        relidos: 611,
        mudaram: 2,
        novos: 0,
        nao_encontrados: 0,
        falhas: 0,
        pendentes: 0,
        pedidos: [
          { numero: '13429', campos: ['situacao'] },
          { numero: '13180', campos: ['obs_interna'] },
        ],
      },
    ],
  })),
}))

function renderizar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/super-admin/auditoria']}>
        <ProvedorNotificacao>
          <Auditoria />
        </ProvedorNotificacao>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Painel admin → Auditoria', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mostra a trilha em língua de gente: o quê, o pedido, quem, onde e o porquê; o Sistema tem nome', async () => {
    renderizar()
    const movimento = (await screen.findByText('Moveu o card de setor')).closest('li') as HTMLElement
    expect(within(movimento).getByText(/pedido 13429/)).toBeInTheDocument()
    expect(within(movimento).getByText('Guilherme')).toBeInTheDocument()
    expect(within(movimento).getByText(/SECC → FURAÇÃO/)).toBeInTheDocument()
    expect(within(movimento).getByText('peça pronta para furar')).toBeInTheDocument()
    const cancelado = screen.getByText('Pedido cancelado no Tiny').closest('li') as HTMLElement
    expect(within(cancelado).getByText('Sistema')).toBeInTheDocument()
    expect(within(cancelado).getByText(/pedido 13500/)).toBeInTheDocument()
    // nenhum código interno na tela
    expect(screen.queryByText(/movimentacao_setor|pedido_cancelado|card_id|evento_id/)).toBeNull()
    // a 1ª consulta: uma página, últimos 7 dias, sem filtro de pessoa nem de tipo
    const [filtros, pagina, porPagina] = vi.mocked(buscarAuditoria).mock.calls[0]
    expect(pagina).toBe(1)
    expect(porPagina).toBe(30)
    expect(filtros.usuarioId).toBeNull()
    expect(filtros.acoes).toBeNull()
    expect(filtros.desde).not.toBeNull()
    // a aba das conferências NÃO foi pedida (regra 17)
    expect(buscarConferencias).not.toHaveBeenCalled()
  })

  it('linha de uma automação que já foi excluída ganha a etiqueta "Automação excluída" (o histórico fica)', async () => {
    vi.mocked(buscarAuditoria).mockResolvedValueOnce({
      total: 1,
      linhas: [
        {
          id: 3,
          criado_em: '2026-10-02T23:00:00Z',
          usuario_id: 'u2',
          usuario_nome: 'Guilherme',
          acao: 'automacao_excluida',
          rota: null,
          contexto: { automacao_id: 10, automacao: 'Teste — etiqueta posta arquiva', execucoes: 2, automacao_excluida: true },
          pedido_numero: null,
          card_tipo: null,
          setor_origem: null,
          setor_destino: null,
          etapa_origem: null,
          etapa_destino: null,
          motivo: 'Automação "Teste — etiqueta posta arquiva" excluída',
          contagem_total: 1,
        },
      ],
    })
    renderizar()
    const linha = (await screen.findByText('Excluiu uma automação')).closest('li') as HTMLElement
    expect(within(linha).getByText('Automação excluída')).toBeInTheDocument()
    // a marca é a etiqueta, não um "detalhe" com nome de máquina
    expect(within(linha).queryByText(/automacao[ _]excluida/i)).toBeNull()
    expect(within(linha).getByText('Execuções no histórico')).toBeInTheDocument()
  })

  it('a busca (nº do pedido) só vai ao servidor no Enter/botão, na página 1', async () => {
    renderizar()
    await screen.findByText('Moveu o card de setor')
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: ' 13429 ' } })
    expect(buscarAuditoria).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Fazer a busca' }))
    await waitFor(() => expect(buscarAuditoria).toHaveBeenCalledTimes(2))
    const [filtros, pagina] = vi.mocked(buscarAuditoria).mock.calls[1]
    expect(filtros.busca).toBe('13429')
    expect(pagina).toBe(1)
  })

  it('a aba das conferências com o Tiny: a próxima às 3h e quais pedidos estavam diferentes', async () => {
    renderizar()
    fireEvent.click(await screen.findByRole('tab', { name: /Conferências com o Tiny/ }))
    expect(await screen.findByText(/A próxima é às 3h da madrugada/)).toBeInTheDocument()
    expect(screen.getByText('Da madrugada (3h)')).toBeInTheDocument()
    expect(screen.getByText('611')).toBeInTheDocument()
    expect(screen.getByText(/estavam diferentes do Tiny/)).toBeInTheDocument()
    expect(screen.getByText('Pedido 13429')).toBeInTheDocument()
    expect(screen.getByText(/situação/)).toBeInTheDocument()
    expect(screen.getByText(/observação interna/)).toBeInTheDocument()
    expect(buscarConferencias).toHaveBeenCalledWith(1, 10)
  })
})
