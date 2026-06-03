module.exports = {
  displayName: 'wc-nest-api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    // .tsx included so the wc-email-templates React Email components — re-exported
    // from packages/wc-email-templates/src/index.ts via tsconfig path mapping — get
    // transpiled by ts-jest when the catalog/worker pulls them in under test.
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  coverageDirectory: '../../coverage/apps/wc-nest-api',
}
