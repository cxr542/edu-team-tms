import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// 정리를 마친 규칙은 오류로 막는다.
// 쓰지 않는 인자는 이름 앞에 _를 붙여 남길 수 있고, 나머지(...rest)를 얻으려고 꺼낸 값은 허용한다.
const CLEANED_RULES = {
  'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
  'no-useless-assignment': 'error',
  'no-control-regex': 'error',
  'no-extra-boolean-cast': 'error',
};

// 남은 경고(장부·일지 exhaustive-deps, HMR)를 정리한 뒤 lint에 --max-warnings 0을 되돌린다.

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
      ...CLEANED_RULES,
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
      ...CLEANED_RULES,
    },
  },
];
