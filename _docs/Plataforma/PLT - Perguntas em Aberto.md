---
titulo: Plataforma — Perguntas em Aberto (entrevista de descoberta)
tipo: descoberta
data: 2026-08-19
atualizado: 2026-08-26
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
- ✅ **Q (ordem) · API antes das telas?** → SIM, no formato simples: plataforma **recebendo do n8n** → D-11, nova [[SESSAO-13 - Entrada de Pedidos via n8n]] executada logo após o kanban
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
- **Q-21 · Card de unidade que se divide:** e quando UMA unidade gera trabalho paralelo (base de metalon na METALURGICA enquanto a madeira corre na SECC)? O card se divide em sub-cards que se juntam na montagem?
- **Q-22 · Terceirizados (corte/fita para SF Madeiras etc., 350+ cards hoje):** entram na plataforma desde o dia 1 como fluxo próprio, ou ficam fora do escopo inicial?
- **Q-23 · Produção para estoque** (best-sellers sem pedido): o card nasce de onde, já que não há pedido no Tiny? Botão "produzir para estoque" no PCP?
- **Q-24 · Cancelamento:** pedido cancelado no Tiny no meio da produção — o card some, congela ou vai para uma etapa "cancelado" com decisão humana do que fazer com as peças?
- **Q-25 · Migração:** os cards vivos do ClickUp/Trello entram na plataforma no corte (importação), ou só pedidos novos nascem nela e o legado morre onde está?

## 🟡 UX e visual

- **Q-30 · Referência visual:** o "réplica do ClickUp" vale também para o visual (sidebar, densidade, cores por etapa), ou é só o funcionamento? Existe identidade Domoby (cores/logo) que a plataforma deve vestir? Modo escuro?
- **Q-31 · A tela do setor (tablet):** o operador precisa ver o quê além da fila? (imagem 3D do móvel — hoje existe nos cards —, medidas, observação do pedido?) O que é ruído?
- **Q-32 · Som/alerta físico no setor** quando chega card novo na fila, ou o tablet é consultado passivamente?
- **Q-33 · Idioma dos termos:** manter os nomes que a equipe já usa (SECC, FITAMENTO, "rota") — sugestão: sim, sempre.

## 🟢 Automações internas e alertas

- **Q-40 · Quais as 3 primeiras automações internas** que você configuraria no estilo "quando X, faça Y"? (candidatas óbvias do cofre: card parado > N dias alerta o líder; pedido completo — todas as unidades prontas — avisa a expedição)
- **Q-41 · Quem pode criar automações?** Só admin, ou líder também (no escopo do setor dele)?
- **Q-42 · Notificações:** onde o líder recebe alertas (inclusive os de qualidade da D-09)? Na plataforma, WhatsApp (via n8n), e-mail?

## 🔵 API e integrações

- **Q-50 · Autenticação da API:** chave por integração (estilo Tiny v2) é suficiente? Quem gera/revoga no painel admin?
- **Q-51 · O que o n8n faz no dia 1?** Confirmar: (a) pedido novo no Tiny → card no PCP; (b) unidade chega em EXPEDIÇÃO → card na ROTAS do ClickUp; (c) mais alguma?
- **Q-52 · A plataforma também precisa LER do Tiny** (situação, cancelamento, edição de pedido) ou o n8n empurra tudo?

## ⚪ Operação e infraestrutura

- **Q-60 · Internet no galpão:** wi-fi cobre todos os setores? Se cair, a produção para de registrar — precisa de modo offline básico ou aceita o risco?
- ✅ **Q-61 · Quantos usuários** → respondida em 26/08 (SESSAO-03): **~30 usuários** na largada → [[PLT - Decisoes de Produto#D-21]]
- **Q-62 · Hospedagem do front:** VPS atual da Hostinger, Vercel, ou decidir com o Claude Code?

## Ver também

[[PLT - Visao Geral]] · [[PLT - Decisoes de Produto]] · [[PLT - Requisitos]] · [[000 - ORDEM DAS SESSOES]]
