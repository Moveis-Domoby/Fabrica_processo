// MIGRAÇÃO (SESSAO-49, roda uma vez): divide a Memória de Aprendizado (por tema), o Esquema do
// Banco (por domínio), a Lei de Desempenho (a lei × as dívidas) e o Modelo de Sistema (por assunto).
// Todo bloco é COPIADO sem reescrever; a prova confere que cada bloco de origem está, inteiro,
// em exatamente uma nota de destino. Os arquivos antigos viram índices (mesmo nome).
// Uso: node scripts/cofre/migracao/dividir-notas.mjs <memoria|esquema|lei|modelo> [--ensaio]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { COFRE, kb } from '../lib.mjs';
import { semAcento } from '../areas.mjs';
import { classificarTema, TEMAS } from '../temas.mjs';

const qual = process.argv[2];
const ensaio = process.argv.includes('--ensaio');
const HOJE = '2026-11-18';
const bytes = (s) => Buffer.byteLength(s);

/** Empacota blocos (em ordem) em notas; a nota que passa do teto vira partes numeradas. */
function empacotar(blocos, teto) {
  const porChave = new Map();
  for (const b of blocos) {
    if (!porChave.has(b.chave)) porChave.set(b.chave, []);
    porChave.get(b.chave).push(b);
  }
  const notas = [];
  for (const [chave, lista] of porChave) {
    const partes = [[]];
    let tam = 0;
    for (const b of lista) {
      const t = bytes(b.texto) + 2;
      if (tam + t > teto && partes.at(-1).length) {
        partes.push([]);
        tam = 0;
      }
      partes.at(-1).push(b);
      tam += t;
    }
    partes.forEach((p, i) => notas.push({ chave, parte: partes.length > 1 ? i + 1 : 0, deQuantas: partes.length, blocos: p }));
  }
  return notas;
}

function gravar(caminho, conteudo) {
  mkdirSync(dirname(caminho), { recursive: true });
  if (existsSync(caminho)) throw new Error('já existe: ' + caminho);
  writeFileSync(caminho, conteudo);
}

/** Prova: cada bloco de origem aparece inteiro em exatamente uma nota gravada. */
function provar(blocos, arquivos) {
  const textos = arquivos.map((a) => readFileSync(a, 'utf8'));
  let soma = 0;
  for (const b of blocos) {
    const onde = textos.filter((t) => t.includes(b.texto)).length;
    if (onde !== 1) throw new Error(`prova falhou: bloco em ${onde} notas — ${b.texto.slice(0, 80)}`);
    soma += bytes(b.texto);
  }
  return soma;
}

// ───────────────────────────── MEMÓRIA ─────────────────────────────
function memoria() {
  const ORIGEM = join(COFRE, 'Plataforma', 'PLT - Memoria de Aprendizado.md');
  const texto = readFileSync(ORIGEM, 'utf8');
  if (!/^- (?:\[[^\]]*\] )?\*\*[EA]-\d+\*\*/m.test(texto)) throw new Error('a memória já foi dividida');
  const linhas = texto.split('\n');
  const reEntrada = /^- (?:\[[^\]]*\] )?\*\*([EAMFX])-(\d+)\*\*/;
  const ini = linhas.findIndex((l) => /^## /.test(l));
  const preambulo = linhas.slice(0, ini).join('\n');
  const blocos = [];
  let rodape = '';
  let secao = '';
  for (let i = ini; i < linhas.length; i++) {
    const l = linhas[i];
    if (/^## /.test(l)) {
      secao = l;
      continue;
    }
    if (secao.startsWith('## Ver também')) {
      rodape += l + '\n';
      continue;
    }
    const m = reEntrada.exec(l);
    if (m) blocos.push({ letra: m[1], n: +m[2], id: `${m[1]}-${m[2].replace(/^0+(?=\d)/, '')}`, idEscrito: `${m[1]}-${m[2]}`, linhas: [l] });
    else if (blocos.length) blocos.at(-1).linhas.push(l);
    else if (l.trim()) throw new Error('linha fora de entrada: ' + l.slice(0, 60));
  }
  for (const b of blocos) {
    while (b.linhas.length && !b.linhas.at(-1).trim()) b.linhas.pop();
    b.texto = b.linhas.join('\n');
    b.chave = 'EA'.includes(b.letra) ? classificarTema(b.texto) : 'modelos';
  }
  const NOMES = { ...TEMAS, modelos: 'Modelos Formulas e Possibilidades' };
  const SECOES = { E: '## 🔴 Erros e correções (E-NN)', A: '## 🟢 Acertos que viraram padrão (A-NN)', M: '## 🧠 Modelos mentais (M-NN)', F: '## 🧪 Fórmulas e receitas (F-NN)', X: '## 💡 Possibilidades a explorar (X-NN)' };
  // dentro de cada tema: erros primeiro, depois acertos (cada grupo na ordem original)
  const ordem = 'EAMFX';
  const ordenados = [...blocos].sort((a, b) => ordem.indexOf(a.letra) - ordem.indexOf(b.letra));
  const notas = empacotar(ordenados, 21000);
  const cont = (l) => blocos.filter((b) => b.letra === l).length;
  if (ensaio) {
    for (const n of notas) console.log(`${NOMES[n.chave]}${n.parte ? ' ' + n.parte : ''}: ${n.blocos.length} entradas · ${kb(n.blocos.reduce((s, b) => s + bytes(b.texto), 0))}`);
    console.log(`E ${cont('E')} · A ${cont('A')} · M ${cont('M')} · F ${cont('F')} · X ${cont('X')} · total ${blocos.length}`);
    if (process.argv.includes('--lista')) for (const b of blocos) console.log(b.chave.padEnd(16), b.id.padEnd(6), b.texto.replace(/^- (\[[^\]]*\] )?\*\*[A-Z]-\d+\*\*( \([^)]*\))? · /, '').slice(0, 95));
    return;
  }
  const arquivos = [];
  for (const n of notas) {
    const nome = `Memoria - ${NOMES[n.chave]}${n.parte ? ' ' + n.parte : ''}`;
    let corpo = `---\ntitulo: "Memória de aprendizado — ${NOMES[n.chave]}${n.parte ? ` (parte ${n.parte} de ${n.deQuantas})` : ''}"\ntipo: memoria-tema\ntema: ${n.chave}\natualizado: ${HOJE}\ntags: [memoria, aprendizado, tema/${n.chave}]\n---\n\n# 🧠 ${nome}\n\n> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (\`### E-NNN\`); o próximo número livre está no índice.\n`;
    let letra = '';
    for (const b of n.blocos) {
      if (b.letra !== letra) {
        letra = b.letra;
        corpo += `\n${SECOES[letra]}\n`;
      }
      corpo += `\n### ${b.id}\n\n${b.texto}\n`;
    }
    const caminho = join(COFRE, 'Plataforma', 'Memoria', nome + '.md');
    gravar(caminho, corpo);
    arquivos.push(caminho);
  }
  const soma = provar(blocos, arquivos);
  const indice =
    preambulo.replace(/^atualizado: .*$/m, `atualizado: ${HOJE}`).replace(/^tipo: memoria-aprendizado$/m, 'tipo: indice').replace(/\s+$/, '') +
    `\n\n> [!info] ↪️ 18/11/2026 (SESSAO-49) — este arquivo virou o ÍNDICE
> As lições moram agora em \`Plataforma/Memoria/\`, **uma nota por tema**, com o texto original intacto e o id como título (\`### E-19\`). **Não leia este índice inteiro:** leia a nota do tema que a demanda toca. As regras 1 a 5 acima seguem valendo, com uma troca: a lição nova entra **na nota do tema** (e a que custou caro sobe para [[000 - REGRAS DE OURO]]). A lista abaixo é gerada por \`node scripts/cofre/verificar.mjs --gerar\`.

<!-- gerado:inicio -->
<!-- gerado:fim -->

## Ver também

${rodape.trim()}
`;
  writeFileSync(ORIGEM, indice);
  console.log(`memória dividida: ${blocos.length} entradas (E ${cont('E')} · A ${cont('A')} · M ${cont('M')} · F ${cont('F')} · X ${cont('X')}) em ${notas.length} notas · ${kb(soma)} movidos`);
}

// ───────────────────────────── ESQUEMA ─────────────────────────────
const DOMINIOS = {
  'integracao-tiny': 'Integracao Tiny - Pedidos Clientes e Produtos',
  plataforma: 'Plataforma - Visao Geral das Tabelas plt',
  'cards-eventos': 'Cards e Eventos do Kanban',
  'setores-execucao': 'Setores Etapas e Execucao',
  pcp: 'PCP e Liberacao',
  estoque: 'Estoque e Reposicao',
  'logistica-rotas': 'Logistica ROTAS e Entregas',
  expedicao: 'Expedicao Devolucao e Cancelamento',
  tempos: 'Tempos e Paineis',
  acesso: 'Usuarios Acesso e Logs',
  tablet: 'Tablet e TV',
  comercial: 'Comercial',
  filas: 'Filas e Integracoes Tiny e n8n',
  config: 'Chat Tarefas Automacoes e Configuracoes',
};
const PD = {
  'cards-eventos': ['card avulso', 'janela do card', 'conversa do card', 'etiquet', 'quadro numa requisic', 'kanban', 'prioridade', 'mover para', 'filtro', 'busca', 'observacao do item', 'quadro por'],
  'setores-execucao': ['execucao e estorno', 'qualidade', 'pausa', 'filas reais', 'etapas', 'producao concluida', 'frete fora'],
  pcp: ['pcp', 'liberar', 'liberac', 'ocultar', 'itens novos', 'peca em producao', 'adiantado'],
  estoque: ['estoque', 'minimo', 'top x', 'top 20', 'reservas', 'reposic', 'insumo', 'movel_insumo'],
  'logistica-rotas': ['rota', 'programac', 'caminh', 'entreg', 'geocod', 'parada', 'endereco', 'calendario', 'logistica'],
  expedicao: ['expedic', 'devoluc', 'cancelad', 'cancelar a fabricac', 'cancela'],
  tempos: ['tempo', 'dashboard', 'metas', 'painel de motivos', 'tempos de producao', 'trello', 'medicao'],
  acesso: ['usuario', 'autenticacao', 'senha', 'permiss', 'auditoria', 'trilha de atividade', 'seguranca', 'politicas de rls', 'navegacao, perfil', 'super admin', 'abertura', 'niveis'],
  tablet: ['tablet', 'pin', 'presenca', 'modo tv', 'auxiliar'],
  comercial: ['comercial', 'disparo', 'cutover', 'contas'],
  filas: ['tiny', 'n8n', 'fila', 'conferencia', 'webhook', 'api,', 'foto do tiny', 'carga'],
  config: ['chat', 'tarefas', 'automac', 'avisos', 'sugest', 'meu painel', 'campos customizados', 'notificac'],
  plataforma: ['visoes', 'schema `plt_privado`', 'funcoes `plt_fn_', 'dois avisos'],
};
// conferido à mão (revisão da classificação automática): [começo do bloco, domínio]
const DOMINIO_MANUAL = [
  ['Entrada automática de pedidos', 'pcp'],
  ['Frete fora da produção', 'pcp'],
  ['Funções `plt_fn_*` em `public`', 'plataforma'],
  ['Edge Function `autenticacao`** (SESSAO-03', 'acesso'],
  ['21 políticas de RLS', 'plataforma'],
  ['Dois avisos que valem ouro', 'plataforma'],
  ['Produção de ponta a ponta (SESSAO-30', 'plataforma'],
  ['plt_indice_equipe_definido_por', 'logistica-rotas'],
  ['plt_janela_do_card', 'cards-eventos'],
  ['plt_quadro_numa_requisicao', 'cards-eventos'],
  ['plt_banco_indices_politicas', 'plataforma'],
  ['plt_indices_copias_tiny_e_repetidos', 'filas'],
  ['plt_medicao_web', 'acesso'],
  ['plt_pedidos_area', 'pcp'],
  ['plt_pedidos_busca_indices', 'pcp'],
  ['plt_contas_resumo_pagas', 'filas'],
  ['plt_tempos_por_pessoa', 'tempos'],
  ['plt_avisos_ao_vivo', 'config'],
  ['Meu Painel', 'config'],
];
function classificarDominio(texto) {
  const t = semAcento(texto.slice(0, 260)).toLowerCase();
  const c = semAcento(texto).toLowerCase();
  let melhor = 'plataforma';
  let pm = 0;
  for (const [d, ps] of Object.entries(PD)) {
    let s = 0;
    for (const p of ps) {
      const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      s += 8 * Math.min(2, (t.match(re) ?? []).length) + Math.min(3, (c.match(re) ?? []).length);
    }
    if (s > pm) {
      pm = s;
      melhor = d;
    }
  }
  return melhor;
}
function esquema() {
  const ORIGEM = join(COFRE, 'Supabase-fabrica', 'SUPA - Esquema do Banco.md');
  const texto = readFileSync(ORIGEM, 'utf8');
  if (!/^## Tabela `clientes`/m.test(texto)) throw new Error('o esquema já foi dividido');
  const linhas = texto.split('\n');
  const acha = (re) => {
    const i = linhas.findIndex((l) => re.test(l));
    if (i < 0) throw new Error('não achei ' + re);
    return i;
  };
  const iInteg = acha(/^## Tabela `clientes`/);
  const iPlt = acha(/^## Tabelas da Plataforma de Produção/);
  const iNao = acha(/^## O que NÃO existe/);
  const iVer = acha(/^## Ver também/);
  const iM22 = acha(/^## ⭐ Migration 22/);
  const preambulo = linhas.slice(0, iInteg).join('\n').replace(/\s+$/, '');
  const naoExiste = linhas.slice(iNao, iVer).join('\n').replace(/\s+$/, '');
  const verTambem = linhas.slice(iVer, iM22).join('\n').replace(/\n---\s*$/, '').replace(/\s+$/, '');
  const blocos = [];
  // 1) integração: seções "## " inteiras, antes e depois do bloco plt
  const secoes = (de, ate) => {
    let atual = null;
    for (let i = de; i < ate; i++) {
      if (/^## /.test(linhas[i])) {
        if (atual) blocos.push(atual);
        atual = { chave: 'integracao-tiny', linhas: [] };
      }
      if (/^---\s*$/.test(linhas[i])) continue; // separadores entre as seções do fim
      atual.linhas.push(linhas[i]);
    }
    if (atual) blocos.push(atual);
  };
  secoes(iInteg, iPlt);
  // 2) plt: a abertura (até a 1ª linha em negrito de sessão) é a visão geral; depois, blocos
  const ehNovoTopo = (l) => /^- (?:A )?\*\*(?:\d+ `|`?\d{14}_|SESSAO-|Ajuste|Edge Function)/.test(l);
  let atual = { chave: null, linhas: [] };
  const fechar = () => {
    if (atual.linhas.some((x) => x.trim())) blocos.push(atual);
  };
  let vazioAntes = false;
  for (let i = iPlt; i < iNao; i++) {
    const l = linhas[i];
    const topoNegrito = /^\*\*/.test(l) || /^> \[!/.test(l);
    const novo = i > iPlt && ((topoNegrito && vazioAntes) || ehNovoTopo(l));
    if (novo) {
      fechar();
      atual = { chave: null, linhas: [] };
    }
    atual.linhas.push(l);
    vazioAntes = !l.trim();
  }
  fechar();
  secoes(iM22, linhas.length);
  let primeiroPlt = true;
  for (const b of blocos) {
    while (b.linhas.length && !b.linhas.at(-1).trim()) b.linhas.pop();
    while (b.linhas.length && !b.linhas[0].trim()) b.linhas.shift();
    b.texto = b.linhas.join('\n');
    if (!b.chave) {
      if (primeiroPlt && b.texto.startsWith('**') && b.texto.includes('SESSAO-')) primeiroPlt = false;
      const manual = DOMINIO_MANUAL.find(([trecho]) => b.texto.slice(0, 200).includes(trecho));
      b.chave = primeiroPlt ? 'plataforma' : manual ? manual[1] : classificarDominio(b.texto);
    }
  }
  const notas = empacotar(blocos, 21000);
  const idsDe = (t) => new Set(t.match(/`[A-Za-z_][\w.]*(?:\([^`]*\))?`/g) ?? []);
  if (ensaio) {
    for (const n of notas) console.log(`${DOMINIOS[n.chave]}${n.parte ? ' ' + n.parte : ''}: ${n.blocos.length} blocos · ${kb(n.blocos.reduce((s, b) => s + bytes(b.texto), 0))}`);
    console.log('blocos:', blocos.length, '· maior:', kb(Math.max(...blocos.map((b) => bytes(b.texto)))));
    if (process.argv.includes('--lista')) for (const b of blocos) console.log(b.chave.padEnd(17), kb(bytes(b.texto)).padStart(8), b.texto.slice(0, 110).replace(/\n/g, ' '));
    return;
  }
  const arquivos = [];
  for (const n of notas) {
    const nome = `Banco - ${DOMINIOS[n.chave]}${n.parte ? ' ' + n.parte : ''}`;
    const cab = `---\ntitulo: "Banco — ${DOMINIOS[n.chave]}${n.parte ? ` (parte ${n.parte} de ${n.deQuantas})` : ''}"\ntipo: esquema-dominio\ndominio: ${n.chave}\natualizado: ${HOJE}\ntags: [supabase, banco-de-dados, esquema, dominio/${n.chave}]\n---\n\n# 🧬 ${nome}\n\n> Parte do esquema do banco, movida de [[SUPA - Esquema do Banco]] em 18/11/2026 sem reescrever (os blocos estão na ordem em que foram escritos — do mais antigo ao mais novo). **Os nomes de tabela, coluna e função saem daqui, nunca de memória.** Mudou o banco → o bloco novo entra no fim da nota do domínio.\n\n`;
    const caminho = join(COFRE, 'Supabase-fabrica', 'Banco', nome + '.md');
    gravar(caminho, cab + n.blocos.map((b) => b.texto).join('\n\n') + '\n');
    arquivos.push(caminho);
  }
  const soma = provar(blocos, arquivos);
  const antes = idsDe(linhas.slice(iInteg, iNao).join('\n') + '\n' + linhas.slice(iM22).join('\n'));
  const depois = idsDe(arquivos.map((a) => readFileSync(a, 'utf8')).join('\n'));
  const perdidos = [...antes].filter((x) => !depois.has(x));
  if (perdidos.length) throw new Error('nomes perdidos: ' + perdidos.slice(0, 10).join(' '));
  const indice =
    preambulo.replace(/^atualizado: .*$/m, `atualizado: ${HOJE}`) +
    `\n\n> [!info] ↪️ 18/11/2026 (SESSAO-49) — este arquivo virou o ÍNDICE
> O esquema mora agora em \`Supabase-fabrica/Banco/\`, **uma nota por domínio**, com o texto original intacto. **Antes de qualquer SQL:** ache a tabela na lista abaixo (ou procure o nome com a busca nessa pasta) e leia a nota do domínio — não este índice inteiro. Alterou o banco → o bloco novo entra **na nota do domínio**. A lista abaixo é gerada por \`node scripts/cofre/verificar.mjs --gerar\`.

<!-- gerado:inicio -->
<!-- gerado:fim -->

${naoExiste}

${verTambem}
`;
  writeFileSync(ORIGEM, indice);
  console.log(`esquema dividido: ${blocos.length} blocos em ${notas.length} notas · ${kb(soma)} movidos · ${antes.size} nomes entre crases antes, ${depois.size} depois (nenhum perdido)`);
}

// ───────────────────────────── LEI ─────────────────────────────
function lei() {
  const ORIGEM = join(COFRE, 'Plataforma', 'PLT - Lei de Desempenho e Escala.md');
  const texto = readFileSync(ORIGEM, 'utf8');
  const linhas = texto.split('\n');
  const i14 = linhas.findIndex((l) => /^## 14\. /.test(l));
  const iFontes = linhas.findIndex((l) => /^## Fontes/.test(l));
  if (i14 < 0 || iFontes < 0 || iFontes - i14 < 20) throw new Error('a lei já foi dividida (ou mudou de forma)');
  const titulo14 = linhas[i14];
  const blocos = [];
  let atual = { linhas: [] };
  for (let i = i14 + 1; i < iFontes; i++) {
    if (/^\*\*Andamento \(/.test(linhas[i])) {
      blocos.push(atual);
      atual = { linhas: [] };
    }
    atual.linhas.push(linhas[i]);
  }
  blocos.push(atual);
  for (const b of blocos) {
    while (b.linhas.length && !b.linhas.at(-1).trim()) b.linhas.pop();
    while (b.linhas.length && !b.linhas[0].trim()) b.linhas.shift();
    b.texto = b.linhas.join('\n');
    b.chave = 'dividas';
  }
  const notas = empacotar(blocos, 24000);
  if (ensaio) {
    for (const n of notas) console.log(`parte ${n.parte}: ${n.blocos.length} blocos · ${kb(n.blocos.reduce((s, b) => s + bytes(b.texto), 0))} · começa em: ${n.blocos[0].texto.slice(0, 70)}`);
    return;
  }
  const arquivos = [];
  const nomes = notas.map((n) => `PLT - Lei de Desempenho - Dividas e Andamento${n.parte ? ' ' + n.parte : ''}`);
  notas.forEach((n, k) => {
    const cab = `---\ntitulo: "Lei de Desempenho — as dívidas registradas e o andamento${n.parte ? ` (parte ${n.parte} de ${n.deQuantas})` : ''}"\ntipo: lei-dividas\natualizado: ${HOJE}\ntags: [plataforma, desempenho, dividas]\n---\n\n# ⚡ ${nomes[k]}\n\n> O §14 de [[PLT - Lei de Desempenho e Escala]], movido em 18/11/2026 sem reescrever: a tabela das dívidas e o andamento de cada sessão, em ordem de data. **Dívida nova e andamento novo entram no fim da última parte.**${notas.length > 1 ? ' Partes: ' + nomes.map((x) => `[[${x}]]`).join(' · ') + '.' : ''}\n\n${k === 0 ? titulo14 + '\n\n' : ''}`;
    const caminho = join(COFRE, 'Plataforma', nomes[k] + '.md');
    gravar(caminho, cab + n.blocos.map((b) => b.texto).join('\n\n') + '\n');
    arquivos.push(caminho);
  });
  const soma = provar(blocos, arquivos);
  const nova =
    linhas.slice(0, i14).join('\n').replace(/^atualizado: .*$/m, `atualizado: ${HOJE}`) +
    `${titulo14}\n\n> ↪️ **18/11/2026 (SESSAO-49):** a tabela das dívidas e o andamento de cada sessão saíram daqui, sem reescrever, para ${nomes.map((x) => `[[${x}]]`).join(' · ')}. O checklist do §12 está também, resumido, em [[000 - REGRAS DE OURO]]. Sessão que tocar desempenho lê esta lei (a parte fixa) e registra dívida e andamento **na última parte**.\n\n` +
    linhas.slice(iFontes).join('\n');
  writeFileSync(ORIGEM, nova);
  console.log(`lei dividida: ${blocos.length} blocos do §14 em ${notas.length} notas · ${kb(soma)} movidos · a lei ficou com ${kb(bytes(nova))}`);
}

// ───────────────────────────── MODELO DE SISTEMA ─────────────────────────────
const DESIGN = {
  fundamentos: 'Fundamentos Tokens e Componentes Base',
  kanban: 'Kanban Execucao e Qualidade',
  painel: 'Meu Painel Chat Automacoes e Tech',
  navegacao: 'Navegacao Menu Cabecalho e Perfil',
  logistica: 'Logistica ROTAS e Pedidos',
  estoque: 'Estoque e PCP',
};
function grupoDesign(h2, h3) {
  const t = semAcento(h3 || h2).toLowerCase();
  if (!h3 || /^## [^4]/.test(h2)) return 'fundamentos';
  if (/<botao>|<campo>|<selecao>|<modal>|<badgeestado>|provedornotificacao|lei de requisic|<tabela>/.test(t)) return 'fundamentos';
  if (/meu painel|chat|automac|tech|bloco noturno/.test(t)) return 'painel';
  if (/navegac|menu lateral|cabecalho|aplicativo|versao nova|busca geral/.test(t)) return 'navegacao';
  if (/estoque|observacao do item/.test(t)) return 'estoque';
  if (/logistica|rotas|pedidos|calendario|entrega parcial|tablet que nao cai/.test(t)) return 'logistica';
  return 'kanban';
}
function modelo() {
  const ORIGEM = join(COFRE, 'Plataforma', 'PLT - Modelo de Sistema.md');
  const texto = readFileSync(ORIGEM, 'utf8');
  const linhas = texto.split('\n');
  const ini = linhas.findIndex((l) => /^## 1\. /.test(l));
  if (ini < 0) throw new Error('o modelo de sistema já foi dividido');
  const preambulo = linhas.slice(0, ini).join('\n').replace(/\s+$/, '');
  const blocos = [];
  let h2 = '';
  let atual = null;
  let emCodigo = false;
  for (let i = ini; i < linhas.length; i++) {
    const l = linhas[i];
    if (/^\s*```/.test(l)) emCodigo = !emCodigo;
    const eh2 = !emCodigo && /^## /.test(l);
    const eh3 = !emCodigo && /^### /.test(l);
    if (eh2 || eh3) {
      if (atual) blocos.push(atual);
      if (eh2) h2 = l;
      atual = { h2, h3: eh3 ? l : '', linhas: [] };
    }
    atual.linhas.push(l);
  }
  blocos.push(atual);
  for (const b of blocos) {
    while (b.linhas.length && !b.linhas.at(-1).trim()) b.linhas.pop();
    b.texto = b.linhas.join('\n');
    b.chave = grupoDesign(b.h2, b.h3);
  }
  const notas = empacotar(blocos, 23000);
  if (ensaio) {
    for (const n of notas) console.log(`${DESIGN[n.chave]}${n.parte ? ' ' + n.parte : ''}: ${n.blocos.length} blocos · ${kb(n.blocos.reduce((s, b) => s + bytes(b.texto), 0))}`);
    for (const b of blocos) console.log('  ', b.chave.padEnd(11), kb(bytes(b.texto)).padStart(8), (b.h3 || b.h2).slice(0, 90));
    return;
  }
  const arquivos = [];
  const lista = [];
  for (const n of notas) {
    const nome = `Design - ${DESIGN[n.chave]}${n.parte ? ' ' + n.parte : ''}`;
    const cab = `---\ntitulo: "Modelo de sistema — ${DESIGN[n.chave]}${n.parte ? ` (parte ${n.parte} de ${n.deQuantas})` : ''}"\ntipo: design\nassunto: ${n.chave}\natualizado: ${HOJE}\ntags: [plataforma, design-system, modelo-de-sistema, design/${n.chave}]\n---\n\n# 🧩 ${nome}\n\n> Parte de [[PLT - Modelo de Sistema]], movida em 18/11/2026 sem reescrever (a numeração das seções é a do documento original). Padrão novo deste assunto entra **aqui**.\n\n`;
    const caminho = join(COFRE, 'Plataforma', 'Design', nome + '.md');
    gravar(caminho, cab + n.blocos.map((b) => b.texto).join('\n\n') + '\n');
    arquivos.push(caminho);
    lista.push(`- [[${nome}]] — ${n.blocos.map((b) => (b.h3 || b.h2).replace(/^#+\s*/, '').replace(/`/g, '').replace(/\s*[—(].*$/, '').trim()).filter((x, i, a) => a.indexOf(x) === i).join(' · ')}`);
  }
  const soma = provar(blocos, arquivos);
  const indice =
    preambulo.replace(/^atualizado: .*$/m, `atualizado: ${HOJE}`) +
    `\n\n> [!info] ↪️ 18/11/2026 (SESSAO-49) — este arquivo virou o ÍNDICE
> O modelo de sistema mora agora em \`Plataforma/Design/\`, dividido por assunto, com o texto original intacto. O essencial de uma página (cores, componentes que existem, regras de tela) está em [[000 - REGRAS DE OURO]]. **Tela nova:** leia as Regras de Ouro e só a nota do assunto que a tela toca.

## Onde está cada assunto

${lista.join('\n')}
`;
  writeFileSync(ORIGEM, indice);
  console.log(`modelo de sistema dividido: ${blocos.length} blocos em ${notas.length} notas · ${kb(soma)} movidos`);
}

const acao = { memoria, esquema, lei, modelo }[qual];
if (acao) acao();
else console.log('uso: dividir-notas.mjs <memoria|esquema|lei|modelo> [--ensaio]');
