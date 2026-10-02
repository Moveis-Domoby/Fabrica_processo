import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowRightLeft,
  Bell,
  CircleCheck,
  CircleDashed,
  ClipboardList,
  Eye,
  LogIn,
  MessageSquare,
  Package,
  Receipt,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Timer,
  Truck,
  Users,
  Workflow,
} from 'lucide-react'
import { Abas, Botao, Campo, Dica, Paginacao, Selecao } from '@/componentes/ui'
import { buscarNomesUsuarios, buscarSetores } from '@/kanban/api'
import { buscarAuditoria, buscarConferencias, type FiltrosAuditoria, type LinhaAuditoria } from '@/auditoria/api'
import {
  GRUPOS_ACAO,
  detalhesDoContexto,
  grupoDaAcao,
  ondeAconteceu,
  rotuloDaAcao,
  rotuloDoMotivo,
  rotuloDosCampos,
  type GrupoAcao,
} from '@/auditoria/rotulos'

const POR_PAGINA = 30
const RODADAS_POR_PAGINA = 10

type Aba = 'atividade' | 'conferencias'
type Periodo = 'hoje' | '7d' | '30d' | 'tudo'

const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7d', rotulo: 'Últimos 7 dias' },
  { valor: '30d', rotulo: 'Últimos 30 dias' },
  { valor: 'tudo', rotulo: 'Desde o começo' },
]

/** O "desde" do período — calculado UMA vez, no gesto (a chave da consulta não pode mudar a cada desenho). */
function desdeDoPeriodo(periodo: Periodo): string | null {
  const agora = new Date()
  if (periodo === 'hoje') {
    const meiaNoite = new Date(agora)
    meiaNoite.setHours(0, 0, 0, 0)
    return meiaNoite.toISOString()
  }
  if (periodo === '7d') return new Date(agora.getTime() - 7 * 86_400_000).toISOString()
  if (periodo === '30d') return new Date(agora.getTime() - 30 * 86_400_000).toISOString()
  return null
}

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const ICONE_GRUPO: Record<GrupoAcao, ReactNode> = {
  entradas: <LogIn aria-hidden className="size-4" />,
  telas: <Eye aria-hidden className="size-4" />,
  movimentacoes: <ArrowRightLeft aria-hidden className="size-4" />,
  execucoes: <Timer aria-hidden className="size-4" />,
  qualidade: <ShieldCheck aria-hidden className="size-4" />,
  pedidos: <Receipt aria-hidden className="size-4" />,
  estoque: <Package aria-hidden className="size-4" />,
  rotas: <Truck aria-hidden className="size-4" />,
  tarefas: <ClipboardList aria-hidden className="size-4" />,
  equipe: <Users aria-hidden className="size-4" />,
  chat: <MessageSquare aria-hidden className="size-4" />,
  avisos: <Bell aria-hidden className="size-4" />,
  automacoes: <Workflow aria-hidden className="size-4" />,
}

/**
 * Painel admin → Auditoria (SESSAO-29 · D-95 ↪️ D-40): o rastro de tudo o que
 * acontece na plataforma — quem, quando, onde, o quê e porquê — e a conferência
 * diária com o Tiny. Cada aba pede ao servidor só a página que mostra (regra 17);
 * a aba das conferências só carrega quando é aberta.
 */
export function Auditoria() {
  const [aba, setAba] = useState<Aba>('atividade')

  return (
    <div className="flex flex-col gap-5">
      <div className="relative flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-2xl sm:text-3xl">
          <ScrollText aria-hidden className="size-7 shrink-0 text-texto-suave" />
          Auditoria
        </h1>
        <Dica rotulo="O que a auditoria mostra">
          <span className="flex flex-col gap-2">
            <span>
              Tudo o que acontece na plataforma fica registrado aqui: quem fez, quando, em que tela ou
              setor, o que fez e, quando houver, o porquê. Entradas, telas abertas, movimentações,
              execuções, qualidade, estoque, ROTAS, tarefas e cadastros.
            </span>
            <span>
              Em "Conferências com o Tiny" fica a conferência de toda madrugada: quantos pedidos foram
              relidos e quais estavam diferentes do Tiny. Os erros das automações (n8n) vão aparecer
              ali também, numa próxima etapa.
            </span>
            <span>Tarefa pessoal privada não aparece aqui — só para quem a criou.</span>
          </span>
        </Dica>
      </div>

      <Abas
        rotulo="O que ver na auditoria"
        idBase="auditoria"
        valor={aba}
        aoMudar={setAba}
        abas={[
          { valor: 'atividade', rotulo: 'Atividade', icone: <Activity aria-hidden className="size-4" /> },
          {
            valor: 'conferencias',
            rotulo: 'Conferências com o Tiny',
            icone: <RefreshCw aria-hidden className="size-4" />,
          },
        ]}
      />

      <div role="tabpanel" id="auditoria-painel" aria-labelledby={`auditoria-aba-${aba}`}>
        {aba === 'atividade' ? <PainelAtividade /> : <PainelConferencias />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Atividade
// ---------------------------------------------------------------------------

function PainelAtividade() {
  const [quem, setQuem] = useState('todos')
  const [tipo, setTipo] = useState<'tudo' | GrupoAcao>('tudo')
  const [periodo, setPeriodo] = useState<Periodo>('7d')
  const [desde, setDesde] = useState<string | null>(() => desdeDoPeriodo('7d'))
  const [textoBusca, setTextoBusca] = useState('')
  const [busca, setBusca] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)

  const { data: nomes } = useQuery({
    queryKey: ['usuarios', 'nomes'],
    queryFn: buscarNomesUsuarios,
    staleTime: 5 * 60_000,
  })
  const { data: setores = [] } = useQuery({ queryKey: ['setores'], queryFn: () => buscarSetores() })

  const filtros: FiltrosAuditoria = useMemo(
    () => ({
      usuarioId: quem === 'todos' || quem === 'sistema' ? null : quem,
      sistema: quem === 'sistema' ? true : null,
      acoes: tipo === 'tudo' ? null : (GRUPOS_ACAO.find((g) => g.valor === tipo)?.acoes ?? null),
      desde,
      busca,
    }),
    [quem, tipo, desde, busca],
  )

  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: ['auditoria', 'atividade', filtros, pagina],
    queryFn: () => buscarAuditoria(filtros, pagina, POR_PAGINA),
    placeholderData: (anterior) => anterior,
  })
  const linhas = data?.linhas ?? []
  const total = data?.total ?? 0

  const opcoesQuem = useMemo(
    () => [
      { valor: 'todos', rotulo: 'Todo mundo' },
      { valor: 'sistema', rotulo: 'Só o Sistema (automático)' },
      ...[...(nomes ?? new Map<string, string>()).entries()]
        .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
        .map(([id, nome]) => ({ valor: id, rotulo: nome })),
    ],
    [nomes],
  )

  function buscar(evento: FormEvent) {
    evento.preventDefault()
    const texto = textoBusca.trim()
    setBusca(texto ? texto : null)
    setPagina(1)
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={buscar}
        className="grid grid-cols-1 gap-3 rounded-dm-lg border border-borda bg-superficie p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Selecao
          rotulo="Quem"
          opcoes={opcoesQuem}
          valor={quem}
          aoMudar={(v) => {
            setQuem(v)
            setPagina(1)
          }}
        />
        <Selecao
          rotulo="Tipo"
          opcoes={[{ valor: 'tudo', rotulo: 'Tudo' }, ...GRUPOS_ACAO.map((g) => ({ valor: g.valor, rotulo: g.rotulo }))]}
          valor={tipo}
          aoMudar={(v) => {
            setTipo(v as 'tudo' | GrupoAcao)
            setPagina(1)
          }}
        />
        <Selecao
          rotulo="Período"
          opcoes={PERIODOS}
          valor={periodo}
          aoMudar={(v) => {
            setPeriodo(v as Periodo)
            setDesde(desdeDoPeriodo(v as Periodo))
            setPagina(1)
          }}
        />
        <div className="flex items-end gap-2">
          <Campo
            rotulo="Buscar"
            placeholder="Nº do pedido, tela, SKU…"
            value={textoBusca}
            onChange={(e) => setTextoBusca(e.target.value)}
            maxLength={120}
          />
          <Botao type="submit" variante="secundaria" aria-label="Fazer a busca" className="shrink-0">
            <Search aria-hidden className="size-4" />
          </Botao>
        </div>
      </form>

      {isError ? (
        <p className="rounded-dm-lg border border-danificado-forte bg-superficie p-4 text-sm text-danificado-forte">
          {error instanceof Error ? error.message : 'Não deu para carregar a auditoria.'}
        </p>
      ) : isPending ? (
        <p className="text-sm text-texto-suave">Carregando…</p>
      ) : total === 0 ? (
        <p className="rounded-dm-lg border border-borda bg-superficie p-5 text-sm text-texto-suave">
          Nada registrado com esses filtros.
        </p>
      ) : (
        <>
          <p className="text-sm text-texto-suave" aria-live="polite">
            <strong className="text-texto tabular-nums">{total.toLocaleString('pt-BR')}</strong>{' '}
            {total === 1 ? 'registro' : 'registros'}
            {isFetching ? ' · atualizando…' : ''}
          </p>
          <ul className="flex flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie">
            {linhas.map((linha) => (
              <ItemAtividade key={linha.id} linha={linha} setores={setores} />
            ))}
          </ul>
          {total > POR_PAGINA && (
            <Paginacao
              paginaAtual={pagina}
              totalPaginas={Math.ceil(total / POR_PAGINA)}
              totalItens={total}
              porPagina={POR_PAGINA}
              aoMudarPagina={setPagina}
              className="rounded-dm-lg border border-borda bg-superficie"
            />
          )}
        </>
      )}
    </div>
  )
}

function ItemAtividade({ linha, setores }: { linha: LinhaAuditoria; setores: { codigo: string; nome: string }[] }) {
  const grupo = grupoDaAcao(linha.acao)
  const onde = ondeAconteceu(linha, setores)
  const detalhes = detalhesDoContexto(linha.contexto)
  const quem = linha.usuario_nome ?? (linha.usuario_id ? 'Pessoa sem cadastro' : 'Sistema')

  return (
    <li className="flex flex-col gap-1 border-b border-borda px-4 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="flex min-w-0 items-center gap-2 font-medium text-texto">
          <span className="shrink-0 self-center text-texto-fraco">
            {grupo ? ICONE_GRUPO[grupo] : <Activity aria-hidden className="size-4" />}
          </span>
          <span className="min-w-0 break-words">
            {rotuloDaAcao(linha.acao)}
            {linha.pedido_numero !== null && (
              <span className="text-texto-suave"> · pedido {linha.pedido_numero}</span>
            )}
          </span>
        </span>
        <time dateTime={linha.criado_em} className="ml-auto shrink-0 text-xs text-texto-fraco tabular-nums">
          {quando(linha.criado_em)}
        </time>
      </div>
      <p className="min-w-0 break-words text-sm text-texto-suave">
        <span className="font-medium text-texto">{quem}</span>
        {onde && <> · {onde}</>}
      </p>
      {linha.motivo && (
        <p className="min-w-0 break-words text-sm text-texto">
          <span className="font-medium">Por quê:</span> {linha.motivo}
        </p>
      )}
      {detalhes.length > 0 && (
        <details className="text-sm">
          <summary className="flex min-h-toque-md cursor-pointer items-center text-texto-suave hover:text-texto">
            Detalhes
          </summary>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 pb-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
            {detalhes.map((d) => (
              <div key={d.rotulo} className="contents">
                <dt className="text-texto-fraco">{d.rotulo}</dt>
                <dd className="min-w-0 break-words text-texto">{d.valor}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Conferências com o Tiny (a conferência diária — SESSAO-29)
// ---------------------------------------------------------------------------

function PainelConferencias() {
  const [pagina, setPagina] = useState(1)
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['auditoria', 'conferencias', pagina],
    queryFn: () => buscarConferencias(pagina, RODADAS_POR_PAGINA),
    placeholderData: (anterior) => anterior,
  })

  if (isError) {
    return (
      <p className="rounded-dm-lg border border-danificado-forte bg-superficie p-4 text-sm text-danificado-forte">
        {error instanceof Error ? error.message : 'Não deu para carregar as conferências.'}
      </p>
    )
  }
  if (isPending || !data) return <p className="text-sm text-texto-suave">Carregando…</p>

  const agora = data.em_andamento
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Conferência agora"
        className="flex flex-col gap-1 rounded-dm-lg border border-borda bg-superficie p-4"
      >
        {agora ? (
          <>
            <p className="flex items-center gap-2 font-medium text-texto">
              <CircleDashed aria-hidden className="size-4 animate-spin text-acao-ativa" />
              Conferência em andamento — {rotuloDoMotivo(agora.motivo).toLowerCase()}
            </p>
            <p className="text-sm text-texto-suave">
              {agora.lidos} de {agora.na_fila} pedidos relidos
              {agora.mudaram > 0 ? ` · ${agora.mudaram} diferentes do Tiny até agora` : ''}
              {agora.inicio ? ` · começou ${quando(agora.inicio)}` : ''}
            </p>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-texto">
            <CircleCheck aria-hidden className="size-4 text-perfeito-forte" />
            {data.agendada === false
              ? 'Nenhuma conferência rodando — e a conferência da madrugada está desligada.'
              : 'Nenhuma conferência rodando agora. A próxima é às 3h da madrugada.'}
          </p>
        )}
      </section>

      {data.total === 0 ? (
        <p className="rounded-dm-lg border border-borda bg-superficie p-5 text-sm text-texto-suave">
          Nenhuma conferência terminou ainda. A primeira aparece aqui assim que acabar.
        </p>
      ) : (
        <>
          <ul className="flex flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie">
            {data.rodadas.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 border-b border-borda px-4 py-3 last:border-b-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-medium text-texto">{rotuloDoMotivo(r.motivo)}</span>
                  {r.estado === 'interrompida' && (
                    <span className="rounded-dm border border-atencao-forte px-1.5 text-xs font-medium text-atencao-forte">
                      Interrompida — {r.pendentes} ficaram na fila
                    </span>
                  )}
                  <time dateTime={r.fim} className="ml-auto text-xs text-texto-fraco tabular-nums">
                    {r.inicio ? `${quando(r.inicio)} → ` : ''}
                    {quando(r.fim)}
                  </time>
                </div>
                <p className="text-sm text-texto-suave">
                  <strong className="text-texto tabular-nums">{r.relidos}</strong> pedidos relidos ·{' '}
                  <strong className="text-texto tabular-nums">{r.mudaram}</strong>{' '}
                  {r.mudaram === 1 ? 'estava diferente do Tiny' : 'estavam diferentes do Tiny'}
                  {r.novos > 0 ? ` · ${r.novos} não tinham chegado aqui` : ''}
                  {r.nao_encontrados > 0 ? ` · ${r.nao_encontrados} não encontrados no Tiny` : ''}
                  {r.falhas > 0 ? ` · ${r.falhas} com erro` : ''}
                </p>
                {r.pedidos.length > 0 && (
                  <details className="text-sm">
                    <summary className="flex min-h-toque-md cursor-pointer items-center text-texto-suave hover:text-texto">
                      Ver os pedidos que estavam diferentes
                    </summary>
                    <ul className="flex flex-col gap-0.5 pb-1">
                      {r.pedidos.map((p) => (
                        <li key={p.numero} className="min-w-0 break-words text-texto">
                          <span className="font-medium tabular-nums">Pedido {p.numero}</span>
                          <span className="text-texto-suave"> — {rotuloDosCampos(p.campos)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
          {data.total > RODADAS_POR_PAGINA && (
            <Paginacao
              paginaAtual={pagina}
              totalPaginas={Math.ceil(data.total / RODADAS_POR_PAGINA)}
              totalItens={data.total}
              porPagina={RODADAS_POR_PAGINA}
              aoMudarPagina={setPagina}
              className="rounded-dm-lg border border-borda bg-superficie"
            />
          )}
        </>
      )}
    </div>
  )
}
