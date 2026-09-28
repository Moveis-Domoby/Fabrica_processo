import { beforeAll, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ProvedorNotificacao } from '@/componentes/ui'
import { ProvedorChat } from './ProvedorChat'
import { BalaoChat } from './BalaoChat'

/**
 * O critério de aceite da aba Network, provado em teste (SESSAO-26): o
 * Supabase é simulado e CONTA as leituras e os canais de websocket.
 *  - balão fechado: 1 canal (o da pessoa) e 1 leitura (a 1ª página da lista),
 *    e a leitura só depois de o canal ouvir;
 *  - sinal do websocket muda o badge sem reler nada;
 *  - abrir uma conversa: +1 canal (o da conversa) e +1 leitura (10 mensagens);
 *  - mensagem nova da conversa chega pelo websocket, sem reler;
 *  - fechar a conversa desinscreve.
 */
interface CanalFalso {
  topico: string
  privado: boolean
  removido: boolean
  ouvir: ((m: { event: string; payload: unknown }) => void) | null
  status: ((s: string) => void) | null
  api: { topic: string }
}

const estado = vi.hoisted(() => ({
  chamadas: [] as { fn: string; args: Record<string, unknown> }[],
  canais: [] as CanalFalso[],
}))

const LEITURAS = ['plt_fn_chat_conversas', 'plt_fn_chat_mensagens', 'plt_fn_chat_membros']
const leituras = () => estado.chamadas.filter((c) => LEITURAS.includes(c.fn))
const posts = (fn: string) => estado.chamadas.filter((c) => c.fn === fn)

const base = {
  foto_caminho: null,
  outro_id: null,
  outro_ativo: null,
  papel: 'membro',
  administra: false,
  membros: 30,
  ultima_autor_id: 'u2',
  ultima_autor_nome: 'Ana Souza',
  total_nao_lidas: 3,
}
const CONVERSAS = [
  {
    ...base,
    conversa_id: 1,
    tipo: 'avisos',
    titulo: 'Avisos gerais',
    pode_escrever: false,
    atividade_em: '2026-09-27T12:00:00Z',
    ultima_id: 12,
    ultima_previa: 'Amanhã abre às 7h',
    ultima_lida_id: 10,
    nao_lidas: 2,
  },
  {
    ...base,
    conversa_id: 2,
    tipo: 'canal',
    titulo: 'Montagem',
    membros: 4,
    pode_escrever: true,
    atividade_em: '2026-09-27T11:00:00Z',
    ultima_id: 20,
    ultima_previa: 'Bom dia',
    ultima_lida_id: 19,
    nao_lidas: 1,
  },
]
const MENSAGENS_DA_2 = [
  { id: 20, conversa_id: 2, autor_id: 'u2', autor_nome: 'Ana Souza', autor_foto: null, tipo: 'texto', texto: 'Bom dia', criada_em: '2026-09-27T11:00:00Z' },
  { id: 19, conversa_id: 2, autor_id: 'u1', autor_nome: 'Pessoa Um', autor_foto: null, tipo: 'texto', texto: 'Oi', criada_em: '2026-09-27T10:59:00Z' },
]

vi.mock('@/lib/supabase', () => {
  const respostas: Record<string, (a: Record<string, unknown>) => unknown> = {
    plt_fn_chat_conversas: (a) => (a.p_antes_em ? [] : CONVERSAS),
    plt_fn_chat_mensagens: () => MENSAGENS_DA_2,
    plt_fn_chat_marcar_lida: (a) => a.p_ate_id,
  }
  return {
    supabase: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        estado.chamadas.push({ fn, args })
        return { data: respostas[fn]?.(args) ?? null, error: null }
      },
      channel: (topico: string, params?: { config?: { private?: boolean } }) => {
        const canal = {
          topico,
          privado: params?.config?.private === true,
          removido: false,
          ouvir: null,
          status: null,
        } as unknown as CanalFalso
        const api = {
          topic: `realtime:${topico}`,
          on: (_tipo: string, _filtro: unknown, cb: CanalFalso['ouvir']) => {
            canal.ouvir = cb
            return api
          },
          subscribe: (cb: CanalFalso['status']) => {
            canal.status = cb
            return api
          },
        }
        canal.api = api
        estado.canais.push(canal)
        return api
      },
      removeChannel: async (api: unknown) => {
        const canal = estado.canais.find((c) => c.api === api)
        if (canal) canal.removido = true
        return 'ok'
      },
      getChannels: () => estado.canais.filter((c) => !c.removido).map((c) => c.api),
      storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    },
  }
})

vi.mock('@/autenticacao/sessao-contexto', () => ({
  useSessao: () => ({
    perfil: { id: 'u1', nome: 'Pessoa Um', papel: 'operador' },
    ehLider: false,
    vinculos: [],
  }),
}))

beforeAll(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})

describe('chat: o que o balão e a conversa pedem ao servidor (critério da aba Network)', () => {
  it('fechado custa 1 canal e 1 página; a conversa aberta, +1 canal e +1 página; fechar desinscreve', async () => {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={cliente}>
        <ProvedorNotificacao>
          <MemoryRouter initialEntries={['/inicio/meu-painel']}>
            <ProvedorChat eu="u1">
              <BalaoChat />
            </ProvedorChat>
          </MemoryRouter>
        </ProvedorNotificacao>
      </QueryClientProvider>,
    )

    // 1 · o canal da PESSOA, privado — e nenhuma leitura antes de ele ouvir
    await waitFor(() => expect(estado.canais).toHaveLength(1))
    expect(estado.canais[0]).toMatchObject({ topico: 'plt-chat-u:u1', privado: true })
    expect(leituras()).toHaveLength(0)
    act(() => estado.canais[0].status!('SUBSCRIBED'))

    // 2 · a 1ª página (5 por página) acende o badge — é a ÚNICA leitura
    const balao = await screen.findByRole('button', { name: /Chat: 3 mensagens não lidas/ })
    expect(leituras().map((c) => c.fn)).toEqual(['plt_fn_chat_conversas'])
    expect(leituras()[0].args).toMatchObject({ p_antes_em: null, p_limite: 5 })

    // 3 · sinal do websocket (aviso novo de outra pessoa): badge sobe, nada é relido
    act(() =>
      estado.canais[0].ouvir!({
        event: 'mensagem',
        payload: {
          conversa_id: 1,
          tipo_conversa: 'avisos',
          nome_conversa: 'Avisos gerais',
          mensagem_id: 13,
          autor_id: 'u2',
          autor_nome: 'Ana Souza',
          autor_foto: null,
          previa: 'Reunião às 16h',
          criada_em: '2026-09-27T13:00:00Z',
        },
      }),
    )
    expect(await screen.findByRole('button', { name: /Chat: 4 mensagens não lidas/ })).toBe(balao)
    expect(leituras()).toHaveLength(1)

    // 4 · abrir o painel não relê a lista (já está no cache)
    fireEvent.keyDown(balao, { key: 'Enter' })
    const montagem = await screen.findByRole('button', { name: /Montagem/ })
    expect(screen.getByText('Ana: Reunião às 16h')).toBeInTheDocument()
    expect(leituras()).toHaveLength(1)

    // 5 · abrir a conversa: +1 canal (o dela, privado) e, depois de ouvir, +1 página de 10
    fireEvent.click(montagem)
    await waitFor(() => expect(estado.canais).toHaveLength(2))
    expect(estado.canais[1]).toMatchObject({ topico: 'plt-chat-c:2', privado: true })
    expect(leituras()).toHaveLength(1)
    act(() => estado.canais[1].status!('SUBSCRIBED'))
    expect(await screen.findByText('Bom dia')).toBeInTheDocument()
    const paginaDeMensagens = leituras().filter((c) => c.fn === 'plt_fn_chat_mensagens')
    expect(paginaDeMensagens).toHaveLength(1)
    expect(paginaDeMensagens[0].args).toMatchObject({ p_conversa_id: 2, p_antes_id: null, p_limite: 10 })

    // 6 · lida (POST) até a última mensagem carregada
    await waitFor(() => expect(posts('plt_fn_chat_marcar_lida')).toHaveLength(1))
    expect(posts('plt_fn_chat_marcar_lida')[0].args).toMatchObject({ p_conversa_id: 2, p_ate_id: 20 })

    // 7 · mensagem nova da conversa chega pelo websocket — sem reler nada
    act(() =>
      estado.canais[1].ouvir!({
        event: 'mensagem',
        payload: {
          id: 21,
          conversa_id: 2,
          autor_id: 'u2',
          autor_nome: 'Ana Souza',
          autor_foto: null,
          tipo: 'texto',
          texto: 'Chegou a chapa',
          criada_em: '2026-09-27T13:05:00Z',
        },
      }),
    )
    expect(await screen.findByText('Chegou a chapa')).toBeInTheDocument()
    expect(leituras()).toHaveLength(2)

    // 8 · voltar à lista: o canal da conversa sai (depois do respiro de 1,5 s);
    // o da pessoa continua ouvindo
    fireEvent.click(screen.getByRole('button', { name: 'Voltar às conversas' }))
    await waitFor(() => expect(estado.canais[1].removido).toBe(true), { timeout: 3000 })
    expect(estado.canais[0].removido).toBe(false)
    expect(estado.canais).toHaveLength(2)
    expect(leituras()).toHaveLength(2)
  })
})
