# Domoby · Baixa automática de recebimentos — análise de viabilidade

**Data:** 26/08/2026 · **Revisão 2** (mesma data) · Pesquisa e projeto. **Nada implantado.**
**Origem:** print da conversa com a Lis (Olist) sobre "conectar o Claude para fazer baixas automáticas".
**Referências:** `domoby-tiny-integracoes-referencia.md` (endpoints) · `domoby-clickup-tiny-entregue.md` (a automação irmã) · `domoby-supabase-fabrica.md` (banco) · `handoff-domoby-n8n.md` (infra)

> **O que mudou da revisão 1 para a 2** — três informações do dono derrubaram parte do desenho anterior:
> 1. **Os PIX caem em contas variadas**, não numa só → a conciliação bancária nativa do Tiny **não** resolve, e o comprovante deixa de ser opcional: ele é o único registro que existe. Ver §9, reescrita.
> 2. **As maquininhas geram comprovante** → cartão sai da fila de revisão e pode ser automatizado.
> 3. **Dinheiro tem foto das notas + valor digitado** → também entra no fluxo.
>
> Consequência: as três formas passam pelo mesmo caminho, e o campo que amarra tudo é o **`contaDestino`** — ver §6.5, que é a novidade central desta revisão.

---

## 0. Veredito em cinco linhas

**Dá para fazer, e a Domoby já tem 80% das peças no lugar.** O que falta não é
tecnologia — é decidir o que conta como prova de pagamento.

Com o PIX espalhado em várias contas, você está certo: **o comprovante é
necessário**. Mas isso também significa que não existe extrato único para conferir
a foto depois. A proteção tem que estar *dentro* do fluxo, não depois dele — e a
§9 mostra que dá, com três travas que custam quase nada.

---

## 1. A resposta da Lis, conferida linha a linha

| O que ela disse | Situação |
|---|---|
| "O Claude não se conecta nativamente aos módulos internos do ERP" | ✅ **Correto** |
| "Utiliza-se arquitetura de integração via n8n, Make, Zapier ou scripts via API" | ✅ **Correto — e é exatamente o que a Domoby já roda em produção** |
| "O Claude pode analisar comprovantes e o sistema envia a instrução para a API" | ✅ **Correto** |
| "A Olist conta com agentes especialistas em finanças e APIs nativas que processam baixas em lote" | ⚠️ **Meia verdade — ver §2** |
| "Sem necessidade de construir pontes externas complexas" | ❌ **A ponte já está construída.** VPS, n8n, 3 integrações no ar, Supabase |

A frase que interessa é a última. Ela foi escrita para quem não tem n8n. A Domoby
tem. O argumento "é mais simples ficar no nativo" perde o sentido quando a
infraestrutura já está de pé e paga.

---

## 2. O que a Lis faz de verdade

A Lis existe, é séria, e **executa escrita no ERP** — não é só chat. Mas ela
opera sobre um **catálogo fechado de 8 automações**:

1. Monitor de novos pedidos
2. Resumo financeiro diário
3. Relatório diário de vendas
4. Pedidos automáticos no Sheets
5. Gestão de pedidos por regra
6. **Conciliação Mercado Pago** ← a única que dá baixa de fato
7. Alerta diário de estoque baixo
8. Troubleshooting

A **Conciliação Mercado Pago** é a prova de que a Olist domina o mecanismo: ela lê
os pagamentos, casa com as contas a receber em aberto e **dá a baixa sozinha todo
dia**. Só que é amarrada ao Mercado Pago.

### O que a Lis **não** faz

- ❌ Nenhuma automação **recebe imagem**. Não existe "ler foto de comprovante".
- ❌ Não há **API para acionar a Lis** de fora. Ela não é um endpoint que o n8n chame.
- ❌ Não dá para criar automação nova fora do catálogo.
- ⚠️ A autorização da Lis no WhatsApp **vence a cada 30 dias** e exige reautorização
  manual. Isso a desqualifica como peça de caminho crítico — mesma classe de falha
  do refresh token do Google que derrubou a produção em 11/08.

**Conclusão:** a Lis é ótima para *você* consultar o negócio pelo celular. Não é
onde a baixa automática da Domoby vai morar.

---

## 3. As quatro formas de recebimento — o mapa depois da revisão

| Forma | Artefato na entrega | O que a IA extrai | Automatizável? |
|---|---|---|---|
| **PIX** | Print do app do cliente | valor, data/hora, pagador, **recebedor**, **chave**, **E2E** | ✅ Sim — com as travas da §9 |
| **Cartão** | Cupom da maquininha | valor, data/hora, bandeira, **adquirente**, NSU/autorização, parcelas | ✅ Sim — ver §6.6 sobre a taxa |
| **Dinheiro** | Foto das notas + valor digitado | "é dinheiro em espécie?" + estimativa grosseira | ✅ Sim — a declaração governa, ver §6.7 |
| **Já vem pago** | Nada | — | ⛔ A automação **se recusa a agir** |

O trabalho que te consome hoje não é ler o valor no comprovante. É **abrir o Tiny,
achar a conta certa, escolher a conta destino, digitar e salvar** — 10 a 30 vezes
por dia. É isso que a automação mata, e agora ela mata nas três formas.

---

## 4. A arquitetura — o card do ClickUp vira o formulário de fechamento

**O ClickUp é o caminho mais fácil, por margem grande.** Não por estética, por três
razões técnicas:

1. **Zero ferramenta nova.** Os meninos já movem o card para `entregue` na ROTAS, e
   já são eles que anexam.
2. **O gatilho já está projetado e o JSON já existe** — `domoby-clickup-tiny-entregue.json`.
3. **Nada de risco de ban de número, nada de Cloud API paga, nada de Evolution API.**

### ⚠️ A regra operacional que nasce disso

> **Anexo NÃO dispara webhook no ClickUp.** Está na documentação: adicionar anexo
> não aciona nem evento de anexo (não existe) nem `taskUpdated`.

Por isso a ordem importa e vira treinamento de equipe:

**1º anexa a foto → 2º preenche os campos → 3º move o card para `entregue`.**

O `taskStatusUpdated` é o gatilho; o `GET task` logo depois traz o anexo e os campos
já preenchidos. Card movido sem foto cai na fila de revisão em vez de dar erro.

### Campos novos no card da ROTAS

| Campo | Tipo | Valores |
|---|---|---|
| `Forma de recebimento` | dropdown | PIX · Cartão · Dinheiro · Já pago · **Não recebeu** |
| `Valor recebido` | número | — |
| Anexo | arquivo | print do PIX · cupom da maquininha · foto das notas |

O `Valor recebido` digitado não é burocracia: é a **segunda opinião** que a IA vai
conferir. Duas fontes independentes que batem valem muito mais que um OCR sozinho.

**Pagamento dividido** (parte PIX, parte dinheiro) acontece. Duas saídas possíveis:
permitir múltiplos anexos e somar, ou mandar direto para a revisão manual.
**Recomendação: revisão manual no começo.** É raro e não vale a complexidade no dia 1.

---

## 5. O fluxo, node a node

```
ClickUp Trigger · taskStatusUpdated
        ↓
Filtrar "entregue"                    (Code — mesma lógica da automação 5)
        ↓
ClickUp · Obter tarefa                (traz nome, lista, custom_fields E attachments[])
        ↓
Validar ROTAS e extrair pedido        (Code — regex ^\s*(\d+) no nome do card)
        ↓
Tiny · pedidos.pesquisa               (numero → tiny_id)   ── ou lê do Supabase
        ↓
Achar a conta a receber               (§6.1 — o ponto que precisa de teste)
        ↓
Tem conta em aberto?  ──não──→  encerra em silêncio (pedido já pago / sem financeiro)
        ↓ sim
Baixar anexo do ClickUp               (HTTP, binário)
        ↓
Claude · ler comprovante              (visão → JSON estruturado, §5.1)
        ↓
Resolver contaDestino                 (§6.5 — de-para recebedor → conta no Tiny)
        ↓
SEMÁFORO                              (Code — §7)
   ├── 🟢 passou em tudo → Tiny · conta.receber.baixar → comentário no card
   ├── 🟡 divergiu → card em CONFERIR PAGAMENTO + te notifica
   └── 🔴 suspeito ou erro duro → não baixa, te notifica na hora
        ↓
Supabase · gravar recebimento         (auditoria — §8)
```

**Workflow separado do `domoby-clickup-tiny-entregue`, de propósito.** Dois webhooks
do ClickUp, dois fluxos independentes. Se a baixa quebrar, a marcação de "entregue"
continua funcionando. Dinheiro falha sozinho, sem levar a logística junto.

### 5.1 O que a IA devolve

Saída estruturada, sem prosa:

```json
{
  "tipo": "pix | cartao | dinheiro | indefinido",
  "valor": 1234.56,
  "data": "26/08/2026",
  "hora": "14:32",
  "pagador": "nome como aparece",
  "cpf_cnpj_pagador": "só dígitos ou null",
  "recebedor": "nome como aparece no comprovante",
  "chave_ou_conta": "chave PIX, ou banco+agência+final da conta, ou null",
  "instituicao": "banco emissor / adquirente",
  "identificador": "E2E do PIX, ou NSU/autorização do cartão, ou null",
  "bandeira": "só cartão",
  "parcelas": "só cartão, inteiro ou null",
  "legivel": true,
  "observacao": "o que ficou ilegível ou estranho"
}
```

Três regras no prompt:

1. **Campo ilegível vira `null`, nunca chute.** Um `null` cai no amarelo e um humano
   resolve; um chute vira baixa errada.
2. **Não contar dinheiro.** Para foto de notas, a IA responde só "é dinheiro em
   espécie? sim/não" e uma faixa aproximada. Contar cédula sobreposta em foto é
   pouco confiável e não vale fingir precisão — quem governa é o valor digitado.
3. **Transcrever o recebedor exatamente como está**, sem normalizar. A comparação
   com o de-para é feita no código, não pela IA.

**Custo:** ~30 imagens/dia é ordem de centavos por dia na API da Anthropic. Não é
uma variável de decisão.

---

## 6. Os endpoints e as decisões técnicas

### 6.1 Achar a conta a receber do pedido

Este é **o único ponto realmente aberto** do projeto.

**Caminho v3 (documentado, determinístico):**
```
GET https://api.tiny.com.br/public-api/v3/contas-a-receber?idVenda={tiny_id}&situacao=aberto
Authorization: Bearer {access_token}
```
O filtro `idVenda` existe e é oficial. Liga a conta ao pedido sem ambiguidade.

**Caminho v2 (a ser testado):**
```
POST https://api.tiny.com.br/api2/contas.receber.pesquisa.php
token={TOKEN}&id_origem={tiny_id}&situacao=aberto&formato=JSON
```
O parâmetro `id_origem` existe na v2, mas a documentação **não diz** que ele é o id
do pedido. Provavelmente é. Uma chamada de teste resolve (§13, Teste 1).

**Fallback v2:** `nome_cliente` + janela de vencimento + `situacao=aberto`, casando
pelo valor. Funciona, mas é casamento difuso — e casamento difuso mexendo em
dinheiro é exatamente o que não se quer.

### 6.2 Dar a baixa — v2

```
POST https://api.tiny.com.br/api2/conta.receber.baixar.php
token={TOKEN}&formato=JSON&conta={JSON}
```
⚠️ **Pegadinha:** diferente do `pedido.alterar.situacao`, aqui `conta` é um
**objeto**, não campos soltos. Vai como string JSON dentro do form-urlencoded:
```json
{ "id": 123456, "data": "26/08/2026", "valorPago": 1234.56,
  "contaDestino": "Banco Inter - PJ", "categoria": "Vendas",
  "valorTaxas": 0,
  "historico": "Baixa automática — entrega pedido 13046 — E2E E1234... — n8n" }
```
Como sempre na v2: **HTTP 200 mesmo em erro** — o IF `retorno.status == "OK"` é obrigatório.

### 6.3 Dar a baixa — v3

```
POST https://api.tiny.com.br/public-api/v3/contas-a-receber/{id}/baixar
{ "data": "26/08/2026", "valorPago": 1234.56, "contaDestino": { "id": 0 },
  "taxa": "0", "juros": "0", "desconto": "0", "acrescimo": "0", "historico": "..." }
```
`taxa`, `juros`, `desconto`, `acrescimo` e `valorPago` são **obrigatórios** — mandar zeros.
Sucesso: **204 No Content**, sem corpo.

### 6.4 v2 ou v3?

A decisão vigente da casa é **ficar na v2** (`domoby-api-tiny-v2-vs-v3.md`), e ela
continua valendo. Dois argumentos empurram para os lados opostos aqui:

- **A favor da v3:** o `idVenda` transforma um casamento difuso em chave estrangeira.
- **A favor da v2:** `contaDestino` é só o **nome** da conta (string). Na v3 é `{id}`,
  que exige mais um passo para descobrir os ids das contas. Para este fluxo, a v2 é
  mais simples.

**Recomendação:** rodar o Teste 1. Se o `id_origem` funcionar, fica tudo na v2 e nada
muda na casa. Se não funcionar, abrir a exceção para este fluxo — e a peça cara já
está pronta: o cron do Supabase que renova o token v3 de 3 em 3 horas.

🚨 **A regra não muda:** o cron do Supabase é o **único** renovador. O n8n só lê o
access token vigente. Nunca renova. Dois renovadores derrubam as duas aplicações juntas.

### 6.5 ⭐ O `contaDestino` — a novidade desta revisão

Com o PIX caindo em contas variadas, **saber qual conta recebeu deixa de ser
detalhe contábil e vira o eixo do fluxo**. E o Tiny já tem o campo: `contaDestino`
no endpoint de baixa.

A peça nova é uma **tabela de-para**, no Supabase ou como constante no Code node:

| O que a IA lê no comprovante | Conta destino no Tiny |
|---|---|
| `DOMOBY MOVEIS ...` / chave CNPJ | `Conta PJ - Domoby` |
| `WALLACE ... AUGUSTO` / chave CPF | `Banco X - Wallace` |
| `STONE INSTITUICAO DE PAGAMENTO` | `Maquininha Stone` |
| `MERCADO PAGO` | `Maquininha Mercado Pago` |
| *(dinheiro)* | `Caixa entregador` |

Essa tabela faz **três trabalhos ao mesmo tempo**, e é por isso que ela é o centro
do desenho:

1. **Preenche o `contaDestino` da baixa** — o campo que você hoje escolhe na mão.
2. **É a whitelist de recebedores.** Comprovante com recebedor fora da lista → 🔴 na
   hora. Esse é o controle que substitui o extrato único que você não tem.
3. **Se corrige sozinha.** Recebedor novo e legítimo aparece uma vez, cai no
   vermelho, você adiciona à tabela, e nunca mais incomoda.

Comece cadastrando **todas** as contas/chaves que hoje recebem PIX. Se essa lista
for grande demais para caber numa tabela, isso por si só é um achado sobre a
operação — e vale mais que qualquer automação.

### 6.6 Cartão — o que fazer com a taxa

O cupom mostra o **valor bruto**; o que cai na conta é **líquido**, dias depois.

**Recomendação para o dia 1: baixa pelo valor bruto, `valorTaxas: 0`, `contaDestino`
= a conta da adquirente.** A taxa vira uma conta a pagar separada, que é como a
maioria trata e é o caminho mais simples de acertar.

Se um dia quiser precisão, o campo `valorTaxas` existe na v2 (`taxa` na v3) e a IA
já extrai bandeira e parcelas — dá para calcular a taxa por uma tabela de-para. Mas
isso é refinamento, não pré-requisito.

### 6.7 Dinheiro — quem governa é a declaração

A foto das notas não é prova de valor; é prova de que o momento aconteceu e registro
de quem estava lá. **O valor digitado no card governa.**

O que fecha o ciclo não é a IA — é o `contaDestino` = `Caixa entregador`. A conta a
receber do cliente é baixada (ele pagou, de fato), e o dinheiro fica registrado como
estando com o entregador até a transferência para o caixa da empresa. Se você não
tem essa conta cadastrada no Tiny, criar uma por entregador é meia hora de trabalho
e te dá, de graça, o saldo de quanto cada um está devendo em espécie no fim do dia.

Alternativa mais simples, se preferir não criar contas: usar a conta de caixa que
você já usa hoje e tratar o acerto por fora. Funciona, mas você perde o saldo por pessoa.

---

## 7. O semáforo — quando a máquina pode mexer no dinheiro sozinha

Esta é a parte que não é técnica. É política.

### 🟢 Baixa automática

Todas as condições, juntas:

- Existe **exatamente uma** conta a receber em aberto para o pedido
- `valor lido pela IA` == `valor digitado no card` == `saldo da conta` (tolerância zero)
  *(no dinheiro, só as duas últimas)*
- `legivel: true`
- **PIX/cartão:** `identificador` presente e **nunca visto antes** (§9)
- **PIX/cartão:** `recebedor` bate com o de-para da §6.5
- Data/hora do comprovante **dentro da janela da entrega** (hoje ou ontem)
- Valor abaixo do **teto** (sugestão inicial: R$ 3.000 — você calibra)
- Ainda não existe baixa registrada para essa conta no Supabase

### 🟡 Fila de revisão — não baixa, avisa

- Divergência de centavo entre as fontes
- Mais de uma conta em aberto (pedido parcelado)
- Foto ilegível, sem identificador, ou pagamento dividido
- Acima do teto
- Card movido sem anexo

Destino: card numa lista **CONFERIR PAGAMENTO** com a foto, o JSON lido e o motivo
escrito em português. Você decide em 10 segundos em vez de digitar em 2 minutos.
**Isso já é a maior parte do ganho.**

### 🔴 Suspeito ou erro — não baixa, te notifica na hora

- **`identificador` repetido** — o mesmo comprovante usado duas vezes
- **Recebedor fora do de-para** — dinheiro indo para conta desconhecida
- **Comprovante com data velha**
- Pedido não encontrado no Tiny, ou Tiny recusou a baixa

O 🔴 é diferente do 🟡 de propósito: o amarelo é uma fila que você limpa quando dá;
o vermelho te chama.

Conta já `pago`/`cancelada` → **encerra em silêncio**. É o caso "já vem pago", não é erro.

### Duas travas inegociáveis

1. **Idempotência por conta, não por card.** Antes de qualquer chamada, `INSERT`
   claim-first no Supabase com `conta_id` como PK. Inseriu → segue. Voltou vazio →
   já baixado, para. Mesma técnica do `gp_pcp_processados`. Card movido duas vezes,
   dois meninos mexendo juntos, reprocessamento — nada disso vira baixa dupla.
2. **A automação nunca desfaz.** Estorno de baixa errada é manual no Tiny, de
   propósito. Unidirecional, igual à automação 5.

---

## 8. O que o Supabase guarda — a auditoria que o Tiny não tem

Tabela nova `recebimentos` no Supabase da fábrica (padrão da casa: RLS ligado, zero
policies, só `service_role`):

| Coluna | Para quê |
|---|---|
| `conta_id` (bigint **PK**) | id da conta a receber no Tiny — trava de idempotência |
| `pedido_numero` / `pedido_tiny_id` | ligação com `pedidos` |
| `clickup_task_id` | de onde veio |
| `quem` | usuário do ClickUp que moveu o card ← **hoje não existe em lugar nenhum** |
| `forma` | pix / cartao / dinheiro / ja_pago |
| `valor_declarado` / `valor_lido` / `valor_conta` | as três fontes, guardadas separadas |
| `recebedor_lido` / `conta_destino` | quem recebeu, e para qual conta do Tiny foi |
| **`identificador`** (text, **UNIQUE**) | E2E do PIX / NSU do cartão — **a trava anti-reuso da §9** |
| `comprovante_url` | o anexo no ClickUp |
| `ia_json` (jsonb) | a leitura crua, inteira |
| `decisao` / `motivo` | verde / amarelo / vermelho, e por quê, por escrito |
| `baixado_em` | quando o Tiny confirmou |

O índice **UNIQUE** no `identificador` não é enfeite: é ele que faz o banco recusar
o mesmo comprovante duas vezes, sem depender de nenhuma lógica no n8n.
*(Índice parcial, ignorando `null` — dinheiro não tem identificador.)*

O Tiny registra que a conta foi baixada. **Ele não registra quem fotografou o quê,
nem que a foto dizia R$ 1.200 e o menino digitou R$ 1.500.** Essa tabela é o que
permite responder isso três meses depois.

---

## 9. Proteção sem extrato — o que fazer quando não há livro-caixa para conferir

Esta seção foi **reescrita** na revisão 2. A recomendação anterior era conciliar
pelo extrato bancário. Com o PIX espalhado em várias contas, **não existe um extrato
único para conferir**, e a foto passa a ser o único registro que existe.

Isso não é fatal — mas move a proteção para dentro do fluxo. Três travas, todas
baratas, em ordem de eficácia real:

**1. Identificador único (a mais importante).**
Todo PIX tem um E2E; toda transação de cartão tem NSU/autorização. São únicos. Com o
índice `UNIQUE` da §8, **o mesmo comprovante nunca é aceito duas vezes**. Isso mata
o abuso mais provável do mundo real, que não é falsificar um comprovante — é
reaproveitar um verdadeiro em duas entregas. Custo: uma linha de DDL.

**2. Whitelist de recebedores (o de-para da §6.5).**
Se o comprovante diz que o dinheiro foi para uma conta que não é da casa, você fica
sabendo **na entrega**, não no fechamento do mês. Custo: cadastrar as contas uma vez.

**3. Janela de tempo.**
Comprovante com data de três dias atrás numa entrega de hoje é vermelho. Custo: uma
comparação de data.

**O que essas três não pegam:** um comprovante inteiramente falsificado, com E2E
inventado e recebedor certo, na primeira vez que aparece. Para isso existem duas
defesas, e ambas são de gente, não de código:

- **Amostragem.** Uma vez por semana, o fluxo sorteia 3 recebimentos e te manda para
  conferir na conta de verdade. Dez minutos por semana, e a equipe sabe que existe.
- **O teto.** Enquanto o valor máximo automático for baixo, o tamanho do problema
  possível é limitado por construção.

### O caminho que elimina o problema (e o custo dele)

Se um dia a Domoby **consolidar o recebimento numa chave só** — ou melhor, gerar a
cobrança PIX pelo próprio Tiny, com QR Code por pedido — o pagamento nasce
identificado, a conciliação vira nativa e **a fraude fica impossível, não improvável**.
O ERP já faz isso.

O custo é operacional, não técnico: muda o que o entregador fala na porta do cliente.
**Não é recomendação para agora.** Mas é a resposta certa para "e quando a operação
dobrar de tamanho?", e vale deixar registrado que ela existe.

---

## 10. Riscos

| Risco | Gravidade | Mitigação |
|---|---|---|
| **Comprovante reaproveitado** | 🔴 Alta | `UNIQUE` no `identificador` (§9). Resolvido de fato |
| **Comprovante falsificado inédito** | 🟠 Média | Teto de valor + whitelist + amostragem semanal. **Reduzido, não eliminado** — ver §9 |
| **Baixa errada é difícil de desfazer** | 🔴 Alta | Tolerância zero no valor; semáforo conservador; idempotência por `conta_id` |
| **Conta destino errada** | 🟠 Média | De-para da §6.5; recebedor desconhecido é vermelho, não chute |
| **Cartão: bruto ≠ líquido** | 🟢 Baixa | Baixa pelo bruto, taxa como conta a pagar separada (§6.6) |
| **Anexo não dispara webhook** | 🟠 Média | Ordem obrigatória: foto → campos → mover. Card sem foto cai no amarelo |
| **Menino move o card sem entregar** | 🟠 Média | A tabela `recebimentos` registra `quem`. Vira conversa, não mistério |
| **Webhook do ClickUp suspende após 100 falhas, em silêncio** | 🟠 Média | Mesmo risco da automação 5. Desativar/reativar re-registra. **Eventos perdidos não são reenviados** |
| **Token v2 em texto puro no JSON do workflow** | 🔴 Alta | Já vazou uma vez num print. Agora mexe em dinheiro. Ver §11 |
| **Rate limit (60/min)** | 🟢 Baixa | 30 entregas/dia × ~4 chamadas. Inatingível |

---

## 11. Pré-requisitos inegociáveis

Duas pendências antigas deixam de ser "quando der" e viram **bloqueantes**:

**a) Workflow de alerta de erro.**
São 5 integrações no ar sem nenhuma vigia. Esta é a primeira que **mexe em dinheiro**.
Uma baixa recusada pelo Tiny que ninguém vê é um pedido em aberto para sempre — ou
pior, uma que passou e ninguém conferiu. Sem alerta, não sobe.

**b) Token do Tiny fora do JSON.**
No `docker-compose.yml`:
```yaml
      - TINY_TOKEN=o_token_aqui
```
e no node: `{{ $env.TINY_TOKEN }}`.
Um token que dá acesso total à conta, em texto puro, num workflow que agora dá baixa
em contas a receber. Isso já vazou uma vez.

---

## 12. Ordem de implantação e esforço

| # | Passo | Esforço |
|---|---|---|
| 0 | **Os testes da §13** — antes de qualquer código | 30 min |
| 1 | Alerta de erro + token em env (§11) | meio dia |
| 2 | **Levantar todas as contas/chaves que recebem PIX** e montar o de-para (§6.5) | 1 hora |
| 3 | Custom fields na ROTAS + treinar a ordem "foto → campos → mover" | 1 hora |
| 4 | Tabela `recebimentos` no Supabase, com o `UNIQUE` no identificador | 1 hora |
| 5 | Workflow **sem baixa** — lê, decide, comenta no card, grava no Supabase. **Roda 1 semana em modo observação** | 1 a 2 dias |
| 6 | Conferir os 7 dias: em quantos o verde teria acertado? | 30 min |
| 7 | Ligar a baixa, **só PIX, com teto baixo** | 2 horas |
| 8 | Ligar cartão | 1 hora |
| 9 | Ligar dinheiro + contas de caixa por entregador (§6.7) | 2 horas |
| 10 | Amostragem semanal automática (§9) | 1 hora |

**O passo 5 é o mais importante da lista.** Uma semana rodando em seco, sem tocar no
Tiny, te dá a taxa de acerto real antes de qualquer risco. Se o verde acertar 95% dos
PIX, liga com confiança. Se acertar 70%, você descobriu isso de graça.

**O passo 2 pode ser o mais revelador.** Você provavelmente vai descobrir coisas
sobre para onde o dinheiro está indo que valem mais que a automação.

---

## 13. Os testes que precisam vir antes do código

**Teste 1 — o `id_origem` da v2 é o pedido?** *(decide v2 vs v3, §6.1)*
Pegar um pedido com conta a receber conhecida, chamar `contas.receber.pesquisa.php`
com `id_origem={tiny_id do pedido}` e ver se volta a conta certa. Se voltar, fica
tudo na v2.

**Teste 2 — o formato do `conta` no baixar.** *(§6.2)*
Uma baixa de teste, numa conta de teste, para confirmar se o parâmetro vai como JSON
string, e se o `contaDestino` aceita o nome da conta como texto. É o tipo de detalhe
que a documentação da v2 não fecha e só a chamada real responde.

**Teste 3 — a IA lê os comprovantes que vocês realmente recebem.**
Junte ~15 fotos reais do último mês: prints de PIX de bancos diferentes, cupons das
maquininhas que vocês usam, e fotos de notas. Passe pelo prompt da §5.1 e confira
campo a campo. **É meia hora e vale mais que qualquer estimativa minha** — em especial
para descobrir se o E2E aparece legível nos prints que os clientes costumam mandar.
Se o E2E não vier na maioria, a trava principal da §9 enfraquece e o desenho precisa
de outra ideia antes de subir.

---

## 14. Resposta curta, para você repetir para quem perguntar

> Dá, sim. O n8n que já roda aqui lê o card do ClickUp quando o menino marca
> "entregue", manda a foto do comprovante para o Claude ler, confere o valor contra o
> que ele digitou e contra a conta a receber no Tiny, identifica para qual das nossas
> contas o dinheiro foi, e só então dá a baixa. O que não bate vira uma lista de
> conferência de 10 segundos em vez de digitação. E o banco recusa o mesmo comprovante
> duas vezes, sozinho.

---

## 15. Fontes

- [Baixar conta a receber — API v2](https://tiny.com.br/api-docs/api2-contas-receber-baixar)
- [Pesquisar contas a receber — API v2](https://tiny.com.br/api-docs/api2-contas-receber-pesquisar)
- [Obter conta a receber — API v2](https://tiny.com.br/api-docs/api2-contas-receber-obter)
- [Listar contas a receber — API v3 (filtro `idVenda`)](https://api-docs.erp.olist.com/api-reference/contas-a-receber/listar-contas-a-receber.md)
- [Baixar conta a receber — API v3](https://api-docs.erp.olist.com/api-reference/contas-a-receber/baixar-uma-conta-a-receber.md)
- [Automações com IA da Olist — catálogo](https://ajuda.olist.com/automacoes-com-ia)
- [Conciliação Mercado Pago — a IA dá baixa de fato](https://ajuda.olist.com/automacoes-com-ia/conciliacao-mercado-pago)
- [Lis no WhatsApp — autorização vence em 30 dias](https://ajuda.olist.com/primeiros-passos-em-agentes-de-ia/lis-no-whatsapp-seu-assistente-de-bolso)
- [Cobrança PIX e boleto no ERP Olist](https://olist.com/sistema-erp/pix-e-boleto/)
- [Conciliação bancária nativa do ERP Olist](https://olist.com/sistema-erp/conciliacao-bancaria/)
- [Webhooks do ClickUp — lista de eventos](https://developer.clickup.com/docs/webhooks)
- [Get Task do ClickUp — retorna `attachments`](https://developer.clickup.com/reference/gettask)
- [Golpe do comprovante de PIX falso — Serasa](https://www.serasa.com.br/blog/comprovantes-pix/)
