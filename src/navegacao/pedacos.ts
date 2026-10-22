/**
 * O pré-carregamento na INTENÇÃO (SESSAO-32 · Lei §9): com o pacote dividido
 * por tela, passar o mouse, focar pelo teclado ou encostar o dedo num item do
 * menu já baixa o pedaço daquela tela — o clique encontra a tela pronta. O
 * mesmo `import()` das rotas (App.tsx): o navegador baixa uma vez só.
 *
 * Rota que não está aqui só não é pré-carregada (abre normalmente no clique).
 */
const PEDACOS: [prefixo: string, carregar: () => Promise<unknown>][] = [
  ['/inicio/meu-painel', () => import('@/paginas/MeuPainel')],
  ['/inicio/afazeres-do-time', () => import('@/paginas/AfazeresDoTime')],
  ['/inicio/afazeres', () => import('@/paginas/Afazeres')],
  ['/inicio/chat', () => import('@/paginas/Chat')],
  ['/inicio/meu-perfil', () => import('@/paginas/MeuPerfil')],
  ['/tablet', () => import('@/paginas/TelaSetor')],
  ['/fabrica/producao/', () => import('@/navegacao/ProducaoSetor')],
  ['/fabrica/pedidos/', () => import('@/pedidos/PaginaPedidos')],
  ['/fabrica/logistica/expedicao', () => import('@/paginas/Expedicao')],
  ['/fabrica/logistica/estoque', () => import('@/paginas/Estoque')],
  ['/fabrica/logistica/danificados', () => import('@/paginas/Danificados')],
  ['/fabrica/rotas/entregas', () => import('@/paginas/Rotas')],
  ['/fabrica/rotas/programacao', () => import('@/paginas/Programacao')],
  ['/comercial/recompra', () => import('@/comercial/paginas/PainelRecompra')],
  ['/comercial/dashboard', () => import('@/comercial/paginas/DashboardComercial')],
  ['/comercial/listas', () => import('@/comercial/paginas/ListasDisparoIndice')],
  ['/dashboards/meu-desempenho', () => import('@/paginas/dashboards/MeuDesempenho')],
  ['/dashboards/tempos-por-pessoa', () => import('@/paginas/dashboards/TemposPessoas')],
  ['/dashboards/visao-do-dia', () => import('@/paginas/dashboards/VisaoDoDia')],
  ['/dashboards/tempo-por-setor', () => import('@/paginas/dashboards/TempoPorSetor')],
  ['/dashboards/pessoas', () => import('@/paginas/dashboards/Pessoas')],
  ['/dashboards/qualidade', () => import('@/paginas/dashboards/Qualidade')],
  ['/dashboards/motivos', () => import('@/paginas/dashboards/Motivos')],
  ['/configuracoes/equipe', () => import('@/paginas/Equipe')],
  ['/configuracoes/setores-e-etapas', () => import('@/paginas/Estrutura')],
  ['/configuracoes/tempo', () => import('@/paginas/ControleTempo')],
  ['/configuracoes/estoque', () => import('@/paginas/AdminEstoque')],
  ['/configuracoes/produtos', () => import('@/paginas/ClassificacaoProdutos')],
  ['/configuracoes/api', () => import('@/paginas/AdminApi')],
  ['/configuracoes/caminhoes', () => import('@/paginas/Caminhoes')],
  ['/configuracoes/utilitarios', () => import('@/paginas/Utilitarios')],
  ['/super-admin/automacoes', () => import('@/paginas/Automacoes')],
  ['/super-admin/auditoria', () => import('@/paginas/Auditoria')],
]

const pedidos = new Set<string>()

/** Baixa (uma vez) o pedaço da tela desta rota. Falhou? O clique tenta de novo. */
export function preCarregar(rota: string) {
  const achado = PEDACOS.find(([prefixo]) => rota.startsWith(prefixo))
  if (!achado || pedidos.has(achado[0])) return
  pedidos.add(achado[0])
  achado[1]().catch(() => pedidos.delete(achado[0]))
}
