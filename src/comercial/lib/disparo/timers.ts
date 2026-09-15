/**
 * Utilitários para cálculo de prazos de disparo de marketing.
 */

/**
 * Soma N dias úteis a uma data, pulando SOMENTE domingo (sábado conta normal).
 * @param dataInicio Data de partida
 * @param dias Quantidade de dias a somar
 * @returns Nova data
 */
export function addDiasUteisSemDomingo(dataInicio: Date, dias: number): Date {
  const result = new Date(dataInicio);
  let added = 0;
  while (added < dias) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0) { // 0 é Domingo no JavaScript
      added++;
    }
  }
  return result;
}

/**
 * Soma N dias corridos a uma data.
 */
export function addDiasCorridos(dataInicio: Date, dias: number): Date {
  const result = new Date(dataInicio);
  result.setDate(result.getDate() + dias);
  return result;
}
