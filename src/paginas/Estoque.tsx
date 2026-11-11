import { Suspense, lazy, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Layers, Package, PackagePlus, Search, Settings2, Trophy } from 'lucide-react'
import { Abas, Botao, Campo } from '@/componentes/ui'
import { CabecalhoDaTela } from '@/componentes/CabecalhoDaTela'
import type { Aba } from '@/componentes/ui'
import { useAcessoLogistica } from '@/logistica/acesso'
import { configEstoque } from '@/logistica/api'
import { PainelConfiguracoes } from '@/logistica/componentes/PainelConfiguracoes'
import { PainelInsumos } from '@/logistica/componentes/PainelInsumos'
import { PainelTop20 } from '@/logistica/componentes/PainelTop20'

// SESSAO-48 (frente 3): a janela "Para onde vai este móvel?" — pedaço próprio, só
// baixa quando o endereço pede (`?destino=`, o caminho do aviso do sino — Lei §9).
const ModalDestinoPedidoCancelado = lazy(() =>
  import('@/logistica/componentes/ModalDestinoPedidoCancelado').then((m) => ({
    default: m.ModalDestinoPedidoCancelado,
  })),
)

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
  // SESSAO-48 (frente 3): o pedido cancelado no Tiny com móveis em produção — a
  // janela vive no endereço (?destino=<card do pedido>), como a "Decidir situação"
  // da devolução: o aviso do sino e o link abrem direto, em qualquer aba.
  const destinoCardId = Number(parametros.get('destino')) || null
  function fecharDestino() {
    const novos = new URLSearchParams(parametros)
    novos.delete('destino')
    setParametros(novos, { replace: true })
  }
  // ↩️ 06/11: o "Cadastrar produto ao estoque" mora na linha das abas (o
  // painel do Top X abre a escolha do produto quando este botão manda).
  const [cadastrando, setCadastrando] = useState(false)
  // ↩️ 06/11: a busca do catálogo também mora na linha das abas.
  const [busca, setBusca] = useState('')
  // ↩️ 06/11 (varredura): a busca da aba "Matéria-prima e insumos" também na linha presa.
  const [buscaInsumos, setBuscaInsumos] = useState('')

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

  /** Onde a pessoa está, em poucas palavras — ↩️ 06/11: abre no "?" do título. */
  const subtitulo: Record<AbaEstoque, string> = {
    top20: `${rotuloTop} · os mais vendidos primeiro`,
    insumos: 'Matéria-prima e insumos · número do Tiny',
    configuracoes: 'Configurações · mínimo automático e cobertura',
  }

  if (semAcesso) return <Navigate to="/" replace />
  if (!perfil) return null

  return (
    <div className="flex flex-col gap-3">
      {/* ↩️ Ajuste de 06/11 (cabeçalhos compactos): a explicação e o "onde estou"
          de cada aba foram para o "?"; as abas ficam na linha do título. */}
      <CabecalhoDaTela
        titulo="Estoque"
        icone={<Package />}
        rotuloAjuda="Como funciona o estoque"
        ajuda={
          <span className="flex flex-col gap-2">
            <strong className="font-semibold">{subtitulo[aba]}</strong>
            <span>
              O número de cada produto pronto é a <strong>contagem da logística</strong>: entra pelo
              botão de cadastrar, pela reposição e por pedido cancelado; sai pela baixa ou quando o
              PCP usa a peça num pedido.
            </span>
            <span>
              Peça com pedido fica na Expedição e não soma aqui: ela conta como{' '}
              <strong>reservada em venda</strong> desde que fica pronta até o pedido ser entregue —
              inclusive lançada para ROTAS ou já no caminhão. O Tiny vale só para a matéria-prima e
              os insumos.
            </span>
            <span>
              A lista segue os mais vendidos dos últimos 90 dias, {topX} por página (o Top X) — só
              eles têm mínimo. A busca acha qualquer produto do catálogo.
            </span>
          </span>
        }
      >
        {aba === 'top20' && (
          <div className="mr-auto w-full max-w-md min-w-56 flex-1">
            <Campo
              rotulo="Buscar no catálogo"
              rotuloOculto
              type="search"
              prefixo={<Search />}
              placeholder="Buscar no catálogo: nome do produto ou SKU"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        )}
        {aba === 'insumos' && (
          <div className="mr-auto w-full max-w-md min-w-56 flex-1">
            <Campo
              rotulo="Buscar insumo"
              rotuloOculto
              type="search"
              prefixo={<Search />}
              placeholder="Buscar insumo: nome ou SKU"
              value={buscaInsumos}
              onChange={(e) => setBuscaInsumos(e.target.value)}
            />
          </div>
        )}
        {aba === 'top20' && tenhoAcesso && (
          <Botao
            icone={<PackagePlus />}
            className="shrink-0 whitespace-nowrap"
            onClick={() => setCadastrando(true)}
          >
            Cadastrar produto ao estoque
          </Botao>
        )}
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
      </CabecalhoDaTela>

      <div role="tabpanel" id="estoque-painel" aria-labelledby={`estoque-aba-${aba}`}>
        {aba === 'top20' && (
          <PainelTop20
            ativo={tenhoAcesso}
            podeMexer={tenhoAcesso}
            cadastrando={cadastrando}
            aoFecharCadastro={() => setCadastrando(false)}
            busca={busca}
            aoMudarBusca={setBusca}
          />
        )}
        {aba === 'insumos' && <PainelInsumos ativo={tenhoAcesso} busca={buscaInsumos} />}
        {aba === 'configuracoes' && (
          <PainelConfiguracoes ativo={tenhoAcesso} podeMexer={tenhoAcesso} />
        )}
      </div>

      {destinoCardId !== null && tenhoAcesso && (
        <Suspense fallback={null}>
          <ModalDestinoPedidoCancelado
            key={destinoCardId}
            cardId={destinoCardId}
            aoFechar={fecharDestino}
          />
        </Suspense>
      )}
    </div>
  )
}
