import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

const netlifyFunctionsPlugin = () => {
  return {
    name: 'netlify-functions-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url.startsWith('/.netlify/functions/')) {
          const funcName = req.url.split('/').pop().split('?')[0];
          const funcPath = path.resolve(__dirname, 'netlify/functions', funcName + '.js');

          if (fs.existsSync(funcPath)) {
            // Buffer body
            const buffers = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const body = Buffer.concat(buffers).toString();

            // Mock Event
            const event = {
              httpMethod: req.method,
              body: body,
              headers: req.headers,
              path: req.url,
            };

            // Load Env
            const env = loadEnv('development', process.cwd(), '');
            process.env = { ...process.env, ...env };

            try {
              // Build-less function loading for fast dev cycle
              // Note: using timestamp to bust cache in case of modification
              const importUrl = pathToFileURL(funcPath).href + '?t=' + Date.now();
              const { handler } = await import(importUrl);
              const result = await handler(event, {});

              res.statusCode = result.statusCode || 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(result.body);
            } catch (err) {
              console.error(err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }
        }
        next();
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), netlifyFunctionsPlugin()],
})
