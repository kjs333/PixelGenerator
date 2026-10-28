import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // 보안 규칙: 문자열을 HTML로 해석하는 API 금지 (DEV 6.8)
    rules: {
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'innerHTML 금지. h()와 textContent를 쓰세요.' },
        { property: 'outerHTML', message: 'outerHTML 금지.' },
        { property: 'insertAdjacentHTML', message: 'insertAdjacentHTML 금지.' },
      ],
    },
  },
);
