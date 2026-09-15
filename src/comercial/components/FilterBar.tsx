import { type ChangeEvent, type Dispatch, type SetStateAction, useRef, useEffect } from 'react';
import type { FilterState, DateFilterType } from '../types';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format, addMonths, subMonths, addDays, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FilterBarProps {
  filters: FilterState;
  setFilters: Dispatch<SetStateAction<FilterState>>;
  availableItems: string[];
  availablePurchaseCounts: string[];
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">{children}</label>;
}

function FilterInput({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center bg-background border border-input rounded-lg px-2.5 py-2 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all ${className}`}>
      {children}
    </div>
  );
}

export function FilterBar({ filters, setFilters, availableItems, availablePurchaseCounts }: FilterBarProps) {
  const monthInputRef = useRef<HTMLInputElement>(null);
  const dayInputRef = useRef<HTMLInputElement>(null);
  const customStartRef = useRef<HTMLInputElement>(null);
  const customEndRef = useRef<HTMLInputElement>(null);

  const handleDateChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, dateFilter: e.target.value as DateFilterType, customDateStart: '', customDateEnd: '' }));
  };

  const handlePurchaseCountSelect = (selected: string[]) => setFilters(prev => ({ ...prev, purchaseCount: selected }));
  const handleItemSelect = (selected: string[]) => setFilters(prev => ({ ...prev, selectedItems: selected }));

  useEffect(() => {
    if (filters.selectedItems.length > 0) {
      const validItems = filters.selectedItems.filter(item => item === 'all' || availableItems.includes(item));
      if (validItems.length !== filters.selectedItems.length) setFilters(prev => ({ ...prev, selectedItems: validItems }));
    }
  }, [availableItems, filters.selectedItems, setFilters]);

  useEffect(() => {
    if (filters.purchaseCount.length > 0) {
      const validCounts = filters.purchaseCount.filter(count => count === 'all' || availablePurchaseCounts.includes(count));
      if (validCounts.length !== filters.purchaseCount.length) setFilters(prev => ({ ...prev, purchaseCount: validCounts }));
    }
  }, [availablePurchaseCounts, filters.purchaseCount, setFilters]);

  // Navegação mês/dia/ano
  const prevMonth = () => { const c = parseISO(`${filters.specificMonth}-01`); setFilters(prev => ({ ...prev, specificMonth: format(subMonths(c, 1), 'yyyy-MM') })); };
  const nextMonth = () => { const c = parseISO(`${filters.specificMonth}-01`); setFilters(prev => ({ ...prev, specificMonth: format(addMonths(c, 1), 'yyyy-MM') })); };
  const monthLabel = () => { try { return format(parseISO(`${filters.specificMonth}-01`), "MMM 'de' yyyy", { locale: ptBR }); } catch { return filters.specificMonth; } };

  const prevDay = () => { const c = parseISO(`${filters.specificDay}T00:00:00`); setFilters(prev => ({ ...prev, specificDay: format(subDays(c, 1), 'yyyy-MM-dd') })); };
  const nextDay = () => { const c = parseISO(`${filters.specificDay}T00:00:00`); setFilters(prev => ({ ...prev, specificDay: format(addDays(c, 1), 'yyyy-MM-dd') })); };
  const dayLabel = () => { try { return format(parseISO(`${filters.specificDay}T00:00:00`), "dd MMM yyyy", { locale: ptBR }); } catch { return filters.specificDay; } };

  const prevYear = () => { const yr = parseInt(filters.specificYear, 10); if (!isNaN(yr)) setFilters(prev => ({ ...prev, specificYear: (yr - 1).toString() })); };
  const nextYear = () => { const yr = parseInt(filters.specificYear, 10); if (!isNaN(yr)) setFilters(prev => ({ ...prev, specificYear: (yr + 1).toString() })); };
  const yearInputRef = useRef<HTMLInputElement>(null);

  const navBtnCls = "p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0";

  // Format YYYY-MM-DD → dd/MM/yyyy para exibição
  const fmtDate = (v: string) => {
    if (!v) return '';
    try { return format(parseISO(`${v}T00:00:00`), 'dd/MM/yyyy'); } catch { return v; }
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm mb-6 sm:mb-8">
      {/* Linha 1 – filtros principais */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-0 divide-x divide-y divide-border/60">

        {/* Pesquisar */}
        <div className="p-3 lg:col-span-1">
          <FilterLabel>Pesquisar</FilterLabel>
          <FilterInput>
            <input
              type="text"
              placeholder="Nome ou telefone…"
              className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground/60"
              value={filters.searchQuery || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            />
          </FilterInput>
        </div>

        {/* Data */}
        <div className="p-3 lg:col-span-1">
          <FilterLabel>Data da Compra</FilterLabel>
          <select
            className="w-full bg-background border border-input rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-foreground"
            value={filters.dateFilter}
            onChange={handleDateChange}
          >
            <option value="all">Todo o período</option>
            <option value="custom">Intervalo</option>
            <option value="specificYear">Do ano</option>
            <option value="specificMonth">Do mês</option>
            <option value="specificDay">Do dia</option>
          </select>

          {/* Navegador */}
          {filters.dateFilter === 'specificYear' && (
            <div className="mt-1.5 flex items-center gap-1 bg-background border border-input rounded-lg px-1 py-1">
              <button onClick={prevYear} className={navBtnCls}><ChevronLeft size={14}/></button>
              <div className="flex-1 relative flex items-center justify-center">
                <span className="text-xs font-medium">{filters.specificYear}</span>
                <input ref={yearInputRef} type="number" min="2000" max="2100" value={filters.specificYear}
                  onChange={e => setFilters(prev => ({ ...prev, specificYear: e.target.value }))}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </div>
              <button onClick={nextYear} className={navBtnCls}><ChevronRight size={14}/></button>
            </div>
          )}
          {filters.dateFilter === 'specificMonth' && (
            <div className="mt-1.5 flex items-center gap-1 bg-background border border-input rounded-lg px-1 py-1">
              <button onClick={prevMonth} className={navBtnCls}><ChevronLeft size={14}/></button>
              <div className="flex-1 relative flex items-center justify-center">
                <span className="text-xs font-medium capitalize">{monthLabel()}</span>
                <input ref={monthInputRef} type="month" value={filters.specificMonth}
                  onChange={e => setFilters(prev => ({ ...prev, specificMonth: e.target.value }))}
                  onClick={e => { try { e.currentTarget.showPicker(); } catch {} }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" tabIndex={-1}
                />
              </div>
              <button onClick={nextMonth} className={navBtnCls}><ChevronRight size={14}/></button>
            </div>
          )}
          {filters.dateFilter === 'specificDay' && (
            <div className="mt-1.5 flex items-center gap-1 bg-background border border-input rounded-lg px-1 py-1">
              <button onClick={prevDay} className={navBtnCls}><ChevronLeft size={14}/></button>
              <div className="flex-1 relative flex items-center justify-center">
                <span className="text-xs font-medium capitalize">{dayLabel()}</span>
                <input ref={dayInputRef} type="date" value={filters.specificDay}
                  onChange={e => setFilters(prev => ({ ...prev, specificDay: e.target.value }))}
                  onClick={e => { try { e.currentTarget.showPicker(); } catch {} }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" tabIndex={-1}
                />
              </div>
              <button onClick={nextDay} className={navBtnCls}><ChevronRight size={14}/></button>
            </div>
          )}
          {filters.dateFilter === 'custom' && (
            <div className="mt-1.5 flex items-center gap-1.5">
              {/* Data Início */}
              <div className="flex-1 relative flex items-center bg-background border border-input rounded-lg px-2 py-1.5 cursor-pointer hover:border-primary transition-colors"
                onClick={() => { try { customStartRef.current?.showPicker(); } catch {} customStartRef.current?.focus(); }}>
                <CalendarDays size={11} className="text-muted-foreground mr-1.5 shrink-0"/>
                <span className="text-[11px] text-foreground truncate">{fmtDate(filters.customDateStart) || <span className="text-muted-foreground/60">Início</span>}</span>
                <input ref={customStartRef} type="date" value={filters.customDateStart}
                  onChange={e => setFilters(prev => ({ ...prev, customDateStart: e.target.value }))}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" tabIndex={-1}
                />
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">→</span>
              {/* Data Fim */}
              <div className="flex-1 relative flex items-center bg-background border border-input rounded-lg px-2 py-1.5 cursor-pointer hover:border-primary transition-colors"
                onClick={() => { try { customEndRef.current?.showPicker(); } catch {} customEndRef.current?.focus(); }}>
                <CalendarDays size={11} className="text-muted-foreground mr-1.5 shrink-0"/>
                <span className="text-[11px] text-foreground truncate">{fmtDate(filters.customDateEnd) || <span className="text-muted-foreground/60">Fim</span>}</span>
                <input ref={customEndRef} type="date" value={filters.customDateEnd}
                  onChange={e => setFilters(prev => ({ ...prev, customDateEnd: e.target.value }))}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" tabIndex={-1}
                />
              </div>
            </div>
          )}
        </div>

        {/* Itens */}
        <div className="p-3 sm:col-span-1 lg:col-span-2">
          <FilterLabel>Itens Comprados</FilterLabel>
          <MultiSelectDropdown
            options={availableItems}
            selectedOptions={filters.selectedItems.filter(item => item !== 'all')}
            onChange={handleItemSelect}
            placeholder="Todos os itens…"
          />
        </div>

        {/* Qtd Compras */}
        <div className="p-3">
          <FilterLabel>Qtd. Compras</FilterLabel>
          <MultiSelectDropdown
            options={availablePurchaseCounts}
            selectedOptions={filters.purchaseCount.filter(c => c !== 'all')}
            onChange={handlePurchaseCountSelect}
            placeholder="Qualquer qtd."
          />
        </div>

        {/* Inativo antes de */}
        <div className="p-3">
          <FilterLabel>Inativo antes de</FilterLabel>
          <FilterInput>
            <input
              type="date"
              className="bg-transparent border-none outline-none text-sm w-full text-foreground cursor-pointer"
              value={filters.inactiveBeforeDate || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, inactiveBeforeDate: e.target.value }))}
            />
            {filters.inactiveBeforeDate && (
              <button onClick={() => setFilters(prev => ({ ...prev, inactiveBeforeDate: '' }))} className="ml-1 text-muted-foreground hover:text-foreground text-base leading-none">×</button>
            )}
          </FilterInput>
        </div>
      </div>

      {/* Linha 2 – Filtros avançados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-x divide-y divide-border/60 border-t border-border/60">

        {/* Tempo de Recompra */}
        <div className="p-3">
          <FilterLabel>Tempo de Recompra (dias entre 1ª→2ª)</FilterLabel>
          <div className="flex items-center gap-2">
            <FilterInput className="flex-1">
              <input
                type="number"
                placeholder="Mín."
                min="0"
                className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground/60"
                value={filters.recompraMinDays || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, recompraMinDays: e.target.value }))}
              />
              <span className="text-[10px] text-muted-foreground shrink-0 ml-0.5">d</span>
            </FilterInput>
            <span className="text-xs text-muted-foreground shrink-0">até</span>
            <FilterInput className="flex-1">
              <input
                type="number"
                placeholder="Máx."
                min="0"
                className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground/60"
                value={filters.recompraMaxDays || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, recompraMaxDays: e.target.value }))}
              />
              <span className="text-[10px] text-muted-foreground shrink-0 ml-0.5">d</span>
            </FilterInput>
          </div>
        </div>

        {/* Filtro de Gasto */}
        <div className="p-3 sm:col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <FilterLabel>Filtro de Gasto (R$)</FilterLabel>
            {/* Toggle Total vs Médio */}
            <div className="flex items-center gap-1.5 text-[10px] mb-1">
              <button
                onClick={() => setFilters(prev => ({ ...prev, spendType: 'total' }))}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${filters.spendType === 'total' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >Total na Loja</button>
              <span className="text-muted-foreground">|</span>
              <button
                onClick={() => setFilters(prev => ({ ...prev, spendType: 'average' }))}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${filters.spendType === 'average' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >Ticket Médio</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FilterInput className="flex-1">
              <span className="text-muted-foreground text-sm mr-1.5 shrink-0">R$</span>
              <input
                type="number"
                placeholder="Ex: 150,00"
                min="0"
                className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground/60"
                value={filters.spendAmount || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, spendAmount: e.target.value }))}
              />
              {filters.spendAmount && (
                <button onClick={() => setFilters(prev => ({ ...prev, spendAmount: '' }))} className="ml-1 text-muted-foreground hover:text-foreground text-base leading-none shrink-0">×</button>
              )}
            </FilterInput>
            {/* Modo: Acima / ±10% / Abaixo */}
            <div className="flex items-center rounded-lg border border-border overflow-hidden shrink-0">
              {([
                { key: 'above',  label: '↑ Acima'  },
                { key: 'around', label: '±10%'     },
                { key: 'below',  label: '↓ Abaixo' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilters(prev => ({ ...prev, spendMode: key }))}
                  className={`px-2.5 py-2 text-[11px] font-semibold transition-colors whitespace-nowrap border-r last:border-r-0 border-border ${
                    filters.spendMode === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
