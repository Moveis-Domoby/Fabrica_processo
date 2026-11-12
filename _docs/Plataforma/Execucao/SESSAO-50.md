---
titulo: "Diário — SESSAO-50 · observação do item na capa, Cancelar e Ocultar no PCP (o excluído no Tiny sai de vez) e editar o endereço da parada"
tipo: execucao
data: 2026-11-12
tags: [execucao, sessao-50, kanban, pcp, tiny, rotas]
---

# Diário — SESSAO-50 (12/11/2026, madrugada)

Demanda: [[SESSAO-50 - Observacao do Item Cancelar e Ocultar no PCP e Editar Endereco da Parada]] · ramo `sessao-50-observacao-pcp-endereco` (nascido da main `b7e9343`, pasta principal — nenhuma outra sessão ativa nela às 01:55).

## Partida (12/11 ~01:55)

- O texto da demanda não estava em lugar nenhum que a sessão alcança (pastas, Drive, ClickUp, documentos do Claude) → perguntado ao dono; ele salvou o arquivo na pasta das demandas e o ligou na ordem das sessões (01:55). O número **50 está livre** em todas as cópias (pasta principal, a cópia da 46, todos os ramos locais e remotos).
- O prompt colado pelo dono era o de ANTES das respostas da 01:25/01:30 (falava em perguntar "os outros 2 pedidos do bloco B" e no "acerto do 13622"). A demanda salva é a versão nova: **o outro caso é o 13270** (sem acerto automático, decide o PCP pelo botão novo) e **o 13622 sai sozinho** (sem acerto). Segui a demanda salva — ela diz que as respostas de 12/11 valem por cima.
- A SESSAO-49 (dieta da documentação) **não está na main** (só a demanda) → leitura completa pelo CLAUDE.md de hoje: regras, memória de aprendizado (lições de banco, Tiny, front e as mais recentes E-241…E-269, A-190…A-222), decisões (D-01…D-17 e as citadas: D-27, D-40, D-50, D-61, D-63, D-75, D-93, D-113/114, D-132…D-134, D-140, D-148, D-193…D-196, D-212…D-221, D-267…D-306), visão, requisitos, lei de desempenho (§1–§13), modelo de sistema (marca, tokens, componentes, kanban, SESSAO-41 e 48), esquema (os trechos das tabelas e portas tocadas), perguntas em aberto, mapa, handoff da 48.
- **Leitura do banco de produção:** barrada pelo ambiente; o dono autorizou na conversa (*"Pode ler (só leitura)"*, ~02:20). Programa `scratchpad/s50/ler.mjs`: transação `READ ONLY` + `ROLLBACK`, nada gravado.
- **~02:35 — mensagem do dono:** *"Finalize tudo, teste na tela para ver se a UI/UX ficou completamente responsiva e não ficou feio para o usuário, seja exigente e publique tudo quando validar no final e trabalhe em silêncio absoluto, eu vou dormir, publique tudo no final, você tem permissão total"* → a regra 2 (OK separado para migration, backfill, acerto e publicação) está dada de uma vez para o fim, depois de validar. O teste de "salvar o endereço no Tiny" num pedido de teste NÃO entra nessa permissão por prudência (mexe no ERP de verdade, pede mudança no fluxo do n8n — regra 3 — e ninguém acordado para conferir): o botão fica desligado com o porquê, como a própria demanda prevê ("caminho não provado no teste").

## Numeração (conferida na pasta, na cópia da 46 e no remoto)

Decisões **D-307…** · erros **E-270…** · acertos **A-223…** · dívidas da lei **38…** · migrations depois de `20261111050000`.

## Task list (espelha a demanda)

**Bloco B — Cancelar e Ocultar no PCP (e o excluído no Tiny saindo de vez)**
1. Frente 3 · a regra do PCP considera a lista de excluídos no Tiny (`fn_fora_do_pcp` e todos que a chamam: portas do PCP, aviso da 48, totais).
2. Frente 3 · excluído = o caminho do cancelado (peça em produção → "Para onde vai este móvel?"; pronta → ESTOQUE sem dono; o pedido na aba "Cancelados" com "Excluído no Tiny").
3. Frente 3 · a entrada na lista vira fato `pedido_excluido_tiny` + log + sino (logística e admin); pedido reencontrado sai da lista com `pedido_reencontrado_tiny`.
4. Frente 3 · conferir a detecção (a conta certa — loja × fábrica); sem relógio novo.
5. Frente 4 · "Cancelar pedido" (modal próprio, fila de saída do Tiny com motivo novo, sai do PCP na hora com `pedido_cancelado_plataforma`, peças pela frente 3 da 48, "O Tiny ainda não confirmou" + "Tentar de novo", desligado sem a ida ao Tiny, idempotente, a fila de uma vontade por pedido).
6. Frente 4 · "Ocultar do PCP" (modal; pergunta das peças liberadas com quantas e onde; `card_oculto` + desvincular + arquivar; rota/entregue não oculta; solta as reservas).
7. Frente 4 · "Pedidos ocultos" (30 dias numa configuração, filtro na leitura, sem relógio) e "Recuperar" (vagas reabrem no PCP; nenhuma peça volta para coluna).
8. Frente 4 · "Incluir pedido no PCP" aceita o oculto de qualquer idade ("Oculto em dd/mm"); o excluído continua fora.
9. Frente 4 · a aba "Cancelados" só com os cancelados (Tiny, plataforma, excluído), cada um com o seu rótulo; a janela "O que aconteceu?" com "Produzir de novo", "Cancelar pedido" e "Ocultar do PCP"; o fim do "Remover do PCP".
10. Frente 5 · "Liberar unidades" sem CANCELADO/NÃO ENCONTRADO, o banco recusa, a linha que leva aos botões; o aviso de laço (3+ cancelamentos em 24 h).

**Bloco A — a observação do item na capa do card**
11. Frente 1 · `pedido_itens.info_adicional` (texto limpo), todo caminho que grava os itens, backfill dos 376 com contagem; a mudança só de observação não reabre o PCP e chega ao vivo.
12. Frente 2 · capa do card (quadros, Expedição, tablet), janela do card ("Observação do item (Tiny)"), PCP (linha do item e "Liberar unidades"); faixa âmbar de 2 linhas; card sem observação idêntico; mesma porta.

**Bloco C — editar o endereço da parada**
13. Frente 6 · "Editar" na parada avulsa (Rotas, mapa, Entregas do dia), o mesmo formulário preenchido, log com antes e depois, só pendente.
14. Frente 7 · "Editar endereço" no pedido (Rotas, mapa, ficha): endereço + pino, a pergunta "salvar também no Tiny?", o original do Tiny guardado no fato, `vw_endereco_entrega` prefere o da plataforma, selo, "Voltar ao endereço original", o Tiny mudando por fora vence e avisa.

**Geral**
15. Bateria do banco 2×, tsc, lint, vitest, montagem, advisors; ensaio ×100 das portas tocadas; 375/768 sem rolagem lateral; fotos pedidas pelo dono.
16. Subida (banco, backfill, site) com a permissão dada; conferência no ar; handoff, decisões, memória, lei, esquema, modelo de sistema, ordem, mapa; ClickUp.

## Lições da memória que valem nesta sessão

- Regra 20: nenhum `cd`; `git -C`, `npm --prefix`, caminhos absolutos. Conferir a branch antes de todo commit (E-113).
- Função recriada = extração da última versão + md5 do corpo vivo (E-24/A-96/A-97); mudou assinatura → `quem-chama.mjs` + `prosrc ilike` no banco vivo (E-252); check de tipos: o `validate` mora na mais nova (E-19/E-259).
- Visão recriada por migration antiga não ganha coluna nova (E-251) — `vw_endereco_entrega` muda só o corpo.
- Filtro novo em porta que ordena e corta = conjunto calculado uma vez, nunca subconsulta por linha (E-255); regra por linha não mora em função com SET (E-65).
- Check com lista: `coalesce(x, '') in (…)` (E-253).
- Ensaio ×100 do caso que a tela ABRE, 6ª chamada (E-246/A-209).
- Botão novo em cabeçalho/linha: medir em 375 antes de dar por pronto (E-269); fotos de celular pelo navegador do app (E-265); vitrine para telas logadas (E-141/A-200/A-218).
- Texto com crase/`$` só por arquivo (E-247/E-249).

## Diário

- ~02:20 · **o 13622 e o 13270 voltaram ao PCP em 19/10 18:37 UTC** — os dois cards de pedido nasceram no MESMO instante: a limpeza geral daquele dia (SESSAO-37) recriou os cards dos pedidos que pareciam vivos e não olhou a lista de excluídos. O 13622 está na lista desde 16/10 (conferido de novo em 11/11), "Em aberto" no banco; o 13270 está "Preparando envio".
