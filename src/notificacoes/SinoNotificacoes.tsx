import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/cn'
import { buscarAvisos, marcarAvisoLido, marcarTodosLidos } from './api'

const ATUALIZA_A_CADA = 30_000

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * O sino do topo (SESSAO-06 / Q-18): onde o líder/admin vê os avisos que o
 * banco gera sozinho — 🟡/🔴 na entrega, divergência no recebimento, chegada
 * em ESTOQUE. Quem não recebe aviso nenhum vê a caixa vazia; o RLS garante que
 * cada um só enxerga os seus.
 */
export function SinoNotificacoes({ usuarioId }: { usuarioId: string }) {
  const clienteQuery = useQueryClient()
  const [aberto, setAberto] = useState(false)

  const { data: avisos = [] } = useQuery({
    queryKey: ['avisos', usuarioId],
    queryFn: () => buscarAvisos(usuarioId),
    refetchInterval: ATUALIZA_A_CADA,
  })
  const naoLidos = avisos.filter((a) => a.lida_em === null)

  const invalidar = () => clienteQuery.invalidateQueries({ queryKey: ['avisos'] })
  const lerUm = useMutation({ mutationFn: marcarAvisoLido, onSuccess: invalidar })
  const lerTodos = useMutation({
    mutationFn: () => marcarTodosLidos(usuarioId),
    onSuccess: invalidar,
  })

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-label={
          naoLidos.length > 0
            ? `Notificações: ${naoLidos.length} não lida${naoLidos.length === 1 ? '' : 's'}`
            : 'Notificações'
        }
        aria-expanded={aberto}
        className="toque-seguro relative inline-flex h-toque-md w-toque-md items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600"
      >
        <Bell aria-hidden className="size-5" />
        {naoLidos.length > 0 && (
          <span className="absolute right-1 top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-danificado-forte px-1 text-xs font-semibold text-white tabular-nums">
            {naoLidos.length > 9 ? '9+' : naoLidos.length}
          </span>
        )}
      </button>

      {aberto && (
        <>
          {/* Fundo invisível para fechar com um toque fora (dedo de galpão). */}
          <button
            type="button"
            aria-label="Fechar notificações"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setAberto(false)}
          />
          <div
            role="region"
            aria-label="Notificações"
            className="absolute right-0 top-full z-50 mt-2 flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie shadow-lg"
          >
            <header className="flex items-center justify-between gap-2 border-b border-borda px-3 py-2">
              <span className="text-sm font-semibold text-texto">Notificações</span>
              {naoLidos.length > 0 && (
                <button
                  type="button"
                  onClick={() => lerTodos.mutate()}
                  disabled={lerTodos.isPending}
                  className="inline-flex min-h-toque-md items-center gap-1 rounded-dm px-2 text-xs font-medium text-texto-suave hover:bg-superficie-sutil"
                >
                  <CheckCheck aria-hidden className="size-4" />
                  Marcar todas como lidas
                </button>
              )}
            </header>

            <ul className="max-h-96 overflow-y-auto">
              {avisos.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-texto-fraco">
                  Nenhum aviso por aqui.
                </li>
              )}
              {avisos.map((aviso) => (
                <li key={aviso.id} className="border-b border-borda last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (aviso.lida_em === null) lerUm.mutate(aviso.id)
                    }}
                    className={cn(
                      'flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-superficie-sutil',
                      aviso.lida_em === null && 'bg-superficie-sutil',
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          'text-sm text-texto',
                          aviso.lida_em === null && 'font-semibold',
                        )}
                      >
                        {aviso.titulo}
                      </span>
                      <span className="shrink-0 text-xs text-texto-fraco tabular-nums">
                        {quando(aviso.criada_em)}
                      </span>
                    </span>
                    <span className="text-xs text-texto-suave">{aviso.corpo}</span>
                    {aviso.lida_em === null && (
                      <span className="text-xs font-medium text-acao-ativa">
                        Toque para marcar como lida
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
