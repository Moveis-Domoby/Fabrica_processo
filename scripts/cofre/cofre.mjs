// O modelo do cofre: notas, decisões (uma nota por D-NN), lições (### E-NN nas notas de tema).
import { join, basename } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { COFRE, RAIZ, listarArquivos, ler, frontmatter, listaYaml, ehHistoria } from './lib.mjs';

export const normId = (id) => id.replace(/-0+(?=\d)/, '-');
export const RE_ID = /(?<![\w\-#|[/\\])([DEAMFX])-(\d{1,3})(?![\w\]])/g;
/** Números de decisão que nunca tiveram texto (reservados e não usados) — citar não é erro. */
export const SEM_DECISAO = { 'D-44': 'reservada pela frente do histórico do Tiny e nunca escrita (as respostas do dono viraram a D-45)', 'D-64': 'ficou sem uso' };

/** Demanda já entregue é história (não se reescreve). */
function demandaEntregue(rel, texto) {
  if (!/^Plataforma\/Demandas\/(SESSAO|AJUSTE)/.test(rel)) return false;
  const st = frontmatter(texto).fm?.status ?? '';
  return /✅|entregue|no ar|absorvida|concluíd|🔁/i.test(st);
}

export function carregar() {
  const arquivos = listarArquivos();
  const notas = arquivos.filter((a) => a.rel.endsWith('.md')).map((a) => ({ ...a, texto: ler(a.abs) }));
  for (const n of notas) {
    n.historia = ehHistoria(n.rel) || demandaEntregue(n.rel, n.texto);
    n.nome = basename(n.rel, '.md');
  }
  const decisoes = new Map();
  for (const n of notas) {
    if (!n.rel.startsWith('Plataforma/Decisoes/')) continue;
    const { fm } = frontmatter(n.texto);
    if (!fm?.id) continue;
    decisoes.set(normId(fm.id), {
      id: normId(fm.id),
      n: +fm.id.slice(2),
      nota: n,
      nome: n.nome,
      titulo: (fm.titulo ?? '').replace(/^"|"$/g, '').replace(/\\"/g, '"'),
      status: fm.status ?? '',
      data: fm.data ?? '',
      area: listaYaml(fm.area),
      revisa: listaYaml(fm.revisa).map(idDaLigacao),
      revisadaPor: listaYaml(fm.revisada_por).map(idDaLigacao),
      complementa: listaYaml(fm.complementa).map(idDaLigacao),
      fm,
    });
  }
  const licoes = new Map();
  const repetidas = [];
  for (const n of notas) {
    if (!n.rel.startsWith('Plataforma/Memoria/')) continue;
    const linhas = n.texto.split('\n');
    linhas.forEach((l, i) => {
      const m = /^### ([EAMFX]-\d+)\s*$/.exec(l);
      if (!m) return;
      const id = normId(m[1]);
      if (licoes.has(id)) repetidas.push(id);
      let j = i + 1;
      while (j < linhas.length && !linhas[j].trim()) j++;
      licoes.set(id, { id, letra: id[0], n: +id.slice(2), nota: n, nome: n.nome, texto: linhas[j] ?? '' });
    });
  }
  return { arquivos, notas, decisoes, licoes, repetidas };
}

export function idDaLigacao(s) {
  const m = /\|([DEAMFX]-\d+)\]\]/.exec(s) ?? /\b([DEAMFX]-\d+)\b/.exec(s);
  return m ? normId(m[1]) : s;
}

/** A ligação de um id (ou null se o id não existe). `tabela` escapa a barra para célula de tabela. */
export function ligacaoDe(c, idEscrito, tabela = false) {
  const id = normId(idEscrito);
  const b = tabela ? '\\|' : '|';
  if (id[0] === 'D') {
    const d = c.decisoes.get(id);
    return d ? `[[${d.nome}${b}${idEscrito}]]` : null;
  }
  const l = c.licoes.get(id);
  return l ? `[[${l.nome}#${l.id}${b}${idEscrito}]]` : null;
}

/** A manchete de uma lição: o texto sem a data, o id e o autor; cortado. */
export function manchete(texto, max = 80) {
  let t = texto
    .replace(/^- /, '')
    .replace(/^\[[^\]]*\]\s*/, '')
    .replace(/^\*\*[EAMFX]-\d+\*\*\s*/, '')
    .replace(/^\([^)]*\)\s*/, '')
    .replace(/^·\s*/, '')
    .replace(/^\[[^\]]*\]\s*/, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/[*`]/g, '')
    .replace(/\|/g, '/')
    .trim();
  if (t.length > max) {
    t = t.slice(0, max);
    t = t.slice(0, Math.max(t.lastIndexOf(' '), max - 20)) + '…';
  }
  return t;
}

/** Tabelas que existem de verdade: `create table` nas migrations do repositório e no esquema-base. */
export function tabelasDoBanco() {
  const fontes = [];
  const dir = join(RAIZ, 'supabase', 'migrations');
  if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.endsWith('.sql')) fontes.push(join(dir, f));
  const base = join(COFRE, 'Supabase-fabrica', 'supabase-fabrica-schema.sql');
  if (existsSync(base)) fontes.push(base);
  const tabelas = new Set();
  for (const f of fontes) {
    const sql = readFileSync(f, 'utf8').replace(/--.*$/gm, '');
    for (const m of sql.matchAll(/create\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(?:"?(\w+)"?\.)?"?(\w+)"?/gi)) {
      const esquema = (m[1] ?? 'public').toLowerCase();
      if (esquema === 'public' || esquema === 'plt_privado') tabelas.add(m[2].toLowerCase());
    }
  }
  return [...tabelas].sort();
}
