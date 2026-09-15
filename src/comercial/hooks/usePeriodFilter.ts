import { useState, useMemo } from 'react';
import { subMonths, startOfMonth } from 'date-fns';

export type PeriodKey = '1m' | '3m' | '6m' | '12m' | 'all' | 'custom';

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: '1m', label: '1 mês' },
  { key: '3m', label: '3 meses' },
  { key: '6m', label: '6 meses' },
  { key: '12m', label: '12 meses' },
  { key: 'all', label: 'Tudo' },
  { key: 'custom', label: 'Personalizado' },
];

export function usePeriodFilter(
  defaultPeriod: PeriodKey = '6m',
  defaultEndCutoff: Date | null = null
) {
  const [period, setPeriod] = useState<PeriodKey>(defaultPeriod);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const bounds = useMemo(() => {
    const now = new Date();
    let cutoff: Date | null = null;
    let endCutoff: Date | null = defaultEndCutoff;

    if (period === '1m') cutoff = startOfMonth(now);
    else if (period === '3m') cutoff = startOfMonth(subMonths(now, 2));
    else if (period === '6m') cutoff = startOfMonth(subMonths(now, 5));
    else if (period === '12m') cutoff = startOfMonth(subMonths(now, 11));
    else if (period === 'all') {
      cutoff = null;
      endCutoff = null;
    }
    else if (period === 'custom') {
      if (customStart) cutoff = new Date(`${customStart}T00:00:00`);
      if (customEnd) endCutoff = new Date(`${customEnd}T23:59:59`);
      else endCutoff = defaultEndCutoff;
    }

    return { cutoff, endCutoff };
  }, [period, customStart, customEnd, defaultEndCutoff]);

  return {
    period, setPeriod,
    customStart, setCustomStart,
    customEnd, setCustomEnd,
    cutoff: bounds.cutoff,
    endCutoff: bounds.endCutoff
  };
}
