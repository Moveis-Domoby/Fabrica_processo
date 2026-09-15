import type { SaleRecord } from '../../types';
import { normalizePhone } from './phone';

/**
 * Gera uma chave única para identificar um cliente.
 * Prioriza telefone normalizado; se não houver, usa o nome em lowercase.
 */
export function clientKey(record: SaleRecord): string {
  if (record.telefone_cliente?.trim()) {
    const normalized = normalizePhone(record.telefone_cliente);
    if (normalized) return normalized;
  }
  return record.nome_cliente?.toLowerCase().replace(/\s/g, '') || record.id;
}
