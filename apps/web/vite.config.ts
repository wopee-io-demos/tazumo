import { defineConfig } from 'vite';

const proxy = process.env.TAZUMO_API_URL ? { '/v1': { target: process.env.TAZUMO_API_URL } } : undefined;

export default defineConfig({ base: process.env.TAZUMO_WEB_BASE || '/', server: { proxy }, preview: { proxy } });
