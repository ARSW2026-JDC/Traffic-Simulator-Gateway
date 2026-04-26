/**
 * Loki Integration
 * 
 * Sends structured logs to Grafana Loki for aggregation and querying.
 * Uses Loki's HTTP API (JSON format).
 */

import { logger } from './logging';
import { config } from '../config/config';

interface LokiConfig {
  url?: string;
  username?: string;
  apiKey?: string;
  enabled: boolean;
}

const lokiConfig: LokiConfig = {
  url: process.env.LOKI_URL,
  username: process.env.LOKI_USERNAME,
  apiKey: process.env.LOKI_API_KEY,
  enabled: !!process.env.LOKI_URL,
};

/**
 * Stream labels for all Gateway logs
 */
const baseLabels = {
  service: 'gateway',
  environment: config.nodeEnv,
  version: process.env.APP_VERSION || '0.1.0',
};

/**
 * Sends logs to Loki via HTTP API
 * Uses batches to reduce network overhead
 */
class LokiBulkLogger {
  private buffer: Array<{ stream: Record<string, string>; values: Array<{ ts: string; line: string }> }> = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly maxBatchSize = 100;
  private readonly flushIntervalMs = 5000;

  constructor() {
    if (lokiConfig.enabled) {
      this.startFlushInterval();
      logger.info({ msg: 'Loki integration enabled', loki: { url: lokiConfig.url } });
    } else {
      logger.info({ msg: 'Loki not configured (set LOKI_URL to enable)' });
    }
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  async addLog(level: string, message: string, extra: Record<string, unknown> = {}): Promise<void> {
    const entry = {
      stream: { ...baseLabels, level },
      values: [
        {
          ts: new Date().toISOString(),
          line: JSON.stringify({ msg: message, ...extra }),
        },
      ],
    };

    this.buffer.push(entry);

    if (this.buffer.length >= this.maxBatchSize) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0 || !lokiConfig.enabled) {
      return;
    }

    const payload = {
      streams: this.buffer,
    };

    try {
      const response = await fetch(`${lokiConfig.url}/loki/api/v1/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(lokiConfig.username && lokiConfig.apiKey
            ? {
                Authorization: `Basic ${Buffer.from(
                  `${lokiConfig.username}:${lokiConfig.apiKey}`,
                ).toString('base64')}`,
              }
            : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[loki] Push failed: ${response.status} - ${error}`);
      }
    } catch (error) {
      console.error('[loki] Push error:', error);
    } finally {
      this.buffer = [];
    }
  }

  shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flush(); // Flush remaining logs
    }
  }
}

export const lokiLogger = new LokiBulkLogger();