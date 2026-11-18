---
id: D-27
aliases: [D-27, D-027]
titulo: "Padrões de interface: menu lateral, modelo de sistema no cofre, microinterações, sem códigos internos"
tipo: decisao
data: 2026-08-28
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [interface]
tags: [decisao, area/interface]
---
# D-27 · Padrões de interface: menu lateral, modelo de sistema no cofre, microinterações, sem códigos internos (28/08/2026)

**Decidido (pedidos do dono em 28/08; entram no escopo da SESSAO-07):**

- **Navegação vira MENU LATERAL** (sidebar) — a barra superior de rotas sai. No celular, a sidebar recolhe (padrão hambúrguer/gaveta); no tablet de setor, o operador continua sem navegar ([[D-006 - Dispositivos tablet PC fixo por setor E celular pessoal|D-06]]).
- **A aba "Design system" sai do aplicativo.** O design system vira **[[PLT - Modelo de Sistema]]** no cofre (`_docs/Plataforma/`), fonte única — o `docs/design-system.md` do repo migra para lá e os dois `CLAUDE.md` passam a apontar o caminho novo. **Nada se constrói fora do modelo de sistema.**
- **Microinteração dos botões interativos:** além do estado atual (fosco), botão ganha **elevação leve ao interagir** — sobe sutilmente (1–2px) com **sombra suave no fundo**. "Coisa leve", nas palavras do dono; vale para o padrão inteiro via componente `Botao`.
- **Códigos internos (D-NN, RF-NN, Q-NN, M-NN) NUNCA em texto visível da interface** — usuário não entende "[[D-009 - Qualidade em 3 estados em TODA transicao com dupla atestacao|D-09]]". Os códigos viram comentário de código (entendimento do Claude); o texto da UI fala a língua do usuário. Inclui **varredura do que já existe**. → promovida a regra no [[CLAUDE - Regras do Claude Code (repo)]].
- **Textos explicativos longos na UI: temporários.** Ficam por ora (o dono quer entender as telas ao revisar), mas **não devem ser mantidos** — enxugar em sessão futura, quando o dono mandar.

**Descartadas:** criar sessão nova só para UI (os ajustes cabem como prelúdio da 07, que já é a sessão de interface); remover os textos explicativos já (o dono pediu para manter por enquanto).
