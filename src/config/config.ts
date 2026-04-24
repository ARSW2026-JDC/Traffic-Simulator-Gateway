import 'dotenv/config';
import { validateEnvironment } from './env.validation';

/**
 * Validated application configuration
 * Environment variables are validated on application startup.
 * If validation fails, the application will exit with error code 1.
 */
export const config = validateEnvironment();
