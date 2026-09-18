import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useSessao } from '@/autenticacao/sessao-contexto'
import {
  PAINEL_PADRAO,
  listarVisualizacoes,
  normalizarConfiguracao,
} from '@/dashboards/api'
import type { ConfiguracaoPainel, PeriodoDash, TelaDash, VisualizacaoSalva } from '@/dashboards/api'

/**
 * O estado do painel de cada tela de dashboard (SESSAO-16).
 *
 * Os filtros vivem na URL (?dias=7&setor=3&tempo=util&v=12): trocar de tela
 * não os perde, a visualização salva vira um link aplicável (?v=id) e a Visão
 * do dia da TV do galpão tem URL fixa e limpa. Precedência: parâmetro explícito
 * na URL > visualização selecionada > painel padrão. Mexer num filtro NÃO
 * desmarca a visualização — o gesto "Atualizar a selecionada" grava por cima.
 */
export function usePainelDash(tela: TelaDash) {
  const { perfil } = useSessao()
  const navigate = useNavigate()
  const [parametros, definirParametros] = useSearchParams()

  const { data: visualizacoes = [] } = useQuery({
    queryKey: ['visualizacoes', perfil?.id],
    queryFn: () => listarVisualizacoes(perfil!.id),
    enabled: perfil !== null,
  })

  const idSelecionada = parametros.get('v') ?? ''
  const selecionada: VisualizacaoSalva | null =
    visualizacoes.find((v) => String(v.id) === idSelecionada) ?? null

  const config: ConfiguracaoPainel = useMemo(() => {
    const base = selecionada
      ? normalizarConfiguracao(selecionada.configuracao)
      : { ...PAINEL_PADRAO, tela }
    const dias = parametros.get('dias')
    const setor = parametros.get('setor')
    const tempo = parametros.get('tempo')
    return {
      tela,
      periodoDias: dias !== null && Number(dias) > 0 ? Number(dias) : base.periodoDias,
      setorId:
        setor === null ? base.setorId : setor === 'todos' ? null : Number(setor) || null,
      tempo: tempo === 'bruto' ? 'bruto' : tempo === 'util' ? 'util' : base.tempo,
    }
  }, [selecionada, parametros, tela])

  // O relógio do painel: [agora - N dias, agora).
  const periodo: PeriodoDash = useMemo(() => {
    const ate = new Date()
    const de = new Date(ate.getTime() - config.periodoDias * 86_400_000)
    return { de: de.toISOString(), ate: ate.toISOString() }
  }, [config.periodoDias])

  function mudar(parcial: Partial<Pick<ConfiguracaoPainel, 'periodoDias' | 'setorId' | 'tempo'>>) {
    const proximos = new URLSearchParams(parametros)
    if (parcial.periodoDias !== undefined) proximos.set('dias', String(parcial.periodoDias))
    if (parcial.setorId !== undefined)
      proximos.set('setor', parcial.setorId === null ? 'todos' : String(parcial.setorId))
    if (parcial.tempo !== undefined) proximos.set('tempo', parcial.tempo)
    definirParametros(proximos, { replace: true })
  }

  /** Aplicar uma visualização leva à TELA dela, com os filtros dela. */
  function aplicarVisualizacao(id: string) {
    if (!id) {
      definirParametros(new URLSearchParams(), { replace: true })
      return
    }
    const alvo = visualizacoes.find((v) => String(v.id) === id)
    if (!alvo) return
    const cfg = normalizarConfiguracao(alvo.configuracao)
    navigate(`/dashboards/${cfg.tela}?v=${id}`)
  }

  return { perfil, config, periodo, visualizacoes, selecionada, mudar, aplicarVisualizacao }
}
