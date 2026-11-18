---
id: D-23
aliases: [D-23, D-023]
titulo: "Replanejamento da jornada a partir da 5ª posição"
tipo: decisao
data: 2026-08-27
status: revisada
revisa: ["[[D-011 - API antecipada entrada de pedidos via n8n logo apos o kanban|D-11]]"]
revisada_por: ["[[D-030 - Publicacao adiada nenhum deploy no bloco noturno|D-30]]"]
complementa: []
area: [processo]
tags: [decisao, area/processo]
---
# D-23 · Replanejamento da jornada a partir da 5ª posição (27/08/2026) — ↩️ revisa a D-11

**Contexto:** na entrega da SESSAO-04 o dono pediu o replanejamento (palavras dele): *"não faz sentido a 13 ter que vir antes das outras, ajuste isso... refaça o planejamento ordenado das sessões para o plano mais lógico possível a partir da 5, concatene ou crie mais se necessário"*.

**Decidido:**

- **↩️ A antecipação da SESSAO-09 ([[D-011 - API antecipada entrada de pedidos via n8n logo apos o kanban|D-11]]) cai.** A entrada automática de pedidos deixa de vir logo após o kanban: enquanto a plataforma não está no ar, a criação manual de card no PCP atende. A SESSAO-09 continua existindo como está escrita — muda só a posição.
- **Nasce a SESSAO-08 — Publicação no Ar**, a lacuna real do plano: nenhuma sessão cobria hospedar a plataforma, e sem isso nada chega ao tablet do galpão. Entra logo depois da tela do setor (07), respondendo Q-62 (hospedagem) e enfrentando Q-60 (internet do galpão) na prática.
- **Nova ordem oficial a partir da 5ª posição** (a lógica: primeiro o núcleo de medição completo, depois ir ao ar, depois os pedidos fluírem sozinhos, depois medir sobre dados reais, depois integrar/automatizar/consolidar):

1. **SESSAO-05** (timers — a razão de existir; destrava 06, 07, 10 e 11)
2. **SESSAO-06** (qualidade nas transições — pluga na movimentação já entregue; assim a tela do tablet já nasce com a qualidade embutida)
3. **SESSAO-07** (tela do setor tablet — o gesto do chão de fábrica)
4. **SESSAO-08** (publicação no ar — a partir daqui a plataforma tem gente usando: **encerra a permissão da [[D-019 - Banco o projeto da org Tech e o de producao e por ora e onde|D-19]]** e a regra crítica 2 volta na íntegra)
5. **SESSAO-09** (entrada via n8n — no ar, criar card na mão para ~10 pedidos/dia vira fardo; pedido passa a fluir sozinho)
6. **SESSAO-10** (dashboards — sobre dados REAIS acumulados pelo uso)
7. **SESSAO-11** (API completa + ponte ROTAS)
8. **SESSAO-12** (tarefas e delegação)
9. **SESSAO-13** (automações internas)
10. **SESSAO-14** (painel admin completo)

- **Blocos:** Bloco 2 = 05 → 06 → 07 → 08 → 09 (termina com a plataforma no ar e pedido fluindo sozinho). Bloco 3 = 10 → 11 → 12 → 13 → 14.
- **Nada foi concatenado:** a divisão entrada × API completa da D-11 (hoje sessões 09 e 11) continua valendo (evita sessão gigante — regra 13); o que mudou é que as duas agora vivem cada uma no seu bloco.

**Descartadas:** pular direto para as sessões finais ignorando timers e entrada (quebraria as dependências — quase tudo precisa dos timers); concatenar a entrada dentro da API completa (sessão grande demais).

**↪️ Complemento (mesma data) — renumeração: número passa a ser ordem.** Nas palavras do dono: *"não existe 05→06→07→14→13... pelo menos muda o nome pra deixar na ordem numérica certa"*. As demandas a partir da 5ª posição foram **renumeradas para os números espelharem a ordem de execução** (isto revisa o modelo mental [[Memoria - Modelos Formulas e Possibilidades#M-9|M-09]]). De-para, para ler notas antigas: Dashboards 08→**10** · Tarefas 09→**12** · API completa 10→**11** · Automações 11→**13** · Admin 12→**14** · Entrada n8n 13→**09** · Publicação 14→**08**. Arquivos renomeados e todas as referências do cofre e do repositório atualizadas na mesma data; a lista numerada acima já usa os números novos.
