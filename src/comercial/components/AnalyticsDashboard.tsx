import { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, Crown, Trophy } from 'lucide-react';
import { CustomerLifetimeModal } from './CustomerLifetimeModal';
import { formatCurrencyNoDecimals, formatCurrency } from '../lib/utils';

// Extracted dashboard sections
import { ScorecardsRow } from './Dashboard/ScorecardsRow';
import { RevenueChart } from './Dashboard/RevenueChart';
import { SeasonalityHeatmap } from './Dashboard/SeasonalityHeatmap';
import { TopItemsPanel } from './Dashboard/TopItemsPanel';
import { PurchaseFrequencyChart } from './Dashboard/PurchaseFrequencyChart';
import { TransitionChart } from './Dashboard/TransitionChart';
import { useTopClientsData } from '../hooks/useTopClientsData';

interface AnalyticsDashboardProps {
  onBack: () => void;
}

export function AnalyticsDashboard({ onBack }: AnalyticsDashboardProps) {
  const [mounted, setMounted] = useState(false);
  const [lifetimeModal, setLifetimeModal] = useState<{ nome: string; telefone: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // [DT-U1, corrigido] `loading` era buscado no hook mas nunca lido — durante
  // o fetch inicial, topRebuyers.length === 0 fazia a tabela mostrar
  // "Sem dados." por um instante, como se realmente não houvesse
  // recompradores, antes dos dados chegarem.
  const { topRebuyers, topRecords, loading: loadingTopClients } = useTopClientsData();

  const recordsStats = useMemo(() => {
    if (!topRecords.length) return null;
    const totalFat = topRecords.reduce((s, c) => s + c.faturamento, 0);
    const totalPedidos = topRecords.reduce((s, c) => s + c.pedidos, 0);
    const totalItens = topRecords.reduce((s, c) => s + c.totalItens, 0);
    return { totalFat, totalPedidos, totalItens, count: topRecords.length };
  }, [topRecords]);

  const rebuyerStats = useMemo(() => {
    if (!topRebuyers.length) return null;
    const totalFat = topRebuyers.reduce((s, c) => s + c.faturamento, 0);
    const totalPedidos = topRebuyers.reduce((s, c) => s + c.pedidos, 0);
    return { totalFat, totalPedidos, avgPedidos: totalPedidos / topRebuyers.length, count: topRebuyers.length };
  }, [topRebuyers]);

  const cardVisible = (delay: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(24px)',
    transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
  });

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="w-full px-3 sm:px-6 lg:px-8 py-5 sm:py-8">

        {/* ── Header ── */}
        <header className="mb-8 flex items-center gap-3" style={cardVisible(0)}>
          <button onClick={onBack} className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Voltar">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-primary leading-tight">Dashboard Analítico</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Visão completa de performance e comportamento de clientes.</p>
          </div>
        </header>

        {/* ── Extracted Sections ── */}
        <ScorecardsRow mounted={mounted} />
        <RevenueChart mounted={mounted} />
        <SeasonalityHeatmap mounted={mounted} />
        <TopItemsPanel mounted={mounted} />

        {/* ── ROW 4: Rebuyers + Records side by side ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* ── Top 50 Rebuyers ── */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col" style={cardVisible(660)}>
            <div className="mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Crown size={18} className="text-yellow-400" />
                Top 50 Recompradores
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Clientes com mais pedidos · clique para ver histórico</p>
            </div>

            {rebuyerStats && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-muted/50 rounded-lg px-3 py-2 text-center border border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Clientes</p>
                  <p className="text-base font-bold text-primary mt-0.5">{rebuyerStats.count}</p>
                </div>
                <div className="bg-muted/50 rounded-lg px-3 py-2 text-center border border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Fat. Total</p>
                  <p className="text-sm font-bold text-emerald-500 mt-0.5">{formatCurrencyNoDecimals(rebuyerStats.totalFat)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg px-3 py-2 text-center border border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Média Pedidos</p>
                  <p className="text-base font-bold text-purple-400 mt-0.5">{rebuyerStats.avgPedidos.toFixed(1)}</p>
                </div>
              </div>
            )}

            <div className="overflow-auto flex-1 min-h-0 max-h-[clamp(18rem,45vh,34rem)]">
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="text-[11px] text-muted-foreground uppercase border-b border-border">
                    <th className="py-2 pr-3 font-semibold w-8">#</th>
                    <th className="py-2 pr-3 font-semibold">Nome</th>
                    <th className="py-2 pr-3 font-semibold text-center whitespace-nowrap">Pedidos</th>
                    <th className="py-2 font-semibold text-right whitespace-nowrap">Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingTopClients ? (
                    <tr><td colSpan={4} className="text-center text-muted-foreground py-8 text-sm">Carregando...</td></tr>
                  ) : topRebuyers.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-muted-foreground py-8 text-sm">Sem dados.</td></tr>
                  ) : topRebuyers.map((c, idx) => (
                    <tr
                      key={idx}
                      onClick={() => setLifetimeModal({ nome: c.nome, telefone: c.telefone })}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                      style={{ opacity: mounted ? 1 : 0, transition: `opacity 0.4s ease ${700 + idx * 18}ms` }}
                    >
                      <td className="py-2.5 pr-3">
                        {idx < 3 ? <span className="text-sm">{['🥇','🥈','🥉'][idx]}</span> : <span className="text-xs text-muted-foreground">{idx + 1}</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="font-medium text-foreground text-xs truncate block max-w-[140px]" title={c.nome}>{c.nome}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold ${idx < 3 ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-muted text-muted-foreground'}`}>
                          {c.pedidos}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-xs font-semibold text-emerald-500 whitespace-nowrap">{formatCurrencyNoDecimals(c.faturamento)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Clientes Recordes ── */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col" style={cardVisible(720)}>
            <div className="mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Trophy size={18} className="text-yellow-400" />
                Clientes Recordes da Domoby
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Quem mais já gastou em toda a história · clique para ver histórico</p>
            </div>

            {recordsStats && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-muted/50 rounded-lg px-3 py-2 text-center border border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Fat. Total</p>
                  <p className="text-sm font-bold text-emerald-500 mt-0.5">{formatCurrencyNoDecimals(recordsStats.totalFat)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg px-3 py-2 text-center border border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Pedidos</p>
                  <p className="text-base font-bold text-primary mt-0.5">{recordsStats.totalPedidos.toLocaleString('pt-BR')}</p>
                </div>
                <div className="bg-muted/50 rounded-lg px-3 py-2 text-center border border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Itens</p>
                  <p className="text-base font-bold text-purple-400 mt-0.5">{recordsStats.totalItens.toLocaleString('pt-BR')}</p>
                </div>
              </div>
            )}

            <div className="overflow-auto flex-1 min-h-0 max-h-[clamp(18rem,45vh,34rem)]">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] text-muted-foreground uppercase border-b border-border">
                  <tr>
                    <th className="py-2 pr-3 font-semibold w-8">#</th>
                    <th className="py-2 pr-3 font-semibold">Nome</th>
                    <th className="py-2 pr-3 font-semibold text-right whitespace-nowrap">Faturamento</th>
                    <th className="py-2 pr-3 font-semibold text-center whitespace-nowrap">Pedidos</th>
                    <th className="py-2 pr-3 font-semibold text-center whitespace-nowrap">Itens</th>
                    <th className="py-2 font-semibold">Top Produtos</th>
                  </tr>
                </thead>
                <tbody>
                  {topRecords.map((c, idx) => (
                    <tr
                      key={idx}
                      onClick={() => setLifetimeModal({ nome: c.nome, telefone: c.telefone })}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                      style={{ opacity: mounted ? 1 : 0, transition: `opacity 0.4s ease ${760 + idx * 30}ms` }}
                    >
                      <td className="py-3 pr-3">
                        {idx < 3 ? <span className="text-sm">{['🥇','🥈','🥉'][idx]}</span> : <span className="text-xs text-muted-foreground">{idx + 1}</span>}
                      </td>
                      <td className="py-3 pr-3">
                        <span className="font-semibold text-foreground text-sm truncate block max-w-[160px]" title={c.nome}>{c.nome}</span>
                        {c.telefone && <span className="text-[11px] text-muted-foreground block">{c.telefone}</span>}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <span className="font-bold text-emerald-500 whitespace-nowrap text-sm">{formatCurrency(c.faturamento)}</span>
                      </td>
                      <td className="py-3 pr-3 text-center">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold ${idx < 3 ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-muted text-muted-foreground'}`}>
                          {c.pedidos}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-center">
                        <span className="text-sm font-medium text-foreground">{c.totalItens}</span>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1 max-w-[300px]">
                          {c.topItems.slice(0, 3).map(([name, count]) => (
                            <span key={name} title={name} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground border border-border/60 max-w-[130px] truncate">
                              {name}{count > 1 ? ` ×${count}` : ''}
                            </span>
                          ))}
                          {c.topItems.length > 3 && (
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">+{c.topItems.length - 3} mais</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <PurchaseFrequencyChart mounted={mounted} />
        <TransitionChart mounted={mounted} />
      </div>

      <CustomerLifetimeModal
        isOpen={!!lifetimeModal}
        onClose={() => setLifetimeModal(null)}
        customerName={lifetimeModal?.nome || ''}
        customerPhone={lifetimeModal?.telefone || ''}
      />
    </div>
  );
}
