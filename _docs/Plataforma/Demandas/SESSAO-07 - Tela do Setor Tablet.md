---
titulo: "SESSAO-07 — Tela do Setor (Tablet)"
tipo: demanda
status: entregue
data: 2026-08-19
atualizado: 2026-08-28
tags: [plataforma, demanda, sessao, ux]
---

# 🎯 SESSAO-07 — Tela do Setor (Tablet)

> [!success] ✅ Entregue em 28/08/2026 (bloco noturno D-26) — [[handoff_2026_08_28_sessao07_tela_setor]]
> As respostas do dono no aval do bloco viraram **D-28** (card: dados do produto + espaço de imagens + som discreto) e **D-29** (controle de tempo do admin, executado nesta sessão). Screenshots ficaram como pendência da revisão da manhã (painel sem exibição de madrugada — A-13).

## O que é

A tela que o chão de fábrica vê o dia inteiro: a fila do setor num tablet/PC fixo, com botões grandes e o mínimo de ruído. É a "navegação simples para os setores" — o operador não navega, ele age.

## Requisitos cobertos

RF-22 · RF-24 (nível "simples") · RF-25 · consolida o uso de RF-05/RF-80/RF-81 no dispositivo real.

## Decisões que regem

D-06 (tablet compartilhado + PIN; mobile-first) · D-02 · D-09 (revisada — **sem disputa/pausa**) · **D-27** (padrões de interface) · D-26 (bloco noturno).

## ↪️ Prelúdio DENTRO do escopo (28/08 — D-27, pedidos do dono)

Antes da tela do setor, esta sessão ajusta o padrão do sistema inteiro:

1. **Menu lateral** (sidebar) no lugar da barra superior de rotas; recolhível no celular.
2. **Remover a rota/aba "Design system"** do app e migrar `docs/design-system.md` do repo para o cofre como **[[PLT - Modelo de Sistema]]** (`_docs/Plataforma/`), atualizando os DOIS `CLAUDE.md` para apontarem o caminho novo. Nada se constrói fora do modelo.
3. **Microinteração padrão dos botões** (no componente `Botao`, vale para todos): ao interagir, elevação leve (~1–2px para cima) + sombra suave — sutil, além do estado fosco atual.
4. **Varredura de códigos internos na UI:** nenhum "D-09"/"RF-NN"/"Q-NN" em texto visível — reescrever em língua de usuário; os códigos viram comentário de código.
5. Textos explicativos longos: manter por ora (D-27 — são temporários, não criar novos além do necessário).

## Comportamento esperado

- **Modo setor:** dispositivo logado no setor exibe SUA fila em tela cheia — cards ordenados por chegada, com destaque para os que esperam há mais tempo. (~~pausados por disputa~~ — ↩️ disputa/pausa caiu na revisão da D-09 em 24/08.)
- Ações diretas no card, com PIN do operador: **receber (atestação D-09) · iniciar · finalizar · mover (com marcação D-09)**. Fluxo completo em poucos toques, botões dimensionados para dedo.
- O card na fila mostra o essencial (a definir com Q-31 — candidatos: produto, medidas, (k/n), pedido, estado de qualidade na chegada, observação).
- Atualização em tempo real: card novo aparece sem recarregar (som/alerta é a Q-32 — perguntar).
- A mesma experiência funciona no celular pessoal logado (D-06), mostrando o setor do usuário.

## Perguntar ao dono no início da sessão

- Q-31: o que o operador PRECISA ver no card (imagem 3D? medidas? obs?) e o que é ruído.
- Q-32: som/alerta na chegada de card, ou consulta passiva.

## Fora do escopo

Dashboards · telas de líder/admin · tarefas.

## Critérios de aceite

- [ ] Num tablet real (ou viewport equivalente), o ciclo receber → iniciar → finalizar → mover+marcar acontece só com toques, sem teclado além do PIN.
- [ ] Dois operadores no mesmo tablet registram ações com autores distintos.
- [ ] Card novo aparece na fila em tempo real.
- [ ] Card com recebimento pendente (dupla atestação da SESSAO-06) é visualmente inconfundível e o iniciar passa pela confirmação. (↩️ substitui o critério antigo de "card pausado por disputa" — disputa/pausa caiu na D-09 revisada.)
- [ ] Prelúdio D-27 entregue: sidebar, modelo de sistema no cofre (sem rota /design), microinteração dos botões, UI sem códigos internos.
- [ ] PR + handoff com screenshots em tablet e celular.
