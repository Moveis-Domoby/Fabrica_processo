import { useState, useRef, useEffect } from 'react';
import type { GroupedCustomer } from '../types';
import { List, ChevronUp, ChevronDown, Check, Send, MessageCircle, XCircle, CheckCircle, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CustomerLifetimeModal } from './CustomerLifetimeModal';
import type { DisparosMap, DisparoEntry } from '../hooks/useDisparosData';
import { normalizePhone, formatCurrency, formatPhone } from '../lib/utils';

import { useCustomersPaginated } from '../hooks/useCustomersPaginated';

interface CustomersTableProps {
  filters: any;
  onViewItems: (customer: GroupedCustomer) => void;
  onCriarLista?: (customers: GroupedCustomer[]) => void;
  onAdicionarALista?: (customers: GroupedCustomer[]) => void;
  disparosMap?: DisparosMap;
}

type SortOrder = 'asc' | 'desc';



const STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  respondido_aguardando_resultado: { label: 'Em negociação', icon: <MessageCircle size={12} />, color: 'text-blue-500' },
  aguardando_resposta: { label: 'Sem resposta', icon: <MessageCircle size={12} />, color: 'text-yellow-500' },
  ganho: { label: 'Comprou', icon: <CheckCircle size={12} />, color: 'text-green-500' },
  perdido: { label: 'Perdido', icon: <XCircle size={12} />, color: 'text-red-400' },
  aguardando_envio: { label: 'Aguardando envio', icon: <Send size={12} />, color: 'text-muted-foreground' },
};

// ─── Disparos Popover ────────────────────────────────────────────────────────
function DisparosPopover({ entries, onClose }: { entries: DisparoEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 right-0 top-full mt-1 w-72 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
      style={{ minWidth: 260 }}
    >
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
        <Send size={14} className="text-primary" />
        <span className="text-xs font-bold text-foreground uppercase tracking-wide">
          Disparos recebidos ({entries.length})
        </span>
      </div>
      <ul className="max-h-72 overflow-y-auto divide-y divide-border/60">
        {entries.map((e, i) => {
          const cfg = STATUS_LABELS[e.status] ?? { label: e.status, icon: <Send size={12} />, color: 'text-muted-foreground' };
          return (
            <li key={i} className="px-4 py-3 flex flex-col gap-1 hover:bg-muted/20 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-foreground leading-tight line-clamp-2 flex-1">
                  {e.lista_nome}
                </span>
                <span className={`flex items-center gap-1 text-[11px] font-medium shrink-0 ${cfg.color}`}>
                  {cfg.icon} {cfg.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {e.data_envio && (
                  <span>Enviado: {format(new Date(e.data_envio), 'dd/MM/yy', { locale: ptBR })}</span>
                )}
                {e.data_resposta && (
                  <span>Respondeu: {format(new Date(e.data_resposta), 'dd/MM/yy', { locale: ptBR })}</span>
                )}
              </div>
              {e.valor_ganho != null && e.valor_ganho > 0 && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <ShoppingBag size={11} className="text-green-500" />
                  <span className="text-xs font-bold text-green-500">{formatCurrency(e.valor_ganho)}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Disparos Badge (cell) ────────────────────────────────────────────────────
function DisparosBadge({ entries }: { entries: DisparoEntry[] }) {
  const [open, setOpen] = useState(false);
  const count = entries.length;

  if (count === 0) {
    return (
      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground">
        0
      </span>
    );
  }

  const hasGanho = entries.some(e => e.status === 'ganho');
  const hasResposta = entries.some(e => e.data_resposta != null);

  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setOpen(v => !v)}
        title="Ver histórico de disparos"
        className={`
          inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold
          cursor-pointer transition-all duration-150 gap-1
          ${hasGanho
            ? 'bg-green-500/15 text-green-500 hover:bg-green-500/30 ring-1 ring-green-500/30'
            : hasResposta
              ? 'bg-blue-500/15 text-blue-500 hover:bg-blue-500/30 ring-1 ring-blue-500/30'
              : 'bg-primary/15 text-primary hover:bg-primary/30 ring-1 ring-primary/30'}
        `}
      >
        <Send size={10} />
        {count}
      </button>
      {open && <DisparosPopover entries={entries} onClose={() => setOpen(false)} />}
    </div>
  );
}

export function CustomersTable({ filters, onViewItems, onCriarLista, onAdicionarALista, disparosMap = {} }: CustomersTableProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [lifetimeCustomer, setLifetimeCustomer] = useState<GroupedCustomer | null>(null);
  
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const { data, totalCount, loading } = useCustomersPaginated(page, pageSize, filters);

  // [DT-F2, corrigido] Antes, mudar os filtros não resetava a página: se o
  // usuário estivesse na página 3 e aplicasse um novo filtro, a tabela
  // buscava a página 3 do NOVO resultado filtrado (que pode nem existir),
  // deixando a tela "presa" sem clientes até o usuário voltar manualmente
  // para a página 1. Agora, qualquer mudança nos filtros volta para a página 1.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // States for List Creation
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // [DT-F4, corrigido] Antes `sortedData` era só uma cópia de `data` — o
  // clique no cabeçalho trocava o ícone (ChevronUp/ChevronDown) mas nunca
  // de fato reordenava nada, porque nada aqui usava `sortOrder`. Agora a
  // ordenação por "Compra no Período" é aplicada de verdade sobre os dados
  // já carregados (a RPC entrega desc por padrão; aqui só invertemos quando
  // sortOrder === 'asc').
  const sortedData = [...data].sort((a, b) => {
    const diff = new Date(a.ultima_compra).getTime() - new Date(b.ultima_compra).getTime();
    return sortOrder === 'asc' ? diff : -diff;
  });


  const getCustomerId = (c: GroupedCustomer) => c.telefone || c.nome || '';

  const getDisparos = (c: GroupedCustomer): DisparoEntry[] => {
    const phone = normalizePhone(c.telefone ?? '');
    return disparosMap[phone] ?? [];
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === sortedData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedData.map(getCustomerId)));
    }
  };

  const handleToggleCustomer = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleConfirmCriarLista = () => {
    if (!onCriarLista) return;
    const selectedCustomers = sortedData.filter(c => selectedIds.has(getCustomerId(c)));
    if (selectedCustomers.length === 0) {
      alert('Selecione pelo menos um cliente para criar a lista.');
      return;
    }
    onCriarLista(selectedCustomers);
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleConfirmAdicionar = () => {
    if (!onAdicionarALista) return;
    const selectedCustomers = sortedData.filter(c => selectedIds.has(getCustomerId(c)));
    if (selectedCustomers.length === 0) {
      alert('Selecione pelo menos um cliente para adicionar à lista.');
      return;
    }
    onAdicionarALista(selectedCustomers);
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSort = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const SortIcon = () => {
    return sortOrder === 'asc'
      ? <ChevronUp size={14} className="text-primary" />
      : <ChevronDown size={14} className="text-primary" />;
  };

  return (
    <>
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/10">
          <div>
            <h2 className="text-lg font-bold text-foreground">Clientes</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Faturamento e itens refletem <em>apenas</em> o período filtrado.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isSelectionMode ? (
              <>
                <button
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedIds(new Set());
                  }}
                  className="bg-muted text-muted-foreground hover:bg-muted/80 flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmCriarLista}
                  disabled={selectedIds.size === 0}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Nova lista ({selectedIds.size})
                </button>
                <button
                  onClick={handleConfirmAdicionar}
                  disabled={selectedIds.size === 0}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/90 border border-border flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Adicionar a uma lista existente ({selectedIds.size})
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsSelectionMode(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors text-sm"
                title="Listas de Disparo"
              >
                Listas
              </button>
            )}
          </div>
        </div>

        {/* ── DESKTOP TABLE (hidden on mobile) ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 text-muted-foreground sticky top-0 z-10 shadow-sm">
              <tr>
                {isSelectionMode && (
                  <th className="px-4 py-4 w-12 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className={`w-5 h-5 flex items-center justify-center rounded border transition-colors mx-auto ${
                        sortedData.length > 0 && selectedIds.size === sortedData.length
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-border bg-background hover:border-primary/50'
                      }`}
                    >
                      {sortedData.length > 0 && selectedIds.size === sortedData.length && <Check size={14} strokeWidth={3} />}
                    </button>
                  </th>
                )}
                <th className="px-6 py-4 font-medium text-left">Nome</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">Telefone</th>

                {/* Coluna Última Compra com sort */}
                <th className="px-6 py-4 font-medium">
                  <div className="flex items-center gap-1 relative">
                    <button
                      onClick={toggleSort}
                      className="flex items-center gap-0.5 hover:text-foreground transition-colors cursor-pointer"
                      title="Ordenar por data"
                    >
                      <span>Compra no Período</span>
                      <SortIcon />
                    </button>
                  </div>
                </th>

                <th className="px-6 py-4 font-medium text-center">
                  <span title="Total de pedidos na história do cliente — clique no número para ver o histórico completo">
                    Total Vida
                  </span>
                </th>
                <th className="px-6 py-4 font-medium text-center" title="Vezes que este cliente foi alvo de um disparo — clique para ver detalhes">
                  Disparos
                </th>
                <th className="px-6 py-4 font-medium text-center">Itens</th>
                <th className="px-6 py-4 font-medium text-right">Faturamento</th>
                <th className="px-6 py-4 font-medium text-center">Ações</th>
              </tr>
            </thead>

            <tbody>
              {/* [DT-U1, corrigido] `loading` vinha do hook mas era ignorado —
                  ao trocar de filtro/página, sortedData ficava vazio por um
                  instante e a tabela mostrava "Nenhum cliente encontrado",
                  como se o filtro não tivesse resultado nenhum, antes da
                  resposta da RPC chegar. */}
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                    Carregando clientes...
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                    Nenhum cliente encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                sortedData.map((c, idx) => {
                  const cId = getCustomerId(c);
                  const disparos = getDisparos(c);
                  return (
                  <tr key={idx} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${selectedIds.has(cId) ? 'bg-primary/5' : ''}`}>
                    {isSelectionMode && (
                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleCustomer(cId)}
                          className={`w-5 h-5 flex items-center justify-center rounded border transition-colors mx-auto ${
                            selectedIds.has(cId)
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-border bg-background hover:border-primary/50'
                          }`}
                        >
                          {selectedIds.has(cId) && <Check size={14} strokeWidth={3} />}
                        </button>
                      </td>
                    )}
                    <td className="px-6 py-4 font-medium text-foreground">{c.nome || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatPhone(c.telefone)}</td>
                    <td className="px-6 py-4 text-sm">
                      {format(new Date(c.ultima_compra), 'dd/MM/yyyy', { locale: ptBR })}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setLifetimeCustomer(c)}
                        title="Clique para ver o histórico completo de vida deste cliente"
                        className={`
                          inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold
                          cursor-pointer transition-all duration-150
                          ${c.pedidos_vida > 1
                            ? 'bg-primary/15 text-primary hover:bg-primary/30 ring-1 ring-primary/30 hover:ring-primary/60'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'}
                        `}
                      >
                        {c.pedidos_vida}
                      </button>
                    </td>

                    {/* Nova coluna: Disparos */}
                    <td className="px-6 py-4 text-center">
                      <DisparosBadge entries={disparos} />
                    </td>

                    <td className="px-6 py-4 text-center">{c.total_itens}</td>
                    <td className="px-6 py-4 text-right font-medium">
                      {formatCurrency(c.faturamento_total)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => onViewItems(c)}
                        className="text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 font-medium bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-md"
                        title="Ver itens do período filtrado"
                      >
                        <List size={16} />
                        <span>Ver Itens</span>
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── MOBILE CARDS (shown only on small screens) ── */}
        <div className="md:hidden">
          {/* Sort bar for mobile */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
            <span className="text-xs text-muted-foreground font-medium">
              {sortedData.length} cliente{sortedData.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={toggleSort}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md hover:bg-muted"
            >
              <SortIcon />
              <span>Ordenar por data</span>
            </button>
          </div>

          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Carregando clientes...
            </p>
          ) : sortedData.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado com os filtros atuais.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {sortedData.map((c, idx) => {
                const cId = getCustomerId(c);
                const disparos = getDisparos(c);
                return (
                <li key={idx} className={`px-4 py-4 transition-colors ${selectedIds.has(cId) ? 'bg-primary/5' : 'hover:bg-muted/20'}`}>
                  {/* Name + date row */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2">
                      {isSelectionMode && (
                        <button
                          type="button"
                          onClick={() => handleToggleCustomer(cId)}
                          className={`w-5 h-5 flex items-center justify-center rounded border transition-colors mt-0.5 shrink-0 ${
                            selectedIds.has(cId)
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-border bg-background hover:border-primary/50'
                          }`}
                        >
                          {selectedIds.has(cId) && <Check size={14} strokeWidth={3} />}
                        </button>
                      )}
                      <span className="font-semibold text-foreground text-sm leading-tight">
                        {c.nome || '-'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {format(new Date(c.ultima_compra), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                  </div>

                  {/* Phone */}
                  <p className="text-xs text-muted-foreground mb-3 whitespace-nowrap">
                    {formatPhone(c.telefone)}
                  </p>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 flex-wrap mb-3">
                    <div className="flex flex-col items-center bg-muted/50 rounded-lg px-3 py-1.5 min-w-[52px]">
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">Vida</span>
                      <button
                        onClick={() => setLifetimeCustomer(c)}
                        className={`text-sm font-bold mt-0.5 ${c.pedidos_vida > 1 ? 'text-primary' : 'text-foreground'}`}
                        title="Ver histórico de vida"
                      >
                        {c.pedidos_vida}
                      </button>
                    </div>
                    <div className="flex flex-col items-center bg-muted/50 rounded-lg px-3 py-1.5 min-w-[52px]">
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">Disparos</span>
                      <div className="mt-0.5">
                        <DisparosBadge entries={disparos} />
                      </div>
                    </div>
                    <div className="flex flex-col items-center bg-muted/50 rounded-lg px-3 py-1.5 min-w-[52px]">
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">Itens</span>
                      <span className="text-sm font-bold mt-0.5">{c.total_itens}</span>
                    </div>
                    <div className="flex flex-col items-center bg-muted/50 rounded-lg px-3 py-1.5 min-w-[80px]">
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">Faturamento</span>
                      <span className="text-sm font-bold mt-0.5 text-emerald-500 whitespace-nowrap">
                        {formatCurrency(c.faturamento_total)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => onViewItems(c)}
                    className="w-full text-primary hover:text-primary/80 transition-colors inline-flex items-center justify-center gap-1.5 font-medium bg-primary/5 hover:bg-primary/10 px-3 py-2 rounded-md text-sm"
                    title="Ver itens do período filtrado"
                  >
                    <List size={15} />
                    Ver Itens do Período
                  </button>
                </li>
              );
            })}
            </ul>
          )}
        </div>
        
        {/* Pagination Controls */}
        {!loading && totalCount > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-muted/20">
            <div className="text-sm text-muted-foreground">
              Mostrando <span className="font-medium">{(page - 1) * pageSize + 1}</span> a <span className="font-medium">{Math.min(page * pageSize, totalCount)}</span> de <span className="font-medium">{totalCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-border rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * pageSize >= totalCount}
                className="px-3 py-1 border border-border rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Histórico de Vida */}
      <CustomerLifetimeModal
        isOpen={!!lifetimeCustomer}
        onClose={() => setLifetimeCustomer(null)}
        customerName={lifetimeCustomer?.nome || ''}
        customerPhone={lifetimeCustomer?.telefone || ''}
      />
    </>
  );
}
