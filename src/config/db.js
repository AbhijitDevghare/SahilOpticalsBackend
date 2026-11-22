
import dns from 'node:dns';
import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://abhi_dev04:arisandh76@cluster0.djuqmro.mongodb.net/sahil_opticals?retryWrites=true&w=majority';

const ensureSrvDnsResolution = async (uri) => {
  if (!uri.startsWith('mongodb+srv://')) return;

  try {
    const host = new URL(uri).hostname;
    await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
  } catch (err) {
    if (['ECONNREFUSED', 'ETIMEOUT', 'ESERVFAIL'].includes(err.code)) {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    }
  }
};

export const connectDB = async () => {
  try {
    await ensureSrvDnsResolution(MONGO_URI);

    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      family: 4,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;

  } catch (error) {
    console.error('MongoDB Connection Error:', error.message);
    throw error;
  }
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};
