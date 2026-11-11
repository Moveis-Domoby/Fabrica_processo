/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { fileURLToPath, URL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { defineConfig } from 'vite'
import type { Rollup } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * A versão desta montagem (ajuste do dono, 14/10 noite): quem ficou com a
 * plataforma aberta desde antes de uma atualização continuava na versão velha
 * (as duas rotas no mesmo dia "não funcionavam" por isso). A montagem grava a
 * versão num arquivo pequeno (`versao.json`) que a tela confere quando a pessoa
 * troca de tela ou volta à aba.
 *
 * ↩️ SESSAO-48 (frente 5 — "a plataforma recarrega sozinha"): a versão era o
 * COMMIT, embutido no pedaço de entrada. Todo commit — até um só de
 * documentação — trocava o nome da entrada e, em cascata, o de 89 dos 215
 * arquivos (todo pedaço que importa a entrada): depois de cada publicação, a
 * tela aberta recebia "versão nova" e, ao abrir uma tela ou janela ainda não
 * carregada, o pedaço antigo já não existia (recarga na hora). Agora a versão
 * é o CÓDIGO MONTADO: um resumo dos nomes de todos os arquivos (os nomes já
 * trazem o resumo do conteúdo) e do index.html — o mesmo código dá a mesma
 * versão e os mesmos nomes; mudar qualquer pedaço, o CSS ou o index.html muda
 * a versão. A página sabe a própria versão pelo index.html que a carregou
 * (`<meta name="domoby-versao">`), nunca pelo pedaço de entrada (seria
 * circular: a entrada faz parte do resumo).
 */
const META_VERSAO = 'domoby-versao'

function versaoDaMontagem(nomes: string[], html: string): string {
  const resumo = createHash('sha256')
  for (const nome of [...nomes].sort()) resumo.update(`${nome}\n`)
  resumo.update(html)
  return resumo.digest('hex').slice(0, 12)
}

/**
 * O TETO do pacote inicial (SESSAO-32 · Lei de Desempenho §9): o JS que o
 * navegador baixa para abrir a plataforma — a entrada e tudo o que ela importa
 * direto — não passa de 250 KB comprimidos. Passou, a montagem FALHA (e o site
 * não sobe): a tela nova vira pedaço próprio antes de publicar.
 */
const TETO_JS_INICIAL_KB = 250

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'versao-do-app',
      apply: 'build',
      generateBundle: {
        // depois de todos: o index.html e o CSS já estão no pacote
        order: 'post',
        handler(_opcoes, pacote) {
          const pagina = pacote['index.html']
          if (!pagina || pagina.type !== 'asset') {
            this.error('versao-do-app: o index.html não está no pacote')
          }
          const html =
            typeof pagina.source === 'string'
              ? pagina.source
              : new TextDecoder().decode(pagina.source)
          const nomes = Object.keys(pacote).filter((n) => n !== 'index.html' && n !== 'versao.json')
          const versao = versaoDaMontagem(nomes, html)
          if (html.split('</head>').length !== 2) {
            this.error('versao-do-app: o index.html precisa de exatamente um </head>')
          }
          pagina.source = html.replace(
            '</head>',
            `  <meta name="${META_VERSAO}" content="${versao}" />\n  </head>`,
          )
          this.emitFile({
            type: 'asset',
            fileName: 'versao.json',
            source: JSON.stringify({ versao }),
          })
        },
      },
    },
    {
      name: 'teto-do-pacote-inicial',
      apply: 'build',
      generateBundle(_opcoes, pacote) {
        const pedacos = Object.values(pacote).filter(
          (p): p is Rollup.OutputChunk => p.type === 'chunk',
        )
        const porNome = new Map(pedacos.map((p) => [p.fileName, p]))
        const iniciais = new Set<string>()
        const visitar = (nome: string) => {
          if (iniciais.has(nome)) return
          iniciais.add(nome)
          for (const importado of porNome.get(nome)?.imports ?? []) visitar(importado)
        }
        for (const p of pedacos) if (p.isEntry) visitar(p.fileName)
        let bytes = 0
        for (const nome of iniciais) bytes += gzipSync(porNome.get(nome)?.code ?? '').length
        const kb = bytes / 1024
        const resumo = `JS inicial: ${kb.toFixed(1)} KB comprimidos em ${iniciais.size} arquivos (teto ${TETO_JS_INICIAL_KB} KB)`
        if (kb > TETO_JS_INICIAL_KB) {
          this.error(`${resumo} — divida a tela nova em pedaço próprio (Lei de Desempenho §9).`)
        }
        console.log(`
${resumo}`)
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // acessível de tablet/celular na rede do galpão (D-06)
    host: true,
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/teste/setup.ts'],
    css: true,
  },
})
