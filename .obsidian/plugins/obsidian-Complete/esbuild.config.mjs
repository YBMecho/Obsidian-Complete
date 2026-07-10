import esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['main.ts'],
  bundle: true,
  external: ['obsidian', '@codemirror/view', '@codemirror/state'],
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  outfile: 'main.js',
  loader: { '.json': 'json' },
  sourcemap: 'inline',
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
