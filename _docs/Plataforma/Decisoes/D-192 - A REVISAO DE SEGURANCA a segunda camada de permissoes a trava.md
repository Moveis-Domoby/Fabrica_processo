---
id: D-192
aliases: [D-192]
titulo: "A REVISÃO DE SEGURANÇA: a segunda camada de permissões, a trava geral do PIN de setor e os limites do login"
tipo: decisao
data: 2026-10-27
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [acesso-usuarios]
tags: [decisao, area/acesso-usuarios]
---
# D-192 · A REVISÃO DE SEGURANÇA: a segunda camada de permissões, a trava geral do PIN de setor e os limites do login (27/10/2026, pedido do dono — SESSAO-41)

**Pedido do dono:** *"revisar políticas de segurança para bloquear testes comuns que hackers e pessoas mal-intencionadas fazem, seja bloquear injeção de sql no login, teste de força bruta, edição de acesso via api e coisas do tipo"*.

- **Achado e mantido (auditoria no banco real, só leitura):** toda regra de escrita das tabelas é para quem está logado e confere a pessoa; quem está logado só muda o próprio nome/telefone/foto/tema/fila em `plt_usuarios` — **nunca papel, super admin, módulos, ativo** (testado na bateria: "virar admin pela API" é recusado); nenhuma porta monta SQL com texto digitado (as 2 que montam usam `%L`/`USING`); o login procura por `.eq` (sem injeção); nenhuma função privilegiada aberta ao visitante.
- **Corrigido:** (1) o visitante (sem login) perde TODA escrita (insert/update/delete/truncate) em todas as tabelas e visões — antes só as regras de linha seguravam; (2) ninguém do navegador "esvazia tabela" (TRUNCATE não passa pelas regras de linha); o mesmo para tabela nova; (3) **trava GERAL do PIN de setor**: 30 erros em 15 min, de qualquer aparelho, fecham a entrada por PIN de setor por um tempo (a trava por aparelho usa o endereço de internet, que dá para disfarçar, e o PIN de setor tem 2 dígitos — [[D-147 - A arrumacao para entrar em producao limpa geral PINs curtos|D-147]]); (4) o login recusa texto acima de 254/72 caracteres sem ir ao banco.
- **Para o dono clicar no painel da Supabase (o Claude guia):** desligar o **cadastro público** de contas (hoje qualquer um cria uma conta de login por fora — não enxerga nada, mas é porta aberta; os cadastros da plataforma continuam pela Equipe) e a **senha mínima de 8**.
- ⏳ Fica para depois (custa ou depende do dono): CAPTCHA no login (Turnstile, gratuito, chave do dono), proteção contra senha vazada (plano pago da Supabase).
