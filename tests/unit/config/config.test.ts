import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { loadConfig, matchRule } from '../../../src/config/index.js';
import { ConfigurationError } from '../../../src/core/errors.js';

describe('Config Loader and Rule Matcher', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('loads valid default yaml configuration file', () => {
    const configPath = path.resolve(process.cwd(), 'config/default.yaml');
    const config = loadConfig(configPath);
    expect(config.server.port).toBe(3000);
    expect(config.redis.enabled).toBe(true);
    expect(config.rules.length).toBeGreaterThan(0);
  });

  it('applies environment variable overrides', () => {
    process.env['PORT'] = '8080';
    process.env['REDIS_HOST'] = 'redis-prod';
    process.env['REDIS_PORT'] = '6380';
    process.env['FAIL_MODE'] = 'fail_open';

    const config = loadConfig();
    expect(config.server.port).toBe(8080);
    expect(config.redis.host).toBe('redis-prod');
    expect(config.redis.port).toBe(6380);
    expect(config.failMode).toBe('fail_open');
  });

  it('throws ConfigurationError on invalid schema', () => {
    process.env['FAIL_MODE'] = 'invalid_mode';
    expect(() => loadConfig()).toThrow(ConfigurationError);
  });

  it('loads valid json configuration file', () => {
    const tmpJson = path.resolve(process.cwd(), 'scratch-test-config.json');
    fs.writeFileSync(
      tmpJson,
      JSON.stringify({
        server: { port: 4500 },
        failMode: 'fail_open',
        rules: [],
      }),
    );
    try {
      const config = loadConfig(tmpJson);
      expect(config.server.port).toBe(4500);
      expect(config.failMode).toBe('fail_open');
    } finally {
      fs.unlinkSync(tmpJson);
    }
  });

  it('throws ConfigurationError on malformed config file', () => {
    const tmpBad = path.resolve(process.cwd(), 'scratch-bad-config.yaml');
    fs.writeFileSync(tmpBad, ':\n::not valid yaml: :');
    try {
      expect(() => loadConfig(tmpBad)).toThrow(ConfigurationError);
    } finally {
      fs.unlinkSync(tmpBad);
    }
  });

  it('matches rules by priority (exact both > client > route > default)', () => {
    const config = {
      server: { port: 3000, host: '0.0.0.0', logLevel: 'info' as const },
      redis: { enabled: false, host: 'localhost', port: 6379, keyPrefix: 'rl:', connectTimeoutMs: 5000 },
      failMode: 'fail_closed' as const,
      defaultRule: { algorithm: 'fixed_window' as const, limit: 10, windowSec: 60 },
      rules: [
        { route: '/api/search', algorithm: 'token_bucket' as const, limit: 100, windowSec: 60 },
        { clientId: 'vip', algorithm: 'token_bucket' as const, limit: 1000, windowSec: 60 },
        { route: '/api/search', clientId: 'vip', algorithm: 'token_bucket' as const, limit: 2000, windowSec: 60 },
      ],
    };

    // Both match
    const rule1 = matchRule(config, { route: '/api/search', clientId: 'vip' });
    expect(rule1.limit).toBe(2000);

    // Client match only
    const rule2 = matchRule(config, { route: '/api/other', clientId: 'vip' });
    expect(rule2.limit).toBe(1000);

    // Route match only
    const rule3 = matchRule(config, { route: '/api/search' });
    expect(rule3.limit).toBe(100);

    // Default fallback
    const rule4 = matchRule(config, { route: '/api/unknown' });
    expect(rule4.limit).toBe(10);
  });
});
