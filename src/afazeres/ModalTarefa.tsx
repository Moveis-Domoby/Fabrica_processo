import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  Eye,
  EyeOff,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Square,
  Timer,
} from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import {
  concluirTarefa,
  criarSubtarefa,
  definirPrivacidade,
  editarTarefa,
  ehTarefaPessoal,
  iniciarTarefa,
  pararTempo,
  reabrirTarefa,
  subtarefasDe,
} from './api'
import type { Tarefa } from './api'

/**
 * O checklist da tarefa (SESSAO-23): subtarefas em até dois níveis, dentro do
 * PREVIEW — o card na tela fica compacto e tudo se faz por aqui (pedido do
 * dono, 23/09). O 2º nível abre pelo "detalhar" (E-40: sem ele, a primeira
 * sub-subtarefa nunca poderia nascer).
 */
function Checklist({
  maeId,
  nivel,
  subtarefasPorMae,
  aoConcluir,
  aoReabrir,
  aoCriar,
  ocupado,
}: {
  maeId: number
  nivel: 1 | 2
  subtarefasPorMae: Map<number, Tarefa[]>
  aoConcluir: (id: number) => void
  aoReabrir: (id: number) => void
  aoCriar: (maeId: number, titulo: string) => void
  ocupado: boolean
}) {
  const [novo, setNovo] = useState('')
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set())
  const filhas = subtarefasPorMae.get(maeId) ?? []

  return (
    <div className={cn('flex flex-col gap-1', nivel === 2 && 'ml-6 border-l border-borda pl-3')}>
      {filhas.map((s) => {
        const feita = s.situacao === 'concluida'
        const netas = subtarefasPorMae.get(s.id)?.length ?? 0
        const aberta = netas > 0 || expandidas.has(s.id)
        return (
          <div key={s.id} className="flex flex-col">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={feita ? `Reabrir "${s.titulo}"` : `Concluir "${s.titulo}"`}
                disabled={ocupado}
                onClick={() => (feita ? aoReabrir(s.id) : aoConcluir(s.id))}
                className="toque-seguro inline-flex h-toque-md items-center gap-2 rounded-dm px-1 text-left text-sm hover:bg-superficie-sutil"
              >
                {feita ? (
                  <CheckCircle2 aria-hidden className="size-4 shrink-0 text-perfeito-forte" />
                ) : (
                  <Circle aria-hidden className="size-4 shrink-0 text-texto-fraco" />
                )}
                <span className={cn('text-texto', feita && 'text-texto-fraco line-through')}>
                  {s.titulo}
                </span>
              </button>
              {nivel === 1 && !aberta && (
                <button
                  type="button"
                  aria-label={`Criar subtarefa dentro de "${s.titulo}"`}
                  onClick={() => setExpandidas((atual) => new Set(atual).add(s.id))}
                  className="toque-seguro inline-flex h-toque-md items-center gap-0.5 rounded-dm px-1 text-xs text-texto-fraco hover:bg-superficie-sutil hover:text-texto-suave"
                >
                  <ChevronRight aria-hidden className="size-3.5" />
                  detalhar
                </button>
              )}
            </div>
            {nivel === 1 && aberta && (
              <Checklist
                maeId={s.id}
                nivel={2}
                subtarefasPorMae={subtarefasPorMae}
                aoConcluir={aoConcluir}
                aoReabrir={aoReabrir}
                aoCriar={aoCriar}
                ocupado={ocupado}
              />
            )}
          </div>
        )
      })}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!novo.trim()) return
          aoCriar(maeId, novo)
          setNovo('')
        }}
      >
        <Campo
          rotulo={nivel === 1 ? 'Nova subtarefa' : 'Nova subtarefa deste item'}
          rotuloOculto
          placeholder={nivel === 1 ? 'nova subtarefa…' : 'subtarefa deste item…'}
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
        />
        <Botao
          type="submit"
          variante="fantasma"
          tamanho="sm"
          icone={<Plus />}
          disabled={!novo.trim() || ocupado}
        >
          Incluir
        </Botao>
      </form>
    </div>
  )
}

/**
 * O PREVIEW da tarefa (SESSAO-23, revisão do dono em 23/09): clicar numa
 * demanda — no Meu Painel ou nos Afazeres — abre este modal, e tudo acontece
 * aqui: iniciar/parar o tempo, editar, concluir/reabrir, subtarefas e a
 * privacidade. Tarefa do Sistema só aponta o quadro: ela se resolve no parecer.
 */
export function ModalTarefa({
  tarefa,
  aoFechar,
  linkQuadro,
}: {
  tarefa: Tarefa | null
  aoFechar: () => void
  /** Para a tarefa do Sistema: a rota do quadro do setor recebedor. */
  linkQuadro?: string | null
}) {
  const { perfil } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora()

  const [editando, setEditando] = useState(false)
  const [tituloEdicao, setTituloEdicao] = useState('')
  const [descricaoEdicao, setDescricaoEdicao] = useState('')

  const { data: filhas = [] } = useQuery({
    queryKey: ['tarefa-modal', 'filhas', tarefa?.id],
    queryFn: () => subtarefasDe([tarefa!.id]),
    enabled: tarefa !== null,
  })
  const idsFilhas = useMemo(() => filhas.map((f) => f.id), [filhas])
  const { data: netas = [] } = useQuery({
    queryKey: ['tarefa-modal', 'netas', idsFilhas.join(',')],
    queryFn: () => subtarefasDe(idsFilhas),
    enabled: idsFilhas.length > 0,
  })
  const subtarefasPorMae = useMemo(() => {
    const mapa = new Map<number, Tarefa[]>()
    for (const s of [...filhas, ...netas]) {
      if (s.tarefa_mae_id === null) continue
      const lista = mapa.get(s.tarefa_mae_id) ?? []
      lista.push(s)
      mapa.set(s.tarefa_mae_id, lista)
    }
    return mapa
  }, [filhas, netas])

  async function invalidar() {
    await Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['afazeres'] }),
      clienteQuery.invalidateQueries({ queryKey: ['meu-painel'] }),
      clienteQuery.invalidateQueries({ queryKey: ['tarefa-modal'] }),
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

  const iniciarMutacao = useMutation({
    mutationFn: iniciarTarefa,
    onSuccess: invalidar,
    onError: aoErro('Não deu para iniciar o tempo'),
  })
  const pararMutacao = useMutation({
    mutationFn: pararTempo,
    onSuccess: async () => {
      notificar({ titulo: 'Tempo parado', descricao: 'A contagem foi descartada.', tom: 'atencao' })
      await invalidar()
    },
    onError: aoErro('Não deu para parar o tempo'),
  })
  const concluirMutacao = useMutation({
    mutationFn: concluirTarefa,
    onSuccess: async () => {
      notificar({ titulo: 'Tarefa concluída', tom: 'perfeito' })
      await invalidar()
      aoFechar()
    },
    onError: aoErro('Não deu para concluir'),
  })
  const reabrirMutacao = useMutation({
    mutationFn: reabrirTarefa,
    onSuccess: invalidar,
    onError: aoErro('Não deu para reabrir'),
  })
  const editarMutacao = useMutation({
    mutationFn: () =>
      editarTarefa({ id: tarefa!.id, titulo: tituloEdicao, descricao: descricaoEdicao }),
    onSuccess: async () => {
      notificar({ titulo: 'Tarefa salva', tom: 'perfeito' })
      setEditando(false)
      await invalidar()
    },
    onError: aoErro('Não deu para salvar'),
  })
  const privacidadeMutacao = useMutation({
    mutationFn: (privada: boolean) => definirPrivacidade(tarefa!.id, privada),
    onSuccess: invalidar,
    onError: aoErro('Não deu para mudar a visibilidade'),
  })
  const concluirSubMutacao = useMutation({
    mutationFn: concluirTarefa,
    onSuccess: invalidar,
    onError: aoErro('Não deu para concluir a subtarefa'),
  })
  const reabrirSubMutacao = useMutation({
    mutationFn: reabrirTarefa,
    onSuccess: invalidar,
    onError: aoErro('Não deu para reabrir a subtarefa'),
  })
  const criarSubMutacao = useMutation({
    mutationFn: (p: { maeId: number; titulo: string }) =>
      criarSubtarefa({ ...p, criadaPor: perfil!.id }),
    onSuccess: invalidar,
    onError: aoErro('Não deu para criar a subtarefa'),
  })

  if (!tarefa || !perfil) return null

  const sistema = tarefa.origem === 'sistema'
  const minhaPessoal = ehTarefaPessoal(tarefa) && tarefa.responsavel_id === perfil.id
  const concluida = tarefa.situacao === 'concluida'
  const feitas = filhas.filter((s) => s.situacao === 'concluida').length
  const checklistOcupado =
    concluirSubMutacao.isPending || reabrirSubMutacao.isPending || criarSubMutacao.isPending

  return (
    <Modal
      aberto
      aoFechar={(aberto) => {
        if (!aberto) aoFechar()
      }}
      titulo={sistema ? 'Tarefa do Sistema' : tarefa.titulo}
      descricao={sistema ? tarefa.titulo : undefined}
      rodape={
        sistema ? undefined : editando ? (
          <>
            <Botao variante="secundaria" onClick={() => setEditando(false)}>
              Cancelar
            </Botao>
            <Botao
              icone={<CheckCircle2 />}
              disabled={!tituloEdicao.trim()}
              carregando={editarMutacao.isPending}
              onClick={() => editarMutacao.mutate()}
            >
              Salvar
            </Botao>
          </>
        ) : (
          <>
            <Botao
              variante="secundaria"
              icone={<Pencil />}
              onClick={() => {
                setTituloEdicao(tarefa.titulo)
                setDescricaoEdicao(tarefa.descricao ?? '')
                setEditando(true)
              }}
            >
              Editar
            </Botao>
            {concluida ? (
              <Botao
                variante="secundaria"
                icone={<RotateCcw />}
                carregando={reabrirMutacao.isPending}
                onClick={() => reabrirMutacao.mutate(tarefa.id)}
              >
                Reabrir
              </Botao>
            ) : (
              <Botao
                icone={<CheckCircle2 />}
                carregando={concluirMutacao.isPending}
                onClick={() => concluirMutacao.mutate(tarefa.id)}
              >
                Concluir
              </Botao>
            )}
          </>
        )
      }
    >
      {sistema ? (
        <div className="flex flex-col gap-3">
          {tarefa.descricao && <p className="text-sm text-texto-suave">{tarefa.descricao}</p>}
          <p className="text-sm text-texto">
            Esta tarefa se resolve no quadro: registre o parecer de recebimento da peça — ao
            registrar, ela conclui sozinha.
          </p>
          {linkQuadro && (
            <Link to={linkQuadro} onClick={aoFechar}>
              <Botao variante="secundaria" icone={<ClipboardList />}>
                Abrir o quadro do setor
              </Botao>
            </Link>
          )}
        </div>
      ) : editando ? (
        <div className="flex flex-col gap-3">
          <Campo
            rotulo="Título"
            value={tituloEdicao}
            onChange={(e) => setTituloEdicao(e.target.value)}
          />
          <Campo
            rotulo="Descrição (opcional)"
            value={descricaoEdicao}
            onChange={(e) => setDescricaoEdicao(e.target.value)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {minhaPessoal && (
              <button
                type="button"
                onClick={() => privacidadeMutacao.mutate(!tarefa.privada)}
                disabled={privacidadeMutacao.isPending}
                className="toque-seguro inline-flex items-center gap-1 rounded-full bg-superficie-sutil px-2.5 py-1 text-xs font-medium text-texto-suave hover:bg-borda"
                title={
                  tarefa.privada
                    ? 'Só você vê esta tarefa. Toque para torná-la visível à liderança.'
                    : 'Líderes e admins veem esta tarefa. Toque para torná-la privada.'
                }
              >
                {tarefa.privada ? (
                  <>
                    <EyeOff aria-hidden className="size-3.5" /> privada
                  </>
                ) : (
                  <>
                    <Eye aria-hidden className="size-3.5" /> visível
                  </>
                )}
              </button>
            )}
            {concluida && (
              <span className="inline-flex items-center gap-1 rounded-full bg-perfeito-fundo px-2.5 py-1 text-xs font-medium text-perfeito-texto">
                <CheckCircle2 aria-hidden className="size-3.5" /> concluída
              </span>
            )}
          </div>

          {tarefa.descricao && <p className="text-sm text-texto-suave">{tarefa.descricao}</p>}

          {/* ---- tempo (o timer é opcional — só conta se você quiser) ---- */}
          <div className="flex flex-wrap items-center gap-2 rounded-dm border border-borda bg-superficie-sutil px-3 py-2">
            {tarefa.iniciada_em ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-sm text-texto tabular-nums">
                  <Timer aria-hidden className="size-4 text-texto-suave" />
                  contando há {formatarDuracao(tarefa.iniciada_em, agora)}
                </span>
                {!concluida && (
                  <Botao
                    variante="secundaria"
                    tamanho="sm"
                    icone={<Square />}
                    className="ml-auto"
                    carregando={pararMutacao.isPending}
                    onClick={() => pararMutacao.mutate(tarefa.id)}
                  >
                    Parar (descarta a contagem)
                  </Botao>
                )}
              </>
            ) : (
              <>
                <span className="text-sm text-texto-suave">
                  O tempo só conta se você quiser.
                </span>
                {!concluida && (
                  <Botao
                    variante="secundaria"
                    tamanho="sm"
                    icone={<Play />}
                    className="ml-auto"
                    carregando={iniciarMutacao.isPending}
                    onClick={() => iniciarMutacao.mutate(tarefa.id)}
                  >
                    Iniciar tempo
                  </Botao>
                )}
              </>
            )}
          </div>

          {/* ---- subtarefas ---- */}
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-medium text-texto">
              Subtarefas
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                  filhas.length > 0 && feitas === filhas.length
                    ? 'bg-perfeito-fundo text-perfeito-texto'
                    : 'bg-superficie-sutil text-texto-suave',
                )}
              >
                {feitas}/{filhas.length}
              </span>
            </p>
            <Checklist
              maeId={tarefa.id}
              nivel={1}
              subtarefasPorMae={subtarefasPorMae}
              aoConcluir={(id) => concluirSubMutacao.mutate(id)}
              aoReabrir={(id) => reabrirSubMutacao.mutate(id)}
              aoCriar={(maeId, titulo) => criarSubMutacao.mutate({ maeId, titulo })}
              ocupado={checklistOcupado}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
