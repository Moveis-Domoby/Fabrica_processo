# Instruções permanentes — Cofre Domoby (Fábrica + Comercial)

Este diretório (`_docs/`) é um cofre Obsidian: a **memória de longo prazo da Móveis Domoby**. Toda conversa nova começa do zero — este arquivo existe para que ela já comece sabendo disso.

**Escopo deste cofre: a empresa inteira.** A fábrica (automações n8n, processos entre setores, a Plataforma de Produção) **e o comercial** — desde 15–16/09/2026 o Painel de Recompra da loja é o módulo Comercial da plataforma, e em 17/09/2026 o cofre da loja foi fundido neste. **Não existe mais cofre separado da loja**: o que restou em `Planilha de recompra/_Docs` é material morto do repo antigo, que morre no cutover (SESSAO-21). Não criar conteúdo novo lá.

## Regras para qualquer agente (IA) trabalhando aqui

1. **Comece por [[000 - MAPA DO PROJETO]].** Próximos passos e roadmap: [[000 - PROXIMOS PASSOS]] (pasta `Planejamento/`).
2. **Antes de mexer em qualquer área, leia a nota correspondente.** Workflows → `N8N -`. Processos/setores → `FAB -`. Plataforma → `PLT -`. Módulo Comercial → `PLT - Comercial -`. Banco → `SUPA -` (SEMPRE [[SUPA - Esquema do Banco]] antes de qualquer SQL). Atendimento humano → `ATD -`.
3. **Depois de mexer, atualizar a nota faz parte da tarefa.** Problema novo vai para [[N8N - Pendencias e Riscos]] (automações) ou [[PLT - Comercial - Debito Tecnico]] (comercial) com ID; resolvido é marcado `✅ resolvido em AAAA-MM-DD` sem apagar. Passo dado ou plano mudado → [[000 - PROXIMOS PASSOS]] atualizado.
4. **Ao fim de cada sessão**: memória técnica em `Plataforma/Execucao/SESSAO-NN.md` (não existe mais `docs/` no repo — foi unificado aqui em 17/09/2026), handoff em `Handoffs/` a partir de [[TEMPLATE - Handoff de Sessao]], e link no mapa.
5. **Não inventar fatos sobre o processo físico da fábrica.** O que não estiver registrado como certo, marcar como incerto ou perguntar. Os setores conhecidos: SECC (corte), CNC, FURAÇÃO, FITAMENTO, METALURGICA, MONTAGEM, LIMPEZA E EMBALAGEM, ESTOQUE, logística própria — o detalhe interno de cada um **ainda não foi mapeado**.

## Regras críticas que já custaram caro (não repetir)

- **Nunca renomear** os nodes `Normalizar evento` e `Tiny · pedido.obter` do workflow principal do n8n, nem os **cabeçalhos da aba COMPLETO** da planilha.
- **Nunca colar token/credencial em chat, print ou nota.** Um token do Tiny já vazou assim (duas vezes).
- **Só o cron `tiny-auth-refresh-cron` do Supabase DA FÁBRICA renova o token da API v3 do Tiny** — desde o cutover de 22/09/2026 (SESSAO-21), quando o renovador mudou de casa UMA vez. Qualquer outro renovador derruba a integração ([[N8N - API Tiny v2 vs v3]]). **Nunca reativar os jobs do projeto antigo** (o refresh de lá morreu) e **toda função que renova ao receber 401 também é renovador** (A-18). Detalhe: [[SUPA - Comercial - Cron e Rotinas]].
- **Banco enxuto (regra do dono, 21/09/2026):** antes de criar uma tabela nova, verificar se uma existente pode ser **remodelada** para receber os mesmos dados. Só colunas que alguém vai filtrar ou mostrar; o resto do payload vai em `raw`. Nada de "encher linguiça".
- **O disparo de campanhas do módulo Comercial**: desde o cutover (22/09/2026) os crons de disparo rodam **só na fábrica**; a trava do front (`DISPARO_LIBERADO`) foi **aberta em 23/09/2026**, depois de o dono repontar o webhook do DataCrazy — voltar a `false` trava tudo numa emergência ([[PLT - Comercial - Maquina de Estados do Disparo]]). Crons de disparo **nunca** em dois projetos (disparo duplicado).
- OAuth de usuário em fluxo servidor-a-servidor expira e derruba produção — usar Service Account ([[N8N - Incidente Credencial Google]]).
- No n8n, destinos de um mesmo evento ficam em **ramos paralelos**, nunca em série.
- Gatilho de automação **nunca** em aba de fórmula posicional (DADOS/OPERADORA/PCP) — foi a causa da duplicação de cards.

## Onde as coisas rodam

- **n8n:** `https://n8n.srv1877515.hstgr.cloud` (VPS Hostinger, container `n8n-n8n-1`) — [[N8N - Infraestrutura VPS]]
- **Supabase da fábrica:** o banco único da empresa (integração Tiny + plataforma `plt_*` + domínio comercial) — [[SUPA - Visao Geral]] e [[SUPA - Esquema do Banco]]
- **Supabase antigo da loja** ("Painel de recompra", `kfkcumjepnxnnzyvmxfo`): **em quarentena desde 22/09/2026** — nenhum cron ativo, dados congelados, painel antigo no ar só como espelho; será pausado e excluído na data que o dono definir, depois do backup final ([[PLT - Comercial - Legado e Cutover]])
- **Planilha de integração:** *Integração Domoby - Tinny* (aba COMPLETO é a única escrita por automação)
- **Produção:** a Plataforma de Produção (kanban, timers, qualidade); Trello/ClickUp em desativação — [[FAB - Estrutura de Producao (Trello e ClickUp)]]
- **Logística:** módulo Logística/ROTAS da plataforma (desde a SESSAO-15)
- **Comercial/pós-venda:** módulo Comercial da plataforma (`/comercial/*`) + CRM DataCrazy — [[PLT - Comercial - Integracao DataCrazy]]
- **ERP:** Tiny (Olist), API v2 por token no n8n; API v3 OAuth no comercial — [[N8N - API Tiny v2 vs v3]]
