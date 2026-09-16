---
titulo: Supabase Fábrica — Esquema do Banco (FONTE DA VERDADE)
tipo: esquema
atualizado: 2026-09-15
tags: [supabase, fabrica, banco-de-dados, esquema]
---

# 🧬 Supabase Fábrica — Esquema do Banco

> [!danger] REGRA DE OURO — ler antes de mexer
> Esta nota é a **fonte da verdade** do que existe no banco. Antes de escrever qualquer SQL, query, node do n8n ou código que toque este Supabase, **leia esta nota primeiro e use exatamente os nomes que estão aqui** — nada de inventar tabela, coluna ou função "que provavelmente existe".
> Toda alteração no banco segue o ciclo: rodar o SQL no editor → atualizar o arquivo `supabase-fabrica-schema.sql` → **atualizar esta nota**. Se os três não contam a mesma história, esta nota manda.

**Aplicado no projeto em: 2026-08-17** (o dono rodou `supabase-fabrica-schema.sql` completo, sem erros).
Schema Postgres: **`public`** · Todas as tabelas com **RLS ligado e ZERO policies** — anon/authenticated não enxergam nada; só a `service_role` acessa.

## Tabela `clientes`

Identidade do cliente: `cpf_cnpj` quando existe (índice único parcial); fallback nome+fone (resolvido dentro da função de upsert).

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | bigint identity **PK** | |
| `cpf_cnpj` | text | único quando não vazio (`clientes_cpf_cnpj_uq`, índice parcial) |
| `nome` | text not null default '' | |
| `fone` | text | indexado (`clientes_fone_idx`) |
| `email` | text | |
| `endereco` / `numero` / `complemento` / `bairro` / `cidade` / `uf` / `cep` / `rg` | text | `numero` e `cep` são TEXTO de propósito (preserva "S/N", máscara de CEP) |
| `tiny_id_contato` | bigint | `dados.idContato` do webhook, quando capturado |
| `criado_em` / `atualizado_em` | timestamptz default now() | |

## Tabela `pedidos`

Chave natural: **`numero`** (unique). `tiny_id` = id interno do Tiny — único quando presente (`pedidos_tiny_id_uq`), **NULL nos pedidos do backfill** (a planilha nunca guardou).

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | bigint identity **PK** | |
| `tiny_id` | bigint | id interno do Tiny — o que a API `pedido.alterar.situacao` exige |
| `numero` | integer **unique not null** | número visível (13093…) |
| `cliente_id` | bigint FK → `clientes.id` | |
| `situacao` | text | código v2: `aberto`, `aprovado`, `preparando_envio`, `faturado`, `pronto_envio`, `enviado`, `entregue`, `nao_entregue`, `cancelado` — indexado |
| `data_pedido` / `data_prevista` | date | convertidas de dd/mm/yyyy na função |
| `total_produtos` | numeric(12,2) | = "VALOR TOTAL" da planilha (bruto) |
| `total_pedido` | numeric(12,2) | = "TOTAL"/"TOTAL 2" (líquido) |
| `valor_frete` | numeric(12,2) | |
| `forma_pagamento` / `meio_pagamento` / `forma_envio` | text | |
| `qtd_parcelas` | integer | |
| `parcelas` | jsonb | array cru da API |
| `marcadores` | text[] | descrições extraídas |
| `obs` / `obs_interna` | text | |
| `endereco_entrega` | jsonb | quase sempre vazio (sem fallback — igual ao Plugga) |
| `codigo_rastreamento` / `url_rastreamento` | text | |
| `vendedor` / `ecommerce` | text | `nome_vendedor` / `nome_ecommerce` da API |
| `raw` | jsonb | **o `retorno.pedido` INTEIRO da API** — nada se perde |
| `origem` | text default 'webhook' | `webhook` \| `backfill` |
| `criado_em` / `atualizado_em` | timestamptz | |

Índices: `pedidos_situacao_idx`, `pedidos_data_idx` (data_pedido), `pedidos_cliente_idx`.

## Tabela `pedido_itens`

Uma linha por item. **PK composta (`pedido_id`, `seq`)** · FK `pedido_id` → `pedidos.id` **on delete cascade**.

| Coluna | Tipo | Observação |
|---|---|---|
| `pedido_id` | bigint | |
| `seq` | integer | ordem do item no pedido (1, 2, 3…) |
| `id_produto` | bigint | id do produto no Tiny |
| `codigo` | text | **SKU em texto — "061" fica "061"**, indexado (`pedido_itens_codigo_idx`) |
| `descricao` / `unidade` | text | |
| `quantidade` | numeric(10,2) | |
| `valor_unitario` | numeric(12,2) | |

Na atualização de um pedido, os itens são **apagados e regravados** (o payload da API sempre traz todos).

## Tabela `gp_pcp_processados` — ✅ aplicada (conferida no banco em 26/08/2026, 1 linha)

Controle do **polling da GreenPallets** (conta Tiny parceira, plano Crescer, sem webhook). O workflow agendado tenta inserir cada pedido aqui ANTES de criar os cards ("claim-first" com `Prefer: resolution=ignore-duplicates`): inseriu → pedido novo, cria cards; resposta vazia → já processado, ignora. **Para reprocessar um pedido de propósito: apagar a linha dele.**

| Coluna | Tipo | Observação |
|---|---|---|
| `tiny_id` | bigint **PK** | id interno do pedido na conta GreenPallets |
| `numero` | integer not null | número visível na conta GP |
| `processado_em` | timestamptz default now() | |

RLS ligado, sem policies (padrão da casa). ✏️ **Quando o dono rodar o §7 do `.sql`, trocar este aviso por "aplicado em AAAA-MM-DD".**

## Tabela `eventos`

Log permanente de cada chamada de upsert (o n8n poda execuções em 7 dias; isto fica).

| Coluna | Tipo |
|---|---|
| `id` | bigint identity PK |
| `tipo` | text (`inclusao_pedido` / `atualizacao_pedido` / `backfill`) |
| `tiny_id` / `numero` | bigint / integer |
| `situacao` | text |
| `recebido_em` | timestamptz default now() |

## Função `fn_upsert_pedido(p jsonb, p_tipo text, p_tiny_id bigint, p_origem text) → bigint`

A **única porta de escrita** do banco. `security definer`, execute **revogado** de anon/authenticated — só a service_role chama.

O que faz, em uma transação: resolve/atualiza o cliente (por `cpf_cnpj`, fallback nome+fone, senão cria) → upsert do pedido por `numero` (**`coalesce`: campo novo vazio NÃO apaga valor existente** — por isso webhook e backfill convivem em qualquer ordem) → apaga e regrava os itens → insere no log `eventos` → devolve o `id` do pedido.

Chamada: `POST {URL}/rest/v1/rpc/fn_upsert_pedido` com body `{"p": <retorno.pedido cru>, "p_tipo": "...", "p_tiny_id": 123, "p_origem": "webhook"}`.

## Tabelas da Plataforma de Produção (prefixo `plt_`) — aplicadas em 26/08/2026

> [!info] Onde está o DDL
> O SQL executável **não é duplicado aqui**: vive versionado e testado no repositório, em `supabase/migrations/*.sql` (15 migrations). O modelo explicado em português está em `docs/modelo-de-dados.md`. Duplicar criaria uma segunda fonte de verdade que envelhece sozinha (M-04). Esta seção é o **inventário**: o que existe e onde achar.

Aplicado na SESSAO-02, com as tabelas da integração conferidas antes e depois — **estrutura com impressão digital idêntica e contagens intactas** (clientes 119 · pedidos 118 · pedido_itens 191 · eventos 448 · gp 1).

| Tabela | O que guarda |
|---|---|
| `plt_usuarios` | pessoas; `auth_user_id` **opcional** (operador de tablet pode não ter login — D-06); `pin_hash` guarda HASH. **↪️ SESSAO-03 (26/08, D-21):** ganhou `cpf` (obrigatório, **SELECT revogado da API**), `usuario` (login por usuário OU e-mail), `matricula` (`MDM-XXX-NNN`, gerada por trigger `fn_gerar_matricula`), `senha_padrao` (troca obrigatória no 1º login), `convite_token` (**SELECT revogado**) e `convite_usado_em`. Escrita pelo navegador: **só `update(nome, telefone)`** — o resto passa pela Edge Function |
| `plt_usuario_setores` | vínculo pessoa ↔ setor, com `lider_do_setor` |
| `plt_setores` | setores; `papel_no_fluxo` = `entrada`/`producao`/`terminal` — índice único garante **uma só entrada** (D-13) |
| `plt_etapas` | etapas internas de cada setor. **SEM SEED** (D-14). `eh_fila` marca onde o card espera sem dono. **↪️ 28/08/2026: o DONO cadastrou as etapas oficiais dos 7 setores de produção** (lista do ClickUp, via SQL aprovado na conversa — as etapas "A …" são a fila de cada setor); ESTOQUE/ROTAS seguem sem etapas |
| `plt_cards` | cards `pedido`/`unidade` (D-01). FK para `pedidos(id)`. ⚠️ **sem FK para `pedido_itens`** — ver aviso |
| `plt_eventos` | **APPEND-ONLY** (RNF-05). A tabela-mãe: tempo, fila e qualidade derivam daqui |
| `plt_notificacoes` | avisos a líder/admin (D-09 / Q-18) |
| `plt_tarefas` | afazeres e delegação (RF-40 a RF-43) |
| `plt_visualizacoes` | painéis salvos (RF-33) |

**Visões** (derivadas de evento, nada guardado — todas com `security_invoker = on`):
`plt_vw_permanencias` (tempo por etapa; `eh_fila` separa o que é do SETOR) · `plt_vw_execucoes` (o tempo que tem dono) · `plt_vw_qualidade_transicoes` (dupla atestação da D-09 com divergência calculada).

**Schema `plt_privado`** — 9 funções, **fora da API REST de propósito**: `fn_marcar_atualizacao`, `fn_evento_imutavel`, `fn_projetar_posicao`, `fn_usuario_atual`, `fn_eh_admin`, `fn_setores_do_usuario`, `fn_eh_lider_de`, (SESSAO-03) `fn_gerar_matricula` + sequence `matricula_seq` e (SESSAO-04) `fn_pode_ver_expedicao`. O Supabase publica o schema `public` inteiro como API; função criada lá vira endpoint `/rest/v1/rpc` sem ninguém pedir.

**Execução e estorno (SESSAO-05, migration 14 — aplicada em 27/08/2026, D-24):** `plt_setores` ganhou `limite_execucoes_por_pessoa` (null = sem limite); `plt_eventos` ganhou o tipo **`estorno`** (anula sem apagar, via `evento_referencia_id`; só o ÚLTIMO gesto de execução; líder do setor do card ou admin). Regras por **trigger** `fn_validar_execucao` em `plt_privado` (valem até para a service_role — M-14): iniciar obrigatório antes de finalizar, execução exige pessoa, mesma pessoa não inicia o mesmo card 2×, limite por setor, e o trigger preenche setor/etapa de origem nos gestos. `fn_projetar_posicao` agora trata transferência (iniciar por outra pessoa troca o executor) e estorno (reprojeta executor via `fn_executor_pelo_log`). **`plt_vw_execucoes` foi recriada** (drop+create — E-17): fecha em finalizada, transferência OU movimentação (D-24), ignora estornados, setor/etapa da ÉPOCA; coluna nova `encerramento`. Helpers novos em `plt_privado`: `fn_evento_estornado`, `fn_executor_pelo_log`, `fn_validar_execucao`.

**Qualidade nas transições (SESSAO-06, migration 15 — aplicada em 27/08/2026, D-09/D-25):** `plt_etapas` ganhou **`eh_danificado`** (etapa especial garantida por setor via `fn_garantir_etapa_danificado`, criação preguiçosa; índice único parcial — uma por setor). Regras por **trigger** em `plt_privado` (M-14): `fn_validar_qualidade` (BEFORE — mover entre setores saindo de **produção** pela interface exige `qualidade_marcada` vinculada por `evento_referencia_id`, da mesma transição e do mesmo autor, nunca reaproveitada; saída de PCP/terminal e origem api/automacao passam livres — RF-86/D-25; parecer responde só à **chegada atual**, uma vez; **iniciar exige o parecer** quando a chegada teve marcação) e `fn_reagir_qualidade` (AFTER — parecer 🔴 gera `movimentacao_etapa` automática para a etapa DANIFICADO; marcação 🟡/🔴 e parecer divergente notificam **líderes dos 2 setores + admins, excluindo o autor**; chegada em **ESTOQUE** notifica admins; cada lote de avisos vira evento `notificacao_enviada` com os destinatários em `dados`). Helper `fn_rotulo_estado`. **↪️ RPCs novas em `public` (E-11):** `plt_fn_mover_card` (marcação + movimentação numa transação) e `plt_fn_registrar_parecer`. Total agora: **8 WARN esperados** nos advisors.

**Tablet, controle de tempo e imagens (SESSAO-07, migration 16 — aplicada em 28/08/2026, D-27/D-28/D-29):** mensagens de erro das funções **recriadas sem códigos internos** (D-27 — `fn_gerar_matricula`, `fn_validar_execucao`, `fn_validar_qualidade`, `fn_reagir_qualidade`); `plt_fn_mover_card` e `plt_fn_registrar_parecer` **recriadas com `p_operador_id`** (drop+create — assinatura nova; o autor do gesto passa a ser o operador do PIN quando informado, com gate: pessoa ativa que trabalha no setor envolvido, ou admin). Tabelas novas: **`plt_horarios_funcionamento`** (horário por setor E por usuário; dia_semana 0=domingo) e **`plt_pausas_tempo`** (pausa aberta `fim null`, ou retroativa) — RLS: leitura authenticated, escrita só admin; NADA toca eventos, o desconto é só no cálculo via **`plt_privado.fn_tempo_util(inicio, fim, setor, usuario)`** (multirange; fuso America/Fortaleza; interseção setor∩usuário − pausas). `plt_cards` entrou na **publicação `supabase_realtime`**; bucket de storage **`plt-imagens`** (público para leitura; escrita admin/líder; caminho `produtos/{codigo}/…` — a futura biblioteca de peças). Total de tabelas plt_: **11**; policies: **25**.

**Entrada automática de pedidos (SESSAO-09, migration 17 — aplicada em 28/08/2026, D-31):** trigger **`plt_pedidos_reagir`** em `public.pedidos` (AFTER INSERT/UPDATE — o ÚNICO objeto da plataforma que vive numa tabela da integração; não altera linha nenhuma e o corpo roda inteiro sob `exception when others → warning`, para NUNCA derrubar `fn_upsert_pedido`): pedido novo → card de pedido no PCP + `card_criado` origem `automacao`; atualização REAL com unidades liberadas → evento **`pedido_atualizado`**; cancelamento → evento **`pedido_cancelado`** (+ aviso aos admins quando há produção em andamento). Índice único **`plt_cards_pedido_unico`** (um card de pedido por pedido — idempotência de reenvio). Tipos novos no check de `plt_eventos`. `plt_fn_pedidos_kanban` e `plt_fn_expedicao_kanban` **recriadas** (drop+create — E-17 vale para função) com `alterado_apos_liberacao` (+ `situacao` na expedição).

**Tarefas e delegação (SESSAO-12, migrations 20 e 21 — aplicadas em 28/08/2026, D-34):** `plt_setores.modo_delegacao` (desativada/direta/aleatoria — **padrão desativada**; a migration 21 alinhou a coluna que OUTRA sessão criara com desenho divergente — E-20); `plt_cards.responsavel_id` (projeção do evento `delegacao` — zera ao mudar de setor); tabela **`plt_presencas`** (heartbeat; "logado agora" = 15 min); `plt_tarefas.iniciada_em` (timer OPCIONAL). Triggers novos em plt_eventos: `fn_validar_delegacao` (direta = líder do setor do card/admin; responsavel ativo), `fn_sortear_delegacao` (AFTER chegada em setor aleatório: só presentes, menor carga, avisa no sino) e `fn_avisar_delegado`. `fn_projetar_posicao` recriada (projeta responsável). ⚠️ E-19: os checks de tipo das migrations antigas viraram `not valid` (reaplicação em banco que já viveu o futuro); a mais nova valida.

**API, webhooks e ROTAS (SESSAO-11, migration 19 — aplicada em 28/08/2026, D-33):** tabelas **`plt_chaves_api`** (só hash sha256 + prefixo; escopo leitura/escrita; RLS admin), **`plt_webhooks`** e **`plt_webhook_entregas`** (fila; trigger `plt_eventos_webhooks` enfileira; despacho por `plt_privado.fn_despachar_webhooks` via **pg_net**, agendado pelo **pg_cron** — job `plt-webhooks-despachar`, 1/min; extensões habilitadas nesta sessão). Tipos novos: `card_arquivado` (→ projeção **`plt_cards.arquivado_em`** — exclusão lógica; leituras filtram) e `pedido_entregue`; validação `fn_validar_api` (arquivar = admin/API; entregar = gesto humano da logística). Funções: **`plt_fn_rotas`** (entregas por pedido completo, COM endereço/contato do cliente — exceção deliberada, gate da logística) e **`plt_fn_registrar_entrega`** (recusa pedido incompleto e entrega dupla). Total: **16 WARN esperados** nos advisors. **Edge Function `api`** (v1, `verify_jwt=false` — autenticação por chave própria): CRUD de cards/movimentação/consulta, código em `supabase/functions/api/index.ts`, guia em `docs/api.md`. ⚠️ `pedido_entregue` NÃO toca o Tiny (automação ClickUp→Tiny intocada).

**Dashboards (SESSAO-10, migration 18 — aplicada em 28/08/2026, D-32):** helper `plt_privado.fn_setores_dashboard` (admin=tudo, líder=setores que lidera, operador=nada) + **6 portas de leitura** em `public` (endpoints de propósito — E-11; +6 WARN esperados, total **14**): `plt_fn_dash_execucoes` (lista detalhada, paginada, duração bruta E útil — D-29) · `plt_fn_dash_tempos_setor` (fila vs execução clipadas ao período, bruto/útil, soma — D-02) · `plt_fn_dash_tempos_pessoa` · `plt_fn_dash_tempos_item` (média por unidade) · `plt_fn_dash_qualidade` (🟢🟡🔴 entregues, divergências contra/apontadas — RF-85) · `plt_fn_dash_estoque` (RF-14).

**Navegação, perfil e trilha de atividade (SESSAO-13, migration 22 — aplicada em 28/08/2026, D-40/D-41/D-43):** `plt_usuarios` ganhou **`tema`** (not null, default `claro`, check nos 8 temas: claro/gelo/areia/dourado/ardosia/grafite/escuro/meia-noite) e **`foto_caminho`** (bucket `plt-imagens`, pasta `perfis/{id}/…`) — as duas entraram no `grant update` do authenticated (a policy `edita_a_si` limita à própria linha). Tabela nova **`plt_logs_atividade`** (quem, quando, ação, rota, contexto) — **APPEND-ONLY por trigger** (`fn_log_imutavel`, vale até para a service_role); RLS: cada um lê os próprios, admin lê tudo, insert só em nome próprio. A trilha se alimenta sozinha: trigger em `plt_eventos` (toda mutação do kanban), em `plt_tarefas` (criada/iniciada/concluída/reatribuída) e em `plt_usuarios` (nomes dos campos alterados, nunca valores); RPC **`plt_fn_registrar_log`** (endpoint de propósito — +1 WARN esperado, total **17**) para navegação do navegador; a Edge Function grava `entrou` e `senha_alterada`. Policies de storage `plt_imagens_perfil_proprio*`: cada um escreve só na própria pasta de foto. **Edge Function `autenticacao` v3**: ações novas `atualizar-perfil` (nome/login/e-mail/fone do próprio — e-mail atualiza também o auth, com rollback) e `alterar-senha` (exige a senha atual). ⚠️ E-21: em PL/pgSQL, acrescentar a text[] é `array_append`, nunca `|| 'texto'`.

**Metas do Meu Painel (SESSAO-14, migrations 23 e 24 — aplicadas em 01/09/2026, D-37):** tabelas novas **`plt_metas`** (indicador `unidades`/`tarefas`/`tempo_util` · período `diaria`/`semanal`/`mensal` · `alvo` numeric — horas quando tempo_util · dono = `usuario_id` XOR `setor_id` por check · `encerrada_em` definitivo) e **`plt_metas_eventos`** (história criada/alterada/encerrada, **append-only por trigger** `fn_meta_evento_imutavel`). Triggers em `plt_privado`: `fn_preparar_meta` (autor da sessão; meta encerrada não se edita; dono não muda) e `fn_registrar_meta_evento` (história + trilha `plt_logs_atividade` no mesmo gesto — D-40). RLS (4 policies): admin tudo · pessoa a própria · **membros leem a meta do setor** · líder cria/edita no território dele · sem DELETE. Porta **`plt_fn_metas_painel`** (endpoint de propósito — +1 WARN, total **18**): metas visíveis com janela corrente em **America/Fortaleza** (semana começa na SEGUNDA — mudar é mexer só nela) e progresso calculado: unidades = execuções ENCERRADAS na janela (qualquer encerramento — decisão do dono 01/09), tarefas = `concluida_em` na janela, tempo_util = horas úteis via `fn_tempo_util`. **A migration 24 espelha no repo os 2 gatilhos blindados de `pedidos`** (ver ⭐ abaixo) — em 01/09 o banco foi encontrado com o gatilho antigo SEM guarda ressuscitado por reaplicação (E-24) e ~163 cards históricos no PCP (limpeza pendente de decisão do dono).

**Logística, ROTAS e caminhões (SESSAO-15, migration 25 — aplicada em 08/09/2026, D-38/D-39/D-45):** tabelas novas **`plt_caminhoes`** (nome, placa única sem diferenciar caixa, capacidade texto, `foto_caminho` em `caminhoes/{id}/…`, `arquivado_em`; RLS: leitura por qualquer ativo, escrita só admin; trigger `fn_bloquear_exclusao_caminhao` recusa DELETE de caminhão com programação — "arquive em vez de excluir"; trigger `fn_logar_caminhao` → trilha), **`plt_programacoes`** (um pedido lançado × `data_entrega` × caminhão — UNIQUE por card; editável de propósito, reprogramável até a entrega; sem policy de escrita: só as RPCs escrevem; trigger `fn_logar_programacao` → `entrega_programada/reprogramada`, `programacao_removida`) e **`plt_geocache`** (`chave` = md5 do endereço normalizado calculado no banco por `plt_privado.fn_endereco_geocodificavel`, latitude/longitude, `resolvido`, `consultado_em`; escrita só pela Edge Function `geocodificar` com a chave de serviço). `plt_cards` ganhou **`id_producao`** (texto livre — Q-63; NÃO é projeção de evento, edita-se por RPC com log) e **`lancado_rotas_em`** (projeção do evento novo **`pedido_lancado_rotas`**). `fn_projetar_posicao` recriada (projeta o lançamento; **`concluido_em` passou a refletir só o terminal ATUAL**). `fn_validar_api` recriada: `card_arquivado` também pela logística quando a peça está em DANIFICADO; `pedido_lancado_rotas` só por pessoa da logística/admin no card de pedido. Helpers em `plt_privado`: **`fn_situacao_normalizada`** (o Tiny grava a DESCRIÇÃO — ver correção de 08/09 abaixo), `fn_eh_logistica(uuid)`. **`fn_reagir_pedido` recriada com o cancelamento normalizado** (a S09 comparava com `'cancelado'` e nunca disparava) e os **2 gatilhos de `pedidos` recriados com a guarda `translate(...)`** — o espelho fiel do que produção já tinha (E-25). RPCs novas em `public` (endpoints de propósito — +10 WARN, total **28**): `plt_fn_estoque`, `plt_fn_definir_id_producao`, `plt_fn_pedidos_aguardo`, `plt_fn_lancar_rotas` (evento + move as unidades ESTOQUE → ROTAS), `plt_fn_danificados` (com relato da D-09; `p_arquivados`), `plt_fn_resolver_danificado`, `plt_fn_arquivar_card`, `plt_fn_programacao` (a porta do mapa), `plt_fn_programar_entrega`, `plt_fn_desprogramar_entrega`; **`plt_fn_rotas` recriada** (drop+create — E-17): lista SÓ o lançado, situações `pronta`/`entregue`, com dia/caminhão/foto; `plt_fn_registrar_entrega` exige lançamento. Metas (D-45): `plt_metas.etapa_id` (check: só em `unidades`; trigger: etapa do setor da meta), policy de edição = **criador ou admin**, `plt_fn_metas_painel` recriada com etapa e criador. Total: **21 tabelas `plt_`, 42 policies**. Em 08/09 também foram **arquivados 233 cards de pedido** históricos já encerrados no Tiny (SQL de manutenção `supabase/manutencao/2026-09-08_arquivar_cards_historicos_pcp.sql`, origem `api`). **Edge Function `geocodificar` v1** (`verify_jwt` ligado; Nominatim 1 req/1,1 s, User-Agent identificado, contato opcional no segredo `PLT_GEOCODIFICACAO_CONTATO`).

**Módulo Comercial — a união das plataformas (SESSAO-19, migration 26 — aplicada em 15/09/2026, D-46/D-47):** o domínio do Painel de Recompra passou a viver NESTE banco. **6 tabelas novas** (DDL idêntico ao banco vivo do recompra, dump de 15/09): `listas_disparo`, `listas_disparo_membros` (UNIQUE lista+telefone), `listas_disparo_eventos`, `webhook_eventos_crm`, `tarifas_mensagem_whatsapp` e **`tiny_auth`** (cofre do token OAuth do Tiny — linha única, **RLS ligado SEM policy de propósito**: só a service_role acessa, nem admin lê pelo navegador — regra crítica 4); 5 enums (`status_lista_disparo` etc.). **`vendas_marketing` é VIEW, não tabela** (D-47): reproduz coluna a coluna a tabela-fato do recompra sobre `pedidos`+`clientes` — `valor_pedido` = `total_pedido`, `data_compra` = meia-noite America/Sao_Paulo de `data_pedido`, `itens_comprados` de `raw->'itens'` no shape `{produto:{descricao},quantidade,valorUnitario}`, `nome_cliente` = snapshot `raw->'cliente'->>'nome'` SEM trim, `telefone_cliente` = `clientes.fone` com fallback `clientes.raw->>'celular'`, `id` uuid determinístico do número; executa como a DONA (o ERROR `security_definer_view` dos advisors é **intencional** — é o que a deixa ler `pedidos`, que não tem policy) com **gate de módulo no WHERE** via `plt_privado.fn_tem_modulo('comercial')` (helper novo; admin sempre passa; `auth.uid()` nulo = máquina). Views `vw_clientes_consolidados` e `vw_scorecards_lista` copiadas, com `security_invoker`. **10 RPCs do recompra copiadas sem alteração de corpo** (+`set search_path`, execute revogado de anon): `fn_filter_customers`, `fn_dashboard_scorecards/revenue_chart/purchase_frequency/items/top_items_overall/transitions/transitions_summary/transition_clients`, `fn_vendas_disparo_por_telefone`. `plt_usuarios` ganhou **`modulos text[]`** (seed: `{fabrica}` p/ todos, `comercial` só no admin; default `{}` — quem cria usuário concede). RLS das 5 tabelas de disparo/log = módulo `comercial` ou admin. **6 Edge Functions deployadas** (`enviar-proximo-disparo`, `processar-timers-disparo`, `verificar-vendas-disparo`, `disparar-membro-individual`, `webhook-datacrazy-resposta` com autenticação própria x-api-key, `tiny-auth-refresh` com verify_jwt LIGADO até o cutover) — **NENHUM cron agendado** (risco 1 da união: o renovador do token roda SÓ no projeto antigo até o cutover). Carga das 6 tabelas feita por `supabase/manutencao/2026-09-15_carga_comercial.mjs` (servidor→servidor, checksum idêntico 6/6; reutilizável no delta da SESSAO-21). ⚠️ Deriva histórica documentada: 10 pedidos (0,19%) com nome/telefone diferente entre os pipelines (detalhe em `docs/execucao/SESSAO-19.md`). Este arquivo também ganhou o espelho das colunas do backfill em `clientes` (`raw`, `tipo_pessoa`, `inscricao_estadual`, `fantasia`) que faltava no `.sql`.

**Comercial no front — negação explícita e temas esmeralda (SESSAO-20, migration 27 — aplicada em 15/09/2026, D-46):** o achado da demanda foi corrigido pela verificação ao vivo — a `vendas_marketing` JÁ nascera gateada na 26; o que faltava era **negar em vez de devolver vazio**. Helper novo **`plt_privado.fn_negar_sem_modulo(text)`** (raise 42501 com mensagem em língua de gente). **As 10 RPCs do Comercial viraram SECURITY DEFINER** com o gate no topo (corpo das queries intacto — nenhum número muda; `fn_vendas_disparo_por_telefone` era `language sql` e virou plpgsql com o MESMO select); contexto de máquina (sem JWT) segue passando. **ACL enxuta**: `authenticated` perdeu o SELECT de `vendas_marketing` e `vw_clientes_consolidados` (pessoa agora só lê por RPC — o ERROR `security_definer_view` dos advisors SUMIU); `vw_scorecards_lista` ficou só-SELECT (RLS de módulo cobre a leitura direta do front). **2 RPCs novas** substituem as leituras diretas que o front do recompra fazia: `fn_clientes_consolidados(p_min_pedidos, p_ordem, p_limit)` e `fn_vendas_cliente(p_telefones, p_nome_exato, p_nome_parcial)` — sem critério devolve vazio (+2 WARN esperados; os 10 do Comercial agora também aparecem como DEFINER: endpoints de propósito, padrão plt_fn_*). **Check de `plt_usuarios.tema` ampliado para 10 temas** (`esmeralda`, `esmeralda-escuro` — a paleta do recompra no design system); o check da migration 22 do repo virou `not valid` (E-19). Impressão digital da integração antes = depois (`7bd6bac6…`, 114 colunas). **Edge Function `autenticacao` v8**: criar-usuario passa a gravar `modulos: ['fabrica']` (usuário novo nasce com a fábrica; `comercial` é concedido à mão).

**Funções `plt_fn_*` em `public` (SESSAO-04, migration 13 — aplicada em 27/08/2026):** a **porta de leitura do kanban**, endpoints REST **de propósito** (o WARN dos advisors sobre "security definer executável por authenticated" nessas é o desenho intencional): `plt_fn_pedidos_kanban` (resumo paginado com `unidades_liberadas`) · `plt_fn_pedido_itens_kanban` (itens em unidades k/n **por item**, regra do n8n) · `plt_fn_expedicao_kanban` (reagrupamento D-01/D-13) · `plt_fn_pedido_unidades` (onde está cada unidade). **↪️ SESSAO-05 (migration 14) somou duas:** `plt_fn_linha_tempo_card` (história completa do card com nomes — gate: quem vê o card/expedição) e `plt_fn_estornar_evento` (estorno pela interface; o gate de verdade vive no trigger). Total após a SESSAO-05: 6 WARN (**↪️ 8 desde a SESSAO-06**, com as 2 RPCs de qualidade). Salvaguardas E-11: `search_path` fixo, execute revogado de public/anon, gate por usuário ativo DENTRO da função (expedição: admin/entrada/terminal), zero dado pessoal/financeiro do cliente. **As tabelas da integração continuam sem policy — o navegador nunca as lê direto.**

**Edge Function `autenticacao`** (SESSAO-03 — a primeira do projeto): `entrar` (usuário OU e-mail) · `criar-usuario` (admin/líder; senha padrão via segredo `PLT_SENHA_PADRAO`) · `convite-info` · `trocar-senha` (obrigatória no 1º login) · `pin-definir` · `pin-verificar` (PBKDF2). Código versionado em `supabase/functions/autenticacao/index.ts` no repo.

**21 políticas de RLS**: operador vê os setores dele, líder vê o setor completo, admin vê tudo. `plt_eventos` **não tem política de UPDATE nem de DELETE**.

> [!danger] Dois avisos que valem ouro
> **1.** `plt_cards` **não** tem foreign key para `pedido_itens`, e isso é decisão, não esquecimento: `fn_upsert_pedido` faz `delete from pedido_itens` e regrava tudo a **cada** atualização de pedido vinda do Tiny. Uma FK apontando para lá faria **toda atualização de pedido falhar em produção**. O item é guardado como snapshot. **Não "conserte" isso.**
> **2.** O append-only de `plt_eventos` é garantido por **trigger**, não por RLS — porque a `service_role` (a chave que o n8n usa) **ignora RLS**. Testado no banco real: `UPDATE` e `DELETE` recusados.

## O que NÃO existe (para ninguém inventar)

↩️ **Revisado em 26/08/2026:** com a SESSAO-02 aplicada, agora existem sim views, triggers, um schema a mais (`plt_privado`), funções e policies — **todos da plataforma, com prefixo `plt_`**, listados na seção acima. O que continua valendo: **nada disso toca as tabelas da integração**, e do lado da integração continua não havendo view, trigger, policy, bucket de storage nem edge function. A tabela de usuários agora existe (`plt_usuarios`), da plataforma. Os pedidos da **GreenPallets NÃO entram em `pedidos`/`clientes`** — só o controle de dedup em `gp_pcp_processados` (escopo decidido em 17/08: conta GP alimenta apenas cards da PCP). Se algo disso mudar, registrar AQUI.

## Ver também

[[SUPA - Visao Geral]] · `supabase-fabrica-schema.sql` (o DDL executável, nesta pasta) · [[N8N - Migracao Supabase]]

---

## ⭐ Migration 22 — Backfill histórico do Tiny (28/08/2026)

Arquivo executável: `22_backfill_tiny.sql` (nesta pasta).
Detalhe completo: [[N8N - Backfill Historico do Tiny]].

### ⚠️ Os gatilhos sobre `pedidos` mudaram (D-43)

O gatilho único `plt_pedidos_reagir` **não existe mais**. Agora são dois:

| Gatilho | Quando | Guarda |
|---|---|---|
| `plt_pedidos_reagir_insercao` | AFTER INSERT | `WHEN origem = 'webhook' AND situacao NOT IN ('entregue','nao_entregue','cancelado')` |
| `plt_pedidos_reagir_atualizacao` | AFTER UPDATE | sem guarda (UPDATE nunca cria card) |

Ambos executam `plt_privado.fn_reagir_pedido()`, **cujo corpo NÃO foi alterado**
— ele pertence às migrations 18/21 do repo. São dois porque `tg_op` não pode ser
usado dentro de um `WHEN`.

🚨 **Claude Code:** a migration 22 do repo tem que espelhar esses dois gatilhos.
Se alguma migration futura recriar `plt_pedidos_reagir` do jeito antigo, a
blindagem some em silêncio e o próximo backfill enche o PCP.

> ↪️ **01/09/2026 (SESSAO-14):** aconteceu exatamente isso — a reaplicação da
> S13 tinha ressuscitado o gatilho antigo e ~163 cards históricos entraram no
> PCP (E-24). O espelho agora existe: **migration 24 do repo**
> (`20260901121000_plt_gatilhos_pedidos_espelho.sql`), aplicada em 01/09 —
> reaplicar o repo inteiro passou a terminar com os 2 gatilhos certos.
> A limpeza dos 163 cards aguarda decisão do dono.

### Tabela `tiny_fila`

Uma linha = uma chamada a fazer na API v2 do Tiny. Auto-expansível: um item
`*_pesquisa` enfileira os detalhes que achou **e** a página seguinte.

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | bigint identity **PK** | |
| `recurso` | text | `pedidos_pesquisa` · `pedido` · `contatos_pesquisa` · `contato` · `nf_pesquisa` · `nota_fiscal` · `cr_pesquisa` · `conta_receber` (check) |
| `chave` | text | id interno do Tiny, ou rótulo da janela (`2025-03:p2`) |
| `referencia` | text | nº do pedido/NF/nome — só leitura humana |
| `params` | jsonb default '{}' | `{dataInicial, dataFinal, pagina, janela}` |
| `prioridade` | smallint default 5 | 1→8, define a ordem de trabalho |
| `status` | text | `pendente` · `processando` · `ok` · `erro` · `vazio` (check) |
| `tentativas` | smallint | encerra em `erro` na 4ª |
| `erro` | text | |
| `criado_em` / `reservado_em` / `processado_em` | timestamptz | |

Único em `(recurso, chave)` — reenfileirar o mesmo id nunca duplica.
Índices: `tiny_fila_trabalho_idx` (parcial, `status='pendente'`), `tiny_fila_status_idx`.

### Tabela `notas_fiscais`

`id` PK · `tiny_id` **unique** · `tipo_nota` · `serie` · `numero` ·
`chave_acesso` · `data_emissao` · `data_saida` · `situacao` ·
`descricao_situacao` · `valor_nota` · `valor_frete` · `valor_desconto` ·
`numero_pedido` (indexado) · `pedido_id` FK → `pedidos.id` · `cliente_id` FK →
`clientes.id` · `raw` jsonb · `criado_em` / `atualizado_em`.

### Tabela `contas_receber`

`id` PK · `tiny_id` **unique** · `numero_documento` · `numero_pedido`
(indexado) · `pedido_id` FK · `cliente_id` FK · `historico` · `categoria` ·
`data_emissao` · `data_vencimento` (indexado) · `data_liquidacao` · `valor` ·
`saldo` · `situacao` (indexado) · `forma_recebimento` · `meio_recebimento` ·
`raw` jsonb · `criado_em` / `atualizado_em`.

### Colunas novas em `clientes`

`raw` jsonb (o `retorno.contato` inteiro) · `tipo_pessoa` · `inscricao_estadual`
· `fantasia`.

### Funções novas

| Função | Faz |
|---|---|
| `fn_fila_proximos(p_limite integer)` | reserva o próximo lote (`FOR UPDATE SKIP LOCKED`); devolve para a fila o que ficou `processando` há mais de 15 min |
| `fn_backfill_aplicar(p_fila_id bigint, p_recurso text, p_payload jsonb)` | busca → enfileira o achado; detalhe → grava na tabela certa; fecha a linha da fila **na mesma transação** |
| `fn_backfill_falha(p_fila_id bigint, p_erro text, p_terminal boolean)` | devolve pra fila (até 4 tentativas) ou encerra como `vazio` |

Todas `security definer`, execute revogado de anon/authenticated, concedido só a
`service_role`. **O n8n não conhece nenhuma tabela** — chama essas três mais a
`fn_upsert_pedido`.

> [!note] `origem` decide se vira card
> No `on conflict` de `fn_upsert_pedido` a coluna `origem` **não é atualizada**.
> Pedido que nasceu `webhook` continua `webhook` para sempre, mesmo relido pelo
> backfill. É isso que faz a blindagem D-43 ser estável.


---

## ⚠️ Correção de 08/09/2026 — a coluna `pedidos.situacao`

Esta nota afirmava que `situacao` guarda o **código v2** (`aberto`, `entregue`,
`preparando_envio`). **Está errado.** `pedido.obter` devolve a **DESCRIÇÃO**, e
`fn_upsert_pedido` grava sem transformar. Os valores reais no banco são:

`Entregue` · `Preparando envio` · `Cancelado` · `Em aberto` ·
`Pronto para envio` · `Faturado` · `Não entregue`

Vale para as duas origens (`webhook` e `backfill`) — as duas passam pelo mesmo
`pedido.obter`. O código v2 minúsculo só existe em `codigoSituacao`, no payload
do webhook, que não é o que a função grava.

**Todo filtro por situação neste banco usa a descrição.** Quem comparar com
`'entregue'` minúsculo não acha nada.
