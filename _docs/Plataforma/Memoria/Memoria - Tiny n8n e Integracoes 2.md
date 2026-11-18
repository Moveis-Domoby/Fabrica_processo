---
titulo: "Memória de aprendizado — Tiny n8n e Integracoes (parte 2 de 2)"
tipo: memoria-tema
tema: tiny-n8n
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/tiny-n8n]
---

# 🧠 Memoria - Tiny n8n e Integracoes 2

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🟢 Acertos que viraram padrão (A-NN)

### A-57

- [2026-10-08] **A-57** (Claude Code, SESSAO-30) · **Refazer o retrato de partida da demanda no banco E no n8n antes de levar as perguntas ao dono.** A demanda (retrato de 06/10) dizia "3 pedidos entregues no Tiny e abertos aqui"; a releitura de 08/10 achou **21** — os 3 + os **18 da carga de teste da S28** (lançados sem peças, 11 programados) — e mais 3 pedidos "Entregue" no Tiny com peça em produção/no aguardo (a pergunta 1 deixou de ser hipotética). E a API do n8n mostrou o fluxo antigo "ClickUp ROTAS → Tiny (entregue)" **rodando no próprio dia** — a equipe ainda entrega pelo ClickUp —, o que muda a recomendação de quando desligá-lo (antes de a logística passar para a plataforma, a entrega pararia de chegar ao Tiny). **Método:** uma consulta de leitura por caso da demanda (com o `now()` do banco — [[Memoria - Processo de Sessao Cofre e Dono#E-76|E-76]]) + a lista dos fluxos do n8n com as últimas execuções; pergunta ao dono leva o número de HOJE (primo do [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 1#E-67|E-67]]: a premissa da pergunta envelhece).

### A-58

- [2026-10-08] **A-58** (Claude Code, SESSAO-30) · **A chave da API do n8n da casa só LÊ** (criar fluxo deu 403). Fluxo novo vira **arquivo importável na pasta `Fabrica n8n/`, sem segredo** — o token do Tiny vem de variável do n8n (`TINY_FABRICA_TOKEN`, a do fluxo do estoque; o do ClickUp tem o token escrito no nó) — e entra no ar com o dono (Import → Publish), com a chave da plataforma desligada até a prova. Para descobrir de onde um fluxo tira o token sem expor nada: imprimir só a FORMA do valor ("expressão `$env.X`" ou "literal de N caracteres"), nunca o valor.

### A-60

- [2026-10-09] **A-60** (Claude Code, SESSAO-30, [[D-123 - O Entregue vai ao Tiny mora dentro da automacao do Tiny|D-123]]) · **Mexer em automação PUBLICADA do n8n pela API sem quebrar:** no n8n 2.x, `PUT /workflows/{id}` numa automação publicada **republica na hora** (não há rascunho de segurança). Receita que funcionou: (1) ler a OpenAPI do próprio n8n (`/api/v1/openapi.yml`) antes; (2) guardar a cópia e o `activeVersionId` (o caminho de volta é `POST /workflows/{id}/activate {versionId}`); (3) montar o corpo a partir de `activeVersion.nodes/connections`, só ACRESCENTANDO, e provar com comparação profunda que os nós e ligações de antes vão idênticos (sem colisão de nome, id e caminho de webhook); (4) mandar `settings` só com as chaves que a API aceita (as outras o servidor mantém); (5) esperar a automação ficar ociosa; (6) depois: comparar de novo, gatilho com envio vazio e um trabalho real pequeno pela parte antiga. Automação com "salvar execução com sucesso: nenhuma" só mostra erro — a prova de sucesso é o efeito no banco. E: **conferir a CONTA do Tiny pela chave que um fluxo que já funciona usa** (comparar o resumo das chaves, nunca o valor) — o arquivo de 08/10 estava com a conta errada.

### A-64

- [2026-10-15] **A-64** (Claude Code, SESSAO-31, depois da validação) · **Teste em produção pedido pelo dono ("anexe um arquivo qualquer"):** (1) conferir antes QUEM escuta o fato que o teste gera (webhooks ativos, automações, avisos) — aqui nenhum webhook ouvia `anexo_adicionado`; (2) escolher o registro que menos confunde a equipe (o pedido da própria Loja Domoby, não o de um cliente); (3) arquivo que se anuncia como teste ("TESTE… pode apagar"); (4) conferir na tela que o teste mostrou o que devia; (5) dizer ao dono onde está e que se tira depois (o histórico guarda). Sem entrega pendente e com o card do pedido entregue arquivado, o caminho pela tela foi a janela do card de um pedido em produção.

### A-69

- [2026-10-16] **A-69** (Claude Code, SESSAO-32, insumos) · **Classe do Tiny não é tipo de estoque — o "simples" mistura revenda e insumo; o código fiscal separa, numa regra só, e o admin corrige numa tela.** No Tiny da fábrica a classe S tinha cadeiras e bases de revenda (código fiscal do capítulo 94 — móveis) junto com fita, bucha, sapata, cola, thinner. Contar toda S como móvel inflou "móveis em estoque" (4.895 — eram 130) e deixou a fila do Tiny transformar insumo em milhares de cartões (≈4.765 → 5.090 em poucas horas, até a correção). **Padrão:** o tipo é coluna calculada e guardada (`coalesce(à mão, automático)` por função imutável) e TODAS as contas leem a coluna — nunca a regra copiada em cada função; o admin corrige em Configurações sem código ([[D-138 - SESSAO-32 o OK dos indices e os insumos separados dos moveis|D-138]]). Antes de criar coluna calculada numa tabela que outro sistema grava, conferir que quem grava lista as colunas (o `fn_upsert_produto` lista — um insert genérico quebraria). E a foto antes/depois no banco real (contagem por tipo, Top X, fila, resumo, como a pessoa) é o que prova que só a conta mudou.

### A-70

- [2026-10-16] **A-70** (Claude Code, SESSAO-32, Comercial) · **View sobre o JSON bruto é custo pago a cada leitura — a tela pronta se mantém no fato; e filtro de data em "ou" de ramos esconde o índice.** `vendas_marketing` desmontava os 5.568 pedidos do Tiny a cada leitura (3,3 s); a projeção (`plt_comercial_*`) é refeita por gatilho à prova de falha só para o pedido/cliente que mudou, com reconstrução e conferência (`fn_comercial_conferir` = 0) e pendentes refeitos na próxima gravação — nada de relógio. Prova: porta antiga com outro nome × nova, na bateria e no banco real desfeito. E o filtro `(modo = all) or (ini is null and fim is null) or (ini and data >= ini) or …` faz o planejador varrer a tabela (20–40 ms); resolver os limites uma vez e escrever `data >= coalesce(ini, -infinity) and data <= coalesce(fim, infinity) or (sem limites and data is null)` dá o MESMO recorte com o índice (3 ms) — inclusive no plano genérico.

### A-71

- [2026-10-16] **A-71** (Claude Code, SESSAO-32, [[D-140 - SESSAO-32 pedido excluido no Tiny nao existe em nenhum modulo|D-140]]) · **Uma verdade só para todos os módulos — e conferência que só CONTA o que não achou esconde divergência.** O Tiny não avisa exclusão; a conferência da madrugada ouvia "Pedido não localizado" do 13622 toda noite e só somava em "não encontrados" — o pedido ficou 8 dias vivo no Comercial (outubro R$ 14.051,90 a mais que o Tiny), na lista de Pedidos e com 32 cartões na produção. **Padrão:** todo veredito da conferência vira fato aplicado (marcação + reação), e a marcação é uma só, lida por todos os módulos (o dono: "fábrica e comercial devem reagir às mesmas tabelas, aos mesmos dados"). **Receita da diferença:** valor do Tiny × plataforma por mês → a diferença bate com a soma de quais pedidos? (aqui, um só, ao centavo) → a fila da conferência guarda a resposta do Tiny para cada um. E bloco à prova de falha que engole erro precisa de prova na bateria do efeito (o arquivamento falhava em silêncio por causa da origem — `fn_validar_api`).

### A-72

- [2026-10-16] **A-72** (Claude Code, SESSAO-33) · **Sessão na nuvem com os sites oficiais do Tiny bloqueados (403 da política de rede): o Swagger oficial da v3 tem espelho público no GitHub, e o GitHub passa.** `github.com/opastorello/olist-mcp-server` guarda o `swagger.json` ("Olist ERP API v3", versão 3.1, 28/02/2026, baixado da URL oficial do Swagger) — clonado só para leitura, fora do repositório; somado ao que o cofre já conferiu e aos dados reais que o banco guarda (o `raw` de cada cópia do Tiny), dá fonte para cada linha sem inventar. **Não contornar a política** (nada de buscar a internet por outro serviço, nem pelo banco); avisar o dono do endereço bloqueado e de como liberar (menu do ambiente → Editar → Acesso à rede). De quebra: essa versão não tem logs de movimentação, depósitos nem orçamentos — afirmação do plano 003 a reconferir.

### A-77

- [2026-10-17] **A-77** (Claude Code, SESSAO-33 — em casa) · **Tabela de linha única que passa a ter duas: auditar leitores E escritores antes de a 2ª linha nascer.** Leitores: as funções publicadas (fonte de cada uma), as funções do banco (`prosrc`), visões, `cron.job` e o `pg_stat_statements` (pega quem não está no código) — na `tiny_auth` todos filtravam pelo `id`. Os riscos estavam nos **escritores**: a manutenção que apaga a tabela inteira e recarrega, e o modo de teste do renovador que grava sempre na linha 1. No `ILIKE`, o `_` casa qualquer caractere (o `tiny-auth-refresh-cron` "casou" `tiny_auth`) — escapar (`\_`) ou conferir à mão. Trabalho pesado de leitura vai para um ajudante: a conversa recebe só o veredito.

### A-78

- [2026-10-18] **A-78** (Claude Code, SESSAO-33 — em casa) · **Tiny: o que só aparece ao vivo.** (1) A opção "Aplicativos" (API v3) só existe com a extensão grátis **"Gestão de Aplicativos"** (plano a partir de Construa) e **cada empresa precisa do próprio aplicativo** — a fábrica não tinha. (2) Loja e fábrica estão no **mesmo login** — troca-se pelo **Multiempresa** (não pedir para sair e entrar). (3) A autorização volta na hora quando a sessão do Tiny está aberta no mesmo navegador; a 1ª tentativa, sem ela, morreu na tela de login sem voltar à função (nenhum GET no registro). (4) **O plano da LOJA só aceita filtro de data dos últimos 2 anos** (código 31) — a fábrica aceitou 2015; janela que começa em 2015 tem de começar no piso do plano. (5) O aplicativo da loja (Comercial) não tem "Ordem de Compra" (403). **Lição: antes de desenhar janela de data ou recurso da API nova, perguntar ao Tiny de verdade (1 chamada) em cada conta — a documentação não diz o plano de quem chama.**

### A-82

- [2026-10-18] **A-82** (Claude Code, SESSAO-33 — conferindo a carga do Tiny) · **`succeeded` no histórico do relógio que chama `net.http_post` só diz que o pedido SAIU** — não que a função fez o trabalho (o renovador respondeu "ainda válido" e não renovou, e o relógio marcou sucesso). A prova é o efeito no banco (o `updated_at` da linha do token, o status da linha da fila) ou a resposta guardada do pedido. Na mesma linha: o "bateu com o Tiny?" se confere refazendo no banco a conta do painel (as janelas da contagem mais recente + `plt_privado.fn_tiny_aqui` de agora) antes de abrir a tela — e a carga se acompanha pela própria fila (a frente pelo id, o ritmo a cada 10 min, o que falta por tipo), sem chamar o Tiny.

### A-100

- [2026-10-21] **A-100** (Claude Code, supervisor da SESSAO-38) · **A bateria tem um bloco que depende do RELÓGIO:** "SESSAO-33 · o fluxo do n8n … ponta a ponta" falha das 00h às 06h de Natal porque `fn_tiny_fabrica_em_varredura()` tira a conta da fábrica do lote na madrugada — não é defeito de quem está mexendo (provado: falha igual sem a migration nova). Dívida: congelar o relógio no bloco. Junto: o teste "o dono toca no botão" da tela de API falha só na suíte inteira (instável).

### A-119

- [2026-10-27] **A-119** (Claude Code, SESSAO-41) · **"Muda aqui, mas o Tiny manda se mudar lá":** guardar junto da data da plataforma a data do Tiny daquele momento; a que vale é derivada (`fn_data_entrega` nas portas, junção nas visões que muitas portas leem) — o Tiny mudou depois, a da plataforma deixa de valer sozinha, sem gatilho na integração e sem tocar a tabela dela.

### A-135

- [2026-11-04] **A-135** (Claude Code, SESSAO-44) · **Itens que o Tiny mudou, sem guardar cópia:** o gatilho adiado `after update of raw … when ((old.raw -> 'itens') is distinct from (new.raw -> 'itens'))` recebe a lista de ANTES no `old.raw` — basta resumir as duas listas pelas mesmas regras (frete fora, quantidade arredondada, chave de produto) e comparar. No COMMIT os itens novos já estão gravados ([[Memoria - Banco e SQL 2#A-47|A-47]]).

### A-223

- [2026-11-12] **A-223** (Claude Code, SESSAO-50 · frente 4) · **Vontade nova na fila de saída do Tiny = conferir antes a lista do fluxo do n8n:** o nó "Validar pedido" do fluxo da situação do pedido (dentro do workflow principal) só deixa passar as situações da lista `PERMITIDAS` — sem `cancelado` nela, a fila reenviaria o cancelamento a cada 3 min para sempre (a linha nunca fecha). A lista é somada na subida, pela API do n8n (cópia antes, comparação depois, volta pela versão). E `plt_privado.fn_tiny_situacao_api` também não traduzia `cancelado` — somado na migration.

### A-224

- [2026-11-12] **A-224** (Claude Code, SESSAO-50 · frente 3) · **O "não localizado" do Tiny só vale na conta da LOJA:** a conta da fábrica responde "não localizado" para pedido que é da outra empresa — a detecção de excluído ficou presa a `conta = 'loja'` (a bateria prova: o da fábrica não marca nada).

### A-225

- [2026-11-12] **A-225** (Claude Code, SESSAO-50 · bloco A, regra 10) · **Coluna nova em tabela da integração muda a impressão digital que o aplicador confere** (regra 10: a estrutura da integração não muda) → dado novo por item do pedido mora numa tabela da plataforma com a mesma chave (`plt_itens_observacao (pedido_id, seq)`, apagada junto com o pedido), escrita pelo mesmo caminho que grava os itens.
