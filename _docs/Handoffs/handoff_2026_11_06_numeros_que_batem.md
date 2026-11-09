---
titulo: Handoff — 2026-11-06 — Os números que não batiam entre as telas
tipo: handoff
data: 2026-11-06
atualizado: 2026-11-06
tags: [handoff, ajuste, banco, dashboards, rotas, stand-by]
---

# 📋 Handoff — 2026-11-06 — Os números que não batiam entre as telas

Diário completo (causa de cada divergência, decisões técnicas, ensaios): [[AJUSTE - Numeros que batem entre as telas]].

## 1. Objetivo

A varredura de todas as telas do [[handoff_2026_11_06_ajuste_cabecalhos_compactos|ajuste dos cabeçalhos]] achou 4 dados que não batem entre telas, todos calculados no banco e de antes daquele ajuste. Pedido da sessão do ajuste: investigar e corrigir, com o OK do dono antes de aplicar qualquer coisa no banco.

## 2. O que foi feito

### Banco
- `supabase/migrations/20261106030000_plt_numeros_que_batem.sql` — ver [[SUPA - Esquema do Banco]] (entrada "Ajuste de 06/11/2026 — os números que não batiam"):
  1. **"A entregar"** sem o pedido cancelado/excluído no Tiny (o 13686) — D-267.
  2. **Visão do dia = quadro:** fila = a coluna da fila (com o avulso), execução = só quem trabalha agora, a espera vem da fila; "prontos esperando rota" = os candidatos da Programação prontos e sem rota — D-268.
  3. **Stand-by:** o cancelamento no Tiny fecha o stand-by (fato novo, na hora do cancelamento); o 13649 fecha com a hora dele; o painel de Motivos conta igual à aba do PCP — D-269.
  4. **Calendário:** "Fora do calendário" só o que não aparece na grade — D-270.

### Front
- `src/paginas/dashboards/VisaoDoDia.tsx` — a espera mais antiga em horas de expediente (a régua do quadro); "Pedidos prontos esperando rota".

### Edge Functions
- Nenhuma.

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Cancelado sai de "A entregar" (o entregue fica no histórico) | Ficar marcado e sem botões | Resposta do dono |
| Pausado não aparece no painel | "3 pausados" à parte | Resposta do dono |
| Na fila = só a coluna da fila, como o quadro | Mostrar também "parados em outras colunas" | Resposta do dono (precedente D-75: painel = quadro) |
| O cancelamento fecha o stand-by | Só acertar a conta | Resposta do dono — o tempo do 13649 seguia crescendo no ranking |
| Espera em horas na TELA, pela régua | Coluna nova na porta (retorno novo) | Sem `drop function` (E-178); a tela de antes segue funcionando |
| Um gatilho próprio para o fecho do stand-by | Mexer na reação ao pedido | A reação é grande e de várias frentes; as mesmas guardas da validação não deixam derrubar a gravação do Tiny |

## 4. Bugs

### Resolvidos
- Os 4 da seção "Descobertos" do handoff do ajuste dos cabeçalhos (13686 em "A entregar"; Visão do dia × quadros; stand-by 7 × 6; aviso do calendário).

### Descobertos
- O pedido que o Tiny leva adiante (faturado, pronto para envio, enviado) em stand-by sai da aba (D-169), mas o stand-by segue aberto por dentro — hoje nenhum. Fica anotado na D-269.

## 5. Arquivos alterados

```
supabase/migrations/20261106030000_plt_numeros_que_batem.sql (novo)
supabase/testes/testar-migrations.mjs (bloco novo + cadeia do bloco 38 + teste antigo do retrato de agora)
src/paginas/dashboards/VisaoDoDia.tsx
_docs/Plataforma/PLT - Decisoes de Produto.md · PLT - Memoria de Aprendizado.md · PLT - Lei de Desempenho e Escala.md
_docs/Plataforma/Execucao/AJUSTE - Numeros que batem entre as telas.md (+ dados/ ensaio ×100)
_docs/Supabase-fabrica/SUPA - Esquema do Banco.md · _docs/000 - MAPA DO PROJETO.md
```

## 6. Impacto nos números visíveis

| Tela | Número | Antes → depois (06/11, banco vivo) | Por quê |
|---|---|---|---|
| ROTAS → Entregas → A entregar | lista | 13686 some | cancelado no Tiny |
| Visão do dia · Limpeza | na fila | 84 → 38 | só a coluna da fila, com os 2 avulsos |
| Visão do dia · SECC / Fitamento / Furação | na fila | 1/7/6 → 2/9/7 | o card avulso entra |
| Visão do dia | em execução agora | 3 → 0 (às 06:30) | os 3 estavam pausados |
| Visão do dia | espera mais antiga | dias corridos → horas de expediente | a régua do quadro |
| Visão do dia | prontos esperando rota (era "aguardando lançamento") | 16 → 12 | os 4 programados saem |
| Dashboards → Motivos | em stand-by agora | 7 → 6 | o 13649 fecha (cancelado) |
| Programação → Calendário (semana 02–08/11) | fora do calendário | 6 → 3 (+1 sem previsão) | os 3 da grade saem |

## 7. Notas do cofre atualizadas

- [[PLT - Decisoes de Produto]] — D-267…D-270
- [[PLT - Memoria de Aprendizado]] — E-233, E-234, A-196, A-197
- [[SUPA - Esquema do Banco]] · [[PLT - Lei de Desempenho e Escala]] (§14) · [[AJUSTE - Numeros que batem entre as telas]] · [[000 - MAPA DO PROJETO]]

## 8. Ficou pendente

- (preencher no fim)
