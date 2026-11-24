---
titulo: "Memória de aprendizado — Front Telas e React (parte 2 de 2)"
tipo: memoria-tema
tema: front-react
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/front-react]
---

# 🧠 Memoria - Front Telas e React 2

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🟢 Acertos que viraram padrão (A-NN)

### A-106

- [2026-10-22] **A-106** (Claude Code, SESSAO-39) · **"Ajustar ao maior texto" (o dois cliques do Excel) sem medir fonte:** a coluna da grade vira `max-content` por um instante — dentro de `flushSync` (o React pinta na hora, no próprio clique) —, lê-se a largura que o navegador deu (`getBoundingClientRect`) e ela vira a largura fixa da coluna. Funciona com truncamento (`truncate`/`min-w-0` só mexem no mínimo, não no máximo) e com grade de várias linhas (o mês: a trilha mede todas as células da coluna). Sem efeito (`useLayoutEffect`) — a regra `set-state-in-effect` do lint não reclama. A largura de cada coluna mora numa variável CSS (`grid-cols-(--colunas)` sob a mesma consulta de container da grade) — assim o celular, que empilha os dias, não herda as larguras.

### A-117

- [2026-10-27] **A-117** (Claude Code, SESSAO-41) · **Conferir layout de tela logada sem login:** uma vitrine TEMPORÁRIA (um `.html` de entrada + um `.tsx` com dados de mentira e os provedores da casa, servido pelo Vite) — medir pelo JS (altura da página × janela, rolagem da lista) e foto; apagar antes do commit.

### A-193

- [2026-11-06] **A-193** (Claude Code, ajuste dos cabeçalhos) · **Mudança visual em TODAS as telas = um componente + frentes paralelas por grupo de arquivos.** O `CabecalhoDaTela` nasceu primeiro (eu), depois 3 subagentes (Início/Config/Admin · Fábrica/Rotas/Pedidos · Painéis/Comercial), cada um dono só dos seus arquivos, sem commit, com o mesmo brief de regras — ~40 telas em ~7 min, `tsc`/lint/testes verdes na primeira junção. O que fez funcionar: a lista de arquivos de cada frente explícita, "arquivos meus" proibidos, e auditoria final por rota (toda tela da casca com o cabeçalho → todo voltar no lugar).

### A-195

- [2026-11-06] **A-195** (Claude Code, ajuste dos cabeçalhos) · **Ver a tela de login sem deslogar o dono:** abrir o servidor local por `http://127.0.0.1:5173/entrar` (em vez de `localhost`) numa aba nova do navegador do app — origem diferente = armazenamento diferente = sem sessão; a do dono fica intacta. Fechar a aba no fim. E: falha no ensaio do banco que não tem a ver com a mudança → rodar o ensaio de novo SEM o arquivo novo (mover para fora da pasta e voltar) antes de culpar ou de esconder — as 2 falhas de 06/11 já existiam.

### A-227

- [2026-11-12] **A-227** (Claude Code, SESSAO-50 · bloco A) · **Medir layout sem o navegador do app (ele recusa `file://`):** montar a vitrine num HTML só, abrir no Edge sem janela uma MOLDURA com iframes nas larguras exatas (375, 768, 1440) e cada iframe manda as medidas por `postMessage` (rolagem lateral, a faixa dentro do card, linhas, se cortou); o `--dump-dom` devolve as medidas e o `--screenshot` a foto de tudo de uma vez.

### A-231

- [2026-11-12] **A-231** (Claude Code, SESSAO-50 · bloco C) · **Cópias com o `node_modules` em junção dividem o estado do `tsc -b`** (`node_modules/.tmp/tsconfig.*.tsbuildinfo`): o verde de uma cópia pode ser o estado de outra. Nas cópias, `tsc -p` (confere tudo, não grava estado); na pasta principal, depois de juntar, `tsc -b --force` uma vez antes de confiar no verde.

### A-232

- [2026-11-12] **A-232** (Claude Code, SESSAO-50 · bloco C) · **Balão do Leaflet com botão no celular:** `maxWidth` menor (240) e `autoPanPaddingTopLeft` para o mapa andar até o balão sair de baixo dos controles do topo — o balão padrão (300 px) passava da borda e o título ficava embaixo do "Expandir". E o gesto que abre uma janela recolhe a tela cheia do mapa antes (senão a janela abre por baixo).

### A-233

- [2026-11-12] **A-233** (Claude Code, SESSAO-50 · bloco C) · **Botão dentro de `<label>` marca a caixa do rótulo:** no "Editar" da linha com caixa de seleção, `preventDefault` + `stopPropagation` no clique do botão.

### A-240

- [2026-11-17] **A-240** (Claude Code, SESSAO-51) · **Botão da casa com texto longo: `h-auto!`, não `h-auto`.** O `Botao` fixa a altura (`h-toque-md`) e a junção de classes (`twMerge`) não reconhece as alturas da casa — mantém as duas, e a da casa vence: o texto que quebra em duas linhas no celular vaza do botão. Com `className="h-auto! min-h-toque-md py-2 whitespace-normal"` o botão cresce junto (conferido no estilo calculado: 44 → 66 px). Só onde o texto é longo de verdade.

### E-299

- [2026-11-18] **E-299** (Claude Code, SESSAO-53) · **`shrink-0` em frase longa dentro de linha que quebra = rolagem lateral no celular.** *Correção:* tirar o `shrink-0` da frase e medir `scrollWidth` na tela inteira, não só no pedaço novo.

### A-254

- [2026-11-18] **A-254** (Claude Code, SESSAO-54) · **O título do `<Modal>` em teste:** o modal da casa repete o título numa descrição escondida para leitor de tela — procurar o título por papel (`getByRole('heading')`), não por texto.

### A-255

- [2026-11-18] **A-255** (Claude Code, SESSAO-55) · **Porta de abertura que semeia:** a porta traz os pedaços com vida própria no guardado só quando faltam, guarda com a chave e o formato de sempre e a consulta do pedaço liga só depois da porta, **com validade infinita** — quem decide renovar é a porta. Molde: `src/lib/semear.ts`.

### A-256

- [2026-11-18] **A-256** (Claude Code, SESSAO-55) · **Um retrato por tela na mesma chave:** o retrato diz para qual tela foi lido; a tela que acha o retrato de outra pede o dela (1 leitura).

### E-308

- [2026-11-18] **E-308** (Claude Code, SESSAO-55) · **Consulta semeada com validade curta relê sozinha quando a tela volta** (a porta responde do guardado; a dependente está vencida). *Correção:* validade infinita no pedaço semeado.
