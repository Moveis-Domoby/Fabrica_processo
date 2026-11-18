---
id: D-282
aliases: [D-282]
titulo: "Vários comprovantes de uma vez"
tipo: decisao
data: 2026-11-09
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas, provisoria-em-parte]
---
# D-282 · ✅ DECIDIDA pelo dono (anexar vários) + ⏳ PROVISÓRIA (os limites) — Vários comprovantes de uma vez (09/11/2026, SESSAO-47)

**Pedido do dono:** *"Ter a possibilidade de anexar mais de um arquivo de comprovante por vez ao pedido."* Vale nos três lugares: o painel do "Entregue" do entregador, o botão "Comprovante" do card nas Entregas do dia e a ficha do pedido (que ganhou o botão "Anexar comprovantes" — antes só listava e abria).

**Provisório (o limite veio da demanda; o resto é escolha da sessão):**
1. **Até 10 por vez**, com os mesmos tipos e o mesmo tamanho máximo de antes (10 MB por arquivo). Passou de 10 na mesma escolha, os excedentes ficam de fora com o aviso; dá para enviar esses e escolher mais depois.
2. **Cada arquivo sobe e é registrado sozinho, um depois do outro** (no celular com internet fraca falha menos e dá para ver o andamento de cada um). O que falha não derruba os outros; a janela diz qual falhou, por quê, e oferece tentar de novo **só** ele — sem reenviar o que já subiu e sem deixar cópia solta.
3. **A entrega é registrada antes dos comprovantes**, como já era: no "Entregue" do entregador a entrega vale primeiro e os arquivos sobem em seguida numa janela. Sair da janela vira "Deixar para depois" (o que subiu fica no pedido; o que faltou se anexa depois).
4. Arquivo vazio e documento (PDF/Word) com mais de 10 MB ficam de fora já na escolha, com o porquê; a foto grande entra, porque é reduzida no próprio aparelho. O mesmo arquivo escolhido duas vezes não repete. Arquivo que já subiu não pode mais ser tirado da lista ali.

**Como ficou (técnico):** sem mudança de banco (`plt_fn_anexo_registrar` já não repete o mesmo caminho). `src/rotas/enviarComprovantes.ts`, `useComprovantes.ts`, `ModalComprovantes.tsx`; `anexarComprovante(card, arquivo, chave)` com caminho estável por arquivo.
