import { Suspense, lazy, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Info, MapPinCheck, MapPinPen, Search, Undo2 } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { diaEHora } from '@/pedidos/formato'
import { acharPontoDoEndereco, marcarPontoNoMapa } from './api'
import { FABRICA } from './rotaRuas'
import { SeloEnderecoAlterado } from './SeloEnderecoAlterado'
import {
  CAMPOS_VAZIOS,
  CHAVES_DO_ENDERECO,
  complementoECep,
  enderecoEmLinha,
  lerEnderecoDoPedido,
  limparCampos,
  mesmoEndereco,
  problemasDoEndereco,
  restaurarEnderecoDoPedido,
  rotuloDaFonte,
  salvarEnderecoDoPedido,
  textoParaBusca,
} from './enderecoDoPedido'
import type { CamposEndereco, EnderecoDoPedido, FonteEndereco } from './enderecoDoPedido'

const MapaPino = lazy(() => import('./MapaPinoParada'))

/** A etapa da janela: o formulário, a pergunta do Tiny ao salvar, a pergunta ao voltar ao original. */
type Etapa = 'editar' | 'perguntar' | 'restaurar'
type Busca = 'nada' | 'achou' | 'nao_achou' | 'falhou'
interface Ponto {
  latitude: number
  longitude: number
}

const pontoDoBanco = (d: EnderecoDoPedido | undefined): Ponto | null =>
  d && d.geo.latitude !== null && d.geo.longitude !== null && d.geo.resolvido !== false
    ? { latitude: d.geo.latitude, longitude: d.geo.longitude }
    : null

const mesmoPonto = (a: Ponto | null, b: Ponto | null) =>
  a === b || (a !== null && b !== null && a.latitude === b.latitude && a.longitude === b.longitude)

/** "De" e "Para" do endereço, numa caixa só (a pergunta do Tiny e a volta ao original). */
function DePara({
  de,
  fonteDe,
  para,
  fontePara,
}: {
  de: CamposEndereco
  fonteDe: FonteEndereco | string
  para: CamposEndereco
  fontePara?: FonteEndereco | string
}) {
  const linha2 = (c: CamposEndereco, fonte?: string) =>
    [complementoECep(c), fonte ? rotuloDaFonte(fonte) : null].filter(Boolean).join(' · ')
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-dm-lg border border-borda bg-superficie-sutil/60 p-3 text-sm">
      <dt className="font-medium text-texto-suave">De:</dt>
      <dd className="min-w-0 break-words text-texto">
        {enderecoEmLinha(de)}
        <span className="block text-xs text-texto-suave">{linha2(de, fonteDe)}</span>
      </dd>
      <dt className="font-medium text-texto-suave">Para:</dt>
      <dd className="min-w-0 font-semibold break-words text-texto">
        {enderecoEmLinha(para)}
        {linha2(para, fontePara) && (
          <span className="block text-xs font-normal text-texto-suave">
            {linha2(para, fontePara)}
          </span>
        )}
      </dd>
    </dl>
  )
}

/**
 * SESSAO-50 (bloco C — pedido do dono, 12/11): a janela "Editar endereço" do
 * pedido. Lê ao abrir (uma requisição) e esquece ao fechar (Lei §3).
 *
 * - O endereço de entrega editável (rua, número, complemento, bairro, cidade,
 *   UF, CEP), preenchido com o que vale hoje, a busca de sempre ("Achar no
 *   mapa") e o mapa com o pino arrastável.
 * - **Mudar só o pino** = o "marcar o ponto" de sempre: salva direto, sem
 *   pergunta (o Tiny não guarda ponto).
 * - **Mudar o texto** = a pergunta (a janela vira um modal pequeno): "Trocar o
 *   endereço de entrega do pedido N?", De/Para e "Deseja salvar também no
 *   Tiny?" — "Salvar na plataforma e no Tiny" fica desligado com o porquê (o
 *   banco o devolve), "Salvar só na plataforma" e "Voltar".
 * - Com o endereço já mudado na plataforma: o selo com o original do Tiny e
 *   "Voltar ao endereço original" (a mesma pergunta do Tiny).
 * - Uma janela só (o tamanho muda com a etapa): nada pisca, o foco não se perde.
 */
export function JanelaEnderecoPedido({
  pedidoId,
  numero,
  inicio = 'editar',
  aoFechar,
  aoMudar,
}: {
  pedidoId: number
  /** O número do pedido para o título enquanto a janela lê. */
  numero?: number
  /** Abrir direto na volta ao original (o botão da ficha). */
  inicio?: 'editar' | 'restaurar'
  aoFechar: () => void
  /** Quem abriu relê o que mostra (a ficha). */
  aoMudar?: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const idMotivo = useId()
  const consulta = useQuery({
    queryKey: ['pedido-endereco', pedidoId],
    queryFn: () => lerEnderecoDoPedido(pedidoId),
    // lê ao abrir, esquece ao fechar (D-89)
    gcTime: 0,
    staleTime: 0,
  })
  const dados = consulta.data
  const num = dados?.numero ?? numero ?? ''

  const [etapa, setEtapa] = useState<Etapa>(inicio)
  // o que a pessoa mexeu — nulo = ainda o que veio do banco (sem copiar em efeito)
  const [editados, setEditados] = useState<CamposEndereco | null>(null)
  const [pinoMexido, setPinoMexido] = useState<{
    ponto: Ponto | null
    doTexto: CamposEndereco
  } | null>(null)
  const [busca, setBusca] = useState<Busca>('nada')

  const campos = editados ?? dados?.atual ?? CAMPOS_VAZIOS
  const limpos = limparCampos(campos)
  const pino = pinoMexido ? pinoMexido.ponto : pontoDoBanco(dados)
  // o texto a que o pino se refere: o do banco até a pessoa mexer no pino
  const textoDoPino = pinoMexido ? pinoMexido.doTexto : (dados?.atual ?? null)
  const textoMudou = dados ? !mesmoEndereco(limpos, dados.atual) : false
  const pinoMudou = pinoMexido !== null && !mesmoPonto(pinoMexido.ponto, pontoDoBanco(dados))
  const pinoDoTexto =
    pino !== null && textoDoPino !== null && mesmoEndereco(limparCampos(textoDoPino), limpos)
  const problemas = textoMudou ? problemasDoEndereco(limpos) : []

  function mudarCampo(chave: keyof CamposEndereco, valor: string) {
    setEditados({ ...campos, [chave]: valor })
  }

  const depois = async (titulo: string, descricao?: string) => {
    notificar({ titulo, descricao, tom: 'perfeito' })
    await Promise.all(
      CHAVES_DO_ENDERECO.map((queryKey) => clienteQuery.invalidateQueries({ queryKey })),
    )
    aoMudar?.()
    aoFechar()
  }
  const falhou = (titulo: string) => (erro: unknown) =>
    notificar({
      titulo,
      descricao: erro instanceof Error ? erro.message : undefined,
      tom: 'danificado',
    })

  const achar = useMutation({
    mutationFn: (v: { texto: string; campos: CamposEndereco }) => acharPontoDoEndereco(v.texto),
    onSuccess: (resultado, v) => {
      if (resultado) {
        setPinoMexido({ ponto: resultado, doTexto: v.campos })
        setBusca('achou')
      } else {
        setBusca('nao_achou')
      }
    },
    onError: () => setBusca('falhou'),
  })

  // só o pino: o marcar de sempre (a chave do endereço que vale, calculada no banco)
  const salvarPonto = useMutation({
    mutationFn: (p: Ponto) =>
      marcarPontoNoMapa({
        chave: dados!.geo.chave!,
        endereco: dados!.geo.endereco_geocodificavel!,
        latitude: p.latitude,
        longitude: p.longitude,
      }),
    onSuccess: () =>
      depois(
        `Ponto do pedido ${num} marcado no mapa`,
        'Vale para todo pedido com este endereço — é onde a parada aparece no mapa da rota. O Google Maps e o Waze seguem pelo endereço.',
      ),
    onError: falhou('Não deu para marcar o ponto'),
  })

  const salvar = useMutation({
    mutationFn: (tiny: boolean) =>
      salvarEnderecoDoPedido({
        pedidoId,
        endereco: limpos,
        // o pino só vai se é do endereço novo (a busca ou o arrasto depois de escrever)
        latitude: pinoDoTexto && pino ? pino.latitude : null,
        longitude: pinoDoTexto && pino ? pino.longitude : null,
        tiny,
      }),
    onSuccess: (r) =>
      r.restaurado
        ? depois(`O pedido ${num} voltou ao endereço original do Tiny`)
        : r.mudou
          ? depois(
              `Endereço do pedido ${num} trocado`,
              'Só na plataforma — o original do Tiny ficou guardado. Rotas, mapa e Entregas do dia já usam o novo.',
            )
          : depois(`Nada mudou no endereço do pedido ${num}`),
    onError: falhou('Não deu para trocar o endereço'),
  })

  const restaurar = useMutation({
    mutationFn: (tiny: boolean) => restaurarEnderecoDoPedido({ pedidoId, tiny }),
    onSuccess: (r) =>
      depois(
        r.mudou
          ? `O pedido ${num} voltou ao endereço original do Tiny`
          : `O pedido ${num} já estava no endereço do Tiny`,
        r.mudou ? 'O endereço alterado ficou no histórico do pedido.' : undefined,
      ),
    onError: falhou('Não deu para voltar ao endereço original'),
  })

  const ocupado = salvar.isPending || salvarPonto.isPending || restaurar.isPending
  const podeVoltar =
    !!dados?.plataforma && dados.pode_editar && !dados.plataforma.tiny_confirmado_em

  // ---------------------------------------------------------------------------
  // o que a janela mostra em cada etapa
  // ---------------------------------------------------------------------------
  let titulo: string
  let descricao: string | undefined
  let corpo: ReactNode
  let rodape: ReactNode = undefined

  if (consulta.isError) {
    titulo = `Endereço do pedido ${num}`
    corpo = (
      <p className="rounded-dm border border-danificado-borda bg-danificado-fundo p-3 text-sm text-danificado-texto">
        {consulta.error instanceof Error
          ? consulta.error.message
          : 'Não deu para abrir o endereço.'}
      </p>
    )
    rodape = (
      <Botao tamanho="lg" variante="secundaria" onClick={aoFechar}>
        Fechar
      </Botao>
    )
  } else if (!dados) {
    titulo =
      etapa === 'restaurar'
        ? `Voltar ao endereço original do pedido ${num}?`
        : `Editar endereço — pedido ${num}`
    corpo = (
      <p className="text-sm text-texto-fraco" aria-busy="true">
        Carregando o endereço…
      </p>
    )
  } else if (etapa === 'perguntar') {
    titulo = `Trocar o endereço de entrega do pedido ${num}?`
    corpo = (
      <div className="flex flex-col gap-4">
        <DePara de={dados.atual} fonteDe={dados.fonte} para={limpos} />
        <p className="flex items-start gap-2 text-xs text-texto-suave">
          <MapPinCheck aria-hidden className="mt-px size-3.5 shrink-0" />
          {pinoDoTexto && pino
            ? 'O ponto no mapa: o pino que você marcou para o endereço novo.'
            : 'O ponto no mapa: a rota procura pelo endereço novo (dá para acertar o pino depois).'}
        </p>
        <p className="text-sm text-texto">
          Deseja salvar também no Tiny? O endereço original do Tiny fica guardado na plataforma, e
          você pode voltar a ele quando quiser.
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Botao
              tamanho="lg"
              variante="secundaria"
              larguraTotal
              disabled={!dados.tiny_salvar.pode || ocupado}
              aria-describedby={dados.tiny_salvar.motivo ? idMotivo : undefined}
              onClick={() => salvar.mutate(true)}
            >
              Salvar na plataforma e no Tiny
            </Botao>
            {dados.tiny_salvar.motivo && (
              <p id={idMotivo} className="flex items-start gap-1.5 px-1 text-xs text-texto-suave">
                <Info aria-hidden className="mt-px size-3.5 shrink-0" />
                {dados.tiny_salvar.motivo}
              </p>
            )}
          </div>
          <Botao
            tamanho="lg"
            larguraTotal
            icone={<MapPinPen />}
            carregando={salvar.isPending}
            disabled={ocupado}
            onClick={() => salvar.mutate(false)}
            autoFocus
          >
            Salvar só na plataforma
          </Botao>
          <Botao
            tamanho="lg"
            variante="fantasma"
            larguraTotal
            disabled={ocupado}
            onClick={() => setEtapa('editar')}
          >
            Voltar
          </Botao>
        </div>
      </div>
    )
  } else if (etapa === 'restaurar') {
    titulo = `Voltar ao endereço original do pedido ${num}?`
    corpo = !dados.plataforma ? (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-texto">
          O pedido já está no endereço do Tiny: {enderecoEmLinha(dados.atual)}.
        </p>
        <Botao tamanho="lg" variante="secundaria" larguraTotal onClick={aoFechar}>
          Fechar
        </Botao>
      </div>
    ) : (
      <div className="flex flex-col gap-4">
        <DePara
          de={dados.atual}
          fonteDe="plataforma"
          para={dados.tiny}
          fontePara={dados.tiny.fonte}
        />
        <p className="text-sm text-texto">
          Deseja salvar também no Tiny? O endereço alterado na plataforma fica guardado no histórico
          do pedido.
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Botao
              tamanho="lg"
              variante="secundaria"
              larguraTotal
              disabled={!dados.tiny_restaurar.pode || ocupado}
              aria-describedby={dados.tiny_restaurar.motivo ? idMotivo : undefined}
              onClick={() => restaurar.mutate(true)}
            >
              Salvar na plataforma e no Tiny
            </Botao>
            {dados.tiny_restaurar.motivo && (
              <p id={idMotivo} className="flex items-start gap-1.5 px-1 text-xs text-texto-suave">
                <Info aria-hidden className="mt-px size-3.5 shrink-0" />
                {dados.tiny_restaurar.motivo}
              </p>
            )}
          </div>
          <Botao
            tamanho="lg"
            larguraTotal
            icone={<Undo2 />}
            carregando={restaurar.isPending}
            disabled={ocupado || !podeVoltar}
            onClick={() => restaurar.mutate(false)}
            autoFocus
          >
            Salvar só na plataforma
          </Botao>
          <Botao
            tamanho="lg"
            variante="fantasma"
            larguraTotal
            disabled={ocupado}
            onClick={() => (inicio === 'restaurar' ? aoFechar() : setEtapa('editar'))}
          >
            Voltar
          </Botao>
        </div>
      </div>
    )
  } else {
    // o formulário
    titulo = `Editar endereço — pedido ${num}`
    descricao = 'Muda onde a entrega vai: na rota, no mapa e no Google Maps/Waze do entregador.'
    const textoBusca = textoParaBusca(limpos)
    corpo = (
      // sem botão de enviar dentro: o Enter num campo não salva pela metade
      <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
        {dados.plataforma && (
          <div className="flex flex-col gap-2 rounded-dm-lg border border-info-borda bg-info-fundo/40 p-3">
            <SeloEnderecoAlterado selo={dados.plataforma} />
            <p className="text-xs text-texto-suave">
              Mudado{dados.plataforma.por ? ` por ${dados.plataforma.por}` : ''} em{' '}
              {diaEHora(dados.plataforma.em)}
              {dados.plataforma.tiny_confirmado_em
                ? ' — o Tiny confirmou.'
                : ' — só na plataforma.'}
            </p>
            {podeVoltar && (
              <Botao
                type="button"
                variante="secundaria"
                icone={<Undo2 />}
                className="self-start"
                disabled={ocupado}
                onClick={() => setEtapa('restaurar')}
              >
                Voltar ao endereço original
              </Botao>
            )}
          </div>
        )}

        {!dados.pode_editar ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-texto">{enderecoEmLinha(dados.atual)}</p>
            <p
              role="status"
              className="rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto"
            >
              {dados.motivo}
            </p>
          </div>
        ) : (
          <>
            {/* 375 px: rua inteira; número + complemento; bairro; cidade + UF; CEP —
                no computador, 3 linhas (a grade de 6) */}
            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-6 sm:col-span-4">
                <Campo
                  rotulo="Rua"
                  placeholder="Rua, avenida, travessa…"
                  maxLength={200}
                  autoComplete="off"
                  value={campos.endereco ?? ''}
                  onChange={(e) => mudarCampo('endereco', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Campo
                  rotulo="Número"
                  maxLength={30}
                  autoComplete="off"
                  value={campos.numero ?? ''}
                  onChange={(e) => mudarCampo('numero', e.target.value)}
                />
              </div>
              <div className="col-span-4 sm:col-span-3">
                <Campo
                  rotulo="Complemento"
                  placeholder="Casa, apto, bloco…"
                  maxLength={120}
                  autoComplete="off"
                  value={campos.complemento ?? ''}
                  onChange={(e) => mudarCampo('complemento', e.target.value)}
                />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <Campo
                  rotulo="Bairro"
                  maxLength={100}
                  autoComplete="off"
                  value={campos.bairro ?? ''}
                  onChange={(e) => mudarCampo('bairro', e.target.value)}
                />
              </div>
              <div className="col-span-4 sm:col-span-3">
                <Campo
                  rotulo="Cidade"
                  maxLength={100}
                  autoComplete="off"
                  value={campos.cidade ?? ''}
                  onChange={(e) => mudarCampo('cidade', e.target.value)}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Campo
                  rotulo="UF"
                  maxLength={2}
                  autoComplete="off"
                  className="uppercase"
                  value={campos.uf ?? ''}
                  onChange={(e) => mudarCampo('uf', e.target.value)}
                />
              </div>
              <div className="col-span-3 sm:col-span-2">
                <Campo
                  rotulo="CEP"
                  inputMode="numeric"
                  placeholder="00000-000"
                  maxLength={9}
                  autoComplete="off"
                  value={campos.cep ?? ''}
                  onChange={(e) => mudarCampo('cep', e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-texto">Ponto no mapa</p>
                <Botao
                  type="button"
                  variante="secundaria"
                  icone={<Search />}
                  className="w-full sm:w-auto"
                  disabled={textoBusca.trim().length < 3 || ocupado}
                  carregando={achar.isPending}
                  onClick={() => achar.mutate({ texto: textoBusca, campos: limpos })}
                >
                  Achar no mapa
                </Botao>
              </div>
              {busca === 'nao_achou' && (
                <p className="rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
                  O mapa não achou esse endereço. Toque no mapa e arraste o pino até a casa do
                  cliente — ou salve assim (a rota procura pelo endereço escrito).
                </p>
              )}
              {busca === 'falhou' && (
                <p className="rounded-dm border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
                  Não consegui consultar o mapa agora. Marque o lugar tocando no mapa e arrastando o
                  pino.
                </p>
              )}
              <div className="h-56 overflow-hidden rounded-dm-lg border border-borda sm:h-64">
                <Suspense
                  fallback={<p className="p-3 text-sm text-texto-fraco">Carregando o mapa…</p>}
                >
                  <MapaPino
                    latitude={pino?.latitude ?? FABRICA.latitude}
                    longitude={pino?.longitude ?? FABRICA.longitude}
                    aoMover={(latitude, longitude) =>
                      setPinoMexido({ ponto: { latitude, longitude }, doTexto: limpos })
                    }
                  />
                </Suspense>
              </div>
              <p
                className={
                  pino && !pinoDoTexto ? 'text-xs text-atencao-texto' : 'text-xs text-texto-suave'
                }
              >
                {!pino
                  ? 'O pino está na fábrica — toque em "Achar no mapa" ou toque no mapa e arraste o pino até a casa do cliente.'
                  : !pinoDoTexto
                    ? 'O pino é do endereço de antes — toque em "Achar no mapa" ou arraste o pino até o endereço novo. Sem isso, a rota procura o ponto pelo endereço novo.'
                    : 'Arraste o pino (ou toque no mapa) para acertar o lugar exato. Mudar só o pino salva direto — o Tiny não guarda o ponto.'}
              </p>
            </div>

            {problemas.length > 0 && (
              <p role="status" className="text-sm text-atencao-texto">
                Para salvar, falta: {problemas.join('; ')}.
              </p>
            )}
          </>
        )}
      </form>
    )
    const soPino = !textoMudou && pinoMudou && pino !== null && !!dados.geo.chave
    rodape = dados.pode_editar ? (
      <>
        <Botao tamanho="lg" variante="secundaria" onClick={aoFechar} disabled={ocupado}>
          Cancelar
        </Botao>
        <Botao
          tamanho="lg"
          icone={soPino ? <MapPinCheck /> : <MapPinPen />}
          carregando={salvarPonto.isPending}
          disabled={ocupado || (!textoMudou && !soPino) || problemas.length > 0}
          onClick={() => {
            if (textoMudou) setEtapa('perguntar')
            else if (soPino && pino) salvarPonto.mutate(pino)
          }}
        >
          {soPino ? 'Salvar o ponto' : 'Salvar o endereço'}
        </Botao>
      </>
    ) : (
      <Botao tamanho="lg" variante="secundaria" onClick={aoFechar}>
        Fechar
      </Botao>
    )
  }

  return (
    <Modal
      aberto
      aoFechar={(v) => !v && !ocupado && aoFechar()}
      titulo={titulo}
      descricao={descricao}
      tamanho={etapa === 'editar' ? 'galpao' : 'md'}
      rodape={rodape}
    >
      {corpo}
    </Modal>
  )
}
