---
titulo: "Banco — Plataforma - Visao Geral das Tabelas plt"
tipo: esquema-dominio
dominio: plataforma
atualizado: 2026-11-18
tags: [supabase, banco-de-dados, esquema, dominio/plataforma]
---

# 🧬 Banco - Plataforma - Visao Geral das Tabelas plt

> Parte do esquema do banco, movida de [[SUPA - Esquema do Banco]] em 18/11/2026 sem reescrever (os blocos estão na ordem em que foram escritos — do mais antigo ao mais novo). **Os nomes de tabela, coluna e função saem daqui, nunca de memória.** Mudou o banco → o bloco novo entra no fim da nota do domínio.

## Tabelas da Plataforma de Produção (prefixo `plt_`) — aplicadas em 26/08/2026

> [!info] Onde está o DDL
> O SQL executável **não é duplicado aqui**: vive versionado e testado no repositório, em `supabase/migrations/*.sql` (15 migrations). O modelo explicado em português está em `docs/modelo-de-dados.md`. Duplicar criaria uma segunda fonte de verdade que envelhece sozinha ([[Memoria - Modelos Formulas e Possibilidades#M-4|M-04]]). Esta seção é o **inventário**: o que existe e onde achar.

Aplicado na SESSAO-02, com as tabelas da integração conferidas antes e depois — **estrutura com impressão digital idêntica e contagens intactas** (clientes 119 · pedidos 118 · pedido_itens 191 · eventos 448 · gp 1).

| Tabela | O que guarda |
|---|---|
| `plt_usuarios` | pessoas; `auth_user_id` **opcional** (operador de tablet pode não ter login — [[D-006 - Dispositivos tablet PC fixo por setor E celular pessoal\|D-06]]); `pin_hash` guarda HASH. **↪️ SESSAO-03 (26/08, [[D-021 - Identidade e acesso uma tabela matricula senha padrao\|D-21]]):** ganhou `cpf` (obrigatório, **SELECT revogado da API**), `usuario` (login por usuário OU e-mail), `matricula` (`MDM-XXX-NNN`, gerada por trigger `fn_gerar_matricula`), `senha_padrao` (troca obrigatória no 1º login), `convite_token` (**SELECT revogado**) e `convite_usado_em`. Escrita pelo navegador: **só `update(nome, telefone)`** — o resto passa pela Edge Function. **↪️ SESSAO-26 (migration 38, [[D-068 - Dados sensiveis do cadastro fora da API\|D-68]]):** leitura pelo navegador **por coluna** — `cpf`, `pin_hash`, `convite_token` e a nova `data_nascimento` fora da API (antes o grant de tabela do Supabase anulava os revoke por coluna — [[Memoria - Acesso Seguranca e Credenciais#E-50\|E-50]]) |
| `plt_usuario_setores` | vínculo pessoa ↔ setor, com `lider_do_setor` |
| `plt_setores` | setores; `papel_no_fluxo` = `entrada`/`producao`/`terminal` — índice único garante **uma só entrada** ([[D-013 - Entrada unica e saidas terminais do fluxo\|D-13]]). **↪️ 28/09 (migration 40, [[D-072 - Minimo e capacidade do galpao na plataforma a sugestao\|D-72]]):** `capacidade_pecas` (integer, check > 0; no ESTOQUE = quantas peças cabem no galpão — o teto da sugestão de mínimo) |
| `plt_etapas` | etapas internas de cada setor. **SEM SEED** ([[D-014 - Etapas internas cadastro livre cada uma com timer proprio\|D-14]]). `eh_fila` marca onde o card espera sem dono. **↪️ 28/08/2026: o DONO cadastrou as etapas oficiais dos 7 setores de produção** (lista do ClickUp, via SQL aprovado na conversa — as etapas "A …" são a fila de cada setor); ESTOQUE/ROTAS seguem sem etapas |
| `plt_cards` | cards `pedido`/`unidade` ([[D-001 - Unidade do card hibrido\|D-01]]). FK para `pedidos(id)`. ⚠️ **sem FK para `pedido_itens`** — ver aviso |
| `plt_eventos` | **APPEND-ONLY** (RNF-05). A tabela-mãe: tempo, fila e qualidade derivam daqui |
| `plt_notificacoes` | avisos a líder/admin ([[D-009 - Qualidade em 3 estados em TODA transicao com dupla atestacao\|D-09]] / Q-18) |
| `plt_tarefas` | afazeres e delegação (RF-40 a RF-43) |
| `plt_visualizacoes` | painéis salvos (RF-33) |
| `plt_sugestoes` | **SESSAO-46 ([[D-260 - Tech Sugestao de melhoria o quadro que toda a equipe acompanha\|D-260]]):** sugestões de melhoria do quadro Tech — PROJEÇÃO escrita só pelo gatilho dos fatos; fechada à API (só portas) |
| `plt_sugestao_fatos` | **SESSAO-46:** a história de cada sugestão — **APPEND-ONLY** por gatilho |

**Visões** (derivadas de evento, nada guardado — todas com `security_invoker = on`):
`plt_vw_permanencias` (tempo por etapa; `eh_fila` separa o que é do SETOR) · `plt_vw_execucoes` (o tempo que tem dono) · `plt_vw_qualidade_transicoes` (dupla atestação da D-09 com divergência calculada).

**Funções `plt_fn_*` em `public` (SESSAO-04, migration 13 — aplicada em 27/08/2026):** a **porta de leitura do kanban**, endpoints REST **de propósito** (o WARN dos advisors sobre "security definer executável por authenticated" nessas é o desenho intencional): `plt_fn_pedidos_kanban` (resumo paginado com `unidades_liberadas`) · `plt_fn_pedido_itens_kanban` (itens em unidades k/n **por item**, regra do n8n) · `plt_fn_expedicao_kanban` (reagrupamento D-01/D-13) · `plt_fn_pedido_unidades` (onde está cada unidade). **↪️ SESSAO-05 (migration 14) somou duas:** `plt_fn_linha_tempo_card` (história completa do card com nomes — gate: quem vê o card/expedição) e `plt_fn_estornar_evento` (estorno pela interface; o gate de verdade vive no trigger). Total após a SESSAO-05: 6 WARN (**↪️ 8 desde a SESSAO-06**, com as 2 RPCs de qualidade). Salvaguardas [[Memoria - Banco e SQL 1#E-11|E-11]]: `search_path` fixo, execute revogado de public/anon, gate por usuário ativo DENTRO da função (expedição: admin/entrada/terminal), zero dado pessoal/financeiro do cliente. **As tabelas da integração continuam sem policy — o navegador nunca as lê direto.**

**21 políticas de RLS**: operador vê os setores dele, líder vê o setor completo, admin vê tudo. `plt_eventos` **não tem política de UPDATE nem de DELETE**.

> [!danger] Dois avisos que valem ouro
> **1.** `plt_cards` **não** tem foreign key para `pedido_itens`, e isso é decisão, não esquecimento: `fn_upsert_pedido` faz `delete from pedido_itens` e regrava tudo a **cada** atualização de pedido vinda do Tiny. Uma FK apontando para lá faria **toda atualização de pedido falhar em produção**. O item é guardado como snapshot. **Não "conserte" isso.**
> **2.** O append-only de `plt_eventos` é garantido por **trigger**, não por RLS — porque a `service_role` (a chave que o n8n usa) **ignora RLS**. Testado no banco real: `UPDATE` e `DELETE` recusados.

**Produção de ponta a ponta (SESSAO-30 — migrations 56 a 62, aplicadas em 08/10/2026 uma a uma via `--so`, sob a ordem do dono de seguir sem perguntar; integração idêntica `e2109f3a…`/65 colunas e linhas idênticas em todas; [[D-113 - Entregue e um fato so dos dois lados e entregue no Tiny fecha|D-113]]…[[D-119 - Os numeros do estoque ficam PRONTOS no banco o ranking|D-119]]):** 30 → **35 tabelas `plt_`**.

- **77 `20261016020000_plt_banco_indices_politicas.sql`** (SESSAO-32 §1.6 — Lei §7.2/§7.3/§7.5; aplicada em 16/10 ~00:38 UTC, `--so`, integração idêntica): **29 índices** nas chaves estrangeiras sem índice (as 4 de `contas_receber`/`notas_fiscais` esperam o OK do dono — cópias do Tiny); helpers **`plt_privado.fn_setores_que_lidero()`** (a regra de `fn_eh_lider_de`, uma vez por consulta) e **`fn_chat_minhas_conversas()`** (a de `fn_chat_participa`); **todas as regras de acesso** de `public` reescritas com o MESMO resultado — função de sessão em `(select …)`, conjunto por `= any (array(select …))`, e as **9 permissivas duplicadas** desfeitas (as "ALL" de escrita viraram `_insere`/`_edita`/`_exclui`; leitura com uma regra só; em `plt_usuarios`, `plt_usuarios_admin_escreve` + `plt_usuarios_edita_a_si` → `plt_usuarios_admin_insere` · `plt_usuarios_edicao` (admin ou a própria linha) · `plt_usuarios_admin_exclui`); storage (`plt_imagens_*`) e `realtime.messages` (`plt_chat_ouvir`) embrulhados também. Prova no banco real: "o que cada pessoa enxerga" (6 pessoas × 32 tabelas, contagem + md5 das chaves) **idêntico** antes e depois. **Job `plt-cron-historico-limpar`** `20 4 * * *` (04:20 UTC): apaga de `cron.job_run_details` o que passou de 7 dias. Advisors: chaves sem índice 33 → 4; permissivas duplicadas 9 → 0; segurança sem item novo. Políticas de RLS em `public`: 49 → 64.
