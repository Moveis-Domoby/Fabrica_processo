import { Suspense, lazy, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { MapPinOff, MapPinPlus, Search } from 'lucide-react'
import { Botao, Campo, Modal } from '@/componentes/ui'
import { acharPontoDoEndereco } from './api'
import type { DadosParadaAvulsa } from './api'
import { FABRICA } from './rotaRuas'

const MapaPino = lazy(() => import('./MapaPinoParada'))

const TITULO_MIN = 2
const TITULO_MAX = 80
const ENDERECO_MIN = 3
const ENDERECO_MAX = 300
const OBSERVACAO_MAX = 300

type Busca = 'nada' | 'achou' | 'nao_achou' | 'falhou'

/**
 * SESSAO-41 (D-196, pedido do dono): a janela da PARADA AVULSA — título curto,
 * endereço (com "Achar no mapa": o pino aparece e se ARRASTA para o lugar
 * exato) e observação. Sem ponto achado, a parada se salva só com o endereço
 * escrito (a navegação procura pelo texto). O mapa e a busca só acontecem no
 * clique (Lei §3/§9). Quem usa decide o que fazer com os dados (`aoSalvar`):
 * a aba Programar guarda na rota que está montando; as outras telas salvam.
 * Botões grandes — o entregador usa no celular (D-06).
 */
export function ModalParadaAvulsa({
  aberto,
  titulo = 'Adicionar parada avulsa',
  descricao,
  carregando = false,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean
  titulo?: string
  descricao?: string
  carregando?: boolean
  aoFechar: () => void
  aoSalvar: (dados: DadosParadaAvulsa) => void
}) {
  const [tituloParada, setTituloParada] = useState('')
  const [endereco, setEndereco] = useState('')
  const [observacao, setObservacao] = useState('')
  const [ponto, setPonto] = useState<{ latitude: number; longitude: number } | null>(null)
  // o endereço que o ponto representa — mudou o texto, a tela avisa
  const [enderecoDoPonto, setEnderecoDoPonto] = useState<string | null>(null)
  const [busca, setBusca] = useState<Busca>('nada')

  const achar = useMutation({
    mutationFn: (texto: string) => acharPontoDoEndereco(texto),
    onSuccess: (resultado, texto) => {
      setEnderecoDoPonto(texto.trim())
      if (resultado) {
        setPonto(resultado)
        setBusca('achou')
      } else {
        setPonto(null)
        setBusca('nao_achou')
      }
    },
    onError: () => setBusca('falhou'),
  })

  const tituloOk = tituloParada.trim().length >= TITULO_MIN
  const enderecoOk = endereco.trim().length >= ENDERECO_MIN
  const pode = tituloOk && enderecoOk && !carregando
  const enderecoMudou =
    ponto !== null && enderecoDoPonto !== null && endereco.trim() !== enderecoDoPonto
  const mapaAberto = busca !== 'nada'

  function moverPino(latitude: number, longitude: number) {
    setPonto({ latitude, longitude })
    setEnderecoDoPonto(endereco.trim())
  }

  function salvar() {
    if (!pode) return
    aoSalvar({
      titulo: tituloParada.trim(),
      endereco: endereco.trim(),
      latitude: ponto?.latitude ?? null,
      longitude: ponto?.longitude ?? null,
      observacao: observacao.trim() || null,
    })
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={(v) => !v && aoFechar()}
      titulo={titulo}
      descricao={
        descricao ??
        'Buscar material, levar uma peça, passar num endereço — a parada entra na rota junto com os pedidos.'
      }
      rodape={
        <>
          <Botao tamanho="lg" variante="secundaria" onClick={aoFechar} disabled={carregando}>
            Cancelar
          </Botao>
          <Botao
            tamanho="lg"
            icone={<MapPinPlus />}
            onClick={salvar}
            disabled={!pode}
            carregando={carregando}
          >
            Salvar a parada
          </Botao>
        </>
      }
    >
      {/* sem botão de enviar dentro: o Enter num campo não salva pela metade */}
      <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
        <Campo
          rotulo="Título"
          placeholder="Ex.: buscar as dobradiças no fornecedor"
          maxLength={TITULO_MAX}
          value={tituloParada}
          onChange={(e) => setTituloParada(e.target.value)}
          ajuda="Curto — é o que aparece na rota."
          autoFocus
        />

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Campo
              rotulo="Endereço"
              placeholder="Rua, número, bairro, cidade"
              maxLength={ENDERECO_MAX}
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
            />
            <Botao
              type="button"
              variante="secundaria"
              icone={<Search />}
              className="w-full shrink-0 sm:w-auto"
              disabled={!enderecoOk}
              carregando={achar.isPending}
              onClick={() => achar.mutate(endereco)}
            >
              Achar no mapa
            </Botao>
          </div>

          {busca === 'nao_achou' && (
            <p className="rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
              Não achei esse endereço no mapa. Toque no mapa ou arraste o pino até o lugar — ou
              salve só com o endereço escrito (a navegação procura pelo texto).
            </p>
          )}
          {busca === 'falhou' && (
            <p className="rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
              Não consegui consultar o mapa agora. Marque o lugar tocando no mapa, tente de novo, ou
              salve só com o endereço escrito.
            </p>
          )}
          {enderecoMudou && (
            <p className="text-sm text-atencao-texto">
              Você mudou o endereço depois de marcar o pino — toque em “Achar no mapa” de novo, ou
              confira o pino.
            </p>
          )}

          {mapaAberto && (
            <>
              <div className="h-56 overflow-hidden rounded-dm-lg border border-borda sm:h-64">
                <Suspense
                  fallback={<p className="p-3 text-sm text-texto-fraco">Carregando o mapa…</p>}
                >
                  <MapaPino
                    latitude={ponto?.latitude ?? FABRICA.latitude}
                    longitude={ponto?.longitude ?? FABRICA.longitude}
                    aoMover={moverPino}
                  />
                </Suspense>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-texto-suave">
                  {ponto
                    ? 'Arraste o pino (ou toque no mapa) para acertar o lugar exato.'
                    : 'O pino está na fábrica — mova-o até o lugar da parada.'}
                </p>
                {ponto && (
                  <Botao
                    type="button"
                    variante="fantasma"
                    tamanho="sm"
                    icone={<MapPinOff />}
                    onClick={() => {
                      setPonto(null)
                      setEnderecoDoPonto(null)
                    }}
                  >
                    Tirar o pino
                  </Botao>
                )}
              </div>
            </>
          )}
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-texto">
          Observação (opcional)
          <textarea
            className="min-h-24 rounded-dm border border-borda-forte bg-superficie p-2 text-base font-normal text-texto placeholder:text-texto-fraco"
            maxLength={OBSERVACAO_MAX}
            placeholder="Ex.: falar com o Seu João no balcão"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </label>
      </form>
    </Modal>
  )
}
