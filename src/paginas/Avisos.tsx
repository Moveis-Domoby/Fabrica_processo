import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { Paginacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarAvisosPagina, marcarAvisoLido, marcarTodosLidos } from '@/notificacoes/api'

const POR_PAGINA = 20

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Todos os avisos (SESSAO-23 — o "Ver todos" do sino, no lugar do bloco
 * "Avisos recentes" do Meu Painel). Paginado NO SERVIDOR: cada página busca só
 * o que mostra, e o total vem da mesma consulta (regra 17).
 */
export function Avisos() {
  const { perfil } = useSessao()
  const clienteQuery = useQueryClient()
  const [pagina, setPagina] = useState(1)

  const { data } = useQuery({
    queryKey: ['avisos', 'historico', perfil?.id, pagina],
    queryFn: () => buscarAvisosPagina({ usuarioId: perfil!.id, pagina, porPagina: POR_PAGINA }),
    enabled: perfil !== null,
  })
  const avisos = data?.avisos ?? []
  const total = data?.total ?? 0
  const naoLidos = avisos.filter((a) => a.lida_em === null).length

  const invalidar = () => clienteQuery.invalidateQueries({ queryKey: ['avisos'] })
  const lerUm = useMutation({ mutationFn: marcarAvisoLido, onSuccess: invalidar })
  const lerTodos = useMutation({
    mutationFn: () => marcarTodosLidos(perfil!.id),
    onSuccess: invalidar,
  })

  if (!perfil) return null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl">Avisos</h1>
          <p className="mt-1 max-w-2xl text-texto-suave">
            Tudo o que o sino já te avisou, do mais novo para o mais antigo.
          </p>
        </div>
        {naoLidos > 0 && (
          <button
            type="button"
            onClick={() => lerTodos.mutate()}
            disabled={lerTodos.isPending}
            className="inline-flex min-h-toque-md items-center gap-1.5 rounded-dm border border-borda-forte px-3 text-sm font-medium text-texto hover:bg-superficie-sutil"
          >
            <CheckCheck aria-hidden className="size-4" />
            Marcar todas como lidas
          </button>
        )}
      </div>

      {total === 0 ? (
        <p className="rounded-dm-lg border border-borda bg-superficie p-5 text-sm text-texto-suave">
          Nenhum aviso por aqui — quando algo pedir sua atenção, aparece primeiro nesta lista.
        </p>
      ) : (
        <>
          <ul className="flex flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie">
            {avisos.map((a) => (
              <li key={a.id} className="border-b border-borda last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    if (!a.lida_em) lerUm.mutate(a.id)
                  }}
                  className={cn(
                    'flex w-full min-h-toque-md flex-col gap-0.5 px-4 py-2.5 text-left transition-colors hover:bg-superficie-sutil',
                    !a.lida_em && 'bg-superficie-sutil',
                  )}
                >
                  <span className="flex items-baseline gap-2 text-sm font-medium text-texto">
                    <Bell aria-hidden className="size-4 shrink-0 self-center text-texto-fraco" />
                    <span className={cn(!a.lida_em && 'font-semibold')}>{a.titulo}</span>
                    <span className="ml-auto shrink-0 text-xs font-normal text-texto-fraco tabular-nums">
                      {quando(a.criada_em)}
                    </span>
                  </span>
                  <span className="text-sm text-texto-suave">{a.corpo}</span>
                  {!a.lida_em && (
                    <span className="text-xs font-medium text-acao-ativa">
                      Toque para marcar como lida
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {total > POR_PAGINA && (
            <Paginacao
              paginaAtual={pagina}
              totalPaginas={Math.ceil(total / POR_PAGINA)}
              totalItens={total}
              porPagina={POR_PAGINA}
              aoMudarPagina={setPagina}
              className="rounded-dm-lg border border-borda bg-superficie"
            />
          )}
        </>
      )}
    </div>
  )
}
