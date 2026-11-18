---
id: D-52
aliases: [D-52, D-052]
titulo: "Cadastro de ADMIN não exige setor"
tipo: decisao
data: 2026-09-23
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [acesso-usuarios]
tags: [decisao, area/acesso-usuarios]
---
# D-52 · Cadastro de ADMIN não exige setor (23/09/2026)

**Decidido (regra do dono, 23/09, durante os ajustes da SESSAO-23):** ao criar um usuário com papel **admin**, o vínculo de setor é **opcional** — admin já tem permissão total e acesso a todos os setores. **Líder e operador continuam obrigados** a ter pelo menos um setor.

- Vale nas duas portas: a tela de Gestão da equipe (aviso "Admin tem acesso a todos os setores — vincular é opcional") e a Edge Function `autenticacao` (`criar-usuario`), que pula o insert em `plt_usuario_setores` quando não há setores.
- Terreno já suportava: existe admin ativo sem vínculo nenhum desde a fundação (o próprio dono) e nenhuma tela/RPC depende de vínculo para admin (`fn_setores_do_usuario` vazio é normal; os gates de admin passam por `fn_eh_admin`).

**Descartada:** esconder a lista de setores para admin (o dono deixou as duas opções; ficou a lista opcional com o aviso — admin pode, se quiser, ser vinculado a setores para aparecer nas equipes).
