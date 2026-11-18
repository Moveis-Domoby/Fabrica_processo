---
titulo: "Memória de aprendizado — Regras de Negocio - Producao PCP Estoque e Rotas (parte 2 de 3)"
tipo: memoria-tema
tema: kanban-producao
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/kanban-producao]
---

# 🧠 Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 2

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🔴 Erros e correções (E-NN)

### E-233

- [2026-11-06] **E-233** (Claude Code, números que batem) · O teste "o que já foi entregue continua no histórico" usou um pedido só de frete que ainda esperava liberação no PCP — a entrega ARQUIVA esse card ([[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]], revisão do supervisor) e ele sumiu de "Entregues" antes mesmo do cancelamento → **correção:** o pedido de exemplo já liberado e lançado, como o caso real (13620). **Lição: o exemplo do teste copia o ESTADO do caso vivo (as colunas que importam), senão o teste prova outra regra.**

## 🟢 Acertos que viraram padrão (A-NN)

### A-31

- [2026-09-28] **A-31** (Claude Code, ajuste do Frete) · **Para dizer "o que é" um item de pedido, nem o catálogo nem o SKU bastam — calibrar pela descrição, na 1ª palavra.** No levantamento dos 8.107 itens: "sem par no catálogo" era quase tudo MÓVEL (SKUs antigos `2000000000xxx`, personalizados); a classe "simples" do Tiny misturava móvel feito aqui (Penteadeira camarim, 82 vendas) com cadeira de revenda; e o SKU da loja às vezes é OUTRO produto na fábrica (490 = chapa de MDF vendida como estante). O que separou foi o **histograma pela 1ª palavra** da descrição normalizada — e a palavra em QUALQUER posição dava falso positivo ("Penteadeira … sem a parte de instalação das lâmpadas" é móvel). **Método:** cruzar catálogo × SKU × descrição, agrupar pela 1ª palavra, abrir cada grupo e procurar a palavra no meio do texto antes de propor regra (primo do [[Memoria - Processo de Sessao Cofre e Dono#E-42|E-42]]).

### A-24

- [2026-09-26] **A-24** (Claude Code) · **O número de estoque do Tiny não é contagem física — conferir antes de decidir com ele.** Na carga da SESSAO-25: o aviso de lançamento manda o saldo **físico** (não desconta reserva); a API traz físico + `saldoReservado`; **93 de 168 fabricados com físico negativo** (venda que baixou sem o "pronto") e reserva do Tiny **maior** que os pedidos abertos (327: 44 × 0; serviços da própria fábrica com milhares reservados). → a plataforma calcula a reserva pelos pedidos que já chegam ao banco (regra num lugar só) e mostra o negativo como "necessidade extrema", e a decisão de ligar a reposição automática fica com o dono olhando a prévia (44 cards de uma vez). **Lição: dado de estoque de ERP só vira decisão automática depois de conferido contra o físico — prévia antes de ligar a maquinaria.**

### A-39

- [2026-09-30] **A-39** (Claude Code, estoque × Tiny) · **O "multiempresa" do Tiny é a SOMA dos depósitos de duas empresas — e o aviso de estoque de uma conta só vê os depósitos DELA.** Conferido na carga (`produto.obter.estoque` da fábrica devolve `saldo` somado + `depositos[]` com `empresa`): FábricaDomoby/**Geral** + lojadomoby/**Fábrica · Loja · Desmontado**; as peças prontas ficam no "Fábrica" da LOJA e é lá que a venda baixa (−776 somados em 26/09). O balanço do líder da logística (29/09) zerou o Geral e contou no depósito da loja — 728 avisos, todos do CNPJ da fábrica, nenhum com o número que a equipe via. E o **reservado do Tiny não bate** com os pedidos (345: 47 × 2; 174: 0 × 6) — o número que a equipe usa é o **saldo**. O app v3 da LOJA (token do Comercial) responde 403 em `/estoque` (sem escopo). **Método:** antes de confiar num aviso de ERP, conferir QUAL depósito/empresa ele cobre e comparar com a tela que a equipe olha (o vídeo do dono mostrava o filtro "depósito Geral" e o "disponível multiempresa" lado a lado). **↪️ 30/09 (manhã, a lista das reservas presas):** (1) o reservado do Tiny existe também em **serviço** (Corte 12.982 · Fitamento 6.352 · Furo 3 mm 1.960 — `raw->>'tipo' = 'S'`) e a **classe S do catálogo mistura Simples e Serviço**: a 1ª versão da lista trouxe 8 serviços com 22 mil "reservas" no topo. Corrigido com `raw->>'tipo' <> 'S'` + SKU obrigatório (o pedido casa por SKU). **Método:** conferir a 1ª página com o dado real ANTES de publicar a tela. (2) Para simular o gate no banco real (`execute_sql`), o `sub` do JWT é o **`plt_usuarios.auth_user_id`**, não o `id` — com o `id` a lista volta vazia e parece defeito; e várias instruções numa chamada só devolvem um resultado: um `with cfg as materialized (select set_config('request.jwt.claims', …, true))` antes da porta, numa instrução só. (3) O sincronismo lê os 11 serviços também (a regra de "acabado" é a classe) — inofensivo (saldo 0, nenhuma peça), anotado no handoff.

### A-40

- [2026-09-30] **A-40** (Claude Code, estoque × Tiny) · **Sincronizar com ERP que só manda o saldo FINAL: nunca somar diferença de aviso.** O desenho que passou nos 35 cenários: (1) leitura autoritativa por produto (a campainha do aviso só enfileira — modelo "campainha, não carteiro"); (2) regra ABSOLUTA de subida ("a plataforma sobe até o ERP"), que absorve eco, correção de balanço e cancelamento sem guardar base; (3) gesto daqui manda número ABSOLUTO por **balanço** (repetível — o n8n pode reenviar sem dobrar); (4) fila com UMA linha por produto + `versao` (quem conclui trabalho velho não apaga o pedido novo) + parada visível após N falhas; (5) o que veio do ERP e a venda nunca voltam para o ERP (motivo no evento decide). Delta sobre aviso cru teria transformado a correção −7 → 0 em 7 peças.

### A-42

- [2026-09-30] **A-42** (Claude Code, Ajuste Estoque 2) · **Atalho que abre um modal noutra tela paginada: consulta própria que anda as páginas NO SERVIDOR e modal por DERIVAÇÃO — sem estado intermediário.** A bolinha do Estoque chega ao PCP com o card na URL; a 1ª versão (efeito com setState para abrir e crescer páginas) caiu no lint da casa ("setState dentro de efeito causa renders em cascata"). O desenho que passou: uma consulta com a chave do id que, DENTRO do queryFn, busca página a página pela mesma porta do quadro até achar o card (teto de segurança) e devolve o OBJETO; o modal recebe `cardEscolhido ?? cardDoLink` (derivado) e fechar limpa o parâmetro da URL (gesto). Efeito ficou só para o aviso de "não está mais no quadro" (notificação = sistema externo, permitido). O quadro nem cresce: o modal não precisa que o card esteja na lista visível.

### A-48

- [2026-10-02] **A-48** (Claude Code, SESSAO-27) · **Ramificação numa automação guardada como lista: o "Se… senão" leva os caminhos DENTRO do passo, e o executor troca o PLANO, não o ponteiro.** Em vez de virar grafo (várias entradas, junções), o passo `se_senao` carrega `entao`/`senao`; nada vem depois dele na mesma lista (o banco recusa). Ao avaliar, o executor faz "o que já rodou + o caminho escolhido" e grava em `passos_previstos` — o "esperar" dentro do caminho retoma pelo mesmo `proximo_passo` de sempre, sem mudar o relógio nem a tabela. Na tela, a ligação ganhou só um campo opcional (`saida: 'sim'|'nao'`) e o desenho antigo continua valendo. Conferência de uso em qualquer nível com `jsonb_path_exists(passos, '$.**.etiqueta_id ? (@ == $n || @ == $t)')` (número OU texto). **Quando usar:** decisão dentro de um fluxo linear que já tem espera/retomada — a árvore cabe no mesmo executor.

### A-45

- [2026-10-01] **A-45** (Claude Code, SESSAO-29) · **Teste ao vivo no Tiny sem tocar em dinheiro: pedido entregue tem "editar alguns dados".** Pedido com contas e estoque lançados fica com a edição bloqueada (destravar = ESTORNAR contas e estoque — nunca). Mas o menu "ações" → **"editar alguns dados"** edita previsão, rastreio, observações e observações internas sem estornar nada, e **salvar ali dispara o aviso de venda** (chegou em segundos). Foi assim que a regra das observações (apagou no Tiny → apaga aqui) e a da previsão (apagou no Tiny → fica aqui) foram provadas no banco real, com o campo devolvido ao original no fim. **Método:** escolher campo que nasce vazio (pôr → conferir → apagar → conferir) ou devolver o valor exato; conferir o banco depois de cada salvar.

### A-35

- [2026-09-28] **A-35** (Claude Code, ajuste do painel do PCP) · **Número de painel que resume uma tela sai do MESMO conjunto da porta dessa tela — e o harness amarra os dois.** A Visão do dia (S16) tinha a própria conta de "a liberar"; a S23 ensinou o quadro do PCP a esconder o pedido encerrado no Tiny e ninguém tocou o painel: 5 dias depois, 233 × 33 (200 "Entregue"). Correção ([[D-075 - O quadrinho do PCP na Visao do dia conta o que o quadro|D-75]]): o painel copia o filtro da porta do quadro e o teste compara painel × `contagem_total` do quadro — mudou um sem o outro, fica vermelho. Técnica que tornou a comparação exata: ler as DUAS portas na MESMA consulta (um `now()` só — a espera compara ao segundo e o "hoje" não vira à meia-noite no meio do teste). Primo do [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1#E-47|E-47]] (a promessa sai da porta da tela), agora como teste permanente.

### A-36

- [2026-09-28] **A-36** (Claude Code, ajuste do painel do PCP) · **Total igual não prova conjunto igual.** No teste de mutação (a migration nova tirada da pasta), a 1ª conferência deu painel 5 = quadro 5 com a regra ANTIGA: o antigo contava um pedido "Entregue" e o quadro contava um card de reposição — erros opostos que se anulam. Só a "mais antiga" denunciou. Por isso o bloco confere QUEM está no quadro (os números dos pedidos + a reposição), não só quantos. **Lição: teste de contagem que compara dois caminhos precisa de caso que separe os conjuntos — e o teste de mutação é o que mostra se ele separa.**

### A-9

- [2026-08-26] **A-09** (Claude Code) · **Ler o código da integração antes de modelar, não só o esquema.** `fn_upsert_pedido` faz `delete from pedido_itens` e regrava a cada atualização do Tiny: uma foreign key do card para o item — o caminho "óbvio" — faria **toda atualização de pedido falhar em produção**, e só apareceria dias depois, num pedido editado. Descoberto lendo a função, não a tabela.

### A-54

- [2026-10-03] **A-54** (Claude Code, SESSAO-28) · **Rota pelas ruas grátis, com cache "de graça" e aceite sem dado pessoal fora de casa.** (1) O cache da rota mora na tabela que já guardava os endereços do mapa ([[D-047 - Regra permanente nenhuma tabela nova se uma existente pode|D-47]]): chave LEGÍVEL `rota:carro:` + "lon,lat" com 5 casas em ordem — sem hash, a tela monta a mesma chave e LÊ o cache direto (reabrir = 1 leitura, 0 chamada ao serviço; medido com o `PerformanceObserver` do [[Memoria - Testes e Validacao ao Vivo#A-30|A-30]]); a Edge Function recalcula a chave pelos pontos (nunca confia na de fora) e só ela grava. Falha do serviço não grava nada; "não há caminho" grava (resposta de verdade). (2) A "conferência manual de uma rota conhecida" foi feita com um lugar PÚBLICO (fábrica → Midway Mall: 9,5 km aqui × 9,7/10,2 km no Google) — e o próprio Google reconheceu o ponto de partida como "Fábrica Domoby, Rua Tancredo Neves", o que conferiu de graça a coordenada da fábrica; endereço de cliente nunca foi a serviço de fora. (3) A rua da fábrica está grafada "Trancredo" no mapa aberto — o geocodificador não acha pelo nome certo; a coordenada saiu da geometria da rua (Overpass) cruzada com o print do dono. (4) Bônus de interface: o juntador de classes (`twMerge`) não reconhece a altura da casa `h-toque-*` como conflito de `h-auto` — as duas ficam e a da casa vence; para um `Botao` que precisa crescer, `style={{ height: 'auto' }}` + `min-h-toque-md`.

### A-55

- [2026-10-03] **A-55** (Claude Code, carga de teste da SESSAO-28) · **Serviço de terceiro que "não acha" tudo, de repente: repetir a MESMA consulta de fora antes de culpar o dado.** A `geocodificar` (Edge Function) gravou "não encontrado" nos 18 endereços da carga de teste; daqui, a consulta idêntica achou 7 de primeira e 15 de 19 com uma variação (sem CEP) — o problema era o caminho (servidor → Nominatim), não os endereços. Duas lições: (1) resposta de ERRO de um serviço (recusa, limite, fora do ar) nunca pode virar "o dado não existe" guardado por dias — a `calcular-rota` (desta sessão) já separa "fora" (não grava) de "sem caminho" (grava); a `geocodificar` (S15) não separa; (2) para carga de teste com pedido de verdade: escolher pedido JÁ ENCERRADO no sistema-fonte, conferir antes que nenhuma integração de saída escuta o evento, ensaiar ([[Memoria - Testes e Validacao ao Vivo#A-11|A-11]]) e deixar o porquê no evento (`dados.motivo`), com o caminho de desfazer dito ao dono.

### A-56

- [2026-10-03] **A-56** (Claude Code, ajustes da SESSAO-28) · **Bloqueio de serviço gratuito se PROVA com a resposta, e a saída fica em camadas.** A busca de endereços passou a registrar o código de resposta (sem o endereço) e o teste com um endereço PÚBLICO, feito pela própria função publicada, mostrou: o Nominatim responde **HTTP 403** a todo pedido do servidor do Supabase (daqui da máquina ele responde normal). Saída: (1) recusa ≠ "não existe" (nada gravado); (2) depois da 1ª recusa numa chamada, não insistir com ele; (3) segundo buscador gratuito sobre o mesmo mapa (Photon), com a mesma régua de precisão (casa/rua, cidade conferida, nunca cidade/bairro) e a `fonte` gravada no cache. Dois achados de terreno: o serviço gratuito de ROTAS só dá caminho alternativo para trecho de 2 pontos; e para cortar a linha da rota em trechos, o 1º vértice a ≤ 5 m da menor distância de cada parada acha o encaixe (a volta nunca passa mais perto que o próprio encaixe). ↪️ Fecha a causa "provável" do [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 2#A-55|A-55]].

### A-59

- [2026-10-08] **A-59** (Claude Code, SESSAO-30, [[D-120 - O pedido entregue sai da ROTAS e mora no PCP com tudo dele|D-120]]) · **"Situação de pagamento" no banco da fábrica tem duas fontes de idade diferente:** o pedido (`pedidos`) traz **forma, meio, parcelas** (`parcelas` jsonb `[{parcela:{data,dias,valor,forma_pagamento,meio_pagamento,obs}}]`) e no `raw` a condição/desconto/datas de faturamento e envio — sempre em dia; o **"pago / em aberto"** só existe em `contas_receber` (saldo, situação, liquidação), **copiada do Tiny só até 09/09/2026**. Tela que mostra pagamento: mostrar o que o pedido tem e **dizer em voz alta** a data da última cópia das contas quando não houver conta — nunca deixar "sem conta" parecer "pago". Conferir também o que o Tiny manda "vazio": condição `"0"` e forma de envio de uma letra (`"X"`) são códigos, não texto para gente.

### A-61

- [2026-10-14] **A-61** (Claude Code, SESSAO-31, ajustes da noite) · **Pedido de regra em palavras do dia a dia ("recebido no Tiny") se confere no banco antes de virar regra.** O "recebido" era do PAGAMENTO; dos 23 pedidos parados no PCP, 22 estavam "Preparando envio" — o estado normal de pedido esperando produção aqui (36 no total) — e só 1 "Faturado". Tirar "Preparando envio" esvaziaria o PCP; a regra certa foi "do Faturado em diante". Na resposta ao dono, dizer o que o banco mostrou.

### A-68

- [2026-10-16] **A-68** (Claude Code, SESSAO-32) · **Mudança de caminho que fica mais lenta sem o índice que ainda não tem OK não sobe sozinha.** A lista de Pedidos por caminhos separados saiu igual (bateria + banco real desfeito, 325 linhas), mas sem os índices de trigramas a busca ficou 20–60 ms mais lenta (três varreduras em vez de uma). Foi para `supabase/pendentes/` junto com os índices (entram juntos com o OK do dono), e a bateria segue provando a igualdade lendo o arquivo pendente (bloco 83) — a prova não morre enquanto espera.

### A-95

- [2026-10-21] **A-95** (Claude Code, SESSAO-38 · F4) · **Mudar o que um estado SIGNIFICA sem mudar o que as outras telas leem:** o "ausente que não conta" ganhou uma MARCA no segmento (`especial`), não um estado novo — o quadro/tablet (porta de outra frente) segue lendo `ausente`; só o agregado diário (lido só pelas portas da dashboard) recebe o estado novo no fechamento. A causa (a pausa especial) vive numa projeção própria (`plt_pessoa_pausas`), escrita por gatilho com nome que ordena antes do projetor do card (para ler o executor antes de a movimentação apagá-lo — [[Memoria - Banco e SQL 1#E-78|E-78]] ao contrário), e o recálculo da presença lê "a parada aberta mais recente". O gatilho do card que já recalculava e o meu recalculam no MESMO instante — o segmento de duração zero se apaga sozinho (regra da 96), então a ordem dos dois não importa.

### A-89

- [2026-10-21] **A-89** (Claude Code, SESSAO-38) · **Regra de negócio compartilhada entre telas = pilha de views na ordem do sentido** — `vw_pedido_prontidao` (o estado de cada pedido) → `vw_pedidos_vivos` (o filtro do "vivo") → `vw_pedidos_para_rota` (os candidatos): cada porta lê o nível que precisa, a regra nova de outra frente ("stand-by") entra num WHERE só, e o planejador embute tudo (view não é função com SET — [[Memoria - Desempenho e Tempo Real#E-65|E-65]]). Prova no banco real como `authenticated`: Expedição 10 ms, Programação 32 ms, ROTAS 24 ms (41 pedidos vivos).

### A-102

- [2026-10-21] **A-102** (Claude Code, SESSAO-39) · **Link do Google Maps sem custo e sem chave para a rota da plataforma:** `https://www.google.com/maps/dir/?api=1&origin=&destination=&waypoints=a|b&travelmode=driving&dir_action=navigate` — mantém a ordem, até 9 paradas (3 no navegador do celular sem o aplicativo), 2.048 caracteres; sem `origin` = de onde o aparelho está. Rota maior em partes equilibradas (nunca uma parte só com a volta). O Waze (`waze.com/ul?ll=lat,lon&navigate=yes`) aceita UM destino. Coordenada com 6 casas (o ponto flutuante de `-5.8 - 0.02` vira `-5.819999…`). Conferido abrindo o link: o Google reconheceu a "Fábrica Domoby" pela coordenada.

### A-103

- [2026-10-21] **A-103** (Claude Code, SESSAO-39) · **Conta cara por linha na leitura vira valor guardado no fim do gesto** (Lei §7.1): o painel de motivos chamava `fn_tempo_util` por pausa e por saída a cada abertura (0,9 s em 30 dias, 2,5 s em 90 dias no ×100); o tempo útil passou a ser calculado UMA vez — quando a pausa termina (gatilho próprio em `plt_pessoa_pausas`, sem tocar a maquinaria da SESSAO-38) e quando a pessoa volta ao setor (projeção `plt_presenca_saidas`, porque o fato de presença não se altera) — e o painel só soma (o aberto, poucos, é calculado na hora). Antes de otimizar, MEDIR as partes (script de partes no mesmo banco do ensaio): a conta certa era 500 ms das pausas, 190 ms das saídas (a busca do "próximo fato" com `min()` em vez de `order by id limit 1`) e 89 ms do aviso do calendário (a regra do pedido vivo calculada para todos — o filtro da previsão desce até os pedidos).

### A-105

- [2026-10-22] **A-105** (Claude Code, SESSAO-39) · **Regra com uma parte barata e uma cara: separar em duas views, com um dono só.** `vw_pedidos_vivos` (o "é vivo?" + a prontidão de cada pedido) custava ~343 ms no ×100 (5.000 vivos), ~95% na prontidão — que o calendário nem mostra. Virou `vw_pedidos_vivos_regra` (só a regra, `exists` no lugar de `unidades_liberadas > 0`) e `vw_pedidos_vivos` = regra + prontidão, com as MESMAS colunas (quem lia não muda nada; `create or replace view` exige nome, tipo e ordem iguais). A bateria prova que as duas dão o mesmo conjunto e as mesmas colunas. E a medida que custa caro na leitura e só existe no fim de um fato (o tempo útil do stand-by) nasce DENTRO do fato de saída (gatilho BEFORE preenche `dados` ao escrever — nada se altera depois, RNF-05).

### A-122

- [2026-10-27] **A-122** (Claude Code, SESSAO-41 · filtros) · **Filtro de lista que também alimenta mapa e seleção:** a porta devolve `{itens, total, total_geral, contagens, cidades, bairros}` numa requisição (as opções dos filtros com os "quantos", sem 2ª ida); a tela guarda os MARCADOS num `Map` com os dados de quando foram marcados — o filtro esconde da lista, nunca da rota; só a lista SEM filtro e inteira (não o "dado de antes" do `keepPreviousData`) diz que um marcado sumiu de verdade. Busca de rota (Já programadas) = semi-junção pela chave da rota (dia, caminhão, rota) — a rota volta inteira.

### A-121

- [2026-10-27] **A-121** (Claude Code, SESSAO-41 · ajuste) · **Fato que vale no passado sem editar nada:** o evento leva `ocorrido_em` = o instante em que valeu (o aviso) e `registrado_em` = agora; as projeções que usam `new.ocorrido_em` (pausa do card, pausa da pessoa, auxílios) acertam sozinhas; a presença (que fecha trechos em `now()`) recebe duas marcas da transação (`plt.presenca_agora` + `plt.presenca_quem`) e fecha no instante certo SÓ para as pessoas do card e só se o trecho começou antes — nada mais do banco muda de comportamento.

### A-124

- [2026-10-28] **A-124** (Claude Code, ajuste 28/10) · **Peça que muda de dono no meio da produção = um FATO na peça + projeção própria** (`peca_vinculada` + `fn_projetar_peca_vinculada`, gatilho só desse tipo — nada da projeção grande recriado): setor, etapa, execução e tempo ficam; muda pedido, item e k/n. O PAI fica com quem precisa da conta: a reposição continua pai (as contas dela são por `card_pai_id` — a vaga segue liberada, "só perde a peça"), a peça de cancelado passa a ter o pedido novo como pai; as conferências por ÍNDICE da reposição (janela e liberar) leem a vaga original guardada no fato. O número do estoque acerta sozinho pela projeção por instrução de `plt_cards` (categoria por `pedido_id`).
