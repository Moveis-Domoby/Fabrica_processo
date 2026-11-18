// Retrato do cofre: tamanhos, ligações quebradas, notas soltas. Só leitura.
// Uso: node scripts/cofre/medir.mjs [--detalhe]
import { listarArquivos, ler, ligacoes, montarIndice, resolver, ehHistoria, kb } from './lib.mjs';

const arqs = listarArquivos();
const notas = arqs.filter((a) => a.rel.endsWith('.md'));
const ind = montarIndice(arqs);
const chegando = new Map();
const quebradas = [];
for (const n of notas) {
  for (const l of ligacoes(ler(n.abs))) {
    const alvo = resolver(ind, n.rel, l);
    if (!alvo) quebradas.push({ de: n.rel, l });
    else if (alvo !== n.rel) chegando.set(alvo, (chegando.get(alvo) ?? 0) + 1);
  }
}
const soltas = notas.filter((n) => !chegando.has(n.rel));
const total = arqs.reduce((s, a) => s + a.bytes, 0);
const viva = (r) => !ehHistoria(r);
const detalhe = process.argv.includes('--detalhe');
console.log(
  `notas: ${notas.length} · arquivos: ${arqs.length} · cofre: ${(total / 1048576).toFixed(1)} MB · só as notas: ${kb(notas.reduce((s, a) => s + a.bytes, 0))}`,
);
console.log(
  `ligações quebradas: ${quebradas.length} (em notas vivas: ${quebradas.filter((q) => viva(q.de)).length}; de imagem/embutida: ${quebradas.filter((q) => q.l.embutida).length})`,
);
if (detalhe) for (const q of quebradas) console.log(`  ${viva(q.de) ? 'VIVA' : 'hist'} ${q.de} → ${q.l.bruto}`);
console.log(`notas soltas (ninguém liga): ${soltas.length} (vivas: ${soltas.filter((s) => viva(s.rel)).length})`);
if (detalhe) for (const s of soltas) console.log(`  ${viva(s.rel) ? 'VIVA' : 'hist'} ${s.rel}`);
for (const t of [...notas].sort((a, b) => b.bytes - a.bytes).slice(0, 12))
  console.log(`  ${kb(t.bytes).padStart(9)}  ${String(chegando.get(t.rel) ?? 0).padStart(3)} chegando  ${t.rel}`);
