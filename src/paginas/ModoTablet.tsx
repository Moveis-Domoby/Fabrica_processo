import { useState } from 'react'
import type { FormEvent } from 'react'
import { BadgeCheck, Fingerprint } from 'lucide-react'
import { Botao, Campo, useNotificacao } from '@/componentes/ui'
import { pinVerificar } from '@/autenticacao/api'
import type { OperadorIdentificado } from '@/autenticacao/api'
import { ROTULO_PAPEL } from '@/autenticacao/tipos'

interface AcaoRegistrada extends OperadorIdentificado {
  hora: string
}

/**
 * O mecanismo do tablet compartilhado (D-06 / RF-25 — preparado nesta sessão):
 * o dispositivo fica logado com a sessão do setor, e CADA ação pede a
 * identificação do operador por matrícula/usuário + PIN. A ação registra o
 * OPERADOR, nunca o "usuário do tablet". As ações de verdade (mover card,
 * iniciar, finalizar) chegam com o kanban e os timers — aqui a ação de teste
 * prova que duas ações seguidas saem com autores diferentes.
 */
export function ModoTablet() {
  const notificar = useNotificacao()
  const [identificador, setIdentificador] = useState('')
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [conferindo, setConferindo] = useState(false)
  const [registros, setRegistros] = useState<AcaoRegistrada[]>([])

  async function aoConfirmar(evento: FormEvent) {
    evento.preventDefault()
    if (!identificador.trim() || !pin) {
      setErro('Informe matrícula (ou usuário) e PIN.')
      return
    }
    setErro('')
    setConferindo(true)
    try {
      const operador = await pinVerificar(identificador.trim(), pin)
      setRegistros((atuais) => [
        { ...operador, hora: new Date().toLocaleTimeString('pt-BR') },
        ...atuais,
      ])
      notificar({ titulo: `Ação registrada por ${operador.nome}`, tom: 'perfeito' })
      setIdentificador('')
      setPin('')
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.')
    } finally {
      setConferindo(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl">Modo tablet</h1>
        <p className="mt-1 text-texto-suave">
          O tablet do setor fica logado numa sessão só — mas <strong className="text-texto">cada
          ação é de quem digitou o PIN</strong>. Teste aqui com dois operadores seguidos.
        </p>
      </div>

      <form
        onSubmit={aoConfirmar}
        className="flex flex-col gap-4 rounded-dm-lg border border-borda bg-superficie p-5"
        noValidate
      >
        <Campo
          rotulo="Matrícula ou usuário"
          prefixo={<Fingerprint />}
          autoCapitalize="none"
          placeholder="MDM-000-000"
          value={identificador}
          onChange={(e) => setIdentificador(e.target.value)}
        />
        <Campo
          rotulo="PIN"
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          erro={erro || undefined}
        />
        <Botao type="submit" tamanho="galpao" larguraTotal carregando={conferindo}>
          Registrar ação de teste
        </Botao>
      </form>

      {registros.length > 0 && (
        <div className="rounded-dm-lg border border-borda bg-superficie">
          <h2 className="border-b border-borda px-4 py-3 text-lg">Ações registradas agora</h2>
          <ul className="divide-y divide-borda">
            {registros.map((r, indice) => (
              <li key={`${r.usuario_id}-${indice}`} className="flex items-center gap-3 px-4 py-3">
                <BadgeCheck aria-hidden className="size-6 shrink-0 text-perfeito-forte" />
                <div className="flex flex-col">
                  <span className="font-medium text-texto">{r.nome}</span>
                  <span className="text-sm text-texto-suave">
                    {r.matricula} · {ROTULO_PAPEL[r.papel]} · às {r.hora}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
