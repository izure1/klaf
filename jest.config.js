/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  displayName: 'Node',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^klaf.js$': ['<rootDir>/src/index.ts'],
    '^klaf.js/engine/DataEngine$': ['<rootDir>/src/engine/DataEngine.ts'],
    '^klaf.js/engine/FileSystem$': ['<rootDir>/src/engine/FileSystem.ts'],
    '^klaf.js/engine/InMemory$': ['<rootDir>/src/engine/InMemory.ts'],
    '^klaf.js/engine/WebWorker$': ['<rootDir>/src/engine/WebWorker.ts'],
  }
};
