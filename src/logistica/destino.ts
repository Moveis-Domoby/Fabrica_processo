import { supabase } from '@/lib/supabase'

/**
 * SESSAO-48 (frente 3 — ↩️ revisa a D-61): o pedido cancelado no Tiny com móvel
 * em PRODUÇÃO pergunta o destino. A peça fica "esperando decisão" e a logística
 * decide na janela "Para onde vai este móvel?" — uma requisição ao abrir (a
 * leitura) e uma por decisão (a escrita), peça por peça ou todas de uma vez. A
 * regra é do banco (idempotente: a peça já decidida é pulada e relatada); as
 * duas portas têm o gate da logística dentro do banco.
 */

function garantir<T>(dados: T | null, erro: { message: string } | null, contexto: string): T {
  if (erro) throw new Error(`${contexto}: ${erro.message}`)
  if (dados === null) throw new Error(`${contexto}: o servidor não devolveu dados.`)
  return dados
}

export type DestinoMovel = 'estoque' | 'outro_pedido' | 'cancelar'

/** Uma peça do pedido cancelado que espera a decisão. */
export interface PecaEsperandoDestino {
  id: number
  descricao: string | null
  sku: string | null
  indice: number | null
  total: number | null
  setor: string | null
  etapa: string | null
  /** Desde quando espera a decisão. */
  desde: string
  /** Quem está trabalhando nela agora (se houver). */
  executor: string | null
  danificada: boolean
  /** A régua de "peça igual" (D-62) — a chave da lista de candidatos. */
  chave: string
}

/** Um pedido vivo no PCP que precisa do MESMO móvel, com vaga aberta. */
export interface PedidoCandidato {
  pedido_id: number
  card_pedido_id: number
  numero: number
  cliente_nome: string | null
  data_prevista: string | null
  /** Quantas vagas desse móvel ainda estão abertas no pedido. */
  vagas: number
  standby: boolean
}

/** O que já foi decidido (a história curta da janela). */
export interface DestinoDecidido {
  peca_id: number
  descricao: string | null
  destino: DestinoMovel | 'descancelado'
  via: 'pcp' | 'logistica' | null
  automatico: boolean
  numero_destino: number | null
  quando: string
  quem: string | null
}

/** A janela "Para onde vai este móvel?" — numa requisição só. */
export interface DetalheDestino {
  card_id: number
  pedido_id: number
  numero: number
  cliente_nome: string | null
  situacao_tiny: string | null
  cancelado: boolean
  cancelado_em: string | null
  pecas: PecaEsperandoDestino[]
  /** Por móvel (a chave da peça): até 10 pedidos, o mais antigo primeiro. */
  candidatos: Record<string, PedidoCandidato[]>
  decididas: DestinoDecidido[]
}

export async function detalheDestino(cardId: number): Promise<DetalheDestino> {
  const { data, error } = await supabase.rpc('plt_fn_destino_pendentes', { p_card_id: cardId })
  return garantir(data as DetalheDestino | null, error, 'Não deu para abrir a decisão do pedido')
}

export interface DecisaoDestino {
  pecaId: number
  destino: DestinoMovel
  /** Só em "Passar para outro pedido": o pedido escolhido. */
  pedidoId?: number
}

export interface ResultadoDestino {
  numero: number
  decididas: number
  feitas: {
    peca_id: number
    destino: DestinoMovel
    numero_destino?: number
    coluna?: string
  }[]
  /** As peças que já não esperavam decisão (outra pessoa, o PCP, o fim da linha). */
  puladas: { peca_id: number; destino: string | null }[]
}

/** Aplica as decisões numa transação (o banco confere tudo de novo). */
export async function decidirDestino(
  cardId: number,
  decisoes: DecisaoDestino[],
): Promise<ResultadoDestino> {
  const { data, error } = await supabase.rpc('plt_fn_destino_decidir', {
    p_card_id: cardId,
    p_decisoes: decisoes.map((d) => ({
      peca_id: d.pecaId,
      destino: d.destino,
      ...(d.destino === 'outro_pedido' && d.pedidoId !== undefined ? { pedido_id: d.pedidoId } : {}),
    })),
  })
  return garantir(data as ResultadoDestino | null, error, 'Não deu para aplicar a decisão')
}

/** As palavras das opções — a janela e a história falam igual. */
export const ROTULO_DESTINO: Record<DestinoMovel, string> = {
  estoque: 'Seguir para o estoque',
  outro_pedido: 'Passar para outro pedido',
  cancelar: 'Cancelar a fabricação',
}

export const EXPLICA_DESTINO: Record<DestinoMovel, string> = {
  estoque:
    'O móvel deixa de ser do pedido e continua a produção onde está. Pronto, entra no ESTOQUE sem dono.',
  outro_pedido:
    'O móvel passa a ser de outro pedido que precisa dele, ali mesmo onde está — setor, etapa e quem trabalha nele seguem iguais.',
  cancelar:
    'O móvel vai para a coluna CANCELADO e sai da produção. Enquanto ele estiver na coluna, dá para desfazer arrastando de volta.',
}

/** O que aconteceu com a peça, em uma linha. */
export function textoDaDecisao(d: Pick<DestinoDecidido, 'destino' | 'via' | 'automatico' | 'numero_destino'>): string {
  if (d.destino === 'descancelado') return 'O pedido voltou a valer no Tiny — o móvel seguiu com ele'
  if (d.destino === 'cancelar') return 'Fabricação cancelada'
  if (d.destino === 'outro_pedido') {
    const pedido = d.numero_destino !== null ? `o pedido ${d.numero_destino}` : 'outro pedido'
    return d.via === 'pcp' ? `Passou para ${pedido} (pelo PCP)` : `Passou para ${pedido}`
  }
  return d.automatico
    ? 'Ficou pronto sem decisão — entrou no ESTOQUE sem dono'
    : 'Seguiu para o estoque'
}

/** "Cômoda (1/2)" — o nome da peça com o k/n. */
export function nomeDaPeca(p: Pick<PecaEsperandoDestino, 'descricao' | 'indice' | 'total'>): string {
  const nome = p.descricao?.trim() || 'Móvel'
  return p.indice !== null && p.total !== null ? `${nome} (${p.indice}/${p.total})` : nome
}

/**
 * As vagas de um pedido que ainda sobram para ESTA peça, descontando as que
 * outras peças da mesma janela já escolheram (as peças iguais dividem as vagas).
 */
export function vagasQueSobram(
  candidato: PedidoCandidato,
  chave: string,
  pecaId: number,
  escolhas: Record<number, { destino: DestinoMovel; pedidoId?: number }>,
  pecas: Pick<PecaEsperandoDestino, 'id' | 'chave'>[],
): number {
  const tomadas = pecas.filter(
    (p) =>
      p.id !== pecaId &&
      p.chave === chave &&
      escolhas[p.id]?.destino === 'outro_pedido' &&
      escolhas[p.id]?.pedidoId === candidato.pedido_id,
  ).length
  return Math.max(candidato.vagas - tomadas, 0)
}

/**
 * "Todas de uma vez" → "Passar para outro pedido": cada peça ganha o 1º pedido
 * (o mais antigo) que ainda tem vaga do mesmo móvel, dividindo as vagas entre as
 * peças iguais. Nulo quando alguma peça fica sem pedido (danificada, sem
 * candidato ou sem vaga sobrando) — aí a escolha é peça por peça.
 */
export function distribuirOutroPedido(
  pecas: Pick<PecaEsperandoDestino, 'id' | 'chave' | 'danificada'>[],
  candidatos: Record<string, PedidoCandidato[]>,
): Record<number, number> | null {
  const usadas = new Map<string, number>()
  const resultado: Record<number, number> = {}
  for (const p of pecas) {
    if (p.danificada) return null
    const lista = candidatos[p.chave] ?? []
    const escolhido = lista.find((c) => (usadas.get(`${p.chave}|${c.pedido_id}`) ?? 0) < c.vagas)
    if (!escolhido) return null
    const k = `${p.chave}|${escolhido.pedido_id}`
    usadas.set(k, (usadas.get(k) ?? 0) + 1)
    resultado[p.id] = escolhido.pedido_id
  }
  return resultado
}
