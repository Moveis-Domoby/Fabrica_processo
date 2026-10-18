import { useState } from 'react'
import { Modal } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { pinIdentificar, pinVerificar } from '@/autenticacao/api'
import type { OperadorIdentificado, PinDuplicado } from '@/autenticacao/api'
import { AvatarPessoa } from '@/componentes/ui/Avatar'
import { TecladoPin } from './TecladoPin'

export interface ModalPinOperadorProps {
  /** null = fechado; o texto diz qual gesto o PIN vai liberar ("Iniciar", "Mover"…). */
  acao: string | null
  setorId: number
  aoFechar: () => void
  aoIdentificado: (operador: OperadorIdentificado) => void
  /**
   * SESSAO-36 (D-146 resposta 9): quando o gesto é de UMA pessoa específica
   * (Pausar/Sair/Entrar do ícone), o PIN tem que ser DELA — outro PIN é recusado.
   */
  esperadoId?: string
  esperadoNome?: string
}

/**
 * O "quem é você?" do tablet compartilhado — SESSAO-36 (D-146): SÓ o PIN
 * identifica a pessoa, sem clicar no nome. A conferência acontece na função de
 * autenticação (o navegador nunca vê hash) e tem trava de tentativa e erro.
 * PIN repetido de antes da regra: só nesses casos aparecem os nomes para a
 * pessoa confirmar o seu (resposta 2).
 */
export function ModalPinOperador({
  acao,
  aoFechar,
  aoIdentificado,
  esperadoId,
  esperadoNome,
}: ModalPinOperadorProps) {
  const aberto = acao !== null

  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [conferindo, setConferindo] = useState(false)
  const [duplicados, setDuplicados] = useState<PinDuplicado['duplicado'] | null>(null)
  const [pinConfirmado, setPinConfirmado] = useState('')

  // Reabriu para outra ação → tudo limpo (ajuste durante o render, sem effect).
  const [acaoAnterior, setAcaoAnterior] = useState<string | null>(null)
  if (acao !== acaoAnterior) {
    setAcaoAnterior(acao)
    setPin('')
    setErro('')
    setDuplicados(null)
    setPinConfirmado('')
  }

  function entregar(operador: OperadorIdentificado) {
    if (esperadoId && operador.usuario_id !== esperadoId) {
      setErro(`Este PIN não é de ${esperadoNome ?? 'quem você escolheu'} — cada um usa o próprio PIN.`)
      return
    }
    setPin('')
    setDuplicados(null)
    setPinConfirmado('')
    aoIdentificado(operador)
  }

  async function confirmar(pinFinal: string) {
    if (pinFinal.length < 4) {
      setErro('PIN: 4 a 6 dígitos.')
      return
    }
    setErro('')
    setConferindo(true)
    try {
      const resultado = await pinIdentificar(pinFinal)
      if ('duplicado' in resultado) {
        // PIN repetido de antes da regra: confirmar o nome (D-146 resposta 2)
        setDuplicados(resultado.duplicado)
        setPinConfirmado(pinFinal)
        setPin('')
        return
      }
      entregar(resultado)
    } catch (excecao) {
      setPin('')
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.')
    } finally {
      setConferindo(false)
    }
  }

  async function confirmarNome(d: PinDuplicado['duplicado'][number]) {
    setErro('')
    setConferindo(true)
    try {
      // a identificação final continua conferindo o PIN contra A pessoa escolhida
      const operador = await pinVerificar(d.matricula.toLowerCase(), pinConfirmado)
      entregar(operador)
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.')
    } finally {
      setConferindo(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={(estaAberto) => {
        if (!estaAberto) aoFechar()
      }}
      titulo={acao ? `${acao} — digite o seu PIN` : 'Digite o seu PIN'}
      descricao={
        esperadoNome
          ? `O gesto é de ${esperadoNome}: o PIN precisa ser o dela(e).`
          : 'O PIN identifica você — a ação sai registrada no SEU nome.'
      }
    >
      <div className="flex flex-col gap-4">
        {duplicados ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-texto-suave">
              Este PIN está cadastrado para mais de uma pessoa — toque no SEU nome para confirmar
              (avise a liderança para trocar um dos PINs):
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Confirme seu nome">
              {duplicados.map((d) => (
                <button
                  key={d.usuario_id}
                  type="button"
                  role="radio"
                  aria-checked={false}
                  disabled={conferindo}
                  onClick={() => void confirmarNome(d)}
                  className={cn(
                    'flex min-h-toque-lg items-center gap-2 rounded-dm border-2 border-borda bg-superficie px-3 py-2 text-left',
                  )}
                >
                  <AvatarPessoa nome={d.nome} foto={d.foto_caminho} tamanho="md" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-texto">{d.nome}</span>
                    <span className="text-xs text-texto-fraco tabular-nums">{d.matricula}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <TecladoPin
            pin={pin}
            aoMudar={(p) => {
              setErro('')
              setPin(p)
            }}
            aoConfirmar={(p) => void confirmar(p)}
            conferindo={conferindo}
          />
        )}

        {erro && (
          <p className="text-center text-sm text-danificado-forte" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
