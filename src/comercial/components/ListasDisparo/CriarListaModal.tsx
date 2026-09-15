import { useState } from 'react';
import { X, Users, Save, Scissors, Check, Pencil } from 'lucide-react';
import type { GroupedCustomer, ListaDisparo } from '../../types';
import { criarListaRascunho } from '../../lib/disparo/api';

interface CriarListaModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredData: GroupedCustomer[];
  onListasCriadas: (listas: ListaDisparo[]) => void;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

export function CriarListaModal({ isOpen, onClose, filteredData, onListasCriadas }: CriarListaModalProps) {
  const [nome, setNome] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Split state
  const [splitCount, setSplitCount] = useState<number | null>(null);
  const [splitInputVisible, setSplitInputVisible] = useState(false);
  const [splitInputValue, setSplitInputValue] = useState('');

  // Clientes com e sem telefone
  const validData = filteredData.filter(c => c.telefone && c.telefone.replace(/\D/g, '').length >= 8);
  const semTelefone = filteredData.filter(c => !c.telefone || c.telefone.replace(/\D/g, '').length < 8);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleConfirmSplit = () => {
    const n = parseInt(splitInputValue, 10);
    if (isNaN(n) || n < 2) {
      setSplitCount(null);
    } else {
      setSplitCount(Math.min(n, validData.length));
    }
    setSplitInputVisible(false);
  };

  const handleSplitKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleConfirmSplit();
    if (e.key === 'Escape') {
      setSplitInputVisible(false);
      setSplitInputValue('');
    }
  };

  const handleEditSplit = () => {
    setSplitInputValue(splitCount?.toString() ?? '');
    setSplitInputVisible(true);
  };

  const handleRemoveSplit = () => {
    setSplitCount(null);
    setSplitInputValue('');
    setSplitInputVisible(false);
  };

  // Preview sizes for display (usa apenas clientes válidos)
  const getSplitPreview = () => {
    if (!splitCount || splitCount < 2) return null;
    const chunkSize = Math.ceil(validData.length / splitCount);
    const chunks = chunk(validData, chunkSize);
    return chunks.map((ch, i) => ({ part: i + 1, count: ch.length }));
  };

  const splitPreview = getSplitPreview();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError('O nome da lista é obrigatório.');
      return;
    }
    if (validData.length === 0) {
      setError('Nenhum cliente com telefone válido foi encontrado. Ajuste os filtros antes de criar.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      if (splitCount && splitCount >= 2) {
        // Criar N listas divididas usando apenas clientes válidos
        const chunkSize = Math.ceil(validData.length / splitCount);
        const chunks = chunk(validData, chunkSize);
        const listas: ListaDisparo[] = [];
        for (let i = 0; i < chunks.length; i++) {
          const nomeParte = `${nome.trim()} - Parte ${i + 1}`;
          const lista = await criarListaRascunho(nomeParte, chunks[i]);
          listas.push(lista);
        }
        setNome('');
        setSplitCount(null);
        onListasCriadas(listas);
      } else {
        // Criar lista única com clientes válidos
        const novaLista = await criarListaRascunho(nome.trim(), validData);
        setNome('');
        onListasCriadas([novaLista]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao criar a lista.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border bg-muted/20">
          <h2 className="text-xl font-bold text-foreground">Nova Lista de Disparo</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-4">
              Os clientes que farão parte desta lista são definidos pelos <strong>filtros ativos na aba principal</strong> ("Painel de Recompra").
            </p>

            {/* Público selecionado */}
            <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl mb-4">
              <div className="p-3 bg-primary/10 rounded-lg text-primary">
                <Users size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Tamanho do Público</p>
                <p className="text-2xl font-bold text-primary">{validData.length} clientes</p>
                {semTelefone.length > 0 && (
                  <p className="text-xs text-amber-500 mt-0.5">
                    {semTelefone.length} sem telefone ser{semTelefone.length > 1 ? 'ão ignorados' : 'á ignorado'}
                  </p>
                )}
              </div>
            </div>

            {/* Aviso de clientes sem telefone */}
            {semTelefone.length > 0 && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold text-sm mt-0.5 shrink-0">⚠</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-500 mb-1.5">
                      {semTelefone.length} cliente{semTelefone.length > 1 ? 's' : ''} sem telefone — ser{semTelefone.length > 1 ? 'ão ignorados' : 'á ignorado'}
                    </p>
                    <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                      {semTelefone.map((c, i) => (
                        <li key={i} className="text-xs text-amber-400/90 leading-tight truncate">
                          · {c.nome || '(sem nome)'}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors size={14} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Dividir lista</span>
                  {splitCount && !splitInputVisible && (
                    <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold">
                      {splitCount} partes
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {splitCount && !splitInputVisible ? (
                    <>
                      <button
                        type="button"
                        onClick={handleEditSplit}
                        className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                      >
                        <Pencil size={11} /> Editar quantidade
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveSplit}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        title="Remover divisão"
                      >
                        <X size={13} />
                      </button>
                    </>
                  ) : !splitInputVisible ? (
                    <button
                      type="button"
                      onClick={() => { setSplitInputVisible(true); setSplitInputValue(''); }}
                      className="text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg font-medium transition-colors border border-border"
                    >
                      Configurar divisão
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Input de quantidade */}
              {splitInputVisible && (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="number"
                    min={2}
                    max={filteredData.length}
                    value={splitInputValue}
                    onChange={e => setSplitInputValue(e.target.value)}
                    onKeyDown={handleSplitKeyDown}
                    placeholder="Quantas partes? (mín. 2)"
                    className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground/50"
                  />
                  <button
                    type="button"
                    onClick={handleConfirmSplit}
                    className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    title="Confirmar"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSplitInputVisible(false); setSplitInputValue(''); }}
                    className="p-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Preview das partes */}
              {splitPreview && !splitInputVisible && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {splitPreview.map(({ part, count }) => (
                    <div key={part} className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs">
                      <span className="font-semibold text-foreground">Parte {part}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-primary font-medium">{count} clientes</span>
                    </div>
                  ))}
                </div>
              )}

              {!splitCount && !splitInputVisible && (
                <p className="text-xs text-muted-foreground">
                  Opcional: divida automaticamente os clientes em listas com tamanhos iguais.
                </p>
              )}
            </div>
          </div>

          <form id="form-criar-lista" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="nomeLista" className="block text-sm font-medium text-foreground mb-1">
                Nome da Campanha
                {splitCount && splitCount >= 2 && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    (será sufixado com "- Parte 1", "- Parte 2", etc.)
                  </span>
                )}
              </label>
              <input
                id="nomeLista"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Reativação Black Friday"
                className="w-full bg-background border border-input rounded-lg px-4 py-2.5 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground/50"
                autoFocus
              />
            </div>
          </form>
        </div>

        <div className="p-4 sm:p-6 border-t border-border bg-muted/20 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium text-muted-foreground hover:bg-muted transition-colors"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="form-criar-lista"
            disabled={isSaving || filteredData.length === 0}
            className="bg-primary text-primary-foreground flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isSaving ? (
              <span className="animate-spin h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full" />
            ) : (
              <Save size={18} />
            )}
            <span>
              {splitCount && splitCount >= 2
                ? `Criar ${splitCount} listas`
                : 'Salvar Lista'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
