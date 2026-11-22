import dns from 'node:dns';
import mongoose from 'mongoose';
import env from './env.js';

const ensureSrvDnsResolution = async (uri) => {
  if (!uri.startsWith('mongodb+srv://')) return;

  try {
    const host = new URL(uri).hostname;
    await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEOUT' || err.code === 'ESERVFAIL') {
      // Fallback to public DNS resolvers when local ISP/router DNS refuses SRV records
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    }
  }
};

export const connectDB = async () => {
  try {
    await ensureSrvDnsResolution(env.mongoUri);

    const conn = await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    console.log(
      `MongoDB Atlas Connected: ${conn.connection.host} (DB: ${conn.connection.name})`
    );
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};
