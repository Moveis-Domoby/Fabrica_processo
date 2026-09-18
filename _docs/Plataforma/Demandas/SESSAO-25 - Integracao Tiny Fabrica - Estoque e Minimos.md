---
titulo: "SESSAO-25 — Integração Tiny da fábrica: estoque, mínimos e saldo"
tipo: demanda
status: pronta para code
data: 2026-09-18
atualizado: 2026-09-18
tags: [plataforma, demanda, bloco-5, estoque, tiny, n8n]
---

# 🎯 SESSAO-25 — Integração Tiny da fábrica: estoque, mínimos e saldo

> Quarta sessão do **Bloco 5**. **Integração NOVA**: hoje só existem o Tiny da loja (Domoby) e o da GreenPallets — o Tiny **da fábrica** não está no cofre (sem token, plano ou CNPJ registrados). Esta sessão conecta o estoque da plataforma (SESSAO-24) ao Tiny da fábrica nos dois sentidos e cria o controle de mínimo/saldo/necessidade de produção.

## O que é

Lançamento de produto no estoque do Tiny da fábrica **alimenta o app**; venda na loja (Tiny Domoby) **debita** um item lançado pela fábrica; o estoque mínimo vem do cadastro do Tiny da fábrica; a plataforma mostra **saldo** e **sinaliza necessidade de produção**; e (melhoria) uma tela sugere estoque mínimo com base no último trimestre.

## Requisitos cobertos

Extensão do RF-70 (D-07). Registrar os requisitos novos em [[PLT - Requisitos]].

## Decisões que regem esta demanda

D-07 (estoque nativo) · decisão v2/v3 de 12/08 (n8n fica na v2; **exceção registrada**: *depósitos* só existem na v3) · **E-07/regra do dono único** (um renovador por credencial) · E-03/P4 (token NUNCA em chat/print/nota) · M-01 (automatizar consequências) · A-02 (evento > polling) · "webhook é campainha, não carteiro" (M2 do n8n).

## Comportamento esperado

1. **Entrada — Tiny fábrica → app:** todo lançamento de produto no estoque do Tiny da fábrica alimenta o estoque da plataforma (item **sem dono**, origem "Tiny fábrica"). Caminho preferido: webhook de conta **"Lançamentos de estoque"** (payload **não documentado** — capturar um evento real antes de desenhar, F-05); fallback se o plano da conta não tiver webhooks: **polling dos deltas** `lista.atualizacoes.estoque` / `lista.atualizacoes.produtos`, no padrão GreenPallets (agendado + trava claim-first).
2. **Saída — venda na loja debita a fábrica:** a cada venda no Tiny da loja (o webhook de vendas **já chega** ao banco), a plataforma **debita do saldo** um item correspondente lançado pela fábrica (casamento por código/SKU — `pedido_itens.codigo` é texto limpo). Sem saldo, não debita negativo: registra a falta (entra na conta da necessidade de produção).
3. **Estoque mínimo do cadastro do Tiny da fábrica:** o mínimo por produto vem do cadastro de produto no Tiny da fábrica (verificar **empiricamente** em `produto.obter.php` qual campo traz o mínimo — não há registro no cofre; se o campo não existir na v2, decidir com o dono o plano B: cadastro do mínimo na própria plataforma).
4. **Saldo e sinalização:** tela de estoque mostra por produto o **saldo em estoque**, o **mínimo**, e sinaliza (**ícone + texto**, nunca só cor — M-12) a **necessidade de produção** quando saldo < mínimo. É sinalização e fila de sugestão para o PCP — ninguém produz automaticamente (M-01, PCP é manual).
5. **Melhoria (se couber na sessão, senão registrar como pendência):** tela de **sugestão de estoque mínimo** com base no consumo do **último trimestre** (vendas por SKU nos últimos 90 dias já existem em `pedidos`/`pedido_itens` — 5.300+ pedidos históricos no banco), lado a lado com o mínimo atual, para o dono ajustar no Tiny.
6. **Espelho de saldo**: o saldo da plataforma é **derivado de eventos** (entrada Tiny/manual/cancelamento − débito por venda − alocação a pedido), com reconciliação periódica contra `produto.obter.estoque.php` (job de reconciliação — as integrações da casa sempre têm um).

## Perguntar ao dono no início da sessão (ritual de sempre; só codar com o OK)

1. **A conta Tiny da fábrica já existe?** Qual plano? (Webhooks exigem extensão Webhooks e plano Evoluir/Impulsione+; plano Crescer = caminho por polling.) — *Não cole o token na conversa: E-03. O token vai direto no lugar seguro (compose/secret), e a sessão só confere a FORMA.*
2. O débito por venda da loja vale para **todos os produtos** ou só os que a fábrica lançou (SKUs com saldo)? Kits/variações da loja (tipos K/V) desmembram como?
3. Se o Tiny v2 não expuser campo de estoque mínimo, o mínimo pode morar na plataforma (cadastro por produto aqui)?
4. Estoque separado por **depósito** importa? (Depósitos só existem na API v3 — seria a única razão registrada para abrir exceção à decisão "ficar na v2".)
5. O n8n ganha de uma vez o **alerta de erro** (P1)? Esta sessão adiciona mais uma integração que pode falhar em silêncio — é o momento de criar o Error Workflow.

## Fora do escopo

Disparo/Comercial e cutover (SESSAO-21) · pedidos da fábrica no Tiny (a conta nova é para **estoque/produtos**; `pedidos.numero` é UNIQUE — pedidos de outra conta no mesmo banco exigiriam coluna de conta, projeto separado) · BOM/insumos · alterar qualquer workflow em produção além do necessário (workflow **separado** por conta, decisão de 17/08).

## Critérios de aceite

- [ ] Lançar um produto no estoque do Tiny da fábrica reflete na plataforma (item sem dono, origem "Tiny fábrica") — testado com um lançamento real e o payload real arquivado no cofre (F-05).
- [ ] Venda de teste na loja debita 1 do saldo do SKU correspondente; sem saldo, a falta é registrada e aparece na necessidade de produção.
- [ ] Saldo, mínimo e sinalização de necessidade visíveis por produto na tela de estoque (paginada; regra "cada tela requisita só o que mostra").
- [ ] Mínimo vindo do cadastro do Tiny da fábrica (ou plano B decidido com o dono, registrado como D-NN).
- [ ] Reconciliação periódica implementada e testada (divergência forjada é detectada e corrigida por evento).
- [ ] Tela de sugestão de mínimo pelo trimestre entregue **ou** registrada como pendência com escopo pronto.
- [ ] Token da conta nova jamais aparece em chat/print/nota/commit (conferência explícita no handoff); renovador único respeitado (nenhum job novo toca `tiny_auth`).
- [ ] Integração nova com **alerta de erro** (ou decisão do dono de adiar o P1 registrada de novo, com data).
- [ ] Decisões novas (conta, plano, mínimos, débito) registradas em [[PLT - Decisoes de Produto]]; [[N8N - Tiny Integracoes Referencia]] atualizada com a conta nova.

## Notas para o Claude Code

Ritual completo do [[CLAUDE - Regras do Claude Code (repo)]]: leituras na ordem (+ **[[N8N - Tiny Integracoes Referencia]], [[N8N - API Tiny v2 vs v3]], [[N8N - Tiny 2 para PCP]] e [[SUPA - Esquema do Banco]]** antes de qualquer desenho), demanda 2×, (a)(b)(c) antes de codar com OK do dono, task list espelho, memória em `Execucao/SESSAO-25.md` na hora, E-NN/A-NN na hora.
Terreno: v2 devolve **HTTP 200 mesmo em erro** (IF em `retorno.status` obrigatório) · códigos 6/11 = rate limit e concorrência; nunca passar de ~55/min; carga histórica em janela de baixo movimento (cota é por conta) · claim-first antes de qualquer efeito (padrão `gp_pcp_processados`) · **não existe sandbox no Tiny** — presuma teste em produção e use A-11 (testar sem sujar) · webhook de conta não é assinado: URL com UUID + conferir `cnpj`, e validar contra a API antes de agir · configuração de webhook é manual na interface do ERP (etapa do dono) · saldo é projeção de eventos (M-13); débito/entrada são eventos append-only · escrever no app via RPC própria (padrão `fn_upsert_pedido`: o n8n chama função, não tabela).
**Checklist de validação final obrigatório e marcado item a item:** `npm run test:banco` (2 rodadas) · `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` · F-07 · ⏸️ checkpoint antes de aplicar migration/workflow em produção (F-08; regra crítica 3 — tocar n8n em produção só com aprovação) · `get_advisors` · task list conferida · handoff + notas do cofre atualizadas.

## Resultado (preencher ao entregar)

*—*

## Ver também

[[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] · [[N8N - Tiny Integracoes Referencia]] · [[N8N - Pendencias e Riscos]]
