import { useEffect, useId, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ClipboardPaste, FileUp, Mic, Paperclip, Send, X } from 'lucide-react'
import { Botao, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { GravadorDeAudio } from '@/kanban/janela/GravadorDeAudio'
import { criarSugestao, enviarArquivo } from './api'
import type { ArquivoDaSugestao } from './api'
import {
  faixaDoNivel,
  LIMITE_ARQUIVO,
  letrasQueFaltam,
  MAXIMO_ARQUIVOS,
  MAXIMO_LETRAS,
  NIVEIS,
  nomeDoPrint,
  oQueFalta,
  ROTULO_TIPO,
  tamanhoLegivel,
  tipoDoArquivo,
  TIPOS,
} from './regras'
import type { TipoSugestao } from './regras'
import { IconeArquivo } from './IconeArquivo'

interface ArquivoEscolhido {
  chave: string
  arquivo: File
  duracaoS: number | null
  previa: string | null
  /** Já subiu ao armário (numa tentativa anterior): não sobe de novo. */
  enviado?: ArquivoDaSugestao
}

export interface OrigemDaDevolucao {
  id: number
  tipo: TipoSugestao
  nivel: number
  resumo: string
}

function novaChave() {
  return crypto.randomUUID()
}

/**
 * SESSAO-46 (D-260/D-263) — o formulário de sugerir: tudo obrigatório —
 * pelo menos um arquivo (escolher, arrastar, gravar áudio ou colar um print
 * com Ctrl+V), o tipo, o texto de 30+ letras e o nível de necessidade de 1 a
 * 10. Com `origem`, é a DEVOLUÇÃO depois do teste: o mesmo formulário inteiro,
 * com o tipo e o nível da anterior já marcados (resposta 3 do dono).
 * O envio é idempotente (uma chave por formulário aberto — Lei §10).
 */
export function ModalSugerir({
  aberto,
  aoFechar,
  origem = null,
  aoEnviar,
}: {
  aberto: boolean
  aoFechar: () => void
  origem?: OrigemDaDevolucao | null
  aoEnviar?: (id: number) => void
}) {
  const { perfil } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const idTexto = useId()
  const entrada = useRef<HTMLInputElement>(null)
  const [tipo, setTipo] = useState<TipoSugestao | null>(origem?.tipo ?? null)
  const [nivel, setNivel] = useState<number | null>(origem?.nivel ?? null)
  const [texto, setTexto] = useState('')
  const [arquivos, setArquivos] = useState<ArquivoEscolhido[]>([])
  const [gravando, setGravando] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [chave, setChave] = useState(novaChave)

  // Abriu de novo (ou trocou a sugestão de origem): formulário limpo.
  const [aberturaAnterior, setAberturaAnterior] = useState({ aberto, origemId: origem?.id ?? null })
  if (aberturaAnterior.aberto !== aberto || aberturaAnterior.origemId !== (origem?.id ?? null)) {
    setAberturaAnterior({ aberto, origemId: origem?.id ?? null })
    if (aberto) {
      setTipo(origem?.tipo ?? null)
      setNivel(origem?.nivel ?? null)
      setTexto('')
      setArquivos([])
      setGravando(false)
      setErro('')
      setEnviando(null)
      setChave(novaChave())
    }
  }

  // As prévias das imagens vivem enquanto o arquivo está na lista.
  const previas = useRef<string[]>([])
  useEffect(() => {
    previas.current = arquivos.map((a) => a.previa).filter((p): p is string => p !== null)
  }, [arquivos])
  useEffect(
    () => () => {
      for (const p of previas.current) URL.revokeObjectURL(p)
    },
    [],
  )

  function acrescentar(novos: { arquivo: File; duracaoS?: number | null }[]) {
    setErro('')
    setArquivos((atuais) => {
      const lista = [...atuais]
      for (const { arquivo, duracaoS = null } of novos) {
        if (lista.length >= MAXIMO_ARQUIVOS) {
          setErro(`Até ${MAXIMO_ARQUIVOS} arquivos por sugestão.`)
          break
        }
        if (arquivo.size > LIMITE_ARQUIVO) {
          setErro(`"${arquivo.name}" tem mais de 50 MB — mande um menor.`)
          continue
        }
        if (arquivo.size === 0) continue
        lista.push({
          chave: crypto.randomUUID(),
          arquivo,
          duracaoS,
          previa: arquivo.type.startsWith('image/') ? URL.createObjectURL(arquivo) : null,
        })
      }
      return lista
    })
  }

  function tirar(chaveArquivo: string) {
    setArquivos((atuais) => {
      const sai = atuais.find((a) => a.chave === chaveArquivo)
      if (sai?.previa) URL.revokeObjectURL(sai.previa)
      return atuais.filter((a) => a.chave !== chaveArquivo)
    })
  }

  // Ctrl+V em qualquer lugar do formulário: o print (ou arquivo) copiado entra na lista.
  useEffect(() => {
    if (!aberto) return
    const aoColar = (e: ClipboardEvent) => {
      const itens = Array.from(e.clipboardData?.items ?? []).filter((i) => i.kind === 'file')
      if (itens.length === 0) return // texto colado segue para o campo de texto
      e.preventDefault()
      const agora = new Date()
      const colados = itens
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null)
        .map((f, indice) => {
          // O print colado chega como "image.png" — ganha um nome com a hora.
          const generico = !f.name || /^image\.(png|jpe?g|gif|webp)$/i.test(f.name)
          if (!generico) return { arquivo: f }
          const extensao = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
          const nome = nomeDoPrint(agora, extensao).replace(`.${extensao}`, `${indice ? `-${indice + 1}` : ''}.${extensao}`)
          return { arquivo: new File([f], nome, { type: f.type || 'image/png' }) }
        })
      acrescentar(colados)
      notificar({ titulo: colados.length === 1 ? 'Print colado' : `${colados.length} arquivos colados`, tom: 'perfeito' })
    }
    document.addEventListener('paste', aoColar)
    return () => document.removeEventListener('paste', aoColar)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- acrescentar só usa setState
  }, [aberto])

  const falta = oQueFalta({ tipo, texto, nivel, arquivos: arquivos.length })
  const faltamLetras = letrasQueFaltam(texto)

  async function enviar() {
    if (!perfil || falta.length > 0 || !tipo || nivel === null || enviando) return
    setErro('')
    try {
      const anexos: ArquivoDaSugestao[] = []
      for (const [indice, a] of arquivos.entries()) {
        if (a.enviado) {
          anexos.push(a.enviado)
          continue
        }
        setEnviando(
          arquivos.length === 1 ? 'Enviando o arquivo…' : `Enviando o arquivo ${indice + 1} de ${arquivos.length}…`,
        )
        const enviado = await enviarArquivo(perfil.id, a.arquivo, a.duracaoS)
        a.enviado = enviado
        anexos.push(enviado)
      }
      setEnviando('Registrando a sugestão…')
      const { id } = await criarSugestao({ tipo, texto, nivel, anexos, origemId: origem?.id ?? null, chave })
      notificar({
        titulo: origem ? `Sugestão #${id} enviada no lugar da #${origem.id}` : `Sugestão #${id} enviada`,
        descricao: 'Ela entrou em Solicitações — acompanhe no quadro Tech.',
        tom: 'perfeito',
      })
      await clienteQuery.invalidateQueries({ queryKey: ['tech'] })
      aoEnviar?.(id)
      aoFechar()
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : 'Não deu para enviar. Tente de novo.')
    } finally {
      setEnviando(null)
    }
  }

  const faixa = nivel === null ? null : faixaDoNivel(nivel)

  return (
    <Modal
      aberto={aberto}
      aoFechar={(v) => {
        if (!v && !enviando) aoFechar()
      }}
      titulo={origem ? `Devolver com nova sugestão` : 'Sugerir melhoria'}
      descricao={
        origem
          ? `Em cima da sugestão #${origem.id}: "${origem.resumo}"`
          : 'Conte o que precisa mudar. Tudo aqui é obrigatório.'
      }
      tamanho="galpao"
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar} disabled={enviando !== null}>
            Cancelar
          </Botao>
          <Botao
            variante="primaria"
            icone={<Send aria-hidden />}
            onClick={() => void enviar()}
            disabled={falta.length > 0}
            carregando={enviando !== null}
          >
            {enviando ?? (origem ? 'Enviar a nova sugestão' : 'Enviar sugestão')}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* ---------- 1 · o arquivo ---------- */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-texto">
            Arquivo <span className="font-normal text-texto-suave">— print, áudio, vídeo ou qualquer arquivo</span>
          </legend>
          <div
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes('Files')) return
              e.preventDefault()
              setArrastando(true)
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault()
              setArrastando(false)
              acrescentar(Array.from(e.dataTransfer.files).map((arquivo) => ({ arquivo })))
            }}
            className={cn(
              'flex flex-col gap-3 rounded-dm-lg border-2 border-dashed p-3 transition-colors',
              arrastando ? 'border-acao bg-acao/5' : 'border-borda-forte',
            )}
          >
            <div className="flex flex-wrap gap-2">
              <Botao variante="secundaria" icone={<FileUp aria-hidden />} onClick={() => entrada.current?.click()}>
                Escolher arquivo
              </Botao>
              {!gravando && (
                <Botao variante="secundaria" icone={<Mic aria-hidden />} onClick={() => setGravando(true)}>
                  Gravar áudio
                </Botao>
              )}
              <input
                ref={entrada}
                type="file"
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-label="Escolher arquivo"
                onChange={(e) => {
                  acrescentar(Array.from(e.target.files ?? []).map((arquivo) => ({ arquivo })))
                  e.target.value = ''
                }}
              />
            </div>
            {gravando && (
              <GravadorDeAudio
                aoTerminar={(arquivo, duracaoS) => {
                  setGravando(false)
                  acrescentar([{ arquivo, duracaoS }])
                }}
                aoCancelar={() => setGravando(false)}
              />
            )}
            <p className="flex items-center gap-2 text-sm text-texto-suave">
              <ClipboardPaste aria-hidden className="size-4 shrink-0" />
              Ou cole um print com <kbd className="rounded border border-borda px-1 text-xs">Ctrl</kbd>+
              <kbd className="rounded border border-borda px-1 text-xs">V</kbd>, ou arraste para cá · até 50 MB cada
            </p>

            {arquivos.length > 0 && (
              <ul className="flex flex-col gap-2" aria-label="Arquivos escolhidos">
                {arquivos.map((a) => (
                  <li
                    key={a.chave}
                    className="flex items-center gap-3 rounded-dm border border-borda bg-superficie p-2"
                  >
                    {a.previa ? (
                      <img src={a.previa} alt="" className="size-12 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded bg-superficie-sutil text-texto-suave">
                        <IconeArquivo tipo={tipoDoArquivo(a.arquivo.type)} className="size-6" />
                      </span>
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-texto">{a.arquivo.name}</span>
                      <span className="text-xs text-texto-suave tabular-nums">
                        {tamanhoLegivel(a.arquivo.size)}
                        {a.duracaoS !== null && ` · ${Math.round(a.duracaoS)} s de áudio`}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => tirar(a.chave)}
                      disabled={enviando !== null}
                      aria-label={`Tirar ${a.arquivo.name}`}
                      className="toque-seguro inline-flex h-toque-md w-toque-md shrink-0 items-center justify-center rounded-dm text-texto-suave hover:bg-superficie-sutil hover:text-texto"
                    >
                      <X aria-hidden className="size-5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {arquivos.length === 0 && !gravando && (
              <p className="flex items-center gap-2 text-sm text-texto-fraco">
                <Paperclip aria-hidden className="size-4" /> Nenhum arquivo ainda.
              </p>
            )}
          </div>
        </fieldset>

        {/* ---------- 2 · o tipo ---------- */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-texto">O que é?</legend>
          <div role="radiogroup" aria-label="O que é" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {TIPOS.map((t) => {
              const marcado = tipo === t.chave
              return (
                <button
                  key={t.chave}
                  type="button"
                  role="radio"
                  aria-checked={marcado}
                  onClick={() => setTipo(t.chave)}
                  className={cn(
                    'flex min-h-toque-lg flex-col items-start justify-center gap-0.5 rounded-dm-lg border-2 px-3 py-2 text-left transition-colors',
                    marcado ? 'border-acao bg-acao/10' : 'border-borda hover:bg-superficie-sutil',
                  )}
                >
                  <span className="text-sm font-semibold text-texto">
                    {marcado && '✓ '}
                    {t.rotulo}
                  </span>
                  <span className="text-xs text-texto-suave">{t.descricao}</span>
                </button>
              )
            })}
          </div>
        </fieldset>

        {/* ---------- 3 · o texto ---------- */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={idTexto} className="text-sm font-semibold text-texto">
            Conte o que você quer
          </label>
          <textarea
            id={idTexto}
            value={texto}
            maxLength={MAXIMO_LETRAS}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            placeholder="Onde acontece, o que você esperava e o que aconteceu de verdade."
            aria-describedby={`${idTexto}-conta`}
            className="w-full rounded-dm border border-borda-forte bg-superficie px-3 py-2 text-base text-texto placeholder:text-texto-fraco"
          />
          <p
            id={`${idTexto}-conta`}
            aria-live="polite"
            className={cn('text-sm tabular-nums', faltamLetras > 0 ? 'text-texto-suave' : 'text-perfeito-texto')}
          >
            {faltamLetras > 0
              ? `Faltam ${faltamLetras} ${faltamLetras === 1 ? 'letra' : 'letras'} (mínimo de 30)`
              : `✓ ${texto.trim().length} letras`}
          </p>
        </div>

        {/* ---------- 4 · o nível ---------- */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-texto">
            Nível de necessidade{' '}
            <span className="font-normal text-texto-suave">— 1 pode esperar · 10 é urgente</span>
          </legend>
          <div role="radiogroup" aria-label="Nível de necessidade" className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {NIVEIS.map((n) => {
              const marcado = nivel === n
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={marcado}
                  aria-label={`Nível ${n} — ${faixaDoNivel(n).rotulo}`}
                  onClick={() => setNivel(n)}
                  className={cn(
                    'inline-flex h-toque-md items-center justify-center rounded-dm border-2 text-base font-semibold tabular-nums transition-colors',
                    marcado
                      ? 'border-acao bg-acao text-acao-texto'
                      : 'border-borda text-texto hover:bg-superficie-sutil',
                  )}
                >
                  {n}
                </button>
              )
            })}
          </div>
          {faixa && (
            <p className="text-sm text-texto-suave">
              Nível {nivel} — <span className="font-semibold text-texto">{faixa.rotulo}</span>
            </p>
          )}
        </fieldset>

        {origem && (
          <p className="rounded-dm bg-superficie-sutil p-3 text-sm text-texto-suave">
            A sugestão #{origem.id} ({ROTULO_TIPO[origem.tipo]}) fica marcada como devolvida, e esta nova entra
            em Solicitações ligada a ela.
          </p>
        )}

        {falta.length > 0 && (
          <p className="text-sm text-texto-suave" aria-live="polite">
            Para enviar, falta: {falta.join(' · ')}.
          </p>
        )}
        {erro && (
          <p role="alert" className="rounded-dm bg-danificado-fundo p-3 text-sm text-danificado-texto">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
