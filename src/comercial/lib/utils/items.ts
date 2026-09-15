import type { SaleRecord } from '../../types';

/**
 * Extrai o nome legível de um item de compra, percorrendo
 * as várias estruturas possíveis vindas do Tiny ERP.
 */
export function extractItemName(item: any): string {
  if (!item) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null) {
    const innerItem = item.item || item;

    if (typeof innerItem.produto === 'object' && innerItem.produto !== null) {
      const p = innerItem.produto;
      const pName = p.descricao || p.nome || p.name || p.description;
      if (pName) return String(pName);
    }

    const name = innerItem.descricao || innerItem.nome || innerItem.name || innerItem.description || innerItem.produto;
    if (name) {
      if (typeof name === 'object') {
        const objName = name.descricao || name.nome || name.name || name.description;
        if (objName) return String(objName);
        return JSON.stringify(name);
      }
      return String(name);
    }
    return JSON.stringify(item);
  }
  return String(item);
}

/**
 * Extrai o valor unitário de um item de compra.
 */
export function extractItemValue(item: any): number | null {
  if (!item || typeof item !== 'object') return null;
  const innerItem = item.item || item;
  const val = innerItem.valorUnitario ?? innerItem.valor_unitario ?? innerItem.valor ?? innerItem.price;
  if (val !== undefined && val !== null) {
    const num = Number(val);
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Faz parse do campo `itens_comprados` de um SaleRecord.
 * Lida com string JSON, array, ou objeto único.
 */
export function parseItems(record: SaleRecord): any[] {
  if (typeof record.itens_comprados === 'string') {
    try { return JSON.parse(record.itens_comprados); } catch { return []; }
  }
  if (Array.isArray(record.itens_comprados)) return record.itens_comprados;
  if (record.itens_comprados) return [record.itens_comprados];
  return [];
}
