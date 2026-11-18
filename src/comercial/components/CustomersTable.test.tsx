// SESSAO-54 (DT-G16 + DT-D24): a ordem da tabela de clientes vai para o banco
// (dentro dos filtros, na mesma porta) e a tela volta à página 1 — antes o
// clique invertia só os 50 clientes que já estavam na tela.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProvedorNotificacao } from '@/componentes/ui';

const chamadas = vi.hoisted(() => [] as Array<{ porta: string; args: any }>);

vi.mock('@/lib/supabase', () => {
  const linha = (i: number, dia: string) => ({
    nome_cliente: `Cliente ${i}`,
    telefone_cliente: `8499999${String(i).padStart(4, '0')}`,
    quantidade_pedidos: 1,
    faturamento_total: 100,
    total_itens: 1,
    data_primeira_compra: dia,
    ultima_compra: dia,
    pedidos_vida: 1,
    is_recorrente: false,
    total_count: 120,
  });
  return {
    supabase: {
      rpc: (porta: string, args: any) => {
        chamadas.push({ porta, args });
        const asc = args?.p_filters?.sortOrder === 'asc';
        const dados = asc
          ? [linha(1, '2030-01-01T03:00:00Z'), linha(2, '2030-02-01T03:00:00Z')]
          : [linha(120, '2031-12-01T03:00:00Z'), linha(119, '2031-11-01T03:00:00Z')];
        return { abortSignal: async () => ({ data: dados, error: null }) };
      },
    },
  };
});

import { CustomersTable } from './CustomersTable';

const FILTROS = { searchQuery: '', dateFilter: 'all' };
const abrir = () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cache}>
      <ProvedorNotificacao>
        <CustomersTable filters={FILTROS} onViewItems={() => {}} />
      </ProvedorNotificacao>
    </QueryClientProvider>,
  );
  return userEvent.setup();
};
const daTabela = () => chamadas.filter((c) => c.porta === 'fn_filter_customers');

describe('CustomersTable — a ordem vai para o banco', () => {
  beforeEach(() => {
    chamadas.length = 0;
  });

  it('abre pedindo a ordem de sempre (a compra mais recente primeiro)', async () => {
    abrir();
    await screen.findAllByText('Cliente 120');
    expect(daTabela()).toHaveLength(1);
    expect(daTabela()[0].args.p_filters.sortOrder).toBe('desc');
    expect(daTabela()[0].args.p_offset).toBe(0);
  });

  it('"ordenar por data" pede ao banco o resultado inteiro do mais antigo para o mais recente, na mesma porta', async () => {
    const usuario = abrir();
    await screen.findAllByText('Cliente 120');
    await usuario.click(screen.getByTitle('Ordenar por data'));
    await waitFor(() => expect(daTabela()).toHaveLength(2));
    const pedido = daTabela()[1].args;
    expect(pedido.p_filters.sortOrder).toBe('asc');
    expect(pedido.p_offset).toBe(0);
    // os argumentos da porta são os de sempre — nenhum parâmetro novo
    expect(Object.keys(pedido).sort()).toEqual(['p_filters', 'p_limit', 'p_offset']);
    // a tela mostra o que o banco devolveu, na ordem em que devolveu
    const nomes = (await screen.findAllByText(/^Cliente \d+$/)).map((n) => n.textContent);
    expect(nomes.slice(0, 2)).toEqual(['Cliente 1', 'Cliente 2']);
  });

  it('mudar a ordem na página 2 volta para o começo do resultado', async () => {
    const usuario = abrir();
    await screen.findAllByText('Cliente 120');
    await usuario.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(daTabela().at(-1)?.args.p_offset).toBe(50));
    await usuario.click(screen.getByTitle('Ordenar por data'));
    await waitFor(() => expect(daTabela().at(-1)?.args.p_filters.sortOrder).toBe('asc'));
    expect(daTabela().at(-1)?.args.p_offset).toBe(0);
  });
});
