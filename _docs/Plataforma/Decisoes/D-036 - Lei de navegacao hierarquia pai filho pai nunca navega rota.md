---
id: D-36
aliases: [D-36, D-036]
titulo: "Lei de navegação: hierarquia pai→filho, pai nunca navega, rota sempre /pai/filho"
tipo: decisao
data: 2026-08-28
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [interface]
tags: [decisao, area/interface]
---
# D-36 · Lei de navegação: hierarquia pai→filho, pai nunca navega, rota sempre /pai/filho (28/08/2026)

**Decidido (palavras do dono):** *"layout nunca é colocado e pensado fora do padrão, um filho sempre será herdeiro do pai; o pai nunca é uma rota navegável, ela apenas direciona para os filhos no padrão /pai/filho; nenhuma rota acessa direto a raiz — /entrar → /inicio/meu-painel."*

- Sidebar em **dois níveis**: o grupo pai expande os filhos em cascata; clicar no pai NUNCA abre página própria.
- Estrutura: **Início** (Meu painel · Afazeres) · **Controle de Produção** (um filho por setor cadastrado, dinâmico — substitui a aba "PCP") · **Logística** (Expedição · Estoque · Pedidos em aguardo · Danificados) · **ROTAS** · **Dashboards** · **Administração** (dropdown: Gestão da equipe · Setores e etapas · Controle de tempo · API e integrações · Caminhões). **Equipe e Estrutura deixam de ser abas de 1º nível** — viram filhos de Administração.
- A sidebar **persiste em todas as telas** (inclusive quadros de setor), com botão de **recolher/expandir**; estado lembrado.
- **Toda tela tem botão de voltar** (à aba anterior).
- **"Modo tablet"** (a antiga aba "Tela do setor") vira botão fixo na sidebar, logo acima do bloco do usuário.
- **Sino de notificações no topo** (junto à logo); no rodapé, **Configurações** no lugar do sino; o popover de notificações **nunca é cortado pela tela**.
- Login desemboca sempre em `/inicio/meu-painel`.
- Lei promovida aos dois `CLAUDE.md` (regra 16).
