---
id: D-284
aliases: [D-284]
titulo: "\"Configurar painel\" em Tempos de produção: uma configuração só, do admin, que vale para a tela e para a TV"
tipo: decisao
data: 2026-11-09
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-225 - Sem ranking nas abas internas ficam os Melhores tempos e|D-225]]", "[[D-232 - Tempo por setor mora dentro de Tempos de producao|D-232]]", "[[D-231 - O modo TV|D-231]]"]
area: [tempos-paineis, interface]
tags: [decisao, area/tempos-paineis, area/interface]
---
# D-284 · ✅ DECIDIDA pelo dono — "Configurar painel" em Tempos de produção: uma configuração só, do admin, que vale para a tela e para a TV (09/11/2026, SESSAO-47) — ↪️ complementa D-225…D-232; a D-231 (a TV só mostra letras) continua

**Pedido do dono (09/11):** *"Colocar um botão de configuração do painel dentro das abas da dash de tempo de produção, dentro dessa configuração deve ser possível editar o tipo de gráfico, ligar e desligar os montadores que aparecem na tela como montador a, b, c... podendo ver qual é qual, óbvio, e algumas outras configurações que você irá me recomendar."*

**Decidido (pedido e respostas 10 a 12):**
1. **A configuração é igual para todos:** o admin configura e ela vale para a tela e para a TV. Mudou, a TV e as telas abertas mudam **na hora**. Toda mudança fica na Auditoria.
2. **Os itens:** o tipo de gráfico (da aba Período e da TV); ligar e desligar montadores, vendo a letra, o nome e a foto de cada um (só nessa janela — a TV continua só com letras); a marca do tempo padrão; com que setor e período a tela abre; média ou mediana; o que a TV mostra.
3. **Montador desligado** sai da coluna dele, na tela e na TV, e entra em **"Outros"** — o tempo dele continua contando: os totais, as médias e o "Melhor da semana" do setor não mudam.
4. As letras e a equipe continuam sendo editadas onde já eram (Configurações → Controle de tempo → Equipe no painel).

**Como ficou (técnico):** migration `20261109040000`. `plt_tempo_config.painel jsonb` (uma linha; só o que difere do padrão) e `plt_tempo_equipe.no_painel boolean`; a configuração vem na MESMA resposta de cada porta (`painel`) — `plt_fn_tempos_dia/_periodo/_moveis/_modelo_passagens/_montadores/_conferir` e `plt_fn_modo_tv`, mesmas assinaturas; portas novas `plt_fn_tempos_abertura` (a tela abre em 1 requisição, já no setor e no período), `plt_fn_tempos_painel` (a janela, só admin, no clique) e `plt_fn_tempos_painel_salvar` (só admin; trilha `tempo_painel_alterado`; avisa pelo canal do setor que a tela e a TV já ouviam). "Outros" = a chave zerada no lugar da pessoa, resolvida no banco, igual em todas as portas. Telas: `src/paginas/dashboards/tempos/ConfigurarPainel.tsx`, `src/dashboards/tempos/painel.ts`, `GraficoMoveis.tsx` (um gráfico para a tela e a TV).
