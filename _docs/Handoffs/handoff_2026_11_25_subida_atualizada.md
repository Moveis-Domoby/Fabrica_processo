---
titulo: Handoff — 2026-11-25 · a subida posta em dia com a main de 25/11
tipo: handoff
data: 2026-11-25
atualizado: 2026-11-25
tags: [handoff, subida]
---

# 📋 Handoff — 25/11/2026 · a subida posta em dia com a main de hoje (fila do Escritório)

> [!danger] Esta subida **substitui a de 24/11** — a de 24/11 **não deve ser subida**.
> Ela traz as mesmas entregas (a arrumação da documentação, o teste do painel do Comercial e as entregas 53, 52, 55 e 54) por cima do que entrou no site depois: o pino certo, o aviso do ponto aproximado na aba Programar (já no banco) e o CEP pelo navegador. E acerta um risco: ligar no banco a atualização antiga do "entregue em parte" apagaria o aviso do ponto aproximado da aba Programar.

Diário técnico: [[SUBIDA-2026-11-25]] · a subida antiga: [[handoff_2026_11_24_subida_juntar_entregas]].

## 1. O que foi pedido

Pôr a subida aprovada em 24/11 em dia com a main de 25/11, resolver os conflitos mantendo os dois comportamentos, tirar o risco do banco, ligar no cofre a 57 e os ajustes de 24 e 25/11, e deixar o "para ligar com o dono" com a ordem final.

## 2. O que foi feito

- **As entregas, na ordem e com as mensagens originais** (46 commits), por cima da main de 25/11. O cartão do pedido ficou com as duas coisas: o selo "Entregue em parte" e os avisos do pino (o git juntou sem conflito; conferido).
- **A bateria do banco:** um conflito só, resolvido com os blocos de todos, inteiros: 53, 52, 55, 54, depois a 56, o ajuste de 24/11 e o bloco novo desta subida — tudo antes do resumo final.
- **O risco do banco:** das funções que as atualizações de 18/11 recriam, só a **porta da aba Programar** também foi recriada depois (pelo ajuste de 24/11, já no ar). Ela **saiu** da atualização da 53 e foi para uma **atualização nova** (`20261125100000_plt_candidatos_entregue_em_parte.sql`): a versão viva de 24/11 + só o selo. A bateria prova as duas coisas no mesmo cartão. As outras (52, 54, 55, e as outras três portas da 53) não se sobrepõem a nada que entrou depois.
- **Um erro de lint que veio da main** (no teste do CEP pelo navegador) foi corrigido — sem mudar o comportamento.
- **O cofre:** a 57, o ajuste de 24/11, o CEP de 25/11 e o planejamento do Google ligados na Ordem, no mapa das sessões e no mapa da Logística; 13 decisões novas, 13 lições, duas perguntas em aberto, banco, lei e design (detalhe no diário).

## 3. Como testar, passo a passo (depois de ligar — seção 6)

Os passos da subida de 24/11 continuam valendo ([[handoff_2026_11_24_subida_juntar_entregas|seção 3 de lá]]), mais:

1. **Rotas → Programação → Programar:** um pedido com o ponto no centro da cidade mostra "ponto aproximado · Ajustar o pino" (como hoje). Um pedido entregue em parte mostra "Entregue em parte (N de M)". **Os dois avisos juntos** no mesmo cartão, quando o pedido tem os dois.
2. **Já programadas, Expedição e Entregas do dia:** o pedido entregue em parte mostra o selo; o botão "N pedidos com o pino a conferir" segue em Já programadas.
3. **Ajustar o pino:** o "Achar no mapa" e a conferência do CEP seguem como hoje (nada mudou neles).

## 4. Critérios de aceite

- ✅ Os 46 commits na ordem, mensagens preservadas; a 34 fora.
- ✅ Cartão do pedido e a camada de dados das Rotas com o selo **e** o pino/CEP.
- ✅ Bateria com os blocos de todos, inteiros, na ordem pedida, antes do resumo final.
- ✅ Todas as funções de 52–55 conferidas contra 56, 57, ajuste de 24/11 e CEP de 25/11: só Programar se sobrepunha → atualização nova, a antiga sem ela, a bateria prova os dois juntos.
- ✅ Cofre ligado no formato da dieta; verificador com zero erro (seção 8).
- Testes e navegador: seção 7.

## 5. Decisões que esperam o dono

- As da subida de 24/11 (seção 5 de lá) continuam.
- **O pino certo (57):** as provisórias [[D-394 - A distancia para conferir o pino contra o CEP e 1 5 km|D-394]] a [[D-400 - A lista do pino a conferir conta de hoje em diante pelo dia da|D-400]] (1,5 km, a busca digitada sem memória, o primeiro lugar, "Salvar assim mesmo" só libera, só o pino novo, as rotas inteiras, de hoje em diante).
- **Perguntas novas:** a lista "pino a conferir" pelo banco ([[PLT - Perguntas em Aberto|Q-73]]) e as 7 decisões do ponto do Google (Q-74).
- **Nenhuma decisão nova desta subida** — o acerto da porta de Programar é técnico e cumpre o que já estava decidido (os dois avisos valem).

## 6. Para ligar com o dono (nesta ordem; cada passo com o OK dele)

> Pelo aplicador da casa, **um arquivo por vez** (`npm run banco:aplicar -- --confirmar --so <arquivo>`). Todas as conferências são **só leitura**. Nenhuma das atualizações abaixo grava, muda ou apaga dado que já existe: só recriam funções/visão (e a remoção da função antiga do Comercial, que **fica para outro dia**).
> **Regra desta subida:** antes de cada atualização que recria uma função, compare o **corpo vivo** da função com a **versão mais nova nos arquivos**: `select md5(prosrc) from pg_proc where oid = '<função>(<argumentos>)'::regprocedure` contra a tabela abaixo. Diferente → alguém mexeu depois → **parar e conferir**.

| Porta | Antes (a viva hoje) | Depois |
|---|---|---|
| Programar `plt_fn_programacao_candidatos(text,text,text,text,text,text,integer)` | `ede128618c2009bc81d25b508657b265` (a do ajuste de 24/11) | `e126c5a6b6258d726efd317e78dc69b7` (passo 1b) |
| Já programadas `plt_fn_programadas(boolean,date,bigint,integer,integer,text)` | `b44d068dc02a911d472765ce145a2b06` | `7c15e1ac86bd5ce3520c2056eff2c467` (1a) |
| Expedição `plt_fn_expedicao(text,text,integer,integer)` | `5e03edd92e84bf99d35837063581b98d` | `93b62d87db4148f65bdac78bd5039a17` (1a) |
| Entregas do dia `plt_fn_entregas_do_dia(date,bigint,integer)` | `d6dc9ac4d9ef9f8f968cbfae33c0be33` | `55edee18db65d01e814788fe429784df` (1a) |

*(o md5 é do texto entre os `$function$` do arquivo; se o banco guardou com outra quebra de linha, conferir pelo texto: `pg_get_functiondef` contra o arquivo.)*

**1. Banco — só as atualizações novas, nesta ordem:**

- **1a · a da 53** (`20261118110000_plt_entregue_em_parte_nas_telas.sql`) — agora **sem** a porta de Programar.
  - *Antes:* Já programadas, Expedição e Entregas do dia com o md5 "antes" da tabela; a visão `plt_privado.vw_entregue_em_parte` ainda não existe (`select to_regclass('plt_privado.vw_entregue_em_parte')` = nulo); `plt_fn_programadas` com uma assinatura só; Programar com o md5 de 24/11; anotar um pedido entregue em parte (passo 0 do [[handoff_2026_11_18_sessao53_entregue_em_parte_nas_telas|handoff da 53]], seção 6).
  - *Depois:* a visão existe e quem está logado não a lê (`has_table_privilege('authenticated', 'plt_privado.vw_entregue_em_parte', 'select')` = falso); as três portas com o md5 "depois"; `plt_fn_programadas` com uma assinatura e a coluna `entregue_em_parte`; **Programar continua com o md5 de 24/11** (esta atualização não toca nela).
- **1b · a nova da subida** (`20261125100000_plt_candidatos_entregue_em_parte.sql`) — **só depois da 1a** (usa a visão).
  - *Antes:* Programar com o md5 `ede1286…` (a de 24/11). Se não for, parar.
  - *Depois:* Programar com o md5 `e126c5a…`; uma assinatura só; visitante não chama (`has_function_privilege('anon', …, 'execute')` = falso); chamada como logística (em transação desfeita, como no ajuste de 24/11), os pedidos no centro da cidade **continuam** com `geo_aproximado = 'cidade'` e o CEP, e o pedido anotado no 1a traz `entregue_em_parte`.
- **1c · a da 52** (`20261118100000_plt_datas_e_textos_certos.sql`) — conferências na [[handoff_2026_11_18_sessao52_datas_e_textos_certos|seção 6 do handoff da 52]] (corpo vivo da busca e da devolução igual ao das atualizações de onde vieram; a porta nova da lista não existe → depois existe, 20 linhas, visitante não chama).
- **1d · as três da 55**, nesta ordem (`20261118130000…`, `20261118130100…`, `20261118130200…`) — [[handoff_2026_11_18_sessao55_telas_numa_leitura|seção 7 do handoff da 55]] (as 9 portas novas não existem → existem, só leem, com a permissão de quem chama, visitante não chama).
- **1e · a da ordem dos clientes da 54** (`20261118120100_plt_comercial_clientes_ordem_no_banco.sql`) — [[handoff_2026_11_18_sessao54_comercial_janelas_e_limpeza|seção 6 do handoff da 54]], passos 0a e 1 (guardar as 50 primeiras linhas antes; depois, as mesmas na mesma ordem).
  - ⏸️ **A que remove a função antiga das transições do Comercial (`20261118120000`) fica para OUTRO dia, com OK separado** (é exclusão).
- **Já no ar — nada a fazer, só conferir que continuam:** as três da 56 (24/11) e a do ajuste de 24/11 (`20261124130000`). Nenhuma das 1a–1e mexe nas portas da rota nem no catálogo dos avisos.

**2. Funções do servidor:** nada a publicar. A função de busca de endereço no ar (a versão 16, de 25/11) é a mesma desta subida.

**3. "Subir para o site" deste ramo** — só depois do passo 1 (a lista de pedidos e as telas de uma leitura precisam do banco novo). O site de hoje funciona com o banco novo, então o passo 1 pode ser feito com calma antes.

**4. Validação no navegador depois de ligar:** o roteiro da seção 6, passo 4, da [[handoff_2026_11_24_subida_juntar_entregas|subida de 24/11]], mais a seção 3 daqui (os dois avisos no mesmo cartão da aba Programar).

**Para desfazer:** o site volta para a versão anterior. As 1c, 1d e 1e só acrescentam e podem ficar. A 1a muda a forma de "Já programadas" (o site de antes ignora a coluna nova). Para voltar a 1b, reaplicar `20261124130000` (a porta volta sem o selo, com o ponto aproximado).

## 7. Testes e navegador

- **Montagem do site:** compila. **Lint:** limpo (depois de corrigir o erro que veio da main).
- **Testes de tela:** **124 arquivos, 864 testes, todos verdes** (rodada com menos testes ao mesmo tempo). Na 1ª rodada, com tudo em paralelo, 17 caíram por tempo esgotado; os 14 arquivos passaram sozinhos (50 de 50) e depois na rodada inteira — a máquina carregada, como já anotado nas sessões 56 e 57.
- **Bateria do banco:** **2.127 verdes, 1 vermelha** — a prova "o fluxo do n8n conversa com o banco de ponta a ponta" (do Tiny completo), que **depende da hora**: entre 03:10 e 04:40 a conta da fábrica fica de fora do lote da fila, e a rodada passou por lá. Nada desta subida toca a fila do Tiny; na subida de 24/11, de dia, ela passou. **Rodar a bateria de novo fora dessa janela antes de ligar** (lição E-330). As provas novas desta subida: todas verdes (o selo e o ponto aproximado no mesmo cartão; a 53 não recria mais a porta; a nova = a de 24/11 + só o selo; o estado final).
- **Navegador** (site local desta mesa, banco de produção de hoje, usuário de teste, só olhando — nada gravado), prints na pasta da sala (`subida-2026-11-25-atualizar`):
  - ✅ Programar (01): 27 pedidos; a porta no ar já devolve o CEP, o ponto à mão e o ponto aproximado (o ajuste de 24/11 continua lá). **Nenhum pedido estava com ponto aproximado agora** (a logística acertou os pinos em 24/11), então o aviso "Ajustar o pino" não tinha onde aparecer — provado pelos testes.
  - ✅ Já programadas (02), Expedição (03: 41 pedidos), Entregas do dia no computador (04) e no celular 390 (05), Comercial → Painel de recompra (07: 198 clientes, tabela paginada) — abriram sem erro.
  - ⏳ **Pedidos → Todos os pedidos (06)** e **Meu painel** dão erro de "porta não encontrada" com o banco de hoje: são as portas novas da 52 e da 55, que só existem depois do passo 1. Esperado — é por isso que o site só sobe depois do banco.
  - Não testado de propósito: o selo "Entregue em parte" na tela (precisa do banco novo); Comercial só olhado (nenhum botão de disparo, fila, parar, encerrar ou excluir tocado).

## 8. O cofre

`node scripts/cofre/verificar.mjs --gerar` e `node scripts/cofre/verificar.mjs`: **✅ zero erro** (11 avisos, os de antes: handoffs e diários antigos acima do teto, o índice da memória acima do teto de índice, um número de lição citado que não existe, ligações para trechos). O mapa da Logística passava do teto só com a lista gerada (53 provisórias): o gerador passou a mostrar as provisórias só com a ligação **apenas** no mapa que passaria do teto (A-266). Notas novas: decisões D-390 a D-402; lições E-321 a E-330 e A-264 a A-266; perguntas Q-73 e Q-74; este handoff e o diário. Próximos livres: **D-403 · E-331 · A-267 · Q-75 · dívida 49**.

## 9. Ficou pendente

- Os passos 1, 3 e 4 da seção 6 (com o dono); a remoção da função antiga do Comercial (outro dia).
- `supabase-fabrica-schema.sql` com as mudanças da 56 e do ajuste de 24/11 (aplicadas) e, depois do passo 1, das outras.
- O que a 57 deixou: confirmar o endereço do 13977 com o cliente (o pino foi um palpite); ver o 1º endereço novo resolvido pelo CEP do navegador.
- A prova da bateria que depende da hora (seção 7).
- **A pasta principal do dono:** a subida de 24/11 avisava de mudanças sem commit lá (regras, Ordem, notas). Conferir antes de juntar.

### Próximo passo sugerido
O passo 1 da seção 6 (banco, na ordem), a validação no navegador, depois "subir para o site" deste ramo.
