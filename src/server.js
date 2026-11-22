import app from './app.js';
import env from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { ensureDefaultAdmin } from './services/auth.service.js';

const startServer = async () => {
  await connectDB();
  await ensureDefaultAdmin();

  const server = app.listen(env.port, () => {
    console.log(`Sahil Optical Server running in ${env.nodeEnv} mode on port ${env.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

startServer();
