---
titulo: "Memória de aprendizado — Regras de Negocio - Producao PCP Estoque e Rotas (parte 1 de 3)"
tipo: memoria-tema
tema: kanban-producao
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/kanban-producao]
---

# 🧠 Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🔴 Erros e correções (E-NN)

### E-15

- [2026-08-27] **E-15** (Claude Code) · Primo do [[Memoria - Git Shell e Windows 1#E-9|E-09]]: escrever `\u0300` num arquivo via ferramenta de edição gravou o CARACTERE decodificado (o encaminhamento JSON desfaz o escape em silêncio) e a regex de tirar acento ficou com combining chars literais → **correção:** escape gravado via `node` com `String.fromCharCode(92)` e resultado conferido com grep. **Lição: sequência de escape que precisa chegar literal ao arquivo não passa por camada que interprete JSON/string — e toda substituição se confere depois.**

### E-16

- [2026-08-27] **E-16** (Claude Code) · Mover card para setor sem etapa quebrou com FK violada: um handler antigo resetava o select de etapa para `''` e **`Number('') === 0` em JS** — o evento saiu com `etapa_destino_id: 0` → **correção:** sentinela `'chegada'` em TODOS os pontos que resetam o select + `|| null` na camada de API (id 0/NaN nunca é id válido). Achado interceptando o `fetch` no navegador — o corpo real da requisição vale mais que reler o código. **Lição: conversão string→id numérico sempre com guarda contra vazio; e o teste de UI de verdade pega o que o tsc não pega.**

### E-22

- [2026-08-28] **E-22** (Claude Code) · Página com fetcher LOCAL usando a MESMA queryKey `['setores']` mas select menor (`id, nome`) envenenou o cache compartilhado do TanStack Query: a sidebar nova leu `codigo` undefined e gerou rotas `/producao/undefined` duplicadas — só ao visitar a página da Equipe → **correção:** um dado, um fetcher — a queryKey compartilhada usa SEMPRE a mesma função da API (`kanban/api.buscarSetores`); fetcher local para a mesma chave é proibido ([[Memoria - Modelos Formulas e Possibilidades#M-4|M-04]] no front). Achado no console do navegador durante a [[Memoria - Modelos Formulas e Possibilidades#F-7|F-07]].

### E-43

- [2026-09-26] **E-43** (Claude Code + dono) · "Já rodei a carga inicial" era a carga do **catálogo** (a varredura de produtos), não a do **saldo** — `produto.obter` nem traz saldo. Nada de saldo tinha chegado ao banco → **correção:** conferido nos logs da API (só `fn_upsert_produto` da varredura diária, nenhum aviso "carga") e escrito o workflow separado da carga do saldo. **Lição (primo do [[Memoria - Tiny n8n e Integracoes 1#A-20|A-20]]): "carga inicial" é ambíguo — conferir no banco/logs O QUE foi carregado antes de construir em cima.**

### E-47

- [2026-09-27] **E-47** (Claude Code) · Na prévia antes de aplicar a 37, disse ao dono que a aba Cancelados do PCP mostraria **13** pedidos (vivos + arquivados) — contei na consulta de leitura, mas não conferi a PORTA que a tela usa: `plt_fn_pedidos_cancelados` ignora card arquivado, e a aba mostra **8** → **correção:** conferido na tela ([[Memoria - Modelos Formulas e Possibilidades#F-7|F-07]]) e no código; o handoff diz o número certo e o porquê (os 5 da limpeza histórica do PCP seguem fora). **Lição: número prometido ao dono sai da mesma porta que a tela chama — nunca de uma consulta paralela que "deveria dar o mesmo".**

### E-95

- [2026-10-14] **E-95** (Claude Code, SESSAO-31, ajustes da noite) · Tela ao vivo com a leitura guardada "para sempre" (`staleTime: Infinity`) e o canal ouvido SÓ com a tela aberta: o que mudou enquanto a pessoa estava noutra tela nunca chegava — "lanço do PCP e só vejo no setor recarregando". O banco avisava certo (`plt-aviso:setor_N` no `realtime.messages`). → **Correção:** na 1ª assinatura, a leitura guardada de ANTES de a tela abrir é relida uma vez (`useQuadro`, `useAoVivo`). Toda tela ao vivo: assinar, depois conferir se o que está na tela é anterior à abertura.

### E-96

- [2026-10-14] **E-96** (Claude Code, SESSAO-31, ajustes da noite) · Aviso de "setor sem etapa de fila" desenhado com as etapas ainda vazias (carregando) — piscava vermelho em toda troca de setor (o dono filmou). → **Correção:** enquanto o dado não chegou, esqueleto e NENHUM aviso; aviso de "não configurado" só com o dado carregado.

### E-97

- [2026-10-14] **E-97** (Claude Code, SESSAO-31, ajustes da noite) · O "Concluir" do card avulso foi filtrado só no CLIQUE (`card.tipo === 'avulso' && …`) — o botão aparecia em toda peça e não fazia nada. → **Correção:** o filtro é no DESENHO (o quadro só passa o gesto para o avulso). Gesto que não vale não aparece.

### E-98

- [2026-10-14] **E-98** (Claude Code, SESSAO-31, ajustes da noite) · Publicar sem aviso de versão nova: quem estava com a plataforma aberta desde antes seguiu na versão velha — "não dá para cadastrar duas rotas no mesmo dia" (as 3 entregas de 14/10 foram programadas às 07:52, ~6 h depois da publicação da escolha de rota). → **Correção:** `versao.json` na montagem + `useVersaoNova` (confere no trocar de tela e ao voltar à aba) + recarregar na próxima troca de tela, com o aviso "Atualizar".

### E-102

- [2026-10-15] **E-102** (Claude Code, SESSAO-32) · O [[Memoria - Tiny n8n e Integracoes 1#E-36|E-36]]/E-46/E-87 de novo, no retrato de partida: `plt_webhook_entregas.criado_em` escrito de memória — a coluna é `criada_em` (feminino, "entrega"); a consulta de leitura quebrou (sem dano) → **correção:** nome tirado do `create table` da migration (grep) antes de reescrever. **Lição: a regra do E-36 vale também para a coluna de DATA — o gênero acompanha o nome da tabela (`criada_em` em entrega/notificação/mensagem, `criado_em` em card/pedido); grep do `create table` antes de qualquer consulta, mesmo de contagem.**

### E-67

- [2026-09-29] **E-67** (Claude Code, ajuste do Frete) · Reapresentei a Q-71(c) ao dono com a premissa de quando a escrevi (28/09): *"dar um código à fechadura com instalação, porque sem ele a venda não baixa o estoque"*. Mas a [[D-070 - O estoque dos acabados e a CONTAGEM da logistica entrada|D-70]] (ajustes do estoque, mesclada no mesmo dia, depois) já tinha tirado a reserva e o Tiny da conta dos acabados, e **nenhuma venda baixa o estoque, com ou sem SKU**. O dono respondeu em cima da premissa velha (*"Padronize pelo formato do nome"*) → **correção:** antes de agir, conferi no banco, só leitura, o que o SKU ainda faz. Só o Top 20 e a sugestão de mínimo dependem dele (`fn_vendas_90d` e `fn_estoque_por_produto` casam pelo SKU), e o cadastro da fechadura também não tem SKU. Corrigi com o dono na conversa e ele escolheu "deixar como está". **Lição: pergunta em aberto envelhece. Antes de reapresentar uma ao dono (ou de agir na resposta), reler as decisões registradas DEPOIS dela, sobretudo as das sessões paralelas, e confirmar que a premissa ainda vale.**

### E-89

- [2026-10-08] **E-89** (Claude Code, SESSAO-30) · O botão "Desfazer" da ROTAS nasceu para toda entrega "de hoje" — e as 287 entregas que a limpeza de 08/10 fechou (vindas do Tiny, assinadas "Sistema") apareceram todas desfazíveis na tela. Desfazer uma delas reabriria um pedido que foi mesmo entregue e mandaria o Tiny de volta a "Enviado". Pego no preview, antes de publicar → **correção:** a tela só oferece o desfazer para a entrega feita por gente na plataforma; o banco ganha a mesma trava na etapa 5. **Lição: regra de "só do dia" precisa olhar QUEM fez o fato, não só QUANDO — uma manutenção em massa feita hoje enche o "hoje" de fatos do Sistema. Conferir a tela nova com os dados reais do dia antes de publicar.**

### E-133

- [2026-10-21] **E-133** (Claude Code, SESSAO-38 · F4) · Para esconder o "não conta" do funcionário na dashboard de tempos, filtrei as linhas do estado especial (`estado <> 'especial'`) ANTES de montar os setores do cartão — o setor onde a pessoa só tinha tempo especial sumiu e levou junto os móveis dela (o cartão do funcionário ficava sem o card que ele trabalhou). Pego pela bateria (o cenário do próprio funcionário) → **correção:** as linhas ficam; só o NÚMERO especial sai zerado para quem não vê todos. **Lição: esconder um dado é zerar o valor, não apagar a linha — a linha pode ser o que segura outra parte da tela.**

### E-162

- [2026-10-27] **E-162** (Claude Code, SESSAO-41 · ajuste) · O teste novo esperava a pessoa FORA do setor depois do "Não" (aviso há 70 min) e ela voltou: a resposta foi dada pelo TABLET com o PIN dela, e no tablet qualquer gesto com o PIN põe a pessoa no setor ([[D-189 - O TABLET NAO CAI cada aparelho com a sua sessao quem sai|D-189]]) — o teste estava errado, não a regra → **correção:** o teste da saída responde pelo computador (admin); a volta pelo tablet ficou escrita na [[D-198 - O CARD ESQUECIDO na MONTAGEM 2 h rodando sem parar perguntam|D-198]]. **Lição: no tablet, todo gesto com PIN é "a pessoa está aqui" — teste de "saiu do setor" se faz por gesto do computador.**

### E-166

- [2026-10-28] **E-166** (Claude Code, ajuste 28/10) · A 1ª conta das peças de pedido cancelado em produção chamava `fn_pedido_cancelado` peça a peça — no ×100, as ~1.000 peças vivas do mesmo SKU custavam ~30 ms; a 2ª (juntar `pedidos` e filtrar o cancelado na linha juntada) foi PIOR: o planejador virou a junção e varreu os 11 mil cancelados pelo índice parcial `pedidos_cancelados_numero_idx` (~37 ms). → **correção:** o pedido de CADA peça por `cross join lateral (… where p.id = c.pedido_id and lower(p.situacao) like 'cancel%' and fn_situacao_normalizada(p.situacao) = 'cancelado' offset 0)` — o caminho fica o índice do SKU, a comparação barata vem antes e a régua de sempre confirma: 8 ms. **Lição: filtro por função numa tabela juntada pode virar o plano por um índice parcial dela — medir no ×100 e, se virar, travar o caminho com `lateral … offset 0`.**

### E-176

- [2026-11-04] **E-176** (Claude Code, SESSAO-44) · A “situação de antes” da entrega do Tiny buscava no registro dos avisos `recebido_em < hora da entrega` — numa transação só (a bateria) tudo tem o MESMO `now()` e a busca voltou vazia ("enviado" em vez de "preparando_envio"). → **correção:** `<=` e desempate por `id desc`. **Lição: comparação estrita entre horários de linhas gravadas pela mesma transação nunca casa — `now()` é da transação; ordenar por id desempata.**

### E-239

- [2026-11-09] **E-239** (Claude Code, SESSAO-47) · O caso novo da regra do pedido vivo entrou no `OU` citando a coluna do CARD (`pc.liberado_completo_em is null and exists (itens)`); com isso o filtro deixou de descer para a leitura de `pedidos` pela chave e o planejador trocou o laço por uma varredura dos 562 mil pedidos (0,74 → 3,1 s na contagem da visão; as portas que a usam não acusaram) → **correção:** o caso novo só pelo pedido (`exists (… vw_pedidos_adiantados_falta af where af.pedido_id = p.id)`) — voltou a 0,58 s. **Lição: caso novo em `OU` de visão que junta duas tabelas cita colunas de UMA só (a da chave por onde o plano entra); e o ensaio mede também a visão sozinha — a porta pode esconder a troca de plano.**

### E-240

- [2026-11-09] **E-240** (Claude Code, SESSAO-47) · A frase dos botões apagados mandava ligar "Entregue vai ao Tiny" **"nas Rotas"** — escrita de memória (a demanda diz "a chave da ROTAS"); a chave mora em Configurações → Caminhões (visto no site publicado, com o login do dono) → **correção:** a frase da tela e a recusa do banco dizem o lugar certo. **Lição: frase de interface que aponta um lugar da plataforma se confere no menu do código (`Layout.tsx`) antes de escrever.**

### E-241

- [2026-11-09] **E-241** (Claude Code, SESSAO-47 · frente da entrega) · A regra 20 de novo, agora numa frente paralela: `cd "<minha cópia>"; pwd` para conferir a pasta. Nada mudou (já era a cópia dela) → **correção:** daí em diante só caminho absoluto. **Lição: o brief de toda frente paralela abre com a regra 20 e com o comando certo de conferir a pasta (`git -C "<cópia>" rev-parse --show-toplevel`).**

### E-242

- [2026-11-09] **E-242** (Claude Code, SESSAO-47 · frente da entrega) · O formatador, rodado no arquivo inteiro, mexeu em três trechos antigos de `src/rotas/api.ts` que não eram da mudança → **correção:** desfeitos à mão. **Lição: depois de formatar, `git diff --numstat` — arquivo que não nasceu formatado sai maior do que a mudança; formata-se só o trecho novo.**

### E-252

- [2026-11-11] **E-252** (Claude Code, SESSAO-48) · Troquei a assinatura de `fn_estoque_categoria` (6 → 8 argumentos), recriei os 4 leitores que eu conhecia e derrubei a de 6 — havia um 5º leitor (`fn_estoque_contar`, `language sql`, usado por `fn_estoque_pecas`) que eu não tinha procurado; a bateria parou no meio com "function … does not exist" (no ar, a conta do estoque de um produto quebraria) → **correção:** o 5º recriado com os dois argumentos; e um programa `quem-chama.mjs` (lê a versão VIGENTE de cada função/visão das migrations e diz quem chama o nome) virou o passo antes de qualquer `drop` de assinatura. **Lição: antes de derrubar uma assinatura, listar TODOS os chamadores pela versão vigente de cada função (não pelo `grep` das migrations, que mistura versões velhas) — e, antes de aplicar, conferir no banco vivo (`prosrc ilike`) se não há chamador fora do repositório.**

### E-253

- [2026-11-11] **E-253** (Claude Code, SESSAO-48) · O check "a etapa que cancela tem o motivo" (`cancela_fabricacao and cancela_motivo in (…)`) deixava gravar o motivo NULO: `null in (…)` dá nulo, o `or` inteiro dá nulo — e check com resultado nulo PASSA. O teste "tirar o motivo é recusado" pegou → **correção:** `coalesce(motivo, '') in (…)` nos três checks novos. **Lição: check que exige valor numa lista escreve `coalesce(x, '') in (…)` (ou `x is not null and …`) — nulo nunca reprova um check.**

### E-254

- [2026-11-11] **E-254** (Claude Code, SESSAO-48) · O ensaio ×100 caiu no gesto de cancelar: a peça de pedido semeada SEM pai e de móvel fora do catálogo, ao perder o pedido (`unidade_desvinculada`), ficava sem pedido, sem produto e sem pai — e `plt_cards_unidade_coerente` recusava (a peça liberada pelo PCP sempre tem pai, mas a antiga pode não ter; o acerto inteiro cairia junto) → **correção:** o fato traz o card do pedido como pai (`dados.card_pai_id`) e a projeção (`fn_projetar_posicao`, extraída) só o usa quando a peça não tem pai; caso novo na bateria. **Lição: antes de tirar um vínculo de uma linha, conferir os checks de coerência da tabela — e semear o ensaio também com as linhas "antigas" (sem os campos que o código novo sempre preenche).**

### E-256

- [2026-11-11] **E-256** (Claude Code, SESSAO-48) · O ensaio ×100 caiu de novo no gesto: a trava única `plt_cards_unidade_reposicao_uq` (pai, posição, unidade) "das peças SEM pedido" foi feita para a reposição, mas a peça que perde o pedido continuava com o card do pedido como pai e entrava nela — cancelar, liberar de novo a mesma vaga e cancelar outra vez seriam duas peças sem pedido no mesmo lugar, e o banco recusaria o gesto → **correção:** a peça do catálogo que perde o pedido fica sem pai (o fato diz `sem_pai`; a de fora do catálogo guarda o pai — [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1#E-254|E-254]]) e a trava passou a ignorar a peça cancelada (`cancelada_pedido_id is null` no recorte); ao voltar ao pedido, o pai volta; caso novo na bateria. **Lição: índice único parcial "das linhas sem X" pega TODA linha que perde o X — antes de tirar um vínculo, procurar os índices únicos cujo recorte a linha passa a cumprir.**

### E-261

- [2026-11-11] **E-261** (Claude Code, SESSAO-48) · Na migration base, a lista de Pedidos testava "em produção" antes de "removido do PCP" (o pedido removido com peça liberada aparecia "Em produção") e contava como liberada a peça cancelada que guarda o card do pedido como pai (a de móvel fora do catálogo — [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1#E-254|E-254]]). A frente 2 achou ao testar a remoção. → **Correção:** "removido" logo depois de "em rota" e `cancelada_em is null` na conta das liberadas; a busca geral ganhou a chave `removido_pcp_em` (só quando há) e a pílula "Removido do PCP em dd/mm", com o atalho para a aba. Duas conferências novas na bateria.

### E-263

- [2026-11-11] **E-263** (Claude Code, SESSAO-48) · Um `for f in $(…)` do shell sobre caminhos com espaço ("Domoby - fabrica") partiu cada caminho em pedaços e o comando rodou contra arquivos que não existem. → **Correção:** lista de arquivos por programa (node) ou `while IFS= read -r`, com aspas em tudo.

### E-271

- [2026-11-12] **E-271** (Claude Code, SESSAO-50 · frente 5) · O teste da 48 que liberava DIRETO no CANCELADO quebrou — a regra nova recusa isso de propósito (era o laço libera → cancela → a vaga volta). → **Correção:** o teste antigo virou a prova da recusa + o caminho que continua valendo (liberar na fila e arrastar para o CANCELADO), com ↩️ no comentário. **Lição:** regra nova que proíbe o que um teste antigo faz → o teste antigo passa a provar a proibição; nunca afrouxar a regra para o teste passar.

### E-272

- [2026-11-12] **E-272** (Claude Code, SESSAO-50 · frente 3) · No meu cenário do excluído no Tiny, o pedido 99651 nasceu com 2 unidades e as 2 peças → todo liberado, fora do "Aguardando liberação" ANTES da exclusão; a conferência "antes estava no PCP" falhou (todo o resto batia). → **Correção:** 3 unidades com 2 peças (uma vaga aberta). **Lição:** cenário que precisa do pedido NO PCP deixa ao menos uma vaga sem peça.

### E-278

- [2026-11-12] **E-278** (Claude Code, SESSAO-50 · frente 4) · O teste dos rótulos da auditoria quebrou: ação nova de registro precisa estar em EXATAMENTE um grupo. → **Correção:** `pcp_ocultos_dias` e `pedido_cancelamento_reenviado` somadas ao grupo do PCP. **Lição:** ação nova no registro de atividade = rótulo + grupo no mesmo commit.

### E-281

- [2026-11-12] **E-281** (Claude Code, SESSAO-50 · bloco B) · O ensaio ×100 travou minutos no "Incluir pedido no PCP": a tela (que eu toquei) chamava a porta ANTIGA do "Novo pedido" (`plt_fn_pedidos_kanban` com "só sem card"), que conta a lista inteira (`count(*) over ()`) e calcula itens, unidades e eventos de CADA pedido antes de cortar 8 — **131 s numa chamada** com 560 mil pedidos (107 ms com os 5,6 mil de hoje). → **Correção:** porta nova no molde da lista de Pedidos ([[Memoria - Banco e SQL 2#A-216|A-216]]): página achada primeiro pelo índice do número, cursor = número da última linha, sem total, só as 8 linhas pagam o que a tela mostra; tela com "mais ao rolar" — 16–20 ms. **Lição:** o ensaio ×100 de uma tela tocada mede TODAS as portas que ela chama, inclusive as herdadas (Lei: "toda tela tocada sai dentro da lei").

### E-288

- [2026-11-17] **E-288** (Claude Code, SESSAO-51) · O "por que não dá para revogar" dizia "O pedido foi arquivado" quando o resto do pedido tinha sido entregue — a entrega completa ARQUIVA o card do pedido que ainda esperava liberação, e a regra do arquivado vinha antes. → **Correção:** a razão que explica (o resto foi entregue) antes da genérica (arquivado). **Lição:** numa lista de "porquês", a ordem é da mais específica para a mais genérica — conferir com o caso que gera as duas.

### E-114

- [2026-10-19] **E-114** (Claude Code) · A conta de tablet de cada setor (SESSAO-36) morava em `plt_usuarios` e aparecia na Equipe com o botão de arquivar — no 1º dia de produção um admin arquivou três e os tablets do SECC, CNC e FITAMENTO travaram ("conta do tablet desativada") → **correção:** reativadas com trilha, a Equipe filtra `conta_tablet`, e a migration 99 trava no banco arquivar/desativar/excluir conta de tablet. **Regra:** conta de máquina que vive na tabela de pessoas sai das listas de pessoas E ganha trava no banco no mesmo dia em que nasce.

### E-127

- [2026-10-21] **E-127** (Claude Code, SESSAO-38 — achado; o erro é da SESSAO-37) · O nível "Logística" ([[D-147 - A arrumacao para entrar em producao limpa geral PINs curtos|D-147]]) nasceu sem vínculo de setor e o banco já o deixava ver tudo da logística, mas o **gate da tela** (`useAcessoLogistica` e a Expedição/ROTAS, que contavam só admin ou vínculo com PCP/fim de linha) o mandava de volta ao início → **correção:** o gate da tela inclui o nível Logística (uma regra só, as telas da logística usam o mesmo `useAcessoLogistica`). **Regra:** nível/papel novo = conferir os gates do FRONT também, não só as funções do banco.

### E-148

- [2026-10-22] **E-148** (Claude Code, SESSAO-39) · A 1ª volta do calendário (a pedido do dono, "melhore esse layout") ficou **"muito redonda e confusa"** na palavra dele: pílulas, número do dia em círculo, grupos por rota com bolinha do caminhão e barra em duas linhas — muita coisa por pedido, e longe do ClickUp do vídeo, que é reto e de uma linha. → **Correção (2ª volta):** grade reta de sete colunas iguais, barra de uma linha "nº · bairro" na cor da situação, legenda em quadradinhos, sem grupos; a rota, o caminhão e o resto foram para o DETALHE que abre no toque. **Regra:** quando o dono mostra uma referência (vídeo do ClickUp), "melhorar" é chegar MAIS PERTO dela, não enfeitar; informação que não cabe numa linha vai para o clique (que a Lei §3 já manda), não para dentro da barra. E no 1º desenho da 2ª volta o cabeçalho do hoje ("QUI 22 out · hoje 10") quebrou em três linhas numa tela de ~960 px → uma linha só, sempre (`whitespace-nowrap`), e o "hoje" escrito só no estreito.
