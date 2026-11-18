---
id: D-200
aliases: [D-200]
titulo: "O PEDIDO DE TROCA DE SENHA PARA E-MAIL SEM CADASTRO AVISA OS ADMINISTRADORES; a tela de quem pede sugere o e-mail certo; decidir tira o aviso de todas as telas na hora"
tipo: decisao
data: 2026-10-28
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-191 - ESQUECI MINHA SENHA LIBERADO POR UM ADMINISTRADOR aviso|D-191]]"]
area: [acesso-usuarios, interface]
tags: [decisao, area/acesso-usuarios, area/interface]
---
# D-200 · O PEDIDO DE TROCA DE SENHA PARA E-MAIL SEM CADASTRO AVISA OS ADMINISTRADORES; a tela de quem pede sugere o e-mail certo; decidir tira o aviso de todas as telas na hora (28/10/2026, ajuste do dono) — ↪️ D-191

**Relato do dono:** *"Quando alguém solicita uma troca de senha, a notificação não chega no momento correto para o Admin, foi relatado que ele precisou entrar e sair da plataforma para a notificação finalmente chegar."*

**O que os registros do servidor mostraram (27/10, ~17:50 de Natal):** o administrador estava usando a plataforma quando a pessoa pediu a troca — mas o 1º pedido foi feito com o e-mail **digitado errado** (faltou o "l" de "gmail"). Pela [[D-191 - ESQUECI MINHA SENHA LIBERADO POR UM ADMINISTRADOR aviso|D-191]] a tela diz sempre a mesma coisa e o e-mail sem cadastro não fazia nada: ninguém soube. O administrador conferiu a Equipe, recarregou e saiu; a pessoa pediu de novo com o e-mail certo justo nesse meio-tempo; ao entrar, o aviso abriu na hora. Conferido no banco: um pedido só (o do e-mail certo), nenhuma conta com o e-mail errado, os 5 administradores avisados no mesmo segundo. O aviso ao vivo funcionava; a causa era o pedido que não existia.

**Decidido (resposta do dono — "Corrigir dos dois lados"):**

- **Na tela de quem pede** ("Esqueci minha senha"): quando o fim do e-mail tem um erro comum de digitação de provedor ("gmai.com", "gamil.com", "hotmal.com", "outlok.com", ".con"…), aparece **"Você quis dizer …?"** — um toque corrige. A conferência roda só no aparelho, com uma lista fixa de provedores: **não consulta o banco**, então continua sem dizer quem tem cadastro (a D-191 segue).
- **No sino dos administradores:** o pedido para e-mail **sem cadastro ativo** (inexistente, desativado ou conta de tablet) vira o aviso **"Troca de senha: e-mail sem cadastro"** com o e-mail digitado e "confira com a pessoa se o e-mail foi digitado certo". Não abre o aviso urgente (não há o que liberar) e não cria pedido. O mesmo e-mail, enquanto o aviso não foi lido, **não repete** (e a trava de 5 pedidos a cada 15 min por aparelho e por e-mail continua).
- **Quem pediu vê a mesma mensagem de sempre** — nada muda para ela.
- **Decidiu, sumiu de todas as telas:** quando um administrador libera ou não libera, o aviso urgente sai **na hora** das telas abertas dos outros administradores e das outras abas do mesmo (antes ficava o pedido antigo na tela até sair e entrar, e o 2º toque dizia "outro administrador já tinha decidido"). E o pedido que chega com o aviso já aberto entra na lista na hora.

**Como ficou (técnico):** migration `20261028010000` — `plt_fn_senha_solicitar` (o ramo do e-mail sem cadastro: aviso `senha_sem_cadastro` por administrador, sem repetir o não lido) e `plt_fn_senha_decidir` (o sinal `senha_decidida` no canal pessoal de cada administrador; marcar como lido pela caixa de cada um — o índice dos não lidos). Tela: `src/autenticacao/sugestaoEmail.ts` (distância de edição no domínio), `RecuperarSenha.tsx`, `AlertaTrocaSenha.tsx` (ouve `senha_decidida`; a lista relê com o aviso novo).

**Descartadas:** dizer na tela de quem pede que o e-mail não existe (fere a D-191 — entregaria quem tem cadastro); mandar o e-mail sem cadastro para o aviso urgente (não há o que liberar); consultar o banco para sugerir o e-mail (entregaria quem tem cadastro).
