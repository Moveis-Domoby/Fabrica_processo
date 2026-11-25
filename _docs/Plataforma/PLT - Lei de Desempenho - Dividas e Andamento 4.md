---
titulo: "Lei de Desempenho — as dívidas registradas e o andamento (parte 4 de 4)"
tipo: lei-dividas
atualizado: 2026-11-25
tags: [plataforma, desempenho, dividas]
---

# ⚡ PLT - Lei de Desempenho - Dividas e Andamento 4

> O §14 de [[PLT - Lei de Desempenho e Escala]]: a tabela das dívidas e o andamento de cada sessão, em ordem de data. **Dívida nova e andamento novo entram no fim da última parte.** Partes: [[PLT - Lei de Desempenho - Dividas e Andamento 1]] · [[PLT - Lei de Desempenho - Dividas e Andamento 2]] · [[PLT - Lei de Desempenho - Dividas e Andamento 3]] · [[PLT - Lei de Desempenho - Dividas e Andamento 4]].
> Esta parte nasceu em 24/11/2026, na subida que juntou as sessões 52 a 56 (a parte 3 ia passar do teto).

**Andamento (SESSAO-52 · datas e textos certos na busca, na devolução, na lista de pedidos e na Auditoria, 18/11 — [[D-340 - A lista de pedidos ganha uma porta nova no banco com a hora do|D-340]]…[[D-345 - A Auditoria traduz a configuracao do painel de tempos na hora|D-345]]; no ramo, junto na subida de 24/11 ↪️ 25/11: ✅ no ar, banco e site, pela subida de 25/11):**
- **Requisições:** a lista de pedidos segue com uma chamada (a porta nova substitui a antiga na tela); busca e devolução, nenhuma a mais.
- **Ensaio ×100** (562.700 pedidos; 15.167 entregues, 3.033 com o dia escolhido ou corrigido): a busca 16–38 ms e a devolução 15 ms (dentro do teto; a diferença para antes é ruído); a página nova da lista = a lista de sempre + 1 a 16 ms. A junção com a função que devolve tabela virava varredura — trocada por subconsulta na chave (lição [[Memoria - Banco e SQL 2#E-295|E-295]]).
- **Pacote:** JS inicial 233,0 KB (teto 250). **Celular e tablet:** as 4 telas sem rolagem lateral.
- **Dívida nova:** a 38 (abaixo).

**Andamento (SESSAO-53 · "Entregue em parte" na Programação, na Expedição e nas Entregas do dia, 18/11 — [[D-346 - Depois que o resto e entregue o selo Entregue em parte some|D-346]]…[[D-350 - ROTAS Entregas fica como estava sem o selo novo|D-350]]; no ramo, junto na subida de 24/11 ↪️ 25/11: ✅ no ar, banco e site, pela subida de 25/11):**
- **1 requisição por tela:** nenhuma porta nova; o dado novo entra na resposta que já existia, e só o pedido entregue em parte paga a conta (10 blocos, 0,8 ms por pedido na versão final).
- **Ensaio ×100** (máquina carregada; vale a comparação e a contagem de blocos): Já programadas com 50 linhas com o selo 63.037 → 64.111 blocos (+1,7%); Entregas do dia 130 → 154 ms; Programar e Expedição sem diferença fora do ruído.
- ✅ **Pago (de produto):** o item 1 de [[D-328 - Onde o pedido mostra Entregue em parte N de M e a parada|D-328]] (fica de fora o Calendário).
- **Dívidas:** nenhuma nova. As portas da aba Programar e da Expedição seguem lentas no ×100 como já estavam (dívidas 25 e 30).

**Andamento (SESSAO-54 · Comercial: janelas da plataforma e a ordem da tabela de clientes no banco, 18/11 — [[D-351 - A janela de confirmacao do Comercial pergunta no titulo e|D-351]]…[[D-357 - A ordem da tabela de clientes viaja dentro dos filtros|D-357]]; no ramo, junto na subida de 24/11 ↪️ 25/11: ✅ no ar, banco e site, pela subida de 25/11):**
- **Requisições:** nenhuma a mais; trocar a ordem da tabela = 1 requisição (a página nova).
- ✅ **Pago (lei de requisição):** a tabela de clientes ordenava só a página que estava na tela — agora a ordem vai para o banco (vale depois de banco e site subirem).
- **Pacote:** JS inicial 233,0 KB; a lista de disparo 16,08 KB e o Painel de Recompra 16,61 KB.
- **Dívidas novas:** a 39 e a 40 (abaixo; as duas já existiam, foram medidas agora).

**Andamento (SESSAO-55 · telas que abrem com uma leitura, 18/11 — [[D-358 - A porta de abertura junta as leituras de sempre e nao as|D-358]]…[[D-367 - Ficam de fora de proposito indice novo paginacao dos cadastros|D-367]]; no ramo, junto na subida de 24/11 ↪️ 25/11: ✅ no ar, banco e site, pela subida de 25/11):**
- ✅ **Dívida 20 — paga:** a bolinha, o Meu Painel e os Meus afazeres leem a mesma resposta (uma porta).
- ↪️ **Dívida 18 — paga para:** Pessoas, Qualidade, Meu desempenho, Equipe, API e integrações, Caminhões, Automações; Tempo por setor (já estava); Controle de tempo (o "Desligar o tempo" foi de 3 para 1). **Segue aberta para:** a configuração do Estoque, Programação e Pedidos em aguardo, e o Comercial (~10 leituras, os gráficos).
- **1 requisição por tela** provada por teste de tela (14 provas); nenhum relógio buscando dado; RLS com `(select auth.uid())`; pacote 232,9 KB.
- **Ensaio ×100:** 11 de 16 portas dentro do teto; o que ficou fora são leituras antigas que a porta só junta — as dívidas 41 a 47 (abaixo).
- **Não medido:** os avisos da Supabase no banco vivo e o INP em aparelho.

**Andamento (SESSAO-56 · a busca de endereço pela Geoapify e a ordem da rota que não se mexe sozinha, 23–24/11 — [[D-368 - A busca de endereco pela Geoapify Photon de reserva Nominatim|D-368]]…[[D-389 - A chamada que so leu do guardado tambem avisa a busca fora|D-389]]; banco e função no ar em 24/11):**
- **1 requisição por tela:** abrir Rotas não ganhou leitura; o estado da busca viaja na resposta da própria busca e a faixa não consulta nada. Tirar, reprogramar e remover parada = uma chamada (a ordem vai junto); "Já programadas" deixou de ler a rota inteira antes de pôr parada (uma requisição a menos no clique).
- **Sem relógio:** a busca que falha para de insistir e tenta de novo só em gesto; o aviso no sino nasce da chamada da busca, uma vez por queda.
- **Chamada externa:** tempo limite (6 s) e disjuntor na função e na tela; a nova tentativa é do usuário.
- **Escrita idempotente:** a porta do aviso trava a linha e confere de novo (duas chamadas juntas não avisam duas vezes).
- **Dívidas:** nenhuma nova. **Não medido:** o plano no banco vivo e LCP/INP.

**Andamento (SESSAO-57 · o pino certo, e os ajustes de 24 e 25/11 — [[D-390 - A busca digitada so aceita rua ou casa o lugar vira nao achei|D-390]]…[[D-402 - O ponto do CEP e consultado pelo navegador|D-402]]):**
- **1 requisição por tela:** "N pedidos com o pino a conferir" é conta na tela, com o que "Já programadas" já traz; a aba Programar ganhou o ponto aproximado e o CEP **na porta que já tinha** (nenhuma leitura nova); o selo "Entregue em parte" entra na mesma porta (subida de 25/11).
- **Chamada externa:** a conferência do CEP roda só no clique de salvar, com tempo limite, e nunca bloqueia; o CEP pelo navegador tem tempo limite de 4 s, é lembrado uma vez por CEP na sessão e a falha não fica guardada.
- **Escolha consciente (provisória [[D-395 - A busca digitada nao usa mais a memoria de buscas|D-395]]):** "Achar no mapa" deixou de usar a memória de buscas — uma consulta ao buscador por toque (a memória antiga tinha o bairro gravado como rua). Gesto da pessoa, não relógio.
- **Dívidas:** nenhuma nova. **Não medido:** LCP/INP.

| # | Dívida | Estado |
|---|---|---|
| 38 | **A lista de pedidos com duas portas** (SESSAO-52): a porta nova (com a hora do registro) e a antiga, que segue para o site de antes. | Aberta, pequena. **Caminho:** quando o retorno da porta antiga for mudado de vez, a hora entra nela e a porta nova sai. |
| 39 | **A tabela de clientes do Comercial com 100× o volume passa do teto de 50 ms** (`fn_filter_customers`, medida na SESSAO-54): conta e ordena o resultado inteiro a cada página, pagina por deslocamento e não tem teto de página. | Aberta (já existia). **Caminho:** cursor por (última compra, chave do cliente) + total só quando a tela mostra + teto de 100. |
| 40 | **A lista de disparo abre com 4 leituras em cascata** (lista, números, membros, eventos) e relê 3 a cada aviso (SESSAO-54). | Aberta (já existia). **Caminho:** a porta de abertura da tela. |
| 41 | **As metas com muitas metas:** `plt_fn_metas_painel` calcula o progresso ao vivo — 292 ms com 300 metas (Pessoas e Meu Painel). | Aberta. **Caminho:** o progresso como projeção mantida no fato, ou a 1ª página de metas menor. |
| 42 | **O tempo em afazeres do Meu desempenho:** ~300 ms em 7 dias e ~1,3 s em 90 dias com o volume ×100. | Aberta. **Caminho:** resumo por pessoa × dia mantido no gesto (como o da produção). |
| 43 | **As últimas entregas dos webhooks sem índice por data:** 79 ms com 100 mil linhas (varredura inteira). | Aberta. **Caminho:** índice por (criada_em desc, id desc) — mudança de esquema, **pede o OK do dono** — e o plano de crescimento da tabela. |
| 44 | **Listas de cadastro sem página nas configurações:** Equipe 180 KB, Automações 187 KB, os horários do "Desligar o tempo" 759 KB com o volume ×100; caminhões, chaves e webhooks. Hoje são pequenas. | Aberta. **Caminho:** página no servidor por cursor; no "Desligar o tempo", só os horários de pessoa. |
| 45 | **Meus afazeres como 1ª tela do app = 2 requisições** (a abertura do app + a porta do trabalho; antes eram 4). | Aberta. **Caminho:** a abertura do app ganhar o retrato dos afazeres — é recriar a porta do login, fora do pedido. |
| 46 | **Os catálogos de etiquetas e de campos têm validade de 5 min:** com o app aberto há mais de 5 min, a entrada na tela relê os dois. | Aberta. **Caminho:** validade infinita + invalidação por sinal, como os setores. |
| 47 | **Motivos e Visão do dia** leem as visualizações salvas numa leitura à parte, uma vez por sessão. | Aberta, pequena. **Caminho:** a porta de cada tela resolver a visualização (como a SESSAO-55 fez nos painéis). |
| 48 | **O teste de tela "Tempos de produção · a abertura > endereço limpo: UMA chamada…"** falhou na main de 24/11 (segundo o pedido da subida) — não vem das sessões 52–56. Na rodada da subida, com a máquina livre, passou (825 de 825): o mais provável é tempo esgotado com a máquina dividida. | Aberta, a observar. **Caminho:** se voltar a falhar com a máquina livre, abrir sessão própria. |
