import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const clientPort = Number(env.VITE_PORT || 3601);
  const clientHost = env.VITE_HOST || '127.0.0.1';
  const serverPort = Number(env.PORT || 8601);
  const serverHost = env.HOST || '127.0.0.1';

  return {
    plugins: [
      react({
        babel: {
          plugins: [
            'react-dev-locator',
          ],
        },
      }),
      traeBadgePlugin({
        variant: 'dark',
        position: 'bottom-right',
        prodOnly: true,
        clickable: true,
        clickUrl: 'https://www.trae.ai/solo?showJoin=1',
        autoTheme: true,
        autoThemeTarget: '#root'
      }),
      tsconfigPaths(),
    ],
    server: {
      host: clientHost,
      port: clientPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://${serverHost}:${serverPort}`,
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})
