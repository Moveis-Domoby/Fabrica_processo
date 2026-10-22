import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  CircleAlert,
  CirclePause,
  CircleX,
  DoorOpen,
  Pause,
  RotateCcw,
  Truck,
  Undo2,
} from 'lucide-react'
import { Botao, Modal } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarSetores } from '@/kanban/api'
import { formatarDuracaoMs } from '@/kanban/tempo'
import { useAbrirCard } from '@/kanban/janela/abrirCard'
import { dashMotivos, dashMotivosDetalhe } from '@/dashboards/api'
import type { AreaMotivo, MotivoContado, PeriodoDash } from '@/dashboards/api'
import { usePainelDash } from '@/dashboards/painel'
import { Heroi } from '@/dashboards/componentes/Heroi'
import { Visualizacoes } from '@/dashboards/componentes/Visualizacoes'
import { FiltroPill, FiltroSetor } from '@/dashboards/componentes/Filtros'
import { OPCOES_PERIODO } from '@/dashboards/opcoes'

const tempo = (segundos: number | null | undefined) => formatarDuracaoMs((segundos ?? 0) * 1000)
const vezes = (n: number) => `${n} ${n === 1 ? 'vez' : 'vezes'}`
const pct = (parte: number, todo: number) =>
  todo > 0 ? `${Math.round((parte / todo) * 100)}%` : '—'

interface Aberto {
  area: AreaMotivo
  chave: string
  titulo: string
  comTempo: boolean
}

/**
 * MOTIVOS (SESSAO-39 · D-176 — pedido do dono: "uma dash para medir as
 * questões da fábrica e rotas … quais são os maiores problemas em cada um
 * desses pontos"). Quatro áreas, cada uma respondendo UMA pergunta em língua
 * de fábrica (regra 10 do LEIA-ME dos painéis): por que a produção para, por
 * que o PCP segura pedido, por que a entrega não acontece, onde a peça sai com
 * problema. Número-herói antes de ranking (regra 1); ranking do maior para o
 * menor (regra 9), um matiz só (regra 2 — verde/laranja/vermelho são da
 * qualidade). A tela inteira numa requisição (Lei §1); o clique num motivo
 * traz as ocorrências (Lei §3), por cursor. Quem vê: D-32 (o banco decide).
 */
export function Motivos() {
  const { perfil, ehLider, carregando } = useSessao()
  const { config, periodo, visualizacoes, selecionada, mudar, aplicarVisualizacao } =
    usePainelDash('motivos')
  const souAdmin = perfil?.papel === 'admin'
  const [aberto, setAberto] = useState<Aberto | null>(null)

  const { data: setores = [] } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
    staleTime: 10 * 60_000,
  })
  const consulta = useQuery({
    queryKey: ['dash', 'motivos', periodo, config.setorId],
    queryFn: () => dashMotivos(periodo, config.setorId),
    enabled: perfil !== null,
  })
  const dados = consulta.data

  if (carregando) return null
  if (!perfil) return null
  if (!souAdmin && !ehLider) return <Navigate to="/" replace />

  const rotuloPeriodo =
    OPCOES_PERIODO.find((o) => o.valor === String(config.periodoDias))?.rotulo ??
    `${config.periodoDias} dias`
  const setoresProducao = setores
    .filter((s) => s.papel_no_fluxo === 'producao')
    .map((s) => ({ valor: String(s.id), rotulo: s.nome }))
  const abrir = (area: AreaMotivo, comTempo: boolean) => (m: MotivoContado) =>
    setAberto({ area, chave: m.chave, titulo: m.motivo, comTempo })

  const prod = dados?.producao ?? null
  const rotas = dados?.rotas ?? null
  const pcp = dados?.pcp ?? null
  const qual = dados?.qualidade ?? null
  const topoPausa = prod?.pausas[0]
  const tentativas = rotas ? rotas.entregues + somaVezes(rotas.nao_entregue) : 0
  const problemas = qual?.por_setor.reduce((s, q) => s + q.atencao + q.danificado, 0) ?? 0
  const danificadas = qual?.por_setor.reduce((s, q) => s + q.danificado, 0) ?? 0

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Motivos</h1>
        <p className="mt-1 max-w-3xl text-texto-suave">
          Por que a produção para, por que o pedido fica segurado e por que a entrega não acontece —
          do maior problema para o menor. Toque num motivo para ver cada vez que ele aconteceu.
          {!souAdmin && ' Você vê os setores em que é líder.'}
        </p>
      </div>

      <Visualizacoes
        usuarioId={perfil.id}
        config={config}
        visualizacoes={visualizacoes}
        selecionadaId={selecionada ? String(selecionada.id) : ''}
        aoAplicar={aplicarVisualizacao}
      />

      <div className="flex flex-wrap items-center gap-3">
        <FiltroPill
          rotulo="Período"
          opcoes={OPCOES_PERIODO}
          valor={String(config.periodoDias) as (typeof OPCOES_PERIODO)[number]['valor']}
          aoMudar={(v) => mudar({ periodoDias: Number(v) })}
        />
        <FiltroSetor
          opcoes={setoresProducao}
          valor={config.setorId === null ? 'todos' : String(config.setorId)}
          aoMudar={(v) => mudar({ setorId: v === 'todos' ? null : Number(v) })}
        />
      </div>
      {config.setorId !== null && (
        <p className="text-sm text-texto-suave">
          Com um setor escolhido, o painel mostra só a produção e a qualidade dele — o PCP e as
          rotas ficam em "todos os setores".
        </p>
      )}

      {consulta.isPending && <p className="text-sm text-texto-fraco">Somando os motivos…</p>}
      {consulta.isError && (
        <p className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
          {consulta.error instanceof Error
            ? consulta.error.message
            : 'Não deu para carregar o painel.'}
        </p>
      )}

      {dados && (
        <>
          {/* ---------- os números-herói (regra 1) ---------- */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {prod && (
              <Heroi
                rotulo="Mais tempo parado"
                icone={<Pause aria-hidden className="size-4" />}
                valor={topoPausa ? tempo(topoPausa.segundos) : '—'}
                detalhe={
                  topoPausa
                    ? `${topoPausa.motivo} · ${vezes(topoPausa.vezes)} · ${rotuloPeriodo.toLowerCase()}`
                    : `Nenhuma pausa em ${rotuloPeriodo.toLowerCase()}`
                }
              />
            )}
            {pcp && (
              <Heroi
                rotulo="Em stand-by agora"
                icone={<CirclePause aria-hidden className="size-4" />}
                valor={pcp.em_standby_agora}
                detalhe={
                  pcp.standby[0]
                    ? `Motivo mais comum: ${pcp.standby[0].motivo}`
                    : 'Nenhum pedido segurado no período'
                }
              />
            )}
            {rotas && (
              <Heroi
                rotulo="Não entregues"
                icone={<RotateCcw aria-hidden className="size-4" />}
                tom={somaVezes(rotas.nao_entregue) > 0 ? 'danificado' : 'padrao'}
                valor={somaVezes(rotas.nao_entregue)}
                detalhe={
                  tentativas > 0
                    ? `${pct(somaVezes(rotas.nao_entregue), tentativas)} de ${tentativas} tentativas${
                        rotas.nao_entregue[0]
                          ? ` · mais comum: ${rotas.nao_entregue[0].motivo}`
                          : ''
                      }`
                    : `Nenhuma tentativa de entrega em ${rotuloPeriodo.toLowerCase()}`
                }
              />
            )}
            {qual && (
              <Heroi
                rotulo="Peças com problema"
                icone={<CircleAlert aria-hidden className="size-4" />}
                valor={problemas}
                detalhe={
                  problemas > 0
                    ? `${danificadas} ${danificadas === 1 ? 'danificada' : 'danificadas'} · mais em ${qual.por_setor[0]?.setor ?? '—'}`
                    : 'Nenhuma marcada com atenção ou danificada'
                }
              />
            )}
          </div>

          {!prod && !pcp && !rotas && (
            <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
              Nenhum setor deste painel está com você.
            </p>
          )}

          {/* ---------- PRODUÇÃO ---------- */}
          {prod && (
            <Secao
              icone={<Pause aria-hidden className="size-5" />}
              titulo="Por que a produção para"
              explica="Pausas e paradas dos cards: quantas vezes e quanto tempo cada motivo deixou gente parada (só no horário de trabalho do setor; quem ajudava conta também)."
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Ranking
                  titulo="Por motivo"
                  itens={prod.pausas}
                  medida="tempo"
                  vazio="Nenhuma pausa no período."
                  aoAbrir={abrir('pausa', true)}
                  marca={(m) => (m.especial ? 'especial · não conta para a pessoa' : null)}
                />
                <div className="flex flex-col gap-4">
                  <RankingSimples
                    titulo="Por setor"
                    linhas={prod.pausas_por_setor.map((x) => ({
                      chave: String(x.setor_id),
                      nome: x.setor,
                      valor: x.segundos,
                      texto: `${tempo(x.segundos)} · ${vezes(x.vezes)}`,
                    }))}
                  />
                  <RankingSimples
                    titulo="Quem mais ficou parado"
                    linhas={prod.pausas_por_pessoa.map((x) => ({
                      chave: x.usuario_id,
                      nome: x.nome,
                      valor: x.segundos,
                      texto: `${tempo(x.segundos)} · ${vezes(x.vezes)}`,
                    }))}
                  />
                </div>
              </div>
            </Secao>
          )}

          {prod && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Secao
                icone={<DoorOpen aria-hidden className="size-5" />}
                titulo="Por que as pessoas saem do setor"
                explica="As saídas pelo tablet, com o tempo de trabalho até a pessoa entrar de novo."
              >
                <Ranking
                  titulo="Por motivo"
                  itens={prod.saidas}
                  medida="tempo"
                  vazio="Ninguém saiu do setor pelo tablet no período."
                  aoAbrir={abrir('saida', true)}
                />
              </Secao>
              <Secao
                icone={<ArrowRightLeft aria-hidden className="size-5" />}
                titulo="Por que os cards foram movidos"
                explica="O botão Mover da liderança: cada card mandado para a fila de outro setor."
              >
                <Ranking
                  titulo="Por motivo"
                  itens={prod.mover}
                  medida="vezes"
                  vazio="Nenhum card movido pelo botão no período."
                  aoAbrir={abrir('mover', false)}
                />
                {prod.mover_caminhos.length > 0 && (
                  <RankingSimples
                    titulo="De onde para onde"
                    linhas={prod.mover_caminhos.map((x) => ({
                      chave: `${x.de}>${x.para}`,
                      nome: `${x.de} → ${x.para}`,
                      valor: x.vezes,
                      texto: vezes(x.vezes),
                    }))}
                  />
                )}
              </Secao>
            </div>
          )}

          {/* ---------- PCP ---------- */}
          {pcp && (
            <Secao
              icone={<CirclePause aria-hidden className="size-5" />}
              titulo="Por que o PCP segura pedidos"
              explica="Os pedidos postos em stand-by no período e quanto tempo de trabalho ficaram segurados (os que ainda estão contam até agora)."
            >
              <Ranking
                titulo="Por motivo"
                itens={pcp.standby}
                medida="tempo"
                vazio="Nenhum pedido em stand-by no período."
                aoAbrir={abrir('standby', true)}
                marca={(m) =>
                  m.agora ? `${m.agora} ainda segurado${m.agora === 1 ? '' : 's'}` : null
                }
              />
            </Secao>
          )}

          {/* ---------- ROTAS ---------- */}
          {rotas && (
            <Secao
              icone={<Truck aria-hidden className="size-5" />}
              titulo="Por que a entrega não acontece"
              explica={`O "não entregue" de cada parada, por motivo, por caminhão e por quem marcou — e as devoluções e entregas desfeitas.`}
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Ranking
                  titulo="Não entregue · por motivo"
                  itens={rotas.nao_entregue}
                  medida="vezes"
                  vazio="Nenhuma entrega deixou de acontecer no período."
                  aoAbrir={abrir('nao_entregue', false)}
                />
                <div className="flex flex-col gap-4">
                  <RankingSimples
                    titulo="Por caminhão"
                    linhas={rotas.por_caminhao.map((x) => ({
                      chave: String(x.caminhao_id),
                      nome: x.caminhao,
                      valor: x.vezes,
                      texto: vezes(x.vezes),
                    }))}
                  />
                  <RankingSimples
                    titulo="Por quem marcou"
                    linhas={rotas.por_pessoa.map((x) => ({
                      chave: x.usuario_id,
                      nome: x.nome,
                      valor: x.vezes,
                      texto: vezes(x.vezes),
                    }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Ranking
                  titulo="Devolução · por motivo"
                  icone={<Undo2 aria-hidden className="size-4" />}
                  itens={rotas.devolucao}
                  medida="vezes"
                  vazio="Nenhuma devolução no período."
                  aoAbrir={abrir('devolucao', false)}
                />
                <Ranking
                  titulo="Entrega desfeita · por motivo"
                  icone={<RotateCcw aria-hidden className="size-4" />}
                  itens={rotas.desfeita}
                  medida="vezes"
                  vazio="Nenhuma entrega desfeita no período."
                  aoAbrir={abrir('desfeita', false)}
                />
              </div>
            </Secao>
          )}

          {/* ---------- QUALIDADE ---------- */}
          {qual && (
            <Secao
              icone={<CircleX aria-hidden className="size-5" />}
              titulo="Onde a peça sai com problema"
              explica="As peças que saíram de cada setor marcadas com atenção ou danificadas, e as divergências (quem recebeu discordou). Toque num setor para ver cada peça."
            >
              {qual.por_setor.length === 0 ? (
                <p className="text-sm text-texto-fraco">
                  Nenhuma peça saiu com atenção, danificada ou com divergência no período.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {qual.por_setor.map((q) => (
                    <li key={q.setor_id}>
                      <button
                        type="button"
                        onClick={() =>
                          setAberto({
                            area: 'qualidade',
                            chave: `setor:${q.setor_id}`,
                            titulo: `Peças com problema · ${q.setor}`,
                            comTempo: false,
                          })
                        }
                        className="flex w-full min-h-12 flex-wrap items-center gap-x-4 gap-y-1 rounded-dm border border-borda bg-superficie px-3 py-2 text-left text-sm hover:bg-superficie-sutil"
                      >
                        <span className="min-w-28 font-medium text-texto">{q.setor}</span>
                        <span className="inline-flex items-center gap-1 text-atencao-texto">
                          <CircleAlert aria-hidden className="size-4" /> {q.atencao} com atenção
                        </span>
                        <span className="inline-flex items-center gap-1 text-danificado-texto">
                          <CircleX aria-hidden className="size-4" /> {q.danificado} danificada
                          {q.danificado === 1 ? '' : 's'}
                        </span>
                        <span className="text-texto-suave">
                          {q.divergencias} divergência{q.divergencias === 1 ? '' : 's'}
                        </span>
                        <span className="ml-auto text-texto-suave tabular-nums">
                          {pct(q.atencao + q.danificado, q.marcadas)} de {q.marcadas} marcadas
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Secao>
          )}
        </>
      )}

      <ModalOcorrencias
        key={aberto ? `${aberto.area}-${aberto.chave}` : 'fechado'}
        aberto={aberto}
        periodo={periodo}
        setorId={config.setorId}
        aoFechar={() => setAberto(null)}
      />
    </div>
  )
}

function somaVezes(lista: MotivoContado[]): number {
  return lista.reduce((s, m) => s + m.vezes, 0)
}

function Secao({
  icone,
  titulo,
  explica,
  children,
}: {
  icone: ReactNode
  titulo: string
  explica: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 rounded-dm-lg border border-borda bg-superficie p-4 sm:p-5">
      <header>
        <h2 className="flex items-center gap-2 text-lg">
          <span className="text-texto-suave">{icone}</span>
          {titulo}
        </h2>
        <p className="mt-0.5 text-sm text-texto-suave">{explica}</p>
      </header>
      {children}
    </section>
  )
}

/**
 * O ranking de motivos: a barra mede o tempo (ou as vezes), do maior para o
 * menor; rótulo direto na ponta (regra 4); cada linha abre as ocorrências.
 */
function Ranking({
  titulo,
  icone,
  itens,
  medida,
  vazio,
  aoAbrir,
  marca,
}: {
  titulo: string
  icone?: ReactNode
  itens: MotivoContado[]
  medida: 'tempo' | 'vezes'
  vazio: string
  aoAbrir: (m: MotivoContado) => void
  marca?: (m: MotivoContado) => string | null
}) {
  const valor = (m: MotivoContado) => (medida === 'tempo' ? (m.segundos ?? 0) : m.vezes)
  const maximo = Math.max(1, ...itens.map(valor))
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-texto">
        {icone}
        {titulo}
      </h3>
      {itens.length === 0 ? (
        <p className="text-sm text-texto-fraco">{vazio}</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {itens.map((m, i) => {
            const texto =
              medida === 'tempo' ? `${tempo(m.segundos)} · ${vezes(m.vezes)}` : vezes(m.vezes)
            const extra = marca?.(m) ?? null
            return (
              <li key={m.chave}>
                <button
                  type="button"
                  onClick={() => aoAbrir(m)}
                  title={`${m.motivo}: ${texto} — toque para ver cada vez`}
                  className="group flex w-full min-h-11 flex-col gap-1 rounded-dm px-2 py-1.5 text-left hover:bg-superficie-sutil focus-visible:outline-2 focus-visible:outline-foco"
                >
                  <span className="flex w-full items-baseline gap-2 text-sm">
                    <span className="w-5 shrink-0 text-right text-xs text-texto-fraco tabular-nums">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-texto">
                      {m.motivo}
                    </span>
                    {extra && (
                      <span className="shrink-0 rounded-full bg-superficie-sutil px-2 py-0.5 text-xs text-texto-suave">
                        {extra}
                      </span>
                    )}
                    <span className="shrink-0 text-texto tabular-nums">{texto}</span>
                  </span>
                  <span className="ml-7 block h-2 rounded-r-full bg-superficie-sutil">
                    <span
                      className="block h-2 rounded-r-full"
                      style={{
                        width: `${Math.max(2, (valor(m) / maximo) * 100)}%`,
                        backgroundColor: 'var(--dm-serie-fila)',
                      }}
                    />
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

/** Um ranking curto sem clique (por setor, por pessoa, por caminhão). */
function RankingSimples({
  titulo,
  linhas,
}: {
  titulo: string
  linhas: { chave: string; nome: string; valor: number; texto: string }[]
}) {
  const maximo = Math.max(1, ...linhas.map((l) => l.valor))
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="text-sm font-semibold text-texto">{titulo}</h3>
      {linhas.length === 0 ? (
        <p className="text-sm text-texto-fraco">Nada no período.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {linhas.map((l) => (
            <li key={l.chave} className="flex flex-col gap-1" title={`${l.nome}: ${l.texto}`}>
              <span className="flex items-baseline gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-texto">{l.nome}</span>
                <span className="shrink-0 text-texto-suave tabular-nums">{l.texto}</span>
              </span>
              <span className="block h-1.5 rounded-r-full bg-superficie-sutil">
                <span
                  className="block h-1.5 rounded-r-full"
                  style={{
                    width: `${Math.max(2, (l.valor / maximo) * 100)}%`,
                    backgroundColor: 'var(--dm-serie-fila)',
                  }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** As ocorrências de um motivo — no clique (Lei §3), 20 por vez, por cursor. */
function ModalOcorrencias({
  aberto,
  periodo,
  setorId,
  aoFechar,
}: {
  aberto: Aberto | null
  periodo: PeriodoDash
  setorId: number | null
  aoFechar: () => void
}) {
  const abrirCard = useAbrirCard()
  const consulta = useInfiniteQuery({
    queryKey: ['dash', 'motivos-detalhe', aberto?.area, aberto?.chave, periodo, setorId],
    queryFn: ({ pageParam }) =>
      dashMotivosDetalhe({
        area: aberto!.area,
        chave: aberto!.chave,
        periodo,
        setorId,
        antes: pageParam,
      }),
    initialPageParam: null as { em: string; id: number } | null,
    getNextPageParam: (ultima) =>
      ultima.length === 20
        ? { em: ultima[ultima.length - 1].quando, id: ultima[ultima.length - 1].id }
        : undefined,
    enabled: aberto !== null,
    // D-89: busca ao abrir e esquece ao fechar.
    gcTime: 0,
  })
  const linhas = useMemo(() => consulta.data?.pages.flat() ?? [], [consulta.data])
  return (
    <Modal
      aberto={aberto !== null}
      aoFechar={(v) => !v && aoFechar()}
      titulo={aberto?.titulo ?? ''}
      descricao="Cada vez que aconteceu no período, da mais recente para a mais antiga."
    >
      <div className="flex flex-col gap-3">
        {consulta.isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
        {consulta.isError && (
          <p className="text-sm text-danificado-forte" role="alert">
            {consulta.error instanceof Error ? consulta.error.message : 'Não deu para carregar.'}
          </p>
        )}
        {!consulta.isPending && linhas.length === 0 && (
          <p className="text-sm text-texto-fraco">Nada no período.</p>
        )}
        <ul className="flex flex-col divide-y divide-borda rounded-dm border border-borda">
          {linhas.map((o) => (
            <li key={o.id} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
              <span className="flex flex-wrap items-baseline gap-x-2 text-texto">
                <span className="text-texto-suave tabular-nums">
                  {new Date(o.quando).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {o.pessoa && <span className="font-medium">{o.pessoa}</span>}
                {o.onde && <span className="text-texto-suave">· {o.onde}</span>}
                {aberto?.comTempo && o.segundos !== null && (
                  <span className="ml-auto tabular-nums">{tempo(o.segundos)}</span>
                )}
              </span>
              {o.motivo && <span className="text-texto-suave">“{o.motivo}”</span>}
              {o.o_que && o.card_id ? (
                <button
                  type="button"
                  className={cn('self-start text-left text-sm font-medium text-texto underline')}
                  onClick={() => {
                    aoFechar()
                    abrirCard(o.card_id!)
                  }}
                >
                  {o.o_que}
                </button>
              ) : (
                o.o_que && <span className="text-texto">{o.o_que}</span>
              )}
            </li>
          ))}
        </ul>
        {consulta.hasNextPage && (
          <Botao
            variante="secundaria"
            className="self-center"
            carregando={consulta.isFetchingNextPage}
            onClick={() => consulta.fetchNextPage()}
          >
            Ver mais
          </Botao>
        )}
      </div>
    </Modal>
  )
}
