---
titulo: Handoff — 2026-10-28 · Ajuste (o aviso da troca de senha que "não chegava" e a peça em produção ligada ao pedido novo pelo PCP)
tipo: handoff
data: 2026-10-28
atualizado: 2026-10-28
tags: [handoff, ajuste, senha, notificacao, pcp, reposicao, estoque]
---

# 📋 Handoff — Ajuste de 28/10/2026 · senha e peça em produção no PCP

> Pedido do dono na madrugada de 28/10 (dois ajustes rápidos). Diário: [[AJUSTE-2026-10-28]]. Decisões: [[PLT - Decisoes de Produto#D-200]] e [[PLT - Decisoes de Produto#D-201]]. O Claude levou 4 perguntas; o dono respondeu: corrigir a senha "dos dois lados"; a peça de reposição **e** a de pedido cancelado; a reposição "só perde a peça"; "ler e subir no fim".

## 1. Objetivo

1. **Troca de senha:** "a notificação não chega no momento correto para o Admin — ele precisou entrar e sair". Investigar e tratar a causa.
2. **PCP:** quando chega um pedido de venda de um móvel que já está em produção como reposição de estoque, ligar o pedido a essa peça pelo PCP (transformar o card da reposição em card do pedido).

## 2. O que foi feito

1. **A causa do aviso "atrasado" (registros do servidor + leitura do banco):** o primeiro pedido de troca foi feito com o e-mail **digitado errado** (faltou o "l" de "gmail"). Pela regra de sempre mostrar a mesma mensagem, a plataforma não fez nada e ninguém soube. O administrador conferiu a Equipe, recarregou, saiu; a pessoa pediu de novo com o e-mail certo nesse meio-tempo, e ao entrar o aviso abriu na hora. O aviso ao vivo funcionava — o pedido é que não existia.
2. **Correção dos dois lados (D-200):** na tela "Esqueci minha senha", **"Você quis dizer …?"** para erro comum no fim do e-mail (corrige com um toque; roda no aparelho, sem consultar o banco — ninguém descobre quem tem cadastro); no **sino dos administradores**, o aviso **"Troca de senha: e-mail sem cadastro"** com o e-mail digitado (uma vez por e-mail, enquanto não lido). E quando um administrador **decide**, o aviso urgente **sai na hora** das outras telas abertas (dos outros administradores e das outras abas) — antes ficava até recarregar; e o pedido que chega com o aviso já aberto entra na lista.
3. **A peça em produção no PCP (D-201):** na janela **Liberar unidades** do pedido, o móvel que não tem peça pronta no estoque mas tem uma **igual sendo produzida sem dono** (reposição de estoque, ou pedido cancelado que segue em produção) ganha **"Há N igual(is) em produção, sem dono — usar?"**, com onde ela está e de onde veio (a mais adiantada primeiro; danificada não entra; vem desmarcada). **Usar:** a peça passa a ser do pedido **onde está** — setor, etapa, quem trabalha nela e o tempo seguem; o card passa a mostrar o pedido, o cliente, o prazo e a prioridade dele; pronta, vai para **Pedidos em aguardo**. A reposição **só perde a peça** (o estoque espera uma a menos; se faltar, a automática ou a logística lançam de novo). Fica na história da peça.

## 3. Como testar (roteiro do dono — passo a passo)

> No site normal: https://sistema-domoby.vercel.app — se a tela estava aberta, aparece "Saiu uma versão nova": toque em Atualizar.

**A) A sugestão do e-mail (qualquer aparelho, sem entrar)**
1. Tela de entrada → **Esqueci minha senha**.
2. Digite um e-mail com erro no fim, ex.: `fulano@gmai.com` → aparece embaixo **"Você quis dizer fulano@gmail.com?"**.
3. Toque nela: o campo corrige e a sugestão some. (Com um e-mail certo ou de empresa, nada aparece.)

**B) O aviso do e-mail sem cadastro (um aparelho + um computador logado como administrador)**
1. No aparelho: **Esqueci minha senha** → digite um e-mail que **não** está cadastrado → **Trocar minha senha** → **Solicitar troca**. A mensagem é a mesma de sempre.
2. No computador do administrador: o sino ganha na hora **"Troca de senha: e-mail sem cadastro"**, com o e-mail digitado. Pedir de novo com o mesmo e-mail não repete o aviso (enquanto não for lido).

**C) Decidiu, sumiu (dois computadores — ou duas abas — logados como administrador)**
1. Peça a troca de um e-mail cadastrado (usuário de teste).
2. O aviso urgente abre nas duas telas. Em uma, toque **Liberar troca** (ou **Não liberar**).
3. Na outra tela, o aviso **some sozinho** (sem recarregar).

**D) A peça em produção no PCP**
1. Fábrica → **PCP** → **Pedidos aguardando liberação** → um pedido → **Liberar unidades**. (Hoje, 28/10, o pedido **13215** já mostra uma: uma peça de reposição na FURAÇÃO.)
2. No móvel que tiver, aparece o quadro azul **"Há 1 igual em produção, sem dono — usar?"** com "Em FURAÇÃO · … · era da reposição de estoque" (ou "era do pedido N, cancelado").
3. Marque: o "Setor de destino" daquele móvel some (não precisa). Libere.
4. Confira: o aviso diz "… que já estava em produção"; no quadro do setor onde a peça está, o card agora mostra o **pedido e o cliente** (no mesmo lugar, com o mesmo tempo); abrindo a linha do tempo do card: **"Passou a ser de um pedido"**; no Estoque, o móvel tem uma a menos "a caminho"; a reposição no PCP **não** pede a peça de novo.
5. Pronta (concluída na LIMPEZA E EMBALAGEM), a peça vai para **Pedidos em aguardo**.

## 4. Verificação

- **Bateria do banco:** 1.398 verdes, 0 falhas — 16 novas (o aviso do e-mail sem cadastro e o "não repete", o decidir tirando o aviso de todos, a peça da reposição e a de cancelado ligadas onde estão, o fato na história, o fim do tempo em PCP, a reposição que só perde a peça e não reabre a vaga, peça de outro pedido / móvel diferente / danificada / quem não é do PCP recusados, as permissões).
- **Testes de tela:** 325 verdes + 1 instável conhecido (a tela de API só na suíte inteira; sozinho, verde); 4 novos da sugestão do e-mail; tipos e lint limpos; site montado: **JS inicial 227,7 KB** (teto 250).
- **Vitrine local** (as telas reais com dados de mentira, nenhuma chamada ao banco — apagada antes do commit): a janela de liberação no computador e no celular, o que a tela manda ao banco, a conferência do "setor de destino" (a ligada não pede), o aviso de sucesso; a sugestão do e-mail; o sino com o aviso novo.
- **Produção (28/10, depois de subir — leitura como o dono, sem gravar nada):** o corpo das funções no banco = o dos arquivos; o tipo novo do fato no check (validado); o gatilho no lugar; a maquinaria fora da API; as 11 janelas de liberação dos pedidos no PCP abrem — a do **13215** já traz 1 peça em produção (FURAÇÃO, reposição); a janela ~15 ms, a conta nova ~6 ms. Hoje: 78 peças de reposição e 2 de pedido cancelado em produção.

## 5. Desempenho (Lei — checklist)

- **Uma requisição por tela:** mantida — as peças em produção vêm na MESMA resposta da janela; a liberação segue 1 chamada numa transação.
- **Dado escondido só no clique:** a janela só abre no toque de "Liberar unidades".
- **Tempo real por websocket:** o aviso novo e o "decidiu, sumiu" vão pelo canal pessoal de sempre; nada de consulta por intervalo; a sugestão do e-mail é do aparelho.
- **Ensaio ×100** (562.700 pedidos, 99 mil cards, 3 mil peças sem dono em produção): janela do pedido 3–14 → 11–24 ms (a conta nova ~8 ms, depois de cortar de 30–37 ms — E-166); reposição 2 → 3 ms; liberar ligando ~17 ms.
- **Índices:** as candidatas andam pelos índices que já existiam (peças sem dono por produto; peças de pedido por SKU); nenhuma tabela nova.

## 6. Achados de passagem (para o dono decidir — não mexidos)

- **O sino com aviso já lido mostra uma barrinha de rolagem lateral** (a área de toque da lixeira passa 2 px da borda do painel).
- **Quem pede a troca de senha, se for administrador, recebe o próprio aviso urgente** (e poderia liberar a própria troca se estivesse logado em outro aparelho).
- (Corrigido aqui) o aviso urgente decidido por um administrador ficava nas outras telas até recarregar.

## 7. Pendências e próximos passos

- ✅ **Subiu em 28/10** com o OK do dono (*"Ler e subir no fim"*): as 2 atualizações do banco (uma a uma, integração do Tiny idêntica) e o site.
- Seguem as pendências da SESSAO-41 (os 2 cliques no painel da Supabase; as provisórias D-189…D-196 e as 3 da D-199; dívidas 28–30).
- **ClickUp:** estes ajustes não têm tarefas — o dono decide se cria (regra 19).

## 8. Numeração usada

D-200 · D-201 · E-166 · A-123…A-125 · migrations `20261028010000` e `20261028020000` · ids de teste `...4281–4282`, produtos `1942801–1942803`, pedidos `942801–942803`. **Seguinte: D-202 · E-167 · A-126.**
