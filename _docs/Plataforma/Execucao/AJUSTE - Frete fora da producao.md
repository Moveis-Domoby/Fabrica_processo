---
titulo: Execução — Ajuste · Frete fora da produção (D-63)
tipo: execucao
data: 2026-09-28
atualizado: 2026-09-28
tags: [execucao, ajuste, frete, unidades, pcp, aguardo, rotas, d-63]
---

# 🔧 Execução — Ajuste · Frete fora da produção

**Origem:** achado da F-07 da SESSAO-24 (27/09) — o 13215 tinha um card de unidade "Frete" (1/1) na LIMPEZA E EMBALAGEM. Hoje todo item do pedido com quantidade ≥ 1 vira unidade a produzir: a regra `round(quantidade) >= 1` está repetida em ~16 portas do banco (liberação, PCP, aguardo, ROTAS, entrega, programação, painéis, alocação) e nenhuma distingue frete/serviço/revenda.
**Branch:** `ajuste-itens-fora-da-producao` — criada da `origin/main` em **3503d77** (a SESSAO-26 tinha acabado de ser mesclada; a `main` local desta máquina estava em 98c17b5, 11 commits atrás). Upstream desligado de propósito (um `push` sem destino não pode cair na `main`).
**Worktree:** `.claude/worktrees/happy-bose-a2fee2` (sessão própria — não mexer na pasta principal, que tem mudanças de outra frente).
**Numeração reservada** (avisada às sessões paralelas — gaveta do celular, SESSAO-26, SESSAO-24): migration **39**, **D-63**, **A-31**, **E-55**, **E-56** (Q-71 se precisar). ↪️ Reservei antes A-25/E-48/E-49; a S26 e a S24 avisaram que o E-48 já é da sessão da gaveta (commitado, e ela deve seguir para o E-49) e que o A-25 já foi escrito na pasta principal por outra frente — renumerado antes de commitar.

## Levantamento — só leitura no banco real (28/09)

1. **8.107 itens** de pedido (03/2025 → hoje) × catálogo da fábrica pelo SKU: F 6.736 · sem par no catálogo 964 (375 sem SKU) · S 259 · K 145 · M 3.
2. **"Sem par" não é "não é móvel":** quase tudo é móvel (SKUs antigos `2000000000xxx`, personalizados sem SKU). **A classe também não separa:** "simples" (S) tem móvel feito aqui (Penteadeira camarim 478 — 82 vendas —, Gaveteiro volante 583, Mesa de reunião 556) junto com revenda (cadeiras 229/469/486/465/589/658/7909432681159) e "Passa fio (com instalação)" 557; K são as lâmpadas LED (kits 496/497). SKU da loja às vezes é OUTRO produto na fábrica (490 = chapa MDF vendida como estante; 588 = estrutura metalon vendida como mesa; 435 = estante vendida como Espelho Adnet).
3. **Histograma pela 1ª palavra** (todas as vendas): fora de móvel só 4 famílias — frete/entrega (7 itens: "frete" 5, "frete cliente" 1, "entrega" 1, todos sem SKU), serviço de instalação ("fechadura (com instalação)" 25, "passa fio (com instalação)" 14, "instalação dos pés do multiuso" 1), revenda pronta (cadeira 157, lâmpada 150, espelho Adnet 4, carro de mão 3, longarina 2) e acessório solto (rodízios 10, puxador 1). Peças avulsas de MDF (tampo, porta, prateleira, "L da mesa") e expositores são produzidos.
4. **Calibração (E-42):** palavra em QUALQUER posição dá falso positivo — "PERSONLAIZADO Penteadeira camarim … sem a parte de instalação das lâmpadas" e "Painel freijó … (LED e instalação não inclusos)" são móveis; "puxador"/"rodízios" aparecem em descrição de móvel. Só a **1ª palavra** separa.
5. **Escala (90 dias, sem cancelados):** 897 pedidos · 44 (4,9%) com item que não é móvel · 4 só com isso · frete 2 · serviço 6 · revenda 35 · acessório 2.
6. **Vivo na tela:** 13215 (Frete na LIMPEZA E EMBALAGEM + kit de lâmpadas em Pedidos em aguardo), 13207 (o pedido inteiro é 1 cadeira Tiffany — card na LIMPEZA E EMBALAGEM), 13515 (no PCP, 12 itens, 6 cadeiras de revenda).
7. **Fluxo antigo:** o n8n → Trello/ClickUp (e o Plugga antes) também criava card para todo item com quantidade ≥ 1 (`N8N - PCP Trello e ClickUp`: "758 geradas, 758 reais") — o código e o histórico não respondem; é decisão do dono.
8. **Estoque (resposta 3 do dono conferida):** as cadeiras JÁ estão em Estoque → Produtos acabados com o número do Tiny (carga de 26/09): Tiffany preta 9 − 1 reservada; Adrix 17 − 1; executiva −5 − 3 = "necessidade extrema 8"; Fluidy 5; Alice 0. Fechadura/Passa fio (com instalação), puxadores e rodízio também. Detalhes para o dono (fora do escopo): lâmpadas-kit (K) aparecem na aba Matéria-prima e insumos; Espelho Adnet, Longarina e Carro de mão **não existem** no Tiny da fábrica; "Fechadura (com instalação)" não tem SKU (a venda dela não reserva — a conta casa por SKU).
9. **Reposição automática:** olha F/S/V com mínimo; nenhuma revenda tem mínimo hoje (S com mínimo: só a Penteadeira camarim e 1 sem SKU) — nada muda.
10. **Pedido só de frete:** **0 em 5.410** pedidos desde 03/2025 (e nenhum pedido com 0 unidade pela regra de hoje).
11. **O PCP já manda a unidade direto para Pedidos em aguardo:** o `ModalLiberarPedido` oferece qualquer setor ativo menos o PCP, e `fn_validar_chegada_estoque` (37) aceita peça nova (sem marcação) de pedido vivo no aguardo.

## Respostas do dono (28/09 — o OK)

- **Q1 — o que NÃO vira card de produção:** *"Frete / entrega"* (só isso).
- **Q2 — como reconhecer:** *"Pela descrição"*.
- **Q3 — completo sem esses itens:** *"Cadeiras e outros acessórios assim também são vendidos pela loja e devem estar no estoque cadastradas com a quantidade de acordo com o Tiny, se não está assim atualmente, está errado"* → conferido (item 8 acima): estão.
- **Q4 — pedido sem nada a produzir:** *"Direto p/ Pedidos em aguardo"* (nasce no PCP, sem nada a produzir já sai completo e aparece em Pedidos em aguardo para a logística lançar para ROTAS).
- **Q5 (esclarecimento — cadeira e demais itens):** *"SEMPRE NASCE NO PCP DO JEITO QUE ESTÁ E O PCP DEFINE O LOCAL CORRETO"*.
- **Plano:** *"Pode começar"*.

**→ D-63:** frete/entrega não vira unidade nem conta para o pedido (reconhecido pela 1ª palavra da descrição); todo o resto nasce no PCP como hoje e o PCP define o lugar (a cadeira pode ir direto para Pedidos em aguardo — já funciona); pedido sem nada a produzir vai direto para Pedidos em aguardo.

## Task list (espelha o plano aprovado)

- [ ] 1. Branch + memória de execução + numeração avisada — branch e aviso ✅ (28/09)
- [ ] 2. Migration 39: helper único em `plt_privado` + as 16 portas recriadas com ele; pedido sem nada a produzir sai do quadro do PCP e entra em Pedidos em aguardo; Lançar para ROTAS e entrega aceitam
- [ ] 3. Harness (`npm run test:banco`, 2 rodadas): frete fora da liberação e das contas; pedido só de frete PCP → aguardo → ROTAS → entregue; pedido que ganha um móvel volta ao PCP; cadeira liberável direto para o aguardo
- [ ] 4. Front: "nada a produzir" onde apareceria 0 de 0 · tsc/lint/test/build
- [ ] 5. Ensaio A-11 no banco real + prévia das telas → OK do dono → aplicar só a 39 (`--so`), F-08 antes/depois → advisors
- [ ] 6. Manutenção: arquivar por evento o card de teste "Frete" do 13215
- [ ] 7. Cofre: D-63 (+ a nota da S26 sobre D-63/D-64 sem uso), ↪️ RF-02, esquema (migration 39), memória (A-31, E-55, E-56), handoff, mapa, índice da Execução

## Diário

- 28/09 · leituras obrigatórias (CLAUDE, memória, decisões D-01…D-62, visão, requisitos, ordem, handoff S24, esquema, mapa, modelo de sistema, perguntas) → levantamento só leitura (acima) → 2 rodadas de perguntas → OK.
- 28/09 · **E-55** (sed com caminho do Windows no padrão → "unterminated s command"; refeito com `awk -F'_docs'`) e **E-56** (escape `\\` dentro de heredoc passado pela ferramenta do shell virou `\` e a regex do script quebrou; script regravado pela ferramenta de edição, sem barra invertida) — registrados na memória de aprendizado.
- 28/09 · `git fetch` (credencial do `gh`, E-37): `origin/main` 11 commits à frente da `main` local (SESSAO-26 mesclada: migration 38, `--so` no aplicador, bloco do harness). Branch criada da `origin/main`.
- 28/09 · sessões paralelas (SendMessage): a S24 confirmou as portas e mandou 5 dicas (bases do aguardo, portas fora da 37, E-17/E-19/E-24, pedidos 924001–924007 do harness, arquivar o Frete por evento); a S26 avisou que a `main` andou para **fcf1af1** (só cofre dela: E-57, E-58, A-32, A-33 — sem colisão; ela ensaiou o merge da minha memória: 0 conflito).
- 28/09 · `npm ci` na worktree (373 pacotes) · **linha de base do harness: 446 ✔, tudo verde** (~8 s).
- 28/09 · **desenho da 39** — as 17 portas com a versão mais nova localizada por script (a última `create function` de cada nome nas migrations) e o corpo extraído para comparação:
  - regra única em `plt_privado`: `fn_eh_frete` (1ª palavra da descrição normalizada: frete/entrega) → `fn_unidades_do_item` → `fn_unidades_do_pedido`;
  - **pedido sem nada a produzir decidido NA LEITURA** (`fn_pedidos_sem_producao`) e não por projeção: se fosse gravado (`liberado_completo_em` na criação), um pedido só de frete que ganhasse um móvel no Tiny ficaria fora do PCP para sempre — o `pedido_atualizado` só nasce quando há unidade liberada. Na leitura, ele volta sozinho ao quadro. Custo aceito: o tempo em PCP de um pedido desses não fecha (caso nunca visto: 0 em 5.410);
  - gatilho BEFORE INSERT `plt_cards_validar_unidade_de_producao` (M-14): recusa card de unidade de frete pela descrição do card OU do item do pedido;
  - `plt_fn_lancar_rotas` ganhou a trava "pedido cancelado no Tiny não vai para ROTAS" (antes a trava de completo bastava; com 0 unidade, não) — para pedido comum não muda nada (cancelado nunca fica completo);
  - achado no desenho do teste: `fn_recalcular_liberacao` contava TODO card de unidade como liberado — um card de frete antigo "completaria" o pedido com um móvel ainda no PCP → a contagem de liberadas (ali e no resumo do PCP) ignora card de frete.
- 28/09 · **conferência E-24:** as 17 funções extraídas da 39 × as originais — o diff mostra só as trocas pretendidas.
- 28/09 · harness: bloco "D-63" (pedidos 924201–924205, pessoas da S24) → **471 ✔ (446 + 25), tudo verde, 2 rodadas**. **Teste de mutação:** regra do frete desligada numa cópia da 39 → 7 ✘ no bloco D-63 (e o resto do bloco parou); migration restaurada idêntica (md5).
- 28/09 · front: Pedidos em aguardo (pedido sem nada a produzir: selo "Pedido completo" + "Nada a produzir", barra cheia, sem "Ver unidades" — não há unidade; Lançar para ROTAS igual) e Expedição ("Nada a produzir" no lugar de "0 de 0 no fim de linha"). Teste de componente novo `src/paginas/PedidosAguardo.test.tsx` — **falha na tela antiga e passa na nova**. tsc ✅ · lint ✅ · **81/81** ✅ · build ✅ · mojibake: nenhum (os "Ã" são de NÃO/PRODUÇÃO).
- 28/09 · commits aa2d947 (migration + harness), 383b21c (front), 06f931c (cofre) — rebase sobre a `origin/main` fcf1af1 (cofre da S26) sem conflito.
- 28/09 · **ensaio A-11 no banco real** (script `ensaio_d63.mjs` no rascunho da sessão, conexão igual à do aplicador, credencial nunca impressa): transação → retrato das 13 portas das telas como o admin → a 39 → retrato de novo → a trava → a manutenção → **ROLLBACK** (conferido: a função nova não ficou no banco). As telas: só o 13215 muda (aguardo 3 de 6 → 3 de 5; resumo 6 de 6 → 5 de 5; Expedição 3 de 6 → 3 de 5; o Frete sai da liberação); 0 pedido sem nada a produzir; trava recusa o card de frete com a mensagem certa; a manutenção arquiva só o card **507** (Frete do 13215, LIMPEZA E EMBALAGEM/EXPEDIÇÃO, sem tempo aberto) — a Expedição passa a 5 liberadas.
- 28/09 · **E-65 — o custo da regra em função** (perfil `perfil_d63.mjs`: EXPLAIN ANALYZE no servidor, mediana de 5, antes → depois, em transação desfeita): com a cadeia de funções `set search_path` por item, aguardo **5 → 245 ms**, contadores 2 → 87, painel do dia 8 → 193, Expedição 9 → 58; soma dos 242 pedidos 1 → 51 ms. Nenhuma das 148 funções do repo existe sem `set search_path` (regra da casa, E-11) — não quebrei a regra. **Redesenho:** a regra por item foi para a VIEW `plt_privado.vw_itens_producao` (security_invoker; eh_frete + unidades) — view é embutida pelo planner; as portas somam da view; `fn_unidades_do_pedido` (com SET) só nos gestos (lançar, entregar, recalcular a liberação); `fn_pedidos_sem_producao` filtra primeiro o barato (CTE materializada: só card sem unidade chega à situação do Tiny); a trava e a manutenção classificam pelo ITEM do pedido (a fonte da verdade), não pela descrição do card. A 1ª versão da view (troca de acentos + regexp_replace na descrição inteira) deixou a busca em TODOS os pedidos 72 → 148 ms; a final usa **uma regex ancorada no começo** (desiste no 1º caractere quase sempre). **Números finais** (2 rodadas): aguardo ~4 → ~7,5 ms · contadores ~2 → 4–9 · painel do dia ~5 → 7–19 · busca em todos ~41 → ~57 · quadro do PCP, ROTAS, Expedição, reservados iguais (a rede até o Canadá é ~150 ms). Harness: calibração pela view (+3 casos da regex: "(Frete)", "Frete-cliente", "Fretes") → **471 ✔**. Conferência E-24 refeita nas 17: só as trocas pretendidas.
- 28/09 · numeração: a sessão "Ajustes urgentes no módulo de estoque" (migration 40, `20260928180000_plt_estoque_manual_top20.sql`, aditiva, `--so`) reservou E-60…E-64 — o meu E-60 (ainda sem commit) virou **E-65**. A trava da 39 não pega a entrada manual dela (unidade sem pedido passa direto) — avisada. A sessão da gaveta: E-48 é dela, E-49 já está na `main` (outra frente); a `main` remota já está em 96207bc (rebase antes do merge).
- 28/09 · `main` remota em **9f55bee** (4 commits, nenhuma migration: plano da integração completa com o Tiny, evidências de tela, e a **regra 12c do dono** — na conversa, português de gente, sem código nenhum; daqui em diante as mensagens ao dono seguem isso). Rebase limpo; harness **471 ✔ / 0 ✘** na linha nova.
