import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { Botao, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarEtapasAtivas, itensDoPedido, liberarUnidades, unidadesDoPedido } from '../api'
import type { Card, Etapa, PedidoResumo, Setor } from '../tipos'

const CHEGADA = 'chegada'

interface LinhaLiberacao {
  chave: string
  item_seq: number
  item_codigo: string | null
  item_descricao: string | null
  indice_unidade: number
  total_unidades: number
  jaLiberada: boolean
  selecionada: boolean
  setorId: string
  etapaId: string
}

export interface ModalLiberarPedidoProps {
  cardPedido: Card | null
  pedido?: PedidoResumo
  setorPcp: Setor
  setores: Setor[]
  aoFechar: () => void
}

/**
 * A liberação do PCP (D-01/D-22): cada móvel do pedido vira um card de unidade
 * (k/n, calculado POR ITEM como o n8n faz hoje no ClickUp) e vai para o setor
 * que o PCP escolher — unidades do mesmo pedido podem seguir caminhos
 * diferentes, e a liberação pode ser parcial (o resto fica para depois).
 */
export function ModalLiberarPedido({
  cardPedido,
  pedido,
  setorPcp,
  setores,
  aoFechar,
}: ModalLiberarPedidoProps) {
  const { perfil } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const pedidoId = cardPedido?.pedido_id ?? 0
  const aberto = cardPedido !== null

  const { data: itens = [], isPending: carregandoItens } = useQuery({
    queryKey: ['pedido-itens', pedidoId],
    queryFn: () => itensDoPedido(pedidoId),
    enabled: aberto,
  })
  const { data: unidadesExistentes = [] } = useQuery({
    queryKey: ['pedido-unidades', pedidoId],
    queryFn: () => unidadesDoPedido(pedidoId),
    enabled: aberto,
  })
  const { data: todasEtapas = [] } = useQuery({
    queryKey: ['etapas-ativas'],
    queryFn: buscarEtapasAtivas,
    enabled: aberto,
  })

  const etapasPorSetor = useMemo(() => {
    const mapa = new Map<number, Etapa[]>()
    for (const etapa of todasEtapas) {
      const lista = mapa.get(etapa.setor_id) ?? []
      lista.push(etapa)
      mapa.set(etapa.setor_id, lista)
    }
    return mapa
  }, [todasEtapas])

  // Destinos possíveis: qualquer setor ativo que não seja o próprio PCP.
  const destinos = useMemo(() => setores.filter((s) => s.id !== setorPcp.id), [setores, setorPcp.id])

  // As linhas são DERIVADAS de itens + unidades já criadas; o que o usuário
  // mexe (seleção e destinos) vive à parte, em `ajustes` — assim não há
  // setState em effect e a lista nunca briga com o refetch.
  const linhasBase = useMemo(() => {
    const jaCriadas = new Set(unidadesExistentes.map((u) => `${u.item_seq}:${u.indice_unidade}`))
    const novas: LinhaLiberacao[] = []
    for (const item of itens) {
      for (let k = 1; k <= item.unidades; k += 1) {
        const jaLiberada = jaCriadas.has(`${item.seq}:${k}`)
        novas.push({
          chave: `${item.seq}:${k}`,
          item_seq: item.seq,
          item_codigo: item.codigo,
          item_descricao: item.descricao,
          indice_unidade: k,
          total_unidades: item.unidades,
          jaLiberada,
          selecionada: !jaLiberada,
          setorId: '',
          etapaId: CHEGADA,
        })
      }
    }
    return novas
  }, [itens, unidadesExistentes])

  const [ajustes, setAjustes] = useState<Map<string, Partial<LinhaLiberacao>>>(new Map())
  const [destinoParaTodas, setDestinoParaTodas] = useState('')
  const [erro, setErro] = useState('')

  // Pedido novo no modal → zera os ajustes (ajuste de estado durante o render).
  const [pedidoAnterior, setPedidoAnterior] = useState(0)
  if (pedidoId !== pedidoAnterior) {
    setPedidoAnterior(pedidoId)
    setAjustes(new Map())
    setDestinoParaTodas('')
    setErro('')
  }

  const linhas = linhasBase.map((l) => ({ ...l, ...ajustes.get(l.chave) }))
  const pendentes = linhas.filter((l) => !l.jaLiberada)
  const selecionadas = pendentes.filter((l) => l.selecionada)

  function mudarLinha(chave: string, mudancas: Partial<LinhaLiberacao>) {
    setAjustes((atuais) => {
      const novos = new Map(atuais)
      novos.set(chave, { ...novos.get(chave), ...mudancas })
      return novos
    })
  }

  function aplicarATodas(setorId: string) {
    setDestinoParaTodas(setorId)
    setAjustes((atuais) => {
      const novos = new Map(atuais)
      for (const linha of linhasBase) {
        if (linha.jaLiberada) continue
        const atual = novos.get(linha.chave)
        const selecionada = atual?.selecionada ?? linha.selecionada
        if (!selecionada) continue
        novos.set(linha.chave, { ...atual, setorId, etapaId: CHEGADA })
      }
      return novos
    })
  }

  const mutacao = useMutation({
    mutationFn: liberarUnidades,
    onSuccess: async (quantidade) => {
      notificar({
        titulo: `${quantidade} unidade${quantidade === 1 ? '' : 's'} liberada${quantidade === 1 ? '' : 's'}`,
        descricao: `Pedido ${pedido?.numero ?? ''} — cada unidade seguiu para o setor escolhido.`,
        tom: 'perfeito',
      })
      aoFechar()
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['cards'] }),
        clienteQuery.invalidateQueries({ queryKey: ['pedidos-resumo'] }),
        clienteQuery.invalidateQueries({ queryKey: ['pedido-unidades'] }),
        clienteQuery.invalidateQueries({ queryKey: ['expedicao'] }),
      ])
    },
    onError: async (excecao) => {
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.')
      // Uma liberação parcial pode ter acontecido antes do erro — recarrega.
      await clienteQuery.invalidateQueries({ queryKey: ['pedido-unidades'] })
      await clienteQuery.invalidateQueries({ queryKey: ['cards'] })
    },
  })

  function aoLiberar() {
    if (!cardPedido || !perfil) return
    if (selecionadas.length === 0) {
      setErro('Selecione pelo menos uma unidade para liberar.')
      return
    }
    const semDestino = selecionadas.filter((l) => l.setorId === '')
    if (semDestino.length > 0) {
      setErro(
        `Escolha o setor de destino de ${semDestino.length === 1 ? '1 unidade selecionada' : `${semDestino.length} unidades selecionadas`}.`,
      )
      return
    }
    setErro('')
    mutacao.mutate({
      cardPaiId: cardPedido.id,
      pedidoId: cardPedido.pedido_id,
      setorPcpId: setorPcp.id,
      usuarioId: perfil.id,
      unidades: selecionadas.map((l) => ({
        item_seq: l.item_seq,
        item_codigo: l.item_codigo,
        item_descricao: l.item_descricao,
        indice_unidade: l.indice_unidade,
        total_unidades: l.total_unidades,
        destinoSetorId: Number(l.setorId),
        destinoEtapaId: l.etapaId === CHEGADA ? null : Number(l.etapaId),
      })),
    })
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={(estaAberto) => {
        if (!estaAberto) aoFechar()
      }}
      titulo={`Liberar unidades — Pedido ${pedido?.numero ?? ''}`}
      descricao="Cada unidade vira um card próprio e segue para o setor escolhido. Dá para liberar só uma parte agora — o resto fica no PCP para depois."
      tamanho="galpao"
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            carregando={mutacao.isPending}
            disabled={selecionadas.length === 0}
            onClick={aoLiberar}
          >
            Liberar {selecionadas.length > 0 ? selecionadas.length : ''} unidade
            {selecionadas.length === 1 ? '' : 's'}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {carregandoItens && <p className="text-sm text-texto-fraco">Carregando itens…</p>}

        {!carregandoItens && pendentes.length === 0 && linhas.length > 0 && (
          <p className="flex items-center gap-2 rounded-dm border border-perfeito-borda bg-perfeito-fundo p-3 text-sm text-perfeito-texto">
            <CheckCircle2 aria-hidden className="size-5 shrink-0" />
            Todas as unidades deste pedido já foram liberadas.
          </p>
        )}

        {pendentes.length > 1 && (
          <div className="rounded-dm border border-borda bg-superficie-sutil p-3">
            <Selecao
              rotulo="Mesmo destino para todas as selecionadas"
              placeholder="Escolher um setor para todas…"
              opcoes={destinos.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
              valor={destinoParaTodas || undefined}
              aoMudar={aplicarATodas}
              ajuda="Depois dá para ajustar unidade por unidade."
            />
          </div>
        )}

        <ul className="flex flex-col divide-y divide-borda rounded-dm border border-borda">
          {linhas.map((linha) => {
            const etapasDoDestino =
              linha.setorId === '' ? [] : (etapasPorSetor.get(Number(linha.setorId)) ?? [])
            return (
              <li key={linha.chave} className="flex flex-col gap-2 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 accent-[var(--dm-acao)]"
                      checked={linha.jaLiberada || linha.selecionada}
                      disabled={linha.jaLiberada}
                      onChange={() =>
                        mudarLinha(linha.chave, { selecionada: !linha.selecionada })
                      }
                    />
                    <span className={linha.jaLiberada ? 'text-texto-fraco' : 'text-texto'}>
                      {linha.item_descricao ?? 'Sem descrição'}{' '}
                      <span className="font-medium tabular-nums">
                        ({linha.indice_unidade}/{linha.total_unidades})
                      </span>
                    </span>
                  </label>
                  {linha.jaLiberada && (
                    <span className="shrink-0 rounded-full bg-superficie-sutil px-2 py-0.5 text-xs font-medium text-texto-suave">
                      já liberada
                    </span>
                  )}
                </div>

                {!linha.jaLiberada && linha.selecionada && (
                  <div className="grid grid-cols-1 gap-2 pl-8 sm:grid-cols-2">
                    <Selecao
                      rotulo="Setor de destino"
                      placeholder="Escolher setor…"
                      opcoes={destinos.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
                      valor={linha.setorId || undefined}
                      aoMudar={(v) => mudarLinha(linha.chave, { setorId: v, etapaId: CHEGADA })}
                    />
                    {etapasDoDestino.length > 0 && (
                      <Selecao
                        rotulo="Etapa"
                        opcoes={[
                          { valor: CHEGADA, rotulo: 'Chegada (sem etapa)' },
                          ...etapasDoDestino.map((e) => ({
                            valor: String(e.id),
                            rotulo: e.eh_fila ? `${e.nome} (fila)` : e.nome,
                          })),
                        ]}
                        valor={linha.etapaId}
                        aoMudar={(v) => mudarLinha(linha.chave, { etapaId: v })}
                      />
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {erro && (
          <p className="text-sm text-danificado-forte" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
