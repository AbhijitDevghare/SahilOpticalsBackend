import mongoose from 'mongoose';

export const getSystemHealth = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    service: 'Sahil Optical Backend API',
    status: 'OK',
    database: states[mongoose.connection.readyState] || 'unknown',
    timestamp: new Date().toISOString(),
  };
};
