import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { aplicarTema, ehTema } from '@/perfil/tema'
import { ContextoSessao } from './sessao-contexto'
import { COLUNAS_PERFIL } from './tipos'
import type { Perfil, VinculoSetor } from './tipos'

interface PerfilCarregado {
  perfil: Perfil | null
  vinculos: VinculoSetor[]
}

async function buscarPerfil(idAuth: string | null): Promise<PerfilCarregado> {
  if (!idAuth) return { perfil: null, vinculos: [] }

  const { data: linha } = await supabase
    .from('plt_usuarios')
    .select(COLUNAS_PERFIL)
    .eq('auth_user_id', idAuth)
    .eq('ativo', true)
    .maybeSingle()

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setSessaoResolvida(true)
    })
    const { data: escuta } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao)
      setSessaoResolvida(true)
    })
    return () => escuta.subscription.unsubscribe()
  }, [])

  const idAuth = sessao?.user.id ?? null

  const consultaPerfil = useQuery({
    queryKey: ['perfil', idAuth],
    queryFn: () => buscarPerfil(idAuth),
    enabled: sessaoResolvida,
  })

  const recarregarPerfil = useCallback(async () => {
    await consultaPerfil.refetch()
  }, [consultaPerfil])

  // Heartbeat de presença (SESSAO-12/D-34): "logado agora" é quem foi visto
  // nos últimos minutos — é a base do sorteio de delegação. Grava no perfil
  // carregado e a cada 5 min; falha em silêncio (presença é conveniência).
  const perfilId = consultaPerfil.data?.perfil?.id ?? null
  useEffect(() => {
    if (!perfilId) return
    const marcar = () => {
      void supabase
        .from('plt_presencas')
        .upsert({ usuario_id: perfilId, visto_em: new Date().toISOString() })
        .then(() => {})
    }
    marcar()
    const timer = setInterval(marcar, 5 * 60_000)
    return () => clearInterval(timer)
  }, [perfilId])

  // O tema escolhido no Meu Perfil (SESSAO-13) segue a pessoa: quando o perfil
  // chega, ele manda — inclusive num navegador que nunca a viu.
  const temaPerfil = consultaPerfil.data?.perfil?.tema ?? null
  useEffect(() => {
    if (temaPerfil && ehTema(temaPerfil)) aplicarTema(temaPerfil)
  }, [temaPerfil])

  const sair = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

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
  }, [sessaoResolvida, sessao, consultaPerfil.data, consultaPerfil.isPending, recarregarPerfil, sair])

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>
}
