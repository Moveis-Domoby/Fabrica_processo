import { useState, useEffect } from 'react';
import { X, Users, Save, AlertTriangle } from 'lucide-react';
import type { GroupedCustomer, ListaDisparo } from '../../types';
import { adicionarMembrosALista } from '../../lib/disparo/api';
import { supabase } from '../../lib/supabase';

interface AdicionarListaModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredData: GroupedCustomer[];
  onListaAdicionada: (listaId: string) => void;
}

export function AdicionarListaModal({ isOpen, onClose, filteredData, onListaAdicionada }: AdicionarListaModalProps) {
  const [listas, setListas] = useState<ListaDisparo[]>([]);
  const [selectedListaId, setSelectedListaId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // [DT-D9] Mesma validação de telefone usada em CriarListaModal — sem ela,
  // clientes sem telefone (ou com telefone inválido) viram "membro fantasma"
  // (normalizarTelefone(null) devolve '', passa no NOT NULL da coluna) e o
  // segundo cliente sem telefone colide na UNIQUE (lista_id, telefone) e
  // derruba o lote inteiro.
  const validData = filteredData.filter(c => c.telefone && c.telefone.replace(/\D/g, '').length >= 8);
  const semTelefone = filteredData.filter(c => !c.telefone || c.telefone.replace(/\D/g, '').length < 8);

  useEffect(() => {
    if (isOpen) {
      supabase
        .from('listas_disparo')
        .select('*')
        .order('criado_em', { ascending: false })
        // [DT-D9] Não faz sentido adicionar membros a uma lista já encerrada
        // — o AdicionarListaModal, ao contrário do CriarListaModal, não
        // excluía listas 'encerrada' do select.
        .neq('status', 'encerrada')
        .then(({ data }) => {
          if (data) setListas(data as ListaDisparo[]);
          if (data && data.length > 0) setSelectedListaId(data[0].id);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListaId) {
      setError('Selecione uma lista existente.');
      return;
    }
    if (validData.length === 0) {
      setError('Nenhum cliente com telefone válido foi encontrado. Ajuste os filtros antes de adicionar.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await adicionarMembrosALista(selectedListaId, validData);
      onListaAdicionada(selectedListaId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao adicionar à lista.');
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
          <h2 className="text-xl font-bold text-foreground">Adicionar a Lista Existente</h2>
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
              Você está prestes a adicionar leads à uma lista de disparo já criada.
            </p>
            <div className="flex items-center gap-3 p-4 bg-secondary/5 border border-secondary/20 rounded-xl">
              <div className="p-3 bg-secondary/10 rounded-lg text-secondary-foreground">
                <Users size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Leads Selecionados</p>
                <p className="text-2xl font-bold text-secondary-foreground">{validData.length} clientes</p>
                {semTelefone.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                    {semTelefone.length} sem telefone ser{semTelefone.length > 1 ? 'ão ignorados' : 'á ignorado'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {semTelefone.length > 0 && (
            <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-2">
              <AlertTriangle size={16} className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {semTelefone.length} cliente{semTelefone.length > 1 ? 's' : ''} sem telefone — ser{semTelefone.length > 1 ? 'ão ignorados' : 'á ignorado'} ao adicionar.
              </p>
            </div>
          )}

          <form id="form-add-lista" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="listaExistente" className="block text-sm font-medium text-foreground mb-1">
                Escolha a Lista
              </label>
              {listas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Você ainda não tem listas ativas.</p>
              ) : (
                <select
                  id="listaExistente"
                  value={selectedListaId}
                  onChange={(e) => setSelectedListaId(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg px-4 py-2.5 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                >
                  {listas.map(l => (
                    <option key={l.id} value={l.id}>{l.nome}</option>
                  ))}
                </select>
              )}
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
            form="form-add-lista"
            disabled={isSaving || validData.length === 0 || listas.length === 0}
            className="bg-primary text-primary-foreground flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isSaving ? (
              <span className="animate-spin h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full" />
            ) : (
              <Save size={18} />
            )}
            <span>Adicionar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
