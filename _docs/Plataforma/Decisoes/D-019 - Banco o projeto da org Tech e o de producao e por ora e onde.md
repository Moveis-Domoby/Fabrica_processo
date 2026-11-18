---
id: D-19
aliases: [D-19, D-019]
titulo: "Banco: o projeto da org Tech é o de produção, e por ora é onde se trabalha"
tipo: decisao
data: 2026-08-26
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [publicacao-infra]
tags: [decisao, area/publicacao-infra]
---
# D-19 · Banco: o projeto da org Tech é o de produção, e por ora é onde se trabalha (26/08/2026)

**Decidido:** o Supabase da organization **Tech** (ref `axnzldwgwsmepukdiljx`) — **o mesmo que já recebe os pedidos do Tiny** — é o banco da plataforma, confirmando a [[D-008 - Banco o mesmo Supabase da fabrica|D-08]]. Nas palavras do dono: *"esse será o banco de produção, mas por enquanto podemos mexer nele à vontade"*.

**↩️ Isto revisa a parte de "banco de desenvolvimento" da [[D-015 - Stack escolhida pelo Claude Code e imutavel depois|D-15]]**, que previa um projeto Supabase novo e exclusivo de dev: por ora **não existe** projeto de dev, e as migrations da plataforma são aplicadas direto nesse banco, com autorização explícita do dono.

**O que continua valendo, sem exceção:**

- Nenhuma migration toca as tabelas da integração (`clientes`, `pedidos`, `pedido_itens`, `eventos`, `gp_pcp_processados`). Toda aplicação confere a estrutura e as contagens **antes e depois**.
- Migrations são testadas fora antes de entrar (`npm run test:banco`, contra o esquema real da integração).
- **Quando a plataforma tiver gente usando de verdade, esta permissão acaba** e volta a regra crítica 2 na íntegra: aplicar em produção só com aprovação explícita naquela conversa.
