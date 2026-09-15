import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // supabase/functions roda no Deno (globals próprios) — fica fora do lint do front
  { ignores: ['dist', 'node_modules', '_docs', 'coverage', 'supabase/functions'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // Módulo Comercial (SESSAO-20, D-46): código PORTADO 1:1 do Painel de
  // Recompra, que lintava com oxlint (permissivo). A demanda proíbe refatorar
  // o porte ("aproveitar para fazer" não existe), então as regras que o código
  // de lá nunca seguiu ficam desligadas SÓ aqui — adaptação de build, como o
  // Tailwind v3→v4. Código NOVO da casa continua sob as regras cheias; os
  // achados por trás disso já estão catalogados no cofre do recompra (DT-*).
  {
    files: ['src/comercial/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-empty': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
)
