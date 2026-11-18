---
id: D-137
aliases: [D-137]
titulo: "SESSAO-32: as respostas do dono — tempo logado, medição nos aparelhos e teste de carga em produção"
tipo: decisao
data: 2026-10-15
status: revisada
revisa: []
revisada_por: ["[[D-189 - O TABLET NAO CAI cada aparelho com a sua sessao quem sai|D-189]]"]
complementa: []
area: [publicacao-infra, acesso-usuarios]
tags: [decisao, area/publicacao-infra, area/acesso-usuarios]
---
# D-137 · SESSAO-32: as respostas do dono — tempo logado, medição nos aparelhos e teste de carga em produção (15/10/2026)

**Respostas do dono** às perguntas da [[SESSAO-32 - Desempenho e Escala - Adequacao de Toda a Plataforma]] (explicadas a ele em português, com os números do retrato de 15/10):

1. **Tempo logado parado:** *"Pode ser"* — **12 h nos tablets** (um turno) e **8 h no escritório**. No plano gratuito da Supabase o ajuste nativo não existe (só no pago); a plataforma faz por conta própria — quem passar do tempo parado entra de novo.
2. **Medir a velocidade nos aparelhos:** *"Pode ser a própria plataforma mesmo"* — a plataforma mede e guarda (sem a ferramenta paga da Vercel).
3. **Teste de carga:** *"Pode rodar o teste de carga em produção mesmo, não tem ninguém usando agora à noite, então faça, analise apenas os horários das automações"* — roda no banco de verdade, à noite, fora dos horários das automações.

**Escolhas do Claude que o dono não contestou** (ficam valendo): os cliques no painel da Supabase (chave do login e gancho das permissões) são feitos pelo dono com o Claude guiando; a remoção de índices repetidos/sem uso só com a lista na mão e o OK dele; os índices nas tabelas do Tiny (busca por nome e Cancelados da área Pedidos) só depois do antes/depois e do OK dele.

**Ordem do dono (15/10, ~21:10 de Natal):** *"Vou sair agora, abre logo o navegador aqui pra que eu possa logar pra você e você testa tudo e me entrega apenas o resultado final após finalizar"* — a sessão segue sozinha, como as noturnas da 30 e da 31: cada frente testada inteira é aplicada e publicada no mesmo gesto ([[Memoria - Migrations Aplicador e Ensaio 1#E-73|E-73]]); o que o dono reservou para si (acima) fica pronto e esperando.
