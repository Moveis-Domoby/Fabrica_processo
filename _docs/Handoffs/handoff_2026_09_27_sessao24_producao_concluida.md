---
titulo: Handoff — SESSAO-24 · Produção concluída, cancelamentos e alocação (+ o quadro por arrasto)
tipo: handoff
data: 2026-09-27
atualizado: 2026-09-27
tags: [handoff, sessao, plataforma, bloco-5, estoque, aguardo, cancelamento, alocacao, arrasto, d-58, d-59, d-60, d-61, d-62]
---

# 📋 Handoff — SESSAO-24 · Produção concluída, cancelamentos e alocação (D-58…D-62)

**Branch:** `sessao-24-producao-concluida-cancelamentos` — **mesclada na `main` em 27/09/2026 com o seu OK ("pode juntar na main" — D-20)**, depois de conferidas as telas com a sua sessão. A migration 37 já estava aplicada (as telas novas dependem dela).
**Banco:** migration **37 APLICADA em 27/09** com o seu OK na conversa, pelo aplicador de sempre (F-08): reaplicação das 37, **integração do Tiny com estrutura e linhas idênticas antes/depois** (`e2109f3a…`, 65 colunas). + 2 manutenções de dado (rotas das etapas; peças antigas). Advisors: só as 7 portas novas.
**Demanda:** [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] · **Memória:** `_docs/Plataforma/Execucao/SESSAO-24.md` · **Decisões novas:** D-58, D-59, D-60, D-61, D-62 (suas respostas de 27/09)
**Sessão paralela:** a SESSAO-26 (chat) roda em outra pasta; a migration dela é a 38 e ela aplica **só o arquivo dela**, depois do seu OK — avisada antes e depois da 37.

## 1. O que foi feito

- **Pedidos em aguardo virou o LUGAR da peça pronta de pedido (D-58).** A aba que já existia é onde a peça com pedido termina; o **ESTOQUE ficou só com peça sem dono** (reposição ou pedido cancelado). Os dois só recebem peça 🟢. O banco recusa, com a explicação, mandar peça de pedido para o ESTOQUE.
- **Quadros só por arrasto (D-59)** — a equipe pediu "tudo arrastando":
  - soltar na etapa de **início** (A MONTAR → **MONTANDO**) **inicia o tempo** de quem arrastou, na hora;
  - soltar em etapa que **encaminha** (nome de setor ou CONCLUÍDO) **leva ao próximo setor** — pedindo 🟢🟡🔴 (D-09);
  - soltar em qualquer outra etapa (PARADO, fila…) só move e fecha o tempo;
  - saíram os botões Iniciar, Pausar, Retomar, Finalizar, Assumir e Mover;
  - **"Concluir produção" é o único botão** e só existe na **LIMPEZA E EMBALAGEM**: peça de pedido → Pedidos em aguardo; sem pedido ou de pedido cancelado → ESTOQUE, sem dono;
  - o **modo tablet** também é quadro de arrastar, com botão grande, e pede o **PIN** ao soltar/concluir.
- **Rotas das etapas (D-60)** — gravadas em 20 etapas com as suas regras: etapa com nome de setor leva ao setor; CENTRO DE FURAÇÃO → FURAÇÃO; CONCLUÍDO: SECC/CNC/FITAMENTO → FURAÇÃO, FURAÇÃO → MONTAGEM, MONTAGEM → LIMPEZA E EMBALAGEM. **Editável** em Administração → Setores e etapas ("Soltar o card em {etapa} manda para…"); etapa nova com nome de setor já nasce com a rota.
- **Pedidos em aguardo com as abas "Pedidos" e "Produtos reservados"** — paginadas no servidor; os contadores saem de uma porta só (batem por construção).
- **Cancelamento em 3 estágios (D-61):**
  1. ainda no PCP → sai do quadro e vai para a **aba Cancelados do PCP** (guarda para sempre; paginada; só carrega ao abrir);
  2. com peça em produção → a peça continua, com a etiqueta **"Pedido cancelado — pronta, vai para o estoque"**; concluída, vai ao ESTOQUE sem dono;
  3. peça pronta no aguardo → vai **sozinha** ao ESTOQUE, sem dono (o produto do catálogo é achado pelo SKU).
- **Sugestão do estoque na liberação (D-62):** ao liberar um pedido, cada linha mostra "Há N igual(is) no estoque, sem dono — usar?" — **desmarcado por padrão**. Aceitar faz a unidade do pedido nascer **direto em Pedidos em aguardo**; se o pedido cancelar depois, a peça volta ao estoque sem dono. "Peça igual" = sua regra b1.
- **Painel:** "concluídas do dia" conta só a chegada vinda da produção (o lançamento para as ROTAS contava a peça duas vezes); o "fim de linha" ganhou Pedidos em aguardo.
- **As peças antigas** (6 de pedido que estavam no ESTOQUE), pela sua resposta: 503 e 504 (🟢, 13215) → Pedidos em aguardo; **479, 519 e 533 arquivadas** (pedidos já entregues no Tiny — "não deve nem aparecer mais"); a **502 🔴 (13215) ficou** no ESTOQUE — sua resposta: *"tudo que tu tá vendo aí é teste ainda, mas os pedidos são reais"* (Q-69 ✅, nada a fazer). E, com o seu OK, as **518 (13257) e 537 (13236)** — unidades em produção de pedidos já entregues no Tiny — foram **arquivadas** (a 537 tinha um tempo aberto desde 24/09: fechado antes, o limite de quem a iniciou ficou livre — Q-70 ✅).

## 2. Verificação executada

| O quê | Resultado |
|---|---|
| `npm run test:banco` (2 rodadas) | ✅ tudo verde — **57 checks novos da S24** (rotas das etapas e edição do admin sobrevivendo, arrasto início/encaminhar/mover, limite 1, parecer, concluir, os 3 cancelamentos, alocação com personalizado, contadores das abas, gate do operador, painel, as manutenções) + 3 cenários antigos ajustados à regra nova |
| `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` | ✅ · ✅ · ✅ 64/64 (+8 do arrasto) · ✅ |
| Conferência antes de aplicar (só leitura) | ✅ nenhum dado de hoje quebrava as regras novas; prévia das rotas e das peças levada a você |
| **F-08 no banco real** | ✅ migration 37 aplicada; integração idêntica (estrutura e linhas); blindagem dos gatilhos de `pedidos` (D-43) intacta |
| **Ensaio A-11 no banco real** (termina desfeito — zero linha) | ✅ soltar no início → iniciado (MONTANDO, tempo de quem arrastou) · CONCLUÍDO sem marcar → recusado · com 🟢 → foi para a LIMPEZA E EMBALAGEM com o tempo fechado · concluir 🟡 → recusado · peça de pedido para o ESTOQUE → recusado · concluir 🟢 → Pedidos em aguardo (3 → 4 reservados) · **cancelar o pedido no Tiny** → a peça do aguardo foi sozinha para o ESTOQUE, sem dono, com o produto pelo SKU; aba Cancelados e Estoque mostraram certo · usuário estranho não arrasta e não vê nada |
| Advisors | ✅ segurança: só os +7 WARN das portas novas (endpoints de propósito); desempenho: só o INFO da coluna nova de rota (tabela de 46 linhas) |
| **Telas no navegador (sua sessão, banco real)** | ✅ MONTAGEM: colunas com "soltar aqui começa o tempo" (MONTANDO) e LIMPEZA E EMBALAGEM/CONCLUÍDO tracejadas "Solte aqui para mandar para LIMPEZA E EMBALAGEM" · LIMPEZA E EMBALAGEM: 10 cards, só "Concluir produção" (nenhum Iniciar/Finalizar); o modal diz "vai para Pedidos em aguardo" e só oferece 🟢 (cancelado sem gravar) · Pedidos em aguardo: "Pedidos (1)" — 13215 com 3 de 6 prontas — e "Produtos reservados (3)", a 502 com o selo "Danificado" · PCP → Cancelados: 8 pedidos, cada um com o desfecho · Setores e etapas: "manda para FURAÇÃO/FITAMENTO…" e o seletor · Modo tablet: sem cliente, "Concluir produção" com 56px, o PIN ("quem é você?") vem ANTES · Estoque, Danificados e Visão do dia sem nenhuma chamada com erro |
| **F-07 (375px e 768px)** | ✅ nenhuma tela com rolagem lateral; nenhum alvo de toque < 44px — o cabeçalho do tablet tinha 3 com 36px ("Trocar setor", "Sair") → corrigidos na hora (commit 0914ac0) |

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Pedidos em aguardo como **lugar** (fim de linha interno, sem tela nova) | Deixar a peça de pedido no ESTOQUE e só filtrar | Você disse que "os locais finais não são mais estoque — isso já mudou" (D-58) |
| **Aceitar a sugestão cria a unidade do pedido direto no aguardo** e consome a peça livre por evento | "Reescrever" a peça livre como unidade do pedido | Reescrever quebraria a conta da reposição e a numeração das peças sem dono; assim cada card guarda a própria história e o painel não conta produção de novo |
| Etiqueta "Pedido cancelado" **lida da situação do pedido** | Gravar a etiqueta num campo | É a mesma fonte do cancelamento — nada para dessincronizar |
| **Rotas como DADO** (manutenção que só preenche etapa vazia) | Rotas dentro da migration | Reaplicar migrations nunca pode apagar uma edição do admin |
| **Tablet por arrasto com PIN** (decidido por mim e avisado) | Manter botões no tablet | "Tudo arrastando" — o PIN continua dizendo quem fez |
| Pausa do líder **sai com os botões** (decidido por mim e avisado) | Manter o botão Pausar | Arrastar para PARADO/fila já fecha o tempo; as regras de pausa continuam no banco |

## 4. Bugs e aprendizados

### Registrados na memória de aprendizado
- **E-44** — perguntei o que o código já respondia (fila → início → CONCLUÍDO já existiam). **M-15** — você pensa em tela, não em tabela.
- **E-45** — crase dentro de `node -e "…"` no bash esvaziou textos sem erro (corrigido na hora).
- **E-46** — nome de coluna de memória numa consulta de leitura (recusada, sem dano).

### Descobertos (e já resolvidos com você)
- A **502 🔴** contava como "pronta" do 13215 → Q-69 ✅: é card de teste, fica como está.
- **Duas unidades em produção de pedidos já entregues no Tiny** (518 e 537) → Q-70 ✅: arquivadas por evento (`supabase/manutencao/2026-09-27_arquivar_unidades_de_pedidos_entregues.sql`, ensaiada antes no banco real).
- **M-16** registrado: enquanto a plataforma não está em uso no galpão, card é teste — o pedido é real.

### Descobertos na conferência das telas (fora do escopo — ficaram como tarefa sugerida)
- **Gaveta do menu no celular (antigo, da `main`):** com 375px e a gaveta FECHADA, ~38px da segunda barra ficam por cima da borda esquerda do conteúdo e pegam o toque (as duas barras passam dos 92vw da gaveta). Não é da S24 — tarefa sugerida na conversa. ✅ **resolvido em 2026-09-28** — [[handoff_2026_09_28_ajuste_gaveta_menu_celular]] (E-48).
- **"Frete" vira card de produção (antigo):** o 13215 tem um card "Frete" na LIMPEZA E EMBALAGEM — hoje todo item do pedido com quantidade vira unidade a produzir (serviço, frete e revenda também). É decisão de produto — tarefa sugerida na conversa.
- **"Fim de linha — hoje" (Visão do dia)** conta toda chegada a um fim de linha, inclusive a troca entre fins de linha: hoje mostra "→ Pedidos em aguardo 2" por causa da manutenção (503/504 saíram do ESTOQUE). O "concluídas do dia" já conta só o que vem da produção; se o número deste bloco incomodar, alinhar a porta `plt_fn_dash_fim_de_linha` (mantendo o lançamento para as ROTAS) — migration nova, com o seu OK.

## 5. Arquivos alterados

```
supabase/migrations/20260927120000_plt_producao_concluida_cancelamentos.sql   (nova — 37)
supabase/migrations/20260921120000_plt_filas_tempo_pausa_paginacao.sql        (29: sem o validate do check — E-19)
supabase/migrations/20260926120000_plt_estoque_completo.sql                   (36: coerência not valid + drop antes do create — E-17)
supabase/manutencao/2026-09-27_rotas_das_etapas.sql                           (nova — rodada)
supabase/manutencao/2026-09-27_pecas_de_pedido_para_aguardo.sql               (nova — rodada)
supabase/manutencao/2026-09-27_arquivar_unidades_de_pedidos_entregues.sql     (nova — ensaiada e rodada; Q-70)
supabase/testes/testar-migrations.mjs                                         (bloco S24)
src/kanban/arrasto.ts + arrasto.test.ts                                       (novos)
src/kanban/api.ts · tipos.ts
src/kanban/componentes/CartaoUnidade.tsx · QuadroKanban.tsx · ModalMoverCard.tsx · ModalLiberarPedido.tsx · ModalLinhaTempo.tsx
src/paginas/QuadroSetor.tsx · TelaSetor.tsx · PCP.tsx · PedidosAguardo.tsx · Estoque.tsx · Estrutura.tsx · Danificados.tsx · dashboards/VisaoDoDia.tsx
src/logistica/api.ts · src/navegacao/rotas.ts (+ teste) · ProducaoSetor.tsx · src/componentes/Layout.tsx
src/tablet/CartaoTablet.tsx                                                   (apagado)
```

## 6. Impacto nos números visíveis

> [!warning] O que muda na tela no minuto da publicação
> - **Quadro do PCP:** os **8** pedidos cancelados saem do "Aguardando liberação" e aparecem na aba **Cancelados** (os 5 cancelados que a limpeza histórica do PCP já tinha arquivado continuam fora das telas — arquivado some; eu tinha dito 13 na prévia, errado: E-47).
> - **Pedidos em aguardo:** passa a mostrar o que está NO aguardo (hoje 503 e 504 do 13215, mais a 502 🔴 que conta como reservada do 13215) — antes mostrava as peças de pedido que estavam no ESTOQUE.
> - **Estoque:** reservadas = peças de pedido em fim de linha (aguardo), livres = sem dono; as 3 arquivadas somem.
> - **Painel "concluídas do dia":** cai o que era dupla contagem (o lançamento para as ROTAS contava a peça outra vez) — o número fica menor e certo.

## 7. Notas do cofre atualizadas

- [[PLT - Decisoes de Produto]] — D-58 a D-62; ↩️ em D-13, D-18, D-24, D-38, D-45, D-48
- [[PLT - Requisitos]] — RF-77, RF-78, RF-79, RF-87, RF-88, RF-89; ↪️ RF-09
- [[SUPA - Esquema do Banco]] — migration 37
- [[PLT - Modelo de Sistema]] — "Quadro por arrasto, fins de linha e cancelados" + ↪️ nas seções que mudaram
- [[FAB - Estrutura de Producao (Trello e ClickUp)]] — os fatos da fábrica que você confirmou (SECC/CNC, o móvel nasce na montagem, a LIMPEZA E EMBALAGEM leva ao fim de linha)
- [[PLT - Perguntas em Aberto]] — Q-69 e Q-70 (abertas e respondidas na mesma sessão)
- [[PLT - Memoria de Aprendizado]] — E-44, E-45, E-46, M-15, M-16
- [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] — Resultado · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · [[000 - PROXIMOS PASSOS]]

## 8. Ficou pendente

### Aguardando decisão sua
1. ✅ Telas conferidas e **mesclada na `main` em 27/09**. ⚠️ A **SESSAO-26** mescla DEPOIS desta: os dois ramos partiam da mesma `main` e dividem `Layout.tsx`, o harness e notas do cofre — ela resolve os conflitos e roda o `test:banco` com 37 + 38 (as duas já estão aplicadas no banco).
2. (herança da S25) ligar a reposição automática continua com você.

### Próximo passo sugerido
- **SESSAO-26 (chat)** já está em execução em paralelo — a migration 38 dela entra depois do seu OK.
- A **SESSAO-27 (automações)** herda o arrasto: "mover card" por automação deve usar a mesma porta do arrasto (`plt_fn_soltar_card`) para não furar a regra do início/encaminhar.

## 9. Como validar (passo a passo)

1. **Quadro por arrasto** — Fábrica → Controle de Produção → MONTAGEM: arraste um card de **A MONTAR** para **MONTANDO** → o tempo começa com o seu nome no card. Arraste para **CONCLUÍDO** → abre "estado da peça"; escolha 🟢 → o card aparece na **LIMPEZA E EMBALAGEM** (fila A LIMPAR). Não existe mais botão Iniciar/Finalizar.
2. **Concluir** — na LIMPEZA E EMBALAGEM, "Concluir produção" num card de pedido → ele aparece em Logística → **Pedidos em aguardo** (aba Pedidos e aba Produtos reservados). Tente concluir 🟡: não deixa.
3. **Tablet** — Modo tablet no setor: arraste um card → pede o seu nome + PIN antes.
4. **Rotas** — Administração → Setores e etapas: cada etapa com rota mostra "manda para X"; mude uma e confira no quadro que a coluna diz "Solte aqui para mandar para X".
5. **Cancelados** — PCP → aba **Cancelados**: os pedidos cancelados, com quantas peças estão em produção/estoque/ROTAS.
6. **Sugestão do estoque** — quando houver peça sem dono no ESTOQUE e um pedido igual no PCP, "Liberar unidades" mostra "Há N igual(is) no estoque — usar?".

```sql
-- As rotas gravadas
select so.nome as setor, e.nome as etapa, sd.nome as manda_para
  from public.plt_etapas e
  join public.plt_setores so on so.id = e.setor_id
  join public.plt_setores sd on sd.id = e.setor_destino_id
 order by so.ordem, e.ordem;

-- O que está em cada fim de linha
select s.nome as lugar, count(*) as pecas,
       count(*) filter (where c.pedido_id is null) as sem_dono
  from public.plt_cards c
  join public.plt_setores s on s.id = c.setor_atual_id and s.papel_no_fluxo = 'terminal'
 where c.tipo = 'unidade' and c.arquivado_em is null
 group by s.nome;
```
