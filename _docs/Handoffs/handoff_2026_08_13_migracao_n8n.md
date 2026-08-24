---
titulo: Handoff — 11 a 13/08/2026 (migração Plugga → n8n)
tipo: handoff
data: 2026-08-13
atualizado: 2026-08-13
tags: [handoff, sessao, n8n, fabrica]
---

# 📋 Handoff — 11–13/08/2026 · Migração Plugga → n8n

> Sessão longa (3 dias) sobre a **fábrica**, não sobre o painel de recompra. O detalhe técnico completo está nas notas de [[N8N - Visao Geral da Migracao]]; este handoff é a linha do tempo e as decisões.

## 1. Objetivo da sessão

Continuar a migração das 7 automações do Plugga para o n8n (a 1ª já estava no ar). Nas palavras do usuário: montar passo a passo, ele configurando os nós na interface com instruções minhas — sem colar JSON pronto de workflow.

## 2. O que foi feito, em ordem

1. **Levantamento da automação ClickUp (ROTAS)** — prints do Plugga + card real do Trello 12878 + CSVs da planilha conferidos linha a linha (print validado contra o pedido 13046 real).
2. **Incidente em produção (11/08 16:16)** — credencial Google OAuth expirada derrubou o fluxo Tiny→Planilha por ~2h; pedidos 13047/13048 recuperados por retry. Causa: consent screen em "Testing" → refresh token de 7 dias. **Correção definitiva: Service Account** + planilha compartilhada com a conta de serviço. Detalhes: [[N8N - Incidente Credencial Google]].
3. **Migração 2 — ROTAS ClickUp** no ar: Code lê a API crua (não a planilha, por causa dos apóstrofos), trava anti-duplicação dentro do Code (o IF do editor de expressões falhava em silêncio), due date ISO ao meio-dia de Fortaleza. Teste 13046 ok, Plugga desativado. [[N8N - ROTAS ClickUp]]
4. **Migração 3 — PCP Trello**: descoberta a natureza por-unidade da PCP com marcador `(k/n)`; algoritmo reconstruído e validado **758/758** contra a aba real (armadilhas: ARRUMAR colapsa espaços internos; quantidade 0 não vira card). Explicada a causa da duplicação de cards (fórmulas posicionais + gatilho por posição + `atualizacao_pedido` ligado na migração 1). Credencial Trello via Power-Up. Caça-duplicatas rodado: zero. [[N8N - PCP Trello e ClickUp]]
5. **Migração 4 — PCP ClickUp**: irmã da 3, descoberta pelo volume da lista PCP no ClickUp (1.123 tarefas). Corrigida a tentativa de encadear ClickUp após Trello (tem que ser paralelo). Testes com 13065 (2 unidades) ok; Plugga desativado.
6. **Pesquisa API Tiny v2 vs v3** → decisão: **ficar na v2**; registrado o ativo do cron de refresh no Supabase e a regra do dono único. [[N8N - API Tiny v2 vs v3]]
7. **Migração 5 — cadastro de cliente** iniciada: endpoints confirmados (pesquisa/incluir/alterar por CPF), arquitetura decidida (Trigger Sheets → validar → pesquisa → incluir/alterar), blindagem de CPF aprovada. **Parada aguardando o CSV das respostas.** [[N8N - Cadastro de Cliente (em andamento)]]
8. **Discussão de medição de tempo de montagem** (pedido da equipe via WhatsApp) — opções mapeadas, nada implementado. [[FAB - Estrutura de Producao (Trello e ClickUp)]]
9. **Este cofre** ganhou a seção `Fabrica n8n/` com a memória completa da migração.

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Pendurar destinos no workflow do webhook | Replicar polling do Sheets | card em segundos; elimina a raiz da duplicação |
| Só criar (nunca atualizar) cards/tarefas | "Criar e atualizar" do Plugga | dispensa rastrear IDs; o "atualizar" do Plugga era ilusório (chave = nome) |
| Nome de tarefa "limpo" | Réplica exata com `- -` | bairro de entrega vazio em 98% das linhas |
| Descrição enriquecida (Complemento + OBS) | Réplica exata do Trello | ajuda entregador; evita erro de cobrança |
| Trava anti-dup dentro do Code | Node IF | IF falhava em silêncio no editor de expressões |
| Service Account no Google | Reconectar OAuth / publicar app | não expira; server-to-server é o caso de uso |
| Permanecer na API v2 do Tiny | Migrar para v3 | v3 = refresh token 24h rotativo no caminho crítico; sem webhook documentado |
| CPF inválido → cadastrar sem CPF + aviso em obs | Enviar como veio | melhor cliente sem CPF que CPF errado na base |
| Trello e ClickUp da PCP em ramos paralelos | Em série | série quebra referências e acopla falhas |

## 4. Bugs e incidentes

**Resolvidos:** credencial Google expirada (P-raiz corrigida); duplicação de cards da PCP (raiz eliminada pela arquitetura); tentativa de encadear destinos (corrigida antes de ir ao ar).
**Descobertos e abertos:** ver [[N8N - Pendencias e Riscos]] (P1–P13) — o mais crítico é **P1: não existe alerta de erro**.

## 5. Estado ao fim da sessão

- Workflow principal **publicado** com 4 saídas em produção: planilha, ROTAS ClickUp, PCP Trello, PCP ClickUp
- Workflow auxiliar `FAXINA · Cards duplicados no Trello` (manual)
- Plugga: 4 automações desativadas (não apagadas — são o plano de rollback), 1 ativa (cadastro), 2 desconhecidas
- Documentação: cofre atualizado (esta seção) + docs no projeto Claude "N8n"

## 6. Ficou pendente

**Aguardando o usuário:** CSV das respostas do formulário (destrava a migração 5) · escolha do canal do alerta de erro (P1) · aval para a fórmula do cancelado (P9) · nomes/gatilhos das automações 6 e 7.
**Próximo passo sugerido:** P1 (alerta de erro) — 20 minutos que eliminam a classe inteira de "descobrir parada por acaso".

## 7. Como validar que está tudo no ar

1. Criar/aguardar um pedido real no Tiny → linha na COMPLETO + 1 tarefa em ROTAS + N cards no Trello 1-PCP/PEDIDO + N tarefas na PCP ClickUp, tudo em segundos
2. Editar um pedido no Tiny → linha atualiza; **nenhum** card/tarefa novo
3. n8n → Executions: execuções verdes, sem fila de erros
