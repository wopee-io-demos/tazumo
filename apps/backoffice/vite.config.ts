import { defineConfig } from 'vite';

const proxy = { '/v1': { target: process.env.BACKOFFICE_API_URL ?? 'http://127.0.0.1:3001' } };

export default defineConfig({ server: { proxy }, preview: { proxy } });
