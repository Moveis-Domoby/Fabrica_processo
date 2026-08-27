import { Navigate, Outlet, useLocation } from 'react-router'
import { Loader2, ShieldAlert } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { useSessao } from './sessao-contexto'

function TelaCarregando() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status">
      <Loader2 aria-hidden className="size-8 animate-spin text-texto-fraco" />
      <span className="sr-only">Carregando…</span>
    </div>
  )
}

/** Conta de auth sem cadastro ativo na plataforma: não acessa NADA (SESSAO-03). */
function ContaSemAcesso() {
  const { sair } = useSessao()
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <ShieldAlert aria-hidden className="size-12 text-atencao-forte" />
      <h1 className="text-2xl">Conta sem acesso</h1>
      <p className="text-texto-suave">
        Esta conta não tem cadastro ativo na plataforma. Fale com a liderança para ser
        cadastrado — o acesso só nasce pela mão de um admin ou líder.
      </p>
      <Botao variante="secundaria" onClick={() => void sair()}>
        Sair desta conta
      </Botao>
    </div>
  )
}

/**
 * Guarda de rota por papel (RF-24), testável por URL direta:
 *   sem nível  → basta estar logado, aprovado e com a senha própria definida
 *   'lider'    → admin, papel líder ou líder de algum setor
 *   'admin'    → só admin
 * Enquanto a senha padrão não for trocada, TODA rota redireciona para a troca (D-21).
 */
export function RotaProtegida({ nivel }: { nivel?: 'lider' | 'admin' }) {
  const { carregando, sessao, perfil, ehLider } = useSessao()
  const local = useLocation()

  if (carregando) return <TelaCarregando />
  if (!sessao) return <Navigate to="/entrar" replace />
  if (!perfil) return <ContaSemAcesso />
  if (perfil.senha_padrao && local.pathname !== '/trocar-senha')
    return <Navigate to="/trocar-senha" replace />
  if (nivel === 'admin' && perfil.papel !== 'admin') return <Navigate to="/" replace />
  if (nivel === 'lider' && !ehLider) return <Navigate to="/" replace />

  return <Outlet />
}
