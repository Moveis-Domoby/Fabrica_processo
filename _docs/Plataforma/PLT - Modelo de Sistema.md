---
titulo: PLT — Modelo de Sistema (o design system da plataforma)
tipo: modelo-de-sistema
data: 2026-08-24
atualizado: 2026-11-18
tags: [plataforma, design-system, modelo-de-sistema, ui]
---

# 🧩 PLT — Modelo de Sistema — Plataforma de Produção Domoby

> [!danger] Fonte única do padrão visual ([[D-027 - Padroes de interface menu lateral modelo de sistema no cofre|D-27]])
> Este documento morava no repositório como `docs/design-system.md` e **migrou para o cofre na SESSAO-07** (D-27): aqui é a fonte única. **Nada se constrói fora do modelo de sistema.** Toda tela nova segue este documento; componente novo só quando não existir equivalente — e entra nesta nota junto com a regra de uso. A antiga rota `/design` do aplicativo foi removida na mesma sessão.

---

> [!info] ↪️ 18/11/2026 (SESSAO-49) — este arquivo virou o ÍNDICE
> O modelo de sistema mora agora em `Plataforma/Design/`, dividido por assunto, com o texto original intacto. O essencial de uma página (cores, componentes que existem, regras de tela) está em [[000 - REGRAS DE OURO]]. **Tela nova:** leia as Regras de Ouro e só a nota do assunto que a tela toca.

## Onde está cada assunto

- [[Design - Fundamentos Tokens e Componentes Base]] — 1. Para quem esta interface é · 2. A marca · Regra de ouro do amarelo · 3. Tokens · Cor semântica → utilidade · Estados de qualidade · Cores de série dos gráficos · Número dentro de cartão: container query, nunca breakpoint · Ajuste a zoom e a tela grande · Tipografia · Alvos de toque · Raio e sombra · 4. Componentes base · <Botao> · <Campo> · <Selecao> · <Modal> · <BadgeEstado> · <ProvedorNotificacao> + useNotificacao · Lei de requisição · <Tabela> · 5. Regras de escrita da interface · 6. Convenção de nomes no código · 7. Acessibilidade · 8. Estrutura de pastas · 9. O que ainda está em aberto
- [[Design - Kanban Execucao e Qualidade]] — Componentes do kanban · Execução e linha do tempo · Pausa por líder e tempo em PCP no card · Qualidade nas transições · Quadro por arrasto, fins de linha e cancelados · Controle de tempo do admin · Kanban completo · Cancelar a fabricação de verdade
- [[Design - Meu Painel Chat Automacoes e Tech]] — Meu Painel 2.0: filas pessoais, subtarefas e o painel privado · Chat interno · Telas do bloco noturno · Automações em canvas, Configurações e Super admin · Tech → Sugestão de melhoria
- [[Design - Navegacao Menu Cabecalho e Perfil]] — Menu lateral e tela do setor · Navegação em duas barras, temas e Meu Perfil · A plataforma como aplicativo · Aviso de versão nova · Lançar qualquer produto, o filtro dos quadros e a busca geral · Cabeçalho da tela e menu compacto
- [[Design - Logistica ROTAS e Pedidos]] — Logística, ROTAS e caminhões · Área Pedidos · Calendário, Google Maps/Waze, Mover e o painel de motivos · Tablet que não cai, quadro com rolagem na coluna, senha, entrega parcial, parada avulsa, endereço e data · Entrega parcial que mantém a produção e "Mover para o PCP"
- [[Design - Estoque e PCP]] — Estoque completo e reposição · Estoque enxuto: Top 20+, contagem da logística, configurações e foto · Observação do item, Cancelar e Ocultar no PCP e editar o endereço
