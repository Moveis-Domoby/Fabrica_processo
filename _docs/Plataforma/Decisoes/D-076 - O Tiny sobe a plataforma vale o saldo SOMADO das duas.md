---
id: D-76
aliases: [D-76, D-076]
titulo: "O Tiny sobe a plataforma: vale o saldo SOMADO das duas empresas; Tiny acima → a plataforma sobe até ele; abaixo → nada"
tipo: decisao
data: 2026-09-30
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-070 - O estoque dos acabados e a CONTAGEM da logistica entrada|D-70]]"]
area: [estoque, tiny-n8n]
tags: [decisao, area/estoque, area/tiny-n8n]
---
# D-76 · O Tiny sobe a plataforma: vale o saldo SOMADO das duas empresas; Tiny acima → a plataforma sobe até ele; abaixo → nada (30/09/2026) — ↪️ D-70

**Contexto (29/09, vídeo do Guilherme — líder da logística):** ele fez o balanço no Tiny e a plataforma não mudou. Diagnóstico só de leitura: desde a [[D-070 - O estoque dos acabados e a CONTAGEM da logistica entrada|D-70]] o número dos acabados é a contagem da plataforma; e o aviso de estoque do Tiny da fábrica só enxerga o depósito **Geral da FÁBRICA**, enquanto o "multiempresa" que a equipe olha é a soma de quatro depósitos de duas empresas (**FábricaDomoby/Geral** + **lojadomoby/Fábrica · Loja · Desmontado**). As peças prontas estão no depósito "Fábrica" da empresa da loja (174: Geral 0 + 3 lá = os 3 da tela). O "reservado" do Tiny não serve (345: 47 no Tiny × 2 em pedidos abertos) — vale o **saldo**.

**Decidido (dono, 29–30/09):** *"a ideia futura é deixar que a plataforma seja o centro … mas eles irão usar o tiny por bastante tempo ainda"*; *"quando for cadastrado um produto no estoque do tiny, vai disparar pra gente aqui e a lógica deve conferir a quantidade a partir do sku"*; *"eles só olham o saldo multiempresa"*.

- Cada aviso de estoque (da conta da fábrica **ou da loja** — a loja é achada pelo SKU, os ids não casam entre contas, [[Memoria - Tiny n8n e Integracoes 1#A-22|A-22]]) põe o produto numa fila; o n8n lê o **saldo somado** (`produto.obter.estoque` da fábrica) e devolve à plataforma.
- **Tiny acima** do que está no galpão pela plataforma (livres + reservadas para venda) → a plataforma **sobe até o Tiny** (peças novas, motivo "entrou pelo Tiny", origem da integração). **Abaixo → nada** (a saída se dá pela plataforma — [[D-077 - A plataforma manda no Tiny entrada baixa e contagem daqui|D-77]]). Negativo no Tiny = 0 no galpão ([[D-053 - Estoque na frente a 25 troca de ordem com a 24 e absorve|D-53]]).
- **"Sobe até", não "soma a diferença"** (decidido pelo Claude, avisado ao dono): o aviso traz só o saldo final; somar diferenças transforma correção de balanço em peça (o −7 → 0 do 327 viraria 7 peças).
- Com o mínimo coberto, a **reposição que ainda está no PCP sem nada liberado é arquivada sozinha** (o exemplo do dono: *"removeria os dois cards de necessidade de produção que provavelmente ainda vão estar em pcp"*). Liberada em parte fica com o PCP.
- Toda madrugada (04:00) todos os acabados são relidos — rede de segurança para aviso perdido.

**Descartadas:** somar a diferença entre avisos (lixo com balanço); usar o "disponível" do Tiny (o reservado dele não bate com os pedidos); ler só o depósito da fábrica (não é o número que a equipe vê).

**↪️ 30/09/2026 (manhã) — a lista das reservas presas (pedido do dono, depois do conflito do 567):** a equipe trabalha pelo **"disponível multiempresa"** do Tiny, que é saldo − reservado — e o reservado do Tiny guarda reserva de pedido que já saiu (567: saldo 2, reservado 23, nenhum pedido aberto → −21 no Tiny × 2 aqui). O dono perguntou se dava para puxar o multiempresa; resposta: **o número daqui continua o saldo** (puxar o disponível traria o erro das reservas junto). Escolha do dono: *"Lista das reservas presas"* — em Configurações → Tiny, por móvel, **o que o Tiny reserva × as unidades de pedidos ainda abertos**, do maior para o menor, para a equipe **limpar no Tiny** (aba de reservas do produto: tirar as de pedidos entregues ou cancelados). Serviços do Tiny (Corte, Furo, Fitamento — milhares de "reservas") e itens sem SKU ficam fora. **Quem arruma o quê:** reserva presa → **no Tiny** (a plataforma não mexe em reserva de lá); peça que entra, sai ou é contada → **na plataforma** (vai sozinha ao Tiny — D-77). 1ª leitura real: **111 móveis, 814 unidades presas** (345: 45 · 323: 30 · 419: 28 · 193: 24 · 567: 23). Migration 46; RF-108 ↪️.
