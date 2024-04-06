const esbuild = require('esbuild')

const common = {
  target: 'esnext',
  platform: 'node',
  bundle: true,
  entryPoints: [
    { in: 'src/index.ts', out: 'index' }
  ],
  external: ['node:fs', 'node:crypto', 'fs', 'crypto']
}

esbuild.build({
  ...common,
  format: 'esm',
  outdir: 'dist/esm',
  outExtension: {
    '.js': '.mjs'
  },
})

esbuild.build({
  ...common,
  format: 'cjs',
  outdir: 'dist/cjs',
  outExtension: {
    '.js': '.cjs'
  },
})
