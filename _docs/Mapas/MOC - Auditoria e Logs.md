---
titulo: "Mapa — Auditoria e Logs"
tipo: mapa
area: auditoria-logs
atualizado: 2026-11-25
tags: [mapa, moc, area/auditoria-logs]
---

# 🗺️ MOC - Auditoria e Logs

> **Toda atividade de usuário gera registro no banco.** A Auditoria (painel do super admin) mostra o rastro de tudo — quem, quando, onde, o quê — e a trilha diz por que cada página abriu. O que uma automação fez fica marcado mesmo depois de a automação ser excluída.

**No código:** `src/auditoria/` · `src/logs/` · `src/paginas/Auditoria.tsx`

**Perguntas em aberto:** nenhuma registrada para a área — [[PLT - Perguntas em Aberto]]

## Últimas sessões da área (a mais nova primeiro)

- **52** · [[SESSAO-52 - Datas e Textos Certos na Busca Devolucao Pedidos e Auditoria]] · [[handoff_2026_11_18_sessao52_datas_e_textos_certos|handoff]] — ✅ no ar (25/11)
- **48** · [[SESSAO-48 - Cancelar Fabricacao de Verdade - Peca de Pedido Pergunta o Destino]] · [[handoff_2026_11_11_cowork_sessao48_cancelamento_e_recargas|handoff 1]] · [[handoff_2026_11_11_sessao48_cancelar_fabricacao_recargas|handoff 2]]
- **29** · [[SESSAO-29 - Reconciliacao Tiny - Pente-fino e Ultimo Pacote Vence]] · [[handoff_2026_10_01_sessao29_reconciliacao_tiny|handoff]]
- **27** · [[SESSAO-27 - Automacoes em Canvas]] · [[handoff_2026_10_02_sessao27_automacoes_canvas|handoff]]
- **13** · [[SESSAO-13 - Navegacao Perfil e Identidade]] · [[handoff_2026_08_28_sessao13_navegacao|handoff]]

<!-- gerado:inicio -->
## Decisões vigentes (3)

- [[D-040 - Auditoria total toda atividade de usuario gera log persistido|D-40]] · Auditoria total: toda atividade de usuário gera log persistido
- [[D-095 - Auditoria no Painel admin o rastro de tudo quem quando onde|D-95]] · Auditoria no Painel admin: o rastro de tudo — quem, quando, onde, o quê e porquê
- [[D-107 - Excluir automacao some de vez o que ela fez FICA na Auditoria|D-107]] · Excluir automação: some de vez; o que ela fez FICA na Auditoria, marcado "automação…

## Provisórias ⏳ — valem até o dono dizer o contrário (3)

- [[D-305 - A trilha diz por que a pagina abriu|D-305]] · A trilha diz por que a página abriu
- [[D-329 - So a logistica o PCP e o admin escolhem Limpar da producao|D-329]] · Só a logística, o PCP e o admin escolhem "Limpar da produção"
- [[D-345 - A Auditoria traduz a configuracao do painel de tempos na hora|D-345]] · A Auditoria traduz a configuração do painel de tempos na hora de mostrar

## Onde mais ler (só o que a demanda tocar)

- **Banco:** [[Banco - Usuarios Acesso e Logs]]
- **Lições:** [[Memoria - Acesso Seguranca e Credenciais]]
- **Design:** [[Design - Meu Painel Chat Automacoes e Tech]]
<!-- gerado:fim -->
