import { build, context } from 'esbuild'
import { stylusLoader } from 'esbuild-stylus-loader'

const opts = {
  bundle: true,
  entryPoints: ['index.jsx'],
  loader: { '.png': 'dataurl', '.mp3': 'dataurl' },
  outdir: '../omphaloskepsis/static/',
  plugins: [stylusLoader()],
}

if (process.env.NODE_ENV === 'production') {
  await build({ ...opts, minify: true, sourcemap: false })
} else {
  await (await context({ ...opts, minify: false, sourcemap: true })).watch()
}
