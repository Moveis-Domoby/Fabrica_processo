import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { QuadroKanban } from './QuadroKanban'
import type { ColunaPaginada } from './QuadroKanban'
import type { Card, Etapa, Setor } from '../tipos'

/**
 * Ajuste do dono (14/10 noite), com o vídeo da troca de setor:
 *  - o aviso "setor sem etapa de fila" piscava enquanto o quadro carregava;
 *  - o "Concluir" aparecia em todo card (é só do card avulso — D-125);
 *  - as colunas vazias diziam "Vazio" / "Solte aqui…" no meio.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/perfil/api', () => ({ urlDaFoto: () => null }))

const setor = {
  id: 6,
  codigo: 'montagem',
  nome: 'MONTAGEM',
  papel_no_fluxo: 'producao',
  ordem: 60,
  ativo: true,
} as unknown as Setor

function etapa(parcial: Partial<Etapa> & Pick<Etapa, 'id' | 'nome' | 'ordem'>): Etapa {
  return {
    setor_id: 6,
    eh_fila: false,
    eh_danificado: false,
    ativa: true,
    setor_destino_id: null,
    conclui_producao: false,
    pede_motivo: false,
    ...parcial,
  }
}

function card(parcial: Partial<Card> & Pick<Card, 'id' | 'tipo'>): Card {
  return {
    pedido_id: null,
    produto_tiny_id: null,
    card_pai_id: null,
    item_seq: null,
    item_codigo: null,
    item_descricao: 'Armário multiuso',
    indice_unidade: null,
    total_unidades: null,
    setor_atual_id: 6,
    etapa_atual_id: 29,
    desde: new Date().toISOString(),
    executor_atual_id: null,
    responsavel_id: null,
    delegado_em: null,
    qualidade_atual: null,
    concluido_em: null,
    pausado_em: null,
    liberado_completo_em: null,
    ...parcial,
  }
}

const ETAPAS = [
  etapa({ id: 29, nome: 'A MONTAR', ordem: 10, eh_fila: true }),
  etapa({ id: 28, nome: 'MONTANDO', ordem: 20 }),
  etapa({ id: 26, nome: 'LIMPEZA E EMBALAGEM', ordem: 40, setor_destino_id: 7 }),
]

function desenhar(props: Partial<Parameters<typeof QuadroKanban>[0]>) {
  const colunas =
    props.colunas ??
    new Map<string, ColunaPaginada>([
      ['29', { cards: [], total: 0 }],
      ['28', { cards: [], total: 0 }],
      ['26', { cards: [], total: 0 }],
    ])
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <QuadroKanban
        setor={setor}
        etapas={props.etapas ?? ETAPAS}
        colunas={colunas}
        pedidosPorId={new Map()}
        agora={Date.now()}
        aoSoltarNaEtapa={() => {}}
        aoAbrirConcluir={props.aoAbrirConcluir}
        setores={[{ ...setor, id: 7, nome: 'LIMPEZA E EMBALAGEM' } as Setor]}
        camposPorCard={new Map()}
        carregando={props.carregando}
        execucao={{
          execucoesPorCard: new Map(),
          nomesUsuarios: new Map(),
          meuUsuarioId: 'u1',
          gestoPendente: false,
        }}
      />
    </QueryClientProvider>,
  )
}

describe('QuadroKanban — ajustes do dono (14/10 noite)', () => {
  it('carregando: mostra o desenho das colunas e nenhum aviso (nada pisca)', () => {
    desenhar({ etapas: [], carregando: true, colunas: new Map() })
    expect(screen.getByLabelText('Abrindo o quadro')).toBeInTheDocument()
    expect(screen.queryByText(/etapa de fila cadastrada/)).not.toBeInTheDocument()
  })

  it('carregado sem fila: aí sim o aviso aparece', () => {
    desenhar({ etapas: [etapa({ id: 28, nome: 'MONTANDO', ordem: 20 })], carregando: false })
    expect(screen.getByText(/etapa de fila cadastrada/)).toBeInTheDocument()
  })

  it('o "Concluir" é só do card avulso', () => {
    const colunas = new Map<string, ColunaPaginada>([
      [
        '29',
        {
          cards: [
            card({ id: 1, tipo: 'unidade', pedido_id: 9, indice_unidade: 1, total_unidades: 1 }),
            card({ id: 2, tipo: 'avulso', titulo: 'Montar o gabarito', item_descricao: null }),
          ],
          total: 2,
        },
      ],
      ['28', { cards: [], total: 0 }],
      ['26', { cards: [], total: 0 }],
    ])
    desenhar({ colunas, aoAbrirConcluir: () => {} })
    expect(screen.getAllByRole('button', { name: /Concluir/ })).toHaveLength(1)
  })

  it('coluna vazia é só o cabeçalho — sem "Vazio" nem "Solte aqui" no meio', () => {
    desenhar({})
    expect(screen.queryByText('Vazio')).not.toBeInTheDocument()
    expect(screen.queryByText(/Solte aqui/)).not.toBeInTheDocument()
    // o que fica é o texto do topo
    expect(screen.getByText(/leva para LIMPEZA E EMBALAGEM/)).toBeInTheDocument()
    expect(screen.getByText(/soltar aqui começa o tempo/)).toBeInTheDocument()
  })
})

/**
 * SESSAO-42 ("Montar juntos"): só no setor que monta em lote (a régua diz), a
 * FILA ganha o botão; tocar nos cards marca; com 2+ marcados, confirma.
 */
describe('QuadroKanban — Montar juntos (SESSAO-42)', () => {
  function desenharComRegua(lotes: Record<string, boolean>, aoMontarJuntos = vi.fn()) {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    cliente.setQueryData(['regua-tempo'], {
      fuso_min: -180,
      pcp_setor_id: null,
      papeis: { '6': 'producao' },
      janelas: [],
      pausas: [],
      lotes,
    })
    const colunas = new Map<string, ColunaPaginada>([
      [
        '29',
        {
          cards: [
            card({ id: 1, tipo: 'unidade', item_descricao: 'Closet A' }),
            card({ id: 2, tipo: 'unidade', item_descricao: 'Closet B' }),
            card({ id: 3, tipo: 'unidade', item_descricao: 'Closet C' }),
          ],
          total: 3,
        },
      ],
      ['28', { cards: [], total: 0 }],
      ['26', { cards: [], total: 0 }],
    ])
    render(
      <QueryClientProvider client={cliente}>
        <QuadroKanban
          setor={setor}
          etapas={ETAPAS}
          colunas={colunas}
          pedidosPorId={new Map()}
          agora={Date.now()}
          aoSoltarNaEtapa={() => {}}
          camposPorCard={new Map()}
          aoMontarJuntos={aoMontarJuntos}
          execucao={{
            execucoesPorCard: new Map(),
            nomesUsuarios: new Map(),
            meuUsuarioId: 'u1',
            gestoPendente: false,
          }}
        />
      </QueryClientProvider>,
    )
    return aoMontarJuntos
  }

  it('setor que não monta em lote: sem o botão', () => {
    desenharComRegua({ '6': false })
    expect(screen.queryByRole('button', { name: /Montar juntos/ })).not.toBeInTheDocument()
  })

  it('marca 2 cards da fila e manda os dois', () => {
    const aoMontarJuntos = desenharComRegua({ '6': true })
    fireEvent.click(screen.getByRole('button', { name: /Montar juntos/ }))
    const caixas = screen.getAllByRole('checkbox')
    expect(caixas).toHaveLength(3)
    // com 1 marcado ainda não dá para confirmar
    fireEvent.click(caixas[0])
    expect(screen.queryByRole('button', { name: /Montar juntos \(/ })).not.toBeInTheDocument()
    fireEvent.click(caixas[2])
    expect(caixas[2]).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Montar juntos (2)' }))
    expect(aoMontarJuntos).toHaveBeenCalledTimes(1)
    expect(aoMontarJuntos.mock.calls[0][0].map((c: Card) => c.id)).toEqual([1, 3])
    // confirmou: o modo de seleção acaba
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('Cancelar sai do modo sem mandar nada', () => {
    const aoMontarJuntos = desenharComRegua({ '6': true })
    fireEvent.click(screen.getByRole('button', { name: /Montar juntos/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(aoMontarJuntos).not.toHaveBeenCalled()
  })
})
