---
titulo: "SESSAO-13 — Navegação, Perfil e Identidade (a reforma da casca)"
tipo: demanda
status: entregue
data: 2026-08-28
atualizado: 2026-08-28
tags: [plataforma, demanda, bloco-3]
---

# 🎯 SESSAO-13 — Navegação, Perfil e Identidade

> A 1ª sessão do Bloco 3 (a reforma — D-35). O dono usou a plataforma e rejeitou a
> navegação atual. Esta sessão troca a CASCA inteira: sidebar pai→filho, rotas
> herdeiras, perfil com temas, login novo e log de tudo. As telas de conteúdo novas
> (Meu painel, Logística, Dashboards) vêm nas sessões 14–16 — aqui elas podem nascer
> como filhos com tela placeholder simples, já na rota certa.

## O que é

A reforma de navegação e identidade: a plataforma passa a ter a estrutura de menu
definida na D-36 (lei de navegação), Meu Perfil com 8 temas (D-41), login novo e
auditoria de toda atividade (D-40).

## Decisões que regem esta demanda

**D-35, D-36, D-40, D-41** (novas) + D-06 (mobile-first), D-27 (padrões de interface,
sem códigos internos), D-12 (setores em 2 níveis). A regra 16 dos CLAUDE.md é a
versão-lei da D-36.

## Comportamento esperado

**Sidebar (D-36):**
1. Dois níveis: pai expande em cascata os filhos; **clicar no pai nunca abre página**.
   Estrutura: **Início** (Meu painel · Afazeres) · **Controle de Produção** (um filho
   por setor cadastrado — dinâmico, vem do banco; substitui a aba "PCP") ·
   **Logística** (Expedição · Estoque · Pedidos em aguardo · Danificados) · **ROTAS** ·
   **Dashboards** · **Administração** (Gestão da equipe · Setores e etapas [a atual
   "Estrutura"] · Controle de tempo · API e integrações · Caminhões [placeholder]).
   Equipe e Estrutura **saem do 1º nível**; a página "Administração" atual morre —
   o pai só abre o dropdown.
2. Sidebar **presente em TODAS as telas** (inclusive quadros de setor e telas que hoje
   a escondem), **recolhível/expandível** por botão, estado lembrado por usuário.
3. **"Modo tablet"** (a antiga "Tela do setor") sai da lista de abas e vira **botão fixo
   logo acima do bloco do usuário** no rodapé da sidebar.
4. **Toda tela tem botão de voltar** (volta à aba anterior).
5. **Sino de notificações vai para o topo da sidebar, junto à logo Domoby**; no rodapé,
   no lugar do sino, entra **Configurações**. O popover de notificações **nunca é
   cortado/comido pela tela** — reposicionar/ancorar corretamente em qualquer viewport.

**Rotas (D-36 / regra 16):**
6. Toda rota é `/pai/filho` (ex.: `/inicio/meu-painel`, `/producao/fitamento`,
   `/logistica/estoque`, `/admin/equipe`). Pai não é rota navegável; `/` e `/entrar`
   (pós-login) redirecionam para `/inicio/meu-painel`; rotas antigas redirecionam
   para as novas equivalentes (nenhum link salvo quebra).

**Meu Perfil (D-41):**
7. Clicar no bloco do usuário (rodapé) abre **Meu Perfil**: alterar nome de usuário,
   senha, **foto** (upload, bucket existente de imagens ou novo), dados cadastrais e
   **tema da plataforma**.
8. **8 temas de cor, do claro ao escuro, todos no DNA Domoby** (amarelo × grafite),
   usando a infraestrutura `data-tema` da SESSAO-01. Escolha persiste por usuário e
   aplica na hora. O Claude Code propõe as 8 variações (Q-64 — decisão provisória
   permitida, logada no handoff).

**Login (D-41):**
9. Tela dividida: **logo Domoby grande em tom metálico à esquerda**, formulário à
   direita. Mobile: logo acima, formulário abaixo.

**Auditoria (D-40):**
10. **Toda atividade de usuário registra log no banco** (quem, quando, ação, contexto),
    append-only — cobre navegação relevante e toda mutação (as RPCs existentes passam a
    registrar). Sem UI completa nesta sessão; basta a tabela + gravação + uma consulta
    simples de conferência.

## Fora do escopo

Conteúdo real de Meu painel e metas (S14), telas de Logística e ROTAS novas (S15),
dashboards (S16), qualquer integração externa nova (D-35). Placeholders são bem-vindos
para os filhos que ainda não existem — na rota certa, com "em construção".

## Critérios de aceite

- [ ] Nenhuma rota fora do padrão `/pai/filho`; `/` e login caem em `/inicio/meu-painel`; rotas antigas redirecionam.
- [ ] Clicar em qualquer pai apenas expande/recolhe os filhos — nunca navega.
- [ ] Sidebar visível e recolhível em toda tela; estado lembrado; some apenas no Modo tablet.
- [ ] Botão voltar presente e funcional em toda tela.
- [ ] Popover de notificações abre inteiro em qualquer tamanho de tela (inclusive sidebar recolhida).
- [ ] Sino no topo; Configurações no rodapé; Modo tablet acima do bloco do usuário.
- [ ] Meu Perfil altera nome de usuário, senha, foto e dados; tema aplica na hora e persiste por usuário; 8 temas Domoby claro→escuro.
- [ ] Login com logo metálica à esquerda; funciona no celular.
- [ ] Ação de usuário (ex.: mover card, criar tarefa, trocar tema, login) gera linha de log consultável; log é append-only.

## Notas para o Claude Code

Ler `PLT - Modelo de Sistema.md` antes de mexer na sidebar (D-27 nasceu lá). Migration
nova para o log (prefixo plt_, sem tocar tabelas da integração); RLS coerente com papéis.
Redirecionamentos das rotas antigas são obrigatórios (bookmarks dos tablets). O rename
de telas ("Estrutura" → "Setores e etapas") é só de navegação/rótulo — não renomear
tabelas nem quebrar as telas existentes.

## Resultado (preencher ao entregar)

Entregue em 28/08/2026 — [[handoff_2026_08_28_sessao13_navegacao]]. A sidebar saiu do
dropdown em cascata e virou **duas barras lado a lado** (ajuste pedido pelo dono durante
a sessão): pais na primeira, filhos na segunda, cada uma recolhível com estado lembrado.
Rotas todas em `/pai/filho` com redirecionamentos; Meu Perfil com 8 temas (D-43: login
editável e exibido, e-mail editável, foto própria); login com logo metálica; trilha de
atividade append-only registrando tudo (migration 22 aplicada; Edge Function v3).
Critérios de aceite todos verificados (tabela no handoff). Pendências: confirmar as
decisões provisórias do §5 do handoff; merge na `main` após a revisão.
