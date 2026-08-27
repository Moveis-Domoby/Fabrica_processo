import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Loader2, LogIn, PartyPopper } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { Marca } from '@/componentes/Marca'
import { conviteInfo } from '@/autenticacao/api'
import type { InfoConvite } from '@/autenticacao/api'

/**
 * A página que o link de convite (enviado por WhatsApp — D-21) abre.
 * Mostra quem é a pessoa e o usuário dela, e manda para o login.
 * A senha padrão NUNCA aparece aqui: ela chega pela liderança, por voz.
 */
export function Convite() {
  const { token } = useParams()
  const [info, setInfo] = useState<InfoConvite | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(Boolean(token))

  useEffect(() => {
    if (!token) return
    conviteInfo(token)
      .then(setInfo)
      .catch((excecao: unknown) =>
        setErro(excecao instanceof Error ? excecao.message : 'Convite não encontrado.'),
      )
      .finally(() => setCarregando(false))
  }, [token])

  const semResultado = erro || !token || !info

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 py-10">
      <Marca tamanho="lg" sobre="claro" />
      <div className="w-full rounded-dm-lg border border-borda bg-superficie p-5 text-center sm:p-6">
        {carregando ? (
          <div className="flex justify-center py-8" role="status">
            <Loader2 aria-hidden className="size-8 animate-spin text-texto-fraco" />
            <span className="sr-only">Carregando convite…</span>
          </div>
        ) : semResultado ? (
          <>
            <h1 className="text-xl">Convite não encontrado</h1>
            <p className="mt-2 text-sm text-texto-suave">
              Confira se o link veio completo no WhatsApp — ou peça um novo à liderança.
            </p>
            <Link to="/entrar" className="mt-5 inline-block">
              <Botao variante="secundaria">Ir para o login</Botao>
            </Link>
          </>
        ) : (
          <>
            <PartyPopper aria-hidden className="mx-auto size-10 text-acao-ativa" />
            <h1 className="mt-3 text-xl">
              {info.usado ? `De volta, ${info.nome}!` : `Bem-vindo(a), ${info.nome}!`}
            </h1>
            <p className="mt-2 text-sm text-texto-suave">
              {info.usado ? (
                <>Seu acesso já está ativo. Entre normalmente com sua senha.</>
              ) : (
                <>
                  Seu usuário é <strong className="text-texto">{info.usuario}</strong>. Entre com
                  a senha padrão que a liderança te passou — no primeiro acesso você cria a sua
                  própria senha.
                </>
              )}
            </p>
            <Link to={`/entrar?u=${encodeURIComponent(info.usuario)}`} className="mt-5 inline-block w-full">
              <Botao tamanho="lg" larguraTotal icone={<LogIn />}>
                Fazer meu primeiro acesso
              </Botao>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
