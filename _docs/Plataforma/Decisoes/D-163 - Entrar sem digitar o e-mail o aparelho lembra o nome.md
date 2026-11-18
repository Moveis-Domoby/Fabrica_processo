---
id: D-163
aliases: [D-163]
titulo: "Entrar sem digitar o e-mail: o aparelho lembra o nome de usuário, e o PIN aceita usuário"
tipo: decisao
data: 2026-10-21
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-021 - Identidade e acesso uma tabela matricula senha padrao|D-21]]", "[[D-146 - Tablet 2 0 as 13 respostas provisorias da SESSAO-36|D-146]]"]
area: [acesso-usuarios, tablet-tv]
tags: [decisao, area/acesso-usuarios, area/tablet-tv]
---
# D-163 · Entrar sem digitar o e-mail: o aparelho lembra o nome de usuário, e o PIN aceita usuário (21/10/2026, pedido do dono) — ↪️ D-21, D-146

**Pedido do dono:** *"digitar o e-mail toda vez é um saco"* — poder entrar com nome de usuário e senha.

**O que já existia ([[D-021 - Identidade e acesso uma tabela matricula senha padrao|D-21]], SESSAO-03):** a entrada por **nome de usuário OU e-mail** + senha está no ar desde a SESSAO-03 — todos os 16 cadastros ativos têm nome de usuário (único, sem acento, minúsculo; o do dono é `wallace`), visível e editável no Meu Perfil e na Equipe.

**Por que o dono ainda digitava o e-mail (a causa):** (1) a tela de entrada **não lembrava de ninguém** — com o tempo parado de 8 h ([[D-137 - SESSAO-32 as respostas do dono tempo logado medicao nos|D-137]]) a sessão cai e cada entrada começava do campo vazio (o dono entrou 19 vezes em 7 dias); (2) os campos não tinham `name`, e o gerenciador de senhas do navegador guardava/preenchia mal; (3) o "Entrar com e-mail e PIN" ([[D-146 - Tablet 2 0 as 13 respostas provisorias da SESSAO-36|D-146]]) **só aceitava e-mail**; (4) nada na tela ensinava o próprio nome de usuário a quem sempre entrou pelo e-mail.

**Decidido (escolhas do Claude, ⏳ PROVISÓRIA — confirmar com o dono):**
1. **O aparelho lembra o nome de usuário** de quem entrou por último (só neste navegador; nunca senha nem PIN). O servidor devolve o nome de usuário de quem acabou de acertar a senha — quem entrava pelo e-mail passa a ver o próprio usuário já preenchido. Na próxima entrada o cursor já vai para a senha. O link de convite continua vencendo.
2. Os campos levam `name`/`autocomplete` padrão (`username`, `current-password`) para o navegador lembrar e preencher.
3. **"Entrar com usuário e PIN"**: o caminho do PIN para quem nunca criou senha aceita usuário **ou** e-mail (mesma trava de tentativas; o site antigo segue funcionando).
4. O campo de entrada aceita o usuário **com maiúscula, acento e espaço** ("João Lucas" acha `joaolucas`).
5. **Segurança mantida e reforçada:** nenhuma consulta pública de usuário → e-mail (tudo no servidor); a mesma mensagem para "não existe" e "senha errada"; a **senha errada passa pela mesma trava do PIN** (5 erros em 15 min → espera de 1 min, dobrando até 15) — contada pelo que foi digitado, exista ou não a pessoa (o "muitas tentativas" não entrega quem tem cadastro); a conta de tablet de cada setor **não entra por senha** (só pelo PIN do setor); pessoa desativada continua recusada ([[D-141 - As respostas do dono sobre o que ficou da SESSAO-32 e|D-141]]); a troca obrigatória de senha e o PIN seguem iguais; toda entrada vai para a trilha **com o caminho usado** (usuário ou e-mail — sem guardar o que foi digitado).
6. Sem coluna nova nem atualização do banco (banco enxuto): a coluna de nome de usuário já existia e estava preenchida para todos.

**Risco aceito (a confirmar):** alguém que digite errado a senha de outra pessoa 5 vezes trava a entrada dela por 1 minuto (padrão de mercado; o bloqueio cresce só enquanto os erros continuam).
