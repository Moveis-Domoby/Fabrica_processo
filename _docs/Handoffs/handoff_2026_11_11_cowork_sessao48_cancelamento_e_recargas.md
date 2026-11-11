---
titulo: "Handoff do Cowork para o Claude Code — SESSAO-48 (cancelar a fabricação de verdade e a plataforma que recarrega sozinha)"
tipo: handoff
data: 2026-11-11
de: Cowork (mapeamento, só leitura do banco e do código)
para: Claude Code (execução)
demanda: "[[SESSAO-48 - Cancelar Fabricacao de Verdade - Peca de Pedido Pergunta o Destino]]"
status: 📐 pronta para code
tags: [handoff, plataforma, producao, cancelamento, pcp, estoque, publicacao]
---

# Handoff — SESSAO-48: cancelar a fabricação de verdade e as recargas sozinhas

> **Leia a demanda inteira duas vezes:** [[SESSAO-48 - Cancelar Fabricacao de Verdade - Peca de Pedido Pergunta o Destino]]. Ela tem o pedido do dono, as respostas (fechadas, não perguntar de novo), a investigação com números, as cinco frentes, os critérios de aceite, onde mora cada coisa e as decisões provisórias. Este handoff é só o resumo de entrada.

## Por que existe
O dono mostrou em vídeo (10/11) uma Estante Basic 7 nichos contada como "reservada para produção", mas parada na coluna CANCELADO da LIMPEZA E EMBALAGEM há 138 h. Na mesma conversa (11/11), ele pediu também a investigação de por que a plataforma recarrega a tela sozinha.

## O que o Cowork achou (leitura do banco e do código, 11/11 ~01:30)
- **CANCELADO e NÃO ENCONTRADO são etapas comuns.** Tudo nelas conta como produção: **53 das 127 peças em produção (42%)**, espalhadas por 30 móveis. Entre elas estão as 30 peças do 13622 (Em aberto no Tiny), 19 de reposição e 4 de pedidos cancelados.
- **Não existe gesto de cancelar a fabricação.** A liberação do PCP deixa escolher a etapa de destino e mandar o pedido direto para o CANCELADO.
- **Pedido cancelado no Tiny não pergunta nada hoje** (D-61): a peça segue a produção e só vira estoque no fim.
- **Recargas:**
  - toda subida para a main publica o site na Vercel, até quando só mudou documentação (9 publicações entre 09/11 17:34 e 10/11 00:37, quase todas do cofre);
  - a versão é o commit, então cada publicação acende "versão nova", e a próxima troca de tela recarrega;
  - os pedaços da versão velha somem do ar e forçam recarga imediata;
  - houve também recargas **sem publicação** (tablet CNC 13:58 e 14:38 de 10/11; FITAMENTO 5× em 20 s depois de trocar de setor por PIN) que a trilha de hoje não explica.

## O que o dono decidiu (11/11, 01:27 e 01:33)
1. **Sem botão.** Mover para CANCELADO cancela a peça. Ela some da coluna em **7 dias**, fica só o registro da exclusão, e dá para recuperar.
2. **Cancelar a peça não é cancelar o pedido.**
3. **NÃO ENCONTRADO entra nesta sessão**, com o mesmo tratamento.
4. **A vaga da peça de pedido volta ao PCP com um aviso.** No aviso, o PCP pode **remover do PCP** escolhendo: "o pedido foi cancelado", "tirar da linha de produção" (com o que houve) ou "outro motivo".
5. **Investigar e corrigir as recargas sozinhas.**

## As cinco frentes (detalhe na demanda)
1. Mover para CANCELADO/NÃO ENCONTRADO tira a peça da produção (fato novo, regra única de contagem, desfaz arrastando de volta).
2. A vaga volta ao PCP com aviso; a janela "O que aconteceu?" oferece "Produzir de novo" ou "Remover do PCP" com motivo; nasce a aba "Cancelados e removidos".
3. Pedido cancelado no Tiny pergunta o destino dos móveis em produção (seguir para o estoque, passar para outro pedido, cancelar a fabricação).
4. Limpeza dos 7 dias sem relógio novo, e recuperação pela busca geral e pela Auditoria.
5. Recargas:
   - documentação não publica o site;
   - versão pelo código;
   - recarga só em momento seguro no tablet;
   - a abertura grava o porquê;
   - a troca de setor recarrega uma vez só.

Depois vem o **acerto das 53 peças paradas**, só com o OK do dono.

## Cuidados
- **Toda subida para a main publica o site** (até a frente 5 entrar). Código só em branch; nada na main sem o OK do dono.
- Migration, manutenção de dado, mudança no `vercel.json` e publicação: **cada uma com o OK do dono**, em passo separado (regra 2).
- Recrie as funções a partir da **versão viva** do banco, conferindo o md5 do corpo.
- Com o dono: português de gente, sem códigos.

## Tarefas no ClickUp
Listadas na demanda, **a criar com o OK do dono** (o Cowork não criou).
