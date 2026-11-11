---
titulo: "SESSAO-48 — Cancelar a fabricação de verdade: a coluna CANCELADO deixa de esconder peça em produção, o pedido cancelado pergunta o destino de cada móvel e o estoque cancelado sai da produção"
tipo: demanda
status: 📐 pronta para code
data: 2026-11-11
origem: vídeo do dono de 10/11 (17:28) — Estoque mostrando a Estante Basic 7 nichos com "2 reservados p/ produção" e o quadro da LIMPEZA E EMBALAGEM com as duas peças do pedido 13622 na coluna CANCELADO há 138 h. Investigado no Cowork com leitura do banco de produção (11/11, ~01:30) e do código (main em 4e4a571). Só leitura: nada foi alterado.
revisa: ↩️ a D-61 (peça de pedido cancelado que está em produção não segue mais sozinha para o estoque — a plataforma pergunta o destino). ↪️ usa a D-201 (peça em produção passa para outro pedido), o padrão da janela "Decidir situação" da D-129 e a regra de que o PCP segue o Tiny (D-132).
tags: [plataforma, demanda, producao, cancelamento, estoque, pcp, logistica, kanban]
---

# 🎯 SESSAO-48 — Cancelar a fabricação de verdade

> **Número:** 48 era o próximo livre na main em 11/11 (a 47 foi a última entregue). Confira na `000 - ORDEM DAS SESSOES`; se já estiver usado, pegue o próximo e corrija o título.
> **Primeiro passo da sessão:** esta demanda já está em `_docs/Plataforma/Demandas/` e linkada na Ordem das Sessões — só confira.
> **Quatro frentes:** 1 (o gesto "Cancelar fabricação"), 2 (o pedido cancelado pergunta o destino), 3 (a coluna CANCELADO vira porta do gesto) e 4 (o acerto do que já está parado lá, **só com o OK do dono**). Um commit por frente. Se o tempo apertar, entregue na ordem 1 → 3 → 2 → 4.

## O pedido do dono (texto fiel, 11/11)

*"O móvel aparece que está em produção, no entanto, está em cancelado. Ou seja, não deveria aparecer em produção. Quando for um PEDIDO, pergunta para onde vai mover aquele móvel que seria do pedido que foi cancelado. Caso seja um estoque que foi cancelado a fabricação apenas tire aquele móvel da produção."*

**O vídeo (10/11, 17:28):** na tela de Estoque, a **Estante Basic 7 nichos – Branca (SKU 422)** mostra "1 em estoque · 2 reservados p/ produção". O dono abre a LIMPEZA E EMBALAGEM, filtra "Estante Basic 7 nichos – Branca" e mostra que as duas que contam como "em produção" são as do **pedido 13622 (1/2 e 2/2)**, paradas na coluna **CANCELADO** há **138 h 58 min na fila**.

---

## O que a investigação achou (leitura do banco em 11/11)

### 1. CANCELADO é só uma coluna — o sistema não sabe o que ela quer dizer
- **CANCELADO** e **NÃO ENCONTRADO** são duas etapas comuns da LIMPEZA E EMBALAGEM, cadastradas em 29/08 a partir da lista do ClickUp (`plt_etapas` 32 e 31; não são fila, não são DANIFICADO, não concluem produção, não encaminham).
- Para a plataforma, peça ali **está em produção** como qualquer outra: entra no "reservados p/ produção" do Estoque e do Top 20 (`fn_estoque_categoria` → `producao_de_pedido` / `producao_sem_dono`, somados em `fn_reservados_producao`), no quadro, nos contadores, no tempo na fila e nos painéis.
- **Hoje:** 49 peças vivas no CANCELADO e 4 no NÃO ENCONTRADO = **53 das 127 peças "em produção" (42%)**, espalhadas por **30 móveis** do catálogo. Os números de "em produção" da fábrica estão inflados nessa proporção.

| Coluna | De onde | Peças | Situação no Tiny | Quem pôs lá |
|---|---|---|---|---|
| CANCELADO | Pedido **13622** | 30 (+1 no A LIMPAR) | **Em aberto** | Guilherme, direto do PCP, em 19/10 22:24 (todas no mesmo segundo) |
| CANCELADO | Reposição de estoque (10 cards de reposição) | 17 | — | Guilherme, do A LIMPAR e do NÃO ENCONTRADO, de 03/11 a 10/11 |
| CANCELADO | Pedidos 12728 e 13702 | 1 + 1 | Cancelado | Guilherme, direto do PCP (19/10 e 26/10) |
| NÃO ENCONTRADO | Pedidos 11960 e 13709 | 1 + 1 | Cancelado | Guilherme (PCP, 19/10) e João Pedro (A LIMPAR, 29/10) |
| NÃO ENCONTRADO | Reposição de estoque | 2 | — | João Lucas (A LIMPAR, 06/11) |

### 2. Não existe gesto de "cancelar a fabricação"
- Nenhuma porta da plataforma deixa a equipe dizer "esta peça não vai mais ser feita". O jeito que a equipe achou foi arrastar para a coluna CANCELADO — e a peça continua contando.
- A janela **"Liberar unidades"** do PCP deixa escolher **setor e etapa** de destino, então dá para liberar um pedido inteiro **direto** na coluna CANCELADO (foi o que aconteceu com o 13622 e o 12728).

### 3. A regra de hoje para pedido cancelado não pergunta nada (D-61)
- Pedido cancelado no Tiny com peça **em produção**: a peça **segue** com a etiqueta "Pedido cancelado — pronta, vai para o estoque" e só perde o pedido quando chega ao ESTOQUE (`fn_desvincular_por_cancelamento`). Ninguém é perguntado. Enquanto isso, ela conta como "produção de pedido".
- Com peça **pronta** (aguardo / ROTAS): vai sozinha ao ESTOQUE sem dono. **Isso continua.**

### 4. O 13622 não está cancelado para a plataforma
- No Tiny, o 13622 está **"Em aberto"** desde 08/10 (R$ 14.051,90, marcador "1ª venda", 31 peças). Para a plataforma, é um pedido **vivo** com 31 peças em produção — por isso conta.
- A plataforma não tem como adivinhar que ele foi cancelado: a verdade da situação do pedido é o Tiny (D-132). **Pergunta para o dono (ver "Para o dono" no fim):** o 13622 foi cancelado? Se sim, o caminho certo é cancelar no Tiny — e, com esta demanda, a plataforma pergunta o destino de cada peça dele.

---

## A regra nova (uma só, no banco)

**"Cancelar a fabricação" é um gesto, não uma coluna.** Toda peça cuja fabricação foi cancelada **sai da produção na hora** — de todos os números, quadros, filas, tempos e painéis — e o que acontece com ela depende de quem ela é:

| A peça é… | O que acontece |
|---|---|
| **De estoque** (sem pedido: reposição, lançamento manual) | **Sai da produção.** Confirmação de uma frase, motivo opcional. A peça é arquivada com um fato novo. |
| **De pedido cancelado no Tiny** | A plataforma **pergunta para onde vai o móvel** (ver frente 2). Enquanto ninguém decide, a peça **não conta** como produção de pedido. |
| **De pedido vivo no Tiny** (Em aberto, Aprovado, Preparando envio…) | **Não cancela pela plataforma** (decisão provisória — D-132): a janela explica que o pedido está vivo no Tiny e que, se ele foi cancelado, é para cancelar lá — aí a plataforma pergunta o destino sozinha. |

### Frente 1 · O gesto "Cancelar fabricação"
- **Onde:** na janela do card (peça), botão **"Cancelar fabricação"**; e ao soltar a peça na coluna CANCELADO (frente 3). No tablet também.
- **Quem pode (decisão provisória):** admin, líder do setor do card e logística. No tablet, o autor é o operador do PIN, como nas outras portas.
- **Peça de estoque:**
  - Confirmação: *"A Estante Basic 7 nichos (reposição de estoque) sai da produção e não será mais fabricada. Confirmar?"* · motivo opcional (lista de motivos com tipo novo `cancelamento` + "Outro"; decisão provisória: semear "Fabricação cancelada", "Excesso de estoque", "Peça perdida").
  - Efeito: **fato novo** `fabricacao_cancelada` (append-only — RNF-05) + `card_arquivado` com o motivo; a peça some do quadro, do "reservados p/ produção", dos contadores e do tempo na fila. Gera log (D-40) e aparece na Auditoria e no histórico da peça.
  - **Do lado da reposição (decisão provisória, no padrão da D-201):** a reposição **só perde a peça** — a vaga continua contada como liberada (a reposição não pede de novo). Se o estoque ficar abaixo do mínimo, a reposição automática ou o botão da logística lançam de novo, como já acontece.
  - **Peça que ainda está no PCP** (vaga de reposição não liberada): fora do escopo — o caminho de hoje (arquivar a reposição) continua.
- **Peça de pedido cancelado:** abre a janela da frente 2.
- **Peça de pedido vivo:** abre só o aviso (sem botão de confirmar): *"O pedido 13622 está Em aberto no Tiny, então esta peça continua sendo dele. Se o pedido foi cancelado, cancele no Tiny: a plataforma pergunta para onde vai cada móvel."*
- **Escrita idempotente:** a porta recebe uma chave; toque repetido = um efeito só.

### Frente 2 · O pedido cancelado pergunta o destino de cada móvel (↩️ revisa a D-61)
- **Quando:** chegou do Tiny o cancelamento (`pedido_cancelado`) e o pedido tem peça **em setor de produção, não concluída**. (Peça pronta em aguardo/ROTAS continua indo sozinha ao ESTOQUE, como hoje.)
- **Na hora do cancelamento:**
  - cada peça em produção ganha a marca **"esperando decisão"** (projeção por fato, no padrão de `standby_desde` / `devolucao_evento_id`);
  - ela **deixa de contar** como produção de pedido (categoria nova no `fn_estoque_categoria`, fora da soma do "reservados p/ produção");
  - o card no quadro troca a etiqueta para **"Pedido cancelado — esperando decisão da logística"** (vermelho, texto ao lado da cor);
  - aviso no sino para **logística e admin**: *"O pedido 13702 foi cancelado no Tiny. 3 móveis dele estão em produção — decida para onde vão."*, que abre a janela.
- **A janela "Para onde vai este móvel?"** — no padrão da "Decidir situação" da devolução (D-129): abre do sino, do PCP (aba Cancelados) e da janela do card; lê tudo numa requisição ao abrir; decide **peça por peça ou todas de uma vez**. Opções:
  1. **"Seguir para o estoque"** — a peça perde o pedido **agora** (`unidade_desvinculada`), continua a produção onde está e, pronta, entra no ESTOQUE sem dono. Volta a contar como produção **para o estoque**.
  2. **"Passar para outro pedido"** — lista os pedidos vivos que precisam do **mesmo móvel** (a régua de "peça igual" da D-62, a mesma maquinaria da D-201: `fn_sugestoes_em_producao` / `peca_vinculada`). A peça passa a ser do pedido escolhido **onde está** (setor, etapa, quem trabalha e tempo seguem). Sem pedido que precise → a opção aparece desabilitada, com a explicação.
  3. **"Tirar da produção"** — a fabricação é cancelada (o mesmo efeito da peça de estoque na frente 1).
- **Quem decide:** logística e admin (a mesma permissão de liberar peça e decidir devolução).
- **Ninguém decidiu e a peça chegou ao fim da linha** (decisão provisória — o chão de fábrica não para): vale a regra de hoje — ela entra no ESTOQUE sem dono, e a decisão pendente se fecha sozinha com um fato que diz isso.
- **Pedido "descancelado" no Tiny** antes da decisão (voltou para Em aberto): a marca sai e a peça volta a ser do pedido, sem tocar em nada (decisão provisória).

### Frente 3 · A coluna CANCELADO vira a porta do gesto
- A etapa ganha um sinal novo (no padrão de `conclui_producao`), **`cancela_fabricacao`** — ligado só no CANCELADO da LIMPEZA E EMBALAGEM.
- **Soltar uma peça nela** (arrasto, tablet, botão Mover, ou escolher essa etapa na janela "Liberar unidades" do PCP) **não deixa a peça lá**: abre a janela da frente 1/2. Confirmou → a peça sai da produção (ou espera a decisão). Desistiu → a peça volta para onde estava.
- A coluna fica **sempre vazia** e continua aparecendo no quadro com a dica *"Solte aqui para cancelar a fabricação"* (decisão provisória — preserva o hábito da equipe).
- **Liberar no PCP direto nessa etapa:** recusado no banco, com a frase *"Para cancelar a fabricação, libere a peça e use Cancelar fabricação"* (decisão provisória).
- Configurações → etapas do setor: o admin pode ligar/desligar o sinal (no mesmo lugar de "conclui a produção"), para quando a equipe criar outra coluna com esse papel.
- **NÃO ENCONTRADO não muda** nesta demanda (ver "Para o dono").

### Frente 4 · O acerto do que já está parado lá (**só com o OK do dono**, regra 2)
Manutenção de dado em `supabase/manutencao/AAAA-MM-DD_cancelado_vira_gesto.sql`, ensaiada antes (contagens antes/depois) e aplicada **só com o OK do dono na conversa**, origem `api`, um fato por peça:
- **17 peças de reposição no CANCELADO** → "Tirar da produção" (fabricação cancelada, motivo "Acerto: estava na coluna CANCELADO").
- **12728 e 13702** (cancelados no Tiny, 1 peça cada no CANCELADO) → ficam **"esperando decisão"** e aparecem na janela da frente 2.
- **13622** (Em aberto no Tiny, 30 peças no CANCELADO) → **não mexer** até o dono responder. Se ele cancelar no Tiny, a frente 2 cuida sozinha; se o pedido estiver vivo, combinar com o dono para onde as peças voltam (a fila da LIMPEZA E EMBALAGEM, provavelmente).
- **NÃO ENCONTRADO** (4 peças) → não mexer.
- Depois do acerto: recontar os números do estoque (`fn_estoque_numeros_recontar`) e conferir a Estante Basic 7 nichos e os 30 móveis afetados antes/depois.

---

## Fora do escopo
- Mudar a D-132 (o PCP segue o Tiny) ou cancelar pedido no Tiny pela plataforma.
- A coluna NÃO ENCONTRADO (fica como está; pergunta para o dono).
- Peça pronta de pedido cancelado (aguardo/ROTAS): continua indo sozinha ao ESTOQUE (D-61, parte que fica).
- Cancelar vaga de reposição que ainda está no PCP.
- Estoque de peça/insumo, baixa de insumo, Tiny.
- Mexer no fluxo do n8n.

## Critérios de aceite

**Frente 1**
- [ ] Peça de estoque com "Cancelar fabricação" some do quadro, do "reservados p/ produção" do Estoque e do Top 20, dos contadores da coluna e dos painéis — na hora, sem recarregar (websocket do setor e do estoque).
- [ ] O histórico da peça e a Auditoria mostram quem cancelou, quando e o motivo.
- [ ] Peça de pedido vivo no Tiny: aparece só o aviso, sem cancelar.
- [ ] Toque repetido = um efeito só. Operador sem permissão não vê o botão (e o banco recusa).

**Frente 2**
- [ ] Pedido cancelado no Tiny com peça em produção: a peça fica "esperando decisão", sai do "reservados p/ produção" e o sino avisa logística e admin.
- [ ] As três opções funcionam peça por peça e todas de uma vez; "Passar para outro pedido" só lista pedido vivo que precisa do mesmo móvel e cobre a vaga dele.
- [ ] Peça sem decisão que chega ao fim da linha vai ao ESTOQUE sem dono, e a pendência se fecha com fato.
- [ ] Pedido que volta para Em aberto antes da decisão: a peça volta a ser dele.

**Frente 3**
- [ ] Soltar no CANCELADO abre a janela; a coluna nunca guarda peça; desistir devolve a peça para onde estava.
- [ ] Liberar no PCP direto no CANCELADO é recusado com a frase certa.
- [ ] Nada de código interno na tela (regra 12b).

**Frente 4**
- [ ] Ensaio com contagens antes/depois; aplicado só com o OK do dono; a Estante Basic 7 nichos e os outros móveis afetados mostram o número certo.

**Geral**
- [ ] Celular (375) e tablet (768) sem rolagem lateral; botões com tamanho de toque.
- [ ] Bateria do banco 2×, tsc, lint, vitest, build, advisors sem nada novo além do esperado.
- [ ] Lei de desempenho: cada tela em 1 requisição, sem relógio novo (trabalho nasce do fato); a janela da decisão lê só ao abrir; plano ×100 das portas novas ou tocadas no handoff.

## Notas para o Claude Code

- **Leia** `SUPA - Esquema do Banco`, a Lei de Desempenho e a Memória de Aprendizado. Recrie toda função a partir da **versão viva** do banco, conferindo o md5 do corpo (A-96/A-97). Reaplicar migration antiga já desfez trabalho novo.
- **Onde mora:**
  - A regra única do que conta: `plt_privado.fn_estoque_categoria` (entra a categoria da peça esperando decisão, fora das somas) → `fn_estoque_numeros_cards` / `_recontar` → `fn_reservados_producao` → `plt_fn_estoque_produtos`, Top 20 e Estoque.
  - O cancelamento do Tiny: `plt_privado.fn_desvincular_por_cancelamento` (gatilho `plt_eventos_zz_desvincular_cancelados`) e `fn_reagir_pedido`. A peça em produção passa a ganhar a marca; aguardo/ROTAS seguem iguais.
  - "Passar para outro pedido": `plt_privado.fn_sugestoes_em_producao` e o fato `peca_vinculada` (D-201, `fn_projetar_peca_vinculada`, `fn_recalcular_liberacao`).
  - A janela: o padrão de `ModalDecidirDevolucao` / `src/logistica/devolucao.ts` e a porta da decisão da devolução.
  - Arrasto e liberação: `plt_fn_soltar_card`, `plt_fn_mover_card`, `plt_fn_card_mover_para_fila`, a liberação do PCP (`ModalLiberarPedido` deixa escolher a etapa) e `fn_validar_execucao`/`fn_validar_chegada_estoque`.
  - A etiqueta do card: `src/kanban/componentes/CartaoUnidade.tsx` (hoje "Pedido cancelado — pronta, vai para o estoque", lida de `pedidoCancelado`).
  - Tipos novos de evento entram no check `plt_eventos_tipo_check` (o `validate` muda para a migration nova — E-19).
- **Eventos são append-only:** cancelar é fato novo; nada é editado ou apagado. Toda atividade gera log. Sem relógio novo.
- **Regra 2:** migration, manutenção de dado e publicação só com aprovação do dono na conversa, cada uma em passo separado.
- **Decisões provisórias a registrar (D-NN):**
  - quem pode cancelar (admin, líder do setor, logística);
  - peça de pedido vivo no Tiny não cancela pela plataforma;
  - a reposição só perde a peça (não pede de novo);
  - os três motivos semeados;
  - sem decisão + fim da linha = ESTOQUE sem dono;
  - pedido "descancelado" devolve a peça;
  - a coluna CANCELADO fica vazia com a dica, e a liberação direta nela é recusada.
- Com o dono: português de gente, sem códigos (regra 12c).

## Para o dono (perguntas que não travam a sessão — as respostas viram decisão)
1. **O pedido 13622 foi cancelado mesmo?** No Tiny ele está "Em aberto". Se foi, cancele no Tiny; se não foi, para onde as 30 peças dele voltam?
2. **E o NÃO ENCONTRADO?** Hoje tem 4 peças lá (2 de pedidos cancelados e 2 de estoque) e elas também contam como "em produção". Quer o mesmo tratamento numa próxima demanda?
3. **Logística pode cancelar a fabricação**, ou só líder e admin?

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)
- *A criar com o OK do dono:* "Produção - Cancelar a fabricação de uma peça" · "Produção - Pedido cancelado pergunta o destino de cada móvel" · "Produção - Coluna Cancelado deixa de contar como produção".

## Resultado (preencher ao entregar)

*O que foi feito, o que mudou de rota, link do handoff da sessão.*

---

## Prompt para abrir no Claude Code (pasta "Domoby - fabrica")

```
Você é o engenheiro executor da Plataforma de Produção da Móveis Domoby. Atualize a main, siga a ordem de leitura do CLAUDE.md da raiz e execute a demanda "SESSAO-48 — Cancelar a fabricação de verdade" (já está em _docs/Plataforma/Demandas/ e linkada na Ordem das Sessões; confira se o número 48 está livre). Leia duas vezes.

As respostas de negócio estão dentro da demanda: não me pergunte nada de negócio; o que faltar vira decisão provisória registrada. As três perguntas do fim da demanda são para mim e não travam a sessão. Branch nova a partir da main, commits pequenos com push a cada frente. Migration, o acerto das peças paradas e publicação só com o meu OK.

Ao terminar: o que foi feito, como testar passo a passo (com prints do botão Cancelar fabricação, da janela "Para onde vai este móvel?" e do Estoque antes/depois da Estante Basic 7 nichos), as pendências que precisam de mim e as decisões provisórias, em português de gente, sem códigos.
```
