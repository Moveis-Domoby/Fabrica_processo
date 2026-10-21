---
titulo: SESSAO-38 · frente dos cards — prazo, prioridade, responsáveis, janela do card, ordem da fila e card do PCP
tipo: execucao
data: 2026-10-21
branch: sessao-38-cards
decisoes: [D-150, D-151, D-152, D-153, D-154, D-155]
aprendizados: [E-120, A-85, A-86]
---

# SESSAO-38 · frente dos cards (execução)

Sessão noturna autônoma (supervisor; o dono não foi consultado). Números reservados: D-150…D-155, E-120…E-124, A-85…A-88, migrations `202610220100xx`–`202610220199xx`. Usados: D-150…D-155, E-120, A-85, A-86, a migration `20261022010000`.

## 1. O que o dono pediu (itens desta frente)

1. Data de entrega do Tiny em todo card de pedido, só a data, cor por quanto falta (verde > 3 dias · amarelo 2–3 · vermelho forte ≤ 1 / no dia / atrasado), lida ao vivo.
2. Janela do card: Início = dia do pedido no Tiny; Vencimento = entrega; prioridade própria (urgente · atenção · comum); responsáveis por setor (quem pegou, da história; o líder/admin define os próximos; passado só leitura); campos vazios limpos.
3. O card do setor sem o nome do cliente.
4. Organizador da fila (entrega · prioridade · alfabética) por ícone, em todos os quadros e no PCP, no servidor; urgente sempre primeiro.
5. Card do PCP refeito (mesmo tamanho, estoque compacto, lado direito com prazo/prioridade/ações, lugar para o botão de stand-by).

## 2. Leituras e retrato de partida (21/10 ~05:28 UTC, só leitura)

- CLAUDE.md, a memória inteira (E-01…E-116, A-…), D-22/28/48/101/125/126/132/135/136/146/147, a Lei de Desempenho (§1–§12), o esquema (`pedidos.data_pedido`/`data_prevista` são `date`).
- Produção: 259 cards vivos (47 pedido · 11 reposição · 3 avulso · 198 peça); maior coluna de produção = MONTAGEM etapa 29 com 51 peças; etiquetas: "PRIORIDADE" (id 5, ativa, **0 cards vivos**) e "Teste automação" (arquivada).
- Bateria antes de mexer: **1.088 verdes**.

## 3. Banco — `supabase/migrations/20261022010000_plt_card_prioridade_prazo_ordem.sql`

Desenho (as decisões estão no cofre):
- `plt_cards.prioridade` (check `urgente|atencao`, nulo = comum) e `plt_cards.responsaveis_setor` (jsonb) — projeções, só gatilho escreve (M-13).
- Fatos novos `prioridade_definida` e `responsavel_setor_definido` (check de tipos recriado; **o validate saiu da migration 96** — E-19).
- Visão `plt_privado.vw_card_ordem` com as chaves de ordem (prioridade efetiva herdada do card do pedido / da reposição; data de entrega ao vivo; nome normalizado com classe letras/números/resto).
- `fn_quadro_pagina(…, p_ordem)` por cursor com as chaves recalculadas do último card (A-85). Portas do quadro, do "Ver mais" e do PCP com `p_ordem text default null` (drop + create — o site publicado continua chamando sem ele).
- `plt_fn_pcp_quadro` reescrita com o MESMO filtro de `plt_fn_cards_pedido_pcp` (a Visão do dia segue lendo a antiga; a bateria compara os conjuntos) e o estoque calculado só para a página (antes era para todas as linhas).
- Portas novas `plt_fn_card_prioridade` e `plt_fn_card_responsavel_setor`; `plt_fn_avulso_criar` com `p_prioridade`; `plt_fn_card_janela` com `prazo`, `prioridade`, `responsaveis_por_setor` e as permissões novas.
- `fn_quadro_junto`: o pedido do quadro do setor **sem `cliente_nome`** (o card não mostra — regra 17), + `data_pedido`.
- Aviso ao vivo: a prioridade do pedido avisa o quadro de cada setor com peça dele; o `pedido_atualizado` (o Tiny mudou o pedido) também.
- Conversão: etiquetas "prioridade/urgente/atenção…" → prioridade do card vivo + etiqueta arquivada.

Bateria: bloco 38 novo (35 verificações) + 4 linhas antigas com a assinatura nova (E-120). Resultado: **1.123 verdes, 0 vermelhas**.

Aplicação em produção (21/10 ~05:55 UTC): `npm run banco:aplicar -- --confirmar --so 20261022010000_plt_card_prioridade_prazo_ordem.sql` → aplicada, **integração idêntica** (`e2109f3a…`, linhas idênticas). Antes, conferido que nenhuma outra frente tinha mexido nessas funções em produção (assinaturas e corpos da base). Dado mudado: a etiqueta "PRIORIDADE" (id 5) **arquivada** (0 cards a tinham; nenhum fato de prioridade gerado).

Conferência no banco real como `authenticated` (bloco `DO` terminado em `RAISE` — A-75, nada gravado), 3 pessoas (admin, operador da MONTAGEM, operador com PCP), 3 chamadas cada (a última vale):

| Porta | Tempo |
|---|---|
| `plt_fn_quadro_setor` MONTAGEM (7 colunas) — prioridade / entrega / alfabética | 5,7–7,0 ms |
| `plt_fn_quadro_coluna` (Ver mais, entrega) | 2,0–11,3 ms (1ª fria) |
| `plt_fn_card_janela` | 5,9–11,2 ms |
| `plt_fn_pcp_quadro` (entrega) | 13,2 ms (operador sem PCP: 0 linhas, 4,2 ms) |

Gesto de prioridade no banco real (admin, numa peça da MONTAGEM, bloco desfeito pelo `RAISE`): 4 toques seguidos 22 / 11 / 3,7 / 3,5 ms (o 1º de todos, frio, 201 ms); com o pedido urgente, a 1ª peça da coluna em ordem alfabética passou a ser do pedido urgente; o responsável de setor gravou (`posto`) e o quadro do setor recebeu o aviso. Nada ficou gravado.

`EXPLAIN (ANALYZE, BUFFERS)` da coluna maior (MONTAGEM, 51 peças) antes de aplicar, com o corpo inline: índice `plt_cards_quadro_idx` + PK de `pedidos` + `plt_cards_pedido_unico` + PK da reposição; ordenação top-N em memória (26 kB); 17 ms frio. Advisors depois: segurança +2 avisos esperados (as 2 portas novas, de propósito); desempenho sem item novo.

## 4. Telas

- `src/kanban/prazo.ts` (dias até a entrega, cor, texto acessível) + testes.
- `src/kanban/prioridade.ts` (níveis, porta, ordem da fila, `useOrdemDaFila` com localStorage em try/catch — quadros e PCP separados).
- `src/kanban/componentes/MarcasDoCard.tsx`: `ChipPrazo`, `PontoPrioridade`, `BotaoOrdemFila` (só ícone, nome acessível), `SeletorPrioridade` + testes.
- `CartaoUnidade.tsx`: sem o nome do cliente; prioridade no topo (URGENTE escrito, borda e faixa vermelhas); chip do prazo no topo (o "Vence" antigo do avulso virou o chip) + testes.
- `QuadroKanban.tsx` (botão de ordem acima das colunas), `useQuadro.ts` (a ordem na chave e nas portas; o aviso relê todas as ordens do setor), `quadro.ts`, `QuadroSetor.tsx`, `TelaSetor.tsx`.
- `JanelaDoCard.tsx` + `janela/ResponsaveisPorSetor.tsx` + `janela/api.ts`: Responsáveis por setor, Datas do Tiny (só leitura no card de pedido), Prioridade, Etiquetas (sem "prioridade"), Campos vazios limpos.
- `ModalNovoCardAvulso.tsx` (atalho "Prioridade" separado de "Etiqueta"), `avulso.ts`, `Seletores.tsx` (comentário).
- `PCP.tsx`: botão de ordem nas abas Reabastecimento e Aguardando liberação; `CartaoPedidoPcp` novo (grade `auto-rows-fr`, rodapé no fim, estoque em selo, prazo + tempo à direita, prioridade + abrir o card + `acoesExtras` para o stand-by); a reposição ganha a bolinha e o seletor.
- **Fora da minha lista (mínimo, sinalizado):** `ModalLinhaTempo.tsx` — 2 rótulos novos na tabela de nomes dos fatos (senão a linha do tempo mostraria o código do fato).

Verificação: `npm run build` ✅ · `npm run lint` ✅ · `npm test` **41 arquivos / 219 testes** ✅ (3 arquivos novos: prazo, marcas do card, card de produção — 19 testes) · `npm run test:banco` **1.123 verdes** ✅ · mojibake 0.

## 5. Checklist de desempenho (Lei §12)

- [x] Cada tela: 1 requisição (quadro, PCP por página, janela); trocar a ordem = 1 requisição; "Ver mais" = 1.
- [x] Nenhum relógio/`postgres_changes` novo; tempo real pelos avisos do setor/PCP de sempre.
- [x] Portas medidas no banco real (tabela acima), muito abaixo de 50 ms; o PCP ficou mais barato (estoque só da página).
- [x] Índices: os caminhos usam índices que já existiam (coluna, pedido único, PK); advisors sem item novo.
- [x] Listas: colunas por cursor em qualquer ordem; PCP por deslocamento como já era (lista pequena e com teto 100 — exceção que já existia).
- [x] Escrita idempotente (prioridade e responsável: o mesmo toque não grava de novo).
- [ ] Pacote: depois — `index` 361,9 kB (108,8 kB comprimido), `JanelaDoCard` 32,5 kB, `TelaSetor` 18,4 kB; o "antes" não foi medido nesta sessão (dívida de registro, não de peso: os arquivos novos somam poucos kB).
- Dívidas abertas (para a lei): (1) o PCP não é avisado ao vivo quando o Tiny muda a data de um pedido ainda **sem peça liberada** (o aviso nasce do `pedido_atualizado`, que só existe com peça liberada) — a tela relê no próximo aviso do PCP; (2) a aba Lançamento manual ainda não mostra a prioridade do avulso (mudaria a forma da lista — fica para quando a aba for tocada).

## 6. Erros e acertos

- E-120 (assinatura velha na bateria) — corrigido na hora.
- A-85 (cursor em qualquer ordem pelas chaves do último card), A-86 (rodar a migration de novo na bateria para provar a conversão de dados).
