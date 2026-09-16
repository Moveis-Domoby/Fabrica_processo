import { useState } from 'react';
import { Send, Clock, Users, X, Zap } from 'lucide-react';
import { DISPARO_LIBERADO, MOTIVO_DISPARO_TRAVADO } from '../../travas';

interface DispararModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (intervaloSegundos: number, tarifaAplicada: number) => Promise<void>;
  totalAguardandoEnvio: number;
}

function formatarTempoTotal(totalSegundos: number): string {
  if (totalSegundos < 60) return `${totalSegundos}s`;
  if (totalSegundos < 3600) {
    const m = Math.floor(totalSegundos / 60);
    const s = totalSegundos % 60;
    return s > 0 ? `${m}min ${s}s` : `${m}min`;
  }
  const h = Math.floor(totalSegundos / 3600);
  const m = Math.floor((totalSegundos % 3600) / 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function DispararModal({ isOpen, onClose, onConfirm, totalAguardandoEnvio }: DispararModalProps) {
  const [usarMinutos, setUsarMinutos] = useState(false);
  const [valorInput, setValorInput] = useState('60');
  const [isConfirming, setIsConfirming] = useState(false);
  const [erro, setErro] = useState('');
  const [custoMensagem, setCustoMensagem] = useState('0.35');

  if (!isOpen) return null;

  const valorNumerico = Math.max(1, parseInt(valorInput) || 1);
  const intervaloSegundos = usarMinutos ? valorNumerico * 60 : valorNumerico;
  const tempoTotalSegundos = totalAguardandoEnvio * intervaloSegundos;

  const handleConfirmar = async () => {
    // Trava da união (D-46): o botão já nasce desabilitado; este é o cinto.
    if (!DISPARO_LIBERADO) {
      setErro(MOTIVO_DISPARO_TRAVADO);
      return;
    }
    if (intervaloSegundos < 10) {
      setErro('Intervalo mínimo é 10 segundos para evitar bloqueios.');
      return;
    }
    setErro('');
    setIsConfirming(true);
    try {
      const tarifa = parseFloat(custoMensagem.replace(',', '.'));
      await onConfirm(intervaloSegundos, isNaN(tarifa) ? 0 : tarifa);
      onClose();
    } catch (e: any) {
      setErro('Erro ao iniciar disparo: ' + e.message);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Zap size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base">Iniciar Disparo</h2>
              <p className="text-xs text-muted-foreground">Configure o ritmo de envio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Intervalo */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Clock size={14} className="text-primary" />
              Intervalo entre envios
            </label>
            <div className="flex gap-2">
              <input
                id="intervalo-disparo-input"
                type="number"
                min="1"
                value={valorInput}
                onChange={e => setValorInput(e.target.value)}
                className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
              />
              <div className="flex bg-muted rounded-lg p-1 gap-1">
                <button
                  id="btn-unidade-segundos"
                  onClick={() => { setUsarMinutos(false); setValorInput('60'); }}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    !usarMinutos
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  seg
                </button>
                <button
                  id="btn-unidade-minutos"
                  onClick={() => { setUsarMinutos(true); setValorInput('1'); }}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    usarMinutos
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  min
                </button>
              </div>
            </div>
          </div>

          {/* Custo da Mensagem */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Zap size={14} className="text-primary" />
              Custo da Mensagem (API Oficial)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <input
                  id="custo-mensagem-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={custoMensagem}
                  onChange={e => setCustoMensagem(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg pl-9 pr-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">O custo final descontará os contatos que retornarem erro no envio.</p>
          </div>

          {/* Resumo */}
          <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumo do disparo</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Users size={14} className="text-primary" />
                <span>Contatos na fila</span>
              </div>
              <span className="font-bold text-foreground">{totalAguardandoEnvio}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Clock size={14} className="text-primary" />
                <span>Intervalo</span>
              </div>
              <span className="font-medium text-foreground">
                {usarMinutos
                  ? `${valorNumerico}min (${intervaloSegundos}s)`
                  : `${intervaloSegundos}s`}
              </span>
            </div>

            <div className="h-px bg-border" />

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">⏱ Tempo total estimado</span>
              <span className="font-bold text-primary text-base">
                {totalAguardandoEnvio === 0 ? '—' : formatarTempoTotal(tempoTotalSegundos)}
              </span>
            </div>
          </div>

          {totalAguardandoEnvio === 0 && (
            <p className="text-sm text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
              ⚠️ Não há contatos com status <strong>aguardando envio</strong> nesta lista.
            </p>
          )}

          {erro && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}

          {!DISPARO_LIBERADO && (
            <p className="text-sm text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
              ⚠️ {MOTIVO_DISPARO_TRAVADO}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex gap-3 bg-muted/10">
          <button
            id="btn-cancelar-disparo"
            onClick={onClose}
            disabled={isConfirming}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            id="btn-confirmar-disparo"
            onClick={handleConfirmar}
            title={DISPARO_LIBERADO ? undefined : MOTIVO_DISPARO_TRAVADO}
            disabled={!DISPARO_LIBERADO || isConfirming || totalAguardandoEnvio === 0}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isConfirming ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Iniciando...
              </>
            ) : (
              <>
                <Send size={16} />
                Confirmar disparo
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
