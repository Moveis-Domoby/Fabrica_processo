import { Navigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Layers, Package, Settings2, Trophy } from 'lucide-react'
import { Abas, Dica } from '@/componentes/ui'
import type { Aba } from '@/componentes/ui'
import { useAcessoLogistica } from '@/logistica/acesso'
import { configEstoque } from '@/logistica/api'
import { PainelConfiguracoes } from '@/logistica/componentes/PainelConfiguracoes'
import { PainelInsumos } from '@/logistica/componentes/PainelInsumos'
import { PainelTop20 } from '@/logistica/componentes/PainelTop20'

type AbaEstoque = 'top20' | 'insumos' | 'configuracoes'

/** Aba na URL (?aba=) — o Voltar e o link funcionam. "sugestao" é o nome antigo. */
function abaDaUrl(valor: string | null): AbaEstoque {
  if (valor === 'insumos') return 'insumos'
  if (valor === 'configuracoes' || valor === 'sugestao') return 'configuracoes'
  return 'top20'
}

/**
 * Logística → Estoque. Ajuste de 28/09 ↪️ 30/09 (Ajuste Estoque 2 — D-83…D-87):
 * - a lista dos acabados é UMA, pelo ranking dos 90 dias (com o corte de
 *   pedido fora do comum), e o TOP X é o tamanho da página — só ele tem mínimo;
 * - filtro no topo: Todos · Necessidade de produção · Reservados para produção
 *   · Com estoque;
 * - o mínimo é automático por dias úteis de venda (editar trava); a capacidade
 *   do galpão saiu de uso;
 * - a reposição automática liga/desliga no Painel admin; desligada, a
 *   logística lança à mão.
 * Tudo paginado no servidor — a tela só requisita o que mostra (regra 17).
 */
export function Estoque() {
  const { perfil, semAcesso, tenhoAcesso } = useAcessoLogistica()
  const [parametros, setParametros] = useSearchParams()
  const aba = abaDaUrl(parametros.get('aba'))

  const { data: config } = useQuery({
    queryKey: ['estoque', 'config'],
    queryFn: configEstoque,
    enabled: tenhoAcesso,
  })
  const topX = config?.top_x ?? 20
  const rotuloTop = `Top ${topX}`

  const abas: Aba<AbaEstoque>[] = [
    { valor: 'top20', rotulo: rotuloTop, icone: <Trophy aria-hidden /> },
    { valor: 'insumos', rotulo: 'Matéria-prima e insumos', icone: <Layers aria-hidden /> },
    { valor: 'configuracoes', rotulo: 'Configurações', icone: <Settings2 aria-hidden /> },
  ]

  /** O que aparece embaixo do título: onde a pessoa está, em poucas palavras. */
  const subtitulo: Record<AbaEstoque, string> = {
    top20: `${rotuloTop} · os mais vendidos primeiro`,
    insumos: 'Matéria-prima e insumos · número do Tiny',
    configuracoes: 'Configurações · mínimo automático e cobertura',
  }

  if (semAcesso) return <Navigate to="/" replace />
  if (!perfil) return null

  return (
    <div className="flex flex-col gap-5">
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h1 className="flex items-center gap-2 text-2xl sm:text-3xl">
            <Package aria-hidden className="size-7 shrink-0 text-texto-suave" />
            Estoque
            <Dica rotulo="Como funciona o estoque">
              <span className="flex flex-col gap-2">
                <span>
                  O número de cada produto pronto é a <strong>contagem da logística</strong>: entra
                  pelo botão de cadastrar, pela reposição e por pedido cancelado; sai pela baixa ou
                  quando o PCP usa a peça num pedido.
                </span>
                <span>
                  Peça com pedido fica em Pedidos em aguardo e não soma aqui. O Tiny vale só para a
                  matéria-prima e os insumos.
                </span>
                <span>
                  A lista segue os mais vendidos dos últimos 90 dias, {topX} por página (o Top X) —
                  só eles têm mínimo. A busca acha qualquer produto do catálogo.
                </span>
              </span>
            </Dica>
          </h1>
          <p className="text-sm text-texto-suave">{subtitulo[aba]}</p>
        </div>

        <Abas
          rotulo="Visões do estoque"
          idBase="estoque"
          variante="quadrados"
          abas={abas}
          valor={aba}
          aoMudar={(valor) => {
            const novos = new URLSearchParams(parametros)
            if (valor === 'top20') novos.delete('aba')
            else novos.set('aba', valor)
            setParametros(novos, { replace: true })
          }}
          className="shrink-0"
        />
      </div>

      <div role="tabpanel" id="estoque-painel" aria-labelledby={`estoque-aba-${aba}`}>
        {aba === 'top20' && <PainelTop20 ativo={tenhoAcesso} podeMexer={tenhoAcesso} />}
        {aba === 'insumos' && <PainelInsumos ativo={tenhoAcesso} />}
        {aba === 'configuracoes' && <PainelConfiguracoes ativo={tenhoAcesso} podeMexer={tenhoAcesso} />}
      </div>
    </div>
  )
}
