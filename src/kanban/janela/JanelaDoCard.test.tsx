import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import type { JanelaDoCard as Dados } from './api'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/perfil/api', () => ({ urlDaFoto: () => null }))
// SESSAO-50 (bloco A): a janela ouve o canal do card (a observação do item que muda)
vi.mock('@/chat/canais', () => ({ ouvirCanal: () => () => undefined }))

let papel = 'admin'
vi.mock('@/autenticacao/sessao-contexto', () => ({
  useSessao: () => ({ perfil: { id: 'u-1', papel, nivel: null }, ehLider: papel === 'admin' }),
}))

const recuperar = vi.fn(async () => ({ feito: true, etapa: 'A LIMPAR' }))
vi.mock('../apiCancelamento', () => ({
  recuperarPecaCancelada: (...a: unknown[]) => recuperar(...(a as [])),
}))

let dados: Dados
vi.mock('./api', async (original) => {
  const real = await original<typeof import('./api')>()
  return { ...real, abrirJanela: vi.fn(async () => dados) }
})

const CANCELADA = new Date(2026, 10, 3, 15, 0).toISOString()

function janela(arquivada: boolean): Dados {
  return {
    card: {
      id: 900,
      tipo: 'unidade',
      pedido_id: null,
      produto_tiny_id: 422,
      card_pai_id: 55,
      item_seq: 1,
      item_codigo: '422',
      item_descricao: 'Estante Basic 7 nichos – Branca',
      indice_unidade: 1,
      total_unidades: 2,
      setor_atual_id: 7,
      etapa_atual_id: 32,
      desde: CANCELADA,
      executor_atual_id: null,
      responsavel_id: null,
      delegado_em: null,
      qualidade_atual: null,
      concluido_em: null,
      pausado_em: null,
      liberado_completo_em: null,
      cancelada_em: CANCELADA,
      cancelada_motivo: 'cancelada',
      cancelada_pedido_numero: 13622,
    },
    arquivado_em: arquivada ? new Date(2026, 10, 11, 3, 0).toISOString() : null,
    criado_em: CANCELADA,
    setor: { id: 7, nome: 'LIMPEZA E EMBALAGEM', codigo: 'limpeza_embalagem', papel_no_fluxo: 'producao' },
    etapa: { id: 32, nome: 'CANCELADO', eh_fila: false },
    execucao: null,
    auxilios: [],
    pessoas: {},
    pedido: null,
    campos: [],
    etiquetas: [],
    permissoes: {
      editar: false,
      editar_nome: false,
      concluir: false,
      anexar: false,
      ver_removidos: false,
      pausar: false,
      retomar: false,
      auxiliar: false,
      sair_auxilio: false,
    },
  }
}

async function abrir() {
  const { JanelaDoCard } = await import('./JanelaDoCard')
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <ProvedorNotificacao>
        <MemoryRouter>
          <JanelaDoCard cardId={900} aoFechar={() => undefined} />
        </MemoryRouter>
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
  return screen.findByText(/saiu da produção/)
}

describe('a janela da peça com a fabricação cancelada (SESSAO-48)', () => {
  beforeEach(() => {
    recuperar.mockClear()
    papel = 'admin'
  })

  it('na coluna: diz que saiu da produção, de qual pedido era e como desfazer — sem botão de recuperar', async () => {
    dados = janela(false)
    const aviso = await abrir()
    expect(aviso.textContent).toMatch(/A fabricação desta peça foi cancelada e ela saiu da produção/)
    expect(aviso.textContent).toMatch(/era do pedido 13622; a vaga voltou ao PCP/)
    expect(aviso.textContent).toMatch(/arraste-a de volta para uma etapa de produção/)
    expect(screen.getByText('Cancelada em 03/11')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Recuperar a peça/ })).toBeNull()
  })

  it('já tirada da coluna: o administrador recupera (volta para a fila)', async () => {
    dados = janela(true)
    const aviso = await abrir()
    expect(aviso.textContent).toMatch(/só o administrador a traz de volta/)
    fireEvent.click(screen.getByRole('button', { name: /Recuperar a peça/ }))
    await waitFor(() => expect(recuperar).toHaveBeenCalledWith(900))
    expect(await screen.findByText('Peça recuperada — voltou para A LIMPAR')).toBeTruthy()
  })

  it('quem não é administrador vê o aviso, mas não o botão', async () => {
    papel = 'lider'
    dados = janela(true)
    await abrir()
    expect(screen.queryByRole('button', { name: /Recuperar a peça/ })).toBeNull()
  })
})
