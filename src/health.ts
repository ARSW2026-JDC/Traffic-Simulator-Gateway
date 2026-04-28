import { config } from './config/config';

/**
 * Checks the health of the backend service.
 * Returns 'ok', 'error', or 'unavailable'.
 */
export const checkBackendHealth = async (): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${config.backendUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return response.ok ? 'ok' : 'error';
  } catch {
    return 'unavailable';
  }
};

/**
 * Checks the health of the simulation server.
 * Returns 'ok', 'error', or 'unavailable'.
 */
export const checkSimulationHealth = async (): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${config.simulationUrl}/sim/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return response.ok ? 'ok' : 'error';
  } catch {
    return 'unavailable';
  }
};
