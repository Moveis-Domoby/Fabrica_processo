import { useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound, Mail, Send, ShieldCheck } from 'lucide-react'
import { Botao, Campo } from '@/componentes/ui'
import { entrar } from './api'
import { lembrarLogin } from './ultimoLogin'
import {
  emailDoPedidoGuardado,
  solicitarTrocaDeSenha,
  trocaLiberada,
  trocarSenhaLiberada,
} from './trocaDeSenha'

type Etapa = 'inicio' | 'nao_liberado' | 'enviado' | 'liberado'

/**
 * SESSAO-41 (D-191, pedido do dono): "a pessoa clica em trocar minha senha,
 * digita o e-mail dela e já direto consegue trocar; se não estiver liberado,
 * aparece apenas o botão de solicitar; se o e-mail não estiver cadastrado,
 * aparece apenas uma mensagem genérica". A liberação é de um administrador e
 * vale 2 h, uma vez, SÓ neste aparelho — a tela nunca diz se o e-mail existe.
 */
export function RecuperarSenha() {
  const [email, setEmail] = useState(() => emailDoPedidoGuardado())
  const [etapa, setEtapa] = useState<Etapa>('inicio')
  const [mensagem, setMensagem] = useState('')
  const [nova, setNova] = useState('')
  const [repetida, setRepetida] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function trabalhar(gesto: () => Promise<void>) {
    setErro('')
    setEnviando(true)
    try {
      await gesto()
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  const conferir = () =>
    trabalhar(async () => {
      if (!emailValido) throw new Error('Digite o seu e-mail.')
      setEtapa((await trocaLiberada(email)) ? 'liberado' : 'nao_liberado')
    })

  const solicitar = () =>
    trabalhar(async () => {
      if (!emailValido) throw new Error('Digite o seu e-mail.')
      setMensagem(await solicitarTrocaDeSenha(email))
      setEtapa('enviado')
    })

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    if (nova.length < 8) {
      setErro('A senha nova precisa ter pelo menos 8 caracteres.')
      return
    }
    if (nova !== repetida) {
      setErro('As duas senhas não são iguais.')
      return
    }
    await trabalhar(async () => {
      await trocarSenhaLiberada(email, nova)
      // já entra com a senha nova — a sessão muda e a rota da casa assume
      const { usuario } = await entrar(email.trim(), nova)
      lembrarLogin(usuario ?? email.trim())
    })
  }

  return (
    <>
      <h1 className="text-xl">Esqueci minha senha</h1>
      <p className="mt-1 text-sm text-texto-suave">
        Digite o seu e-mail. Se a troca já foi liberada para este aparelho, você cria a senha nova
        agora; se não, peça a liberação — um administrador recebe o aviso na hora.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        <Campo
          rotulo="Seu e-mail"
          name="email"
          type="email"
          inputMode="email"
          prefixo={<Mail />}
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setEtapa('inicio')
            setErro('')
          }}
          erro={etapa !== 'liberado' ? erro || undefined : undefined}
        />

        {etapa === 'nao_liberado' && (
          <p className="rounded-dm border border-atencao-borda bg-atencao-fundo p-3 text-sm text-atencao-texto">
            A troca ainda não foi liberada para este aparelho. Peça a liberação: um administrador
            recebe o aviso e decide.
          </p>
        )}
        {etapa === 'enviado' && (
          <p
            className="rounded-dm border border-info-borda bg-info-fundo p-3 text-sm text-info-texto"
            role="status"
          >
            {mensagem}
          </p>
        )}

        {etapa === 'liberado' ? (
          <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
            <p className="flex items-center gap-2 text-sm text-perfeito-forte">
              <ShieldCheck aria-hidden className="size-4 shrink-0" />
              Troca liberada. Crie a sua senha nova.
            </p>
            <Campo
              rotulo="Senha nova"
              type="password"
              prefixo={<KeyRound />}
              autoComplete="new-password"
              ajuda="Pelo menos 8 caracteres."
              value={nova}
              onChange={(e) => setNova(e.target.value)}
            />
            <Campo
              rotulo="Repita a senha nova"
              type="password"
              prefixo={<KeyRound />}
              autoComplete="new-password"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
              erro={erro || undefined}
            />
            <Botao type="submit" tamanho="lg" larguraTotal carregando={enviando}>
              Salvar a senha nova e entrar
            </Botao>
          </form>
        ) : etapa === 'nao_liberado' ? (
          <Botao
            tamanho="lg"
            larguraTotal
            icone={<Send />}
            carregando={enviando}
            onClick={() => void solicitar()}
          >
            Solicitar troca
          </Botao>
        ) : (
          <Botao
            tamanho="lg"
            larguraTotal
            variante={etapa === 'enviado' ? 'secundaria' : 'primaria'}
            icone={<KeyRound />}
            carregando={enviando}
            onClick={() => void conferir()}
          >
            Trocar minha senha
          </Botao>
        )}
      </div>
    </>
  )
}
