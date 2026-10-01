---
titulo: Execução — SESSAO-29 · Reconciliação com o Tiny (pente-fino diário)
tipo: execucao
data: 2026-10-01
atualizado: 2026-10-01
tags: [execucao, sessao-29, tiny, n8n, reconciliacao, integracao]
---

# 🔧 Execução — SESSAO-29 · Reconciliação com o Tiny

**Pasta:** a principal (`Domoby - fabrica`), sem worktree (pedido do dono, 01/10). **Branch:** `sessao-29-reconciliacao-tiny`, a criar a partir da `main` **depois do OK do dono** (a `main` local = `origin/main` = 6750a58 em 01/10, conferido com fetch pela credencial do `gh`).
**Demanda:** [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] (lida 2×) · handoffs lidos: [[handoff_2026_09_30_ajuste_estoque_2]], [[handoff_2026_09_30_estoque_sincronizado_tiny]] e a origem da demanda, [[handoff_2026_09_22_sessao21_cutover]] (+ `Execucao/SESSAO-21.md`, a conferência de 22/09).
**Working tree herdado:** 14 notas do cofre alteradas e NÃO commitadas pela revisão de pendências do dono no Cowork (01/10 — D-90…D-94, Q-21/Q-22/Q-25/Q-30…, handoffs). **Não são desta sessão:** commit sempre por caminho explícito (E-23); nunca `checkout --` nelas (E-60).
**Sessões vizinhas (ListAgents, 01/10):** 3 sessões do app, todas paradas (sincronização do estoque, fotos do Tiny, Ajuste Estoque 2).

## Checkpoint de início — leituras e o que o banco mostrou (SÓ leitura, 01/10 ~01:00–02:00)

Leituras: CLAUDE (repo e cofre), Memória de Aprendizado, Decisões (D-01…D-94, inclusive as 5 não commitadas de 01/10), Visão Geral, Requisitos, Ordem das Sessões, Perguntas em Aberto, Mapa, Próximos Passos, Esquema do Banco, Modelo de Sistema (seções gerais — a demanda não muda tela), [[N8N - Backfill Historico do Tiny]], [[N8N - Tiny Integracoes Referencia]] §1–2.4, [[N8N - Pendencias e Riscos]] (P17), [[N8N - Workflow Tiny para Planilha]], [[PLT - Comercial - Identidade do Cliente]], migration 43 (o padrão "o banco acorda o n8n").

1. **`fn_upsert_pedido` viva = a do retrato** (`supabase-fabrica-schema.sql`): cliente por CPF → nome+fone → cria; pedido com `coalesce` em tudo (menos `marcadores` e `qtd_parcelas`); **sempre** regrava (cliente `atualizado_em`, pedido `atualizado_em`, apaga e regrava os itens) e sempre insere 1 linha em `eventos` — mesmo sem mudança nenhuma.
2. **`plt_privado.fn_reagir_pedido` viva:** no UPDATE só reage se mudou situação, previsão, totais, obs, obs_interna ou forma de envio; com unidade liberada → `pedido_atualizado`; cancelou → `pedido_cancelado` (+ aviso aos admins se havia produção). Gatilho de INSERT só para `origem = 'webhook'` e situação viva (a blindagem da carga histórica).
3. **Funções vivas da carga histórica ≠ arquivo do cofre** (`22_backfill_tiny.sql`): `fn_backfill_falha(p_fila_id, p_erro, p_terminal)` (3 parâmetros, terminal → `vazio`); `fn_backfill_aplicar` com nota fiscal por `id_venda` e conta a receber por `fn_backfill_conta_mapear`; `fn_fila_proximos` igual. **O retrato do harness não tem `tiny_fila` nem essas funções** (pendência do E-27) → quem mexer recria a partir de `pg_get_functiondef` e espelha no retrato. → A-44.
4. **`tiny_fila`:** 26.012 linhas, TODAS `ok` (pedido 5.224 · contato 11.511 · nota 2.913 · conta 6.072 · buscas); última linha processada em 10/09.
5. **O fluxo da carga no n8n está LIGADO e vazio:** registro da API (24 h até 01/10 03:52 UTC) = **1.392 chamadas** de `fn_fila_proximos` (o gatilho "Cada minuto"), contra 51 de `fn_upsert_pedido` (vendas) e 492 de `fn_upsert_produto` (a varredura das 03:15). → A-44.
6. **O pedido do Tiny não traz o id do contato** (16 chaves no `cliente` do `raw`; `codigo` preenchido em 594 de 5.440) — o id só vem no aviso (`dados.idContato`), e o `Normalizar evento` do fluxo de vendas não o repassa. **O nome no pedido é o ATUAL do contato:** 4.932/4.932 pedidos da carga histórica com o nome igual ao do `contato.obter`; nos de aviso, 9 diferentes, todos recentes (contato renomeado depois de 08/09). → A-43.
7. **Tamanho da rodada (01/10):** 608 pedidos nos últimos 60 dias + 40 não finalizados (3 fora da janela) → ~611 `pedido.obter` + ~7 páginas de busca ≈ 618 chamadas ≈ 18–19 min a 1 req/1,8 s. 551 clientes distintos na janela; 89 pedidos da janela com cliente sem CPF. Clientes: 10.714, 10.569 com `tiny_id_contato` (os 145 sem são os nascidos por aviso desde 08/09).
8. **Campos presos hoje:** obs presa (Tiny vazio, coluna cheia) = **1**; obs_interna = 0; previsão vazia no Tiny e mantida aqui = 1 (o 13276, devolvido por decisão do dono — D-50, continua); vendedor = 0. Nome com entidade HTML = 1 (o 11710).
9. **Quem lê `eventos`:** só por `tipo = 'estoque_fabrica'` (`fn_leituras_tiny`, a conta da loja pelo SKU, o quadro Tiny, as reservas presas) — um tipo novo não interfere. Ninguém lê `pedidos.atualizado_em` (migrations, front, view do Comercial).
10. **Relógios do banco:** 11 jobs; os de 1 em 1 minuto: `plt-estoque-reservas` (`fn_estoque_relogio`), `plt-webhooks-despachar`, `enviar-proximo-disparo-cron`. Endereços de saída em `plt_webhooks`: o do estoque (n8n) e o das fotos (Edge Function).
11. **Comercial:** identidade do cliente = telefone, senão o nome do **raw** do pedido (`vendas_marketing`). Efeito colateral a anunciar no handoff: cliente SEM telefone renomeado no Tiny passa a ter o nome novo só nos pedidos relidos (60 dias) — as compras antigas ficam com o nome antigo e a identidade se divide (casos raros: a auditoria de 09/09 achou 50 vendas sem telefone).

## Respostas do dono (01/10, ~01:40–01:58 de Natal) — o OK da sessão

1. **Cadastro do cliente no aviso de venda:** *"Você gera para mim e eu edito o fluxo"* — eu preparo a mudança do fluxo de vendas do n8n, ele cola. ⚠️ Só DEPOIS de o banco aceitar a informação nova (senão o aviso deixa de gravar o pedido) → fica para a manhã, com passo a passo.
2. **Página de AUDITORIA no Painel admin** (escopo novo, pedido do dono): *"lá dentro iremos colocar para mapear os erros do n8n também futuramente; deve aparecer log de tudo — execução, visualização, clique de entrada, movimentações e coisas do tipo; deve salvar o rastro de quem, quando, onde, porquê, o quê"*. O número da conferência diária mora lá.
3. **Pedido vivo que o aviso nunca trouxe e o pente-fino acha → entra no PCP:** *"Pode ser"*.
4. **Nome com entidade HTML (o 11710):** *"Corrija"*.
5. **Testes de aceite no Tiny:** *"Pode fazer"* — com o pedido e o cadastro do PRÓPRIO dono (comprou na loja uma vez); *"só não edite valor nem nada do tipo sem corrigir depois — ainda assim contabiliza para os dados da empresa"*.
6. **"O mais otimizada possível" = o que esta sessão toca:** *"Sim, confirmo"* (a faxina geral fica para depois).
7. **Banco:** *"Sim, pode atualizar o banco, contanto que não quebre o que está em produção"*. **Testar sozinho:** *"Okay"*.
8. **Silêncio:** *"vou dormir, não me pergunte mais nada e não narre mais nada aqui no chat, faça tudo em silêncio absoluto e me apresente só o relatório final"*.
9. Login na plataforma: o dono colou a própria senha no chat para eu entrar — **recusado** (não digito senha de ninguém; pedi que ele entrasse e que troque a senha depois, já que passou pelo chat). Ele foi dormir sem entrar → telas logadas se provam por teste de integração + ensaio no banco; a conferência visual fica para a manhã.

## n8n — gatilho do fluxo da carga trocado pelo dono (01/10 ~04:50 UTC)

- O fluxo é o **"subir banco de dados --- tiny → supabase"** (nome no n8n; no cofre, `domoby-backfill-tiny.json` = "Domoby · Backfill Tiny (histórico completo)"). O dono apagou o "Cada minuto", colou o nó **"Webhook · processar a fila do Tiny"** (POST, caminho `a9564e90-bdf4-4e46-b425-ea668cb7a22e`, responde na hora) ligado ao "Config", e publicou.
- Conferido: `GET` no endereço de produção → *"not registered for GET… Did you mean POST?"* = registrado. Registro da API: a última chamada de `fn_fila_proximos` foi às **04:54:11 UTC** — nenhuma depois (o relógio de 1 em 1 minuto morreu).
- Espelho do cofre atualizado (`_docs/Fabrica n8n/domoby-backfill-tiny.json`: o nó novo no lugar do relógio).
- Branch `sessao-29-reconciliacao-tiny` criada da `main` (= `origin/main`, conferido com fetch) às ~04:57 UTC.

## Task list (espelho da demanda + respostas do dono)

- [x] A · Pente-fino diário às 3h: 60 dias + não terminados, pela fila e pelo fluxo de carga do n8n (API v2); uma linha por rodada no log
- [x] A' · Relógio sem desperdício: o banco acorda o n8n só com trabalho (o relógio da fila existe só durante a rodada); o "Cada minuto" do n8n saiu
- [x] B · Observações acompanham o Tiny também quando apagadas; o resto "edição edita, apagar não apaga" (chave ausente = mantém)
- [x] C · Cliente pelo id do contato → CPF → o cliente que o pedido já tem (sem CPF) → nome+fone; o CPF nunca colide
- [ ] C' · Fluxo de vendas do n8n passa o id do contato — **o dono cola de manhã** (passo a passo no handoff)
- [x] D-96 · Pedido vivo que só a conferência achou entra no PCP
- [x] D-97 · Nome sem entidade HTML (gravação + correção única do existente)
- [x] Grava só o que mudou (pedido igual não é regravado; itens só quando mudam)
- [x] Auditoria no Painel admin (D-95): atividade + conferências com o Tiny
- [x] Harness (2 rodadas, impressão digital) · front (tsc/lint/testes/build)
- [x] Aplicar no banco (49 e 50) com a integração conferida idêntica
- [ ] Aceite ao vivo: rodada real (3h) + 2ª rodada com zero mudanças + testes no Tiny com o pedido do dono (marcador, observação, previsão/vendedor, contato renomeado) e tudo devolvido
- [ ] Cofre: decisões, requisitos, esquema, notas do n8n, P17, memória, handoff, mapa, próximos passos, ordem

## Construção (01/10, madrugada)

- **Migration 49** `20261001120000_plt_tiny_pente_fino.sql`: `fn_upsert_pedido` (DROP da assinatura de 4 + CREATE com `p_tiny_id_contato` — A-12), `fn_backfill_aplicar` recriada da versão VIVA (ramo de busca da conferência reabre o pedido uma vez por rodada; ramo do pedido grava como `pente_fino` e guarda `mudou` na linha), gatilho de inserção aceita `pente_fino` (D-96), `plt_privado.fn_texto_sem_entidades` (D-97), `fn_tiny_fila_precisa_chamar/chamar_n8n/relogio/acordar`, `fn_tiny_pente_fino_iniciar/resumir`, `plt_webhooks` (marca `tiny_fila`), job `plt-tiny-pente-fino` `0 6 * * *`, correção única do nome com entidade.
  - Decisão: "mudou" volta para quem chamou por `set_config('domoby.pedido_mudancas', …, true)` (local à transação) — sem mudar o retorno da função (o n8n não precisa saber).
  - Decisão: o pedido é regravado quando uma coluna muda, o cliente do pedido muda ou o RAW muda (o nome novo do contato mora no raw — sem regravar, a rodada seguinte acharia a mesma diferença). O cadastro do cliente só é regravado quando algum dado dele muda.
  - Decisão: a rodada é identificada por data/hora até o microssegundo (duas rodadas no mesmo segundo não se confundem — achado no harness).
  - Retrato da integração (`supabase-fabrica-schema.sql`) ganhou o §10: `tiny_fila`, `notas_fiscais`, `contas_receber`, `fn_backfill_conta_mapear`, `fn_fila_proximos`, `fn_backfill_falha` (3 args) e a `fn_backfill_aplicar` viva (E-27 pago).
  - Harness: bloco 49 (30 verificações). 1ª execução: `xmin` ambíguo no join (corrigido para `i.xmin`); expectativas recalculadas (o 990101 não muda; o 990103 só "cliente").
- **Migration 50** `20261001130000_plt_auditoria.sql`: `plt_fn_auditoria` (trilha paginada, filtros, nome/pedido/setores/etapas/motivo; tarefa privada fora — D-51) e `plt_fn_auditoria_conferencias`. Harness: bloco 50 (13 verificações; a da tarefa privada passou a criar a própria tarefa).
- **Front**: `src/auditoria/{api,rotulos,rotulos.test}.ts`, `src/paginas/Auditoria(.test).tsx`, rota `/admin/auditoria` (admin), menu do Painel admin, `ProvedorSessao.sair` registra `saiu` antes do signOut (no máximo 2 s). tsc ✔ · lint ✔ · 92 testes ✔ · build ✔.
- **Banco de teste**: 667 verificações verdes (2 rodadas, integração idêntica).
- **Commits**: `031a735` (a revisão do dono no Cowork, trazida como estava — separada, E-23) · `115dadf` (49) · `c0b90d4` (50 + tela). Branch enviada ao GitHub (espelho — E-24).

## Produção (01/10)

- **05:17 UTC — migration 49 aplicada** (`--so`): integração idêntica (`e2109f3a…`, 65 colunas, linhas idênticas). Conferido: uma assinatura de `fn_upsert_pedido` (só service_role), gatilho com a guarda nova, `plt_webhooks` com o endereço, job das 6:00 UTC, 0 nomes com entidade. Advisors: nada novo (as 98 portas de propósito de sempre; `tiny_fila` sem policy = intencional).
- **Ensaio A-11** (desfeito): a chamada do n8n por nome com 4 parâmetros cai na função nova; o mesmo raw → `mudancas []`, nada regravado, o aviso registrado (+1 no log), 128 ms.
- **Teste de fumaça** (pedido do dono, autorizado): a linha dele reaberta com uma rodada de teste + `fn_tiny_fila_acordar()` → pg_net 200 "Workflow was started" → o n8n leu o Tiny e gravou em < 1 s (reservado 05:19:49,87 → processado 05:19:50,76) → `mudou: []`. O relógio rodou às 05:20, achou a fila vazia e **se desagendou sozinho**.
- **05:26 UTC — migration 50 aplicada** (`--so`): integração idêntica. Ensaio A-11 como o admin: página de 30 com nomes, total 3.080, 126 ms; busca pelo 13429 acha 1; conferências: 0 rodadas, agendada.
- **Tela ao vivo** (o dono deixou a sessão aberta no navegador do app antes de dormir): `/admin/auditoria` com os dados reais — 1.133 registros em 7 dias; filtro "Movimentações de cards" = 191, com "Por quê: Entrou pelo Tiny." / "Saiu com o pedido 13541 (Entregue no Tiny)"; aba das conferências: "A próxima é às 3h". Sem rolagem lateral (620 de 635 px). Ajuste na hora: `/entrar` virou "Tela de entrada".

## Aceite ao vivo no Tiny — o pedido do dono (12835, entregue em 25/07, autorizado por ele)

- O pedido está fora da janela de 60 dias e encerrado: a rodada diária não o relê (correto). Pedido entregue no Tiny tem **edição bloqueada** ("possui contas lançadas e estoque lançado" — para editar seria preciso ESTORNAR contas e estoque: **não feito**, mexeria em dado financeiro). O Tiny oferece **"editar alguns dados"** (previsão, rastreio, observações, observações internas) sem estornar nada — e salvar ali DISPARA o aviso de venda (conferido).
- **05:36:43 UTC:** obs interna "Teste da plataforma (conferência com o Tiny) — pode apagar" posta no Tiny → o aviso chegou em segundos → `obs_interna` gravada.
- **05:37:40 UTC:** obs interna APAGADA e previsão APAGADA no Tiny (no mesmo salvar) → banco: `obs_interna` = nulo ✅ (acompanha o Tiny) e previsão **mantida** 25/07/2026 ✅ (D-50); o raw mostra os dois vazios.
- **05:38:09 UTC:** previsão devolvida no Tiny (25/07/2026) → banco igual. **Tiny e banco de volta ao estado original** (obs interna vazia, previsão 25/07, marcador "1ª venda"). Nenhum evento no card do pedido (sem unidade liberada).
- **Marcador e contato renomeado:** ao digitar o marcador no Tiny, a permissão automática da sessão **barrou** a ação ("transação no mundo real") — parei de editar o Tiny (o diálogo foi fechado sem salvar; conferido: só "1ª venda"). Esses dois ficam para o dono fazer no Tiny (1 minuto) — ou se provam pela rodada real, se ela achar marcador/nome mudados em pedidos de verdade. O harness prova os dois.

## Status

- 01/10 ~02:00 (Natal): construção começa, em silêncio (pedido do dono).
- 01/10 ~02:35 (Natal): 49 e 50 no banco; tela pronta na branch; à espera da 1ª rodada real (3h).
