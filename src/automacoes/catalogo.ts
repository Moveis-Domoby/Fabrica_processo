/**
 * O catálogo das automações (SESSAO-27 · D-103): os blocos QUANDO (o que
 * dispara) e FAÇA (o que acontece), em língua de gente. Os códigos (`card_entrou`,
 * `mover`…) são o contrato com o banco — nunca aparecem na tela (D-27).
 */

export type Gatilho =
  | 'card_entrou'
  | 'card_iniciado'
  | 'qualidade_marcada'
  | 'card_parado'
  | 'card_arquivado'
  | 'etiqueta_posta'
  | 'etiqueta_tirada'
  | 'pedido_novo'
  | 'pedido_situacao'
  | 'chamada_externa'

export interface DefinicaoGatilho {
  valor: Gatilho
  rotulo: string
  descricao: string
  grupo: 'Cards' | 'Pedidos do Tiny' | 'De fora'
}

export const GATILHOS: DefinicaoGatilho[] = [
  {
    valor: 'card_entrou',
    rotulo: 'O card entrou numa etapa',
    descricao: 'Quando o card chega na etapa escolhida (ou em qualquer etapa do setor) — inclusive a fila.',
    grupo: 'Cards',
  },
  {
    valor: 'card_iniciado',
    rotulo: 'Alguém começou a trabalhar no card',
    descricao: 'Quando o tempo do card começa a contar (o card foi solto na etapa de início).',
    grupo: 'Cards',
  },
  {
    valor: 'qualidade_marcada',
    rotulo: 'A peça foi marcada',
    descricao: 'Quando quem entrega ou quem recebe marca a peça como perfeita, em atenção ou danificada.',
    grupo: 'Cards',
  },
  {
    valor: 'card_parado',
    rotulo: 'O card ficou parado',
    descricao:
      'Quando o card passa do tempo escolhido na mesma etapa. Conta desde a chegada ou desde que a automação foi ligada — o que for mais novo.',
    grupo: 'Cards',
  },
  {
    valor: 'card_arquivado',
    rotulo: 'O card foi arquivado',
    descricao: 'Quando alguém (ou outra automação) arquiva o card.',
    grupo: 'Cards',
  },
  {
    valor: 'etiqueta_posta',
    rotulo: 'Uma etiqueta foi posta',
    descricao: 'Quando o card ganha uma etiqueta — dá para encadear automações por etiqueta.',
    grupo: 'Cards',
  },
  {
    valor: 'etiqueta_tirada',
    rotulo: 'Uma etiqueta foi tirada',
    descricao: 'Quando o card perde uma etiqueta.',
    grupo: 'Cards',
  },
  {
    valor: 'pedido_novo',
    rotulo: 'Pedido novo do Tiny',
    descricao: 'Quando um pedido do Tiny chega e entra no PCP.',
    grupo: 'Pedidos do Tiny',
  },
  {
    valor: 'pedido_situacao',
    rotulo: 'O pedido mudou de situação',
    descricao: 'Quando a situação do pedido muda no Tiny (por exemplo, de aprovado para entregue).',
    grupo: 'Pedidos do Tiny',
  },
  {
    valor: 'chamada_externa',
    rotulo: 'Chamada de fora (n8n ou API)',
    descricao: 'Quando o n8n ou outro sistema chama esta automação pelo endereço dela, com a chave da API.',
    grupo: 'De fora',
  },
]

export const ROTULO_GATILHO = Object.fromEntries(GATILHOS.map((g) => [g.valor, g.rotulo])) as Record<
  Gatilho,
  string
>

export type TipoPasso =
  | 'mover'
  | 'arquivar'
  | 'desarquivar'
  | 'etiqueta_por'
  | 'etiqueta_tirar'
  | 'campo'
  | 'avisar'
  | 'chamar'
  | 'esperar'
  | 'se'
  | 'se_senao'

/** Os grupos da escolha do bloco, na ordem em que aparecem. */
export const GRUPOS_PASSO = ['Lógica', 'No card', 'Etiquetas e campos', 'Avisos e integrações'] as const
export type GrupoPasso = (typeof GRUPOS_PASSO)[number]

export interface DefinicaoPasso {
  valor: TipoPasso
  rotulo: string
  descricao: string
  grupo: GrupoPasso
}

export const PASSOS: DefinicaoPasso[] = [
  {
    valor: 'se_senao',
    rotulo: 'Se… senão',
    descricao: 'Duas saídas: segue pelo Sim se a condição bater; pelo Senão, se não bater.',
    grupo: 'Lógica',
  },
  { valor: 'se', rotulo: 'Só se…', descricao: 'Segue só se a condição bater; senão, a automação para aqui.', grupo: 'Lógica' },
  { valor: 'esperar', rotulo: 'Esperar um tempo', descricao: 'Espera antes de seguir para o próximo passo.', grupo: 'Lógica' },
  { valor: 'mover', rotulo: 'Mover o card', descricao: 'Leva o card para outra etapa ou setor (com as regras de sempre).', grupo: 'No card' },
  { valor: 'arquivar', rotulo: 'Arquivar o card', descricao: 'Arquiva o card — nada se apaga, a história fica.', grupo: 'No card' },
  { valor: 'desarquivar', rotulo: 'Trazer de volta', descricao: 'Traz de volta um card arquivado, para onde ele estava.', grupo: 'No card' },
  { valor: 'etiqueta_por', rotulo: 'Pôr etiqueta', descricao: 'Põe uma ou mais etiquetas no card.', grupo: 'Etiquetas e campos' },
  { valor: 'etiqueta_tirar', rotulo: 'Tirar etiqueta', descricao: 'Tira etiquetas do card (escolhidas ou todas).', grupo: 'Etiquetas e campos' },
  { valor: 'campo', rotulo: 'Preencher campo', descricao: 'Grava um valor num campo customizado (ou limpa).', grupo: 'Etiquetas e campos' },
  {
    valor: 'avisar',
    rotulo: 'Avisar no sino',
    descricao: 'Aviso no sino de uma pessoa, dos líderes, do setor ou dos admins.',
    grupo: 'Avisos e integrações',
  },
  {
    valor: 'chamar',
    rotulo: 'Chamar endereço de fora',
    descricao: 'Manda os dados do card/pedido para o n8n ou outro sistema.',
    grupo: 'Avisos e integrações',
  },
]

export const ROTULO_PASSO = Object.fromEntries(PASSOS.map((p) => [p.valor, p.rotulo])) as Record<TipoPasso, string>

/** As situações do pedido no Tiny, já normalizadas como o banco compara. */
export const SITUACOES_PEDIDO: { valor: string; rotulo: string }[] = [
  { valor: 'em_aberto', rotulo: 'Em aberto' },
  { valor: 'aprovado', rotulo: 'Aprovado' },
  { valor: 'preparando_envio', rotulo: 'Preparando envio' },
  { valor: 'faturado', rotulo: 'Faturado' },
  { valor: 'pronto_para_envio', rotulo: 'Pronto para envio' },
  { valor: 'enviado', rotulo: 'Enviado' },
  { valor: 'entregue', rotulo: 'Entregue' },
  { valor: 'nao_entregue', rotulo: 'Não entregue' },
  { valor: 'cancelado', rotulo: 'Cancelado' },
  { valor: 'dados_incompletos', rotulo: 'Dados incompletos' },
]

export function rotuloSituacaoPedido(valor: string | null | undefined): string {
  if (!valor) return 'qualquer'
  return SITUACOES_PEDIDO.find((s) => s.valor === valor)?.rotulo ?? valor.replace(/_/g, ' ')
}

export const ESTADOS_PECA: { valor: 'perfeito' | 'atencao' | 'danificado'; rotulo: string }[] = [
  { valor: 'perfeito', rotulo: 'Perfeito estado' },
  { valor: 'atencao', rotulo: 'Estado de atenção' },
  { valor: 'danificado', rotulo: 'Danificado' },
]

export const CONDICOES: { valor: string; rotulo: string }[] = [
  { valor: 'tem_etiqueta', rotulo: 'o card tem a etiqueta' },
  { valor: 'nao_tem_etiqueta', rotulo: 'o card não tem a etiqueta' },
  { valor: 'campo_igual', rotulo: 'o campo é igual a' },
  { valor: 'campo_preenchido', rotulo: 'o campo está preenchido' },
  { valor: 'campo_vazio', rotulo: 'o campo está vazio' },
  { valor: 'no_setor', rotulo: 'o card está no setor' },
  { valor: 'situacao_pedido', rotulo: 'a situação do pedido é' },
  { valor: 'tipo_card', rotulo: 'o card é' },
]

export const TIPOS_CARD: { valor: string; rotulo: string }[] = [
  { valor: 'unidade', rotulo: 'uma peça' },
  { valor: 'pedido', rotulo: 'o card do pedido (PCP)' },
  { valor: 'reposicao', rotulo: 'uma reposição de estoque' },
]

export const DESTINOS_AVISO: { valor: string; rotulo: string }[] = [
  { valor: 'lideres', rotulo: 'Os líderes do setor' },
  { valor: 'setor', rotulo: 'Todos do setor' },
  { valor: 'admins', rotulo: 'Os admins' },
  { valor: 'pessoa', rotulo: 'Uma pessoa' },
]

export const ROTULO_SITUACAO_EXECUCAO: Record<string, string> = {
  rodando: 'Rodando',
  esperando: 'Esperando',
  concluida: 'Concluída',
  parou: 'Parou',
  falhou: 'Falhou',
  ignorada: 'Ignorada',
  barrada: 'Barrada no limite',
}

export const ROTULO_RESULTADO_PASSO: Record<string, string> = {
  feito: 'feito',
  pulou: 'não precisou',
  falhou: 'falhou',
  esperando: 'esperando',
  bateu: 'condição bateu',
  nao_bateu: 'condição não bateu',
  sim: 'condição bateu',
  senao: 'condição não bateu',
}
