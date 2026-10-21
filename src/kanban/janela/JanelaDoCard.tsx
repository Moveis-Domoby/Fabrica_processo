import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlignLeft,
  CalendarClock,
  CircleCheckBig,
  Clock,
  DoorOpen,
  Handshake,
  History,
  Link2,
  Pause,
  Flag,
  Pencil,
  Play,
  Save,
  SlidersHorizontal,
  Tag,
  TriangleAlert,
  Users,
  Wrench,
} from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { AvatarChat } from '@/chat/componentes/AvatarChat'
import { ROTULO_DESTINO_FINAL } from '@/logistica/devolucao'
import { CamposDoCard } from '@/utilitarios/CamposDoCard'
import { EtiquetasDoCard } from '@/utilitarios/PilulaEtiqueta'
import { textoDoValorCampo } from '@/utilitarios/tipos'
import { definirEtiquetaDoCard, definirResponsavel, editarCard } from '../avulso'
import type { PessoaMini } from '../avulso'
import { ModalConcluirAvulso } from '../componentes/ModalConcluirAvulso'
import { ModalMotivoPausa } from '../componentes/ModalMotivoPausa'
import { retomarCard } from '../pausa'
import { auxilioEncerrar, cardAuxiliar } from '@/tablet/api'
import { ModalPinOperador } from '@/tablet/ModalPinOperador'
import { HistoricoDoCard } from '../componentes/ModalLinhaTempo'
import { SeletorEtiquetas, SeletorPessoas } from '../lancamento/Seletores'
import { nomeDoCard, rotuloOrigemCard } from '../rotulos'
import { formatarDuracao, useAgora } from '../tempo'
import { abrirJanela } from './api'
import type { JanelaDoCard as DadosJanela } from './api'
import { AnexosDoCard } from './AnexosDoCard'
import { ResponsaveisPorSetor } from './ResponsaveisPorSetor'
import { ChipPrazo, PontoPrioridade, SeletorPrioridade } from '../componentes/MarcasDoCard'
import { ROTULO_PRIORIDADE, definirPrioridade, prioridadeDe } from '../prioridade'
import type { Prioridade } from '../prioridade'

const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
function hojeIso(agora: number): string {
  const d = new Date(agora)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * A JANELA DO CARD (SESSAO-31 · §3 — para TODO card: avulso, peça, reposição
 * e o card do pedido). Abre por cima da tela, com link próprio (`?card=`), ESC
 * fecha, no celular ocupa a tela. Abrir = 1 requisição; o histórico e os
 * anexos só no clique; fechar esquece o que era pesado (D-89).
 *
 * No tablet (`modo="tablet"`) é só para ver e sem dado de cliente (D-28) —
 * mudar o card é pelo computador ou pelo celular (decisão provisória); a
 * exceção é Pausar/Retomar (§4), que pedem o PIN de quem age.
 */
export function JanelaDoCard({
  cardId,
  aoFechar,
  modo = 'padrao',
  colunaDireita,
}: {
  cardId: number
  aoFechar: () => void
  modo?: 'padrao' | 'tablet'
  /** A coluna da direita (a conversa do card — etapa F). */
  colunaDireita?: (dados: DadosJanela) => ReactNode
}) {
  const consulta = useQuery({
    queryKey: ['card-janela', cardId],
    queryFn: () => abrirJanela(cardId),
    gcTime: 0,
    staleTime: 0,
  })
  const dados = consulta.data
  // O card do PEDIDO (o do PCP) não tem produto: o título é o pedido.
  const doPedido = dados?.card.tipo === 'pedido'
  const titulo = !dados
    ? 'Card'
    : doPedido
      ? `Pedido ${dados.pedido?.numero ?? '…'}`
      : nomeDoCard(dados.card)
  const descricao = !dados
    ? undefined
    : doPedido
      ? 'Card do pedido'
      : rotuloOrigemCard(dados.card, dados.pedido)

  return (
    <Modal
      aberto
      aoFechar={(v) => !v && aoFechar()}
      titulo={titulo}
      descricao={descricao}
      tamanho="tela"
    >
      {consulta.isPending && <p className="p-5 text-sm text-texto-fraco">Abrindo o card…</p>}
      {consulta.isError && (
        <p className="m-5 rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
          {consulta.error instanceof Error ? consulta.error.message : 'Não deu para abrir o card.'}
        </p>
      )}
      {dados && (
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:overflow-hidden">
          <div className="min-w-0 lg:overflow-y-auto">
            <LadoDoCard dados={dados} modo={modo} />
          </div>
          <aside
            aria-label="Atividade do card"
            className="flex min-h-80 min-w-0 flex-col border-t border-borda lg:min-h-0 lg:border-t-0 lg:border-l"
          >
            {colunaDireita ? (
              colunaDireita(dados)
            ) : (
              <p className="p-5 text-sm text-texto-suave">A conversa do card aparece aqui.</p>
            )}
          </aside>
        </div>
      )}
    </Modal>
  )
}

function LadoDoCard({ dados, modo }: { dados: DadosJanela; modo: 'padrao' | 'tablet' }) {
  const agora = useAgora(30_000)
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const { card, permissoes } = dados
  const tablet = modo === 'tablet'
  const podeEditar = permissoes.editar && !tablet
  const pessoas = dados.pessoas
  const [verHistorico, setVerHistorico] = useState(false)
  const [concluindo, setConcluindo] = useState(false)
  // SESSAO-31 (§4): Pausar (com o motivo) / Retomar. No tablet, o PIN antes.
  // SESSAO-36 (D-146): Auxiliar / Sair do auxílio — idem.
  const [pausando, setPausando] = useState<{ operadorId?: string } | null>(null)
  const [pinPara, setPinPara] = useState<'pausar' | 'retomar' | 'auxiliar' | 'sair_auxilio' | null>(
    null,
  )

  const releituras = async () => {
    await Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['card-janela', card.id] }),
      clienteQuery.invalidateQueries({ queryKey: ['avulsos'] }),
    ])
  }
  const falhou = (titulo: string) => (e: unknown) =>
    notificar({ titulo, descricao: e instanceof Error ? e.message : undefined, tom: 'danificado' })

  // ---- nome, descrição, datas --------------------------------------------
  const [editandoNome, setEditandoNome] = useState(false)
  const [nome, setNome] = useState(card.titulo ?? '')
  const [editandoDescricao, setEditandoDescricao] = useState(false)
  const [descricao, setDescricao] = useState(card.descricao ?? '')
  const editar = useMutation({
    mutationFn: (mudancas: Parameters<typeof editarCard>[1]) => editarCard(card.id, mudancas),
    onSuccess: async () => {
      setEditandoNome(false)
      setEditandoDescricao(false)
      await releituras()
    },
    onError: falhou('Não deu para salvar'),
  })

  // ---- responsáveis e etiquetas (cada toque é um gesto — idempotente no banco)
  const [editandoResponsaveis, setEditandoResponsaveis] = useState(false)
  const [editandoEtiquetas, setEditandoEtiquetas] = useState(false)
  const responsaveis: PessoaMini[] = (card.responsaveis ?? []).map((id) => ({
    id,
    nome: pessoas[id]?.nome ?? 'alguém',
    foto: pessoas[id]?.foto ?? null,
  }))
  const trocarResponsaveis = useMutation({
    mutationFn: async (novos: PessoaMini[]) => {
      const antes = new Set(responsaveis.map((p) => p.id))
      const depois = new Set(novos.map((p) => p.id))
      for (const p of novos) if (!antes.has(p.id)) await definirResponsavel(card.id, p.id, true)
      for (const p of responsaveis)
        if (!depois.has(p.id)) await definirResponsavel(card.id, p.id, false)
    },
    onSuccess: releituras,
    onError: falhou('Não deu para mudar os responsáveis'),
  })
  // ---- prioridade (SESSAO-38 · D-150/D-151): na peça, muda a do pedido ------
  const prioridadeAtual: Prioridade = dados.prioridade
    ? dados.prioridade.valor
    : prioridadeDe(card.prioridade)
  const podePriorizar = (permissoes.priorizar ?? false) && !tablet
  const priorizar = useMutation({
    mutationFn: (p: Prioridade) => definirPrioridade(card.id, p),
    onSuccess: async (r) => {
      notificar({
        titulo: r.do_pedido
          ? `Prioridade ${ROTULO_PRIORIDADE[r.prioridade].toLowerCase()} — vale para todas as peças do pedido`
          : `Prioridade ${ROTULO_PRIORIDADE[r.prioridade].toLowerCase()}`,
        tom: 'perfeito',
      })
      await Promise.all([
        releituras(),
        clienteQuery.invalidateQueries({ queryKey: ['quadro'] }),
        clienteQuery.invalidateQueries({ queryKey: ['cards'] }),
      ])
    },
    onError: falhou('Não deu para mudar a prioridade'),
  })

  const trocarEtiquetas = useMutation({
    mutationFn: async (novas: number[]) => {
      const antes = new Set(card.etiquetas ?? [])
      const depois = new Set(novas)
      for (const id of novas) if (!antes.has(id)) await definirEtiquetaDoCard(card.id, id, true)
      for (const id of antes) if (!depois.has(id)) await definirEtiquetaDoCard(card.id, id, false)
    },
    onSuccess: releituras,
    onError: falhou('Não deu para mudar as etiquetas'),
  })

  // ---- estado e tempo ------------------------------------------------------
  const executor = card.executor_atual_id ? pessoas[card.executor_atual_id]?.nome : null
  const pausado = card.executor_atual_id !== null && card.pausado_em !== null
  const motivo = card.pausa_motivo ?? null
  // No tablet a conta é do dispositivo: o botão aparece pelo estado e o banco
  // decide com o PIN (o próprio executor, o líder, o admin).
  const vivo = !dados.arquivado_em
  const podePausar = tablet
    ? vivo && card.executor_atual_id !== null && !pausado
    : permissoes.pausar
  const podeRetomar = tablet ? vivo && pausado : permissoes.retomar
  const retomar = useMutation({
    mutationFn: (operadorId?: string) => retomarCard({ cardId: card.id, operadorId }),
    onSuccess: async () => {
      notificar({ titulo: 'Retomado — o tempo voltou a contar', tom: 'perfeito' })
      await Promise.all([
        releituras(),
        clienteQuery.invalidateQueries({ queryKey: ['quadro'] }),
        clienteQuery.invalidateQueries({ queryKey: ['linha-tempo'] }),
      ])
    },
    onError: falhou('Não deu para retomar'),
  })
  // SESSAO-36 (D-146): entrar no card como AUXILIAR (tempo próprio) e sair dele.
  const auxilios = dados.auxilios ?? []
  const auxiliar = useMutation({
    mutationFn: (operadorId?: string) => cardAuxiliar(card.id, operadorId),
    onSuccess: async () => {
      notificar({ titulo: 'Entrou no card — o tempo próprio começou', tom: 'perfeito' })
      await Promise.all([releituras(), clienteQuery.invalidateQueries({ queryKey: ['quadro'] })])
    },
    onError: falhou('Não deu para auxiliar'),
  })
  const sairAuxilio = useMutation({
    mutationFn: (operadorId?: string) => auxilioEncerrar(card.id, operadorId),
    onSuccess: async () => {
      notificar({ titulo: 'Saiu do auxílio — o card segue para quem ficou', tom: 'perfeito' })
      await Promise.all([releituras(), clienteQuery.invalidateQueries({ queryKey: ['quadro'] })])
    },
    onError: falhou('Não deu para sair do auxílio'),
  })
  const podeAuxiliar = tablet
    ? vivo && card.executor_atual_id !== null && !pausado
    : permissoes.auxiliar && !permissoes.sair_auxilio
  const podeSairAuxilio = tablet ? vivo && auxilios.length > 0 : permissoes.sair_auxilio
  const hoje = hojeIso(agora)
  // SESSAO-38 (D-150): no card de pedido as datas vêm do Tiny (início = a data
  // do pedido, vencimento = a data de entrega) e não se editam aqui.
  const prazo = dados.prazo ?? {
    inicio: card.inicio_em ?? null,
    vencimento: card.vence_em ?? null,
    do_pedido: false,
  }
  const podeEditarDatas = (permissoes.editar_datas ?? !prazo.do_pedido) && podeEditar
  const atrasado = prazo.vencimento != null && prazo.vencimento < hoje && !dados.arquivado_em
  const ondeEsta = dados.arquivado_em
    ? card.concluido_em && card.tipo === 'avulso'
      ? 'Concluído'
      : 'Arquivado'
    : [dados.setor?.nome, dados.etapa?.nome].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5">
      {/* ---------- cabeçalho ---------- */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-superficie-sutil px-2.5 py-0.5 text-xs font-medium text-texto">
            {ondeEsta || '—'}
          </span>
          {card.ajuste_destino && (
            <span className="inline-flex items-center gap-1 rounded-full bg-info-fundo px-2.5 py-0.5 text-xs font-medium text-info-texto">
              <Wrench aria-hidden className="size-3.5" />
              Ajuste · vai para {ROTULO_DESTINO_FINAL[card.ajuste_destino].toLowerCase()}
            </span>
          )}
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {/* O nome já está no topo da janela — aqui só o gesto de mudar. */}
            {permissoes.editar_nome && !tablet && !editandoNome && (
              <Botao
                variante="fantasma"
                tamanho="sm"
                icone={<Pencil />}
                onClick={() => {
                  setNome(card.titulo ?? '')
                  setEditandoNome(true)
                }}
              >
                Renomear
              </Botao>
            )}
            {podePausar && (
              <Botao
                variante="secundaria"
                tamanho={tablet ? 'lg' : 'sm'}
                icone={<Pause />}
                onClick={() => (tablet ? setPinPara('pausar') : setPausando({}))}
              >
                Pausar
              </Botao>
            )}
            {podeRetomar && (
              <Botao
                variante="secundaria"
                tamanho={tablet ? 'lg' : 'sm'}
                icone={<Play />}
                carregando={retomar.isPending}
                onClick={() => (tablet ? setPinPara('retomar') : retomar.mutate(undefined))}
              >
                Retomar
              </Botao>
            )}
            {podeAuxiliar && (
              <Botao
                variante="secundaria"
                tamanho={tablet ? 'lg' : 'sm'}
                icone={<Handshake />}
                carregando={auxiliar.isPending}
                onClick={() => (tablet ? setPinPara('auxiliar') : auxiliar.mutate(undefined))}
              >
                Auxiliar
              </Botao>
            )}
            {podeSairAuxilio && (
              <Botao
                variante="secundaria"
                tamanho={tablet ? 'lg' : 'sm'}
                icone={<DoorOpen />}
                carregando={sairAuxilio.isPending}
                onClick={() =>
                  tablet ? setPinPara('sair_auxilio') : sairAuxilio.mutate(undefined)
                }
              >
                Sair do auxílio
              </Botao>
            )}
            {permissoes.concluir && !tablet && (
              <Botao
                variante="secundaria"
                tamanho="sm"
                icone={<CircleCheckBig />}
                onClick={() => setConcluindo(true)}
              >
                Concluir
              </Botao>
            )}
          </span>
        </div>
        {editandoNome && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              editar.mutate({ titulo: nome })
            }}
          >
            <div className="min-w-0 flex-1">
              <Campo
                rotulo="Nome do card"
                maxLength={200}
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <Botao type="submit" tamanho="sm" icone={<Save />} carregando={editar.isPending}>
              Salvar
            </Botao>
            <Botao
              type="button"
              variante="secundaria"
              tamanho="sm"
              onClick={() => setEditandoNome(false)}
            >
              Cancelar
            </Botao>
          </form>
        )}
        {/* O estado: na fila, em execução por quem, pausado (ícone + texto — M-12). */}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-texto-suave tabular-nums">
          {pausado ? (
            <span className="inline-flex min-w-0 items-center gap-1 font-medium text-atencao-texto">
              <Pause aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 break-words">
                Pausado{motivo ? ` · ${motivo}` : ''} · há {formatarDuracao(card.pausado_em, agora)}{' '}
                · {executor ?? '…'}
              </span>
            </span>
          ) : executor ? (
            <span className="inline-flex items-center gap-1 text-texto">
              <Play aria-hidden className="size-4 text-perfeito-forte" />
              Em execução por {executor} há{' '}
              {formatarDuracao(dados.execucao?.iniciou_em ?? card.desde, agora)}
            </span>
          ) : motivo && vivo ? (
            // SESSAO-31 (§4): solto no PARADO com o motivo.
            <span className="inline-flex min-w-0 items-center gap-1 font-medium text-atencao-texto">
              <Pause aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 break-words">
                Parado · {motivo} · há {formatarDuracao(card.desde, agora)}
              </span>
            </span>
          ) : (
            vivo && (
              <span className="inline-flex items-center gap-1">
                <Clock aria-hidden className="size-4" />
                Esperando há {formatarDuracao(card.desde, agora)}
              </span>
            )
          )}
          {/* SESSAO-36 (D-146): quem está no card como AUXILIAR, com o tempo próprio. */}
          {auxilios.map((a) => (
            <span
              key={a.usuario_id}
              className="inline-flex min-w-0 items-center gap-1 text-texto-suave"
            >
              <Handshake aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 break-words">
                {pessoas[a.usuario_id]?.nome ?? 'alguém'} ajudando
                {a.pausado_em
                  ? ` (pausado${a.pausa_motivo ? ` · ${a.pausa_motivo}` : ''})`
                  : a.ultimo_inicio
                    ? ` há ${formatarDuracao(a.ultimo_inicio, agora)}`
                    : ''}
              </span>
            </span>
          ))}
          {card.vinculo_rotulo && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Link2 aria-hidden className="size-4 shrink-0" />
              {card.vinculo_rotulo}
            </span>
          )}
          {/* D-28: o tablet não mostra dado de cliente. */}
          {!tablet && dados.pedido?.cliente_nome && (
            <span>Cliente: {dados.pedido.cliente_nome}</span>
          )}
        </p>
      </header>

      {/* ---------- propriedades ---------- */}
      <section aria-label="Propriedades" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* SESSAO-38 (item 2.4 — D-152): quem pegou o card em cada setor (da
            história, só leitura) e quem vai pegar nos próximos. */}
        <Propriedade icone={<Users aria-hidden className="size-4" />} rotulo="Responsáveis" largo>
          <ResponsaveisPorSetor
            cardId={card.id}
            setores={dados.responsaveis_por_setor ?? []}
            pessoas={pessoas}
            somenteVer={tablet}
          />
          {/* Os responsáveis do card como um todo (o avulso nasce com eles). */}
          {(responsaveis.length > 0 || (podeEditar && card.tipo === 'avulso')) && (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-borda pt-2">
              <div className="flex items-center gap-2 text-xs font-medium text-texto-suave">
                Do card todo
                {podeEditar && (
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    className="ml-auto"
                    onClick={() => setEditandoResponsaveis((v) => !v)}
                  >
                    {editandoResponsaveis ? 'Pronto' : 'Editar'}
                  </Botao>
                )}
              </div>
              {editandoResponsaveis ? (
                <SeletorPessoas
                  escolhidas={responsaveis}
                  aoMudar={(novos) => trocarResponsaveis.mutate(novos)}
                />
              ) : responsaveis.length === 0 ? (
                <span className="text-sm text-texto-fraco">Ninguém</span>
              ) : (
                <ul className="flex flex-col gap-1">
                  {responsaveis.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm text-texto">
                      <AvatarChat nome={p.nome} foto={p.foto} tamanho="sm" />
                      {p.nome}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Propriedade>

        <Propriedade icone={<CalendarClock aria-hidden className="size-4" />} rotulo="Datas">
          {podeEditarDatas ? (
            <div className="grid grid-cols-2 gap-2">
              <Campo
                rotulo="Início"
                type="date"
                value={prazo.inicio ?? ''}
                onChange={(e) => editar.mutate({ inicio_em: e.target.value || null })}
              />
              <Campo
                rotulo="Vencimento"
                type="date"
                value={prazo.vencimento ?? ''}
                onChange={(e) => editar.mutate({ vence_em: e.target.value || null })}
              />
            </div>
          ) : (
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <dt className="text-texto-suave">Início:</dt>
                <dd className="text-texto tabular-nums">
                  {prazo.inicio ? diaMes(prazo.inicio) : '—'}
                </dd>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <dt className="text-texto-suave">Vencimento:</dt>
                <dd className="flex items-center gap-1.5 text-texto tabular-nums">
                  {prazo.vencimento ? (
                    <>
                      <ChipPrazo data={prazo.vencimento} agora={agora} />
                      {diaMes(prazo.vencimento)}
                    </>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              {prazo.do_pedido && (
                <p className="text-xs text-texto-fraco">
                  Do pedido no Tiny: o início é o dia do pedido; o vencimento, a entrega combinada
                  pelo vendedor.
                </p>
              )}
            </dl>
          )}
          {atrasado && (
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-danificado-texto">
              <TriangleAlert aria-hidden className="size-4" />
              Atrasado
            </p>
          )}
        </Propriedade>

        {/* SESSAO-38 (item 2.3 — D-150): a prioridade deixou de ser etiqueta. */}
        <Propriedade icone={<Flag aria-hidden className="size-4" />} rotulo="Prioridade">
          {podePriorizar ? (
            <SeletorPrioridade
              valor={prioridadeAtual}
              aoMudar={(p) => priorizar.mutate(p)}
              desabilitado={priorizar.isPending}
            />
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-texto">
              <PontoPrioridade prioridade={prioridadeAtual} />
              {ROTULO_PRIORIDADE[prioridadeAtual]}
            </span>
          )}
          {(dados.prioridade?.do_pedido || card.tipo === 'pedido') && (
            <p className="mt-1 text-xs text-texto-fraco">Vale para todas as peças do pedido.</p>
          )}
          {dados.prioridade?.da_reposicao && (
            <p className="mt-1 text-xs text-texto-fraco">Vale para as peças desta reposição.</p>
          )}
        </Propriedade>

        <Propriedade
          icone={<Tag aria-hidden className="size-4" />}
          rotulo="Etiquetas"
          podeEditar={podeEditar}
          editando={editandoEtiquetas}
          aoEditar={() => setEditandoEtiquetas((v) => !v)}
        >
          {editandoEtiquetas ? (
            <SeletorEtiquetas
              escolhidas={card.etiquetas ?? []}
              aoMudar={(novas) => trocarEtiquetas.mutate(novas)}
            />
          ) : (card.etiquetas ?? []).length === 0 ? (
            <span className="text-sm text-texto-fraco">Nenhuma</span>
          ) : (
            <EtiquetasDoCard ids={card.etiquetas} />
          )}
        </Propriedade>

        <Propriedade
          icone={<SlidersHorizontal aria-hidden className="size-4" />}
          rotulo="Campos"
          podeEditar={false}
        >
          {/* SESSAO-38 (item 2.5): vazio fica limpo — o admin cria campos em Utilitários. */}
          {dados.campos.length === 0 ? (
            <span className="text-sm text-texto-fraco">Sem campos personalizados.</span>
          ) : podeEditar ? (
            <CamposDoCard card={card} podeEditar />
          ) : (
            <dl className="flex flex-col gap-0.5 text-sm">
              {dados.campos.map((c) => (
                <div key={c.id} className="flex gap-1">
                  <dt className="text-texto-suave">{c.nome}:</dt>
                  <dd className="text-texto">
                    {c.valor === null ? '—' : textoDoValorCampo(c, c.valor)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Propriedade>
      </section>

      {/* ---------- descrição ---------- */}
      <section aria-label="Descrição" className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-texto">
          <AlignLeft aria-hidden className="size-4 text-texto-suave" />
          Descrição
          {podeEditar && !editandoDescricao && (
            <Botao
              variante="fantasma"
              tamanho="sm"
              icone={<Pencil />}
              onClick={() => {
                setDescricao(card.descricao ?? '')
                setEditandoDescricao(true)
              }}
            >
              {card.descricao ? 'Editar' : 'Escrever'}
            </Botao>
          )}
        </h3>
        {editandoDescricao ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              editar.mutate({ descricao: descricao.trim() || null })
            }}
          >
            <textarea
              className="min-h-32 rounded-dm border border-borda-forte bg-superficie p-3 text-sm text-texto"
              maxLength={5000}
              autoFocus
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              aria-label="Descrição do card"
            />
            <div className="flex gap-2">
              <Botao type="submit" tamanho="sm" icone={<Save />} carregando={editar.isPending}>
                Salvar
              </Botao>
              <Botao
                type="button"
                variante="secundaria"
                tamanho="sm"
                onClick={() => setEditandoDescricao(false)}
              >
                Cancelar
              </Botao>
            </div>
          </form>
        ) : card.descricao ? (
          <p className="whitespace-pre-wrap break-words text-sm text-texto">{card.descricao}</p>
        ) : (
          <p className="text-sm text-texto-fraco">Sem descrição.</p>
        )}
      </section>

      {/* ---------- anexos (lista no clique) ---------- */}
      <AnexosDoCard
        cardId={card.id}
        quantidade={card.anexos_qtd ?? 0}
        podeAnexar={permissoes.anexar && !tablet}
        podeEditarCard={permissoes.editar}
        verRemovidos={permissoes.ver_removidos}
      />

      {/* ---------- tempo e histórico (no clique) ---------- */}
      <section aria-label="Histórico" className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-texto">
          <History aria-hidden className="size-4 text-texto-suave" />
          Tempo e histórico
        </h3>
        {verHistorico ? (
          <HistoricoDoCard card={card} comCampos={false} alturaLimitada={false} />
        ) : (
          <Botao
            variante="secundaria"
            tamanho="sm"
            icone={<History />}
            className="self-start"
            onClick={() => setVerHistorico(true)}
          >
            Ver o tempo por etapa e o histórico
          </Botao>
        )}
      </section>

      {tablet && (
        <p className={cn('rounded-dm bg-superficie-sutil px-3 py-2 text-xs text-texto-suave')}>
          No tablet a janela é só para ver (pausar e retomar pedem o seu PIN). Para mudar o card,
          anexar ou conversar, use o computador ou o celular.
        </p>
      )}

      <ModalMotivoPausa
        key={pausando ? 'pausar-aberto' : 'pausar-fechado'}
        modo="pausar"
        card={pausando ? card : null}
        pedidoNumero={dados.pedido?.numero ?? null}
        operadorId={pausando?.operadorId}
        tamanho={tablet ? 'galpao' : 'padrao'}
        aoFechar={() => setPausando(null)}
      />

      {tablet && card.setor_atual_id !== null && (
        <ModalPinOperador
          acao={
            pinPara === 'pausar'
              ? 'Pausar o card'
              : pinPara === 'retomar'
                ? 'Retomar o card'
                : pinPara === 'auxiliar'
                  ? 'Auxiliar no card'
                  : pinPara === 'sair_auxilio'
                    ? 'Sair do auxílio'
                    : null
          }
          setorId={card.setor_atual_id}
          aoFechar={() => setPinPara(null)}
          aoIdentificado={(operador) => {
            const gesto = pinPara
            setPinPara(null)
            if (gesto === 'pausar') setPausando({ operadorId: operador.usuario_id })
            if (gesto === 'retomar') retomar.mutate(operador.usuario_id)
            // SESSAO-36 (D-146): o PIN diz quem entra/sai do auxílio.
            if (gesto === 'auxiliar') auxiliar.mutate(operador.usuario_id)
            if (gesto === 'sair_auxilio') sairAuxilio.mutate(operador.usuario_id)
          }}
        />
      )}

      <ModalConcluirAvulso
        key={concluindo ? 'concluir-aberto' : 'concluir-fechado'}
        card={concluindo ? card : null}
        aoFechar={() => {
          setConcluindo(false)
          void releituras()
        }}
      />
    </div>
  )
}

function Propriedade({
  icone,
  rotulo,
  podeEditar = false,
  editando = false,
  aoEditar,
  largo = false,
  children,
}: {
  icone: ReactNode
  rotulo: string
  podeEditar?: boolean
  editando?: boolean
  aoEditar?: () => void
  /** ocupa as duas colunas (a seção dos responsáveis por setor) */
  largo?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1.5 rounded-dm border border-borda p-3',
        largo && 'sm:col-span-2',
      )}
    >
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-texto-suave uppercase">
        {icone}
        {rotulo}
        {podeEditar && aoEditar && (
          <Botao
            variante="fantasma"
            tamanho="sm"
            className="ml-auto normal-case"
            onClick={aoEditar}
          >
            {editando ? 'Pronto' : 'Editar'}
          </Botao>
        )}
      </div>
      {children}
    </div>
  )
}
