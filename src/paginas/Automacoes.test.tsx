import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { Automacoes } from './Automacoes'
import { excluirAutomacao, ligarAutomacao, salvarAutomacao } from '@/automacoes/api'
import { desarquivarCard } from '@/utilitarios/api'

/**
 * Painel super admin → Automações (SESSAO-27 · D-99/D-103): a lista com o
 * QUANDO em português e o liga/desliga de dois toques; o editor monta pelo "+"
 * e salva só a sequência; o histórico mostra cada passo e o "Trazer de volta".
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/kanban/api', () => ({
  buscarSetores: vi.fn(async () => [
    { id: 4, codigo: 'fitamento', nome: 'FITAMENTO', papel_no_fluxo: 'producao', ordem: 40, ativo: true },
    { id: 6, codigo: 'montagem', nome: 'MONTAGEM', papel_no_fluxo: 'producao', ordem: 60, ativo: true },
  ]),
  buscarEtapasAtivas: vi.fn(async () => [
    { id: 61, setor_id: 6, nome: 'A MONTAR', ordem: 1, eh_fila: true, eh_danificado: false, ativa: true, setor_destino_id: null },
  ]),
}))
vi.mock('@/metas/api', () => ({ usuariosAtivos: vi.fn(async () => [{ id: 'u1', nome: 'Guilherme' }]) }))
vi.mock('@/utilitarios/api', () => ({
  buscarEtiquetas: vi.fn(async () => [{ id: 1, nome: 'Urgente', cor: 'azul', arquivada_em: null }]),
  buscarCampos: vi.fn(async () => []),
  buscarValoresCampos: vi.fn(async () => []),
  buscarEtiquetasDosCards: vi.fn(async () => []),
  desarquivarCard: vi.fn(async () => undefined),
}))
vi.mock('@/automacoes/api', () => ({
  POR_PAGINA_AUTOMACOES: 30,
  POR_PAGINA_EXECUCOES: 15,
  enderecoChamada: (id: number) => `https://exemplo/functions/v1/api/automacoes/${id}/disparar`,
  listarAutomacoes: vi.fn(async () => ({
    total: 1,
    linhas: [
      {
        id: 7,
        nome: 'Parado avisa o líder',
        ligada: false,
        gatilho: 'card_parado',
        gatilho_config: { horas: 72 },
        passos_total: 1,
        ligada_em: null,
        atualizada_em: '2026-10-02T03:00:00Z',
        arquivada_em: null,
        ultima_execucao_em: null,
        ultima_situacao: null,
        execucoes_24h: 0,
      },
    ],
  })),
  buscarAutomacao: vi.fn(async (id: number) => ({
    id,
    nome: 'Entrou em A arquiva',
    ligada: true,
    gatilho: 'card_entrou',
    gatilho_config: { setor_id: 6, etapa_id: 61 },
    passos: [{ tipo: 'arquivar' }],
    desenho: {},
    segredo: 'abc',
    ligada_em: '2026-10-02T03:00:00Z',
    arquivada_em: null,
    criada_em: '2026-10-02T03:00:00Z',
    atualizada_em: '2026-10-02T03:00:00Z',
  })),
  salvarAutomacao: vi.fn(async () => 99),
  ligarAutomacao: vi.fn(async () => undefined),
  arquivarAutomacao: vi.fn(async () => undefined),
  excluirAutomacao: vi.fn(async () => undefined),
  listarExecucoes: vi.fn(async () => ({
    total: 1,
    linhas: [
      {
        id: 501,
        gatilho: 'card_entrou',
        situacao: 'concluida',
        avaliacao: 'o card entrou e continua na etapa',
        resultado: [{ n: 1, tipo: 'arquivar', resultado: 'feito', frase: 'arquivou o card', em: '2026-10-02T03:05:00Z', arquivou: true }],
        profundidade: 0,
        card_id: 589,
        card_tipo: 'unidade',
        card_arquivado: true,
        produto: 'Mesa Teste',
        unidade: '1/1',
        pedido_numero: 13429,
        setor: 'MONTAGEM',
        etapa: 'A MONTAR',
        contexto: {},
        executar_em: null,
        criada_em: '2026-10-02T03:05:00Z',
        atualizada_em: '2026-10-02T03:05:00Z',
      },
    ],
  })),
}))

function renderizar(rota: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[rota]}>
        <ProvedorNotificacao>
          <Automacoes />
        </ProvedorNotificacao>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Super admin → Automações', () => {
  beforeEach(() => vi.clearAllMocks())

  it('a lista diz o QUANDO em português, o selo "Desligada" e liga em dois toques', async () => {
    renderizar('/super-admin/automacoes')
    const linha = (await screen.findByText('Parado avisa o líder')).closest('li') as HTMLElement
    expect(within(linha).getByText('Desligada')).toBeInTheDocument()
    expect(await within(linha).findByText(/O card ficou parado 3 dias em qualquer setor de produção → 1 passo/)).toBeInTheDocument()
    // nada de código na tela
    expect(linha.textContent).not.toMatch(/card_parado|gatilho/)
    fireEvent.click(within(linha).getByRole('button', { name: 'Ligar' }))
    expect(ligarAutomacao).not.toHaveBeenCalled()
    fireEvent.click(within(linha).getByRole('button', { name: 'Sim, ligar' }))
    await waitFor(() => expect(ligarAutomacao).toHaveBeenCalledWith(7, true))
  })

  it('a nova automação se monta pelo "+" e salva SÓ a sequência (o QUANDO + os passos ligados)', async () => {
    renderizar('/super-admin/automacoes?a=nova')
    fireEvent.change(await screen.findByLabelText('Nome da automação'), { target: { value: 'Entrou põe etiqueta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pôr um bloco depois de "Quando"' }))
    const escolha = await screen.findByRole('dialog')
    fireEvent.click(within(escolha).getByText('Pôr etiqueta'))
    // o painel do bloco novo abre com as etiquetas reais
    fireEvent.click(await screen.findByRole('checkbox', { name: /Urgente/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(salvarAutomacao).toHaveBeenCalledTimes(1))
    const enviado = vi.mocked(salvarAutomacao).mock.calls[0][0]
    expect(enviado).toMatchObject({
      id: null,
      nome: 'Entrou põe etiqueta',
      gatilho: 'card_entrou',
      passos: [{ tipo: 'etiqueta_por', etiquetas: [1] }],
    })
    expect(enviado.desenho.versao).toBe(1)
  })

  it('o "Se… senão" ganha duas saídas, cada uma com o seu "+", e salva os caminhos dentro dele', async () => {
    renderizar('/super-admin/automacoes?a=nova')
    fireEvent.change(await screen.findByLabelText('Nome da automação'), { target: { value: 'Com caminhos' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pôr um bloco depois de "Quando"' }))
    const escolha = await screen.findByRole('dialog')
    // a escolha vem por grupos
    expect(within(escolha).getByRole('heading', { name: 'Lógica' })).toBeInTheDocument()
    fireEvent.click(within(escolha).getByText('Se… senão'))
    fireEvent.click(await screen.findByRole('button', { name: 'Pôr um bloco no caminho Senão de "1. Se… senão"' }))
    const noSenao = await screen.findByRole('dialog', { name: 'Que bloco vem no caminho Senão?' })
    fireEvent.click(within(noSenao).getByText('Arquivar o card'))
    expect(screen.getByRole('button', { name: 'Pôr um bloco no caminho Sim de "1. Se… senão"' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(salvarAutomacao).toHaveBeenCalledTimes(1))
    expect(vi.mocked(salvarAutomacao).mock.calls[0][0].passos).toEqual([
      { tipo: 'se_senao', entao: [], senao: [{ tipo: 'arquivar' }] },
    ])
  })

  it('excluir: confirma na própria barra e some de vez (o que ela fez fica na Auditoria)', async () => {
    renderizar('/super-admin/automacoes?a=12')
    expect(await screen.findByDisplayValue('Entrou em A arquiva')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir a automação' }))
    expect(screen.getByText('Excluir de vez? Ela some; o que ela fez fica na Auditoria.')).toBeInTheDocument()
    expect(excluirAutomacao).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Sim, excluir' }))
    await waitFor(() => expect(excluirAutomacao).toHaveBeenCalledWith(12))
  })

  it('a aba Execuções (escondida até o clique) mostra cada passo e o "Trazer de volta" quando a automação arquivou', async () => {
    renderizar('/super-admin/automacoes?a=12')
    expect(await screen.findByDisplayValue('Entrou em A arquiva')).toBeInTheDocument()
    // como no n8n: as execuções ficam escondidas até clicar na aba lá em cima
    expect(screen.queryByText('Últimas execuções')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Execuções/ }))
    const execucao = (await screen.findByText(/Pedido 13429 · Mesa Teste \(1\/1\)/)).closest('li') as HTMLElement
    expect(within(execucao).getByText('Concluída')).toBeInTheDocument()
    expect(within(execucao).getByText(/Condição: o card entrou e continua na etapa/)).toBeInTheDocument()
    expect(within(execucao).getByText(/arquivou o card/)).toBeInTheDocument()
    fireEvent.click(within(execucao).getByRole('button', { name: 'Trazer de volta' }))
    await waitFor(() => expect(desarquivarCard).toHaveBeenCalledWith(589, expect.any(String)))
  })
})
