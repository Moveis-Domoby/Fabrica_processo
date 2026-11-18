---
id: D-108
aliases: [D-108]
titulo: "A rota da Programação é calculada PELAS RUAS, parte da fábrica e VOLTA para ela; distância e tempo à vista"
tipo: decisao
data: 2026-10-02
status: vigente
revisa: ["[[D-039 - ROTAS programacao de caminhao com mapa e sugestao caminhoes|D-39]]"]
revisada_por: []
complementa: []
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-108 · A rota da Programação é calculada PELAS RUAS, parte da fábrica e VOLTA para ela; distância e tempo à vista (02/10/2026) — ↩️ revisa a D-39 (a linha reta)

**Decidido (respostas do dono no início da SESSAO-28, 02/10):** *"Rua Tancredo Neves - Planalto, Natal - RN, 59073-351"* · *"Volta para a fábrica"* · *"Pode mostrar [o tempo], já dá para ter alguma ideia"* · sobre o servidor: *"Que miséria é isso? Não entendi nada"* — a escolha ficou com o Claude, explicada em uma frase ([[Memoria - Processo de Sessao Cofre e Dono#E-82|E-82]]).

- **Partida e chegada = a fábrica da Móveis Domoby**, Rua Tancredo Neves, Planalto, Natal-RN (CEP 59073-351), no ponto **−5,84800 · −35,25428** (conferido com o print do Google Maps que o dono mandou; no mapa aberto a rua está grafada "Trancredo"). Fica **fixa no sistema**, sem tela de edição — se a fábrica mudar de endereço, é um ajuste no código.
- **A rota vai da fábrica às paradas, na ordem, e volta à fábrica** — a volta é o último trecho, separado.
- **A linha é a rota de verdade pelas ruas** (respeita contramão e sentido das vias), calculada pelo **serviço gratuito de rotas sobre o mapa aberto (OSRM)** — o servidor público da FOSSGIS, perfil de carro, sem chave, com identificação e no máximo 1 pedido por segundo. **Sem garantia de ficar no ar:** se ele falhar, a tela mostra a linha reta antiga com um aviso e continua funcionando. O endereço do servidor é configuração — trocar por um servidor próprio (o da casa) é um ajuste, se um dia precisar.
- **Distância e tempo por trecho e totais** aparecem na tela. O tempo é **"só dirigindo"**: de carro, sem trânsito e sem o tempo parado em cada entrega — está escrito assim na tela.
- **A rota calculada fica guardada** (no mesmo lugar onde o sistema já guarda os endereços achados no mapa — sem tabela nova, [[D-047 - Regra permanente nenhuma tabela nova se uma existente pode|D-47]]): a mesma sequência de paradas não é recalculada; mudou a sequência, recalcula.
- **Continua sendo sugestão inicial** — aviso curto na tela: sem trânsito ao vivo e sem interdições do dia. A decisão é humana (princípio da [[D-039 - ROTAS programacao de caminhao com mapa e sugestao caminhoes|D-39]], mantido).
- **Evolução futura, registrada:** trânsito ao vivo, **trecho interditado no dia programado** e horário de chegada garantido dependem de serviço PAGO (ex.: Google Routes). Se um dia o dono quiser, é decisão nova.

**Descartadas:** hospedar o motor de rotas no servidor da casa (o do n8n) agora — exige instalar o mapa da região na máquina que roda o n8n em produção, sem ganho visível no volume de hoje (algumas dezenas de cálculos por dia, guardados); serviço pago com trânsito (fora da regra "grátis e sem chave" da D-39 por ora); manter a linha reta.
