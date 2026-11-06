import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { Botao, Campo, useNotificacao } from '@/componentes/ui'
import { CabecalhoDaTela } from '@/componentes/CabecalhoDaTela'
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
      notificar({
        titulo: 'Senha definida',
        descricao: 'A partir de agora, entre com ela.',
        tom: 'perfeito',
      })
      navegar('/', { replace: true })
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ↩️ 06/11 (varredura): o título e a setinha na barra escura de cima, como
          em toda tela (antes a barra ficava vazia e o ← e o título soltos no
          cartão). Na troca obrigatória não há para onde voltar: sem a setinha. */}
      <CabecalhoDaTela
        titulo={obrigatoria ? 'Crie a sua senha' : 'Trocar a senha'}
        semVoltar={obrigatoria}
      />
      <div className="mx-auto w-full max-w-sm rounded-dm-lg border border-borda bg-superficie p-5 sm:p-6">
        <ShieldCheck aria-hidden className="size-10 text-acao-ativa" />
        <p className="mt-3 text-sm text-texto-suave">
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
