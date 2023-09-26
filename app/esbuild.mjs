import { build } from 'esbuild'
import { stylusLoader } from 'esbuild-stylus-loader'

await build({
  bundle: true,
  entryPoints: ['index.jsx'],
  loader: { '.png': 'file', '.mp3': 'file' },
  minify: true,
  outdir: '../omphaloskepsis/static/',
  plugins: [stylusLoader()],
  sourcemap: true,
})
