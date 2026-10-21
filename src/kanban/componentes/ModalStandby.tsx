import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CirclePause } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { listarMotivos } from '@/rotas/api'
import { porEmStandby } from '../api'

const OUTRO = 'outro'

/**
 * O STAND-BY do pedido no PCP (SESSAO-38 · D-169 ⏳ — pedido do dono): o
 * pedido sai de "Aguardando liberação" e das rotas e para de contar tempo,
 * até alguém lançá-lo para as entregas ou devolvê-lo. O MOTIVO é obrigatório
 * — a lista de Configurações → Utilitários ("Motivos de stand-by") + "Outro",
 * escrito — e vai para a auditoria. O mesmo desenho do motivo da pausa.
 */
export function ModalStandby({
  pedido,
  aoFechar,
}: {
  /** O card do pedido e o número (o subtítulo diz qual). */
  pedido: { cardId: number; numero: number | null } | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [escolha, setEscolha] = useState<string>('')
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const aberto = pedido !== null

  // Reinicia a escolha a cada pedido novo (ajuste durante o render, sem efeito).
  const [anterior, setAnterior] = useState<number | null>(null)
  if ((pedido?.cardId ?? null) !== anterior) {
    setAnterior(pedido?.cardId ?? null)
    setEscolha('')
    setTexto('')
    setErro('')
  }

  const { data: motivos = [], isPending } = useQuery({
    queryKey: ['motivos', 'standby'],
    queryFn: () => listarMotivos('standby'),
    enabled: aberto,
    staleTime: 10 * 60_000,
  })

  const gravar = useMutation({
    mutationFn: async (motivo: { motivoId: number | null; texto: string }) => {
      if (!pedido) return
      await porEmStandby({ cardId: pedido.cardId, ...motivo })
    },
    onSuccess: async () => {
      notificar({
        titulo: 'Pedido em stand-by',
        descricao:
          'Ele está na aba Stand-by do PCP — não conta tempo nem entra nas rotas até voltar.',
        tom: 'atencao',
      })
      aoFechar()
      await clienteQuery.invalidateQueries({ queryKey: ['cards'] })
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para pôr em stand-by',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
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
      titulo="Pôr o pedido em stand-by"
      descricao={pedido?.numero ? `Pedido ${pedido.numero}` : undefined}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          confirmar()
        }}
      >
        <p className="text-sm text-texto-suave">
          O pedido sai de "Aguardando liberação" e das rotas e para de contar tempo. Na aba Stand-by
          dá para lançá-lo direto para as entregas ou devolvê-lo para aguardar liberação.
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
                  'min-h-12 rounded-dm border px-3 py-2 text-left text-sm transition-colors',
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
            escolha === OUTRO ? 'Ex.: o cliente vai mudar de endereço' : 'Ex.: paga na sexta'
          }
          erro={erro || undefined}
        />
        <div className="flex flex-wrap gap-2">
          <Botao
            type="submit"
            icone={<CirclePause />}
            disabled={escolha === ''}
            carregando={gravar.isPending}
          >
            Pôr em stand-by
          </Botao>
          <Botao type="button" variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Modal>
  )
}
