import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, MapPinOff, Route, Truck, X } from 'lucide-react'
import { Botao, Campo, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useAcessoLogistica } from '@/logistica/acesso'
import { listarCaminhoes, urlFotoCaminhao } from '@/admin/caminhoes'
import {
  desprogramarEntrega,
  enderecoLegivel,
  geocodificar,
  listarProgramacao,
  precisaGeocodificar,
  programarEntrega,
} from '@/rotas/api'
import type { PedidoProgramacao } from '@/rotas/api'
import { MapaProgramacao } from '@/rotas/MapaProgramacao'
import { formatarDistancia, sugerirProximos, temPonto } from '@/rotas/proximidade'

const ATUALIZA_A_CADA = 30_000
const RAIO_SUGESTAO_KM = 5

function hojeIso(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function dataLegivel(iso: string | null): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '—'
}

/**
 * ROTAS → Programação (SESSAO-15 / D-39 / D-45): escolho o dia → vejo os
 * pedidos SEM programação → seleciono os que vão → o mapa lateral desenha os
 * pontos e SUGERE outros pedidos próximos (é só sugestão — quem decide é a
 * pessoa) → confirmo com data + caminhão. Reprogramar pode a qualquer
 * instante; depois de entregue, não. Pedido sem endereço geocodificável
 * aparece com aviso e entra na programação normalmente — só não plota.
 */
export function Programacao() {
  const { perfil, semAcesso, tenhoAcesso } = useAcessoLogistica()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const [dia, setDia] = useState(hojeIso)
  const [selecionados, setSelecionados] = useState<Set<number>>(() => new Set())
  const [confirmando, setConfirmando] = useState(false)
  const [caminhaoId, setCaminhaoId] = useState('')
  const [reprogramando, setReprogramando] = useState<PedidoProgramacao | null>(null)

  const { data: pedidos = [], isPending } = useQuery({
    queryKey: ['programacao', dia],
    queryFn: () => listarProgramacao({ data: dia }),
    enabled: tenhoAcesso,
    refetchInterval: ATUALIZA_A_CADA,
  })
  const { data: caminhoes = [] } = useQuery({
    queryKey: ['caminhoes', false],
    queryFn: () => listarCaminhoes(false),
    enabled: tenhoAcesso,
  })

  const semProgramacao = useMemo(() => pedidos.filter((p) => p.programacao_data === null), [pedidos])
  const programadosNoDia = useMemo(
    () => pedidos.filter((p) => p.programacao_data !== null),
    [pedidos],
  )
  const listaSelecionados = useMemo(
    () => semProgramacao.filter((p) => selecionados.has(p.card_id)),
    [semProgramacao, selecionados],
  )
  const sugestoes = useMemo(
    () => sugerirProximos(listaSelecionados, semProgramacao, RAIO_SUGESTAO_KM),
    [listaSelecionados, semProgramacao],
  )

  // Geocodificação preguiçosa: quem ainda não tem ponto vai à Edge Function
  // (até 10 por vez), uma vez só por chave nesta visita.
  const pedidas = useRef<Set<string>>(new Set())
  const geocodificarMutacao = useMutation({
    mutationFn: geocodificar,
    onSuccess: async () => {
      await clienteQuery.invalidateQueries({ queryKey: ['programacao'] })
    },
  })
  useEffect(() => {
    if (geocodificarMutacao.isPending) return
    const pendentes = pedidos
      .filter((p) => precisaGeocodificar(p) && !pedidas.current.has(p.geo_chave!))
      .slice(0, 10)
    if (pendentes.length === 0) return
    for (const p of pendentes) pedidas.current.add(p.geo_chave!)
    geocodificarMutacao.mutate(
      pendentes.map((p) => ({ chave: p.geo_chave!, endereco: p.endereco_geocodificavel! })),
    )
  }, [pedidos, geocodificarMutacao])

  const programarMutacao = useMutation({
    mutationFn: async (parametros: { cardIds: number[]; data: string; caminhaoId: number }) => {
      for (const cardId of parametros.cardIds) {
        await programarEntrega({ cardId, data: parametros.data, caminhaoId: parametros.caminhaoId })
      }
    },
    onSuccess: async (_dados, parametros) => {
      notificar({
        titulo:
          parametros.cardIds.length === 1
            ? 'Entrega programada'
            : `${parametros.cardIds.length} entregas programadas`,
        tom: 'perfeito',
      })
      setSelecionados(new Set())
      setConfirmando(false)
      setReprogramando(null)
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['programacao'] }),
        clienteQuery.invalidateQueries({ queryKey: ['rotas'] }),
      ])
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para programar',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  const desprogramarMutacao = useMutation({
    mutationFn: (p: PedidoProgramacao) => desprogramarEntrega(p.card_id),
    onSuccess: async (_dados, p) => {
      notificar({ titulo: `Pedido ${p.numero} voltou para "sem programação"`, tom: 'perfeito' })
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['programacao'] }),
        clienteQuery.invalidateQueries({ queryKey: ['rotas'] }),
      ])
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para tirar da programação',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  function alternar(cardId: number) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(cardId)) novo.delete(cardId)
      else novo.add(cardId)
      return novo
    })
  }

  if (semAcesso) return <Navigate to="/" replace />
  if (!perfil) return null

  const opcoesCaminhao = caminhoes.map((c) => ({
    valor: String(c.id),
    rotulo: c.placa ? `${c.nome} · ${c.placa}` : c.nome,
  }))
  const semPonto = listaSelecionados.filter((p) => !temPonto(p)).length

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-3 text-2xl sm:text-3xl">
          <Route aria-hidden className="size-7 text-texto-suave" />
          Programação de caminhão
        </h1>
        <p className="mt-1 max-w-2xl text-texto-suave">
          Escolha o dia, marque os pedidos que vão, veja no mapa quem está perto (é só sugestão —
          a decisão é sua) e confirme com o caminhão.
        </p>
      </div>

      <div className="grid max-w-md grid-cols-1 gap-3">
        <Campo
          rotulo="Dia da entrega"
          type="date"
          prefixo={<CalendarDays />}
          value={dia}
          onChange={(e) => {
            setDia(e.target.value)
            setSelecionados(new Set())
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* A lista: sem programação, com seleção. */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg">
            Sem programação{' '}
            <span className="text-sm font-normal text-texto-suave tabular-nums">
              ({semProgramacao.length})
            </span>
          </h2>
          {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
          {!isPending && semProgramacao.length === 0 && (
            <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
              Nenhum pedido lançado esperando programação.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {semProgramacao.map((p) => {
              const marcado = selecionados.has(p.card_id)
              const sugestao = sugestoes.find((s) => s.item.card_id === p.card_id)
              return (
                <li key={p.card_id}>
                  <label
                    className={cn(
                      'flex min-h-toque-lg cursor-pointer items-start gap-3 rounded-dm-lg border bg-superficie p-3',
                      marcado
                        ? 'border-acao-ativa'
                        : sugestao
                          ? 'border-atencao-borda'
                          : 'border-borda',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-5 shrink-0 accent-marca-500"
                      checked={marcado}
                      onChange={() => alternar(p.card_id)}
                      aria-label={`Selecionar o pedido ${p.numero}`}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-texto tabular-nums">Pedido {p.numero}</span>
                        <span className="text-sm text-texto-suave tabular-nums">
                          {p.total_unidades} unidade(s) · previsão {dataLegivel(p.data_prevista)}
                        </span>
                        {sugestao && !marcado && (
                          <span className="rounded-full bg-atencao-fundo px-2 py-0.5 text-xs font-medium text-atencao-texto">
                            sugestão · {formatarDistancia(sugestao.distanciaKm)}
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-texto">{p.cliente_nome || 'Sem cliente'}</span>
                      <span className="text-sm text-texto-suave">{enderecoLegivel(p)}</span>
                      {p.geo_resolvido === false && (
                        <span className="inline-flex items-center gap-1 text-xs text-atencao-texto">
                          <MapPinOff aria-hidden className="size-3.5" />
                          Endereço não encontrado no mapa — entra na programação, só não plota
                        </span>
                      )}
                      {p.geo_resolvido === null && p.geo_chave && (
                        <span className="text-xs text-texto-fraco">procurando no mapa…</span>
                      )}
                      {!p.geo_chave && (
                        <span className="inline-flex items-center gap-1 text-xs text-atencao-texto">
                          <MapPinOff aria-hidden className="size-3.5" />
                          Sem endereço cadastrado
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>

          {listaSelecionados.length > 0 && (
            <div className="sticky bottom-2 flex flex-wrap items-center gap-3 rounded-dm-lg border border-acao-ativa bg-superficie p-3 shadow-lg">
              <span className="text-sm text-texto tabular-nums">
                {listaSelecionados.length} pedido(s) selecionado(s)
                {semPonto > 0 && (
                  <span className="text-texto-suave"> · {semPonto} sem ponto no mapa</span>
                )}
              </span>
              <span className="ml-auto flex gap-2">
                <Botao variante="fantasma" tamanho="sm" onClick={() => setSelecionados(new Set())}>
                  Limpar
                </Botao>
                <Botao icone={<Truck />} onClick={() => setConfirmando(true)}>
                  Programar
                </Botao>
              </span>
            </div>
          )}
        </section>

        {/* O mapa lateral: seleção + sugestões por proximidade. */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg">
            Mapa{' '}
            <span className="text-sm font-normal text-texto-suave">
              amarelo = selecionados · âmbar = sugestões próximas (até {RAIO_SUGESTAO_KM} km)
            </span>
          </h2>
          <MapaProgramacao
            selecionados={listaSelecionados}
            sugestoes={sugestoes}
            aoEscolherSugestao={(p) => alternar(p.card_id)}
          />
        </section>
      </div>

      {/* Programados no dia escolhido. */}
      <section className="flex flex-col gap-3 border-t border-borda pt-4">
        <h2 className="text-lg">
          Programados para {dataLegivel(dia)}{' '}
          <span className="text-sm font-normal text-texto-suave tabular-nums">
            ({programadosNoDia.length})
          </span>
        </h2>
        {!isPending && programadosNoDia.length === 0 && (
          <p className="text-sm text-texto-suave">Nada programado para este dia ainda.</p>
        )}
        <ul className="flex flex-col gap-2">
          {programadosNoDia.map((p) => {
            const caminhao = caminhoes.find((c) => c.id === p.caminhao_id)
            const foto = urlFotoCaminhao(caminhao?.foto_caminho ?? null)
            return (
              <li
                key={p.card_id}
                className="flex flex-wrap items-center gap-3 rounded-dm-lg border border-borda bg-superficie p-3"
              >
                {foto ? (
                  <img src={foto} alt="" className="size-12 shrink-0 rounded-dm object-cover" />
                ) : (
                  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-dm bg-superficie-sutil text-texto-suave">
                    <Truck aria-hidden className="size-6" />
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold text-texto tabular-nums">
                    Pedido {p.numero} · {p.caminhao_nome ?? 'caminhão'}
                  </span>
                  <span className="text-sm text-texto-suave">
                    {p.cliente_nome || 'Sem cliente'} · {enderecoLegivel(p)}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Botao variante="secundaria" tamanho="sm" onClick={() => setReprogramando(p)}>
                    Reprogramar
                  </Botao>
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    icone={<X />}
                    onClick={() => desprogramarMutacao.mutate(p)}
                    carregando={
                      desprogramarMutacao.isPending &&
                      desprogramarMutacao.variables?.card_id === p.card_id
                    }
                  >
                    Tirar
                  </Botao>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Confirmar: data + caminhão (D-39). O mesmo modal serve para reprogramar. */}
      {(confirmando || reprogramando) && (
        <ModalConfirmar
          key={reprogramando?.card_id ?? 'novo'}
          titulo={
            reprogramando
              ? `Reprogramar o pedido ${reprogramando.numero}`
              : `Programar ${listaSelecionados.length} pedido(s)`
          }
          diaInicial={reprogramando?.programacao_data ?? dia}
          caminhaoInicial={reprogramando?.caminhao_id ? String(reprogramando.caminhao_id) : caminhaoId}
          opcoesCaminhao={opcoesCaminhao}
          carregando={programarMutacao.isPending}
          aoFechar={() => {
            setConfirmando(false)
            setReprogramando(null)
          }}
          aoConfirmar={(data, caminhao) => {
            setCaminhaoId(String(caminhao))
            programarMutacao.mutate({
              cardIds: reprogramando ? [reprogramando.card_id] : [...selecionados],
              data,
              caminhaoId: caminhao,
            })
          }}
        />
      )}
    </div>
  )
}

function ModalConfirmar({
  titulo,
  diaInicial,
  caminhaoInicial,
  opcoesCaminhao,
  carregando,
  aoFechar,
  aoConfirmar,
}: {
  titulo: string
  diaInicial: string
  caminhaoInicial: string
  opcoesCaminhao: { valor: string; rotulo: string }[]
  carregando: boolean
  aoFechar: () => void
  aoConfirmar: (data: string, caminhaoId: number) => void
}) {
  const [data, setData] = useState(diaInicial)
  const [caminhao, setCaminhao] = useState(caminhaoInicial)
  const pronto = Boolean(data) && Number(caminhao) > 0

  return (
    <Modal
      aberto
      aoFechar={(aberto) => {
        if (!aberto) aoFechar()
      }}
      titulo={titulo}
      descricao="Confirme o dia e o caminhão. Dá para reprogramar a qualquer instante — só não depois de entregue."
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            variante="primaria"
            disabled={!pronto}
            carregando={carregando}
            onClick={() => aoConfirmar(data, Number(caminhao))}
          >
            Confirmar
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo rotulo="Dia" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        {opcoesCaminhao.length === 0 ? (
          <p className="rounded-dm bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
            Nenhum caminhão cadastrado — cadastre em Administração → Caminhões.
          </p>
        ) : (
          <Selecao
            rotulo="Caminhão"
            opcoes={opcoesCaminhao}
            valor={caminhao}
            aoMudar={setCaminhao}
            placeholder="Escolha o caminhão"
            tamanho="galpao"
          />
        )}
      </div>
    </Modal>
  )
}
