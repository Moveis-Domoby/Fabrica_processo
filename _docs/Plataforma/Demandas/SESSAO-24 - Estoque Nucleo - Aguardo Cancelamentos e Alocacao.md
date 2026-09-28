---
titulo: "SESSAO-24 — Produção concluída, cancelamentos e alocação"
tipo: demanda
status: entregue — migration 37 aplicada em 27/09; merge com o dono
data: 2026-09-18
atualizado: 2026-09-27
tags: [plataforma, demanda, bloco-5, estoque, producao]
---

# 🎯 SESSAO-24 — Produção concluída, cancelamentos e alocação

> [!warning] A ordem mudou em 24/09/2026 (D-53)
> Esta sessão **roda DEPOIS da [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]]**, a pedido do dono (estoque entregue com urgência).
> **O que era "estoque" aqui foi movido para a 25**: item **com pedido × sem dono**, **lançamento manual de estoque** e a **tela de Estoque** (saldo, mínimo, sinalização). Esta demanda ficou com as **consequências da produção e do cancelamento**, que consomem aquilo. **Não reconstruir o que a 25 entregou** — ler o handoff dela primeiro.
>
> **↪️ O que a 25 ENTREGOU (26/09 — [[handoff_2026_09_26_sessao25_estoque]]), que muda esta demanda:**
> - **Não existe lançamento manual** (D-54). A peça **sem dono** é a unidade com `pedido_id` NULO + `produto_tiny_id` (catálogo da fábrica) — hoje nasce do **card de REPOSIÇÃO** (tipo `reposicao`) que o estoque gera no PCP. O cancelamento desta sessão cria peça sem dono do MESMO jeito (pedido desvinculado por evento), com a origem "cancelamento".
> - **Estoque de fato = pronta, 🟢 e sem pedido** (o banco já recusa 🟡/🔴 chegando no ESTOQUE). Pronta com pedido = **reservada** (SKU + pedido).
> - **"Concluir produção" da unidade de REPOSIÇÃO continua indo para o ESTOQUE** (fica livre, aguardando a venda); só a unidade COM pedido vai para Pedidos em aguardo.
> - **Personalizado (regra do dono, 26/09):** o produzido cujo pedido foi cancelado **vai para o estoque** e, a partir daí, uma venda igual dá baixa nele — casar por SKU **e** descrição (a loja reusa o SKU com outras medidas; regra única `plt_privado.fn_eh_personalizado`).
> - A sugestão de alocação casa por **SKU** — o id do produto da loja NUNCA casa com o da fábrica (A-22). Evoluir `plt_fn_estoque`/`plt_fn_estoque_produtos` (E-22), e usar o componente `ui/Abas` no "Ver pedidos / Ver itens".

## O que é

Todo card ganha o botão **"Concluir produção"** (destino: **Pedidos em aguardo**, não mais Estoque), Pedidos em aguardo ganha as visões **"Ver pedidos"** e **"Ver itens"**, o cancelamento de pedido passa a ter três desfechos bem definidos conforme o estágio, e produto parado em estoque **sem dono** (criado na 25) vira **sugestão de alocação** quando o PCP libera um pedido igual.

## Requisitos cobertos

RF-70 (estoque, fase 2 — D-07) · RF-14 (tempo parado no estoque). Registrar os requisitos novos em [[PLT - Requisitos]].

## Decisões que regem esta demanda

**D-53** (ordem: 25 antes da 24; o estoque base saiu daqui) · **D-07** (estoque é módulo nativo, mesmo banco) · D-13/D-18 (terminais ESTOQUE e ROTAS) · **D-45 (revisada nesta sessão: o destino do "Concluir" muda de ESTOQUE para Pedidos em aguardo)** · D-31/Q-24 (cancelamento: nada se apaga, decisão sobre peças é humana — os fluxos abaixo *automatizam a consequência*, M-01) · D-22 (card nasce de pedido real — **revisada**: existe também a peça de estoque sem dono, criada na 25) · RNF-05/M-02 (append-only) · M-13 (estado guardado é projeção).

## Comportamento esperado

1. **Botão "Concluir produção" em TODOS os cards de unidade** (quadro, tablet e modal), em qualquer setor de produção. Ao clicar: a unidade vai para **Pedidos em aguardo** (não mais para o setor ESTOQUE como fim de linha do clique). O `ModalMoverCard modo="concluir"` da S15 muda de destino; o gesto continua um evento comum.
2. **Pedidos em aguardo com duas subsessões** (abas internas na mesma tela):
   - **Ver pedidos** — a visão atual: unidades prontas agrupadas por pedido, (k/n), destaque para pedido completo + "Lançar para ROTAS".
   - **Ver itens** — a visão plana: cada item/unidade pronta, com pedido a que pertence, produto, tempo em aguardo. Paginadas no servidor, ambas.
3. **Cancelamento de pedido — três desfechos conforme o estágio** (o gatilho da integração já detecta o cancelamento; esta sessão trata as consequências):
   - **Pedido ainda no PCP, produção não liberada:** o card de pedido sai do quadro e entra na aba nova **"Cancelados"** dentro do PCP (histórico consultável, paginado, carregado só ao abrir). Sem efeito em estoque.
   - **Pedido com unidades em produção:** o pedido vai para Cancelados, mas **as unidades em produção não somem**: ganham a tag visível **"Pedido cancelado"** (ícone + texto, M-12) e podem continuar sendo produzidas. Quando uma unidade dessas é concluída, ela vai **direto para o estoque sem dono** — não para Pedidos em aguardo.
   - **Pedido cancelado com produto já pronto (em aguardo):** as unidades prontas saem de Pedidos em aguardo e entram no **estoque sem dono**.
4. **Sugestão de alocação no PCP**: ao liberar um pedido, se existe em estoque **sem dono** (a estrutura veio da 25) um produto de **mesma cor e dimensões exatas** (mesmo produto — mesmo código/descrição), o PCP vê a sugestão: *"há 1 em estoque — usar?"*. Se aceitar, o item sai do estoque e passa a **pertencer ao pedido** (entra como unidade pronta, em Pedidos em aguardo — não volta para produção); se o pedido for cancelado depois, o item **volta para o estoque sem dono** (fluxo 3). Se recusar, a liberação segue normal para produção. Sugestão nunca decide sozinha.

## Perguntar ao dono no início da sessão (ritual de sempre; só codar com o OK)

1. "Mesma cor e dimensões exatas" para a sugestão: basta ser o **mesmo código/SKU** (a descrição carrega cor e medidas)? Ou casar por descrição quando o código faltar? *(Depois da 25 existe o `tiny_id` do produto — usar ele como chave preferida.)*
2. Unidade com tag "Pedido cancelado" ainda em produção: alguém pode decidir **parar** e mandá-la direto ao estoque sem terminar? (Hoje: continuar é permitido; interromper e estocar inacabada é?)
3. A aba "Cancelados" do PCP guarda para sempre ou arquiva depois de N dias?
4. O botão "Concluir produção" substitui o "Concluir" da S15 em todos os lugares (destino deixa de ser ESTOQUE em tudo), certo?
5. Quem pode aceitar a sugestão de alocação: só PCP/logística e admin?

## Fora do escopo

**Tudo que é estoque-base e Tiny — foi para a [[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]]**: item sem dono (estrutura), lançamento manual, tela de Estoque, saldo, mínimos, débito por venda · roteiro/BOM/insumos · QR/etiqueta física (ideia C, Q-63) · migração de cards vivos do ClickUp (Q-25).

## Critérios de aceite

- [x] ~~Card de unidade em qualquer setor de produção tem "Concluir produção"~~ **↪️ revisado pelo dono (D-59): só a LIMPEZA E EMBALAGEM tem "Concluir produção"; os outros setores encaminham arrastando.** Ao usar, a unidade de pedido aparece em Pedidos em aguardo (e não no ESTOQUE) — provado no harness e no ensaio no banco real.
- [x] "Ver pedidos" e "Ver itens" — **com os nomes do dono: "Pedidos" e "Produtos reservados"** — mostram os mesmos dados por ângulos diferentes; ambas paginadas no servidor; contadores batem (uma porta só — harness).
- [x] Cancelar pedido de teste em cada um dos três estágios produz exatamente o desfecho descrito — os 3 no harness; o 3º (peça pronta no aguardo) também no ensaio no banco real, com o pedido 13215 (desfeito) — registrado na memória de execução.
- [x] Aba "Cancelados" existe dentro do PCP, paginada, carregada sob demanda (guarda para sempre — b3).
- [x] Na liberação de um pedido cujo produto exista sem dono no estoque, a sugestão aparece; aceitar faz a unidade do pedido nascer em Pedidos em aguardo (a peça livre é consumida); cancelar esse pedido devolve a peça ao estoque sem dono — harness (em produção ainda não existe peça sem dono para provar ao vivo).
- [x] Nada do que a SESSAO-25 entregou foi recriado ou duplicado (um dado, um dono — M-04): as portas dela foram evoluídas (`fn_estoque_por_produto`, `plt_fn_estoque`, `plt_fn_pedidos_aguardo`).
- [x] Nenhum evento existente alterado ou apagado (RNF-05); toda transição nova é evento novo com projeção (`unidade_desvinculada`, `peca_alocada`).
- [x] Revisões registradas em [[PLT - Decisoes de Produto]] com D-NN novos: D-58 (revisa D-13/D-18/D-38/D-45), D-59 (revisa D-24/D-48/D-03), D-60, D-61, D-62. (D-22 e Q-23 já tinham sido revistas/fechadas pela 25 — D-54.)

## Notas para o Claude Code

Ritual completo do [[CLAUDE - Regras do Claude Code (repo)]]: leituras na ordem + **o handoff da SESSAO-25** antes de qualquer desenho, demanda 2×, (a)(b)(c) antes de codar com OK do dono, task list espelho, memória em `Execucao/SESSAO-24.md` na hora, E-NN/A-NN na hora.
Terreno: **`plt_cards` NÃO tem FK para `pedido_itens` — não "consertar"** (o `fn_upsert_pedido` apaga e regrava itens; FK derrubaria produção) · o card de estoque sem dono carrega o produto em colunas próprias (estrutura criada na 25) · detecção de cancelamento usa `fn_situacao_normalizada` (E-25 — jamais comparar string crua) · a blindagem D-43 do gatilho de pedidos não pode regredir (conferir `pg_get_triggerdef` no banco real) · tag "Pedido cancelado" é projeção de evento (M-13) · lotes usam origem `api` e passam no `test:banco` (E-26) · evoluir as portas existentes (`plt_fn_pedidos_aguardo`, `plt_fn_estoque`), não criar leitura paralela (E-22).
**Checklist de validação final obrigatório e marcado item a item:** `npm run test:banco` (2 rodadas) · `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` · F-07 (375px/768px) · ⏸️ checkpoint antes de aplicar migration (F-08, md5 antes/depois) · `get_advisors` · task list conferida contra a demanda · handoff + notas do cofre atualizadas.

## Resultado (preencher ao entregar)

**Entregue em 27/09/2026** — handoff: [[handoff_2026_09_27_sessao24_producao_concluida]] · memória: `_docs/Plataforma/Execucao/SESSAO-24.md`.

**O dono mudou o desenho no início da sessão** (respostas de 27/09): depois de um alinhamento com a equipe, **tudo por arrasto** — soltar no início inicia o tempo, soltar em etapa com nome de setor ou CONCLUÍDO leva ao próximo setor, e o **único botão é "Concluir produção", só na LIMPEZA E EMBALAGEM** (D-59/D-60); **Pedidos em aguardo virou o lugar** da peça pronta de pedido e o ESTOQUE ficou só com peça sem dono (D-58); as abas se chamam **"Pedidos" e "Produtos reservados"**; nada de estocar peça inacabada; Cancelados guarda para sempre (D-61); sugestão com a regra de "peça igual" e aceita por PCP/logística e admin (D-62).

**Banco:** migration 37 aplicada com o OK do dono (integração do Tiny idêntica), rotas de 20 etapas gravadas, as 6 peças antigas tratadas pela resposta do dono (2 → aguardo, 3 arquivadas de pedidos já entregues, a 🔴 ficou — card de teste, Q-69). Harness: 57 checks novos; ensaio no banco real desfeito, tudo como esperado.

**Q-69 e Q-70 respondidas na mesma sessão** (a 502 é card de teste — fica; 518 e 537 arquivadas). **Pendente com o dono:** conferir as telas e mesclar na `main`.

## Ver também

[[SESSAO-25 - Integracao Tiny Fabrica - Estoque e Minimos]] (roda ANTES desta) · [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[SESSAO-15 - Logistica e ROTAS com Caminhoes]] · [[PLT - Perguntas em Aberto]]
