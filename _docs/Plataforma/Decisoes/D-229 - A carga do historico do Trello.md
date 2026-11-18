---
id: D-229
aliases: [D-229]
titulo: "A carga do histórico do Trello"
tipo: decisao
data: 2026-11-05
status: provisoria
revisa: []
revisada_por: []
complementa: []
area: [tempos-paineis, tiny-n8n]
tags: [decisao, area/tempos-paineis, area/tiny-n8n, provisoria]
---
# D-229 · ⏳ PROVISÓRIA — A carga do histórico do Trello (05/11/2026, SESSAO-43)

1. **Mesma conta da plataforma:** janelas do setor (expediente com almoço, feriado, dia trabalhado) até o corte do fim do dia; mínimo e teto do setor; "longo para o modelo" = acima do fator do setor × a mediana do **próprio histórico** daquele modelo (só com a base mínima de montagens); o lote dividido.
2. **Sábado com montagem** no Trello vira **dia trabalhado** do setor no calendário — só esses sábados, com as faixas de uma sexta do setor.
3. **Lote** = cartões do mesmo setor com início e fim **idênticos** (o tempo dividido pelo número de cartões). No arquivo real são **9 lotes** (18 cartões) — dos "15 lotes / 30 cartões" da demanda, os outros 6 eram os cartões repetidos (que entram uma vez).
4. **Montador pela etiqueta:** a etiqueta casa com a pessoa da **equipe no painel daquele setor** pelo primeiro nome (palavra inteira, sem acento); o segundo nome desempata; titular vence apoio (sem titular, vale o apoio); dois titulares = dupla, esforço dividido. Etiqueta de quem não está na equipe do setor é **ignorada** (o relatório lista quais — hoje *ANDERSON* e outras sem pessoa cadastrada).
5. **Modelo pela chave da plataforma** (o nome limpo); o que não casar fica **sem modelo** e aparece em Configurações → Controle de tempo → Modelos → **"Nomes do Trello sem modelo"**, onde o admin liga a um modelo existente ou cria um — e o nome ligado passa a valer também para a plataforma.
6. Os **cartões repetidos** entram uma vez (o mesmo cartão é atualizado; a decisão manual fica). A carga roda de novo sem duplicar.
