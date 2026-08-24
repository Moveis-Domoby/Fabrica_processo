---
titulo: Fábrica — A linha de produção real (mapeada dos quadros do Trello)
tipo: modelo-mental
atualizado: 2026-08-13
tags: [fabrica, producao, trello, clickup, processo, setores]
---

# 🏭 Fábrica — A linha de produção real

> [!abstract] O que esta nota é
> O mapeamento da linha de produção da Móveis Domoby, feito em 13/08/2026 a partir dos **quadros reais do Trello** (prints de todos os 10 quadros numerados + ROTA), cruzado com o que os vídeos públicos da fábrica mostram (galpão com porta-pallets verticais de produto acabado embalado). Esta é a nota-mãe do mapeamento de processos; notas `FAB -` por setor podem detalhá-la no futuro.

> [!danger] AVISO DO DONO (13/08/2026) — os dados dos quadros NÃO são confiáveis
> **A maioria dos dados nos quadros não é real.** As movimentações são manuais e a disciplina varia; os contadores das listas são acúmulo histórico, não retrato da operação. As únicas automações reais são as migradas para o n8n; no Trello existem apenas regras internas triviais (Butler), do tipo *"moveu para a coluna X → arquiva e recria no quadro Y com tais dados"* — são elas que fazem o handoff entre quadros.
> **Use os quadros para entender a ESTRUTURA do processo (setores, sequência, conceitos), nunca como fonte de números.** A visão do que isso deve virar está em [[FAB - Processo Alvo - Um Clique Um Evento]].

## A linha, de ponta a ponta

Os quadros do Trello são numerados na ordem física do fluxo — a numeração É o mapa:

```
1-PCP → { 3-SECC (corte reto)  e/ou  2-CNC (corte CNC/canaletado) }
      → 5-FITAMENTO (bordas) → 4-CENTRO FURAÇÃO (furos p/ ferragens)
      → 7-MONTAGEM → 8-EMBALAGEM (limpeza → encaixotando)
      → 9-LOGISTICA (expedição) → ROTA (caminhão) → entregue

6-METALURGICA corre em paralelo (bases de metalon: produção → pintura)
      e encontra o móvel na MONTAGEM.
0-ESTOQUE e CHAPAS MDF são quadros de material/insumo.
```

**Padrão de handoff observado:** cada quadro tem listas com o nome dos setores vizinhos (ex.: SECC tem listas "FITAMENTO" e "CENTRO FURAÇÃO"; FITAMENTO tem "MONTAGEM", "CENTRO FURAÇÃO", "ESTOQUE"). O card vai para a lista com o nome do próximo setor e depois é movido/recriado no quadro daquele setor. ⚠️ Como isso é feito na prática (mover vs duplicar, quem faz, quando) **não foi confirmado** — é a primeira pergunta do mapeamento com a equipe.

## Quadro a quadro (o que os prints mostram)

### 1 - PCP — o pulmão
Listas: **PEDIDO** (entrada; onde o n8n cria os cards `(k/n)`) · **STAND BY** (20 cards — pedidos aguardando; muitos `PERSONALIZADO`, ex.: 13060 Boss Plus 2/4, 3/4, 4/4) · **GREENPALLETS** (5) · **ESTOQUE** (4 — produtos **sem número de pedido**: produção para estoque) · e listas de despacho **CNC** / **SECC** (vazias no momento do print).

### 2 - CNC — corte CNC e canaletado (COM SERVIÇO PARA TERCEIROS)
Listas: A FAZER · CORTANDO · FITAMENTO · CENTRO FURAÇÃO · **SEPARADO/IDENTIFICADO (84 cards!)** · **CANALETADO**.
🔎 **Achado importante:** o quadro é dominado por cards `Terceirizado - {cliente}` — **a Domoby presta serviço de corte/canaletagem para outras empresas**: SF Madeiras, Acrivan, Italínea, Requinte Ambientes, Ecorematte, Hellu, Euclydes (mobcloud), Alex… Ex.: "Terceirizado - SF Madeiras - Canaletado 10 chapas", "Canaletar 3 chapas de 15mm". A lista SEPARADO/IDENTIFICADO parece ser trabalho pronto aguardando retirada do cliente.

### 3 - SECC — seccionadora (corte reto)
Listas: A FAZER (13) · CORTANDO (3) · FITAMENTO · CENTRO FURAÇÃO · FINALIZADO · **❌ Danificado**.
Cards internos de gestão convivem com produção: "Organização de sobras" (sobras de chapa!) e "13026 PERSONALIZADO … **(CHAMAR GUILHERME PARA ORIENTAÇÃO)**" — dependência de pessoa específica registrada no título do card.

### 4 - CENTRO FURAÇÃO
Listas: A FAZER · **USINANDO** · FITAMENTO · MONTAGEM · ❌ DANIFICADO. Também recebe itens de estoque sem pedido ("Estante 4 nichos semi aberta").

### 5 - FITAMENTO — bordas (TAMBÉM presta serviço a terceiros, em volume)
Listas: A FAZER · FITANDO · MONTAGEM · CENTRO FURAÇÃO · ESTOQUE · **TERCEIRIZADOS FINALIZADOS (269 cards!)** · PARADO · Greenpallets (11) · SEPARADO (29) · ❌ DANIFICADO (2).
Cards de terceiros incluem pessoas físicas e empresas (Mara Marques, Wandiego, Alisson, Claudenildo, Maraysa, Italínea…). Card recorrente de manutenção: **"Engraxar caixas de cola"**. Nos DANIFICADO, o motivo vem no título: "8347 Armário Alto Close … OBS: PORTA ESQUERDA DANIFICADA EM FUROS DOBRADIÇAS".

### 6 - METALURGICA — bases de metalon
Listas: A FAZER · EM PRODUÇÃO · **PINTURA** · FINALIZADO (vazias no print — fluxo rápido ou uso irregular; **a confirmar**).

### 7 - MONTAGEM — o setor mais instrumentado
Listas: ESTOQUE · PRIORIDADES · A FAZER (20) · MONTANDO (2) · LOGÍSTICA · ESTOQUE · **PEDIDO PARADO (3)** · ❌ DANIFICADO.
🔎 **Já existe medição aqui, embrionária:** power-up **List Time Tracker** ativo; campos **"Início montagem" / "Fim montagem"** preenchidos nos cards; badge de tempo parado ("⏳ 3 days", "5 days") nos PEDIDO PARADO. Cards têm **imagens 3D do móvel** anexadas. Tag **`(CUTPLANNING)`** em títulos (ex.: 12988) sugere uso de software de plano de corte para alguns itens. Existe também um quadro **DASHBOARD - MONTAGEM** dedicado.

### 8 - EMBALAGEM
Listas: A FAZER · **LIMPEZA** · **ENCAIXOTANDO** · FINALIZADO (fluxo interno: limpar → encaixotar).

### 9 - LOGISTICA — expedição e o maior estoque de dor
Listas: PRIORIDADE MÁXIMA · A FAZER (29) · LIMPANDO/EMBALANDO · ESTOQUE · **EXPEDIÇÃO (65)** · **ENTREGUE (572)** · **⚠️ NÃO ENCONTRADO (52)** · CAMINHÃO · CANCELADO (189) · RETORNOU (3) · PLANEJAMENTO DE ROTA · EMBALANDO.
Os cards carregam os campos de Início/Fim montagem vindos da MONTAGEM.
🔴 **52 cards em "NÃO ENCONTRADO"**: móvel pronto que ninguém sabe onde está no galpão. É a evidência mais concreta de que falta rastreio físico de unidade.

### ROTA — o quadro do caminhão
Listas: RETIRADAS (4 — cliente retira) · **A FAZER (660!)** · listas **por viagem**: "3ª Rota - SHAOLIN (04/08)", "2ª - CAMINHÃO (05/08)", "4ª Rota - KELVIN (05/08)"… · FINALIZADO (118) · RETORNOU (16) · CANCELADO (19).
SHAOLIN e KELVIN = motoristas/entregadores. **A rota do dia é montada arrastando cards da A FAZER para a lista da viagem.** Os cards são os antigos da automação Plugga (`{pedido}- - {bairro}-{data}`) — as 660 em A FAZER são em boa parte **lixo histórico** acumulado, não backlog real (o ENTREGUE da LOGISTICA tem 572).

### Quadros de apoio
**0 - ESTOQUE** · **CHAPAS MDF** (estoque de chapas!) · **DASHBOARD - MONTAGEM** · **ALINHAMENTO DE DEMANDA** · **LOJA** · **OTIMIZAÇÃO** — conteúdos internos **não mapeados ainda**.

## O que os vídeos da fábrica confirmam

Galpão com **porta-pallets verticais** cheios de móveis embalados em plástico (estoque vertical de acabados), montagem no chão de fábrica, móveis entregues **montados** ("Entregamos montado e com frete grátis" — legenda dos reels). Estrutura física compatível com os fluxos dos quadros.

## As dores que os próprios quadros denunciam

| Dor | Evidência |
|---|---|
| **Peça pronta que se perde no galpão** | NÃO ENCONTRADO com 52 cards |
| **Card parado sem dono** | PEDIDO PARADO com "3/5 days"; STAND BY com 20 |
| **Handoff manual entre 10 quadros** | listas-espelho de setores vizinhos em todo quadro |
| **Trabalho de terceiros misturado ao fluxo próprio** | 269 + 84 cards `Terceirizado` em FITAMENTO/CNC |
| **Dano com causa conhecida mas não tabulada** | listas DANIFICADO em 5 quadros, motivo escrito no título |
| **Sobras de chapa sem sistema** | card "Organização de sobras" |
| **Conhecimento em pessoa, não em processo** | "(CHAMAR GUILHERME PARA ORIENTAÇÃO)" no título |
| **Histórico virando ruído** | ROTA A FAZER 660; CANCELADO 189; ClickUp PCP ~1.123 |

## O que já existe de bom para aproveitar

Time tracking embrionário na MONTAGEM (power-up + campos Início/Fim) · imagens 3D nos cards · tag CUTPLANNING (plano de corte já é realidade parcial) · quadro CHAPAS MDF (consciência de insumo) · rotas por motorista/data (estrutura de dado pronta para automatizar) · numeração dos quadros = processo já desenhado mentalmente pela equipe.

## Perguntas abertas para a equipe (próxima sessão de mapeamento)

1. Como o card viaja fisicamente entre quadros — movido? duplicado? quem move?
2. O que decide SECC vs CNC para um item? E o que dispara STAND BY?
3. GREENPALLETS é cliente B2B recorrente? Qual o fluxo dele?
4. O terceirizado (corte/fita para outros) tem preço/prazo/controle próprio? Onde é cobrado?
5. METALURGICA usa mesmo o quadro? O fluxo real das bases é qual?
6. O que existe dentro de 0-ESTOQUE, CHAPAS MDF, DASHBOARD-MONTAGEM, ALINHAMENTO DE DEMANDA e OTIMIZAÇÃO?
7. CUTPLANNING: qual software, quem opera, cobre quais produtos?

## Ver também

[[001 - HANDOFF - Pesquisa e Ideias de Plataformas]] · [[N8N - PCP Trello e ClickUp]] · [[N8N - ROTAS ClickUp]] · [[N8N - Pendencias e Riscos]]
