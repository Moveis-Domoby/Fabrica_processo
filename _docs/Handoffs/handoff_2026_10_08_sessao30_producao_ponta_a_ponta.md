---
titulo: Handoff — 2026-10-08 · SESSAO-30 · Produção de ponta a ponta (pedido, reabastecimento e entrega)
tipo: handoff
data: 2026-10-08
atualizado: 2026-10-08
tags: [handoff, sessao, sessao-30, bloco-6, producao, estoque, rotas, entrega, tiny, desempenho]
---

# 📋 Handoff — 08/10/2026 · SESSAO-30 · Produção de ponta a ponta

> [!success] Entregue — as 6 etapas no ar
> Tudo aplicado no banco e publicado no site ao fim de cada etapa testada (ordem do dono de seguir sem perguntar). **Falta só o que é do dono:** importar o fluxo novo do n8n, ligar "Entregue vai ao Tiny" e fazer a prova com 1 pedido real (passo a passo no fim). Memória técnica completa: [[SESSAO-30]] (`Plataforma/Execucao/SESSAO-30.md`).

**Branch:** `sessao-30-producao-ponta-a-ponta` (nasceu da `main` 16e03e5; cada etapa foi à `main` por avanço direto). **Demanda:** [[SESSAO-30 - Producao de Ponta a Ponta - Pedido Reabastecimento e Entrega]]. **Plano:** [[004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo]]. **Banco:** migrations 56 a 63 (integração do Tiny idêntica em todas). **Bateria do banco:** 770 → **848 verificações, tudo verde**; testes da tela 146 → **152**.

## 1. Objetivo da sessão

Fechar o caminho da peça de ponta a ponta — do pedido do Tiny até a entrega, e da reposição até o estoque —, provar com um ensaio completo e corrigir os furos: a reserva em venda que sumia quando o pedido ia para ROTAS, o "Entregue" que não conversava com o Tiny, as correções 1–6 do raio-x e a tela do entregador. Tudo dentro da [[PLT - Lei de Desempenho e Escala]] nas telas tocadas.

**Respostas do dono (08/10)** — viraram D-113…D-118:
1. *"Se está entregue no Tiny, aqui deve estar como entregue também … não deve mais estar nada referente a ele em aberto aqui."* (fecha TUDO — D-113)
2. Cancelado ou devolvido com o móvel pronto vai sozinho ao estoque, sem confirmação (D-114); devolução no Tiny = marcador "Devolvido"; "Pedido devolvido" pelo entregador não mexe no Tiny.
3. Entregador: usuário só de ROTAS, vê só as entregas do dia; quem programa escolhe um ou mais usuários por caminhão; mini mapa; botões Comentário · Entregue · Não entregue · Pedido devolvido · WhatsApp · Mapa · produtos; card com VOLUMES e o detalhe da entrega; comprovante opcional (PDF, Word, imagem) e anexar também fora da entrega (D-115).
4. Comprovante não é obrigatório.
5. Não entregue com motivo de uma lista cadastrável em Configurações → Utilitários (D-116).
6. O entregador desfaz (só no dia, com motivo) e o Tiny volta junto (D-113).
7. Arquivar a 502; PCP sem pedido entregue no Tiny aberto; seletor de situação (Concluído · Em rota · Entregue) e arquivar em massa — só super admin, o Tiny não muda (D-117).
8. *"Não vamos desligar por enquanto, coloque um fluxo bifurcado"* — Tiny → plataforma; ClickUp → Tiny → plataforma; plataforma → Tiny; o ClickUp só avisa (D-113).

**Ordem do dono (08/10, ~01:40):** *"siga para todas as outras etapas da sessão 30 sem me perguntar mais, vou dormir, fique trabalhando"*; a SESSAO-31 será feita por outra sessão do Claude Code.

## 2. O que foi feito — por etapa

### Etapa 1 — zerar a plataforma ✅
- **Pedido "Entregue" no Tiny fecha tudo aqui** (aviso de venda ou conferência das 3h — inclusive o que a equipe marca no ClickUp, que vai ao Tiny): a entrega é registrada uma vez ("Sistema"), cada peça viva sai de toda conta (o tempo de quem trabalhava fecha antes), a peça do estoque reservada pela venda sai com o pedido, e o card do pedido que nunca foi às ROTAS sai do PCP.
- **PCP do super admin:** "Selecionar pedidos" → caixinha em cada pedido → "Mudar a situação para" Concluído · Em rota · Entregue, ou Arquivar; confirmação antes; uma linha na Auditoria; o Tiny não muda.
- **"Todos os pedidos" por cursor:** de 3,2 s para ~11 ms no banco; a busca espera parar de digitar.
- **Limpeza:** 287 pedidos entregues no Tiny fechados (264 saíram do PCP, 23 nas ROTAS — inclui os 18 da carga de teste da S28 e 13108/13114), 13 peças fora das contas, peça 502 arquivada; 0 avisos, nada ao Tiny.
- Migration 56; site c040a3a.

### Etapa 2 — estoque ✅
- **Reservado em venda até a ENTREGA** (D-118), inclusive na ROTAS e no caminhão.
- **Os números do estoque ficam prontos no banco** (D-119): lista do Top X ~0,7 s → ~0,02 s; resumo ~0,9 s → ~0,01 s; o ranking das vendas anda de madrugada e quando Top X/cobertura/corte mudam.
- **Resumo = soma dos cartões** (raio-x 5); **raio-x 1** (fins de linha para toda origem), **2** (peça livre do ESTOQUE só sai pela baixa), **6** ("Peças sob medida e fora do catálogo" com baixa).
- Migration 57; site 1330762.

### Etapa 3 — PCP numa chamada ✅
- **Liberar é uma chamada só, tudo ou nada** (tocar duas vezes não duplica); a janela abre com uma requisição; a sugestão do estoque ~90 → ~5 ms.
- **Raio-x 3:** o PCP libera só para setor de produção (toda origem); a peça pronta do estoque vai pela sugestão "usar?". **Raio-x 4:** "Veio da entrada manual da logística".
- Migration 58; site 314280f.

### Etapa 4 — entregue nos dois lados ✅ (a chave do Tiny desligada até a prova)
- **"Entregue" na plataforma fecha tudo**, como quando o Tiny avisa.
- **Plataforma → Tiny pela fila do banco** (chama o n8n na hora; nova tentativa crescente; pausa se o Tiny cair; 8 falhas = parado e aviso ao super admin). Chave **"Entregue vai ao Tiny"** em Configurações → Caminhões — **DESLIGADA**. O fluxo novo do n8n ficou como arquivo importável sem segredo (a chave de acesso do n8n que o Claude tem só lê).
- **Desfazer** (só a entrega de hoje feita por gente, com motivo; os móveis voltam e o Tiny volta), **Não entregue** (com motivo; volta para Programar), **Pedido devolvido** (móveis ao ESTOQUE; Tiny não muda); marcador **"Devolvido"** do Tiny = cancelamento; **cancelado com móvel na ROTAS** vai sozinho ao ESTOQUE.
- **Motivos:** Configurações → Utilitários → "Motivos da entrega" (13 frases).
- Migration 59; site 1fb72dd.

### Etapa 5 — o entregador ✅
- Papel **"Entregador (só ROTAS)"** na Gestão da equipe (ou o botão "Entregador"): ele vê só **"Entregas do dia"**.
- **Equipe** do caminhão por dia e **Detalhe** da entrega em "Já programadas".
- **"Entregas do dia"** (celular primeiro): mini mapa, paradas na ordem, cliente, pedido, **volumes** do Tiny, endereço, OBS, detalhe, produtos, comentários; WhatsApp · Mapa · Comentário · Comprovante · **Entregue** (painel em cima com comprovante e observação) · Não entregue · Pedido devolvido · Desfazer. Uma requisição (~5 ms).
- **Comprovante** em armário privado (foto, PDF, Word até 10 MB; foto reduzida no celular).
- Migration 60; site eec05f6.

### Etapa 6 — ao vivo, ensaio completo, lei ✅
- **Sem relógio nas telas tocadas:** Estoque, PCP, Pedidos em aguardo, ROTAS, Programação e Entregas do dia ficam **ao vivo por websocket** — o banco avisa "mudou" num canal privado da área, só para quem pode ver, e a tela relê só o que mostra (provado: um aviso → as 3 consultas do Estoque, nenhuma outra). O PCP passou a pedir só a aba aberta.
- **Ensaio de ponta a ponta no banco real** (transação desfeita — nada gravado, nada ao Tiny): **12 de 12 passos** com os números certos (tabela abaixo) + o mesmo roteiro como **bloco permanente da bateria**.
- Checklist da lei: alertas do Supabase sem item de tipo novo (a chave sem índice da equipe foi corrigida — migration 62); dívidas 13–15 registradas na lei.
- Migrations 61 e 62; site 8eeba55.

## 3. O ensaio de ponta a ponta (banco real, 08/10, transação desfeita)

A = "327 · Armário multiuso 2 portas" (tinha 1 peça livre); B = "174 · Estante Basic 4 nichos" (sem peça). Números: **em estoque / reservados em venda / reservados para produção**.

| Passo | A | B | ✔ |
|---|---|---|---|
| 0 · antes | 1/3/0 | 0/2/0 | ✔ |
| 1 · o pedido chega; a venda reserva a peça de A | 0/4/0 | 0/2/0 | ✔ |
| 2 · liberação numa chamada (A do estoque, B para a SECC) | 0/4/0 | 0/2/1 | ✔ |
| 3 · B pela produção até a LIMPEZA E EMBALAGEM | 0/4/0 | 0/2/1 | ✔ |
| 4 · concluir produção de B (aguardo) | 0/4/0 | 0/3/0 | ✔ |
| 5 · lançar para ROTAS (reservado não muda) | 0/4/0 | 0/3/0 | ✔ |
| 6 · programado; aparece em "Entregas do dia" com o detalhe (2 volumes) | 0/4/0 | 0/3/0 | ✔ |
| 7 · entregue: fecha tudo; Tiny "entregue" na fila; 1 chamada ao n8n pronta | 0/3/0 | 0/2/0 | ✔ |
| 8 · o Tiny ficou "Entregue": fecha sozinha (Sistema), uma vez, sem eco | 0/3/0 | 0/2/0 | ✔ |
| 9 · reabastecimento de B: 2 no PCP → produção → ESTOQUE (+2 ajustes do Tiny na fila) | 0/3/0 | 2/2/0 | ✔ |
| 10 · cancelamento: pronta → ESTOQUE; em produção segue e vai ao ESTOQUE ao concluir; na ROTAS → ESTOQUE | 0/3/0 | 5/2/0 | ✔ |
| 11 · reposição parada no PCP vence e sai sozinha | — | — | ✔ |
| 12 · a recontagem completa não acha diferença | — | — | ✔ |

## 4. Decisões tomadas

- **Do dono:** D-113 (entregue dos dois lados; fecha tudo) · D-114 (cancelado/devolvido ao estoque) · D-115 (entregador) · D-116 (motivos) · D-117 (PCP do super admin) · D-118 (reservados em venda até a entrega, ↩️ D-86).
- **Do Claude, sob a ordem de seguir (o dono pode revisar):** **D-119** (números do estoque prontos; ranking de madrugada) · **↩️ D-63** (o PCP libera só para produção — a cadeira de estoque vai pela sugestão "usar?") · **↩️ D-113** (o caminho plataforma → Tiny é um fluxo próprio no n8n, não um ramo do fluxo do ClickUp) · o entregador é um **módulo** ("entregas") e não um papel novo — para não mexer na função de login em produção.

## 5. Bugs e aprendizados

- **E-86** (Cowork): a página de próximos passos desfazia o registro de 02–03/10 — mesclada no 1º commit.
- **E-87 / E-88:** nome de coluna na conferência; script da limpeza rodado 2× (a 2ª não gravou nada).
- **E-89:** o "Desfazer" aparecia para as entregas do Sistema (a limpeza de hoje) — pego no preview antes de publicar; trava também no banco.
- **A-57** (refazer o retrato antes de perguntar) · **A-58** (a chave do n8n só lê → fluxo como arquivo importável, token por variável do n8n).
- A 1ª aplicação da migration 61 estourou o tempo de espera por trava (o banco em uso); a 2ª passou (aplicador idempotente, em transação).

## 6. Como validar (o dono)

1. **PCP → Todos os pedidos:** abre rápido; "Na plataforma: …" em cada linha. **Selecionar pedidos** → situação/arquivar (só super admin).
2. **PCP → Liberar unidades:** o destino só oferece setores de produção; a peça reservada pela venda vem marcada; "Liberar" faz tudo de uma vez.
3. **Logística → Estoque:** "N reservados em venda" continua igual depois de lançar para ROTAS e cai depois de entregue; "Peças sob medida e fora do catálogo".
4. **Configurações → Utilitários → Motivos da entrega** (cadastrar, desligar).
5. **Configurações → Gestão da equipe → Novo usuário → "Entregador (só ROTAS)"** → entrar com ele: só "Entregas do dia".
6. **ROTAS → Programação → Já programadas → Equipe** (marcar o entregador no caminhão do dia) e **Detalhe** no pedido → o entregador vê o caminhão, o mapa e o detalhe.
7. **ROTAS → Entregas:** "Não entregue" (motivo → volta para Programar), "Pedido devolvido" (móveis ao estoque), "Entregue" — e o pedido **some** da ROTAS (D-120). "Desfazer" no mesmo dia: em **Entregas do dia → Entregues hoje** ou na **janela do pedido no PCP**.
9. **PCP → Todos os pedidos → clicar num pedido entregue (ex.: 13470):** a janela completa — entrega, cliente e endereço, pagamento e parcelas, valores, datas, observações, itens, peças e histórico (D-120).
8. **Ao vivo:** com duas abas abertas, marcar algo numa — a outra atualiza sozinha em ~1 s.

## 7. Ficou com o dono

- **Pôr o "Entregue vai ao Tiny" no ar (passo a passo em [[N8N - Plataforma para Tiny (situacao do pedido)]]):** n8n → Import from file → `_docs/Fabrica n8n/domoby-plataforma-tiny-situacao.json` → Publish; Configurações → Caminhões → **Ligar**; registrar a entrega de **1 pedido real** já entregue de verdade e ver o Tiny ficar "Entregue". ⚠️ O fluxo usa o token da conta da **fábrica** (`TINY_FABRICA_TOKEN`); se o 1º teste disser "pedido não encontrado", a conta está trocada.
- **Confirmar:** a cadeira de estoque pelo PCP agora vai pela sugestão "usar?" (↩️ D-63); o ranking das vendas de madrugada (D-119); o marcador "Devolvido" num pedido **já entregue** não traz os móveis de volta ao estoque sozinho (só os vivos) — se quiser que traga, é uma decisão nova.
- **ClickUp:** desligar o fluxo antigo quando a equipe passar a dar a entrega pela plataforma.

## 8. Pendências técnicas (registradas)

- Lei: dívida 13 (portas do estoque O(catálogo)), 15 (porta de abertura do Estoque e do PCP), 4 (o entregador ainda baixa a casca inteira) — **SESSAO-32**. A dívida 14 foi paga pela D-120.
- A SESSAO-31 usa a base de anexos (`plt_anexos` + armário privado) e os comentários (`comentario_adicionado`) desta sessão na janela do card.

## 9. Ajuste do dono (08/10, noite) — o entregue mora no PCP (D-120)

> *"Os pedidos entregues devem sumir das rotas também e moram apenas em PCP com TODAS as informações daquele pedido caso eu clique nele, observações, situação de pagamento e tudo mais."*

- **Banco (migration 63, aplicada; integração idêntica; bloco 63 no ensaio → 848 verdes):** a porta da janela completa do pedido (`plt_fn_pcp_pedido_detalhe`) — tudo numa requisição, só no clique, gate da logística.
- **Tela (publicada, Vercel ✔):** ROTAS → Entregas só com o que falta entregar (saiu a escolha "Entregues"); Já programadas idem; Entregas do dia tira o entregue da lista e do mapa e guarda numa linha recolhida "Entregues hoje / neste dia" (para desfazer); PCP → Todos os pedidos → clique abre a janela nova (`PedidoCompleto`) com o desfazer do mesmo dia para entrega feita por gente.
- **Conferido no preview com o pedido 13470 (entregue):** situação nos dois lados e marcadores, a entrega (Sistema, observação da limpeza), cliente/endereço/CEP/telefone/e-mail/CPF, programação (06/10, caminhão, parada), pagamento (forma, meio, parcela), valores, datas, vendedor, envio, observação "cliente irá pagar na entrega", item com valor e o histórico; no celular a janela cabe sem rolagem lateral; console sem erro. ROTAS e Já programadas vazias (tudo entregue hoje); Entregas do dia de 06/10: "4 de 4 entregues", lista recolhida com os 4.
- **⚠️ Situação de pagamento:** o Tiny manda no pedido a forma, o meio e as parcelas; o **"pago / em aberto"** só vem pelas contas a receber copiadas do Tiny — e essa cópia **parou em 09/09/2026**. A janela avisa isso quando não há conta copiada. Voltar a copiar é uma frente separada — **decisão do dono**.
- A dívida 14 da lei (histórico de entregues na ROTAS por deslocamento) ficou paga: o histórico mora em "Todos os pedidos", que anda por cursor.
