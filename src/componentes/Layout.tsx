import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { LogOut } from 'lucide-react'
import { Marca } from './Marca'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { SinoNotificacoes } from '@/notificacoes/SinoNotificacoes'

/** Navegação por papel (RF-24): o menu do operador é mínimo; o do líder tem a
 *  Equipe; o do admin tem tudo. As rotas continuam protegidas pelas guardas —
 *  esconder o link é UX, a barreira é a guarda + RLS. */
export function Layout({ children }: { children: ReactNode }) {
  const { perfil, vinculos, ehLider, sair } = useSessao()

  const souAdmin = perfil?.papel === 'admin'
  const ehDoPcp = vinculos.some((v) => v.setor.codigo === 'pcp')
  // Heurística de menu (a barreira real é a página + RLS): terminal conhecido.
  const ehDeTerminal = vinculos.some((v) => v.setor.codigo === 'estoque' || v.setor.codigo === 'rotas')
  const meusQuadros = vinculos
    .filter((v) => v.setor.codigo !== 'pcp')
    .map((v) => ({ para: `/setores/${v.setor_id}`, rotulo: v.setor.nome }))

  const links = perfil
    ? [
        { para: '/', rotulo: 'Início' },
        ...(souAdmin || ehDoPcp ? [{ para: '/pcp', rotulo: 'PCP' }] : []),
        ...meusQuadros,
        ...(souAdmin || ehDoPcp || ehDeTerminal
          ? [{ para: '/expedicao', rotulo: 'Expedição' }]
          : []),
        { para: '/tablet', rotulo: 'Modo tablet' },
        ...(ehLider
          ? [
              { para: '/equipe', rotulo: 'Equipe' },
              { para: '/estrutura', rotulo: 'Estrutura' },
            ]
          : []),
        ...(souAdmin
          ? [
              { para: '/administracao', rotulo: 'Administração' },
              { para: '/design', rotulo: 'Design system' },
            ]
          : []),
      ]
    : []

  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <header className="bg-grafite-700">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <NavLink to="/" className="rounded-dm" aria-label="Domoby — início">
            <Marca tamanho="sm" />
          </NavLink>

          <span className="hidden text-sm text-grafite-300 sm:inline">Plataforma de Produção</span>

          <nav className="ml-auto flex flex-wrap items-center gap-1" aria-label="Navegação principal">
            {links.map((link) => (
              <NavLink
                key={link.para}
                to={link.para}
                end={link.para === '/'}
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-toque-md items-center rounded-dm px-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-marca-500 text-grafite-950'
                      : 'text-grafite-100 hover:bg-grafite-600',
                  )
                }
              >
                {link.rotulo}
              </NavLink>
            ))}

            {/* SESSAO-06 (Q-18): os avisos automáticos de qualidade chegam aqui. */}
            {perfil && <SinoNotificacoes usuarioId={perfil.id} />}

            {perfil && (
              <div className="ml-2 flex items-center gap-2 border-l border-grafite-600 pl-3">
                <span className="hidden flex-col text-right sm:flex">
                  <span className="text-sm font-medium text-grafite-100">{perfil.nome}</span>
                  <span className="text-xs text-grafite-300 tabular-nums">{perfil.matricula}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void sair()}
                  aria-label="Sair da conta"
                  className="toque-seguro inline-flex h-toque-md items-center gap-1.5 rounded-dm px-3 text-sm font-medium text-grafite-100 transition-colors hover:bg-grafite-600"
                >
                  <LogOut aria-hidden className="size-4" />
                  Sair
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <footer className="border-t border-borda px-4 py-4 text-center text-sm text-texto-fraco sm:px-6">
        Móveis Domoby · Plataforma de Produção
      </footer>
    </div>
  )
}
