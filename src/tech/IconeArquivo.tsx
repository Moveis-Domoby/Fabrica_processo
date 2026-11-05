import { FileAudio, FileImage, FileText, FileVideo } from 'lucide-react'
import type { TipoArquivo } from './regras'

/** O ícone de cada tipo de arquivo da sugestão (imagem, vídeo, áudio, outro). */
export function IconeArquivo({ tipo, className }: { tipo: TipoArquivo; className?: string }) {
  if (tipo === 'imagem') return <FileImage aria-hidden className={className} />
  if (tipo === 'video') return <FileVideo aria-hidden className={className} />
  if (tipo === 'audio') return <FileAudio aria-hidden className={className} />
  return <FileText aria-hidden className={className} />
}
