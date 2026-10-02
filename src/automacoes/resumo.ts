import { CONDICOES, DESTINOS_AVISO, ESTADOS_PECA, ROTULO_GATILHO, ROTULO_PASSO, TIPOS_CARD, rotuloSituacaoPedido } from './catalogo'
import type { Gatilho } from './catalogo'
import type { Passo } from './desenho'
import { textoDoValorCampo } from '@/utilitarios/tipos'
import type { CampoCustomizado, ValorCampo } from '@/utilitarios/tipos'

/** Os nomes que o resumo precisa — vêm dos cadastros reais (nada digitado à mão). */
export interface NomesAutomacao {
  setores: Map<number, string>
  etapas: Map<number, { nome: string; setor_id: number }>
  etiquetas: Map<number, string>
  campos: Map<number, CampoCustomizado>
  pessoas: Map<string, string>
}

export const NOMES_VAZIOS: NomesAutomacao = {
  setores: new Map(),
  etapas: new Map(),
  etiquetas: new Map(),
  campos: new Map(),
  pessoas: new Map(),
}

const num = (v: unknown): number | null => {
  const n = Number(v)
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n
}

function lugar(nomes: NomesAutomacao, setor: unknown, etapa: unknown, semSetor = 'qualquer setor'): string {
  const s = num(setor)
  const e = num(etapa)
  const nomeSetor = s !== null ? (nomes.setores.get(s) ?? 'setor removido') : semSetor
  if (e === null) return s !== null ? `${nomeSetor} (qualquer etapa)` : nomeSetor
  return `${nomeSetor} · ${nomes.etapas.get(e)?.nome ?? 'etapa removida'}`
}

function listaEtiquetas(nomes: NomesAutomacao, ids: unknown): string {
  if (!Array.isArray(ids) || ids.length === 0) return 'nenhuma escolhida'
  return ids.map((id) => nomes.etiquetas.get(Number(id)) ?? 'etiqueta removida').join(', ')
}

function tempo(quantidade: unknown, unidade: unknown): string {
  const q = num(quantidade) ?? 0
  const u = String(unidade ?? '')
  const singular: Record<string, string> = { minutos: 'minuto', horas: 'hora', dias: 'dia' }
  return `${q} ${q === 1 ? (singular[u] ?? u) : u}`
}

/** "Parado há 72 horas" vira "3 dias". */
export function horasEmTexto(horas: unknown): string {
  const h = num(horas) ?? 0
  if (h >= 24 && h % 24 === 0) return tempo(h / 24, 'dias')
  return tempo(h, 'horas')
}

/** A frase do QUANDO. */
export function resumoGatilho(gatilho: Gatilho, config: Record<string, unknown>, nomes: NomesAutomacao): string {
  switch (gatilho) {
    case 'card_entrou':
      return `O card entrou em ${lugar(nomes, config.setor_id, config.etapa_id)}`
    case 'card_iniciado':
      return `Alguém começou a trabalhar no card em ${lugar(nomes, config.setor_id, config.etapa_id)}`
    case 'qualidade_marcada': {
      const estados = Array.isArray(config.estados) ? config.estados : []
      const rotulos = ESTADOS_PECA.filter((e) => estados.includes(e.valor)).map((e) => e.rotulo.toLowerCase())
      const onde = num(config.setor_id) !== null ? ` em ${nomes.setores.get(num(config.setor_id)!) ?? 'setor removido'}` : ''
      return `A peça foi marcada como ${rotulos.join(' ou ') || '(escolha o estado)'}${onde}`
    }
    case 'card_parado':
      return `O card ficou parado ${horasEmTexto(config.horas)} em ${lugar(nomes, config.setor_id, config.etapa_id, 'qualquer setor de produção')}`
    case 'card_arquivado':
      return `O card foi arquivado${num(config.setor_id) !== null ? ` em ${nomes.setores.get(num(config.setor_id)!) ?? 'setor removido'}` : ''}`
    case 'etiqueta_posta':
    case 'etiqueta_tirada': {
      const id = num(config.etiqueta_id)
      const qual = id !== null ? `"${nomes.etiquetas.get(id) ?? 'etiqueta removida'}"` : 'qualquer etiqueta'
      return gatilho === 'etiqueta_posta' ? `O card ganhou ${qual}` : `O card perdeu ${qual}`
    }
    case 'pedido_novo':
      return 'Chegou um pedido novo do Tiny'
    case 'pedido_situacao':
      return `O pedido mudou de ${rotuloSituacaoPedido(config.de as string)} para ${rotuloSituacaoPedido(config.para as string)}`
    case 'chamada_externa':
      return 'O n8n ou outro sistema chamou esta automação'
  }
  return ROTULO_GATILHO[gatilho] ?? 'Quando…'
}

/** A frase de um FAÇA. */
export function resumoPasso(passo: Passo, nomes: NomesAutomacao): string {
  switch (passo.tipo) {
    case 'mover':
      return num(passo.setor_id) === null
        ? 'Mover — escolha o destino'
        : `Mover para ${lugar(nomes, passo.setor_id, passo.etapa_id).replace(' (qualquer etapa)', ' (a fila)')}`
    case 'arquivar':
      return 'Arquivar o card'
    case 'desarquivar':
      return 'Trazer o card de volta'
    case 'etiqueta_por':
      return `Pôr: ${listaEtiquetas(nomes, passo.etiquetas)}`
    case 'etiqueta_tirar':
      return passo.todas ? 'Tirar todas as etiquetas' : `Tirar: ${listaEtiquetas(nomes, passo.etiquetas)}`
    case 'campo': {
      const campo = nomes.campos.get(num(passo.campo_id) ?? -1)
      if (!campo) return 'Preencher — escolha o campo'
      if (passo.limpar) return `Limpar "${campo.nome}"`
      return `"${campo.nome}" = ${textoDoValorCampo(campo, passo.valor as ValorCampo)}`
    }
    case 'avisar': {
      const destino = DESTINOS_AVISO.find((d) => d.valor === passo.destino)
      if (passo.destino === 'pessoa') return `Avisar ${nomes.pessoas.get(String(passo.usuario_id)) ?? '(escolha a pessoa)'}`
      return `Avisar ${destino ? destino.rotulo.toLowerCase() : '(escolha quem)'}`
    }
    case 'chamar': {
      const url = String(passo.url ?? '')
      const host = url.split('://')[1]?.split('/')[0]
      return host ? `Chamar ${host}` : 'Chamar — escreva o endereço'
    }
    case 'esperar':
      return `Esperar ${tempo(passo.quantidade, passo.unidade)}`
    case 'se':
    case 'se_senao': {
      // o "Só se…" e o "Se… senão" testam as mesmas condições; muda só o começo da frase
      const se = passo.tipo === 'se' ? 'Só se' : 'Se'
      const condicao = CONDICOES.find((c) => c.valor === passo.condicao)
      if (!condicao) return `${ROTULO_PASSO[passo.tipo]} — escolha a condição`
      if (passo.condicao === 'tem_etiqueta' || passo.condicao === 'nao_tem_etiqueta')
        return `${se} ${condicao.rotulo} "${nomes.etiquetas.get(num(passo.etiqueta_id) ?? -1) ?? '?'}"`
      if (passo.condicao === 'campo_igual' || passo.condicao === 'campo_vazio' || passo.condicao === 'campo_preenchido') {
        const campo = nomes.campos.get(num(passo.campo_id) ?? -1)
        const nome = campo ? `"${campo.nome}"` : '(campo)'
        if (passo.condicao === 'campo_igual')
          return `${se} ${nome} for ${campo ? textoDoValorCampo(campo, passo.valor as ValorCampo) : '?'}`
        return `${se} ${nome} estiver ${passo.condicao === 'campo_vazio' ? 'vazio' : 'preenchido'}`
      }
      if (passo.condicao === 'no_setor') return `${se} o card estiver em ${lugar(nomes, passo.setor_id, passo.etapa_id)}`
      const valores = Array.isArray(passo.valores) ? (passo.valores as string[]) : []
      if (passo.condicao === 'situacao_pedido')
        return `${se} o pedido estiver ${valores.map((v) => rotuloSituacaoPedido(v)).join(' ou ') || '(escolha)'}`
      return `${se} o card for ${valores.map((v) => TIPOS_CARD.find((t) => t.valor === v)?.rotulo ?? v).join(' ou ') || '(escolha)'}`
    }
  }
  return ROTULO_PASSO[passo.tipo] ?? 'Passo'
}
