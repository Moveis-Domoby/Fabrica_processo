---
titulo: Automação — mensagens de recepção e a escada de 7 follow-ups
tipo: nota
criado: 2026-09-03
atualizado: 2026-09-17
tags: [atendimento, comercial]
---

# 🤖 Automação — recepção e follow-up

> [!info] Origem
> Migrada em 17/09/2026 do cofre da loja (`_Docs/memoria/AUTOMACAO - Recepcao e Follow-up.md`, Painel de Recompra). Conteúdo preservado na íntegra; análise original de 03/09/2026.

> [!danger] Veredito curto
> A automação hoje **não sustenta a conversa, ela ocupa o lugar dela**. Em boa parte dos atendimentos lidos, a automação é a *única* coisa que fala com o cliente do começo ao fim — e ainda dispara **por cima** do vendedor quando ele está atendendo ao vivo. Foi o defeito mais frequente da amostra.

---

## PARTE 1 · As mensagens de recepção

### R1 — Apresentação do consultor (WhatsApp / Instagram DM)

> "Olá, Tudo bem?! Eu me chamo **Gabriel Morais**, sou consultor de vendas móveis Domoby e irei te atender. 😀"
> "Olá, Tudo bem?! Eu me chamo **Gessica Silva**, sou consultora de vendas da móveis Domoby e irei te atender. 😀"

**Nota: 4/10.**

- ❌ **O nome está errado.** A automação se apresenta como *Gabriel Morais*; quem entra na conversa e assina as mensagens é *Gabriel Ferreira*. O cliente é apresentado a uma pessoa que não existe. Isso corrói confiança logo no primeiro segundo e ainda mistura o nome do atendente com o nome de outros leads chamados Gabriel.
- ❌ **Promete atendimento que muitas vezes não vem.** "irei te atender" e depois ninguém atende — foi o caso repetido na amostra (ex.: *Pedro Cavalcanti M* perguntou "Vocês possuem alguma armário estante com largura de 45 cm?" e o atendimento foi **finalizado sem nenhuma resposta humana**).
- ✅ Tom e simpatia estão certos.
- 🔧 **Correção:** usar o nome real do atendente que vai assumir (ou nome neutro da loja), e só prometer atendimento humano quando houver alguém de plantão.

### R2 — Isca de bairro

> "Dependendo do seu bairro, consigo liberar frete grátis, o móvel já montado e você só paga na entrega. Me informa seu bairro para eu verificar se consigo essas condições para você."

**Nota: 8/10 — a melhor mensagem do conjunto.**

- ✅ Qualifica (bairro = frete = viabilidade) e entrega valor real (frete grátis, montado, paga na entrega). O cliente responde o bairro com frequência alta na amostra.
- ⚠️ **O problema é o que vem depois: nada.** O cliente responde "Candelária", "Cidade Verde", "Ponta Negra", "Morro Branco"… e em boa parte dos casos **ninguém usa essa informação**. A condição prometida some da conversa.
- 🔧 **Correção:** o bairro respondido deveria disparar imediatamente a confirmação — *"Cidade Verde eu consigo sim: frete grátis, montado e você paga só na entrega."* É o gancho de valor mais forte que a loja tem e está sendo desperdiçado.

### R3 — Fora do horário

> "Olá! 😊 Que bom receber sua mensagem! ⏰ Este é o nosso horário de atendimento: Segunda a sexta 08h às 18h · Sábado 08h às 16h. Assim que possível, **Gessica** irá entrar em contato com você. 🤝"

**Nota: 6/10.**

- ✅ Expectativa clara de horário.
- ❌ Nomeia uma pessoa específica e **não cria compromisso de retomada**. Na amostra há leads que mandaram mensagem 22:30 e só foram respondidos às 08:24 do dia seguinte — e outros que nunca foram.
- 🔧 **Correção:** trocar "assim que possível" por um compromisso ("amanhã até as 9h você recebe resposta") e **criar uma fila de retomada matinal obrigatória** com essas conversas.

### R4 — Resposta de comentário do Instagram

> "Posso te chamar no WhatsApp para te passar os detalhes? ✅ Sim, pode chamar ❌ Falar por aqui"

**Nota: 2/10 — este é o maior ralo de lead da operação.**

- ❌ Na amostra, **cerca de 1 em cada 4 "atendimentos finalizados" é só isto**: o robô manda essa pergunta e o atendimento é **encerrado entre 15 e 60 minutos depois, sem nenhuma resposta humana e sem nenhuma tentativa de contato**. Leads: `vanessa_silva.353`, `maeldojunior`, `alerocha.imoveis`, `roquelauraci`, `marinete foster`, `kadja_ma`, `goretti.neves.77`, `analorenagadelha`, `sara.guedess`, `sioneidesabino`, `crisdantas_cartonagem`, `m.beatriz22`, `renatamendessabino`, `cleytonvieira93`, `tdaywson`, `thaziaviviane`, `lucia.dantas73`, `kadjanemaria`, `_alanimoura`, `cyntia.maressa` — e a lista continua.
- ❌ Pior: a pergunta **transfere para o cliente o trabalho de pedir para ser atendido**. Quem comentou num post já demonstrou interesse; ele não precisa autorizar contato, precisa de resposta.
- ❌ Quando o cliente *pede* o WhatsApp, também falha: *Thalita Wartuza* escreveu "pode me passar aqui o número do zap? Não tô conseguindo pelo link" — o robô respondeu a pergunta padrão de novo e o atendimento foi encerrado.
- 🔧 **Correção (prioridade 1):** responder o **comentário com a informação** (nome do móvel + preço + condição) e só então oferecer o WhatsApp. E **proibir o encerramento automático** de conversa que nunca teve resposta humana.

### R5 — BYMO (cliente já ativo)

> "Olá! Eu me chamo BYMO, sou assistente virtual da Domoby… Falar sobre entrega · Fazer novo pedido · Encerrar atendimento"

**Nota: 5/10.**

- ✅ Roteamento por setor funciona (Logística recebe corretamente).
- ❌ **Mata venda nova.** O caso *Jairane R Bastos* é o retrato: cliente ativa, entusiasmada, respondendo story atrás de story ("Amei linda 💖", "vou comprar um", "vou comprar mais umas 2", "Quanto??") — e a cada vez o BYMO devolve um menu de três botões e a conversa é encerrada pela automação em ~10 minutos. Em meses de conversa, **as únicas duas respostas humanas de valor foram do Felipe** ("ela está por apenas R$975", "Vamos comprar agora antes que aumente").
- 🔧 **Correção:** cliente ativo que responde story **não** entra no menu — vai direto para o vendedor. Story respondido é intenção de compra, não suporte.

### R6 — Encerramento

> "Estamos finalizando o seu atendimento. Obrigado por falar com a gente aqui na Domoby! 😊 …"

**Nota: 3/10.**

- ❌ **Encerra conversa com pergunta em aberto.** Foi observado disparando 10 minutos depois de o cliente perguntar preço. É o gesto que transforma lead quente em lead perdido — e ainda "limpa" a fila, escondendo o problema de quem olha o painel.
- 🔧 **Correção:** bloquear encerramento automático quando a última mensagem do cliente for uma pergunta ou quando não existir nenhuma mensagem humana no atendimento.

### R7 — Pós-venda

> "Foi um prazer te atender! 😊 Seu pedido foi finalizado com sucesso… Como agora você é um cliente ativo Domoby…"

**Nota: 8/10.** Boa. Só falta o que vem depois: não há mensagem de pós-entrega pedindo foto/avaliação nem oferta de segundo móvel — e móvel é venda que puxa venda (a própria Jairane disse "depois vou comprar mais umas 2").

---

## PARTE 2 · A escada dos 7 follow-ups

Disparam a partir do momento em que o cliente para de responder. Intervalos observados na amostra (Marta Silva, Luciana, Luciana Lima, Cecilia Dias, Najara, Leonam, Thiago):

| # | Quando | Mensagem | Nota |
|---|---|---|---|
| 1 | ~ +30 min | "Oi, {nome}! Ficou com alguma dúvida?" | 5/10 |
| 2 | ~ +30 min | "Estou por aqui pra te ajudar! Posso te orientar melhor ou esclarecer qualquer dúvida. Hoje, o que você gostaria de entender melhor?" | 3/10 |
| 3 | ~ +30 min | "Vi que você demonstrou interesse nesse móvel. Se precisar, posso verificar estoque, prazo de entrega e a melhor condição para você." | 4/10 |
| 4 | ~ +45 min | "Se eu conseguir com meu gerente, entrega grátis para você o produto montado e você só paga na entrega, fechamos agora o seu pedido e garantimos sua entrega, fica bom assim pra você?" | 6/10 |
| 5 | ~ +2 h | "{nome}, esse móvel é para sua casa, loja ou escritório?" | 2/10 |
| 6 | ~ +2 h | "Ainda tenho seu atendimento aberto. Se quiser, posso deixar tudo preparado para você finalizar o pedido quando for mais conveniente." | 7/10 |
| 7 | ~ +2 h | "Olá 👋 só pra eu não te incomodar sem necessidade: Você ainda quer continuar o atendimento sobre o móvel? 1️⃣ Sim / 2️⃣ Ainda estou analisando / 3️⃣ Pode encerrar" | 7/10 |

### O que está errado na escada

**1. Volume e velocidade.** Seis mensagens em ~4h30 e sete em ~6h30. Para um móvel de R$ 300 a R$ 2.400 — compra que envolve medir parede, falar com o marido, comparar — isso é perseguição, não follow-up. O ciclo de decisão do cliente é de **dias**; a escada inteira se esgota **no mesmo dia** e depois a conversa é encerrada. **O lead nunca é retomado no dia 2, 5 ou 15.**

**2. Ela dispara por cima do vendedor.** Este é o defeito mais grave e o mais fácil de corrigir.
- *Gabriel Carneiro*: conversou com o Gabriel de manhã, e à tarde tomou 4 disparos automáticos (13:33, 14:03, 14:48, 16:48) enquanto já estava decidido — e foi **comprar na loja física**, sem que a loja soubesse que a venda era dela.
- *Marta Silva*: às 08:26 perguntou "com os pés em metalon?", ganhou resposta às 08:27 e em seguida **6 disparos automáticos** até as 14:28; às 15:44 ela voltou e explicou "seria mesa de manicure, querendo com pés de metalon" — e o atendimento foi encerrado às 15:56 sem resposta.
- *Luciana*: estava em conversa ativa com a Gessica e recebeu disparo às 11:02 ("Ficou com alguma dúvida?") **quatro minutos antes** de a Gessica responder às 11:06.

**3. As mensagens 1, 2 e 3 são a mesma pergunta três vezes.** "Ficou com alguma dúvida?" / "o que você gostaria de entender melhor?" / "posso verificar estoque, prazo e condição" — três vezes a mesma coisa em 1h30, nenhuma com informação nova. Follow-up sem informação nova só ensina o cliente a ignorar a loja.

**4. A mensagem 5 chega tarde demais e no lugar errado.** "Esse móvel é para sua casa, loja ou escritório?" é **pergunta de qualificação** — pertence ao começo da conversa, não à quinta cobrança. Chegando depois de quatro tentativas de fechamento, soa como robô que não leu nada do que foi dito. *Luciana* respondeu "estou resolvendo… é para casa" e o atendimento foi encerrado 1h depois sem ninguém aproveitar a deixa.

**5. A mensagem 4 é boa mas queima o gerente.** "Se eu conseguir **com meu gerente**" é uma boa alavanca de fechamento — mas usada automaticamente em **todo mundo, várias vezes por dia**, deixa de ser concessão e vira ruído. Alavanca de gerente só funciona se for rara.

**6. As mensagens 6 e 7 são as melhores e chegam quando o lead já esfriou.** São as únicas que respeitam o tempo do cliente e dão saída digna. Deveriam ser o **começo** da régua, não o fim.

### Escada que eu proporia (leitura do vigia)

| # | Quando | Conteúdo |
|---|---|---|
| 1 | +20 min | Responder o que ficou pendente + **foto/vídeo do móvel exato** + preço + condição do bairro dele |
| 2 | +3 h | Uma **informação nova** (prazo real de entrega, "temos pronta entrega", medida) + pergunta fechada |
| 3 | Dia seguinte, manhã | "Ainda tenho seu atendimento aberto…" (a atual nº 6) |
| 4 | Dia +3 | Prova social: foto do móvel na casa de outro cliente do mesmo bairro |
| 5 | Dia +7 | Condição com prazo ("essa condição vale até sexta") |
| 6 | Dia +15 | "Você ainda quer continuar?" 1/2/3 (a atual nº 7) |
| — | **Nunca** | Disparar automação enquanto houver mensagem humana nas últimas 24 h |

---

## Regras técnicas que precisam entrar na automação

1. **Trava de conversa viva:** nenhum disparo automático se houver mensagem de vendedor nas últimas 24 h.
2. **Trava de encerramento:** não encerrar atendimento cuja última mensagem do cliente seja pergunta, nem atendimento sem nenhuma mensagem humana.
3. **Nome real do atendente** nas mensagens de recepção.
4. **Uso do bairro:** resposta de bairro dispara confirmação de frete/montagem imediata.
5. **Story respondido = fila de vendas**, não menu BYMO.
6. **Fila de retomada D+1** para tudo que entrou fora do horário.

> [!info] Análise técnica do fluxo
> Esta nota avalia as mensagens **do ponto de vista do cliente**. A dissecação do fluxo no editor do DataCrazy — os 208 nós, os tempos reais, a volumetria de execuções e os 15 defeitos encontrados — está em [[ATD - Follow-up DataCrazy - Anatomia]] e [[ATD - Follow-up DataCrazy - Defeitos]]. Lá aparecem coisas que só o fluxo revela: a **mensagem 7 nunca foi enviada uma única vez** e **nenhum lead jamais foi marcado como perdido**.

## Ver também

[[000 - ATENDIMENTO (indice)]] · [[ATD - Por que Convertemos Pouco]] · [[ATD - FAQ e Respostas Padrao]] · [[ATD - Follow-up DataCrazy - Defeitos]]
