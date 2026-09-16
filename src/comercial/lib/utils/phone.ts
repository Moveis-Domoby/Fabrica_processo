/**
 * Normaliza um telefone para apenas dígitos, removendo DDI 55.
 * Retorna null se o valor for vazio/nulo.
 */
export function normalizarTelefone(valor: string | null | undefined): string {
  if (!valor) return '';
  
  // Remove tudo que não for dígito
  let digits = valor.replace(/\D/g, '');
  
  if (!digits) return '';

  // Remove o DDI 55 se estiver no início
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.substring(2);
  }

  return digits;
}

/** Alias para uso em inglês — mesma função que `normalizarTelefone`. */
export const normalizePhone = normalizarTelefone;

/**
 * Formata um telefone para exibição: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX.
 * Retorna '-' se não houver telefone.
 */
export function formatPhone(phone: string): string {
  if (!phone) return '-';
  const digits = normalizarTelefone(phone);
  if (!digits) return '-';
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}
