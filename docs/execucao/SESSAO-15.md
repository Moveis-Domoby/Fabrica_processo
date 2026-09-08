# Memória de execução — SESSAO-15 · Logística e ROTAS com Caminhões

**Branch:** `sessao-15-logistica-rotas` · **Início:** 01/09/2026
**Demanda:** `_docs/Plataforma/Demandas/SESSAO-15 - Logistica e ROTAS com Caminhoes.md` (lida 2x)
**Decisões que regem:** D-38, D-39, D-13, D-33, D-01, D-40 (+ respostas do dono em 01/09 → registrar como D-44)

## ⚠️ Avisos permanentes da sessão

- Working tree tem arquivos de OUTRA frente (docs n8n Cadastro de Cliente): `_docs/000 - MAPA DO PROJETO.md` (M), `_docs/Fabrica n8n/*` — **NUNCA `git add -A`** (E-23); commit sempre por caminho explícito.
- Banco de produção: escrever migrations em arquivo; **aplicar só com aprovação no checkpoint** (regra crítica 2). Deploy da Edge Function `geocodificar` idem.
- Teste ao vivo: abrir navegador no login e o DONO digita credenciais (regra crítica 4).

## Respostas do dono (01/09) — vira D-44

1. **~163 cards históricos no PCP:** aprovado arquivar em massa (evento `card_arquivado`, exclusão lógica). Executar no passo de aplicar.
2. **Metas:** meta criada pelo líder é COMPLETA ("Lucas → concluir X cards na etapa Y em x tempo (opcional)") — o liderado só executa e a meta contabiliza sozinha. → travar edição/encerramento para quem criou (admin mantém tudo; a pessoa manda nas que ela mesma criou); meta de unidades ganha **etapa opcional**.
3. **Horas úteis:** mantém execução (iniciou→finalizou). Palavras do dono sobre média por etapa + tempo total do card (PCP→terminal) registradas para a SESSAO-16 (dashboards).
4. **"Unidade pronta"** = chegou em terminal (ESTOQUE ou ROTAS). Futuro: tela de "concluídos" (fora do escopo agora).
5. **Lançar para ROTAS** move as unidades que estão no ESTOQUE para o setor ROTAS (evento normal de movimentação).
6. **Estoque:** a lista da D-38 SUBSTITUI o quadro kanban do setor ESTOQUE ("esse quadro nem deveria existir").
7. **ID de produção:** edita logística (PCP/terminais) e admin.
8. **Danificados:** resolver EXIGE marcação de estado (pode sair 🟡 ou 🔴 mesmo); líder também arquiva; botão "visualizar arquivados" com carregamento lazy (só ao clicar).
9. **Programação:** reprogramável a qualquer instante (até no dia), **nunca depois de entregue**; admin controle total; quem opera é a logística.

## Task list (espelho da demanda)

- [ ] T1 · Registrar D-44 em `PLT - Decisoes de Produto.md`
- [ ] T2 · Banco — migration 25: `plt_caminhoes` + `plt_programacoes` + `plt_geocache` + `plt_cards.id_producao` + evento `pedido_lancado_rotas` (validação/projeção) + RPCs (`plt_fn_estoque`, `plt_fn_definir_id_producao`, `plt_fn_pedidos_aguardo`, `plt_fn_lancar_rotas`, `plt_fn_danificados`, resolver danificado, programação, caminhões via RLS) + `plt_fn_rotas` só lançados (E-17: drop na migration 19) + arquivar por líder em danificado + metas: trava de criador + etapa opcional
- [ ] T3 · Edge Function `geocodificar` (Nominatim, User-Agent identificado, 1 req/s, cache em `plt_geocache`) — deploy só com aprovação
- [ ] T4 · Front — Logística → Estoque: lista com ID digitável (busca/edição), produto, origem, desde quando; paginada
- [ ] T5 · Front — Logística → Pedidos em aguardo: agrupado por pedido, (k/n), destaque completo + "Lançar para ROTAS"
- [ ] T6 · Front — Logística → Danificados: origem, relato, tempo parado; Arquivar / Resolvido→destino; arquivados lazy
- [ ] T7 · Front — ROTAS pai com filhos Entregas + Programação na sidebar; Entregas só lançados, card mostra dia+caminhão
- [ ] T8 · Front — Programação: dia → sem programação → seleção → mapa Leaflet + sugestão por proximidade → confirmar data+caminhão; reprogramar
- [ ] T9 · Front — Admin → Caminhões: CRUD com foto (bucket `plt-imagens`); em uso não exclui — arquiva
- [ ] T10 · Dependência nova: leaflet + react-leaflet (avisada e aprovada na conversa)
- [ ] T11 · Testes: `test:banco` 2 rodadas, tsc, lint, vitest, build; F-07 nas telas novas
- [ ] T12 · Aplicar no banco COM APROVAÇÃO (migrations + arquivo dos 163 + deploy edge) + conferências E-20/advisors + atualizar `supabase-fabrica-schema.sql` + nota do esquema
- [ ] T13 · Teste ao vivo com o dono (login digitado por ele)
- [ ] T14 · Handoff + memória de aprendizado + índice/mapa atualizados + conferir task list contra a demanda

## Respostas do dono (08/09) — complementam a D-45

- Danificados: **só logística e admin** (líder fora — revisa o item 8 de 01/09).
- Estoque: **só logística e admin**.
- Pontos 1 e 2 (correção da situação normalizada e critério dos 163) seguem com a recomendação do Claude; passam de novo no checkpoint.

## Achados de 08/09 (antes de codar)

- **`pedidos.situacao` guarda DESCRIÇÃO** ("Cancelado", "Entregue", "Não entregue"…), corrigido na nota do esquema em 08/09. Consequências: `fn_reagir_pedido` (S09) nunca detectava cancelamento; selos "Cancelado no Tiny" no front nunca apareciam; a guarda do gatilho foi corrigida em produção com `translate(...)` (nota do backfill) sem espelho no repo (migration 24 tem só `lower()`), nem no `22_backfill_tiny.sql` do cofre. → migration 25 normaliza os três pontos.
- **D-44 está reservada** pela frente do backfill (só citada na nota do backfill; o arquivo de decisões parava na D-43) → respostas registradas como **D-45**.
- Backfill rodando em 08/09: tabelas `pedidos`/`notas_fiscais`/`contas_receber` crescem por baixo — nenhuma contagem fixa nas verificações de produção.

## Decisões técnicas tomadas

- **Um evento novo só (`pedido_lancado_rotas`)** no card de PEDIDO, com projeção `plt_cards.lancado_rotas_em`; as unidades vão de ESTOQUE → ROTAS por `movimentacao_setor` comum (saída de terminal não exige qualidade — D-25). `plt_fn_rotas` e `plt_fn_registrar_entrega` passam a exigir o lançamento.
- **`concluido_em` virou verdade atual** (terminal AGORA): a projeção antiga mantinha o carimbo mesmo quando a unidade voltava para produção; "pronta" nos Pedidos em aguardo conta setor terminal atual.
- **ID de produção NÃO é evento** (é rótulo editável/corrigível): RPC `plt_fn_definir_id_producao` com gate + unicidade entre cards vivos (caixa ignorada) + log D-40 (`id_producao_definido`).
- **Programação em tabela editável (`plt_programacoes`)**, uma linha por pedido (upsert), história na trilha (`entrega_programada` / `entrega_reprogramada` / `programacao_removida`); RPCs `plt_fn_programar_entrega` / `plt_fn_desprogramar_entrega` com trava "nunca depois de entregue". Sem policy de escrita — só as RPCs escrevem.
- **Caminhões via RLS** (leitura: qualquer ativo; escrita: admin) + trigger que bloqueia exclusão em uso ("arquive em vez de excluir") + trigger de log; placa única sem diferenciar caixa.
- **Geocodificação**: a chave do cache é `md5(lower(endereço geocodificável))` calculada NO BANCO (`plt_privado.fn_endereco_geocodificavel`) — a normalização mora num lugar só; a Edge Function `geocodificar` recebe `{chave, endereco}` do front, consulta o Nominatim serializado (1,1 s), grava `plt_geocache` (também as falhas, para não insistir por 7 dias) e exige JWT de pessoa ativa. Fallback só "sem bairro/CEP" — nunca "só cidade" (ponto no centro geraria sugestão errada). Contato do User-Agent vem do segredo opcional `PLT_GEOCODIFICACAO_CONTATO`.
- **Danificados**: resolver = RPC própria (`plt_fn_resolver_danificado`) em vez de reaproveitar `plt_fn_mover_card` (o gate daquela é "trabalha no setor" — a logística não trabalha na SECC); mesmo setor → `movimentacao_etapa` sem estado (D-25); outro setor → marcação obrigatória + movimentação (D-45). Arquivar = RPC `plt_fn_arquivar_card`; o gate de verdade vive em `fn_validar_api` (admin, ou logística em peça DANIFICADA).
- **Metas**: `etapa_id` (check: só em `unidades`; trigger: etapa do setor da meta), porta `plt_fn_metas_painel` recriada (drop na migration 23 — E-17) com `etapa_id/etapa_nome/criada_por_id`; policy de edição = criador ou admin.
- **E-17 aplicado** nas migrations 19 (`plt_fn_rotas`) e 23 (`plt_fn_metas_painel`): drop antes do create.
- **Endpoints novos de propósito (E-11)**: +10 → 28 WARN esperados nos advisors.
- **Os ~163 cards**: SQL de manutenção separado (`supabase/manutencao/2026-09-08_arquivar_cards_historicos_pcp.sql`) — passo 1 conta, passo 2 arquiva (evento `card_arquivado`, origem `automacao`); critério conservador (pedido encerrado + sem unidade + criado por automação).

## Arquivos criados/alterados (até aqui)

- `supabase/migrations/20260908120000_plt_logistica_rotas_caminhoes.sql` (migration 25)
- `supabase/migrations/20260828080000_plt_api_webhooks_rotas.sql` e `20260901120000_plt_metas.sql` (drop antes do create — E-17)
- `supabase/testes/testar-migrations.mjs` (seção ROTAS da S11 reescrita para a regra nova + 32 verificações da S15)
- `supabase/manutencao/2026-09-08_arquivar_cards_historicos_pcp.sql`
- `supabase/functions/geocodificar/index.ts`
- `package.json` / `package-lock.json` (leaflet 1.9.4, react-leaflet 5.0.0, @types/leaflet)
- `_docs/Plataforma/PLT - Decisoes de Produto.md` (D-45)

## Front — arquivos criados/alterados

- `src/kanban/situacao.ts` (+ teste): situação normalizada no front (espelho da função do banco) — selos "Cancelado no Tiny" no PCP/Expedição/Pedidos em aguardo passam por ela. Regex gravada com escape via `node` (E-15) e conferida.
- `src/logistica/acesso.ts` (hook do gate da logística nas telas) · `src/logistica/api.ts` (estoque, ID, pedidos em aguardo, lançar, danificados, resolver, arquivar)
- `src/rotas/api.ts` reescrito (Entrega com programação; programação; geocodificar via Edge; `precisaGeocodificar`) · `src/rotas/proximidade.ts` (+ 8 testes: haversine, sugestão por raio/ordem/máximo, sem ponto nunca sugere) · `src/rotas/MapaProgramacao.tsx` (Leaflet + OSM, CircleMarker sem asset, enquadramento automático)
- `src/admin/caminhoes.ts` (CRUD + foto em `caminhoes/{id}/`; `CaminhaoEmUsoError` para oferecer arquivar)
- Telas: `Estoque.tsx`, `PedidosAguardo.tsx`, `Danificados.tsx` (relato D-09, resolver com 3 botões-rádio, arquivados lazy), `Programacao.tsx` (dia → seleção → mapa → sugestões → confirmar data+caminhão; reprogramar/tirar), `Caminhoes.tsx`
- `Rotas.tsx` (só lançados; card com dia+caminhão+foto; link para programar) · `App.tsx` (rotas novas; EmConstrucao sai das 4 telas) · `Layout.tsx` (ROTAS → Programação) · `ProducaoSetor.tsx` (quadro do ESTOQUE removido)
- Metas: `metas/api.ts` (etapa_id/etapa_nome/criada_por_id; etapaId em criar/atualizar) · `metas/ModalMeta.tsx` (seleção "Em qual etapa?" quando unidades) · `MeuPainel.tsx` (podeMexer = admin ou quem criou; "na etapa X" no cartão)

## Verificações rodadas (08/09)

- `npm run test:banco` — 2 rodadas TUDO VERDE (+32 verificações da S15; seção ROTAS da S11 reescrita para a regra do lançamento)
- `npx tsc -b` limpo · `npm run lint` limpo · `npm test` **38/38** (+10: situação 2, proximidade 8) · `npm run build` ok (aviso de chunk >500 kB já existia; Leaflet somou ~150 kB — candidato a `React.lazy` na tela de Programação, anotado como pendência)
- Pendente: F-07 no navegador + critérios ao vivo — depende de aplicar a migration 25 e a Edge Function no banco real (checkpoint com o dono)

## Diário

- [01/09] Sessão iniciada. Leituras obrigatórias feitas; dúvidas respondidas pelo dono; branch criada. Working tree com arquivos de outra frente identificados (não tocar).
- [08/09] **Checkpoint aprovado pelo dono ("OK")** → migration 25 aplicada pela API do Supabase (`apply_migration plt_logistica_rotas_caminhoes`). Conferências: impressão digital `15152f89852c7e23c762ab6fdddaad02` antes = depois; contagens da integração só cresceram (backfill vivo: pedidos 3.659→3.857); tabelas plt 18→21; policies 36→42; gatilhos `plt_pedidos_reagir_insercao/_atualizacao` (produção JÁ tinha o `translate` — E-25); check validado; 12 funções sem sobrecarga; policy de metas = criador/admin. Advisors: 28 WARN esperados + 3 antigos alheios à sessão (`fn_vig_touch` sem search_path e `vig_conhecimento_vendas` sem policy — frente do Vigia; `pg_net` em public; proteção de senha vazada desligada no Auth).
- [08/09] Arquivo em massa: 1ª tentativa com origem `automacao` **recusada pelo trigger** (E-26); com origem `api` → **233 eventos `card_arquivado`** gravados. Edge Function `geocodificar` publicada (v1, `verify_jwt` ligado).
- [08/09] Retomada. Conferido o cofre (sem entradas novas em decisões/memória; nota do esquema com a correção da situação). D-45 registrada. Migration 25 escrita e `test:banco` 2 rodadas TUDO VERDE (+32 verificações). Edge Function `geocodificar` escrita. Commit por caminho explícito.
