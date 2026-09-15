import { useState, useMemo } from 'react';

import { Package, TrendingDown, RotateCcw, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTopItemsOverallQuery } from '../../data/queries';

interface TopItemsPanelProps {
  mounted: boolean;
}

export function TopItemsPanel({ mounted }: TopItemsPanelProps) {
  const [topItemsMonth, setTopItemsMonth] = useState('all');
  const [removedBottomItems, setRemovedBottomItems] = useState<Set<string>>(new Set());

  // Converte o selectedMonth em start e end dates para o RPC
  const { start, end } = useMemo(() => {
    if (topItemsMonth === 'all') return { start: null, end: null };
    const [yr, mo] = topItemsMonth.split('-');
    const s = new Date(`${yr}-${mo}-01T00:00:00`);
    const e = new Date(Number(yr), Number(mo), 0, 23, 59, 59);
    return { start: s, end: e };
  }, [topItemsMonth]);

  const { data: overallData = [] } = useTopItemsOverallQuery(start, end);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    // Preencher últimos 12 meses como fallback já que não temos o array raw
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      set.add(format(d, 'yyyy-MM'));
    }
    return Array.from(set).sort().reverse();
  }, []);

  const allItemsSorted = useMemo(() => {
    // A API agora retorna tudo agregado pela quantidade
    return overallData.map((r: any) => [r.item_name, r.quantidade] as [string, number]);
  }, [overallData]);

  const topItems = useMemo(() => allItemsSorted.slice(0, 30), [allItemsSorted]);
  const bottomItems = useMemo(() =>
    allItemsSorted.filter(([name]: any) => !removedBottomItems.has(name)).reverse().slice(0, 30),
    [allItemsSorted, removedBottomItems]
  );

  const maxItemCount = topItems[0]?.[1] ?? 1;

  const selectedMonthLabel = useMemo(() => {
    if (topItemsMonth === 'all') return 'Todo o período';
    try { return format(parseISO(`${topItemsMonth}-01`), "MMMM 'de' yyyy", { locale: ptBR }); }
    catch { return topItemsMonth; }
  }, [topItemsMonth]);

  const cardVisible = (delay: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* ── Top 30 Most Purchased ── */}
      <div className="bg-card border border-border rounded-xl p-5" style={cardVisible(600)}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Package size={18} className="text-primary" />
              Top 30 Mais Comprados
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{selectedMonthLabel}</p>
          </div>
          <select
            value={topItemsMonth}
            onChange={e => setTopItemsMonth(e.target.value)}
            className="bg-background border border-input rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Todo o período</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>
                {format(parseISO(`${m}-01`), "MMMM 'de' yyyy", { locale: ptBR })}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {topItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem itens registrados.</p>
          ) : topItems.map(([name, count]: [string, number], idx: number) => (
            <div key={name} className="flex items-center gap-3">
              <span className="text-xs font-bold text-muted-foreground w-5 text-right shrink-0">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium truncate" title={name}>{name}</span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">{count}×</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: mounted ? `${(count / maxItemCount) * 100}%` : '0%', transitionDelay: `${660 + idx * 30}ms` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Top 30 Least Purchased ── */}
      <div className="bg-card border border-border rounded-xl p-5" style={cardVisible(640)}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <TrendingDown size={18} className="text-orange-400" />
              Top 30 Menos Comprados
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{selectedMonthLabel}</p>
          </div>
          {removedBottomItems.size > 0 && (
            <button
              onClick={() => setRemovedBottomItems(new Set())}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg text-xs font-semibold transition-all"
              title="Restaurar todos os itens removidos"
            >
              <RotateCcw size={12} />
              Restaurar ({removedBottomItems.size})
            </button>
          )}
        </div>
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
          {bottomItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem itens registrados.</p>
          ) : bottomItems.map(([name, count]: [string, number], idx: number) => (
            <div key={name} className="flex items-center gap-3 group">
              <span className="text-xs font-bold text-muted-foreground w-5 text-right shrink-0">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium truncate" title={name}>{name}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs text-muted-foreground">{count}×</span>
                    <button
                      onClick={() => setRemovedBottomItems(prev => new Set([...prev, name]))}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                      title="Remover da lista"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-400 rounded-full transition-all duration-700"
                    style={{ width: mounted ? `${Math.max(6, (count / maxItemCount) * 100)}%` : '0%', transitionDelay: `${660 + idx * 30}ms` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
