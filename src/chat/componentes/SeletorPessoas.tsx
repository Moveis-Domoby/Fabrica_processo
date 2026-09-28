import { useEffect, useState } from 'react'
import type { UIEvent } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Check, Search } from 'lucide-react'
import { Botao, Campo } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { buscarPessoas, POR_PAGINA_PESSOAS } from '../api'
import type { Pessoa } from '../tipos'
import { AvatarChat } from './AvatarChat'

/**
 * Escolher pessoas (SESSAO-26): busca no servidor, 10 por página — a próxima
 * página só vem ao rolar até o fim ou tocar em "Ver mais" (regra 17 + lei do
 * dono). Quem está logado nunca aparece (ninguém conversa consigo mesmo).
 */
export function SeletorPessoas({
  eu,
  multiplo,
  selecionados,
  aoAlternar,
  ocultar = [],
}: {
  eu: string
  multiplo: boolean
  selecionados: string[]
  aoAlternar: (pessoa: Pessoa) => void
  /** Ids que já estão no canal / já escrevem — não voltam a aparecer. */
  ocultar?: string[]
}) {
  const [busca, setBusca] = useState('')
  const [buscaFeita, setBuscaFeita] = useState('')

  // Busca no servidor depois de uma pausa na digitação (uma requisição por
  // intenção, não por tecla).
  useEffect(() => {
    const espera = setTimeout(() => setBuscaFeita(busca.trim()), 300)
    return () => clearTimeout(espera)
  }, [busca])

  const pessoas = useInfiniteQuery({
    queryKey: ['chat', eu, 'pessoas', buscaFeita],
    queryFn: ({ pageParam }) => buscarPessoas({ busca: buscaFeita, pagina: pageParam, exceto: eu }),
    initialPageParam: 0,
    getNextPageParam: (ultima, todas) =>
      todas.length * POR_PAGINA_PESSOAS < ultima.total ? todas.length : undefined,
    gcTime: 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const lista = (pessoas.data?.pages.flatMap((p) => p.pessoas) ?? []).filter(
    (p) => !ocultar.includes(p.id),
  )

  function aoRolar(evento: UIEvent<HTMLDivElement>) {
    const alvo = evento.currentTarget
    const perto = alvo.scrollHeight - alvo.scrollTop - alvo.clientHeight < 60
    if (perto && pessoas.hasNextPage && !pessoas.isFetchingNextPage) void pessoas.fetchNextPage()
  }

  return (
    <div className="flex flex-col gap-3">
      <Campo
        rotulo="Buscar pessoa"
        prefixo={<Search />}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        autoComplete="off"
      />
      <div
        onScroll={aoRolar}
        className="flex max-h-[min(22rem,45dvh)] flex-col overflow-y-auto rounded-dm border border-borda"
      >
        {pessoas.isPending && (
          <p className="px-3 py-4 text-sm text-texto-fraco">Carregando…</p>
        )}
        {pessoas.isError && (
          <p className="px-3 py-4 text-sm text-danificado-texto">{pessoas.error.message}</p>
        )}
        {!pessoas.isPending && lista.length === 0 && !pessoas.isError && (
          <p className="px-3 py-4 text-sm text-texto-fraco">Ninguém encontrado com esse nome.</p>
        )}
        {lista.map((pessoa) => {
          const marcada = selecionados.includes(pessoa.id)
          return (
            <button
              key={pessoa.id}
              type="button"
              role={multiplo ? 'checkbox' : undefined}
              aria-checked={multiplo ? marcada : undefined}
              onClick={() => aoAlternar(pessoa)}
              className={cn(
                'flex min-h-toque-md items-center gap-3 border-b border-borda px-3 py-2 text-left last:border-b-0 hover:bg-superficie-sutil',
                marcada && 'bg-superficie-sutil',
              )}
            >
              <AvatarChat nome={pessoa.nome} foto={pessoa.foto_caminho} tamanho="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-texto">
                {pessoa.nome}
              </span>
              {multiplo && (
                <span
                  aria-hidden
                  className={cn(
                    'inline-flex size-6 items-center justify-center rounded border',
                    marcada ? 'border-acao-ativa bg-acao text-acao-texto' : 'border-borda-forte',
                  )}
                >
                  {marcada && <Check className="size-4" />}
                </span>
              )}
            </button>
          )
        })}
        {pessoas.hasNextPage && (
          <div className="p-2">
            <Botao
              variante="fantasma"
              tamanho="sm"
              larguraTotal
              carregando={pessoas.isFetchingNextPage}
              onClick={() => void pessoas.fetchNextPage()}
            >
              Ver mais pessoas
            </Botao>
          </div>
        )}
      </div>
    </div>
  )
}
