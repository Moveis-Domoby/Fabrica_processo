import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, ListPlus, Pencil, Plus, Tag, Trash2, Wrench, X } from 'lucide-react'
import { Abas, Botao, Campo, Dica, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import {
  arquivarCampo,
  arquivarEtiqueta,
  excluirCampo,
  excluirEtiqueta,
  salvarCampo,
  salvarEtiqueta,
} from '@/utilitarios/api'
import { useCampos, useEtiquetas } from '@/utilitarios/consultas'
import { PilulaEtiqueta } from '@/utilitarios/PilulaEtiqueta'
import { CORES_ETIQUETA, ROTULO_COR, ROTULO_TIPO_CAMPO, TIPOS_CAMPO } from '@/utilitarios/tipos'
import type { CampoCustomizado, CorEtiqueta, Etiqueta, TipoCampo } from '@/utilitarios/tipos'

type AbaUtilitarios = 'etiquetas' | 'campos'

/**
 * Configurações → Utilitários (SESSAO-27 · D-101 — pedido do dono: "crie uma
 * aba na página de admin chamada Utilitários, lá dentro coloque para cadastrar
 * etiquetas e campos customizados"). Só admin (a rota e as portas do banco).
 * As etiquetas e os campos são usados pelas automações do Painel super admin.
 */
export function Utilitarios() {
  const [parametros, setParametros] = useSearchParams()
  const aba: AbaUtilitarios = parametros.get('aba') === 'campos' ? 'campos' : 'etiquetas'

  return (
    <div className="flex flex-col gap-5">
      <div className="relative flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-2xl sm:text-3xl">
          <Wrench aria-hidden className="size-7 shrink-0 text-texto-suave" />
          Utilitários
        </h1>
        <Dica rotulo="Para que servem os utilitários">
          <span className="flex flex-col gap-2">
            <span>
              Etiquetas são marcas coloridas que as automações põem e tiram dos cards — um card pode ter
              várias, e elas aparecem no quadro e no tablet.
            </span>
            <span>
              Campos customizados são informações a mais que você define: valem nas peças, nos pedidos ou
              nos dois. A automação preenche, e o admin também pode preencher à mão no card.
            </span>
            <span>Usado não se exclui: arquiva, e a história fica.</span>
          </span>
        </Dica>
      </div>

      <Abas
        rotulo="O que cadastrar"
        idBase="utilitarios"
        valor={aba}
        aoMudar={(valor) => setParametros(valor === 'etiquetas' ? {} : { aba: valor }, { replace: true })}
        abas={[
          { valor: 'etiquetas', rotulo: 'Etiquetas', icone: <Tag aria-hidden className="size-4" /> },
          { valor: 'campos', rotulo: 'Campos customizados', icone: <ListPlus aria-hidden className="size-4" /> },
        ]}
      />

      <div role="tabpanel" id="utilitarios-painel" aria-labelledby={`utilitarios-aba-${aba}`}>
        {aba === 'etiquetas' ? <PainelEtiquetas /> : <PainelCampos />}
      </div>
    </div>
  )
}

function useErro() {
  const notificar = useNotificacao()
  return (excecao: unknown) =>
    notificar({
      titulo: 'Não deu certo',
      descricao: excecao instanceof Error ? excecao.message : 'Tente de novo.',
      tom: 'danificado',
    })
}

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------

function PainelEtiquetas() {
  const notificar = useNotificacao()
  const aoErro = useErro()
  const clienteQuery = useQueryClient()
  const { data: etiquetas = [], isPending } = useEtiquetas()
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false)
  const [editando, setEditando] = useState<Etiqueta | 'nova' | null>(null)
  const [excluindo, setExcluindo] = useState<Etiqueta | null>(null)

  const invalidar = () => clienteQuery.invalidateQueries({ queryKey: ['etiquetas'] })
  const arquivar = useMutation({
    mutationFn: ({ id, arquivar: a }: { id: number; arquivar: boolean }) => arquivarEtiqueta(id, a),
    onSuccess: async (_d, { arquivar: a }) => {
      notificar({ titulo: a ? 'Etiqueta arquivada' : 'Etiqueta reativada', tom: 'perfeito' })
      await invalidar()
    },
    onError: aoErro,
  })
  const excluir = useMutation({
    mutationFn: excluirEtiqueta,
    onSuccess: async () => {
      notificar({ titulo: 'Etiqueta excluída', tom: 'perfeito' })
      setExcluindo(null)
      await invalidar()
    },
    onError: (excecao) => {
      setExcluindo(null)
      aoErro(excecao)
    },
  })

  const visiveis = etiquetas.filter((e) => mostrarArquivadas || e.arquivada_em === null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex min-h-toque-md items-center gap-2 text-sm text-texto">
          <input
            type="checkbox"
            className="size-5 accent-marca-500"
            checked={mostrarArquivadas}
            onChange={(e) => setMostrarArquivadas(e.target.checked)}
          />
          Mostrar arquivadas
        </label>
        <Botao icone={<Plus />} onClick={() => setEditando('nova')}>
          Nova etiqueta
        </Botao>
      </div>

      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {!isPending && visiveis.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nenhuma etiqueta cadastrada ainda.
        </p>
      )}
      {visiveis.length > 0 && (
        <ul className="rounded-dm-lg border border-borda bg-superficie">
          {visiveis.map((e) => (
            <li
              key={e.id}
              className={cn(
                'flex flex-wrap items-center gap-3 border-b border-borda px-4 py-2 last:border-b-0',
                e.arquivada_em && 'opacity-70',
              )}
            >
              <PilulaEtiqueta etiqueta={e} />
              <span className="text-xs text-texto-suave">{ROTULO_COR[e.cor]}</span>
              {e.arquivada_em && (
                <span className="rounded-full bg-superficie-sutil px-2 py-0.5 text-xs text-texto-suave">arquivada</span>
              )}
              <span className="ml-auto flex items-center gap-1">
                <Botao variante="fantasma" tamanho="sm" icone={<Pencil />} onClick={() => setEditando(e)}>
                  Editar
                </Botao>
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  icone={e.arquivada_em ? <ArchiveRestore /> : <Archive />}
                  carregando={arquivar.isPending && arquivar.variables?.id === e.id}
                  onClick={() => arquivar.mutate({ id: e.id, arquivar: e.arquivada_em === null })}
                >
                  {e.arquivada_em ? 'Reativar' : 'Arquivar'}
                </Botao>
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  icone={<Trash2 />}
                  aria-label={`Excluir a etiqueta ${e.nome}`}
                  onClick={() => setExcluindo(e)}
                />
              </span>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <ModalEtiqueta
          etiqueta={editando === 'nova' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => {
            setEditando(null)
            await invalidar()
          }}
        />
      )}
      <Modal
        aberto={excluindo !== null}
        aoFechar={(aberto) => !aberto && setExcluindo(null)}
        titulo="Excluir a etiqueta?"
        descricao="Só dá para excluir etiqueta que nunca foi usada. Se já foi usada, arquive — a história fica."
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => setExcluindo(null)}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              carregando={excluir.isPending}
              onClick={() => excluindo && excluir.mutate(excluindo.id)}
            >
              Excluir
            </Botao>
          </>
        }
      >
        {excluindo && <PilulaEtiqueta etiqueta={excluindo} />}
      </Modal>
    </div>
  )
}

function ModalEtiqueta({
  etiqueta,
  aoFechar,
  aoSalvar,
}: {
  etiqueta: Etiqueta | null
  aoFechar: () => void
  aoSalvar: () => Promise<void>
}) {
  const notificar = useNotificacao()
  const aoErro = useErro()
  const [nome, setNome] = useState(etiqueta?.nome ?? '')
  const [cor, setCor] = useState<CorEtiqueta>(etiqueta?.cor ?? 'azul')
  const [erro, setErro] = useState('')

  const salvar = useMutation({
    mutationFn: () => salvarEtiqueta({ id: etiqueta?.id ?? null, nome: nome.trim(), cor }),
    onSuccess: async () => {
      notificar({ titulo: etiqueta ? 'Etiqueta alterada' : 'Etiqueta cadastrada', tom: 'perfeito' })
      await aoSalvar()
    },
    onError: aoErro,
  })

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (!nome.trim()) {
      setErro('Dê um nome à etiqueta.')
      return
    }
    setErro('')
    salvar.mutate()
  }

  return (
    <Modal
      aberto
      aoFechar={(aberto) => !aberto && aoFechar()}
      titulo={etiqueta ? 'Editar etiqueta' : 'Nova etiqueta'}
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" form="form-etiqueta" carregando={salvar.isPending}>
            Salvar
          </Botao>
        </>
      }
    >
      <form id="form-etiqueta" onSubmit={aoEnviar} className="flex flex-col gap-4">
        <Campo rotulo="Nome" value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} erro={erro} />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-texto">Cor</legend>
          <div className="flex flex-wrap gap-2">
            {CORES_ETIQUETA.map((c) => (
              <label
                key={c}
                className={cn(
                  'inline-flex min-h-toque-md cursor-pointer items-center gap-2 rounded-dm border px-2',
                  cor === c ? 'border-acao-ativa bg-superficie-sutil' : 'border-borda',
                )}
              >
                <input
                  type="radio"
                  name="cor-etiqueta"
                  value={c}
                  checked={cor === c}
                  onChange={() => setCor(c)}
                  className="size-4 accent-marca-500"
                />
                <PilulaEtiqueta etiqueta={{ nome: ROTULO_COR[c], cor: c }} />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-2 text-sm text-texto-suave">
          Como vai ficar: <PilulaEtiqueta etiqueta={{ nome: nome.trim() || 'Etiqueta', cor }} />
        </div>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Campos customizados
// ---------------------------------------------------------------------------

function ondeVale(c: Pick<CampoCustomizado, 'em_pecas' | 'em_pedidos'>): string {
  if (c.em_pecas && c.em_pedidos) return 'Nas peças e nos pedidos'
  return c.em_pecas ? 'Nas peças' : 'Nos pedidos'
}

function PainelCampos() {
  const notificar = useNotificacao()
  const aoErro = useErro()
  const clienteQuery = useQueryClient()
  const { data: campos = [], isPending } = useCampos()
  const [mostrarArquivados, setMostrarArquivados] = useState(false)
  const [editando, setEditando] = useState<CampoCustomizado | 'novo' | null>(null)
  const [excluindo, setExcluindo] = useState<CampoCustomizado | null>(null)

  const invalidar = () => clienteQuery.invalidateQueries({ queryKey: ['campos'] })
  const arquivar = useMutation({
    mutationFn: ({ id, arquivar: a }: { id: number; arquivar: boolean }) => arquivarCampo(id, a),
    onSuccess: async (_d, { arquivar: a }) => {
      notificar({ titulo: a ? 'Campo arquivado' : 'Campo reativado', tom: 'perfeito' })
      await invalidar()
    },
    onError: aoErro,
  })
  const excluir = useMutation({
    mutationFn: excluirCampo,
    onSuccess: async () => {
      notificar({ titulo: 'Campo excluído', tom: 'perfeito' })
      setExcluindo(null)
      await invalidar()
    },
    onError: (excecao) => {
      setExcluindo(null)
      aoErro(excecao)
    },
  })

  const visiveis = campos.filter((c) => mostrarArquivados || c.arquivado_em === null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex min-h-toque-md items-center gap-2 text-sm text-texto">
          <input
            type="checkbox"
            className="size-5 accent-marca-500"
            checked={mostrarArquivados}
            onChange={(e) => setMostrarArquivados(e.target.checked)}
          />
          Mostrar arquivados
        </label>
        <Botao icone={<Plus />} onClick={() => setEditando('novo')}>
          Novo campo
        </Botao>
      </div>

      {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
      {!isPending && visiveis.length === 0 && (
        <p className="rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Nenhum campo customizado cadastrado ainda.
        </p>
      )}
      {visiveis.length > 0 && (
        <ul className="rounded-dm-lg border border-borda bg-superficie">
          {visiveis.map((c) => (
            <li
              key={c.id}
              className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-borda px-4 py-2 last:border-b-0',
                c.arquivado_em && 'opacity-70',
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-medium text-texto">{c.nome}</span>
                <span className="text-xs text-texto-suave">
                  {ROTULO_TIPO_CAMPO[c.tipo]} · {ondeVale(c)}
                  {c.tipo === 'lista' && c.opcoes.length > 0 && ` · ${c.opcoes.join(', ')}`}
                </span>
              </span>
              {c.arquivado_em && (
                <span className="rounded-full bg-superficie-sutil px-2 py-0.5 text-xs text-texto-suave">arquivado</span>
              )}
              <span className="ml-auto flex items-center gap-1">
                <Botao variante="fantasma" tamanho="sm" icone={<Pencil />} onClick={() => setEditando(c)}>
                  Editar
                </Botao>
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  icone={c.arquivado_em ? <ArchiveRestore /> : <Archive />}
                  carregando={arquivar.isPending && arquivar.variables?.id === c.id}
                  onClick={() => arquivar.mutate({ id: c.id, arquivar: c.arquivado_em === null })}
                >
                  {c.arquivado_em ? 'Reativar' : 'Arquivar'}
                </Botao>
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  icone={<Trash2 />}
                  aria-label={`Excluir o campo ${c.nome}`}
                  onClick={() => setExcluindo(c)}
                />
              </span>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <ModalCampo
          campo={editando === 'novo' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => {
            setEditando(null)
            await invalidar()
          }}
        />
      )}
      <Modal
        aberto={excluindo !== null}
        aoFechar={(aberto) => !aberto && setExcluindo(null)}
        titulo="Excluir o campo?"
        descricao="Só dá para excluir campo que nunca teve valor. Se já foi usado, arquive — a história fica."
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => setExcluindo(null)}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              carregando={excluir.isPending}
              onClick={() => excluindo && excluir.mutate(excluindo.id)}
            >
              Excluir
            </Botao>
          </>
        }
      >
        {excluindo && <p className="font-medium text-texto">{excluindo.nome}</p>}
      </Modal>
    </div>
  )
}

function ModalCampo({
  campo,
  aoFechar,
  aoSalvar,
}: {
  campo: CampoCustomizado | null
  aoFechar: () => void
  aoSalvar: () => Promise<void>
}) {
  const notificar = useNotificacao()
  const aoErro = useErro()
  const [nome, setNome] = useState(campo?.nome ?? '')
  const [tipo, setTipo] = useState<TipoCampo>(campo?.tipo ?? 'texto')
  const [opcoes, setOpcoes] = useState<string[]>(campo?.opcoes.length ? campo.opcoes : [''])
  const [emPecas, setEmPecas] = useState(campo?.em_pecas ?? true)
  const [emPedidos, setEmPedidos] = useState(campo?.em_pedidos ?? false)
  const [erro, setErro] = useState('')

  const salvar = useMutation({
    mutationFn: () =>
      salvarCampo({
        id: campo?.id ?? null,
        nome: nome.trim(),
        tipo,
        opcoes: tipo === 'lista' ? opcoes.map((o) => o.trim()).filter(Boolean) : [],
        emPecas,
        emPedidos,
      }),
    onSuccess: async () => {
      notificar({ titulo: campo ? 'Campo alterado' : 'Campo cadastrado', tom: 'perfeito' })
      await aoSalvar()
    },
    onError: aoErro,
  })

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (!nome.trim()) return setErro('Dê um nome ao campo.')
    if (!emPecas && !emPedidos) return setErro('Escolha onde o campo vale: nas peças, nos pedidos ou nos dois.')
    if (tipo === 'lista' && opcoes.every((o) => !o.trim())) return setErro('A lista precisa de pelo menos uma opção.')
    setErro('')
    salvar.mutate()
  }

  return (
    <Modal
      aberto
      aoFechar={(aberto) => !aberto && aoFechar()}
      titulo={campo ? 'Editar campo' : 'Novo campo'}
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" form="form-campo" carregando={salvar.isPending}>
            Salvar
          </Botao>
        </>
      }
    >
      <form id="form-campo" onSubmit={aoEnviar} className="flex flex-col gap-4">
        <Campo rotulo="Nome" value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} />
        <Selecao
          rotulo="Tipo"
          valor={tipo}
          aoMudar={(v) => setTipo(v as TipoCampo)}
          opcoes={TIPOS_CAMPO.map((t) => ({ valor: t, rotulo: ROTULO_TIPO_CAMPO[t] }))}
          ajuda={campo ? 'Campo que já tem valores não muda de tipo.' : undefined}
        />
        {tipo === 'lista' && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-texto">Opções</legend>
            {opcoes.map((opcao, indice) => (
              <div key={indice} className="flex items-end gap-2">
                <Campo
                  rotulo={`Opção ${indice + 1}`}
                  rotuloOculto
                  value={opcao}
                  maxLength={60}
                  onChange={(e) => setOpcoes((atual) => atual.map((o, i) => (i === indice ? e.target.value : o)))}
                />
                <Botao
                  variante="fantasma"
                  icone={<X />}
                  aria-label={`Tirar a opção ${indice + 1}`}
                  onClick={() => setOpcoes((atual) => (atual.length > 1 ? atual.filter((_, i) => i !== indice) : ['']))}
                />
              </div>
            ))}
            <Botao
              variante="secundaria"
              tamanho="sm"
              icone={<Plus />}
              onClick={() => setOpcoes((atual) => [...atual, ''])}
              className="self-start"
            >
              Mais uma opção
            </Botao>
          </fieldset>
        )}
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium text-texto">Onde o campo vale</legend>
          <label className="inline-flex min-h-toque-md items-center gap-2 text-sm text-texto">
            <input type="checkbox" className="size-5 accent-marca-500" checked={emPecas} onChange={(e) => setEmPecas(e.target.checked)} />
            Nas peças (os cards que andam pelos setores)
          </label>
          <label className="inline-flex min-h-toque-md items-center gap-2 text-sm text-texto">
            <input type="checkbox" className="size-5 accent-marca-500" checked={emPedidos} onChange={(e) => setEmPedidos(e.target.checked)} />
            Nos pedidos (o card do pedido no PCP e a lista de todos os pedidos)
          </label>
        </fieldset>
        {erro && <p className="text-sm text-danificado-forte">{erro}</p>}
      </form>
    </Modal>
  )
}
