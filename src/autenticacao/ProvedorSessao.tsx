import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { aplicarTema, ehTema } from '@/perfil/tema'
import { ContextoSessao } from './sessao-contexto'
import { abrirPlataforma, semearCache } from './abertura'
import { COLUNAS_PERFIL } from './tipos'
import { ehModoTablet, esquecerAtividade, marcarAtividade, passouDoTempo } from './inatividade'
import type { Perfil, VinculoSetor } from './tipos'

interface PerfilCarregado {
  perfil: Perfil | null
  vinculos: VinculoSetor[]
}

/**
 * O caminho de RESERVA (as duas leituras de antes da SESSAO-32): só quando a
 * porta de abertura falha — um defeito numa parte secundária dela (o chat, as
 * metas…) nunca pode trancar a pessoa fora da plataforma. As telas, então,
 * leem o que é delas como sempre.
 */
async function buscarPerfilReserva(idAuth: string): Promise<PerfilCarregado> {
  const { data: linha, error } = await supabase
    .from('plt_usuarios')
    .select(COLUNAS_PERFIL)
    .eq('auth_user_id', idAuth)
    .eq('ativo', true)
    .maybeSingle()
  if (error) throw new Error(`Não deu para carregar o seu perfil: ${error.message}`)
  const perfil = (linha as Perfil | null) ?? null
  if (!perfil) return { perfil: null, vinculos: [] }
  const { data: linhas } = await supabase
    .from('plt_usuario_setores')
    .select('setor_id, lider_do_setor, setor:plt_setores(id, nome, codigo)')
    .eq('usuario_id', perfil.id)
  return { perfil, vinculos: (linhas as unknown as VinculoSetor[]) ?? [] }
}

/**
 * Mantém a sessão do Supabase e o perfil da plataforma (plt_usuarios) juntos.
 * Sessão de auth SEM perfil ativo = conta sem aprovação → não acessa nada
 * (a guarda mostra a tela de bloqueio; o RLS já não devolveria nada mesmo).
 */
export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [sessaoResolvida, setSessaoResolvida] = useState(false)
  const clienteQuery = useQueryClient()
  // A 1ª leitura de cada login é a ABERTURA (SESSAO-32 · Lei §2): tudo o que a
  // 1ª tela mostra numa requisição, semeado no cache com as chaves das telas.
  // As seguintes (recarregar o perfil depois de editar) não repetem a rota.
  const abertoPara = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setSessaoResolvida(true)
    })
    const { data: escuta } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      // Saiu (ou a sessão venceu): nada guardado de quem saiu fica para quem
      // entrar depois no mesmo aparelho, e a próxima entrada é abertura de novo
      // (o perfil é guardado sem prazo — SESSAO-32).
      if (evento === 'SIGNED_OUT') {
        abertoPara.current = null
        clienteQuery.clear()
        esquecerAtividade()
      }
      setSessao(novaSessao)
      setSessaoResolvida(true)
    })
    return () => escuta.subscription.unsubscribe()
  }, [clienteQuery])

  const idAuth = sessao?.user.id ?? null

  const consultaPerfil = useQuery({
    queryKey: ['perfil', idAuth],
    queryFn: async (): Promise<PerfilCarregado> => {
      if (!idAuth) return { perfil: null, vinculos: [] }
      const primeira = abertoPara.current !== idAuth
      abertoPara.current = idAuth
      try {
        const abertura = await abrirPlataforma(primeira)
        semearCache(clienteQuery, abertura, primeira)
        return { perfil: abertura.perfil ?? null, vinculos: abertura.vinculos ?? [] }
      } catch (erro) {
        console.error(erro)
        return buscarPerfilReserva(idAuth)
      }
    },
    enabled: sessaoResolvida,
    // O perfil só muda por gesto (Meu Perfil, tema) — quem muda relê.
    staleTime: Infinity,
    refetchOnReconnect: false,
  })

  const recarregarPerfil = useCallback(async () => {
    await consultaPerfil.refetch()
  }, [consultaPerfil])

  // A presença ("logado agora" — D-34) deixou de ser relógio (SESSAO-32 · Lei
  // §4): a abertura, cada navegação e cada gesto com fato carimbam no banco.

  // O tema escolhido no Meu Perfil (SESSAO-13) segue a pessoa: quando o perfil
  // chega, ele manda — inclusive num navegador que nunca a viu.
  const temaPerfil = consultaPerfil.data?.perfil?.tema ?? null
  useEffect(() => {
    if (temaPerfil && ehTema(temaPerfil)) aplicarTema(temaPerfil)
  }, [temaPerfil])

  const encerrar = useCallback(async (contexto: Record<string, string>) => {
    // A saída também fica na trilha (SESSAO-29 · D-95 — a auditoria): registra
    // ANTES do signOut, enquanto a sessão existe. Sair nunca espera mais que 2 s.
    try {
      await Promise.race([
        supabase.rpc('plt_fn_registrar_log', {
          p_acao: 'saiu',
          p_rota: null,
          p_contexto: contexto,
        }),
        new Promise((resolver) => setTimeout(resolver, 2000)),
      ])
    } catch {
      // registrar nunca impede a pessoa de sair
    }
    // SESSAO-41 (D-189): sair encerra SÓ este aparelho. O padrão da biblioteca
    // ("global") derrubava a conta em todos — o "Sair" de um tablet do setor
    // tirava os outros tablets do mesmo setor.
    await supabase.auth.signOut({ scope: 'local' })
  }, [])
  const sair = useCallback(() => encerrar({}), [encerrar])

  // Tempo parado (SESSAO-32 · D-137): 8 h no escritório — passou, entra de
  // novo. Sem relógio: a conta é feita ao abrir, a cada gesto (toque, tecla) e
  // ao voltar à aba; o gesto guarda o "agora" no aparelho. ↩️ SESSAO-41 (D-189):
  // a conta de tablet de um setor nunca sai por tempo.
  const contaTablet = consultaPerfil.data?.perfil?.conta_tablet === true
  useEffect(() => {
    if (!idAuth || contaTablet) return
    let saindo = false
    const conferir = () => {
      if (saindo) return true
      const { passou, limiteH } = passouDoTempo()
      if (!passou) return false
      saindo = true
      void encerrar({ motivo: `ficou parado mais de ${limiteH} h` })
      return true
    }
    if (conferir()) return
    marcarAtividade(ehModoTablet())
    const aoGesto = () => {
      if (!conferir()) marcarAtividade(ehModoTablet())
    }
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') conferir()
    }
    window.addEventListener('pointerdown', aoGesto, { capture: true, passive: true })
    window.addEventListener('keydown', aoGesto, { capture: true })
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      window.removeEventListener('pointerdown', aoGesto, { capture: true })
      window.removeEventListener('keydown', aoGesto, { capture: true })
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [idAuth, contaTablet, encerrar])

  const valor = useMemo(() => {
    const perfil = consultaPerfil.data?.perfil ?? null
    const vinculos = consultaPerfil.data?.vinculos ?? []
    const ehLider =
      perfil !== null &&
      (perfil.papel === 'admin' ||
        perfil.papel === 'lider' ||
        vinculos.some((v) => v.lider_do_setor))
    return {
      carregando: !sessaoResolvida || consultaPerfil.isPending,
      sessao,
      perfil,
      vinculos,
      ehLider,
      recarregarPerfil,
      sair,
    }
  }, [
    sessaoResolvida,
    sessao,
    consultaPerfil.data,
    consultaPerfil.isPending,
    recarregarPerfil,
    sair,
  ])

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>
}
