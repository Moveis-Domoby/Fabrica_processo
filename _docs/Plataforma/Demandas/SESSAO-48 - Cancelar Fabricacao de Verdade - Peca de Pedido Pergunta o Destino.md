---
titulo: "SESSAO-48 — Cancelar a fabricação de verdade: mover para a coluna CANCELADO cancela a peça, ela sai da produção na hora e some da coluna depois de 7 dias (guardada, recuperável)"
tipo: demanda
status: 📐 pronta para code
data: 2026-11-11
atualizado: 2026-11-11 (01:27 — o dono trocou o desenho: sem botão; o movimento para CANCELADO é o gesto; limpeza em 7 dias com registro para recuperar)
origem: vídeo do dono de 10/11 (17:28) — Estoque mostrando a Estante Basic 7 nichos com "2 reservados p/ produção" e o quadro da LIMPEZA E EMBALAGEM com as duas peças do pedido 13622 na coluna CANCELADO há 138 h. Investigado no Cowork com leitura do banco de produção (11/11, ~01:30) e do código (main em 4e4a571). Só leitura: nada foi alterado.
revisa: ↩️ a D-61 (peça de pedido em produção não segue mais sozinha para o estoque quando é cancelada — a plataforma pergunta o destino). ↪️ usa a D-201 (peça em produção passa para outro pedido), a régua de "peça igual" da D-62, a regra de que o PCP segue o Tiny (D-132) e o padrão de arquivar com fato (nunca apagar).
tags: [plataforma, demanda, producao, cancelamento, estoque, pcp, logistica, kanban]
---

# 🎯 SESSAO-48 — Cancelar a fabricação de verdade

> **Número:** 48 era o próximo livre na main em 11/11 (a 47 foi a última entregue). Confira na `000 - ORDEM DAS SESSOES`; se já estiver usado, pegue o próximo e corrija o título.
> **Primeiro passo da sessão:** esta demanda já está em `_docs/Plataforma/Demandas/` e linkada na Ordem das Sessões — só confira.
> **Quatro frentes:** 1 (mover para CANCELADO cancela), 2 (peça de pedido pergunta o destino), 3 (a limpeza dos 7 dias e a recuperação) e 4 (o acerto do que já está parado lá, **só com o OK do dono**). Um commit por frente. Se o tempo apertar, entregue na ordem 1 → 3 → 2 → 4.

## O pedido do dono (texto fiel, 11/11)

*"O móvel aparece que está em produção, no entanto, está em cancelado. Ou seja, não deveria aparecer em produção. Quando for um PEDIDO, pergunta para onde vai mover aquele móvel que seria do pedido que foi cancelado. Caso seja um estoque que foi cancelado a fabricação apenas tire aquele móvel da produção."*

**Ajuste do dono (11/11, 01:27) — vale por cima do resto:** *"Não colocaremos botões, só o mover para cancelado já deve cancelar a peça e ela é excluída depois de 7 dias pra não inflar a coluna com muitos cards, ficando apenas o log de exclusão para recuperarmos caso necessário."*

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

### 4. O 13622 não está cancelado para a plataforma
- No Tiny, o 13622 está **"Em aberto"** desde 08/10 (R$ 14.051,90, marcador "1ª venda", 31 peças). Para a plataforma, é um pedido **vivo** com 31 peças em produção — por isso conta.
- A plataforma não tem como adivinhar que ele foi cancelado: a verdade da situação do pedido é o Tiny (D-132). **Pergunta para o dono (ver "Para o dono" no fim):** o 13622 foi cancelado? Se sim, o caminho certo é cancelar no Tiny — e, com esta demanda, a plataforma pergunta o destino de cada peça dele.

---

## A regra nova (uma só, no banco)

**Mover a peça para a coluna CANCELADO é o gesto de cancelar a fabricação.** Não existe botão novo no card. Toda peça que entra no CANCELADO:

1. **sai da produção na hora**: some do "reservados p/ produção" do Estoque e do Top 20, dos contadores, dos painéis e das contas do PCP e da Expedição. O tempo de fila dela **para de contar**;
2. **continua visível na coluna CANCELADO por 7 dias**: dá para conferir e, se foi engano, arrastar de volta, o que desfaz o cancelamento;
3. **some da coluna no 8º dia**: fica guardada e arquivada, **não apagada**, com o registro da exclusão. A peça pode ser recuperada pela busca/histórico.

Uma ressalva para o dono: "excluída" na plataforma é **arquivada com registro**, nunca apagada do banco. A regra da casa é que nada é apagado, e é isso que permite recuperar a peça e manter a história dela.

| A peça é… | Ao soltar no CANCELADO |
|---|---|
| **De estoque** (sem pedido: reposição, lançamento manual) | **Cancela direto**, sem pergunta. |
| **De pedido** | A peça **já fica cancelada** e a plataforma **pergunta para onde vai o móvel** (frente 2). |

### Frente 1 · Mover para CANCELADO cancela
- A etapa ganha um sinal novo (no padrão de `conclui_producao`): **`cancela_fabricacao`**, ligado só no CANCELADO da LIMPEZA E EMBALAGEM. O admin pode ligar ou desligar o sinal em Configurações → etapas do setor, no mesmo lugar de "conclui a produção".
- **Qualquer caminho de chegada vale:** arrasto no quadro, tablet, Mover da liderança e a janela "Liberar unidades" do PCP com essa etapa escolhida. Quem pode soltar lá é quem já pode mover o card hoje; nada muda de permissão.
- **Efeito no banco**, a cada peça que chega:
  - um **fato novo** `fabricacao_cancelada` (append-only, RNF-05) com autor, de onde veio e o pedido/reposição;
  - uma projeção no card, `cancelada_em`, no padrão de `standby_desde`;
  - a peça sai de todas as contas pela **regra única**: no `fn_estoque_categoria`, peça cancelada não tem categoria; o mesmo vale para quadro, PCP, Expedição e painéis;
  - gera log (D-40) e aparece na Auditoria e no histórico da peça;
  - aviso ao vivo pelo canal do setor e do estoque, sem recarregar.
- **Na coluna:** o card mostra **"Cancelada em dd/mm · some em N dias"** no lugar do tempo de fila. Ninguém inicia, pausa ou trabalha peça cancelada: o banco recusa e a tela não oferece.
- **Arrastar de volta** dentro dos 7 dias (para qualquer etapa de produção): fato `fabricacao_retomada`. A peça volta a contar e o tempo de fila recomeça na etapa nova. Se ela era de pedido e a frente 2 já a desvinculou, ela volta **sem dono** (provisória).
- **Do lado da reposição (provisória, no padrão da D-201):** a reposição **só perde a peça**. A vaga continua contada como liberada e a reposição não pede de novo; se o estoque ficar abaixo do mínimo, a reposição automática ou a logística lançam de novo, como hoje.
- **Escrita idempotente:** soltar duas vezes produz um efeito só.

### Frente 2 · Peça de pedido: a pergunta "Para onde vai este móvel?" (↩️ revisa a D-61)
- **Quando aparece:**
  1. **ao soltar** uma peça de pedido no CANCELADO, a pergunta abre **na hora, para quem soltou** (é uma pergunta, não um botão no card);
  2. **quando o Tiny cancela o pedido** e ele tem peça em setor de produção, não concluída: a plataforma **move sozinha** essas peças para o CANCELADO (o mesmo gesto da frente 1, autor "automação") e o **sino da logística e do admin** traz a pergunta: *"O pedido 13702 foi cancelado no Tiny. 3 móveis dele estavam em produção e foram para o CANCELADO — decida para onde vão."* Peça pronta (aguardo/ROTAS) continua indo sozinha ao ESTOQUE, como hoje.
- **As opções**, peça por peça ou todas de uma vez, lidas numa requisição ao abrir (padrão da janela "Decidir situação" da devolução):
  1. **"Fica cancelada"** (padrão): a peça perde o pedido e segue o caminho da frente 1, sumindo da coluna em 7 dias.
  2. **"Seguir para o estoque"**: a peça perde o pedido (`unidade_desvinculada`), **sai do CANCELADO** para a etapa de onde veio (a fila do setor quando veio do PCP) e continua a produção como estoque, sem dono. Volta a contar como produção para o estoque.
  3. **"Passar para outro pedido"**: lista os pedidos vivos que precisam do **mesmo móvel** (régua da D-62, maquinaria da D-201: `fn_sugestoes_em_producao` / `peca_vinculada`). A peça passa a ser do pedido escolhido e sai do CANCELADO para a etapa de onde veio. Se nenhum pedido precisa, a opção fica desabilitada e a tela explica por quê.
- **Fechou a pergunta sem responder:** vale "Fica cancelada". A pendência fica no sino até alguém decidir ou até os 7 dias passarem.
- **Quem decide:** quem soltou a peça; pelo sino, logística e admin.
- **Pedido vivo no Tiny** (o caso do 13622 — Em aberto): soltar no CANCELADO também cancela a peça (pedido do dono: o movimento cancela). A pergunta mostra um **aviso**: *"O pedido 13622 está Em aberto no Tiny. Se ele foi cancelado, cancele também no Tiny."*
  - **Provisória:** a vaga do pedido **não volta sozinha para o PCP**. O pedido aparece na Expedição/PCP como "peça cancelada na fábrica", e a logística decide. Assim um pedido cancelado só na fábrica não reaparece inteiro para produzir.
- **Pedido "descancelado" no Tiny** (voltou para Em aberto) com peça ainda nos 7 dias e sem decisão: a peça continua cancelada, e o sino avisa a logística para arrastar de volta se for o caso (provisória).

### Frente 3 · A limpeza dos 7 dias e a recuperação
- **A coluna só mostra o que foi cancelado nos últimos 7 dias.** É um filtro na leitura: a porta do quadro e o "Ver mais" da coluna leem só `cancelada_em` ≥ agora − 7 dias, com índice. Assim a coluna nunca incha, mesmo antes da limpeza rodar.
- **A exclusão em si** (o registro que o dono pediu): no 8º dia a peça recebe o fato `card_arquivado` com motivo *"Fabricação cancelada há mais de 7 dias — removida da coluna CANCELADO"* e sai de vez do quadro.
  - **Sem relógio novo (regra 18):** use a **rotina diária da madrugada que já existe** (a conferência com o Tiny), acrescentando esse passo, ou outro mecanismo de prazo já em uso no banco. Se nenhum servir, pare e registre a escolha como decisão.
  - Nada é apagado: o card e toda a história ficam no banco.
- **Recuperar:** a peça arquivada aparece na **busca geral** (lupa/Ctrl+K) e na **Auditoria** com o motivo. O **admin** recupera por lá (provisória: só admin), com o fato `fabricacao_retomada` + reabertura do arquivamento. A peça volta para a **fila da LIMPEZA E EMBALAGEM** (provisória), sem dono se já tinha perdido o pedido.
- Os **7 dias** ficam numa configuração do setor (provisória: Configurações → Controle do quadro, padrão 7), sem número escrito no código.

### Frente 4 · O acerto do que já está parado lá (**só com o OK do dono**, regra 2)
Manutenção de dado em `supabase/manutencao/AAAA-MM-DD_cancelado_vira_gesto.sql`, ensaiada antes com contagens antes/depois, aplicada **só com o OK do dono na conversa**, origem `api`, um fato por peça:
- **As 17 peças de reposição no CANCELADO** → `fabricacao_cancelada` com a data de hoje, para ganharem os 7 dias de conferência antes de sumir.
- **12728 e 13702** (cancelados no Tiny, 1 peça cada) → canceladas e com a pergunta no sino da logística.
- **13622** (Em aberto no Tiny, 30 peças no CANCELADO) → **não mexer até o dono responder** se o pedido foi cancelado. Se foi, ele cancela no Tiny e as peças entram pela frente 2.
- **NÃO ENCONTRADO** (4 peças) → não mexer.
- Depois: recontar os números do estoque (`fn_estoque_numeros_recontar`) e conferir a Estante Basic 7 nichos e os 30 móveis afetados, antes e depois.

---

## Fora do escopo
- Botão novo no card para cancelar (o dono pediu sem botão).
- Mudar a D-132 (o PCP segue o Tiny) ou cancelar pedido no Tiny pela plataforma.
- A coluna NÃO ENCONTRADO (fica como está; pergunta para o dono).
- Peça pronta de pedido cancelado (aguardo/ROTAS): continua indo sozinha ao ESTOQUE.
- Cancelar vaga de reposição que ainda está no PCP.
- Apagar linha do banco (nunca: arquivar com fato).
- Mexer no fluxo do n8n.

## Critérios de aceite

**Frente 1**
- [ ] Soltar peça de estoque no CANCELADO tira ela na hora do "reservados p/ produção" do Estoque e do Top 20, dos contadores e dos painéis, sem recarregar.
- [ ] Na coluna, o card mostra quando foi cancelado e em quantos dias some; o tempo de fila não conta e ninguém inicia a peça.
- [ ] Arrastar de volta dentro dos 7 dias desfaz: a peça volta a contar, com fato e log.
- [ ] Liberar no PCP direto no CANCELADO cancela do mesmo jeito. Soltar duas vezes produz um efeito só.

**Frente 2**
- [ ] Soltar peça de pedido no CANCELADO abre a pergunta para quem soltou; fechar sem responder = fica cancelada.
- [ ] Pedido cancelado no Tiny com peça em produção: as peças vão sozinhas para o CANCELADO, e o sino avisa logística e admin com a pergunta.
- [ ] "Seguir para o estoque" e "Passar para outro pedido" tiram a peça do CANCELADO para a etapa de onde ela veio; a outra opção só lista pedido vivo que precisa do mesmo móvel e cobre a vaga dele.
- [ ] Pedido vivo no Tiny: a peça cancela, o aviso aparece e a vaga não volta sozinha ao PCP.

**Frente 3**
- [ ] A coluna CANCELADO só mostra os últimos 7 dias, mesmo antes da limpeza rodar.
- [ ] No 8º dia a peça é arquivada com o motivo, sem relógio novo; nada é apagado.
- [ ] Admin acha a peça na busca geral e na Auditoria e a recupera; ela volta para a fila da LIMPEZA E EMBALAGEM.

**Frente 4**
- [ ] Ensaio com contagens antes/depois; aplicado só com o OK do dono; a Estante Basic 7 nichos e os outros móveis afetados mostram o número certo.

**Geral**
- [ ] Celular (375) e tablet (768) sem rolagem lateral; botões com tamanho de toque.
- [ ] Bateria do banco 2×, tsc, lint, vitest, build, advisors sem nada novo além do esperado.
- [ ] Lei de desempenho: cada tela em 1 requisição, sem relógio novo (trabalho nasce do fato); a pergunta lê só ao abrir; plano ×100 das portas novas ou tocadas no handoff.

## Notas para o Claude Code

- **Leia** `SUPA - Esquema do Banco`, a Lei de Desempenho e a Memória de Aprendizado. Recrie toda função a partir da **versão viva** do banco, conferindo o md5 do corpo (A-96/A-97). Reaplicar migration antiga já desfez trabalho novo.
- **Onde mora:**
  - **A regra única do que conta:** `plt_privado.fn_estoque_categoria`. Peça cancelada fica sem categoria, e a mudança vale nas assinaturas e nos chamadores. Daí para `fn_estoque_numeros_cards` / `_recontar` → `fn_reservados_producao` → `plt_fn_estoque_produtos`, o Top 20 e o Estoque. Confira também os contadores do quadro (`fn_quadro_total`), o PCP, a Expedição e os painéis de produção.
  - **A chegada na etapa:** `plt_fn_soltar_card`, `plt_fn_mover_card`, `plt_fn_card_mover_para_fila`, a liberação do PCP (`ModalLiberarPedido` deixa escolher a etapa) e o gatilho de projeção do card (`fn_projetar_posicao` / `fn_projetar_card`). O cancelamento nasce do **fato de chegada** na etapa com `cancela_fabricacao`, em gatilho, para valer por qualquer caminho.
  - **Execução:** `fn_validar_execucao` recusa iniciar/retomar peça cancelada.
  - **Cancelamento do Tiny:** `plt_privado.fn_desvincular_por_cancelamento` (gatilho `plt_eventos_zz_desvincular_cancelados`) e `fn_reagir_pedido`. A peça em produção passa a ir para o CANCELADO, e aguardo/ROTAS seguem iguais.
  - **"Passar para outro pedido":** `plt_privado.fn_sugestoes_em_producao` e o fato `peca_vinculada` (D-201, `fn_projetar_peca_vinculada`, `fn_recalcular_liberacao`).
  - **A pergunta:** o padrão de `ModalDecidirDevolucao` / `src/logistica/devolucao.ts`.
  - **O card:** `src/kanban/componentes/CartaoUnidade.tsx`. Hoje ele mostra "Pedido cancelado — pronta, vai para o estoque", lido de `pedidoCancelado`; isso sai para a peça em produção.
  - **A limpeza:** a rotina diária da madrugada (`plt-tiny-pente-fino`, `fn_tiny_pente_fino_iniciar`) ou outro mecanismo de prazo já existente. Nada de relógio novo.
  - **Recuperar:** a busca geral (`plt_fn_busca_cards`, que já traz arquivados com o motivo) e a Auditoria.
  - **Tipos novos de evento** entram no check `plt_eventos_tipo_check`; o `validate` muda para a migration nova (E-19).
- **Eventos são append-only:** cancelar, retomar e excluir são fatos novos; nada é editado ou apagado. Toda atividade gera log.
- **Regra 2:** migration, manutenção de dado e publicação só com aprovação do dono na conversa, cada uma em passo separado.
- **Decisões provisórias a registrar (D-NN):**
  - "excluir" = arquivar com fato, nunca apagar;
  - o prazo de 7 dias numa configuração;
  - só admin recupera, e a peça recuperada volta para a fila da LIMPEZA E EMBALAGEM;
  - retomada de peça já desvinculada volta sem dono;
  - a reposição só perde a peça;
  - fechar a pergunta = fica cancelada;
  - pedido vivo no Tiny: a vaga não volta sozinha ao PCP;
  - pedido "descancelado": a peça continua cancelada e o sino avisa;
  - onde roda a limpeza diária.
- Com o dono: português de gente, sem códigos (regra 12c).

## Para o dono (perguntas que não travam a sessão — as respostas viram decisão)
1. **O pedido 13622 foi cancelado mesmo?** No Tiny ele está "Em aberto". Se foi, cancele no Tiny; se não foi, para onde as 30 peças dele voltam?
2. **E o NÃO ENCONTRADO?** Hoje tem 4 peças lá (2 de pedidos cancelados e 2 de estoque) e elas também contam como "em produção". Quer o mesmo tratamento numa próxima demanda?
3. **Peça de pedido vivo no Tiny solta no CANCELADO:** a vaga dela deve voltar ao PCP para produzir de novo, ou a logística decide caso a caso (como ficou provisório)?

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)
- *A criar com o OK do dono:* "Produção - Mover para Cancelado cancela a fabricação" · "Produção - Pedido cancelado pergunta o destino de cada móvel" · "Produção - Coluna Cancelado limpa em 7 dias com recuperação".

## Resultado (preencher ao entregar)

*O que foi feito, o que mudou de rota, link do handoff da sessão.*

---

## Prompt para abrir no Claude Code (pasta "Domoby - fabrica")

```
Você é o engenheiro executor da Plataforma de Produção da Móveis Domoby. Atualize a main, siga a ordem de leitura do CLAUDE.md da raiz e execute a demanda "SESSAO-48 — Cancelar a fabricação de verdade" (já está em _docs/Plataforma/Demandas/ e linkada na Ordem das Sessões; confira se o número 48 está livre). Leia duas vezes — o ajuste que fiz às 01:27 de 11/11 (sem botão: mover para CANCELADO cancela, e a peça some da coluna em 7 dias, guardada para recuperar) vale por cima do resto.

As respostas de negócio estão dentro da demanda: não me pergunte nada de negócio; o que faltar vira decisão provisória registrada. As três perguntas do fim da demanda são para mim e não travam a sessão. Branch nova a partir da main, commits pequenos com push a cada frente. Migration, o acerto das peças paradas e publicação só com o meu OK.

Ao terminar: o que foi feito, como testar passo a passo (com prints da coluna CANCELADO com a peça cancelada, da pergunta "Para onde vai este móvel?" e do Estoque antes/depois da Estante Basic 7 nichos), as pendências que precisam de mim e as decisões provisórias, em português de gente, sem códigos.
```
