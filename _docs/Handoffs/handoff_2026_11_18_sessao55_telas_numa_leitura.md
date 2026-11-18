---
titulo: Handoff — SESSAO-55 · telas que ainda abriam com mais de uma leitura (Meu Painel/Afazeres, painéis e configurações)
tipo: handoff
data: 2026-11-18
tags: [handoff, sessao-55, desempenho, dashboards, configuracoes, meu-painel]
---

# 📋 Handoff — SESSAO-55 · Telas que abrem com uma leitura (18/11/2026, madrugada — mesa da fila)

Demanda: [[SESSAO-55 - Telas que Abrem com Uma Leitura Dashboards Configuracoes e Meu Painel]] · Diário: [[SESSAO-55]] · Ensaio: [[SESSAO-55 - ensaio x100 das portas de abertura (resultado, 2026-11-18).txt|resultado ×100]]

> ⏳ **NÃO está no ar.** Tudo no ramo `sessao-55-telas-numa-leitura` (8 commits): **nada na main, nenhuma atualização aplicada no banco, nada publicado, nada no n8n, nada no ClickUp.** A sessão rodou sem o dono na conversa — as escolhas viraram decisões provisórias (seção 6). **A demanda não foi linkada na Ordem das Sessões e as notas grandes não foram editadas** (regra da leva): o que é delas está na seção 8.

## 1. Objetivo

As dívidas 18 e 20 da Lei de Desempenho: cada tela abre com **1 requisição**, pela porta de abertura dela. Para quem usa, **nada muda na tela** — os mesmos números e botões, com menos idas ao banco.

## 2. O que foi feito

| Tela | Antes | Agora |
|---|---|---|
| O aviso do trabalho da pessoa (a bolinha, em qualquer tela) | 2 leituras | **1** |
| O aviso do trabalho no Meu Painel | 4 | **1** |
| Chegar ao Meu Painel vindo de outra tela | 5 | **1** |
| Meus afazeres | 4 (uma em cascata) | **1** |
| Painéis → Pessoas | 4 (em cascata com visualização salva no endereço) | **1** |
| Painéis → Qualidade | 4 (idem) | **1** |
| Painéis → Meu desempenho | 3 | **1** |
| Painéis → Tempo por setor | só redireciona para Tempos de produção | — (já estava pago) |
| Configurações → Equipe | 2 | **1** |
| Configurações → API e integrações | 3 | **1** |
| Configurações → Controle de tempo (as 7 abas) | 1 cada | 1 cada (já estava pago) |
| Controle de tempo → "Desligar o tempo" (no clique) | 3 | **1** |
| Configurações → Caminhões | 2 | **1** |
| Automações (a lista e a automação aberta) | 3 | **1** |

### Banco — 3 arquivos de atualização, 9 funções novas de leitura, **nenhuma função existente recriada**

- `supabase/migrations/20261118130000_plt_meu_trabalho_numa_leitura.sql` — `plt_fn_meu_trabalho`.
- `supabase/migrations/20261118130100_plt_dashboards_numa_leitura.sql` — `plt_fn_dash_pessoas_abertura`, `plt_fn_dash_qualidade_abertura`, `plt_fn_meu_desempenho_abertura`.
- `supabase/migrations/20261118130200_plt_configuracoes_numa_leitura.sql` — `plt_fn_equipe_abertura`, `plt_fn_api_abertura`, `plt_fn_caminhoes_abertura`, `plt_fn_automacoes_abertura`, `plt_fn_tempo_desligar_abertura`.

Cada porta nova só **junta** as leituras que a tela já fazia (chama as mesmas portas e tabelas por dentro, com a permissão de quem pede): os números saem iguais por construção. Nenhuma tabela, coluna, índice, política ou permissão muda. CPF, PIN, convite, nascimento, o hash da chave de API e o segredo do webhook continuam sem sair.

### Telas

- **O trabalho da pessoa** (`src/afazeres/meuTrabalho.ts`, novo): uma chave de cache só; a bolinha, o balão de sugestões, o Meu Painel e os Meus afazeres leem a mesma resposta. A porta traz só o que a tela aberta mostra.
- **Painéis:** a tela manda só o que o endereço diz (dias, setor, visualização salva) e o banco resolve o período com a mesma ordem de sempre — acaba a leitura em cascata. `src/dashboards/api.ts`, `src/dashboards/painel.ts`, `Pessoas.tsx`, `Qualidade.tsx`, `MeuDesempenho.tsx`.
- **Configurações:** `Equipe.tsx`, `AdminApi.tsx`, `Caminhoes.tsx` + `CartaoEntregaTiny.tsx`, `Automacoes.tsx` + `automacoes/api.ts`, `controleTempo/DesligarTempo.tsx`, `admin/api.ts`, `admin/caminhoes.ts`.
- **Molde novo** (`src/lib/semear.ts`): a porta de abertura traz os pedaços que têm vida própria no cache (metas, visualizações, etapas, pessoas…) só quando faltam, e os guarda com a chave de sempre.
- **Código morto tirado:** 12 buscadores que ficaram sem uso.

## 3. Como testar (roteiro do dono — depois de subir o banco e o site)

Em cada passo: abrir as **ferramentas do navegador (F12) → aba Rede → filtro "rpc"**, limpar a lista e abrir a tela. O esperado é **uma linha** com o nome indicado, e **os mesmos números de antes** na tela.

1. **Meu Painel** — entrar no site já no Meu Painel: nenhuma linha além da abertura do app (`plt_fn_abertura`). Ir a outra tela e voltar ao Meu Painel: **1 linha**, `plt_fn_meu_trabalho`. As três filas e as metas iguais às de antes.
2. **O aviso** — com o Meu Painel aberto, pedir a alguém para delegar uma tarefa a você (ou criar uma tarefa para si noutro aparelho): em instantes a tarefa aparece e a Rede mostra **1 linha** `plt_fn_meu_trabalho` (antes: 4).
3. **Meus afazeres** — abrir: **1 linha** `plt_fn_meu_trabalho`. Conferir o número do pedido em cada card e o "2/5" das subtarefas.
4. **Painéis → Pessoas** — abrir: **1 linha** `plt_fn_dash_pessoas_abertura`. Trocar o período e o setor: 1 linha a cada troca. Escolher uma visualização salva e **atualizar a página (F5)** com ela no endereço: 1 linha (antes: em cascata). Página 2 das execuções: 1 linha, só no clique.
5. **Painéis → Qualidade** — abrir: **1 linha** `plt_fn_dash_qualidade_abertura`; trocar o setor **não** pede nada (recorta na tela); o "vs" do herói igual ao de antes.
6. **Painéis → Meu desempenho** — abrir: **1 linha** `plt_fn_meu_desempenho_abertura`; página 2 do tempo por tarefa: 1 linha no clique.
7. **Painéis → Tempo por setor** (endereço antigo `/dashboards/tempo-por-setor`) — cai em Tempos de produção, aba Período.
8. **Configurações → Equipe** — **1 linha** `plt_fn_equipe_abertura`; a lista, os setores de cada pessoa e a marca de líder iguais. Editar alguém: salvar relê 1 linha.
9. **Configurações → API e integrações** — **1 linha** `plt_fn_api_abertura`; "Atualizar" = 1 linha; criar/revogar chave = 1 linha depois do gesto.
10. **Configurações → Caminhões** — **1 linha** `plt_fn_caminhoes_abertura`; o cartão "Entregue vai ao Tiny" aparece com a situação; marcar "mostrar arquivados" = 1 linha.
11. **Painel super admin → Automações** — a lista: **1 linha** `plt_fn_automacoes_abertura`; abrir uma automação: 1 linha (a mesma porta).
12. **Configurações → Controle de tempo** — cada aba: 1 linha (como já era). Abrir "Desligar o tempo" (dentro de Expediente e intervalos): **1 linha** `plt_fn_tempo_desligar_abertura`.
13. **Como operador** (uma conta sem papel de admin): Meus afazeres e Meu desempenho abrem com os dados só dele; Pessoas e Qualidade o mandam para o início (como antes).

## 4. Verificação (critérios de aceite)

- [x] **Cada tela tocada abre com 1 requisição de dados** — `src/paginas/umaLeitura.test.tsx` (14 provas): as telas de verdade com um servidor gravado; uma chamada à porta de abertura e nenhuma leitura direta de tabela; o aviso do trabalho relê uma vez; o Meu Painel como 1ª tela não lê nada. ⚠️ **Não foi conferido no navegador** (seção 5).
- [x] **Nenhum dado escondido antes do clique; nenhum relógio; nada de `postgres_changes`** — busca nos arquivos tocados: zero; as páginas seguintes (execuções, tempo por tarefa, metas) só no clique; a janela da tarefa, o nascimento e o histórico das automações seguem no clique.
- [~] **Plano ×100; porta de tela ≤ 50 ms e painel ≤ 150 ms** — ensaio feito (seção 5 do diário e o resultado anexo): **11 de 16 medições dentro do teto; 5 fora** — todas por uma leitura antiga pesada que a porta nova só junta (nenhuma porta ficou mais lenta que a soma de antes). Viraram dívida (seção 8).
- [x] **Os números de cada tela iguais aos de antes** — bateria do banco, bloco SESSAO-55 (**130 ✔**): cada pedaço de cada porta comparado no banco com a leitura antiga, como o navegador chama, para o dono, um admin comum, um líder, um operador e um operador sem setor.

**Rodadas finais:** `npm run lint` limpo · `npm run build` ok (JS inicial 232,9 KB; teto 250) · `npm test` 114 arquivos / **733 testes verdes** · `npm run test:banco` **2.003 ✔ / 1 ✘** (o ✘ é o `fn_dashboard_revenue_chart` do Comercial, que já falha na main).

## 5. O que NÃO foi validado (dito com todas as letras)

- **Nenhuma tela foi aberta no navegador.** As portas novas não existem no banco de produção (nada foi aplicado) e a tela logada pede a entrada do dono; a prova é a dos testes (as telas renderizadas de verdade, com o servidor gravado) e a da bateria. **Não há prints.**
- **O banco vivo não foi lido.** O que depende dele está na seção 7.
- **O tamanho do pacote "antes"** não foi medido (a main não foi montada nesta mesa).
- **Os tempos são do banco de teste em memória** (teto, não média); no banco real, a conferir depois de aplicar.

## 6. Decisões provisórias (⏳ confirmar com o dono — sem número; ver a seção 8)

1. **A porta de abertura junta, não reescreve** as leituras de sempre (números iguais por construção; nenhuma função viva recriada).
2. **O período dos painéis é resolvido no banco**, com a ordem de sempre: o que o endereço diz > a visualização salva de quem pede > 7 dias. Visualização de outra pessoa não vale.
3. **O guardado dos painéis vale 30 s pelo endereço** — voltar à tela em menos de 30 s reaproveita a leitura (antes relia sempre).
4. **O trabalho da pessoa é uma chave só e a porta traz só o que a tela aberta mostra;** a fila de prioridade e as metas só vêm quando o Meu Painel abre sem elas guardadas (o aviso não as relê).
5. **O "2/5" das subtarefas vem contado do banco** (os Meus afazeres deixam de baixar todas as subtarefas).
6. **O número do pedido dos cards vem na mesma porta** (até 100 pedidos).
7. **As metas de Pessoas ganham chave própria no cache** (Pessoas mostra 10 por página, o Meu Painel 20 — as duas dividiam a mesma chave).
8. **API e integrações: uma chave só** — o "Atualizar" relê as três listas numa chamada.
9. **Subida: banco antes do site, no mesmo gesto** (o site novo precisa das portas novas; não há caminho de reserva para o banco velho).
10. **Ficou de fora, de propósito:** índice novo, paginação das listas de cadastro e mexer na porta do login (seção 8, dívidas).

## 7. Para ligar com o dono (a subida)

**Ordem: banco primeiro, site depois, no mesmo gesto.** As atualizações só criam funções — o site de hoje nem as chama, então aplicar o banco não muda nada para quem está usando. O site novo, sem elas, não abre as telas tocadas.

**Antes de aplicar (só leitura):**

```sql
-- 1. as 9 portas ainda NÃO existem (esperado: 0 linhas)
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('plt_fn_meu_trabalho', 'plt_fn_dash_pessoas_abertura',
   'plt_fn_dash_qualidade_abertura', 'plt_fn_meu_desempenho_abertura', 'plt_fn_equipe_abertura', 'plt_fn_api_abertura',
   'plt_fn_caminhoes_abertura', 'plt_fn_automacoes_abertura', 'plt_fn_tempo_desligar_abertura');

-- 2. as 13 portas que elas chamam por dentro existem com a assinatura esperada (esperado: nenhuma linha com "falta")
select x as porta, case when to_regprocedure(x) is null then 'falta' else 'ok' end as situacao
  from unnest(array[
    'public.plt_fn_minhas_execucoes()', 'public.plt_fn_metas_painel(boolean,integer,integer)',
    'public.plt_fn_pedidos_kanban(text,boolean,bigint[],integer,integer)',
    'public.plt_fn_dash_tempos_pessoa(timestamptz,timestamptz,bigint)',
    'public.plt_fn_dash_execucoes(timestamptz,timestamptz,bigint,uuid,integer,integer)',
    'public.plt_fn_dash_qualidade(timestamptz,timestamptz)', 'public.plt_fn_dash_danificados_abertos()',
    'public.plt_fn_meu_desempenho(timestamptz,timestamptz)', 'public.plt_fn_meu_tempo_dias(timestamptz,timestamptz)',
    'public.plt_fn_meu_tempo_tarefas(timestamptz,timestamptz,integer,integer)', 'public.plt_fn_tiny_entrega_situacao()',
    'public.plt_fn_automacoes(integer,integer,boolean)', 'public.plt_fn_automacao(bigint)']) x;

-- 3. quem está logado lê, coluna a coluna, o que as portas leem de plt_usuarios (esperado: tudo true)
select c, has_column_privilege('authenticated', 'public.plt_usuarios', c, 'select') as le
  from unnest(array['id','auth_user_id','nome','usuario','email','telefone','matricula','papel','senha_padrao','ativo',
                    'arquivado_em','tema','foto_caminho','modulos','super_admin','conta_tablet','pode_auxiliar','fila_prioridade']) c;
```

**Aplicar** (cada arquivo sozinho, pelo aplicador da casa — outras mesas têm atualizações que esta pasta não tem):

```
npm run banco:aplicar -- --confirmar --so 20261118130000_plt_meu_trabalho_numa_leitura.sql
npm run banco:aplicar -- --confirmar --so 20261118130100_plt_dashboards_numa_leitura.sql
npm run banco:aplicar -- --confirmar --so 20261118130200_plt_configuracoes_numa_leitura.sql
```

**Depois de aplicar (só leitura):**

```sql
-- 4. as 9 existem, só leem, rodam com a permissão de quem chama, visitante não chama (esperado: 9 linhas; s · false · false · true)
select p.proname, p.provolatile, p.prosecdef, has_function_privilege('anon', p.oid, 'execute') as visitante,
       has_function_privilege('authenticated', p.oid, 'execute') as logado
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('plt_fn_meu_trabalho', 'plt_fn_dash_pessoas_abertura',
   'plt_fn_dash_qualidade_abertura', 'plt_fn_meu_desempenho_abertura', 'plt_fn_equipe_abertura', 'plt_fn_api_abertura',
   'plt_fn_caminhoes_abertura', 'plt_fn_automacoes_abertura', 'plt_fn_tempo_desligar_abertura');
```

5. **Cada porta chamada como uma pessoa de verdade** (a lição da porta do login: a bateria passou e a produção recusou) — pelo site, com o roteiro da seção 3, logo depois de publicar, **como o dono e como um operador**. Se alguma tela tocada der erro de permissão, voltar o site (o banco pode ficar: as funções novas não atrapalham ninguém).
6. **Os advisors de desempenho e de segurança** depois de aplicar (não devem trazer item novo: só funções de leitura, com `search_path`).
7. **Os tempos no banco real** das portas novas (`pg_stat_statements`), em especial Meu desempenho, Pessoas com as metas e API e integrações.
8. **Publicar o site** (subir o ramo para a main) só depois do banco.

**Para desfazer:** `drop function` das 9 (nenhum dado é tocado) e voltar o site para a versão anterior.

## 8. Para entrar nas notas depois da dieta

> Nada disto foi escrito nas notas grandes (Decisões de Produto, Memória de Aprendizado, Esquema do Banco, Lei de Desempenho, Mapa do Projeto, Ordem das Sessões, Próximos Passos). O texto completo, pronto para colar, está no fim do diário [[SESSAO-55]], seção "Para entrar nas notas depois da dieta". **Os números (D-NN, E-NN, A-NN, dívida NN) não foram atribuídos** — quem levar numera na hora.

**Lei de Desempenho (§14):**
- **Dívida 20 — paga.**
- **Dívida 18 — paga** para Pessoas, Qualidade, Meu desempenho, Tempo por setor (já estava), Equipe, API e integrações, Controle de tempo (as abas já estavam; o "Desligar o tempo" foi de 3 para 1), Caminhões e Automações. **Segue aberta** para: a configuração do Estoque (mexe com a reposição automática, que a mesa das rotinas pode tocar), Programação e Pedidos em aguardo (outra mesa) e o Comercial.
- **Dívidas novas** (o ensaio ×100 achou; são leituras antigas que a porta só junta): (1) as metas com muitas metas — 292 ms com 300 metas; (2) o tempo em afazeres do Meu desempenho — ~300 ms em 7 dias e ~1,3 s em 90 dias; (3) as últimas entregas dos webhooks sem índice por data — 79 ms com 100 mil linhas (o índice é mudança de esquema: precisa do OK do dono); (4) listas de cadastro sem página nas configurações — Equipe 180 KB, Automações 187 KB e os horários do "Desligar o tempo" 759 KB com o volume ×100; (5) Meus afazeres como 1ª tela do app = 2 requisições (a abertura do app + a porta do trabalho; antes 4); (6) os catálogos de etiquetas e de campos com validade de 5 min; (7) Motivos e Visão do dia leem as visualizações salvas à parte.

**Decisões de Produto:** as 10 provisórias da seção 6.

**Memória de Aprendizado:** 5 padrões (a porta de abertura que semeia; um retrato por tela na mesma chave; provar "igual ao de antes" no banco; o teste de tela que conta chamadas; o ensaio ×100 que se monta sozinho) e 7 erros com a correção (lista no diário).

**Esquema do Banco:** as 9 funções novas e as 3 migrations (não aplicadas).

**Mapa / Ordem das Sessões / Próximos passos:** linkar a demanda, o diário e este handoff; estado "no ramo, esperando o OK do dono para subir".

## 9. Arquivos

```
supabase/migrations/20261118130000_plt_meu_trabalho_numa_leitura.sql      (novo)
supabase/migrations/20261118130100_plt_dashboards_numa_leitura.sql        (novo)
supabase/migrations/20261118130200_plt_configuracoes_numa_leitura.sql     (novo)
supabase/testes/testar-migrations.mjs                                      (+ o bloco SESSAO-55)
src/afazeres/meuTrabalho.ts · src/lib/semear.ts · src/paginas/umaLeitura.test.tsx   (novos)
src/afazeres/{api.ts, BolhaExecucao.tsx} · src/tech/BolhaSugestao.tsx · src/autenticacao/abertura.ts · src/lib/aoVivo.ts
src/paginas/{MeuPainel, Afazeres, Equipe, AdminApi, Caminhoes, Automacoes}.tsx · src/paginas/AdminApi.test.tsx
src/paginas/dashboards/{Pessoas, Qualidade, MeuDesempenho}.tsx · src/paginas/controleTempo/DesligarTempo.tsx
src/dashboards/{api.ts, painel.ts} · src/admin/{api.ts, caminhoes.ts} · src/automacoes/api.ts · src/metas/api.ts
src/rotas/CartaoEntregaTiny.tsx
_docs/Plataforma/Demandas/SESSAO-55 - … .md · _docs/Plataforma/Execucao/SESSAO-55.md · _docs/Plataforma/Execucao/dados/SESSAO-55 - ensaio x100 … (script e resultado)
```
