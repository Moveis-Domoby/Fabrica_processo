---
titulo: "SESSAO-33 — Tiny completo: todos os dados, atualizados quando algo acontece"
tipo: demanda
status: 📦 entregue em arquivo (17/10/2026) — o que dependia do OK já está no ar; o resto liga em casa pelo handoff
data: 2026-10-16
atualizado: 2026-10-17
origem: pedido do dono em 16/10/2026 (prompt da sessão remota), com as respostas de 16/10 (D-141, D-142)
plano: "[[003 - PLANO - Integracao Completa Tiny da Fabrica]]"
depende: "[[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]] (entregue) · [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] (a conferência diária que esta sessão estende)"
tags: [plataforma, demanda, tiny, n8n, integracao, api-v2, api-v3, webhooks, carga, conferencia, estrutura, insumos]
---

# 🎯 SESSAO-33 — Tiny completo: todos os dados, atualizados quando algo acontece

> [!important] Leia antes de tudo
> `CLAUDE.md` (a ordem de leitura inteira — nesta sessão na nuvem o cofre é a pasta `_docs/` do repositório) · [[003 - PLANO - Integracao Completa Tiny da Fabrica]] inteiro · [[N8N - Tiny Integracoes Referencia]] · [[N8N - Tiny Modelos Mentais]] · [[N8N - API Tiny v2 vs v3]] · [[N8N - Pendencias e Riscos]] · [[N8N - Backfill Historico do Tiny]] · [[N8N - Tiny Fabrica Produtos para Banco]] · [[SUPA - Comercial - Cron e Rotinas]] · o [[handoff_2026_10_16_sessao32_desempenho_escala]] · D-141 e D-142.

## O que é

Pedido do dono (16/10, palavras dele resumidas com fidelidade): **fazer pelo n8n, melhorando a automação que já pega os dados do Tiny (não criar outra paralela)**. Antes, uma **pesquisa extremamente aprofundada** da API e dos dados do Tiny; então **puxar de uma vez TODOS os dados, sem exceção alguma** — clientes, peças, insumos, produtos, valores, contas a pagar, contas a receber e tudo mais. Depois, **deixar o Tiny atualizando isso para a gente sempre que algo for atualizado lá — sem ficar procurando de 1 em 1 minuto, mas quando algo acontecer.**

## Como esta sessão é diferente

Roda **na nuvem**, direto no GitHub, com o dono fora de casa (celular). Daqui **não se alcança** o n8n (a chave da API dele está só no computador do dono) nem o Tiny (o token não está aqui e nunca é pedido nem colado — regra 4). O banco: só leitura sem o OK do dono (regra 2). **Tudo que precisar do n8n ou do banco sai pronto em arquivo na branch** (fluxo do n8n em JSON, atualização do banco em arquivo, passo a passo de ligar) — o "para ligar em casa" do handoff.

## Etapa A — a pesquisa (o coração da sessão)

Agentes em paralelo e a web. Fontes: a documentação oficial da API v2 e da API v3 do Tiny/Olist, a central de ajuda (webhooks, notificações, extensões, limites por plano), changelogs e o que o cofre já documenta (inclusive o que o plano 003 conferiu em 27/09 — confirmar se ainda vale). **Não inventar endpoint, campo ou evento: cada linha da tabela final precisa de fonte.**

Entrega: a nota [[N8N - Tiny - Mapa Completo da API e dos Dados]], com, **para cada tipo de dado** (todos os que o Tiny tiver — a lista do dono é o mínimo: clientes/contatos, vendedores, produtos, variações, kits, estrutura/composição, peças, insumos, preços e listas de preço, estoque por depósito, movimentações de estoque, pedidos de venda, pedidos de compra, ordens de produção, notas fiscais de entrada e saída, contas a pagar, contas a receber, categorias financeiras, formas de pagamento, separação/expedição, marcadores, transportadoras e o que mais aparecer):

1. em qual API existe (v2, v3, ambas) e quais campos vêm;
2. como buscar tudo (paginação, filtros, custo em consultas);
3. como saber o que mudou (filtro por data de alteração? lista de atualizações? nada?);
4. se o Tiny avisa sozinho (webhook/notificação) — quais eventos existem de verdade, em que plano, e o que o aviso traz;
5. o que já temos hoje no banco e no n8n para aquele dado;
6. a recomendação: como trazer e como manter atualizado.

Honestidade onde o Tiny não avisa: buscar só o que mudou desde a última vez, no menor ritmo que a cota permitir, acordado pelo banco quando fizer sentido, e a conferência diária como rede de segurança. Mostrar ao dono, em português, **o que vai ser "na hora" e o que vai ser "com atraso de X", e por quê**.

**Limite crítico:** a cota do Tiny é **por conta** e compartilhada por todas as integrações (v2, v3, n8n, comercial). A carga completa **não pode derrubar o que já funciona** (vendas, estoque, conferência das 3h, contas a receber). Calcular o tempo da carga inicial com a cota real e propor o ritmo.

## Etapa B — o plano (ao dono antes de construir)

Pelo ritual da casa: (a) entendimento em até 15 linhas, (b) dúvidas de negócio, (c) decisões técnicas — em português de gente, curto (ele está no celular). Inclui:

- **onde cada dado vai morar**, pela regra do banco enxuto (antes de tabela nova, ver se uma existente recebe; só coluna que alguém filtra ou mostra; o resto em `raw`);
- **como a automação atual do n8n será melhorada** (não duplicada), preservando os nós que não podem ser renomeados (`Normalizar evento`, `Tiny · pedido.obter` — `_docs/CLAUDE.md`);
- **o renovador do token da API nova da conta da fábrica** — um por credencial, nunca dois (E-07, A-18);
- **a ordem da carga** (o que vem primeiro), o ritmo e **como provar que bateu com o Tiny** (contagens e somas por tipo);
- o que fica pronto daqui e o que só liga em casa;
- (D-142) **as estruturas que já existem no Tiny ligadas na plataforma** (móvel → peças → insumos) e **a lista das unidades fora do padrão em Configurações** — no escopo; o **liga/desliga "Reduzir os insumos de acordo com a conclusão dos setores de produção?"** (nasce desligado) e a **baixa por etapa** entram **se o dono aprovar** neste plano — senão viram a próxima sessão; trazer ao dono **como amarrar cada insumo à etapa/setor que o consome**.

**Só construir com o OK dele.**

## Etapa C — construir (o que der daqui)

- Atualizações do banco **em arquivo** (não aplicadas sem OK), com o esquema do banco e a nota atualizados.
- Fluxo(s) do n8n **em JSON versionado** na pasta `Fabrica n8n/` do cofre, prontos para importar, com passo a passo de ligar.
- **Conferência de "bateu com o Tiny"** pronta para rodar depois da carga.
- Tudo dentro da lei de desempenho (regra 18): trabalho nasce do fato, nada de relógio que acorda para ver se há trabalho, escrita idempotente, tempo limite, nova tentativa com espera crescente e **alerta de erro** (a pendência antiga P1 — resolver junto se couber).

## §4 — Se sobrar fôlego (só com o OK do dono)

As rotinas do banco que acordam de minuto em minuto (reservas do estoque, envio de avisos, disparo do Comercial, fotos) passam a rodar só quando algo acontece — **aprovado pelo dono em 16/10 (D-141)**. Mexe no n8n e no disparo do Comercial — **o disparo nunca pode rodar em dois lugares**. Se não couber, fica registrado como a próxima sessão.

## Também nesta sessão (§1 do pedido — respostas de 16/10)

Registrar no cofre as respostas do dono (D-141, D-142); o gancho do token recusa a pessoa desativada já no login, com mensagem clara; Auditoria e histórico das automações por rolagem (cursor); a imagem de teste do comprovante no pedido 13622 sai pelo caminho normal, só com o "pode" do dono.

## Decisões que regem

Regra 2 (banco/n8n de produção só com OK) · regra 3 (integrações n8n em produção, esquema) · **regra 4 (token nunca no chat/código/nota)** · regra 5 (eventos append-only) · regra 10 (nomes do esquema; tabelas da integração não se alteram sem OK) · **regra 18 (lei de desempenho)** · regra 19 (ClickUp) · D-19 · D-43 (blindagem dos gatilhos de `pedidos`) · **D-47 (banco enxuto)** · D-50 (edição no Tiny edita aqui; apagar não apaga, só observações) · D-70/D-76/D-77/D-79/D-80 (estoque × Tiny; um fluxo só da fábrica; sem relógio no n8n) · D-96/D-98 (conferência e cliente pelo cadastro) · D-113/D-123 (entregue nos dois lados, dentro da automação que já existia) · D-122 (contas a receber na conferência das 3h) · D-138 (móvel × insumo × peça) · D-140 (pedido excluído no Tiny some de todos os módulos) · **D-141 · D-142** · A-18/E-07 (um renovador por credencial) · A-22/A-39 (ids não casam entre contas; o SKU é a ponte; multiempresa) · A-43 (o pedido v2 não traz o id do contato) · A-44 (olhar o fluxo vivo antes de reaproveitar).

## Fora do escopo

Plano de corte / SketchUp / CNC (D-142 item 4 — fica para a parte de corte) · produção no nível de lote de peças (onda 4 do plano 003) · criar ou alterar cadastros no Tiny (a plataforma não escreve no Tiny além do que já faz — D-77/D-123) · trocar a conta da loja da API v2 para a v3 nos fluxos que já funcionam · converter unidades por conta própria (D-142 item 6) · as dívidas de tela da lei que não tocam o Tiny.

## Critérios de aceite

- [ ] A nota [[N8N - Tiny - Mapa Completo da API e dos Dados]] cobre todos os tipos de dado da lista (e os que aparecerem), cada linha com fonte; o que não foi possível confirmar daqui está marcado como tal, com o que o dono confere em casa.
- [ ] O dono vê, em português, o que fica "na hora" e o que fica "com atraso de X", e por quê.
- [ ] O tempo da carga inicial calculado com a cota real e o ritmo proposto sem derrubar as integrações de hoje.
- [ ] O plano (Etapa B) apresentado e aprovado antes de construir.
- [ ] O que for construído: banco em arquivo (com a bateria verde, integração idêntica), fluxo(s) do n8n em JSON melhorando a automação que já existe (sem duplicar; nós intocáveis preservados), um renovador por credencial, conferência "bateu com o Tiny", alerta de erro — e o passo a passo "para ligar em casa".
- [ ] Estruturas do Tiny ligadas na plataforma e a lista das unidades fora do padrão em Configurações (D-142).
- [ ] Tarefas do ClickUp em FAZENDO ao começar, comentário humanizado ao entregar, **nunca** concluídas pelo Claude Code.
- [ ] Memória de execução, aprendizados, handoff com "Para ligar em casa", mapa, ordem das sessões e próximos passos atualizados.

## Notas para o Claude Code

- **A cota é da conta inteira** (60/min no plano da Domoby — conferir na pesquisa): a carga nasce com o ritmo controlado num lugar só e para sozinha se o Tiny responder "limite".
- **Um renovador por credencial, sempre.** O da loja é o `tiny-auth-refresh-cron` (o único); o da fábrica nasce com a mesma disciplina — e **toda função que renova ao receber 401 também é renovador** (A-18).
- **Olhar o fluxo vivo antes de reaproveitar** (A-44/A-60): daqui não se alcança o n8n — o espelho do cofre pode estar velho; o passo a passo de importar inclui a conferência do que está no ar.
- Webhook do Tiny é **campainha, não carteiro** (modelo mental 2): o aviso só enfileira; a leitura autoritativa vem pela API.
- Não renomear os nós `Normalizar evento` e `Tiny · pedido.obter`; destinos de um mesmo evento em ramos paralelos.
- Banco enxuto (D-47): antes de tabela nova, remodelar uma existente; o resto do payload em `raw`.

## Tarefas no ClickUp (regra 19)

Lista **PRODUÇÃO** (DPTO TI). Ao começar cada uma → **FAZENDO**. **Nunca** mover para concluído: ao terminar, avisar o dono e deixar um comentário curto e humanizado — **quem conclui é o dono**.

- [Tiny - Pesquisa completa da API e de todos os dados disponíveis](https://app.clickup.com/t/17tya50hd73) — Etapa A
- [Tiny - Carga completa de todos os dados para a plataforma](https://app.clickup.com/t/17tya50hd75) — Etapas B e C (a carga)
- [Tiny - Dados atualizados sozinhos quando algo muda no Tiny](https://app.clickup.com/t/17tya50hd76) — Etapas B e C (manter em dia)
- (§4, se couber, com o OK) [Rotinas do banco por evento, sem relógio](https://app.clickup.com/t/17tya50fm41)

## Resultado (preencher ao entregar)

**Entregue em 17/10/2026** — [[handoff_2026_10_17_sessao33_tiny_completo]] (com o passo a passo **"Para ligar em casa"**) · execução em [[SESSAO-33]].

- **No ar (com o OK do dono):** a imagem de teste do 13622 retirada; as conferências com o Tiny por rolagem (migration 88); o login que recusa a pessoa desativada com mensagem clara (função `autenticacao` v11).
- **Pronto em arquivo, liga em casa:** o banco (migrations 89–92 — a fila de tudo nas duas contas, a cascata da venda, os avisos, a consulta de hora em hora 8h–20h, a contagem e a carga com o painel "bateu com o Tiny?", a API nova da fábrica com renovador próprio, a estrutura e as unidades fora do padrão), as funções `tiny-v3` e `tiny-fabrica-token`, o fluxo do n8n melhorado + o alerta de erro + o programa que aplica, e as telas (Auditoria → Carga do Tiny; Configurações → estrutura e unidades; Integrações → ligar a API nova da fábrica). A branch espera o GitHub voltar (o envio foi recusado nesta sessão).
- **Provas:** bateria **1.042 verdes**; testes de tela verdes; montagem com o JS inicial igual ao da `main` (219,6 KB); **ensaio com 100× o volume e 3 milhões de linhas da carga na fila** — o caminho da fila em milissegundos (três pontos que falhariam foram corrigidos antes de subir); dívidas registradas na lei: as unidades fora do padrão com o catálogo ×100 (13) e o "Começar a carga" ×100 (22).
- **Critérios de aceite:** ✅ o mapa com fonte por linha e o que conferir em casa · ✅ "na hora" × "com atraso", em português · ✅ o tempo da carga · ✅ o plano aprovado antes de construir (D-143) · ✅ o construído (banco em arquivo com a bateria verde — integração intacta, a `tiny_fila` mudando só no que o plano aprovou —, o fluxo melhorando o que existe, um renovador por credencial, a conferência "bateu com o Tiny", o alerta de erro, o passo a passo de ligar) · ✅ estruturas e unidades em Configurações · ✅ ClickUp (pesquisa e as duas tarefas da carga em FAZENDO, comentário ao entregar, nenhuma concluída) · ✅ memória, aprendizados, handoff, mapa, ordem e próximos passos.
- **§4 (rotinas de minuto em minuto → nascer do fato):** não coube — registrada como próxima sessão, junto com a baixa dos insumos por setor (D-143). Qual vem primeiro é do dono.

## Ver também

[[003 - PLANO - Integracao Completa Tiny da Fabrica]] · [[N8N - Tiny Integracoes Referencia]] · [[N8N - Backfill Historico do Tiny]] · [[N8N - Tiny Fabrica Produtos para Banco]] · [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] · [[PLT - Lei de Desempenho e Escala]]
