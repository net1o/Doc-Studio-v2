import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

const VIRTUAL_FIREBASE_MODULE_ID = 'virtual:firebase-config';
const RESOLVED_VIRTUAL_FIREBASE_MODULE_ID = `\0${VIRTUAL_FIREBASE_MODULE_ID}`;

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');

  const loadRuntimeFirebaseConfig = () => {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    let fileCfg: Record<string, string> = {};
    if (fs.existsSync(configPath)) {
      try {
        fileCfg = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, string>;
      } catch {
        fileCfg = {};
      }
    }

    return {
      projectId: env.VITE_FIREBASE_PROJECT_ID || fileCfg.projectId || '',
      appId: env.VITE_FIREBASE_APP_ID || fileCfg.appId || '',
      apiKey: env.VITE_FIREBASE_API_KEY || fileCfg.apiKey || '',
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || fileCfg.authDomain || '',
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || fileCfg.storageBucket || '',
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || fileCfg.messagingSenderId || '',
      oAuthClientId: env.VITE_FIREBASE_OAUTH_CLIENT_ID || fileCfg.oAuthClientId || '',
    };
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'firebase-runtime-config',
        resolveId(id) {
          if (id === VIRTUAL_FIREBASE_MODULE_ID) {
            return RESOLVED_VIRTUAL_FIREBASE_MODULE_ID;
          }
          return null;
        },
        load(id) {
          if (id === RESOLVED_VIRTUAL_FIREBASE_MODULE_ID) {
            return `export default ${JSON.stringify(loadRuntimeFirebaseConfig())};`;
          }
          return null;
        },
      },
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
