---
titulo: Supabase Fábrica — Esquema do Banco (FONTE DA VERDADE)
tipo: esquema
atualizado: 2026-11-18
tags: [supabase, fabrica, banco-de-dados, esquema]
---

# 🧬 Supabase Fábrica — Esquema do Banco

> [!danger] REGRA DE OURO — ler antes de mexer
> Esta nota é a **fonte da verdade** do que existe no banco. Antes de escrever qualquer SQL, query, node do n8n ou código que toque este Supabase, **leia esta nota primeiro e use exatamente os nomes que estão aqui** — nada de inventar tabela, coluna ou função "que provavelmente existe".
> Toda alteração no banco segue o ciclo: rodar o SQL no editor → atualizar o arquivo `supabase-fabrica-schema.sql` → **atualizar esta nota**. Se os três não contam a mesma história, esta nota manda.

**Aplicado no projeto em: 2026-08-17** (o dono rodou `supabase-fabrica-schema.sql` completo, sem erros).
Schema Postgres: **`public`** · Todas as tabelas com **RLS ligado e ZERO policies** — anon/authenticated não enxergam nada; só a `service_role` acessa.

> [!info] ↪️ 18/11/2026 (SESSAO-49) — este arquivo virou o ÍNDICE
> O esquema mora agora em `Supabase-fabrica/Banco/`, **uma nota por domínio**, com o texto original intacto. **Antes de qualquer SQL:** ache a tabela na lista abaixo (ou procure o nome com a busca nessa pasta) e leia a nota do domínio — não este índice inteiro. Alterou o banco → o bloco novo entra **na nota do domínio**. A lista abaixo é gerada por `node scripts/cofre/verificar.mjs --gerar`.

<!-- gerado:inicio -->
## As notas do banco, por domínio

- [[Banco - Cards e Eventos do Kanban]] (10.7 KB)
- [[Banco - Chat Tarefas Automacoes e Configuracoes]] (24.2 KB)
- [[Banco - Comercial]] (11.5 KB)
- [[Banco - Estoque e Reposicao]] (16.9 KB)
- [[Banco - Expedicao Devolucao e Cancelamento]] (19.1 KB)
- [[Banco - Filas e Integracoes Tiny e n8n 1]] (20.5 KB)
- [[Banco - Filas e Integracoes Tiny e n8n 2]] (18.3 KB)
- [[Banco - Integracao Tiny - Pedidos Clientes e Produtos]] (21.0 KB)
- [[Banco - Logistica ROTAS e Entregas 1]] (18.0 KB)
- [[Banco - Logistica ROTAS e Entregas 2]] (26.2 KB)
- [[Banco - PCP e Liberacao 1]] (13.8 KB)
- [[Banco - PCP e Liberacao 2]] (19.0 KB)
- [[Banco - PCP e Liberacao 3]] (5.5 KB)
- [[Banco - Plataforma - Visao Geral das Tabelas plt]] (8.0 KB)
- [[Banco - Setores Etapas e Execucao]] (12.2 KB)
- [[Banco - Tablet e TV]] (7.6 KB)
- [[Banco - Tempos e Paineis]] (21.1 KB)
- [[Banco - Usuarios Acesso e Logs]] (18.2 KB)

## Tabela → nota (99 tabelas criadas pelas migrations do repositório e pelo esquema-base)

A primeira nota é a que mais fala da tabela. Função, porta e gatilho: procure o nome na pasta `Supabase-fabrica/Banco/`.

- `clientes` → [[Banco - Integracao Tiny - Pedidos Clientes e Produtos]] · também em [[Banco - Comercial]], [[Banco - PCP e Liberacao 1]]
- `contas_receber` → [[Banco - Integracao Tiny - Pedidos Clientes e Produtos]] · também em [[Banco - Filas e Integracoes Tiny e n8n 1]], [[Banco - PCP e Liberacao 1]], [[Banco - Plataforma - Visao Geral das Tabelas plt]]
- `eventos` → [[Banco - Integracao Tiny - Pedidos Clientes e Produtos]] · também em [[Banco - Filas e Integracoes Tiny e n8n 1]], [[Banco - Estoque e Reposicao]], [[Banco - Filas e Integracoes Tiny e n8n 2]] e mais 1
- `gp_pcp_processados` → [[Banco - Integracao Tiny - Pedidos Clientes e Produtos]]
- `listas_disparo` → [[Banco - Comercial]]
- `listas_disparo_eventos` → [[Banco - Comercial]]
- `listas_disparo_membros` → [[Banco - Comercial]]
- `notas_fiscais` → [[Banco - Integracao Tiny - Pedidos Clientes e Produtos]] · também em [[Banco - PCP e Liberacao 1]], [[Banco - Plataforma - Visao Geral das Tabelas plt]]
- `pedido_itens` → [[Banco - Integracao Tiny - Pedidos Clientes e Produtos]] · também em [[Banco - Plataforma - Visao Geral das Tabelas plt]], [[Banco - Estoque e Reposicao]], [[Banco - PCP e Liberacao 1]]
- `pedidos` → [[Banco - Integracao Tiny - Pedidos Clientes e Produtos]] · também em [[Banco - PCP e Liberacao 1]], [[Banco - Chat Tarefas Automacoes e Configuracoes]], [[Banco - Cards e Eventos do Kanban]] e mais 8
- `plt_anexos` → [[Banco - Cards e Eventos do Kanban]] · também em [[Banco - Logistica ROTAS e Entregas 1]]
- `plt_automacao_execucoes` → [[Banco - Chat Tarefas Automacoes e Configuracoes]]
- `plt_automacoes` → [[Banco - Chat Tarefas Automacoes e Configuracoes]]
- `plt_auxilios` → [[Banco - Tablet e TV]]
- `plt_caminhoes` → [[Banco - Logistica ROTAS e Entregas 1]]
- `plt_campos` → [[Banco - Cards e Eventos do Kanban]] · também em [[Banco - Chat Tarefas Automacoes e Configuracoes]]
- `plt_campos_valores` → [[Banco - Chat Tarefas Automacoes e Configuracoes]]
- `plt_card_mensagens` → [[Banco - Chat Tarefas Automacoes e Configuracoes]]
- `plt_cards` → [[Banco - PCP e Liberacao 2]] · também em [[Banco - Chat Tarefas Automacoes e Configuracoes]], [[Banco - Setores Etapas e Execucao]], [[Banco - Cards e Eventos do Kanban]] e mais 11
- `plt_chat_conversas` → [[Banco - Chat Tarefas Automacoes e Configuracoes]]
- `plt_chat_mensagens` → [[Banco - Chat Tarefas Automacoes e Configuracoes]]
- `plt_chat_participantes` → [[Banco - Chat Tarefas Automacoes e Configuracoes]]
- `plt_chat_versoes` → [[Banco - Chat Tarefas Automacoes e Configuracoes]]
- `plt_chaves_api` → [[Banco - Filas e Integracoes Tiny e n8n 1]]
- `plt_comercial_clientes` → [[Banco - Comercial]]
- `plt_comercial_itens_mes` → [[Banco - Comercial]]
- `plt_comercial_mes` → [[Banco - Comercial]]
- `plt_comercial_pendentes` → [[Banco - Comercial]]
- `plt_comercial_vendas` → [[Banco - Comercial]]
- `plt_estoque_numeros` → [[Banco - Estoque e Reposicao]] · também em [[Banco - Expedicao Devolucao e Cancelamento]]
- `plt_etapas` → [[Banco - Setores Etapas e Execucao]] · também em [[Banco - Expedicao Devolucao e Cancelamento]], [[Banco - Filas e Integracoes Tiny e n8n 1]], [[Banco - Plataforma - Visao Geral das Tabelas plt]]
- `plt_etiquetas` → [[Banco - Chat Tarefas Automacoes e Configuracoes]]
- `plt_eventos` → [[Banco - Tempos e Paineis]] · também em [[Banco - Plataforma - Visao Geral das Tabelas plt]], [[Banco - Usuarios Acesso e Logs]], [[Banco - Cards e Eventos do Kanban]] e mais 9
- `plt_geocache` → [[Banco - Logistica ROTAS e Entregas 1]] · também em [[Banco - Logistica ROTAS e Entregas 2]]
- `plt_horarios_funcionamento` → [[Banco - Setores Etapas e Execucao]] · também em [[Banco - Tempos e Paineis]]
- `plt_itens_observacao` → [[Banco - PCP e Liberacao 2]]
- `plt_logs_atividade` → [[Banco - Chat Tarefas Automacoes e Configuracoes]] · também em [[Banco - Usuarios Acesso e Logs]], [[Banco - Estoque e Reposicao]], [[Banco - Expedicao Devolucao e Cancelamento]] e mais 4
- `plt_medicoes_web` → [[Banco - Usuarios Acesso e Logs]]
- `plt_metas` → [[Banco - Chat Tarefas Automacoes e Configuracoes]] · também em [[Banco - Logistica ROTAS e Entregas 1]]
- `plt_metas_eventos` → [[Banco - Chat Tarefas Automacoes e Configuracoes]]
- `plt_motivos` → [[Banco - Tempos e Paineis]] · também em [[Banco - Expedicao Devolucao e Cancelamento]], [[Banco - Logistica ROTAS e Entregas 1]], [[Banco - Logistica ROTAS e Entregas 2]] e mais 3
- `plt_notificacoes` → [[Banco - Logistica ROTAS e Entregas 2]] · também em [[Banco - Chat Tarefas Automacoes e Configuracoes]], [[Banco - Plataforma - Visao Geral das Tabelas plt]], [[Banco - Usuarios Acesso e Logs]]
- `plt_paradas_avulsas` → [[Banco - Logistica ROTAS e Entregas 2]]
- `plt_pausas_tempo` → [[Banco - Setores Etapas e Execucao]]
- `plt_pedido_datas` → [[Banco - Logistica ROTAS e Entregas 2]]
- `plt_pedido_enderecos` → [[Banco - PCP e Liberacao 2]]
- `plt_pedidos_excluidos_tiny` → [[Banco - Filas e Integracoes Tiny e n8n 1]] · também em [[Banco - Logistica ROTAS e Entregas 1]]
- `plt_pessoa_pausas` → [[Banco - Logistica ROTAS e Entregas 2]] · também em [[Banco - Setores Etapas e Execucao]]
- `plt_pin_tentativas` → [[Banco - Tablet e TV]] · também em [[Banco - Usuarios Acesso e Logs]]
- `plt_presenca_atual` → [[Banco - Logistica ROTAS e Entregas 2]] · também em [[Banco - Tablet e TV]]
- `plt_presenca_eventos` → [[Banco - Logistica ROTAS e Entregas 2]] · também em [[Banco - Tablet e TV]]
- `plt_presenca_saidas` → [[Banco - Logistica ROTAS e Entregas 2]]
- `plt_presenca_segmentos` → [[Banco - Logistica ROTAS e Entregas 2]] · também em [[Banco - Setores Etapas e Execucao]], [[Banco - Tablet e TV]]
- `plt_presencas` → [[Banco - Chat Tarefas Automacoes e Configuracoes]] · também em [[Banco - Usuarios Acesso e Logs]]
- `plt_produto_componentes` → [[Banco - Filas e Integracoes Tiny e n8n 2]]
- `plt_produtos_excluidos_tiny` → [[Banco - Filas e Integracoes Tiny e n8n 2]]
- `plt_programacao_equipes` → [[Banco - Logistica ROTAS e Entregas 1]]
- `plt_programacoes` → [[Banco - Logistica ROTAS e Entregas 1]] · também em [[Banco - Logistica ROTAS e Entregas 2]], [[Banco - Filas e Integracoes Tiny e n8n 1]]
- `plt_senha_pedidos` → [[Banco - Logistica ROTAS e Entregas 2]]
- `plt_setor_pins` → [[Banco - Tablet e TV]]
- `plt_setores` → [[Banco - Setores Etapas e Execucao]] · também em [[Banco - Estoque e Reposicao]], [[Banco - Logistica ROTAS e Entregas 2]], [[Banco - Chat Tarefas Automacoes e Configuracoes]] e mais 3
- `plt_sugestao_fatos` → [[Banco - Chat Tarefas Automacoes e Configuracoes]] · também em [[Banco - Plataforma - Visao Geral das Tabelas plt]]
- `plt_sugestoes` → [[Banco - Chat Tarefas Automacoes e Configuracoes]] · também em [[Banco - Plataforma - Visao Geral das Tabelas plt]]
- `plt_tarefas` → [[Banco - Chat Tarefas Automacoes e Configuracoes]] · também em [[Banco - Plataforma - Visao Geral das Tabelas plt]], [[Banco - Usuarios Acesso e Logs]]
- `plt_tempo_config` → [[Banco - PCP e Liberacao 2]] · também em [[Banco - Tempos e Paineis]]
- `plt_tempo_equipe` → [[Banco - PCP e Liberacao 2]] · também em [[Banco - Tempos e Paineis]]
- `plt_tempo_excecoes` → [[Banco - Tempos e Paineis]]
- `plt_tempo_horas_extras` → [[Banco - Tempos e Paineis]]
- `plt_tempo_modelo_chaves` → [[Banco - Tempos e Paineis]]
- `plt_tempo_modelos` → [[Banco - Tempos e Paineis]]
- `plt_tempo_montagem_pessoas` → [[Banco - Tempos e Paineis]]
- `plt_tempo_montagens` → [[Banco - Tempos e Paineis]]
- `plt_tempo_padrao` → [[Banco - Tempos e Paineis]]
- `plt_tempo_padrao_historico` → [[Banco - Tempos e Paineis]]
- `plt_tempo_passagem_equipe` → [[Banco - Tempos e Paineis]]
- `plt_tempo_passagens` → [[Banco - Tempos e Paineis]]
- `plt_tempo_recalculos` → [[Banco - Tempos e Paineis]]
- `plt_tempo_regras` → [[Banco - Tempos e Paineis]]
- `plt_tempo_resumo_modelo_dia` → [[Banco - Tempos e Paineis]]
- `plt_tempo_resumo_pessoa_dia` → [[Banco - Tempos e Paineis]]
- `plt_tempo_trechos` → [[Banco - Tempos e Paineis]]
- `plt_tempo_trello` → [[Banco - Tempos e Paineis]]
- `plt_tempos_pessoa_dia` → [[Banco - Setores Etapas e Execucao]] · também em [[Banco - Tablet e TV]], [[Banco - Tempos e Paineis]]
- `plt_tiny_carga_contagem` → [[Banco - Filas e Integracoes Tiny e n8n 2]] · também em [[Banco - Integracao Tiny - Pedidos Clientes e Produtos]]
- `plt_tiny_controle` → [[Banco - Filas e Integracoes Tiny e n8n 2]] · também em [[Banco - Integracao Tiny - Pedidos Clientes e Produtos]]
- `plt_tiny_estoque_fila` → [[Banco - Estoque e Reposicao]] · também em [[Banco - Filas e Integracoes Tiny e n8n 1]], [[Banco - Filas e Integracoes Tiny e n8n 2]]
- `plt_tiny_pedido_fila` → [[Banco - Logistica ROTAS e Entregas 1]] · também em [[Banco - PCP e Liberacao 2]]
- `plt_tiny_registros` → [[Banco - Filas e Integracoes Tiny e n8n 2]]
- `plt_tiny_registros_mes` → [[Banco - Filas e Integracoes Tiny e n8n 2]]
- `plt_usuario_setores` → [[Banco - Plataforma - Visao Geral das Tabelas plt]]
- `plt_usuarios` → [[Banco - Chat Tarefas Automacoes e Configuracoes]] · também em [[Banco - Usuarios Acesso e Logs]], [[Banco - Comercial]], [[Banco - Plataforma - Visao Geral das Tabelas plt]] e mais 3
- `plt_visualizacoes` → [[Banco - Plataforma - Visao Geral das Tabelas plt]] · também em [[Banco - Tempos e Paineis]]
- `plt_webhook_entregas` → [[Banco - Filas e Integracoes Tiny e n8n 1]]
- `plt_webhooks` → [[Banco - Filas e Integracoes Tiny e n8n 1]] · também em [[Banco - Logistica ROTAS e Entregas 1]], [[Banco - Tablet e TV]]
- `produtos` → [[Banco - Integracao Tiny - Pedidos Clientes e Produtos]] · também em [[Banco - Estoque e Reposicao]], [[Banco - Filas e Integracoes Tiny e n8n 1]], [[Banco - Filas e Integracoes Tiny e n8n 2]] e mais 1
- `tarifas_mensagem_whatsapp` → [[Banco - Comercial]]
- `tiny_auth` → [[Banco - Comercial]] · também em [[Banco - Filas e Integracoes Tiny e n8n 2]]
- `tiny_fila` → [[Banco - Integracao Tiny - Pedidos Clientes e Produtos]] · também em [[Banco - Filas e Integracoes Tiny e n8n 1]], [[Banco - Filas e Integracoes Tiny e n8n 2]]
- `webhook_eventos_crm` → [[Banco - Comercial]]
<!-- gerado:fim -->

## O que NÃO existe (para ninguém inventar)

↩️ **Revisado em 26/08/2026:** com a SESSAO-02 aplicada, agora existem sim views, triggers, um schema a mais (`plt_privado`), funções e policies — **todos da plataforma, com prefixo `plt_`**, listados na seção acima. O que continua valendo: **nada disso toca as tabelas da integração**, e do lado da integração continua não havendo view, trigger, policy, bucket de storage nem edge function. A tabela de usuários agora existe (`plt_usuarios`), da plataforma. Os pedidos da **GreenPallets NÃO entram em `pedidos`/`clientes`** — só o controle de dedup em `gp_pcp_processados` (escopo decidido em 17/08: conta GP alimenta apenas cards da PCP). Se algo disso mudar, registrar AQUI.

## Ver também

[[SUPA - Visao Geral]] · `supabase-fabrica-schema.sql` (o DDL executável, nesta pasta) · [[N8N - Migracao Supabase]]
