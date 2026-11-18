// Biblioteca do guarda-costas do cofre (SESSAO-49). Node puro, sem dependência.
// Lê o cofre Obsidian em _docs/, entende ligações [[...]] e ![[...]] e links markdown locais.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname, basename, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const COFRE = join(RAIZ, '_docs');
export const barra = (p) => p.split(sep).join('/');
export const kb = (n) => (n / 1024).toFixed(1) + ' KB';

/** Todos os arquivos do cofre (caminho relativo ao cofre, com /), fora .obsidian. */
export function listarArquivos(dir = COFRE, saida = []) {
  for (const nome of readdirSync(dir)) {
    if (nome === '.obsidian' || nome === '.trash') continue;
    const p = join(dir, nome);
    const st = statSync(p);
    if (st.isDirectory()) listarArquivos(p, saida);
    else saida.push({ rel: barra(relative(COFRE, p)), abs: p, bytes: st.size });
  }
  return saida;
}

export const ler = (abs) => readFileSync(abs, 'utf8');

/** Notas que são HISTÓRIA (não entram nas regras de "nota viva"). */
export function ehHistoria(rel) {
  return (
    rel.startsWith('Handoffs/') ||
    rel.startsWith('Plataforma/Execucao/') ||
    rel.startsWith('Arquivo/') ||
    rel.includes('/Arquivo/')
  );
}

/** Tira blocos de código e código em linha (onde [[ ]] não é ligação). Mantém o tamanho das linhas. */
export function semCodigo(texto) {
  let fora = '';
  let emBloco = false;
  for (const linha of texto.split('\n')) {
    if (/^\s*(```|~~~)/.test(linha)) {
      emBloco = !emBloco;
      fora += '\n';
      continue;
    }
    fora += (emBloco ? '' : linha.replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length))) + '\n';
  }
  return fora;
}

/** Separa o frontmatter (--- ... ---) do corpo. */
export function frontmatter(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(texto);
  if (!m) return { fm: null, corpo: texto, bruto: '' };
  const fm = {};
  for (const linha of m[1].split(/\r?\n/)) {
    const k = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(linha);
    if (k) fm[k[1]] = k[2].trim();
  }
  return { fm, corpo: texto.slice(m[0].length), bruto: m[1] };
}

/** Lista YAML em linha: [a, b] ou ["[[x]]", "[[y]]"] → ['a','b'] */
export function listaYaml(v) {
  if (!v) return [];
  const s = v.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!s.trim()) return [];
  const itens = [];
  let atual = '';
  let aspas = false;
  let fundo = 0;
  for (const ch of s) {
    if (ch === '"') aspas = !aspas;
    else if (ch === '[') fundo++;
    else if (ch === ']') fundo--;
    if (ch === ',' && !aspas && fundo === 0) {
      itens.push(atual);
      atual = '';
    } else atual += ch;
  }
  itens.push(atual);
  return itens.map((x) => x.trim().replace(/^"|"$/g, '')).filter(Boolean);
}

/** Extrai as ligações de um texto: wikilinks e links markdown para arquivo local. */
export function ligacoes(texto) {
  const t = semCodigo(texto);
  const achadas = [];
  const re = /(!?)\[\[([^[\]\n]+?)\]\]/g;
  let m;
  while ((m = re.exec(t))) {
    const dentro = m[2].replace(/\\\|/g, '|');
    const alvoCompleto = dentro.split('|')[0];
    const alvo = alvoCompleto.split('#')[0].trim();
    const ancora = alvoCompleto.includes('#') ? alvoCompleto.slice(alvoCompleto.indexOf('#') + 1).trim() : '';
    achadas.push({ tipo: 'wiki', embutida: m[1] === '!', alvo, ancora, bruto: m[0] });
  }
  const reMd = /(!?)\[[^\]\n]*\]\(([^)\n]+)\)/g;
  while ((m = reMd.exec(t))) {
    let alvo = m[2].trim().replace(/^<|>$/g, '');
    if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(alvo)) continue; // http:, mailto:, obsidian:, âncora
    alvo = alvo.split(/\s+"/)[0].split('#')[0];
    try {
      alvo = decodeURIComponent(alvo);
    } catch {
      /* fica como está */
    }
    if (!alvo) continue;
    achadas.push({ tipo: 'md', embutida: m[1] === '!', alvo, ancora: '', bruto: m[0] });
  }
  return achadas;
}

/** Índice do cofre para resolver ligações do jeito do Obsidian (pelo nome; caminho também vale). */
export function montarIndice(arquivos) {
  const porNome = new Map(); // nome (minúsculo, sem .md) → [rel]
  const porCaminho = new Map();
  const juntar = (k, rel) => {
    const c = k.toLowerCase();
    if (!porNome.has(c)) porNome.set(c, []);
    porNome.get(c).push(rel);
  };
  for (const a of arquivos) {
    const ext = extname(a.rel).toLowerCase();
    const base = basename(a.rel);
    porCaminho.set(a.rel.toLowerCase(), a.rel);
    if (ext === '.md') {
      juntar(base.slice(0, -3), a.rel);
      porCaminho.set(a.rel.slice(0, -3).toLowerCase(), a.rel);
    } else juntar(base, a.rel);
  }
  return { porNome, porCaminho };
}

/** Resolve uma ligação a partir da nota `de` (rel). Devolve o rel do alvo ou null. */
export function resolver(indice, de, lig) {
  const alvo = lig.alvo.replace(/\\/g, '/');
  if (!alvo) return de; // [[#ancora]] na própria nota
  if (lig.tipo === 'md') {
    const p = barra(join(dirname(de), alvo)).toLowerCase();
    return indice.porCaminho.get(p) ?? indice.porCaminho.get(alvo.toLowerCase().replace(/^\.?\//, '')) ?? null;
  }
  const c = alvo.toLowerCase();
  if (alvo.includes('/')) {
    const direto = indice.porCaminho.get(c) ?? indice.porCaminho.get(barra(join(dirname(de), alvo)).toLowerCase());
    if (direto) return direto;
    for (const [k, v] of indice.porCaminho) if (k.endsWith('/' + c) || k.endsWith('/' + c + '.md')) return v;
  }
  const cands = indice.porNome.get(basename(c)) ?? indice.porNome.get(c);
  return cands ? cands[0] : null;
}

/** Títulos (âncoras) de uma nota. */
export function titulos(texto) {
  const saida = [];
  for (const linha of semCodigo(texto).split('\n')) {
    const m = /^(#{1,6})\s+(.*?)\s*$/.exec(linha);
    if (m) saida.push(m[2]);
  }
  return saida;
}
