# AJUSTE — Aviso de saída com etapa e produto (06/11/2026)

Pedido do dono (06/11): avaliar e implementar o pedido do sistema de estoque de
peças que assina o aviso de saída `movimentacao_etapa` (cadastro "Estoque de
peças - teste", criado em 04/11, segredo ligado, destino num outro projeto
Supabase). Ramo `ajuste-aviso-estoque-etapas` (a partir da `main` 4980a40).

## O pedido

1. Incluir etapa de origem e de destino com id e nome (hoje só ia o nome do
   setor — dentro do mesmo setor não dava para saber a coluna).
2. Se possível, `produto_tiny_id` dentro de `card`, ao lado de `item_codigo`.
3. Dúvida: um arrasto gerou dois eventos em 4 s, um `automacao` e um
   `interface` — o que é o de automação?

## Avaliação (só leitura no banco vivo)

- O aviso é montado por `plt_privado.fn_enfileirar_webhooks()` (gatilho
  `plt_eventos_webhooks`), uma vez por evento, e assinado no despacho
  (`fn_despachar_webhooks`, HMAC do corpo). Versão viva = a da migration 19
  (nunca foi recriada). `plt_eventos` já tem `etapa_origem_id`/`etapa_destino_id`
  — faltava só levar para o aviso.
- `plt_cards.produto_tiny_id`: 202 de 260 unidades vivas têm; das 53 sem
  produto, 52 acham pelo código. A plataforma inteira resolve com
  `plt_privado.fn_produto_do_item(código, descrição)` (produto ativo de menor id;
  personalizado → null). Conferido: **0** card em que o gravado e o calculado
  divergem → `coalesce(c.produto_tiny_id, fn_produto_do_item(...))`.
- Outros assinantes do mesmo montador (n8n do estoque do Tiny, fila de pedidos,
  situação do pedido, fotos, chave do PIN): só ganham duas chaves nulas; a
  função das fotos e a do PIN nem leem o corpo. Acréscimo puro → sem quebra.
- **O par "automação + interface"** (card 14542130, 04/11 20:56): às 20:56:31
  o Guilherme arrastou de A MONTAR para MONTANDO — a plataforma registra isso
  como **iniciar** (`execucao_iniciada`, interface) + o **movimento automático**
  da fila para a coluna de trabalho (`movimentacao_etapa`, automacao, 1 ms
  antes); às 20:56:35 ele arrastou de volta para A MONTAR (`interface`). O
  registro de atividade da pessoa mostra os DOIS gestos. Nos últimos 30 dias,
  532 de 532 movimentos `automacao` são exatamente isso (fila → trabalho no
  iniciar). Não é duplicado: são dois movimentos reais (entrou e voltou).
- **Achado para o integrador:** entrar/sair de MONTANDO também acontece por
  `movimentacao_setor` — em 30 dias, 4 cards entraram direto em MONTANDO vindo
  do PCP e 172 saíram de MONTANDO para LIMPEZA E EMBALAGEM. E "sair de
  MONTANDO" dentro do setor nem sempre é "voltar": há PARADO e DANIFICADO.
  Para não perder baixa, ele precisa assinar também `movimentacao_setor`
  (o aviso desse tipo também passa a levar as etapas).

## O que foi feito

- `supabase/migrations/20261106010000_plt_aviso_etapa_e_produto.sql` — recria
  `fn_enfileirar_webhooks()` a partir da versão viva: chaves novas
  `etapa_origem`/`etapa_destino` (`{id, nome}` ou null) e `card.produto_tiny_id`.
  Nenhuma tabela/coluna/permissão; eventos intocados.
- `supabase/testes/testar-migrations.mjs` — bloco novo no fim ("Aviso de saída ·
  etapa…"), 4 verificações: etapa com id e nome dentro do mesmo setor; tudo o
  que já ia continua no lugar; produto gravado e produto pelo código; chave nula
  (não some) quando o evento não tem a etapa.
- `PLT - API Aberta.md` — exemplo do aviso atualizado + o que `origem` quer
  dizer + o alerta do `movimentacao_setor`.
- Memória de aprendizado: A-192.
- Esquema do banco: nota da função.

## Bateria

`npm run test:banco`: **1.531 verdes, 1 vermelho antigo** ("as 7 portas novas =
as antigas" do painel de vendas — falha na `main` sem este ajuste, registrado
desde a SESSAO-44, A-134). Bloco novo: 4 de 4 verdes.

## Desempenho (lei de desempenho e escala)

Nenhuma tela nem porta nova. O gatilho continua montando o aviso uma vez por
evento e só quando há assinante ativo do tipo; acréscimo = 2 buscas por chave
primária em `plt_etapas` e, só para card sem produto gravado, 1 busca pelo
índice `produtos_codigo_idx`. Nada de relógio novo; o despacho segue o mesmo.

## Pendências

- [ ] Aplicar no banco de produção — **só com o OK do dono** (regra 2).
- [ ] Depois de aplicado: conferir a função viva e o próximo aviso real do
      sistema de estoque (as chaves novas no corpo).
- [ ] Merge na `main` (só cofre, banco e teste — nada do site muda).
