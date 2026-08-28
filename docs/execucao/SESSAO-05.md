# Memória de execução — SESSAO-05 · Timers e Eventos de Tempo

**Branch:** `sessao-05-timers-eventos` · **Início:** 2026-08-27
**Demanda:** `_docs/Plataforma/Demandas/SESSAO-05 - Timers e Eventos de Tempo.md` (lida 2x)

## Respostas do dono no início da sessão (viram a D-24)

1. **Vários cards em execução pela mesma pessoa: PODE**, contanto que o tempo conte.
   Mas nasce uma **configuração no painel de admin: limite de cards em execução por
   pessoa em cada setor, por vez** — padrão SEM limite, configurável por setor.
2. **Iniciar é obrigatório** antes de finalizar — mesmo que finalize um instante depois.
3. **Mover card com execução aberta → a execução encerra automaticamente** naquele
   instante (o tempo conta até o mover, para quem estava executando).
4. **Admin pode tudo** — estorno incluído, em qualquer setor. Líder estorna no próprio setor.
5. **Transferência entre pessoas:** o tempo finaliza para um, inicia para o outro —
   e continua contando para o produto. (Gesto "assumir": novo `execucao_iniciada`
   por outra pessoa fecha a execução anterior no mesmo instante.)

**Permissões desta sessão (ditas na conversa):** aplicar no banco sem pedir de novo,
subir no GitHub, testar com o acesso do dono (credencial NÃO registrada em lugar nenhum
— regra crítica 4; o dono troca a senha antes de produção).

## Task list (espelho da demanda)

- [x] Ler demanda 2x + decisões + design system + memória de aprendizado
- [x] Dúvidas de negócio respondidas → registrar **D-24** no cofre + atualizar a demanda
- [x] Branch `sessao-05-timers-eventos`
- [ ] **Migration 14** — regras de execução e estorno:
  - [ ] tipo de evento `estorno` (referencia o evento anulado; append-only preservado)
  - [ ] validações por trigger (valem até para service_role): iniciar obrigatório antes
        de finalizar; sem dupla execução do mesmo usuário no mesmo card; limite por
        pessoa/setor (D-24); estorno só líder do setor do card ou admin; estorno só de
        execucao_iniciada/execucao_finalizada não estornados do mesmo card
  - [ ] coluna `plt_setores.limite_execucoes_por_pessoa` (null = sem limite)
  - [ ] projeção: `execucao_iniciada` por outra pessoa transfere o executor;
        `estorno` recomputa o executor do card
  - [ ] `plt_vw_execucoes` reescrita: fecha em finalizada OU transferência OU
        movimentação; ignora estornados; setor/etapa da ÉPOCA da execução
  - [ ] RPC `plt_fn_linha_tempo_card` (gate = quem vê o card; padrão E-11)
- [ ] Testes de banco (testar-migrations.mjs): cenários das regras acima ×2 rodadas
- [ ] Front:
  - [ ] api.ts: iniciar/finalizar/assumir execução, estornar, linha do tempo
  - [ ] CartaoUnidade: contador fila vs execução, executor, botões Iniciar/Finalizar/
        Assumir (≥44px), indicador de espera (mais antigo sem iniciar)
  - [ ] ModalMoverCard: aviso quando mover encerra execução aberta (D-24)
  - [ ] Modal linha do tempo: por etapa — fila, execução, total, autores; estorno
        visível (evento anulado riscado, nunca some); botão estornar p/ líder-admin
  - [ ] Estrutura: campo limite de execuções por pessoa (admin)
- [ ] Verificação F-07: tsc, lint, testes, 375px e 768px
- [ ] Aplicar migration no banco real (autorizado) + get_advisors + conferir integração
- [ ] Teste real no navegador (critérios de aceite da demanda)
- [ ] Atualizar cofre: SUPA - Esquema do Banco, memória de aprendizado, demanda,
      ORDEM DAS SESSOES, MAPA + handoff em _docs/Handoffs/
- [ ] Conferir task list contra a demanda → checkpoint com o dono

## Decisões técnicas tomadas

- **Gestos gravam evento por INSERT direto** em `plt_eventos` (RLS já cobre), como a
  SESSAO-04; **as REGRAS vivem em trigger** no banco — porque a API/n8n (service_role)
  ignora RLS (M-14) e as regras da D-24 têm que valer para todo mundo.
- **Estorno via RPC** `plt_fn_estornar_evento` (security definer, gate interno líder/
  admin) — o RLS de INSERT em eventos exige vínculo com setor; o estorno de líder/admin
  precisa de gate próprio, e o padrão da casa para isso é RPC com gate dentro (E-11).
- **Transferência = novo `execucao_iniciada` por outra pessoa** — sem tipo de evento
  novo; a view fecha a execução anterior no instante da nova. `dados.transferido_de`
  registra de quem veio, para a linha do tempo contar a história.
- **Sem FK/coluna nova em plt_eventos** — `estorno` usa o `evento_referencia_id` que
  já existe (mesmo mecanismo do parecer de qualidade).
- **Linha do tempo montada no front** a partir dos eventos enriquecidos da RPC (nomes
  de pessoas/setores/etapas); segmentos fila/execução calculados em TS puro e testados
  em Vitest. As views continuam sendo a verdade para dashboards (SESSAO-10).

## Erros encontrados

(nenhum ainda)

## Comandos rodados

- `git checkout -b sessao-05-timers-eventos`
