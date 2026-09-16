import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { extractItemName, extractItemValue } from '../lib/utils';
import { supabase } from '../lib/supabase';
import type { FilterState } from '../types';

export { extractItemName, extractItemValue };

interface ItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  telefone?: string;
  filters?: FilterState;
}

// Cache global no módulo para não refazer requisições ao abrir o mesmo cliente novamente
const itemsCache: Record<string, any[]> = {};

export function ItemsModal({ isOpen, onClose, customerName, telefone, filters }: ItemsModalProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchItems() {
      if (!isOpen || !telefone) return;
      
      // [DT-F8, corrigido] A chave de cache não incluía customDateEnd nem os
      // modos de data específica (specificMonth/specificDay/specificYear) —
      // ao trocar, por exemplo, de "Julho/2026" para "Agosto/2026" (ambos
      // sem customDateStart), a chave ficava idêntica e o modal reaproveitava
      // os itens do mês errado do cache. Agora a chave cobre todos os campos
      // de filtro de data que o efeito abaixo realmente usa para filtrar.
      const cacheKey = [
        telefone,
        filters?.dateFilter || 'all',
        filters?.customDateStart || '',
        filters?.customDateEnd || '',
        filters?.specificMonth || '',
        filters?.specificDay || '',
        filters?.specificYear || '',
      ].join('_');
      if (itemsCache[cacheKey]) {
        setItems(itemsCache[cacheKey]);
        return;
      }

      setLoading(true);
      setItems([]);

      try {
        // [SESSAO-20] A leitura direta de vendas_marketing virou a RPC gateada
        // fn_vendas_cliente (item 0/A da união) — mesmo recorte por telefone
        // exato; o filtro de período continua sendo aplicado localmente abaixo,
        // como sempre foi.
        const { data, error } = await supabase.rpc('fn_vendas_cliente', {
          p_telefones: [telefone],
        });
        if (error) throw error;

        let allItems: any[] = [];
        data?.forEach((record: any) => {
          // If we want to strictly apply the global date filter, we could check record.data_compra here
          // But since it says "Itens do Período", we should ideally filter by the period.
          const compraDate = new Date(record.data_compra);
          let inPeriod = true;
          
          if (filters && filters.dateFilter !== 'all') {
            const { dateFilter, customDateStart, customDateEnd, specificMonth, specificDay, specificYear } = filters;
            if (dateFilter === 'custom' && customDateStart && customDateEnd) {
               inPeriod = compraDate >= new Date(customDateStart) && compraDate <= new Date(customDateEnd + 'T23:59:59');
            } else if (dateFilter === 'specificMonth' && specificMonth) {
               inPeriod = record.data_compra.startsWith(specificMonth);
            } else if (dateFilter === 'specificDay' && specificDay) {
               inPeriod = record.data_compra.startsWith(specificDay);
            } else if (dateFilter === 'specificYear' && specificYear) {
               inPeriod = record.data_compra.startsWith(specificYear);
            }
          }

          if (inPeriod) {
            let parsed = record.itens_comprados;
            if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed); } catch { parsed = []; }
            }
            if (Array.isArray(parsed)) {
              allItems = [...allItems, ...parsed];
            }
          }
        });

        if (isMounted) {
          itemsCache[cacheKey] = allItems;
          setItems(allItems);
        }
      } catch (err) {
        console.error('Error fetching items for client:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchItems();
    return () => { isMounted = false; };
  }, [isOpen, telefone, filters]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-xl shadow-lg border border-border flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h3 className="font-semibold text-lg text-foreground truncate pr-4">Itens do Período — {customerName}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum item registrado.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item, idx) => (
                <li key={idx} className="bg-muted/50 p-3 rounded-lg text-sm border border-border/50">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block shrink-0" />
                    <div className="flex-1 overflow-x-auto scrollbar-none cursor-grab active:cursor-grabbing select-none">
                      <span className="whitespace-nowrap">{extractItemName(item)}</span>
                    </div>
                    {(() => {
                      const val = extractItemValue(item);
                      return val !== null ? (
                        <span className="font-medium text-emerald-500 shrink-0 whitespace-nowrap ml-2">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
