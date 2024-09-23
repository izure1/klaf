const esbuild = require('esbuild')

// TissueRoll
const TissueRollConfig = {
  target: 'esnext',
  bundle: true,
  entryPoints: [
    { in: 'src/index.ts', out: 'index' }
  ],
}

esbuild.build({
  ...TissueRollConfig,
  platform: 'browser',
  format: 'esm',
  outdir: 'dist/esm',
  outExtension: {
    '.js': '.mjs'
  },
})

esbuild.build({
  ...TissueRollConfig,
  platform: 'node',
  format: 'cjs',
  outdir: 'dist/cjs',
  outExtension: {
    '.js': '.cjs'
  },
})

// Data engine
const DataEngineConfig = {
  target: 'esnext',
  bundle: true,
}

esbuild.build({
  ...DataEngineConfig,
  platform: 'browser',
  format: 'esm',
  outdir: 'dist/esm/engine',
  outExtension: {
    '.js': '.mjs'
  },
  entryPoints: [
    { in: 'src/engine/DataEngine.ts', out: 'DataEngine' }
  ]
})

esbuild.build({
  ...DataEngineConfig,
  platform: 'node',
  format: 'cjs',
  outdir: 'dist/cjs/engine',
  outExtension: {
    '.js': '.cjs'
  },
  entryPoints: [
    { in: 'src/engine/DataEngine.ts', out: 'DataEngine' }
  ]
})

esbuild.build({
  ...DataEngineConfig,
  platform: 'browser',
  format: 'esm',
  outdir: 'dist/esm/engine',
  outExtension: {
    '.js': '.mjs'
  },
  entryPoints: [
    { in: 'src/engine/InMemory.ts', out: 'InMemory' }
  ]
})

esbuild.build({
  ...DataEngineConfig,
  platform: 'node',
  format: 'cjs',
  outdir: 'dist/cjs/engine',
  outExtension: {
    '.js': '.cjs'
  },
  entryPoints: [
    { in: 'src/engine/InMemory.ts', out: 'InMemory' }
  ]
})

esbuild.build({
  ...DataEngineConfig,
  platform: 'node',
  format: 'esm',
  outdir: 'dist/esm/engine',
  outExtension: {
    '.js': '.mjs'
  },
  entryPoints: [
    { in: 'src/engine/FileSystem.ts', out: 'FileSystem' }
  ],
  external: ['node:fs', 'node:crypto', 'fs', 'crypto']
})

esbuild.build({
  ...DataEngineConfig,
  platform: 'node',
  format: 'cjs',
  outdir: 'dist/cjs/engine',
  outExtension: {
    '.js': '.cjs'
  },
  entryPoints: [
    { in: 'src/engine/FileSystem.ts', out: 'FileSystem' }
  ],
  external: ['node:fs', 'node:crypto', 'fs', 'crypto']
})

esbuild.build({
  ...DataEngineConfig,
  platform: 'browser',
  format: 'esm',
  outdir: 'dist/esm/engine',
  outExtension: {
    '.js': '.mjs'
  },
  entryPoints: [
    { in: 'src/engine/WebWorker.ts', out: 'WebWorker' }
  ]
})
