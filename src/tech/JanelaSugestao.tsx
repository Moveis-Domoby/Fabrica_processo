import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CircleCheckBig, CornerUpLeft, ExternalLink, FlaskConical, Loader2, XCircle } from 'lucide-react'
import { Botao, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { aprovarSugestao, buscarFicha, linksDosArquivos, moverSugestao } from './api'
import type { FichaSugestao } from './api'
import { useAbrirSugestao } from './abrirSugestao'
import { ModalSugerir } from './ModalSugerir'
import { IconeArquivo } from './IconeArquivo'
import { SeloColuna, SeloNivel, SeloTipo, SeloTeste } from './Selos'
import { COLUNAS, ROTULO_TIPO, TITULO_COLUNA, tamanhoLegivel, tipoDoArquivo } from './regras'
import type { ColunaSugestao } from './regras'

function quandoCurto(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function textoDoFato(f: FichaSugestao['historico'][number]): string {
  if (f.tipo === 'criada') return f.relacionada_id ? `Enviada como devolução da #${f.relacionada_id}` : 'Enviada'
  if (f.tipo === 'movida') {
    const de = f.de ? TITULO_COLUNA[f.de] : '—'
    const para = f.para ? TITULO_COLUNA[f.para] : '—'
    return `Movida de ${de} para ${para}${f.motivo ? ` — motivo: ${f.motivo}` : ''}`
  }
  if (f.tipo === 'aprovada') return 'Testada e aprovada por quem sugeriu'
  return `Testada e devolvida com a sugestão #${f.relacionada_id}`
}

/**
 * SESSAO-46 — a FICHA da sugestão (no clique — Lei §3): o texto inteiro, os
 * arquivos (links de 10 min do armário privado), quem sugeriu, a anterior e a
 * devolução, e a história. Quem sugeriu e tem o teste aberto: **Aprovar** ou
 * **Devolver com nova sugestão** (o formulário inteiro). O super admin move
 * por aqui também (o arrasto do quadro é o atalho do computador); recusar
 * pede o motivo.
 */
export function JanelaSugestao({ sugestaoId, aoFechar }: { sugestaoId: number; aoFechar: () => void }) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const abrirSugestao = useAbrirSugestao()
  const [devolvendo, setDevolvendo] = useState(false)
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')

  const ficha = useQuery({
    queryKey: ['tech', 'ficha', sugestaoId],
    queryFn: () => buscarFicha(sugestaoId),
  })
  const dados = ficha.data
  const caminhos = dados?.anexos.map((a) => a.caminho) ?? []
  const links = useQuery({
    queryKey: ['tech', 'links', sugestaoId, caminhos.join('|')],
    queryFn: () => linksDosArquivos(caminhos),
    enabled: caminhos.length > 0,
    staleTime: 8 * 60_000, // o link vale 10 min
  })

  async function releer() {
    await Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['tech'] }),
      clienteQuery.invalidateQueries({ queryKey: ['afazeres'] }),
      clienteQuery.invalidateQueries({ queryKey: ['meu-painel'] }),
    ])
  }
  const aoErro = (titulo: string) => (excecao: unknown) =>
    notificar({ titulo, descricao: excecao instanceof Error ? excecao.message : undefined, tom: 'danificado' })

  const mover = useMutation({
    mutationFn: ({ para, motivo: m }: { para: ColunaSugestao; motivo?: string }) => moverSugestao(sugestaoId, para, m),
    onSuccess: async (_r, v) => {
      notificar({ titulo: `Sugestão #${sugestaoId} em ${TITULO_COLUNA[v.para]}`, tom: 'perfeito' })
      setRecusando(false)
      setMotivo('')
      await releer()
    },
    onError: aoErro('Não deu para mover'),
  })
  const aprovar = useMutation({
    mutationFn: () => aprovarSugestao(sugestaoId),
    onSuccess: async () => {
      notificar({ titulo: 'Obrigado por testar!', descricao: `A sugestão #${sugestaoId} ficou aprovada.`, tom: 'perfeito' })
      await releer()
    },
    onError: aoErro('Não deu para aprovar'),
  })

  if (devolvendo && dados) {
    return (
      <ModalSugerir
        aberto
        aoFechar={() => setDevolvendo(false)}
        origem={{ id: dados.id, tipo: dados.tipo, nivel: dados.nivel, resumo: dados.texto.slice(0, 120) }}
        aoEnviar={(novaId) => abrirSugestao(novaId)}
      />
    )
  }

  return (
    <Modal
      aberto
      aoFechar={(v) => {
        if (!v) aoFechar()
      }}
      titulo={`Sugestão #${sugestaoId}`}
      descricao={
        dados
          ? `${ROTULO_TIPO[dados.tipo]} · enviada por ${dados.autor.nome} em ${quandoCurto(dados.criada_em)}`
          : undefined
      }
      tamanho="galpao"
    >
      {ficha.isPending && (
        <p className="flex items-center gap-2 text-sm text-texto-fraco" role="status">
          <Loader2 aria-hidden className="size-4 animate-spin" /> Abrindo a sugestão…
        </p>
      )}
      {ficha.isError && (
        <p role="alert" className="rounded-dm bg-danificado-fundo p-3 text-sm text-danificado-texto">
          {ficha.error instanceof Error ? ficha.error.message : 'Não deu para abrir a sugestão.'}
        </p>
      )}
      {dados && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <SeloColuna coluna={dados.coluna} />
            <SeloTipo tipo={dados.tipo} />
            <SeloNivel nivel={dados.nivel} />
            {dados.teste && <SeloTeste teste={dados.teste} />}
          </div>

          {/* ---------- o teste de quem sugeriu ---------- */}
          {dados.posso_testar && (
            <section
              aria-label="Seu teste"
              className="flex flex-col gap-3 rounded-dm-lg border-2 border-info-borda bg-info-fundo p-4"
            >
              <p className="flex items-center gap-2 font-semibold text-info-texto">
                <FlaskConical aria-hidden className="size-5" /> Já está no sistema — você pode testar.
              </p>
              <p className="text-sm text-info-texto">
                Funcionou como você pediu? Aprove. Ainda falta algo? Devolva com uma nova sugestão em cima desta.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Botao
                  variante="primaria"
                  icone={<CircleCheckBig aria-hidden />}
                  carregando={aprovar.isPending}
                  onClick={() => aprovar.mutate()}
                >
                  Aprovar
                </Botao>
                <Botao
                  variante="secundaria"
                  icone={<CornerUpLeft aria-hidden />}
                  disabled={aprovar.isPending}
                  onClick={() => setDevolvendo(true)}
                >
                  Devolver com nova sugestão
                </Botao>
              </div>
            </section>
          )}

          {dados.coluna === 'recusada' && dados.motivo_recusa && (
            <section
              aria-label="Motivo da recusa"
              className="flex flex-col gap-1 rounded-dm-lg border border-danificado-borda bg-danificado-fundo p-4"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-danificado-texto">
                <XCircle aria-hidden className="size-5" /> Recusada — o motivo
              </p>
              <p className="text-sm whitespace-pre-wrap text-danificado-texto">{dados.motivo_recusa}</p>
            </section>
          )}

          <section aria-label="O que foi pedido" className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-texto-suave">O que foi pedido</h3>
            <p className="text-base whitespace-pre-wrap text-texto">{dados.texto}</p>
          </section>

          {(dados.origem || dados.devolvida_para) && (
            <section aria-label="Sugestões ligadas" className="flex flex-col gap-2">
              {dados.origem && (
                <button
                  type="button"
                  onClick={() => abrirSugestao(dados.origem!.id)}
                  className="flex min-h-toque-md items-center gap-2 rounded-dm border border-borda px-3 py-2 text-left text-sm hover:bg-superficie-sutil"
                >
                  <CornerUpLeft aria-hidden className="size-4 shrink-0 text-texto-suave" />
                  <span className="min-w-0 flex-1">
                    Devolução da <strong>#{dados.origem.id}</strong>: {dados.origem.resumo}
                  </span>
                </button>
              )}
              {dados.devolvida_para && (
                <button
                  type="button"
                  onClick={() => abrirSugestao(dados.devolvida_para!.id)}
                  className="flex min-h-toque-md items-center gap-2 rounded-dm border border-borda px-3 py-2 text-left text-sm hover:bg-superficie-sutil"
                >
                  <ArrowRight aria-hidden className="size-4 shrink-0 text-texto-suave" />
                  <span className="min-w-0 flex-1">
                    Continua na <strong>#{dados.devolvida_para.id}</strong> ({TITULO_COLUNA[dados.devolvida_para.coluna]}):{' '}
                    {dados.devolvida_para.resumo}
                  </span>
                </button>
              )}
            </section>
          )}

          {/* ---------- os arquivos ---------- */}
          <section aria-label="Arquivos" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-texto-suave">
              Arquivos ({dados.anexos.length})
            </h3>
            <ul className="flex flex-col gap-3">
              {dados.anexos.map((a) => {
                const link = links.data?.[a.caminho]
                const tipo = tipoDoArquivo(a.mime)
                return (
                  <li key={a.caminho} className="flex flex-col gap-2 rounded-dm border border-borda p-2">
                    <div className="flex items-center gap-2">
                      <IconeArquivo tipo={tipo} className="size-5 shrink-0 text-texto-suave" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-texto">{a.nome}</span>
                      <span className="shrink-0 text-xs text-texto-suave tabular-nums">{tamanhoLegivel(a.tamanho)}</span>
                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Abrir ${a.nome} em outra aba`}
                          className="toque-seguro inline-flex h-toque-md w-toque-md shrink-0 items-center justify-center rounded-dm text-texto-suave hover:bg-superficie-sutil"
                        >
                          <ExternalLink aria-hidden className="size-4" />
                        </a>
                      )}
                    </div>
                    {link && tipo === 'imagem' && (
                      <a href={link} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={link}
                          alt={a.nome}
                          loading="lazy"
                          className="max-h-80 w-auto max-w-full rounded border border-borda object-contain"
                        />
                      </a>
                    )}
                    {link && tipo === 'audio' && <audio controls preload="none" src={link} className="w-full" />}
                    {link && tipo === 'video' && (
                      <video controls preload="metadata" src={link} className="max-h-80 w-full rounded bg-grafite-950" />
                    )}
                    {!link && links.isPending && (
                      <span className="text-xs text-texto-fraco">Abrindo o arquivo…</span>
                    )}
                  </li>
                )
              })}
            </ul>
            {links.isError && (
              <p role="alert" className="text-sm text-danificado-texto">
                Não deu para abrir os arquivos agora — feche e abra a sugestão de novo.
              </p>
            )}
          </section>

          {/* ---------- mover (só o super admin — D-261) ---------- */}
          {dados.eu_movo && (
            <section aria-label="Mover a sugestão" className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-texto-suave">Mover para</h3>
              <div className="flex flex-wrap gap-2">
                {COLUNAS.map((c) => (
                  <Botao
                    key={c.chave}
                    variante="secundaria"
                    tamanho="sm"
                    disabled={c.chave === dados.coluna || mover.isPending}
                    aria-pressed={c.chave === dados.coluna}
                    onClick={() => {
                      if (c.chave === 'recusada') setRecusando(true)
                      else mover.mutate({ para: c.chave })
                    }}
                    className={cn(c.chave === dados.coluna && 'ring-2 ring-acao')}
                  >
                    {c.titulo}
                  </Botao>
                ))}
              </div>
              {recusando && (
                <div className="flex flex-col gap-2 rounded-dm border border-borda p-3">
                  <label htmlFor="motivo-recusa" className="text-sm font-semibold text-texto">
                    Motivo da recusa <span className="font-normal text-texto-suave">— vai no aviso para quem sugeriu</span>
                  </label>
                  <textarea
                    id="motivo-recusa"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="w-full rounded-dm border border-borda-forte bg-superficie px-3 py-2 text-base text-texto"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Botao variante="secundaria" onClick={() => setRecusando(false)}>
                      Cancelar
                    </Botao>
                    <Botao
                      variante="perigo"
                      disabled={motivo.trim().length < 5}
                      carregando={mover.isPending}
                      onClick={() => mover.mutate({ para: 'recusada', motivo: motivo.trim() })}
                    >
                      Recusar a sugestão
                    </Botao>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ---------- a história ---------- */}
          <section aria-label="História" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-texto-suave">História</h3>
            <ol className="flex flex-col gap-1.5 border-l-2 border-borda pl-3">
              {dados.historico.map((f, i) => (
                <li key={i} className="text-sm text-texto">
                  <span>{textoDoFato(f)}</span>
                  <span className="block text-xs text-texto-suave">
                    {f.autor_nome ?? 'Sistema'} · {quandoCurto(f.quando)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Modal>
  )
}
