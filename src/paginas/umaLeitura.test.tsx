import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { chaveMeuTrabalho, reiniciarMeuTrabalhoParaTeste } from '@/afazeres/meuTrabalho'
import { BolhaExecucao } from '@/afazeres/BolhaExecucao'
import { MeuPainel } from './MeuPainel'
import { Afazeres } from './Afazeres'
import { Pessoas } from './dashboards/Pessoas'
import { Qualidade } from './dashboards/Qualidade'
import { MeuDesempenho } from './dashboards/MeuDesempenho'
import { Equipe } from './Equipe'
import { AdminApi } from './AdminApi'
import { Caminhoes } from './Caminhoes'
import { Automacoes } from './Automacoes'
import { DesligarTempo } from './controleTempo/DesligarTempo'

/**
 * SESSAO-55 (Lei §2 — as dívidas 18 e 20): cada tela tocada abre com UMA
 * requisição de dados — a porta de abertura dela — e nenhuma leitura direta de
 * tabela. O teste conta o que a tela pede ao servidor (o "critério da aba
 * Network"): toda chamada passa por `supabase.rpc` ou `supabase.from`, e as
 * duas são gravadas aqui. O que a abertura do app já traz (setores, etiquetas,
 * campos) nasce guardado, como no app.
 */
const servidor = vi.hoisted(() => ({
  rpc: [] as { porta: string; args: Record<string, unknown> | undefined }[],
  tabelas: [] as string[],
  respostas: {} as Record<string, unknown>,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(async (porta: string, args?: Record<string, unknown>) => {
      servidor.rpc.push({ porta, args })
      const resposta = servidor.respostas[porta]
      return {
        data: typeof resposta === 'function' ? (resposta as (a: unknown) => unknown)(args) : (resposta ?? null),
        error: null,
      }
    }),
    from: vi.fn((tabela: string) => {
      servidor.tabelas.push(tabela)
      throw new Error(`leitura direta de ${tabela}`)
    }),
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  },
}))
vi.mock('@/lib/aoVivo', () => ({ useAoVivo: vi.fn(), useMeuTrabalhoAoVivo: vi.fn() }))
const sessao = vi.hoisted(() => ({
  perfil: {
    id: 'u-dono',
    nome: 'Dono Teste',
    usuario: 'dono',
    matricula: 'M-1',
    papel: 'admin',
    super_admin: true,
    modulos: ['fabrica'],
  } as Record<string, unknown>,
}))
vi.mock('@/autenticacao/sessao-contexto', () => ({
  useSessao: () => ({ carregando: false, perfil: sessao.perfil, vinculos: [], ehLider: false }),
}))

const AGORA = '2026-11-18T12:00:00+00:00'
const SEMANA = '2026-11-11T12:00:00+00:00'

const tarefa = (id: number, titulo: string) => ({
  id,
  titulo,
  descricao: null,
  card_id: null,
  setor_id: null,
  responsavel_id: 'u-dono',
  criada_por_id: 'u-dono',
  delegacao: 'direta',
  situacao: 'aberta',
  prazo: null,
  iniciada_em: null,
  concluida_em: null,
  criada_em: AGORA,
  tarefa_mae_id: null,
  origem: 'pessoa',
  evento_referencia_id: null,
  privada: true,
  tempo_acumulado: '00:00:00',
})
const card = (id: number, pedidoId: number) => ({
  id,
  tipo: 'unidade',
  pedido_id: pedidoId,
  item_descricao: `Cômoda ${id}`,
  indice_unidade: 1,
  total_unidades: 1,
  setor_atual_id: 6,
  desde: AGORA,
  delegado_em: AGORA,
})

function trabalho(args: { p_tela?: string; p_abrir?: boolean } | undefined) {
  const tela = args?.p_tela ?? 'bolha'
  const base = { agora_ms: 1, tela, tarefas: [tarefa(1, 'Engraxar as caixas de cola')], execucoes: [] }
  if (tela === 'painel')
    return {
      ...base,
      cards: [card(11, 501)],
      setores_chave: '',
      tarefas_sistema: [],
      ...(args?.p_abrir ? { fila_prioridade: [], metas: [] } : {}),
    }
  if (tela === 'afazeres')
    return {
      ...base,
      cards: [card(11, 501)],
      subtarefas: [{ mae_id: 1, total: 3, feitas: 1 }],
      pedidos: [{ pedido_id: 501, numero: 13900 }],
    }
  return base
}

beforeEach(() => {
  servidor.rpc.length = 0
  servidor.tabelas.length = 0
  reiniciarMeuTrabalhoParaTeste()
  servidor.respostas = {
    plt_fn_meu_trabalho: trabalho,
    plt_fn_dash_pessoas_abertura: {
      de: SEMANA,
      ate: AGORA,
      dias: 7,
      setor_id: null,
      pessoas: [
        {
          usuario_id: 'u-1',
          usuario_nome: 'Ana Operadora',
          matricula: 'M-7',
          foto_caminho: null,
          execucoes: 4,
          cards_atendidos: 3,
          tempo_bruto: '02:00:00',
          tempo_util: '01:30:00',
        },
      ],
      execucoes: [],
      metas: [],
      visualizacoes: [],
    },
    plt_fn_dash_qualidade_abertura: {
      de: SEMANA,
      ate: AGORA,
      dias: 7,
      qualidade: [
        {
          setor_id: 6,
          setor_nome: 'MONTAGEM',
          entregues_perfeito: 9,
          entregues_atencao: 1,
          entregues_danificado: 0,
          divergencias_contra: 0,
          pareceres_dados: 2,
          divergencias_apontadas: 0,
        },
      ],
      qualidade_anterior: [],
      danificados_abertos: [],
      visualizacoes: [],
    },
    plt_fn_meu_desempenho_abertura: {
      de: SEMANA,
      ate: AGORA,
      dias: 7,
      kpis: {
        execucoes: 5,
        execucoes_finalizadas: 4,
        tempo_execucao: '03:00:00',
        media_execucao: '00:36:00',
        cards_distintos: 4,
        tarefas_concluidas: 2,
        tempo_afazeres: '00:40:00',
        pareceres_dados: 1,
      },
      por_dia: [],
      por_tarefa: [],
    },
    plt_fn_equipe_abertura: {
      pessoas: [
        {
          id: 'u-1',
          nome: 'Ana Operadora',
          usuario: 'ana',
          email: 'ana@teste.com',
          telefone: null,
          matricula: 'M-7',
          papel: 'operador',
          senha_padrao: false,
          ativo: true,
          arquivado_em: null,
          tema: null,
          foto_caminho: null,
          modulos: ['fabrica'],
          super_admin: false,
          conta_tablet: false,
          pode_auxiliar: false,
        },
      ],
      vinculos: [{ usuario_id: 'u-1', setor_id: 6, lider_do_setor: false, setor: { nome: 'MONTAGEM' } }],
    },
    plt_fn_api_abertura: {
      chaves: [
        {
          id: 1,
          nome: 'n8n da fábrica',
          prefixo: 'pltk_abc',
          escopo: 'escrita',
          criada_em: AGORA,
          revogada_em: null,
          ultimo_uso_em: null,
        },
      ],
      webhooks: [],
      entregas: [],
    },
    plt_fn_caminhoes_abertura: {
      caminhoes: [
        {
          id: 1,
          nome: 'Baú grande',
          placa: 'ABC1D23',
          capacidade: null,
          foto_caminho: null,
          arquivado_em: null,
          criado_em: AGORA,
        },
      ],
      tiny_entrega: { ligado_desde: null, ultimo_ok_em: null, pausado: false, esperando: 0, parados: [] },
    },
    plt_fn_automacoes_abertura: {
      lista: [
        {
          id: 7,
          nome: 'Parado avisa o líder',
          ligada: false,
          gatilho: 'card_parado',
          gatilho_config: { horas: 72 },
          passos_total: 1,
          ligada_em: null,
          atualizada_em: AGORA,
          arquivada_em: null,
          ultima_execucao_em: null,
          ultima_situacao: null,
          execucoes_24h: 0,
          contagem_total: 1,
        },
      ],
      etapas: [],
      pessoas: [{ id: 'u-1', nome: 'Ana Operadora' }],
    },
    plt_fn_tempo_desligar_abertura: {
      usuarios: [{ id: 'u-1', nome: 'Ana Operadora' }],
      horarios: [],
      pausas: [],
    },
  }
})

/** O app aberto: o que a abertura já guardou (setores, etiquetas, campos) e o cache de 30 s. */
function appAberto() {
  const clienteQuery = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false } },
  })
  clienteQuery.setQueryDefaults(['setores'], { staleTime: Infinity })
  clienteQuery.setQueryData(
    ['setores'],
    [{ id: 6, codigo: 'montagem', nome: 'MONTAGEM', papel_no_fluxo: 'producao', ordem: 60, ativo: true }],
  )
  clienteQuery.setQueryData(['etiquetas'], [])
  clienteQuery.setQueryData(['campos'], [])
  return clienteQuery
}

function abrir(tela: ReactNode, clienteQuery = appAberto(), endereco = '/') {
  render(
    <QueryClientProvider client={clienteQuery}>
      <MemoryRouter initialEntries={[endereco]}>
        <ProvedorNotificacao>{tela}</ProvedorNotificacao>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return clienteQuery
}

/** Deixa as consultas que ainda fossem sair, saírem (a prova é que não sai mais nenhuma). */
async function assentar() {
  await act(async () => {
    await new Promise((feito) => setTimeout(feito, 60))
  })
}

async function soUmaPorta(porta: string) {
  await waitFor(() => expect(servidor.rpc.length).toBeGreaterThan(0))
  await assentar()
  expect(servidor.rpc.map((c) => c.porta)).toEqual([porta])
  expect(servidor.tabelas).toEqual([])
}

describe('SESSAO-55 · cada tela abre com uma requisição (a porta de abertura dela)', () => {
  it('Dashboards → Pessoas: o ranking, as execuções, as metas e as visualizações numa leitura', async () => {
    abrir(<Pessoas />, undefined, '/dashboards/pessoas?dias=30&setor=6')
    expect(await screen.findByText('Ana Operadora')).toBeInTheDocument()
    await soUmaPorta('plt_fn_dash_pessoas_abertura')
    // a tela manda só o que o endereço diz; pede junto o que ainda não tem guardado
    expect(servidor.rpc[0].args).toEqual({
      p_dias: 30,
      p_setor_id: 6,
      p_setor_dito: true,
      p_v: null,
      p_visualizacoes: true,
      p_metas: true,
      p_metas_limite: 10,
    })
  })

  it('Dashboards → Pessoas com as visualizações e as metas já guardadas: a porta não as traz de novo', async () => {
    const clienteQuery = appAberto()
    clienteQuery.setQueryData(['visualizacoes', 'u-dono'], [])
    clienteQuery.setQueryData(['metas', 'painel-pessoas', 1], [])
    abrir(<Pessoas />, clienteQuery, '/dashboards/pessoas')
    await soUmaPorta('plt_fn_dash_pessoas_abertura')
    expect(servidor.rpc[0].args).toMatchObject({
      p_dias: null,
      p_setor_dito: false,
      p_visualizacoes: false,
      p_metas: false,
    })
  })

  it('Dashboards → Qualidade: o período, o período anterior e os danificados numa leitura', async () => {
    abrir(<Qualidade />, undefined, '/dashboards/qualidade?v=12')
    await soUmaPorta('plt_fn_dash_qualidade_abertura')
    // a visualização salva do endereço vai para o banco resolver (antes: em cascata)
    expect(servidor.rpc[0].args).toEqual({ p_dias: null, p_v: 12, p_visualizacoes: true })
    expect((await screen.findAllByText(/MONTAGEM/)).length).toBeGreaterThan(0)
  })

  it('Dashboards → Meu desempenho: os números, o tempo por dia e por tarefa numa leitura', async () => {
    abrir(<MeuDesempenho />)
    await soUmaPorta('plt_fn_meu_desempenho_abertura')
    expect(servidor.rpc[0].args).toEqual({ p_dias: 7, p_limite: 10 })
  })

  it('Configurações → Equipe: as pessoas e os setores de cada uma numa leitura', async () => {
    abrir(<Equipe />)
    expect((await screen.findAllByText('Ana Operadora')).length).toBeGreaterThan(0)
    await soUmaPorta('plt_fn_equipe_abertura')
  })

  it('Configurações → API e integrações: as chaves, os webhooks e as entregas numa leitura', async () => {
    abrir(<AdminApi />)
    expect((await screen.findAllByText('n8n da fábrica')).length).toBeGreaterThan(0)
    await soUmaPorta('plt_fn_api_abertura')
  })

  it('Configurações → Caminhões: a lista e o cartão "Entregue vai ao Tiny" numa leitura', async () => {
    abrir(<Caminhoes />)
    expect(await screen.findByText('Baú grande')).toBeInTheDocument()
    await soUmaPorta('plt_fn_caminhoes_abertura')
    expect(servidor.rpc[0].args).toEqual({ p_arquivados: false, p_tiny: true })
  })

  it('Automações: a lista, as etapas e as pessoas numa leitura', async () => {
    abrir(<Automacoes />, undefined, '/super-admin/automacoes')
    expect(await screen.findByText('Parado avisa o líder')).toBeInTheDocument()
    await soUmaPorta('plt_fn_automacoes_abertura')
    expect(servidor.rpc[0].args).toEqual({
      p_limite: 30,
      p_deslocamento: 0,
      p_arquivadas: false,
      p_cadastros: true,
    })
  })

  it('Automações: a automação NOVA aberta direto pelo endereço pede só os cadastros, numa leitura', async () => {
    abrir(<Automacoes />, undefined, '/super-admin/automacoes?a=nova')
    await soUmaPorta('plt_fn_automacoes_abertura')
    expect(servidor.rpc[0].args).toEqual({ p_so_cadastros: true, p_cadastros: true })
  })

  it('Automações: a automação NOVA vinda da lista (cadastros já guardados) não pede nada', async () => {
    const clienteQuery = appAberto()
    clienteQuery.setQueryData(['etapas-ativas'], [])
    clienteQuery.setQueryData(['usuarios-ativos'], [{ id: 'u-1', nome: 'Ana Operadora' }])
    abrir(<Automacoes />, clienteQuery, '/super-admin/automacoes?a=nova')
    await assentar()
    expect(servidor.rpc).toEqual([])
    expect(servidor.tabelas).toEqual([])
  })

  it('Controle de tempo → "Desligar o tempo" (no clique): os nomes, os horários e as pausas numa leitura', async () => {
    abrir(<DesligarTempo />)
    await soUmaPorta('plt_fn_tempo_desligar_abertura')
  })
})

describe('SESSAO-55 · o trabalho da pessoa numa leitura (o aviso relê uma vez)', () => {
  /** O app aberto noutra tela: a abertura guardou só o que a bolinha mostra. */
  function comABolinha() {
    const clienteQuery = appAberto()
    clienteQuery.setQueryData(chaveMeuTrabalho('u-dono'), {
      tela: 'bolha',
      tarefas: [tarefa(1, 'Engraxar as caixas de cola')],
      execucoes: [],
      cards: [],
      tarefasSistema: [],
      subtarefas: [],
      pedidos: [],
    })
    return clienteQuery
  }

  it('o Meu Painel como 1ª tela: tudo veio na abertura do app — nenhuma leitura', async () => {
    const clienteQuery = appAberto()
    clienteQuery.setQueryData(chaveMeuTrabalho('u-dono'), {
      tela: 'painel',
      tarefas: [tarefa(1, 'Engraxar as caixas de cola')],
      execucoes: [],
      cards: [],
      tarefasSistema: [],
      subtarefas: [],
      pedidos: [],
    })
    clienteQuery.setQueryData(['fila-prioridade', 'u-dono'], [])
    clienteQuery.setQueryData(['metas', 'painel', 1], [])
    abrir(<MeuPainel />, clienteQuery)
    expect((await screen.findAllByText('Engraxar as caixas de cola')).length).toBeGreaterThan(0)
    await assentar()
    expect(servidor.rpc).toEqual([])
    expect(servidor.tabelas).toEqual([])
  })

  it('chegar ao Meu Painel vindo de outra tela: UMA leitura (com a fila e as metas juntas)', async () => {
    abrir(
      <>
        <BolhaExecucao />
        <MeuPainel />
      </>,
      comABolinha(),
    )
    await soUmaPorta('plt_fn_meu_trabalho')
    expect(servidor.rpc[0].args).toEqual({ p_tela: 'painel', p_abrir: true })
    expect((await screen.findAllByText(/Cômoda 11/)).length).toBeGreaterThan(0)
  })

  it('o aviso do trabalho no Meu Painel: UMA releitura (antes eram 4), sem a fila nem as metas', async () => {
    const clienteQuery = abrir(
      <>
        <BolhaExecucao />
        <MeuPainel />
      </>,
      comABolinha(),
    )
    await soUmaPorta('plt_fn_meu_trabalho')
    servidor.rpc.length = 0
    // o que o aviso do canal da pessoa faz (useMeuTrabalhoAoVivo)
    await act(async () => {
      await clienteQuery.invalidateQueries({ queryKey: ['afazeres'] })
    })
    await soUmaPorta('plt_fn_meu_trabalho')
    expect(servidor.rpc[0].args).toEqual({ p_tela: 'painel', p_abrir: false })
  })

  it('Meus afazeres: os cards, as tarefas, o "1/3" e o número do pedido numa leitura', async () => {
    abrir(<Afazeres />, comABolinha())
    await soUmaPorta('plt_fn_meu_trabalho')
    expect(servidor.rpc[0].args).toEqual({ p_tela: 'afazeres', p_abrir: false })
    expect(await screen.findByText('Pedido 13900')).toBeInTheDocument()
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('fora das telas pessoais, o aviso relê só o que a bolinha mostra', async () => {
    const clienteQuery = abrir(<BolhaExecucao />, comABolinha())
    await assentar()
    expect(servidor.rpc).toEqual([])
    await act(async () => {
      await clienteQuery.invalidateQueries({ queryKey: ['afazeres'] })
    })
    await soUmaPorta('plt_fn_meu_trabalho')
    expect(servidor.rpc[0].args).toEqual({ p_tela: 'bolha', p_abrir: false })
  })
})
