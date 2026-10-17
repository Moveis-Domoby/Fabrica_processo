---
titulo: Execução — SESSAO-33 · Tiny completo — todos os dados, atualizados quando algo acontece
tipo: execucao
data: 2026-10-16
atualizado: 2026-10-17
tags: [execucao, sessao-33, tiny, n8n, integracao, api-v2, api-v3, webhooks, carga, conferencia]
---

# 🔧 Execução — SESSAO-33 · Tiny completo

**Onde roda:** sessão **na nuvem** (Claude Code direto no GitHub), com o dono fora de casa, falando pelo celular. O cofre é a pasta `_docs/` do repositório. **Branch:** `claude/sessao-33-tiny-completo-s3gukn` (a branch designada pela sessão da nuvem — o nome pedido, `sessao-33-tiny-completo`, com o prefixo e o sufixo que a nuvem exige), criada da `main` = `origin/main` = **d9f61c9** (SESSAO-32 inteira). Commits com autor `contatodomoby` (E-33: é o autor que a Vercel publica quando a `main` avança).
**Demanda:** [[SESSAO-33 - Tiny Completo - Todos os Dados Atualizados por Evento]] (escrita nesta sessão a partir do pedido do dono de 16/10).
**Numeração reservada (conferida no cofre e nas migrations, 16/10):** migration **88** em diante · **D-141** em diante (D-141 e D-142 usadas) · **E-108** em diante · **A-72** em diante.
**O que esta sessão NÃO alcança daqui:** o n8n (a chave da API dele está só no computador do dono) e chamadas ao Tiny (o token não está aqui e nunca deve ser pedido — regra 4). O banco: só leitura sem o OK do dono (regra 2). Tudo que precisar do n8n ou de aplicar no banco sai **pronto em arquivo** para ligar em casa.

## Lista de tarefas (espelho do pedido do dono, item a item)

1. Leitura obrigatória do cofre (CLAUDE.md, memória, decisões, lei de desempenho, ordem das sessões, handoff de 16/10, esquema, plano 003, notas `N8N - *Tiny*`, `N8N - API Tiny v2 vs v3`, `N8N - Pendencias e Riscos`, `SUPA - Comercial - Cron e Rotinas`). ✅
2. §1 — registrar as respostas do dono de 16/10 (próximos passos, mapa, ordem das sessões, decisão nova, handoff de 16/10 com ↪️) → commit e push só disso. ✅
3. §1 — o gancho do token (pendente) recusa a pessoa desativada já no login, com mensagem clara. ✅ (login v11 no ar; o gancho em arquivo)
4. §1 — Auditoria e histórico das automações por rolagem (cursor): conferir; colocar onde faltar. ✅ (88 no ar)
5. §1 — a imagem de teste do comprovante no pedido 13622: montar a retirada pelo caminho normal, mostrar ao dono, executar só com o "pode". ✅ (retirada com o "pode")
6. §2 — escrever a demanda SESSAO-33 (template da casa, com "Tarefas no ClickUp") e linkar na ordem das sessões. ✅
7. §2 Etapa A — a pesquisa aprofundada (agentes em paralelo + web) → `Fabrica n8n/N8N - Tiny - Mapa Completo da API e dos Dados.md`. ✅
8. §2 Etapa B — o plano ao dono ((a) entendimento, (b) dúvidas, (c) decisões técnicas) → só construir com o OK. ✅ (D-143)
9. §2 Etapa C — construir o que der daqui (banco em arquivo, fluxos do n8n em JSON, conferência "bateu com o Tiny", alerta de erro). ✅ em arquivo (89–92, funções, n8n, telas; ensaio ×100)
10. §3 — ClickUp: cada tarefa em FAZENDO ao começar; comentário humanizado ao entregar; nunca concluir. ✅ (nenhuma concluída)
11. §4 — (só com OK) rotinas de minuto em minuto → nascer do fato; senão, escrito como próxima sessão. ➡️ não coube — registrada como próxima sessão (34), com a baixa dos insumos (35)
12. §5 — fechamento: esta memória, aprendizados, handoff com "Para ligar em casa", mapa/ordem/próximos passos, push. ✅ (o envio ao GitHub segue recusado — cópia em pacote ao dono)

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

### 16/10 ~23:30 UTC — o plano apresentado; as respostas do dono (D-143)

- Plano em português na conversa + 4 perguntas de toque. **Respostas:** plano **inteiro** (as duas partes: o que a v2 já dá e a API nova da fábrica); o que o Tiny não avisa (produtos e clientes alterados) → **uma vez por hora, mas só entre 8h e 20h**; a baixa dos insumos por etapa → **próxima sessão, amarrando cada insumo ao setor que o consome**; liberou as três: tirar a imagem de teste, aplicar a rolagem das conferências, publicar o login com a mensagem de desativado. §4 (rotinas de minuto em minuto) fica para a próxima (proposto no plano, não contestado).
- **Pedido do dono, logo depois:** *"para de me perguntar, só faz, eu não tô em casa"* → **daqui até o fim, nenhuma pergunta**: o que precisa de banco/n8n novo sai pronto em arquivo; aplicar em produção, só o que ele já liberou.

### 16/10 ~23:41 UTC — a imagem de teste do 13622 saiu (tarefa 5 ✅)

- Rodado o `supabase/manutencao/2026-10-16_tirar_imagem_teste_13622.sql` (UMA vez) pelo conector: `removido_em` 23:41:14 UTC, `removido_por` = o cadastro do dono (conferido: mesmo `auth_user_id`), **1 fato `anexo_removido`**, 0 anexos visíveis no cartão. O arquivo segue guardado (só o admin vê).

### 16/10 ~23:45–00:20 UTC — a rolagem das conferências no banco (migration 88 aplicada)

- Retrato antes: integração `e2109f3a…` (65 colunas) · clientes 10.809 · pedidos 5.578 · itens 8.379 · eventos 18.791 · gp 1.
- Índice `eventos_pente_fino_idx` criado antes com `CREATE INDEX CONCURRENTLY` (fora de transação).
- **E-108 (achado):** pelo conector da Supabase, **todo comando com `DROP` fica esperando uma confirmação do dono e estoura em 60 s** (3 tentativas: `begin…commit`, `apply_migration`, e até um `drop` dentro de transação desfeita com `statement_timeout`) — nada roda, nada fica pela metade (conferido: assinatura antiga intacta, nenhuma sessão presa, nenhuma trava esperando). `REVOKE` e `ALTER … RENAME` passam. → **Aplicada a 88 sem o `DROP`:** a assinatura antiga `(integer, integer)` foi **renomeada e movida** para `plt_privado.plt_fn_auditoria_conferencias_antiga` (fora da API, execute revogado de todos) e a nova criada; o `drop` de verdade vai na próxima atualização aplicada em casa pelo aplicador (que roda `DROP` normalmente).
- Retrato depois: integração **idêntica** (`e2109f3a…`, as mesmas contagens). Assinaturas: nova em `public` (anon ✗, authenticated ✓), antiga só em `plt_privado` (executável por ninguém).
- **Conferido como o dono** (transação desfeita): total 18 · 1ª página 10 + `tem_mais` · 2ª página (pelo cursor) 8, sem mais, sem total · a chamada antiga por deslocamento devolve a mesma rodada que o cursor (a tela publicada segue funcionando até o site novo subir).

### 17/10 ~00:25 UTC — o login com a mensagem de desativado publicado (tarefa do §1 ✅)

- O que estava no ar (versão 10, de 24/09) = o arquivo da `main` (o arquivo entrou no repositório em 14/10 copiado do ar) — conferido função por função; a única diferença é a mudança desta sessão.
- **Publicada a versão 11** da função `autenticacao` (mesma configuração: exige o JWT do app). Daqui não dá para chamá-la (o proxy desta nuvem recusa o endereço da Supabase) — o teste de ponta a ponta fica para casa (uma pessoa desativada de teste tentando entrar).

### 17/10 ~00:05–00:45 UTC — Etapa C: o banco em arquivo (migrations 89–92) e as provas — tarefa 9

- **89** `20261017010000_plt_tiny_fila_duas_contas.sql` — a fila de TUDO nas duas contas (`conta`, `nao_antes`, 29 tipos, único por conta), o catálogo `fn_tiny_recursos()`, o lote com a chamada montada (`fn_tiny_fila_lote`) e a resposta entendida no banco (`fn_tiny_fila_resposta`: v2 e v3; 20 = vazio; 6/11/429 = espera sem gastar tentativa; 32 = não existe; o resto tenta 2/4/8 min e na 4ª vira erro + aviso), `plt_tiny_registros` (o que não tem casa — grava só se mudou), `plt_produto_componentes` (a estrutura), o alerta das automações (`plt_fn_automacao_erro`). **Compatível:** o fluxo antigo segue pelo `fn_fila_proximos` (só loja, os 8 tipos de sempre) até o novo ser importado. As funções vivas da 64 (`fn_tiny_pente_fino_iniciar`, `fn_backfill_aplicar`) recriadas com o único novo — copiadas do banco, só o `on conflict` trocado (E-24).
- **90** `…_plt_tiny_cascata_avisos_carga.sql` — a cascata na hora (gatilho blindado em `pedidos`: nota, contas a receber pela origem, cliente pelo CPF), os avisos de nota/envio (`plt_fn_tiny_aviso`), a consulta de hora em hora 8h–20h (D-143), a contagem e a carga (`plt_fn_tiny_carga`), o painel (`plt_fn_tiny_carga_painel`) e o relógio que fecha a rodada da madrugada pelas linhas DELA.
- **91** `…_plt_tiny_api_nova_fabrica.sql` — `tiny_auth` com a linha 2 (fábrica) e o renovador próprio; **92** `…_plt_produtos_estrutura_unidades.sql` — as portas da estrutura e das unidades fora do padrão.
- **Bateria** (bloco "Tiny completo"): 1.040 → 1.041 → **1.042 verdes**, inclusive o código dos nós do JSON do n8n rodando contra o banco de ponta a ponta. Achados que ela pegou e foram corrigidos: parâmetro com o nome de uma função que já existia (`fn_tiny_numero`, da 42 — reaproveitada), o relógio que não fechava a rodada com a carga na fila (passou a olhar só as linhas da rodada, com índice), `foreach` em campo de registro, `cron.job` lido sem o agendador (agora dentro de um `if`), a rodada do painel por `max()` de texto (agora pela última criada) e a chave do aviso que se repetia (`contexto.aviso_id`).

### 17/10 ~00:45–00:50 UTC — as funções da API nova e o n8n em arquivo — tarefas 17 e 18

- `supabase/functions/tiny-v3/index.ts` (a ponte: só GET, só a lista de caminhos, token lido no banco com a chave de quem chama, 30 s, nunca renova) e `supabase/functions/tiny-fabrica-token/index.ts` (autorizar pelo botão do site com `state` assinado de 15 min; renovar só pelo relógio próprio de 3 em 3 h, com a vez reservada; falha → aviso). **Não publicadas** (regra 2). Conferidas com um esboço de Deno no scratchpad (tipos) e o Prettier. **01:08:** a volta do Tiny passou a sempre devolver o dono ao site com o motivo, mesmo quando o Tiny não responde ou o banco não grava (antes, uma falha ali mostrava uma página de erro crua).
- `_docs/Fabrica n8n/domoby-fila-tiny-completo.json` (o fluxo da fila melhorado — a parte 1 nova, a parte 2 de hoje intacta; o webhook dos avisos no MESMO caminho que o Tiny já chama para os pedidos enviados — o endereço morto da P5) e `domoby-alerta-erro-automacoes.json` (P1). `supabase/manutencao/2026-10-17_n8n_fila_tiny_completo.mjs`: sem argumento mostra a diferença; `--aplicar` guarda cópia, troca só a parte 1, publica e confere a versão publicada (A-53); `--alerta` cria/publica o fluxo do alerta e liga o "fluxo de erro" nos fluxos da fila, da fábrica e das vendas; `--simular` roda sem rede (provou a parte 2 e o webhook idênticos).

### 17/10 ~00:55–01:08 UTC — as telas — tarefa 19

- **Auditoria → "Carga do Tiny"** (`src/auditoria/PainelCargaTiny.tsx`; aba nova em `src/paginas/Auditoria.tsx`; tipos e chamadas em `src/auditoria/api.ts`; rótulos da trilha em `src/auditoria/rotulos.ts`): a fila agora + "Atualizar" (uma leitura no toque — sem relógio na tela), Contar no Tiny / Começar a carga / Pausar / Retomar, "Bateu com o Tiny?" por conta e tipo com o mês a mês dentro, as somas das contas a pagar, a carga tipo por tipo, os últimos erros, a consulta de hora em hora (ligar/desligar) e a API nova de cada conta. A dica da Auditoria deixou de prometer os erros do n8n "numa próxima etapa" (eles chegam no sino e na Atividade, grupo das automações).
- **Configurações → Móveis, insumos e peças** (`src/paginas/ClassificacaoProdutos.tsx` + `src/logistica/componentes/EstruturaDoProduto.tsx` e `UnidadesForaDoPadrao.tsx` + `src/logistica/classificacao.ts`): botão "Estrutura" por produto (do que é feito, com quantidade e unidade; onde é usado) e a lista "Unidades fora do padrão" com páginas — as duas só no clique.
- **Configurações → API e integrações** (`src/paginas/AdminApi.tsx` + `src/admin/api.ts`): "Ligar a API nova da fábrica" (só o dono) e o aviso na volta do Tiny (ligada / o motivo em língua de gente).
- **Provas:** tipos ✔ · estilo nos arquivos tocados ✔ · testes de tela **36 arquivos, 199 + os novos** ✔ (Auditoria com a aba da carga; Configurações com estrutura e unidades no clique; Integrações com o botão só do dono e a volta do Tiny) · montagem ✔ — JS inicial **219,6 KB comprimidos em 14 arquivos, igual à `main`** (teto 250); pedaços (comprimidos, `main` → agora): Auditoria 4,8 → 7,8 KB, Configurações de produtos 2,6 → 4,1 KB, Integrações 2,9 → 3,7 KB.

### 17/10 ~01:10 UTC — E-110: a formatação reescreveu a bateria inteira

- O `prettier --write` passou também pela bateria (que a casa não formata) e o commit saiu com ~18 mil linhas trocadas só de espaço. Reconstruída a partir da versão anterior com só as 9 linhas de verdade; 1.041 verdes de novo. Lição na memória (E-110): conferir `git diff --numstat` antes de todo commit.

### 17/10 ~01:15–01:40 UTC — a Lei de desempenho: ensaio com volume ×100 e as correções — tarefa 20

- **Volume de produção hoje** (só leitura, ~01:15 UTC): `tiny_fila` 26.731 (0 pendentes) · `pedidos` 5.578 · `pedido_itens` 8.379 · `clientes` 10.809 · `notas_fiscais` 2.913 · `contas_receber` 6.433 · `produtos` 553 (186 fabricados) · `eventos` 18.791 · `plt_logs_atividade` 11.231.
- **Ensaio** (`scratchpad/escala33/medir.mjs`, banco local PGlite — Postgres 17 em WebAssembly, mais lento que o servidor: os números são o teto): o banco inteiro com as 92 migrations, o volume ×100 de cada tabela, 1,5 milhão de registros guardados e **3 milhões de linhas da carga na fila** (≈ 30 mil × 100).
- **No volume de hoje, a 1ª versão já falhava em três pontos:** "Pausar"/"Retomar" mexiam em cada linha da carga (765 ms com 30 mil linhas → ~80 s com 3 milhões, acima do tempo da requisição); com a carga pausada, o lote e o "tem trabalho?" varriam todas as linhas pausadas (39 ms → segundos); o painel contava a fila e somava as contas a pagar a cada abertura (393 ms já hoje; acima do teto de 150 ms).
- **Correções (na 89/90, ainda não aplicadas):** índice de trabalho **por conta e vez** (`conta, prioridade, id`), o lote e o "tem trabalho?" conta a conta na ordem do índice; **"Pausar" = interruptor** (`plt_tiny_controle.carga_pausada` — a fila deixa de pegar a prioridade 9; nenhuma linha muda); o relógio não acorda pela carga pausada (e não se desliga com a fábrica na madrugada dela); **contas prontas da carga** mantidas pelos gatilhos da fila (`plt_tiny_carga_contagem`); **resumo do mês das contas a pagar** mantido por `fn_tiny_registrar` (`plt_tiny_registros_mes`); o **"quantos aqui" calculado quando a contagem chega** (`fn_tiny_aqui`), não a cada abertura; os números da fila **param em 10 mil**; os últimos erros e as páginas das contas a pagar com índice próprio; a carga ("Começar") enfileira as listas grandes **numa instrução só**; a chamada ao n8n deixou de contar a fila inteira. Bateria nova: as contas prontas = a fila contada linha a linha; o resumo do mês soma, não repete e troca de mês; o relógio se desliga com só a carga pausada.
- **Volume de hoje depois das correções:** pausar 3 ms · retomar 1 ms · lote 5 ms · "tem trabalho?" 0,4–1 ms · relógio 0,6 ms · venda gravada com a carga pausada 1,8 ms · painel 36 ms · começar a carga 50 ms · contar 16 ms · estrutura 2 ms · unidades 3 ms.
- **Resultado ×100** (01:40 UTC; banco de 2,9 GB, fila com 5,7 milhões de linhas, 3 milhões pendentes; o arquivo inteiro e o programa em `dados/SESSAO-33 - ensaio x100 da fila do Tiny (resultado|script, 2026-10-17)`): lote 4,2–5,2 ms · "tem trabalho?" 0,4–1,1 ms · relógio 0,6–0,7 ms · fila antiga 1,8 ms · **pausar 3,7 ms · retomar 1,1 ms** · lote com a carga pausada 1,5 ms · venda gravada com a carga pausada 1,9 ms · madrugada da fábrica 5,2 ms · resposta 1,5 ms (detalhe) / 15,8 ms (página de 100) · contar 12,9 ms · **painel 12,9 ms** · estrutura 0,6–1,4 ms. "Quantos aqui" (na fila, uma vez por janela da contagem — não é tela): 1,4–238 ms. **Fora do teto → dívidas na lei:** unidades fora do padrão 117–139 ms (catálogo ×100 — dívida 13, hoje 3 ms) e "Começar a carga" 4,5 s (gesto único de escrita, dentro dos 8 s — dívida 22, hoje 50 ms).
- **Planos ×100** (`EXPLAIN (ANALYZE, BUFFERS)`): "tem trabalho?" da loja com a carga pausada → `Index Scan using tiny_fila_trabalho_conta_idx` (`conta = 'loja' AND prioridade <= 8`), 3 páginas lidas, 0,13 ms · o lote da fábrica → o mesmo índice (`conta = 'fabrica' AND prioridade <= 9`), 4 páginas, 0,07 ms · as que esperam → `tiny_fila_espera_idx` (`nao_antes > now()`), 0,02 ms · os 10 últimos erros → `tiny_fila_erro_idx`, 0,02 ms · as páginas das contas a pagar da carga → `tiny_fila_cp_carga_idx` (2.301 páginas), 0,8 ms. Nenhuma varredura sequencial nas tabelas que crescem.
