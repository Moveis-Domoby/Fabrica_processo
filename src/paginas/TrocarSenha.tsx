import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { Botao, Campo, useNotificacao } from '@/componentes/ui'
import { trocarSenha } from '@/autenticacao/api'
import { useSessao } from '@/autenticacao/sessao-contexto'

/**
 * A troca obrigatória da senha padrão (D-21): enquanto `senha_padrao` for true,
 * a guarda manda TODA rota para cá. Depois, fica disponível para troca voluntária.
 */
export function TrocarSenha() {
  const { perfil, recarregarPerfil } = useSessao()
  const navegar = useNavigate()
  const notificar = useNotificacao()
  const [nova, setNova] = useState('')
  const [repetida, setRepetida] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const obrigatoria = perfil?.senha_padrao ?? false

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (nova.length < 8) {
      setErro('A senha nova precisa de pelo menos 8 caracteres.')
      return
    }
    if (nova !== repetida) {
      setErro('As duas senhas não conferem — digite igual nas duas.')
      return
    }
    setErro('')
    setEnviando(true)
    try {
      await trocarSenha(nova)
      await recarregarPerfil()
      notificar({ titulo: 'Senha definida', descricao: 'A partir de agora, entre com ela.', tom: 'perfeito' })
      navegar('/', { replace: true })
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-6">
      <div className="rounded-dm-lg border border-borda bg-superficie p-5 sm:p-6">
        <ShieldCheck aria-hidden className="size-10 text-acao-ativa" />
        <h1 className="mt-3 text-xl">
          {obrigatoria ? 'Crie a sua senha' : 'Trocar a senha'}
        </h1>
        <p className="mt-1 text-sm text-texto-suave">
          {obrigatoria
            ? 'Você entrou com a senha padrão da fábrica — que todo mundo conhece. Antes de qualquer coisa, crie uma senha só sua.'
            : 'Defina uma senha nova para a sua conta.'}
        </p>

        <form onSubmit={aoEnviar} className="mt-5 flex flex-col gap-4" noValidate>
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
            Salvar senha
          </Botao>
        </form>
      </div>
    </div>
  )
}
