import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPinCheck, RotateCcw, Search } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { AVISO_PONTO_APROXIMADO, acharPontoDoEndereco, enderecoLegivel, marcarPontoNoMapa } from './api'
import type { PontoAproximado } from './api'
import { AtribuicaoBusca } from './atribuicaoMapa'
import { AvisoRuaNaoAchada, PerguntaNoRodape } from './AvisosDoPino'
import { mesmoPontoDoMapa, useConferirPino } from './conferirPino'
import type { PontoSuspeito } from './conferirPino'
import { FABRICA } from './rotaRuas'

const MapaPino = lazy(() => import('./MapaPinoParada'))

/** O pedido cujo ponto se marca: o endereço (o texto e a chave do banco) e o ponto de agora. */
export interface PedidoParaMarcar {
  numero: number
  endereco: string | null
  numero_endereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  /** A chave do cache do mapa (md5 do endereço, calculada no banco). */
  geo_chave: string | null
  /** O endereço exatamente como o banco o monta (a chave sai dele). */
  endereco_geocodificavel?: string | null
  latitude: number | null
  longitude: number | null
  geo_resolvido: boolean | null
  geo_manual?: boolean
  /** O ponto de agora é aproximado (a rua não foi achada): de qual degrau veio. */
  geo_aproximado?: PontoAproximado | null
  /** SESSAO-57: o CEP do endereço (o pino longe dele pede confirmação ao salvar). */
  cep?: string | null
  /**
   * SESSAO-57 (frente 3 — o 13840): o ponto marcado à mão é o mesmo ponto
   * aproximado da cidade (salvaram sem arrastar). A janela trata como o
   * aproximado: salvar sem mover pede confirmação.
   */
  pino_no_centro?: boolean
}

type Busca = 'nada' | 'achou' | 'nao_achou' | 'falhou' | 'aproximado'

/** SESSAO-57 (frente 2): o ponto que a janela abriu quando ele é aproximado (a cidade ou o bairro), não a casa. */
function suspeitoAoAbrir(p: PedidoParaMarcar | null): PontoSuspeito | null {
  if (!p || p.latitude == null || p.longitude == null || p.geo_resolvido === false) return null
  const aproximado = (p.geo_aproximado && !p.geo_manual) || p.pino_no_centro
  if (!aproximado) return null
  const bairro = p.geo_aproximado === 'bairro' && !p.geo_manual
  return {
    latitude: p.latitude,
    longitude: p.longitude,
    nivel: bairro ? 'bairro' : 'cidade',
    nome: bairro ? p.bairro : p.cidade,
  }
}

/** Chaves das telas que mostram o ponto do pedido (releem depois de marcar). */
const RELER: string[][] = [['programacao'], ['programadas'], ['entregas-do-dia'], ['rotas']]

/** O texto curto para a busca da janela: "rua número, bairro, cidade". */
function textoDeBusca(p: PedidoParaMarcar): string {
  return [
    [p.endereco, p.numero_endereco].filter(Boolean).join(' '),
    p.bairro,
    p.cidade,
  ]
    .filter(Boolean)
    .join(', ')
}

/**
 * SESSAO-45 (pedido do dono, 04/11 — "endereço não encontrado no mapa", o
 * 13793 de São José de Mipibu): a janela para a LOGÍSTICA marcar no mapa o
 * lugar do endereço do pedido — a mesma do pino da parada avulsa ("Achar no
 * mapa", arrastar o pino ou tocar no mapa). O ponto marcado à mão vale para
 * todo pedido com o mesmo endereço e nunca é trocado pela busca automática.
 * ↪️ Ajuste do dono (05/11): o ponto é o do NOSSO mapa (onde a parada aparece e
 * a ordem sugerida) — o Google Maps e o Waze vão sempre pelo endereço do
 * cliente. O mapa e a busca só acontecem ao abrir a janela (Lei §3/§9).
 * Botões grandes (D-06).
 */
export function ModalPontoNoMapa({
  pedido,
  aoFechar,
}: {
  pedido: PedidoParaMarcar | null
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const temPonto = pedido?.latitude != null && pedido?.longitude != null && pedido.geo_resolvido !== false
  const [texto, setTexto] = useState(() => (pedido ? textoDeBusca(pedido) : ''))
  const [ponto, setPonto] = useState<{ latitude: number; longitude: number } | null>(() =>
    pedido && temPonto ? { latitude: pedido.latitude!, longitude: pedido.longitude! } : null,
  )
  const [busca, setBusca] = useState<Busca>('nada')
  const [mexeu, setMexeu] = useState(false)
  // SESSAO-57 (frente 1): "Achar no mapa" só achou o bairro/a cidade — o pino está lá, não na casa
  const [lugarDaBusca, setLugarDaBusca] = useState<PontoSuspeito | null>(null)
  const [liberado, setLiberado] = useState(false)
  const [suspeitoInicial] = useState(() => suspeitoAoAbrir(pedido))
  const conferir = useConferirPino({
    cep: pedido?.cep ?? null,
    suspeito: lugarDaBusca ? (liberado ? null : lugarDaBusca) : suspeitoInicial,
  })

  const achar = useMutation({
    mutationFn: (t: string) => acharPontoDoEndereco(t),
    onSuccess: (resultado) => {
      conferir.voltar()
      if (resultado) {
        const ponto = { latitude: resultado.latitude, longitude: resultado.longitude }
        setPonto(ponto)
        setMexeu(true)
        setLiberado(false)
        setLugarDaBusca(resultado.aproximado ? { ...ponto, ...resultado.aproximado } : null)
        setBusca(resultado.aproximado ? 'aproximado' : 'achou')
      } else {
        setBusca('nao_achou')
      }
    },
    onError: () => setBusca('falhou'),
  })

  // Sem ponto nenhum, a janela já procura o endereço ao abrir (o clique que abriu é o pedido).
  const procurou = useRef(false)
  useEffect(() => {
    if (procurou.current || !pedido || temPonto) return
    procurou.current = true
    const t = textoDeBusca(pedido)
    if (t.trim().length >= 3) achar.mutate(t)
  }, [pedido, temPonto, achar])

  const salvar = useMutation({
    mutationFn: (alvo: { latitude: number; longitude: number } | null) =>
      marcarPontoNoMapa({
        chave: pedido!.geo_chave!,
        endereco: pedido!.endereco_geocodificavel!,
        latitude: alvo?.latitude ?? null,
        longitude: alvo?.longitude ?? null,
      }),
    onSuccess: async (_d, alvo) => {
      notificar({
        titulo: alvo ? `Ponto do pedido ${pedido!.numero} marcado no mapa` : 'O ponto volta à busca automática',
        descricao: alvo
          ? 'Vale para todo pedido com este endereço — é onde a parada aparece no mapa da rota. O Google Maps e o Waze seguem pelo endereço do cliente.'
          : undefined,
        tom: 'perfeito',
      })
      await Promise.all(RELER.map((queryKey) => clienteQuery.invalidateQueries({ queryKey })))
      aoFechar()
    },
    onError: (excecao) =>
      notificar({
        titulo: 'Não deu para marcar o ponto',
        descricao: excecao instanceof Error ? excecao.message : undefined,
        tom: 'danificado',
      }),
  })

  if (!pedido) return null
  // SESSAO-57 (frente 1): o pino no bairro/na cidade da busca só salva depois de arrastar (ou de "salvar assim mesmo")
  const travadoPelaBusca =
    lugarDaBusca !== null && !liberado && mesmoPontoDoMapa(ponto, lugarDaBusca)
  const podeSalvar =
    ponto !== null && !!pedido.geo_chave && !!pedido.endereco_geocodificavel && !travadoPelaBusca

  return (
    <Modal
      aberto
      aoFechar={(v) => !v && aoFechar()}
      titulo={`Ponto no mapa — pedido ${pedido.numero}`}
      descricao={enderecoLegivel(pedido)}
      rodape={
        conferir.pergunta ? (
          <PerguntaNoRodape
            pergunta={conferir.pergunta}
            carregando={salvar.isPending}
            aoConfirmar={conferir.confirmar}
            aoVoltar={conferir.voltar}
          />
        ) : (
        <>
          {pedido.geo_manual && (
            <Botao
              tamanho="lg"
              variante="fantasma"
              icone={<RotateCcw />}
              onClick={() => salvar.mutate(null)}
              disabled={salvar.isPending}
            >
              Voltar à busca automática
            </Botao>
          )}
          <Botao tamanho="lg" variante="secundaria" onClick={aoFechar} disabled={salvar.isPending}>
            Cancelar
          </Botao>
          <Botao
            tamanho="lg"
            icone={<MapPinCheck />}
            onClick={() => ponto && conferir.pedirParaSalvar(ponto, () => salvar.mutate(ponto))}
            disabled={!podeSalvar}
            carregando={salvar.isPending || conferir.conferindo}
          >
            Salvar o ponto
          </Botao>
        </>
        )
      }
    >
      <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Campo
            rotulo="Procurar no mapa"
            placeholder="Rua, número, bairro, cidade"
            maxLength={300}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <Botao
            type="button"
            variante="secundaria"
            icone={<Search />}
            className="w-full shrink-0 sm:w-auto"
            disabled={texto.trim().length < 3}
            carregando={achar.isPending}
            onClick={() => achar.mutate(texto)}
          >
            Achar no mapa
          </Botao>
        </div>
        <AtribuicaoBusca />

        {busca === 'aproximado' && lugarDaBusca && (
          <AvisoRuaNaoAchada
            lugar={lugarDaBusca}
            liberado={liberado || !mesmoPontoDoMapa(ponto, lugarDaBusca)}
            aoLiberar={() => setLiberado(true)}
          />
        )}
        {busca === 'nao_achou' && (
          <p className="rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
            O mapa não achou esse texto. Tente só a rua e a cidade — ou toque no mapa e arraste o
            pino até a casa do cliente.
          </p>
        )}
        {busca === 'falhou' && (
          <p className="rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
            A busca de endereço não respondeu. Marque o ponto no mapa (toque e arraste o pino) ou
            tente de novo.
          </p>
        )}

        <div className="h-64 overflow-hidden rounded-dm-lg border border-borda sm:h-80">
          <Suspense fallback={<p className="p-3 text-sm text-texto-fraco">Carregando o mapa…</p>}>
            <MapaPino
              latitude={ponto?.latitude ?? FABRICA.latitude}
              longitude={ponto?.longitude ?? FABRICA.longitude}
              aoMover={(latitude, longitude) => {
                setPonto({ latitude, longitude })
                setMexeu(true)
              }}
            />
          </Suspense>
        </div>
        <p className="text-xs text-texto-suave">
          {ponto
            ? mexeu
              ? 'Confira o pino na casa do cliente (arraste ou toque no mapa para acertar) e salve.'
              : pedido.geo_aproximado && !pedido.geo_manual
                ? `${AVISO_PONTO_APROXIMADO}: arraste o pino (ou toque no mapa) até a casa do cliente e salve.`
                : pedido.pino_no_centro
                  ? 'O pino foi salvo no centro da cidade, não na casa — arraste o pino (ou toque no mapa) até a casa do cliente e salve.'
                  : 'Este é o ponto de agora — arraste o pino (ou toque no mapa) para acertar e salve.'
            : 'O pino está na fábrica — toque no mapa ou arraste o pino até a casa do cliente.'}
        </p>
        <p className="text-xs text-texto-fraco">
          O ponto só mostra a parada no mapa da rota. O Google Maps e o Waze vão sempre pelo endereço
          do cliente.
        </p>
      </form>
    </Modal>
  )
}
