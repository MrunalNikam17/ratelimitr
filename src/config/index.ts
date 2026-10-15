import fs from 'node:fs';
import yaml from 'js-yaml';
import { AppConfig, AppConfigSchema } from './schema.js';
import { RateLimitRule } from '../core/types.js';
import { ConfigurationError } from '../core/errors.js';

export function loadConfig(filePath?: string): AppConfig {
  let raw: Record<string, unknown> = {};

  const targetPath = filePath || process.env['CONFIG_PATH'];
  if (targetPath && fs.existsSync(targetPath)) {
    try {
      const fileContent = fs.readFileSync(targetPath, 'utf8');
      if (targetPath.endsWith('.json')) {
        raw = JSON.parse(fileContent);
      } else {
        raw = (yaml.load(fileContent) as Record<string, unknown>) || {};
      }
    } catch (err) {
      throw new ConfigurationError(`Failed to parse configuration file at ${targetPath}: ${String(err)}`);
    }
  }

  // Allow environment variables to override values
  if (process.env['PORT']) {
    raw['server'] = { ...(raw['server'] as object), port: Number(process.env['PORT']) };
  }
  if (process.env['LOG_LEVEL']) {
    raw['server'] = { ...(raw['server'] as object), logLevel: process.env['LOG_LEVEL'] };
  }
  if (process.env['REDIS_URL']) {
    raw['redis'] = { ...(raw['redis'] as object), url: process.env['REDIS_URL'], enabled: true };
  } else if (process.env['REDIS_HOST']) {
    raw['redis'] = {
      ...(raw['redis'] as object),
      host: process.env['REDIS_HOST'],
      port: Number(process.env['REDIS_PORT'] || 6379),
      enabled: true,
    };
  }
  if (process.env['FAIL_MODE']) {
    raw['failMode'] = process.env['FAIL_MODE'];
  }

  const result = AppConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigurationError(`Invalid configuration: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Finds the most specific matching rule for a given route and client.
 * Priority:
 * 1. Exact match on both route and clientId
 * 2. Exact match on clientId
 * 3. Exact match on route
 * 4. Default rule
 */
export function matchRule(
  config: AppConfig,
  params: { route?: string; clientId?: string },
): RateLimitRule {
  const { route, clientId } = params;

  if (route && clientId) {
    const both = config.rules.find((r) => r.route === route && r.clientId === clientId);
    if (both) return both;
  }

  if (clientId) {
    const clientRule = config.rules.find((r) => r.clientId === clientId && !r.route);
    if (clientRule) return clientRule;
  }

  if (route) {
    const routeRule = config.rules.find((r) => r.route === route && !r.clientId);
    if (routeRule) return routeRule;
  }

  return config.defaultRule;
}
