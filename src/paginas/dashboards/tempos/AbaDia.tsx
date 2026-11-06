import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Botao, Campo, Tabela } from '@/componentes/ui'
import { useAbrirCard } from '@/kanban/janela/abrirCard'
import { Heroi } from '@/dashboards/componentes/Heroi'
import { buscarDia, type LinhaDia, type MapaPessoas, type TrechoDia } from '@/dashboards/tempos/api'
import {
  decimal,
  duracao,
  diaPorExtenso,
  hojeNaFabrica,
  horaNaFabrica,
  primeiroNome,
  somarDias,
} from '@/dashboards/tempos/formato'
import type { PropsAba } from '../TemposProducao'
import {
  Carregando,
  Cobertura,
  ContraPadrao,
  ErroLeitura,
  Montadores,
  Painel,
  SelosSituacao,
} from './comum'

/**
 * Aba DIA (SESSAO-43 · F1): os móveis que saíram do setor num dia — os números
 * grandes, a linha do dia de cada pessoa (os trechos ao longo do expediente,
 * o almoço e o fim do dia sombreados, os buracos à vista) e a tabela, por
 * cursor ("Ver mais" pede só a próxima página).
 */
export function AbaDia({ filtros, aoContador }: PropsAba) {
  const [dia, setDia] = useState(hojeNaFabrica())
  const abrirCard = useAbrirCard()
  const consulta = useInfiniteQuery({
    queryKey: ['tempos-producao', 'dia', filtros, dia],
    queryFn: ({ pageParam }) => buscarDia(filtros, dia, pageParam),
    initialPageParam: null as { fim: string; origem: 'plataforma' | 'trello'; id: number } | null,
    getNextPageParam: (ultima) => {
      if (!ultima.tabela.tem_mais) return undefined
      const u = ultima.tabela.itens.at(-1)
      return u ? { fim: u.fim, origem: u.origem, id: u.id } : undefined
    },
    staleTime: Infinity,
  })
  const primeira = consulta.data?.pages[0]
  useEffect(() => {
    if (primeira) aoContador(primeira.conferir_n)
  }, [primeira, aoContador])

  const linhas = useMemo(
    () => consulta.data?.pages.flatMap((p) => p.tabela.itens) ?? [],
    [consulta.data],
  )
  const pessoas: MapaPessoas = useMemo(
    () => Object.assign({}, ...(consulta.data?.pages.map((p) => p.pessoas) ?? [])),
    [consulta.data],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <Botao
          variante="secundaria"
          aria-label="Dia anterior"
          icone={<ChevronLeft aria-hidden />}
          onClick={() => setDia(somarDias(dia, -1))}
        />
        <div className="w-44">
          <Campo
            rotulo="Dia"
            rotuloOculto
            type="date"
            value={dia}
            max={hojeNaFabrica()}
            onChange={(e) => e.target.value && setDia(e.target.value)}
          />
        </div>
        <Botao
          variante="secundaria"
          aria-label="Dia seguinte"
          icone={<ChevronRight aria-hidden />}
          disabled={dia >= hojeNaFabrica()}
          onClick={() => setDia(somarDias(dia, 1))}
        />
        <h2 className="ml-1 text-base">{diaPorExtenso(dia)}</h2>
      </div>

      {consulta.isPending ? (
        <Carregando />
      ) : consulta.error ? (
        <ErroLeitura erro={consulta.error} />
      ) : primeira ? (
        <>
          <section className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
            <Heroi
              rotulo={/montagem/i.test(primeira.setor.nome) ? 'Móveis montados' : 'Móveis feitos'}
              valor={primeira.numeros.montados}
              detalhe={[
                primeira.numeros.conferir > 0 ? `${primeira.numeros.conferir} para conferir` : null,
                `${primeira.numeros.montadores} ${primeira.numeros.montadores === 1 ? 'pessoa' : 'pessoas'}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
            <Heroi
              rotulo="Tempo no setor"
              valor={duracao(primeira.numeros.tempo_total_s)}
              detalhe="soma dos tempos válidos"
            />
            <Heroi
              rotulo="Tempo médio"
              valor={duracao(primeira.numeros.mediana_s)}
              detalhe={
                primeira.numeros.media_s !== null
                  ? `mediana · a média é ${duracao(primeira.numeros.media_s)}`
                  : 'mediana'
              }
            />
            <Heroi
              rotulo="Abaixo do padrão"
              valor={
                primeira.numeros.com_padrao > 0
                  ? `${primeira.numeros.abaixo} de ${primeira.numeros.com_padrao}`
                  : '—'
              }
              detalhe="mais rápidos que o padrão do móvel"
            />
            <Heroi
              rotulo="Cobertura"
              valor={
                primeira.numeros.cobertura_total > 0
                  ? `${decimal((100 * primeira.numeros.cobertura_com_tempo) / primeira.numeros.cobertura_total, 0)}%`
                  : '—'
              }
              detalhe="dos móveis com tempo registrado"
            />
          </section>

          <Painel
            titulo="A linha do dia"
            dica="Cada faixa é uma pessoa ao longo do expediente: os trechos com o móvel, o almoço e o fim do dia sombreados."
          >
            <LinhaDoDia
              janelas={primeira.linha.janelas}
              trechos={primeira.linha.trechos}
              pessoas={pessoas}
            />
          </Painel>

          <Painel
            titulo="Móvel por móvel"
            dica={`Comparado ao padrão do móvel (a mediana) — "na média" é até ${primeira.faixa_pct}%.`}
          >
            <Tabela<LinhaDia>
              legenda="Os móveis que saíram do setor no dia"
              porPagina={200}
              dados={linhas}
              chaveDe={(l) => `${l.origem}-${l.id}`}
              tituloCelular={(l) => l.modelo ?? l.movel ?? 'Móvel'}
              vazio="Nenhum móvel saiu do setor neste dia."
              colunas={[
                {
                  chave: 'inicio',
                  cabecalho: 'Início',
                  celula: (l) => <span className="tabular-nums">{horaNaFabrica(l.inicio)}</span>,
                },
                {
                  chave: 'fim',
                  cabecalho: 'Fim',
                  celula: (l) => <span className="tabular-nums">{horaNaFabrica(l.fim)}</span>,
                },
                {
                  chave: 'movel',
                  cabecalho: 'Móvel',
                  ocultarNoCelular: true,
                  celula: (l) =>
                    l.card_id ? (
                      <button
                        type="button"
                        className="text-left underline-offset-2 hover:underline"
                        onClick={() => abrirCard(l.card_id!)}
                      >
                        {l.modelo ?? l.movel ?? 'Móvel'}
                        {l.pedido ? (
                          <span className="text-texto-fraco"> · pedido {l.pedido}</span>
                        ) : null}
                      </button>
                    ) : (
                      <span>
                        {l.modelo ?? l.movel ?? 'Móvel'}
                        {l.pedido ? (
                          <span className="text-texto-fraco"> · pedido {l.pedido}</span>
                        ) : null}
                      </span>
                    ),
                },
                {
                  chave: 'quem',
                  cabecalho: 'Quem',
                  celula: (l) => <Montadores ids={l.montadores} pessoas={pessoas} />,
                },
                {
                  chave: 'duracao',
                  cabecalho: 'Duração útil',
                  alinhamento: 'direita',
                  celula: (l) => (
                    <span className="font-semibold tabular-nums">
                      {l.situacao === 'sem_registro' ? '—' : duracao(l.execucao_s)}
                    </span>
                  ),
                },
                {
                  chave: 'vs',
                  cabecalho: 'Contra o padrão',
                  celula: (l) =>
                    l.situacao === 'sem_registro' ? null : (
                      <ContraPadrao
                        segundos={l.execucao_s}
                        padrao={l.padrao_s}
                        faixaPct={primeira.faixa_pct}
                      />
                    ),
                },
                {
                  chave: 'situacao',
                  cabecalho: 'Situação',
                  celula: (l) => (
                    <SelosSituacao
                      situacao={l.situacao}
                      motivo={l.motivo}
                      lote={l.lote}
                      ajudantes={l.ajudantes}
                      retrabalho={l.retrabalho}
                      cortado={l.cortado}
                      decidida={l.decidida}
                      origem={l.origem}
                    />
                  ),
                },
              ]}
            />
            {consulta.hasNextPage && (
              <Botao
                variante="secundaria"
                carregando={consulta.isFetchingNextPage}
                onClick={() => void consulta.fetchNextPage()}
              >
                Ver mais
              </Botao>
            )}
            <Cobertura
              total={primeira.numeros.cobertura_total}
              comTempo={primeira.numeros.cobertura_com_tempo}
            />
          </Painel>
        </>
      ) : null}
    </div>
  )
}

const ms = (iso: string) => Date.parse(iso)

/** As faixas do dia por pessoa: posição em % dentro do expediente (sem biblioteca de gráfico). */
function LinhaDoDia({
  janelas,
  trechos,
  pessoas,
}: {
  janelas: [string, string][]
  trechos: TrechoDia[]
  pessoas: MapaPessoas
}) {
  if (trechos.length === 0)
    return (
      <p className="text-sm text-texto-suave">Ninguém trabalhou num card deste setor neste dia.</p>
    )
  const inicio = Math.min(...janelas.map((j) => ms(j[0])), ...trechos.map((t) => ms(t.inicio)))
  const fim = Math.max(...janelas.map((j) => ms(j[1])), ...trechos.map((t) => ms(t.fim)))
  const total = Math.max(fim - inicio, 1)
  const pos = (t: number) => `${((t - inicio) / total) * 100}%`
  const larg = (a: number, b: number) => `${Math.max(((b - a) / total) * 100, 0.4)}%`
  // os buracos do expediente (antes, almoço, depois) sombreados
  const fora: [number, number][] = []
  let cursor = inicio
  for (const [a, b] of janelas
    .map((j) => [ms(j[0]), ms(j[1])] as [number, number])
    .sort((x, y) => x[0] - y[0])) {
    if (a > cursor) fora.push([cursor, a])
    cursor = Math.max(cursor, b)
  }
  if (cursor < fim) fora.push([cursor, fim])
  const porPessoa = new Map<string, TrechoDia[]>()
  for (const t of trechos) porPessoa.set(t.pessoa, [...(porPessoa.get(t.pessoa) ?? []), t])
  const marcas: number[] = []
  // as horas inteiras de dentro (a da ponta não cabe e empurraria a página de lado)
  for (let h = Math.ceil(inicio / 3_600_000) * 3_600_000; h <= fim - 20 * 60_000; h += 3_600_000)
    if (h > inicio + 10 * 60_000) marcas.push(h)

  return (
    <div className="flex flex-col gap-2 overflow-x-auto">
      <div className="relative mr-0 ml-28 h-4 min-w-[35.5rem] overflow-hidden text-[11px] text-texto-fraco">
        {marcas.map((h) => (
          <span key={h} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pos(h) }}>
            {horaNaFabrica(new Date(h).toISOString()).slice(0, 2)}h
          </span>
        ))}
      </div>
      {[...porPessoa.entries()].map(([pessoa, lista]) => (
        <div key={pessoa} className="flex min-w-[43rem] items-center gap-2">
          <span className="w-26 shrink-0 truncate text-sm" title={pessoas[pessoa]?.nome}>
            {primeiroNome(pessoas[pessoa]?.nome ?? 'Alguém')}
          </span>
          <div className="relative h-8 flex-1 rounded-dm bg-superficie-sutil">
            {fora.map(([a, b]) => (
              <span
                key={`f${a}`}
                aria-hidden
                className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,var(--dm-borda)_0_4px,transparent_4px_8px)] opacity-70"
                style={{ left: pos(a), width: larg(a, b) }}
              />
            ))}
            {lista.map((t, i) => {
              const titulo = `${t.movel ?? 'Móvel'} · ${horaNaFabrica(t.inicio)}–${horaNaFabrica(t.fim)} (${duracao((ms(t.fim) - ms(t.inicio)) / 1000)})${t.papel === 'auxilio' ? ' · ajudando' : ''}${t.descartado ? ' · clique errado (não conta)' : ''}${t.cortado ? ' · cortado no fim do expediente' : ''}${t.origem === 'trello' ? ' · histórico do Trello' : ''}`
              return (
                <span
                  key={`${t.inicio}-${i}`}
                  title={titulo}
                  aria-label={titulo}
                  className="absolute inset-y-1 rounded-sm border border-superficie"
                  style={{
                    left: pos(ms(t.inicio)),
                    width: larg(ms(t.inicio), ms(t.fim)),
                    background: t.descartado
                      ? 'var(--dm-borda-forte)'
                      : t.papel === 'auxilio'
                        ? 'var(--dm-serie-fila)'
                        : 'var(--dm-serie-execucao)',
                  }}
                />
              )
            })}
          </div>
        </div>
      ))}
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-suave">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-sm"
            style={{ background: 'var(--dm-serie-execucao)' }}
          />
          com o móvel
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-sm"
            style={{ background: 'var(--dm-serie-fila)' }}
          />
          ajudando
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-sm"
            style={{ background: 'var(--dm-borda-forte)' }}
          />
          clique errado (não conta)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-sm bg-[repeating-linear-gradient(135deg,var(--dm-borda)_0_2px,transparent_2px_4px)]"
          />
          fora do expediente
        </span>
      </p>
    </div>
  )
}
