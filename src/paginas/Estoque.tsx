import { Navigate, useSearchParams } from 'react-router'
import { Layers, Package, Settings2, Trophy } from 'lucide-react'
import { Abas, Dica } from '@/componentes/ui'
import type { Aba } from '@/componentes/ui'
import { useAcessoLogistica } from '@/logistica/acesso'
import { PainelConfiguracoes } from '@/logistica/componentes/PainelConfiguracoes'
import { PainelInsumos } from '@/logistica/componentes/PainelInsumos'
import { PainelTop20 } from '@/logistica/componentes/PainelTop20'

type AbaEstoque = 'top20' | 'insumos' | 'configuracoes'

const ABAS: Aba<AbaEstoque>[] = [
  { valor: 'top20', rotulo: 'Top 20+', icone: <Trophy aria-hidden /> },
  { valor: 'insumos', rotulo: 'Matéria-prima e insumos', icone: <Layers aria-hidden /> },
  { valor: 'configuracoes', rotulo: 'Configurações', icone: <Settings2 aria-hidden /> },
]

/** O que aparece embaixo do título: onde a pessoa está, em poucas palavras. */
const SUBTITULO: Record<AbaEstoque, string> = {
  top20: 'Top 20+ · os mais vendidos primeiro',
  insumos: 'Matéria-prima e insumos · número do Tiny',
  configuracoes: 'Configurações · mínimo e capacidade do galpão',
}

/** Aba na URL (?aba=) — o Voltar e o link funcionam. "sugestao" é o nome antigo. */
function abaDaUrl(valor: string | null): AbaEstoque {
  if (valor === 'insumos') return 'insumos'
  if (valor === 'configuracoes' || valor === 'sugestao') return 'configuracoes'
  return 'top20'
}

/**
 * Logística → Estoque. Ajuste de 28/09 (pedido do dono):
 * - o número dos produtos acabados é a CONTAGEM da logística (entrada, baixa e
 *   contagem manual — "por enquanto"); o Tiny fica nos insumos (D-70);
 * - a tela abre no Top 20+: os 20 mais vendidos dos 90 dias, depois o que tem
 *   estoque; o resto do catálogo na busca e em "ver os outros" (D-71);
 * - mínimo e capacidade do galpão nas Configurações; a sugestão cabe no galpão (D-72);
 * - foto de cada produto, cadastrada pela logística/admin (D-73);
 * - o texto explicativo virou o "i" com balão, e as abas são quadrados no
 *   canto superior direito (D-74).
 * Tudo paginado no servidor — a tela só requisita o que mostra (regra 17).
 */
export function Estoque() {
  const { perfil, semAcesso, tenhoAcesso } = useAcessoLogistica()
  const [parametros, setParametros] = useSearchParams()
  const aba = abaDaUrl(parametros.get('aba'))

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
                  A lista abre pelos 20 mais vendidos dos últimos 90 dias; o resto do catálogo está
                  na busca. Mínimo e capacidade do galpão ficam em Configurações.
                </span>
              </span>
            </Dica>
          </h1>
          <p className="text-sm text-texto-suave">{SUBTITULO[aba]}</p>
        </div>

        <Abas
          rotulo="Visões do estoque"
          idBase="estoque"
          variante="quadrados"
          abas={ABAS}
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
