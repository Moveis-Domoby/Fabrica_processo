import { useMemo } from 'react';
import { Repeat } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { usePeriodFilter, PERIOD_OPTIONS } from '../../hooks/usePeriodFilter';
import type { PeriodKey } from '../../hooks/usePeriodFilter';
import { usePurchaseFrequencyData } from '../../hooks/usePurchaseFrequencyData';

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

interface PurchaseFrequencyChartProps {
  mounted: boolean;
}

export function PurchaseFrequencyChart({ mounted }: PurchaseFrequencyChartProps) {
  const { period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd, cutoff, endCutoff } = usePeriodFilter('all');

  const { data: rawFreqData } = usePurchaseFrequencyData(cutoff, endCutoff);

  const purchaseFrequencyData = useMemo(() => {
    return rawFreqData.map(data => {
      // [DT-G5, corrigido] Ticket Médio dividia faturamento por número de
      // CLIENTES do segmento, não por PEDIDOS — no segmento "3 compras",
      // cada cliente fez 3 pedidos, então dividir só por clientes triplicava
      // o ticket médio exibido. `pedidos_count` é exatamente o nº de pedidos
      // que cada cliente deste segmento fez, então o total de pedidos do
      // segmento é pedidos_count * clientes_count.
      const totalPedidosSegmento = data.pedidos_count * data.clientes_count;
      return {
        label: data.pedidos_count === 1 ? '1 compra' : `${data.pedidos_count} compras`,
        clientes: data.clientes_count,
        faturamento: Math.round(data.faturamento_total),
        ticketMedio: Math.round(totalPedidosSegmento > 0 ? data.faturamento_total / totalPedidosSegmento : 0),
      };
    });
  }, [rawFreqData]);

  const cardVisible = (delay: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`
  });

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-6" style={cardVisible(780)}>
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Repeat size={18} className="text-purple-400" />
            Comparativo entre Frequência de Compra
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Faturamento e ticket médio por segmento (quem comprou 1×, 2×, 3×...)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
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

      {purchaseFrequencyData.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sem dados suficientes.</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Faturamento por segmento */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Faturamento Total por Segmento</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={purchaseFrequencyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12 }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontSize: 11 }}
                  formatter={(v: any) => [new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v), 'Faturamento']}
                />
                <Bar dataKey="faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Ticket médio por segmento + clientes */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Ticket Médio & Clientes por Segmento</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={purchaseFrequencyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tickFormatter={v => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={56} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12 }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontSize: 11 }}
                  formatter={(v: any, name: any) => [
                    name === 'ticketMedio' 
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
                      : v,
                    name === 'ticketMedio' ? 'Ticket Médio' : 'Clientes'
                  ]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => value === 'ticketMedio' ? 'Ticket Médio' : 'Clientes'}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Bar yAxisId="left" dataKey="ticketMedio" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar yAxisId="right" dataKey="clientes" fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary table */}
          <div className="xl:col-span-2 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] text-muted-foreground uppercase border-b border-border">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Segmento</th>
                  <th className="py-2 pr-4 font-semibold text-right">Clientes</th>
                  <th className="py-2 pr-4 font-semibold text-right">Faturamento Total</th>
                  <th className="py-2 font-semibold text-right">Ticket Médio</th>
                </tr>
              </thead>
              <tbody>
                {purchaseFrequencyData.map((row) => (
                  <tr key={row.label} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-2 pr-4">
                      <span className="text-xs font-semibold text-foreground">{row.label}</span>
                    </td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">
                      {row.clientes}
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold text-primary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.faturamento)}
                    </td>
                    <td className="py-2 text-right text-emerald-500 font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.ticketMedio)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
