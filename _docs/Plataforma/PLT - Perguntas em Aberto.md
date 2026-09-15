---
titulo: Plataforma — Perguntas em Aberto (entrevista de descoberta)
tipo: descoberta
data: 2026-08-19
atualizado: 2026-09-15
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

## ⏸️ Adiadas (bonificação — D-04 revisada; retomar quando o dono reabrir o tema)

- ⏸️ **Q-10 · O que conta como "produção" de um usuário?** (dupla, divisão de ponto)
- ⏸️ **Q-11 · Ponto por card ou por peso do card?** (minutos-padrão por produto)
- ⏸️ **Q-12 · Anti-manipulação: quais golpes prever e o que exige aprovação do líder?**
- ⏸️ **Q-14 · Ranking público no chão de fábrica ou só gestão?**

## 🟠 Fluxo e modelo

- ✅ **Q-28 · ROTAS na plataforma?** → respondida em 26/08, nas palavras do dono: *"coloque o setor de rotas nos primórdios de criação"*. **ESTOQUE e ROTAS nascem como setores terminais desde o seed**; a ROTAS é terminal de *handoff* enquanto a logística viver no ClickUp (D-05) → [[PLT - Decisoes de Produto#D-18]]. Desbloqueou a SESSAO-04.
- ⏸️ **Q-21 · Card de unidade que se divide:** e quando UMA unidade gera trabalho paralelo (base de metalon na METALURGICA enquanto a madeira corre na SECC)? O card se divide em sub-cards que se juntam na montagem? → **adiada de propósito em 27/08 (SESSAO-04): "fica para depois" (D-22). Nada no modelo depende disso; quando decidido, entra como acréscimo.**
- **Q-22 · Terceirizados (corte/fita para SF Madeiras etc., 350+ cards hoje):** entram na plataforma desde o dia 1 como fluxo próprio, ou ficam fora do escopo inicial?
- **Q-23 · Produção para estoque** (best-sellers sem pedido): o card nasce de onde, já que não há pedido no Tiny? Botão "produzir para estoque" no PCP?
- ✅ **Q-24 · Cancelamento** → respondida em 28/08 (bloco noturno): card marcado "cancelado", visível, não some; com unidades liberadas, notifica admins → D-31
- **Q-25 · Migração:** os cards vivos do ClickUp/Trello entram na plataforma no corte (importação), ou só pedidos novos nascem nela e o legado morre onde está?

## 🟡 UX e visual

- **Q-30 · Referência visual:** *(modo escuro ✅ respondido em 28/08: 8 temas claro→escuro no Meu Perfil — D-41)* o "réplica do ClickUp" vale também para o visual (sidebar, densidade, cores por etapa), ou é só o funcionamento? Existe identidade Domoby (cores/logo) que a plataforma deve vestir? Modo escuro?
- ✅ **Q-31 · A tela do setor (tablet)** → respondida em 28/08: todos os dados do produto, nenhum dado de cliente, espaço funcional de imagens (futura biblioteca de peças) → D-28
- ✅ **Q-32 · Som/alerta físico no setor** → respondida em 28/08: som mínimo e discreto na chegada de card → D-28
- **Q-33 · Idioma dos termos:** manter os nomes que a equipe já usa (SECC, FITAMENTO, "rota") — sugestão: sim, sempre.

## 🟢 Automações internas e alertas

- **Q-40 · Quais as 3 primeiras automações internas** que você configuraria no estilo "quando X, faça Y"? (candidatas óbvias do cofre: card parado > N dias alerta o líder; pedido completo — todas as unidades prontas — avisa a expedição)
- **Q-41 · Quem pode criar automações?** Só admin, ou líder também (no escopo do setor dele)?
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

- **Q-63 · Formato definitivo do ID de produção do Estoque** (por ora campo digitável livre — D-38): número do pedido do Tiny? sequencial próprio? etiqueta impressa?
- **Q-64 · Os 8 temas (D-41):** o Claude Code propõe as 8 variações claro→escuro no DNA Domoby e o dono ajusta ao ver. Alguma cor proibida/obrigatória?
- **Q-65 · Endereço para o mapa das ROTAS (D-39):** o endereço de entrega vindo do Tiny é completo/padronizado o bastante para geocodificar? Pedido sem endereço válido aparece como na programação?

## 🟣 União das Plataformas (15/09/2026 — D-46)

- **Q-66 · Onde mora o dashboard do Comercial no menu?** Por ora ele nasce dentro do próprio módulo, em `/comercial/dashboard` (decisão do dono em 15/09: *"deixa a 16 como está, depois alteramos isso da comercial"*). Em aberto: os filhos do pai **Dashboards** passam a ser nomeados por domínio ("Dash Produção", "Dash Comercial", …)? Se sim, as quatro telas da SESSAO-16 viram abas de um filho só, ou continuam quatro filhos com prefixo? Lembrar que a *Visão do dia* é candidata a TV do galpão e precisa de URL fixa.
- **Q-67 · Quando o projeto Supabase antigo (`kfkcumjepnxnnzyvmxfo`) pode ser excluído?** O plano prevê 2–4 semanas de quarentena após o cutover, mas a data é decisão do dono — e só depois do dump final de backup guardado.
- **Q-68 · Quem ganha o módulo `comercial` depois do admin?** A D-46 fixou "só admin por ora, ajustando com o tempo" — falta saber quais papéis/pessoas entram na segunda leva e se o acesso é por pessoa ou por papel.

## Ver também

[[PLT - Visao Geral]] · [[PLT - Decisoes de Produto]] · [[PLT - Requisitos]] · [[000 - ORDEM DAS SESSOES]] · [[PLT - Plano Uniao das Plataformas]]
