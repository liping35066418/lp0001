import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import app from './app.js';

const PORT = Number(process.env.PORT || 8601);
const HOST = process.env.HOST || '127.0.0.1';

const server = app.listen(PORT, HOST, () => {
  console.log(`[Boardgame API] Server ready on http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => process.exit(0));
});

export default app;