import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { apagarAviso, apagarLidas, buscarAvisos, marcarAvisoLido, marcarTodosLidos } from './api'

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
export function SinoNotificacoes({
  usuarioId,
  painelLado = 'direita',
}: {
  usuarioId: string
  /** De que borda da PÁGINA o painel abre — nunca ancorado no próprio sino (o
   *  sino agora vive no topo da sidebar; ancorar nele estouraria a tela). */
  painelLado?: 'esquerda' | 'direita'
}) {
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
  // Só o aviso LIDO se apaga (regra do banco); o fato segue em plt_eventos.
  const apagarUm = useMutation({ mutationFn: apagarAviso, onSuccess: invalidar })
  const apagarTodasLidas = useMutation({
    mutationFn: () => apagarLidas(usuarioId),
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
            // Painel fixo, ancorado à borda da PÁGINA (nunca no sino) e com
            // altura limitada pela própria tela: não é cortado em viewport
            // nenhum, com a sidebar aberta ou recolhida.
            className={cn(
              'fixed top-16 z-50 flex max-h-[calc(100dvh-5rem)] w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie shadow-lg',
              painelLado === 'direita' ? 'right-3' : 'left-3',
            )}
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

            <ul className="min-h-0 flex-1 overflow-y-auto">
              {avisos.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-texto-fraco">
                  Nenhum aviso por aqui.
                </li>
              )}
              {avisos.map((aviso) => (
                <li
                  key={aviso.id}
                  className="flex items-stretch border-b border-borda last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (aviso.lida_em === null) lerUm.mutate(aviso.id)
                    }}
                    className={cn(
                      'flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-superficie-sutil',
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
                  {aviso.lida_em !== null && (
                    <button
                      type="button"
                      aria-label={`Apagar o aviso "${aviso.titulo}"`}
                      disabled={apagarUm.isPending}
                      onClick={() => apagarUm.mutate(aviso.id)}
                      className="toque-seguro flex w-10 shrink-0 items-center justify-center text-texto-fraco transition-colors hover:bg-superficie-sutil hover:text-danificado-forte"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {/* SESSAO-23: o histórico completo mora numa tela própria, paginada
                no servidor — aqui só os mais recentes. */}
            <div className="flex border-t border-borda">
              {avisos.some((a) => a.lida_em !== null) && (
                <button
                  type="button"
                  disabled={apagarTodasLidas.isPending}
                  onClick={() => apagarTodasLidas.mutate()}
                  className="flex min-h-toque-md flex-1 items-center justify-center gap-1.5 border-r border-borda text-sm font-medium text-texto-suave hover:bg-superficie-sutil hover:text-danificado-forte"
                >
                  <Trash2 aria-hidden className="size-4" />
                  Apagar lidas
                </button>
              )}
              <Link
                to="/inicio/avisos"
                onClick={() => setAberto(false)}
                className="flex min-h-toque-md flex-1 items-center justify-center text-sm font-medium text-texto hover:bg-superficie-sutil"
              >
                Ver todos
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
