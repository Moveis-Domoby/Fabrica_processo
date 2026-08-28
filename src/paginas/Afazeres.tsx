import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ClipboardList, ListTodo, Play, Plus, Timer } from 'lucide-react'
import { Botao, Campo, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarSetores, delegarCard } from '@/kanban/api'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { usePedidosDosCards } from '@/kanban/componentes/usePedidosDosCards'
import { membrosDoSetor } from '@/tablet/api'
import {
  afazeresDoSetor,
  concluirTarefa,
  criarTarefa,
  iniciarTarefa,
  meusCards,
  minhasTarefas,
} from '@/afazeres/api'

const ATUALIZA_A_CADA = 15_000
const SEM_DONO = 'sem-dono'

/**
 * Afazeres (SESSAO-12 / D-34 / RF-40…43): "meus afazeres" para todo mundo
 * (cards delegados a mim + tarefas avulsas), "afazeres do time" para o líder
 * (carga por pessoa e reatribuição — registrada em evento append-only).
 * A delegação ORGANIZA o trabalho; ela não trava gesto nenhum.
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

  // ----- criar tarefa avulsa -----
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novoSetor, setNovoSetor] = useState('')
  const [novoResponsavel, setNovoResponsavel] = useState('')
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

  const criarMutacao = useMutation({
    mutationFn: () =>
      criarTarefa({
        titulo: novoTitulo,
        setorId: setorNovoId,
        // Operador cria para si; líder/admin escolhe (D-34 — delegação direta).
        responsavelId: possoDelegarNoNovoSetor && novoResponsavel ? novoResponsavel : perfil!.id,
        criadaPor: perfil!.id,
      }),
    onSuccess: async () => {
      notificar({ titulo: 'Tarefa criada', tom: 'perfeito' })
      setNovoTitulo('')
      setNovoResponsavel('')
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
                    <Link to={setor.codigo === 'pcp' ? '/pcp' : `/setores/${setor.id}`}>
                      <Botao variante="secundaria" tamanho="sm" icone={<ClipboardList />}>
                        Abrir quadro
                      </Botao>
                    </Link>
                  )}
                </div>
              </li>
            )
          })}

          {tarefas.map((tarefa) => (
            <li
              key={`tarefa-${tarefa.id}`}
              className={cn(
                'flex flex-col gap-2 rounded-dm-lg border bg-superficie p-4',
                tarefa.situacao === 'em_andamento' ? 'border-acao-ativa' : 'border-borda',
              )}
            >
              <p className="font-medium text-texto">{tarefa.titulo}</p>
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
          ))}
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
