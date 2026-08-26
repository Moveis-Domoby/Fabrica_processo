import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { Marca } from './Marca'
import { cn } from '@/lib/cn'

const LINKS = [
  { para: '/', rotulo: 'Início' },
  { para: '/design', rotulo: 'Design system' },
]

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <header className="bg-grafite-700">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <NavLink to="/" className="rounded-dm" aria-label="Domoby — início">
            <Marca tamanho="sm" />
          </NavLink>

          <span className="hidden text-sm text-grafite-300 sm:inline">Plataforma de Produção</span>

          <nav className="ml-auto flex items-center gap-1" aria-label="Navegação principal">
            {LINKS.map((link) => (
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
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <footer className="border-t border-borda px-4 py-4 text-center text-sm text-texto-fraco sm:px-6">
        Móveis Domoby · Plataforma de Produção · fundação da SESSAO-01
      </footer>
    </div>
  )
}
