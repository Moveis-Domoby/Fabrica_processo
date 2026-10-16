import { useMemo } from 'react'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import {
  ArchiveRestore,
  CircleAlert,
  CircleCheck,
  CircleSlash,
  Clock,
  OctagonX,
  RefreshCw,
} from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import { MaisAoRolar } from '@/componentes/MaisAoRolar'
import { cn } from '@/lib/cn'
import { desarquivarCard } from '@/utilitarios/api'
import { listarExecucoes } from '../api'
import type { Execucao } from '../api'
import {
  ROTULO_GATILHO,
  ROTULO_RESULTADO_PASSO,
  ROTULO_SITUACAO_EXECUCAO,
  rotuloSituacaoPedido,
} from '../catalogo'

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ICONE_SITUACAO: Record<string, { icone: typeof CircleCheck; classe: string }> = {
  concluida: {
    icone: CircleCheck,
    classe: 'bg-perfeito-fundo text-perfeito-texto border-perfeito-borda',
  },
  esperando: { icone: Clock, classe: 'bg-info-fundo text-info-texto border-info-borda' },
  rodando: { icone: RefreshCw, classe: 'bg-info-fundo text-info-texto border-info-borda' },
  parou: { icone: CircleSlash, classe: 'bg-superficie-sutil text-texto-suave border-borda' },
  ignorada: { icone: CircleSlash, classe: 'bg-superficie-sutil text-texto-suave border-borda' },
  falhou: {
    icone: OctagonX,
    classe: 'bg-danificado-fundo text-danificado-texto border-danificado-borda',
  },
  barrada: {
    icone: CircleAlert,
    classe: 'bg-atencao-fundo text-atencao-texto border-atencao-borda',
  },
}

/** O que disparou, em língua de gente: o card (pedido · produto · k/n) ou o pedido. */
function oQueDisparou(e: Execucao): string {
  const partes: string[] = []
  if (e.pedido_numero) partes.push(`Pedido ${e.pedido_numero}`)
  if (e.card_tipo === 'unidade' && e.produto)
    partes.push(`${e.produto}${e.unidade ? ` (${e.unidade})` : ''}`)
  if (e.card_tipo === 'reposicao') partes.push(`Reposição · ${e.produto ?? ''}`)
  if (partes.length === 0)
    partes.push(e.gatilho === 'chamada_externa' ? 'Chamada de fora, sem card' : 'Sem card')
  const de = e.contexto?.de as string | undefined
  const para = e.contexto?.para as string | undefined
  if (e.gatilho === 'pedido_situacao' && (de || para))
    partes.push(`${rotuloSituacaoPedido(de)} → ${rotuloSituacaoPedido(para)}`)
  return partes.join(' · ')
}

/**
 * As ÚLTIMAS EXECUÇÕES de uma automação (SESSAO-27 · D-103): cada disparo com
 * o que gatilhou, a condição avaliada, cada passo e o resultado — uma página
 * por vez, buscada no servidor (regra 17). Onde a automação arquivou, o
 * "Trazer de volta" desfaz à mão.
 */
export function Execucoes({ automacaoId }: { automacaoId: number }) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  // SESSAO-32 (migration 81): o histórico cresce sem fim — por cursor, a
  // próxima página ao rolar; o total só na 1ª.
  const consulta = useInfiniteQuery({
    queryKey: ['automacoes', 'execucoes', automacaoId],
    queryFn: ({ pageParam }) => listarExecucoes(automacaoId, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (ultima) =>
      ultima.temMais && ultima.linhas.length
        ? ultima.linhas[ultima.linhas.length - 1].id
        : undefined,
    placeholderData: keepPreviousData,
  })
  const voltar = useMutation({
    mutationFn: (cardId: number) =>
      desarquivarCard(cardId, 'Trazido de volta pelo histórico da automação'),
    onSuccess: async () => {
      notificar({ titulo: 'Card trazido de volta', tom: 'perfeito' })
      await clienteQuery.invalidateQueries({ queryKey: ['automacoes', 'execucoes', automacaoId] })
      await clienteQuery.invalidateQueries({ queryKey: ['cards'] })
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu certo',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  const linhas = useMemo(
    () => (consulta.data?.pages ?? []).flatMap((p) => p.linhas),
    [consulta.data],
  )
  const total = consulta.data?.pages[0]?.total ?? 0

  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-execucoes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-execucoes" className="text-lg">
          Últimas execuções
        </h2>
        <Botao
          variante="fantasma"
          icone={<RefreshCw />}
          carregando={consulta.isFetching}
          onClick={() => void consulta.refetch()}
        >
          Atualizar
        </Botao>
      </div>
      {consulta.isError && (
        <p className="rounded-dm border border-danificado-forte bg-danificado-fundo p-3 text-sm text-danificado-texto">
          {(consulta.error as Error).message}
        </p>
      )}
      {consulta.isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {!consulta.isPending && linhas.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Ainda não rodou nenhuma vez.
        </p>
      )}
      {linhas.length > 0 && (
        <>
          <p className="text-xs text-texto-suave" aria-live="polite">
            {total > 10_000 ? '10.000+' : total} {total === 1 ? 'execução' : 'execuções'} no total
          </p>
          <ul className="rounded-dm-lg border border-borda bg-superficie">
            {linhas.map((e) => {
              const visual = ICONE_SITUACAO[e.situacao] ?? ICONE_SITUACAO.parou
              const Icone = visual.icone
              const arquivouNesta = e.resultado.some((r) => r.arquivou)
              return (
                <li
                  key={e.id}
                  className="flex flex-col gap-2 border-b border-borda px-4 py-3 last:border-b-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                        visual.classe,
                      )}
                    >
                      <Icone aria-hidden className="size-3.5" />
                      {ROTULO_SITUACAO_EXECUCAO[e.situacao] ?? e.situacao}
                    </span>
                    <span className="text-sm font-medium text-texto">{oQueDisparou(e)}</span>
                    <span className="ml-auto text-xs tabular-nums text-texto-suave">
                      {quando(e.criada_em)}
                    </span>
                  </div>
                  <p className="text-xs text-texto-suave">
                    {ROTULO_GATILHO[e.gatilho] ?? 'Disparou'}
                    {e.setor ? ` · agora em ${e.setor}${e.etapa ? ` · ${e.etapa}` : ''}` : ''}
                    {e.profundidade > 0
                      ? ` · disparada por outra automação (cadeia ${e.profundidade})`
                      : ''}
                  </p>
                  {e.avaliacao && <p className="text-xs text-texto">Condição: {e.avaliacao}</p>}
                  {e.resultado.length > 0 && (
                    <ol className="flex flex-col gap-0.5 text-xs">
                      {e.resultado.map((r) => (
                        <li
                          key={`${e.id}-${r.n}`}
                          className={cn(
                            'flex gap-1.5',
                            r.resultado === 'falhou'
                              ? 'text-danificado-forte'
                              : ['feito', 'bateu', 'sim', 'senao'].includes(r.resultado)
                                ? 'text-texto'
                                : 'text-texto-suave',
                          )}
                        >
                          <span className="tabular-nums text-texto-fraco">{r.n}.</span>
                          <span>
                            {r.frase}{' '}
                            <span className="text-texto-fraco">
                              — {ROTULO_RESULTADO_PASSO[r.resultado] ?? r.resultado}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {e.situacao === 'esperando' && e.executar_em && (
                    <p className="text-xs text-info-texto">Segue em {quando(e.executar_em)}.</p>
                  )}
                  {arquivouNesta && e.card_id && e.card_arquivado && (
                    <Botao
                      variante="secundaria"
                      icone={<ArchiveRestore />}
                      className="self-start"
                      carregando={voltar.isPending && voltar.variables === e.card_id}
                      onClick={() => voltar.mutate(e.card_id!)}
                    >
                      Trazer de volta
                    </Botao>
                  )}
                </li>
              )
            })}
          </ul>
          <MaisAoRolar
            temMais={consulta.hasNextPage}
            carregando={consulta.isFetchingNextPage}
            aoChegar={() => {
              if (!consulta.isFetchingNextPage) void consulta.fetchNextPage()
            }}
          />
        </>
      )}
    </section>
  )
}
