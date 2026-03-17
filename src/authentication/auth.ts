import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { config } from '../config';

let firebaseApp: admin.app.App | null = null;

function getApp(): admin.app.App | null {
  if (firebaseApp) return firebaseApp;
  if (!config.firebaseProjectId || !config.firebaseClientEmail || !config.firebasePrivateKey) {
    console.warn('Gateway: Firebase credentials not set, auth middleware disabled');
    return null;
  }
  firebaseApp = admin.initializeApp(
    {
      credential: admin.credential.cert({
        projectId: config.firebaseProjectId,
        clientEmail: config.firebaseClientEmail,
        privateKey: config.firebasePrivateKey,
      }),
    },
    'gateway',
  );
  return firebaseApp;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const app = getApp();
  if (!app) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  try {
    const decoded = await admin.auth(app).verifyIdToken(authHeader.split(' ')[1]);
    req.headers['x-user-id'] = decoded.uid;
    req.headers['x-user-email'] = decoded.email || '';
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
