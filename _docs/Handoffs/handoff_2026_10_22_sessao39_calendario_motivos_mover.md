---
titulo: Handoff — 2026-10-22 · SESSAO-39 (calendário das rotas, painel de motivos, Google Maps/Waze e o botão Mover)
tipo: handoff
data: 2026-10-22
atualizado: 2026-10-22
tags: [handoff, sessao, sessao-39, rotas, calendario, dashboards, motivos, kanban, mover]
---

# 📋 Handoff — SESSAO-39 · Calendário das rotas, painel de motivos, Google Maps/Waze e o botão Mover (21–22/10/2026)

> Demanda: [[SESSAO-39 - Calendario das Rotas Painel de Motivos Google Maps e Mover]]. Diário: [[SESSAO-39]]. Ditada pelo dono na conversa em 21/10 à noite (com o vídeo do calendário do ClickUp); entendimento e dúvidas levados ao dono antes de codar — as respostas estão na demanda. No meio, o dono pediu duas vezes pelo calendário: "melhore esse layout" e, depois, *"está muito redonda e confusa … deixe a possibilidade de ver mais detalhes do pedido caso eu clique"* (feito — seção 2).

## 1. Objetivo da sessão

Os quatro pedidos do dono: (1) o **calendário** da programação como modo de ver dentro de Rotas, no formato do vídeo; (2) um **painel dos motivos** (pausas, não entregas e todos os outros) para achar os maiores problemas; (3) levar a **rota montada ao Google Maps ou ao Waze** — pesquisar se há API gratuita ou se basta um link; (4) o botão **Mover** dentro de todo card de produção, para a fila de qualquer setor, por líder, admin ou super admin.

## 2. O que foi feito (na branch — **nada aplicado no banco, nada publicado**)

**Mover (D-173):** botão na janela do card (peça e card avulso num setor de produção), só para líder de qualquer setor, admin e super admin (no tablet, pede o PIN e só aceita o de líder/admin). A janela escolhe o setor (a fila dele; o próprio setor = "volta para a fila daqui"), o motivo obrigatório (lista nova "Motivos do Mover" em Configurações → Utilitários, 4 motivos iniciais, ou "Outro" escrito) e, quando o setor de onde a peça sai pede, o estado da peça. O tempo de quem trabalhava fecha na hora, quem ajudava sai junto; o motivo fica no histórico do card.

**Google Maps e Waze (D-174):** *existe API do Google para rotas, mas é paga e não é necessária* — o Google tem um **link oficial gratuito, sem chave**, que abre a rota com as paradas **na ordem que a plataforma mandar** (até 9 paradas por link; rota maior abre em partes). O **Waze só aceita um destino por vez**. Ficou assim: "Abrir a rota no Google Maps" na rota de "Já programadas" (da fábrica, na ordem da tela, de volta à fábrica) e na tela do entregador (de onde ele está, as entregas que faltam, de volta à fábrica); em cada entrega, **Google Maps** e **Waze** já navegando até ela. E o entregador passou a ver as paradas **na mesma ordem da logística** (antes, sem ordem salva, ele via pela numeração do pedido). Conferido abrindo o link: o Google montou "Fábrica Domoby → 4 paradas → Fábrica Domoby (57 min)".

**Calendário (D-175):** a terceira aba de Rotas → Programação. Semana de domingo a sábado (como o ClickUp do vídeo) ou mês; cada pedido no seu dia, na cor da situação — **na rota** (azul, o dia da rota), **entregue** (verde), **não entregue** (vermelho, o dia em que voltou), **sem rota** (cinza, o dia da previsão de entrega), **stand-by** (rosa, o dia da previsão). **Desenho refeito a pedido do dono (22/10, 2ª volta — a 1ª ficou "redonda e confusa"):** grade reta como a do ClickUp — sete colunas iguais, linhas finas, o dia numa linha só, o hoje na cor amarela —, **uma barra de uma linha por pedido ("13704 · Pitimbu")** na cor da situação, a legenda em quadradinhos de cor (tocar esconde/mostra). **Tocar no pedido abre o detalhe dele:** a situação, o dia, a previsão, o caminhão, a rota e a parada, o recado e o motivo na hora; embaixo, a mesma ficha do pedido da área Pedidos (cliente com WhatsApp, venda, valor, entrega; e, nos botões, itens e pagamento, produção, entrega e comprovante, dados do Tiny, histórico); com **"Ver a rota"** e **"Abrir a janela do pedido"**. Um aviso conta os sem rota com a previsão vencida e os sem previsão. No celular, os dias viram uma lista e o detalhe sobe de baixo.

**Painel de motivos (D-176):** Dashboards → **Motivos** (só liderança). Números-herói no topo; depois: **por que a produção para** (pausas e paradas por motivo — vezes e o **tempo útil parado**, só no expediente — por setor e por pessoa; o especial marcado), **por que as pessoas saem do setor** (tablet), **por que os cards foram movidos** (Mover — e de onde para onde), **por que o PCP segura pedidos** (stand-by, com o tempo segurado e quantos ainda estão), **por que a entrega não acontece** (não entrega por motivo, caminhão e quem marcou, com "% de N tentativas"; devoluções e entregas desfeitas) e **onde a peça sai com problema** (atenção, danificada, divergência por setor). Tocar num motivo abre cada vez que ele aconteceu (20 por vez).

**Banco — 3 atualizações EM ARQUIVO (esperam o OK do dono; nenhuma toca a integração do Tiny):**
- `20261023010000_plt_mover_para_fila.sql` — o tipo de motivo "mover" + 4 motivos, a regra de quem move e a porta do gesto; salvar motivo aceita o tipo novo.
- `20261023020000_plt_rotas_ordem_e_calendario.sql` — as entregas do dia trazem a ordem salva; a porta do calendário (cada barra com o pedido, para a ficha abrir no toque); índice do "não entregue" pelo dia da rota; **a regra do pedido vivo em duas partes** (`vw_pedidos_vivos_regra` + `vw_pedidos_vivos` recriada com as mesmas colunas — o calendário lê só a regra; as outras telas não mudam).
- `20261023030000_plt_painel_motivos.sql` — as duas portas do painel; o tempo útil de cada pausa guardado quando ela termina (duas colunas novas em `plt_pessoa_pausas` + gatilho), a projeção nova `plt_presenca_saidas` (cada saída do setor com o tempo fora) e **o registro de saída do stand-by nascendo com o tempo útil segurado** (gatilho novo, ao lado da guarda do stand-by); índices.

## 3. Decisões (D-173…D-176) — as provisórias para o dono confirmar

| O quê | Ficou | Confirmar |
|---|---|---|
| Motivos iniciais do Mover | Retrabalho · Foi para o setor errado · Mudança no planejamento · Peça com defeito | ok? (editáveis em Utilitários) |
| Mover com gente trabalhando | o tempo fecha na hora; quem ajudava sai junto | — (dito na conversa) |
| Estado da peça no Mover | só quando o setor de origem pede (a regra do arrasto) | — (dito na conversa) |
| Calendário: "sem rota" e "stand-by" | no dia da **previsão de entrega** do vendedor | ok? |
| Calendário: cores | cinza sem rota · azul na rota · verde entregue · vermelho não entregue · rosa stand-by (o ClickUp tinha terceirizado/retirada/cancelado — não existem aqui) | ok? |
| Calendário: mês | além da semana do vídeo, a visão de mês | ok? |
| Calendário: o toque no pedido | abre o detalhe (o do calendário + a ficha do pedido da área Pedidos), com "Ver a rota" e "Abrir a janela do pedido" | ok? |
| Painel: tempo | o tempo **útil** (só expediente); quem ajudava conta também (horas-pessoa) | ok? |
| Painel: quem vê PCP/rotas | o admin e o líder do PCP/das ROTAS | ok? |

## 4. Bugs

**Achado e corrigido:** sem ordem salva, o entregador via as paradas pela numeração do pedido (diferente da logística) — agora a mesma ordem.
**Na vitrine (antes de publicar):** o botão do Google Maps espremia o cabeçalho do caminhão em "Já programadas" (foi para uma linha própria); o tempo do herói quebrava em duas linhas ("6h40" agora); no calendário refeito, o cabeçalho do dia de hoje quebrava em três linhas numa tela de ~960 px (agora uma linha só, sempre).

## 5. Arquivos alterados

Ver `git log 1c67151..sessao-39-calendario-motivos-mover`. Principais: `src/kanban/{mover.ts, componentes/ModalMoverParaFila.tsx, janela/JanelaDoCard.tsx}`, `src/rotas/{AbaCalendario.tsx, calendario.ts, navegacao.ts, BotoesNavegacao.tsx, AbaJaProgramadas.tsx, rotaRuas.ts, api.ts}`, `src/paginas/{Programacao.tsx, EntregasDoDia.tsx, Utilitarios.tsx, dashboards/Motivos.tsx}`, `src/dashboards/api.ts`, `src/App.tsx`, `src/componentes/Layout.tsx`, `src/navegacao/pedacos.ts`, as 3 migrations (e a do stand-by sem o `validate` dos motivos — E-19), a bateria (+3 blocos).

## 6. Desempenho (checklist da lei)

- [x] **Requisições:** cada tela = 1 (calendário: a semana ou o mês; painel: a tela inteira; Mover: o gesto); o "+N" de um dia, a ficha do pedido no calendário e as ocorrências de um motivo **só no clique**. Google Maps/Waze = links.
- [x] **Sem relógio e sem `postgres_changes`:** nada nas telas tocadas; ao vivo pelos avisos que já existiam (rotas, PCP).
- [x] **Ensaio ×100** (PGlite em disco, 5.000 vivos, 200 mil fatos — teto, não média), antes → depois das correções: painel 30 dias **898 → 43–81 ms**, 90 dias **2,5 s → ~211 ms**; calendário semana **262 → ~155 ms**, mês **340 → ~230 ms**, "+N" **226 → ~25 ms**; detalhe 7–16 ms; entregas do dia 13 ms. Planos pelos índices (pausas e saídas por início, Mover e não entregue por índice parcial). **Fora do teto ×100 → dívidas 24–26 da lei**, com o caminho: as duas funções de situação do Tiny que o banco não consegue embutir (a semana iria a ~87 ms — muda uma trava de segurança: decisão do dono), a Expedição (~610–760 ms ×100, achada aqui, não tocada) e os stand-by ainda abertos no painel de 90 dias.
- [x] **Índices:** toda chave estrangeira nova tem índice (`plt_pessoa_pausas.setor_id`, `plt_presenca_saidas.usuario_id/setor_id`); a tabela nova com RLS ligada e fechada ao navegador.
- [x] **Listas por cursor:** as ocorrências de um motivo (cursor, teto 100); o calendário por dia com teto (30 na semana, 3 no mês, 6 semanas no máximo).
- [x] **Pacote:** JS inicial **222,5 → 222,6 KB** comprimidos (teto 250); Programação 16,9 → 21,6 KB gz, Motivos 4,7 KB gz (novo), a ficha do pedido no calendário 9,1 KB gz (pedaço que já existia, só no 1º toque).
- [x] **Escrita idempotente:** as migrations rodam de novo sem erro (a bateria prova); o Mover é um gesto com motivo (eventos não se apagam).
- [x] **Tablet/celular:** conferido na vitrine (375 px sem rolagem lateral; o detalhe do calendário sobe de baixo; o Mover no tablet pede o PIN).

## 7. Notas do cofre atualizadas

[[PLT - Decisoes de Produto]] (D-173…D-176; ↩️ D-59) · [[PLT - Memoria de Aprendizado]] (E-144…E-148, A-102…A-105) · [[SUPA - Esquema do Banco]] · [[PLT - Modelo de Sistema]] · [[PLT - Lei de Desempenho e Escala]] (andamento da 39 e dívidas 24–26) · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · diário [[SESSAO-39]].

## 8. Como testar (roteiro do dono — depois de aplicar e publicar; em https://sistema-domoby.vercel.app, logado)

> Gestos que gravam e como desfazer estão ao lado.

1. **Calendário** — Fábrica → Rotas → Programação → aba **Calendário**: a semana atual, de domingo a sábado, uma barra por pedido ("número · bairro") na cor da situação. Toque em "Mês" e volte para "Semana"; use ‹ › e "Hoje". Toque em "Entregue" na legenda: os entregues somem (toque de novo para voltar). **Toque num pedido:** abre o detalhe — a situação, o dia, o caminhão e a rota em cima; o cliente, a venda, o valor e a entrega embaixo; toque em "Itens e pagamento" ou "Histórico" para ver mais. Num pedido azul (na rota), **"Ver a rota"** abre a rota em "Já programadas"; em qualquer um, **"Abrir a janela do pedido"** abre a janela do card. *(Só olhar — nada grava.)*
2. **Google Maps (logística)** — Programação → Já programadas → escolha uma rota → **"Abrir a rota no Google Maps"**: o Google abre da fábrica, pelas paradas na ordem da tela, de volta à fábrica.
3. **Google Maps e Waze (entregador)** — Rotas → Entregas → aba Entregas do dia (ou o celular do entregador): a numeração das paradas é a mesma de "Já programadas"; "Abrir a rota no Google Maps" sai de onde o celular está; em cada entrega, **Google Maps** e **Waze** já navegando até ela. *(Conferir no celular do entregador: com o aplicativo do Google Maps, até 9 paradas por link.)*
4. **Mover** — abra um card de teste num setor de produção (a janela do card) → **Mover** → escolha o setor (a fila dele), um motivo e Mover. O card aparece na fila do setor; no histórico do card fica o motivo. **Desfazer:** Mover de volta para a fila do setor de antes (é outro gesto, com motivo — eventos não se apagam). Como operador comum, o botão não aparece. No tablet: Mover pede o PIN — com o PIN de um operador comum, recusa.
5. **Motivos do Mover** — Configurações → Utilitários → aba **Motivos do Mover**: os 4 iniciais; dá para criar, editar e desligar.
6. **Painel de motivos** — Dashboards → **Motivos**: os números no topo, os rankings de cada área; troque o período (Hoje/7/30/90 dias); escolha um setor; toque num motivo para ver cada vez que aconteceu. *(Com a plataforma recém-limpa, os números ainda são poucos — o painel ganha corpo com o uso.)*

## 9. Ficou pendente

- **O OK do dono** para aplicar as 3 atualizações do banco e publicar o site (um gesto só — E-73).
- Confirmar as provisórias (seção 3).
- Conferir o link do Google Maps no celular de um entregador (o limite de paradas depende do aplicativo).
- As dívidas 24–26 da lei (só aparecem com ~100 vezes o volume de hoje); a 24 pede a decisão do dono sobre a trava de segurança de duas funções internas.
- ClickUp: as 4 tarefas em FAZENDO com o comentário de entrega — quem conclui é o dono.
