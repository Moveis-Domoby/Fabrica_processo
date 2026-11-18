// MIGRAÇÃO (SESSAO-49, roda uma vez, ANTES de enxugar o CLAUDE.md da raiz): guarda o texto
// completo do CLAUDE.md de hoje na nota do cofre que detalha as regras — nada se perde.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { COFRE, RAIZ } from '../lib.mjs';

const raiz = readFileSync(join(RAIZ, 'CLAUDE.md'), 'utf8');
if (!raiz.includes('## 🔴 Regras CRÍTICAS')) throw new Error('o CLAUDE.md da raiz já foi enxugado');
const destino = join(COFRE, 'Plataforma', 'CLAUDE - Regras do Claude Code (repo).md');
const nova = `---
titulo: CLAUDE.md — as regras do Claude Code por extenso (detalhe e histórico)
tipo: regras
data: 2026-08-19
atualizado: 2026-11-18
tags: [plataforma, claude-code, regras, conduta]
---

> [!warning] O que é este arquivo
> ↪️ **18/11/2026 (SESSAO-49):** o \`CLAUDE.md\` da raiz do repositório ficou **enxuto** (as 20 regras em uma linha cada, o ciclo e a rota de leitura nova) e ganhou a companhia de [[000 - REGRAS DE OURO]]. Esta nota guarda, **sem reescrever**, o texto completo das regras como estava em 18/11/2026 — o detalhe, as citações do dono e o histórico de cada regra. **Não é leitura obrigatória:** abra quando precisar do porquê de uma regra. Regra nova ou mudada: a linha curta vai no \`CLAUDE.md\` da raiz e o detalhe entra aqui, no fim, com a data.
> *(Até 18/11 este arquivo era o espelho do \`CLAUDE.md\` da raiz, "mantido em sincronia". A rota de leitura descrita abaixo, em "Ao iniciar qualquer sessão", **não vale mais** — vale a do \`CLAUDE.md\` da raiz.)*

---

${raiz.replace(/^# CLAUDE\.md — /m, '# CLAUDE.md (texto completo até 18/11/2026) — ')}`;
writeFileSync(destino, nova);
console.log('guardado:', destino, Buffer.byteLength(nova), 'bytes; contém o CLAUDE.md inteiro:', nova.includes(raiz.slice(raiz.indexOf('## ⛳'))));
