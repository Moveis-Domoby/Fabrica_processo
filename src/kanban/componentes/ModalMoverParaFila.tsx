import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft } from 'lucide-react'
import {
  BadgeEstado,
  Botao,
  Campo,
  DESCRICAO_ESTADO,
  ESTADOS_QUALIDADE,
  Modal,
  useNotificacao,
} from '@/componentes/ui'
import type { Estado } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { listarMotivos } from '@/rotas/api'
import { buscarSetores } from '../api'
import { pedeEstadoAoEnviar } from '../arrasto'
import { moverParaFila } from '../mover'
import { nomeDoCard } from '../rotulos'
import type { Card } from '../tipos'

const OUTRO = 'outro'

/**
 * MOVER PARA A FILA (SESSAO-39 · D-173): a janela do botão Mover. Três
 * escolhas, no desenho da casa para motivo (botões grandes em grade, o
 * escolhido marcado — o mesmo do motivo da pausa e da entrega):
 *  1. o SETOR — a fila de qualquer setor de produção (o próprio também, se o
 *     card não está na fila dele);
 *  2. o MOTIVO — obrigatório: a lista "Motivos do Mover" (Configurações →
 *     Utilitários) ou "Outro", escrito;
 *  3. o ESTADO da peça — só quando o setor de onde ela sai pede ao enviar
 *     (D-126, a mesma regra do arrasto).
 * Os setores já moram no cache da casca; abrir lê só a lista de motivos
 * (dado de referência, cache longo).
 */
export function ModalMoverParaFila({
  card,
  naFila,
  executorNome,
  pedidoNumero,
  operadorId,
  tamanho = 'padrao',
  aoFechar,
}: {
  card: Card | null
  /** O card está na etapa de fila do setor dele (então o próprio setor não é destino). */
  naFila: boolean
  /** Quem executa agora — o aviso de que o tempo fecha (D-24). */
  executorNome?: string | null
  pedidoNumero?: number | null
  operadorId?: string
  tamanho?: 'padrao' | 'galpao'
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const aberto = card !== null
  const galpao = tamanho === 'galpao'
  const [setorId, setSetorId] = useState<number | null>(null)
  const [escolha, setEscolha] = useState('')
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<Estado | null>(null)
  const [erro, setErro] = useState('')

  const { data: setores = [] } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
    enabled: aberto,
    staleTime: 10 * 60_000,
  })
  const { data: motivos = [], isPending: carregandoMotivos } = useQuery({
    queryKey: ['motivos', 'mover'],
    queryFn: () => listarMotivos('mover'),
    enabled: aberto,
    staleTime: 10 * 60_000,
  })

  const setoresProducao = setores.filter((s) => s.papel_no_fluxo === 'producao')
  const origem = setores.find((s) => s.id === card?.setor_atual_id) ?? null
  const outroSetor = setorId !== null && setorId !== card?.setor_atual_id
  const pedeEstado =
    card !== null && outroSetor && origem !== null && pedeEstadoAoEnviar(origem, card)
  const destino = setoresProducao.find((s) => s.id === setorId) ?? null

  const gravar = useMutation({
    mutationFn: () =>
      moverParaFila({
        cardId: card!.id,
        setorId: setorId!,
        motivo: { motivoId: escolha === OUTRO ? null : Number(escolha), texto },
        estadoQualidade: pedeEstado ? estado : null,
        operadorId,
      }),
    onSuccess: async (r) => {
      notificar({ titulo: `Card movido para a fila de ${r.setor_nome}`, tom: 'perfeito' })
      aoFechar()
      await Promise.all(
        [['quadro'], ['cards'], ['card-janela'], ['linha-tempo'], ['execucoes'], ['avulsos']].map(
          (queryKey) => clienteQuery.invalidateQueries({ queryKey }),
        ),
      )
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'Não deu para mover. Tente de novo.'),
  })

  function confirmar() {
    if (setorId === null) return setErro('Escolha o setor.')
    if (!escolha) return setErro('Escolha o motivo.')
    if (escolha === OUTRO && texto.trim().length < 3) return setErro('Escreva o motivo.')
    if (pedeEstado && estado === null) return setErro('Marque o estado da peça.')
    setErro('')
    gravar.mutate()
  }

  const subtitulo = card
    ? [
        `${nomeDoCard(card)}${
          card.indice_unidade !== null && card.total_unidades !== null
            ? ` (${card.indice_unidade}/${card.total_unidades})`
            : ''
        }`,
        card.tipo === 'avulso' ? 'Card avulso' : pedidoNumero ? `Pedido ${pedidoNumero}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined
  const alvo = galpao ? 'min-h-toque-galpao text-base' : 'min-h-12 text-sm'
  const botaoEscolha = (marcado: boolean) =>
    cn(
      'rounded-dm border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      alvo,
      marcado
        ? 'border-acao-ativa bg-acao/15 font-medium text-texto'
        : 'border-borda bg-superficie text-texto hover:bg-superficie-sutil',
    )

  return (
    <Modal
      aberto={aberto}
      aoFechar={(v) => !v && aoFechar()}
      titulo="Mover para a fila de um setor"
      descricao={subtitulo}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          confirmar()
        }}
      >
        <p className="text-sm text-texto-suave">
          O card entra na fila do setor escolhido e espera lá como qualquer card que chega. O motivo
          fica no histórico do card e no painel de motivos.
        </p>
        {executorNome && (
          <p className="rounded-dm bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
            {/* D-24: mover nunca bloqueia; encerra a execução aberta. */}
            Este card está <strong>em execução por {executorNome}</strong>. Mover fecha o tempo dele
            agora — conta até este momento.
          </p>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-texto">Para a fila de</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {setoresProducao.map((s) => {
              const aqui = s.id === card?.setor_atual_id
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={setorId === s.id}
                  disabled={aqui && naFila}
                  onClick={() => {
                    setSetorId(s.id)
                    setErro('')
                  }}
                  className={botaoEscolha(setorId === s.id)}
                >
                  {s.nome}
                  {aqui && (
                    <span className="block text-xs font-normal text-texto-suave">
                      {naFila ? 'O card já está na fila daqui' : 'Volta para a fila daqui'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </fieldset>

        {pedeEstado && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-texto">
              Em que estado a peça está saindo? <span aria-hidden>*</span>
            </legend>
            <p className="text-xs text-texto-suave">
              {origem?.nome ?? 'Este setor'} pede o estado da peça ao mandar adiante.
            </p>
            {ESTADOS_QUALIDADE.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={estado === e}
                onClick={() => {
                  setEstado(e)
                  setErro('')
                }}
                className={cn(
                  'toque-seguro flex min-h-toque-lg items-center gap-3 rounded-dm border-2 px-3 py-2 text-left transition-colors',
                  estado === e
                    ? 'border-acao-ativa bg-superficie-sutil'
                    : 'border-borda bg-superficie hover:border-borda-forte',
                )}
              >
                <BadgeEstado estado={e} tamanho="md" />
                <span className="text-xs text-texto-suave">{DESCRICAO_ESTADO[e]}</span>
              </button>
            ))}
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-texto">Motivo</legend>
          {carregandoMotivos && <p className="text-sm text-texto-fraco">Carregando…</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              ...motivos.map((m) => ({ valor: String(m.id), rotulo: m.texto })),
              { valor: OUTRO, rotulo: 'Outro' },
            ].map((o) => (
              <button
                key={o.valor}
                type="button"
                aria-pressed={escolha === o.valor}
                onClick={() => {
                  setEscolha(o.valor)
                  setErro('')
                }}
                className={botaoEscolha(escolha === o.valor)}
              >
                {o.rotulo}
              </button>
            ))}
          </div>
        </fieldset>
        <Campo
          rotulo={escolha === OUTRO ? 'Qual o motivo?' : 'Detalhe (opcional)'}
          maxLength={200}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setErro('')
          }}
          placeholder={
            escolha === OUTRO ? 'Ex.: o cliente mudou a cor' : 'Ex.: a borda descolou na furação'
          }
        />

        {erro && (
          <p className="text-sm text-danificado-forte" role="alert">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Botao
            type="submit"
            icone={<ArrowRightLeft />}
            tamanho={galpao ? 'galpao' : 'md'}
            disabled={setorId === null || escolha === ''}
            carregando={gravar.isPending}
          >
            {destino ? `Mover para ${destino.nome}` : 'Mover'}
          </Botao>
          <Botao
            type="button"
            variante="secundaria"
            tamanho={galpao ? 'galpao' : 'md'}
            onClick={aoFechar}
          >
            Cancelar
          </Botao>
        </div>
      </form>
    </Modal>
  )
}
