import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { Botao, Campo, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import {
  atualizarEtapa,
  atualizarSetor,
  buscarEtapasDoSetor,
  buscarSetores,
  criarEtapa,
  criarSetor,
  definirLimiteExecucoes,
} from '@/kanban/api'
import type { Etapa, Setor } from '@/kanban/tipos'

const ROTULO_PAPEL_FLUXO: Record<Setor['papel_no_fluxo'], string> = {
  entrada: 'entrada do fluxo',
  producao: 'produção',
  terminal: 'fim de linha',
}

/**
 * Estrutura do kanban (RF-07/D-12/D-14): setores e as etapas internas de cada
 * um. Admin mexe em tudo; líder, nas etapas dos setores em que é líder — o
 * RLS da SESSAO-02 garante isso por baixo. Desativar, nunca apagar: o
 * histórico de eventos aponta para setores e etapas para sempre.
 */
export function Estrutura() {
  const { perfil, vinculos } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [parametros] = useSearchParams()

  const souAdmin = perfil?.papel === 'admin'
  const setoresLiderados = new Set(
    vinculos.filter((v) => v.lider_do_setor).map((v) => v.setor_id),
  )
  const podeGerirEtapasDe = (setorId: number) => souAdmin || setoresLiderados.has(setorId)

  const { data: setores = [] } = useQuery({
    queryKey: ['setores', 'todos'],
    queryFn: () => buscarSetores(true),
  })

  const setorDaUrl = Number(parametros.get('setor'))
  const [expandido, setExpandido] = useState<number | null>(
    Number.isFinite(setorDaUrl) && setorDaUrl > 0 ? setorDaUrl : null,
  )

  const [modalNovoSetor, setModalNovoSetor] = useState(false)
  const [nomeNovoSetor, setNomeNovoSetor] = useState('')
  const [setorEmEdicao, setSetorEmEdicao] = useState<Setor | null>(null)
  const [nomeEditado, setNomeEditado] = useState('')
  const [setorParaDesativar, setSetorParaDesativar] = useState<Setor | null>(null)
  const [erroModal, setErroModal] = useState('')

  function aoErro(excecao: unknown) {
    notificar({
      titulo: 'Não deu certo',
      descricao: excecao instanceof Error ? excecao.message : 'Tente de novo.',
      tom: 'danificado',
    })
  }

  async function invalidarEstrutura() {
    await Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['setores'] }),
      clienteQuery.invalidateQueries({ queryKey: ['etapas'] }),
      clienteQuery.invalidateQueries({ queryKey: ['etapas-ativas'] }),
    ])
  }

  const criarSetorMutacao = useMutation({
    mutationFn: ({ nome, ordem }: { nome: string; ordem: number }) => criarSetor(nome, ordem),
    onSuccess: async () => {
      notificar({ titulo: 'Setor criado', tom: 'perfeito' })
      setModalNovoSetor(false)
      setNomeNovoSetor('')
      await invalidarEstrutura()
    },
    onError: (e) => setErroModal(e instanceof Error ? e.message : 'Não deu certo.'),
  })

  const atualizarSetorMutacao = useMutation({
    mutationFn: ({ id, mudancas }: { id: number; mudancas: Parameters<typeof atualizarSetor>[1] }) =>
      atualizarSetor(id, mudancas),
    onSuccess: invalidarEstrutura,
    onError: aoErro,
  })

  function trocarOrdemSetor(indice: number, direcao: -1 | 1) {
    const a = setores[indice]
    const b = setores[indice + direcao]
    if (!a || !b) return
    const ordemA = a.ordem === b.ordem ? indice + direcao + 1 : b.ordem
    const ordemB = a.ordem === b.ordem ? indice + 1 : a.ordem
    atualizarSetorMutacao.mutate({ id: a.id, mudancas: { ordem: ordemA } })
    atualizarSetorMutacao.mutate({ id: b.id, mudancas: { ordem: ordemB } })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl">Estrutura</h1>
          <p className="mt-1 max-w-2xl text-texto-suave">
            {/* D-14: toda etapa nasce com timer — código fora da tela (D-27). */}
            Setores e as etapas internas de cada um. Toda etapa cadastrada já nasce contando
            tempo — não existe timer para ligar. Nada aqui se apaga: desativar preserva o
            histórico.
          </p>
        </div>
        {souAdmin && (
          <Botao
            icone={<Plus />}
            onClick={() => {
              setModalNovoSetor(true)
              setErroModal('')
            }}
          >
            Novo setor
          </Botao>
        )}
      </div>

      <ul className="flex flex-col gap-3">
        {setores.map((setor, indice) => (
          <li key={setor.id}>
            <SecaoSetor
              setor={setor}
              expandido={expandido === setor.id}
              aoExpandir={() => setExpandido(expandido === setor.id ? null : setor.id)}
              podeGerirSetor={souAdmin}
              podeGerirEtapas={podeGerirEtapasDe(setor.id)}
              aoSubir={indice > 0 ? () => trocarOrdemSetor(indice, -1) : undefined}
              aoDescer={
                indice < setores.length - 1 ? () => trocarOrdemSetor(indice, 1) : undefined
              }
              aoRenomear={() => {
                setSetorEmEdicao(setor)
                setNomeEditado(setor.nome)
                setErroModal('')
              }}
              aoAlternarAtivo={() => {
                if (setor.ativo) setSetorParaDesativar(setor)
                else atualizarSetorMutacao.mutate({ id: setor.id, mudancas: { ativo: true } })
              }}
              aoErro={aoErro}
              aoMudar={invalidarEstrutura}
            />
          </li>
        ))}
      </ul>

      {/* ---------- Novo setor (admin) ---------- */}
      <Modal
        aberto={modalNovoSetor}
        aoFechar={(aberto) => {
          if (!aberto) setModalNovoSetor(false)
        }}
        titulo="Novo setor"
        descricao="O setor nasce como setor de produção, sem etapas — cadastre as etapas dele em seguida."
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => setModalNovoSetor(false)}>
              Cancelar
            </Botao>
            <Botao
              carregando={criarSetorMutacao.isPending}
              onClick={() => {
                if (nomeNovoSetor.trim().length < 2) {
                  setErroModal('Informe o nome do setor.')
                  return
                }
                setErroModal('')
                criarSetorMutacao.mutate({
                  nome: nomeNovoSetor,
                  ordem: (setores[setores.length - 1]?.ordem ?? 0) + 1,
                })
              }}
            >
              Criar setor
            </Botao>
          </>
        }
      >
        <Campo
          rotulo="Nome do setor"
          ajuda="Como a equipe fala — vira caixa alta: METALURGICA, PINTURA…"
          value={nomeNovoSetor}
          onChange={(e) => setNomeNovoSetor(e.target.value)}
          erro={erroModal || undefined}
        />
      </Modal>

      {/* ---------- Renomear setor (admin) ---------- */}
      <Modal
        aberto={setorEmEdicao !== null}
        aoFechar={(aberto) => {
          if (!aberto) setSetorEmEdicao(null)
        }}
        titulo={setorEmEdicao ? `Renomear ${setorEmEdicao.nome}` : 'Renomear'}
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => setSetorEmEdicao(null)}>
              Cancelar
            </Botao>
            <Botao
              carregando={atualizarSetorMutacao.isPending}
              onClick={() => {
                if (!setorEmEdicao) return
                if (nomeEditado.trim().length < 2) {
                  setErroModal('Informe o nome.')
                  return
                }
                atualizarSetorMutacao.mutate(
                  { id: setorEmEdicao.id, mudancas: { nome: nomeEditado } },
                  { onSuccess: () => setSetorEmEdicao(null) },
                )
              }}
            >
              Salvar
            </Botao>
          </>
        }
      >
        <Campo
          rotulo="Nome do setor"
          value={nomeEditado}
          onChange={(e) => setNomeEditado(e.target.value)}
          erro={erroModal || undefined}
        />
      </Modal>

      {/* ---------- Desativar setor (admin) ---------- */}
      <Modal
        aberto={setorParaDesativar !== null}
        aoFechar={(aberto) => {
          if (!aberto) setSetorParaDesativar(null)
        }}
        titulo={setorParaDesativar ? `Desativar ${setorParaDesativar.nome}?` : 'Desativar'}
        descricao="O setor some dos quadros e dos destinos de movimentação, mas o histórico continua apontando para ele. Cards que estiverem nele continuam lá até serem movidos. Dá para reativar depois."
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => setSetorParaDesativar(null)}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              carregando={atualizarSetorMutacao.isPending}
              onClick={() => {
                if (!setorParaDesativar) return
                atualizarSetorMutacao.mutate(
                  { id: setorParaDesativar.id, mudancas: { ativo: false } },
                  { onSuccess: () => setSetorParaDesativar(null) },
                )
              }}
            >
              Desativar setor
            </Botao>
          </>
        }
      />
    </div>
  )
}

// ---------------------------------------------------------------------------

function SecaoSetor(props: {
  setor: Setor
  expandido: boolean
  aoExpandir: () => void
  podeGerirSetor: boolean
  podeGerirEtapas: boolean
  aoSubir?: () => void
  aoDescer?: () => void
  aoRenomear: () => void
  aoAlternarAtivo: () => void
  aoErro: (excecao: unknown) => void
  aoMudar: () => Promise<void>
}) {
  const { setor, expandido, podeGerirEtapas } = props

  return (
    <section
      className={cn(
        'rounded-dm-lg border bg-superficie',
        setor.ativo ? 'border-borda' : 'border-borda opacity-60',
      )}
    >
      <header className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={props.aoExpandir}
          aria-expanded={expandido}
          className="toque-seguro flex min-h-toque-md flex-1 cursor-pointer items-center gap-2 rounded-dm text-left"
        >
          {expandido ? (
            <ChevronDown aria-hidden className="size-5 shrink-0 text-texto-suave" />
          ) : (
            <ChevronRight aria-hidden className="size-5 shrink-0 text-texto-suave" />
          )}
          <span className="font-semibold text-texto">{setor.nome}</span>
          <span className="rounded-full bg-superficie-sutil px-2 py-0.5 text-xs font-medium text-texto-suave">
            {ROTULO_PAPEL_FLUXO[setor.papel_no_fluxo]}
          </span>
          {!setor.ativo && (
            <span className="rounded-full bg-atencao-fundo px-2 py-0.5 text-xs font-medium text-atencao-texto">
              desativado
            </span>
          )}
        </button>

        {props.podeGerirSetor && (
          <span className="flex items-center gap-1">
            <Botao
              variante="fantasma"
              tamanho="sm"
              icone={<ArrowUp />}
              aria-label={`Subir ${setor.nome}`}
              disabled={!props.aoSubir}
              onClick={props.aoSubir}
            />
            <Botao
              variante="fantasma"
              tamanho="sm"
              icone={<ArrowDown />}
              aria-label={`Descer ${setor.nome}`}
              disabled={!props.aoDescer}
              onClick={props.aoDescer}
            />
            <Botao variante="fantasma" tamanho="sm" icone={<Pencil />} onClick={props.aoRenomear}>
              Renomear
            </Botao>
            {setor.ativo ? (
              <Botao variante="fantasma" tamanho="sm" onClick={props.aoAlternarAtivo}>
                Desativar
              </Botao>
            ) : (
              <Botao
                variante="fantasma"
                tamanho="sm"
                icone={<RotateCcw />}
                onClick={props.aoAlternarAtivo}
              >
                Reativar
              </Botao>
            )}
          </span>
        )}
      </header>

      {expandido && (
        <>
          {/* D-48 (SESSAO-22): o limite é configuração do setor que o LÍDER
              também ajusta (a RPC valida no banco); a delegação segue do admin. */}
          {(props.podeGerirSetor || podeGerirEtapas) && (
            <LimiteExecucoes setor={setor} aoErro={props.aoErro} aoMudar={props.aoMudar} />
          )}
          {props.podeGerirSetor && (
            <ModoDelegacao setor={setor} aoErro={props.aoErro} aoMudar={props.aoMudar} />
          )}
          <ListaEtapas
            setor={setor}
            podeGerir={podeGerirEtapas}
            aoErro={props.aoErro}
            aoMudar={props.aoMudar}
          />
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------

/**
 * D-34: como o card que chega neste setor ganha dono. O sorteio só considera
 * quem está com a plataforma aberta agora, balanceando por carga.
 */
function ModoDelegacao(props: {
  setor: Setor
  aoErro: (excecao: unknown) => void
  aoMudar: () => Promise<void>
}) {
  const { setor } = props
  const notificar = useNotificacao()

  const salvarMutacao = useMutation({
    mutationFn: (modo: Setor['modo_delegacao']) =>
      atualizarSetor(setor.id, { modo_delegacao: modo }),
    onSuccess: async (_dados, modo) => {
      notificar({
        titulo: `${setor.nome}: delegação ${
          modo === 'aleatoria'
            ? 'por sorteio entre quem está logado'
            : modo === 'direta'
              ? 'direta (líder atribui)'
              : 'desativada — card fica sem dono na fila'
        }`,
        tom: 'perfeito',
      })
      await props.aoMudar()
    },
    onError: props.aoErro,
  })

  return (
    <div className="flex flex-col gap-2 border-t border-borda px-3 py-3 sm:px-4">
      <div className="max-w-sm">
        <Selecao
          rotulo="Delegação dos cards que chegam"
          ajuda="Sorteio só entre quem está com a plataforma aberta, balanceando por carga. Delegar organiza — não trava gesto nenhum."
          opcoes={[
            { valor: 'desativada', rotulo: 'Desativada — card sem dono na fila' },
            { valor: 'direta', rotulo: 'Direta — líder/admin atribui' },
            { valor: 'aleatoria', rotulo: 'Aleatória — sorteia entre os logados' },
          ]}
          valor={setor.modo_delegacao}
          aoMudar={(v) => salvarMutacao.mutate(v as Setor['modo_delegacao'])}
        />
      </div>
    </div>
  )
}

/**
 * D-24/D-48: limite de cards em execução pela MESMA pessoa neste setor, por
 * vez. O padrão da casa é 1 ("uma pessoa, um pedido por vez"); líder do setor
 * e admin ajustam aqui — a RPC valida no banco e registra na trilha. O banco
 * recusa o Iniciar (e o Retomar) de quem estiver no teto, para interface e
 * API igualmente; execução pausada não conta.
 */
function LimiteExecucoes(props: {
  setor: Setor
  aoErro: (excecao: unknown) => void
  aoMudar: () => Promise<void>
}) {
  const { setor } = props
  const notificar = useNotificacao()
  const [valor, setValor] = useState(
    setor.limite_execucoes_por_pessoa === null ? '' : String(setor.limite_execucoes_por_pessoa),
  )

  const salvarMutacao = useMutation({
    mutationFn: (limite: number | null) => definirLimiteExecucoes(setor.id, limite),
    onSuccess: async (_dados, limite) => {
      notificar({
        titulo:
          limite === null
            ? `${setor.nome} sem limite de execuções`
            : `${setor.nome}: até ${limite} card(s) em execução por pessoa`,
        tom: 'perfeito',
      })
      await props.aoMudar()
    },
    onError: props.aoErro,
  })

  function aoSalvar() {
    const texto = valor.trim()
    // `|| null`: vazio/0 nunca é limite válido — vira "sem limite" (D-24).
    const limite = Number(texto) || null
    if (limite !== null && (!Number.isInteger(limite) || limite < 1)) {
      props.aoErro(new Error('O limite precisa ser um número inteiro maior que zero — ou vazio para sem limite.'))
      return
    }
    salvarMutacao.mutate(limite)
  }

  return (
    <div className="flex flex-col gap-2 border-t border-borda px-3 py-3 sm:flex-row sm:items-end sm:px-4">
      <div className="max-w-xs flex-1">
        <Campo
          rotulo="Limite de cards em execução por pessoa"
          // D-24/D-48: limite configurável por setor — código fora da tela (D-27).
          ajuda="Padrão da casa: 1 — uma pessoa, um pedido por vez. Vazio = sem limite. Execução pausada pelo líder não conta no teto."
          type="number"
          min={1}
          inputMode="numeric"
          placeholder="sem limite"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
      </div>
      <Botao
        variante="secundaria"
        carregando={salvarMutacao.isPending}
        onClick={aoSalvar}
        className="min-h-toque-md"
      >
        Salvar limite
      </Botao>
    </div>
  )
}

// ---------------------------------------------------------------------------

function ListaEtapas(props: {
  setor: Setor
  podeGerir: boolean
  aoErro: (excecao: unknown) => void
  aoMudar: () => Promise<void>
}) {
  const { setor, podeGerir } = props
  const notificar = useNotificacao()

  const { data: etapas = [], isPending } = useQuery({
    queryKey: ['etapas', 'gestao', setor.id],
    queryFn: () => buscarEtapasDoSetor(setor.id, true),
  })

  const [nomeNova, setNomeNova] = useState('')
  const [novaEhFila, setNovaEhFila] = useState(false)
  const [erroNova, setErroNova] = useState('')
  const [etapaEmEdicao, setEtapaEmEdicao] = useState<Etapa | null>(null)
  const [nomeEditado, setNomeEditado] = useState('')

  const criarMutacao = useMutation({
    mutationFn: () => criarEtapa(setor.id, nomeNova, novaEhFila),
    onSuccess: async () => {
      notificar({
        titulo: `Etapa "${nomeNova.trim()}" criada`,
        // D-14: timer é propriedade da etapa — código fora da tela (D-27).
        descricao: 'Ela já nasce contando tempo para todo card que chegar.',
        tom: 'perfeito',
      })
      setNomeNova('')
      setNovaEhFila(false)
      setErroNova('')
      await props.aoMudar()
    },
    onError: (e) => setErroNova(e instanceof Error ? e.message : 'Não deu certo.'),
  })

  const atualizarMutacao = useMutation({
    mutationFn: ({ id, mudancas }: { id: number; mudancas: Parameters<typeof atualizarEtapa>[1] }) =>
      atualizarEtapa(id, mudancas),
    onSuccess: props.aoMudar,
    onError: props.aoErro,
  })

  function trocarOrdem(indice: number, direcao: -1 | 1) {
    const a = etapas[indice]
    const b = etapas[indice + direcao]
    if (!a || !b) return
    const ordemA = a.ordem === b.ordem ? indice + direcao + 1 : b.ordem
    const ordemB = a.ordem === b.ordem ? indice + 1 : a.ordem
    atualizarMutacao.mutate({ id: a.id, mudancas: { ordem: ordemA } })
    atualizarMutacao.mutate({ id: b.id, mudancas: { ordem: ordemB } })
  }

  return (
    <div className="border-t border-borda px-3 py-3 sm:px-4">
      {isPending && <p className="text-sm text-texto-fraco">Carregando etapas…</p>}
      {!isPending && etapas.length === 0 && (
        <p className="text-sm text-texto-suave">
          Nenhuma etapa cadastrada — os cards ficam na Chegada do setor.
        </p>
      )}

      <ul className="flex flex-col divide-y divide-borda">
        {etapas.map((etapa, indice) => (
          <li key={etapa.id} className="flex flex-wrap items-center gap-2 py-2">
            <span
              className={cn(
                'flex-1 text-sm',
                etapa.ativa ? 'text-texto' : 'text-texto-fraco line-through',
              )}
            >
              {etapa.nome}
              {etapa.eh_fila && (
                <span className="ml-2 rounded-full bg-info-fundo px-2 py-0.5 text-xs font-medium text-info-texto no-underline">
                  fila
                </span>
              )}
            </span>
            {podeGerir && (
              <span className="flex items-center gap-1">
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  icone={<ArrowUp />}
                  aria-label={`Subir ${etapa.nome}`}
                  disabled={indice === 0}
                  onClick={() => trocarOrdem(indice, -1)}
                />
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  icone={<ArrowDown />}
                  aria-label={`Descer ${etapa.nome}`}
                  disabled={indice === etapas.length - 1}
                  onClick={() => trocarOrdem(indice, 1)}
                />
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  icone={<Pencil />}
                  aria-label={`Renomear ${etapa.nome}`}
                  onClick={() => {
                    setEtapaEmEdicao(etapa)
                    setNomeEditado(etapa.nome)
                  }}
                />
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  onClick={() =>
                    atualizarMutacao.mutate({ id: etapa.id, mudancas: { ativa: !etapa.ativa } })
                  }
                >
                  {etapa.ativa ? 'Desativar' : 'Reativar'}
                </Botao>
              </span>
            )}
          </li>
        ))}
      </ul>

      {podeGerir && (
        <form
          className="mt-3 flex flex-col gap-2 rounded-dm border border-borda bg-superficie-sutil p-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            if (nomeNova.trim().length < 2) {
              setErroNova('Informe o nome da etapa.')
              return
            }
            criarMutacao.mutate()
          }}
        >
          <div className="flex-1">
            <Campo
              rotulo="Nova etapa"
              placeholder="Ex.: NA FILA, EM CORTE, FINALIZADO…"
              value={nomeNova}
              onChange={(e) => setNomeNova(e.target.value)}
              erro={erroNova || undefined}
            />
          </div>
          <label className="flex min-h-toque-md cursor-pointer items-center gap-2 text-sm text-texto-suave">
            <input
              type="checkbox"
              className="size-5 accent-[var(--dm-acao)]"
              checked={novaEhFila}
              onChange={() => setNovaEhFila(!novaEhFila)}
            />
            é a fila do setor (o card espera sem dono — uma por setor)
          </label>
          <Botao type="submit" variante="secundaria" carregando={criarMutacao.isPending} icone={<Plus />}>
            Criar etapa
          </Botao>
        </form>
      )}

      {/* ---------- Renomear etapa ---------- */}
      <Modal
        aberto={etapaEmEdicao !== null}
        aoFechar={(aberto) => {
          if (!aberto) setEtapaEmEdicao(null)
        }}
        titulo={etapaEmEdicao ? `Renomear ${etapaEmEdicao.nome}` : 'Renomear'}
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => setEtapaEmEdicao(null)}>
              Cancelar
            </Botao>
            <Botao
              carregando={atualizarMutacao.isPending}
              onClick={() => {
                if (!etapaEmEdicao || nomeEditado.trim().length < 2) return
                atualizarMutacao.mutate(
                  { id: etapaEmEdicao.id, mudancas: { nome: nomeEditado } },
                  { onSuccess: () => setEtapaEmEdicao(null) },
                )
              }}
            >
              Salvar
            </Botao>
          </>
        }
      >
        <Campo
          rotulo="Nome da etapa"
          value={nomeEditado}
          onChange={(e) => setNomeEditado(e.target.value)}
        />
      </Modal>
    </div>
  )
}
