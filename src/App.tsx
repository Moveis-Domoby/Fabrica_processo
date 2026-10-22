import { Suspense, lazy } from 'react'
import type { ComponentType } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { Layout } from '@/componentes/Layout'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ProvedorSessao } from '@/autenticacao/ProvedorSessao'
import { RotaModulo, RotaProtegida } from '@/autenticacao/guardas'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { ehSoEntregador } from '@/autenticacao/tipos'
import { Entrar } from '@/paginas/Entrar'

/**
 * SESSAO-32 (Lei §9 — o pacote dividido por tela): cada tela é um pedaço
 * próprio, baixado quando a pessoa a abre (e guardado pelo navegador: o nome do
 * arquivo muda a cada versão). No pacote inicial fica só a casca — menu, sino,
 * chat, a bolinha — e o login. Antes: 1,47 MB (≈ 396 KB comprimidos) de uma vez.
 */
function pagina<M extends Record<string, unknown>>(carregar: () => Promise<M>, nome: keyof M) {
  return lazy(() => carregar().then((m) => ({ default: m[nome] as ComponentType })))
}
const MeuPainel = pagina(() => import('@/paginas/MeuPainel'), 'MeuPainel')
const Convite = pagina(() => import('@/paginas/Convite'), 'Convite')
const TrocarSenha = pagina(() => import('@/paginas/TrocarSenha'), 'TrocarSenha')
const Equipe = pagina(() => import('@/paginas/Equipe'), 'Equipe')
const TelaSetor = pagina(() => import('@/paginas/TelaSetor'), 'TelaSetor')
const ControleTempo = pagina(() => import('@/paginas/ControleTempo'), 'ControleTempo')
const VisaoDoDia = pagina(() => import('@/paginas/dashboards/VisaoDoDia'), 'VisaoDoDia')
const MeuDesempenho = pagina(() => import('@/paginas/dashboards/MeuDesempenho'), 'MeuDesempenho')
const TemposPessoas = pagina(() => import('@/paginas/dashboards/TemposPessoas'), 'TemposPessoas')
const Avisos = pagina(() => import('@/paginas/Avisos'), 'Avisos')
const TempoPorSetor = pagina(() => import('@/paginas/dashboards/TempoPorSetor'), 'TempoPorSetor')
const Pessoas = pagina(() => import('@/paginas/dashboards/Pessoas'), 'Pessoas')
const Qualidade = pagina(() => import('@/paginas/dashboards/Qualidade'), 'Qualidade')
// SESSAO-39 (D-176): o painel de motivos
const Motivos = pagina(() => import('@/paginas/dashboards/Motivos'), 'Motivos')
const Expedicao = pagina(() => import('@/paginas/Expedicao'), 'Expedicao')
const Rotas = pagina(() => import('@/paginas/Rotas'), 'Rotas')
const Afazeres = pagina(() => import('@/paginas/Afazeres'), 'Afazeres')
const AfazeresDoTime = pagina(() => import('@/paginas/AfazeresDoTime'), 'AfazeresDoTime')
const AdminApi = pagina(() => import('@/paginas/AdminApi'), 'AdminApi')
const AdminEstoque = pagina(() => import('@/paginas/AdminEstoque'), 'AdminEstoque')
const ClassificacaoProdutos = pagina(
  () => import('@/paginas/ClassificacaoProdutos'),
  'ClassificacaoProdutos',
)
const Auditoria = pagina(() => import('@/paginas/Auditoria'), 'Auditoria')
const Automacoes = pagina(() => import('@/paginas/Automacoes'), 'Automacoes')
const Utilitarios = pagina(() => import('@/paginas/Utilitarios'), 'Utilitarios')
const Estrutura = pagina(() => import('@/paginas/Estrutura'), 'Estrutura')
const MeuPerfil = pagina(() => import('@/paginas/MeuPerfil'), 'MeuPerfil')
const Chat = pagina(() => import('@/paginas/Chat'), 'Chat')
const Estoque = pagina(() => import('@/paginas/Estoque'), 'Estoque')
const Danificados = pagina(() => import('@/paginas/Danificados'), 'Danificados')
const Caminhoes = pagina(() => import('@/paginas/Caminhoes'), 'Caminhoes')
const ProducaoSetor = pagina(() => import('@/navegacao/ProducaoSetor'), 'ProducaoSetor')
const RedirecionarSetorAntigo = pagina(
  () => import('@/navegacao/ProducaoSetor'),
  'RedirecionarSetorAntigo',
)
const PainelRecompra = pagina(() => import('@/comercial/paginas/PainelRecompra'), 'PainelRecompra')
const DashboardComercial = pagina(
  () => import('@/comercial/paginas/DashboardComercial'),
  'DashboardComercial',
)
const ListasDisparoIndice = pagina(
  () => import('@/comercial/paginas/ListasDisparoIndice'),
  'ListasDisparoIndice',
)
const ListaDetalhe = pagina(() => import('@/comercial/paginas/ListaDetalhe'), 'ListaDetalhe')

// O mapa (Leaflet, ~150 kB) só vem quando a Programação abre — o resto do
// sistema não paga por ele (SESSAO-28; pendência anotada na SESSAO-15).
const Programacao = lazy(() =>
  import('@/paginas/Programacao').then((m) => ({ default: m.Programacao })),
)
// SESSAO-30 (D-115): a tela do entregador — pedaço próprio do pacote (Lei §9).
const EntregasDoDia = lazy(() =>
  import('@/paginas/EntregasDoDia').then((m) => ({ default: m.EntregasDoDia })),
)
// ↩️ 14/10 (D-134): a área Pedidos — pedaço próprio do pacote (Lei §9).
const TodosOsPedidos = lazy(() =>
  import('@/pedidos/PaginaPedidos').then((m) => ({ default: m.TodosOsPedidos })),
)
const PedidosCancelados = lazy(() =>
  import('@/pedidos/PaginaPedidos').then((m) => ({ default: m.PedidosCancelados })),
)
const carregandoPedidos = <p className="text-sm text-texto-fraco">Carregando os pedidos…</p>

/**
 * ↪️ D-121 (09/10, pedido do dono): para a logística, "Entregas do dia" virou
 * aba de ROTAS → Entregas — o endereço antigo leva para lá. A rota própria
 * ficou só para o ENTREGADOR, que não tem o módulo da fábrica (D-115).
 */
function EntregasDoEntregador() {
  const { perfil } = useSessao()
  if (!ehSoEntregador(perfil)) return <Navigate to="/fabrica/rotas/entregas?aba=do-dia" replace />
  return (
    <Suspense fallback={<p className="text-sm text-texto-fraco">Carregando as entregas…</p>}>
      <EntregasDoDia />
    </Suspense>
  )
}

/** /producao/{codigo} antigo → /fabrica/producao/{codigo} (bookmark não quebra). */
function RedirecionarProducaoAntiga() {
  const { codigo } = useParams()
  return <Navigate to={`/fabrica/producao/${codigo}`} replace />
}

/** Prefixo antigo → novo preservando o resto do caminho (ex.: /logistica/*). */
function RedirecionarComPrefixo({ de, para }: { de: string; para: string }) {
  const { pathname } = useLocation()
  return <Navigate to={pathname.replace(de, para)} replace />
}

/**
 * Lei de navegação (SESSAO-13): toda rota é /pai/filho — pai nunca é rota
 * navegável, só direciona ao primeiro filho. Fora da lei ficam apenas as
 * rotas de casca, sem navegação por natureza: /entrar, /convite, /trocar-senha
 * e /tablet (o modo do galpão). Toda rota antiga redireciona para a nova —
 * nenhum bookmark de tablet pode quebrar.
 *
 * ↪️ SESSAO-20 (D-46): "Fábrica" virou pai de Controle de Produção, Logística
 * e ROTAS (/fabrica/producao|logistica|rotas/...), e nasceu o pai "Comercial"
 * (/comercial/...). Acesso por módulo (plt_usuarios.modulos): sem o módulo,
 * o grupo some do menu e a URL direta redireciona (RotaModulo). /tablet
 * continua intocada.
 */
export function App() {
  return (
    <ProvedorSessao>
      <ProvedorNotificacao>
        <Layout>
          <Suspense fallback={<p className="text-sm text-texto-fraco">Carregando…</p>}>
            <Routes>
              {/* públicas: login e convite — sem autocadastro (D-21) */}
              <Route path="/entrar" element={<Entrar />} />
              <Route path="/convite/:token" element={<Convite />} />

              {/* qualquer papel logado e aprovado */}
              <Route element={<RotaProtegida />}>
                <Route path="/trocar-senha" element={<TrocarSenha />} />

                {/* Início — a casa: pendências, avisos e o cockpit de metas */}
                <Route path="/inicio/meu-painel" element={<MeuPainel />} />
                {/* "Afazeres" virou "Meus afazeres" (23/09); a visão da liderança
                  ganhou a filha própria — a página se guarda por papel */}
                <Route path="/inicio/afazeres" element={<Afazeres />} />
                <Route path="/inicio/afazeres-do-time" element={<AfazeresDoTime />} />
                {/* filho sem item de menu: abre pelo bloco do usuário no rodapé */}
                <Route path="/inicio/meu-perfil" element={<MeuPerfil />} />
                {/* filho sem item de menu: o "Ver todos" do sino (SESSAO-23) */}
                <Route path="/inicio/avisos" element={<Avisos />} />
                {/* o chat interno (SESSAO-26): a tela cheia; o balão vive na casca */}
                <Route path="/inicio/chat" element={<Chat />} />

                {/* SESSAO-30 (D-115): a casa do entregador (módulo "entregas");
                  a logística vê a mesma tela como aba de ROTAS → Entregas (D-121) */}
                <Route path="/entregas/do-dia" element={<EntregasDoEntregador />} />

                {/* o modo do galpão: sem navegação nenhuma (D-06/D-28) */}
                <Route path="/tablet" element={<TelaSetor />} />

                {/* Fábrica (D-46) — Controle de Produção, Logística e ROTAS */}
                <Route element={<RotaModulo modulo="fabrica" />}>
                  <Route path="/fabrica/producao/:codigo" element={<ProducaoSetor />} />
                  <Route path="/fabrica/logistica/expedicao" element={<Expedicao />} />
                  <Route path="/fabrica/logistica/estoque" element={<Estoque />} />
                  {/* ↩️ SESSAO-38 (D-157): "Pedidos em aguardo" virou a Expedição — o link antigo segue. */}
                  <Route
                    path="/fabrica/logistica/pedidos-em-aguardo"
                    element={<Navigate to="/fabrica/logistica/expedicao" replace />}
                  />
                  <Route path="/fabrica/logistica/danificados" element={<Danificados />} />
                  {/* ↩️ 14/10 (D-134): Cancelados mora na área Pedidos — o link antigo segue. */}
                  <Route
                    path="/fabrica/logistica/cancelados"
                    element={<Navigate to="/fabrica/pedidos/cancelados" replace />}
                  />
                  {/* ↩️ 14/10 (D-134): a área Pedidos — Todos os pedidos e Cancelados. */}
                  <Route
                    path="/fabrica/pedidos/todos"
                    element={
                      <Suspense fallback={carregandoPedidos}>
                        <TodosOsPedidos />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/fabrica/pedidos/cancelados"
                    element={
                      <Suspense fallback={carregandoPedidos}>
                        <PedidosCancelados />
                      </Suspense>
                    }
                  />
                  <Route path="/fabrica/rotas/entregas" element={<Rotas />} />
                  <Route
                    path="/fabrica/rotas/programacao"
                    element={
                      <Suspense
                        fallback={<p className="text-sm text-texto-fraco">Carregando o mapa…</p>}
                      >
                        <Programacao />
                      </Suspense>
                    }
                  />
                </Route>

                {/* Dashboards → Meu desempenho (SESSAO-23): o painel PRIVADO de
                  cada um — qualquer papel logado; o banco só devolve o próprio */}
                <Route element={<RotaModulo modulo="fabrica" />}>
                  <Route path="/dashboards/meu-desempenho" element={<MeuDesempenho />} />
                  {/* SESSAO-36 (D-146 resp. 12): todos veem a tela; o banco devolve
                    todo mundo ao líder/admin e só o próprio ao funcionário */}
                  <Route path="/dashboards/tempos-por-pessoa" element={<TemposPessoas />} />
                </Route>

                {/* Comercial (D-46) — o Painel de Recompra dentro da plataforma */}
                <Route element={<RotaModulo modulo="comercial" />}>
                  <Route path="/comercial/recompra" element={<PainelRecompra />} />
                  <Route path="/comercial/dashboard" element={<DashboardComercial />} />
                  <Route path="/comercial/listas" element={<ListasDisparoIndice />} />
                  <Route path="/comercial/listas/:id" element={<ListaDetalhe />} />
                </Route>
              </Route>

              {/* líder (de algum setor) ou admin */}
              <Route element={<RotaProtegida nivel="lider" />}>
                {/* Dashboards (SESSAO-16/D-42): 4 telas-filhas; o pai continua
                  em /dashboards (Q-66) e o gate de dados vive no banco (D-32) */}
                <Route element={<RotaModulo modulo="fabrica" />}>
                  <Route path="/dashboards/visao-do-dia" element={<VisaoDoDia />} />
                  <Route path="/dashboards/tempo-por-setor" element={<TempoPorSetor />} />
                  <Route path="/dashboards/pessoas" element={<Pessoas />} />
                  <Route path="/dashboards/qualidade" element={<Qualidade />} />
                  <Route path="/dashboards/motivos" element={<Motivos />} />
                </Route>
                {/* SESSAO-27 (D-100): o antigo "Painel admin" virou CONFIGURAÇÕES */}
                <Route path="/configuracoes/equipe" element={<Equipe />} />
                <Route path="/configuracoes/setores-e-etapas" element={<Estrutura />} />
              </Route>

              {/* só admin */}
              <Route element={<RotaProtegida nivel="admin" />}>
                <Route path="/configuracoes/tempo" element={<ControleTempo />} />
                <Route path="/configuracoes/estoque" element={<AdminEstoque />} />
                {/* SESSAO-32 (D-138): móvel, insumo e peça — o tipo de cada produto */}
                <Route path="/configuracoes/produtos" element={<ClassificacaoProdutos />} />
                <Route path="/configuracoes/api" element={<AdminApi />} />
                <Route path="/configuracoes/caminhoes" element={<Caminhoes />} />
                {/* SESSAO-27 (D-101): etiquetas e campos customizados */}
                <Route path="/configuracoes/utilitarios" element={<Utilitarios />} />
              </Route>

              {/* SESSAO-27 (D-100): o Painel SUPER ADMIN — só o dono, por enquanto */}
              <Route element={<RotaProtegida nivel="super" />}>
                <Route path="/super-admin/automacoes" element={<Automacoes />} />
                {/* SESSAO-29 (D-95) → SESSAO-27: a auditoria passou ao super admin */}
                <Route path="/super-admin/auditoria" element={<Auditoria />} />
              </Route>

              {/* pais nunca navegam: cada um direciona ao primeiro filho */}
              <Route path="/inicio" element={<Navigate to="/inicio/meu-painel" replace />} />
              <Route path="/fabrica" element={<Navigate to="/fabrica/producao/pcp" replace />} />
              <Route
                path="/fabrica/producao"
                element={<Navigate to="/fabrica/producao/pcp" replace />}
              />
              <Route
                path="/fabrica/logistica"
                element={<Navigate to="/fabrica/logistica/expedicao" replace />}
              />
              <Route
                path="/fabrica/pedidos"
                element={<Navigate to="/fabrica/pedidos/todos" replace />}
              />
              <Route
                path="/fabrica/rotas"
                element={<Navigate to="/fabrica/rotas/entregas" replace />}
              />
              <Route path="/comercial" element={<Navigate to="/comercial/recompra" replace />} />
              {/* o 1º filho que TODO papel pode abrir (SESSAO-23) */}
              <Route
                path="/dashboards"
                element={<Navigate to="/dashboards/meu-desempenho" replace />}
              />
              {/* a tela única da S10 virou as 4 filhas — bookmark antigo não quebra */}
              <Route
                path="/dashboards/geral"
                element={<Navigate to="/dashboards/visao-do-dia" replace />}
              />
              <Route
                path="/configuracoes"
                element={<Navigate to="/configuracoes/equipe" replace />}
              />
              <Route
                path="/super-admin"
                element={<Navigate to="/super-admin/automacoes" replace />}
              />
              <Route path="/entregas" element={<Navigate to="/entregas/do-dia" replace />} />
              {/* o antigo "Painel admin" (/admin/*) → Configurações; a auditoria → Super admin */}
              <Route path="/admin" element={<Navigate to="/configuracoes/equipe" replace />} />
              <Route
                path="/admin/auditoria"
                element={<Navigate to="/super-admin/auditoria" replace />}
              />
              <Route
                path="/admin/*"
                element={<RedirecionarComPrefixo de="/admin" para="/configuracoes" />}
              />

              {/* rotas antigas → novas (bookmarks dos tablets não quebram) */}
              <Route path="/producao" element={<Navigate to="/fabrica/producao/pcp" replace />} />
              <Route path="/producao/:codigo" element={<RedirecionarProducaoAntiga />} />
              <Route
                path="/logistica/*"
                element={<RedirecionarComPrefixo de="/logistica" para="/fabrica/logistica" />}
              />
              <Route
                path="/rotas/*"
                element={<RedirecionarComPrefixo de="/rotas" para="/fabrica/rotas" />}
              />
              <Route path="/afazeres" element={<Navigate to="/inicio/afazeres" replace />} />
              <Route path="/pcp" element={<Navigate to="/fabrica/producao/pcp" replace />} />
              <Route element={<RotaProtegida />}>
                <Route path="/setores/:id" element={<RedirecionarSetorAntigo />} />
              </Route>
              <Route
                path="/expedicao"
                element={<Navigate to="/fabrica/logistica/expedicao" replace />}
              />
              <Route path="/equipe" element={<Navigate to="/configuracoes/equipe" replace />} />
              <Route
                path="/estrutura"
                element={<Navigate to="/configuracoes/setores-e-etapas" replace />}
              />
              <Route
                path="/administracao"
                element={<Navigate to="/configuracoes/equipe" replace />}
              />
              <Route
                path="/administracao/tempo"
                element={<Navigate to="/configuracoes/tempo" replace />}
              />
              <Route
                path="/administracao/api"
                element={<Navigate to="/configuracoes/api" replace />}
              />

              {/* nenhuma rota solta na raiz: tudo desemboca no Meu painel */}
              <Route path="/" element={<Navigate to="/inicio/meu-painel" replace />} />
              <Route path="*" element={<Navigate to="/inicio/meu-painel" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </ProvedorNotificacao>
    </ProvedorSessao>
  )
}
