import { useMemo, useState } from 'react'
import { Navigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Plus } from 'lucide-react'
import { Botao, Campo, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarSetores, delegarCard } from '@/kanban/api'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { usePedidosDosCards } from '@/kanban/componentes/usePedidosDosCards'
import { membrosDoSetor } from '@/tablet/api'
import { afazeresDoSetor, criarTarefa } from '@/afazeres/api'

const ATUALIZA_A_CADA = 15_000
const SEM_DONO = 'sem-dono'

/**
 * Afazeres do time (SESSAO-23, pedido do dono em 23/09): a visão da liderança
 * saiu da tela de afazeres pessoais e virou uma filha própria de Início —
 * carga por pessoa e a delegação dos cards do setor (RF-40/RF-42; delegar
 * organiza, não trava — D-34).
 */
export function AfazeresDoTime() {
  const { perfil, vinculos, ehLider, carregando } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora()

  const souAdmin = perfil?.papel === 'admin'

  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })

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

  // ----- nova tarefa DELEGADA (pedido do dono, 23/09: delegar mora aqui) -----
  const [modalNova, setModalNova] = useState(false)
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novoResponsavel, setNovoResponsavel] = useState('')
  const SEM_RESPONSAVEL = 'sem-responsavel'

  const criarMutacao = useMutation({
    mutationFn: () =>
      criarTarefa({
        titulo: novoTitulo,
        setorId: setorTimeId,
        responsavelId: novoResponsavel === SEM_RESPONSAVEL ? null : novoResponsavel || null,
        criadaPor: perfil!.id,
        privada: false, // delegada é sempre visível (D-51)
      }),
    onSuccess: async () => {
      notificar({ titulo: 'Tarefa criada para o time', tom: 'perfeito' })
      setModalNova(false)
      setNovoTitulo('')
      setNovoResponsavel('')
      await clienteQuery.invalidateQueries({ queryKey: ['afazeres'] })
    },
    onError: (excecao: unknown) =>
      notificar({
        titulo: 'Não deu para criar a tarefa',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  const delegarMutacao = useMutation({
    mutationFn: delegarCard,
    onSuccess: async () => {
      notificar({ titulo: 'Afazer delegado', tom: 'perfeito' })
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['afazeres'] }),
        clienteQuery.invalidateQueries({ queryKey: ['cards'] }),
      ])
    },
    onError: (excecao: unknown) =>
      notificar({
        titulo: 'Não deu para delegar',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  if (carregando) return null
  if (!perfil) return null
  if (!ehLider) return <Navigate to="/inicio/afazeres" replace />

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl">Afazeres do time</h1>
          <p className="mt-1 max-w-2xl text-texto-suave">
            A carga de cada pessoa e a delegação dos cards do setor. Delegar organiza o trabalho;
            qualquer pessoa do setor continua podendo agir no card.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
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
          <Botao icone={<Plus />} disabled={setorTimeId === null} onClick={() => setModalNova(true)}>
            Nova tarefa
          </Botao>
        </div>
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
                  {card.indice_unidade !== null && ` (${card.indice_unidade}/${card.total_unidades})`}
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
                      rotulo: m.usuario_id === card.responsavel_id ? `${m.nome} (atual)` : m.nome,
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

      {/* ---------------- nova tarefa para o time ---------------- */}
      <Modal
        aberto={modalNova}
        aoFechar={(aberto) => {
          if (!aberto) setModalNova(false)
        }}
        titulo="Nova tarefa para o time"
        descricao={`No setor ${setoresQueLidero.find((s) => s.id === setorTimeId)?.nome ?? ''}`}
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
            placeholder="ex.: organizar o estoque de fitas"
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
          />
          <Selecao
            rotulo="Para quem"
            opcoes={[
              { valor: SEM_RESPONSAVEL, rotulo: 'Sem dono (qualquer um do setor pega)' },
              ...membrosDoTime.map((m) => ({ valor: m.usuario_id, rotulo: m.nome })),
            ]}
            valor={novoResponsavel || SEM_RESPONSAVEL}
            aoMudar={(v) => setNovoResponsavel(v)}
          />
          <p className="text-xs text-texto-fraco">
            Tarefa delegada é sempre visível para você e para os admins; quem recebe vê na hora
            nos afazeres dele.
          </p>
        </div>
      </Modal>
    </div>
  )
}
