---
titulo: "Mapa — Interface e Navegação"
tipo: mapa
area: interface
atualizado: 2026-11-25
tags: [mapa, moc, area/interface]
---

# 🗺️ MOC - Interface e Navegacao

> Como toda tela se parece e se navega: menu lateral recolhível, rota sempre pai→filho, botão de voltar, sino, cabeçalho compacto, temas, busca geral (a lupa), textos em português do galpão e nenhum código interno na tela. O detalhe visual está nas notas de design.

**No código:** `src/componentes/` (`ui/`, `Layout.tsx`) · `src/estilos/` (`tokens.css`, `global.css`) · `src/navegacao/` · `src/busca/`

**Notas da área:** [[PLT - Modelo de Sistema]]

**Perguntas em aberto:** Q-30 (referência visual) · Q-33 (idioma dos termos) — [[PLT - Perguntas em Aberto]]

## Últimas sessões da área (a mais nova primeiro)

- **55** · [[SESSAO-55 - Telas que Abrem com Uma Leitura Dashboards Configuracoes e Meu Painel]] · [[handoff_2026_11_18_sessao55_telas_numa_leitura|handoff]] — ✅ no ar (25/11)
- **52** · [[SESSAO-52 - Datas e Textos Certos na Busca Devolucao Pedidos e Auditoria]] · [[handoff_2026_11_18_sessao52_datas_e_textos_certos|handoff]] — ✅ no ar (25/11)
- **40** · [[SESSAO-40 - Lancar Qualquer Produto Filtro por Pedido e Busca Geral]] · [[handoff_2026_10_23_sessao40_lancar_filtro_busca|handoff]]
- **13** · [[SESSAO-13 - Navegacao Perfil e Identidade]] · [[handoff_2026_08_28_sessao13_navegacao|handoff]]
- **07** · [[SESSAO-07 - Tela do Setor Tablet]] · [[handoff_2026_08_28_sessao07_tela_setor|handoff]]
- **01** · [[SESSAO-01 - Fundacao do Repo e Design System]] · [[handoff_2026_08_24_sessao01_fundacao|handoff]]

<!-- gerado:inicio -->
## Decisões vigentes (9)

- [[D-027 - Padroes de interface menu lateral modelo de sistema no cofre|D-27]] · Padrões de interface: menu lateral, modelo de sistema no cofre, microinterações, sem…
- [[D-036 - Lei de navegacao hierarquia pai filho pai nunca navega rota|D-36]] · Lei de navegação: hierarquia pai→filho, pai nunca navega, rota sempre /pai/filho
- [[D-100 - O Painel admin vira Configuracoes nasce o Painel super admin|D-100]] · O "Painel admin" vira Configurações; nasce o Painel super admin (só o dono): Automações…
- [[D-135 - Ajustes de tela do dono|D-135]] · Ajustes de tela do dono
- [[D-161 - O grupo Pedidos do menu mora logo abaixo de Rotas|D-161]] · O grupo "Pedidos" do menu mora logo abaixo de "Rotas"
- [[D-188 - A BUSCA GERAL a lupa ao lado do sino acha os cards de TODOS|D-188]] · A BUSCA GERAL: a lupa ao lado do sino acha os cards de TODOS os setores e diz onde cada…
- [[D-200 - O PEDIDO DE TROCA DE SENHA PARA E-MAIL SEM CADASTRO AVISA|D-200]] · O PEDIDO DE TROCA DE SENHA PARA E-MAIL SEM CADASTRO AVISA OS ADMINISTRADORES; a tela de…
- [[D-284 - Configurar painel em Tempos de producao uma configuracao|D-284]] · "Configurar painel" em Tempos de produção: uma configuração só, do admin, que vale para…
- [[D-306 - A plataforma abre como aplicativo um icone uma janela|D-306]] · A plataforma abre como aplicativo: um ícone, uma janela só

## Provisórias ⏳ — valem até o dono dizer o contrário (6)

- [[D-289 - Detalhes da configuracao do painel|D-289]] · Detalhes da configuração do painel
- [[D-344 - A busca geral diz Entregue em pelo dia real da entrega|D-344]] · A busca geral diz Entregue em pelo dia real da entrega
- [[D-351 - A janela de confirmacao do Comercial pergunta no titulo e|D-351]] · A janela de confirmação do Comercial pergunta no título e avisa no corpo
- [[D-352 - Os avisos do Comercial sao os da casa e somem em 5 segundos|D-352]] · Os avisos do Comercial são os da casa e somem em 5 segundos
- [[D-355 - Durante o gesto a janela fica aberta com o botao girando|D-355]] · Durante o gesto a janela fica aberta com o botão girando
- [[D-365 - API e integracoes rele as tres listas numa chamada so|D-365]] · API e integrações relê as três listas numa chamada só

## Revisadas por outra (1) — só para a história

[[D-134 - A area PEDIDOS Todos os pedidos sai do PCP e Cancelados sai|D-134]]

## Onde mais ler (só o que a demanda tocar)

- **Lições:** [[Memoria - Front Telas e React 1]] · [[Memoria - Front Telas e React 2]] · [[Memoria - Testes e Validacao ao Vivo]]
- **Design:** [[Design - Estoque e PCP]] · [[Design - Fundamentos Tokens e Componentes Base]] · [[Design - Kanban Execucao e Qualidade]] · [[Design - Logistica ROTAS e Pedidos]] · [[Design - Meu Painel Chat Automacoes e Tech]] · [[Design - Navegacao Menu Cabecalho e Perfil]]
<!-- gerado:fim -->
