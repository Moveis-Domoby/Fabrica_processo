---
titulo: SESSAO-38 · frente F4 — Motivos de pausa especiais que não contam o tempo do funcionário
tipo: execucao
data: 2026-10-21
branch: sessao-38-pausa-especial
decisoes: [D-164, D-165, D-166]
aprendizados: [E-133, E-134, A-95, A-96]
---

# SESSAO-38 · F4 — Pausa especial (memória de execução)

Sessão noturna autônoma, sob um supervisor (o dono não é consultado). Worktree própria, branch `sessao-38-pausa-especial` a partir da `main` (`bd75dd2`).

## 1 · O que é "o tempo do funcionário" aqui (levantado ANTES de mudar)

- **Presença (SESSAO-36, migration 96):** cada pessoa tem um segmento aberto por vez em `plt_presenca_segmentos` — `trabalhando` (execução OU auxílio aberto e não pausado), `ausente` (tem entrada num setor e nada rodando), `deriva` (saiu do setor sem entrar em outro). `fn_presenca_recalcular` troca de segmento; no FECHAMENTO, `fn_tempos_dia_somar` soma no agregado `plt_tempos_pessoa_dia` (dia de Fortaleza; ausente/deriva com teto de 12 h por trecho). Disparos: gatilho de `plt_cards` (executor/pausado/arquivado/concluído/setor), de `plt_auxilios`, entrada automática ao iniciar/retomar/auxiliar, portas pessoa_entrar/pausar/sair.
- **Dashboard "Tempos por pessoa"** (`plt_fn_tempos_pessoas`, `plt_fn_tempos_pessoa_detalhe`): produção · ausente · fora de setor, do agregado + trecho aberto; por setor e por móvel (tempo, tempo parado = `pausa_total` da execução, motivos).
- **Tempo de execução** (`plt_vw_execucoes`): do iniciar ao fim MENOS os intervalos pausados (`fn_pausas_execucao`). Dashboards Pessoas / Meu desempenho / tempo do card leem daí — **toda pausa já não conta**, especial ou não.
- **Conclusão:** o que conta CONTRA a pessoa é o **ausente**. A pausa (de qualquer motivo) deixa a pessoa ausente. "Não contar" = o trecho parado por motivo especial sai do ausente.
- **Retrato do banco (21/10 05:29 UTC):** motivos de pausa 60–65 + 71 ("Falta de material", "Manutenção da máquina", "Esperando peça de outro setor", "Urgência de outro pedido", "Fim do expediente", "Conferir com o líder", "Almoço"); nenhum com o mesmo nome dos três do dono. Em toda a produção: **1** pausa (`execucao_pausada` "Fim do turno", da saída), 0 paradas no PARADO, 46 segmentos, 7 linhas de agregado → **não há histórico a corrigir**.

## 2 · Decisões técnicas

- Marca `plt_motivos.especial` (só pausa — check). Sementes uma vez só (dentro do `if not exists column`), por nome comparável (`fn_nome_comparavel`).
- **Não** mudar `plt_fn_motivos` (a lista do funcionário não leva a marca). Porta nova `plt_fn_motivos_config` (só admin) para Utilitários.
- `plt_fn_motivo_salvar` + `p_especial` (drop + create; 5 nomes do site antigo casam com o default; nulo = não mexe).
- **Estado do segmento continua `ausente`** + coluna `especial` (o quadro/tablet de outra frente lê `estado` e não muda — o funcionário vê "Ausente"). Só o agregado ganha o estado `especial` no fechamento (A-95).
- Projeção `plt_pessoa_pausas` (origem execucao/auxilio/parada; marca do momento do gesto), gatilho `plt_eventos_pausas_pessoa` (ordena antes de `plt_eventos_projetar` — no PARADO lê o executor antes de a movimentação apagá-lo), gatilho em `plt_presenca_eventos` (entrar/sair encerra as paradas). A parada aberta MAIS RECENTE decide.
- `plt_fn_pessoa_pausar` passa `motivo_id` no fato do auxílio; auxílio pausado junto com o card herda o `motivo_id` da pausa do card (lido no gatilho).
- Dashboard: `especial_s`/`estado_especial` (colunas novas no fim → drop + create; drop também nas migrations antigas 97 e 98 — E-17) e chaves novas no detalhe; tudo zerado para quem não vê todos.
- Nada de tipo de evento novo; nenhuma mudança em `plt_fn_card_pausar`/`plt_fn_card_parar`, na linha do tempo do card nem na janela.

## 3 · Arquivos

- `supabase/migrations/20261022040000_plt_pausa_especial.sql` (novo).
- `supabase/migrations/20261018220000_plt_tempos_por_pessoa.sql` e `20261019120000_plt_niveis_pins_pausa_pessoal.sql`: só o `drop function if exists public.plt_fn_tempos_pessoas(...)` antes do create (E-17) e os grants refeitos na 98.
- `supabase/testes/testar-migrations.mjs`: bloco novo `{ }` no fim (E-70) — 17 verificações.
- `src/utilitarios/api.ts` (`listarMotivosComMarca`, `salvarMotivoComMarca`, `MotivoComMarca`), `src/paginas/Utilitarios.tsx` (só a lista de pausa: caixinha, pílula, explicação), `src/dashboards/api.ts` (tipos), `src/dashboards/pausaEspecial.ts` (+ teste), `src/paginas/dashboards/TemposPessoas.tsx` (+ teste), `src/paginas/Utilitarios.test.tsx`.
- Cofre: Decisões (D-164…D-166), Memória (E-133, E-134, A-95, A-96), SUPA - Esquema do Banco.

## 4 · Comandos e resultados

- Bateria do banco de partida: verde. Com a migration: 1 falha (E-133) → corrigida → **verde**.
- `npm run build` ✔ · `npm run lint` ✔ · `npm test` ✔ (211; o teste de `AdminApi` "o dono toca no botão…" falhou 2 vezes na suíte cheia e passou sozinho e na 3ª rodada — instável por tempo, não toca nada desta frente).
- Conferência de mojibake no `src`: vazia. Prettier só nos arquivos do `src` tocados (a bateria não se formata — E-110).
- **A-96:** md5 dos corpos vivos = corpos dos arquivos base (7 funções) antes de aplicar.
- **Aplicada em produção** às 05:47 UTC de 21/10: `npm run banco:aplicar -- --confirmar --so 20261022040000_plt_pausa_especial.sql` — integração idêntica. Linhas criadas: `plt_motivos` 72 "Faltou peça", 73 "Máquina quebrou", 74 "Pausa solicitada por um líder" (ordem 70/80/90, especiais). Nenhuma linha existente alterada. `plt_pessoa_pausas` nasceu vazia (nenhum card pausado na hora).
- **Prova no banco real sem gravar (A-75):** bloco `DO` com card avulso de ensaio, operador real e admin real, terminando em `RAISE`: pausa por "Máquina quebrou" pelo admin → segmento do operador `ausente` + especial; 30 min recuados → retomar → agregado do dia `{especial: 1800}` (ausente nada); admin vê `especial_s 1800, ausente_s 0`; o próprio operador vê `0/0/false`; a lista do funcionário só tem `id, tipo, texto, ordem, ativo`; `plt_fn_motivos_config` recusada ao operador; o salvar antigo (5 nomes) manteve a marca. Tempos: scorecard 107 ms frio → **8,5–9,9 ms** quente; detalhe **5 ms**.
- **×100:** o termo novo por execução são buscas por índice (`plt_eventos_referencia_idx`), sem varredura — plano em tabela temporária de 600 mil eventos/1.000 execuções: só `Index Scan` aninhado (o tempo absoluto ali foi distorcido pela tabela temporária fora do cache). Dívida que já existia e segue: a dashboard lê `plt_vw_execucoes` (view sobre eventos) para a lista por móvel.
- Advisors: `plt_pessoa_pausas` RLS sem política (de propósito, como as da presença) e `plt_fn_motivos_config` definer com gate de admin dentro (padrão da casa).

## 5 · Checklist de desempenho (Lei)

- 1 requisição por tela: Utilitários → aba de pausa troca a leitura (não soma); Tempos por pessoa segue 1 + o detalhe no clique.
- Nada de relógio nem polling: tudo nasce do fato (gatilhos).
- Índices: `plt_pessoa_pausas` por pessoa (aberta, ordem de início), por card (aberta), por evento e por motivo; e (complemento `20261022040001_plt_pausa_especial_indices.sql`, aplicado logo depois, `--so`, integração idêntica, bateria verde) os índices cheios das chaves estrangeiras de pessoa e card.
- Porta de painel ≤ 150 ms: 8,5 ms quente.
