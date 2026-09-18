---
titulo: "SESSAO-24 — Estoque núcleo: aguardo, cancelamentos e alocação"
tipo: demanda
status: pronta para code
data: 2026-09-18
atualizado: 2026-09-18
tags: [plataforma, demanda, bloco-5, estoque, producao]
---

# 🎯 SESSAO-24 — Estoque núcleo: aguardo, cancelamentos e alocação

> Terceira sessão do **Bloco 5** e o começo da fase 2 prometida na D-07: a estrutura de produção "infalível" — concluir produção, pedidos em aguardo com duas visões, os três fluxos de cancelamento, estoque sem dono e sugestão de alocação no PCP. **Tudo interno à plataforma; o Tiny da fábrica entra na SESSAO-25.**

## O que é

Todo card ganha o botão **"Concluir produção"** (destino: **Pedidos em aguardo**, não mais Estoque), Pedidos em aguardo ganha as visões **"Ver pedidos"** e **"Ver itens"**, o cancelamento de pedido passa a ter três desfechos bem definidos conforme o estágio, e produto parado em estoque **sem dono** vira **sugestão de alocação** quando o PCP libera um pedido igual.

## Requisitos cobertos

RF-70 (estoque, fase 2 — D-07) · RF-14 (tempo parado no estoque). Resolve **Q-23** (produção para estoque ganha porta de entrada). Registrar os requisitos novos em [[PLT - Requisitos]].

## Decisões que regem esta demanda

**D-07** (estoque é módulo nativo, mesmo banco) · D-13/D-18 (terminais ESTOQUE e ROTAS) · **D-45 (revisada nesta sessão: o destino do "Concluir" muda de ESTOQUE para Pedidos em aguardo)** · D-31/Q-24 (cancelamento: nada se apaga, decisão sobre peças é humana — os fluxos abaixo *automatizam a consequência*, M-01) · D-22 (card nasce de pedido real — **revisada**: nasce também a peça de estoque sem dono) · RNF-05/M-02 (append-only) · M-13 (estado guardado é projeção).

## Comportamento esperado

1. **Botão "Concluir produção" em TODOS os cards de unidade** (quadro, tablet e modal), em qualquer setor de produção. Ao clicar: a unidade vai para **Pedidos em aguardo** (não mais para o setor ESTOQUE como fim de linha do clique). O `ModalMoverCard modo="concluir"` da S15 muda de destino; o gesto continua um evento comum.
2. **Pedidos em aguardo com duas subsessões** (abas internas na mesma tela):
   - **Ver pedidos** — a visão atual: unidades prontas agrupadas por pedido, (k/n), destaque para pedido completo + "Lançar para ROTAS".
   - **Ver itens** — a visão plana: cada item/unidade pronta, com pedido a que pertence, produto, tempo em aguardo. Paginadas no servidor, ambas.
3. **Cancelamento de pedido — três desfechos conforme o estágio** (o gatilho da integração já detecta o cancelamento; esta sessão trata as consequências):
   - **Pedido ainda no PCP, produção não liberada:** o card de pedido sai do quadro e entra na aba nova **"Cancelados"** dentro do PCP (histórico consultável, paginado, carregado só ao abrir). Sem efeito em estoque.
   - **Pedido com unidades em produção:** o pedido vai para Cancelados, mas **as unidades em produção não somem**: ganham a tag visível **"Pedido cancelado"** (ícone + texto, M-12) e podem continuar sendo produzidas. Quando uma unidade dessas é concluída, ela vai **direto para o estoque sem dono** — não para Pedidos em aguardo.
   - **Pedido cancelado com produto já pronto (em aguardo):** as unidades prontas saem de Pedidos em aguardo e entram no **estoque sem dono**.
4. **Estoque sem dono**: a lista de Estoque (S15) passa a distinguir **com pedido** × **sem dono** (origem: cancelamento ou lançamento manual). Item sem dono guarda o produto (código/SKU + descrição, de onde saem cor e dimensões) e a história de onde veio.
5. **Sugestão de alocação no PCP**: ao liberar um pedido, se existe em estoque sem dono um produto de **mesma cor e dimensões exatas** (mesmo produto — mesmo código/descrição), o PCP vê a sugestão: *"há 1 em estoque — usar?"*. Se aceitar, o item sai do estoque e passa a **pertencer ao pedido** (entra como unidade pronta do pedido, em Pedidos em aguardo — não volta para produção); se o pedido for cancelado depois, o item **volta para o estoque sem dono** (fluxo 3). Se recusar, a liberação segue normal para produção. Sugestão nunca decide sozinha — decisão é humana (princípio de sempre).
6. **Lançar produto em estoque pela plataforma**, sem passar pelo Tiny: tela/ação (logística e admin) que cria um item de estoque sem dono informando o produto (código/descrição). Nasce como card/evento normal (append-only), origem clara "lançamento manual". *(Este é o desfecho da Q-23: produção para estoque tem porta — pelo cancelamento que continua, ou pelo lançamento manual.)*

## Perguntar ao dono no início da sessão (ritual de sempre; só codar com o OK)

1. "Mesma cor e dimensões exatas" para a sugestão: basta ser o **mesmo código/SKU** (a descrição carrega cor e medidas)? Ou quer casar por descrição quando o código faltar?
2. Unidade com tag "Pedido cancelado" ainda em produção: alguém pode decidir **parar** e mandá-la direto ao estoque sem terminar? (Hoje: continuar é permitido; interromper e estocar inacabada é?)
3. A aba "Cancelados" do PCP guarda para sempre ou arquiva depois de N dias?
4. O botão "Concluir produção" substitui o "Concluir" da S15 em todos os lugares (destino deixa de ser ESTOQUE em tudo), certo?
5. Quem pode aceitar a sugestão de alocação: só PCP/logística e admin?

## Fora do escopo

Qualquer chamada ao Tiny (integração da fábrica, débito por venda da loja, estoque mínimo — **SESSAO-25**) · roteiro/BOM/insumos (chapas MDF etc.) · QR/etiqueta física (ideia C, Q-63) · migração de cards vivos do ClickUp (Q-25).

## Critérios de aceite

- [ ] Card de unidade em qualquer setor de produção tem "Concluir produção"; ao usar, a unidade aparece em Pedidos em aguardo (e não no setor ESTOQUE).
- [ ] "Ver pedidos" e "Ver itens" mostram os mesmos dados por ângulos diferentes; ambas paginadas no servidor; contadores batem.
- [ ] Cancelar pedido de teste em cada um dos três estágios produz exatamente o desfecho descrito (PCP→Cancelados · produção→tag e conclusão vai a estoque sem dono · pronto→estoque sem dono), verificado com pedidos reais/de teste e registrado na memória de execução.
- [ ] Aba "Cancelados" existe dentro do PCP, paginada, carregada sob demanda (regra "cada tela requisita só o que mostra").
- [ ] Estoque distingue itens com pedido × sem dono; item sem dono mostra origem (cancelamento/lançamento manual).
- [ ] Na liberação de um pedido cujo produto exista sem dono no estoque, a sugestão aparece; aceitar move o item para o pedido (some do estoque, entra em aguardo do pedido); cancelar esse pedido devolve o item ao estoque sem dono.
- [ ] Lançamento manual de estoque cria item sem dono com evento e log (D-40); só logística/admin conseguem.
- [ ] Nenhum evento existente alterado ou apagado (RNF-05); toda transição nova é evento novo com projeção.
- [ ] Revisões de D-45 e D-22 (e o fechamento da Q-23) registradas em [[PLT - Decisoes de Produto]] com D-NN novos.

## Notas para o Claude Code

Ritual completo do [[CLAUDE - Regras do Claude Code (repo)]]: leituras na ordem, demanda 2×, (a)(b)(c) antes de codar com OK do dono, task list espelho, memória em `Execucao/SESSAO-24.md` na hora, E-NN/A-NN na hora.
Terreno: **`plt_cards` NÃO tem FK para `pedido_itens` — não "consertar"** (o `fn_upsert_pedido` apaga e regrava itens; FK derrubaria produção) · o card de estoque sem dono precisa carregar o produto em colunas próprias (código/descrição), não por FK a `pedido_itens` · detecção de cancelamento usa `fn_situacao_normalizada` (E-25 — jamais comparar string crua) · a blindagem D-43 do gatilho de pedidos não pode regredir (conferir `pg_get_triggerdef` no banco real) · tag "Pedido cancelado" é projeção de evento, não coluna editada à mão (M-13) · lotes usam origem `api` e passam no `test:banco` (E-26) · Pedidos em aguardo/estoque já têm portas (`plt_fn_pedidos_aguardo`, `plt_fn_estoque`) — evoluir as portas, não criar leitura paralela (E-22: um dado, um fetcher).
**Checklist de validação final obrigatório e marcado item a item:** `npm run test:banco` (2 rodadas) · `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` · F-07 (375px/768px) · ⏸️ checkpoint antes de aplicar migration (F-08, md5 antes/depois) · `get_advisors` · task list conferida contra a demanda · handoff + notas do cofre atualizadas.

## Resultado (preencher ao entregar)

*—*

## Ver também

[[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[SESSAO-15 - Logistica e ROTAS com Caminhoes]] · [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] · [[PLT - Perguntas em Aberto]]
