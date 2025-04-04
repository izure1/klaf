const esbuild = require('esbuild')

// Klaf
const KlafConfig = {
  target: 'esnext',
  bundle: true,
  entryPoints: [
    { in: 'src/index.ts', out: 'index' }
  ],
}

const pluginPathBrowserify = {
  name: 'node-path-polyfill',
  setup(build) {
    build.onResolve({ filter: /^node:path$/ }, args => {
      return {
        path: require.resolve('path-browserify')
      }
    })
  }
}

esbuild.build({
  ...KlafConfig,
  platform: 'browser',
  format: 'esm',
  outdir: 'dist/esm',
  outExtension: {
    '.js': '.mjs'
  },
  plugins: [
    pluginPathBrowserify
  ],
})

esbuild.build({
  ...KlafConfig,
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
  ],
  plugins: [
    pluginPathBrowserify
  ],
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
  ],
  plugins: [
    pluginPathBrowserify
  ],
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
  ],
  plugins: [
    pluginPathBrowserify
  ],
})
