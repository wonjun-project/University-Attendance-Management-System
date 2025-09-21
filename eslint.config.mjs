import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname
})

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      'frontend/**',
      'temp_disabled/**',
      'data/**',
      'test-results/**',
      'apply-migration.js'
    ]
  },
  js.configs.recommended,
  ...compat.config({
    extends: ['next/core-web-vitals', 'next/typescript'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'prefer-const': 'warn'
    }
  })
]

export default config
