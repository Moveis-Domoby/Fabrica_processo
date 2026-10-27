import type { PresencaDoSetor } from '@/kanban/quadro'

/**
 * SESSAO-41 (D-189, o dono: "ele deve apenas deslogar as pessoas que estão
 * dentro do setor naquele momento depois do tempo informado"): o estado de
 * AGORA de quem está no setor, pela mesma régua do banco — sem card nenhum,
 * os 15 primeiros minutos contam como trabalhando (a carência); depois,
 * ausente; com 1 h, a pessoa sai do setor (some do ícone). A pausa da pessoa
 * (com motivo) não tem carência: ausente na hora, e sai com 1 h também.
 *
 * O banco manda o estado do momento da leitura; a tela anda com o relógio de
 * tela (`useAgora`) — nada é buscado de novo (Lei §4: sem relógio de dados).
 */
export const CARENCIA_MS = 15 * 60_000
export const SAIDA_MS = 60 * 60_000

export function presencaDeAgora(p: PresencaDoSetor, agora: number): PresencaDoSetor | null {
  const passou = agora - new Date(p.desde).getTime()
  if (p.carencia && (p.estado === 'trabalhando' || p.estado === 'ausente')) {
    if (passou >= SAIDA_MS) return null
    const estado = passou >= CARENCIA_MS ? 'ausente' : 'trabalhando'
    return estado === p.estado ? p : { ...p, estado }
  }
  if (p.estado === 'ausente' && passou >= SAIDA_MS) return null
  return p
}
