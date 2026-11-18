// Os temas da memória de aprendizado (uma nota por tema em _docs/Plataforma/Memoria/).
// A classificação por palavra-chave só foi usada na MIGRAÇÃO (SESSAO-49); lição nova entra
// direto na nota do tema, à mão.
import { semAcento } from './areas.mjs';

export const TEMAS = {
  'banco-sql': 'Banco e SQL',
  migrations: 'Migrations Aplicador e Ensaio',
  'front-react': 'Front Telas e React',
  'kanban-producao': 'Regras de Negocio - Producao PCP Estoque e Rotas',
  'tiny-n8n': 'Tiny n8n e Integracoes',
  publicacao: 'Publicacao Vercel e Funcoes',
  testes: 'Testes e Validacao ao Vivo',
  desempenho: 'Desempenho e Tempo Real',
  acesso: 'Acesso Seguranca e Credenciais',
  'git-shell': 'Git Shell e Windows',
  processo: 'Processo de Sessao Cofre e Dono',
};

// [expressão (sem acento, minúscula), peso]
const PT = {
  'banco-sql': [['\\bsql\\b', 2], ['postgres', 2], ['\\brls\\b', 3], ['indice', 2], ['trigger', 2], ['gatilho', 2], ['plpgsql', 3], ['security definer', 3], ['invoker', 3], ['constraint', 2], ['\\bcheck\\b', 1], ['upsert', 2], ['jsonb', 2], ['\\bcte\\b', 3], ['\\bjoin\\b', 2], ['where', 2], ['postgrest', 2], ['pg_[a-z]', 2], ['transac', 2], ['\\bview\\b', 2], ['visao `', 2], ['grant', 2], ['policy', 2], ['politica', 1], ['coluna', 1], ['tabela', 1], ['on conflict', 3], ['for update', 3], ['plt_privado', 1], ['assinatura', 2], ['drop function', 3], ['recria', 1]],
  migrations: [['migration', 3], ['aplicador', 3], ['pglite', 3], ['test:banco', 3], ['bateria', 2], ['ensaio', 2], ['idempot', 2], ['--so\\b', 3], ['reaplic', 3], ['schema\\.sql', 2], ['x100', 2], ['×100', 2]],
  'front-react': [['react', 3], ['componente', 2], ['\\bhook', 2], ['usestate|useeffect|usememo|useref', 3], ['\\bcss\\b', 3], ['tailwind', 3], ['\\btsc\\b', 2], ['typescript', 2], ['eslint|\\blint\\b', 2], ['render', 2], ['\\bdom\\b', 2], ['radix', 3], ['modal', 2], ['dnd', 3], ['tanstack|react-query|usequery', 3], ['rolagem|scroll', 2], ['z-index', 3], ['\\bfoco\\b', 2], ['\\d{3,4} ?px', 3], ['375|768', 2], ['celular', 2], ['gaveta', 3], ['cortad', 2], ['botao|botoes', 1], ['cabecalho', 2], ['layout', 2], ['\\btela\\b', 1], ['overflow', 3], ['flex|grid', 2], ['icone', 1], ['arrast', 2], ['janela', 1]],
  'kanban-producao': [['\\bpcp\\b', 2], ['reposic', 2], ['liberac', 2], ['estoque', 2], ['\\brota', 2], ['entrega', 2], ['expedic', 2], ['caminh', 2], ['pedido', 1], ['peca', 1], ['card', 1], ['setor', 1], ['etapa', 1], ['cancel', 1], ['qualidade', 2], ['minimo', 2], ['saldo', 2], ['endereco', 2], ['geocod', 3], ['regra de negocio', 3], ['o dono pensa', 3], ['stand-by', 2], ['tablet', 1], ['\\bpin\\b', 2], ['timer|pausa|expediente', 2], ['dashboard', 2]],
  'tiny-n8n': [['tiny', 3], ['\\bn8n\\b', 3], ['webhook', 2], ['workflow', 3], ['planilha', 2], ['trello', 2], ['clickup', 2], ['datacrazy', 3], ['api v[23]', 3], ['renovador', 3], ['disparo', 2], ['comercial', 2], ['recompra', 3], ['\\bnode\\b do', 2], ['integrac', 2]],
  publicacao: [['vercel', 3], ['deploy', 3], ['publicac|publicar|publicad', 2], ['edge function', 3], ['funcao de borda', 3], ['bundle|pacote', 2], ['service worker', 3], ['manifest', 3], ['pg_cron|\\bcron\\b', 2], ['ignorecommand', 3], ['verify_jwt', 3], ['subir para a main|subida', 2]],
  testes: [['vitest', 3], ['preview', 3], ['screenshot|\\bprint\\b|\\bfoto\\b', 2], ['playwright', 3], ['viewport', 2], ['ao vivo', 2], ['painel do app|painel de preview', 3], ['vitrine', 3], ['\\bteste\\b', 1], ['cenario', 2], ['clique de automacao', 3], ['navegador', 2], ['chrome', 3], ['video', 2], ['quadros a', 2]],
  desempenho: [['\\blent', 2], ['\\d ?ms\\b', 2], ['p95', 3], ['paginac', 2], ['\\bcache', 2], ['requisic', 2], ['desempenho', 3], ['explain', 3], ['agregado', 2], ['projec', 2], ['cursor', 2], ['timeout', 2], ['websocket', 3], ['broadcast', 3], ['realtime', 3], ['postgres_changes', 3], ['polling', 3], ['relogio', 2], ['canal', 1], ['varredura', 3], ['plano', 1]],
  acesso: [['login', 2], ['senha', 3], ['permiss', 2], ['\\bauth', 2], ['\\bjwt\\b', 3], ['token', 2], ['credencial', 3], ['service_role', 2], ['\\banon\\b', 2], ['segredo', 3], ['oauth', 3], ['service account', 3], ['vazou|vazar', 3], ['\\.env', 3], ['chave da api|chave do', 2], ['getclaims', 3]],
  'git-shell': [['\\bgit\\b', 3], ['bash', 3], ['crlf', 3], ['powershell', 3], ['windows', 2], ['worktree', 3], ['branch|ramo', 2], ['commit', 2], ['\\bmerge\\b', 2], ['\\bpush\\b', 3], ['shell', 3], ['\\bcd\\b', 3], ['msys', 3], ['encoding|utf-8|mojibake', 3], ['\\bnpm\\b|\\bnpx\\b', 2], ['heredoc', 3], ['\\bsed\\b|\\bperl\\b|\\bcat\\b|\\bgrep\\b', 3], ['comando', 1], ['barra invertida', 3], ['node -e', 3], ['juncao', 2]],
  processo: [['sessao', 1], ['handoff', 2], ['demanda', 2], ['cofre', 2], ['diario', 2], ['task list', 3], ['checklist', 2], ['numerac', 3], ['paralel', 2], ['contexto', 2], ['cowork', 3], ['prompt', 3], ['supervisor', 2], ['\\bdono\\b', 1], ['portugues de gente', 3], ['pergunt', 2], ['presum', 3], ['file_uuid', 3], ['horario|fuso', 2], ['anotei', 2], ['nota\\b', 1]],
};
const RE = Object.fromEntries(Object.entries(PT).map(([a, ps]) => [a, ps.map(([p, w]) => [new RegExp(p, 'g'), w])]));

/** O começo da lição (a manchete) pesa 3×; o resto, 1× (cada expressão conta até 3 vezes). */
export function classificarTema(texto) {
  const c = semAcento(texto).toLowerCase();
  const cab = c.slice(0, 260);
  let melhor = 'processo';
  let pm = 0;
  for (const [a, res] of Object.entries(RE)) {
    let s = 0;
    for (const [re, w] of res) s += w * (3 * Math.min(2, (cab.match(re) ?? []).length) + Math.min(3, (c.match(re) ?? []).length));
    if (s > pm) {
      pm = s;
      melhor = a;
    }
  }
  return melhor;
}
