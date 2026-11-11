---
titulo: Handoff — SESSAO-48 · cancelar a fabricação de verdade, o aviso e a remoção no PCP, o destino do móvel de pedido cancelado, a limpeza das colunas e a plataforma que recarrega sozinha
tipo: handoff
data: 2026-11-11
tags: [handoff, sessao-48, producao, cancelamento, pcp, estoque, logistica, tiny, publicacao, recargas, auditoria]
---

# 📋 Handoff — SESSAO-48 · Cancelar a fabricação de verdade e a plataforma que recarrega sozinha (11/11/2026)

Demanda: [[SESSAO-48 - Cancelar Fabricacao de Verdade - Peca de Pedido Pergunta o Destino]] · handoff de entrada: [[handoff_2026_11_11_cowork_sessao48_cancelamento_e_recargas]] · Diário: [[SESSAO-48]] (+ [[SESSAO-48 - frente 2]], [[SESSAO-48 - frente 3]], [[SESSAO-48 - frente 5]])

> ⏳ **NADA NO AR AINDA.** Tudo pronto e testado no ramo `sessao-48-cancelar-fabricacao-recargas` (pasta principal), esperando **quatro OKs separados do dono** (regra 2): **(1)** as 4 atualizações do banco · **(2)** o acerto das 53 peças paradas (primeiro o ensaio que não grava) · **(3)** a mudança na Vercel (pular a montagem quando só muda documentação — vai no `vercel.json`) · **(4)** publicar o site. O programa de subida está pronto, um passo por comando: `subir-s48.mjs conferir | banco | acerto-ensaio | acerto-aplicar | site` (no rascunho da sessão — o caminho está no diário). O `conferir` só lê o banco: confere o corpo das 29 funções que serão recriadas e que as 19 novas ainda não existem.

## 1. Objetivo

Do dono, 11/11 (texto fiel, D-290): *"O móvel aparece que está em produção, no entanto, está em cancelado. Ou seja, não deveria aparecer em produção. Quando for um PEDIDO, pergunta para onde vai mover aquele móvel que seria do pedido que foi cancelado. Caso seja um estoque que foi cancelado a fabricação apenas tira da produção."* E a plataforma que recarregava sozinha (o tablet que "abriu" 5 vezes em 20 s numa troca de setor; telas recarregando depois de cada publicação).

O retrato de 11/11 no site (só olhando, com o acesso do dono): **Estante Basic 7 nichos — 1 em estoque e 2 "reservados p/ produção"**; a coluna **CANCELADO com 49 peças** e a **NÃO ENCONTRADO com 4**, todas ainda contando como produção.

![[sessao48-estoque-real-antes.jpg]]
![[sessao48-cancelado-real-antes.jpg]]

## 2. O que foi feito

Cinco frentes: a base (frentes 1 e 4) feita primeiro; as frentes 2, 3 e 5 em paralelo, cada uma na sua cópia, juntadas na ordem (A-217).

### Frente 1 — mover para CANCELADO ou NÃO ENCONTRADO tira a peça da produção (D-290, D-295…D-297)

- **Sem botão novo:** o gesto é mover a peça para a coluna — por qualquer caminho (arrasto, tablet, Mover, a liberação do PCP direto na coluna, a API). A coluna ganhou um sinal ("cancela a fabricação", com o motivo), ligado uma vez só no CANCELADO e no NÃO ENCONTRADO da LIMPEZA E EMBALAGEM; o admin liga e desliga em Configurações → Setores e etapas.
- **Na hora:** a peça sai do "reservados p/ produção" do Estoque e do Top 20, das contas do PCP, da Expedição e dos painéis; o tempo de fila para; ninguém inicia nem retoma trabalho nela (o banco recusa e diz para arrastar de volta).
- **No cartão:** "Cancelada em dd/mm · some em N dias" (ou "Não encontrada em …") no lugar do tempo de fila, e "Era do pedido N".
- **Peça de pedido vivo:** perde o pedido e **a vaga volta ao PCP** com o aviso e o sino do PCP. **De estoque (reposição):** só sai da produção. **De pedido cancelado no Tiny:** sai da produção, sem vaga de volta.
- **Arrastar de volta** desfaz: com a vaga ainda aberta, a peça volta ao pedido e o aviso some; senão volta sem dono.

![[sessao48-quadro-cancelado.png]]
![[sessao48-quadro-tablet.png]]

### Frente 2 — a vaga volta ao PCP com aviso, e o PCP decide (D-299, D-300)

- **O selo** vermelho no card do pedido ("Peça cancelada na produção", "Peça não encontrada" ou "N peças canceladas na produção") — em "Aguardando liberação" e em Stand-by. Tocar nele (ou no sino) abre a janela.
- **A janela "O que aconteceu?"**: as peças que saíram da produção (móvel, coluna, quem, quando), o que o pedido ainda tem (em produção, prontas, vagas para liberar) e duas saídas — **"Produzir de novo"** (o aviso sai; libera pela janela de sempre) e **"Remover do PCP"** com o motivo: *o pedido foi cancelado* ("Cancele também no Tiny."), *tirar o pedido da linha de produção* ("O que houve?" obrigatório) ou *outro motivo* (texto obrigatório). Antes de confirmar, avisa as peças que seguem ("Este pedido ainda tem 1 peça em A LIMPAR. Para cancelar a fabricação dela, mova para CANCELADO.").
- **Remover não mexe no Tiny nem nas peças** já em produção ou prontas. O pedido removido sai de todas as portas do PCP e vai para a aba nova **"Cancelados e removidos"**, com o motivo, o texto, quem e quando — e **"Devolver ao PCP"**.
- Na lista de Pedidos ele aparece "Removido do PCP"; na busca geral, "Removido do PCP em dd/mm", com o atalho para a aba (achado da frente 2, corrigido na junção — E-261).

![[sessao48-pcp-selo.png]]
![[sessao48-pcp-o-que-aconteceu.png]]
![[sessao48-pcp-remover.png]]
![[sessao48-pcp-cancelados-removidos.png]]

### Frente 3 — pedido cancelado no Tiny pergunta o destino de cada móvel em produção (D-290, D-301, D-302)

- Quando o Tiny cancela um pedido que tem móvel **em produção**, a peça fica **"esperando decisão da logística"** (sai do "reservados p/ produção") e a logística recebe **um** aviso no sino: *"O pedido 13702 foi cancelado no Tiny. 3 móveis dele estão em produção — decida para onde vão."* A peça já pronta segue indo sozinha para o ESTOQUE, como antes.
- **A janela "Para onde vai este móvel?"** (abre no Estoque pelo sino): por móvel ou todos de uma vez — **seguir para o estoque**, **passar para outro pedido** (os pedidos no PCP que precisam do MESMO móvel, o que espera há mais tempo primeiro, com as vagas) ou **cancelar a fabricação** (o gesto da frente 1).
- **Sem decisão**, a peça que chega ao fim da linha vai para o ESTOQUE sem dono e a pendência fecha sozinha. **Pedido "descancelado"** no Tiny: a pendência sai e a peça segue do pedido.

![[sessao48-destino.png]]
![[sessao48-destino-outro-pedido.png]]

### Frente 4 — a coluna mostra 7 dias; a limpeza da madrugada; recuperar (D-291…D-294)

- As duas colunas mostram **só os últimos 7 dias** (o prazo mora na própria coluna, em Setores e etapas, de 1 a 90) — mesmo antes da limpeza rodar.
- **No 8º dia**, a rotina da madrugada que já existe (03:00) **arquiva** a peça com o motivo — nada é apagado, nenhum relógio novo.
- **Recuperar:** a busca geral acha a peça (também a arquivada) e a janela dela tem **"Recuperar a peça"** (só o admin) — ela volta para a fila da LIMPEZA E EMBALAGEM, sem dono.

![[sessao48-etapas.png]]
![[sessao48-janela-recuperar.png]]

### Frente 5 — a plataforma que recarrega sozinha (D-303…D-305)

- **A causa maior, achada no código:** a "versão" do site era o número do commit, gravado dentro do arquivo de entrada — **cada commit, até de documentação, trocava o nome de 89 dos 215 arquivos do site**. Toda tela aberta (tablet, escritório) que fosse abrir uma parte ainda não carregada pedia um arquivo que já não existia e **recarregava na hora**, sem aviso; e o aviso de "versão nova" acendia sem código novo. Em 09–10/11 foram 9 publicações, a maioria só de documentação.
- **(a)** Documentação não publica: a Vercel pula a montagem quando, desde a última publicação, só mudou `_docs/`, `Claude outputs/` ou `.md` (provado num clone igual ao da Vercel) — **⏳ só com o OK**.
- **(b)** A versão é o código: o mesmo código montado duas vezes dá a mesma versão (provado: commit diferente só de documentação → 0 arquivos trocados).
- **(c)** Recarregar só em momento seguro: **tablet e TV** — sem janela aberta (o PIN é digitado numa janela) e 1 minuto sem toque; **escritório** — na troca de tela, como antes. **Parte que sumiu:** "Atualizando a plataforma…" e **uma** recarga só. O botão "Atualizar" ficou maior (44 px no escritório, 64 no tablet e na TV). A proteção contra versões misturadas da Vercel é de plano pago — nada ligado.
- **(d)** A trilha diz **por que a página abriu**: atualizou, abriu pelo endereço, voltou, a aba tinha sido descartada pelo navegador, ou foi a própria plataforma (versão nova, parte sumida, troca de setor). Na Auditoria: "Abriu a plataforma — <porquê>".
- **(e)** O laço da troca de setor: cada troca por PIN gravava 2 "aberturas" (antes e depois da recarga) **+ 1 por aba extra** aberta no aparelho (o atalho da tela inicial abre aba nova a cada toque) — explica as 5 em 20 s. Agora a troca recarrega **uma vez só**, já no setor de destino.
- **(f)** Regra da casa (CLAUDE.md e memória): **subir para a main é publicar o site**.

### O acerto das peças paradas (⏳ pronto, não rodado — D-298)

`supabase/manutencao/2026-11-11_cancelado_vira_gesto.sql`: cada peça viva nas duas colunas passa pelo **mesmo gesto** (com a data do dia — cada uma ganha os 7 dias de conferência), o sino do PCP sai uma vez por pedido, os números do estoque são recontados. Tem o modo **ensaio** (conta antes e depois e desfaz — nada gravado) e o modo aplicar. Esperado: as 17 de reposição saem da produção; as 30 do 13622 saem, as vagas voltam ao PCP e o pedido ganha o aviso; a Estante Basic 7 nichos deixa de mostrar as peças canceladas como "reservados p/ produção" (o ensaio diz o número exato antes de gravar).

![[sessao48-estoque-antes-depois.png]]

### Celular e tablet

![[sessao48-pcp-o-que-aconteceu-celular.jpg]]
![[sessao48-destino-celular.jpg]]
![[sessao48-pcp-cancelados-celular.jpg]]
![[sessao48-pcp-selo-tablet.jpg]]

*(As fotos de tela são da vitrine — as telas de verdade com dados de exemplo; as duas "real antes" são do site no ar em 11/11.)*

## 3. Como testar (roteiro do dono — depois de subir)

**Acerto (logo depois de aplicar)**
1. **Logística → Estoque → Estante Basic 7 nichos:** o "reservados p/ produção" não conta mais as peças da coluna CANCELADO.
2. **Produção → LIMPEZA E EMBALAGEM:** CANCELADO e NÃO ENCONTRADO com "tira da produção · some em 7 dias" no topo; cada card "Cancelada em 11/11 · some em 7 dias".
3. **PCP:** o **13622** aparece em "Aguardando liberação" com o selo vermelho. Toque no selo → "O que aconteceu?" → decida: "Produzir de novo" ou "Remover do PCP" (provavelmente remover — o pedido está "Em aberto" no Tiny; se for cancelar, cancele também no Tiny).

**Frente 1**
4. Arraste uma peça de **reposição** para CANCELADO → no Estoque, o "reservados p/ produção" daquele móvel cai na hora. Arraste de volta para A LIMPAR → volta a contar.
5. Arraste uma peça de **pedido** para CANCELADO → no PCP o pedido aparece com o selo e o sino do PCP avisa. Arraste de volta → a peça volta para o pedido e o selo some.
6. No tablet, tente iniciar uma peça do CANCELADO → a plataforma recusa e diz para arrastar de volta.

**Frente 2**
7. Num pedido com selo: "Remover do PCP" → "Tirar o pedido da linha de produção" → tente sem escrever (não deixa) → escreva → confirme. O pedido some do PCP e aparece em **PCP → Cancelados e removidos**, com o motivo, quem e quando. **"Devolver ao PCP"** → ele volta para "Aguardando liberação".

**Frente 3** (quando acontecer de verdade)
8. Um pedido com móvel em produção cancelado no Tiny → o sino da logística "Pedido N cancelado com móveis em produção" → a janela abre no Estoque → escolha o destino de cada móvel → "Aplicar a decisão". No quadro, a peça mostra "Pedido cancelado — esperando decisão da logística" até decidir.

**Frente 4**
9. **Configurações → Setores e etapas → LIMPEZA E EMBALAGEM:** o CANCELADO diz "cancela a fabricação" e "some da coluna em 7 dias" (dá para mudar).
10. Depois de 7 dias, a peça some da coluna; na **busca geral** ela aparece "Fabricação cancelada — saiu da coluna em dd/mm"; na janela dela, como admin, **"Recuperar a peça"** → ela volta para a fila da LIMPEZA E EMBALAGEM.

**Frente 5**
11. Depois de publicar, um commit **só de cofre** na main → na Vercel aparece "Canceled" e o site não muda (a prova do item (a)).
12. No tablet, quando sair versão nova: o aviso aparece e a tela só se atualiza depois de 1 minuto sem toque (nunca com janela aberta ou PIN na tela).
13. Troque de setor no tablet por PIN → a tela recarrega **uma vez**.
14. **Super admin → Auditoria:** as aberturas aparecem como "Abriu a plataforma — <porquê>". Em alguns dias, isso responde o que causa cada recarga.

## 4. Verificação

- **Bateria do banco** (aplica todas as migrations duas vezes), com as 4 atualizações juntas, rodada às 04:41 (fora da janela da madrugada): **1.714 verdes e 1 vermelho** — o antigo do painel de vendas, que já falha na `main` sem esta sessão. Entre 03:10 e 04:40 o teste do lote do Tiny também fica vermelho por causa do horário (E-266) — não é quebra. Blocos novos: base 25 (+1 da correção da lista), frente 2 18 (+1), frente 3 24, frente 5 5.
- **Telas:** **628 testes** verdes (97 arquivos); tipos limpos; lint dos 53 arquivos tocados limpo; o site monta — **JS inicial 233,2 KB** (teto 250).
- **Ensaio ×100** (562.700 pedidos) da base e das frentes 2 e 3 — ver §5.
- **Celular (375) e tablet (768):** as telas novas sem rolagem lateral (medido no navegador do app); o selo do PCP com alvo de toque de 44 px.
- **Junção:** conferido por programa que nenhuma função é recriada por duas atualizações; os conflitos foram só "as duas frentes acrescentaram no mesmo lugar" na bateria.
- **Não conferido:** o banco vivo (nada foi lido nem escrito — fica para o `conferir`, com o OK); os advisors da Supabase (só depois de aplicar); a troca de setor e o momento seguro num tablet de verdade; a prova do "Canceled" na Vercel (só depois de publicar).

## 5. Desempenho (Lei — checklist)

- [x] **Requisições:** nenhuma tela ganhou requisição na abertura (quadro, PCP, Estoque, Pedidos, busca: 1). As janelas novas leem 1 vez, só no clique, e esquecem ao fechar; a aba nova pagina por cursor, sem o total.
- [x] **Sem polling, sem `postgres_changes`, sem relógio novo:** o cancelamento nasce do fato de chegada; aviso e vaga são projeção; a limpeza roda na rotina da madrugada que já existia; a conferida de versão é gesto ou fato (≤ 1 a cada 2 min, num arquivo da CDN).
- [x] **Ensaio ×100** (`Execucao/dados/SESSAO-48 - …`): quadro da LIMPEZA 214 → 212 ms · PCP 84 → 80 · lista de Pedidos 62 → 65 · busca 37 → 39 · gesto de cancelar 52 ms · voltar 14 ms · aba "Cancelados e removidos" 2,5–4,2 ms · "O que aconteceu?" 2,8 ms · "Para onde vai este móvel?" 33 ms (pior caso 75) · decidir 30 peças 206 ms. Três defeitos e duas lentidões achados pelos ensaios e corrigidos antes do fim (E-254…E-256, E-260 e a 1ª versão da janela do destino, 368 ms).
- [x] **Índices:** 4 parciais novos na base (peça cancelada, peça cancelada por pedido, pedido removido, peça esperando decisão); nenhuma política de RLS nova.
- [x] **Listas:** a aba nova por cursor; candidatos até 10 por móvel; decisão até 100 peças.
- [x] **Pacote:** JS inicial 233,2 KB (antes 231,2); as janelas e a aba novas são pedaços baixados no clique (2,3–4,0 KB).
- [x] **Escrita idempotente:** soltar, remover, devolver, decidir e recuperar duas vezes = um efeito.
- [ ] **Advisors:** depois de aplicar.
- **Dívidas novas na lei:** 36 (a janela do destino no pior caso, 75 ms) e 37 (decidir 30 peças de uma vez, 206 ms) — raras, com o caminho escrito.

## 6. Pendências que precisam do dono

1. **Os 4 OKs** (cada um em separado): atualizar o banco · rodar o acerto (o ensaio primeiro) · a mudança na Vercel · publicar o site.
2. **Plano da Vercel:** a proteção contra versões misturadas (Skew Protection) só existe nos planos pagos — e, no nosso tipo de site, pede trabalho a mais. Com as mudanças desta sessão ela fica bem menos necessária; ligar só se o dono quiser pagar.
3. **Confirmar as provisórias** D-291…D-305. As que mais pedem o olhar dele:
   - a aba **"Cancelados e removidos" voltou para dentro do PCP** (D-299) — desde 14/10 ela levava para Pedidos → Cancelados;
   - **remover do PCP não mexe nas peças reservadas do estoque** (D-300.1);
   - **"o mais antigo primeiro"** na hora de passar o móvel para outro pedido = o que espera há mais tempo no PCP, não a data da venda (D-301.1);
   - **"Cancelar a fabricação"** na janela do destino leva a peça para a coluna CANCELADO do setor dela (D-302.3);
   - **o momento seguro** do tablet: 1 minuto sem toque e sem janela (D-304.1);
   - **`supabase/` continua publicando** (só `_docs/`, `Claude outputs/` e `.md` pulam — D-303.2).
4. **As duas lentidões pequenas** da janela do destino (pior caso 75 ms; 30 peças de uma vez 206 ms) ficaram registradas como dívidas — aceitar ou pedir a correção numa próxima.
5. **ClickUp:** a demanda lista 5 tarefas "a criar com o OK do dono" — não foram criadas.
6. **As recargas de 10/11:** a frente 5 explicou pelo código e deixou 6 consultas só de leitura (no diário da frente) para confirmar nos registros do banco o que aconteceu às 11:23 (FITAMENTO), às 13:58 e 14:38 (CNC, de 40 em 40 min) e nas Entregas — só com o OK para ler o banco. Os registros do servidor duram pouco no plano gratuito.
7. **Depois de publicar:** a primeira publicação com a versão nova acende "versão nova" uma vez em cada tela aberta (é a troca de régua); as TVs se atualizam sozinhas no momento seguro.

## 7. Numeração usada

Migrations `20261111010000` (base), `…020000` (frente 2), `…030000` (frente 3), `…050000` (frente 5) — ⏳ não aplicadas; manutenção `2026-11-11_cancelado_vira_gesto.sql` — ⏳ não rodada. Decisões **D-290…D-305**; erros **E-250…E-267**; acertos **A-212…A-220**; dívidas da lei **36, 37**. Próximos: **D-306 · E-268 · A-221 · dívida 38**.
