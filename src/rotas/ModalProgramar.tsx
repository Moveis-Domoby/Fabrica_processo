import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Botao, Campo, Modal, Selecao } from '@/componentes/ui'
import { nomeDaRota, rotasDoDia } from './api'

/**
 * Confirmar a programação (D-39): dia + caminhão + ROTA (D-128 — o caminhão faz
 * várias rotas no mesmo dia). Serve para programar a rota montada
 * ("Programar") e para reprogramar um pedido ("Já programadas"). As rotas que
 * o caminhão já tem no dia vêm do banco ao escolher o dia (só aqui — regra 17).
 */
export function ModalProgramar({
  titulo,
  resumo,
  diaInicial,
  caminhaoInicial,
  opcoesCaminhao,
  padraoRota,
  rotaAtual,
  carregando,
  aoFechar,
  aoConfirmar,
}: {
  titulo: string
  /** Uma linha sobre o que vai no caminhão (ex.: "5 pedidos · 23 peças"). */
  resumo?: string
  diaInicial: string
  caminhaoInicial: string
  opcoesCaminhao: { valor: string; rotulo: string }[]
  /**
   * A rota que vem marcada quando o caminhão já tem rotas no dia: "nova" (a
   * rota montada em "Programar" é uma viagem nova) ou "ultima" (o pedido
   * reprogramado entra no fim da última) — decisão provisória do Claude.
   */
  padraoRota: 'nova' | 'ultima'
  /** Onde o pedido já está (reprogramar): no mesmo dia e caminhão, a rota fica. */
  rotaAtual?: { dia: string; caminhaoId: number; rota: number }
  carregando: boolean
  aoFechar: () => void
  aoConfirmar: (data: string, caminhaoId: number, rota: number) => void
}) {
  const [data, setData] = useState(diaInicial)
  const [caminhao, setCaminhao] = useState(caminhaoInicial)
  const [rotaEscolhida, setRotaEscolhida] = useState('')

  const rotas = useQuery({
    queryKey: ['rotas-do-dia', data],
    queryFn: () => rotasDoDia(data),
    enabled: Boolean(data),
  })
  const doCaminhao = (rotas.data ?? []).filter((r) => r.caminhao_id === Number(caminhao))
  const ultima = doCaminhao.reduce((m, r) => Math.max(m, r.rota), 0)
  const proxima = ultima + 1
  const opcoesRota = [
    ...doCaminhao.map((r) => ({
      valor: String(r.rota),
      rotulo: `${nomeDaRota(r.rota)} · ${r.entregas} ${r.entregas === 1 ? 'entrega' : 'entregas'}${
        r.equipe.length > 0 ? ` · ${r.equipe.map((m) => m.nome).join(', ')}` : ''
      }`,
    })),
    {
      valor: String(proxima),
      rotulo: doCaminhao.length > 0 ? `Nova rota (${nomeDaRota(proxima)})` : nomeDaRota(1),
    },
  ]
  const mesmoLugar =
    rotaAtual !== undefined && rotaAtual.dia === data && rotaAtual.caminhaoId === Number(caminhao)
  const padrao = mesmoLugar
    ? String(rotaAtual.rota)
    : padraoRota === 'nova' || ultima === 0
      ? String(proxima)
      : String(ultima)
  const rota = opcoesRota.some((o) => o.valor === rotaEscolhida) ? rotaEscolhida : padrao
  const pronto = Boolean(data) && Number(caminhao) > 0 && !rotas.isPending && !rotas.isError

  return (
    <Modal
      aberto
      aoFechar={(aberto) => {
        if (!aberto) aoFechar()
      }}
      titulo={titulo}
      descricao="Confirme o dia, o caminhão e a rota. Dá para reprogramar a qualquer instante — só não depois de entregue."
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            variante="primaria"
            disabled={!pronto}
            carregando={carregando}
            onClick={() => aoConfirmar(data, Number(caminhao), Number(rota))}
          >
            Confirmar
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {resumo && <p className="text-sm text-texto tabular-nums">{resumo}</p>}
        <Campo
          rotulo="Dia"
          type="date"
          value={data}
          onChange={(e) => {
            setData(e.target.value)
            setRotaEscolhida('')
          }}
        />
        {opcoesCaminhao.length === 0 ? (
          <p className="rounded-dm bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
            Nenhum caminhão cadastrado — cadastre em Configurações → Caminhões.
          </p>
        ) : (
          <Selecao
            rotulo="Caminhão"
            opcoes={opcoesCaminhao}
            valor={caminhao}
            aoMudar={(v) => {
              setCaminhao(v)
              setRotaEscolhida('')
            }}
            placeholder="Escolha o caminhão"
            tamanho="galpao"
          />
        )}
        {Number(caminhao) > 0 && Boolean(data) && (
          <>
            {rotas.isPending && <p className="text-sm text-texto-fraco">Vendo as rotas do dia…</p>}
            {rotas.isError && (
              <p className="rounded-dm bg-danificado-fundo px-3 py-2 text-sm text-danificado-texto">
                Não deu para ver as rotas deste dia — feche e abra de novo.
              </p>
            )}
            {rotas.isSuccess &&
              (opcoesRota.length > 1 ? (
                <Selecao
                  rotulo="Rota"
                  opcoes={opcoesRota}
                  valor={rota}
                  aoMudar={setRotaEscolhida}
                  tamanho="galpao"
                />
              ) : (
                <p className="text-sm text-texto-suave">
                  Primeira rota deste caminhão no dia ({nomeDaRota(1)}).
                </p>
              ))}
          </>
        )}
      </div>
    </Modal>
  )
}
