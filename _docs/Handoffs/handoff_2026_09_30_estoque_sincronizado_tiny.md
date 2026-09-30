---
titulo: Handoff — Estoque sincronizado com o Tiny · as duas mostrando o mesmo número, e a venda reservando a peça
tipo: handoff
data: 2026-09-30
atualizado: 2026-09-30
tags: [handoff, ajuste, estoque, tiny, n8n, d-76, d-77, d-78, d-79, d-80]
---

# 📋 Handoff — Estoque sincronizado com o Tiny (30/09/2026)

**Branch:** `estoque-sincronizado-tiny` (na pasta principal — você pediu, 29/09) · **Banco:** migration **42** aplicada em 30/09, sozinha; integração do Tiny idêntica antes/depois (`e2109f3a…`, 65 colunas, mesmas linhas)
**Memória:** `_docs/Plataforma/Execucao/AJUSTE - Estoque sincronizado com o Tiny.md` · **Decisões:** D-76…D-80 · **Requisitos:** RF-105…RF-108

## 1. O que você pediu (29–30/09)

1. *"O funcionário falou que atualizou no Tiny, porém não mudou nada na plataforma"* (vídeo do Guilherme, 29/09 18:34).
2. A plataforma vai ser o centro, mas a equipe usa o Tiny por bastante tempo — **as duas precisam mostrar os mesmos dados**; eles **só olham o saldo multiempresa**.
3. Entrada, baixa e contagem ficam na plataforma e **atualizam o Tiny** (Tiny −2, entrada de 4 → o Tiny fica com 4).
4. O que for cadastrado no Tiny **sobe a plataforma** pelo SKU — e, com o mínimo coberto, os cards de reposição que ainda estão no PCP somem.
5. A **venda** tira a peça da plataforma na hora, **sem mandar nada ao Tiny**; a peça fica reservada, o pedido segue no PCP, e **se o PCP não liberar a peça ela volta e o Tiny soma +1** — o PCP decide.
6. Produção que chega ao estoque: **a plataforma avisa o Tiny sozinha**. Saída feita direto no Tiny: **ignorar**. Ponto de partida: **copiar o Tiny uma vez**.
7. *"Quero 1 único fluxo que faz o trabalho completinho sem erro."*

**Por que a plataforma não mudou (a resposta ao item 1):** o aviso de estoque do Tiny da fábrica só enxerga o depósito **Geral da fábrica** — e o número que a equipe olha é a **soma de quatro depósitos de duas empresas** (Geral da fábrica + "Fábrica", "Loja" e "Desmontado" da empresa da loja). O Guilherme zerou o Geral e contou as peças no depósito "Fábrica" da loja (a estante 4 nichos: 0 no Geral + 3 na loja = os 3 da tela). Além disso, desde 28/09 o número da plataforma era só a contagem feita nela.

## 2. O que foi feito

### Como funciona agora (com o sincronismo LIGADO)
- **O Tiny sobe a plataforma:** a cada lançamento de estoque no Tiny (na conta da fábrica **ou da loja**), a plataforma lê o **saldo somado das duas empresas** daquele produto. Se o Tiny estiver **acima**, a plataforma sobe até ele; se estiver abaixo, nada (a saída se dá pela plataforma). Com o mínimo coberto, a reposição que ainda está no PCP sem nada liberado é **arquivada sozinha**. Toda madrugada (04:00) todos os produtos prontos são relidos.
- **A plataforma manda no Tiny:** entrada, baixa, contagem (até a conferida), peça que chega ao estoque pela produção e peça usada num pedido deixam o Tiny **com o número da plataforma**. O ajuste vai para o depósito **"Fábrica" da empresa da loja** (onde as peças estão e onde a venda baixa); a **soma** das duas empresas fica igual.
- **A venda reserva a peça:** pedido novo da loja com peça pronta → a peça fica **reservada** na hora (o número cai; ela aparece como "Reservada para o pedido N · ainda no estoque"). No PCP, ao liberar, a unidade vem com a peça **já marcada** ("Peça do estoque reservada para este pedido — usar?"). Usar → pronta em Pedidos em aguardo. **Desmarcar e mandar produzir** → a peça volta livre e o Tiny recebe de volta. Cancelado → a peça volta. Faturado/enviado/entregue → a peça saiu com o pedido. Nada da venda vai ao Tiny.
- **Contagem é física:** conta também as peças reservadas que ainda estão no galpão (a tela mostra "+ 1 reservada para pedido no galpão").

### Na tela
- **Estoque → Configurações → quadro "Tiny":** ligado desde, produtos na fila, última leitura do Tiny, **parados com erro** (com o motivo) e os **últimos ajustes gravados no Tiny**. Só o **admin** liga e desliga (com confirmação).
- **Detalhe do produto:** "No Tiny, as duas empresas somadas: X · lido há Y"; reservadas contam como "reservadas para pedidos".
- **PCP (liberar pedido):** a peça reservada vem marcada, com o texto do que acontece se desmarcar.

### No banco (migration 42) e no n8n
- Fila do Tiny (um pedido por produto — vários movimentos viram um só), reserva da peça, leitura que sobe a plataforma, ajuste que iguala o Tiny, chave de liga/desliga, relógio da venda a cada minuto. **Tudo nasce desligado.**
- **Fluxo único do n8n** (`_docs/Fabrica n8n/domoby-tiny-fabrica-produtos.json`): o catálogo continua igual; o aviso de estoque (mesmo endereço) chama a plataforma; a cada minuto a fila lê o Tiny e grava o ajuste; às 04:00 a varredura. A **carga do saldo avulsa saiu**.

### ↪️ 30/09 de manhã — a lista das reservas presas no Tiny (o conflito do 567)

- **Por que o Tiny mostrava −21 e a plataforma 2:** o "disponível multiempresa" é **saldo − reservado**, e o reservado do Tiny guarda reserva de pedido que **já saiu** (567: 23 reservadas, nenhum pedido aberto). A plataforma segue o **saldo** — puxar o disponível traria o erro junto.
- **O que foi feito (a sua escolha):** em **Estoque → Configurações → Tiny**, o botão **"Ver as reservas presas no Tiny"** abre a lista, móvel a móvel: quanto o Tiny reserva, quantas unidades há em pedidos abertos e a sobra ("presas"), do maior para o menor, 20 por página, com o total no topo e o passo a passo de onde limpar. Serviços do Tiny (Corte, Furo, Fitamento) e itens sem código ficam fora.
- **Hoje:** **111 móveis, 814 unidades presas** — Estante Basic 5 nichos 45 · Closet fechado 30 · Estante Basic 15 nichos 28 · Mesa Close 24 · Armário Aéreo 3 portas (567) 23.
- **Quem arruma o quê:** reserva presa → **no Tiny** (abrir o produto, aba de reservas, tirar as de pedidos entregues ou cancelados; ao limpar, o produto sai da lista na próxima leitura). Entrada, baixa e contagem → **na plataforma** (vão sozinhas ao Tiny).

## 3. Decisões que tomei (você pode mudar)

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Vale o **saldo** somado das duas empresas | O "disponível" do Tiny | O "reservado" do Tiny não bate com os pedidos (armário 345: 47 reservados no Tiny × 2 pedidos abertos) |
| A plataforma **sobe até o número do Tiny** | Somar a diferença entre dois avisos | O aviso só traz o número final: a correção do armário 327 (de −7 para 0) viraria 7 peças que não existem |
| O ajuste vai para o depósito **"Fábrica" da loja** | O Geral da fábrica | É onde o Guilherme guardou as peças e onde a venda baixa; o Geral fica só se o produto não existe na loja |
| Ajuste por **balanço** (o depósito passa a ter X) | Entrada/saída da diferença | Se o n8n repetir o envio, o balanço não dobra |
| Só a venda que chega **depois de ligar** reserva peça | Reservar também os pedidos abertos de hoje | Esses já estão descontados no saldo do Tiny que vai ser copiado |
| Peça de **pedido** que termina a produção **não** vai ao Tiny | Mandar +1 também | O negativo do Tiny continua sendo o "produzir" da equipe; revejo quando a produção do galpão passar para a plataforma |
| O n8n guarda só as execuções **com erro** | Guardar todas | A fila roda a cada minuto (1.440 execuções vazias por dia); o que foi feito fica na plataforma |

## 4. Verificação

| O quê | Resultado |
|---|---|
| Testes do banco (2 rodadas) | ✅ **554 verificações**, tudo verde — **37 novas** (desligado não faz nada; ligar é do admin e copia nos dois sentidos; entrada vai ao Tiny com o depósito e o id certos; produto só da fábrica vai ao Geral; balanço negativo vira saída; já igual não grava; Tiny acima sobe e não volta; abaixo nada; aviso da loja pelo SKU; a reposição some com o mínimo coberto; 5 falhas param e aparecem; venda reserva, não reserva duas vezes nem pedido de antes de ligar; a peça reservada não serve para outro pedido; PCP usar × produzir; cancelado; faturado; contagem física; ninguém reserva por fora; permissões; desligar) |
| Checagem de tipos · lint · testes de tela · build | ✅ · ✅ · ✅ 84/84 · ✅ |
| Aplicação no banco real | ✅ só a migration 42; integração do Tiny idêntica |
| Permissões no banco real | ✅ as portas do n8n só com a chave de serviço; a situação e o ligar só para quem está logado (o ligar confere admin por dentro); nada para anônimo; alertas do Supabase só com o esperado |
| Relógio da venda | ✅ agendado a cada minuto (sem efeito enquanto desligado) |
| **Telas com você logado** | ✅ Estoque → Configurações → quadro "Tiny" (desligado → **ligado 30/09 01:30**, 234 na fila, zerou às 01:42) · detalhe e PCP conferidos na versão publicada |
| **Fluxo no n8n** | ✅ fluxo único **publicado** (19 passos conferidos um a um; **sem relógio de estoque** — o banco chama só quando há fila, a seu pedido); os dois endereços respondem; "carga do saldo" arquivada |
| **Cópia inicial (ponto de partida)** | ✅ 234 produtos lidos em 11 minutos (20 por minuto), **46 peças** criadas, nenhuma falha: estante 4 nichos 3 · armário 327 2 · estante 5 nichos 3 · mesa Close 7 · armário Close 1 porta 3 · sapateira 3 — o saldo somado das duas empresas |
| **Lista das reservas presas (30/09 manhã)** | ✅ testes do banco 595 (9 novos: presa aparece com o número certo; reserva de pedido aberto não; produto já limpo sai; insumo, serviço e sem código fora; do maior para o menor; uma página por vez; só a logística vê; anônimo não) · ✅ teste combinado com a outra sessão do estoque: 619 · ✅ aplicada sozinha, integração idêntica · ✅ no banco real: 111 móveis, 814 unidades · ✅ tipos, lint, 84 testes de tela, build |

## 5. Como validar (10 minutos, depois do n8n trocado)

1. **Estoque → Configurações:** o quadro "Tiny" mostra "Desligado". Clique **Ligar o sincronismo com o Tiny** → confirme. Em uns 15 minutos a fila zera e cada produto fica com o saldo do Tiny (a estante 4 nichos com 3, o armário 327 com 2).
2. **Entrada de 1** num produto → em até 1 minuto, "Últimos ajustes gravados no Tiny" mostra o produto — e no Tiny o multiempresa sobe 1.
3. **No Tiny**, lance +2 num produto → em até 1 minuto a plataforma sobe 2.
4. **Pedido novo** de um produto com estoque → a peça aparece "Reservada para o pedido N"; no PCP, ao liberar, ela vem marcada.
5. **Configurações → Tiny → "Ver as reservas presas no Tiny"** → o 567 aparece com 23 presas (0 pedidos abertos). Limpe as reservas dele no Tiny → depois da próxima leitura do produto (um movimento dele ou a varredura da madrugada), ele sai da lista.

## 6. Ficou com você

> ↪️ **Atualizado em 30/09, 01:45:** os três primeiros itens abaixo **estão feitos** (fluxo publicado, aviso da loja ligado por você, sincronismo ligado e cópia conferida). A pedido seu, **o n8n não tem mais relógio de 1 minuto**: o banco só chama o fluxo quando há produto esperando (migration 43).


- 🔶 **Trocar o fluxo no n8n** (ou entrar no n8n pelo navegador do app para eu fazer): abrir o workflow "Tiny FÁBRICA → produtos no Supabase", apagar tudo, colar o arquivo novo, salvar; **excluir** o "carga do saldo (rodar 1×)". Passo a passo em [[N8N - Tiny Fabrica Produtos para Banco]].
- 🔶 **No Tiny da LOJA:** Configurações → Webhooks → ligar **"lançamentos de estoque"** com o **mesmo endereço** do da fábrica (sem isso, o que a equipe lança na empresa da loja só sobe na varredura da madrugada).
- 🔶 **Ligar o sincronismo** (Configurações → Tiny) — só depois dos dois itens acima.
- ⚪ Nos primeiros dias, conferir que **a venda baixa o Tiny na hora** (você disse que sim; a plataforma lê o Tiny depois de cada venda para confirmar). Se não baixar, o ajuste é num lugar só.
- ⚪ A reposição automática continua **desligada** (a regra de arquivar a reposição coberta já funciona quando ela for ligada).
- 🔶 **Pedir à equipe:** limpar no Tiny as reservas da lista (começando pelo topo). A plataforma não mexe em reserva do Tiny.
- ⚪ **Observação (sem ação):** o sincronismo também lê os 11 serviços do Tiny (Corte, Furo…), porque a regra de "produto pronto" é a classe do catálogo — inofensivo (saldo 0, nenhuma peça criada). Se um dia incomodar, o ajuste é num lugar só.

## 7. Arquivos

```
supabase/migrations/20260930120000_plt_estoque_sincronizado_tiny.sql   (nova — migration 42, aplicada)
supabase/migrations/20260927120000_plt_producao_concluida_cancelamentos.sql  (37: validate saiu — E-19; drop antes da sugestão — E-17)
supabase/migrations/20260928120000_plt_itens_fora_da_producao.sql      (39: drop antes da sugestão — E-17)
supabase/testes/testar-migrations.mjs                                   (bloco "Estoque × Tiny", 37 verificações)
src/logistica/api.ts · src/logistica/estoque.ts (+ teste)
src/logistica/componentes/{PainelConfiguracoes, ModalMovimentarEstoque, ModalProdutoEstoque, PecasDoEstoque}.tsx
src/kanban/api.ts · src/kanban/componentes/ModalLiberarPedido.tsx
_docs/Fabrica n8n/domoby-tiny-fabrica-produtos.json   (o fluxo único) · domoby-tiny-fabrica-carga-saldo.json (saiu)
supabase/migrations/20260930200000_plt_tiny_reservas_presas.sql        (30/09 manhã — migration 46, aplicada: a lista das reservas presas)
src/logistica/componentes/ReservasPresasTiny.tsx                        (30/09 manhã — a lista; + 1 linha no quadro Tiny)
_docs: D-76…D-80 (+ ↪️ D-62/D-70) · RF-105…RF-108 · Esquema do Banco · nota do n8n · memória (E-69, E-70, A-39, A-40) ·
       execução · mapa · próximos passos · este handoff
```

## Ver também

[[handoff_2026_09_28_ajuste_estoque_contagem_top20]] · [[PLT - Decisoes de Produto]] · [[N8N - Tiny Fabrica Produtos para Banco]] · [[003 - PLANO - Integracao Completa Tiny da Fabrica]]
