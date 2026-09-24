import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Eye, Pause, Play } from 'lucide-react'
import { useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarSetores } from '@/kanban/api'
import { formatarDuracao, formatarDuracaoMs, useAgora } from '@/kanban/tempo'
import { rotaDoSetor } from '@/navegacao/rotas'
import { minhasExecucoesAbertas } from '@/metas/api'
import {
  cardsPorIds,
  concluirTarefa,
  minhasTarefas,
  msTempoTarefa,
  pausarTarefa,
  tarefaRodando,
} from './api'
import { ModalTarefa } from './ModalTarefa'

const ATUALIZA_A_CADA = 30_000

/**
 * A bolinha flutuante do "em execução agora" (pedido do dono, 23/09): ela
 * percorre a plataforma inteira, meio transparente, e só existe enquanto algo
 * conta tempo para a pessoa — tarefa com timer rodando ou execução de card na
 * produção. O clique abre o painel rápido: pausar, concluir e ver detalhes
 * (o preview da tarefa); card de produção leva ao quadro do setor.
 */
export function BolhaExecucao() {
  const { perfil } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora()
  const [aberta, setAberta] = useState(false)
  const [tarefaAbertaId, setTarefaAbertaId] = useState<number | null>(null)

  // Mesmos fetchers das telas (E-22: uma chave, um fetcher) — a bolha não
  // inventa consulta nova, só reaproveita o que o painel já usa.
  const { data: tarefas = [] } = useQuery({
    queryKey: ['afazeres', 'tarefas', perfil?.id],
    queryFn: () => minhasTarefas(perfil!.id),
    enabled: perfil !== null,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: execucoes = [] } = useQuery({
    queryKey: ['meu-painel', 'execucoes', perfil?.id],
    queryFn: () => minhasExecucoesAbertas(perfil!.id),
    enabled: perfil !== null,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const rodando = useMemo(() => tarefas.filter(tarefaRodando), [tarefas])
  const idsCards = useMemo(() => execucoes.map((e) => e.card_id), [execucoes])
  const { data: cards = [] } = useQuery({
    queryKey: ['bolha', 'cards', idsCards.join(',')],
    queryFn: () => cardsPorIds(idsCards),
    enabled: aberta && idsCards.length > 0,
  })
  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })
  const setorPorId = useMemo(() => new Map(setores.map((s) => [s.id, s])), [setores])

  async function invalidar() {
    await Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['afazeres'] }),
      clienteQuery.invalidateQueries({ queryKey: ['meu-painel'] }),
    ])
  }
  function aoErro(titulo: string) {
    return (excecao: unknown) =>
      notificar({
        titulo,
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
  }
  const pausarMutacao = useMutation({
    mutationFn: pausarTarefa,
    onSuccess: async () => {
      notificar({ titulo: 'Tempo pausado', descricao: 'A contagem fica guardada.', tom: 'perfeito' })
      await invalidar()
    },
    onError: aoErro('Não deu para pausar'),
  })
  const concluirMutacao = useMutation({
    mutationFn: concluirTarefa,
    onSuccess: async () => {
      notificar({ titulo: 'Tarefa concluída', tom: 'perfeito' })
      await invalidar()
    },
    onError: aoErro('Não deu para concluir'),
  })

  const total = rodando.length + execucoes.length
  const tarefaAberta = tarefas.find((t) => t.id === tarefaAbertaId) ?? null

  if (!perfil || total === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(!aberta)}
        aria-label={`Em execução agora: ${total} item${total === 1 ? '' : 's'}`}
        aria-expanded={aberta}
        className={cn(
          'fixed right-4 bottom-20 z-40 inline-flex size-toque-lg items-center justify-center rounded-full bg-acao text-acao-texto shadow-lg transition-opacity sm:bottom-6',
          aberta ? 'opacity-100' : 'opacity-60 hover:opacity-100',
        )}
      >
        <Play aria-hidden className="size-6" />
        <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-grafite-950 px-1 text-xs font-semibold text-white tabular-nums">
          {total}
        </span>
      </button>

      {aberta && (
        <>
          <button
            type="button"
            aria-label="Fechar o painel de execução"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setAberta(false)}
          />
          <div
            role="region"
            aria-label="Em execução agora"
            className="fixed right-4 bottom-36 z-50 flex max-h-[60dvh] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie shadow-2xl sm:bottom-22"
          >
            <header className="border-b border-borda px-3 py-2">
              <p className="text-sm font-semibold text-texto">Em execução agora</p>
              <p className="text-xs text-texto-fraco">o tempo está contando para você</p>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {rodando.map((t) => (
                <div key={`t-${t.id}`} className="flex flex-col gap-1.5 border-b border-borda px-3 py-2 last:border-b-0">
                  <p className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium text-texto">{t.titulo}</span>
                    <span className="shrink-0 text-xs text-texto-suave tabular-nums">
                      {formatarDuracaoMs(msTempoTarefa(t, agora))}
                    </span>
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={pausarMutacao.isPending}
                      onClick={() => pausarMutacao.mutate(t.id)}
                      className="inline-flex min-h-toque-md flex-1 items-center justify-center gap-1 rounded-dm border border-borda-forte text-xs font-medium text-texto hover:bg-superficie-sutil"
                    >
                      <Pause aria-hidden className="size-3.5" /> Pausar
                    </button>
                    <button
                      type="button"
                      disabled={concluirMutacao.isPending}
                      onClick={() => concluirMutacao.mutate(t.id)}
                      className="inline-flex min-h-toque-md flex-1 items-center justify-center gap-1 rounded-dm bg-acao text-xs font-semibold text-acao-texto"
                    >
                      <CheckCircle2 aria-hidden className="size-3.5" /> Concluir
                    </button>
                    <button
                      type="button"
                      onClick={() => setTarefaAbertaId(t.id)}
                      className="inline-flex min-h-toque-md flex-1 items-center justify-center gap-1 rounded-dm border border-borda-forte text-xs font-medium text-texto hover:bg-superficie-sutil"
                    >
                      <Eye aria-hidden className="size-3.5" /> Ver detalhes
                    </button>
                  </div>
                </div>
              ))}
              {execucoes.map((e) => {
                const card = cards.find((c) => c.id === e.card_id)
                const setor = card?.setor_atual_id ? setorPorId.get(card.setor_atual_id) : undefined
                return (
                  <Link
                    key={`e-${e.evento_inicio_id}`}
                    to={setor ? rotaDoSetor(setor.codigo) : '/inicio/afazeres'}
                    onClick={() => setAberta(false)}
                    className="flex min-h-toque-md flex-col justify-center gap-0.5 border-b border-borda px-3 py-2 last:border-b-0 hover:bg-superficie-sutil"
                  >
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-medium text-texto">
                        {card?.item_descricao ?? `Card ${e.card_id}`}
                      </span>
                      <span className="shrink-0 text-xs text-texto-suave tabular-nums">
                        {formatarDuracao(e.iniciou_em, agora)}
                      </span>
                    </span>
                    <span className="text-xs text-texto-fraco">
                      execução na produção{setor ? ` · ${setor.nome}` : ''} — toque para abrir o quadro
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}

      <ModalTarefa tarefa={tarefaAberta} aoFechar={() => setTarefaAbertaId(null)} />
    </>
  )
}
