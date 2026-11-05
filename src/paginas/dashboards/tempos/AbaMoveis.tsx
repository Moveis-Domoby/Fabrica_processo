import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react'
import { Botao, Modal, Selecao, Tabela } from '@/componentes/ui'
import { useAbrirCard } from '@/kanban/janela/abrirCard'
import {
  buscarMoveis,
  buscarPassagensDoModelo,
  type FiltrosTempos,
  type MapaPessoas,
  type ModeloLinha,
  type OrdemMoveis,
} from '@/dashboards/tempos/api'
import { diaCurto, duracao, primeiroNome } from '@/dashboards/tempos/formato'
import type { PropsAba } from '../TemposProducao'
import {
  BotoesDecidir,
  Carregando,
  ContraPadrao,
  ErroLeitura,
  ModalDecidir,
  Montadores,
  SelosSituacao,
  Vazio,
} from './comum'

const ORDENS: { valor: OrdemMoveis; rotulo: string }[] = [
  { valor: 'qtd', rotulo: 'Quantidade' },
  { valor: 'melhor', rotulo: 'Melhor tempo' },
  { valor: 'mediana', rotulo: 'Mediana' },
  { valor: 'faixa', rotulo: 'Faixa (o quanto varia)' },
  { valor: 'nome', rotulo: 'Nome do móvel' },
]

/**
 * Aba MÓVEIS (SESSAO-43 · F1): um modelo por linha — quantidade, melhor,
 * mediana, a faixa (metade dos tempos fica entre os dois números) e uma
 * coluna por montador (a mediana dele × quantas). Ordenada no servidor; o
 * clique abre as montagens daquele móvel (por cursor), com Considerar/Descartar.
 */
export function AbaMoveis({ filtros, aoContador }: PropsAba) {
  const [ordem, setOrdem] = useState<OrdemMoveis>('qtd')
  const [desc, setDesc] = useState(true)
  const [aberto, setAberto] = useState<ModeloLinha | null>(null)
  const consulta = useInfiniteQuery({
    queryKey: ['tempos-producao', 'moveis', filtros, ordem, desc],
    queryFn: ({ pageParam }) => buscarMoveis(filtros, ordem, desc, pageParam),
    initialPageParam: 0,
    getNextPageParam: (ultima, todas) =>
      ultima.tem_mais ? todas.reduce((n, p) => n + p.itens.length, 0) : undefined,
    staleTime: Infinity,
  })
  const primeira = consulta.data?.pages[0]
  useEffect(() => {
    if (primeira) aoContador(primeira.conferir_n)
  }, [primeira, aoContador])
  const itens = useMemo(() => consulta.data?.pages.flatMap((p) => p.itens) ?? [], [consulta.data])

  if (consulta.isPending) return <Carregando />
  if (consulta.error) return <ErroLeitura erro={consulta.error} />
  if (!primeira) return null
  const pessoas = primeira.pessoas
  const faixa = primeira.faixa_pct

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-60">
          <Selecao
            rotulo="Ordenar por"
            opcoes={ORDENS}
            valor={ordem}
            aoMudar={(v) => {
              setOrdem(v as OrdemMoveis)
              setDesc(v === 'qtd')
            }}
          />
        </div>
        <Botao
          variante="secundaria"
          icone={desc ? <ArrowDownWideNarrow aria-hidden /> : <ArrowUpNarrowWide aria-hidden />}
          onClick={() => setDesc((d) => !d)}
        >
          {desc ? 'Do maior para o menor' : 'Do menor para o maior'}
        </Botao>
        <p className="text-sm text-texto-suave">
          {primeira.total} {primeira.total === 1 ? 'modelo' : 'modelos'} · clique numa linha para
          ver cada montagem
        </p>
      </div>
      {itens.length === 0 ? (
        <Vazio>Nenhum móvel saiu do setor no período.</Vazio>
      ) : (
        <Tabela<ModeloLinha>
          legenda="Os tempos por modelo de móvel"
          porPagina={200}
          dados={itens}
          chaveDe={(m) => m.modelo_id ?? 'sem'}
          tituloCelular={(m) => (
            <button
              type="button"
              className="min-h-toque-md text-left underline-offset-2 hover:underline"
              onClick={() => setAberto(m)}
            >
              {m.nome}
            </button>
          )}
          colunas={[
            {
              chave: 'nome',
              cabecalho: 'Móvel',
              ocultarNoCelular: true,
              celula: (m) => (
                <button
                  type="button"
                  className="text-left underline-offset-2 hover:underline"
                  onClick={() => setAberto(m)}
                >
                  {m.nome}
                  {m.n_trello > 0 && (
                    <span className="block text-xs text-texto-fraco">
                      {m.n_trello} do histórico do Trello
                    </span>
                  )}
                </button>
              ),
            },
            {
              chave: 'qtd',
              cabecalho: 'Qtd',
              alinhamento: 'direita',
              celula: (m) => (
                <span className="tabular-nums">
                  {m.qtd}
                  {m.conferir > 0 && (
                    <span className="block text-xs text-texto-fraco">
                      {m.conferir} para conferir
                    </span>
                  )}
                </span>
              ),
            },
            {
              chave: 'melhor',
              cabecalho: 'Melhor',
              alinhamento: 'direita',
              celula: (m) => <span className="tabular-nums">{duracao(m.melhor_s)}</span>,
            },
            {
              chave: 'mediana',
              cabecalho: 'Mediana',
              alinhamento: 'direita',
              celula: (m) => (
                <span className="tabular-nums">
                  <strong>{duracao(m.mediana_s)}</strong>
                  {m.padrao_s !== null && (
                    <span className="block text-xs text-texto-fraco">
                      padrão {duracao(m.padrao_s)}
                    </span>
                  )}
                </span>
              ),
            },
            {
              chave: 'faixa',
              cabecalho: 'Faixa',
              alinhamento: 'direita',
              celula: (m) => (
                <span className="tabular-nums whitespace-nowrap">
                  {m.p25_s !== null ? `${duracao(m.p25_s)} – ${duracao(m.p75_s)}` : '—'}
                </span>
              ),
            },
            ...primeira.colunas.map((id) => ({
              chave: `p-${id}`,
              cabecalho: primeiroNome(pessoas[id]?.nome ?? 'Alguém'),
              celula: (m: ModeloLinha) => {
                const c = m.por_pessoa[id]
                if (!c) return <span className="text-texto-fraco">—</span>
                return (
                  <span className="flex flex-col text-sm">
                    <span className="tabular-nums whitespace-nowrap">
                      {duracao(c.mediana_s)} <span className="text-texto-fraco">×{c.n}</span>
                    </span>
                    <span className="text-xs">
                      <ContraPadrao
                        segundos={c.mediana_s}
                        padrao={m.padrao_s}
                        faixaPct={faixa}
                        mostrarPadrao={false}
                      />
                    </span>
                  </span>
                )
              },
            })),
          ]}
        />
      )}
      {consulta.hasNextPage && (
        <Botao
          variante="secundaria"
          carregando={consulta.isFetchingNextPage}
          onClick={() => void consulta.fetchNextPage()}
        >
          Ver mais modelos
        </Botao>
      )}
      <PassagensDoModelo
        filtros={filtros}
        modelo={aberto}
        faixa={faixa}
        aoFechar={() => setAberto(null)}
      />
    </div>
  )
}

function PassagensDoModelo({
  filtros,
  modelo,
  faixa,
  aoFechar,
}: {
  filtros: FiltrosTempos
  modelo: ModeloLinha | null
  faixa: number
  aoFechar: () => void
}) {
  const abrirCard = useAbrirCard()
  const [decidir, setDecidir] = useState<Parameters<typeof ModalDecidir>[0]['alvo']>(null)
  const consulta = useInfiniteQuery({
    queryKey: ['tempos-producao', 'modelo', filtros, modelo?.modelo_id ?? null],
    queryFn: ({ pageParam }) =>
      buscarPassagensDoModelo(filtros, modelo?.modelo_id ?? null, pageParam),
    initialPageParam: null as { fim: string; origem: 'plataforma' | 'trello'; id: number } | null,
    getNextPageParam: (ultima) => {
      const u = ultima.itens.at(-1)
      return ultima.tem_mais && u ? { fim: u.fim, origem: u.origem, id: u.id } : undefined
    },
    enabled: modelo !== null,
    staleTime: Infinity,
  })
  const itens = consulta.data?.pages.flatMap((p) => p.itens) ?? []
  const pessoas: MapaPessoas = Object.assign(
    {},
    ...(consulta.data?.pages.map((p) => p.pessoas) ?? []),
  )
  const podeDecidir = consulta.data?.pages[0]?.pode_decidir ?? false

  return (
    <>
      <Modal
        aberto={modelo !== null && decidir === null}
        aoFechar={(a) => !a && aoFechar()}
        titulo={modelo?.nome ?? ''}
        descricao="Cada montagem deste móvel no período, da mais recente para a mais antiga."
        tamanho="tela"
      >
        <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
          {consulta.isPending ? (
            <Carregando />
          ) : consulta.error ? (
            <ErroLeitura erro={consulta.error} />
          ) : itens.length === 0 ? (
            <Vazio>Nenhuma montagem no período.</Vazio>
          ) : (
            <ul className="flex flex-col divide-y divide-borda">
              {itens.map((p) => (
                <li
                  key={`${p.origem}-${p.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm"
                >
                  <span className="w-12 tabular-nums text-texto-suave">{diaCurto(p.dia)}</span>
                  <span className="min-w-32">
                    <Montadores ids={p.montadores} pessoas={pessoas} />
                  </span>
                  <span className="w-20 text-right font-semibold tabular-nums">
                    {p.situacao === 'sem_registro' ? '—' : duracao(p.execucao_s)}
                  </span>
                  <span className="min-w-36">
                    {p.situacao !== 'sem_registro' && (
                      <ContraPadrao
                        segundos={p.execucao_s}
                        padrao={p.padrao_s}
                        faixaPct={faixa}
                        mostrarPadrao={false}
                      />
                    )}
                  </span>
                  <SelosSituacao
                    situacao={p.situacao}
                    motivo={p.motivo}
                    lote={p.lote}
                    cortado={p.cortado}
                    decidida={p.decidida}
                    origem={p.origem}
                  />
                  <span className="ml-auto flex gap-1">
                    {p.card_id && (
                      <Botao variante="fantasma" tamanho="sm" onClick={() => abrirCard(p.card_id!)}>
                        Abrir o card
                      </Botao>
                    )}
                    {podeDecidir && (
                      <BotoesDecidir
                        origem={p.origem}
                        id={p.id}
                        situacao={p.situacao}
                        decidida={p.decidida}
                        titulo={`${p.movel ?? modelo?.nome ?? 'Móvel'} · ${diaCurto(p.dia)}`}
                        aoPedir={setDecidir}
                      />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {consulta.hasNextPage && (
            <Botao
              variante="secundaria"
              carregando={consulta.isFetchingNextPage}
              onClick={() => void consulta.fetchNextPage()}
            >
              Ver mais
            </Botao>
          )}
        </div>
      </Modal>
      <ModalDecidir alvo={decidir} aoFechar={() => setDecidir(null)} />
    </>
  )
}
