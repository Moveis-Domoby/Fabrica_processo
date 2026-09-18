---
titulo: PLT - Modelo de Dados (conceito)
tipo: nota
atualizado: 2026-09-17
tags: [plataforma, banco, conceito]
---

> [!info] Origem
> Nota absorvida de `docs/modelo-de-dados.md` do repo em 17/09/2026 (unificação dos docs no cofre). Explica o DESENHO do banco em linguagem de gente, no estado da SESSAO-02 (26/08) — números de sessão citados adiante seguem a numeração antiga. A fonte da verdade técnica e atualizada é [[SUPA - Esquema do Banco]].

# Modelo de dados — Plataforma de Produção Domoby

> Este documento explica **o que o banco guarda e por quê**, em português de gente.
> O SQL executável está em `supabase/migrations/`.
>
> **Estado: aplicado em 26/08/2026** no Supabase da fábrica (projeto `axnzldwgwsmepukdiljx`, org Tech) — o mesmo que recebe os pedidos do Tiny —, com autorização explícita do dono (D-19). As tabelas da integração foram conferidas antes e depois: estrutura idêntica e contagens intactas.

---

## A ideia em um parágrafo

O banco guarda **quem trabalha na fábrica**, **como a fábrica é organizada** (setores e as etapas dentro de cada setor), **os cards** que percorrem esses setores — e, acima de tudo, **os eventos**: cada gesto que alguém faz num card vira uma linha que nunca mais muda. Tempo de fila, tempo de execução, produtividade e qualidade **não são guardados**: são *calculados* a partir dos eventos. É por isso que ninguém consegue "arrumar" um número depois.

---

## Onde a plataforma encosta na integração que já existe

O banco é o mesmo Supabase que hoje recebe os pedidos do Tiny (D-08). Lá já vivem `clientes`, `pedidos`, `pedido_itens`, `eventos` e a função `fn_upsert_pedido`.

**A plataforma não altera nenhuma dessas tabelas.** Tudo o que é novo começa com `plt_`. O único ponto de contato é: **um card aponta para um pedido**.

> ### ⚠️ A armadilha que quase entrou aqui
>
> A função `fn_upsert_pedido` — a única porta de escrita da integração — **apaga e regrava todos os itens do pedido** a cada atualização vinda do Tiny. Se o card tivesse um vínculo formal (*foreign key*) com a linha do item, **toda atualização de pedido passaria a falhar em produção**.
>
> Por isso o card guarda o item como **cópia** (número do item, código e descrição), sem vínculo formal. O card sobrevive à regravação. Está escrito em letras garrafais dentro da migration para ninguém "consertar" isso depois.

---

## As peças, uma por uma

### 👤 Pessoas — `plt_usuarios` e `plt_usuario_setores`

Cada pessoa tem nome, papel (**operador**, **líder** ou **admin**) e os setores em que trabalha. Uma pessoa pode estar em mais de um setor.

O login é **opcional de propósito**: quem só usa o tablet compartilhado do setor se identifica por PIN e pode não ter conta nenhuma; quem usa o celular pessoal tem login (D-06). O PIN é guardado como *hash* — nunca em texto legível.

### 🏭 Setores — `plt_setores`

Nove setores. Os 7 de produção são exatamente os do ClickUp (D-12): **PCP · SECC · CNC · FITAMENTO · FURAÇÃO · MONTAGEM · LIMPEZA E EMBALAGEM** — nomes como a equipe fala, sem tradução. Mais os dois fins de linha da D-13, que o dono pediu para já nascerem junto (D-18): **ESTOQUE** e **ROTAS**.

Cada setor tem um **papel no fluxo**, que é como a D-13 vira regra de banco:

| Papel | Significa |
|---|---|
| `entrada` | todo pedido entra por aqui — hoje, o PCP |
| `producao` | setor do meio do caminho |
| `terminal` | fim de linha: o card fica parado ou é entregue |

O banco **garante que só existe uma entrada**. Não depende de ninguém lembrar.

A **ROTAS** existe aqui como *terminal de handoff*: enquanto a logística viver no ClickUp (D-05), o card chega nesse setor e a ponte do n8n cria o card na ROTAS de lá. Quando a logística migrar para a plataforma, **nada na estrutura muda**.

**METALURGICA não foi cadastrada** — o dono confirmou que ainda não é um setor usado. Quando for, cadastra pela tela de admin.

### 📋 Etapas internas — `plt_etapas`

As etapas dentro de cada setor. **Nenhuma foi cadastrada, e isso é intencional** (D-14): cada setor tem suas peculiaridades e quem sabe quais são é o dono. O sistema entrega o cadastro vazio.

Duas coisas valem sempre:

- **Toda etapa cadastrada já nasce contando tempo.** Não existe botão de "ligar o timer" — contar tempo é natureza da etapa, não um extra.
- Uma etapa pode ser marcada como **fila** (onde o card espera sem dono). Só pode haver uma fila por setor: com duas, o "tempo de fila do setor" ficaria ambíguo e a conta de gargalo perderia sentido.

### 🎴 Cards — `plt_cards`

Dois tipos, como manda a D-01:

- **card de pedido** — o que o PCP enxerga para decidir, um por pedido;
- **card de unidade** — o (k/n) de hoje: cada móvel vira um card que percorre os setores sozinho.

O card também guarda **onde está agora** (setor, etapa, desde quando, quem está executando). Isso é só uma **fotografia para a tela ser rápida** — a verdade é o evento. Nenhuma parte do sistema escreve essa posição à mão: ela é atualizada automaticamente quando um evento entra.

### ⭐ Eventos — `plt_eventos` (a peça mais importante)

Cada gesto vira um evento: card criado, movimentação entre setores, movimentação entre etapas, execução iniciada, execução finalizada, marcação de qualidade, parecer de quem recebeu, divergência, notificação, delegação.

Cada evento registra **quem**, **quando**, **de onde** e **para onde**.

**Evento não pode ser alterado nem apagado.** E essa trava não está no aplicativo — está no banco, valendo inclusive para a chave mais poderosa (a que o n8n usa). Se alguém tentar corrigir um evento, o banco recusa e manda registrar um evento novo. Correção é acréscimo, nunca rasura.

Quando a movimentação vem da API (n8n), o evento não tem pessoa e não tem estado de qualidade — porque **atestação é gesto exclusivamente humano** (D-09, Q-19).

### 🟢🟡🔴 Qualidade — a visão `plt_vw_qualidade_transicoes`

A dupla atestação da D-09 **não tem tabela própria**, e isso é de propósito: quem entrega marca (um evento) e quem recebe dá o parecer (outro evento, que aponta para o primeiro). A transição completa — com a divergência já calculada — é montada a partir desses dois eventos.

Resultado prático: **não existe nenhum lugar onde alguém possa editar um parecer de qualidade depois.**

A visão já entrega pronto:

- **divergente** — os dois pareceres discordaram;
- **exige_notificacao** — houve divergência, ou 🟡, ou 🔴. Nesses três casos líder/admin é avisado automaticamente (D-09, Q-18).

Lembrando a revisão de 24/08: divergência **não pausa a peça** e não abre disputa. Vira registro que alimenta a dashboard.

### ⏱️ Tempo — as visões `plt_vw_permanencias` e `plt_vw_execucoes`

A razão de existir da plataforma, traduzida em duas contas:

| Visão | O que mede | De quem é o tempo |
|---|---|---|
| `plt_vw_permanencias` | quanto tempo o card ficou em cada etapa | **do setor** quando é fila |
| `plt_vw_execucoes` | do "iniciar" ao "finalizar" | **da pessoa** que trabalhou |

É exatamente a D-02: fila longa num setor = **gargalo identificado** = sinal de contratar; execução = produtividade de quem clicou. Na fila o card não está direcionado a ninguém, então esse tempo **nunca** é cobrado de uma pessoa.

A execução guarda **quem iniciou e quem finalizou** separadamente, porque nem sempre é a mesma pessoa — e decidir de quem "conta" seria decisão de produto, que segue adiada (D-04).

### 🔔 Notificações — `plt_notificacoes`

O aviso que chega ao líder/admin, com **o relato do que aconteceu**: quem marcou o quê, setores envolvidos, os dois pareceres. Diferente de evento, aqui "lida" muda com o tempo — mas o fato que gerou o aviso continua imutável no evento. Por onde o aviso sai (plataforma, WhatsApp, e-mail) ainda é a Q-42, em aberto.

### ✅ Tarefas — `plt_tarefas`

"Meus afazeres" e "afazeres do time". Guarda também **como** o responsável foi escolhido (direta ou aleatória) — é isso que permite, depois, ver se o sorteio distribui bem ou concentra em quem já está cheio.

### 📊 Visualizações salvas — `plt_visualizacoes`

Os painéis que cada um monta e salva, com escopo pessoal, do setor ou global. O formato do painel fica num campo flexível, porque ele vai mudar muito entre o desenho e o uso real.

---

## Quem enxerga o quê

| Papel | Enxerga |
|---|---|
| **Operador** | os cards dos setores dele e o que ele mesmo executa |
| **Líder** | tudo do setor onde é líder, e cadastra as etapas desse setor |
| **Admin** | tudo |

Isso é aplicado **pelo banco**, não pela tela: mesmo que alguém chame a API direto, não vê o que não é dele.

Duas ressalvas honestas:

1. A **chave de serviço** (a que o n8n usa) ignora essas regras — é assim que o Postgres funciona. Por isso o que precisa valer para todo mundo, como a imutabilidade dos eventos, está numa trava mais funda, não nas regras de visibilidade.
2. O **mecanismo de login** em si é a SESSAO-03. Aqui está o desenho do acesso, pronto para ele.

---

## O que está pendente neste modelo

- **Cancelamento de pedido (Q-24), produção para estoque (Q-23), terceirizados (Q-22), unidade que se divide em trabalhos paralelos (Q-21), migração dos cards vivos (Q-25)** — todos em aberto. Nada foi inventado para nenhum deles: quando forem decididos, entram como acréscimo.
- **Nenhuma etapa interna cadastrada** — de propósito (D-14). O cadastro está vazio esperando o dono.
- **Automações internas (SESSAO-13)** e **chaves de API (SESSAO-11)** ainda não têm tabela — cada uma vem na sua sessão.

---

## Como isto foi testado

### Fora do banco, antes de aplicar

```bash
npm run test:banco
```

Sobe um Postgres de verdade dentro do Node, carrega **o esquema real da integração** (o mesmo arquivo que roda em produção), aplica as migrations **duas vezes** e verifica:

1. rodam do zero sem erro, duas vezes seguidas;
2. nenhuma tabela ou coluna da integração mudou;
3. `UPDATE` e `DELETE` em evento são recusados;
4. o seed cria os 9 setores e **zero** etapas, sem METALURGICA;
5. a posição do card é projetada pelo evento, sem ninguém escrevê-la;
6. **os itens de um pedido podem ser apagados e regravados com card vivo apontando para o pedido** — ou seja, a integração do Tiny continua funcionando.

Nenhum Supabase é tocado nesse teste. (O mesmo roteiro em Docker está em `supabase/testes/testar-migrations.sh`.)

### No banco de verdade, ao aplicar

```bash
npm run banco:aplicar
```

Mostra o plano e **não aplica** — só com `-- --confirmar` ele escreve. Antes e depois, tira uma impressão digital da estrutura das tabelas da integração e compara as contagens de linha; se qualquer coisa tiver mudado, ele grita e sai com erro.

Na aplicação de 26/08 a impressão digital ficou idêntica e as contagens intactas. Melhor ainda: **a integração do Tiny continuou recebendo pedidos durante e depois da aplicação** — os pedidos foram de 118 para 133 sem nenhum problema.

### Provando o append-only no banco real, sem sujar o banco

Como evento não se apaga, um registro de teste ficaria lá para sempre. A saída foi um bloco que monta o cenário, mede, e termina com um erro **proposital** que desfaz tudo — o resultado vem na mensagem do erro. Está escrito no handoff da sessão, pronto para colar no SQL Editor.
