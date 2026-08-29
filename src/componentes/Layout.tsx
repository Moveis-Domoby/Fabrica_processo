import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChartColumn,
  ChevronDown,
  Factory,
  House,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Package,
  Settings,
  TabletSmartphone,
  Truck,
  X,
} from 'lucide-react'
import { Marca } from './Marca'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { SinoNotificacoes } from '@/notificacoes/SinoNotificacoes'
import { buscarSetores } from '@/kanban/api'
import { rotaDoSetor, ROTA_INICIAL } from '@/navegacao/rotas'
import { registrarAtividade } from '@/logs/registro'
import { supabase } from '@/lib/supabase'

interface FilhoMenu {
  para: string
  rotulo: string
}

interface GrupoMenu {
  id: string
  rotulo: string
  icone: ReactNode
  filhos: FilhoMenu[]
}

const CHAVE_RECOLHIDA = 'dm-sidebar-recolhida'
const CHAVE_GRUPOS = 'dm-sidebar-grupos'

function lerRecolhida(): boolean {
  try {
    return localStorage.getItem(CHAVE_RECOLHIDA) === '1'
  } catch {
    return false
  }
}

function lerAjustesGrupos(): Record<string, boolean> {
  try {
    const bruto = localStorage.getItem(CHAVE_GRUPOS)
    const valor = bruto ? (JSON.parse(bruto) as unknown) : null
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      return Object.fromEntries(
        Object.entries(valor as Record<string, unknown>).filter(
          ([, v]) => typeof v === 'boolean',
        ),
      ) as Record<string, boolean>
    }
    return {}
  } catch {
    return {}
  }
}

/** O botão de voltar de toda tela: volta à aba anterior; sem histórico, vai para a casa. */
function BotaoVoltar() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => {
        const historico = (window.history.state as { idx?: number } | null)?.idx ?? 0
        if (historico > 0) navigate(-1)
        else navigate(ROTA_INICIAL)
      }}
      className="inline-flex min-h-toque-md items-center gap-2 rounded-dm px-3 text-sm font-medium text-texto-suave transition-colors hover:bg-superficie-sutil hover:text-texto"
    >
      <ArrowLeft aria-hidden className="size-5" />
      Voltar
    </button>
  )
}

/**
 * A casca da aplicação (SESSAO-13 — lei de navegação):
 * sidebar em DOIS NÍVEIS — o pai só expande os filhos em cascata, nunca navega.
 * Presente em toda tela, recolhível (estado lembrado), com o sino no topo
 * junto à logo, o Modo tablet fixo acima do bloco do usuário e Configurações
 * no rodapé. A rota /tablet continua sem navegação nenhuma: lá o operador não
 * navega, ele age.
 */
export function Layout({ children }: { children: ReactNode }) {
  const { perfil, vinculos, ehLider, sair } = useSessao()
  const location = useLocation()
  const [gavetaAberta, setGavetaAberta] = useState(false)
  const [recolhida, setRecolhida] = useState(lerRecolhida)
  // O que a pessoa abriu/fechou de propósito; sem ajuste, o grupo da tela
  // atual vem aberto sozinho (cascata sem gesto extra).
  const [ajustesGrupos, setAjustesGrupos] = useState<Record<string, boolean>>(lerAjustesGrupos)

  const telaCheia = perfil !== null && location.pathname.startsWith('/tablet')
  const souAdmin = perfil?.papel === 'admin'
  const ehDoPcp = vinculos.some((v) => v.setor.codigo === 'pcp')
  const ehDeTerminal = vinculos.some(
    (v) => v.setor.codigo === 'estoque' || v.setor.codigo === 'rotas',
  )

  // Um filho por setor cadastrado — dinâmico, vem do banco (D-12).
  const { data: setores = [] } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
    enabled: perfil !== null,
  })

  // Toda atividade gera registro no banco — a navegação entra aqui.
  useEffect(() => {
    if (perfil) registrarAtividade('navegacao', location.pathname)
  }, [perfil, location.pathname])

  const grupos: GrupoMenu[] = useMemo(() => {
    if (!perfil) return []

    const idsVinculados = new Set(vinculos.map((v) => v.setor_id))
    const setoresDoMenu = setores.filter(
      (s) =>
        s.papel_no_fluxo !== 'terminal' &&
        (souAdmin || ehDoPcp ? true : idsVinculados.has(s.id) || s.codigo === 'pcp'),
    )
    // Operador comum não é do PCP: o quadro do PCP fica com admin/PCP.
    const filhosProducao = setoresDoMenu
      .filter((s) => (s.codigo === 'pcp' ? souAdmin || ehDoPcp : true))
      .map((s) => ({ para: rotaDoSetor(s.codigo), rotulo: s.nome }))

    const veLogistica = souAdmin || ehDoPcp || ehDeTerminal

    return [
      {
        id: 'inicio',
        rotulo: 'Início',
        icone: <House aria-hidden />,
        filhos: [
          { para: '/inicio/meu-painel', rotulo: 'Meu painel' },
          { para: '/inicio/afazeres', rotulo: 'Afazeres' },
        ],
      },
      ...(filhosProducao.length > 0
        ? [
            {
              id: 'producao',
              rotulo: 'Controle de Produção',
              icone: <Factory aria-hidden />,
              filhos: filhosProducao,
            },
          ]
        : []),
      ...(veLogistica
        ? [
            {
              id: 'logistica',
              rotulo: 'Logística',
              icone: <Package aria-hidden />,
              filhos: [
                { para: '/logistica/expedicao', rotulo: 'Expedição' },
                { para: '/logistica/estoque', rotulo: 'Estoque' },
                { para: '/logistica/pedidos-em-aguardo', rotulo: 'Pedidos em aguardo' },
                { para: '/logistica/danificados', rotulo: 'Danificados' },
              ],
            },
            {
              id: 'rotas',
              rotulo: 'ROTAS',
              icone: <Truck aria-hidden />,
              filhos: [{ para: '/rotas/entregas', rotulo: 'Entregas' }],
            },
          ]
        : []),
      ...(ehLider
        ? [
            {
              id: 'dashboards',
              rotulo: 'Dashboards',
              icone: <ChartColumn aria-hidden />,
              filhos: [{ para: '/dashboards/geral', rotulo: 'Visão geral' }],
            },
            {
              id: 'admin',
              rotulo: 'Administração',
              icone: <Settings aria-hidden />,
              filhos: [
                { para: '/admin/equipe', rotulo: 'Gestão da equipe' },
                { para: '/admin/setores-e-etapas', rotulo: 'Setores e etapas' },
                ...(souAdmin
                  ? [
                      { para: '/admin/tempo', rotulo: 'Controle de tempo' },
                      { para: '/admin/api', rotulo: 'API e integrações' },
                      { para: '/admin/caminhoes', rotulo: 'Caminhões' },
                    ]
                  : []),
              ],
            },
          ]
        : []),
    ]
  }, [perfil, vinculos, setores, souAdmin, ehDoPcp, ehDeTerminal, ehLider])

  const grupoAtivo = grupos.find((g) =>
    g.filhos.some((f) => location.pathname.startsWith(f.para)),
  )?.id

  function grupoAberto(id: string): boolean {
    return ajustesGrupos[id] ?? id === grupoAtivo
  }

  function alternarGrupo(id: string) {
    setAjustesGrupos((atuais) => {
      const novos = { ...atuais, [id]: !grupoAberto(id) }
      try {
        localStorage.setItem(CHAVE_GRUPOS, JSON.stringify(novos))
      } catch {
        // sem localStorage: só não fica lembrado
      }
      return novos
    })
  }

  function alternarRecolhida() {
    setRecolhida((atual) => {
      const nova = !atual
      try {
        localStorage.setItem(CHAVE_RECOLHIDA, nova ? '1' : '0')
      } catch {
        // idem
      }
      return nova
    })
  }

  // Modo tablet: sem navegação, tela inteira para a fila (D-06/D-28).
  if (telaCheia) {
    return <main className="min-h-dvh bg-fundo">{children}</main>
  }

  // Sem sessão: o login desenha a própria tela inteira (D-41); convite e
  // estados de carregamento ficam na casca simples de sempre.
  if (!perfil) {
    if (location.pathname === '/entrar') {
      return <div className="min-h-dvh bg-fundo">{children}</div>
    }
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

  const fotoUrl = perfil.foto_caminho
    ? supabase.storage.from('plt-imagens').getPublicUrl(perfil.foto_caminho).data.publicUrl
    : null
  const iniciais = perfil.nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('')

  // No modo recolhido (só no computador), clicar num grupo reabre a sidebar.
  const navegacao = (
    <nav
      aria-label="Navegação principal"
      className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3"
    >
      {grupos.map((grupo) => {
        const aberto = grupoAberto(grupo.id)
        const temAtivo = grupo.id === grupoAtivo
        return (
          <div key={grupo.id} className="flex flex-col">
            {/* O PAI: só expande/recolhe os filhos — nunca navega (D-36). */}
            <button
              type="button"
              onClick={() => {
                if (recolhida) {
                  alternarRecolhida()
                  if (!aberto) alternarGrupo(grupo.id)
                } else {
                  alternarGrupo(grupo.id)
                }
              }}
              aria-expanded={aberto}
              title={recolhida ? grupo.rotulo : undefined}
              className={cn(
                'inline-flex min-h-toque-md items-center gap-3 rounded-dm px-3 text-sm font-semibold transition-colors [&>svg]:size-5 [&>svg]:shrink-0',
                temAtivo ? 'text-marca-300' : 'text-grafite-100',
                'hover:bg-grafite-600',
                recolhida && 'justify-center px-0',
              )}
            >
              {grupo.icone}
              {!recolhida && <span className="flex-1 text-left">{grupo.rotulo}</span>}
              {!recolhida && (
                <ChevronDown
                  aria-hidden
                  className={cn('size-4 transition-transform', aberto && 'rotate-180')}
                />
              )}
            </button>

            {/* OS FILHOS, em cascata. */}
            {!recolhida && aberto && (
              <div className="mb-1 ml-4 flex flex-col gap-0.5 border-l border-grafite-600 pl-2">
                {grupo.filhos.map((filho) => (
                  <NavLink
                    key={filho.para}
                    to={filho.para}
                    onClick={() => setGavetaAberta(false)}
                    className={({ isActive }) =>
                      cn(
                        'inline-flex min-h-toque-md items-center rounded-dm px-3 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-marca-500 text-grafite-950'
                          : 'text-grafite-200 hover:bg-grafite-600 hover:text-grafite-50',
                      )
                    }
                  >
                    {filho.rotulo}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )

  const rodape = (
    <div className="flex flex-col border-t border-grafite-600">
      {/* Modo tablet: fixo, logo acima do bloco do usuário (D-36). */}
      <NavLink
        to="/tablet"
        onClick={() => setGavetaAberta(false)}
        title={recolhida ? 'Modo tablet' : undefined}
        className={cn(
          'mx-3 mt-3 inline-flex min-h-toque-md items-center gap-3 rounded-dm border border-grafite-500 px-3 text-sm font-semibold text-grafite-100 transition-colors hover:bg-grafite-600 [&>svg]:size-5 [&>svg]:shrink-0',
          recolhida && 'justify-center px-0',
        )}
      >
        <TabletSmartphone aria-hidden />
        {!recolhida && 'Modo tablet'}
      </NavLink>

      <div className={cn('flex items-center gap-1 p-3', recolhida && 'flex-col')}>
        {/* O bloco do usuário abre o Meu Perfil (D-41). */}
        <NavLink
          to="/inicio/meu-perfil"
          onClick={() => setGavetaAberta(false)}
          aria-label="Meu perfil"
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-dm px-2 py-1.5 transition-colors hover:bg-grafite-600',
            recolhida && 'flex-none px-1',
          )}
        >
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt=""
              className="size-9 shrink-0 rounded-full border border-grafite-500 object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-grafite-600 text-sm font-semibold text-grafite-100"
            >
              {iniciais}
            </span>
          )}
          {!recolhida && (
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-grafite-100">{perfil.nome}</span>
              <span className="text-xs text-grafite-300 tabular-nums">{perfil.matricula}</span>
            </span>
          )}
        </NavLink>

        {/* Configurações no lugar do sino (D-36): as pessoais vivem no perfil. */}
        <NavLink
          to="/inicio/meu-perfil"
          onClick={() => setGavetaAberta(false)}
          aria-label="Configurações"
          className="toque-seguro inline-flex h-toque-md w-toque-md items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600"
        >
          <Settings aria-hidden className="size-5" />
        </NavLink>
        <button
          type="button"
          onClick={() => void sair()}
          aria-label="Sair da conta"
          className="toque-seguro inline-flex h-toque-md w-toque-md items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600"
        >
          <LogOut aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh bg-fundo lg:flex">
      {/* Barra do celular: menu + marca + sino (a gaveta traz o resto). */}
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
          <NavLink to={ROTA_INICIAL} className="rounded-dm" aria-label="Domoby — início">
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
          'lg:sticky lg:top-0 lg:h-dvh lg:shrink-0 lg:translate-x-0',
          recolhida ? 'lg:w-[4.5rem]' : 'lg:w-64',
        )}
      >
        {/* Topo: logo + SINO (D-36) + recolher/expandir. */}
        <div className={cn('flex items-center gap-1 p-3 pb-2', recolhida && 'flex-col')}>
          {!recolhida && (
            <NavLink
              to={ROTA_INICIAL}
              className="min-w-0 flex-1 rounded-dm px-1"
              aria-label="Domoby — início"
            >
              <Marca tamanho="sm" />
            </NavLink>
          )}
          <span className="hidden lg:inline-flex">
            <SinoNotificacoes usuarioId={perfil.id} painelLado="esquerda" />
          </span>
          <button
            type="button"
            onClick={alternarRecolhida}
            aria-label={recolhida ? 'Expandir o menu' : 'Recolher o menu'}
            className="toque-seguro hidden h-toque-md w-toque-md items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600 lg:inline-flex"
          >
            {recolhida ? (
              <PanelLeftOpen aria-hidden className="size-5" />
            ) : (
              <PanelLeftClose aria-hidden className="size-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setGavetaAberta(false)}
            aria-label="Fechar o menu"
            className="ml-auto inline-flex h-toque-md w-toque-md items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600 lg:hidden"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {!recolhida && (
          <span className="px-4 pb-2 text-xs text-grafite-300">Plataforma de Produção</span>
        )}
        {navegacao}
        {rodape}
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        {/* Toda tela tem botão de voltar (D-36). */}
        <div className="mx-auto w-full max-w-6xl px-4 pt-3 sm:px-6">
          <BotaoVoltar />
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-3 sm:px-6 sm:pb-8">
          {children}
        </main>
        <footer className="border-t border-borda px-4 py-4 text-center text-sm text-texto-fraco sm:px-6">
          Móveis Domoby · Plataforma de Produção
        </footer>
      </div>
    </div>
  )
}
