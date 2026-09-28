---
titulo: Handoff — Ajuste do estoque · a contagem é da logística, Top 20+, fotos, mínimo e capacidade do galpão
tipo: handoff
data: 2026-09-28
atualizado: 2026-09-28
tags: [handoff, ajuste, estoque, logistica, d-70, d-71, d-72, d-73, d-74]
---

# 📋 Handoff — Ajuste do estoque (28/09/2026)

**Branch:** `estoque-ajustes-urgentes` (worktree `Domoby - Fabrica - estoque`) — **mesclada na `main` em 28/09** (D-20: você pediu "não me pergunte mais nada, apenas faça" e acompanhou o teste logado)
**Banco:** migration **40** aplicada em 28/09, **sozinha** (`--so`) — a do frete (39) é de outra frente; integração do Tiny idêntica antes/depois (`e2109f3a…`, 65 colunas, mesmas linhas)
**Memória:** `_docs/Plataforma/Execucao/AJUSTE - Estoque contagem manual e Top 20.md` · **Decisões:** D-70…D-74 · **Requisitos:** RF-100…RF-104

## 1. O que você pediu (28/09)

1. *"Porque nenhum produto está em estoque?"*
2. *"No estoque deve aparecer apenas os itens que realmente estão em estoque; os outros nas próximas páginas ou num botão de 'ver produtos'."*
3. *"Cadastrar e ver a imagem de cada item."*
4. *"Um botão de 'cadastrar produto ao estoque'; a tela inicial pega os 20 mais vendidos dos últimos 90 dias; a logística vai dar baixa manual na quantidade por enquanto."*
5. *"A visualização do produto ficou muito poluída: mais enxuta, valores menores, destaque para a imagem (só logística e admin cadastram imagem)."*
6. *"O texto abaixo do título vira um ícone 'i' com o balãozinho; as abas no canto superior direito, em quadrados que reagem ao passar o mouse."*
7. *"O mínimo editável numa caixinha de configurações, com a quantidade máxima do galpão; a sugestão de mínimo tem que caber no galpão (cuidado aqui)."*
8. *"A aba de sugestão vira Configurações; a lista de prioridade (do mais vendido ao menos vendido) vai para a aba de acabados, que passa a se chamar Top 20+."*

**A resposta à pergunta 1:** o número vinha do Tiny, e no Tiny só 19 dos 168 móveis tinham saldo positivo (57 unidades) — o Tiny não recebe o "pronto" dos móveis e não avisa a saída da venda (9 avisos na vida toda, nenhum de móvel, o último em 25/09). E a lista punha os problemas primeiro ("necessidade extrema" em 99 móveis, 57 deles sem nenhum pedido — era o negativo do Tiny), então os poucos positivos ficavam nas últimas páginas.

## 2. O que foi feito

### Na tela (Fábrica → Logística → Estoque)
- **Cabeçalho:** "Estoque" com o **"i"** (o balão explica como o número funciona); embaixo, só onde você está ("Top 20+ · os mais vendidos primeiro"). No **canto superior direito, três quadrados**: Top 20+ · Matéria-prima e insumos · Configurações — sobem ao passar o mouse e mostram o nome.
- **Top 20+ (a tela inicial):** os **20 mais vendidos dos últimos 90 dias**, na ordem (o 1º, 2º… aparece na foto), depois **tudo o que tem estoque**. O resto do catálogo fica em **"Ver os outros produtos"** (só carrega ao abrir) e na **busca**, que procura no catálogo inteiro.
- **Cartão enxuto com a foto em destaque:** foto em cima (botão de câmera no canto para pôr/trocar), nome, SKU e vendas de 90 dias, **o número do estoque**, o mínimo, o sinal ("Sem estoque" · "Faltam N para o mínimo" · "No mínimo") e os botões **Entrada** e **Baixa**. **Tocar na foto abre o produto:** foto grande, os números, Entrada/Baixa/**Contagem**, peça por peça e, só como referência, o que o Tiny diz.
- **"Cadastrar produto ao estoque":** procura o produto (os mais vendidos primeiro) e pergunta quantas peças entram.
- **Movimentar:** Entrada (peças prontas, em perfeito estado), Baixa (saem as mais antigas primeiro) ou **Contagem** (você diz quantas tem no galpão e o sistema acerta a diferença). Antes de confirmar, a tela mostra o que vai acontecer ("Ficam 5 no estoque", "Saem 3 peças (de 5 para 2)").
- **Configurações:** o cartão **Galpão** (quantas peças cabem + peças no estoque, reservadas, soma dos mínimos — com aviso quando passa da capacidade — e soma das sugestões); a lista por produto, dos mais vendidos para baixo, com o **mínimo editável** (vazio = vale o do Tiny, que aparece no campo como referência), a **sugestão** e "Usar"; **"Usar todas as sugestões"** em dois toques.
- **Fotos:** reduzidas no próprio celular antes de subir (uma foto de 55 KB virou 16 KB); moram na mesma pasta do produto que o tablet já usa.

### No banco (migration 40 — nenhuma tabela nova)
- **O número dos produtos prontos = as peças livres no ESTOQUE** (a contagem da plataforma). Entrada cria as peças, baixa arquiva as mais antigas, contagem acerta a diferença — tudo por evento, com o nome de quem fez e o motivo; a sugestão do PCP na liberação ("há N no estoque — usar?") já enxerga essas peças.
- **O Tiny saiu da conta dos acabados** (fica nos insumos e como referência). Os pedidos da loja não descontam mais o número.
- **Mínimo da plataforma** (coluna nova no catálogo; vazio = o do Tiny), **capacidade do galpão** (coluna nova no setor ESTOQUE), **foto** (coluna nova no catálogo), vendas de 90 dias numa regra só, sugestão que **cabe no galpão** (se a soma passar, todas encolhem na mesma proporção; o mais vendido nunca fica com menos que o de baixo).
- A reposição automática (ainda **desligada**) passou a olhar a contagem e o mínimo da plataforma.

## 3. Decisões tomadas (você pediu para eu não perguntar — ficam registradas para você conferir)

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Cada peça contada vira uma "peça" no ESTOQUE (card sem pedido), não um número solto | Uma tabela só com a quantidade por SKU | Assim a sugestão do PCP já usa a peça, a reserva/cancelamento funcionam e nada novo foi criado no banco |
| Top 20+ = os 20 mais vendidos (mesmo zerados) + o que tem estoque | Mostrar só o que tem estoque | Você pediu os 20 mais vendidos na tela inicial para a logística contar; os zerados do top 20 são justamente os que mais importam |
| Mínimo vazio volta a valer o do Tiny | Copiar os mínimos do Tiny para a plataforma | Nada se perde e fica claro de onde vem cada número |
| Capacidade do galpão em **peças** | Em volume (m³) | Foi o que você pediu ("quantidade máxima"); volume exigiria medidas de todos os produtos |
| "Usar todas as sugestões" zera o mínimo de quem não vendeu em 90 dias | Deixar os mínimos antigos desses produtos | Só assim a soma dos mínimos cabe de verdade no galpão (o "cuidado aqui") |
| Baixa leva as peças mais antigas primeiro | Escolher peça por peça | A equipe conta por SKU; a primeira que entra é a primeira que sai |
| Foto na mesma pasta do produto que o tablet já usa | Pasta separada só do estoque | Uma foto por produto, num lugar só |

## 4. Verificação

| O quê | Resultado |
|---|---|
| Testes do banco (2 rodadas) | ✅ tudo verde — **485 verificações**; 36 novas (entrada/baixa/contagem, quem pode, mínimo, capacidade, sugestão que cabe, Top 20+, foto, reposição) e 6 antigas do estoque ajustadas à regra nova |
| Checagem de tipos · lint · testes de tela · build | ✅ · ✅ · ✅ 82/82 · ✅ |
| Aplicação no banco real | ✅ só a migration 40; integração do Tiny idêntica antes/depois |
| Permissões no banco real | ✅ as portas novas só para quem está logado (nada para anônimo); a maquinaria fora da API; política de foto da logística criada; alertas do Supabase só com o esperado |
| **Telas com você logado** | ✅ Top 20+ com os 20 da ordem real (327, 174, 489…) e as 2 reservadas (174 e 521) · "i" com o balão · quadrados com o nome ao passar o mouse · **entrada de 2 → contagem 1 → baixa 1** no 327 (voltou a 0; o histórico mostra as 4 ações com o seu nome) · **foto de teste** no 327 subiu reduzida, apareceu no cartão e foi **apagada** em seguida · "Cadastrar produto ao estoque" buscando no catálogo · "Ver os outros produtos" · insumos com estoque primeiro · Configurações: capacidade 100 → sugestões somando exatamente 100, aviso de "soma dos mínimos passa da capacidade", mínimo do 327 em 5 e de volta ao do Tiny, "usar todas" até a confirmação (cancelado) — **capacidade e mínimos voltaram como estavam** |
| Celular (375) e tablet (768) | ✅ sem rolagem lateral, todos os botões com o tamanho de toque; acertados na hora: botão "usar todas" esticado, sugestões desalinhadas, zeros enquanto carrega, botão de cadastrar quebrando no tablet |
| Console do navegador | ✅ sem erros |

## 5. Como validar (5 minutos)

1. Abra **Fábrica → Logística → Estoque**. Passe o mouse no "i" e nos quadrados do canto.
2. Em qualquer produto do Top 20+: **Entrada** de 1 → o número vira 1 e o sinal muda. Depois **Baixa** de 1 → volta a 0.
3. Toque na **foto** (ou no ícone) de um produto → abre o detalhe; o botão de câmera põe a foto.
4. **Cadastrar produto ao estoque** → procure um produto que não está na lista → diga quantas peças.
5. **Configurações:** ponha a capacidade do galpão e veja a soma das sugestões caber nela.

## 6. Ficou com você

- 🔶 **Contagem inicial:** hoje o estoque está em **0 em tudo** (ninguém contou ainda). A logística pode usar a **Contagem** em cada produto do Top 20+ (ou "Cadastrar produto ao estoque" para os outros).
- 🔶 **Capacidade do galpão** em Configurações, e conferir os mínimos (um a um ou "usar todas as sugestões").
- 🔶 **Fotos** dos produtos.
- 🔶 **Reposição automática:** continua desligada. **Só ligue depois da contagem inicial** — com tudo em 0, todo produto com mínimo pediria reposição ao PCP.
- ⚪ Hoje só existem admins no banco: a regra "a logística também pode" foi provada nos testes automáticos, não com uma pessoa da logística de verdade.
- ⚪ O teste deixou no histórico (com o seu nome) a entrada de 2 peças no 327 e as duas saídas — o número voltou a 0.

## 7. Arquivos

```
supabase/migrations/20260928180000_plt_estoque_contagem_top20.sql   (nova — migration 40, aplicada)
supabase/migrations/20260926120000_plt_estoque_completo.sql         (36: drop antes do create — E-17)
supabase/testes/testar-migrations.mjs                               (bloco do ajuste + S25 ajustada)
src/paginas/Estoque.tsx                                             (reescrita)
src/logistica/componentes/* (novos: FotoProduto, SeloSinal, CartaoProdutoEstoque, ModalMovimentarEstoque,
                            ModalEscolherProduto, ModalProdutoEstoque, PecasDoEstoque, PainelTop20,
                            PainelInsumos, PainelConfiguracoes)
src/logistica/api.ts · src/logistica/estoque.ts (+ teste) · src/lib/imagem.ts (novo)
src/componentes/ui/Dica.tsx (novo) · src/componentes/ui/Abas.tsx (variante quadrados) · ui/index.ts
src/tablet/api.ts (pastaDoProduto exportada) · src/kanban/componentes/ModalLiberarPedido.tsx (rótulo da peça manual)
_docs: D-70…D-74 (+ ↩️ D-54/D-55/D-57) · RF-100…RF-104 · Esquema do Banco · Modelo de Sistema · nota do n8n ·
       memória (A-25, A-34, E-60, E-61) · execução · mapa · próximos passos · este handoff
```

## Ver também

[[handoff_2026_09_26_sessao25_estoque]] · [[handoff_2026_09_27_sessao24_producao_concluida]] · [[PLT - Decisoes de Produto]] · [[003 - PLANO - Integracao Completa Tiny da Fabrica]]
