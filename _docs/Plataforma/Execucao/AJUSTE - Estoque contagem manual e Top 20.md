---
titulo: "Execução — Ajuste do estoque: contagem manual, Top 20+, imagens e configurações"
tipo: execucao
data: 2026-09-28
atualizado: 2026-09-28
tags: [execucao, ajuste, estoque, logistica]
---

# 🔧 Execução — Ajuste do estoque (28/09/2026)

**Branch:** `estoque-ajustes-urgentes` · **worktree:** `Domoby - Fabrica - estoque` (a pasta principal é de outra sessão — E-60)
**Pedido do dono (28/09, na conversa):** ajustes urgentes no estoque, "não me pergunte mais nada, apenas faça". Não é uma SESSAO-NN do bloco — é ajuste pedido na hora, com as regras de sempre (branch, memória, harness, handoff).
**Sessões em paralelo no mesmo dia:** frete fora da produção (migration 39, ainda não aplicada), gaveta do menu (só front), SESSAO-24/planejamento na pasta principal. Numeração reservada e avisada: D-70…D-74 · E-60…E-64 · A-25 e A-34…A-36 · RF-100…RF-104 · migration 40.

## O diagnóstico que abriu o ajuste (só leitura, 28/09)

- O número dos acabados era **saldo do Tiny − pedidos da loja em aberto**. Desde a carga de 26/09 **nenhum aviso de estoque** chegou (o último é de 25/09 17h56; na vida toda, 9 avisos, nenhum de móvel).
- A **saída da venda não avisa**: 45 pedidos saíram da reserva entre 23 e 28/09 sem aviso — quando o pedido sai da reserva, a unidade "volta" ao estoque da tela (A-25).
- "Necessidade extrema" poluída: 99 de 168 fabricados; **57 sem nenhum pedido aberto** (é o negativo do Tiny — P16). Só 19 fabricados têm saldo positivo no Tiny (57 un.) → **por isso nenhum produto aparecia "em estoque"** (pergunta 1 do dono) e os poucos positivos ficavam nas últimas páginas (a ordem punha os problemas primeiro).
- Reposição automática: pronta mas desligada (sem cron).

## O pedido do dono (8 itens) → o que vai ser feito

1. "Por que nenhum produto está em estoque?" → resposta no fim (acima) + o número passa a ser a contagem da logística.
2. Só o que está em estoque aparece; o resto nas próximas páginas ou num botão "ver produtos" → lista padrão = top 20 ∪ o que tem estoque; "Ver os outros produtos" e a busca varrem o catálogo.
3. Cadastrar e ver a imagem de cada item → foto do produto (capa), por SKU, na biblioteca que o tablet já usa; ver ampliada ao tocar.
4. Botão "Cadastrar produto ao estoque"; a tela inicial pagina pelos 20 mais vendidos dos 90 dias; a logística dá baixa manual por enquanto → entrada / baixa / contagem manual (peças = cards no ESTOQUE, eventos append-only).
5. Cartão de produto enxuto, valores menores, destaque para a imagem; só logística e admin cadastram imagem.
6. Texto abaixo do título → ícone "i" com balão; abas no canto superior direito em quadrados que reagem ao passar o mouse.
7. Mínimo editável numa aba de configurações, com a capacidade máxima do galpão; a sugestão de mínimo cabe no galpão ("cuidado aqui").
8. A aba Sugestão de mínimo vira Configurações; a lista de prioridade (mais → menos vendido) vai para "Produtos acabados", que passa a se chamar **Top 20+**.

## Decisões técnicas (minhas, registradas)

- **O número dos acabados = peças livres no ESTOQUE** (a contagem da plataforma). Entrada manual cria N peças (cards `unidade` sem pedido, com o produto) direto no ESTOQUE; baixa arquiva as N mais antigas (evento `card_arquivado`, motivo `baixa_manual`); contagem = entrada/baixa da diferença. Assim a sugestão do PCP ("há N no estoque — usar?") já enxerga o que a logística cadastrou, sem nada novo (M-15: a tela pensa em quantidade; por baixo, peça).
- **O Tiny sai da conta dos acabados** (fica só nos insumos e como referência no detalhe do produto). A reposição automática (desligada) passa a olhar a contagem da plataforma e o mínimo efetivo; o ciclo reabre com **movimento novo do estoque** (antes: leitura nova do Tiny).
- **Mínimo da plataforma**: coluna nova em `produtos` (`minimo_plataforma`, nula = vale o do Tiny) — banco enxuto/D-47 (o catálogo já é a casa do produto; `fn_upsert_produto` só grava as colunas dele). **Capacidade do galpão**: coluna nova em `plt_setores` (`capacidade_pecas`, no ESTOQUE). **Foto**: `produtos.imagem_caminho` (a porta da lista devolve o caminho — nada de listar o storage por cartão, regra 17).
- **Sugestão que cabe no galpão**: média semanal × cobertura; se a soma passar da capacidade, todas encolhem na mesma proporção e o arredondamento é pelo maior resto (a soma nunca passa; o mais vendido nunca fica com menos que o de baixo). Quem não vendeu em 90 dias: sem sugestão.
- Nenhuma função recriada pela migration do frete é tocada aqui (combinado com a outra sessão).

## Task list (espelho do pedido) — conferir no fim

- [x] 1. Banco: colunas (mínimo da plataforma, foto, capacidade) + vendas de 90 dias numa função só
- [x] 2. Banco: base do estoque com a contagem da plataforma e o mínimo efetivo; reposição coerente
- [x] 3. Banco: entrada / baixa / contagem manual (gate da logística, trava por produto, eventos)
- [x] 4. Banco: lista Top 20+ (top 20 ∪ com estoque; "os outros"; busca no catálogo), peças com origem "entrada manual"
- [x] 5. Banco: configurações (mínimo, capacidade, sugestão que cabe, aplicar todas) + resumo
- [x] 6. Banco: foto do produto (porta + política de storage para a logística)
- [x] 7. Harness: cenários novos + os da S25 ajustados à regra nova; 2 rodadas verdes
- [ ] 8. Front: cabeçalho com "i" e abas em quadrados no canto superior direito
- [ ] 9. Front: Top 20+ (cartão enxuto com foto, entrada/baixa, cadastrar produto, ver os outros, detalhe)
- [ ] 10. Front: Configurações (capacidade, mínimos, sugestão) e Insumos
- [ ] 11. tsc · lint · test · build · mojibake 0
- [ ] 12. Aplicar no banco (só esta migration, `--so`), impressão digital antes/depois, advisors
- [ ] 13. Telas no navegador (logado pelo dono) + F-07 375/768
- [ ] 14. Cofre: decisões, requisitos, esquema, modelo de sistema, memória, handoff, mapa

## Log

- 28/09 · diagnóstico no banco real (só leitura) — números acima; A-25 registrado.
- 28/09 · E-60: o `git checkout --` no arquivo da memória da pasta principal levou junto uma linha da outra sessão (corrida). Trabalho movido para worktree própria.
- 28/09 · worktree criada de `origin/main` (fcf1af1) e atualizada para 96207bc (plano 003, regra 12c); `npm install`; `.env.local` copiado sem exibir.
- 28/09 · lidas no banco real (dump para o scratchpad, só leitura) as funções vivas: `fn_estoque_por_produto`, `fn_gerar_reposicoes`, `fn_validar_api`, `fn_validar_chegada_estoque`, `fn_projetar_posicao`, `plt_fn_alocar_peca`, `plt_fn_estoque`, `plt_fn_estoque_sugestao_minimo`, `plt_fn_reposicoes_resumo` e os gatilhos de `plt_eventos` — card nasce por INSERT + `card_criado` (o gatilho projeta), `card_criado` no ESTOQUE não avisa ninguém (`fn_reagir_qualidade` só olha marcação/parecer/movimento), ESTOQUE com delegação desativada, nenhum webhook ativo.
- 28/09 · a sessão do frete confirmou: o gatilho novo dela em `plt_cards` só age em unidade COM pedido — a peça manual (sem pedido) passa.
- 28/09 · **migration 40** escrita (`20260928180000_plt_estoque_contagem_top20.sql`): colunas `produtos.minimo_plataforma` / `produtos.imagem_caminho` / `plt_setores.capacidade_pecas` (+ checks); `plt_privado.fn_vendas_90d` e `fn_sugestoes_minimo` (novas); `fn_estoque_por_produto` (mesma forma — mínimo efetivo; disponível dos acabados = peças livres), `fn_gerar_reposicoes` (ciclo reabre com movimento do estoque) e `fn_validar_api` (logística dá baixa em peça livre do ESTOQUE) recriadas por inteiro; `plt_fn_estoque_produtos` drop+create (Top 20+); `plt_fn_estoque` (origem `manual`); `plt_fn_estoque_sugestao_minimo` sai; portas novas `plt_fn_estoque_configuracoes`, `_resumo`, `_movimentar`, `_definir_minimo`, `_aplicar_sugestoes`, `_definir_capacidade`, `_definir_imagem`; política de storage `plt_imagens_estoque_logistica` (guardada).
- 28/09 · E-17 na migration 36: `drop function if exists plt_fn_estoque_produtos(...)` antes do create (a 2ª rodada passa por cima da forma nova).
- 28/09 · 1ª rodada do harness: "syntax error at end of input" sem linha → E-61 (CASE sem parênteses na condição do IF do plpgsql). Achado fatiando a migration (scratchpad `bisect2/3/4.mjs`).
- 28/09 · harness: 6 verificações da S25 ajustadas à regra nova (número = contagem; reposição repõe 4; ciclo reabre com baixa; sugestão pela porta de Configurações) + **36 verificações novas** do ajuste. `npm run test:banco` ✅ TUDO VERDE (485 ✔).
