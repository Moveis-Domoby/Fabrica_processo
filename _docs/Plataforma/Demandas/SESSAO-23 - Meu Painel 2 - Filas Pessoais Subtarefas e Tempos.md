---
titulo: "SESSAO-23 — Meu Painel 2.0: filas pessoais, subtarefas e tempos"
tipo: demanda
status: entregue (aguardando validação do dono e merge)
data: 2026-09-18
atualizado: 2026-09-23
tags: [plataforma, demanda, bloco-5, meu-painel, tarefas]
---

# 🎯 SESSAO-23 — Meu Painel 2.0: filas pessoais, subtarefas e tempos

> Segunda sessão do **Bloco 5**. Reorganiza o Meu Painel em três filas ("Delegados a mim", "Meus afazeres", "Fila de prioridade"), traz subtarefas, separa quem vê o tempo de quê — e aposenta "Qualidade a atestar" e "Avisos recentes" como blocos do painel.

## O que é

Toda demanda subida para mim ou para o time aparece no **Meu Painel** de cada um, numa visualização rápida com três separadores, fila de prioridade reordenável, subtarefas, e regras claras de visibilidade de tempo (o meu é meu; o delegado é do líder e do admin).

## Requisitos cobertos

RF-40…43 (tarefas/delegação — base da S12/S14). Registrar os requisitos novos em [[PLT - Requisitos]] ao entregar.

## Decisões que regem esta demanda

D-37 (Meu Painel — **revisada nesta sessão**: dois blocos saem) · D-34 (delegação) · D-36 (navegação, sino no topo) · D-40 (toda atividade gera log) · D-29 (tempo útil) · M-04 (um dono por dado) · D-27 (sem códigos internos na UI).

## Comportamento esperado

1. **Três separadores no Meu Painel** (visualização rápida, contadores + itens clicáveis):
   - **Delegados a mim** — tarefas que outros (ou o sistema) me delegaram.
   - **Meus afazeres** — tarefas que eu mesmo criei para mim.
   - **Fila de prioridade** — a união dos dois, em **ordem de cadastro**, com **reordenação pelo próprio usuário** (arrastar/subir/descer; a posição é minha, só minha, e persiste). A reordenação muda só a exibição da fila — não muda prazo, dono nem dado de tarefa.

2. **Subtarefas**: toda tarefa (delegada ou própria) pode ter subtarefas cadastradas dentro dela (checklist com título, concluir/reabrir, contador "2/5" no card da tarefa-mãe). Um nível é suficiente (confirmar na pergunta 2).

3. **Tempo — quem vê o quê:**
   - **Meus afazeres** contam tempo **apenas para mim**: gráfico do meu tempo em afazeres próprios visível **só pelo próprio usuário**, em Dashboards (área pessoal). Nem líder, nem admin.
   - **Delegados a mim** contam tempo de forma visível para **os líderes do setor e todos os admins** (além do próprio).
   - A separação é garantida no **banco** (porta/RLS), não só na UI. O timer continua o existente (`plt_tarefas.iniciada_em`), com o tempo derivado, nunca digitado.

4. **"Qualidade a atestar" sai do Meu Painel.** Pendência de qualidade vira tarefa em **Delegados a mim**, com delegante **"Sistema"** — mesmo card, mesmo clique para resolver. (Não faz sentido como bloco à parte, ex.: para o comercial.) Geração automática: pendência de parecer aberta → tarefa do sistema; parecer dado → tarefa concluída sozinha.

5. **"Avisos recentes" sai do Meu Painel.** As notificações já cumprem esse papel: o popover do sino ganha um **botão "Ver todos"** que abre a lista completa de avisos (paginada no servidor, mais antigos sob demanda — regra "cada tela requisita só o que mostra", da SESSAO-22).

6. O restante do painel (cockpit de metas, blocos que ficam) permanece como a S14 entregou.

## Perguntar ao dono no início da sessão (ritual de sempre; só codar com o OK)

1. A **Fila de prioridade** de cada um é privada (só o próprio vê e reordena), certo? Líder/admin não enxergam a fila de prioridade dos outros?
2. Subtarefas: **um nível** (tarefa → subtarefas) basta, ou precisa de subtarefa dentro de subtarefa?
3. Tarefas do **"Sistema"** (qualidade a atestar): entram na Fila de prioridade também, pela ordem de cadastro?
4. O gráfico privado de "meus afazeres": basta tempo por dia/semana, ou quer também por tarefa?

## Fora do escopo

Chat interno (SESSAO-26) · metas e cockpit (ficam como estão) · notificação externa (WhatsApp — Q-42) · qualquer mudança no fluxo de qualidade em si (só a *apresentação* muda para tarefa do sistema).

## Critérios de aceite

- [x] Demanda delegada a alguém aparece em "Delegados a mim" do delegado; tarefa própria em "Meus afazeres"; ambas na "Fila de prioridade" em ordem de cadastro (cards de produção delegados entram também — resposta 5 do dono).
- [x] Reordenar a fila persiste por usuário (`plt_usuarios.fila_prioridade`) e não afeta a fila de nenhum outro usuário — provado no test:banco.
- [x] Subtarefas: criar, concluir e reabrir dentro de uma tarefa (até 2 níveis — resposta 2); contador no card da mãe; tudo logado pelo trigger de trilha (D-40).
- [x] Pendência de qualidade nova gera tarefa "Sistema" em Delegados a mim; dar o parecer conclui a tarefa sozinha; o bloco "Qualidade a atestar" não existe mais no painel (e o retroativo criou as tarefas das 2 pendências já abertas).
- [x] Tempo de afazeres próprios: só o próprio — provado com papel simulado no PGlite (A-21) E por ensaio A-11 no banco real (admin vê 0 linhas e 0 tempo).
- [x] Tempo de delegados: líder do setor e admin veem (RLS por setor); operador de outro setor não.
- [x] "Avisos recentes" fora do painel; "Ver todos" no sino abre `/inicio/avisos` paginado no servidor.
- [x] Revisão da D-37 registrada como **D-51** em [[PLT - Decisoes de Produto]].

## Notas para o Claude Code

Ritual completo do [[CLAUDE - Regras do Claude Code (repo)]]: leituras na ordem, demanda 2×, (a) entendimento ≤15 linhas + (b) dúvidas + (c) decisões técnicas **antes de codar**, task list espelho, memória de execução em `Execucao/SESSAO-23.md` na hora, erros/acertos → [[PLT - Memoria de Aprendizado]] na hora.
Terreno: subtarefa = `plt_tarefas.tarefa_mae_id` (autorreferência na MESMA tabela — nada de tabela nova para dado de tarefa) · delegante "Sistema" sem inventar usuário fantasma (coluna/flag de origem, exibindo "Sistema" na UI) · fila de prioridade é preferência de exibição do usuário (um dono por dado — M-04), não estado da tarefa · gráfico com Recharts 3.9.2 e tokens `--dm-serie-*` herdados da S16/S20, jamais o âmbar da qualidade · paginação servidor (RNF-02 + regra da tela) · realtime só no que a S14 já usa + polling de segurança.
**Checklist de validação final obrigatório e marcado item a item:** `npm run test:banco` (2 rodadas) · `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` · F-07 (375px/768px) · ⏸️ checkpoint antes de aplicar migration (F-08, md5 antes/depois) · `get_advisors` · task list conferida contra a demanda · handoff + notas do cofre atualizadas.

## Resultado (preencher ao entregar)

**Entregue em 23/09/2026** — branch `sessao-23-meu-painel-2`, handoff [[handoff_2026_09_23_sessao23_meu_painel_2]], decisão nova **D-51** (com as 7 respostas do dono, inclusive as que a demanda não previa: subtarefas em **2 níveis**, tarefa do Sistema **fora** da fila mas com notificação, cards delegados **dentro** da fila, tarefa pessoal **privada por padrão** com "tornar pública", e o painel pessoal com **KPIs de desempenho**). Migration 33 aplicada em produção com permissão total do dono nesta conversa (integração intacta, advisors só com as 3 RPCs pessoais esperadas). Validação final logada + merge: com o dono.

## Ver também

[[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[SESSAO-12 - Tarefas e Delegacao]] · [[SESSAO-14 - Meu Painel e Metas]] · [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]]
