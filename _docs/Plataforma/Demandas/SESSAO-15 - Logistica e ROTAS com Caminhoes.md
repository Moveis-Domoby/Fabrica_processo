---
titulo: "SESSAO-15 — Logística e ROTAS com Caminhões"
tipo: demanda
status: pronta para code
data: 2026-08-28
atualizado: 2026-08-28
tags: [plataforma, demanda, bloco-3]
---

# 🎯 SESSAO-15 — Logística e ROTAS com Caminhões

> O fim de linha vira um módulo de verdade: Estoque consultável, a sala de espera dos
> pedidos incompletos, os danificados com destino — e a programação de caminhão com
> mapa e sugestão de rota (D-38/D-39).

## O que é

As quatro telas do pai **Logística** (Expedição · Estoque · Pedidos em aguardo ·
Danificados) + a reformulação da tela **ROTAS** com programação de caminhão, e o
cadastro de caminhões no Administração.

## Decisões que regem esta demanda

**D-38, D-39** + D-13 (saídas terminais), D-33 (ROTAS na plataforma), D-01 (card
híbrido/reagrupamento), D-40 (logar tudo). Perguntas com resposta provisória
permitida: Q-63 (formato do ID), Q-65 (qualidade do endereço).

## Comportamento esperado

**Logística → Expedição:** a tela atual, movida para `/logistica/expedicao`, sem perda.

**Logística → Estoque:**
1. Todos os produtos parados em ESTOQUE, com **ID de produção digitável** (campo livre,
   editável, buscável — formato definitivo fica para Q-63), produto, medidas, origem
   (pedido ou produção para estoque) e desde quando está parado.

**Logística → Pedidos em aguardo:**
2. Unidades prontas de pedidos **incompletos** esperam aqui, agrupadas por pedido, com
   (k/n) visível.
3. Pedido completo → destaque + botão **"Lançar para ROTAS"**. Só o que foi lançado
   aparece nas ROTAS.

**Logística → Danificados:**
4. Tudo que está em DANIFICADO, com origem, relato da marcação (D-09) e tempo parado.
5. Ações: **Arquivar** (sai da lista, fica no histórico) ou **Resolvido →** escolher
   destino: **Estoque, ROTAS ou qualquer setor** (volta à produção). Tudo evento.

**ROTAS (`/rotas/…` — pai com filhos Entregas e Programação):**
6. Lista **apenas pedidos prontos lançados** pelos Pedidos em aguardo (formato do card
   real da D-33 mantido).
7. **Programar caminhão:** escolho o **dia** → vejo os pedidos **sem programação** →
   seleciono os que vão → **mapa lateral** (Leaflet + OpenStreetMap) desenha os pontos
   da seleção e **sugere** outros pedidos que fazem sentido na mesma rota
   (proximidade). **Apenas sugestão** — nada é decidido pela máquina. Confirmo com
   **data + caminhão**. Pedido programado mostra dia e caminhão no card.
8. Endereço vem do que o Tiny já mandou para o banco; geocodificação aberta
   (Nominatim ou equivalente) **com cache no banco**; pedido sem endereço geocodificável
   aparece na lista com aviso e entra na programação normalmente, só não plota (Q-65).

**Administração → Caminhões:**
9. CRUD completo: nome/apelido, placa, capacidade (texto livre), **foto** (visualizar,
   editar, excluir). Caminhão em uso não pode ser excluído — arquiva.

## Fora do escopo

Roteirização de verdade/otimização com trânsito (é só sugestão por proximidade),
integração com o ClickUp ROTAS antigo ou n8n novo (D-35), app do motorista,
baixa no Tiny ao entregar (webhook já existe da S11 — plugar segue manual, checklist
do dono).

## Critérios de aceite

- [ ] Unidade concluída de pedido incompleto aparece em Pedidos em aguardo; ao completar o pedido, o botão Lançar aparece; após lançar, o pedido está nas ROTAS.
- [ ] Estoque busca por ID digitado e permite editar o ID.
- [ ] Danificado resolvido para um setor volta a aparecer na fila daquele setor; para Estoque/ROTAS idem; arquivado some da lista e fica em evento.
- [ ] Programação: seleção de 3 pedidos plota 3 pontos; sugestão lista pedidos próximos não selecionados; confirmar grava data + caminhão e some da lista de sem-programação.
- [ ] Caminhão com foto aparece na programação; excluir caminhão usado é bloqueado com arquivamento oferecido.
- [ ] Tudo em `/logistica/...`, `/rotas/...`, `/admin/caminhoes`, com sidebar persistente e voltar (regra 16).

## Notas para o Claude Code

Ler o esquema antes de SQL (pedidos/endereços já existem — NÃO inventar coluna).
Leaflet via npm (dependência leve ok; avisar no checkpoint por ser dependência nova —
regra crítica 3). Tiles OSM padrão com atribuição. Cache de geocodificação em tabela
`plt_` própria (respeitar rate limit do Nominatim: 1 req/s, User-Agent identificado).
Fotos no bucket existente. Paginação (RNF-02). Tudo loga (D-40).

## Resultado (preencher ao entregar)

—
