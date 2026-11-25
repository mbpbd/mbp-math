import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import {
  DEFAULT_ADMIN_EMAILS,
  getHealthPayload,
  handleSendSmsRequest,
  handleVerifyAdminRequest,
  normalizePhone,
  verifyFirebaseAdminToken
} from './api/_lib/core.js';

export { DEFAULT_ADMIN_EMAILS, normalizePhone, verifyFirebaseAdminToken };

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json(getHealthPayload());
});

app.post('/api/auth/verify-admin', async (req: Request, res: Response) => {
  const result = await handleVerifyAdminRequest({
    authorizationHeader: req.headers.authorization,
    body: req.body
  });
  res.status(result.status).json(result.body);
});

app.post('/api/send-sms', async (req: Request, res: Response) => {
  const result = await handleSendSmsRequest({
    authorizationHeader: req.headers.authorization,
    body: req.body
  });
  res.status(result.status).json(result.body);
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.use((req: Request, res: Response, next) => {
        if (req.path.startsWith('/api/')) {
          next();
          return;
        }
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VITEST) {
  startServer();
}
