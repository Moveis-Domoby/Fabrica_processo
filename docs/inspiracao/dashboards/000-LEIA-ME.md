# Inspiração — Dashboards de Produção (SESSAO-16)

> Gerado pelo Cowork em 28/08/2026 a pedido do dono ("isso não é uma dashboard").
> As 4 imagens desta pasta são **mockups-alvo no design system Domoby**, feitos para o
> Claude Code ABRIR E OLHAR antes de codar a SESSAO-16. Não são pixel-perfect
> obrigatórios — são a régua de qualidade visual e de conteúdo. Os dados são fictícios.

## O que cada imagem ensina

| Arquivo | O que copiar |
|---|---|
| `01-visao-do-dia.png` | A tela de abertura estilo **andon**: 4 números-herói gigantes (concluídas, em execução, na fila, 🔴 danificados), tiles por setor com fila/execução/espera mais antiga, o **gargalo gritando** (borda laranja + badge), produção por hora com linha de média, destinos do fim de linha. É a tela que faria sentido numa TV do galpão. |
| `02-tempo-por-setor.png` | **Tempo em 1º lugar (D-32)**: barra empilhada horizontal fila (azul) vs execução (âmbar) por setor, ordenada do pior para o melhor, rótulos diretos ("2h35 fila · 38min execução"), stat-herói "a fila é 62% do tempo", callout do gargalo, tendência de 6 semanas. |
| `03-pessoas-produtividade.png` | Ranking de pessoas com rótulo direto + tempo médio/unidade como coluna secundária; ao lado, o **cockpit de metas** (indicador configurável, barra de progresso com marco do "alvo de hoje" — mesmo componente do Meu Painel). |
| `04-qualidade.png` | Barras 100% por setor com os 3 estados D-09 (verde/laranja/vermelho com vão de 2px entre segmentos), herói "96,2% saíram 🟢", lista dos danificados em aberto. Estado NUNCA só por cor — ícone + rótulo sempre. |

## Regras de construção (valem para TODA visualização da plataforma)

1. **Número-herói antes de gráfico.** Se a pergunta tem UMA resposta ("quantas hoje?"),
   a resposta é um número grande com contexto embaixo — não um gráfico.
2. **Cores por função, validadas.** Séries categóricas: **execução = `#b8851e`**
   (âmbar da marca, passo 700 — o 500 não tem contraste em fundo branco) e
   **fila = `#2563eb`** (azul info). Par validado (CVD ΔE 32,6 · contraste ≥ 3:1).
   Verde/laranja/vermelho são EXCLUSIVOS dos estados de qualidade (D-09) — nunca
   viram "série 4". Sequencial = um matiz só, claro→escuro. Nunca arco-íris.
3. **Marcas finas, ponta arredondada (4px) só no lado do dado**, base reta; vão de
   2px entre segmentos empilhados; grid recessivo (`#efeff0`); UM eixo por gráfico —
   nunca dois eixos y.
4. **Rótulo direto e seletivo** (o total na ponta da barra, o pico da série), não um
   número em cada ponto. Texto sempre em cor de texto, nunca na cor da série.
5. **Legenda sempre que houver ≥ 2 séries**; 1 série não tem legenda (o título nomeia).
6. **Filtros numa linha acima dos gráficos** (período, setor, bruto/útil), estilo pill.
7. **Hover em tudo** (tooltip por barra/ponto) — as imagens são estáticas, a
   plataforma não deve ser.
8. **Barra superior grafite** com logo Domoby, nome da tela e "atualizado às HH:MM".
9. Ordenar barras pelo valor (pior primeiro quando o assunto é dor: fila, danificado).
10. Cada gráfico responde UMA pergunta do dono, nomeada no título em linguagem de
    fábrica ("Como as peças saem de cada setor"), nunca jargão ("Distribuição de status").

## Referências de gênero (para buscar mais inspiração)

Andon boards / TV de fábrica · Evocon (OEE por turno) · Grafana manufacturing
dashboards · "shop floor management dashboards". O que TODOS têm em comum: números
grandes legíveis a 5 metros, pouquíssimas cores, o problema do dia impossível de
não ver.
