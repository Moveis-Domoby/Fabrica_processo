---
titulo: "Memória de aprendizado — Tiny n8n e Integracoes (parte 1 de 2)"
tipo: memoria-tema
tema: tiny-n8n
atualizado: 2026-11-18
tags: [memoria, aprendizado, tema/tiny-n8n]
---

# 🧠 Memoria - Tiny n8n e Integracoes 1

> Lições deste tema, movidas de [[PLT - Memoria de Aprendizado]] em 18/11/2026 sem reescrever. Entrada nova entra **aqui**, na seção do tipo dela, com o id no título (`### E-NNN`); o próximo número livre está no índice.

## 🔴 Erros e correções (E-NN)

### E-4

- [2026-08-11] **E-04** · Trocar o Document ID num node do n8n resetou opções silenciosamente ("Column to match on", Cell Format) → **correção:** após trocar qualquer referência, reconferir TODAS as opções do node/config. Lição geral: mudanças de referência podem resetar configuração sem avisar.

### E-5

- [2026-08-11] **E-05** · `dados.id` ≠ `dados.numero` no Tiny causou teste errado → **correção:** nunca presumir qual campo é a chave; conferir na doc/fonte antes.

### E-7

- [2026-08-13] **E-07** · Dois renovadores do token v3 do Tiny se derrubam mutuamente → **correção:** regra do dono único por credencial/recurso. → promovida

### E-25

- [2026-09-08] **E-25** (Claude Code) · Migration 24 espelhava a guarda do gatilho de `pedidos` com `lower()` só, enquanto produção já tinha `translate(...)` (corrigida pela frente do backfill em 28/08) e a nota do esquema afirmava código v2 onde o Tiny grava a DESCRIÇÃO — a detecção de cancelamento da S09 (`= 'cancelado'`) nunca disparou → **correção:** migration 25 normaliza situação no banco (`fn_situacao_normalizada`) e no front (`situacao.ts`), e espelha a guarda de produção. **Lição: toda comparação com dado que vem de integração passa por normalização declarada num lugar só; e "espelho de produção" se confere lendo `pg_get_triggerdef` no banco real, não a nota.**

### E-29

- [2026-09-16] **E-29** (Claude Code) · Portei o vocabulário shadcn do Painel de Recompra como **paleta paralela** escopada no módulo; resultado: o Comercial ficava verde no tema amarelo e os gráficos sumiam (liam `hsl(var(--primary))`, variável que a casa não tinha) → **correção:** os nomes shadcn viraram **apelidos dos tokens semânticos da casa** e o inline virou `var(--x)`. **Lição: módulo portado não traz paleta própria — traz vocabulário, que se traduz para os tokens do sistema. Quem tem duas fontes de cor tem duas identidades ([[Memoria - Modelos Formulas e Possibilidades#M-4|M-04]]).**

### E-36

- [2026-09-22] **E-36** (Claude Code) · Na conferência Tiny×plataforma da S21 escrevi DUAS vezes nome de coluna de memória em consulta ao banco de produção (`eventos.numero_pedido`, `plt_eventos.criado_em`) — as duas quebraram com "column does not exist" (só leitura, sem dano) → **correção:** nome tirado da nota do esquema / da migration antes de reescrever (`eventos.numero`, `plt_eventos.registrado_em`). **Lição: a regra 10 vale também para consulta "rápida" de leitura — pressa de conferência é exatamente quando o nome inventado escapa.**

### E-70

- [2026-09-30] **E-70** (Claude Code, estoque × Tiny) · O bloco novo do harness quebrou a CARGA do arquivo ("Identifier 'parado' has already been declared") — os blocos antigos já tinham `const` com os mesmos nomes no topo do módulo → **correção:** o bloco novo mora num escopo próprio `{ … }` (top-level await funciona dentro). **Lição: bloco novo no `testar-migrations.mjs` (6.900+ linhas) nasce dentro de `{ }` — o erro de nome repetido derruba o harness inteiro antes da 1ª verificação.**

### E-71

- [2026-09-30] **E-71** (Claude Code, estoque × Tiny) · Trocando o fluxo no n8n pelo navegador do app (dono logado): (a) digitei o nome novo sem conferir o foco e as teclas foram para o QUADRO (atalhos do n8n) — conferido pelo store: nada mudou; (b) para conferir o que ficou salvo, chamei a porta interna `/rest/workflows/<id>` com `fetch` da página (401 — ela pede um cabeçalho de navegador próprio) e, minutos depois, o **Publish falhou com "Unauthorized" e a sessão do dono caiu** (causa provável, não provada) → **correção:** o fluxo publicado antigo seguiu no ar (conferido com um GET no endereço de produção do webhook: "registrado para POST"); o rascunho novo ficou salvo inteiro; pedido ao dono para entrar de novo e só publicar. **Lição: no n8n, só a interface — nada de porta interna por `fetch`; antes de digitar, `document.activeElement`; e "o rascunho salvou" não é "publicou" (o n8n 2.x separa os dois).**

### E-68

- [2026-09-30] **E-68** (Claude Code, fotos do Tiny) · Montei a carga das fotos em variáveis da página (`window`) e, antes de disparar, **naveguei a mesma aba** para o Estoque para conferir a 1ª foto — a navegação recarregou a página e o estado sumiu (o disparo seguinte parou em "perdeu o estado", sem nada gravado). No mesmo dia, um `await img.decode()` em todas as imagens da grade **travou até o tempo esgotar**: imagem `loading="lazy"` fora da tela nunca decodifica → **correção:** estado remontado numa chamada só, com o disparo junto e sem navegar até o fim; medida de imagem só das já carregadas (`complete && naturalWidth`). **Lição: script longo na página vive enquanto a aba não navega — conferir em OUTRA aba, ou só depois de terminar; e nunca esperar `decode()` de imagem preguiçosa.**

### E-100

- [2026-10-15] **E-100** (Claude Code, SESSAO-31, validação no site) · Comparei a situação do Tiny com o código minúsculo (`=== 'cancelado'`), mas o banco guarda o RÓTULO ("Cancelado", "Preparando envio") — nunca casaria (pego antes de subir, consultando os valores). → **Correção:** comparar sem caixa e sem acento. Valor do Tiny se confere no banco antes de virar condição (como [[Memoria - Regras de Negocio - Producao PCP Estoque e Rotas 2#A-61|A-61]]).

### E-111

- [2026-10-18] **E-111** (Claude Code, SESSAO-33 — em casa) · Ao passar a correção do limite de 2 anos do Tiny para uma frente própria, dei como certo que "a carga continua normal: as perguntas dela para a loja não usam datas antigas" — sem olhar a fila. A carga monta, para a loja, a janela "antes" das notas (2015 → 31/08/2026) e a das contas a pagar (2015 → 2024), além do pedido de compra pela API nova: a das notas desistiu na mesma noite e as outras duas iam cair igual. E a contagem não perdeu 4 perguntas, e sim 5 (a busca única das contas a pagar da loja também começava em 2015) → **correção:** conferido na fila ao vivo (as linhas da loja com data antiga, as da API nova e as em erro — uma consulta); a migration 93 cobre a contagem E a carga e acerta o que já estava na fila. **Lição: antes de afirmar que um limite não pega uma rotina, olhar as linhas que ela de fato pôs na fila — o que ela monta por baixo (a janela "antes" da `fn_tiny_janelas`) não aparece no nome do gesto.**

### E-112

- [2026-10-18] **E-112** (Claude Code, SESSAO-33) · A bateria da 33 provou a estrutura dos móveis e a árvore de categorias com o formato que se imaginou — `{"produto": {"estrutura": [...]}}` e a lista solta —, não com o que o Tiny manda: na carga de 18/10 as 186 estruturas vieram como lista solta no retorno (a fila guardou `{"lista": [...]}`) e **nenhum componente foi ligado** (tela Estrutura vazia); a árvore de categorias veio como `{"retorno": [...]}` e caiu em "sem envelope" nas duas contas (achados pela frente que acompanhava a carga) → **correção (migration 93, com o OK do dono):** as duas formas valem; as 122 estruturas já guardadas se ligam no acerto, sem perguntar ao Tiny; a árvore volta para a fila. **Lição: tipo de dado novo do Tiny só está provado com UMA resposta real (o 1º item da carga, lido no banco) — o teste com o formato imaginado prova o código, não o Tiny (primo do [[Memoria - Modelos Formulas e Possibilidades#F-5|F-05]] e do [[Memoria - Tiny n8n e Integracoes 2#A-78|A-78]]). E guardar a resposta crua (`plt_tiny_registros`) foi o que permitiu consertar sem chamar o Tiny de novo.**

### E-163

- [2026-10-27] **E-163** (Claude Code, SESSAO-41 · ajuste) · A bateria acusou 1 falha num teste da fila do Tiny (o lote sem a chamada da conta da fábrica) às 03:35 (Natal) — não é regressão: a fila tira a fábrica do lote na madrugada dela, de propósito (a varredura da madrugada). → **correção:** nenhuma no código; registrado. **Lição: falha só nesse teste de madrugada = a regra da madrugada; rodar de novo fora do horário antes de investigar.**

### E-266

- [2026-11-11] **E-266** (Claude Code, SESSAO-48 · frentes 2, 3 e 5) · A verificação "SESSAO-33 · o fluxo do n8n … de ponta a ponta" fica vermelha quando a bateria roda entre 03:10 e 04:40 de Fortaleza (a janela da varredura da fábrica, `fn_tiny_fabrica_em_varredura()`: o lote não pega o item da fábrica — `fimV2: pendente`) — três frentes e o supervisor pararam para investigar um vermelho que não era deles. → **Correção (por ora):** rodar a bateria fora dessa janela para a contagem final; **a fazer:** o bloco fixar o relógio do teste.

### E-116

- [2026-10-18] **E-116** (Claude Code, SESSAO-33 — conferindo a carga do Tiny) · A 1ª renovação do acesso da API nova da FÁBRICA cairia **depois** do vencimento: o relógio `30 */3` com a vez mínima de 2 h (`plt_fn_tiny_fabrica_renovacao_reservar`) pulou a rodada das 03:30 (o acesso, autorizado 01:48, tinha 1h42) e a seguinte, 06:30, viria **4h42** depois da autorização — o acesso vale 4 h → ~40 min vencido, justo quando os 151 pedidos de compra da carga iam passar (passaram até 05:56). Achado lendo o `updated_at` da linha às 03:37 (o relógio dizia `succeeded` — [[Memoria - Tiny n8n e Integracoes 2#A-82|A-82]]) → **correção:** renovação à mão às 04:14 UTC com o OK do dono (o mesmo POST do relógio, com a vez já aberta); o regime de 3 h seguiu sozinho. **Regra:** renovador com vez mínima V e relógio de P horas deixa o acesso chegar a V + P de idade depois de uma autorização — V + P tem de ficar abaixo da validade (aqui: vez de 30 min → 3h30 < 4 h); conferir a 1ª renovação depois de toda autorização. O conserto da vez fica para o dono.

## 🟢 Acertos que viraram padrão (A-NN)

### A-22

- [2026-09-26] **A-22** (Claude Code) · **Tiny: o id do produto NÃO casa entre contas; pedido de venda NÃO gera aviso de estoque.** Conferido na SESSAO-25: 0 de 8.043 itens vendidos da loja têm `id_produto` igual ao `tiny_id` do catálogo da fábrica (cada conta tem seus ids) — a ponte é o **SKU** (7.086 casam; 0 repetidos entre ativos). E 46 pedidos da loja em 3 dias geraram **zero** avisos de "lançamentos de estoque" da fábrica: o pedido vira **reserva** no Tiny, e reserva não é lançamento. → o disponível da plataforma = saldo lido − reservas abertas calculadas dos pedidos que já chegam ao banco (a mesma conta do "disponível" do Tiny).

### A-23

- [2026-09-26] **A-23** (Claude Code) · **Saldo como LEITURA DERIVADA do último evento, sem projeção guardada** — quando o volume é baixo e mexer em tabela da integração exige decisão ([[D-019 - Banco o projeto da org Tech e o de producao e por ora e onde|D-19]]), a porta lê o último aviso por produto (`distinct on`) direto de `eventos`: zero coluna, zero gatilho, zero tabela, e nada para dessincronizar ([[Memoria - Modelos Formulas e Possibilidades#M-2|M-02]]). Se um dia pesar, aí sim projeção com gatilho. A regra do "o que vale" (CNPJ, tipo, formato do saldo) mora numa função só (`fn_leituras_tiny`).

### A-25

- [2026-09-28] **A-25** (Claude Code) · **O aviso de "lançamentos de estoque" do Tiny da fábrica não acompanha a VENDA — nem quando o pedido nasce ([[Memoria - Tiny n8n e Integracoes 1#A-22|A-22]]), nem quando ele sai.** Conferido em 28/09 (só leitura): em toda a vida, 9 avisos por webhook, nenhum de móvel, o último em 25/09; 45 pedidos da loja saíram da reserva (→ entregue) entre 23 e 28/09 e nenhum dos 42 produtos recebeu aviso depois. No modelo da [[D-055 - O numero do estoque o do Tiny menos o que a loja ja vendeu|D-55]] (saldo lido − reservas abertas), quando o pedido sai da reserva a unidade VOLTA ao disponível, porque o saldo lido nunca baixou — o número envelhece para CIMA. E o físico negativo do Tiny (P16) infla a "necessidade extrema": 57 dos 99 fabricados sinalizados não têm nenhum pedido aberto. **Lição: leitura derivada de aviso só vale enquanto TODO movimento gera aviso — conferir a cobertura do aviso (quem movimenta e não avisa) antes de confiar no saldo lido; senão, releitura periódica.**

### A-43

- [2026-10-01] **A-43** (Claude Code, SESSAO-29) · **O pedido do Tiny (v2, `pedido.obter`) NÃO traz o id do contato — e traz o nome ATUAL dele.** Conferido só com contagem no banco: o `cliente` dentro de `pedidos.raw` tem 16 chaves (nome, CPF/CNPJ, fone, endereço, `codigo`…) e nenhuma é o id (o `codigo` só vem preenchido em 594 de 5.440); o id do contato só chega no aviso de venda (`dados.idContato`), que o `Normalizar evento` do n8n descarta. E nos 4.932 pedidos da carga histórica o nome dentro do pedido bate 100% com o do `contato.obter` lido no mesmo dia, até em pedido de 2025 — o Tiny resolve o nome na hora da leitura. **Consequências:** reler o pedido traz o nome novo do contato (o pente-fino corrige nome sozinho), mas identidade do cliente pelo id só existe pelo aviso. **Método:** `jsonb_object_keys` para saber a forma do payload e duas leituras independentes cruzadas por contagem — nenhum dado pessoal no chat.

### A-53

- [2026-10-01] **A-53** (Claude Code, SESSAO-29 — número fora da reserva da S27, [[Memoria - Banco e SQL 2#A-47|A-47]]…A-52) · **n8n 2.32: SALVAR não é PUBLICAR — e agora dá para conferir pela API.** O dono colou as 3 trocas do fluxo de vendas e salvou (23:09); a API pública mostrou o objeto com `versionId` novo e `activeVersionId` = a versão de **17/08** — o que RODAVA não tinha mudado nada (e `activeVersion.nodes` provou: os 3 nós sem a troca; só eles diferiam do rascunho). Ele publicou às 23:20 e os dois ids passaram a bater. A conexão: chave da API criada pelo dono e colada POR ELE num arquivo local ignorado pelo git (`.env.n8n`), lida por script que nunca imprime a chave ([[N8N - Infraestrutura VPS]]). **Lição: depois de qualquer mudança no n8n, "está no ar" só quando `versionId` = `activeVersionId` (e o conteúdo de `activeVersion.nodes` tem a troca); e passo a passo para o dono colar se confere no objeto VIVO pela API antes ([[Memoria - Tiny n8n e Integracoes 1#A-44|A-44]]), não no espelho do cofre.**

### A-44

- [2026-10-01] **A-44** (Claude Code, SESSAO-29) · **Antes de reaproveitar um fluxo antigo, olhar o que ele faz HOJE — no registro da API e no objeto vivo, não no arquivo do cofre.** O fluxo da carga histórica do n8n, com a fila inteira concluída desde 10/09, seguia acordando de 1 em 1 minuto: **1.392 chamadas vazias** de `fn_fila_proximos` em 24 h (o desperdício que o dono vetou no estoque — [[D-080 - Um fluxo so no n8n para o Tiny da fabrica catalogo estoque|D-80]]). E as funções vivas da carga já não eram as do `22_backfill_tiny.sql` (`fn_backfill_falha` com `p_terminal`; nota fiscal casando por `id_venda`; conta a receber por `fn_backfill_conta_mapear`) — classe do [[Memoria - Banco e SQL 1#E-27|E-27]]: quem recriar parte de `pg_get_functiondef`, e o retrato do harness ganha o espelho.

### A-46

- [2026-10-01] **A-46** (Claude Code, SESSAO-29) · **A 1ª conferência com o Tiny acha diferença "fora das colunas" em ~1/4 dos entregues — e é deriva real, não ruído.** Rodada da madrugada: 611 relidos, 138 diferentes, **134 só na cópia crua** (132 entregues que nasceram pelo aviso). Os dois fluxos mandam o MESMO `retorno.pedido` (conferido no espelho dos dois), então não é formato. Para achar O QUE muda sem guardar dado pessoal: foto de **hashes por caminho** da cópia crua (script local) de 9 entregues fora da janela, releitura por uma rodada de diagnóstico, comparação → 8 iguais e o 12379 com **`data_faturamento` 18/06 → 15/09** (o aviso de 15/09 trouxe a data velha; o Tiny mudou depois, calado). A 2ª rodada, logo depois, deu **0**. **Lição: o "outros" da conferência é o Tiny mudando campo que o aviso não traz — esperar alguns por noite; se um dia ele crescer sem motivo, o método dos hashes por caminho diz o campo sem expor dado.**

### A-20

- [2026-09-23] **A-20** (Claude Code) · **Provar que ninguém usa um endpoint antes de fechá-lo — com consulta de CONTROLE.** Para revogar a `fn_pedido_por_numero_nf` do `anon` (S21): (1) grep no repo e nos workflows do n8n, (2) `pg_proc.prosrc` para achar quem a chama por dentro (era uma função DEFINER — o revoke não a afeta), (3) logs da API do Supabase com a MESMA consulta contando uma RPC sabidamente usada (66 × `fn_upsert_pedido`) ao lado da suspeita (0) — sem o controle, "0 chamadas" podia ser consulta errada. Depois: sonda anônima → 401 e advisors.

### A-1

- [2026-08-11] **A-01** · **Copiar o real antes de construir**: engenharia reversa da planilha antes de migrar deu 100% de paridade (1.982 pedidos) — mapear o comportamento existente célula a célula antes de replicar.

### A-2

- [2026-08-11] **A-02** · **Evento > polling**: construir sobre webhook/evento, nunca varredura — o workflow Tiny nasceu assim e não perde nada.

### A-3

- [2026-08-11] **A-03** · Manter a mesma URL/UUID de webhook ao migrar sistema → zero janela de integração desligada.

### A-14

- [2026-09-15] **A-14** (Claude Code) · **Comparar dois bancos VIVOS por hash em fatias**: para provar fidelidade byte a byte entre bancos que não se enxergam (recompra × fábrica), md5 agregado por fatia (`numero % 256`, ou 1º hex do md5) nos dois lados → só as fatias divergentes são abertas → os registros exatos aparecem sem despejar dado pessoal no chat. Foi assim que a deriva da união ficou em "10 pedidos, nomeados" em vez de "os hashes não batem". Cuidado embutido: `::text` de jsonb RE-ESCAPA caracteres (um TAB real vira `\t` literal) — artefato da query de comparação, não do dado; comparar sempre a MESMA extração dos dois lados.

### A-18

- [2026-09-22] **A-18** (Claude Code) · **Renovador escondido: toda função que renova token ao receber 401 é um RENOVADOR, com ou sem cron próprio.** No cutover (S21), a nota dizia "um único renovador" no projeto antigo, mas o código vivo das functions de sync (`tiny-auditoria-sync`, a cada 5 min) chamava `renovarToken()` sozinho em 401 — desligar só o `tiny-auth-refresh-cron` e copiar o token faria o antigo renovar ~4h depois e matar a cópia. **Lição: para trocar o dono de uma credencial rotativa, inventariar QUEM CHAMA o endpoint de token (grep no código deployado), não só quem está agendado para isso — e desligar todos no mesmo passo.**

### A-38

- [2026-09-30] **A-38** (Claude Code, fotos do Tiny) · **O Tiny MANDA a foto do produto pela API — e ela já estava no banco.** O dono achava que não (*"acho que o Tiny não envia as imagens via API"*) e pediu para eu abrir o Tiny; bastou ler `produtos.raw->'anexos'` (o `produto.obter` inteiro que o n8n grava): 146 links públicos do S3 do Tiny em 144 produtos, sem login e **sem CORS** (o navegador não baixa direto; a cópia local servida pelo Vite na mesma origem resolveu). Três armadilhas das fotos do Tiny: (1) **a extensão mente** — 91 `.jpeg` eram PNG, 3 `.png` eram JPEG, 1 `.jpg` era WebP: formato se confere pelos primeiros bytes; (2) **fundo transparente vira PRETO** na redução por canvas → JPEG (`reduzirImagem` não pintava o fundo — corrigido no mesmo dia com o OK do dono) — 18 fotos eram recortes; pintar de branco antes de desenhar; (3) **o móvel é em pé dentro de foto quadrada** (121 de 144 quadradas) e o quadro deitado com `object-cover` mostrava só a faixa do meio — o dono viu na hora. **Lição: antes de abrir o sistema de origem, olhar o `raw` que já guardamos; e antes de escolher o quadro de uma imagem, medir a proporção das imagens de verdade (quadrado + `contain` sobre branco não corta nenhuma).** Método da carga: lista conferida contra o banco por impressão digital (md5 da lista inteira nos dois lados — [[Memoria - Tiny n8n e Integracoes 1#A-14|A-14]]), 1 produto primeiro e conferência no banco e na tela, depois o resto pelo cliente do app com o dono logado ([[Memoria - Testes e Validacao ao Vivo#A-34|A-34]]): 143 produtos em 79 s, zero falha, 44 MB → 5,7 MB.

### A-41

- [2026-09-30] **A-41** (Claude Code, fotos do Tiny automáticas) · **Função do servidor chamada pelo banco sem chave nenhuma no repositório, e só quando há trabalho.** (1) O relógio é INTERNO (pg_cron rodando SQL: 76 ms, nenhuma chamada de fora) e só posta na Edge Function se a porta de pendências devolver algo — a lição da 43 aplicada a função do servidor. (2) O segredo nasce **dentro do banco** na própria migration (`gen_random_uuid()` × 2, guardado em `plt_webhooks.segredo`), vai no cabeçalho pelo `pg_net`, e a função pergunta ao BANCO se confere (`plt_fn_fotos_tiny_conferir`) — o segredo nunca passa por chat, repo, `.env` nem pela memória da função; `verify_jwt` desligado com autenticação própria (401 provado com curl). (3) **Teste de ponta a ponta em produção sem sujeira:** para simular "o Tiny trocou a foto" sem mexer no Tiny, a marca da origem ganhou um sufixo (`imagem_tiny || '#teste'`) em 3 produtos escolhidos pelos casos difíceis (recorte transparente, WebP, 1,7 MB) — a automação recopiou a MESMA imagem pelo caminho real inteiro (relógio → função → redução → biblioteca → porta → histórico → limpeza da cópia antiga) e o resultado final é a foto que já estava. (4) Redução de imagem em Edge Function com a ImageScript: medida antes no Node (≤ 150 ms de CPU por foto de 1024 px; WebP não lê → sobe como veio), e o lote por chamada limitado pelo teto de 2 s de CPU.
