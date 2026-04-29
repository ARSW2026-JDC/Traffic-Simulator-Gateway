/**
 * Environment Variables Validation
 * 
 * Validates that all required environment variables are present and valid.
 * Fails fast if configuration is incomplete or invalid.
 */

export interface ValidatedEnv {
  port: number;
  backendUrl: string;
  chatUrl: string;
  historyUrl: string;
  simulationUrl: string;
  firebaseProjectId: string;
  firebaseClientEmail: string;
  firebasePrivateKey: string;
  allowedOrigin: string;
  nodeEnv: 'development' | 'production' | 'test';
}

/**
 * Validates a URL string format
 */
export function validateUrl(url: string, fieldName: string): void {
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL for ${fieldName}: "${url}". Must be a valid HTTP/HTTPS URL.`);
  }
}

/**
 * Validates a port number
 */
export function validatePort(port: number, fieldName: string): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port for ${fieldName}: ${port}. Must be an integer between 1 and 65535.`);
  }
}

/**
 * Validates Firebase Private Key format
 */
export function validateFirebasePrivateKey(key: string): void {
  if (!key.includes('BEGIN PRIVATE KEY') || !key.includes('END PRIVATE KEY')) {
    throw new Error('Invalid FIREBASE_PRIVATE_KEY: Must contain BEGIN and END markers.');
  }
}

/**
 * Main validation function
 */
export function validateEnvironment(): ValidatedEnv {
  const errors: string[] = [];

  // PORT
  const port = parseInt(process.env.PORT || '3000', 10);
  try {
    validatePort(port, 'PORT');
  } catch (e) {
    errors.push((e as Error).message);
  }

  // BACKEND_URL
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
  try {
    validateUrl(backendUrl, 'BACKEND_URL');
  } catch (e) {
    errors.push((e as Error).message);
  }

  // SIMULATION_URL
  const simulationUrl = process.env.SIMULATION_URL || 'http://localhost:5000';
  try {
    validateUrl(simulationUrl, 'SIMULATION_URL');
  } catch (e) {
    errors.push((e as Error).message);
  }

  // CHAT_URL
  const chatUrl = process.env.CHAT_URL || 'http://localhost:6000';
  try {
    validateUrl(chatUrl, 'CHAT_URL');
  } catch (e) {
    errors.push((e as Error).message);
  }

  // HISTORY_URL
  const historyUrl = process.env.HISTORY_URL || 'http://localhost:3060';
  try {
    validateUrl(historyUrl, 'HISTORY_URL');
  } catch (e) {
    errors.push((e as Error).message);
  }

  // ALLOWED_ORIGIN
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
  try {
    validateUrl(allowedOrigin, 'ALLOWED_ORIGIN');
  } catch (e) {
    errors.push((e as Error).message);
  }

  // Firebase Configuration
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID?.trim() || '';
  const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim() || '';
  const firebasePrivateKeyRaw = (process.env.FIREBASE_PRIVATE_KEY || '').trim();
  const firebasePrivateKey = firebasePrivateKeyRaw.replace(/\\n/g, '\n');

  // Firebase is optional in development, but if any credential is set, all must be set
  const hasAnyFirebaseConfig =
    firebaseProjectId || firebaseClientEmail || firebasePrivateKeyRaw;

  if (hasAnyFirebaseConfig) {
    if (!firebaseProjectId) {
      errors.push('FIREBASE_PROJECT_ID is required when Firebase is configured.');
    }
    if (!firebaseClientEmail) {
      errors.push('FIREBASE_CLIENT_EMAIL is required when Firebase is configured.');
    }
    if (!firebasePrivateKeyRaw) {
      errors.push('FIREBASE_PRIVATE_KEY is required when Firebase is configured.');
    } else {
      try {
        validateFirebasePrivateKey(firebasePrivateKey);
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    if (!firebaseClientEmail.includes('@')) {
      errors.push('FIREBASE_CLIENT_EMAIL must be a valid email address.');
    }
  }

  // NODE_ENV
  const nodeEnv = (process.env.NODE_ENV || 'development') as
    | 'development'
    | 'production'
    | 'test';
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    errors.push(
      `Invalid NODE_ENV: "${nodeEnv}". Must be one of: development, production, test`,
    );
  }

  // If there are any validation errors, fail fast
  if (errors.length > 0) {
    console.error('Environment Variable Validation Failed:');
    errors.forEach((error) => console.error(`  - ${error}`));
    console.error(
      '\n Tip: Copy .env.example to .env and fill in your values.',
    );
    process.exit(1);
  }

  console.info('Environment variables validated successfully');

  return {
    port,
    backendUrl,
    simulationUrl,
    chatUrl,
    historyUrl,
    firebaseProjectId,
    firebaseClientEmail,
    firebasePrivateKey,
    allowedOrigin,
    nodeEnv,
  };
}
