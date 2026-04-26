import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { config } from '../config/config';

let firebaseApp: admin.app.App | null = null;
const isFirebaseConfigured = !!(
  config.firebaseProjectId &&
  config.firebaseClientEmail &&
  config.firebasePrivateKey
);

/**
 * Initialize Firebase Admin SDK lazily
 * Only initializes if credentials are fully configured
 */
export function getFirebaseApp(): admin.app.App | null {
  if (firebaseApp) return firebaseApp;
  if (!isFirebaseConfigured) {
    return null;
  }

  try {
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
    console.info('Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    process.exit(1);
  }
}

/**
 * Validates email is present and well-formed
 */
export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && email.trim().length > 0 && email.includes('@');
}

/**
 * Authentication middleware
 * Verifies Firebase ID token and extracts user information
 * 
 * If Firebase is not configured:
 * - In development: logs warning and passes request through
 * - In production: fails fast (already caught in config validation)
 * 
 * Headers added to request:
 * - x-user-id: Firebase UID
 * - x-user-email: Firebase email (validated)
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const app = getFirebaseApp();

  // Firebase not configured - allow request (development only)
  if (!app) {
    if (config.nodeEnv === 'development') {
      console.warn(
        'Firebase not configured. Authentication disabled (development mode).',
      );
      next();
      return;
    }
    // In production, this should have been caught by config validation
    res.status(500).json({
      error: 'Authentication service unavailable',
    });
    return;
  }

  // Extract Bearer token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing or invalid Authorization header. Expected format: "Bearer <token>"',
    });
    return;
  }

  try {
    const token = authHeader.slice(7); // Remove "Bearer " prefix
    const decoded = await admin.auth(app).verifyIdToken(token);

    // Validate email is present and valid
    if (!isValidEmail(decoded.email)) {
      console.warn(
        `Token missing valid email. UID: ${decoded.uid}. Email: ${decoded.email}`,
      );
      res.status(401).json({
        error: 'Invalid token: missing email claim',
      });
      return;
    }

    // Attach user info to request headers
    req.headers['x-user-id'] = decoded.uid;
    req.headers['x-user-email'] = decoded.email;

    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Token verification failed: ${errorMessage}`);

    // Determine error type and return appropriate status
    if (
      errorMessage.includes('auth/id-token-expired') ||
      errorMessage.includes('expired')
    ) {
      res.status(401).json({
        error: 'Token expired',
      });
    } else if (errorMessage.includes('auth/invalid-id-token') || errorMessage.includes('invalid')) {
      res.status(401).json({
        error: 'Invalid token',
      });
    } else {
      res.status(401).json({
        error: 'Token verification failed',
      });
    }
  }
}

