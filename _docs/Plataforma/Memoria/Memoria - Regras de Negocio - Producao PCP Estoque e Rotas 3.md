---
titulo: "Memória de aprendizado — Regras de Negocio - Producao PCP Estoque e Rotas (parte 3 de 3)"
tipo: memoria-tema
tema: kanban-producao
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/kanban-producao]
---

# 🧠 Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 3

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🟢 Acertos que viraram padrão (A-NN)

### A-129

- [2026-10-31] **A-129** (Claude Code, SESSAO-42) · **Chave de projeção = o fato que a abriu.** O trecho tem como chave o fato que o abriu (iniciar/retomar/auxiliar) e a passagem, o fato da entrada no setor — o card pode ser apagado e refeito inteiro a cada fato (e no recálculo) sem que a decisão manual (que aponta a passagem) perca a referência.

### A-130

- [2026-10-31] **A-130** (Claude Code, SESSAO-42) · **A mesma regra como conta e como fato:** `fn_tempo_corte` dá o fim do expediente de um trecho; o cálculo usa para cortar o passado (sem gravar nada) e o despertador usa para pausar o presente (um fato com o instante do corte). Na subida, os cards já rodando ganham o corte a partir de AGORA — nenhuma pausa retroativa.

### A-133

- [2026-11-04] **A-133** (Claude Code, SESSAO-44 · F1) · **Acerto de pedido com trava de conferência no próprio script:** o bloco `do` relê o pedido (itens com código e unidades num texto só, ids das peças, produto da posição, card no PCP, situação do Tiny) e faz `raise exception` se algo divergir do raio-x — nada se grava se a equipe já mexeu; só depois vem o fato de trilha (origem `api`) e a conta (`fn_recalcular_liberacao`), conferida no fim. A janela do PCP se confere sem gravar, como o admin: `set_config('request.jwt.claims', {sub: plt_usuarios.**auth_user_id**})` + `set local role authenticated` + `rollback` — o `sub` é o id do login, não o id da pessoa na plataforma (com o id da pessoa a porta recusa "Liberar é gesto do PCP…").

### A-137

- [2026-11-04] **A-137** (Claude Code, SESSAO-45) · **Google Maps/Waze por COORDENADA mostram o endereço mais perto do ponto, não o do cliente.** O ponto da busca gratuita é o meio da rua (ou outra rua de mesmo nome): no 13784 o pino caiu na esquina do Hospital Onofre Lopes; pelo texto "Rua X, 173 - Bairro, Cidade - UF, CEP" o Google abriu a casa 173. Navegação vai pelo endereço escrito; o ponto só quando uma pessoa o conferiu.

### A-138

- [2026-11-04] **A-138** (Claude Code, SESSAO-45) · **Busca de endereço gratuita em Natal precisa de vários candidatos + bairro/CEP.** O Photon devolve a rua pelo NOME (Rua São João em 7 bairros); `limit=1` + "a cidade bate" deixou 29 de 151 pontos a mais de 1 km. O Photon traz `district`/`locality`/`postcode` por trecho — pontuar por bairro e CEP escolhe o certo; o mapa às vezes chama parte da cidade por outro nome ("Taborda" em São José de Mipibu) e a localidade ("Residencial Bosque das Colinas") prova o lugar. Do servidor da Supabase o Nominatim responde 403 (desde 03/10); da máquina do dono responde — serve para AUDITAR o cache.

### A-140

- [2026-11-04] **A-140** (Claude Code, SESSAO-45) · **"O PCP mentindo" era a palavra "estoque" com dois sentidos:** o chip do PCP contava as peças reservadas para o pedido (no galpão) e o cartão do Estoque mostrava "0 em estoque" (só as livres) — mais a conta do chip somando toda peça livre do SKU em todo pedido. Número de estoque em duas telas = a mesma palavra para a mesma peça ("livres" × "reservadas"), e chip de pedido limitado ao que o pedido ainda precisa.

### A-142

- [2026-11-05] **A-142** (Claude Code, SESSAO-45 · ajuste) · **"Não achei" vira degrau, e o degrau vira âncora:** quando a rua de mesmo nome aparece em vários bairros e nada desempata, o ponto do CEP (ou o centro do bairro) escolhe a que fica perto (1,5–2 km) — o ambíguo vira ponto de RUA; só sem rua perto fica o ponto aproximado. Navegação pelo endereço escrito + ponto aproximado marcado como aproximado = a rota nunca para por falta de ponto e ninguém confunde aproximado com exato.

### A-192

- [2026-11-06] **A-192** (Claude Code, ajuste do aviso de saída) · **Pergunta de integrador sobre "evento duplicado" se responde com o banco, não com teoria:** o sistema de estoque viu dois `movimentacao_etapa` em 4 s (um `automacao`, um `interface`) e achou que era um arrasto só. Receita: (1) `plt_webhook_entregas` do webhook → par no mesmo card; (2) todos os `plt_eventos` do card na janela; (3) `plt_logs_atividade` da pessoa na janela — mostrou DOIS gestos (A MONTAR→MONTANDO, que a plataforma registra como iniciar + movimento automático, e 4 s depois MONTANDO→A MONTAR). Fato geral conferido: em `movimentacao_etapa`, todo `automacao` (532/532 em 30 dias) é fila→primeira coluna de trabalho no instante do iniciar, com `execucao_iniciada` no mesmo milissegundo. E quem quer TODA entrada/saída de uma coluna precisa assinar também `movimentacao_setor` (PCP→MONTAGEM cai direto em MONTANDO; MONTANDO→LIMPEZA sai por lá) — registrado em [[PLT - API Aberta]]. Acréscimo no aviso de saída (chave nova, nada renomeado) não quebra os outros assinantes; montar do card com `coalesce(c.produto_tiny_id, fn_produto_do_item(...))` (0 divergência no banco vivo).

### A-196

- [2026-11-06] **A-196** (Claude Code, números que batem) · **Número de painel que não bate com a tela: listar os ITENS dos dois lados e subtrair — a sobra nomeia a causa.** 16 − 12 = os 4 já programados; 7 − 6 = o 13649 cancelado com stand-by aberto; 84 − 38 = as colunas CANCELADO e NÃO ENCONTRADO; 6 − 3 = os que estão na grade. Leitura só no banco vivo (como o dono, `set_config('request.jwt.claims', {sub: auth_user_id})` num CTE `materialized` antes da porta). E antes de editar: md5 do corpo vivo (`md5(prosrc)`) contra o último `create` de cada função nas migrations (script de extração no diário do ajuste) — as 6 bateram.

### A-204

- [2026-11-09] **A-204** (Claude Code, SESSAO-47 · frente da entrega) · **Fato que pode nascer no PASSADO: tudo o que era "quando foi feito" passa a ler o instante do REGISTRO (`registrado_em`), não o do fato (`ocorrido_em`).** Vale para o "desfazer do dia", para o toque repetido (10 min) e para a janela que acha "as peças que saíram com a entrega" (ancorava no `ocorrido_em` — com a entrega "de ontem" não acharia nenhuma). E a data que as telas mostram vira UMA projeção no card (`entrega_em`), mantida só pelo gatilho dos fatos, com o filtro por dia nos limites do dia direto na coluna (a função do dia só converte o que a tela mostra — senão esconde o índice).

### A-206

- [2026-11-09] **A-206** (Claude Code, SESSAO-47 · frente da entrega) · **Vários arquivos de uma vez: cada um sobe e é registrado SOZINHO, um depois do outro, com caminho estável por arquivo** — tentar de novo não deixa cópia solta, e se o arquivo já tinha subido e só o registro falhou, o armário responde "já existe" (de três jeitos: `status` 409, `statusCode` '409' / `ResourceAlreadyExists`, ou a frase) e segue-se direto para o registro. A janela do envio mora na TELA, não no card (o card some da lista quando o pedido é entregue e os arquivos continuam subindo). O estado de cada linha nunca só pela cor.

### A-219

- [2026-11-11] **A-219** (Claude Code, SESSAO-48 · frente 5) · **O laço da troca de setor do tablet (modelo):** `setSession` avisa `SIGNED_IN` nesta aba E, pelo canal entre abas do navegador, em toda outra aba da plataforma no aparelho; cada aba que vê conta nova grava uma "abertura" → 2 por troca (antes e depois da recarga) + 1 por aba extra (o atalho da tela inicial abre aba NOVA a cada toque — sem manifesto de aplicativo). Correção: a troca prepara a recarga antes do PIN, o provedor não reage à sessão nova com a recarga em curso, e a página recarrega uma vez só, já no setor de destino.

### A-221

- [2026-11-11] **A-221** (Claude Code, SESSAO-48 · as recargas de 10/11) · **Ler recarga pelos registros, sem adivinhar:** `plt_medicoes_web` tem UMA linha por página carregada (`carga_id` nasce no carregamento), gravada só quando a página **se esconde ou é descarregada** e só se pintou; `interacoes` = toques recebidos; `versao` = a publicação que ela carregou. Junto da trilha (`plt_logs_atividade`: `tablet_entrou` = PIN aceito; `navegacao` = abertura) e das renovações de acesso (`auth.refresh_tokens.created_at`): **página com 0 toques que some logo depois de uma troca = aba de fundo pegando a conta nova**; abertura sem PIN, colada numa renovação depois de horas parada = o navegador recarregando a aba descartada; mesma `versao` em todas = não é página velha de outra publicação. Os registros do servidor (edge logs) duram ~1 dia — ler logo. A partir de 11/11 a própria abertura diz o porquê (tipo de carga, aba descartada, o motivo da plataforma).

### A-226

- [2026-11-12] **A-226** (Claude Code, SESSAO-50 · bloco B) · **Uma regra só para "o pedido está fora do PCP":** `fn_fora_do_pcp` ganhou os dois motivos novos (excluído no Tiny, cancelado pela plataforma) como argumentos calculados UMA vez pelo chamador (o conjunto dos excluídos, a coluna do card) — os 12 leitores trocados de uma vez, a versão de 3 argumentos apagada no fim (conferido no banco vivo que ninguém mais a chamava). Os totais (quadro, porta antiga, quadrinho do dia) continuam iguais entre si.

### A-236

- [2026-11-17] **A-236** (Claude Code, SESSAO-51) · **O toque repetido vem ANTES da permissão quando o próprio gesto tira a pessoa do alcance.** Na entrega parcial com "Deixar em produção" a parada sai da rota do dia — e o entregador deixa de ser da equipe dela: o 2º toque dele (a rede que volta) era recusado pela permissão em vez de devolver "já registrado". Conferir "é o mesmo toque da mesma pessoa, há menos de 10 min, com as mesmas peças?" antes da permissão não abre porta nenhuma (só devolve o que já foi feito).

### A-237

- [2026-11-17] **A-237** (Claude Code, SESSAO-51) · **Fechar o tempo aberto MOVE a peça para a fila da etapa** (`fn_fechar_tempo_aberto` grava um movimento para a 1ª fila do setor). Quem precisa lembrar "onde a peça estava" (a entrega parcial que tira da produção, o "Mover para o PCP") grava setor e etapa no fato ANTES de fechar o tempo — e a volta usa o fato, não a coluna atual do card.

### A-238

- [2026-11-17] **A-238** (Claude Code, SESSAO-51) · **A vaga do PCP conta as peças ARQUIVADAS do pedido** (`fn_vagas_pedido` não olha `arquivado_em`): peça que sai da produção arquivada mas mantém o pedido continua cobrindo a vaga (bom para quem vai voltar — o revogar); para a vaga reabrir no PCP, a peça perde o pedido (`unidade_desvinculada`). Antes de arquivar uma peça de pedido, decidir qual dos dois se quer.

### A-239

- [2026-11-17] **A-239** (Claude Code, SESSAO-51) · **Dezenas de portas leem "o pedido está vivo?" pela entrega vigente do card** (`entrega_evento_id is null` em ~40 funções e visões). Para um fato de entrega que NÃO deve fechar o pedido (a parcial com "Deixar em produção"), o caminho limpo é a projeção não o tornar vigente (sair cedo no gatilho) e guardar a parcial em colunas próprias — nenhuma porta muda. E o quadro do PCP NÃO lê a entrega: quem tira o pedido de lá é o arquivamento do card (entrega completa) ou a marca de remoção do PCP (`removido_pcp_em`, com motivo).
