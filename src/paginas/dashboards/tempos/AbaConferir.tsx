import { useEffect, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ExternalLink, Search } from 'lucide-react'
import { Botao, Campo } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useAbrirCard } from '@/kanban/janela/abrirCard'
import {
  buscarConferir,
  GRUPOS_CONFERIR,
  procurarPassagens,
  type GrupoConferir,
  type MapaPessoas,
  type Procurado,
} from '@/dashboards/tempos/api'
import { diaCurto, duracao, horaNaFabrica, primeiroNome } from '@/dashboards/tempos/formato'
import type { PropsAba } from '../TemposProducao'
import {
  BotoesDecidir,
  Carregando,
  ContraPadrao,
  ErroLeitura,
  ModalDecidir,
  Montadores,
  Painel,
  SelosSituacao,
  Vazio,
} from './comum'

const ROTULO_GRUPO: Record<GrupoConferir, { titulo: string; explica: string }> = {
  rapida: {
    titulo: 'Curto demais',
    explica:
      'Menos que o tempo mínimo do setor — não parece uma montagem (fora da média até alguém decidir).',
  },
  longa: {
    titulo: 'Longo demais',
    explica:
      'Acima do teto do setor ou de 3 vezes o padrão do modelo — fora da média até alguém decidir.',
  },
  cortado: {
    titulo: 'Cortado no fim do expediente',
    explica:
      'O card ficou rodando depois do horário e o tempo parou sozinho (no fim do dia ou pelo aviso sem resposta).',
  },
  clique_errado: {
    titulo: 'Voltou para a fila',
    explica:
      'Alguém começou e devolveu o card para a fila em poucos minutos — aquele pedaço não conta.',
  },
  retrabalho: {
    titulo: 'Retrabalho',
    explica:
      'O móvel voltou para um setor anterior — fica fora da média, no indicador de retrabalho.',
  },
  sem_registro: {
    titulo: 'Sem registro',
    explica: 'O móvel saiu do setor sem ninguém iniciar o card — conta na quantidade, sem tempo.',
  },
  admin: {
    titulo: 'Gesto de administrador',
    explica: 'Um administrador iniciou o card sem ser da equipe do setor — fora da média.',
  },
  lote: {
    titulo: 'Montagem em lote',
    explica: 'Vários móveis iguais montados juntos — o tempo foi dividido entre eles.',
  },
  decididas: {
    titulo: 'Já decididas',
    explica: 'Considerados ou descartados à mão — dá para desfazer.',
  },
}

/**
 * Aba CONFERIR (SESSAO-43 · F2): a decisão manual da 42 — os casos agrupados
 * pelo motivo, com o contador; Considerar / Descartar / Desfazer com motivo
 * (líder do setor ou admin); e o Procurar, que mostra a passagem como foi
 * registrada, mesmo fora do período. Lista por cursor ("Ver mais").
 */
export function AbaConferir({ filtros, aoContador }: PropsAba) {
  const [grupo, setGrupo] = useState<GrupoConferir | null>(null)
  const [decidir, setDecidir] = useState<Parameters<typeof ModalDecidir>[0]['alvo']>(null)
  const abrirCard = useAbrirCard()
  const consulta = useInfiniteQuery({
    queryKey: ['tempos-producao', 'conferir', filtros, grupo],
    queryFn: ({ pageParam }) => buscarConferir(filtros, grupo, pageParam),
    initialPageParam: null as { fim: string; origem: 'plataforma' | 'trello'; id: number } | null,
    getNextPageParam: (ultima) => {
      const u = ultima.itens.at(-1)
      return ultima.tem_mais && u ? { fim: u.fim, origem: u.origem, id: u.id } : undefined
    },
    staleTime: Infinity,
  })
  const primeira = consulta.data?.pages[0]
  useEffect(() => {
    if (primeira) aoContador(primeira.conferir_n)
  }, [primeira, aoContador])
  const itens = consulta.data?.pages.flatMap((p) => p.itens) ?? []
  const pessoas: MapaPessoas = Object.assign(
    {},
    ...(consulta.data?.pages.map((p) => p.pessoas) ?? []),
  )
  const ativo = primeira?.grupo ?? grupo ?? 'rapida'

  return (
    <div className="flex flex-col gap-4">
      <Procurar setorId={filtros.setorId} trello={filtros.trello} />

      {consulta.isPending ? (
        <Carregando />
      ) : consulta.error ? (
        <ErroLeitura erro={consulta.error} />
      ) : primeira ? (
        <Painel
          titulo="Casos para conferir"
          dica="Agrupados pelo motivo. Considerar põe o tempo na média; descartar tira; desfazer volta à regra."
        >
          <div role="radiogroup" aria-label="O motivo" className="flex flex-wrap gap-1.5">
            {GRUPOS_CONFERIR.map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={ativo === g}
                onClick={() => setGrupo(g)}
                className={cn(
                  'min-h-toque-md rounded-full border px-3 text-sm font-medium transition-colors',
                  ativo === g
                    ? 'border-acao-ativa bg-acao text-acao-texto'
                    : 'border-borda-forte bg-superficie text-texto-suave hover:text-texto',
                )}
              >
                {ROTULO_GRUPO[g].titulo}{' '}
                <span className="tabular-nums">({primeira.grupos[g] ?? 0})</span>
              </button>
            ))}
          </div>
          <p className="text-sm text-texto-suave">{ROTULO_GRUPO[ativo].explica}</p>
          {itens.length === 0 ? (
            <Vazio>Nenhum caso neste grupo no período.</Vazio>
          ) : (
            <ul className="flex flex-col divide-y divide-borda">
              {itens.map((c) => (
                <li key={`${c.origem}-${c.id}`} className="flex flex-col gap-1.5 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm tabular-nums text-texto-suave">
                      {diaCurto(c.dia)} · {horaNaFabrica(c.inicio)}–{horaNaFabrica(c.fim)}
                    </span>
                    <span className="font-medium">
                      {c.modelo ?? c.movel ?? 'Móvel'}
                      {c.pedido ? (
                        <span className="font-normal text-texto-fraco"> · pedido {c.pedido}</span>
                      ) : null}
                    </span>
                    <span className="ml-auto text-lg font-semibold tabular-nums">
                      {c.situacao === 'sem_registro' ? '—' : duracao(c.execucao_s)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <Montadores ids={c.montadores} pessoas={pessoas} />
                    {c.situacao !== 'sem_registro' && (
                      <ContraPadrao
                        segundos={c.execucao_s}
                        padrao={c.padrao_s}
                        faixaPct={primeira.faixa_pct}
                      />
                    )}
                    <SelosSituacao
                      situacao={c.situacao}
                      motivo={c.motivo}
                      lote={c.lote}
                      ajudantes={c.ajudantes}
                      retrabalho={c.retrabalho}
                      cortado={c.cortado}
                      decidida={c.decidida}
                      origem={c.origem}
                    />
                  </div>
                  {c.decisao && (
                    <p className="text-sm text-texto-suave">
                      {c.decisao.decisao === 'considerar' ? 'Considerado' : 'Descartado'} por{' '}
                      {primeiroNome(pessoas[c.decisao.quem ?? '']?.nome ?? 'alguém')} em{' '}
                      {diaCurto(c.decisao.em.slice(0, 10))}
                      {c.decisao.motivo ? ` — "${c.decisao.motivo}"` : ''}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {c.card_id && (
                      <Botao variante="fantasma" tamanho="sm" onClick={() => abrirCard(c.card_id!)}>
                        Abrir o card
                      </Botao>
                    )}
                    <BotoesDecidir
                      origem={c.origem}
                      id={c.id}
                      situacao={c.situacao}
                      decidida={c.decidida}
                      titulo={`${c.modelo ?? c.movel ?? 'Móvel'} · ${diaCurto(c.dia)}`}
                      aoPedir={setDecidir}
                    />
                  </div>
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
        </Painel>
      ) : null}
      <ModalDecidir alvo={decidir} aoFechar={() => setDecidir(null)} />
    </div>
  )
}

const ROTULO_FIM: Record<string, string> = {
  pausa: 'pausou',
  fim_expediente: 'parou no fim do expediente',
  sem_resposta: 'parou pelo aviso sem resposta',
  esquecido: 'parou pelo card esquecido',
  movimento: 'arrastou o card',
  volta: 'voltou para a fila',
  setor: 'mudou de setor',
  transferencia: 'passou para outra pessoa',
  finalizado: 'finalizou',
  arquivado: 'o card foi arquivado',
}

/** Procurar por número do pedido ou nome do móvel — a passagem como foi registrada. */
function Procurar({ setorId, trello }: { setorId: number; trello: boolean }) {
  const [texto, setTexto] = useState('')
  const [buscado, setBuscado] = useState('')
  const abrirCard = useAbrirCard()
  const consulta = useQuery({
    queryKey: ['tempos-producao', 'procurar', setorId, trello, buscado],
    queryFn: () => procurarPassagens(setorId, buscado, trello),
    enabled: buscado.length > 0,
    staleTime: 60_000,
  })
  const itens: Procurado[] = consulta.data?.itens ?? []
  const pessoas = consulta.data?.pessoas ?? {}

  return (
    <Painel
      titulo="Procurar"
      dica="Pelo número do pedido ou pelo nome do móvel — mostra como foi registrado, mesmo fora do período."
    >
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setBuscado(texto.trim())
        }}
      >
        <div className="w-full max-w-sm">
          <Campo
            rotulo="Pedido ou móvel"
            rotuloOculto
            placeholder="Ex.: 13515 ou estante"
            prefixo={<Search aria-hidden className="size-4" />}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <Botao type="submit" variante="secundaria" disabled={texto.trim().length === 0}>
          Procurar
        </Botao>
      </form>
      {buscado &&
        (consulta.isPending ? (
          <Carregando />
        ) : consulta.error ? (
          <ErroLeitura erro={consulta.error} />
        ) : itens.length === 0 ? (
          <Vazio>
            Nada com "{buscado}" neste setor. Se o card existe, ainda não passou por aqui.
          </Vazio>
        ) : (
          <ul className="flex flex-col divide-y divide-borda">
            {itens.map((p) => (
              <li key={`${p.origem}-${p.id}`} className="flex flex-col gap-1 py-3 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-medium">{p.movel ?? p.modelo ?? 'Móvel'}</span>
                  {p.pedido && <span className="text-texto-fraco">pedido {p.pedido}</span>}
                  <span className="ml-auto font-semibold tabular-nums">
                    {duracao(p.execucao_s)}
                  </span>
                </div>
                <p className="text-texto-suave">
                  Entrou {diaCurto(p.entrada_em.slice(0, 10))} {horaNaFabrica(p.entrada_em)}
                  {p.saida_em
                    ? ` · saiu ${diaCurto(p.saida_em.slice(0, 10))} ${horaNaFabrica(p.saida_em)}`
                    : ' · ainda no setor'}
                  {p.fila_s !== undefined && ` · fila ${duracao(p.fila_s)}`}
                  {p.bruto_s !== undefined && ` · relógio corrido ${duracao(p.bruto_s)}`}
                </p>
                <SelosSituacao
                  situacao={p.situacao}
                  motivo={p.motivo}
                  lote={p.lote}
                  cortado={p.cortado}
                  origem={p.origem}
                />
                {p.etiquetas && p.etiquetas.length > 0 && (
                  <p className="text-texto-suave">Etiquetas no Trello: {p.etiquetas.join(', ')}</p>
                )}
                {p.trechos && p.trechos.length > 0 && (
                  <ul className="ml-1 flex flex-col gap-0.5 border-l-2 border-borda pl-3">
                    {p.trechos.map((t, i) => (
                      <li key={i} className={cn(t.descartado && 'text-texto-fraco line-through')}>
                        {primeiroNome(pessoas[t.pessoa]?.nome ?? 'Alguém')}{' '}
                        {t.papel === 'auxilio' ? 'ajudou' : 'trabalhou'} das{' '}
                        {horaNaFabrica(t.inicio)} às {horaNaFabrica(t.fim)} ({duracao(t.segundos)})
                        {t.fim_tipo
                          ? ` — ${ROTULO_FIM[t.fim_tipo] ?? t.fim_tipo}`
                          : ' — ainda rodando'}
                      </li>
                    ))}
                  </ul>
                )}
                {p.montadores.length > 0 && !p.trechos && (
                  <Montadores ids={p.montadores} pessoas={pessoas} />
                )}
                <div className="flex gap-2">
                  {p.card_id && (
                    <Botao variante="fantasma" tamanho="sm" onClick={() => abrirCard(p.card_id!)}>
                      Abrir o card
                    </Botao>
                  )}
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-toque-md items-center gap-1 text-sm text-texto-suave underline-offset-2 hover:underline"
                    >
                      <ExternalLink aria-hidden className="size-4" /> o cartão no Trello
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ))}
    </Painel>
  )
}
