---
titulo: Handoff — SESSAO-21 · União 3 — Cutover e desligamento do projeto antigo
tipo: handoff
data: 2026-09-22
atualizado: 2026-09-22
tags: [handoff, sessao, plataforma, uniao, cutover, comercial, tiny, datacrazy]
---

# 📋 Handoff — SESSAO-21 · Cutover (União 3)

**Branch:** `sessao-21-cutover` — **entregue pelo [PR #5](https://github.com/Moveis-Domoby/Fabrica_processo/pull/5)** (o dono saiu com permissão completa: "não quebre o banco de produção e não suba nada na main — pode abrir PR, eu aprovo quando chegar").
**Demanda:** [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]] · **Memória de execução:** `_docs/Plataforma/Execucao/SESSAO-21.md` (tudo, com horários)
**Decisões:** D-46 (união; um projeto por vez para token e disparo) · riscos 1 e 2 do [[PLT - Plano Uniao das Plataformas]]

## 1. Objetivo da sessão

*"Execute a SESSAO-21 (a validação F5 já foi confirmada por mim em 21/09, faça só a reconferência rápida de paridade antes de começar). Cada passo do cutover é irreversível ou sensível: execute UM por vez e só avance com minha confirmação. Comece pelo renovador do token do Tiny e confira contagem e nomes dos crons contra o projeto antigo."*

Mudanças de rumo durante a conversa (todas do dono):
- **Pedido extra na janela:** *"aproveite para fazer uma conferência dos dados na tela … com o Tiny, 1 por 1"* — com permissão para corrigir (*"sempre o Tiny estará mais certo que a plataforma, mas analise detalhe por detalhe"*), depois *"entenda o porquê deram errado … e me informe como arrumar na raiz"*; o histórico inteiro ficou *"para depois do cutover"*.
- **Ordem:** o renovador veio antes dos crons de disparo, e a renovação manual (passo 5) foi antecipada para logo depois de ligar o renovador.
- **Autonomia:** *"pode realizar todos os passos … não precisa ficar parando"* e, ao sair, permissão completa com as duas restrições acima.

## 2. O que foi feito

### F5 — reconferência de paridade (assinada na conversa)
- Crons do antigo: **6, com nomes/horários idênticos** à nota; fábrica: só `plt-webhooks-despachar`.
- Dashboard: junho–setembro **ao centavo** (setembro: 205 · R$ 268.759,65 dos dois lados).
- 6 tabelas: delta explicado (10 membros fechados como "prazo expirado" pelo antigo em 16–17/09 + `tiny_auth`).

### F6 — a janela (horários UTC; Brasília = −3)
| Hora | Passo | Prova |
|---|---|---|
| 20:28 | 6 jobs do antigo **desativados** (`cron.alter_job(active:=false)` — renovador + 2 syncs no MESMO gesto) | 0 execuções depois; fila do pg_net 0; `tiny_auth` parado em 18:00 |
| ~20:40 | **Delta** das 6 tabelas (script da S19, rodado pelo dono — a permissão automática barrou o `--confirmar` nesta sessão) | **idênticas byte a byte** (4 · 128 · 298 · 134 · 2 · 1) |
| 21:19 | `tiny-auth-refresh-cron` **agendado na fábrica** | ativo, comando sem placeholder |
| 21:20 | **Renovação manual na fábrica** | HTTP 200; `updated_at` fábrica 18:00 → **21:20**; antigo **parado** em 18:00 |
| ~21:30 | 3 crons de disparo agendados + 1 disparo manual de cada | HTTP 200 nos 3 (nada a processar); 1ª execução automática 21:32 ✔ |
| 21:53 | Conferência | 5 jobs ativos na fábrica; `enviar-proximo` 22 execuções ok; 0 falha; 26/26 respostas HTTP 200 |
| **00:00 (23/09)** | **1ª renovação AUTOMÁTICA na fábrica** (vigia só de leitura) | `tiny-auth-refresh-cron` succeeded; `tiny_auth.updated_at` fábrica → **00:00:01 UTC**; antigo **parado** em 18:00 de 22/09, 0 jobs ativos, 0 execuções |

- **Achado que ditou a ordem fina (A-18):** as functions de sync do antigo (`tiny-auditoria-sync`, a cada 5 min) **renovavam o token sozinhas ao receber 401** — eram renovadores escondidos. Por isso saíram junto com o renovador, antes de copiar o token.
- **Webhook DataCrazy — lado da fábrica:** `webhook-datacrazy-resposta` com `verify_jwt` desligado, autenticação por `x-api-key` antes de gravar (código lido); sonda sem chave → **401** (POST) / **405** (GET).

### Conferência Tiny × plataforma (pedido extra do dono)
- **Setembro, pedido a pedido (206):** número, id do Tiny, data, valor, situação e CPF/CNPJ batem nos 206. Totais 206 · R$ 271.666,65 = Tiny. Histórico: **5.360 · R$ 4.438.186,23 = Tiny**.
- **Histórico inteiro (5.360), por impressão digital em faixas de 100 (A-14/A-19):** 54/55 faixas idênticas no fim; a que sobra é o pedido 11710 — **não é erro** (o Tiny guarda "&#39;" no nome; só a lista dele decodifica).
- **Corrigidos (15 pedidos + 2 cadastros), com ensaio A-11 e guarda atômica:**
  - marcador **"Devolvido"** ausente — 10 pedidos cancelados (13432, 13390, 13377, 13376, 13327, 13304, 13302, 13275, 12679, 12830);
  - **campo limpo no Tiny e preso no banco** — previsão (13276), observação interna (13180, 13410), vendedor (13183, 13421 — o Tiny nem manda a chave quando vazio);
  - **contato renomeado** no Tiny (nome antigo com bairro/origem depois de "/") — pedidos 8136, 13429, 8205, 9545 e cadastros 335 e 2192.
- **Causa-raiz** (provada, não deduzida) e **correção de raiz** registradas: [[N8N - Pendencias e Riscos]] **P17** → [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] (🔶, 4 perguntas suas).

### Front
- **Nenhuma mudança publicada.** A virada de `DISPARO_LIBERADO` foi barrada pela permissão automática (motivo: liga envio real de WhatsApp) e a edição foi desfeita — ficou com você (§8).

### Banco (produção — só dados e agendamentos; nenhuma mudança de estrutura)
- 4 jobs `pg_cron` novos na fábrica; 6 desativados no antigo.
- Delta das 6 tabelas do disparo (inclui `tiny_auth`).
- Correções de dado: `supabase/manutencao/2026-09-22_correcoes_conferencia_tiny.sql` e `..._correcoes_auditoria_historico.sql`.
- Nenhum evento de produção gerado pelas correções (conferido: os cards afetados não têm unidades).

### Edge Functions
- Nenhum deploy. As 6 da fábrica passaram a ser chamadas pelos crons.

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Desativar (`alter_job active=false`) no antigo em vez de `unschedule` | `unschedule` direto | O comando (com a chave) fica guardado no banco: volta atrás sem a chave passar pelo chat — valeu até a 1ª renovação na fábrica |
| Renovador + 2 syncs do antigo no mesmo gesto | Desligar só o renovador | Os syncs renovavam sozinhos em 401 (A-18) |
| Agendar por script local com a chave lida do `.env.local` | Colar a anon key no MCP | Regra 4 — nenhuma chave no chat |
| Manter `verify_jwt` ligado nas 4 functions | Desligar como no antigo | Mais seguro; o cron manda a anon key |
| Renovação manual logo depois do renovador (antes do disparo) | A ordem 1→5 da demanda | Pedido do dono; prova o renovador enquanto a volta atrás ainda era simples |
| Correções de dado por SQL direto guardado, com ensaio e guarda | Reprocessar pela `tiny_fila` | O backfill do n8n está parado desde 10/09 (não confirmável daqui) e, para cliente sem CPF, o reprocessamento criaria **cliente duplicado** |
| Nome corrigido **derivado** do antigo e conferido por hash do Tiny | Digitar o nome no SQL | Nenhum dado pessoal em arquivo versionado |
| Não revogar a `fn_pedido_por_numero_nf` do anon nesta sessão | Revogar já | Não dá para provar daqui que nenhuma automação externa (n8n da VPS) a chama — "não quebrar produção" |

## 4. Bugs

### Resolvidos
- **DT-ARQ5** (crons não versionados no repo da fábrica) — ✅ `supabase/cron/cron_comercial.sql`.
- Acumulado de deriva Tiny × banco — 15 pedidos + 2 cadastros (acima).

### Descobertos
- **P17** — o webhook de vendas não cobre marcador, contato renomeado nem campo limpo (+ `coalesce` do `fn_upsert_pedido`; vazio pode vir como chave ausente) → SESSAO-29.
- **A-18** (memória) — renovador escondido em função que renova no 401.
- **E-36** (memória) — dois nomes de coluna escritos de memória em consulta de leitura (sem dano).
- **A-19** (memória) — divergência em massa com contagem igual = suspeitar da fórmula (coluna de tela ≠ campo da API).

## 5. Arquivos alterados

```
supabase/cron/cron_comercial.sql                                  (novo — modelo dos 4 crons, DT-ARQ5)
supabase/manutencao/2026-09-22_agendar_crons_comercial.mjs         (novo — agendador com guardas)
supabase/manutencao/2026-09-22_correcoes_conferencia_tiny.sql      (novo — setembro)
supabase/manutencao/2026-09-22_correcoes_auditoria_historico.sql   (novo — histórico)
_docs/Plataforma/Execucao/SESSAO-21.md                             (novo)
_docs/Handoffs/handoff_2026_09_22_sessao21_cutover.md              (novo)
_docs/Plataforma/Demandas/SESSAO-29 - Reconciliacao Tiny - …md     (novo, 🔶)
_docs/Plataforma/Demandas/SESSAO-21 - Uniao 3 - …md                (resultado + aceite; inclui a promoção a 📐 que o Cowork deixou sem commit)
_docs/Plataforma/Demandas/000 - ORDEM DAS SESSOES.md
_docs/Plataforma/PLT - Memoria de Aprendizado.md                   (A-18, A-19, E-36)
_docs/Plataforma/PLT - Comercial - Legado e Cutover.md · Maquina de Estados do Disparo.md · Integracao DataCrazy.md
_docs/Supabase-fabrica/SUPA - Comercial - Cron e Rotinas.md · Edge Functions.md · Dominio de Dados.md · SUPA - Esquema do Banco.md
_docs/Fabrica n8n/N8N - Pendencias e Riscos.md (P17 — o arquivo trazia o P16 do Cowork sem commit) · N8N - API Tiny v2 vs v3.md · N8N - Tiny Integracoes Referencia.md
_docs/CLAUDE.md (regra do renovador e do disparo — o arquivo trazia a regra "banco enxuto" do Cowork sem commit)
_docs/000 - MAPA DO PROJETO.md · _docs/Planejamento/000 - PROXIMOS PASSOS.md (este trazia alteração do Cowork sem commit)
Fora do repo: Planilha de recompra/_Docs/000 - MIGRADO PARA O COFRE DA FABRICA.md (nota de encerramento — NÃO commitada: é outro repositório)
```
Não entram no PR (trabalho do Cowork de 21/09, intocado — E-23): `supabase-fabrica-schema.sql` (espelho da migration 23), `23_tiny_fabrica_produtos.sql`, notas `N8N - Tiny Fabrica *`, `PROMPT - Bloco 5`, `Claude outputs/`.

## 6. Impacto nos números visíveis

> [!warning] Nenhum total mudou
> Pedidos, receita, contagens e dashboards do Comercial e da produção **não mudaram** — as correções não tocaram valor, data nem situação. O que muda na tela: o **nome exibido** de 3 clientes (pedidos 8136/13429, 8205 e 9545 — sem o "/ bairro / origem"), o marcador **"Devolvido"** em 10 pedidos cancelados, e a previsão/observação interna/vendedor sumindo em 5 pedidos onde o Tiny já não tinha. Os clientes renomeados têm telefone, então a identidade do Comercial (telefone) não mudou — nenhum cliente foi fundido ou separado.

## 7. Notas do cofre atualizadas

[[SUPA - Comercial - Cron e Rotinas]] · [[SUPA - Comercial - Edge Functions]] · [[SUPA - Comercial - Dominio de Dados]] · [[SUPA - Esquema do Banco]] · [[PLT - Comercial - Legado e Cutover]] · [[PLT - Comercial - Maquina de Estados do Disparo]] · [[PLT - Comercial - Integracao DataCrazy]] · [[N8N - Pendencias e Riscos]] · [[N8N - API Tiny v2 vs v3]] · [[N8N - Tiny Integracoes Referencia]] · [[PLT - Memoria de Aprendizado]] · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · [[000 - PROXIMOS PASSOS]] · `_docs/CLAUDE.md` · [[SESSAO-21 - Uniao 3 - Cutover e Desligamento]] · [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]]

## 8. Ficou pendente — o que é SEU, na ordem

> [!success] Atualização 23/09/2026 — respostas do dono
> 1. ✅ **PR #5 aprovado e mesclado** (00:30 UTC).
> 2. ✅ **URL do DataCrazy trocada** pelo dono. Validação no 1º evento real em `webhook_eventos_crm` (nenhum ainda — nenhuma lista enviando).
> 3. ✅ **Trava aberta** a pedido do dono ("só cuidado pra não disparar pra ninguém") — [PR #6](https://github.com/Moveis-Domoby/Fabrica_processo/pull/6). Conferido antes: 4 listas `em_andamento`, 128 membros em estado final; envio só por clique; o cron só envia para lista `disparando`.
> 4. **6 jobs desativados no antigo:** o dono perguntou se pode deixá-los assim. Resposta: pode, até a F7 — o risco é só alguém reativar à mão no painel (o renovador de lá tentaria um token morto). Somem sozinhos quando o projeto for excluído.
> 5. **1ª lista real:** o dono roda quando for usar — **não é pendência** ("vou lembrar disso se der erro").
> 6. **Backup final: dispensado** — os dados de clientes estão no Tiny e as 6 tabelas do disparo já estão na fábrica byte a byte; nada exclusivo ficou no projeto antigo.
> 7. ✅ **3 apontamentos de segurança — resolvidos** (migration 32, aplicada em 23/09 com aprovação do dono depois de conferir os 4 workflows principais do n8n, o uso interno e os logs da API): função fechada para quem não tem login (sonda → 401) e `search_path` fixo nas duas; a tabela do Atendimento segue fechada de propósito.
> 8. As 4 perguntas da SESSAO-29: explicadas ao dono em linguagem simples — aguardam a resposta dele.
> ⚠️ **Novo (23/09):** o JSON do workflow de vendas que o dono colou na conversa traz o **token da API v2 do Tiny em texto puro** (node `Tiny · pedido.obter` — é a P4). Como passou pelo chat: gerar token novo no Tiny e trocar o valor fixo por `{{ $env.TINY_TOKEN }}` (E-03). Gesto do dono.
> **Atualização da mesma noite (23/09, respostas do dono):**
> - **F7: exclusão do projeto antigo em 06/10/2026** (backup dispensado).
> - **Token v2 do Tiny: o dono decidiu NÃO trocar** ("é de uma conta que não tem problema vazar só pra você, ninguém mais sabe") — decisão dele, registrada.
> - **SESSAO-29:** 60 dias ✅ · 3h ✅ · regra de gravação ✅ → **D-50**: edição no Tiny edita aqui, apagar no Tiny **não** apaga aqui (só observações acompanham). Pergunta 4 reexplicada; pergunta nova sobre marcador removido.
> - **Retroativo da D-50:** a previsão do 13276 apagada em 22/09 foi **devolvida** (11/09) — `supabase/manutencao/2026-09-23_restaurar_previsao_13276.sql`, ensaio + guarda, 0 eventos. Observações internas limpas (13180, 13410) ficam limpas (permitido). **Vendedor de 13183 e 13421:** o nome antigo não está guardado em lugar nenhum da plataforma — se o dono souber, devolvemos; senão fica vazio (como no Tiny).
> - ⚠️ **O PR #6 foi mesclado (01:31 UTC) antes de os commits da migration 32 chegarem à branch (01:38)** — a migration já estava aplicada em produção, mas o arquivo ficou fora da `main`. Os 2 commits foram trazidos para o PR #7 (E-38).
> - **Perguntas 4 e 5 da SESSAO-29:** nenhum combinado com a equipe de vendas (item D descartado — a plataforma se vira sozinha) · marcadores ficam como estão. → **SESSAO-29 📐 pronta para code.**
> **Continua em aberto (com o dono):** aprovar o PR #7 · excluir o projeto antigo em 06/10 · (opcional) vendedor de 13183/13421.
>
> 🏁 **SESSAO-21 finalizada em 23/09/2026** a pedido do dono (*"podemos finalizar?"*).
>
> A lista abaixo é a de 22/09, mantida como estava.

1. **Revisar e aprovar o PR** da branch `sessao-21-cutover` (só docs + scripts + SQL de manutenção — nenhuma tela muda).
2. **DataCrazy — trocar a URL do webhook de resposta** em cada automação que devolve evento (`resposta_recebida` / `sem_resposta` / `erro_envio`) para:
   `https://axnzldwgwsmepukdiljx.supabase.co/functions/v1/webhook-datacrazy-resposta`
   Mantenha o header `x-api-key` com **o mesmo valor que você cadastrou em 15/09 como `DATACRAZY_WEBHOOK_SECRET` na fábrica** (se lá você colocou um valor diferente do antigo, atualize o header também). Não cole o valor em chat. Validação: o próximo evento aparece em `webhook_eventos_crm` da fábrica (§9).
3. **Destravar o disparo** (só depois do item 2). É uma linha — `src/comercial/travas.ts`: `DISPARO_LIBERADO = true` — e o teste `src/comercial/travas.test.ts` passa a esperar `true` (o 2º teste, "iniciarFila recusa…", sai: ele testa o estado fechado). A permissão automática não me deixou fazer; peça "pode destravar" numa conversa e eu faço com PR, ou faça você.
4. **Apagar de vez os 6 jobs do projeto antigo** (hoje só desativados — um clique no painel os religaria, e o renovador de lá usaria um token morto). No SQL Editor do projeto **"Painel de recompra"**:
   ```sql
   select jobname, cron.unschedule(jobid) from cron.job;
   select count(*) from cron.job;   -- esperado: 0
   ```
5. **Primeira lista real** (critério de aceite): depois de 2 e 3, rodar uma lista pequena e acompanhar envio → resposta (evento em `webhook_eventos_crm`) → verificação de venda.
6. **Aceite das 24h do token:** conferir até ~18:20 de Brasília de 23/09 que `tiny_auth.updated_at` da fábrica avançou a cada 3h (00, 03, 06 … UTC) — SQL no §9.
7. **F7 — data da quarentena (2–4 semanas).** No dia: backup final do projeto antigo (**fora do git** — tem dado de cliente; sugestão: pasta própria fora do repositório, com o caminho anotado no cofre) → pausar → excluir.
8. **3 apontamentos de segurança herdados** (levantamento feito, decisão sua):
   - `fn_pedido_por_numero_nf` executável por quem não tem login — devolve **só** o número interno de um pedido a partir do nº da NF (sem dado de cliente); nenhum código do repositório a chama pela API. **Recomendo revogar**, depois de confirmar que nenhuma automação do n8n na VPS chama `/rest/v1/rpc/fn_pedido_por_numero_nf`: `revoke execute on function public.fn_pedido_por_numero_nf(integer) from anon, authenticated;`
   - `fn_backfill_conta_mapear` e `fn_vig_touch` sem `search_path` — triviais; `alter function … set search_path = public` não muda comportamento.
   - `vig_conhecimento_vendas` sem policy — **em uso pelo Atendimento**; fechada ao navegador de propósito (como a `tiny_auth`). Recomendo deixar.
   Os dois primeiros viram migration (espelho no repo — E-24) numa sessão curta, com sua aprovação.
9. **SESSAO-29:** responder as 4 perguntas da demanda.

### Próximo passo sugerido
Itens 2 → 3 → 4 hoje/amanhã; SESSAO-23 segue o Bloco 5; encaixar a SESSAO-29 cedo (a deriva volta sem ela).

## 9. Como validar

```sql
-- FÁBRICA: 5 jobs (plt + 4 comerciais), todos ativos
select jobname, schedule, active from cron.job order by jobname;

-- FÁBRICA: o token avançando a cada 3h (só datas — nunca o token)
select updated_at, now() - updated_at as idade from public.tiny_auth;

-- FÁBRICA: execuções do renovador e falhas
select j.jobname, d.status, d.start_time from cron.job_run_details d join cron.job j using (jobid)
 where j.jobname = 'tiny-auth-refresh-cron' order by d.start_time desc limit 10;

-- FÁBRICA: depois de repontar o DataCrazy, o 1º evento chega aqui
select tipo, recebido_em, processado, erro_processamento from public.webhook_eventos_crm order by recebido_em desc limit 5;

-- ANTIGO: nenhum job ativo (depois do item 4: nenhum job)
select jobname, active from cron.job;
```
Conferência Tiny × banco repetível: método e fórmulas em `_docs/Plataforma/Execucao/SESSAO-21.md` (a SESSAO-29 a transforma em rotina).
