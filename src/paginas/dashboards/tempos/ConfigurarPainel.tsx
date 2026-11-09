import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AvatarPessoa, Botao, Modal, Selecao, useNotificacao } from '@/componentes/ui'
import { FiltroPill } from '@/dashboards/componentes/Filtros'
import {
  buscarConfiguracaoDoPainel,
  salvarPainel,
  type ConfiguracaoDoPainel,
  type MontadorNoPainel,
} from '@/dashboards/tempos/api'
import {
  BLOCOS_TV,
  MEDIDAS,
  painelDe,
  PERIODOS_DE_ABERTURA,
  ROTULO_BLOCO_TV,
  TIPOS_GRAFICO,
  type BlocoTv,
  type PainelTempos,
} from '@/dashboards/tempos/painel'
import { Interruptor } from '@/paginas/controleTempo/comum'
import { Carregando, ErroLeitura } from './comum'

const SETOR_LEMBRADO = 'lembrado'
const chaveDoMontador = (setorId: number, usuarioId: string) => `${setorId}:${usuarioId}`

/**
 * SESSAO-47 (Bloco C) — a janela "Configurar painel" de Tempos de produção: a
 * configuração ÚNICA que o administrador define e que vale para todos, na tela
 * e na TV — o tipo de cada gráfico, o número do tempo médio (mediana ou média),
 * a marca do tempo padrão na linha do dia, como a tela abre, quais montadores
 * aparecem com a própria letra (os outros entram em "Outros") e o que a TV
 * mostra. Tudo é lido no clique, numa requisição, e salvo de uma vez; quem está
 * com a tela ou a TV aberta vê a mudança na hora (o aviso do setor).
 *
 * Só aqui a equipe aparece com letra, NOME e FOTO — para o administrador saber
 * quem é cada letra. A TV continua só com letras.
 */
export function ConfigurarPainel({
  setorAtual,
  aoFechar,
}: {
  /** O setor que a tela está mostrando — a lista de montadores abre nele. */
  setorAtual: number | null
  aoFechar: () => void
}) {
  const consulta = useQuery({
    queryKey: ['tempos-painel-configuracao'],
    queryFn: buscarConfiguracaoDoPainel,
    // lida no clique e esquecida ao fechar (Lei §3): nunca vem do guardado
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })

  if (!consulta.data)
    return (
      <Modal
        aberto
        aoFechar={(aberto) => !aberto && aoFechar()}
        titulo="Configurar painel"
        descricao="Vale para todos — na tela e na TV."
        tamanho="galpao"
      >
        {consulta.error ? <ErroLeitura erro={consulta.error} /> : <Carregando />}
      </Modal>
    )
  return (
    <Formulario
      // uma leitura nova (reabrir a janela) começa o rascunho de novo
      key={consulta.dataUpdatedAt}
      dados={consulta.data}
      setorAtual={setorAtual}
      aoFechar={aoFechar}
    />
  )
}

function Formulario({
  dados,
  setorAtual,
  aoFechar,
}: {
  dados: ConfiguracaoDoPainel
  setorAtual: number | null
  aoFechar: () => void
}) {
  const cliente = useQueryClient()
  const notificar = useNotificacao()
  const inicial = painelDe({ painel: dados.painel })
  const [rascunho, setRascunho] = useState<PainelTempos>(inicial)
  // o liga/desliga de cada pessoa, por setor (só o que o administrador tocou)
  const [tocados, setTocados] = useState<Record<string, boolean>>({})
  const [setorDaEquipe, setSetorDaEquipe] = useState<number | null>(
    dados.setores.some((s) => s.id === setorAtual) ? setorAtual : (dados.setores[0]?.id ?? null),
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const mudar = <K extends keyof PainelTempos>(chave: K, valor: PainelTempos[K]) =>
    setRascunho((r) => ({ ...r, [chave]: valor }))

  // só o que mudou vai para o banco
  const chavesMudadas = (Object.keys(rascunho) as (keyof PainelTempos)[]).filter(
    (k) => rascunho[k] !== inicial[k],
  )
  const montadoresMudados: MontadorNoPainel[] = dados.setores.flatMap((s) =>
    s.equipe
      .filter((p) => {
        const tocado = tocados[chaveDoMontador(s.id, p.usuario_id)]
        return tocado !== undefined && tocado !== p.no_painel
      })
      .map((p) => ({
        setor_id: s.id,
        usuario_id: p.usuario_id,
        ligado: tocados[chaveDoMontador(s.id, p.usuario_id)],
      })),
  )
  const mudou = chavesMudadas.length > 0 || montadoresMudados.length > 0

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      await salvarPainel(
        chavesMudadas.length > 0
          ? (Object.fromEntries(
              chavesMudadas.map((k) => [k, rascunho[k]]),
            ) as Partial<PainelTempos>)
          : null,
        montadoresMudados.length > 0 ? montadoresMudados : null,
      )
      notificar({
        titulo: 'Configuração do painel salva',
        descricao: 'A tela e a TV já estão com ela.',
        tom: 'perfeito',
      })
      // a aba aberta relê a porta dela, que já traz a configuração nova
      await cliente.invalidateQueries({ queryKey: ['tempos-producao'] })
      aoFechar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const equipe = dados.setores.find((s) => s.id === setorDaEquipe)?.equipe ?? []
  const blocos = BLOCOS_TV.filter((b) => dados.blocos_tv.includes(b))
  const padrao = painelDe({ painel: dados.padrao })
  const noPadrao = (Object.keys(rascunho) as (keyof PainelTempos)[]).every(
    (k) => rascunho[k] === padrao[k],
  )

  return (
    <Modal
      aberto
      aoFechar={(aberto) => !aberto && aoFechar()}
      titulo="Configurar painel"
      descricao="Vale para todos — na tela e na TV. Quem estiver com elas abertas vê a mudança na hora."
      tamanho="galpao"
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            variante="primaria"
            carregando={salvando}
            disabled={!mudou}
            onClick={() => void salvar()}
          >
            Salvar
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Secao titulo="Tipo de gráfico">
          <FiltroPill
            rotulo="Aba Período"
            opcoes={TIPOS_GRAFICO}
            valor={rascunho.grafico_periodo}
            aoMudar={(v) => mudar('grafico_periodo', v)}
          />
          <FiltroPill
            rotulo="TV"
            opcoes={TIPOS_GRAFICO}
            valor={rascunho.grafico_tv}
            aoMudar={(v) => mudar('grafico_tv', v)}
          />
          <Explicacao>
            Empilhadas por montador é o desenho de sempre; barras mostra só o total do dia; linhas
            traz uma linha para cada montador.
          </Explicacao>
        </Secao>

        <Secao titulo="Tempo médio">
          <FiltroPill
            rotulo="Número mostrado"
            opcoes={MEDIDAS}
            valor={rascunho.medida}
            aoMudar={(v) => mudar('medida', v)}
          />
          <Explicacao>
            A mediana é o tempo do meio (um móvel muito demorado não puxa o número); a média soma
            tudo e divide. O rótulo de cada número diz qual está valendo. O tempo padrão de cada
            móvel não muda.
          </Explicacao>
        </Secao>

        <Secao titulo="Linha do dia">
          <LinhaDeLigar
            rotulo="Marcar onde cada móvel terminaria no tempo padrão"
            ligado={rascunho.linha_padrao}
            aoMudar={(v) => mudar('linha_padrao', v)}
          />
        </Secao>

        <Secao titulo="Como a tela abre">
          <div className="w-full sm:max-w-sm">
            <Selecao
              rotulo="Setor"
              opcoes={[
                { valor: SETOR_LEMBRADO, rotulo: 'O que cada aparelho lembra' },
                ...dados.setores.map((s) => ({ valor: String(s.id), rotulo: s.nome })),
              ]}
              valor={
                rascunho.abrir_setor_id === null ? SETOR_LEMBRADO : String(rascunho.abrir_setor_id)
              }
              aoMudar={(v) => mudar('abrir_setor_id', v === SETOR_LEMBRADO ? null : Number(v))}
            />
          </div>
          <FiltroPill
            rotulo="Período"
            opcoes={PERIODOS_DE_ABERTURA}
            valor={rascunho.abrir_periodo}
            aoMudar={(v) => mudar('abrir_periodo', v)}
          />
          <Explicacao>
            Hoje abre na aba Dia; 7 ou 30 dias abrem na aba Período. Quem chega por um link, ou
            troca o filtro na hora, continua vendo o que escolheu.
          </Explicacao>
        </Secao>

        <Secao titulo="Montadores no painel">
          <Explicacao>
            Quem está desligado sai da coluna dele, na tela e na TV, e entra em “Outros” — o tempo
            dele continua contando nos totais e nas médias do setor. As letras e a equipe mudam em
            Configurações → Controle de tempo → Equipe no painel.
          </Explicacao>
          {dados.setores.length > 1 && setorDaEquipe !== null && (
            <div className="w-full sm:max-w-sm">
              <Selecao
                rotulo="Equipe do setor"
                opcoes={dados.setores.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
                valor={String(setorDaEquipe)}
                aoMudar={(v) => setSetorDaEquipe(Number(v))}
              />
            </div>
          )}
          {equipe.length === 0 ? (
            <p className="rounded-dm border border-borda bg-superficie-sutil p-3 text-sm text-texto-suave">
              Ninguém na equipe do painel deste setor.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda rounded-dm-lg border border-borda">
              {equipe.map((p) => {
                const chave = chaveDoMontador(setorDaEquipe as number, p.usuario_id)
                const ligado = tocados[chave] ?? p.no_painel
                return (
                  <li key={p.usuario_id} className="flex min-h-toque-lg items-center gap-3 p-2.5">
                    <span
                      aria-hidden
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-dm bg-superficie-sutil text-base font-semibold tabular-nums"
                    >
                      {p.letra}
                    </span>
                    <AvatarPessoa nome={p.nome} foto={p.foto} tamanho="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-texto">{p.nome}</p>
                      <p className="text-xs text-texto-suave">
                        Montador {p.letra} · {p.papel === 'titular' ? 'titular' : 'apoio'}
                        {!ligado && ' · em “Outros”'}
                      </p>
                    </div>
                    <Interruptor
                      ligado={ligado}
                      rotulo={`Mostrar ${p.nome} (montador ${p.letra}) no painel`}
                      aoMudar={(v) => setTocados((t) => ({ ...t, [chave]: v }))}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </Secao>

        <Secao titulo="O que a TV mostra">
          <ul className="flex flex-col divide-y divide-borda rounded-dm-lg border border-borda">
            {blocos.map((b: BlocoTv) => (
              <li key={b} className="p-2.5">
                <LinhaDeLigar
                  rotulo={ROTULO_BLOCO_TV[b]}
                  ligado={rascunho[b]}
                  aoMudar={(v) => mudar(b, v)}
                />
              </li>
            ))}
          </ul>
          <Explicacao>
            A TV se arruma sozinha quando um bloco sai. O aviso de “ao vivo pausado” aparece sempre
            que a TV perde a ligação, mesmo com o selo desligado.
          </Explicacao>
        </Secao>

        <div className="flex flex-wrap items-center gap-3">
          <Botao variante="fantasma" disabled={noPadrao} onClick={() => setRascunho(padrao)}>
            Voltar ao padrão
          </Botao>
          <p className="text-xs text-texto-suave">
            Volta os gráficos, o tempo médio, a abertura e a TV ao desenho de antes — os montadores
            ficam como estão.
          </p>
        </div>

        {erro && (
          <p role="alert" className="text-sm text-danificado-forte">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-texto">{titulo}</h3>
      {children}
    </section>
  )
}

function Explicacao({ children }: { children: ReactNode }) {
  return <p className="text-sm text-texto-suave">{children}</p>
}

/** Um liga/desliga com o texto ao lado — a linha inteira tem altura de toque. */
function LinhaDeLigar({
  rotulo,
  ligado,
  aoMudar,
}: {
  rotulo: string
  ligado: boolean
  aoMudar: (ligado: boolean) => void
}) {
  return (
    <div className="flex min-h-toque-md items-center justify-between gap-3">
      <span className="text-sm text-texto">{rotulo}</span>
      <Interruptor ligado={ligado} rotulo={rotulo} aoMudar={aoMudar} />
    </div>
  )
}
