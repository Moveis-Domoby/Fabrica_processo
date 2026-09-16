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

  // min-h iguala a altura dos cards (nada de "fora de esquadro"); o ícone é
  // decorativo e só aparece em telas largas (2xl) — com a sidebar ocupando
  // largura, mostrá-lo em 5 colunas espremia o número (virava "409"). O texto
  // fica com min-w-0 e o card com overflow-hidden como cinto de segurança.
  const cardBase = "bg-card text-card-foreground p-4 sm:p-5 rounded-xl shadow-sm border border-border border-t-[3px] border-t-primary flex items-center justify-between gap-2 min-h-[6rem] overflow-hidden";
  const iconBase = "h-11 w-11 rounded-full hidden 2xl:flex shrink-0 items-center justify-center";
  const textoBase = "min-w-0 flex-1";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8 items-stretch">
      <div className={cardBase}>
        <div className={textoBase}>
          <p className="text-xs font-medium text-muted-foreground truncate">Total Clientes</p>
          <h3 className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 tabular-nums">{totalClientes}</h3>
        </div>
        <div className={`${iconBase} bg-primary/10 text-primary`}>
          <Users size={20} />
        </div>
      </div>

      <div className={cardBase}>
        <div className={textoBase}>
          <p className="text-xs font-medium text-muted-foreground truncate">Total Pedidos</p>
          <h3 className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 tabular-nums">{totalPedidos}</h3>
        </div>
        <div className={`${iconBase} bg-orange-500/10 text-orange-600`}>
          <ShoppingCart size={20} />
        </div>
      </div>

      <div className={cardBase}>
        <div className={textoBase}>
          <p className="text-xs font-medium text-muted-foreground truncate">Faturamento</p>
          <h3 className="text-sm sm:text-base lg:text-lg font-bold mt-1 sm:mt-2 tabular-nums whitespace-nowrap">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamentoTotal)}
          </h3>
        </div>
        <div className={`${iconBase} bg-green-500/10 text-green-600`}>
          <DollarSign size={20} />
        </div>
      </div>

      <div className={cardBase}>
        <div className={textoBase}>
          <p className="text-xs font-medium text-muted-foreground truncate">Novos / Rec.</p>
          <div className="flex items-baseline gap-1 mt-1 sm:mt-2 whitespace-nowrap">
            <h3 className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{novos}</h3>
            <span className="text-sm sm:text-base font-medium text-muted-foreground tabular-nums">/ {recorrentes}</span>
          </div>
        </div>
        <div className={`${iconBase} bg-purple-500/10 text-purple-600`}>
          <UserPlus size={20} />
        </div>
      </div>

      <div className={`${cardBase} col-span-2 lg:col-span-1`}>
        <div className={textoBase}>
          <p className="text-xs font-medium text-muted-foreground truncate">Taxa de Recompra</p>
          <h3 className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 tabular-nums">{taxaRecompra}%</h3>
        </div>
        <div className={`${iconBase} bg-blue-500/10 text-blue-600`}>
          <Repeat size={20} />
        </div>
      </div>
    </div>
  );
}
