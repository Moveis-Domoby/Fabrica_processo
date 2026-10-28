import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Lock } from 'lucide-react'
import { Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { buscarTelaAvisos, definirAviso } from '@/notificacoes/preferencias'
import type { EscolhaAviso, TelaAvisos } from '@/notificacoes/preferencias'

/**
 * Configurações → Avisos (D-202, 28/10, pedido do dono): cada pessoa escolhe os
 * avisos que chegam no sino dela — e o administrador escolhe os de qualquer
 * pessoa (`?pessoa=`). Os urgentes ficam sempre ligados; os erros de automação
 * nascem ligados só para o super admin. A tela inteira numa requisição
 * (plt_fn_avisos); cada toque grava na hora e a tela já mostra a mudança.
 */
export function ConfigAvisos() {
  const { perfil } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [parametros, setParametros] = useSearchParams()
  const pessoaParam = parametros.get('pessoa')
  const pessoaId = pessoaParam && pessoaParam !== perfil?.id ? pessoaParam : null
  const chave = ['avisos-escolhas', pessoaId ?? 'eu']

  const tela = useQuery({
    queryKey: chave,
    queryFn: () => buscarTelaAvisos(pessoaId),
    enabled: perfil !== null,
  })

  const mudar = useMutation({
    mutationFn: ({ tipo, ligado }: { tipo: string; ligado: boolean }) =>
      definirAviso(tipo, ligado, pessoaId),
    // a tela muda no toque; se o banco recusar, volta como estava
    onMutate: async ({ tipo, ligado }) => {
      await clienteQuery.cancelQueries({ queryKey: chave })
      const antes = clienteQuery.getQueryData<TelaAvisos>(chave)
      clienteQuery.setQueryData<TelaAvisos>(chave, (atual) =>
        atual
          ? {
              ...atual,
              avisos: atual.avisos.map((a) => (a.tipo === tipo ? { ...a, ligado } : a)),
            }
          : atual,
      )
      return { antes }
    },
    onError: (erro, _v, contexto) => {
      if (contexto?.antes) clienteQuery.setQueryData(chave, contexto.antes)
      notificar({
        titulo: 'Não deu para mudar o aviso',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      })
    },
  })

  const grupos = useMemo(() => {
    const mapa = new Map<string, { nome: string; avisos: EscolhaAviso[] }>()
    for (const a of tela.data?.avisos ?? []) {
      const g = mapa.get(a.grupo) ?? { nome: a.grupo_nome, avisos: [] }
      g.avisos.push(a)
      mapa.set(a.grupo, g)
    }
    return [...mapa.values()]
  }, [tela.data])

  if (!perfil) return null
  const pessoas = tela.data?.pessoas ?? null

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-3 text-2xl sm:text-3xl">
          <Bell aria-hidden className="size-7 text-texto-suave" />
          Avisos
        </h1>
        <p className="mt-1 text-texto-suave">Escolha o que chega no sino.</p>
      </div>

      {pessoas && pessoas.length > 0 && (
        <Selecao
          className="sm:max-w-sm"
          rotulo="De quem"
          valor={pessoaId ?? perfil.id}
          opcoes={[
            { valor: perfil.id, rotulo: `Eu — ${perfil.nome}` },
            ...pessoas
              .filter((p) => p.id !== perfil.id)
              .map((p) => ({ valor: p.id, rotulo: p.nome })),
          ]}
          aoMudar={(v) => {
            const novos = new URLSearchParams(parametros)
            if (v === perfil.id) novos.delete('pessoa')
            else novos.set('pessoa', v)
            setParametros(novos, { replace: true })
          }}
        />
      )}

      {tela.isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {tela.isError && <p className="text-sm text-danificado-forte">{tela.error.message}</p>}

      {grupos.map((g) => (
        <section
          key={g.nome}
          aria-label={g.nome}
          className="overflow-hidden rounded-dm-lg border border-borda bg-superficie"
        >
          <h2 className="border-b border-borda px-4 py-2.5 text-sm font-semibold text-texto">
            {g.nome}
          </h2>
          <ul className="divide-y divide-borda">
            {g.avisos.map((a) => (
              <li key={a.tipo} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-texto">{a.nome}</p>
                  {a.descricao && <p className="text-xs text-texto-suave">{a.descricao}</p>}
                  {a.recebidos_30d > 0 && (
                    <p className="text-xs text-texto-fraco tabular-nums">
                      {a.recebidos_30d} nos últimos 30 dias
                    </p>
                  )}
                </div>
                {a.obrigatorio ? (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-texto-suave"
                    title="Urgente — fica sempre ligado"
                  >
                    <Lock aria-hidden className="size-3.5" />
                    Sempre ligado
                  </span>
                ) : (
                  <Interruptor
                    ligado={a.ligado}
                    rotulo={a.nome}
                    aoMudar={(ligado) => mudar.mutate({ tipo: a.tipo, ligado })}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** Liga/desliga (botão com papel de interruptor — o leitor de tela diz "ligado"/"desligado"). */
function Interruptor({
  ligado,
  rotulo,
  aoMudar,
}: {
  ligado: boolean
  rotulo: string
  aoMudar: (ligado: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={() => aoMudar(!ligado)}
      className={cn(
        'toque-seguro relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors',
        ligado ? 'border-acao bg-acao' : 'border-borda-forte bg-superficie-sutil',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block size-5 rounded-full bg-white shadow-sm transition-transform',
          ligado ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  )
}
