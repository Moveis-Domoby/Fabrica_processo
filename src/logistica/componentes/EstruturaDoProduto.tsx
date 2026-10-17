import { useQuery } from '@tanstack/react-query'
import { ROTULO_TIPO, buscarEstruturaDoProduto } from '@/logistica/classificacao'
import type { TipoEstoque } from '@/logistica/classificacao'

function quantidade(n: number): string {
  return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 4 })
}

function tipo(t: TipoEstoque | null): string | null {
  return t ? ROTULO_TIPO[t].toLowerCase() : null
}

/**
 * Configurações → Móveis, insumos e peças → "Estrutura" (SESSAO-33 · D-142,
 * resposta 3): do que o produto é feito (os componentes da estrutura do Tiny,
 * com a quantidade) e onde ele é usado. Só existe quando o botão é tocado —
 * uma requisição no clique (Lei §3).
 */
export function EstruturaDoProduto({ tinyId }: { tinyId: number }) {
  const consulta = useQuery({
    queryKey: ['classificacao', 'estrutura', tinyId],
    queryFn: () => buscarEstruturaDoProduto(tinyId),
  })

  if (consulta.isError) {
    return (
      <p className="text-sm text-danificado-forte">
        {consulta.error instanceof Error
          ? consulta.error.message
          : 'Não deu para carregar a estrutura.'}
      </p>
    )
  }
  if (consulta.isPending) return <p className="text-sm text-texto-fraco">Carregando a estrutura…</p>

  const {
    componentes,
    usado_em: usadoEm,
    usado_em_total: usadoTotal,
    lido_em: lidoEm,
  } = consulta.data
  if (componentes.length === 0 && usadoTotal === 0) {
    return (
      <p className="text-sm text-texto-suave">
        O Tiny ainda não mandou a estrutura deste produto — ela chega com a carga completa do Tiny.
        Se ele não é fabricado nem entra em nenhum fabricado, não há estrutura mesmo.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      {componentes.length > 0 && (
        <section aria-label="Do que é feito" className="flex flex-col gap-1">
          <h3 className="font-semibold text-texto">Do que é feito</h3>
          <ul className="flex flex-col gap-0.5">
            {componentes.map((c) => (
              <li key={c.tiny_id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="tabular-nums font-medium text-texto">
                  {quantidade(c.quantidade)}
                  {c.unidade ? ` ${c.unidade}` : ''}
                </span>
                <span className="break-words text-texto">{c.descricao}</span>
                <span className="text-xs text-texto-fraco">
                  {[
                    c.codigo ? `SKU ${c.codigo}` : null,
                    tipo(c.tipo),
                    c.no_catalogo ? null : 'fora do catálogo daqui',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
          {lidoEm && (
            <p className="text-xs text-texto-fraco">
              Lida do Tiny em {new Date(lidoEm).toLocaleDateString('pt-BR')}.
            </p>
          )}
        </section>
      )}
      {usadoTotal > 0 && (
        <section aria-label="Onde é usado" className="flex flex-col gap-1">
          <h3 className="font-semibold text-texto">
            Onde é usado{' '}
            <span className="font-normal text-texto-suave">
              ({usadoTotal.toLocaleString('pt-BR')} {usadoTotal === 1 ? 'produto' : 'produtos'})
            </span>
          </h3>
          <ul className="flex flex-col gap-0.5">
            {usadoEm.map((u) => (
              <li key={u.tiny_id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="tabular-nums text-texto-suave">{quantidade(u.quantidade)} em</span>
                <span className="break-words text-texto">{u.descricao}</span>
                {u.codigo && <span className="text-xs text-texto-fraco">SKU {u.codigo}</span>}
              </li>
            ))}
          </ul>
          {usadoTotal > usadoEm.length && (
            <p className="text-xs text-texto-fraco">
              Mostrando {usadoEm.length} de {usadoTotal.toLocaleString('pt-BR')}.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
