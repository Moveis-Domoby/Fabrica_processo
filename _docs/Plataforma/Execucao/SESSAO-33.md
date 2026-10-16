---
titulo: Execução — SESSAO-33 · Tiny completo — todos os dados, atualizados quando algo acontece
tipo: execucao
data: 2026-10-16
atualizado: 2026-10-16
tags: [execucao, sessao-33, tiny, n8n, integracao, api-v2, api-v3, webhooks, carga, conferencia]
---

# 🔧 Execução — SESSAO-33 · Tiny completo

**Onde roda:** sessão **na nuvem** (Claude Code direto no GitHub), com o dono fora de casa, falando pelo celular. O cofre é a pasta `_docs/` do repositório. **Branch:** `claude/sessao-33-tiny-completo-s3gukn` (a branch designada pela sessão da nuvem — o nome pedido, `sessao-33-tiny-completo`, com o prefixo e o sufixo que a nuvem exige), criada da `main` = `origin/main` = **d9f61c9** (SESSAO-32 inteira). Commits com autor `contatodomoby` (E-33: é o autor que a Vercel publica quando a `main` avança).
**Demanda:** [[SESSAO-33 - Tiny Completo - Todos os Dados Atualizados por Evento]] (escrita nesta sessão a partir do pedido do dono de 16/10).
**Numeração reservada (conferida no cofre e nas migrations, 16/10):** migration **88** em diante · **D-141** em diante (D-141 e D-142 usadas) · **E-108** em diante · **A-72** em diante.
**O que esta sessão NÃO alcança daqui:** o n8n (a chave da API dele está só no computador do dono) e chamadas ao Tiny (o token não está aqui e nunca deve ser pedido — regra 4). O banco: só leitura sem o OK do dono (regra 2). Tudo que precisar do n8n ou de aplicar no banco sai **pronto em arquivo** para ligar em casa.

## Lista de tarefas (espelho do pedido do dono, item a item)

1. Leitura obrigatória do cofre (CLAUDE.md, memória, decisões, lei de desempenho, ordem das sessões, handoff de 16/10, esquema, plano 003, notas `N8N - *Tiny*`, `N8N - API Tiny v2 vs v3`, `N8N - Pendencias e Riscos`, `SUPA - Comercial - Cron e Rotinas`). ✅
2. §1 — registrar as respostas do dono de 16/10 (próximos passos, mapa, ordem das sessões, decisão nova, handoff de 16/10 com ↪️) → commit e push só disso.
3. §1 — o gancho do token (pendente) recusa a pessoa desativada já no login, com mensagem clara.
4. §1 — Auditoria e histórico das automações por rolagem (cursor): conferir; colocar onde faltar.
5. §1 — a imagem de teste do comprovante no pedido 13622: montar a retirada pelo caminho normal, mostrar ao dono, executar só com o "pode".
6. §2 — escrever a demanda SESSAO-33 (template da casa, com "Tarefas no ClickUp") e linkar na ordem das sessões.
7. §2 Etapa A — a pesquisa aprofundada (agentes em paralelo + web) → `Fabrica n8n/N8N - Tiny - Mapa Completo da API e dos Dados.md`.
8. §2 Etapa B — o plano ao dono ((a) entendimento, (b) dúvidas, (c) decisões técnicas) → só construir com o OK.
9. §2 Etapa C — construir o que der daqui (banco em arquivo, fluxos do n8n em JSON, conferência "bateu com o Tiny", alerta de erro).
10. §3 — ClickUp: cada tarefa em FAZENDO ao começar; comentário humanizado ao entregar; nunca concluir.
11. §4 — (só com OK) rotinas de minuto em minuto → nascer do fato; senão, escrito como próxima sessão.
12. §5 — fechamento: esta memória, aprendizados, handoff com "Para ligar em casa", mapa/ordem/próximos passos, push.

## Diário

### 16/10 ~20:00 UTC — largada

- `git status` limpo na branch da sessão; nenhum `cd` (regra 20) — tudo por caminho absoluto.
- Leituras: as do item 1, inteiras onde a regra pede (memória, lei, plano 003, referência do Tiny, modelos mentais, v2×v3, pendências, cron e rotinas, fluxo da fábrica, carga histórica, handoff da 32, ordem, próximos passos); decisões D-01…D-17 + as do Tiny (D-50, D-76…D-80, D-96…D-98, D-113, D-119…D-124, D-136…D-140); esquema do banco (integração + `tiny_fila`, notas, contas a receber; o resto por busca).
- **ClickUp alcançável** daqui (o conector responde). Estados da lista PRODUÇÃO: `a fazer` · `analisar viabilidade` · `fazendo` · `concluído`. A tarefa da pesquisa foi para **fazendo** ao começar a Etapa A.
- **Supabase alcançável** daqui (conector) — só leitura sem o OK do dono.

### 16/10 ~20:03 UTC — os sites oficiais do Tiny estão bloqueados nesta nuvem

- `curl` pelo proxy da sessão: **403 (política)** para `api-docs.erp.olist.com`, `tiny.com.br`, `ajuda.olist.com`, `ajuda.tiny.com.br`, `erp.tiny.com.br`, `api.tiny.com.br`, `olist.mintlify.app` (e até `www.google.com`). Passam: `github.com`, `raw.githubusercontent.com`, os registros do npm e do PyPI. A busca na web (WebSearch) funciona; o WebFetch não resolve nome fora do GitHub.
- **Saída (sem contornar a política):** o **Swagger oficial da API v3** está espelhado num repositório público — `github.com/opastorello/olist-mcp-server` (`swagger.json`, "Olist ERP API v3", versão **3.1**, servidor `https://api.tiny.com.br/public-api/v3`, commit `66a65eb` de 28/02/2026; o README diz que o arquivo vem da URL oficial do Swagger). Clonado só para leitura em `/home/user/opastorello/olist-mcp-server` (fora do repositório). 106 caminhos; a lista ficou no scratchpad (`web/v3_paths.txt`).
- **Primeiros achados (a confirmar na pesquisa):** essa versão **não tem** `/estoque/{id}/logs-movimentacao`, `/depositos`, `/orcamentos`, webhook nem listagem de ordens de produção — o plano 003 (27/09) afirmava logs de movimentação e depósitos na v3; ou chegaram depois de fev/2026 ou o plano se enganou. **Tem:** `/produtos/{id}/fabricado` (componentes com quantidade + `etapas`), `/estoque/{id}` com depósitos e empresa, `GET /produtos?dataAlteracao=`, contas a pagar e a receber com recebimentos, ordens de compra e de serviço, separação, expedição, CRM, listas de preço, vendedores, formas de pagamento/recebimento, categorias de receita e despesa.
- Dono avisado na conversa, com o caminho para liberar os endereços (menu do ambiente → Editar → Acesso à rede → domínios permitidos).

### 16/10 ~20:10 UTC — Etapa A disparada em paralelo (3 agentes de pesquisa, só leitura)

| Agente | O quê | Saída (scratchpad `pesquisa/`) |
|---|---|---|
| v3 — a especificação inteira | todo recurso: filtros (de data, sobretudo "o que mudou"), paginação, campos da lista × do detalhe, enums, custo em chamadas; confirmar a ausência de logs/depósitos/orçamentos/webhook | `A1_v3_por_recurso.md` |
| v2, avisos e limites | confirmar/desmentir o que o cofre afirma (limites, webhooks da conta e de e-commerce, `lista.atualizacoes.*`, estrutura, estoque por depósito, ordem de produção); filtros da v2 por recurso; extensões | `A2_v2_webhooks_limites.md` |
| v3 — novidades de 2026 | cópias mais novas do Swagger, changelog 3.1.x, webhooks na v3, ordens de produção, autenticação | `A3_v3_novidades.md` |

Enquanto isso: o §1 e o inventário do que já temos (banco e n8n) — este, pelo Claude.

### 16/10 ~20:20 UTC — §1: as respostas do dono no cofre

- **D-141** (o que ficou da SESSAO-32 + pendências antigas) e **D-142** (as 6 perguntas do plano 003) em `PLT - Decisoes de Produto.md`.
- `SESSAO-08 - Publicacao no Ar.md`: **fechada como entregue** (status `entregue`, aviso no topo, texto antigo mantido).
- `000 - ORDEM DAS SESSOES.md`: linha da 08 (✅, com o texto antigo riscado) e ↪️ na linha da 32.
- `000 - PROXIMOS PASSOS.md`: bloco novo "Agora (16/10): SESSAO-33"; a 08 sai de "em espera"; pendências 0b/0a/2/3/5 e P1 com ↪️ (nada apagado).
- `handoff_2026_10_16_sessao32_desempenho_escala.md`: ↪️ nas 6 escolhas, nos itens do §7 (máquina, Staging, rotinas, login, cartões de insumo) e no ClickUp.
- `000 - MAPA DO PROJETO.md`: linha de estado de 16/10. `003 - PLANO …`: as 6 respostas no §5. `PLT - Lei de Desempenho e Escala.md`: dívida 19 ↪️ (fica no gratuito).
- **Achado para a tarefa 3:** o login da plataforma (função `autenticacao`, ação `entrar`) **já recusa** a pessoa desativada — mas com "Usuário ou senha incorretos." (de propósito, para não confirmar que a conta existe). Só o gancho não basta para a "mensagem clara": a pessoa desativada nunca chegaria até ele pelo login (o `entrar` recusa antes). → o ajuste vai nos dois lugares (gancho e `entrar`), e a mensagem clara só aparece para quem **acertou a senha**.
