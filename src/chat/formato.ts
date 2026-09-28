/**
 * Formatos do chat (SESSAO-26) — puros, testados no Vitest. Datas no fuso de
 * Natal (America/Fortaleza), como o resto da plataforma.
 */
const FUSO = 'America/Fortaleza'

function diaLocal(data: Date): string {
  return data.toLocaleDateString('en-CA', { timeZone: FUSO }) // AAAA-MM-DD
}

function diferencaEmDias(de: Date, ate: Date): number {
  const [a, b] = [diaLocal(de), diaLocal(ate)].map((d) => Date.parse(`${d}T00:00:00Z`))
  return Math.round((b - a) / 86_400_000)
}

/** Na lista: "14:32" hoje, "ontem", ou "27/09". */
export function horaNaLista(iso: string, agora = new Date()): string {
  const data = new Date(iso)
  const dias = diferencaEmDias(data, agora)
  if (dias <= 0) {
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO })
  }
  if (dias === 1) return 'ontem'
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: FUSO })
}

/** Na bolha: "14:32". */
export function horaDaMensagem(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSO,
  })
}

/** O separador entre dias da conversa: "Hoje", "Ontem" ou "27/09/2026". */
export function rotuloDoDia(iso: string, agora = new Date()): string {
  const data = new Date(iso)
  const dias = diferencaEmDias(data, agora)
  if (dias <= 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: FUSO,
  })
}

/** A chave do dia (para agrupar as mensagens). */
export function chaveDoDia(iso: string): string {
  return diaLocal(new Date(iso))
}

/** A prévia da lista: "Você: …" / "Ana: …" (primeiro nome) / só o texto na particular. */
export function previaDaConversa(parametros: {
  tipo: 'canal' | 'particular' | 'avisos'
  texto: string | null
  autorId: string | null
  autorNome: string | null
  eu: string
}): string {
  const { tipo, texto, autorId, autorNome, eu } = parametros
  if (!texto) return tipo === 'particular' ? '' : 'Nenhuma mensagem ainda'
  if (autorId === eu) return `Você: ${texto}`
  if (tipo === 'particular') return texto
  const primeiroNome = (autorNome ?? 'Sistema').split(' ')[0]
  return `${primeiroNome}: ${texto}`
}

/** Iniciais para o avatar sem foto: "Wallace Cauan" → "WC". */
export function iniciais(nome: string | null | undefined): string {
  return (nome ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('')
}
