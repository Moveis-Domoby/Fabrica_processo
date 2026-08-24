# Instruções permanentes — Cofre da Fábrica Domoby

Este diretório (`_docs/`) é um cofre Obsidian: a **memória de longo prazo dos processos fabris da Móveis Domoby**. Toda conversa nova começa do zero — este arquivo existe para que ela já comece sabendo disso.

**Escopo deste cofre: só a fábrica.** Automações (n8n), processos entre setores, e as plataformas a construir (estoque, rotas, cargas, tempos, custo). O painel de recompra é da **loja** e mora no cofre da loja — o material antigo dele está em `_MOVER PARA COFRE DA LOJA/` aguardando transferência; não criar conteúdo novo ali.

## Regras para qualquer agente (IA) trabalhando aqui

1. **Comece por [[000 - MAPA DO PROJETO]].** Ideias e roadmap de plataformas: [[001 - HANDOFF - Pesquisa e Ideias de Plataformas]].
2. **Antes de mexer em qualquer área, leia a nota correspondente.** Workflows → `N8N -`. Processos/setores → `FAB -`.
3. **Depois de mexer, atualizar a nota faz parte da tarefa.** Problema novo vai para [[N8N - Pendencias e Riscos]] com ID; resolvido é marcado `✅ resolvido em AAAA-MM-DD` sem apagar.
4. **Ao fim de cada sessão**, criar um handoff em `Handoffs/` a partir de [[TEMPLATE - Handoff de Sessao]] e linká-lo no mapa.
5. **Não inventar fatos sobre o processo físico da fábrica.** O que não estiver registrado como certo, marcar como incerto ou perguntar. Os setores conhecidos: SECC (corte), CNC, FURAÇÃO, FITAMENTO, METALURGICA, MONTAGEM, LIMPEZA E EMBALAGEM, ESTOQUE, logística própria — o detalhe interno de cada um **ainda não foi mapeado**.

## Regras críticas que já custaram caro (não repetir)

- **Nunca renomear** os nodes `Normalizar evento` e `Tiny · pedido.obter` do workflow principal do n8n, nem os **cabeçalhos da aba COMPLETO** da planilha.
- **Nunca colar token/credencial em chat, print ou nota.** Um token do Tiny já vazou assim.
- **Só o cron do Supabase (projeto da loja) renova o token da API v3 do Tiny** — qualquer outro renovador derruba as duas integrações ([[N8N - API Tiny v2 vs v3]]).
- OAuth de usuário em fluxo servidor-a-servidor expira e derruba produção — usar Service Account ([[N8N - Incidente Credencial Google]]).
- No n8n, destinos de um mesmo evento ficam em **ramos paralelos**, nunca em série.
- Gatilho de automação **nunca** em aba de fórmula posicional (DADOS/OPERADORA/PCP) — foi a causa da duplicação de cards.

## Onde as coisas rodam

- **n8n:** `https://n8n.srv1877515.hstgr.cloud` (VPS Hostinger, container `n8n-n8n-1`) — [[N8N - Infraestrutura VPS]]
- **Planilha de integração:** *Integração Domoby - Tinny* (aba COMPLETO é a única escrita por automação)
- **Produção:** Trello (quadros `0-ESTOQUE` … `6-METALURGICA`, em desativação futura) e ClickUp (Team DOMOBY → DPTO PRODUÇÃO) — [[FAB - Estrutura de Producao (Trello e ClickUp)]]
- **Logística:** ClickUp → DPTO LOGÍSTICA → ROTAS
- **ERP:** Tiny (Olist), API v2 por token — [[N8N - API Tiny v2 vs v3]]
