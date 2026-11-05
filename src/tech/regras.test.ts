import { describe, expect, it } from 'vitest'
import {
  COLUNAS,
  faixaDoNivel,
  letrasQueFaltam,
  nomeDoPrint,
  nomeLimpo,
  oQueFalta,
  sugestaoDaTarefa,
  sugestaoDoAviso,
  tipoDoArquivo,
} from './regras'

describe('sugestão de melhoria — regras da tela', () => {
  it('as colunas seguem a ordem do dono, com a fila primeiro', () => {
    expect(COLUNAS.map((c) => c.titulo)).toEqual([
      'Solicitações',
      'Backlog',
      'Fazendo',
      'Finalizada',
      'Recusada',
    ])
  })

  it('conta as letras que faltam sem os espaços das pontas', () => {
    expect(letrasQueFaltam('')).toBe(30)
    expect(letrasQueFaltam('   abc   ')).toBe(27)
    expect(letrasQueFaltam('x'.repeat(30))).toBe(0)
    expect(letrasQueFaltam('x'.repeat(45))).toBe(0)
  })

  it('diz tudo o que falta para enviar — e nada quando está completo', () => {
    expect(oQueFalta({ tipo: null, texto: 'abc', nivel: null, arquivos: 0 })).toEqual([
      'um arquivo (print, áudio, vídeo ou outro)',
      'o tipo (bug, melhoria ou implementação nova)',
      'mais 27 letras no texto',
      'o nível de necessidade',
    ])
    expect(oQueFalta({ tipo: 'bug', texto: 'x'.repeat(29), nivel: 5, arquivos: 1 })).toEqual([
      'mais 1 letra no texto',
    ])
    expect(oQueFalta({ tipo: 'melhoria', texto: 'x'.repeat(30), nivel: 1, arquivos: 2 })).toEqual([])
  })

  it('o nível vira palavra (estado nunca só por cor)', () => {
    expect(faixaDoNivel(1).rotulo).toBe('Pode esperar')
    expect(faixaDoNivel(4).rotulo).toBe('Média')
    expect(faixaDoNivel(7).rotulo).toBe('Alta')
    expect(faixaDoNivel(10).rotulo).toBe('Urgente')
  })

  it('o nome do arquivo cabe na regra do armário', () => {
    expect(nomeLimpo('Captura de tela (2).png')).toBe('Captura-de-tela-2.png')
    expect(nomeLimpo('ação ç.mp4')).toBe('acao-c.mp4')
    expect(nomeLimpo('///')).toBe('arquivo')
    expect(nomeLimpo('a'.repeat(120) + '.png')).toHaveLength(80)
    expect(nomeLimpo('Vídeo do erro.webm')).toMatch(/^[A-Za-z0-9._-]+$/)
  })

  it('o print colado ganha nome com a hora', () => {
    expect(nomeDoPrint(new Date(2026, 10, 5, 9, 7, 3))).toBe('print-2026-11-05-090703.png')
  })

  it('reconhece o tipo do arquivo pelo formato', () => {
    expect(tipoDoArquivo('image/png')).toBe('imagem')
    expect(tipoDoArquivo('video/mp4')).toBe('video')
    expect(tipoDoArquivo('audio/webm')).toBe('audio')
    expect(tipoDoArquivo('application/pdf')).toBe('arquivo')
  })

  it('a pendência "Testar a sugestão #N" leva à sugestão N — outras tarefas, não', () => {
    expect(sugestaoDaTarefa({ origem: 'sistema', card_id: null, titulo: 'Testar a sugestão #12' })).toBe(12)
    expect(sugestaoDaTarefa({ origem: 'pessoa', card_id: null, titulo: 'Testar a sugestão #12' })).toBeNull()
    expect(sugestaoDaTarefa({ origem: 'sistema', card_id: 4, titulo: 'Testar a sugestão #12' })).toBeNull()
    expect(sugestaoDaTarefa({ origem: 'sistema', card_id: null, titulo: 'Parecer de qualidade' })).toBeNull()
  })

  it('o aviso da sugestão leva à ficha; os outros avisos, não', () => {
    expect(sugestaoDoAviso({ tipo: 'sugestao_testar', titulo: 'Sugestão #7 pronta para testar' })).toBe(7)
    expect(sugestaoDoAviso({ tipo: 'sugestao_recusada', titulo: 'Sugestão #31 recusada' })).toBe(31)
    expect(sugestaoDoAviso({ tipo: 'card_mencao', titulo: 'Sugestão #7 pronta para testar' })).toBeNull()
  })
})
