import { useState } from 'react'
import { Botao, Campo, Modal, Selecao } from '@/componentes/ui'

/**
 * Confirmar a programação (D-39): dia + caminhão. Serve para programar a rota
 * montada ("Programar") e para reprogramar um pedido ("Já programadas").
 */
export function ModalProgramar({
  titulo,
  resumo,
  diaInicial,
  caminhaoInicial,
  opcoesCaminhao,
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
  carregando: boolean
  aoFechar: () => void
  aoConfirmar: (data: string, caminhaoId: number) => void
}) {
  const [data, setData] = useState(diaInicial)
  const [caminhao, setCaminhao] = useState(caminhaoInicial)
  const pronto = Boolean(data) && Number(caminhao) > 0

  return (
    <Modal
      aberto
      aoFechar={(aberto) => {
        if (!aberto) aoFechar()
      }}
      titulo={titulo}
      descricao="Confirme o dia e o caminhão. Dá para reprogramar a qualquer instante — só não depois de entregue."
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            variante="primaria"
            disabled={!pronto}
            carregando={carregando}
            onClick={() => aoConfirmar(data, Number(caminhao))}
          >
            Confirmar
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {resumo && <p className="text-sm text-texto tabular-nums">{resumo}</p>}
        <Campo rotulo="Dia" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        {opcoesCaminhao.length === 0 ? (
          <p className="rounded-dm bg-atencao-fundo px-3 py-2 text-sm text-atencao-texto">
            Nenhum caminhão cadastrado — cadastre em Configurações → Caminhões.
          </p>
        ) : (
          <Selecao
            rotulo="Caminhão"
            opcoes={opcoesCaminhao}
            valor={caminhao}
            aoMudar={setCaminhao}
            placeholder="Escolha o caminhão"
            tamanho="galpao"
          />
        )}
      </div>
    </Modal>
  )
}
