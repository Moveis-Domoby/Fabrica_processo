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

- (registrar aqui conforme a execução)

## Arquivos criados/alterados

- `docs/execucao/SESSAO-14.md` (este)

## Erros e correções

- (registrar na hora; espelhar E-NN no cofre quando for lição)
