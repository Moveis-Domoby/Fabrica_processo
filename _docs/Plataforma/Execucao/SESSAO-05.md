# Memória de execução — SESSAO-05 · Timers e Eventos de Tempo

**Branch:** `sessao-05-timers-eventos` · **Início/entrega:** 2026-08-27
**Demanda:** `_docs/Plataforma/Demandas/SESSAO-05 - Timers e Eventos de Tempo.md` (lida 2x)

## Respostas do dono no início da sessão (viraram a D-24)

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

## Task list (espelho da demanda) — conferida contra a demanda ao final

- [x] Ler demanda 2x + decisões + design system + memória de aprendizado
- [x] Dúvidas de negócio respondidas → **D-24** registrada no cofre + demanda atualizada
- [x] Branch `sessao-05-timers-eventos`
- [x] **Migration 14** (`20260827150000_plt_execucao_estorno.sql`):
  - [x] tipo de evento `estorno` (CHECK recriado por nome dinâmico, idempotente)
  - [x] trigger `fn_validar_execucao` (BEFORE INSERT): iniciar obrigatório; execução
        exige pessoa; sem dupla execução do mesmo usuário; limite por pessoa/setor;
        card concluído não executa; estorno só do último gesto, por líder/admin;
        preenche setor/etapa de origem dos gestos (linha do tempo sabe ONDE)
  - [x] `plt_setores.limite_execucoes_por_pessoa` (null = sem limite, check > 0)
  - [x] projeção: transferência troca executor; estorno reprojeta via `fn_executor_pelo_log`
  - [x] `plt_vw_execucoes` recriada (drop+create): fecha em finalizada/transferência/
        movimentação (coluna `encerramento`), ignora estornados, setor/etapa da época
  - [x] RPCs `plt_fn_linha_tempo_card` e `plt_fn_estornar_evento` (padrão E-11)
- [x] Testes de banco: 22 verificações novas → **TUDO VERDE**, 2 rodadas, integração intacta
- [x] Front: api (iniciar/finalizar/assumir/estornar/linha do tempo/execuções abertas/nomes),
      CartaoUnidade (fila vs execução, executor, botões ≥44px, indicador de espera),
      QuadroKanban (contexto de execução), QuadroSetor (mutations + modais),
      ModalLinhaTempo (segmentos + eventos crus + estorno), ModalMoverCard (aviso D-24),
      Estrutura (campo limite, admin), linha-tempo.ts (montagem pura + 7 testes)
- [x] `tsc` limpo · lint limpo · Vitest 15/15 · build de produção ok
- [x] Migration aplicada no banco real — impressão digital idêntica, contagens intactas
- [x] `get_advisors`: 6 WARN esperados (4 da migration 13 + 2 RPCs novas, endpoints de
      propósito) + INFO pré-existentes da integração + WARN do Auth pré-existente
- [x] Teste real no navegador (admin Wallace): criar card 13207 → liberar p/ SECC →
      Iniciar → limite 1 recusa 2º card (mensagem do banco em pt no toast) → sem limite
      2 execuções simultâneas → mover com execução aberta avisa e encerra → Finalizar →
      linha do tempo com fila/execução/total/autores → estorno da finalização reabre a
      execução, evento original riscado, observação gravada → F-07: 375px e 768px sem
      rolagem horizontal, alvos 44px
- [x] Cofre atualizado: D-24, demanda, SUPA - Esquema, memória de aprendizado (E-17),
      design-system.md, ORDEM DAS SESSOES, MAPA + handoff

## Decisões técnicas tomadas

- **Gestos gravam evento por INSERT direto** em `plt_eventos` (RLS já cobre); **as REGRAS
  vivem em trigger** — a API/n8n (service_role) ignora RLS (M-14) e a D-24 vale para todos.
- **Trigger de validação é security definer** (lição E-14: trigger comum roda com o
  privilégio de quem insere e não enxergaria `plt_privado`/tabelas sob RLS).
- **Estorno via RPC** `plt_fn_estornar_evento` — o RLS de INSERT exige vínculo com setor
  e o admin estorna onde não trabalha; o gate de verdade fica no trigger (vale p/ todos).
- **Estorno só do ÚLTIMO gesto de execução válido** (desfaz-se do mais novo para trás) —
  mantém a história sempre coerente sem cascatas; a UI mostra o botão só nele.
- **Transferência = novo `execucao_iniciada` por outra pessoa** — sem tipo novo de evento;
  a view fecha a anterior no instante da nova; `dados.transferido_de` conta a história.
- **Execução exige pessoa e card não concluído** (derivação de D-02 "execução é da pessoa"
  e D-13 "terminal = fim de linha") — anotado aqui por ser derivação, não texto literal.
- **Linha do tempo montada no front** (`linha-tempo.ts`, lógica pura testada) a partir da
  RPC enriquecida; as views continuam sendo a verdade para dashboards (SESSAO-10).
- **Card recém-finalizado volta a mostrar "na fila"** no quadro (contador simples do
  `desde`); o tempo REAL pós-finalização fica correto na linha do tempo e nas views —
  refinamento de rótulo fica para quando incomodar.

## Erros encontrados e corrigidos

- **E-17** (registrado na memória de aprendizado): `create or replace view` não muda a
  forma da view → `drop view if exists` + `create view`, inclusive na migration 07 antiga
  (senão a 2ª rodada do teste quebra). Pego na hora pelo `test:banco`.

## Estado que ficou no banco (teste real, permanente por desenho)

- Card do **pedido 13207** (Cadeira Tiffany, 1/1) na Chegada da SECC — passou por:
  iniciar → finalizar → **estorno** (obs.: "finalizei sem querer (teste da SESSAO-05)")
  → finalizar de novo. 13 eventos novos ao todo na sessão, todos append-only.
- Card do **13192** em EM CORTE (TESTE) com execução encerrada por movimentação (35s).
- `limite_execucoes_por_pessoa` da SECC: setado 1 no teste e **removido** (null) ao final.

## Comandos rodados

- `git checkout -b sessao-05-timers-eventos`
- `npm run test:banco` (3×: 1 falha de forma de view → E-17 → verde nas 2 rodadas)
- `npx vitest run src/kanban/linha-tempo.test.ts` · `npx tsc -b` · `npm run lint` · `npm test`
- `npm run banco:aplicar -- --confirmar` (autorizado na conversa; digital idêntica)
- `get_advisors` (security) · SQL de conferência dos eventos gravados
- `npm run build`
