import { useState } from 'react'
import type { ReactNode } from 'react'
import { Play, Search, Send, Trash2 } from 'lucide-react'
import {
  BadgeEstado,
  Botao,
  Campo,
  DESCRICAO_ESTADO,
  ESTADOS_QUALIDADE,
  Modal,
  Selecao,
  Tabela,
  useNotificacao,
  type ColunaTabela,
  type Estado,
} from '@/componentes/ui'
import { Marca } from '@/componentes/Marca'

/* ------------------------------------------------------------------ */
/* Helpers de apresentação (usados só nesta página)                    */
/* ------------------------------------------------------------------ */

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-borda pt-8 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl sm:text-2xl">{titulo}</h2>
        {descricao && <p className="max-w-3xl text-texto-suave">{descricao}</p>}
      </div>
      {children}
    </section>
  )
}

function Amostra({ nome, classe }: { nome: string; classe: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`h-14 rounded-dm border border-borda ${classe}`} />
      <code className="text-xs text-texto-suave">{nome}</code>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Dados fictícios — existem só para provar que a paginação funciona.  */
/* Não representam etapas nem setores reais (D-14: nada de seed).      */
/* ------------------------------------------------------------------ */

interface LinhaExemplo {
  id: number
  pedido: string
  cliente: string
  item: string
  estado: Estado
  tempo: string
}

const CLIENTES = ['Ana Ribeiro', 'Carlos Menezes', 'Duda Farias', 'Eliane Costa', 'Fábio Nunes']
const ITENS = ['Guarda-roupa 6 portas', 'Cômoda 4 gavetas', 'Painel TV 1,80m', 'Balcão de pia']
const ESTADOS: Estado[] = ['perfeito', 'perfeito', 'atencao', 'perfeito', 'danificado']

const DADOS_EXEMPLO: LinhaExemplo[] = Array.from({ length: 27 }, (_, i) => ({
  id: i + 1,
  pedido: `#${13100 + i}`,
  cliente: CLIENTES[i % CLIENTES.length],
  item: `${ITENS[i % ITENS.length]} (${(i % 3) + 1}/3)`,
  estado: ESTADOS[i % ESTADOS.length],
  tempo: `${1 + (i % 9)}h ${(i * 7) % 60}min`,
}))

const COLUNAS: ColunaTabela<LinhaExemplo>[] = [
  {
    chave: 'pedido',
    cabecalho: 'Pedido',
    celula: (l) => <strong>{l.pedido}</strong>,
    ocultarNoCelular: true,
  },
  { chave: 'cliente', cabecalho: 'Cliente', celula: (l) => l.cliente, ocultarNoCelular: true },
  { chave: 'item', cabecalho: 'Item', celula: (l) => l.item },
  {
    chave: 'estado',
    cabecalho: 'Qualidade',
    celula: (l) => <BadgeEstado estado={l.estado} tamanho="sm" />,
  },
  {
    chave: 'tempo',
    cabecalho: 'Tempo acumulado',
    alinhamento: 'direita',
    celula: (l) => <span className="tabular-nums">{l.tempo}</span>,
  },
]

/* ------------------------------------------------------------------ */

export function DesignSystem() {
  const notificar = useNotificacao()
  const [modalAberto, setModalAberto] = useState(false)
  const [setor, setSetor] = useState<string>()
  const [busca, setBusca] = useState('')

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl">Design system</h1>
        <p className="max-w-3xl text-texto-suave">
          A base visual da plataforma, viva e clicável. Toda tela nova sai daqui — componente novo
          só quando não existir equivalente nesta página. As regras de uso estão em{' '}
          <code className="text-texto">docs/design-system.md</code>.
        </p>
      </header>

      <Secao
        titulo="A marca"
        descricao="Amarelo Domoby sobre grafite, como na logo. O amarelo é cor de MARCA e de AÇÃO — nunca cor de estado."
      >
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center justify-center rounded-dm-lg bg-grafite-700 p-8">
            <Marca tamanho="lg" />
          </div>
          <div className="flex items-center justify-center rounded-dm-lg border border-borda bg-superficie p-8">
            <Marca tamanho="lg" sobre="claro" />
          </div>
        </div>
      </Secao>

      <Secao titulo="Cores" descricao="Nenhum hexadecimal solto no código: só token.">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-texto-suave">Marca (amarelo Domoby)</h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-11">
            <Amostra nome="marca-50" classe="bg-marca-50" />
            <Amostra nome="marca-100" classe="bg-marca-100" />
            <Amostra nome="marca-200" classe="bg-marca-200" />
            <Amostra nome="marca-300" classe="bg-marca-300" />
            <Amostra nome="marca-400" classe="bg-marca-400" />
            <Amostra nome="marca-500" classe="bg-marca-500" />
            <Amostra nome="marca-600" classe="bg-marca-600" />
            <Amostra nome="marca-700" classe="bg-marca-700" />
            <Amostra nome="marca-800" classe="bg-marca-800" />
            <Amostra nome="marca-900" classe="bg-marca-900" />
            <Amostra nome="marca-950" classe="bg-marca-950" />
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-texto-suave">Grafite</h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-11">
            <Amostra nome="grafite-50" classe="bg-grafite-50" />
            <Amostra nome="grafite-100" classe="bg-grafite-100" />
            <Amostra nome="grafite-200" classe="bg-grafite-200" />
            <Amostra nome="grafite-300" classe="bg-grafite-300" />
            <Amostra nome="grafite-400" classe="bg-grafite-400" />
            <Amostra nome="grafite-500" classe="bg-grafite-500" />
            <Amostra nome="grafite-600" classe="bg-grafite-600" />
            <Amostra nome="grafite-700" classe="bg-grafite-700" />
            <Amostra nome="grafite-800" classe="bg-grafite-800" />
            <Amostra nome="grafite-900" classe="bg-grafite-900" />
            <Amostra nome="grafite-950" classe="bg-grafite-950" />
          </div>
        </div>
      </Secao>

      <Secao
        titulo="Estados de qualidade (D-09)"
        descricao="Os 3 estados de toda transição entre setores. O estado de atenção é renderizado em âmbar-laranja de propósito: o amarelo da marca já significa ação na interface, e dois amarelos com sentidos diferentes no chão de fábrica é erro esperando acontecer. Estado nunca é comunicado só por cor — ícone e texto sempre juntos."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {ESTADOS_QUALIDADE.map((estado) => (
            <div
              key={estado}
              className="flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4"
            >
              <BadgeEstado estado={estado} tamanho="galpao" />
              <p className="text-sm text-texto-suave">{DESCRICAO_ESTADO[estado]}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BadgeEstado estado="perfeito" tamanho="sm" />
          <BadgeEstado estado="atencao" tamanho="md" />
          <BadgeEstado estado="danificado" tamanho="md" />
          <BadgeEstado estado="informativo" tamanho="md" />
          <BadgeEstado estado="neutro" tamanho="md" />
        </div>
      </Secao>

      <Secao
        titulo="Tipografia"
        descricao="Poppins na marca e nos títulos; Inter no corpo e nos dados. Ambas embarcadas no build — o galpão não depende da internet para ler a interface."
      >
        <div className="flex flex-col gap-2 rounded-dm-lg border border-borda bg-superficie p-5">
          <h1 className="text-3xl">Título de página · Poppins 600</h1>
          <h2 className="text-2xl">Título de seção · Poppins 600</h2>
          <p className="text-base">
            Corpo de texto · Inter 400 — o padrão de leitura da interface.
          </p>
          <p className="text-sm text-texto-suave">Apoio · Inter 400 em texto suave.</p>
          <p className="text-lg tabular-nums">Números e durações · 04h 37min (tabular-nums)</p>
        </div>
      </Secao>

      <Secao
        titulo="Botões"
        descricao="Uma ação primária por bloco de decisão. O tamanho galpão (64px) é o padrão das ações que o operador toca no tablet (D-06)."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Botao variante="primaria">Primária</Botao>
          <Botao variante="secundaria">Secundária</Botao>
          <Botao variante="fantasma">Fantasma</Botao>
          <Botao variante="perigo" icone={<Trash2 />}>
            Perigo
          </Botao>
          <Botao carregando>Carregando</Botao>
          <Botao disabled>Desabilitada</Botao>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Botao tamanho="sm">sm · 36px</Botao>
          <Botao tamanho="md">md · 44px</Botao>
          <Botao tamanho="lg">lg · 56px</Botao>
          <Botao tamanho="galpao" icone={<Play />}>
            galpão · 64px
          </Botao>
        </div>
        <Botao tamanho="galpao" larguraTotal icone={<Play />}>
          Ação de largura total (padrão no celular)
        </Botao>
      </Secao>

      <Secao
        titulo="Campos e seleção"
        descricao="Todo campo tem rótulo visível. Fonte de 16px para o iOS não dar zoom sozinho ao focar."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Buscar pedido"
            placeholder="Número do pedido ou cliente"
            prefixo={<Search />}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            ajuda="Ajuda contextual aparece aqui."
          />
          <Campo
            rotulo="Campo com erro"
            defaultValue="13O93"
            erro="Número de pedido inválido — use só dígitos."
          />
          <Selecao
            rotulo="Setor"
            placeholder="Escolha o setor"
            valor={setor}
            aoMudar={setSetor}
            opcoes={[
              { valor: 'pcp', rotulo: 'PCP' },
              { valor: 'secc', rotulo: 'SECC' },
              { valor: 'cnc', rotulo: 'CNC' },
              { valor: 'fitamento', rotulo: 'FITAMENTO' },
              { valor: 'furacao', rotulo: 'FURAÇÃO' },
              { valor: 'montagem', rotulo: 'MONTAGEM' },
              { valor: 'limpeza', rotulo: 'LIMPEZA E EMBALAGEM' },
            ]}
            ajuda="Os nomes do galpão nunca são traduzidos (regra 12)."
          />
          <Selecao
            rotulo="Seleção tamanho galpão"
            tamanho="galpao"
            placeholder="Toque para escolher"
            opcoes={[
              { valor: 'a', rotulo: 'Opção A' },
              { valor: 'b', rotulo: 'Opção B' },
              { valor: 'c', rotulo: 'Opção indisponível', desabilitada: true },
            ]}
          />
        </div>
      </Secao>

      <Secao
        titulo="Modal e notificações"
        descricao="O modal trava o foco e vira folha inferior no celular. As notificações reaproveitam a paleta de estados."
      >
        <div className="flex flex-wrap gap-3">
          <Botao variante="secundaria" onClick={() => setModalAberto(true)}>
            Abrir modal
          </Botao>
          <Botao
            variante="secundaria"
            onClick={() => notificar({ titulo: 'Card movido', tom: 'perfeito' })}
          >
            Notificar sucesso
          </Botao>
          <Botao
            variante="secundaria"
            onClick={() =>
              notificar({
                titulo: 'Divergência registrada',
                descricao: 'A liderança foi avisada automaticamente.',
                tom: 'atencao',
              })
            }
          >
            Notificar atenção
          </Botao>
          <Botao
            variante="secundaria"
            onClick={() =>
              notificar({
                titulo: 'Falha ao salvar',
                descricao: 'Tente de novo.',
                tom: 'danificado',
              })
            }
          >
            Notificar erro
          </Botao>
        </div>

        <Modal
          aberto={modalAberto}
          aoFechar={setModalAberto}
          titulo="Exemplo de modal"
          descricao="Use modal para uma decisão curta. Fluxo longo merece tela própria."
          rodape={
            <>
              <Botao variante="secundaria" onClick={() => setModalAberto(false)}>
                Cancelar
              </Botao>
              <Botao
                icone={<Send />}
                onClick={() => {
                  setModalAberto(false)
                  notificar({ titulo: 'Confirmado', tom: 'perfeito' })
                }}
              >
                Confirmar
              </Botao>
            </>
          }
        >
          <p className="text-texto-suave">
            No celular este modal sobe do rodapé, na zona alcançável pelo polegar. No tablet ele
            centraliza.
          </p>
        </Modal>
      </Secao>

      <Secao
        titulo="Tabela com paginação"
        descricao="Paginação é padrão, não opção (RNF-02). No celular a tabela vira lista de cards — tabela rolando na horizontal é inutilizável com uma mão só. Os dados abaixo são fictícios."
      >
        <Tabela
          legenda="Exemplo de tabela paginada com dados fictícios"
          colunas={COLUNAS}
          dados={DADOS_EXEMPLO}
          chaveDe={(l) => l.id}
          porPagina={8}
          tituloCelular={(l) => `${l.pedido} · ${l.cliente}`}
        />
      </Secao>

      <Secao
        titulo="Alvos de toque (D-06)"
        descricao="44px é o mínimo de qualquer coisa clicável. 64px é o padrão das ações do operador."
      >
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-toque-sm w-toque-sm rounded-dm bg-marca-500" />
            <code className="text-xs text-texto-suave">toque-sm</code>
            <span className="text-xs text-texto-fraco">36px</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-toque-md w-toque-md rounded-dm bg-marca-500" />
            <code className="text-xs text-texto-suave">toque-md</code>
            <span className="text-xs text-texto-fraco">44px · mínimo</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-toque-lg w-toque-lg rounded-dm bg-marca-500" />
            <code className="text-xs text-texto-suave">toque-lg</code>
            <span className="text-xs text-texto-fraco">56px</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-toque-galpao w-toque-galpao rounded-dm bg-marca-500" />
            <code className="text-xs text-texto-suave">toque-galpao</code>
            <span className="text-xs text-texto-fraco">64px · galpão</span>
          </div>
        </div>
      </Secao>
    </div>
  )
}
