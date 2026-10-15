import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, CircleCheckBig, Clock, Play, UserRound } from 'lucide-react'
import { cn } from '@/lib/cn'
import { producaoDoPedido } from './api'
import type { PecaDoPedido } from './api'
import { data, diaHoraCurto, tempoDeTrabalho } from './formato'

/** Como a peça saiu das contas, em língua do galpão. */
const SAIDA: Record<string, string> = {
  entregue: 'saiu com a entrega',
  venda: 'saiu com a venda',
  pedido_arquivado: 'pedido arquivado',
  baixa_manual: 'baixa manual',
  concluido: 'concluída',
}

function ondeEsta(p: PecaDoPedido): { texto: string; pronta: boolean } {
  if (p.arquivado_em) {
    return {
      texto: `${SAIDA[p.motivo_saida ?? ''] ?? 'fora das contas'} · ${data(p.arquivado_em)}`,
      pronta: true,
    }
  }
  if (p.perdeu_pedido)
    return { texto: `sem dono (pedido cancelado) · ${p.setor ?? '—'}`, pronta: false }
  if (p.concluido_em) return { texto: `pronta · ${p.setor ?? '—'}`, pronta: true }
  return { texto: [p.setor, p.etapa].filter(Boolean).join(' · ') || '—', pronta: false }
}

/**
 * A PRODUÇÃO do pedido (área Pedidos — D-134: "quem produziu cada produto com
 * tempo de execução em cada etapa e pessoa que participou"). Só busca quando
 * o botão "Produção" abre (1 requisição). Primeiro o resumo — quem trabalhou e
 * quanto; depois cada peça numa linha, e a peça abre a sua história (setor,
 * etapa, quem, início, fim, tempo) no clique.
 */
export function ProducaoDoPedidoPainel({ pedidoId }: { pedidoId: number }) {
  const [abertas, setAbertas] = useState<Set<number>>(() => new Set())
  const consulta = useQuery({
    queryKey: ['pedido-producao', pedidoId],
    queryFn: () => producaoDoPedido(pedidoId),
    gcTime: 0,
    staleTime: 0,
  })

  if (consulta.isPending) return <p className="text-sm text-texto-fraco">Carregando a produção…</p>
  if (consulta.isError || !consulta.data) {
    return (
      <p className="text-sm text-danificado-texto">
        {consulta.error instanceof Error ? consulta.error.message : 'Não deu para carregar.'}
      </p>
    )
  }
  const { pecas, pessoas, segundos } = consulta.data
  if (pecas.length === 0) {
    return (
      <p className="text-sm text-texto-suave">
        Nenhuma peça deste pedido passou pela produção da plataforma.
      </p>
    )
  }
  const prontas = pecas.filter((p) => ondeEsta(p).pronta).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="text-texto">
          <span className="font-semibold tabular-nums">{pecas.length}</span>{' '}
          {pecas.length === 1 ? 'peça' : 'peças'} · <span className="tabular-nums">{prontas}</span>{' '}
          {prontas === 1 ? 'pronta' : 'prontas'}
        </span>
        <span className="inline-flex items-center gap-1 text-texto">
          <Clock aria-hidden className="size-4 text-texto-suave" />
          {segundos > 0
            ? `${tempoDeTrabalho(segundos)} de trabalho`
            : 'Nenhum tempo de trabalho registrado na plataforma'}
        </span>
      </div>

      {pessoas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-texto-suave">Quem trabalhou</p>
          <ul className="flex flex-wrap gap-2">
            {pessoas.map((p) => (
              <li
                key={p.nome}
                className="inline-flex items-center gap-1.5 rounded-full bg-superficie-sutil/70 px-3 py-1 text-sm text-texto"
              >
                <UserRound aria-hidden className="size-3.5 text-texto-suave" />
                {p.nome}
                <span className="text-texto-suave tabular-nums">{tempoDeTrabalho(p.segundos)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="flex flex-col divide-y divide-borda/70 rounded-dm-lg border border-borda/70">
        {pecas.map((peca) => {
          const aberta = abertas.has(peca.card_id)
          const onde = ondeEsta(peca)
          const quem = [...new Set(peca.execucoes.map((e) => e.pessoa).filter(Boolean))]
          return (
            <li key={peca.card_id}>
              <button
                type="button"
                aria-expanded={aberta}
                onClick={() =>
                  setAbertas((atual) => {
                    const nova = new Set(atual)
                    if (nova.has(peca.card_id)) nova.delete(peca.card_id)
                    else nova.add(peca.card_id)
                    return nova
                  })
                }
                className="flex min-h-toque-md w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left transition-colors hover:bg-superficie-sutil/60"
              >
                <ChevronRight
                  aria-hidden
                  className={cn(
                    'size-4 shrink-0 text-texto-suave transition-transform',
                    aberta && 'rotate-90',
                  )}
                />
                <span className="min-w-0 flex-1 text-sm text-texto">
                  {peca.descricao || 'Peça'}
                  {peca.indice !== null && peca.total !== null && (
                    <span className="text-texto-suave tabular-nums">
                      {' '}
                      ({peca.indice}/{peca.total})
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs',
                    onde.pronta ? 'text-perfeito-texto' : 'text-texto-suave',
                  )}
                >
                  {onde.pronta && <CircleCheckBig aria-hidden className="size-3.5" />}
                  {onde.texto}
                </span>
                <span className="text-xs text-texto-suave tabular-nums">
                  {peca.segundos > 0 ? tempoDeTrabalho(peca.segundos) : 'sem tempo registrado'}
                  {quem.length > 0 && ` · ${quem.join(', ')}`}
                </span>
              </button>
              {aberta && (
                <div className="px-3 pb-3 pl-10 transition-[opacity,transform] duration-200 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none">
                  {peca.execucoes.length === 0 ? (
                    <p className="text-sm text-texto-suave">
                      Ninguém começou o trabalho nesta peça ainda.
                    </p>
                  ) : (
                    <ol className="flex flex-col gap-1.5">
                      {peca.execucoes.map((e, i) => (
                        <li
                          key={`${e.iniciou_em}-${i}`}
                          className="grid grid-cols-1 gap-x-3 text-sm sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
                        >
                          <span className="min-w-0 text-texto">
                            {[e.setor, e.etapa].filter(Boolean).join(' · ') || '—'}
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-1 text-texto-suave">
                            <UserRound aria-hidden className="size-3.5 shrink-0" />
                            <span className="truncate">{e.pessoa ?? '—'}</span>
                          </span>
                          <span className="text-texto-suave tabular-nums">
                            {diaHoraCurto(e.iniciou_em)} →{' '}
                            {e.em_andamento ? (
                              <span className="inline-flex items-center gap-1 text-texto">
                                <Play aria-hidden className="size-3 text-perfeito-forte" />
                                agora
                              </span>
                            ) : (
                              diaHoraCurto(e.finalizou_em)
                            )}{' '}
                            · <span className="text-texto">{tempoDeTrabalho(e.segundos)}</span>
                            {e.pausa_segundos > 0 &&
                              ` (pausa ${tempoDeTrabalho(e.pausa_segundos)})`}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
