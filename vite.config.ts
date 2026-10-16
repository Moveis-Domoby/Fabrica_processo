/// <reference types="vitest/config" />
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
 * versão no código e num arquivo pequeno (`versao.json`) que a tela confere
 * quando a pessoa troca de tela ou volta à aba.
 */
const VERSAO_APP = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || new Date().toISOString()

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
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'versao.json',
          source: JSON.stringify({ versao: VERSAO_APP }),
        })
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
  define: {
    __VERSAO_APP__: JSON.stringify(VERSAO_APP),
  },
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
