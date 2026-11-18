---
id: D-189
aliases: [D-189]
titulo: "O TABLET NÃO CAI: cada aparelho com a sua sessão; quem sai do setor por tempo são as PESSOAS (15 min sem card = ausente; 1 h = fora); qualquer gesto com o PIN põe a pessoa no setor do tablet"
tipo: decisao
data: 2026-10-27
status: revisada
revisa: ["[[D-137 - SESSAO-32 as respostas do dono tempo logado medicao nos|D-137]]", "[[D-146 - Tablet 2 0 as 13 respostas provisorias da SESSAO-36|D-146]]"]
revisada_por: ["[[D-197 - Sem card so 5 minutos contam como trabalho a tela segue|D-197]]"]
complementa: []
area: [tablet-tv]
tags: [decisao, area/tablet-tv]
---
# D-189 · O TABLET NÃO CAI: cada aparelho com a sua sessão; quem sai do setor por tempo são as PESSOAS (15 min sem card = ausente; 1 h = fora); qualquer gesto com o PIN põe a pessoa no setor do tablet (27/10/2026, pedido do dono — SESSAO-41) — ↩️ revisa a D-137 (12 h no tablet), a D-146 itens 1, 7 e 8

**Pedido do dono:** *"A sessão no modo tablet nos setores estão sempre 'expirando'… remova a expiração por inatividade, coloque para uma hora, antes disso, ele apenas fica ausente se não estiver com nenhum card em nenhum setor sendo executado em um intervalo de 15 minutos"* · resposta 10: *"o próprio tablet não deve deslogar nunca da conta do setor, ele deve apenas deslogar as pessoas que estão dentro do setor naquele momento depois do tempo informado… ela não deve ter que logar novamente para movimentar os cards, elas apenas movimentam e colocam o pin dela, assim que o pin for digitado, o sistema já deve reconhecer quem é a pessoa, movimentar o card e logar ela no setor"*.

**A causa achada (registro do servidor, 26/10):** não era tempo parado — a entrada pelo PIN do setor trocava a senha da conta do tablet a cada entrada, e o servidor de login derruba as sessões abertas quando a senha muda: um aparelho entrando derrubava os outros do mesmo setor (MONTAGEM: 18 entradas no dia, de minutos em minutos); e o "Sair" do site encerrava a conta em todos os aparelhos.

- **A sessão do aparelho:** a senha da conta de tablet passa a ser DERIVADA no servidor (HMAC da chave de serviço com o id da conta — ninguém a vê, não fica guardada, não muda); cada aparelho ganha a sua sessão e nenhum derruba o outro. "Sair" encerra só aquele aparelho (no PC também). **O tablet nunca sai por tempo** (o escritório segue com 8 h — [[D-137 - SESSAO-32 as respostas do dono tempo logado medicao nos|D-137]]).
- **A pessoa:** sem card em execução em nenhum setor, os **15 primeiros minutos contam como trabalhando** (a carência entre um card e outro); depois, **ausente**; com **1 h**, **sai do setor sozinha** — o fato `saida_automatica` (sem motivo de lista; não entra no painel de motivos de saída) e o tempo depois dela não conta (nem como "fora de setor"). Derivado na leitura e gravado no próximo fato da pessoa — sem relógio (Lei §4).
- **O gesto com PIN no tablet** (mover, iniciar, pausar, auxiliar… qualquer um) põe a pessoa no setor DO TABLET. No computador vale a regra de antes (só iniciar/retomar/auxiliar dá entrada — o líder que organiza outro quadro não "entra" nele).
- ⏳ **PROVISÓRIAS (escolha do Claude — confirmar):** (a) a pausa DA PESSOA (gesto com motivo) não tem carência — ausente na hora, como antes; a saída de 1 h vale para as duas; (b) ~~a carência conta como "trabalhando" na dashboard de tempos~~ → ↩️ **resolvida pelo dono na [[D-197 - Sem card so 5 minutos contam como trabalho a tela segue|D-197]]: só 5 min contam**; (c) depois da saída automática o tempo não conta nem como ausente nem como fora de setor.
