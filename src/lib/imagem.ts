/**
 * Foto de celular tem 3–8 MB; a grade do Estoque mostra 20 de uma vez, na rede
 * do galpão. Antes de subir, a foto é reduzida no próprio aparelho (lado maior
 * até `ladoMaximo`, JPEG ~0,82) — fica com poucas centenas de KB. Se o
 * navegador não conseguir (formato estranho, sem canvas), sobe o original.
 */
export async function reduzirImagem(
  arquivo: File,
  ladoMaximo = 1280,
): Promise<{ dados: Blob; extensao: string }> {
  const original = { dados: arquivo as Blob, extensao: extensaoDe(arquivo) }
  if (!arquivo.type.startsWith('image/') || typeof createImageBitmap !== 'function') return original
  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height))
    const largura = Math.max(1, Math.round(bitmap.width * escala))
    const altura = Math.max(1, Math.round(bitmap.height * escala))
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const contexto = canvas.getContext('2d')
    if (!contexto) return original
    // JPEG não tem transparência: sem fundo pintado, o recorte (PNG
    // transparente) sairia com fundo PRETO. Branco = o fundo das fotos do
    // catálogo (D-81).
    contexto.fillStyle = '#ffffff'
    contexto.fillRect(0, 0, largura, altura)
    contexto.drawImage(bitmap, 0, 0, largura, altura)
    bitmap.close()
    const reduzida = await new Promise<Blob | null>((resolver) =>
      canvas.toBlob(resolver, 'image/jpeg', 0.82),
    )
    // Só troca se de fato ficou menor.
    if (!reduzida || reduzida.size >= arquivo.size) return original
    return { dados: reduzida, extensao: 'jpg' }
  } catch {
    return original
  }
}

function extensaoDe(arquivo: File): string {
  const pelaExtensao = arquivo.name.includes('.') ? arquivo.name.split('.').pop() : ''
  const limpa = (pelaExtensao ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
  return limpa || 'jpg'
}
