---
titulo: Mapa do Cofre Domoby
tipo: indice
atualizado: 2026-11-18
tags: [mapa, indice, moc]
---

# 🗺️ Mapa do Cofre — Domoby

> [!abstract] O que é este cofre
> A **memória de longo prazo da Móveis Domoby**: a fábrica (automações, processos, a Plataforma de Produção) e o comercial. Uma fábrica de móveis em MDF (e linha industrial com metalurgia própria) em Natal-RN. ↪️ **18/11/2026:** o cofre segue o **padrão de mapas** — este mapa aponta para o mapa de cada área, e cada mapa aponta para as notas pequenas. Ninguém precisa ler arquivo grande inteiro.

## 🧭 Rota de leitura

1. **Sempre:** [[000 - REGRAS DE OURO]] (e o `CLAUDE.md` da raiz do repositório). É a leitura obrigatória inteira — cabe em 40 KB.
2. **A demanda da vez** ([[000 - ORDEM DAS SESSOES]]) e os mapas que a seção "Leitura da sessão" dela listar.
3. **Daí em diante, só seguindo ligação ou busca:** a decisão, a nota do banco, a lição, o design.
4. **O que falta fazer:** [[000 - PROXIMOS PASSOS]]. **O que já foi feito:** [[MOC - Sessoes e Handoffs]].

## 🗂️ As áreas da plataforma (um mapa por área)

| Área | Mapa | O que tem lá |
|---|---|---|
| Kanban e Produção | [[MOC - Kanban e Producao]] | cards, setores, etapas, qualidade, quadro por arrasto |
| PCP | [[MOC - PCP]] | liberação, reposição, cancelar e ocultar pedido |
| Estoque | [[MOC - Estoque]] | acabados, mínimo, Top X, saldo com o Tiny |
| Expedição | [[MOC - Expedicao]] | peça pronta com pedido, devolução, cancelado pronto |
| Logística e ROTAS | [[MOC - Logistica e ROTAS]] | programação, calendário, entregador, entrega parcial |
| Tiny e n8n | [[MOC - Tiny e n8n]] | as duas contas do Tiny, a fila, os fluxos do n8n |
| Tablet e TV | [[MOC - Tablet e TV]] | PIN do setor, auxiliar, presença, Modo TV |
| Tempos e Painéis | [[MOC - Tempos e Paineis]] | o tempo certo, Tempos de produção, painéis, metas |
| Comercial | [[MOC - Comercial]] | recompra, campanhas, disparo, atendimento |
| Acesso e Usuários | [[MOC - Acesso e Usuarios]] | pessoas, níveis, login, senha, perfil |
| Auditoria e Logs | [[MOC - Auditoria e Logs]] | o rastro de toda atividade |
| Publicação e Infra | [[MOC - Publicacao e Infra]] | banco, migrations, Vercel, rotinas agendadas |
| Meu Painel, Chat e Automações | [[MOC - Meu Painel Chat e Automacoes]] | Meu Painel, tarefas, chat, avisos, automações, Tech |
| Interface e Navegação | [[MOC - Interface e Navegacao]] | navegação, menu, cabeçalho, temas, busca |
| Processo de Trabalho | [[MOC - Processo de Trabalho]] | o método, as regras, o próprio cofre |

## 📚 Onde mora cada coisa

| O quê | Onde | Índice (não se lê inteiro) |
|---|---|---|
| Decisões de produto — **uma nota por decisão** | `Plataforma/Decisoes/` | [[PLT - Decisoes de Produto]] |
| Lições (erros, acertos, modelos) — **por tema** | `Plataforma/Memoria/` | [[PLT - Memoria de Aprendizado]] |
| Banco — **por domínio** | `Supabase-fabrica/Banco/` | [[SUPA - Esquema do Banco]] |
| Design — **por assunto** | `Plataforma/Design/` | [[PLT - Modelo de Sistema]] |
| Lei de desempenho e as dívidas | `Plataforma/` | [[PLT - Lei de Desempenho e Escala]] |
| Demandas (uma por sessão) | `Plataforma/Demandas/` | [[000 - ORDEM DAS SESSOES]] |
| Diários técnicos | `Plataforma/Execucao/` | [[000 - EXECUCAO (indice)]] |
| Handoffs (o resumo para o dono) | `Handoffs/` | [[MOC - Sessoes e Handoffs]] |
| Planejamento | `Planejamento/` | [[000 - PROXIMOS PASSOS]] |
| O que saiu da frente (planos e prompts já executados, textos antigos) | `Arquivo/` | achado por busca |

**Notas de base da plataforma:** [[PLT - Visao Geral]] (o fluxo real da fábrica) · [[PLT - Requisitos]] · [[PLT - Perguntas em Aberto]] (o que **não tem resposta**: pergunte) · [[PLT - Modelo de Dados (conceito)]] · [[PLT - API Aberta]] · [[PLT - Entrada Automatica de Pedidos]] · [[CLAUDE - Regras do Claude Code (repo)]] (o detalhe de cada regra) · [[CLAUDE]] (as instruções permanentes do cofre)

## 🔌 Fora da plataforma

- **Automações n8n e Tiny** (pasta `Fabrica n8n/`) — comece por [[N8N - Visao Geral da Migracao]] e [[N8N - Tiny Modelos Mentais]]; problemas e riscos em [[N8N - Pendencias e Riscos]]. Todas as notas: [[MOC - Tiny e n8n]].
- **Banco** (pasta `Supabase-fabrica/`) — [[SUPA - Visao Geral]] · o comercial: [[SUPA - Comercial - Dominio de Dados]] · [[SUPA - Comercial - Edge Functions]] · [[SUPA - Comercial - Cron e Rotinas]].
- **Módulo Comercial** — [[MOC - Comercial]].
- **Atendimento** (memória de negócio, não código) — [[000 - ATENDIMENTO (indice)]] · [[ATD - Equipe - Felipe Padrao Ouro]] · [[ATD - Equipe - Gabriel]] · [[ATD - Equipe - Gessica]] · [[ATD - FAQ e Respostas Padrao]] · [[ATD - Follow-up DataCrazy - Anatomia]] · [[ATD - Follow-up DataCrazy - Defeitos]] · [[ATD - Follow-up DataCrazy - Especificacao Importavel]] · [[ATD - Follow-up DataCrazy - Fluxo v2]] · [[ATD - Por que Convertemos Pouco]] · [[ATD - Recepcao e Follow-up]].
- **Processos fabris** — [[FAB - Estrutura de Producao (Trello e ClickUp)]] · [[FAB - Processo Alvo - Um Clique Um Evento]].
- **Pesquisa e ideias** — [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]] · [[003 - PLANO - Integracao Completa Tiny da Fabrica]].
- **Arquivo** — [[Mapa do Projeto - como era ate 18-11-2026]] · [[Ordem das Sessoes - resumos longos ate 18-11-2026]] · [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[004 - PLANO - Bloco 6 - Producao de Ponta a Ponta e Kanban Completo]] · [[PLT - Plano Uniao das Plataformas]] · [[PLT - Plano Noturno Sessoes 07-12]] · [[PROMPT - Bloco 1 (Sessoes 01 a 05)]] · [[PROMPT - Bloco 2 (Sessoes 05 a 09)]] · [[PROMPT - Bloco 5 (Sessoes 22 a 28)]] · [[PROMPT - Bloco 6 (Sessoes 30 a 32)]].

## 🧩 Templates

[[TEMPLATE - Demanda]] · [[TEMPLATE - Handoff de Sessao]]

## Como manter o cofre em ordem

- **Decisão nova** = nota nova em `Plataforma/Decisoes/`. **Lição nova** = na nota do tema. **Banco mudou** = bloco novo no fim da nota do domínio. **Sessão entregue** = uma linha em [[MOC - Sessoes e Handoffs]] e o status em [[000 - ORDEM DAS SESSOES]].
- **Toda citação de id é ligação** (`node scripts/cofre/verificar.mjs --ligar` faz isso sozinho).
- **No fim de toda sessão:** `node scripts/cofre/verificar.mjs --gerar` (refaz os índices e as listas dos mapas) e `node scripts/cofre/verificar.mjs` (zero erro: nenhuma ligação quebrada, nenhuma nota solta, tudo dentro do teto).
- **Mover de pasta não quebra ligação; renomear quebra.** Nome de nota é único no cofre inteiro.
