import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CirclePause,
  CirclePlay,
  History,
  Plus,
  Save,
  Trash2,
  Workflow,
  X,
} from 'lucide-react'
import { Botao, Dica, Modal, Paginacao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { FiltroPill } from '@/dashboards/componentes/Filtros'
import { buscarEtapasAtivas, buscarSetores } from '@/kanban/api'
import { usuariosAtivos } from '@/metas/api'
import { useCampos, useEtiquetas } from '@/utilitarios/consultas'
import {
  POR_PAGINA_AUTOMACOES,
  arquivarAutomacao,
  buscarAutomacao,
  excluirAutomacao,
  ligarAutomacao,
  listarAutomacoes,
  salvarAutomacao,
} from '@/automacoes/api'
import type { Automacao, AutomacaoResumo } from '@/automacoes/api'
import { GATILHOS, GRUPOS_PASSO, PASSOS, ROTULO_PASSO, ROTULO_SITUACAO_EXECUCAO } from '@/automacoes/catalogo'
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
import type { EstadoDesenho, Passo, Saida } from '@/automacoes/desenho'
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
      <FiltroPill
        rotulo="Mostrar"
        opcoes={[
          { valor: 'ativas', rotulo: 'Ativas' },
          { valor: 'arquivadas', rotulo: 'Arquivadas' },
        ]}
        valor={arquivadas ? 'arquivadas' : 'ativas'}
        aoMudar={(v) => {
          setArquivadas(v === 'arquivadas')
          setPagina(1)
        }}
      />
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
        <Botao variante={ligada ? 'secundaria' : 'primaria'} carregando={mutacao.isPending} onClick={() => mutacao.mutate()}>
          {ligada ? 'Sim, desligar' : 'Sim, ligar'}
        </Botao>
        <Botao variante="fantasma" onClick={() => setConfirmando(false)}>
          Não
        </Botao>
      </span>
    )
  return (
    <Botao
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
// O editor — uma ÁREA DE TRABALHO em tela cheia (pedido do dono, 02/10: "sempre
// que eu clicar para entrar no canvas, deve abrir uma área de workflow com foco
// no trabalho … apenas na parte superior, um botão de salvar, publicar …, fecha
// inclusive o menu esquerdo"). A casca (Layout) tira o menu; aqui: a barra fina
// no topo, o canvas no resto, e as gavetas da direita (o bloco, o histórico).
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
      <div className="flex flex-col gap-3 p-4">
        <Link to="/super-admin/automacoes" className="inline-flex min-h-toque-md items-center gap-2 text-sm text-texto-suave">
          <ArrowLeft aria-hidden className="size-4" /> Voltar às automações
        </Link>
        <p className="rounded-dm border border-danificado-forte bg-danificado-fundo p-3 text-sm text-danificado-texto">
          {(consulta.error as Error).message}
        </p>
      </div>
    )
  if (!consulta.data) return <p className="p-4 text-sm text-texto-fraco">Carregando…</p>
  // a chave muda quando outra automação abre (ou volta salva) → o editor nasce de novo com o estado dela
  return <Editor key={`${consulta.data.id}-${consulta.data.atualizada_em}`} automacao={consulta.data} />
}

type Gaveta = 'bloco' | null

function Editor({ automacao }: { automacao: Automacao | null }) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [, setParametros] = useSearchParams()
  const { dados, nomes } = useDadosAutomacao()
  const [nome, setNome] = useState(automacao?.nome ?? '')
  const [estado, setEstado] = useState<EstadoDesenho>(() => (automacao ? montarDesenho(automacao) : desenhoNovo()))
  const [selecionado, setSelecionado] = useState<string | null>(automacao ? null : ID_QUANDO)
  const [gaveta, setGaveta] = useState<Gaveta>(automacao ? null : 'bloco')
  // Como no n8n: as execuções ficam escondidas até clicar em "Execuções" lá em cima.
  const [vista, setVista] = useState<'editor' | 'execucoes'>('editor')
  const [alterado, setAlterado] = useState(automacao === null)
  // onde entra o bloco novo: depois de qual bloco (e, no "Se… senão", em qual caminho)
  const [adicionandoDepois, setAdicionandoDepois] = useState<{ de: string; saida?: Saida } | null>(null)
  const [confirmando, setConfirmando] = useState<'publicar' | 'desligar' | 'arquivar' | 'excluir' | null>(null)

  function mudar(novo: EstadoDesenho) {
    setEstado(novo)
    setAlterado(true)
  }

  function selecionar(id: string | null) {
    setSelecionado(id)
    setGaveta(id ? 'bloco' : null)
  }

  async function gravar(): Promise<number> {
    const { passos, desenho } = paraGuardar(estado)
    return salvarAutomacao({
      id: automacao?.id ?? null,
      nome: nome.trim(),
      gatilho: estado.gatilho,
      gatilhoConfig: estado.gatilhoConfig,
      passos,
      desenho,
    })
  }

  const salvar = useMutation({
    mutationFn: gravar,
    onSuccess: async (idSalvo) => {
      notificar({ titulo: automacao ? 'Automação salva' : 'Automação criada — desligada até você publicar', tom: 'perfeito' })
      setAlterado(false)
      await clienteQuery.invalidateQueries({ queryKey: ['automacoes'] })
      if (!automacao) setParametros({ a: String(idSalvo) }, { replace: true })
    },
    onError: (excecao) =>
      notificar({ titulo: 'Não deu para salvar', descricao: excecao instanceof Error ? excecao.message : undefined, tom: 'danificado' }),
  })

  // Publicar = salvar o que mudou E ligar (como no n8n); desligar só desliga.
  const publicar = useMutation({
    mutationFn: async (ligar: boolean) => {
      let id = automacao?.id ?? null
      if (ligar && (alterado || id === null)) id = await gravar()
      await ligarAutomacao(id!, ligar)
      return id!
    },
    onSuccess: async (idSalvo, ligar) => {
      notificar({ titulo: ligar ? 'Publicada — a automação está ligada e já age sozinha' : 'Automação desligada', tom: 'perfeito' })
      setConfirmando(null)
      setAlterado(false)
      await clienteQuery.invalidateQueries({ queryKey: ['automacoes'] })
      if (!automacao) setParametros({ a: String(idSalvo) }, { replace: true })
    },
    onError: (excecao) => {
      setConfirmando(null)
      notificar({ titulo: 'Não deu certo', descricao: excecao instanceof Error ? excecao.message : undefined, tom: 'danificado' })
    },
  })

  const arquivar = useMutation({
    mutationFn: () => arquivarAutomacao(automacao!.id, automacao!.arquivada_em === null),
    onSuccess: async () => {
      notificar({ titulo: automacao!.arquivada_em ? 'Automação reativada (desligada)' : 'Automação arquivada', tom: 'perfeito' })
      setConfirmando(null)
      await clienteQuery.invalidateQueries({ queryKey: ['automacoes'] })
    },
    onError: (excecao) =>
      notificar({ titulo: 'Não deu certo', descricao: excecao instanceof Error ? excecao.message : undefined, tom: 'danificado' }),
  })

  // Excluir = some de vez; o que ela fez fica na Auditoria, marcado "automação excluída"
  const excluir = useMutation({
    mutationFn: () => excluirAutomacao(automacao!.id),
    onSuccess: async () => {
      notificar({ titulo: 'Automação excluída', descricao: 'O que ela fez continua na Auditoria.', tom: 'perfeito' })
      setConfirmando(null)
      await clienteQuery.invalidateQueries({ queryKey: ['automacoes'] })
      setParametros({}, { replace: true })
    },
    onError: (excecao) => {
      setConfirmando(null)
      notificar({ titulo: 'Não deu para excluir', descricao: excecao instanceof Error ? excecao.message : undefined, tom: 'danificado' })
    },
  })

  const blocoSelecionado = selecionado && selecionado !== ID_QUANDO ? estado.blocos.find((b) => b.id === selecionado) : null
  const quantosSoltos = soltos(estado).length
  const naSequencia = sequencia(estado).length
  const ligada = automacao?.ligada ?? false
  const arquivada = Boolean(automacao?.arquivada_em)

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

  const gavetaAberta = gaveta === 'bloco' && (selecionado === ID_QUANDO || Boolean(blocoSelecionado))

  return (
    <div className="flex h-full flex-col">
      {/* A barra do topo: o único "menu" da área de trabalho */}
      <header className="flex flex-wrap items-center gap-2 border-b border-borda bg-superficie px-2 py-2 sm:px-3">
        <Link
          to="/super-admin/automacoes"
          aria-label="Sair do editor e voltar às automações"
          title="Voltar às automações"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-dm text-texto hover:bg-superficie-sutil"
        >
          <ArrowLeft aria-hidden className="size-5" />
        </Link>
        <Workflow aria-hidden className="hidden size-5 shrink-0 text-texto-suave sm:block" />
        <input
          aria-label="Nome da automação"
          value={nome}
          maxLength={80}
          placeholder="Dê um nome à automação"
          onChange={(e) => {
            setNome(e.target.value)
            setAlterado(true)
          }}
          className="h-11 min-w-40 flex-1 rounded-dm border border-transparent bg-transparent px-2 text-base font-semibold text-texto hover:border-borda focus:border-borda-forte sm:max-w-md"
        />
        {automacao && <SeloLigada ligada={ligada} />}
        {alterado && <span className="text-xs text-texto-suave">não salvo</span>}
        {automacao && (
          <span role="tablist" aria-label="O que ver" className="flex rounded-dm border border-borda bg-superficie-sutil p-0.5">
            {(['editor', 'execucoes'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={vista === v}
                onClick={() => {
                  setVista(v)
                  if (v === 'execucoes') selecionar(null)
                }}
                className={cn(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-[0.45rem] px-3 text-sm font-medium transition',
                  vista === v ? 'bg-superficie text-texto shadow-sm' : 'text-texto-suave hover:text-texto',
                )}
              >
                {v === 'editor' ? <Workflow aria-hidden className="size-4" /> : <History aria-hidden className="size-4" />}
                {v === 'editor' ? 'Editor' : 'Execuções'}
              </button>
            ))}
          </span>
        )}

        <span className="ml-auto flex flex-wrap items-center gap-2">
          {confirmando ? (
            <span className="flex flex-wrap items-center gap-2 rounded-dm border border-borda bg-superficie-sutil px-2 py-1">
              <span className="text-sm text-texto">
                {confirmando === 'publicar' && 'Publicar? Ela é salva e LIGADA — passa a agir sozinha.'}
                {confirmando === 'desligar' && 'Desligar? Ela para de agir.'}
                {confirmando === 'arquivar' && (arquivada ? 'Reativar? Ela volta desligada.' : 'Arquivar? Ela é desligada e sai da lista.')}
                {confirmando === 'excluir' && 'Excluir de vez? Ela some; o que ela fez fica na Auditoria.'}
              </span>
              <Botao
                variante={confirmando === 'publicar' ? 'primaria' : confirmando === 'excluir' ? 'perigo' : 'secundaria'}
                carregando={publicar.isPending || arquivar.isPending || excluir.isPending}
                onClick={() =>
                  confirmando === 'excluir'
                    ? excluir.mutate()
                    : confirmando === 'arquivar'
                      ? arquivar.mutate()
                      : publicar.mutate(confirmando === 'publicar')
                }
              >
                {confirmando === 'publicar'
                  ? 'Sim, publicar'
                  : confirmando === 'desligar'
                    ? 'Sim, desligar'
                    : confirmando === 'excluir'
                      ? 'Sim, excluir'
                      : arquivada
                        ? 'Sim, reativar'
                        : 'Sim, arquivar'}
              </Botao>
              <Botao variante="fantasma" onClick={() => setConfirmando(null)}>
                Não
              </Botao>
            </span>
          ) : (
            <>
              {automacao && (
                <Botao
                  variante="fantasma"
                  icone={arquivada ? <ArchiveRestore /> : <Archive />}
                  aria-label={arquivada ? 'Reativar a automação' : 'Arquivar a automação'}
                  title={arquivada ? 'Reativar' : 'Arquivar'}
                  onClick={() => setConfirmando('arquivar')}
                />
              )}
              {automacao && (
                <Botao
                  variante="fantasma"
                  icone={<Trash2 />}
                  aria-label="Excluir a automação"
                  title="Excluir"
                  onClick={() => setConfirmando('excluir')}
                />
              )}
              <Botao
                variante="secundaria"
                icone={<Save />}
                carregando={salvar.isPending}
                disabled={!nome.trim() || !alterado}
                onClick={() => salvar.mutate()}
              >
                {alterado ? 'Salvar' : 'Salvo'}
              </Botao>
              {!arquivada &&
                (ligada ? (
                  <Botao variante="secundaria" icone={<CirclePause />} onClick={() => setConfirmando('desligar')}>
                    Desligar
                  </Botao>
                ) : (
                  <Botao
                   
                    icone={<CirclePlay />}
                    disabled={!nome.trim() || naSequencia === 0}
                    title={naSequencia === 0 ? 'Monte pelo menos um passo antes de publicar' : 'Salva e liga a automação'}
                    onClick={() => setConfirmando('publicar')}
                  >
                    Publicar
                  </Botao>
                ))}
            </>
          )}
        </span>
      </header>

      {/* A área de trabalho: o canvas no resto da tela; as gavetas por cima, à direita */}
      {vista === 'execucoes' && automacao ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto w-full max-w-4xl">
            <Execucoes automacaoId={automacao.id} />
          </div>
        </div>
      ) : (
      <div className="relative min-h-0 flex-1">
        <CanvasAutomacao
          cheio
          estado={estado}
          aoMudar={mudar}
          selecionado={selecionado}
          aoSelecionar={selecionar}
          aoAdicionar={(de, saida) => setAdicionandoDepois({ de, saida })}
          titulos={titulos}
        />

        {/* Avisos que flutuam no canto (não roubam espaço do desenho) */}
        <div className="pointer-events-none absolute left-3 top-3 flex max-w-[min(26rem,calc(100%-1.5rem))] flex-col gap-2">
          {quantosSoltos > 0 && (
            <p className="pointer-events-auto rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-xs text-atencao-texto shadow-sm">
              {quantosSoltos === 1 ? '1 bloco solto' : `${quantosSoltos} blocos soltos`} — fora da sequência, não roda. Ligue a bolinha da
              direita de um bloco à esquerda dele.
            </p>
          )}
          {alterado && ligada && (
            <p className="pointer-events-auto rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-xs text-atencao-texto shadow-sm">
              Esta automação está ligada: as mudanças valem assim que você salvar.
            </p>
          )}
          {!gavetaAberta && naSequencia === 0 && (
            <p className="pointer-events-auto rounded-dm border border-borda bg-superficie px-3 py-2 text-xs text-texto-suave shadow-sm">
              Toque no QUANDO para escolher o que dispara; o "+" ao lado dele põe o primeiro passo.
            </p>
          )}
        </div>

        {gavetaAberta && (
          <aside
            aria-label="Configurar o bloco"
            onKeyDown={(e) => {
              if (e.key === 'Escape') selecionar(null)
            }}
            className="absolute inset-y-0 right-0 z-10 flex w-full flex-col border-l border-borda bg-superficie shadow-xl sm:w-[26rem]"
          >
            <div className="flex items-center gap-2 border-b border-borda px-4 py-2">
              <h2 className="flex flex-1 items-center gap-2 text-lg">
                {selecionado === ID_QUANDO
                    ? 'Quando'
                    : blocoSelecionado && (
                        <>
                          {ICONE_PASSO[blocoSelecionado.passo.tipo]}
                          {ROTULO_PASSO[blocoSelecionado.passo.tipo]}
                        </>
                      )}
              </h2>
              <button
                type="button"
                aria-label="Fechar a gaveta"
                onClick={() => {
                  setSelecionado(null)
                  setGaveta(null)
                }}
                className="inline-flex size-11 items-center justify-center rounded-dm text-texto-suave hover:bg-superficie-sutil"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {selecionado === ID_QUANDO ? (
                <PainelQuando
                  gatilho={estado.gatilho}
                  config={estado.gatilhoConfig}
                  dados={dados}
                  automacaoId={automacao?.id ?? null}
                  aoMudar={(gatilho, gatilhoConfig) => mudar({ ...estado, gatilho, gatilhoConfig })}
                />
              ) : (
                blocoSelecionado && (
                  <PainelPasso
                    passo={blocoSelecionado.passo}
                    dados={dados}
                    segredo={automacao?.segredo ?? null}
                    aoMudar={(passo) => mudar(trocarPasso(estado, blocoSelecionado.id, passo))}
                    aoRemover={() => {
                      mudar(remover(estado, blocoSelecionado.id))
                      selecionar(null)
                    }}
                  />
                )
              )}
            </div>
          </aside>
        )}
      </div>
      )}

      <Modal
        aberto={adicionandoDepois !== null}
        aoFechar={(aberto) => !aberto && setAdicionandoDepois(null)}
        tamanho="galpao"
        titulo={
          adicionandoDepois?.saida
            ? `Que bloco vem no caminho ${adicionandoDepois.saida === 'sim' ? 'Sim' : 'Senão'}?`
            : 'Que bloco vem depois?'
        }
        descricao={
          adicionandoDepois?.saida
            ? `Ele entra no caminho ${adicionandoDepois.saida === 'sim' ? 'Sim' : 'Senão'}, logo depois do bloco escolhido.`
            : 'Ele entra na sequência logo depois do bloco escolhido.'
        }
      >
        <div className="flex flex-col gap-5">
          {GRUPOS_PASSO.map((grupo) => (
            <section key={grupo} aria-labelledby={`grupo-${grupo}`} className="flex flex-col gap-2">
              <h3 id={`grupo-${grupo}`} className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                {grupo}
              </h3>
              <ul className="grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-3">
                {PASSOS.filter((p) => p.grupo === grupo).map((p) => (
                  <li key={p.valor}>
                    <button
                      type="button"
                      onClick={() => {
                        const r = inserirDepois(estado, adicionandoDepois?.de ?? ID_QUANDO, passoNovo(p.valor), adicionandoDepois?.saida)
                        mudar(r.estado)
                        selecionar(r.id)
                        setAdicionandoDepois(null)
                      }}
                      className="flex h-full w-full items-start gap-3 rounded-dm border border-borda bg-superficie p-3 text-left transition hover:border-acao-ativa hover:bg-superficie-sutil"
                    >
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-dm bg-superficie-sutil text-texto">
                        {ICONE_PASSO[p.valor]}
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-semibold text-texto">{p.rotulo}</span>
                        <span className="line-clamp-3 text-xs leading-snug text-texto-suave">{p.descricao}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Modal>
    </div>
  )
}
