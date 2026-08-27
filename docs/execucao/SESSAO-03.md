# Memória de execução — SESSAO-03 · Autenticação, Perfis e Permissões

> Computo contínuo de TUDO que for feito nesta sessão (regra 8 do CLAUDE.md).
> Branch: `sessao-03-autenticacao` · Início: 2026-08-26

## Decisões do dono nesta conversa (viram D-21 no cofre)

1. **Login:** todos informam e-mail no cadastro, mas podem entrar com **nome de usuário** OU e-mail + senha.
2. **~30 usuários** na largada (Q-61 respondida).
3. **Convite por link**, enviado por WhatsApp — sem e-mail automático por ora.
4. **Admin principal:** wallacecaun03@gmail.com (Wallace, o dev). contatodomoby@gmail.com NÃO — muita gente tem acesso.
5. **Senha padrão de criação** para todos (valor definido pelo dono na conversa; vive como segredo de ambiente, NUNCA em código/nota — regra crítica 4). **Troca obrigatória no primeiro login.**
6. **Uma tabela só de usuários:** nada de tabela separada para dados internos — `plt_usuarios` cresce com os campos novos e futuramente com dados de gestão.
7. **Matrícula automática** `MDM-XXX-NNN`: XXX = 3 primeiros dígitos do CPF, NNN = ordem de cadastro (001, 002…). **CPF obrigatório** em todo usuário interno.
8. **Sem autocadastro:** usuário só nasce pela mão de admin/líder. A tela pública é só o login.

## Task list (espelho da demanda)

- [x] 1. Migration: campos novos em `plt_usuarios` (cpf, usuario, matricula, senha_padrao, convite) + trigger de matrícula + ajustes de RLS — `20260826140000_plt_identidade.sql`
- [x] 2. Testes de banco cobrindo matrícula, unicidade e convite (`npm run test:banco` — tudo verde, 2 rodadas)
- [x] 3. Edge Function `autenticacao` (uma função, 6 ações): entrar (usuário OU e-mail), criar-usuario (admin/líder), trocar-senha, convite-info, pin-definir, pin-verificar
- [x] 4. Front: cliente Supabase (`src/lib/supabase.ts`) + `ProvedorSessao` (sessão + perfil via TanStack Query)
- [x] 5. Front: `/entrar` + `/convite/:token` + `/trocar-senha` (troca obrigatória via guarda)
- [x] 6. Front: navegação por papel no Layout + `RotaProtegida` (nivel lider/admin) — bloqueio por URL direta
- [x] 7. Front: `/equipe` — tabela paginada, novo usuário (modal), link de convite com WhatsApp, definir PIN
- [x] 8. `/tablet` — identificação por matrícula/usuário + PIN, lista de ações com autor (RF-25 parcial)
- [x] 9. Aplicar migration + deploy da function no Supabase (OK do dono na conversa — D-19)
- [ ] 10. Bootstrap do admin Wallace (`npm run admin:bootstrap`) + verificação dos critérios de aceite
- [x] 11. Cofre: D-21, Q-61 ✅, ORDEM → 🔨, revisão na demanda (memória de aprendizado: ao fim, se houver lição)
- [ ] 12. Handoff com matriz papel × permissão + screenshots

## Critérios de aceite (da demanda, para conferir no fim)

- [ ] Convite → cadastro → login → usuário cai na navegação do seu papel.
- [ ] Operador não acessa telas/rotas de líder nem de admin (testado por URL direta).
- [ ] No modo tablet, duas ações seguidas de operadores diferentes registram autores diferentes.
- [ ] Conta sem aprovação não acessa nada.
- [ ] Handoff com matriz papel × permissão documentada (PR dispensado — D-20).

## Registro de execução

- [26/08] Leitura completa do cofre na ordem obrigatória; demanda lida 2x; checkpoint (a)(b)(c) apresentado; dono respondeu as 5 dúvidas + 3 confirmações (troca de senha obrigatória / CPF obrigatório / sem autocadastro). Branch criada.
- [26/08] **Migration 11** (`plt_identidade`): campos cpf/usuario/matricula/senha_padrao/convite_token/convite_usado_em na `plt_usuarios` (uma tabela só, D-21); trigger `fn_gerar_matricula` (sequence em `plt_privado`, lpad com greatest para não truncar após 999); constraints de formato; **coluna cpf e convite_token com SELECT revogado** da API (dado pessoal/material de acesso — a tela usa a matrícula); escrita via navegador reduzida a `update (nome, telefone)` — todo o resto passa pela Edge Function com service_role.
- [26/08] Decisão técnica: **PIN com PBKDF2-SHA256 (WebCrypto) na Edge Function**, não pgcrypto — o PGlite dos testes não tem pgcrypto, e hash no servidor de função mantém a migration portável. Formato `pbkdf2$iter$sal$hash` em `pin_hash`.
- [26/08] Decisão técnica: **login por usuário resolve o e-mail DENTRO da Edge Function** (nunca RPC pública que mapeie usuário→e-mail: vazaria e-mails por enumeração). Erros sempre genéricos ("Usuário ou senha incorretos").
- [26/08] Decisão técnica: **uma Edge Function só (`autenticacao`) com campo `acao`** em vez de 6 functions — um deploy, um segredo, um CORS.
- [26/08] Decisão técnica: senha padrão NUNCA no repositório — segredo `PLT_SENHA_PADRAO` (Edge Function Secrets + .env.local); o valor só o dono escreve.
- [26/08] Bootstrap do primeiro admin: script `supabase/bootstrap-admin.mjs` (`npm run admin:bootstrap`) — resolve o ovo-e-galinha (usuário só nasce por admin, mas o 1º admin não tem quem o crie). CPF digitado na hora, não persiste em arquivo. Recusa rodar se já existir usuário.
- [26/08] Lint pegou 2 `setState` síncronos em effect (regra nova do react-hooks) → perfil movido para TanStack Query no `ProvedorSessao`; `Convite` inicializa estados a partir do token. `tsc`, `eslint` e 8/8 testes verdes.
- [26/08] `.env.local`: adicionadas `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` copiando os valores já existentes (sem exibir). `/` sem sessão redireciona para `/entrar` no dev server, zero erro de console.
- [26/08] **Aplicação em produção (com OK do dono):** o classificador de permissões bloqueou o `npm run banco:aplicar` e até leituras do MCP; o dono liberou as permissões dos conectores. Migration 11 aplicada via MCP `apply_migration`, seguindo o mesmo ciclo do script: impressão digital da integração ANTES (`49028cba…`, 133/133/218/535/1) = DEPOIS (idêntica, contagens intactas); 6 colunas novas e trigger conferidos por SQL. **Edge Function `autenticacao` deployada** (v1, ACTIVE, verify_jwt). `get_advisors` security: **zero achado na plataforma** (só os INFO conhecidos da integração: RLS sem policy, padrão da casa).
- [26/08] Cofre: `SUPA - Esquema do Banco.md` e `supabase-fabrica-schema.sql` §8 atualizados com a SESSAO-03 (F-02).
- [26/08] Pendente do dono: segredo `PLT_SENHA_PADRAO` (painel + `.env.local`), `npm run admin:bootstrap`, desligar "Allow new users to sign up" no painel de Auth.
