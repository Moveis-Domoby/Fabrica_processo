import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProvedorNotificacao } from '@/componentes/ui'
import * as api from './api'
import { ModalComprovantes } from './ModalComprovantes'
import { acrescentarComprovantes } from './enviarComprovantes'
import { useComprovantes } from './useComprovantes'

/**
 * SESSAO-47 (pedido do dono): "anexar mais de um arquivo de comprovante por vez
 * ao pedido". A janela mostra o estado de cada arquivo; se um falha, os outros
 * ficam, a tela diz QUAL falhou e por quê, e "tentar de novo" reenvia só ele.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('./api', async (original) => {
  const real = await original<typeof import('./api')>()
  return { ...real, anexarComprovante: vi.fn() }
})

const pdf = (nome: string) => new File(['conteúdo'], nome, { type: 'application/pdf' })

/** A tela de quem usa: um botão que abre a janela (como o "Comprovante" do card). */
function Tela({ aoEnviar, jaEntregue = false }: { aoEnviar: () => void; jaEntregue?: boolean }) {
  const envio = useComprovantes(aoEnviar)
  return (
    <>
      <button
        type="button"
        onClick={() =>
          jaEntregue
            ? envio.abrir(
                { card_id: 21, numero: 13836 },
                {
                  arquivos: acrescentarComprovantes([], [pdf('recibo-1.pdf'), pdf('recibo-2.pdf')])
                    .lista,
                  depoisDaEntrega: true,
                },
              )
            : envio.abrir({ card_id: 21, numero: 13836 })
        }
      >
        abrir a janela
      </button>
      <ModalComprovantes envio={envio} />
    </>
  )
}

function desenhar(jaEntregue = false) {
  const aoEnviar = vi.fn()
  render(
    <ProvedorNotificacao>
      <Tela aoEnviar={aoEnviar} jaEntregue={jaEntregue} />
    </ProvedorNotificacao>,
  )
  return { aoEnviar }
}

const linhaDe = (janela: HTMLElement, nome: string) => within(janela).getByText(nome).closest('li')!

beforeEach(() => {
  let falhou = false
  vi.mocked(api.anexarComprovante)
    .mockReset()
    .mockImplementation(async (_card, arquivo) => {
      // o recibo-2 falha na PRIMEIRA tentativa (a internet caiu) e sobe na segunda
      if (arquivo.name === 'recibo-2.pdf' && !falhou) {
        falhou = true
        throw new Error('Não deu para enviar o arquivo: a internet caiu')
      }
    })
})

describe('ModalComprovantes — vários comprovantes de uma vez', () => {
  it('escolhe vários, tira um antes de enviar; uma falha no meio não derruba os outros e a tela diz qual falhou; "tentar de novo" reenvia só ele', async () => {
    const { aoEnviar } = desenhar()
    await userEvent.click(screen.getByRole('button', { name: 'abrir a janela' }))
    const janela = await screen.findByRole('dialog', { name: 'Comprovantes — pedido 13836' })
    // sem nada escolhido não há o que anexar
    expect(within(janela).getByRole('button', { name: 'Anexar' })).toBeDisabled()

    const escolher = within(janela).getByLabelText('Escolher arquivos')
    expect(escolher).toHaveAttribute('multiple')
    await userEvent.upload(escolher, [
      pdf('recibo-1.pdf'),
      pdf('recibo-2.pdf'),
      pdf('recibo-3.pdf'),
      pdf('escolhido-errado.pdf'),
    ])
    const lista = within(janela).getByRole('list', { name: 'Arquivos escolhidos' })
    expect(within(lista).getAllByRole('listitem')).toHaveLength(4)
    // tira um antes de enviar
    await userEvent.click(
      within(janela).getByRole('button', { name: 'Tirar escolhido-errado.pdf' }),
    )
    expect(within(lista).getAllByRole('listitem')).toHaveLength(3)

    await userEvent.click(within(janela).getByRole('button', { name: 'Anexar 3 arquivos' }))
    await waitFor(() => expect(api.anexarComprovante).toHaveBeenCalledTimes(3))
    // os dois que subiram ficam; o que falhou tem nome e porquê
    await waitFor(() => expect(linhaDe(janela, 'recibo-3.pdf')).toHaveTextContent('enviado'))
    expect(linhaDe(janela, 'recibo-1.pdf')).toHaveTextContent('enviado')
    expect(linhaDe(janela, 'recibo-2.pdf')).toHaveTextContent(
      'falhou — Não deu para enviar o arquivo: a internet caiu',
    )
    expect(within(janela).getByRole('status')).toHaveTextContent('2 de 3 enviados · 1 não subiu')
    expect(aoEnviar).toHaveBeenCalledTimes(1)
    // o que já subiu não se tira mais (já está no pedido); o que falhou, sim
    expect(
      within(janela).queryByRole('button', { name: 'Tirar recibo-1.pdf' }),
    ).not.toBeInTheDocument()
    expect(within(janela).getByRole('button', { name: 'Tirar recibo-2.pdf' })).toBeInTheDocument()

    await userEvent.click(
      within(janela).getByRole('button', { name: 'Tentar de novo o arquivo que falhou' }),
    )
    await waitFor(() => expect(api.anexarComprovante).toHaveBeenCalledTimes(4))
    const chamadas = vi.mocked(api.anexarComprovante).mock.calls
    // a 4ª chamada é SÓ o recibo-2, no mesmo pedido e com a MESMA chave da 1ª tentativa dele
    expect(chamadas[3][0]).toBe(21)
    expect(chamadas[3][1].name).toBe('recibo-2.pdf')
    expect(chamadas[3][2]).toBe(chamadas[1][2])
    expect(new Set(chamadas.slice(0, 3).map((c) => c[2])).size).toBe(3)
    // tudo no pedido: a janela fecha e a tela avisa
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('3 comprovantes anexados ao pedido 13836')).toBeInTheDocument()
    expect(aoEnviar).toHaveBeenCalledTimes(2)
  })

  it('depois do "Entregue": os arquivos escolhidos no painel sobem na hora; se um falha, a entrega fica e a janela diz qual', async () => {
    desenhar(true)
    await userEvent.click(screen.getByRole('button', { name: 'abrir a janela' }))
    const janela = await screen.findByRole('dialog', { name: 'Comprovantes — pedido 13836' })
    await waitFor(() => expect(api.anexarComprovante).toHaveBeenCalledTimes(2))
    expect(
      within(janela).getByText(/A entrega do pedido 13836 já ficou registrada/),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(linhaDe(janela, 'recibo-2.pdf')).toHaveTextContent('falhou — Não deu para enviar'),
    )
    expect(linhaDe(janela, 'recibo-1.pdf')).toHaveTextContent('enviado')
    expect(
      within(janela).getByRole('button', { name: 'Tentar de novo o arquivo que falhou' }),
    ).toBeEnabled()
    // sair sem tentar de novo: o que subiu fica no pedido
    await userEvent.click(within(janela).getByRole('button', { name: 'Deixar para depois' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.anexarComprovante).toHaveBeenCalledTimes(2)
  })

  it('um arquivo só também vale — e o texto fica no singular', async () => {
    desenhar()
    await userEvent.click(screen.getByRole('button', { name: 'abrir a janela' }))
    const janela = await screen.findByRole('dialog')
    await userEvent.upload(within(janela).getByLabelText('Escolher arquivos'), pdf('recibo-1.pdf'))
    await userEvent.click(within(janela).getByRole('button', { name: 'Anexar 1 arquivo' }))
    expect(await screen.findByText('1 comprovante anexado ao pedido 13836')).toBeInTheDocument()
    expect(api.anexarComprovante).toHaveBeenCalledTimes(1)
  })
})
