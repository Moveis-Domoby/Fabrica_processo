---
titulo: Handoff — 2026-10-23 · SESSAO-40 (lançar qualquer produto para produção, o filtro por pedido nos quadros e a busca geral dos cards)
tipo: handoff
data: 2026-10-23
atualizado: 2026-10-23
tags: [handoff, sessao, sessao-40, estoque, kanban, pcp, busca, rastreabilidade]
---

# 📋 Handoff — SESSAO-40 · Lançar qualquer produto, filtro por pedido e a busca geral (23/10/2026, sessão noturna)

> Demanda: [[SESSAO-40 - Lancar Qualquer Produto Filtro por Pedido e Busca Geral]]. Diário: [[SESSAO-40]]. Ditada pelo dono na conversa em 23/10 de madrugada, com um vídeo do Trello, para rodar **sem perguntas** ("eu não estarei acordado") e com a autorização na própria mensagem: testar no navegador logado por ele (e apagar o rastro), **aplicar em produção e subir para a main**. As escolhas que o dono não fez estão como provisórias (seção 3).

## 1. Objetivo da sessão

1. **Estoque:** um botão para lançar para produção **qualquer produto, a qualquer momento** — mesmo com o estoque mínimo já coberto — "da mesma maneira do ícone vermelho".
2. **O vídeo (Trello):** (a) o **filtro do quadro** — digitar o número do pedido e cada coluna mostrar só os cards dele, com quantos batem ("em todos os setores… esse filtro"); (b) a **pesquisa geral** — achar o card em todos os quadros e dizer onde ele está ("facilitaria muito para a rastreabilidade dos cards"). O vídeo foi visto quadro a quadro e a fala transcrita (modelo de fala local).

## 2. O que foi feito (**✅ no ar em 23/10/2026** — banco aplicado e site publicado, com a autorização da mensagem do dono)

**Estoque — lançar qualquer móvel (D-186):** o ícone da fábrica ao lado do "Mínimo" agora aparece em **todo** móvel da aba dos acabados, para quem mexe no estoque: **vermelho pulando** quando falta peça e a reposição automática está desligada (como antes) e **discreto** (cinza) no resto — no mínimo, fora do Top X, sem mínimo, com a automática ligada. No detalhe do produto (tocar na foto) há também o botão por extenso **"Lançar para produção"**. O lançamento é o de sempre (1 a 500, nasce no PCP → Reabastecimento, o PCP decide, parada 2 dias úteis sai sozinha); sem falta, a quantidade proposta é 1 e o texto avisa "Nada falta para o mínimo agora — a reposição nasce no PCP do mesmo jeito". Se o produto **já tem uma reposição esperando no PCP**, a nova nasce **ao lado**. O clique duplo não cria duas (conferido no site: dois toques, um card).

**O filtro dos quadros (D-187):** no topo de **todo quadro de setor** (SECC, CNC, FITAMENTO, FURAÇÃO, MONTAGEM, LIMPEZA E EMBALAGEM), no **modo tablet** e no **PCP** (Reabastecimento, Aguardando liberação, Stand-by), o campo **"Filtrar: nº do pedido ou nome do móvel"**. Só números = o pedido que **começa** com eles ("13722", "pedido 13722", "#13722"); letras = o nome que **contém** o texto, sem acento e sem maiúscula ("armario aereo" acha "Armário Aéreo"). Cada coluna mostra só o que bate e diz **"N cards batem com o filtro"** (o "N cartões correspondem aos filtros" do Trello); o título diz o total; "Ver mais" respeita o filtro; o ao vivo continua; o "x" (ou Esc) limpa. O filtro fica no endereço (`?filtro=13722`) — dá para mandar o link.

**A busca geral (D-188):** a **lupa ao lado do sino** (no menu do computador e na barra do celular) e **Ctrl+K** de qualquer tela. Digita o número do pedido (2 números ou mais) ou o nome (3 letras ou mais) e vê **os cards de todos os setores** com **onde cada um está**: "LIMPEZA E EMBALAGEM · A LIMPAR", "MONTAGEM · MONTANDO", "FITAMENTO · A FITAR", "Pronta, na Expedição · na rota de 24/10 — Baú", "No ESTOQUE", "Nas ROTAS", "PCP · aguardando liberação", "Entregue em 22/10", "Concluído em…", com o selo "Pedido cancelado" quando o Tiny cancelou. Tocar abre a **janela do card**; o ícone ao lado (só setor de produção e PCP com o pedido ainda lá) abre o **quadro do setor já filtrado** pelo pedido. Cada pessoa só acha o que já pode ver.

**Banco — 1 atualização ✅ APLICADA em 23/10 (~06:00 UTC), sozinha (`--so`), com a integração do Tiny idêntica (estrutura e linhas):** `20261024010000_plt_lancar_filtro_busca.sql` —
- a regra "uma reposição aberta por produto" passa a valer só para a automática e para o lançamento sem a chave do gesto; o lançamento da tela nova leva a chave (o mesmo toque devolve o mesmo card);
- `plt_cards.nome_busca` (o nome do card sem acento, maiúscula e espaço, **guardado** — coluna gerada) com índice de trigramas;
- o filtro dos quadros resolvido **uma vez por quadro** (`fn_filtro_do_quadro`, `fn_quadro_filtrados`), com `p_filtro` nas portas do quadro, do "Ver mais" e do PCP (o site de antes segue funcionando — parâmetro novo com padrão);
- a porta da busca geral `plt_fn_busca_cards` (pelo número: o pedido mais novo primeiro, andando as faixas do número até encher a página; pelo nome: o vivo e o mais novo primeiro, por trigramas; por cursor).

**Site:** a casca ganhou a lupa (a busca é pedaço próprio: 3,4 KB, só baixa ao abrir); o quadro do setor, o tablet e o PCP ganharam o campo; o Estoque ganhou o ícone em todo cartão. **JS inicial 222,6 → 223,0 KB** (teto 250).

## 3. Decisões (D-186…D-188) — as provisórias para o dono confirmar

| O quê | Ficou | Confirmar |
|---|---|---|
| Reposição quando já há outra esperando no PCP | a nova nasce **ao lado** (outro card) — "a qualquer momento" vale também aí | ok? (a outra opção seria somar na que já está) |
| O ícone sem falta | o mesmo ícone, **cinza**, no mesmo lugar; vermelho pulando só quando falta e a automática está desligada | ok? |
| O que o filtro e a busca entendem | só números = pedido que **começa** com eles; letras = nome que **contém** | ok? |
| A busca: o que entra | o card do pedido, as peças vivas, as peças de pedido já entregues, a reposição no PCP e o avulso; **fica de fora** a peça sem pedido que já saiu do estoque | ok? |
| A busca: a ordem | pelo número, o **pedido mais novo primeiro** (entregue ou não); pelo nome, o **vivo primeiro** | ok? |
| Mínimo para buscar | 2 números ou 3 letras (o índice do nome precisa de 3) | — |

## 4. Como testar (roteiro do dono — passo a passo)

> Pode testar no site normal: https://sistema-domoby.vercel.app (se a tela estiver aberta desde ontem, aparece "Saiu uma versão nova" — toque em Atualizar).

**A) Estoque — lançar qualquer produto**
1. Fábrica → Logística → **Estoque** (aba dos mais vendidos).
2. Olhe o cantinho de cada cartão, ao lado de "Mínimo": todo móvel tem o **ícone da fábrica**. Os que **faltam** peça estão **vermelhos pulando**; os outros, **cinza**.
3. Toque no ícone **cinza** de um produto que já está no mínimo → abre "Lançar para produção" com a quantidade **1** e o aviso "Nada falta para o mínimo agora…". Mude a quantidade se quiser e toque **Lançar ao PCP**.
4. Vá ao **PCP → Reabastecimento**: a reposição está lá ("Repor N unidades"). Lance de novo o MESMO produto: nasce **outra** reposição ao lado.
5. Toque na foto de um produto (o detalhe): o botão **"Lançar para produção"** por extenso também está lá.
6. Para tirar o teste: no PCP → Reabastecimento, **Não produzir** → **Sim, não produzir**.

**B) O filtro do quadro (o do vídeo)**
1. Fábrica → Controle de produção → **Limpeza e embalagem**.
2. No campo **"Filtrar: nº do pedido ou nome do móvel"** (acima das colunas), digite um pedido que está no setor (ex.: o número de um card da tela).
3. Confira: o título vira "**N cards batem com o filtro "…"**"; cada coluna mostra só os cards daquele pedido e diz "**N cards batem com o filtro**" (ou "nenhum card bate com o filtro").
4. Troque por um nome: "**armario aereo**" (sem acento) → aparecem os Armários Aéreos.
5. Toque no **x** do campo → o quadro volta inteiro.
6. Repita em outro setor (MONTAGEM, FURAÇÃO…) e no **PCP** (as três abas). No tablet (Modo tablet), o mesmo campo fica no topo do quadro.
7. Copie o endereço com o filtro (ex.: `…/limpeza_embalagem?filtro=13722`) e abra noutra aba: já abre filtrado.

**C) A busca geral (a pesquisa do vídeo)**
1. Em qualquer tela, toque na **lupa ao lado do sino** (ou aperte **Ctrl+K** no computador).
2. Digite um número de pedido (ex.: **137** para ver todos os 137xx, ou o número inteiro).
3. Confira: cada resultado diz **de qual pedido é, qual móvel e onde está** (setor · etapa, Expedição, ESTOQUE, ROTAS, PCP, "Entregue em…").
4. Toque num resultado → abre a **janela do card**.
5. No ícone de quadradinhos à direita de uma peça num setor de produção → abre o **quadro daquele setor já filtrado** pelo pedido.
6. Busque por nome: "**estante**", "**multiuso**" → os cards de todos os setores com esse móvel, os vivos primeiro.
7. Com 20 resultados ou mais, "**Ver mais**" no fim traz os próximos.
8. No celular: a lupa fica na barra de cima, ao lado do sino; a busca sobe de baixo.

## 5. Verificação (o que foi conferido)

- **Bateria do banco:** 1.287 conferências, tudo verde — com o bloco novo (filtro do setor por número/prefixo/nome/sem acento, "Ver mais" com o filtro, filtro do PCP, lançar com e sem a chave, clique duplo, a automática não duplica, reservados somam as duas, a busca pelo número/nome/cursor/visibilidade/entregue, as permissões e as assinaturas antigas fora).
- **Testes de tela:** 291 verdes (6 novos — onde o card está, o atalho do quadro, a régua da busca); verificador de estilo limpo; montagem com o JS inicial em 223,0 KB.
- **Ensaio ×100** (562.700 pedidos, 95 mil cards, 7.700 vivos na LIMPEZA — `Execucao/dados/SESSAO-40 - ensaio x100…`): busca geral 5–23 ms (operador, número: 56 ms); quadro filtrado 57–142 ms × o quadro sem filtro 137 ms (o filtro nunca fica mais lento que o quadro inteiro); PCP filtrado 60–102 ms × 121 sem filtro; lançar 12 ms. A 1ª versão era lenta (busca por nome 290 ms–1,9 s; quadro filtrado até 900 ms) — corrigida antes de subir (o nome guardado no card, o filtro resolvido uma vez, a busca por número que para quando a página enche).
- **Banco real, como o dono (sem gravar):** busca "137" 7 ms · "estante" 1,5 ms · quadro da Limpeza 11 ms · filtrado por "137" 9 ms (12 cards) · PCP filtrado 6 ms.
- **No site publicado, logado como o dono:** Limpeza filtrada por **13722** → "3 cards batem" (1 em A LIMPAR, 2 na EXPEDIÇÃO), como no vídeo; "ARMÁRIO aéreo" → 3; o "x" limpa; Ctrl+K "13721" → "Entregue em 22/10"; "137" → os 137xx em PCP, Expedição, MONTAGEM, FITAMENTO, LIMPEZA; tocar abre a janela do card; o atalho abre a MONTAGEM filtrada por 13727 (1 card, em MONTANDO); Estoque: 30 cartões com o ícone (12 vermelhos, 18 cinza); lançado 1 Armário multiuso com o estoque coberto (clique duplo → 1 card só), achado no PCP pelo filtro "multiuso" e pela busca geral; celular a 375 px sem rolagem lateral. Console sem erro.
- **Rastro apagado:** a reposição de teste saiu pelo "Não produzir" (a conta do produto voltou: 0 esperando no PCP); o histórico guarda o lançamento e a saída (é assim em toda a plataforma — nada se apaga). Nenhum filtro ficou salvo.
- **Não testado ao vivo:** o campo no **modo tablet** (entrar no modo tablet trocaria a sessão do dono no navegador) — é o mesmo componente do quadro, coberto pelos testes de tela.

## 6. Desempenho (Lei — checklist)

- Requisições: o quadro e o PCP seguem com 1 leitura (o filtro vai na mesma porta); a busca = 1 por busca (espera 300 ms parado; 2 números ou 3 letras), "Ver mais" por cursor; nada novo na abertura do app; nenhum relógio, nenhum `postgres_changes`.
- Portas novas/tocadas medidas no ×100 (acima); índices: trigramas no nome guardado, faixas do índice do número dos pedidos; avisos do banco sem tipo novo.
- **Dívida nova (27):** o **quadro do setor sem filtro** leva ~140–190 ms no ×100 (7.700 vivos num setor; hoje, 63 → 11 ms) — a ordem da fila calcula as chaves de todos os cards de cada coluna. Anterior a esta sessão; caminho na lei.

## 7. Pendências e próximos passos

- Confirmar as provisórias da seção 3.
- (Dívida 27) a ordem da fila guardada no card, quando o volume crescer.
- Tarefas no ClickUp (lista PRODUÇÃO): [Estoque - Lançar qualquer produto para produção](https://app.clickup.com/t/17tya50k7kr), [Kanban - Filtro por pedido nos quadros dos setores](https://app.clickup.com/t/17tya50k7kt), [Plataforma - Busca geral de cards em todos os setores](https://app.clickup.com/t/17tya50k7ku) — em FAZENDO, com o comentário de entrega; **quem conclui é o dono**.

## 8. Numeração usada

D-186…D-188 · E-156…E-157 · A-111…A-114 · migration `20261024010000` · ids de teste da bateria `...4001–4002` e produtos `1940401–1940402`. **Seguinte: D-189 · E-158 · A-115.**
