// As áreas do sistema (um mapa por área em _docs/Mapas/) e os temas da memória.
// A classificação por palavra-chave só é usada na MIGRAÇÃO (SESSAO-49) e como sugestão
// para nota nova; depois disso quem manda é o frontmatter de cada nota (area: [...] / tema).

export const AREAS = {
  'kanban-producao': { nome: 'Kanban e Producao', titulo: 'Kanban e Produção' },
  pcp: { nome: 'PCP', titulo: 'PCP' },
  estoque: { nome: 'Estoque', titulo: 'Estoque' },
  expedicao: { nome: 'Expedicao', titulo: 'Expedição' },
  'logistica-rotas': { nome: 'Logistica e ROTAS', titulo: 'Logística e ROTAS' },
  'tiny-n8n': { nome: 'Tiny e n8n', titulo: 'Tiny e n8n' },
  'tablet-tv': { nome: 'Tablet e TV', titulo: 'Tablet e TV' },
  'tempos-paineis': { nome: 'Tempos e Paineis', titulo: 'Tempos e Painéis' },
  comercial: { nome: 'Comercial', titulo: 'Comercial' },
  'acesso-usuarios': { nome: 'Acesso e Usuarios', titulo: 'Acesso e Usuários' },
  'auditoria-logs': { nome: 'Auditoria e Logs', titulo: 'Auditoria e Logs' },
  'publicacao-infra': { nome: 'Publicacao e Infra', titulo: 'Publicação e Infra' },
  'painel-chat-automacoes': { nome: 'Meu Painel Chat e Automacoes', titulo: 'Meu Painel, Chat e Automações' },
  interface: { nome: 'Interface e Navegacao', titulo: 'Interface e Navegação' },
  processo: { nome: 'Processo de Trabalho', titulo: 'Processo de Trabalho' },
};

export const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// palavra-chave (sem acento, minúscula; vira RegExp com \b no início) → peso
const P = {
  'kanban-producao': ['kanban', 'quadros? de producao', 'quadro', 'cards?', 'arrast', 'etiquet', 'colunas?', 'setor', 'etapas?', 'qualidade', 'atesta', 'avuls', 'stand-by', 'concluir producao', 'montagem', 'secc', 'fitamento', 'furacao', 'limpeza e embalagem', 'retrabalho', 'ajuste de peca', 'cancelar a fabricacao', 'unidade', 'janela do card', 'anexo', 'mover'],
  pcp: ['pcp', 'liberac', 'liberar de novo', 'reabastec', 'reposic', 'vaga', 'ocultar', 'aguardando liberacao'],
  estoque: ['estoque', 'minimo', 'top x', 'top 20', 'saldo', 'contagem', 'insumo', 'reservad', 'danificad', 'capacidade do galpao', 'necessidade', 'sku'],
  expedicao: ['expedic', 'pedidos em aguardo', 'aguardo', 'devoluc', 'devolvid', 'peca pronta', 'adiantad'],
  'logistica-rotas': ['rotas?', 'caminh', 'entreg', 'parada', 'mapa', 'endereco', 'logistic', 'waze', 'google maps', 'comprovante', 'programac', 'motorista', 'cep', 'bairro'],
  'tiny-n8n': ['tiny', 'n8n', 'webhook', 'integrac', 'conferencia da madrugada', 'nota fiscal', 'contas a', 'api nova', 'trello', 'clickup', 'carga'],
  'tablet-tv': ['tablet', 'pin', 'modo tv', 'tv', 'aparelho', 'auxiliar'],
  'tempos-paineis': ['tempos?', 'timer', 'pausa', 'expediente', 'calendario da fabrica', 'dashboards?', 'painel de motivos', 'visao do dia', 'media', 'meta', 'produtividade', 'bonificac', 'ranking', 'grafico', 'feriado'],
  comercial: ['comercial', 'recompra', 'disparo', 'datacrazy', 'campanha', 'loja'],
  'acesso-usuarios': ['usuario', 'login', 'senha', 'permiss', 'papel', 'papeis', 'perfil', 'cadastro de', 'matricula', 'convite', 'super admin', 'administrador', 'identidade', 'nivel', 'niveis', 'seguranca', 'dados sensiveis'],
  'auditoria-logs': ['auditoria', 'logs?', 'rastro', 'trilha'],
  'publicacao-infra': ['publicac', 'deploy', 'vercel', 'supabase', 'banco', 'cron', 'versao', 'recarreg', 'aplicativo', 'branch', 'tabela', 'websocket', 'indices?', 'rotina da madrugada', 'stack'],
  'painel-chat-automacoes': ['meu painel', 'tarefas?', 'chat', 'mensage', 'avisos?', 'notificac', 'automac', 'sugest(ao|oes) de melhoria', 'tech', 'delegac', 'subtarefa', 'aniversari', 'bolinha', 'utilitarios'],
  interface: ['telas?', 'menu', 'temas?', 'layout', 'navegac', 'botao', 'cabecalho', 'busca geral', 'lupa', 'interface', 'icone', 'abas?', 'rolagem', 'configuracoes', 'filtro', 'foto', 'imagens?'],
  processo: ['sessao', 'sessoes', 'bloco', 'prompt', 'claude code', 'metodo', 'demanda', 'provisorias', 'respostas do dono', 'documentac', 'cofre'],
};
const RE = Object.fromEntries(
  Object.entries(P).map(([a, ps]) => [a, ps.map((p) => new RegExp('\\b' + p, 'g'))]),
);

/** Pontua um texto por área. titulo pesa 6×, corpo 1× (cada palavra-chave conta até 4 vezes). */
export function classificarArea(titulo, corpo) {
  const t = semAcento(titulo).toLowerCase();
  const c = semAcento(corpo).toLowerCase();
  const pontos = {};
  for (const [a, res] of Object.entries(RE)) {
    let s = 0;
    for (const re of res) {
      s += 6 * Math.min(2, (t.match(re) ?? []).length);
      s += Math.min(4, (c.match(re) ?? []).length);
    }
    pontos[a] = s;
  }
  const ord = Object.entries(pontos).sort((x, y) => y[1] - x[1]);
  const saida = [ord[0][0]];
  if (ord[1][1] >= 0.7 * ord[0][1] && ord[1][1] > 0) saida.push(ord[1][0]);
  return ord[0][1] === 0 ? ['processo'] : saida;
}

