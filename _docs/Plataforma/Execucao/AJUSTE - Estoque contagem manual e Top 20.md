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
- [x] 8. Front: cabeçalho com "i" e abas em quadrados no canto superior direito
- [x] 9. Front: Top 20+ (cartão enxuto com foto, entrada/baixa, cadastrar produto, ver os outros, detalhe)
- [x] 10. Front: Configurações (capacidade, mínimos, sugestão) e Insumos
- [x] 11. tsc · lint · test · build · mojibake 0
- [x] 12. Aplicar no banco (só esta migration, `--so`), impressão digital antes/depois, advisors
- [x] 13. Telas no navegador (logado pelo dono) + F-07 375/768
- [x] 14. Cofre: decisões, requisitos, esquema, modelo de sistema, memória, handoff, mapa

**Conferida contra o pedido do dono (28/09):** 1 respondida (handoff §1) · 2 Top 20+ ∪ com estoque, "Ver os outros produtos" e busca · 3 foto por produto · 4 "Cadastrar produto ao estoque" + Top 20 na tela inicial + entrada/baixa/contagem manual · 5 cartão enxuto com a foto em destaque, só logística/admin cadastram · 6 "i" com balão + quadrados no canto que reagem ao mouse · 7 mínimo editável + capacidade do galpão + sugestão que cabe · 8 Sugestão → Configurações e a lista de prioridade no Top 20+. ✅ todos.

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
- 28/09 · **front:** `src/logistica/api.ts` (tipos novos; `movimentarEstoque`, `listarConfiguracoesEstoque`, `resumoEstoque`, `definirMinimo`, `aplicarSugestoes`, `definirCapacidade`, `enviarFotoProduto`, `urlFotoProduto`; saiu `sugestaoMinimo`), `src/logistica/estoque.ts` (sinal novo sem "necessidade extrema", `previaMovimento`, `rotuloPosicao`) + testes; componentes novos em `src/logistica/componentes/` (`FotoProduto`, `SeloSinal`, `CartaoProdutoEstoque`, `ModalMovimentarEstoque`, `ModalEscolherProduto`, `ModalProdutoEstoque`, `PecasDoEstoque`, `PainelTop20`, `PainelInsumos`, `PainelConfiguracoes`); `src/paginas/Estoque.tsx` reescrita (título + `Dica`, abas em quadrados no canto); `src/componentes/ui/Dica.tsx` (novo) e `Abas` com `variante="quadrados"`; `src/lib/imagem.ts` (reduz a foto no aparelho); `pastaDoProduto` exportada do tablet (uma regra só para a pasta do SKU); `ModalLiberarPedido` rotula a peça manual como "Está pronta no estoque". `tsc` ✅ · `lint` ✅ · `npm test` ✅ 82/82.
- 28/09 · aviso à sessão do frete ANTES de aplicar; `npm run banco:aplicar -- --confirmar --so 20260928180000_plt_estoque_contagem_top20.sql` → ✔, **integração idêntica** (digital `e2109f3a…`, 65 colunas, linhas idênticas: clientes 10700 · pedidos 5413 · pedido_itens 8107 · eventos 8491 · gp 1).
- 28/09 · conferido no banco real: as 9 portas executáveis por `authenticated` e NÃO por `anon`; maquinaria (`fn_vendas_90d`, `fn_sugestoes_minimo`, `fn_estoque_por_produto`, `fn_gerar_reposicoes`) fora da API; política de storage `plt_imagens_estoque_logistica` criada; a sugestão antiga saiu. Advisors de segurança: só o padrão esperado (portas DEFINER de propósito — +7 novas, −1 antiga).
- 28/09 · ensaio de leitura no banco real (bloco que termina em exceção — nada gravado), como o admin: Top 20+ devolve **20** produtos na ordem do rank (327, 174, 489, 029, 419…), todos com 0 em estoque (ninguém contou ainda); reservadas: 174 e 521 (as peças do 13215 no aguardo); resumo: capacidade vazia, soma dos mínimos 133, soma das sugestões 274 (2 semanas), 48 abaixo do mínimo, 0 no estoque, 3 reservadas; configurações: 327 → sugestão 15.
- 28/09 · preview da worktree: junção sem espaço `C:\Users\wccau\Domoby\estq` + entrada `plataforma-estoque` (porta 5176) no `.claude/launch.json` da pasta principal (padrão das sessões paralelas). Aguardando o dono entrar para conferir as telas.
- 28/09 · cofre: D-70…D-74 (+ ↩️ em D-54/D-55/D-57), RF-100…RF-104 (+ ↩️ RF-72/RF-76), Esquema do Banco (produtos, plt_setores, parágrafo da migration 40), Modelo de Sistema (seção do estoque enxuto: Dica, abas em quadrados, cartão com foto, movimentar, configurações), nota do n8n (o saldo saiu da conta dos acabados).
- 28/09 · **o dono entrou no preview (5176) e pediu "teste"** — conferido logado: Top 20+ com os 20 da ordem real e as 2 reservadas (174, 521); "i" com balão; quadrados com o nome ao passar o mouse; **E2E no 327:** entrada 2 (mesmo lote, com a observação) → contagem 1 (saiu a mais antiga, motivo `contagem`) → baixa 1 (motivo `baixa_manual`) = 0, os 4 eventos com o nome do dono; **foto:** imagem de teste gerada no canvas entrou pelo input escondido (DataTransfer), foi reduzida de 55 KB PNG para 16 KB JPEG, apareceu no cartão e foi **apagada** pelo cliente do próprio app (porta com nulo + storage.remove — A-34; pasta do 327 vazia, capa nula); "Cadastrar produto ao estoque" buscando "penteadeira" (3 achados, com a posição); "Ver os outros produtos" (21º em diante); insumos com estoque primeiro; **Configurações:** capacidade 100 → soma das sugestões exatamente 100 (327 → 7, 174 → 4…) e o aviso "soma dos mínimos passa da capacidade"; mínimo do 327 = 5 (soma 133 → 134) e de volta ao do Tiny (133); "usar todas" até a confirmação e cancelado; capacidade de volta ao vazio.
- 28/09 · acertos da conferência (commit próprio): "Usar todas as sugestões" não estica mais (self-start); caixa da sugestão com largura fixa (linhas alinhadas); "…" em vez de 0 enquanto o resumo carrega; a explicação da sugestão virou "i" ao lado do título (pedido do dono de menos texto); contagem nasce com o campo vazio também ao trocar de operação; "Cadastrar produto ao estoque" sem quebrar linha no tablet.
- 28/09 · F-07: 375px e 768px sem rolagem lateral e sem alvo < 44px (os únicos "pequenos" são os inputs de arquivo escondidos). A faixa escura à esquerda no celular é o defeito antigo da gaveta — corrigido pela outra sessão, já na `main`. Console sem erros.
- 28/09 · `main` andou (gaveta + SESSAO-26): `git merge origin/main` sem conflito; `tsc` ✅, `npm test` ✅ 82/82, **`test:banco` ✅ 485 (2ª rodada)**. A 39 do frete foi aplicada no banco pela outra sessão depois da 40 (ela avisou; nada da 40 tocado) mas ainda não está na `main` — quem mesclar por último junta os blocos do harness (combinado).
