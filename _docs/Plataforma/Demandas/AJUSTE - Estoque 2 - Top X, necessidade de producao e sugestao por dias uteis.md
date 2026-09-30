---
titulo: AJUSTE — Estoque 2 · Top X, necessidade de produção, reservados e sugestão por dias úteis
tipo: demanda
status: 📐 pronta para code
data: 2026-09-30
origem: pedido do dono em 30/09/2026, refinado no Cowork (análise só leitura de código, cofre e banco)
frente: estoque — trabalhar na PASTA PRINCIPAL "Domoby - fabrica", branch nova a partir da main atualizada (a pasta "Domoby - Fabrica - estoque" é cópia antiga de 28/09, fora do git — não usar)
revisa: D-71 (Top 20 fixo), D-72 (capacidade do galpão + mínimo vazio = Tiny), fluxo da reposição da D-54
tags: [demanda, ajuste, estoque, logistica, pcp, reposicao]
---

# AJUSTE — Estoque 2

> Leia antes: `CLAUDE.md` (ordem de leitura inteira), os handoffs `handoff_2026_09_28_ajuste_estoque_contagem_top20.md` e **`handoff_2026_09_30_estoque_sincronizado_tiny.md`** (migration 42 — reserva da venda, sincronismo com o Tiny, arquivamento da reposição coberta) e as execuções correspondentes. **Esta demanda parte da main com a migration 42 e o ajuste das fotos do Tiny** — confira no git que a main contém os dois antes de criar a branch. Onde este texto conflitar com o que a migration 42 já faz, a 42 vale e você me pergunta.
> **Primeiro passo da sessão:** salvar esta demanda no cofre em `_docs/Plataforma/Demandas/` e linkar no `000 - ORDEM DAS SESSOES`.

## 0. Retrato de partida (lido no banco em 29/09 à noite, só leitura)

- Estoque de acabado = peças livres no setor ESTOQUE (`plt_fn_estoque_movimentar`, `plt_privado.fn_estoque_por_produto`). Só o SKU 327 tem peça (2). Capacidade do galpão = 50, soma dos mínimos = 50.
- Mínimo efetivo hoje = `coalesce(minimo_plataforma, estoque_minimo do Tiny)`.
- Top 20+ = `plt_privado.fn_vendas_90d` (pedidos da loja, 90 dias, sem cancelados e sem personalizados).
- Reposição automática: `plt_privado.fn_gerar_reposicoes` existe, **não há job no pg_cron** e nenhuma flag em tabela (o script `manutencao/2026-09-26_ligar_reposicao_automatica.sql` nunca foi rodado e sua prévia está defasada).
- Horário da fábrica: `plt_horarios_funcionamento` (por setor e por usuário, `dia_semana` 0=domingo). **Não existe cadastro de feriados.**
- Linhas de pedido nos últimos 90 d: 1355; com ≥10 un. do mesmo produto: 3; o maior é o Closet (SKU 323) com 23 un. num pedido só — sem ele o 323 cai de 32 para 9 vendidos.

## 1. O que o dono pediu (resumo fiel)

### 1.1 Sai a capacidade do galpão

> **↪️ Pedido do dono em 30/09 (na sessão de execução, com print):** *"Retire o botão de quantas peças cabem por enquanto e remodele esses cards para: móveis em estoque · peças em estoque por unidade · peças em estoque por m² · móveis prontos reservados · peças em produção · móveis em produção."* → O cartão Galpão vira um painel de SEIS números (substitui os "números informativos" abaixo): móveis livres no galpão, insumos por unidade, insumos por m², prontos reservados (aguardo + reservadas no galpão), unidades sem dono em produção e unidades de pedido em produção. A "soma dos mínimos" sai da tela junto com a "soma das sugestões".
- Some o campo "Quantas peças cabem" e a regra de encolher as sugestões para caber no galpão.
- O quadro **"Tiny"** de Configurações (migration 42) **fica** como está.
- Os números informativos do cartão Galpão (peças no estoque agora, reservadas em aguardo, soma dos mínimos) podem ficar; "soma das sugestões" some junto com a regra.
- **Não apagar a coluna** `plt_setores.capacidade_pecas` (sem exclusão de dado/schema sem pedir): só deixar de usar. Se achar que deve remover, pergunte.
- Quem passa a limitar o tamanho do estoque é o **Top X** (item 1.2): só os X mais vendidos têm mínimo.

### 1.2 Top X configurável = tamanho da página
- Na tela Estoque, um controle para o responsável digitar o Top X: **mínimo 1, máximo 50**.
- **X é o tamanho da página:** página 1 = 1º ao Xº; página 2 = X+1 ao 2X; e assim por diante, na ordem dos mais vendidos.
- Paginação **no servidor** (regra 17): só busca a página seguinte quando alguém troca de página. Some o "Ver os outros produtos".
- Ordem: vendidos em 90 dias (já com o corte do item 1.7) desc; depois os que não venderam — proposta: quem tem estoque primeiro, depois por nome. Busca continua procurando no catálogo inteiro.
- **Valor único para toda a equipe** (não é preferência pessoal). Quem pode alterar: logística e admin. Mudança gera log (D-40).
- **Só os X primeiros têm mínimo** (decisão do dono). Produto fora do Top X fica sem mínimo e nunca pede reposição.

### 1.3 Filtro no topo, ao centro
Alternador/filtro com 3 posições (o dono prefere que funcione como filtro):
1. **Todos** — a tela principal de hoje.
2. **Necessidade de produção** — produtos do Top X em que `em estoque + reservados para produção < mínimo`. Some daqui quando a quantidade que falta é lançada para produção a partir do PCP.
3. **Reservados para produção** — produtos com peças lançadas para produção e ainda não prontas.

Cada filtro pagina no servidor como o item 1.2.

### 1.4 Cartão do produto
Mostra exatamente:
- Nome
- SKU
- Vendidos em 90 dias (já com o corte; se houve corte, um aviso discreto: "1 pedido grande fora da conta")
- **Em estoque** — número com mais destaque que hoje
- Reservados para produção
- Reservados em venda = **peças prontas separadas para pedidos**. Com a migration 42 isso passa a incluir as peças do estoque que a venda reservou ("Reservada para o pedido N · ainda no estoque") **e** as que já estão em PEDIDOS EM AGUARDO. Mostrar a soma; se ficar confuso, mostrar as duas partes — confirmar com o dono.
- (mínimo continua visível)

Saem os selos "Sem estoque" e "Faltam N para o mínimo". Foto, Entrada/Baixa/Contagem e o detalhe do produto continuam.

### 1.5 Reservados para produção e a regra dos 2 dias úteis
Objetivo do dono: se quem lança produção se ausentar, o substituto vê na tela o que já está sendo reabastecido, sem contar na mão.

- **Convive com a migration 42:** ela já arquiva sozinha a reposição que está no PCP sem nada liberado quando o mínimo fica coberto. O vencimento de 2 dias úteis é uma segunda saída, não substitui essa.
- **Contam como reservadas para produção:** as unidades de reposição daquele produto que estão no PCP (dentro do prazo) + as que já entraram na produção e ainda não chegaram ao ESTOQUE. Proposta do Cowork, conferir com o dono: peça de pedido cancelado que segue em produção rumo ao estoque também conta.
- **Prazo:** se em **2 dias úteis** o que está no PCP não sair para a produção, **a parte parada sai do PCP** (decisão do dono) e deixa de contar como reservada. Se o produto continuar abaixo do mínimo, volta para "Necessidade de produção" (e, com a automação ligada, a plataforma cria uma reposição nova).
- **Parcial:** o que já entrou na produção continua reservado; **só a parte parada vence**.
- **Dias úteis = horário de funcionamento cadastrado no painel admin** (`plt_horarios_funcionamento`; usar o do setor PCP — confirmar). Não há feriados cadastrados: não invente tabela de feriados sem perguntar.
- "Sair do PCP" é por **evento** (eventos são append-only — regra 5): arquivamento com motivo claro (ex.: `reposicao_vencida`), com o nome "Sistema" como autor.
- Decisão técnica a trazer ao dono: o vencimento roda como rotina agendada ou é aplicado na leitura? Lembre que a automação desligada não pode gerar consulta (item 1.6).

### 1.6 Liga/desliga da reposição automática no painel admin
- Botão liga/desliga no **painel admin**.
- **Desligada = a plataforma finge que a automação não existe:** nenhuma rotina rodando, nenhuma consulta. Recomendação: o botão agenda/desagenda o job no pg_cron (em vez de um job que roda e checa uma flag).
- **Com a automação desligada**, o cartão do produto em necessidade ganha o botão **"Lançar para produção"**, que cria a reposição no PCP (quantidade proposta = mínimo − estoque − reservados para produção, editável). Os filtros de necessidade e de reservados continuam funcionando.
- Pergunte ao dono se o botão manual também deve aparecer com a automação ligada.
- Antes de ligar: a contagem inicial da logística ainda não foi feita (tudo em 0) — ligar agora faria todo o Top X pedir reposição. Deixe **desligado** na entrega.

### 1.7 Nova lógica da sugestão de mínimo (Configurações)
- **Fórmula:** `média por dia útil = vendidos nos últimos 90 dias ÷ dias úteis de venda decorridos no período`; `1 semana = média × dias úteis de uma semana`; `sugestão = 1 semana × semanas de cobertura`, **arredondada para cima**.
  - Exemplo (SKU 327): 96 vendidos ÷ 64 dias úteis (seg–sex) = 1,5/dia → 7,5 → **8 por semana**; 2 semanas → **15**.
  - Dias úteis de venda: mesmos dias da semana do horário da fábrica (confirmar com o dono se é o do PCP ou outro setor).
- **Cobertura:** 1 semana · 2 semanas · 3 semanas · personalizada (digitar o número de semanas; proposta 1 a 12 — confirmar).
- **Mínimo automático, editável:** o mínimo acompanha a sugestão sozinho. Se alguém edita um produto à mão, **aquele produto trava** no valor digitado até clicar em "voltar ao automático". Trocar a cobertura recalcula só os que estão no automático.
- Some o "Usar todas as sugestões" (não faz mais sentido) e some o mínimo do Tiny como reserva: o mínimo passa a ser **automático ou travado à mão**, e só vale para o Top X. Mostrar o do Tiny só como referência, se útil.
- **Segue o Top X:** a lista de Configurações usa a mesma ordem e a mesma página do Top X; fora do Top X, sem mínimo.
- **Corte de pedido fora do comum:** linha de pedido com o mesmo produto **acima de X unidades** (X no **painel admin**, padrão proposto **10**) sai da conta de vendas — **tanto da sugestão quanto do ranking do Top** — como se o pedido não existisse. Mudança gera log.
- Mínimo continua existindo como valor gravado (para a reposição e os filtros não recalcularem a média a cada leitura). Decisão técnica a trazer: quando recalcular o automático (ao trocar cobertura/Top X/corte + uma vez por dia?).

## 2. Fora do escopo (pendência registrada, não mexer salvo se tocar o mesmo ponto)
O dono pediu para deixar anotado como pendência o pacote de correções achado em 29/09 (está no documento do projeto "estoque-raio-x-2026-09-29"): peça danificada de pedido vivo no ESTOQUE (card 502), baixa por fora do caminho oficial, liberação do PCP direto para ESTOQUE/AGUARDO, origem errada da peça manual na alocação, regra de "peça livre" copiada em 3 funções, peça personalizada presa, leitura do Tiny pesada a cada 30 s, reaplicar a migration 36 desfaz a 40, resíduos da "necessidade extrema", 173 produtos sem SKU. **Registrar essa lista em `PLT - Perguntas em Aberto` / `000 - PROXIMOS PASSOS` como pendência**, sem corrigir.
Exceção: se a nova lógica encostar num desses pontos (ex.: o "Usar todas as sugestões" some; a leitura do Tiny deixa de ser usada nos acabados), resolva junto e anote.

## 3. Perguntar ao dono no início da sessão (já respondido no Cowork em 30/09 — só confirmar)
Respondidas: reservado em venda = peças prontas separadas · mínimo automático, editar trava · só o Top X tem mínimo · Top X e cobertura valem para todos · reposição vencida sai do PCP · parcial: só a parte parada vence · automação desligada → botão manual "Lançar para produção".

**✅ Respondidas pelo dono em 30/09/2026 (na sessão de execução):**
1. **Dias úteis:** a loja vende de **segunda a sábado**; a fábrica funciona de **segunda a sexta**. → A sugestão de mínimo usa os dias de venda da loja (seg–sáb, 6 dias/semana); o prazo de 2 dias úteis da reposição parada usa os dias da fábrica (seg–sex). Sem tabela de feriados.
2. **Cobertura personalizada:** limite de **1 a 8 semanas** ("já é suficiente, por enquanto").
3. **Peça de pedido cancelado a caminho do estoque:** **sim**, conta como reservada para produção.
4. **Botão manual "Lançar para produção":** **só com a automação desligada** ("se a automação estiver ligada, esse botão não faz nem sentido aparecer").
5. **Ordem depois do ranking:** "vem por ordem de venda sempre" — e entra um **filtro novo "Com estoque"** (produtos com estoque positivo), 4ª posição do filtro do topo.
6. **Reservados em venda:** **um número só** (inclui o que está em Pedidos em aguardo). Fluxo descrito pelo dono: pedido sai → o estoque subtrai na hora e o cartão ganha uma **bolinha vermelha no canto superior** (pedido esperando decisão do PCP); tocar nela **leva à decisão na tela do PCP**. PCP libera do estoque → a peça pula a produção e vai a Pedidos em aguardo (conta em "reservados em venda"); PCP recusa (vai produzir) → a peça volta ao estoque e a unidade em produção conta em "reservados para produção". **Todo produto com peça em produção ou reservada mostra esses números, mesmo fora do Top X.** (Interpretação registrada: peça produzida para um pedido aparece no número de reservados para produção, mas não abate a conta da NECESSIDADE — quem abate é o que vem para o estoque: reposição e peça de pedido cancelado.)
7. **Vencimento de 2 dias úteis** vale igual para a reposição lançada pelo botão manual: **sim**.

## 4. Critérios de aceite
- [ ] "Quantas peças cabem" e o encolhimento proporcional sumiram; nenhuma sugestão depende de capacidade.
- [ ] Top X de 1 a 50 salvo para todos; página 1 = 1..X, página 2 = X+1..2X; rede mostra 1 requisição por troca de página.
- [ ] Filtro Todos / Necessidade de produção / Reservados para produção, paginado no servidor.
- [ ] Cartão com nome, SKU, vendidos em 90 d, em estoque (destaque), reservados para produção, reservados em venda; sem "Sem estoque"/"Faltam N".
- [ ] Reposição parada 2 dias úteis sai do PCP por evento; parcial vence só a parte parada; produto volta à necessidade se ainda abaixo do mínimo.
- [ ] Liga/desliga no painel admin; desligado = sem job agendado e nenhuma consulta da automação; botão manual "Lançar para produção" funciona. **Entregue desligado.**
- [ ] Sugestão = vendidos 90 d (com corte) ÷ dias úteis × dias úteis/semana × semanas, arredondada para cima; exemplo do 327 confere com a conta do dia.
- [ ] Mínimo automático recalcula ao trocar cobertura; editado à mão trava; "voltar ao automático" funciona; fora do Top X não tem mínimo.
- [ ] Corte de pedido grande (X no painel admin, padrão 10) tira a linha da sugestão **e** do ranking; o Closet do pedido de 23 un. sai da conta.
- [ ] Toda mudança de configuração gera log com autor.
- [ ] Celular (375) e tablet (768) sem rolagem lateral; botões com tamanho de toque.

## 5. Ritual e checklist de validação final (obrigatórios)
(a) entendimento em até 15 linhas · (b) dúvidas de negócio · (c) decisões técnicas — **só codar com o OK do dono**, em português de gente (regra 12c).
Branch própria para este ajuste dentro da worktree do estoque (não criar worktree nova sem ordem do dono).
Execução em `_docs/Plataforma/Execucao/AJUSTE - Estoque 2.md`; erros e acertos na memória de aprendizado na hora; decisões novas viram D-NN (revisando D-71/D-72/D-54 com ↩️).
Validação: testes do banco 2×, checagem de tipos, lint, testes de tela, build, advisors do Supabase, teste logado com o dono. **Aplicar migration no banco de produção só com aprovação explícita**, sozinha (`--so`), conferindo a integração do Tiny antes/depois.
Handoff em `_docs/Handoffs/` + mapa + próximos passos atualizados.
