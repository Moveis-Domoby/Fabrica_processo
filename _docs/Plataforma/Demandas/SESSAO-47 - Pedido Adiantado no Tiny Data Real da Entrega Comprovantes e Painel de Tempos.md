---
titulo: "SESSAO-47 — Pedido adiantado no Tiny volta ao PCP, data real da entrega, vários comprovantes e configuração do painel de Tempos de produção"
tipo: demanda
status: 📐 pronta para code
data: 2026-11-09
origem: bug do pedido 13818 e pedidos do dono de 09/11, mapeados no Cowork com leitura do banco de produção e do código (main até 06/11). Só leitura: nada foi alterado.
revisa: nada. A D-132 (o PCP segue o Tiny) e a D-231 (a TV só mostra letras) continuam valendo. ↪️ complementa a D-133 (pedido vivo na Expedição), a liberação de peça da SESSAO-45, o "Entregue" das SESSOES 30/38 e o painel da SESSAO-43.
tags: [plataforma, demanda, expedicao, pcp, tiny, logistica, entregas, dashboards, tempos]
---

# 🎯 SESSAO-47 — Pedido adiantado no Tiny, data real da entrega, comprovantes e painel de tempos

> Gravada no repositório pelo Cowork em 09/11/2026, já linkada na [[000 - ORDEM DAS SESSOES]].
> **Três blocos independentes:** A (frentes 1–4, Tiny/PCP/Expedição), B (frentes 5–6, entrega) e C (frente 7, painel de tempos). Um commit por frente. Se o tempo apertar, entregue os blocos inteiros, nesta ordem, e deixe o resto escrito como próxima sessão.

## O pedido do dono (texto fiel, 09/11)

**Bloco A:** *"Quando alguem alterar para pronto para envio ou qualquer outro status que faça os produtos/pedidos sairem de PCP, a plataforma avisa em expedição 'Produto está como pronto para envio no tiny, então ele saiu de PCP' e com isso tem um botão de movimentar o produto para PCP novamente, porem alterando o status do tiny pela plataforma mesmo, um botão que diz 'Voltar para Em produção (Tiny)' e mais um 'Voltar para preparando envio (Tiny)'. Qualquer um desses dois altera o status do tiny ao mesmo tempo que manda novamente o produto para PCP. Deixaremos a regra que persiste no PCP atualmente."*

**Bloco B:** *"Quando for dar um pedido como entregue, deve aparecer tambem um botao de alterar a data da entrega para o dia que foi entregue de fato com as seguintes regras: Eu nao posso alterar para uma data que ainda nao chegou pois eu nao posso dar como entregue amanha, sendo que o amanha ainda nem chegou. Nao deve ser obrigatorio colocar a data de entrega de fato, deve aparecer isso como um botao que altera ela, tendo os seguintes botoes a partir do momento em que clicar em 'entregue' -> 'Confirmar entrega', 'ainda não' caso tenha alguma inconsistência como na imagem e o 'marcar como entregue no dia...', se a data for alterada, isso deve refletir em toda a plataforma, inclusive no calendario das rotas"* · *"Ter a possibilidade de anexar mais de um arquivo de comprovante por vez ao pedido"*

A imagem do dono é a confirmação da Rotas com o aviso "...em produção na fábrica (0 de 1 peça pronta). Confirmar a entrega encerra tudo dele" e os botões "Sim, entregar mesmo assim" e "Ainda não".

**Bloco C:** *"Colocar um botao de configuração do painel dentro das abas da dash de tempo de produção, dentro dessa configuração deve ser possivel editar o tipo de grafico, ligar e desligar os montadores que aparecem na tela como montador a, b, c... podendo ver qual é qual, obvio e algumas outras configurações que voce irá me recomendar"*

## Respostas do dono (09/11, fechadas: não perguntar de novo)

**Bloco A**
1. **A regra atual do PCP fica:** pedido Faturado, Pronto para envio ou Enviado no Tiny continua fora do PCP.
2. **"Em produção" não existe no Tiny.** A API v2 de alterar situação aceita aberto, aprovado, preparando_envio, faturado, pronto_envio, enviado, entregue e cancelado. Os botões ficam assim:
   - **"Voltar para Em aberto (Tiny)"**
   - **"Voltar para Preparando envio (Tiny)"**
3. **Situações que geram o aviso:** só **Faturado, Pronto para envio e Enviado**. Entregue, Não entregue e Cancelado já têm caminho próprio.
4. **Pedidos antigos também aparecem:** hoje, o 13652 e o 13684.
5. **Os botões aparecem também na janela de liberar peça.**

**Bloco B**
6. **Data de entrega opcional:** o padrão continua sendo "hoje". Nunca aceita um dia futuro.
7. **A data escolhida vale em toda a plataforma**, inclusive no calendário das rotas.
8. **Corrigir depois:** só o **admin**, na ficha do pedido, com a mesma regra (nunca dia futuro).
9. **Vários comprovantes por vez.**

**Bloco C**
10. **A configuração é igual para todos:** o admin configura, e ela vale para a tela e para a TV.
11. **Itens da configuração:**
    - tipo de gráfico;
    - ligar e desligar montadores, vendo quem é cada letra;
    - **linha do tempo padrão** do modelo no gráfico;
    - **abrir já filtrado** (setor e período);
    - **média ou mediana**;
    - **o que a TV mostra**.
12. **Montador desligado:** sai da coluna dele, mas **o tempo continua contando** e entra em **"Outros"**. Totais e médias do setor não mudam.

---

# BLOCO A · Pedido adiantado no Tiny que ainda falta produzir

## O que é

Quando o Tiny diz que um pedido está **Faturado, Pronto para envio ou Enviado**, a plataforma tira o pedido do PCP (D-132). Essa regra continua.

O furo aparece quando ainda falta produzir algo do pedido, por exemplo quando a logística liberou a peça pronta dele para outro pedido. O pedido some do PCP e **também** da Expedição, que só mostra pedido adiantado no Tiny quando há peça dele na fábrica. Ninguém vê o pedido, e o aviso do sino ainda diz "voltou ao PCP".

## O caso que motivou (13818, leitura do banco em 09/11)

| Quando (Brasília) | Fato |
|---|---|
| 04/11 17:04 | Chegou "Em aberto": 2 × Estante Basic 15 nichos (SKU 419). Previsão de entrega 13/11. O sistema reservou 2 peças do estoque. |
| 04/11 17:16 | João Lucas usou as 2 peças (cards 14542239 e 14542240, em PEDIDOS EM AGUARDO). Pedido completo. |
| 04/11 17:47 | O Tiny avisou "Pronto para envio". A mudança foi **manual, no Tiny**: a plataforma só escreve situação no Tiny para Entregue ou para desfazer entrega, e não há fato dela nem de automação nesse horário. |
| 06/11 14:15 | A peça 14542240 foi liberada para o 13832, com "volta para a produção". Aviso no sino: "Pedido 13818 voltou ao PCP". |
| 09/11 08:06 | A peça 14542239 foi liberada para o 13836, da mesma forma, com o mesmo aviso. |
| 09/11 até 16:21 | Com 0 de 2 peças, o pedido ficou **escondido** do PCP (D-132) e da Expedição (D-133). |
| 09/11 16:21 | A produção voltou a situação no Tiny para "Preparando envio" e o pedido reapareceu no PCP. Já está resolvido; não acertar de novo. |

A janela de liberar peça já recebe a informação "o Tiny está adiante", mas o alerta fala em "faturado ou enviado", manda "conferir lá" e não oferece saída.

## A regra única: "adiantado no Tiny com falta"

Um pedido entra nessa regra quando:
- o card do pedido não está arquivado e não tem entrega vigente;
- a situação no Tiny é Faturado, Pronto para envio ou Enviado;
- falta liberar pelo menos 1 unidade das vagas de produção. A conta é a do PCP: `plt_privado.vw_itens_producao` menos as unidades vivas do pedido. Frete não conta; personalizado conta.

É **uma regra só no banco**, lida pela Expedição, pela janela de liberar peça e pelo PCP.

**Stand-by (decisão provisória):** um pedido em stand-by que se encaixa na regra também entra. O botão devolve o pedido ao PCP **mantendo** o stand-by, e ele aparece na aba Stand-by.

### Frente 1 · A Expedição mostra o pedido, com o aviso
- O pedido aparece na Expedição **mesmo com zero peça pronta**.
- O aviso mostra a **situação real**. Exemplo: *"Este pedido está como Pronto para envio no Tiny, por isso saiu do PCP. Ainda falta liberar 2 produtos."*
- Pedido com peças prontas **e** com falta: o card normal ganha o mesmo aviso.
- **Decisão provisória:** um quadradinho de filtro "Saiu do PCP pelo Tiny" junto dos filtros da Expedição.

### Frente 2 · Os dois botões
- **"Voltar para Em aberto (Tiny)"** e **"Voltar para Preparando envio (Tiny)"**, no aviso.
- **Quem usa:** logística e admin, a mesma permissão de liberar peça.
- **Antes, uma confirmação de uma frase.** Exemplo: "O pedido 13818 vai voltar ao PCP com 2 produtos para liberar, e no Tiny passa para Preparando envio."
- **Tudo num toque, em uma chamada, idempotente (com chave):**
  1. pede a situação ao Tiny pela **fila de saída que já existe** (a de "Entregue dos dois lados");
  2. devolve o pedido ao PCP **na hora**, sem esperar o Tiny, com marca por fato e projeção no card do pedido;
  3. grava um fato na trilha com autor, situação anterior e situação pedida, e gera log (D-40);
  4. avisa o PCP: "Pedido N voltou ao PCP".
- **A marca "devolvido ao PCP pela plataforma"** vale até o Tiny confirmar a situação pedida. Depois disso, a D-132 volta a decidir normalmente.
  - Um aviso antigo do Tiny que chegue fora de ordem **não** esconde o pedido antes da confirmação.
- **Tiny recusou ou não respondeu:** o pedido continua no PCP com o aviso "o Tiny ainda não confirmou a mudança", e o alerta sai pela porta que já existe.
- **Ida ao Tiny desligada** (a chave de "Entregue vai ao Tiny" da ROTAS, hoje ligada): os botões ficam desabilitados, com a explicação.

### Frente 3 · Na janela de liberar peça
- Se o pedido de origem estiver adiantado no Tiny e a pessoa escolher "volta para a produção", a janela mostra a **situação real** e três opções:
  - "Voltar para Em aberto (Tiny)";
  - "Voltar para Preparando envio (Tiny)";
  - "Deixar como está": o pedido fica na Expedição, com o aviso.
- Tudo acontece **no mesmo gesto** de liberar, numa transação.
- "Não lançar agora" (stand-by) continua como hoje.

### Frente 4 · Avisos que dizem a verdade
- O aviso "voltou ao PCP" só sai quando o pedido de fato voltou.
- Quando o pedido não volta, o aviso diz: *"O produto saiu do pedido N, mas ele está como Pronto para envio no Tiny e ficou na Expedição esperando decisão."*
- A notificação da janela de liberar peça mostra a situação real e o que fazer.

---

# BLOCO B · A entrega

## Como é hoje (código da main de 06/11)
- **Rotas (logística):** "Entregue" mostra "Confirmar a entrega do pedido inteiro?", com "Sim, entregue" e "Ainda não". Se o pedido aparece em produção, o texto vira o aviso da imagem e o botão vira "Sim, entregar mesmo assim".
- **Entregas do dia (entregador):** um painel com comprovante (**um arquivo**), observação e "Confirmar" / "Confirmar mesmo assim".
- **Ficha do pedido → "Entrega e comprovante":** anexa comprovante **um por vez**.
- A entrega é o fato `entrega` no card do pedido. O fato tem `ocorrido_em` e `registrado_em`.
- O **calendário das rotas** põe o pedido entregue no **dia da programação** (`plt_programacoes.data_entrega`), não no dia em que foi entregue.

### Frente 5 · "Marcar como entregue no dia..."
- Depois de tocar em "Entregue", nos **dois** lugares (Rotas e Entregas do dia), e em qualquer outro onde se registre entrega, aparecem três botões:
  1. **"Confirmar entrega"**: entrega com data de **hoje**, como hoje.
  2. **"Ainda não"**: fecha sem registrar.
  3. **"Marcar como entregue no dia..."**: abre a escolha do dia e confirma a entrega já com esse dia.
- **Inconsistência como a da imagem** (peças ainda em produção): o aviso continua aparecendo. "Confirmar entrega" e "Marcar como entregue no dia..." valem como a confirmação explícita que hoje é o "Sim, entregar mesmo assim". A regra de fechar tudo do pedido não muda.
- **A data:**
  - nunca no futuro: o limite é **hoje no fuso da fábrica**, conferido **no banco** e não só na tela;
  - **decisão provisória:** também nunca antes do dia em que o pedido chegou à plataforma;
  - a escolha é opcional, e o padrão é hoje.
- **Como guardar:** o fato da entrega nasce já com o **dia real** (`ocorrido_em` no dia escolhido; `registrado_em` = agora), sem editar fato nenhum. A trilha mostra "entregue no dia X, registrado em Y por Z".
  - **Decisão provisória para a hora:** dia passado guarda o fim do expediente daquele dia (pelo calendário da fábrica).
- **Reflete em toda a plataforma**, sempre pela mesma data:
  - ficha do pedido, Entregas do dia e lista de pedidos;
  - **calendário das rotas**: o entregue aparece no **dia real**. Se for diferente do programado, uma nota discreta diz "programado para dd/mm" (decisão provisória);
  - dashboards e metas de entregas por dia;
  - qualquer contagem por dia de entrega.

  Procure **toda** leitura que hoje usa a data da programação ou o momento do registro como "dia da entrega" e passe a usar a mesma regra.
- **Desfazer do dia** (logística e entregador): "do dia" continua contando pelo **dia em que foi registrada**, não pelo dia escolhido (decisão provisória). Assim, marcar "entregue ontem" ainda pode ser desfeito hoje por quem marcou.
- **Correção depois de registrada:** só o **admin**, na ficha do pedido, com o botão "Alterar a data da entrega".
  - Mesma regra de data: nunca futuro, nunca antes da chegada.
  - É um **fato novo** de correção da data, com a data antiga e a nova; a entrega não é editada (append-only).
  - Motivo opcional (decisão provisória). Gera log.
  - Todas as telas passam a ler a data corrigida.
- **Tiny:** a situação "Entregue" continua indo como hoje. A data **não** vai ao Tiny (fora do escopo).

### Frente 6 · Vários comprovantes de uma vez
- Em todo lugar onde hoje se anexa um comprovante (o painel do "Entregue" do entregador, "Comprovante" no card e a ficha do pedido), passa a dar para **escolher vários arquivos de uma vez**.
- Valem os mesmos tipos aceitos hoje. Limite provisório: **até 10 por vez**, com o mesmo tamanho máximo de hoje por arquivo.
- Cada arquivo sobe e é registrado sozinho. Se um falhar, os outros ficam, e a tela diz qual falhou e oferece tentar só aquele.
- A entrega continua sendo registrada **antes** dos comprovantes, como hoje.
- A ficha mostra todos os comprovantes, e as Entregas do dia mostram a contagem certa.

---

# BLOCO C · Configuração do painel de Tempos de produção

## Como é hoje
- Dashboards → Tempos de produção, com as abas Dia, Período, Móveis, Montadores e Conferir, mais o Modo TV.
- O gráfico é de **barras** (Período e TV).
- As letras dos montadores vêm da **equipe no painel** de cada setor (`plt_tempo_equipe`: setor, pessoa, papel, letra).
- A TV mostra só letras, nunca nome nem foto (D-231). Dupla aparece como "A + B"; quem não tem letra entra em "Outros".

### Frente 7 · O botão de configuração
- Um botão **"Configurar painel"** (engrenagem) dentro das abas de Tempos de produção. **Só o admin** vê (decisão provisória, porque a configuração vale para todos). Os demais só veem o resultado.
- **Uma configuração única**, vale para a tela e para a TV. Toda mudança gera log e aparece na Auditoria.
- **Itens:**
  1. **Tipo de gráfico**, para cada gráfico das abas e da TV. Opções provisórias: barras (atual), linhas e barras empilhadas por montador.
  2. **Montadores:** a lista da equipe de cada setor com **letra, nome e foto** (só aqui, para o admin saber quem é quem). Cada um com um **liga/desliga**.
     - Desligado sai da coluna dele **na tela e na TV**, e o tempo dele vai para **"Outros"**. Totais, médias e "Melhor da semana" do setor **não mudam**.
     - **Decisão provisória:** dupla com um desligado aparece como a letra do ligado + "Outros".
     - A TV continua **só com letras** (D-231 não muda).
     - As letras e a equipe continuam sendo editadas onde já são. Não duplique o cadastro.
  3. **Linha do tempo padrão:** liga/desliga a linha de referência do tempo padrão do modelo nos gráficos.
  4. **Abrir já filtrado:** setor e período com que a tela abre (hoje, 7 ou 30 dias). O padrão continua o de hoje enquanto ninguém mudar. Filtros escolhidos na hora continuam funcionando.
  5. **Média ou mediana:** qual número a tela e a TV usam para comparar tempos. Os rótulos dizem qual está valendo.
     - Atenção à dívida já registrada: a mediana aproximada em períodos longos com ×100 (D-233).
     - A média precisa caber nos mesmos orçamentos.
  6. **O que a TV mostra:** liga/desliga de cada bloco que a TV já tem (por exemplo "Melhor da semana", relógio, ranking). Confira na tela quais blocos existem; não invente bloco novo.
- **Ao vivo:** mudar a configuração atualiza a TV e as telas abertas **na hora**, pelo canal que a TV já usa (websocket), sem relógio novo.
- **Banco enxuto:** a configuração é uma linha única, e o liga/desliga é uma coluna na equipe do painel. Nada de tabela por pessoa.
- **Lei de desempenho:** cada aba continua em 1 requisição, e a configuração vem junto da mesma porta, não numa porta a mais.

---

## Fora do escopo
- Mudar a D-132 (o PCP segue o Tiny) ou a D-231 (a TV só mostra letras).
- Entregue, Não entregue e Cancelado no bloco A.
- Descobrir ou bloquear quem muda a situação no Tiny.
- Mandar a data da entrega ao Tiny.
- Mexer no fluxo do n8n. A validação "Validar pedido" do fluxo de situação já aceita `aberto` e `preparando_envio`. Se precisar mexer, só com OK (regra 3).
- Acertar o 13818, que já foi resolvido.
- Configuração por pessoa no painel de tempos.

## Critérios de aceite

**Bloco A**
- [ ] Pedido Faturado, Pronto para envio ou Enviado com falta aparece na Expedição mesmo com 0 peça, com a situação real (inclui o 13652 e o 13684).
- [ ] Preparando envio, Em aberto, Entregue e Cancelado não ganham o aviso.
- [ ] O PCP continua sem mostrar pedido adiantado no Tiny que não foi devolvido.
- [ ] Os botões põem o pedido no PCP na hora, só com o que falta, e o Tiny muda para a situação escolhida.
- [ ] Toque repetido = um efeito só. Aviso antigo do Tiny fora de ordem não esconde o pedido devolvido.
- [ ] Tiny falhou → o pedido segue no PCP com "o Tiny ainda não confirmou", e o alerta sai.
- [ ] Depois da confirmação, se alguém adiantar o pedido no Tiny de novo, ele sai do PCP e o aviso volta.
- [ ] A janela de liberar peça mostra a situação real e as três opções, num gesto só.
- [ ] O aviso "voltou ao PCP" só sai quando o pedido de fato voltou.
- [ ] Só logística e admin veem os botões; tudo gera fato e log com autor.

**Bloco B**
- [ ] Depois de "Entregue", aparecem "Confirmar entrega", "Ainda não" e "Marcar como entregue no dia...", na Rotas e nas Entregas do dia.
- [ ] O dia de amanhã é recusado pela tela **e** pelo banco; hoje e dias passados (desde a chegada do pedido) são aceitos.
- [ ] Com peças em produção, o aviso da imagem aparece, e os dois botões de confirmar valem como confirmação explícita.
- [ ] Entrega marcada em dia passado aparece nesse dia no calendário das rotas, na ficha, nas Entregas do dia e nos números de entregas por dia.
- [ ] Admin corrige a data depois, por fato novo; logística e entregador não veem esse botão.
- [ ] Desfazer do dia continua funcionando para quem registrou hoje uma entrega de dia passado.
- [ ] Vários comprovantes sobem de uma vez; uma falha não derruba os outros, e a tela diz qual falhou.

**Bloco C**
- [ ] O botão de configuração aparece nas abas só para o admin.
- [ ] A troca do tipo de gráfico vale na tela e na TV.
- [ ] Desligar um montador tira a letra dele da tela e da TV, o tempo vai para "Outros", e os totais e médias não mudam.
- [ ] A configuração mostra letra, nome e foto; a TV continua só com letras.
- [ ] A linha do tempo padrão liga e desliga.
- [ ] A tela abre no setor e período configurados.
- [ ] A troca entre média e mediana vale em todas as abas e na TV, com o rótulo certo.
- [ ] Os blocos da TV ligam e desligam.
- [ ] A TV aberta muda na hora, sem recarregar.
- [ ] Toda mudança gera log e aparece na Auditoria.

**Geral**
- [ ] Celular (375) e tablet (768) sem rolagem lateral; botões com tamanho de toque.
- [ ] Bateria do banco 2×, tsc, lint, vitest, build, advisors sem nada novo.
- [ ] Lei de desempenho: cada tela continua em 1 requisição, sem relógio novo; plano ×100 das portas novas ou tocadas no handoff.

## Notas para o Claude Code

- **Leia** `SUPA - Esquema do Banco`, a Lei de Desempenho e a Memória de Aprendizado. Recrie toda função a partir da **versão viva** do banco, conferindo o corpo. Reaplicar migration antiga já desfez trabalho novo.

**Bloco A — onde mora:**
- `plt_privado.fn_tiny_tirou_do_pcp`: a regra da D-132.
- `plt_fn_pcp_quadro`, `plt_fn_cards_pedido_pcp`, `plt_fn_dash_pcp_dia` e os totais do quadro.
- `plt_privado.vw_pedidos_vivos`, `vw_pedidos_para_rota` e a porta da Expedição: a D-133.
- `plt_fn_liberar_peca`, que já devolve `tiny_adiante`, e a janela de liberar peça da logística.
- **Fila de saída do Tiny:**
  - `plt_tiny_pedido_fila` tem a checagem `motivo in ('entregue','desfeita')`; amplie para o novo motivo.
  - `plt_privado.fn_tiny_pedido_enfileirar` devolve `'desligado'` quando a ida ao Tiny está desligada.
  - `fn_tiny_situacao_api` traduz para a API v2.
  - A fila guarda uma linha por pedido e vale a última vontade: confira a interação com um "Entregue" ou "desfeita" pendente.
- **A marca de devolvido ao PCP:** fato novo, com projeção no card do pedido (no padrão do `standby_desde`). É limpa pela atualização do Tiny com a situação pedida, posterior ao pedido. A regra do PCP passa a ser "não tirou do PCP **ou** foi devolvido e o Tiny ainda não confirmou". Uma regra só, para todas as portas do PCP (D-75).
- **Cuidado com a reação da SESSAO-44** à mudança de situação: a confirmação "Preparando envio" ou "Em aberto" só limpa a marca. A regravação dos itens nesse aviso não pode abrir "itens novos".

**Bloco B — onde mora:**
- `plt_fn_registrar_entrega(p_card_id, p_observacao, p_confirmar_incompleto)`: ganha a data opcional, com a checagem no banco.
- `plt_fn_entrega_desfazer`, a regra do "do dia".
- `plt_fn_rotas_calendario` (hoje usa `plt_programacoes.data_entrega` para o entregue).
- `plt_fn_entregas_do_dia`, a ficha do pedido, `plt_fn_anexo_registrar` e `plt_fn_anexos`.
- No front, a confirmação na Rotas e o painel "Entregue" das Entregas do dia.
- Procure toda leitura de "dia da entrega" (dashboards, metas, trilhas) e use **uma** função de dia da entrega.
- O fuso da fábrica nas portas é `America/Fortaleza`.

**Bloco C — onde mora:**
- As portas `plt_fn_tempos_*` (dia, período, móveis, montadores, conferir, TV) e `plt_tempo_equipe`.
- O Modo TV e o canal ao vivo do setor.
- As decisões D-229 a D-233.

**Geral:**
- Eventos são append-only: correção é fato novo. Toda atividade gera log. Sem relógio novo: trabalho nasce do fato.
- **Regra 2:** migration, publicação e qualquer mudança no n8n só com aprovação do dono na conversa, cada uma em passo separado.
- **Decisões provisórias a registrar:**
  - stand-by entra na regra do bloco A;
  - quadradinho "Saiu do PCP pelo Tiny";
  - botões desabilitados com a ida ao Tiny desligada;
  - data nunca antes da chegada do pedido;
  - hora do dia passado = fim do expediente;
  - nota "programado para dd/mm" no calendário;
  - "do dia" pelo registro;
  - motivo opcional na correção da data;
  - até 10 comprovantes por vez;
  - só o admin vê o botão de configuração;
  - tipos de gráfico (barras, linhas, empilhadas);
  - dupla com um desligado = letra do ligado + "Outros".
- Com o dono: português de gente, sem códigos (regra 12c).

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)

- Expedição - Aviso de pedido que saiu do PCP pela situação do Tiny: **criação bloqueada pela permissão da sessão do Cowork. Criar com o OK do dono.**
- [Expedição - Botões para voltar o pedido ao PCP mudando a situação no Tiny](https://app.clickup.com/t/17tya50qxqc)
- [Logística - Liberar peça de pedido adiantado no Tiny já devolvendo ao PCP](https://app.clickup.com/t/17tya50qxqd)
- [Entregas - Marcar como entregue no dia em que foi entregue de fato](https://app.clickup.com/t/17tya50qxzd)
- [Entregas - Anexar vários comprovantes de uma vez](https://app.clickup.com/t/17tya50qxze)
- [Dashboards - Configuração do painel de Tempos de produção](https://app.clickup.com/t/17tya50qxzf)

## Resultado (preencher ao entregar)

*O que foi feito, o que mudou de rota, link do handoff da sessão.*

---

## Prompt para abrir no Claude Code (pasta "Domoby - fabrica")

```
Você é o engenheiro executor da Plataforma de Produção da Móveis Domoby. Antes de tudo, atualize a main com o remoto (a demanda desta sessão acabou de chegar pelo GitHub). Depois siga a ordem de leitura do CLAUDE.md da raiz e execute a demanda _docs/Plataforma/Demandas/SESSAO-47 - Pedido Adiantado no Tiny Data Real da Entrega Comprovantes e Painel de Tempos.md (leia duas vezes; ela já está linkada na Ordem das Sessões).

As respostas de negócio estão dentro da demanda: não me pergunte nada de negócio; o que faltar vira decisão provisória registrada. Branch nova a partir da main, commits pequenos com push a cada frente. Migration, publicação e qualquer mudança no n8n só com o meu OK.

Ao terminar: o que foi feito, como testar passo a passo (com prints da Expedição, da confirmação de entrega e da configuração do painel), as pendências que precisam de mim e as decisões provisórias, em português de gente, sem códigos.
```
