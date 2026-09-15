import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface MultiSelectDropdownProps {
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export function MultiSelectDropdown({
  options,
  selectedOptions,
  onChange,
  placeholder = 'Selecionar itens...'
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOption = (option: string) => {
    if (selectedOptions.includes(option)) {
      onChange(selectedOptions.filter(item => item !== option));
    } else {
      onChange([...selectedOptions, option]);
    }
  };

  const clearSelection = () => {
    onChange([]);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className="truncate mr-2 text-foreground">
          {selectedOptions.length === 0
            ? placeholder
            : `${selectedOptions.length} item(ns) selecionado(s)`}
        </span>
        <ChevronDown size={16} className="text-muted-foreground shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-[200] w-full mt-1 bg-card border border-border rounded-md shadow-lg">
          <div className="p-2 border-b border-border flex items-center gap-2">
            <Search size={16} className="text-muted-foreground" />
            <input
              type="text"
              placeholder="Pesquisar..."
              className="bg-transparent border-none outline-none text-sm w-full text-foreground"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="px-2 py-1 border-b border-border bg-muted/10">
            {selectedOptions.length > 0 ? (
              <button
                type="button"
                onClick={clearSelection}
                className="w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors text-center py-1"
              >
                Remover Seleção
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onChange(options)}
                className="w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors text-center py-1"
              >
                Selecionar Todos
              </button>
            )}
          </div>
          
          <div className="max-h-64 overflow-y-auto p-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground text-center">
                Nenhum item encontrado.
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedOptions.includes(option);
                return (
                  <div
                    key={option}
                    onClick={() => toggleOption(option)}
                    className="flex items-center px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-muted transition-colors"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center mr-2 shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-background'}`}>
                      {isSelected && <Check size={12} />}
                    </div>
                    <span className="text-foreground truncate">{option}</span>
                  </div>
                );
              })
            )}
          </div>
          

        </div>
      )}
    </div>
  );
}
