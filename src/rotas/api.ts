import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * Camada de dados do módulo de ROTAS (SESSAO-11 / D-33, revista na SESSAO-15 /
 * D-39 / D-45): a entrega é por PEDIDO COMPLETO e SÓ o pedido lançado pelos
 * Pedidos em aguardo aparece aqui. O gate (logística: admin, PCP, terminais)
 * vive nas funções do banco. Endereço e contato aparecem de propósito — é o
 * que o entregador precisa (o mesmo que o card do ClickUp mostrava).
 */

export interface Entrega {
  card_id: number
  pedido_id: number
  numero: number
  cliente_nome: string
  telefone: string | null
  endereco: string | null
  numero_endereco: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  obs: string | null
  data_prevista: string | null
  total_unidades: number
  unidades_em_rotas: number
  situacao_entrega: 'pronta' | 'entregue'
  entregue_em: string | null
  entregue_por: string | null
  lancado_em: string | null
  /** D-39: o dia e o caminhão programados, quando há. */
  programacao_data: string | null
  caminhao_id: number | null
  caminhao_nome: string | null
  caminhao_placa: string | null
  caminhao_foto: string | null
  contagem_total: number
}

export async function listarEntregas(parametros: {
  situacao?: string | null
  busca?: string
  limite?: number
  deslocamento?: number
}): Promise<Entrega[]> {
  const { data, error } = await supabase.rpc('plt_fn_rotas', {
    p_situacao: parametros.situacao ?? null,
    p_busca: parametros.busca || null,
    p_limite: parametros.limite ?? 20,
    p_deslocamento: parametros.deslocamento ?? 0,
  })
  if (error) throw new Error(`Não deu para carregar as rotas: ${error.message}`)
  return (data ?? []) as Entrega[]
}

/** Marca o pedido COMPLETO como entregue (evento append-only; o banco valida). */
export async function registrarEntrega(parametros: {
  cardId: number
  observacao?: string
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_registrar_entrega', {
    p_card_id: parametros.cardId,
    p_observacao: parametros.observacao?.trim() || null,
  })
  if (error) throw new Error(`Não deu para registrar a entrega: ${error.message}`)
}

// ---------------------------------------------------------------------------
// SESSAO-30 (D-113/D-114/D-116): o que acontece na entrega além do "Entregue"
// ---------------------------------------------------------------------------

export type TipoMotivo = 'nao_entregue' | 'desfazer_entrega'

export interface Motivo {
  id: number
  tipo: TipoMotivo
  texto: string
  ordem: number
  ativo: boolean
}

/** Os motivos de uma lista (Configurações → Utilitários). `todos` = com os desligados (só admin). */
export async function listarMotivos(tipo: TipoMotivo, todos = false): Promise<Motivo[]> {
  const { data, error } = await supabase.rpc('plt_fn_motivos', { p_tipo: tipo, p_todos: todos })
  if (error) throw new Error(`Não deu para carregar os motivos: ${error.message}`)
  return (data ?? []) as Motivo[]
}

export async function salvarMotivo(parametros: {
  id: number | null
  tipo: TipoMotivo
  texto: string
  ordem?: number | null
  ativo?: boolean
}): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_motivo_salvar', {
    p_id: parametros.id,
    p_tipo: parametros.tipo,
    p_texto: parametros.texto.trim(),
    p_ordem: parametros.ordem ?? null,
    p_ativo: parametros.ativo ?? true,
  })
  if (error) throw new Error(error.message)
  return Number(data)
}

/** Desfaz a entrega do dia (com motivo): as peças voltam à ROTAS e o Tiny volta junto. */
export async function desfazerEntrega(parametros: {
  cardId: number
  motivoId: number
  observacao?: string
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_entrega_desfazer', {
    p_card_id: parametros.cardId,
    p_motivo_id: parametros.motivoId,
    p_observacao: parametros.observacao?.trim() || null,
  })
  if (error) throw new Error(error.message)
}

/** Não entregue (com motivo): o pedido volta para "Programar"; o Tiny não muda. */
export async function marcarNaoEntregue(parametros: {
  cardId: number
  motivoId: number
  observacao?: string
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_entrega_nao_realizada', {
    p_card_id: parametros.cardId,
    p_motivo_id: parametros.motivoId,
    p_observacao: parametros.observacao?.trim() || null,
  })
  if (error) throw new Error(error.message)
}

/** Pedido devolvido na entrega: as peças voltam ao ESTOQUE sem dono; o Tiny não muda. */
export async function marcarDevolvido(parametros: {
  cardId: number
  observacao?: string
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_entrega_devolvida', {
    p_card_id: parametros.cardId,
    p_observacao: parametros.observacao?.trim() || null,
  })
  if (error) throw new Error(error.message)
}

/** A chave "Entregue vai ao Tiny" e a fila (só admin vê; só o super admin liga). */
export interface SituacaoEntregaTiny {
  ligado_desde: string | null
  ultimo_ok_em: string | null
  pausado: boolean
  esperando: number
  parados: {
    pedido_id: number
    numero: number
    situacao: string
    erro: string | null
    parado_em: string
  }[]
}

export async function situacaoEntregaTiny(): Promise<SituacaoEntregaTiny | null> {
  const { data, error } = await supabase.rpc('plt_fn_tiny_entrega_situacao')
  if (error) throw new Error(error.message)
  return (data ?? null) as SituacaoEntregaTiny | null
}

export async function ligarEntregaTiny(ligar: boolean): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_tiny_entrega_ligar', { p_ligar: ligar })
  if (error) throw new Error(error.message)
}

export async function reenviarEntregaTiny(pedidoId: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_tiny_entrega_reenviar', { p_pedido_id: pedidoId })
  if (error) throw new Error(error.message)
}

/** A entrega foi hoje (no fuso do galpão)? Só a do dia se desfaz (D-113). */
export function entregueHoje(entregueEm: string | null, agora = new Date()): boolean {
  if (!entregueEm) return false
  const dia = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' })
  return dia(new Date(entregueEm)) === dia(agora)
}

/** Endereço em linha única (o formato do card real de entrega). */
export function enderecoLegivel(e: {
  endereco: string | null
  numero_endereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
}): string {
  const partes = [
    [e.endereco, e.numero_endereco].filter(Boolean).join(', '),
    e.bairro,
    [e.cidade, e.uf].filter(Boolean).join('-'),
  ].filter(Boolean)
  return partes.join(' · ') || 'Sem endereço cadastrado'
}

/** Data ISO (aaaa-mm-dd) em dd/mm/aaaa; nula vira "—". */
export function dataLegivel(iso: string | null): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '—'
}

/** Link do WhatsApp (wa.me) a partir do telefone cru. */
export function linkWhatsApp(telefone: string | null): string | null {
  const digitos = (telefone ?? '').replace(/\D/g, '')
  if (digitos.length < 10) return null
  return `https://wa.me/55${digitos}`
}

/** Link do mapa, como no card real. */
export function linkMapa(e: Entrega): string | null {
  const endereco = [e.endereco, e.numero_endereco, e.bairro, e.cidade, e.uf]
    .filter(Boolean)
    .join(', ')
  if (!endereco) return null
  return `https://www.google.com/maps/search/${encodeURIComponent(endereco)}`
}

// ---------------------------------------------------------------------------
// Programação de caminhão (D-39/D-45)
// ---------------------------------------------------------------------------

/** Um móvel do pedido (D-111): a descrição e a quantidade — o frete não vem. */
export interface ItemPedido {
  descricao: string
  quantidade: number
}

export interface PedidoProgramacao {
  card_id: number
  pedido_id: number
  numero: number
  cliente_nome: string
  endereco: string | null
  numero_endereco: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  /** O que se manda ao geocodificador; null = sem endereço nenhum. */
  endereco_geocodificavel: string | null
  /** Chave do cache, calculada no banco (md5 do endereço normalizado). */
  geo_chave: string | null
  latitude: number | null
  longitude: number | null
  /** null = nunca consultado; false = consultado e sem ponto (Q-65). */
  geo_resolvido: boolean | null
  geo_consultado_em: string | null
  total_unidades: number
  /** D-111: os móveis do pedido, na ordem, sem o frete. */
  itens: ItemPedido[]
  data_prevista: string | null
  lancado_em: string | null
  programacao_data: string | null
  caminhao_id: number | null
  caminhao_nome: string | null
  /** D-109: a posição salva à mão na rota do caminhão; null = vale a sugestão. */
  ordem: number | null
  contagem_total: number
}

/**
 * Os pedidos da programação: SEM programação (sempre) + os programados no dia
 * pedido (a não ser com `soSemProgramacao` — a aba "Programar", D-111). Vem com
 * o ponto do cache quando já geocodificado e com os móveis de cada pedido.
 */
export async function listarProgramacao(parametros: {
  data?: string | null
  soSemProgramacao?: boolean
  limite?: number
  deslocamento?: number
}): Promise<PedidoProgramacao[]> {
  const { data, error } = await supabase.rpc('plt_fn_programacao', {
    p_data: parametros.data ?? null,
    p_limite: parametros.limite ?? 100,
    p_deslocamento: parametros.deslocamento ?? 0,
    p_so_sem_programacao: parametros.soSemProgramacao ?? false,
  })
  if (error) throw new Error(`Não deu para carregar a programação: ${error.message}`)
  return (data ?? []) as PedidoProgramacao[]
}

/** Programar ou reprogramar (D-45): data + caminhão; o banco recusa depois de entregue. */
export async function programarEntrega(parametros: {
  cardId: number
  data: string
  caminhaoId: number
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_programar_entrega', {
    p_card_id: parametros.cardId,
    p_data: parametros.data,
    p_caminhao_id: parametros.caminhaoId,
  })
  if (error) throw new Error(`Não deu para programar: ${error.message}`)
}

/**
 * Programar a rota inteira numa chamada só (D-111): os pedidos no dia e
 * caminhão e, se vier, a ordem da rota do caminhão naquele dia. Tudo ou nada.
 */
export async function programarRota(parametros: {
  data: string
  caminhaoId: number
  cardIds: number[]
  ordem: number[] | null
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_programar_rota', {
    p_data: parametros.data,
    p_caminhao_id: parametros.caminhaoId,
    p_card_ids: parametros.cardIds,
    p_ordem: parametros.ordem,
  })
  if (error) throw new Error(`Não deu para programar: ${error.message}`)
}

/** Uma entrega já programada (aba "Já programadas" — D-111). */
export interface PedidoProgramado {
  card_id: number
  pedido_id: number
  numero: number
  cliente_nome: string
  endereco: string | null
  numero_endereco: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  geo_chave: string | null
  latitude: number | null
  longitude: number | null
  geo_resolvido: boolean | null
  total_unidades: number
  itens: ItemPedido[]
  data_prevista: string | null
  programacao_data: string
  caminhao_id: number
  caminhao_nome: string | null
  caminhao_placa: string | null
  ordem: number | null
  entregue_em: string | null
  /** SESSAO-30 (D-115): o detalhe da entrega escrito por quem programou. */
  detalhe: string | null
  contagem_total: number
}

/**
 * As programações (D-111), paginadas no servidor: as que ainda não foram
 * entregues (dia mais perto primeiro) ou, com `entregues`, o histórico.
 */
export async function listarProgramadas(parametros: {
  entregues?: boolean
  data?: string | null
  caminhaoId?: number | null
  limite?: number
  deslocamento?: number
}): Promise<PedidoProgramado[]> {
  const { data, error } = await supabase.rpc('plt_fn_programadas', {
    p_entregues: parametros.entregues ?? false,
    p_data: parametros.data ?? null,
    p_caminhao_id: parametros.caminhaoId ?? null,
    p_limite: parametros.limite ?? 50,
    p_deslocamento: parametros.deslocamento ?? 0,
  })
  if (error) throw new Error(`Não deu para carregar as programações: ${error.message}`)
  return (data ?? []) as PedidoProgramado[]
}

export async function desprogramarEntrega(cardId: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_desprogramar_entrega', { p_card_id: cardId })
  if (error) throw new Error(`Não deu para tirar da programação: ${error.message}`)
}

/** Quantos endereços por chamada à função (o mesmo teto do lado dela). */
export const GEOCODIFICAR_POR_CHAMADA = 5

export interface ResultadoGeocodificacao {
  chave: string
  latitude: number | null
  longitude: number | null
  resolvido: boolean
}

/**
 * Geocodificação pela Edge Function `geocodificar` (Nominatim com ritmo e
 * identificação — o navegador não consegue garantir nenhum dos dois). Até 5
 * por chamada (D-112: 3 tentativas por endereço); o resultado já fica no cache.
 */
export async function geocodificar(
  itens: { chave: string; endereco: string }[],
): Promise<ResultadoGeocodificacao[]> {
  if (itens.length === 0) return []
  const { data, error } = await supabase.functions.invoke('geocodificar', {
    body: { itens: itens.slice(0, GEOCODIFICAR_POR_CHAMADA) },
  })
  if (error) {
    let mensagem = 'Não consegui consultar o mapa. Confira a internet e tente de novo.'
    if (error instanceof FunctionsHttpError) {
      try {
        const corpo = (await error.context.json()) as { erro?: string }
        if (corpo.erro) mensagem = corpo.erro
      } catch {
        // corpo não era JSON — fica a mensagem genérica
      }
    }
    throw new Error(mensagem)
  }
  return (data as { resultados?: ResultadoGeocodificacao[] })?.resultados ?? []
}

/**
 * "Salvar ordem" (D-109): a ordem das paradas de um caminhão num dia. Lista
 * vazia = volta à sugestão automática. O banco recusa se a rota mudou noutra
 * tela, se alguém já foi entregue ou se quem salva não é da logística.
 */
export async function ordenarRota(parametros: {
  data: string
  caminhaoId: number
  cardIds: number[]
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_ordenar_rota', {
    p_data: parametros.data,
    p_caminhao_id: parametros.caminhaoId,
    p_card_ids: parametros.cardIds,
  })
  if (error) throw new Error(`Não deu para salvar a ordem: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Rota pelas ruas (SESSAO-28 / D-108)
// ---------------------------------------------------------------------------

export interface RotaCalculada {
  distancia_m: number
  duracao_s: number
  trechos: { distancia_m: number; duracao_s: number }[]
  /** A linha no formato compacto do serviço (polyline, precisão 5). */
  geometria: string
  servidor: string
}

export type ResultadoRota =
  { tipo: 'pronta'; rota: RotaCalculada; doCache: boolean } | { tipo: 'sem_caminho' }

/** "Não existe caminho" guardado vale por 7 dias (a Edge Function também não insiste). */
const SEM_CAMINHO_VALE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * A rota pelas ruas para a sequência de pontos (já com a fábrica na ida e na
 * volta). Primeiro o cache do mapa — reabrir a mesma programação é UMA leitura
 * barata, sem chamar o serviço; só o que nunca foi calculado vai à Edge
 * Function `calcular-rota` (que chama o serviço gratuito de rotas, identificada,
 * e guarda). Serviço fora do ar → erro (a tela cai na linha reta com aviso).
 */
export async function buscarRotaPelasRuas(
  chave: string,
  pontos: { latitude: number; longitude: number }[],
): Promise<ResultadoRota> {
  const { data: guardada } = await supabase
    .from('plt_geocache')
    .select('resolvido, rota, consultado_em')
    .eq('chave', chave)
    .maybeSingle()
  if (guardada?.resolvido && guardada.rota) {
    return { tipo: 'pronta', rota: guardada.rota as RotaCalculada, doCache: true }
  }
  if (
    guardada &&
    !guardada.resolvido &&
    Date.now() - new Date(guardada.consultado_em as string).getTime() < SEM_CAMINHO_VALE_MS
  ) {
    return { tipo: 'sem_caminho' }
  }

  const { data, error } = await supabase.functions.invoke('calcular-rota', {
    body: { pontos: pontos.map((p) => [p.latitude, p.longitude]) },
  })
  if (error) throw new Error('O serviço de rotas não respondeu agora.')
  const resposta = data as { chave?: string; resolvido?: boolean; rota?: RotaCalculada | null }
  if (resposta.chave && resposta.chave !== chave) {
    // A chave da tela e a da função do servidor saíram diferentes: o formato
    // mudou num lado só (rotaRuas.ts × calcular-rota) — a rota vale, o cache
    // da tela é que não vai achá-la na próxima vez.
    console.warn('rota: a chave da tela e a do servidor divergem', {
      tela: chave,
      servidor: resposta.chave,
    })
  }
  if (resposta.resolvido && resposta.rota)
    return { tipo: 'pronta', rota: resposta.rota, doCache: false }
  return { tipo: 'sem_caminho' }
}

/** Falha de geocodificação vale por 7 dias (a Edge Function também não insiste). */
const RETENTAR_APOS_MS = 7 * 24 * 60 * 60 * 1000

/** Quem ainda precisa ir ao geocodificador. */
export function precisaGeocodificar(p: PedidoProgramacao, agora = Date.now()): boolean {
  if (!p.geo_chave || !p.endereco_geocodificavel) return false
  if (p.geo_resolvido === true) return false
  if (p.geo_resolvido === null) return true
  const consultado = p.geo_consultado_em ? new Date(p.geo_consultado_em).getTime() : 0
  return agora - consultado > RETENTAR_APOS_MS
}

// ---------------------------------------------------------------------------
// SESSAO-30 (D-115): o entregador — "Entregas do dia", equipe do caminhão,
// detalhe da entrega, comentário e comprovante
// ---------------------------------------------------------------------------

export interface ItemEntrega {
  descricao: string
  quantidade: number
  volumes: number
}

export interface ComentarioEntrega {
  texto: string
  por: string | null
  em: string
}

export interface EntregaDoDia {
  posicao: number
  card_id: number
  pedido_id: number
  numero: number
  cliente_nome: string
  telefone: string | null
  endereco: string | null
  numero_endereco: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  latitude: number | null
  longitude: number | null
  obs: string | null
  /** O detalhe escrito por quem programou ("só depois das 10h"). */
  detalhe: string | null
  data_prevista: string | null
  itens: ItemEntrega[]
  unidades: number
  /** Volumes do cadastro do Tiny (produto com mais de um volume — montado na entrega). */
  volumes: number
  entregue_em: string | null
  entregue_por: string | null
  entregue_por_gente: boolean
  comprovantes: number
  comentarios: ComentarioEntrega[]
}

export interface CaminhaoDoDia {
  id: number
  nome: string
  placa: string | null
  foto: string | null
  equipe: string[]
  entregas: number
}

export interface EntregasDoDia {
  data: string
  caminhao_id: number | null
  caminhoes: CaminhaoDoDia[]
  entregas: EntregaDoDia[]
  sou_logistica: boolean
}

/** A tela do entregador numa requisição só (Lei §2). */
export async function entregasDoDia(
  parametros: { data?: string | null; caminhaoId?: number | null } = {},
): Promise<EntregasDoDia> {
  const { data, error } = await supabase.rpc('plt_fn_entregas_do_dia', {
    p_data: parametros.data ?? null,
    p_caminhao_id: parametros.caminhaoId ?? null,
  })
  if (error) throw new Error(`Não deu para carregar as entregas: ${error.message}`)
  return data as EntregasDoDia
}

export async function comentarNoCard(cardId: number, texto: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_card_comentar', {
    p_card_id: cardId,
    p_texto: texto.trim(),
  })
  if (error) throw new Error(error.message)
}

const ARMARIO = 'plt-anexos'
export const TIPOS_COMPROVANTE =
  'image/*,application/pdf,.pdf,.doc,.docx,.odt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const LIMITE_ARQUIVO = 10 * 1024 * 1024

/**
 * Foto reduzida NO APARELHO antes de subir (Lei §9): o lado maior vai a 1600 px
 * em JPEG; PDF, Word e o que o navegador não sabe desenhar (HEIC) vão como estão.
 */
export async function reduzirSeForFoto(arquivo: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) return arquivo
  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    if (escala === 1 && arquivo.size < 1.5 * 1024 * 1024) return arquivo
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.8))
    if (!blob) return arquivo
    return new File([blob], arquivo.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return arquivo
  }
}

/**
 * O comprovante sobe DIRETO ao armário privado (não passa pelo banco); depois o
 * banco registra o anexo no card. O caminho começa pelo card — é o que a regra
 * do armário confere.
 */
export async function anexarComprovante(cardId: number, original: File): Promise<void> {
  const arquivo = await reduzirSeForFoto(original)
  if (arquivo.size > LIMITE_ARQUIVO)
    throw new Error('O arquivo tem mais de 10 MB — mande uma foto ou um PDF menor.')
  const nomeLimpo =
    arquivo.name
      .normalize('NFD')
      .replace(/[^\w.-]+/g, '-')
      .slice(-80) || 'comprovante'
  const caminho = `${cardId}/${crypto.randomUUID()}-${nomeLimpo}`
  const envio = await supabase.storage.from(ARMARIO).upload(caminho, arquivo, {
    contentType: arquivo.type || 'application/octet-stream',
    upsert: false,
  })
  if (envio.error) throw new Error(`Não deu para enviar o arquivo: ${envio.error.message}`)
  const { error } = await supabase.rpc('plt_fn_anexo_registrar', {
    p_card_id: cardId,
    p_caminho: caminho,
    p_nome_arquivo: original.name,
    p_mime: arquivo.type || 'application/octet-stream',
    p_tamanho: arquivo.size,
    p_tipo: 'comprovante',
  })
  if (error) throw new Error(error.message)
}

export interface Anexo {
  id: number
  tipo: string
  caminho: string
  nome_arquivo: string
  mime: string
  tamanho: number
  enviado_por_nome: string | null
  enviado_em: string
}

export async function listarAnexos(cardId: number): Promise<Anexo[]> {
  const { data, error } = await supabase.rpc('plt_fn_anexos', { p_card_id: cardId })
  if (error) throw new Error(error.message)
  return (data ?? []) as Anexo[]
}

/** Link de poucos minutos para abrir o comprovante (o armário é privado). */
export async function linkDoAnexo(caminho: string): Promise<string> {
  const { data, error } = await supabase.storage.from(ARMARIO).createSignedUrl(caminho, 300)
  if (error || !data) throw new Error('Não deu para abrir o arquivo.')
  return data.signedUrl
}

export interface PessoaEntregadora {
  id: string
  nome: string
  foto_caminho: string | null
  entregador: boolean
}

export async function listarEntregadores(): Promise<PessoaEntregadora[]> {
  const { data, error } = await supabase.rpc('plt_fn_entregadores')
  if (error) throw new Error(error.message)
  return (data ?? []) as PessoaEntregadora[]
}

export interface MembroEquipe {
  caminhao_id: number
  usuario_id: string
  nome: string
}

export async function equipesDoDia(dataIso: string): Promise<MembroEquipe[]> {
  const { data, error } = await supabase.rpc('plt_fn_equipes_do_dia', { p_data: dataIso })
  if (error) throw new Error(error.message)
  return (data ?? []) as MembroEquipe[]
}

export async function definirEquipe(
  dataIso: string,
  caminhaoId: number,
  usuarios: string[],
): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_equipe_definir', {
    p_data: dataIso,
    p_caminhao_id: caminhaoId,
    p_usuarios: usuarios,
  })
  if (error) throw new Error(error.message)
}

export async function salvarDetalheEntrega(cardId: number, detalhe: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_programacao_detalhe', {
    p_card_id: cardId,
    p_detalhe: detalhe,
  })
  if (error) throw new Error(error.message)
}

/** Admin: tornar (ou deixar de ser) entregador — só "Entregas do dia" (D-115). */
export async function definirEntregador(usuarioId: string, entregador: boolean): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_usuario_entregador', {
    p_usuario_id: usuarioId,
    p_entregador: entregador,
  })
  if (error) throw new Error(error.message)
}

/** O mapa do endereço (o ponto, quando há; senão a busca pelo texto). */
export function linkMapaEntrega(e: EntregaDoDia): string | null {
  if (e.latitude !== null && e.longitude !== null)
    return `https://www.google.com/maps/search/?api=1&query=${e.latitude},${e.longitude}`
  const endereco = [e.endereco, e.numero_endereco, e.bairro, e.cidade, e.uf]
    .filter(Boolean)
    .join(', ')
  return endereco ? `https://www.google.com/maps/search/${encodeURIComponent(endereco)}` : null
}
