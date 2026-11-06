import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Search,
  Sofa,
  Tv,
  Users,
  X,
} from 'lucide-react'
import { Abas, Botao, Campo, Modal, Selecao, type Aba } from '@/componentes/ui'
import { CabecalhoDaTela } from '@/componentes/CabecalhoDaTela'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { temModoTv } from '@/autenticacao/tipos'
import { buscarSetores } from '@/kanban/api'
import { useAoVivo } from '@/lib/aoVivo'
import { FiltroPill } from '@/dashboards/componentes/Filtros'
import { opcoesDosFiltros, type FiltrosTempos } from '@/dashboards/tempos/api'
import {
  ehChavePeriodo,
  hojeNaFabrica,
  intervaloDoPeriodo,
  PERIODOS,
  type ChavePeriodo,
} from '@/dashboards/tempos/formato'
import { Interruptor } from '@/paginas/controleTempo/comum'
import { Carregando } from './tempos/comum'

type AbaTempos = 'dia' | 'periodo' | 'moveis' | 'pessoas' | 'conferir'

export interface PropsAba {
  filtros: FiltrosTempos
  aoContador: (n: number | null) => void
}

function pedaco<M extends Record<string, unknown>>(carregar: () => Promise<M>, nome: keyof M) {
  return lazy(() => carregar().then((m) => ({ default: m[nome] as ComponentType<PropsAba> })))
}

// Cada aba é um pedaço próprio: o código e a leitura dela só chegam no clique (Lei §3/§9).
const PAINEIS: Record<AbaTempos, ComponentType<PropsAba>> = {
  dia: pedaco(() => import('./tempos/AbaDia'), 'AbaDia'),
  periodo: pedaco(() => import('./tempos/AbaPeriodo'), 'AbaPeriodo'),
  moveis: pedaco(() => import('./tempos/AbaMoveis'), 'AbaMoveis'),
  pessoas: pedaco(() => import('./tempos/AbaMontadores'), 'AbaMontadores'),
  conferir: pedaco(() => import('./tempos/AbaConferir'), 'AbaConferir'),
}

const CHAVE_SETOR = 'domoby:tempos-setor'
function setorLembrado(): number | null {
  try {
    return Number(localStorage.getItem(CHAVE_SETOR)) || null
  } catch {
    return null
  }
}
function lembrarSetor(id: number) {
  try {
    localStorage.setItem(CHAVE_SETOR, String(id))
  } catch {
    // sem armazenamento: o próximo acesso abre na Montagem
  }
}

/**
 * SESSAO-43 (F1) — Dashboards → Tempos de produção: o tempo certo de cada
 * setor de produção (o cálculo único da SESSAO-42), em cinco abas — Dia,
 * Período, Móveis, Montadores (ou Pessoas) e Conferir —, cada uma com UMA
 * porta pedida só no clique, e o botão ▶ Modo TV para quem tem a permissão.
 * Os filtros moram no endereço (o link leva à mesma visão); o setor fica
 * lembrado no aparelho. Ao vivo pelo canal do setor (Lei §4). Absorveu a tela
 * "Tempo por setor" (aba Período).
 */
export function TemposProducao() {
  const { perfil, ehLider, carregando } = useSessao()
  const [parametros, setParametros] = useSearchParams()
  const [conferirN, setConferirN] = useState<number | null>(null)
  const [escolher, setEscolher] = useState<'pessoa' | 'modelo' | null>(null)
  const [rotulos, setRotulos] = useState<{ pessoa?: string; modelo?: string }>({})

  const { data: setores = [] } = useQuery({
    queryKey: ['setores'],
    queryFn: () => buscarSetores(),
    staleTime: Infinity,
  })
  const producao = useMemo(
    () => setores.filter((s) => s.papel_no_fluxo === 'producao' && s.ativo),
    [setores],
  )

  const pedidoSetor = Number(parametros.get('setor')) || null
  const setor = useMemo(() => {
    const porId = (id: number | null) => producao.find((s) => s.id === id)
    return (
      porId(pedidoSetor) ??
      porId(setorLembrado()) ??
      producao.find((s) => /montagem/i.test(s.nome)) ??
      producao[0] ??
      null
    )
  }, [producao, pedidoSetor])
  useEffect(() => {
    if (setor) lembrarSetor(setor.id)
  }, [setor])

  const hoje = hojeNaFabrica()
  const chavePeriodo: ChavePeriodo = ehChavePeriodo(parametros.get('p'))
    ? (parametros.get('p') as ChavePeriodo)
    : '30'
  const { de, ate } = intervaloDoPeriodo(chavePeriodo, hoje, {
    de: parametros.get('de'),
    ate: parametros.get('ate'),
  })
  const pessoaId = parametros.get('pessoa')
  const modeloId = Number(parametros.get('modelo')) || null
  const trello = parametros.get('historico') !== '0'

  const filtros: FiltrosTempos | null = setor
    ? { setorId: setor.id, de, ate, pessoaId, modeloId, trello }
    : null

  // Ao vivo: o banco avisa no canal do setor quando um móvel sai dele (a
  // passagem fecha) — a aba aberta relê; as outras ficam marcadas.
  useAoVivo(setor ? `setor_${setor.id}` : 'tempos', [['tempos-producao']], {
    ligado: setor !== null,
    esperaMs: 1_500,
    espalharMs: 3_000,
  })

  const ehMontagem = setor ? /montagem/i.test(setor.nome) : true
  const abas: Aba<AbaTempos>[] = [
    { valor: 'dia', rotulo: 'Dia', icone: <CalendarDays aria-hidden /> },
    { valor: 'periodo', rotulo: 'Período', icone: <CalendarRange aria-hidden /> },
    { valor: 'moveis', rotulo: 'Móveis', icone: <Sofa aria-hidden /> },
    {
      valor: 'pessoas',
      rotulo: ehMontagem ? 'Montadores' : 'Pessoas',
      icone: <Users aria-hidden />,
    },
    ...(ehLider
      ? [
          {
            valor: 'conferir' as const,
            rotulo: conferirN !== null ? `Conferir (${conferirN})` : 'Conferir',
            icone: <ClipboardCheck aria-hidden />,
          },
        ]
      : []),
  ]
  const pedida = parametros.get('aba')
  const aba = abas.find((a) => a.valor === pedida)?.valor ?? 'dia'
  const Painel = PAINEIS[aba]

  function mudar(trocas: Record<string, string | null>) {
    const novos = new URLSearchParams(parametros)
    for (const [k, v] of Object.entries(trocas)) {
      if (v === null || v === '') novos.delete(k)
      else novos.set(k, v)
    }
    setParametros(novos, { replace: true })
  }

  if (carregando || !perfil) return null

  return (
    <div className="flex flex-col gap-4">
      {/* Ajuste de 06/11 (cabeçalhos compactos): a explicação foi para o ?. */}
      <CabecalhoDaTela
        titulo="Tempos de produção"
        rotuloAjuda="Como o tempo é contado"
        ajuda={
          <>
            Quanto tempo cada móvel levou no setor, com o expediente, o almoço e as pausas
            descontados — o mesmo tempo do card. {ehLider ? '' : 'Você vê o que você montou.'}
          </>
        }
      >
        {temModoTv(perfil) && (
          <Botao
            variante="secundaria"
            icone={<Tv aria-hidden />}
            onClick={() =>
              window.open(
                `/dashboards/modo-tv${setor ? `?setor=${setor.id}` : ''}`,
                '_blank',
                'noopener',
              )
            }
          >
            Modo TV
          </Botao>
        )}
      </CabecalhoDaTela>

      {/* os filtros numa linha acima de tudo (regra 6 das dashboards) */}
      <div className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-60">
            <Selecao
              rotulo="Setor"
              opcoes={producao.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
              valor={setor ? String(setor.id) : undefined}
              aoMudar={(v) => mudar({ setor: v, pessoa: null, modelo: null })}
            />
          </div>
          {ehLider && (
            <FiltroEscolhido
              rotulo="Pessoa"
              valor={pessoaId ? (rotulos.pessoa ?? 'Escolhida') : 'Todas'}
              ligado={pessoaId !== null}
              aoAbrir={() => setEscolher('pessoa')}
              aoLimpar={() => mudar({ pessoa: null })}
            />
          )}
          <FiltroEscolhido
            rotulo="Móvel"
            valor={modeloId ? (rotulos.modelo ?? 'Escolhido') : 'Todos'}
            ligado={modeloId !== null}
            aoAbrir={() => setEscolher('modelo')}
            aoLimpar={() => mudar({ modelo: null })}
          />
          <label className="flex min-h-toque-md items-center gap-2 text-sm text-texto-suave">
            <Interruptor
              ligado={trello}
              rotulo="Incluir o histórico do Trello"
              aoMudar={(ligado) => mudar({ historico: ligado ? null : '0' })}
            />
            Histórico do Trello
          </label>
        </div>
        {aba !== 'dia' && (
          <div className="flex flex-wrap items-end gap-3">
            <FiltroPill
              rotulo="Período"
              opcoes={PERIODOS}
              valor={chavePeriodo}
              aoMudar={(v) =>
                mudar({
                  p: v === '30' ? null : v,
                  ...(v === 'pers' ? { de, ate } : { de: null, ate: null }),
                })
              }
            />
            {chavePeriodo === 'pers' && (
              <div className="flex flex-wrap gap-2">
                <div className="w-40">
                  <Campo
                    rotulo="De"
                    type="date"
                    value={de}
                    max={ate}
                    onChange={(e) => mudar({ de: e.target.value })}
                  />
                </div>
                <div className="w-40">
                  <Campo
                    rotulo="Até"
                    type="date"
                    value={ate}
                    max={hoje}
                    onChange={(e) => mudar({ ate: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Abas
        rotulo="Partes dos tempos de produção"
        idBase="tempos-producao"
        abas={abas}
        valor={aba}
        aoMudar={(valor) => mudar({ aba: valor === 'dia' ? null : valor })}
      />

      <div
        role="tabpanel"
        id="tempos-producao-painel"
        aria-labelledby={`tempos-producao-aba-${aba}`}
      >
        {!filtros ? (
          <p className="text-sm text-texto-suave">Nenhum setor de produção cadastrado.</p>
        ) : (
          <Suspense fallback={<Carregando />}>
            <Painel filtros={filtros} aoContador={setConferirN} />
          </Suspense>
        )}
      </div>

      {setor && (
        <EscolherOpcao
          tipo={escolher}
          setorId={setor.id}
          aoFechar={() => setEscolher(null)}
          aoEscolher={(tipo, id, nome) => {
            setRotulos((r) => ({ ...r, [tipo]: nome }))
            mudar({ [tipo]: id })
            setEscolher(null)
          }}
        />
      )}
    </div>
  )
}

function FiltroEscolhido({
  rotulo,
  valor,
  ligado,
  aoAbrir,
  aoLimpar,
}: {
  rotulo: string
  valor: string
  ligado: boolean
  aoAbrir: () => void
  aoLimpar: () => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-texto-suave">{rotulo}</span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={aoAbrir}
          className="flex min-h-toque-md max-w-56 items-center gap-2 rounded-dm border border-borda-forte bg-superficie px-3 text-left text-sm"
        >
          <Search aria-hidden className="size-4 shrink-0 text-texto-suave" />
          <span className="truncate">{valor}</span>
        </button>
        {ligado && (
          <button
            type="button"
            onClick={aoLimpar}
            aria-label={`Tirar o filtro de ${rotulo.toLowerCase()}`}
            className="toque-seguro rounded-dm p-1 text-texto-suave hover:text-texto"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </span>
    </div>
  )
}

/** As opções de pessoa ou de móvel, pedidas só quando a janela abre (Lei §3). */
function EscolherOpcao({
  tipo,
  setorId,
  aoFechar,
  aoEscolher,
}: {
  tipo: 'pessoa' | 'modelo' | null
  setorId: number
  aoFechar: () => void
  aoEscolher: (tipo: 'pessoa' | 'modelo', id: string, nome: string) => void
}) {
  const [busca, setBusca] = useState('')
  const [buscaParada, setBuscaParada] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setBuscaParada(busca.trim()), 300)
    return () => clearTimeout(t)
  }, [busca])
  const { data, isPending } = useQuery({
    queryKey: [
      'tempos-producao',
      'opcoes',
      setorId,
      tipo === 'modelo' && buscaParada.length >= 2 ? buscaParada : null,
    ],
    queryFn: () =>
      opcoesDosFiltros(setorId, tipo === 'modelo' && buscaParada.length >= 2 ? buscaParada : null),
    enabled: tipo !== null,
    staleTime: 5 * 60_000,
  })
  const itens =
    tipo === 'pessoa'
      ? (data?.pessoas ?? [])
          .filter((p) => p.nome.toLowerCase().includes(busca.trim().toLowerCase()))
          .map((p) => ({ id: p.id, nome: p.nome }))
      : (data?.modelos ?? []).map((m) => ({ id: String(m.id), nome: m.nome }))
  return (
    <Modal
      aberto={tipo !== null}
      aoFechar={(aberto) => {
        if (!aberto) {
          setBusca('')
          aoFechar()
        }
      }}
      titulo={tipo === 'pessoa' ? 'Escolher a pessoa' : 'Escolher o móvel'}
      descricao={
        tipo === 'modelo'
          ? 'Os modelos que já têm tempo neste setor, ou procure pelo nome.'
          : undefined
      }
    >
      <div className="flex flex-col gap-3">
        <Campo
          rotulo={tipo === 'pessoa' ? 'Procurar pelo nome' : 'Procurar o móvel (2 letras ou mais)'}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          autoFocus
        />
        {isPending ? (
          <Carregando />
        ) : itens.length === 0 ? (
          <p className="text-sm text-texto-suave">Nada encontrado.</p>
        ) : (
          <ul className="flex max-h-[clamp(14rem,50vh,28rem)] flex-col overflow-y-auto">
            {itens.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => tipo && aoEscolher(tipo, i.id, i.nome)}
                  className="min-h-toque-md w-full rounded-dm px-3 text-left text-sm hover:bg-superficie-sutil"
                >
                  {i.nome}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
