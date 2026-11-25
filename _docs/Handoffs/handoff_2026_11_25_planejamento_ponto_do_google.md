---
titulo: Handoff de planejamento — o ponto do Google na busca de endereços
tipo: handoff
data: 2026-11-25
tags: [handoff, planejamento, rotas, mapa, geocodificacao, google]
---

# 📋 Handoff de planejamento — o ponto do Google na busca de endereços (25/11/2026)

Origem: validação dos endereços de 24–25/11 (diário [[SESSAO-57]], seções "O CEP pelo navegador" e "Google como buscador — preço e regras").
Pedido do dono (25/11): *"Escreva um handoff do planejamento para aplicar o ponto do google, irei ver de trocar o mapa depois mesmo"*.

> 🟡 **SÓ PLANEJAMENTO.** Nada foi codado, nada está no ar. Esta nota é o ponto de partida da demanda que vai executar o Google como buscador. Quando virar demanda, ela ganha número próprio (o índice de sessões não foi mexido aqui — está com alterações de outra frente).
> 🔴 **A trava que manda em tudo:** pelas regras do Google, o ponto que a busca dele devolve **só pode aparecer num mapa do Google**. O mapa das Rotas hoje é o mapa aberto. Portanto o ponto do Google **só pode ser LIGADO junto com a troca do mapa** — o dono vai cuidar da troca do mapa depois. Até lá, tudo desta nota pode ser construído, testado e publicado **desligado**.

---

## 1. Por que

- O mapa aberto tem pouca numeração de casa em Natal e região; a numeração das ruas daqui não é métrica (rua de 300–600 m com casas 1035 e 1570). Resultado: rua achada, casa não; e rua que o mapa não conhece cai no centro da cidade.
- O CEP ajuda como âncora (desde 24/11 consultado pelo navegador), mas um CEP cobre um trecho de rua — não diz a casa.
- O Google tem a base de endereços do Brasil mais completa e diz **o quanto confia** em cada ponto (casa, trecho de rua, meio da rua, aproximado). É o salto de exatidão que falta.

## 2. O que o Google cobra (tabela oficial conferida em 25/11)

| Serviço | Grátis por mês | Depois |
|---|---|---|
| Busca de endereço (Geocoding) | 10.000 | US$ 5 por mil (até 100 mil) |
| Mapa na tela (Dynamic Maps — quando o mapa for trocado) | 10.000 aberturas | US$ 7 por mil (até 100 mil) |
| Cálculo de rota (Compute Routes Essentials — se for preciso, ver §3.3) | 10.000 | US$ 5 por mil |
| Validação de endereço (Address Validation — opcional, §5 etapa 5) | 5.000 | US$ 17 por mil |

- A conta é por conta de cobrança, por mês, por serviço.
- **Nosso volume estimado de busca:** 1–3 mil endereços novos por mês + a renovação de 30 dias dos pedidos vivos (algumas centenas) → bem abaixo de 10 mil. **Sai de graça.**
- **Mapa:** cada abertura de tela com mapa conta 1. Hoje há mapa em Programar, Já programadas, o mini-mapa das entregas e a janela do pino. Precisa medir quantas aberturas por mês a logística faz antes de trocar (está na conta do dono, na troca do mapa).
- Proteção de custo obrigatória: **alerta de orçamento** na conta do Google e **teto diário** de consultas na chave (ex.: 500/dia) — um defeito em laço não vira conta.

## 3. As regras do Google que moldam o desenho

Lidas no navegador em 25/11 (Termos Específicos dos Serviços do Google Maps Platform):

### 3.1 Só com mapa do Google
*"Customer must not use Google Maps Content from the Geocoding API in conjunction with a non-Google map."* → o ponto do Google não pode ser desenhado no mapa aberto. **Liga junto com a troca do mapa** (trava do topo).

### 3.2 Guardar por no máximo 30 dias — e o place_id sem prazo
- Latitude/longitude do Google: guardadas **por até 30 dias corridos**.
- Guardar para sempre só "por usuário" (isolado por pessoa, sem reaproveitar entre pessoas) — o nosso cache é compartilhado, então **não serve para nós**: ficamos na regra dos 30 dias.
- O **place_id** (o código do lugar no Google) pode ser guardado **sem prazo** → depois dos 30 dias, a renovação pergunta pelo place_id (mesma cobrança, resposta certeira, sem reinterpretar o texto).
- O que é **nosso** fica para sempre: o pino marcado/arrastado à mão pela logística e (se vier um dia) o ponto real gravado na entrega.

### 3.3 ⚠️ A conferir antes de codar: a rota calculada pelo serviço aberto
Hoje a ordem das paradas e o desenho da rota pelas ruas usam os pontos do mapa com um serviço de rota aberto. A regra "não usar conteúdo do Google com produto que não é do Google" provavelmente alcança também **calcular rota no serviço aberto com o ponto do Google**. **Não foi confirmado** (a página dos termos gerais não abriu pela leitura automática em 25/11). Ler a seção de restrições dos Termos gerais no navegador antes de começar. Se proibir: a troca do mapa leva junto a troca do cálculo de rota para o do Google (10 mil grátis/mês) — entra na conta da troca do mapa, não nesta demanda.

### 3.4 Atribuição
No mapa do Google a marca já aparece sozinha. Enquanto houver ponto de outra fonte (Geoapify, CEP) no mapa do Google, manter a atribuição dessas fontes como hoje.

## 4. O desenho proposto

### 4.1 Onde o Google entra na busca
A função de busca de endereços (a que roda no servidor) ganha **um primeiro degrau: o Google**. Os degraus de hoje (Geoapify → reserva → CEP → bairro → cidade) continuam **atrás**, como reserva para quando o Google recusar, estourar o teto ou não achar.

Consulta ao Google:
- o texto do endereço + **país Brasil** (filtro que restringe) + **CEP da rua** quando houver (filtro que restringe — CEP geral …000 não entra) + preferência de região Brasil + idioma português;
- a chave fica **só no servidor** (segredo da função), nunca no navegador, nunca em nota/print/conversa (regra de credencial da casa);
- tempo limite curto, nova tentativa com espera crescente e o "disjuntor" que a busca já tem para a Geoapify (lei de desempenho).

### 4.2 Quando o ponto do Google vale
O Google diz o tipo de cada ponto. A regra proposta (provisória, para o dono confirmar):

| O Google diz | O que é | Vira |
|---|---|---|
| Casa exata (ROOFTOP) | a casa | ponto da casa ✅ |
| Entre dois pontos conhecidos (RANGE_INTERPOLATED) | estimado ao longo da rua pelo número | ponto da casa ✅ (é o caso comum no Brasil) |
| Meio da rua (GEOMETRIC_CENTER de uma rua) | a rua, sem a casa | ponto de rua — vale, mas **conferido contra o CEP** (mais de 1,5 km do ponto do CEP → não vale, desce aos degraus) |
| Aproximado (APPROXIMATE) / bairro / cidade | não é a casa | **não vale** — desce aos degraus de hoje |
| "Achou só parte" (partial_match) | o Google mudou algo do endereço | só vale se o nome da rua devolvido bater com o do pedido (a mesma comparação de nomes que a busca já usa) **e** o CEP devolvido for o do pedido |

- O endereço **digitado** (parada avulsa, "Achar no mapa", "Editar endereço") segue a regra da 57: só rua ou casa vira o ponto; bairro/cidade abre o mapa ali com o aviso.
- A conferência "o pino está longe do CEP" continua igual (o ponto do CEP é de outra fonte).

### 4.3 Guardar respeitando os 30 dias (banco — precisa de OK)
No cache de endereços do mapa:
- duas fontes novas: **google** (casa) e **google_rua** (meio da rua) — a coluna de fonte não tem trava, só a leitura precisa conhecê-las;
- coluna nova **place_id** (sem prazo);
- **regra de validade:** ponto do Google com mais de 30 dias **não vale** — a função refaz pelo place_id quando a tela pedir (o mesmo caminho de "pedido sem ponto" que já existe: a tela pede só o que mostra);
- **as leituras das telas** (Programar, Já programadas, entregas do dia, mini-mapa) passam a devolver **sem ponto** o que for do Google e tiver mais de 30 dias — assim a tela nunca desenha ponto vencido, mesmo antes de apagar;
- **apagar de fato** a latitude/longitude do Google vencida (fica o place_id). Duas formas — **decisão do dono** (§7):
  - (a) pegar carona numa rotina de madrugada que já existe (sem relógio novo), apagando os pontos do Google com mais de 30 dias; ou
  - (b) apagar pelo fato: entrega registrada / pedido cancelado / pedido arquivado apaga o ponto do Google daquele endereço — e (a) só como rede para o que sobrar.
- O pino manual (fonte manual) **nunca** é apagado nem renovado.

### 4.4 A chave ligada e desligada
- Um **interruptor** no servidor (segredo da função): sem a chave do Google, ou com o interruptor desligado, a busca funciona exatamente como hoje.
- Assim dá para publicar a função e o banco **antes** da troca do mapa, e ligar no mesmo dia em que o mapa do Google entrar.
- No dia de ligar: os pontos que já estão no cache (do mapa aberto) **continuam valendo** — o Google entra para os endereços novos e para os aproximados (centro da cidade/bairro), que são refeitos uma vez. Opcional: refazer de uma vez os pedidos vivos (algumas centenas, dentro do grátis).

## 5. Etapas (na ordem)

| # | Etapa | Quem | Precisa de OK? |
|---|---|---|---|
| 0 | Ler a regra da rota (§3.3) e confirmar as decisões da §7 | dono + Claude | — |
| 1 | **Conta do Google:** criar o projeto no Google Cloud, ligar a cobrança, ativar só a busca de endereço (Geocoding), criar a chave **restrita** a esse serviço, alerta de orçamento e teto diário. Guardar a chave **direto** como segredo da função no painel da Supabase — sem colar na conversa | **dono** (criar conta e cobrança é dele) | — |
| 2 | Função de busca: degrau do Google (§4.1–4.2), interruptor (§4.4), testes automáticos com respostas de exemplo dos quatro tipos + "achou só parte" + recusa/teto/tempo limite | Claude | publicar a função = OK do dono |
| 3 | Banco: place_id, as fontes novas nas leituras, a validade de 30 dias nas leituras das telas, a limpeza (forma escolhida na §7). Bateria de testes do banco + medição com volume ×100 | Claude | aplicar = OK do dono |
| 4 | Ligar — **no mesmo dia da troca do mapa**: interruptor ligado, conferir 10 endereços reais da rota (os 8 acertados à mão em 24/11 são a prova: o Google tem de cair perto do pino manual) | dono + Claude | ligar = OK do dono |
| 5 | (Opcional, depois) Validação de endereço na entrada do pedido: o Google diz "este endereço não existe / falta número" e o PCP/logística corrige com o cliente antes da rota | a decidir | — |

## 6. Como saber que deu certo (critérios de aceite)

1. Com o interruptor **desligado**, a busca responde igual a hoje (os testes atuais passam sem mudança).
2. Com o interruptor ligado e a resposta de exemplo do Google "casa exata", o endereço vira ponto da casa com fonte google; "meio da rua" longe do CEP desce aos degraus; "aproximado" desce aos degraus.
3. Ponto do Google com mais de 30 dias: as leituras das telas o devolvem sem ponto; a função refaz pelo place_id; a limpeza apaga latitude/longitude e mantém o place_id.
4. Pino manual nunca muda.
5. Google fora do ar, recusando ou no teto: a busca cai nos degraus de hoje sem travar a tela (dentro do tempo limite).
6. A chave não aparece em nada que o navegador recebe (conferir a resposta da função e o pacote do site).
7. Os 8 endereços acertados à mão em 24/11: o ponto do Google fica a menos de 150 m do pino manual (medida de exatidão para o dono decidir se vale manter o Google).
8. Celular e tablet: nada muda na tela (o Google é invisível para quem usa, até a troca do mapa).
9. Lei de desempenho: a porta das telas não fica mais lenta (a validade é um filtro na leitura que já existe).

## 7. Decisões para o dono

1. **A ordem de ligar:** confirmar que o Google só liga junto com o mapa do Google (é o que as regras mandam) — ou não fazer nada disto até a troca do mapa estar marcada.
2. **Apagar o ponto vencido:** carona na rotina de madrugada que já existe (a) ou pelo fato da entrega/cancelamento + madrugada como rede (b).
3. **Meio da rua conta como ponto?** (o tipo GEOMETRIC_CENTER): proposta = vale se perto do CEP.
4. **Refazer de uma vez os pedidos vivos** no dia de ligar, ou só os novos e os aproximados.
5. **Teto diário** da chave (proposta: 500 consultas/dia).
6. **Validação de endereço na entrada do pedido** (etapa 5): entra no plano ou fica para depois.
7. **O ponto real na entrega** (o celular do entregador grava onde a entrega foi feita): continua sendo complementar — é dado nosso, para sempre, e não depende do Google. Fazer junto, depois ou não fazer.

## 8. Riscos e cuidados

- **Ligar antes de trocar o mapa = quebra das regras do Google** (risco de a conta ser suspensa). O interruptor existe para isso.
- **Regra da rota (§3.3)** ainda não confirmada — pode aumentar o tamanho da troca do mapa.
- **Custo** só vira problema com defeito em laço → teto diário e alerta de orçamento antes de ligar.
- **Frente da sessão 53 parada** (entregue em parte nas telas): recria a porta de candidatos da aba Programar a partir da versão antiga — além das três informações novas de 24/11, vai ter de levar a validade dos 30 dias. Conferir antes de aplicar qualquer uma das duas.
- **Privacidade:** o endereço do cliente vai ao Google (como já vai à Geoapify hoje). Só o endereço — nunca nome, telefone ou número do pedido.

## 9. O que já existe e é reaproveitado

- A busca em degraus com recusa/tempo limite/aviso "busca fora" (sessões 56 e 57).
- O CEP pelo navegador (24/11) — continua como âncora e conferência.
- A comparação do nome da rua e a regra "endereço digitado só aceita rua ou casa" (57).
- O caminho "a tela pede só o ponto que falta, 5 por vez" — é por ele que a renovação dos 30 dias acontece, sem relógio.
- A marcação manual do pino com registro da atividade (o ponto anterior fica guardado).

Partes do código e do banco que a demanda vai tocar (referência para a máquina): a função `geocodificar` (`fluxo.ts`, `busca.ts`, `index.ts` — degrau novo e `cacheVale`), `src/rotas/api.ts` (nada muda no envio; só a leitura das fontes novas), `plt_geocache` (+ `place_id`), as portas `plt_fn_programacao_candidatos`, `plt_fn_programadas`, `plt_fn_entregas_do_dia`, `plt_fn_programacao` (validade de 30 dias na leitura), e uma rotina de madrugada já existente (se a decisão 2 for a).
