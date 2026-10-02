import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CirclePause,
  CirclePlay,
  Plus,
  Save,
  Workflow,
} from 'lucide-react'
import { Botao, Campo, Dica, Modal, Paginacao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { buscarEtapasAtivas, buscarSetores } from '@/kanban/api'
import { usuariosAtivos } from '@/metas/api'
import { useCampos, useEtiquetas } from '@/utilitarios/consultas'
import {
  POR_PAGINA_AUTOMACOES,
  arquivarAutomacao,
  buscarAutomacao,
  ligarAutomacao,
  listarAutomacoes,
  salvarAutomacao,
} from '@/automacoes/api'
import type { Automacao, AutomacaoResumo } from '@/automacoes/api'
import { GATILHOS, PASSOS, ROTULO_PASSO, ROTULO_SITUACAO_EXECUCAO } from '@/automacoes/catalogo'
import type { TipoPasso } from '@/automacoes/catalogo'
import {
  ID_QUANDO,
  desenhoNovo,
  inserirDepois,
  montarDesenho,
  paraGuardar,
  remover,
  sequencia,
  soltos,
  trocarPasso,
} from '@/automacoes/desenho'
import type { EstadoDesenho, Passo } from '@/automacoes/desenho'
import { resumoGatilho, resumoPasso } from '@/automacoes/resumo'
import type { NomesAutomacao } from '@/automacoes/resumo'
import { CanvasAutomacao } from '@/automacoes/componentes/CanvasAutomacao'
import { ICONE_PASSO } from '@/automacoes/icones'
import { PainelPasso, PainelQuando } from '@/automacoes/componentes/PainelBloco'
import type { DadosAutomacao } from '@/automacoes/componentes/PainelBloco'
import { Execucoes } from '@/automacoes/componentes/Execucoes'

/** O bloco novo, já com o que faz sentido de começo. */
function passoNovo(tipo: TipoPasso): Passo {
  switch (tipo) {
    case 'esperar':
      return { tipo, quantidade: 1, unidade: 'horas' }
    case 'avisar':
      return { tipo, destino: 'lideres', titulo: '', mensagem: '' }
    case 'etiqueta_por':
      return { tipo, etiquetas: [] }
    case 'etiqueta_tirar':
      return { tipo, todas: false, etiquetas: [] }
    default:
      return { tipo }
  }
}

function quando(iso: string | null): string {
  if (!iso) return 'nunca'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Os cadastros reais que os blocos usam (setores, etapas, etiquetas, campos, pessoas). */
function useDadosAutomacao(): { dados: DadosAutomacao; nomes: NomesAutomacao } {
  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })
  const { data: etapas = [] } = useQuery({ queryKey: ['etapas-ativas'], queryFn: buscarEtapasAtivas, staleTime: 5 * 60_000 })
  const { data: etiquetas = [] } = useEtiquetas()
  const { data: campos = [] } = useCampos()
  const { data: pessoas = [] } = useQuery({ queryKey: ['usuarios-ativos'], queryFn: usuariosAtivos, staleTime: 5 * 60_000 })
  return useMemo(
    () => ({
      dados: { setores, etapas, etiquetas, campos, pessoas },
      nomes: {
        setores: new Map(setores.map((s) => [s.id, s.nome])),
        etapas: new Map(etapas.map((e) => [e.id, { nome: e.nome, setor_id: e.setor_id }])),
        etiquetas: new Map(etiquetas.map((e) => [e.id, e.nome])),
        campos: new Map(campos.map((c) => [c.id, c])),
        pessoas: new Map(pessoas.map((p) => [p.id, p.nome])),
      },
    }),
    [setores, etapas, etiquetas, campos, pessoas],
  )
}

/**
 * Painel super admin → Automações (SESSAO-27 · D-99/D-103). O dono: "a
 * automação em canvas deve ser para tudo — comercial, API, pedidos — e só eu
 * vou construir essas coisas, então eu vou saber quando ligar". Só o super
 * admin (rota + banco). Toda automação nasce DESLIGADA; o motor roda no
 * banco, na hora, e cada disparo fica no histórico.
 */
export function Automacoes() {
  const [parametros] = useSearchParams()
  const aberta = parametros.get('a')
  return aberta ? <EditorCarregado chave={aberta} /> : <ListaAutomacoes />
}

// ---------------------------------------------------------------------------
// A lista
// ---------------------------------------------------------------------------

function CabecalhoAutomacoes() {
  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <h1 className="flex items-center gap-2 text-2xl sm:text-3xl">
        <Workflow aria-hidden className="size-7 shrink-0 text-texto-suave" />
        Automações
      </h1>
      <Dica rotulo="Como as automações funcionam">
        <span className="flex flex-col gap-2">
          <span>
            Cada automação é um QUANDO (o que dispara) ligado a uma sequência de FAÇA (o que acontece). Monte
            arrastando os blocos e ligando as bolinhas, ou pelo "+" de cada bloco.
          </span>
          <span>
            Toda automação nasce desligada: ela só age depois que você liga. Roda na hora, no banco, e cada
            disparo fica no histórico — o que disparou, a condição, cada passo e o resultado.
          </span>
          <span>
            A automação obedece às mesmas regras de uma pessoa (o estoque só recebe peça perfeita, por exemplo). Se
            uma automação dispara outra, a cadeia para em 5.
          </span>
        </span>
      </Dica>
    </div>
  )
}

function ListaAutomacoes() {
  const [, setParametros] = useSearchParams()
  const { nomes } = useDadosAutomacao()
  const [pagina, setPagina] = useState(1)
  const [arquivadas, setArquivadas] = useState(false)
  const consulta = useQuery({
    queryKey: ['automacoes', 'lista', arquivadas, pagina],
    queryFn: () => listarAutomacoes(pagina, arquivadas),
    placeholderData: (anterior) => anterior,
  })
  const linhas = consulta.data?.linhas ?? []
  const total = consulta.data?.total ?? 0

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CabecalhoAutomacoes />
        <Botao icone={<Plus />} onClick={() => setParametros({ a: 'nova' })}>
          Nova automação
        </Botao>
      </div>
      <label className="inline-flex min-h-toque-md items-center gap-2 text-sm text-texto">
        <input
          type="checkbox"
          className="size-5 accent-marca-500"
          checked={arquivadas}
          onChange={(e) => {
            setArquivadas(e.target.checked)
            setPagina(1)
          }}
        />
        Ver as arquivadas
      </label>
      {consulta.isError && (
        <p className="rounded-dm border border-danificado-forte bg-danificado-fundo p-3 text-sm text-danificado-texto">
          {(consulta.error as Error).message}
        </p>
      )}
      {consulta.isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {!consulta.isPending && linhas.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          {arquivadas ? 'Nenhuma automação arquivada.' : 'Nenhuma automação ainda. Toque em "Nova automação" para montar a primeira.'}
        </p>
      )}
      {linhas.length > 0 && (
        <ul className="flex flex-col gap-3">
          {linhas.map((a) => (
            <LinhaAutomacao key={a.id} automacao={a} nomes={nomes} />
          ))}
        </ul>
      )}
      {total > POR_PAGINA_AUTOMACOES && (
        <Paginacao
          paginaAtual={pagina}
          totalPaginas={Math.ceil(total / POR_PAGINA_AUTOMACOES)}
          totalItens={total}
          porPagina={POR_PAGINA_AUTOMACOES}
          aoMudarPagina={setPagina}
          className="rounded-dm-lg border border-borda bg-superficie"
        />
      )}
    </div>
  )
}

/** Ligar/desligar com o "tem certeza?" na própria linha (dois toques — sem caixa do navegador). */
function BotaoLigar({ id, ligada, desabilitado }: { id: number; ligada: boolean; desabilitado?: string }) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [confirmando, setConfirmando] = useState(false)
  const mutacao = useMutation({
    mutationFn: () => ligarAutomacao(id, !ligada),
    onSuccess: async () => {
      notificar({ titulo: ligada ? 'Automação desligada' : 'Automação ligada — já está agindo', tom: 'perfeito' })
      setConfirmando(false)
      await clienteQuery.invalidateQueries({ queryKey: ['automacoes'] })
    },
    onError: (excecao) => {
      setConfirmando(false)
      notificar({ titulo: 'Não deu certo', descricao: excecao instanceof Error ? excecao.message : undefined, tom: 'danificado' })
    },
  })
  if (confirmando)
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-texto">{ligada ? 'Desligar? Ela para de agir.' : 'Ligar? Ela passa a agir sozinha.'}</span>
        <Botao tamanho="sm" variante={ligada ? 'secundaria' : 'primaria'} carregando={mutacao.isPending} onClick={() => mutacao.mutate()}>
          {ligada ? 'Sim, desligar' : 'Sim, ligar'}
        </Botao>
        <Botao tamanho="sm" variante="fantasma" onClick={() => setConfirmando(false)}>
          Não
        </Botao>
      </span>
    )
  return (
    <Botao
      tamanho="sm"
      variante={ligada ? 'secundaria' : 'primaria'}
      icone={ligada ? <CirclePause /> : <CirclePlay />}
      disabled={Boolean(desabilitado)}
      title={desabilitado}
      onClick={() => setConfirmando(true)}
    >
      {ligada ? 'Desligar' : 'Ligar'}
    </Botao>
  )
}

function SeloLigada({ ligada }: { ligada: boolean }) {
  return ligada ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-perfeito-borda bg-perfeito-fundo px-2.5 py-0.5 text-xs font-medium text-perfeito-texto">
      <CirclePlay aria-hidden className="size-3.5" />
      Ligada
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-borda bg-superficie-sutil px-2.5 py-0.5 text-xs font-medium text-texto-suave">
      <CirclePause aria-hidden className="size-3.5" />
      Desligada
    </span>
  )
}

function LinhaAutomacao({ automacao: a, nomes }: { automacao: AutomacaoResumo; nomes: NomesAutomacao }) {
  return (
    <li className="flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/super-admin/automacoes?a=${a.id}`}
          className="inline-flex min-h-toque-md items-center text-base font-semibold text-texto underline-offset-4 hover:underline"
        >
          {a.nome}
        </Link>
        <SeloLigada ligada={a.ligada} />
        {a.arquivada_em && (
          <span className="rounded-full bg-superficie-sutil px-2 py-0.5 text-xs text-texto-suave">arquivada</span>
        )}
      </div>
      <p className="text-sm text-texto-suave">
        {resumoGatilho(a.gatilho, a.gatilho_config ?? {}, nomes)} → {a.passos_total}{' '}
        {a.passos_total === 1 ? 'passo' : 'passos'}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-texto-suave">
        <span>
          Última vez: {quando(a.ultima_execucao_em)}
          {a.ultima_situacao ? ` (${(ROTULO_SITUACAO_EXECUCAO[a.ultima_situacao] ?? a.ultima_situacao).toLowerCase()})` : ''}
        </span>
        <span>
          {a.execucoes_24h} {a.execucoes_24h === 1 ? 'disparo' : 'disparos'} nas últimas 24 h
        </span>
        <span className="ml-auto flex flex-wrap gap-2">
          {!a.arquivada_em && (
            <BotaoLigar id={a.id} ligada={a.ligada} desabilitado={a.passos_total === 0 ? 'Monte pelo menos um passo antes de ligar' : undefined} />
          )}
          <Link
            to={`/super-admin/automacoes?a=${a.id}`}
            className="inline-flex min-h-toque-md items-center rounded-dm border border-borda-forte px-3 text-sm font-medium text-texto hover:bg-superficie-sutil"
          >
            Abrir
          </Link>
        </span>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// O editor
// ---------------------------------------------------------------------------

function EditorCarregado({ chave }: { chave: string }) {
  const id = chave === 'nova' ? null : Number(chave)
  const consulta = useQuery({
    queryKey: ['automacoes', 'uma', id],
    queryFn: () => buscarAutomacao(id!),
    enabled: id !== null && Number.isFinite(id),
  })
  if (id === null) return <Editor key="nova" automacao={null} />
  if (consulta.isError)
    return (
      <div className="flex flex-col gap-3">
        <Link to="/super-admin/automacoes" className="inline-flex min-h-toque-md items-center gap-2 text-sm text-texto-suave">
          <ArrowLeft aria-hidden className="size-4" /> Voltar às automações
        </Link>
        <p className="rounded-dm border border-danificado-forte bg-danificado-fundo p-3 text-sm text-danificado-texto">
          {(consulta.error as Error).message}
        </p>
      </div>
    )
  if (!consulta.data) return <p className="text-sm text-texto-fraco">Carregando…</p>
  // a chave muda quando outra automação abre → o editor nasce de novo com o estado dela
  return <Editor key={`${consulta.data.id}-${consulta.data.atualizada_em}`} automacao={consulta.data} />
}

function Editor({ automacao }: { automacao: Automacao | null }) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [, setParametros] = useSearchParams()
  const { dados, nomes } = useDadosAutomacao()
  const [nome, setNome] = useState(automacao?.nome ?? '')
  const [estado, setEstado] = useState<EstadoDesenho>(() => (automacao ? montarDesenho(automacao) : desenhoNovo()))
  const [selecionado, setSelecionado] = useState<string | null>(automacao ? null : ID_QUANDO)
  const [alterado, setAlterado] = useState(automacao === null)
  const [adicionandoDepois, setAdicionandoDepois] = useState<string | null>(null)
  const [confirmandoArquivar, setConfirmandoArquivar] = useState(false)

  function mudar(novo: EstadoDesenho) {
    setEstado(novo)
    setAlterado(true)
  }

  const salvar = useMutation({
    mutationFn: () => {
      const { passos, desenho } = paraGuardar(estado)
      return salvarAutomacao({
        id: automacao?.id ?? null,
        nome: nome.trim(),
        gatilho: estado.gatilho,
        gatilhoConfig: estado.gatilhoConfig,
        passos,
        desenho,
      })
    },
    onSuccess: async (idSalvo) => {
      notificar({ titulo: automacao ? 'Automação salva' : 'Automação criada — desligada até você ligar', tom: 'perfeito' })
      setAlterado(false)
      await clienteQuery.invalidateQueries({ queryKey: ['automacoes'] })
      if (!automacao) setParametros({ a: String(idSalvo) }, { replace: true })
    },
    onError: (excecao) =>
      notificar({ titulo: 'Não deu para salvar', descricao: excecao instanceof Error ? excecao.message : undefined, tom: 'danificado' }),
  })

  const arquivar = useMutation({
    mutationFn: () => arquivarAutomacao(automacao!.id, automacao!.arquivada_em === null),
    onSuccess: async () => {
      notificar({ titulo: automacao!.arquivada_em ? 'Automação reativada (desligada)' : 'Automação arquivada', tom: 'perfeito' })
      setConfirmandoArquivar(false)
      await clienteQuery.invalidateQueries({ queryKey: ['automacoes'] })
    },
    onError: (excecao) =>
      notificar({ titulo: 'Não deu certo', descricao: excecao instanceof Error ? excecao.message : undefined, tom: 'danificado' }),
  })

  const blocoSelecionado = selecionado && selecionado !== ID_QUANDO ? estado.blocos.find((b) => b.id === selecionado) : null
  const quantosSoltos = soltos(estado).length
  const naSequencia = sequencia(estado).length

  function titulos(id: string) {
    if (id === ID_QUANDO) {
      const definicao = GATILHOS.find((g) => g.valor === estado.gatilho)
      return { titulo: 'Quando', frase: definicao ? resumoGatilho(estado.gatilho, estado.gatilhoConfig, nomes) : 'Escolha o que dispara', tipo: 'quando' as const }
    }
    const bloco = estado.blocos.find((b) => b.id === id)
    if (!bloco) return { titulo: '', frase: '', tipo: 'mover' as TipoPasso }
    const posicao = sequencia(estado).indexOf(id)
    return {
      titulo: `${posicao >= 0 ? `${posicao + 1}. ` : ''}${ROTULO_PASSO[bloco.passo.tipo]}`,
      frase: resumoPasso(bloco.passo, nomes),
      tipo: bloco.passo.tipo,
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/super-admin/automacoes"
        className="inline-flex min-h-toque-md items-center gap-2 self-start text-sm text-texto-suave hover:text-texto"
      >
        <ArrowLeft aria-hidden className="size-4" /> Voltar às automações
      </Link>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[min(100%,18rem)] flex-1">
          <Campo
            rotulo="Nome da automação"
            value={nome}
            maxLength={80}
            placeholder="Ex.: Peça parada na montagem avisa o líder"
            onChange={(e) => {
              setNome(e.target.value)
              setAlterado(true)
            }}
          />
        </div>
        {automacao && <SeloLigada ligada={automacao.ligada} />}
        <Botao icone={<Save />} carregando={salvar.isPending} disabled={!nome.trim() || !alterado} onClick={() => salvar.mutate()}>
          {alterado ? 'Salvar' : 'Salvo'}
        </Botao>
        {automacao && !automacao.arquivada_em && (
          <BotaoLigar
            id={automacao.id}
            ligada={automacao.ligada}
            desabilitado={alterado ? 'Salve antes de ligar ou desligar' : naSequencia === 0 ? 'Monte pelo menos um passo antes de ligar' : undefined}
          />
        )}
      </div>

      {(quantosSoltos > 0 || (alterado && automacao?.ligada)) && (
        <div className="flex flex-col gap-1 rounded-dm border border-atencao-borda bg-atencao-fundo p-3 text-sm text-atencao-texto">
          {quantosSoltos > 0 && (
            <span>
              {quantosSoltos === 1 ? 'Há 1 bloco solto' : `Há ${quantosSoltos} blocos soltos`} — fora da sequência, não roda. Ligue
              a bolinha da direita de um bloco à esquerda dele.
            </span>
          )}
          {alterado && automacao?.ligada && <span>Esta automação está ligada: as mudanças valem assim que você salvar.</span>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <CanvasAutomacao
          estado={estado}
          aoMudar={mudar}
          selecionado={selecionado}
          aoSelecionar={setSelecionado}
          aoAdicionar={(depoisDe) => setAdicionandoDepois(depoisDe)}
          titulos={titulos}
        />
        <aside className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4" aria-label="Configurar o bloco">
          {selecionado === ID_QUANDO ? (
            <>
              <h2 className="text-lg">Quando</h2>
              <PainelQuando
                gatilho={estado.gatilho}
                config={estado.gatilhoConfig}
                dados={dados}
                automacaoId={automacao?.id ?? null}
                aoMudar={(gatilho, gatilhoConfig) => mudar({ ...estado, gatilho, gatilhoConfig })}
              />
            </>
          ) : blocoSelecionado ? (
            <>
              <h2 className="flex items-center gap-2 text-lg">
                {ICONE_PASSO[blocoSelecionado.passo.tipo]}
                {ROTULO_PASSO[blocoSelecionado.passo.tipo]}
              </h2>
              <PainelPasso
                passo={blocoSelecionado.passo}
                dados={dados}
                segredo={automacao?.segredo ?? null}
                aoMudar={(passo) => mudar(trocarPasso(estado, blocoSelecionado.id, passo))}
                aoRemover={() => {
                  mudar(remover(estado, blocoSelecionado.id))
                  setSelecionado(null)
                }}
              />
            </>
          ) : (
            <div className="flex flex-col gap-3 text-sm text-texto-suave">
              <h2 className="text-lg text-texto">Montar</h2>
              <p>Toque num bloco para configurar. O "+" ao lado de cada bloco põe o próximo já ligado.</p>
              <Botao variante="secundaria" icone={<Plus />} onClick={() => setAdicionandoDepois(sequencia(estado).at(-1) ?? ID_QUANDO)}>
                Pôr um bloco no fim
              </Botao>
            </div>
          )}
        </aside>
      </div>

      {automacao && (
        <div className="flex flex-wrap items-center gap-2">
          {confirmandoArquivar ? (
            <>
              <span className="text-sm text-texto">
                {automacao.arquivada_em ? 'Reativar? Ela volta desligada.' : 'Arquivar? Ela é desligada e sai da lista (o histórico fica).'}
              </span>
              <Botao tamanho="sm" variante="secundaria" carregando={arquivar.isPending} onClick={() => arquivar.mutate()}>
                {automacao.arquivada_em ? 'Sim, reativar' : 'Sim, arquivar'}
              </Botao>
              <Botao tamanho="sm" variante="fantasma" onClick={() => setConfirmandoArquivar(false)}>
                Não
              </Botao>
            </>
          ) : (
            <Botao
              tamanho="sm"
              variante="fantasma"
              icone={automacao.arquivada_em ? <ArchiveRestore /> : <Archive />}
              onClick={() => setConfirmandoArquivar(true)}
            >
              {automacao.arquivada_em ? 'Reativar a automação' : 'Arquivar a automação'}
            </Botao>
          )}
        </div>
      )}

      {automacao && <Execucoes automacaoId={automacao.id} />}

      <Modal
        aberto={adicionandoDepois !== null}
        aoFechar={(aberto) => !aberto && setAdicionandoDepois(null)}
        titulo="Que bloco vem depois?"
        descricao="Ele entra na sequência logo depois do bloco escolhido."
      >
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PASSOS.map((p) => (
            <li key={p.valor}>
              <button
                type="button"
                onClick={() => {
                  const r = inserirDepois(estado, adicionandoDepois ?? ID_QUANDO, passoNovo(p.valor))
                  mudar(r.estado)
                  setSelecionado(r.id)
                  setAdicionandoDepois(null)
                }}
                className={cn(
                  'flex w-full items-start gap-3 rounded-dm border border-borda bg-superficie p-3 text-left transition',
                  'hover:-translate-y-0.5 hover:border-acao-ativa hover:shadow-sm',
                )}
              >
                <span className="mt-0.5 text-texto-suave">{ICONE_PASSO[p.valor]}</span>
                <span className="flex flex-col">
                  <span className="font-medium text-texto">{p.rotulo}</span>
                  <span className="text-xs text-texto-suave">{p.descricao}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}
