import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, TrendingUp, Package, Calendar, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { extractItemName } from './ItemsModal';
import type { SaleRecord } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CustomerLifetimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  customerPhone: string;
}

interface LifetimeData {
  records: SaleRecord[];
  faturamentoTotal: number;
  totalItens: number;
  allItems: string[];
}

export function CustomerLifetimeModal({
  isOpen,
  onClose,
  customerName,
  customerPhone,
}: CustomerLifetimeModalProps) {
  const [lifetimeData, setLifetimeData] = useState<LifetimeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Lazy load: busca apenas ao abrir e quando o cliente muda ───────────
  useEffect(() => {
    if (!isOpen) return;

    async function fetchLifetime() {
      setLoading(true);
      setFetchError(null);
      setLifetimeData(null);

      try {
        let records: SaleRecord[] = [];

        // ── Busca por telefone com múltiplas variantes de formato ──────────
        if (customerPhone && customerPhone.trim() !== '') {
          const raw = customerPhone.trim();
          const digits = raw.replace(/\D/g, '');

          // Gera todas as variantes possíveis de armazenamento
          const variants = new Set<string>();
          variants.add(raw);
          if (digits) {
            variants.add(digits);
            // Sem DDI (ex: 84999674564 → caso o banco guarde sem 55)
            if (digits.startsWith('55') && digits.length >= 12) {
              variants.add(digits.slice(2));
            }
            // Com DDI (ex: 84999674564 → 5584999674564)
            if (!digits.startsWith('55')) {
              variants.add(`55${digits}`);
            }
          }

          const variantList = Array.from(variants).filter(Boolean);

          // [SESSAO-20] A leitura direta de vendas_marketing virou a RPC
          // gateada fn_vendas_cliente (item 0/A da união): mesmas variantes de
          // telefone, mesma ordem (data_compra asc, dentro da RPC).
          const { data: byPhone, error: phoneErr } = await supabase.rpc('fn_vendas_cliente', {
            p_telefones: variantList,
          });

          if (phoneErr) throw phoneErr;
          records = (byPhone || []) as SaleRecord[];
        }

        // ── Fallback: busca por nome se o telefone não retornou nada ───────
        if (records.length === 0 && customerName && customerName.trim() !== '') {
          const { data: byName, error: nameErr } = await supabase.rpc('fn_vendas_cliente', {
            p_nome_parcial: customerName.trim(),
          });

          if (nameErr) throw nameErr;
          records = (byName || []) as SaleRecord[];
        }

        // ── Calcula totais de vida ─────────────────────────────────────────
        let faturamentoTotal = 0;
        let totalItens = 0;
        const allItems: string[] = [];

        records.forEach(r => {
          faturamentoTotal += Number(r.valor_pedido || 0);
          totalItens += Number(r.numero_itens || 0);

          let parsedItems: any[] = [];
          if (typeof r.itens_comprados === 'string') {
            try { parsedItems = JSON.parse(r.itens_comprados); } catch { /* skip */ }
          } else if (Array.isArray(r.itens_comprados)) {
            parsedItems = r.itens_comprados;
          } else if (r.itens_comprados) {
            parsedItems = [r.itens_comprados];
          }

          parsedItems.forEach(item => {
            const name = extractItemName(item);
            if (name && name.trim() !== '') allItems.push(name);
          });
        });

        setLifetimeData({ records, faturamentoTotal, totalItens, allItems });
      } catch (err: any) {
        console.error('[CustomerLifetimeModal] fetch error:', err);
        setFetchError(err.message || 'Erro ao buscar histórico do cliente.');
      } finally {
        setLoading(false);
      }
    }

    fetchLifetime();
  }, [isOpen, customerPhone, customerName]);

  // Fecha com ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Consolida items para exibição (sem duplicatas, com contagem)
  const consolidatedItems = useMemo(() => {
    if (!lifetimeData) return [];
    const map = new Map<string, number>();
    lifetimeData.allItems.forEach(item => {
      map.set(item, (map.get(item) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [lifetimeData]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex justify-between items-start p-5 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <TrendingUp size={16} className="text-primary" />
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Histórico de Vida</span>
            </div>
            <h3 className="font-bold text-lg text-foreground truncate max-w-xs">
              {customerName || customerPhone || 'Cliente'}
            </h3>
            {customerPhone && (
              <p className="text-xs text-muted-foreground mt-0.5">{customerPhone}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando histórico...</p>
            </div>
          )}

          {/* Erro */}
          {fetchError && !loading && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-destructive">
              {fetchError}
            </div>
          )}

          {/* Dados carregados */}
          {lifetimeData && !loading && (
            <>
              {/* KPI Cards de Vida */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-xl p-3 flex flex-col gap-1 border border-border/60">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <DollarSign size={13} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide">Faturamento</span>
                  </div>
                  <span className="text-sm font-bold text-foreground leading-tight">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lifetimeData.faturamentoTotal)}
                  </span>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 flex flex-col gap-1 border border-border/60">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Package size={13} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide">Total Itens</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{lifetimeData.totalItens}</span>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 flex flex-col gap-1 border border-border/60">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar size={13} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide">Pedidos</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{lifetimeData.records.length}</span>
                </div>
              </div>

              {/* Linha do Tempo de Pedidos */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Calendar size={12} />
                  Linha do Tempo
                </h4>
                {lifetimeData.records.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
                ) : (
                  <div className="relative space-y-0">
                    {/* Linha vertical da timeline */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                    {lifetimeData.records.map((record, idx) => (
                      <div key={record.id || idx} className="flex gap-3 items-start pb-4 last:pb-0">
                        {/* Dot */}
                        <div className={`shrink-0 w-3.5 h-3.5 rounded-full border-2 mt-0.5 z-10 ${
                          idx === lifetimeData!.records.length - 1
                            ? 'bg-primary border-primary'
                            : 'bg-card border-border'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">
                              {format(new Date(record.data_compra), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </span>
                            <span className="text-xs font-semibold text-emerald-500 shrink-0">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(record.valor_pedido || 0))}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {record.numero_itens} {Number(record.numero_itens) === 1 ? 'item' : 'itens'}
                            {record.numero_pedido ? ` · Pedido #${record.numero_pedido}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista de Produtos Consolidada */}
              {consolidatedItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Package size={12} />
                    Produtos Comprados
                  </h4>
                  <ul className="space-y-1.5">
                    {consolidatedItems.map(([name, count], idx) => (
                      <li
                        key={idx}
                        className="bg-muted/40 px-3 py-2 rounded-lg border border-border/50 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          <div className="flex-1 overflow-x-auto scrollbar-none cursor-grab active:cursor-grabbing select-none">
                            <span className="whitespace-nowrap text-foreground">{name}</span>
                          </div>
                          {count > 1 && (
                            <span className="shrink-0 text-[11px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              ×{count}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
