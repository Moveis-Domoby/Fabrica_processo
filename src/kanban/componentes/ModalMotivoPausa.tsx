import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pause } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { listarMotivos } from '@/rotas/api'
import { pararCard, pausarCard } from '../pausa'
import type { EscolhaDeMotivo } from '../pausa'
import { nomeDoCard } from '../rotulos'
import type { Card } from '../tipos'

const OUTRO = 'outro'

/**
 * O MOTIVO DA PAUSA (SESSAO-31 · §4): a lista de Configurações → Utilitários
 * ("Motivos de pausa") + "Outro", escrito. Serve aos dois gestos:
 *  - `pausar` (a janela do card): o tempo para de contar até o Retomar;
 *  - `parar` (soltar o card em execução no PARADO): o tempo fecha, como sempre.
 * O motivo aparece na frente do card e no histórico. No tablet, o PIN vem
 * antes (operadorId). A lista é dado de referência: cache longo, relê só
 * quando alguém muda a lista em Utilitários.
 *
 * ↩️ Ajuste do dono (14/10 noite — "fora do padrão da plataforma"): o mesmo
 * desenho do motivo da entrega — os motivos são botões grandes em grade (o
 * escolhido fica marcado), "Outro" é mais um botão, o detalhe embaixo e as
 * ações no fim do formulário; o subtítulo diz QUAL card (antes: "Pedido …").
 */
export function ModalMotivoPausa({
  card,
  modo,
  etapaId,
  etapaNome,
  pedidoNumero,
  operadorId,
  tamanho = 'padrao',
  aoFechar,
}: {
  card: Card | null
  modo: 'pausar' | 'parar'
  /** A etapa de parada (só no `parar`). */
  etapaId?: number
  etapaNome?: string
  /** O número do pedido do card, quando a tela já sabe (vai no subtítulo). */
  pedidoNumero?: number | null
  operadorId?: string
  tamanho?: 'padrao' | 'galpao'
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [escolha, setEscolha] = useState<string>('')
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const aberto = card !== null
  const galpao = tamanho === 'galpao'

  const { data: motivos = [], isPending } = useQuery({
    queryKey: ['motivos', 'pausa'],
    queryFn: () => listarMotivos('pausa'),
    enabled: aberto,
    staleTime: 10 * 60_000,
  })

  const gravar = useMutation({
    mutationFn: async (motivo: EscolhaDeMotivo) => {
      if (!card) return
      if (modo === 'parar') {
        await pararCard({ cardId: card.id, etapaId: etapaId!, motivo, operadorId })
      } else {
        await pausarCard({ cardId: card.id, motivo, operadorId })
      }
    },
    onSuccess: async () => {
      notificar({
        titulo:
          modo === 'parar'
            ? 'Card parado — o motivo ficou na frente do card'
            : 'Card pausado — o tempo não conta até retomar',
        tom: 'atencao',
      })
      aoFechar()
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['quadro'] }),
        clienteQuery.invalidateQueries({ queryKey: ['card-janela'] }),
        clienteQuery.invalidateQueries({ queryKey: ['linha-tempo'] }),
      ])
    },
    onError: (e) => {
      notificar({
        titulo: modo === 'parar' ? 'Não deu para parar o card' : 'Não deu para pausar',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      })
      if (modo === 'parar') void clienteQuery.invalidateQueries({ queryKey: ['quadro'] })
    },
  })

  function confirmar() {
    if (!escolha) {
      setErro('Escolha o motivo.')
      return
    }
    if (escolha === OUTRO && texto.trim().length < 3) {
      setErro('Escreva o motivo.')
      return
    }
    setErro('')
    gravar.mutate({ motivoId: escolha === OUTRO ? null : Number(escolha), texto })
  }

  const opcoes = [
    ...motivos.map((m) => ({ valor: String(m.id), rotulo: m.texto })),
    { valor: OUTRO, rotulo: 'Outro' },
  ]
  // "Armário multiuso (1/2) · Pedido 13622" — o card de que se fala, sem "Pedido …".
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

  return (
    <Modal
      aberto={aberto}
      aoFechar={(v) => !v && aoFechar()}
      titulo={modo === 'parar' ? `Parar o card — ${etapaNome ?? 'PARADO'}` : 'Pausar o card'}
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
          {modo === 'parar'
            ? 'O tempo de quem está trabalhando fecha agora. O motivo fica na frente do card e no histórico.'
            : 'O tempo para de contar e não ocupa o limite de quem executa. O motivo fica na frente do card e no histórico.'}
        </p>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-texto">Motivo</legend>
          {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {opcoes.map((o) => (
              <button
                key={o.valor}
                type="button"
                aria-pressed={escolha === o.valor}
                onClick={() => {
                  setEscolha(o.valor)
                  setErro('')
                }}
                className={cn(
                  'rounded-dm border px-3 py-2 text-left transition-colors',
                  galpao ? 'min-h-toque-galpao text-base' : 'min-h-12 text-sm',
                  escolha === o.valor
                    ? 'border-acao-ativa bg-acao/15 font-medium text-texto'
                    : 'border-borda bg-superficie text-texto hover:bg-superficie-sutil',
                )}
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
            escolha === OUTRO ? 'Ex.: chamado para outra urgência' : 'Ex.: a chapa acabou'
          }
          erro={erro || undefined}
        />
        <div className="flex flex-wrap gap-2">
          <Botao
            type="submit"
            icone={<Pause />}
            tamanho={galpao ? 'galpao' : 'md'}
            disabled={escolha === ''}
            carregando={gravar.isPending}
          >
            {modo === 'parar' ? 'Parar' : 'Pausar'}
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
