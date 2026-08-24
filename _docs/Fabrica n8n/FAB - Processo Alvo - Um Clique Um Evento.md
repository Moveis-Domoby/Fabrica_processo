---
titulo: Fábrica — Processo Alvo: um clique, um evento
tipo: visao
data: 2026-08-13
atualizado: 2026-08-13
tags: [fabrica, visao, processo, refatoracao, producao, logistica]
---

# 🎯 Processo Alvo — "um clique, um evento"

> [!abstract] De onde veio esta nota
> Visão declarada pelo dono em 13/08/2026, nas palavras dele, estruturada aqui. É **o critério de projeto** para toda plataforma operacional deste cofre: qualquer ideia da [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]] deve ser julgada contra esta nota.

## O diagnóstico, nas palavras do dono

O processo hoje é **arcaico**: movimentação manual de cards, dados dos quadros não confiáveis, e as únicas automações são as do n8n mais regras triviais do Trello ("moveu para coluna X → arquiva e recria no quadro Y"). A logística carrega o peso disso: **precisa olhar tudo e descobrir onde cada coisa está**, usando tags internas nos móveis e no estoque — **nada visível num lugar só**.

## A visão-alvo

> O trabalho humano vira **no máximo um clique por acontecimento** — e esse clique é o **gatilho** de tudo que é automatizável.

Exemplo canônico (do dono): *"pedido X acabou de passar pela CNC → cliquei o botão → já abre um timer para o fitamento; finalizou o fitamento → clique → abre o timer da furação; e assim por diante, até chegar na logística"*.

### Os quatro princípios que isso implica

1. **Um clique = um evento.** O operador não move card, não preenche campo, não lembra de nada — ele declara "terminei" com um clique (botão, QR, tablet do setor). Todo o resto (fechar timer do setor atual, abrir o do próximo, mover o registro, avisar quem precisa) é consequência automática.
2. **O roteiro é do produto, não da pessoa.** Cada produto tem seu caminho de setores definido no catálogo — e **etapas são puladas automaticamente**: móvel que não precisa de montagem vai direto da furação para a embalagem; item de metalurgia entra no ponto certo. Ninguém decide "para onde vai agora" no dia a dia; o sistema já sabe.
3. **O timer nasce e morre sozinho.** O clique de saída de um setor é o clique de entrada da fila do próximo. Tempo por setor, fila e "parado há X dias" viram subproduto natural — sem power-up, sem disciplina extra.
4. **A logística só faz logística.** Um **cockpit único** mostra: o que está pronto, ONDE está (posição física), o que falta para cada pedido ficar completo, o que já pode ser roteirizado. Nada de caçar peça por tags espalhadas. O trabalho vira decidir carga e rota — não investigar.

## O modelo de dados que sustenta isso (esboço)

```
produto      → roteiro de setores (com etapas opcionais), dimensões, volumes
unidade      → pedido, produto, (k/n), status atual, posição física
evento       → unidade, setor, tipo (entrou/saiu/parado/danificado), timestamp, quem
pedido       → unidades, previsão, completude (todas as unidades prontas?)
rota/carga   → pedidos completos, caminhão, motorista, sequência
```

O `evento` é a tabela-mãe: o clique grava um evento, e **tudo o mais é derivado** — timers, filas, dashboards, alertas, o cockpit da logística. (Fica no Supabase; o n8n é o barramento que recebe os cliques e dispara as consequências. Trello/ClickUp viram interface opcional, não fonte de verdade.)

## O que isso muda nas ideias do handoff

- **C (QR/rastreio)** e **D (tempos)** deixam de ser ideias separadas: são **a mesma coisa** — o clique é o gesto, o evento é o registro, o timer é derivado.
- **A (catálogo com roteiro por produto)** vira pré-requisito duro: é o roteiro que permite pular etapas.
- **F (logística)** começa pelo **cockpit** (visibilidade única), não pelo app do motorista.
- Trello Butler e as listas-espelho entre quadros são **substituídos**, não replicados.

## Dores ainda em aberto (o dono sinalizou que há mais)

O dono encerrou com *"ainda temos muitas dores quanto a isso"* — esta nota cobre a visão geral, mas **o inventário de dores da logística não está completo**. Próxima sessão de mapeamento: sentar com a logística e listar, uma a uma, o que hoje exige "olhar tudo".

## Ver também

[[FAB - Estrutura de Producao (Trello e ClickUp)]] · [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]] · [[N8N - Visao Geral da Migracao]]
