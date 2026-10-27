import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { ArrowLeft, Fingerprint, KeyRound, LifeBuoy, LogIn, TabletSmartphone, UserRound } from 'lucide-react'
import { Botao, Campo } from '@/componentes/ui'
import { Marca } from '@/componentes/Marca'
import { entrar, entrarPin, tabletEntrar } from '@/autenticacao/api'
import { lembrarLogin, lerUltimoLogin } from '@/autenticacao/ultimoLogin'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { ROTA_INICIAL } from '@/navegacao/rotas'
import { TecladoPin } from '@/tablet/TecladoPin'
import { RecuperarSenha } from '@/autenticacao/RecuperarSenha'

type ModoEntrada = 'senha' | 'pin' | 'tablet' | 'recuperar'

/**
 * Login (SESSAO-13, D-41): tela dividida — logo Domoby grande em tom metálico
 * à esquerda sobre grafite, formulário à direita. No celular, logo em cima e
 * formulário embaixo. Entrada por nome de usuário OU e-mail (D-21).
 *
 * SESSAO-36 (D-146): o MODO TABLET mora aqui — o PIN do SETOR abre o tablet
 * daquele setor (um tablet atende o setor inteiro). E quem tem PIN mas nunca
 * criou senha entra com E-MAIL + PIN (cai na troca obrigatória de senha).
 *
 * SESSAO-38 (D-163): o dono ainda digitava o e-mail toda vez — a tela não
 * lembrava de ninguém (a sessão vence com o tempo parado e cada entrada
 * começava do zero) e o campo do PIN só aceitava e-mail. Agora: o aparelho
 * lembra o NOME DE USUÁRIO de quem entrou (o servidor devolve; quem entrava
 * pelo e-mail passa a ver o próprio usuário), o campo já abre preenchido com
 * o cursor na senha, os campos levam `name`/`autocomplete` para o gerenciador
 * de senhas do navegador preencher, e o PIN aceita usuário ou e-mail.
 *
 * SESSAO-41 (D-191): "Esqueci minha senha" — a troca liberada por um
 * administrador (2 h, uma vez, só neste aparelho), sem e-mail.
 */
export function Entrar() {
  const { sessao, carregando: carregandoSessao } = useSessao()
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const [modo, setModo] = useState<ModoEntrada>('senha')
  // O link de convite (?u=) vence; senão, quem entrou por último neste aparelho.
  const [identificadorInicial] = useState(() => parametros.get('u') ?? lerUltimoLogin())
  const [identificador, setIdentificador] = useState(identificadorInicial)
  const [senha, setSenha] = useState('')
  const [pinPessoa, setPinPessoa] = useState('')
  const [pinSetor, setPinSetor] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (!carregandoSessao && sessao) return <Navigate to={ROTA_INICIAL} replace />

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro('')
    if (modo === 'senha') {
      if (!identificador.trim() || !senha) {
        setErro('Preencha usuário (ou e-mail) e senha.')
        return
      }
    } else if (modo === 'pin') {
      if (!identificador.trim() || !/^[0-9]{2,4}$/.test(pinPessoa)) {
        setErro('Preencha usuário (ou e-mail) e o PIN (2 a 4 dígitos).')
        return
      }
    }
    setEnviando(true)
    try {
      const digitado = identificador.trim()
      const { usuario } =
        modo === 'senha' ? await entrar(digitado, senha) : await entrarPin(digitado, pinPessoa)
      lembrarLogin(usuario ?? digitado)
      // a sessão muda no provedor e a rota da casa assume
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  async function aoEntrarTablet(pin: string) {
    setErro('')
    setEnviando(true)
    try {
      await tabletEntrar(pin)
      navegar('/tablet', { replace: true })
    } catch (excecao) {
      setPinSetor('')
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
            {modo === 'recuperar' ? (
              <RecuperarSenha />
            ) : modo === 'tablet' ? (
              <>
                <h1 className="text-xl">Modo tablet do setor</h1>
                <p className="mt-1 text-sm text-texto-suave">
                  Digite o PIN do SETOR para abrir o tablet dele — qualquer pessoa do setor usa
                  este aparelho depois, se identificando pelo próprio PIN a cada ação.
                </p>
                <div className="mt-5">
                  <TecladoPin
                    pin={pinSetor}
                    aoMudar={(p) => {
                      setErro('')
                      setPinSetor(p)
                    }}
                    aoConfirmar={(p) => void aoEntrarTablet(p)}
                    conferindo={enviando}
                    // SESSAO-37: o PIN do setor tem exatamente 2 dígitos.
                    minimo={2}
                    maximo={2}
                  />
                </div>
              </>
            ) : (
              <>
                <h1 className="text-xl">Entrar na plataforma</h1>
                <p className="mt-1 text-sm text-texto-suave">
                  {modo === 'senha'
                    ? 'Use seu nome de usuário ou seu e-mail. Não tem acesso? Peça à liderança — o cadastro só nasce por convite.'
                    : 'Para quem tem PIN e ainda não criou a própria senha: entre com o seu usuário (ou e-mail) e o PIN — você vai criar a senha em seguida.'}
                </p>

                <form onSubmit={aoEnviar} className="mt-5 flex flex-col gap-4" noValidate>
                  {/* O mesmo campo nos dois jeitos (senha ou PIN) — com `name` e
                      `autocomplete` para o navegador lembrar e preencher. */}
                  <Campo
                    rotulo="Usuário ou e-mail"
                    name="username"
                    prefixo={<UserRound />}
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                  />
                  {modo === 'senha' ? (
                    <Campo
                      rotulo="Senha"
                      name="password"
                      type="password"
                      prefixo={<KeyRound />}
                      autoComplete="current-password"
                      // Já veio com o usuário lembrado: o cursor vai direto à senha.
                      autoFocus={identificadorInicial !== ''}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      erro={erro || undefined}
                    />
                  ) : (
                    <Campo
                      rotulo="PIN (2 a 4 dígitos)"
                      name="pin"
                      type="password"
                      inputMode="numeric"
                      prefixo={<Fingerprint />}
                      autoComplete="off"
                      value={pinPessoa}
                      onChange={(e) => setPinPessoa(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      erro={erro || undefined}
                    />
                  )}
                  <Botao type="submit" tamanho="lg" larguraTotal carregando={enviando} icone={<LogIn />}>
                    Entrar
                  </Botao>
                </form>
              </>
            )}

            {modo === 'tablet' && erro && (
              <p className="mt-3 text-center text-sm text-danificado-forte" role="alert">
                {erro}
              </p>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            {modo !== 'tablet' && (
              <Botao
                variante="secundaria"
                tamanho="lg"
                larguraTotal
                icone={<TabletSmartphone />}
                onClick={() => {
                  setErro('')
                  setModo('tablet')
                }}
              >
                Modo tablet do setor
              </Botao>
            )}
            {modo === 'senha' && (
              <Botao
                variante="fantasma"
                icone={<LifeBuoy />}
                onClick={() => {
                  setErro('')
                  setModo('recuperar')
                }}
              >
                Esqueci minha senha
              </Botao>
            )}
            {modo === 'senha' && (
              <Botao
                variante="fantasma"
                icone={<Fingerprint />}
                onClick={() => {
                  setErro('')
                  setModo('pin')
                }}
              >
                Entrar com usuário e PIN
              </Botao>
            )}
            {modo !== 'senha' && (
              <Botao
                variante="fantasma"
                icone={<ArrowLeft />}
                onClick={() => {
                  setErro('')
                  setModo('senha')
                }}
              >
                Voltar para usuário e senha
              </Botao>
            )}
            {modo === 'senha' && (
              <p className="text-center text-sm text-texto-fraco">
                Primeiro acesso? Entre com a senha padrão que a liderança te passou — você vai
                criar a sua própria senha em seguida.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
