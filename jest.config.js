/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  projects: [
    {
      preset: 'ts-jest',
      displayName: 'Node',
      testEnvironment: 'node',
      moduleNameMapper: {
        '^klaf$': ['<rootDir>/src/index.ts'],
        '^klaf/engine/DataEngine$': ['<rootDir>/src/engine/DataEngine.ts'],
        '^klaf/engine/FileSystem$': ['<rootDir>/src/engine/FileSystem.ts'],
        '^klaf/engine/InMemory$': ['<rootDir>/src/engine/InMemory.ts'],
        '^klaf/engine/WebWorker$': ['<rootDir>/src/engine/WebWorker.ts'],
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
        '^klaf$': ['<rootDir>/src/index.ts'],
        '^klaf/engine/DataEngine$': ['<rootDir>/src/engine/DataEngine.ts'],
        '^klaf/engine/FileSystem$': ['<rootDir>/src/engine/FileSystem.ts'],
        '^klaf/engine/InMemory$': ['<rootDir>/src/engine/InMemory.ts'],
        '^klaf/engine/WebWorker$': ['<rootDir>/src/engine/WebWorker.ts'],
      },
      setupFiles: [
        './jest.setup.js'
      ]
    }
  ],
};
