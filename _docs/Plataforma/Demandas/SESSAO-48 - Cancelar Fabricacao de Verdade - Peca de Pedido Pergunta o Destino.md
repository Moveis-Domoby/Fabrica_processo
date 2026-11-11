---
titulo: "SESSAO-48 — Cancelar a fabricação de verdade (mover para CANCELADO ou NÃO ENCONTRADO tira a peça da produção, some em 7 dias e fica recuperável; a vaga do pedido volta ao PCP com aviso) e a plataforma que recarrega sozinha"
tipo: demanda
status: 📐 pronta para code
data: 2026-11-11
atualizado: 2026-11-11 (01:27 — sem botão: mover para CANCELADO cancela, limpeza em 7 dias com registro · 01:33 — respostas do dono: cancelar peça não é cancelar pedido; NÃO ENCONTRADO entra nesta sessão; a vaga do pedido volta ao PCP com aviso; e a investigação das recargas sozinhas)
origem: vídeo do dono de 10/11 (17:28) — Estoque mostrando a Estante Basic 7 nichos com "2 reservados p/ produção" e o quadro da LIMPEZA E EMBALAGEM com as duas peças do pedido 13622 na coluna CANCELADO há 138 h. Investigado no Cowork com leitura do banco de produção (11/11, ~01:30) e do código (main em 4e4a571). Só leitura: nada foi alterado.
revisa: ↩️ a D-61 (peça de pedido em produção não segue mais sozinha para o estoque quando é cancelada — a plataforma pergunta o destino). ↪️ usa a D-201 (peça em produção passa para outro pedido), a régua de "peça igual" da D-62, a regra de que o PCP segue o Tiny (D-132) e o padrão de arquivar com fato (nunca apagar).
tags: [plataforma, demanda, producao, cancelamento, estoque, pcp, logistica, kanban]
---

# 🎯 SESSAO-48 — Cancelar a fabricação de verdade

> **Número:** 48 era o próximo livre na main em 11/11 (a 47 foi a última entregue). Confira na `000 - ORDEM DAS SESSOES`; se já estiver usado, pegue o próximo e corrija o título.
> **Primeiro passo da sessão:** esta demanda já está em `_docs/Plataforma/Demandas/`, linkada na Ordem das Sessões, com o handoff de entrada do Cowork em [[handoff_2026_11_11_cowork_sessao48_cancelamento_e_recargas]] — só confira.
> **Cinco frentes:** 1 (mover para CANCELADO/NÃO ENCONTRADO tira da produção), 2 (a vaga do pedido volta ao PCP com aviso e o PCP decide), 3 (pedido cancelado no Tiny pergunta o destino), 4 (a limpeza dos 7 dias e a recuperação), 5 (a plataforma que recarrega sozinha) e o acerto do que já está parado, **só com o OK do dono**. Um commit por frente. A frente 5 é independente: pode correr em paralelo. Se o tempo apertar, a ordem é 5 → 1 → 2 → 4 → 3 → acerto.

## O pedido do dono (texto fiel, 11/11)

*"O móvel aparece que está em produção, no entanto, está em cancelado. Ou seja, não deveria aparecer em produção. Quando for um PEDIDO, pergunta para onde vai mover aquele móvel que seria do pedido que foi cancelado. Caso seja um estoque que foi cancelado a fabricação apenas tire aquele móvel da produção."*

**Ajuste do dono (11/11, 01:27) — vale por cima do resto:** *"Não colocaremos botões, só o mover para cancelado já deve cancelar a peça e ela é excluída depois de 7 dias pra não inflar a coluna com muitos cards, ficando apenas o log de exclusão para recuperarmos caso necessário."*

**Respostas do dono (11/11, 01:33 — fechadas, não perguntar de novo):**
1. *"Cancelar uma peça não necessariamente significa cancelar um pedido, apenas cancelar a produção dela por N motivos."*
2. NÃO ENCONTRADO: *"Sim, vamos tratar já nessa sessão"* — o mesmo tratamento do CANCELADO.
3. A vaga da peça cancelada de um pedido volta ao PCP: *"Sim, porém com um aviso nessa peça/pedido para o PCP ver o que aconteceu e dentro desse aviso ele pode remover de PCP e selecionar se o pedido foi cancelado, se ele quer remover o pedido da linha de produção definindo o que houve com ele ou algum outro motivo."*
4. *"Acabei de perceber que de tempos em tempos a plataforma atualiza sozinha do nada e recarrega a tela, investigue sobre isso também"* → frente 5.

**O vídeo (10/11, 17:28):** na tela de Estoque, a **Estante Basic 7 nichos – Branca (SKU 422)** mostra "1 em estoque · 2 reservados p/ produção". O dono abre a LIMPEZA E EMBALAGEM, filtra "Estante Basic 7 nichos – Branca" e mostra que as duas que contam como "em produção" são as do **pedido 13622 (1/2 e 2/2)**, paradas na coluna **CANCELADO** há **138 h 58 min na fila**.

---

## O que a investigação achou (leitura do banco em 11/11)

### 1. CANCELADO é só uma coluna — o sistema não sabe o que ela quer dizer
- **CANCELADO** e **NÃO ENCONTRADO** são duas etapas comuns da LIMPEZA E EMBALAGEM, cadastradas em 29/08 a partir da lista do ClickUp (`plt_etapas` 32 e 31; não são fila, não são DANIFICADO, não concluem produção, não encaminham).
- Para a plataforma, peça ali **está em produção** como qualquer outra: entra no "reservados p/ produção" do Estoque e do Top 20 (`fn_estoque_categoria` → `producao_de_pedido` / `producao_sem_dono`, somados em `fn_reservados_producao`), no quadro, nos contadores, no tempo na fila e nos painéis.
- **Hoje:** 49 peças vivas no CANCELADO e 4 no NÃO ENCONTRADO = **53 das 127 peças "em produção" (42%)**, espalhadas por **30 móveis** do catálogo. Os números de "em produção" da fábrica estão inflados nessa proporção.

| Coluna | De onde | Peças | Situação no Tiny | Quem pôs lá |
|---|---|---|---|---|
| CANCELADO | Pedido **13622** | 30 (+1 no A LIMPAR) | **Em aberto** | Guilherme, direto do PCP, em 19/10 22:24 (todas no mesmo segundo) |
| CANCELADO | Reposição de estoque (10 cards de reposição) | 17 | — | Guilherme, do A LIMPAR e do NÃO ENCONTRADO, de 03/11 a 10/11 |
| CANCELADO | Pedidos 12728 e 13702 | 1 + 1 | Cancelado | Guilherme, direto do PCP (19/10 e 26/10) |
| NÃO ENCONTRADO | Pedidos 11960 e 13709 | 1 + 1 | Cancelado | Guilherme (PCP, 19/10) e João Pedro (A LIMPAR, 29/10) |
| NÃO ENCONTRADO | Reposição de estoque | 2 | — | João Lucas (A LIMPAR, 06/11) |

### 2. Não existe gesto de "cancelar a fabricação"
- Nenhuma porta da plataforma deixa a equipe dizer "esta peça não vai mais ser feita". O jeito que a equipe achou foi arrastar para a coluna CANCELADO — e a peça continua contando.
- A janela **"Liberar unidades"** do PCP deixa escolher **setor e etapa** de destino, então dá para liberar um pedido inteiro **direto** na coluna CANCELADO (foi o que aconteceu com o 13622 e o 12728).

### 3. A regra de hoje para pedido cancelado não pergunta nada (D-61)
- Pedido cancelado no Tiny com peça **em produção**: a peça **segue** com a etiqueta "Pedido cancelado — pronta, vai para o estoque" e só perde o pedido quando chega ao ESTOQUE (`fn_desvincular_por_cancelamento`). Ninguém é perguntado. Enquanto isso, ela conta como "produção de pedido".
- Com peça **pronta** (aguardo / ROTAS): vai sozinha ao ESTOQUE sem dono. **Isso continua.**

### 4. O 13622 não está cancelado para a plataforma (↪️ resposta 1: e nem precisa estar — cancelar peça não é cancelar pedido)
- No Tiny, o 13622 está **"Em aberto"** desde 08/10 (R$ 14.051,90, marcador "1ª venda", 31 peças). Para a plataforma, é um pedido **vivo** com 31 peças em produção — por isso conta.
- Pela resposta 1 do dono, as 30 peças dele no CANCELADO são **peças com a fabricação cancelada**, não um pedido cancelado: com esta demanda, elas saem da produção e as vagas voltam ao PCP com o aviso, para o PCP decidir (frente 2 e o acerto).

---

## A regra nova (uma só, no banco)

**Cancelar a fabricação de uma peça não é cancelar o pedido** (resposta 1). Mover a peça para a coluna **CANCELADO** ou **NÃO ENCONTRADO** é o gesto. Não existe botão novo no card. Toda peça que entra numa dessas colunas:

1. **sai da produção na hora**: some do "reservados p/ produção" do Estoque e do Top 20, dos contadores, dos painéis e das contas do PCP e da Expedição, e o tempo de fila para de contar;
2. **fica visível na coluna por 7 dias**, para conferir ou arrastar de volta (o que desfaz);
3. **some da coluna no 8º dia**: fica arquivada com o registro da exclusão, **nunca apagada do banco**, e pode ser recuperada.

| A peça é… | Ao entrar na coluna |
|---|---|
| **De estoque** (sem pedido: reposição, lançamento manual) | Sai da produção. Nada mais. |
| **De pedido vivo** | Sai da produção e **perde o pedido**. A **vaga volta ao PCP** com um **aviso** no pedido, e o PCP decide (frente 2). |
| **De pedido cancelado no Tiny** | Sai da produção. O pedido já está na aba Cancelados do PCP, e nenhuma vaga volta. |

A diferença entre as duas colunas é só o **motivo** que fica gravado: "Fabricação cancelada" ou "Peça não encontrada". O motivo aparece no aviso, no histórico e na Auditoria.

### Frente 1 · Mover para CANCELADO ou NÃO ENCONTRADO tira da produção
- As duas etapas ganham um sinal novo (no padrão de `conclui_producao`): **`cancela_fabricacao`**, com o **motivo da etapa** (`cancelada` | `nao_encontrada`).
  - Ligado no CANCELADO e no NÃO ENCONTRADO da LIMPEZA E EMBALAGEM.
  - O admin pode ligar ou desligar em Configurações → etapas do setor, no mesmo lugar de "conclui a produção".
- **Qualquer caminho de chegada vale:** arrasto no quadro, tablet, Mover da liderança e a janela "Liberar unidades" do PCP com essa etapa escolhida. Quem pode soltar lá é quem já pode mover o card hoje; nada muda de permissão.
- **No banco, a cada peça que chega** (um gatilho no fato de chegada, para valer por qualquer caminho):
  - **fato novo** `fabricacao_cancelada` (append-only — RNF-05) com autor, de onde veio, o motivo e o pedido ou a reposição;
  - projeção `cancelada_em` no card, no padrão de `standby_desde`;
  - peça de pedido vivo: `unidade_desvinculada` (perde o pedido) + a vaga reaberta no pedido (frente 2);
  - a peça sai de todas as contas pela **regra única** (no `fn_estoque_categoria`, peça cancelada fica sem categoria; o mesmo vale para quadro, PCP, Expedição e painéis);
  - log (D-40), Auditoria e histórico da peça;
  - aviso ao vivo pelo canal do setor e do estoque, sem recarregar.
- **Na coluna**, o card mostra **"Cancelada em dd/mm · some em N dias"** (ou "Não encontrada em…") no lugar do tempo de fila. Ninguém inicia nem trabalha peça cancelada: o banco recusa e a tela não oferece.
- **Arrastar de volta dentro dos 7 dias** para uma etapa de produção desfaz o cancelamento, com o fato `fabricacao_retomada`:
  - a peça volta a contar, e o tempo de fila recomeça na etapa nova;
  - se ela era de um pedido e **a vaga dele ainda está aberta**, ela volta a ser desse pedido e o aviso some;
  - se a vaga já foi liberada de novo ou o pedido saiu do PCP, ela volta **sem dono** (provisória).
- **Achou a peça "não encontrada"?** É o mesmo arrasto de volta.
- **Reposição (provisória, no padrão da D-201):** a reposição **só perde a peça**. A vaga continua contada como liberada; se o estoque ficar abaixo do mínimo, a reposição automática ou a logística lançam de novo, como hoje.
- **Escrita idempotente:** soltar duas vezes produz um efeito só.

### Frente 2 · A vaga do pedido volta ao PCP com aviso, e o PCP decide (resposta 3)
- **A vaga volta ao PCP na hora** para ser liberada de novo, pela regra do PCP de sempre (`vw_itens_producao` menos as unidades vivas do pedido). Peça cancelada não conta como unidade viva.
- **O aviso:** o pedido no quadro do PCP ganha um selo vermelho, com texto ao lado da cor (M-12): **"Peça cancelada na produção"** (ou "Peça não encontrada"). O sino avisa o PCP (logística e admin): *"A Estante Basic 7 nichos (1/2) do pedido 13622 foi cancelada na LIMPEZA E EMBALAGEM por Guilherme. A vaga voltou ao PCP."*
- **Tocar no aviso abre a janela "O que aconteceu?"**, que lê numa requisição ao abrir e mostra:
  - as peças canceladas ou não encontradas do pedido: móvel, k/n, de qual coluna, quem e quando;
  - o que o pedido ainda tem em produção ou pronto.
- **As saídas da janela:**
  1. **"Produzir de novo"**: fecha o aviso, e o pedido segue no PCP para liberar normalmente (a janela "Liberar unidades" de sempre, com as sugestões de estoque e de peça em produção).
  2. **"Remover do PCP"**, escolhendo o motivo:
     - **"O pedido foi cancelado"** (a plataforma não muda o Tiny — a frase lembra: *"Cancele também no Tiny."*);
     - **"Tirar o pedido da linha de produção"**, com campo **obrigatório** "O que houve?";
     - **"Outro motivo"**, com texto obrigatório.
- **"Remover do PCP" no banco:**
  - fato novo `pedido_removido_pcp` com o motivo e o texto;
  - projeção no card do pedido, no padrão de `standby_desde`;
  - o pedido sai do quadro do PCP e de todas as portas do PCP (uma regra só — D-75);
  - log e Auditoria.
- **Para onde vai o pedido removido** (provisória): a aba **Cancelados** do PCP vira **"Cancelados e removidos"**, mostra o motivo e quem removeu e oferece **"Devolver ao PCP"** (fato `pedido_devolvido_pcp`).
- **O que muda e o que não muda ao remover** (provisória):
  - só a parte do PCP muda: vagas pendentes e liberações futuras;
  - peças do pedido **ainda em produção ou prontas não mudam**. A janela avisa quantas são e onde estão: *"Este pedido ainda tem 1 peça em A LIMPAR. Para cancelar a fabricação dela, mova para CANCELADO."*
- **O Tiny segue mandando** (D-132): se o Tiny cancelar o pedido depois, vale o caminho de cancelado de sempre. Remover do PCP não muda nada no Tiny.

### Frente 3 · Pedido cancelado no Tiny pergunta o destino de cada móvel em produção (↩️ revisa a D-61 — primeira mensagem do dono)
- **Quando:** chega do Tiny o cancelamento e o pedido tem peça em **setor de produção, não concluída**. A peça pronta (aguardo/ROTAS) continua indo sozinha ao ESTOQUE, como hoje.
- **O que acontece na hora:**
  - cada peça em produção ganha a marca **"esperando decisão"** (projeção por fato) e **deixa de contar** como produção de pedido;
  - o card troca a etiqueta para **"Pedido cancelado — esperando decisão da logística"**;
  - o sino avisa **logística e admin**: *"O pedido 13702 foi cancelado no Tiny. 3 móveis dele estão em produção — decida para onde vão."*
- **A janela "Para onde vai este móvel?"** segue o padrão da "Decidir situação" da devolução (D-129): uma requisição ao abrir, peça por peça ou todas de uma vez. As opções:
  1. **"Seguir para o estoque"**: a peça perde o pedido, continua a produção onde está e, pronta, entra no ESTOQUE sem dono.
  2. **"Passar para outro pedido"**: pedidos vivos que precisam do **mesmo móvel** (régua da D-62; maquinaria da D-201: `fn_sugestoes_em_producao` / `peca_vinculada`). A peça passa a ser do pedido escolhido onde está. Se nenhum pedido precisa, a opção fica desabilitada e a tela explica por quê.
  3. **"Cancelar a fabricação"**: a peça vai para a coluna CANCELADO (o gesto da frente 1, autor quem decidiu).
- **Ninguém decidiu e a peça chegou ao fim da linha:** vale a regra de hoje, e ela entra no ESTOQUE sem dono. A pendência se fecha com um fato que diz isso (provisória: o chão de fábrica não para).
- **Pedido "descancelado" no Tiny antes da decisão:** a marca sai e a peça volta a ser do pedido (provisória).

### Frente 4 · A limpeza dos 7 dias e a recuperação
- **As duas colunas só mostram os últimos 7 dias.** É um filtro na leitura: a porta do quadro e o "Ver mais" leem só `cancelada_em` ≥ agora − 7 dias, com índice. A coluna não incha nem antes da limpeza rodar.
- **A exclusão em si:** no 8º dia, a peça recebe `card_arquivado` com o motivo *"Fabricação cancelada há mais de 7 dias — removida da coluna CANCELADO"* (ou NÃO ENCONTRADO).
  - **Sem relógio novo (regra 18):** acrescente esse passo à **rotina diária da madrugada que já existe** (a conferência com o Tiny) ou a outro mecanismo de prazo já em uso. Se nenhum servir, pare e registre a escolha como decisão.
  - Nada é apagado.
- **Recuperar:** a peça arquivada aparece na **busca geral** (lupa/Ctrl+K) e na **Auditoria**, com o motivo.
  - O **admin** recupera (provisória) com `fabricacao_retomada` + reabertura do arquivamento.
  - A peça volta para a **fila da LIMPEZA E EMBALAGEM** (provisória), sem dono se já tinha perdido o pedido.
- Os **7 dias** ficam numa configuração (provisória: Configurações → Controle do quadro, padrão 7), sem número escrito no código.

### Frente 5 · A plataforma que recarrega sozinha (resposta 4)

**O que a investigação achou (código da main + publicações do GitHub + trilha do banco, 11/11):**

1. **Toda subida para a main publica o site, mesmo quando só mudou documentação.**
   - A ligação da Vercel publica a cada commit na main.
   - Entre 09/11 17:34 e 10/11 00:37 (Brasília) foram **9 publicações**. A maioria era só do cofre (notas, handoff, diário), sem uma linha de código.
   - As duas subidas desta demanda (11/11, 01:24 e 01:30) também publicaram.
2. **Cada publicação faz as telas abertas recarregarem**, por dois caminhos do código:
   - **O aviso de versão nova:** a versão é o **commit**, então muda até quando só a documentação mudou. A plataforma confere a versão quando a pessoa troca de tela ou volta à aba (no máximo a cada 2 min). Sabendo que há versão nova, **a próxima troca de tela recarrega a página inteira** (`src/lib/versaoNova.ts`). Isso vale para o tablet e para o escritório.
   - **O pedaço que sumiu:** a plataforma é dividida em pedaços por tela. Depois de uma publicação, os arquivos da versão antiga somem do ar, e quem abre uma tela ou janela que ainda não tinha carregado recebe a **recarga imediata** (`vite:preloadError` em `src/main.tsx`).
3. **Também houve recargas sem publicação nenhuma.** Em 10/11 não houve publicação durante o expediente, e mesmo assim a trilha mostra páginas abrindo de novo na mesma tela:
   - o Tablet · CNC abriu do zero às 13:58:39 e às 14:38:39, exatamente 40 min depois, sem entrar com PIN;
   - o Tablet · FITAMENTO abriu **5 vezes em 20 s** às 11:23, logo depois de uma troca de setor por PIN, e a FURAÇÃO e a MONTAGEM fizeram o mesmo naquele minuto;
   - a tela de Entregas do Vinícius abriu do zero umas 8 vezes no dia.
   - **Nenhum relógio no código recarrega a página.** As outras recargas do código são a troca de setor do tablet (de propósito) e o botão "Atualizar". Os suspeitos são três: o navegador do tablet descartando a aba para poupar memória e recarregando ao acordar a tela; a recarga da troca de setor entrando em sequência; ou a pessoa apertando atualizar (por exemplo, por achar que a tela não atualizou sozinha). A trilha de hoje **não diz o porquê** de cada abertura.

**O que fazer:**
- **(a) Documentação não publica o site.** Na Vercel, pular a montagem quando o commit só mexe em `_docs/`, `Claude outputs/` ou arquivos `.md` (`ignoreCommand` no `vercel.json`, comparando com o commit anterior). Com a montagem pulada, o site no ar não muda e ninguém recarrega.
- **(b) A versão é o código, não o commit.** Duas montagens do mesmo código têm a mesma versão, então uma republicação sem mudança de código não acende "versão nova". Exemplo: a versão é o nome com hash do arquivo de entrada, e o `versao.json` leva o mesmo valor. Confira que a regra pega mudança de qualquer pedaço.
- **(c) Recarregar só em momento seguro.**
  - **Tablet e TV:** nunca no meio de um gesto. Sem janela aberta, sem PIN sendo digitado e sem toque há pelo menos 1 min (provisória); até lá, só o aviso discreto.
  - **Escritório:** troca de tela continua sendo o momento seguro.
  - **Pedaço que sumiu:** ao abrir um pedaço que não existe mais, o tablet mostra "Atualizando a plataforma…" e recarrega uma vez, sem laço.
  - Veja se a Vercel do dono tem **proteção contra versões misturadas** (*Skew Protection*, mantém os arquivos da versão anterior no ar por um tempo). Se for plano pago, **pergunte ao dono antes**.
- **(d) A trilha passa a dizer por que a página abriu.** Cada abertura grava no log da abertura:
  - o tipo de carga do navegador: `navigate` | `reload` | `back_forward`, pelo `performance.getEntriesByType('navigation')`;
  - se a aba tinha sido descartada (`document.wasDiscarded`);
  - o motivo da própria plataforma quando foi ela que recarregou: versão nova, pedaço sumido ou troca de setor (guardado no `sessionStorage` antes de recarregar).
  - Na **Auditoria**, a ação "Abriu a plataforma" mostra esse motivo em português. Em alguns dias, isso responde ao dono o que causa cada recarga.
- **(e) O laço da troca de setor do tablet:** reproduza a troca de setor por PIN e descubra por que a página abriu várias vezes em segundos às 11:23 de 10/11. Corrija para **uma** recarga só.
- **(f) Regra da casa (memória de aprendizado + CLAUDE.md):** subir para a main **é publicar o site**, então commit de código na main só no momento combinado com o dono (a regra 2 já pede o OK para publicar). Com o (a), o cofre pode subir a qualquer hora.

### O acerto do que já está parado (**só com o OK do dono**, regra 2)
Manutenção de dado em `supabase/manutencao/AAAA-MM-DD_cancelado_vira_gesto.sql`, ensaiada antes com contagens antes/depois e aplicada **só com o OK do dono na conversa**. Origem `api`, um fato por peça, **com a data de hoje** (para cada peça ganhar os 7 dias de conferência):
- **CANCELADO, 17 peças de reposição** → saem da produção.
- **CANCELADO, 30 peças do 13622** (Em aberto no Tiny) → saem da produção, as vagas voltam ao PCP e o aviso "Peça cancelada na produção" aparece no pedido. O PCP decide pela janela; provavelmente "Remover do PCP".
- **CANCELADO, 12728 e 13702** (cancelados no Tiny) → saem da produção, sem vaga de volta.
- **NÃO ENCONTRADO, 2 peças de reposição** → saem da produção com o motivo "Peça não encontrada".
- **NÃO ENCONTRADO, 11960 e 13709** (cancelados no Tiny) → saem da produção, sem vaga de volta.
- **Depois:** recontar os números do estoque (`fn_estoque_numeros_recontar`) e conferir a Estante Basic 7 nichos e os móveis afetados (30 no levantamento), antes e depois.

---

## Fora do escopo
- Botão novo no card para cancelar (o dono pediu sem botão).
- Cancelar ou mudar a situação do pedido no Tiny pela plataforma; mudar a D-132.
- Peça pronta de pedido cancelado (aguardo/ROTAS): continua indo sozinha ao ESTOQUE.
- Cancelar vaga de reposição que ainda está no PCP.
- Apagar linha do banco (nunca: arquivar com fato).
- Mexer no fluxo do n8n.
- Plano pago na Vercel sem o OK do dono.

## Critérios de aceite

**Frente 1**
- [ ] Soltar peça no CANCELADO ou no NÃO ENCONTRADO tira ela na hora do "reservados p/ produção" do Estoque e do Top 20, dos contadores e dos painéis, sem recarregar; o motivo certo fica gravado.
- [ ] Na coluna, o card mostra quando saiu e em quantos dias some; o tempo de fila não conta e ninguém inicia a peça.
- [ ] Arrastar de volta dentro dos 7 dias desfaz; com a vaga ainda aberta, a peça volta para o pedido e o aviso some.
- [ ] Liberar no PCP direto numa dessas colunas funciona igual. Soltar duas vezes produz um efeito só.

**Frente 2**
- [ ] Peça de pedido vivo cancelada: a vaga volta ao PCP na hora, o pedido ganha o selo e o sino avisa o PCP.
- [ ] A janela mostra o que aconteceu e oferece "Produzir de novo" e "Remover do PCP" com os três motivos (dois com texto obrigatório).
- [ ] Pedido removido sai de todas as portas do PCP, aparece em "Cancelados e removidos" com o motivo, e "Devolver ao PCP" funciona.
- [ ] Remover não mexe no Tiny nem nas peças já em produção ou prontas (a janela avisa quantas são).

**Frente 3**
- [ ] Pedido cancelado no Tiny com peça em produção: a peça fica "esperando decisão", sai do "reservados p/ produção" e o sino avisa logística e admin.
- [ ] As três opções funcionam peça por peça e todas de uma vez.
- [ ] Peça sem decisão que chega ao fim da linha vai ao ESTOQUE sem dono, e a pendência se fecha com fato.

**Frente 4**
- [ ] As duas colunas só mostram os últimos 7 dias, mesmo antes da limpeza rodar.
- [ ] No 8º dia a peça é arquivada com o motivo, sem relógio novo; nada é apagado.
- [ ] O admin acha a peça na busca geral e na Auditoria e a recupera.

**Frente 5**
- [ ] Commit só de documentação na main não gera publicação nova (provado com um commit de teste do cofre).
- [ ] Republicar o mesmo código não acende "versão nova" em tela aberta.
- [ ] No tablet, versão nova não recarrega no meio de um gesto nem com janela aberta.
- [ ] Toda abertura da plataforma grava o porquê (navegou, atualizou, aba descartada, versão nova, pedaço sumido, troca de setor), e a Auditoria mostra em português.
- [ ] A troca de setor por PIN recarrega uma vez só.

**Acerto**
- [ ] Ensaio com contagens antes/depois; aplicado só com o OK do dono; a Estante Basic 7 nichos e os outros móveis afetados mostram o número certo; o 13622 aparece no PCP com o aviso.

**Geral**
- [ ] Celular (375) e tablet (768) sem rolagem lateral; botões com tamanho de toque.
- [ ] Bateria do banco 2×, tsc, lint, vitest, build, advisors sem nada novo além do esperado.
- [ ] Lei de desempenho: cada tela em 1 requisição, sem relógio novo (trabalho nasce do fato); as janelas leem só ao abrir; plano ×100 das portas novas ou tocadas no handoff.

## Notas para o Claude Code

- **Leia** `SUPA - Esquema do Banco`, a Lei de Desempenho e a Memória de Aprendizado. Recrie toda função a partir da **versão viva** do banco, conferindo o md5 do corpo (A-96/A-97). Reaplicar migration antiga já desfez trabalho novo.
- **Onde mora:**
  - **A regra única do que conta:** `plt_privado.fn_estoque_categoria`. Peça cancelada fica sem categoria; a mudança vale nas assinaturas e nos chamadores. Daí para `fn_estoque_numeros_cards` / `_recontar` → `fn_reservados_producao` → `plt_fn_estoque_produtos`, o Top 20 e o Estoque. Confira também os contadores do quadro (`fn_quadro_total`), o PCP, a Expedição e os painéis.
  - **A chegada na etapa:** `plt_fn_soltar_card`, `plt_fn_mover_card`, `plt_fn_card_mover_para_fila`, a liberação do PCP (`ModalLiberarPedido` deixa escolher a etapa) e a projeção do card (`fn_projetar_posicao` / `fn_projetar_card`). O cancelamento nasce do **fato de chegada** numa etapa com `cancela_fabricacao`.
  - **A vaga de volta ao PCP:** `plt_privado.vw_itens_producao`, `fn_recalcular_liberacao`, `plt_fn_pcp_quadro`, `plt_fn_cards_pedido_pcp`, `plt_fn_dash_pcp_dia`. A regra do PCP (`fn_tiny_tirou_do_pcp` + a marca da SESSAO-47) ganha "**e não foi removido do PCP**" — uma regra só para todas as portas (D-75).
  - **"Cancelados e removidos":** `plt_fn_pedidos_cancelados` e a aba Cancelados do PCP.
  - **Cancelamento do Tiny:** `plt_privado.fn_desvincular_por_cancelamento` (gatilho `plt_eventos_zz_desvincular_cancelados`) e `fn_reagir_pedido`.
  - **"Passar para outro pedido":** `plt_privado.fn_sugestoes_em_producao` e `peca_vinculada` (D-201).
  - **As janelas:** o padrão de `ModalDecidirDevolucao` / `src/logistica/devolucao.ts`.
  - **O card:** `src/kanban/componentes/CartaoUnidade.tsx`. Hoje ele mostra "Pedido cancelado — pronta, vai para o estoque", lido de `pedidoCancelado`.
  - **A limpeza:** a rotina diária da madrugada (`plt-tiny-pente-fino`, `fn_tiny_pente_fino_iniciar`) ou outro mecanismo de prazo já existente.
  - **Recuperar:** `plt_fn_busca_cards` (já traz arquivados com o motivo) e a Auditoria.
  - **Recargas:** `src/lib/versaoNova.ts`, `src/main.tsx` (`vite:preloadError`), `vite.config.ts` (a versão vem do `VERCEL_GIT_COMMIT_SHA`), `vercel.json`, `src/paginas/TelaSetor.tsx` (a recarga da troca de setor), `plt_fn_abertura` (o log da abertura passa a levar o contexto) e `src/auditoria/rotulos.ts`.
  - **Tipos novos de evento** entram no check `plt_eventos_tipo_check`; o `validate` muda para a migration nova (E-19).
- **Eventos são append-only:** cancelar, retomar, remover, devolver e excluir são fatos novos; nada é editado ou apagado. Toda atividade gera log.
- **Regra 2:** migration, manutenção de dado, mudança no `vercel.json` e publicação só com aprovação do dono na conversa, cada uma em passo separado.
- **Decisões provisórias a registrar (D-NN):**
  - "excluir" = arquivar com fato;
  - o prazo de 7 dias numa configuração;
  - só admin recupera, e a peça volta para a fila da LIMPEZA E EMBALAGEM;
  - retomada com a vaga já tomada volta sem dono;
  - a reposição só perde a peça;
  - "Cancelados e removidos" com "Devolver ao PCP";
  - remover do PCP não mexe nas peças em produção ou prontas;
  - sem decisão + fim da linha = ESTOQUE sem dono;
  - pedido "descancelado" devolve a peça;
  - onde roda a limpeza diária;
  - o momento seguro de recarregar no tablet (1 min sem toque);
  - a versão pelo código.
- Com o dono: português de gente, sem códigos (regra 12c).

## Para o dono (não travam a sessão)
- Se a proteção contra versões misturadas da Vercel for paga no seu plano, o Claude Code pergunta antes de ligar.

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)
- *A criar com o OK do dono:*
  - "Produção - Mover para Cancelado ou Não encontrado tira a peça da produção"
  - "PCP - Aviso de peça cancelada com remover do PCP"
  - "Produção - Pedido cancelado pergunta o destino de cada móvel"
  - "Produção - Colunas Cancelado e Não encontrado limpam em 7 dias com recuperação"
  - "Plataforma - Parar de recarregar a tela sozinha"

## Resultado (preencher ao entregar)

**11/11/2026 (madrugada) — entregue, ⏳ esperando os OKs do dono.** Handoff: [[handoff_2026_11_11_sessao48_cancelar_fabricacao_recargas]] · diário: [[SESSAO-48]].

- **Feito:** as 5 frentes e o acerto, no ramo `sessao-48-cancelar-fabricacao-recargas` — 4 atualizações do banco (`20261111010000` base · `…020000` PCP · `…030000` destino · `…050000` abertura) e a manutenção do acerto; telas do quadro, do PCP (selo, "O que aconteceu?", "Cancelados e removidos"), do Estoque ("Para onde vai este móvel?"), de Setores e etapas, da janela do card, da busca e da Auditoria; a publicação (a versão pelo código, o pulo da documentação, a recarga em momento seguro). Bateria 1.714 verdes (só o vermelho antigo do painel de vendas, que já falha na `main`), 628 testes de tela, JS inicial 233,2 KB, ensaio ×100 das portas novas.
- **O que mudou de rota:** a aba "Cancelados e removidos" voltou para dentro do PCP (D-299); o prazo da coluna mora na própria etapa, em Setores e etapas (não havia a tela "Controle do quadro" — D-292); a causa maior das recargas não era um relógio: era a versão pelo commit, que renomeava 89 dos 215 arquivos a cada commit (D-303).
- **Esperando o dono:** os 4 OKs (banco · acerto · Vercel · publicação), as provisórias D-291…D-305, as 5 tarefas do ClickUp, o plano da Vercel (a proteção contra versões misturadas é paga) e o OK para ler os registros das recargas de 10/11.

---

## Prompt para abrir no Claude Code (pasta "Domoby - fabrica")

```
Você é o engenheiro executor da Plataforma de Produção da Móveis Domoby. Atualize a main, siga a ordem de leitura do CLAUDE.md da raiz e execute a demanda "SESSAO-48 — Cancelar a fabricação de verdade e a plataforma que recarrega sozinha" (já está em _docs/Plataforma/Demandas/ e linkada na Ordem das Sessões; confira se o número 48 está livre). Leia duas vezes — os ajustes e as respostas que dei em 11/11 (01:27 e 01:33) valem por cima do resto.

As respostas de negócio estão dentro da demanda: não me pergunte nada de negócio; o que faltar vira decisão provisória registrada. Branch nova a partir da main, commits pequenos com push a cada frente — lembrando que hoje toda subida para a main publica o site, então nada de código na main sem o meu OK. Migration, o acerto das peças paradas, a mudança da publicação na Vercel e publicação do site só com o meu OK.

Ao terminar: o que foi feito, como testar passo a passo (com prints das colunas CANCELADO e NÃO ENCONTRADO com peça saindo, do aviso e da janela "O que aconteceu?" no PCP, da pergunta "Para onde vai este móvel?" e do Estoque antes/depois da Estante Basic 7 nichos), o que a trilha nova já mostrou sobre as recargas, as pendências que precisam de mim e as decisões provisórias, em português de gente, sem códigos.
```
