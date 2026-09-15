import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Image, Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { Botao, Campo, Modal, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { useSessao } from '@/autenticacao/sessao-contexto'
import {
  arquivarCaminhao,
  atualizarCaminhao,
  CaminhaoEmUsoError,
  criarCaminhao,
  enviarFotoCaminhao,
  excluirCaminhao,
  listarCaminhoes,
  removerFotoCaminhao,
  urlFotoCaminhao,
} from '@/admin/caminhoes'
import type { Caminhao } from '@/admin/caminhoes'

/**
 * Administração → Caminhões (SESSAO-15 / D-39): cadastro completo — nome ou
 * apelido, placa, capacidade em texto livre e foto. Caminhão que já tem
 * entrega programada não se exclui: o banco recusa e a tela oferece arquivar
 * (some das escolhas, a história fica).
 */
export function Caminhoes() {
  const { perfil } = useSessao()
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()

  const [mostrarArquivados, setMostrarArquivados] = useState(false)
  const [modal, setModal] = useState<{ caminhao: Caminhao | null } | null>(null)
  const [excluindo, setExcluindo] = useState<Caminhao | null>(null)
  const [emUso, setEmUso] = useState<Caminhao | null>(null)

  const { data: caminhoes = [], isPending } = useQuery({
    queryKey: ['caminhoes', mostrarArquivados],
    queryFn: () => listarCaminhoes(mostrarArquivados),
  })

  async function invalidar() {
    await clienteQuery.invalidateQueries({ queryKey: ['caminhoes'] })
  }
  function aoErro(excecao: unknown) {
    notificar({
      titulo: 'Não deu certo',
      descricao: excecao instanceof Error ? excecao.message : 'Tente de novo.',
      tom: 'danificado',
    })
  }

  const arquivarMutacao = useMutation({
    mutationFn: ({ id, arquivar }: { id: number; arquivar: boolean }) => arquivarCaminhao(id, arquivar),
    onSuccess: async (_d, { arquivar }) => {
      notificar({ titulo: arquivar ? 'Caminhão arquivado' : 'Caminhão reativado', tom: 'perfeito' })
      setEmUso(null)
      await invalidar()
    },
    onError: aoErro,
  })

  const excluirMutacao = useMutation({
    mutationFn: excluirCaminhao,
    onSuccess: async () => {
      notificar({ titulo: 'Caminhão excluído', tom: 'perfeito' })
      setExcluindo(null)
      await invalidar()
    },
    onError: (excecao, caminhao) => {
      setExcluindo(null)
      // D-39: em uso não se exclui — oferece arquivar.
      if (excecao instanceof CaminhaoEmUsoError) setEmUso(caminhao)
      else aoErro(excecao)
    },
  })

  if (!perfil) return null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl sm:text-3xl">
            <Truck aria-hidden className="size-7 text-texto-suave" />
            Caminhões
          </h1>
          <p className="mt-1 max-w-2xl text-texto-suave">
            Os caminhões da logística, com foto. Caminhão que já rodou entrega não se exclui —
            arquiva, e a história fica.
          </p>
        </div>
        <Botao icone={<Plus />} onClick={() => setModal({ caminhao: null })}>
          Novo caminhão
        </Botao>
      </div>

      <label className="inline-flex min-h-toque-md items-center gap-2 text-sm text-texto">
        <input
          type="checkbox"
          className="size-5 accent-marca-500"
          checked={mostrarArquivados}
          onChange={(e) => setMostrarArquivados(e.target.checked)}
        />
        Mostrar arquivados
      </label>

      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {!isPending && caminhoes.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nenhum caminhão cadastrado ainda.
        </p>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {caminhoes.map((c) => {
          const foto = urlFotoCaminhao(c.foto_caminho)
          const arquivado = c.arquivado_em !== null
          return (
            <li
              key={c.id}
              className={cn(
                'flex flex-col overflow-hidden rounded-dm-lg border bg-superficie',
                arquivado ? 'border-borda opacity-75' : 'border-borda',
              )}
            >
              {foto ? (
                <img src={foto} alt={`Foto do caminhão ${c.nome}`} className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 items-center justify-center bg-superficie-sutil text-texto-fraco">
                  <Truck aria-hidden className="size-12" />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-1 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-texto">{c.nome}</span>
                  {arquivado && (
                    <span className="rounded-full bg-superficie-sutil px-2 py-0.5 text-xs font-medium text-texto-suave">
                      arquivado
                    </span>
                  )}
                </div>
                <p className="text-sm text-texto-suave tabular-nums">
                  {c.placa ?? 'sem placa'}
                  {c.capacidade ? ` · ${c.capacidade}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Botao
                    variante="secundaria"
                    tamanho="sm"
                    icone={<Pencil />}
                    onClick={() => setModal({ caminhao: c })}
                  >
                    Editar
                  </Botao>
                  {arquivado ? (
                    <Botao
                      variante="secundaria"
                      tamanho="sm"
                      icone={<ArchiveRestore />}
                      onClick={() => arquivarMutacao.mutate({ id: c.id, arquivar: false })}
                    >
                      Reativar
                    </Botao>
                  ) : (
                    <Botao
                      variante="secundaria"
                      tamanho="sm"
                      icone={<Archive />}
                      onClick={() => arquivarMutacao.mutate({ id: c.id, arquivar: true })}
                    >
                      Arquivar
                    </Botao>
                  )}
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    icone={<Trash2 />}
                    onClick={() => setExcluindo(c)}
                  >
                    Excluir
                  </Botao>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {modal && (
        <ModalCaminhao
          key={modal.caminhao?.id ?? 'novo'}
          caminhao={modal.caminhao}
          criadoPor={perfil.id}
          aoFechar={() => setModal(null)}
          aoSalvo={async () => {
            setModal(null)
            await invalidar()
          }}
        />
      )}

      <Modal
        aberto={excluindo !== null}
        aoFechar={(a) => {
          if (!a) setExcluindo(null)
        }}
        titulo={excluindo ? `Excluir ${excluindo.nome}?` : 'Excluir'}
        descricao="Só dá para excluir caminhão que nunca rodou entrega. Se já rodou, o sistema vai oferecer arquivar."
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => setExcluindo(null)}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              carregando={excluirMutacao.isPending}
              onClick={() => excluindo && excluirMutacao.mutate(excluindo)}
            >
              Excluir
            </Botao>
          </>
        }
      />

      <Modal
        aberto={emUso !== null}
        aoFechar={(a) => {
          if (!a) setEmUso(null)
        }}
        titulo={emUso ? `${emUso.nome} já tem entregas programadas` : 'Em uso'}
        descricao="Caminhão em uso não pode ser excluído — a história das entregas aponta para ele. Quer arquivar? Ele some das escolhas e tudo fica registrado."
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => setEmUso(null)}>
              Deixar como está
            </Botao>
            <Botao
              variante="primaria"
              icone={<Archive />}
              carregando={arquivarMutacao.isPending}
              onClick={() => emUso && arquivarMutacao.mutate({ id: emUso.id, arquivar: true })}
            >
              Arquivar
            </Botao>
          </>
        }
      />
    </div>
  )
}

function ModalCaminhao({
  caminhao,
  criadoPor,
  aoFechar,
  aoSalvo,
}: {
  caminhao: Caminhao | null
  criadoPor: string
  aoFechar: () => void
  aoSalvo: () => Promise<void>
}) {
  const notificar = useNotificacao()
  const [nome, setNome] = useState(caminhao?.nome ?? '')
  const [placa, setPlaca] = useState(caminhao?.placa ?? '')
  const [capacidade, setCapacidade] = useState(caminhao?.capacidade ?? '')
  const [foto, setFoto] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const [fotoAtual, setFotoAtual] = useState(caminhao?.foto_caminho ?? null)
  const entradaFoto = useRef<HTMLInputElement>(null)

  const salvar = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error('Dê um nome ou apelido ao caminhão.')
      let id = caminhao?.id
      if (id) {
        await atualizarCaminhao(id, { nome, placa, capacidade })
      } else {
        id = await criarCaminhao({ nome, placa, capacidade, criadoPor })
      }
      if (foto) await enviarFotoCaminhao(id, foto, fotoAtual)
    },
    onSuccess: async () => {
      notificar({ titulo: caminhao ? 'Caminhão salvo' : 'Caminhão cadastrado', tom: 'perfeito' })
      await aoSalvo()
    },
    onError: (excecao) => setErro(excecao instanceof Error ? excecao.message : 'Não deu certo.'),
  })

  const removerFoto = useMutation({
    mutationFn: () => removerFotoCaminhao(caminhao!.id, fotoAtual!),
    onSuccess: () => {
      setFotoAtual(null)
      setFoto(null)
    },
    onError: (excecao) => setErro(excecao instanceof Error ? excecao.message : 'Não deu certo.'),
  })

  const previa = foto ? URL.createObjectURL(foto) : urlFotoCaminhao(fotoAtual)

  return (
    <Modal
      aberto
      aoFechar={(a) => {
        if (!a) aoFechar()
      }}
      titulo={caminhao ? `Editar ${caminhao.nome}` : 'Novo caminhão'}
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="primaria" carregando={salvar.isPending} onClick={() => salvar.mutate()}>
            {caminhao ? 'Salvar' : 'Cadastrar'}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo
          rotulo="Nome ou apelido"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="ex.: Baú branco"
          erro={erro || undefined}
        />
        <Campo
          rotulo="Placa (opcional)"
          value={placa}
          onChange={(e) => setPlaca(e.target.value.toUpperCase())}
          placeholder="ex.: ABC1D23"
        />
        <Campo
          rotulo="Capacidade (texto livre, opcional)"
          value={capacidade}
          onChange={(e) => setCapacidade(e.target.value)}
          placeholder="ex.: 12 m³ ou 3 guarda-roupas + 2 camas"
        />

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-texto">Foto</span>
          {previa ? (
            <img src={previa} alt="" className="h-40 w-full rounded-dm object-cover" />
          ) : (
            <div className="flex h-24 items-center justify-center rounded-dm border border-dashed border-borda-forte text-texto-fraco">
              <Image aria-hidden className="size-8" />
            </div>
          )}
          <input
            ref={entradaFoto}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap gap-2">
            <Botao
              type="button"
              variante="secundaria"
              tamanho="sm"
              icone={<Image />}
              onClick={() => entradaFoto.current?.click()}
            >
              {previa ? 'Trocar foto' : 'Escolher foto'}
            </Botao>
            {fotoAtual && caminhao && !foto && (
              <Botao
                type="button"
                variante="fantasma"
                tamanho="sm"
                carregando={removerFoto.isPending}
                onClick={() => removerFoto.mutate()}
              >
                Remover foto
              </Botao>
            )}
            {foto && (
              <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => setFoto(null)}>
                Desfazer escolha
              </Botao>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
