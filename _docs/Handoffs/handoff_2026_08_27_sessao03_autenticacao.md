---
titulo: Handoff — SESSAO-03 Autenticação, Perfis e Permissões
tipo: handoff
data: 2026-08-27
atualizado: 2026-08-27
tags: [handoff, sessao, plataforma, autenticacao, permissoes]
---

# 📋 Handoff — SESSAO-03 · Autenticação, Perfis e Permissões

**Branch:** `sessao-03-autenticacao` · **Repositório:** `contatodomoby/Fabrica_processo`
**Banco:** projeto `axnzldwgwsmepukdiljx` (org **Tech**) — o mesmo da integração do Tiny
**Demanda:** [[SESSAO-03 - Autenticacao Perfis e Permissoes]] · **Memória de execução:** `docs/execucao/SESSAO-03.md`

## 1. Objetivo da sessão

O sistema de entrada e papéis: login, convites e os três níveis operador/líder/admin — a fundação de "quem vê o quê" e "quem fez o quê". As respostas do dono no início da sessão viraram a **D-21**: login por **usuário OU e-mail**, **sem autocadastro**, senha padrão de criação com **troca obrigatória no 1º login**, convite por **link de WhatsApp**, **uma tabela só** de usuário, e **matrícula automática `MDM-XXX-NNN`** (3 primeiros dígitos do CPF + ordem de cadastro).

## 2. O que foi feito

### Banco (migrations 11 e 12, aplicadas em produção)

- `plt_usuarios` ganhou `cpf`, `usuario`, `matricula`, `senha_padrao`, `convite_token`, `convite_usado_em` — **tudo na mesma tabela**, como o dono pediu.
- **Matrícula gerada por trigger** (`plt_privado.fn_gerar_matricula` + sequence): ninguém digita, ninguém repete. Testado em produção: MDM-084-001 · MDM-111-002 · MDM-555-003.
- **`cpf` e `convite_token` com leitura REVOGADA da API** (dado pessoal / material de acesso) — a tela identifica pela matrícula. Consequência permanente: **nunca usar `select('*')` em `plt_usuarios`**.
- **Escrita pelo navegador reduzida a `update(nome, telefone)`**: criar/excluir usuário, papel, PIN e senha passam SEMPRE pela Edge Function.

### Servidor — Edge Function `autenticacao` (a primeira do projeto)

Seis ações: `entrar` (resolve usuário→e-mail no servidor, sem vazar e-mails; erro sempre genérico) · `criar-usuario` (admin/líder; senha padrão vem do segredo `PLT_SENHA_PADRAO`) · `convite-info` · `trocar-senha` (obrigatória; recusa a própria senha padrão) · `pin-definir` · `pin-verificar` (PBKDF2-SHA256, comparação em tempo constante). Deploy v1, `verify_jwt` ligado. **A senha padrão não existe em nenhum arquivo do repositório.**

### Front

- `/entrar` (usuário OU e-mail, prefill via `?u=`), `/convite/:token` (boas-vindas + primeiro acesso), `/trocar-senha` (a guarda tranca TODAS as rotas enquanto `senha_padrao=true`).
- `ProvedorSessao` (sessão + perfil via TanStack Query) e `RotaProtegida` com níveis `lider`/`admin` — bloqueio por URL direta.
- `/equipe` (admin/líder): tabela paginada, cadastro com setores/líder/PIN, **link de convite com botão de WhatsApp**, definir PIN.
- `/tablet` (RF-25 parcial): matrícula/usuário + PIN → a ação sai no nome do OPERADOR, não do "usuário do tablet".
- Bootstrap do 1º admin: `npm run admin:bootstrap` (CPF digitado na hora, nunca persistido).

## 3. Matriz papel × permissão

| Capacidade | Operador | Líder | Admin |
|---|---|---|---|
| Entrar (usuário ou e-mail) | ✅ | ✅ | ✅ |
| Trocar a própria senha / editar nome e telefone | ✅ | ✅ | ✅ |
| Modo tablet (identificar operador por PIN) | ✅ | ✅ | ✅ |
| Menu | mínimo (Início, Modo tablet) | + Equipe | + Administração, Design system |
| Ver `/equipe` | ❌ (redireciona) | ✅ | ✅ |
| Cadastrar usuário | ❌ | só **operador**, só nos **setores em que é líder** | qualquer papel, qualquer setor |
| Definir quem é líder de setor | ❌ | ❌ | ✅ |
| Definir PIN | ❌ | gente dos setores em que é líder | qualquer um |
| Ver `/administracao` | ❌ (redireciona) | ❌ (redireciona) | ✅ |
| Escrever em `plt_usuarios` direto pela API REST | ninguém além de `nome/telefone` próprios — o resto é só Edge Function (service_role) | | |
| Ler `cpf`, `convite_token`, `pin_hash` pela API | ninguém | | |

(O RLS de dados da SESSAO-02 segue valendo por baixo: operador enxerga os setores dele, líder o setor completo, admin tudo.)

## 4. Bugs encontrados e corrigidos na sessão

1. **E-14** · Bootstrap falhou em produção: a trigger da matrícula não era `security definer` e a `service_role` não tinha USAGE em `plt_privado` → migration 12. Lição: o PGlite dos testes roda como superusuário e não pega erro de permissão.
2. **Autofill no modo tablet** · o gerenciador de senhas do Chrome preenchia a credencial salva nos campos de PIN — num tablet real de setor, seria a credencial do dispositivo aparecendo para qualquer operador. Corrigido com `autocomplete="off"`/`one-time-code`.
3. (Processo) **E-13** · valor com `#` em `.env` precisa de aspas duplas — documentado no `.env.example`.

## 5. Verificação executada (critérios de aceite)

| Critério | Resultado |
|---|---|
| Convite → cadastro → login → navegação do papel | ✅ admin (Wallace) e operador (teste) — cada um caiu na sua navegação |
| Operador não acessa telas de líder/admin **por URL direta** | ✅ `/equipe` e `/administracao` redirecionam para o início |
| Duas ações seguidas no tablet registram **autores diferentes** | ✅ MDM-111-002 (por matrícula) e MDM-555-003 (por usuário); PIN errado recusado com erro genérico |
| Conta sem aprovação não acessa nada | ✅ por desenho: sem autocadastro (D-21), sign-up desligado no painel, o login só abre sessão para cadastro **ativo** em `plt_usuarios`, o RLS não devolve nada e a guarda mostra "Conta sem acesso" |
| Handoff com matriz papel × permissão | ✅ este documento (PR dispensado — D-20) |

Mais: troca de senha obrigatória comprovada nos dois primeiros acessos (`senha_padrao` virou `false` no banco); senha errada → "Usuário ou senha incorretos."; mobile (375px): sem rolagem horizontal, botão principal 56–64px, campo com fonte 16px; `npm run test:banco` verde (12 migrations, 2 rodadas); advisors do Supabase: **zero achado na plataforma**; integração do Tiny intacta (impressão digital idêntica antes/depois da migration).

## 6. Estado que ficou no banco

- **MDM-084-001 · wallace · admin** (o dono, ativo, senha própria).
- **MDM-111-002 · operador.teste.um · operador · SECC · PIN 1234** (ativo, senha descartável) e **MDM-555-003 · operadora.teste.dois · operador · SECC · PIN 4321** (aguardando 1º acesso) — **usuários de TESTE**, criados para provar os critérios. Podem ficar para testar o kanban da SESSAO-04 ou ser desativados (`ativo=false`); decisão do dono no checkpoint.

## 7. Arquivos principais

```
supabase/migrations/20260826140000_plt_identidade.sql
supabase/migrations/20260827090000_plt_identidade_permissoes.sql
supabase/functions/autenticacao/index.ts
supabase/bootstrap-admin.mjs                (npm run admin:bootstrap)
supabase/testes/testar-migrations.mjs       (6 verificações novas)
src/lib/supabase.ts · src/autenticacao/*    (provedor, guardas, api, tipos)
src/paginas/{Entrar,Convite,TrocarSenha,Equipe,ModoTablet,Administracao}.tsx
src/componentes/Layout.tsx · src/App.tsx · src/paginas/Inicio.tsx
.env.example (VITE_* e PLT_SENHA_PADRAO)
```

## 8. Notas do cofre atualizadas

[[PLT - Decisoes de Produto]] (**D-21**) · [[PLT - Perguntas em Aberto]] (**Q-61 ✅**) · [[SUPA - Esquema do Banco]] + `supabase-fabrica-schema.sql` §8 (identidade + Edge Function) · [[SESSAO-03 - Autenticacao Perfis e Permissoes]] (revisões de 26/08) · [[PLT - Memoria de Aprendizado]] (**E-13, E-14**) · [[000 - ORDEM DAS SESSOES]].

## 9. Ficou pendente / limitações conhecidas

- **"Esqueci a senha" não existe** — quem esquecer depende do admin redefinir pelo painel do Supabase por ora. Candidata à SESSAO-12.
- **PIN sem limite de tentativas** — com ~30 pessoas de confiança é aceitável; quando os eventos chegarem (SESSAO-05), as tentativas podem virar registro.
- **Janela da senha padrão**: entre o cadastro e o 1º acesso, quem souber a senha padrão pode entrar na conta nova. Mitigação operacional: **mandar o convite na hora do cadastro** e o 1º acesso ser imediato.
- Sem tela de editar/desativar usuário (só criar + PIN) — SESSAO-12 consolida.
- Q-30 (modo escuro) e Q-42 (canal de notificações) continuam em aberto.

## 10. Como validar de novo (do zero)

1. `npm run test:banco` → tudo verde.
2. `npm run dev` → `/entrar` → entre com `wallace` **ou** o e-mail + sua senha → home de admin.
3. Equipe → Novo usuário (CPF de teste) → link de convite → abrir o link numa guia anônima → entrar com a senha padrão → o sistema **obriga** a criar senha própria.
4. Na guia anônima (operador): digitar `/equipe` ou `/administracao` na barra → volta ao início.
5. Modo tablet: `MDM-111-002` + `1234`, depois `operadora.teste.dois` + `4321` → dois autores diferentes na lista.

## Ver também

[[SESSAO-03 - Autenticacao Perfis e Permissoes]] · [[handoff_2026_08_26_sessao02_banco]] · [[PLT - Decisoes de Produto]] · [[SUPA - Esquema do Banco]]
