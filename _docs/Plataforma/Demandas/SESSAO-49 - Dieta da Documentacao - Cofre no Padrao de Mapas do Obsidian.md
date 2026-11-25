---
titulo: "SESSAO-49 — Dieta da documentação: o cofre no padrão de mapas do Obsidian, regras de leitura rápida e cada demanda lendo só o que precisa"
tipo: demanda
status: ✅ no ar em 25/11/2026, pela subida de 25/11
data: 2026-11-11
origem: pergunta do dono de 11/11 (03:20) — "o Claude Code está demorando muito para executar" — e o pedido de 03:25. Medições feitas no Cowork sobre a main de 11/11 (só leitura).
revisa: a ordem de leitura do CLAUDE.md da raiz e a regra 6/10 ("ler tudo antes de codar"). Não revisa decisão de produto nenhuma.
tags: [cofre, documentacao, obsidian, processo, desempenho-da-sessao]
---

# 🎯 SESSAO-49 — Dieta da documentação

> ↪️ **25/11/2026 — ✅ NO AR**, pela subida de 25/11 ([[handoff_2026_11_25_subida_atualizada|handoff]]). *(Status até 25/11: "📦 entregue na branch (18/11 — espera a revisão do dono para entrar na main)".)*

> **Rodar só depois que a SESSAO-48 estiver na main.** Ela escreve nas mesmas notas (decisões, memória, esquema). Comece a partir da main atualizada.
> **Sessão só de documentação e de um script.** Nada de código da plataforma, banco ou publicação. Se a frente 5 da 48 (documentação não publica o site) ainda não estiver no ar, **cada subida para a main publica o site**: junte os commits e suba poucas vezes, fora do expediente.

## ↪️ 18/11 — Replanejamento (o que mudou desde 11/11; o texto de 11/11 segue abaixo, intacto)

> **Pedido do dono (18/11, 03:51):** *"Vamos rodar a dieta da documentação agora mesmo; planejar melhor a partir das atualizações recentes e executar."* Roda em modo fila (o dono dormindo): o que faltar vira decisão provisória; nada sai do computador (sem envio, sem banco, sem publicação).
> **Onde este replanejamento diverge do texto de 11/11, vale este.**

### O que entrou no cofre depois de 11/11
- **SESSAO-48, 50 e 51 estão na main** (a trava "rodar só depois da 48" caiu). Com elas vieram as decisões até a **[[D-334 - Os pedidos entregues em parte antes desta sessao|D-334]]**, as lições até **[[Memoria - Processo de Sessao Cofre e Dono#E-291|E-291]] / [[Memoria - Publicacao Vercel e Funcoes#A-243|A-243]]** e o **pulo da documentação na Vercel** ([[D-303 - A versao e o codigo e documentacao nao publica a mudanca|D-303]]): subir só `_docs/` não publica mais o site.
- **A revisão de 18/11** (já na main): os 335 critérios de aceite marcados nas demandas entregues, os status corrigidos, o retrato novo no topo de [[000 - PROXIMOS PASSOS]] e as notas ↪️ 18/11 na Ordem das Sessões, nas Perguntas em Aberto, no n8n, no Comercial e nos handoffs. **Consequência para a dieta:** essas notas ↪️ 18/11 são texto vivo e vão junto, sem reescrever, para onde a nota for; o que a revisão marcou como "deixou de ser pendência" não entra nos mapas como pendência.

### As medições de hoje (18/11, pelo script, sobre a main `4d91dd3`)

| O quê | 11/11 (demanda) | **18/11 (medido)** |
|---|---|---|
| Leitura obrigatória (os documentos que o CLAUDE.md manda ler, com o Modelo de Sistema) | 1,1 MB | **1.315,7 KB (~1,3 MB)** |
| Decisões de Produto | 372 KB · 248 decisões | **423,0 KB · 291 decisões com título** (a maior é a [[D-334 - Os pedidos entregues em parte antes desta sessao\|D-334]]) |
| Memória de Aprendizado | 224 KB · 180 E · 157 A · 16 M | **262,5 KB · 222 E · 188 A · 16 M · 9 F · 4 X = 439 entradas** |
| Esquema do Banco | 237 KB | **258,0 KB** |
| Modelo de Sistema | 92 KB | **109,8 KB** |
| Lei de Desempenho | 73 KB | **87,6 KB** |
| Mapa do Projeto | 62 KB | **66,0 KB** |
| Ordem das Sessões | — | **37,6 KB** |
| Notas no cofre | 244 · 12 MB | **258 notas · 447 arquivos · 16,2 MB** (só as notas: 4,5 MB) |
| Ligações quebradas | 33 (todas de imagem) | **2** (o template de handoff aponta para uma nota que não existe; um diário aponta para uma memória de fora do cofre). As de imagem já não aparecem. |
| Notas soltas | 10 | **11** (4 vivas: o `CLAUDE.md` do cofre, a nota da baixa automática de recebimentos, a cópia do handoff de pesquisa em `Planejamento/` e o leia-me das inspirações; 7 de história: diários e um handoff) |

(KB = 1.024 bytes, como o verificador mede; o sistema de arquivos mostra 433 / 269 / 264 / 112 KB em milhares de bytes — são os mesmos arquivos.)

### Correções ao texto de 11/11
1. **A contagem de decisões é a de hoje: 291 notas, não 248.** Os números pulados (44, 64, 69, 149, 160, 177–185, 222–224, 234–259) **não têm texto de decisão em lugar nenhum**: a D-44 foi reservada pela frente do histórico do Tiny e nunca escrita (as respostas do dono viraram a [[D-045 - Logistica e ROTAS unidade pronta lancamento ID de producao|D-45]]), a D-64 "ficou sem uso" (dito no próprio arquivo), e as faixas foram reservas de sessões em paralelo. "As duas que faltam" da nota de 11/11 são a D-44 e a D-64: **não ganham nota** (não há o que mover — inventar o texto seria criar decisão); o índice as lista como "número sem decisão" e o verificador aceita a citação.
2. **As contagens da memória são as de hoje** (222 erros, 188 acertos, 16 modelos, 9 fórmulas, 4 possibilidades). Uma entrada (a do CRLF) ocupa três linhas; o script trata a continuação como parte dela.
3. **`aliases` não faz `[[D-61]]` abrir a nota.** No Obsidian o apelido só aparece na busca e no completar; a ligação aponta para o **nome do arquivo**. Para a ligação abrir de verdade e o grafo mostrar o nome em português: a nota chama `D-061 - <o que a decisão faz>` (como a demanda pede) e toda citação vira `[[D-061 - …|D-61]]` — o leitor vê "D-61", o Obsidian abre a nota. O `aliases` fica no frontmatter para a busca. (Provisória.)
4. **O índice de decisões não cabe em 15 KB.** Com 291 decisões, uma linha por decisão dá ~40 KB. Os três **índices gerados** (decisões, memória, esquema) ganham teto próprio (≤ 60 KB) e **não são leitura obrigatória**: servem à busca. O que a sessão lê é o **mapa da área** (≤ 15 KB), que já traz as decisões vigentes daquela área. (Provisória.)
5. **Nota que não cabe no teto sem reescrever fica como está e vira aviso do verificador** (decisão maior que 8 KB, por exemplo): a regra "não reescrever" vence o orçamento.
6. **O exemplo da leitura ≤ 150 KB** passa a ser medido com uma demanda de hoje (a SESSAO-51) além da 48.
7. **A trava "juntar os commits e subir poucas vezes"** deixou de valer para o cofre ([[D-303 - A versao e o codigo e documentacao nao publica a mudanca|D-303]]); vale o ponto novo abaixo.

### Ponto novo · o pulo da Vercel
Hoje `scripts/vercel-pular-documentacao.sh` só pula quando mudou `_docs/`, `Claude outputs/` ou `.md`. Os roteiros do verificador moram em `scripts/cofre/` (`.mjs`): **cada mudança neles montaria o site de novo**, sem necessidade — o site não usa nada dessa pasta. **Saída (provisória):** acrescentar `scripts/cofre` à lista do pulo. Efeito colateral único e inofensivo: a subida que levar essa mudança monta o site uma vez (o próprio roteiro do pulo é código); daí em diante, mexer no verificador não publica nada.

### Outra frente ao mesmo tempo · SESSAO-34 (rotinas do banco por evento)
Roda em outra mesa da mesma fila. **Combinado:** ela **não mexe** nas notas grandes — Decisões, Memória, Esquema, Lei de Desempenho, Mapa, Ordem das Sessões e Próximos Passos. **As decisões e lições dela entram depois da dieta**, já no formato novo (uma nota por decisão; lição na nota do tema). Esta sessão, por sua vez, **não toca** na demanda nem nas notas da 34. Numeração: esta sessão usa a partir de [[D-335 - Os roteiros do cofre nao publicam o site|D-335]], [[Memoria - Git Shell e Windows 2#E-292|E-292]] e [[Memoria - Processo de Sessao Cofre e Dono#A-244|A-244]]; a 34 numera depois, a partir do que o verificador mostrar.

### Ordem e escopo de execução (18/11)
- Ordem: **1 → 2 → 5 → 3 → 4 → 6**, um commit por frente (a da demanda, para o caso de o tempo apertar).
- **Arquivos que podem mudar:** `_docs/`, `CLAUDE.md`, `scripts/cofre/` e o roteiro do pulo da Vercel. Nada de código da plataforma, banco, n8n ou publicação.
- **ClickUp:** a fila proíbe mexer; as 3 tarefas ficam para o dono criar (os nomes estão na seção "Tarefas no ClickUp").
- **O print do grafo do Obsidian** não sai desta sessão (não há Obsidian na fila): o handoff ensina o dono a conferir; a prova da sessão é o verificador (ligações, contagens, orçamentos).
- **A proposta da bateria do banco** (frente 6) continua só proposta: precisa do OK do dono.

## O pedido do dono (texto fiel, 11/11)

*"Planeje uma próxima sessão para gerar essa dieta de documentação. O formato de memória para o estilo Obsidian deveria resolver justamente essa leitura completa, mas sinto que aos poucos essa memória está se desvinculando. Temos que reestruturar de acordo com o padrão do mapa do Obsidian, para que o Claude Code leia apenas o que cada demanda irá exigir, e o documento obrigatório de regras com o formato otimizado, padrão de design e coisas do tipo — leitura rápida e leve."*

## O diagnóstico (medido em 11/11)

**1. A leitura obrigatória triplicou e não cabe mais numa sessão.** Os oito documentos que o CLAUDE.md manda ler antes de codar somavam:

| Data | Tamanho |
|---|---|
| 30/09 | 393 KB |
| 15/10 | 634 KB |
| 01/11 | 954 KB |
| 11/11 | **1,1 MB** (~180 mil palavras) |

Isso é maior que a memória de trabalho do Claude Code. Ele lê em pedaços, a conversa enche, ele resume a si mesmo e relê.

**2. O cofre não está "quebrado": está concentrado em monólitos.** São 244 notas e 12 MB. Só 33 ligações quebradas (todas de imagem) e 10 notas sem ninguém ligando para elas. O problema é que o conhecimento mora em **três arquivos gigantes que todo mundo aponta**, e seguir uma ligação = ler o arquivo inteiro:

| Nota | Tamanho | Ligações chegando | Conteúdo |
|---|---|---|---|
| Decisões de Produto | 372 KB | 71 | 248 decisões num arquivo só |
| Esquema do Banco | 237 KB | 63 | todas as tabelas `plt_*` numa única seção |
| Memória de Aprendizado | 224 KB | 47 | 180 erros, 157 acertos, 16 modelos, fórmulas e possibilidades num arquivo só |
| Modelo de Sistema | 92 KB | 28 | design inteiro, sem nenhuma ligação saindo |
| Lei de Desempenho | 73 KB | 24 | lei + dívidas + checklist juntos |
| Mapa do Projeto | 62 KB | 49 | virou lista cronológica de handoffs, não mapa |

**3. É aí que mora a "desvinculação" que o dono sente.** As citações "[[D-061 - Cancelamento em tres estagios a aba Cancelados guarda|D-61]]", "[[Memoria - Migrations Aplicador e Ensaio 2#E-19|E-19]]", "[[Memoria - Banco e SQL 2#A-96|A-96]]" estão escritas como **texto**, não como ligação. O grafo do Obsidian não enxerga quem depende de quem. Para achar uma decisão, é preciso abrir o arquivo de 372 KB e procurar.

**4. Os diários e handoffs incham, mas estão fora da leitura obrigatória** (Handoffs 6,3 MB; diários de execução de até 84 KB). Ficam onde estão: só precisam de teto daqui para frente.

## O que muda (o padrão de mapas do Obsidian)

**Três camadas, cada uma com orçamento de tamanho:**

| Camada | O que é | Quem lê | Orçamento |
|---|---|---|---|
| **1 · Obrigatória** | `CLAUDE.md` da raiz + **`000 - REGRAS DE OURO`** | toda sessão, inteira | **≤ 40 KB somadas** |
| **2 · Mapas (MOC)** | um mapa por área do sistema + os índices | os que a demanda listar | **≤ 15 KB cada** |
| **3 · Notas atômicas e temáticas** | uma decisão por nota; esquema e memória por tema | só seguindo ligação ou busca | atômica ≤ 8 KB · temática ≤ 30 KB |

**A regra nova de leitura:** toda demanda traz uma seção **"Leitura da sessão"** com os mapas e as notas que ela toca. O Claude Code lê a camada 1 inteira, os mapas listados e, daí em diante, **só o que as ligações e a busca pedirem**. Meta: uma sessão típica lê **≤ 150 KB** antes de codar (hoje lê 1,1 MB).

### Frente 1 · O documento obrigatório leve: `000 - REGRAS DE OURO` + `CLAUDE.md` enxuto
- **`CLAUDE.md` da raiz (≤ 10 KB):** as 20 regras em formato de lista curta (o quê + 1 linha de porquê), o ciclo da sessão e **a rota de leitura nova**. Detalhe e histórico de cada regra vão para notas ligadas.
- **`_docs/000 - REGRAS DE OURO.md` (≤ 30 KB), em seções curtas:**
  1. **Leis do produto:** [[D-001 - Unidade do card hibrido|D-01]]…[[D-017 - Formato dos prompts do Claude Code minimo so o caminho|D-17]], uma linha cada, com ligação para a nota.
  2. **As decisões que mais pegam:** as ~30 decisões vigentes mais citadas nas demandas (conte as citações), uma linha cada.
  3. **Nunca mais:** as ~30 lições que mais custaram (as que viraram regra ou se repetiram), uma linha cada, com ligação.
  4. **Desempenho — o checklist** (de 1 página, tirado da Lei): orçamentos, proibições e o checklist de fim de sessão.
  5. **Design — o essencial** (de 1 página, tirado do Modelo de Sistema): cores/tokens, componentes que existem, regras de tela (celular 375, tablet 768, botão de toque, cor + texto, sem código na tela) e o padrão pai→filho.
  6. **Banco — o essencial:** as regras que valem antes de qualquer SQL (append-only, prefixo, recriar da versão viva, grant por coluna, índices, RLS com `select`).
  7. **Com o dono:** português de gente, sem códigos.
- O `_docs/CLAUDE.md` do cofre também emagrece e aponta para as Regras de Ouro.

### Frente 2 · Decisões atômicas (o maior ganho)
- **Uma nota por decisão** em `_docs/Plataforma/Decisoes/`: `D-061 - Pedido cancelado com peca em producao.md`. Número com 3 dígitos no nome, para ordenar.
- **Frontmatter padrão:**
  ```yaml
  id: D-61
  aliases: [D-61, D-061]
  data: 2026-09-xx
  status: vigente | revisada | substituida
  revisa: ["[[D-58]]"]
  revisada_por: ["[[D-...]]"]
  area: [producao, estoque]
  tags: [decisao, area/producao]
  ```
  `aliases` faz `[[D-61]]` funcionar no Obsidian e na busca.
- **O texto da decisão é copiado sem reescrever** (é a memória da máquina). Só o título vira uma linha que diz o que a decisão faz.
- **`PLT - Decisoes de Produto.md` vira o índice (MOC), com o mesmo nome**, para as 71 ligações antigas continuarem funcionando: uma linha por decisão (id · o que faz · status · ligação), agrupada por área, com as **vigentes em destaque** e as substituídas recolhidas no fim.

### Frente 3 · Esquema do banco e memória por tema
- **Esquema do Banco** → `_docs/Supabase-fabrica/Banco/` com **uma nota por domínio**. Cada nota leva as tabelas do domínio, as colunas, as funções e portas principais e os gatilhos, **≤ 30 KB**. Domínios sugeridos:
  - Integração Tiny (pedidos, clientes, produtos, itens)
  - Cards e eventos (kanban)
  - Setores, etapas e execução
  - PCP e liberação
  - Estoque e reposição
  - Logística, ROTAS e entregas
  - Expedição e devolução
  - Tempos e painéis
  - Usuários, acesso e logs
  - Tablet e TV
  - Comercial
  - Filas e integrações (Tiny/n8n)
  - Configurações

  `SUPA - Esquema do Banco.md` vira o **índice**: tabela → domínio → ligação, mais "o que NÃO existe".
- **Memória de Aprendizado** → `_docs/Plataforma/Memoria/` com **uma nota por tema** (banco/SQL, migrations e aplicador, front/React, kanban, tempo real, Tiny/n8n, publicação/Vercel, testes, desempenho, tablet, processo de sessão…).
  - Cada entrada mantém o **id como título** (`### E-19 · …`), para `[[Memoria - Banco#E-19]]` funcionar.
  - `PLT - Memoria de Aprendizado.md` vira o **índice** (uma linha por entrada: id · lição · tema), e as entradas novas continuam entrando **na nota do tema**.
- **Lei de Desempenho:** o checklist vai para as Regras de Ouro. A lei fica com o detalhe por tema, e as **dívidas registradas** ganham nota própria.
- **Modelo de Sistema:** o essencial vai para as Regras de Ouro. O resto se divide por componente/padrão em `_docs/Plataforma/Design/`, e o arquivo antigo vira índice.

### Frente 4 · Mapas por área (MOC) e as ligações de verdade
- **Um mapa por área** em `_docs/Mapas/`, ≤ 15 KB cada:
  - Kanban e Produção · PCP · Estoque · Expedição · Logística e ROTAS · Tiny e n8n · Tablet e TV · Tempos e Painéis · Comercial · Acesso e Usuários · Auditoria e Logs · Publicação e Infra (Supabase, Vercel, crons).
  - **Cada mapa:**
    - o que a área é (até 5 linhas);
    - as decisões vigentes;
    - as notas de banco do domínio;
    - as lições do tema;
    - as telas e as pastas do código (`src/...`);
    - as últimas sessões e handoffs da área;
    - as perguntas em aberto da área.
- **`000 - MAPA DO PROJETO` volta a ser mapa (≤ 15 KB):** áreas → mapas, rotas de leitura e onde mora cada coisa. A lista cronológica de handoffs vai para `Mapas/MOC - Sessoes e Handoffs` (uma linha por sessão).
- **`000 - ORDEM DAS SESSOES`:** uma linha curta por sessão + ligação. O resumo longo de cada linha fica na própria demanda.
- **Citação vira ligação:** um script converte `D-NN`, `E-NN`, `A-NN`, `M-NN`, `F-NN` e `X-NN` em texto corrido para `[[D-NN]]` (ou `[[Memoria - Tema#E-NN|E-NN]]`) **nas notas vivas**: regras, mapas, índices, notas atômicas e demandas abertas. Handoffs e diários antigos ficam como estão (são história).
- **Notas soltas (10) e imagens quebradas (33):** ligar no mapa certo ou mandar para `Arquivo/`; consertar o caminho das imagens.
- **`Arquivo/`:** os prompts de bloco antigos, planos noturnos e planos já executados saem da frente (continuam no cofre, achados por busca).

### Frente 5 · O guarda-costas do cofre (para não desvincular de novo)
Um script `scripts/cofre/verificar.mjs` (Node, sem dependência nova), rodado no fim de **toda** sessão e com resultado no handoff:
- **Ligações:** nenhuma quebrada nas notas vivas; nenhuma nota viva solta.
- **Orçamentos:** camada 1 ≤ 40 KB; mapa ≤ 15 KB; nota atômica ≤ 8 KB; temática ≤ 30 KB; demanda ≤ 25 KB; handoff ≤ 15 KB; diário de execução ≤ 30 KB (o que passar vira aviso com o nome da nota).
- **Integridade:**
  - toda `D-NN` citada tem nota;
  - toda nota de decisão tem frontmatter válido;
  - `revisa`/`revisada_por` batem dos dois lados;
  - toda `E/A/M/F/X` citada existe no índice.
- **Índices gerados:** o script **gera** as listas dos índices (decisões por área, memória por tema, esquema por domínio) a partir do frontmatter, entre marcadores `<!-- gerado:inicio -->` / `<!-- gerado:fim -->`. Ninguém mantém lista à mão, e é isso que evita a desvinculação.
- **Modo `--leitura <demanda>`:** soma o tamanho da camada 1 + o que a seção "Leitura da sessão" lista, para provar a meta de ≤ 150 KB.

### Frente 6 · O jeito de escrever daqui para frente
- **Template de demanda:** ganha "Leitura da sessão" (os mapas e notas que a demanda toca), e o Cowork preenche ao escrever.
- **Template de handoff:** ≤ 15 KB; o detalhe técnico fica no diário de execução.
- **CLAUDE.md, regra 6b e 10:**
  - decisão nova → **nota nova** + `[[ligação]]` na demanda (o índice se gera sozinho);
  - lição nova → **na nota do tema**;
  - lição que custou caro → promovida às Regras de Ouro.
- **Toda citação de id em texto novo é ligação** (`[[D-NN]]`).
- **Proposta (vale só com o OK do dono na conversa):** a bateria de teste do banco roda **uma vez** durante o trabalho e **duas vezes só na entrega final**. É o maior tempo de espera fora da leitura.

## Regra de ouro desta sessão: nada se perde
- **Conteúdo é movido, não reescrito.** Só títulos, resumos de uma linha, mapas e índices são texto novo.
- **Contagem antes/depois provada pelo script:** 248 decisões, 180 erros, 157 acertos, 16 modelos, as fórmulas e as possibilidades. Todas as tabelas e funções do esquema também.
- **Os nomes antigos continuam existindo** (viram índices), para nenhuma ligação antiga quebrar.
- Um commit por frente. Se o tempo apertar, a ordem é **1 → 2 → 5 → 3 → 4 → 6**: com 1, 2 e 5 a leitura já cai para menos de um quarto.

## Fora do escopo
- Código da plataforma, banco, n8n e publicação.
- Mudar o conteúdo de qualquer decisão, regra ou lição (só formato e lugar).
- Reescrever handoffs e diários antigos.
- Plugin pago do Obsidian. Se for útil, o Dataview pode ser sugerido ao dono, mas os índices são gerados em texto puro para o Claude Code ler sem plugin.

## Critérios de aceite
- [x] Camada 1 (CLAUDE.md + Regras de Ouro) ≤ 40 KB, medida pelo script. ↪️ 18/11: **30,1 KB**.
- [x] O script, com a demanda da SESSAO-48 como exemplo, mostra a leitura ≤ 150 KB. ↪️ 18/11: **109,5 KB** (estimativa pelas áreas, porque a 48 não tem a seção "Leitura da sessão").
- [x] 248 notas de decisão com frontmatter válido; o índice gerado bate; `[[D-61]]` abre a nota no Obsidian. ↪️ 18/11: **291 notas** (a contagem de hoje); a citação abre a nota por ligação com apelido — **falta o dono conferir no Obsidian**.
- [x] Esquema por domínio e memória por tema, sem perder nenhuma entrada (contagem antes/depois no handoff).
- [x] Um mapa por área, nenhum acima de 15 KB; o Mapa do Projeto volta a ser mapa. ↪️ 18/11: 15 mapas (os 12 da demanda + Meu Painel/Chat/Automações, Interface e Processo).
- [x] Zero ligação quebrada e zero nota solta nas notas vivas; imagens consertadas. ↪️ 18/11: as imagens quebradas já não existiam.
- [ ] Citações de id nas notas vivas viraram ligação; o grafo do Obsidian mostra as decisões ligadas às áreas (print no handoff). ↪️ 18/11: **as ligações estão feitas (1.241); o print do grafo NÃO foi tirado** — a sessão rodou sem Obsidian.
- [x] Templates de demanda e handoff com as seções novas; CLAUDE.md com a rota de leitura nova.
- [x] Nenhum arquivo fora de `_docs/`, `CLAUDE.md` e `scripts/cofre/` foi tocado. ↪️ 18/11: mais uma linha do roteiro do pulo da Vercel (provisória, autorizada pelo pedido de 18/11).

## Notas para o Claude Code
- **Faça com script, não à mão:** a separação das 248 decisões e das ~400 entradas de memória sai de um script que lê os títulos (`## D-NN ·`, `### E-NN`…) e grava as notas. Revise o resultado por amostragem: as 10 maiores, as 10 mais citadas e as revisadas.
- **Cuidado com as decisões que existem só como texto dentro de outra** (há 248 ids distintos e 246 títulos): ache as duas que faltam e dê nota a elas.
- **Obsidian resolve ligação pelo nome da nota:** nomes únicos no cofre inteiro. Mover de pasta não quebra; renomear quebra.
- **Leia com a rota nova:** esta sessão é a primeira a provar a dieta. Anote no diário quanto leu (KB) antes de começar.
- **Regra 12c:** com o dono, português de gente.

## Leitura da sessão (o exemplo da seção nova)
CLAUDE.md da raiz · `_docs/CLAUDE.md` · esta demanda · o índice das três notas monolíticas (só os títulos, com `grep '^## '`) · `Templates/` · `000 - MAPA DO PROJETO` (só a estrutura). **Não precisa ler as notas monolíticas inteiras para dividi-las:** o script faz a divisão pelos títulos.

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)
- ↪️ 18/11: **não criadas** — a sessão rodou em modo fila, que proíbe mexer no ClickUp. *A criar pelo dono (ou com o OK dele):* "Documentação - Regras de leitura rápida para o Claude Code" · "Documentação - Decisões, banco e aprendizados organizados por assunto" · "Documentação - Verificador automático da documentação".

## Resultado (preencher ao entregar)
**Entregue na branch em 18/11/2026** — [[handoff_2026_11_18_sessao49_dieta_da_documentacao|handoff]] · [[SESSAO-49|diário]].

- **A leitura obrigatória caiu de 1.315,7 KB para 30,1 KB** (`CLAUDE.md` 9,0 + [[000 - REGRAS DE OURO]] 21,1). Uma sessão típica lê ~110 KB antes de codar.
- **Movido, sem reescrever** (cada bloco conferido por programa em exatamente uma nota): 291 decisões → `Plataforma/Decisoes/`; 439 lições → 19 notas em `Plataforma/Memoria/`; o esquema (120 blocos, 2.312 nomes) → 18 notas em `Supabase-fabrica/Banco/`; o modelo de sistema → 6 notas em `Plataforma/Design/`; as dívidas da lei → 3 partes; o histórico do Mapa e os resumos longos da Ordem → `Arquivo/`. Os nomes antigos viraram índices.
- **Novo:** 15 mapas de área + o mapa das sessões (`Mapas/`); 1.241 citações viraram ligação; o verificador (`scripts/cofre/verificar.mjs`) — zero erro.
- **Provisórias da sessão:** D-335 · D-336 · D-337 · D-338 · D-339.
- **Pendente:** o print do grafo e a conferência no Obsidian (com o dono); as 3 tarefas do ClickUp; a proposta da bateria do banco; a outra frente da fila registra as decisões dela no formato novo depois desta entrar.

---

## Prompt para abrir no Claude Code (pasta "Domoby - fabrica")

```
Atualize a main (a SESSAO-48 já precisa estar nela), siga o CLAUDE.md e execute a SESSAO-49 — Dieta da documentação (_docs/Plataforma/Demandas/). Leia a demanda duas vezes. É uma sessão só de documentação e de um script: nada de código, banco ou publicação. Nada se perde — conteúdo movido, não reescrito, com contagem antes/depois. Branch própria, um commit por frente, e me peça o OK antes de juntar na main (subida na main publica o site se a 48 ainda não tiver mudado isso). No fim: quanto a leitura obrigatória caiu, como conferir no Obsidian e o que ficou pendente, em português de gente, sem códigos.
```
