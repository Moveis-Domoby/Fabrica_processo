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
- [x] Migration `plt_metas`: tabela + RLS (admin qualquer · líder do próprio setor · pessoa a própria; membros do setor LEEM a meta do setor) + eventos de meta (criação/alteração/encerramento — histórico preservado) + porta de leitura com progresso calculado (padrão migration 18) no fuso America/Fortaleza
- [x] Migration de espelhamento dos gatilhos `plt_pedidos_reagir_insercao/_atualizacao` (repo = produção)
- [x] `test:banco` 2 rodadas verde (+21 verificações)
- [x] Front — Meu Painel `/inicio/meu-painel`: Pendências (4 blocos), Avisos recentes, Cockpit (barra + % + traço "alvo até agora")
- [x] Front — metas: criar/editar/encerrar; indicador/período/alvo/dono; permissões por papel
- [x] Visibilidade: própria + setor (membro) + território do líder + admin tudo (RLS + gate da porta)
- [x] Tempo real: realtime `plt_cards` + polling 15s
- [x] `/inicio/afazeres` conferido ao vivo (tarefa criada e concluída lá)
- [x] D-40: meta_criada/alterada/encerrada na trilha (provado no banco real)
- [x] Paginação: porta com limite/deslocamento + `Paginacao` no cockpit; listas de pendência limitadas com contagem
- [x] tsc · lint · vitest 28/28 · build · F-07 ao vivo com a conta do dono (screenshots na conversa)
- [x] Checkpoint: dono autorizou na conversa → migrations 23/24 aplicadas 01/09 VIA API do Supabase (host direto do Postgres só IPv6, rede sem alcance — `banco:aplicar` falhou com ENOTFOUND); impressão digital `4050f691…` e contagens idênticas antes/depois; conferência E-20 ok; advisors 18 WARN esperados
- [x] Task list × demanda conferida · handoff `handoff_2026_09_01_sessao14_meu_painel` · cofre atualizado (esquema +23/24 e aviso do gatilho, índice, mapa, demanda, E-23/E-24)

## Registro da aplicação e do achado E-24 (01/09)

- Produção tinha **3 gatilhos** em `pedidos` (o antigo sem guarda ressuscitado pela reaplicação da S13) → **~163 cards de pedidos históricos/encerrados no PCP** (contados no banco). Migration 24 normalizou para os 2 blindados; limpeza dos 163 aguarda decisão do dono (oferecida no handoff §5).
- Teste ao vivo (conta do dono, autorizada na conversa; senha vazou no chat → aviso de troca no handoff): login → painel com pendências reais → meta diária de tarefas criada → tarefa criada (pendência subiu para 1) → concluída → **meta 100% "meta batida"** → meta encerrada. Trilha: `entrou → meta_criada → tarefa_criada → tarefa_concluida → meta_encerrada`.
- Cliques de automação falharam em acertar botões com o painel de preview deslocado (parente do E-18) → gestos disparados por JS no handler real, resultado conferido no banco.

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
