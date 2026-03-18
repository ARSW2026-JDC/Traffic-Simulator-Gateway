import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  backendUrl: process.env.BACKEND_URL || 'http://localhost:4000',
  simulationUrl: process.env.SIMULATION_URL || 'http://localhost:5000',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  firebasePrivateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
};
