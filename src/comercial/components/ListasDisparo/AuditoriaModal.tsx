import { X } from 'lucide-react';
import type { ListaDisparoEvento } from '../../types';
import { format } from 'date-fns';

interface AuditoriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventos: ListaDisparoEvento[];
}

export function AuditoriaModal({ isOpen, onClose, eventos }: AuditoriaModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border bg-muted/20">
          <h2 className="text-xl font-bold text-foreground">Linha do Tempo (Auditoria)</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
          {eventos.length === 0 ? (
            <p className="text-muted-foreground text-center text-sm">Nenhum evento registrado ainda.</p>
          ) : (
            <div className="space-y-4">
              {eventos.map(ev => (
                <div key={ev.id} className="flex gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5"></div>
                    <div className="w-px h-full bg-border my-1"></div>
                  </div>
                  <div className="pb-2">
                    <p className="font-medium text-foreground">{ev.tipo_evento}</p>
                    <p className="text-muted-foreground">{ev.descricao}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">{format(new Date(ev.criado_em), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
