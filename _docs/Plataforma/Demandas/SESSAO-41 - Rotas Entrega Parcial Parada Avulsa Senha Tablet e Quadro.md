---
titulo: SESSAO-41 — Entrega parcial, parada avulsa, endereço e data de entrega, recuperar senha com segurança, tablet que não cai e o quadro com rolagem na coluna
tipo: demanda
status: 🔨 em execução (27/10/2026)
data: 2026-10-27
atualizado: 2026-10-27
tags: [plataforma, demandas, rotas, entrega, senha, seguranca, tablet, kanban]
---

# SESSAO-41 — Rotas, senha, tablet e quadro (27/10/2026)

> Ditada pelo dono na conversa em 26–27/10/2026, com dois vídeos (o quadro do Trello × o da plataforma; o endereço de entrega no Tiny × o da programação). O Claude levou o entendimento e 10 dúvidas com sugestão; o dono respondeu todas (abaixo, texto fiel) e acrescentou a data de entrega e o endereço de entrega. **Banco e funções em produção: só com o OK do dono, à parte** (regra 2).

## O pedido do dono (texto fiel)

> * Nas rotas: Coloque um botão de opção de entrega parcial (adicionando o que foi entregue do referente pedido e campo de observação) -> Deve ser para itens de um pedido, por exemplo, um pedido é composto por quatro moveis, porem por algum motivo adverso, foi entregue apenas 3 deles e um retornou a fabrica, deve contabilizar o pedido como entregue parcialmente e o produto que retornou deve ficar para decisão do mesmo setor que trata os pedidos devolvidos, eles irao avaliar se foi o clioente que nao quis o tal produto, ou se o produto chegou avariado e será devolvido para a produção resolver, enfim, o caminho seguinte irá depender dessa parte da logistica
> * Adicionar parada avulsa na rota durante a hora da programação, ou até mesmo quando estiver em rota, o próprio entregador, ou a pessoa responsável por controlar as rotas deve conseguir adicionar uma parada para o caminhão no momento que quiser, durante a programação coloque a opção de digitar um endereço tambem e ele aparece pinado no mapa e no quadrozinho dos pedidos programados tambem, que agora nao será mais pedidos programados, mas sim rota programada
> * Botão de recuperar minha senha na tela de login, esse botão deve enviar uma notificação para um admin, notificação de urgencia, um aviso na tela mesmo com um botao de liberar troca, opu de nao liberar, se liberar troca para aquele email, a pessoa clica em trocar minha senha, digita o email dela e ja direto consegue trocar, se nao estiver liberado para troca de senha, aparece apenas o botao de solicitar, se o email nao estivaer cadastrado no banco, aparece apenas uma menmsagem generica. Lembre de revisar politas de segurança para bloquear testes comuns que hackers e pessoas mal intencionadas fazem, seja bloquear injeçao de sql no login, teste de força bruta, edição de acesso via api e coisas do tipo
> * A sessão no modo tablet nos setores estão sempre "expirando" então o pessoal precisa ficar saindo e entrando no setor pra conseguir movimentar os card; Resolva esse ponto tambem, remova a expiração por inatividade, coloque para uma hora, antes disso, ele apenas fica ausente se nao estiver com nenhum card em nenhum setor sendo executado em um intervalo de 15 minutos
> * Lista do kanban estatica com rolagem apenas dentro da propria listaa, nao no quadro todo, veja o video em anexo para entender melhor

**Acréscimo (27/10, na resposta):**

> Esqueci de solicitar, mas coloque tambem a possibilidade de alterar a data de entrega de umn pedido, ou até mesmo de remover essa data, mas isso nao deve afetar o tiny, apenas a platforma mesmo, porem se mudar no tiny, muda na plataforma tambem. Avalie tambem o video em anexo agora e entenda a solicitação, tambem tem a ver com a entrega, porem dessa vez com o local do pedido

## Os vídeos

1. `Downloads/WhatsApp Video 2026-10-26 at 19.54.53.mp4` (26 s): o Trello (lista STAND BY) × a MONTAGEM da plataforma. Fala: *"aqui no Trello a lista fica estática, e a rolagem é só na lista; então eu não consigo visualizar para qual lista eu vou mover… enquanto aqui a rolagem é na tela completa; se eu precisar mover esse aqui para qualquer outra lista, eu não sei para qual lista eu estou movendo"*.
2. `Downloads/WhatsApp Video 2026-10-26 at 11.46.43.mp4` (39 s): o pedido 13660 no Tiny (Pamela Stefany) — "Dados do cliente" no Alecrim (Natal) × "Endereço de entrega" em Nova Parnamirim (Parnamirim). Fala: *"o que importa para a logística é o endereço de entrega e não o endereço de cadastro; quando a gente vem aqui na programação ele está pegando o endereço do cadastro do cliente… quando não tiver endereço diferente do endereço do cadastro você usa esse endereço como o endereço de entrega; caso tenha endereço de entrega você usa esse endereço aqui"*. No banco: o endereço de entrega já chega em `pedidos.endereco_entrega` (191 pedidos com ele; 9 nos últimos 30 dias) — nenhuma tela o usa.

## As respostas do dono às 10 dúvidas (27/10, texto fiel)

> 1 - O próprio entregador pode marcar entregue parcialmente e selecionar um motivo pré criado em utilitários ou adicionar um campo de observação
> 2 - Perfeito *(motivo de lista + observação obrigatória quando algo volta)*
> 3 - Sim, siga com a sugestão *(o Tiny não muda na entrega parcial)*
> 4 - Siga dessa forma *(a parada avulsa: título curto, endereço com o pino ajustável, observação, "Feita / Não feita")*
> 5 - Eles podem arrastar assim que adicionar a nova parada avulsa e deixar o momento exato em que eles irão parar nela, o resto dos pedidos eles nao devem conseguir mexer, apenas a pessoa responsavel pelas rotas no computador e os admins/super admin
> 6 - Isso mesmo *("rota programada" = o quadro "Na rota" do Programar e a lista de Já programadas, com pedidos e avulsas na ordem)*
> 7 - Isso mesmo *(quem libera a troca de senha: os administradores e o super admin)*
> 8 - Pode ser, mas aumente isso para 2horas, não tem problema *(a liberação vale 2 h, uma troca só, só no aparelho que pediu)*
> 9 - Pode ser *(sempre "Solicitar troca" e a mesma mensagem genérica — ninguém descobre quem tem cadastro)*
> 10 - o proprio tablet nao deve deslogar nunca da conta do setor, ele deve apenas deslogar as pessoas qu estão dentro do setor naquele momento depois do tempo informado. De qualquer forma, mesmo que a pessoa nao esteja no setor, ou esteja ausente, ela nao deve ter que logar novamente para movimentar os cards, elas apenas movimentam e colocam o pin dela, assim que o pin for digitado, o sistema ja deve reconhecer quem é a pessoa, movimentar o card e logar ela no setor, sem ela precisar fazer mais nada

## O diagnóstico do tablet (registro do servidor, 26/10)

Não era tempo parado. A entrada pelo PIN do setor **troca a senha da conta do tablet a cada entrada** — e a troca derruba as sessões abertas dos OUTROS aparelhos do mesmo setor (a MONTAGEM abriu 18 sessões em 26/10, de minutos em minutos a partir das 16:45; só 1 viva por conta no fim do dia; 101 recusas "sessão não encontrada" na função de login e 32 renovações recusadas). E o **"Sair" encerrava a conta em TODOS os aparelhos** (o padrão da biblioteca é "global"). Um aparelho entra → derruba o outro → alguém digita o PIN no outro → derruba o primeiro.

## As frentes

| Frente | O quê |
|---|---|
| F1 — Tablet | Cada aparelho com a própria sessão (entrar num não derruba o outro; sair de um não mexe nos outros); o tablet **nunca** sai sozinho; a PESSOA: 15 min sem card em execução em nenhum setor → ausente; 1 h → sai do setor sozinha; qualquer gesto de card com o PIN reconhece a pessoa, faz o gesto e a põe no setor |
| F2 — Quadro | Coluna com altura da tela e rolagem só dentro dela (cabeçalho sempre à vista), no PC e no tablet |
| F3 — Senha e segurança | "Esqueci minha senha" → aviso urgente na tela dos admins (Liberar / Não liberar) → troca no aparelho que pediu, por 2 h, uma vez; mensagem genérica sempre; + revisão de segurança (injeção, força bruta, acesso pela API, cadastro aberto, trava contornável) |
| F4 — Entrega parcial | O entregador (e a logística) marca quais peças foram entregues, com motivo de lista (Utilitários) e/ou observação; o pedido fica "entregue em parte"; as peças que voltaram vão para "Em decisão pós devolução" e o "Decidir situação" da logística; o Tiny não muda |
| F5 — Parada avulsa | Parada com título, endereço digitado (pino no mapa, ajustável), observação, Feita/Não feita; na programação e com a rota em andamento (entregador e logística); o entregador arrasta SÓ a avulsa que acabou de pôr; o resto da ordem só a logística no PC e os admins; "Rota programada" no lugar de "pedidos programados" |
| F6 — Endereço e data de entrega | Toda tela da logística usa o **endereço de entrega** do pedido quando ele existe (senão, o do cadastro); a **data de entrega** pode ser mudada ou removida na plataforma (o Tiny não muda) — e se o Tiny mudar a data, a plataforma passa a seguir o Tiny |

## Tarefas no ClickUp (lista PRODUÇÃO do DPTO TI)

A definir com o dono (perguntado em 27/10 — regra 19: o Claude não cria tarefa por conta própria).

## Numeração reservada

D-189…D-199 · E-158…E-169 · A-115…A-124 · migrations `20261027xxxxxx` · faixa de ids de teste da bateria `...4101–4149`.

## Fora do escopo

Mexer no Tiny (nada vai para lá: nem a entrega parcial, nem a data, nem o endereço); o fluxo do n8n; o calendário além de mostrar a data efetiva; e-mail de recuperação de senha (a troca é liberada por um admin, sem e-mail).

## Critérios de aceite

- [ ] F1 — Dois aparelhos no mesmo setor ficam logados juntos; sair de um não derruba o outro; o tablet não sai sozinho; a pessoa vira ausente com 15 min sem card em execução e sai do setor com 1 h; o gesto de card com PIN de quem não está no setor funciona e a põe no setor.
- [ ] F2 — Na MONTAGEM com dezenas de cards, a coluna rola por dentro, o cabeçalho das colunas fica sempre à vista e o arrasto mostra a coluna de destino; "Ver mais" dentro da coluna; PC e tablet.
- [ ] F3 — Solicitar → aviso urgente na tela de todo admin/super admin (com Liberar / Não liberar) e no sino; liberado, o aparelho que pediu troca a senha em até 2 h, uma vez; e-mail não cadastrado, conta de tablet e pessoa desativada = a mesma mensagem genérica; tudo na trilha; a revisão de segurança com o que foi achado e corrigido.
- [ ] F4 — Entrega parcial no entregador e na logística; as peças entregues saem de toda conta; as que voltaram aparecem em "Decidir situação"; o pedido aparece "Entregue em parte" (Pedidos, calendário, ficha); desfazer no mesmo dia desfaz tudo; o Tiny não muda.
- [ ] F5 — Parada avulsa na programação e na rota do dia; o endereço digitado vira pino; Feita/Não feita; o entregador só reordena a avulsa que pôs; Google Maps leva a avulsa na ordem; "Rota programada".
- [ ] F6 — O pedido 13660 aparece na programação em Nova Parnamirim; mudar/remover a data na plataforma muda card, expedição, calendário e programação (o Tiny não muda); o Tiny mudando a data depois, a plataforma segue o Tiny.
- [ ] Lei de desempenho: portas novas/tocadas medidas no ×100; nenhuma requisição nova na abertura; nada de relógio nem `postgres_changes`.
- [ ] Handoff com o roteiro de teste de cada frente.
