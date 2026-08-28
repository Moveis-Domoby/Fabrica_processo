import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import {
  ClipboardList,
  House,
  Layers,
  ListTree,
  LogOut,
  Menu,
  Package,
  Settings,
  TabletSmartphone,
  UsersRound,
  X,
} from 'lucide-react'
import { Marca } from './Marca'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { SinoNotificacoes } from '@/notificacoes/SinoNotificacoes'

interface ItemMenu {
  para: string
  rotulo: string
  icone: ReactNode
}

/**
 * Casca da aplicação: MENU LATERAL (padrão da SESSAO-07, pedido do dono) no
 * lugar da antiga barra superior. No computador a sidebar fica fixa à
 * esquerda; no celular ela vira gaveta atrás do botão de menu. A navegação por
 * papel continua a mesma: o menu do operador é mínimo, o do líder tem a
 * Equipe, o do admin tem tudo — esconder o link é UX, a barreira é a guarda +
 * RLS.
 *
 * A tela do setor (/tablet) renderiza SEM navegação: o operador não navega,
 * ele age — o dispositivo fica o dia inteiro nela.
 */
export function Layout({ children }: { children: ReactNode }) {
  const { perfil, vinculos, ehLider, sair } = useSessao()
  const location = useLocation()
  const [gavetaAberta, setGavetaAberta] = useState(false)

  const telaCheia = perfil !== null && location.pathname.startsWith('/tablet')

  const souAdmin = perfil?.papel === 'admin'
  const ehDoPcp = vinculos.some((v) => v.setor.codigo === 'pcp')
  const ehDeTerminal = vinculos.some(
    (v) => v.setor.codigo === 'estoque' || v.setor.codigo === 'rotas',
  )
  const meusQuadros: ItemMenu[] = vinculos
    .filter((v) => v.setor.codigo !== 'pcp')
    .map((v) => ({
      para: `/setores/${v.setor_id}`,
      rotulo: v.setor.nome,
      icone: <Layers aria-hidden />,
    }))

  const itens: ItemMenu[] = perfil
    ? [
        { para: '/', rotulo: 'Início', icone: <House aria-hidden /> },
        ...(souAdmin || ehDoPcp
          ? [{ para: '/pcp', rotulo: 'PCP', icone: <ClipboardList aria-hidden /> }]
          : []),
        ...meusQuadros,
        ...(souAdmin || ehDoPcp || ehDeTerminal
          ? [{ para: '/expedicao', rotulo: 'Expedição', icone: <Package aria-hidden /> }]
          : []),
        { para: '/tablet', rotulo: 'Tela do setor', icone: <TabletSmartphone aria-hidden /> },
        ...(ehLider
          ? [
              { para: '/equipe', rotulo: 'Equipe', icone: <UsersRound aria-hidden /> },
              { para: '/estrutura', rotulo: 'Estrutura', icone: <ListTree aria-hidden /> },
            ]
          : []),
        ...(souAdmin
          ? [{ para: '/administracao', rotulo: 'Administração', icone: <Settings aria-hidden /> }]
          : []),
      ]
    : []

  // Tela do setor: sem navegação, tela inteira para a fila (D-06).
  if (telaCheia) {
    return <main className="min-h-dvh bg-fundo">{children}</main>
  }

  // Sem sessão (login/convite): casca simples, sem menu.
  if (!perfil) {
    return (
      <div className="flex min-h-dvh flex-col bg-fundo">
        <header className="bg-grafite-700">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
            <Marca tamanho="sm" />
            <span className="hidden text-sm text-grafite-300 sm:inline">
              Plataforma de Produção
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <footer className="border-t border-borda px-4 py-4 text-center text-sm text-texto-fraco sm:px-6">
          Móveis Domoby · Plataforma de Produção
        </footer>
      </div>
    )
  }

  const navegacao = (
    <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {itens.map((item) => (
        <NavLink
          key={item.para}
          to={item.para}
          end={item.para === '/'}
          // Tocar num link fecha a gaveta (no computador ela nem está aberta).
          onClick={() => setGavetaAberta(false)}
          className={({ isActive }) =>
            cn(
              'inline-flex min-h-toque-md items-center gap-3 rounded-dm px-3 text-sm font-medium transition-colors [&>svg]:size-5 [&>svg]:shrink-0',
              isActive ? 'bg-marca-500 text-grafite-950' : 'text-grafite-100 hover:bg-grafite-600',
            )
          }
        >
          {item.icone}
          {item.rotulo}
        </NavLink>
      ))}
    </nav>
  )

  const rodapeUsuario = (
    <div className="flex items-center gap-2 border-t border-grafite-600 p-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-grafite-100">{perfil.nome}</span>
        <span className="text-xs text-grafite-300 tabular-nums">{perfil.matricula}</span>
      </div>
      <SinoNotificacoes usuarioId={perfil.id} />
      <button
        type="button"
        onClick={() => void sair()}
        aria-label="Sair da conta"
        className="toque-seguro inline-flex h-toque-md w-toque-md items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600"
      >
        <LogOut aria-hidden className="size-5" />
      </button>
    </div>
  )

  return (
    <div className="min-h-dvh bg-fundo lg:flex">
      {/* Barra do celular: menu + marca (a gaveta traz o resto). */}
      <header className="sticky top-0 z-30 bg-grafite-700 lg:hidden">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setGavetaAberta(true)}
            aria-label="Abrir o menu"
            aria-expanded={gavetaAberta}
            className="inline-flex h-toque-md w-toque-md items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600"
          >
            <Menu aria-hidden className="size-6" />
          </button>
          <NavLink to="/" className="rounded-dm" aria-label="Domoby — início">
            <Marca tamanho="sm" />
          </NavLink>
          <div className="ml-auto">
            <SinoNotificacoes usuarioId={perfil.id} />
          </div>
        </div>
      </header>

      {/* Fundo escuro atrás da gaveta aberta (só celular). */}
      {gavetaAberta && (
        <button
          type="button"
          aria-label="Fechar o menu"
          onClick={() => setGavetaAberta(false)}
          className="fixed inset-0 z-40 bg-grafite-950/60 lg:hidden"
        />
      )}

      {/* O menu lateral: gaveta no celular, coluna fixa no computador. */}
      <aside
        aria-label="Menu lateral"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-grafite-700 transition-transform duration-200',
          gavetaAberta ? 'translate-x-0' : '-translate-x-full',
          'lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between gap-2 p-4 pb-3">
          <NavLink to="/" className="rounded-dm" aria-label="Domoby — início">
            <Marca tamanho="sm" />
          </NavLink>
          <button
            type="button"
            onClick={() => setGavetaAberta(false)}
            aria-label="Fechar o menu"
            className="inline-flex h-toque-md w-toque-md items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600 lg:hidden"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <span className="px-4 pb-2 text-xs text-grafite-300">Plataforma de Produção</span>
        {navegacao}
        {rodapeUsuario}
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <footer className="border-t border-borda px-4 py-4 text-center text-sm text-texto-fraco sm:px-6">
          Móveis Domoby · Plataforma de Produção
        </footer>
      </div>
    </div>
  )
}
