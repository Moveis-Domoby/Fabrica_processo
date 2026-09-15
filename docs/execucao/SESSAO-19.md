# Memória de execução — SESSAO-19 · União 1: Banco do Comercial na fábrica

> Computo aqui TUDO enquanto executo (regra 8). Demanda: `_docs/Plataforma/Demandas/SESSAO-19 - Uniao 1 - Banco do Comercial na Fabrica.md`. Plano: `_docs/Plataforma/PLT - Plano Uniao das Plataformas.md`. Decisões: D-46, D-47, D-19/regra 2, regra 4, RNF-05.

## Task list (espelho da demanda)

- [ ] T1 · Dump do schema vivo do recompra (`kfkcumjepnxnnzyvmxfo`): enums, DDL das 6 tabelas, views `vw_*`, corpo das 10 RPCs — nada de memória
- [ ] T2 · Verificar no dado vivo o dataset da view (`vendas_marketing` × `pedidos`: filtro de situação? contagens? shape de `itens_comprados`)
- [ ] T3 · Migration 26 `plt_comercial_banco`: 6 tabelas DDL idêntico + enums; view compat `vendas_marketing` (shape exato, `data_compra` meia-noite America/Sao_Paulo, `itens_comprados` de `pedidos.raw`); `vw_clientes_consolidados` + `vw_scorecards_lista`; 10 RPCs sem alteração de corpo (+ search_path + revoke anon); coluna `plt_usuarios.modulos` + seed (`{fabrica}` todos, `comercial` p/ admin); `plt_privado.fn_tem_modulo`; RLS padrão da casa nas 6 tabelas
- [ ] T4 · `npm run test:banco` (2 rodadas) verde ANTES de qualquer conversa de aplicar
- [ ] T5 · OK explícito do dono → aplicar migration na fábrica (impressão digital da integração antes/depois) → `get_advisors`
- [ ] T6 · Deploy das 6 Edge Functions (sem fork; `tiny-auth-refresh` com verify_jwt LIGADO; NENHUM cron) — dono configura os 4 secrets
- [ ] T7 · Carga das 6 tabelas byte a byte (script servidor→servidor; `tiny_auth` jamais em chat/log) + contagens/checksums origem×destino
- [ ] T8 · Validação das RPCs: 8 de dashboard + `fn_filter_customers` mês a mês fábrica × recompra (tolerância zero fora do delta do dia)
- [ ] T9 · Validação de RLS: anon não lê/escreve nada das 6; usuário sem módulo `comercial` não lê; admin lê tudo
- [ ] T10 · `SUPA - Esquema do Banco.md` + `supabase-fabrica-schema.sql` atualizados
- [ ] T11 · Conferir task list × demanda → revisão do dono → merge na main (D-20)
- [ ] T12 · Handoff em `_docs/Handoffs/` + memória de aprendizado + índices do cofre

## Decisões técnicas registradas (aprovadas pelo dono em 15/09, "Pode seguir")

1. Views como dona (sem `security_invoker`), gate `plt_privado.fn_tem_modulo('comercial')` no WHERE — única forma de ler `pedidos` (RLS sem policy) e ainda negar quem não tem módulo.
2. RPCs com corpo intocado + `set search_path` + revoke de anon/public (E-11).
3. `tiny-auth-refresh` com verify_jwt LIGADO até o cutover (proteção contra rotação acidental do token — risco 1). Ajuste do cron documentado p/ S21.
4. Dataset da view verificado no dado vivo antes de escrever (T2), nunca deduzido.
5. Branch `sessao-19-uniao-banco-comercial`; commits por caminho explícito (E-23).

## Diário

- [início] Branch criada. Leitura obrigatória completa (demanda 2×, plano inteiro, decisões, memória, esquema, cofre do recompra: RPCs/Segurança/Identidade/Tiny). MCP Supabase enxerga os 2 projetos.
- [T1 ✅] Dump do schema vivo do recompra capturado via MCP: 5 enums (`status_lista_disparo`, `status_membro_disparo`, `motivo_perda_membro`, `tipo_evento_disparo`, `categoria_mensagem_whatsapp`), colunas/constraints/índices das 6 tabelas, 2 views, corpo das 10 RPCs (todas SECURITY INVOKER sem search_path — na fábrica ganham search_path + revoke anon, corpo intocado). ⚠️ `fn_vendas_disparo_por_telefone` retorna `character varying` → a view compat PRECISA produzir varchar (não text) em `numero_pedido`/`telefone_cliente`/`nome_cliente`, senão RETURN QUERY quebra. `fn_dashboard_top_items_overall` do banco vivo NÃO tem mais o LIMIT 300 (a nota BD-RPCs do cofre está desatualizada nisso).
- [T2 ✅] Verificação no dado vivo (15/09):
  - **Mesmo dataset**: 5.302 = 5.302 pedidos, soma dos números idêntica (56.999.019) → SEM filtro de situação; a view lê `pedidos` inteiro.
  - **`valor_pedido` = `total_pedido`** (líquido): 18/19 meses ao centavo; set/2026 difere R$ 979,00 = delta de sync do dia (pedido 13406).
  - **`data_compra`** = meia-noite America/Sao_Paulo (5.302/5.302 à meia-noite SP) → `(data_pedido::timestamp) at time zone 'America/Sao_Paulo'`.
  - **`numero_itens` = nº de LINHAS do array** (5.302/5.302; a nota "unidades" do cofre do recompra está errada) = `jsonb_array_length`.
  - **`itens_comprados`**: elementos v3 `{infoAdicional, produto, quantidade, valorUnitario}`, nome em `$.produto.descricao`. Fonte fiel na fábrica: **`raw->'itens'`** (7.935 linhas, 84 nomes com espaços nas bordas, 950 distintos — IGUAL ao recompra; `pedido_itens` perde os espaços). Elemento da view: `{produto:{descricao: e->'item'->>'descricao'}, quantidade, valorUnitario}` — caminho 3 da cascata. `infoAdicional` não é reproduzido (nenhuma RPC/função de front o lê).
  - **`nome_cliente`** = `raw->'cliente'->>'nome'` SEM trim (5.294/5.302 idênticos; `clientes.nome` divergiria em 1.729 por trim).
  - **`telefone_cliente`** = `coalesce(nullif(trim(c.fone),''), nullif(trim(c.raw->>'celular'),''))` — 50 nulos = mesmo conjunto do recompra (o v3 tinha fallback p/ celular; o celular na fábrica vive em `clientes.raw` do backfill).
  - **Deriva histórica conhecida (0,19%)**: 2 pedidos com telefone diferente (8223, 8711) e 8 com nome diferente (8546, 8611, 8805, 9062, 9159, 9663, 9881, 12538) — cliente editado no Tiny em momentos diferentes entre os 2 pipelines; irreprodutível por view (D-47 proíbe tabela). Impacto potencial: ±1 cliente em alguns meses nas RPCs de identidade. Reportar na validação T8 e no handoff.
  - **Artefato de comparação (não é bug)**: `::text` de jsonb re-escapa TAB como `\t` literal — as RPCs copiadas fazem isso IGUAL nos 2 bancos, então os resultados batem; só as minhas queries de diff enxergavam diferença.
  - **`id`** da view: uuid determinístico `md5('vendas_marketing:'||numero)::uuid` (pedidos.id é bigint; front usa uuid como key). **`created_at`** = `criado_em` do pedido (momento de ingestão difere do sync antigo; nenhuma RPC usa).
- [T3 ✅] Migration 26 escrita: `supabase/migrations/20260915120000_plt_comercial_banco.sql` — 5 enums guardados (E-19), 6 tabelas DDL idêntico (até os índices duplicados de membros), coluna `modulos` com seed-once (DO block: só semeia ao criar a coluna — reaplicação não devolve módulo a quem foi retirado), `fn_tem_modulo` (auth.uid() nulo = máquina passa; anon barrado por grant/policy), RLS por módulo nas 5 tabelas + **`tiny_auth` deliberadamente SEM policy** (token é segredo de máquina — desvio do critério "admin lê tudo", flagrado p/ dono), view `vendas_marketing` como dona com gate no WHERE + colunas varchar (RETURN QUERY de `fn_vendas_disparo_por_telefone` exige), `vw_*` com security_invoker, 10 RPCs corpo intocado + search_path + revoke anon. Escapes `\D` conferidos no arquivo (E-15).
- [correção de cofre] `supabase-fabrica-schema.sql` estava DESATUALIZADO vs produção: faltavam as colunas do backfill em `clientes` (`raw`, `tipo_pessoa`, `inscricao_estadual`, `fantasia`) — o harness quebrou com "column c.raw does not exist". Espelhadas no arquivo (o DDL completo do backfill segue em `22_backfill_tiny.sql`; sincronizar tiny_fila/notas_fiscais/contas_receber no espelho fica como pendência de cofre no handoff).
- [T4 ✅] `test:banco` TUDO VERDE, 2 rodadas — +16 verificações da S19 no harness (shape exato da view, meia-noite SP funciona no PGlite, fallback celular, gate de módulo provado pela VIEW — o WHERE roda até p/ superusuário, diferente de policy/E-14 —, tiny_auth fechada, números das RPCs num período isolado 2031, ciclo de campanha nas tabelas novas, UNIQUE lista+telefone). Único ajuste: custo sai `0.3500` (numeric 10,4), asserção corrigida.
