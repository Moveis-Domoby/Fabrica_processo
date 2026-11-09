import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  CirclePause,
  ClipboardList,
  ExternalLink,
  Eye,
  Hourglass,
  PackageCheck,
  PackageX,
  Search,
  Truck,
  Undo2,
} from 'lucide-react'
import { Abas, Botao, Campo, Modal, Paginacao, useNotificacao } from '@/componentes/ui'
import { CabecalhoDaTela } from '@/componentes/CabecalhoDaTela'
import type { Aba } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { unidadesDoPedido } from '@/kanban/api'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { useAcessoLogistica } from '@/logistica/acesso'
import { listarExpedicao, voltarPedidoAoPcp } from '@/logistica/api'
import type {
  ContagensExpedicao,
  FiltroExpedicao,
  PedidoExpedicao,
  SituacaoDaVolta,
} from '@/logistica/api'
import { ModalLiberarPeca } from '@/logistica/componentes/ModalLiberarPeca'
import { PecasProntas } from '@/logistica/componentes/PecasProntas'
import { nomeDoLugar } from '@/logistica/lugar'
import {
  EXPLICACAO_TINY_DESLIGADO,
  NOME_DA_SITUACAO,
  ROTULO_VOLTAR,
  SITUACOES_DA_VOLTA,
  avisoDaVolta,
  fraseConfirmarVolta,
  fraseSaiuDoPcp,
  produtos,
} from '@/logistica/voltaPcp'
import { SeloEstado } from '@/rotas/SeloEstado'
import { chaveDoGesto, nomeDaRota } from '@/rotas/api'
import { useAoVivo } from '@/lib/aoVivo'

const POR_PAGINA = 20

/** As telas que mudam quando o pedido volta ao PCP (releem depois do gesto). */
const RELER_NA_VOLTA: string[][] = [['expedicao'], ['pcp'], ['programadas'], ['programacao']]

function formatarData(iso: string | null): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '—'
}

/** Os quadradinhos do topo (pedido do dono, imagem 7): número grande + nome; o ativo fica contornado. */
const FILTROS: { valor: FiltroExpedicao; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos os pedidos não entregues' },
  { valor: 'com_rota', rotulo: 'Com rota programada' },
  { valor: 'sem_rota', rotulo: 'Sem rota programada' },
  { valor: 'prontos', rotulo: 'Pedidos prontos' },
  { valor: 'em_producao', rotulo: 'Ainda em produção' },
  // SESSAO-47: o que o Tiny levou adiante com produto por liberar — saiu do PCP e espera a decisão daqui
  { valor: 'saiu_do_pcp', rotulo: 'Saiu do PCP pelo Tiny' },
]
const VALORES_FILTRO = new Set<string>(FILTROS.map((f) => f.valor))

type VisaoExpedicao = 'pedidos' | 'pecas'
const VISOES: Aba<VisaoExpedicao>[] = [
  { valor: 'pedidos', rotulo: 'Pedidos', icone: <ClipboardList aria-hidden /> },
  { valor: 'pecas', rotulo: 'Peça por peça', icone: <PackageCheck aria-hidden /> },
]

/**
 * Logística → Expedição (D-01/D-13 → D-133 → SESSAO-38 · D-157).
 *
 * ↪️ SESSAO-38 (pedido do dono, imagens 6/7): "Pedidos em aguardo" passou a
 * ser a Expedição — a tela do aguardo deixou de existir. Aqui ficam TODOS os
 * pedidos vivos (a mesma regra das rotas — o banco decide: sem entrega, não
 * encerrado nem excluído no Tiny, o que o Tiny levou adiante só com peça na
 * fábrica), a previsão mais próxima primeiro, com os FILTROS em quadradinhos
 * (os números vêm na MESMA requisição da página — Lei §2; filtro e paginação no
 * servidor — Lei §6). Do aguardo vieram: as peças prontas (a visão "Peça por
 * peça"), o "Ver unidades", o tempo desde a 1ª peça pronta / desde completo e o
 * atalho para abrir o pedido. O "Lançar para ROTAS" saiu: qualquer pedido vivo
 * se programa direto na Programação (D-156). Ao vivo pelo aviso do PCP, do
 * aguardo e da ROTAS (sem relógio).
 *
 * ↪️ SESSAO-47: o pedido que o Tiny levou adiante (Faturado, Pronto para envio,
 * Enviado) e que ainda tem produto por liberar aparece aqui mesmo sem peça
 * nenhuma, com o aviso da situação real e os dois botões que o devolvem ao PCP
 * mudando a situação no Tiny (uma chamada, idempotente pela chave do toque).
 */
export function Expedicao() {
  const { perfil, tenhoAcesso, semAcesso } = useAcessoLogistica()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const agora = useAgora()
  const [parametros, setParametros] = useSearchParams()
  const filtroUrl = parametros.get('filtro') ?? 'todos'
  const filtro: FiltroExpedicao = VALORES_FILTRO.has(filtroUrl)
    ? (filtroUrl as FiltroExpedicao)
    : 'todos'
  const visao: VisaoExpedicao = parametros.get('visao') === 'pecas' ? 'pecas' : 'pedidos'

  const [busca, setBusca] = useState('')
  // ↩️ 06/11 (varredura): a busca da aba "Peça por peça" também na linha presa do topo.
  const [buscaPecas, setBuscaPecas] = useState('')
  const [pagina, setPagina] = useState(1)
  const [pedidoAberto, setPedidoAberto] = useState<PedidoExpedicao | null>(null)
  // SESSAO-45 (pedido do dono): liberar a peça pronta deste pedido para outro
  const [liberandoDe, setLiberandoDe] = useState<PedidoExpedicao | null>(null)
  // SESSAO-47: a confirmação de uma frase antes de devolver o pedido ao PCP (a
  // chave nasce com a confirmação: o toque repetido não faz nada duas vezes)
  const [voltando, setVoltando] = useState<{
    linha: PedidoExpedicao
    situacao: SituacaoDaVolta
    chave: string
  } | null>(null)

  const voltar = useMutation({
    mutationFn: (alvo: NonNullable<typeof voltando>) =>
      voltarPedidoAoPcp({ cardId: alvo.linha.card_id, situacao: alvo.situacao, chave: alvo.chave }),
    onSuccess: async (r, alvo) => {
      const numero = r.numero ?? alvo.linha.numero
      if (r.feito) {
        notificar({
          titulo: `Pedido ${numero} voltou ao PCP`,
          descricao: `Com ${produtos(r.faltam ?? alvo.linha.saiu_do_pcp?.faltam ?? 0)} para liberar${r.standby ? ', em stand-by' : ''}. No Tiny ele passa para ${NOME_DA_SITUACAO[alvo.situacao]}.`,
          tom: 'perfeito',
        })
      } else if (r.motivo === 'tiny_nao_esta_adiante') {
        notificar({
          titulo: `O Tiny já mudou a situação do pedido ${numero}`,
          descricao: 'Ele já está no PCP — não foi preciso mudar nada.',
          tom: 'informativo',
        })
      } else {
        notificar({ titulo: 'Isso já tinha sido feito', tom: 'informativo' })
      }
      await Promise.all(
        RELER_NA_VOLTA.map((queryKey) => clienteQuery.invalidateQueries({ queryKey })),
      )
      setVoltando(null)
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para devolver o pedido ao PCP',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  const listaAberta = tenhoAcesso && visao === 'pedidos'
  const { data, isPending } = useQuery({
    queryKey: ['expedicao', filtro, busca, pagina],
    queryFn: () =>
      listarExpedicao({
        filtro,
        busca,
        limite: POR_PAGINA,
        deslocamento: (pagina - 1) * POR_PAGINA,
      }),
    enabled: listaAberta,
    placeholderData: keepPreviousData,
  })
  useAoVivo(
    ['pcp', 'aguardo', 'rotas'],
    [['expedicao'], ['pedido-unidades'], ['produtos-reservados']],
    { ligado: tenhoAcesso, espalharMs: 1_000 },
  )
  const linhas = data?.itens ?? []
  const totalItens = data?.total ?? 0

  const { data: unidades = [], isPending: carregandoUnidades } = useQuery({
    queryKey: ['pedido-unidades', pedidoAberto?.pedido_id ?? 0],
    queryFn: () => unidadesDoPedido(pedidoAberto!.pedido_id),
    enabled: pedidoAberto !== null,
  })

  if (semAcesso) return <Navigate to="/" replace />
  if (!perfil) return null

  function mudarParametro(chave: 'filtro' | 'visao', valor: string, padrao: string) {
    setParametros(
      (atual) => {
        const novos = new URLSearchParams(atual)
        if (valor === padrao) novos.delete(chave)
        else novos.set(chave, valor)
        return novos
      },
      { replace: true },
    )
    setPagina(1)
  }

  return (
    <div className="@container flex flex-col gap-4">
      {/* ↩️ Ajuste de 06/11 (cabeçalhos compactos): a explicação foi para o "?" e
          as abas ficam na linha do título; a busca (só da visão Pedidos) subiu
          para a mesma linha, com o rótulo só para o leitor de tela. */}
      <CabecalhoDaTela
        titulo="Expedição"
        rotuloAjuda="Como funciona a Expedição"
        ajuda={
          <>
            Todos os pedidos ainda não entregues, a previsão mais próxima primeiro — prontos, em
            produção ou ainda no PCP. Qualquer um deles pode ganhar rota na{' '}
            <Link to="/fabrica/rotas/programacao" className="font-medium text-texto underline">
              Programação
            </Link>
            . Quando o Tiny leva adiante (Faturado, Pronto para envio ou Enviado) um pedido que
            ainda tem produto por liberar, ele sai do PCP e fica aqui com o aviso — os botões do
            aviso mudam a situação no Tiny e devolvem o pedido ao PCP.
          </>
        }
      >
        {visao === 'pedidos' && (
          <div className="mr-auto w-full max-w-md min-w-56 flex-1">
            <Campo
              rotulo="Buscar pedido"
              rotuloOculto
              type="search"
              prefixo={<Search />}
              placeholder="Buscar: nº do pedido ou nome do cliente"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                setPagina(1)
              }}
            />
          </div>
        )}
        {visao === 'pecas' && (
          <div className="mr-auto w-full max-w-md min-w-56 flex-1">
            <Campo
              rotulo="Buscar peça pronta"
              rotuloOculto
              type="search"
              prefixo={<Search />}
              placeholder="Buscar: produto, SKU, nº do pedido ou cliente"
              value={buscaPecas}
              onChange={(e) => setBuscaPecas(e.target.value)}
            />
          </div>
        )}
        <Abas
          rotulo="Visões da Expedição"
          idBase="expedicao"
          abas={VISOES}
          valor={visao}
          aoMudar={(v) => mudarParametro('visao', v, 'pedidos')}
        />
      </CabecalhoDaTela>

      <div role="tabpanel" id="expedicao-painel" aria-labelledby={`expedicao-aba-${visao}`}>
        {visao === 'pecas' ? (
          <PecasProntas ativo={tenhoAcesso} busca={buscaPecas} />
        ) : (
          <div className="flex flex-col gap-4">
            <QuadrosFiltro
              contagens={data?.contagens ?? null}
              ativo={filtro}
              aoEscolher={(v) => mudarParametro('filtro', v, 'todos')}
            />

            {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
            {!isPending && linhas.length === 0 && (
              <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
                Nenhum pedido neste filtro{busca ? ' para esta busca' : ''}.
              </p>
            )}

            <ul className="flex flex-col gap-3">
              {linhas.map((linha) => (
                <CartaoExpedicao
                  key={linha.card_id}
                  linha={linha}
                  agora={agora}
                  tinyLigado={data?.tiny_ligado !== false}
                  aoVerUnidades={() => setPedidoAberto(linha)}
                  aoLiberarPeca={() => setLiberandoDe(linha)}
                  aoVoltarAoPcp={(situacao) =>
                    setVoltando({ linha, situacao, chave: chaveDoGesto() })
                  }
                />
              ))}
            </ul>

            {totalItens > POR_PAGINA && (
              <Paginacao
                paginaAtual={pagina}
                totalPaginas={Math.ceil(totalItens / POR_PAGINA)}
                totalItens={totalItens}
                porPagina={POR_PAGINA}
                aoMudarPagina={setPagina}
              />
            )}
          </div>
        )}
      </div>

      <ModalLiberarPeca
        key={liberandoDe ? `liberar-${liberandoDe.card_id}` : 'liberar-fechado'}
        pedido={liberandoDe}
        tinyLigado={data?.tiny_ligado !== false}
        aoFechar={() => setLiberandoDe(null)}
      />

      {/* SESSAO-47: a confirmação de uma frase antes de mudar a situação no Tiny e devolver ao PCP */}
      <Modal
        aberto={voltando !== null}
        aoFechar={(aberto) => {
          if (!aberto && !voltar.isPending) setVoltando(null)
        }}
        titulo={voltando ? `Voltar o pedido ${voltando.linha.numero} ao PCP?` : 'Voltar ao PCP'}
        descricao={
          voltando
            ? fraseConfirmarVolta({
                numero: voltando.linha.numero,
                faltam: voltando.linha.saiu_do_pcp?.faltam ?? 0,
                situacao: voltando.situacao,
                standby: Boolean(voltando.linha.standby),
              })
            : undefined
        }
        rodape={
          <>
            <Botao
              tamanho="lg"
              variante="secundaria"
              onClick={() => setVoltando(null)}
              disabled={voltar.isPending}
            >
              Cancelar
            </Botao>
            <Botao
              tamanho="lg"
              icone={<Undo2 />}
              onClick={() => voltando && voltar.mutate(voltando)}
              carregando={voltar.isPending}
            >
              Voltar ao PCP
            </Botao>
          </>
        }
      >
        {voltando && (
          <p className="text-sm text-texto-suave">
            Hoje, no Tiny, ele está como{' '}
            <strong className="font-semibold text-texto">
              {voltando.linha.saiu_do_pcp?.situacao ?? voltando.linha.situacao ?? 'adiantado'}
            </strong>
            . O pedido volta ao PCP na hora; se o Tiny não aceitar a mudança, ele continua no PCP e
            a plataforma avisa.
          </p>
        )}
      </Modal>

      <Modal
        aberto={pedidoAberto !== null}
        aoFechar={(aberto) => {
          if (!aberto) setPedidoAberto(null)
        }}
        titulo={pedidoAberto ? `Pedido ${pedidoAberto.numero} — unidades` : 'Unidades'}
        descricao={pedidoAberto?.cliente_nome || undefined}
        tamanho="galpao"
        rodape={
          <Botao variante="secundaria" onClick={() => setPedidoAberto(null)}>
            Fechar
          </Botao>
        }
      >
        {carregandoUnidades && <p className="text-sm text-texto-fraco">Carregando…</p>}
        {!carregandoUnidades && unidades.length === 0 && (
          <p className="text-sm text-texto-suave">
            Nenhuma unidade liberada ainda — o pedido está inteiro no PCP.
          </p>
        )}
        <ul className="flex flex-col divide-y divide-borda rounded-dm border border-borda">
          {unidades.map((u) => (
            <li
              key={u.card_id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5"
            >
              <span className="flex min-w-0 flex-col">
                <span className="line-clamp-1 text-sm text-texto">
                  {u.item_descricao ?? 'Sem descrição'}{' '}
                  <span className="font-medium tabular-nums">
                    ({u.indice_unidade}/{u.total_unidades})
                  </span>
                </span>
                <span className="text-xs text-texto-fraco tabular-nums">
                  {nomeDoLugar(u.setor_nome) ?? '—'}
                  {u.etapa_nome ? ` · ${u.etapa_nome}` : ''} · há {formatarDuracao(u.desde, agora)}
                </span>
              </span>
              {u.setor_terminal ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-perfeito-forte">
                  <CheckCircle2 aria-hidden className="size-4" />
                  pronta
                </span>
              ) : (
                <span className="shrink-0 text-sm text-texto-suave">em produção</span>
              )}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}

/**
 * Os filtros em quadradinhos (Lei §3.4: os números vêm prontos do banco). O
 * mesmo tamanho de número em todos (E-31) e a grade pela largura da ÁREA (E-30).
 */
function QuadrosFiltro({
  contagens,
  ativo,
  aoEscolher,
}: {
  contagens: ContagensExpedicao | null
  ativo: FiltroExpedicao
  aoEscolher: (filtro: FiltroExpedicao) => void
}) {
  // SESSAO-47: o quadradinho novo só aparece quando o banco manda o número dele
  // (a tela nova tolera o banco de antes por uns minutos — Lei §7.6).
  const filtros = FILTROS.filter(
    (f) =>
      f.valor !== 'saiu_do_pcp' || contagens?.saiu_do_pcp !== undefined || ativo === 'saiu_do_pcp',
  )
  return (
    <div
      role="group"
      aria-label="Filtros da Expedição"
      className={cn(
        'grid grid-cols-2 gap-3 @xl:grid-cols-3',
        filtros.length > 5 ? '@4xl:grid-cols-6' : '@4xl:grid-cols-5',
      )}
    >
      {filtros.map((f) => {
        const selecionado = f.valor === ativo
        const numero = contagens?.[f.valor]
        return (
          <button
            key={f.valor}
            type="button"
            aria-pressed={selecionado}
            onClick={() => aoEscolher(f.valor)}
            className={cn(
              'flex min-h-toque-lg min-w-0 flex-col items-start gap-1 rounded-dm-lg border bg-superficie p-3 text-left transition-colors hover:bg-superficie-sutil',
              selecionado ? 'border-acao-ativa ring-2 ring-acao-ativa' : 'border-borda',
            )}
          >
            <span className="text-3xl leading-none font-bold text-texto tabular-nums">
              {numero ?? '—'}
            </span>
            <span className="text-sm text-texto-suave">{f.rotulo}</span>
          </button>
        )
      })}
    </div>
  )
}

function CartaoExpedicao({
  linha,
  agora,
  tinyLigado,
  aoVerUnidades,
  aoLiberarPeca,
  aoVoltarAoPcp,
}: {
  linha: PedidoExpedicao
  agora: number
  /** SESSAO-47: a ida ao Tiny está ligada? (desligada, os botões de voltar ficam apagados) */
  tinyLigado: boolean
  aoVerUnidades: () => void
  aoLiberarPeca: () => void
  aoVoltarAoPcp: (situacao: SituacaoDaVolta) => void
}) {
  // SESSAO-47: o Tiny levou o pedido adiante e ainda falta liberar — ele NÃO está no PCP
  const saiu = linha.saiu_do_pcp ?? null
  // …ou a logística já o devolveu e o Tiny ainda não mostrou a situação nova
  const esperandoTiny = avisoDaVolta(linha.volta_pcp)
  const alvo = Math.max(linha.a_entregar, 0)
  const progresso =
    alvo > 0
      ? Math.min(100, Math.round((linha.unidades_prontas / alvo) * 100))
      : linha.pronto
        ? 100
        : 0
  const faltamNoPcp = Math.max(linha.total_unidades - linha.unidades_liberadas, 0)
  const nadaAProduzir = linha.total_unidades === 0
  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-dm-lg border bg-superficie p-4',
        linha.pronto ? 'border-acao-ativa' : 'border-borda',
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-texto tabular-nums">Pedido {linha.numero}</span>
          {saiu && linha.estado === 'no_pcp' ? (
            // SESSAO-47: nada liberado e fora do PCP — "ainda no PCP" seria mentira
            <span className="inline-flex items-center gap-1 rounded-full border border-atencao-borda bg-atencao-fundo px-2 py-0.5 text-xs font-medium whitespace-nowrap text-atencao-texto">
              <AlertTriangle aria-hidden className="size-3.5" />
              Saiu do PCP pelo Tiny
            </span>
          ) : (
            <SeloEstado
              estado={linha.estado}
              prontas={linha.unidades_prontas}
              total={linha.a_entregar}
            />
          )}
          {esperandoTiny && (
            <span
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-atencao-fundo px-2.5 py-0.5 text-xs font-medium text-atencao-texto"
              title={esperandoTiny.detalhe}
            >
              <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
              <span className="break-words">{esperandoTiny.texto}</span>
            </span>
          )}
          {nadaAProduzir && (
            // D-63: pedido só de frete — não há móvel a produzir.
            <span className="rounded-full bg-superficie-sutil px-2.5 py-0.5 text-xs font-medium text-texto-suave">
              Nada a produzir
            </span>
          )}
          {linha.em_devolucao && (
            <span className="inline-flex items-center gap-1 rounded-full bg-atencao-fundo px-2.5 py-0.5 text-xs font-medium text-atencao-texto">
              <PackageX aria-hidden className="size-3.5" />
              Em decisão pós devolução
            </span>
          )}
          {linha.standby && (
            // SESSAO-38 (D-171): o PCP segurou o pedido — ele não entra nas rotas até voltar.
            <span
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-atencao-fundo px-2.5 py-0.5 text-xs font-medium text-atencao-texto"
              title={`Em stand-by no PCP${linha.standby.motivo ? `: ${linha.standby.motivo}` : ''} — não entra nas rotas até voltar.`}
            >
              <CirclePause aria-hidden className="size-3.5 shrink-0" />
              <span className="break-words">
                Stand-by{linha.standby.motivo ? ` · ${linha.standby.motivo}` : ''}
              </span>
            </span>
          )}
          {linha.alterado_apos_liberacao && (
            <span className="inline-flex items-center gap-1 rounded-full bg-atencao-fundo px-2.5 py-0.5 text-xs font-medium text-atencao-texto">
              <AlertTriangle aria-hidden className="size-3.5" />
              Alterado no Tiny após a liberação
            </span>
          )}
        </div>
        <p className="line-clamp-1 text-sm text-texto-suave">
          {linha.cliente_nome || 'Sem cliente'} · previsão {formatarData(linha.data_prevista)}
          {faltamNoPcp > 0 && !saiu && <> · {faltamNoPcp} ainda no PCP</>}
        </p>

        {/* SESSAO-47: o aviso do pedido que o Tiny levou adiante com produto por
            liberar — a situação real, o que falta e os dois botões que mudam a
            situação lá e devolvem o pedido ao PCP. */}
        {saiu && (
          <div
            role="note"
            aria-label={`Aviso do pedido ${linha.numero}: saiu do PCP pela situação do Tiny`}
            className="flex flex-col gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo p-3"
          >
            <p className="flex items-start gap-2 text-sm text-atencao-texto">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{fraseSaiuDoPcp(saiu.situacao, saiu.faltam)}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {SITUACOES_DA_VOLTA.map((situacao) => (
                <Botao
                  key={situacao}
                  variante="secundaria"
                  icone={<Undo2 />}
                  disabled={!tinyLigado}
                  onClick={() => aoVoltarAoPcp(situacao)}
                >
                  {ROTULO_VOLTAR[situacao]}
                </Botao>
              ))}
            </div>
            {!tinyLigado && (
              <p className="text-xs text-atencao-texto">{EXPLICACAO_TINY_DESLIGADO}</p>
            )}
          </div>
        )}

        {/* D-39/D-128: a rota do pedido, ou o caminho para programar. */}
        {linha.programacao ? (
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-texto">
            <Truck aria-hidden className="size-4 text-texto-suave" />
            <span className="font-medium tabular-nums">{formatarData(linha.programacao.data)}</span>
            <span className="text-texto-suave">
              · {linha.programacao.caminhao_nome ?? 'Caminhão'}
              {linha.programacao.caminhao_placa ? ` (${linha.programacao.caminhao_placa})` : ''}
              {linha.programacao.rota > 1 ? ` · ${nomeDaRota(linha.programacao.rota)}` : ''}
            </span>
          </p>
        ) : (
          !linha.em_devolucao &&
          !linha.standby && (
            <p className="text-sm text-texto-suave">
              Sem rota —{' '}
              <Link to="/fabrica/rotas/programacao" className="font-medium text-texto underline">
                programar
              </Link>
            </p>
          )
        )}

        {/* D-48 (veio do aguardo): o relógio da peça pronta. */}
        {(linha.completo_em || linha.primeira_pronta_em) && (
          <p className="inline-flex items-center gap-1.5 text-sm text-texto-suave tabular-nums">
            <Hourglass aria-hidden className="size-4" />
            {linha.pronto && linha.completo_em ? (
              <>Completo há {formatarDuracao(linha.completo_em, agora)}</>
            ) : (
              linha.primeira_pronta_em && (
                <>1ª peça pronta há {formatarDuracao(linha.primeira_pronta_em, agora)}</>
              )
            )}
          </p>
        )}

        {!nadaAProduzir && (
          <div
            className="mt-1 h-2 w-full overflow-hidden rounded-full bg-superficie-sutil"
            role="progressbar"
            aria-valuenow={linha.unidades_prontas}
            aria-valuemin={0}
            aria-valuemax={alvo}
            aria-label={`${linha.unidades_prontas} de ${alvo} unidades prontas`}
          >
            <div
              className={cn(
                'h-full rounded-full transition-all',
                linha.pronto ? 'bg-perfeito-forte' : 'bg-acao',
              )}
              style={{ width: `${progresso}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!nadaAProduzir && (
          <Botao variante="secundaria" icone={<Eye />} onClick={aoVerUnidades}>
            Ver unidades
          </Botao>
        )}
        {linha.unidades_prontas > 0 && !linha.em_devolucao && (
          // SESSAO-45 (pedido do dono): a peça pronta foi para outro pedido mais urgente
          // (ou saiu por outro motivo) — este pedido volta ao PCP com o produto que saiu.
          <Botao variante="secundaria" icone={<ArrowRightLeft />} onClick={aoLiberarPeca}>
            Liberar para outro pedido
          </Botao>
        )}
        <Link
          to={`/fabrica/pedidos/todos?pedido=${linha.numero}`}
          className="inline-flex min-h-toque-md items-center gap-1.5 rounded-dm px-3 text-sm font-medium text-texto underline-offset-2 hover:underline"
        >
          <ExternalLink aria-hidden className="size-4" />
          Abrir o pedido
        </Link>
      </div>
    </li>
  )
}
