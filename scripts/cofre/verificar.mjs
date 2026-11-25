#!/usr/bin/env node
// O guarda-costas do cofre (SESSAO-49). Node puro, sem dependência. Roda no fim de TODA sessão.
//
//   node scripts/cofre/verificar.mjs                 confere tudo (sai com erro se houver ❌)
//   node scripts/cofre/verificar.mjs --gerar         regenera os índices e as listas dos mapas
//   node scripts/cofre/verificar.mjs --ligar         transforma citação de id (D-61, E-19…) em ligação
//   node scripts/cofre/verificar.mjs --leitura "<demanda>"   soma o que a sessão lê antes de codar
//   node scripts/cofre/verificar.mjs --detalhe       lista nota por nota o que os avisos resumem
import { writeFileSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { COFRE, RAIZ, kb, ligacoes, montarIndice, resolver, frontmatter, titulos } from './lib.mjs';
import { carregar, normId, RE_ID, SEM_DECISAO, ligacaoDe, manchete, tabelasDoBanco } from './cofre.mjs';
import { AREAS, classificarArea } from './areas.mjs';

const args = process.argv.slice(2);
const tem = (f) => args.includes(f);
const INI = '<!-- gerado:inicio -->';
const FIM = '<!-- gerado:fim -->';

// ───────────── orçamentos (bytes) ─────────────
const KB = 1024;
const TETO = { camada1: 40 * KB, regras: 30 * KB, claude: 10 * KB, mapa: 15 * KB, indice: 60 * KB, atomica: 8 * KB, tematica: 30 * KB, demanda: 25 * KB, handoff: 15 * KB, diario: 30 * KB, leitura: 150 * KB };
const INDICES = ['Plataforma/PLT - Decisoes de Produto.md', 'Plataforma/PLT - Memoria de Aprendizado.md', 'Supabase-fabrica/SUPA - Esquema do Banco.md'];
function classe(rel) {
  if (rel === '000 - REGRAS DE OURO.md') return 'regras';
  if (INDICES.includes(rel)) return 'indice';
  if (rel.startsWith('Mapas/') || rel === '000 - MAPA DO PROJETO.md') return 'mapa';
  if (rel.startsWith('Plataforma/Decisoes/')) return 'atomica';
  if (/^(Plataforma\/(Memoria|Design)|Supabase-fabrica\/Banco)\//.test(rel) || /^Plataforma\/PLT - Lei de Desempenho/.test(rel)) return 'tematica';
  if (/^Plataforma\/Demandas\/(SESSAO|AJUSTE)/.test(rel)) return 'demanda';
  if (rel.startsWith('Handoffs/')) return 'handoff';
  if (rel.startsWith('Plataforma/Execucao/') && rel.endsWith('.md')) return 'diario';
  return null;
}
/** Escrito depois da dieta (18/11/2026)? Só esses são cobrados nos tetos de demanda/handoff/diário. */
function depoisDaDieta(rel) {
  const d = /(\d{4})_(\d{2})_(\d{2})/.exec(rel);
  if (d) return `${d[1]}-${d[2]}-${d[3]}` >= '2026-11-18';
  const s = /SESSAO-(\d+)/.exec(rel);
  return s ? +s[1] === 49 || +s[1] >= 52 : false;
}

// ───────────── escopo das ligações de id (as notas vivas da dieta) ─────────────
const SOLTAS_NO_ESCOPO = new Set(['000 - REGRAS DE OURO.md', '000 - MAPA DO PROJETO.md', 'CLAUDE.md', ...INDICES, 'Plataforma/PLT - Modelo de Sistema.md', 'Plataforma/PLT - Perguntas em Aberto.md', 'Plataforma/PLT - Requisitos.md', 'Plataforma/PLT - Visao Geral.md', 'Plataforma/CLAUDE - Regras do Claude Code (repo).md', 'Planejamento/000 - PROXIMOS PASSOS.md', 'Plataforma/Demandas/000 - ORDEM DAS SESSOES.md']);
function noEscopo(n) {
  if (n.historia) return false;
  const r = n.rel;
  return SOLTAS_NO_ESCOPO.has(r) || /^(Mapas|Templates|Plataforma\/(Decisoes|Memoria|Design|Demandas)|Supabase-fabrica\/Banco)\//.test(r) || /^Plataforma\/PLT - Lei de Desempenho/.test(r);
}

// ───────────── transformar citação em ligação ─────────────
const PROTEGIDO = /(`[^`\n]*`|!?\[\[[^\]\n]*\]\]|\[[^\]\n]*\]\([^)\n]*\)|<!--.*?-->|https?:\/\/\S+)/g;
const desligar = (t) => t.replace(/\[\[[^\]|\n]+?\\?\|([DEAMFX]-\d+)\]\]/g, '$1');
function ligarTexto(c, nota) {
  const texto = nota.texto;
  const fmFim = texto.startsWith('---\n') ? texto.indexOf('\n---\n', 4) + 5 : 0;
  const cab = texto.slice(0, fmFim);
  const linhas = texto.slice(fmFim).split('\n');
  const decisaoDaNota = nota.rel.startsWith('Plataforma/Decisoes/') ? normId(frontmatter(texto).fm?.id ?? '') : '';
  let proprio = decisaoDaNota;
  let vistos = new Set();
  let emCodigo = false;
  let emGerado = false;
  let ligadas = 0;
  const semNota = [];
  const saida = linhas.map((linha) => {
    if (/^\s*(```|~~~)/.test(linha)) {
      emCodigo = !emCodigo;
      return linha;
    }
    if (linha.includes(INI)) emGerado = true;
    if (linha.includes(FIM)) emGerado = false;
    if (emCodigo || emGerado) return linha;
    const h = /^#{1,6}\s+(.*)$/.exec(linha);
    if (h) {
      vistos = new Set();
      const m = /^([EAMFX]-\d+)\s*$/.exec(h[1]);
      proprio = m ? normId(m[1]) : decisaoDaNota;
      return linha;
    }
    for (const m of linha.matchAll(/\|([DEAMFX]-\d+)\]\]/g)) vistos.add(normId(m[1]));
    const tabela = /^\s*\|/.test(linha);
    return linha
      .split(PROTEGIDO)
      .map((trecho, i) => {
        if (i % 2 === 1) return trecho; // protegido
        return trecho.replace(RE_ID, (escrito) => {
          const id = normId(escrito);
          if (id === proprio || vistos.has(id)) return escrito;
          const lig = ligacaoDe(c, escrito, tabela);
          if (!lig) {
            if (!SEM_DECISAO[id]) semNota.push(id);
            return escrito;
          }
          vistos.add(id);
          ligadas++;
          return lig;
        });
      })
      .join('');
  });
  return { texto: cab + saida.join('\n'), ligadas, semNota };
}

// ───────────── os blocos gerados ─────────────
const curto = (t, max) => (t.length > max ? t.slice(0, t.lastIndexOf(' ', max)) + '…' : t).replace(/\|/g, '/');
const marca = (d) => (d.status === 'provisoria' ? ' ⏳' : '');
const linhaDecisao = (d, max = 96) => `- [[${d.nome}|${d.id}]] · ${curto(d.titulo, max)}${marca(d)}`;
const porNumero = (a, b) => a.n - b.n;
const comPrefixo = (c, pasta, prefixos) => c.notas.filter((n) => n.rel.startsWith(pasta) && prefixos.some((p) => n.nome.includes(p))).map((n) => `[[${n.nome}]]`);

function gerarIndiceDecisoes(c) {
  const todas = [...c.decisoes.values()].sort(porNumero);
  const max = Math.max(...todas.map((d) => d.n));
  const vagos = [];
  for (let i = 1; i < max; i++) if (!c.decisoes.has('D-' + i)) vagos.push(i);
  const faixas = [];
  for (const v of vagos) {
    const u = faixas.at(-1);
    if (u && u[1] === v - 1) u[1] = v;
    else faixas.push([v, v]);
  }
  const vivas = todas.filter((d) => d.status !== 'revisada');
  let s = `## As decisões, por área\n\n**${todas.length} decisões** · ${todas.filter((d) => d.status === 'vigente').length} vigentes · ${todas.filter((d) => d.status === 'provisoria').length} provisórias ⏳ (valem até o dono dizer o contrário) · ${todas.filter((d) => d.status === 'revisada').length} revisadas por outra. **Próxima livre: D-${max + 1}.** A área é a principal da decisão; o mapa de cada área (\`Mapas/\`) lista também as que a tocam de lado.\n`;
  for (const [chave, a] of Object.entries(AREAS)) {
    const lista = vivas.filter((d) => d.area[0] === chave);
    if (!lista.length) continue;
    s += `\n### ${a.titulo} (${lista.length}) — [[MOC - ${a.nome}]]\n\n${lista.map((d) => linhaDecisao(d)).join('\n')}\n`;
  }
  const rev = todas.filter((d) => d.status === 'revisada');
  s += `\n### Revisadas por outra decisão (${rev.length}) — ficam para a história; vale a que revisou\n\n${rev.map((d) => `- [[${d.nome}|${d.id}]] · ${curto(d.titulo, 70)}${d.revisadaPor.length ? ' → ' + d.revisadaPor.map((r) => (c.decisoes.get(r) ? `[[${c.decisoes.get(r).nome}|${r}]]` : r)).join(', ') : ''}`).join('\n')}\n`;
  s += `\n### Números sem decisão\n\n${faixas.map(([a, b]) => (a === b ? `D-${a}` : `D-${a}…D-${b}`)).join(' · ')} — reservados por sessões em paralelo e nunca usados; não existe texto para eles.${Object.entries(SEM_DECISAO).map(([id, por]) => ` ${id}: ${por}.`).join('')}\n`;
  return s;
}

function gerarIndiceMemoria(c) {
  const letras = { E: 'erros', A: 'acertos', M: 'modelos mentais', F: 'fórmulas', X: 'possibilidades' };
  const todas = [...c.licoes.values()];
  const prox = Object.keys(letras).map((L) => `${L}-${Math.max(0, ...todas.filter((l) => l.letra === L).map((l) => l.n)) + 1}`);
  let s = `## As lições, por tema\n\n**${todas.length} entradas** · ${Object.entries(letras).map(([L, nome]) => `${todas.filter((l) => l.letra === L).length} ${nome}`).join(' · ')}. **Próximos livres: ${prox.join(' · ')}.**\n`;
  const notas = c.notas.filter((n) => n.rel.startsWith('Plataforma/Memoria/')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { numeric: true }));
  for (const n of notas) {
    const lista = todas.filter((l) => l.nota === n);
    s += `\n### [[${n.nome}]] (${lista.length})\n\n${lista.map((l) => `- [[${n.nome}#${l.id}|${l.id}]] · ${manchete(l.texto, 64)}`).join('\n')}\n`;
  }
  return s;
}

function gerarIndiceEsquema(c) {
  const notas = c.notas.filter((n) => n.rel.startsWith('Supabase-fabrica/Banco/')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { numeric: true }));
  const tabelas = tabelasDoBanco();
  let s = `## As notas do banco, por domínio\n\n${notas.map((n) => `- [[${n.nome}]] (${kb(n.bytes)})`).join('\n')}\n`;
  if (!tabelas.length) return s + '\n> As migrations do repositório não estão nesta pasta — a lista "tabela → nota" não pôde ser gerada.\n';
  const semNota = [];
  const linhas = [];
  for (const t of tabelas) {
    // conta o nome escrito como código (`tabela` ou `tabela.coluna`); a nota que tem o título "Tabela `x`" é a casa dela
    const re = new RegExp('`(?:public\\.)?' + t + '(?![\\w])', 'g');
    const casa = new RegExp('^#+ .*Tabela `' + t + '`', 'm');
    const onde = notas.map((n) => ({ n, k: (n.texto.match(re) ?? []).length + (casa.test(n.texto) ? 1000 : 0) })).filter((x) => x.k).sort((a, b) => b.k - a.k);
    if (!onde.length) semNota.push(t);
    else linhas.push(`- \`${t}\` → [[${onde[0].n.nome}]]${onde.length > 1 ? ` · também em ${onde.slice(1, 4).map((x) => `[[${x.n.nome}]]`).join(', ')}${onde.length > 4 ? ` e mais ${onde.length - 4}` : ''}` : ''}`);
  }
  s += `\n## Tabela → nota (${tabelas.length} tabelas criadas pelas migrations do repositório e pelo esquema-base)\n\nA primeira nota é a que mais fala da tabela. Função, porta e gatilho: procure o nome na pasta \`Supabase-fabrica/Banco/\`.\n\n${linhas.join('\n')}\n`;
  if (semNota.length) s += `\n**Tabelas que existem nas migrations e nenhuma nota cita (${semNota.length}):** ${semNota.map((t) => '`' + t + '`').join(' · ')} — documentar na nota do domínio quando a sessão tocar nelas.\n`;
  return s;
}

const ONDE_LER = {
  'kanban-producao': { banco: ['Cards e Eventos', 'Setores Etapas', 'Plataforma - Visao Geral'], memoria: ['Regras de Negocio', 'Front Telas'], design: ['Kanban Execucao'] },
  pcp: { banco: ['PCP e Liberacao'], memoria: ['Regras de Negocio'], design: ['Estoque e PCP'] },
  estoque: { banco: ['Estoque e Reposicao'], memoria: ['Regras de Negocio'], design: ['Estoque e PCP'] },
  expedicao: { banco: ['Expedicao Devolucao'], memoria: ['Regras de Negocio'], design: ['Logistica ROTAS'] },
  'logistica-rotas': { banco: ['Logistica ROTAS'], memoria: ['Regras de Negocio'], design: ['Logistica ROTAS'] },
  'tiny-n8n': { banco: ['Integracao Tiny', 'Filas e Integracoes'], memoria: ['Tiny n8n'], design: [] },
  'tablet-tv': { banco: ['Tablet e TV'], memoria: ['Regras de Negocio', 'Front Telas'], design: ['Kanban Execucao', 'Navegacao Menu'] },
  'tempos-paineis': { banco: ['Tempos e Paineis'], memoria: ['Regras de Negocio', 'Desempenho'], design: ['Kanban Execucao'] },
  comercial: { banco: ['Banco - Comercial'], memoria: ['Tiny n8n'], design: [] },
  'acesso-usuarios': { banco: ['Usuarios Acesso'], memoria: ['Acesso Seguranca'], design: ['Navegacao Menu'] },
  'auditoria-logs': { banco: ['Usuarios Acesso'], memoria: ['Acesso Seguranca'], design: ['Meu Painel Chat'] },
  'publicacao-infra': { banco: ['Plataforma - Visao Geral'], memoria: ['Publicacao Vercel', 'Migrations Aplicador', 'Banco e SQL', 'Desempenho', 'Git Shell', 'Testes e Validacao'], design: [] },
  'painel-chat-automacoes': { banco: ['Chat Tarefas'], memoria: ['Regras de Negocio', 'Front Telas'], design: ['Meu Painel Chat'] },
  interface: { banco: [], memoria: ['Front Telas', 'Testes e Validacao'], design: ['Design - '] },
  processo: { banco: [], memoria: ['Processo de Sessao', 'Git Shell', 'Modelos Formulas'], design: [] },
};
// compacto = as provisórias só com a ligação (sem o título), quando o mapa com os títulos passaria do teto
// (subida de 25/11: a Logística passou de 50 provisórias; o título de cada uma está no índice das decisões)
function gerarMapa(c, area, compacto = false) {
  const todas = [...c.decisoes.values()].filter((d) => d.area.includes(area)).sort(porNumero);
  const vig = todas.filter((d) => d.status === 'vigente');
  const prov = todas.filter((d) => d.status === 'provisoria');
  const rev = todas.filter((d) => d.status === 'revisada');
  const o = ONDE_LER[area];
  const lista = (rotulo, itens) => (itens.length ? `- **${rotulo}:** ${itens.join(' · ')}\n` : '');
  let s = `## Decisões vigentes (${vig.length})\n\n${vig.map((d) => linhaDecisao(d, 88)).join('\n') || '—'}\n`;
  if (prov.length && compacto) s += `\n## Provisórias ⏳ — valem até o dono dizer o contrário (${prov.length})\n\nCom os títulos o mapa passaria do teto: o título de cada uma está em [[PLT - Decisoes de Produto]].\n\n${prov.map((d) => `[[${d.nome}|${d.id}]]`).join(' · ')}\n`;
  else if (prov.length) s += `\n## Provisórias ⏳ — valem até o dono dizer o contrário (${prov.length})\n\n${prov.map((d) => `- [[${d.nome}|${d.id}]] · ${curto(d.titulo, 88)}`).join('\n')}\n`;
  if (rev.length) s += `\n## Revisadas por outra (${rev.length}) — só para a história\n\n${rev.map((d) => `[[${d.nome}|${d.id}]]`).join(' · ')}\n`;
  s += `\n## Onde mais ler (só o que a demanda tocar)\n\n${lista('Banco', comPrefixo(c, 'Supabase-fabrica/Banco/', o.banco))}${lista('Lições', comPrefixo(c, 'Plataforma/Memoria/', o.memoria))}${lista('Design', comPrefixo(c, 'Plataforma/Design/', o.design))}`;
  return s;
}

function blocoPara(c, nota) {
  if (nota.rel === INDICES[0]) return gerarIndiceDecisoes(c);
  if (nota.rel === INDICES[1]) return gerarIndiceMemoria(c);
  if (nota.rel === INDICES[2]) return gerarIndiceEsquema(c);
  if (nota.rel.startsWith('Mapas/')) {
    const area = frontmatter(nota.texto).fm?.area;
    if (area && AREAS[area]) {
      const cheio = gerarMapa(c, area);
      const comCheio = comBloco(nota.texto, cheio);
      return comCheio && Buffer.byteLength(comCheio, 'utf8') > TETO.mapa ? gerarMapa(c, area, true) : cheio;
    }
  }
  return null;
}
function comBloco(texto, bloco) {
  const a = texto.indexOf(INI);
  const b = texto.indexOf(FIM);
  if (a < 0 || b < a) return null;
  return texto.slice(0, a + INI.length) + '\n' + bloco.trimEnd() + '\n' + texto.slice(b);
}

// ───────────── --leitura ─────────────
function leitura(c, alvo) {
  const ind = montarIndice(c.arquivos);
  const nota = c.notas.find((n) => n.abs === alvo || n.rel === alvo || n.nome === basename(alvo, '.md') || n.rel.endsWith(alvo.replace(/\\/g, '/')));
  if (!nota) {
    console.error('demanda não encontrada no cofre:', alvo);
    process.exit(2);
  }
  const itens = [];
  const claude = join(RAIZ, 'CLAUDE.md');
  itens.push(['camada 1 · CLAUDE.md da raiz', existsSync(claude) ? statSync(claude).size : 0]);
  itens.push(['camada 1 · 000 - REGRAS DE OURO', c.notas.find((n) => n.rel === '000 - REGRAS DE OURO.md')?.bytes ?? 0]);
  itens.push([`a demanda · ${nota.nome}`, nota.bytes]);
  const linhas = nota.texto.split('\n');
  const i = linhas.findIndex((l) => /^##+ .*Leitura da sessão/i.test(l));
  const vistas = new Set([nota.rel]);
  const somar = (rel, rotulo) => {
    if (vistas.has(rel)) return;
    vistas.add(rel);
    const n = c.arquivos.find((a) => a.rel === rel);
    if (n) itens.push([rotulo + n.rel.replace(/\.md$/, ''), n.bytes]);
  };
  if (i >= 0) {
    let j = i + 1;
    while (j < linhas.length && !/^## /.test(linhas[j])) j++;
    for (const l of ligacoes(linhas.slice(i + 1, j).join('\n'))) {
      const alvoRel = resolver(ind, nota.rel, l);
      if (alvoRel) somar(alvoRel, 'listada · ');
    }
  } else {
    const semFm = frontmatter(nota.texto);
    const areas = classificarArea(semFm.fm?.titulo ?? nota.nome, semFm.corpo).slice(0, 2);
    console.log(`(a demanda não tem a seção "Leitura da sessão" — estimativa pelas áreas que o texto toca: ${areas.join(', ')};\n soma o mapa de cada área e, por área, a maior nota de banco e a maior de design que o mapa aponta)`);
    for (const a of areas) {
      somar(`Mapas/MOC - ${AREAS[a].nome}.md`, 'mapa · ');
      const o = ONDE_LER[a];
      for (const [pasta, pref] of [['Supabase-fabrica/Banco/', o.banco], ['Plataforma/Design/', o.design]]) {
        const cands = c.notas.filter((n) => n.rel.startsWith(pasta) && pref.some((p) => n.nome.includes(p))).sort((x, y) => y.bytes - x.bytes);
        if (cands[0]) somar(cands[0].rel, 'do mapa · ');
      }
    }
  }
  const total = itens.reduce((s, [, b]) => s + b, 0);
  for (const [r, b] of itens) console.log(`${kb(b).padStart(10)}  ${r}`);
  console.log(`${kb(total).padStart(10)}  TOTAL — meta ≤ ${kb(TETO.leitura)} → ${total <= TETO.leitura ? '✅ dentro' : '❌ acima'}`);
  process.exit(total <= TETO.leitura ? 0 : 1);
}

// ───────────── principal ─────────────
let c = carregar();

if (tem('--leitura')) leitura(c, args[args.indexOf('--leitura') + 1] ?? '');

if (tem('--ligar')) {
  let notas = 0;
  let total = 0;
  // ligações antigas para um título do arquivo único ([[PLT - Decisoes de Produto#D-61]]): o título
  // não existe mais no índice — a ligação passa a apontar para a nota da decisão / da lição.
  let antigas = 0;
  for (const n of c.notas) {
    const novo = n.texto.replace(/\[\[PLT - (?:Decisoes de Produto|Memoria de Aprendizado)#([DEAMFX]-\d+)[^\]|\\]*(?:\\?\|([^\]]*))?\]\]/g, (tudo, id, rotulo) => {
      const lig = ligacaoDe(c, id, /\\\|/.test(tudo));
      if (!lig) return tudo;
      antigas++;
      return rotulo && rotulo !== id ? lig.replace(/\|[^|\]]*\]\]$/, '|' + rotulo + ']]') : lig;
    });
    if (novo !== n.texto) {
      writeFileSync(n.abs, novo);
      n.texto = novo;
    }
  }
  if (antigas) console.log(`--ligar: ${antigas} ligação(ões) antiga(s) para um título do arquivo único agora apontam para a nota da decisão/lição`);
  for (const n of c.notas.filter(noEscopo)) {
    const r = ligarTexto(c, n);
    if (r.texto === n.texto) continue;
    if (desligar(r.texto) !== desligar(n.texto)) throw new Error('prova falhou (o texto mudou além das ligações): ' + n.rel);
    writeFileSync(n.abs, r.texto);
    notas++;
    total += r.ligadas;
  }
  console.log(`--ligar: ${total} citações viraram ligação em ${notas} notas (texto conferido: tirando as ligações, é o mesmo de antes)`);
  c = carregar();
}

if (tem('--gerar')) {
  let k = 0;
  for (const n of c.notas) {
    const bloco = blocoPara(c, n);
    if (bloco === null) continue;
    const novo = comBloco(n.texto, bloco);
    if (novo === null) {
      console.log(`⚠️  ${n.rel}: faltam os marcadores ${INI} / ${FIM}`);
      continue;
    }
    if (novo !== n.texto) {
      writeFileSync(n.abs, novo);
      k++;
    }
  }
  console.log(`--gerar: ${k} nota(s) com a lista regenerada`);
  c = carregar();
}

const erros = [];
const avisos = [];
const detalhe = tem('--detalhe');
const ind = montarIndice(c.arquivos);

// 1) ligações e notas soltas
const chegando = new Map();
const quebradas = [];
const ancoras = new Map();
for (const n of c.notas) {
  for (const l of ligacoes(n.texto)) {
    const alvo = resolver(ind, n.rel, l);
    if (!alvo) {
      quebradas.push({ n, l });
      continue;
    }
    if (alvo !== n.rel) chegando.set(alvo, (chegando.get(alvo) ?? 0) + 1);
    if (l.ancora && alvo.endsWith('.md') && !l.ancora.startsWith('^')) {
      if (!ancoras.has(alvo)) ancoras.set(alvo, new Set(titulos(c.notas.find((x) => x.rel === alvo).texto).map((t) => t.toLowerCase())));
      const ultima = l.ancora.split('#').at(-1).toLowerCase();
      if (!ancoras.get(alvo).has(ultima)) quebradas.push({ n, l, ancora: true });
    }
  }
}
// âncora para um título que não existe: a nota abre, só não rola até o trecho — aviso, não erro
const qAncora = quebradas.filter((q) => q.ancora && !q.n.historia);
if (qAncora.length) avisos.push(`${qAncora.length} ligação(ões) em notas vivas apontam para um título que não existe dentro da nota (a nota abre; o trecho não): ${[...new Set(qAncora.map((q) => q.l.bruto))].join(' ')}${detalhe ? '\n' + qAncora.map((q) => `     ${q.n.rel}`).join('\n') : ''}`);
const qVivas = quebradas.filter((q) => !q.n.historia && !q.ancora);
for (const q of qVivas) erros.push(`ligação quebrada em nota viva: ${q.n.rel} → ${q.l.bruto}`);
const qHist = quebradas.filter((q) => q.n.historia);
if (qHist.length) avisos.push(`${qHist.length} ligação(ões) quebrada(s) em notas de história (não se reescreve)${detalhe ? ':\n' + qHist.map((q) => `     ${q.n.rel} → ${q.l.bruto}`).join('\n') : ''}`);
const soltas = c.notas.filter((n) => !chegando.has(n.rel));
for (const s of soltas.filter((n) => !n.historia)) erros.push(`nota viva solta (ninguém liga para ela): ${s.rel}`);
const sHist = soltas.filter((n) => n.historia);
if (sHist.length) avisos.push(`${sHist.length} nota(s) de história sem ninguém ligando${detalhe ? ':\n' + sHist.map((s) => `     ${s.rel}`).join('\n') : ''}`);

// 2) orçamentos
const claudeRaiz = join(RAIZ, 'CLAUDE.md');
const bClaude = existsSync(claudeRaiz) ? statSync(claudeRaiz).size : 0;
const bRegras = c.notas.find((n) => n.rel === '000 - REGRAS DE OURO.md')?.bytes ?? 0;
if (!bRegras) erros.push('falta a nota 000 - REGRAS DE OURO.md');
if (bClaude + bRegras > TETO.camada1) erros.push(`camada 1 acima do teto: ${kb(bClaude + bRegras)} > ${kb(TETO.camada1)}`);
if (bClaude > TETO.claude) erros.push(`CLAUDE.md da raiz acima do teto: ${kb(bClaude)} > ${kb(TETO.claude)}`);
const acima = { historia: [], viva: [] };
for (const n of c.notas) {
  const cl = classe(n.rel);
  if (!cl || n.bytes <= TETO[cl]) continue;
  const texto = `${n.rel} — ${kb(n.bytes)} (teto ${kb(TETO[cl])}, ${cl})`;
  if (cl === 'regras' || cl === 'mapa') erros.push('acima do teto: ' + texto);
  else if (['demanda', 'handoff', 'diario'].includes(cl) && !depoisDaDieta(n.rel)) acima.historia.push(texto);
  else acima.viva.push(texto);
}
for (const t of acima.viva) avisos.push('acima do teto: ' + t);
if (acima.historia.length) avisos.push(`${acima.historia.length} demanda(s)/handoff(s)/diário(s) de antes da dieta acima do teto de hoje (história, não se reescreve)${detalhe ? ':\n' + acima.historia.map((t) => '     ' + t).join('\n') : ''}`);

// 3) integridade das decisões
const STATUS = ['vigente', 'provisoria', 'revisada', 'substituida'];
for (const n of c.notas.filter((x) => x.rel.startsWith('Plataforma/Decisoes/'))) {
  const { fm } = frontmatter(n.texto);
  const m = /^D-(\d{3}) - /.exec(n.nome);
  if (!m) erros.push(`decisão com nome fora do padrão "D-NNN - título": ${n.rel}`);
  if (!fm?.id) {
    erros.push(`decisão sem frontmatter/id: ${n.rel}`);
    continue;
  }
  if (m && +m[1] !== +fm.id.slice(2)) erros.push(`decisão: o id do frontmatter (${fm.id}) não bate com o nome do arquivo: ${n.rel}`);
  if (!STATUS.includes(fm.status)) erros.push(`decisão com status inválido ("${fm.status}"): ${n.rel}`);
  if (fm.data && !/^\d{4}-\d{2}-\d{2}$/.test(fm.data)) erros.push(`decisão com data fora de AAAA-MM-DD: ${n.rel}`);
  const d = c.decisoes.get(normId(fm.id));
  if (!d.area.length || d.area.some((a) => !AREAS[a])) erros.push(`decisão com área desconhecida (${d.area.join(', ') || 'vazia'}): ${n.rel}`);
  if (!fm.titulo) erros.push(`decisão sem titulo no frontmatter: ${n.rel}`);
}
const idsDecisao = c.notas.filter((x) => x.rel.startsWith('Plataforma/Decisoes/')).map((x) => frontmatter(x.texto).fm?.id).filter(Boolean).map(normId);
for (const id of new Set(idsDecisao.filter((x, i) => idsDecisao.indexOf(x) !== i))) erros.push(`duas notas com a mesma decisão: ${id}`);
for (const d of c.decisoes.values()) {
  for (const r of d.revisa) {
    const o = c.decisoes.get(r);
    if (!o) erros.push(`${d.id} diz que revisa ${r}, que não existe`);
    else if (!o.revisadaPor.includes(d.id)) erros.push(`${d.id} revisa ${r}, mas ${r} não tem ${d.id} em revisada_por`);
  }
  for (const r of d.revisadaPor) {
    const o = c.decisoes.get(r);
    if (!o) erros.push(`${d.id} diz que foi revisada por ${r}, que não existe`);
    else if (!o.revisa.includes(d.id)) erros.push(`${d.id} tem ${r} em revisada_por, mas ${r} não tem ${d.id} em revisa`);
  }
}
for (const id of new Set(c.repetidas)) erros.push(`lição repetida em duas notas de tema: ${id}`);

// 4) citações de id nas notas vivas da dieta: existem? viraram ligação?
const inexistentes = new Map();
let semLigacao = 0;
const notasSemLigacao = [];
for (const n of c.notas.filter(noEscopo)) {
  const r = ligarTexto(c, n);
  for (const id of r.semNota) {
    if (!inexistentes.has(id)) inexistentes.set(id, new Set());
    inexistentes.get(id).add(n.rel);
  }
  if (r.ligadas) {
    semLigacao += r.ligadas;
    notasSemLigacao.push(`${n.rel} (${r.ligadas})`);
  }
}
if (semLigacao) avisos.push(`${semLigacao} citação(ões) de id ainda como texto em ${notasSemLigacao.length} nota(s) viva(s) — rode --ligar${detalhe ? ':\n' + notasSemLigacao.map((t) => '     ' + t).join('\n') : ''}`);
if (inexistentes.size) avisos.push(`${inexistentes.size} id(s) citado(s) nas notas vivas que não existem como decisão nem lição (número pulado ou erro de digitação): ${[...inexistentes.keys()].sort().join(' ')}${detalhe ? '\n' + [...inexistentes].map(([id, onde]) => `     ${id}: ${[...onde].slice(0, 3).join(' · ')}`).join('\n') : ''}`);

// 5) os blocos gerados estão em dia?
for (const n of c.notas) {
  const bloco = blocoPara(c, n);
  if (bloco === null) continue;
  const novo = comBloco(n.texto, bloco);
  if (novo === null) erros.push(`faltam os marcadores do bloco gerado: ${n.rel}`);
  else if (novo !== n.texto) erros.push(`lista gerada desatualizada: ${n.rel} — rode --gerar`);
}
for (const [chave, a] of Object.entries(AREAS)) if (!c.notas.some((n) => n.rel === `Mapas/MOC - ${a.nome}.md`)) erros.push(`falta o mapa da área ${chave}: Mapas/MOC - ${a.nome}.md`);

// ───────────── relatório ─────────────
const licoes = [...c.licoes.values()];
const conta = (L) => licoes.filter((l) => l.letra === L).length;
const total = (pasta) => c.notas.filter((n) => n.rel.startsWith(pasta));
console.log('── Cofre Domoby · verificação ──');
console.log(`notas: ${c.notas.length} (vivas: ${c.notas.filter((n) => !n.historia).length} · história: ${c.notas.filter((n) => n.historia).length}) · arquivos: ${c.arquivos.length}`);
console.log(`camada 1 (leitura obrigatória): ${kb(bClaude + bRegras)} de ${kb(TETO.camada1)} — CLAUDE.md ${kb(bClaude)} + Regras de Ouro ${kb(bRegras)}`);
console.log(`decisões: ${c.decisoes.size} notas (vigentes ${[...c.decisoes.values()].filter((d) => d.status === 'vigente').length} · provisórias ${[...c.decisoes.values()].filter((d) => d.status === 'provisoria').length} · revisadas ${[...c.decisoes.values()].filter((d) => d.status === 'revisada').length})`);
console.log(`lições: ${licoes.length} (E ${conta('E')} · A ${conta('A')} · M ${conta('M')} · F ${conta('F')} · X ${conta('X')}) em ${total('Plataforma/Memoria/').length} notas de tema`);
console.log(`banco: ${total('Supabase-fabrica/Banco/').length} notas de domínio · design: ${total('Plataforma/Design/').length} notas · mapas: ${total('Mapas/').length}`);
const maior = (pasta) => {
  const m = total(pasta).sort((a, b) => b.bytes - a.bytes)[0];
  return m ? `${kb(m.bytes)} (${m.nome})` : '—';
};
console.log(`a maior de cada tipo: decisão ${maior('Plataforma/Decisoes/')} · lições ${maior('Plataforma/Memoria/')} · banco ${maior('Supabase-fabrica/Banco/')} · mapa ${maior('Mapas/')}`);
console.log(`ligações quebradas: ${qVivas.length} em notas vivas · ${qHist.length} em história  |  notas soltas: ${soltas.length - sHist.length} vivas · ${sHist.length} de história`);
for (const a of avisos) console.log('⚠️  ' + a);
for (const e of erros) console.log('❌ ' + e);
console.log(erros.length ? `\n${erros.length} erro(s) — o cofre NÃO está em ordem.` : `\n✅ zero erro${avisos.length ? ` (${avisos.length} aviso(s))` : ''}.`);
process.exit(erros.length ? 1 : 0);
