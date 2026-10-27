---
titulo: Handoff — 2026-10-27 · SESSAO-41 (tablet que não cai, quadro com rolagem na coluna, recuperar senha com segurança, entrega parcial, parada avulsa, endereço e data de entrega)
tipo: handoff
data: 2026-10-27
atualizado: 2026-10-27
tags: [handoff, sessao, sessao-41, tablet, kanban, senha, seguranca, rotas, entrega]
---

# 📋 Handoff — SESSAO-41 · Rotas, senha, tablet e quadro (27/10/2026)

> Demanda: [[SESSAO-41 - Rotas Entrega Parcial Parada Avulsa Senha Tablet e Quadro]]. Diário: [[SESSAO-41]]. Ditada pelo dono em 26–27/10 com dois vídeos; o Claude levou 10 dúvidas com sugestão e o dono respondeu todas (texto fiel na demanda). **No ar em 27/10/2026** com o OK do dono (*"Pode subir tudo de uma vez ja direto, vou dormir"*): as 6 atualizações do banco, a função de login e o site.

## 1. Objetivo

1. **Tablet "expirando"** — o pessoal tinha de sair e entrar no setor para mexer nos cards.
2. **Quadro** — a coluna com rolagem só dentro dela (o vídeo do Trello).
3. **Recuperar senha** liberado por um administrador + revisão de segurança.
4. **Entrega parcial** (o que voltou vai para a decisão da logística).
5. **Parada avulsa** na rota (na programação e com o caminhão na rua).
6. **Endereço de entrega** do pedido (o vídeo do 13660) e a **data de entrega** mudada/removida só na plataforma.

## 2. O que foi feito

1. **Tablet que não cai (D-189).** A causa foi achada no registro do servidor de login: a entrada pelo PIN do setor TROCAVA a senha da conta do setor a cada entrada — e trocar a senha derruba todas as sessões daquela conta (os outros tablets do mesmo setor caíam). Agora a senha da conta do tablet é derivada no servidor (sempre a mesma, ninguém conhece, não fica guardada); **Sair** encerra só aquele aparelho; o tablet **nunca** sai por tempo parado. As pessoas: sem card rodando, ficam **"Trabalhando" por 15 min** (o intervalo entre um card e outro), depois **"Ausente"**; com **1 h** sem card, **saem do setor sozinhas** (sem relógio no banco: a regra é calculada na leitura e gravada no próximo fato da pessoa). **Qualquer gesto com o PIN no tablet** identifica a pessoa, faz o gesto e a põe no setor do tablet.
2. **Quadro com rolagem na coluna (D-190).** Cada coluna vai até o fim da tela e rola sozinha; os títulos ficam no lugar; "Ver mais" no fim da própria coluna; o arrasto de baixo para outra coluna continua vendo o destino. Igual no tablet.
3. **Esqueci minha senha (D-191).** Na tela de entrada. O aparelho que pede cria um segredo só dele; o pedido avisa os administradores **na hora** (aviso urgente na tela + sino) com **Liberar troca / Não liberar**; liberado vale **2 h**, **uma** troca e **só no aparelho que pediu**; a resposta é sempre a mesma (não entrega quem tem cadastro); no máximo 5 pedidos a cada 15 min por aparelho e por e-mail.
4. **Revisão de segurança (D-192).** Injeção de SQL: as portas são funções com parâmetros, sem SQL montado com texto — conferido. Força bruta: a trava de tentativas já valia na senha e no PIN; agora também uma **trava geral** do PIN de setor (30 erros de qualquer aparelho em 15 min fecham a entrada por PIN de setor por um tempo — os tablets que já estão dentro não caem) e o login recusa texto fora de qualquer tamanho real. Edição de acesso pela API: quem não tem login **não escreve em tabela nenhuma** (nem nas visões) e não usa sequências; **ninguém esvazia tabela**; as regras de escrita são todas para quem tem login; as colunas de pessoas continuam abertas uma a uma; as tabelas novas nascem fechadas e as portas da senha só respondem ao servidor. Falta só o clique do dono no painel (seção 7).
5. **Entrega parcial (D-195).** No entregador e na logística: marca o que foi entregue, um motivo (lista em Utilitários) e/ou observação; o pedido fica **"entregue em parte"**; o que voltou vai para **Em decisão pós devolução** (o mesmo fluxo dos devolvidos); a logística é avisada; o **Tiny não muda**; a parcial não se desfaz pelo "Desfazer".
6. **Parada avulsa (D-196).** Na Programação ("Rota programada" — o antigo "Na rota" —, com o pino no mapa e programada junto com os pedidos), em **Já programadas** (misturada aos pedidos, na ordem, dá para pôr e tirar) e nas **entregas do dia** (o entregador põe na rota de HOJE dele e escolhe o momento só da parada dele — os pedidos ele não mexe; Feita / Não feita; o Google Maps da rota leva as paradas pendentes). Rota com pedido arquivado não atrapalha a ordem.
7. **Endereço de entrega (D-193).** Todas as telas das rotas e a ficha do pedido usam o **endereço de entrega do Tiny inteiro** (sem ele, o do cadastro do cliente) — o 13660 vai para Nova Parnamirim.
8. **Data de entrega (D-194).** Mudar ou remover na ficha do pedido, **só na plataforma**; se o Tiny mudar a data, passa a valer a do Tiny. O card de produção, a Expedição, a Programação e o calendário usam a data que vale.

## 3. Decisões (D-189…D-196) — as provisórias para o dono confirmar

| O quê | Ficou | Confirmar |
|---|---|---|
| Pausa da PESSOA (com motivo) | ausente na hora, sem a carência de 15 min; sai com 1 h também | ok? |
| A carência de 15 min na dashboard | ↩️ **o dono respondeu (27/10): só 5 min contam** — a tela segue mostrando 15 | ✅ D-197 |
| Depois da saída automática de 1 h | o tempo não conta (nem ausente, nem fora de setor) | ok? |
| Desfazer a entrega parcial | não pelo "Desfazer" — as peças que voltaram já estão com a logística | ok? |
| Pedido com peça reservada do estoque | não aceita entrega parcial (0 hoje) — vai pela logística | ok? |
| Parada avulsa do entregador | só na rota de HOJE dele | ok? |
| "Já programadas" | lê as paradas numa requisição à parte (dívida 28 da lei) | — |

## 4. Como testar (roteiro do dono — passo a passo)

> No site normal: https://sistema-domoby.vercel.app — se a tela estava aberta, aparece "Saiu uma versão nova": toque em Atualizar.

**A) Tablet que não cai**
1. Em DOIS aparelhos (dois tablets, ou um tablet e um celular), entre no **Modo tablet do setor** com o PIN do MESMO setor (ex.: MONTAGEM).
2. Mexa num card em cada aparelho, com o PIN da pessoa: os dois continuam funcionando (antes, um derrubava o outro).
3. Toque **Sair** num deles: o outro continua dentro.
4. Uma pessoa que NÃO está no setor solta um card com o PIN dela: o card anda e ela aparece no ícone das pessoas do setor ("Trabalhando").
5. Ícone das pessoas: quem terminou o card e não pegou outro aparece "Trabalhando" por 15 min, depois "Ausente"; com 1 h sem card, some do setor sozinha. O tablet não pede o PIN do setor de novo por tempo parado.

**B) O quadro com rolagem na coluna**
1. Fábrica → Controle de produção → **MONTAGEM** (ou qualquer setor com muitos cards).
2. Role a coluna da fila: só ela rola; os títulos das colunas ficam no lugar.
3. Arraste um card lá de baixo para outra coluna: as colunas de destino continuam à vista. "Ver mais" fica no fim da própria coluna. Igual no tablet.

**C) Esqueci minha senha (com um usuário de teste)**
1. Na tela de entrada: **Esqueci minha senha** → digite o e-mail → **Trocar minha senha** → aparece "ainda não foi liberada" e **Solicitar troca** → toque.
2. Num computador logado como administrador: aparece na hora o aviso **"Pedido urgente: troca de senha"** com a pessoa → **Liberar troca** (também no sino).
3. De volta ao aparelho que pediu: **Trocar minha senha** → cria a senha nova → já entra.
4. Confira: um e-mail que não existe mostra a MESMA mensagem; em outro aparelho, a troca não fica liberada; depois de 2 h, também não.

**D) Entrega parcial**
1. ROTAS → Entregas (ou a tela do entregador) → num pedido com 2+ móveis → **Entrega parcial**.
2. Desmarque o que voltou, escolha um motivo (ou escreva a observação) → **Registrar entrega parcial**.
3. Confira: o pedido some de "a entregar" e aparece "em parte" nos entregues; o sino da logística avisa; **Estoque → Em decisão pós devolução** mostra a peça que voltou → **Decidir situação** (ex.: Reenviar ao cliente → o pedido volta para Programar).
4. O Tiny não mudou.
5. Configurações → Utilitários → **Motivos da entrega → Entrega parcial**: a lista se edita ali.

**E) Endereço de entrega**
1. Rotas → Programação → **Programar**: o pedido **13660** aparece em **Nova Parnamirim** (não no Alecrim).
2. Abra a ficha do pedido (Pedidos → Todos os pedidos → 13660): "Para onde — endereço de entrega do pedido" + o cadastro do cliente embaixo.

**F) Data de entrega**
1. Na ficha de um pedido → **Mudar a data de entrega** → escolha outra data → **Salvar a data**.
2. Confira: "mudada na plataforma (no Tiny: …)"; a cor do prazo no card de produção, a Expedição, a Programação e o calendário usam a data nova; o Tiny continua com a antiga.
3. **Remover a data**: a ficha diz "Sem data".
4. (Se quiser) mude a data no Tiny: na plataforma passa a valer a do Tiny.

**G) Parada avulsa**
1. Rotas → Programação → **Programar**: monte a rota como sempre (marque os pedidos) → no quadro **Rota programada** toque **Adicionar parada avulsa** → título (ex.: "buscar as dobradiças no fornecedor") e endereço → **Achar no mapa** → arraste o pino até o lugar exato → (observação, se quiser) → **Salvar a parada**.
2. Confira: a parada aparece em "Rota programada" e no mapa como um **quadrado "A"**, na mesma numeração dos pedidos; arraste-a para o lugar dela na rota e programe.
3. **Já programadas**: a parada aparece misturada aos pedidos, na ordem; dá para arrastar, **Adicionar parada avulsa** numa rota já programada e **Tirar da rota**.
4. No celular do entregador (Entregas do dia, a rota de hoje): **Adicionar parada avulsa** → salve → aparece "Agora arraste para o momento em que o caminhão vai parar nela" → arraste a parada (os pedidos não se mexem para ele) → **Salvar a ordem**.
5. Na parada: **Feita** ou **Não feita** (motivo opcional) e **Desfazer**; quem pôs também tem **Mudar o momento** e **Tirar da rota**. O Google Maps da rota leva as paradas que faltam.

## 5. Verificação

- **Bateria do banco:** 1.355 verdes (os blocos novos do tablet, da senha, da entrega/endereço/data e da parada avulsa — inclusive o entregador tentando mexer na ordem dos pedidos, a rota que mudou noutra tela, o PIN errado, o e-mail sem cadastro — e as migrations reaplicadas no meio, como em produção).
- **Testes de tela:** 316 verdes; tipos e lint limpos; o site montado: **JS inicial 226,3 KB** comprimido (teto 250).
- **No navegador local:** o quadro e a tela de entrada conferidos numa vitrine com dados de mentira (altura da página = a janela; só a coluna rola); a tela da parada avulsa revisada e testada antes de entrar.
- **Produção (27/10, depois de subir — leitura como o dono, sem gravar nada):** o 13660 sai em Nova Parnamirim nas portas das rotas; as portas novas respondem; as 6 atualizações do banco valendo (5 motivos de entrega parcial, a ordem da rota sem pedido arquivado); permissões como planejado (visitante sem escrita, as tabelas novas fechadas, as portas de senha só do servidor; quem tem login segue escrevendo só pelas portas e regras de antes).
- **Função de login (versão 17):** respostas conferidas no ar — pedido de situação sem liberação = "não liberado"; senha nova curta recusada; troca sem liberação recusada; senha longa demais = a mesma recusa genérica; PIN de setor com 1 dígito recusado; ação desconhecida recusada.
- **Site:** publicado pela principal (o Vercel monta sozinho) — conferido pelo status do commit.

## 6. Desempenho (Lei — checklist)

- **Uma requisição por tela:** mantida. A exceção é **Já programadas**, que lê as paradas avulsas numa 2ª requisição (8 ms ×100) — **dívida 28** da lei, com o caminho escrito.
- **Dado escondido só no clique:** as peças da entrega parcial, o mapinha do pino, a lista do "momento" e os pedidos de senha só chegam ao abrir a janela.
- **Tempo real por websocket:** o aviso de troca de senha e o da entrega parcial vão pelo canal de avisos de sempre; nada de consulta por intervalo. **Sem relógio no banco:** a carência de 15 min e a saída de 1 h são calculadas na leitura e gravadas no próximo fato.
- **Índices:** toda chave estrangeira e todo filtro das 3 tabelas novas têm índice; escrita idempotente na parada avulsa (a chave do gesto).
- **Ensaio ×100** (562.700 pedidos, 95 mil cards, ~23 mil pedidos vivos candidatos à rota; antes × depois no mesmo banco): quadro do setor 171 → 165 ms; pela entrega 149 → 175 ms; PCP 187 → 155 ms; Já programadas 78 → 84 ms; Pedidos 117 → 114 ms; entregas do dia 16 → 17 ms; paradas do período 8 ms; ficha do pedido 10 ms; Programação e Expedição iguais (dívidas 24/25). **Calendário 206 → ~900 ms** (achado no ensaio e cortado de 1,5 s com o pré-filtro; o aviso fora do calendário 725 → ~180 ms) — o resto é a **dívida 29**, com o caminho (a data que vale como projeção no card). Com o volume de hoje, poucos milissegundos.

## 7. Pendências e próximos passos

- ✅ **Subiu tudo em 27/10** com o OK do dono (*"Pode subir tudo de uma vez ja direto, vou dormir"*): as 6 atualizações do banco (uma a uma), a função de login (versão 17) e o site.
- **Primeira entrada de cada tablet depois da subida:** os outros aparelhos do MESMO setor saem **uma última vez** (a senha da conta do setor é gravada uma única vez). Depois disso, nunca mais.
- **Cliques do dono no painel da Supabase** (o Claude não mexe em configuração de acesso): **Authentication → Sign In / Providers → "Allow new users to sign up" DESLIGADO** (o cadastro é só pela plataforma; criar pessoa pela Equipe continua funcionando) e, em **Email**, **"Minimum password length" = 8**.
- **Confirmar as provisórias** da seção 3.
- **Dívidas 28 e 29** da lei (Já programadas numa requisição só; o calendário ×100).
- **ClickUp:** esta demanda não tem tarefas — o dono decide se cria (regra 19).

## 8. Numeração usada

D-189…D-198 · E-158…E-163 · A-115…A-121 · migrations `20261027010000`…`20261027070000` · ids de teste `...4101–4149`, pedidos de teste `9410xx`/`9411xx`. **Seguinte: D-199 · E-164 · A-122.**

## 9. Ajuste do dono (27/10, de manhã) — a conta dos 5 minutos e o card esquecido

**Pedido:** só 5 min sem card contam como trabalho; card de MONTAGEM com mais de 2 h rodando pergunta, urgente, se ainda tem alguém nele. Decisões D-197 e D-198 (respostas do dono nelas).

**Como testar**
1. **A conta dos 5 min:** num dia de teste, uma pessoa termina um card e fica 10 min sem pegar outro. O ícone do setor mostra "Trabalhando" até 15 min (como antes); em Tempos, a pessoa ganha só 5 min de trabalho por esse intervalo, o resto conta como ausente.
2. **O card esquecido:** na MONTAGEM, inicie um card e deixe rodando 2 h sem pausar. Na hora: (a) no tablet da MONTAGEM aparece no alto do quadro **"Ainda tem alguém neste card?"** com **Sim, ainda tem gente** e **Não, pausar o card** (pede o PIN); (b) no computador do administrador (e de quem está no card, se estiver logado) abre sozinho o aviso **"Urgente: ainda tem alguém neste card?"** — também pelo sino.
3. **Sim:** o card segue; a pergunta some para todos; volta se rodar mais 2 h sem parar.
4. **Não:** o card fica pausado **na hora do aviso** (a linha do tempo do card mostra a pausa nesse horário, com "Ninguém no card — aviso de card esquecido"); o tempo depois do aviso não conta como trabalho.
5. Pausar o card antes de responder também tira a pergunta.

**Verificação:** bateria 1.364 verdes (10 novas; 1 falha conhecida e alheia — a fila do Tiny de madrugada); testes de tela 318; tipos/lint limpos; JS inicial 230,8 KB; os dois avisos conferidos numa vitrine (tablet 768×1024 e o aviso urgente).

**Desempenho:** nenhuma requisição nova na abertura nem por tela (a pergunta vem no MESMO pedido do quadro; o aviso urgente lê o cache do sino); o despertador é UM agendamento no minuto do próximo prazo — nada acorda para ver; as consultas novas andam por índice parcial.

**Subida:** ⏳ espera o OK do dono — a atualização do banco e o site.
