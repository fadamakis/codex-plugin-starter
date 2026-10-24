import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export default defineConfig({
  plugins: [tailwindcss(), viteSingleFile(), {
    name: 'starter-build-assets',
    transformIndexHtml(html) {
      const manifest = JSON.parse(readFileSync('plugin.json', 'utf8'));
      const icon = path.resolve(manifest.extensions['com.openai'].interface.logo);
      if (!icon.startsWith(path.resolve('assets') + path.sep)) throw new Error('Keep the icon inside assets/.');
      const title = manifest.extensions['com.openai'].interface.displayName.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      return {
        html: html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`),
        tags: [{ tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: `data:image/svg+xml;base64,${readFileSync(icon).toString('base64')}` }, injectTo: 'head' }],
      };
    },
    generateBundle(_options, bundle) {
      const modules = Object.values(bundle).flatMap(item => item.type === 'chunk'
        ? Object.entries(item.modules).filter(([, value]) => value.renderedLength > 0).map(([name]) => name) : []);
      mkdirSync('dist', { recursive: true });
      writeFileSync('dist/ui-modules.json', JSON.stringify(modules));
    },
  }],
  css: { postcss: { plugins: [{ postcssPlugin: 'omit-unused-math-fonts', AtRule: { 'font-face': rule => { if (/KaTeX/.test(rule.toString())) rule.remove(); } } }] } },
  build: {
    outDir: 'dist/ui', target: 'es2022',
    rolldownOptions: {
      onLog(level, log, handler) {
        if (log.code === 'MODULE_LEVEL_DIRECTIVE' && log.message.includes('use client')) return;
        handler(level, log);
      },
    },
  },
  server: { port: 5173, strictPort: true },
});
