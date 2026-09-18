---
titulo: "SESSAO-26 — Chat interno"
tipo: demanda
status: pronta para code
data: 2026-09-18
atualizado: 2026-09-18
tags: [plataforma, demanda, bloco-5, chat, comunicacao]
---

# 🎯 SESSAO-26 — Chat interno

> Quinta sessão do **Bloco 5**. Um chat interno autenticado e **enxuto em requisições** (chat normalmente pesa muito — aqui não pode): nova filha de Início + balão flutuante em todas as telas. Canais, conversas particulares, avisos gerais e aniversários automáticos.

## O que é

Chat interno da empresa dentro da plataforma: nova filha de **Início** (`/inicio/chat`) e um **balão pequeno e arrastável** no canto inferior direito que acompanha todas as telas, com indicador de não lidas. Canais de grupo, chats particulares, avisos gerais e aniversários automáticos pela data de nascimento de cada um.

## Requisitos cobertos

Requisito novo (não existe chat em nenhum documento do cofre — registrar RF novos em [[PLT - Requisitos]]).

## Decisões que regem esta demanda

D-36 (navegação pai→filho — o chat é filha de Início; sino continua sendo das notificações) · D-21 (dados de usuário na própria `plt_usuarios` — a data de nascimento é **campo novo lá**, não tabela nova) · D-40 (log de atividade — criação de canal/aviso geral loga; conteúdo de mensagem NÃO vai para o log) · D-27 (sem códigos internos na UI) · regra nova da SESSAO-22 (*cada tela requisita apenas o que mostra*) · RNF-02 (paginação).

## Comportamento esperado

1. **Duas portas para o mesmo chat:**
   - `/inicio/chat` — tela completa: lista de conversas à esquerda, conversa aberta à direita (no celular, uma coisa por vez).
   - **Balão flutuante** no canto inferior direito, **arrastável** (a posição escolhida persiste por usuário), presente em todas as telas autenticadas (`/tablet` fora — a tela do galpão continua limpa), com **badge de não lidas**. Clicou: abre um painel compacto do chat sem sair da tela.
2. **Tipos de conversa:**
   - **Canais de grupo** (criar, nomear, adicionar/remover membros; quem cria administra o canal — confirmar na pergunta 2).
   - **Particulares** (1:1 com qualquer colega).
   - **Avisos gerais** — canal especial somente-leitura para todos; escrevem admins (e líderes? — pergunta 3).
   - **Aniversários automáticos**: no dia do aniversário de alguém (pela **data de nascimento** cadastrada — campo novo em `plt_usuarios`, editável pelo próprio e pelo admin), o sistema publica sozinho a mensagem de parabéns no canal de avisos gerais.
3. **Autenticado e com permissão de verdade:** cada um lê **apenas** as conversas de que participa — garantido por RLS no banco, não só na UI. Mensagens não aparecem em nenhuma porta pública.
4. **Otimizado para o mínimo de requisições** (é a alma da demanda):
   - **Realtime do Supabase** para mensagem nova — **um canal por conversa ABERTA**, nunca uma assinatura por conversa existente; fechou, desinscreveu.
   - Contador de não lidas: **um agregado único** (uma requisição leve que volta os contadores de todas as conversas), atualizado por evento realtime pontual + refetch ao focar — sem polling agressivo; se precisar de rede de segurança, polling espaçado (≥60s) só no agregado.
   - Histórico por **cursor** (últimas N mensagens; "ver anteriores" carrega a página anterior) — nunca a conversa inteira.
   - O balão fechado custa quase nada: só o agregado de não lidas; nenhuma mensagem baixada sem conversa aberta.
5. Mensagens: texto simples nesta fase; apagar/editar fora do escopo inicial (histórico simples e honesto). Notificação de mensagem nova **não** entra no sino (o sino é dos avisos do sistema): o badge do balão é o indicador.

## Perguntar ao dono no início da sessão (ritual de sempre; só codar com o OK)

1. Mensagem de aniversário: qual o texto? Publica só no canal de avisos gerais, ou também manda parabéns direto para a pessoa?
2. Quem pode **criar canais de grupo**: todos, ou só líder/admin?
3. Quem escreve nos **avisos gerais**: só admin, ou líderes também?
4. Retenção: guarda tudo para sempre, ou apagar/arquivar depois de N meses?
5. Operador de tablet compartilhado (conta de setor) participa do chat, ou chat é só para contas pessoais?

## Fora do escopo

Anexos/áudio/foto no chat (fase 2 do chat, se pedida) · integração WhatsApp (Q-42) · notificação push externa · `/tablet` · apagar/editar mensagem.

## Critérios de aceite

- [ ] `/inicio/chat` funciona no desktop e no celular; balão presente e arrastável em todas as telas autenticadas (menos `/tablet`), posição persistida.
- [ ] Canal de grupo, particular e avisos gerais funcionando; quem não participa de uma conversa não lê nada dela **nem pela API** (testar com papel simulado).
- [ ] Mensagem enviada aparece para o outro participante **sem recarregar** (realtime), e o badge de não lidas do balão sobe na tela em que ele estiver.
- [ ] Com o painel de rede aberto (aba Network): balão fechado gera apenas o agregado de não lidas; abrir uma conversa gera **uma** assinatura realtime e **uma** página de histórico; fechar desinscreve. Nada de requisição por conversa fechada.
- [ ] Data de nascimento cadastrável no perfil (próprio e admin); no dia, a mensagem de parabéns é publicada sozinha (testável forjando uma data no dia do teste).
- [ ] Histórico paginado por cursor ("ver anteriores" traz a página anterior, nunca tudo).
- [ ] Criação de canal e aviso geral logadas (D-40); conteúdo de mensagens fora do log.
- [ ] Decisões novas registradas em [[PLT - Decisoes de Produto]] (chat, aniversários, permissões).

## Notas para o Claude Code

Ritual completo do [[CLAUDE - Regras do Claude Code (repo)]]: leituras na ordem, demanda 2×, (a)(b)(c) antes de codar com OK do dono, task list espelho, memória em `Execucao/SESSAO-26.md` na hora, E-NN/A-NN na hora.
Terreno: tabelas novas com prefixo `plt_` (conversas, participantes, mensagens) e **RLS por participação**; a publicação realtime ganha a tabela de mensagens — cuidado com o precedente da S14 (RLS limita o que o realtime entrega; refetch ao focar é a rede de segurança) · aniversário via **pg_cron** diário (o projeto já tem pg_cron/pg_net desde a S11 — segundo job do projeto; nomear no padrão `plt-*`) · data de nascimento entra em `plt_usuarios` (D-21) com a Edge `autenticacao` ganhando o campo em `atualizar-perfil` (bump de versão consciente) · balão é componente global no layout autenticado; arrasto sem lib nova (pointer events — dependência pesada nova exige a regra crítica 3) · **um dado, um fetcher** (E-22): o agregado de não lidas tem UMA queryKey; o painel compacto e a tela cheia consomem as mesmas queries · mensagens são INSERT-only nesta fase (combina com a casa; "lida" pode mudar, como nas notificações).
**Checklist de validação final obrigatório e marcado item a item:** `npm run test:banco` (2 rodadas) · `npx tsc -b` · `npm run lint` · `npm test` · `npm run build` · F-07 (375px/768px — o balão não pode cobrir botão de ação; testar arrasto no touch) · ⏸️ checkpoint antes de aplicar migration (F-08, md5 antes/depois) · `get_advisors` · task list conferida · handoff + notas do cofre atualizadas.

## Resultado (preencher ao entregar)

*—*

## Ver também

[[002 - PLANO - Bloco 5 - Producao Estoque Chat e Automacoes]] · [[SESSAO-13 - Navegacao Perfil e Identidade]] · [[SESSAO-14 - Meu Painel e Metas]]
