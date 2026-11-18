---
id: D-157
aliases: [D-157]
titulo: "A Expedição absorve \"Pedidos em aguardo\": os filtros em quadradinhos e o fim da tela do aguardo"
tipo: decisao
data: 2026-10-21
status: provisoria
revisa: []
revisada_por: []
complementa: ["[[D-133 - A Expedicao mostra so pedido vivo a previsao mais proxima|D-133]]", "[[D-147 - A arrumacao para entrar em producao limpa geral PINs curtos|D-147]]"]
area: [expedicao]
tags: [decisao, area/expedicao, provisoria]
---
# D-157 · ⏳ PROVISÓRIA (escolha do Claude — confirmar com o dono) — A Expedição absorve "Pedidos em aguardo": os filtros em quadradinhos e o fim da tela do aguardo (21/10/2026, SESSAO-38 · frente da Logística) — ↪️ D-133, D-147

**Pedido do dono (imagens 6/7):** "Pedidos em aguardo" pertence à Expedição; a Expedição ganha filtros visuais (quadradinhos com número grande e nome, o ativo contornado, que respondem ao clique): todos os não entregues · com rota programada · sem rota programada · prontos · ainda em produção. A tela "Pedidos em aguardo" deixa de existir.

1. **Os 5 quadradinhos** — os números vêm do banco na MESMA requisição da página (todos = com rota + sem rota = prontos + em produção); o filtro e a paginação são no servidor; o filtro vive no endereço (`?filtro=`), o Voltar funciona. Ordem: a previsão mais próxima primeiro ([[D-133 - A Expedicao mostra so pedido vivo a previsao mais proxima|D-133]]). Ao vivo como antes.
2. **O que veio do aguardo (escolha do Claude):** a visão **"Peça por peça"** (a antiga aba "Produtos reservados": cada peça pronta com SKU, pedido e há quanto tempo está pronta), o **"Ver unidades"**, o relógio **"1ª peça pronta há / completo há"**, os avisos "Alterado no Tiny após a liberação" e "Em decisão pós devolução", e o atalho **"Abrir o pedido"** (a ficha em Pedidos → Todos os pedidos). Cada pedido mostra o caminhão e o dia da rota ou "Sem rota — programar". O "Lançar para ROTAS" saiu ([[D-156 - A rota aceita QUALQUER pedido vivo o Lancar para ROTAS deixa|D-156]]).
3. **Menu e endereço:** "Pedidos em aguardo" sai do menu da Logística; o endereço antigo leva à Expedição (lei de navegação — nenhuma rota órfã). A peça pronta continua no lugar interno "Pedidos em aguardo" (é o nome do lugar, ainda citado nos quadros e no Estoque).
4. **Quem vê:** a logística de sempre (admin, PCP, fins de linha) **e o nível "Logística"** sem vínculo de setor ([[D-147 - A arrumacao para entrar em producao limpa geral PINs curtos|D-147]]) — antes, a tela da Expedição o mandava embora sem vínculo; corrigido para todas as telas da logística que usam o mesmo gate.
5. **Achado da prova no banco (21/10):** a Expedição antiga mostrava o pedido 13622, excluído no Tiny ([[D-140 - SESSAO-32 pedido excluido no Tiny nao existe em nenhum modulo|D-140]]); a nova não mostra (42 → 41).
6. **↪️ 21/10 (revisão do supervisor): o lugar também se chama Expedição na tela** — "pedidos em aguardo agora pertence à Expedição". Os textos que nomeiam o lugar da peça pronta dizem "Expedição" (ex.: "Peça pronta na Expedição", "entrou na Expedição", "A Expedição só recebe peça em perfeito estado", "Pronto na Expedição" na área Pedidos, "Conclui a produção (Expedição ou ESTOQUE)"), inclusive os que o banco escreve (avisos do sino, recusas, a observação do reenvio). **Não mudam:** o cadastro do setor ("PEDIDOS EM AGUARDO" — dado; a Expedição mostra "Expedição" no lugar), a etapa EXPEDIÇÃO da LIMPEZA E EMBALAGEM, colunas e os avisos antigos. Os textos de telas de outra frente da mesma sessão (linha do tempo, janela do card, PCP, controle de tempo, utilitários, auditoria) são renomeados por ela.
