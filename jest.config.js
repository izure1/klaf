/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  projects: [
    {
      preset: 'ts-jest',
      displayName: 'Node',
      testEnvironment: 'node',
      moduleNameMapper: {
        '^tissue-roll$': ['<rootDir>/src/index.ts'],
        '^tissue-roll/engine/DataEngine$': ['<rootDir>/src/engine/DataEngine.ts'],
        '^tissue-roll/engine/FileSystem$': ['<rootDir>/src/engine/FileSystem.ts'],
        '^tissue-roll/engine/InMemory$': ['<rootDir>/src/engine/InMemory.ts'],
        '^tissue-roll/engine/WebWorker$': ['<rootDir>/src/engine/WebWorker.ts'],
      },
      setupFiles: [
        './jest.setup.js'
      ]
    },
    {
      preset: 'ts-jest',
      displayName: 'Browser',
      testEnvironment: 'jsdom',
      moduleNameMapper: {
        '^tissue-roll$': ['<rootDir>/src/index.ts'],
        '^tissue-roll/engine/DataEngine$': ['<rootDir>/src/engine/DataEngine.ts'],
        '^tissue-roll/engine/FileSystem$': ['<rootDir>/src/engine/FileSystem.ts'],
        '^tissue-roll/engine/InMemory$': ['<rootDir>/src/engine/InMemory.ts'],
        '^tissue-roll/engine/WebWorker$': ['<rootDir>/src/engine/WebWorker.ts'],
      },
      setupFiles: [
        './jest.setup.js'
      ]
    }
  ],
};
