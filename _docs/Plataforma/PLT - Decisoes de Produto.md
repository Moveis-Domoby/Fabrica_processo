---
titulo: Plataforma — Decisões de Produto
tipo: decisoes
data: 2026-08-19
atualizado: 2026-08-24
tags: [plataforma, decisoes, produto]
---

# ⚖️ PLT — Decisões de Produto

> [!abstract] Como usar
> Toda decisão estrutural da plataforma ganha um ID (`D-NN`), a data, o que foi decidido e as alternativas descartadas. **Decisão revisada nunca é apagada** — ganha `↩️ revisada em AAAA-MM-DD`. Antes de propor qualquer arquitetura ou tela, ler este arquivo.

## D-01 · Unidade do card: híbrido (19/08/2026)

**Decidido:** o PCP enxerga o **pedido inteiro** para tomar a decisão; ao liberar, cada móvel vira **um card por unidade** (equivalente ao (k/n) atual) que percorre os setores individualmente; as unidades se "juntam" de novo na expedição — pedido completo = todas as unidades prontas.

**Descartadas:** card = pedido inteiro (tempo impreciso quando móveis do mesmo pedido seguem caminhos diferentes); card = unidade desde o início (PCP afogado em cards).

## D-02 · Timer: dois contadores por etapa, dash compara e soma (19/08/2026)

**Decidido (palavras do dono):** "tempo total por etapa, independente se está na fila ou não; conta o tempo parado **na fila entre cada etapa** e **outro tempo na etapa em si**; na dash mostra um comparativo somando esses dois tempos."

Modelo: cada passagem por etapa registra **tempo de fila** (da chegada até o início) e **tempo de execução** (do início ao fim). Dashboards mostram os dois lado a lado e o total somado. Gargalo = fila; produtividade = execução.

**↪️ Detalhamento (24/08/2026):** TODAS as etapas contam o tempo que cada card fica parado nelas, inclusive na fila. **O tempo de fila pertence ao SETOR/etapa, nunca a uma pessoa** — na fila o card ainda não está direcionado a ninguém. O tempo de execução pertence a quem iniciou/finalizou. Propósito declarado: fila longa num setor = **gargalo identificado** = possivelmente contratar mais alguém para o setor. O fluxo, por enquanto, serve para identificar o **tempo de produção por item, por setor e por pessoa**.

## D-03 · Destino do card: manual hoje, automação via API amanhã (19/08/2026)

**Decidido:** movimentação **manual** (PCP e setores decidem), até encontrarmos padrões bem definidos que justifiquem automatizar. Desde o dia 1, porém, a **API aberta permite movimentação, criação, edição e exclusão em cada etapa via automação** — ou seja, a automação de destino poderá nascer no n8n sem mudar o núcleo da plataforma.

**Descartadas (por ora):** sugestão automática com confirmação; roteiro automático por produto. Nota: isso **revisa** parcialmente [[FAB - Processo Alvo - Um Clique Um Evento]] — ver [[PLT - Visao Geral]].

## D-04 · Produtividade e bonificação ↩️ revisada em 19/08/2026

**Decisão original (manhã de 19/08):** medição alimentaria bonificação/meritocracia.

**↩️ Revisão (mesmo dia, palavras do dono):** *"não se preocupe com isso, nem com a bonificação — isso ainda será debatido e decidido; por enquanto veremos apenas como uma **alavancagem operacional**, melhorando cada setor por si só, com a contribuição dos colaboradores."*

**O que fica:** eventos **append-only** e trilha de auditoria completa (RNF-05) — barato de fazer agora, impossível de recuperar depois; se a bonificação voltar, o histórico já existe.
**O que sai do escopo por ora:** pesos/pontos por produto, regras anti-manipulação formais, fluxo de contestação, ranking. As perguntas Q-10–Q-14 ficam **⏸️ adiadas** em [[PLT - Perguntas em Aberto]].

## D-05 · Escopo: produção primeiro, logística depois (19/08/2026)

**Decidido:** a plataforma nasce cobrindo PCP → setores → estoque/expedição. ROTAS continua no ClickUp; o **n8n faz a ponte** durante a transição (a automação ROTAS "entregue" → Tiny, em produção desde 17/08, não pode quebrar).

## D-06 · Dispositivos: tablet/PC fixo por setor E celular pessoal (19/08/2026)

**Decidido:** os dois modos convivem. Tela compartilhada por setor mostrando a fila do setor, com identificação rápida do operador ao agir (PIN/seleção); e login individual no celular pessoal para quem tiver. **Implicação de UX:** tudo que o operador toca precisa funcionar em tela de tablet com botão grande E em celular — o design system nasce mobile-first para o chão de fábrica.

## D-07 · Estoque: módulo da mesma plataforma, fase 2 (19/08/2026)

**Decidido:** primeiro o kanban + tempo (a dor crítica); o estoque entra como **módulo nativo** em seguida, no mesmo banco — card que chega em ESTOQUE vira saldo automaticamente. Não será sistema separado.

## D-08 · Banco: o mesmo Supabase da fábrica (19/08/2026)

**Decidido:** a plataforma nasce sobre o Supabase que já recebe os pedidos do Tiny (P15 — dupla escrita ativa). Card criado automaticamente quando o pedido entra; zero sincronização entre bancos. O schema cresce com as tabelas novas (etapas, eventos de movimentação, usuários, perfis, visualizações salvas). **Regra do cofre continua valendo:** antes de qualquer SQL, ler [[SUPA - Esquema do Banco]].

## D-09 · Qualidade em 3 estados em TODA transição, com dupla atestação (19/08/2026)

**Decidido (pedido da equipe, trazido pelo dono):** o estado físico da peça impacta completamente o andamento entre setores — e **um setor pode dizer que algo está bom apenas para prejudicar o próximo**. Por isso a atestação é **dupla**: quem entrega marca, quem recebe confirma.

**O fluxo:**

1. **Ao mover** o card para outro setor, é **obrigatório** marcar um de 3 estados: 🟢 **perfeito estado** · 🟡 **estado de atenção** · 🔴 **danificado**.
2. **Ao receber**, antes de iniciar qualquer etapa da produção, o setor recebedor vê: *"O setor X marcou como Y — você concorda?"* e registra o próprio parecer.
3. **Se NÃO concorda:** define o novo estado → **notifica um líder** → a peça entra em **pausa momentânea** até o líder resolver.
4. **Se concorda:** 🟢 segue o fluxo padrão · 🔴 vai para DANIFICADO e **notifica líder/admin** · 🟡 pergunta se deseja **seguir o fluxo normal ou notificar o admin**.
5. **Toda decisão entre etapas reflete na dashboard** — qualidade por setor, divergências, quem entrega dano.

**↩️ Revisão (24/08/2026):**

- **Sem foto obrigatória** na saída nem na entrada (Q-15 ✅).
- **Sem fluxo de disputa/pausa por enquanto** (Q-17 ✅): a dupla marcação continua (quem entrega marca, quem recebe registra o próprio parecer), mas divergência **não pausa a peça nem abre resolução formal** — vira registro que alimenta a dashboard. O card segue o fluxo normal de recebimento.
**↪️ Complementos (24/08/2026, segunda rodada):**

- **Notificação (Q-18 ✅):** divergência entre setores, OU marcação 🟡, OU marcação 🔴 → **líder/admin é notificado automaticamente, com exatamente o que aconteceu** (quem marcou o quê, setores envolvidos, os dois pareceres). Isso substitui a escolha manual de 19/08 ("seguir ou notificar") — no 🟡 o card segue o fluxo E a notificação sai sozinha.
- **Critério do 🟡 (Q-16 ✅), nas palavras do dono:** *"levemente danificado, porém ainda dá pra seguir e tentar consertar"* — este texto vai escrito na interface de marcação.
- **API sem estado (Q-19 ✅):** movimentação por API externa **NÃO exige estado de qualidade** — a atestação é um gesto exclusivamente humano. (Proposta do Cowork de estado obrigatório no payload foi descartada pelo dono.)

## D-11 · API antecipada: entrada de pedidos via n8n logo após o kanban (24/08/2026)

**Decidido:** o dono quer a API **já no início** — mas no formato mais simples: **a plataforma recebendo dados do n8n** (n8n chama a API; a plataforma não busca nada no Tiny). Para isso a antiga SESSAO-10 foi dividida: a **[[SESSAO-13 - Entrada de Pedidos via n8n]]** (só o caminho de entrada Tiny → n8n → card no PCP) é executada logo após o kanban, e a SESSAO-10 (API completa: CRUD, webhooks de saída, ponte ROTAS) fica mais tarde. A partir daí, todos os testes das sessões seguintes rodam com **pedido real fluindo sozinho**. Ordem oficial em [[000 - ORDEM DAS SESSOES]] — **o número da sessão é ID, não ordem**.

## D-10 · Método de trabalho: sessões Claude Code ordenadas + CLAUDE.md com limites (19/08/2026)

**Decidido:** a construção acontece em **sessões separadas do Claude Code, por ordem de implementação**, com o dono acompanhando cada uma e abrindo novas sessões de idealização com o Cowork entre elas.

- As sessões vivem em `Plataforma/Demandas/` como `SESSAO-NN - Título.md` — ordem proposta em [[000 - ORDEM DAS SESSOES]].
- As regras de conduta do Claude Code (persona + limites críticos/moderados/básicos) vivem em [[CLAUDE - Regras do Claude Code (repo)]], que **deve ser copiado como `CLAUDE.md` para a raiz do repositório** na Sessão 01.
- Regras-síntese: nunca commitar na main · nunca tocar banco de produção sem aprovação · perguntar antes de ajuste crítico · reler a demanda várias vezes contra a memória de execução (anti-alucinação) · computar tudo enquanto executa · task list espelhando a demanda · handoff ao fim de cada demanda.

## D-12 · Setores do dia 1 = os do ClickUp; estrutura em 2 níveis configurável (24/08/2026)

**Decidido (a partir da print do ClickUp DPTO PRODUÇÃO):** os setores do dia 1 são exatamente os que existem hoje no espaço DPTO PRODUÇÃO:

**PCP · SECC · CNC · FITAMENTO · FURAÇÃO · MONTAGEM · LIMPEZA E EMBALAGEM**

E a estrutura é em **2 níveis, como no ClickUp**: **setores** (o card viaja entre eles) contendo **etapas internas** (status dentro de cada setor). O admin pode **cadastrar novos setores e novas etapas dentro de cada setor** — nada é fixo no código.

**METALURGICA (confirmado pelo dono em 24/08):** **ainda não é um setor utilizado** — apenas futuramente será. Não entra no dia 1; quando for usada, o admin a cadastra (RF-07). Nenhuma lógica do sistema pode assumir a existência dela.

## D-13 · Entrada única e saídas terminais do fluxo (24/08/2026)

**Decidido (palavras do dono):** *"Todos os pedidos chegam exclusivamente primeiro para PCP e por último em estoque ou rotas, ficando ou parado ou entregue lá mesmo."*

- **Entrada única:** todo pedido entra **sempre** pelo **PCP** — não existe card nascendo em outro setor.
- **Saídas terminais:** o card termina em **ESTOQUE** (fica parado lá) ou em **ROTAS** (é entregue). São os dois únicos fins de linha.
- Consequência de modelo: o reagrupamento do pedido (D-01) acontece nesse fim de linha — responde a Q-27.
- ⚠️ Ponto a confirmar na sessão do kanban: na fase 1 a **ROTAS vive no ClickUp** (D-05). Portanto ROTAS existe na plataforma como **setor terminal de handoff** (o card chega lá e a ponte n8n cria o card na ROTAS do ClickUp), ou o fim de linha na plataforma é só ESTOQUE + expedição? Decidir antes de codar a SESSAO-04.

## D-14 · Etapas internas: cadastro livre, cada uma com timer próprio (24/08/2026)

**Decidido (palavras do dono):** *"cada setor tem suas peculiaridades internas, não apenas aguardando, execução e finalizado… para toda etapa diferente que cadastrar dentro de cada setor, essa etapa por si só já carrega um timer interno que passa a contar a partir do momento do cadastro para todo card que chegar lá."*

- **NÃO existe trio padrão** ("na fila → em execução → finalizado") imposto pelo sistema. Cada setor tem suas etapas internas próprias, conforme suas peculiaridades.
- **Toda etapa cadastrada nasce com timer próprio**, automaticamente: card que chega naquela etapa começa a contar tempo ali, sem configuração extra. O timer é propriedade da etapa, não uma feature avulsa.
- **NÃO CHUTAR ETAPAS.** O sistema entrega o cadastro; **o dono cadastra manualmente as etapas de cada setor quando vir a plataforma**. Seeds de etapas internas são proibidos — só os setores da D-12 são semeados.
- Isso substitui a hipótese de trio padrão levantada em Q-26 (respondida).

## D-15 · Stack escolhida pelo Claude Code, e imutável depois (24/08/2026)

**Decidido:** o dono não tem preferência técnica (*"deixe ele escolher a mais assertiva e seguir esse padrão até o fim"*). O Claude Code escolhe a stack do front na Sessão 01, **justifica a escolha**, e ela vira **padrão até o fim do projeto** — trocar depois exige decisão nova aqui. Recomendação registrada do Cowork: **React + Vite + TypeScript + Tailwind** (padrão de mercado, integra nativamente com Supabase, TypeScript reduz erro bobo, Tailwind facilita o design system próprio).

**Banco de desenvolvimento (mesma data):** todo o desenvolvimento roda num **projeto Supabase novo, exclusivo de dev**. O Supabase de produção (D-08) só recebe migrations já testadas, com aprovação explícita do dono — a integração do Tiny está no ar nele.

## D-16 · Bloco 1 de construção = Sessões 01→05 (24/08/2026)

**Decidido:** o primeiro prompt do Claude Code cobre **cinco sessões em sequência** (fundação → banco → auth → kanban → timers), com **PR e checkpoint com o dono ao fim de cada uma**. Ao final do bloco o dono já cadastra suas etapas internas e vê o tempo sendo contado de verdade. Prompt pronto em [[PROMPT - Bloco 1 (Sessoes 01 a 05)]].

## D-17 · Formato dos prompts do Claude Code: mínimo, só o caminho (24/08/2026)

**Decidido (pedido do dono):** o prompt entregue ao Claude Code é o **menor possível** — aponta o caminho do cofre e o bloco a executar, nada mais. Tudo o que ele precisa saber já está escrito nas notas; repetir no prompt cria uma segunda fonte de verdade que envelhece sozinha (viola M-04, "um dono por dado").

- O prompt é entregue **no chat pelo Cowork**, pronto para colar — não vira documento longo.
- Para isso funcionar, [[CLAUDE - Regras do Claude Code (repo)]] abre com a seção **"Ao iniciar qualquer sessão"**, com a ordem de leitura obrigatória. **Manter essa seção viva é o que sustenta prompts curtos.**
- Vale para todos os blocos seguintes: muda só a linha que nomeia o bloco.

## Ver também

[[PLT - Visao Geral]] · [[PLT - Requisitos]] · [[PLT - Perguntas em Aberto]] · [[000 - ORDEM DAS SESSOES]] · [[PROMPT - Bloco 1 (Sessoes 01 a 05)]]
