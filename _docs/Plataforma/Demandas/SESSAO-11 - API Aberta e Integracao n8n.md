---
titulo: "SESSAO-11 — API Aberta e Integração n8n"
tipo: demanda
status: rascunho
data: 2026-08-19
atualizado: 2026-08-19
tags: [plataforma, demanda, sessao, api, n8n]
---

# 🎯 SESSAO-11 — API Aberta e Integração n8n

## O que é

A porta de integrações completa: API aberta para criar, editar, mover e excluir cards (D-03), webhooks de saída e a ponte com o ClickUp ROTAS. **A entrada de pedidos Tiny → PCP já existe desde a [[SESSAO-09 - Entrada de Pedidos via n8n]]** (D-11) — esta sessão completa o resto e formaliza a gestão de chaves.

## Requisitos cobertos

RF-50 (completo) · RF-51 (completo) · RF-52.

## Decisões que regem

D-03 (API é o caminho da automação futura de destino) · D-05 (ponte com ClickUp ROTAS) · D-08 (o pedido já está no banco — P15) · regras críticas 2–4 do [[CLAUDE - Regras do Claude Code (repo)]].

## Comportamento esperado

- **API autenticada por chave** (gerada/revogada no admin — Q-50), com escopos (leitura/escrita). Ações via API registram "via integração X" como autor nos eventos.
- **Endpoints mínimos:** criar card (pedido e unidade) · editar · mover entre etapas · excluir · consultar cards/etapas/eventos. Documentação da API no repo, com exemplos prontos para colar no n8n.
- **Webhooks de saída (RF-52):** assinatura de eventos (card criado, movido, finalizado, qualidade marcada, disputa aberta/resolvida) com URL de destino configurável — é assim que o n8n reage à plataforma.
- **Revisar a entrada da SESSAO-09:** migrar a chave manual daquela fase para a gestão formal de chaves desta sessão.
- **Ponte ROTAS (D-05):** unidade/pedido chegando em EXPEDIÇÃO dispara webhook para o n8n criar o card na ROTAS do ClickUp — **sem tocar** na automação ROTAS "entregue" → Tiny em produção.
- **Movimentação via API não exige estado de qualidade** (RF-86/D-09 complemento): atestação é gesto exclusivamente humano; o movimento automático passa sem marcação.

## Perguntar ao dono no início da sessão

- Q-50 (formato da chave/escopos) · Q-51 (lista fechada do que o n8n faz no dia 1) · Q-52 (plataforma lê do Tiny ou só recebe?).

## Fora do escopo

Builder de automações internas (11) · app/tela nova.

## Critérios de aceite

- [ ] Chave criada no admin autentica; chave revogada para de funcionar na hora.
- [ ] Ciclo completo via API: criar pedido → liberar unidades → mover → eventos com autor "integração".
- [ ] Webhook de saída entrega o evento num endpoint de teste do n8n.
- [ ] Documentação da API validada executando os exemplos.
- [ ] PR + handoff.
