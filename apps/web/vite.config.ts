import { defineConfig } from 'vite';

export default defineConfig({ base: process.env.TAZUMO_WEB_BASE || '/' });
