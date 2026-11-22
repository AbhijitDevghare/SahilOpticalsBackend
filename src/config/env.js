import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always load backend/.env regardless of the working directory used to start Node
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const mongoUri = process.env.MONGODB_URI?.trim();
const jwtSecret = process.env.JWT_SECRET?.trim();

if (!mongoUri) {
  throw new Error('Missing required environment variable: MONGODB_URI');
}

if (!jwtSecret) {
  throw new Error('Missing required environment variable: JWT_SECRET');
}

const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV?.trim() || 'production',
  mongoUri,
  corsOrigin: process.env.CORS_ORIGIN?.trim() || '*',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN?.trim() || '7d',
};

export default env;
