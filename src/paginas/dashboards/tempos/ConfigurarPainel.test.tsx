import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorNotificacao } from '@/componentes/ui'
import { supabase } from '@/lib/supabase'
import { ConfigurarPainel } from './ConfigurarPainel'
import { BIA, EXEMPLO_CONFIGURACAO } from './exemplos'

/**
 * SESSAO-47 (Bloco C) — a janela "Configurar painel": lida no clique, numa
 * requisição; é o único lugar em que a equipe aparece com letra, NOME e FOTO; e
 * o salvar manda só o que mudou.
 */
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    storage: {
      from: () => ({
        getPublicUrl: (caminho: string) => ({
          data: { publicUrl: `https://fotos.teste/${caminho}` },
        }),
      }),
    },
  },
}))

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>
const chamadas = (nome: string) => rpc.mock.calls.filter((c) => c[0] === nome)

function abrir(aoFechar = vi.fn()) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidar = vi.spyOn(cliente, 'invalidateQueries')
  render(
    <QueryClientProvider client={cliente}>
      <ProvedorNotificacao>
        <ConfigurarPainel setorAtual={6} aoFechar={aoFechar} />
      </ProvedorNotificacao>
    </QueryClientProvider>,
  )
  return { aoFechar, invalidar }
}

beforeEach(() => {
  rpc.mockReset()
  rpc.mockImplementation(async (nome: string) =>
    nome === 'plt_fn_tempos_painel'
      ? { data: EXEMPLO_CONFIGURACAO, error: null }
      : { data: { painel: EXEMPLO_CONFIGURACAO.painel, mudou: true }, error: null },
  )
})

describe('a janela Configurar painel', () => {
  it('lê tudo numa requisição e mostra cada montador com a letra, o nome e a foto', async () => {
    abrir()
    const bia = await screen.findByRole('switch', {
      name: 'Mostrar Bia Lima (montador B) no painel',
    })
    expect(chamadas('plt_fn_tempos_painel')).toHaveLength(1)
    expect(rpc).toHaveBeenCalledTimes(1)
    const linha = bia.closest('li') as HTMLElement
    expect(within(linha).getByText('B')).toBeInTheDocument()
    expect(within(linha).getByText('Bia Lima')).toBeInTheDocument()
    expect(within(linha).getByText('Montador B · titular')).toBeInTheDocument()
    expect(linha.querySelector('img')).toHaveAttribute('src', 'https://fotos.teste/fotos/bia.jpg')
    expect(bia).toHaveAttribute('aria-checked', 'true')
    // o Caio já está desligado: a janela diz para onde ele foi
    const caio = screen.getByRole('switch', { name: 'Mostrar Caio Reis (montador C) no painel' })
    expect(caio).toHaveAttribute('aria-checked', 'false')
    expect(within(caio.closest('li') as HTMLElement).getByText(/em “Outros”/)).toBeInTheDocument()
  })

  it('mostra a configuração que está valendo — e os sete blocos da TV', async () => {
    abrir()
    const periodo = await screen.findByRole('group', { name: 'Aba Período' })
    expect(within(periodo).getByRole('radio', { name: 'Empilhadas por montador' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(
      within(screen.getByRole('group', { name: 'Número mostrado' })).getByRole('radio', {
        name: 'Mediana',
      }),
    ).toHaveAttribute('aria-checked', 'true')
    for (const bloco of [
      'Os quatro números do topo',
      'A coluna dos montadores',
      'O gráfico dos 14 dias',
      'O melhor da semana',
      'O relógio',
      'Até quando há dados',
      'O selo "ao vivo"',
    ]) {
      expect(screen.getByRole('switch', { name: bloco })).toHaveAttribute('aria-checked', 'true')
    }
    expect(
      screen.getByRole('switch', { name: 'Marcar onde cada móvel terminaria no tempo padrão' }),
    ).toHaveAttribute('aria-checked', 'false')
    // sem mudança, não há o que salvar
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })

  it('o salvar manda SÓ o que mudou — a configuração e os montadores — e fecha', async () => {
    const { aoFechar, invalidar } = abrir()
    const periodo = await screen.findByRole('group', { name: 'Aba Período' })
    fireEvent.click(within(periodo).getByRole('radio', { name: 'Linhas' }))
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Número mostrado' })).getByRole('radio', {
        name: 'Média',
      }),
    )
    fireEvent.click(screen.getByRole('switch', { name: 'O relógio' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar Bia Lima (montador B) no painel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(aoFechar).toHaveBeenCalledTimes(1))
    expect(chamadas('plt_fn_tempos_painel_salvar')).toHaveLength(1)
    expect(chamadas('plt_fn_tempos_painel_salvar')[0][1]).toEqual({
      p_painel: { grafico_periodo: 'linhas', medida: 'media', tv_relogio: false },
      p_montadores: [{ setor_id: 6, usuario_id: BIA, ligado: false }],
    })
    // a tela aberta relê a aba dela (que traz a configuração nova)
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['tempos-producao'] })
    expect(await screen.findByText('Configuração do painel salva')).toBeInTheDocument()
  })

  it('ligar e desligar de volta não é mudança: nada vai para o banco', async () => {
    abrir()
    const bia = await screen.findByRole('switch', {
      name: 'Mostrar Bia Lima (montador B) no painel',
    })
    fireEvent.click(bia)
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled()
    fireEvent.click(bia)
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })

  it('só a configuração mudou: a lista de montadores não vai', async () => {
    abrir()
    fireEvent.click(await screen.findByRole('switch', { name: 'O melhor da semana' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(chamadas('plt_fn_tempos_painel_salvar')).toHaveLength(1))
    expect(chamadas('plt_fn_tempos_painel_salvar')[0][1]).toEqual({
      p_painel: { tv_melhor_semana: false },
      p_montadores: null,
    })
  })

  it('o banco recusou: a janela fica aberta e diz o porquê', async () => {
    const { aoFechar } = abrir()
    fireEvent.click(await screen.findByRole('switch', { name: 'O relógio' }))
    rpc.mockImplementation(async () => ({
      data: null,
      error: { message: 'Só um administrador mexe nas regras de tempo.' },
    }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Só um administrador mexe nas regras de tempo.',
    )
    expect(aoFechar).not.toHaveBeenCalled()
  })

  it('"Voltar ao padrão" devolve os gráficos, o tempo médio, a abertura e a TV ao desenho de antes', async () => {
    rpc.mockImplementation(async () => ({
      data: {
        ...EXEMPLO_CONFIGURACAO,
        painel: { ...EXEMPLO_CONFIGURACAO.painel, grafico_tv: 'barras', tv_relogio: false },
      },
      error: null,
    }))
    abrir()
    const tv = await screen.findByRole('group', { name: 'TV' })
    expect(within(tv).getByRole('radio', { name: 'Barras' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão' }))
    expect(within(tv).getByRole('radio', { name: 'Empilhadas por montador' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('switch', { name: 'O relógio' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled()
  })

  it('a leitura falhou (quem não é admin, banco de antes): a janela mostra o erro', async () => {
    rpc.mockImplementation(async () => ({
      data: null,
      error: { message: 'Só um administrador mexe nas regras de tempo.' },
    }))
    abrir()
    expect(await screen.findByRole('alert')).toHaveTextContent('Só um administrador')
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
  })
})
