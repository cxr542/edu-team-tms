import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// 첫 도입 단계: 오류는 CI에서 막고, 이미 코드에 걸려 있는 규칙은 경고로 시작한다.
// 경고를 정리한 뒤 해당 규칙을 'error'로 올리고 lint 스크립트에 --max-warnings 0을 되돌린다.
const STARTING_WARNINGS = {
  'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]' }],
  'no-useless-assignment': 'warn',
  'no-control-regex': 'warn',
  'no-extra-boolean-cast': 'warn',
};

export default [
  {
    // 빌드 산출물, 복사·정적 파일, 다른 저장소에서 가져온 도구, 시안은 검사하지 않는다.
    ignores: [
      'dist/**',
      'public/**',
      '.vercel/**',
      'outputs/**',
      'logs/**',
      'backups-*/**',
      'docs/**',
      'tools/**',
      'prototypes/**',
      'preview/**',
      'supabase/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      ...STARTING_WARNINGS,
    },
  },
  {
    files: ['api/**/*.{js,mjs}', 'server/**/*.{js,mjs}', 'scripts/**/*.{js,mjs}', 'tests/**/*.{js,mjs,jsx}', '*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...STARTING_WARNINGS,
    },
  },
];
