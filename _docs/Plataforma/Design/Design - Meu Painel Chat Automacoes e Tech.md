---
titulo: "Modelo de sistema — Meu Painel Chat Automacoes e Tech"
tipo: design
assunto: painel
atualizado: 2026-11-18
tags: [plataforma, design-system, modelo-de-sistema, design/painel]
---

# 🧩 Design - Meu Painel Chat Automacoes e Tech

> Parte de [[PLT - Modelo de Sistema]], movida em 18/11/2026 sem reescrever (a numeração das seções é a do documento original). Padrão novo deste assunto entra **aqui**.

### Meu Painel 2.0: filas pessoais, subtarefas e o painel privado (SESSAO-23 / D-51)

- **Três separadores** no Meu Painel (contador + até 3 itens clicáveis, mesmo cartão dos
  blocos da S14): *Delegados a mim* (tarefas do Sistema com prefixo "Sistema · ", tarefas
  delegadas e cards de produção delegados), *Meus afazeres* e *Em execução agora*.
- **Fila de prioridade**: lista numerada com **setas ▲▼ de 44px** (mobile-first — nada que
  dependa só de arrastar); a ordem é preferência do usuário (`plt_usuarios.fila_prioridade`)
  e cada item leva a etiqueta da origem ("produção" em amarelo-ação; "meu"/"delegado" em
  cinza). Reordenar grava a lista inteira de chaves (`t:{id}` / `c:{id}`) — nunca dado da tarefa.
- **Checklist de subtarefas** dentro do card da tarefa: linha expansível "Subtarefas 2/5"
  (contador fica `perfeito-*` quando completo), ○/✔ para concluir/reabrir, campo "nova
  subtarefa…" em cada nível (até dois níveis — a regra é do banco, a UI só reflete a recusa).
- **Privacidade da tarefa pessoal**: chip alternável **"privada" (EyeOff) / "visível" (Eye)**
  no card — só na tarefa que a própria pessoa criou para si. Na criação, o checkbox
  "Visível para a liderança" (desmarcado = privada, o padrão da [[D-051 - Meu Painel 2 0 tres filas subtarefas tarefa privada e|D-51]]).
- **"Ver todos" no sino**: rodapé do popover leva a `/inicio/avisos` — lista completa
  paginada no servidor (`range` + `count` na mesma consulta, regra 17), filho de Início sem
  item de menu (como o Meu Perfil).
- **Meu desempenho** (`/dashboards/meu-desempenho`, primeiro filho de Dashboards, visível a
  TODO papel logado — o gate do dado é do banco: cada um só recebe o próprio): 4 Heróis de
  KPI, barras empilhadas do tempo em afazeres por dia (`--dm-serie-1` = meus, `--dm-serie-2`
  = delegados — nunca o âmbar da qualidade) e a quebra por tarefa paginada. O cabeçalho diz
  em língua de gente que a página é privada.

**↪️ Revisão do dono (23/09) — o padrão virou PREVIEW:**

- **Clicar na demanda abre o `ModalTarefa`** (em vez de navegar ou expandir o card):
  iniciar/parar o tempo, editar título/descrição, concluir/reabrir, o checklist de
  subtarefas e o chip de privacidade vivem TODOS no modal. O card na tela fica compacto
  (título, chips, contador, linha do timer). "Parar" **descarta a contagem** — o rótulo do
  botão avisa. Tarefa do Sistema no preview só explica e aponta o quadro (o gesto é o parecer).
- **Criar é botão primário no topo da tela**, abrindo modal — nada de formulário fixo no
  meio da página. Em **Meus afazeres** a tarefa nova é sempre PARA MIM (com o checkbox
  "Visível para a liderança"); **delegar mora em Afazeres do time** (filha própria de
  Início, `/inicio/afazeres-do-time`, só líder/admin), com "Para quem" (membro ou
  "Sem dono — qualquer um do setor pega").
- **Avisos têm lixeira**: ícone por aviso **já lido** + "Apagar lidas" (popover do sino e
  tela Avisos). Só o próprio e só o lido — o RLS garante (migration 34); o fato segue em
  `plt_eventos`.
- **Grade de amostras (temas do Meu Perfil)**: colunas por `auto-fill/minmax` calibradas
  pelo NOME mais largo — grade de colunas fixas quebrava o rótulo em zoom (mesma lição
  [[Memoria - Front Telas e React 1#E-30|E-30]]: quem manda no tamanho é a largura do cartão).
- **Pausar tarefa GUARDA a contagem** (2ª rodada do dono, 23/09): `tempo_acumulado` no
  banco (RPC `plt_fn_tarefa_pausar` — leitura+escrita atômicas), "Iniciar" vira "Retomar",
  e o tempo total = acumulado + segmento aberto, sempre derivado. Na **Fila de prioridade**
  cada linha de tarefa tem **▶ iniciar/retomar** e, com o tempo rodando, **⏸ pausar** e
  **✓ finalizar** (44px, com o total ao lado).
- **Bolinha flutuante "Em execução agora"**: o bloco saiu do grid do painel e virou o
  botão redondo amarelo, meio transparente, fixo no canto de TODAS as telas (some quando
  nada conta tempo; badge com o total). O clique abre o painel rápido: tarefa rodando com
  **Pausar · Concluir · Ver detalhes** (o preview) e execução de produção com link para o
  quadro do setor.
- **Quadro do PCP sem encerrados no Tiny** (`plt_fn_cards_pedido_pcp`): entregue/não
  entregue sai da coluna de pedidos NA CONSULTA (situação normalizada — [[Memoria - Tiny n8n e Integracoes 1#E-25|E-25]]); cancelado
  fica (aba própria na S24) e as unidades de pedido encerrado seguem normais nos setores.
  **↪️ 28/09 ([[D-075 - O quadrinho do PCP na Visao do dia conta o que o quadro|D-75]]):** o quadrinho do PCP da **Visão do dia** conta o mesmo — "a liberar" =
  os cards do quadro (reposição inclusa) e "mais antiga" = a do quadro; "liberadas hoje"
  ficou como era. Regra de casa: **número de painel que resume uma tela sai do MESMO
  conjunto da porta dessa tela** (o harness amarra os dois) — foi a conta à parte que
  deixou o painel em 233 com o quadro em 33.

### Chat interno (SESSAO-26 / D-65…D-68) — `src/chat/`

- **Balão (`BalaoChat`)**: botão redondo de 56px, `bg-superficie` + borda grafite + sombra (não é o amarelo — não é ação nem marca), ícone de balão e o **badge de não lidas** em `danificado-forte` com número (`99+` a partir de 100 — teto do banco). Nasce **ao lado da bolinha de execução** (88px da direita; no celular, 80px de baixo, acima da faixa do polegar) e **se arrasta** por pointer events (`touch-action: none`; arrasto só depois de 6px — antes é toque). A posição fica no `localStorage` por pessoa (`dm-chat-balao:{id}`), sempre inteira na tela. Some no `/tablet` e na própria tela do Chat.
- **Painel compacto**: ancorado à BORDA DA PÁGINA (lição do sino — nunca no balão, que pode estar em qualquer lugar): no computador `right-4 bottom-4`, 24rem × até 36rem; no celular ocupa a tela abaixo da barra do topo. Cabeçalho com "abrir em tela cheia" (`/inicio/chat?c=`) e fechar (ESC fecha).
- **Lista de conversas**: linha de 56px com avatar (foto/iniciais; `#` para canal; megafone com borda `acao-ativa` para os Avisos gerais), título em negrito quando há não lida, prévia "Você: … / Ana: …" (na particular só o texto), hora ("14:32", "ontem", "27/09") e a pílula de não lidas. Conversa aberta: borda esquerda `acao-ativa`. **5 por página**: a próxima ao rolar até o fim OU no botão "Ver mais conversas" (nada de carregar sozinho).
- **Conversa**: bolhas — a **minha** à direita em `superficie-inversa`/`texto-inverso`; as dos outros à esquerda em `superficie-sutil` com borda, avatar e (canal/avisos) o nome no começo de cada sequência; **aniversário** é um cartão centralizado com `Cake` e borda `acao-ativa`, assinado "Sistema". Separador de dia ("Hoje", "Ontem", "27/09/2026") no fuso de Natal. **10 por página**: "Ver mensagens anteriores" (ou rolar ao topo) traz a página de antes sem pular o que se lê. Compositor: `textarea` que cresce até 128px, **Enter envia / Shift+Enter quebra linha**, botão enviar de 44px. Sem permissão de escrever, o compositor vira uma linha explicando por quê (avisos: "Só quem o admin liberou escreve…").
- **Pessoas / Quem escreve** (`ModalMembros`): lista de 10 em 10 com "Ver mais"; quem administra tira (ícone `UserMinus`, 44px) e põe (seletor com busca no servidor, múltipla escolha com checkbox). Nos Avisos gerais, o mesmo modal lista só quem o admin liberou.
- **Regras de dado (lei do dono — [[D-067 - Chat por websocket leitura so por pagina 10 mensagens 5|D-67]]):** um canal de websocket por pessoa + um por conversa aberta, os dois PRIVADOS, geridos por `src/chat/canais.ts` (um canal por tópico com contagem de quem ouve — `supabase.channel(t)` devolve o canal que já existe e sair é assíncrono; reaproveitar um canal "saindo" faz o `subscribe` não fazer nada, calado). **Assina antes de ler** (nada escapa entre ler e ouvir). O cache do chat leva a pessoa na chave e é apagado ao sair da conta. Sinal do websocket muda a lista e o badge **no cache** (`src/chat/cache.ts`, lógica pura testada) — sem reler. `staleTime: Infinity`, sem refetch por foco/reconexão/intervalo.

### Telas do bloco noturno (SESSÕES 09–12)

- **Selos de pedido** (SESSAO-09): "Cancelado no Tiny" em `danificado-fundo/texto` e
  "Alterado no Tiny após a liberação" em `atencao-fundo/texto` — pílula com ícone + texto
  (nunca só cor), no PCP e na Expedição.
- **Dashboards** (SESSAO-10): tabelas com o componente `Tabela` (paginação padrão);
  durações sempre `tabular-nums`, a ÚTIL em destaque e a bruta no `title` (passar o
  mouse); barras de proporção fila/execução em CSS puro (âmbar = fila/gargalo, verde =
  execução) — nenhuma biblioteca de gráfico nova. Chips de widgets e de dias seguem o
  padrão de checkbox-botão (borda `acao-ativa` + `bg-acao` quando ligado).
- **ROTAS** (SESSAO-11): o card de entrega replica o formato do card real do ClickUp
  (cliente, endereço em linha, complemento, OBS, botões WhatsApp/Mapa); "pronta para
  entrega" ganha borda `acao-ativa` e selo amarelo; confirmação de entrega em DOIS
  toques inline (sem modal).
- **Chave de API** (SESSAO-11): o valor aparece UMA vez num painel de borda `acao-ativa`
  com botão Copiar — nunca mais é exibido.
- **Afazeres** (SESSAO-12): "carga por pessoa" em pílulas com contagem `tabular-nums`;
  reatribuição por `Selecao` inline na linha do card; tarefa em andamento com borda
  `acao-ativa`; card delegado no tablet mostra "para {nome}" (ícone + texto).

### Automações em canvas, Configurações e Super admin (SESSAO-27 / D-99…D-103)

- **Menu:** o pai "Painel admin" virou **Configurações** (`/configuracoes/*`, ícone engrenagem) e nasceu o pai **Super admin** (`/super-admin/*`, ícone `ShieldCheck`) — só aparece para quem tem a marca (o front esconde; o banco nega). Guarda de rota `RotaProtegida nivel="super"`.
- **Seletor de tema rápido** (`src/perfil/SeletorTemaRapido.tsx`): no rodapé da barra 1, no lugar da engrenagem — botão de 44px com `Palette`, que é o gatilho de um Radix Select; a lista abre num **portal** (`z-[56]`, acima da gaveta aberta e abaixo dos avisos), para cima (barra aberta) ou para o lado (barra recolhida), com a bolinha de amostra de cada tema. Aplica na hora e guarda no perfil (o mesmo caminho do Meu Perfil).
- **Etiquetas — paleta própria** (`--dm-etiqueta-{azul,violeta,ciano,rosa,marrom,cinza}-{fundo,borda,texto}` nos claros e na família escura): **nunca** verde/âmbar/vermelho (qualidade — [[Memoria - Front Telas e React 1#A-8|A-08]]) nem amarelo (ação). `<PilulaEtiqueta>` (`src/utilitarios/`) = `Tag` + nome + cor ([[Memoria - Modelos Formulas e Possibilidades#M-12|M-12]]), tamanhos `sm` e `galpao`; `<EtiquetasDoCard ids>` resolve os ids pelo catálogo em cache (`['etiquetas']`). Classes por extenso em `CLASSE_ETIQUETA` ([[Memoria - Front Telas e React 1#A-7|A-07]]).
- **Campos customizados no card:** lista `dl` compacta "Nome: valor" (até 3 no card do quadro/tablet; "+N no histórico"); no histórico do card e no detalhe do pedido, `<CamposDoCard>` com o lápis de editar para o admin e `<EntradaValorCampo>` (texto/número/data/lista/sim-não) — o MESMO componente do painel das automações.
- **Utilitários** (`/configuracoes/utilitarios`): `<Abas>` Etiquetas · Campos customizados (aba na URL `?aba=campos`), listas com Editar/Arquivar/Excluir (excluir só sem uso — o banco recusa e diz para arquivar), modais de cadastro; a cor da etiqueta é escolhida por rádios com a própria pílula de prévia.
- **Canvas das automações** (`src/automacoes/componentes/CanvasAutomacao.tsx` — feito em casa, sem biblioteca): fundo pontilhado (`--dm-borda-forte`), **blocos HTML** de 240px posicionados (o QUANDO com cabeçalho `bg-acao`, os FAÇA com `superficie-sutil`; selecionado = borda `acao-ativa`; **solto** = borda tracejada + selo `atencao-*` "solto — não roda"), **ligações em SVG** (curva com seta; tocar escolhe — borda de ação — e o botão `Unplug` no meio tira). Gestos por ponteiro (mouse e toque, `touch-none`): arrastar o fundo anda; arrastar o cabeçalho move o bloco; arrastar a **bolinha da direita** até outro bloco liga. **Nada só no arrasto:** o "+" (36px) ao lado de cada bloco abre a escolha do próximo bloco (modal em grade com ícone + nome + frase) e já liga; o painel ao lado configura; o teclado seleciona o bloco (Enter/Espaço). Zoom por botões (−/+/caber na tela, 44px) e Ctrl+rodinha (ouvinte não passivo). A lógica (sequência, ligar sem ciclo, inserir no meio, tirar religando) é pura em `src/automacoes/desenho.ts` (Vitest); as frases dos blocos em `resumo.ts` — **nunca código na tela**.
- **↪️ Área de trabalho ([[D-105 - O editor de uma automacao e uma AREA DE TRABALHO menu|D-105]], pedido do dono no teste ao vivo de 02/10):** com uma automação aberta (`?a=`), a casca **recolhe o menu** (trilho de ícones; reabre à vontade; ao sair volta ao lembrado — estado derivado no render, sem efeito), tira o voltar padrão, o rodapé e as bolhas flutuantes, e dá à página a **altura toda** (`h-dvh`; no celular, menos a barra de 60px). O editor: barra fina no topo (voltar 44px · nome editável no lugar · selo · abas **Editor | Execuções** em `tablist` · Salvar · **Publicar** = salva e liga / Desligar · arquivar, com o "tem certeza?" na própria barra), o canvas `cheio` no resto, avisos flutuando no canto superior esquerdo, e a **gaveta do bloco** à direita (`w-full sm:w-[26rem]`, X de 44px, ESC fecha). A aba Execuções troca o canvas pela lista (busca só ao abrir). O texto abaixo descreve a primeira versão (editor dentro da página).
- **↪️ "Se… senão" e a escolha do bloco ([[D-106 - O Se senao a condicao com DUAS saidas cada uma com|D-106]], 02/10):** o bloco de duas saídas tem **duas bolinhas** à direita (a 22px acima e abaixo do meio — espaço para um "+" de 36px em cada), o nome de cada saída como pílula rente à bolinha, dentro do bloco (**Sim** `perfeito-fundo/texto`, **Senão** `danificado-fundo/texto`; cabeçalho e frase ganham `pr-16`), e a bolinha ligada pinta a borda na cor da saída (`perfeito-forte`/`danificado-forte`). O caminho Senão nasce uma linha abaixo (altura do bloco + 56px). **A escolha do próximo bloco** é um `Modal tamanho="galpao"` com **seções por grupo** (título `text-xs uppercase tracking-wide texto-suave`), grade `auto-rows-fr` de 3 colunas (1 no celular), cartões de altura igual: ícone num quadrado `size-9 superficie-sutil`, nome `text-sm font-semibold`, frase `text-xs line-clamp-3` — sem "pulo" no hover (só borda `acao-ativa` + fundo sutil). Quando o "+" é de uma saída, o título diz o caminho ("Que bloco vem no caminho Senão?").
- **↪️ Excluir automação ([[D-107 - Excluir automacao some de vez o que ela fez FICA na Auditoria|D-107]]):** lixeira fantasma (44px, `aria-label` "Excluir a automação") ao lado do arquivar, na barra do editor; o "tem certeza?" na própria barra com o botão **`perigo`** "Sim, excluir"; ao excluir, aviso "Automação excluída — o que ela fez continua na Auditoria" e volta à lista. **Na Auditoria**, linha de automação que já não existe ganha a pílula **"Automação excluída"** (`danificado-fundo/texto`, ícone de lixeira 12px, `text-[11px] font-semibold`) ao lado do título; a marca não aparece nos "Detalhes".
- **Filtros de "ativas / arquivadas"** nas listas de Automações e de Utilitários: **`FiltroPill` "Mostrar"** (o mesmo dos painéis), nunca caixinha de marcar solta — pedido do dono: *"esse modal de select não está no padrão do sistema"*. Caixinha de marcar fica para campo de formulário.
- **Tela das automações** (`/super-admin/automacoes`): a lista (cartões com o selo **Ligada** `perfeito-*` / **Desligada** `superficie-sutil`, a frase do QUANDO, última vez e disparos em 24 h, "Ligar/Desligar" com o "tem certeza?" na própria linha — dois toques, sem caixa do navegador) e o editor (`?a=<id>` ou `?a=nova`): nome + Salvar (desligado quando nada mudou) + Ligar (desligado com mudança não salva ou sem passo), o canvas em grade com o painel de 22rem ao lado (embaixo abaixo de `lg`), o aviso âmbar dos blocos soltos, e **Últimas execuções** (selo da situação com ícone + texto, o que disparou em língua de gente, a condição, cada passo numerado com o resultado, "Trazer de volta" quando a automação arquivou; paginado no servidor). No tablet: lista, liga/desliga e histórico.

### Tech → Sugestão de melhoria (SESSAO-46 / D-260…D-266) — `src/tech/`

- **Bolinha das sugestões** (`BolhaSugestao.tsx`): amarela (`bg-acao`) com a lâmpada, 56 px, arrastável como o balão do chat (posição por pessoa, chave própria no aparelho), de partida à esquerda do chat (direita 160). Número azul (`bg-info-forte`) = sugestões para testar. O toque abre um painel não modal (Esc / toque fora — escuta de captura, [[Memoria - Processo de Sessao Cofre e Dono#E-131|E-131]]): "Sugerir melhoria" (primária), "Para você testar" (até 5, fundo `info`) e "Acompanhar as sugestões". Montada na casca para todo nível; o `/tablet` nem chega à casca.
- **Formulário** (`ModalSugerir.tsx`, `Modal tamanho="galpao"`): 4 blocos, todos obrigatórios — **arquivo** (zona tracejada: Escolher arquivo · Gravar áudio (o `GravadorDeAudio` da janela do card) · Ctrl+V cola o print, que ganha o nome `print-AAAA-MM-DD-HHMMSS.png` · arrastar; a lista com prévia da imagem e "Tirar"), **o que é** (3 botões-rádio grandes com descrição), **texto** (contador "Faltam N letras" → "✓ N letras") e **nível** (10 botões-rádio, 5 por linha no celular, com a faixa em palavras: Pode esperar · Média · Alta · Urgente). O botão de enviar só libera completo e a linha "Para enviar, falta: …" diz o quê. Devolução = o mesmo formulário com tipo e nível marcados.
- **Quadro** (`src/paginas/SugestaoMelhoria.tsx`): o esqueleto dos quadros (coluna 85vw/288 px com `snap`, rolagem POR DENTRO da coluna — `useAlturaAteOFim`), "Ver mais (N)" no pé da coluna. Cartão: `#N` · ícone + tipo · selo do nível (número + faixa para o leitor de tela) · 3 linhas do texto · selo do teste · motivo da recusa (vermelho) · "devolução da #N" · quem/quando · ícones dos tipos de arquivo + quantos. Só o super admin arrasta (mouse 8 px, toque segura 200 ms, teclado Espaço); Enter/toque abre a ficha. Soltar em Recusada abre o motivo. **O cartão é `relative`** ([[Memoria - Front Telas e React 1#E-231|E-231]]).
- **Ficha** (`JanelaSugestao.tsx`, `?sugestao=N` — como a janela do card): selos (coluna · tipo · nível · teste), o bloco azul "Já está no sistema — você pode testar" com **Aprovar** (primária) e **Devolver com nova sugestão**, o motivo da recusa (vermelho), o texto inteiro, as sugestões ligadas (botões), os arquivos (imagem com prévia, áudio e vídeo com player, o resto com "abrir em outra aba"), "Mover para" (só super admin; a coluna atual marcada) e a história.
- **Selos** (`Selos.tsx`): ícone + texto, nunca só cor — coluna (Inbox · ListTodo · Hammer · CircleCheckBig · XCircle), tipo (Bug · Sparkles · Lightbulb), nível (`superficie-sutil` → `info` → `prazo-amarelo` → `danificado`), teste (`info` esperando · `perfeito` aprovada · `atencao` devolvida).
- **Meu painel:** o bloco "Sugestões para você testar" (fundo `info`, acima de "O que me espera") aparece só quando há; a pendência sai de "Delegados a mim" e da fila.
