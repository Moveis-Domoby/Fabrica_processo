---
titulo: "SESSAO-14 — Meu Painel e Metas (cockpit)"
tipo: demanda
status: entregue
data: 2026-08-28
atualizado: 2026-08-28
tags: [plataforma, demanda, bloco-3]
---

# 🎯 SESSAO-14 — Meu Painel e Metas

> A tela em que todo usuário cai ao entrar (D-36/D-37). Pendências, notificações e o
> cockpit de metas com índice de conclusão em tempo real.

## O que é

`/inicio/meu-painel` vira o painel pessoal de cada usuário: o que me espera, o que me
delegaram, minhas metas — e o cadastro de metas com indicador configurável (D-37).

## Decisões que regem esta demanda

**D-37** + D-34 (afazeres/delegação — a S12 é a base), D-02 (fila × execução), D-29
(tempo útil), D-32 (gates por papel), D-40 (logar tudo).

## Comportamento esperado

**Meu painel:**
1. Seções: **Pendências** (qualidade a atestar, delegações a aceitar, tarefas em
   aberto, execuções em andamento), **Notificações recentes** (as mesmas do sino) e
   **Cockpit de metas**.
2. Cockpit: minhas metas **diárias, semanais e mensais**, cada uma com barra de
   progresso, % de conclusão **em tempo real** e marco visual do "alvo até agora"
   (referência: mockup `03-pessoas-produtividade.png` em `docs/inspiracao/dashboards/`).
3. Operador vê as próprias metas; líder vê também as do setor; admin vê tudo.

**Metas:**
4. Criar meta = escolher **indicador** (unidades concluídas · tarefas concluídas ·
   tempo útil trabalhado), **período** (diária/semanal/mensal), **alvo numérico** e
   **dono** (pessoa ou setor).
5. Quem cria: **admin** (qualquer), **líder** (do próprio setor), **a própria pessoa**
   (meta pessoal). Editar/encerrar segue a mesma regra; histórico preservado (evento).
6. Progresso calculado dos dados que já existem (execuções finalizadas, tarefas
   concluídas, tempo útil D-29) — nada de digitação manual de progresso.

**Afazeres:**
7. `/inicio/afazeres` = a tela da S12 (meus + delegados), movida para o novo lar sem
   perda de função.

## Fora do escopo

Dashboards gerais (S16), bonificação por meta (D-04 segue adiada), notificação
externa (WhatsApp — Q-42, standby D-35).

## Critérios de aceite

- [ ] Login cai em `/inicio/meu-painel` com pendências reais do usuário logado.
- [ ] Meta criada com cada um dos 3 indicadores progride sozinha quando o dado-fonte muda (testável: finalizar execução move a meta de unidades).
- [ ] Períodos diário/semanal/mensal viram janelas corretas (fuso America/Fortaleza) e reiniciam sozinhos.
- [ ] Líder cria meta só para gente/setor dele; operador só pessoal; RLS garante no banco, não só na UI.
- [ ] Progresso em tempo real (realtime ou polling curto) visível sem recarregar.
- [ ] Afazeres funciona igual à S12 no novo endereço.

## Notas para o Claude Code

Ler o esquema antes de SQL; metas em tabela(s) `plt_` novas com evento de criação/
alteração; cálculo de progresso de preferência como view/porta de leitura (padrão da
migration 18). Paginação nas listas (RNF-02). Tudo loga (D-40).

## Resultado (preencher ao entregar)

✅ **Entregue em 01/09/2026** — [[handoff_2026_09_01_sessao14_meu_painel]]. Meu Painel no ar (pendências + avisos + cockpit de metas no molde do mockup 03), metas com progresso calculado no banco (`plt_fn_metas_painel`, migrations 23/24 aplicadas com autorização do dono), RLS por papel, história append-only, trilha D-40, Afazeres intacto. Critérios todos verificados (test:banco 2 rodadas + teste ao vivo com a conta do dono). Respostas do dono viraram regra: membros veem meta do setor; transferência/mover contam unidade; semana começa na segunda.
