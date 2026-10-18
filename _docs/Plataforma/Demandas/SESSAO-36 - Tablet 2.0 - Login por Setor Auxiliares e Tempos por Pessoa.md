---
titulo: SESSAO-36 — Tablet 2.0 · Login por setor, auxiliares e tempos por pessoa
tipo: demanda
status: 📐 pronta para code
data: 2026-10-18
origem: pedido do dono em 18/10/2026, organizado no Cowork e gravado direto no repositório (o dono está fora — sessão em MODO AUTÔNOMO)
frente: tablet + autenticação + dashboards — pasta principal "Domoby - fabrica", branch nova a partir da main atualizada
tags: [demanda, tablet, login, pin, auxiliares, tempos, dashboards, foto]
---

# 🎯 SESSAO-36 — Tablet 2.0: login por setor, auxiliares e tempos por pessoa

> **⚠️ MODO AUTÔNOMO (ordem do dono, 18/10/2026).** O dono está fora e quer tudo pronto quando voltar. Nesta sessão você **não faz nenhuma pergunta ao dono**: o ritual (a)(b)(c) é **escrito** na memória de execução, não esperado como conversa. Toda dúvida de negócio é respondida pelas **respostas provisórias do §3** (adote-as; cada uma vira decisão provisória registrada em [[PLT - Decisoes de Produto]] com marcação de "provisória — confirmar com o dono"). O que **realmente** exigir o dono (regras críticas 1, 2 e 3 do CLAUDE.md: merge na main, aplicar migration em produção, deploy) **não é feito**: fica pronto, testado e listado como **pendência numerada** na mensagem final e no handoff, com passo a passo simples. Na última mensagem ao dono: **o que você fez** (explicado em português de gente), **o que ele precisa fazer** (em ordem) e **o que ficou como decisão provisória** para ele confirmar — sem códigos (regra 12c).

> Leia antes, na ordem do `CLAUDE.md` da raiz: regras, memória de aprendizado, decisões, **Lei de Desempenho e Escala (regra 18)**, ordem das sessões, esquema do banco e os handoffs mais recentes — em especial os das SESSAO-30/31/32 (produção de ponta a ponta, kanban completo, desempenho) e da 33. Esta sessão **constrói em cima** do que o kanban completo entregou (janela do card, pausa com motivo, websocket por setor, tablet em 1 requisição): reaproveite, não duplique. Se algo aqui conflitar com o que já está na main, a main vale e você registra o conflito na memória de execução.

## O que é

O modo tablet se separa do login da plataforma: o tablet entra **por setor, com PIN próprio do setor**, e as pessoas passam a ser identificadas **só pelo PIN delas** em cada ação — sem clicar no nome. Setores deixam de ter fronteira (auxiliares), todos os tempos passam a contar **por pessoa** (produção, ausente, à deriva) numa dashboard nova, e o cadastro de usuário ganha **foto**.

## Comportamento esperado (pedido do dono, fiel)

### 1. O tablet na tela de login — entrada pelo PIN do setor
- O **modo tablet passa a ficar na tela de login** da plataforma.
- **Cada setor ganha um PIN próprio.** Na tela do tablet a pessoa digita um PIN qualquer; se bater com o PIN de um setor, o tablet **entra naquele setor e mostra só aquele setor**.
- Para navegar de um setor para outro, o tablet pede **o PIN do setor de destino, sempre**.
- Depois que o tablet entra no setor, **qualquer pessoa usa aquele tablet**: um único tablet atende o setor inteiro.
- O PIN do setor é cadastrável pela administração, com log de alteração (D-40).
- O login com email/senha continua existindo só no computador (§8).

### 2. Setores sem fronteira + botão "Auxiliar"
- O cadastro de funcionário passa a permitir que ele **auxilie em outros setores da produção**. Para as pessoas, os setores não têm mais fronteiras.
- Todo card em execução, em qualquer setor, ganha o botão **"Auxiliar"**: outro usuário entra no card que já está sendo executado, digitando o seu PIN. O tempo conta para ele normalmente, e ele pode **movimentar, pausar e concluir** o card como qualquer executor.
- Cada pessoa no card tem o **seu próprio tempo** registrado naquele card (o do executor original e o de cada auxiliar não se misturam; o tempo do card que já existe não quebra).

### 3. Identificação da pessoa: só o PIN, sem clicar no nome
- Em **qualquer ação que hoje pede identificar a pessoa** (movimentar card, auxiliar, pausar, concluir…), **não se clica mais no nome do usuário**: **digitar o PIN já basta** — o PIN identifica a pessoa e executa a ação.
- Isso exige **PIN único por pessoa**, sem colidir com PIN de setor (ver respostas provisórias).
- A pessoa só pode **estar em um setor por vez**. A entrada dela num setor acontece pela primeira ação com o PIN naquele setor: se ela movimentar um card num setor onde ainda **não deu entrada**, o acesso é feito **na hora, direto pelo PIN** — sem passo extra de "login".

### 4. Ícone do usuário no canto superior direito
- No tablet, o ícone (com a foto) da pessoa fica no **canto superior direito**. Clicando nele, as opções: **Pausar · Sair · Entrar**.
- **Pausar** e **Sair** pausam **todos os cards** que aquela pessoa está executando naquele momento. Diferença: **Pausar** mantém a entrada no setor (pessoa fica **ausente**); **Sair** encerra a entrada no setor (pessoa fica **à deriva**, se não entrar em outro).
- Se a pessoa estava como **auxiliar** e o executor original continua trabalhando, **o card segue intacto** para quem ficou — só ela sai do card.

### 5. Estados e tempos da pessoa
- **Pausa de card** sempre pede o **motivo**, como hoje.
- Ao pausar um card: se a pessoa ainda tem **outro card em produção**, ela continua como "trabalhando". Se **não sobrou nenhum**, ela fica **ausente**.
- **Sair do setor** sem dar entrada em outro deixa a pessoa **à deriva**.
- Em **Configurações**, além dos motivos de pausa, passa a existir o cadastro de **motivos de saída**.
- **Todos os tempos contam por pessoa**: tempo em produção por card e por setor, tempo ausente, tempo à deriva — tudo derivado de **eventos** (entrada, pausa, retomada, saída; regra 5, nunca apagar evento).

### 6. Dashboard de tempos por pessoa
- Nova **rota filha de Dashboards** (padrão pai→filho, D-36): um **card (scorecard) por usuário** descrevendo exatamente cada tempo dele (produção por card/setor, ausente, à deriva).
- Clicando no scorecard, abre o **detalhe** completo da pessoa.

### 7. Foto de usuário
- O cadastro de usuário ganha **foto**. A foto aparece em **todos os lugares** da plataforma que mostram ícone de usuário (tablet, kanban, janela do card, chat, dashboards…).

### 8. Computador: login normal + email e PIN
- No PC nada muda para quem já tem senha.
- Quem tem **PIN mas nunca criou senha** pode entrar com **email + PIN**. Nesse acesso, a **primeira barreira é a troca obrigatória de senha**.
- A decisão de 16/10 vale para todos os caminhos: pessoa desativada é **recusada já no login**, com mensagem clara.

### 9. Tempo real obrigatório (regra 18)
- Tudo o que acontece no tablet aparece **no PC em tempo real**, e vice-versa. Toda movimentação ou edição de card reflete **na hora para todo mundo**, por **websocket (Broadcast privado)** — **proibido** polling, relógio de releitura ou consulta ao banco para "ver se mudou". Presença e estados (trabalhando/ausente/à deriva) também viajam por websocket.
- Tablet continua abrindo em **1 requisição**; dado só no clique; paginação por cursor onde houver lista.

## §3 Respostas provisórias (adotar sem perguntar; registrar como decisões provisórias)

1. **PIN do setor:** cadastrado/alterado pelo admin no cadastro do setor (Painel admin), 4 a 6 dígitos, guardado com segurança (nunca em texto puro no cliente), mudança com log.
2. **PIN de usuário único:** obrigatório daqui em diante, e sem colidir com PIN de setor. Se já existirem PINs duplicados no cadastro, **não invente correção**: liste-os na pendência final para o dono resolver e, enquanto houver duplicado, só nesses casos a ação pede confirmar o nome.
3. **Tela de entrada do tablet:** só PIN de setor vale ali; PIN de usuário na tela de entrada não faz nada (mensagem de "PIN não encontrado").
4. **Card rodando em setor anterior:** quando a pessoa dá o PIN num setor novo com card ainda em execução no anterior, **o card continua contando normalmente** — nenhuma pausa automática sem motivo (a pausa sempre tem motivo e autor).
5. **"Entrar" do ícone:** dar entrada no setor da tela atual — é o caminho de volta da ausência e da deriva.
6. **Sair pede motivo**, como a pausa; motivos de pausa e de saída são **duas listas separadas** em Configurações.
7. **"Pode auxiliar"** é um **liga/desliga geral** no cadastro do funcionário (lista de setores específicos fica para o futuro, se o dono quiser).
8. **Conclusão por qualquer executor** (original ou auxiliar) fecha o tempo de todos que estavam no card naquele momento.
9. **Ícone do canto superior direito com tablet compartilhado:** mostra as **pessoas ativas no setor**; as ações (Pausar/Sair/Entrar) de cada uma pedem **o PIN da própria pessoa**.
10. **Foto:** o admin cadastra no cadastro do usuário e o próprio usuário pode trocar a sua no Meu Perfil; imagem comprimida com miniatura leve (não estourar o orçamento de peso das telas).
11. **Email + PIN deixa de valer** no PC depois que a pessoa cria a senha.
12. **Dashboard de tempos:** líderes e admins veem todo mundo; o funcionário vê só o próprio (coerente com a decisão do Meu Painel sobre tempos).
13. **"À deriva"** aparece só na dashboard por enquanto (sem selo no quadro).

## Decisões que regem esta demanda

D-06 (mobile-first no chão de fábrica) · D-27 (nada de código interno na interface) · D-36/D-40 (layout pai→filho; toda atividade gera log) · regra 5 (eventos append-only) · regra 17 (cada tela requisita só o que mostra) · regra 18 (Lei de Desempenho e Escala) · D-141 (pessoa desativada recusada no login). Decisões antigas que conflitarem (ex.: tempo de sessão do tablet de 12 h, telas do tablet da SESSAO-07, fluxo de pausa da SESSAO-31) são **revisadas com ↩️**, nunca contraditas em silêncio.

## Decisões técnicas a registrar na memória de execução (sem perguntar; escolha o padrão de mercado que escala)

- Como a **entrada do tablet pelo PIN do setor** e a **identificação da pessoa pelo PIN** convivem com o token/gancho de login atual (permissões no token, recusa do inativo) sem abrir brecha no tablet compartilhado — onde o PIN do setor fica guardado e como é conferido (nunca em texto puro no cliente; conferência no servidor com proteção contra tentativa e erro).
- O modelo de **eventos de presença** (entrada, pausa, retomada, saída, deriva) e como os tempos da dashboard saem de **projeção/agregado ≤ 50 ms**, sem varrer a tabela de eventos a cada abertura.
- Onde a **foto** mora (storage da Supabase), com miniatura.
- Multi-executor no card: tempo individual por pessoa sem quebrar o tempo do card que já existe.

## Fora do escopo

- Correções pendentes do estoque e demais pendências registradas: **não mexer**, salvo onde esta remodelagem tocar o mesmo ponto (aí resolve junto e anota).
- Impressora de etiqueta, central de notificações e o que está marcado "para depois": continua para depois.
- As sessões 34 e 35 da ORDEM (rotinas por evento; baixa de insumos): não são desta sessão.

## Tarefas no ClickUp (regra 19)

Criadas pelo Cowork na lista PRODUÇÃO do DPTO TI, em A FAZER — mover para FAZENDO ao começar cada uma, comentar em texto humanizado o que foi entregue e como conferir, **nunca concluir** (o dono conclui):
- Tablet - Login por setor com PIN e sessão única por pessoa — https://app.clickup.com/t/17tya50hqat
- Tablet - PIN próprio por setor e identificação da pessoa só pelo PIN — https://app.clickup.com/t/17tya50hqb4
- Tablet - Botão Auxiliar para trabalhar no card de outro usuário — https://app.clickup.com/t/17tya50hqau
- Tablet - Ícone do usuário no canto superior com Pausar, Sair e Entrar — https://app.clickup.com/t/17tya50hqav
- Tablet - Estados ausente e à deriva com motivos de saída — https://app.clickup.com/t/17tya50hqaw
- Dashboards - Tempos por pessoa com scorecard e detalhe — https://app.clickup.com/t/17tya50hqax
- Usuários - Foto de perfil em todos os ícones — https://app.clickup.com/t/17tya50hqay
- Computador - Entrada com email e PIN com troca obrigatória de senha — https://app.clickup.com/t/17tya50hqaz

## Critérios de aceite

- [ ] Modo tablet na tela de login; PIN do setor entra no setor e mostra só ele; trocar de setor pede o PIN do setor de destino; um tablet atende o setor inteiro.
- [ ] PIN do setor cadastrável pela administração, com log; conferido com segurança (nunca em texto puro no cliente).
- [ ] Qualquer ação de card identifica a pessoa **só pelo PIN**, sem clicar no nome; PIN de usuário único; pessoa só em um setor por vez; movimentar card em setor novo entra direto pelo PIN.
- [ ] Botão "Auxiliar" em todo card em execução; auxiliar movimenta, pausa e conclui; tempo individual por pessoa no card.
- [ ] Ícone com foto no canto superior direito; Pausar/Sair pausam todos os cards da pessoa; auxiliar sai sem afetar o card de quem ficou.
- [ ] Pausa pede motivo; sem card restante → ausente; sair do setor sem entrar em outro → à deriva; motivos de saída cadastráveis em Configurações.
- [ ] Rota filha de Dashboards com scorecard por usuário (produção por card/setor, ausente, à deriva) e detalhe ao clicar; tempos batem com os eventos.
- [ ] Foto no cadastro e em todos os ícones de usuário da plataforma.
- [ ] PC: email + PIN para quem nunca criou senha, com troca obrigatória na primeira entrada; inativo recusado no login.
- [ ] Tudo em tempo real por websocket (tablet ⇄ PC), zero polling e zero releitura por relógio nas telas tocadas; tablet em 1 requisição.
- [ ] Toda mudança de configuração gera log com autor; eventos append-only.
- [ ] Tablet (768) e celular (375) sem rolagem lateral; alvos de toque adequados.

## Notas para o Claude Code (validação e fechamento — modo autônomo)

- Task list no início espelhando esta demanda (regra 7); memória de execução em `_docs/Plataforma/Execucao/SESSAO-36.md` durante todo o trabalho; aprendizados na memória de aprendizado na hora.
- Checklist da casa: testes do banco 2×, checagem de tipos, lint, testes de tela, build, advisors da Supabase, checklist de desempenho da lei. O **projeto de testes da Supabase está liberado** (decisão de 16/10) — use-o para provar as migrations e os ensaios; **nada é aplicado no banco de produção** e **nada entra na main**: tudo fica pronto na branch.
- Handoff em `_docs/Handoffs/` com a seção **"Para o dono quando voltar"** em passos numerados e simples: revisar e mesclar, aplicar as atualizações do banco (uma a uma, conferindo a integração do Tiny antes/depois), testar logado, confirmar as decisões provisórias do §3. ORDEM, MAPA e PRÓXIMOS PASSOS atualizados; push de tudo na branch.
- Na última mensagem ao dono: o que ficou pronto, o que ele faz quando voltar (em ordem) e as decisões provisórias para confirmar — **sem códigos** (regra 12c).

## Resultado (preencher ao entregar)

📦 **Entregue na branch em 18/10/2026** (MODO AUTÔNOMO — nada na main, nada no banco de produção, nada publicado): [[handoff_2026_10_18_sessao36_tablet_2_0]], com o passo a passo do dono. Banco em arquivo (atualizações 95–97 — PIN do setor + busca por PIN, auxílio com tempo próprio, presença trabalhando/ausente/à deriva com agregado diário, portas da dashboard); função de autenticação v12 no repositório (tablet-entrar, pin-identificar, setor-pin-definir, entrar-pin, travas de tentativa); front completo (login com modo tablet e e-mail+PIN, ação só pelo PIN, Auxiliar no quadro/tablet/janela, ícone das pessoas com Pausar/Sair/Entrar, dashboard Tempos por pessoa, PIN do setor em Setores e etapas, "pode auxiliar" e foto na Equipe, aba Motivos de saída, avatar único). Provas: bateria 1.075 verdes (2×, com ensaio ×100: scorecards 22 ms, detalhe 6 ms), telas 205 verdes, tipos/lint limpos, JS inicial 222 KB (teto 250). As respostas provisórias do §3 + 9 extras = **D-146 (provisória — confirmar)**. Execução: [[SESSAO-36]].
