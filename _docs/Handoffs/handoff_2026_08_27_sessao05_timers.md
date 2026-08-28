---
titulo: Handoff — SESSAO-05 Timers e Eventos de Tempo
tipo: handoff
data: 2026-08-27
atualizado: 2026-08-27
tags: [handoff, sessao, plataforma, timers, execucao]
---

# 📋 Handoff — SESSAO-05 · Timers e Eventos de Tempo

**Branch:** `sessao-05-timers-eventos` · **Repositório:** `contatodomoby/Fabrica_processo`
**Banco:** projeto `axnzldwgwsmepukdiljx` (org **Tech**) — migration 14 **aplicada em 27/08 com autorização dada na conversa**
**Demanda:** [[SESSAO-05 - Timers e Eventos de Tempo]] · **Memória de execução:** `docs/execucao/SESSAO-05.md`

## 1. Objetivo da sessão

A razão de existir da plataforma: o tempo passa a ser medido sozinho, como subproduto dos cliques. As respostas do dono no início viraram a **[[PLT - Decisoes de Produto#D-24|D-24]]**: vários cards por pessoa com **limite configurável por setor** (padrão sem limite), **iniciar obrigatório** antes de finalizar, **mover encerra a execução automaticamente**, **admin pode tudo**, e **transferência entre pessoas** finaliza para um e inicia para o outro.

## 2. O que foi feito

### Banco (migration 14 — `plt_execucao_estorno`)

- **Tipo de evento `estorno`**: anula um gesto de execução **sem apagar nada** (RNF-05) — evento novo apontando o anulado via `evento_referencia_id`. Só o **último gesto** de execução válido é estornável (desfaz-se do mais novo para trás); quem pode: **líder do setor do card ou admin**.
- **Regras por TRIGGER** (valem até para a service_role do n8n — M-14): iniciar obrigatório antes de finalizar; execução exige pessoa (D-02); a mesma pessoa não inicia o mesmo card duas vezes; **limite por pessoa/setor** (coluna nova `plt_setores.limite_execucoes_por_pessoa`, null = sem limite); card concluído (fim de linha) não executa; o trigger ainda preenche o setor/etapa da época em cada gesto.
- **Projeção**: iniciar por outra pessoa = transferência (troca o executor); estorno **reprojeta** o executor a partir do log válido (M-13).
- **`plt_vw_execucoes` recriada**: a execução fecha em **finalizada**, **transferência** ou **movimentação** (coluna nova `encerramento`), ignora estornados e usa o setor/etapa **da época** — nunca a posição atual do card.
- **2 RPCs novas** (padrão E-11 — endpoints de propósito, gate interno; os 2 WARN novos dos advisors são o desenho): `plt_fn_linha_tempo_card` (história completa com nomes; vê quem vê o card) e `plt_fn_estornar_evento`.

### Front

- **Card de unidade**: na fila mostra `X na fila` (o mais antigo esperando da coluna ganha ampulheta + destaque); em execução mostra o tempo + **quem** executa ("você" para o próprio) e borda de ação. Botões **Iniciar / Finalizar / Assumir** (≥44px). Sem gestos em setor terminal.
- **Linha do tempo** (botão de histórico em cada card): um bloco por permanência — **Fila (do setor) · Execução de {pessoa} · Total na etapa**, com autores e o motivo do encerramento ("finalizada", "transferida", "encerrada ao mover"). Lista crua de eventos colapsada, **estornado riscado**. Painel de estorno (líder/admin) nomeando o gesto que vai anular, com observação opcional.
- **Mover** com execução aberta avisa: "mover encerra a execução agora (D-24)".
- **Estrutura**: campo **"Limite de cards em execução por pessoa"** por setor (admin; vazio = sem limite).
- Erros de regra chegam do banco **já em português** e o front só exibe (a regra tem um dono — o trigger).

## 3. Verificação executada (critérios de aceite)

| Critério | Resultado |
|---|---|
| Card em 2+ etapas mostra fila e execução de cada uma, com autores | ✅ card real 13192: 9 permanências (PCP→SECC→FITAMENTO→FURAÇÃO→PCP→SECC→EM CORTE), fila/execução/total por etapa, "Execução de Wallace: 35s · encerrada ao mover o card" |
| Mover sem iniciar → tempo todo é fila | ✅ "Ninguém iniciou aqui — o tempo foi todo de fila" em todas as permanências sem gesto |
| Estorno cria evento novo e o original permanece visível | ✅ estorno da finalização do 13207: toast, execução reaberta no card, evento original riscado na lista, observação gravada — conferido também por SQL |
| UPDATE/DELETE em evento falham no banco | ✅ `test:banco` (trigger de imutabilidade re-testado nas 2 rodadas) |
| Revisão + handoff | ✅ este documento (PR dispensado — D-20); **merge aguarda seu OK** |

Mais, tudo no banco REAL com pedido real: limite 1 na SECC recusou o 2º Iniciar com a mensagem do banco no toast; sem limite, 2 execuções simultâneas da mesma pessoa; transferência e demais regras provadas no `test:banco` (22 verificações novas, 2 rodadas, integração com impressão digital idêntica). `tsc` · lint · Vitest 15/15 · build ok. F-07: 375px e 768px sem rolagem horizontal, alvos de toque 44px. Advisors: **6 WARN esperados** (endpoints de propósito) — nada fora do combinado.

## 4. Como validar de novo (do zero)

1. `npm run test:banco` → tudo verde.
2. `npm run dev` → entrar como admin → **SECC** → card na Chegada → **Iniciar** (vira "você" + timer) → **Finalizar**.
3. **Estrutura → SECC → Limite = 1** → iniciar 2 cards → o 2º é recusado com a mensagem do banco. Limpar o limite (vazio) → os 2 iniciam.
4. Iniciar um card → **Mover** → ver o aviso âmbar → mover → a execução encerra sozinha.
5. Botão de **histórico** no card → conferir fila/execução/total/autores por etapa → **Estornar** o último gesto → a lista completa mostra o original riscado.
6. Como **operador** (`operador.teste.um`): sem painel de estorno na linha do tempo; iniciar/finalizar funcionam no setor dele.

## 5. Estado que ficou no banco (permanente por desenho — append-only)

- Card do **pedido 13207** (1/1) na Chegada da SECC: iniciar → finalizar → **estorno com observação de teste** → finalizar de novo.
- Card do **13192** (1/1) em EM CORTE (TESTE): execução de 35s encerrada por movimentação.
- Limite da SECC foi testado com 1 e **removido** ao final (está null).

## 6. Ficou pendente / limitações conhecidas

- **Card recém-finalizado volta a mostrar "na fila"** no quadro (contador simples do `desde`). O tempo real está correto na linha do tempo e nas views; se o rótulo incomodar no uso, refina-se depois.
- **Transferir ("Assumir") só aparece para quem olha um card executado por outro** — no tablet compartilhado (SESSAO-07) o gesto vai casar com o PIN.
- A conferência do parecer de qualidade no fluxo de mover/receber é a **SESSAO-06** (pluga no Finalizar/Mover que agora existem).
- Chunk do build segue ~750 kB (candidato a code-split — pendência herdada).
- Q-30 (modo escuro) e Q-42 (canal de notificações) continuam em aberto.
- **Lembrete de segurança:** a senha do admin usada nos testes foi dita em chat — **trocar antes de a plataforma ir ao ar** (você já previu isso na conversa).

## 7. Notas do cofre atualizadas

[[PLT - Decisoes de Produto]] (**D-24**) · [[SESSAO-05 - Timers e Eventos de Tempo]] (respostas de 27/08) · [[SUPA - Esquema do Banco]] (migration 14) · [[PLT - Memoria de Aprendizado]] (**E-17**) · `docs/design-system.md` (execução e linha do tempo) · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]].

## Ver também

[[SESSAO-05 - Timers e Eventos de Tempo]] · [[handoff_2026_08_27_sessao04_kanban]] · [[PLT - Decisoes de Produto]] · [[SUPA - Esquema do Banco]]
