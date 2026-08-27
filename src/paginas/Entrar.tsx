import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { KeyRound, LogIn, UserRound } from 'lucide-react'
import { Botao, Campo } from '@/componentes/ui'
import { Marca } from '@/componentes/Marca'
import { entrar } from '@/autenticacao/api'
import { useSessao } from '@/autenticacao/sessao-contexto'

/** Login com nome de usuário OU e-mail + senha (D-21). Sem autocadastro. */
export function Entrar() {
  const { sessao, carregando: carregandoSessao } = useSessao()
  const [parametros] = useSearchParams()
  const [identificador, setIdentificador] = useState(parametros.get('u') ?? '')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (!carregandoSessao && sessao) return <Navigate to="/" replace />

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (!identificador.trim() || !senha) {
      setErro('Preencha usuário (ou e-mail) e senha.')
      return
    }
    setErro('')
    setEnviando(true)
    try {
      await entrar(identificador.trim(), senha)
      // a sessão muda no provedor e a rota "/" assume
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 py-10">
      <Marca tamanho="lg" sobre="claro" />
      <div className="w-full rounded-dm-lg border border-borda bg-superficie p-5 sm:p-6">
        <h1 className="text-xl">Entrar na plataforma</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Use seu nome de usuário ou seu e-mail. Não tem acesso? Peça à liderança — o cadastro
          só nasce por convite.
        </p>

        <form onSubmit={aoEnviar} className="mt-5 flex flex-col gap-4" noValidate>
          <Campo
            rotulo="Usuário ou e-mail"
            prefixo={<UserRound />}
            autoComplete="username"
            autoCapitalize="none"
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
          />
          <Campo
            rotulo="Senha"
            type="password"
            prefixo={<KeyRound />}
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            erro={erro || undefined}
          />
          <Botao
            type="submit"
            tamanho="lg"
            larguraTotal
            carregando={enviando}
            icone={<LogIn />}
          >
            Entrar
          </Botao>
        </form>
      </div>
      <p className="text-center text-sm text-texto-fraco">
        Primeiro acesso? Entre com a senha padrão que a liderança te passou — você vai criar a
        sua própria senha em seguida.
      </p>
    </div>
  )
}
