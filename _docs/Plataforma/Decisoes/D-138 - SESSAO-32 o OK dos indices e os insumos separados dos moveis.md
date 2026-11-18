---
id: D-138
aliases: [D-138]
titulo: "SESSAO-32: o OK dos índices e os insumos separados dos móveis no estoque"
tipo: decisao
data: 2026-10-16
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [estoque, publicacao-infra]
tags: [decisao, area/estoque, area/publicacao-infra]
---
# D-138 · SESSAO-32: o OK dos índices e os insumos separados dos móveis no estoque (16/10/2026)

**Respostas do dono ao fim da noite (16/10, ~03:05 UTC):**

1. **Os pendentes:** *"Pode aplicar"* — os índices da busca por nome e da lista de Cancelados em Pedidos (com a porta nova por caminhos, que entra junto), os 4 índices das cópias do Tiny (contas a receber e notas fiscais) e a retirada dos 2 índices repetidos.
2. **Os insumos:** *"eles devem contar como estoque, mas eles não devem mais contabilizar como estoque de móveis, mas sim de peças e insumos, logo mais iremos trabalhar com eles, então sim, eles devem continuar sendo utilizados e contabilizados, porém ajuste para que seja da forma correta, tenha em mente que insumo não é móvel, móvel não é peça, peças são insumos e móveis são produtos finais, então as contas devem ser separadas, mesmo que no setor de estoque"*.
   - **Regra:** **móvel = produto final**; **peça é insumo**; as contas de **móveis** e de **peças e insumos** são **separadas**, mesmo dentro do ESTOQUE. Insumo continua contado e usado — só sai da conta dos móveis.
   - Revisa a leitura da [[D-057 - Estoque em duas telas sugestao de minimo pelo top 20|D-57]]/D-70 em que "S simples/revenda" contava como acabado: no Tiny da fábrica, a classe S mistura revenda (cadeira, base…) e insumos (fita, cola, parafuso, luva, thinner…).
3. **Como separar (respostas às 2 perguntas do Claude, 16/10):**
   - *"Faça pelo código fiscal, porém crie também uma tela em configurações que liste tudo de móveis de forma paginada e que dê para um admin alterar os itens entre móvel, insumo e peça, dessa forma, caso algo algum dia acabe nascendo errado, o ajuste é mais simples do que ter que abrir código. Coloque nessa tela também alguns filtros para ajudar na busca de cada coisa."* → o **padrão** vem do Tiny: fabricado e com variação = **móvel**; simples = **móvel só com o código fiscal de móvel** (NCM do capítulo 94 — cadeiras, bases, mesas de revenda), o resto **insumo**; matéria-prima e kit = **insumo** (e a matéria-prima por peça — as peças cortadas de MDF — = **peça**). Uma tela em **Configurações** (admin), paginada e com filtros, muda cada produto entre **móvel, insumo e peça** (e volta ao automático).
   - *"Elas ficam no quadro de estoque, porém na aba de matéria prima e insumos contando normalmente, seja por metro quadrado, ou por quantidade"* → as ~4.765 peças de insumo que a sincronização com o Tiny criou no ESTOQUE **ficam no quadro**; a conta delas sai dos móveis e passa para a aba **Matéria-prima e insumos**, na unidade do produto (m², metro, unidade…).
4. **Como ficou (16/10, ~03:42 UTC — migration 85 + site):** 504 produtos ativos = **201 móveis · 240 insumos · 63 peças** pelo automático; "móveis em estoque" **4.895 → 130** (o resto eram insumos); a aba Matéria-prima e insumos com 303 itens, cada um na sua unidade e dizendo se é insumo, peça, kit ou matéria-prima; a conciliação peça a peça com o Tiny só para móvel (insumo não vira mais um cartão por unidade). Tela: **Configurações → Móveis, insumos e peças** (só admin; busca, filtros por tipo, classe do Tiny, origem e situação; troca e volta ao automático; fica na auditoria).
