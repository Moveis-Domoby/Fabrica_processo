import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay, KeyboardSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CornerUpLeft, Lightbulb, Loader2, Paperclip } from 'lucide-react'
import { Botao, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useAoVivo } from '@/lib/aoVivo'
import { SensorDoMouse } from '@/kanban/componentes/arrastarQuadro'
import { useAlturaAteOFim } from '@/kanban/componentes/alturaDoQuadro'
import { buscarMaisDaColuna, buscarQuadro, moverSugestao } from '@/tech/api'
import type { CartaoSugestao, ColunaDoQuadro, QuadroSugestoes } from '@/tech/api'
import { useAbrirSugestao } from '@/tech/abrirSugestao'
import { ModalSugerir } from '@/tech/ModalSugerir'
import { IconeArquivo } from '@/tech/IconeArquivo'
import { IconeTipo, SeloNivel, SeloTeste } from '@/tech/Selos'
import { COLUNAS, NOME_TIPO_ARQUIVO, ROTULO_TIPO, TITULO_COLUNA } from '@/tech/regras'
import type { ColunaSugestao } from '@/tech/regras'

const CHAVE_QUADRO = ['tech', 'quadro'] as const

function diaCurto(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** O cartão da sugestão no quadro: número, tipo, nível, o começo do texto e quem pediu. */
function Cartao({ s, arrastando = false }: { s: CartaoSugestao; arrastando?: boolean }) {
  return (
    // `relative`: o texto só para leitor de tela (sr-only é absoluto) fica preso ao
    // cartão — sem isso ele escapa da coluna que rola e estica a página para o lado.
    <div
      className={cn(
        'relative flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-3 text-left',
        arrastando && 'shadow-lg',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-texto tabular-nums">#{s.id}</span>
        <span className="inline-flex min-w-0 items-center gap-1 text-xs text-texto-suave [&>svg]:size-3.5 [&>svg]:shrink-0">
          <IconeTipo tipo={s.tipo} />
          <span className="truncate">{ROTULO_TIPO[s.tipo]}</span>
        </span>
        <span className="ml-auto shrink-0">
          <SeloNivel nivel={s.nivel} curto />
        </span>
      </div>
      <p className="line-clamp-3 text-sm text-texto">{s.resumo}</p>
      {s.teste && (
        <span>
          <SeloTeste teste={s.teste} />
        </span>
      )}
      {s.motivo_recusa && (
        <p className="line-clamp-2 text-xs text-danificado-texto">Motivo: {s.motivo_recusa}</p>
      )}
      {s.origem_id && (
        <p className="inline-flex items-center gap-1 text-xs text-texto-suave">
          <CornerUpLeft aria-hidden className="size-3.5" /> devolução da #{s.origem_id}
        </p>
      )}
      <div className="flex items-center gap-2 text-xs text-texto-suave">
        <span className="min-w-0 truncate">
          {s.minha ? 'Você' : (s.autor_nome ?? '—')} · {diaCurto(s.criada_em)}
        </span>
        <span
          className="ml-auto inline-flex shrink-0 items-center gap-1 tabular-nums"
          aria-label={`${s.arquivos} arquivo(s): ${s.tipos_arquivo.map((t) => NOME_TIPO_ARQUIVO[t]).join(', ')}`}
        >
          {s.tipos_arquivo.map((t) => (
            <IconeArquivo key={t} tipo={t} className="size-3.5" />
          ))}
          {s.tipos_arquivo.length === 0 && <Paperclip aria-hidden className="size-3.5" />}
          {s.arquivos}
        </span>
      </div>
    </div>
  )
}

function CartaoNoQuadro({ s, movivel, aoAbrir }: { s: CartaoSugestao; movivel: boolean; aoAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: s.id, disabled: !movivel })
  return (
    <div
      ref={setNodeRef}
      {...(movivel ? attributes : {})}
      {...(movivel ? listeners : {})}
      role="button"
      tabIndex={0}
      aria-label={`Sugestão #${s.id}, ${ROTULO_TIPO[s.tipo]}, nível ${s.nivel}: ${s.resumo}`}
      aria-roledescription={movivel ? 'card arrastável' : undefined}
      aria-description={movivel ? 'Enter abre a sugestão; Espaço pega para arrastar.' : undefined}
      onClick={aoAbrir}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          aoAbrir()
          return
        }
        if (movivel) listeners?.onKeyDown?.(e)
      }}
      className={cn(
        'touch-manipulation rounded-dm-lg transition-colors hover:ring-2 hover:ring-borda-forte',
        movivel && (isDragging ? 'cursor-grabbing opacity-40' : 'cursor-grab'),
        !movivel && 'cursor-pointer',
      )}
    >
      <Cartao s={s} />
    </div>
  )
}

function Coluna({
  coluna,
  itens,
  total,
  temMais,
  carregandoMais,
  movivel,
  aoVerMais,
  aoAbrir,
}: {
  coluna: (typeof COLUNAS)[number]
  itens: CartaoSugestao[]
  total: number
  temMais: boolean
  carregandoMais: boolean
  movivel: boolean
  aoVerMais: () => void
  aoAbrir: (id: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.chave, disabled: !movivel })
  return (
    <section
      ref={setNodeRef}
      aria-label={`${coluna.titulo}: ${total} sugestão(ões)`}
      className="flex min-h-0 w-[85vw] max-w-xs shrink-0 snap-start flex-col self-stretch px-1.5 sm:w-72"
    >
      <div
        className={cn(
          'flex max-h-full min-h-0 flex-col rounded-dm-lg border bg-superficie-sutil/40 transition-colors',
          isOver ? 'border-acao-ativa bg-acao/5 ring-2 ring-acao' : 'border-borda/40',
        )}
      >
        <header className={cn('flex shrink-0 flex-col gap-0.5 px-3 py-2.5', itens.length > 0 && 'border-b border-borda/40')}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-texto">{coluna.titulo}</h2>
            <span className="rounded-full bg-superficie px-2 py-0.5 text-xs font-medium text-texto-suave tabular-nums">
              {total}
            </span>
          </div>
          <p className="text-xs text-texto-suave">{coluna.descricao}</p>
        </header>
        {itens.length > 0 && (
          <div
            className="flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain p-2"
            aria-label={`Sugestões em ${coluna.titulo}`}
          >
            {itens.map((s) => (
              <CartaoNoQuadro key={s.id} s={s} movivel={movivel} aoAbrir={() => aoAbrir(s.id)} />
            ))}
            {temMais && (
              <Botao
                variante="fantasma"
                tamanho="sm"
                carregando={carregandoMais}
                onClick={aoVerMais}
                className="min-h-toque-md"
              >
                Ver mais ({total - itens.length})
              </Botao>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * SESSAO-46 (D-260…D-266) — Tech → Sugestão de melhoria: o quadro que TODA a
 * equipe acompanha. Abrir = 1 requisição (a 1ª página e o total de cada
 * coluna); "Ver mais" busca só a próxima página daquela coluna (cursor); ao
 * vivo pelo aviso `plt-aviso:sugestoes`. Só o super admin arrasta (o banco
 * confere de novo); soltar em Recusada pede o motivo. O cartão abre a ficha
 * (`?sugestao=`) — para todo mundo.
 */
export function SugestaoMelhoria() {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const abrirSugestao = useAbrirSugestao()
  const [sugerindo, setSugerindo] = useState(false)
  // As páginas a mais de cada coluna ("Ver mais") — somem quando o quadro relê.
  const [mais, setMais] = useState<{ base: number; colunas: Partial<Record<ColunaSugestao, ColunaDoQuadro>> }>({
    base: 0,
    colunas: {},
  })
  const [carregandoMais, setCarregandoMais] = useState<ColunaSugestao | null>(null)
  const [arrastado, setArrastado] = useState<CartaoSugestao | null>(null)
  const [recusa, setRecusa] = useState<{ s: CartaoSugestao; motivo: string } | null>(null)

  const quadro = useQuery({ queryKey: CHAVE_QUADRO, queryFn: buscarQuadro, staleTime: Infinity })
  useAoVivo('sugestoes', [['tech']])
  const movivel = quadro.data?.eu_movo ?? false
  const colunas = useMemo(() => {
    const extras = mais.base === quadro.dataUpdatedAt ? mais.colunas : {}
    const porChave = new Map((quadro.data?.colunas ?? []).map((c) => [c.coluna, c]))
    return COLUNAS.map((c) => {
      const base = porChave.get(c.chave)
      const extra = extras[c.chave]
      const itens = [...(base?.itens ?? []), ...(extra?.itens ?? [])]
      const proximo = extra ? extra.proximo : (base?.proximo ?? null)
      return { coluna: c, itens, total: base?.total ?? itens.length, proximo }
    })
  }, [quadro.data, quadro.dataUpdatedAt, mais])

  async function verMais(chave: ColunaSugestao) {
    const col = colunas.find((c) => c.coluna.chave === chave)
    if (!col?.proximo) return
    setCarregandoMais(chave)
    try {
      const pagina = await buscarMaisDaColuna(chave, col.proximo)
      setMais((atual) => {
        const mesmaBase = atual.base === quadro.dataUpdatedAt
        const anterior = mesmaBase ? atual.colunas[chave] : undefined
        return {
          base: quadro.dataUpdatedAt,
          colunas: {
            ...(mesmaBase ? atual.colunas : {}),
            [chave]: { ...pagina, itens: [...(anterior?.itens ?? []), ...pagina.itens] },
          },
        }
      })
    } catch (excecao) {
      notificar({
        titulo: 'Não deu para ver mais',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
    } finally {
      setCarregandoMais(null)
    }
  }

  const mover = useMutation({
    mutationFn: ({ s, para, motivo }: { s: CartaoSugestao; para: ColunaSugestao; motivo?: string }) =>
      moverSugestao(s.id, para, motivo),
    // Escrita otimista (Lei §8): o cartão muda de coluna na hora; o banco confirma ao reler.
    onMutate: async ({ s, para }) => {
      await clienteQuery.cancelQueries({ queryKey: CHAVE_QUADRO })
      const antes = clienteQuery.getQueryData<QuadroSugestoes>(CHAVE_QUADRO)
      if (antes) {
        clienteQuery.setQueryData<QuadroSugestoes>(CHAVE_QUADRO, {
          ...antes,
          colunas: antes.colunas.map((c) => {
            const sem = c.itens.filter((i) => i.id !== s.id)
            const saiu = sem.length !== c.itens.length
            if (c.coluna === para) {
              return { ...c, itens: [{ ...s, teste: para === 'finalizada' ? 'aguardando' : null }, ...sem], total: (c.total ?? 0) + 1 }
            }
            return saiu ? { ...c, itens: sem, total: Math.max(0, (c.total ?? 1) - 1) } : c
          }),
        })
      }
      return { antes }
    },
    onError: (excecao, _v, contexto) => {
      if (contexto?.antes) clienteQuery.setQueryData(CHAVE_QUADRO, contexto.antes)
      notificar({
        titulo: 'Não deu para mover',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      })
    },
    onSuccess: (_r, v) => {
      notificar({ titulo: `Sugestão #${v.s.id} em ${TITULO_COLUNA[v.para]}`, tom: 'perfeito' })
      setRecusa(null)
    },
    onSettled: () => clienteQuery.invalidateQueries({ queryKey: ['tech'] }),
  })

  const sensores = useSensors(
    useSensor(SensorDoMouse, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] } }),
  )

  function aoComecar(e: DragStartEvent) {
    setArrastado(colunas.flatMap((c) => c.itens).find((s) => s.id === e.active.id) ?? null)
  }
  function aoSoltar(e: DragEndEvent) {
    setArrastado(null)
    if (!e.over) return
    const para = e.over.id as ColunaSugestao
    const origem = colunas.find((c) => c.itens.some((s) => s.id === e.active.id))
    const s = origem?.itens.find((i) => i.id === e.active.id)
    if (!s || !origem || origem.coluna.chave === para) return
    if (para === 'recusada') setRecusa({ s, motivo: '' })
    else mover.mutate({ s, para })
  }

  const quadroRef = useRef<HTMLDivElement>(null)
  const altura = useAlturaAteOFim(quadroRef, 52, quadro.isSuccess)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl">Sugestão de melhoria</h1>
          <p className="text-texto-suave">
            Tudo o que a equipe pediu para o sistema e onde cada pedido está.{' '}
            {movivel ? 'Arraste o cartão para mudar de coluna.' : 'Toque no cartão para ver tudo.'}
          </p>
        </div>
        <Botao variante="primaria" icone={<Lightbulb aria-hidden />} onClick={() => setSugerindo(true)}>
          Sugerir melhoria
        </Botao>
      </div>

      {quadro.isPending && (
        <p className="flex items-center gap-2 text-sm text-texto-fraco" role="status">
          <Loader2 aria-hidden className="size-4 animate-spin" /> Abrindo o quadro…
        </p>
      )}
      {quadro.isError && (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-dm bg-danificado-fundo p-3 text-sm text-danificado-texto">
          {quadro.error instanceof Error ? quadro.error.message : 'Não deu para abrir o quadro.'}
          <Botao variante="secundaria" tamanho="sm" onClick={() => void quadro.refetch()}>
            Tentar de novo
          </Botao>
        </div>
      )}

      {quadro.isSuccess && (
        <DndContext sensors={sensores} onDragStart={aoComecar} onDragEnd={aoSoltar} onDragCancel={() => setArrastado(null)}>
          <div
            ref={quadroRef}
            style={altura ? { height: altura } : undefined}
            className="-mx-1.5 flex snap-x divide-x divide-borda/40 overflow-x-auto overflow-y-hidden pb-3"
          >
            {colunas.map((c) => (
              <Coluna
                key={c.coluna.chave}
                coluna={c.coluna}
                itens={c.itens}
                total={c.total}
                temMais={c.proximo !== null}
                carregandoMais={carregandoMais === c.coluna.chave}
                movivel={movivel}
                aoVerMais={() => void verMais(c.coluna.chave)}
                aoAbrir={abrirSugestao}
              />
            ))}
          </div>
          {arrastado &&
            createPortal(
              <DragOverlay dropAnimation={null} zIndex={60}>
                <div className="w-72 cursor-grabbing">
                  <Cartao s={arrastado} arrastando />
                </div>
              </DragOverlay>,
              document.body,
            )}
        </DndContext>
      )}

      <ModalSugerir aberto={sugerindo} aoFechar={() => setSugerindo(false)} />

      <Modal
        aberto={recusa !== null}
        aoFechar={(v) => {
          if (!v && !mover.isPending) setRecusa(null)
        }}
        titulo={recusa ? `Recusar a sugestão #${recusa.s.id}` : 'Recusar'}
        descricao="O motivo vai no aviso para quem sugeriu."
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => setRecusa(null)} disabled={mover.isPending}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              disabled={(recusa?.motivo.trim().length ?? 0) < 5}
              carregando={mover.isPending}
              onClick={() => recusa && mover.mutate({ s: recusa.s, para: 'recusada', motivo: recusa.motivo.trim() })}
            >
              Recusar a sugestão
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <p className="line-clamp-3 text-sm text-texto-suave">{recusa?.s.resumo}</p>
          <label htmlFor="motivo-recusa-quadro" className="text-sm font-semibold text-texto">
            Motivo da recusa
          </label>
          <textarea
            id="motivo-recusa-quadro"
            value={recusa?.motivo ?? ''}
            onChange={(e) => setRecusa((r) => (r ? { ...r, motivo: e.target.value } : r))}
            rows={3}
            maxLength={500}
            className="w-full rounded-dm border border-borda-forte bg-superficie px-3 py-2 text-base text-texto"
          />
          <p className="text-xs text-texto-suave">Pelo menos 5 letras.</p>
        </div>
      </Modal>
    </div>
  )
}
