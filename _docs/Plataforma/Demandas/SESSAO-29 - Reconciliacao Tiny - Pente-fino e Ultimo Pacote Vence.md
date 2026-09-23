---
titulo: "SESSAO-29 — Reconciliação com o Tiny: pente-fino diário e 'o último pacote vence'"
tipo: demanda
status: rascunho
data: 2026-09-22
atualizado: 2026-09-22
tags: [plataforma, demanda, integracao, tiny, n8n, reconciliacao]
---

# 🎯 SESSAO-29 — Reconciliação com o Tiny: pente-fino diário e "o último pacote vence"

> 🔶 **Rascunho** nascido na SESSAO-21 (22/09/2026), a pedido do dono: *"entenda o porquê deram errado e além de corrigir e me apresentar, me informe também como arrumar na raiz do problema para não acontecer mais"*. O diagnóstico completo, com provas, está em [[N8N - Pendencias e Riscos]] (P17) e em `_docs/Plataforma/Execucao/SESSAO-21.md`. Vira 📐 depois que o dono responder as perguntas do fim.

## O que é

Fazer o banco da fábrica **nunca mais divergir em silêncio do Tiny**. Hoje a plataforma só sabe de uma mudança quando o Tiny avisa pelo webhook de vendas — e o aviso não cobre marcador alterado sozinho, contato renomeado, nem campo limpo (este o Tiny avisa, mas a gravação ignora). A conferência de 22/09 achou e corrigiu 15 pedidos + 2 cadastros; sem esta demanda, a deriva volta.

## Requisitos cobertos

A registrar em [[PLT - Requisitos]]: integridade Tiny × banco (RNF novo — "o banco espelha o Tiny em até 24h").

## Decisões que regem esta demanda

D-31 (a plataforma lê o próprio banco, alimentado pela integração) · D-47 (nada de tabela nova se uma existente serve — a `tiny_fila` já existe) · regra do **dono único do token** (nenhum renovador novo: usar a API v2 com o token do n8n, ou só LER o token v3 que a fábrica já renova) · E-24 (ajuste de produção ganha espelho em migration) · A-10/F-08 (testar contra o esquema real, duas rodadas, impressão digital da integração).

## Comportamento esperado

1. **A — Pente-fino diário.** De madrugada, a integração relê do Tiny os pedidos dos últimos 60 dias (hoje ~600) **e** todos os não finalizados, e regrava pelo caminho de sempre (`fn_upsert_pedido`). Reusa a fila `tiny_fila` + o workflow de backfill do n8n (API v2, ritmo 1 req/1,8 s ≈ 18 min/dia). Uma linha por rodada num log (quantos relidos, quantos mudaram) — a deriva vira número visível. Resolve marcador e (a validar) contato renomeado.
2. **B — "O último pacote do Tiny vence".** `fn_upsert_pedido` deixa de usar `coalesce` nos campos que vêm do pedido completo (`pedido.obter`): campo **vazio OU ausente** no pacote **limpa** a coluna. Proteção só para `tiny_id`, `cliente_id` e `origem`. Resolve o campo limpo no Tiny.
3. **C — Cliente pelo id do contato no Tiny.** A resolução de cliente passa a tentar `tiny_id_contato` antes de CPF e de nome+fone (99% dos cadastros já têm o id). Renomear contato deixa de criar cliente duplicado.
4. **D — Combinado de processo (sem código).** Nome do contato no Tiny só com o nome; bairro e origem nos campos/marcadores próprios (~4% dos pedidos ainda vêm com "nome / bairro / origem", em queda).

## Fora do escopo

Migrar o n8n para a API v3 · webhook de contatos (o Tiny não oferece para conta) · mudar telas · a conferência pedido a pedido pela interface do Tiny (já feita em 22/09 — o pente-fino a substitui).

## Critérios de aceite

- [ ] Uma rodada do pente-fino relê os pedidos da janela e registra no log quantos mudaram; uma segunda rodada logo depois registra **zero** mudanças.
- [ ] Teste de campo limpo: pedido com previsão/observação interna/vendedor removidos no Tiny fica com a coluna vazia no banco após a próxima rodada (inclusive chave ausente no payload).
- [ ] Teste de marcador: marcador posto sozinho no Tiny aparece no banco após a próxima rodada.
- [ ] Contato sem CPF renomeado no Tiny: pedido reprocessado continua no MESMO cliente (sem duplicata).
- [ ] Impressão digital das tabelas da integração idêntica antes/depois da migration; `test:banco` de duas rodadas verde.
- [ ] Nenhum renovador de token novo em lugar nenhum.

## Notas para o Claude Code

- Ler antes: [[N8N - Backfill Historico do Tiny]] (a fila e o workflow), [[N8N - Tiny Integracoes Referencia]] §2.4 (a recomendação de reconciliação já estava lá), o código vivo de `fn_upsert_pedido` e `fn_reagir_pedido` (F-08 — o gatilho reage a previsão/obs/valores/forma de envio: medir quantos `pedido_atualizado` o pente-fino geraria na 1ª rodada).
- `tiny_fila` é única por `(recurso, chave)` — reler um pedido já `ok` exige reabrir a linha (ver "Reprocessar de propósito" na nota do backfill); desenhar isso sem duplicar.
- A validar no 1º teste: se `pedido.obter` traz o nome ATUAL do contato (o Tiny mostra o nome novo até em pedido de 2025 — indício forte).
- Achado de 22/09 a não esquecer: o pedido 11710 guarda "&#39;" (entidade HTML) no nome — vem assim do Tiny; decidir se a gravação decodifica entidades.

## Perguntas ao dono (antes de virar 📐)

1. Janela do pente-fino: 60 dias + não finalizados está bom, ou quer outra (30/90)?
2. Horário: madrugada (ex.: 3h) serve? O ritmo do n8n divide a API v2 com o webhook de produção.
3. B muda a regra de gravação da integração (a regra "vazio não apaga" foi criada para o backfill conviver com o webhook). Aprova a troca para "o último pacote do Tiny vence"?
4. D (processo): quem combina com a equipe que o nome do contato é só o nome?

## Resultado (preencher ao entregar)

*—*
