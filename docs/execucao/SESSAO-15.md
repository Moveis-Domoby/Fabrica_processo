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

## Diário

- [01/09] Sessão iniciada. Leituras obrigatórias feitas; dúvidas respondidas pelo dono; branch criada. Working tree com arquivos de outra frente identificados (não tocar).
