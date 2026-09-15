import { useState, useMemo } from 'react';
import { Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePeriodFilter, PERIOD_OPTIONS } from '../../hooks/usePeriodFilter';
import type { PeriodKey } from '../../hooks/usePeriodFilter';
import { useTransitionsSummaryQuery } from '../../data/queries';
import { TransitionHistoryModal } from '../TransitionHistoryModal';

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

interface TransitionChartProps {
  mounted: boolean;
}

export function TransitionChart({ mounted }: TransitionChartProps) {
  const { period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd, cutoff, endCutoff } = usePeriodFilter('3m');
  
  const [selectedTransitions, setSelectedTransitions] = useState<number[]>([2, 3, 4, 5]);
  const [transitionModalData, setTransitionModalData] = useState<{ label: string; purchaseNumber: number } | null>(null);

  const { data: rawTransData = [] } = useTransitionsSummaryQuery(cutoff, endCutoff);

  const transitionData = useMemo(() => {
    const chartData = [];
    
    // Sort raw data just in case
    const sorted = [...rawTransData].sort((a, b) => a.purchase_number - b.purchase_number);
    
    for (const r of sorted) {
      if (!selectedTransitions.includes(r.purchase_number)) continue;
      
      chartData.push({
        label: `${r.purchase_number - 1}ª → ${r.purchase_number}ª compra`,
        transitionNumber: r.purchase_number,
        mediaDias: Math.round(r.avg_days),
        clientesCount: r.client_count,
      });
    }

    const availableTrans = sorted.map(r => r.purchase_number);

    return { chartData, availableTransitions: availableTrans };
  }, [rawTransData, selectedTransitions]);

  const cardVisible = (delay: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(24px)',
    transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
  });

  return (
    <>
      <div className="bg-card border border-border rounded-xl p-5 mb-6" style={cardVisible(820)}>
        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Activity size={18} className="text-purple-400" />
              Tempo Médio entre Compras
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quanto tempo os clientes levam para avançar de uma etapa para outra · clique na barra para ver o histórico
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {period === 'custom' && (
              <div className="flex items-center gap-2 bg-muted p-1 rounded-xl">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="bg-background border-none text-xs rounded-md px-2 py-1 focus:ring-1 focus:ring-primary outline-none" />
                <span className="text-muted-foreground text-xs font-semibold">até</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="bg-background border-none text-xs rounded-md px-2 py-1 focus:ring-1 focus:ring-primary outline-none" />
              </div>
            )}
            <PeriodPills value={period} onChange={v => setPeriod(v as PeriodKey)} options={PERIOD_OPTIONS} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs text-muted-foreground font-medium py-1.5 mr-1">Comparar etapas:</span>
          {transitionData.availableTransitions.length === 0 ? (
            <span className="text-xs text-muted-foreground py-1.5">Sem dados no período</span>
          ) : (
            transitionData.availableTransitions.map(t => {
              const isSelected = selectedTransitions.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => setSelectedTransitions(prev => 
                    prev.includes(t) ? prev.filter(n => n !== t) : [...prev, t]
                  )}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    isSelected 
                      ? 'bg-primary/10 text-primary border-primary/40' 
                      : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                  }`}
                >
                  {t - 1}ª → {t}ª
                </button>
              );
            })
          )}
        </div>

        {transitionData.chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhuma etapa selecionada ou sem dados para o período.</p>
        ) : (
          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={transitionData.chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${v}d`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-2xl">
                        <p className="text-xs text-muted-foreground mb-1">{data.label}</p>
                        <p className="text-base font-bold text-primary">{data.mediaDias} dias em média</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{data.clientesCount} clientes analisados</p>
                        <p className="text-[10px] font-bold text-emerald-500 mt-2 uppercase">Clique para ver clientes</p>
                      </div>
                    );
                  }}
                />
                <Bar 
                  dataKey="mediaDias" 
                  fill="hsl(var(--primary))" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={80}
                  onClick={(data: any) => setTransitionModalData({ label: data.label, purchaseNumber: data.transitionNumber })}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <TransitionHistoryModal
        isOpen={!!transitionModalData}
        onClose={() => setTransitionModalData(null)}
        title={`Detalhes: ${transitionModalData?.label}`}
        purchaseNumber={transitionModalData?.purchaseNumber || 0}
        start={cutoff}
        end={endCutoff}
      />
    </>
  );
}
