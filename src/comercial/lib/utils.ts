import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export { normalizarTelefone, normalizePhone, formatPhone } from './utils/phone';
export { extractItemName, extractItemValue, parseItems } from './utils/items';
export { formatCurrency, formatCurrencyNoDecimals, formatCurrencyShort, formatCurrencyNullable } from './utils/currency';
export { clientKey } from './utils/client';
