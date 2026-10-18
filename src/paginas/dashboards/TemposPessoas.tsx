import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Handshake, Play, UsersRound } from 'lucide-react'
import { AvatarPessoa, Modal } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { useAoVivo } from '@/lib/aoVivo'
import { formatarDuracaoMs } from '@/kanban/tempo'
import { tempoPessoaDetalhe, temposPessoas } from '@/dashboards/api'
import type { EstadoPessoa, TempoPessoa } from '@/dashboards/api'
import { FiltroPill } from '@/dashboards/componentes/Filtros'
import { OPCOES_PERIODO } from '@/dashboards/opcoes'

const ROTULO_ESTADO: Record<EstadoPessoa, string> = {
  trabalhando: 'Trabalhando',
  ausente: 'Ausente',
  deriva: 'Fora de setor',
}

/** Dia local (o banco conta os dias no fuso da fábrica). */
function diaIso(deslocamentoDias = 0): string {
  const d = new Date(Date.now() - deslocamentoDias * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const seg = (s: number) => formatarDuracaoMs(s * 1000)

function PilulaEstado({ estado }: { estado: EstadoPessoa | null }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        estado === 'trabalhando' && 'bg-perfeito-fundo text-perfeito-texto',
        estado === 'ausente' && 'bg-atencao-fundo text-atencao-texto',
        (estado === 'deriva' || estado === null) && 'bg-superficie-sutil text-texto-suave',
      )}
    >
      {estado === 'trabalhando' && <Play aria-hidden className="size-3" />}
      {estado ? ROTULO_ESTADO[estado] : 'Fora'}
    </span>
  )
}

/**
 * SESSAO-36 (D-146 resposta 12) — Dashboards → Tempos por pessoa: um scorecard
 * por pessoa com os tempos do período (produção · ausente · fora de setor),
 * derivados dos fatos de presença e execução (agregado diário no banco — a
 * tela nunca varre eventos). Líder e admin veem todo mundo; o funcionário só o
 * próprio (o gate é da porta). Ao vivo pelo canal privado da dashboard.
 */
export function TemposPessoas() {
  const { perfil, carregando } = useSessao()
  const [dias, setDias] = useState(7)
  const [detalheDe, setDetalheDe] = useState<TempoPessoa | null>(null)

  const periodo = useMemo(
    () => ({ de: diaIso(dias - 1), ate: diaIso(0) }),
    [dias],
  )

  const chave = ['tempos-pessoas', periodo] as const
  useAoVivo('tempos', [[...chave]], { esperaMs: 2_000, espalharMs: 4_000 })
  const { data: pessoas = [], isPending } = useQuery({
    queryKey: chave,
    queryFn: () => temposPessoas(periodo),
    enabled: perfil !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const { data: detalhe = null } = useQuery({
    queryKey: ['tempos-pessoa-detalhe', detalheDe?.usuario_id, periodo],
    queryFn: () => tempoPessoaDetalhe(detalheDe!.usuario_id, periodo),
    enabled: detalheDe !== null,
  })

  if (carregando || !perfil) return null

  const rotuloPeriodo =
    OPCOES_PERIODO.find((o) => o.valor === String(dias))?.rotulo ?? `${dias} dias`
  const souSoEu = pessoas.length === 1 && pessoas[0]?.usuario_id === perfil.id

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Tempos por pessoa</h1>
        <p className="mt-1 flex max-w-3xl items-center gap-1.5 text-texto-suave">
          <UsersRound aria-hidden className="size-4 shrink-0" />
          {souSoEu
            ? 'Os seus tempos: em produção, ausente e fora de setor — tudo derivado dos fatos (entrada, pausa, saída).'
            : 'Quem está trabalhando, ausente ou fora de setor — e quanto tempo cada um passou em cada estado no período.'}
        </p>
      </div>

      <FiltroPill
        rotulo="Período"
        opcoes={OPCOES_PERIODO}
        valor={String(dias) as (typeof OPCOES_PERIODO)[number]['valor']}
        aoMudar={(v) => setDias(Number(v))}
      />

      {isPending ? (
        <p className="text-sm text-texto-suave">Carregando…</p>
      ) : pessoas.length === 0 ? (
        <p className="rounded-dm-lg border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nenhum tempo registrado ainda — os estados começam a contar quando as pessoas entram nos
          setores pelo tablet.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pessoas.map((p) => (
            <li key={p.usuario_id}>
              <button
                type="button"
                onClick={() => setDetalheDe(p)}
                className="flex w-full flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4 text-left hover:border-borda-forte"
              >
                <span className="flex items-center gap-3">
                  <AvatarPessoa nome={p.nome} foto={p.foto_caminho} tamanho="lg" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-texto">{p.nome}</span>
                    <span className="mt-0.5">
                      <PilulaEstado estado={p.estado} />
                    </span>
                  </span>
                </span>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-dm bg-superficie-sutil px-2 py-1.5">
                    <dt className="text-[11px] text-texto-suave">Em produção</dt>
                    <dd className="text-sm font-semibold text-texto tabular-nums">
                      {seg(p.producao_s)}
                    </dd>
                  </div>
                  <div className="rounded-dm bg-superficie-sutil px-2 py-1.5">
                    <dt className="text-[11px] text-texto-suave">Ausente</dt>
                    <dd className="text-sm font-semibold text-texto tabular-nums">
                      {seg(p.ausente_s)}
                    </dd>
                  </div>
                  <div className="rounded-dm bg-superficie-sutil px-2 py-1.5">
                    <dt className="text-[11px] text-texto-suave">Fora de setor</dt>
                    <dd className="text-sm font-semibold text-texto tabular-nums">
                      {seg(p.deriva_s)}
                    </dd>
                  </div>
                </dl>
                {p.por_setor.length > 0 && (
                  <p className="truncate text-xs text-texto-suave">
                    {p.por_setor
                      .slice(0, 2)
                      .map((s) => `${s.nome}: ${seg(s.segundos)}`)
                      .join(' · ')}
                    {p.por_setor.length > 2 ? ' · …' : ''}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ---------- o detalhe da pessoa (no clique — 1 requisição) ---------- */}
      <Modal
        aberto={detalheDe !== null}
        aoFechar={(aberto) => {
          if (!aberto) setDetalheDe(null)
        }}
        titulo={detalheDe?.nome ?? ''}
        descricao={`Os tempos de ${rotuloPeriodo.toLowerCase()}, dia a dia e por card.`}
      >
        {detalhe === null ? (
          <p className="text-sm text-texto-suave">Carregando…</p>
        ) : (
          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
            {detalhe.estado && (
              <p className="flex items-center gap-2 text-sm text-texto">
                <PilulaEstado estado={detalhe.estado.estado} />
                <span className="text-texto-suave">
                  desde {new Date(detalhe.estado.desde).toLocaleString('pt-BR')}
                </span>
              </p>
            )}

            {detalhe.por_setor.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-semibold text-texto">Produção por setor</h3>
                <ul className="flex flex-col gap-1">
                  {detalhe.por_setor.map((s) => (
                    <li key={s.setor_id} className="flex justify-between text-sm">
                      <span className="text-texto">{s.nome}</span>
                      <span className="font-medium text-texto tabular-nums">{seg(s.segundos)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className="mb-1 text-sm font-semibold text-texto">Dia a dia</h3>
              {detalhe.dias.length === 0 ? (
                <p className="text-sm text-texto-suave">Nada registrado no período.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {detalhe.dias.map((d) => (
                    <li key={d.dia} className="flex flex-wrap justify-between gap-x-3 text-sm">
                      <span className="text-texto">
                        {new Date(`${d.dia}T12:00:00`).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="text-texto-suave tabular-nums">
                        produção {seg(d.producao_s)} · ausente {seg(d.ausente_s)} · fora{' '}
                        {seg(d.deriva_s)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-1 text-sm font-semibold text-texto">Cards do período</h3>
              {detalhe.execucoes.length === 0 && detalhe.auxilios.length === 0 ? (
                <p className="text-sm text-texto-suave">Nenhum card no período.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {detalhe.execucoes.map((e) => (
                    <li
                      key={`e-${e.card_id}-${e.iniciou_em}`}
                      className="flex flex-wrap items-center justify-between gap-x-3 text-sm"
                    >
                      <span className="inline-flex min-w-0 items-center gap-1 text-texto">
                        <Play aria-hidden className="size-3.5 shrink-0 text-perfeito-forte" />
                        <span className="truncate">{e.rotulo ?? `Card ${e.card_id}`}</span>
                      </span>
                      <span className="text-texto-suave tabular-nums">
                        {seg(e.segundos)}
                        {e.em_andamento ? ' (contando)' : ''}
                      </span>
                    </li>
                  ))}
                  {detalhe.auxilios.map((a) => (
                    <li
                      key={`a-${a.card_id}-${a.iniciado_em}`}
                      className="flex flex-wrap items-center justify-between gap-x-3 text-sm"
                    >
                      <span className="inline-flex min-w-0 items-center gap-1 text-texto">
                        <Handshake aria-hidden className="size-3.5 shrink-0 text-texto-suave" />
                        <span className="truncate">
                          {a.rotulo ?? `Card ${a.card_id}`} (como auxiliar)
                        </span>
                      </span>
                      <span className="text-texto-suave tabular-nums">
                        {seg(a.segundos)}
                        {a.encerrado_em === null ? ' (contando)' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Modal>
    </div>
  )
}
