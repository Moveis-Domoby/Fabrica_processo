---
titulo: "Memória de aprendizado — Front Telas e React (parte 1 de 2)"
tipo: memoria-tema
tema: front-react
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/front-react]
---

# 🧠 Memoria - Front Telas e React 1

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🔴 Erros e correções (E-NN)

### E-30

- [2026-09-16] **E-30** (Claude Code) · Corrigi valor vazando do cartão com `truncate`/`overflow-hidden`/esconder ícone/`min-h` fixo — o dono recusou: *"faça uma análise de fato… sem paliativos"* → **correção:** a causa era tamanho por **breakpoint de viewport**, que não enxerga a sidebar (~450px) — o mesmo "xl" dá cartão de 150px ou de 300px. Passou a **container query** + grid `auto-fit/minmax` calibrado pelo dado mais largo. **Lição: cortar/esconder número é esconder o defeito; num cartão, quem manda no tamanho é a largura do CARTÃO, não a da janela. E a largura mínima da coluna faz parte da correção.**

### E-32

- [2026-09-16] **E-32** (Claude Code) · Quase acusei bug de layout (sidebar "escondida" com a media query ativa, cores presas no valor antigo) — era **CSS inconsistente do HMR** depois de várias edições seguidas em `tokens.css`/`global.css`, e página **congelada** (janela atrás: `ResizeObserver` não dispara, transição não progride, screenshot falha) → **correção:** recarregar a página antes de concluir. **Lição: medida de layout/cor em página que não pinta não vale — confirmar com reload e, se o observer não dispara, o ambiente é o suspeito, não o código.**

### E-48

- [2026-09-28] **E-48** (Claude Code) · Na SESSAO-13 a gaveta do celular ganhou a SEGUNDA barra sem rever o `max-w-[92vw]` pensado para uma barra só (SESSAO-07): as duas juntas não encolhem abaixo de ~382–390px (a barra 1 para na linha do usuário — o nome `truncate` não quebra; a barra 2 na palavra mais longa), a caixa ficava com 345px no 375 e o `-translate-x-full` levava só a CAIXA — ~38–45px da barra 2 ficavam na borda esquerda com a gaveta FECHADA, por cima do conteúdo e pegando o toque (achado na [[Memoria - Modelos Formulas e Possibilidades#F-7|F-07]] da S24; a sobra variava com o nome do usuário) → **correção:** envoltório rolável dentro do aside (a caixa contém as barras; teto = a tela) + `invisible` quando fechada. `overflow-hidden` no aside foi medido e descartado: cortava o painel do sino. **Lição: o que sai da tela por `translate` tem que CONTER o próprio conteúdo — o translate move a caixa, não o que transborda dela; e `translate`/`transform` num ancestral vira bloco de contenção de todo `fixed` de dentro (o painel passa a ser "absolute" do aside — e é cortado pelo overflow dele). Fechado = `invisible`, não só fora da tela (senão segue no Tab e no toque).**

### E-52

- [2026-09-27] **E-52** (Claude Code) · Plural montado com `mensagem${n === 1 ? '' : 's'}` deu **"mensagems"** no rótulo do balão do chat — plural em português não é "+s" (mensagem→mensagens, pão→pães) → **correção:** as duas formas por extenso (`n === 1 ? 'mensagem não lida' : 'mensagens não lidas'`). Pego pelo teste de integração do chat, que buscava o botão pelo nome acessível (o leitor de tela teria lido errado). **Lição: plural na interface se escreve por extenso nas duas formas; e buscar elemento pelo NOME acessível no teste pega texto errado que o olho não vê.**

### E-54

- [2026-09-28] **E-54** (Claude Code) · No teste ao vivo a 375px, a conversa da tela do Chat saía **cortada à direita** (botão Pessoas e enviar invisíveis) sem rolagem lateral na página: a grade sem colunas declaradas no celular tem coluna implícita `auto`, que cresce até o conteúdo que não quebra (o título com `truncate`), e o `overflow-hidden` do cartão escondia o resto; no computador não aparecia porque lá a coluna era `minmax(0,1fr)` → **correção:** `grid-cols-1` (= `minmax(0,1fr)`) + `min-w-0` nos filhos. Junto: botões de texto do chat com `tamanho="sm"` (36px) → 44px. **Lição: grade que só declara colunas no breakpoint grande precisa de `grid-cols-1` no pequeno — "não tem rolagem lateral" não prova que nada foi cortado; medir se algum elemento passa da borda do cartão.**

### E-57

- [2026-09-28] **E-57** (Claude Code) · A [[Memoria - Modelos Formulas e Possibilidades#F-7|F-07]] da SESSAO-26 a 768px foi feita **com a gaveta do menu fechada**; aberta, o balão do chat (`z-40`) fica **aceso e clicável por cima do fundo escuro** dela (também `z-40`), porque o `<BalaoChat />` vem depois do fundo no `Layout` — com z-index empatado, vence quem vem depois no DOM. O botão da `BolhaExecucao` já fazia igual (mesmo `z-40`, também depois do fundo), então o balão só repetiu a casa; o `Modal` não sofre disso porque o Radix o põe no fim do `body` (portal); no celular a gaveta (`z-50`) cobre o balão. Medido com `document.elementFromPoint` no centro do balão, no `3503d77` → **correção:** pendente do dono — o conserto natural é no `Layout` (a camada da gaveta acima das bolhas flutuantes), não em cada bolha; o `Layout` está com a sessão da gaveta do celular, avisada. ↪️ **Corrigido em 28/09** (ajuste da gaveta, com o OK do dono): fundo escuro e gaveta foram para `z-[55]` abaixo de `lg` — acima das bolhas (40) e também dos painéis delas (50: com o painel do chat aberto, o menu abria POR BAIXO dele), abaixo dos avisos (60); no computador `lg:z-50`. Conferido na tela real a 768 e 375: com o menu aberto, o toque no balão e na bolinha cai no fundo escuro; com o chat aberto, o ponto onde chat e menu se sobrepõem cai no menu. **Lição: F-07 de componente flutuante abre também o que o sobrepõe (gaveta, modal, menu) e pergunta ao navegador quem está por cima — z-index igual se desempata pela ordem no DOM, e portal muda essa ordem.**

### E-80

- [2026-10-02] **E-80** (Claude Code, SESSAO-27) · O "caber na tela" ao abrir o canvas marcava "já coube" ANTES do quadro agendado rodar; no modo de desenvolvimento o React monta duas vezes, a 1ª limpeza cancela o quadro e a 2ª montagem via a marca e desistia — o desenho abria em 100% (no celular, cortado). Medido no tablet/celular: zoom 100% com a área de 375×581 → **correção:** a marca só vale depois de caber de fato, e o gatilho virou um `ResizeObserver` (ajusta assim que o quadro GANHA tamanho; sem ele, cai no quadro agendado). Conferido: abre em 61% no celular, tudo à vista. **Lição: em efeito de "uma vez só", a marca de feito vai DENTRO do trabalho que ela marca, nunca antes de agendá-lo.**

### E-83

- [2026-10-03] **E-83** (Claude Code, SESSAO-28) · A rota pelas ruas aparecia **tracejada** (o estilo do plano B, a linha reta): eu trocava as duas `Polyline` num ternário na MESMA posição do JSX, o React reaproveitou o componente e o react-leaflet aplica `pathOptions` novo com `setStyle` — que **mescla** no estilo antigo; como o estilo da rota não tinha a chave `dashArray`, o tracejado da reta ficou. Medidas por texto (distância, trechos) estavam certas; só a foto mostrou → **correção:** `key` diferente em cada linha (`pelas-ruas` / `linha-reta`) — remonta a camada; conferido no DOM (`stroke-dasharray` nulo) e na foto. No mesmo passo, a foto mostrou o mapa expandido sem reenquadrar (a rota cortada no canto): o reenquadrar passou a rodar também depois do `invalidateSize` do expandir/recolher. **Lição: camada de mapa que troca de ESTILO por estado leva `key` própria (estilo do Leaflet se mescla, não se substitui); e prova de mapa é foto — texto e números não mostram tracejado nem enquadramento.**

### E-85

- [2026-10-03] **E-85** (Claude Code, ajustes da SESSAO-28) · O [[Memoria - Front Telas e React 1#E-30|E-30]] de novo: a tela nova nasceu com as duas colunas no breakpoint da JANELA (`lg:`) — numa janela de 1024 com os dois menus abertos, a área da tela tinha 561 px e a coluna "Na rota" ficou com 221 px (o cartão quebrava palavra por palavra); e o mapa (camadas do Leaflet com z-index 400–1000, sem contexto próprio) desenhava POR CIMA da barra fixa do Programar → **correção:** `@container` + `@3xl:` (duas colunas só quando a ÁREA tem espaço; numa coluna, "Na rota" → mapa → lista) e `isolate` no mapa. Pego na foto da tela. **Lição: tela com coluna lateral mede a área (container), nunca a janela — e componente de terceiro com z-index interno (Leaflet) nasce com `isolate`.**

### E-99

- [2026-10-15] **E-99** (Claude Code, SESSAO-31, validação no site) · Mãozinha com o botão do meio sem conferir quem mais escuta esse botão: o `MouseSensor` da biblioteca de arrastar ativa com qualquer botão menos o direito — o card andaria junto com o quadro e cairia noutra coluna (achado ao validar no site, ~15 min no ar). → **Correção:** `SensorDoMouse` só com o botão esquerdo + teste; conferido no site com o `mousedown` do meio forçado (o card não foi pego, nada foi ao banco). Gesto novo num alvo que já tem gesto: listar quem escuta o mesmo botão/evento antes de publicar.

### E-90

- [2026-10-09] **E-90** (Claude Code, SESSAO-30, [[D-122 - As contas a receber voltam do Tiny todo dia na conferencia|D-122]]) · Para ver os agendamentos do banco, listei `cron.job` com a coluna `command` inteira — dois trabalhos antigos chamam funções da borda com o cabeçalho de autorização escrito no comando, e a chave saiu na saída da ferramenta (era a chave pública do navegador, a mesma do site; nada novo exposto, mas o hábito é o erro) → **correção:** listar agendamentos só por `jobname, schedule, active`; o comando só quando preciso, e filtrado. **Lição: coluna que guarda comando, cabeçalho ou URL pode carregar segredo — nunca imprimir inteira (vale para `cron.job.command`, `net.http_request_queue`, nós do n8n, `plt_webhooks`).**

### E-164

- [2026-10-27] **E-164** (Claude Code, SESSAO-41 · filtros) · A `Selecao` (componente da casa) promete "uma linha só, o texto longo termina em …", mas o `Select.Value` do Radix **não repassa `className`** — o `truncate` nunca chegou ao DOM e toda opção longa quebrava em duas linhas (visto na vitrine: "Próximos 15 dias (11)" no celular). → **correção:** o corte mora num invólucro (`<span className="min-w-0 flex-1 truncate">` em volta do `Value`) — vale para todas as seleções do sistema. **Lição: comentário de componente não é prova — conferir no `outerHTML` se a classe chegou.**

### E-167

- [2026-10-28] **E-167** (Claude Code, ajuste 28/10 · avisos) · O atalho "Escolher os avisos" entrou no cabeçalho do painel do sino, ao lado de "Marcar todas como lidas": no painel de 320 px o texto quebrou em duas linhas (a vitrine mostrou). → **correção:** o atalho foi para o rodapé (um quadrado de 48 px ao lado de "Ver todos"). **Lição: painel estreito com botão de texto — o ícone novo vai onde já há quadrados (rodapé), não ao lado do texto; conferir na vitrine com o caso mais cheio (avisos não lidos E lidos).**

### E-231

- [2026-11-05] **E-231** (Claude Code, SESSAO-46) · No teste de tela do quadro Tech, com a rolagem das colunas levada ao fim, a PÁGINA inteira ganhou rolagem para o lado (1110 px numa janela de 986): o texto só para leitor de tela (`sr-only`, que é `position: absolute`) dentro do cartão não tinha ancestral posicionado e escapou da coluna que rola → **correção:** `relative` no cartão e no selo. **Lição: `sr-only` dentro de área com rolagem própria precisa de um ancestral `relative` — conferir `document.documentElement.scrollWidth` com a rolagem interna no fim.**

### E-244

- [2026-11-09] **E-244** (Claude Code, SESSAO-47 · frente da entrega) · Dois descuidos de tela pegos na revisão da própria frente: a ficha relia DUAS vezes depois de corrigir a data (a invalidação e o `aoMudar`) e a janela dos comprovantes tinha dois botões "Fechar" (o X e o do rodapé) → **correção:** a chave da ficha saiu da lista de invalidação; o do rodapé virou "Cancelar" / "Deixar para depois". **Lição: gesto que já devolve a leitura nova não invalida a mesma chave; janela tem UM fechar — o rodapé diz o que acontece.**

### E-245

- [2026-11-09] **E-245** (Claude Code, SESSAO-47) · A nota "programado para dd/mm" na barra do calendário saía cortada na coluna de largura padrão ("13841 · Lag… · programa…") — sumia a data, que é o que importa. Os testes passavam (o texto estava no DOM); só a FOTO mostrou → **correção:** na barra, "prog. dd/mm" sem encolher (quem encolhe é o bairro); a frase inteira no detalhe do toque e no texto do leitor de tela. **Lição: texto novo numa linha que trunca se confere na FOTO, na largura padrão — o essencial vem curto e não encolhe.**

### E-258

- [2026-11-11] **E-258** (Claude Code, SESSAO-48 · frente 3) · `eslint <arquivos>` de fora da pasta de trabalho IGNORA os arquivos e sai com 0 ("File ignored because outside of base path" só aparece sem `--no-warn-ignored`) — lint "limpo" que não olhou nada. → **Correção:** o lint da cópia vai pela API do ESLint com `cwd` = a cópia, conferido antes com um texto que TEM de dar erro; na pasta principal, rodar com o shell nela.

### E-265

- [2026-11-11] **E-265** (Claude Code, SESSAO-48) · As fotos de celular (375) tiradas pelo Edge sem janela saíram cortadas à direita, parecendo rolagem lateral — o Edge sem janela não desce abaixo de ~500 px: desenha a página a ~500 e corta a foto em 375. → **Correção:** foto de celular e tablet pelo navegador do app (`resize_window` 375×812 / 768×1024), conferindo `document.documentElement.scrollWidth === innerWidth`, e o arquivo da foto copiado do resultado da ferramenta; o Edge sem janela só para 1440×900.

### E-269

- [2026-11-12] **E-269** (Claude Code, ajuste da SESSAO-48 — o "Atualizar" do tablet) · Pus o botão novo no grupo da direita do cabeçalho do tablet e, no tablet (768), cabia; no celular (375) o grupo (sem `flex-wrap`) passou da tela — o "Sair" foi cortado e a página ganhou rolagem lateral (o navegador alargou a página para 417). → **Correção:** `flex-wrap justify-end` no grupo; medido de novo nos dois tamanhos (`scrollWidth` = largura; no tablet, uma linha só; no celular, duas). **Lição:** botão novo num cabeçalho = medir em 375 ANTES de dar por pronto, mesmo quando o pedido é "para o tablet".

### E-277

- [2026-11-12] **E-277** (Claude Code, SESSAO-50 · frente 4) · Lint: `react-refresh/only-export-components` por exportar auxiliares de um arquivo de componente, e o React Compiler ("Existing memoization could not be preserved") por um callback declarado antes do valor memorizado que ele usa. → **Correção:** os auxiliares (`diasParaSair`, `LACO_PECAS_24H`) foram para `pcpSaida.ts`; o callback desceu para depois do `camposPorPedido`.

### E-279

- [2026-11-12] **E-279** (Claude Code, SESSAO-50 · bloco A) · A vitrine do bloco A mediu tudo errado na 1ª montagem: sem o `@source '../src'` no CSS dela, o Tailwind não gerou as classes das telas (só as do arquivo da vitrine) — larguras e quebras de linha falsas. → **Correção:** `@import '../src/estilos/global.css'; @source '../src';` (o molde da vitrine-s48). **Lição:** vitrine nova = copiar a da sessão anterior, não montar do zero.

### E-283

- [2026-11-12] **E-283** (Claude Code, SESSAO-50 · frente 4) · No tablet (768) o modal "Ocultar do PCP" (largura média, 32rem) pôs os três botões lado a lado e "Ocultar só o pedido" / "Ocultar o pedido e as peças" quebraram em duas linhas cada; na janela do pedido, "Cancelar pedido" quebrou no celular. → **Correção:** com três escolhas de texto longo, um embaixo do outro em todo tamanho; na janela, `whitespace-nowrap` + menos respiro (medido: 36 px de altura, sem transbordar). **Lição (reforça [[Memoria - Front Telas e React 1#E-269|E-269]]):** botão novo = medir em 375 E 768 na vitrine antes de dar por pronto.

### E-115

- [2026-10-19] **E-115** (Claude Code) · Card "infinito" no arrasto do quadro: prender o card arrastado à área visível (modificador) NÃO resolve — o card de verdade anda DENTRO do contêiner rolável, estica a área de rolagem e a rolagem automática corre atrás sem fim → **correção:** arrastar uma CÓPIA flutuante (`DragOverlay` em portal no body, presa à janela), o original fica no lugar apagado, rolagem automática só lateral. **Regra:** em quadro com rolagem própria, arrasto sempre por cópia flutuante.

### E-126

- [2026-10-21] **E-126** (Claude Code, SESSAO-38 · frente da Logística) · Meu script de troca por blocos (`<<<< velho ==== novo >>>>`) não tratava o "novo" VAZIO: o `split` não achava o fim e gravou o marcador `>>>>` no meio de 4 arquivos do site (o tsc ainda não tinha rodado) → **correção:** achado com `grep '^>>>>'` no `src`, linhas tiradas à mão, script corrigido (vazio tratado + recusa se sobrar marcador no texto novo). **Regra:** script de edição em lote se confere com grep do próprio marcador no fim — e o caso vazio é o primeiro a testar.

### E-149

- [2026-10-22] **E-149** (Claude Code, SESSAO-39) · Colunas do calendário como planilha: o 1º desenho já marcava as colunas como "mexidas" ao APERTAR a divisória — a dica ("Arraste a divisória…") virava o botão "Colunas iguais", a linha da legenda mudava de altura, a grade subia ~17 px e o 2º clique do "dois cliques" caía fora da divisória (no mês, nada ajustava; na semana passou por sorte, a dica estava escondida). → **Correção:** nada muda ao apertar — só ao arrastar de verdade (o movimento) ou no ajuste; e só guarda se arrastou. **Regra:** gesto de dois cliques nunca pode ter efeito visual no 1º clique; conferir o "dois cliques" em TODAS as larguras em que a tela muda de arranjo.

### E-232

- [2026-11-06] **E-232** (Claude Code, ajuste dos cabeçalhos) · O dono escreveu "em outras telas você simplesmente exclui o header de cima, deixe isso como padrão em toda a plataforma" e eu li "tirar a barra escura" — era o contrário (a barra que só existia no celular devia existir em TODA tela; no computador ela "não existia") → **correção:** o dono gritou na hora, nada foi escrito do plano errado; a barra virou padrão. **Lição:** quando uma frase do dono pode significar "tirar" ou "pôr" a mesma coisa, olhar o print dele (o que ele vê de diferente entre as telas) e, na dúvida, perguntar em uma linha antes de anunciar.

## 🟢 Acertos que viraram padrão (A-NN)

### A-32

- [2026-09-28] **A-32** (Claude Code) · **Foto do painel com tamanho emulado maior que o painel sai AMPLIADA e CORTADA — prova de camada se mede, não se fotografa.** No preset tablet (768×1024) a imagem veio com 800×1066, mas o conteúdo ampliado ~1,3× (a gaveta de 448px na página ocupava ~583px na foto): o canto inferior direito — onde ficam o balão do chat e a bolha de execução — ficou fora da imagem, e "não aparece na foto" parecia "não está na tela". O que vale: `getBoundingClientRect()` + `document.elementFromPoint(x, y)` no centro do elemento (responde quem recebe o toque naquele ponto, já com z-index, portal e `visibility` resolvidos); a foto fica para o que cabe nela.

### A-49

- [2026-10-02] **A-49** (Claude Code, SESSAO-27) · **O compilador do React (lint `react-hooks/refs`) acusa "ref lida no render" quando uma função que lê `ref.current` é chamada por uma seta criada DENTRO de um `.map` aninhado no JSX** (no `.map` de um nível passava). **Saída limpa:** o elemento diz quem é por `data-*` (`data-de`, `data-saida`) e o tratador é o MESMO para todos (`onPointerDown={aoBaixarSaida}`), lendo `evento.currentTarget.dataset` — nenhuma seta nova no desenho, nenhum `eslint-disable`.

### A-7

- [2026-08-24] **A-07** (Claude Code) · **Classe do Tailwind nunca se monta por interpolação** (`bg-marca-${n}`): o gerador varre texto LITERAL no código — classe montada em tempo de execução não existe no CSS final e o elemento sai transparente. Escrever por extenso. Vale para qualquer ferramenta que gere CSS varrendo o fonte.

### A-8

- [2026-08-24] **A-08** (Claude Code) · **Cor de marca e cor de estado não podem ser da mesma família**: o amarelo Domoby virou cor de AÇÃO, e o 🟡 de qualidade ([[D-009 - Qualidade em 3 estados em TODA transicao com dupla atestacao|D-09]]) foi renderizado em âmbar-laranja. Dois amarelos com sentidos diferentes na mesma tela, sob luz ruim, é erro esperando acontecer.

### A-19

- [2026-09-22] **A-19** (Claude Code) · **Auditoria contra a TELA do sistema-fonte: calibrar a fórmula numa faixa já conferida antes de concluir.** Na auditoria dos 5.360 pedidos (S21), 54 de 55 faixas "divergiram" com contagens idênticas — a única que batia era a já conferida à mão. Era fórmula, não dado: a coluna "Forma de envio" da lista do Tiny é o TIPO de envio, o banco guarda o nome da transportadora. Tirado o campo, 50/55 bateram e sobraram 5 pedidos reais. **Lição: divergência em massa com contagem igual = suspeitar da comparação primeiro; e o rótulo de uma coluna de tela não diz qual campo da API ela mostra (idem entidade HTML "&#39;" decodificada só na tela).** Método que funcionou: extrair a tela por JS em segundo plano (o navegador corta chamada em 45 s), impressão digital por pedido com nome/CPF só em hash, agregado por faixa ([[Memoria - Tiny n8n e Integracoes 1#A-14|A-14]]), abrir só o que diverge.

### A-63

- [2026-10-15] **A-63** (Claude Code, SESSAO-31, validação no site) · **No navegador do app em tamanho emulado (375 px), clicar por coordenada da imagem erra o alvo** (abriu o pedido de cima); clicar pela referência do elemento (`find` → `ref`) acerta. Em emulação, sempre `ref`. E gesto de arrastar que o navegador do app não faz (botão do meio) se prova com eventos de ponteiro disparados na página — sem soltar card em coluna nenhuma.
