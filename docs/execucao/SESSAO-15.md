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

## Task list (espelho da demanda) — conferida contra a demanda em 08/09

- [x] T1 · Registrar as respostas do dono em `PLT - Decisoes de Produto.md` → **D-45** (a D-44 era da frente do backfill)
- [x] T2 · Banco — migration 25 (tudo o que está listado abaixo + situação normalizada + espelho do gatilho)
- [x] T3 · Edge Function `geocodificar` — publicada em 08/09 com aprovação (v1, `verify_jwt` ligado)
- [x] T4 · Estoque em lista com ID digitável (busca/edição inline), produto, origem, desde quando; paginação no servidor
- [x] T5 · Pedidos em aguardo: (k/n), destaque completo + "Lançar para ROTAS" (2 toques)
- [x] T6 · Danificados: origem + relato D-09 + tempo parado; Resolvido→destino (estado obrigatório para outro setor) e Arquivar; arquivados carregados só ao clicar
- [x] T7 · ROTAS pai com Entregas + Programação; Entregas só lançados; card com dia + caminhão + foto
- [x] T8 · Programação: dia → seleção → mapa Leaflet/OSM → sugestão por proximidade → confirmar data+caminhão; reprogramar/tirar; **+ ordem de parada sugerida, paradas numeradas, distância e Expandir** (revisão ao vivo)
- [x] T9 · Caminhões: CRUD com foto; excluir em uso bloqueado → oferece arquivar
- [x] T10 · leaflet + react-leaflet + @types/leaflet
- [x] T11 · `test:banco` 2 rodadas verde (+32) · tsc · lint · Vitest 40/40 · build · F-07 ao vivo nas 5 telas + quadro (screenshots na conversa; algumas capturas falharam pelo painel — F-09)
- [x] T12 · Migration 25 aplicada com OK do dono; conferências antes/depois idênticas; advisors 28 WARN esperados; 233 cards arquivados; nota do esquema atualizada (o `supabase-fabrica-schema.sql` da integração não muda — nada da integração foi tocado)
- [x] T13 · Teste ao vivo na conta do dono (login digitado por ele): todos os critérios de aceite passaram (tabela no handoff)
- [x] T14 · Handoff `handoff_2026_09_08_sessao15_logistica_rotas` + memória (E-25, E-26, F-09) + índice/mapa/demanda/modelo de sistema atualizados
- **Extra (pedidos do dono na revisão ao vivo):** botão **Concluir** no card (quadro + tablet, destino fixo ESTOQUE), rota sugerida ordenada (vizinho mais perto) com números e distância, mapa expansível, card em duas linhas (estourava a borda com o selo de estado).

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
- [08/09] **Teste ao vivo** (dono logado; screenshots quando o painel compôs frames, senão F-09): Concluir 13176 (MONTAGEM→ESTOQUE 🟢, eventos 688/689) · Estoque: ID `SAP-ALICE-001` + busca · Pedidos em aguardo: 13176 completo → lançado (o dono já tinha lançado 13108/13114/13156 explorando a tela); 13146 "1 de 2 prontas" após Concluir da 2ª unidade · Danificados (cenário montado por SQL em nome do dono: 13107 e 13183 marcadas 🔴 + parecer 🔴 → DANIFICADO automático na MONTAGEM, etapa criada preguiçosamente): 13107 resolvido → FURAÇÃO 🟡; 13183 arquivada; arquivados lazy · Caminhões: 2 cadastrados; "Baú branco" excluído (sem uso) — e "Baú cinza" (em uso) bloqueado → arquivado → reativado; foto via `DataTransfer` no `input[type=file]` → `caminhoes/2/…` e aparece no card das ROTAS · Programação: 13114/13176/13156 geocodificados (Nominatim real; 13108 ficou "sem ponto"), rota 6,5 km paradas 1-3-2, programados hoje no Baú branco; tirar 13114/13156; 13156 sugerido a 2,9 km de 13114; 13176 reprogramado 09/09 Baú cinza · Expandir: `fixed` 1103×698, ESC recolhe.
- [08/09] **Ajustes pedidos pelo dono na revisão**: Concluir no card (quadro + tablet via PIN, `ModalMoverCard modo="concluir"`), `ordenarRota` (vizinho mais perto, testes), marcadores numerados (`.plt-parada`), Expandir/ESC + `invalidateSize`, card em duas linhas. tsc/lint/Vitest 40/build verdes de novo.
- [08/09] Achado na revisão: o clique de automação por ref/coordenada não abre nada quando o painel não compõe frames; gestos provados por JS no handler real + conferência no banco (F-09). Radix Select só respondeu a `keydown Enter` no item focado.
- [08/09] Retomada. Conferido o cofre (sem entradas novas em decisões/memória; nota do esquema com a correção da situação). D-45 registrada. Migration 25 escrita e `test:banco` 2 rodadas TUDO VERDE (+32 verificações). Edge Function `geocodificar` escrita. Commit por caminho explícito.
