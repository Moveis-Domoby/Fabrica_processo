---
titulo: Handoff — SESSAO-45 · rotas no mapa certo, liberar peça na Expedição e o PCP honesto
tipo: handoff
data: 2026-11-04
tags: [handoff, sessao-45, rotas, google-maps, mapa, expedicao, pcp, estoque]
---

# 📋 Handoff — SESSAO-45 · Rotas no mapa certo, liberar peça na Expedição e o PCP honesto (04/11/2026)

Demanda: [[SESSAO-45 - Rotas no Mapa Certo Liberar Peca na Expedicao e PCP Honesto]] · Diário: `_docs/Plataforma/Execucao/SESSAO-45.md`

## 1. Objetivo

Os cinco pontos que o dono mandou na noite de 04/11: o Google Maps abrindo endereço errado, "endereço não encontrado no mapa", o layout quebrado de "Já programadas", o botão da Expedição para liberar a peça pronta para outro pedido, e o PCP "mentindo" sobre o estoque (vídeo do 13811). Tudo no ar e conferido na tela.

## 2. O que foi feito (tudo NO AR em 04/11 ~21:00 de Natal)

| Ponto | A causa | O que mudou |
|---|---|---|
| **Google Maps errado** (13784 e outros) | Ia o PONTO da busca gratuita (o meio da rua, às vezes a rua de mesmo nome noutro bairro) e o Google mostrava o endereço mais perto dele — no 13784, a esquina do Hospital Onofre Lopes | Google Maps e Waze (rota, parada e tela do entregador) vão pelo **endereço escrito com o CEP**; o ponto só manda quando alguém o marcou (ou o pino da parada avulsa). Conferido: o link do 13784 abre "R. Des. Lins Bahia, 173 - Rocas" (D-217) |
| **"Endereço não encontrado"** (13793 e outros) | A busca pegava o 1º resultado e só conferia a cidade (lida na posição errada sem bairro); em São José de Mipibu o mapa chama o lugar de "Taborda". Auditoria do cache: 29 de 151 pontos a mais de 1 km do lugar | Busca nova (vários candidatos pontuados por rua, bairro, CEP e cidade; dúvida = "não achei", nunca ponto errado). **"Marcar no mapa"** / **"Acertar o ponto no mapa"** no cartão do pedido — o ponto marcado à mão vale para todo pedido do mesmo endereço e nunca é trocado. Os pontos antigos são refeitos uma vez. O 13793 ganhou o ponto às 23:56 UTC (D-218) |
| **Layout de "Já programadas"** | Os botões ficavam ao lado do cartão e o espremiam até uma palavra por linha | O cartão ocupa a largura toda; Detalhe / Reprogramar / Tirar numa linha própria, embaixo (também na parada avulsa). Conferido em 1600 px e no celular (375 px, sem rolagem lateral) |
| **Liberar peça na Expedição** | (pedido novo) | Botão **"Liberar para outro pedido"** no cartão da Expedição com as perguntas do dono. O pedido de origem volta ao PCP (ou ao stand-by, com "Não por enquanto"); o destino ganha a peça **pronta** na vaga que esperava o mesmo móvel no PCP; o PCP é avisado; nada vai ao Tiny (D-219) |
| **PCP "mentindo"** (13811) | As duas telas usavam "estoque" para peças diferentes: o PCP contava as 2 reservadas para o pedido; o Estoque mostrava "0" (só as livres). E o chip do PCP somava toda peça livre do SKU em todo pedido, sem limite | O chip do PCP conta só o que o pedido ainda precisa e diz "N reservada(s) + M livre(s) no estoque"; o cartão do Estoque, com peça reservada no galpão, diz "livres no estoque" e "+ N no estoque reservadas para venda (pedido X)" (D-220) |

Arquivos: migration `supabase/migrations/20261105010000_plt_rotas_mapa_expedicao_pcp.sql` (e a 20261027080000 reaplicável); função `supabase/functions/geocodificar/` (`index.ts`, `busca.ts` novo); telas `src/rotas/navegacao.ts`, `CartaoPedido.tsx`, `ModalPontoNoMapa.tsx` (novo), `AbaJaProgramadas.tsx`, `AbaProgramar.tsx`, `paradasAvulsas.ts`, `api.ts`; `src/logistica/componentes/ModalLiberarPeca.tsx` (novo), `CartaoProdutoEstoque.tsx`, `ModalProdutoEstoque.tsx`, `src/logistica/api.ts`, `src/paginas/Expedicao.tsx`, `src/paginas/PCP.tsx`, `src/kanban/tipos.ts`; testes `src/rotas/buscaEndereco.test.ts`, `navegacao.test.ts`, `src/logistica/componentes/CartaoProdutoEstoque.test.tsx`, bateria (bloco SESSAO-45). **n8n: nada muda.**

### 2b. Ajuste do dono (05/11, madrugada) — D-221

*"A rota precisa do endereço exato do cliente, não do ponto marcado; o ponto pode servir para ajuste caso necessário, mas não pode acontecer o caso de endereço não encontrado."*

| O quê | Como ficou |
|---|---|
| **Google Maps / Waze** | Vão **sempre pelo endereço escrito** do cliente (com CEP) — nem o ponto marcado à mão nem o pino da parada avulsa mandam mais. O ponto só vai quando não existe rua escrita. A aba "Programar" passou a mandar o CEP também. |
| **O ponto da plataforma** | Serve ao **mapa da rota** (onde a parada aparece, a ordem sugerida, a distância) — "Acertar o ponto no mapa" segue para ajustar. |
| **Nunca mais "não encontrado"** | A busca desce em degraus: a rua → **o ponto do CEP** → **o centro do bairro** → **o centro da cidade**; o ponto do CEP/bairro antes acha a rua de mesmo nome que fica perto dele (o ambíguo de antes vira ponto de rua). O cartão diz **"Ponto aproximado no mapa (pelo CEP / pelo bairro / pelo centro da cidade) · acertar"**. O aproximado é procurado de novo depois de 7 dias. |
| **O raro sem ponto** | Só endereço sem rua e sem cidade (pedido sem endereço no Tiny): "Endereço incompleto no cadastro (sem rua e sem cidade) — complete no Tiny". |

> ↪️ **Correção do dono (05/11, manhã):** *"não tem essa de bairro e centro da cidade, NO MÁXIMO a rua é aceitável, mas deve ter um aviso na tela"*. O ponto agora é **de rua** (o CEP e o bairro só ajudam a achar a rua de mesmo nome perto deles; o CEP da própria rua vale como rua) ou é **o da cidade com o aviso em destaque "Endereço aproximado para a cidade da entrega, ajustar o pino do mapa"** e o botão **"Ajustar o pino"**. Nada de centro do bairro. Função v12, site na main; conferido na tela publicada (nenhum "não encontrado"; o Google Maps leva o 13798 pelo endereço escrito) e o aviso provado por teste de tela.

Simulação (1ª versão) contra os 172 endereços do cache: **160 de rua, 10 pelo bairro, 1 pelo centro da cidade, 1 sem ponto** — o sem ponto é o "endereço" que só tem o estado (37 pedidos sem endereço no Tiny, todos já entregues ou cancelados; nenhum na Programação). Banco: migration `20261105020000` (as duas listas da Programação devolvem o aproximado; nenhuma tabela/coluna — o degrau mora na fonte do ponto). Função `geocodificar` v11. Site na main.

## 3. Como testar (roteiro do dono)

1. **Google Maps:** Rotas → Programação → Já programadas → escolha uma rota → "Abrir a rota no Google Maps". Cada parada aparece no Google com o endereço do cliente (rua, número, bairro, CEP), não um ponto solto. No celular do entregador (Entregas do dia), o mesmo nos botões Google Maps e Waze de cada parada.
2. **Ponto no mapa** *(↪️ ajuste e correção de 05/11)*: não existe mais "Endereço não encontrado no mapa". O pedido cuja rua o mapa não acha aparece com o aviso **"Endereço aproximado para a cidade da entrega, ajustar o pino do mapa"** e o botão **"Ajustar o pino"** — o Google Maps segue pelo endereço; o botão abre a janela para arrastar o pino até a casa (só para o mapa da rota). "Voltar à busca automática" desfaz o ponto marcado à mão. *(O 13798 — Estrada RN 313, Pium — já tem o ponto marcado à mão pelo dono.)*
3. **Layout:** a mesma lista com os dois menus abertos: o cartão do pedido em linhas normais e os botões embaixo.
4. **Liberar peça:** Logística → Expedição → um pedido pronto → **"Liberar para outro pedido"** → escolha a peça → "Sim" → digite o número do pedido que vai receber (a janela diz na hora se dá e por quê) → "Sim, produzir de novo" → Confirmar. Confira: o pedido de destino com a peça pronta na Expedição; o de origem de volta no PCP com o móvel para liberar; o aviso no sino do PCP. Com "Não" → escreva o motivo (ex.: foi para a vitrine). Com "Não por enquanto" → o pedido vai para o stand-by do PCP.
5. **PCP × Estoque:** quando uma venda reservar peça do estoque, o chip do pedido no PCP diz "N reservada(s) no estoque" e o cartão do mesmo móvel no Estoque diz "livres no estoque" e "+ N no estoque reservadas para venda (pedido …)".

## 4. Verificação

- **Bateria do banco:** 1.471 verdes; 1 vermelho já antigo (painel de vendas, falha na `main` sem esta sessão). Bloco SESSAO-45: 13 verdes (conferência e recusas, o gesto completo e repetido, a janela do PCP depois, a substituição com stand-by, o programado recusado, o ponto manual com registro e desmarcar, a conta do PCP limitada, as permissões).
- **Front:** tipos e lint limpos, 385 testes verdes, o site compila. **Busca:** simulada contra os 172 endereços do cache — 4 que não eram achados passam a ser, 6 que tinham ponto errado passam a "não achei".
- **Banco real:** aplicada pelo aplicador (só esta migration), integração do Tiny idêntica; a conta nova do PCP 3,6 ms para o quadro inteiro; advisors só com os 3 avisos esperados das portas novas.
- **Tela publicada** (navegador do app, logado pelo dono): "Já programadas" em tela larga e no celular; link do Google Maps com o endereço; a janela do mapa (aberta e cancelada); a janela da Expedição (recusou o 13649 — cancelado no Tiny — e aceitou o 13652; cancelada sem confirmar); o chip do PCP; Entregas do dia com os links por endereço.
- **Rastro:** nada gravado em pedido, peça ou ponto de verdade; os 10 registros de navegação do teste e a busca de teste do mapa foram apagados (trava dos registros religada).

## 5. Desempenho (Lei — checklist)

- [x] **Requisições:** nenhuma tela ganhou requisição na abertura. A janela do mapa e a da Expedição só leem no clique (a da Expedição: as unidades do pedido + a conferência quando o número é digitado, com espera de 350 ms).
- [x] **Sem polling, sem `postgres_changes`, sem relógio:** a busca refeita dos pontos antigos acontece quando a tela da Programação é aberta (já era assim — 5 endereços por chamada); as telas releem pelo aviso da área.
- [x] **Porta tocada:** o quadro do PCP com a conta nova — 3,6 ms no banco real (13 cards), custo por card por índice (pedido, código, setor do estoque), não cresce com o estoque inteiro.
- [x] **Escrita idempotente:** "Liberar para outro pedido" pela chave do toque; marcar o ponto é um "upsert".
- [x] **Chamada externa:** a busca com tempo limite de 10 s por consulta e o Nominatim que recusa fica 1 h sem ser chamado.
- [ ] **×100 com volume semeado:** não feito (as portas novas custam por pedido/peça).

## 6. Pendências que precisam do dono

1. **Confirmar as decisões provisórias** D-217 a D-220 — em especial o que "Não por enquanto" faz (o pedido volta ao PCP em stand-by) e que o destino precisa estar esperando o móvel no PCP.
2. ~~Marcar no mapa os pedidos "não encontrado"~~ — ↪️ não precisa mais (ajuste de 05/11): todo pedido tem ponto (de rua ou aproximado); acertar à mão só se quiser o mapa da rota mais exato.
3. **ClickUp:** nenhuma tarefa criada (o pedido veio direto na conversa).
4. Da sessão anterior (seguem com o dono): o acerto do 13787, as 6 tarefas do ClickUp, conferir os pedidos 13620, 13689 e 13699.

## 7. Numeração usada

Migration `20261105010000`; decisões D-217…D-220; aprendizados E-178…E-179, A-137…A-140. ↪️ Ajuste de 05/11: migration `20261105020000`, D-221 (do dono), E-180, A-141…A-142. Seguinte: **D-222 / E-181 / A-143**.
