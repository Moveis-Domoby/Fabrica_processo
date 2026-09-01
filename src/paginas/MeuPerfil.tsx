import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AtSign, Camera, Check, IdCard, KeyRound, Phone, Trash2, UserRound } from 'lucide-react'
import { Botao, Campo, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { ROTULO_PAPEL } from '@/autenticacao/tipos'
import {
  alterarSenha,
  atualizarPerfil,
  enviarFotoPerfil,
  removerFotoPerfil,
  salvarTema,
  urlDaFoto,
} from '@/perfil/api'
import { AMOSTRA_TEMA, ROTULO_TEMA, TEMAS, aplicarTema, ehTema } from '@/perfil/tema'
import type { Tema } from '@/perfil/tema'

/**
 * Meu Perfil (SESSAO-13, D-41/D-43): abre pelo bloco do usuário no rodapé da
 * sidebar. Aqui a pessoa troca o nome de login (que é também o exibido a
 * todos), e-mail, telefone, senha (com a atual), a foto e o tema da
 * plataforma — 8 esquemas Domoby do claro ao escuro, aplicados na hora.
 */
export function MeuPerfil() {
  const { perfil, recarregarPerfil } = useSessao()
  const notificar = useNotificacao()
  const entradaFoto = useRef<HTMLInputElement>(null)

  const [nome, setNome] = useState(perfil?.nome ?? '')
  const [usuario, setUsuario] = useState(perfil?.usuario ?? '')
  const [email, setEmail] = useState(perfil?.email ?? '')
  const [telefone, setTelefone] = useState(perfil?.telefone ?? '')
  const [erroDados, setErroDados] = useState('')

  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaConfirma, setSenhaConfirma] = useState('')
  const [erroSenha, setErroSenha] = useState('')

  const salvarDados = useMutation({
    mutationFn: () =>
      atualizarPerfil({
        nome: nome.trim(),
        usuario: usuario.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        telefone: telefone.trim(),
      }),
    onSuccess: async () => {
      await recarregarPerfil()
      notificar({ titulo: 'Dados atualizados', tom: 'perfeito' })
    },
    onError: (excecao) =>
      setErroDados(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.'),
  })

  const trocarSenha = useMutation({
    mutationFn: () => alterarSenha(senhaAtual, senhaNova),
    onSuccess: () => {
      setSenhaAtual('')
      setSenhaNova('')
      setSenhaConfirma('')
      notificar({ titulo: 'Senha alterada', tom: 'perfeito' })
    },
    onError: (excecao) =>
      setErroSenha(excecao instanceof Error ? excecao.message : 'Não deu certo. Tente de novo.'),
  })

  const enviarFoto = useMutation({
    mutationFn: (arquivo: File) =>
      enviarFotoPerfil(perfil!.id, arquivo, perfil!.foto_caminho ?? null),
    onSuccess: async () => {
      await recarregarPerfil()
      notificar({ titulo: 'Foto atualizada', tom: 'perfeito' })
    },
    onError: (excecao) =>
      notificar({
        titulo: excecao instanceof Error ? excecao.message : 'Não consegui enviar a foto.',
        tom: 'danificado',
      }),
  })

  const removerFoto = useMutation({
    mutationFn: () => removerFotoPerfil(perfil!.id, perfil!.foto_caminho!),
    onSuccess: async () => {
      await recarregarPerfil()
      notificar({ titulo: 'Foto removida', tom: 'perfeito' })
    },
  })

  const trocarTema = useMutation({
    mutationFn: (tema: Tema) => salvarTema(perfil!.id, tema),
    onSuccess: () => void recarregarPerfil(),
    onError: () => {
      // Não gravou: volta a tela para o tema que de fato está guardado.
      if (perfil && ehTema(perfil.tema)) aplicarTema(perfil.tema)
      notificar({ titulo: 'Não consegui guardar o tema. Tente de novo.', tom: 'danificado' })
    },
  })

  if (!perfil) return null // a guarda já cuidou

  const temaAtual: Tema = ehTema(perfil.tema) ? perfil.tema : 'claro'
  const temaEscolhido = trocarTema.variables ?? temaAtual
  const fotoUrl = urlDaFoto(perfil.foto_caminho)

  function aoSalvarDados(evento: FormEvent) {
    evento.preventDefault()
    setErroDados('')
    if (!nome.trim()) {
      setErroDados('Informe o nome.')
      return
    }
    salvarDados.mutate()
  }

  function aoTrocarSenha(evento: FormEvent) {
    evento.preventDefault()
    setErroSenha('')
    if (!senhaAtual || !senhaNova) {
      setErroSenha('Preencha a senha atual e a nova.')
      return
    }
    if (senhaNova.length < 8) {
      setErroSenha('A senha nova precisa de pelo menos 8 caracteres.')
      return
    }
    if (senhaNova !== senhaConfirma) {
      setErroSenha('A confirmação não bate com a senha nova.')
      return
    }
    trocarSenha.mutate()
  }

  function aoEscolherTema(tema: Tema) {
    aplicarTema(tema) // aplica NA HORA; o banco guarda em seguida
    trocarTema.mutate(tema)
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-4">
        {fotoUrl ? (
          <img
            src={fotoUrl}
            alt={`Foto de ${perfil.nome}`}
            className="size-16 rounded-full border border-borda object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="inline-flex size-16 items-center justify-center rounded-full bg-superficie-sutil text-xl font-semibold text-texto-suave"
          >
            {perfil.nome
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((parte) => parte[0]?.toUpperCase())
              .join('')}
          </span>
        )}
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-2xl sm:text-3xl">Meu Perfil</h1>
          <p className="text-sm text-texto-suave">
            {ROTULO_PAPEL[perfil.papel]} · matrícula{' '}
            <span className="tabular-nums">{perfil.matricula}</span>
          </p>
        </div>
      </div>

      {/* Foto */}
      <section
        aria-label="Foto de perfil"
        className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-5"
      >
        <h2 className="text-lg">Foto</h2>
        <p className="text-sm text-texto-suave">
          A foto aparece no menu e nas telas da equipe. Só você (e o admin) pode trocá-la.
        </p>
        <input
          ref={entradaFoto}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Escolher foto de perfil"
          onChange={(e) => {
            const arquivo = e.target.files?.[0]
            if (arquivo) enviarFoto.mutate(arquivo)
            e.target.value = ''
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Botao
            variante="secundaria"
            icone={<Camera />}
            carregando={enviarFoto.isPending}
            onClick={() => entradaFoto.current?.click()}
          >
            {perfil.foto_caminho ? 'Trocar a foto' : 'Enviar uma foto'}
          </Botao>
          {perfil.foto_caminho && (
            <Botao
              variante="fantasma"
              icone={<Trash2 />}
              carregando={removerFoto.isPending}
              onClick={() => removerFoto.mutate()}
            >
              Remover
            </Botao>
          )}
        </div>
      </section>

      {/* Dados cadastrais */}
      <section
        aria-label="Dados cadastrais"
        className="flex flex-col gap-4 rounded-dm-lg border border-borda bg-superficie p-5"
      >
        <div>
          <h2 className="text-lg">Dados cadastrais</h2>
          <p className="mt-1 text-sm text-texto-suave">
            O nome de usuário é o seu login e também o nome que os outros veem. CPF e matrícula
            só mudam pela mão do admin.
          </p>
        </div>
        <form onSubmit={aoSalvarDados} className="flex flex-col gap-4" noValidate>
          <Campo
            rotulo="Nome completo"
            prefixo={<IdCard />}
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Campo
            rotulo="Nome de usuário (login)"
            prefixo={<UserRound />}
            autoComplete="username"
            autoCapitalize="none"
            ajuda="3 a 32 caracteres: letras minúsculas, números, ponto, hífen ou underline."
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
          <Campo
            rotulo="E-mail"
            type="email"
            prefixo={<AtSign />}
            autoComplete="email"
            ajuda="O e-mail também serve para entrar na plataforma."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Campo
            rotulo="Telefone"
            type="tel"
            prefixo={<Phone />}
            autoComplete="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            erro={erroDados || undefined}
          />
          <div>
            <Botao type="submit" icone={<Check />} carregando={salvarDados.isPending}>
              Salvar dados
            </Botao>
          </div>
        </form>
      </section>

      {/* Senha */}
      <section
        aria-label="Alterar senha"
        className="flex flex-col gap-4 rounded-dm-lg border border-borda bg-superficie p-5"
      >
        <div>
          <h2 className="text-lg">Senha</h2>
          <p className="mt-1 text-sm text-texto-suave">
            Para trocar, confirme primeiro a senha atual.
          </p>
        </div>
        <form onSubmit={aoTrocarSenha} className="flex flex-col gap-4" noValidate>
          <Campo
            rotulo="Senha atual"
            type="password"
            prefixo={<KeyRound />}
            autoComplete="current-password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
          />
          <Campo
            rotulo="Senha nova"
            type="password"
            prefixo={<KeyRound />}
            autoComplete="new-password"
            ajuda="Pelo menos 8 caracteres."
            value={senhaNova}
            onChange={(e) => setSenhaNova(e.target.value)}
          />
          <Campo
            rotulo="Confirmar a senha nova"
            type="password"
            prefixo={<KeyRound />}
            autoComplete="new-password"
            value={senhaConfirma}
            onChange={(e) => setSenhaConfirma(e.target.value)}
            erro={erroSenha || undefined}
          />
          <div>
            <Botao type="submit" icone={<Check />} carregando={trocarSenha.isPending}>
              Alterar senha
            </Botao>
          </div>
        </form>
      </section>

      {/* Tema */}
      <section
        aria-label="Tema da plataforma"
        className="flex flex-col gap-4 rounded-dm-lg border border-borda bg-superficie p-5"
      >
        <div>
          <h2 className="text-lg">Tema da plataforma</h2>
          <p className="mt-1 text-sm text-texto-suave">
            8 esquemas, do claro ao escuro — todos com a cara da Domoby. A escolha aplica na
            hora e fica guardada para você em qualquer dispositivo.
          </p>
        </div>
        <div role="radiogroup" aria-label="Escolher tema" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TEMAS.map((tema) => {
            const amostra = AMOSTRA_TEMA[tema]
            const escolhido = temaEscolhido === tema
            return (
              <button
                key={tema}
                type="button"
                role="radio"
                aria-checked={escolhido}
                onClick={() => aoEscolherTema(tema)}
                className={cn(
                  'flex min-h-toque-lg flex-col gap-2 rounded-dm border-2 p-3 text-left transition-colors',
                  escolhido ? 'border-acao-ativa' : 'border-borda hover:border-borda-forte',
                )}
              >
                <span
                  aria-hidden
                  className="flex h-10 w-full items-center gap-1 rounded-dm border border-borda px-2"
                  style={{ backgroundColor: amostra.fundo }}
                >
                  <span
                    className="inline-block h-6 w-6 rounded"
                    style={{ backgroundColor: amostra.superficie }}
                  />
                  <span
                    className="inline-block h-2 w-8 rounded-full"
                    style={{ backgroundColor: amostra.texto }}
                  />
                  <span className="ml-auto inline-block h-4 w-4 rounded-full bg-marca-500" />
                </span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-texto">
                  {escolhido && <Check aria-hidden className="size-4 text-acao-ativa" />}
                  {ROTULO_TEMA[tema]}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
