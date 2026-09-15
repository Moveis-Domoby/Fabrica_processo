---
titulo: n8n — Cadastro de Cliente (migração 5)
tipo: workflow
status: construido-aguardando-publicacao
atualizado: 2026-09-03
tags: [n8n, tiny, formulario, cadastro, contato]
---

# 🧾 Migração 5 — Formulário → Cadastro de cliente no Tiny

> [!success] Estado em 03/09/2026
> **Construída e conferida contra a planilha de produção.** O CSV que faltava desde 13/08 foi lido direto do Drive; o mapeamento está fechado e validado contra as **806 respostas reais** (29/08/2022 → 02/09/2026).
> **Planilha 100% preparada em 03/09:** cabeçalho Q1 renomeado ✅, aba `PENDÊNCIAS` com os 12 títulos ✅, service account do n8n como Editor ✅.
> **Testada no n8n em 03/09** com uma linha fixada e o node de escrita desligado: a cadeia inteira rodou com 1 item, `contatos.pesquisa` respondeu e `Decidir incluir ou alterar` devolveu **`acao: alterar` com o id do contato** — a dedupe por `cpf_cnpj` está provada contra um contato real.
> **Primeiro cadastro real gravado no Tiny em 03/09** (contato "Aangela maria do nascimento santos"): CPF mascarado e válido, Pessoa Física, marcador Cliente, endereço completo com número `025` (zero à esquerda preservado), complemento vindo da coluna O, telefone formatado, e-mail também como e-mail de NF-e. E a cidade **corrigida pelo CEP**: o cliente digitou `Pilar/RN`, o CEP `48.967-000` resolveu para `Jaguarari/BA` — Pilar é povoado de Jaguarari.
> **Os três testes passaram em 03/09, todos com resposta real do formulário:**
> 1. **Cliente existente** (CPF do dono, já no Tiny) → `acao: alterar` com o id — dedupe provada, sem duplicar.
> 2. **Cliente novo** ("Aangela…") → contato **criado**, com a cidade corrigida pelo CEP de `Pilar/RN` para `Jaguarari/BA`.
> 3. **CPF inválido** (`111.111.111-11`) → contato **criado sem documento**, aviso na `obs`, linha na PENDÊNCIAS com `Erro do Tiny = nao` e o documento gravado como texto `11111111111`, sem perder dígito.
>
> **Falta só publicar** e limpar os contatos e as linhas de teste.

Arquivo: `domoby-formulario-cliente-tiny.json` (15 nodes, importável)

## Por que esta exige mais cuidado que as anteriores

É a primeira automação que **escreve dentro do cadastro do Tiny**. Card duplicado se apaga; **cliente duplicado ou com CPF errado contamina a base do ERP** — nota fiscal, histórico e o painel de recompra da loja (que casa clientes por CPF/telefone). E quem preenche o formulário é **o próprio cliente** → CPF torto, campo vazio e reenvio duplicado são o caso normal, não a exceção.

---

# PARTE A · AS TRÊS QUEIXAS E O QUE RESOLVE CADA UMA

| Queixa do dono (01/09) | O que resolve |
|---|---|
| "Está sem integração desde que saímos do Pluga" | Este workflow. Gatilho na aba de respostas, escrita em `contato.incluir` / `contato.alterar` |
| "Quando o cliente erra o CPF não integra no Tiny; no Tiny direto ele nem deixa cadastrar" | O node **Normalizar e validar** roda o **dígito verificador** antes de chamar o Tiny. Documento que não passa **não é enviado** — o cliente entra sem CPF, com aviso em `obs` e linha na aba PENDÊNCIAS. Nada com dígito inválido chega ao Tiny, então o Tiny nunca mais recusa por isso |
| "Não tem lugar para CNPJ" | **Sem mexer no formulário.** O mesmo campo `CPF ` aceita CNPJ: o código conta os dígitos — 11 = CPF (`tipo_pessoa: F`), 14 = CNPJ (`tipo_pessoa: J`) — e valida o dígito verificador dos dois. Nas 806 respostas já havia **15 CNPJs** digitados ali, todos aproveitados |

> [!note] Decisão de 01/09 sobre o formulário
> O dono decidiu **manter o formulário como está** e só construir a integração. A separação PF/PJ em seções continua disponível como melhoria futura (ver PARTE G), mas não é pré-requisito: a detecção por quantidade de dígitos já cobre os dois casos.

---

# PARTE B · A PLANILHA DE RESPOSTAS (fonte da verdade)

| Item | Valor |
|---|---|
| Arquivo | **Dados do pedido (respostas)** |
| ID | `1Lcnfpp4czFSpo7xtLjKlHqKo5Dpiv3nwwLixzkmWScg` |
| Abas | `Respostas ao formulário 1` (respostas) + `PENDÊNCIAS` (criada 03/09) |
| Formulário | **Dados do pedido** — `121uO0q-qQXn0k4xgO5yGnGEdp_Z7iloQkqojtvnvfqQ` |
| Volume | 806 respostas em 4 anos ≈ **0,5 por dia** |

## Cabeçalho literal, coluna por coluna

⚠️ **Três cabeçalhos terminam com espaço.** O n8n devolve a linha com a chave exatamente igual ao cabeçalho. `r['CPF ']` funciona, `r['CPF']` volta `undefined`.

| Col | Cabeçalho literal | Vivo? | Vai para |
|---|---|---|---|
| A | `Carimbo de data/hora` | ✅ | rastreio/pendências |
| B | `Nome completo` | ✅ | `nome` |
| C | `Número de telefone` | ✅ | `fone` |
| D | `Rua ` ← **espaço** | ✅ | `endereco` |
| E | `Bairro` | ✅ | `bairro` |
| F | `Cidade` | ✅ | `cidade` (+ UF quando vem "Natal/RN") |
| G | `CEP` | ✅ | `cep` |
| H | `CPF ` ← **espaço** | ✅ | `cpf_cnpj` + `tipo_pessoa` |
| I | `E-mail` | ✅ | `email` e `email_nfe` |
| J | `Qual(is) produto(s) escolhido(s)?` | ❌ morta | — |
| K | `Como nos conheceu?` | ✅ | `obs` (prefixo "Origem:") |
| L | `Forma de pagamento?` | ❌ morta | — |
| M | `Alguma observação sobre seu pedido?` | ❌ morta | `obs` (se voltar) |
| N | `End. Número ` ← **espaço** | ✅ | `numero` |
| O | `Complemento` | ✅ | `complemento` |
| P | `Estado` | ✅ | `uf` |
| Q | `Complemento (antigo - nao usar)` ← renomeada 03/09 | ❌ morta | — |
| R | *(cabeçalho vazio)* | ❌ morta | — |

> [!danger] A armadilha da coluna Q
> `Complemento` aparece **duas vezes** (O e Q). O n8n monta o objeto da linha pelo nome do cabeçalho: chave repetida, um valor sobrescreve o outro. Se ganhar a Q (vazia), o complemento some silenciosamente.
> **Resolvido em 03/09:** o cabeçalho Q1 passou a ser `Complemento (antigo - nao usar)`. Conferido lendo a planilha de volta: nenhum nome de coluna se repete mais, e o código lê complemento em **240 das 806 respostas** (seria 0 se estivesse caindo na coluna Q).

---

# PARTE C · A ARQUITETURA

```
Gatilho · nova resposta no formulário   (Google Sheets Trigger, rowAdded, 1×/min)
  → Normalizar e validar                (Code)
  → Dá para cadastrar?                  (IF)  ──não──────────────┐
  → ViaCEP · cidade oficial             (HTTP, por CEP)          │
  → Aplicar cidade do CEP               (Code)                   │
  → Tiny · contatos.pesquisa            (HTTP, por cpf_cnpj)     │
  → Decidir incluir ou alterar          (Code)                   │
  → Pesquisa respondeu?                 (IF)  ──não──────────────┤
  → Tiny · contato.incluir ou alterar   (HTTP)                   │
  → Conferir resposta do Tiny           (Code)                   │
  → Precisa de pendência?               (IF)  ──sim──────────────┤
                                                                 ↓
                              Montar linha de pendência → Pendências · registrar
                                        → Foi erro do Tiny? → Erro · Tiny recusou
```

**Workflow separado** do fluxo do Tiny → planilha: gatilho e ciclo de vida diferentes.

O Google Sheets Trigger aqui é seguro — a aba de respostas do Forms só recebe linhas no fim, sem fórmula, sem o deslize que duplicava a PCP. **Não existe Google Forms Trigger no n8n** (verificado em 01/09: a página da doc retorna 404), então o gatilho pela planilha é o caminho.

## As travas que valem registrar

1. **Só entra documento válido.** Dígito verificador de CPF e de CNPJ, calculado no Code. Nada torto chega ao Tiny.
2. **Correção de letra por número.** `O`→`0`, `I`/`l`→`1`, `S`→`5`, `B`→`8` — mas a correção **só é aceita se o resultado passar no dígito verificador** (chance de passar por acaso: 1 em 100). Recuperou 2 respostas reais (`O6000625464`, `O7081408400`).
3. **CEP × CPF trocados.** Achado nos dados: **8 respostas** trazem um CPF válido no campo CEP. Em 7 o CPF também está no campo certo (só o CEP se perdeu); em 1 os dois estão invertidos. O código desinverte quando o campo CPF tem 8 dígitos, e nos outros casos registra "cliente digitou o CPF no campo CEP" na PENDÊNCIAS.
4. **`"Natal"` não vira `"Nat"` + UF `AL`.** A separação cidade/UF exige separador (`/`, `-`, `,` ou espaço). Esse bug existiu na primeira versão e foi pego no teste contra os dados reais.
5. **Campo vazio não é enviado.** Evita que um `contato.alterar` apague dado bom que já estava no Tiny.
6. **Só vira `alterar` com documento idêntico.** O node confere que os dígitos do `cpf_cnpj` devolvido pela pesquisa são exatamente os nossos. Se o Tiny algum dia ignorar o filtro e devolver uma lista larga, a automação **inclui um contato novo** em vez de sobrescrever o cadastro de outra pessoa.
7. **Trava de histórico (a mais importante).** O Code node só processa respostas com carimbo **posterior** à constante `PROCESSAR_A_PARTIR_DE`, no topo do próprio código. Descoberta em 03/09 (ver PARTE I): o Google Sheets Trigger, ao ser executado à mão, entrega **a aba inteira** — 806 items. Sem a trava, um "Execute step" cadastraria 4 anos de respostas no Tiny. Com a trava, 806 barradas e só a nova passa — testado. **Ajustar a data antes de publicar.**
8. **Sem documento nunca vira `alterar`.** Casar por nome sobrescreveria o cadastro de um homônimo. Inclui e avisa na PENDÊNCIAS.
9. **Número e data chegam dos dois jeitos.** Conforme a opção *Value Render* do node do Sheets, uma célula pode vir como texto (`"02/09/2026 11:42:17"`) ou como **número de série** (dias desde 30/12/1899). O helper `dataHora()` converte os dois para `dd/mm/aaaa hh:mm:ss`, e todo o resto passa por `String()` antes de qualquer regex. **Achado na validação de 03/09** — sem isso, o carimbo na PENDÊNCIAS sairia como `46268.48` no modo padrão do n8n. Rodado nos dois modos: resultado idêntico, byte a byte.
10. **Cidade e UF vêm do CEP, não do que o cliente digitou.** Ver PARTE J. Quando a diferença é só de acento a troca é silenciosa; quando a cidade muda de verdade, vira alerta na PENDÊNCIAS.
11. **Pesquisa que falha não vira escrita.** Se `contatos.pesquisa` responder erro que não seja o código 20 (consulta sem registros), a automação **não toca no Tiny** e manda para PENDÊNCIAS. É essa trava que impede duplicação em massa caso o parâmetro `pesquisa` acabe sendo obrigatório (ver PARTE F, teste 1).

---

# PARTE D · MEDIÇÃO CONTRA OS DADOS REAIS

Método do cofre: rodar o código contra os dados de verdade antes de publicar. As 805 respostas foram passadas pelo Code node.

## Veredito do documento

| | Todas as 805 | Últimos 12 meses (75) | 2026 (39) |
|---|---|---|---|
| CPF válido | 686 | 69 | 37 |
| CNPJ válido | 15 | 0 | 0 |
| Vazio | 59 | 0 | 0 |
| Inválido | 45 | 6 | 2 |
| **Aproveitado** | **87,2%** | **93,3%** | **94,9%** |

## Motivos de pendência nos últimos 12 meses (14 de 75 respostas = 19%)

| Motivo | Qtd |
|---|---|
| CPF/CNPJ inválido | 5 |
| Cliente digitou o CPF no campo CEP | 4 |
| CEP não reconhecido | 4 |
| Telefone sem DDD | 2 |
| E-mail em branco | 1 |
| Campos CEP e CPF trocados — desinvertido automaticamente | 1 |

O que é lixo no histórico antigo (191 respostas sem UF, 40 sem e-mail) **não gera pendência hoje**: a coluna `Estado` passou a existir e é obrigatória no formulário.

## Simulação do fluxo inteiro

Com o Tiny simulado (1/3 dos documentos já existindo na base, 5% de recusa):

```
805 normalizadas → 556 incluir / 249 alterar
payloads inválidos: 0
"alterar" sem id ou com sequencia sobrando: 0
linhas de PENDÊNCIAS com coluna faltando: 0
```

---

# PARTE E · A ABA PENDÊNCIAS

Aba nova na **mesma planilha de respostas** (escolha do dono em 01/09). Cabeçalho, na ordem exata:

```
Registrado em | Carimbo da resposta | Nome | Telefone | E-mail |
Documento informado | Documento gravado | Motivo | O que a automação fez |
Erro do Tiny | ID no Tiny | Resolvido?
```

`Erro do Tiny` = `sim` só quando o Tiny recusou ou a pesquisa falhou. É essa coluna que aciona o `stopAndError` no fim do fluxo — a execução fica vermelha em Executions, que hoje ainda é o único alarme que existe (P1).

---

# PARTE F · ROTEIRO DE PUBLICAÇÃO

## F.0 · Pré-requisitos na planilha

1. ✅ **Cabeçalho Q1 renomeado** para `Complemento (antigo - nao usar)` — feito e conferido em 03/09.
2. ✅ **Aba `PENDÊNCIAS` criada** com os 12 títulos da PARTE E, em texto (não fórmula) — feito e conferido em 03/09.
3. ✅ **Planilha compartilhada** com `n8n-domoby@n8n-integracao-504500.iam.gserviceaccount.com` como **Editor** — confirmado em 03/09 no painel Compartilhar. Editor é necessário porque o workflow escreve na aba PENDÊNCIAS.

## F.1 · No n8n

4. Importar `domoby-formulario-cliente-tiny.json`.
5. **Token: nada a colar.** Os dois nodes HTTP já vêm com `{{ $env.TINY_TOKEN }}` — a convenção do P4, mesma do backfill. Confirme no VPS antes de testar:

   ```bash
   docker exec n8n-n8n-1 printenv | grep -E "TINY_TOKEN|N8N_BLOCK_ENV_ACCESS_IN_NODE" | sed -E 's/=.+/=<definida>/'
   ```

   ⚠️ O `sed` no fim não é enfeite: ele esconde o valor. Sem ele o comando **imprime o token na tela**, e foi exatamente assim que o token vazou pela terceira vez em 03/09.

   ✅ **Conferido em 03/09: as duas variáveis estão no container** (`TINY_TOKEN` definida, `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`). Nada a fazer aqui — a menos que o token seja rotacionado (ver P4), e aí muda só o compose.

   Se `TINY_TOKEN` não aparecer: adicionar no bloco `environment:` do `/docker/n8n/docker-compose.yml` (⚠️ variável solta no `.env` é **ignorada** neste template) e `docker compose down && docker compose up -d`.
   Se `$env` não resolver no node, falta `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` no mesmo bloco.
   No editor, o campo do token mostra `[ERROR: not accessible via UI, please run node]` em vermelho — **é cosmético**, o navegador não enxerga variável de ambiente. Em execução resolve.

   ⚠️ É `TINY_TOKEN` (conta 1, Domoby), **não** `TINY2_TOKEN` — essa é a conta 2 (Greenpallets).
6. Reapontar a credencial `Google Service Account account` nos nodes **Gatilho** e **Pendências · registrar** (o JSON traz o nome, não o id).

## F.2 · Testes antes de publicar

## F.2.0 · Teste 0 — a dedupe funciona? ✅ RESOLVIDO em 03/09

A dúvida aberta desde 01/09 era se `contatos.pesquisa.php` responde ao filtro `cpf_cnpj` sozinho — a doc da v2 marca `pesquisa` como obrigatório. **Responde.**

Método: uma linha fixada (`pinData`) no gatilho com o CPF do dono, que já existia no Tiny, e o node de escrita **desativado**. A cadeia inteira rodou com 1 item e `Decidir incluir ou alterar` devolveu:

```
podeDeduplicar : true
acao           : alterar
idTiny         : (o id do contato real no Tiny)
alerta         : (vazio)
```

Ou seja: a pesquisa achou o contato pelo documento, os dígitos bateram na trava de conferência, e o fluxo escolheu **atualizar** em vez de duplicar. **Cliente recorrente não vira contato duplicado.** Nada foi escrito no Tiny nesse teste.

> [!note] O arquivo do cofre é a versão de produção
> A linha fixada tinha o CPF de uma pessoa real, então o `pinData` **foi removido** do JSON depois do teste — o arquivo que fica no cofre pode ser exportado e compartilhado sem carregar token nem dado pessoal. O node de escrita já vem **ativo** nesta versão.

> [!danger] Antes de qualquer teste
> Confirme que `PROCESSAR_A_PARTIR_DE` está com a data de hoje no Code `Normalizar e validar`. É ela que impede um Execute step de despejar o histórico no Tiny — ver PARTE I.

**Não teste dando Execute step direto no node do Tiny.** Cada teste começa por **responder o formulário de verdade**; aí flui exatamente 1 item pela cadeia inteira, do jeito que vai acontecer em produção.

**Teste 1 — resposta nova, CPF válido que ainda NÃO existe no Tiny.**
Esperado: `Normalizar e validar` mostra no Logs `processadas 1`; `Decidir incluir ou alterar` traz `acao: incluir`; contato criado no Tiny com **complemento preenchido** (a armadilha da coluna Q); nada na PENDÊNCIAS.

**Teste 2 — reenvio, mesmo CPF, endereço diferente.**
Esperado: `acao: alterar`, o contato do teste 1 é **atualizado**, não duplicado. A decisão já foi provada no teste 0; aqui se confere que a *escrita* do `alterar` também funciona (payload com `id` e sem `sequencia`).

**Teste 3 — CPF de propósito errado.** Responder com CPF `111.111.111-11`. Esperado: contato criado **sem** documento, `obs` com o aviso, uma linha na PENDÊNCIAS com `Erro do Tiny = nao`.

**Limpeza:** apagar no Tiny os contatos criados nos testes 1 e 3.

> [!danger] O corte é "agora", e "agora" é o relógio de quem responde o formulário
> Erro cometido em 03/09: o corte foi posto em `2026-09-03T00:00` enquanto no relógio local ainda era **02/09 às 23h43**. O corte ficou no futuro e a trava barrou até a resposta de teste — 807 recebidas, **0 processadas**.
> Regra: o corte é sempre um horário **já passado** (alguns minutos atrás), e ainda assim posterior à última resposta real da planilha. Conferir as duas pontas antes de salvar.

## F.3 · Publicação

7. **Reordenar a trava por último.** Terminados os testes, voltar em `PROCESSAR_A_PARTIR_DE` e pôr o horário daquele instante — senão, se o gatilho reler a aba na primeira ativação, as próprias respostas de teste são reprocessadas (a do CPF inválido viraria contato duplicado, porque sem documento não há dedupe).
8. Publicar (Active).
9. Responder o formulário uma vez em produção e conferir em **Executions**.
10. Acompanhar a aba Executions nos primeiros dias e a aba PENDÊNCIAS na primeira semana.

> [!success] Este workflow nasce em dia com o P4
> Nenhum token literal no JSON — dá para exportar e colar em qualquer lugar sem vazar segredo. É o terceiro workflow da fábrica assim, junto com o backfill e o Tiny 2 → PCP.

> [!danger] Se o token do Tiny for rotacionado (P4, 03/09)
> Este workflow **não precisa ser tocado**: ele lê `$env.TINY_TOKEN`. Troca-se o valor no `environment:` do `/docker/n8n/docker-compose.yml`, `docker compose down && docker compose up -d`, e pronto. Quem precisa de edição são os 3 nós antigos com token literal — `pedido.obter` e os 2 do ClickUp → Tiny.

---

# PARTE G · O QUE FICOU DE FORA (de propósito)

- **Seções PF/PJ no formulário.** O dono decidiu manter o formulário. Quando quiser: primeira pergunta "Pessoa física ou jurídica?" com desvio de seção, e validação de formato (expressão regular) no próprio campo — isso mata o CPF torto **antes** de a resposta existir, e a automação vira só o transporte.
- **Recuperar o CEP quando o cliente digita errado.** Daria para consultar ViaCEP e completar bairro/cidade/UF a partir do CEP. Vale quando o volume justificar.
- **Gravar o contato também no Supabase da fábrica.** Faz sentido junto com a P15, não antes.
- **Alerta fora da planilha.** Hoje o sinal é a aba PENDÊNCIAS + execução vermelha. O P1 (não existe alerta de erro) continua aberto para todas as integrações.

---

# PARTE H · O QUE FOI CONFERIDO (03/09/2026)

Validação feita lendo a planilha de produção de volta pela API do Drive e rodando os Code nodes do JSON contra o conteúdo real.

| Item | Como foi conferido | Resultado |
|---|---|---|
| Abas da planilha | leitura do arquivo | `Respostas ao formulário 1` + `PENDÊNCIAS` ✅ |
| Títulos da PENDÊNCIAS | comparação com o Code node, um a um | os 12, na ordem certa, em texto ✅ |
| Cabeçalho Q1 | leitura da linha 1 | `Complemento (antigo - nao usar)`, nenhum nome repetido ✅ |
| Complemento chega | Code node sobre as 806 respostas | 240 respostas com complemento lido ✅ |
| Compartilhamento | painel Compartilhar da planilha | service account como **Editor** ✅ |
| Código nos dois modos do Sheets | rodado com valores em texto e em número/serial | resultado idêntico ✅ |
| Veredito do documento | 806 respostas reais | 688 CPF + 15 CNPJ + 59 vazios + 44 inválidos ✅ |

A última resposta da planilha (02/09, Bruna Rodrigues Carneiro) foi passada pelo fluxo inteiro: CPF válido, nenhum alerta, payload completo com CEP, cidade, UF, telefone formatado e complemento.

> [!warning] Lição de ferramenta (03/09)
> O conector do Google Drive usado aqui devolve **apenas o dono** em `get_file_permissions`, mesmo quando a planilha tem seis pessoas com acesso. **Não usar essa chamada para concluir que algo não está compartilhado** — ela gerou um falso negativo. Para conferir compartilhamento, abrir o painel *Compartilhar* na própria planilha.

---

# PARTE I · INCIDENTE 03/09 — O EXECUTE STEP QUE QUASE VIROU CARGA EM MASSA

**O que aconteceu.** No teste 1 (Execute step só no node `Tiny · contatos.pesquisa`), o painel de entrada mostrou **806 items** vindos de `Dá para cadastrar?`. O node disparou requisições em sequência e morreu no **item 125** com `The connection was aborted, perhaps the server is offline`.

**O que era.** Dois problemas somados:

1. **O Google Sheets Trigger, em execução manual, entrega a aba inteira** — não só as linhas novas. Todo o histórico virou item de entrada.
2. **Estouro do limite do Tiny.** O plano Impulsione dá 60 req/min; 125 chamadas em rajada bateram no teto e a conexão caiu.

**O que NÃO aconteceu, por sorte:** o Execute step roda só aquele node. A falha foi na *pesquisa*, que é leitura. **Nenhum contato foi criado ou alterado no Tiny.** Se o teste tivesse sido feito no workflow inteiro, seriam centenas de contatos gravados de uma vez.

**As duas correções, aplicadas em 03/09:**

| Correção | Onde |
|---|---|
| `PROCESSAR_A_PARTIR_DE` — só passa resposta com carimbo posterior ao corte | topo do Code `Normalizar e validar` |
| `batching` 1 requisição a cada 1200 ms (~50/min, abaixo do teto de 60) | os dois nodes HTTP do Tiny |

Testado: com as 806 respostas históricas mais uma nova, o node registra no Logs
`recebidas 807 | processadas 1 | ignoradas por serem anteriores a 2026-09-03T00:00: 806`.

## I.1 · Segunda pegadinha da mesma sessão — o sufixo "1" nos nomes dos nodes

Ao reimportar o JSON **por cima do workflow que já existia**, o n8n renomeou tudo para `Normalizar e validar1`, `Decidir incluir ou alterar1` etc. Os Code nodes referenciam os anteriores **pelo nome** (`$('Normalizar e validar')`), então uma referência quebrada só apareceria em execução, no meio de um teste.

Duas defesas:

1. **No código:** a função `itemDoNode()` tenta o nome base e os sufixos `1` e `2`, e se não achar nenhum lança uma mensagem que diz o que fazer. Não falha mais em silêncio.
2. **No procedimento:** importar sempre num **workflow novo e vazio**. Se os nomes vierem com sufixo, apagar o workflow e refazer — é mais rápido que caçar referência quebrada.

**Lição que vale para as próximas migrações:** todo workflow com gatilho em planilha precisa de uma trava de data no primeiro Code node. Não dá para confiar que o trigger só entregue linhas novas — nem em teste, nem na primeira ativação.

---

# PARTE J · INCIDENTE 03/09 (2) — O TINY RECUSA A CIDADE

**O que aconteceu.** Primeiro teste de escrita real, com uma resposta de verdade do formulário. O Tiny devolveu:

```
retorno.status                    Erro
registros[0].registro.codigo_erro 31
registros[0].registro.erros[0]    "O nome municipio não foi localizado na lista de cidade"
```

A resposta trazia cidade `Pilar` com UF `RN`. Pilar não existe no Rio Grande do Norte — o CEP informado, `48967-000`, é da **Bahia**.

**A cadeia de alarme funcionou inteira, e é a primeira vez.** `Conferir resposta do Tiny` pegou o erro nos dois níveis (topo e registro), `Precisa de pendência?` desviou, `Pendências · registrar` **escreveu a linha na planilha** — provando de quebra que a credencial da service account funciona para escrita — e `Erro · Tiny recusou` deixou a execução vermelha com a mensagem legível. Nenhum contato entrou torto no Tiny.

## J.1 · O tamanho do problema

As 77 respostas dos últimos 12 meses, com a cidade e a UF como o código as monta:

| Qtd | Cidade / UF | |
|---|---|---|
| 46 | Natal / RN | ✓ |
| 20 | Parnamirim / RN | ✓ |
| 2 | São Gonçalo do Amarante / RN | ✓ |
| 2 | Extremoz / RN | ✓ |
| 1 | Macaíba / RN | ✓ |
| 1 | Lajes / RN | ✓ |
| 1 | Senador Georgino Avelino / RN | ✓ |
| 1 | **Macaiba** / RN | ✗ falta o acento |
| 1 | **Cerro Cora** / RN | ✗ falta o acento (Cerro Corá) |
| 1 | **São Jose de Mipibu** / RN | ✗ falta o acento (José) |
| 1 | **Pilar** / RN | ✗ cidade não existe no RN |

**≈5% seriam recusadas — e três em cada quatro só por acento.** Não é o cliente errando a cidade, é o teclado.

## J.2 · A correção — o CEP passa a mandar

Dois nodes novos entre `Dá para cadastrar?` e a pesquisa no Tiny:

| Node | O que faz |
|---|---|
| `ViaCEP · cidade oficial` | GET `https://viacep.com.br/ws/{CEP}/json/`. Público, gratuito, sem cadastro. `neverError`, timeout 10 s, 2 tentativas |
| `Aplicar cidade do CEP` | Substitui cidade e UF pelas oficiais. Preenche o bairro **só** quando o cliente deixou em branco |

Por que o CEP e não o que foi digitado: é o campo que o cliente mais acerta, e a `localidade` do ViaCEP vem da tabela do IBGE — a mesma base que o Tiny usa.

**Quando avisa e quando fica quieto:**

| Situação | Comportamento |
|---|---|
| `Macaiba` → `Macaíba` (só acento/caixa) | Corrige em silêncio |
| `Natal/RN` → `Natal/RN` (igual) | Nada acontece |
| `Pilar/RN` → `Pilar/BA` (UF muda) | Corrige **e** alerta: "conferir se o CEP está certo" |
| CEP não existe no ViaCEP | Mantém o que o cliente digitou + alerta |
| ViaCEP fora do ar | Mantém o que o cliente digitou + alerta. **A automação não para por causa dele** |

Testado nos cinco cenários acima antes da entrega.

**Efeito colateral bom:** as 250 respostas históricas sem UF passariam a ter UF. E `UF em branco` deixa de virar pendência quando o CEP resolveu.

---

# PARTE K · PEGADINHAS DO NODE DO GOOGLE SHEETS (append)

Duas coisas que quebraram o node `Pendências · registrar` num import limpo, em 03/09:

1. **`columns.schema` é obrigatório.** Com `mappingMode: defineBelow` e `schema: []`, o n8n recusa com `'columns.schema' is required when 'columns.mappingMode' is 'defineBelow'`. Não aparece enquanto alguém não abre o node na interface (aí o n8n preenche o schema sozinho lendo a aba) — então **funciona no workflow em que você mexeu e quebra no import seguinte**.
   **Solução adotada:** `mappingMode: autoMapInputData`. O Code node `Montar linha de pendência` já devolve as chaves com o nome exato das 12 colunas, então não há o que mapear à mão. O `schema` vai preenchido no JSON assim mesmo.

2. **A credencial não vem no export** se o node nunca foi salvo com ela. Ver PARTE H.

3. **O zero à esquerda some — o bug de SKU do Plugga, de novo.** A primeira linha escrita na PENDÊNCIAS gravou o CPF `08735920777` como o **número** `8735920777`. É o mesmo mecanismo do §5.1 do handoff da migração 1: `USER_ENTERED` faz o Sheets interpretar dígitos como número.
   **Solução adotada:** a mesma da migração 1 — apóstrofo inicial no Code node, com `cellFormat: USER_ENTERED`. Blindadas: `Documento informado`, `Documento gravado`, `ID no Tiny` e `Telefone`. O apóstrofo é consumido pelo Sheets e não aparece na célula.

Regra para as próximas: depois de importar um workflow, **abrir cada node de Google Sheets uma vez** antes de testar. E toda coluna de dígitos que vai para planilha precisa da blindagem por apóstrofo.

---

# PARTE L · INCIDENTE 03/09 (3) — O CLIENTE SEM CPF NÃO ERA CADASTRADO

**O que aconteceu.** Teste com CPF `111.111.111-11` (inválido de propósito). O código fez a parte dele: recusou o documento e montou o contato sem `cpf_cnpj`. Mas o fluxo parou antes de escrever no Tiny, com:

```
contatos.pesquisa falhou: [{"erro":"O CPF/CNPJ informado é inválido"}]
```

**A causa.** Sem documento válido, o node de pesquisa mandava o sentinela `00000000000`, na suposição de que o Tiny responderia `codigo_erro 20` ("consulta sem registros"). **Ele não faz isso** — valida o número e devolve erro de documento inválido. Aí `erroPesquisa` ligava, `Pesquisa respondeu?` desviava para `false`, e o contato nunca era criado.

Era o **oposto** da regra aprovada em 13/08: cliente sem CPF válido deve entrar no Tiny sem documento, com aviso. O bug atingia os **59 de 806** casos de campo vazio mais os **44** de documento inválido — 13% das respostas.

**A correção.** Saída antecipada no `Decidir incluir ou alterar`:

```js
if (!n.podeDeduplicar) {
  acao = 'incluir';   // sem documento nao ha o que deduplicar:
                      // a resposta da pesquisa e irrelevante, inclusive se vier como erro
} else if (ret.status === 'OK') { ... }
```

Semanticamente é o certo, não é remendo: sem documento não existe chave de deduplicação, então nada do que a pesquisa responda muda a decisão. E a trava de segurança continua intacta — com documento válido, só vira `alterar` quando os dígitos batem.

Conferido nos seis cenários: sem documento sempre `incluir`; com documento, `alterar` só quando bate, `incluir` quando não bate, e pendência quando a pesquisa quebra de verdade.

---

# PARTE M · O ZERO À ESQUERDA, DO OUTRO LADO

Já tínhamos blindado a **escrita** na aba PENDÊNCIAS (PARTE K). Em 03/09 apareceu o mesmo problema na **leitura**: ao editar a célula do CPF à mão, o Google Sheets trata `08735920777` como número e grava `8735920777`. Dez dígitos → reprovado no dígito verificador → cliente não cadastrado.

O Forms não causa isso (grava como texto), mas **qualquer edição manual da planilha causa** — e foi assim que apareceu.

## M.1 · Nas mãos de quem digita

Duas formas de contornar, na própria planilha:

1. **Apóstrofo antes:** digitar `'08735920777`. O Sheets consome o apóstrofo e guarda como texto.
2. **Melhor, uma vez só:** selecionar a coluna `CPF ` inteira → **Formatar → Número → Texto sem formatação**. A partir daí qualquer coisa digitada ali fica como texto, sem perder zero.

## M.2 · No código, para não depender disso

Função `reporZeroAEsquerda()` no `Normalizar e validar`: quando o documento tem 10, 9 ou 13 dígitos, tenta devolver o zero e **só aceita se o resultado passar no dígito verificador**. Mesma lógica da correção de letra por número — a chance de um número errado passar por acaso é de 1 em 100.

Rodado contra as 807 respostas: **4 documentos recuperados** que antes iam para a PENDÊNCIAS sem cadastro.

```
O6000625464    -> 060.006.254-64
3372186419     -> 033.721.864-19
O7081408400    -> 070.814.084-00
3.558.022.440  -> 035.580.224-40
```

Aproveitamento subiu de 87,2% para **87,5%**. Quando o zero é reposto, entra um aviso na PENDÊNCIAS: *"Documento estava sem o zero a esquerda (a planilha comeu) - reposto e validado"*.

---

# PARTE N · NUNCA MEXER NA ABA DE RESPOSTAS

> [!danger] Apagar linha da aba `Respostas ao formulário 1` faz o gatilho engolir respostas em silêncio
> O Google Sheets Trigger guarda no próprio node **quantas linhas já viu**. Se a planilha encolhe, ele fica esperando o número voltar a passar do valor antigo — e as respostas nesse intervalo **não disparam nada**. Sem erro, sem execução vermelha, sem linha na PENDÊNCIAS.
> Exemplo real de 03/09: contador em 812, cinco linhas de teste apagadas → planilha em 807. As **cinco próximas respostas de cliente** cairiam nas linhas 808-812 e seriam ignoradas.

## N.1 · Como limpar teste, então

| Onde | O que fazer |
|---|---|
| Contato de teste no Tiny | Apagar normalmente |
| Linha na aba `PENDÊNCIAS` | Apagar normalmente — essa aba o gatilho não lê |
| Linha na aba `Respostas ao formulário 1` | **Não apagar.** Se incomodar visualmente: botão direito → **Ocultar linhas** (a linha continua contando) |

A trava `PROCESSAR_A_PARTIR_DE` já garante que resposta antiga nunca é reprocessada. Não existe motivo operacional para mexer na aba de respostas.

## N.2 · Se precisar mesmo apagar (só antes de publicar)

1. Despublicar o workflow.
2. Excluir as linhas na planilha (botão direito → **Excluir linhas**, não apagar conteúdo).
3. **Apagar o node do gatilho e criar um novo** — o contador vive dentro do node, então node novo é contador zerado. Reconectar no `Normalizar e validar`.
4. Ajustar `PROCESSAR_A_PARTIR_DE` para o momento.
5. Salvar e publicar.

## N.3 · Por que o Forms deixa buracos

O Google Forms guarda o ponteiro da última linha que escreveu e **não reaproveita linha**. Apagar só o *conteúdo* das linhas 808-811 não faz ele voltar: a resposta seguinte foi para a **812**, deixando quatro linhas vazias no meio. Isso é inofensivo para a automação — o `Normalizar e validar` pula linha sem carimbo e sem nome — mas é feio e cresce. Excluir a linha inteira resolve; apagar o conteúdo não.

## Ver também

[[N8N - Visao Geral da Migracao]] · [[N8N - API Tiny v2 vs v3]] · [[N8N - Tiny Integracoes Referencia]] · [[N8N - Pendencias e Riscos]]
