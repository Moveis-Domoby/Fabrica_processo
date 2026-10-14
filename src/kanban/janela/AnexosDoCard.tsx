import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Camera,
  FileText,
  Image as ImagemIcone,
  Mic,
  Paperclip,
  Trash2,
  Upload,
} from 'lucide-react'
import { Botao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import {
  ACEITA_ANEXO,
  anexarAoCard,
  linksDosAnexos,
  listarAnexosDoCard,
  removerAnexo,
  tamanhoLegivel,
} from './api'
import type { AnexoDoCard } from './api'
import { GravadorDeAudio } from './GravadorDeAudio'

/**
 * Os anexos do card (SESSAO-31 · §3 · D-125 resp. 8): imagem com miniatura,
 * PDF que abre no navegador, áudio com tocador. Enviar por botão, arrastar e
 * soltar, câmera (tablet/celular) e gravar áudio. A lista só vem no clique
 * (Lei §3); o link de cada arquivo é de vida curta (o armário é privado).
 * Tirar = some para todos; o admin ainda vê (com quem tirou).
 */
export function AnexosDoCard({
  cardId,
  quantidade,
  podeAnexar,
  podeEditarCard,
  verRemovidos,
}: {
  cardId: number
  quantidade: number
  podeAnexar: boolean
  podeEditarCard: boolean
  verRemovidos: boolean
}) {
  const { perfil } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [aberta, setAberta] = useState(false)
  const [comRemovidos, setComRemovidos] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [sobre, setSobre] = useState(false)
  const arquivoRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const lista = useQuery({
    queryKey: ['card-anexos', cardId, comRemovidos],
    queryFn: () => listarAnexosDoCard(cardId, comRemovidos),
    enabled: aberta,
    gcTime: 0,
  })
  // Os links de vida curta de TODOS os anexos mostrados — uma chamada só.
  const caminhos = (lista.data ?? []).map((a) => a.caminho)
  const links = useQuery({
    queryKey: ['anexos-links', cardId, caminhos],
    queryFn: () => linksDosAnexos(caminhos),
    enabled: caminhos.length > 0,
    staleTime: 4 * 60_000,
    gcTime: 4 * 60_000,
  })

  const atualizar = async () => {
    setAberta(true)
    await Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['card-anexos', cardId] }),
      clienteQuery.invalidateQueries({ queryKey: ['card-janela', cardId] }),
    ])
  }
  const enviar = useMutation({
    mutationFn: async (v: { arquivos: File[]; duracaoS?: number }) => {
      for (const arquivo of v.arquivos)
        await anexarAoCard(cardId, arquivo, { duracaoS: v.duracaoS })
    },
    onSuccess: async (_d, v) => {
      notificar({
        titulo: v.arquivos.length === 1 ? 'Anexo enviado' : `${v.arquivos.length} anexos enviados`,
        tom: 'perfeito',
      })
      await atualizar()
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para anexar',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })
  const tirar = useMutation({
    mutationFn: (anexo: AnexoDoCard) => removerAnexo(anexo.id),
    onSuccess: async () => {
      notificar({ titulo: 'Anexo tirado do card', tom: 'perfeito' })
      await atualizar()
    },
    onError: (e) =>
      notificar({
        titulo: 'Não deu para tirar',
        descricao: e instanceof Error ? e.message : undefined,
        tom: 'danificado',
      }),
  })

  function aoSoltar(e: DragEvent) {
    e.preventDefault()
    setSobre(false)
    if (!podeAnexar) return
    const arquivos = Array.from(e.dataTransfer.files)
    if (arquivos.length > 0) enviar.mutate({ arquivos })
  }

  return (
    <section
      aria-label="Anexos"
      className={cn('flex flex-col gap-2 rounded-dm p-1', sobre && 'ring-2 ring-acao-ativa')}
      onDragOver={(e) => {
        if (!podeAnexar) return
        e.preventDefault()
        setSobre(true)
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={aoSoltar}
    >
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-texto">
        <Paperclip aria-hidden className="size-4 text-texto-suave" />
        Anexos <span className="font-normal text-texto-suave tabular-nums">({quantidade})</span>
        {!aberta && quantidade > 0 && (
          <Botao variante="fantasma" tamanho="sm" onClick={() => setAberta(true)}>
            Ver os anexos
          </Botao>
        )}
        {aberta && verRemovidos && (
          <label className="ml-auto inline-flex min-h-toque-md items-center gap-2 text-xs font-normal text-texto-suave">
            <input
              type="checkbox"
              className="size-4 accent-marca-500"
              checked={comRemovidos}
              onChange={(e) => setComRemovidos(e.target.checked)}
            />
            Mostrar os tirados (só o admin vê)
          </label>
        )}
      </h3>

      {podeAnexar && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={arquivoRef}
            type="file"
            multiple
            accept={ACEITA_ANEXO}
            className="hidden"
            onChange={(e) => {
              const arquivos = Array.from(e.target.files ?? [])
              e.target.value = ''
              if (arquivos.length > 0) enviar.mutate({ arquivos })
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const arquivos = Array.from(e.target.files ?? [])
              e.target.value = ''
              if (arquivos.length > 0) enviar.mutate({ arquivos })
            }}
          />
          <Botao
            variante="secundaria"
            tamanho="sm"
            icone={<Upload />}
            carregando={enviar.isPending}
            onClick={() => arquivoRef.current?.click()}
          >
            Enviar arquivo
          </Botao>
          <Botao
            variante="secundaria"
            tamanho="sm"
            icone={<Camera />}
            onClick={() => cameraRef.current?.click()}
          >
            Câmera
          </Botao>
          <Botao
            variante="secundaria"
            tamanho="sm"
            icone={<Mic />}
            onClick={() => setGravando(true)}
          >
            Gravar áudio
          </Botao>
          <span className="self-center text-xs text-texto-fraco">
            ou arraste o arquivo para cá · até 25 MB
          </span>
        </div>
      )}
      {gravando && (
        <GravadorDeAudio
          aoCancelar={() => setGravando(false)}
          aoTerminar={(arquivo, duracaoS) => {
            setGravando(false)
            enviar.mutate({ arquivos: [arquivo], duracaoS })
          }}
        />
      )}

      {aberta && lista.isPending && (
        <p className="text-sm text-texto-fraco">Carregando os anexos…</p>
      )}
      {aberta && lista.data && lista.data.length === 0 && (
        <p className="text-sm text-texto-fraco">Nenhum anexo.</p>
      )}
      {aberta && lista.data && lista.data.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {lista.data.map((a) => (
            <li key={a.id}>
              <ItemAnexo
                anexo={a}
                link={links.data?.[a.caminho]}
                podeTirar={
                  a.removido_em === null &&
                  (a.enviado_por === perfil?.id || podeEditarCard || perfil?.papel === 'admin')
                }
                tirando={tirar.isPending && tirar.variables?.id === a.id}
                aoTirar={() => tirar.mutate(a)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ItemAnexo({
  anexo: a,
  link,
  podeTirar,
  tirando,
  aoTirar,
}: {
  anexo: AnexoDoCard
  link?: string
  podeTirar: boolean
  tirando: boolean
  aoTirar: () => void
}) {
  const [confirmando, setConfirmando] = useState(false)
  const ehImagem = a.mime.startsWith('image/')
  const ehAudio = a.mime.startsWith('audio/')
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-dm border p-2',
        a.removido_em ? 'border-dashed border-borda-forte opacity-70' : 'border-borda',
      )}
    >
      <div className="flex items-start gap-2">
        {ehImagem && link ? (
          <a href={link} target="_blank" rel="noreferrer" className="shrink-0">
            <img
              src={link}
              alt={a.nome_arquivo}
              loading="lazy"
              className="size-16 rounded-dm object-cover"
            />
          </a>
        ) : (
          <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-dm bg-superficie-sutil text-texto-suave">
            {ehImagem ? (
              <ImagemIcone aria-hidden className="size-6" />
            ) : ehAudio ? (
              <Mic aria-hidden className="size-6" />
            ) : (
              <FileText aria-hidden className="size-6" />
            )}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col text-sm">
          {link && !ehAudio ? (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="truncate font-medium text-texto underline-offset-2 hover:underline"
            >
              {a.nome_arquivo}
            </a>
          ) : (
            <span className="truncate font-medium text-texto">{a.nome_arquivo}</span>
          )}
          <span className="text-xs text-texto-suave">
            {tamanhoLegivel(a.tamanho)}
            {a.duracao_s != null &&
              ` · ${Math.floor(a.duracao_s / 60)}:${String(a.duracao_s % 60).padStart(2, '0')}`}
            {' · '}
            {a.enviado_por_nome ?? 'alguém'} · {new Date(a.enviado_em).toLocaleDateString('pt-BR')}
          </span>
          {a.removido_em && (
            <span className="text-xs font-medium text-atencao-texto">
              Tirado por {a.removido_por_nome ?? 'alguém'} em{' '}
              {new Date(a.removido_em).toLocaleDateString('pt-BR')}
            </span>
          )}
        </span>
        {podeTirar &&
          (confirmando ? (
            <span className="flex shrink-0 flex-col gap-1">
              <Botao variante="perigo" tamanho="sm" carregando={tirando} onClick={aoTirar}>
                Tirar
              </Botao>
              <Botao variante="fantasma" tamanho="sm" onClick={() => setConfirmando(false)}>
                Não
              </Botao>
            </span>
          ) : (
            <Botao
              variante="fantasma"
              tamanho="sm"
              icone={<Trash2 />}
              aria-label={`Tirar o anexo ${a.nome_arquivo}`}
              className="shrink-0 px-2"
              onClick={() => setConfirmando(true)}
            />
          ))}
      </div>
      {ehAudio && link && <audio controls preload="none" src={link} className="w-full" />}
    </div>
  )
}
