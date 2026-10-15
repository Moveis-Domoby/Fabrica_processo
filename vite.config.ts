/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
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
