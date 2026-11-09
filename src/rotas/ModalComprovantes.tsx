import { useRef, useState } from 'react'
import {
  CheckCircle2,
  FileText,
  ImageIcon,
  Loader2,
  Paperclip,
  RotateCw,
  TriangleAlert,
  X,
} from 'lucide-react'
import { Botao, Modal } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { tamanhoLegivel } from '@/tech/regras'
import { TIPOS_COMPROVANTE } from './api'
import { MAXIMO_COMPROVANTES, acrescentarComprovantes, porEnviar } from './enviarComprovantes'
import type { ComprovanteEscolhido } from './enviarComprovantes'
import type { EnvioDeComprovantes } from './useComprovantes'

/**
 * VÁRIOS COMPROVANTES DE UMA VEZ (SESSAO-47 — pedido do dono), o mesmo nos três
 * lugares em que se anexa comprovante: o painel do "Entregue" do entregador, o
 * botão "Comprovante" do card e a ficha do pedido.
 *
 * `useComprovantes` (arquivo ao lado) guarda a escolha e o envio;
 * `EscolhaDeComprovantes` é o botão de escolher + a lista (tira-se um antes de
 * enviar); `ModalComprovantes` é a janela — cada arquivo com o seu estado à
 * vista ("enviando", "enviado", "falhou — por quê") e o "tentar de novo" só do
 * que falhou, sem reenviar o que já subiu.
 */
const TEXTO_DO_ESTADO: Record<ComprovanteEscolhido['estado'], string> = {
  escolhido: '',
  enviando: 'enviando…',
  enviado: 'enviado',
  falhou: 'falhou',
}

function LinhaDoComprovante({
  item,
  aoTirar,
}: {
  item: ComprovanteEscolhido
  aoTirar?: () => void
}) {
  const nome = item.arquivo.name
  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-dm border bg-superficie py-1 pr-1 pl-2',
        item.estado === 'falhou' ? 'border-danificado-borda' : 'border-borda',
      )}
    >
      {item.arquivo.type.startsWith('image/') ? (
        <ImageIcon aria-hidden className="size-5 shrink-0 text-texto-suave" />
      ) : (
        <FileText aria-hidden className="size-5 shrink-0 text-texto-suave" />
      )}
      <span className="flex min-w-0 flex-1 flex-col py-1">
        <span className="truncate text-sm font-medium text-texto" title={nome}>
          {nome}
        </span>
        {/* o estado nunca só pela cor: o texto diz e o ícone acompanha */}
        <span
          className={cn(
            'text-xs break-words',
            item.estado === 'falhou'
              ? 'text-danificado-texto'
              : item.estado === 'enviado'
                ? 'text-perfeito-texto'
                : 'text-texto-suave',
          )}
        >
          {item.estado === 'escolhido'
            ? tamanhoLegivel(item.arquivo.size)
            : item.estado === 'falhou'
              ? `falhou — ${item.erro ?? 'não deu para enviar o arquivo'}`
              : TEXTO_DO_ESTADO[item.estado]}
        </span>
      </span>
      {item.estado === 'enviando' && (
        <Loader2 aria-hidden className="mr-2 size-5 shrink-0 animate-spin text-texto-suave" />
      )}
      {item.estado === 'enviado' && (
        <CheckCircle2 aria-hidden className="mr-2 size-5 shrink-0 text-perfeito-forte" />
      )}
      {item.estado === 'falhou' && (
        <TriangleAlert aria-hidden className="size-5 shrink-0 text-danificado-forte" />
      )}
      {aoTirar && (
        <button
          type="button"
          onClick={aoTirar}
          aria-label={`Tirar ${nome}`}
          className="inline-flex h-toque-md w-toque-md shrink-0 items-center justify-center rounded-dm text-texto-suave hover:bg-superficie-sutil hover:text-texto"
        >
          <X aria-hidden className="size-5" />
        </button>
      )}
    </li>
  )
}

/**
 * O botão de escolher (vários arquivos de uma vez; escolher de novo acrescenta)
 * e a lista do que foi escolhido, com o "tirar" de cada um e o estado do envio.
 */
export function EscolhaDeComprovantes({
  itens,
  aoMudar,
  desabilitado = false,
  rotulo = 'Escolher arquivos',
}: {
  itens: ComprovanteEscolhido[]
  aoMudar: (itens: ComprovanteEscolhido[]) => void
  /** Enquanto o envio roda, a lista não muda. */
  desabilitado?: boolean
  rotulo?: string
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const cheio = itens.length >= MAXIMO_COMPROVANTES

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={entrada}
        type="file"
        multiple
        accept={TIPOS_COMPROVANTE}
        className="sr-only"
        tabIndex={-1}
        aria-label={rotulo}
        onChange={(e) => {
          const escolha = acrescentarComprovantes(itens, Array.from(e.target.files ?? []))
          aoMudar(escolha.lista)
          setAvisos(escolha.avisos)
          e.target.value = ''
        }}
      />
      <Botao
        type="button"
        variante="secundaria"
        icone={<Paperclip />}
        disabled={desabilitado || cheio}
        onClick={() => entrada.current?.click()}
      >
        {rotulo}
      </Botao>
      {cheio && (
        <p className="text-xs text-texto-suave">
          Já são {MAXIMO_COMPROVANTES} arquivos — o máximo por vez. Envie estes e depois escolha
          mais.
        </p>
      )}
      {avisos.map((aviso) => (
        <p key={aviso} role="alert" className="text-sm text-atencao-texto">
          {aviso}
        </p>
      ))}
      {itens.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Arquivos escolhidos">
          {itens.map((item) => (
            <LinhaDoComprovante
              key={item.chave}
              item={item}
              aoTirar={
                desabilitado || item.estado === 'enviado' || item.estado === 'enviando'
                  ? undefined
                  : () => aoMudar(itens.filter((x) => x.chave !== item.chave))
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/** A janela dos comprovantes de um pedido — escolher, enviar e tentar de novo só o que falhou. */
export function ModalComprovantes({ envio }: { envio: EnvioDeComprovantes }) {
  const { alvo, itens, enviando } = envio
  const enviados = itens.filter((i) => i.estado === 'enviado').length
  const falharam = itens.filter((i) => i.estado === 'falhou').length
  const novos = itens.filter((i) => i.estado === 'escolhido').length
  const faltam = porEnviar(itens).length
  const soTentarDeNovo = falharam > 0 && novos === 0

  return (
    <Modal
      aberto={alvo !== null}
      aoFechar={(continuaAberto) => {
        if (!continuaAberto) envio.fechar()
      }}
      titulo={`Comprovantes — pedido ${alvo?.numero ?? ''}`}
      descricao={`Foto, PDF ou Word, até 10 MB cada — até ${MAXIMO_COMPROVANTES} arquivos por vez. A foto é reduzida no próprio aparelho.`}
      rodape={
        <>
          {/* com algo já enviado ou falhado, sair é "deixar para depois": o que subiu
              fica no pedido e o que faltou se anexa de novo quando der */}
          <Botao variante="secundaria" onClick={envio.fechar} disabled={enviando}>
            {enviados > 0 || falharam > 0 ? 'Deixar para depois' : 'Cancelar'}
          </Botao>
          <Botao
            icone={soTentarDeNovo ? <RotateCw /> : <Paperclip />}
            disabled={faltam === 0}
            carregando={enviando}
            onClick={envio.enviar}
          >
            {enviando
              ? 'Enviando…'
              : soTentarDeNovo
                ? falharam === 1
                  ? 'Tentar de novo o arquivo que falhou'
                  : `Tentar de novo os ${falharam} que falharam`
                : faltam === 0
                  ? 'Anexar'
                  : `Anexar ${faltam} ${faltam === 1 ? 'arquivo' : 'arquivos'}`}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {alvo?.depoisDaEntrega && (
          <p className="rounded-dm border border-info-borda bg-info-fundo px-3 py-2 text-sm text-info-texto">
            A entrega do pedido {alvo.numero} já ficou registrada. Os comprovantes sobem um por um —
            o que não subir pode ser tentado de novo aqui.
          </p>
        )}
        <EscolhaDeComprovantes itens={itens} aoMudar={envio.escolher} desabilitado={enviando} />
        {!enviando && (enviados > 0 || falharam > 0) && (
          <p role="status" className="text-sm text-texto">
            {enviados} de {itens.length} {itens.length === 1 ? 'enviado' : 'enviados'}
            {falharam > 0 &&
              ` · ${falharam === 1 ? '1 não subiu' : `${falharam} não subiram`} — o porquê está na linha do arquivo`}
            .
          </p>
        )}
      </div>
    </Modal>
  )
}
