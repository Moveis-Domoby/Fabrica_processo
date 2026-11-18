---
id: D-306
aliases: [D-306]
titulo: "A plataforma abre como aplicativo: um ícone, uma janela só"
tipo: decisao
data: 2026-11-12
status: vigente
revisa: []
revisada_por: []
complementa: ["[[D-304 - O momento seguro de recarregar|D-304]]", "[[D-305 - A trilha diz por que a pagina abriu|D-305]]"]
area: [publicacao-infra, interface]
tags: [decisao, area/publicacao-infra, area/interface, provisoria-em-parte]
---
# D-306 · ✅ DECIDIDA pelo dono (abrir como aplicativo) + ⏳ PROVISÓRIA (os detalhes) — A plataforma abre como aplicativo: um ícone, uma janela só (12/11/2026, ajuste da SESSAO-48; ✅ no ar desde 12/11 ~01:45) — ↪️ D-304, D-305

**Pedido do dono (12/11, na conversa):** depois de ver o que os registros de 10/11 mostraram (o tablet do FITAMENTO com abas da plataforma acumuladas — o atalho da tela inicial abria uma aba nova a cada toque), *"Sim, faz"* à pergunta "Faço a plataforma abrir como aplicativo nos tablets?".

1. **O cartão do aplicativo** (`public/manifest.webmanifest`): nome "Sistema Domoby", nome curto "Domoby" (o que aparece embaixo do ícone), janela própria (`standalone`), endereço inicial "/" — cada conta cai no seu lugar pela regra de sempre (o tablet na tela do setor, o entregador nas entregas, a TV no Modo TV, o escritório no painel; sem acesso salvo, a tela de entrada, onde o tablet entra pelo PIN do setor). Barra no grafite do ícone (#5A585C), tela de abertura no fundo claro do tema padrão (#f7f7f8).
2. **Os ícones** são o do site (o "d" branco com a bolinha amarela no grafite), em 192 e 512 — também na versão de quadrado cheio que o Android usa no ícone adaptável — e o de 180 do iPhone.
3. **Sem service worker** (a peça que guarda arquivos no aparelho): o Chrome instala pelo menu sem ela desde a versão 108 no celular; com ela viria a janela automática de "instalar", mas é justamente o que costuma prender versão velha na tela (o problema da [[D-303 - A versao e o codigo e documentacao nao publica a mudanca|D-303]]). Instala-se pelo menu do Chrome ("Instalar app").
4. **No aparelho, uma vez:** instalar pelo menu, apagar o atalho antigo da tela inicial e fechar as abas da plataforma no Chrome. No aplicativo não há o "puxar a tela para atualizar" do navegador; a versão nova continua chegando sozinha ([[D-304 - O momento seguro de recarregar|D-304]]).
5. ✅ **DECIDIDA pelo dono (12/11):** *"Coloque um botão para o tablet de recarregar a tela, isso deve sanar a parte de abaixar a tela para recarregar"* — o botão **"Atualizar"** (ícone de setas em volta) no cabeçalho da tela do tablet, ao lado de "Trocar setor": recarrega na hora, uma vez só, mostra "Atualizando…" enquanto vai; a Auditoria registra "Abriu a plataforma — atualizou a página" (é a pessoa que atualiza, não a plataforma — sem porquê novo no banco). No celular os botões do cabeçalho descem de linha.
