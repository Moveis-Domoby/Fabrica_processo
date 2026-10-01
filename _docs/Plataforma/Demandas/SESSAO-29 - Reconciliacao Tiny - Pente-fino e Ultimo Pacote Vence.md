---
titulo: "SESSAO-29 — Reconciliação com o Tiny: pente-fino diário e 'o último pacote vence'"
tipo: demanda
status: entregue (banco no ar; a tela da Auditoria espera a revisão do dono para ir à main)
data: 2026-09-22
atualizado: 2026-10-01
tags: [plataforma, demanda, integracao, tiny, n8n, reconciliacao]
---

# 🎯 SESSAO-29 — Reconciliação com o Tiny: pente-fino diário e "o último pacote vence"

> ✅ **23/09/2026 — o dono respondeu as perguntas 1–3 → [[PLT - Decisoes de Produto]] D-50:** janela de 60 dias, às 3h; e a regra de gravação: *edição no Tiny edita aqui, apagar no Tiny NÃO apaga aqui — só as observações acompanham o apagar*. O item **B** abaixo foi reescrito por isso (encolheu). E também as perguntas 4 e 5 (mesmo dia): **nenhuma dependência de combinado com a equipe de vendas** (o item D saiu) e **marcadores ficam como estão** (acompanham o Tiny). → **📐 pronta para code desde 23/09** — a ordem de execução no bloco é decisão do dono.
>
> 🔶 **Rascunho** nascido na SESSAO-21 (22/09/2026), a pedido do dono: *"entenda o porquê deram errado e além de corrigir e me apresentar, me informe também como arrumar na raiz do problema para não acontecer mais"*. O diagnóstico completo, com provas, está em [[N8N - Pendencias e Riscos]] (P17) e em `_docs/Plataforma/Execucao/SESSAO-21.md`. Vira 📐 depois que o dono responder as perguntas do fim.

> 🔨 **01/10/2026 — executada (SESSAO-29).** Antes de codar, o Claude levou ao dono o entendimento e dois achados da leitura (só leitura no banco): **(1)** o pedido que o Tiny devolve **não traz o número do cadastro do cliente** — só o aviso de venda traz — e o nome que vem no pedido é o **atual** do cadastro; **(2)** o fluxo de carga do n8n que o pente-fino reaproveita rodava de 1 em 1 minuto sem nada para fazer (~1.400 execuções vazias por dia). **Respostas do dono:** 1) mudança no fluxo de vendas para passar o número do cadastro — *"Você gera para mim e eu edito o fluxo"*; 2) **escopo novo:** *"crie uma página de auditoria dentro do painel admin; lá dentro iremos colocar para mapear os erros do n8n também futuramente; deve aparecer log de tudo — execução, visualização, clique de entrada, movimentações e coisas do tipo; deve salvar o rastro de quem, quando, onde, porquê, o quê"* (o número da conferência mora lá) → **D-95**; 3) pedido vivo que só a conferência achou entra no PCP — *"Pode ser"* → **D-96**; 4) nome com código no lugar do apóstrofo — *"Corrija"* → **D-97**; 5) testes no Tiny com o pedido e o cadastro do próprio dono — *"pode fazer… só não edite valor nem nada do tipo sem corrigir depois"*; 6) "o mais otimizada possível" = o que esta sessão toca (*"Sim, confirmo"*). Banco: *"pode atualizar, contanto que não quebre o que está em produção"*. Cliente: **D-98**. Execução: `Execucao/SESSAO-29.md`.

## O que é

Fazer o banco da fábrica **nunca mais divergir em silêncio do Tiny**. Hoje a plataforma só sabe de uma mudança quando o Tiny avisa pelo webhook de vendas — e o aviso não cobre marcador alterado sozinho, contato renomeado, nem campo limpo (este o Tiny avisa, mas a gravação ignora). A conferência de 22/09 achou e corrigiu 15 pedidos + 2 cadastros; sem esta demanda, a deriva volta.

## Requisitos cobertos

A registrar em [[PLT - Requisitos]]: integridade Tiny × banco (RNF novo — "o banco espelha o Tiny em até 24h").

## Decisões que regem esta demanda

**D-50 (a regra de gravação e a janela — decidida pelo dono em 23/09)** · D-31 (a plataforma lê o próprio banco, alimentado pela integração) · D-47 (nada de tabela nova se uma existente serve — a `tiny_fila` já existe) · regra do **dono único do token** (nenhum renovador novo: usar a API v2 com o token do n8n, ou só LER o token v3 que a fábrica já renova) · E-24 (ajuste de produção ganha espelho em migration) · A-10/F-08 (testar contra o esquema real, duas rodadas, impressão digital da integração).

## Comportamento esperado

1. **A — Pente-fino diário.** Às **3h** (D-50), a integração relê do Tiny os pedidos dos **últimos 60 dias** (hoje ~600) **e** todos os não finalizados, e regrava pelo caminho de sempre (`fn_upsert_pedido`). Reusa a fila `tiny_fila` + o workflow de backfill do n8n (API v2, ritmo 1 req/1,8 s ≈ 18 min/dia). Uma linha por rodada num log (quantos relidos, quantos mudaram) — a deriva vira número visível. Resolve marcador e (a validar) contato renomeado.
2. **B — Observações acompanham o Tiny, o resto não se apaga (D-50).** ~~"O último pacote do Tiny vence" para todo campo~~ — **descartado pelo dono**. Regra: valor novo do Tiny sobrescreve (já é assim); campo **esvaziado ou ausente** no Tiny **não apaga** o banco (já é assim, pelo `coalesce`) — **exceto `obs` e `obs_interna`**, que passam a ser limpas quando o Tiny as limpa. Mudança pequena e localizada no `fn_upsert_pedido`.
3. **C — Cliente pelo id do contato no Tiny.** A resolução de cliente passa a tentar `tiny_id_contato` antes de CPF e de nome+fone (99% dos cadastros já têm o id). Renomear contato deixa de criar cliente duplicado.
4. ~~**D — Combinado de processo.**~~ **Descartado pelo dono (23/09):** a plataforma não depende de disciplina da equipe de vendas — tem que se virar com o que vier do Tiny. Por isso o item **C** (cliente pelo id do contato) é o que resolve o contato renomeado de verdade, junto com o pente-fino.

## Fora do escopo

Migrar o n8n para a API v3 · webhook de contatos (o Tiny não oferece para conta) · mudar telas · a conferência pedido a pedido pela interface do Tiny (já feita em 22/09 — o pente-fino a substitui).

## Critérios de aceite

- [x] Uma rodada do pente-fino relê os pedidos da janela e registra no log quantos mudaram; uma segunda rodada logo depois registra **zero** mudanças. *(01/10: 611 relidos, 138 diferentes → 2ª rodada 611 relidos, 0.)*
- [x] Teste de campo limpo (D-50): pedido com **observação/observação interna** apagada no Tiny fica com a coluna vazia no banco após a próxima rodada; pedido com **previsão ou vendedor** apagado no Tiny **mantém** o valor no banco (inclusive com a chave ausente no payload). *(Ao vivo no Tiny com o pedido do dono — obs interna e previsão — pela mesma função que a rodada usa; vendedor e chave ausente no banco de teste.)*
- [~] Teste de marcador: marcador posto sozinho no Tiny aparece no banco após a próxima rodada. *(Provado no banco de teste; no Tiny a permissão automática da sessão barrou editar o marcador — fica para o dono, opcional.)*
- [~] Contato sem CPF renomeado no Tiny: pedido reprocessado continua no MESMO cliente (sem duplicata). *(Provado no banco de teste; nas duas rodadas reais, nenhum cliente criado. No Tiny, não feito — mesmo motivo.)*
- [x] Impressão digital das tabelas da integração idêntica antes/depois da migration; `test:banco` de duas rodadas verde. *(`e2109f3a…`, 65 colunas, nas duas aplicações; 667 verificações.)*
- [x] A plataforma ficou o mais otimizada possível depois do meu serviço, requisições minimas, banco sem tabelas, colunas e funções desnecessarias e front bem apontado e leve. *(No que a sessão tocou — confirmado pelo dono: nenhuma tabela nova; o fluxo da carga deixou de acordar 1.392×/dia à toa; pedido igual não é regravado; a Auditoria pagina no servidor, 30 por vez.)*
- [x] Nenhum renovador de token novo em lugar nenhum.

## Notas para o Claude Code

- Ler antes: [[N8N - Backfill Historico do Tiny]] (a fila e o workflow), [[N8N - Tiny Integracoes Referencia]] §2.4 (a recomendação de reconciliação já estava lá), o código vivo de `fn_upsert_pedido` e `fn_reagir_pedido` (F-08 — o gatilho reage a previsão/obs/valores/forma de envio: medir quantos `pedido_atualizado` o pente-fino geraria na 1ª rodada).
- `tiny_fila` é única por `(recurso, chave)` — reler um pedido já `ok` exige reabrir a linha (ver "Reprocessar de propósito" na nota do backfill); desenhar isso sem duplicar.
- A validar no 1º teste: se `pedido.obter` traz o nome ATUAL do contato (o Tiny mostra o nome novo até em pedido de 2025 — indício forte).
- Achado de 22/09 a não esquecer: o pedido 11710 guarda "&#39;" (entidade HTML) no nome — vem assim do Tiny; decidir se a gravação decodifica entidades.

## Perguntas ao dono (antes de virar 📐)

1. ✅ Janela: **60 dias** (dono, 23/09 — D-50).
2. ✅ Horário: **3h** (dono, 23/09 — D-50).
3. ✅ Regra de gravação: **edição edita, apagar não apaga — só observações acompanham** (dono, 23/09 — D-50).
4. ✅ **Sem combinado com a equipe de vendas** (dono, 23/09) — a plataforma se vira sozinha; item D descartado. *(Pergunta original, reexplicada:)* no Tiny, alguns clientes são cadastrados com o bairro e a origem no campo do nome ("Maria Silva / Cidade Alta / Instagram"); quando alguém limpa isso depois, a plataforma não fica sabendo. A proposta é a equipe digitar só o nome no campo nome. Pergunta: vale combinar isso com a equipe?
5. ✅ Marcador removido no Tiny: **fica como está** — sai do banco também (dono, 23/09).

## Resultado (preencher ao entregar)

✅ **Entregue em 01/10/2026** — [[handoff_2026_10_01_sessao29_reconciliacao_tiny]]. Migrations 49 (conferência) e 50 (auditoria) **aplicadas** na madrugada, integração idêntica; o fluxo da carga do n8n passou a ser acordado pelo banco (trocado pelo dono). **A 1ª conferência real (03:00):** 611 relidos, 138 diferentes (134 só na cópia completa — ex.: data de faturamento mudada no Tiny depois do último aviso —, 2 de cliente, 1 de observação, 1 de itens); **a 2ª, logo depois: 0**. No dia 01/10 a função nova atendeu as vendas sem nenhum erro (45 gravações, 12 pedidos novos → 12 cards). Escopo novo do dono: **Auditoria no Painel admin** (D-95) — na branch, à espera da revisão dele para ir à `main`. Pendente com o dono: colar no fluxo de vendas a passagem do número do cadastro do cliente (D-98).
