import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { extractItemName } from '../lib/utils';

export interface ClientSummary {
  nome: string;
  telefone: string;
  pedidos: number;
  faturamento: number;
  totalItens: number;
  ultima: Date;
  topItems: [string, number][];
}

// [DT-G3, corrigido] topItems vinha sempre hardcoded como [], deixando a
// coluna "Top Produtos" do Top 50 (Recordes) sempre vazia. Como essa coluna
// só é usada para os top 20 "Recordes" (não os 50 "Recompradores"), buscar
// os itens desses 20 clientes e agregar por nome é barato o suficiente para
// fazer no cliente, sem precisar de uma RPC nova.
function contarItens(rows: any[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    let parsed: any = row.itens_comprados;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { parsed = []; }
    }
    if (!Array.isArray(parsed)) continue;
    for (const item of parsed) {
      const name = extractItemName(item);
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

async function fetchTopItemsForClients(
  clients: { nome: string; telefone: string }[]
): Promise<Map<string, [string, number][]>> {
  const results = new Map<string, [string, number][]>();

  // [SESSAO-32 — Lei §3, nada em cascata] Antes: uma leitura de
  // fn_vendas_cliente POR cliente (20 de uma vez). A porta aceita a lista de
  // telefones: os telefones dos 20 vão numa leitura só e a resposta é separada
  // por telefone aqui (o mesmo recorte de antes, telefone exato). Quem não tem
  // telefone segue pelo nome exato, como antes.
  const telefones = [...new Set(clients.map((c) => c.telefone).filter(Boolean))];
  const semTelefone = clients.filter((c) => !c.telefone);
  const [porTelefone, ...porNome] = await Promise.all([
    telefones.length
      ? supabase.rpc('fn_vendas_cliente', { p_telefones: telefones })
      : Promise.resolve({ data: [] as any[], error: null }),
    ...semTelefone.map((c) => supabase.rpc('fn_vendas_cliente', { p_nome_exato: c.nome })),
  ]);

  const linhas = new Map<string, any[]>();
  if (!porTelefone.error) {
    for (const row of (porTelefone.data ?? []) as any[]) {
      const chave = row.telefone_cliente as string;
      const lista = linhas.get(chave);
      if (lista) lista.push(row);
      else linhas.set(chave, [row]);
    }
  }
  semTelefone.forEach((c, i) => {
    const r = porNome[i];
    linhas.set(c.nome, r.error ? [] : ((r.data ?? []) as any[]));
  });

  for (const c of clients) {
    const key = c.telefone || c.nome;
    results.set(key, contarItens(linhas.get(key) ?? []));
  }
  return results;
}

export function useTopClientsData() {
  const [topRebuyers, setTopRebuyers] = useState<ClientSummary[]>([]);
  const [topRecords, setTopRecords] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // [SESSAO-20] As duas leituras diretas de vw_clientes_consolidados
        // viraram a RPC gateada fn_clientes_consolidados (item 0/A da união):
        // mesmo recorte (vida >= 2), mesma ordem, mesmos limites.
        // Fetch top rebuyers (mais pedidos)
        const rebuyersReq = supabase.rpc('fn_clientes_consolidados', {
          p_min_pedidos: 2,
          p_ordem: 'pedidos',
          p_limit: 50,
        });

        // Fetch top records (maior faturamento)
        const recordsReq = supabase.rpc('fn_clientes_consolidados', {
          p_ordem: 'faturamento',
          p_limit: 20,
        });

        const [rebuyersRes, recordsRes] = await Promise.all([rebuyersReq, recordsReq]);

        if (rebuyersRes.error) throw rebuyersRes.error;
        if (recordsRes.error) throw recordsRes.error;

        const mapToSummary = (row: any): ClientSummary => ({
          nome: row.nome_cliente || '-',
          telefone: row.telefone_cliente || '',
          pedidos: Number(row.total_pedidos),
          faturamento: Number(row.faturamento_total),
          totalItens: Number(row.total_itens),
          ultima: new Date(row.ultima_compra),
          topItems: []
        });

        const recordsSummaries: ClientSummary[] = (recordsRes.data || []).map(mapToSummary);
        setTopRebuyers((rebuyersRes.data || []).map(mapToSummary));
        setTopRecords(recordsSummaries);

        // [DT-G3] Preenche topItems só para os "Recordes" (20 clientes), que é
        // a única lista onde a coluna "Top Produtos" é exibida.
        const itemsByClient = await fetchTopItemsForClients(
          recordsSummaries.map((c) => ({ nome: c.nome, telefone: c.telefone }))
        );
        setTopRecords(
          recordsSummaries.map((c) => ({
            ...c,
            topItems: itemsByClient.get(c.telefone || c.nome) || [],
          }))
        );
      } catch (err) {
        console.error('Error fetching top clients data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { topRebuyers, topRecords, loading };
}
