---
titulo: SESSAO-49 — diário de execução (a dieta da documentação)
tipo: execucao
data: 2026-11-18
tags: [plataforma, execucao, cofre, documentacao]
---

# 🧾 SESSAO-49 — diário de execução

**Demanda:** [[SESSAO-49 - Dieta da Documentacao - Cofre no Padrao de Mapas do Obsidian]] · **Handoff:** [[handoff_2026_11_18_sessao49_dieta_da_documentacao]]
**Modo:** fila (o dono dormindo; sem perguntas, sem envio, sem banco, sem publicação). **Branch:** `sessao-49-dieta-da-documentacao`, a partir da main `4d91dd3`. **Mesa:** worktree própria.
**Decisões provisórias da sessão:** D-335 (roteiros do cofre não publicam) · D-336 (leitura por camadas) · D-337 (uma nota por decisão) · D-338 (tetos) · D-339 (o Arquivo e a Ordem curta). **Lições:** E-292, E-293, E-294, A-244, A-245, A-246.

## Quanto li antes de começar (a 1ª sessão na rota nova)

≈ 60 KB: o pedido da fila (4 KB), o `CLAUDE.md` antigo (14 KB), a demanda (13 KB), o `CLAUDE.md` do cofre (6 KB), o topo dos Próximos Passos (6 KB), os **títulos** dos seis arquivos grandes (`grep '^## '`, ~12 KB) e trechos da Ordem (~5 KB). **Nenhum monólito foi lido inteiro** — a divisão foi feita por roteiro, pelos títulos. Depois, para escrever as Regras de Ouro: os orçamentos da lei (2 KB), os fundamentos do design (6 KB) e a manchete de 27 lições (8 KB).

## Task list (espelho da demanda + do pedido da fila)

- [x] **Passo 1 — replanejar** a demanda com ↪️ 18/11 e as medições de hoje; "em execução" na Ordem; commit só disso (`5a9f322`).
- [x] **Frente 1** — `CLAUDE.md` enxuto (9,0 KB) + `000 - REGRAS DE OURO` (21,1 KB) + o `CLAUDE.md` do cofre apontando para elas.
- [x] **Frente 2** — 291 decisões, uma nota cada, em `Plataforma/Decisoes/`; o arquivo antigo virou índice.
- [x] **Frente 5** — `scripts/cofre/verificar.mjs` (ligações, tetos, integridade, índices gerados, `--leitura`, `--ligar`).
- [x] **Frente 3** — esquema por domínio (18 notas), memória por tema (19 notas), lei × dívidas (3 partes), modelo de sistema por assunto (6 notas).
- [x] **Frente 4** — 15 mapas de área + o mapa das sessões; Mapa do Projeto de volta a mapa; Ordem curta; citação virou ligação; soltas ligadas; `Arquivo/`.
- [x] **Frente 6** — templates de demanda e de handoff; regras 6b, 9 e 10 do `CLAUDE.md`.
- [x] Pulo da Vercel para `scripts/cofre` (D-335).
- [ ] ClickUp — **não mexido** (a fila proíbe); as 3 tarefas ficam para o dono.
- [ ] Print do grafo do Obsidian — não há Obsidian na fila; o handoff ensina a conferir.

## Medições de partida (18/11, main `4d91dd3`)

Leitura obrigatória **1.315,7 KB** (com o Modelo de Sistema) · Decisões 423,0 KB / **291** títulos · Memória 262,5 KB / **439** entradas (222 E · 188 A · 16 M · 9 F · 4 X) · Esquema 258,0 KB · Modelo 109,8 KB · Lei 87,6 KB · Mapa 66,0 KB · Ordem 37,6 KB · 258 notas · 2 ligações quebradas · 11 notas soltas (4 vivas).

Achados da medição: (1) são 291 decisões, não 248; os números pulados (44, 64, 69, 149, 160, 177–185, 222–224, 234–259) **não têm texto em lugar nenhum** — procurei "D-44" no cofre inteiro: só a reserva da frente do histórico do Tiny e o diário da SESSAO-15 dizendo que as respostas viraram a D-45; a "D-64 ficou sem uso" está escrito no próprio arquivo. Não ganharam nota. (2) As 33 imagens quebradas de 11/11 não existem mais. (3) Uma entrada da memória (a do CRLF) ocupa 3 linhas.

## O que foi feito, na ordem em que aconteceu

**Os roteiros (todos em `scripts/cofre/`, Node puro, sem dependência):**
- `lib.mjs` — lê o cofre, entende `[[ligação]]`, `![[embutida]]` e link markdown local, resolve pelo nome como o Obsidian.
- `cofre.mjs` — o modelo: decisões (frontmatter das notas), lições (`### E-NNN` nas notas de tema), a ligação de cada id, as tabelas reais (lidas dos `create table` de `supabase/migrations/` e do esquema-base, só leitura).
- `areas.mjs` / `temas.mjs` — as 15 áreas e os 11 temas, com a classificação por palavra-chave usada **só na migração**.
- `verificar.mjs` — o guarda-costas (ver abaixo). `medir.mjs` — o retrato simples usado no replanejamento.
- `migracao/` — os roteiros de uma vez só, guardados como registro: `dividir-decisoes.mjs`, `areas-das-decisoes.mjs` (as 80 áreas conferidas à mão), `dividir-notas.mjs` (memória, esquema, lei, modelo), `guardar-claude-md.mjs`, `montar-mapas.mjs`. Todos recusam rodar duas vezes.

**Frente 2 — decisões.** `dividir-decisoes.mjs` corta em `## D-NN`, grava `D-NNN - título sem acento.md` com frontmatter (`id`, `aliases`, `titulo`, `data`, `status`, `revisa`, `revisada_por`, `complementa`, `area`, `tags`) e o texto intacto (o título original vira o `#` da nota). Estado: `provisoria` se o título tem ⏳ sem ✅ (98), `revisada` se outra decisão a revisa pelo título (45), senão `vigente` (148); ✅+⏳ = vigente com a etiqueta `provisoria-em-parte`. Relações tiradas do título: depois de ↩️ = revisa; depois de ↪️ = complementa; o lado inverso é calculado. Área: palavra-chave (título 6×, corpo 1×) + revisão à mão da lista inteira → 80 correções. **Prova:** cada nota relida devolve a seção de origem byte a byte.

**Frente 3 — as outras divisões** (`dividir-notas.mjs`, com a mesma prova: cada bloco em exatamente uma nota):
- **Memória:** 439 entradas → 19 notas em `Plataforma/Memoria/` (11 temas; tema grande vira partes de ~21 KB). Cada entrada sob `### E-NNN`, linha original intacta. M, F e X juntos numa nota.
- **Esquema:** o arquivo era um registro cronológico por sessão/migration, não por tabela. 120 blocos (as seções `##` da integração + cada parágrafo/marcador de migration) → 18 notas em `Supabase-fabrica/Banco/` por domínio (palavra-chave no começo do bloco + 19 correções à mão). **2.312 nomes entre crases antes = 2.312 depois.** O índice mantém "O que NÃO existe".
- **Lei:** o §14 (tabela das dívidas + o "Andamento" de cada sessão, 66,5 KB) → 3 partes; a lei ficou com 21,6 KB.
- **Modelo de sistema:** 53 blocos (`##`/`###`) → 6 notas em `Plataforma/Design/`.

**Frente 1 — camada 1.** Antes de enxugar, `guardar-claude-md.mjs` copiou o `CLAUDE.md` inteiro para [[CLAUDE - Regras do Claude Code (repo)]] (que era o espelho "em sincronia" e estava defasado na regra 2). As Regras de Ouro foram escritas à mão a partir de: os títulos das D-01…D-17; a contagem de citações nas demandas (as vigentes mais citadas + as que substituíram as revisadas mais citadas); as lições mais citadas por outras lições e as promovidas; os §1 e §12 da lei; os fundamentos do design; a regra 10. Escritas com id em texto puro — o verificador pôs as ligações.

**Frente 4 — mapas e ligações.** `montar-mapas.mjs`: 15 mapas (`Mapas/MOC - Área.md`: o que é, pastas do código, notas da área, perguntas, últimas sessões + o bloco gerado com as decisões vigentes/provisórias/revisadas e o "onde mais ler"); `MOC - Sessoes e Handoffs` (48 sessões + 14 ajustes, uma linha cada); Mapa do Projeto novo (6,6 KB); Ordem curta (13 KB). O Mapa e a Ordem antigos foram **inteiros** para `Arquivo/`. Para `Arquivo/` também (mesmo nome): 4 prompts de bloco, o plano noturno, o plano da união, os planos dos blocos 5 e 6. A cópia idêntica do handoff de pesquisa na raiz do cofre foi removida (conferida byte a byte com a de `Planejamento/`).
`verificar.mjs --ligar`: **1.241 citações** viraram ligação em 215 notas vivas (a 1ª de cada id por seção; `\|` em tabela; nada em código, título ou frontmatter) — prova: tirando as ligações, o texto é o mesmo. Mais **22 ligações antigas** `[[PLT - Decisoes de Produto#D-NN]]` (o título não existe mais no índice) repontadas para a nota da decisão, inclusive em 9 notas de história (só o destino da ligação mudou).

**Frente 5 — o verificador.** Erros (saída 1): ligação quebrada ou nota solta em nota viva; camada 1 > 40 KB; `CLAUDE.md` > 10 KB; Regras > 30 KB; mapa > 15 KB; decisão com nome/id/status/data/área inválidos; `revisa` × `revisada_por` desencontrados; id repetido; lista gerada desatualizada; mapa de área faltando. Avisos: tetos das demais classes, história acima do teto (só a contagem), âncora para título inexistente, id citado que não existe, citação ainda em texto. `--gerar` refaz, entre `<!-- gerado:inicio/fim -->`: o índice de decisões por área, o de lições por nota, o do banco (nota por domínio + **tabela → nota**, com as 99 tabelas reais, todas citadas em alguma nota. Na 1ª versão a lista acusou 2 tabelas "sem nota" — **falso alarme meu**: estavam escritas com o prefixo do esquema (`public.…`) e a minha busca descartava nome depois de ponto; corrigido contando o nome escrito como código, e a nota com o título "Tabela `x`" vale como a casa da tabela) e a lista de decisões de cada mapa. `--leitura "<demanda>"` soma camada 1 + demanda + o que a seção "Leitura da sessão" liga (sem a seção: estimativa pelas áreas do texto).

**Frente 6.** Templates reescritos (demanda com "Leitura da sessão"; handoff ≤ 15 KB, com a ligação quebrada do índice de problemas consertada). `CLAUDE.md`: 6b (lição na nota do tema, decisão em nota nova), 9 (verificador antes do handoff), 10 (bloco novo no fim da nota do domínio).

**Pulo da Vercel (D-335).** `scripts/vercel-pular-documentacao.sh`: `':(exclude)scripts/cofre'` na lista + o comentário. `sh -n` ok.

## Erros no caminho e como foram resolvidos

- **E-292** — roteiro gravado por aqui-documento do shell perdeu barras invertidas (regex quebrada e, pior, regex alterada sem erro); um comando longo com aspas foi recusado inteiro. Passei a gravar e editar roteiro só pela ferramenta de arquivo.
- A 1ª prova da divisão das decisões falhou — era o **meu conferidor** (esperava uma linha em branco que o frontmatter não deixa), não o conteúdo; a pasta foi apagada e a divisão refeita do zero a partir do git.
- `aliases` repetia o id nas decisões de 3 dígitos → refeito.
- A 1ª classificação das lições por tema ficou ruim (tela em "banco", shell em "Tiny") → pesos por palavra e manchete 3× (A-246). **Continua aproximada** — ver pendências.
- **E-294** — ligação com apelido dentro da tabela da Ordem quebrava a linha → barra escapada.
- **E-293** — status da SESSAO-08 escrito de cabeça na Ordem curta → corrigido contra o texto arquivado.
- Os nomes de arquivo que chutei em duas ligações de frontmatter (D-303) → o verificador acusou; corrigido.

## Resultado medido (verificador, fim da sessão)

| | Antes | Depois |
|---|---|---|
| Leitura obrigatória | 1.315,7 KB | **30,1 KB** (`CLAUDE.md` 9,0 + Regras de Ouro 21,1) |
| Leitura de uma sessão típica (SESSAO-48: camada 1 + demanda + mapa + a maior nota de banco e de design da área) | 1.315,7 KB + a demanda | **109,5 KB** |
| Decisões | 291 num arquivo de 423 KB | **291 notas** (a maior: 6,1 KB) + 5 desta sessão; índice 49 KB |
| Lições | 439 num arquivo de 262 KB | **439** em 19 notas (a maior: 24 KB) + 6 desta sessão; índice 57 KB |
| Esquema | 258 KB | 18 notas (a maior: 22,5 KB); índice 14 KB; 2.312 nomes = 2.312 |
| Modelo de sistema | 110 KB | 6 notas (a maior: 23 KB); índice 3 KB |
| Lei de desempenho | 87,6 KB | 21,6 KB + 3 partes de dívidas |
| Mapa do Projeto / Ordem | 66,0 / 37,6 KB | 6,6 / 13,0 KB |
| Ligações quebradas (vivas / história) | 1 / 1 | **0** / 2 |
| Notas soltas (vivas / história) | 4 / 7 | **0** / 4 |

Avisos que ficam (5): 4 ligações vivas para um trecho que não existe dentro da nota (`#P16`, `#Medição de tempo de produção` — já eram assim); 2 quebradas e 4 soltas em história; 27 demandas/handoffs/diários antigos acima do teto de hoje; a citação "A-52" (número que nunca existiu) numa lição.

**Provas de qualidade do repositório:**
- `npm run lint` — limpo (inclui os roteiros novos). `npm run build` — verde.
- `npm test` — **a bateria inteira NÃO saiu verde nesta máquina, nesta hora:** 4 rodadas (a normal duas vezes, uma com 3 processos e uma com 2 processos e tempo limite maior): 2, 6, 5 e 2 testes falhando de 719, **cada vez um conjunto diferente** (ControleTempo, Estrutura, ParadaAvulsaDoDia, JanelaObservacao, AbaCalendario… — o de Estrutura caiu em 3 das 4), todos por estouro de tempo ("Test timed out in 5000ms" / elemento que não apareceu a tempo). Os 4 arquivos que falharam, rodados sozinhos, passam (18 de 18). A máquina estava dividida com a outra mesa da fila (a soma dos tempos de ambiente passou de 600 s). **Nenhum arquivo de `src/`, `supabase/`, `public/`, `package.json` ou `vercel.json` mudou** (`git diff --name-only origin/main` nesses caminhos: vazio) — a sessão não tinha como quebrar nem consertar esses testes. Rodar de novo com a máquina livre antes de juntar.
- Banco: nada tocado (`npm run test:banco` não se aplica — nenhuma migration nova).

## Arquivos fora de `_docs/`

`CLAUDE.md` · `scripts/cofre/**` (novo) · `scripts/vercel-pular-documentacao.sh` (1 linha + comentário). Nada em `src/`, `supabase/`, `public/`, `package.json` ou `vercel.json`.
