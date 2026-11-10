import { beforeEach, describe, expect, it, vi } from 'vitest'
import { anexarComprovante } from './api'

/**
 * SESSAO-47 (vários comprovantes de uma vez): "tentar de novo" manda só o
 * arquivo que falhou — e não deixa cópia solta no armário. Com a chave do
 * arquivo o caminho é sempre o mesmo; se o arquivo já tinha subido e só o
 * registro falhou, o armário responde "já existe" e o registro segue.
 */
const { upload, rpc } = vi.hoisted(() => ({ upload: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: { from: () => ({ upload }) },
    rpc,
  },
}))

const CHAVE = '11111111-2222-4333-8444-555555555555'
const pdf = (nome = 'recibo-1.pdf') => new File(['conteúdo'], nome, { type: 'application/pdf' })
const caminhosDoArmario = () => upload.mock.calls.map((c) => c[0] as string)
const caminhosRegistrados = () =>
  rpc.mock.calls.map((c) => (c[1] as { p_caminho: string }).p_caminho)

beforeEach(() => {
  upload.mockReset().mockResolvedValue({ data: { path: 'no-armario' }, error: null })
  rpc.mockReset().mockResolvedValue({ data: 1, error: null })
})

describe('anexarComprovante — o caminho do arquivo no armário', () => {
  it('com a chave do arquivo, o caminho é sempre o mesmo — e é o que o banco registra', async () => {
    await anexarComprovante(21, pdf(), CHAVE)
    await anexarComprovante(21, pdf(), CHAVE)
    expect(caminhosDoArmario()).toEqual([`21/${CHAVE}-recibo-1.pdf`, `21/${CHAVE}-recibo-1.pdf`])
    expect(rpc).toHaveBeenLastCalledWith(
      'plt_fn_anexo_registrar',
      expect.objectContaining({
        p_card_id: 21,
        p_caminho: `21/${CHAVE}-recibo-1.pdf`,
        p_nome_arquivo: 'recibo-1.pdf',
        p_tipo: 'comprovante',
      }),
    )
  })

  it('sem a chave (o jeito de antes), cada envio ganha um caminho novo, sempre na pasta do card', async () => {
    await anexarComprovante(21, pdf())
    await anexarComprovante(21, pdf())
    const [primeiro, segundo] = caminhosDoArmario()
    expect(primeiro).toMatch(/^21\/[0-9a-f-]{36}-recibo-1\.pdf$/)
    expect(segundo).toMatch(/^21\/[0-9a-f-]{36}-recibo-1\.pdf$/)
    expect(primeiro).not.toBe(segundo)
  })

  it('o nome que vai ao armário não leva espaço nem símbolo; o nome de verdade fica no registro', async () => {
    await anexarComprovante(21, pdf('Recibo do João (2ª via).pdf'), CHAVE)
    expect(caminhosDoArmario()[0]).toMatch(new RegExp(`^21/${CHAVE}-[\\w.-]+\\.pdf$`))
    expect(rpc).toHaveBeenLastCalledWith(
      'plt_fn_anexo_registrar',
      expect.objectContaining({ p_nome_arquivo: 'Recibo do João (2ª via).pdf' }),
    )
  })
})

describe('anexarComprovante — tentar de novo sem cópia solta', () => {
  it('o arquivo JÁ tinha subido e só o registro falhou: o armário diz "já existe" e o registro segue, no mesmo caminho', async () => {
    // 1ª tentativa: o arquivo sobe, o registro falha
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'a internet caiu' } })
    await expect(anexarComprovante(21, pdf(), CHAVE)).rejects.toThrow('a internet caiu')
    // as novas tentativas: o armário recusa por já existir — de cada jeito que ele diz isso
    const jeitos = [
      { message: 'The resource already exists', status: 400, statusCode: '409' },
      { message: 'Duplicate', status: 409, statusCode: '409' },
      { message: 'conflito', status: 409 },
      { message: 'recusado', status: 400, statusCode: 'ResourceAlreadyExists' },
      { message: 'recusado', status: 400, code: 'ResourceAlreadyExists' },
    ]
    for (const recusa of jeitos) {
      upload.mockResolvedValueOnce({ data: null, error: recusa })
      await expect(anexarComprovante(21, pdf(), CHAVE)).resolves.toBeUndefined()
    }
    expect(rpc).toHaveBeenCalledTimes(1 + jeitos.length)
    expect(new Set(caminhosRegistrados())).toEqual(new Set([`21/${CHAVE}-recibo-1.pdf`]))
  })

  it('sem a chave, "já existe" continua sendo erro — e nada é registrado', async () => {
    upload.mockResolvedValueOnce({
      data: null,
      error: { message: 'The resource already exists', status: 400, statusCode: '409' },
    })
    await expect(anexarComprovante(21, pdf())).rejects.toThrow(
      'Não deu para enviar o arquivo: The resource already exists',
    )
    expect(rpc).not.toHaveBeenCalled()
  })

  it('qualquer outra recusa do armário é erro, com o porquê — e nada é registrado', async () => {
    upload.mockResolvedValueOnce({
      data: null,
      error: { message: 'a internet caiu no meio do envio', status: 500, statusCode: '500' },
    })
    await expect(anexarComprovante(21, pdf(), CHAVE)).rejects.toThrow(
      'Não deu para enviar o arquivo: a internet caiu no meio do envio',
    )
    expect(rpc).not.toHaveBeenCalled()
  })

  it('o documento com mais de 10 MB nem sai do aparelho', async () => {
    const grande = pdf('contrato.pdf')
    Object.defineProperty(grande, 'size', { value: 11 * 1024 * 1024 })
    await expect(anexarComprovante(21, grande, CHAVE)).rejects.toThrow('mais de 10 MB')
    expect(upload).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
})
