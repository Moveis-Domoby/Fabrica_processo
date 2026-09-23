/**
 * A trava de disparo da união (D-46, risco 3).
 *
 * Desde 15/09 os 4 secrets do disparo estão configurados na fábrica: as Edge
 * Functions `disparar-membro-individual` e `enviar-proximo-disparo` FUNCIONAM
 * — um clique manda WhatsApp de verdade para cliente de verdade. Até o
 * cutover, quem manda mensagem é o painel antigo; aqui os botões de disparo
 * (individual, fila e "Iniciar fila") nascem desabilitados.
 *
 * A SESSAO-21 vira esta chave no cutover — é UMA linha. Não remover nem
 * contornar para "testar": teste de disparo só existe no painel antigo.
 *
 * ✅ ABERTA em 23/09/2026 (SESSAO-21, a pedido do dono): os crons do disparo
 * e o renovador do token rodam só na fábrica e o webhook do DataCrazy já
 * aponta para cá. Abrir a chave não envia nada sozinho — envio só com clique
 * ("Enviar" no membro ou "Iniciar fila", com confirmação). A trava fica no
 * código de propósito: numa emergência, voltar a `false` trava de novo todos
 * os caminhos de disparo com uma linha.
 */
export const DISPARO_LIBERADO = true

/** O texto que explica o botão desabilitado, onde quer que ele apareça. */
export const MOTIVO_DISPARO_TRAVADO =
  'O disparo ainda roda no painel antigo — este módulo dispara só depois da união concluída.'
