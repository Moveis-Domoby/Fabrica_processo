---
id: D-402
aliases: [D-402]
titulo: "O ponto do CEP é consultado pelo navegador"
tipo: decisao
data: 2026-11-25
status: vigente
revisa: []
revisada_por: []
complementa: []
area: [logistica-rotas]
tags: [decisao, area/logistica-rotas]
---
# D-402 · O ponto do CEP é consultado pelo navegador (25/11/2026, ajuste de 25/11)

O serviço de CEP recusa a função do servidor (limite por endereço de rede) e aceita o navegador: o **navegador** consulta o ponto do CEP (tempo limite 4 s, uma vez por CEP na sessão, falha não guardada) e manda junto; a função só usa se for do mesmo CEP do endereço, senão pergunta pelo servidor como antes. A conferência do pino pergunta pelo navegador primeiro. Compatível nos dois sentidos. Resposta do dono ("Sim, resolva"), publicado em 25/11 (diário [[SESSAO-57]], "O CEP pelo navegador").
