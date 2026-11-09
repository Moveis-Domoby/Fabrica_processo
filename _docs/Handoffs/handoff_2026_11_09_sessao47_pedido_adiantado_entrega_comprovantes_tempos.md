---
titulo: Handoff — SESSAO-47 · pedido adiantado no Tiny volta ao PCP, o dia real da entrega, vários comprovantes e a configuração do painel de tempos
tipo: handoff
data: 2026-11-09
tags: [handoff, sessao-47, expedicao, pcp, tiny, entregas, comprovantes, calendario, dashboards, tempos, modo-tv]
---

# 📋 Handoff — SESSAO-47 · Pedido adiantado no Tiny, o dia real da entrega, comprovantes e o painel de tempos (09/11/2026)

Demanda: [[SESSAO-47 - Pedido Adiantado no Tiny Data Real da Entrega Comprovantes e Painel de Tempos]] · Diário: `_docs/Plataforma/Execucao/SESSAO-47.md` (+ `SESSAO-47 - bloco B.md` e `SESSAO-47 - bloco C.md`) · Ramo: `sessao-47-pedido-adiantado-entrega-comprovantes-tempos`

> ⏳ **Nada foi aplicado no banco nem publicado.** O código está no ramo, testado; a atualização do banco, a publicação do site e qualquer coisa no n8n esperam o OK do dono (regra 2). O n8n **não muda**.

## 1. Objetivo

Os pedidos do dono de 09/11, em três blocos independentes:
- **A** — o furo do 13818: pedido que o Tiny levou adiante (Faturado, Pronto para envio, Enviado) e que ainda tem produto por liberar sumia do PCP **e** da Expedição. Agora a Expedição mostra com o aviso e dois botões devolvem o pedido ao PCP mudando a situação no Tiny.
- **B** — ao dar um pedido como entregue, poder marcar **o dia em que foi entregue de fato** (nunca um dia que ainda não chegou), valendo em toda a plataforma, inclusive no calendário das rotas; e anexar **vários comprovantes de uma vez**.
- **C** — um botão **"Configurar painel"** em Dashboards → Tempos de produção (tipo de gráfico, ligar e desligar montadores vendo quem é cada letra, e as recomendações que o dono aceitou).

## 2. O que foi feito

### Bloco A — Pedido adiantado no Tiny que ainda falta produzir (frentes 1 a 4)

| Frente | O que mudou |
|---|---|
| **1 · A Expedição mostra o pedido** | O pedido Faturado, Pronto para envio ou Enviado no Tiny com produto por liberar aparece **mesmo com zero peça pronta**, com o aviso da situação real: *"Este pedido está como Pronto para envio no Tiny, por isso saiu do PCP. Ainda falta liberar 2 produtos."* Com peça pronta **e** falta, o card normal ganha o mesmo aviso. Quadradinho novo **"Saiu do PCP pelo Tiny"** nos filtros. Preparando envio, Em aberto, Entregue e Cancelado não ganham o aviso. |
| **2 · Os dois botões** | **"Voltar para Em aberto (Tiny)"** e **"Voltar para Preparando envio (Tiny)"**, no aviso, para logística e admin. Confirmação de uma frase (*"O pedido 13818 vai voltar ao PCP com 2 produtos para liberar, e no Tiny passa para Preparando envio."*). Num toque: a plataforma pede a situação ao Tiny pela fila de saída que já existia, o pedido volta ao PCP **na hora** só com o que falta, fica o registro (quem, situação de antes, situação pedida) e o PCP é avisado. Toque repetido = um efeito. A volta vale até o Tiny mostrar outra situação; aviso antigo do Tiny fora de ordem não esconde o pedido. O Tiny recusou ou não respondeu → o pedido segue no PCP com **"O Tiny ainda não confirmou a mudança"** e o alerta sai pela porta de sempre. Com a ida ao Tiny desligada, os botões ficam apagados com a explicação. O stand-by é mantido (o pedido volta para a aba Stand-by). |
| **3 · Na janela de liberar peça** | Com o pedido de origem adiantado no Tiny e o produto voltando para a produção, a janela mostra a situação real e três opções **no mesmo gesto**: "Voltar para Em aberto (Tiny)", "Voltar para Preparando envio (Tiny)" e **"Deixar como está"** (o pedido fica na Expedição, com o aviso). "Não por enquanto" (stand-by) passou a funcionar também com o Tiny adiante — antes o gesto inteiro era recusado. |
| **4 · Avisos que dizem a verdade** | "Pedido N voltou ao PCP" só sai quando voltou. Quando não volta: *"O produto saiu do pedido N, mas ele está como Pronto para envio no Tiny e ficou na Expedição esperando decisão."* — vai para a logística e abre a Expedição já no filtro novo. A notificação da janela de liberar diz o que aconteceu de verdade. |

Banco: `supabase/migrations/20261109010000_plt_sessao47_base.sql` (os fatos novos, a marca no card, a regra única do PCP) e `20261109020000_plt_pedido_adiantado_tiny.sql`. Telas: `src/logistica/voltaPcp.ts` (novo), `src/logistica/api.ts`, `src/paginas/Expedicao.tsx`, `src/logistica/componentes/ModalLiberarPeca.tsx`, `src/paginas/PCP.tsx`, `src/kanban/tipos.ts`, `src/kanban/componentes/ModalLinhaTempo.tsx`, `src/auditoria/rotulos.ts`, `src/notificacoes/api.ts`. Testes: bateria (bloco "SESSAO-47 · A", 20 conferências), `src/paginas/Expedicao.test.tsx`, `src/logistica/componentes/ModalLiberarPeca.test.tsx`, `src/logistica/voltaPcp.test.ts`.

Fotos (a tela real com dados de exemplo — nomes inventados):

![[sessao47-expedicao.png]]
*A Expedição: o sexto quadradinho, o aviso com a situação real e os dois botões; o pedido já devolvido mostra "O Tiny ainda não confirmou a mudança".*

![[sessao47-expedicao-confirmar.png]]
*A confirmação de uma frase.*

![[sessao47-expedicao-liberar-peca.png]]
*A janela de liberar peça com a situação real e as três opções.*

![[sessao47-expedicao-tiny-desligado.png]]
*Com a ida ao Tiny desligada: botões apagados e a explicação.*

![[sessao47-expedicao-celular.jpg]]
*No celular (375 px), sem rolagem lateral. Tablet: `sessao47-expedicao-tablet.png`.*

### Bloco B — A entrega (frentes 5 e 6)

| Frente | O que mudou |
|---|---|
| **5 · "Marcar como entregue no dia..."** | Depois de tocar em "Entregue" — em ROTAS → Entregas (logística) e nas Entregas do dia (entregador) — aparecem **"Confirmar entrega"** (hoje, como sempre), **"Marcar como entregue no dia..."** (abre "Em que dia foi entregue?" e o botão vira "Marcar como entregue em dd/mm/aaaa") e **"Ainda não"**. Com peças ainda em produção o aviso da imagem do dono continua, e os dois botões de confirmar valem como o "entregar mesmo assim" de antes. **O dia de amanhã é recusado pela tela e pelo banco**; o dia anterior à chegada do pedido também. A entrega nasce já com o dia real (a hora de um dia passado = o fim do expediente da fábrica naquele dia) e com a hora em que foi registrada — a trilha diz "Marcado como entregue no dia X (registrado em Y)". |
| **5 · A data vale em toda a plataforma** | Uma data só (guardada no card do pedido) para: a ficha ("Entregue no dia 06/11/2026, registrado em 09/11/2026 às 10:32 por Fulano"), a lista de pedidos, ROTAS → Entregas, Já programadas, as Entregas do dia ("entregue em dd/mm" e a lista dos entregues neste dia que eram de outra rota), **o calendário das rotas** (o entregue no dia real, com a nota "prog. dd/mm" quando difere do programado) e o número de entregas do painel de Motivos. |
| **5 · Desfazer e corrigir** | "Desfazer do dia" conta pelo dia em que a entrega foi **registrada** (quem marcou hoje "entregue ontem" ainda desfaz hoje). **Corrigir depois: só o admin**, na ficha, pelo botão **"Alterar a data da entrega"** (dia + motivo opcional) — é um registro novo com o dia de antes e o novo; a entrega original não é editada. Logística e entregador não veem o botão, e o banco recusa. O Tiny continua recebendo "Entregue" como hoje; a data não vai. |
| **6 · Vários comprovantes de uma vez** | Nos três lugares (o painel do "Entregue" do entregador, o botão "Comprovante" do card e a ficha — que ganhou "Anexar comprovantes") dá para **escolher vários arquivos de uma vez** (até 10; os mesmos tipos e o mesmo tamanho de antes). Cada um sobe e é registrado sozinho, um depois do outro: **o que falha não derruba os outros**, a janela diz qual falhou e por quê, e "Tentar de novo" manda só ele. A entrega continua sendo registrada **antes** dos comprovantes. |
| **Extra · o calendário mais firme** | A leitura do calendário das rotas passou a usar sempre o plano feito sob medida para o período — com 100 vezes o movimento, da 6ª leitura em diante na mesma conexão ela levava dezenas de segundos (achado do ajuste de 06/11). |

Banco: `supabase/migrations/20261109030000_plt_entrega_dia_real.sql` (a frente 6 não mexe no banco). Telas: `src/rotas/ConfirmarEntrega.tsx`, `diaDaEntrega.ts`, `ModalComprovantes.tsx`, `enviarComprovantes.ts`, `useComprovantes.ts` (novos), `src/pedidos/AlterarDataDaEntrega.tsx`, `entregaNaFicha.ts` (novos), `src/paginas/Rotas.tsx`, `EntregasDoDia.tsx`, `src/pedidos/FichaDoPedido.tsx`, `ProducaoDoPedido.tsx`, `src/rotas/AbaCalendario.tsx`, `src/rotas/api.ts`. Testes: bateria (bloco "SESSAO-47 · Bloco B", 35 conferências) e os testes de tela ao lado de cada arquivo. Diário próprio: `Execucao/SESSAO-47 - bloco B.md`.

![[sessao47-entrega-confirmar.png]]
*ROTAS → Entregas, depois de "Entregue": os três botões.*

![[sessao47-entrega-em-producao-dia.png]]
*O pedido que ainda aparece em produção: o aviso continua, e "Marcar como entregue no dia..." abre a escolha do dia.*

![[sessao47-entregador-celular.jpg]]
*O painel do entregador no celular (375 px): vários comprovantes escolhidos, a observação e os três botões.*

![[sessao47-comprovantes.png]]
*A janela dos comprovantes: dois subiram, um falhou — o porquê na linha e "Tentar de novo o arquivo que falhou".*

![[sessao47-calendario-dia-real.png]]
*O calendário das rotas: o 13841 aparece no dia em que foi entregue de fato (09/11), com "prog. 10/11".*

![[sessao47-ficha-entrega.png]]
*A ficha: "Entregue no dia 06/11/2026, registrado em 09/11/2026 às 10:32 por …", os comprovantes e (só admin) "Alterar a data da entrega".*

![[sessao47-ficha-alterar-data.png]]
*A janela do admin para corrigir o dia.*

