import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ClipboardList, Eye, EyeOff, ListChecks, Plus, Timer } from 'lucide-react'
import { Botao, Campo, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarSetores } from '@/kanban/api'
import { rotaDoSetor } from '@/navegacao/rotas'
import { formatarDuracao, formatarDuracaoMs, useAgora } from '@/kanban/tempo'
import { usePedidosDosCards } from '@/kanban/componentes/usePedidosDosCards'
import {
  criarTarefa,
  ehTarefaPessoal,
  meusCards,
  minhasTarefas,
  msTempoTarefa,
  subtarefasDe,
  tarefaRodando,
} from '@/afazeres/api'
import { ModalTarefa } from '@/afazeres/ModalTarefa'

const ATUALIZA_A_CADA = 15_000

/**
 * Meus afazeres (SESSAO-12/D-34 · SESSAO-23): cards COMPACTOS — clicar na
 * demanda abre o preview (ModalTarefa) com tudo: iniciar/parar o tempo,
 * editar, concluir, subtarefas e privacidade (pedido do dono, 23/09 — nada de
 * expansão na tela). A visão da liderança virou a filha "Afazeres do time".
 */
export function Afazeres() {
  const { perfil, vinculos } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora()

  const souAdmin = perfil?.papel === 'admin'

  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })

  const { data: cards = [] } = useQuery({
    queryKey: ['afazeres', 'cards', perfil?.id],
    queryFn: () => meusCards(perfil!.id),
    enabled: perfil !== null,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: tarefas = [] } = useQuery({
    queryKey: ['afazeres', 'tarefas', perfil?.id],
    queryFn: () => minhasTarefas(perfil!.id),
    enabled: perfil !== null,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: pedidosPorId = new Map() } = usePedidosDosCards(cards)

  // Só o contador "2/5" dos cards — o checklist inteiro vive no preview.
  const idsTarefas = useMemo(() => tarefas.map((t) => t.id), [tarefas])
  const { data: filhas = [] } = useQuery({
    queryKey: ['afazeres', 'subtarefas', idsTarefas.join(',')],
    queryFn: () => subtarefasDe(idsTarefas),
    enabled: idsTarefas.length > 0,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const contadorPorMae = useMemo(() => {
    const mapa = new Map<number, { total: number; feitas: number }>()
    for (const s of filhas) {
      if (s.tarefa_mae_id === null) continue
      const atual = mapa.get(s.tarefa_mae_id) ?? { total: 0, feitas: 0 }
      atual.total += 1
      if (s.situacao === 'concluida') atual.feitas += 1
      mapa.set(s.tarefa_mae_id, atual)
    }
    return mapa
  }, [filhas])

  // O preview: a tarefa aberta no modal (a fonte fresca vem da lista).
  const [tarefaAbertaId, setTarefaAbertaId] = useState<number | null>(null)
  const tarefaAberta = tarefas.find((t) => t.id === tarefaAbertaId) ?? null

  // ----- nova tarefa (modal — botão no topo da tela) -----
  // Aqui a tarefa é sempre PARA MIM (pedido do dono, 23/09): delegar mora na
  // tela "Afazeres do time".
  const [modalNova, setModalNova] = useState(false)
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novoSetor, setNovoSetor] = useState('')
  const [novaVisivel, setNovaVisivel] = useState(false)
  const setoresOndeCrio = souAdmin
    ? setores
    : setores.filter((s) => vinculos.some((v) => v.setor_id === s.id))
  const setorNovoId = novoSetor ? Number(novoSetor) : null

  const criarMutacao = useMutation({
    mutationFn: () =>
      criarTarefa({
        titulo: novoTitulo,
        setorId: setorNovoId,
        responsavelId: perfil!.id,
        criadaPor: perfil!.id,
        // D-51: a pessoal nasce privada, a menos que o dono a torne visível já
        // na criação.
        privada: !novaVisivel,
      }),
    onSuccess: async () => {
      notificar({ titulo: 'Tarefa criada', tom: 'perfeito' })
      setModalNova(false)
      setNovoTitulo('')
      setNovoSetor('')
      setNovaVisivel(false)
      await clienteQuery.invalidateQueries({ queryKey: ['afazeres'] })
    },
    onError: (excecao: unknown) =>
      notificar({
        titulo: 'Não deu para criar a tarefa',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  if (!perfil) return null

  const totalMeus = cards.length + tarefas.length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl">Meus afazeres</h1>
          <p className="mt-1 max-w-2xl text-texto-suave">
            O que está sob a sua responsabilidade. Toque numa demanda para ver e agir — tempo,
            subtarefas, edição e conclusão, tudo no mesmo lugar.
          </p>
        </div>
        <Botao icone={<Plus />} onClick={() => setModalNova(true)}>
          Nova tarefa
        </Botao>
      </div>

      {totalMeus === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nada sob sua responsabilidade agora.
        </p>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const setor = setores.find((s) => s.id === card.setor_atual_id)
          const pedido = pedidosPorId.get(card.pedido_id)
          return (
            <li
              key={`card-${card.id}`}
              className="flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-texto tabular-nums">
                  Pedido {pedido?.numero ?? '…'}
                </span>
                <span className="text-sm text-texto-suave tabular-nums">
                  {formatarDuracao(card.desde, agora)}
                </span>
              </div>
              <p className="line-clamp-2 text-sm text-texto">
                {card.item_descricao ?? 'Sem descrição'}
                {card.indice_unidade !== null && ` (${card.indice_unidade}/${card.total_unidades})`}
              </p>
              <div className="mt-auto flex items-center justify-between gap-2">
                <span className="rounded-full bg-superficie-sutil px-2.5 py-0.5 text-xs font-medium text-texto-suave">
                  {setor?.nome ?? '—'}
                </span>
                {setor && (
                  <Link to={rotaDoSetor(setor.codigo)}>
                    <Botao variante="secundaria" tamanho="sm" icone={<ClipboardList />}>
                      Abrir quadro
                    </Botao>
                  </Link>
                )}
              </div>
            </li>
          )
        })}

        {tarefas.map((tarefa) => {
          const minhaPessoal = ehTarefaPessoal(tarefa) && tarefa.responsavel_id === perfil.id
          const contador = contadorPorMae.get(tarefa.id) ?? { total: 0, feitas: 0 }
          return (
            <li key={`tarefa-${tarefa.id}`}>
              <button
                type="button"
                onClick={() => setTarefaAbertaId(tarefa.id)}
                className={cn(
                  'flex h-full w-full flex-col gap-2 rounded-dm-lg border bg-superficie p-4 text-left transition-colors hover:border-borda-forte',
                  tarefa.situacao === 'em_andamento' ? 'border-acao-ativa' : 'border-borda',
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-medium text-texto">{tarefa.titulo}</span>
                  {minhaPessoal && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-superficie-sutil px-2.5 py-1 text-xs font-medium text-texto-suave">
                      {tarefa.privada ? (
                        <>
                          <EyeOff aria-hidden className="size-3.5" /> privada
                        </>
                      ) : (
                        <>
                          <Eye aria-hidden className="size-3.5" /> visível
                        </>
                      )}
                    </span>
                  )}
                </span>
                {tarefa.descricao && (
                  <span className="line-clamp-2 text-sm text-texto-suave">{tarefa.descricao}</span>
                )}
                <span className="mt-auto flex flex-wrap items-center gap-2 text-xs text-texto-fraco">
                  {contador.total > 0 && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums',
                        contador.feitas === contador.total
                          ? 'bg-perfeito-fundo text-perfeito-texto'
                          : 'bg-superficie-sutil text-texto-suave',
                      )}
                    >
                      <ListChecks aria-hidden className="size-3.5" />
                      {contador.feitas}/{contador.total}
                    </span>
                  )}
                  {tarefaRodando(tarefa) ? (
                    <span className="inline-flex items-center gap-1 text-texto-suave tabular-nums">
                      <Timer aria-hidden className="size-3.5" />
                      contando — {formatarDuracaoMs(msTempoTarefa(tarefa, agora))}
                    </span>
                  ) : msTempoTarefa(tarefa, agora) > 0 ? (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Timer aria-hidden className="size-3.5" />
                      pausada — {formatarDuracaoMs(msTempoTarefa(tarefa, agora))} guardado
                    </span>
                  ) : (
                    <span>toque para ver e agir</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* ---------------- preview da tarefa ---------------- */}
      <ModalTarefa tarefa={tarefaAberta} aoFechar={() => setTarefaAbertaId(null)} />

      {/* ---------------- nova tarefa ---------------- */}
      <Modal
        aberto={modalNova}
        aoFechar={(aberto) => {
          if (!aberto) setModalNova(false)
        }}
        titulo="Nova tarefa"
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => setModalNova(false)}>
              Cancelar
            </Botao>
            <Botao
              icone={<CheckCircle2 />}
              disabled={!novoTitulo.trim()}
              carregando={criarMutacao.isPending}
              onClick={() => criarMutacao.mutate()}
            >
              Criar tarefa
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Campo
            rotulo="O que precisa ser feito"
            placeholder="ex.: engraxar as caixas de cola"
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
          />
          <Selecao
            rotulo="Setor"
            opcoes={[
              { valor: 'nenhum', rotulo: 'Sem setor (recado solto)' },
              ...setoresOndeCrio.map((s) => ({ valor: String(s.id), rotulo: s.nome })),
            ]}
            valor={novoSetor || 'nenhum'}
            aoMudar={(v) => setNovoSetor(v === 'nenhum' ? '' : v)}
          />
          {/* D-51: tarefa minha nasce privada; este é o gesto de já criá-la
              visível para líderes e admins. */}
          <label className="flex min-h-toque-md w-fit cursor-pointer items-center gap-2 text-sm text-texto">
            <input
              type="checkbox"
              checked={novaVisivel}
              onChange={(e) => setNovaVisivel(e.target.checked)}
              className="size-4 accent-marca-500"
            />
            Visível para a liderança
            <span className="text-xs text-texto-fraco">(desmarcado, só você vê esta tarefa)</span>
          </label>
        </div>
      </Modal>
    </div>
  )
}
