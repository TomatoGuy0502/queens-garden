import pluginVue from 'eslint-plugin-vue'
import { withVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import oxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier'

export default withVueTs(
  {
    name: 'queens/ignores',
    ignores: [
      'dist/**',
      'dist-server/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommendedTypeChecked,
  vueTsConfigs.stylisticTypeChecked,
  {
    name: 'queens/typescript',
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    name: 'queens/app-entry',
    files: ['src/App.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  // Oxfmt owns formatting; keep ESLint focused on correctness and Vue semantics.
  skipFormatting,
  // Disable only the rules enabled in our actual Oxlint config.
  ...(await oxlint.buildFromConfigFile('./.oxlintrc.json')),
)
