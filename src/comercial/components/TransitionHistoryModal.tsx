import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTransitionsClientsQuery } from '../data/queries';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TransitionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  purchaseNumber: number;
  start: Date | null;
  end: Date | null;
}

export function TransitionHistoryModal({ isOpen, onClose, title, purchaseNumber, start, end }: TransitionHistoryModalProps) {
  const [page, setPage] = useState(0);
  const pageSize = 10;
  
  const { data: clientes = [], isLoading } = useTransitionsClientsQuery(purchaseNumber, start, end, isOpen, pageSize + 1, page * pageSize);

  const hasNextPage = clientes.length > pageSize;
  const displayClientes = clientes.slice(0, pageSize);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div 
        className="w-full max-w-4xl max-h-[85vh] bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayClientes.length === 0 ? (
            <p className="text-base text-muted-foreground text-center py-10">Nenhum dado disponível.</p>
          ) : (
            <div className="space-y-4">
              {displayClientes.map((cliente: any, idx: number) => {
                const pDate = new Date(cliente.prev_date);
                const cDate = new Date(cliente.curr_date);
                
                return (
                  <div
                    key={`${cliente.client_id}-${idx}`}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/10 hover:bg-muted/20 border border-border/50 transition-colors"
                  >
                    <div className="flex flex-col gap-1 w-1/3">
                      <span className="text-base font-bold text-foreground truncate" title={cliente.client_id}>
                        {cliente.client_id}
                      </span>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-1 w-1/3">
                      <span className="text-sm font-black text-primary-foreground bg-primary px-4 py-1.5 rounded-full shadow-sm">
                        {cliente.days_since_last} dias
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1 w-1/3">
                      <span className="text-sm text-muted-foreground font-medium">
                        {format(pDate, "dd/MM/yyyy", { locale: ptBR })} <span className="mx-1">→</span> {format(cDate, "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-card border border-border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
          >
            <ChevronLeft size={16} /> Anterior
          </button>
          
          <span className="text-sm font-bold text-muted-foreground">
            Página {page + 1}
          </span>
          
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasNextPage}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-card border border-border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
          >
            Próxima <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
