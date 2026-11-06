import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Equal, HandHelping, Trophy } from 'lucide-react'
import { AvatarPessoa } from '@/componentes/ui'
import { buscarMontadores, type CartaoPessoa, type MapaPessoas } from '@/dashboards/tempos/api'
import { decimal, diaCurto, duracao, horas, primeiroNome } from '@/dashboards/tempos/formato'
import type { PropsAba } from '../TemposProducao'
import { Carregando, ContraPadrao, ErroLeitura, Montadores, Painel, Vazio } from './comum'

/**
 * Aba MONTADORES (na Montagem) ou PESSOAS (nos outros setores) — SESSAO-43 ·
 * F1: um cartão por pessoa, SEM ranking (cada um contra o padrão de cada
 * modelo — a escolha do dono na 16). Ao lado, os melhores tempos contra o
 * padrão. O funcionário vê só o próprio cartão (o banco devolve só o dele).
 */
export function AbaMontadores({ filtros, aoContador }: PropsAba) {
  const consulta = useQuery({
    queryKey: ['tempos-producao', 'pessoas', filtros],
    queryFn: () => buscarMontadores(filtros),
    staleTime: Infinity,
  })
  const r = consulta.data
  useEffect(() => {
    if (r) aoContador(r.conferir_n)
  }, [r, aoContador])

  if (consulta.isPending) return <Carregando />
  if (consulta.error) return <ErroLeitura erro={consulta.error} />
  if (!r) return null
  const ehMontagem = /montagem/i.test(r.setor.nome)

  return (
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-3">
        <h2 className="text-base">{ehMontagem ? 'Por montador' : 'Por pessoa'}</h2>
        {r.pessoas_cartoes.length === 0 ? (
          <Vazio>Ninguém {ehMontagem ? 'montou' : 'trabalhou'} neste setor no período.</Vazio>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3">
            {r.pessoas_cartoes.map((c) => (
              <li key={c.usuario_id}>
                <CartaoDaPessoa
                  c={c}
                  pessoas={r.pessoas}
                  faixa={r.faixa_pct}
                  verbo={ehMontagem ? 'montados' : 'feitos'}
                />
              </li>
            ))}
          </ul>
        )}
        {r.ajudantes_so.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
            <HandHelping aria-hidden className="size-4" />
            Só ajudaram:
            {r.ajudantes_so.map((a) => (
              <span key={a.usuario_id}>
                {primeiroNome(r.pessoas[a.usuario_id]?.nome ?? 'Alguém')} ({a.ajudas})
              </span>
            ))}
          </p>
        )}
      </div>

      <Painel
        titulo="Melhores tempos"
        dica="Os 8 móveis com o melhor tempo contra o padrão do modelo (modelos com 2 ou mais montagens válidas)."
      >
        {r.melhores.length === 0 ? (
          <Vazio>Precisa de pelo menos 2 montagens válidas do mesmo móvel.</Vazio>
        ) : (
          <ol className="flex flex-col divide-y divide-borda">
            {r.melhores.map((m, i) => (
              <li key={`${m.modelo}-${i}`} className="flex items-start gap-3 py-2">
                <Trophy aria-hidden className="mt-0.5 size-4 shrink-0 text-texto-suave" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{m.modelo ?? 'Móvel sem modelo'}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-texto-suave">
                    <Montadores ids={m.montadores} pessoas={r.pessoas} />· {diaCurto(m.dia)}
                    {m.origem === 'trello' && ' · histórico do Trello'}
                  </span>
                  <span className="text-xs">
                    <ContraPadrao
                      segundos={m.execucao_s}
                      padrao={m.padrao_s}
                      faixaPct={r.faixa_pct}
                    />
                  </span>
                </div>
                <span className="text-lg font-semibold tabular-nums">{duracao(m.execucao_s)}</span>
              </li>
            ))}
          </ol>
        )}
      </Painel>
    </div>
  )
}

function CartaoDaPessoa({
  c,
  pessoas,
  faixa,
  verbo,
}: {
  c: CartaoPessoa
  pessoas: MapaPessoas
  faixa: number
  verbo: string
}) {
  const p = pessoas[c.usuario_id]
  return (
    <article className="flex h-full flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4">
      <header className="flex items-center gap-3">
        <AvatarPessoa nome={p?.nome ?? null} foto={p?.foto ?? null} tamanho="md" />
        <h3 className="text-base font-semibold">{p?.nome ?? 'Alguém'}</h3>
      </header>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <Numero rotulo={`móveis ${verbo}`} valor={c.moveis} />
        <Numero rotulo={`por dia trabalhado (${c.dias})`} valor={decimal(c.por_dia)} />
        <Numero rotulo="mediana por móvel" valor={duracao(c.mediana_s)} />
        <Numero rotulo="tempo total (o esforço)" valor={horas(c.tempo_total_s)} />
        <Numero rotulo="ajudas dadas" valor={c.ajudas} />
        <Numero
          rotulo="ocupação no setor"
          valor={c.ocupacao_pct !== null ? `${c.ocupacao_pct}%` : '—'}
        />
      </dl>
      {/* contra o padrão: seta + texto (verde/laranja/vermelho são da qualidade) */}
      <ul className="flex flex-col gap-1 text-sm">
        <li className="flex items-center gap-2">
          <ArrowDown aria-hidden className="size-4 text-texto-suave" />
          <span>
            <strong className="tabular-nums">{c.abaixo}</strong>{' '}
            {c.abaixo === 1 ? 'modelo' : 'modelos'} abaixo do padrão (mais rápido)
          </span>
        </li>
        <li className="flex items-center gap-2">
          <Equal aria-hidden className="size-4 text-texto-suave" />
          <span>
            <strong className="tabular-nums">{c.na_media}</strong> na média (até {faixa}%)
          </span>
        </li>
        <li className="flex items-center gap-2">
          <ArrowUp aria-hidden className="size-4 text-texto-suave" />
          <span>
            <strong className="tabular-nums">{c.acima}</strong>{' '}
            {c.acima === 1 ? 'modelo' : 'modelos'} acima do padrão (mais lento)
          </span>
        </li>
      </ul>
      {c.melhor && (
        <p className="mt-auto border-t border-borda pt-2 text-sm text-texto-suave">
          Melhor: <span className="text-texto">{c.melhor.modelo ?? 'móvel sem modelo'}</span> em{' '}
          <strong className="text-texto tabular-nums">{duracao(c.melhor.execucao_s)}</strong>
          {c.melhor.padrao_s !== null && <> (padrão {duracao(c.melhor.padrao_s)})</>}
        </p>
      )}
    </article>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-texto-suave">{rotulo}</dt>
      <dd className="text-lg font-semibold tabular-nums">{valor}</dd>
    </div>
  )
}
