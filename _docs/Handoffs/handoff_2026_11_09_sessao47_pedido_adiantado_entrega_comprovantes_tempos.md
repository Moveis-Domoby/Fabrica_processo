---
titulo: Handoff — SESSAO-47 · pedido adiantado no Tiny volta ao PCP, o dia real da entrega, vários comprovantes e a configuração do painel de tempos
tipo: handoff
data: 2026-11-09
tags: [handoff, sessao-47, expedicao, pcp, tiny, entregas, comprovantes, calendario, dashboards, tempos, modo-tv]
---

# 📋 Handoff — SESSAO-47 · Pedido adiantado no Tiny, o dia real da entrega, comprovantes e o painel de tempos (09/11/2026)

Demanda: [[SESSAO-47 - Pedido Adiantado no Tiny Data Real da Entrega Comprovantes e Painel de Tempos]] · Diário: `_docs/Plataforma/Execucao/SESSAO-47.md` (+ `SESSAO-47 - bloco B.md` e `SESSAO-47 - bloco C.md`) · Ramo: `sessao-47-pedido-adiantado-entrega-comprovantes-tempos`

> ✅ **NO AR desde 09/11/2026 ~20:45 de Natal**, com o OK do dono na conversa (*"sobe logo"*, *"RODE AÍ"*): o banco (o ajuste de 06/11 dos números que batem + as 4 atualizações da sessão, na ordem) e o site (a `main`). O n8n **não mudou**.
> ✅ **Também no ar desde 09/11 ~22:20** (com o *"Pode aplicar"* do dono): a quinta atualização, pequena — o fecho do calendário das rotas (`20261109050000`), achado depois da subida. Não muda nada na tela; é para o calendário não ficar lento quando o movimento crescer. Conferido: o corpo vivo da função era o esperado antes e é o novo depois; o calendário da semana e o do mês abrem sem erro, com os entregues no dia real ("prog. 07/11").

## 1. Objetivo

Os pedidos do dono de 09/11, em três blocos independentes:
- **A** — o furo do 13818: pedido que o Tiny levou adiante (Faturado, Pronto para envio, Enviado) e que ainda tem produto por liberar sumia do PCP **e** da Expedição. Agora a Expedição mostra com o aviso e dois botões devolvem o pedido ao PCP mudando a situação no Tiny.
- **B** — ao dar um pedido como entregue, poder marcar **o dia em que foi entregue de fato** (nunca um dia que ainda não chegou), valendo em toda a plataforma, inclusive no calendário das rotas; e anexar **vários comprovantes de uma vez**.
- **C** — um botão **"Configurar painel"** em Dashboards → Tempos de produção (tipo de gráfico, ligar e desligar montadores vendo quem é cada letra, e as recomendações que o dono aceitou).

## 2. O que foi feito

### Bloco A — Pedido adiantado no Tiny que ainda falta produzir (frentes 1 a 4)

| Frente | O que mudou |
|---|---|
| **1 · A Expedição mostra o pedido** | O pedido Faturado, Pronto para envio ou Enviado no Tiny com produto por liberar aparece **mesmo com zero peça pronta**, com o aviso da situação real: *"Este pedido está como Pronto para envio no Tiny, por isso saiu do PCP. Ainda falta liberar 2 produtos."* Com peça pronta **e** falta, o card normal ganha o mesmo aviso. Quadradinho novo **"Saiu do PCP pelo Tiny"** nos filtros. Preparando envio, Em aberto, Entregue e Cancelado não ganham o aviso. |
| **2 · Os dois botões** | **"Voltar para Em aberto (Tiny)"** e **"Voltar para Preparando envio (Tiny)"**, no aviso, para logística e admin. Confirmação de uma frase (*"O pedido 13818 vai voltar ao PCP com 2 produtos para liberar, e no Tiny passa para Preparando envio."*). Num toque: a plataforma pede a situação ao Tiny pela fila de saída que já existia, o pedido volta ao PCP **na hora** só com o que falta, fica o registro (quem, situação de antes, situação pedida) e o PCP é avisado. Toque repetido = um efeito. A volta vale até o Tiny mostrar outra situação; aviso antigo do Tiny fora de ordem não esconde o pedido. O Tiny recusou ou não respondeu → o pedido segue no PCP com **"O Tiny ainda não confirmou a mudança"** e o alerta sai pela porta de sempre. Com a ida ao Tiny desligada, os botões ficam apagados com a explicação. O stand-by é mantido (o pedido volta para a aba Stand-by). |
| **3 · Na janela de liberar peça** | Com o pedido de origem adiantado no Tiny e o produto voltando para a produção, a janela mostra a situação real e três opções **no mesmo gesto**: "Voltar para Em aberto (Tiny)", "Voltar para Preparando envio (Tiny)" e **"Deixar como está"** (o pedido fica na Expedição, com o aviso). "Não por enquanto" (stand-by) passou a funcionar também com o Tiny adiante — antes o gesto inteiro era recusado. |
| **4 · Avisos que dizem a verdade** | "Pedido N voltou ao PCP" só sai quando voltou. Quando não volta: *"O produto saiu do pedido N, mas ele está como Pronto para envio no Tiny e ficou na Expedição esperando decisão."* — vai para a logística e abre a Expedição já no filtro novo. A notificação da janela de liberar diz o que aconteceu de verdade. |

Banco: `supabase/migrations/20261109010000_plt_sessao47_base.sql` (os fatos novos, a marca no card, a regra única do PCP) e `20261109020000_plt_pedido_adiantado_tiny.sql`. Telas: `src/logistica/voltaPcp.ts` (novo), `src/logistica/api.ts`, `src/paginas/Expedicao.tsx`, `src/logistica/componentes/ModalLiberarPeca.tsx`, `src/paginas/PCP.tsx`, `src/kanban/tipos.ts`, `src/kanban/componentes/ModalLinhaTempo.tsx`, `src/auditoria/rotulos.ts`, `src/notificacoes/api.ts`. Testes: bateria (bloco "SESSAO-47 · A", 20 conferências), `src/paginas/Expedicao.test.tsx`, `src/logistica/componentes/ModalLiberarPeca.test.tsx`, `src/logistica/voltaPcp.test.ts`.

Fotos (a tela real com dados de exemplo — nomes inventados):

![[sessao47-expedicao.png]]
*A Expedição: o sexto quadradinho, o aviso com a situação real e os dois botões; o pedido já devolvido mostra "O Tiny ainda não confirmou a mudança".*

![[sessao47-expedicao-confirmar.png]]
*A confirmação de uma frase.*

![[sessao47-expedicao-liberar-peca.png]]
*A janela de liberar peça com a situação real e as três opções.*

![[sessao47-expedicao-tiny-desligado.png]]
*Com a ida ao Tiny desligada: botões apagados e a explicação.*

![[sessao47-expedicao-celular.jpg]]
*No celular (375 px), sem rolagem lateral. Tablet: `sessao47-expedicao-tablet.png`.*

### Bloco B — A entrega (frentes 5 e 6)

| Frente | O que mudou |
|---|---|
| **5 · "Marcar como entregue no dia..."** | Depois de tocar em "Entregue" — em ROTAS → Entregas (logística) e nas Entregas do dia (entregador) — aparecem **"Confirmar entrega"** (hoje, como sempre), **"Marcar como entregue no dia..."** (abre "Em que dia foi entregue?" e o botão vira "Marcar como entregue em dd/mm/aaaa") e **"Ainda não"**. Com peças ainda em produção o aviso da imagem do dono continua, e os dois botões de confirmar valem como o "entregar mesmo assim" de antes. **O dia de amanhã é recusado pela tela e pelo banco**; o dia anterior à chegada do pedido também. A entrega nasce já com o dia real (a hora de um dia passado = o fim do expediente da fábrica naquele dia) e com a hora em que foi registrada — a trilha diz "Marcado como entregue no dia X (registrado em Y)". |
| **5 · A data vale em toda a plataforma** | Uma data só (guardada no card do pedido) para: a ficha ("Entregue no dia 06/11/2026, registrado em 09/11/2026 às 10:32 por Fulano"), a lista de pedidos, ROTAS → Entregas, Já programadas, as Entregas do dia ("entregue em dd/mm" e a lista dos entregues neste dia que eram de outra rota), **o calendário das rotas** (o entregue no dia real, com a nota "prog. dd/mm" quando difere do programado) e o número de entregas do painel de Motivos. |
| **5 · Desfazer e corrigir** | "Desfazer do dia" conta pelo dia em que a entrega foi **registrada** (quem marcou hoje "entregue ontem" ainda desfaz hoje). **Corrigir depois: só o admin**, na ficha, pelo botão **"Alterar a data da entrega"** (dia + motivo opcional) — é um registro novo com o dia de antes e o novo; a entrega original não é editada. Logística e entregador não veem o botão, e o banco recusa. O Tiny continua recebendo "Entregue" como hoje; a data não vai. |
| **6 · Vários comprovantes de uma vez** | Nos três lugares (o painel do "Entregue" do entregador, o botão "Comprovante" do card e a ficha — que ganhou "Anexar comprovantes") dá para **escolher vários arquivos de uma vez** (até 10; os mesmos tipos e o mesmo tamanho de antes). Cada um sobe e é registrado sozinho, um depois do outro: **o que falha não derruba os outros**, a janela diz qual falhou e por quê, e "Tentar de novo" manda só ele. A entrega continua sendo registrada **antes** dos comprovantes. |
| **Extra · o calendário mais firme** | A leitura do calendário das rotas passou a usar sempre o plano feito sob medida para o período — com 100 vezes o movimento, da 6ª leitura em diante na mesma conexão ela levava dezenas de segundos (achado do ajuste de 06/11). |

Banco: `supabase/migrations/20261109030000_plt_entrega_dia_real.sql` (a frente 6 não mexe no banco). Telas: `src/rotas/ConfirmarEntrega.tsx`, `diaDaEntrega.ts`, `ModalComprovantes.tsx`, `enviarComprovantes.ts`, `useComprovantes.ts` (novos), `src/pedidos/AlterarDataDaEntrega.tsx`, `entregaNaFicha.ts` (novos), `src/paginas/Rotas.tsx`, `EntregasDoDia.tsx`, `src/pedidos/FichaDoPedido.tsx`, `ProducaoDoPedido.tsx`, `src/rotas/AbaCalendario.tsx`, `src/rotas/api.ts`. Testes: bateria (bloco "SESSAO-47 · Bloco B", 35 conferências) e os testes de tela ao lado de cada arquivo. Diário próprio: `Execucao/SESSAO-47 - bloco B.md`.

![[sessao47-entrega-confirmar.png]]
*ROTAS → Entregas, depois de "Entregue": os três botões.*

![[sessao47-entrega-em-producao-dia.png]]
*O pedido que ainda aparece em produção: o aviso continua, e "Marcar como entregue no dia..." abre a escolha do dia.*

![[sessao47-entregador-celular.jpg]]
*O painel do entregador no celular (375 px): vários comprovantes escolhidos, a observação e os três botões.*

![[sessao47-comprovantes.png]]
*A janela dos comprovantes: dois subiram, um falhou — o porquê na linha e "Tentar de novo o arquivo que falhou".*

![[sessao47-calendario-dia-real.png]]
*O calendário das rotas: o 13841 aparece no dia em que foi entregue de fato (09/11), com "prog. 10/11".*

![[sessao47-ficha-entrega.png]]
*A ficha: "Entregue no dia 06/11/2026, registrado em 09/11/2026 às 10:32 por …", os comprovantes e (só admin) "Alterar a data da entrega".*

![[sessao47-ficha-alterar-data.png]]
*A janela do admin para corrigir o dia.*

### Bloco C — A configuração do painel de Tempos de produção (frente 7)

| Item | O que mudou |
|---|---|
| **O botão** | **"Configurar painel"** em Dashboards → Tempos de produção, ao lado de "Modo TV" — **só o admin vê** (líder e funcionário veem só o resultado; o banco recusa quem não é admin). A janela é lida no clique. |
| **Uma configuração só** | Vale para a tela e para a TV, para a fábrica inteira (só o liga/desliga dos montadores é por setor). Salvou, **a TV e as telas abertas mudam na hora**, pelo canal que já ouviam. Toda mudança aparece na Auditoria ("Mudou a configuração do painel de tempos", com o que mudou em frases). |
| **1 · Tipo de gráfico** | Para a aba Período e para a TV, cada um com a sua escolha: **empilhadas por montador** (o desenho de sempre), **barras** (uma por dia, só o total) e **linhas** (uma por montador). |
| **2 · Montadores** | A equipe de cada setor com **letra, nome e foto** (só nessa janela — a TV continua só com letras) e um liga/desliga. **Desligado sai da coluna dele, na tela e na TV, e entra em "Outros"**; os totais, as médias e o "Melhor da semana" do setor não mudam (provado no banco: os números do setor idênticos nas 6 leituras). Dupla com um desligado = a letra do ligado + "Outros". |
| **3 · Tempo padrão** | Liga e desliga uma **marca na linha do dia** (aba Dia): em cada móvel, um tracinho mostra onde ele terminaria no tempo padrão do modelo. ⚠️ Decisão provisória que pede o olhar do dono — os gráficos contam móveis, não tempo, então não havia onde riscar tempo padrão neles. |
| **4 · Abrir já filtrado** | O setor e o período (hoje, 7 ou 30 dias) com que a tela abre pelo menu. Link salvo e filtro escolhido na hora continuam mandando. A tela passou a abrir em **uma** requisição. |
| **5 · Média ou mediana** | Qual número a tela e a TV mostram; o rótulo de cada número diz qual está valendo ("média · a mediana é 35 min"). O tempo padrão de cada móvel não muda. |
| **6 · O que a TV mostra** | Liga e desliga dos 7 blocos que a TV já tinha: os quatro números do topo, a coluna dos montadores, o gráfico dos 14 dias, o melhor da semana, o relógio, o "dados até" e o selo "ao vivo". A TV se arruma sozinha quando um bloco sai. |
| **"Voltar ao padrão"** | Volta os gráficos, o tempo médio, a abertura e a TV ao desenho de antes (os montadores ficam como estão). |

Banco: `supabase/migrations/20261109040000_plt_tempos_painel_config.sql`. Telas: `src/paginas/dashboards/tempos/ConfigurarPainel.tsx`, `src/dashboards/tempos/painel.ts`, `consultas.ts`, `GraficoMoveis.tsx`, `linhaDoDia.ts` (novos), `src/paginas/dashboards/TemposProducao.tsx`, `ModoTv.tsx`, as abas `AbaDia`/`AbaPeriodo`/`AbaMoveis`/`AbaMontadores`, `src/dashboards/tempos/api.ts`, `src/auditoria/rotulos.ts`. Testes: bateria (bloco "SESSAO-47 · Bloco C", 41 conferências) e 53 testes de tela. Diário próprio: `Execucao/SESSAO-47 - bloco C.md`.

![[sessao47-painel-configurar.png]]
*A janela "Configurar painel" (dados de exemplo): os gráficos, média ou mediana, a marca do tempo padrão, como a tela abre, os montadores com letra, nome e foto, e os blocos da TV.*

![[sessao47-painel-periodo.png]]
*A aba Período com o botão (só para o admin) e o gráfico de sempre.*

![[sessao47-painel-periodo-linhas-media.png]]
*A mesma aba com "linhas" e "média" escolhidas: o rótulo diz "média · a mediana é 35 min".*

![[sessao47-painel-tv.png]]
*A TV como sempre (só letras).*

![[sessao47-painel-tv-barras-outros.png]]
*A TV com "barras", o Montador B desligado (saiu da coluna) e o "Melhor da semana" desligado.*

### Junto, por ser a base — o ajuste de 06/11 (os números que batem entre as telas)

Estava pronto num ramo local desde 06/11 e nunca tinha subido; a SESSAO-47 foi construída por cima dele (mexem nas mesmas funções), então subiu junto: "A entregar" sem o pedido cancelado no Tiny (o 13686 saiu da lista — conferido no ar), a Visão do dia contando o que o quadro mostra (a espera em horas de expediente), o cancelamento no Tiny fechando o stand-by, e "fora do calendário" só com o que não está na grade. Detalhe: [[handoff_2026_11_06_numeros_que_batem]] e `Execucao/AJUSTE - Numeros que batem entre as telas.md`.

## 3. Como testar (roteiro do dono)

**Bloco A — pedido adiantado no Tiny**
1. **Logística → Expedição.** Há um sexto quadradinho, **"Saiu do PCP pelo Tiny"** (em 09/11 à noite: **2** — o 13652 e o 13684). Toque nele: aparecem só esses, cada um com o aviso laranja ("Este pedido está como Faturado no Tiny, por isso saiu do PCP. Ainda falta liberar N produtos.") e os dois botões.
2. Num deles, toque em **"Voltar para Preparando envio (Tiny)"** (ou "Em aberto") → confira a frase → **"Voltar ao PCP"**. ⚠️ *Isto muda de verdade a situação do pedido no Tiny — é o que o botão faz.* O aviso some do card; o pedido aparece em **Fábrica → Produção → PCP** só com o que falta liberar; o sino do PCP recebe "Pedido N voltou ao PCP"; no Tiny a situação muda em seguida. Enquanto o Tiny não confirma, o card mostra "O Tiny ainda não confirmou a mudança".
3. Toque de novo no mesmo botão (ou peça a outra pessoa): nada acontece duas vezes.
4. **Liberar peça:** Expedição → um pedido com peça pronta que esteja Faturado, Pronto para envio ou Enviado no Tiny → "Liberar para outro pedido" → escolha a peça → responda as perguntas → com "Sim, produzir de novo", a janela mostra "No Tiny, este pedido está como …" e as três opções. Com "Deixar como está", o aviso do sino diz que o pedido ficou na Expedição esperando decisão (e leva para lá).
5. O PCP continua **sem** mostrar pedido adiantado no Tiny que ninguém devolveu.

**Bloco B — a entrega**
6. **Rotas → Entregas → "Entregue"** num pedido: aparecem "Confirmar entrega", "Marcar como entregue no dia..." e "Ainda não". Toque em "Ainda não" para só olhar.
7. Numa entrega de verdade que aconteceu em outro dia: "Marcar como entregue no dia..." → escolha o dia → "Marcar como entregue em dd/mm/aaaa". Tente escolher amanhã: o botão não acende ("Esse dia ainda não chegou").
8. Confira o dia escolhido: na **ficha do pedido** ("Entregue no dia …, registrado em … por …"), em **Rotas → Programação → Calendário** (o pedido no dia real, com "prog. dd/mm" se estava programado para outro dia — toque nele para ver a frase inteira) e nas **Entregas do dia**.
9. **Desfazer:** quem marcou hoje uma entrega de ontem ainda desfaz hoje (Entregas do dia ou a ficha).
10. **Corrigir o dia (só admin):** ficha do pedido → "Entrega e comprovante" → **"Alterar a data da entrega"** → dia e motivo (opcional) → "Salvar a data". Entre como logística: o botão não aparece.
11. **Vários comprovantes:** no celular do entregador, "Entregue" → "Anexar comprovantes (opcional)" → escolha 2 ou 3 fotos de uma vez → "Confirmar entrega": a entrega é registrada e a janela mostra cada arquivo subindo. Também pelo botão "Comprovante" do card e por "Anexar comprovantes" na ficha. *Para conferir no aparelho: se, ao escolher vários, o celular ainda oferece a câmera.*

**Bloco C — o painel de tempos**
12. **Dashboards → Tempos de produção**, como admin: o botão **"Configurar painel"** ao lado de "Modo TV". Como líder ou funcionário, não aparece.
13. Abra a janela; troque o gráfico da aba Período para "Linhas" → **Salvar**: a aba Período muda sem recarregar. Com uma TV aberta em outro aparelho, troque o gráfico da TV ou desligue um bloco: **a TV muda na hora**.
14. Desligue um montador: ele some da coluna na TV e da tela e aparece "Outros"; **os totais do setor (montados no dia, no mês, tempo médio) continuam os mesmos**. Religue.
15. Ligue "Marcar onde cada móvel terminaria no tempo padrão" e veja a aba Dia; escolha "Média" e veja os rótulos; em "Como a tela abre" escolha um setor e "7 dias", salve e abra a tela pelo menu.
16. **Super admin → Auditoria:** a linha "Mudou a configuração do painel de tempos". **"Voltar ao padrão"** + Salvar deixa tudo como antes.
17. ⚠️ **Recarregue cada TV do galpão uma vez** — a que já estava ligada segue com o programa de antes até recarregar.

## 4. Verificação

- **Bateria do banco** (aplica todas as migrations duas vezes): **1.640 verdes, 1 vermelho antigo** (o painel de vendas — "as 7 portas novas = as antigas em 8 períodos" —, que já falha na `main` sem esta sessão). Novos: 20 do bloco A, 35 do B, 41 do C.
- **Site:** tipos e lint limpos; **545 testes de tela** verdes (83 arquivos); o site compila.
- **Antes de aplicar** (só leitura): o corpo de **31 funções** no banco vivo comparado com o último `create` das migrations já aplicadas — **31 iguais**. Havia 2 pedidos adiantados no Tiny sem liberar tudo (os dois da demanda) e a ida ao Tiny ligada.
- **Aplicação** (09/11 ~20:45): as 5 atualizações, uma transação cada, na ordem; em todas, a integração do Tiny com a estrutura idêntica e as linhas idênticas.
- **No ar, com o acesso do dono (só olhando):** a Expedição com "2 · Saiu do PCP pelo Tiny" e o aviso com os botões no 13684 (falta 1) e no 13652 (faltam 3); o PCP sem eles (aguardando liberação: 2, igual ao quadrinho da Visão do dia); a Programação voltou a listar o 13652; "A entregar" sem o 13686 cancelado; a tela de tempos abrindo em uma requisição, com o botão; a janela de configuração lendo do banco (10 montadores ligados, tudo no padrão) — aberta e fechada **sem salvar**; a TV com os mesmos números de antes. Nenhum erro no console em nenhuma delas. **Nenhum botão que muda dado foi tocado.**
- **Celular (375) e tablet (768):** Expedição e o painel do entregador sem rolagem lateral (medido). A janela de configuração usa a janela padrão da casa.
- **Depois de aplicar, só lendo o banco** (21:40): as 3 colunas novas do card, as 2 do painel, as 2 visões, os 6 gatilhos e as 5 portas novas existem; **163 entregas vigentes, 0 sem o dia projetado**; nenhum pedido devolvido ao PCP ainda; 2 adiantados com falta; a fila de saída do Tiny vazia; a configuração do painel no padrão e nenhum montador desligado; nenhum stand-by aberto em pedido cancelado (o ajuste de 06/11).
- **Advisors da Supabase** (lidos às 21:40): **nada novo além do esperado** — as 5 portas novas ganham o aviso de sempre das portas da plataforma (função com direitos do dono executável por quem está logado — são 268 assim) e o índice novo do dia da entrega aparece como "ainda não usado". Os outros avisos já existiam (7 funções antigas sem caminho de busca fixo, a extensão de rede no esquema público, a proteção de senha vazada desligada no painel).
- **Não conferido:** o seletor de vários arquivos com a câmera no aparelho do entregador; a medida de velocidade no aparelho (INP/LCP).

## 5. Desempenho (Lei — checklist)

- [x] **Requisições:** nenhuma tela ganhou requisição; a tela de tempos passou a abrir em 1. A janela de configuração, a de comprovantes e a de corrigir o dia só leem/escrevem no clique.
- [x] **Sem polling, sem `postgres_changes`, sem relógio novo:** a ida ao Tiny usa a fila que já existia; as marcas fecham no fato (gatilho); as telas releem pelo aviso da área; a configuração do painel viaja pelo canal do setor.
- [x] **Toda porta nova ou tocada no ×100** — três ensaios, em `Execucao/dados/SESSAO-47 - ensaio x100 …`:
  - **A** (562.700 pedidos): PCP 77 → 77 ms · porta antiga do PCP 214 → 195 · quadrinho 63 → 72 · regra do pedido vivo 0,73 → 0,58 s · Expedição 2,11 → 1,96 s · Programação 3,13 → 2,75 s · "A entregar" 5,02 → 3,92 s · voltar ao PCP 12 ms.
  - **B** (15 mil entregues): Já programadas "por entregar" 1.738 → 140 ms · ROTAS Entregues 3,8 → 3,6 s · entregas do dia 53 → 65 ms · lista de pedidos 108 → 113 ms · ficha 17 → 16 ms · registrar 30 ms · marcar ontem 39 ms · corrigir o dia 30 ms.
  - **C** (300 mil passagens): Dia 24 → 25 ms (dia cheio 59 → 32) · Período 76 → 78 · Móveis 52 → 55 · Montadores 113 → 114 · **TV 164 → 68 ms** · abertura = a aba + 1,5 ms.
  - **Nenhuma porta piorou além do ruído.** As que estão fora do teto no ×100 já estavam (dívidas 24, 25, 29, 30, 31) e continuam registradas na lei; novas: 33 (o calendário — paga na quinta atualização, já aplicada), 34 (o degrau do plano genérico em outras portas) e 35 (entregas do dia com a rota muito cheia).
- [x] **Duas regressões achadas pelo ensaio e corrigidas antes de subir** (a regra do PCP aninhando funções; o caso novo do pedido vivo citando a coluna do card).
- [x] **Índices:** um novo, parcial (`plt_cards_entrega_em_idx`). Nenhuma política de RLS nova.
- [x] **Listas:** nenhuma lista nova sem teto ("entregues de outro dia": no máximo 100).
- [x] **Pacote:** JS inicial **236,3 KB** comprimidos (antes 235,9; teto 250); o que é novo são pedaços baixados no clique.
- [x] **Escrita idempotente:** voltar ao PCP e liberar peça pela chave do toque; registrar a entrega (toque repetido = a mesma entrega); salvar a configuração igual = nada; comprovante com caminho estável.
- [x] **Advisors** — lidos depois de aplicar: nada novo além do esperado (ver a Verificação).

## 6. Pendências que precisam do dono

1. ~~Aplicar o fecho do calendário (`20261109050000`)~~ — ✅ aplicado em 09/11 ~22:20, com o OK do dono.
2. **Recarregar as TVs do galpão** uma vez.
3. **Confirmar as decisões provisórias** D-272…D-275 (pedido adiantado), D-277…D-283 (entrega e comprovantes) e D-285…D-289 (painel). As que mais pedem o olhar dele:
   - a "linha do tempo padrão" virou uma **marca na linha do dia** (D-288) — pode não ser o que ele imaginou;
   - o pedido adiantado com falta **volta a poder ser programado numa rota** (D-275.1);
   - a **entrega parcial não escolhe o dia** (D-283.2);
   - na TV, a dupla em que um não tem letra passou a aparecer como **"A + Outros"** mesmo sem ninguém mexer (D-287);
   - se o admin escolher um **setor de abertura**, ele vale para todos os aparelhos (D-289.6).
4. **ClickUp:** criar a 6ª tarefa ("Expedição - Aviso de pedido que saiu do PCP pela situação do Tiny") — só com o OK dele. As 5 que existem estão em FAZENDO, com o comentário do que foi entregue; quem conclui é o dono.
5. **Conferir no celular do entregador** se, ao escolher vários comprovantes, o aparelho ainda oferece a câmera (se não, o remédio é um botão "Tirar foto" ao lado).
6. **Achados fora do escopo, para uma próxima sessão:** a busca geral escreve "Entregue em dd/mm" pelo dia em que a peça foi arquivada (o dia do registro, não o dia real); o detalhe da devolução mostra o dia antigo de uma entrega corrigida; a lista de pedidos mostra a hora do fim do expediente quando o dia foi escolhido; a Auditoria mostra o antes/depois da configuração do painel com os nomes internos das opções; o degrau do plano genérico pode existir em outros painéis.
7. **Do ajuste de 06/11** (segue com o dono): o handoff dele tinha a seção de pendências por preencher.

## 7. Numeração usada

Migrations `20261109010000` (base), `…020000` (A), `…030000` (B), `…040000` (C) — aplicadas às 20:45 — e `…050000` (o fecho do calendário — aplicada às 22:20); junto, a `20261106030000` do ajuste de 06/11. Decisões **D-271…D-289**; aprendizados **E-235…E-249** e **A-198…A-211**; dívidas da lei **33, 34 e 35**. Seguinte: **D-290 / E-250 / A-212 / dívida 36**.

