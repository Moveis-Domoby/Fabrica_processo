import { useEffect, useState } from 'react';

// [DT-F5] Devolve o valor só depois que ele fica parado por `delayMs`.
// Usado para segurar o searchQuery enquanto o usuário digita — sem isso,
// cada tecla disparava as duas RPCs mais caras do sistema (tabela + KPIs).
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
