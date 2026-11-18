---
id: D-146
aliases: [D-146]
titulo: "Tablet 2.0: as 13 respostas provisórias da SESSAO-36 + as escolhas extras do Claude"
tipo: decisao
data: 2026-10-18
status: provisoria
revisa: []
revisada_por: ["[[D-189 - O TABLET NAO CAI cada aparelho com a sua sessao quem sai|D-189]]"]
complementa: []
area: [tablet-tv]
tags: [decisao, area/tablet-tv, provisoria]
---
# D-146 · ⏳ PROVISÓRIA (confirmar com o dono) — Tablet 2.0: as 13 respostas provisórias da SESSAO-36 + as escolhas extras do Claude (18/10/2026)

**Contexto:** sessão em MODO AUTÔNOMO (ordem do dono, 18/10 — ele está fora e não responde). A demanda [[SESSAO-36 - Tablet 2.0 - Login por Setor Auxiliares e Tempos por Pessoa]] mandou adotar as respostas provisórias do §3 dela sem perguntar e registrá-las aqui. **Nada disto está confirmado pelo dono** — ele confirma (ou corrige) quando voltar, pelo handoff.

**Adotadas tal como escritas no §3 da demanda (1–13):** PIN do setor pelo admin no cadastro do setor (4–6 dígitos, nunca em texto puro no cliente, mudança com log) · PIN de usuário único e sem colidir com setor (duplicados históricos NÃO são corrigidos à revelia: listados na pendência; só nesses casos a ação pede confirmar o nome) · na tela de entrada do tablet só vale PIN de setor · card rodando em setor anterior segue contando (nenhuma pausa automática sem motivo) · "Entrar" do ícone = dar entrada no setor da tela · Sair pede motivo (lista própria, separada da de pausa) · "pode auxiliar" é liga/desliga geral no cadastro · conclusão por qualquer executor fecha o tempo de todos no card · o ícone do canto mostra as pessoas ativas do setor e cada gesto pede o PIN da própria pessoa · foto: admin cadastra e a própria pessoa troca a sua, comprimida com miniatura · email+PIN deixa de valer depois de criar senha · dashboard de tempos: líder/admin veem todos, o funcionário só o próprio · "à deriva" aparece só na dashboard.

**Extras decididos pelo Claude (conservadores, a confirmar junto):**
1. A entrada pelo PIN do setor abre a sessão de uma **conta de tablet do setor** (criada sozinha na primeira entrada; papel operador, vínculo só àquele setor, marcada como conta de tablet) — preserva gates por vínculo, RLS e o gancho do token; o tempo de 12 h de inatividade do modo tablet ([[D-137 - SESSAO-32 as respostas do dono tempo logado medicao nos|D-137]]) segue valendo para a sessão do aparelho.
2. "Pausar/Sair" do ícone pede **um** motivo e aplica a todos os cards da pessoa.
3. "Card em produção" (para o estado trabalhando/ausente) = execução ou auxílio aberto e não pausado.
4. A deriva é do chão de fábrica: nasce da SAÍDA de setor sem entrada em outro; sair da conta no PC não gera deriva; quem nunca deu entrada não conta tempo nenhum.
5. No PC o quadro segue como hoje (a sessão logada é o autor; sem PIN); o PIN como identificador é do modo tablet. O botão Auxiliar existe também na janela do card no PC, agindo pela própria sessão.
6. O tempo por pessoa soma execuções (como dono do card) + auxílios; o tempo do card e as views existentes não mudam de significado.
7. **A entrada automática no setor acontece ao INICIAR, RETOMAR ou AUXILIAR um card** (o gesto de trabalhar); mover um card sozinho não dá entrada — o líder que organiza o quadro de outro setor não "entra" nele.
8. **Ausente e à deriva têm teto de 12 h por trecho** (o mesmo teto da sessão do tablet): ninguém fica "ausente" a noite inteira na conta — o horário de funcionamento por setor pode refinar isso no futuro.
9. **A pausa do card pausa os auxílios junto** (com o mesmo motivo) e a retomada devolve só quem foi pausado junto com o card; mover, concluir ou arquivar o card encerra os auxílios (resposta 8).
