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

### 16/10 ~20:35 UTC — §1: pessoa desativada recusada já no login (D-141) — tarefa 3

- **Push bloqueado:** `git push` → 403 do GitHub ("Claude doesn't have GitHub access to Moveis-Domoby/Fabrica_processo for your organization"); pela API (conector do GitHub) ler funciona e criar a branch dá "Resource not accessible by integration". Dono avisado com os dois caminhos (reconectar o GitHub no claude.ai e, se preciso, instalar o aplicativo do Claude na organização). Os commits seguem locais; cópia de segurança num pacote do git no scratchpad (`backup/sessao33.bundle`), refeita a cada etapa.
- `supabase/pendentes/2026-10-16_gancho_do_token.sql`: o bloco (RECUSAR) virou código — pessoa com `ativo = false` → `{"error": {"http_code": 403, "message": "Seu acesso à plataforma está desativado. Fale com a liderança para voltar a entrar."}}` ao emitir **e** ao renovar o token (o formato do erro de gancho Postgres conferido na documentação da Supabase pelo conector: o erro sobe ao app, não tem nova tentativa, e o Auth só chama o gancho depois de conferir a senha). Conta do Auth sem cadastro segue com `plt_ativo = false` (sem mudança). Cabeçalho e passo 4 do "como ligar" atualizados.
- `supabase/functions/autenticacao/index.ts` (`entrar`): o atalho "inativo → NEGADO antes de tentar a senha" saiu; agora a senha é conferida no Auth para todo cadastro. Senha errada → "Usuário ou senha incorretos." (igual a hoje, não confirma conta). Senha certa e desativado → 403 com a frase `DESATIVADO` — com o gancho ligado, pela recusa do próprio Auth (o corpo traz a frase); sem o gancho, a função recebe a sessão, **encerra-a na hora** (`/auth/v1/logout?scope=local`, melhor esforço) e não a entrega. A tela de entrar já mostra o `erro` que a função devolve (nada a mudar no front). Estilo conferido só nas linhas novas (o arquivo já tinha diferenças antigas de formatação — não reformatado, para o diff ficar só no que mudou). **Publicar a função é publicação em produção → com o OK do dono.**
- Bateria do banco: bloco novo "gancho do token (pendente)" — lê o arquivo pendente numa transação desfeita (com o papel `supabase_auth_admin` imitado): ativa → permissões no token; desativada → 403 com a MESMA frase da função de login (lida do `index.ts` — as duas amarradas); sem cadastro → sem acesso; só o Auth executa; nada sobra. 1ª rodada: 1 vermelho (o teste esperava `plt_id` número — é uuid); corrigido o teste → **1.018 verificações, TUDO VERDE**.

### 16/10 ~20:45 UTC — §1: Auditoria e histórico das automações por rolagem (D-141, resposta 6) — tarefa 4

- **Conferido no código:** Auditoria → **Atividade** já anda por cursor e carrega ao rolar (`useInfiniteQuery` + `MaisAoRolar`, migration 81) ✅ · Automações → **histórico das execuções** idem (`Execucoes.tsx`) ✅ · Auditoria → **Conferências com o Tiny** ainda era por **número de página** (`Paginacao` + deslocamento + total a cada página) ❌ — a única que faltava. (A lista das automações em si é catálogo pequeno e limitado — deslocamento justificado, fora da resposta 6.)
- **Migration 88** `20261016130000_plt_auditoria_conferencias_por_cursor.sql` (escrita, **não aplicada**): `plt_fn_auditoria_conferencias(p_limite, p_deslocamento, p_antes_id)` — cursor pela última rodada, `tem_mais`, total/em andamento/agendada só na 1ª página; `p_deslocamento` fica só para a tela já publicada não quebrar nos minutos entre banco e site (Lei §7.6 · E-73). Índice parcial `eventos_pente_fino_idx` (tabela da integração → no pedido de OK; criar antes com `CONCURRENTLY`). Produção hoje (só leitura, `now()` 20:28 UTC): `eventos` 18.791 linhas, só a chave primária; 18 rodadas.
- **Tela:** `src/paginas/Auditoria.tsx` (aba das conferências com `useInfiniteQuery` + `MaisAoRolar`, sem `Paginacao`) · `src/auditoria/api.ts` (`buscarConferencias(antesId, porPagina)`, tipos `total | null` e `tem_mais`) · `src/paginas/Auditoria.test.tsx` (1ª página sem cursor; nenhuma navegação de páginas).
- **Provas:** tipos (`tsc -b`) ✔ · estilo (eslint e prettier nos arquivos tocados) ✔ · testes de tela **191/191** ✔ (2 arquivos precisam do `.env.local` que esta nuvem não tem — rodados com valores de mentira para a URL e a chave, sem rede) · montagem com o teto de 250 KB ✔ · bateria do banco **1.019 verdes** (bloco 50: de 1 em 1 pelo cursor = a lista inteira na mesma ordem; total só na 1ª; a chamada antiga por deslocamento segue servindo; assinatura nova fechada para anônimo).
- Nota do esquema: entrada da 88 marcada ⏸️ "escrita, não aplicada". O `supabase-fabrica-schema.sql` só muda quando a 88 for aplicada (ela não toca coluna da integração; o índice entra no retrato nessa hora).

### 16/10 ~20:37 UTC — §1: a imagem de teste do comprovante no pedido 13622 — tarefa 5 (montada; espera o "pode")

- Só leitura no banco real: o pedido 13622 tem **um** anexo — id 1, "TESTE - comprovante de exemplo.png" (PNG, 37 KB), enviado pelo dono em 15/10 05:40 UTC no cartão do pedido (cartão arquivado desde a D-140). Ninguém escuta `anexo_removido` (4 webhooks ativos, nenhum desse fato; nenhum gatilho de automação de anexo).
- Caminho normal = a porta do botão "Tirar" (`plt_fn_anexo_remover`) em nome de quem enviou (o dono): `removido_em/removido_por` + fato novo `anexo_removido` (regra 5); o arquivo fica guardado, só o admin vê.
- **Ensaio desfeito (A-11)** como o dono (`set_config('role','authenticated')` + o `sub` = `auth_user_id`): `tirado`, `removido_por` = o dono, 1 fato, 0 anexos visíveis; conferido depois que nada ficou (removido_em nulo, 0 fatos).
- Pronto para rodar UMA vez com o "pode": `supabase/manutencao/2026-10-16_tirar_imagem_teste_13622.sql`.

### 16/10 ~20:50 UTC — §2: a demanda escrita — tarefa 6

- `Demandas/SESSAO-33 - Tiny Completo - Todos os Dados Atualizados por Evento.md` (template da casa: o que é, como esta sessão é diferente, Etapas A/B/C, §4, §1, decisões que regem, fora do escopo, critérios de aceite, notas para o Claude Code, **Tarefas no ClickUp** com os 4 links, resultado a preencher). Linkada na `000 - ORDEM DAS SESSOES.md` (linha 33º, 🔨 em execução).

### 16/10 ~21:30 UTC — §2 Etapa A entregue: o mapa completo do Tiny — tarefa 7

- Os 3 relatórios voltaram (scratchpad `pesquisa/`): **A1** (a especificação v3 recurso por recurso, 1.058 linhas — os ÚNICOS filtros "o que mudou" da v3 são `GET /produtos?dataAlteracao`, `/contatos?dataAtualizacao`, `/pedidos?dataAtualizacao`; `producao.etapas` são só NOMES, sem ligação com os componentes; ausentes na 3.1 de fev/2026: logs de movimentação, depósitos, orçamentos, webhook, listagem de OP), **A2** (v2: limites confirmados na página oficial — 60/min no Evoluir, ¼ de concorrência, lotes 5/min, 100 por página, `x-limit-api`, erros 6/11/20/22/32; a busca de contas a receber aceita `id_origem`; os avisos da conta: vendas confirmado; e-commerce só para integração de plataforma), **A3** (novidades: `GET /depositos` desde a 3.1.2 de mar/2026; "Listar logs de movimentação de estoque (autoria e origem)" no índice oficial, caminho a conferir; orçamentos na v3; o campo `estoque` saiu de `GET /produtos/{id}` em 17/09/2026; pacote de limite adicional; extratos bancários; nenhum indício de webhook na v3 nem de listagem de OP).
- **Nota nova** `Fabrica n8n/N8N - Tiny - Mapa Completo da API e dos Dados.md`: contas e cota (§1), o que o Tiny avisa de verdade (§2), "o que mudou" por dado (§3), tipo por tipo — vendas, catálogo e estoque, compras e finanças (§4), **"na hora" × "com atraso"** (§5), a carga inicial com tempo, ritmo e prova (§6), o que já temos no n8n e o que muda (§7), o que conferir em casa (§8), fontes (§9). Cada linha com a sua fonte; o não confirmado marcado "a conferir".
- **Achados do banco (só leitura, ~21:20 UTC) que mudaram o desenho da cascata:**
  - o aviso de venda é gravado em `eventos` **sem o corpo** (`payload` nulo nos 3.187) → o `idContato` do aviso **não** está guardado; o pedido da v2 traz `cliente.cpf_cnpj` (e `codigo`), não o id → a cascata do cliente vai pela **busca do CPF/CNPJ** (`contatos.pesquisa` `cpf_cnpj`) + `contato.obter`;
  - `contas_receber.raw` tem 17 chaves e **nenhuma** de origem → a cascata das contas vai pela busca com `id_origem` = o id da nota do pedido;
  - 2.881 pedidos têm `id_nota_fiscal`; **150** apontam nota que não temos (as notas pararam em 08/09);
  - 240 clientes nasceram só do pedido (sem o cadastro do Tiny);
  - a fila: `fn_fila_proximos` (lote de 30, prioridade, `for update skip locked`, devolve linha travada há 15 min), `fn_backfill_aplicar` (busca → enfileira; detalhe → grava em pedidos/clientes/notas/contas), `fn_backfill_falha` (4 tentativas, sem espera entre elas), o relógio `plt-tiny-fila` (a cada minuto **só enquanto há trabalho**; chama o n8n só se não há lote em andamento; desagenda-se sozinho) — quem acorda é a conferência das 3h; nenhum gatilho em `tiny_fila`;
  - `tiny_fila`: único `(recurso, chave)`, `recurso` com lista fechada de 8, sem coluna de conta; `tiny_auth`: 4 colunas, `CHECK (id = 1)`;
  - gatilhos em `pedidos`: reagir (inserção/atualização), automações (situação), comercial (inserção/exclusão/atualização); em `clientes`: comercial (fone); em `contas_receber`: vincular.
- O espelho do fluxo da fila no cofre (`domoby-backfill-tiny.json`) é o de 28/08 (8 nós; monta só `dataInicial/dataFinal/pagina`); o vivo passa os filtros da fila "palavra por palavra" (nota do backfill, D-122) → **A-44: o passo de importar começa conferindo o vivo**.

## Plano (Etapa B) — versão técnica (a do dono vai em português na conversa)

**Princípio:** UM trabalhador (o fluxo "subir banco de dados — tiny → supabase", melhorado), UMA fila (`tiny_fila`, remodelada), a lógica no BANCO (versionada e provada pela bateria) e o n8n como executor genérico: pega o lote → chama o Tiny → devolve a resposta crua ao banco. As duas contas. v2 já; v3 (fábrica; loja só leitura com o token de hoje) por uma ponte segura.

1. **`tiny_fila` remodelada** (tabela da integração → OK): `conta` ('loja' padrão | 'fabrica'); único `(conta, recurso, chave)` (os `on conflict` das funções que enfileiram acompanham na mesma atualização); `recurso` com a lista nova; `nao_antes` (nova tentativa com espera crescente; o "limite do Tiny" — v2 erro 6/11, v3 429 — não gasta tentativa); `fn_fila_proximos` devolve também o que pedir (`api`, endpoint/caminho, campos, conta) — o n8n antigo ignora os campos novos (o banco pode subir antes do n8n).
2. **Uma resposta só para o banco:** `fn_tiny_fila_resposta(fila_id, resposta)` — erros (20 = página vazia; 32 = não existe; 6/11/429 = espera), paginação, enfileirar detalhes, gravar. As gravações de hoje (pedido, contato, nota, conta a receber) seguem pelas mesmas rotinas.
3. **Onde mora cada dado (D-47):** o que já tem casa fica nela (pedidos, itens, clientes, notas e contas a receber da loja; produtos). **Novo:** `plt_tiny_registros` — UMA tabela para tudo o que ninguém mostra ainda (contas a pagar das duas contas, notas/contatos/pedidos da fábrica, cadastros pequenos, foto do estoque por depósito, e na fase 2 compras, depósitos, categorias financeiras, movimentações): `conta, recurso, chave, raw, hash, lido_em, mudou_em, sumiu_em` (grava só se o hash mudou — D-50); e `plt_produto_componentes` (móvel → peça/insumo com quantidade), porque a plataforma vai mostrar e usar (D-142).
4. **Cascata na hora (gatilho novo e blindado em `pedidos` — D-43):** pedido gravado pelo aviso → enfileira a nota do pedido (se não temos ou mudou), o cliente pelo CPF/CNPJ (pedido novo ou cliente sem cadastro), e as contas a receber pela nota → acorda a fila. Nunca derruba a gravação do pedido.
5. **Avisos de nota autorizada e pedido enviado:** endereço novo no MESMO fluxo (gravar o aviso cru + enfileirar o que reconhecer); conserta o endereço morto dos pedidos enviados. O formato real se captura no 1º aviso (F-05).
6. **Fase 2 — API nova:** `tiny_auth` aceita a linha 2 (fábrica); função `tiny-fabrica-token` (autorizar pelo botão da plataforma, com `state` assinado; renovar só pelo cron próprio — o ÚNICO renovador da linha 2); função `tiny-v3` (a ponte: só leitura, lista de caminhos permitidos, tempo limite, nunca renova — A-18). Segredos postos pelo dono em casa (regra 4).
7. **Conferência "bateu com o Tiny":** censo (1ª e última página por tipo e conta) → contagem e soma por mês no Tiny × aqui, numa porta da Auditoria.
8. **Alerta de erro (P1):** fluxo de erro do n8n + linha da fila que chega a "erro" → aviso no sino do admin + Auditoria (sem repetir o mesmo aviso no dia).
9. **Plataforma (D-142):** Configurações → Móveis, insumos e peças: "do que é feito" e "onde é usado" (no clique) + a lista dos insumos com unidade fora do padrão ou sem unidade.
10. **Ritmo:** 1 chamada a cada 2 s (≤ 30/min — metade da cota de uma conta), a conferência e a cascata passam na frente da carga, a fábrica não roda nas varreduras da madrugada dela; carga começa quando o dono mandar.

**Para o dono decidir:** o ritmo do que o Tiny não avisa (de hora em hora × só de madrugada); a baixa por etapa (agora × próxima; por insumo → setor × por móvel e peça); as liberações pendentes (imagem do 13622, rolagem das conferências, login com a mensagem de desativado). **§4** (rotinas de minuto em minuto): proposta de virar a próxima sessão.
