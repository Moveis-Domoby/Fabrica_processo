---
titulo: n8n — Tiny da FÁBRICA → produtos no Supabase
tipo: workflow
data: 2026-09-21
atualizado: 2026-09-30
status: EM PRODUÇÃO — catálogo ativo desde 23/09 · 30/09 virou o FLUXO ÚNICO do Tiny da fábrica (catálogo + estoque ↔ plataforma, D-76…D-80) — importar no n8n e excluir a carga do saldo
tags: [n8n, tiny, fabrica, produtos, supabase, sessao-25]
---

# 🏭 Tiny da FÁBRICA → produtos no Supabase

> [!abstract] O que faz
> Todo produto **cadastrado** no Tiny da fábrica (FábricaDomoby, CNPJ 27.556.613/0001-66, login `lojadomoby`) entra na tabela `produtos` do Supabase da fábrica em até **15 min** — **todas as classes** (fabricado, matéria-prima, simples, kit, variação). Alterações (mínimo, descrição, inativação) entram na **varredura da madrugada**. O webhook de **lançamentos de estoque** já fica ligado **capturando o payload cru** para a SESSAO-25.
> Arquivos: `domoby-tiny-fabrica-produtos.json` (nesta pasta) · `Supabase-fabrica/23_tiny_fabrica_produtos.sql`. Estudo que embasa: [[N8N - Tiny Fabrica - Estudo do Cadastro]].

> [!important] ↪️ 30/09/2026 — FLUXO ÚNICO: catálogo + estoque (D-76…D-80)
> O dono: *"eu não quero vários fluxos para a mesma coisa, quero 1 único que faz o trabalho completinho sem erro"*. Este workflow passou a se chamar **"Domoby · Tiny FÁBRICA → produtos e estoque (fluxo único)"** (mesmo arquivo `domoby-tiny-fabrica-produtos.json`, **mesmo caminho de webhook** — o Tiny da fábrica não muda nada). A **carga do saldo (rodar 1×)** morreu: o arquivo saiu do cofre e o workflow deve ser **excluído no n8n**. Detalhe na seção [[#Fluxo único — o estoque conversando com a plataforma (30/09/2026)]].

> [!note] ↪️ 30/09/2026 — as FOTOS dos produtos vêm daqui, mas não passam pelo n8n (D-81, D-82)
> O `produto.obter` traz `anexos` (o link da foto no armazém do Tiny) e este fluxo já grava o retorno inteiro em `produtos.raw`. A cópia da foto para a plataforma é do **banco + Edge Function `fotos-tiny`** (relógio interno de 5 em 5 min, que só chama a função quando há foto nova). **Nada mudou neste workflow.** Consequência do desenho daqui: produto novo ganha a foto em ~20 min; foto trocada num produto que já existe, depois da varredura das 03:15.

> [!warning] ↪️ 28/09/2026 — o saldo do Tiny saiu da conta dos ACABADOS
> Conferido no banco real: o aviso de "lançamentos de estoque" **não cobre a venda** (nem quando o pedido nasce, nem quando sai) nem o "pronto" dos móveis — 9 avisos na vida toda, nenhum de móvel, o último em 25/09 (A-25). Por isso, desde o ajuste de 28/09 (D-70) o número dos produtos acabados na plataforma é a **contagem da logística** (entrada/baixa/contagem manual). O saldo do Tiny continua valendo para **matéria-prima e insumos** e aparece como referência no detalhe do produto. O mínimo também pode ser definido na plataforma (D-72 — vazio = vale o do Tiny, que este workflow segue trazendo). **Nada mudou no workflow.**

## Decisões do dono (21/09/2026)

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Quais produtos entram no banco? | **Todos os tipos.** "Precisamos ter pelo menos eles salvos no banco." |
| 2 | Extensão Webhooks | **Instalada pelo dono em 21/09.** Tela confirmada: vendas · pedidos enviados · **lançamentos de estoque** · NF autorizadas — **não existe webhook de produto**. |
| 3 | Estoque consolidado do grupo na API? | **Estoque é um só.** O que a loja vende é o que a fábrica produz — a configuração "estoque de todas as empresas" na multiempresa está **certa**; a reconciliação usa o consolidado. |
| 4 | Personalizado da loja baixa estoque da fábrica? | **Não.** A fábrica produz o personalizado sob encomenda e envia no pedido; não há item parado aguardando compra. → Na SESSAO-25 o débito por venda **ignora personalizados**. |
| 5 | Peças/insumos com saldo negativo | **Está errado.** Registrado como [[N8N - Pendencias e Riscos#P16]]. |

## Por que esse desenho (e não outro)

- **Não há webhook de produto** (conferido na tela). O webhook de estoque dispara em movimentação — e cadastro gera um lançamento "Balanço · Produto incluído" — mas o payload não é documentado; usá-lo como única porta seria apostar no escuro.
- **`lista.atualizacoes.produtos` foi descartado**: exige a extensão paga "API para estoque em tempo real" **e é uma fila que se consome ao ler** ("registros já obtidos serão removidos da fila") — uma falha do n8n depois da leitura perderia o produto para sempre.
- Escolhido: **`produtos.pesquisa` com `dataCriacao`** (parâmetro oficial da v2) em janela sobreposta de 3 h a cada 15 min + **`produto.obter`** (leitura autoritativa, traz `classe_produto`, `estoque_minimo`, `variacoes`, `kit`) + **varredura diária** do catálogo inteiro. Tudo idempotente: repetir não duplica.

## A cadeia (13 nodes)

```
A cada 15 min ──► Parâmetros · novos ──────┐
Varredura 03:15 ─► Parâmetros · varredura ─┴► Tiny F · pesquisar produtos ─┐
Webhook · lançamentos de estoque ─► Supabase · registrar em eventos ─► Extrair id do produto ─┤
                                                                                           ▼
        Juntar ids ─► Tiny F · produto.obter (1 a cada 1,2 s) ─► Retorno OK? ──true──► Supabase · fn_upsert_produto
                                                                          └──false──► Erro · obter falhou (execução vermelha, os outros já gravaram)
```

- **Tiny F · pesquisar produtos** (Code): pagina sozinho (100/página, 1,2 s entre páginas), `codigo_erro 20` = janela vazia; na varredura, busca também os filhos de variação (ids lidos em `produtos.raw->variacoes`).
- **produto.obter** com *batching* 1 item / 1200 ms → ~50 req/min (plano Evoluir = 60/min; cota é por conta — dividida com o que mais usar o token da fábrica).
- **Retorno OK?**: a v2 devolve HTTP 200 mesmo em erro — vale `retorno.status`.
- **Webhook**: responde 200 na hora; grava o corpo inteiro em `eventos` (tipo `estoque_fabrica`, coluna `payload`); só busca produto se achar id em campo **explícito** (`idProduto`/`id_produto`/`produto.id`) — nunca `dados.id` (pode ser o id do lançamento). Confere `cnpj` quando vier. Path = UUID (webhook do Tiny não é assinado).

## Banco (migration 23 — `Supabase-fabrica/23_tiny_fabrica_produtos.sql`)

> [!important] Regra do dono (21/09/2026) — clareza nas tabelas
> **Antes de criar tabela nova, ver se uma existente pode ser remodelada** para receber os mesmos dados. Nada de "encher linguiça": só colunas que alguém vai filtrar/mostrar; o resto do payload vai em `raw`.

Aplicando a regra, a primeira versão (2 tabelas + 2 funções) foi **enxugada** para **1 tabela nova · 1 coluna nova · 1 função**:

- **`produtos`** (nova — inevitável: não existia catálogo; `pedido_itens` é linha de pedido, que o `fn_upsert_pedido` apaga e regrava) — `tiny_id` **PK**, `codigo` (SKU, nulo/repetido permitido), `descricao`, `classe` (F/M/S/K/V), `tipo_variacao`, `id_produto_pai`, `unidade` (**já normalizada**: un, pc, m, m2, cx…), `estoque_minimo`, `estoque_maximo`, `situacao`, `raw`, `criado_em`, `atualizado_em`. Nome genérico de propósito: *o estoque é um só* — é o catálogo da Domoby, com o Tiny da fábrica como fonte.
- **`eventos`** (**remodelada**, +1 coluna `payload jsonb`) — o log permanente que já guardava cada chegada do Tiny passa a guardar também: `produto_fabrica` (cada produto novo/alterado) e `estoque_fabrica` (webhook de lançamento de estoque, **corpo cru** em `payload`). Conferido: nada depende das colunas atuais além do `fn_upsert_pedido`, que não muda.
- **`fn_upsert_produto(p jsonb)`** — SECURITY DEFINER, idempotente, normaliza unidade por dentro; **só grava/loga quando o `raw` mudou** (a varredura diária não gera ruído).
- Filhos de variação: sem registro "incompleto" no banco — a varredura lê os ids em `produtos.raw->variacoes` dos pais e busca cada filho no `produto.obter`.
- RLS ligado sem policy; execute só para `service_role`.
- **Testado em 21/09 em transação com ROLLBACK no banco real** (nada ficou): insert → repetição idêntica **não** loga → alteração (mínimo 4→5, Unidad→`un`) → filho de variação (Pç→`pc`, pai correto) → evento de estoque com payload. 4 eventos gerados, exatamente os esperados.

## Implantação (ordem obrigatória)

1. ✅ **Banco:** migration 23 **aplicada em 21/09/2026** pelo Cowork (com OK do dono); `supabase-fabrica-schema.sql` §9 e [[SUPA - Esquema do Banco]] atualizados; advisors: só o INFO esperado de RLS sem policy (igual às demais tabelas da integração).
2. **Token:** no Tiny da fábrica, Configurações → Geral → **Token API** → gerar. No VPS, bloco `environment:` do compose: `- TINY_FABRICA_TOKEN=...` (**direto no compose, nunca em chat/print/nota** — E-03) → `docker compose down && docker compose up -d` → `printenv | grep TINY_FABRICA` (só conferir que existe).
3. **n8n:** importar `domoby-tiny-fabrica-produtos.json` como workflow **novo** (não mexe em nenhum workflow em produção). Conferir que `SUPABASE_FABRICA_URL/KEY` já existem (são os mesmos do GreenPallets).
4. ✅ **Teste de fumaça (22/09/2026):** rodado com `Parâmetros · novos` em `days: 30` — execução verde de ponta a ponta, 1 produto gravado (`583 · Gaveteiro Volante - Freijó`, classe S, unidade `un`). **Confirmado: `produtos.pesquisa` ACEITA `pesquisa` vazio.** Voltar o node para `hours: 3` depois do teste.

> [!warning] Erro real e correção (22/09/2026) — sandbox do Code node
> A primeira versão falhava com **`URLSearchParams is not defined`**. O Code node do n8n roda em sandbox e **não expõe `URLSearchParams` nem temporizador** (`setTimeout`). Correção: montar o corpo `form-urlencoded` à mão com `encodeURIComponent` e **não usar pausa** no Code — o controle de ritmo fica no *batching* do node HTTP Request. Vale para qualquer Code node novo da casa.

> [!warning] Erro real e correção (22/09/2026) — carga inicial derrubou a conexão
> A primeira varredura trouxe **487 produtos**, o `produto.obter` respondeu a todos, mas o node do Supabase parou no meio com *"The connection was aborted, perhaps the server is offline"* — **186 gravados** de 487. Causa: ~490 chamadas seguidas ao PostgREST sem folga. Correção aplicada no JSON: **batching 10 por vez / 300 ms + 3 tentativas** nos nodes de escrita (e 3 tentativas no `produto.obter`). Rodar a varredura de novo é seguro: o upsert é idempotente e só regrava o que mudou.

5. **Carga inicial:** executar o ramo `Varredura diária 03:15` na mão uma vez (~430 produtos, ~9–10 min). Conferir: `select classe, count(*) from produtos group by 1` ≈ F 166 · M 181 · S 53 · K 27 · V 1 (+ filhos).
6. **Publicar** o workflow. Copiar a **Production URL** do node `Webhook · lançamentos de estoque` → Tiny da fábrica → Configurações → Geral → Webhooks → ligar **"Receber notificações de lançamentos de estoque"** com essa URL → salvar. (Deixar **vendas/enviados/NF desligados** nesta conta — não há consumidor para eles.)
7. **Teste real:** cadastrar um produto de teste no Tiny da fábrica → em ≤15 min ele aparece no banco (e uma linha `produto_fabrica` em `eventos`) → conferir em `eventos` (`tipo = 'estoque_fabrica'`) se chegou o evento do "Balanço · Produto incluído" → **arquivar o payload real neste cofre** e ajustar `CAMPOS` no node `Extrair id do produto` → inativar o produto de teste no Tiny.

## Teste ponta a ponta (22–23/09/2026)

Feito pelo Cowork no Tiny da fábrica, com o dono acompanhando.

1. **Carga inicial:** 487 produtos no banco (169 F · 181 M · 109 S · 27 K · 1 V + 2 filhos), 487 eventos `produto_fabrica`. Bate com o Tiny — a diferença para os 428 "ativos" da tela é que a varredura traz também os **46 inativos**.
2. **Produto novo:** cadastrado `TESTE-INT-01 · ZZ TESTE INTEGRACAO - APAGAR` (Simples, Und, NCM 9403.30.00, estoque inicial 1, **mínimo 2**). Entrou no banco na execução seguinte: `tiny_id 947854547`, classe `S`, unidade normalizada `un`, **estoque_minimo 2** ✅, com evento `produto_fabrica`.
3. **Inativação:** o produto de teste foi **inativado** (ações em lote → "Inativar produtos" → confirmação do Tiny "produtos foram inativados com sucesso"). **Não foi excluído** — excluir é decisão do dono; se ele excluir, a linha do banco precisa ser apagada à mão (a varredura só enxerga A e I).
4. **Pendente de verificação:** o reflexo da inativação no banco (`situacao` A → I) só acontece na próxima execução — **o workflow ainda estava desativado** nessa noite (as execuções foram manuais).

↪️ ~~Webhook de estoque ainda NÃO ligado~~ — **ligado no Tiny em 23/09/2026** e testado (entrada e balanço); o payload real está em [[N8N - Tiny Integracoes Referencia]] (2.1). Até 26/09 chegaram 9 avisos, todos de lançamento feito NA FÁBRICA (produto de teste, serviços e ferramentas) — **pedido de venda da loja não gera aviso** (reserva não é lançamento — A-22).

## Carga do SALDO (SESSAO-25, 26/09/2026)

> [!important] A carga inicial de 22–23/09 foi a do **catálogo** (varredura de produtos) — `produto.obter` **não traz saldo** (E-43).

- ↩️ **30/09/2026: este workflow saiu** (D-80) — a varredura do estoque das 04:00 do fluxo único faz o papel dele. Histórico: workflow **separado**, rodar 1× à mão: `domoby-tiny-fabrica-carga-saldo.json` (nesta pasta) — lê os produtos **ativos** em `produtos`, chama `produto.obter.estoque` (1 a cada 1,2 s) e grava cada saldo em `eventos` como aviso `estoque_fabrica` com `origem: carga_inicial`, `saldo` e `saldoReservado` (+ depósitos crus). Rodar de novo é seguro: a plataforma usa sempre a leitura MAIS NOVA de cada produto. **O workflow de produção não foi tocado.**
- **Rodada pelo dono em 26/09/2026** (21:16–21:26 UTC): **442 avisos, 442 produtos** (todos os ativos).
- O que a carga mostrou (F-05): o `saldo` é o **físico**; o **aviso** também manda o físico (Corte/Furo/FITAMENTO: aviso com saldo 0 × milhares reservados na carga). Fabricados: **93 de 168 com físico negativo** (venda que baixou sem o "pronto" correspondente) e reserva do Tiny **maior** que os pedidos abertos no banco (327: 44 × 0). Por isso a plataforma calcula a reserva pelos pedidos da loja (D-55).

## Fluxo único — o estoque conversando com a plataforma (30/09/2026)

**Por quê:** o balanço do Guilherme (29/09) não apareceu na plataforma — o aviso de estoque desta conta só vê o depósito **Geral da FÁBRICA**, e a equipe olha o **multiempresa** (Geral + os depósitos "Fábrica", "Loja" e "Desmontado" da empresa da LOJA). Regras de produto: D-76 (Tiny acima sobe a plataforma), D-77 (gesto da plataforma deixa o Tiny igual), D-78 (venda reserva a peça), D-79 (ligar copia o Tiny uma vez), D-80 (um fluxo só — ↪️ sob demanda). O banco é a migration 42 (+ a 43, que faz o banco chamar o n8n só quando há trabalho) — [[SUPA - Esquema do Banco]].

```
CATÁLOGO (igual)  A cada 15 min / Varredura 03:15 ─► pesquisar ─► Juntar ids ─► produto.obter ─► fn_upsert_produto
AVISO             Webhook · lançamentos de estoque (fábrica E loja, mesmo endereço) ─► Supabase · aviso de estoque
FILA              Webhook · processar a fila do estoque (o BANCO chama) ─► próximos da fila (até 20) ─► Tiny F · obter estoque (1/1,2 s) ─► aplicar leitura
                                   └► Gravar no Tiny? ─(sim)► Tiny · gravar estoque (1/1,2 s) ─► confirmar ajuste
(a varredura do estoque das 04:00 mora no BANCO — pg_cron plt-tiny-estoque-varredura — e não no n8n)
```

- **Supabase · aviso de estoque** → `plt_fn_tiny_estoque_aviso(p)`: grava o aviso cru em `eventos` (o mesmo registro de antes) e, com o sincronismo ligado, põe o produto acabado na fila. Aviso da LOJA é achado pelo SKU. **O aviso não dispara mais a releitura do cadastro** — produto novo entra pelo ciclo de 15 min.
- **Webhook · processar a fila do estoque** (caminho próprio, secreto) — ↪️ 30/09, pedido do dono (*"você não tá nem doido de deixar alguma coisa rodando no meu n8n a cada 1 minuto"*): **não há relógio no n8n para o estoque.** Quem chama é o relógio INTERNO do banco (`plt-estoque-reservas`, que já existia para a venda): só posta aqui se o sincronismo está ligado, há produto esperando na fila e nenhum lote está em andamento. Fila vazia = o fluxo não roda, nenhuma consulta ao Tiny. O endereço mora em `plt_webhooks` (marcado `tiny_estoque_fila`).
- **próximos da fila** → `plt_fn_tiny_estoque_proximos(20)`; sobrou fila, o banco chama de novo no minuto seguinte.
- **Tiny F · obter estoque** → `produto.obter.estoque.php` com o token da FÁBRICA (`TINY_FABRICA_TOKEN`) — o saldo somado das duas empresas + cada depósito.
- **aplicar leitura** → `plt_fn_tiny_estoque_leitura(produto, versao, resposta)`: a plataforma decide (copiar / subir / devolver o ajuste). Erro do Tiny (limite, fora do ar) volta para a plataforma, que tenta de novo no minuto seguinte; 5 falhas seguidas → o produto para e aparece em Configurações → Tiny.
- **Tiny · gravar estoque** → `produto.atualizar.estoque.php`, tipo **B** (balanço) no depósito que a plataforma mandar: **"Fábrica" da LOJA pela conta da loja** (`TINY_TOKEN` — o mesmo do fluxo principal) ou **Geral pela conta da fábrica**. Balanço é repetível (reenvio não dobra); saída "S" só quando o balanço ficaria negativo.
- **confirmar ajuste** → `plt_fn_tiny_estoque_ajustado(...)`: sai da fila e fica na trilha (`estoque_tiny_ajustado`).
- **Cota:** no máximo 20 leituras + os ajustes por chamada, uma chamada por vez (bem abaixo dos 60/min); a varredura do catálogo (03:15) e a do estoque (04:00) não se cruzam.
- **Execuções:** o workflow guarda **só as com erro**; fuso do workflow = America/Sao_Paulo. O que foi feito fica na plataforma (trilha + Configurações → Tiny).
- **Relógios que sobraram no n8n:** só os do CATÁLOGO, que já existiam (a cada 15 min e 03:15).

### Como foi trocado no n8n (30/09/2026 — feito pelo Claude no navegador do app, com o dono logado)

1. ✅ O workflow **"Domoby · Tiny FÁBRICA → produtos no Supabase"** (mesmo id `gJNYde20T921AY6l`) virou **"Domoby · Tiny FÁBRICA → produtos e estoque (fluxo único)"**: tudo apagado e o JSON colado (19 nós conferidos um a um contra o arquivo), fuso de São Paulo, só execuções com erro guardadas, **publicado** (n8n 2.32 — rascunho ≠ publicado). Os dois webhooks de produção respondem "registrado para POST".
2. ✅ O workflow **"carga do saldo (rodar 1×)"** foi **arquivado** (dá para restaurar; apagar de vez fica com o dono).
3. ✅ No **Tiny da LOJA**, o dono ligou **"lançamentos de estoque"** com a mesma URL do webhook de estoque deste fluxo.
4. ✅ Na plataforma, o sincronismo foi ligado em **Estoque → Configurações → Tiny** em 30/09 às 01:30 (234 acabados na fila para a cópia). Receita do n8n pelo navegador e as armadilhas: E-71 na memória de aprendizado.

## Riscos e observações

| Item | Avaliação |
|---|---|
| Alteração de produto (mínimo etc.) | Entra na varredura das 03:15 — até ~24 h de atraso. Se precisar mais rápido, rodar a varredura 2–3×/dia. |
| Produto excluído no Tiny | Não é detectado ainda (a varredura busca A e I). Fica com a última situação conhecida. |
| Cota da API | ~96 pesquisas/dia + obter de produtos novos + ~430 na madrugada. Folgado no Evoluir. |
| Alerta de erro | **Mais uma integração sem vigia — P1 continua a mais crítica.** |
| Carga inicial | 487 produtos (mais que os 428 ativos: a pesquisa traz ativos **e** inativos). ~12 min com o batching novo |
| Estrutura/BOM dos fabricados | Não vem no `produto.obter`; fica para o projeto de BOM/custo real. |

## Ver também

[[N8N - Tiny Fabrica - Estudo do Cadastro]] · [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] · [[N8N - Tiny 2 para PCP]] (padrão de workflow por conta) · [[N8N - Pendencias e Riscos]] (P1, P16) · [[SUPA - Esquema do Banco]]
