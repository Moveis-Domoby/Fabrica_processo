---
titulo: "Diário — SESSAO-54 · Comercial: janelas da plataforma no lugar dos alertas do navegador, e a função antiga preparada para sair"
tipo: execucao
data: 2026-11-18
tags: [execucao, sessao-54, comercial, debito-tecnico, modal, banco]
---

# Diário — SESSAO-54 (18/11/2026, madrugada · fila do Escritório, sem o dono na conversa)

Demanda: [[SESSAO-54 - Comercial - Janelas da Plataforma e Limpeza da Funcao Antiga]] · ramo `sessao-54-comercial-janelas-e-limpeza` (mesa própria: `C:\Users\wccau\.escritorio\frentes\domoby\sessao-54-comercial-janelas-e-limpeza`, nascida da main `78e8829`) · Handoff: [[handoff_2026_11_18_sessao54_comercial_janelas_e_limpeza]]

> **Nada saiu deste computador:** nenhum push, merge, migration aplicada, publicação, n8n ou ClickUp. O banco vivo **não foi lido nem escrito** (a mesa não tem acesso) — o que depende dele está em "Para ligar com o dono" no handoff.

## Partida (~04:10)

- `git status` limpo, ramo certo. Nenhum `cd` (regra 20): tudo por caminho absoluto, `git -C`, `npm --prefix`.
- **Leitura feita:** o `CLAUDE.md` da mesa e o do cofre; o pedido (duas vezes); [[PLT - Comercial - Debito Tecnico]] inteiro; os dois arquivos das telas, o gancho da tabela e os componentes da casa (`Modal`, `Botao`, `Notificacao`); no [[PLT - Modelo de Sistema]], a seção dos componentes (`<Botao>`, `<Modal>`, `useNotificacao()`, lei de requisição); na [[PLT - Lei de Desempenho e Escala]], §6, §7 e §12; as três migrations do Comercial (`20260915120000`, `20260915180000`, `20261016110000`); o bloco 86 da bateria; o diário e o handoff da SESSAO-51 (a última entregue); o template de demanda.
- **Leitura NÃO feita por inteiro (dito às claras):** Decisões de Produto (433 KB), Memória de Aprendizado (269 KB), Esquema do Banco (264 KB), Mapa, Ordem das Sessões, Requisitos, Visão Geral e Perguntas em Aberto foram **consultados por busca** (alertas nativos, janela de confirmação, vitrine, as funções do Comercial), não lidos de ponta a ponta — a soma passa de 1,4 MB. Nenhuma decisão registrada sobre alertas nativos ou sobre estas funções foi achada que contrarie a demanda.
- **ClickUp:** não tocado (a regra do modo fila vale por cima do pedido: "o dono cuida das tarefas").

## Numeração

- Migrations: `20261118120000` (remoção) e `20261118120100` (ordem da tabela).
- Bateria do banco: **faixa nova** — pedidos `9954001–9954320`, clientes `Cliente 54 #1…#80`; no ensaio de volume (opcional), `pedido_id 80000001+` e clientes `v54-…` direto nas tabelas prontas, tudo numa transação desfeita.
- Decisões, erros e acertos **sem número da casa** (as notas grandes não se editam nesta leva e outras mesas numeram ao mesmo tempo): aqui são `P54-n` (decisão provisória), `L54-n` (lição). Viram D-NN/E-NN/A-NN quando entrarem nas notas.
- Débito técnico do Comercial: item novo **DT-D39** (o próximo livre da família D; D36–D38 são reservados).

## Task list (espelha a demanda)

1. ✅ Gravar o pedido como demanda (sem linkar na Ordem das Sessões).
2. ✅ DT-D24 — zero alerta/pergunta nativos no Comercial; confirmação que destrói ou dispara em janela própria com botão de toque; mesmo efeito de antes.
3. ✅ DT-BD4 — provar que nada chama a função; gancho morto (não existe no repositório); migration de remoção só em arquivo.
4. ✅ DT-G16 (opcional) — a ordem no servidor, mantendo a porta compatível.
5. ✅ Lint, build, testes das telas e bateria do banco.
6. ✅ 375 e 768 sem rolagem lateral nas telas tocadas (medido e fotografado).
7. ✅ Diário, notas pequenas do Comercial, handoff ("Para ligar com o dono", decisões provisórias, "Para entrar nas notas depois da dieta") e reporte da fila.

## O que foi feito, em ordem

### 1 · As 16 chamadas nativas (DT-D24)

Conferidas por busca antes de mexer: **2** na tabela de clientes (2 alertas) e **14** no detalhe da lista (10 alertas + 4 perguntas). Depois: **zero** (`grep -rnE "\b(alert|confirm)\(" src/comercial` vazio — até os comentários foram reescritos para a busca fechar em zero).

- **Componente novo, só do Comercial:** `src/comercial/components/ModalConfirmacao.tsx` — o `<Modal>` + `<Botao>` da casa. Título = a pergunta; corpo = o que acontece; rodapé = "Voltar" e o verbo do gesto (tamanho `lg`, de toque); vermelho quando destrói. Fechar no X, no ESC ou por fora = "Voltar". Enquanto o gesto roda, o botão gira e a janela não fecha. Não existia equivalente genérico na casa (os modais de confirmação da fábrica são cada um do seu gesto) — e a regra da leva é ficar só no Comercial.
- **`ListasDisparoDetalhe.tsx`:** os quatro botões (Excluir, Remover da lista, Finalizar disparo, Parar contagem e encerrar) só **abrem** a janela; o gesto roda no confirmar, com o mesmo código de antes. Os 10 alertas viraram `useNotificacao()`.
- **`CustomersTable.tsx`:** os 2 alertas viraram `useNotificacao()` (tom de atenção).

| Antes (navegador) | Agora |
|---|---|
| pergunta "Parar o disparo agora? Os contatos já enviados…" | janela "Parar o disparo agora?" + o mesmo texto · botão **Parar o disparo** (amarelo) |
| pergunta "Encerrar a lista completamente? …não pode ser desfeita." | janela "Encerrar a lista completamente?" + o mesmo texto · **Encerrar a lista** (vermelho) |
| pergunta "Tem certeza que deseja excluir esta lista? …" | janela "Excluir esta lista?" + o mesmo texto · **Excluir a lista** (vermelho) |
| pergunta "Tem certeza que deseja remover N membros da lista?" | janela "Remover N membros da lista?" (singular com 1) + "Quem for removido sai desta lista e não recebe o disparo dela." · **Remover da lista** (vermelho) |
| alerta "Mensagem salva com sucesso!" / "Mensagem copiada!" | aviso verde, mesmo texto |
| alerta "Erro ao …: mensagem" (renomear, salvar, excluir, disparar membro, remover membros) | aviso vermelho: título "Erro ao …", descrição = a mensagem |
| alerta "Erro: mensagem" (parar o disparo, encerrar) | aviso vermelho "Erro ao parar o disparo" / "Erro ao encerrar a lista" + a mensagem |
| alerta com o motivo da trava do disparo | aviso amarelo, mesmo texto |
| alerta "Selecione pelo menos um cliente para criar/adicionar…" | aviso amarelo, mesmo texto |

### 2 · A função antiga (DT-BD4)

**A prova de que nada a chama (no código, 18/11):**
- `src/` — nenhuma chamada. A única ocorrência do nome é `fn_dashboard_transitions_summary` em `src/comercial/data/queries.ts` (outra função, a que o gráfico usa). O gancho antigo `useTransitionData.ts` **não existe** no repositório (nunca foi portado) — não havia gancho morto para apagar.
- `supabase/functions/` (api, autenticacao, calcular-rota, fotos-tiny, geocodificar, tiny-fabrica-token, tiny-v3), `supabase/manutencao/`, `supabase/pendentes/`, `scripts/` — nenhuma ocorrência.
- `supabase/migrations/` — só a própria definição (3 versões: `20260915120000`, `20260915180000`, `20261016110000`) e o revoke/grant dela.
- **No banco de teste (bateria):** nenhuma função, view ou política cita o nome (busca no corpo das funções, na definição das views e nas políticas).
- ⚠️ **O que o código não deixa provar:** as funções de borda do disparo (`disparar-membro-individual`, `enviar-proximo-disparo`, `verificar-vendas-disparo`, `processar-timers-disparo`, `webhook-datacrazy-resposta`) **não estão neste repositório**, e os fluxos do n8n também não. Pela natureza delas (disparo e atribuição de venda) não há motivo para lerem transições, mas a conferência no banco vivo e nos registros de chamadas fica no handoff.

**A migration:** `20261118120000_plt_comercial_remove_funcao_antiga.sql` — `drop function if exists public.fn_dashboard_transitions(timestamptz, timestamptz)`, **sem `cascade`** (se algo depender, falha em vez de levar junto), com `lock_timeout` de 5 s; roda duas vezes sem erro. O caminho de volta está no cabeçalho dela.

**Bateria — duas conferências antigas tiveram de mudar** (a bateria aplica todas as migrations antes de conferir, então a função some para os blocos de cima também):
- bloco da SESSAO-20: a contagem das portas com gate passou de 12 para **11**;
- bloco 86 (porta antiga × nova do Dashboard): a linha da função removida saiu da lista (não há mais porta nova para comparar).

### 3 · A ordem da tabela no banco (DT-G16) — coube

`fn_filter_customers(p_filters jsonb, p_limit, p_offset)` recebe os filtros num JSON → a ordem entra como **mais uma chave dos filtros** (`sortOrder: 'asc' | 'desc'`). A assinatura não muda, então:
- quem chama sem a chave (o site publicado hoje, a bateria) recebe **linha a linha, na mesma ordem**, o que recebia;
- a tela nova contra o banco de antes: o banco ignora a chave e a tela se comporta como hoje (a ordenação da página ficou como rede).

`20261118120100_plt_comercial_clientes_ordem_no_banco.sql`: o corpo é o da última versão (`20261016110000`) com três mudanças — a variável `v_asc`, a leitura da chave e os dois `order by` (`case when v_asc then … end asc, case when not v_asc then … end desc, cid`). Cliente sem data fica no fim no "mais antiga primeiro" (no de sempre fica no começo, como já ficava). `create or replace` mantém as permissões.

Front: `useCustomersPaginated(page, pageSize, filters, sortOrder)` manda a chave; `CustomersTable` passa a ordem e **volta à página 1** ao trocá-la.

### 4 · Achado nas fotos — DT-D39

Em 375, os botões da linha "Membros da Lista" passavam da borda do cartão e o **"Disparar" ficava cortado** (o cartão corta o que passa). Não é rolagem lateral da página, mas é tela tocada → a linha agora quebra (`flex-wrap`). Só classes; nenhum comportamento.

## Provas

- **Testes das telas (novos, 10):** `ListasDisparoDetalhe.test.tsx` (7 — cada janela abre com o texto de sempre; "Voltar" não faz nada; confirmar faz o gesto de antes; erro do banco vira aviso e a tela fica; nenhuma chamada nativa em nenhum caminho) e `CustomersTable.test.tsx` (3 — abre pedindo a ordem de sempre; "ordenar por data" pede `asc` na mesma porta com os mesmos 3 argumentos; trocar a ordem na página 2 volta ao começo).
- **Projeto inteiro:** `tsc -b` 0 · `eslint .` 0 · vitest **115 arquivos / 729 testes ✔** · montagem ok — **JS inicial 233,0 KB** comprimidos (teto 250); pedaço da lista 16,08 KB e do Painel de Recompra 16,61 KB comprimidos.
- **Bateria do banco:** **1.886 ✔ + 1 ✘ conhecido** (o painel do Dashboard — `fn_dashboard_revenue_chart`, que já falhava antes desta sessão, ver o diário da SESSAO-51). Nas rodadas feitas entre 04:10 e 04:40 apareceu também o outro ✘ conhecido (o teste do fluxo do n8n que só falha nessa janela — E-266); depois das 04:40 ele passou. **13 conferências novas, todas verdes:**
  - a função removida não existe mais (nenhuma versão); o resumo e o detalhe das transições seguem; ninguém no banco a cita; o resumo responde; remover de novo não dá erro;
  - sem a chave (ou `desc`, `DESC`, vazio, valor desconhecido, nulo) a porta devolve **linha a linha, na mesma ordem**, o que a de antes devolvia — 20 filtros × 6 jeitos, 9.438 linhas;
  - "mais antiga primeiro": os mesmos clientes, em ordem crescente, nos 20 filtros (1.573 linhas);
  - nos dois caminhos da porta (a tela pronta e o com busca): a página 1 começa no cliente mais antigo de todos e, de 7 em 7, as páginas = a lista inteira, sem repetir nem pular;
  - a porta continua uma só, com a mesma assinatura, o mesmo gate e as mesmas permissões.
- **Ensaio de volume (~100×: 400.156 clientes e 557.863 vendas nas tabelas prontas; `PLANO54=1 npm run test:banco`; Postgres de teste dentro do Node, bem mais lento que o de verdade — vale a COMPARAÇÃO, não o número):**

  | Caso (50 linhas) | a partir da | antes | agora, recente primeiro | agora, antiga primeiro |
  |---|---|---|---|---|
  | período inteiro | 0 | 999,5 ms | 1.053,3 ms | 1.092,1 ms |
  | período inteiro | 5000 | 1.093,9 ms | 988,4 ms | 774,0 ms |
  | um mês | 0 | 146,0 ms | 239,1 ms | 227,6 ms |
  | um mês | 5000 | 171,2 ms | 210,7 ms | 149,4 ms |
  | um ano | 0 | 1.854,9 ms | 1.519,3 ms | 1.571,0 ms |
  | um ano | 5000 | 2.576,0 ms | 2.846,8 ms | 2.639,1 ms |
  | busca por nome | 0 | 2.553,1 ms | 2.565,0 ms | 1.955,3 ms |
  | busca por nome | 5000 | 2.614,3 ms | 2.700,9 ms | 2.518,7 ms |
  | um produto | 0 | 1.947,9 ms | 2.020,6 ms | 2.062,9 ms |
  | um produto | 5000 | 1.937,4 ms | 1.559,3 ms | 1.464,7 ms |

  Leitura: a mudança **não acrescenta custo** (a diferença anda para os dois lados — é ruído; o caso "um mês" na 1ª página ficou ~90 ms acima em duas medições, dentro da oscilação das outras linhas). O que o ensaio mostra de verdade é uma **dívida que já existia**: com 100× o volume, a porta fica acima do teto de 50 ms nos dois jeitos, porque conta e ordena o resultado inteiro a cada página e pagina por deslocamento. O plano por dentro da função (o `EXPLAIN` de cada consulta interna) não foi tirado — o `EXPLAIN` de fora só enxerga a chamada.
- **Telas (vitrine temporária — as telas de verdade com dados de exemplo e a rede bloqueada; apagada antes do commit):** 9 cenas × 375, 768 e 1440 = **27 medições, todas sem rolagem lateral e sem janela passando da tela**. 21 fotos em `_docs/Handoffs/imagens/sessao54-*.png`. A casca do app (menu e barra do topo) não entra na vitrine; o app de verdade não foi aberto logado (não há login nesta mesa).

## Decisões provisórias (para o dono confirmar)

- **P54-1 · A janela de confirmação do Comercial:** a pergunta no título, o aviso de sempre no corpo, "Voltar" e o verbo do gesto no rodapé. Vermelho para excluir, encerrar e remover membros; amarelo (ação comum) para "Parar o disparo" — parar o envio não destrói nada.
- **P54-2 · Os avisos:** sucesso verde, erro vermelho (com a mensagem do banco embaixo, como o alerta mostrava), atenção amarelo. Somem sozinhos em 5 s, como todo aviso da casa — antes o alerta ficava até o "OK".
- **P54-3 · Texto novo na janela de remover membros:** "Quem for removido sai desta lista e não recebe o disparo dela." (o navegador só perguntava "Tem certeza…?"; a janela da casa pede uma explicação no corpo).
- **P54-4 · Erros de "parar o disparo" e "encerrar"** ganharam título próprio ("Erro ao parar o disparo", "Erro ao encerrar a lista"); antes era só "Erro: …".
- **P54-5 · Durante o gesto a janela fica aberta com o botão girando** e fecha ao terminar (com sucesso ou erro) — antes a pergunta sumia na hora e a tela ficava sem sinal até a resposta.
- **P54-6 · "Mais antiga primeiro":** trocar a ordem volta à página 1; cliente sem data de compra fica no fim.
- **P54-7 · A ordem viaja dentro dos filtros** (chave `sortOrder`), não como parâmetro novo da porta — foi o que permitiu manter a porta compatível nos dois sentidos.

## Lições (para a Memória de Aprendizado, depois da dieta)

- **L54-1 (erro → corrigido):** o bloco novo da bateria usou os ajudantes do bloco 86 (`um86`, `linhas86`, `trecho86`, `FILTROS86`) — eles moram num escopo próprio (E-70) e o erro só apareceu **no fim de uma rodada de 7 minutos**. Na troca em massa para nomes próprios, `linhas54` colidiu com um contador já chamado `linhas54` (mais uma rodada perdida). Regra: bloco novo nasce com os seus ajudantes; antes de rodar, buscar cada nome novo no bloco; `node --check` não pega nenhum dos dois.
- **L54-2 (aprendizado):** remover uma função do banco **quebra conferências antigas** da bateria (ela aplica tudo antes de conferir). Procurar o nome na bateria inteira ANTES de escrever a migration e ajustar as conferências antigas no mesmo commit, dizendo o porquê.
- **L54-3 (acerto, vira padrão):** porta que recebe os filtros em JSON ganha opção nova **como chave do JSON** — a assinatura não muda, o site velho segue servido e a tela nova tolera o banco velho (a subida deixa de depender da ordem banco → site).
- **L54-4 (erro → corrigido, vitrine):** a moldura com iframe aberta por `file://` no Edge sem janela **não carrega** a tela de dentro (fotos em branco, medidas nulas); servida pelo mesmo Vite, funciona. E decodificar duas vezes o parâmetro transformou `%23` em `#` (o resto da consulta virou âncora e sumiu).
- **L54-5 (acerto):** foto de aviso passageiro — o tempo virtual do navegador tem de ser **menor que os 5 s do aviso** (com 9 s o aviso já tinha ido embora na foto, mesmo aparecendo nas medidas).
- **L54-6 (aprendizado):** o `<Modal>` da casa repete o título numa descrição escondida para leitor de tela → em teste, procurar o título por **papel de título** (`getByRole('heading')`), não por texto.
- **L54-7 (aprendizado):** rodar os testes das telas **junto** com a bateria do banco deu 1 falha falsa (uma espera de 1 s estourou em `Estrutura.test.tsx`, tela que nem é do Comercial); com a máquina livre, 729/729. Uma coisa de cada vez.

## Para a Lei de Desempenho (dívidas — depois da dieta)

- **Paga:** a ordenação da tabela de clientes do Comercial feita só na página (item da lei de requisição: ordenar no cliente um pedaço do resultado) — depois que banco e site subirem.
- **Segue aberta (já existia; medida agora):** `fn_filter_customers` conta e ordena o resultado inteiro a cada página, pagina por deslocamento e não tem teto de página no banco; com 100× o volume passa do teto de 50 ms. Caminho: cursor por (última compra, chave do cliente) + total só quando a tela mostra + teto de 100.
- **Segue aberta:** `ListasDisparoDetalhe` faz 4 leituras em cascata na abertura (lista, números, membros, eventos) e relê 3 a cada aviso — fora do escopo desta demanda.

## Comandos rodados (os que importam)

- `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` · `npm run test:banco` (4 rodadas; a última com `PLANO54=1`).
- Vitrine: `npx vite --port 5354 --strictPort --host 127.0.0.1` em segundo plano (derrubado no fim; porta livre conferida) + Edge sem janela (`--dump-dom` e `--screenshot`).

## Arquivos

- **Novos:** `src/comercial/components/ModalConfirmacao.tsx`, `src/comercial/components/ListasDisparo/ListasDisparoDetalhe.test.tsx`, `src/comercial/components/CustomersTable.test.tsx`, `supabase/migrations/20261118120000_plt_comercial_remove_funcao_antiga.sql`, `supabase/migrations/20261118120100_plt_comercial_clientes_ordem_no_banco.sql`, a demanda, este diário, o handoff e 21 fotos.
- **Alterados:** `src/comercial/components/ListasDisparo/ListasDisparoDetalhe.tsx`, `src/comercial/components/CustomersTable.tsx`, `src/comercial/hooks/useCustomersPaginated.ts`, `supabase/testes/testar-migrations.mjs`, [[PLT - Comercial - Debito Tecnico]] (DT-D24, DT-BD4, DT-G16, DT-D39) e [[SUPA - Comercial - Dominio de Dados]] (a linha da função legada).
- **Não tocados de propósito:** as notas grandes (Decisões, Memória, Esquema do Banco, Lei, Mapa, Ordem, Próximos Passos) e tudo fora do Comercial.
