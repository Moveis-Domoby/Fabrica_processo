import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ChartColumn,
  ChevronDown,
  ChevronsLeft,
  Factory,
  House,
  Lightbulb,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Store,
  TabletSmartphone,
  Truck,
  X,
} from 'lucide-react'
import { Marca } from './Marca'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { ehSoEntregador, ehSuperAdmin, ROTA_ENTREGADOR, temModulo } from '@/autenticacao/tipos'
import { SinoNotificacoes } from '@/notificacoes/SinoNotificacoes'
import { AlertaTrocaSenha } from '@/notificacoes/AlertaTrocaSenha'
import { AlertaCardEsquecido } from '@/notificacoes/AlertaCardEsquecido'
import { BolhaExecucao } from '@/afazeres/BolhaExecucao'
import { ProvedorChat } from '@/chat/ProvedorChat'
import { BalaoChat } from '@/chat/BalaoChat'
import { JanelaDoCardNaUrl } from '@/kanban/janela/JanelaDoCardNaUrl'
import { buscarSetores } from '@/kanban/api'
import { nomeNoMenu, rotaDoSetor, ROTA_INICIAL } from '@/navegacao/rotas'
import { registrarAtividade } from '@/logs/registro'
import { navegacaoJaRegistrada } from '@/autenticacao/abertura'
import { supabase } from '@/lib/supabase'
import { useVersaoNova } from '@/lib/versaoNova'
import { useTelaPequena } from '@/lib/telaPequena'
import { AvisoVersaoNova } from '@/componentes/AvisoVersaoNova'
import { AvisoAoVivoPausado } from '@/componentes/AvisoAoVivoPausado'
import { preCarregar } from '@/navegacao/pedacos'
import { medirNaNavegacao } from '@/lib/medicao'
import { BotaoBuscaGeral, BuscaGeralNaCasca } from '@/busca/BotaoBuscaGeral'
import { MenuDoUsuario } from './MenuDoUsuario'
import { VagaDoTitulo } from './vagaDoTitulo'
import { BolhaSugestao, ROTA_SUGESTOES } from '@/tech/BolhaSugestao'
import { JanelaSugestaoNaUrl } from '@/tech/JanelaSugestaoNaUrl'

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

/**
 * ↩️ Ajuste do dono (06/11 — "deixe um pouco menor a aba lateral, diminua a
 * fonte também, mas bem pouco"): no MOUSE os itens do menu têm 36 px; no toque
 * (celular, tablet) seguem com os 44 px mínimos (D-06).
 */
const ALTURA_ITEM = 'min-h-toque-md [@media(pointer:fine)]:min-h-9'
/** A letra do menu: 13 px (era 14). */
const LETRA_MENU = 'text-[0.8125rem]'

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
  // Ajuste do dono (14/10 noite): ninguém fica preso numa versão velha.
  const versaoNova = useVersaoNova()
  const telaPequena = useTelaPequena()
  const [gavetaAberta, setGavetaAberta] = useState(false)
  const [recolhida, setRecolhida] = useState(() => lerGuardado(CHAVE_RECOLHIDA))
  const [painelRecolhido, setPainelRecolhido] = useState(() => lerGuardado(CHAVE_PAINEL))
  // O grupo cujos filhos aparecem na segunda barra; null = seguir a rota atual.
  const [grupoEscolhido, setGrupoEscolhido] = useState<string | null>(null)
  // Seções recolhidas da barra 2 (Controle de Produção, Logística, ROTAS…).
  const [secoesRecolhidas, setSecoesRecolhidas] = useState<Set<string>>(lerSecoesRecolhidas)
  // ↩️ Ajuste do dono (06/11): a janela da busca mora na casca — a lupa foi para
  // o mini menu do rodapé (e segue na barra do celular); o Ctrl+K continua.
  const [buscaAberta, setBuscaAberta] = useState(false)
  // ↩️ 06/11 (3ª volta): a vaga do título na barra escura do topo (celular e
  // tablet em pé) — o `CabecalhoDaTela` leva a setinha, o nome e o ? para lá.
  const [vagaTitulo, setVagaTitulo] = useState<HTMLDivElement | null>(null)
  const abrirBusca = useCallback(() => {
    setGavetaAberta(false)
    setBuscaAberta(true)
  }, [])

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

  // SESSAO-43 (F3): o Modo TV também é tela cheia, sem menu (exceção à lei de
  // layout, como o tablet — a TV é de olhar, não de navegar).
  const telaCheia =
    perfil !== null &&
    (location.pathname.startsWith('/tablet') || location.pathname.startsWith('/dashboards/modo-tv'))
  // SESSAO-27 (pedido do dono, 02/10): abrir uma automação é entrar numa ÁREA
  // DE TRABALHO — o menu RECOLHE sozinho ao entrar (a pessoa pode reabrir) e
  // volta ao jeito lembrado ao sair; a barra do editor tem o voltar.
  const modoFoco =
    perfil !== null &&
    location.pathname === '/super-admin/automacoes' &&
    new URLSearchParams(location.search).has('a')
  const [focoAnterior, setFocoAnterior] = useState(false)
  if (modoFoco !== focoAnterior) {
    setFocoAnterior(modoFoco)
    setRecolhida(modoFoco ? true : lerGuardado(CHAVE_RECOLHIDA))
    setPainelRecolhido(modoFoco ? true : lerGuardado(CHAVE_PAINEL))
    setGavetaAberta(false)
  }
  const souAdmin = perfil?.papel === 'admin'
  const souSuperAdmin = ehSuperAdmin(perfil)
  // SESSAO-30 (D-115): o entregador vê só as entregas do dia — nem o quadro,
  // nem o chat, nem a bolinha de execução.
  const soEntregador = ehSoEntregador(perfil)
  const ehDoPcp = vinculos.some((v) => v.setor.codigo === 'pcp')
  // SESSAO-24: todo fim de linha (ESTOQUE, Pedidos em aguardo, ROTAS) é logística.
  const ehDeTerminal = vinculos.some((v) =>
    ['estoque', 'aguardo', 'rotas'].includes(v.setor.codigo),
  )

  // Um filho por setor cadastrado — dinâmico, vem do banco (D-12).
  const { data: setores = [] } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
    enabled: perfil !== null,
  })

  // Toda atividade gera registro no banco — a navegação entra aqui. A da 1ª
  // tela já foi gravada pela abertura do app (SESSAO-32); recarregar o perfil
  // (tema, nome) não é navegação — o efeito segue o id, não o objeto.
  const perfilId = perfil?.id ?? null
  useEffect(() => {
    medirNaNavegacao(location.pathname)
    if (!perfilId || navegacaoJaRegistrada(location.pathname)) return
    registrarAtividade('navegacao', location.pathname)
  }, [perfilId, location.pathname])

  // Módulos por pessoa (SESSAO-20/D-46): sem `fabrica`, somem Fábrica,
  // Dashboards e o botão Modo tablet; sem `comercial`, some o Comercial.
  // Admin vê tudo. O front só esconde — quem nega o dado é o banco.
  const veFabrica = temModulo(perfil, 'fabrica')
  const veComercial = temModulo(perfil, 'comercial')

  const souProducao = perfil?.papel === 'producao'
  const souLogistica = perfil?.papel === 'logistica'

  const grupos: GrupoMenu[] = useMemo(() => {
    if (!perfil) return []
    // SESSAO-46 (D-265): o pai Tech — o quadro das sugestões de melhoria é de
    // TODO nível (todos acompanham; só o super admin move — o banco garante).
    const grupoTech: GrupoMenu = {
      id: 'tech',
      rotulo: 'Tech',
      icone: <Lightbulb aria-hidden />,
      secoes: [{ filhos: [{ para: ROTA_SUGESTOES, rotulo: 'Sugestão de melhoria' }] }],
    }
    if (soEntregador) {
      return [
        {
          id: 'entregas',
          rotulo: 'Entregas',
          icone: <Truck aria-hidden />,
          secoes: [{ filhos: [{ para: ROTA_ENTREGADOR, rotulo: 'Entregas do dia' }] }],
        },
        grupoTech,
      ]
    }

    // SESSAO-37 (D-147): a LINHA DE PRODUÇÃO vê os setores de produção (os
    // dela abrem livre; os outros pedem o PIN do setor na tela), o chat e os
    // afazeres dela — e mais nada.
    if (souProducao) {
      const filhosSetores = setores
        .filter((s) => s.papel_no_fluxo === 'producao')
        .map((s) => ({ para: rotaDoSetor(s.codigo), rotulo: nomeNoMenu(s.nome) }))
      return [
        {
          id: 'inicio',
          rotulo: 'Início',
          icone: <House aria-hidden />,
          secoes: [
            {
              filhos: [
                { para: '/inicio/afazeres', rotulo: 'Meus afazeres' },
                { para: '/inicio/chat', rotulo: 'Chat' },
              ],
            },
          ],
        },
        ...(filhosSetores.length > 0
          ? [
              {
                id: 'fabrica',
                rotulo: 'Fábrica',
                icone: <Factory aria-hidden />,
                secoes: [{ titulo: 'Controle de produção', filhos: filhosSetores }],
              },
            ]
          : []),
        grupoTech,
      ]
    }

    const idsVinculados = new Set(vinculos.map((v) => v.setor_id))
    const setoresDoMenu = setores.filter(
      (s) =>
        s.papel_no_fluxo !== 'terminal' &&
        // SESSAO-37 (D-147): o nível logística vê TODOS os setores de produção (só olhando).
        (souAdmin || ehDoPcp || souLogistica
          ? true
          : idsVinculados.has(s.id) || s.codigo === 'pcp'),
    )
    // Operador comum não é do PCP: o quadro do PCP fica com admin/PCP.
    const filhosProducao = setoresDoMenu
      .filter((s) => (s.codigo === 'pcp' ? souAdmin || ehDoPcp : true))
      // ↩️ Ajuste do dono (14/10 noite): o nome do setor no padrão do menu.
      .map((s) => ({ para: rotaDoSetor(s.codigo), rotulo: nomeNoMenu(s.nome) }))

    // SESSAO-37 (D-147): o nível logística recebe o módulo inteiro por definição.
    const veLogistica = (souAdmin || ehDoPcp || ehDeTerminal || souLogistica) && !soEntregador

    // O pai Fábrica (D-46): Controle de Produção, Logística e ROTAS viraram
    // seções da barra 2 — os dashboards da produção ficam onde estão (Q-66).
    const secoesFabrica: SecaoMenu[] = [
      ...(filhosProducao.length > 0
        ? [{ titulo: 'Controle de produção', filhos: filhosProducao }]
        : []),
      ...(veLogistica
        ? [
            {
              titulo: 'Logística',
              filhos: [
                { para: '/fabrica/logistica/expedicao', rotulo: 'Expedição' },
                { para: '/fabrica/logistica/estoque', rotulo: 'Estoque' },
                { para: '/fabrica/logistica/danificados', rotulo: 'Danificados' },
              ],
            },
            {
              titulo: 'Rotas',
              filhos: [
                { para: '/fabrica/rotas/entregas', rotulo: 'Entregas' },
                { para: '/fabrica/rotas/programacao', rotulo: 'Programação' },
                // ↪️ D-121: "Entregas do dia" é aba de Entregas — não é filho no menu.
              ],
            },
            // ↩️ 14/10 (D-134): o pai Pedidos — Todos os pedidos (saiu do PCP)
            // e Cancelados (veio da Logística, com a história inteira).
            // ↩️ 22/10 (D-161, pedido do dono): Pedidos mora logo abaixo de Rotas.
            {
              titulo: 'Pedidos',
              filhos: [
                { para: '/fabrica/pedidos/todos', rotulo: 'Todos os pedidos' },
                { para: '/fabrica/pedidos/cancelados', rotulo: 'Cancelados' },
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
              ...(ehLider
                ? [{ para: '/inicio/afazeres-do-time', rotulo: 'Afazeres do time' }]
                : []),
              // O chat interno (SESSAO-26) — o balão também abre em qualquer tela.
              { para: '/inicio/chat', rotulo: 'Chat' },
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
      ...(veComercial && !souLogistica
        ? [
            {
              id: 'comercial',
              rotulo: 'Comercial',
              icone: <Store aria-hidden />,
              secoes: [
                {
                  filhos: [
                    { para: '/comercial/recompra', rotulo: 'Painel de recompra' },
                    { para: '/comercial/dashboard', rotulo: 'Dashboard' },
                    { para: '/comercial/listas', rotulo: 'Listas de disparo' },
                  ],
                },
              ],
            },
          ]
        : []),
      ...(veFabrica && !souLogistica
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
                    // SESSAO-36 (D-146): todos veem a tela — o banco devolve
                    // todo mundo ao líder/admin e só o próprio ao funcionário.
                    { para: '/dashboards/tempos-por-pessoa', rotulo: 'Tempos por pessoa' },
                    // SESSAO-43: os tempos de cada setor (absorveu "Tempo por
                    // setor"); o funcionário vê só o que ele montou.
                    { para: '/dashboards/tempos-de-producao', rotulo: 'Tempos de produção' },
                    ...(ehLider
                      ? [
                          { para: '/dashboards/visao-do-dia', rotulo: 'Visão do dia' },
                          { para: '/dashboards/pessoas', rotulo: 'Pessoas' },
                          { para: '/dashboards/qualidade', rotulo: 'Qualidade' },
                          // SESSAO-39 (D-176): os maiores problemas, por motivo
                          { para: '/dashboards/motivos', rotulo: 'Motivos' },
                        ]
                      : []),
                  ],
                },
              ],
            },
          ]
        : []),
      grupoTech,
      ...(ehLider
        ? [
            {
              // SESSAO-27 (D-100): "Painel admin" virou CONFIGURAÇÕES (/configuracoes/*);
              // a Auditoria foi para o Painel super admin.
              id: 'configuracoes',
              rotulo: 'Configurações',
              icone: <Settings aria-hidden />,
              secoes: [
                {
                  filhos: [
                    { para: '/configuracoes/equipe', rotulo: 'Gestão da equipe' },
                    { para: '/configuracoes/setores-e-etapas', rotulo: 'Setores e etapas' },
                    // D-202 (28/10): os avisos que cada um recebe (o admin, de qualquer pessoa)
                    { para: '/configuracoes/avisos', rotulo: 'Avisos' },
                    // SESSAO-42: o líder também entra — só na aba Hora extra
                    { para: '/configuracoes/tempo', rotulo: 'Controle de tempo' },
                    ...(souAdmin
                      ? [
                          { para: '/configuracoes/estoque', rotulo: 'Estoque' },
                          { para: '/configuracoes/produtos', rotulo: 'Móveis, insumos e peças' },
                          { para: '/configuracoes/api', rotulo: 'API e integrações' },
                          { para: '/configuracoes/caminhoes', rotulo: 'Caminhões' },
                          { para: '/configuracoes/utilitarios', rotulo: 'Utilitários' },
                        ]
                      : []),
                  ],
                },
              ],
            },
          ]
        : []),
      ...(souSuperAdmin
        ? [
            {
              // SESSAO-27 (D-100): só o dono, por enquanto — o gate de verdade é do banco.
              id: 'super-admin',
              rotulo: 'Super admin',
              icone: <ShieldCheck aria-hidden />,
              secoes: [
                {
                  filhos: [
                    { para: '/super-admin/automacoes', rotulo: 'Automações' },
                    { para: '/super-admin/auditoria', rotulo: 'Auditoria' },
                  ],
                },
              ],
            },
          ]
        : []),
    ]
  }, [
    perfil,
    vinculos,
    setores,
    souAdmin,
    souSuperAdmin,
    soEntregador,
    ehDoPcp,
    ehDeTerminal,
    ehLider,
    veFabrica,
    veComercial,
    souProducao,
    souLogistica,
  ])

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
        <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
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

  // ↩️ Ajuste do dono (14/10 noite — menu do celular apertado): na gaveta do
  // celular, com os itens do grupo abertos, a coluna dos grupos vira TRILHO
  // de ícones — a coluna dos itens fica com o espaço (os nomes não quebram).
  // No computador nada muda (o trilho lá é só o "recolher" lembrado).
  const trilho = recolhida || (painelAberto && telaPequena)

  // BARRA 1 — os pais. Clicar seleciona/abre o painel de filhos; nunca navega.
  const barraPais = (
    <div
      className={cn(
        'menu-superficie flex h-full flex-col bg-grafite-700',
        // ↩️ 06/11: 208 px (era 240); o trilho, 64 px (era 72)
        trilho ? 'w-16' : 'w-52',
      )}
    >
      {/* ↩️ Ajuste do dono (06/11): no topo só a logo e o recolher — a lupa (que
          quase cobria a logo), o sino, o tema e o sair desceram para o rodapé. */}
      <div className={cn('flex items-center gap-1 px-3 pt-3 pb-1', trilho && 'flex-col px-2')}>
        {!trilho && (
          <NavLink
            to={ROTA_INICIAL}
            className="min-w-0 flex-1 rounded-dm px-1"
            aria-label="Domoby — início"
            onClick={() => setGavetaAberta(false)}
          >
            <Marca tamanho="sm" />
          </NavLink>
        )}
        <button
          type="button"
          onClick={alternarRecolhida}
          aria-label={recolhida ? 'Expandir o menu' : 'Recolher o menu'}
          title={recolhida ? 'Expandir o menu' : 'Recolher o menu'}
          className="toque-seguro hidden size-9 shrink-0 items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600 lg:inline-flex"
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
          className="ml-auto inline-flex h-toque-md w-toque-md shrink-0 items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600 lg:hidden"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      {!trilho && (
        <span className="px-3.5 pb-1.5 text-[0.6875rem] text-grafite-300">
          Plataforma de Produção
        </span>
      )}

      <nav
        aria-label="Navegação principal"
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2"
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
              title={trilho ? grupo.rotulo : undefined}
              className={cn(
                'inline-flex items-center gap-2.5 rounded-dm px-2.5 font-semibold transition-colors [&>svg]:size-[1.125rem] [&>svg]:shrink-0',
                ALTURA_ITEM,
                LETRA_MENU,
                ativo ? 'text-menu-destaque' : 'text-grafite-100',
                mostrando && 'bg-grafite-600',
                'hover:bg-grafite-600',
                trilho && 'justify-center px-0',
              )}
            >
              {grupo.icone}
              {!trilho && <span className="flex-1 text-left">{grupo.rotulo}</span>}
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
            onMouseEnter={() => preCarregar('/tablet')}
            onFocus={() => preCarregar('/tablet')}
            onTouchStart={() => preCarregar('/tablet')}
            title={trilho ? 'Modo tablet' : undefined}
            className={cn(
              'mx-2 mt-2 inline-flex items-center gap-2.5 rounded-dm border border-grafite-500 px-2.5 font-semibold text-grafite-100 transition-colors hover:bg-grafite-600 [&>svg]:size-[1.125rem] [&>svg]:shrink-0',
              ALTURA_ITEM,
              LETRA_MENU,
              trilho && 'justify-center px-0',
            )}
          >
            <TabletSmartphone aria-hidden />
            {!trilho && 'Modo tablet'}
          </NavLink>
        )}

        {/* ↩️ Ajuste do dono (06/11): ao lado do nome, o sino e o mini menu
            (buscar card, tema, sair); o sino abre o painel de baixo para cima. */}
        <div className={cn('flex items-center gap-0.5 p-2', trilho && 'flex-col gap-1')}>
          {/* O bloco do usuário abre o Meu Perfil (D-41). */}
          <NavLink
            to="/inicio/meu-perfil"
            onClick={() => setGavetaAberta(false)}
            aria-label="Meu perfil"
            title={trilho ? perfil.nome : undefined}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-1.5 rounded-dm px-1 py-1 transition-colors hover:bg-grafite-600',
              trilho && 'flex-none px-1',
            )}
          >
            {fotoUrl ? (
              <img
                src={fotoUrl}
                alt=""
                className="size-7 shrink-0 rounded-full border border-grafite-500 object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-grafite-600 text-xs font-semibold text-grafite-100"
              >
                {iniciais}
              </span>
            )}
            {!trilho && (
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[0.8125rem] font-medium text-grafite-100">
                  {perfil.nome}
                </span>
                <span className="truncate text-[0.6875rem] tracking-tight text-grafite-300 tabular-nums">
                  {perfil.matricula}
                </span>
              </span>
            )}
          </NavLink>

          {/* ↩️ 06/11 (4ª volta): o sino e a lupa moram só na barra de cima. */}
          <MenuDoUsuario recolhida={trilho} aoSair={() => void sair()} />
        </div>
      </div>
    </div>
  )

  // BARRA 2 — os filhos do grupo escolhido: um menu ao lado do menu. Na gaveta
  // do celular ela fica mais larga (ao lado do trilho), para os nomes caberem.
  const barraFilhos = painelAberto && grupoDoPainel && (
    // ↩️ 06/11: 196 px no computador (era 208 — a 196 os nomes cabem numa linha); na gaveta do celular, 224 (era 240)
    <div className="menu-superficie flex h-full w-56 flex-col border-l border-grafite-600 bg-grafite-800 lg:w-49">
      <div className="flex items-center gap-1 px-3 pt-3 pb-1">
        <span className="flex-1 truncate text-[0.8125rem] font-bold tracking-tight text-grafite-50">
          {grupoDoPainel.rotulo}
        </span>
        <button
          type="button"
          onClick={alternarPainel}
          aria-label="Recolher o painel de itens"
          title="Recolher o painel de itens"
          className="toque-seguro inline-flex size-9 shrink-0 items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600"
        >
          <ChevronsLeft aria-hidden className="size-5" />
        </button>
      </div>
      <nav
        aria-label={`Itens de ${grupoDoPainel.rotulo}`}
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2"
      >
        {grupoDoPainel.secoes.map((secao, indice) => {
          const recolhida = secao.titulo ? secoesRecolhidas.has(secao.titulo) : false
          return (
            <div key={secao.titulo ?? indice} className={cn(indice > 0 && 'mt-2')}>
              {secao.titulo && (
                // O "pai" de seção (Controle de produção, Logística, Rotas):
                // recolhe/expande os filhos, com a setinha de dropdown (D-36).
                // ↩️ Ajuste do dono (14/10 noite — "o nome da rota pai muito
                // apagado"): o pai é legível (claro e em negrito, sem caixa
                // alta miúda); os filhos ficam debaixo dele, numa linha-guia.
                <button
                  type="button"
                  onClick={() => alternarSecao(secao.titulo!)}
                  aria-expanded={!recolhida}
                  className={cn(
                    'mb-0.5 flex w-full items-center gap-1 rounded-dm px-2.5 font-semibold text-grafite-50 transition-colors hover:bg-grafite-600',
                    ALTURA_ITEM,
                    LETRA_MENU,
                  )}
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
                <div
                  className={cn(
                    'flex flex-col gap-0.5',
                    secao.titulo && 'ml-2.5 border-l border-grafite-600 pl-1.5',
                  )}
                >
                  {secao.filhos.map((filho) => (
                    <NavLink
                      key={filho.para}
                      to={filho.para}
                      onClick={() => setGavetaAberta(false)}
                      onMouseEnter={() => preCarregar(filho.para)}
                      onFocus={() => preCarregar(filho.para)}
                      onTouchStart={() => preCarregar(filho.para)}
                      className={({ isActive }) =>
                        cn(
                          'inline-flex items-center rounded-dm px-2.5 py-1 leading-snug transition-colors',
                          ALTURA_ITEM,
                          LETRA_MENU,
                          // o filho é um degrau abaixo do pai: peso normal,
                          // um tom mais suave; o ativo ganha a cor do menu
                          isActive
                            ? 'bg-menu-ativo font-semibold text-menu-ativo-texto'
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
    </div>
  )

  // ↩️ 06/11 (4ª volta — "a barra escura de cima fica… deixe isso como padrão em
  // toda a plataforma"): a barra escura do topo em TODA tela, celular e
  // computador, mais baixa (44 px): menu (só onde o menu é gaveta) · [setinha ·
  // nome da tela · ?] (a vaga do `CabecalhoDaTela`) · lupa · sino. A lupa e o
  // sino moram SÓ aqui (nada de dois). Sem título na vaga, o celular vê a logo.
  const barraDeCima = (
    <header
      className={cn('menu-superficie sticky top-0 z-30 bg-grafite-700', modoFoco && 'lg:hidden')}
    >
      <div className="flex min-h-11 items-center gap-1.5 px-2 py-1 sm:px-4">
        <button
          type="button"
          onClick={() => setGavetaAberta(true)}
          aria-label="Abrir o menu"
          aria-expanded={gavetaAberta}
          className="toque-seguro inline-flex size-9 shrink-0 items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600 lg:hidden"
        >
          <Menu aria-hidden className="size-5" />
        </button>
        <div ref={setVagaTitulo} className="peer flex min-w-0 flex-1 empty:hidden" />
        <NavLink
          to={ROTA_INICIAL}
          className="rounded-dm peer-[:not(:empty)]:hidden lg:hidden"
          aria-label="Domoby — início"
        >
          <Marca tamanho="sm" />
        </NavLink>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {veFabrica && <BotaoBuscaGeral aoAbrir={abrirBusca} compacto />}
          <SinoNotificacoes usuarioId={perfil.id} linkAvisos={ehLider} compacto />
        </div>
      </div>
    </header>
  )

  return (
    // O chat (SESSAO-26) acompanha toda tela logada — nunca o /tablet (acima).
    <ProvedorChat eu={perfil.id}>
      <div className="min-h-dvh bg-fundo lg:flex">
        {/* No editor das automações a barra de cima só aparece na gaveta (celular). */}
        {modoFoco && barraDeCima}

        {/* Fundo escuro atrás da gaveta aberta (só celular/tablet). Fundo e gaveta
          ficam na camada 55 (E-57, ajuste de 28/09): acima das bolhas flutuantes
          (balão do chat, bolinha de execução — 40) e dos painéis delas (50), que
          vêm depois no DOM; abaixo dos avisos passageiros (60). */}
        {gavetaAberta && (
          <button
            type="button"
            aria-label="Fechar o menu"
            onClick={() => setGavetaAberta(false)}
            className="fixed inset-0 z-[55] bg-grafite-950/60 lg:hidden"
          />
        )}

        {/* As duas barras, lado a lado: gaveta no celular, coluna fixa no computador.
          A gaveta CONTÉM as barras (ajuste de 28/09): quem desliza é o aside e
          quem rola, se as duas não couberem na tela, é o envoltório de dentro —
          nunca o aside, porque o `translate` dele faz dele o "chão" do painel
          fixo do sino, que seria cortado. Fechada, sai inteira da tela e fica
          invisível depois do deslize: nada dela pega toque nem Tab. */}
        <aside
          aria-label="Menu lateral"
          className={cn(
            'fixed inset-y-0 left-0 z-[55] flex max-w-[100vw] transition-[translate,visibility] duration-200',
            gavetaAberta ? 'visible translate-x-0' : 'invisible -translate-x-full',
            'lg:visible lg:sticky lg:top-0 lg:z-50 lg:h-dvh lg:shrink-0 lg:translate-x-0',
          )}
        >
          <div className="flex h-full overflow-x-auto lg:overflow-visible">
            {barraPais}
            {barraFilhos}
          </div>
        </aside>

        {modoFoco ? (
          // A área de trabalho das automações: a altura toda da tela (menos a
          // barra do celular); o voltar mora na barra do próprio editor.
          <main className="flex h-[calc(100dvh-2.75rem)] min-w-0 flex-1 flex-col overflow-hidden lg:h-dvh">
            <VagaDoTitulo.Provider value={vagaTitulo}>{children}</VagaDoTitulo.Provider>
          </main>
        ) : (
          <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
            {barraDeCima}
            {/* Toda tela tem botão de voltar (D-36) — ↩️ ajuste de 06/11: ele mora
                no cabeçalho de cada tela (`CabecalhoDaTela`), como a setinha à
                esquerda do título; a linha só dele saiu daqui. */}
            <main className="w-full flex-1 px-4 py-3 sm:px-6 sm:pb-8">
              <VagaDoTitulo.Provider value={vagaTitulo}>{children}</VagaDoTitulo.Provider>
            </main>
            <footer className="border-t border-borda px-4 py-4 text-center text-sm text-texto-fraco sm:px-6">
              Móveis Domoby · Plataforma de Produção
            </footer>
          </div>
        )}

        {/* A bolinha do "em execução agora" percorre a plataforma inteira
          (pedido do dono, 23/09) — só aparece quando algo conta tempo. */}
        {!modoFoco && !soEntregador && <BolhaExecucao />}
        {/* O balão do chat (SESSAO-26): arrastável, ao lado da bolinha. */}
        {!modoFoco && !soEntregador && <BalaoChat />}
        {/* SESSAO-46 (D-265): a bolinha das sugestões — TODO usuário, toda tela (o /tablet
          nem chega aqui); arrastável, à esquerda do balão do chat. */}
        <BolhaSugestao />
        {/* SESSAO-31 (§3): a janela do card — qualquer tela abre pondo ?card= no endereço. */}
        {!soEntregador && <JanelaDoCardNaUrl />}
        {/* SESSAO-46: a ficha da sugestão — o aviso, a pendência e o quadro abrem com ?sugestao=. */}
        <JanelaSugestaoNaUrl />
        {/* SESSAO-41 (D-191): o pedido de troca de senha, urgente, na tela do administrador. */}
        {perfil.papel === 'admin' && <AlertaTrocaSenha usuarioId={perfil.id} />}
        {/* SESSAO-41 · ajuste (D-198): "ainda tem alguém neste card?" — para quem está no card e os admins. */}
        <AlertaCardEsquecido usuarioId={perfil.id} />
        {/* A janela da busca geral (Ctrl+K, a lupa do celular e o mini menu). */}
        {veFabrica && (
          <BuscaGeralNaCasca
            aberta={buscaAberta}
            aoAbrir={abrirBusca}
            aoFechar={() => setBuscaAberta(false)}
          />
        )}
        <AvisoVersaoNova nova={versaoNova} />
        {/* SESSAO-32 (Lei §10): a conexão ao vivo caiu — avisa e oferece atualizar. */}
        {!versaoNova && <AvisoAoVivoPausado />}
      </div>
    </ProvedorChat>
  )
}
