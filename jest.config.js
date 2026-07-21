// jest.config.js — Jest configuration for the TypeScript test suite.
// The project is end-to-end TypeScript, so tests run through @swc/jest (ts-jest
// is incompatible with TypeScript 7). Type-checking stays with `tsc --noEmit`.
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  // mongod spawn (and first-run binary download) is slower than the 5s default.
  testTimeout: 30_000,
  transform: {
    '^.+\\.(t|j)s$': ['@swc/jest'],
  },
  // mongodb-memory-server lifecycle + per-test collection cleanup.
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  testMatch: ['<rootDir>/src/tests/**/*.test.ts'],
  // Coverage focuses on the layers with logic: services, middlewares, utils.
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/middlewares/**/*.ts',
    'src/utils/**/*.ts',
  ],
  coverageThreshold: {
    global: { lines: 80, statements: 80 },
  },
};
