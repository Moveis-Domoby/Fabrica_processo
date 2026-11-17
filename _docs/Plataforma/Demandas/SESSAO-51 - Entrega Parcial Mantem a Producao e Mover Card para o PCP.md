---
titulo: "SESSAO-51 — Entrega parcial que mantém a produção (com revogar) e mover card da produção de volta ao PCP"
tipo: demanda
status: ✅ no ar (17/11/2026 ~07:20 — banco e site, com o OK do dono)
data: 2026-11-16
atualizado: 2026-11-16 (22:45 — pedido do dono; mapeado no chat, decisões em aberto viraram provisórias marcadas)
origem: pedido do dono de 16/11 (22:41, ajustes noturnos). Lido na cópia local da main (última atualização dos arquivos em 12/11): migrations da 41, 47, 48 e 50 e as decisões D-54, D-130, D-156, D-195, D-201, D-213, D-307…D-313. Só leitura: nada foi alterado. O banco vivo NÃO foi lido nesta etapa (o conector Supabase do Claude aponta para outra organização) — tudo que diz "hoje" vem do código das migrations e tem de ser conferido no banco vivo.
revisa: ↩️ D-195 (entrega parcial — o que ainda está na fábrica deixa de ir para a devolução) · ↪️ usa D-213 (reabrir a entrega), D-307/D-309 (máquina do Ocultar), SESSAO-48 (vaga que volta ao PCP), D-201 (peça em produção ligada a pedido), D-54/D-85 (reposição), D-130 (a peça é uma só)
tags: [plataforma, demanda, rotas, entrega-parcial, pcp, kanban, reposicao]
---

# 🎯 SESSAO-51 — Entrega parcial que mantém a produção e mover card de volta ao PCP

> **Número:** confira na `000 - ORDEM DAS SESSOES` depois de atualizar a main; se 51 estiver usado, pegue o próximo e corrija o título e o nome do arquivo.
> **Primeiro passo:** este arquivo foi colocado na pasta pelo chat **antes** de atualizar a main (ele pode aparecer como arquivo novo, fora do git). Atualize a main, confira se nada colidiu, **linke a demanda na Ordem das Sessões** (status `🔨 em execução`) e só então comece.
> **Se a SESSAO-49 (dieta da documentação) já estiver na main**, use a rota de leitura nova (seção "Leitura da sessão"). Se não, siga o CLAUDE.md de hoje.
> **Dois blocos independentes** (A e B), um commit por frente. Se o tempo apertar: **A → B**.

## O pedido do dono (texto fiel, 16/11 22:41)

1. *"Quando um pedido for lançado para entrega parcial, os produtos que ainda estão em produção continuam em produção, a menos que o responsavel queira remover os mesmos da linha, entao quando um pedido for para entrega parcial, deve aparecer um botão para deixar os outros em produção, ou limpar todos os cards da produção, podendo revogar essa decisão em todos os pedidos, tendo um botão la apenas para os que tiveram essa decisão tomada, de revogar e remover da linha de produção, ou revogar e retornar todos para produção com as etapas exatas de onde eles pararam"*
2. *"Possibilidade de mover o card/produto para o PCP, com a tomada de decisão se aquele produto do card irá virar uma reposição de estoque ou simplesmente voltar para o PCP, ou seja, se um card já está em produção e um admin quiser mover o mesmo para PCP novamente, ele deve conseguir, porem selecionando se o produto agora passa a virar reabastecimento de estoque, ou simplesmente volta para PCP por N motivos"*

**Como o pedido foi lido (vale como regra desta demanda):**
- **"Revogar"** = desfazer a decisão tomada na entrega parcial, quantas vezes for preciso. Cada pedido mostra **só o botão contrário** ao que está valendo agora:
  - decisão "deixar em produção" → **"Revogar e remover da linha de produção"**;
  - decisão "limpar da produção" → **"Revogar e voltar tudo para a produção"**, cada peça na **etapa exata** em que estava.
- **"Mover para o PCP"** = tirar a peça do quadro de produção e devolvê-la ao PCP de duas formas: como **vaga do pedido** (com motivo) ou como **reposição de estoque**. Nas duas, o PCP decide de novo pela liberação de sempre.

---

## O que o código mostra hoje (cópia local da main, 12/11 — conferir no banco vivo)

**Entrega parcial** — `public.plt_fn_entrega_parcial(p_card_id, p_entregues, p_motivo_id, p_observacao, p_confirmar_incompleto)`. A última versão está em `20261109030000_plt_entrega_dia_real.sql`; a original, em `20261027040000`.
- Ela pega **todas as peças vivas do pedido**, sem olhar onde estão. As marcadas são arquivadas como entregues.
- **As desmarcadas vão TODAS para "Em decisão pós devolução"** (`movimentacao_setor` para o setor `devolucao`), **inclusive as que ainda estão em MONTAGEM, PINTURA etc.**: a peça é arrancada do setor de produção.
- Se houver peça fora de setor terminal, pede a confirmação *"Este pedido ainda aparece em produção na fábrica (X de Y peças prontas). Confirmar a entrega encerra tudo dele."* (D-156).
- Ela grava `pedido_entregue` (parcial) no card do pedido. Com `entrega_evento_id` preenchido, **o pedido sai do PCP** (as portas do PCP filtram `entrega_evento_id is null`), e **as vagas que ainda não tinham sido liberadas somem**.
- O pedido com peça reservada do estoque recusa a entrega parcial. Isso continua como está.
- **É exatamente o que o dono não quer:** o que ainda está na fábrica tem de continuar na fábrica, a não ser que alguém decida limpar.

**Mover card da produção para o PCP:** **não existe.**
- O que existe e serve de base:
  - a peça cancelada devolve a vaga ao PCP com aviso (SESSAO-48);
  - o "Ocultar o pedido e as peças" arquiva com registro (`card_oculto`, `unidade_desvinculada`; D-307);
  - a peça em produção ligada a um pedido (`peca_vinculada`, D-201);
  - a reposição (`tipo = 'reposicao'`, aba Reabastecimento; D-54);
  - o ajuste de peça (D-130, "a peça é uma só").

---

# BLOCO A · Entrega parcial com o que ainda está na fábrica

## Frente 1 · A janela da entrega parcial separa o que saiu do que ficou na fábrica

A janela `ModalEntregaParcial` (entregador e ROTAS → Entregas) passa a ter **dois grupos**:

1. **"Saíram para a entrega"**: as peças prontas (setor terminal, fora da devolução). **Vêm marcadas**, como hoje.
   - Desmarcada = **voltou** → "Em decisão pós devolução", **como hoje** (D-195 inalterada para elas).
2. **"Ainda na fábrica"**: as peças vivas em setor de produção, com setor e etapa, por exemplo *"Guarda-roupa 3/4 — MONTAGEM · Montando"*, e a linha *"+ N produtos ainda no PCP, sem liberar"*. **Vêm desmarcadas.**
   - Marcar uma = "essa foi entregue mesmo, a plataforma estava atrasada" → sai como entregue, com a confirmação de hoje (D-156).
   - As que continuam desmarcadas **não vão para a devolução**: seguem a decisão da frente 2.

**Regras:**
- O grupo 2 só aparece quando o pedido tem algo ainda na fábrica. Sem isso, a janela fica idêntica à de hoje.
- Motivo da lista e/ou observação continuam obrigatórios (pelo menos um), como hoje.
- Modal próprio do sistema, bom em 375 e 768, com botões de toque.

## Frente 2 · A decisão: "Deixar em produção" ou "Limpar da produção"

Quando o grupo 2 tem algo desmarcado, a janela pergunta **"E o que ainda está na fábrica?"**, com duas opções:

- **"Deixar em produção"** (vem selecionada):
  - *"As N peças seguem onde estão e os M produtos seguem no PCP para liberar. Quando ficarem prontos, o pedido volta para ser programado."*
- **"Limpar da produção"**:
  - *"As N peças saem dos quadros e os M produtos saem do PCP. Dá para voltar atrás em PCP → Entregas parciais."*

**Quem escolhe** *(provisória)*:
- **logística, PCP e admin** escolhem;
- o **entregador** vê só a informação e a opção "Deixar em produção". Na rua ele não decide tirar peça da linha; a logística revoga depois, se quiser.

### "Deixar em produção" — o que acontece
- As peças **não mudam nada**: setor, etapa, quem trabalha nelas, tempo e prioridade continuam iguais.
- **O pedido fica vivo para o resto em toda regra de pedido vivo:**
  - PCP: as vagas não liberadas continuam em "Aguardando liberação";
  - Expedição e Pedidos em aguardo: as peças entram quando ficarem prontas;
  - Programação de rotas: o pedido volta a ser programável quando houver peça pronta.
- Em todo lugar, o pedido mostra **"Entregue em parte (N de M)"**, mais *"K ainda em produção"* quando for o caso.
- **Como implementar:** antes de inventar algo, leia o caminho único de **reabrir a entrega** (D-213: "um caminho só… por evento") e a regra do pedido vivo (`vw_pedidos_vivos_regra`, `fn_fora_do_pcp`, os filtros `entrega_evento_id is null`). Escolha a forma mais limpa e registre a escolha. Duas formas possíveis:
  - a parcial reabre a entrega para o restante;
  - ou uma projeção nova `entrega_parcial_pendente`, que as portas tratam como pedido vivo.
- **Entregar o resto depois:** o "Entregue" normal fecha tudo e vai ao Tiny, como hoje (D-113/D-276).
- **O Tiny não muda na parcial** (D-195 inalterada).
- **Atenção à D-113:** se alguém marcar o pedido como "Entregue" **no Tiny** enquanto o resto ainda está em produção, a regra de hoje fecha tudo. **Não mude essa regra.** Só garanta que o pedido sai da lista "Entregas parciais" e que a trilha mostra o porquê.

### "Limpar da produção" — o que acontece
- **Peças em produção** (as que ficaram desmarcadas no grupo 2):
  - o tempo aberto fecha antes (`fn_fechar_tempo_aberto`), e a pausa ou o stand-by fecham;
  - cada peça recebe o fato novo **`peca_retirada_entrega_parcial`**, que guarda **setor, etapa, posição na fila, pedido, item, k/n** e a entrega parcial de origem;
  - ela é **arquivada com registro** e sai dos quadros e de todas as contas (produção, estoque, painéis, contadores), pela mesma regra única que tira a peça oculta ou cancelada (`fn_estoque_categoria`);
  - **ela não perde o pedido** *(provisória)*: o fato guarda o vínculo, para a volta (frente 3) devolver a mesma peça ao mesmo pedido.
- **Vagas não liberadas no PCP:** saem do PCP. É o comportamento de hoje (o pedido entregue fica fora do PCP). Elas ficam registradas no mesmo fato, no card do pedido, para a volta reabrir.
- Nada é apagado: a busca geral e a Auditoria acham a peça, com o motivo.
- Sino para o PCP: *"Pedido N entregue em parte — K peças retiradas da produção por Fulano."*

## Frente 3 · Revogar a decisão — a aba "Entregas parciais"

**Onde:**
- no PCP, uma aba nova, **"Entregas parciais"**, ao lado de Cancelados e Pedidos ocultos *(provisória quanto ao lugar)*;
- na **ficha do pedido**, a decisão atual e o mesmo botão.

**A lista** mostra só os pedidos entregues em parte **que tiveram a decisão tomada e ainda podem ser revogados**:
- número, cliente, dia da entrega parcial, quem decidiu e quando;
- a decisão que vale agora:
  - *"Seguem em produção: 2 peças · 1 produto no PCP"*, ou
  - *"Retiradas da produção: 2 peças · 1 produto do PCP"*;
- **um botão só, o contrário da decisão atual.**

**Regras da lista:**
- uma requisição por página, com cursor, busca por número ou cliente e ordem do mais recente;
- sem prazo *(provisória)*: o pedido fica na lista enquanto puder ser revogado.

**Sai da lista quando:** o resto do pedido é entregue, o pedido é cancelado ou excluído no Tiny, o Tiny marca "Entregue" (D-113), o pedido é ocultado do PCP ou não sobra nada na fábrica nem no PCP. Nesses casos, o banco recusa o revogar e explica o porquê.

### "Revogar e remover da linha de produção" (a decisão valendo é "deixar")
- Modal próprio com a contagem lida **ao abrir**, numa requisição: *"Tirar da produção as 2 peças (1 em MONTAGEM · Montando, 1 em PINTURA · Fila) e o produto ainda no PCP do pedido N?"*
- Faz **exatamente o "Limpar"** da frente 2, **naquele momento**: cada peça guarda o setor e a etapa **de agora**.
- Peça que ficou pronta nesse meio-tempo (Pedidos em aguardo ou Expedição) ou que já está numa rota: **não é removida** *(provisória)*. O modal diz quantas ficaram e onde.

### "Revogar e voltar tudo para a produção" (a decisão valendo é "limpar")
- Modal próprio com a lista lida ao abrir: *"Guarda-roupa 3/4 → volta para MONTAGEM · Montando"*.
- Cada peça retirada **volta a ser a mesma peça** (desarquivada, com a história dela), **no mesmo setor e na mesma etapa**, ligada de novo ao pedido e ao item (o k/n se mantém).
- **O tempo:**
  - a fila do setor recomeça a contar no instante da volta; o tempo em que ela ficou fora não conta como fila nem como execução;
  - **ninguém volta a trabalhar nela sozinho** *(provisória)*: ela volta na fila da etapa, e quem for trabalhar aperta "Iniciar".
- **A posição na fila:** a mesma ordem relativa, quando possível; se não der, o fim da etapa *(provisória)*.
- **A etapa foi arquivada ou apagada nesse meio-tempo:** a peça volta para a primeira etapa ativa do mesmo setor. **O setor não existe mais:** ela vira vaga no PCP. Nos dois casos, o modal avisa *(provisória)*.
- As vagas retiradas do PCP **reabrem em "Aguardando liberação"**.
- O pedido passa a valer como "deixar em produção" (pedido vivo para o resto).
- Sino para o PCP e os setores que recebem peça, pelo aviso ao vivo de sempre (nada de relógio).

**Geral:**
- Cada revogar = um fato no card do pedido (`entrega_parcial_decisao_revogada`, com antes, depois e autor). Um toque, uma chamada idempotente (com chave).
- Pode ir e voltar quantas vezes precisar. A trilha mostra todas as idas e voltas.
- Quem usa: logística, PCP e admin (`fn_pode_ver_expedicao`).
- **Pedidos entregues em parte ANTES desta sessão** não ganham decisão nem acerto automático: as peças deles já foram para a devolução pela regra antiga. Só **conte e liste no handoff** quantos são e onde estão as peças.

---

# BLOCO B · Mover card da produção de volta ao PCP

## Frente 4 · O botão "Mover para o PCP" e a janela da decisão

**Onde:** no menu ⋯ do card de unidade, nos quadros de setor e na janela do card. **Não aparece no tablet.**

**Quem usa:** **admin e super admin** (palavras do dono: *"um admin"*) *(provisória: o papel PCP não ganha o botão)*.

**Em que peça aparece:** peça viva em **setor de produção**, ou seja, fora de setor terminal.
- Não aparece em: Pedidos em aguardo, ESTOQUE, ROTAS, Em decisão pós devolução, Danificados, peça cancelada (CANCELADO/NÃO ENCONTRADO), peça em rota ou entregue.
- Card avulso e card de ajuste *(provisória)*: o botão não aparece, porque eles não nasceram no PCP.
- O banco recusa nos mesmos casos, com a explicação.

**A janela (modal próprio):**
- *"Mover para o PCP — Guarda-roupa Casal 3/4 (Pedido 13871) · MONTAGEM · Montando."*
- Se alguém trabalha nela agora: *"Franklin está trabalhando nela — o tempo dele fecha agora."*
- Duas escolhas:
  1. **"Voltar para o PCP"**: motivo da lista nova **Utilitários → "Volta ao PCP"** (sementes *provisórias*: "Liberada por engano", "Prioridade mudou", "Falta material", "Mudança no pedido", "Outro") e/ou observação. Pelo menos um dos dois.
  2. **"Virar reposição de estoque"**: *"A peça deixa o pedido e vai para o Reabastecimento do PCP. O pedido N continua precisando deste móvel: a vaga dele reabre no PCP."* Motivo e/ou observação, opcionais.
- **Peça sem pedido** (já é de reposição): só "Voltar para o PCP", que devolve a peça à reposição de origem como vaga.
- **Pedido fora do PCP** (oculto, cancelado ou levado adiante pelo Tiny): só "Virar reposição de estoque", com a explicação de por que a outra opção não está disponível *(provisória)*.

## Frente 5 · O que acontece em cada escolha

**Comum às duas:**
- o tempo aberto fecha e a pausa ou o stand-by fecham;
- o fato novo **`card_voltou_pcp`** guarda setor, etapa, posição, motivo, observação, escolha e autor;
- a peça é **arquivada com registro** e sai do quadro e de todas as contas pela regra única. Nada é apagado;
- o quadro e o PCP abertos mudam na hora, pelo aviso ao vivo de sempre;
- log (D-40), Auditoria em português e sino para o PCP: *"Fulano devolveu ao PCP o Guarda-roupa 3/4 do pedido N (motivo)."*

**"Voltar para o PCP":**
- a **vaga dela reabre no pedido**, em "Aguardando liberação";
- o card do pedido no PCP ganha o selo *"1 voltou da produção: Prioridade mudou — estava em MONTAGEM · Montando"*;
- use a mesma conta que a SESSAO-48 já usa para devolver a vaga da peça cancelada, **sem** o aviso de cancelamento.

**"Virar reposição de estoque":**
- a peça **perde o pedido** (`unidade_desvinculada`, como no Ocultar) e **a vaga do pedido reabre no PCP**, com o selo *"1 virou reposição de estoque"*;
- nasce **1 unidade de reposição** do mesmo produto na aba **Reabastecimento**, com a origem *"Veio da produção — era do pedido N, estava em MONTAGEM · Montando"*;
- **o ciclo da reposição automática:**
  - confira se a regra do banco permite **um ciclo vivo por produto** (D-54);
  - se permitir só um, some a unidade ao ciclo vivo, guardando a origem; se não, crie um card de reposição à parte;
  - registre a escolha;
- **essa reposição não sai sozinha depois de 2 dias úteis** (D-85) *(provisória)*: ela representa uma peça física de verdade, não uma necessidade calculada;
- ela também não muda o mínimo nem a conta da reposição automática enquanto não for liberada (D-86).

**Liberar de novo — "a peça é uma só" (D-130)** *(provisória)*:
- Na janela **"Liberar unidades"** (do pedido ou da reposição), a vaga que voltou mostra **"Usar a mesma peça (estava em MONTAGEM · Montando)"**, **marcada de início**. A coluna sugerida é a etapa onde ela parou, e o PCP pode trocar.
- **Liberar com ela marcada** = a mesma peça é desarquivada, com a história e o k/n, na coluna escolhida. **Desmarcada** = nasce uma peça nova pelo caminho de sempre, e a antiga continua arquivada.
- **Na volta como reposição**, a peça liberada fica sem dono e pode ser usada por um pedido novo pela D-201, como qualquer peça de reposição.
- **A mesma janela vale para o Bloco A:** uma vaga que reabriu pelo revogar (frente 3) **não** passa por aqui, porque o revogar já devolve a peça direto para a etapa dela.

---

## Decisões provisórias desta demanda (registrar como D-NN ⏳)
1. Na entrega parcial, só logística, PCP e admin escolhem "Limpar da produção"; o entregador só deixa em produção.
2. A peça retirada pela entrega parcial **não perde o pedido**: o fato guarda o vínculo para a volta.
3. Revogar a remoção não tira peça já pronta nem em rota.
4. A peça que volta pelo revogar entra na fila da mesma etapa, sem execução aberta. Ordem relativa mantida, quando possível.
5. Etapa sumida → primeira etapa ativa do setor; setor sumido → vaga no PCP.
6. A aba "Entregas parciais" fica no PCP, sem prazo, e lista enquanto der para revogar.
7. "Mover para o PCP": admin e super admin, só em setor de produção, nunca em avulso ou ajuste.
8. Lista de motivos "Volta ao PCP" com as 5 sementes acima.
9. A reposição que veio da produção não sai sozinha depois de 2 dias úteis.
10. "A peça é uma só": a vaga que voltou oferece "Usar a mesma peça", marcada, na etapa onde parou.
11. Pedido fora do PCP só oferece "Virar reposição de estoque".

## Fora do escopo
- Mandar ao Tiny qualquer coisa da entrega parcial, do revogar ou do mover (o Tiny não muda).
- Mudar a D-113 ("Entregue" no Tiny fecha tudo).
- Acerto dos pedidos entregues em parte antes desta sessão (só contar e listar no handoff).
- Mover peça de setor terminal, cancelada, em rota ou entregue para o PCP.
- O botão no tablet.
- Mexer no fluxo do n8n. Se precisar, pare e peça o OK (regra 3).
- Apagar card, peça, vaga ou pedido do banco: nunca. Tudo é arquivado com fato.

## Critérios de aceite

**Bloco A**
- [ ] Num pedido de teste com 4 peças (2 prontas, 1 em MONTAGEM, 1 em PINTURA) + 1 vaga sem liberar, a janela mostra os dois grupos (prontas marcadas, na fábrica desmarcadas, com setor e etapa) e a linha "+1 no PCP".
- [ ] **"Deixar em produção":**
  - as 2 em produção continuam exatamente onde estavam (setor, etapa, pessoa, tempo);
  - a vaga continua no PCP;
  - o pedido mostra "Entregue em parte (2 de 5)";
  - quando a peça da MONTAGEM fica pronta, ela aparece em Pedidos em aguardo e o pedido volta a ser programável;
  - o "Entregue" do resto fecha o pedido e vai ao Tiny.
- [ ] **"Limpar da produção":**
  - as 2 peças saem dos quadros e de todas as contas (quadro, painéis, estoque, contadores batem);
  - a vaga sai do PCP;
  - a busca geral acha as peças, com o motivo.
- [ ] Peça pronta desmarcada continua indo para "Em decisão pós devolução", como hoje.
- [ ] O entregador não vê "Limpar da produção"; o banco recusa se ele tentar.
- [ ] **A aba "Entregas parciais":**
  - mostra só pedidos com decisão e só o botão contrário;
  - "Revogar e voltar tudo" devolve **as mesmas peças às mesmas etapas** (história e k/n preservados) e reabre a vaga no PCP;
  - "Revogar e remover" retira e guarda a etapa **atual**;
  - ir e voltar 3 vezes funciona; a trilha mostra as 3 idas e voltas; o toque repetido faz um efeito só.
- [ ] Etapa arquivada no meio do caminho: a peça volta para a primeira etapa do setor, e o modal avisa.
- [ ] O pedido sai da lista quando o resto é entregue, e o revogar é recusado com explicação.

**Bloco B**
- [ ] O admin vê "Mover para o PCP" no menu do card em setor de produção; o operador e o PCP não veem; em setor terminal, peça cancelada, avulso e ajuste, o botão não aparece, e o banco recusa.
- [ ] **"Voltar para o PCP"** com motivo:
  - a peça sai do quadro na hora (na tela aberta de outra pessoa também);
  - o tempo aberto fecha;
  - a vaga reabre no pedido, com o selo e o motivo.
- [ ] **"Virar reposição de estoque":**
  - a peça perde o pedido;
  - a vaga do pedido reabre;
  - 1 unidade aparece no Reabastecimento com a origem;
  - essa reposição não sai sozinha depois de 2 dias úteis.
- [ ] **"Liberar unidades":**
  - oferece "Usar a mesma peça", marcada, com a etapa onde parou sugerida;
  - liberar desarquiva a mesma peça, com a história;
  - desmarcar cria uma peça nova.
- [ ] Peça sem pedido só tem "Voltar para o PCP"; pedido fora do PCP só tem "Virar reposição", com explicação.

**Geral**
- [ ] Celular (375) e tablet (768) sem rolagem lateral; botões com tamanho de toque; modais próprios do sistema.
- [ ] Bateria do banco (regra da casa), tsc, lint, vitest, build e advisors sem nada novo.
- [ ] **Lei de desempenho:**
  - cada tela e cada aba em 1 requisição;
  - modais leem só ao abrir;
  - listas por cursor;
  - avisos ao vivo de sempre, sem relógio e sem consulta repetida;
  - o plano ×100 das portas tocadas vai no handoff.

## Notas para o Claude Code
- Recrie toda função a partir da **versão viva** do banco, conferindo o corpo (A-96/A-97). A cópia local usada para mapear é de 12/11 e pode estar atrás. Tipos novos de evento entram no `plt_eventos_tipo_check` (E-19); o motivo novo entra no check de `plt_motivos`.
- **Onde mora (lido nas migrations em 16/11 — confira no vivo):**
  - **A — entrega parcial:**
    - porta `plt_fn_entrega_parcial`: o parâmetro novo (por exemplo `p_fabrica text` = `'manter'|'limpar'`, padrão `'manter'`) entra **sem quebrar o site antigo**, porque a assinatura velha continua valendo como "manter";
    - o critério de "pronta" já existe na função: `papel_no_fluxo = 'terminal' and codigo <> 'devolucao'`;
    - leitura das peças só ao abrir: `plt_fn_entrega_pecas`;
    - front: `ModalEntregaParcial` (entregador e ROTAS → Entregas) e `src/rotas/ConfirmarEntrega.tsx`.
  - **A — pedido vivo e PCP:**
    - `plt_privado.fn_fora_do_pcp` (5 argumentos, `20261112020000`);
    - os filtros `entrega_evento_id is null` nas portas do PCP;
    - `vw_pedidos_vivos_regra`;
    - o caminho de reabrir a entrega (D-213);
    - `plt_fn_pcp_quadro`, `plt_fn_cards_pedido_pcp`, `plt_fn_pcp_liberacao`/`plt_fn_pcp_liberar` e `fn_recalcular_liberacao`.
  - **A e B — arquivar com registro:**
    - a máquina do Ocultar: `plt_fn_pcp_ocultar`, `plt_fn_pcp_saida_previa`, `card_oculto`, `unidade_desvinculada`;
    - a regra única de contas: `fn_estoque_categoria`;
    - o fechar tempo: `fn_fechar_tempo_aberto`;
    - a peça cancelada da 48, que devolve a vaga: `pcp_aviso_em` e `cancela_fabricacao`.
  - **B — reposição e reuso:**
    - `tipo = 'reposicao'` e a aba Reabastecimento;
    - a saída de 2 dias úteis (D-85) e a conta da necessidade (D-86);
    - `peca_vinculada`, `fn_sugestoes_em_producao` e `fn_vincular_peca_producao` (D-201): veja se a sugestão "usar a mesma peça" cabe na mesma requisição da janela "Liberar unidades".
  - **Permissões:** `fn_pode_mexer_entrega` (entregador), `fn_pode_ver_expedicao` (logística, PCP e admin) e o teste de admin de sempre.
- **Front (a conferir):** o menu ⋯ do card (`src/kanban/componentes/CartaoUnidade.tsx`), a janela do card, as abas do PCP (ao lado de `AbaCancelados` e `AbaPedidosOcultos`), `ModalLiberarPedido` e a ficha do pedido.
- **Regra 2:** migration, qualquer acerto de dado e publicação só com o OK do dono, cada um em passo separado. Subida de código na main publica o site.
- **Decisões a registrar (D-NN, como nota nova se a 49 já entrou):**
  - entrega parcial mantém a produção por padrão, com a opção de limpar (↩️ D-195);
  - a decisão se revoga quantas vezes for preciso, com o botão contrário;
  - "Mover para o PCP" com as duas escolhas;
  - mais as provisórias acima.
- **Com o dono:** português de gente, sem códigos (regra 12c).

## Leitura da sessão
- CLAUDE.md da raiz e as Regras de Ouro (se a 49 já entrou);
- esta demanda;
- D-195, D-156, D-113, D-213, D-307/D-309, D-54/D-85/D-86, D-130 e D-201;
- a SESSAO-48, só a parte da vaga que volta ao PCP e da peça cancelada;
- a SESSAO-50, só o bloco B (Ocultar e Recuperar);
- as notas de banco de Cards e eventos, PCP, Logística/ROTAS e Estoque;
- as lições de front.

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)
*A criar com o OK do dono:*
- "Rotas - Entrega parcial mantém a produção (deixar ou limpar) e aba Entregas parciais com revogar"
- "Produção - Mover card de volta ao PCP (vaga do pedido ou reposição de estoque)"

## Resultado (17/11/2026, madrugada)
- **Feito, no ramo `sessao-51-entrega-parcial-mover-pcp`** (7 commits; nada no banco de produção, nada na main): os dois blocos, as 5 frentes, com as provas do banco (A 46 ✔, B 35 ✔; bateria inteira 1.872 ✔ + os 2 ✘ conhecidos), os testes das telas, o ensaio ×100 e 25 fotos. Handoff: [[handoff_2026_11_17_sessao51_entrega_parcial_mover_pcp]].
- **O que mudou de rota:**
  - "Deixar em produção" foi feito sem mexer em nenhum filtro: o fato da entrega parcial com "deixar" não vira a entrega vigente do card do pedido — o pedido segue vivo em toda tela pela regra de sempre (D-325). A parada sai da rota do dia.
  - "Mover para o PCP" fica na janela do card, ao lado de "Mover": o card do quadro não tem menu "⋯" (D-330).
  - Achado: o quadro do PCP não filtra pela entrega — pela regra antiga, o pedido entregue em parte com produto sem liberar continuava em "Aguardando liberação" (D-334; a contagem sai no 1º passo da subida, só leitura).
  - A Programação, a Expedição e as Entregas do dia ainda não mostram "Entregue em parte" (D-328) — as portas delas devolvem uma tabela fixa.
- **No ar em 17/11 ~07:20** (banco e site, com o OK do dono; a conferência só lendo antes: 14/14 iguais; a única entrega parcial antiga — o 13869 — não precisa de acerto).
- **Pendente com o dono:** as tarefas do ClickUp; confirmar as provisórias D-326…D-334; conferir na tela.

---

## Prompt para abrir no Claude Code (pasta "Domoby - fabrica")

```
Você é o engenheiro executor da Plataforma de Produção da Móveis Domoby. Atualize a main, siga a ordem de leitura do CLAUDE.md da raiz e execute a demanda "_docs/Plataforma/Demandas/SESSAO-51 - Entrega Parcial Mantem a Producao e Mover Card para o PCP.md" (foi colocada na pasta antes do pull: confira se o número 51 está livre e linke na Ordem das Sessões). Bloco A, depois B. Branch nova a partir da main, um commit por frente, push a cada frente. Não me pergunte nada de negócio: o que faltar vira decisão provisória registrada. Migration, acerto de dado e publicação só com o meu OK, cada um em passo separado. Ao terminar: o que foi feito, como testar passo a passo com prints, as pendências que precisam de mim e as decisões provisórias, em português de gente, sem códigos.
```
