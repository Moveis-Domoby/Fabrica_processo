# Memória de execução — SESSAO-07 · Tela do Setor (Tablet)

**Branch:** `sessao-07-tela-setor` · **Início:** 2026-08-28 (bloco noturno D-26)
**Demanda:** `_docs/Plataforma/Demandas/SESSAO-07 - Tela do Setor Tablet.md`
**Decisões novas que regem o bloco:** D-28 (card do operador: dados do produto + imagens + som discreto + modo setor), D-29 (controle de tempo do admin), D-30 (deploy adiado), D-27 (prelúdio de padrões).

## Task list (espelho da demanda + D-27 + D-28 + D-29) — CONFERIDA ao final

1. [x] Prelúdio D-27a — menu lateral (sidebar) no lugar da barra superior; recolhível no celular
2. [x] Prelúdio D-27b — remover rota/aba "Design system"; migrar `docs/design-system.md` → `_docs/Plataforma/PLT - Modelo de Sistema.md`; atualizar os DOIS `CLAUDE.md`
3. [x] Prelúdio D-27c — microinteração do `Botao`: elevação leve (2px) + sombra suave
4. [x] Prelúdio D-27d — varredura de códigos internos: front E mensagens de erro do banco (migration 16)
5. [x] Banco (migration 16): `p_operador_id` nas RPCs · mensagens sem códigos · realtime em `plt_cards` · bucket `plt-imagens` + policies · tabelas D-29 + `fn_tempo_util` + RLS — **aplicada, advisors ok**
6. [x] Tela do setor: fila em tela cheia por chegada, destaque no mais antigo, Realtime + polling, som discreto
7. [x] Ações com PIN (receber/iniciar/finalizar/mover) — autor = operador do PIN; provado no navegador (iniciar/finalizar) e no test:banco (mover/gate)
8. [x] Card do operador: dados do produto, zero cliente, espaço de imagens
9. [x] Upload/galeria por produto (admin/líder anexa; operador vê)
10. [x] Admin — controle de tempo (D-29): horários, desligar/religar (testado no navegador), retroativa
11. [x] Celular pessoal: 1 vínculo abre direto no setor; layout 375px sem rolagem horizontal (verificado por JS)
12. [x] Verificação: tsc · lint · vitest 17/17 · test:banco 2 rodadas (+8 checks) · migration aplicada · advisors (8 WARN esperados) · conferência de tela enxuta por DOM/JS (screenshots pendentes — A-13)
13. [x] Task list conferida contra a demanda · merge na main (D-26)
14. [x] Handoff `handoff_2026_08_28_sessao07_tela_setor` + memória de aprendizado (A-12, A-13) + continuidade do bloco

## Decisões técnicas tomadas

- **Autor por PIN no tablet:** a RLS de `plt_eventos` já permite inserir evento com `usuario_id` de outra pessoa desde que a SESSÃO (conta do dispositivo) trabalhe no setor — o desenho da SESSAO-02/03 previu isso. Para os caminhos por RPC (`plt_fn_mover_card`, `plt_fn_registrar_parecer`), a migration 16 adiciona `p_operador_id` (default null → sessão): o PIN é verificado na Edge Function (`pin-verificar`) e o id retornado vira o autor. As regras de verdade continuam nos triggers (M-14).
- **Mudança de assinatura de função Postgres = DROP + CREATE** (adicionar parâmetro com default cria SOBRECARGA, não substitui) + re-grants.
- **Tempo real:** `alter publication supabase_realtime add table plt_cards` (a RLS vale para o realtime). Fallback: o polling de 20s que já existe.
- **Imagens por PRODUTO (`item_codigo`)**, não por card — é o que serve a futura biblioteca de peças (D-28). Storage bucket `plt-imagens`, caminho `produtos/{codigo}/…`; leitura para authenticated, escrita admin/líder; sem tabela de metadados (listagem por prefixo).
- **D-29 nesta sessão = banco + UI de admin.** O desconto do tempo útil nos números acontece nas views/consultas da SESSAO-10 via helper `plt_privado.fn_tempo_util`. O "espera há X" da tela do setor continua tempo corrido (não é métrica).
- **Verificação de tela:** o dono pediu navegador só a cada 2–3 sessões. Como a 07 muda o layout inteiro (sidebar) e cria a tela principal do galpão, faço UMA conferência enxuta aqui; as próximas ficam para a 10 e a 12. (Decisão provisória logada.)

## Registro contínuo

- [28/08 00:xx] Leituras obrigatórias feitas; dúvidas respondidas viraram D-28…D-34; cofre atualizado (decisões, perguntas, ordem, demandas 08/11).
- [28/08 00:xx] Branch criada. Repo mapeado: Layout com barra superior (vira sidebar), ModoTablet é página de teste (vira a tela real), QuadroSetor/QuadroKanban/CartaoUnidade prontos para reuso, RPCs amarram autor em `fn_usuario_atual()` (migration 16 resolve).
- [28/08] **Prelúdio D-27 entregue e commitado (`d99b2ec`)**: `docs/design-system.md` → `_docs/Plataforma/PLT - Modelo de Sistema.md` (git mv + frontmatter + regra da microinteração); rota `/design` e `DesignSystem.tsx` removidos (link também saiu de `Inicio.tsx`); dois `CLAUDE.md` + `README.md` atualizados; `Layout.tsx` reescrito como MENU LATERAL (gaveta no celular com overlay, coluna fixa `lg:`; sino + usuário + sair no rodapé da sidebar; barra fina no celular com hambúrguer; `/tablet` renderiza SEM navegação — tela cheia); `Botao` com microinteração (translate -2px + shadow suave em hover/focus-visible, assenta no active; só `enabled:`); varredura D-27: nenhuma string visível com D-NN/RF-NN/Q-NN (códigos viraram comentários) — sobraram só nomes de teste (não é UI). Lint pegou `set-state-in-effect` no Layout → corrigido fechando a gaveta no onClick do link (sem useEffect). tsc + eslint verdes.
- Rotulo do menu para /tablet mudou de "Modo tablet" para **"Tela do setor"** (é o que ela vira nesta sessão).
- [28/08] **Migration 16 (`b6992aa`) escrita, testada (2 rodadas + 8 verificações novas no harness) e APLICADA no banco real** (integração intacta, estrutura idêntica). Conteúdo: mensagens de erro do banco sem códigos internos (recriadas `fn_gerar_matricula`, `fn_validar_execucao`, `fn_validar_qualidade`, `fn_reagir_qualidade`); RPCs `plt_fn_mover_card`/`plt_fn_registrar_parecer` com `p_operador_id` (drop+create — assinatura nova; gate: operador ativo + setor envolvido/admin); tabelas `plt_horarios_funcionamento` + `plt_pausas_tempo` (RLS: leitura authenticated, escrita admin) + `plt_privado.fn_tempo_util` (multirange, fuso America/Fortaleza, interseção setor∩usuário − pausas); `plt_cards` na publicação realtime (guardado p/ PGlite); bucket `plt-imagens` público-leitura + 3 policies (guardado + exception p/ insufficient_privilege). Advisors: mesmos 8 WARN esperados + leaked-password (pré-existente, fica com a publicação — D-30); bucket=1, policies=3, realtime=1 confirmados por SQL.
- Armadilha evitada: `execute` no plpgsql roda UM comando — policies de storage em executes separados; e adicionar parâmetro com default a função existente cria SOBRECARGA (drop da assinatura antiga antes do create, com re-grants).
