---
id: D-83
aliases: [D-83, D-083]
titulo: "O Top X manda no estoque: é o tamanho da página e só ele tem mínimo; a capacidade do galpão sai de uso"
tipo: decisao
data: 2026-09-30
status: vigente
revisa: ["[[D-071 - Top 20 a tela do estoque abre pelos 20 mais vendidos|D-71]]", "[[D-072 - Minimo e capacidade do galpao na plataforma a sugestao|D-72]]"]
revisada_por: []
complementa: []
area: [estoque]
tags: [decisao, area/estoque]
---
# D-83 · O Top X manda no estoque: é o tamanho da página e só ele tem mínimo; a capacidade do galpão sai de uso (30/09/2026) — ↩️ revisa a D-71 e a D-72

**Pedido do dono (30/09, demanda "Ajuste Estoque 2"):** o Top X vira configurável (*mínimo 1, máximo 50*), *"X é o tamanho da página"*, e *"retire o botão de quantas peças cabem por enquanto"* (na sessão, com print).

- **Top X (1–50)** é valor único da equipe (logística e admin mudam, com trilha — [[D-040 - Auditoria total toda atividade de usuario gera log persistido|D-40]]) e mora na ficha do setor ESTOQUE, como a capacidade e a chave do Tiny. Página 1 = 1º ao Xº do ranking; página 2 = X+1 ao 2X; **a lista é UMA** — o "Ver os outros produtos" morreu (o resto do catálogo está nas páginas seguintes e na busca, que varre tudo).
- **Só os X primeiros têm mínimo** e pedem reposição. Fora do Top X: sem mínimo, sem sugestão, nunca pede. Quem sai do Top X fica com o mínimo **adormecido** (nada se apaga; voltando, vale de novo).
- **A capacidade do galpão sai de uso**: o campo e o encolhimento proporcional da sugestão morreram; a coluna fica guardada, sem uso (o dono não pediu exclusão). Quem limita o estoque é o Top X.
- **O mínimo do Tiny deixa de valer como reserva** nos acabados — vira só referência na linha. Nos insumos nada muda.

**Como ficou (técnico):** migration 45 — configurações na linha do setor `estoque` em `plt_setores` (`top_x`, `cobertura_semanas`, `corte_pedido_grande`), mínimo efetivo dos acabados = `minimo_plataforma` e só dentro do Top X (`fn_minimo_efetivo`), lista única em `plt_fn_estoque_produtos` paginada pelo X.
