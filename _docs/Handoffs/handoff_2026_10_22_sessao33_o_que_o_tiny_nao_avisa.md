---
titulo: Handoff — 2026-10-22 · SESSAO-33 (frente de 21/10) · o que o Tiny não avisa
tipo: handoff
data: 2026-10-22
atualizado: 2026-10-22
tags: [handoff, sessao, tiny, conferencia]
---

# 📋 Handoff — 22/10/2026 · SESSAO-33 (frente de 21/10) · o que o Tiny não avisa fica em dia

> [!success] No ar com o OK do dono
> Plano aprovado em 21/10 (D-148: *"Pode seguir com o plano. Os produtos apagados no Tiny somem de todas as telas, como o pedido apagado."*) e aplicado em 22/10 ~01:53 UTC (*"Pode subir a atualização do banco agora e mandar para o GitHub. Quando a conferência terminar, pode contar de novo no Tiny."*). **Banco:** migration **107** `20261022060000_plt_tiny_conferencia_sem_aviso.sql` (renumerada — a SESSAO-38 subiu 6 migrations no meio; base = `main` fd32de5), integração idêntica. **GitHub:** `main` e01d713. Site: nenhuma tela mudou. **Memória:** [[SESSAO-33]] (entradas de 21/10 e 22/10).

## 1. Objetivo da sessão

A recontagem de 21/10 (Auditoria → Carga do Tiny → "Bateu com o Tiny?") mostrou, 3 dias depois da carga completa, que ficam no retrato da carga os dados que o Tiny não avisa nem entram na consulta de hora em hora — os registros próprios da **fábrica** (pedidos 137 × 135, notas 590 × 589, contas a receber 288 × 287, pedidos de compra 157 × 151) e as **contas a pagar** das duas contas (loja 579 × 563) — e que o que foi **apagado** no Tiny segue aqui (108 produtos; 89 contas a pagar da fábrica). Pedido: desenhar com o dono como manter isso em dia e, com o OK, construir. Item pequeno no mesmo pacote: a vez da renovação do acesso da API nova da fábrica (E-116).

## 2. O que foi feito

### Banco (migration 107 — detalhe em [[SUPA - Esquema do Banco]])
- **A conferência dos registros** (`fn_tiny_conferencia_iniciar`), chamada pela conferência da madrugada que já existia (**nenhum relógio novo**): a lista completa, prioridade 8 — fábrica: pedidos, notas e contas a receber (do piso até hoje), pedidos de compra (API nova) e o catálogo; as duas contas: as contas a pagar mês a mês do piso do plano. ~90 páginas por noite.
- **Só relê o que mudou:** cada item da lista tem o hash comparado ao resumo guardado (`plt_tiny_registros.resumo_hash`); só o novo, o mudado e o que tinha sumido vão para o detalhe. A 1ª rodada relê tudo (~5,6 mil detalhes).
- **O que sumiu:** a última página de cada janela (`fn_tiny_conferencia_fechar`) compara o que temos (com a data dentro da janela) com os ids que a lista trouxe; o que faltou é perguntado um a um. "Não localizado"/404 → **sumido: apagado**; o Tiny tem mas a lista não mostra → **sumido: fora da lista**. Nada se apaga; visto de novo, volta. **Trava:** com 20 ou mais guardados e a lista com menos da metade, nada é marcado e o dono é avisado no sino.
- **O produto apagado no Tiny some de todas as telas** (`plt_produtos_excluidos_tiny` — a marcação única, como a do pedido apagado): Estoque, Configurações (móveis, insumos e peças; unidades fora do padrão; estrutura), busca de vínculo, fotos do Tiny e o estoque com o Tiny (a fila dele sai; não volta a perguntar). Com cartão vivo, os admins são avisados (nenhum dos 108 tem). **Na aplicação: os 108 marcados** (62 peças, 34 insumos, 3 kits, 9 móveis) e as 9 linhas paradas do estoque com o Tiny saíram.
- **O "quantos aqui" e o resumo do mês** contam só o que não sumiu; o **painel** confere as somas das contas a pagar com a conferência mais nova (as chaves de sempre + `carga.somas_de`, `conferencia.rodada`).
- **A vez da renovação da fábrica: 2 h → 30 min** — com o relógio de 3 em 3 h o acesso não passa de 3h30 (vale 4 h).

### Front / Edge Functions / n8n
- Nada. O fluxo da fila do n8n já é genérico (o banco monta a chamada e entende a resposta).

## 3. Decisões tomadas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| A conferência nasce da madrugada que já existe | Uma consulta de hora em hora para esses dados | Lei §4: relógio só de calendário; ninguém vê esses dados numa tela (D-144) — atraso de 1 dia basta |
| Lista completa + resumo do item (hash) | Reler o detalhe de tudo toda noite | ~90 chamadas por noite em vez de ~5,6 mil; a página ×100 de 54,5 → 11,6 ms |
| As contas a pagar mês a mês | Uma janela só | O painel confere as somas por mês com a leitura mais nova (não com a carga de 18/10) |
| Só "não localizado"/404 marca apagado; trava de metade | Marcar o que não veio na lista | A lista pode vir errada/incompleta; a confirmação um a um é a prova |
| "Fora da lista" separado de "apagado" | Tratar como apagado / deixar contando | O Tiny tem o registro (cancelado, por exemplo), mas não o conta — sai do "quantos aqui" sem ser chamado de apagado, e não volta a ser perguntado toda noite |
| Produto apagado numa tabela à parte, lida pelas telas | Mudar a situação em `produtos` | `produtos` é escrita só pelo n8n (um dono por dado — M-04); o mesmo desenho do pedido apagado (D-140) |
| Produto apagado com cartão vivo: aviso, sem arquivar | Arquivar como o pedido | A peça física pode existir de verdade |
| Renumerada para 107, depois das da SESSAO-38 | Manter 101 | A ordem dos arquivos = a ordem em produção; nenhuma função das duas frentes se cruza (texto vivo conferido de novo antes de aplicar) |

## 4. Bugs

### Resolvidos
- E-116 (a vez de 2 h do renovador da fábrica) — vez de 30 min.

### Descobertos
- **E-117:** `\b` na regex do Postgres não é borda de palavra (é retrocesso) — a consulta voltou vazia sem erro; borda é `\y`.

## 5. Arquivos alterados

```
supabase/migrations/20261022060000_plt_tiny_conferencia_sem_aviso.sql   (107 — aplicada)
supabase/testes/testar-migrations.mjs   (bloco 107 novo; o bloco 49 fecha a conferência dos registros antes de olhar o relógio)
_docs/Plataforma/Execucao/dados/SESSAO-33 - ensaio x100 da conferencia dos registros (script|resultado, 2026-10-21)
_docs/Plataforma/PLT - Decisoes de Produto.md (D-148) · PLT - Memoria de Aprendizado.md (E-117)
_docs/Plataforma/PLT - Lei de Desempenho e Escala.md (dívida 23, andamento) · Execucao/SESSAO-33.md
_docs/Supabase-fabrica/SUPA - Esquema do Banco.md · _docs/Fabrica n8n/N8N - Tiny - Mapa Completo da API e dos Dados.md
```

## 6. Impacto nos números visíveis

> [!warning] O que muda nas telas
> - **Estoque e Configurações** deixam de mostrar os 108 produtos que o Tiny da fábrica não tem mais (as 62 peças cortadas apagadas lá, 34 insumos, 3 kits, 9 móveis). Configurações → móveis, insumos e peças: 566 → 458 produtos.
> - **Auditoria → Carga do Tiny:** "aqui" dos produtos da fábrica e dos registros conta só o que existe no Tiny; as somas das contas a pagar passam a vir da conferência da madrugada (a mais nova).

## 7. Notas do cofre atualizadas

- [[PLT - Decisoes de Produto]] (D-148) · [[PLT - Memoria de Aprendizado]] (E-117) · [[PLT - Lei de Desempenho e Escala]] (dívida 23, andamento) · [[SUPA - Esquema do Banco]] (107) · [[N8N - Tiny - Mapa Completo da API e dos Dados]] (§5) · [[SESSAO-33]] · [[000 - MAPA DO PROJETO]].

## 8. Ficou pendente

### Aguardando decisão de negócio
- **Os contatos da loja que nunca compraram** (11.751 no Tiny × 10.917 aqui) — trazer todos? (anotado desde 21/10).
- **Dar ao aplicativo da API nova da loja** os módulos que faltam (depósitos, categorias financeiras, formas de pagamento, marcas, pedidos de compra, produtos) — mexe no do Comercial.
- **As contas a receber da loja** (out/26 −9, fev/26 +1 em 21/10) seguem pela conferência das 3h de sempre — sem marca de "apagado"; se quiser a mesma regra, é a próxima.
- **A estrutura de um móvel** só é relida na carga (a consulta de hora em hora relê o produto, não a estrutura).

### Próximo passo sugerido
- A recontagem depois da 1ª rodada (abaixo, §9) e conferir 1 semana de conferências (as travas, os apagados por noite).

## 9. Como validar

```sql
-- a rodada mais recente da conferência dos registros: andamento e janelas fechadas
select status, count(*), count(*) filter (where params ? 'vistos') as janelas_fechadas,
       count(*) filter (where params ? 'trava') as travas
  from public.tiny_fila
 where params ? 'conferencia' and params->>'conferencia' = (select ultima_conferencia from public.plt_tiny_controle)
 group by 1;
-- o que sumiu do Tiny (por conta, tipo e motivo)
select conta, tipo, sumiu_motivo, count(*) from public.plt_tiny_registros where sumiu_em is not null group by 1, 2, 3;
-- os produtos apagados no Tiny
select count(*) from public.plt_produtos_excluidos_tiny;
```

Na tela: Super admin → Auditoria → Carga do Tiny → "Contar no Tiny" → "Atualizar" → os tipos da fábrica e as contas a pagar devem bater.
