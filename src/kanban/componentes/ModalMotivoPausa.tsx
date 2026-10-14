import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pause } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { listarMotivos } from '@/rotas/api'
import { pararCard, pausarCard } from '../pausa'
import type { EscolhaDeMotivo } from '../pausa'
import { nomeDoCard, rotuloOrigemCard } from '../rotulos'
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
 */
export function ModalMotivoPausa({
  card,
  modo,
  etapaId,
  etapaNome,
  operadorId,
  tamanho = 'padrao',
  aoFechar,
}: {
  card: Card | null
  modo: 'pausar' | 'parar'
  /** A etapa de parada (só no `parar`). */
  etapaId?: number
  etapaNome?: string
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

  return (
    <Modal
      aberto={aberto}
      aoFechar={(v) => !v && aoFechar()}
      titulo={modo === 'parar' ? `Por que parar? (${etapaNome ?? 'PARADO'})` : 'Por que pausar?'}
      descricao={
        card ? (card.tipo === 'avulso' ? nomeDoCard(card) : rotuloOrigemCard(card)) : undefined
      }
      rodape={
        <>
          <Botao variante="secundaria" tamanho={galpao ? 'galpao' : 'md'} onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            icone={<Pause />}
            tamanho={galpao ? 'galpao' : 'md'}
            carregando={gravar.isPending}
            onClick={confirmar}
          >
            {modo === 'parar' ? 'Parar' : 'Pausar'}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-texto">
          {modo === 'parar'
            ? 'O tempo de quem está trabalhando fecha agora; o motivo fica na frente do card e no histórico.'
            : 'O tempo para de contar e não ocupa o limite de quem executa; o motivo fica na frente do card e no histórico.'}
        </p>
        {isPending && <p className="text-sm text-texto-fraco">Carregando os motivos…</p>}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-texto">Motivo</legend>
          {opcoes.map((o) => (
            <label
              key={o.valor}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-dm border px-3',
                galpao ? 'min-h-toque-lg text-base' : 'min-h-toque-md text-sm',
                escolha === o.valor
                  ? 'border-acao-ativa bg-superficie-sutil font-medium'
                  : 'border-borda',
              )}
            >
              <input
                type="radio"
                name="motivo-pausa"
                className="size-5 accent-marca-500"
                checked={escolha === o.valor}
                onChange={() => {
                  setEscolha(o.valor)
                  setErro('')
                }}
              />
              {o.rotulo}
            </label>
          ))}
        </fieldset>
        {escolha !== '' && (
          <Campo
            rotulo={escolha === OUTRO ? 'Qual o motivo?' : 'Detalhe (opcional)'}
            maxLength={200}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={
              escolha === OUTRO ? 'Ex.: chamado para outra urgência' : 'Ex.: chapa acabou'
            }
          />
        )}
        {erro && (
          <p role="alert" className="text-sm font-medium text-danificado-texto">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
