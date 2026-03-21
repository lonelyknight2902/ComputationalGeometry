import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		prerender: {
			crawl: true,
			entries: ['/']
		},
		adapter: adapter({ pages: 'build', assets: 'build', fallback: null, precompress: false }),
		paths: {
			base: process.env.NODE_ENV === 'production' ? '/ComputationalGeometry' : ''
		}
	}
};

export default config;
