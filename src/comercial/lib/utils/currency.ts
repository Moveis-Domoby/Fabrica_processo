const currencyFull = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const currencyNoDecimals = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/**
 * Formata valor em BRL completo (com centavos).
 * Ex: 1234.56 → "R$ 1.234,56"
 */
export function formatCurrency(value: number): string {
  return currencyFull.format(value);
}

/**
 * Formata valor em BRL sem centavos.
 * Ex: 1234.56 → "R$ 1.235"
 */
export function formatCurrencyNoDecimals(value: number): string {
  return currencyNoDecimals.format(value);
}

/**
 * Formata valor em BRL abreviado (k, M).
 * Ex: 1500 → "R$2k", 1500000 → "R$1.5M"
 */
export function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `R$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$${(value / 1_000).toFixed(0)}k`;
  return `R$${value}`;
}

/**
 * Formata valor em BRL, retornando null se o valor for null.
 * Útil para campos opcionais.
 */
export function formatCurrencyNullable(value: number | null): string | null {
  return value != null ? currencyFull.format(value) : null;
}
