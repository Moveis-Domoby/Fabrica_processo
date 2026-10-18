---
titulo: Handoff — 2026-10-17 · SESSAO-33 · Tiny completo (todos os dados, atualizados quando algo acontece)
tipo: handoff
data: 2026-10-17
atualizado: 2026-10-17
tags: [handoff, sessao, sessao-33, tiny, n8n, integracao, api-v2, api-v3, webhooks, carga, conferencia, estrutura, insumos, desempenho]
---

# 📋 Handoff — 17/10/2026 · SESSAO-33 · Tiny completo

> [!success] Entregue em arquivo — sessão na nuvem, com o dono fora de casa
> Pedido do dono (16/10, pelo celular): *"puxar de uma vez TODOS os dados do Tiny, sem exceção (...) pelo n8n, melhorando a automação que já existe (...) e deixar o Tiny atualizando sempre que algo for atualizado lá — sem ficar procurando de 1 em 1 minuto"*. Daqui não se alcança o n8n nem o Tiny (o token nunca vem para cá — regra 4): **tudo o que precisa do n8n ou do banco está pronto em arquivo, com o passo a passo abaixo**. Depois do plano aprovado: *"para de me perguntar, só faz, eu não tô em casa"* — nenhuma pergunta depois disso (E-109).

**Branch:** `claude/sessao-33-tiny-completo-s3gukn` (a da nuvem), saída da `main` = **d9f61c9**. ⚠️ **O envio ao GitHub está recusado nesta sessão** (403 — o aplicativo do Claude sem acesso à organização): os commits estão na máquina da nuvem e numa cópia em pacote (`sessao33.bundle`, enviada ao dono na conversa). ↪️ **17/10 22:49 UTC: o dono liberou o aplicativo do Claude na organização e a branch subiu ao GitHub.** **Demanda:** [[SESSAO-33 - Tiny Completo - Todos os Dados Atualizados por Evento]]. **Memória:** [[SESSAO-33]]. **Banco:** migration **88 aplicada** (16/10, com o OK); **89 a 92 aplicadas em casa em 17/10 ~22:56–22:58 UTC** (com o OK do dono, pelo aplicador, integração idêntica — [[SESSAO-33]]). **No ar com o OK do dono:** a imagem de teste do 13622 retirada, a rolagem das conferências (88) e o login com a mensagem de desativado (função `autenticacao` v11).

## ▶️ Para ligar em casa (nesta ordem)

> Tudo com o Claude Code no computador de casa (é onde moram a chave do n8n e o acesso ao banco). Cada passo diz como conferir.

1. ✅ *(17/10 22:49 UTC — no GitHub e no computador de casa; a revisão e a junção na `main` vão no passo 5)* **Devolver o acesso ao GitHub e trazer a branch.** No claude.ai → Configurações → Conectores → GitHub: reconectar (e, se pedir, instalar o aplicativo do Claude na organização Moveis-Domoby). Depois, na conversa desta sessão, pedir "manda para o GitHub" — ou, se a máquina da nuvem já tiver ido embora, entregar o arquivo `sessao33.bundle` ao Claude Code de casa: `git fetch sessao33.bundle claude/sessao-33-tiny-completo-s3gukn:sessao-33-tiny-completo`. **Revisar na conversa e juntar na `main`** (D-20). Commits com o autor `contatodomoby` (E-33 — é o que a Vercel publica).
2. ✅ *(17/10 — TUDO VERDE; telas 199; tipos limpos)* **Antes do banco:** `npm run test:banco` → "TUDO VERDE" (1.042). Conferir que ninguém regravou a tabela de tokens: **não rodar de novo `supabase/manutencao/2026-09-15_carga_comercial.mjs`** — ele apaga a `tiny_auth` inteira, e agora ela terá duas linhas (loja e fábrica).
3. ✅ *(17/10 ~22:56 UTC, pelo conector — índice válido)* **O índice único novo da fila, sem travar** (fora de transação, no SQL do painel ou pelo aplicador):
   ```sql
   alter table public.tiny_fila add column if not exists conta text not null default 'loja';
   create unique index concurrently if not exists tiny_fila_conta_chave_uq on public.tiny_fila (conta, recurso, chave);
   ```
4. ✅ *(17/10 ~22:56–22:58 UTC — as 4 com a integração idêntica e as mesmas contagens; nenhuma porta do site publicado muda, então o site sobe depois sem quebrar a tela de hoje — conferido)* **As 4 atualizações do banco, uma por vez, no mesmo gesto do site** (E-73):
   `npm run banco:aplicar -- --confirmar --so 20261017010000_plt_tiny_fila_duas_contas.sql` → `…20261017020000_plt_tiny_cascata_avisos_carga.sql` → `…20261017030000_plt_tiny_api_nova_fabrica.sql` → `…20261017040000_plt_produtos_estrutura_unidades.sql`. **Conferir:** integração idêntica (a impressão digital que o aplicador mostra); `select count(*) from tiny_fila where conta = 'loja'` = o total de antes (26.731 em 17/10); o fluxo antigo do n8n continua rodando a conferência das 3h normalmente (ele só pega o que sabe montar: a loja, os 8 tipos de sempre e as linhas sem a marca de origem). ⚠️ **Fazer o passo 7 (n8n) logo em seguida:** as linhas novas (a cascata da venda, com o filtro do CPF e da origem da conta) esperam o fluxo novo — até lá o relógio da fila acorda o fluxo antigo a cada minuto à toa.
5. ✅ *(17/10 23:15 UTC — `main` dc13cf9, Vercel "success"; as três telas conferidas nos arquivos publicados e abertas no site como o dono — fotos abaixo)* **O site:** juntar na `main` → a Vercel publica. **Conferir:** Super admin → Auditoria → aba **"Carga do Tiny"** abre (vazia, "Ainda não houve contagem"); Configurações → Móveis, insumos e peças → botão **"Estrutura"** em cada produto e **"Unidades fora do padrão" → "Ver a lista"**; Configurações → API e integrações → seção **"API nova do Tiny da fábrica"** (só para o dono).
6. ✅ *(17/10 ~23:05 UTC, pelo conector — v1, `verify_jwt` desligado; texto idêntico ao do repositório; fumaça de fora ok)* **As duas funções novas** (com `verify_jwt` desligado — a ponte confere a chave pelo banco; a volta do Tiny não traz login):
   `npx supabase functions deploy tiny-v3 --no-verify-jwt` · `npx supabase functions deploy tiny-fabrica-token --no-verify-jwt`.
7. ✅ *(17/10 23:14 UTC — a fila NO AR com 23 nós; o alerta `PWB9rkXQgLlKEWqN` publicado e ligado na fila, na fábrica e nas vendas; os três sem rascunho pendente antes da troca)* **O n8n** (no computador de casa, onde está o `.env.n8n`):
   - `node supabase/manutencao/2026-10-17_n8n_fila_tiny_completo.mjs` — **só mostra** o que muda no fluxo "subir banco de dados — tiny → supabase" (a 1ª parte troca; a 2ª — situação do pedido — e o endereço da fila ficam iguais). Conferir que o fluxo do ar é o mesmo do cofre (A-44).
   - `… --aplicar` — guarda cópia em `.n8n-backups/`, troca a 1ª parte, **publica** e confere que a versão publicada é a nova (A-53).
   - `… --alerta` — cria e publica o fluxo do alerta de erro e liga o "fluxo de erro" na fila do Tiny, no fluxo da fábrica e no das vendas.
   - **Conferir no n8n:** as variáveis `SUPABASE_FABRICA_URL`, `SUPABASE_FABRICA_KEY`, `TINY_TOKEN` e `TINY_FABRICA_TOKEN` existem (os fluxos de hoje já usam). Uma execução de teste do alerta (forçar um erro num fluxo de teste) → aviso no sino.
8. **No Tiny da loja** (Configurações → Webhooks/Notificações): ligar **"notas fiscais autorizadas"** apontando para o MESMO endereço que já está em "pedidos enviados" (`…/webhook/5b0fc553-894d-4dec-bee8-e033b5b844a8`). A partir do fluxo novo, esse endereço passa a responder (o 404 de hoje acaba — pendência P5). **Conferir:** emitir uma nota → `select tipo, payload from eventos where tipo = 'aviso_tiny' order by id desc limit 1` (o 1º aviso de cada tipo mostra o formato real — F-05).
9. **A carga (Auditoria → Carga do Tiny):** **"Contar no Tiny"** → em alguns minutos "Atualizar": cada tipo com "no Tiny × aqui" (a loja mês a mês desde 2025). → **"Começar a carga"** (leva horas; vai sempre atrás das vendas e da conferência; "Pausar"/"Retomar" quando quiser). → Quando a fila esvaziar, **"Contar no Tiny" de novo** → "bateu"? As contas a pagar aparecem com a soma mês a mês. → **"Ligar a consulta de hora em hora"** (8h às 20h — D-143).
10. ✔️ *(conferido em 17/10: todo mundo que lê a tabela do token — as funções publicadas, as do banco, os relógios — pega a conta pelo número, então a linha da fábrica não atrapalha a da loja. Cuidados: nunca rodar de novo a carga do comercial de 15/09, que apaga a tabela inteira; e o modo de teste manual do renovador da loja grava sempre na linha da loja — nunca mandar a ele o token da fábrica)* **A API nova da fábrica:** no Tiny da FÁBRICA → Configurações → Aplicativos (API v3) → criar o aplicativo com o endereço de volta `https://axnzldwgwsmepukdiljx.supabase.co/functions/v1/tiny-fabrica-token`; no painel da Supabase → Edge Functions → Secrets: `TINY_FABRICA_CLIENT_ID` e `TINY_FABRICA_CLIENT_SECRET` (o dono digita lá — **nunca no chat**, regra 4). Então Configurações → API e integrações → **"Ligar a API nova da fábrica"** → entrar no Tiny com o usuário da fábrica → permitir → volta com "API nova da fábrica ligada". **Conferir:** a aba Carga do Tiny mostra "fábrica: ligada"; daí em diante a contagem e a carga incluem depósitos, pedidos de compra, marcas, categorias financeiras, formas de pagamento e as etapas de produção.
11. **Depois de a consulta de hora em hora rodar com a API nova:** desligar o nó "a cada 15 min" do fluxo da fábrica (dívida 21 da lei) — a varredura das 03:15 fica como rede.
12. **Pendências antigas que seguem com o dono:** testar o login com uma pessoa desativada de teste (a mensagem clara só aparece para quem acertou a senha); o gancho do token (`supabase/pendentes/2026-10-16_gancho_do_token.sql` — ligar a chave assimétrica e o gancho no painel).

## Telas no ar (17/10, em casa — abertas pelo dono no Chrome)

**Auditoria → Carga do Tiny** (a fila vazia, ainda sem contagem, a consulta de hora em hora desligada; a API nova: loja ligada, fábrica desligada):

![[sessao33_carga_do_tiny.jpg]]

**Configurações → Móveis, insumos e peças → Unidades fora do padrão** (40 para padronizar no Tiny, com páginas):

![[sessao33_unidades_fora_do_padrao.jpg]]

**Configurações → Móveis, insumos e peças → Estrutura** (antes da carga, o aviso de que a estrutura chega com ela):

![[sessao33_estrutura_do_produto.jpg]]

**Configurações → API e integrações → API nova do Tiny da fábrica** (o botão, só para o dono — não tocado):

![[sessao33_api_nova_fabrica.jpg]]

## 1. Objetivo da sessão

Todos os dados do Tiny, das duas contas (loja e fábrica), **sem exceção** — clientes, fornecedores, peças, insumos, produtos e a estrutura dos fabricados, estoque por depósito, valores, contas a pagar e a receber, notas, vendedores, formas, listas de preço, categorias, compras —, trazidos **pela automação que já existe** (sem fluxo paralelo) e **atualizados quando algo acontece** (sem relógio de minuto em minuto). Antes: a pesquisa aprofundada (o que o Tiny avisa e o que não avisa — [[N8N - Tiny - Mapa Completo da API e dos Dados]]) e o plano para o OK do dono.

**Respostas do dono no plano (16/10 → D-143):** plano aprovado **inteiro** (inclusive a API nova da fábrica); o que o Tiny não avisa (produtos e clientes alterados) → **uma vez por hora, só das 8h às 20h**; a baixa dos insumos por etapa → **próxima sessão, insumo → setor**; liberadas: tirar a imagem de teste do 13622, aplicar a rolagem das conferências, publicar o login com a mensagem de desativado. O §4 (rotinas de minuto em minuto) fica para a próxima.

## 2. O que foi feito

### §1 (respostas de 16/10)
- **D-141/D-142** no cofre; **D-143** (o plano e as respostas).
- **Login:** a pessoa desativada é recusada já no login, com mensagem clara (só para quem acertou a senha) — função `autenticacao` **v11 publicada** (16/10 ~00:25 UTC, com o OK).
- **Auditoria → Conferências com o Tiny por rolagem** (migration 88, **aplicada** com o OK — pelo conector, sem o `DROP`: E-108).
- **A imagem de teste do 13622** retirada pelo caminho normal (16/10 23:41 UTC, com o "pode"; 1 fato na trilha).

### Banco (em arquivo — 89 a 92; detalhe em [[SUPA - Esquema do Banco]])
- **89 — a fila de tudo, nas duas contas:** `tiny_fila` com `conta` e `nao_antes`, 29 tipos, único por conta, índice de trabalho por conta e vez; o catálogo (`fn_tiny_recursos`), **o lote com a chamada montada** (`fn_tiny_fila_lote`) e **a resposta entendida no banco** (`fn_tiny_fila_resposta` — v2 e v3; vazio não é erro; limite espera sem gastar tentativa; "não existe" encerra; o resto tenta 2/4/8 min e na 4ª avisa); `plt_tiny_registros` (o que não tem casa — grava só se mudou) + o resumo do mês das contas a pagar; `plt_produto_componentes` (a estrutura); `plt_tiny_controle` (o interruptor da pausa) e `plt_tiny_carga_contagem` (as contas prontas da carga, pelos gatilhos da fila); o alerta das automações (`plt_fn_automacao_erro`). **O fluxo antigo segue funcionando** até o novo ser importado.
- **90 — na hora e a carga:** a **cascata** (gatilho blindado em `pedidos`: a nota, as contas a receber pela origem e o cliente pelo CPF entram na fila quando a venda é gravada); os **avisos** de nota/envio (`plt_fn_tiny_aviso`); a **consulta de hora em hora** 8h–20h (`plt_fn_tiny_mudancas_ligar`); **contar / carregar / pausar / retomar** (`plt_fn_tiny_carga`) e o **painel** (`plt_fn_tiny_carga_painel` — uma requisição, só lendo o pronto); o relógio da fila que não acorda pela carga pausada.
- **91 — a API nova da fábrica:** `tiny_auth` com a linha 2 e o **renovador próprio** (um por credencial — A-18); **92 — Configurações:** a estrutura de cada produto e as unidades fora do padrão.
- **Bateria: 1.042 verdes** (o bloco "Tiny completo" inteiro, inclusive o código dos nós do JSON do n8n contra o banco de ponta a ponta).

### Edge Functions (publicadas em 17/10 ~23:05 UTC, em casa — v1)
- **`tiny-v3`** — a ponte segura para a API nova: só leitura, só a lista de caminhos, o token lido no banco com a chave de quem chama (o n8n nunca vê o token), 30 s de tempo limite, nunca renova.
- **`tiny-fabrica-token`** — autorizar (pelo botão do site; `state` assinado de 15 min) e renovar (só pelo relógio próprio de 3 em 3 h, com a vez reservada; falha → aviso ao dono). A volta do Tiny sempre devolve o dono ao site com o motivo.

### n8n (em arquivo — `_docs/Fabrica n8n/`)
- **`domoby-fila-tiny-completo.json`** — o "subir banco de dados — tiny → supabase" melhorado: lote → Tiny (v2 com o token da conta; v3 pela ponte) → resposta ao banco; 1 chamada a cada 2 s; + o webhook dos avisos no caminho que o Tiny já chama. A 2ª parte (situação do pedido) intacta; os nós `Normalizar evento` e `Tiny · pedido.obter` não mudam (estão no fluxo das vendas).
- **`domoby-alerta-erro-automacoes.json`** — o alerta de erro (P1) → sino do dono + Auditoria.
- **`supabase/manutencao/2026-10-17_n8n_fila_tiny_completo.mjs`** — mostra a diferença, aplica com cópia e confere a publicação, liga o alerta; simulação sem rede provou a 2ª parte idêntica.

### Front
- **Auditoria → "Carga do Tiny"** (nova aba): a fila agora + "Atualizar"; Contar no Tiny / Começar a carga / Pausar / Retomar; "Bateu com o Tiny?" por conta e tipo, com o mês a mês; as somas das contas a pagar; a carga tipo por tipo; os últimos erros; a consulta de hora em hora (ligar/desligar); a API nova de cada conta.
- **Configurações → Móveis, insumos e peças:** "Estrutura" por produto (do que é feito e onde é usado) e "Unidades fora do padrão" (com páginas) — as duas só no clique.
- **Configurações → API e integrações:** "Ligar a API nova da fábrica" (só o dono) e o aviso na volta do Tiny.
- Testes de tela novos (Auditoria com a aba da carga; Configurações; Integrações). **36 arquivos, 199 testes verdes** (eram 34/191); tipos e estilo limpos.

### Desempenho (regra 18) — ensaio ×100 antes de subir
- Banco local com as 92 atualizações e **100× o volume de hoje + 3 milhões de linhas da carga na fila**. A 1ª versão já falhava no volume de hoje em três pontos (pausar linha a linha, a fila varrendo as pausadas, o painel contando a fila) — **corrigido antes de subir** (índice por conta e vez, pausar = interruptor, contas prontas, resumo do mês, "quantos aqui" calculado quando a contagem chega).
- **×100 depois:** lote 4–5 ms · "tem trabalho?" 0,4–1 ms · relógio 0,6 ms · pausar 3,7 ms · retomar 1,1 ms · venda gravada com a carga pausada 1,9 ms · resposta 1,5/16 ms · **painel 13 ms**. Fora do teto (dívidas na lei, com o porquê): unidades fora do padrão com o catálogo ×100 (117–139 ms; hoje 3 ms — dívida 13) e "Começar a carga" ×100 (4,5 s; gesto único, hoje 50 ms — dívida 22).
- **Pacote:** JS inicial **219,6 → 219,6 KB** comprimidos (teto 250); pedaços: Auditoria 4,8 → 7,8 KB · Configurações de produtos 2,6 → 4,1 KB · Integrações 2,9 → 3,7 KB.

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| A lógica toda no banco (o banco monta a chamada e entende a resposta); o n8n só pede e devolve | Um fluxo do n8n com um ramo por tipo de dado | Um lugar só, versionado e provado pela bateria; o n8n vira executor genérico; a regra "melhorar a automação que existe" sem multiplicar nós |
| A API nova pela ponte `tiny-v3` (o token mora no banco) | Token da API nova numa variável do n8n | O token nunca aparece no n8n nem no histórico das execuções (regra 4); a ponte nunca renova (A-18) |
| Renovador próprio da fábrica (`tiny-fabrica-token`) | Reaproveitar o renovador da loja | Um renovador por credencial (A-18/E-07) |
| O que não tem casa vai para `plt_tiny_registros` (cru, grava só se mudou) | Uma tabela por tipo de dado | Banco enxuto (D-47); ganha tabela própria quando uma tela precisar |
| "Pausar" = interruptor (a fila não pega a prioridade 9) | Marcar cada linha da carga como pausada | O ensaio ×100 mostrou ~80 s para pausar 3 milhões de linhas (acima do tempo da requisição); o interruptor é instantâneo |
| O "quantos aqui" calculado quando a contagem do Tiny chega | Contar no abrir do painel | Contar no abrir custava 393 ms já hoje; a contagem é um retrato — depois da carga, conta-se de novo |
| Avisos de nota/envio no mesmo caminho que o Tiny já chama | Caminho novo | Conserta o endereço morto (P5) sem mexer na configuração do Tiny além de ligar "notas autorizadas" |

## 4. Bugs

### Resolvidos
- P1 (alerta de erro inexistente) e P5 (endereço morto dos pedidos enviados) — resolvidos em arquivo; valem quando o passo 7 rodar. ↪️ **17/10 23:14 UTC: passo 7 rodado — no ar** ([[N8N - Pendencias e Riscos]]).

### Descobertos
- **E-108:** pelo conector da Supabase, comando com `DROP` fica esperando confirmação e estoura em 60 s — aplicar pelo conector é sem `DROP`.
- **E-109:** perguntas demais ao dono longe de casa — uma rodada só.
- **E-110:** a formatação reescreveu a bateria inteira (18 mil linhas de espaço) — corrigido; conferir `git diff --numstat` antes de commit.
- Na escala: os três pontos do ensaio ×100 (acima) — corrigidos antes de subir.

## 5. Arquivos alterados

```
supabase/migrations/20261016130000_plt_auditoria_conferencias_por_cursor.sql   (88 — aplicada)
supabase/migrations/20261017010000_plt_tiny_fila_duas_contas.sql               (89)
supabase/migrations/20261017020000_plt_tiny_cascata_avisos_carga.sql           (90)
supabase/migrations/20261017030000_plt_tiny_api_nova_fabrica.sql               (91)
supabase/migrations/20261017040000_plt_produtos_estrutura_unidades.sql         (92)
supabase/testes/testar-migrations.mjs
supabase/functions/autenticacao/index.ts        (v11 — publicada)
supabase/functions/tiny-v3/index.ts             (nova — publicada em 17/10)
supabase/functions/tiny-fabrica-token/index.ts  (nova — publicada em 17/10)
supabase/manutencao/2026-10-16_tirar_imagem_teste_13622.sql (a retirada da imagem de teste — rodada com o "pode")
supabase/manutencao/2026-10-17_n8n_fila_tiny_completo.mjs
_docs/Fabrica n8n/domoby-fila-tiny-completo.json · domoby-alerta-erro-automacoes.json
src/auditoria/PainelCargaTiny.tsx (novo) · src/auditoria/api.ts · src/auditoria/rotulos.ts
src/paginas/Auditoria.tsx · Auditoria.test.tsx
src/paginas/ClassificacaoProdutos.tsx · ClassificacaoProdutos.test.tsx (novo)
src/logistica/classificacao.ts · src/logistica/componentes/EstruturaDoProduto.tsx · UnidadesForaDoPadrao.tsx (novos)
src/paginas/AdminApi.tsx · AdminApi.test.tsx (novo) · src/admin/api.ts
.gitignore (.n8n-backups/)
```

## 6. Impacto nos números visíveis

> [!warning] Depois da carga
> - **Auditoria → Atividade** passa a mostrar as linhas "Erro numa automação" e os gestos da carga (grupo das automações).
> - **Clientes:** os que nasceram só do pedido ganham o cadastro do Tiny (nome, endereço, telefone) — pode mudar o nome mostrado de alguns clientes (o cadastro do Tiny vence, D-98).
> - **Notas fiscais:** as que pararam em 08/09 e as ~150 que algum pedido aponta e não tínhamos passam a existir — quem conta notas por mês vê os meses de set/out completos.
> - **Estoque:** nada muda nas contas de móveis (a carga do estoque por depósito vai para os registros, sem tocar o que o estoque mostra hoje).

## 7. Notas do cofre atualizadas

- [[PLT - Decisoes de Produto]] (D-141, D-142, D-143) · [[PLT - Memoria de Aprendizado]] (E-108, E-109, E-110) · [[PLT - Lei de Desempenho e Escala]] (exceção da consulta de hora em hora; dívidas 13, 20, 21, 22; o andamento da 33) · [[SUPA - Esquema do Banco]] (88 a 92; a `tiny_fila`) · [[N8N - Tiny - Mapa Completo da API e dos Dados]] (nova) · [[N8N - Backfill Historico do Tiny]] · [[N8N - Pendencias e Riscos]] (P1, P5) · [[SESSAO-33 - Tiny Completo - Todos os Dados Atualizados por Evento]] (resultado) · [[SESSAO-33]] (execução) · [[000 - ORDEM DAS SESSOES]] · [[000 - PROXIMOS PASSOS]] · [[000 - MAPA DO PROJETO]].

## 8. Ficou pendente

### Aguardando decisão de negócio
- **Duas coisas ficaram como "a próxima sessão"** pelo dono: (a) as rotinas do banco de minuto em minuto passarem a nascer do fato (o §4 do pedido de 16/10 — já aprovado na D-141; o disparo nunca pode rodar em dois lugares) e (b) a baixa dos insumos por etapa, amarrando cada insumo ao setor que o consome (D-143). **Qual vem primeiro é do dono.**
- **O que conferir em casa sobre o Tiny** (a documentação oficial é bloqueada nesta nuvem): a lista do §8 do [[N8N - Tiny - Mapa Completo da API e dos Dados]] — a especificação v3 de hoje, as chaves de aviso de cada conta, as extensões instaladas, o limite real de cada conta.

### Achado na 1ª contagem (18/10, em casa) — a corrigir com o OK do dono
- O plano do Tiny da **loja** só aceita datas dos **últimos 2 anos** (código 31 — "a partir de 18/10/2024"): as janelas "antes de 2025" da contagem da loja falham. A fábrica aceita 2015. Correção: começar no piso do plano e tratar o código 31 como resposta final.
- O aplicativo da API nova da **loja** (o do Comercial) não tem "Ordem de Compra" (403): pedir compras pela API nova só na fábrica e tratar o 403 como "sem permissão", sem insistir. (Dar a permissão ao aplicativo da loja exigiria reautorizá-lo — mexe no Comercial.)

### Próximo passo sugerido
- Os passos "Para ligar em casa" (acima), na ordem. Depois da carga e de "bateu", a próxima sessão escolhida pelo dono.

## 9. Como validar

```sql
-- depois do passo 4: a fila antiga intacta, com a conta
select conta, status, count(*) from public.tiny_fila group by 1, 2 order by 1, 2;
-- o interruptor e as rodadas
select * from public.plt_tiny_controle;
-- depois de "Começar a carga": as contas prontas batem com a fila
select c.rodada, c.conta, c.recurso, c.status, c.n,
       (select count(*) from public.tiny_fila f where f.params->>'carga' = c.rodada and f.conta = c.conta
           and f.recurso = c.recurso and f.status = c.status) as na_fila
  from public.plt_tiny_carga_contagem c
 where c.rodada = (select ultima_carga from public.plt_tiny_controle) and c.n <> 0;
-- os avisos que chegaram (o formato real do 1º de cada tipo)
select id, payload from public.eventos where tipo = 'aviso_tiny' order by id desc limit 5;
-- os erros das automações (o alerta)
select criado_em, contexto->>'titulo', contexto->>'corpo' from public.plt_logs_atividade
 where acao = 'automacao_erro' order by criado_em desc limit 10;
```
