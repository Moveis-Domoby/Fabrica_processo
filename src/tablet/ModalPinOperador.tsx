import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Delete, Fingerprint, UserRound } from 'lucide-react'
import { Botao, Campo, Modal } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { pinVerificar } from '@/autenticacao/api'
import type { OperadorIdentificado } from '@/autenticacao/api'
import { membrosDoSetor } from './api'

export interface ModalPinOperadorProps {
  /** null = fechado; o texto diz qual gesto o PIN vai liberar ("Iniciar", "Mover"…). */
  acao: string | null
  setorId: number
  aoFechar: () => void
  aoIdentificado: (operador: OperadorIdentificado) => void
}

/**
 * O "quem é você?" do tablet compartilhado (D-06/RF-25): o operador toca no
 * PRÓPRIO NOME e digita o PIN num teclado na tela — nenhum teclado do sistema
 * (a demanda pede o ciclo inteiro só com toques). A conferência acontece na
 * Edge Function (o navegador nunca vê hash); o resultado identifica o AUTOR
 * do gesto — a sessão continua sendo a do dispositivo.
 *
 * Se a lista de membros não vier (RLS/vínculos), o campo de matrícula/usuário
 * fica disponível como caminho alternativo.
 */
export function ModalPinOperador({ acao, setorId, aoFechar, aoIdentificado }: ModalPinOperadorProps) {
  const aberto = acao !== null

  const { data: membros = [] } = useQuery({
    queryKey: ['membros-setor', setorId],
    queryFn: () => membrosDoSetor(setorId),
    enabled: aberto && Number.isFinite(setorId),
    staleTime: 5 * 60_000,
  })

  const [escolhido, setEscolhido] = useState<string>('') // usuario do membro tocado
  const [identificador, setIdentificador] = useState('')
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [conferindo, setConferindo] = useState(false)

  // Reabriu para outra ação → tudo limpo (ajuste durante o render, sem effect).
  const [acaoAnterior, setAcaoAnterior] = useState<string | null>(null)
  if (acao !== acaoAnterior) {
    setAcaoAnterior(acao)
    setEscolhido('')
    setIdentificador('')
    setPin('')
    setErro('')
  }

  const quem = escolhido || identificador.trim()

  async function confirmar(pinFinal: string) {
    if (!quem) {
      setErro('Toque no seu nome (ou informe matrícula/usuário).')
      return
    }
    if (pinFinal.length < 4) {
      setErro('PIN: 4 a 6 dígitos.')
      return
    }
    setErro('')
    setConferindo(true)
    try {
      const operador = await pinVerificar(quem, pinFinal)
      setPin('')
      setEscolhido('')
      aoIdentificado(operador)
    } catch (excecao) {
      setPin('')
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.')
    } finally {
      setConferindo(false)
    }
  }

  function digito(d: string) {
    setErro('')
    if (pin.length >= 6) return
    const novo = pin + d
    setPin(novo)
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={(estaAberto) => {
        if (!estaAberto) aoFechar()
      }}
      titulo={acao ? `${acao} — quem é você?` : 'Quem é você?'}
      descricao="A ação sai registrada no SEU nome."
    >
      <div className="flex flex-col gap-4">
        {membros.length > 0 && (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Escolha seu nome">
            {membros.map((m) => (
              <button
                key={m.usuario_id}
                type="button"
                role="radio"
                aria-checked={escolhido === m.usuario}
                onClick={() => {
                  setEscolhido(m.usuario)
                  setIdentificador('')
                  setErro('')
                }}
                className={cn(
                  'flex min-h-toque-lg items-center gap-2 rounded-dm border-2 px-3 py-2 text-left',
                  escolhido === m.usuario
                    ? 'border-acao-ativa bg-superficie-sutil'
                    : 'border-borda bg-superficie',
                )}
              >
                <UserRound aria-hidden className="size-5 shrink-0 text-texto-suave" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-texto">{m.nome}</span>
                  <span className="text-xs text-texto-fraco tabular-nums">{m.matricula}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {membros.length === 0 && (
          /* autocomplete desligado de propósito: o navegador do tablet NUNCA
             preenche aqui a credencial da sessão do setor. */
          <Campo
            rotulo="Matrícula ou usuário"
            prefixo={<Fingerprint />}
            autoCapitalize="none"
            autoComplete="off"
            name="identificacao-operador"
            placeholder="MDM-000-000"
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
          />
        )}

        {/* O PIN digitado, sem teclado do sistema: pontos + teclado na tela. */}
        <div className="flex flex-col items-center gap-3">
          <div aria-label={`PIN: ${pin.length} dígito(s)`} className="flex h-6 items-center gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <span
                key={i}
                aria-hidden
                className={cn(
                  'size-3 rounded-full border border-borda-forte',
                  i < pin.length && 'bg-texto',
                )}
              />
            ))}
          </div>

          <div className="grid w-full max-w-xs grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <Botao
                key={d}
                variante="secundaria"
                tamanho="lg"
                onClick={() => digito(d)}
                aria-label={`Dígito ${d}`}
              >
                {d}
              </Botao>
            ))}
            <Botao
              variante="fantasma"
              tamanho="lg"
              icone={<Delete />}
              aria-label="Apagar dígito"
              onClick={() => setPin(pin.slice(0, -1))}
            />
            <Botao variante="secundaria" tamanho="lg" onClick={() => digito('0')} aria-label="Dígito 0">
              0
            </Botao>
            <Botao
              tamanho="lg"
              carregando={conferindo}
              disabled={pin.length < 4 || !quem}
              onClick={() => void confirmar(pin)}
            >
              OK
            </Botao>
          </div>
        </div>

        {erro && (
          <p className="text-center text-sm text-danificado-forte" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
