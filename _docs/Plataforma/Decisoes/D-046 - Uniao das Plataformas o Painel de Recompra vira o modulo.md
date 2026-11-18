---
id: D-46
aliases: [D-46, D-046]
titulo: "União das Plataformas: o Painel de Recompra vira o módulo Comercial"
tipo: decisao
data: 2026-09-15
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [comercial]
tags: [decisao, area/comercial]
---
# D-46 · União das Plataformas: o Painel de Recompra vira o módulo Comercial (15/09/2026)

**Decidido (conversa de planejamento no Cowork, 15/09):** as duas plataformas viram uma. O plano completo vive em [[PLT - Plano Uniao das Plataformas]]; execução nas SESSÕES 19–21.

**↩️ Revisada em 15/09 (mesma conversa, depois de conferir o escopo da SESSAO-16):** a ordem de execução passa a ser **16 → 19 (em paralelo, se o dono quiser) → 20 → 21**. A versão anterior desta decisão mandava as 19–21 rodarem antes das 16–18; caiu porque a SESSAO-16 e a SESSAO-20 disputam os mesmos arquivos de casca (`App.tsx`, `Layout.tsx`, `estilos/tokens.css`) e porque é a 16 quem fixa a biblioteca de gráfico (Recharts) que o módulo Comercial herda. A SESSAO-19 é imune: não encosta no front, e as tabelas/RPCs que ela cria (`fn_dashboard_*`) não colidem com as da fábrica (`plt_fn_dash_*`). Os números 19–21 seguem fora da regra "número = ordem" ([[D-023 - Replanejamento da jornada a partir da 5 posicao|D-23]]) só para não renumerar demandas já escritas.

**A SESSAO-16 não muda por causa da união** (decisão do dono, 15/09): os dashboards da produção continuam como quatro telas-filhas do pai **Dashboards**, com os nomes atuais. O dashboard do Comercial nasce dentro do próprio módulo, em `/comercial/dashboard`; se um dia os filhos do pai Dashboards forem renomeados por domínio ("Dash Produção", "Dash Comercial", …), isso é assunto de outra sessão → **Q-66**.

- **Banco mantido: o da fábrica** (`axnzldwgwsmepukdiljx`). O projeto do recompra (`kfkcumjepnxnnzyvmxfo`) entra em quarentena após o cutover e é **excluído** ao final dela.
- **O painel de recompra NÃO é desligado** — é recriado **idêntico** dentro da plataforma como o módulo **Comercial** (dashboards, filtros, listas de disparo, renovador do token do Tiny, tudo). Nenhum dado alterado, nenhum comportamento perdido. O antigo só sai do ar depois da validação do dono e da quarentena.
- **Navegação:** "Administração" passa a se chamar **"Painel admin"**; Controle de Produção, Logística e ROTAS viram filhos do novo pai **"Fábrica"**; o Comercial é outro pai. Acesso a Fábrica e Comercial é **permissão ativável por usuário** (coluna `plt_usuarios.modulos`; todos começam com `fabrica`; `comercial` começa **só no admin** e vai sendo liberado com o tempo).
- **Paleta:** o módulo Comercial respeita a arquitetura do design system da casa, e o design system **ganha a paleta verde-esmeralda do recompra** como temas novos.
- **Congelamento:** nenhum disparo de WhatsApp em nenhum dos dois painéis até a união concluir. Crons de disparo e o renovador do token rodam em **exatamente um** projeto por vez (o refresh do Tiny rotaciona o token — dois renovadores se matam).

**Descartadas:** migrar a fábrica para o banco do recompra (30 tabelas + auth + RLS vs 8 tabelas); manter dois bancos permanentemente (dois pontos de falha, dois syncs do Tiny gastando o mesmo rate limit); desligar o painel antigo direto no cutover (sem rede de segurança).
