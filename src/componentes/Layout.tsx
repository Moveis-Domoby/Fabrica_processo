import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChartColumn,
  ChevronDown,
  ChevronsLeft,
  Factory,
  House,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Store,
  TabletSmartphone,
  X,
} from 'lucide-react'
import { Marca } from './Marca'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { temModulo } from '@/autenticacao/tipos'
import { SinoNotificacoes } from '@/notificacoes/SinoNotificacoes'
import { BolhaExecucao } from '@/afazeres/BolhaExecucao'
import { buscarSetores } from '@/kanban/api'
import { rotaDoSetor, ROTA_INICIAL } from '@/navegacao/rotas'
import { registrarAtividade } from '@/logs/registro'
import { supabase } from '@/lib/supabase'

interface FilhoMenu {
  para: string
  rotulo: string
}

/** Uma seção da barra 2: título opcional + itens (SESSAO-20 — o pai Fábrica
 *  agrupa Controle de Produção, Logística e ROTAS em seções, D-46). */
interface SecaoMenu {
  titulo?: string
  filhos: FilhoMenu[]
}

interface GrupoMenu {
  id: string
  rotulo: string
  icone: ReactNode
  secoes: SecaoMenu[]
}

/** Todos os itens navegáveis de um grupo, seção a seção. */
function filhosDoGrupo(grupo: GrupoMenu): FilhoMenu[] {
  return grupo.secoes.flatMap((s) => s.filhos)
}

const CHAVE_RECOLHIDA = 'dm-sidebar-recolhida'
const CHAVE_PAINEL = 'dm-sidebar-painel-recolhido'
const CHAVE_SECOES = 'dm-sidebar-secoes-recolhidas'

function lerSecoesRecolhidas(): Set<string> {
  try {
    const bruto = localStorage.getItem(CHAVE_SECOES)
    return new Set(bruto ? (JSON.parse(bruto) as string[]) : [])
  } catch {
    return new Set()
  }
}

function lerGuardado(chave: string): boolean {
  try {
    return localStorage.getItem(chave) === '1'
  } catch {
    return false
  }
}

function guardar(chave: string, valor: boolean) {
  try {
    localStorage.setItem(chave, valor ? '1' : '0')
  } catch {
    // sem localStorage: só não fica lembrado
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
 * A casca da aplicação (SESSAO-13 — lei de navegação, no desenho pedido pelo
 * dono): DUAS barras laterais lado a lado. A primeira lista os PAIS (grupos);
 * clicar num pai nunca navega — apenas mostra os filhos dele na SEGUNDA barra,
 * um "menu ao lado do menu". Cada barra tem o próprio botão de recolher, e os
 * dois estados ficam lembrados. A rota /tablet continua sem navegação nenhuma.
 */
export function Layout({ children }: { children: ReactNode }) {
  const { perfil, vinculos, ehLider, sair } = useSessao()
  const location = useLocation()
  const [gavetaAberta, setGavetaAberta] = useState(false)
  const [recolhida, setRecolhida] = useState(() => lerGuardado(CHAVE_RECOLHIDA))
  const [painelRecolhido, setPainelRecolhido] = useState(() => lerGuardado(CHAVE_PAINEL))
  // O grupo cujos filhos aparecem na segunda barra; null = seguir a rota atual.
  const [grupoEscolhido, setGrupoEscolhido] = useState<string | null>(null)
  // Seções recolhidas da barra 2 (Controle de Produção, Logística, ROTAS…).
  const [secoesRecolhidas, setSecoesRecolhidas] = useState<Set<string>>(lerSecoesRecolhidas)

  function alternarSecao(titulo: string) {
    setSecoesRecolhidas((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(titulo)) proximo.delete(titulo)
      else proximo.add(titulo)
      try {
        localStorage.setItem(CHAVE_SECOES, JSON.stringify([...proximo]))
      } catch {
        // sem localStorage: só não fica lembrado
      }
      return proximo
    })
  }

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

  // Módulos por pessoa (SESSAO-20/D-46): sem `fabrica`, somem Fábrica,
  // Dashboards e o botão Modo tablet; sem `comercial`, some o Comercial.
  // Admin vê tudo. O front só esconde — quem nega o dado é o banco.
  const veFabrica = temModulo(perfil, 'fabrica')
  const veComercial = temModulo(perfil, 'comercial')

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

    // O pai Fábrica (D-46): Controle de Produção, Logística e ROTAS viraram
    // seções da barra 2 — os dashboards da produção ficam onde estão (Q-66).
    const secoesFabrica: SecaoMenu[] = [
      ...(filhosProducao.length > 0
        ? [{ titulo: 'Controle de Produção', filhos: filhosProducao }]
        : []),
      ...(veLogistica
        ? [
            {
              titulo: 'Logística',
              filhos: [
                { para: '/fabrica/logistica/expedicao', rotulo: 'Expedição' },
                { para: '/fabrica/logistica/estoque', rotulo: 'Estoque' },
                { para: '/fabrica/logistica/pedidos-em-aguardo', rotulo: 'Pedidos em aguardo' },
                { para: '/fabrica/logistica/danificados', rotulo: 'Danificados' },
              ],
            },
            {
              titulo: 'ROTAS',
              filhos: [
                { para: '/fabrica/rotas/entregas', rotulo: 'Entregas' },
                { para: '/fabrica/rotas/programacao', rotulo: 'Programação' },
              ],
            },
          ]
        : []),
    ]

    return [
      {
        id: 'inicio',
        rotulo: 'Início',
        icone: <House aria-hidden />,
        secoes: [
          {
            filhos: [
              { para: '/inicio/meu-painel', rotulo: 'Meu painel' },
              { para: '/inicio/afazeres', rotulo: 'Meus afazeres' },
              // A visão da liderança virou filha própria (23/09).
              ...(ehLider ? [{ para: '/inicio/afazeres-do-time', rotulo: 'Afazeres do time' }] : []),
            ],
          },
        ],
      },
      ...(veFabrica && secoesFabrica.length > 0
        ? [
            {
              id: 'fabrica',
              rotulo: 'Fábrica',
              icone: <Factory aria-hidden />,
              secoes: secoesFabrica,
            },
          ]
        : []),
      ...(veComercial
        ? [
            {
              id: 'comercial',
              rotulo: 'Comercial',
              icone: <Store aria-hidden />,
              secoes: [
                {
                  filhos: [
                    { para: '/comercial/recompra', rotulo: 'Painel de Recompra' },
                    { para: '/comercial/dashboard', rotulo: 'Dashboard' },
                    { para: '/comercial/listas', rotulo: 'Listas de Disparo' },
                  ],
                },
              ],
            },
          ]
        : []),
      ...(veFabrica
        ? [
            {
              id: 'dashboards',
              rotulo: 'Dashboards',
              icone: <ChartColumn aria-hidden />,
              // SESSAO-16 (D-42): as 4 telas-filhas dos mockups, para a
              // liderança (D-32). SESSAO-23: "Meu desempenho" é o painel
              // PRIVADO de cada um — todo papel logado vê o próprio.
              secoes: [
                {
                  filhos: [
                    { para: '/dashboards/meu-desempenho', rotulo: 'Meu desempenho' },
                    ...(ehLider
                      ? [
                          { para: '/dashboards/visao-do-dia', rotulo: 'Visão do dia' },
                          { para: '/dashboards/tempo-por-setor', rotulo: 'Tempo por setor' },
                          { para: '/dashboards/pessoas', rotulo: 'Pessoas' },
                          { para: '/dashboards/qualidade', rotulo: 'Qualidade' },
                        ]
                      : []),
                  ],
                },
              ],
            },
          ]
        : []),
      ...(ehLider
        ? [
            {
              // Só o rótulo mudou: "Administração" → "Painel admin" (D-46);
              // as rotas /admin/* seguem intactas.
              id: 'admin',
              rotulo: 'Painel admin',
              icone: <Settings aria-hidden />,
              secoes: [
                {
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
              ],
            },
          ]
        : []),
    ]
  }, [perfil, vinculos, setores, souAdmin, ehDoPcp, ehDeTerminal, ehLider, veFabrica, veComercial])

  const grupoAtivo = grupos.find((g) =>
    filhosDoGrupo(g).some((f) => location.pathname.startsWith(f.para)),
  )?.id
  const grupoDoPainel =
    grupos.find((g) => g.id === (grupoEscolhido ?? grupoAtivo)) ??
    (grupos.length > 0 ? grupos[0] : undefined)

  function escolherGrupo(id: string) {
    // Clicar no MESMO pai com o painel aberto recolhe; nos demais casos, abre.
    if (!painelRecolhido && grupoDoPainel?.id === id) {
      setPainelRecolhido(true)
      guardar(CHAVE_PAINEL, true)
      return
    }
    setGrupoEscolhido(id)
    setPainelRecolhido(false)
    guardar(CHAVE_PAINEL, false)
  }

  function alternarRecolhida() {
    setRecolhida((atual) => {
      guardar(CHAVE_RECOLHIDA, !atual)
      return !atual
    })
  }

  function alternarPainel() {
    setPainelRecolhido((atual) => {
      guardar(CHAVE_PAINEL, !atual)
      return !atual
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
          <div className="flex w-full items-center gap-4 px-4 py-3 sm:px-6">
            <Marca tamanho="sm" />
            <span className="hidden text-sm text-grafite-300 sm:inline">
              Plataforma de Produção
            </span>
          </div>
        </header>
        <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8">
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

  const painelAberto = !painelRecolhido && grupoDoPainel !== undefined

  // BARRA 1 — os pais. Clicar seleciona/abre o painel de filhos; nunca navega.
  const barraPais = (
    <div
      className={cn(
        'menu-superficie flex h-full flex-col bg-grafite-700',
        recolhida ? 'w-[4.5rem]' : 'w-60',
      )}
    >
      <div className={cn('flex items-center gap-1 p-3 pb-2', recolhida && 'flex-col')}>
        {!recolhida && (
          <NavLink
            to={ROTA_INICIAL}
            className="min-w-0 flex-1 rounded-dm px-1"
            aria-label="Domoby — início"
            onClick={() => setGavetaAberta(false)}
          >
            <Marca tamanho="sm" />
          </NavLink>
        )}
        {/* O sino no topo, junto à logo (D-36). */}
        <SinoNotificacoes usuarioId={perfil.id} painelLado="esquerda" />
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

      <nav
        aria-label="Navegação principal"
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3"
      >
        {grupos.map((grupo) => {
          const ativo = grupo.id === grupoAtivo
          const mostrando = painelAberto && grupoDoPainel?.id === grupo.id
          return (
            // O PAI: mostra os filhos na barra ao lado — nunca navega (D-36).
            <button
              key={grupo.id}
              type="button"
              onClick={() => escolherGrupo(grupo.id)}
              aria-expanded={mostrando}
              title={recolhida ? grupo.rotulo : undefined}
              className={cn(
                'inline-flex min-h-toque-md items-center gap-3 rounded-dm px-3 text-sm font-semibold transition-colors [&>svg]:size-5 [&>svg]:shrink-0',
                ativo ? 'text-menu-destaque' : 'text-grafite-100',
                mostrando && 'bg-grafite-600',
                'hover:bg-grafite-600',
                recolhida && 'justify-center px-0',
              )}
            >
              {grupo.icone}
              {!recolhida && <span className="flex-1 text-left">{grupo.rotulo}</span>}
            </button>
          )
        })}
      </nav>

      <div className="flex flex-col border-t border-grafite-600">
        {/* Modo tablet: fixo, logo acima do bloco do usuário (D-36).
            Sem o módulo fabrica, o botão some junto com o grupo (D-46). */}
        {veFabrica && (
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
        )}

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
                <span className="truncate text-sm font-medium text-grafite-100">
                  {perfil.nome}
                </span>
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
    </div>
  )

  // BARRA 2 — os filhos do grupo escolhido: um menu ao lado do menu.
  const barraFilhos = painelAberto && grupoDoPainel && (
    <div className="menu-superficie flex h-full w-52 flex-col border-l border-grafite-600 bg-grafite-800">
      <div className="flex min-h-toque-md items-center gap-2 px-3 pt-3">
        <span className="flex-1 truncate text-sm font-bold tracking-tight text-grafite-50">
          {grupoDoPainel.rotulo}
        </span>
        <button
          type="button"
          onClick={alternarPainel}
          aria-label="Recolher o painel de itens"
          className="toque-seguro inline-flex h-toque-md w-toque-md items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600"
        >
          <ChevronsLeft aria-hidden className="size-5" />
        </button>
      </div>
      <nav
        aria-label={`Itens de ${grupoDoPainel.rotulo}`}
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3"
      >
        {grupoDoPainel.secoes.map((secao, indice) => {
          const recolhida = secao.titulo ? secoesRecolhidas.has(secao.titulo) : false
          return (
            <div key={secao.titulo ?? indice} className={cn(indice > 0 && 'mt-3')}>
              {secao.titulo && (
                // O "pai" de seção (Controle de Produção, Logística, ROTAS):
                // recolhe/expande os filhos, com a setinha de dropdown (D-36).
                <button
                  type="button"
                  onClick={() => alternarSecao(secao.titulo!)}
                  aria-expanded={!recolhida}
                  className="mb-0.5 flex w-full items-center gap-1 rounded-dm px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-grafite-400 transition-colors hover:text-grafite-200"
                >
                  <span className="flex-1 text-left">{secao.titulo}</span>
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      'size-4 shrink-0 transition-transform',
                      recolhida && '-rotate-90',
                    )}
                  />
                </button>
              )}
              {!recolhida && (
                <div className="flex flex-col gap-0.5">
                  {secao.filhos.map((filho) => (
                    <NavLink
                      key={filho.para}
                      to={filho.para}
                      onClick={() => setGavetaAberta(false)}
                      className={({ isActive }) =>
                        cn(
                          'inline-flex min-h-toque-md items-center rounded-dm pr-3 text-sm font-medium transition-colors',
                          // indentado quando a seção tem título: é o que mostra
                          // a olho que o item é filho daquele agrupamento
                          secao.titulo ? 'pl-6' : 'pl-3',
                          isActive
                            ? 'bg-menu-ativo text-menu-ativo-texto'
                            : 'text-grafite-100 hover:bg-grafite-600 hover:text-grafite-50',
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
    </div>
  )

  return (
    <div className="min-h-dvh bg-fundo lg:flex">
      {/* Barra do celular: menu + marca + sino (a gaveta traz o resto). */}
      <header className="menu-superficie sticky top-0 z-30 bg-grafite-700 lg:hidden">
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

      {/* As duas barras, lado a lado: gaveta no celular, coluna fixa no computador. */}
      <aside
        aria-label="Menu lateral"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex max-w-[92vw] transition-transform duration-200',
          gavetaAberta ? 'translate-x-0' : '-translate-x-full',
          'lg:sticky lg:top-0 lg:h-dvh lg:shrink-0 lg:translate-x-0',
        )}
      >
        {barraPais}
        {barraFilhos}
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        {/* Toda tela tem botão de voltar (D-36). */}
        <div className="w-full px-4 pt-3 sm:px-6">
          <BotaoVoltar />
        </div>
        <main className="w-full flex-1 px-4 py-3 sm:px-6 sm:pb-8">
          {children}
        </main>
        <footer className="border-t border-borda px-4 py-4 text-center text-sm text-texto-fraco sm:px-6">
          Móveis Domoby · Plataforma de Produção
        </footer>
      </div>

      {/* A bolinha do "em execução agora" percorre a plataforma inteira
          (pedido do dono, 23/09) — só aparece quando algo conta tempo. */}
      <BolhaExecucao />
    </div>
  )
}
