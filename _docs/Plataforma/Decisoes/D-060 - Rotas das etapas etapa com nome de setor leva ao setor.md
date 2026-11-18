---
id: D-60
aliases: [D-60, D-060]
titulo: "Rotas das etapas: etapa com nome de setor leva ao setor; CONCLUÍDO leva ao próximo — SECC e CNC mandam para a FURAÇÃO"
tipo: decisao
data: 2026-09-27
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [kanban-producao]
tags: [decisao, area/kanban-producao]
---
# D-60 · Rotas das etapas: etapa com nome de setor leva ao setor; CONCLUÍDO leva ao próximo — SECC e CNC mandam para a FURAÇÃO (27/09/2026)

**Decidido (respostas do dono na SESSAO-24):** *"etapa com nome de setor move o card para o setor"*; *"a etapa CONCLUÍDO de SECC e CNC manda para FURAÇÃO, o concluído dos outros setores manda sempre para o próximo (SECC e CNC são 2 máquinas diferentes que fazem praticamente a mesma coisa: cortam uma chapa de MDF de acordo com o plano de corte feito no SketchUp; a diferença é que a CNC também fura a peça, a SECC não)"*; "CENTRO DE FURAÇÃO" = setor FURAÇÃO.

- **Etapa com nome de setor de produção** (herança do ClickUp — em todos os quadros e também no PCP) leva ao setor do nome. **"CENTRO DE FURAÇÃO" → FURAÇÃO.**
- **CONCLUÍDO:** SECC → FURAÇÃO · CNC → FURAÇÃO · FITAMENTO → FURAÇÃO · FURAÇÃO → MONTAGEM · MONTAGEM → LIMPEZA E EMBALAGEM ("o próximo" pela ordem cadastrada dos setores — confirmado pelo dono na prévia: *"Sim, está certo"*).
- A LIMPEZA E EMBALAGEM não tem rota: as etapas ESTOQUE, EXPEDIÇÃO, CANCELADO, NÃO ENCONTRADO e ENTREGUE ficam etapas comuns — o fim de linha é o **Concluir produção** ([[D-059 - Quadros de producao so por arrasto o unico botao e Concluir|D-59]]).
- **É dado do dono, não código:** editável em **Setores e etapas** ("Soltar o card em {etapa} manda para…"); etapa nova com nome de setor já nasce com a rota. A carga inicial (20 etapas) só preencheu etapa sem rota — reaplicar nunca desfaz edição do admin.
