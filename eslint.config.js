const globals = require('globals');

/**
 * Configuración portable de ESLint (Flat Config) para Hub Marcas LPS (Artesanitas, lospilares.pe y futuras marcas).
 * Enfocada en detectar errores reales en producción sin ruido estético.
 */
module.exports = [
  {
    ignores: [
      'node_modules/**',
      'public/js/vendor/**',
      'scripts/**'
    ]
  },
  {
    rules: {
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-duplicate-case': 'error',
      'no-redeclare': 'error',
      'no-const-assign': 'error',
      'no-func-assign': 'error',
      'valid-typeof': 'error',
      'use-isnan': 'error',
      'no-unreachable': 'warn',
      'no-self-assign': 'warn',
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none'
      }]
    }
  },
  {
    files: ['server/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        fbq: 'readonly',
        Chart: 'readonly',
        heic2any: 'readonly',
        BarcodeDetector: 'readonly',
        tailwind: 'readonly'
      }
    }
  },
  {
    files: ['public/sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.serviceworker
      }
    }
  }
];
