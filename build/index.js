const esbuild = require('esbuild')

const common = {
  target: 'esnext',
  entryPoints: [
    { in: 'src/index.ts', out: 'index' }
  ],
  external: ['node:fs', 'node:crypto', 'crypto'],
  // minify: true
}

esbuild.build({
  ...common,
  outdir: 'dist/esm',
  bundle: true,
  format: 'esm',
})

esbuild.build({
  ...common,
  outdir: 'dist/cjs',
  bundle: true,
  format: 'cjs',
})
