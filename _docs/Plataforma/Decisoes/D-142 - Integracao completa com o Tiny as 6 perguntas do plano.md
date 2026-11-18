---
id: D-142
aliases: [D-142]
titulo: "Integração completa com o Tiny: as 6 perguntas do plano respondidas"
tipo: decisao
data: 2026-10-16
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-077 - A plataforma manda no Tiny entrada baixa e contagem daqui|D-77]]", "[[D-138 - SESSAO-32 o OK dos indices e os insumos separados dos moveis|D-138]]"]
area: [tiny-n8n]
tags: [decisao, area/tiny-n8n]
---
# D-142 · Integração completa com o Tiny: as 6 perguntas do plano respondidas (16/10/2026) — ↪️ [[003 - PLANO - Integracao Completa Tiny da Fabrica]], D-77, D-138

**Respostas do dono (16/10)** às perguntas do §5 do plano 003, para o plano da Etapa B da [[SESSAO-33 - Tiny Completo - Todos os Dados Atualizados por Evento]]:

1. **API nova (v3) na conta da fábrica** → **liberada**: pode criar o aplicativo na conta da fábrica, **com o renovador próprio** — um renovador por credencial, sempre ([[Memoria - Tiny n8n e Integracoes 1#E-7|E-07]], [[Memoria - Tiny n8n e Integracoes 1#A-18|A-18]]). O renovador da conta da loja continua o único dela.
2. **Quem dá baixa de peça e insumo** → **do mesmo jeito que funciona para os móveis montados** ([[D-077 - A plataforma manda no Tiny entrada baixa e contagem daqui|D-77]]): a plataforma registra entrada, baixa e contagem e deixa o Tiny igual.
3. **As estruturas dos móveis no Tiny** → **não estão completas**. As que já existem no Tiny ficam **ligadas na plataforma** (móvel → peças → insumos). Em **Configurações** nasce um liga/desliga com o texto **"Reduzir os insumos de acordo com a conclusão dos setores de produção?"** — ligado: quando um setor conclui a sua etapa, a plataforma baixa os insumos daquela etapa pela estrutura; desligado: nada acontece. **Nasce desligado.** Ao desenhar, o Claude traz ao dono **como amarrar cada insumo à etapa/setor que o consome** (a estrutura do Tiny na API nova tem etapas — conferir na pesquisa).
4. **Plano de corte** → o dono não sabe o nome do plugin do SketchUp; **a CNC lê um JSON do plano de corte e executa**. Fica para a parte de corte (não na SESSAO-33); o que a pesquisa achar de útil vai anotado.
5. **Peça cortada entra no estoque** → **sim, como matéria-prima / peça / insumo** (não como móvel) — usa as contas separadas de móvel × insumo × peça que já existem ([[D-138 - SESSAO-32 o OK dos indices e os insumos separados dos moveis|D-138]]).
6. **Insumos com unidade fora do padrão** → uma **lista em Configurações** com os insumos de unidade fora do padrão (e os sem unidade), para a equipe padronizar depois no Tiny. **A plataforma não converte por conta própria.**

**Escopo da SESSAO-33 para estas respostas:** a ligação das estruturas que já existem (é dado do Tiny — entra na carga completa) e a lista das unidades em Configurações. O liga/desliga de reduzir insumos e a baixa por etapa entram **se o dono aprovar no plano da Etapa B**; se não couberem, ficam escritos como a próxima sessão.
