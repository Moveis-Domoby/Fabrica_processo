import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Flag,
  Save,
  Tag,
  UserPlus,
  Wrench,
} from 'lucide-react'
import { Botao, Campo, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { buscarSetores } from '../api'
import { abrirAjusteDePeca, chaveDoGesto, criarCardAvulso } from '../avulso'
import type { OpcaoVinculo, PessoaMini, VinculoTipo } from '../avulso'
import { ROTULO_DESTINO_FINAL } from '@/logistica/devolucao'
import type { DestinoFinalAjuste } from '@/logistica/devolucao'
import { EtiquetasDoCard } from '@/utilitarios/PilulaEtiqueta'
import { SeletorEtiquetas, SeletorPessoas, SeletorVinculo } from './Seletores'
import { PontoPrioridade, SeletorPrioridade } from '../componentes/MarcasDoCard'
import { ROTULO_PRIORIDADE } from '../prioridade'
import type { Prioridade } from '../prioridade'

type Tipo = 'avulso' | 'ajuste'
type Aberto = 'responsaveis' | 'datas' | 'prioridade' | 'etiquetas' | null

/**
 * "Novo card" do Lançamento manual (D-125 / §1 — a criação rápida do ClickUp):
 * o NOME e Salvar (Enter); embaixo, os atalhos opcionais — responsável, datas,
 * prioridade (↩️ SESSAO-38: própria, não é mais etiqueta — D-150), etiqueta — e "Mais detalhes" (descrição, vínculo, lançar já para
 * um setor). O tipo "Ajuste de peça" (D-130) leva a peça de volta à produção
 * com o destino final.
 */
export function ModalNovoCardAvulso({
  aberto,
  aoFechar,
}: {
  aberto: boolean
  aoFechar: () => void
}) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const [tipo, setTipo] = useState<Tipo>('avulso')
  const [chave, setChave] = useState(chaveDoGesto)
  const [titulo, setTitulo] = useState('')
  const [responsaveis, setResponsaveis] = useState<PessoaMini[]>([])
  const [etiquetas, setEtiquetas] = useState<number[]>([])
  const [prioridade, setPrioridade] = useState<Prioridade>('comum')
  const [inicio, setInicio] = useState('')
  const [vence, setVence] = useState('')
  const [aberta, setAberta] = useState<Aberto>(null)
  const [maisDetalhes, setMaisDetalhes] = useState(false)
  const [descricao, setDescricao] = useState('')
  const [vinculo, setVinculo] = useState<(OpcaoVinculo & { tipo: VinculoTipo }) | null>(null)
  const [setorId, setSetorId] = useState('')
  const [destinoFinal, setDestinoFinal] = useState<DestinoFinalAjuste | ''>('')
  const [erro, setErro] = useState('')

  const { data: setores = [] } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
    enabled: aberto,
  })
  const opcoesSetor = setores
    .filter((s) => s.papel_no_fluxo === 'producao')
    .map((s) => ({ valor: String(s.id), rotulo: s.nome }))

  function limparDepoisDeSalvar() {
    setChave(chaveDoGesto())
    setTitulo('')
    setResponsaveis([])
    setEtiquetas([])
    setPrioridade('comum')
    setInicio('')
    setVence('')
    setDescricao('')
    setVinculo(null)
    setDestinoFinal('')
    setAberta(null)
    setErro('')
  }

  const criar = useMutation({
    mutationFn: () =>
      criarCardAvulso({
        titulo,
        descricao,
        inicio,
        vence,
        responsaveis: responsaveis.map((p) => p.id),
        etiquetas,
        prioridade,
        vinculo: vinculo ? { tipo: vinculo.tipo, id: vinculo.id } : null,
        setorId: setorId ? Number(setorId) : null,
        chave,
      }),
    onSuccess: async () => {
      notificar({
        titulo: setorId
          ? 'Card criado e lançado para a produção'
          : 'Card criado — está em "A lançar"',
        tom: 'perfeito',
      })
      limparDepoisDeSalvar()
      await clienteQuery.invalidateQueries({ queryKey: ['avulsos'] })
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'Não deu para criar o card.'),
  })
  const ajuste = useMutation({
    mutationFn: () =>
      abrirAjusteDePeca({
        pecaId: vinculo!.id,
        setorId: Number(setorId),
        destinoFinal: destinoFinal as DestinoFinalAjuste,
        descricao,
      }),
    onSuccess: async () => {
      notificar({ titulo: 'Peça mandada para ajuste — está em "Em produção"', tom: 'perfeito' })
      limparDepoisDeSalvar()
      aoFechar()
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['avulsos'] }),
        clienteQuery.invalidateQueries({ queryKey: ['quadro'] }),
        clienteQuery.invalidateQueries({ queryKey: ['estoque'] }),
        clienteQuery.invalidateQueries({ queryKey: ['devolucoes'] }),
      ])
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'Não deu para abrir o ajuste.'),
  })

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (tipo === 'avulso') {
      if (!titulo.trim()) return setErro('Dê um nome ao card.')
      if (inicio && vence && inicio > vence) return setErro('O início vem antes do vencimento.')
      setErro('')
      criar.mutate()
    } else {
      if (!vinculo) return setErro('Escolha a peça que vai para ajuste.')
      if (!setorId) return setErro('Escolha o setor onde a peça vai ser ajustada.')
      if (!destinoFinal) return setErro('Escolha o destino final da peça.')
      setErro('')
      ajuste.mutate()
    }
  }

  const atalho = (qual: Exclude<Aberto, null>) => setAberta((a) => (a === qual ? null : qual))

  return (
    <Modal
      aberto={aberto}
      aoFechar={(v) => !v && aoFechar()}
      titulo="Novo card"
      descricao="Trabalho que não nasce de pedido nem de reposição — anda pelos quadros como qualquer card."
      tamanho="galpao"
    >
      <form className="flex flex-col gap-4" onSubmit={aoEnviar}>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de card">
          {(
            [
              ['avulso', 'Card avulso'],
              ['ajuste', 'Ajuste de peça'],
            ] as const
          ).map(([v, r]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={tipo === v}
              onClick={() => {
                setTipo(v)
                setVinculo(null)
                setErro('')
              }}
              className={cn(
                'inline-flex min-h-toque-md items-center gap-1.5 rounded-full border px-3 text-sm font-medium',
                tipo === v
                  ? 'border-acao-ativa bg-acao text-acao-texto'
                  : 'border-borda-forte bg-superficie text-texto-suave',
              )}
            >
              {v === 'ajuste' && <Wrench aria-hidden className="size-4" />}
              {r}
            </button>
          ))}
        </div>

        {tipo === 'avulso' ? (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Campo
                  rotulo="Nome do card"
                  placeholder="Ex.: Trocar a lâmina da serra"
                  maxLength={200}
                  autoFocus
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              </div>
              <Botao type="submit" icone={<Save />} carregando={criar.isPending}>
                Salvar (Enter)
              </Botao>
            </div>

            {/* Os atalhos opcionais (print 1 do dono). */}
            <div className="flex flex-wrap gap-2">
              <Botao
                type="button"
                variante={aberta === 'responsaveis' ? 'secundaria' : 'fantasma'}
                tamanho="sm"
                icone={<UserPlus />}
                onClick={() => atalho('responsaveis')}
              >
                {responsaveis.length > 0
                  ? `Responsáveis (${responsaveis.length})`
                  : 'Adicionar responsável'}
              </Botao>
              <Botao
                type="button"
                variante={aberta === 'datas' ? 'secundaria' : 'fantasma'}
                tamanho="sm"
                icone={<CalendarDays />}
                onClick={() => atalho('datas')}
              >
                {vence ? `Vence ${vence.slice(8, 10)}/${vence.slice(5, 7)}` : 'Adicionar datas'}
              </Botao>
              <Botao
                type="button"
                variante={aberta === 'prioridade' ? 'secundaria' : 'fantasma'}
                tamanho="sm"
                icone={
                  prioridade === 'comum' ? <Flag /> : <PontoPrioridade prioridade={prioridade} />
                }
                onClick={() => atalho('prioridade')}
              >
                {prioridade === 'comum' ? 'Prioridade' : ROTULO_PRIORIDADE[prioridade]}
              </Botao>
              <Botao
                type="button"
                variante={aberta === 'etiquetas' ? 'secundaria' : 'fantasma'}
                tamanho="sm"
                icone={<Tag />}
                onClick={() => atalho('etiquetas')}
              >
                {etiquetas.length > 0 ? `Etiquetas (${etiquetas.length})` : 'Etiqueta'}
              </Botao>
            </div>
            {responsaveis.length > 0 && aberta !== 'responsaveis' && (
              <p className="text-sm text-texto-suave">
                Responsáveis: {responsaveis.map((p) => p.nome).join(', ')}
              </p>
            )}
            {etiquetas.length > 0 && aberta !== 'etiquetas' && <EtiquetasDoCard ids={etiquetas} />}
            {aberta === 'responsaveis' && (
              <SeletorPessoas escolhidas={responsaveis} aoMudar={setResponsaveis} />
            )}
            {aberta === 'datas' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Campo
                  rotulo="Início"
                  type="date"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                />
                <Campo
                  rotulo="Vencimento"
                  type="date"
                  value={vence}
                  onChange={(e) => setVence(e.target.value)}
                />
              </div>
            )}
            {aberta === 'prioridade' && (
              <SeletorPrioridade valor={prioridade} aoMudar={setPrioridade} />
            )}
            {aberta === 'etiquetas' && (
              <SeletorEtiquetas escolhidas={etiquetas} aoMudar={setEtiquetas} />
            )}

            <Botao
              type="button"
              variante="fantasma"
              tamanho="sm"
              className="self-start"
              icone={maisDetalhes ? <ChevronUp /> : <ChevronDown />}
              onClick={() => setMaisDetalhes((v) => !v)}
            >
              Mais detalhes
            </Botao>
            {maisDetalhes && (
              <div className="flex flex-col gap-4 rounded-dm border border-borda p-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-texto">
                  Descrição
                  <textarea
                    className="min-h-24 rounded-dm border border-borda-forte bg-superficie p-3 text-sm font-normal text-texto"
                    maxLength={5000}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="O que precisa ser feito, onde, com o quê"
                  />
                </label>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-texto">
                    Vínculo (opcional — só referência)
                  </span>
                  <SeletorVinculo escolhido={vinculo} aoMudar={setVinculo} />
                </div>
                <Selecao
                  rotulo="Lançar já para o setor (opcional)"
                  opcoes={[{ valor: 'nao', rotulo: 'Não — fica em "A lançar"' }, ...opcoesSetor]}
                  valor={setorId || 'nao'}
                  aoMudar={(v) => setSetorId(v === 'nao' ? '' : v)}
                />
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-texto">A peça</span>
              <SeletorVinculo escolhido={vinculo} aoMudar={setVinculo} paraAjuste />
              <p className="text-xs text-texto-suave">
                Vale a peça em decisão pós devolução, no ESTOQUE, na Expedição ou já
                entregue. A mesma peça volta à produção — a história dela continua.
              </p>
            </div>
            <Selecao
              rotulo="Setor do ajuste"
              opcoes={opcoesSetor}
              valor={setorId}
              aoMudar={setSetorId}
              placeholder="Escolha o setor"
            />
            <Selecao
              rotulo="Destino final (quando terminar)"
              opcoes={(Object.keys(ROTULO_DESTINO_FINAL) as DestinoFinalAjuste[]).map((d) => ({
                valor: d,
                rotulo: ROTULO_DESTINO_FINAL[d],
              }))}
              valor={destinoFinal}
              aoMudar={(v) => setDestinoFinal(v as DestinoFinalAjuste)}
              placeholder="Escolha o destino"
            />
            <label className="flex flex-col gap-1 text-sm font-medium text-texto">
              O que ajustar
              <textarea
                className="min-h-20 rounded-dm border border-borda-forte bg-superficie p-3 text-sm font-normal text-texto"
                maxLength={500}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: lixar e repintar a porta"
              />
            </label>
            <Botao
              type="submit"
              icone={<Wrench />}
              carregando={ajuste.isPending}
              className="self-start"
            >
              Mandar para ajuste
            </Botao>
          </>
        )}
        {erro && <p className="text-sm text-danificado-forte">{erro}</p>}
      </form>
    </Modal>
  )
}
