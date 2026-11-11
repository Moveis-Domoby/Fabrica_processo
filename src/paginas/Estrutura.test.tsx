import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import type { Etapa, Setor } from '@/kanban/tipos'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/autenticacao/sessao-contexto', () => ({
  useSessao: () => ({ perfil: { id: 'u-admin', papel: 'admin' }, vinculos: [] }),
}))
vi.mock('@/autenticacao/api', () => ({ setorPinDefinir: vi.fn() }))

const LIMPEZA = {
  id: 7,
  nome: 'LIMPEZA E EMBALAGEM',
  codigo: 'limpeza_embalagem',
  papel_no_fluxo: 'producao',
  ordem: 70,
  ativo: true,
} as unknown as Setor

const etapa = (e: Partial<Etapa> & Pick<Etapa, 'id' | 'nome' | 'ordem'>): Etapa => ({
  setor_id: 7,
  eh_fila: false,
  eh_danificado: false,
  ativa: true,
  setor_destino_id: null,
  conclui_producao: false,
  pede_motivo: false,
  ...e,
})

const atualizarEtapa = vi.fn(async () => undefined)
vi.mock('@/kanban/api', async (original) => {
  const real = await original<typeof import('@/kanban/api')>()
  return {
    ...real,
    buscarSetores: vi.fn(async () => [LIMPEZA]),
    buscarEtapasDoSetor: vi.fn(async () => [
      etapa({ id: 30, nome: 'A LIMPAR', ordem: 1, eh_fila: true }),
      etapa({ id: 31, nome: 'NÃO ENCONTRADO', ordem: 8, cancela_fabricacao: true, cancela_motivo: 'nao_encontrada', cancela_dias: 7 }),
      etapa({ id: 32, nome: 'CANCELADO', ordem: 9, cancela_fabricacao: true, cancela_motivo: 'cancelada', cancela_dias: 7 }),
    ]),
    atualizarEtapa: (...args: unknown[]) => atualizarEtapa(...(args as [])),
  }
})

async function abrir() {
  const { Estrutura } = await import('./Estrutura')
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <ProvedorNotificacao>
        <MemoryRouter initialEntries={['/configuracoes/setores-e-etapas?setor=7']}>
          <Estrutura />
        </MemoryRouter>
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
  await screen.findByLabelText('Em quantos dias a peça cancelada some da coluna CANCELADO')
}

describe('Setores e etapas — a coluna que cancela a fabricação (SESSAO-48)', () => {
  beforeEach(() => atualizarEtapa.mockClear())

  it('o CANCELADO e o NÃO ENCONTRADO mostram a escolha no mesmo lugar de "conclui a produção", com o prazo em dias', async () => {
    await abrir()
    expect(screen.getByText('Cancela a fabricação')).toBeTruthy()
    expect(screen.getByText('Peça não encontrada')).toBeTruthy()
    const dias = screen.getByLabelText('Em quantos dias a peça cancelada some da coluna CANCELADO') as HTMLInputElement
    expect(dias.value).toBe('7')
    // a coluna que cancela não pede o motivo da parada (o motivo é o dela)
    expect(screen.queryByLabelText('Parar em CANCELADO pede o motivo')).toBeNull()
  })

  it('o prazo salva ao sair do campo, só de 1 a 90 dias', async () => {
    await abrir()
    const dias = screen.getByLabelText('Em quantos dias a peça cancelada some da coluna CANCELADO') as HTMLInputElement
    fireEvent.change(dias, { target: { value: '0' } })
    fireEvent.blur(dias)
    expect(await screen.findByText('Use de 1 a 90 dias.')).toBeTruthy()
    expect(atualizarEtapa).not.toHaveBeenCalled()
    fireEvent.change(dias, { target: { value: '10' } })
    fireEvent.blur(dias)
    await waitFor(() => expect(atualizarEtapa).toHaveBeenCalledWith(32, { cancela_dias: 10 }))
    // o mesmo valor de antes não grava nada
    atualizarEtapa.mockClear()
    const outro = screen.getByLabelText('Em quantos dias a peça cancelada some da coluna NÃO ENCONTRADO')
    fireEvent.blur(outro)
    expect(atualizarEtapa).not.toHaveBeenCalled()
  })
})
