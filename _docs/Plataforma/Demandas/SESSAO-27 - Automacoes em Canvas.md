---
titulo: "SESSAO-27 — Automações em canvas"
tipo: demanda
status: pronta para code
data: 2026-09-18
atualizado: 2026-09-18
tags: [plataforma, demanda, bloco-5, automacao, canvas]
---

# 🎯 SESSAO-27 — Automações em canvas

> Sexta sessão do **Bloco 5**. **Absorve a [[SESSAO-17 - Automacoes Internas]]** (standby desde a D-35): o builder "quando X, faça Y" agora nasce como **tela de canvas** (nós ligados, estilo n8n), e ganha as ações que o dono pediu — inclusive **mover card automaticamente**, o que **revisa a D-03**. Demanda grande: organizar muito bem antes de codar.

## O que é

Uma tela de automação em **canvas** onde admin/líder montam fluxos visuais: um nó de **gatilho** ligado a nós de **ação**. Nasce com o gatilho *"pedido iniciado na etapa X do setor Y"* e as ações *mover card*, *excluir (arquivar) card* e *definir etiqueta* — com as etiquetas criadas em **Configurações**, por enquanto.

## Requisitos cobertos

RF-06 (builder de automações) · complementa RF-82/83/84. Registrar requisitos novos em [[PLT - Requisitos]].

## Decisões que regem esta demanda

**D-03 (SERÁ REVISADA nesta sessão** — mover card automaticamente por gatilho passa a existir; registrar D-NN novo com o dono antes de codar essa ação) · M-01 (a automação executa consequências que o humano configurou; o PCP continua manual — nenhuma automação nasce ligada sozinha) · RNF-05/M-02 ("excluir" = **arquivar**, `plt_fn_arquivar_card`/`arquivado_em` — nada se apaga) · D-40 (cada execução de automação logada) · D-27 (sem códigos internos na UI) · Q-40/Q-41 (perguntas da S17, ainda abertas).

## Comportamento esperado

1. **Tela de canvas** (novo filho — propor ao dono o lugar: `/admin/automacoes` ou filho próprio): arrastar nós, ligar gatilho → ação(ões) em sequência, nomear a automação, ligar/desligar com um switch. Visual limpo no design system da casa; sem lib pesada nova sem aprovação (regra crítica 3 — avaliar primeiro canvas próprio leve/SVG; `@dnd-kit` já existe no projeto).
2. **Gatilho de nascimento:** **"pedido iniciado na etapa X do setor Y"** (card entrou na etapa X do setor Y — cobre também "chegou na fila", já que pós-SESSAO-22 chegada = etapa fila). Seletores de setor e etapa reais (nada digitado à mão).
3. **Ações de nascimento:**
   - **Mover o card automaticamente** para outro setor/etapa (a revisão da D-03; movimentação nasce como evento de origem `automacao` — a exceção de qualidade da origem `automacao` já existe desde a S06/RF-86).
   - **Excluir card** = arquivar (`arquivado_em`), com a mesma semântica do arquivamento da S15 — reversível e auditável.
   - **Definir etiqueta** no card. **Etiquetas** são entidade nova (nome + cor de token, nada de hex solto), **criadas em Configurações** por enquanto; o card exibe a etiqueta (ícone/texto + cor — nunca só cor, M-12) no quadro e no tablet.
4. **Execução confiável e depurável:** motor no banco (trigger sobre `plt_eventos` → fila de execução, no padrão da fila de webhooks da S11), cada disparo registrado (**o que gatilhou, condição avaliada, ação tomada, quando**) numa trilha consultável na própria tela ("últimas execuções"). Loop protegido: automação que gera evento que gatilha outra automação tem profundidade limitada e registrada.
5. **Permissões:** admin cria globais; líder cria no escopo do próprio setor (confirmar — Q-41). Toda criação/edição/liga-desliga logada (D-40).
6. **Exemplos desativados** criados de fábrica (os da S17: "parado > 3 dias → notifica líder" etc.) **só se** o gatilho "parado há N" couber; senão, registrar como evolução — o canvas nasce com o escopo do item 2/3 e cresce por demanda.

## Perguntar ao dono no início da sessão (ritual de sempre; só codar com o OK)

1. **Revisão da D-03**: confirmar em D-NN que mover card automaticamente por gatilho agora pode — com o freio de que automação nasce desligada e é criada por humano.
2. Q-40: quais as **3 primeiras automações reais** que você quer montar no canvas? (Guiam o teste de aceite.)
3. Q-41: líder cria automação do próprio setor, ou só admin cria?
4. Onde a tela mora: Painel admin (`/admin/automacoes`) ou um pai novo?
5. Etiquetas: quais as primeiras (nomes/cores)? Ficam em Configurações por enquanto, confirmado.

## Fora do escopo

Central de notificações com preferências (o resto da antiga S17 que não entrou aqui — permanece futuro) · gatilhos/ações além dos listados (parado-há-N só se couber; canal externo/WhatsApp = Q-42) · editor de código · automação criada ligada por padrão.

## Critérios de aceite

- [ ] Montar no canvas, sem código: "pedido iniciado na etapa X do setor Y → mover para etapa Z" e vê-la rodar com um card de teste (evento origem `automacao` na linha do tempo).
- [ ] Ação de arquivar e ação de etiqueta funcionam por gatilho; etiqueta aparece no card (quadro e tablet).
- [ ] Etiquetas criadas/editadas em Configurações; cores por token do design system.
- [ ] Trilha de execução mostra gatilho, avaliação e ação de cada disparo; automação desligada não dispara.
- [ ] Líder não cria/edita automação fora do próprio setor (garantido no banco).
- [ ] Loop entre automações não trava o sistema (teste forjado com duas automações em ciclo: profundidade limitada e registrada).
- [ ] Automação nova nasce **desligada**.
- [ ] Revisão da D-03 + respostas Q-40/Q-41 registradas em [[PLT - Decisoes de Produto]]; [[SESSAO-17 - Automacoes Internas]] anotada como absorvida.

## Notas para o Claude Code

Ritual completo do [[CLAUDE - Regras do Claude Code (repo)]]: leituras na ordem, demanda 2× (e a antiga S17 uma vez, para o contexto), (a)(b)(c) antes de codar com OK do dono, task list espelho, memória em `Execucao/SESSAO-27.md` na hora, E-NN/A-NN na hora.
Terreno: o motor reusa o desenho da S11 (trigger enfileira → despacho por pg_cron/pg_net, job no padrão `plt-*`) — ou execução síncrona no próprio trigger quando a ação é barata; decidir e registrar · movimentação automática usa as portas/validações existentes (a exceção `origem automacao` na qualidade já existe — RF-86) · trava que vale para todos mora em trigger (M-14) · etiqueta em tabela `plt_etiquetas` + vínculo com card por **evento com projeção** (M-13) · gatilhos avaliados sobre `plt_eventos` (o evento é a tabela-mãe, M-02) — nunca sobre estado derivado (E-01: gatilho em dado derivado já queimou a casa uma vez) · cuidado com dependência pesada de canvas: propor primeiro solução leve.
**Checklist de validação final obrigatório e marcado item a item:** `npm run test:banco` (2 rodadas) · `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` · F-07 (o canvas precisa ser usável no tablet ao menos para ligar/desligar e ver trilha) · ⏸️ checkpoint antes de aplicar migration (F-08, md5 antes/depois) · `get_advisors` · task list conferida · handoff + notas do cofre atualizadas.

## Resultado (preencher ao entregar)

*—*

## Ver também

[[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[SESSAO-17 - Automacoes Internas]] · [[SESSAO-11 - API Aberta e Integracao n8n]] · [[SESSAO-22 - Producao - Filas Reais Tempo de PCP e Paginacao]]
