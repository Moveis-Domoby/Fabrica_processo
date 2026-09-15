import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { ListaDisparo } from '../types';
import { ChevronDown } from 'lucide-react';

interface ListasDropdownProps {
  onSelectLista: (listaId: string) => void;
  isActive: boolean;
}

export function ListasDropdown({ onSelectLista, isActive }: ListasDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [listas, setListas] = useState<ListaDisparo[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);

  const fetchListas = async () => {
    // 1. Busca as listas ordenadas por data
    const { data: listasData } = await supabase
      .from('listas_disparo')
      .select('id, nome, criado_em')
      .order('criado_em', { ascending: false });

    // 2. Busca a quantidade de membros da view
    const { data: scoresData } = await supabase
      .from('vw_scorecards_lista')
      .select('lista_id, total_membros');

    if (listasData) {
      const formatted = listasData.map(lista => {
        const score = scoresData?.find(s => s.lista_id === lista.id);
        return {
          id: lista.id,
          nome: lista.nome,
          total_membros: score?.total_membros || 0,
        };
      });
      setListas(formatted as any);
    }
    setIsLoading(false);
  };

  // Carrega as listas logo que o componente é montado
  useEffect(() => {
    fetchListas();
  }, []);

  // Atualiza as listas silenciosamente quando o menu é aberto
  useEffect(() => {
    if (isOpen) {
      fetchListas();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors text-sm shadow-sm ${isActive || isOpen ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
        title="Listas de Disparo"
      >
        <span className="hidden sm:inline">Listas de Disparo</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-3 border-b border-border bg-muted/20">
            <h3 className="font-semibold text-sm">Suas Listas</h3>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                Carregando...
              </div>
            ) : listas.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma lista criada.</div>
            ) : (
              listas.map(lista => (
                <button
                  key={lista.id}
                  onClick={() => {
                    onSelectLista(lista.id);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b border-border/50 last:border-0 flex justify-between items-center transition-colors"
                >
                  <span className="font-medium text-sm truncate pr-2">{lista.nome}</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full whitespace-nowrap">
                    {lista.total_membros || 0} leads
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
