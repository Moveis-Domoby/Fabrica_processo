---
id: D-18
aliases: [D-18, D-018]
titulo: "Fins de linha: ESTOQUE e ROTAS nascem juntos"
tipo: decisao
data: 2026-08-26
status: revisada
revisa: []
revisada_por: ["[[D-058 - O lugar da peca pronta com pedido Pedidos em aguardo|D-58]]"]
complementa: []
area: [estoque, logistica-rotas]
tags: [decisao, area/estoque, area/logistica-rotas]
---
# D-18 · Fins de linha: ESTOQUE e ROTAS nascem juntos (26/08/2026)

**↩️ revisada em 2026-09-27 ([[D-058 - O lugar da peca pronta com pedido Pedidos em aguardo|D-58]]):** nasceu o 10º setor, o fim de linha interno PEDIDOS EM AGUARDO (a aba que já existia virou o lugar da peça pronta de pedido).

**Contexto — contradição encontrada ao codar a SESSAO-02:** a [[D-013 - Entrada unica e saidas terminais do fluxo|D-13]] diz que o card termina em ESTOQUE ou ROTAS, mas a lista de setores do dia 1 da [[D-012 - Setores do dia 1 os do ClickUp estrutura em 2 niveis|D-12]] (copiada do ClickUp) não tem nenhum dos dois, e a [[D-005 - Escopo producao primeiro logistica depois|D-05]] mantém a ROTAS no ClickUp na fase 1. O Claude Code parou e perguntou em vez de escolher.

**Decidido (palavras do dono):** *"coloque o setor de rotas nos primórdios de criação então"*.

- O seed nasce com **9 setores**: PCP (entrada) · SECC · CNC · FITAMENTO · FURAÇÃO · MONTAGEM · LIMPEZA E EMBALAGEM (produção) · **ESTOQUE** e **ROTAS** (terminais).
- A ROTAS existe na plataforma como **setor terminal de handoff**: o card chega nela e a ponte do n8n cria o card na ROTAS do ClickUp enquanto a logística viver lá (D-05). Quando a logística migrar, **nada na estrutura muda**.
- Isso **responde a Q-28** e desbloqueia a SESSAO-04.

**Descartada:** deixar só ESTOQUE como terminal na plataforma, com a ROTAS inteiramente fora — o dono preferiu já ter o fim de linha completo desenhado desde o começo.
