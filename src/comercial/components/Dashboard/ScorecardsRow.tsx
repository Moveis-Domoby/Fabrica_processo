import { useState, useEffect, useRef, useMemo } from 'react';
import { DollarSign, ShoppingBag, Users, Repeat } from 'lucide-react';
import { formatCurrencyNoDecimals } from '../../lib/utils';
import { usePeriodFilter, PERIOD_OPTIONS } from '../../hooks/usePeriodFilter';
import type { PeriodKey } from '../../hooks/usePeriodFilter';
import { useScorecardsData } from '../../hooks/useScorecardsData';

function PeriodPills({ value, onChange, options }: { value: PeriodKey, onChange: (v: string) => void, options: { key: string, label: string }[] }) {
  return (
    <div className="flex items-center gap-1.5 bg-background border border-border/50 rounded-xl p-1">
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
            value === o.key 
              ? 'bg-primary text-primary-foreground shadow-sm' 
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AnimatedNumber({ value, formatter }: { value: number; formatter: (v: number) => string }) {
  const [displayed, setDisplayed] = useState(0);
  const raf = useRef<number | null>(null);
  const startRef = useRef(displayed);

  useEffect(() => {
    startRef.current = displayed;
    const start = startRef.current;
    const end = value;
    const duration = 900;
    const startTime = performance.now();
    
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(start + (end - start) * eased);
      if (progress < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);

  return <>{formatter(displayed)}</>;
}

interface ScorecardsRowProps {
  mounted: boolean;
}

export function ScorecardsRow({ mounted }: ScorecardsRowProps) {
  const { period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd, cutoff, endCutoff } = usePeriodFilter('all');

  // [DT-F1/DT-F3] fn_dashboard_scorecards agora recebe um p_filters jsonb
  // (mesmo shape usado na tabela de clientes) em vez de (start, end) soltos.
  // Este card tem seu próprio seletor de período (independente dos filtros
  // da tabela), então montamos aqui um objeto de filtros mínimo: só
  // dateFilter='custom' com os limites já resolvidos por usePeriodFilter,
  // como instantes ISO completos (sem ambiguidade de fuso).
  const scorecardFilters = useMemo(() => ({
    dateFilter: (cutoff || endCutoff) ? 'custom' : 'all',
    customDateStart: cutoff ? cutoff.toISOString() : '',
    customDateEnd: endCutoff ? endCutoff.toISOString() : '',
  }), [cutoff, endCutoff]);

  const { data: scorecards } = useScorecardsData(scorecardFilters);

  // [DT-G12, corrigido] O rótulo "Fat. Total (Vida)" era fixo, mas este
  // card tem seletor de período próprio — ao trocar de "Tudo" para "1 mês"
  // etc., o valor exibido passava a ser só do período selecionado, e o
  // rótulo continuava dizendo "(Vida)" (histórico completo), mentindo sobre
  // o que o número representa.
  const faturamentoLabel = period === 'all' ? 'Fat. Total (Vida)' : 'Fat. Total (Período)';


  const cardVisible = (delay: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(24px)',
    transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
  });

  return (
    <>
      <div className="flex justify-end mb-3" style={cardVisible(40)}>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <span className="text-xs text-muted-foreground font-medium">Período dos cards:</span>
          <PeriodPills value={period} onChange={v => setPeriod(v as PeriodKey)} options={PERIOD_OPTIONS} />
          {period === 'custom' && (
            <div className="flex items-center gap-2 bg-muted p-1 rounded-xl">
              <input 
                type="date" 
                value={customStart} 
                onChange={e => setCustomStart(e.target.value)}
                className="bg-background border-none text-xs rounded-md px-2 py-1 focus:ring-1 focus:ring-primary outline-none"
              />
              <span className="text-muted-foreground text-xs font-semibold">até</span>
              <input 
                type="date" 
                value={customEnd} 
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-background border-none text-xs rounded-md px-2 py-1 focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6 gap-3 mb-8 items-stretch">
        {/* ── Faturamento ── */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between min-h-[6rem]" style={cardVisible(40)}>
          <div className="flex items-start justify-between mb-2 gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 min-h-[2rem] leading-tight">{faturamentoLabel}</p>
              <h3 className="text-2xl font-bold text-emerald-500">
                <AnimatedNumber value={scorecards?.total_revenue || 0} formatter={v => formatCurrencyNoDecimals(v)} />
              </h3>
            </div>
            <div className="text-emerald-500/50">
              <DollarSign size={16} />
            </div>
          </div>
        </div>

        {/* ── Total Pedidos ── */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between min-h-[6rem]" style={cardVisible(80)}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 min-h-[2rem] leading-tight">Total Pedidos</p>
              <h3 className="text-2xl font-bold text-orange-400">
                <AnimatedNumber value={scorecards?.total_orders || 0} formatter={v => Math.round(v).toLocaleString('pt-BR')} />
              </h3>
            </div>
            <div className="text-orange-400/50">
              <ShoppingBag size={16} />
            </div>
          </div>
        </div>

        {/* ── Total Clientes ── */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between min-h-[6rem]" style={cardVisible(120)}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 min-h-[2rem] leading-tight">Clientes Únicos</p>
              <h3 className="text-2xl font-bold text-blue-400">
                <AnimatedNumber value={scorecards?.total_clients || 0} formatter={v => Math.round(v).toLocaleString('pt-BR')} />
              </h3>
            </div>
            <div className="text-blue-400/50">
              <Users size={16} />
            </div>
          </div>
        </div>

        {/* ── Recompradores ── */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between min-h-[6rem]" style={cardVisible(160)}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 min-h-[2rem] leading-tight">Recompradores</p>
              <h3 className="text-2xl font-bold text-purple-300">
                <AnimatedNumber value={scorecards?.recurrents || 0} formatter={v => Math.round(v).toLocaleString('pt-BR')} />
              </h3>
            </div>
            <div className="text-purple-300/50">
              <Repeat size={16} />
            </div>
          </div>
        </div>

        {/* ── Taxa de Recompra ── */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between min-h-[6rem]" style={cardVisible(200)}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 min-h-[2rem] leading-tight">Taxa Recompra</p>
              <h3 className="text-2xl font-bold text-emerald-500">
                <AnimatedNumber value={scorecards?.recurrence_rate || 0} formatter={v => v.toFixed(1)} />%
              </h3>
            </div>
            <div className="text-emerald-500/50">
              <Repeat size={16} />
            </div>
          </div>
        </div>

        {/* ── Ticket Médio ── */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between min-h-[6rem]" style={cardVisible(240)}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 min-h-[2rem] leading-tight">Ticket Médio</p>
              <h3 className="text-2xl font-bold text-yellow-500">
                <AnimatedNumber value={scorecards?.avg_ticket || 0} formatter={v => formatCurrencyNoDecimals(v)} />
              </h3>
            </div>
            <div className="text-yellow-500/50">
              <DollarSign size={16} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
