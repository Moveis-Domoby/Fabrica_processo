import { useMemo, useState } from 'react'
import { Navigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Clock, Search, Wrench, XOctagon } from 'lucide-react'
import {
  BadgeEstado,
  Botao,
  Campo,
  DESCRICAO_ESTADO,
  ESTADOS_QUALIDADE,
  Modal,
  Paginacao,
  ROTULO_ESTADO,
  Selecao,
  useNotificacao,
} from '@/componentes/ui'
import type { Estado } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { buscarEtapasAtivas } from '@/kanban/api'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { useAcessoLogistica } from '@/logistica/acesso'
import { arquivarCard, listarDanificados, resolverDanificado } from '@/logistica/api'
import type { Danificado } from '@/logistica/api'

const POR_PAGINA = 20
const ATUALIZA_A_CADA = 30_000

function dataHora(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'
}

/**
 * Logística → Danificados (SESSAO-15 / D-38 / D-45): tudo que está na etapa
 * DANIFICADO de qualquer setor, com a origem, o relato da marcação (quem
 * entregou marcou o quê, quem recebeu concordou ou não) e o tempo parado.
 * Ações: RESOLVIDO → destino (Estoque, ROTAS ou qualquer setor — para outro
 * setor a marcação do estado é obrigatória) ou ARQUIVAR (sai da lista, fica
 * na história). Os arquivados só são carregados quando alguém pede.
 */
export function Danificados() {
  const { perfil, semAcesso, tenhoAcesso, setores } = useAcessoLogistica()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora()

  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [resolvendo, setResolvendo] = useState<Danificado | null>(null)
  const [arquivando, setArquivando] = useState<Danificado | null>(null)
  const [mostrarArquivados, setMostrarArquivados] = useState(false)
  const [paginaArquivados, setPaginaArquivados] = useState(1)

  const { data: linhas = [], isPending } = useQuery({
    queryKey: ['danificados', false, busca, pagina],
    queryFn: () =>
      listarDanificados({ busca, limite: POR_PAGINA, deslocamento: (pagina - 1) * POR_PAGINA }),
    enabled: tenhoAcesso,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const total = Number(linhas[0]?.contagem_total ?? 0)

  // D-45: os arquivados só saem do banco quando o botão é clicado.
  const { data: arquivados = [], isPending: carregandoArquivados } = useQuery({
    queryKey: ['danificados', true, busca, paginaArquivados],
    queryFn: () =>
      listarDanificados({
        arquivados: true,
        busca,
        limite: POR_PAGINA,
        deslocamento: (paginaArquivados - 1) * POR_PAGINA,
      }),
    enabled: tenhoAcesso && mostrarArquivados,
  })
  const totalArquivados = Number(arquivados[0]?.contagem_total ?? 0)

  async function invalidar() {
    await Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['danificados'] }),
      clienteQuery.invalidateQueries({ queryKey: ['estoque'] }),
      clienteQuery.invalidateQueries({ queryKey: ['pedidos-aguardo'] }),
      clienteQuery.invalidateQueries({ queryKey: ['cards'] }),
    ])
  }

  const arquivarMutacao = useMutation({
    mutationFn: (item: Danificado) => arquivarCard(item.card_id),
    onSuccess: async (_dados, item) => {
      notificar({ titulo: `Peça do pedido ${item.numero} arquivada`, tom: 'perfeito' })
      setArquivando(null)
      await invalidar()
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para arquivar',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  if (semAcesso) return <Navigate to="/" replace />
  if (!perfil) return null

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-3 text-2xl sm:text-3xl">
          <XOctagon aria-hidden className="size-7 text-danificado-forte" />
          Danificados
        </h1>
        <p className="mt-1 max-w-2xl text-texto-suave">
          Tudo que está em DANIFICADO, em qualquer setor, com quem marcou o quê. Resolvido → escolha
          o destino (a peça volta ao fluxo); sem conserto → arquive. Nada some da história.
        </p>
      </div>

      <div className="max-w-md">
        <Campo
          rotulo="Buscar"
          prefixo={<Search />}
          placeholder="Número do pedido, produto ou setor"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
            setPagina(1)
            setPaginaArquivados(1)
          }}
        />
      </div>

      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {!isPending && linhas.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nenhuma peça em DANIFICADO{busca ? ' para esta busca' : ''} agora.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {linhas.map((item) => (
          <CartaoDanificado
            key={item.card_id}
            item={item}
            agora={agora}
            acoes={
              arquivando?.card_id === item.card_id ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-texto-suave">Arquivar esta peça sem conserto?</span>
                  <Botao
                    variante="perigo"
                    tamanho="sm"
                    carregando={arquivarMutacao.isPending}
                    onClick={() => arquivarMutacao.mutate(item)}
                  >
                    Sim, arquivar
                  </Botao>
                  <Botao variante="fantasma" tamanho="sm" onClick={() => setArquivando(null)}>
                    Não
                  </Botao>
                </span>
              ) : (
                <>
                  <Botao icone={<Wrench />} onClick={() => setResolvendo(item)}>
                    Resolvido →
                  </Botao>
                  <Botao
                    variante="secundaria"
                    icone={<Archive />}
                    onClick={() => setArquivando(item)}
                  >
                    Arquivar
                  </Botao>
                </>
              )
            }
          />
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

      {/* Arquivados: carregados só ao clicar (D-45). */}
      <section className="flex flex-col gap-3 border-t border-borda pt-4">
        {!mostrarArquivados ? (
          <div>
            <Botao
              variante="secundaria"
              icone={<Archive />}
              onClick={() => setMostrarArquivados(true)}
            >
              Visualizar arquivados
            </Botao>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg">Arquivados</h2>
              <Botao variante="fantasma" tamanho="sm" onClick={() => setMostrarArquivados(false)}>
                Esconder
              </Botao>
            </div>
            {carregandoArquivados && <p className="text-sm text-texto-fraco">Carregando…</p>}
            {!carregandoArquivados && arquivados.length === 0 && (
              <p className="text-sm text-texto-suave">Nenhuma peça arquivada.</p>
            )}
            <ul className="flex flex-col gap-3">
              {arquivados.map((item) => (
                <CartaoDanificado key={item.card_id} item={item} agora={agora} />
              ))}
            </ul>
            {totalArquivados > POR_PAGINA && (
              <Paginacao
                paginaAtual={paginaArquivados}
                totalPaginas={Math.ceil(totalArquivados / POR_PAGINA)}
                totalItens={totalArquivados}
                porPagina={POR_PAGINA}
                aoMudarPagina={setPaginaArquivados}
                className="rounded-dm-lg border border-borda bg-superficie"
              />
            )}
          </>
        )}
      </section>

      {resolvendo && (
        <ModalResolver
          key={resolvendo.card_id}
          item={resolvendo}
          setores={setores}
          aoFechar={() => setResolvendo(null)}
          aoResolvido={async () => {
            setResolvendo(null)
            await invalidar()
          }}
        />
      )}
    </div>
  )
}

function CartaoDanificado({
  item,
  agora,
  acoes,
}: {
  item: Danificado
  agora: number
  acoes?: React.ReactNode
}) {
  const arquivado = item.arquivado_em !== null
  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-dm-lg border bg-superficie p-4',
        arquivado ? 'border-borda opacity-80' : 'border-danificado-borda',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-texto">{item.item_descricao ?? 'Sem descrição'}</span>
        {item.indice_unidade !== null && (
          <span className="text-sm text-texto-suave tabular-nums">
            ({item.indice_unidade}/{item.total_unidades})
          </span>
        )}
        <span className="text-sm text-texto-suave tabular-nums">· Pedido {item.numero}</span>
        <span className="ml-auto rounded-full bg-superficie-sutil px-2.5 py-0.5 text-sm font-medium text-texto-suave">
          {item.setor_nome} · {item.etapa_nome}
        </span>
      </div>

      {/* O relato da D-09: quem entregou marcou o quê, quem recebeu disse o quê. */}
      <div className="flex flex-col gap-1 rounded-dm bg-superficie-sutil px-3 py-2 text-sm">
        {item.marcacao_estado ? (
          <p className="flex flex-wrap items-center gap-2 text-texto">
            <span className="text-texto-suave">
              {item.origem_setor_nome ?? 'Setor'} entregou como
            </span>
            <BadgeEstado estado={item.marcacao_estado} tamanho="sm" />
            <span className="text-texto-suave">
              por {item.marcacao_por ?? '—'} · {dataHora(item.marcado_em)}
            </span>
          </p>
        ) : (
          <p className="text-texto-suave">Sem marcação de entrega registrada.</p>
        )}
        {item.marcacao_obs && <p className="text-texto">“{item.marcacao_obs}”</p>}
        {item.parecer_estado && (
          <p className="flex flex-wrap items-center gap-2 text-texto">
            <span className="text-texto-suave">{item.setor_nome} recebeu como</span>
            <BadgeEstado estado={item.parecer_estado} tamanho="sm" />
            <span className="text-texto-suave">por {item.parecer_por ?? '—'}</span>
            {item.parecer_obs && <span className="text-texto">“{item.parecer_obs}”</span>}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm text-texto-suave tabular-nums">
          <Clock aria-hidden className="size-4" />
          {arquivado ? `arquivada em ${dataHora(item.arquivado_em)}` : `parada há ${formatarDuracao(item.desde, agora)}`}
        </span>
        {acoes && <span className="ml-auto flex flex-wrap gap-2">{acoes}</span>}
      </div>
    </li>
  )
}

/**
 * Resolvido → destino. Para OUTRO setor, o estado da peça é obrigatório
 * (ela pode sair 🟡 ou 🔴 mesmo — D-45); no mesmo setor é só voltar a uma
 * etapa dele. Mesmo padrão de 3 botões-rádio empilhados da marcação (M-12).
 */
function ModalResolver({
  item,
  setores,
  aoFechar,
  aoResolvido,
}: {
  item: Danificado
  setores: { id: number; nome: string; codigo: string; papel_no_fluxo: string; ativo: boolean }[]
  aoFechar: () => void
  aoResolvido: () => Promise<void>
}) {
  const notificar = useNotificacao()
  const [setorId, setSetorId] = useState<string>('')
  const [etapaId, setEtapaId] = useState<string>('chegada')
  const [estado, setEstado] = useState<Estado | null>(null)
  const [observacao, setObservacao] = useState('')

  const { data: etapas = [] } = useQuery({
    queryKey: ['etapas-ativas'],
    queryFn: buscarEtapasAtivas,
  })

  const opcoesSetor = useMemo(
    () =>
      setores
        .filter((s) => s.ativo && s.papel_no_fluxo !== 'entrada')
        .map((s) => ({ valor: String(s.id), rotulo: s.nome })),
    [setores],
  )
  const setorEscolhido = Number(setorId) || null
  const mesmoSetor = setorEscolhido === item.setor_id
  const etapasDoDestino = etapas.filter(
    (e) => e.setor_id === setorEscolhido && !e.eh_danificado,
  )
  const opcoesEtapa = [
    { valor: 'chegada', rotulo: 'Chegada (sem etapa)' },
    ...etapasDoDestino.map((e) => ({ valor: String(e.id), rotulo: e.nome })),
  ]

  const resolver = useMutation({
    mutationFn: () =>
      resolverDanificado({
        cardId: item.card_id,
        destinoSetorId: setorEscolhido!,
        destinoEtapaId: etapaId === 'chegada' ? null : Number(etapaId),
        estado: mesmoSetor ? null : estado,
        observacao,
      }),
    onSuccess: async () => {
      notificar({ titulo: 'Peça resolvida — voltou ao fluxo', tom: 'perfeito' })
      await aoResolvido()
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para resolver',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  const podeConfirmar = setorEscolhido !== null && (mesmoSetor || estado !== null)

  return (
    <Modal
      aberto
      aoFechar={(aberto) => {
        if (!aberto) aoFechar()
      }}
      titulo={`Resolvido — ${item.item_descricao ?? 'peça'} · Pedido ${item.numero}`}
      descricao="Para onde a peça vai agora? Para outro setor, marque o estado em que ela sai."
      tamanho="galpao"
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            variante="primaria"
            disabled={!podeConfirmar}
            carregando={resolver.isPending}
            onClick={() => resolver.mutate()}
          >
            Confirmar
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Selecao
          rotulo="Destino"
          opcoes={opcoesSetor}
          valor={setorId}
          aoMudar={(v) => {
            setSetorId(v)
            setEtapaId('chegada')
          }}
          placeholder="Estoque, ROTAS ou um setor"
          tamanho="galpao"
        />
        {setorEscolhido !== null && etapasDoDestino.length > 0 && (
          <Selecao rotulo="Etapa" opcoes={opcoesEtapa} valor={etapaId} aoMudar={setEtapaId} />
        )}

        {setorEscolhido !== null && !mesmoSetor && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-texto">Em que estado ela sai?</legend>
            {ESTADOS_QUALIDADE.map((opcao) => (
              <button
                key={opcao}
                type="button"
                role="radio"
                aria-checked={estado === opcao}
                onClick={() => setEstado(opcao)}
                className={cn(
                  'flex min-h-toque-lg items-center gap-3 rounded-dm border px-3 text-left transition-colors',
                  estado === opcao
                    ? 'border-acao-ativa bg-superficie-sutil'
                    : 'border-borda hover:bg-superficie-sutil',
                )}
              >
                <BadgeEstado estado={opcao} />
                <span className="text-sm text-texto-suave">{DESCRICAO_ESTADO[opcao]}</span>
                <span className="sr-only">{ROTULO_ESTADO[opcao]}</span>
              </button>
            ))}
          </fieldset>
        )}

        <Campo
          rotulo="Observação (opcional)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="ex.: quina refeita, segue para fitamento"
        />
      </div>
    </Modal>
  )
}
