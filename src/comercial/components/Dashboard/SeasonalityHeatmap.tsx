import { useState, useMemo } from 'react';
import { Flame } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePeriodFilter, PERIOD_OPTIONS } from '../../hooks/usePeriodFilter';
import type { PeriodKey } from '../../hooks/usePeriodFilter';
import { useItemsDataQuery } from '../../data/queries';

// Copiado do Dashboard
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

interface SeasonalityHeatmapProps {
  mounted: boolean;
}

export function SeasonalityHeatmap({ mounted }: SeasonalityHeatmapProps) {
  const { period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd, cutoff, endCutoff } = usePeriodFilter('6m');
  const [topN, setTopN] = useState<1 | 3 | 5>(3);

  const { data: itemsData = [] } = useItemsDataQuery(cutoff, endCutoff);

  const seasonalData = useMemo(() => {
    const monthItemMap = new Map<string, Map<string, number>>();

    itemsData.forEach((r: any) => {
      const key = r.month_str;
      if (!monthItemMap.has(key)) monthItemMap.set(key, new Map());
      const itemMap = monthItemMap.get(key)!;
      itemMap.set(r.item_name, r.quantidade);
    });

    return Array.from(monthItemMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, itemMap]) => {
        const topList = Array.from(itemMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, topN);
        return {
          monthKey: key,
          label: format(parseISO(`${key}-01`), "MMM/yy", { locale: ptBR }),
          labelFull: format(parseISO(`${key}-01`), "MMMM 'de' yyyy", { locale: ptBR }),
          items: topList,
        };
      });
  }, [itemsData, topN]);

  const itemColorMap = useMemo(() => {
    const allItems = new Set<string>();
    seasonalData.forEach(m => m.items.forEach(([n]) => allItems.add(n)));
    const COLORS = [
      'bg-primary/80', 'bg-orange-400/80', 'bg-purple-400/80',
      'bg-blue-400/80', 'bg-pink-400/80', 'bg-yellow-400/80',
      'bg-cyan-400/80', 'bg-red-400/80', 'bg-lime-400/80', 'bg-indigo-400/80',
    ];
    const colorTx = [
      'text-primary', 'text-orange-500', 'text-purple-500',
      'text-blue-500', 'text-pink-500', 'text-yellow-500',
      'text-cyan-500', 'text-red-500', 'text-lime-600', 'text-indigo-500',
    ];
    const map = new Map<string, { bg: string; tx: string }>();
    let i = 0;
    allItems.forEach(name => {
      map.set(name, { bg: COLORS[i % COLORS.length], tx: colorTx[i % colorTx.length] });
      i++;
    });
    return map;
  }, [seasonalData]);

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-6" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 0.6s ease 500ms, transform 0.6s ease 500ms' }}>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Flame size={18} className="text-orange-400" />
            Sazonalidade de Produtos
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Top itens mais comprados por mês — identifique tendências e sazonalidade
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-muted rounded-xl shrink-0">
            {([1, 3, 5] as const).map(n => (
              <button
                key={n}
                onClick={() => setTopN(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${topN === n ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Top {n}
              </button>
            ))}
          </div>
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
          <PeriodPills value={period} onChange={v => setPeriod(v as PeriodKey)} options={PERIOD_OPTIONS} />
        </div>
      </div>

      {seasonalData.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sem dados para o período selecionado.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-3 min-w-max pb-2">
            {seasonalData.map((month, mIdx) => (
              <div
                key={month.monthKey}
                className="flex flex-col min-w-[160px] max-w-[200px]"
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? 'translateY(0)' : 'translateY(16px)',
                  transition: `opacity 0.5s ease ${550 + mIdx * 60}ms, transform 0.5s ease ${550 + mIdx * 60}ms`,
                }}
              >
                <div className="bg-muted border border-border rounded-lg px-3 py-2 mb-2 text-center">
                  <p className="text-xs font-bold text-foreground capitalize">{month.label}</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  {month.items.map(([name, count], rank) => {
                    const colors = itemColorMap.get(name) ?? { bg: 'bg-muted', tx: 'text-foreground' };
                    return (
                      <div
                        key={name}
                        className="bg-muted/60 border border-border/60 rounded-lg px-2.5 py-2 flex flex-col gap-0.5"
                        title={name}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[10px] font-black ${colors.tx}`}>#{rank + 1}</span>
                          <div className={`h-1.5 w-1.5 rounded-full ${colors.bg} shrink-0`} />
                        </div>
                        <p className="text-[11px] font-semibold text-foreground leading-tight line-clamp-2">{name}</p>
                        {/* [DT-G4, corrigido] `count` é nº de PEDIDOS em que o item apareceu
                            (ocorrência), não unidades vendidas — "{count}× vendido" sugeria
                            volume de unidades. Mantida a lógica de contagem (decisão do time:
                            manter contagem de pedidos), só corrigido o rótulo. */}
                        <p className="text-[10px] text-muted-foreground mt-0.5">Em {count} pedido{count === 1 ? '' : 's'}</p>
                        <div className="h-1 bg-border rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full ${colors.bg} rounded-full transition-all duration-700`}
                            style={{
                              width: mounted ? `${Math.min(100, (count / (month.items[0]?.[1] || 1)) * 100)}%` : '0%',
                              transitionDelay: `${600 + mIdx * 60 + rank * 40}ms`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
