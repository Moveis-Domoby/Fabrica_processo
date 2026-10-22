---
titulo: SESSAO-39 — Calendário das rotas, painel de motivos, Google Maps/Waze e o botão Mover
tipo: demanda
status: 🔨 em execução
data: 2026-10-21
atualizado: 2026-10-21
tags: [plataforma, demandas, rotas, dashboards, kanban, motivos]
---

# SESSAO-39 — Calendário das rotas, painel de motivos, Google Maps/Waze e o botão Mover (21/10/2026)

> Ditada pelo dono na conversa em 21/10/2026 (noite), com um vídeo de referência para o calendário. O Claude levou ao dono o entendimento e as dúvidas antes de codar (regra do ciclo); as respostas estão abaixo.

## O pedido do dono (texto fiel)

> * Para as rotas, coloque uma visualização de calendario para visualizar a programação, analise o video para entender o formato e coloque como um modo de visualização dentro de rotas
> * Em dashboards, crie uma dash para medir as questões da fabrica e rotas, motivos de nao entregas, motivos de pausa e todos os motivos dessa forma, é uma medição para metrificar quais sao os maiores problemas em cada um desses pontos
> * Em rotas, precisamos tambem levar a rota ja montada para o google maps ou para o waze, analise seé possivel encontrar uma api gratuita ou se é possivel apenas olocar um botao com link de redirecionamento com rota montada exatamente como foi feito na plataforma
> * Dentro de todos os cards de produção, coloque a possibilidade de dentro dele ter um botao de mover, esse mover pode ser movido para a FILA de qualquer setor a qualquer momento por um lider, admin ou super admin

## O vídeo de referência (calendário)

`Downloads/WhatsApp Video 2026-10-21 at 15.42.09.mp4` (1 min, celular filmando o monitor): é o **calendário da lista ROTAS do ClickUp** (DPTO LOGÍSTICA), visão **Semana** (domingo → sábado), com "Hoje", setas ‹ › e o título "outubro 18 - outubro 24". Cada dia é uma coluna com uma **barra por pedido**: `nº do pedido - bairro - data` (às vezes com recado: "ENTRE 13:30 AS 17:00", "A TARDE"). A **cor da barra é a situação** da tarefa no ClickUp (conferido na lista, só leitura): cinza = a fazer · azul = 1ª/2ª/3ª rota · amarelo = rota terceirizada · verde = entregue · vermelho = cancelado · rosa = parado · roxo = retirada.

## As respostas do dono (21/10, na conversa)

1. **Mover — quem:** líder de **qualquer** setor (não só do setor que lidera), admin e super admin movem qualquer card de produção.
2. **Mover — motivo:** **obrigatório**, de uma lista própria em Configurações → Utilitários (+ "Outro" escrito); entra no painel de motivos.
3. **Painel de motivos — o que entra:** Produção (pausas, paradas e saídas do setor), PCP (stand-by), Rotas (não entrega, devolução, entrega desfeita) e Qualidade (peças marcadas com atenção ou danificadas).
4. **ClickUp:** o Claude cria as tarefas (feito).

## O que o Claude levou ao dono e ficou valendo (sem objeção)

- Google Maps: um link oficial (sem chave, sem custo) com a rota na ordem da plataforma — sai da fábrica, passa pelas paradas e volta; até 9 paradas por link (3 no navegador do celular) → rota maior abre em partes. Waze: um destino por link (a documentação diz que várias paradas dá erro) → botão por parada. Botões na rota de "Já programadas" e na tela do entregador. Junto: o entregador vê as paradas na MESMA ordem da logística (hoje, sem ordem salva, ele vê pelo número do pedido).
- Mover com alguém trabalhando: o tempo fecha na hora (como no arrasto) e quem ajudava sai junto. A marcação do estado da peça segue a regra do arrasto. No tablet, o Mover pede o PIN e só aceita o de líder ou admin.
- O painel de motivos segue a regra dos painéis: líder vê os setores que lidera, admin vê tudo.
- Tudo dentro da lei de desempenho; mudanças no banco prontas em arquivo e aplicadas só com o OK do dono.

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)

Calendário da programação (17tya50jxfq) · Painel de motivos (17tya50jxfr) · Google Maps e Waze (17tya50jxft) · Botão Mover (17tya50jxfu).

## Numeração reservada

D-173…D-185 · E-144…E-155 · A-102…A-110 · migrations `20261023xxxxxx` · faixa de ids de teste da bateria `...3901–3949`.

## Fora do escopo

Arrastar pedido de um dia para outro no calendário (o vídeo não mostra); rota terceirizada e retirada (a plataforma não tem esses conceitos); otimização automática de rota; serviço pago do Google. Nada no n8n, nada no Tiny.

## Critérios de aceite

- [ ] Rotas → Programação ganha o modo **Calendário** (semana, como o vídeo; e mês), com cada pedido no seu dia, na cor da situação, e um clique leva à rota.
- [ ] Dashboards ganha o **painel de motivos** com as quatro áreas, por período, do maior problema para o menor, com detalhe no clique — uma requisição por tela.
- [ ] A rota de "Já programadas" e a da tela do entregador abrem no **Google Maps** na ordem da plataforma; cada parada abre no **Waze**; o entregador vê a mesma ordem da logística.
- [ ] Todo card de produção tem **Mover** (líder/admin/super admin), que manda o card para a fila do setor escolhido com motivo obrigatório; o motivo aparece no painel.
- [ ] Checklist da lei de desempenho cumprido; handoff com o roteiro de teste.
