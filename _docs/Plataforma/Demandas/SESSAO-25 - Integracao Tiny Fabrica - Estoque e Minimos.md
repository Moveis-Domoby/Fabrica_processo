---
titulo: "SESSAO-25 — Estoque da fábrica: Tiny, saldo, mínimos e lançamento manual"
tipo: demanda
status: entregue
data: 2026-09-18
atualizado: 2026-09-26
tags: [plataforma, demanda, bloco-5, estoque, tiny, n8n]
---

# 🎯 SESSAO-25 — Estoque da fábrica: Tiny, saldo, mínimos e lançamento manual

> [!danger] DUAS COISAS ANTES DE COMEÇAR
> **1. A ordem mudou (24/09/2026, D-53):** esta sessão roda **ANTES da [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]]** — pedido do dono ("preciso do estoque entregue com urgência"). Dependência real: **SESSAO-22** (entregue). **Não esperar a 24.**
> **2. A metade da integração JÁ ESTÁ PRONTA E EM PRODUÇÃO** (21–23/09, Cowork + dono). **Não reavaliar caminho de integração, não pesquisar alternativa de API, não criar tabela de produto, não mexer no workflow do n8n.** Detalhe em [[N8N - Tiny Fabrica Produtos para Banco]] e [[N8N - Tiny Fabrica - Estudo do Cadastro]].
>
> Esta demanda é **o estoque inteiro**: o que era "estoque" na 24 (item sem dono, lançamento manual, a tela) foi **movido para cá** em 24/09 para que a entrega seja completa numa sessão só. A 24 ficou com as **consequências da produção e do cancelamento** e roda depois, consumindo o que esta entrega.

## 1. O que JÁ EXISTE (não refazer)

| Peça | Estado | Onde |
|---|---|---|
| Conta Tiny da fábrica | **FábricaDomoby, CNPJ 27.556.613/0001-66**, plano **Evoluir** (60 req/min), login `lojadomoby` | [[N8N - Tiny Fabrica - Estudo do Cadastro]] |
| Token v2 | no compose do n8n como **`TINY_FABRICA_TOKEN`** (nunca em chat/print/nota — E-03) | VPS `/docker/n8n/docker-compose.yml` |
| Workflow n8n | **`Domoby · Tiny FÁBRICA → produtos no Supabase`** — ATIVO desde 23/09. Produto novo a cada 15 min (`produtos.pesquisa` + `dataCriacao` → `produto.obter`), varredura do catálogo às 03:15, webhook de estoque | `Fabrica n8n/domoby-tiny-fabrica-produtos.json` |
| Tabela **`produtos`** | **487 produtos carregados** (169 F · 181 M · 109 S · 27 K · 1 V + 2 filhos). PK = `tiny_id`; `codigo` (SKU) pode faltar/repetir; `classe`, `tipo_variacao`, `id_produto_pai`, `unidade` **normalizada**, `estoque_minimo`, `estoque_maximo`, `situacao`, `raw` | migration 23 · [[SUPA - Esquema do Banco]] |
| RPC **`fn_upsert_produto(p jsonb)`** | porta única do n8n; idempotente; só grava quando o `raw` muda | migration 23 |
| Tabela **`eventos`** | ganhou `payload jsonb`; tipos **`produto_fabrica`** e **`estoque_fabrica`** | migration 23 |
| Webhook "lançamentos de estoque" | **LIGADO no Tiny em 23/09** e testado (entrada e balanço) | abaixo |
| Estoque da plataforma (base) | **`plt_fn_estoque`** (lista), **`plt_fn_pedidos_aguardo`**, `plt_cards.id_producao`, terminal ESTOQUE, Danificados | SESSAO-15 (entregue) |

**Payload real do webhook de estoque** (capturado em 23/09 — a Olist não documenta; F-05 fechado):

```json
{ "versao": "1.0.1", "cnpj": "27556613000166", "tipo": "estoque",
  "dados": { "idProduto": 947854547, "sku": "TESTE-INT-01", "nome": "…", "saldo": 2 } }
```

> **Ele manda o SALDO RESULTANTE, não o movimento** — sem tipo (entrada/saída/balanço), sem quantidade, sem depósito. Entrada manual e balanço produzem o mesmo formato. **O espelho de saldo pode ser alimentado pelo aviso, sem consultar a API a cada movimentação.**

## 2. O que esta sessão entrega

### A. Saldo do Tiny dentro da plataforma
1. **Projeção do saldo** a partir dos eventos `estoque_fabrica` que já chegam em `eventos.payload` (`dados.idProduto` → `produtos.tiny_id`, `dados.saldo`). Onde vive o saldo é a pergunta 1 ao dono — **regra do banco enxuto: antes de criar tabela, ver se `produtos` resolve com 2 colunas**.
2. **Saldo negativo vira 0** (D-53 / decisão do dono, 23/09): *"não existe ter −2 mesas em estoque"*. Na leitura, `greatest(saldo, 0)`; o valor cru fica no evento (nada se apaga — RNF-05). A **causa** (OP baixa a estrutura sem entrada nas peças) é [[N8N - Pendencias e Riscos#P16]] e **o dono trata depois, no Tiny** — não corrigir por automação, não lançar estoque no Tiny.
3. **Carga inicial do saldo**: o webhook só traz o que se mover daqui para a frente. Para partir com o saldo atual, ler uma vez `produto.obter.estoque.php` por produto **ou** aceitar que o saldo nasce vazio e se preenche no uso — decidir com o dono (pergunta 5).

### B. Estoque da plataforma (movido da SESSAO-24 em 24/09)
4. **Item com pedido × item sem dono**: a lista de Estoque passa a distinguir os dois. O item **sem dono** guarda o produto (código/SKU + descrição, de onde saem cor e dimensões) e a **história de onde veio** (lançamento manual, cancelamento, alocação devolvida).
   ⚠️ Terreno: `plt_cards` **não tem FK para `pedido_itens`** e não deve ganhar — o `fn_upsert_pedido` apaga e regrava itens. O card de estoque sem dono carrega o produto em **colunas próprias**; se vincular a `produtos`, use `tiny_id`.
5. **Lançar produto em estoque pela plataforma, sem Tiny**: ação (logística e admin) que cria um item sem dono informando o produto. Nasce como evento append-only, origem clara "lançamento manual", com log (D-40). *(Fecha a **Q-23** junto com o fluxo de cancelamento que fica na 24.)*
6. **Tela de Estoque de verdade**: por produto, **saldo (Tiny) · itens na plataforma (com dono / sem dono) · mínimo · sinalização**. Paginada no servidor, busca por nome/SKU, regra *"cada tela requisita só o que mostra"* (S22).

### C. Mínimos e necessidade de produção
7. `produtos.estoque_minimo` já vem do Tiny (46 fabricados e 7 simples preenchidos). A tela **sinaliza necessidade de produção** quando saldo < mínimo — **ícone + texto, nunca só cor** (M-12). É sugestão e fila para o PCP; **ninguém produz automaticamente** (M-01).
8. **Tela de sugestão de estoque mínimo pelo último trimestre** (melhoria; se não couber, registrar como pendência com escopo pronto): vendas por SKU dos últimos 90 dias já estão em `pedidos`/`pedido_itens` (5.300+ pedidos), lado a lado com o mínimo atual, para o dono ajustar no Tiny.

### D. Venda da loja debita a fábrica
9. A cada venda no Tiny da loja (o webhook de vendas **já grava** em `pedidos`/`pedido_itens`), debitar o item correspondente:
   - casar por **`tiny_id`** do produto quando houver; `codigo` (SKU) só como reforço;
   - ⚠️ **SKU sozinho engana**: a loja reusa o mesmo SKU em **PERSONALIZADO** com outras medidas (327 = armário 2 portas na fábrica, "PERSONALIZADO 1 porta" na loja);
   - **personalizado NÃO debita** (decisão do dono, 21/09): a fábrica produz sob encomenda e envia no pedido. Filtrar descrição com "PERSONALIZADO"/"PERSONLAIZADO" (o erro de digitação existe no histórico);
   - sem saldo, **não debitar negativo**: registrar a falta, que entra na necessidade de produção.

### E. Reconciliação (só se necessário)
10. Com o webhook mandando saldo a cada movimentação, a reconciliação vira **rede de segurança**, não caminho principal. Se for feita: ⚠️ a multiempresa da fábrica está com **"estoque de todas as empresas do grupo" na API** (decisão do dono: *"o estoque é um só"*), então o valor lido é o consolidado.

## 3. Decisões do dono já tomadas (não reabrir)

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Conta Tiny da fábrica existe? Plano? | Existe; **Evoluir**; token já no n8n |
| 2 | Que produtos entram no banco? | **Todos os tipos** (F/M/S/K/V) — já carregados |
| 3 | Débito vale para personalizados? | **Não debita** (produção sob encomenda) |
| 4 | Mínimo pode morar na plataforma? | **Não precisa** — vem do cadastro do Tiny |
| 5 | Estoque por depósito importa? | **Não** — "o estoque é um só"; depósito "Geral"; **sem exceção à v2** |
| 6 | Saldo negativo | **Vira 0 na plataforma**; correção no Tiny fica com o dono (P16) |
| 7 | Webhooks do Tiny da fábrica | Extensão instalada; **só "lançamentos de estoque" ligado** |
| 8 | Ordem no bloco | **Esta sessão vem antes da 24** (D-53, 24/09) |

## 4. Perguntar ao dono no início da sessão (só o que sobrou)

1. **Onde guardar o saldo do Tiny**: colunas em `produtos` (ex.: `saldo_tiny`, `saldo_em`) ou tabela própria? (Regra do banco enxuto.)
2. O **item interno da plataforma** (produzido, ainda não entregue) e o **saldo do Tiny** são **a mesma conta** ou duas colunas separadas na tela?
3. A necessidade de produção compara o mínimo com **qual saldo** — o do Tiny, o interno, ou a soma?
4. **Q-63** — formato do ID de produção do item de estoque (hoje campo digitável livre, D-38): número do pedido do Tiny? sequencial próprio? etiqueta?
5. **Carga inicial do saldo**: ler uma vez o estoque de todos os produtos na API, ou deixar o saldo nascer conforme as movimentações acontecem?
6. O n8n ganha de uma vez o **alerta de erro** (P1)? São 7 integrações rodando sem vigia.

## 5. Fora do escopo

Mexer no workflow ou na migration 23 (estão em produção) · corrigir saldo negativo no Tiny (P16, é do dono) · **"Concluir produção" → Pedidos em aguardo, os 3 fluxos de cancelamento e a sugestão de alocação no PCP — ficaram na [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]]**, que roda depois desta · BOM/insumos e custo real · pedidos da fábrica no Tiny (`pedidos.numero` é UNIQUE) · Comercial/cutover.

## 6. Critérios de aceite

- [~] Movimentação de estoque no Tiny da fábrica reflete no saldo da plataforma em segundos — **a leitura é derivada do aviso (sem atraso de projeção) e a carga de 26/09 apareceu na tela em minutos**; o lançamento REAL de conferência fica com o dono na validação (o Tiny não tem sandbox).
- [x] Saldo negativo aparece como **0**; o valor cru continua no evento (e a tela mostra "necessidade extrema" — D-55).
- [x] Estoque distingue **item com pedido × sem dono** — "Reservados" × "Livres na plataforma"; a peça mostra de onde veio (pedido N ou reposição).
- [x] ~~**Lançamento manual**~~ → **não confirmado pelo dono (D-54)**: no lugar, o card de REPOSIÇÃO gerado pelo estoque no PCP (evento + trilha; só logística/admin arquivam).
- [x] Tela de Estoque mostra saldo, mínimo e **sinalização de necessidade** (ícone + texto), paginada no servidor, com busca (e as duas telas da D-57).
- [x] Venda na loja debita o SKU correspondente (reserva derivada dos pedidos abertos); **personalizado não debita**; sem saldo, a falta aparece como necessidade extrema — provado no `test:banco` e com os pedidos reais.
- [x] Sugestão de mínimo **entregue**: top 20 dos 90 dias com rank (D-57).
- [x] Nenhuma alteração no workflow `domoby-tiny-fabrica-produtos` nem na `fn_upsert_produto` (a carga do saldo é um workflow SEPARADO).
- [x] Nenhum evento existente alterado ou apagado (RNF-05); toda transição nova é evento com projeção (M-13).
- [x] D-53 e as decisões novas (D-54…D-57) registradas; [[SUPA - Esquema do Banco]], [[N8N - Tiny Fabrica Produtos para Banco]] e [[PLT - Requisitos]] atualizados.

## 7. Notas para o Claude Code

Leituras **na ordem**: [[CLAUDE - Regras do Claude Code (repo)]] → [[N8N - Tiny Fabrica Produtos para Banco]] → [[N8N - Tiny Fabrica - Estudo do Cadastro]] → [[SUPA - Esquema do Banco]] → esta demanda 2×. **Não repetir o estudo de integração: está fechado.**
Terreno: v2 devolve **HTTP 200 mesmo em erro** (IF em `retorno.status`) · nunca passar de ~55 req/min na conta · **não existe sandbox no Tiny** — teste é em produção, use A-11 · webhook de conta não é assinado: conferir `cnpj` (`27556613000166`) · **Code node do n8n roda em sandbox: sem `URLSearchParams` e sem temporizador** (erro real de 22/09) · escrita do n8n no banco **sempre por RPC** · saldo é projeção de evento (M-13) · `plt_cards` **não** tem FK para `pedido_itens` — não "consertar" · detecção de cancelamento usa `fn_situacao_normalizada` (E-25) · evoluir as portas existentes (`plt_fn_estoque`, `plt_fn_pedidos_aguardo`), não criar leitura paralela (E-22).
**Checklist de validação final obrigatório:** `npm run test:banco` (2 rodadas) · `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` · F-07 (375px/768px) · ⏸️ checkpoint antes de aplicar migration (F-08) · `get_advisors` · task list conferida · handoff + notas do cofre atualizados.

## 8. Resultado (preencher ao entregar)

✅ **Entregue em 26/09/2026** — [[handoff_2026_09_26_sessao25_estoque]] · execução em `Plataforma/Execucao/SESSAO-25.md`. Migration 36 aplicada (integração intacta), test:banco com 27 cenários novos, ensaio A-11 no banco real, telas validadas no navegador (E2E da reposição com o produto de teste do Tiny, arquivado ao fim). As respostas do dono mudaram o desenho: sem lançamento manual; estoque de fato = peça pronta, 🟢 e sem pedido; abaixo do mínimo → **card de reposição no PCP** (D-54); o número = Tiny − pedidos da loja em aberto (D-55); ID = SKU (+ pedido) (D-56); duas telas + top 20 (D-57). **Mesclada na `main` em 26/09 (D-20).** Com o dono: ligar a reposição automática (a 1ª rodada criaria 44 cards / 121 unidades) e o lançamento real de conferência no Tiny.

## Ver também

[[N8N - Tiny Fabrica Produtos para Banco]] · [[N8N - Tiny Fabrica - Estudo do Cadastro]] · [[SESSAO-24 - Estoque Nucleo - Aguardo Cancelamentos e Alocacao]] (roda depois desta) · [[SESSAO-15 - Logistica e ROTAS com Caminhoes]] · [[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[N8N - Pendencias e Riscos]] (P1, P16)
