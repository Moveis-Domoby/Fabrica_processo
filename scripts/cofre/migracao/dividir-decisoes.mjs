// MIGRAÇÃO (SESSAO-49, roda uma vez): PLT - Decisoes de Produto.md → uma nota por decisão
// em _docs/Plataforma/Decisoes/. O texto de cada decisão é COPIADO sem reescrever; o arquivo
// antigo vira o índice (mesmo nome). Prova: cada nota relida bate byte a byte com a seção de origem.
// Uso: node scripts/cofre/migracao/dividir-decisoes.mjs [--ensaio]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { COFRE } from '../lib.mjs';
import { classificarArea, semAcento, AREAS } from '../areas.mjs';
import { AREA_MANUAL } from './areas-das-decisoes.mjs';

const ensaio = process.argv.includes('--ensaio');
const ORIGEM = join(COFRE, 'Plataforma', 'PLT - Decisoes de Produto.md');
const DESTINO = join(COFRE, 'Plataforma', 'Decisoes');
const texto = readFileSync(ORIGEM, 'utf8');
if (!/^## D-\d+/m.test(texto)) throw new Error('o arquivo de decisões já foi dividido (não há mais "## D-NN")');

const linhas = texto.split('\n');
const inicio = linhas.findIndex((l) => /^## D-\d+\b/.test(l));
const preambulo = linhas.slice(0, inicio).join('\n');
// rodapé "ver também": a última linha não vazia, se for só ligações
let fim = linhas.length;
while (fim > 0 && !linhas[fim - 1].trim()) fim--;
let rodape = '';
if (/^\[\[.*\]\]\s*$/.test(linhas[fim - 1]) && !/^## /.test(linhas[fim - 1])) {
  rodape = linhas[fim - 1];
  fim--;
}
const secoes = [];
for (let i = inicio; i < fim; i++) {
  const m = /^## (D-(\d+))\b\s*·?\s*(.*)$/.exec(linhas[i]);
  if (m) secoes.push({ id: m[1], n: +m[2], cabecalho: linhas[i], tituloBruto: m[3], corpo: [] });
  else secoes.at(-1).corpo.push(linhas[i]);
}

const SIGLAS = new Set(['PCP', 'SECC', 'CNC', 'PIN', 'TV', 'ROTAS', 'API', 'ID', 'SKU', 'ESTOQUE', 'BOM', 'PR', 'TI', 'X', 'D', 'RLS', 'OK']);
function tituloLimpo(bruto) {
  let t = bruto;
  // cauda de revisão: " — ↩️ revisa a D-11", " — ↪️ D-83/…"
  t = t.replace(/\s*[—–-]\s*[↩↪]️?.*$/u, '').replace(/\s*[↩↪]️?\s*revisad[ao].*$/u, '');
  // prefixo de estado ("✅ DECIDIDA pelo dono (…) + ⏳ PROVISÓRIA (…) — "): corta até o 1º travessão fora de parênteses
  if (/^\s*(⏳|✅)/u.test(t)) {
    let fundo = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '(') fundo++;
      else if (t[i] === ')') fundo--;
      else if (fundo === 0 && t.startsWith(' — ', i)) {
        t = t.slice(i + 3);
        break;
      }
    }
  }
  // datas entre parênteses
  t = t.replace(/\s*\((?:[^()]*(?:\d{1,2}\/\d{1,2}(?:\/\d{4})?|SESSAO-\d+)[^()]*)\)/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  return t || bruto.trim();
}
function nomeArquivo(n, limpo) {
  let t = limpo;
  const letras = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const maiusc = letras.replace(/[^A-ZÀ-Þ]/g, '').length;
  if (letras.length && maiusc / letras.length > 0.5) {
    t = t
      .split(' ')
      .map((p, i) => {
        const nu = p.replace(/[^A-Za-zÀ-ÿ]/g, '');
        if (SIGLAS.has(nu)) return p;
        const baixa = p.toLowerCase();
        return i === 0 ? baixa.charAt(0).toUpperCase() + baixa.slice(1) : baixa;
      })
      .join(' ');
  }
  t = semAcento(t)
    .replace(/[\\/:*?"<>|#^[\]`´'“”‘’«»!.,;()=+→←↔…%&@$~{}]/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > 62) {
    t = t.slice(0, 62);
    t = t.slice(0, t.lastIndexOf(' '));
  }
  t = t.replace(/\s+(e|a|o|de|da|do|em|com|que|para|os|as|no|na|ou|um|uma|so|se|por|ao|dos|das)$/i, '').replace(/[\s-]+$/, '');
  return `D-${String(n).padStart(3, '0')} - ${t}`;
}
function dataDe(s) {
  const m = /(\d{1,2})(?:[–-]\d{1,2})?\/(\d{1,2})\/(\d{4})/.exec(s);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}
const idsDe = (s) => [...new Set([...s.matchAll(/\bD-(\d{1,3})\b/g)].map((m) => 'D-' + +m[1]))];

const existe = new Set(secoes.map((s) => s.id.replace(/^D-0*/, 'D-')));
for (const s of secoes) {
  s.id = 'D-' + s.n;
  while (s.corpo.length && !s.corpo.at(-1).trim()) s.corpo.pop();
  while (s.corpo.length && !s.corpo[0].trim()) s.corpo.shift();
  s.limpo = tituloLimpo(s.tituloBruto);
  s.arquivo = nomeArquivo(s.n, s.limpo);
  s.data = dataDe(s.tituloBruto) ?? dataDe(s.corpo.join('\n')) ?? '';
  const b = s.tituloBruto;
  const temProv = /⏳/.test(b);
  const temDec = /✅/.test(b);
  s.status = temProv && !temDec ? 'provisoria' : 'vigente';
  s.provisoriaEmParte = temProv && temDec;
  // relações declaradas no título: ↩️ revisa / ↪️ complementa
  s.revisa = [];
  s.complementa = [];
  const cauda = /[↩↪].*$/u.exec(b)?.[0] ?? '';
  for (const parte of cauda.split(/(?=[↩↪])/u)) {
    if (/^↩️?\s*revisad[ao] em/u.test(parte)) {
      s.revisadaEm = true;
      continue;
    }
    const alvo = parte.startsWith('↩') ? s.revisa : s.complementa;
    for (const id of idsDe(parte)) if (id !== s.id && existe.has(id)) alvo.push(id);
  }
  s.area = AREA_MANUAL[s.id] ?? classificarArea(s.limpo, s.corpo.join('\n'));
  for (const a of s.area) if (!AREAS[a]) throw new Error(`área desconhecida em ${s.id}: ${a}`);
}
const porId = new Map(secoes.map((s) => [s.id, s]));
for (const s of secoes) s.revisadaPor = secoes.filter((o) => o.revisa.includes(s.id)).map((o) => o.id);
for (const s of secoes) if (s.status === 'vigente' && (s.revisadaPor.length || s.revisadaEm)) s.status = 'revisada';

const nomes = new Set();
for (const s of secoes) {
  if (nomes.has(s.arquivo.toLowerCase())) throw new Error('nome repetido: ' + s.arquivo);
  nomes.add(s.arquivo.toLowerCase());
}

if (ensaio) {
  for (const s of secoes)
    console.log(`${s.id.padEnd(6)} ${s.status.slice(0, 4)} ${s.data} [${s.area.join(',')}]${AREA_MANUAL[s.id] ? '*' : ''} ${s.arquivo.slice(8)}${s.revisa.length ? ' ↩' + s.revisa.join('/') : ''}`);
  const cont = {};
  for (const s of secoes) cont[s.area[0]] = (cont[s.area[0]] ?? 0) + 1;
  console.log(cont);
  console.log('total:', secoes.length, '· maiores:', [...secoes].sort((a, b) => b.corpo.join('\n').length - a.corpo.join('\n').length).slice(0, 8).map((s) => `${s.id}=${(Buffer.byteLength(s.corpo.join('\n')) / 1024).toFixed(1)}KB`).join(' '));
  process.exit(0);
}

const lig = (id) => `"[[${porId.get(id).arquivo}|${id}]]"`;
const yamlTexto = (t) => '"' + t.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
mkdirSync(DESTINO, { recursive: true });
for (const s of secoes) {
  const tags = ['decisao', ...s.area.map((a) => 'area/' + a)];
  if (s.status === 'provisoria') tags.push('provisoria');
  if (s.provisoriaEmParte) tags.push('provisoria-em-parte');
  const fm = [
    '---',
    `id: ${s.id}`,
    `aliases: [${[...new Set([s.id, 'D-' + String(s.n).padStart(2, '0'), 'D-' + String(s.n).padStart(3, '0')])].join(', ')}]`,
    `titulo: ${yamlTexto(s.limpo)}`,
    `tipo: decisao`,
    `data: ${s.data}`,
    `status: ${s.status}`,
    `revisa: [${s.revisa.map(lig).join(', ')}]`,
    `revisada_por: [${s.revisadaPor.map(lig).join(', ')}]`,
    `complementa: [${s.complementa.map(lig).join(', ')}]`,
    `area: [${s.area.join(', ')}]`,
    `tags: [${tags.join(', ')}]`,
    '---',
    '',
  ].join('\n');
  const corpo = `# ${s.id} · ${s.tituloBruto}\n\n${s.corpo.join('\n')}\n`;
  const caminho = join(DESTINO, s.arquivo + '.md');
  if (existsSync(caminho)) throw new Error('já existe: ' + caminho);
  writeFileSync(caminho, fm + corpo);
  // prova: o que foi gravado, relido, devolve a seção de origem
  const relido = readFileSync(caminho, 'utf8');
  const semFm = relido.slice(relido.indexOf('\n---\n', 4) + 5);
  const m = /^\n?# (D-\d+) · (.*)\n\n([\s\S]*)\n$/.exec(semFm);
  if (!m || m[2] !== s.tituloBruto || m[3] !== s.corpo.join('\n')) throw new Error('prova falhou em ' + s.id);
}

// o arquivo antigo vira o índice: mesmo nome, preâmbulo preservado, lista gerada pelo verificador
const novoPreambulo = preambulo
  .replace(/^atualizado: .*$/m, 'atualizado: 2026-11-18')
  .replace(/^tipo: decisoes$/m, 'tipo: indice');
const indice =
  novoPreambulo.replace(/\s+$/, '') +
  `\n\n> [!info] ↪️ 18/11/2026 (SESSAO-49) — este arquivo virou o ÍNDICE
> Cada decisão mora agora na sua própria nota, em \`Plataforma/Decisoes/\` (\`D-NNN - o que a decisão faz\`), com o texto original intacto. **Não leia este índice inteiro:** leia o mapa da área (\`Mapas/\`) e abra só as decisões que ele aponta. Decisão nova = **nota nova** naquela pasta (copie o frontmatter de uma vizinha) — a lista abaixo é gerada por \`node scripts/cofre/verificar.mjs --gerar\`, ninguém a mantém à mão.

<!-- gerado:inicio -->
<!-- gerado:fim -->

## Ver também

${rodape}
`;
writeFileSync(ORIGEM, indice);
console.log(`decisões divididas: ${secoes.length} notas em Plataforma/Decisoes/ · provisórias: ${secoes.filter((s) => s.status === 'provisoria').length} · revisadas: ${secoes.filter((s) => s.status === 'revisada').length}`);
