import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAoVivo } from './aoVivo'

/**
 * A tela ao vivo ao abrir (SESSAO-32 · Lei §2): o que veio guardado (da
 * abertura, de uma visita recente) NÃO é relido "por via das dúvidas" — o
 * canal entra pedindo a reprise dos avisos desde a leitura e só relê se algo
 * mudou. Guardado antigo, hora do banco desconhecida ou canal já aberto: relê
 * uma vez, como antes. O canal é simulado.
 */
const canais = vi.hoisted(() => ({
  abertos: new Set<string>(),
  desvio: 0 as number | null,
  reprises: [] as { topico: string; desde: number }[],
  status: new Map<string, (s: string) => void>(),
  ouvintes: new Map<string, (evento: string) => void>(),
}))

vi.mock('@/chat/canais', () => ({
  canalAberto: (topico: string) => canais.abertos.has(topico),
  horaDoServidor: (ms: number) => (canais.desvio === null ? null : ms + canais.desvio),
  pedirReprise: (topico: string, desde: number) => canais.reprises.push({ topico, desde }),
  ouvirCanal: (topico: string, ouvinte: (evento: string) => void, aoStatus?: (s: string) => void) => {
    canais.ouvintes.set(topico, ouvinte)
    if (aoStatus) canais.status.set(topico, aoStatus)
    return () => {
      canais.ouvintes.delete(topico)
      canais.status.delete(topico)
    }
  },
  topicoDaPessoa: (id: string) => `plt-chat-u:${id}`,
}))

function montar(clienteQuery: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={clienteQuery}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  canais.abertos.clear()
  canais.desvio = 0
  canais.reprises.length = 0
  canais.status.clear()
  canais.ouvintes.clear()
})

describe('useAoVivo — guardado recente vira reprise, não releitura', () => {
  it('dado da abertura: pede a reprise desde a leitura (hora do banco, 3 s de folga) e não relê ao conectar', () => {
    vi.useFakeTimers()
    const clienteQuery = new QueryClient()
    clienteQuery.setQueryData(['metas', 'painel', 1], [{ meta_id: 1 }])
    const lidoEm = clienteQuery.getQueryState(['metas', 'painel', 1])!.dataUpdatedAt
    canais.desvio = 120_000 // o relógio do tablet 2 min atrasado
    const invalidar = vi.spyOn(clienteQuery, 'invalidateQueries')

    renderHook(() => useAoVivo('painel', [['metas']]), { wrapper: montar(clienteQuery) })
    expect(canais.reprises).toEqual([{ topico: 'plt-aviso:painel', desde: lidoEm + 120_000 - 3_000 }])
    act(() => canais.status.get('plt-aviso:painel')!('SUBSCRIBED'))
    act(() => vi.advanceTimersByTime(1_000))
    expect(invalidar).not.toHaveBeenCalled()

    // um aviso reprisado (algo mudou desde a leitura) relê — uma vez
    act(() => canais.ouvintes.get('plt-aviso:painel')!('mudou'))
    act(() => vi.advanceTimersByTime(1_000))
    expect(invalidar).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('guardado de mais de 10 min: sem reprise, relê uma vez ao conectar', () => {
    const clienteQuery = new QueryClient()
    clienteQuery.setQueryData(['metas', 'painel', 1], [{ meta_id: 1 }], { updatedAt: Date.now() - 11 * 60_000 })
    const invalidar = vi.spyOn(clienteQuery, 'invalidateQueries')

    renderHook(() => useAoVivo('painel', [['metas']]), { wrapper: montar(clienteQuery) })
    expect(canais.reprises).toEqual([])
    act(() => canais.status.get('plt-aviso:painel')!('SUBSCRIBED'))
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['metas', 'painel', 1], exact: true })
  })

  it('sem a hora do banco (abertura pelo caminho de reserva): relê como antes', () => {
    canais.desvio = null
    const clienteQuery = new QueryClient()
    clienteQuery.setQueryData(['metas', 'painel', 1], [{ meta_id: 1 }])
    const invalidar = vi.spyOn(clienteQuery, 'invalidateQueries')

    renderHook(() => useAoVivo('painel', [['metas']]), { wrapper: montar(clienteQuery) })
    expect(canais.reprises).toEqual([])
    act(() => canais.status.get('plt-aviso:painel')!('SUBSCRIBED'))
    expect(invalidar).toHaveBeenCalledTimes(1)
  })

  it('canal já aberto por outra tela (não dá para reprisar): relê como antes', () => {
    canais.abertos.add('plt-aviso:painel')
    const clienteQuery = new QueryClient()
    clienteQuery.setQueryData(['metas', 'painel', 1], [{ meta_id: 1 }])
    const invalidar = vi.spyOn(clienteQuery, 'invalidateQueries')

    renderHook(() => useAoVivo('painel', [['metas']]), { wrapper: montar(clienteQuery) })
    expect(canais.reprises).toEqual([])
    act(() => canais.status.get('plt-aviso:painel')!('SUBSCRIBED'))
    expect(invalidar).toHaveBeenCalledTimes(1)
  })

  it('nada guardado (1ª visita): a reprise cobre o vão entre a 1ª leitura e o canal', () => {
    const clienteQuery = new QueryClient()
    const antes = Date.now()
    renderHook(() => useAoVivo('danificados', [['danificados']]), { wrapper: montar(clienteQuery) })
    expect(canais.reprises).toHaveLength(1)
    expect(canais.reprises[0].topico).toBe('plt-aviso:danificados')
    expect(canais.reprises[0].desde).toBeGreaterThanOrEqual(antes - 3_000)
    expect(canais.reprises[0].desde).toBeLessThanOrEqual(Date.now() - 3_000)
  })
})
