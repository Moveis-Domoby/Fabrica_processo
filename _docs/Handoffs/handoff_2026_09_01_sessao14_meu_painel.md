---
titulo: Handoff — SESSAO-14 Meu Painel e Metas
tipo: handoff
data: 2026-09-01
atualizado: 2026-09-01
tags: [handoff, sessao, plataforma, metas, meu-painel]
---

# 📋 Handoff — SESSAO-14 · Meu Painel e Metas — a 2ª do Bloco 3 (a reforma)

**Branch:** `sessao-14-meu-painel` (mesclada na main e publicada em 01/09, a seu pedido na conversa)
**Banco:** migrations **23** (`plt_metas`) e **24** (espelho dos gatilhos de pedidos) aplicadas em 01/09 com sua autorização na conversa — pela API do Supabase (o host direto do Postgres não resolve nesta rede: só IPv6). Impressão digital e contagens da integração conferidas antes/depois: **idênticas**.
**Demanda:** [[SESSAO-14 - Meu Painel e Metas]] · **Memória:** `docs/execucao/SESSAO-14.md`
**Decisões que regem:** D-37 (painel + metas) · D-34 · D-02 · D-29 · D-32 · D-40 · suas respostas de 01/09 (membros veem meta do setor; transferência/mover contam unidade; semana começa na segunda)

## 1. O que foi feito

- **`/inicio/meu-painel` virou o Meu Painel de verdade:** *O que me espera* (qualidade a atestar · delegados a mim · tarefas em aberto · em execução agora, cada bloco com contagem e os primeiros itens clicáveis), *Avisos recentes* (os mesmos do sino, toque marca como lido) e o **cockpit Minhas metas** no molde do mockup: barra de andamento + **traço do "onde o período já deveria estar"**, % em tempo real, selo verde de meta batida. A boas-vindas antiga morreu (os quadros vivem na barra Controle de Produção).
- **Metas (D-37):** criar/editar/encerrar com indicador (**unidades concluídas** · **tarefas concluídas** · **horas úteis** — D-29), período diária/semanal/mensal (janelas em America/Fortaleza que reiniciam sozinhas; semana começa na segunda — mudável num lugar só) e dono pessoa OU setor. **Progresso nunca é digitado** — calculado no banco (`plt_fn_metas_painel`) dos eventos que já existem. Quem cria: admin (qualquer), líder (setor dele e gente dele), a própria pessoa — **RLS garante no banco**. Encerrar é definitivo e o dono não muda (regras de trigger); história em `plt_metas_eventos` **append-only**; tudo entra na trilha D-40.
- **Afazeres** intacto em `/inicio/afazeres` (testado ao vivo).
- **Migration 24 — espelho da blindagem do backfill:** o repo agora recria os DOIS gatilhos com guarda em `pedidos` (a nota do esquema mandava). **Achado em produção:** a reaplicação completa da S13 tinha ressuscitado o gatilho antigo SEM guarda, e o backfill rodando encheu o PCP — ver §5.

## 2. Verificação executada

| Critério da demanda | Resultado |
|---|---|
| Login cai em `/inicio/meu-painel` com pendências reais | ✅ ao vivo: sua conta caiu no painel; tarefa criada apareceu em "Tarefas em aberto" na hora |
| Meta progride sozinha quando o dado-fonte muda | ✅ ao vivo (tarefas): concluir a tarefa levou a meta a **100% · meta batida**; unidades (inclusive transferência e mover contando) e tempo útil provados no `test:banco` com contagens exatas |
| Janelas diária/semanal/mensal corretas (America/Fortaleza), reiniciam sozinhas | ✅ janela calculada no banco a cada consulta; `test:banco` confere que toda meta sai com janela |
| Líder cria só para gente/setor dele; operador só pessoal; RLS no banco | ✅ policies aplicadas (4) e gates da porta provados no `test:banco` (operador de fora vê zero; sem sessão, zero). ⚠️ E-14: RLS por papel não se prova no PGlite — conferi policies/grants aplicados no banco real |
| Progresso em tempo real sem recarregar | ✅ realtime em `plt_cards` invalida as consultas + polling de 15s; gestos na própria tela atualizam na hora |
| Afazeres igual à S12 no novo endereço | ✅ ao vivo: tarefa criada e concluída lá |

Mais: `test:banco` 2 rodadas **TUDO VERDE** (+21 verificações novas) · tsc · lint · Vitest **28/28** (5 novos de `progresso.ts`) · build · advisors: **18 WARN esperados** (+1 da porta nova, de propósito) e nada inesperado · conferência E-20 pós-aplicação (triggers/policies/check do dono como desenhado; exatamente os 2 gatilhos em `pedidos`) · trilha D-40 real da verificação: `entrou → meta_criada → tarefa_criada → tarefa_concluida → meta_encerrada`.

## 3. O que você precisa saber

- 🔴 **Troque a sua senha AGORA** (Meu Perfil → senha): ela ficou escrita no chat **de novo** nesta sessão. Enquanto ela for `1…9`, qualquer pessoa com o link e o seu e-mail entra como admin.
- 🟠 **O PCP está com ~163 cards de pedidos históricos/encerrados** — o gatilho antigo sem guarda (ressuscitado pela reaplicação da S13) reagiu ao backfill. A blindagem voltou (migration 24) e **nenhum card novo indevido nasce mais**; os 163 que já nasceram estão lá. Ver decisão pendente no §5.
- Os cards/tarefas/meta do teste ao vivo ficaram registrados (eventos append-only): 1 tarefa concluída e 1 meta encerrada, ambas com "teste da sessão" no nome — são inofensivos e documentam a verificação.

## 4. Como validar (3 minutos)

1. Entre: você cai no **Meu Painel** — pendências, avisos e o cockpit.
2. **Nova meta** → "unidades concluídas" · semanal · alvo à sua escolha · dono = um setor → a meta aparece com o traço do "alvo até agora"; finalize uma execução em qualquer card do setor e veja o feito subir sozinho.
3. Peça a um líder para criar meta de outro setor → o banco recusa (RLS).
4. Supabase → `plt_metas_eventos` e `plt_logs_atividade`: cada gesto virou linha; tente editar uma linha da história → o banco recusa.

## 5. Pendente / decisões para você

- **Os ~163 cards históricos no PCP:** quer que a próxima sessão os **arquive em massa** (evento `card_arquivado`, exclusão lógica — o histórico fica)? É 1 comando preparado; não executei porque mexer em dado de produção em lote é decisão sua (regra 3).
- **Meta pessoal criada por líder pode ser editada/encerrada pela própria pessoa** (letra da D-37 — "segue a mesma regra"). Se preferir travar para só quem criou, é 1 ajuste de policy.
- **"Horas úteis" de meta de setor** contam só EXECUÇÃO no setor (fila não é "trabalhado"). Se quiser fila+execução, é 1 ajuste na porta.
- O aplicador de migrations por terminal (`banco:aplicar`) **não funciona nesta rede** (host direto só IPv6) — apliquei pela API do Supabase com as mesmas conferências. Se a rede mudar, o script volta a valer.

## 6. Notas do cofre atualizadas

[[SUPA - Esquema do Banco]] (migrations 23/24 + aviso do gatilho atualizado) · [[PLT - Memoria de Aprendizado]] (**E-23, E-24**) · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · [[SESSAO-14 - Meu Painel e Metas]] (resultado)

## Ver também

[[SESSAO-14 - Meu Painel e Metas]] · [[handoff_2026_08_28_sessao13_navegacao]] · [[SESSAO-15 - Logistica e ROTAS com Caminhoes]] (a próxima)
