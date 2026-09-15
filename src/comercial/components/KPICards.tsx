import { Users, ShoppingCart, DollarSign, Repeat, UserPlus } from 'lucide-react';
import { useScorecardsData } from '../hooks/useScorecardsData';

interface KPICardsProps {
  filters: any;
}

export function KPICards({ filters }: KPICardsProps) {
  // [DT-F1 + DT-F3, corrigido] Antes, este componente recalculava start/end
  // em JS (fuso local do navegador) e só mandava essas duas datas para a
  // RPC — os outros filtros (busca, itens, recompra, gasto...) eram
  // ignorados pelos KPIs, e o fuso local podia deslocar a janela em
  // algumas horas em relação ao que a tabela de clientes calculava em SQL.
  // Agora passamos os filtros crus direto para a RPC, que resolve a data
  // em SQL — exatamente como fn_filter_customers já faz para a tabela.
  const { data: scorecards } = useScorecardsData(filters);
  
  const totalClientes = scorecards.total_clients;
  const totalPedidos = scorecards.total_orders;
  const faturamentoTotal = scorecards.total_revenue;
  
  const recorrentes = scorecards.recurrents;
  const novos = totalClientes - recorrentes;
  const taxaRecompra = scorecards.recurrence_rate.toFixed(1);

  const cardBase = "bg-card text-card-foreground p-4 sm:p-6 rounded-xl shadow-sm border border-border border-t-[3px] border-t-primary flex items-center justify-between";
  const iconBase = "h-10 w-10 sm:h-12 sm:w-12 rounded-full flex shrink-0 items-center justify-center ml-2";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6 mb-6 sm:mb-8">
      <div className={cardBase}>
        <div>
          <p className="text-xs font-medium text-muted-foreground whitespace-nowrap">Total Clientes</p>
          <h3 className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{totalClientes}</h3>
        </div>
        <div className={`${iconBase} bg-primary/10 text-primary`}>
          <Users size={20} />
        </div>
      </div>

      <div className={cardBase}>
        <div>
          <p className="text-xs font-medium text-muted-foreground whitespace-nowrap">Total Pedidos</p>
          <h3 className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{totalPedidos}</h3>
        </div>
        <div className={`${iconBase} bg-orange-500/10 text-orange-600`}>
          <ShoppingCart size={20} />
        </div>
      </div>

      <div className={cardBase}>
        <div>
          <p className="text-xs font-medium text-muted-foreground whitespace-nowrap">Faturamento</p>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mt-1 sm:mt-2 break-all">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamentoTotal)}
          </h3>
        </div>
        <div className={`${iconBase} bg-green-500/10 text-green-600`}>
          <DollarSign size={20} />
        </div>
      </div>

      <div className={cardBase}>
        <div>
          <p className="text-xs font-medium text-muted-foreground whitespace-nowrap">Novos / Rec.</p>
          <div className="flex items-baseline gap-1 mt-1 sm:mt-2">
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">{novos}</h3>
            <span className="text-base sm:text-lg font-medium text-muted-foreground">/ {recorrentes}</span>
          </div>
        </div>
        <div className={`${iconBase} bg-purple-500/10 text-purple-600`}>
          <UserPlus size={20} />
        </div>
      </div>

      <div className={`${cardBase} col-span-2 lg:col-span-1`}>
        <div>
          <p className="text-xs font-medium text-muted-foreground whitespace-nowrap">Taxa de Recompra</p>
          <h3 className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{taxaRecompra}%</h3>
        </div>
        <div className={`${iconBase} bg-blue-500/10 text-blue-600`}>
          <Repeat size={20} />
        </div>
      </div>
    </div>
  );
}
