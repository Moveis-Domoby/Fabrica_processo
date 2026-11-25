---
titulo: Handoff — 2026-11-18 — SESSAO-49 — a dieta da documentação
tipo: handoff
data: 2026-11-18
atualizado: 2026-11-18
tags: [handoff, sessao, cofre, documentacao]
---

# 📋 Handoff — 18/11/2026 — a dieta da documentação

> ↪️ **25/11/2026: NO AR** — a dieta entrou na main em 25/11 (~05:00), pela [[handoff_2026_11_25_subida_atualizada|subida de 25/11]]. O que este handoff diz abaixo ("entregue na branch", "espera a revisão") é a história de 18/11.

**Demanda:** [[SESSAO-49 - Dieta da Documentacao - Cofre no Padrao de Mapas do Obsidian]] · **Diário técnico:** [[SESSAO-49]]
**Estado:** entregue **na branch** `sessao-49-dieta-da-documentacao` (nada foi enviado, nada foi publicado, o banco não foi tocado). Espera a revisão do dono para entrar na main.

## 1. O que o dono pediu

*"Vamos rodar a dieta da documentação agora mesmo; planejar melhor a partir das atualizações recentes e executar."* (18/11, 03:51). O pedido de origem, de 11/11: o Claude Code estava demorando porque tinha de ler tudo antes de começar; a documentação devia voltar ao padrão de mapas, para cada sessão ler só o que a demanda exige, com um documento de regras rápido e leve.

## 2. O que foi feito

**A leitura obrigatória caiu de 1,3 MB para 30 KB.** Antes, toda sessão tinha de ler doze documentos (1.315,7 KB — mais do que cabe na memória de trabalho dela). Agora lê dois: as regras de conduta (9 KB) e uma nota nova, as **Regras de Ouro** (21 KB), que traz em uma linha cada: as leis do produto, as decisões que mais pegam, as lições que mais custaram, o checklist de desempenho, o essencial de design e de banco e o jeito de falar com o dono. Uma sessão típica lê por volta de **110 KB** antes de começar (medido com a demanda do cancelamento da fabricação).

**Os arquivos gigantes foram divididos, sem reescrever uma linha:**

| Era | Virou | Onde |
|---|---|---|
| Decisões — 1 arquivo de 423 KB | **291 notas, uma por decisão**, com nome em português | `Plataforma/Decisoes/` |
| Lições aprendidas — 1 arquivo de 262 KB | **19 notas por tema** (banco, telas, shell, Tiny…) | `Plataforma/Memoria/` |
| Esquema do banco — 1 arquivo de 258 KB | **18 notas por domínio** (PCP, estoque, rotas…) | `Supabase-fabrica/Banco/` |
| Modelo de sistema (design) — 110 KB | **6 notas por assunto** | `Plataforma/Design/` |
| Lei de desempenho — 88 KB | a lei (22 KB) + as dívidas em 3 partes | `Plataforma/` |
| Mapa do Projeto — 66 KB | um mapa de verdade (7 KB) + **15 mapas, um por área** | `Mapas/` |
| Ordem das Sessões — 38 KB | uma linha por sessão (13 KB) | `Plataforma/Demandas/` |

Os nomes antigos continuam existindo — viraram **índices** (uma linha por item), então nenhuma ligação antiga quebrou.

**A "desvinculação" foi consertada:** 1.241 citações que eram só texto ("D-61", "E-19") viraram ligação de verdade nas notas vivas. Agora o grafo do Obsidian enxerga quem depende de quem.

**Um guarda-costas para não desvincular de novo:** um verificador que roda no fim de toda sessão. Ele acusa ligação quebrada, nota solta e documento acima do teto de tamanho, refaz sozinho os índices e as listas dos mapas (ninguém mantém lista à mão) e faz a conta de quanto uma sessão vai ler.

**O jeito de escrever daqui para frente:** o modelo de demanda ganhou a seção "Leitura da sessão" (o Cowork lista os mapas e as notas que a demanda toca); o modelo de handoff ficou curto (≤ 15 KB); decisão nova é uma nota nova; lição nova entra na nota do tema.

## 3. Como conferir no Obsidian, passo a passo

1. Abra o cofre e a nota **000 - REGRAS DE OURO**. É a leitura obrigatória inteira: role até o fim — são poucos minutos.
2. Na seção 1, clique em **D-01**: abre a nota "D-001 - Unidade do card hibrido", com o texto da decisão igual ao de antes.
3. Abra **000 - MAPA DO PROJETO** e, na tabela das áreas, clique em **MOC - PCP**: o que a área é, as pastas do código, as últimas sessões e a lista das decisões vigentes e das provisórias do PCP.
4. Abra o **grafo** (ícone de grafo na barra lateral) e procure por "MOC": cada mapa aparece no centro de um cacho de decisões. Filtrando por `path:Plataforma/Decisoes` aparecem as decisões ligadas entre si (a que revisa e a revisada).
5. Na pasta `Plataforma/Decisoes/`, as notas aparecem em ordem (D-001, D-002…) com o nome dizendo o que a decisão faz.
6. Abra **PLT - Decisoes de Produto** (o índice): decisões por área, as provisórias marcadas com ⏳, as revisadas recolhidas no fim e os números que nunca foram usados.
7. Para ver o guarda-costas: no terminal, na pasta do projeto, `node scripts/cofre/verificar.mjs` — termina com "✅ zero erro".

## 4. Critérios de aceite

- ✅ Camada obrigatória ≤ 40 KB — **30,1 KB**, medida pelo verificador.
- ✅ Leitura de uma demanda típica ≤ 150 KB — **109,5 KB** (cancelamento da fabricação); 59,5 KB (entrega parcial); 53,1 KB (esta).
- ✅ Decisões com frontmatter válido e índice gerado batendo — **291 = 291** (mais 5 desta sessão). ⚠️ "Clicar na citação abre a nota" foi feito com ligação de apelido (ver a decisão provisória sobre isso); **falta o dono conferir no Obsidian** (passo 2 acima).
- ✅ Esquema por domínio e memória por tema sem perder nada — lições **439 = 439** (222 erros, 188 acertos, 16 modelos, 9 fórmulas, 4 possibilidades); esquema: 120 blocos, **2.312 nomes antes = 2.312 depois**; design: 53 blocos; dívidas: 19 blocos. Cada bloco conferido por programa: está inteiro em exatamente uma nota.
- ✅ Um mapa por área, nenhum acima de 15 KB (o maior: 10,8 KB); o Mapa do Projeto voltou a ser mapa (6,6 KB).
- ✅ Zero ligação quebrada e zero nota solta nas notas vivas. (As 33 imagens quebradas de 11/11 já não existiam.)
- ✅ Citações viraram ligação nas notas vivas. ⏳ **O print do grafo não foi tirado** — não há Obsidian na fila.
- ✅ Templates com as seções novas; regras com a rota de leitura nova.
- ✅ Demanda replanejada com as medições de hoje (commit próprio, antes de executar).
- ⚠️ "Nenhum arquivo fora do permitido": mudaram só o cofre, as regras, a pasta do verificador e **uma linha do roteiro do pulo da Vercel** (autorizada pelo pedido como provisória).

## 5. Decisões provisórias (escolhas da sessão — valem até o dono dizer o contrário)

- [[D-335 - Os roteiros do cofre nao publicam o site|D-335]] — mexer no verificador não monta o site de novo. *Desfazer: tirar uma palavra de uma linha.*
- [[D-336 - A leitura por camadas obrigatoria ate 40 KB o mapa da area|D-336]] — a leitura em três camadas e os números (40 / 15 / 150 KB); sai a regra "ler tudo antes de codar".
- [[D-337 - Uma nota por decisao com nome em portugues a citacao vira|D-337]] — o nome da nota de decisão, a citação como ligação com apelido, e **os números pulados não ganham nota** (a demanda pedia nota para "as duas que faltam": elas nunca tiveram texto — criar seria inventar decisão).
- [[D-338 - Os tetos de tamanho do cofre o que e erro o que e aviso|D-338]] — os tetos de tamanho; o índice gerado tem teto próprio (60 KB) porque 291 decisões não cabem em 15 KB.
- [[D-339 - O que saiu da frente o Arquivo a Ordem curta e a copia|D-339]] — o que foi para a pasta de arquivo; a Ordem curta guarda os resumos longos no arquivo (e não dentro de cada demanda, como a demanda pedia); a cópia repetida removida.

## 6. O que está no ar e o que não está

**Nada está no ar.** Tudo está na branch, neste computador. Banco: não tocado. Site: não publicado. n8n: não tocado.
Quando entrar na main: **o site é montado uma vez** (por causa da linha do roteiro do pulo — é código). O site em si não muda nada. Daí em diante, mexer no cofre ou no verificador não publica.

## 7. Desempenho

Não se aplica (nenhuma tela, porta ou tabela tocada). O checklist de desempenho agora mora nas Regras de Ouro, seção 4.

## 8. O cofre (o que o verificador diz)

620 notas (428 vivas, 192 de história) · camada 1: 30,1 KB de 40 · 296 decisões (148 vigentes, 103 provisórias, 45 revisadas) · 445 lições em 19 notas · 18 notas de banco · 6 de design · 16 mapas · **zero erro**, 5 avisos: 4 ligações antigas que abrem a nota mas não o trecho; 2 ligações quebradas e 4 notas soltas em história; 27 documentos antigos acima do teto de hoje (história, não se reescreve); uma citação a um número de lição que nunca existiu.

## 9. Ficou pendente

- **A bateria de testes das telas não saiu toda verde nesta madrugada:** em quatro rodadas falharam 2, 6, 5 e 2 testes de 719, cada vez testes diferentes, sempre por estouro de tempo; os mesmos arquivos, rodados sozinhos, passam. A máquina estava dividida com a outra frente da fila, e esta sessão não mexeu em nenhum arquivo da plataforma. **Rodar de novo com a máquina livre antes de juntar na main.** (A conferência de estilo e a montagem do site passaram.)
- **A outra frente desta fila (rotinas do banco por evento)** escreve as decisões e lições dela **depois** desta entrar: decisão em nota nova, lição na nota do tema, bloco do banco no fim da nota do domínio. Se ela tiver mexido em algum dos arquivos grandes antigos, a junção vai acusar conflito — resolver levando o trecho novo para a nota certa.
- **A separação por tema e por domínio foi feita por palavra-chave** e conferida à mão só em parte (80 decisões, 19 blocos do banco; nas lições, por amostragem — estimo de 15% a 25% em tema discutível). Nada se perdeu e tudo se acha pelo índice; mover uma lição de nota é seguro.
- **As 3 tarefas do ClickUp não foram criadas** (a fila proíbe mexer no ClickUp). Os nomes estão na demanda.
- **A proposta de rodar a bateria do banco uma vez durante o trabalho e duas só na entrega** continua só proposta.
- **Demandas antigas não têm a seção "Leitura da sessão"** — as novas nascem com ela.
- **Memórias das sessões do Claude Code que apontam para os arquivos antigos** continuam valendo (os nomes existem como índices), mas o caminho mais curto agora é o mapa da área.

### Aguardando decisão do dono

1. Revisar e autorizar a entrada na main (lembrando: monta o site uma vez).
2. Confirmar ou mudar as cinco decisões provisórias acima.
3. Criar (ou mandar criar) as 3 tarefas no ClickUp.
4. A proposta da bateria do banco.

### Próximo passo sugerido

Conferir no Obsidian (seção 3), autorizar a junção, e só então liberar a outra frente para registrar as decisões dela no formato novo.
