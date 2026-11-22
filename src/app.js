import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import env from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.js';

const app = express();

// CORS middleware
const allowedOrigin =
  env.corsOrigin === '*'
    ? true
    : env.corsOrigin.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  })
);

// Cookie & Body parsers
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', apiRoutes);

// 404 & Central Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
