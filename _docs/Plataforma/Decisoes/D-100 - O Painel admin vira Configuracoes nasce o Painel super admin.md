---
id: D-100
aliases: [D-100]
titulo: "O \"Painel admin\" vira Configurações; nasce o Painel super admin (só o dono): Automações e Auditoria; a engrenagem do rodapé vira o seletor de tema"
tipo: decisao
data: 2026-10-01
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-036 - Lei de navegacao hierarquia pai filho pai nunca navega rota|D-36]]", "[[D-046 - Uniao das Plataformas o Painel de Recompra vira o modulo|D-46]]", "[[D-095 - Auditoria no Painel admin o rastro de tudo quem quando onde|D-95]]"]
area: [interface, acesso-usuarios]
tags: [decisao, area/interface, area/acesso-usuarios]
---
# D-100 · O "Painel admin" vira Configurações; nasce o Painel super admin (só o dono): Automações e Auditoria; a engrenagem do rodapé vira o seletor de tema (01/10/2026) — ↪️ D-36, D-46, D-95

**Decidido (pedido do dono, mesma conversa):** *"Esse canvas será para apenas super admin … o atual painel admin será as configurações; na parte de baixo, o símbolo de configurações será agora um símbolo de tema para escolher o tema com um campinho pequeno de select; as configurações atuais e o meu perfil são a mesma coisa, não faz muito sentido; o painel admin vira configurações e a partir de hoje é criado um painel de super admin que só o meu usuário tem permissão de acessar, por enquanto, dentro dele deve ficar a auditoria e o canvas"*.

- **Configurações** (`/configuracoes/*`) = o antigo Painel admin, com tudo o que tinha (menos a Auditoria) + **Utilitários** ([[D-101 - Utilitarios etiquetas varias por card so a automacao poe|D-101]]). As rotas antigas `/admin/*` redirecionam (bookmark não quebra) — lei [[D-036 - Lei de navegacao hierarquia pai filho pai nunca navega rota|D-36]] (rota = hierarquia).
- **Super admin** (`/super-admin/*`): **Automações** e **Auditoria**. Só o dono por enquanto: marca `super_admin` no cadastro, posta por SQL (nenhuma tela dá ou tira); o banco confere (`fn_eh_super_admin`) em todas as portas das automações e da Auditoria — e a trilha inteira (`plt_logs_atividade`) passou a ser lida só pelo super admin (cada um segue lendo a própria). ↪️ [[D-095 - Auditoria no Painel admin o rastro de tudo quem quando onde|D-95]]: a Auditoria era "só admin".
- **Rodapé do menu:** a engrenagem (que abria o Meu Perfil, igual ao bloco do usuário) virou o **ícone de tema** com o seletor pequeno — aplica na hora e guarda no perfil. O Meu Perfil segue abrindo pelo bloco do usuário.
