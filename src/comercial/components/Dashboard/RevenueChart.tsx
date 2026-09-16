import { useMemo } from 'react';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format, parseISO, eachMonthOfInterval, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency, formatCurrencyNoDecimals } from '../../lib/utils';
import { usePeriodFilter, PERIOD_OPTIONS } from '../../hooks/usePeriodFilter';
import type { PeriodKey } from '../../hooks/usePeriodFilter';
import { useRevenueChartData } from '../../hooks/useRevenueChartData';

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

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  // [DT-G7, corrigido] Só existe UM <Line> neste gráfico (dataKey="revenue"),
  // então o recharts nunca populava payload[1] — "pedidos" nunca aparecia no
  // tooltip. `orders` está disponível em payload[0].payload (o objeto de
  // dados bruto do ponto), então lemos de lá em vez de esperar um 2º item.
  const orders = payload[0]?.payload?.orders;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-base font-bold text-primary">{formatCurrency(payload[0].value)}</p>
      {orders != null && <p className="text-xs text-muted-foreground mt-0.5">{orders} pedidos</p>}
    </div>
  );
}

const yAxisFormatter = (v: number) => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(v);
};

interface RevenueChartProps {
  mounted: boolean;
}

export function RevenueChart({ mounted }: RevenueChartProps) {
  const { period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd, cutoff, endCutoff } = usePeriodFilter('6m');

  const { data: rawRevenueData } = useRevenueChartData(cutoff, endCutoff);

  // [DT-G6, corrigido] A RPC só devolve meses que tiveram pelo menos 1 venda
  // (GROUP BY sem zero-fill) — um mês sem vendas simplesmente não aparecia
  // no array, e o LineChart desenhava uma linha reta ligando o mês anterior
  // direto ao próximo, escondendo o "buraco" em vez de mostrar a queda a
  // zero. Agora preenchemos todo mês do intervalo selecionado com
  // revenue/orders = 0 quando a RPC não retornou nada para ele.
  const revenueData = useMemo(() => {
    if (rawRevenueData.length === 0) return [];

    const byMonth = new Map(rawRevenueData.map(r => [r.month_str, r]));

    const firstMonth = parseISO(`${rawRevenueData[0].month_str}-01`);
    const lastMonth = parseISO(`${rawRevenueData[rawRevenueData.length - 1].month_str}-01`);
    const rangeStart = cutoff ? startOfMonth(cutoff) : firstMonth;
    const rangeEnd = endCutoff ? startOfMonth(endCutoff) : lastMonth;

    const allMonths = eachMonthOfInterval({
      start: rangeStart < firstMonth ? rangeStart : firstMonth,
      end: rangeEnd > lastMonth ? rangeEnd : lastMonth,
    });

    return allMonths.map(monthDate => {
      const key = format(monthDate, 'yyyy-MM');
      const found = byMonth.get(key);
      return {
        month: format(monthDate, 'MMM/yy', { locale: ptBR }),
        revenue: found ? found.revenue : 0,
        orders: found ? found.orders : 0,
      };
    });
  }, [rawRevenueData, cutoff, endCutoff]);

  const bestMonth = useMemo(() =>
    revenueData.length ? [...revenueData].reduce((a, b) => b.revenue > a.revenue ? b : a) : null,
    [revenueData]
  );

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-6" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.6s ease 440ms, transform 0.6s ease 440ms' }}>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" />
            Evolução de Faturamento
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Receita mensal acumulada por período</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {bestMonth && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground">Melhor mês</p>
              <p className="text-sm font-bold text-primary">{bestMonth.month} · {formatCurrencyNoDecimals(bestMonth.revenue)}</p>
            </div>
          )}
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
      <div className="h-[clamp(14rem,30vh,22rem)]"><ResponsiveContainer width="100%" height="100%">
        <LineChart data={revenueData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={60} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }} />
          {bestMonth && <ReferenceLine x={bestMonth.month} stroke="var(--primary)" strokeDasharray="4 3" strokeOpacity={0.6} />}
          <Line
            type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2.5}
            dot={{ fill: 'var(--primary)', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: 'var(--primary)', stroke: 'var(--card)', strokeWidth: 2 }}
            isAnimationActive animationBegin={200} animationDuration={1200} animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer></div>
    </div>
  );
}
