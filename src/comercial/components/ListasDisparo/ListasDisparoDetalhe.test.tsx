// SESSAO-54 (DT-D24): as confirmações da lista de disparo viraram a janela da
// casa e os avisos viraram a notificação da casa — sem mudar o que cada
// escolha faz. Estes testes travam isso: nenhuma pergunta/alerta nativo é
// chamado, "Voltar" não faz nada e confirmar faz exatamente o gesto de antes.
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProvedorNotificacao } from '@/componentes/ui';

const banco = vi.hoisted(() => ({
  status: 'disparando' as string,
  apagou: [] as string[],
  erroAoApagar: null as null | { message: string },
}));

vi.mock('@/lib/supabase', () => {
  const LISTA = () => ({ id: 'lista-1', nome: 'Lista de teste', status: banco.status, mensagem_utilizada: 'Olá!' });
  const MEMBROS = [
    { id: 'm1', lista_id: 'lista-1', nome_cliente: 'Ana', telefone: '84999990001', status: 'aguardando_envio', snapshot_total_gasto: 10 },
    { id: 'm2', lista_id: 'lista-1', nome_cliente: 'Bia', telefone: '84999990002', status: 'aguardando_envio', snapshot_total_gasto: 20 },
  ];
  const consulta = (tabela: string) => {
    let apagar = false;
    const resposta = () => {
      if (apagar) {
        if (!banco.erroAoApagar) banco.apagou.push(tabela);
        return { data: null, error: banco.erroAoApagar };
      }
      if (tabela === 'listas_disparo') return { data: LISTA(), error: null };
      if (tabela === 'vw_scorecards_lista') return { data: null, error: null };
      if (tabela === 'listas_disparo_membros') return { data: MEMBROS, error: null };
      return { data: [], error: null };
    };
    const q: any = {
      select: () => q,
      eq: () => q,
      order: () => q,
      single: () => q,
      update: () => q,
      insert: () => q,
      delete: () => {
        apagar = true;
        return q;
      },
      then: (ok: (r: unknown) => unknown, falha?: (e: unknown) => unknown) => Promise.resolve(resposta()).then(ok, falha),
    };
    return q;
  };
  return { supabase: { from: consulta, functions: { invoke: vi.fn(async () => ({ error: null })) } } };
});

vi.mock('../../lib/disparo/api', () => ({
  salvarMensagem: vi.fn(async () => {}),
  removerMembrosDaListaBulk: vi.fn(async () => {}),
  iniciarFila: vi.fn(async () => {}),
  finalizarDisparo: vi.fn(async () => {}),
  encerrarLista: vi.fn(async () => {}),
}));

vi.mock('@/chat/canais', () => ({ ouvirCanal: () => () => {} }));

// o cabeçalho da casa precisa do menu e das rotas — aqui só o conteúdo dele
vi.mock('@/componentes/CabecalhoDaTela', () => ({
  CabecalhoDaTela: ({ titulo, selo, children }: { titulo: ReactNode; selo?: ReactNode; children?: ReactNode }) => (
    <header>
      <h1>{titulo}</h1>
      {selo}
      {children}
    </header>
  ),
}));

import * as api from '../../lib/disparo/api';
import { ListasDisparoDetalhe } from './ListasDisparoDetalhe';

const aoVoltar = vi.fn();
const abrir = async (status: string) => {
  banco.status = status;
  render(
    <ProvedorNotificacao>
      <ListasDisparoDetalhe listaId="lista-1" onBack={aoVoltar} />
    </ProvedorNotificacao>,
  );
  await screen.findByText('Membros da Lista');
  return userEvent.setup();
};

describe('ListasDisparoDetalhe — janelas e avisos da plataforma no lugar dos alertas do navegador', () => {
  let perguntaNativa: ReturnType<typeof vi.spyOn>;
  let alertaNativo: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    banco.apagou = [];
    banco.erroAoApagar = null;
    vi.clearAllMocks();
    perguntaNativa = vi.spyOn(window, 'confirm').mockReturnValue(true);
    alertaNativo = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    // em nenhum caminho o navegador é chamado
    expect(perguntaNativa).not.toHaveBeenCalled();
    expect(alertaNativo).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('Excluir: abre a janela com o aviso de sempre; "Voltar" não apaga nada', async () => {
    const usuario = await abrir('rascunho');
    await usuario.click(screen.getByRole('button', { name: /Excluir/ }));
    const janela = await screen.findByRole('dialog');
    expect(within(janela).getByRole('heading', { name: 'Excluir esta lista?' })).toBeInTheDocument();
    expect(within(janela).getByText(/Todos os membros e histórico vinculados a ela serão perdidos/)).toBeInTheDocument();
    await usuario.click(within(janela).getByRole('button', { name: 'Voltar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(banco.apagou).toEqual([]);
    expect(aoVoltar).not.toHaveBeenCalled();
  });

  it('Excluir: confirmar apaga a lista e volta para as listas (o efeito de antes)', async () => {
    const usuario = await abrir('rascunho');
    await usuario.click(screen.getByRole('button', { name: /Excluir/ }));
    const janela = await screen.findByRole('dialog');
    await usuario.click(within(janela).getByRole('button', { name: 'Excluir a lista' }));
    await waitFor(() => expect(aoVoltar).toHaveBeenCalledOnce());
    expect(banco.apagou).toEqual(['listas_disparo']);
  });

  it('Excluir com erro do banco: fica na tela e avisa pelo aviso da casa', async () => {
    banco.erroAoApagar = { message: 'sem permissão' };
    const usuario = await abrir('rascunho');
    await usuario.click(screen.getByRole('button', { name: /Excluir/ }));
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir a lista' }));
    expect(await screen.findByText('Erro ao excluir lista')).toBeInTheDocument();
    expect(screen.getByText('sem permissão')).toBeInTheDocument();
    expect(aoVoltar).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Finalizar disparo: só para depois de confirmar na janela', async () => {
    const usuario = await abrir('disparando');
    await usuario.click(screen.getByRole('button', { name: /Finalizar disparo/ }));
    const janela = await screen.findByRole('dialog');
    expect(within(janela).getByRole('heading', { name: 'Parar o disparo agora?' })).toBeInTheDocument();
    expect(api.finalizarDisparo).not.toHaveBeenCalled();
    await usuario.click(within(janela).getByRole('button', { name: 'Parar o disparo' }));
    await waitFor(() => expect(api.finalizarDisparo).toHaveBeenCalledWith('lista-1'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Parar contagem e encerrar: "Voltar" não encerra; confirmar encerra', async () => {
    const usuario = await abrir('em_andamento');
    await usuario.click(screen.getByRole('button', { name: /Parar contagem e encerrar lista/ }));
    let janela = await screen.findByRole('dialog');
    expect(within(janela).getByRole('heading', { name: 'Encerrar a lista completamente?' })).toBeInTheDocument();
    await usuario.click(within(janela).getByRole('button', { name: 'Voltar' }));
    expect(api.encerrarLista).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole('button', { name: /Parar contagem e encerrar lista/ }));
    janela = await screen.findByRole('dialog');
    await usuario.click(within(janela).getByRole('button', { name: 'Encerrar a lista' }));
    await waitFor(() => expect(api.encerrarLista).toHaveBeenCalledWith('lista-1'));
  });

  it('Remover membros: a janela diz quantos; confirmar remove só os marcados', async () => {
    const usuario = await abrir('rascunho');
    await usuario.click(screen.getByRole('button', { name: 'Remover' }));
    const linhaDaAna = screen.getByText('Ana').closest('tr') as HTMLElement;
    await usuario.click(within(linhaDaAna).getAllByRole('button')[0]);
    await usuario.click(screen.getByRole('button', { name: /Remover da lista \(1\)/ }));
    const janela = await screen.findByRole('dialog');
    expect(within(janela).getByRole('heading', { name: 'Remover 1 membro da lista?' })).toBeInTheDocument();
    expect(api.removerMembrosDaListaBulk).not.toHaveBeenCalled();
    await usuario.click(within(janela).getByRole('button', { name: 'Remover da lista' }));
    await waitFor(() => expect(api.removerMembrosDaListaBulk).toHaveBeenCalledWith(['m1'], 'lista-1'));
  });

  it('Salvar a mensagem: o "salva com sucesso" aparece como aviso da casa', async () => {
    const usuario = await abrir('rascunho');
    await usuario.click(screen.getByRole('button', { name: /Salvar/ }));
    expect(await screen.findByText('Mensagem salva com sucesso!')).toBeInTheDocument();
    expect(api.salvarMensagem).toHaveBeenCalledWith('lista-1', 'Olá!');
  });
});
