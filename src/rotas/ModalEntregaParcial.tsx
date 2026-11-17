import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Factory, PackageCheck, Truck, TriangleAlert } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { pecasPorExtenso } from '@/kanban/avisoPcp'
import { produtosPorExtenso } from '@/kanban/pcpSaida'
import { textoLimpar, textoManter } from '@/kanban/entregaParcial'
import { abrirEntregaParcial, registrarEntregaParcial } from './api'
import type { PecaEntregaParcial } from './api'
import type { PedidoDaEntrega } from './ModaisEntrega'

/** Depois do gesto, o que a tela relê (o mesmo conjunto dos outros gestos da entrega). */
const CHAVES = [
  ['rotas'],
  ['programacao'],
  ['programadas'],
  ['entregas-do-dia'],
  ['estoque'],
  ['pedidos-lista'],
  ['pedido-ficha'],
  ['devolucoes'],
  ['cards'],
]

/** "Guarda-roupa 3/4 (3/5)" — o nome da peça com o k/n. */
function nomeDaPeca(p: PecaEntregaParcial): string {
  return `${p.descricao ?? 'Peça'}${p.total && p.total > 1 ? ` (${p.indice}/${p.total})` : ''}`
}

/**
 * SESSAO-41 (D-195) ↪️ SESSAO-51 (frentes 1 e 2, pedido do dono de 16/11): a
 * janela separa o que SAIU para a entrega (as peças prontas — vêm marcadas;
 * desmarcada = voltou e espera a decisão da logística, como antes) do que AINDA
 * ESTÁ NA FÁBRICA (as peças em produção e os produtos ainda no PCP — vêm
 * desmarcadas; marcar uma = "foi entregue mesmo", com a confirmação de sempre).
 * O que ficou na fábrica segue a decisão: "Deixar em produção" (padrão; o
 * entregador só tem esta) ou "Limpar da produção" (logística, PCP e admin — dá
 * para voltar atrás em PCP → Entregas parciais). O Tiny não muda.
 */
export function ModalEntregaParcial({
  pedido,
  aoFechar,
}: {
  pedido: PedidoDaEntrega | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [marcadasEscolhidas, setMarcadas] = useState<number[] | null>(null)
  const [fabrica, setFabrica] = useState<'manter' | 'limpar'>('manter')
  const [motivoId, setMotivoId] = useState<number | null>(null)
  const [observacao, setObservacao] = useState('')
  const [confirmarProducao, setConfirmarProducao] = useState<string | null>(null)

  // uma requisição, só com a janela aberta (Lei §3): as peças, as vagas, os motivos e quem pode limpar
  const abertura = useQuery({
    queryKey: ['entrega-parcial-abrir', pedido?.card_id],
    queryFn: () => abrirEntregaParcial(pedido!.card_id),
    enabled: pedido !== null,
    staleTime: 0,
    gcTime: 0,
  })
  const dados = abertura.data
  const pecas = dados?.pecas ?? []
  const prontas = pecas.filter((p) => p.pronta)
  const naFabrica = pecas.filter((p) => !p.pronta)
  const vagas = dados?.vagas ?? 0
  const motivos = dados?.motivos ?? []
  const podeLimpar = dados?.pode_limpar ?? false

  // de início: as prontas marcadas (saíram), as da fábrica desmarcadas (ficaram)
  const marcadas = marcadasEscolhidas ?? prontas.map((p) => p.id)
  const voltaram = prontas.filter((p) => !marcadas.includes(p.id))
  const ficam = naFabrica.filter((p) => !marcadas.includes(p.id))
  const temFabrica = ficam.length > 0 || vagas > 0
  const temPorque = motivoId !== null || observacao.trim() !== ''
  const sobraAlgo = voltaram.length > 0 || temFabrica
  const pode = !dados?.recusa && marcadas.length > 0 && sobraAlgo && temPorque
  const decisao = podeLimpar ? fabrica : 'manter'

  const confirmar = useMutation({
    mutationFn: (confirmarIncompleto: boolean) =>
      registrarEntregaParcial({
        cardId: pedido!.card_id,
        entregues: marcadas,
        motivoId,
        observacao,
        confirmarIncompleto,
        fabrica: decisao,
      }),
    onSuccess: async (r) => {
      const partes = [
        voltaram.length > 0
          ? `${pecasPorExtenso(voltaram.length)} ${voltaram.length === 1 ? 'voltou e espera' : 'voltaram e esperam'} a decisão da logística.`
          : '',
        temFabrica && decisao === 'manter'
          ? 'O que está na fábrica segue em produção — o pedido volta para ser programado quando ficar pronto.'
          : '',
        temFabrica && decisao === 'limpar'
          ? 'O que estava na fábrica saiu da produção (dá para voltar atrás em PCP → Entregas parciais).'
          : '',
      ].filter(Boolean)
      notificar({
        titulo: r.repetido
          ? `Pedido ${pedido?.numero}: esta entrega parcial já estava registrada`
          : `Pedido ${pedido?.numero}: entregue em parte (${marcadas.length} de ${pecas.length + vagas})`,
        descricao: partes.join(' ') || undefined,
        tom: 'perfeito',
      })
      fechar()
      await Promise.all(CHAVES.map((queryKey) => clienteQuery.invalidateQueries({ queryKey })))
    },
    onError: (erro) => {
      const mensagem = erro instanceof Error ? erro.message : ''
      // a plataforma pode estar atrasada (peça não arrastada): pede a confirmação
      if (/ainda aparece em produção/.test(mensagem)) setConfirmarProducao(mensagem)
      else
        notificar({
          titulo: 'Não deu para registrar a entrega parcial',
          descricao: mensagem,
          tom: 'danificado',
        })
    },
  })

  function fechar() {
    setMarcadas(null)
    setFabrica('manter')
    setMotivoId(null)
    setObservacao('')
    setConfirmarProducao(null)
    aoFechar()
  }

  function alternar(id: number) {
    setConfirmarProducao(null)
    setMarcadas(marcadas.includes(id) ? marcadas.filter((x) => x !== id) : [...marcadas, id])
  }

  return (
    <Modal
      aberto={pedido !== null}
      aoFechar={(v) => !v && fechar()}
      titulo={`Entrega parcial — pedido ${pedido?.numero ?? ''}`}
      descricao={pedido?.cliente_nome ?? undefined}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (pode) confirmar.mutate(confirmarProducao !== null)
        }}
      >
        {abertura.isPending && <p className="text-sm text-texto-fraco">Carregando as peças…</p>}
        {abertura.isError && <p className="text-sm text-danificado-forte">{abertura.error.message}</p>}
        {dados?.recusa && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo p-3 text-sm text-atencao-texto"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {dados.recusa}
          </p>
        )}

        {prontas.length > 0 && (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 flex items-center gap-2 text-sm font-medium text-texto">
              <Truck aria-hidden className="size-4 text-texto-suave" />
              Saíram para a entrega
            </legend>
            <p className="text-xs text-texto-suave">
              Marque o que foi entregue. O que ficar desmarcado voltou: espera a decisão da
              logística (reenviar, estoque, outro pedido, danificados…).
            </p>
            {prontas.map((p) => (
              <LinhaPeca key={p.id} peca={p} marcada={marcadas.includes(p.id)} aoAlternar={() => alternar(p.id)} />
            ))}
          </fieldset>
        )}

        {(naFabrica.length > 0 || vagas > 0) && (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 flex items-center gap-2 text-sm font-medium text-texto">
              <Factory aria-hidden className="size-4 text-texto-suave" />
              Ainda na fábrica
            </legend>
            {naFabrica.length > 0 && (
              <p className="text-xs text-texto-suave">
                Marque só se foi entregue mesmo (a plataforma estava atrasada).
              </p>
            )}
            {naFabrica.map((p) => (
              <LinhaPeca
                key={p.id}
                peca={p}
                marcada={marcadas.includes(p.id)}
                aoAlternar={() => alternar(p.id)}
                onde={[p.setor, p.etapa].filter(Boolean).join(' · ')}
              />
            ))}
            {vagas > 0 && (
              <p className="px-1 py-2 text-sm text-texto-suave">
                + {produtosPorExtenso(vagas)} ainda no PCP, sem liberar
              </p>
            )}
          </fieldset>
        )}

        {pecas.length > 0 && (
          <p
            className={cn(
              'text-sm',
              marcadas.length === 0 || !sobraAlgo ? 'text-atencao-texto' : 'text-texto-suave',
            )}
          >
            {marcadas.length === 0
              ? 'Nada marcado — se nada foi entregue, use "Não entregue".'
              : !sobraAlgo
                ? 'Tudo marcado — se foi tudo entregue, use "Entregue".'
                : [
                    `${marcadas.length} entregue${marcadas.length === 1 ? '' : 's'}`,
                    voltaram.length > 0
                      ? `${voltaram.length} ${voltaram.length === 1 ? 'volta' : 'voltam'} para a fábrica`
                      : '',
                    ficam.length + vagas > 0 ? `${ficam.length + vagas} ainda na fábrica` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
          </p>
        )}

        {temFabrica && marcadas.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-texto">E o que ainda está na fábrica?</legend>
            <OpcaoFabrica
              nome="fabrica"
              valor="manter"
              escolhido={decisao === 'manter'}
              aoEscolher={() => setFabrica('manter')}
              titulo="Deixar em produção"
              texto={textoManter(ficam.length, vagas)}
              unica={!podeLimpar}
            />
            {podeLimpar ? (
              <OpcaoFabrica
                nome="fabrica"
                valor="limpar"
                escolhido={decisao === 'limpar'}
                aoEscolher={() => setFabrica('limpar')}
                titulo="Limpar da produção"
                texto={textoLimpar(ficam.length, vagas)}
              />
            ) : (
              <p className="text-xs text-texto-suave">
                Tirar da produção é com a logística — ela pode fazer isso depois.
              </p>
            )}
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-texto">Motivo</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {motivos.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={motivoId === m.id}
                onClick={() => setMotivoId(motivoId === m.id ? null : m.id)}
                className={cn(
                  'min-h-12 rounded-dm border px-3 py-2 text-left text-sm transition-colors',
                  motivoId === m.id
                    ? 'border-acao-ativa bg-acao/15 font-medium text-texto'
                    : 'border-borda bg-superficie text-texto hover:bg-superficie-sutil',
                )}
              >
                {m.texto}
              </button>
            ))}
          </div>
        </fieldset>
        <Campo
          rotulo="Observação"
          ajuda="Escolha um motivo ou escreva aqui — pelo menos um dos dois."
          placeholder="Ex.: a lateral do armário chegou rachada"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />

        {confirmarProducao && (
          <p className="flex items-start gap-2 rounded-dm border border-atencao-borda bg-atencao-fundo p-3 text-sm text-atencao-texto">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {confirmarProducao}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap">
          <Botao type="button" variante="secundaria" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao
            type="submit"
            icone={<PackageCheck />}
            disabled={!pode}
            carregando={confirmar.isPending}
          >
            {confirmarProducao ? 'Confirmar a entrega parcial' : 'Registrar entrega parcial'}
          </Botao>
        </div>
      </form>
    </Modal>
  )
}

function LinhaPeca({
  peca,
  marcada,
  aoAlternar,
  onde,
}: {
  peca: PecaEntregaParcial
  marcada: boolean
  aoAlternar: () => void
  onde?: string
}) {
  return (
    <label className="flex min-h-toque-md cursor-pointer items-center gap-3 rounded-dm px-1 text-sm text-texto hover:bg-superficie-sutil">
      <input
        type="checkbox"
        className="size-6 shrink-0 accent-[var(--dm-acao)]"
        checked={marcada}
        onChange={aoAlternar}
      />
      <span className="flex min-w-0 flex-col">
        <span className="break-words">{nomeDaPeca(peca)}</span>
        {onde && <span className="text-xs text-texto-suave">{onde}</span>}
      </span>
    </label>
  )
}

function OpcaoFabrica({
  nome,
  valor,
  escolhido,
  aoEscolher,
  titulo,
  texto,
  unica = false,
}: {
  nome: string
  valor: string
  escolhido: boolean
  aoEscolher: () => void
  titulo: string
  texto: string
  unica?: boolean
}) {
  return (
    <label
      className={cn(
        'flex min-h-12 cursor-pointer items-start gap-3 rounded-dm border p-3 text-sm transition-colors',
        escolhido ? 'border-acao-ativa bg-acao/10' : 'border-borda bg-superficie hover:bg-superficie-sutil',
      )}
    >
      <input
        type="radio"
        name={nome}
        value={valor}
        checked={escolhido}
        onChange={aoEscolher}
        disabled={unica}
        className="mt-0.5 size-5 shrink-0 accent-[var(--dm-acao)]"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-texto">{titulo}</span>
        <span className="text-texto-suave">{texto}</span>
      </span>
    </label>
  )
}
