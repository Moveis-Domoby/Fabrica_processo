import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Paginacao } from '@/componentes/ui'
import {
  POR_PAGINA_UNIDADES,
  ROTULO_TIPO,
  listarUnidadesForaDoPadrao,
} from '@/logistica/classificacao'
import type { UnidadeForaDoPadrao } from '@/logistica/classificacao'

function motivo(u: UnidadeForaDoPadrao): string {
  if (u.motivo === 'sem_unidade') return 'sem unidade no Tiny'
  if (u.motivo === 'desconhecida')
    return `"${u.unidade_tiny}" — unidade que a plataforma não reconhece`
  return `escrito "${u.unidade_tiny}" — o mais usado é "${u.unidade_padrao ?? ''}"`
}

/**
 * Configurações → Móveis, insumos e peças → "Unidades fora do padrão"
 * (SESSAO-33 · D-142, resposta 6): os insumos e as peças ativos sem unidade,
 * com unidade que o cadastro não reconhece ou com a grafia diferente da mais
 * usada — para a equipe padronizar NO TINY (a plataforma não converte nada).
 * Só existe depois do clique; uma página por requisição (catálogo limitado).
 */
export function UnidadesForaDoPadrao() {
  const [pagina, setPagina] = useState(1)
  const consulta = useQuery({
    queryKey: ['classificacao', 'unidades', pagina],
    queryFn: () => listarUnidadesForaDoPadrao(pagina),
    placeholderData: keepPreviousData,
  })

  if (consulta.isError) {
    return (
      <p className="text-sm text-danificado-forte">
        {consulta.error instanceof Error
          ? consulta.error.message
          : 'Não deu para carregar as unidades.'}
      </p>
    )
  }
  if (consulta.isPending) return <p className="text-sm text-texto-fraco">Carregando…</p>

  const { linhas, total } = consulta.data
  if (total === 0) {
    return (
      <p className="text-sm text-texto-suave">
        Tudo certo: todos os insumos e peças ativos têm a unidade no padrão.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-texto-suave" aria-live="polite">
        <strong className="text-texto tabular-nums">{total.toLocaleString('pt-BR')}</strong>{' '}
        {total === 1 ? 'produto para padronizar' : 'produtos para padronizar'} no Tiny
        {consulta.isFetching ? ' · atualizando…' : ''}
      </p>
      <ul className="flex flex-col overflow-hidden rounded-dm border border-borda">
        {linhas.map((u) => (
          <li
            key={u.tiny_id}
            className="flex flex-col gap-0.5 border-b border-borda px-3 py-2 text-sm last:border-b-0"
          >
            <span className="font-medium break-words text-texto">{u.descricao}</span>
            <span className="text-xs text-texto-suave">
              {[
                u.codigo ? `SKU ${u.codigo}` : 'sem SKU',
                u.tipo ? ROTULO_TIPO[u.tipo] : null,
                motivo(u),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </li>
        ))}
      </ul>
      {total > POR_PAGINA_UNIDADES && (
        <Paginacao
          paginaAtual={pagina}
          totalPaginas={Math.ceil(total / POR_PAGINA_UNIDADES)}
          totalItens={total}
          porPagina={POR_PAGINA_UNIDADES}
          aoMudarPagina={setPagina}
          className="rounded-dm border border-borda"
        />
      )}
    </div>
  )
}
