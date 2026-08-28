import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Botao, Modal, useNotificacao } from '@/componentes/ui'
import { enviarImagemProduto, listarImagensProduto, removerImagemProduto } from './api'

export interface ModalImagensProdutoProps {
  /** null = fechado. O SKU do produto cujas imagens aparecem. */
  codigo: string | null
  descricao?: string
  /** admin/líder anexa e remove; operador só vê (D-28). */
  podeEditar: boolean
  aoFechar: () => void
}

/**
 * O espaço de imagens do produto (D-28): o operador vê as fotos da peça; o
 * admin/líder anexa. As imagens pertencem ao PRODUTO (SKU) — quando a
 * biblioteca de peças for importada, ela cai direto nestas pastas.
 */
export function ModalImagensProduto({
  codigo,
  descricao,
  podeEditar,
  aoFechar,
}: ModalImagensProdutoProps) {
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const inputArquivo = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState('')

  const { data: imagens = [], isPending } = useQuery({
    queryKey: ['imagens-produto', codigo],
    queryFn: () => listarImagensProduto(codigo!),
    enabled: codigo !== null,
  })

  const invalidar = () =>
    clienteQuery.invalidateQueries({ queryKey: ['imagens-produto', codigo] })

  const envio = useMutation({
    mutationFn: (arquivo: File) => enviarImagemProduto(codigo!, arquivo),
    onSuccess: async () => {
      notificar({ titulo: 'Imagem anexada', tom: 'perfeito' })
      await invalidar()
    },
    onError: (excecao) =>
      setErro(excecao instanceof Error ? excecao.message : 'Não deu para enviar.'),
  })

  const remocao = useMutation({
    mutationFn: removerImagemProduto,
    onSuccess: invalidar,
    onError: (excecao) =>
      setErro(excecao instanceof Error ? excecao.message : 'Não deu para remover.'),
  })

  return (
    <Modal
      aberto={codigo !== null}
      aoFechar={(aberto) => {
        if (!aberto) aoFechar()
      }}
      titulo="Fotos da peça"
      descricao={descricao}
      tamanho="galpao"
      rodape={
        podeEditar ? (
          <>
            <input
              ref={inputArquivo}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0]
                if (arquivo) envio.mutate(arquivo)
                e.target.value = ''
              }}
            />
            <Botao
              tamanho="lg"
              icone={<ImagePlus />}
              carregando={envio.isPending}
              onClick={() => inputArquivo.current?.click()}
            >
              Anexar imagem
            </Botao>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        {isPending && <p className="text-sm text-texto-fraco">Carregando…</p>}
        {!isPending && imagens.length === 0 && (
          <p className="rounded-dm border border-borda bg-superficie-sutil p-4 text-sm text-texto-suave">
            Nenhuma imagem desta peça ainda.
            {podeEditar
              ? ' Anexe a primeira pelo botão abaixo.'
              : ' Quando a liderança anexar, elas aparecem aqui.'}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {imagens.map((imagem) => (
            <figure key={imagem.caminho} className="relative overflow-hidden rounded-dm border border-borda">
              <img
                src={imagem.url}
                alt={`Foto da peça ${descricao ?? ''}`}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
              {podeEditar && (
                <Botao
                  variante="perigo"
                  tamanho="sm"
                  icone={<Trash2 />}
                  aria-label="Remover esta imagem"
                  className="absolute right-1.5 top-1.5"
                  carregando={remocao.isPending}
                  onClick={() => remocao.mutate(imagem.caminho)}
                />
              )}
            </figure>
          ))}
        </div>
        {erro && (
          <p className="text-sm text-danificado-forte" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
