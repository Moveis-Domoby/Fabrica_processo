---
titulo: Handoff — 2026-10-14 · SESSAO-31 · Kanban completo (card avulso, janela do card, anexos, conversa e pausa com motivo)
tipo: handoff
data: 2026-10-14
atualizado: 2026-10-15
tags: [handoff, sessao, sessao-31, bloco-6, kanban, pcp, card-avulso, anexos, conversa, mencoes, pausa, rotas, devolucao, desempenho]
---

# 📋 Handoff — 14/10/2026 · SESSAO-31 · Kanban completo

> [!success] Entregue — as 7 etapas no ar (sessão noturna)
> Ordem do dono (14/10): *"Você será uma sessão noturna, então não me pergunte nada, apenas valide e entregue, faça todos os testes necessários."* Cada etapa foi validada inteira (bateria do banco, tipos, revisão de estilo, testes, montagem e ensaio desfeito no banco real), depois **aplicada e publicada num gesto só** (E-73). O que faltou decidir virou **decisão provisória** (§6). **Falta só o que é do dono:** olhar as telas no celular e no tablet (o navegador do app não está logado e o Claude não entra com senha) e dizer sim/não às decisões provisórias. Memória técnica completa: [[SESSAO-31]] (`Plataforma/Execucao/SESSAO-31.md`).
>
> **↪️ Atualizado em 15/10:** os **ajustes do dono da noite de 14/10** (PCP segue o Tiny, área Pedidos, quadro, pausa, menu, versão nova) e a **validação navegando no site** em 15/10 (com a mãozinha do quadro) — **§10**.

**Branch:** `sessao-31-kanban-completo` (cada etapa foi à `main` por avanço direto — D-20). **Demanda:** [[SESSAO-31 - Kanban Completo - Card Avulso Janela do Card Anexos e Conversa]]. **Plano:** [[004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo]]. **Banco:** migrations **66 a 73** + a manutenção `2026-10-14_expedicao_conclui.sql` (integração do Tiny idêntica em todas — `e2109f3a…`). **Bateria do banco:** 848 → **970 verificações, tudo verde** (rodada 2× no fechamento); testes da tela 152 → **162**. **Decisões:** D-125…D-131.

## 1. Objetivo da sessão

Todo o kanban numa sessão só: o **card avulso** (aba Lançamento manual do PCP), a **frente enxuta** do card, a **janela do card** para todo card (propriedades, descrição, tempo, histórico, anexos de imagem, PDF e áudio), a **conversa** com **menções** (sino + cartão na conversa particular) e a **pausa com motivo** — tudo dentro da [[PLT - Lei de Desempenho e Escala]] (quadro, tablet e sino ao vivo por websocket). O dono ampliou o escopo com **4 ajustes da equipe** (D-126…D-130) e a pergunta 10 virou editar/apagar mensagem (D-131).

**Respostas e ajustes do dono (13–14/10):**
- **D-125** (perguntas 1–10): avulso criado por PCP/logística + líderes + admin; "Concluir" só no avulso, em qualquer setor; vínculo é só referência; etiqueta: quem edita põe/tira, criar só líder/admin, nome repetido recusado; responsável e mencionado veem aquele card; anexos 25 MB, áudio 5 min; pausa: lista + "Outro", o operador pausa o dele, líder/admin qualquer um do setor.
- **D-126** (pergunta 3 + ajuste 2): a marcação do estado da peça vira **configuração por setor, por tipo de card, no envio e no recebimento — tudo nasce desligado**.
- **D-127** (ajuste 1): a LIMPEZA E EMBALAGEM **conclui pela etapa EXPEDIÇÃO**; o botão "Concluir produção" sai.
- **D-128** (ajuste 3): **várias rotas por dia** no mesmo caminhão, cada uma com ordem e equipe próprias.
- **D-129** (pergunta 11 + ajuste 4): o entregador perde o "Pedido devolvido"; a **logística** marca; as peças ficam **"Em decisão pós devolução"**; "Decidir situação" (reenviar, estoque, realocar, danificados, loja, ajuste). O marcador "Devolvido" do Tiny não faz nada (D-124).
- **D-130:** o **ajuste de peça** — a peça volta à produção com destino final escolhido pelo PCP, aplicado na EXPEDIÇÃO.
- **D-131** (pergunta 10): editar e apagar mensagem, no card **e no chat**; o admin vê as apagadas só nas conversas de que já participa.

## 2. O que foi feito — por etapa

### Etapa A — estado da peça como chave + EXPEDIÇÃO conclui + marcador "Devolvido" ✅
- Em **Configurações → Setores e etapas** (só admin, só setores de produção): "Pedir ao enviar" / "Pedir ao receber" × Peça de pedido / Peça de estoque / Card avulso — **tudo desligado**. Sem chave, o arrasto manda direto (sem janela de estado); a confirmação de chegada pendente vem **projetada no card** (o quadro deixou de fazer 2 consultas a cada 20 s).
- A etapa ganha a rota **"Conclui a produção"**; a EXPEDIÇÃO da LIMPEZA E EMBALAGEM foi marcada — soltar ali conclui a peça (Pedidos em aguardo ou ESTOQUE, o banco decide). As **6 peças** que já estavam na EXPEDIÇÃO (508, 509, 511–514 — pedidos 13207 e 13177) foram para Pedidos em aguardo.
- **Marcador "Devolvido" do Tiny** deixou de ser cancelamento. Retrato no banco real: 113 pedidos com o marcador, nenhuma peça viva fora dos cancelados — nada mudou no que existe.
- Migration 66 + manutenção; site e4697b7.

### Etapa B — devolução decidida pela logística + ajuste de peça ✅
- "Pedido devolvido" saiu da tela do entregador; a logística/admin marca em **Entregas** (pedido na ROTAS) e na **janela do pedido no PCP** (pedido entregue — escolhe as peças que voltaram), com motivo da lista nova **"Motivos de devolução"** (7 frases) e observação.
- As peças ficam em **"Em decisão pós devolução"** (fim de linha interno novo, continuam do pedido); aviso no sino para admins e logística → abre **"Decidir situação"** no Estoque: reenviar · estoque · realocar · danificados · loja · ajuste.
- **Estoque:** linha "Em decisão pós devolução" nos números, filtro, resumo, cartão e detalhe. **PCP:** a situação nova.
- **Ajuste de peça** (D-130): tipo de card no Lançamento manual; o destino final é aplicado quando a peça conclui.
- Ensaio com uma devolução de verdade (pedido 13645) — desfeito. Migration 67; site c6f890a.

### Etapa C — várias rotas por dia ✅
- A programação ganhou a **rota** (Rota 1, Rota 2…); tudo o que existia virou Rota 1. O modal de programar pergunta a rota (as do caminhão no dia + "Nova rota"); "Já programadas" agrupa dia → caminhão → rota (mapa, ordem e equipe por rota); "Entregas do dia" com um botão por rota; a equipe é **por rota** (troca de turno).
- Migration 68; site 1d2b982.

### Etapa D — card avulso, frente do card, etiquetas e o quadro numa requisição ✅
- **PCP → Lançamento manual** (aba nova, pedaço próprio do pacote): **Novo card** (nome + Enter; atalhos responsável · datas · prioridade/etiqueta; "Mais detalhes": descrição, vínculo opcional — pedido, produto ou peça —, lançar já; tipo **Ajuste de peça**); **Mostrar** A lançar · Em produção · Concluídos (no servidor); Lançar; Concluir.
- O avulso anda **como a peça** nos quadros e no tablet (tempo, limite de 1, PIN); termina no **Concluir** (ou na etapa que conclui); nunca vai a estoque/aguardo/ROTAS; fora das contas de peças, dentro dos tempos.
- **Frente do card:** etiquetas, rostos dos responsáveis (até 3 + "+N"), vencimento atrasado com ícone + texto, botãozinho da descrição (passar o mouse / tocar), vínculo, contadores de anexos e mensagens, selo do ajuste — tudo **projetado no card** (sem consulta a mais).
- **Etiquetas pelas pessoas** (↩️ D-101); campo customizado vale em avulso.
- **Quadro do setor e tablet numa requisição**, ao vivo pelo canal privado do setor; "Ver mais" por cursor; **saíram** os relógios de 20 s, a consulta por coluna e a escuta da tabela de cards inteira. 800 cards num setor: **quadro 6,5 ms**.
- Migrations 69 e 70; site ad1669d.

### Etapa E — janela do card e anexos ✅
- **A janela vale para todo card** (peça, avulso, reposição, card do pedido): clique no card (clicar não é arrastar; Enter abre, Espaço pega), **link próprio** (`?card=`), ESC fecha, no celular ocupa a tela. Abrir = **1 requisição** (~2 ms); histórico e anexos **só no clique**.
- Propriedades editáveis por quem pode (responsáveis, datas, etiquetas, campos), descrição, nome do avulso, Concluir, tempo e histórico (o estorno do líder segue lá).
- **Anexos:** imagem (miniatura), PDF, áudio (tocador); botão, arrastar e soltar, câmera, **gravar áudio** (até 5 min); 25 MB; tirar = some para todos, o admin ainda vê ("Mostrar os tirados").
- Migration 71; site e8ecc94.

### Etapa F — conversa do card, menções, sino ao vivo, editar/apagar ✅
- **Conversa** na coluna da direita, **ao vivo** pelo canal privado do card (sem releitura), 10 por página com "Ver anteriores", filtro **Só conversa | Tudo** (os movimentos do card em língua de gente).
- **@menção:** aviso no sino + **cartão "📌 mencionou você no card"** na conversa particular, com **"Abrir card"**; mencionar a si mesmo não avisa; o mencionado passa a ver o card. **Responsável adicionado** recebe aviso.
- **Sino ao vivo:** saiu o relógio de 30 s; o aviso chega pelo canal da pessoa.
- **Editar/apagar** a própria mensagem, no card e no chat: todos veem "editada" / "Mensagem apagada"; o admin vê o texto e as versões só nas conversas de que participa.
- Migration 72; site b944aa8.

### Etapa G — pausa com motivo ✅
- Soltar no **PARADO** um card **em execução** pergunta **"Por que parar?"** (lista + "Outro"; no tablet, PIN antes e botões grandes) — o tempo fecha como antes; o motivo fica na frente: **"Parado · Falta de material · há 2h"**.
- A janela do card tem **Pausar / Retomar** (no tablet, com PIN): pausado não conta tempo nem ocupa o limite; frente: **"Pausado · motivo · há X"**; retomar com outra execução aberta continua recusado.
- Quem pausa: **o próprio operador** (o card dele), o líder do setor, o admin.
- **Configurações → Utilitários → "Motivos de pausa"** (6 frases semeadas) e, em Setores e etapas, **"Parar aqui pede o motivo"** (ligado hoje só no PARADO da MONTAGEM — o PARADO do PCP ficou de fora, ninguém executa lá).
- O motivo aparece também no histórico do card.
- Migration 73; site 0d2b52c → 1a8dc40.

### Etapa H — fechamento ✅
- O carregador antigo do quadro (uma consulta por coluna, com relógio) saiu do código; bateria 2×, tipos, revisão de estilo, testes, montagem; alertas do Supabase; registro de uso; checklist da lei; este handoff. Site ac9af5d em diante.

## 3. Como testar — passo a passo (para o dono)

1. **Card avulso:** PCP → **Lançamento manual** → **Novo card** → digite um nome → Enter. Aparece em "A lançar". **Lançar** → MONTAGEM: cai na fila do quadro da MONTAGEM. Arraste para MONTANDO (o tempo começa). **Concluir** → some do quadro e aparece em "Concluídos".
2. **Frente do card:** crie um avulso com responsável, vencimento de ontem, uma etiqueta e uma descrição → no quadro: os rostos, "atrasado" com ícone, a etiqueta e a descrição ao passar o mouse no botãozinho.
3. **Janela:** clique num card → mude um responsável e uma data → feche: a frente mudou junto. Copie o endereço e abra em outra aba: abre o mesmo card.
4. **Anexos:** na janela, envie uma foto e um PDF e grave um áudio curto; o contador sobe. Tire o áudio; como admin, "Mostrar os tirados" o traz de volta (marcado).
5. **Conversa e menção:** escreva "@" + o nome de alguém → com essa pessoa logada: aviso no sino e cartão no chat particular; "Abrir card" abre a janela certa. Edite e apague uma mensagem sua.
6. **Ao vivo:** abra o quadro da MONTAGEM em duas abas e arraste um card numa delas → a outra muda sozinha.
7. **Pausa com motivo:** comece um card (MONTANDO) → arraste para PARADO → escolha o motivo → a frente mostra "Parado · motivo · há…". Volte para MONTANDO (o tempo recomeça e o motivo some). Na janela de um card em execução: **Pausar** (com motivo) → **Retomar**.
8. **Estado da peça (D-126):** Configurações → Setores e etapas → um setor de produção → ligue "Pedir ao enviar · Peça de pedido" → arrastar uma peça para a etapa que manda ao próximo setor passa a perguntar o estado. Desligue de novo.
9. **EXPEDIÇÃO (D-127):** na LIMPEZA E EMBALAGEM, arraste uma peça de pedido para EXPEDIÇÃO → "Peça concluída — está em Pedidos em aguardo".
10. **Várias rotas (D-128):** Programação → programe um pedido num caminhão que já tem rota no dia → escolha "Nova rota" → em "Já programadas" aparecem Rota 1 e Rota 2, cada uma com a sua equipe.
11. **Devolução (D-129):** Entregas → um pedido na ROTAS → "Pedido devolvido" (motivo) → o sino avisa a logística → tocar abre "Decidir situação" no Estoque → escolha "Estoque" para uma peça.
12. **Celular (375 px) e tablet (768 px):** abra o quadro, a janela do card e o Lançamento manual — nada estoura a borda, os toques são grandes.

## 4. Critérios de aceite — um a um

| Critério | Situação |
|---|---|
| Lançamento manual: criar só com o nome (Enter), atalhos, vínculo opcional, 3 visões paginadas no servidor | ✔ bloco 69 + ensaio (800 avulsos: lista 7,7 ms) |
| Avulso anda por arrasto no quadro e no tablet (PIN): tempo, limite, histórico, Concluir | ✔ blocos 69/70 + ensaio desfeito |
| Avulso fora de estoque, reserva, Top X e peças concluídas; dentro dos tempos | ✔ bloco 69 (mapa das ~90 portas que filtram por tipo) |
| Frente enxuta (etiquetas, avatares, vencimento ícone + texto, descrição no mouse/toque, contadores) | ✔ no código e nos testes · **375 px: conferência visual pendente com o dono** |
| Janela em todo tipo de card, por clique e pelo link; cada parte só busca ao abrir | ✔ (1 requisição ~2 ms; histórico/anexos no clique; canal só aberto) |
| Anexar imagem, PDF e áudio; privado, link curto; removido por evento; quem não vê o card não abre | ✔ bloco 71 + ensaio |
| Conversa em tempo real (duas abas), 10 por página | ✔ bloco 72 + testes de cache + ensaio (canal recebeu) |
| Menção: sino + cartão particular, balão ao vivo, "Abrir card", a si mesmo não avisa | ✔ bloco 72 + ensaio |
| Pessoas põem e tiram etiqueta; automação igual; campo vale em avulso | ✔ bloco 69 (os blocos da S27 seguem verdes) |
| Pausa com motivo (PARADO pergunta; Pausar/Retomar na janela; motivo na frente e no histórico; D-48 intacta) | ✔ bloco 73 + ensaio desfeito |
| Tudo que grava autor deixa rastro; nenhum evento editado ou apagado | ✔ bateria ("eventos imutáveis"); editar/apagar mensagem = fato novo |
| Celular 375 px e tablet 768 px | **pendente com o dono** (navegador do app sem login) |
| Revisões como D-NN (↩️ D-101, D-59, D-22) | ✔ D-125…D-131, com as anotações ↩️ em D-22, D-48, D-59 e D-101 |
| §4c: "Devolvido" do Tiny não é cancelamento; cancelado segue ao estoque; pergunta 11 aplicada | ✔ bloco 59 revisto + ensaio; D-129 |
| Network: quadro = 1, Ver mais = 1, janela = 1; nada se repete sozinho | ✔ no código e no banco · **conferência na aba Rede pendente com o dono** |
| Busca no código: nenhum relógio/escuta de tabela no quadro, tablet, PCP e sino | ✔ (o carregador antigo do quadro saiu na etapa H) |
| Porta do quadro e da janela ≤ 50 ms com volume ×100 | ✔ quadro 6,5 ms (800 cards), janela 2,1–3,4 ms |
| Clique duplo em Salvar/Enviar/Anexar = um efeito | ✔ chave por gesto (criar, mensagem, anexo); pausar repetido devolve nulo |
| Checklist da lei (§12) no handoff, com pacote antes/depois | ✔ §5 |
| ClickUp: FAZENDO ao começar, nunca concluído, dono avisado | ✔ 7 tarefas em FAZENDO, cada uma com comentário; nenhuma concluída |

## 5. Checklist de desempenho da lei (§12)

- [x] **Requisições:** quadro do setor e tablet = 1 (antes: 1 por coluna + Chegada + execuções + pedidos + pessoas + campos, relidas a cada 20 s); "Ver mais" = 1 (cursor); janela = 1; conversa = 1 página + canal; Lançamento manual = 1. *Conferência na aba Rede do navegador: com o dono.*
- [x] **Busca no código:** zero relógio e zero escuta de tabela no quadro, no tablet, no PCP e no sino. Seguem fora (SESSAO-32): bolinha de execução, Meu Painel, Afazeres, Visão do dia, Expedição, Danificados, painéis de admin.
- [x] **EXPLAIN no banco real** (transação desfeita): quadro 6,5 ms com 800 cards (4,9 ms na MONTAGEM depois da pausa), Ver mais 4,2 ms, janela 2,1–3,4 ms, conversa com 300 mensagens 20 ms, "Tudo" 3 ms, devoluções 2,6 ms, rotas do dia 7,6 ms.
- [x] **Índices:** toda chave estrangeira nova tem índice; índice próprio das colunas do quadro; advisors **sem item de tipo novo** (as 33 chaves sem índice são antigas — dívida #8; "sem uso" 18 → 34 porque os índices desta sessão nasceram hoje).
- [x] **RLS:** a leitura dos cards reescrita com `(select …)` e com os participantes; tabelas novas sem política (só pelas portas).
- [x] **Listas:** conversa, "Ver mais" e Lançamento manual no servidor por cursor/página com teto.
- [x] **Pacote** (primeiro carregamento): **1.862,5 kB / 507,1 kB gz** (fim da 30) → **1.930,9 kB / 528,8 kB gz** (principal 1.536,3 + Supabase 382,6 + runtime 12,0). Pedaços próprios: janela 23,7 kB / 7,4 gz · conversa 12,5 / 4,5 · Lançamento manual 14,4 / 4,6. Acima do teto de 250 kB gz — dívida #4 (SESSAO-32).
- [x] **Escrita idempotente:** criar card, mensagem e anexo com chave por gesto; devolução repetida em 10 min = o mesmo efeito; pausar repetido não pausa de novo.
- [ ] **Tablet/celular sem travada (INP):** não medido — sem login no navegador do app; **com o dono**.
- [x] **Telas tocadas adequadas:** o que ficou fora está no §14 da lei — **dívida 16 nova** (porta do quadro do PCP, média 157 ms no registro de uso; a 31 tocou o PCP só com a aba nova) e a 15 (abertura do PCP).
- **Registro de uso (`pg_stat_statements`):** nenhuma porta nova no topo; o topo continua sendo o estoque e o PCP antigos (SESSAO-32).

## 6. Decisões provisórias (o Claude escolheu o caminho conservador — dizer sim ou não)

> [!success] ✅ Todas confirmadas pelo dono em 15/10/2026 — *"1 sim, 2 sim, 3 sim, 4 sim, 5 sim, 6 sim"* → **D-136**.

1. **Tablet:** a janela do card é só para ver (sem dado de cliente); mudar, anexar e conversar pelo computador ou pelo celular. **Exceção:** Pausar/Retomar, com PIN.
2. **Programar:** quando o caminhão já tem rota no dia, a rota marcada é "Nova rota"; no Reprogramar, a rota em que o pedido já está. A rota nova já vem com a **equipe da rota anterior** do mesmo caminhão. "Rota N" só aparece quando o caminhão tem mais de uma rota no dia.
3. **"Líder"** (para criar card e etiqueta) = papel de líder ou marca de líder em algum setor; quem trabalha no setor também conclui o avulso (no tablet com PIN).
4. **Busca de peça para ajuste:** só peça em decisão pós devolução, no ESTOQUE (não reservada), em aguardo ou já entregue.
5. **Mensagens:** cada pessoa edita e apaga **só a própria**; a menção vale na hora de escrever (editar não avisa de novo).
6. **Pausa:** "Parar aqui pede o motivo" nasce ligado só no PARADO da MONTAGEM (o admin liga em outras etapas em Setores e etapas).

## 7. O que ficou pendente

- **Conferência visual** no celular (375 px) e no tablet (768 px), a aba Rede e a fluidez no tablet — **com o dono** (o Claude não entra com senha). **↪️ 15/10:** com o dono logado no navegador do app, o Claude conferiu a 375 px a área Pedidos, o menu e Setores e etapas; o tablet (768 px) segue com o dono.
- A **prévia** da conversa na lista do chat (e os 5 últimos comentários na tela do entregador) mostra o texto de antes de editar/apagar até chegar a próxima mensagem — a mensagem em si aparece certa.
- **Os 4 ajustes da equipe** (D-126, D-127, D-128, D-129/D-130) **não têm tarefa** na lista PRODUÇÃO do ClickUp (o Claude não cria tarefa — regra 19): o dono decide se cria.
- **Dívida 16** (porta do quadro do PCP) e o resto da lei: [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]].

## 8. ClickUp (regra 19)

As 7 tarefas da demanda estão em **FAZENDO**, cada uma com o comentário do que foi entregue e de como conferir; **nenhuma foi concluída** — quem conclui é o dono:
[Cartões avulsos](https://app.clickup.com/t/17tya50fbyc) · [Frente do card](https://app.clickup.com/t/17tya50fm3r) · [Janela do card](https://app.clickup.com/t/17tya50fm3t) · [Anexar PDF e imagem](https://app.clickup.com/t/17tya50fbzq) · [Conversa com menções](https://app.clickup.com/t/17tya50fm3u) · [Pausa com motivo](https://app.clickup.com/t/17tya50fc0c) · [Quadros, tablet e sino ao vivo](https://app.clickup.com/t/17tya50fm44).

## 9. Para a máquina — onde está cada coisa

- **Migrations:** 66 `20261014120000_plt_qualidade_configuravel_expedicao` · 67 `…130000_plt_devolucao_decidida` · 68 `…140000_plt_varias_rotas_por_dia` · 69 `…150000_plt_card_avulso` · 70 `…160000_plt_quadro_numa_requisicao` · 71 `…170000_plt_janela_do_card` · 72 `…180000_plt_conversa_do_card` · 73 `…190000_plt_pausa_com_motivo` — detalhe em [[SUPA - Esquema do Banco]].
- **Front:** `src/kanban/{useQuadro,quadro,avulso,pausa,arrasto}.ts` · `src/kanban/janela/*` (janela, anexos, gravador, conversa) · `src/kanban/lancamento/*` · `src/kanban/componentes/{CartaoUnidade,QuadroKanban,ModalConcluirAvulso,ModalMotivoPausa}.tsx` · `src/paginas/{QuadroSetor,TelaSetor,PCP,Estrutura,Utilitarios,Programacao,EntregasDoDia}.tsx` · `src/rotas/*` · `src/logistica/devolucao*` · `src/chat/*` · `src/notificacoes/*`.
- **Harness:** blocos 66–73 em `supabase/testes/testar-migrations.mjs`.
- **Aprendizados:** E-92 (parêntese a mais numa manutenção — o ensaio pegou) e E-93 (`cd` de novo — formatador e bateria por caminho absoluto) em [[PLT - Memoria de Aprendizado]].

## 10. Ajustes do dono (14/10 noite) e validação no site (15/10)

Pedido do dono (14/10, com vídeo e imagens): *"Muita coisa está ruim ou mal feita, ajuste"* — e, no fim, *"valide tudo navegando no front e corrigindo erros de modais, utilizações, layout quebrado, dados errados ou conflitantes"*. No meio da validação: *"um botão para arrastar para o lado no kanban, clicando com o mouse no meio, no estilo de mãozinha"*. Decisões **D-132…D-135**; diário nas levas 1–4 de [[SESSAO-31]].

**O que mudou:**
- **O PCP segue o Tiny (D-132):** pedido Faturado, Pronto para envio, Enviado, Entregue, Não entregue ou Cancelado no Tiny sai do PCP; o painel e o quadro contam igual. O "recebido" das imagens era do **pagamento** — no banco, dos 23 pedidos parados no PCP, 22 estavam "Preparando envio" (o normal de quem espera produção) e 1 "Faturado" (saiu).
- **Expedição (D-133):** só pedido vivo, previsão mais próxima primeiro, ao vivo (saiu o relógio de 30 s).
- **Ao vivo entre áreas:** voltar a uma tela relê o que mudou enquanto a pessoa estava fora — lançar do PCP aparece no setor sem recarregar.
- **Quadro (D-135):** sem a mensagem vermelha piscando na troca de setor; só a coluna com card cresce; linha fina entre colunas; nada de "Vazio"; "Concluir" só no avulso; **mãozinha** — no computador, segurar o fundo do quadro (ou o botão do meio do mouse) e arrastar corre as colunas; o card só se arrasta com o botão esquerdo (a biblioteca pegava também o do meio — achado e corrigido na validação, E-99).
- **Pausa** no desenho do motivo da entrega; **Utilitários** com a aba "Motivos de pausa"; **Lançamento manual** em cards comuns.
- **Menu:** hierarquia clara e um padrão só de nome; no celular, a coluna dos grupos vira ícones quando os itens abrem (os nomes não quebram).
- **Área Pedidos (D-134):** "Todos os pedidos" (saiu do PCP) e "Cancelados" (saiu da Logística, com o histórico inteiro — 164) — lista leve por cursor e ficha com revelação gradual (Itens e pagamento · Produção · Entrega e comprovante · Dados do Tiny · Histórico). O **comprovante** aparece na ficha (imagem ali mesmo, PDF noutra aba).
- **Versão nova:** quem está com a plataforma aberta é avisado; a próxima troca de tela atualiza. **Duas rotas no mesmo dia:** a regra estava certa no banco e na tela (teste novo); a causa provável era uma versão velha aberta.
- **Validação de 15/10:** textos do Tiny legíveis na ficha ("Crédito"; cancelado depois de entregue diz isso, sem o verde), janela do card sem o nome repetido, Setores e etapas numa grade que segue a largura do bloco, Motivos de pausa na largura toda, ficha em 2 colunas no celular.

**Banco:** migrations **74** (`20261014200000_plt_pcp_segue_o_tiny`) e **75** (`20261014210000_plt_pedidos_area`), cada uma ensaiada e desfeita no banco real antes de aplicar; bateria **980 verdes**; 15/10 foi só tela. **Testes da tela:** 162 → **176**. **Pacote:** principal 1.536 → **1.468 kB** (a área Pedidos é pedaço próprio).

**Como testar (para o dono):**
1. **PCP:** um pedido que o Tiny já marcou como Faturado, Enviado ou Entregue não aparece; os números do painel batem com o quadro.
2. **Ao vivo:** abra a MONTAGEM, vá ao PCP, lance um pedido para a MONTAGEM e volte pelo menu — o card está lá sem recarregar.
3. **Quadro:** troque de setor várias vezes — nada pisca; coluna vazia é só o título. No computador: segure o fundo do quadro (ou o botão do meio) e arraste para o lado.
4. **Pausa:** janela de um card em execução → Pausar → o motivo nos botões grandes. Configurações → Utilitários → Motivos de pausa.
5. **Pedidos → Todos os pedidos:** busque um número, toque no pedido e abra os botões um a um (cada um só carrega quando abre). **Pedidos → Cancelados:** o 13525 diz "tinha sido entregue em 08/10/2026".
6. **Expedição:** só pedidos que ainda vão sair, o mais urgente primeiro.
7. **Programação:** num caminhão com a Rota 1 feita no dia, "Nova rota (Rota 2)" programa a segunda.
8. **Celular:** abra o menu e toque num grupo — os nomes cabem numa linha.

**Conferido pelo Claude no site** (com a conta do dono; celular 375 px e computador): todos os itens acima que não gravam nada — Cancelados, ficha, menu do celular, quadro (fundo arrastado e botão do meio sem pegar o card, nada foi ao banco), Setores e etapas, Utilitários, janela do card. O tablet (768 px) segue com o dono.

**Pendente / para decidir:**
- **Dívida 17 da lei:** a busca por nome na área Pedidos (55 ms) e a lista de Cancelados (41 ms) passam do teto com volume ×100 — o caminho é índice nas tabelas da integração do Tiny. **15/10 — dono: "deixe anotado para a sessão 32 otimizar"** → anotado no §1.6 da [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]] e comentado na tarefa de banco dela.
- **Comprovante:** ainda não há nenhum de entrega de verdade. **15/10 — dono: "anexe um arquivo qualquer para testar"** → como hoje não há entrega pendente programada (e o card do pedido entregue fica arquivado, sem anexo pela tela), a imagem de teste "TESTE - comprovante de exemplo.png" foi anexada pela janela do card do **pedido 13622** (da própria Loja Domoby, em produção) e aparece em Pedidos → 13622 → "Entrega e comprovante" (conferido: a imagem abre na ficha). Tirar quando o dono tiver visto (janela do card → Anexos → tirar — fica no histórico).
- ~~**ClickUp:** os ajustes não têm tarefa~~ → **✅ 15/10:** o dono disse "Sim" — **14 tarefas** criadas na lista PRODUÇÃO, já em FAZENDO e comentadas (links na seção "Tarefas no ClickUp" da demanda); quem conclui é o dono.
- Aprendizados: E-95…E-100, A-61…A-63 em [[PLT - Memoria de Aprendizado]].

## Ver também

[[SESSAO-31]] · [[SESSAO-31 - Kanban Completo - Card Avulso Janela do Card Anexos e Conversa]] · [[PLT - Decisoes de Produto]] (D-125…D-131) · [[PLT - Lei de Desempenho e Escala]] · [[handoff_2026_10_08_sessao30_producao_ponta_a_ponta]] · [[000 - MAPA DO PROJETO]] · [[000 - PROXIMOS PASSOS]]
