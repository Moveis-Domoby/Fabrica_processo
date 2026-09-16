import { X, Send, MessageSquare, CheckCircle2, XCircle, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { format, formatDistanceStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ListaDisparoMembro, ListaDisparoEvento } from '../../types';

interface MembroAuditoriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  membro: ListaDisparoMembro;
  eventos: ListaDisparoEvento[];
}

// Mapeia tipo_evento para ícone, cor e label legível
function eventConfig(tipo: string): { icon: React.ReactNode; color: string; label: string } {
  switch (tipo) {
    case 'envio_registrado':
      return { icon: <Send size={14} />, color: 'bg-blue-500 text-blue-500', label: 'Mensagem Disparada' };
    case 'resposta_recebida':
      return { icon: <MessageSquare size={14} />, color: 'bg-emerald-500 text-emerald-500', label: 'Resposta Recebida' };
    case 'negocio_ganho':
      return { icon: <TrendingUp size={14} />, color: 'bg-green-500 text-green-500', label: 'Venda Confirmada' };
    case 'timer_resposta_expirado':
      return { icon: <Clock size={14} />, color: 'bg-orange-500 text-orange-500', label: 'Sem Resposta (Prazo Expirado)' };
    case 'timer_resultado_expirado':
      return { icon: <XCircle size={14} />, color: 'bg-red-500 text-red-500', label: 'Prazo de Resultado Expirado' };
    case 'erro_envio_mensagem':
      return { icon: <AlertTriangle size={14} />, color: 'bg-red-400 text-red-400', label: 'Erro no Envio' };
    default:
      return { icon: <CheckCircle2 size={14} />, color: 'bg-muted-foreground text-muted-foreground', label: tipo };
  }
}

function formatarData(iso: string | null | undefined) {
  if (!iso) return '—';
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function calcularDistancia(de: string | null | undefined, ate: string | null | undefined): string | null {
  if (!de || !ate) return null;
  try {
    return formatDistanceStrict(new Date(ate), new Date(de), { locale: ptBR });
  } catch {
    return null;
  }
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  aguardando_envio:               { label: 'Aguardando Envio',        className: 'bg-muted text-muted-foreground' },
  aguardando_resposta:            { label: 'Aguardando Resposta',      className: 'bg-yellow-500/10 text-yellow-500' },
  respondido_aguardando_resultado:{ label: 'Em Negociação',            className: 'bg-blue-500/10 text-blue-500' },
  ganho:                          { label: 'Ganho ✓',                 className: 'bg-emerald-500/10 text-emerald-500' },
  perdido:                        { label: 'Perdido',                  className: 'bg-red-500/10 text-red-500' },
};

export function MembroAuditoriaModal({ isOpen, onClose, membro, eventos }: MembroAuditoriaModalProps) {
  if (!isOpen) return null;

  // Filtra eventos deste membro específico, mais antigo primeiro
  const eventosDoMembro = eventos
    .filter(ev => ev.membro_id === membro.id)
    .sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());

  const statusInfo = STATUS_LABEL[membro.status] ?? { label: membro.status, className: 'bg-muted text-muted-foreground' };
  const tempoResposta = calcularDistancia(membro.data_envio, membro.data_resposta);
  const tempoResultado = calcularDistancia(membro.data_resposta, membro.data_resultado);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border bg-muted/20">
          <div>
            <h2 className="text-base font-bold text-foreground">{membro.nome_cliente}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{membro.telefone}</p>
            <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.className}`}>
              {statusInfo.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Resumo de datas */}
          <div className="grid grid-cols-2 gap-3 p-5 border-b border-border">
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Disparo</p>
              <p className="text-xs font-medium text-foreground">{formatarData(membro.data_envio)}</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Resposta</p>
              <p className="text-xs font-medium text-foreground">{formatarData(membro.data_resposta)}</p>
              {tempoResposta && (
                <p className="text-[10px] text-muted-foreground mt-0.5">após {tempoResposta}</p>
              )}
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Prazo Resposta</p>
              <p className="text-xs font-medium text-foreground">{formatarData(membro.prazo_resposta_limite)}</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {membro.status === 'ganho' ? 'Data do Resultado' : 'Prazo Resultado'}
              </p>
              <p className="text-xs font-medium text-foreground">
                {formatarData(membro.data_resultado ?? membro.prazo_resultado_limite)}
              </p>
              {tempoResultado && (
                <p className="text-[10px] text-muted-foreground mt-0.5">após {tempoResultado}</p>
              )}
            </div>
            {membro.valor_ganho != null && (
              <div className="col-span-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">Valor Ganho</p>
                <p className="text-base font-bold text-emerald-500">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(membro.valor_ganho)}
                </p>
              </div>
            )}
          </div>

          {/* Timeline de eventos */}
          <div className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Linha do Tempo</p>
            {eventosDoMembro.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento registrado ainda.</p>
            ) : (
              <div className="relative">
                {/* Linha vertical */}
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

                <div className="space-y-5">
                  {eventosDoMembro.map((ev, idx) => {
                    const cfg = eventConfig(ev.tipo_evento);
                    const isLast = idx === eventosDoMembro.length - 1;
                    return (
                      <div key={ev.id} className="flex gap-4 relative">
                        {/* Dot */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 bg-card border-2 ${
                          cfg.color.includes('blue') ? 'border-blue-500' :
                          cfg.color.includes('emerald') || cfg.color.includes('green') ? 'border-emerald-500' :
                          cfg.color.includes('orange') ? 'border-orange-500' :
                          cfg.color.includes('red') ? 'border-red-500' :
                          'border-muted-foreground'
                        }`}>
                          <span className={cfg.color.split(' ')[1]}>{cfg.icon}</span>
                        </div>
                        {/* Content */}
                        <div className={`flex-1 pb-1 ${isLast ? '' : ''}`}>
                          <p className="text-sm font-semibold text-foreground">{cfg.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ev.descricao}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {formatarData(ev.criado_em)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
