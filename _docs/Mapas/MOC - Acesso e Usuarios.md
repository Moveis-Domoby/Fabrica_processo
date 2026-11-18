---
titulo: "Mapa — Acesso e Usuários"
tipo: mapa
area: acesso-usuarios
atualizado: 2026-11-18
tags: [mapa, moc, area/acesso-usuarios]
---

# 🗺️ MOC - Acesso e Usuarios

> Quem entra e o que pode: uma tabela de pessoas, três tipos de usuário (fábrica, comercial, os dois), níveis (operador, líder, produção, logística, admin, super admin), login por e-mail ou nome de usuário, PIN, "esqueci minha senha" liberado por administrador, Meu Perfil e a revisão de segurança. Dado pessoal fica fora da API.

**No código:** `src/autenticacao/` · `src/perfil/` · `src/admin/` · `src/paginas/Equipe.tsx` · `src/paginas/equipe/` · `src/paginas/Entrar.tsx` · `src/paginas/MeuPerfil.tsx` · `supabase/functions/autenticacao/`

**Perguntas em aberto:** Q-64 (os 8 temas) — [[PLT - Perguntas em Aberto]]

## Últimas sessões da área (a mais nova primeiro)

- **41** · [[SESSAO-41 - Rotas Entrega Parcial Parada Avulsa Senha Tablet e Quadro]] · [[handoff_2026_10_27_sessao41_rotas_senha_tablet_quadro|handoff]]
- **38** · [[SESSAO-38 - Bateria de Ajustes - Cards Rotas Expedicao Stand-by e Login]] · [[handoff_2026_10_21_sessao38_bateria_ajustes|handoff]]
- **36** · [[SESSAO-36 - Tablet 2.0 - Login por Setor Auxiliares e Tempos por Pessoa]] · [[handoff_2026_10_18_sessao36_tablet_2_0|handoff]]
- **18** · [[SESSAO-18 - Painel Admin Completo]]
- **13** · [[SESSAO-13 - Navegacao Perfil e Identidade]] · [[handoff_2026_08_28_sessao13_navegacao|handoff]]
- **03** · [[SESSAO-03 - Autenticacao Perfis e Permissoes]] · [[handoff_2026_08_27_sessao03_autenticacao|handoff]]

<!-- gerado:inicio -->
## Decisões vigentes (14)

- [[D-021 - Identidade e acesso uma tabela matricula senha padrao|D-21]] · Identidade e acesso: uma tabela, matrícula, senha padrão com troca obrigatória
- [[D-041 - Identidade Meu Perfil com 8 temas Domoby login com logo|D-41]] · Identidade: Meu Perfil com 8 temas Domoby; login com logo metálica
- [[D-043 - Meu Perfil nome de login editavel pelo proprio e-mail tambem|D-43]] · Meu Perfil: nome de login editável pelo próprio, e-mail também, foto própria, log de…
- [[D-049 - Saida de usuario excluir de fato so sem historia arquivar|D-49]] · Saída de usuário: excluir de fato só sem história; arquivar realoca as pendências ao…
- [[D-052 - Cadastro de ADMIN nao exige setor|D-52]] · Cadastro de ADMIN não exige setor
- [[D-068 - Dados sensiveis do cadastro fora da API|D-68]] · Dados sensíveis do cadastro fora da API
- [[D-091 - Tres tipos de usuario da fabrica do comercial e dos dois|D-91]] · Três tipos de usuário — da fábrica, do comercial e dos dois — com permissões bem…
- [[D-100 - O Painel admin vira Configuracoes nasce o Painel super admin|D-100]] · O "Painel admin" vira Configurações; nasce o Painel super admin (só o dono): Automações…
- [[D-147 - A arrumacao para entrar em producao limpa geral PINs curtos|D-147]] · A arrumação para entrar em produção: limpa geral, PINs curtos, dois níveis novos, pausa…
- [[D-163 - Entrar sem digitar o e-mail o aparelho lembra o nome|D-163]] · Entrar sem digitar o e-mail: o aparelho lembra o nome de usuário, e o PIN aceita usuário
- [[D-191 - ESQUECI MINHA SENHA LIBERADO POR UM ADMINISTRADOR aviso|D-191]] · "ESQUECI MINHA SENHA" LIBERADO POR UM ADMINISTRADOR: aviso urgente na tela, 2 h, uma…
- [[D-192 - A REVISAO DE SEGURANCA a segunda camada de permissoes a trava|D-192]] · A REVISÃO DE SEGURANÇA: a segunda camada de permissões, a trava geral do PIN de setor e…
- [[D-200 - O PEDIDO DE TROCA DE SENHA PARA E-MAIL SEM CADASTRO AVISA|D-200]] · O PEDIDO DE TROCA DE SENHA PARA E-MAIL SEM CADASTRO AVISA OS ADMINISTRADORES; a tela de…
- [[D-202 - OS AVISOS QUE CADA UM RECEBE ESCOLHIDOS EM CONFIGURACOES|D-202]] · OS AVISOS QUE CADA UM RECEBE, ESCOLHIDOS EM CONFIGURAÇÕES → AVISOS; os erros de…

## Revisadas por outra (1) — só para a história

[[D-137 - SESSAO-32 as respostas do dono tempo logado medicao nos|D-137]]

## Onde mais ler (só o que a demanda tocar)

- **Banco:** [[Banco - Usuarios Acesso e Logs]]
- **Lições:** [[Memoria - Acesso Seguranca e Credenciais]]
- **Design:** [[Design - Navegacao Menu Cabecalho e Perfil]]
<!-- gerado:fim -->
