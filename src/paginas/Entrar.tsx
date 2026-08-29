import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { KeyRound, LogIn, UserRound } from 'lucide-react'
import { Botao, Campo } from '@/componentes/ui'
import { Marca } from '@/componentes/Marca'
import { entrar } from '@/autenticacao/api'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { ROTA_INICIAL } from '@/navegacao/rotas'

/**
 * Login (SESSAO-13, D-41): tela dividida — logo Domoby grande em tom metálico
 * à esquerda sobre grafite, formulário à direita. No celular, logo em cima e
 * formulário embaixo. Entrada por nome de usuário OU e-mail (D-21).
 */
export function Entrar() {
  const { sessao, carregando: carregandoSessao } = useSessao()
  const [parametros] = useSearchParams()
  const [identificador, setIdentificador] = useState(parametros.get('u') ?? '')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (!carregandoSessao && sessao) return <Navigate to={ROTA_INICIAL} replace />

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
      // a sessão muda no provedor e a rota da casa assume
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* A metade da marca: grafite com a logo metálica. */}
      <div className="flex items-center justify-center bg-grafite-800 px-6 py-10 lg:min-h-dvh lg:flex-1 lg:py-0">
        <div className="flex flex-col items-center gap-3 text-center">
          <Marca tamanho="xl" sobre="metalico" />
          <p className="text-sm tracking-wide text-grafite-300">Plataforma de Produção</p>
        </div>
      </div>

      {/* A metade do formulário. */}
      <div className="flex flex-1 items-start justify-center px-4 py-8 lg:items-center lg:py-0">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="w-full rounded-dm-lg border border-borda bg-superficie p-5 sm:p-6">
            <h1 className="text-xl">Entrar na plataforma</h1>
            <p className="mt-1 text-sm text-texto-suave">
              Use seu nome de usuário ou seu e-mail. Não tem acesso? Peça à liderança — o
              cadastro só nasce por convite.
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
            Primeiro acesso? Entre com a senha padrão que a liderança te passou — você vai criar
            a sua própria senha em seguida.
          </p>
        </div>
      </div>
    </div>
  )
}
