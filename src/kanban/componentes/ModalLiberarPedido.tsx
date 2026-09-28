import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, PackageCheck } from 'lucide-react'
import { Botao, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import {
  alocarPeca,
  buscarEtapasAtivas,
  itensDoPedido,
  liberarUnidades,
  sugestoesAlocacao,
  unidadesDaReposicao,
  unidadesDoPedido,
} from '../api'
import type { ReposicaoResumo, SugestaoAlocacao } from '../api'
import type { Card, Etapa, ItemKanban, PedidoResumo, Setor } from '../tipos'

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
  /** SESSAO-24: usar a peça igual sem dono do estoque (a unidade nasce pronta). */
  usarEstoque: boolean
}

export interface ModalLiberarPedidoProps {
  cardPedido: Card | null
  pedido?: PedidoResumo
  /** SESSAO-25: quando o card é de REPOSIÇÃO de estoque (sem pedido). */
  reposicao?: ReposicaoResumo
  setorPcp: Setor
  setores: Setor[]
  aoFechar: () => void
}

/**
 * A liberação do PCP (D-01/D-22): cada móvel do pedido vira um card de unidade
 * (k/n, calculado POR ITEM como o n8n faz hoje no ClickUp) e vai para o setor
 * que o PCP escolher — unidades do mesmo pedido podem seguir caminhos
 * diferentes, e a liberação pode ser parcial (o resto fica para depois).
 * SESSAO-25: o card de REPOSIÇÃO de estoque libera do mesmo jeito — as
 * unidades nascem sem pedido, com o produto do catálogo, e prontas ficam
 * livres no estoque.
 *
 * SESSAO-24: se existe no estoque peça IGUAL sem dono (mesmo produto; a
 * personalizada, mesmo SKU e descrição), a unidade mostra "Há N no estoque —
 * usar?". Aceitar faz a unidade nascer PRONTA em Pedidos em aguardo (não
 * volta à produção); recusar libera normal. A sugestão nunca decide sozinha —
 * vem desmarcada.
 */
export function ModalLiberarPedido({
  cardPedido,
  pedido,
  reposicao,
  setorPcp,
  setores,
  aoFechar,
}: ModalLiberarPedidoProps) {
  const { perfil } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const ehReposicao = cardPedido?.tipo === 'reposicao'
  const pedidoId = cardPedido?.pedido_id ?? 0
  const aberto = cardPedido !== null

  const { data: itensDoTiny = [], isPending: carregandoItensDoTiny } = useQuery({
    queryKey: ['pedido-itens', pedidoId],
    queryFn: () => itensDoPedido(pedidoId),
    enabled: aberto && !ehReposicao,
  })
  const { data: unidadesDoTiny = [] } = useQuery({
    queryKey: ['pedido-unidades', pedidoId],
    queryFn: () => unidadesDoPedido(pedidoId),
    enabled: aberto && !ehReposicao,
  })
  // SESSAO-25: a reposição tem UM item — o produto × a quantidade a repor.
  const { data: unidadesDaRepo = [] } = useQuery({
    queryKey: ['reposicao-unidades', cardPedido?.id ?? 0],
    queryFn: () => unidadesDaReposicao(cardPedido!.id),
    enabled: aberto && ehReposicao,
  })
  // SESSAO-24: peça igual sem dono no estoque, uma por unidade ainda não liberada.
  const { data: sugestoes = [] } = useQuery({
    queryKey: ['sugestoes-alocacao', cardPedido?.id ?? 0],
    queryFn: () => sugestoesAlocacao(cardPedido!.id),
    enabled: aberto && !ehReposicao,
  })
  const sugestaoPorChave = useMemo(
    () =>
      new Map<string, SugestaoAlocacao>(
        sugestoes.map((s) => [`${s.item_seq}:${s.indice_unidade}`, s]),
      ),
    [sugestoes],
  )
  const itens: ItemKanban[] = useMemo(
    () =>
      ehReposicao && cardPedido
        ? [
            {
              seq: 1,
              codigo: cardPedido.item_codigo,
              descricao: cardPedido.item_descricao,
              unidades: cardPedido.total_unidades ?? 0,
            },
          ]
        : itensDoTiny,
    [ehReposicao, cardPedido, itensDoTiny],
  )
  const unidadesExistentes = ehReposicao ? unidadesDaRepo : unidadesDoTiny
  const carregandoItens = !ehReposicao && carregandoItensDoTiny
  const origem = ehReposicao ? 'Reposição de estoque' : `Pedido ${pedido?.numero ?? ''}`
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
          usarEstoque: false,
        })
      }
    }
    return novas
  }, [itens, unidadesExistentes])

  const [ajustes, setAjustes] = useState<Map<string, Partial<LinhaLiberacao>>>(new Map())
  const [destinoParaTodas, setDestinoParaTodas] = useState('')
  const [erro, setErro] = useState('')

  // Card novo no modal → zera os ajustes (ajuste de estado durante o render).
  const cardId = cardPedido?.id ?? 0
  const [cardAnterior, setCardAnterior] = useState(0)
  if (cardId !== cardAnterior) {
    setCardAnterior(cardId)
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

  // SESSAO-24: numa só confirmação, as unidades marcadas para usar o estoque
  // nascem prontas (alocar) e as demais seguem para a produção (liberar).
  const mutacao = useMutation({
    mutationFn: async (parametros: {
      alocar: { itemSeq: number; indiceUnidade: number; pecaCardId: number }[]
      liberar: Parameters<typeof liberarUnidades>[0] | null
    }) => {
      let alocadas = 0
      for (const a of parametros.alocar) {
        try {
          await alocarPeca({ cardPedidoId: cardPedido!.id, ...a })
        } catch (erro) {
          const detalhe = erro instanceof Error ? erro.message : 'sem resposta do servidor'
          throw new Error(
            alocadas === 0
              ? `Não deu para usar a peça do estoque: ${detalhe}`
              : `Usei ${alocadas} peça(s) do estoque, mas parei na seguinte: ${detalhe}`,
            { cause: erro },
          )
        }
        alocadas += 1
      }
      const liberadas = parametros.liberar ? await liberarUnidades(parametros.liberar) : 0
      return { alocadas, liberadas }
    },
    onSuccess: async ({ alocadas, liberadas }) => {
      const partes = [
        liberadas > 0
          ? `${liberadas} unidade${liberadas === 1 ? '' : 's'} liberada${liberadas === 1 ? '' : 's'}`
          : null,
        alocadas > 0
          ? `${alocadas} do estoque — já pronta${alocadas === 1 ? '' : 's'} em Pedidos em aguardo`
          : null,
      ].filter(Boolean)
      notificar({
        titulo: partes.join(' · '),
        descricao:
          liberadas > 0 ? `${origem} — cada unidade seguiu para o setor escolhido.` : origem,
        tom: 'perfeito',
      })
      aoFechar()
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['cards'] }),
        clienteQuery.invalidateQueries({ queryKey: ['pedidos-resumo'] }),
        clienteQuery.invalidateQueries({ queryKey: ['pedido-unidades'] }),
        clienteQuery.invalidateQueries({ queryKey: ['expedicao'] }),
        clienteQuery.invalidateQueries({ queryKey: ['reposicoes-resumo'] }),
        clienteQuery.invalidateQueries({ queryKey: ['reposicao-unidades'] }),
        clienteQuery.invalidateQueries({ queryKey: ['sugestoes-alocacao'] }),
        clienteQuery.invalidateQueries({ queryKey: ['estoque'] }),
        clienteQuery.invalidateQueries({ queryKey: ['pedidos-aguardo'] }),
        clienteQuery.invalidateQueries({ queryKey: ['produtos-reservados'] }),
        clienteQuery.invalidateQueries({ queryKey: ['aguardo-contagens'] }),
      ])
    },
    onError: async (excecao) => {
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.')
      // Uma parte pode ter acontecido antes do erro — recarrega.
      await clienteQuery.invalidateQueries({ queryKey: ['pedido-unidades'] })
      await clienteQuery.invalidateQueries({ queryKey: ['reposicao-unidades'] })
      await clienteQuery.invalidateQueries({ queryKey: ['sugestoes-alocacao'] })
      await clienteQuery.invalidateQueries({ queryKey: ['cards'] })
    },
  })

  function aoLiberar() {
    if (!cardPedido || !perfil) return
    if (ehReposicao && !reposicao) {
      setErro('Ainda carregando o produto da reposição — tente de novo em um instante.')
      return
    }
    if (selecionadas.length === 0) {
      setErro('Selecione pelo menos uma unidade para liberar.')
      return
    }
    const semDestino = selecionadas.filter(
      (l) => l.setorId === '' && !(l.usarEstoque && sugestaoPorChave.has(l.chave)),
    )
    if (semDestino.length > 0) {
      setErro(
        `Escolha o setor de destino de ${semDestino.length === 1 ? '1 unidade selecionada' : `${semDestino.length} unidades selecionadas`}.`,
      )
      return
    }
    setErro('')
    const alocar = selecionadas.flatMap((l) => {
      const sugestao = l.usarEstoque ? sugestaoPorChave.get(l.chave) : undefined
      return sugestao
        ? [{ itemSeq: l.item_seq, indiceUnidade: l.indice_unidade, pecaCardId: sugestao.peca_card_id }]
        : []
    })
    const paraProducao = selecionadas.filter(
      (l) => !(l.usarEstoque && sugestaoPorChave.has(l.chave)),
    )
    mutacao.mutate({
      alocar,
      liberar:
        paraProducao.length === 0
          ? null
          : {
              cardPaiId: cardPedido.id,
              pedidoId: ehReposicao ? null : cardPedido.pedido_id,
              produtoTinyId: ehReposicao ? (reposicao?.produto_tiny_id ?? null) : null,
              setorPcpId: setorPcp.id,
              usuarioId: perfil.id,
              unidades: paraProducao.map((l) => ({
                item_seq: l.item_seq,
                item_codigo: l.item_codigo,
                item_descricao: l.item_descricao,
                indice_unidade: l.indice_unidade,
                total_unidades: l.total_unidades,
                destinoSetorId: Number(l.setorId),
                destinoEtapaId: l.etapaId === CHEGADA ? null : Number(l.etapaId),
              })),
            },
    })
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={(estaAberto) => {
        if (!estaAberto) aoFechar()
      }}
      titulo={`Liberar unidades — ${origem}`}
      descricao={
        ehReposicao
          ? 'O estoque ficou abaixo do mínimo. Cada unidade vira um card próprio e segue para o setor escolhido; pronta, fica livre no estoque aguardando a venda.'
          : 'Cada unidade vira um card próprio e segue para o setor escolhido. Dá para liberar só uma parte agora — o resto fica no PCP para depois.'
      }
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
            Todas as unidades {ehReposicao ? 'desta reposição' : 'deste pedido'} já foram liberadas.
          </p>
        )}

        {pendentes.length > 1 && (
          <div className="rounded-dm border border-borda bg-superficie-sutil p-3">
            <Selecao
              rotulo="Mesmo destino para todas as selecionadas"
              placeholder="Escolher um setor para todas…"
              opcoes={destinos.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
              valor={destinoParaTodas}
              aoMudar={aplicarATodas}
              ajuda="Depois dá para ajustar unidade por unidade."
            />
          </div>
        )}

        <ul className="flex flex-col divide-y divide-borda rounded-dm border border-borda">
          {linhas.map((linha) => {
            const etapasDoDestino =
              linha.setorId === '' ? [] : (etapasPorSetor.get(Number(linha.setorId)) ?? [])
            // SESSAO-22 (D-48): destino de produção com fila não tem mais
            // "Chegada" — a fila é o padrão (o banco resolve igual sem etapa).
            const setorDestino = destinos.find((s) => String(s.id) === linha.setorId)
            const filaDoDestino = etapasDoDestino.find((e) => e.eh_fila)
            const producaoComFila =
              setorDestino?.papel_no_fluxo === 'producao' && filaDoDestino !== undefined
            const etapaExibida =
              producaoComFila && linha.etapaId === CHEGADA
                ? String(filaDoDestino!.id)
                : linha.etapaId
            // SESSAO-24: peça igual sem dono no estoque para esta unidade.
            const sugestao = linha.jaLiberada ? undefined : sugestaoPorChave.get(linha.chave)
            const usandoEstoque = sugestao !== undefined && linha.usarEstoque
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

                {sugestao && linha.selecionada && (
                  <label
                    className={cn(
                      'ml-8 flex min-h-toque-md cursor-pointer items-center gap-3 rounded-dm border px-3 py-2 text-sm',
                      usandoEstoque
                        ? 'border-acao-ativa bg-superficie-sutil'
                        : 'border-perfeito-borda bg-perfeito-fundo',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 accent-[var(--dm-acao)]"
                      checked={linha.usarEstoque}
                      onChange={() =>
                        mudarLinha(linha.chave, { usarEstoque: !linha.usarEstoque })
                      }
                    />
                    <PackageCheck aria-hidden className="size-5 shrink-0 text-perfeito-forte" />
                    <span className="flex flex-col">
                      <span className="font-medium text-texto">
                        Há {sugestao.pecas_iguais} igual{sugestao.pecas_iguais === 1 ? '' : 'is'} no
                        estoque, sem dono — usar?
                      </span>
                      <span className="text-xs text-texto-suave">
                        {sugestao.peca_origem === 'cancelamento' && sugestao.peca_origem_numero
                          ? `Veio do pedido ${sugestao.peca_origem_numero}, que foi cancelado.`
                          : sugestao.peca_origem === 'reposicao'
                            ? 'Veio da reposição de estoque.'
                            : // Ajuste de 28/09: peça cadastrada pela logística (sem card pai).
                              'Está pronta no estoque.'}{' '}
                        {usandoEstoque
                          ? 'Vai direto, pronta, para Pedidos em aguardo — não passa pela produção.'
                          : 'Marque para usar; sem marcar, a unidade vai para a produção.'}
                      </span>
                    </span>
                  </label>
                )}

                {!linha.jaLiberada && linha.selecionada && !usandoEstoque && (
                  <div className="grid grid-cols-1 gap-2 pl-8 sm:grid-cols-2">
                    <Selecao
                      rotulo="Setor de destino"
                      placeholder="Escolher setor…"
                      opcoes={destinos.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
                      valor={linha.setorId}
                      aoMudar={(v) => mudarLinha(linha.chave, { setorId: v, etapaId: CHEGADA })}
                    />
                    {etapasDoDestino.length > 0 && (
                      <Selecao
                        rotulo="Etapa"
                        opcoes={[
                          ...(producaoComFila
                            ? []
                            : [{ valor: CHEGADA, rotulo: 'Chegada (sem etapa)' }]),
                          ...etapasDoDestino.map((e) => ({
                            valor: String(e.id),
                            rotulo: e.eh_fila ? `${e.nome} (fila)` : e.nome,
                          })),
                        ]}
                        valor={etapaExibida}
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
