import { useState } from 'react'
import { Navigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, MapPin, MessageCircle, Search, Truck } from 'lucide-react'
import { Botao, Campo, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarSetores } from '@/kanban/api'
import {
  enderecoLegivel,
  linkMapa,
  linkWhatsApp,
  listarEntregas,
  registrarEntrega,
} from '@/rotas/api'
import type { Entrega } from '@/rotas/api'

const POR_PAGINA = 20

const SITUACOES = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'aguardando', rotulo: 'Aguardando completar' },
  { valor: 'pronta', rotulo: 'Prontas para entrega' },
  { valor: 'entregue', rotulo: 'Entregues' },
]

function dataLegivel(iso: string | null): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '—'
}

/**
 * ROTAS dentro da plataforma (SESSAO-11 / D-33): as entregas nascem AQUI —
 * nada mais se cria no ClickUp. A entrega é por PEDIDO COMPLETO ("não vamos
 * entregar 10 móveis se ele pediu 30"). Quem vê: a logística — admin, PCP
 * (que É a logística) e terminais.
 *
 * ⚠️ Marcar "Entregue" aqui NÃO atualiza o Tiny — a automação do ClickUp que
 * faz isso continua viva e intocada; ligar os dois é decisão futura do dono.
 */
export function Rotas() {
  const { perfil, vinculos, carregando } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const souAdmin = perfil?.papel === 'admin'
  const { data: setores = [], isPending: carregandoSetores } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
  })
  const setoresComAcesso = new Set(
    setores.filter((s) => s.papel_no_fluxo !== 'producao').map((s) => s.id),
  )
  const tenhoAcesso = souAdmin || vinculos.some((v) => setoresComAcesso.has(v.setor_id))

  const [situacao, setSituacao] = useState('todas')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(0)
  const [entregando, setEntregando] = useState<Entrega | null>(null)

  const { data: entregas = [], isPending } = useQuery({
    queryKey: ['rotas', situacao, busca, pagina],
    queryFn: () =>
      listarEntregas({
        situacao: situacao === 'todas' ? null : situacao,
        busca: busca || undefined,
        limite: POR_PAGINA,
        deslocamento: pagina * POR_PAGINA,
      }),
    enabled: tenhoAcesso,
    refetchInterval: 30_000,
  })
  const total = Number(entregas[0]?.contagem_total ?? 0)

  const entregarMutacao = useMutation({
    mutationFn: (entrega: Entrega) => registrarEntrega({ cardId: entrega.card_id }),
    onSuccess: async (_dados, entrega) => {
      notificar({ titulo: `Pedido ${entrega.numero} entregue`, tom: 'perfeito' })
      setEntregando(null)
      await clienteQuery.invalidateQueries({ queryKey: ['rotas'] })
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para registrar a entrega',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  if (!carregando && !carregandoSetores && setores.length > 0 && !tenhoAcesso)
    return <Navigate to="/" replace />
  if (!perfil) return null

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-3 text-2xl sm:text-3xl">
          <Truck aria-hidden className="size-7 text-texto-suave" />
          ROTAS
        </h1>
        <p className="mt-1 max-w-2xl text-texto-suave">
          As entregas da fábrica, por pedido completo — o pedido fica pronto quando TODAS as
          unidades chegam na ROTAS. Registrar a entrega aqui não mexe no Tiny.
        </p>
      </div>

      <div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        <Selecao
          rotulo="Mostrar"
          opcoes={SITUACOES}
          valor={situacao}
          aoMudar={(v) => {
            setSituacao(v)
            setPagina(0)
          }}
        />
        <Campo
          rotulo="Buscar"
          prefixo={<Search />}
          placeholder="Número do pedido ou cliente"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
            setPagina(0)
          }}
        />
      </div>

      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {!isPending && entregas.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nenhuma entrega por aqui{busca ? ' para esta busca' : ' ainda'} — o pedido aparece
          quando a primeira unidade chega na ROTAS.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {entregas.map((entrega) => {
          const whatsapp = linkWhatsApp(entrega.telefone)
          const mapa = linkMapa(entrega)
          return (
            <li
              key={entrega.card_id}
              className={cn(
                'flex flex-col gap-3 rounded-dm-lg border bg-superficie p-4',
                entrega.situacao_entrega === 'pronta' ? 'border-acao-ativa' : 'border-borda',
              )}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-lg font-semibold text-texto tabular-nums">
                  Pedido {entrega.numero}
                </span>
                {entrega.situacao_entrega === 'entregue' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-perfeito-fundo px-2.5 py-0.5 text-sm font-medium text-perfeito-texto">
                    <CheckCircle2 aria-hidden className="size-4" />
                    entregue
                  </span>
                ) : entrega.situacao_entrega === 'pronta' ? (
                  <span className="rounded-full bg-acao px-2.5 py-0.5 text-sm font-semibold text-acao-texto">
                    pronta para entrega
                  </span>
                ) : (
                  <span className="rounded-full bg-superficie-sutil px-2.5 py-0.5 text-sm font-medium text-texto-suave tabular-nums">
                    {entrega.unidades_em_rotas} de {entrega.total_unidades} na ROTAS
                  </span>
                )}
                <span className="ml-auto text-sm text-texto-suave tabular-nums">
                  previsão {dataLegivel(entrega.data_prevista)}
                </span>
              </div>

              {/* O card de entrega, no formato que o entregador já conhece. */}
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-medium text-texto">{entrega.cliente_nome || 'Sem cliente'}</p>
                <p className="text-texto-suave">{enderecoLegivel(entrega)}</p>
                {entrega.complemento && (
                  <p className="text-texto-suave">Complemento: {entrega.complemento}</p>
                )}
                {entrega.obs && <p className="text-texto-suave">OBS: {entrega.obs}</p>}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {whatsapp && (
                  <a href={whatsapp} target="_blank" rel="noreferrer">
                    <Botao variante="secundaria" tamanho="sm" icone={<MessageCircle />}>
                      WhatsApp
                    </Botao>
                  </a>
                )}
                {mapa && (
                  <a href={mapa} target="_blank" rel="noreferrer">
                    <Botao variante="secundaria" tamanho="sm" icone={<MapPin />}>
                      Mapa
                    </Botao>
                  </a>
                )}
                <span className="ml-auto">
                  {entrega.situacao_entrega === 'pronta' &&
                    (entregando?.card_id === entrega.card_id ? (
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-texto-suave">
                          Confirmar a entrega do pedido inteiro?
                        </span>
                        <Botao
                          tamanho="sm"
                          carregando={entregarMutacao.isPending}
                          onClick={() => entregarMutacao.mutate(entrega)}
                        >
                          Sim, entregue
                        </Botao>
                        <Botao variante="fantasma" tamanho="sm" onClick={() => setEntregando(null)}>
                          Ainda não
                        </Botao>
                      </span>
                    ) : (
                      <Botao
                        icone={<CheckCircle2 />}
                        onClick={() => setEntregando(entrega)}
                      >
                        Entregue
                      </Botao>
                    ))}
                  {entrega.situacao_entrega === 'entregue' && (
                    <span className="text-sm text-texto-fraco">
                      por {entrega.entregue_por ?? '—'}
                      {entrega.entregue_em &&
                        ` · ${new Date(entrega.entregue_em).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`}
                    </span>
                  )}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      {total > POR_PAGINA && (
        <div className="flex items-center justify-end gap-2">
          <Botao
            variante="secundaria"
            tamanho="sm"
            disabled={pagina === 0}
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Botao>
          <span className="text-sm text-texto-suave tabular-nums">
            {pagina * POR_PAGINA + 1}–{pagina * POR_PAGINA + entregas.length} de {total}
          </span>
          <Botao
            variante="secundaria"
            tamanho="sm"
            disabled={(pagina + 1) * POR_PAGINA >= total}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
          </Botao>
        </div>
      )}
    </div>
  )
}
