---
titulo: Ajuste — Estoque sincronizado com o Tiny (as duas mostrando o mesmo número) e a venda reservando a peça
tipo: execucao
data: 2026-09-30
atualizado: 2026-09-30
tags: [execucao, ajuste, estoque, tiny, n8n, d-76, d-77, d-78, d-79, d-80]
---

# ⚙️ Execução — Estoque sincronizado com o Tiny (29–30/09/2026)

**Branch:** `estoque-sincronizado-tiny` (na pasta principal — o dono pediu, 29/09: *"não crie worktree nova, trabalha na principal"*)
**Migration:** 42 — `supabase/migrations/20260930120000_plt_estoque_sincronizado_tiny.sql`
**Numeração usada:** D-76…D-80 · RF-105…RF-108 · E-69/E-70 · A-39/A-40 (conferido em todas as cópias em 30/09; a maior em uso era E-67, da frente do Frete; A-38, E-68 e D-81 ficaram com a sessão das fotos do Tiny, que trabalha na mesma pasta)

## O pedido do dono (29/09, depois do vídeo do Guilherme)

- *"a ideia futura é deixar que a plataforma seja o centro … mas eles irão usar o tiny por bastante tempo ainda"*
- Entrada/Baixa/Contagem ficam na plataforma e **atualizam o Tiny** daquele produto (ex.: Tiny −2, entrada de 4 → Tiny fica com 4).
- Cadastro no Tiny **sobe a plataforma** pelo SKU (ex.: plataforma 0 com 2 cards de reposição no PCP; 4 lançadas no Tiny → plataforma positiva e os cards somem).
- Venda: pedido novo com o SKU tira 1 da plataforma, **sem mandar nada ao Tiny** e sem aceitar o que o Tiny mandar por causa da venda.
- Respostas de 29–30/09: o funcionário do vídeo é o **Guilherme** (líder da logística), que **zerou para refazer o balanço**; a equipe **só olha o saldo multiempresa**; produção que chega ao estoque → a plataforma avisa o Tiny sozinha (a equipe para de lançar); venda com peça pronta → **reserva na hora, o pedido segue no PCP, se o PCP não liberar a peça ela volta e o Tiny soma +1 — o PCP decide**; saída feita no Tiny é ignorada; ponto de partida = **copiar o Tiny uma vez**; *"quero 1 único fluxo que faz o trabalho completinho sem erro"*; *"já tá aprovado"* (banco e n8n).

## Task list (espelha o pedido — conferir no fim)

- [x] 1. Diagnóstico do vídeo + dados reais (o multiempresa = 4 depósitos de 2 empresas; o aviso da fábrica só vê o Geral)
- [x] 2. Banco: fila do Tiny, leitura que sobe a plataforma, ajuste que iguala o Tiny, venda que reserva, ligar com cópia (migration 42)
- [x] 3. Testes do banco (35 verificações novas; 552 no total, duas rodadas)
- [x] 4. n8n: UM fluxo só (aviso da fábrica e da loja → fila → leitura → ajuste; varredura noturna; catálogo continua) — a carga avulsa do saldo morre
- [x] 5. Tela: PCP marca a peça reservada; detalhe do produto mostra o Tiny somado e a reserva; Configurações com a situação do Tiny e ligar/desligar (admin)
- [x] 6. Aplicar a 42 no banco real (`--so`), advisors, esquema/`.sql`
- [x] 7. Verificação ao vivo (tela logada) + publicar (main → Vercel)
- [x] 8. n8n trocado e publicado (pelo Claude, dono logado) + aviso de estoque ligado na conta da LOJA (dono) → sincronismo ligado 30/09 01:30 → cópia inicial conferida 01:42
- [x] 9. Cofre: D-76…D-80, RF, esquema, nota do n8n, memória de aprendizado, handoff, mapa, próximos passos

## Diagnóstico (só leitura no banco real, 29–30/09)

- 728 avisos de estoque em 29/09, **todos do CNPJ da fábrica**; 703 = zero, 25 positivos. No fim do dia só **um** móvel positivo no Geral da fábrica (345 = 1).
- A carga que o dono rodou em 29/09 23:37 (445 produtos) mostra o multiempresa por depósito: **FábricaDomoby/Geral** + **lojadomoby/Fábrica · Loja · Desmontado**. Ex.: 174 = Geral 0 + loja/Fábrica 3 (os 3 da tela do vídeo); 327 = loja/Fábrica 2; 345 = Geral 1 + loja/Fábrica 2.
- A carga de 26/09 já mostrava o padrão: vendas baixam no depósito "Fábrica" da LOJA (118 móveis negativos, −776 somados) e a produção entrava no Geral da fábrica.
- **O "reservado" do Tiny não serve:** 345 = 47 reservados × 2 unidades em pedidos abertos no banco; 174 = 0 × 6. O número que vale é o **saldo** somado (o que o Guilherme contou).
- A API v3 da loja (token do Comercial) respondeu **403** no estoque (o aplicativo não tem esse escopo) — só leitura tentada, nada gravado. O Tiny não estava logado no navegador do app (não se entra com senha).
- O mínimo 2 do 174 foi o dono em 28/09 11:40; o Guilherme aplicou "usar todas as sugestões" em 29/09 18:21 e pôs a capacidade do galpão em 50 (a logística já usa a tela).
- Em 30/09 só 5 pessoas ativas (4 admins) e 2 com gesto em 3 dias: **a produção do galpão ainda não passa pela plataforma**.

## Decisões técnicas (as de produto viram D-76…D-80)

1. **Tiny → plataforma = "sobe até o Tiny", não "soma a diferença".** O aviso só traz o saldo final (sem tipo de movimento); somar diferenças transforma correção de balanço em peça (o −7 → 0 do 327 viraria 7). Regra: leitura do saldo SOMADO (produto.obter.estoque da fábrica); se o Tiny (negativo = 0) estiver acima de livres + reservadas-para-venda, cria a diferença (motivo `tiny`, origem `api`); abaixo, nada.
2. **Plataforma → Tiny = o Tiny fica com as LIVRES** (o número da tela; o modelo do dono: a venda baixa o Tiny na hora). Ajuste no depósito **"Fábrica" da empresa da loja** (onde as peças estão e a venda baixa), pela conta da LOJA (id do produto na loja = último pedido com o SKU); sem ele, no **Geral** da fábrica. Balanço (idempotente — o n8n pode repetir); se o balanço ficaria negativo, saída da diferença.
3. **Fila no banco, uma linha por produto** (`plt_tiny_estoque_fila`): vários movimentos viram um pedido; versão para não apagar pedido novo; 5 falhas seguidas → para e aparece na tela; reservado por 10 min. Tabela nova (exceção à D-47): a `tiny_fila` é da conta da loja e o consumidor dela (backfill) pegaria estes itens.
4. **Quem manda ao Tiny:** entrada/baixa/contagem (inclusive conferida), arquivar peça livre, chegada/saída do ESTOQUE, peça livre usada num pedido, PCP liberar para produção a unidade que tinha peça reservada. **Não mandam:** o que veio do Tiny (`tiny`/`tiny_copia`), a venda (reserva e consumo), reserva desfeita por cancelamento ou pedido alterado, peça reservada usada no próprio pedido. Tudo num gatilho (`plt_eventos_zzz_tiny_estoque`, roda por último).
5. **Venda (a cada minuto, pg_cron `plt-estoque-reservas`):** só pedido cujo card nasceu DEPOIS de ligar (a venda de antes já está no saldo copiado); cada unidade de acabado reserva a peça livre igual mais antiga (evento `peca_reservada`, projeção em `plt_cards.reservada_*`); o pedido ganha `estoque_reserva_avaliada` (uma vez só). Reserva viva: cancelado → desfaz sem Tiny; unidade liberada pelo PCP → desfaz e o Tiny recebe; item mudou → desfaz; faturado/pronto/enviado/entregue/não entregue → a peça sai com o pedido (`card_arquivado` motivo `venda`, origem `api` — E-26). Depois de cada venda, uma leitura do Tiny (só conferência — confirma como o Tiny baixa a venda).
6. **Contagem é física:** conta as reservadas que ainda estão no galpão (contar menos que as reservadas é recusado).
7. **Ligar/desligar é do admin** (`plt_fn_tiny_estoque_ligar/desligar`); a chave mora no ESTOQUE (`plt_setores.tiny_sincronizado_desde`, como a capacidade do galpão). Ligar põe todos os acabados na fila para COPIAR (dois sentidos). Tudo nasce desligado.
8. **Só a maquinaria reserva** (gatilho `plt_eventos_validar_reserva` com a flag `plt.estoque_maquinaria` — vale até para a chave de serviço, M-14).

## Arquivos

- `supabase/migrations/20260930120000_plt_estoque_sincronizado_tiny.sql` (nova — 42)
- `supabase/migrations/20260927120000_plt_producao_concluida_cancelamentos.sql` (37: o `validate` do check de tipos saiu — E-19; `drop` antes de recriar a sugestão — E-17)
- `supabase/migrations/20260928120000_plt_itens_fora_da_producao.sql` (39: `drop` antes de recriar a sugestão — E-17)
- `supabase/testes/testar-migrations.mjs` (bloco "Estoque × Tiny", 37 verificações, em escopo próprio)
- `src/logistica/api.ts`, `src/logistica/estoque.ts` (+ teste), `src/logistica/componentes/{PainelConfiguracoes,ModalMovimentarEstoque,ModalProdutoEstoque,PecasDoEstoque}.tsx`, `src/kanban/api.ts`, `src/kanban/componentes/ModalLiberarPedido.tsx`
- `_docs/Fabrica n8n/domoby-tiny-fabrica-produtos.json` (fluxo único, gerado por script a partir do atual — catálogo intacto, mesmo caminho de webhook) · `domoby-tiny-fabrica-carga-saldo.json` (removido)
- Cofre: Decisões (D-76…D-80, ↪️ D-62/D-70), Requisitos (RF-105…RF-108), Esquema do Banco, nota do n8n, Memória (E-69, E-70, A-39, A-40), handoff, mapa, próximos passos
- **30/09 manhã — a lista das reservas presas:** `supabase/migrations/20260930200000_plt_tiny_reservas_presas.sql` (nova — 46, só uma porta de leitura) · `supabase/testes/testar-migrations.mjs` (bloco 46, 9 verificações, escopo próprio, antes do Resumo) · `src/logistica/api.ts` (`ReservaPresaTiny`, `listarReservasPresasTiny`) · `src/logistica/componentes/ReservasPresasTiny.tsx` (novo) · `PainelConfiguracoes.tsx` (1 import + 1 linha no `CartaoTiny`) · cofre: ↪️ D-76, RF-108, esquema, ↪️ A-39 (sem número novo — A-42+/E-73+ são da sessão "Ajuste Estoque 2"), handoff, mapa, próximos passos

## Comandos e resultados

- `node supabase/testes/testar-migrations.mjs` → antes dos testes novos: tudo verde (a 42 aplica duas vezes); com o bloco novo: **552 ✔, TUDO VERDE** (a 1ª tentativa quebrou só por nome de variável repetido com bloco antigo → escopo próprio `{ … }`).
- Commit `ae60864` (banco + testes) e `94599f5` (telas + n8n) na branch.
- 2ª rodada do harness (lista com `reservadas_estoque` e peça com `reservada_numero`): **554 ✔**.
- `tsc -b` ✔ · `eslint src --max-warnings=0` ✔ · `vitest run` **84/84** ✔ · `npm run build` ✔ · grep de mojibake no `src` limpo.
- `npm run banco:aplicar -- --confirmar --so 20260930120000_plt_estoque_sincronizado_tiny.sql` → ✔; integração idêntica (`e2109f3a…`, 65 colunas; clientes 10710 · pedidos 5431 · itens 8134 · eventos 9762). No banco real: cron `plt-estoque-reservas` ativo; portas do n8n só `service_role`; situação/ligar só `authenticated` (anon não); maquinaria fora da API; chave desligada; advisors só com o esperado (+3 WARN de portas com gate + INFO da fila sem política).

## Diário

- 30/09 manhã: **o conflito do 567** (Tiny: físico 0/2, reservado 23, disponível −21 × plataforma 2). Explicado ao dono: o "disponível multiempresa" é saldo − reservado, e o reservado do Tiny guarda pedido que já saiu (136 de 234 acabados com reservado > pedidos abertos; o Guilherme já tinha limpado 327 e 174). Pergunta dele: puxar o multiempresa? → não (traria o erro junto); escolha dele: **lista das reservas presas**. Construída numa cópia da main exportada (`git archive` para o scratchpad + junção do `node_modules` + `.env.local`), porque a pasta principal está na branch da sessão "Ajuste Estoque 2" (combinado por mensagem: 46, um componente novo e uma linha no quadro Tiny).
  - Harness no build: **594 ✔** (8 do bloco 46) → aplicada sozinha (`--so`), integração intacta. Conferida no banco real simulando o admin: a 1ª página veio com **8 serviços** (Corte 12.982, Fitamento 6.352, Furo…) e itens sem SKU → filtro `raw->>'tipo' <> 'S'` + SKU obrigatório; harness **595 ✔** (+1: serviço e sem SKU fora); **reaplicada**; banco real: **111 móveis, 814 unidades** (345: 45 · 323: 30 · 419: 28 · 193: 24 · 567: 23). (Na simulação, o `sub` é o `auth_user_id` — com o `id` veio vazio; ↪️ A-39.)
  - `tsc -b` ✔ · `eslint src/logistica` ✔ · `vitest run` 84/84 ✔ · `vite build` ✔.
  - **Teste combinado** com a branch da sessão "Ajuste Estoque 2" (migrations 45 do commit dela + a 46 + o harness dela com o meu bloco antes do Resumo): **619 ✔, TUDO VERDE**. Conflito esperado no merge dela: o bloco 46 e o 45 entram no MESMO ponto do harness (antes do Resumo — manter os dois, 45 antes) e o import novo fica ao lado dos imports que ela mudou no `PainelConfiguracoes`.
  - **Depois da migration 45 da sessão "Ajuste Estoque 2" (aplicada por ela ~03:10):** `fn_estoque_reposicao_coberta` com a mesma assinatura e retorno (`bigint → integer`; a régua interna passou a ser o mínimo efetivo do Top X — produto fora do Top X devolve 0 e não arquiva reposição); situação do sincronismo ok (ligado, fila 0, parados 0); relógios `plt-estoque-reservas` e `plt-tiny-estoque-varredura` intactos. **Ponta a ponta:** o 567 posto na fila só para leitura às 03:12:40 → o relógio chamou o n8n às 03:13:00 → leitura gravada às 03:13:03 (saldo 2, reservado 23) → fila vazia, as 2 peças intactas (Tiny = plataforma, nada a fazer).
  - **O dono não achou o botão da lista** (print dele no computador: o botão "fantasma" parecia uma linha de texto no meio do quadro). Agora a lista tem **título próprio** ("Reservas presas no Tiny") com uma frase do que é, e um **botão de verdade** ("Ver os produtos para ajustar no Tiny"). tsc ✔ · eslint ✔ · vitest 84/84 ✔ · build ✔. No mesmo print: os números do Galpão em "…" — **não é da lista**: a migration 45 da sessão "Ajuste Estoque 2" já está no banco e as telas dela ainda não (o resumo mudou de assinatura; "Usar todas as sugestões" e a capacidade chamam funções que ela removeu) — avisada por mensagem; o conserto é ela publicar as telas.

- 30/09 01:05–01:45: o dono reprovou o relógio de 1 minuto no n8n → **migration 43** (o banco chama o fluxo só com fila e sem lote em andamento; varredura das 04:00 no pg_cron), harness **563 ✔**, aplicada sozinha (integração intacta); fluxo do n8n refeito (19 nós, sem relógio de estoque) — colado no workflow `gJNYde20T921AY6l` (conferido nó a nó pelo store), **publicado**; os dois webhooks respondem "registrado para POST"; "carga do saldo" **arquivada**. 1ª tentativa de publicar: a sessão do n8n caiu ("Unauthorized") depois de um `fetch` na porta interna — E-71; o fluxo antigo seguiu no ar; o dono entrou de novo.
- 30/09 01:30: sincronismo **ligado** pela tela (admin) → 234 acabados na fila; o relógio chamou o n8n às 01:31 e a fila caiu 20 por minuto até **zerar às 01:42**: 234 leituras, **46 peças criadas** ("tiny_copia"), 0 baixas, 0 falhas. Conferido: 174 = 3 · 327 = 2 · 345 = 3 · 193 = 7 · 177 = 3 · 484 = 3 (o saldo somado das duas empresas). Os commits desta etapa foram montados por índice temporário e empurrados direto para a main (a pasta principal estava na branch da sessão "Ajuste Estoque 2").

- 30/09 madrugada: outra sessão ("Imagens de produtos Tiny") passou a trabalhar na MESMA pasta — combinado por mensagem: ela não troca a branch nem commita aqui (commit dela por índice temporário numa branch própria), eu não incluo os arquivos dela (FotoProduto, CartaoProdutoEstoque, a linha do className no ModalProdutoEstoque); numeração: ela ficou com A-38/E-68/D-81, eu com E-69/E-70/A-39/A-40.
- 30/09 madrugada: plataforma e n8n sem login no navegador do app → telas logadas e troca do fluxo ficam para o dono (não se entra com senha).

- 30/09 manhã: vídeo visto quadro a quadro (ffmpeg portátil no scratchpad — sem ffmpeg na máquina); outra sessão consultada; leitura do cofre; worktree criada e **removida a pedido do dono** (trabalho na pasta principal); plano aprovado ("já tá aprovado").
