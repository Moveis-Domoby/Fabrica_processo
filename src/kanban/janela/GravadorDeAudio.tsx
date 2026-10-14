import { useEffect, useRef, useState } from 'react'
import { Mic, Square, X } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { LIMITE_AUDIO_S } from './api'

/** O formato que o aparelho grava (o Safari do iPad grava mp4; o Chrome, webm). */
function formatoDoAparelho(): { mime: string; extensao: string } {
  const opcoes = [
    { mime: 'audio/webm;codecs=opus', extensao: 'webm' },
    { mime: 'audio/webm', extensao: 'webm' },
    { mime: 'audio/mp4', extensao: 'm4a' },
    { mime: 'audio/ogg;codecs=opus', extensao: 'ogg' },
  ]
  for (const o of opcoes) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(o.mime)) return o
  }
  return { mime: '', extensao: 'webm' }
}

/**
 * Gravar áudio pelo app (D-125 resp. 8): até 5 minutos — para sozinho no
 * limite. O áudio já sai comprimido do aparelho (Lei §9).
 */
export function GravadorDeAudio({
  aoTerminar,
  aoCancelar,
}: {
  aoTerminar: (arquivo: File, duracaoS: number) => void
  aoCancelar: () => void
}) {
  const [segundos, setSegundos] = useState(0)
  const [erro, setErro] = useState('')
  const [gravando, setGravando] = useState(false)
  const gravador = useRef<MediaRecorder | null>(null)
  const pedacos = useRef<Blob[]>([])
  const inicio = useRef(0)
  const cancelado = useRef(false)
  const formato = useRef(formatoDoAparelho())

  useEffect(() => {
    let fluxo: MediaStream | null = null
    let relogio: ReturnType<typeof setInterval> | null = null
    let ativo = true
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((f) => {
        if (!ativo) {
          f.getTracks().forEach((t) => t.stop())
          return
        }
        fluxo = f
        const r = formato.current.mime
          ? new MediaRecorder(f, { mimeType: formato.current.mime })
          : new MediaRecorder(f)
        gravador.current = r
        r.ondataavailable = (e) => {
          if (e.data.size > 0) pedacos.current.push(e.data)
        }
        r.onstop = () => {
          f.getTracks().forEach((t) => t.stop())
          if (cancelado.current) return
          const duracao = Math.min(LIMITE_AUDIO_S, Math.round((Date.now() - inicio.current) / 1000))
          const tipo = (r.mimeType || formato.current.mime || 'audio/webm').split(';')[0]
          const blob = new Blob(pedacos.current, { type: tipo })
          const quando = new Date().toLocaleString('pt-BR').replace(/[/:, ]+/g, '-')
          aoTerminar(
            new File([blob], `audio-${quando}.${formato.current.extensao}`, { type: tipo }),
            duracao,
          )
        }
        inicio.current = Date.now()
        r.start(1000)
        setGravando(true)
        relogio = setInterval(() => {
          const s = Math.round((Date.now() - inicio.current) / 1000)
          setSegundos(s)
          if (s >= LIMITE_AUDIO_S && r.state === 'recording') r.stop()
        }, 500)
      })
      .catch(() => setErro('Não deu para usar o microfone — confira a permissão do navegador.'))
    return () => {
      ativo = false
      if (relogio) clearInterval(relogio)
      if (gravador.current && gravador.current.state === 'recording') {
        cancelado.current = true
        gravador.current.stop()
      }
      fluxo?.getTracks().forEach((t) => t.stop())
    }
    // aoTerminar muda a cada desenho do pai — a gravação nasce uma vez só
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mm = Math.floor(segundos / 60)
  const ss = String(segundos % 60).padStart(2, '0')
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-dm border border-acao-ativa bg-superficie-sutil p-3">
      {erro ? (
        <p className="text-sm text-danificado-forte">{erro}</p>
      ) : (
        <span
          className="inline-flex items-center gap-2 text-sm font-medium text-texto tabular-nums"
          aria-live="polite"
        >
          <Mic
            aria-hidden
            className={gravando ? 'size-5 animate-pulse text-danificado-forte' : 'size-5'}
          />
          {gravando ? `Gravando ${mm}:${ss}` : 'Abrindo o microfone…'}
          <span className="font-normal text-texto-fraco">(até 5:00)</span>
        </span>
      )}
      <span className="ml-auto flex gap-2">
        {gravando && (
          <Botao tamanho="sm" icone={<Square />} onClick={() => gravador.current?.stop()}>
            Parar e enviar
          </Botao>
        )}
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<X />}
          onClick={() => {
            cancelado.current = true
            if (gravador.current && gravador.current.state === 'recording') gravador.current.stop()
            aoCancelar()
          }}
        >
          Cancelar
        </Botao>
      </span>
    </div>
  )
}
