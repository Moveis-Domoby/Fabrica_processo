# Memória de execução — SESSAO-14 · Meu Painel e Metas

> Regra 8 do CLAUDE.md: computar TUDO enquanto executa. Reler periodicamente.

**Branch:** `sessao-14-meu-painel` · **Início:** 2026-09-01
**Demanda:** `_docs/Plataforma/Demandas/SESSAO-14 - Meu Painel e Metas.md` (lida 2×)
**Decisões que regem:** D-37 (painel + metas) · D-34 (afazeres) · D-02 (fila×execução) · D-29 (tempo útil) · D-32 (gates por papel) · D-40 (logar tudo) · D-36 (navegação)

## Respostas do dono nesta conversa (01/09)

1. **Meta de setor:** TODOS os membros do setor veem (só leitura); líder do setor/admin editam.
2. **"Unidades concluídas":** conta TODA execução encerrada — finalizada, transferência E mover sem finalizar (ou seja: cada linha de `plt_vw_execucoes` com fim conta 1, qualquer `encerramento`).
3. **Semana começa na segunda-feira** — "para a empresa sim, porém podemos mudar isso futuramente" → constante num só lugar.
4. Espelhamento dos 2 gatilhos de `pedidos` (blindagem do backfill, nota do esquema): incluído nesta sessão, sem objeção do dono; aplicar só com aprovação no checkpoint.

## Task list (espelho da demanda)

- [x] Ler cofre na ordem obrigatória + demanda 2× + mockup 03
- [x] Dúvidas de negócio respondidas pelo dono
- [x] Branch `sessao-14-meu-painel` + esta memória
- [ ] Migration `plt_metas`: tabela + RLS (admin qualquer · líder do próprio setor · pessoa a própria; membros do setor LEEM a meta do setor) + eventos de meta (criação/alteração/encerramento — histórico preservado) + porta de leitura com progresso calculado (padrão migration 18) no fuso America/Fortaleza
- [ ] Migration de espelhamento dos gatilhos `plt_pedidos_reagir_insercao/_atualizacao` (repo = produção)
- [ ] `test:banco` 2 rodadas verde
- [ ] Front — Meu Painel `/inicio/meu-painel`: seção Pendências (qualidade a atestar, delegações, tarefas em aberto, execuções em andamento), Notificações recentes (as do sino), Cockpit de metas (barra + % em tempo real + traço "alvo até agora" — mockup 03)
- [ ] Front — metas: criar/editar/encerrar com indicador (unidades · tarefas · tempo útil), período (diária/semanal/mensal), alvo, dono (pessoa/setor); permissões por papel
- [ ] Visibilidade: operador vê as próprias + as do(s) setor(es) dele; líder vê as do setor; admin tudo
- [ ] Tempo real: progresso atualiza sem recarregar (realtime existente + polling curto)
- [ ] `/inicio/afazeres` conferido igual à S12
- [ ] D-40: ações de meta geram log
- [ ] Paginação nas listas (RNF-02)
- [ ] tsc · lint · vitest · build · verificação F-07 no navegador
- [ ] Checkpoint: aprovação do dono → aplicar migrations no banco real (conferência E-20 depois) → advisors
- [ ] Task list × demanda conferida · handoff em `_docs/Handoffs/` · cofre atualizado (esquema, índice, mapa, memória de aprendizado)

## Decisões técnicas tomadas

- **Metas fora de `plt_eventos`:** o histórico vive em `plt_metas_eventos` própria (append-only por trigger) — plugar tipos de meta no check de `plt_eventos` mexeria nos triggers do kanban sem necessidade; meta não é card. A trilha D-40 recebe o mesmo gesto no mesmo trigger.
- **Encerrar é definitivo** (trigger recusa editar meta encerrada) e **o dono da meta não muda** — quer medir outro alvo, cria meta nova; a história de cada período fica limpa. A pessoa edita/encerra a própria meta pessoal mesmo criada por líder (letra da D-37: "segue a mesma regra").
- **"Unidades concluídas" = linhas de `plt_vw_execucoes` com fim na janela** (qualquer `encerramento` — resposta do dono). "Tempo útil" = execuções clipadas à janela via `fn_tempo_util`, em HORAS. "Tarefas" = `concluida_em` na janela.
- **Janela no banco** (`date_trunc` em America/Fortaleza; semana = segunda via `date_trunc('week')` — mudar o começo da semana é mudar SÓ na função). O front só calcula apresentação (`src/metas/progresso.ts`, com testes).
- **Porta única `plt_fn_metas_painel`** no padrão da migration 18 (security definer + gate interno espelhando o RLS; +1 WARN esperado nos advisors → total 18).
- **Migration 24 espelha os 2 gatilhos** `plt_pedidos_reagir_insercao/_atualizacao` da blindagem do backfill (ordem alfabética garante que roda depois da 17; corpo de `fn_reagir_pedido` intocado).
- **Tempo real no painel:** canal `postgres_changes` em `plt_cards` (publicação já existente) invalida pendências e metas; polling de 15s como rede de segurança. `plt_metas` NÃO entrou na publicação (CRUD de meta alheia chega pelo polling).
- **Teste `999998` colidiu** com a seção da SESSAO-09 → números da blindagem viraram 999899/999898.
- **Lint `react-hooks/set-state-in-effect`** no ModalMeta → refatorado: modal monta só quando aberto (`key` por meta), estado inicial vem da prop, sem effect.

## Arquivos criados/alterados

- `supabase/migrations/20260901120000_plt_metas.sql` (migration 23 — plt_metas, plt_metas_eventos, triggers, RLS, plt_fn_metas_painel)
- `supabase/migrations/20260901121000_plt_gatilhos_pedidos_espelho.sql` (migration 24 — espelho da blindagem)
- `supabase/testes/testar-migrations.mjs` (+21 verificações da SESSAO-14; 2 rodadas TUDO VERDE)
- `src/metas/api.ts` · `src/metas/progresso.ts` (+`progresso.test.ts`, 5 testes) · `src/metas/ModalMeta.tsx`
- `src/paginas/MeuPainel.tsx` (nova casa do `/inicio/meu-painel`)
- `src/App.tsx` (rota) · `src/paginas/Inicio.tsx` REMOVIDA (boas-vindas antiga)
- `docs/execucao/SESSAO-14.md` (este)

## Verificações rodadas

- `npm run test:banco` — 2 rodadas, TUDO VERDE (inclui as 21 novas)
- `npx tsc -b` limpo · `npm run lint` limpo · `npm test` 28/28 · `npm run build` ok
- Pendente: F-07 no navegador + critérios ao vivo — depende de aplicar as migrations no banco real (checkpoint com o dono)

## Erros e correções

- (nenhum erro digno de E-NN até aqui; colisão de número de pedido no teste e lint do effect corrigidos na hora, registrados acima)
