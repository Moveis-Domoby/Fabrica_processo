---
titulo: Handoff — SESSAO-13 Navegação, Perfil e Identidade
tipo: handoff
data: 2026-08-28
atualizado: 2026-08-28
tags: [handoff, sessao, plataforma, navegacao, perfil, temas, auditoria]
---

# 📋 Handoff — SESSAO-13 · Navegação, Perfil e Identidade — a 1ª do Bloco 3 (a reforma)

**Branch:** `sessao-13-navegacao` (aguardando seu OK para o merge — D-20/D-35)
**Banco:** migration **22** aplicada em 28/08 com sua autorização (integração intacta, estrutura e linhas conferidas antes/depois) · **Edge Function `autenticacao` v3** deployada
**Demanda:** [[SESSAO-13 - Navegacao Perfil e Identidade]] · **Memória:** `docs/execucao/SESSAO-13.md`
**Decisões que regem:** D-36 (lei de navegação) · D-40 (log de tudo) · D-41 (perfil e temas) · **D-43** (suas respostas desta sessão: nome de login editável e exibido, e-mail editável, foto própria, registrar tudo)

## 1. O que foi feito

- **Sidebar em DUAS BARRAS lado a lado** (o desenho que você pediu no meio da sessão, no lugar do dropdown): a 1ª barra lista os pais (Início · Controle de Produção · Logística · ROTAS · Dashboards · Administração); clicar num pai **nunca navega** — mostra os filhos dele na 2ª barra, um menu ao lado do menu. **Cada barra tem o próprio botão de recolher** e os dois estados ficam lembrados. A 1ª recolhida vira trilho de ícones. Presente em toda tela; some só no Modo tablet.
- **Sino no topo junto à logo**, com o painel ancorado à borda da página (nunca cortado, em qualquer tamanho de tela). Rodapé: **Modo tablet** fixo acima do bloco do usuário · bloco do usuário abre o **Meu Perfil** · **Configurações** no lugar do sino · Sair. **Botão Voltar em toda tela.**
- **Rotas na lei `/pai/filho`:** `/inicio/meu-painel` (a casa — login e `/` caem aqui) · `/inicio/afazeres` · `/producao/{setor}` (dinâmico do banco; inclui `/producao/pcp`) · `/logistica/expedicao|estoque|pedidos-em-aguardo|danificados` · `/rotas/entregas` · `/dashboards/geral` · `/admin/equipe|setores-e-etapas|tempo|api|caminhoes`. **Todas as rotas antigas redirecionam** (bookmarks dos tablets não quebram — testado com `/pcp`, `/administracao`, `/expedicao`, `/rotas` e `/setores/2`). Placeholders "em construção": Pedidos em aguardo, Danificados (S15), Caminhões (S15), e a página "Administração" antiga morreu.
- **Meu Perfil** (`/inicio/meu-perfil`): alterar **nome de login** (que é o nome exibido — D-43), e-mail, telefone, **senha (exigindo a atual)**, **foto** (cada um sobe a própria, pasta exclusiva no bucket) e o **tema**.
- **8 temas Domoby, do claro ao escuro** (proposta desta sessão — Q-64): **Claro · Gelo · Areia · Dourado · Ardósia · Grafite · Escuro · Meia-noite**, todos amarelo × grafite; o amarelo segue sendo só marca/ação e os estados de qualidade nunca são só cor. Aplica na hora, persiste por usuário e segue você em qualquer navegador.
- **Login novo:** logo Domoby grande **em tom metálico** sobre grafite à esquerda, formulário à direita; no celular empilha.
- **Trilha de atividade (D-40):** tabela `plt_logs_atividade` **append-only por trigger** (nem service_role edita/apaga). Alimenta-se sozinha: toda mutação do kanban (via eventos), tarefas, mudanças de cadastro (só os NOMES dos campos, nunca valores), navegação entre telas, login e troca de senha. Já nasceu registrando de verdade: a própria verificação desta sessão deixou 28+ linhas (navegação, login, troca de tema).

## 2. Verificação executada

| Critério da demanda | Resultado |
|---|---|
| Nenhuma rota fora de `/pai/filho`; login/`/` caem no Meu painel; antigas redirecionam | ✅ navegador: login → `/inicio/meu-painel`; 5 rotas antigas testadas redirecionando |
| Pai só expande/mostra filhos — nunca navega | ✅ navegador (no desenho novo de 2 barras) |
| Sidebar em toda tela, recolhível, estado lembrado; some só no tablet | ✅ as DUAS barras recolhem separadas; estados sobrevivem ao reload |
| Botão voltar em toda tela | ✅ na casca — presente em todas |
| Popover de notificações nunca cortado | ✅ fixo, ancorado à borda, `max-h` da viewport |
| Sino no topo · Configurações no rodapé · Modo tablet acima do usuário | ✅ navegador |
| Meu Perfil: nome/login, senha, foto, dados; tema na hora + persiste; 8 temas | ✅ tema testado no banco real (aplicou, persistiu, voltou no reload); dados/senha/foto ver §4 |
| Login com logo metálica; funciona no celular | ✅ desktop por screenshot; mobile empilhado (estrutura conferida por DOM) |
| Ação gera log consultável; log append-only | ✅ 28+ linhas reais; UPDATE/DELETE recusados (provado no `test:banco`) |

Mais: `test:banco` 2 rodadas **TUDO VERDE** (+7 verificações novas) · tsc · lint · Vitest 23/23 · build · advisors: 16 WARN esperados **+1 novo esperado** (`plt_fn_registrar_log`, endpoint de propósito) · conferência E-20 pós-aplicação (default/check/triggers/policies como desenhado).

**Dois erros pegos pelo processo antes de doer:** **E-21** (`text[] || 'texto'` em PL/pgSQL quebra em execução — pego pelo test:banco) e **E-22** (fetcher local na mesma queryKey `['setores']` envenenou o cache e gerou `/producao/undefined` na sidebar — pego no console durante a F-07, corrigido na hora).

## 3. O que você precisa saber

- 🔴 **Troque a sua senha**: ela ficou escrita no chat desta sessão (regra crítica 4 da casa) e é fraca. Agora dá para trocar no **Meu Perfil** (pede a atual). Já era pendência do checklist da manhã.
- ⚠️ **Advisors acusam tabelas de outra frente** no mesmo banco (`contas_receber`, `notas_fiscais`, `tiny_fila` — RLS ligado sem policy). Não são desta sessão nem da plataforma; ficam registradas para a frente que as criou.
- O tema que testei foi devolvido para **Claro**; sua conta está como estava.

## 4. Como validar (5 minutos)

1. Entre: você cai em **`/inicio/meu-painel`**; repare no Voltar, no sino no topo e no Modo tablet no rodapé.
2. Clique em **Logística** na barra 1 → os filhos abrem na barra 2 ao lado; clique de novo no pai → o painel recolhe. Recolha também a barra 1 (botão ao lado do sino) → trilho de ícones. Recarregue: os estados ficam.
3. Abra um bookmark antigo (`/pcp`, `/estrutura`…) → cai na rota nova.
4. Clique no seu nome (rodapé) → **Meu Perfil** → troque o tema (as 8 amostras) → aplica na hora; troque a senha (pede a atual); suba uma foto; mude o nome de login e saia/entre com o novo.
5. Como admin, confira a trilha: Supabase → `plt_logs_atividade` — cada gesto acima virou linha (e tente editar uma: o banco recusa).

## 5. Pendente / decisões provisórias (para você confirmar)

- **Configurações (rodapé) abre o Meu Perfil** — as configurações pessoais vivem lá. Se preferir outro destino, é 1 linha.
- **Controle de Produção por papel:** admin/PCP veem todos os setores; operador vê os dele (menu mínimo — RF-24). As guardas de acesso não mudaram.
- **Meu painel ainda é a tela de boas-vindas antiga** — o cockpit de verdade é a SESSAO-14.
- **Não testei ao vivo** alterar seus dados/senha reais nem upload de foto (não quis mexer na sua credencial) — o caminho está no §4; qualquer tropeço, me chame na revisão.
- Heartbeat de presença (a cada 5 min) **não** entra na trilha de propósito — é telemetria, viraria ruído. Diga se quiser registrado também.

## 6. Notas do cofre atualizadas

[[SUPA - Esquema do Banco]] (migration 22 + Edge v3) · [[PLT - Modelo de Sistema]] (navegação em 2 barras, temas, perfil) · [[PLT - Decisoes de Produto]] (**D-43**) · [[PLT - Memoria de Aprendizado]] (**E-21, E-22**) · [[000 - ORDEM DAS SESSOES]] · [[000 - MAPA DO PROJETO]] · [[SESSAO-13 - Navegacao Perfil e Identidade]] (resultado)

## Ver também

[[SESSAO-13 - Navegacao Perfil e Identidade]] · [[handoff_2026_08_28_sessao12_tarefas]] · [[SESSAO-14 - Meu Painel e Metas]] (a próxima)
