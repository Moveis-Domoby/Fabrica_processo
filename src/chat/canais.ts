import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * Os canais PRIVADOS de websocket do chat (SESSAO-26): um por tópico, com
 * contagem de quem ouve. O banco empurra (Broadcast); o navegador só ouve.
 *
 *   plt-chat-u:{pessoa}   — os sinais da pessoa (badge, lista) — 1 por login
 *   plt-chat-c:{conversa} — as mensagens de UMA conversa aberta
 *
 * Por que um registro: `supabase.channel(t)` DEVOLVE o canal que já existe com
 * aquele tópico, e sair dele é assíncrono. Fechar e reabrir a conversa (ou o
 * StrictMode montando o efeito duas vezes) reaproveitaria um canal saindo —
 * e o `subscribe` de um canal nesse estado não faz nada, calado. Aqui: quem
 * volta em até 1,5 s reaproveita o canal vivo; depois disso ele sai de fato, e
 * um canal novo só nasce quando o antigo terminou de sair.
 */
export type OuvinteCanal = (evento: string, dados: Record<string, unknown>) => void
export type OuvinteStatus = (status: string) => void

interface Entrada {
  canal: RealtimeChannel | null
  ouvintes: Set<OuvinteCanal>
  ouvintesStatus: Set<OuvinteStatus>
  status: string
  saida: ReturnType<typeof setTimeout> | null
}

const registro = new Map<string, Entrada>()
const ESPERA_ANTES_DE_SAIR = 1500

async function aguardarCanalAntigoSair(topico: string) {
  const alvo = `realtime:${topico}`
  for (let tentativa = 0; tentativa < 60; tentativa++) {
    if (!supabase.getChannels().some((c) => c.topic === alvo)) return
    await new Promise((resolver) => setTimeout(resolver, 50))
  }
}

function avisarStatus(entrada: Entrada, status: string) {
  entrada.status = status
  for (const ouvinte of entrada.ouvintesStatus) ouvinte(status)
}

async function conectar(topico: string, entrada: Entrada) {
  await aguardarCanalAntigoSair(topico)
  if (registro.get(topico) !== entrada || entrada.ouvintes.size === 0) return
  const canal = supabase.channel(topico, { config: { private: true } })
  canal.on('broadcast', { event: '*' }, (mensagem) => {
    const dados = (mensagem.payload ?? {}) as Record<string, unknown>
    for (const ouvinte of entrada.ouvintes) ouvinte(String(mensagem.event), dados)
  })
  entrada.canal = canal
  canal.subscribe((status) => avisarStatus(entrada, status))
}

/** Ouve um tópico enquanto precisar; devolve a função de parar de ouvir. */
export function ouvirCanal(
  topico: string,
  ouvinte: OuvinteCanal,
  aoStatus?: OuvinteStatus,
): () => void {
  let entrada = registro.get(topico)
  if (entrada?.saida) {
    clearTimeout(entrada.saida)
    entrada.saida = null
  }
  if (!entrada) {
    entrada = {
      canal: null,
      ouvintes: new Set(),
      ouvintesStatus: new Set(),
      status: 'CONECTANDO',
      saida: null,
    }
    registro.set(topico, entrada)
    entrada.ouvintes.add(ouvinte)
    void conectar(topico, entrada)
  } else {
    entrada.ouvintes.add(ouvinte)
  }
  if (aoStatus) {
    entrada.ouvintesStatus.add(aoStatus)
    aoStatus(entrada.status)
  }

  const minha = entrada
  return () => {
    minha.ouvintes.delete(ouvinte)
    if (aoStatus) minha.ouvintesStatus.delete(aoStatus)
    if (minha.ouvintes.size > 0 || minha.saida) return
    minha.saida = setTimeout(() => {
      minha.saida = null
      if (minha.ouvintes.size > 0) return
      registro.delete(topico)
      if (minha.canal) void supabase.removeChannel(minha.canal)
    }, ESPERA_ANTES_DE_SAIR)
  }
}

export const topicoDaPessoa = (usuarioId: string) => `plt-chat-u:${usuarioId}`
export const topicoDaConversa = (conversaId: number) => `plt-chat-c:${conversaId}`
