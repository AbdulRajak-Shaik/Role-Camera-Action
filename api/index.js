let app;

try {
  console.log('[BOOT] Initializing Vercel API entrypoint');
  app = require('../backend/server.js');
  console.log('[BOOT] Vercel API entrypoint ready');
} catch (error) {
  console.error('[BOOT] Failed to initialize API entrypoint:', error);
  throw error;
}

module.exports = app;
