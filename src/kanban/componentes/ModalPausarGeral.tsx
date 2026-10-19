import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Botao, Campo, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { listarMotivos } from '@/rotas/api'
import { pessoaPausar } from '@/tablet/api'

const OUTRO = '__outro__'

/**
 * SESSAO-37 (D-147): o PAUSAR GERAL — a PESSOA se pausa em todos os cards de
 * uma vez (um motivo só). O card não cai: segue com quem ficou nele e só vai a
 * Pausado quando o último ativo se pausa. No tablet a pessoa é a do PIN; no
 * computador, a da sessão.
 */
export function ModalPausarGeral({
  aberto,
  operadorId,
  operadorNome,
  aoFechar,
  aoPausado,
}: {
  aberto: boolean
  /** No tablet: a pessoa identificada pelo PIN. No PC fica de fora (sessão). */
  operadorId?: string
  operadorNome?: string
  aoFechar: () => void
  aoPausado?: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [escolha, setEscolha] = useState('')
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')

  const { data: motivos = [] } = useQuery({
    queryKey: ['motivos', 'pausa'],
    queryFn: () => listarMotivos('pausa'),
    enabled: aberto,
    staleTime: 10 * 60_000,
  })

  const gravar = useMutation({
    mutationFn: () =>
      pessoaPausar(escolha === OUTRO ? null : Number(escolha), texto.trim() || null, operadorId),
    onSuccess: async (quantos) => {
      notificar({
        titulo:
          quantos > 0
            ? `Pausa geral feita — ${quantos} card${quantos === 1 ? '' : 's'} com a sua parte pausada`
            : 'Nada para pausar — nenhum card seu estava rodando',
        tom: 'atencao',
      })
      setEscolha('')
      setTexto('')
      aoFechar()
      aoPausado?.()
      await clienteQuery.invalidateQueries({ queryKey: ['quadro'] })
    },
    onError: (e) => {
      notificar({
        titulo: 'Não deu para pausar',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      })
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
    gravar.mutate()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={(v) => !v && aoFechar()}
      titulo="Pausar geral"
      descricao={
        (operadorNome ? `O gesto é de ${operadorNome}. ` : '') +
        'Pausa a SUA parte em todos os cards de uma vez — cada card segue com quem ficou nele.'
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          confirmar()
        }}
      >
        <Selecao
          rotulo="Motivo da pausa"
          opcoes={[
            ...motivos.map((m) => ({ valor: String(m.id), rotulo: m.texto })),
            { valor: OUTRO, rotulo: 'Outro' },
          ]}
          valor={escolha}
          aoMudar={(v) => {
            setErro('')
            setEscolha(v)
          }}
        />
        {escolha === OUTRO && (
          <Campo
            rotulo="Qual foi o motivo?"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        )}
        {erro && <p className="text-sm text-danificado-texto">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={gravar.isPending}>
            Pausar tudo
          </Botao>
        </div>
      </form>
    </Modal>
  )
}
