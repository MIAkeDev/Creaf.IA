import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'output/**', 'public/**', 'data/**', '**/*.d.mts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.mjs'], languageOptions: { globals: globals.node }, rules: { '@typescript-eslint/no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none' }] } },
  { files: ['src/**/*.{ts,tsx}'], languageOptions: { globals: globals.browser }, rules: { '@typescript-eslint/no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none' }] } },
);
