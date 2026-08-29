# Memória de execução — SESSAO-13 · Navegação, Perfil e Identidade

Branch: `sessao-13-navegacao` · Início: 2026-08-28
Demanda: `_docs/Plataforma/Demandas/SESSAO-13 - Navegacao Perfil e Identidade.md`
Decisões que regem: D-35, D-36, D-40, D-41, D-43 (respostas do dono nesta sessão) + D-06, D-27, D-12.

## Task list (espelho da demanda)

- [ ] 1. Sidebar dois níveis (D-36): pai expande, nunca navega; estrutura Início / Controle de Produção (dinâmico) / Logística / ROTAS / Dashboards / Administração
- [ ] 2. Sidebar em TODAS as telas, recolhível, estado lembrado; some só no Modo tablet
- [ ] 3. Modo tablet vira botão fixo acima do bloco do usuário
- [ ] 4. Botão de voltar em toda tela
- [ ] 5. Sino no topo junto à logo; Configurações no rodapé; popover nunca cortado
- [ ] 6. Rotas /pai/filho; / e pós-login → /inicio/meu-painel; rotas antigas redirecionam
- [ ] 7. Meu Perfil: nome de login (D-43), senha, foto, dados cadastrais, tema
- [ ] 8. 8 temas Domoby claro→escuro (data-tema), persistem por usuário, aplicam na hora
- [ ] 9. Login novo: logo metálica à esquerda, formulário à direita; empilha no celular
- [ ] 10. Auditoria D-40: tabela append-only + gravação (navegação + mutações) + consulta simples
- [ ] 11. Placeholders na rota certa (Pedidos em aguardo, Danificados, Caminhões, Meu painel)
- [ ] 12. Verificação: tsc, lint, vitest, test:banco 2 rodadas, tela (F-07 celular+tablet)
- [ ] 13. Handoff + notas do cofre atualizadas

## Respostas do dono (viraram D-43)

1. "Nome de usuário" = login mesmo; próprio usuário troca; é o nome exibido a todos.
2. Dados editáveis pelo próprio: nome, telefone, e-mail. CPF/matrícula só admin.
3. Foto: o próprio sobe a sua (pasta `perfis/{id}/` no bucket); admin troca de qualquer um.
4. Log: registrar tudo.

## Decisões técnicas tomadas

- **Rotas novas:** `/inicio/meu-painel` · `/inicio/afazeres` · `/inicio/meu-perfil` (filho oculto — perfil abre pelo bloco do usuário) · `/producao/{codigo-do-setor}` (inclui `/producao/pcp`; o `codigo` de `plt_setores` é o slug) · `/logistica/expedicao|estoque|pedidos-em-aguardo|danificados` · `/rotas/entregas` · `/dashboards/geral` · `/admin/equipe|setores-e-etapas|tempo|api|caminhoes`. Rotas de casca fora da lei pai→filho (sem navegação por natureza): `/entrar`, `/convite/:token`, `/trocar-senha`, `/tablet`.
- **Redirecionamentos:** `/` e `*` → `/inicio/meu-painel`; `/afazeres`→`/inicio/afazeres`; `/pcp`→`/producao/pcp`; `/setores/:id`→resolve o codigo e vai para `/producao/{codigo}` (estoque→`/logistica/estoque`, rotas→`/rotas/entregas`); `/expedicao`→`/logistica/expedicao`; `/rotas`→`/rotas/entregas`; `/dashboards`→`/dashboards/geral`; `/equipe`→`/admin/equipe`; `/estrutura`→`/admin/setores-e-etapas`; `/administracao[/tempo|/api]`→`/admin/...`; todo pai → primeiro filho.
- **Migration 22** (`20260828130000_plt_navegacao_perfil_logs.sql`): `plt_usuarios.tema` (check nos 8 nomes, default 'claro') + `plt_usuarios.foto_caminho`; grant update(tema, foto_caminho) a authenticated (a policy `edita_a_si` já limita à própria linha); tabela `plt_logs_atividade` append-only por trigger; trigger AFTER INSERT em `plt_eventos` → log automático de toda mutação por evento; triggers em `plt_tarefas` (criada/iniciada/concluida) e `plt_usuarios` (nomes dos campos alterados, nunca valores); RPC `public.plt_fn_registrar_log` (navegação/tema, gate usuário ativo); policy de storage para `perfis/{usuario_id}/` (o próprio sobe a própria foto — D-43).
- **8 temas** (Q-64, proposta provisória): claro · gelo · areia · dourado · ardosia · grafite · escuro · meia-noite — 4 claros e 4 escuros, todos amarelo × grafite; família escura reaproveita os overrides de estado do escuro; `color-scheme: dark` na família escura. Nome vive em `data-tema`; aplicado no boot via localStorage (anti-flash) e confirmado pelo perfil.
- **Edge Function `autenticacao`:** ações novas `atualizar-perfil` (nome/usuario/email/telefone — self; e-mail atualiza também o auth) e `alterar-senha` (exige senha atual; distinta da troca obrigatória do 1º login). Login passa a registrar log.
- **Configurações no rodapé** (decisão provisória): abre o Meu Perfil — é onde vivem as configurações pessoais (tema, senha, foto). Logar no handoff.
- **Sidebar por papel** (decisão provisória): Controle de Produção mostra todos os setores para admin/PCP; para os demais, os setores vinculados (menu mínimo do operador — RF-24). Guardas de rota não mudam.

## Registro contínuo

- [28/08] Branch criada; leitura obrigatória feita; D-43 registrada no cofre.
- [28/08] Migration 22 escrita (`20260828130000_plt_navegacao_perfil_logs.sql`): tema+foto em plt_usuarios (com realinhamento explícito de default/check — lição E-20), `plt_logs_atividade` append-only, triggers de log (eventos, tarefas, usuários), RPC `plt_fn_registrar_log`, policies de storage `perfis/{id}/`.
- [28/08] **E-21 registrada na memória de aprendizado:** `text[] || 'literal'` em PL/pgSQL tenta parsear o literal como array → `array_append`. Pego pelo test:banco.
- [28/08] 8 temas em tokens.css (claro/gelo/areia/dourado/ardosia/grafite/escuro/meia-noite); família escura compartilha estados escuros + `color-scheme: dark`. Catálogo em `src/perfil/tema.ts`; anti-flash no `main.tsx`; perfil aplica ao carregar (ProvedorSessao).
- [28/08] App.tsx reescrito: rotas /pai/filho + todos os redirecionamentos; `ProducaoSetor` resolve `/producao/{codigo}` (codigo de plt_setores é o slug); `QuadroSetor` agora recebe `setorId` por prop; página `Administracao.tsx` removida (o pai não navega); placeholders `EmConstrucao` (aguardo, danificados, caminhões).
- [28/08] Layout reescrito: sidebar 2 níveis (pai expande, nunca navega; grupo da tela atual abre sozinho — estado derivado, sem efeito, após lint pegar `set-state-in-effect`), recolhível com estado em localStorage, sino no topo (painel ancorado à borda ESQUERDA da página), Modo tablet acima do bloco do usuário, Configurações no rodapé (→ Meu Perfil, decisão provisória), botão Voltar em toda tela, log de navegação por rota.
- [28/08] SinoNotificacoes: prop `painelLado` + painel com `max-h` da viewport (nunca cortado).
- [28/08] Meu Perfil (`/inicio/meu-perfil`): dados (nome/login/e-mail/fone via Edge), senha (com atual), foto (bucket `perfis/{id}/`, remove a antiga), seletor dos 8 temas com amostra. Login novo em tela dividida com `Marca sobre="metalico"` (gradiente dourado).
- [28/08] Edge Function `autenticacao`: + `atualizar-perfil` (com rollback do e-mail no auth se a gravação falhar) e `alterar-senha` (confere a atual por login real); `entrar` grava log `entrou`. **Deploy pendente de aprovação.**
- [28/08] Verificação estática: tsc ✓ · lint ✓ · vitest 23/23 ✓ · build ✓ · test:banco 2 rodadas TUDO VERDE (+7 verificações novas da SESSAO-13).
- [28/08] ⚠️ Verificação de TELA pendente: o front lê as colunas novas (tema/foto) — só funciona depois de aplicar a migration 22 no banco (aprovação do dono; regra crítica 2).
