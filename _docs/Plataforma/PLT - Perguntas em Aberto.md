---
titulo: Plataforma — Perguntas em Aberto (entrevista de descoberta)
tipo: descoberta
data: 2026-08-19
atualizado: 2026-10-01
tags: [plataforma, descoberta, perguntas]
---

# ❓ PLT — Perguntas em Aberto

> [!abstract] Como usar
> A entrevista de descoberta contínua com o dono. Pergunta respondida ganha `✅` + resumo da resposta + link para a decisão (`D-NN`) quando virar uma. Pergunta adiada de propósito ganha `⏸️`. Pergunta nova entra no grupo certo com o próximo número. **Nenhuma resposta é inventada** — o que não estiver respondido aqui está em aberto.

## Respondidas em 19/08/2026

- ✅ **Q-01 · O que é o card?** → Híbrido: pedido no PCP, unidade nos setores, reagrupa na expedição → [[PLT - Decisoes de Produto#D-01]]
- ✅ **Q-02 · Como conta o tempo na etapa?** → Fila e execução contados separados; dash compara e soma → D-02
- ✅ **Q-03 · Quem decide o destino do card?** → Manual por ora; automação futura via API aberta → D-03
- ✅ **Q-04 · Produtividade vira bônus?** → ↩️ Revisada: bonificação adiada, medição é alavancagem operacional → D-04
- ✅ **Q-05 · Escopo do lançamento?** → Produção primeiro, ROTAS fica no ClickUp com ponte n8n → D-05
- ✅ **Q-06 · Dispositivo do operador?** → Tablet/PC fixo por setor + celular pessoal, os dois → D-06
- ✅ **Q-07 · Estoque entra quando?** → Módulo da mesma plataforma, fase 2 → D-07
- ✅ **Q-08 · Qual banco?** → O mesmo Supabase da fábrica → D-08
- ✅ **Q-13 (parcial) · Dano/retrabalho** → virou o sistema de qualidade em 3 estados com dupla atestação → D-09

## Respondidas em 24/08/2026

- ✅ **Q-15 · Foto obrigatória?** → NÃO — nem na saída nem na entrada → D-09 revisada
- ✅ **Q-17 · Pausa por disputa conta no tempo de quem?** → **Não existe disputa/pausa por enquanto**; divergência é só registro para a dash. E ficou definido: **tempo de fila pertence ao setor/etapa, nunca a uma pessoa** (card na fila não está direcionado a ninguém); fila longa = gargalo = sinal de contratação → D-02 detalhada, D-09 revisada
- ✅ **Q (ordem) · API antes das telas?** → SIM, no formato simples: plataforma **recebendo do n8n** → D-11, nova [[SESSAO-09 - Entrada de Pedidos via n8n]] executada logo após o kanban
- ✅ **Q-16 · Critério do 🟡?** → "levemente danificado, porém ainda dá pra seguir e tentar consertar" — escrito na interface → D-09 complemento
- ✅ **Q-18 · Notificação de qualidade?** → Divergência OU 🟡 OU 🔴 → líder/admin notificado automaticamente **com exatamente o que aconteceu** → D-09 complemento
- ✅ **Q-19 · API exige estado de qualidade?** → NÃO — qualidade é gesto exclusivamente humano; API move sem estado → D-09 complemento
- ✅ **Q-20 · Setores do dia 1?** → Os do ClickUp DPTO PRODUÇÃO: PCP · SECC · CNC · FITAMENTO · FURAÇÃO · MONTAGEM · LIMPEZA E EMBALAGEM, com **cadastro livre de novos setores e de etapas dentro de cada setor** (2 níveis, como no ClickUp) → D-12

## ❌ Descartadas (bonificação — D-04 revisada; ↪️ 01/10: o dono mandou esquecer o tema — D-94)

- ❌ **Q-10 · O que conta como "produção" de um usuário?** (dupla, divisão de ponto)
- ❌ **Q-11 · Ponto por card ou por peso do card?** (minutos-padrão por produto)
- ❌ **Q-12 · Anti-manipulação: quais golpes prever e o que exige aprovação do líder?**
- ❌ **Q-14 · Ranking público no chão de fábrica ou só gestão?**

## 🟠 Fluxo e modelo

- ✅ **Q-28 · ROTAS na plataforma?** → respondida em 26/08, nas palavras do dono: *"coloque o setor de rotas nos primórdios de criação"*. **ESTOQUE e ROTAS nascem como setores terminais desde o seed**; a ROTAS é terminal de *handoff* enquanto a logística viver no ClickUp (D-05) → [[PLT - Decisoes de Produto#D-18]]. Desbloqueou a SESSAO-04.
- ⏸️ **Q-21 · Card de unidade que se divide:** e quando UMA unidade gera trabalho paralelo (base de metalon na METALURGICA enquanto a madeira corre na SECC)? O card se divide em sub-cards que se juntam na montagem? → **adiada de propósito em 27/08 (SESSAO-04): "fica para depois" (D-22). Nada no modelo depende disso; quando decidido, entra como acréscimo.** ↪️ **01/10:** o dono pediu explicação — levada a ele com três caminhos: (a) a unidade ganha **sub-cards** (base na METALÚRGICA, tampo na SECC) que se juntam na MONTAGEM, que só começa com todos chegados; (b) o card segue um caminho só e a parte paralela vira **tarefa ligada** a ele; (c) a base vira **item próprio do pedido** (SKU próprio no Tiny). Recomendação: (a), e casa com a onda 4 do [[003 - PLANO - Integracao Completa Tiny da Fabrica]] (produção por peça). Aguardando a escolha do dono.
- **Q-22 · Terceirizados (corte/fita para SF Madeiras etc., 350+ cards hoje):** entram na plataforma desde o dia 1 como fluxo próprio, ou ficam fora do escopo inicial? ↪️ **01/10:** o dono pediu uma ideia. Proposta levada a ele: o serviço de terceiro vira um **card de serviço** — nasce no PCP (pelo pedido do Tiny com os itens de serviço, que o catálogo já tem — Corte, Furo…, ou à mão pelo PCP), percorre **só os setores do serviço** (CNC, FITAMENTO), termina num fim de linha próprio **"Separado para retirada"** e tem selo e cor próprios — a fila do setor passa a mostrar a carga real e o dashboard separa tempo próprio × terceiro. Aguardando o dono (quem cobra e como o pedido de serviço nasce hoje).
- ✅ **Q-23 · Produção para estoque** → respondida em 26/09 (SESSAO-25): abaixo do mínimo do Tiny, o **estoque gera no PCP um card de reposição**; o PCP decide (libera ou não produz); pronta, a peça fica livre no estoque → [[PLT - Decisoes de Produto#D-54]]
- ✅ **Q-24 · Cancelamento** → respondida em 28/08 (bloco noturno): card marcado "cancelado", visível, não some; com unidades liberadas, notifica admins → D-31
- **Q-25 · Migração:** os cards vivos do ClickUp/Trello entram na plataforma no corte (importação), ou só pedidos novos nascem nela e o legado morre onde está? ⏸️ **01/10:** o dono vai **integrar o Trello por completo** à plataforma primeiro, para estudar a lógica que a fábrica usa nele; a migração se decide depois disso.

## 🟡 UX e visual

- **Q-30 · Referência visual:** *(modo escuro ✅ respondido em 28/08: 8 temas claro→escuro no Meu Perfil — D-41)* o "réplica do ClickUp" vale também para o visual (sidebar, densidade, cores por etapa), ou é só o funcionamento? Existe identidade Domoby (cores/logo) que a plataforma deve vestir? Modo escuro? ↪️ 01/10: reformulada ao dono em linguagem simples (as telas devem imitar o visual do ClickUp ou só o jeito de funcionar? há cores/logo oficiais da Domoby?).
- ✅ **Q-31 · A tela do setor (tablet)** → respondida em 28/08: todos os dados do produto, nenhum dado de cliente, espaço funcional de imagens (futura biblioteca de peças) → D-28
- ✅ **Q-32 · Som/alerta físico no setor** → respondida em 28/08: som mínimo e discreto na chegada de card → D-28
- **Q-33 · Idioma dos termos:** manter os nomes que a equipe já usa (SECC, FITAMENTO, "rota") — sugestão: sim, sempre.

## 🟢 Automações internas e alertas

- ✅ **Q-40 · Quais as 3 primeiras automações internas** que você configuraria no estilo "quando X, faça Y"? (candidatas óbvias do cofre: card parado > N dias alerta o líder; pedido completo — todas as unidades prontas — avisa a expedição) → respondida em 01/10: **nenhuma definida ainda — o módulo de automações existe justamente para testá-las** → [[PLT - Decisoes de Produto#D-92]]
- ✅ **Q-41 · Quem pode criar automações?** → respondida em 01/10: **só admin, por enquanto** (revisar depois) → D-92 · ↪️ **01/10 noite (SESSAO-27): só o SUPER ADMIN** (o dono) cria, edita e liga — D-99/D-102
- **Q-42 · Notificações:** onde o líder recebe alertas (inclusive os de qualidade da D-09)? Na plataforma, WhatsApp (via n8n), e-mail?

## 🔵 API e integrações

- ✅ **Q-50 · Autenticação da API** → respondida em 28/08: chave opaca gerada no admin (hash no banco), escopos leitura/escrita, revogável na hora → SESSAO-11
- ✅ **Q-51 · O que o n8n faz no dia 1?** → respondida em 28/08: **nada novo** — a entrada é trigger no próprio banco (D-31) e nada mais se cria no ClickUp (D-33)
- ✅ **Q-52 · A plataforma lê do Tiny?** → NÃO — o n8n empurra tudo; a plataforma só lê o próprio banco → D-31/D-33

## ⚪ Operação e infraestrutura

- ⏸️ **Q-60 · Internet no galpão:** wi-fi cobre todos os setores? Se cair, a produção para de registrar — precisa de modo offline básico ou aceita o risco? → **adiada com a SESSAO-08 (D-30): sem deploy por ora; o dono avisa quando for lançar**
- ✅ **Q-61 · Quantos usuários** → respondida em 26/08 (SESSAO-03): **~30 usuários** na largada → [[PLT - Decisoes de Produto#D-21]]
- ⏸️ **Q-62 · Hospedagem do front:** VPS atual da Hostinger, Vercel, ou decidir com o Claude Code? → **adiada com a SESSAO-08 (D-30): sem deploy por ora; o dono avisa quando for lançar**

## 🟤 Reforma (bloco 3 — 28/08/2026)

- ✅ **Q-63 · ID do Estoque** → respondida em 26/09 (SESSAO-25): o ID é o **SKU** (a equipe etiqueta e conta por SKU); peça reservada ganha a segunda etiqueta, o **nº do pedido**. O campo livre sai da tela → [[PLT - Decisoes de Produto#D-56]]
- **Q-64 · Os 8 temas (D-41):** o Claude Code propõe as 8 variações claro→escuro no DNA Domoby e o dono ajusta ao ver. Alguma cor proibida/obrigatória? ↪️ 01/10: reformulada ao dono junto com a Q-30.
- ✅ **Q-65 · Endereço para o mapa das ROTAS (D-39):** o endereço de entrega vindo do Tiny é completo/padronizado o bastante para geocodificar? Pedido sem endereço válido aparece como na programação? → respondida em 01/10: **sim — o endereço do cliente que o Tiny manda é o endereço de entrega das ROTAS** → D-93 (o pedido sem endereço válido segue como a SESSAO-28 definir)

## 🟣 União das Plataformas (15/09/2026 — D-46)

- ✅ **Q-66 · Onde mora o dashboard do Comercial no menu?** Por ora ele nasce dentro do próprio módulo, em `/comercial/dashboard` (decisão do dono em 15/09: *"deixa a 16 como está, depois alteramos isso da comercial"*). Em aberto: os filhos do pai **Dashboards** passam a ser nomeados por domínio ("Dash Produção", "Dash Comercial", …)? Se sim, as quatro telas da SESSAO-16 viram abas de um filho só, ou continuam quatro filhos com prefixo? Lembrar que a *Visão do dia* é candidata a TV do galpão e precisa de URL fixa. → 01/10: **fica dentro do Comercial, por enquanto — não é pendência** → D-91
- ✅ **Q-67 · Quando o projeto Supabase antigo (`kfkcumjepnxnnzyvmxfo`) pode ser excluído?** O plano prevê 2–4 semanas de quarentena após o cutover, mas a data é decisão do dono — e só depois do dump final de backup guardado. → respondida na SESSAO-21: **exclusão em 06/10/2026**, backup dispensado pelo dono (F7 — [[handoff_2026_09_22_sessao21_cutover]])
- ✅ **Q-68 · Quem ganha o módulo `comercial` depois do admin?** A D-46 fixou "só admin por ora, ajustando com o tempo" — falta saber quais papéis/pessoas entram na segunda leva e se o acesso é por pessoa ou por papel. → respondida em 01/10: **o usuário do Comercial**. Haverá três tipos — **da fábrica, do comercial e dos dois** — com permissões bem definidas → D-91

## 🟫 Quadro por arrasto e fins de linha (SESSAO-24 — 27/09/2026)

- ✅ **Q-69 · A peça 502 🔴 do pedido 13215** → respondida em 27/09: **nada a fazer** — *"ninguém tá usando essa bomba, tudo que tu tá vendo aí é teste ainda, mas os pedidos são reais"*. A plataforma ainda não está em uso no galpão: card é teste (a 502 nasceu na validação ao vivo da SESSAO-22). Fica como está.
- ✅ **Q-70 · Unidades em produção de pedidos já "Entregue" no Tiny** → respondida em 27/09: **arquivar** — a 518 (13257) e a 537 (13236) foram arquivadas por evento (a 537 teve o tempo aberto fechado antes; o limite de quem a iniciou ficou livre) — `supabase/manutencao/2026-09-27_arquivar_unidades_de_pedidos_entregues.sql`.

## 🟩 Frete fora da produção (ajuste — 28/09/2026 — D-63)

- ✅ **Q-71 · Revenda e acessório no estoque da plataforma — o que falta no Tiny.** → respondida em 29/09: **fica tudo como está** (nada a fazer na plataforma nem no Tiny). Na D-63 o dono disse que *"cadeiras e outros acessórios assim … devem estar no estoque cadastradas com a quantidade de acordo com o Tiny, se não está assim atualmente, está errado"*. Conferido em 28/09: as cadeiras estão em Estoque → Produtos acabados com o número do Tiny. Ficou em aberto:
  - (a) **Espelho Adnet, Longarina e Carro de mão** são vendidos pela loja mas **não existem no Tiny da fábrica** (o SKU da venda, quando há, é outro produto lá — ex.: 435 é uma estante) — cadastrar no Tiny da fábrica? → ✅ *"Pode deixar essas coisas aí, quando eles sentirem falta, eles cadastram."*
  - (b) As **lâmpadas LED em kit** (7 e 8 unidades) são classe "kit" no Tiny e por isso aparecem em **Matéria-prima e insumos**, não em Produtos acabados (regra da D-57) — mudar a classe no Tiny, ou a tela passa a mostrar kit de revenda em acabados? → ✅ *"Devem ficar nos insumos, elas são insumos."* A regra da D-57 continua valendo.
  - (c) **"Fechadura (com instalação)"** não tem SKU no Tiny — a venda não reserva a peça (a conta da reserva casa pelo SKU, D-55) — dar um SKU a ela? → ✅ **fica sem SKU.** A premissa já estava velha quando a pergunta foi refeita ao dono (E-67). Desde a D-70 a venda não reserva nem baixa o estoque dos acabados, com ou sem SKU. Sem SKU, a fechadura só fica de fora do Top 20 e da sugestão de mínimo, que casam pelo SKU (o cadastro dela no Tiny da fábrica também não tem SKU). Primeira resposta, dada com a premissa velha: *"Padronize pelo formato do nome"*. Corrigida a premissa, o dono escolheu **"Deixar como está"**: ela é insumo e serviço, como as lâmpadas, e ficar fora dos mais vendidos dos acabados está certo.
  - Registro do levantamento (29/09, só leitura): 376 dos 8.134 itens de pedido vêm sem SKU. O cadastro tem **60 produtos prontos (F/S/V) ativos sem SKU**, e nenhum chega perto do Top 20: o que mais vendeu em 90 dias teve 5 peças, contra 21 do 20º colocado. Hoje não há efeito prático. Se um dia importar, o caminho é a equipe dar SKU no Tiny; a porta de "reconhecer pelo nome" foi oferecida ao dono e não escolhida.

## 🟨 O raio-x do estoque (29/09/2026) — pendência registrada, SEM correção

- **Q-72 · O pacote de correções do raio-x de 29/09** (documento do projeto "estoque-raio-x-2026-09-29"; o dono mandou **anotar sem corrigir** — demanda Ajuste Estoque 2, seção 2). Os achados, à espera de uma frente própria:
  1. Peça danificada de pedido VIVO parada no ESTOQUE (o card 502 — é teste, mas a porta existe).
  2. Baixa de peça por fora do caminho oficial (sem passar pela porta da movimentação).
  3. Liberação do PCP direto para ESTOQUE/AGUARDO (pula a produção sem ser pela sugestão).
  4. Origem errada da peça manual na alocação.
  5. A regra de "peça livre" copiada em 3 funções (M-04: um dono por regra).
  6. Peça personalizada presa (não entra nem sai pelos caminhos normais).
  7. Leitura do Tiny pesada a cada 30 s na tela.
  8. Reaplicar a migration 36 desfaz a 40 (ordem de recriação).
  9. Resíduos da "necessidade extrema" (regra morta da D-55).
  10. 173 produtos sem SKU no catálogo.
  - ↪️ 30/09 (Ajuste Estoque 2): nenhum dos 10 foi corrigido — era fora do escopo; o "Usar todas as sugestões" citado no raio-x deixou de existir (D-84).
  - ↪️ 01/10: o dono decidiu tratar as pendências técnicas **depois** (a SESSAO-29 vem antes).

## Ver também

[[PLT - Visao Geral]] · [[PLT - Decisoes de Produto]] · [[PLT - Requisitos]] · [[000 - ORDEM DAS SESSOES]] · [[PLT - Plano Uniao das Plataformas]]
