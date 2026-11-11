---
titulo: "SESSAO-49 — Dieta da documentação: o cofre no padrão de mapas do Obsidian, regras de leitura rápida e cada demanda lendo só o que precisa"
tipo: demanda
status: 📐 pronta para code (rodar DEPOIS da SESSAO-48 entrar na main)
data: 2026-11-11
origem: pergunta do dono de 11/11 (03:20) — "o Claude Code está demorando muito para executar" — e o pedido de 03:25. Medições feitas no Cowork sobre a main de 11/11 (só leitura).
revisa: a ordem de leitura do CLAUDE.md da raiz e a regra 6/10 ("ler tudo antes de codar"). Não revisa decisão de produto nenhuma.
tags: [cofre, documentacao, obsidian, processo, desempenho-da-sessao]
---

# 🎯 SESSAO-49 — Dieta da documentação

> **Rodar só depois que a SESSAO-48 estiver na main.** Ela escreve nas mesmas notas (decisões, memória, esquema). Comece a partir da main atualizada.
> **Sessão só de documentação e de um script.** Nada de código da plataforma, banco ou publicação. Se a frente 5 da 48 (documentação não publica o site) ainda não estiver no ar, **cada subida para a main publica o site**: junte os commits e suba poucas vezes, fora do expediente.

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

**3. É aí que mora a "desvinculação" que o dono sente.** As citações "D-61", "E-19", "A-96" estão escritas como **texto**, não como ligação. O grafo do Obsidian não enxerga quem depende de quem. Para achar uma decisão, é preciso abrir o arquivo de 372 KB e procurar.

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
  1. **Leis do produto:** D-01…D-17, uma linha cada, com ligação para a nota.
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
- [ ] Camada 1 (CLAUDE.md + Regras de Ouro) ≤ 40 KB, medida pelo script.
- [ ] O script, com a demanda da SESSAO-48 como exemplo, mostra a leitura ≤ 150 KB.
- [ ] 248 notas de decisão com frontmatter válido; o índice gerado bate; `[[D-61]]` abre a nota no Obsidian.
- [ ] Esquema por domínio e memória por tema, sem perder nenhuma entrada (contagem antes/depois no handoff).
- [ ] Um mapa por área, nenhum acima de 15 KB; o Mapa do Projeto volta a ser mapa.
- [ ] Zero ligação quebrada e zero nota solta nas notas vivas; imagens consertadas.
- [ ] Citações de id nas notas vivas viraram ligação; o grafo do Obsidian mostra as decisões ligadas às áreas (print no handoff).
- [ ] Templates de demanda e handoff com as seções novas; CLAUDE.md com a rota de leitura nova.
- [ ] Nenhum arquivo fora de `_docs/`, `CLAUDE.md` e `scripts/cofre/` foi tocado.

## Notas para o Claude Code
- **Faça com script, não à mão:** a separação das 248 decisões e das ~400 entradas de memória sai de um script que lê os títulos (`## D-NN ·`, `### E-NN`…) e grava as notas. Revise o resultado por amostragem: as 10 maiores, as 10 mais citadas e as revisadas.
- **Cuidado com as decisões que existem só como texto dentro de outra** (há 248 ids distintos e 246 títulos): ache as duas que faltam e dê nota a elas.
- **Obsidian resolve ligação pelo nome da nota:** nomes únicos no cofre inteiro. Mover de pasta não quebra; renomear quebra.
- **Leia com a rota nova:** esta sessão é a primeira a provar a dieta. Anote no diário quanto leu (KB) antes de começar.
- **Regra 12c:** com o dono, português de gente.

## Leitura da sessão (o exemplo da seção nova)
CLAUDE.md da raiz · `_docs/CLAUDE.md` · esta demanda · o índice das três notas monolíticas (só os títulos, com `grep '^## '`) · `Templates/` · `000 - MAPA DO PROJETO` (só a estrutura). **Não precisa ler as notas monolíticas inteiras para dividi-las:** o script faz a divisão pelos títulos.

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)
- *A criar com o OK do dono:* "Documentação - Regras de leitura rápida para o Claude Code" · "Documentação - Decisões, banco e aprendizados organizados por assunto" · "Documentação - Verificador automático da documentação".

## Resultado (preencher ao entregar)
*Quanto a leitura obrigatória caiu (antes/depois), o que foi movido para onde, o print do grafo, o que ficou pendente.*

---

## Prompt para abrir no Claude Code (pasta "Domoby - fabrica")

```
Atualize a main (a SESSAO-48 já precisa estar nela), siga o CLAUDE.md e execute a SESSAO-49 — Dieta da documentação (_docs/Plataforma/Demandas/). Leia a demanda duas vezes. É uma sessão só de documentação e de um script: nada de código, banco ou publicação. Nada se perde — conteúdo movido, não reescrito, com contagem antes/depois. Branch própria, um commit por frente, e me peça o OK antes de juntar na main (subida na main publica o site se a 48 ainda não tiver mudado isso). No fim: quanto a leitura obrigatória caiu, como conferir no Obsidian e o que ficou pendente, em português de gente, sem códigos.
```
