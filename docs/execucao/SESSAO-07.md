# Memória de execução — SESSAO-07 · Tela do Setor (Tablet)

**Branch:** `sessao-07-tela-setor` · **Início:** 2026-08-28 (bloco noturno D-26)
**Demanda:** `_docs/Plataforma/Demandas/SESSAO-07 - Tela do Setor Tablet.md`
**Decisões novas que regem o bloco:** D-28 (card do operador: dados do produto + imagens + som discreto + modo setor), D-29 (controle de tempo do admin), D-30 (deploy adiado), D-27 (prelúdio de padrões).

## Task list (espelho da demanda + D-27 + D-28 + D-29)

1. [ ] Prelúdio D-27a — menu lateral (sidebar) no lugar da barra superior; recolhível no celular
2. [ ] Prelúdio D-27b — remover rota/aba "Design system"; migrar `docs/design-system.md` → `_docs/Plataforma/PLT - Modelo de Sistema.md`; atualizar os DOIS `CLAUDE.md`
3. [ ] Prelúdio D-27c — microinteração do `Botao`: elevação leve (1–2px) + sombra suave
4. [ ] Prelúdio D-27d — varredura de códigos internos (D-NN/RF-NN/Q-NN) em texto de UI: front E mensagens de erro do banco (migration)
5. [ ] Banco (migration 16): `p_operador_id` nas RPCs mover/parecer (gesto por PIN no tablet) · mensagens sem códigos · realtime em `plt_cards` · bucket `plt-imagens` + policies · tabelas D-29 (`plt_horarios_funcionamento`, `plt_pausas_tempo`) + helper de tempo útil + RLS
6. [ ] Tela do setor (modo tablet real): fila em tela cheia ordenada por chegada, destaque para os mais antigos, tempo real (Realtime + fallback polling), som discreto na chegada (D-28)
7. [ ] Ações no card com PIN: receber (parecer) · iniciar · finalizar · mover (com marcação) — autores distintos no mesmo tablet
8. [ ] Card do operador: todos os dados do produto, zero dados de cliente, espaço de imagens (D-28)
9. [ ] Upload/galeria de imagens por produto (admin/líder anexa; operador vê)
10. [ ] Admin — controle de tempo (D-29): horário de funcionamento por setor/usuário, desligar/religar agora, correção retroativa
11. [ ] A mesma experiência no celular pessoal logado (setor do usuário)
12. [ ] Verificação: tsc · lint · vitest · `test:banco` (2 rodadas) → aplicar migration → `get_advisors` → conferência de tela enxuta (é a sessão de UI)
13. [ ] Conferir task list contra a demanda · commit/merge na main (autorizado D-26)
14. [ ] Handoff em `_docs/Handoffs/` + memória de aprendizado + arquivo de continuidade do bloco

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
