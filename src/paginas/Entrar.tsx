import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import {
  ArrowLeft,
  Fingerprint,
  KeyRound,
  LifeBuoy,
  LogIn,
  TabletSmartphone,
  UserRound,
} from 'lucide-react'
import { Botao, Campo, Dica } from '@/componentes/ui'
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
 *
 * ↩️ Ajuste do dono (06/11 — "a tela de login está ruim, melhore-a; o nome
 * 'Plataforma de produção' vira Sistema Domoby"): as explicações foram para o
 * "i" e os caminhos alternativos (PIN, esqueci a senha) ficaram numa linha.
 * ↩️ 2ª volta (06/11 — "volta isso a ser uma tela grande… gostei desse padrão,
 * deixe ele, porém em uma tela grande"): o cartão pequeno saiu — a tela INTEIRA
 * dividida ao meio: a metade grafite da marca (logo grande) e a metade clara
 * com o formulário centralizado; no celular, a faixa da marca em cima.
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

  const voltarParaSenha = (
    <Botao
      variante="fantasma"
      tamanho="sm"
      icone={<ArrowLeft />}
      onClick={() => {
        setErro('')
        setModo('senha')
      }}
    >
      Voltar para usuário e senha
    </Botao>
  )

  return (
    <div className="grid min-h-dvh bg-superficie md:grid-cols-2">
      {/* A metade da marca: grafite com a logo metálica, de ponta a ponta. */}
      <div className="menu-superficie flex flex-col items-center justify-center gap-3 bg-grafite-800 px-6 py-12 text-center">
        <Marca tamanho="xl" sobre="metalico" />
        <p className="text-base tracking-wide text-grafite-300">Sistema Domoby</p>
      </div>

      {/* A metade do formulário, centralizado. */}
      <div className="flex items-start justify-center px-5 py-10 sm:px-10 md:items-center">
        <div className="flex w-full max-w-md flex-col gap-5">
          {modo === 'recuperar' ? (
            <>
              <RecuperarSenha />
              {voltarParaSenha}
            </>
          ) : modo === 'tablet' ? (
            <>
              {/* relative: o balão do "i" ancora nesta linha */}
              <div className="relative flex items-center gap-1">
                <h1 className="text-2xl">Modo tablet do setor</h1>
                <Dica rotulo="Como funciona o modo tablet" compacta>
                  Digite o PIN do SETOR para abrir o tablet dele — qualquer pessoa do setor usa este
                  aparelho depois, se identificando pelo próprio PIN a cada ação.
                </Dica>
              </div>
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
              {erro && (
                <p className="text-center text-sm text-danificado-forte" role="alert">
                  {erro}
                </p>
              )}
              {voltarParaSenha}
            </>
          ) : (
            <>
              <div className="relative flex items-center gap-1">
                <h1 className="text-2xl">{modo === 'senha' ? 'Entrar' : 'Entrar com PIN'}</h1>
                <Dica rotulo="Como entrar" compacta>
                  {modo === 'senha' ? (
                    <span className="flex flex-col gap-2">
                      <span>
                        Use seu nome de usuário ou seu e-mail. Não tem acesso? Peça à liderança — o
                        cadastro só nasce por convite.
                      </span>
                      <span>
                        Primeiro acesso? Entre com a senha padrão que a liderança te passou — você
                        vai criar a sua própria senha em seguida.
                      </span>
                    </span>
                  ) : (
                    'Para quem tem PIN e ainda não criou a própria senha: entre com o seu usuário (ou e-mail) e o PIN — você vai criar a senha em seguida.'
                  )}
                </Dica>
              </div>

              <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
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

              {modo === 'senha' ? (
                <div className="flex flex-wrap items-center justify-center gap-1">
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    icone={<LifeBuoy />}
                    onClick={() => {
                      setErro('')
                      setModo('recuperar')
                    }}
                  >
                    Esqueci minha senha
                  </Botao>
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    icone={<Fingerprint />}
                    onClick={() => {
                      setErro('')
                      setModo('pin')
                    }}
                  >
                    Entrar com PIN
                  </Botao>
                </div>
              ) : (
                voltarParaSenha
              )}

              {/* O tablet do setor: um caminho à parte, separado por um traço leve. */}
              <div className="border-t border-borda/60 pt-4">
                <Botao
                  variante="secundaria"
                  larguraTotal
                  icone={<TabletSmartphone />}
                  onClick={() => {
                    setErro('')
                    setModo('tablet')
                  }}
                >
                  Modo tablet do setor
                </Botao>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
