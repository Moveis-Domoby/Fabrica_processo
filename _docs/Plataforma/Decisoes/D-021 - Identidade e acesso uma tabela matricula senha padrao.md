---
id: D-21
aliases: [D-21, D-021]
titulo: "Identidade e acesso: uma tabela, matrícula, senha padrão com troca obrigatória"
tipo: decisao
data: 2026-08-26
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [acesso-usuarios]
tags: [decisao, area/acesso-usuarios]
---
# D-21 · Identidade e acesso: uma tabela, matrícula, senha padrão com troca obrigatória (26/08/2026)

**Decidido (respostas do dono no início da SESSAO-03):**

- **Login:** todo usuário informa **e-mail** no cadastro, mas entra com **nome de usuário OU e-mail** + senha.
- **Sem autocadastro:** usuário só nasce pela mão de admin/líder. A tela pública é só o login.
- **Senha padrão de criação** para todos, definida pelo dono (o valor vive como **segredo de ambiente**, nunca em nota ou código — regra crítica 4), com **troca obrigatória no primeiro login** — sem a troca, nenhuma tela é liberada.
- **Convite por link** enviado por **WhatsApp** — sem e-mail automático por ora.
- **Admin principal:** `wallacecauan03@gmail.com` (Wallace; grafia corrigida pelo dono em 27/08). O `contatodomoby@gmail.com` foi descartado de propósito: muita gente tem acesso a ele.
- **Uma tabela só de usuário** (palavras do dono: *"não crie tables para separar dados de usuários internos"*): os campos novos entram na própria `plt_usuarios`, que futuramente guardará também os dados principais de gestão.
- **Matrícula automática** como identificador interno, no padrão **`MDM-XXX-NNN`** — XXX = 3 primeiros dígitos do CPF, NNN = ordem de cadastro (001, 002…). Por consequência, **CPF é obrigatório** em todo usuário interno.
- **Escala:** ~30 usuários na largada (responde Q-61).

**Descartadas:** autocadastro com aprovação (porta a mais para vigiar, sem função com senha padrão + convite); tabela separada de "dados internos" (dificultaria a gestão futura, viola a intenção do dono); e-mail automático de convite (exigiria SMTP configurado; o link por WhatsApp resolve).
