import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Loader2, Package } from 'lucide-react'
import { useNotificacao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { reduzirImagem } from '@/lib/imagem'
import { enviarFotoProduto, urlFotoProduto } from '@/logistica/api'

export interface FotoProdutoProps {
  produto: { tiny_id: number; codigo: string | null; descricao: string; imagem_caminho: string | null }
  /** Logística e admin cadastram a foto (pedido do dono, 28/09) — o banco confere de novo. */
  podeTrocar: boolean
  /** Tocar na foto abre o produto (a foto grande e as peças). */
  aoAbrir?: () => void
  /** Tamanho do ícone quando ainda não há foto. */
  iconeGrande?: boolean
  className?: string
}

/**
 * A foto do produto no Estoque (D-73): a capa que mora na biblioteca por SKU
 * (a mesma do tablet). Sem foto, o ícone no lugar; para a logística, o botão
 * de câmera no canto — escolhe da galeria ou tira na hora, a foto é reduzida
 * no aparelho antes de subir (rede do galpão).
 */
export function FotoProduto({
  produto,
  podeTrocar,
  aoAbrir,
  iconeGrande = true,
  className,
}: FotoProdutoProps) {
  const entrada = useRef<HTMLInputElement>(null)
  const notificar = useNotificacao()
  const clienteQuery = useQueryClient()
  const url = urlFotoProduto(produto.imagem_caminho)

  const envio = useMutation({
    mutationFn: async (arquivo: File) => {
      const { dados, extensao } = await reduzirImagem(arquivo)
      return enviarFotoProduto(produto, dados, extensao)
    },
    onSuccess: async () => {
      notificar({ titulo: 'Foto do produto salva', tom: 'perfeito' })
      await clienteQuery.invalidateQueries({ queryKey: ['estoque'] })
    },
    onError: (erro) =>
      notificar({
        titulo: 'Não deu para salvar a foto',
        descricao: erro instanceof Error ? erro.message : undefined,
        tom: 'danificado',
      }),
  })

  const imagem = url ? (
    <img src={url} alt="" loading="lazy" className="size-full object-cover" />
  ) : (
    <span className="flex size-full items-center justify-center text-texto-fraco">
      <Package aria-hidden className={iconeGrande ? 'size-10' : 'size-6'} />
    </span>
  )

  return (
    <div className={cn('relative overflow-hidden bg-superficie-sutil', className)}>
      {aoAbrir ? (
        <button
          type="button"
          onClick={aoAbrir}
          aria-label={`Ver ${produto.descricao || 'o produto'}`}
          className="block size-full transition-opacity hover:opacity-90"
        >
          {imagem}
        </button>
      ) : (
        imagem
      )}
      {podeTrocar && (
        <>
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0]
              if (arquivo) envio.mutate(arquivo)
              evento.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={envio.isPending}
            aria-label={url ? 'Trocar a foto do produto' : 'Pôr foto no produto'}
            title={url ? 'Trocar a foto' : 'Pôr foto'}
            className={cn(
              'absolute right-2 bottom-2 inline-flex size-toque-md items-center justify-center rounded-full',
              'border border-borda bg-superficie/90 text-texto shadow-md transition-[translate,box-shadow]',
              'hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60',
            )}
          >
            {envio.isPending ? (
              <Loader2 aria-hidden className="size-5 animate-spin" />
            ) : (
              <Camera aria-hidden className="size-5" />
            )}
          </button>
        </>
      )}
    </div>
  )
}
