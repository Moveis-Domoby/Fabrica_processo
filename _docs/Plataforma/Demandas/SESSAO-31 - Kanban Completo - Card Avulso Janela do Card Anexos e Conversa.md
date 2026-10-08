---
titulo: "SESSAO-31 — Kanban completo: card avulso, janela do card, anexos, conversa e pausa com motivo"
tipo: demanda
status: 📐 pronta para code
data: 2026-10-07
atualizado: 2026-10-07
origem: pedido do dono em 06/10/2026 (com 3 prints do ClickUp como referência), mapeado no Cowork (leitura só de cofre, código, banco e ClickUp — nada alterado)
plano: "[[004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo]]"
depende: "[[SESSAO-30 - Producao de Ponta a Ponta - Pedido Reabastecimento e Entrega]] (a base de anexos nasce lá)"
tags: [plataforma, demanda, bloco-6, kanban, pcp, card-avulso, anexos, conversa, mencoes, pausa, etiquetas]
---

# 🎯 SESSAO-31 — Kanban completo: card avulso, janela do card, anexos, conversa e pausa com motivo

> [!important] Leia antes de tudo
> `CLAUDE.md` (ordem de leitura inteira) · **[[PLT - Lei de Desempenho e Escala]] (regra 18 — vale para tudo o que esta sessão tocar; ver §10)** · [[004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo]] · **o handoff da [[SESSAO-30 - Producao de Ponta a Ponta - Pedido Reabastecimento e Entrega]]** (a base de anexos nasce lá) · [[handoff_2026_09_27_sessao24_producao_concluida]] (quadro por arrasto) · [[handoff_2026_09_27_sessao26_chat]] (websocket e leitura por página) · [[handoff_2026_10_02_sessao27_automacoes_canvas]] (etiquetas e campos customizados) · [[handoff_2026_09_23_sessao23_meu_painel_2]] (tarefas, preview em modal) · [[handoff_2026_09_21_sessao22_filas_tempo_pausa]] (pausa).
> **Primeiro passo:** conferir no git que a `main` contém a SESSAO-30 e criar a branch `sessao-31-kanban-completo`. Não criar worktree sem ordem do dono.

## O que é

**Todo o kanban numa sessão só** (pedido do dono: *"uma sessão já deve englobar todo o conteúdo de kanban"*): o **card avulso** criado na aba nova **"Lançamento manual"** do PCP; o card **personalizável** como no ClickUp (responsáveis, datas, prioridade como etiqueta, campos customizados) com o **botãozinho de descrição** que abre ao passar o mouse; a **janela grande do card** para **todo card** (descrição, tempo, histórico de produção, edição, anexos de PDF, imagem e áudio, conversa ao lado com **menções** que avisam no sino e mandam um **cartão de aviso na conversa particular**); e a **pausa com motivo**. Fecha os itens do ClickUp "Kanban — Cartões avulsos", "Kanban — Anexar PDF e imagem" e "Kanban — Pausa de um card com motivo de pausa".

## 0. Retrato de partida (lido no banco e no código em 06/10/2026, só leitura)

- `plt_cards.tipo` aceita só `pedido | unidade | reposicao` (check `plt_cards_tipo_check` + a coerência `plt_cards_unidade_coerente`). O card **não tem** título livre, descrição, datas nem vários responsáveis — tem `responsavel_id` (um) e o executor atual.
- **Etiquetas** (`plt_etiquetas`; projeção `plt_cards.etiquetas` por evento) e **campos customizados** (`plt_campos` com `em_pecas`/`em_pedidos`; valores em `plt_campos_valores`) existem desde a S27 — mas **só a automação põe e tira etiqueta** e só automação/admin preenchem campo (D-101). Cadastro em Configurações → Utilitários (admin).
- **Histórico:** `ModalLinhaTempo` (porta `plt_fn_linha_tempo_card`) — fila, execução, pausas, total por etapa.
- **Sino:** `plt_notificacoes`, lido por intervalo (`refetchInterval` no `SinoNotificacoes`); tipos de hoje: tarefa do Sistema, qualidade, cancelado, chegada no aguardo/estoque.
- **Chat:** conversas `canal | particular | avisos`; mensagens `texto | aniversario` (check `plt_chat_mensagens_autor_ck`); particular aberta por `plt_fn_chat_abrir_particular`; **websocket privado** por pessoa e por conversa aberta; leitura só por página (D-67).
- **Visibilidade do card** (RLS `plt_cards_leitura`): admin, setores do usuário ou executor atual.
- **Pausa:** os eventos `execucao_pausada`/`execucao_retomada` e as regras da D-48 continuam no banco; os botões saíram dos quadros na D-59 (arrastar para PARADO fecha o tempo).
- **PCP em abas:** Reabastecimento · Pedidos aguardando liberação · Todos os pedidos (D-88).
- **Anexos:** a base (lugar privado, anexo de card, remoção por evento) nasce na SESSAO-30 com o comprovante de entrega.

## 1. Lançamento manual — o card avulso

- **Aba nova no PCP: "Lançamento manual"** (quarta aba, com ícone, no padrão de `<Abas>`; a aba vive na URL).
- **Criar** — botão primário **"Novo card"** abre a criação rápida no jeito do ClickUp (print 1 do dono): **Nome do card** + **Salvar (Enter)**, e logo abaixo os atalhos opcionais **Adicionar responsável · Adicionar datas · Adicionar prioridade · Etiqueta**. "Mais detalhes" abre o resto: **descrição**, **vínculo opcional**, **campos customizados**, **setor de destino**.
- **Vínculo opcional** (o dono: *"atrelado a produtos/pedidos/peças ou não, a atrelação deve ser opcional"*): **Pedido** (busca por número/cliente), **Produto** (catálogo, por SKU/nome) e **Peça** (ver a pergunta 4). Busca no servidor, uma requisição por intenção (regra 17).
- **O que a aba mostra:** os avulsos em três visões no filtro "Mostrar" — **A lançar** (criados, ainda no PCP) · **Em produção** · **Concluídos** —, paginados no servidor.
- **Lançar para produção:** escolher o setor; o card cai na fila do setor (mesma regra da liberação). Dá para criar já lançando.
- **No quadro do setor** o avulso anda **por arrasto como qualquer card** (soltar no início inicia o tempo de quem arrastou; o limite de 1 por pessoa vale; o fim segue a pergunta 2; a marcação de qualidade segue a pergunta 3). No **tablet**, o mesmo, com o PIN.

## 2. A frente do card — enxuta

- **Avulso:** título (até 2 linhas) · **etiquetas** em pílula (a prioridade é uma etiqueta — palavras do dono: *"coloque como uma tag mesmo"*) · **responsáveis** em avatares (até 3 + "+N") · **vencimento** (atrasado = ícone + texto de atenção, nunca só cor — M-12) · **o botãozinho de descrição**: passar o mouse mostra a descrição num balão (print 2 do dono; reaproveitar o `<Dica>`; no tablet/celular, tocar) · vínculo em linha pequena ("Pedido 13215", "SKU 327") · tempo na etapa (o que já existe) · contadores discretos de **anexos** e **mensagens**.
- **Peça de pedido, reposição e card do pedido:** ganham **só** os indicadores novos que tiverem (descrição, anexos, mensagens, responsáveis, etiquetas) — o card continua do tamanho de hoje.
- **Campos customizados na frente:** os que o criador escolher mostrar (até 3, como hoje — "+N" na janela). O campo ganha a opção de valer também em **cards avulsos** (hoje: peças e pedidos).
- **Etiquetas pelas pessoas** (revisa a D-101 — hoje só a automação põe e tira): quem pode editar o card **põe e tira** etiqueta. Criar etiqueta nova direto do card: pergunta 5.

## 3. A janela do card — para TODO card (resposta do dono, 06/10)

> Referência: print 3 do dono (a janela de tarefa do ClickUp). Vale para card **avulso, peça de pedido, reposição e card do pedido** — o histórico de hoje passa a morar dentro dela.

- **Abrir:** clicar no card (quadro, PCP, tablet, Meu Painel, aviso do sino, cartão de menção) abre a janela grande **por cima da tela**; tem **link próprio** (`?card=`) para mandar a alguém; ESC fecha; no celular ocupa a tela. **Clicar não é arrastar** — o arrasto só começa depois de 8 px (mouse) / 200 ms (toque), como hoje.
- **Lado esquerdo — o card:**
  - **Cabeçalho:** onde está (setor · etapa), título (editável no avulso; nos outros, o nome do produto/pedido), estado (na fila, em execução por Fulano, pausado com o motivo), vínculos.
  - **Propriedades** em linha, como no ClickUp: **Responsáveis · Datas (início → vencimento) · Prioridade/Etiquetas · Tempo · Campos customizados** — cada uma editável por quem pode (pergunta 7).
  - **Descrição** — texto editável (todo card ganha descrição; no avulso é a do criador).
  - **Tempo** — o resumo que a linha do tempo já calcula: fila, execução, pausas descontadas e total por setor; "ainda contando" quando aberto.
  - **Histórico de produção** — a linha do tempo de hoje (o `ModalLinhaTempo` vira seção da janela; o estorno do líder/admin continua lá).
  - **Anexos** — lista com miniatura (imagem), ícone de PDF (abre no visualizador do navegador) e **player de áudio**; enviar por botão, arrastar e soltar, **câmera** (tablet/celular) e **gravar áudio** pelo microfone. Evolui a base da SESSAO-30 (lugar privado, link assinado curto). Tamanho e o destino do removido: pergunta 8.
- **Lado direito — Atividade:** a **conversa do card** e os **eventos do card** na mesma linha do tempo (*"Fulano moveu para MONTAGEM"*, *"Ciclano anexou planta.pdf"*), com filtro **"Só conversa | Tudo"**. Compositor: texto, **@menção** com a lista de pessoas (busca no servidor), clipe para anexar e microfone. Mensagens **10 em 10** com "Ver anteriores", **websocket privado do card aberto** e nada de releitura (o mesmo padrão do chat — D-67). Mensagem **imutável**, como no chat (pergunta 10).
- **Menção** (respostas do dono, 06/10):
  1. **Aviso no sino** do mencionado — *"Fulano mencionou você no card X"* — que abre a janela do card.
  2. **Cartão de aviso na conversa PARTICULAR** entre quem mencionou e quem foi mencionado (a particular nasce se não existir): não é bolha comum — é um cartão no estilo do aniversário, com *"📌 mencionou você no card {título}"*, o trecho da mensagem e o botão **"Abrir card"**. O número do balão do chat sobe pelo websocket, sem releitura.
  - Mencionar a si mesmo não avisa. Quem é mencionado **passa a poder abrir esse card** (pergunta 6).
- **Responsável adicionado** a um card recebe aviso no sino (*"Você é responsável pelo card X"*).

## 4. Pausa com motivo (item do ClickUp "Kanban — Pausa de um card com motivo de pausa")

- Pausar um card **em execução** pedindo o **motivo**; o motivo aparece na **frente do card** (*"Pausado · Falta de material · há 2 h"*) e no **histórico**; retomar volta a contar.
- **Onde:** arrastar para **PARADO** pergunta o motivo; e a janela do card tem **Pausar / Retomar** (a frente do card continua sem botões — D-59).
- Regras da D-48 continuam: pausada **não conta tempo nem ocupa o limite**; retomar com outra execução aberta é recusado.
- **Motivos:** lista cadastrada em Configurações → Utilitários (aba nova **"Motivos de pausa"**) + **"Outro"** com texto (pergunta 9).
- O motivo fica **guardado no evento** — um painel de motivos é para depois.

## 4b. Desempenho e escala — o que esta sessão toca sai dentro da lei (regra 18)

> Decisão do dono (07/10): as sessões 30 e 31 seguem a [[PLT - Lei de Desempenho e Escala]] **em tudo o que tocam**; o resto é a [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]]. Nesta sessão:

- **Quadro do setor (e o tablet) abre com 1 requisição:** hoje cada coluna é uma consulta e cada uma se atualiza sozinha a cada 20 s (`useColunasPaginadas`, `QuadroSetor`, `TelaSetor`); o tablet ainda escuta a **tabela de cards inteira** por `postgres_changes`. Passa a ser: **uma porta do quadro** que devolve a primeira página de **todas** as colunas; "Ver mais" = 1 requisição daquela coluna (por cursor); **um canal privado por setor** (`setor:{id}`) com eventos de payload mínimo (`card_movido`, `card_criado`, `card_pausado`… — id, etapa, quem) aplicados no cache **sem reler**; reconexão relê só "desde o último evento". **Zero relógio, zero `postgres_changes`** no quadro e no tablet.
- **PCP — aba Lançamento manual:** nasce dentro da lei (1 requisição, cursor, sem relógio; o resto do PCP já sai adequado da 30).
- **Sino:** sai o relógio de 30 s; o aviso novo (menção, responsável) chega pelo **canal pessoal** (`usuario:{id}` — o mesmo do chat) e atualiza o contador e a lista no cache, sem reler.
- **Janela do card: 1 requisição ao abrir** (cabeçalho, propriedades, campos, contadores e a primeira página da atividade, numa porta só); histórico completo e anexos **só no clique**; canal `card:{id}` só enquanto a janela está aberta; tudo esquecido ao fechar quando pesado (D-89).
- **Atividade/conversa por cursor** (10 por página); autocompletar da @menção espera 300 ms, mínimo 2 letras, limite no servidor.
- **Frente do card sem N+1:** contadores (anexos, mensagens), responsáveis e vencimento vêm **projetados no próprio card** (colunas mantidas por evento) — a coluna do quadro segue sendo uma leitura por página.
- **Anexos:** envio direto ao storage com link assinado; miniatura no tamanho exibido (transformação de imagem do storage); áudio gravado já comprimido no aparelho.
- **Pacote:** janela do card, gravador de áudio e visualizador de PDF em **pedaço próprio** (carregam no primeiro clique).
- **Escritas idempotentes** (criar card, mandar mensagem, anexar, pausar): chave por gesto — clique duplo ou rede que volta = um efeito só; telas otimistas.
- **Card avulso nos índices:** o tipo novo entra nos índices parciais das colunas (setor, etapa, não arquivado) e nas políticas RLS com `(select …)` — conferido com `EXPLAIN (ANALYZE, BUFFERS)` e volume ×100.
- **Motivos de pausa, etiquetas e campos** são dado de referência: cache longo com versão (relê só quando muda).
- O que ficar fora da lei nas telas tocadas → dívida registrada no §14 da lei, com o porquê.

## 5. Decisões que regem esta demanda

D-03/D-59/D-60 (arrasto decide; rotas das etapas) · D-06 (toque de 44 px, tablet) · D-09 (marcação de qualidade) · D-24/D-48 (iniciar obrigatório, limite de 1, pausa) · D-28 (tablet sem dado de cliente) · D-40/D-95 (tudo gera rastro na Auditoria) · D-51 (tarefa privada — não confundir com card) · D-65/D-67 (chat, websocket, página de 10) · D-88 (PCP em abas) · **D-100/D-101** (Utilitários, etiquetas, campos) · M-12 · M-13 · RNF-05 · regra 17 · **regra 18 — [[PLT - Lei de Desempenho e Escala]]** · **regra 19 — tarefas do ClickUp**.
**Vão ser revisadas (registrar D-NN novas com ↩️):** **D-101** — pessoas põem e tiram etiqueta; campo vale em avulsos · **D-59** — Pausar/Retomar voltam, dentro da janela do card, e arrastar para PARADO pede o motivo · **D-22** — existe card de produção que não nasce de pedido nem de reposição.

## 6. Perguntar ao dono no início da sessão (ritual de sempre; só codar com o OK)

**Já respondidas no Cowork (06/10) — só confirmar:** a janela vale para **todo** card · menção = aviso no sino **+ cartão na conversa particular** · a **pausa com motivo** entra aqui · prioridade é etiqueta.

**Abertas:**
1. **Quem cria card avulso?** (proposta: PCP, líderes e admin)
2. **Onde o avulso termina?** Proposta: tem **"Concluir"** em qualquer setor (não precisa passar pela LIMPEZA E EMBALAGEM) e vai para "Concluídos". E se estiver ligado a um **produto** — a peça pronta vira peça livre no ESTOQUE? Ligado a um **pedido** — vira uma peça a mais do pedido ou é só trabalho registrado?
3. O avulso pede a **marcação de estado** (perfeito / atenção / danificado) ao passar de setor? (Proposta: só quando ligado a produto ou peça.)
4. **"Peças"** no vínculo é uma **peça de produção que já existe** (um card do quadro) ou uma **peça/insumo do catálogo do Tiny**? O card pode ter **mais de um vínculo**?
5. **Etiquetas:** quem edita o card põe e tira, certo? **Criar etiqueta nova** direto do card — qualquer um, só líder/admin, ou continua só em Utilitários?
6. **Quem vê o card fora do setor:** responsável e mencionado passam a poder abrir aquele card (e conversar nele)?
7. **Quem edita** descrição, datas, responsáveis e campos — no avulso (proposta: criador, responsáveis, líder, admin) e nos cards de pedido/peça (proposta: PCP, líder, admin)?
8. **Anexos:** tamanho máximo (proposta 25 MB; áudio até 5 min)? Anexo removido some de vez ou fica guardado só para o admin? **Gravar áudio** pelo app (além de enviar arquivo)?
9. **Motivos de pausa:** lista fixa cadastrada + "Outro", ou só texto livre? **Quem pausa:** o próprio operador, o líder, os dois?
10. **Mensagem da conversa do card:** pode editar/apagar? (Proposta: não — como o chat.)

## 7. Fora do escopo

Tudo da [[SESSAO-30 - Producao de Ponta a Ponta - Pedido Reabastecimento e Entrega]] (fluxo do pedido, entrega, Tiny, tela do entregador) · subtarefas, checklist e dependências dentro do card avulso (o ClickUp tem; o dono não pediu — o Meu Painel já tem tarefas) · painel dos motivos de pausa · aviso por WhatsApp/e-mail (Q-42) · card que se divide (Q-21) · terceirizados (Q-22) · impressora de etiqueta · migração dos cards vivos do ClickUp (Q-25) · a adequação de desempenho das telas que esta sessão **não** toca (Meu Painel, Afazeres, Visão do dia, primeira abertura, permissões no token, pacote dividido) — é a [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]].

## 8. Critérios de aceite

- [ ] Aba "Lançamento manual" no PCP: criar com só o nome (Enter salva); responsável, datas, prioridade e etiqueta pelos atalhos; vínculo opcional (sem vínculo funciona); visões A lançar / Em produção / Concluídos paginadas no servidor.
- [ ] Avulso lançado anda por arrasto no quadro e no tablet (com PIN) como qualquer card: tempo, limite de 1, histórico; termina como o dono decidir (pergunta 2) — provado no harness e no ensaio desfeito no banco real.
- [ ] O avulso **não entra em conta nenhuma** de estoque, reserva, Top X ou "peças concluídas" do painel (a não ser o que o dono decidir na pergunta 2); entra nos **tempos** por setor e por pessoa.
- [ ] Frente do card enxuta: etiquetas, avatares, vencimento atrasado com ícone + texto, descrição ao passar o mouse (e ao tocar no tablet), contadores de anexos/mensagens; nada estoura a borda a 375 px.
- [ ] A janela abre em **todo tipo de card**, por clique (sem disparar arrasto) e pelo link; cada parte só busca **ao abrir** (Network: abrir a janela = as leituras dela; fechar = nada fica ouvindo).
- [ ] Anexar imagem, PDF e áudio (arquivo e gravação) — privado, link de vida curta; removido por evento; quem não vê o card não abre o anexo.
- [ ] Conversa do card em tempo real com duas abas abertas (sem recarregar e sem releitura); 10 por página.
- [ ] **Menção:** o mencionado recebe o aviso no sino **e** o cartão "mencionou você" na conversa particular; o balão sobe sozinho; "Abrir card" abre a janela certa; mencionar a si mesmo não avisa.
- [ ] Pessoas põem e tiram etiqueta (evento + projeção, a automação continua funcionando igual); campo customizado vale em avulso.
- [ ] Pausa com motivo: arrastar para PARADO pede o motivo; Pausar/Retomar na janela; motivo na frente e no histórico; regras da D-48 intactas.
- [ ] Tudo o que grava autor deixa rastro na Auditoria; nenhum evento editado ou apagado.
- [ ] Celular 375 px e tablet 768 px: sem rolagem lateral, toques ≥ 44 px, janela do card usável com uma mão.
- [ ] Revisões registradas como D-NN novas (↩️ D-101, ↩️ D-59, ↩️ D-22).
- [ ] **Aba Network:** abrir o quadro de um setor (e o tablet) = **1 requisição**; "Ver mais" = 1; abrir a janela do card = 1; histórico/anexos só no clique; **nada se repete sozinho** — card movido em outra aba aparece sem releitura.
- [ ] **Busca no código:** nenhum `refetchInterval`/`postgres_changes` no quadro, no tablet, no PCP e no sino.
- [ ] Porta do quadro e porta da janela do card **≤ 50 ms (p95) com volume ×100** — plano (`EXPLAIN ANALYZE`) na execução.
- [ ] Clique duplo em "Salvar", "Enviar" ou "Anexar" = um efeito só.
- [ ] Checklist de desempenho da lei (§12) marcado item a item no handoff, com o tamanho do pacote antes/depois.
- [ ] Tarefas do ClickUp (seção abaixo) movidas para **FAZENDO** ao começar e **nunca** para concluído; o dono avisado de cada uma ao terminar.

## 9. Notas para o Claude Code

- **Decisão técnica a trazer no (c):** o avulso como **tipo novo de card** em `plt_cards` (proposta — herda arrasto, tempo, linha do tempo e quadro) × outra estrutura. Se tipo novo: rever a coerência e **toda porta que filtra por tipo** (quadros, PCP, painel, dashboards, estoque, reservas, automações, API) para o avulso entrar só onde deve.
- **Conversa do card** — decisão no (c): conversa do chat de tipo novo (reaproveita mensagens, websocket e imutabilidade — mas **some da lista do chat**) × tabela própria. Seguir à risca o padrão do chat: assina antes de ler, cache por pessoa, `staleTime: Infinity`, sem releitura por foco/intervalo.
- **Cartão de menção na particular:** tipo novo de mensagem (ajustar o check de autor/tipo), desenhado como o cartão de aniversário.
- **Sino:** tipos novos (menção, responsável). O relógio de 30 s do sino **sai** (regra 18 — §4b): o aviso chega pelo canal pessoal do websocket (o mesmo do chat) e entra no cache com o contador, sem releitura.
- **Visibilidade:** a RLS de `plt_cards` (admin | setores | executor) ganha os participantes do card conforme a pergunta 6 — anexos e conversa obedecem à mesma regra.
- **Etiquetas pelas pessoas:** o mesmo caminho por evento da S27 (`etiqueta_adicionada`/`etiqueta_removida`), com origem "interface" — a automação continua igual.
- **Áudio:** gravação pelo navegador (MediaRecorder); o Safari do iPad grava em mp4 — aceitar os formatos que cada aparelho produz.
- **Tablet:** gesto que grava autor (mensagem, anexo, pausa, edição) pede o PIN, como o resto do tablet (D-28/SESSAO-07). Sem dado de cliente no tablet (D-28) — a janela no tablet esconde o que for do cliente.
- **Lei de requisição:** a janela e cada parte dela só buscam ao abrir; o detalhe "busca ao abrir e esquece ao fechar" (D-89) vale aqui.
- **Aplicar banco e publicar telas é um gesto só** (E-73); aplicar só com o OK do dono.
- Ritual completo: (a)(b)(c) antes de codar, task list espelho desta demanda, memória em `_docs/Plataforma/Execucao/SESSAO-31.md`, E-NN/A-NN na hora, handoff em `_docs/Handoffs/`. Sugestão de entregas parciais testadas com o dono: **(1)** card avulso + frente + etiquetas; **(2)** janela + anexos + histórico; **(3)** conversa + menções; **(4)** pausa com motivo.
- **Checklist final obrigatório, item a item:** `npm run test:banco` (2 rodadas) · `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` · celular 375 px e tablet 768 px · checkpoint antes de aplicar (F-08) · `get_advisors` (segurança **e desempenho**) · **checklist de desempenho da lei (§12)** · `pg_stat_statements` sem porta nova no topo · task list conferida contra a demanda · tarefas do ClickUp em FAZENDO e o dono avisado · handoff + mapa + próximos passos + ordem das sessões.

## Tarefas no ClickUp (regra 19)

Lista **PRODUÇÃO** (DPTO TI). Ao começar cada uma → **FAZENDO**. **Nunca** mover para concluído: ao terminar, avisar o dono na conversa e deixar um comentário curto na tarefa (o que foi entregue e como conferir) — **quem conclui é o dono**.

- [Kanban - Cartões avulsos](https://app.clickup.com/t/17tya50fbyc) — §1
- [Kanban - Frente do card personalizável (responsáveis, datas, prioridade e descrição)](https://app.clickup.com/t/17tya50fm3r) — §2
- [Kanban - Janela do card no estilo ClickUp](https://app.clickup.com/t/17tya50fm3t) — §3
- [Kanban - Anexar PDF E imagem](https://app.clickup.com/t/17tya50fbzq) — §3 (anexos, com o áudio)
- [Kanban - Conversa do card com menções](https://app.clickup.com/t/17tya50fm3u) — §3
- [Kanban - Pausa de um card com motivo de pausa](https://app.clickup.com/t/17tya50fc0c) — §4
- [Desempenho - Quadros, tablet e sino ao vivo por websocket](https://app.clickup.com/t/17tya50fm44) — §4b

## Resultado (preencher ao entregar)

*O que foi feito, o que mudou de rota, link do handoff.*

## Ver também

[[PLT - Lei de Desempenho e Escala]] · [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]] · [[004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo]] · [[SESSAO-30 - Producao de Ponta a Ponta - Pedido Reabastecimento e Entrega]] · [[SESSAO-27 - Automacoes em Canvas]] · [[SESSAO-26 - Chat Interno]] · [[PLT - Modelo de Sistema]]
