import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [preact()],
        define: {
            'process.env.NODE_ENV': JSON.stringify(mode),
            'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL),
            'import.meta.env.VITE_WEBSOCKET_URL': JSON.stringify(env.VITE_WEBSOCKET_URL),
            'import.meta.env.VITE_SANDBOX_MODE': JSON.stringify(env.VITE_SANDBOX_MODE),
            'import.meta.env.PROD': mode === 'production',
            'import.meta.env.DEV': mode === 'development',
            'import.meta.env.MODE': JSON.stringify(mode),
        },
        build: {
            lib: {
                entry: 'src/widget.tsx',
                name: 'ExchangeWidget',
                formats: ['umd'],
                fileName: () => 'widget.js',
            },
            rollupOptions: {
                output: {
                    manualChunks: undefined,
                    inlineDynamicImports: true,
                },
            },
            cssCodeSplit: false,
            minify: 'esbuild',
            sourcemap: false,
        },
    };
});