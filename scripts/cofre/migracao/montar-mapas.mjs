// MIGRAÇÃO (SESSAO-49, roda uma vez): cria os mapas por área (Mapas/MOC - *.md), a lista de
// sessões e handoffs, o novo Mapa do Projeto e a Ordem das Sessões curta. Os textos antigos do
// Mapa e da Ordem vão INTEIROS para Arquivo/ (nada se perde); planos e prompts já executados
// mudam de pasta sem mudar de nome (as ligações continuam valendo).
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { COFRE } from '../lib.mjs';
import { AREAS } from '../areas.mjs';

const HOJE = '2026-11-18';
const p = (...x) => join(COFRE, ...x);
const ler = (...x) => readFileSync(p(...x), 'utf8');
const nomes = (pasta, filtro = () => true) => readdirSync(p(pasta)).filter((f) => f.endsWith('.md') && filtro(f)).map((f) => f.slice(0, -3));
const gravar = (rel, texto) => {
  if (existsSync(p(rel))) throw new Error('já existe: ' + rel);
  writeFileSync(p(rel), texto);
};
if (existsSync(p('Mapas'))) throw new Error('os mapas já foram montados');
mkdirSync(p('Mapas'));
mkdirSync(p('Arquivo'), { recursive: true });

// ── 1) o que sai da frente (mesmo nome, outra pasta) ──
const mover = [
  ['Plataforma', 'PROMPT - Bloco 1 (Sessoes 01 a 05).md'],
  ['Plataforma', 'PROMPT - Bloco 2 (Sessoes 05 a 09).md'],
  ['Plataforma', 'PROMPT - Bloco 5 (Sessoes 22 a 28).md'],
  ['Plataforma', 'PROMPT - Bloco 6 (Sessoes 30 a 32).md'],
  ['Plataforma', 'PLT - Plano Noturno Sessoes 07-12.md'],
  ['Plataforma', 'PLT - Plano Uniao das Plataformas.md'],
  ['Planejamento', '002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes.md'],
  ['Planejamento', '004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo.md'],
];
for (const [pasta, arq] of mover) renameSync(p(pasta, arq), p('Arquivo', arq));
// a cópia idêntica (byte a byte) do handoff de pesquisa na raiz do cofre: fica a de Planejamento/
const dupA = '001 - HANDOFF - Pesquisa e Ideias de Plataformas.md';
if (ler(dupA) !== ler('Planejamento', dupA)) throw new Error('as duas cópias do handoff de pesquisa não são iguais');
rmSync(p(dupA));

// ── 2) Mapa e Ordem antigos, inteiros, para o Arquivo ──
const mapaAntigo = ler('000 - MAPA DO PROJETO.md');
const ordemAntiga = ler('Plataforma', 'Demandas', '000 - ORDEM DAS SESSOES.md');
const cabArquivo = (titulo, de) => `---\ntitulo: "${titulo}"\ntipo: arquivo\narquivado: ${HOJE}\ntags: [arquivo, historia]\n---\n\n> [!info] Arquivo — cópia fiel de [[${de}]] como estava em 18/11/2026 (SESSAO-49)\n> Guardada inteira, sem reescrever, quando a nota viva ficou curta. É história: não se atualiza. O frontmatter original vem logo abaixo, como texto.\n\n`;
const comoTexto = (t) => t.replace(/^---\n([\s\S]*?)\n---\n/, (m, fm) => '```yaml\n' + fm + '\n```\n');
gravar('Arquivo/Mapa do Projeto - como era ate 18-11-2026.md', cabArquivo('Mapa do Projeto — como era até 18/11/2026 (com o histórico de sessões e os estados em uma linha)', '000 - MAPA DO PROJETO') + comoTexto(mapaAntigo));
gravar('Arquivo/Ordem das Sessoes - resumos longos ate 18-11-2026.md', cabArquivo('Ordem das Sessões — a tabela com os resumos longos até 18/11/2026', '000 - ORDEM DAS SESSOES') + comoTexto(ordemAntiga));

// ── 3) sessões: demanda, handoff e diário de cada uma ──
const demandas = nomes('Plataforma/Demandas', (f) => /^SESSAO-\d+ - /.test(f));
const handoffs = nomes('Handoffs');
const diarios = new Set(nomes('Plataforma/Execucao'));
const sessoes = demandas.map((d) => {
  const n = +/^SESSAO-(\d+)/.exec(d)[1];
  const nn = String(n).padStart(2, '0');
  return { n, nn, demanda: d, handoffs: handoffs.filter((h) => new RegExp(`sessao${nn}_`).test(h)), diario: diarios.has(`SESSAO-${nn}`) ? `SESSAO-${nn}` : null };
}).sort((a, b) => b.n - a.n);
const linhaSessao = (s, comDiario = true) =>
  `- **${s.nn}** · [[${s.demanda}]]${s.handoffs.map((h, i) => ` · [[${h}|handoff${s.handoffs.length > 1 ? ' ' + (i + 1) : ''}]]`).join('')}${comDiario && s.diario ? ` · [[${s.diario}|diário]]` : ''}`;
const soltos = handoffs.filter((h) => !/sessao\d\d_/.test(h));
const rotuloSolto = (h) => h.replace(/^handoff_/, '').replace(/^(\d{4})_(\d{2})_(\d{2})_/, '$3/$2 · ').replace(/_/g, ' ');

gravar('Mapas/MOC - Sessoes e Handoffs.md', `---
titulo: "Mapa — Sessões e handoffs (uma linha por sessão)"
tipo: mapa
atualizado: ${HOJE}
tags: [mapa, moc, sessoes, handoffs]
---

# 🗺️ MOC - Sessoes e Handoffs

> Uma linha por sessão: a demanda, o handoff (o resumo para o dono) e o diário técnico. **A sessão que entrega acrescenta a sua linha no topo.** O estado de cada uma está em [[000 - ORDEM DAS SESSOES]]; o que falta fazer, em [[000 - PROXIMOS PASSOS]]. O histórico por extenso que morava no Mapa do Projeto (o "estado em uma linha" de cada data) está, inteiro, em [[Mapa do Projeto - como era ate 18-11-2026]].

## Sessões (a mais nova primeiro)

${sessoes.map((s) => linhaSessao(s)).join('\n')}

## Ajustes e entregas fora da numeração

${soltos.sort().reverse().map((h) => `- [[${h}|${rotuloSolto(h)}]]`).join('\n')}

## Ver também

[[000 - EXECUCAO (indice)]] (todos os diários) · [[000 - MAPA DO PROJETO]]
`);

// ── 4) os mapas por área ──
const N8N = nomes('Fabrica n8n');
const lista = (xs) => xs.map((x) => `[[${x}]]`).join(' · ');
const DADOS = {
  'kanban-producao': {
    oque: 'O coração da plataforma: cada móvel liberado vira **um card por unidade** que percorre os setores (SECC, CNC, FURAÇÃO, FITAMENTO, METALURGICA, MONTAGEM, LIMPEZA E EMBALAGEM) por arrasto. Cada gesto vira um **fato** que não se apaga; fila, execução, pausa, qualidade e tempo são todos derivados dos fatos. Inclui o card avulso, a janela do card (anexos, conversa, responsáveis), as etiquetas, o filtro dos quadros, o botão Mover e o cancelamento da fabricação.',
    codigo: '`src/kanban/` (componentes, janela, lançamento) · `src/paginas/QuadroSetor.tsx` · `src/paginas/Estrutura.tsx` (setores e etapas) · `src/paginas/Utilitarios.tsx` · `src/utilitarios/`',
    sessoes: [51, 50, 48, 40, 39, 38, 31, 24, 22, 6, 5, 4],
    mais: ['PLT - Visao Geral', 'PLT - Requisitos', 'PLT - Modelo de Dados (conceito)', 'FAB - Estrutura de Producao (Trello e ClickUp)', 'FAB - Processo Alvo - Um Clique Um Evento'],
    perguntas: 'Q-22 (terceirizados) · Q-25 (migração dos cards vivos do ClickUp/Trello)',
  },
  pcp: {
    oque: 'A porta de entrada da produção: o PCP vê o **pedido inteiro**, decide e libera (por inteiro ou em parte). Aqui moram as abas (Reabastecimento · Pedidos aguardando liberação · Todos os pedidos · Cancelados · Pedidos ocultos), a reposição de estoque, o pedido que segue a situação do Tiny, "Cancelar pedido" e "Ocultar do PCP", a peça sem dono reaproveitada e o "Mover para o PCP".',
    codigo: '`src/paginas/PCP.tsx` · `src/pedidos/` (a área Pedidos)',
    sessoes: [51, 50, 48, 47, 45, 44, 30, 22, 9],
    mais: ['PLT - Entrada Automatica de Pedidos'],
    perguntas: '—',
  },
  estoque: {
    oque: 'O estoque dos móveis acabados e a reposição: só entra **peça pronta, perfeita e sem pedido**; a contagem é da logística; o Top X define a página e quem tem mínimo; abaixo do mínimo o estoque pede reposição ao PCP. O número conversa com o Tiny (saldo somado das duas empresas) e a venda reserva a peça na hora. Insumo, móvel e peça são coisas separadas.',
    codigo: '`src/paginas/Estoque.tsx` · `src/paginas/AdminEstoque.tsx` · `src/paginas/ClassificacaoProdutos.tsx` · `src/paginas/Danificados.tsx` · `src/logistica/`',
    sessoes: [45, 40, 32, 30, 25, 24],
    mais: ['003 - PLANO - Integracao Completa Tiny da Fabrica', 'N8N - Tiny Fabrica - Estudo do Cadastro', 'N8N - Tiny Fabrica Produtos para Banco'],
    perguntas: 'Q-72 (o pacote de correções do raio-x do estoque de 29/09 — anotado, sem correção)',
  },
  expedicao: {
    oque: 'O lugar da peça pronta **com pedido**: a Expedição mostra só pedido vivo, a previsão mais próxima primeiro, e absorveu "Pedidos em aguardo". Aqui se decide a devolução, o cancelado com móvel pronto (que volta sozinho ao estoque), o pedido que o Tiny levou adiante com produto faltando e a liberação da peça pronta para outro pedido.',
    codigo: '`src/paginas/Expedicao.tsx` · `src/logistica/`',
    sessoes: [48, 47, 45, 38, 31, 24],
    mais: [],
    perguntas: '—',
  },
  'logistica-rotas': {
    oque: 'A entrega com caminhão próprio: a Programação monta a rota do dia (pelas ruas, saindo da fábrica e voltando), o calendário mostra as rotas, o entregador marca Entregue / Não entregue / entrega parcial com comprovante, e "Entregue" é **um fato só, dos dois lados** (plataforma e Tiny). Inclui parada avulsa, endereço e data de entrega do pedido, Google Maps/Waze e o painel de motivos.',
    codigo: '`src/rotas/` · `src/paginas/Rotas.tsx` · `src/paginas/Programacao.tsx` · `src/paginas/EntregasDoDia.tsx` · `src/paginas/Caminhoes.tsx`',
    sessoes: [51, 50, 47, 45, 44, 41, 39, 38, 30, 28, 15],
    mais: ['N8N - ROTAS Entregue para Tiny', 'N8N - ROTAS ClickUp'],
    perguntas: '—',
  },
  'tiny-n8n': {
    oque: 'O Tiny (Olist) é o ERP; o n8n é quem conversa com ele. Pedido, cliente, produto, nota e conta chegam ao banco **por evento** (webhook → fila), o que o Tiny não avisa é relido de hora em hora e na conferência da madrugada. Loja e fábrica são **duas contas** do Tiny; cada credencial tem **um só renovador**. A plataforma lê o próprio banco e devolve ao Tiny o "entregue" e o saldo do estoque.',
    codigo: '`supabase/functions/` (as funções de borda do Tiny) · `src/paginas/AdminApi.tsx` · os fluxos exportados em `_docs/Fabrica n8n/*.json`',
    sessoes: [50, 47, 44, 33, 29, 25, 21, 11, 9],
    mais: [...N8N.filter((x) => x.startsWith('N8N')), '003 - PLANO - Integracao Completa Tiny da Fabrica', 'PLT - API Aberta', 'PLT - Entrada Automatica de Pedidos', 'SUPA - Visao Geral'],
    perguntas: 'ver a seção "API e integrações" das perguntas em aberto',
  },
  'tablet-tv': {
    oque: 'O chão de fábrica: um tablet por setor entra pelo **PIN do setor**, cada pessoa se identifica só pelo próprio PIN, o botão Auxiliar põe outra pessoa no card com tempo próprio, e o ícone do canto mostra quem está no setor (Pausar · Sair · Entrar). O Modo TV mostra os tempos do dia num telão. A plataforma também abre como aplicativo no aparelho.',
    codigo: '`src/tablet/` · `src/paginas/TelaSetor.tsx` · `src/autenticacao/`',
    sessoes: [43, 41, 38, 37, 36, 7],
    mais: [],
    perguntas: '—',
  },
  'tempos-paineis': {
    oque: 'A razão de existir da plataforma: **medir o tempo de verdade**. Tempo de fila (do setor) e de execução (da pessoa), o "tempo certo" (calendário da fábrica, pausa sozinha no fim do expediente, cálculo único gravado no fato), os motivos de pausa, a tela Tempos de produção (com o histórico do Trello), a Visão do dia, o painel de motivos e as metas.',
    codigo: '`src/dashboards/` · `src/paginas/dashboards/` · `src/paginas/ControleTempo.tsx` · `src/paginas/controleTempo/` · `src/metas/`',
    sessoes: [47, 43, 42, 39, 38, 36, 16, 10, 5],
    mais: ['000-LEIA-ME'],
    perguntas: '—',
  },
  comercial: {
    oque: 'O pós-venda da loja dentro da plataforma (o antigo Painel de Recompra): espelho das vendas do Tiny, recompra, campanhas e disparo pelo CRM DataCrazy. Os crons de disparo rodam **só na fábrica**. As notas do módulo têm prefixo próprio e o atendimento humano tem pasta própria.',
    codigo: '`src/comercial/`',
    sessoes: [32, 21, 20, 19],
    mais: [...nomes('Plataforma', (f) => f.startsWith('PLT - Comercial')), ...nomes('Supabase-fabrica', (f) => f.startsWith('SUPA - Comercial')), '000 - ATENDIMENTO (indice)'],
    perguntas: 'ver a seção "União das Plataformas" das perguntas em aberto',
  },
  'acesso-usuarios': {
    oque: 'Quem entra e o que pode: uma tabela de pessoas, três tipos de usuário (fábrica, comercial, os dois), níveis (operador, líder, produção, logística, admin, super admin), login por e-mail ou nome de usuário, PIN, "esqueci minha senha" liberado por administrador, Meu Perfil e a revisão de segurança. Dado pessoal fica fora da API.',
    codigo: '`src/autenticacao/` · `src/perfil/` · `src/admin/` · `src/paginas/Equipe.tsx` · `src/paginas/equipe/` · `src/paginas/Entrar.tsx` · `src/paginas/MeuPerfil.tsx` · `supabase/functions/autenticacao/`',
    sessoes: [41, 38, 37, 36, 18, 13, 3],
    mais: [],
    perguntas: 'Q-64 (os 8 temas)',
  },
  'auditoria-logs': {
    oque: '**Toda atividade de usuário gera registro no banco.** A Auditoria (painel do super admin) mostra o rastro de tudo — quem, quando, onde, o quê — e a trilha diz por que cada página abriu. O que uma automação fez fica marcado mesmo depois de a automação ser excluída.',
    codigo: '`src/auditoria/` · `src/logs/` · `src/paginas/Auditoria.tsx`',
    sessoes: [48, 29, 27, 13],
    mais: [],
    perguntas: '—',
  },
  'publicacao-infra': {
    oque: 'Onde tudo roda: o banco único no Supabase da fábrica (migrations versionadas, aplicadas uma a uma com o OK do dono, bateria local antes), as funções de borda, o site na Vercel (subir código para a main **publica**; documentação não), as rotinas agendadas e a regra de versão/recarga das telas.',
    codigo: '`supabase/migrations/` · `supabase/testes/` · `supabase/aplicar-migrations.mjs` · `supabase/functions/` · `vercel.json` · `scripts/`',
    sessoes: [48, 32, 8, 2, 1],
    mais: ['SUPA - Visao Geral', 'N8N - Infraestrutura VPS', 'PLT - Lei de Desempenho e Escala', 'SUPA - Comercial - Cron e Rotinas'],
    perguntas: 'ver a seção "Operação e infraestrutura" das perguntas em aberto',
  },
  'painel-chat-automacoes': {
    oque: 'O que cerca a produção: o Meu Painel (filas pessoais, subtarefas, tarefa privada), os afazeres e a delegação, o chat interno (canais, particulares, Avisos gerais), os avisos que cada um escolhe receber, as automações em canvas ("quando… faça…", "se… senão") e o quadro Tech → Sugestão de melhoria.',
    codigo: '`src/paginas/MeuPainel.tsx` · `src/afazeres/` · `src/chat/` · `src/notificacoes/` · `src/paginas/ConfigAvisos.tsx` · `src/automacoes/` · `src/tech/`',
    sessoes: [46, 31, 27, 26, 23, 17, 14, 12],
    mais: [],
    perguntas: 'Q-42 (onde o líder recebe os alertas)',
  },
  interface: {
    oque: 'Como toda tela se parece e se navega: menu lateral recolhível, rota sempre pai→filho, botão de voltar, sino, cabeçalho compacto, temas, busca geral (a lupa), textos em português do galpão e nenhum código interno na tela. O detalhe visual está nas notas de design.',
    codigo: '`src/componentes/` (`ui/`, `Layout.tsx`) · `src/estilos/` (`tokens.css`, `global.css`) · `src/navegacao/` · `src/busca/`',
    sessoes: [40, 13, 7, 1],
    mais: ['PLT - Modelo de Sistema'],
    perguntas: 'Q-30 (referência visual) · Q-33 (idioma dos termos)',
  },
  processo: {
    oque: 'Como o trabalho acontece: uma demanda por sessão, na ordem combinada; o Cowork mapeia com o dono, o Claude Code executa; decisão sem o dono nasce provisória; nada vai para produção sem o OK dele. Aqui mora também o próprio cofre: as Regras de Ouro, os mapas, os templates e o verificador.',
    codigo: '`CLAUDE.md` · `scripts/cofre/` (o verificador) · `_docs/Templates/`',
    sessoes: [49],
    mais: ['000 - REGRAS DE OURO', '000 - ORDEM DAS SESSOES', '000 - PROXIMOS PASSOS', 'CLAUDE - Regras do Claude Code (repo)', 'CLAUDE', 'TEMPLATE - Demanda', 'TEMPLATE - Handoff de Sessao', '000 - EXECUCAO (indice)', 'MOC - Sessoes e Handoffs'],
    perguntas: '—',
  },
};
for (const [chave, a] of Object.entries(AREAS)) {
  const d = DADOS[chave];
  if (!d) throw new Error('faltam os dados do mapa: ' + chave);
  const ss = d.sessoes.map((n) => sessoes.find((s) => s.n === n)).filter(Boolean);
  gravar(`Mapas/MOC - ${a.nome}.md`, `---
titulo: "Mapa — ${a.titulo}"
tipo: mapa
area: ${chave}
atualizado: ${HOJE}
tags: [mapa, moc, area/${chave}]
---

# 🗺️ MOC - ${a.nome}

> ${d.oque}

**No código:** ${d.codigo}
${d.mais.length ? `\n**Notas da área:** ${lista(d.mais)}\n` : ''}
**Perguntas em aberto:** ${d.perguntas} — [[PLT - Perguntas em Aberto]]

## Últimas sessões da área (a mais nova primeiro)

${ss.map((s) => linhaSessao(s, false)).join('\n')}

<!-- gerado:inicio -->
<!-- gerado:fim -->
`);
}

// ── 5) o novo Mapa do Projeto ──
const ATD = nomes('Atendimento');
gravar('000 - MAPA DO PROJETO.new', '');
rmSync(p('000 - MAPA DO PROJETO.new'));
writeFileSync(p('000 - MAPA DO PROJETO.md'), `---
titulo: Mapa do Cofre Domoby
tipo: indice
atualizado: ${HOJE}
tags: [mapa, indice, moc]
---

# 🗺️ Mapa do Cofre — Domoby

> [!abstract] O que é este cofre
> A **memória de longo prazo da Móveis Domoby**: a fábrica (automações, processos, a Plataforma de Produção) e o comercial. Uma fábrica de móveis em MDF (e linha industrial com metalurgia própria) em Natal-RN. ↪️ **18/11/2026:** o cofre segue o **padrão de mapas** — este mapa aponta para o mapa de cada área, e cada mapa aponta para as notas pequenas. Ninguém precisa ler arquivo grande inteiro.

## 🧭 Rota de leitura

1. **Sempre:** [[000 - REGRAS DE OURO]] (e o \`CLAUDE.md\` da raiz do repositório). É a leitura obrigatória inteira — cabe em 40 KB.
2. **A demanda da vez** ([[000 - ORDEM DAS SESSOES]]) e os mapas que a seção "Leitura da sessão" dela listar.
3. **Daí em diante, só seguindo ligação ou busca:** a decisão, a nota do banco, a lição, o design.
4. **O que falta fazer:** [[000 - PROXIMOS PASSOS]]. **O que já foi feito:** [[MOC - Sessoes e Handoffs]].

## 🗂️ As áreas da plataforma (um mapa por área)

| Área | Mapa | O que tem lá |
|---|---|---|
${Object.entries(AREAS).map(([chave, a]) => `| ${a.titulo} | [[MOC - ${a.nome}]] | ${{ 'kanban-producao': 'cards, setores, etapas, qualidade, quadro por arrasto', pcp: 'liberação, reposição, cancelar e ocultar pedido', estoque: 'acabados, mínimo, Top X, saldo com o Tiny', expedicao: 'peça pronta com pedido, devolução, cancelado pronto', 'logistica-rotas': 'programação, calendário, entregador, entrega parcial', 'tiny-n8n': 'as duas contas do Tiny, a fila, os fluxos do n8n', 'tablet-tv': 'PIN do setor, auxiliar, presença, Modo TV', 'tempos-paineis': 'o tempo certo, Tempos de produção, painéis, metas', comercial: 'recompra, campanhas, disparo, atendimento', 'acesso-usuarios': 'pessoas, níveis, login, senha, perfil', 'auditoria-logs': 'o rastro de toda atividade', 'publicacao-infra': 'banco, migrations, Vercel, rotinas agendadas', 'painel-chat-automacoes': 'Meu Painel, tarefas, chat, avisos, automações, Tech', interface: 'navegação, menu, cabeçalho, temas, busca', processo: 'o método, as regras, o próprio cofre' }[chave]} |`).join('\n')}

## 📚 Onde mora cada coisa

| O quê | Onde | Índice (não se lê inteiro) |
|---|---|---|
| Decisões de produto — **uma nota por decisão** | \`Plataforma/Decisoes/\` | [[PLT - Decisoes de Produto]] |
| Lições (erros, acertos, modelos) — **por tema** | \`Plataforma/Memoria/\` | [[PLT - Memoria de Aprendizado]] |
| Banco — **por domínio** | \`Supabase-fabrica/Banco/\` | [[SUPA - Esquema do Banco]] |
| Design — **por assunto** | \`Plataforma/Design/\` | [[PLT - Modelo de Sistema]] |
| Lei de desempenho e as dívidas | \`Plataforma/\` | [[PLT - Lei de Desempenho e Escala]] |
| Demandas (uma por sessão) | \`Plataforma/Demandas/\` | [[000 - ORDEM DAS SESSOES]] |
| Diários técnicos | \`Plataforma/Execucao/\` | [[000 - EXECUCAO (indice)]] |
| Handoffs (o resumo para o dono) | \`Handoffs/\` | [[MOC - Sessoes e Handoffs]] |
| Planejamento | \`Planejamento/\` | [[000 - PROXIMOS PASSOS]] |
| O que saiu da frente (planos e prompts já executados, textos antigos) | \`Arquivo/\` | achado por busca |

**Notas de base da plataforma:** [[PLT - Visao Geral]] (o fluxo real da fábrica) · [[PLT - Requisitos]] · [[PLT - Perguntas em Aberto]] (o que **não tem resposta**: pergunte) · [[PLT - Modelo de Dados (conceito)]] · [[PLT - API Aberta]] · [[PLT - Entrada Automatica de Pedidos]] · [[CLAUDE - Regras do Claude Code (repo)]] (o detalhe de cada regra) · [[CLAUDE]] (as instruções permanentes do cofre)

## 🔌 Fora da plataforma

- **Automações n8n e Tiny** (pasta \`Fabrica n8n/\`) — comece por [[N8N - Visao Geral da Migracao]] e [[N8N - Tiny Modelos Mentais]]; problemas e riscos em [[N8N - Pendencias e Riscos]]. Todas as notas: [[MOC - Tiny e n8n]].
- **Banco** (pasta \`Supabase-fabrica/\`) — [[SUPA - Visao Geral]] · o comercial: [[SUPA - Comercial - Dominio de Dados]] · [[SUPA - Comercial - Edge Functions]] · [[SUPA - Comercial - Cron e Rotinas]].
- **Módulo Comercial** — [[MOC - Comercial]].
- **Atendimento** (memória de negócio, não código) — ${lista(ATD)}.
- **Processos fabris** — [[FAB - Estrutura de Producao (Trello e ClickUp)]] · [[FAB - Processo Alvo - Um Clique Um Evento]].
- **Pesquisa e ideias** — [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]] · [[003 - PLANO - Integracao Completa Tiny da Fabrica]].
- **Arquivo** — [[Mapa do Projeto - como era ate 18-11-2026]] · [[Ordem das Sessoes - resumos longos ate 18-11-2026]] · [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo]] · [[PLT - Plano Uniao das Plataformas]] · [[PLT - Plano Noturno Sessoes 07-12]] · [[PROMPT - Bloco 1 (Sessoes 01 a 05)]] · [[PROMPT - Bloco 2 (Sessoes 05 a 09)]] · [[PROMPT - Bloco 5 (Sessoes 22 a 28)]] · [[PROMPT - Bloco 6 (Sessoes 30 a 32)]].

## 🧩 Templates

[[TEMPLATE - Demanda]] · [[TEMPLATE - Handoff de Sessao]]

## Como manter o cofre em ordem

- **Decisão nova** = nota nova em \`Plataforma/Decisoes/\`. **Lição nova** = na nota do tema. **Banco mudou** = bloco novo no fim da nota do domínio. **Sessão entregue** = uma linha em [[MOC - Sessoes e Handoffs]] e o status em [[000 - ORDEM DAS SESSOES]].
- **Toda citação de id é ligação** (\`node scripts/cofre/verificar.mjs --ligar\` faz isso sozinho).
- **No fim de toda sessão:** \`node scripts/cofre/verificar.mjs --gerar\` (refaz os índices e as listas dos mapas) e \`node scripts/cofre/verificar.mjs\` (zero erro: nenhuma ligação quebrada, nenhuma nota solta, tudo dentro do teto).
- **Mover de pasta não quebra ligação; renomear quebra.** Nome de nota é único no cofre inteiro.
`);

// ── 6) a Ordem das Sessões curta ──
const lo = ordemAntiga.split('\n');
const iTab = lo.findIndex((l) => /^\| Ordem \| Sessão/.test(l));
let iFimTab = iTab + 2;
while (lo[iFimTab]?.startsWith('|')) iFimTab++;
const statusCurto = (s) => {
  let t = s.replace(/~~.*?~~/g, '').replace(/\*\*/g, '').trim();
  const corte = t.search(/( — | · | \(|↪|\[\[|;|:)/);
  if (corte > 3) t = t.slice(0, corte);
  return t.trim().replace(/[.,]$/, '') || s.trim().slice(0, 40);
};
const linhasCurtas = lo.slice(iTab + 2, iFimTab).map((l) => {
  const cel = l.split('|').map((x) => x.trim());
  const n = /SESSAO-(\d+)/.exec(cel[2])?.[1] ?? /^\**(\d+)/.exec(cel[1].replace(/\*/g, ''))?.[1];
  const s = sessoes.find((x) => x.nn === String(n).padStart(2, '0'));
  const hand = s?.handoffs.length ? ' · ' + s.handoffs.map((h, i) => `[[${h}\\|handoff${s.handoffs.length > 1 ? ' ' + (i + 1) : ''}]]`).join(' · ') : ''; // \\| = barra escapada dentro de tabela
  const status = n === '49' ? '🔨 em execução (18/11)' : statusCurto(cel[5]);
  return `| ${cel[1]} | ${cel[2].replace(/~~/g, '')} | ${status}${hand} |`;
});
writeFileSync(p('Plataforma', 'Demandas', '000 - ORDEM DAS SESSOES.md'),
  lo.slice(0, iTab).join('\n').replace(/^atualizado: .*$/m, `atualizado: ${HOJE}`) +
  `> ↪️ **18/11/2026 (SESSAO-49):** esta tabela ficou **curta** — uma linha por sessão, com o status e o handoff. O resumo longo de cada linha (a "entrega em uma frase", as dependências e as notas ↪️ acumuladas, inclusive as de 18/11) está, inteiro e sem reescrever, em [[Ordem das Sessoes - resumos longos ate 18-11-2026]]; o que a sessão entrega está na própria demanda. As decisões citadas aqui: [[PLT - Decisoes de Produto]].\n\n| Ordem | Sessão | Status |\n|---|---|---|\n` +
  linhasCurtas.join('\n') + '\n' + lo.slice(iFimTab).join('\n'));

console.log(`mapas: ${Object.keys(AREAS).length} de área + sessões · ${sessoes.length} sessões listadas · ${soltos.length} ajustes · ${mover.length} notas para Arquivo/ · Mapa e Ordem antigos guardados inteiros`);
