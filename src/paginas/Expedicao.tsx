import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Eye,
  Hourglass,
  PackageCheck,
  PackageX,
  Search,
  Truck,
} from 'lucide-react'
import { Abas, Botao, Campo, Modal, Paginacao } from '@/componentes/ui'
import type { Aba } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { unidadesDoPedido } from '@/kanban/api'
import { formatarDuracao, useAgora } from '@/kanban/tempo'
import { useAcessoLogistica } from '@/logistica/acesso'
import { listarExpedicao } from '@/logistica/api'
import type { ContagensExpedicao, FiltroExpedicao, PedidoExpedicao } from '@/logistica/api'
import { PecasProntas } from '@/logistica/componentes/PecasProntas'
import { nomeDoLugar } from '@/logistica/lugar'
import { SeloEstado } from '@/rotas/SeloEstado'
import { nomeDaRota } from '@/rotas/api'
import { useAoVivo } from '@/lib/aoVivo'

const POR_PAGINA = 20

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
 */
export function Expedicao() {
  const { perfil, tenhoAcesso, semAcesso } = useAcessoLogistica()
  const agora = useAgora()
  const [parametros, setParametros] = useSearchParams()
  const filtroUrl = parametros.get('filtro') ?? 'todos'
  const filtro: FiltroExpedicao = VALORES_FILTRO.has(filtroUrl)
    ? (filtroUrl as FiltroExpedicao)
    : 'todos'
  const visao: VisaoExpedicao = parametros.get('visao') === 'pecas' ? 'pecas' : 'pedidos'

  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [pedidoAberto, setPedidoAberto] = useState<PedidoExpedicao | null>(null)

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
    <div className="@container flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl">Expedição</h1>
          <p className="mt-1 max-w-2xl text-texto-suave">
            Todos os pedidos ainda não entregues, a previsão mais próxima primeiro — prontos, em
            produção ou ainda no PCP. Qualquer um deles pode ganhar rota na{' '}
            <Link to="/fabrica/rotas/programacao" className="font-medium text-texto underline">
              Programação
            </Link>
            .
          </p>
        </div>
        <Abas
          rotulo="Visões da Expedição"
          idBase="expedicao"
          abas={VISOES}
          valor={visao}
          aoMudar={(v) => mudarParametro('visao', v, 'pedidos')}
        />
      </div>

      <div role="tabpanel" id="expedicao-painel" aria-labelledby={`expedicao-aba-${visao}`}>
        {visao === 'pecas' ? (
          <PecasProntas ativo={tenhoAcesso} />
        ) : (
          <div className="flex flex-col gap-5">
            <QuadrosFiltro
              contagens={data?.contagens ?? null}
              ativo={filtro}
              aoEscolher={(v) => mudarParametro('filtro', v, 'todos')}
            />

            <div className="max-w-md">
              <Campo
                rotulo="Buscar pedido"
                prefixo={<Search />}
                placeholder="Número do pedido ou nome do cliente"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value)
                  setPagina(1)
                }}
              />
            </div>

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
                  aoVerUnidades={() => setPedidoAberto(linha)}
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
  return (
    <div
      role="group"
      aria-label="Filtros da Expedição"
      className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @4xl:grid-cols-5"
    >
      {FILTROS.map((f) => {
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
  aoVerUnidades,
}: {
  linha: PedidoExpedicao
  agora: number
  aoVerUnidades: () => void
}) {
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
          <SeloEstado
            estado={linha.estado}
            prontas={linha.unidades_prontas}
            total={linha.a_entregar}
          />
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
          {linha.alterado_apos_liberacao && (
            <span className="inline-flex items-center gap-1 rounded-full bg-atencao-fundo px-2.5 py-0.5 text-xs font-medium text-atencao-texto">
              <AlertTriangle aria-hidden className="size-3.5" />
              Alterado no Tiny após a liberação
            </span>
          )}
        </div>
        <p className="line-clamp-1 text-sm text-texto-suave">
          {linha.cliente_nome || 'Sem cliente'} · previsão {formatarData(linha.data_prevista)}
          {faltamNoPcp > 0 && <> · {faltamNoPcp} ainda no PCP</>}
        </p>

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
          !linha.em_devolucao && (
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
