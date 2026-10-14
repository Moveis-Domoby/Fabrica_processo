import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, Search, X } from 'lucide-react'
import { Botao, Campo, Selecao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { AvatarChat } from '@/chat/componentes/AvatarChat'
import { PilulaEtiqueta } from '@/utilitarios/PilulaEtiqueta'
import { useEtiquetas } from '@/utilitarios/consultas'
import { salvarEtiqueta } from '@/utilitarios/api'
import { CORES_ETIQUETA, ROTULO_COR } from '@/utilitarios/tipos'
import type { CorEtiqueta } from '@/utilitarios/tipos'
import { ROTULO_VINCULO, buscarPessoasAtivas, buscarVinculo } from '../avulso'
import type { OpcaoVinculo, PessoaMini, VinculoTipo } from '../avulso'

/** Espera a pessoa parar de digitar (300 ms — Lei §9) antes de ir ao servidor. */
function useDigitado(valor: string, ms = 300): string {
  const [estavel, setEstavel] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setEstavel(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return estavel
}

/** Escolher pessoas (responsáveis): busca no servidor, 10 por vez. */
export function SeletorPessoas({
  escolhidas,
  aoMudar,
}: {
  escolhidas: PessoaMini[]
  aoMudar: (pessoas: PessoaMini[]) => void
}) {
  const [busca, setBusca] = useState('')
  const termo = useDigitado(busca)
  const { data: pessoas = [], isFetching } = useQuery({
    queryKey: ['pessoas-ativas', termo],
    queryFn: () => buscarPessoasAtivas(termo),
    staleTime: 60_000,
  })
  const ids = new Set(escolhidas.map((p) => p.id))
  function alternar(p: PessoaMini) {
    aoMudar(ids.has(p.id) ? escolhidas.filter((x) => x.id !== p.id) : [...escolhidas, p])
  }
  return (
    <div className="flex flex-col gap-2">
      <Campo
        rotulo="Buscar pessoa"
        rotuloOculto
        placeholder="Buscar pessoa pelo nome"
        prefixo={<Search aria-hidden className="size-4" />}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <ul
        className="flex max-h-56 flex-col overflow-y-auto rounded-dm border border-borda"
        aria-busy={isFetching}
      >
        {pessoas.length === 0 && (
          <li className="px-3 py-2 text-sm text-texto-fraco">Ninguém com esse nome.</li>
        )}
        {pessoas.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => alternar(p)}
              aria-pressed={ids.has(p.id)}
              className={cn(
                'flex min-h-toque-md w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-superficie-sutil',
                ids.has(p.id) && 'bg-superficie-sutil font-medium',
              )}
            >
              <AvatarChat nome={p.nome} foto={p.foto} tamanho="sm" />
              <span className="flex-1 text-texto">{p.nome}</span>
              {ids.has(p.id) && <Check aria-hidden className="size-4 text-perfeito-forte" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Escolher etiquetas (a prioridade é uma etiqueta — palavras do dono). Criar
 * etiqueta nova aqui: só líder e admin (D-125 resp. 5); nome repetido o banco recusa.
 */
export function SeletorEtiquetas({
  escolhidas,
  aoMudar,
}: {
  escolhidas: number[]
  aoMudar: (ids: number[]) => void
}) {
  const { ehLider } = useSessao()
  const clienteQuery = useQueryClient()
  const { data: etiquetas = [] } = useEtiquetas()
  const ativas = etiquetas.filter((e) => e.arquivada_em === null)
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState<CorEtiqueta>('azul')
  const [erro, setErro] = useState('')
  const criar = useMutation({
    mutationFn: () => salvarEtiqueta({ id: null, nome: nome.trim(), cor }),
    onSuccess: async (id) => {
      await clienteQuery.invalidateQueries({ queryKey: ['etiquetas'] })
      aoMudar([...escolhidas, id])
      setCriando(false)
      setNome('')
      setErro('')
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'Não deu para criar a etiqueta.'),
  })
  function alternar(id: number) {
    aoMudar(escolhidas.includes(id) ? escolhidas.filter((x) => x !== id) : [...escolhidas, id])
  }
  return (
    <div className="flex flex-col gap-2">
      {ativas.length === 0 && (
        <p className="text-sm text-texto-fraco">Nenhuma etiqueta cadastrada ainda.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {ativas.map((e) => (
          <button
            key={e.id}
            type="button"
            aria-pressed={escolhidas.includes(e.id)}
            onClick={() => alternar(e.id)}
            className={cn(
              'inline-flex min-h-toque-md items-center gap-1 rounded-full border-2 px-1',
              escolhidas.includes(e.id) ? 'border-acao-ativa' : 'border-transparent',
            )}
          >
            <PilulaEtiqueta etiqueta={e} />
            {escolhidas.includes(e.id) && (
              <Check aria-hidden className="size-4 text-perfeito-forte" />
            )}
          </button>
        ))}
      </div>
      {ehLider && !criando && (
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<Plus />}
          className="self-start"
          onClick={() => setCriando(true)}
        >
          Criar etiqueta
        </Botao>
      )}
      {criando && (
        <div className="flex flex-col gap-2 rounded-dm border border-borda p-3">
          <Campo
            rotulo="Nome da etiqueta"
            maxLength={40}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Selecao
            rotulo="Cor"
            opcoes={CORES_ETIQUETA.map((c) => ({ valor: c, rotulo: ROTULO_COR[c] }))}
            valor={cor}
            aoMudar={(v) => setCor(v as CorEtiqueta)}
          />
          {erro && <p className="text-sm text-danificado-forte">{erro}</p>}
          <div className="flex flex-wrap gap-2">
            <Botao
              tamanho="sm"
              carregando={criar.isPending}
              disabled={!nome.trim()}
              onClick={() => criar.mutate()}
            >
              Criar e pôr no card
            </Botao>
            <Botao variante="secundaria" tamanho="sm" onClick={() => setCriando(false)}>
              Cancelar
            </Botao>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * O vínculo (opcional, só referência — D-125): pedido, produto ou peça do
 * quadro. Também serve para escolher a PEÇA do ajuste (D-130).
 */
export function SeletorVinculo({
  escolhido,
  aoMudar,
  paraAjuste = false,
}: {
  escolhido: (OpcaoVinculo & { tipo: VinculoTipo }) | null
  aoMudar: (v: (OpcaoVinculo & { tipo: VinculoTipo }) | null) => void
  paraAjuste?: boolean
}) {
  const [tipo, setTipo] = useState<VinculoTipo>(paraAjuste ? 'peca' : 'pedido')
  const [busca, setBusca] = useState('')
  const termo = useDigitado(busca)
  const { data: opcoes = [], isFetching } = useQuery({
    queryKey: ['vinculo-busca', tipo, termo, paraAjuste],
    queryFn: () => buscarVinculo({ tipo, busca: termo, paraAjuste }),
    enabled: termo.trim().length >= 2,
    staleTime: 30_000,
  })

  if (escolhido) {
    return (
      <div className="flex items-center gap-2 rounded-dm border border-acao-ativa bg-superficie-sutil px-3 py-2 text-sm">
        <span className="min-w-0 flex-1">
          <span className="text-texto-suave">{ROTULO_VINCULO[escolhido.tipo]}: </span>
          <span className="font-medium text-texto">{escolhido.rotulo}</span>
          {escolhido.detalhe && (
            <span className="block text-xs text-texto-suave">{escolhido.detalhe}</span>
          )}
        </span>
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<X />}
          aria-label="Tirar a escolha"
          onClick={() => aoMudar(null)}
        />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {!paraAjuste && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de vínculo">
          {(['pedido', 'produto', 'peca'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tipo === t}
              onClick={() => setTipo(t)}
              className={cn(
                'min-h-toque-md rounded-full border px-3 text-sm font-medium',
                tipo === t
                  ? 'border-acao-ativa bg-acao text-acao-texto'
                  : 'border-borda-forte bg-superficie text-texto-suave',
              )}
            >
              {ROTULO_VINCULO[t]}
            </button>
          ))}
        </div>
      )}
      <Campo
        rotulo={paraAjuste ? 'Buscar a peça' : `Buscar ${ROTULO_VINCULO[tipo].toLowerCase()}`}
        placeholder={
          tipo === 'pedido'
            ? 'Número do pedido ou nome do cliente'
            : tipo === 'produto'
              ? 'SKU ou nome do produto'
              : 'Número do pedido, SKU ou nome da peça'
        }
        prefixo={<Search aria-hidden className="size-4" />}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        ajuda="Digite pelo menos 2 letras."
      />
      {termo.trim().length >= 2 && (
        <ul
          className="flex max-h-56 flex-col overflow-y-auto rounded-dm border border-borda"
          aria-busy={isFetching}
        >
          {!isFetching && opcoes.length === 0 && (
            <li className="px-3 py-2 text-sm text-texto-fraco">
              {paraAjuste
                ? 'Nenhuma peça que possa ir para ajuste com essa busca.'
                : 'Nada encontrado.'}
            </li>
          )}
          {opcoes.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => aoMudar({ ...o, tipo })}
                className="flex min-h-toque-md w-full flex-col px-3 py-1.5 text-left text-sm hover:bg-superficie-sutil"
              >
                <span className="text-texto">{o.rotulo}</span>
                {o.detalhe && <span className="text-xs text-texto-suave">{o.detalhe}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
