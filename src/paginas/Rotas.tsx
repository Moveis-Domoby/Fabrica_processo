import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  MapPin,
  MessageCircle,
  PackageX,
  RotateCcw,
  Search,
  Truck,
} from 'lucide-react'
import { Botao, Campo, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useAoVivo } from '@/lib/aoVivo'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarSetores } from '@/kanban/api'
import { urlFotoCaminhao } from '@/admin/caminhoes'
import {
  enderecoLegivel,
  linkMapa,
  linkWhatsApp,
  listarEntregas,
  registrarEntrega,
} from '@/rotas/api'
import type { Entrega, TipoMotivo } from '@/rotas/api'
import { ModalDevolvido, ModalMotivoEntrega } from '@/rotas/ModaisEntrega'

const POR_PAGINA = 20

// D-45: só o pedido LANÇADO pelos Pedidos em aguardo chega aqui — não existe
// mais "aguardando completar" nas ROTAS. ↪️ SESSAO-30 (D-120): e só o que FALTA
// entregar — o entregue sai da ROTAS e mora no PCP → Todos os pedidos.

function dataLegivel(iso: string | null): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '—'
}

/**
 * ROTAS → Entregas (SESSAO-11 / D-33; revista na SESSAO-15 / D-45): as
 * entregas nascem AQUI — nada mais se cria no ClickUp. A entrega é por PEDIDO
 * COMPLETO ("não vamos entregar 10 móveis se ele pediu 30"), e SÓ o pedido
 * lançado pelos Pedidos em aguardo aparece. O card mostra o dia e o caminhão
 * programados (D-39). Quem vê: a logística — admin, PCP (que É a logística)
 * e terminais.
 *
 * SESSAO-30 (D-113): "Entregue" fecha tudo do pedido aqui e, com a chave
 * "Entregue vai ao Tiny" ligada (super admin), o Tiny fica "Entregue" pela
 * fila; "Desfazer" (só a do dia, com motivo) volta os dois lados. "Não
 * entregue" (motivo) devolve o pedido para "Programar"; "Pedido devolvido"
 * leva os móveis ao ESTOQUE sem dono (D-114). O fluxo do ClickUp segue vivo.
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

  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(0)
  const [entregando, setEntregando] = useState<Entrega | null>(null)
  const [comMotivo, setComMotivo] = useState<{ tipo: TipoMotivo; entrega: Entrega } | null>(null)
  const [devolvendo, setDevolvendo] = useState<Entrega | null>(null)

  const { data: entregas = [], isPending } = useQuery({
    queryKey: ['rotas', 'pronta', busca, pagina],
    queryFn: () =>
      listarEntregas({
        situacao: 'pronta',
        busca: busca || undefined,
        limite: POR_PAGINA,
        deslocamento: pagina * POR_PAGINA,
      }),
    enabled: tenhoAcesso,
  })
  // SESSAO-30 (Lei §4): entrega/programação mudou → AO VIVO, sem o relógio de 30 s.
  useAoVivo('rotas', [['rotas']], tenhoAcesso)
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
          As entregas da fábrica, por pedido completo — só o que foi lançado pelos Pedidos em
          aguardo chega aqui. Programe o dia e o caminhão em{' '}
          <Link to="/rotas/programacao" className="font-medium text-texto underline">
            Programação
          </Link>
          . Entregue, o pedido sai daqui e fica no PCP → Todos os pedidos, com tudo dele. Com o
          "Entregue vai ao Tiny" ligado, a entrega registrada aqui vai também para o Tiny.
        </p>
      </div>

      <div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
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
          Nenhuma entrega por aqui{busca ? ' para esta busca' : ' ainda'} — o pedido aparece quando
          é lançado pelos Pedidos em aguardo.
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
                <span className="rounded-full bg-acao px-2.5 py-0.5 text-sm font-semibold text-acao-texto">
                  pronta para entrega
                </span>
                <span className="ml-auto text-sm text-texto-suave tabular-nums">
                  previsão {dataLegivel(entrega.data_prevista)}
                </span>
              </div>

              {/* D-39: o dia e o caminhão programados, no card. */}
              {entrega.programacao_data ? (
                <p className="flex flex-wrap items-center gap-2 text-sm text-texto">
                  {entrega.caminhao_foto ? (
                    <img
                      src={urlFotoCaminhao(entrega.caminhao_foto) ?? undefined}
                      alt=""
                      className="size-8 rounded-dm object-cover"
                    />
                  ) : (
                    <Truck aria-hidden className="size-5 text-texto-suave" />
                  )}
                  <span className="font-medium tabular-nums">
                    {dataLegivel(entrega.programacao_data)}
                  </span>
                  <span className="text-texto-suave">
                    · {entrega.caminhao_nome}
                    {entrega.caminhao_placa ? ` (${entrega.caminhao_placa})` : ''}
                  </span>
                </p>
              ) : (
                entrega.situacao_entrega === 'pronta' && (
                  <p className="text-sm text-texto-suave">
                    Sem programação —{' '}
                    <Link to="/rotas/programacao" className="font-medium text-texto underline">
                      programar caminhão
                    </Link>
                  </p>
                )
              )}

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
                      <span className="flex flex-wrap items-center justify-end gap-2">
                        <Botao
                          variante="secundaria"
                          tamanho="sm"
                          icone={<RotateCcw />}
                          onClick={() => setComMotivo({ tipo: 'nao_entregue', entrega })}
                        >
                          Não entregue
                        </Botao>
                        <Botao
                          variante="secundaria"
                          tamanho="sm"
                          icone={<PackageX />}
                          onClick={() => setDevolvendo(entrega)}
                        >
                          Pedido devolvido
                        </Botao>
                        <Botao icone={<CheckCircle2 />} onClick={() => setEntregando(entrega)}>
                          Entregue
                        </Botao>
                      </span>
                    ))}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      <ModalMotivoEntrega
        key={comMotivo ? `${comMotivo.tipo}-${comMotivo.entrega.card_id}` : 'motivo-fechado'}
        tipo={comMotivo?.tipo ?? 'nao_entregue'}
        pedido={comMotivo?.entrega ?? null}
        aoFechar={() => setComMotivo(null)}
      />
      <ModalDevolvido
        key={devolvendo ? `devolvido-${devolvendo.card_id}` : 'devolvido-fechado'}
        pedido={devolvendo}
        aoFechar={() => setDevolvendo(null)}
      />

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
