import { supabase } from '@/lib/supabase'
import type { Estado } from '@/componentes/ui'
import { pastaDoProduto } from '@/tablet/api'

/**
 * Camada de dados da Logística (SESSAO-15 / D-38 / D-45): Estoque, Pedidos
 * em aguardo e Danificados. Tudo passa pelas portas plt_fn_* (gate da
 * logística DENTRO do banco); todo gesto vira evento append-only ou registro
 * na trilha de atividade — nada aqui faz UPDATE de posição.
 */

function garantir<T>(dados: T | null, erro: { message: string } | null, contexto: string): T {
  if (erro) throw new Error(`${contexto}: ${erro.message}`)
  if (dados === null) throw new Error(`${contexto}: o servidor não devolveu dados.`)
  return dados
}

// ---------------------------------------------------------------------------
// Estoque (SESSAO-25 ↪️ 28/09 D-70…D-73 ↪️ 30/09 D-83…D-87). Nos ACABADOS o
// número é a CONTAGEM da logística; o Tiny fica nos insumos e como referência.
// A lista é UMA, pelo ranking dos 90 dias (com o corte de pedido grande), e o
// Top X é o tamanho da página — só os X primeiros têm mínimo.
// ---------------------------------------------------------------------------

/** Os dois grupos da tela (resposta 8 do dono em 26/09). */
export type GrupoEstoque = 'acabados' | 'insumos'

/**
 * Recortes da lista — resolvidos NO SERVIDOR (regra 17). Acabados: nulo/'todos'
 * = a lista inteira pelo ranking; 'necessidade' · 'reservados_producao' ·
 * 'com_estoque' são o filtro do topo (D-86). Insumos: 'sem_leitura'.
 */
export type FiltroEstoque =
  | 'todos'
  | 'necessidade'
  | 'reservados_producao'
  | 'com_estoque'
  | 'sem_leitura'
  /** SESSAO-31 (D-129): os produtos com peça em decisão pós devolução. */
  | 'em_devolucao'

/** Onde está o card de reposição mais recente do produto. */
export type EstadoReposicao = 'no_pcp' | 'em_producao' | 'concluida' | 'arquivada'

export interface LinhaEstoqueProduto {
  tiny_id: number
  codigo: string | null
  descricao: string
  classe: string | null
  unidade: string | null
  /** SESSAO-32 (D-138): móvel, insumo ou peça — o tipo no estoque (com a troca à mão do admin). */
  tipo_estoque?: 'movel' | 'insumo' | 'peca' | null
  /** Foto (capa) do produto no bucket — a mesma biblioteca por SKU do tablet. */
  imagem_caminho: string | null
  /** Rank de vendas dos últimos 90 dias (1 = o mais vendido). Nulo = não vendeu. */
  posicao: number | null
  vendidos_90d: number
  /** Linhas de pedido fora do comum que saíram da conta (o aviso discreto). */
  cortes: number
  /** Dentro do Top X? Só quem está tem mínimo e pede reposição (D-83). */
  no_top: boolean
  /** O mínimo da plataforma — só dentro do Top X (insumos: plataforma ou Tiny). */
  minimo: number | null
  minimo_tiny: number | null
  /** true = editado à mão (não acompanha a sugestão até "voltar ao automático"). */
  minimo_travado: boolean
  /** A sugestão do dia (nulo fora do Top X). */
  sugestao: number | null
  /** Acabados: a contagem da plataforma (peças livres). Insumos: o Tiny (nunca negativo). */
  em_estoque: number | null
  /**
   * Reservados em venda: prontos separados para pedidos — reservadas no galpão
   * + no aguardo + na ROTAS até a entrega (D-118).
   */
  reservados_venda: number
  /** D-78: das reservadas em venda, as que ainda estão no galpão. A contagem é física. */
  reservadas_estoque: number
  /** Em produção agora: o que vem para o estoque + os móveis de pedidos (resposta 6). */
  reservados_producao: number
  /** SESSAO-31 (D-129): peças devolvidas esperando a decisão da logística. */
  em_devolucao: number
  /** Abaixo do mínimo já contando o que vem para o estoque (a régua da necessidade). */
  em_necessidade: boolean
  /** Quanto falta produzir para voltar ao mínimo (a proposta do lançamento manual). */
  repor_sugerido: number
  /** A bolinha vermelha (D-86): o card do pedido que espera a decisão do PCP. */
  pendente_card_id: number | null
  pendente_pedido_numero: number | null
  /** Último saldo lido do Tiny (cru — pode ser negativo). Só referência nos acabados. */
  saldo_tiny: number | null
  lido_em: string | null
  origem_leitura: string | null
  reposicao_estado: EstadoReposicao | null
  contagem_total: number
}

const numeroOuNulo = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export async function listarEstoqueProdutos(parametros: {
  grupo: GrupoEstoque
  busca?: string
  filtro?: FiltroEstoque | null
  limite?: number
  deslocamento?: number
}): Promise<LinhaEstoqueProduto[]> {
  const { data, error } = await supabase.rpc('plt_fn_estoque_produtos', {
    p_grupo: parametros.grupo,
    p_busca: parametros.busca?.trim() || null,
    p_filtro: parametros.filtro ?? null,
    p_limite: parametros.limite ?? 20,
    p_deslocamento: parametros.deslocamento ?? 0,
  })
  // numeric chega como texto do PostgREST — vira número aqui, num lugar só.
  return garantir(
    data as LinhaEstoqueProduto[] | null,
    error,
    'Não deu para carregar o estoque',
  ).map((l) => ({
    ...l,
    vendidos_90d: Number(l.vendidos_90d ?? 0),
    cortes: Number(l.cortes ?? 0),
    minimo: numeroOuNulo(l.minimo),
    minimo_tiny: numeroOuNulo(l.minimo_tiny),
    sugestao: numeroOuNulo(l.sugestao),
    em_estoque: numeroOuNulo(l.em_estoque),
    reservados_venda: Number(l.reservados_venda ?? 0),
    reservadas_estoque: Number(l.reservadas_estoque ?? 0),
    reservados_producao: Number(l.reservados_producao ?? 0),
    em_devolucao: Number(l.em_devolucao ?? 0),
    repor_sugerido: Number(l.repor_sugerido ?? 0),
    pendente_card_id: numeroOuNulo(l.pendente_card_id),
    pendente_pedido_numero: numeroOuNulo(l.pendente_pedido_numero),
    saldo_tiny: numeroOuNulo(l.saldo_tiny),
    contagem_total: Number(l.contagem_total ?? 0),
  }))
}

/** O que a logística faz com a contagem de um produto acabado. */
export type OperacaoEstoque = 'entrada' | 'baixa' | 'contagem'

/**
 * Entrada, baixa ou contagem manual (D-70). O banco cria/arquiva as peças por
 * evento (a baixa leva as mais antigas) e devolve quantas ficaram.
 */
export async function movimentarEstoque(parametros: {
  produtoTinyId: number
  operacao: OperacaoEstoque
  quantidade: number
  observacao?: string
}): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_estoque_movimentar', {
    p_produto_tiny_id: parametros.produtoTinyId,
    p_operacao: parametros.operacao,
    p_quantidade: parametros.quantidade,
    p_observacao: parametros.observacao?.trim() || null,
  })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

// ---------------------------------------------------------------------------
// Configurações do estoque (↪️ 30/09 — D-83/D-84): Top X, cobertura por dias
// úteis de venda, corte de pedido fora do comum e o mínimo AUTOMÁTICO (editar
// trava; "voltar ao automático" solta). A capacidade do galpão saiu de uso.
// ---------------------------------------------------------------------------

export interface LinhaConfiguracaoEstoque {
  tiny_id: number
  codigo: string | null
  descricao: string
  imagem_caminho: string | null
  posicao: number | null
  vendidos_90d: number
  /** Linhas de pedido fora do comum que saíram da conta. */
  cortes: number
  /** Dentro do Top X? Fora dele não há mínimo nem sugestão (D-83). */
  no_top: boolean
  media_semana: number
  minimo: number | null
  minimo_tiny: number | null
  /** true = editado à mão (não acompanha a sugestão). */
  minimo_travado: boolean
  /** Nulo = fora do Top X (sem sugestão). */
  sugestao: number | null
  em_estoque: number
  contagem_total: number
}

export async function listarConfiguracoesEstoque(parametros: {
  busca?: string
  limite?: number
  deslocamento?: number
}): Promise<LinhaConfiguracaoEstoque[]> {
  const { data, error } = await supabase.rpc('plt_fn_estoque_configuracoes', {
    p_busca: parametros.busca?.trim() || null,
    p_limite: parametros.limite ?? 20,
    p_deslocamento: parametros.deslocamento ?? 0,
  })
  return garantir(
    data as LinhaConfiguracaoEstoque[] | null,
    error,
    'Não deu para carregar as configurações do estoque',
  ).map((l) => ({
    ...l,
    vendidos_90d: Number(l.vendidos_90d ?? 0),
    cortes: Number(l.cortes ?? 0),
    media_semana: Number(l.media_semana ?? 0),
    minimo: numeroOuNulo(l.minimo),
    minimo_tiny: numeroOuNulo(l.minimo_tiny),
    sugestao: numeroOuNulo(l.sugestao),
    em_estoque: Number(l.em_estoque ?? 0),
    contagem_total: Number(l.contagem_total ?? 0),
  }))
}

/** O resumo do galpão remodelado (pedido do dono, 30/09): seis números. */
export interface ResumoEstoque {
  /** Móveis livres no galpão (a contagem). */
  moveis_estoque: number
  /** Matéria-prima e insumos contados por unidade (o que o Tiny informa). */
  pecas_unidades: number
  /** Matéria-prima e insumos medidos em m². */
  pecas_m2: number
  /** Prontos separados para pedidos (em aguardo + reservados no galpão). */
  moveis_reservados: number
  /** Sendo produzido SEM dono, a caminho do estoque. */
  pecas_producao: number
  /** Sendo produzido PARA pedidos. */
  moveis_producao: number
  soma_minimos: number
  produtos_abaixo: number
  /** SESSAO-31 (D-129): móveis em decisão pós devolução. */
  moveis_em_devolucao: number
}

export async function resumoEstoque(): Promise<ResumoEstoque | null> {
  const { data, error } = await supabase.rpc('plt_fn_estoque_resumo')
  const linhas = garantir(
    data as ResumoEstoque[] | null,
    error,
    'Não deu para carregar o resumo do estoque',
  )
  const r = linhas[0]
  if (!r) return null
  return {
    moveis_estoque: Number(r.moveis_estoque ?? 0),
    pecas_unidades: Number(r.pecas_unidades ?? 0),
    pecas_m2: Number(r.pecas_m2 ?? 0),
    moveis_reservados: Number(r.moveis_reservados ?? 0),
    pecas_producao: Number(r.pecas_producao ?? 0),
    moveis_producao: Number(r.moveis_producao ?? 0),
    soma_minimos: Number(r.soma_minimos ?? 0),
    produtos_abaixo: Number(r.produtos_abaixo ?? 0),
    moveis_em_devolucao: Number(r.moveis_em_devolucao ?? 0),
  }
}

/** As configurações do estoque num pacote só (uma requisição — regra 17). */
export interface ConfigEstoque {
  top_x: number
  cobertura_semanas: number
  corte_pedido_grande: number
  dias_uteis_venda: number
}

export async function configEstoque(): Promise<ConfigEstoque | null> {
  const { data, error } = await supabase.rpc('plt_fn_estoque_config')
  if (error) throw new Error(`Não deu para carregar as configurações: ${error.message}`)
  return (data as ConfigEstoque | null) ?? null
}

/** Top X (1–50): o tamanho da página e quem tem mínimo — valor único da equipe. */
export async function definirTopX(topX: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_estoque_definir_top_x', { p_top_x: topX })
  if (error) throw new Error(error.message)
}

/** Cobertura da sugestão (1–8 semanas) — recalcula os mínimos automáticos. */
export async function definirCobertura(semanas: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_estoque_definir_cobertura', { p_semanas: semanas })
  if (error) throw new Error(error.message)
}

/** Corte de pedido fora do comum (Painel admin, só admin). */
export async function definirCorte(quantidade: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_estoque_definir_corte', { p_quantidade: quantidade })
  if (error) throw new Error(error.message)
}

/** Mínimo editado à mão: grava e TRAVA (deixa de acompanhar a sugestão). */
export async function definirMinimo(produtoTinyId: number, minimo: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_estoque_definir_minimo', {
    p_produto_tiny_id: produtoTinyId,
    p_minimo: minimo,
  })
  if (error) throw new Error(error.message)
}

/** "Voltar ao automático": destrava e alinha à sugestão do dia. */
export async function minimoAutomatico(produtoTinyId: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_estoque_minimo_automatico', {
    p_produto_tiny_id: produtoTinyId,
  })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Reposição automática (D-87): liga/desliga = agendar/desagendar a rotina no
// banco (desligada, nada roda). Desligada, a logística lança à mão.
// ---------------------------------------------------------------------------

export async function situacaoReposicao(): Promise<{ ligada: boolean }> {
  const { data, error } = await supabase.rpc('plt_fn_estoque_reposicao_situacao')
  if (error) throw new Error(`Não deu para ver a reposição automática: ${error.message}`)
  return { ligada: Boolean((data as { ligada?: boolean } | null)?.ligada) }
}

export async function ligarReposicao(): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_estoque_reposicao_ligar')
  if (error) throw new Error(error.message)
}

export async function desligarReposicao(): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_estoque_reposicao_desligar')
  if (error) throw new Error(error.message)
}

/** "Lançar para produção" (manual, com a automática desligada): cria a reposição no PCP. */
export async function lancarReposicao(produtoTinyId: number, quantidade: number): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_estoque_lancar_reposicao', {
    p_produto_tiny_id: produtoTinyId,
    p_quantidade: quantidade,
  })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

// ---------------------------------------------------------------------------
// Estoque × Tiny (D-76…D-80): a plataforma e o Tiny mostrando o mesmo número.
// Quem faz o trabalho é o n8n (um fluxo só); aqui só a chave (admin) e a
// situação — o que está na fila, o que parou e os últimos ajustes gravados.
// ---------------------------------------------------------------------------

export interface ProdutoParadoTiny {
  sku: string | null
  descricao: string
  erro: string | null
  desde: string
}

export interface AjusteTiny {
  sku?: string
  deposito?: string
  tiny_antes?: number
  tiny_depois?: number
  em: string
}

export interface SituacaoTiny {
  /** Nulo = desligado. */
  ligado_desde: string | null
  na_fila: number
  parados: ProdutoParadoTiny[]
  ultima_leitura_em: string | null
  ultimos_ajustes: AjusteTiny[]
}

export async function situacaoTiny(): Promise<SituacaoTiny | null> {
  const { data, error } = await supabase.rpc('plt_fn_tiny_estoque_situacao')
  if (error) throw new Error(`Não deu para ver o sincronismo com o Tiny: ${error.message}`)
  if (!data) return null
  const s = data as SituacaoTiny
  return {
    ...s,
    na_fila: Number(s.na_fila ?? 0),
    parados: s.parados ?? [],
    ultimos_ajustes: s.ultimos_ajustes ?? [],
  }
}

/** Liga (admin): o ponto de partida copia o saldo do Tiny uma vez, produto a produto. */
export async function ligarSincronismoTiny(): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_tiny_estoque_ligar')
  if (error) throw new Error(error.message)
  return Number((data as { produtos_para_copiar?: number } | null)?.produtos_para_copiar ?? 0)
}

export async function desligarSincronismoTiny(): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_tiny_estoque_desligar')
  if (error) throw new Error(error.message)
}

/**
 * Reserva presa no Tiny (↪️ D-76, pedido do dono em 30/09): o Tiny reserva
 * mais do que há de pedido aberto — a sobra é reserva de pedido que já saiu e
 * derruba o "disponível multiempresa". A equipe limpa lá; aqui só a lista.
 */
export interface ReservaPresaTiny {
  tiny_id: number
  codigo: string | null
  descricao: string
  saldo_tiny: number
  reservado_tiny: number
  pedidos_abertos: number
  presas: number
  lido_em: string
  contagem_total: number
  total_presas: number
}

export async function listarReservasPresasTiny(opcoes: {
  limite: number
  deslocamento: number
}): Promise<ReservaPresaTiny[]> {
  const { data, error } = await supabase.rpc('plt_fn_tiny_reservas_presas', {
    p_limite: opcoes.limite,
    p_deslocamento: opcoes.deslocamento,
  })
  const linhas = garantir(
    data as ReservaPresaTiny[] | null,
    error,
    'Não deu para ver as reservas presas no Tiny',
  )
  return linhas.map((l) => ({
    ...l,
    saldo_tiny: Number(l.saldo_tiny),
    reservado_tiny: Number(l.reservado_tiny),
    pedidos_abertos: Number(l.pedidos_abertos),
    presas: Number(l.presas),
    contagem_total: Number(l.contagem_total),
    total_presas: Number(l.total_presas),
  }))
}

// ---------------------------------------------------------------------------
// Foto do produto (D-73): a capa mora na biblioteca por SKU que o tablet já usa
// (`produtos/{sku}/…`, D-28); o caminho fica no catálogo — a lista traz o
// caminho numa consulta só, sem listar o storage cartão a cartão (regra 17).
// ---------------------------------------------------------------------------

const BUCKET_IMAGENS = 'plt-imagens'

export function urlFotoProduto(caminho: string | null): string | null {
  if (!caminho) return null
  return supabase.storage.from(BUCKET_IMAGENS).getPublicUrl(caminho).data.publicUrl
}

export async function enviarFotoProduto(
  produto: { tiny_id: number; codigo: string | null },
  arquivo: Blob,
  extensao: string,
): Promise<string> {
  const pasta = produto.codigo ? pastaDoProduto(produto.codigo) : `produtos/tiny-${produto.tiny_id}`
  const caminho = `${pasta}/capa-${Date.now()}.${extensao}`
  const { error: erroEnvio } = await supabase.storage
    .from(BUCKET_IMAGENS)
    .upload(caminho, arquivo, {
      contentType: arquivo.type || 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    })
  if (erroEnvio) throw new Error('Não consegui enviar a foto. Tente de novo ou use outra imagem.')
  const { error } = await supabase.rpc('plt_fn_estoque_definir_imagem', {
    p_produto_tiny_id: produto.tiny_id,
    p_caminho: caminho,
  })
  if (error) throw new Error(`A foto subiu, mas não consegui gravá-la no produto: ${error.message}`)
  return caminho
}

/**
 * As PEÇAS paradas no ESTOQUE (SESSAO-15, evoluída na SESSAO-25): reservadas
 * (com pedido — as duas etiquetas, SKU + pedido) e livres (sem pedido — da
 * reposição). O ID é o SKU (resposta do dono na Q-63).
 */
export interface PecaEstoque {
  card_id: number
  dono: 'pedido' | 'livre'
  pedido_id: number | null
  numero: number | null
  item_codigo: string | null
  item_descricao: string | null
  indice_unidade: number | null
  total_unidades: number | null
  produto_tiny_id: number | null
  reposicao_card_id: number | null
  /**
   * SESSAO-24: 'cancelamento' = a peça perdeu o pedido (cancelado no Tiny).
   * Ajuste de 28/09: 'manual' = cadastrada pela logística (entrada/contagem).
   */
  origem: 'pedido' | 'reposicao' | 'cancelamento' | 'manual'
  /** SESSAO-24: o número do pedido cancelado de onde a peça sem dono veio. */
  origem_numero: number | null
  /** SESSAO-24: onde a peça está — 'estoque' (sem dono) ou 'aguardo' (reservada). */
  local: 'estoque' | 'aguardo'
  qualidade_atual: Estado | null
  desde: string | null
  /** D-78: peça livre do ESTOQUE reservada por uma venda — o número do pedido. */
  reservada_numero: number | null
  contagem_total: number
}

export async function listarPecasEstoque(parametros: {
  produtoTinyId?: number | null
  dono?: 'pedido' | 'livre' | null
  busca?: string
  limite?: number
  deslocamento?: number
}): Promise<PecaEstoque[]> {
  const { data, error } = await supabase.rpc('plt_fn_estoque', {
    p_busca: parametros.busca || null,
    p_limite: parametros.limite ?? 20,
    p_deslocamento: parametros.deslocamento ?? 0,
    p_produto_tiny_id: parametros.produtoTinyId ?? null,
    p_dono: parametros.dono ?? null,
  })
  return garantir(data as PecaEstoque[] | null, error, 'Não deu para carregar as peças do estoque')
}

/**
 * SESSAO-30 (raio-x 6): a peça livre no ESTOQUE FORA DO CATÁLOGO (a
 * personalizada e a de SKU que não está no catálogo, de pedido cancelado — não
 * entra em número de produto). Lista própria por cursor e baixa com motivo.
 */
export interface PecaPersonalizada {
  card_id: number
  item_codigo: string | null
  item_descricao: string | null
  /** O pedido cancelado de onde a peça veio. */
  origem_numero: number | null
  desde: string | null
  tem_mais: boolean
}

export async function listarPecasPersonalizadas(parametros: {
  antesId?: number | null
  limite?: number
}): Promise<PecaPersonalizada[]> {
  const { data, error } = await supabase.rpc('plt_fn_estoque_personalizadas', {
    p_antes_id: parametros.antesId ?? null,
    p_limite: parametros.limite ?? 20,
  })
  return garantir(
    data as PecaPersonalizada[] | null,
    error,
    'Não deu para carregar as peças personalizadas',
  )
}

export async function baixarPecaPersonalizada(cardId: number, observacao: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_estoque_baixar_personalizada', {
    p_card_id: cardId,
    p_observacao: observacao,
  })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Expedição (SESSAO-38 · D-157): a tela que absorveu "Pedidos em aguardo" —
// os pedidos VIVOS (a mesma regra das rotas), com os números dos filtros na
// MESMA requisição da página (Lei §2/§6: paginação e filtro no servidor).
// ---------------------------------------------------------------------------

/** Os filtros da Expedição (os quadradinhos do topo). */
export type FiltroExpedicao = 'todos' | 'com_rota' | 'sem_rota' | 'prontos' | 'em_producao'

/** pronto · em produção (alguma peça liberada) · no PCP (nada liberado ainda). */
export type EstadoPedidoVivo = 'pronto' | 'em_producao' | 'no_pcp'

export interface PedidoExpedicao {
  card_id: number
  pedido_id: number
  numero: number
  cliente_nome: string
  data_prevista: string | null
  situacao: string | null
  /** As peças do pedido (o frete não conta — D-63). */
  total_unidades: number
  /** O que falta entregar (na reentrega, só o que voltou — D-130). */
  a_entregar: number
  unidades_liberadas: number
  /** No fim de linha (Pedidos em aguardo ou ROTAS). */
  unidades_prontas: number
  pronto: boolean
  estado: EstadoPedidoVivo
  /** Quando a 1ª peça ficou pronta (D-48). */
  primeira_pronta_em: string | null
  /** Quando o pedido ficou completo. */
  completo_em: string | null
  /** Lançado para ROTAS no jeito antigo (as peças estão na ROTAS). */
  lancado: boolean
  /** As peças voltaram e esperam a decisão da logística (D-129). */
  em_devolucao: boolean
  /** SESSAO-38 (D-171): segurado pelo PCP — fica na Expedição com a marca, fora das rotas. */
  standby?: { desde: string; motivo: string | null } | null
  alterado_apos_liberacao: boolean
  programacao: {
    data: string
    caminhao_id: number
    caminhao_nome: string | null
    caminhao_placa: string | null
    rota: number
  } | null
}

export interface ContagensExpedicao {
  todos: number
  com_rota: number
  sem_rota: number
  prontos: number
  em_producao: number
}

export interface PaginaExpedicao {
  filtro: FiltroExpedicao
  contagens: ContagensExpedicao
  /** Quantos o filtro (com a busca) tem — para a paginação. */
  total: number
  itens: PedidoExpedicao[]
}

export async function listarExpedicao(parametros: {
  filtro: FiltroExpedicao
  busca?: string
  limite?: number
  deslocamento?: number
}): Promise<PaginaExpedicao> {
  const { data, error } = await supabase.rpc('plt_fn_expedicao', {
    p_filtro: parametros.filtro,
    p_busca: parametros.busca?.trim() || null,
    p_limite: parametros.limite ?? 20,
    p_deslocamento: parametros.deslocamento ?? 0,
  })
  return garantir(data as PaginaExpedicao | null, error, 'Não deu para carregar a Expedição')
}

/**
 * SESSAO-24 — "Produtos reservados" (a2 do dono), que veio de Pedidos em
 * aguardo para a Expedição (SESSAO-38): cada peça pronta de pedido, com o
 * pedido, o produto e o tempo esperando a entrega.
 */
export interface ProdutoReservado {
  card_id: number
  card_pedido_id: number
  pedido_id: number
  numero: number
  cliente_nome: string
  situacao: string | null
  item_codigo: string | null
  item_descricao: string | null
  indice_unidade: number | null
  total_unidades: number | null
  /** 'aguardo' normalmente; 'estoque'/'rotas' só em peça antiga. */
  local: string | null
  qualidade_atual: Estado | null
  /** Quando ficou pronta (chegou ao fim de linha) — o começo do tempo em aguardo. */
  pronta_em: string | null
  /** A unidade nasceu de uma peça do estoque (alocação), não da produção. */
  veio_do_estoque: boolean
  pedido_completo: boolean
  contagem_total: number
}

export async function listarProdutosReservados(parametros: {
  busca?: string
  limite?: number
  deslocamento?: number
}): Promise<ProdutoReservado[]> {
  const { data, error } = await supabase.rpc('plt_fn_produtos_reservados', {
    p_busca: parametros.busca || null,
    p_limite: parametros.limite ?? 20,
    p_deslocamento: parametros.deslocamento ?? 0,
  })
  return garantir(
    data as ProdutoReservado[] | null,
    error,
    'Não deu para carregar os produtos reservados',
  )
}

// ↩️ SESSAO-38 (D-156): "Lançar para ROTAS" deixou de ser passo — qualquer
// pedido vivo se programa direto na Programação; as contagens das abas do
// aguardo viraram os números dos filtros da Expedição.

// ---------------------------------------------------------------------------
// Danificados (D-38/D-45)
// ---------------------------------------------------------------------------

export interface Danificado {
  card_id: number
  /** Nulo na peça da REPOSIÇÃO de estoque (SESSAO-25). */
  pedido_id: number | null
  numero: number | null
  item_codigo: string | null
  item_descricao: string | null
  indice_unidade: number | null
  total_unidades: number | null
  setor_id: number
  setor_nome: string
  etapa_nome: string
  qualidade_atual: Estado | null
  desde: string | null
  arquivado_em: string | null
  /** O setor que entregou a peça marcada (D-09). */
  origem_setor_nome: string | null
  marcacao_estado: Estado | null
  marcacao_por: string | null
  marcacao_obs: string | null
  marcado_em: string | null
  parecer_estado: Estado | null
  parecer_por: string | null
  parecer_obs: string | null
  contagem_total: number
}

export async function listarDanificados(parametros: {
  arquivados?: boolean
  busca?: string
  limite?: number
  deslocamento?: number
}): Promise<Danificado[]> {
  const { data, error } = await supabase.rpc('plt_fn_danificados', {
    p_arquivados: parametros.arquivados ?? false,
    p_busca: parametros.busca || null,
    p_limite: parametros.limite ?? 20,
    p_deslocamento: parametros.deslocamento ?? 0,
  })
  return garantir(data as Danificado[] | null, error, 'Não deu para carregar os danificados')
}

/**
 * Resolvido → destino (D-45): Estoque, ROTAS ou qualquer setor. Para OUTRO
 * setor o estado é obrigatório (o banco recusa sem ele); no mesmo setor é só
 * mudança de etapa.
 */
export async function resolverDanificado(parametros: {
  cardId: number
  destinoSetorId: number
  destinoEtapaId?: number | null
  estado?: Estado | null
  observacao?: string
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_resolver_danificado', {
    p_card_id: parametros.cardId,
    p_setor_destino_id: parametros.destinoSetorId,
    // `|| null`: id 0/NaN nunca é etapa válida.
    p_etapa_destino_id: parametros.destinoEtapaId || null,
    p_estado_qualidade: parametros.estado ?? null,
    p_observacao: parametros.observacao?.trim() || null,
  })
  if (error) throw new Error(`Não deu para resolver: ${error.message}`)
}

/** Arquivar (exclusão lógica): sai da lista, fica na história. */
export async function arquivarCard(cardId: number, observacao?: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_arquivar_card', {
    p_card_id: cardId,
    p_observacao: observacao?.trim() || null,
  })
  if (error) throw new Error(`Não deu para arquivar: ${error.message}`)
}
