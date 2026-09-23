import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  Eye,
  EyeOff,
  ListTodo,
  Play,
  Plus,
  Timer,
} from 'lucide-react'
import { Botao, Campo, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarSetores, delegarCard } from '@/kanban/api'
import { rotaDoSetor } from '@/navegacao/rotas'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { usePedidosDosCards } from '@/kanban/componentes/usePedidosDosCards'
import { membrosDoSetor } from '@/tablet/api'
import {
  afazeresDoSetor,
  concluirTarefa,
  criarSubtarefa,
  criarTarefa,
  definirPrivacidade,
  ehTarefaPessoal,
  iniciarTarefa,
  meusCards,
  minhasTarefas,
  reabrirTarefa,
  subtarefasDe,
} from '@/afazeres/api'
import type { Tarefa } from '@/afazeres/api'

const ATUALIZA_A_CADA = 15_000
const SEM_DONO = 'sem-dono'

/**
 * O checklist de uma tarefa (SESSAO-23): subtarefas na MESMA tabela, até dois
 * níveis (tarefa → subtarefa → subtarefa da subtarefa — regra do banco).
 * Concluir/reabrir é um toque; o contador da mãe conta as filhas diretas.
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
  // Sem isto, o campo do 2º nível só existiria DEPOIS de já haver uma filha —
  // e a primeira nunca poderia nascer (pego na validação ao vivo da S23).
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
                  onClick={() =>
                    setExpandidas((atual) => new Set(atual).add(s.id))
                  }
                  className="toque-seguro inline-flex h-toque-md items-center gap-0.5 rounded-dm px-1 text-xs text-texto-fraco hover:bg-superficie-sutil hover:text-texto-suave"
                >
                  <ChevronRight aria-hidden className="size-3.5" />
                  detalhar
                </button>
              )}
            </div>
            {/* o segundo (e último) nível do checklist */}
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
          className="flex-1"
        />
        <Botao type="submit" variante="fantasma" tamanho="sm" icone={<Plus />} disabled={!novo.trim() || ocupado}>
          Incluir
        </Botao>
      </form>
    </div>
  )
}

/**
 * Afazeres (SESSAO-12/D-34 · SESSAO-23): "meus afazeres" para todo mundo
 * (cards delegados + tarefas), agora com subtarefas em checklist e a tarefa
 * pessoal privada — visível só para o dono até ele torná-la pública. O RLS
 * garante a privacidade; a tela só reflete.
 */
export function Afazeres() {
  const { perfil, vinculos, ehLider } = useSessao()
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

  // As subtarefas das minhas tarefas — e as delas (dois níveis, de uma vez).
  const idsTarefas = useMemo(() => tarefas.map((t) => t.id), [tarefas])
  const { data: filhas = [] } = useQuery({
    queryKey: ['afazeres', 'subtarefas', idsTarefas.join(',')],
    queryFn: () => subtarefasDe(idsTarefas),
    enabled: idsTarefas.length > 0,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const idsFilhas = useMemo(() => filhas.map((f) => f.id), [filhas])
  const { data: netas = [] } = useQuery({
    queryKey: ['afazeres', 'subtarefas-2', idsFilhas.join(',')],
    queryFn: () => subtarefasDe(idsFilhas),
    enabled: idsFilhas.length > 0,
    refetchInterval: ATUALIZA_A_CADA,
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

  const [abertas, setAbertas] = useState<Set<number>>(new Set())
  function alternarChecklist(id: number) {
    setAbertas((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
      return proximo
    })
  }

  async function invalidar() {
    await clienteQuery.invalidateQueries({ queryKey: ['afazeres'] })
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
  const concluirMutacao = useMutation({
    mutationFn: concluirTarefa,
    onSuccess: async () => {
      notificar({ titulo: 'Tarefa concluída', tom: 'perfeito' })
      await invalidar()
    },
    onError: aoErro('Não deu para concluir'),
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
  const privacidadeMutacao = useMutation({
    mutationFn: (p: { id: number; privada: boolean }) => definirPrivacidade(p.id, p.privada),
    onSuccess: async (_dados, p) => {
      notificar({
        titulo: p.privada ? 'Tarefa agora é privada' : 'Tarefa visível para a liderança',
        tom: 'perfeito',
      })
      await invalidar()
    },
    onError: aoErro('Não deu para mudar a visibilidade'),
  })

  // ----- criar tarefa avulsa -----
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novoSetor, setNovoSetor] = useState('')
  const [novoResponsavel, setNovoResponsavel] = useState('')
  const [novaVisivel, setNovaVisivel] = useState(false)
  const setoresOndeCrio = souAdmin
    ? setores
    : setores.filter((s) => vinculos.some((v) => v.setor_id === s.id))
  const setorNovoId = novoSetor ? Number(novoSetor) : null
  const { data: membrosDoNovoSetor = [] } = useQuery({
    queryKey: ['membros-setor', setorNovoId],
    queryFn: () => membrosDoSetor(setorNovoId!),
    enabled: setorNovoId !== null,
    staleTime: 5 * 60_000,
  })
  const possoDelegarNoNovoSetor =
    souAdmin || vinculos.some((v) => v.setor_id === setorNovoId && v.lider_do_setor)
  const novaEhParaMim = !(possoDelegarNoNovoSetor && novoResponsavel)

  const criarMutacao = useMutation({
    mutationFn: () =>
      criarTarefa({
        titulo: novoTitulo,
        setorId: setorNovoId,
        // Operador cria para si; líder/admin escolhe (D-34 — delegação direta).
        responsavelId: novaEhParaMim ? perfil!.id : novoResponsavel,
        criadaPor: perfil!.id,
        // Resposta do dono (SESSAO-23): a pessoal nasce privada, a menos que o
        // dono a torne visível já na criação. Delegada é sempre visível.
        privada: novaEhParaMim && !novaVisivel,
      }),
    onSuccess: async () => {
      notificar({ titulo: 'Tarefa criada', tom: 'perfeito' })
      setNovoTitulo('')
      setNovoResponsavel('')
      setNovaVisivel(false)
      await invalidar()
    },
    onError: aoErro('Não deu para criar a tarefa'),
  })

  // ----- afazeres do time (líder/admin) -----
  const setoresQueLidero = souAdmin
    ? setores.filter((s) => s.codigo !== 'pcp')
    : setores.filter((s) => vinculos.some((v) => v.setor_id === s.id && v.lider_do_setor))
  const [setorTime, setSetorTime] = useState('')
  const setorTimeId = setorTime ? Number(setorTime) : (setoresQueLidero[0]?.id ?? null)

  const { data: doTime } = useQuery({
    queryKey: ['afazeres', 'time', setorTimeId],
    queryFn: () => afazeresDoSetor(setorTimeId!),
    enabled: ehLider && setorTimeId !== null,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: pedidosDoTime = new Map() } = usePedidosDosCards(doTime?.cards ?? [])
  const { data: membrosDoTime = [] } = useQuery({
    queryKey: ['membros-setor', setorTimeId],
    queryFn: () => membrosDoSetor(setorTimeId!),
    enabled: ehLider && setorTimeId !== null,
    staleTime: 5 * 60_000,
  })

  const cargaPorPessoa = useMemo(() => {
    const carga = new Map<string, number>()
    for (const m of membrosDoTime) carga.set(m.usuario_id, 0)
    for (const c of doTime?.cards ?? []) {
      if (c.responsavel_id) carga.set(c.responsavel_id, (carga.get(c.responsavel_id) ?? 0) + 1)
    }
    for (const t of doTime?.tarefas ?? []) {
      if (t.responsavel_id) carga.set(t.responsavel_id, (carga.get(t.responsavel_id) ?? 0) + 1)
    }
    return carga
  }, [membrosDoTime, doTime])

  const delegarMutacao = useMutation({
    mutationFn: delegarCard,
    onSuccess: async () => {
      notificar({ titulo: 'Afazer delegado', tom: 'perfeito' })
      await Promise.all([invalidar(), clienteQuery.invalidateQueries({ queryKey: ['cards'] })])
    },
    onError: aoErro('Não deu para delegar'),
  })

  if (!perfil) return null

  const totalMeus = cards.length + tarefas.length
  const checklistOcupado =
    concluirSubMutacao.isPending || reabrirSubMutacao.isPending || criarSubMutacao.isPending

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl sm:text-3xl">Afazeres</h1>
        <p className="mt-1 max-w-2xl text-texto-suave">
          O que está sob a sua responsabilidade — e, para a liderança, a carga do time. Delegar
          organiza o trabalho; qualquer pessoa do setor continua podendo agir no card.
        </p>
      </div>

      {/* ---------------- Meus afazeres ---------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg">
          <ListTodo aria-hidden className="size-5 text-texto-suave" />
          Meus afazeres
          <span className="text-texto-suave tabular-nums">({totalMeus})</span>
        </h2>

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
            const doChecklist = subtarefasPorMae.get(tarefa.id) ?? []
            const feitas = doChecklist.filter((s) => s.situacao === 'concluida').length
            const aberta = abertas.has(tarefa.id)
            return (
              <li
                key={`tarefa-${tarefa.id}`}
                className={cn(
                  'flex flex-col gap-2 rounded-dm-lg border bg-superficie p-4',
                  tarefa.situacao === 'em_andamento' ? 'border-acao-ativa' : 'border-borda',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-texto">{tarefa.titulo}</p>
                  {minhaPessoal && (
                    <button
                      type="button"
                      onClick={() =>
                        privacidadeMutacao.mutate({ id: tarefa.id, privada: !tarefa.privada })
                      }
                      disabled={privacidadeMutacao.isPending}
                      className="toque-seguro inline-flex shrink-0 items-center gap-1 rounded-full bg-superficie-sutil px-2.5 py-1 text-xs font-medium text-texto-suave hover:bg-borda"
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
                </div>
                {tarefa.descricao && (
                  <p className="line-clamp-2 text-sm text-texto-suave">{tarefa.descricao}</p>
                )}
                <p className="text-xs text-texto-fraco tabular-nums">
                  {tarefa.iniciada_em ? (
                    <span className="inline-flex items-center gap-1 text-texto-suave">
                      <Timer aria-hidden className="size-3.5" />
                      contando há {formatarDuracao(tarefa.iniciada_em, agora)}
                    </span>
                  ) : (
                    'tarefa avulsa — o tempo só conta se você quiser'
                  )}
                </p>

                {/* ---- checklist de subtarefas (SESSAO-23) ---- */}
                <button
                  type="button"
                  onClick={() => alternarChecklist(tarefa.id)}
                  aria-expanded={aberta}
                  className="toque-seguro -mx-1 inline-flex min-h-toque-md items-center gap-1.5 rounded-dm px-1 text-left text-sm text-texto-suave hover:bg-superficie-sutil"
                >
                  {aberta ? (
                    <ChevronDown aria-hidden className="size-4 shrink-0" />
                  ) : (
                    <ChevronRight aria-hidden className="size-4 shrink-0" />
                  )}
                  Subtarefas
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                      doChecklist.length > 0 && feitas === doChecklist.length
                        ? 'bg-perfeito-fundo text-perfeito-texto'
                        : 'bg-superficie-sutil text-texto-suave',
                    )}
                  >
                    {feitas}/{doChecklist.length}
                  </span>
                </button>
                {aberta && (
                  <Checklist
                    maeId={tarefa.id}
                    nivel={1}
                    subtarefasPorMae={subtarefasPorMae}
                    aoConcluir={(id) => concluirSubMutacao.mutate(id)}
                    aoReabrir={(id) => reabrirSubMutacao.mutate(id)}
                    aoCriar={(maeId, titulo) => criarSubMutacao.mutate({ maeId, titulo })}
                    ocupado={checklistOcupado}
                  />
                )}

                <div className="mt-auto flex flex-wrap gap-2">
                  {!tarefa.iniciada_em && (
                    <Botao
                      variante="secundaria"
                      tamanho="sm"
                      icone={<Play />}
                      carregando={iniciarMutacao.isPending}
                      onClick={() => iniciarMutacao.mutate(tarefa.id)}
                    >
                      Iniciar tempo
                    </Botao>
                  )}
                  <Botao
                    tamanho="sm"
                    icone={<CheckCircle2 />}
                    className="flex-1"
                    carregando={concluirMutacao.isPending}
                    onClick={() => concluirMutacao.mutate(tarefa.id)}
                  >
                    Concluir
                  </Botao>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ---------------- Criar tarefa avulsa ---------------- */}
      <section className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4">
        <h2 className="text-lg">Nova tarefa avulsa</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            aoMudar={(v) => {
              setNovoSetor(v === 'nenhum' ? '' : v)
              setNovoResponsavel('')
            }}
          />
        </div>
        {possoDelegarNoNovoSetor && membrosDoNovoSetor.length > 0 && (
          <div className="max-w-sm">
            <Selecao
              rotulo="Para quem"
              opcoes={[
                { valor: 'eu', rotulo: 'Para mim' },
                ...membrosDoNovoSetor.map((m) => ({ valor: m.usuario_id, rotulo: m.nome })),
              ]}
              valor={novoResponsavel || 'eu'}
              aoMudar={(v) => setNovoResponsavel(v === 'eu' ? '' : v)}
            />
          </div>
        )}
        {novaEhParaMim && (
          /* Resposta do dono (SESSAO-23): tarefa minha nasce privada; este é o
             gesto de já criá-la visível para líderes e admins. */
          <label className="flex min-h-toque-md w-fit cursor-pointer items-center gap-2 text-sm text-texto">
            <input
              type="checkbox"
              checked={novaVisivel}
              onChange={(e) => setNovaVisivel(e.target.checked)}
              className="size-4 accent-marca-500"
            />
            Visível para a liderança
            <span className="text-xs text-texto-fraco">
              (desmarcado, só você vê esta tarefa)
            </span>
          </label>
        )}
        <div>
          <Botao
            icone={<Plus />}
            disabled={!novoTitulo.trim()}
            carregando={criarMutacao.isPending}
            onClick={() => criarMutacao.mutate()}
          >
            Criar tarefa
          </Botao>
        </div>
      </section>

      {/* ---------------- Afazeres do time (líder/admin) ---------------- */}
      {ehLider && setoresQueLidero.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg">Afazeres do time</h2>
            {setoresQueLidero.length > 1 && (
              <div className="w-56">
                <Selecao
                  rotulo="Setor"
                  opcoes={setoresQueLidero.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
                  valor={String(setorTimeId ?? '')}
                  aoMudar={setSetorTime}
                />
              </div>
            )}
          </div>

          {/* Carga por pessoa (RF-40) */}
          <div className="flex flex-wrap gap-2">
            {membrosDoTime.map((m) => (
              <span
                key={m.usuario_id}
                className="inline-flex items-center gap-2 rounded-full border border-borda bg-superficie px-3 py-1.5 text-sm"
              >
                <span className="font-medium text-texto">{m.nome}</span>
                <span className="rounded-full bg-superficie-sutil px-2 py-0.5 text-xs font-semibold text-texto-suave tabular-nums">
                  {cargaPorPessoa.get(m.usuario_id) ?? 0} aberto(s)
                </span>
              </span>
            ))}
            {membrosDoTime.length === 0 && (
              <p className="text-sm text-texto-fraco">Nenhum membro vinculado a este setor.</p>
            )}
          </div>

          {/* Cards do setor com delegação (RF-42: reatribuir é permitido e registrado) */}
          <ul className="flex flex-col gap-2">
            {(doTime?.cards ?? []).map((card) => {
              const pedido = pedidosDoTime.get(card.pedido_id)
              return (
                <li
                  key={card.id}
                  className="flex flex-col gap-2 rounded-dm border border-borda bg-superficie px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-medium text-texto">
                      Pedido {pedido?.numero ?? '…'} · {card.item_descricao ?? 'Sem descrição'}
                      {card.indice_unidade !== null &&
                        ` (${card.indice_unidade}/${card.total_unidades})`}
                    </p>
                    <p className="text-xs text-texto-fraco tabular-nums">
                      há {formatarDuracao(card.desde, agora)} no setor
                    </p>
                  </div>
                  <div className="w-full sm:w-64">
                    <Selecao
                      rotulo="Responsável"
                      opcoes={[
                        { valor: SEM_DONO, rotulo: 'Sem dono (fila)' },
                        ...membrosDoTime.map((m) => ({
                          valor: m.usuario_id,
                          rotulo:
                            m.usuario_id === card.responsavel_id ? `${m.nome} (atual)` : m.nome,
                        })),
                      ]}
                      valor={card.responsavel_id ?? SEM_DONO}
                      aoMudar={(v) =>
                        delegarMutacao.mutate({
                          card,
                          responsavelId: v === SEM_DONO ? null : v,
                          usuarioId: perfil.id,
                        })
                      }
                    />
                  </div>
                </li>
              )
            })}
            {(doTime?.cards ?? []).length === 0 && (
              <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
                Nenhum card aberto neste setor.
              </p>
            )}
          </ul>
        </section>
      )}
    </div>
  )
}
