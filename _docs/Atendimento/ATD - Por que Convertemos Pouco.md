---
titulo: Conclusões — por que estamos convertendo pouco
tipo: nota
criado: 2026-09-03
atualizado: 2026-09-17
tags: [atendimento, comercial]
---

# 🎯 Por que estamos convertendo pouco

> [!info] Origem
> Migrada em 17/09/2026 do cofre da loja (`_Docs/memoria/CONCLUSOES - Por que convertemos pouco.md`, Painel de Recompra). Conteúdo preservado na íntegra; diagnóstico original de 03/09/2026.

**Base:** 126 atendimentos **finalizados** lidos um a um no Multiatendimento do Datacrazy, janela ~27/08 a 03/09/2026, leitura em 03/09/2026. Somente leitura — nada foi respondido, movido ou alterado.

## O placar

| | Atendimentos | Fechou pedido | % |
|---|---|---|---|
| **Total da amostra** | **126** | **13** | **10,3%** |
| Felipe Alves (gerente) | 21 | 6 | 28,6% |
| Gabriel Ferreira | 40 | 7 | 17,5% |
| Gessica Silva | 50 | 6 | 12,0% |
| **Só automação (nenhum humano)** | **31** | **0** | **0%** |

> [!warning] Cuidado com o número do Felipe
> Ele entra tarde e quase sempre em lead já quente. O 28,6% mede **seleção** tanto quanto técnica.

---

## As 5 causas, em ordem de tamanho

### 1. Um em cada quatro "atendimentos" nunca teve um ser humano
**31 dos 126 (24,6%)** são só robô — quase todos resposta de comentário do Instagram. O fluxo é sempre o mesmo: o robô pergunta *"Posso te chamar no WhatsApp para te passar os detalhes?"*, ninguém aparece, e o atendimento é **encerrado automaticamente entre 15 e 60 minutos depois**. Conversão: **zero**.

E não é só comentário. *Pedro Cavalcanti M* escreveu *"Vocês possuem alguma armário estante com largura de 45 cm?"* e o atendimento foi finalizado **sem uma única resposta humana**. *Thalita* pediu o número do WhatsApp e recebeu o robô de novo.

**Correção:** proibir encerramento automático de atendimento sem mensagem humana; responder o comentário do Instagram **já com o preço e a condição**, antes de pedir o WhatsApp.

### 2. A automação atropela o vendedor
**76 dos 126 (60,3%)** tiveram disparo automático **por cima de conversa humana viva**.

- *Marta Silva* perguntou se a mesa tinha pés de metalon às 08:26. Recebeu **6 mensagens automáticas** entre 08:42 e 14:28. Quando voltou às 15:44 explicando o que queria, o atendimento foi encerrado 12 minutos depois sem resposta.
- *Gabriel Carneiro* já tinha decidido e tomou 4 disparos à tarde.
- *Luciana* recebeu "Ficou com alguma dúvida?" **4 minutos antes** de a Gessica responder.

**Correção (a mais barata e de maior efeito):** nenhum disparo automático se houver mensagem de vendedor nas últimas 24 horas.

### 3. Objeção de preço não é tratada — em lugar nenhum
Em **100% dos casos lidos**, quando o cliente disse que estava caro ou que estava pesquisando preço, **ninguém contornou**. A conversa morreu na objeção.
*Lorena*: "Valor tá muito alto" → silêncio. *Andrecelly*: fez a conta de que dois móveis saem mais caro que um guarda-roupa → recebeu "é MDF, o mesmo material dos planejados" e nada mais.

Isso não é falha de pessoa: **não existe roteiro de objeção na casa**, nem o gerente tem um. É a lacuna nº 1 de treinamento. O roteiro está escrito em [[ATD - FAQ e Respostas Padrao]].

### 4. Não existe follow-up de verdade
A régua automática de **7 mensagens se esgota em ~6h30** e o lead é encerrado no mesmo dia. Móvel de R$ 300 a R$ 2.400 tem ciclo de decisão de **dias**: mede parede, fala com o marido, compara.
Os **14 clientes** que disseram "vou pensar / vou olhar / depois entro em contato" **nunca mais foram tocados**. E a perda é invisível: o CRM mostra "finalizado".

### 5. O Instagram é 56% do volume e o pior canal
**70 dos 126** atendimentos nasceram no Instagram. A maioria morre em comentário automático ou no menu do BYMO.
O caso *Jairane R Bastos* é o retrato: cliente ativa, respondendo story há meses — *"Amei linda 💖"*, *"Lolo vou comprar um"*, *"depois vou comprar mais umas 2"*, *"Quanto??"* — e **toda vez** o BYMO devolveu um menu de três botões e a automação encerrou em ~10 minutos. Em meses, as duas únicas respostas de valor foram do Felipe.

**Correção:** resposta de story de cliente ativo **não entra no menu**, vai direto para o vendedor. E todo lead de Instagram com intenção é puxado para o WhatsApp — é o movimento do Felipe (*"Qual seu whatsapp?"*), o de maior alavancagem disponível hoje.

---

## Três causas menores que também doem

**6. Tempo de resposta.** Respostas de 1h46 (*Kelly*), 3h (*Fabiana*) e do dia seguinte em leads que perguntaram preço. Meta razoável: **10 minutos** no horário comercial, e fila obrigatória de retomada às 8h para o que entrou fora do horário.

**7. Condições comerciais divergentes.** Na mesma semana apareceram 3x, 5x e 7x sem juros. Cliente que fala com dois vendedores recebe duas lojas diferentes. Precisa de **uma tabela escrita**.

**8. Cliente que quer ir à loja está sendo desviado.** *"Pode ir agora a tarde até a loja e realizar a compra?"* → *"fazemos o pedido por aqui mesmo."* Ele foi, comprou lá, e a venda sumiu do funil. Isso ainda **empurra a conversão medida para baixo**.

---

## O que eu faria primeiro (leitura do vigia)

| Ordem | Ação | Custo | Efeito esperado |
|---|---|---|---|
| 1 | Travar disparo automático quando houver vendedor na conversa | baixo (config) | alto e imediato |
| 2 | Proibir encerramento automático sem resposta humana | baixo (config) | alto |
| 3 | Responder comentário do Instagram com preço + condição | baixo | alto (24,6% do volume) |
| 4 | Treinar o roteiro de objeção de preço (30 min de reunião) | baixo | alto |
| 5 | Corrigir o nome "Gabriel Morais" na recepção | trivial | médio |
| 6 | Confirmar a condição assim que o cliente responde o bairro | baixo | médio-alto |
| 7 | Espalhar a régua de follow-up em 15 dias | médio | médio-alto |
| 8 | Tabela única de parcelamento e desconto | baixo | médio |
| 9 | Meta de 10 min para primeira resposta + fila das 8h | médio | alto |

> [!note] O que isto não é
> Isto não é avaliação de RH. **A maior parte da perda que eu encontrei não é culpa do vendedor — é do desenho do atendimento.** Gessica e Gabriel estão vendendo dentro de um sistema que encerra conversa quente, dispara mensagem por cima deles e nunca lhes deu um roteiro de objeção. Corrigir os itens 1 a 3 não custa treinamento nenhum e mexe em 60% dos atendimentos.

## Ver também

[[000 - ATENDIMENTO (indice)]] · [[ATD - Recepcao e Follow-up]] · [[ATD - Equipe - Felipe Padrao Ouro]] · [[ATD - Equipe - Gessica]] · [[ATD - Equipe - Gabriel]]
