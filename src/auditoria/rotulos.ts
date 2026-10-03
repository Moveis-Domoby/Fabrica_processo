/**
 * A língua da AUDITORIA (SESSAO-29 · D-95): a trilha guarda códigos de ação
 * (`movimentacao_setor`, `entrou`…) e ids; aqui eles viram frases de gente —
 * o QUÊ, o ONDE e os detalhes. Códigos internos nunca aparecem na tela (D-27).
 */

/** O que cada ação quer dizer. Código desconhecido vira frase pelo humanizador. */
export const ROTULO_ACAO: Record<string, string> = {
  // entrar e sair
  entrou: 'Entrou na plataforma',
  saiu: 'Saiu da plataforma',
  senha_alterada: 'Trocou a senha',
  // telas
  navegacao: 'Abriu a tela',
  // cards e movimentações
  card_criado: 'Card criado',
  movimentacao_setor: 'Moveu o card de setor',
  movimentacao_etapa: 'Moveu o card de etapa',
  card_arquivado: 'Arquivou o card',
  delegacao: 'Delegou o card',
  estorno: 'Desfez um gesto (estorno)',
  pedido_lancado_rotas: 'Lançou o pedido para as ROTAS',
  pedido_entregue: 'Registrou a entrega do pedido',
  unidade_desvinculada: 'A peça ficou sem pedido',
  peca_alocada: 'Usou uma peça do estoque no pedido',
  id_producao_definido: 'Definiu o ID de produção',
  // execução
  execucao_iniciada: 'Iniciou a execução',
  execucao_finalizada: 'Finalizou a execução',
  execucao_pausada: 'Pausou a execução',
  execucao_retomada: 'Retomou a execução',
  limite_execucoes_alterado: 'Mudou o limite de execuções do setor',
  // qualidade
  qualidade_marcada: 'Marcou o estado da peça',
  qualidade_parecer: 'Deu o parecer de qualidade',
  divergencia_registrada: 'Registrou divergência de qualidade',
  // pedidos vindos do Tiny
  pedido_atualizado: 'Pedido alterado no Tiny',
  pedido_cancelado: 'Pedido cancelado no Tiny',
  // estoque
  peca_reservada: 'Peça do estoque reservada para uma venda',
  peca_reserva_desfeita: 'Reserva de peça desfeita',
  estoque_reserva_avaliada: 'Reserva da venda conferida',
  estoque_foto_definida: 'Trocou a foto do produto',
  estoque_foto_tiny: 'Foto do produto copiada do Tiny',
  estoque_foto_tiny_falhou: 'Não deu para copiar a foto do Tiny',
  estoque_minimo_alterado: 'Mudou o mínimo do produto',
  estoque_minimo_automatico: 'Voltou o mínimo para o automático',
  estoque_capacidade_alterada: 'Mudou a capacidade do galpão',
  estoque_sugestoes_aplicadas: 'Aplicou as sugestões de mínimo',
  estoque_top_x_alterado: 'Mudou o Top X',
  estoque_cobertura_alterada: 'Mudou a cobertura do mínimo',
  estoque_corte_alterado: 'Mudou o corte de pedido grande',
  estoque_contagem_conferida: 'Conferiu a contagem do estoque',
  estoque_reposicao_ligada: 'Ligou a reposição automática',
  estoque_reposicao_desligada: 'Desligou a reposição automática',
  estoque_reposicao_lancada: 'Lançou reposição para a produção',
  estoque_tiny_ligado: 'Ligou o sincronismo do estoque com o Tiny',
  estoque_tiny_desligado: 'Desligou o sincronismo do estoque com o Tiny',
  estoque_tiny_ajustado: 'Estoque ajustado no Tiny',
  estoque_tiny_falha: 'Não deu para ajustar o estoque no Tiny',
  // ROTAS e caminhões
  entrega_programada: 'Programou a entrega',
  entrega_reprogramada: 'Reprogramou a entrega',
  programacao_removida: 'Tirou a entrega da programação',
  caminhao_criado: 'Cadastrou um caminhão',
  caminhao_alterado: 'Alterou um caminhão',
  caminhao_arquivado: 'Arquivou um caminhão',
  caminhao_reativado: 'Reativou um caminhão',
  caminhao_excluido: 'Excluiu um caminhão',
  // tarefas e metas
  tarefa_criada: 'Criou uma tarefa',
  tarefa_atualizada: 'Alterou uma tarefa',
  tarefa_iniciada: 'Iniciou uma tarefa',
  tarefa_concluida: 'Concluiu uma tarefa',
  tarefa_reatribuida: 'Passou uma tarefa para outra pessoa',
  fila_prioridade_reordenada: 'Reordenou a fila de prioridade',
  meta_criada: 'Criou uma meta',
  meta_alterada: 'Alterou uma meta',
  meta_encerrada: 'Encerrou uma meta',
  // equipe e cadastro
  perfil_atualizado: 'Atualizou um cadastro',
  tema_alterado: 'Trocou o tema da plataforma',
  data_nascimento_alterada: 'Alterou a data de nascimento',
  usuario_arquivado: 'Arquivou uma pessoa',
  usuario_reativado: 'Reativou uma pessoa',
  usuario_excluido: 'Excluiu um cadastro',
  // chat (nunca o conteúdo das mensagens)
  chat_canal_criado: 'Criou um canal no chat',
  chat_canal_renomeado: 'Renomeou um canal do chat',
  chat_membro_adicionado: 'Pôs uma pessoa num canal do chat',
  chat_membro_removido: 'Tirou uma pessoa de um canal do chat',
  chat_escritor_definido: 'Mudou quem escreve nos avisos gerais',
  chat_aviso_publicado: 'Publicou nos avisos gerais',
  // avisos do sino
  notificacao_enviada: 'Aviso enviado no sino',
  // automações, etiquetas e campos customizados (SESSAO-27)
  automacao_executada: 'Uma automação rodou',
  automacao_criada: 'Criou uma automação',
  automacao_editada: 'Alterou uma automação',
  automacao_ligada: 'Ligou uma automação',
  automacao_desligada: 'Desligou uma automação',
  automacao_arquivada: 'Arquivou uma automação',
  automacao_reativada: 'Reativou uma automação',
  automacao_excluida: 'Excluiu uma automação',
  etiqueta_adicionada: 'Pôs uma etiqueta no card',
  etiqueta_removida: 'Tirou uma etiqueta do card',
  card_desarquivado: 'Trouxe o card de volta',
  etiqueta_criada: 'Cadastrou uma etiqueta',
  etiqueta_editada: 'Alterou uma etiqueta',
  etiqueta_arquivada: 'Arquivou uma etiqueta',
  etiqueta_reativada: 'Reativou uma etiqueta',
  etiqueta_excluida: 'Excluiu uma etiqueta',
  campo_criado: 'Cadastrou um campo customizado',
  campo_editado: 'Alterou um campo customizado',
  campo_arquivado: 'Arquivou um campo customizado',
  campo_reativado: 'Reativou um campo customizado',
  campo_excluido: 'Excluiu um campo customizado',
  campo_preenchido: 'Preencheu um campo customizado',
  campo_limpo: 'Limpou um campo customizado',
}

/** Código sem rótulo vira frase: "algo_novo" → "Algo novo". */
export function humanizar(codigo: string): string {
  const texto = codigo.replace(/_/g, ' ').trim()
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : 'Atividade'
}

export function rotuloDaAcao(acao: string): string {
  return ROTULO_ACAO[acao] ?? humanizar(acao)
}

export type GrupoAcao =
  | 'entradas'
  | 'telas'
  | 'movimentacoes'
  | 'execucoes'
  | 'qualidade'
  | 'pedidos'
  | 'estoque'
  | 'rotas'
  | 'tarefas'
  | 'equipe'
  | 'chat'
  | 'avisos'
  | 'automacoes'

/** Os tipos do filtro — cada um manda ao servidor a lista das ações dele. */
export const GRUPOS_ACAO: { valor: GrupoAcao; rotulo: string; acoes: string[] }[] = [
  { valor: 'entradas', rotulo: 'Entradas e saídas', acoes: ['entrou', 'saiu', 'senha_alterada'] },
  { valor: 'telas', rotulo: 'Telas abertas', acoes: ['navegacao'] },
  {
    valor: 'movimentacoes',
    rotulo: 'Movimentações de cards',
    acoes: [
      'card_criado',
      'movimentacao_setor',
      'movimentacao_etapa',
      'card_arquivado',
      'delegacao',
      'estorno',
      'pedido_lancado_rotas',
      'pedido_entregue',
      'unidade_desvinculada',
      'peca_alocada',
      'id_producao_definido',
      'card_desarquivado',
    ],
  },
  {
    valor: 'execucoes',
    rotulo: 'Execuções',
    acoes: [
      'execucao_iniciada',
      'execucao_finalizada',
      'execucao_pausada',
      'execucao_retomada',
      'limite_execucoes_alterado',
    ],
  },
  {
    valor: 'qualidade',
    rotulo: 'Qualidade',
    acoes: ['qualidade_marcada', 'qualidade_parecer', 'divergencia_registrada'],
  },
  { valor: 'pedidos', rotulo: 'Pedidos vindos do Tiny', acoes: ['pedido_atualizado', 'pedido_cancelado'] },
  {
    valor: 'estoque',
    rotulo: 'Estoque',
    acoes: Object.keys(ROTULO_ACAO).filter(
      (a) => a.startsWith('estoque_') || a === 'peca_reservada' || a === 'peca_reserva_desfeita',
    ),
  },
  {
    valor: 'rotas',
    rotulo: 'ROTAS e caminhões',
    acoes: Object.keys(ROTULO_ACAO).filter(
      (a) => a.startsWith('caminhao_') || ['entrega_programada', 'entrega_reprogramada', 'programacao_removida'].includes(a),
    ),
  },
  {
    valor: 'tarefas',
    rotulo: 'Tarefas e metas',
    acoes: Object.keys(ROTULO_ACAO).filter(
      (a) => a.startsWith('tarefa_') || a.startsWith('meta_') || a === 'fila_prioridade_reordenada',
    ),
  },
  {
    valor: 'equipe',
    rotulo: 'Equipe e cadastros',
    acoes: [
      'perfil_atualizado',
      'tema_alterado',
      'data_nascimento_alterada',
      'usuario_arquivado',
      'usuario_reativado',
      'usuario_excluido',
    ],
  },
  { valor: 'chat', rotulo: 'Chat (sem as mensagens)', acoes: Object.keys(ROTULO_ACAO).filter((a) => a.startsWith('chat_')) },
  { valor: 'avisos', rotulo: 'Avisos do sino', acoes: ['notificacao_enviada'] },
  {
    valor: 'automacoes',
    rotulo: 'Automações, etiquetas e campos',
    acoes: Object.keys(ROTULO_ACAO).filter(
      (a) => a.startsWith('automacao_') || a.startsWith('etiqueta_') || a.startsWith('campo_'),
    ),
  },
]

export function grupoDaAcao(acao: string): GrupoAcao | null {
  return GRUPOS_ACAO.find((g) => g.acoes.includes(acao))?.valor ?? null
}

const TELAS: Record<string, string> = {
  '/': 'Início',
  '/entrar': 'Tela de entrada',
  '/inicio/meu-painel': 'Meu painel',
  '/inicio/afazeres': 'Meus afazeres',
  '/inicio/afazeres-do-time': 'Afazeres do time',
  '/inicio/meu-perfil': 'Meu perfil',
  '/inicio/avisos': 'Avisos',
  '/inicio/chat': 'Chat',
  '/tablet': 'Modo tablet',
  '/trocar-senha': 'Troca de senha',
  '/fabrica/logistica/expedicao': 'Logística · Expedição',
  '/fabrica/logistica/estoque': 'Logística · Estoque',
  '/fabrica/logistica/pedidos-em-aguardo': 'Logística · Pedidos em aguardo',
  '/fabrica/logistica/danificados': 'Logística · Danificados',
  '/fabrica/logistica/cancelados': 'Logística · Cancelados',
  '/fabrica/rotas/entregas': 'ROTAS · Entregas',
  '/fabrica/rotas/programacao': 'ROTAS · Programação',
  '/dashboards/meu-desempenho': 'Dashboards · Meu desempenho',
  '/dashboards/visao-do-dia': 'Dashboards · Visão do dia',
  '/dashboards/tempo-por-setor': 'Dashboards · Tempo por setor',
  '/dashboards/pessoas': 'Dashboards · Pessoas',
  '/dashboards/qualidade': 'Dashboards · Qualidade',
  '/comercial/recompra': 'Comercial · Painel de Recompra',
  '/comercial/dashboard': 'Comercial · Dashboard',
  '/comercial/listas': 'Comercial · Listas de disparo',
  // SESSAO-27 (D-100): o "Painel admin" virou Configurações; Auditoria e
  // Automações moram no Super admin. Os endereços antigos (que estão na
  // trilha de antes) ganham o nome de hoje.
  '/configuracoes/equipe': 'Configurações · Gestão da equipe',
  '/configuracoes/setores-e-etapas': 'Configurações · Setores e etapas',
  '/configuracoes/tempo': 'Configurações · Controle de tempo',
  '/configuracoes/estoque': 'Configurações · Estoque',
  '/configuracoes/api': 'Configurações · API e integrações',
  '/configuracoes/caminhoes': 'Configurações · Caminhões',
  '/configuracoes/utilitarios': 'Configurações · Utilitários',
  '/super-admin/automacoes': 'Super admin · Automações',
  '/super-admin/auditoria': 'Super admin · Auditoria',
  '/admin/equipe': 'Configurações · Gestão da equipe',
  '/admin/setores-e-etapas': 'Configurações · Setores e etapas',
  '/admin/tempo': 'Configurações · Controle de tempo',
  '/admin/estoque': 'Configurações · Estoque',
  '/admin/api': 'Configurações · API e integrações',
  '/admin/caminhoes': 'Configurações · Caminhões',
  '/admin/auditoria': 'Super admin · Auditoria',
}

/** O nome da tela a partir do endereço — o quadro de cada setor pelo nome do setor. */
export function nomeDaTela(rota: string, setores: { codigo: string; nome: string }[] = []): string {
  const caminho = rota.split('?')[0].replace(/\/+$/, '') || '/'
  if (TELAS[caminho]) return TELAS[caminho]
  const producao = caminho.match(/^\/fabrica\/producao\/([^/]+)$/)
  if (producao) {
    const setor = setores.find((s) => s.codigo === producao[1])
    return `Produção · ${setor?.nome ?? producao[1].toUpperCase()}`
  }
  if (/^\/comercial\/listas\/[^/]+$/.test(caminho)) return 'Comercial · Uma lista de disparo'
  if (caminho.startsWith('/convite/')) return 'Convite'
  return caminho
}

/** Onde aconteceu: a tela (navegação) ou os setores/etapas do card. */
export function ondeAconteceu(
  linha: {
    acao: string
    rota: string | null
    setor_origem: string | null
    setor_destino: string | null
    etapa_origem: string | null
    etapa_destino: string | null
  },
  setores: { codigo: string; nome: string }[] = [],
): string | null {
  if (linha.rota) return nomeDaTela(linha.rota, setores)
  const origem = [linha.setor_origem, linha.etapa_origem].filter(Boolean).join(' · ')
  const destino = [linha.setor_destino, linha.etapa_destino].filter(Boolean).join(' · ')
  if (origem && destino && origem !== destino) return `${origem} → ${destino}`
  return origem || destino || null
}

const ESTADO_QUALIDADE: Record<string, string> = {
  perfeito: 'Perfeito estado',
  atencao: 'Estado de atenção',
  danificado: 'Danificado',
}
/** De onde veio o gesto — também a linha do tempo do card usa (SESSAO-27). */
export const ORIGEM: Record<string, string> = {
  interface: 'Pela tela',
  api: 'Pela integração',
  automacao: 'Automático',
}
const CHAVES: Record<string, string> = {
  sku: 'SKU',
  quantidade: 'Quantidade',
  antes: 'Antes',
  depois: 'Depois',
  data: 'Data',
  data_antes: 'Data antes',
  data_depois: 'Data depois',
  nome: 'Nome',
  matricula: 'Matrícula',
  campos: 'Campos alterados',
  estado_qualidade: 'Estado',
  origem: 'Como',
  deposito: 'Depósito',
  conta: 'Conta do Tiny',
  tiny_antes: 'No Tiny antes',
  tiny_depois: 'No Tiny depois',
  saldo_deposito: 'Saldo do depósito',
  tipo: 'Tipo',
  indicador: 'Indicador',
  periodo: 'Período',
  semanas: 'Semanas',
  produtos: 'Produtos',
  produtos_alterados: 'Produtos alterados',
  minimos_recalculados: 'Mínimos recalculados',
  cards_realocados: 'Cards passados ao líder',
  tarefas_realocadas: 'Tarefas passadas ao líder',
  execucoes_encerradas: 'Execuções encerradas',
  desde: 'Desde',
  membros: 'Pessoas',
  url: 'Endereço da foto',
  caminho: 'Arquivo',
  anterior: 'Arquivo anterior',
  automacao: 'Automação',
  etiqueta: 'Etiqueta',
  cor: 'Cor',
  campo: 'Campo',
  gatilho: 'Quando',
  situacao: 'Resultado',
  ligada: 'Estava ligada',
  estava_ligada: 'Estava ligada',
  passos: 'Passos',
  execucoes: 'Execuções no histórico',
  esperas_paradas: 'Esperas interrompidas',
}
/** Chaves que só servem à máquina (ids) — não vão para a tela. */
function ehChaveDeMaquina(chave: string): boolean {
  // automacao_excluida vira a etiqueta da linha, não um detalhe
  return chave === 'id' || chave.endsWith('_id') || chave === 'lancamento_id' || chave === 'motivo' || chave === 'automacao_excluida'
}

function textoDoValor(chave: string, valor: unknown): string {
  if (valor === null || valor === undefined) return '—'
  if (chave === 'estado_qualidade' && typeof valor === 'string') return ESTADO_QUALIDADE[valor] ?? valor
  if (chave === 'origem' && typeof valor === 'string') return ORIGEM[valor] ?? valor
  if (Array.isArray(valor)) return valor.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ')
  if (typeof valor === 'boolean') return valor ? 'sim' : 'não'
  if (typeof valor === 'object') return JSON.stringify(valor)
  const texto = String(valor)
  return texto.length > 160 ? `${texto.slice(0, 157)}…` : texto
}

/** Os detalhes do registro em língua de gente (sem ids). */
export function detalhesDoContexto(contexto: Record<string, unknown> | null): { rotulo: string; valor: string }[] {
  if (!contexto) return []
  return Object.entries(contexto)
    .filter(([chave]) => !ehChaveDeMaquina(chave))
    .map(([chave, valor]) => ({ rotulo: CHAVES[chave] ?? humanizar(chave), valor: textoDoValor(chave, valor) }))
}

/** O que mudou num pedido, na conferência com o Tiny. */
export const ROTULO_CAMPO_PEDIDO: Record<string, string> = {
  novo: 'pedido que não tinha chegado aqui',
  situacao: 'situação',
  previsao: 'previsão',
  obs: 'observação',
  obs_interna: 'observação interna',
  marcadores: 'marcadores',
  valores: 'valores',
  itens: 'itens',
  vendedor: 'vendedor',
  forma_envio: 'forma de envio',
  rastreio: 'rastreio',
  pagamento: 'pagamento',
  data: 'data do pedido',
  endereco_entrega: 'endereço de entrega',
  cadastro: 'cadastro no Tiny',
  cliente: 'cliente',
  outros: 'outros dados do Tiny',
}

export function rotuloDosCampos(campos: string[]): string {
  return campos.map((c) => ROTULO_CAMPO_PEDIDO[c] ?? humanizar(c)).join(', ')
}

/** "manual", "teste" e a madrugada, em língua de gente. */
export function rotuloDoMotivo(motivo: string | null | undefined): string {
  if (!motivo || motivo === 'madrugada') return 'Da madrugada (3h)'
  if (motivo === 'manual') return 'Rodada pedida à mão'
  return `Rodada de teste (${motivo})`
}
