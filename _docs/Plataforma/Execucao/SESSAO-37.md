# SESSAO-37 — A arrumação para entrar em produção (19/10/2026, dono na conversa)

> Demanda ditada AO VIVO pelo dono na madrugada de 19/10 ("vamos realizar uma limpa na plataforma para colocar ela em produção ainda hoje"), logo depois de a SESSAO-36 subir. Sem arquivo de demanda — o escopo foi fechado na conversa (3 perguntas respondidas) e virou a D-147. Branch `sessao-37-limpa-pins-niveis`, mesclada na main com o OK dele.

## O que o dono pediu (e as respostas dele às minhas dúvidas)

1. Limpa de tudo que foi teste; pedidos entregues somem da produção (ficam só em Pedidos). *Alcance respondido: limpar SÓ a linha do controle de produção, as rotas e os tempos — chat, cadastros, pedidos do Tiny e estoque intactos.*
2. PIN do setor = 2 dígitos; PIN da pessoa = 2 a 4 (digitados à mão hoje); TODOS os PINs resetados.
3. Nível novo **Linha de produção**: só os setores de produção (os dele livres; outro setor pede o PIN do setor — *resposta dele*), chat e afazeres.
4. Nível novo **Logística** (*acrescentado na resposta*): produção só olhando, módulo de logística e o painel pessoal completo, sem os afazeres do time.
5. Botão **Auxiliar** no topo da coluna em execução: entra em TODOS os cards de uma vez; o pausar geral idem — *resposta: a pausa é da pessoa; o card continua se ainda tem alguém; só vai a Pausado quando sai o último*.
6. **(Mensagem no meio do caminho)** Dashboard de tempos detalhada: o card da pessoa abre por setor (produção × ausente) e por móvel (tempo, parado, motivo); o clique aprofunda.

## O que foi feito

- **Migration 98** (`20261019120000_plt_niveis_pins_pausa_pessoal.sql`): papéis `producao`/`logistica` no check; `fn_eh_logistica` + `fn_pode_ver_expedicao` + `fn_autor_do_gesto` recriadas (logística só olha — recusa no banco); `fn_auxilios_acompanhar` com a pausa PESSOAL sem cascata (marcadores `pausa_geral`/`saida` que a porta da pessoa já gravava); `fn_validar_auxilio` SEM o limite (D-147 ⏳); porta `plt_fn_setor_auxiliar_todos`; `plt_fn_tempos_pessoas`/`_detalhe` recriadas com o `por_setor` detalhado (mesma forma jsonb — site no ar não quebra; teto de 30 cards no scorecard, motivos agregados dos eventos de pausa).
- **Função `autenticacao` deploy nº 14**: regex do setor `{2}`, da pessoa `{2,4}`; papéis novos no cadastro (logística pode nascer sem setor); ação nova `setor-pin-conferir` (confere PIN de setor SEM abrir sessão, com trava e trilha — a Linha de produção usa para espiar outro setor).
- **Front**: tipos/rótulos dos papéis; guarda de rota da produção (só setores de produção + chat/afazeres/avisos/perfil; PCP fora) e da logística (sem dashboards/comercial); menu por nível; tela de PIN de setor dentro do quadro (produção em setor alheio); quadro em modo "só olhar" para a logística (arrasto avisado + sem botões de gesto); botões **Ajudar em tudo** e **Pausar geral** no cabeçalho da coluna com card em execução (PC pela sessão; tablet com PIN antes — pausar geral abre o motivo depois do PIN); `ModalPausarGeral` novo; card com ajuda ativa NÃO cai para Pausado quando o dono se pausa ("— quem iniciou está pausado" no rodapé); teclado de PIN parametrizado (setor 2; pessoa 2–4) e todos os campos/validações de PIN encurtados; dashboard de tempos com o detalhamento por setor e por móvel no card e no clique.
- **Limpa** (`supabase/manutencao/2026-10-19_limpa_producao.sql`, rodada com o OK dele depois das contagens): 6.070 cards, 7.955 eventos, presenças/tempos/auxílios/avisos/programações, afazeres e mensagens presos a card; PINs todos zerados (13 pessoas + 3 setores). Gatilhos de imutabilidade desligados SÓ na transação (exceção registrada na D-147). Repovoamento: **51 cards de pedido** (pedidos do Tiny não entregues/não cancelados) no PCP, origem manutenção. Conferência: 51 cards · 51 eventos · 0 PINs.
- **Aplicado/publicado/mesclado na mesma madrugada** (OK do dono): migration 98 pelo aplicador (integração intacta), função publicada (fumaça: PIN de 4 dígitos no modo tablet → recusa "exatamente 2"), merge na main por avanço direto, Vercel verde, site publicado conferido (teclado novo no ar).

## Decisões provisórias para o dono confirmar (dentro da D-147)

- O limite por pessoa (D-48) **não barra mais o auxílio** — só o iniciar continua contando as ajudas abertas.
- A pausa de quem iniciou, pelo gesto PESSOAL, deixa o card correndo com a ajuda; o gesto DO CARD segue pausando tudo.

## Tropeços e aprendizados

- Bloco novo da bateria colidiu com as unidades (1/9, 2/9) do pedido de cenário do bloco anterior → índices próprios (7/9, 8/9). O relógio do teste zera os trechos de presença (abre e fecha no mesmo instante) → semear o agregado diário à mão quando a conferência precisa de números (A-81).
- A lista de pessoas da bateria passou de 100 → o teste do scorecard desloca até a página da pessoa.
- Os testes de tela antigos afirmavam as regras antigas de PIN (4–6) — atualizados junto com a regra, nunca afrouxados.

## Verificação

Bateria **1.084 verdes** (reaplica 2×; bloco 98 novo) · telas **205 verdes** (38 arquivos) · tipos/lint/build limpos · fumaça da função no ar · site publicado conferido no navegador. Pacote inicial inalterado (os pedaços novos são pequenos).

## Tarde de 19/10 — "o tablet da CNC diz conta desativada"

- **Sintoma (dono, print):** PIN 02 no modo tablet → "A conta do tablet deste setor está desativada". O PIN estava certo.
- **Causa:** as contas de tablet (uma por setor, nascidas na 1ª entrada) apareciam na **Equipe** como pessoas, com o botão de arquivar; três foram arquivadas por engano por um admin (SECC 11h10, CNC e FITAMENTO 13h41, horário de Fortaleza). Falha da SESSAO-36: conta de aparelho não podia aparecer na lista de pessoas.
- **Correção (OK do dono):** (1) reativadas as 3 por SQL, do mesmo jeito do "Reativar" da casa (ativo + sem arquivo) e com a trilha `usuario_reativado` no nome do dono; (2) a Equipe deixou de listar `conta_tablet`; (3) **migration 99** — gatilho que recusa arquivar/desativar/excluir conta de tablet por qualquer caminho, com chave de manutenção. Bateria 1.087 verdes (bloco 99 novo), telas 205, conferência no banco real dentro de bloco que desfaz (a trava recusou, a CNC seguiu ativa). Main 80be377.
- **Lição (E-114):** toda conta "de máquina" que mora na tabela de pessoas precisa sair das listas de pessoas E ganhar trava no banco no MESMO dia em que nasce.

## Noite de 19/10 — os 7 ajustes do dono (primeiro dia de uso)

1. **Sair do modo tablet:** botão "Sair" no cabeçalho do tablet aberto pelo PIN do setor, com confirmação → volta à tela de entrar.
2. **Salvar horário "sumido":** o botão ficava apagado porque faltava escolher o setor/pessoa no bloco de cima — agora fica aceso e diz o que falta (e "Vai valer para X" quando está completo).
3. **"Não criar usuário para o tablet":** decisão do dono (pergunta com recomendação) — **manter a chave interna, invisível**: ele só grava o PIN em Setores e etapas; a chave saiu de TODA lista de pessoas (Equipe, chat, responsáveis, metas, nomes do controle de tempo) e o banco recusa arquivá-la (migration 99). Reescrever a identidade do tablet fica para depois, com calma.
4. **Card "infinito" no arrasto:** 1ª tentativa (prender o card à área do quadro) NÃO bastou — o dono testou e o quadro seguiu rolando, porque o card de verdade andava DENTRO da área rolável e a esticava. **Correção:** o arrasto usa uma CÓPIA flutuante por cima da tela (`DragOverlay` em portal, presa à janela); o card fica no lugar apagado; a rolagem automática só lateral. Lição E-115.
5/6. **Equipe com UMA caneta:** os botões laterais saíram; a caneta abre o painel completo (foto, nome, login, e-mail, telefone, nível — inclusive Linha de produção, Logística e Entregador —, setores com líder, "pode ajudar em qualquer setor", PIN, aniversário, arquivar/excluir/reativar). Ação nova `editar-usuario` na função de login (admin; ninguém tira o próprio admin; nunca fica sem admin). Líder vê só o PIN.
7. **Equipe no card da programação:** migration 100 — a lista das programadas traz os nomes da equipe da rota; o card do caminhão mostra "Equipe: …" (ou "Sem equipe definida"); salvar a equipe relê a lista.

Verificação: bateria **1.088 verdes** (blocos 99 e 100 novos), telas 205, tipos/lint/build limpos; conferência no site local com o login do dono (caneta + painel, horário, lista sem tablets). O arrasto não pôde ser testado por mim (quadros vazios / card real) — fica com o dono. Aplicado/publicado/mesclado com o OK dele (main dec5ee1, Vercel verde).
