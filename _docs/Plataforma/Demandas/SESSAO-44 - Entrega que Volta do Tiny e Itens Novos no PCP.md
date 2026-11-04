---
titulo: "SESSAO-44 — Entrega que volta do Tiny e itens novos no PCP"
tipo: demanda
status: pronta para code
data: 2026-11-03
atualizado: 2026-11-04
tags: [plataforma, demanda, pedidos, pcp, tiny, rotas]
---

# 🎯 SESSAO-44 — Entrega que volta do Tiny e itens novos no PCP (03/11/2026)

> Mapeada pelo Cowork com o dono em 03/11/2026, com leitura do banco de produção e do código (repositório até o commit 060fdaf). **Só leitura: nada foi alterado.**

⏫ **Urgente:** o pedido **13797** tem previsão de entrega em **04/11/2026** e está com 3 móveis fora da produção. A frente 1 vem primeiro e pode subir sozinha, antes do resto, com o OK do dono.

## O que é

Corrige dois defeitos que deixam o pedido errado sem saída para a equipe e acerta os dois pedidos atingidos:
1. o Tiny marca "Entregue", volta atrás e a plataforma segue encerrada, sem ninguém conseguir reabrir, nem admin;
2. o vendedor acrescenta itens depois de o pedido sair do PCP e os itens novos ficam sem card e sem aviso.

## O pedido do dono (texto fiel, 03/11)

- *"Hoje aconteceu um caso de um pedido ter sido dado como entregue de forma errada na plataforma mesmo, ele foi dado como entregue de forma errada e o pessoal nao conseguiu retornar isso, nem mesmo os admins, o pedido foi o 13787, investigue o caso e ajuste tudo, verifique se itens do mesmo foram lançados para produçao como cards avulsos também"*
- *"Outro caso foi um pedido, acredito até que o mesmo pedido, ele foi lançado de PCP para produção quando possuia 3 itens, porem o vendedor foi la no tiny e colocou mais 3 itens dentro desse mesmo pedido, porem o mesmo nao retornou mais para PCP, ele simplesmente aceitou que tinha apenas os 3 primeiros e sumiu"*

## Respostas do dono (03/11, fechadas: não perguntar de novo)

1. **Quem reabre entrega de outro dia:** só admin. Logística e entregador seguem com o desfazer do dia.
2. **Itens novos em pedido em rota:** volta ao PCP só com os itens novos **e** avisa a logística para segurar a entrega.
3. **Itens novos em pedido já entregue:** abre uma pendência só para os itens novos.
4. **Pedido 13787:** o dono não sabe onde estão os móveis. O que **não** virou card avulso fica no PCP. Os cards avulsos feitos para ele viram **cards normais de produção** do pedido.
5. **Volta atrás no Tiny (aprovado como proposto):** entrega que veio do Tiny reabre sozinha; entrega marcada aqui por uma pessoa não reabre, só avisa a logística.
6. **Execução:** pelo Claude Code, nesta demanda. O Cowork não alterou o banco.

## O raio-x do banco (só leitura, 03/11, por volta de 23:20; releia antes de agir)

Horários em Brasília.

### Pedido 13787 (id 7944, card de pedido 14542098, Tiny hoje "Preparando envio")

| Quando | Fato |
|---|---|
| 31/10 15:33 | Chegou como "Em aberto". |
| 31/10 15:34 | O sistema reservou 2 peças do estoque: 14541923 (SKU 567, item 1) e 14541241 (SKU 566, item 3). |
| 03/11 07:34 | Aviso do Tiny "Entregue". Fechamento assinado "Sistema": evento de entrega 14547620, card de pedido arquivado ("sai do PCP"), as 2 peças reservadas baixadas com motivo "venda". |
| 03/11 08:11 | Aviso do Tiny "Preparando envio". A plataforma não reagiu. |
| 03/11 08:43 | Guilherme criou o avulso 14542123, "13787 - balcão - Branco - 60 x 86 x 42 cm PERSONALIZADO". Concluído às 14:34, em LIMPEZA E EMBALAGEM. |
| 03/11 09:04 | Guilherme criou o avulso 14542126, "13787 - Armário Aéreo 2 portas - Branco - 60 x 62 x 30". Concluído às 15:38, em LIMPEZA E EMBALAGEM. |

- **Itens hoje:** 1) 567 Armário Aéreo 3 portas · 2) 423 Armário Aéreo 2 portas · 3) 566 Balcão 3 portas · 4) sem código, balcão 60 x 86 x 42 PERSONALIZADO. Uma unidade de cada.
- Nunca teve peça liberada: **zero** cards de unidade, nunca foi às ROTAS, sem programação.
- A entrega **não** nasceu na plataforma, embora a equipe tenha entendido assim: o evento é assinado "Sistema", com fonte Tiny. O banco não sabe quem marcou no Tiny.
- **Sem vínculo com o pedido, não mexer:** às 14:06 de 03/11 o Guilherme lançou uma reposição manual de 3 unidades do SKU 423 (card 14542155, peças 14542156/57/58 na MONTAGEM). Nada a liga ao 13787.

### Pedido 13797 (id 7954, card de pedido 14542142, previsão 04/11)

- Chegou às 11:42 com 3 itens. O PCP liberou até às 15:25, quando o João Lucas usou a peça do estoque no terceiro item e o pedido ficou "liberado por completo" (3 de 3).
- Às 15:41 chegou a atualização do Tiny. A lista passou a 6 itens e a plataforma só gravou "pedido atualizado".
- **Com card:** 528 Mesa L (14542143, MONTAGEM) · 454 Armário Alto (14542153, Expedição) · 452 Armário Baixo (14542161, Expedição).
- **Sem card:** seq 4, 327 Armário multiuso 2 portas · seq 5, 567 Armário Aéreo 3 portas · seq 6, 566 Balcão 3 portas.
- **Estoque livre às 23:20:** 327 ×2 · 566 ×3 · 567 ×1 (mais uma 567 reservada para o 13805).

### Busca geral

- Pedido liberado por completo com peça faltando: **só o 13797**.
- Peça de pedido vivo ligada a item diferente da posição: **nenhuma**.
- Pedido voltando de "Entregue" no Tiny em 30 dias: 13787, 13620 e 13684. O 13684 voltou em 56 segundos, sem efeito aqui. O 13620 foi marcado aqui por uma pessoa, voltou no Tiny em 71 segundos e foi cancelado depois.
- Entregue aqui e cancelado no Tiny: **13620, 13689 e 13699**. Fora do escopo; listar no handoff para o dono conferir.

## Causas confirmadas no código

- **Sem caminho de volta:** a reação à situação do pedido só trata a mudança **para** Entregue. A saída de Entregue não reabre nada.
- **Beco sem saída no desfazer:** a porta de desfazer recusa entrega assinada "Sistema" com a frase "para desfazer, mude a situação no Tiny", e isso não tem efeito. Também recusa entrega de outro dia e entrega parcial. A ficha e "Entregas do dia" escondem o botão, sem explicar.
- **Conta da liberação parada:** a conta do "liberado por completo" só roda por fato de card. Não existe gatilho em itens do pedido, e o quadro do PCP só mostra pedido com essa marca vazia.
- **Armadilha de ordem:** dentro da porta única de gravação do Tiny, o `update pedidos` acontece **antes** de os itens serem apagados e regravados. Um gatilho comum em `pedidos` enxerga os itens **antigos**.
- **Item por posição:** a regravação renumera os itens. Liberação, conclusão e contagem ligam a peça por posição (`item_seq`). A regra de frete também casa por posição.
- **Reserva de estoque:** a reserva automática é avaliada na chegada do pedido; confira como ela trata itens que aparecem depois.

## As frentes

### Frente 1 · Acertar o 13797 ⏫ (faça primeiro)

1. Releia o pedido. Se o PCP ou alguém já tiver mexido, pare e avise o dono.
2. Com o OK do dono, rode a conta da liberação desse pedido, para ele voltar ao PCP. Registre com fato de trilha.
3. A janela de liberação deve oferecer só as vagas 4, 5 e 6, com a sugestão de estoque de sempre. Quem libera é a equipe, não o script.

### Frente 2 · Itens novos voltam ao PCP

- Depois de **gravados os itens**, compare a lista nova com a anterior e refaça a conta da liberação. Escolha técnica a trazer ao dono: gatilho adiado sobre `pedidos` (preferido, não encosta nas tabelas da integração) ou trecho no fim da porta de gravação (encosta no caminho do n8n; regra 3).
- Fato novo na trilha com o que entrou e o que saiu. Aviso no sino para quem cuida do PCP.
- O PCP mostra só o que falta liberar e não mexe nas peças já em andamento.
- **Em rota:** volta ao PCP e avisa a logística para segurar a entrega. Não tira o pedido da rota sozinho.
- **Já entregue:** abre pendência só para os itens novos. Use o caminho de reentrega que já existe (ele já conta só o que falta entregar).
- **Entrega parcial, devolução e cancelado:** não reabrir sozinho nem quebrar esses fluxos.
- **Item que saiu ou diminuiu com peça já criada:** nunca arquivar sozinho. Avisar o PCP. O dono não pediu tratamento além disso; registre como decisão provisória.
- Itens novos passam pela avaliação de reserva de estoque, como os da chegada, se a conferência mostrar que isso não acontece hoje.

### Frente 3 · Peça ligada ao produto certo

- A correspondência item × peça deixa de depender só da posição: casa por produto (código; sem código, descrição), com a posição como desempate.
- Vale para: janela de liberação, liberar, conta da liberação, concluir pelo super admin, contagens e a regra de frete.
- Não renumerar card antigo por carga em massa sem o OK do dono.

### Frente 4 · Reabrir entrega e explicar o motivo

- Gesto novo de **admin**, "Reabrir entrega", na ficha do pedido: **qualquer dia**, inclusive entrega do Tiny, sempre com **motivo** da lista de motivos e trilha.
- Logística e entregador continuam com o desfazer do dia, como hoje.
- Reabre pelo mesmo caminho do desfazer, por evento: card do pedido e peças voltam. Entrega parcial segue recusada, com o texto atual.
- **Tiny:** só devolve a situação quando ele ainda estiver "Entregue". Se já saiu de lá, não envia nada.
- A ficha **explica** quando não dá para desfazer, em vez de esconder o botão.
- **Confira o defeito provável:** ao fechar, a reserva da peça é zerada; ao desfazer, a peça parece voltar sem a reserva. Garanta que ela volte reservada ao mesmo pedido e item.

### Frente 5 · Volta atrás no Tiny

- Situação sai de Entregue para outra que não seja encerramento:
  - entrega vigente assinada "Sistema" → reabre sozinha pelo mesmo caminho da frente 4, com fato na trilha e aviso à logística;
  - entrega de pessoa → não reabre; avisa a logística;
  - sem entrega vigente → nada.
- Idempotente, à prova de aviso repetido e fora de ordem. O vaivém de menos de 1 minuto é real.
- Não reenviar nada ao Tiny nessa volta, para não criar eco.
- A reação à situação engole erro para proteger a gravação do pedido: se reabrir falhar, gere alerta com a porta de alerta que já existe.

### Frente 6 · Acertar o 13787

Só depois das frentes 4 e 5 e com o OK do dono. Releia tudo antes, e use script em `supabase/manutencao`.

1. Reabrir a entrega por evento, sem mudar o Tiny (ele já está em "Preparando envio").
2. **Peças baixadas:** as 2 peças do estoque **não** voltam neste script. O dono não sabe onde estão. Diga isso no handoff: se estiverem no galpão, a logística acerta pela contagem. Registre como decisão provisória.
3. **Itens 1 e 3 (567 e 566):** ficam no PCP, para a equipe liberar.
4. **Avulsos 14542126 e 14542123:** viram cards normais do pedido, ligados aos itens 2 e 4.
   - Preferência: o **mesmo card** muda de dono por fato novo, como a peça vinculada, mantendo histórico e tempo. Se isso não for seguro, nasce a peça do pedido com referência ao avulso; o avulso fica no histórico.
   - **Decisão provisória de local:** como os dois já foram concluídos, entram **prontos na Expedição**, não de volta em LIMPEZA E EMBALAGEM.
   - Hoje a regra é "avulso nunca vira peça". Registre a exceção como decisão nova, só para este acerto. **Não** criar botão de conversão.
5. Conferir no fim: 4 unidades no pedido, 2 prontas na Expedição, 2 no PCP, sem duplicar nos números do estoque, nos tempos e nas metas.

## Fora do escopo

- Reposição do SKU 423 (card 14542155).
- Pedidos 13620, 13689 e 13699: só listar no handoff.
- Bloquear ou questionar "Entregue" no Tiny, e descobrir quem marcou.
- Botão geral de transformar avulso em peça.
- Mudanças em estoque físico ou contagem.

## Critérios de aceite

- [ ] 13797 de volta ao PCP só com as 3 vagas novas; as peças 14542143, 14542153 e 14542161 não mudaram.
- [ ] Item acrescentado no Tiny faz o pedido liberado voltar ao PCP só com o que falta, com aviso e trilha.
- [ ] Em rota: volta ao PCP, segue na rota e a logística recebe aviso.
- [ ] Entregue: pendência só dos itens novos, sem reabrir a entrega do que ficou com o cliente.
- [ ] Mudança só de preço, observação ou situação não reabre o PCP.
- [ ] Item inserido no meio da lista do Tiny não troca o produto de nenhuma peça.
- [ ] Item removido ou reduzido nunca arquiva peça sozinho.
- [ ] Admin reabre entrega de outro dia e entrega do Tiny, com motivo; logística e entregador não.
- [ ] Peça reservada volta reservada ao mesmo pedido e item.
- [ ] Tela explica por que não dá para desfazer; entrega parcial segue recusada.
- [ ] Tiny Entregue → Preparando envio reabre a entrega do Sistema, uma vez só, mesmo com aviso repetido ou fora de ordem.
- [ ] A mesma volta em entrega de pessoa não reabre e avisa a logística.
- [ ] Nada aqui envia situação ao Tiny sem necessidade; fluxo normal de entrega nos dois lados segue igual.
- [ ] 13787 como descrito na frente 6, sem duplicar números.
- [ ] Bateria do banco 2×, tsc, lint, vitest, build, advisors sem nada novo.
- [ ] Lei de desempenho: checklist no handoff, com plano ×100 das portas novas ou tocadas.
- [ ] Handoff com roteiro de teste por frente, decisões provisórias e a lista dos pedidos para conferir.

## Notas para o Claude Code

- **Leia** `SUPA - Esquema do Banco`, a Lei de Desempenho e a Memória de Aprendizado. Recrie função a partir da versão **viva** do banco, conferindo o corpo. Reaplicar migration antiga já desfez trabalho novo.
- Eventos são append-only: correção é fato novo. Toda atividade gera log. Sem relógio novo: trabalho nasce do fato.
- O banco está no plano gratuito.
- **Regra 2:** migration, script de acerto, publicação do site e qualquer mudança no fluxo do n8n só com aprovação do dono na conversa. Cada um em passo separado.
- Prefixo de migration depois de `20261031040000`, ou da última que existir. Numeração D-, E- e A- depois da última usada no cofre.
- Com o dono: português de gente, sem códigos (regra 12c). Pedido e nome do móvel podem.

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)

Propostas pelo Cowork, **ainda não criadas**: a criação foi bloqueada pela permissão automática da sessão do Cowork. Criar com o OK do dono (regra 19):

- Pedidos - Acertar o pedido 13797 com os 3 itens que ficaram fora da produção (urgente)
- Pedidos - Acertar o pedido 13787 entregue por engano (alta)
- Pedidos - Reabrir entrega pelo admin em qualquer dia
- Tiny - Pedido que sai de Entregue no Tiny reabre na plataforma
- PCP - Itens novos no Tiny voltam o pedido para o PCP
- PCP - Peça ligada ao produto certo quando o Tiny muda os itens

## Resultado (preencher ao entregar)

*O que foi feito, o que mudou de rota, link do handoff da sessão.*
